const http = require("http");
const { spawn } = require("child_process");
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";

const env = {
  ...process.env,
  APP_MODE: process.env.APP_MODE || "mvp",
  DEMO_MODE: "true",
  DEMO_DAY: "true",
  CHAIN_MODE: process.env.CHAIN_MODE || "mock",
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
};

const children = [
  spawn(npmBin, ["--workspace", "backend", "run", "start"], { env, stdio: "ignore" }),
  spawn(npmBin, ["--workspace", "indexer", "run", "start"], { env, stdio: "ignore" }),
  spawn(npmBin, ["--workspace", "frontend", "run", "dev"], { env, stdio: "ignore" })
];

for (const child of children) {
  child.on("exit", (code) => {
    if (code && code !== 0) process.exit(code);
  });
}

function waitFor(url, attempts = 90) {
  return new Promise((resolve, reject) => {
    const tryOnce = (remaining) => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) resolve();
        else retry(remaining);
      });
      req.on("error", () => retry(remaining));
      req.setTimeout(1000, () => {
        req.destroy();
        retry(remaining);
      });
    };

    const retry = (remaining) => {
      if (remaining <= 0) reject(new Error(`Timed out waiting for ${url}`));
      else setTimeout(() => tryOnce(remaining - 1), 1000);
    };

    tryOnce(attempts);
  });
}

async function main() {
  await waitFor("http://localhost:4000/health");
  await waitFor("http://localhost:3000");
  console.log("Agent Atlas running at http://localhost:3000");
}

main().catch(() => process.exit(1));
