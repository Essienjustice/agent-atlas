export const MANTLE_SEPOLIA_CHAIN = {
  chainId: "0x138B",
  chainName: "Mantle Sepolia",
  nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
  rpcUrls: ["https://rpc.sepolia.mantle.xyz"],
  blockExplorerUrls: ["https://sepolia.mantlescan.xyz"]
};

export const SUPPORTED_WALLETS = "MetaMask, Rabby, Coinbase Wallet, Trust Wallet, Brave Wallet, or another injected EVM wallet";

export function getInjectedProviders() {
  if (typeof window === "undefined" || !window.ethereum) return [];
  const providers = window.ethereum.providers;
  return Array.isArray(providers) && providers.length > 0 ? providers : [window.ethereum];
}

export function getPreferredProvider() {
  const providers = getInjectedProviders();
  return (
    providers.find((provider) => provider?.isMetaMask) ||
    providers.find((provider) => provider?.isRabby) ||
    providers.find((provider) => provider?.isCoinbaseWallet) ||
    providers[0] ||
    null
  );
}

export function getWalletLabel(provider) {
  if (provider?.isRabby) return "Rabby";
  if (provider?.isCoinbaseWallet) return "Coinbase Wallet";
  if (provider?.isTrust) return "Trust Wallet";
  if (provider?.isBraveWallet) return "Brave Wallet";
  if (provider?.isFrame) return "Frame";
  if (provider?.isMetaMask) return "MetaMask";
  return "EVM Wallet";
}

export async function requestWalletOnMantle(provider = getPreferredProvider()) {
  if (!provider) {
    throw new Error(`Install ${SUPPORTED_WALLETS} to connect.`);
  }

  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const from = accounts?.[0];
  if (!from) throw new Error("No wallet account selected.");

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: MANTLE_SEPOLIA_CHAIN.chainId }]
    });
  } catch (switchError) {
    if (switchError?.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [MANTLE_SEPOLIA_CHAIN]
      });
    } else {
      throw switchError;
    }
  }

  const chainId = await provider.request({ method: "eth_chainId" });
  if (chainId.toLowerCase() !== MANTLE_SEPOLIA_CHAIN.chainId.toLowerCase()) {
    throw new Error("Wallet is not connected to Mantle Sepolia.");
  }

  return { from, chainId, provider };
}
