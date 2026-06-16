// Agent Atlas Backend - v2
require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { spawn } = require("child_process");
const path = require("path");
const { createApp } = require("./app");
const { assertContractsReachable, isChainMode } = require("./chain");

const PORT = Number(process.env.PORT || 4000);

let _indexerChild = null;

function spawnIndexer() {
  console.log(`[indexer] spawnIndexer called, CHAIN_MODE=${process.env.CHAIN_MODE}`);
  if (!isChainMode()) {
    console.log("[indexer] skipping - CHAIN_MODE is not 'chain'");
    return;
  }

  const indexerPath = path.join(__dirname, "..", "..", "indexer", "src", "indexer.js");

  function start() {
    // Kill any still-running indexer before spawning a new one.
    if (_indexerChild && !_indexerChild.killed) {
      console.log("[indexer] killing previous child before restart");
      _indexerChild.kill("SIGTERM");
      _indexerChild = null;
    }

    console.log("[indexer] starting child process...");
    _indexerChild = spawn(process.execPath, [indexerPath], {
      env: process.env,
      stdio: "inherit", // indexer logs appear in Railway alongside backend logs
    });

    _indexerChild.on("exit", (code, signal) => {
      _indexerChild = null;
      if (signal === "SIGTERM") {
        console.log("[indexer] child stopped (SIGTERM) - not restarting");
        return;
      }
      console.error(`[indexer] exited (code=${code} signal=${signal}) - restarting in 5s`);
      setTimeout(start, 5000);
    });

    _indexerChild.on("error", (err) => {
      _indexerChild = null;
      console.error(`[indexer] failed to spawn: ${err.message} - restarting in 5s`);
      setTimeout(start, 5000);
    });
  }

  start();
}

process.on("SIGTERM", () => {
  if (_indexerChild && !_indexerChild.killed) {
    _indexerChild.kill("SIGTERM");
  }
  process.exit(0);
});

process.on("SIGINT", () => {
  if (_indexerChild && !_indexerChild.killed) {
    _indexerChild.kill("SIGTERM");
  }
  process.exit(0);
});

async function main() {
  const app = createApp();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Agent Atlas API running on port ${PORT}`);
    if (isChainMode()) {
      assertContractsReachable().catch((error) => {
        console.error(`Contract reachability check failed: ${error.message}`);
      });
    }
    spawnIndexer(); // start indexer after server is bound
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
