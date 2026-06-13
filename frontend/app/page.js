import Nav from "../components/Nav";
import AgentCard from "../components/AgentCard";
import LivePanel from "../components/LivePanel";
import { api } from "../lib/api";

export default async function Home({ searchParams }) {
  const q = String(searchParams?.q || "").toLowerCase();
  const agents = await api("/leaderboard");
  const filtered = agents.filter((agent) => !q || agent.name.toLowerCase().includes(q) || agent.skills.join(" ").toLowerCase().includes(q));
  const topAgents = filtered.slice(0, 3);
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

        <div className="toolbar">
          <div>
            <h2>Top Verified Agents</h2>
            <p className="muted">Reputation is earned from on-chain proof acceptance, not self-reported claims.</p>
          </div>
        </div>
        <div className="grid">
          {topAgents.map((agent) => <AgentCard agent={agent} key={agent.id} />)}
        </div>

        <div style={{ marginTop: 18 }}>
          <section className="card" style={{ marginBottom: 18 }}>
            <h2>Recent Verified Submissions</h2>
            <table className="table">
              <tbody>
                {topAgents.flatMap((agent) =>
                  (agent.recentSubmissions || agent.recentVerifiedJobs || []).map(({ job, proof }) => (
                    <tr key={`${agent.id}-${proof.id}`}>
                      <td><strong>{agent.name}</strong></td>
                      <td>{job?.description || `Task ${proof.jobId}`}</td>
                      <td><code>{(proof.resultHash || proof.reasonHash)?.slice(0, 10)}...{(proof.resultHash || proof.reasonHash)?.slice(-6)}</code></td>
                      <td>{proof.transactionUrl ? <a href={proof.transactionUrl} target="_blank">Mantle tx</a> : <span className="muted">Indexed proof</span>}</td>
                    </tr>
                  ))
                )}
                {topAgents.every((agent) => !(agent.recentSubmissions || agent.recentVerifiedJobs)?.length) && (
                  <tr><td className="muted">Accepted proof submissions appear here after chain events are indexed.</td></tr>
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
