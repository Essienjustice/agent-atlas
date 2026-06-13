require("@nomicfoundation/hardhat-toolbox");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
require("dotenv").config({ path: path.join(__dirname, ".env"), override: true });

const privateKey = process.env.PRIVATE_KEY || "";

module.exports = {
  solidity: "0.8.24",
  networks: {
    hardhat: {},
    mantleSepolia: {
      url: process.env.RPC_URL || "https://rpc.sepolia.mantle.xyz",
      chainId: 5003,
      accounts: privateKey ? [privateKey] : []
    }
  },
  etherscan: {
    apiKey: process.env.MANTLESCAN_API_KEY || process.env.ETHERSCAN_API_KEY || "empty",
    customChains: [
      {
        network: "mantleSepolia",
        chainId: 5003,
        urls: {
          apiURL: process.env.MANTLESCAN_API_URL || "https://api-sepolia.mantlescan.xyz/api",
          browserURL: process.env.MANTLE_EXPLORER_URL || "https://sepolia.mantlescan.xyz"
        }
      }
    ]
  }
};
