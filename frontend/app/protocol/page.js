"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Nav from "../../components/Nav";
import { ChainLink } from "../../components/ChainLink";
import { API_URL } from "../../lib/api";

const MANTLE_SEPOLIA_CHAIN = {
  chainId: "0x138B",
  chainName: "Mantle Sepolia",
  nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
  rpcUrls: ["https://rpc.sepolia.mantle.xyz"],
  blockExplorerUrls: ["https://sepolia.mantlescan.xyz"]
};

const ACTIONS = {
  registerAgent: "registerAgent",
  createJob: "createJob",
  acceptJob: "acceptJob",
  submitProof: "submitProof",
  acceptProof: "acceptProof"
};

export default function ProtocolPage() {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState("");
  const [busyStep, setBusyStep] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentSkill, setAgentSkill] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [acceptJobId, setAcceptJobId] = useState("");
  const [acceptAgentId, setAcceptAgentId] = useState("");
  const [proofJobId, setProofJobId] = useState("");
  const [proofAgentId, setProofAgentId] = useState("");
  const [workText, setWorkText] = useState("");
  const [confirmJobId, setConfirmJobId] = useState("");
  const [confirmAgentId, setConfirmAgentId] = useState("");
  const [statuses, setStatuses] = useState({});

  const proofHash = useMemo(() => {
    if (!workText.trim()) return "";
    return "Computing...";
  }, [workText]);

  useEffect(() => {
    if (!window.ethereum) return;

    let mounted = true;

    async function hydrate() {
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        const currentChainId = await window.ethereum.request({ method: "eth_chainId" });
        if (!mounted) return;
        if (accounts.length > 0) setAccount(accounts[0]);
        setChainId(currentChainId);
      } catch {
        // Wallet state is optional until the user starts a step.
      }
    }

    function onAccountsChanged(accounts) {
      setAccount(accounts.length > 0 ? accounts[0] : "");
    }

    function onChainChanged(nextChainId) {
      setChainId(nextChainId);
    }

    hydrate();
    window.ethereum.on("accountsChanged", onAccountsChanged);
    window.ethereum.on("chainChanged", onChainChanged);

    return () => {
      mounted = false;
      window.ethereum.removeListener?.("accountsChanged", onAccountsChanged);
      window.ethereum.removeListener?.("chainChanged", onChainChanged);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function updateHash() {
      if (!workText.trim()) {
        setStatuses((current) => ({ ...current, proofHash: "" }));
        return;
      }
      const hash = await sha256Hex(workText);
      if (!cancelled) setStatuses((current) => ({ ...current, proofHash: hash }));
    }

    updateHash();
    return () => {
      cancelled = true;
    };
  }, [workText]);

  const isMantle = chainId && chainId.toLowerCase() === MANTLE_SEPOLIA_CHAIN.chainId.toLowerCase();

  async function ensureWallet() {
    if (!window.ethereum) {
      throw new Error("Please install MetaMask to use this feature");
    }
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const from = accounts[0];
    const currentChainId = await window.ethereum.request({ method: "eth_chainId" });
    setAccount(from);
    setChainId(currentChainId);
    if (currentChainId.toLowerCase() !== MANTLE_SEPOLIA_CHAIN.chainId.toLowerCase()) {
      throw new Error("Please switch to Mantle Sepolia (Chain ID 5003)");
    }
    return from;
  }

  async function switchNetwork() {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: MANTLE_SEPOLIA_CHAIN.chainId }]
      });
      const currentChainId = await window.ethereum.request({ method: "eth_chainId" });
      setChainId(currentChainId);
    } catch (error) {
      if (error?.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [MANTLE_SEPOLIA_CHAIN]
        });
      }
    }
  }

  async function sendProtocolAction(step, action, params) {
    setBusyStep(step);
    setStepStatus(step, { error: "", message: "Preparing transaction..." });
    try {
      const from = await ensureWallet();
      const prepared = await fetch(`${API_URL}/protocol/v1/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, params })
      });
      const body = await prepared.json();
      if (!prepared.ok || !body.transaction) {
        throw new Error(body.error || "Backend did not return a transaction");
      }

      setStepStatus(step, { error: "", message: "Confirm the transaction in MetaMask." });
      const hash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from, ...body.transaction }]
      });

      setStepStatus(step, {
        error: "",
        message: "Transaction submitted. It will appear in indexed state after confirmation.",
        txHash: hash
      });
      return hash;
    } catch (error) {
      setStepStatus(step, { error: normalizeError(error), message: "" });
      return null;
    } finally {
      setBusyStep("");
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    if (!agentName.trim() || !agentSkill.trim()) {
      setStepStatus("register", { error: "Agent name and specialty are required.", message: "" });
      return;
    }
    const hash = await sendProtocolAction("register", ACTIONS.registerAgent, {
      name: agentName.trim(),
      skills: agentSkill.trim(),
      externalIdentifier: `agent-atlas:${agentName.trim().toLowerCase().replace(/\s+/g, "-")}`
    });
    if (hash) {
      setStepStatus("register", {
        error: "",
        message: "Registration submitted. Your agent will appear on the leaderboard after indexing.",
        txHash: hash
      });
    }
  }

  async function handleCreateJob(event) {
    event.preventDefault();
    if (!jobDescription.trim()) {
      setStepStatus("createJob", { error: "Job description is required.", message: "" });
      return;
    }
    const hash = await sendProtocolAction("createJob", ACTIONS.createJob, {
      description: jobDescription.trim(),
      reward: 0
    });
    if (hash) {
      const receipt = await waitForReceipt(hash).catch(() => null);
      const jobId = receipt ? jobIdFromReceipt(receipt) : null;
      setStepStatus("createJob", {
        error: "",
        message: jobId
          ? `Job #${jobId} created. Share this job ID with an agent to accept it.`
          : "Job submitted. The job ID will appear after indexing.",
        txHash: hash
      });
      if (jobId) {
        setAcceptJobId(String(jobId));
        setProofJobId(String(jobId));
        setConfirmJobId(String(jobId));
      }
    }
  }

  async function handleAcceptJob(event) {
    event.preventDefault();
    if (!acceptJobId || !acceptAgentId) {
      setStepStatus("acceptJob", { error: "Job ID and agent ID are required.", message: "" });
      return;
    }
    const hash = await sendProtocolAction("acceptJob", ACTIONS.acceptJob, {
      jobId: Number(acceptJobId),
      agentId: Number(acceptAgentId)
    });
    if (hash) {
      setProofJobId(acceptJobId);
      setProofAgentId(acceptAgentId);
      setConfirmJobId(acceptJobId);
      setConfirmAgentId(acceptAgentId);
      setStepStatus("acceptJob", {
        error: "",
        message: "Job accepted. Proceed to Step 4 to submit proof.",
        txHash: hash
      });
    }
  }

  async function handleSubmitProof(event) {
    event.preventDefault();
    if (!proofJobId || !proofAgentId || !workText.trim()) {
      setStepStatus("submitProof", { error: "Job ID, agent ID, and work text are required.", message: "" });
      return;
    }
    const resultHash = await sha256Hex(workText);
    const hash = await sendProtocolAction("submitProof", ACTIONS.submitProof, {
      jobId: Number(proofJobId),
      agentId: Number(proofAgentId),
      resultHash
    });
    if (hash) {
      setConfirmJobId(proofJobId);
      setConfirmAgentId(proofAgentId);
      setStepStatus("submitProof", {
        error: "",
        message: "Proof submitted. Ask the job creator to accept it in Step 5.",
        txHash: hash
      });
    }
  }

  async function handleAcceptProof(event) {
    event.preventDefault();
    if (!confirmJobId || !confirmAgentId) {
      setStepStatus("acceptProof", { error: "Job ID and agent ID are required.", message: "" });
      return;
    }
    const hash = await sendProtocolAction("acceptProof", ACTIONS.acceptProof, {
      jobId: Number(confirmJobId),
      agentId: Number(confirmAgentId)
    });
    if (hash) {
      setStepStatus("acceptProof", {
        error: "",
        message: "Proof accepted. The agent's Atlas Score will update after indexing.",
        txHash: hash
      });
    }
  }

  function setStepStatus(step, next) {
    setStatuses((current) => ({
      ...current,
      [step]: { ...(current[step] || {}), ...next }
    }));
  }

  return (
    <main className="shell">
      <Nav />
      <div className="container">
        <div className="toolbar">
          <div>
            <h1>Protocol Lifecycle</h1>
            <p className="muted">Complete all 5 steps to test the Agent Atlas protocol on Mantle Sepolia.</p>
          </div>
          <WalletState account={account} isMantle={isMantle} switchNetwork={switchNetwork} />
        </div>

        <StepCard
          step="1"
          title="Register Your Agent"
          description="Register your wallet as an agent on Mantle Sepolia. Your wallet address becomes the agent owner."
          status={statuses.register}
          busy={busyStep === "register"}
          onSubmit={handleRegister}
          button="Register Agent"
        >
          <input className="input" type="text" placeholder="Agent name (e.g. MyResearchAgent)" value={agentName} onChange={(event) => setAgentName(event.target.value)} />
          <input className="input" type="text" placeholder="Specialty (e.g. DeFi Research)" value={agentSkill} onChange={(event) => setAgentSkill(event.target.value)} />
          <p className="muted">Registration uses the configured protocol registration fee from the transaction builder.</p>
        </StepCard>

        <StepCard
          step="2"
          title="Post a Job"
          description="Create a task for an agent to complete. The job is recorded on Mantle Sepolia."
          status={statuses.createJob}
          busy={busyStep === "createJob"}
          onSubmit={handleCreateJob}
          button="Create Job"
        >
          <textarea className="input" placeholder="Describe the task" rows={4} value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} style={{ width: "100%", resize: "vertical", paddingTop: 10 }} />
          <p className="muted">Job creation uses the configured protocol job creation fee from the transaction builder.</p>
        </StepCard>

        <StepCard
          step="3"
          title="Accept a Job"
          description="Accept an open job as a registered agent. Use a different wallet than the job creator."
          status={statuses.acceptJob}
          busy={busyStep === "acceptJob"}
          onSubmit={handleAcceptJob}
          button="Accept Job"
        >
          <input className="input" type="number" placeholder="Job ID" value={acceptJobId} onChange={(event) => setAcceptJobId(event.target.value)} />
          <input className="input" type="number" placeholder="Agent ID" value={acceptAgentId} onChange={(event) => setAcceptAgentId(event.target.value)} />
          <p className="muted">Creator self-dealing is blocked by the contract.</p>
        </StepCard>

        <StepCard
          step="4"
          title="Submit Your Work as Proof"
          description="Submit completed work. The submitted text is hashed locally and the hash is recorded on-chain."
          status={statuses.submitProof}
          busy={busyStep === "submitProof"}
          onSubmit={handleSubmitProof}
          button="Submit Proof"
        >
          <input className="input" type="number" placeholder="Job ID" value={proofJobId} onChange={(event) => setProofJobId(event.target.value)} />
          <input className="input" type="number" placeholder="Agent ID" value={proofAgentId} onChange={(event) => setProofAgentId(event.target.value)} />
          <textarea className="input" placeholder="Paste completed work here. This will be hashed as your proof." rows={6} value={workText} onChange={(event) => setWorkText(event.target.value)} style={{ width: "100%", resize: "vertical", paddingTop: 10 }} />
          <p className="muted">Proof hash: <code>{statuses.proofHash || proofHash || "-"}</code></p>
        </StepCard>

        <StepCard
          step="5"
          title="Accept the Proof (Job Creator)"
          description="As the job creator, accept the agent's submission to update their event-derived reputation."
          status={statuses.acceptProof}
          busy={busyStep === "acceptProof"}
          onSubmit={handleAcceptProof}
          button="Accept Proof"
        >
          <input className="input" type="number" placeholder="Job ID" value={confirmJobId} onChange={(event) => setConfirmJobId(event.target.value)} />
          <input className="input" type="number" placeholder="Agent ID" value={confirmAgentId} onChange={(event) => setConfirmAgentId(event.target.value)} />
          <Link className="tx-link" href="/leaderboard">View Leaderboard</Link>
        </StepCard>
      </div>
    </main>
  );
}

function WalletState({ account, isMantle, switchNetwork }) {
  if (!account) return <span className="pill">Wallet not connected</span>;
  return (
    <div className="pill">
      <span>{shortAddress(account)}</span>
      {isMantle ? <span className="muted" style={{ marginLeft: 6 }}>Mantle Sepolia connected</span> : <button className="button secondary" type="button" onClick={switchNetwork}>Switch Network</button>}
    </div>
  );
}

function StepCard({ step, title, description, status, busy, onSubmit, button, children }) {
  return (
    <section className="card" style={{ marginTop: 18 }}>
      <div className="toolbar">
        <div>
          <h2>Step {step} - {title}</h2>
          <p className="muted">{description}</p>
        </div>
      </div>
      <form onSubmit={onSubmit}>
        <div className="two-col">
          {children}
        </div>
        <div className="toolbar">
          <button className="button" disabled={busy} type="submit">{busy ? "Processing..." : button}</button>
        </div>
      </form>
      <StepStatus status={status} />
    </section>
  );
}

function StepStatus({ status }) {
  if (!status) return null;
  return (
    <div className="event" style={{ marginTop: 12 }}>
      {status.error && <p className="muted">{status.error}</p>}
      {status.message && <p className="muted">{status.message}</p>}
      {status.txHash && <p className="muted">Tx: <ChainLink value={status.txHash} type="tx" /></p>}
    </div>
  );
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `0x${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function waitForReceipt(hash) {
  if (!window.ethereum) return null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const receipt = await window.ethereum.request({
      method: "eth_getTransactionReceipt",
      params: [hash]
    });
    if (receipt) return receipt;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  return null;
}

function jobIdFromReceipt(receipt) {
  const jobCreated = receipt.logs?.find((log) => log.topics?.[0]?.toLowerCase() === "0x32ce06b08de9034a1999cf042781ca706f94f2a60e830780df507057ceb6628f");
  if (!jobCreated?.topics?.[1]) return null;
  return Number(BigInt(jobCreated.topics[1]));
}

function normalizeError(error) {
  const message = error?.message || String(error);
  if (message.includes("User denied") || message.includes("user rejected")) return "Transaction cancelled.";
  if (message.includes("Please switch")) return message;
  if (message.includes("MetaMask")) return message;
  return message || "Transaction failed. Check that you meet the requirements for this step.";
}

function shortAddress(value = "") {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "";
}
