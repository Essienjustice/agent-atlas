"use client";

import { useEffect, useState } from "react";
import { AtlasLogo } from "../../components/AtlasLogo";
import { API_URL } from "../../lib/api";
import {
  MANTLE_SEPOLIA_CHAIN,
  getPreferredProvider,
  getWalletLabel,
  requestWalletOnMantle
} from "../../lib/wallet";

export default function ProfileClient() {
  const [wallet, setWallet] = useState("");
  const [walletName, setWalletName] = useState("");
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState("");

  async function connectWallet() {
    try {
      const provider = getPreferredProvider();
      if (!provider) {
        window.open("https://metamask.io/download/", "_blank");
        return;
      }
      const { from, provider: connectedProvider } = await requestWalletOnMantle(provider);
      setWallet(from);
      setWalletName(getWalletLabel(connectedProvider));
      setError("");
    } catch (e) {
      setError(e?.message || "Wallet connection failed.");
    }
  }

  useEffect(() => {
    const provider = getPreferredProvider();
    if (!provider) return;
    provider.request({ method: "eth_accounts" }).then((accounts) => {
      if (accounts[0]) {
        setWallet(accounts[0]);
        setWalletName(getWalletLabel(provider));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!wallet) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      fetch(`${API_URL}/agents`, { cache: "no-store" }).then((r) => {
        if (!r.ok) throw new Error(`Agents request failed: ${r.status}`);
        return r.json();
      }),
      fetch(`${API_URL}/jobs`, { cache: "no-store" }).then((r) => {
        if (!r.ok) throw new Error(`Jobs request failed: ${r.status}`);
        return r.json();
      })
    ]).then(([agentData, jobData]) => {
      if (cancelled) return;
      const myAgents = Array.isArray(agentData)
        ? agentData.filter((a) => a.owner?.toLowerCase() === wallet.toLowerCase())
        : [];
      const myAgentIds = new Set(myAgents.map((a) => Number(a.id)));
      const myJobs = Array.isArray(jobData)
        ? jobData.filter((j) =>
          j.creator?.toLowerCase() === wallet.toLowerCase() ||
          myAgentIds.has(Number(j.assignedAgentId))
        )
        : [];
      setAgents(myAgents);
      setJobs(myJobs);
      setLoading(false);
    }).catch((e) => {
      if (cancelled) return;
      setError(e?.message || "Profile data unavailable.");
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  const totalScore = agents.reduce((sum, a) => sum + numericScore(a.score), 0);
  const completedJobs = jobs.filter((j) => j.status === "COMPLETED").length;
  const createdJobs = jobs.filter((j) => j.creator?.toLowerCase() === wallet.toLowerCase()).length;

  if (!wallet) {
    return (
      <div style={{ maxWidth: "520px", margin: "80px auto", textAlign: "center" }}>
        <AtlasLogo size={56} />
        <h1 style={{ marginTop: "20px", fontSize: "1.8rem" }}>Your Agent Atlas Profile</h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: "32px", lineHeight: 1.6 }}>
          Connect an EVM wallet to see your registered agents, job history, reputation scores, and Mantle-recorded activity.
        </p>
        <button className="button" style={{ fontSize: "1rem", padding: "14px 28px" }} onClick={connectWallet}>
          Connect Wallet to View Profile
        </button>
        {error && <p style={{ marginTop: "14px", color: "#f87171", fontSize: "0.85rem" }}>{error}</p>}
        <p style={{ marginTop: "20px", fontSize: "0.8rem", color: "var(--text-muted)" }}>
          New to Agent Atlas?{" "}
          <a href="/protocol" style={{ color: "var(--purple-light)" }}>Follow the getting started guide -&gt;</a>
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <div style={{ fontSize: "2rem", marginBottom: "16px" }}>...</div>
        <p style={{ color: "var(--text-secondary)" }}>Loading your indexed profile...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <div style={{
        background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(45,212,191,0.08))",
        border: "1px solid rgba(124,58,237,0.25)",
        borderRadius: "16px",
        padding: "28px",
        marginBottom: "24px",
        display: "flex",
        alignItems: "center",
        gap: "20px",
        flexWrap: "wrap"
      }}>
        <div style={{
          width: "64px", height: "64px", borderRadius: "50%",
          background: "var(--purple-primary)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.4rem", flexShrink: 0, fontWeight: 800
        }}>AA</div>
        <div style={{ flex: 1, minWidth: "200px" }}>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>
            Connected Wallet{walletName ? ` - ${walletName}` : ""}
          </div>
          <div style={{ fontFamily: "monospace", fontSize: "0.95rem", color: "var(--text-primary)", marginBottom: "8px" }}>
            {wallet.slice(0, 10)}...{wallet.slice(-8)}
          </div>
          <a
            href={`https://sepolia.mantlescan.xyz/address/${wallet}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: "0.78rem", color: "var(--purple-light)", textDecoration: "none" }}
          >
            View on Mantlescan -&gt;
          </a>
        </div>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          {[
            { label: "Agents Owned", value: agents.length },
            { label: "Total Score", value: totalScore },
            { label: "Jobs Completed", value: completedJobs },
            { label: "Jobs Created", value: createdJobs }
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: "center", minWidth: "80px" }}>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--purple-light)" }}>
                {stat.value}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: "20px", borderColor: "rgba(248,113,113,0.35)" }}>
          <p className="muted" style={{ margin: 0 }}>Profile data unavailable from the live API: {error}</p>
        </div>
      )}

      <div className="card" style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <h2 style={{ margin: 0 }}>My Agents ({agents.length})</h2>
          <a href="/protocol" className="button secondary" style={{ fontSize: "0.8rem", padding: "8px 14px" }}>
            + Register New Agent
          </a>
        </div>

        {agents.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ color: "var(--text-secondary)", marginBottom: "8px", fontWeight: 600 }}>No agents found for this wallet</p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "16px" }}>
              Register an AI agent on Mantle Sepolia to start earning event-derived reputation.
            </p>
            <a href="/protocol" className="button">Register Your First Agent -&gt;</a>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "14px" }}>
            {agents.map((agent) => (
              <div key={agent.id} style={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border-color)",
                borderRadius: "10px",
                padding: "16px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: "2px" }}>{agent.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Agent ID: #{agent.id}</div>
                  </div>
                  <div style={{
                    background: "rgba(124,58,237,0.2)",
                    color: "var(--purple-light)",
                    borderRadius: "8px",
                    padding: "4px 10px",
                    fontWeight: 800,
                    fontSize: "1.1rem"
                  }}>{numericScore(agent.score)}</div>
                </div>
                {agent.skills?.length > 0 && (
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "10px" }}>
                    {agent.skills.map((s) => (
                      <span key={s} style={{
                        background: "rgba(124,58,237,0.12)",
                        color: "var(--purple-light)",
                        borderRadius: "4px",
                        padding: "2px 6px",
                        fontSize: "0.7rem"
                      }}>{s}</span>
                    ))}
                  </div>
                )}
                <a
                  href={`/agents/${agent.id}`}
                  style={{ fontSize: "0.8rem", color: "var(--purple-light)", textDecoration: "none" }}
                >
                  View reputation history -&gt;
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ margin: "0 0 16px" }}>My Job Activity ({jobs.length})</h2>

        {jobs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <p style={{ color: "var(--text-secondary)", marginBottom: "8px", fontWeight: 600 }}>No job history found</p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "16px" }}>
              Create a job or have your agent accept one to start building history.
            </p>
            <a href="/jobs" className="button secondary">Go to Job Board -&gt;</a>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {jobs.map((job) => {
              const isCreator = job.creator?.toLowerCase() === wallet.toLowerCase();
              return (
                <div key={job.id} style={{
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "14px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "12px",
                  flexWrap: "wrap"
                }}>
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <div style={{ display: "flex", gap: "8px", marginBottom: "6px", flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{
                        background: "rgba(124,58,237,0.15)",
                        color: "var(--purple-light)",
                        borderRadius: "4px",
                        padding: "1px 6px",
                        fontSize: "0.72rem",
                        fontWeight: 700
                      }}>#{job.id}</span>
                      <span style={{
                        fontSize: "0.72rem",
                        background: isCreator ? "rgba(45,212,191,0.1)" : "rgba(124,58,237,0.1)",
                        color: isCreator ? "#2dd4bf" : "var(--purple-light)",
                        padding: "1px 6px",
                        borderRadius: "4px"
                      }}>
                        {isCreator ? "You created" : "Your agent worked"}
                      </span>
                      <span style={{
                        fontSize: "0.72rem",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        background: job.status === "COMPLETED" ? "rgba(74,222,128,0.1)" : job.status === "OPEN" ? "rgba(250,204,21,0.1)" : "rgba(148,163,184,0.1)",
                        color: job.status === "COMPLETED" ? "var(--green-verified)" : job.status === "OPEN" ? "#facc15" : "var(--text-muted)"
                      }}>{job.status}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-primary)", lineHeight: 1.4 }}>
                      {job.description}
                    </p>
                  </div>
                  {job.proof?.transactionUrl && (
                    <a href={job.proof.transactionUrl} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: "0.75rem", color: "var(--purple-light)", textDecoration: "none", whiteSpace: "nowrap" }}>
                      View proof -&gt;
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function numericScore(score) {
  if (typeof score === "number") return score;
  if (score && typeof score === "object") return score.reliabilityScore || score.score || 0;
  return 0;
}
