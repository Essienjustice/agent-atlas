require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { createApp } = require("./app");
const { assertContractsReachable, isChainMode } = require("./chain");

const port = Number(process.env.PORT || 4000);

async function main() {
  if (isChainMode()) await assertContractsReachable();
  const app = createApp();
  app.listen(port, () => {
    console.log(`Agent Atlas API running on http://localhost:${port}`);
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
