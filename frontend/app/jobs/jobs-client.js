"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Play, Plus, Upload, XCircle } from "lucide-react";
import { api } from "../../lib/api";
import { ChainLink } from "../../components/ChainLink";
import LivePanel from "../../components/LivePanel";
import { StatusBadge } from "../../components/StatusBadge";
import { SEED_JOBS } from "../../lib/seedData";

const MANTLE_SEPOLIA_CHAIN = {
  chainId: "0x138B",
  chainName: "Mantle Sepolia",
  nativeCurrency: { name: "MNT", symbol: "MNT", decimals: 18 },
  rpcUrls: ["https://rpc.sepolia.mantle.xyz"],
  blockExplorerUrls: ["https://sepolia.mantlescan.xyz"]
};

export default function JobsClient({ initialJobs, agents }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState(100);
  const [agentId, setAgentId] = useState(agents[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [optimisticEvents, setOptimisticEvents] = useState([]);
  const [sentTxHash, setSentTxHash] = useState(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletChainId, setWalletChainId] = useState("");
  const [waitingForIndex, setWaitingForIndex] = useState(false);

  const selectedAgent = agents.find((a) => Number(a.id) === Number(agentId));
  const ownsSelectedAgent = !walletAddress || !selectedAgent?.owner || selectedAgent.owner.toLowerCase() === walletAddress.toLowerCase();
  const ownerActionDisabled = busy || !ownsSelectedAgent;
  const agentById = new Map(agents.map((a) => [Number(a.id), a]));
  const isMantleSepolia = walletChainId && walletChainId.toLowerCase() === MANTLE_SEPOLIA_CHAIN.chainId.toLowerCase();

  useEffect(() => {
    if (!window.ethereum) return;
    let mounted = true;
    async function hydrateWallet() {
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        const chainId = await window.ethereum.request({ method: "eth_chainId" });
        if (!mounted) return;
        if (accounts.length > 0) setWalletAddress(accounts[0]);
        setWalletChainId(chainId);
      } catch (e) {
        console.warn("Wallet state unavailable.", e);
      }
    }
    function handleAccountsChanged(accounts) {
      setWalletAddress(accounts.length > 0 ? accounts[0] : "");
    }
    function handleChainChanged() { window.location.reload(); }
    hydrateWallet();
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
    return () => {
      mounted = false;
      window.ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  function ownsAgent(agentIdValue) {
    const agent = agentById.get(Number(agentIdValue));
    return !walletAddress || !agent?.owner || agent.owner.toLowerCase() === walletAddress.toLowerCase();
  }

  function isJobCreator(job) {
    return !walletAddress || !job?.creator || job.creator.toLowerCase() === walletAddress.toLowerCase();
  }

  function addEvent(type, text) {
    setOptimisticEvents(items => [{ type, text }, ...items].slice(0, 8));
  }

  function walletMismatch(kind, expected) {
    addEvent("Wrong Wallet", `${kind} wallet required. Connected: ${shortAddress(walletAddress)}. Expected: ${shortAddress(expected)}.`);
  }

  async function refreshJobs() {
    try {
      setJobs(await api("/jobs"));
    } catch {
      setJobs(await api("/jobs", { fallback: SEED_JOBS }));
    }
  }

  // ONE-CLICK transaction sender - connects wallet, builds tx, sends to MetaMask in one flow
  async function sendTransaction(action, params) {
    if (!window.ethereum) {
      addEvent("Wallet Required", "Install MetaMask to interact with Mantle Sepolia");
      window.open("https://metamask.io/download/", "_blank", "noopener");
      return;
    }
    setBusy(true);
    try {
      // 1. Connect + switch network
      addEvent("Connecting Wallet", "Switching to Mantle Sepolia...");
      const { from, chainId } = await requestWalletOnMantle();
      setWalletAddress(from);
      setWalletChainId(chainId);

      // 2. Build transaction from backend
      addEvent("Building Transaction", `Preparing ${action}...`);
      const res = await api("/protocol/v1/transactions", {
        method: "POST",
        body: JSON.stringify({ action, params })
      });
      if (!res?.transaction) throw new Error("Backend did not return a transaction");
      const tx = res.transaction;

      // 3. Send to MetaMask - wallet popup appears here
      addEvent("Sign in MetaMask", "MetaMask popup opening - please confirm the transaction");
      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from, ...tx }]
      });

      // 4. Confirmed - poll indexer
      setSentTxHash(txHash);
      setWaitingForIndex(true);
      addEvent("Transaction Submitted", txHash);
      await pollForIndexedChange(txHash);
    } catch (err) {
      const msg = err?.message || "MetaMask rejected or network error";
      if (msg.includes("User denied") || msg.includes("user rejected")) {
        addEvent("Rejected", "You cancelled the transaction in MetaMask");
      } else {
        addEvent("Transaction Failed", msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function createJob(event) {
    event.preventDefault();
    if (!description.trim()) {
      addEvent("Input Required", "Please enter a job description before submitting");
      return;
    }
    if (description.trim().length < 10) {
      addEvent("Description Too Short", "Please enter a more detailed job description (at least 10 characters)");
      return;
    }
    await sendTransaction("createJob", { description: description.trim(), reward: Number(reward) });
    setDescription("");
  }

  async function acceptJob(jobId) {
    if (!ownsSelectedAgent) {
      walletMismatch("Agent owner", selectedAgent?.owner);
      return;
    }
    await sendTransaction("acceptJob", { jobId, agentId: Number(agentId) });
  }

  async function submitProof(jobId) {
    const job = jobs.find(item => item.id === jobId);
    if (!ownsAgent(job?.assignedAgentId)) {
      const assignedAgent = agentById.get(Number(job?.assignedAgentId));
      walletMismatch(`Agent owner for ${assignedAgent?.name || "the assigned agent"}`, assignedAgent?.owner);
      return;
    }
    const result = `completed:${jobId}:${Date.now()}`;
    const resultHash = await sha256Hex(result);
    await sendTransaction("submitProof", { jobId, agentId: job.assignedAgentId, resultHash });
  }

  async function acceptProof(jobId) {
    const job = jobs.find(item => item.id === jobId);
    if (!isJobCreator(job)) {
      walletMismatch(`Creator for job ${jobId}`, job?.creator);
      return;
    }
    if (!job?.hasSubmittedProof) {
      addEvent("Proof Required", `Agent must submit proof for job ${jobId} before you can accept it`);
      return;
    }
    await sendTransaction("acceptProof", { jobId, agentId: job.assignedAgentId });
  }

  async function markFailed(jobId) {
    const job = jobs.find(item => item.id === jobId);
    if (!isJobCreator(job)) {
      walletMismatch(`Creator for job ${jobId}`, job?.creator);
      return;
    }
    const reasonHash = await sha256Hex(`failed:${jobId}:${Date.now()}`);
    await sendTransaction("markJobFailed", { jobId, agentId: job.assignedAgentId, reasonHash });
  }

  async function connectWallet() {
    if (!window.ethereum) {
      addEvent("Wallet Missing", "Install MetaMask to connect");
      window.open("https://metamask.io/download/", "_blank", "noopener");
      return;
    }
    try {
      const { from, chainId } = await requestWalletOnMantle();
      setWalletAddress(from);
      setWalletChainId(chainId);
      addEvent("Wallet Connected", `${shortAddress(from)} on Mantle Sepolia`);
    } catch (err) {
      addEvent("Connection Failed", err?.message || "MetaMask rejected");
    }
  }

  async function addMantleSepoliaToWallet() {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({ method: "wallet_addEthereumChain", params: [MANTLE_SEPOLIA_CHAIN] });
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      setWalletChainId(chainId);
      addEvent("Network Added", "Mantle Sepolia added to MetaMask");
    } catch (err) {
      addEvent("Network Add Failed", err?.message || "MetaMask rejected");
    }
  }

  async function pollForIndexedChange(txHash) {
    for (let attempt = 0; attempt < 12; attempt++) {
      await new Promise(r => setTimeout(r, 2500));
      try {
        const nextJobs = await api("/jobs");
        setJobs(nextJobs);
        if (JSON.stringify(nextJobs).includes(txHash)) {
          setWaitingForIndex(false);
          addEvent("Indexed on Chain", "Transaction confirmed and indexed - leaderboard updated");
          return;
        }
      } catch { /* keep polling */ }
    }
    setWaitingForIndex(false);
    addEvent("Indexing Pending", "Transaction submitted. Indexer will confirm shortly - refresh the page in 30s");
  }

  return (
    <div className="two-col">
      <section>
        {/* Create Job Form */}
        <form className="card" onSubmit={createJob}>
          <h2>Request Accepted Submission</h2>
          <p className="muted" style={{ marginBottom: "14px", fontSize: "0.875rem" }}>
            Describe a task for an AI agent. The agent executes it, submits cryptographic proof, and you verify on-chain.
          </p>
          <textarea
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Analyze the top DeFi protocols on Mantle Sepolia and produce a risk assessment report with findings..."
            required
            rows={3}
            style={{ resize: "vertical", minHeight: "80px", width: "100%", fontFamily: "inherit", boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px", flexWrap: "wrap", gap: "10px" }}>
            <p className="muted" style={{ fontSize: "0.8rem", margin: 0 }}>
              Creating a job costs <strong>0.005 MNT</strong> (Mantle Sepolia testnet)
            </p>
            <button className="button" disabled={busy || !description.trim()} type="submit" style={{ minWidth: "160px" }}>
              {busy ? "Processing..." : <><Plus size={18} /> Create Proof Task</>}
            </button>
          </div>
        </form>

        {/* Verification Queue */}
        <section className="card" style={{ marginTop: 18 }}>
          <h2>Verification Queue</h2>
          <div className="toolbar">
            <select className="select" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              {agents.map(agent => <option value={agent.id} key={agent.id}>{agent.name}</option>)}
            </select>
            {walletAddress ? (
              <div className="pill">
                <span className="status COMPLETED">{shortAddress(walletAddress)}</span>
                {isMantleSepolia && <span className="muted" style={{ marginLeft: 6 }}>Mantle Sepolia connected</span>}
              </div>
            ) : (
              <button className="button secondary" type="button" disabled={busy} onClick={connectWallet}>
                Connect Wallet
              </button>
            )}
            {walletAddress && !isMantleSepolia && (
              <button className="button secondary" type="button" disabled={busy} onClick={addMantleSepoliaToWallet}>
                + Add Mantle Sepolia
              </button>
            )}
          </div>

          {!walletAddress && (
            <div style={{ padding: "16px", background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "10px", margin: "12px 0", textAlign: "center" }}>
              <p style={{ color: "var(--text-secondary)", marginBottom: "10px", fontSize: "0.875rem" }}>
                Connect MetaMask to assign agents, submit proofs, and verify work on Mantle Sepolia.
              </p>
              <button className="button" onClick={connectWallet}>Connect MetaMask</button>
            </div>
          )}

          {walletAddress && selectedAgent?.owner && !ownsSelectedAgent && (
            <p className="muted" style={{ fontSize: "0.8rem", padding: "8px 0" }}>
              Owner wallet required for <strong>{selectedAgent.name}</strong>. Connected: <ChainLink value={walletAddress} type="address" />. Owner: <ChainLink value={selectedAgent.owner} type="address" />.
            </p>
          )}

          {waitingForIndex && (
            <div style={{ padding: "10px 14px", background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: "8px", margin: "8px 0", fontSize: "0.875rem", color: "var(--purple-light)" }}>
              Waiting for indexer confirmation (~30 seconds)...
            </div>
          )}

          <table className="table">
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan="3">
                    <div style={{ padding: 24, textAlign: "center" }}>
                      <p style={{ color: "#0f8f68", marginBottom: 8 }}>No jobs yet</p>
                      <p className="muted">Create the first job above to get started.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                jobs.map(job => (
                  <tr key={job.id}>
                    <td>
                      <strong>#{job.id} {job.description}</strong>
                      <div className="muted" style={{ fontSize: "0.8rem", marginTop: 2 }}>
                        {job.reward > 0 ? `${job.reward} MNT reward` : "Testnet job"}
                        {job.proof?.transactionUrl && (
                          <> · <a href={job.proof.transactionUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--purple-light)" }}>View proof →</a></>
                        )}
                      </div>
                    </td>
                    <td><StatusBadge status={job.status} /></td>
                    <td>
                      {job.status === "OPEN" && (
                        <button className="button secondary" disabled={ownerActionDisabled} onClick={() => acceptJob(job.id)}>
                          <Play size={16} /> Assign Agent
                        </button>
                      )}
                      {job.status === "ASSIGNED" && (
                        <div className="toolbar" style={{ gap: 6 }}>
                          <button className="button success" disabled={busy || !ownsAgent(job.assignedAgentId)} onClick={() => submitProof(job.id)}>
                            <Upload size={16} /> Submit Proof
                          </button>
                          {job.hasSubmittedProof ? (
                            <button className="button success" disabled={busy || !isJobCreator(job)} onClick={() => acceptProof(job.id)}>
                              <CheckCircle size={16} /> Accept
                            </button>
                          ) : (
                            <span className="muted" style={{ fontSize: "0.8rem" }}>Awaiting proof</span>
                          )}
                          <button className="button secondary" disabled={busy || !job.hasSubmittedProof || !isJobCreator(job)} onClick={() => markFailed(job.id)}>
                            <XCircle size={16} />
                          </button>
                        </div>
                      )}
                      {job.status === "COMPLETED" && <CheckCircle color="#0f8f68" size={20} />}
                      {job.status === "FAILED" && <XCircle color="#b42318" size={20} />}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </section>

      {/* Right column */}
      <section>
        {/* Submission Progress */}
        {optimisticEvents.length > 0 && (
          <div className="card" style={{ marginBottom: 18 }}>
            <h2>Submission Progress</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {optimisticEvents.map((event, index) => (
                <div key={`${event.type}-${index}`} style={{
                  display: "flex", alignItems: "flex-start", gap: "10px",
                  padding: "10px 14px",
                  background: "var(--bg-primary)",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  opacity: index === 0 ? 1 : 0.55
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}>
                      {event.type}
                    </div>
                    <div style={{
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                      fontFamily: event.text?.startsWith("0x") ? "monospace" : "inherit",
                      wordBreak: "break-all",
                      marginTop: "2px"
                    }}>
                      {event.text?.startsWith("0x") ? (
                        <a href={`https://sepolia.mantlescan.xyz/tx/${event.text}`} target="_blank" rel="noopener noreferrer"
                          style={{ color: "var(--purple-light)", textDecoration: "none" }}>
                          {event.text.slice(0, 18)}...{event.text.slice(-6)} →
                        </a>
                      ) : event.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <LivePanel />
      </section>
    </div>
  );
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `0x${Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("")}`;
}

function shortAddress(value = "") {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "";
}

async function requestWalletOnMantle() {
  const [from] = await window.ethereum.request({ method: "eth_requestAccounts" });
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: MANTLE_SEPOLIA_CHAIN.chainId }]
    });
  } catch (switchError) {
    if (switchError?.code === 4902) {
      await window.ethereum.request({ method: "wallet_addEthereumChain", params: [MANTLE_SEPOLIA_CHAIN] });
    } else {
      throw switchError;
    }
  }
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  if (chainId.toLowerCase() !== MANTLE_SEPOLIA_CHAIN.chainId.toLowerCase()) {
    throw new Error("Wallet is not connected to Mantle Sepolia");
  }
  return { from, chainId };
}
