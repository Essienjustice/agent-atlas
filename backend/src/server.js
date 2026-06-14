require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { spawn } = require("child_process");
const path = require("path");
const { createApp } = require("./app");
const { assertContractsReachable, isChainMode } = require("./chain");

const PORT = Number(process.env.PORT || 4000);

function spawnIndexer() {
  if (!isChainMode()) return;

  const indexerPath = path.join(__dirname, "..", "..", "indexer", "src", "indexer.js");

  function start() {
    console.log("[indexer] starting child process...");
    const child = spawn(process.execPath, [indexerPath], {
      env: process.env,
      stdio: "inherit", // indexer logs appear in Railway alongside backend logs
    });

    child.on("exit", (code, signal) => {
      console.error(`[indexer] exited (code=${code} signal=${signal}) — restarting in 5s`);
      setTimeout(start, 5000);
    });

    child.on("error", (err) => {
      console.error(`[indexer] failed to spawn: ${err.message} — restarting in 5s`);
      setTimeout(start, 5000);
    });
  }

  start();
}

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
