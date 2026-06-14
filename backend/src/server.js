require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { createApp } = require("./app");
const { assertContractsReachable, isChainMode } = require("./chain");

const PORT = Number(process.env.PORT || 4000);

async function main() {
  const app = createApp();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Agent Atlas API running on port ${PORT}`);
    if (isChainMode()) {
      assertContractsReachable().catch((error) => {
        console.error(`Contract reachability check failed: ${error.message}`);
      });
    }
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
