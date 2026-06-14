"use client";

import { useState } from "react";
import { CheckCircle, Play, Plus, Upload, XCircle } from "lucide-react";
import { api } from "../../lib/api";
import LivePanel from "../../components/LivePanel";
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
  const [preparedTx, setPreparedTx] = useState(null);
  const [sentTxHash, setSentTxHash] = useState(null);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletChainId, setWalletChainId] = useState("");
  const [waitingForIndex, setWaitingForIndex] = useState(false);

  const selectedAgent = agents.find((agent) => Number(agent.id) === Number(agentId));
  const ownsSelectedAgent = !walletAddress || !selectedAgent?.owner || selectedAgent.owner.toLowerCase() === walletAddress.toLowerCase();
  const ownerActionDisabled = busy || !ownsSelectedAgent;
  const agentById = new Map(agents.map((agent) => [Number(agent.id), agent]));

  function ownsAgent(agentIdValue) {
    const agent = agentById.get(Number(agentIdValue));
    return !walletAddress || !agent?.owner || agent.owner.toLowerCase() === walletAddress.toLowerCase();
  }

  function walletMismatch(kind, expected) {
    setOptimisticEvents((items) => [{
      type: "Wrong Wallet Connected",
      text: `${kind} wallet required. Connected: ${shortAddress(walletAddress)}. Expected: ${shortAddress(expected)}.`
    }, ...items].slice(0, 5));
  }

  function isJobCreator(job) {
    return !walletAddress || !job?.creator || job.creator.toLowerCase() === walletAddress.toLowerCase();
  }

  async function refreshJobs() {
    try {
      setJobs(await api("/jobs"));
    } catch (error) {
      console.warn("Jobs refresh unavailable; using seed jobs.", error);
      setJobs(SEED_JOBS);
    }
  }

  async function createJob(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const tx = await api("/protocol/v1/transactions", {
        method: "POST",
        body: JSON.stringify({ action: "createJob", params: { description, reward } })
      });
      setPreparedTx(tx.transaction);
      setOptimisticEvents((items) => [{ type: "Transaction Prepared", text: "Sign createJob with caller wallet" }, ...items].slice(0, 5));
      setDescription("");
    } finally {
      setBusy(false);
    }
  }

  async function acceptJob(jobId) {
    if (!ownsSelectedAgent) {
      walletMismatch("Agent owner", selectedAgent?.owner);
      return;
    }
    setBusy(true);
    try {
      const tx = await api("/protocol/v1/transactions", {
        method: "POST",
        body: JSON.stringify({ action: "acceptJob", params: { jobId, agentId: Number(agentId) } })
      });
      setPreparedTx(tx.transaction);
      setOptimisticEvents((items) => [{ type: "Transaction Prepared", text: `Sign acceptJob for job ${jobId}` }, ...items].slice(0, 5));
    } finally {
      setBusy(false);
    }
  }

  async function submitProof(jobId) {
    const job = jobs.find((item) => item.id === jobId);
    if (!ownsAgent(job?.assignedAgentId)) {
      const assignedAgent = agentById.get(Number(job?.assignedAgentId));
      walletMismatch(`Agent owner for ${assignedAgent?.name || "the assigned agent"}`, assignedAgent?.owner);
      return;
    }
    setBusy(true);
    try {
      const result = `completed:${jobId}:${Date.now()}`;
      const resultHash = await sha256Hex(result);
      const tx = await api("/protocol/v1/transactions", {
        method: "POST",
        body: JSON.stringify({ action: "submitProof", params: { jobId, agentId: job.assignedAgentId, resultHash } })
      });
      setPreparedTx(tx.transaction);
      setOptimisticEvents((items) => [{ type: "Transaction Prepared", text: `Sign submitProof for job ${jobId}` }, ...items].slice(0, 5));
    } finally {
      setBusy(false);
    }
  }

  async function acceptProof(jobId) {
    setBusy(true);
    try {
      const job = jobs.find((item) => item.id === jobId);
      if (!isJobCreator(job)) {
        walletMismatch(`Creator for job ${jobId}`, job?.creator);
        return;
      }
      if (!job?.hasSubmittedProof) {
        setOptimisticEvents((items) => [{ type: "Proof Required", text: `Submit proof for job ${jobId} before creator acceptance` }, ...items].slice(0, 5));
        return;
      }
      const tx = await api("/protocol/v1/transactions", {
        method: "POST",
        body: JSON.stringify({ action: "acceptProof", params: { jobId, agentId: job.assignedAgentId } })
      });
      setPreparedTx(tx.transaction);
      setOptimisticEvents((items) => [{ type: "Transaction Prepared", text: `Sign acceptProof for job ${jobId}` }, ...items].slice(0, 5));
    } finally {
      setBusy(false);
    }
  }

  async function markFailed(jobId) {
    setBusy(true);
    try {
      const job = jobs.find((item) => item.id === jobId);
      if (!isJobCreator(job)) {
        walletMismatch(`Creator for job ${jobId}`, job?.creator);
        return;
      }
      const reasonHash = await sha256Hex(`failed:${jobId}:${Date.now()}`);
      const tx = await api("/protocol/v1/transactions", {
        method: "POST",
        body: JSON.stringify({ action: "markJobFailed", params: { jobId, agentId: job.assignedAgentId, reasonHash } })
      });
      setPreparedTx(tx.transaction);
      setOptimisticEvents((items) => [{ type: "Transaction Prepared", text: `Sign markJobFailed for job ${jobId}` }, ...items].slice(0, 5));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="two-col">
      <section>
        <form className="card" onSubmit={createJob}>
          <h2>Request Accepted Submission</h2>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Submission to record" required />
          <div className="toolbar">
            <input className="input" type="number" value={reward} onChange={(e) => setReward(e.target.value)} min="0" />
            <p className="fee-note">Creating a job costs 0.005 MNT (Mantle Sepolia testnet)</p>
            <button className="button" disabled={busy} type="submit"><Plus size={18} />Create Proof Task</button>
          </div>
        </form>

        <section className="card" style={{ marginTop: 18 }}>
          <h2>Verification Queue</h2>
          <div className="toolbar">
            <select className="select" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              {agents.map((agent) => <option value={agent.id} key={agent.id}>{agent.name}</option>)}
            </select>
            <button className="button secondary" type="button" disabled={busy} onClick={connectWallet}>Connect Wallet</button>
            <button className="button secondary" type="button" disabled={busy} onClick={addMantleSepoliaToWallet}>+ Add Mantle Sepolia</button>
          </div>
          <p className="wallet-helper">Requires MetaMask on Mantle Sepolia (Chain ID 5003)</p>
          {walletAddress && walletChainId && walletChainId.toLowerCase() !== MANTLE_SEPOLIA_CHAIN.chainId.toLowerCase() && (
            <p className="muted">Wrong network. Agent Atlas runs on Mantle Sepolia. Use Connect Wallet again to switch.</p>
          )}
          {walletAddress && selectedAgent?.owner && !ownsSelectedAgent && (
            <p className="muted">Owner wallet required for this agent. Connected: <code>{shortAddress(walletAddress)}</code>. Owner: <code>{shortAddress(selectedAgent.owner)}</code>.</p>
          )}
          {waitingForIndex && <p className="muted">Waiting for indexed confirmation...</p>}
          <table className="table">
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan="3">
                    <div style={{ padding: 24, textAlign: "center" }}>
                      <p style={{ color: "#0f8f68", marginBottom: 8 }}>No jobs indexed yet</p>
                      <p className="muted">The indexer is starting up or no jobs have been created. Connect your wallet and post the first job.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <strong>{job.description}</strong>
                      <div className="muted">{job.reward} MNT</div>
                    </td>
                    <td><span className={`status ${job.status}`}>{job.status}</span></td>
                    <td>
                      {job.status === "OPEN" && (
                        <button className="button secondary" disabled={ownerActionDisabled} title={ownsSelectedAgent ? "Accept with selected agent owner wallet" : "Connect the selected agent owner wallet"} onClick={() => acceptJob(job.id)}><Play size={16} />Assign Agent</button>
                      )}
                      {job.status === "ASSIGNED" && (
                        <div className="toolbar">
                          <button className="button success" disabled={busy || !ownsAgent(job.assignedAgentId)} title={ownsAgent(job.assignedAgentId) ? "Submit with assigned agent owner wallet" : "Connect the assigned agent owner wallet"} onClick={() => submitProof(job.id)}><Upload size={16} />Submit Proof</button>
                          {job.hasSubmittedProof ? (
                            <button className="button success" disabled={busy || !isJobCreator(job)} title={isJobCreator(job) ? "Accept with job creator wallet" : "Connect the job creator wallet"} onClick={() => acceptProof(job.id)}><CheckCircle size={16} />Accept Submission</button>
                          ) : (
                            <span className="muted">Awaiting proof submission</span>
                          )}
                          <button className="button secondary" disabled={busy || !job.hasSubmittedProof || !isJobCreator(job)} title={!job.hasSubmittedProof ? "Proof submission required before failure" : isJobCreator(job) ? "Mark failed with job creator wallet" : "Connect the job creator wallet"} onClick={() => markFailed(job.id)}><XCircle size={16} />Mark Failed</button>
                        </div>
                      )}
                      {job.status === "COMPLETED" && <CheckCircle color="#0f8f68" />}
                      {job.status === "FAILED" && <XCircle color="#b42318" />}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </section>
      <section>
        {optimisticEvents.length > 0 && (
          <div className="card optimistic">
            <h2>Submission Progress</h2>
            {optimisticEvents.map((event, index) => (
              <div className="event" key={`${event.type}-${index}`}>
                <strong>{event.type}</strong>
                <div className="muted">{event.text}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: optimisticEvents.length > 0 ? 18 : 0 }}>
          <LivePanel />
          {preparedTx && (
            <div className="card" style={{ marginTop: 18 }}>
              <h2>Prepared Transaction</h2>
              <button className="button" disabled={busy} onClick={sendPreparedTransaction}>Sign And Send</button>
              {sentTxHash && <p className="muted">Submitted: <code>{sentTxHash}</code></p>}
              <pre>{JSON.stringify(preparedTx, null, 2)}</pre>
            </div>
          )}
        </div>
      </section>
    </div>
  );

  async function sendPreparedTransaction() {
    if (!preparedTx) return;
    if (!window.ethereum) {
      setOptimisticEvents((items) => [{ type: "Wallet Missing", text: "Install or unlock an EIP-1193 wallet to submit this transaction" }, ...items].slice(0, 5));
      window.open("https://metamask.io/download/", "_blank", "noopener");
      return;
    }
    setBusy(true);
    try {
      const { from, chainId } = await requestWalletOnMantle();
      setWalletAddress(from);
      setWalletChainId(chainId);
      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from, ...preparedTx }]
      });
      setSentTxHash(txHash);
      setWaitingForIndex(true);
      setOptimisticEvents((items) => [{ type: "Waiting for Indexed Confirmation", text: txHash }, ...items].slice(0, 5));
      setPreparedTx(null);
      await pollForIndexedChange(txHash);
    } catch (err) {
      setOptimisticEvents((items) => [{ type: "Wallet Connection Failed", text: err?.message || "MetaMask rejected or failed to switch network" }, ...items].slice(0, 5));
    } finally {
      setBusy(false);
    }
  }

  async function connectWallet() {
    if (!window.ethereum) {
      setOptimisticEvents((items) => [{ type: "Wallet Missing", text: "Install or unlock an EIP-1193 wallet to submit this transaction" }, ...items].slice(0, 5));
      window.open("https://metamask.io/download/", "_blank", "noopener");
      return;
    }
    try {
      const { from, chainId } = await requestWalletOnMantle();
      setWalletAddress(from);
      setWalletChainId(chainId);
      setOptimisticEvents((items) => [{ type: "Wallet Connected", text: `${shortAddress(from)} on Mantle Sepolia` }, ...items].slice(0, 5));
    } catch (err) {
      setOptimisticEvents((items) => [{ type: "Wallet Connection Failed", text: err?.message || "MetaMask rejected or failed to switch network" }, ...items].slice(0, 5));
    }
  }

  async function addMantleSepoliaToWallet() {
    if (!window.ethereum) {
      setOptimisticEvents((items) => [{ type: "Wallet Missing", text: "Install or unlock MetaMask to add Mantle Sepolia" }, ...items].slice(0, 5));
      window.open("https://metamask.io/download/", "_blank", "noopener");
      return;
    }
    try {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [MANTLE_SEPOLIA_CHAIN]
      });
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      setWalletChainId(chainId);
      setOptimisticEvents((items) => [{ type: "Network Added", text: "Mantle Sepolia is available in MetaMask" }, ...items].slice(0, 5));
    } catch (err) {
      setOptimisticEvents((items) => [{ type: "Network Add Failed", text: err?.message || "MetaMask rejected the network request" }, ...items].slice(0, 5));
    }
  }

  async function pollForIndexedChange(txHash) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const nextJobs = await api("/jobs", { fallback: SEED_JOBS });
      setJobs(nextJobs);
      if (JSON.stringify(nextJobs).includes(txHash)) {
        setWaitingForIndex(false);
        setOptimisticEvents((items) => [{ type: "Indexed Confirmation", text: txHash }, ...items].slice(0, 5));
        return;
      }
    }
    // Keep the waiting state active until the indexer confirms the transaction.
    setOptimisticEvents((items) => [{ type: "Indexing Pending", text: "Transaction submitted; waiting for indexer confirmation depth" }, ...items].slice(0, 5));
  }
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `0x${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
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
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [MANTLE_SEPOLIA_CHAIN]
      });
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
