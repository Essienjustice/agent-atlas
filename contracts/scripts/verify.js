const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function verifyOne(name, item) {
  try {
    await hre.run("verify:verify", {
      address: item.address,
      constructorArguments: item.constructorArgs
    });
    console.log(`Verified ${name}: ${item.address}`);
  } catch (error) {
    const message = error.message || "";
    if (message.toLowerCase().includes("already verified")) {
      console.log(`Already verified ${name}: ${item.address}`);
      return;
    }
    throw error;
  }
}

async function main() {
  const file = path.join(__dirname, "..", "deployments", `${hre.network.name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing deployment file: ${file}`);
  }
  const deployment = JSON.parse(fs.readFileSync(file, "utf8"));

  for (const [name, item] of Object.entries(deployment.contracts)) {
    await verifyOne(name, item);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
