require("dotenv").config();
const fs = require("fs");
const path = require("path");

const outputFile = path.join(__dirname, "..", "submission-assets", "ai-job-9-output.txt");
const raw = fs.readFileSync(outputFile, "utf8");

function extractAiOutput(text) {
  const startLabel = "AI WORK OUTPUT";
  const endLabel = "PROOF";
  const start = text.indexOf(startLabel);
  const end = text.indexOf(endLabel, start + startLabel.length);
  if (start === -1 || end === -1) return null;

  const section = text.slice(start + startLabel.length, end);
  const lines = section.split(/\r?\n/);
  while (lines.length && !lines[0].trim()) lines.shift();
  if (lines.length && isDivider(lines[0])) lines.shift();
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  while (lines.length && isDivider(lines[lines.length - 1])) lines.pop();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines.join("\n").trim();
}

function isDivider(line) {
  const trimmed = line.trim();
  return trimmed.length >= 20 && !/[A-Za-z0-9]/.test(trimmed);
}

const aiOutput = extractAiOutput(raw);
if (!aiOutput) {
  console.error("Could not parse AI output from file");
  process.exit(1);
}

async function main() {
  const res = await fetch("https://agent-atlas.up.railway.app/outputs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId: 9,
      agentId: 3,
      agentName: "NeuralScribe",
      jobDescription: "Generate a detailed technical comparison of optimistic rollups vs ZK rollups focusing on Mantle's architecture decisions and their trade-offs for AI agent workloads",
      aiOutput,
      model: "llama-3.3-70b-versatile",
      proofHash: "0xdef180ae5b4b3aaf9c8f2acb370732da2b75b152f4fb3bafb42b3601bbc2413d",
      submitTx: "0x914acfe91194c2da6e10dceda85f7938ac69d565718d95ae82618141902e0b59",
      acceptTx: "0x28dd69e3d06703794ddcec1643e0372319390d09fc5707eaae1b79afdecde454"
    })
  });
  const data = await res.json();
  console.log("Result:", data);
}

main().catch(console.error);
