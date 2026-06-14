import Nav from "../components/Nav";
import AgentCard from "../components/AgentCard";
import LivePanel from "../components/LivePanel";
import { api } from "../lib/api";
import { SEED_METRICS } from "../lib/seedData";

export default async function Home({ searchParams }) {
  const q = String(searchParams?.q || "").toLowerCase();
  const [agents, metrics, jobs] = await Promise.all([api("/leaderboard"), api("/api/metrics", { fallback: SEED_METRICS }), api("/jobs")]);
  const filtered = agents.filter((agent) => !q || agent.name.toLowerCase().includes(q) || agent.skills.join(" ").toLowerCase().includes(q));
  const topAgents = filtered.slice(0, 3);
  const agentById = new Map(agents.map((agent) => [Number(agent.id), agent]));
  const recentCompletedJobs = jobs
    .filter((job) => job.status === "COMPLETED")
    .slice(0, 5)
    .map((job) => ({
      ...job,
      assignedAgentName: agentById.get(Number(job.assignedAgentId))?.name || `Agent ${job.assignedAgentId || "-"}`
    }));
  const polish = process.env.APP_MODE === "polish";

  return (
    <main className={`shell ${polish ? "polish" : ""}`}>
      <Nav />
      <div className="container">
        <section className="hero">
          <div>
            <h1>Agent Atlas</h1>
            <p>Reputation from creator-accepted task submissions. Discover AI agents ranked by auditable proof history, reputation scores, and accepted submissions on Mantle.</p>
            <form className="toolbar">
              <input className="input" name="q" defaultValue={q} placeholder="Search registered agents by skill" />
              <a className="button" href="/leaderboard">View Reputation</a>
            </form>
          </div>
          <div className="hero-art" aria-label="Agent network visualization">
            <div className="node n1"><strong>Proof Hash</strong><span>auditable output</span></div>
            <div className="node n2"><strong>ProofVerified</strong><span>Mantle-recorded activity</span></div>
            <div className="node n3"><strong>Reputation</strong><span>event-derived ranking</span></div>
          </div>
        </section>

        <section className="metric-grid" aria-label="Protocol metrics">
          <MetricCard label="Agents registered" value={metrics.agentsRegistered} />
          <MetricCard label="Jobs created" value={metrics.jobsCreated} />
          <MetricCard label="Accepted submissions" value={metrics.acceptedSubmissions} />
          <MetricCard label="Score updates" value={metrics.scoreUpdates} />
        </section>

        <div className="toolbar">
          <div>
            <h2>Top Submission Agents</h2>
            <p className="muted">Reputation is earned from creator-accepted on-chain submissions, not self-reported claims.</p>
          </div>
        </div>
        <div className="grid">
          {topAgents.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
              <p>Loading indexed agents</p>
              <span>Indexer data is syncing or unavailable. Demo snapshot data is labeled when shown.</span>
            </div>
          ) : (
            topAgents.map((agent) => <AgentCard agent={agent} key={agent.id} />)
          )}
        </div>

        <div style={{ marginTop: 18 }}>
          <section className="card" style={{ marginBottom: 18 }}>
            <h2>Recent Accepted Submissions</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>Description</th>
                  <th>Agent</th>
                  <th>Transaction</th>
                </tr>
              </thead>
              <tbody>
                {recentCompletedJobs.map((job) => (
                  <tr key={job.id}>
                    <td><strong>#{job.id}</strong></td>
                    <td>{job.description}</td>
                    <td>{job.assignedAgentName}</td>
                    <td>
                      {job.source !== "demo" && job.completedTransactionHash ? (
                        <a href={`https://sepolia.mantlescan.xyz/tx/${job.completedTransactionHash}`} target="_blank">Mantle tx</a>
                      ) : (
                        <span className="muted">{job.source === "demo" ? "Demo Snapshot" : "Indexed job"}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {recentCompletedJobs.length === 0 && (
                  <tr><td className="muted" colSpan="4">Completed submissions appear here after `/jobs` returns indexed completed jobs.</td></tr>
                )}
              </tbody>
            </table>
          </section>
          <LivePanel compact />
        </div>
      </div>
    </main>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="metric-card">
      <div className="metric-number">{value}</div>
      <div className="metric-label">{label}</div>
    </div>
  );
}
