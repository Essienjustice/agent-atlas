require("dotenv").config();
const { ethers } = require("ethers");

const deployment = require("../contracts/deployments/mantleSepolia.json");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchVerification(url, attempts = 3) {
  let lastBody = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(url);
    const body = await response.json();
    lastBody = body;
    const row = body.result?.[0] || {};
    if (body.status === "1" && row.SourceCode && row.ABI && row.ABI !== "Contract source code not verified") {
      return body;
    }
    // Mantlescan/Etherscan can briefly return NOTOK after successful verification.
    if (attempt < attempts) await sleep(500 + Math.floor(Math.random() * 500));
  }
  return lastBody;
}

async function reachableOnChain(address) {
  if (!process.env.RPC_URL) return false;
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const code = await provider.getCode(address);
  return Boolean(code && code !== "0x");
}

async function main() {
  const apiUrl = process.env.ETHERSCAN_V2_API_URL || "https://api.etherscan.io/v2/api";
  const apiKey = process.env.MANTLESCAN_API_KEY || process.env.ETHERSCAN_API_KEY || "";
  const results = {};

  for (const [name, item] of Object.entries(deployment.contracts)) {
    const url = new URL(apiUrl);
    url.searchParams.set("module", "contract");
    url.searchParams.set("action", "getsourcecode");
    url.searchParams.set("chainid", "5003");
    url.searchParams.set("address", item.address);
    url.searchParams.set("apikey", apiKey);

    const body = await fetchVerification(url);
    const row = body.result?.[0] || {};
    const sourceCodeVisible = Boolean(row.SourceCode);
    const abiVisible = Boolean(row.ABI && row.ABI !== "Contract source code not verified");
    const fallbackReachable = sourceCodeVisible && abiVisible ? false : await reachableOnChain(item.address);
    results[name] = {
      address: item.address,
      status: body.status,
      message: body.message,
      contractName: row.ContractName || null,
      compilerVersion: row.CompilerVersion || null,
      sourceCodeVisible,
      abiVisible,
      reachableOnChain: fallbackReachable || sourceCodeVisible || abiVisible,
      codeUrl: `${(process.env.MANTLE_EXPLORER_URL || "https://sepolia.mantlescan.xyz").replace(/\/$/, "")}/address/${item.address}#code`,
      readContractUrl: `${(process.env.MANTLE_EXPLORER_URL || "https://sepolia.mantlescan.xyz").replace(/\/$/, "")}/address/${item.address}#readContract`,
      writeContractUrl: `${(process.env.MANTLE_EXPLORER_URL || "https://sepolia.mantlescan.xyz").replace(/\/$/, "")}/address/${item.address}#writeContract`
    };
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
