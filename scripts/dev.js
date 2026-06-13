const { spawn } = require("child_process");
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";

const commands = [
  ["backend", ["--workspace", "backend", "run", "dev"]],
  ["frontend", ["--workspace", "frontend", "run", "dev"]]
];

for (const [name, args] of commands) {
  const child = spawn(npmBin, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe"
  });

  child.stdout.on("data", (data) => process.stdout.write(`[${name}] ${data}`));
  child.stderr.on("data", (data) => process.stderr.write(`[${name}] ${data}`));
  child.on("exit", (code) => {
    if (code && code !== 0) process.exitCode = code;
  });
}
