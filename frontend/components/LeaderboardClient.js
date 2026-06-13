"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL, api } from "../lib/api";

export default function LeaderboardClient({ initialAgents, skill = "" }) {
  const [agents, setAgents] = useState(initialAgents);
  const [connected, setConnected] = useState(false);

  const path = useMemo(() => `/leaderboard${skill ? `?skill=${encodeURIComponent(skill)}` : ""}`, [skill]);

  async function refresh() {
    try {
      setAgents(await api(path));
    } catch {
      setConnected(false);
    }
  }

  useEffect(() => {
    let source;
    let reconnectTimer;
    let closed = false;
    const polling = setInterval(refresh, 5000);

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
    <section className="card">
      <div className="sync-state">{connected ? "Live sync on" : "Polling fallback on"}</div>
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
          {agents.length === 0 ? (
            <tr>
              <td colSpan="7">
                <div style={{ padding: 24, textAlign: "center" }}>
                  <p style={{ color: "#0f8f68", marginBottom: 8 }}>No agents indexed yet</p>
                  <p className="muted">The indexer is starting up or no accepted submissions have been indexed.</p>
                </div>
              </td>
            </tr>
          ) : (
            agents.map((agent) => (
              <tr key={agent.id}>
                <td><strong>#{agent.globalRank}</strong></td>
                <td>
                  <a href={`/agents/${agent.id}`}><strong>{agent.name}</strong></a>
                  <div>{agent.skills.map((skillName) => <span className="pill" key={skillName}>{skillName}</span>)}</div>
                </td>
                <td><span className="score-small">{agent.score.reliabilityScore}</span></td>
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
