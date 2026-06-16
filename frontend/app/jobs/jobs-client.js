"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Play, Plus, Upload, XCircle } from "lucide-react";
import { api } from "../../lib/api";
import LivePanel from "../../components/LivePanel";
import { StatusBadge } from "../../components/StatusBadge";
import { SEED_JOBS } from "../../lib/seedData";
import {
  MANTLE_SEPOLIA_CHAIN,
  SUPPORTED_WALLETS,
  getPreferredProvider,
  getWalletLabel,
  requestWalletOnMantle
} from "../../lib/wallet";

export default function JobsClient({ initialJobs, agents }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [description, setDescription] = useState("");
  const [agentId, setAgentId] = useState(agents[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [optimisticEvents, setOptimisticEvents] = useState([]);
  const [sentTxHash, setSentTxHash] = useState(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletChainId, setWalletChainId] = useState("");
  const [walletProvider, setWalletProvider] = useState(null);
  const [walletName, setWalletName] = useState("");
  const [waitingForIndex, setWaitingForIndex] = useState(false);
  const [expandedOutput, setExpandedOutput] = useState(null);
  const [aiOutputs, setAiOutputs] = useState({});
  const [showGuide, setShowGuide] = useState(true);

  const selectedAgent = agents.find((agent) => Number(agent.id) === Number(agentId));
  const ownsSelectedAgent = !walletAddress || !selectedAgent?.owner || selectedAgent.owner.toLowerCase() === walletAddress.toLowerCase();
  const ownerActionDisabled = busy || !ownsSelectedAgent;
  const agentById = new Map(agents.map((agent) => [Number(agent.id), agent]));
  const isMantleSepolia = walletChainId && walletChainId.toLowerCase() === MANTLE_SEPOLIA_CHAIN.chainId.toLowerCase();

  useEffect(() => {
    const provider = getPreferredProvider();
    if (!provider) return;
    setWalletProvider(provider);
    setWalletName(getWalletLabel(provider));
    let mounted = true;

    async function hydrateWallet() {
      try {
        const accounts = await provider.request({ method: "eth_accounts" });
        const chainId = await provider.request({ method: "eth_chainId" });
        if (!mounted) return;
        if (accounts.length > 0) setWalletAddress(accounts[0]);
        setWalletChainId(chainId);
      } catch (error) {
        console.warn("Wallet state unavailable.", error);
      }
    }

    function handleAccountsChanged(accounts) {
      setWalletAddress(accounts.length > 0 ? accounts[0] : "");
    }

    function handleChainChanged() {
      window.location.reload();
    }

    hydrateWallet();
    provider.on?.("accountsChanged", handleAccountsChanged);
    provider.on?.("chainChanged", handleChainChanged);

    return () => {
      mounted = false;
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
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
    setOptimisticEvents((items) => [{ type, text }, ...items].slice(0, 8));
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

  async function fetchAiOutput(jobId) {
    if (aiOutputs[jobId]) {
      setExpandedOutput(expandedOutput === jobId ? null : jobId);
      return;
    }
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://agent-atlas.up.railway.app"}/outputs/${jobId}`);
      if (!res.ok) {
        addEvent("No AI Output", `Job #${jobId} has no stored AI output yet`);
        return;
      }
      const data = await res.json();
      setAiOutputs((current) => ({ ...current, [jobId]: data }));
      setExpandedOutput(jobId);
    } catch (error) {
      addEvent("Fetch Failed", error.message);
    }
  }

  async function sendTransaction(action, params) {
    const provider = walletProvider || getPreferredProvider();
    if (!provider) {
      addEvent("Wallet Required", `Install ${SUPPORTED_WALLETS} to interact with Mantle Sepolia`);
      return;
    }
    setBusy(true);
    try {
      addEvent("Connecting Wallet", "Switching to Mantle Sepolia...");
      const { from, chainId, provider: connectedProvider } = await requestWalletOnMantle(provider);
      setWalletAddress(from);
      setWalletChainId(chainId);
      setWalletProvider(connectedProvider);
      setWalletName(getWalletLabel(connectedProvider));

      addEvent("Building Transaction", `Preparing ${action}...`);
      const res = await api("/protocol/v1/transactions", {
        method: "POST",
        body: JSON.stringify({ action, params })
      });
      if (!res?.transaction) throw new Error("Backend did not return a transaction");

      addEvent("Confirm in Wallet", "Wallet confirmation opening - please approve the transaction");
      const txHash = await connectedProvider.request({
        method: "eth_sendTransaction",
        params: [{ from, ...res.transaction }]
      });

      setSentTxHash(txHash);
      setWaitingForIndex(true);
      addEvent("Transaction Submitted", txHash);
      await pollForIndexedChange(txHash);
    } catch (error) {
      const msg = error?.message || "Wallet rejected or network error";
      if (msg.includes("User denied") || msg.includes("user rejected")) {
        addEvent("Rejected", "You cancelled the transaction in your wallet");
      } else {
        addEvent("Transaction Failed", msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function createJob() {
    if (!description.trim()) {
      addEvent("Input Required", "Please enter a job description before submitting");
      return;
    }
    if (description.trim().length < 10) {
      addEvent("Description Too Short", "Please enter a more detailed job description (at least 10 characters)");
      return;
    }
    await sendTransaction("createJob", { description: description.trim(), reward: 100 });
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
    const job = jobs.find((item) => item.id === jobId);
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
    const job = jobs.find((item) => item.id === jobId);
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
    const job = jobs.find((item) => item.id === jobId);
    if (!isJobCreator(job)) {
      walletMismatch(`Creator for job ${jobId}`, job?.creator);
      return;
    }
    const reasonHash = await sha256Hex(`failed:${jobId}:${Date.now()}`);
    await sendTransaction("markJobFailed", { jobId, agentId: job.assignedAgentId, reasonHash });
  }

  async function connectWallet() {
    const provider = getPreferredProvider();
    if (!provider) {
      addEvent("Wallet Missing", `Install ${SUPPORTED_WALLETS} to connect`);
      return;
    }
    try {
      const { from, chainId, provider: connectedProvider } = await requestWalletOnMantle(provider);
      setWalletAddress(from);
      setWalletChainId(chainId);
      setWalletProvider(connectedProvider);
      setWalletName(getWalletLabel(connectedProvider));
      addEvent("Wallet Connected", `${getWalletLabel(connectedProvider)} ${shortAddress(from)} on Mantle Sepolia`);
    } catch (error) {
      addEvent("Connection Failed", error?.message || "Wallet rejected");
    }
  }

  async function addMantleSepoliaToWallet() {
    const provider = walletProvider || getPreferredProvider();
    if (!provider) return;
    try {
      await provider.request({ method: "wallet_addEthereumChain", params: [MANTLE_SEPOLIA_CHAIN] });
      const chainId = await provider.request({ method: "eth_chainId" });
      setWalletChainId(chainId);
      addEvent("Network Added", `Mantle Sepolia added to ${getWalletLabel(provider)}`);
    } catch (error) {
      addEvent("Network Add Failed", error?.message || "Wallet rejected");
    }
  }

  async function pollForIndexedChange(txHash) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      try {
        const nextJobs = await api("/jobs");
        setJobs(nextJobs);
        if (JSON.stringify(nextJobs).includes(txHash)) {
          setWaitingForIndex(false);
          addEvent("Indexed on Chain", "Transaction confirmed and indexed - leaderboard updated");
          return;
        }
      } catch {
        // keep polling
      }
    }
    setWaitingForIndex(false);
    addEvent("Indexing Pending", "Transaction submitted. Indexer will confirm shortly - refresh the page in 30s");
  }

  return (
    <div>
      {showGuide && (
        <div style={{
          background: "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(45,212,191,0.08) 100%)",
          border: "1px solid rgba(124,58,237,0.3)",
          borderRadius: "14px",
          padding: "24px",
          marginBottom: "28px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.1rem" }}>How the Job Board Works</h2>
              <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                4 steps to record creator-accepted AI agent work on Mantle Sepolia
              </p>
            </div>
            <button onClick={() => setShowGuide(false)} style={{
              background: "none", border: "none", color: "var(--text-muted)",
              cursor: "pointer", fontSize: "20px", padding: "0 4px", lineHeight: 1
            }}>x</button>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "12px"
          }}>
            {[
              ["1", "Create a Job", "You are the job creator. Type a task description, click Create Proof Task, and sign in your wallet. Costs 0.005 MNT.", "Your wallet = Job Creator"],
              ["2", "Agent Accepts", "An agent owner selects their agent from the dropdown and assigns it to an open job. Must be a different wallet.", "Different wallet = Agent Owner"],
              ["3", "Submit Proof", "The agent owner submits proof. This records a hash of the completed work on-chain.", "Agent owner wallet signs"],
              ["4", "Accept & Score", "The job creator accepts the submission. The agent earns Atlas Score reputation from that event.", "Job creator wallet signs"]
            ].map(([n, title, desc, tag]) => (
              <div key={n} style={{
                background: "rgba(0,0,0,0.25)",
                borderRadius: "10px",
                padding: "14px",
                border: "1px solid rgba(255,255,255,0.06)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <div style={{
                    width: "26px", height: "26px", borderRadius: "50%",
                    background: "var(--purple-primary)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.75rem", fontWeight: 800, flexShrink: 0
                  }}>{n}</div>
                  <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{title}</span>
                </div>
                <p style={{ margin: "0 0 8px", fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{desc}</p>
                <span style={{
                  display: "inline-block",
                  background: "rgba(124,58,237,0.2)",
                  color: "var(--purple-light)",
                  borderRadius: "4px",
                  padding: "2px 8px",
                  fontSize: "0.7rem",
                  fontWeight: 600
                }}>{tag}</span>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: "16px",
            padding: "10px 14px",
            background: "rgba(0,0,0,0.2)",
            borderRadius: "8px",
            fontSize: "0.78rem",
            color: "var(--text-muted)",
            display: "flex",
            flexWrap: "wrap",
            gap: "16px"
          }}>
            <span>Need Mantle Sepolia MNT? <a href="https://faucet.sepolia.mantle.xyz" target="_blank" rel="noopener noreferrer" style={{ color: "var(--purple-light)" }}>Get free testnet tokens</a></span>
            <span>Need a wallet? <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--purple-light)" }}>Install MetaMask</a></span>
            <span>Chain ID: 5003 - Network: Mantle Sepolia</span>
          </div>
        </div>
      )}

      <div className="job-setup-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Step 1: Create a Job</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "16px" }}>
            Describe what you want an AI agent to do. Be specific - the agent will execute this task and submit a proof hash for creator acceptance.
          </p>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>Task Description *</label>
          <textarea
            className="input"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="e.g. Analyze the top 5 DeFi protocols on Mantle Sepolia and produce a structured risk assessment with findings and recommendations..."
            rows={4}
            style={{ resize: "vertical", width: "100%", fontFamily: "inherit", boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", flexWrap: "wrap", gap: "8px" }}>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              <strong>0.005 MNT</strong> job creation fee
              {description.length > 0 && (
                <span style={{ marginLeft: "8px", color: description.length >= 10 ? "var(--green-verified)" : "var(--text-muted)" }}>
                  {description.length} chars {description.length < 10 ? "(min 10)" : "OK"}
                </span>
              )}
            </div>
            <button className="button" type="button" disabled={busy || description.trim().length < 10} onClick={createJob} style={{ minWidth: "160px" }}>
              {busy ? "Processing..." : <><Plus size={16} /> Create Proof Task</>}
            </button>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Step 2: Agent Setup</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "16px" }}>
            Select an agent and connect the agent owner's wallet to accept jobs and submit proof.
          </p>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>Select Agent</label>
          <select className="select" value={agentId} onChange={(event) => setAgentId(event.target.value)} style={{ width: "100%", marginBottom: "10px" }}>
            {agents.map((agent) => (
              <option value={agent.id} key={agent.id}>{agent.name} (ID: #{agent.id})</option>
            ))}
          </select>

          {selectedAgent && (
            <div style={{
              background: "rgba(124,58,237,0.08)",
              border: "1px solid rgba(124,58,237,0.2)",
              borderRadius: "8px",
              padding: "10px 12px",
              fontSize: "0.78rem",
              marginBottom: "12px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ color: "var(--purple-light)", fontWeight: 700 }}>{selectedAgent.name}</span>
                <span style={{ color: "var(--text-muted)" }}>Agent ID: #{selectedAgent.id}</span>
              </div>
              <div style={{ color: "var(--text-muted)", marginBottom: "4px" }}>
                Owner: <code style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  {selectedAgent.owner ? `${selectedAgent.owner.slice(0, 8)}...${selectedAgent.owner.slice(-6)}` : "Unknown"}
                </code>
              </div>
              {selectedAgent.skills?.length > 0 && (
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "4px" }}>
                  {selectedAgent.skills.map((skillName) => (
                    <span key={skillName} style={{
                      background: "rgba(124,58,237,0.15)",
                      color: "var(--purple-light)",
                      borderRadius: "4px",
                      padding: "1px 6px",
                      fontSize: "0.7rem"
                    }}>{skillName}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {!walletAddress ? (
            <button className="button" style={{ width: "100%" }} onClick={connectWallet}>Connect EVM Wallet</button>
          ) : (
            <div style={{
              background: "rgba(74,222,128,0.08)",
              border: "1px solid rgba(74,222,128,0.2)",
              borderRadius: "8px",
              padding: "10px 12px",
              fontSize: "0.8rem"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--green-verified)", fontWeight: 600 }}>Wallet Connected</span>
                {isMantleSepolia
                  ? <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>Mantle Sepolia OK</span>
                  : <button className="button secondary" style={{ fontSize: "0.75rem", padding: "4px 10px" }} onClick={addMantleSepoliaToWallet}>Switch Network</button>
                }
              </div>
              <code style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "4px", display: "block" }}>
                {walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}
              </code>
              {walletName && <div style={{ marginTop: "4px", color: "var(--text-muted)", fontSize: "0.75rem" }}>{walletName}</div>}
              {selectedAgent?.owner && !ownsSelectedAgent && (
                <div style={{ marginTop: "8px", color: "#f97316", fontSize: "0.75rem" }}>
                  Wrong wallet. This agent requires owner wallet: <code>{selectedAgent.owner.slice(0, 8)}...{selectedAgent.owner.slice(-6)}</code>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
          <h2 style={{ margin: 0 }}>Submission Queue ({jobs.length} jobs)</h2>
          <button className="button secondary" style={{ fontSize: "0.8rem", padding: "6px 12px" }} onClick={refreshJobs} disabled={busy}>Refresh</button>
        </div>

        {waitingForIndex && (
          <div style={{
            padding: "12px 16px",
            background: "rgba(124,58,237,0.1)",
            border: "1px solid rgba(124,58,237,0.3)",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "0.85rem",
            color: "var(--purple-light)"
          }}>
            Waiting for indexer confirmation (~30 seconds)...
          </div>
        )}

        {optimisticEvents.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
            {optimisticEvents.map((event, index) => (
              <div key={`${event.type}-${index}`} style={{
                padding: "10px 14px",
                background: "var(--bg-primary)",
                borderRadius: "8px",
                border: "1px solid var(--border-color)",
                opacity: index === 0 ? 1 : 0.55
              }}>
                <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}>{event.type}</div>
                <div style={{
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                  fontFamily: event.text?.startsWith("0x") ? "monospace" : "inherit",
                  wordBreak: "break-all",
                  marginTop: "2px"
                }}>
                  {event.text?.startsWith("0x") ? (
                    <a href={`https://sepolia.mantlescan.xyz/tx/${event.text}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--purple-light)", textDecoration: "none" }}>
                      {event.text.slice(0, 18)}...{event.text.slice(-6)}
                    </a>
                  ) : event.text}
                </div>
              </div>
            ))}
          </div>
        )}

        {jobs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>--</div>
            <p style={{ color: "var(--text-secondary)", marginBottom: "8px" }}>No jobs yet</p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Create the first job above to get started</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {jobs.map((job) => {
              const assignedAgent = job.assignedAgentId ? agentById.get(Number(job.assignedAgentId)) : null;
              return (
                <div key={job.id} style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "10px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                        <span style={{
                          background: "rgba(124,58,237,0.15)",
                          color: "var(--purple-light)",
                          borderRadius: "6px",
                          padding: "2px 8px",
                          fontSize: "0.75rem",
                          fontWeight: 700
                        }}>Job #{job.id}</span>
                        <StatusBadge status={job.status} />
                        {assignedAgent && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{assignedAgent.name} (Agent #{job.assignedAgentId})</span>}
                      </div>
                      <p style={{ margin: 0, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.4 }}>{job.description}</p>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    <span>Created: {job.createdAt || "Unknown"}</span>
                    {job.completedAt && <span>Completed: {job.completedAt}</span>}
                    {job.proof?.transactionUrl && (
                      <a href={job.proof.transactionUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--purple-light)", textDecoration: "none" }}>
                        View proof hash on Mantlescan
                      </a>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", borderTop: "1px solid var(--border-color)", paddingTop: "10px" }}>
                    {job.status === "OPEN" && (
                      <button className="button secondary" disabled={ownerActionDisabled} onClick={() => acceptJob(job.id)} title={ownsSelectedAgent ? `Assign ${selectedAgent?.name} to this job` : "Connect the agent owner wallet first"} style={{ fontSize: "0.85rem" }}>
                        <Play size={15} /> Assign {selectedAgent?.name || "Agent"}
                      </button>
                    )}

                    {job.status === "ASSIGNED" && (
                      <>
                        {!job.hasSubmittedProof && (
                          <button className="button" disabled={busy || !ownsAgent(job.assignedAgentId)} onClick={() => submitProof(job.id)} title={ownsAgent(job.assignedAgentId) ? "Submit proof as agent owner" : `Connect owner wallet of ${assignedAgent?.name}`} style={{ fontSize: "0.85rem" }}>
                            <Upload size={15} /> Submit Proof
                          </button>
                        )}
                        {job.hasSubmittedProof && (
                          <button className="button" disabled={busy || !isJobCreator(job)} onClick={() => acceptProof(job.id)} title={isJobCreator(job) ? "Accept submission as job creator" : "Connect the job creator wallet"} style={{ fontSize: "0.85rem", background: "rgba(74,222,128,0.15)", borderColor: "rgba(74,222,128,0.4)", color: "var(--green-verified)" }}>
                            <CheckCircle size={15} /> Accept Submission
                          </button>
                        )}
                        {!job.hasSubmittedProof && <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", alignSelf: "center" }}>Awaiting proof from {assignedAgent?.name || "agent"}</span>}
                        {job.hasSubmittedProof && (
                          <button className="button secondary" disabled={busy || !isJobCreator(job)} onClick={() => markFailed(job.id)} title="Mark as failed if the submitted work is unsatisfactory" style={{ fontSize: "0.85rem", color: "#f87171" }}>
                            <XCircle size={15} /> Mark Failed
                          </button>
                        )}
                      </>
                    )}

                    {job.status === "COMPLETED" && <span style={{ fontSize: "0.85rem", color: "var(--green-verified)", display: "flex", alignItems: "center", gap: "6px" }}><CheckCircle size={16} /> Accepted on Mantle</span>}
                    {job.status === "FAILED" && <span style={{ fontSize: "0.85rem", color: "#f87171", display: "flex", alignItems: "center", gap: "6px" }}><XCircle size={16} /> Marked Failed</span>}
                    {job.status === "COMPLETED" && (
                      <button onClick={() => fetchAiOutput(job.id)} style={{
                        background: "none",
                        border: "none",
                        color: "var(--purple-light)",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        padding: "4px 0",
                        textDecoration: "underline"
                      }}>
                        {expandedOutput === job.id ? "Hide AI Output" : "View AI Output"}
                      </button>
                    )}
                  </div>

                  {expandedOutput === job.id && aiOutputs[job.id] && (
                    <div style={{
                      background: "var(--bg-primary)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      padding: "16px",
                      fontSize: "0.8rem"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                        <span style={{ color: "var(--purple-light)", fontWeight: 600 }}>{aiOutputs[job.id].agentName} - {aiOutputs[job.id].model}</span>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                          {aiOutputs[job.id].outputLength?.toLocaleString()} chars{" "}
                          <a href={`https://sepolia.mantlescan.xyz/tx/${aiOutputs[job.id].acceptTx}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--purple-light)" }}>
                            Accepted submission on Mantle
                          </a>
                        </span>
                      </div>
                      <div style={{
                        whiteSpace: "pre-wrap",
                        color: "var(--text-secondary)",
                        lineHeight: 1.6,
                        maxHeight: "400px",
                        overflowY: "auto",
                        fontFamily: "inherit"
                      }}>
                        {aiOutputs[job.id].aiOutput}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <LivePanel />
      </div>
    </div>
  );
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `0x${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function shortAddress(value = "") {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "";
}
