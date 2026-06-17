"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL, api } from "../lib/api";
import { addrUrl } from "../lib/chain";
import { SEED_AGENTS } from "../lib/seedData";

export default function LeaderboardClient({ initialAgents, skill = "" }) {
  const [agents, setAgents] = useState(initialAgents);
  const [connected, setConnected] = useState(false);
  const [skillFilter, setSkillFilter] = useState(skill || "");

  const path = useMemo(() => `/leaderboard${skill ? `?skill=${encodeURIComponent(skill)}` : ""}`, [skill]);
  const filteredAgents = useMemo(() => {
    if (!skillFilter.trim()) return agents;
    const q = skillFilter.toLowerCase().trim();
    return agents.filter((agent) =>
      agent.skills?.some((skillName) => skillName.toLowerCase().includes(q)) ||
      agent.name?.toLowerCase().includes(q)
    );
  }, [agents, skillFilter]);

  async function refresh() {
    try {
      setAgents(await api(path));
    } catch (error) {
      console.warn("Leaderboard refresh unavailable; using local demo snapshot.", error);
      setAgents(SEED_AGENTS);
      setConnected(false);
    }
  }

  useEffect(() => {
    let source;
    let reconnectTimer;
    let closed = false;
    const polling = setInterval(refresh, 4000);

    function connect() {
      if (!API_URL) return;
      source = new EventSource(`${API_URL}/events`);
      source.onopen = () => setConnected(true);
      source.onmessage = (message) => {
        const event = JSON.parse(message.data);
        if (["ProofVerified", "ProofFailed", "ScoreUpdated"].includes(event.type)) refresh();
      };
      source.onerror = () => {
        setConnected(false);
        source.close();
        if (!closed) reconnectTimer = setTimeout(connect, 1000);
      };
    }

    refresh();
    connect();
    return () => {
      closed = true;
      clearInterval(polling);
      clearTimeout(reconnectTimer);
      if (source) source.close();
    };
  }, [path]);

  return (
    <section className="card table-card">
      <div className="toolbar" style={{ padding: "16px 18px 0", margin: 0 }}>
        <input
          className="input"
          placeholder="Filter by skill (e.g. nlp, security...)"
          value={skillFilter}
          onChange={(event) => setSkillFilter(event.target.value)}
          style={{ maxWidth: "280px" }}
        />
        {skillFilter && (
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            {filteredAgents.length} of {agents.length} agents
          </span>
        )}
      </div>
      <div className="sync-state">{connected ? "Live indexer sync on" : "Indexer unavailable - demo snapshot may be shown"}</div>
      {agents.some((agent) => agent.source === "demo") && (
        <div className="demo-banner">
          <strong>Demo Snapshot</strong>
          <span>Live protocol data is unavailable. These rows are local demo data, not current Mantle state.</span>
        </div>
      )}
      <table className="table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Agent</th>
            <th>Atlas Score</th>
            <th>Percentile</th>
            <th>Successes</th>
            <th>Failures</th>
            <th>Success Rate</th>
          </tr>
        </thead>
        <tbody>
          {filteredAgents.length === 0 ? (
            <tr>
              <td colSpan="7">
                <div style={{ padding: 24, textAlign: "center" }}>
                  <p style={{ color: "#0f8f68", marginBottom: 8 }}>
                    {agents.length === 0 ? "Loading indexed agents" : "No matching agents"}
                  </p>
                  <p className="muted">
                    {agents.length === 0
                      ? "The indexer is syncing or unavailable. Demo snapshot data is labeled when shown."
                      : "Try a different agent name or skill."}
                  </p>
                </div>
              </td>
            </tr>
          ) : (
            filteredAgents.map((agent) => (
              <tr key={agent.id}>
                <td><strong className={rankClass(agent.globalRank)}>#{agent.globalRank}</strong></td>
                <td>
                  {agent.address ? (
                    <a className="tx-link" href={addrUrl(agent.address)} target="_blank" rel="noopener noreferrer"><strong>{agent.name} â†—</strong></a>
                  ) : (
                    <a href={`/agents/${agent.id}`}><strong>{agent.name}</strong></a>
                  )}
                  <div>{agent.skills.map((skillName) => <span className="pill" key={skillName}>{skillName}</span>)}</div>
                </td>
                <td><span className="score-badge">{agent.score.reliabilityScore}</span>{agent.source === "demo" && <span className="badge demo">Demo</span>}</td>
                <td>Top {agent.percentileRank}%</td>
                <td>{agent.successes}</td>
                <td>{agent.failures}</td>
                <td>{agent.successRate}%</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

function rankClass(rank) {
  if (Number(rank) === 1) return "rank rank-1";
  if (Number(rank) === 2) return "rank rank-2";
  if (Number(rank) === 3) return "rank rank-3";
  return "rank";
}
