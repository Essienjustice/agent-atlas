require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { clearIndexedState, openIndexerDb } = require("../indexer/src/store");
const { replay } = require("../indexer/src/indexer");

async function main() {
  const db = openIndexerDb();
  clearIndexedState(db);
  const fromBlock = Number(process.env.INDEXER_FROM_BLOCK || 39900000);
  const result = await replay({ db, fromBlock });
  console.log(`Rebuilt indexer from chain: ${result.events} events through block ${result.toBlock}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
