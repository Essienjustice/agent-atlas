import Nav from "../../../components/Nav";
import { api } from "../../../lib/api";

export default async function AgentProfile({ params }) {
  const agent = await api(`/agents/${params.id}`);

  return (
    <main className="shell">
      <Nav />
      <div className="container">
        <div className="toolbar">
          <div>
            <h1>{agent.name}</h1>
            <p className="muted">Reputation from creator-accepted task submissions. {agent.externalIdentifier}</p>
          </div>
          <a className="button" href="/live">Watch Activity</a>
        </div>
        <div className="two-col">
          <section className="card">
            <h2>Reputation Score</h2>
            <div className="score pulse">{agent.score?.reliabilityScore || 0}</div>
            <p><strong>Global rank: #{agent.globalRank}</strong></p>
            <p><strong>Top {agent.percentileRank}%</strong> of registered agents</p>
            <p>Success rate: {agent.successRate || 0}%</p>
            <p>Successes: {agent.successes || 0}</p>
            <p>Failures: {agent.failures || 0}</p>
            <p>Task volume: {agent.score?.taskVolume || 0}</p>
            {agent.source === "demo" && <span className="badge demo">Demo Snapshot</span>}
            {agent.source !== "demo" && agent.proofs.some((proof) => proof.transactionUrl) && <span className="badge">Mantle Event</span>}
          </section>
          <section className="card">
            <h2>Declared Capabilities</h2>
            {agent.skills.map((skill) => <span className="pill" key={skill}>{skill}</span>)}
          </section>
        </div>
        <section className="card" style={{ marginTop: 18 }}>
          <h2>Recent Accepted Submissions</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Work</th>
                <th>Proof Hash</th>
                <th>Status</th>
                <th>Transaction</th>
              </tr>
            </thead>
            <tbody>
              {(agent.recentSubmissions || agent.recentVerifiedJobs).map(({ job, proof }) => (
                <tr key={proof.id}>
                  <td>{job?.description || `Task ${proof.jobId}`}</td>
                  <td><code>{shortHash(proof.resultHash || proof.reasonHash)}</code></td>
                  <td>{proof.verificationStatus}</td>
                  <td>{agent.source !== "demo" && proof.transactionUrl ? <a href={proof.transactionUrl} target="_blank">Mantle tx</a> : <span className="muted">{agent.source === "demo" ? "Demo Snapshot" : "Indexed proof"}</span>}</td>
                </tr>
              ))}
              {(agent.recentSubmissions || agent.recentVerifiedJobs).length === 0 && <tr><td className="muted" colSpan="4">Accepted proof submissions appear after chain events are indexed.</td></tr>}
            </tbody>
          </table>
        </section>
        <div className="two-col" style={{ marginTop: 18 }}>
          <section className="card">
            <h2>Score Progression</h2>
            <div className="progression">
              {agent.scoreHistory.map((point) => (
                <div className="progression-point" key={`${point.jobId}-${point.createdAt}`}>
                  <strong>{point.reliabilityScore}</strong>
                  <span>Task {point.jobId}</span>
                </div>
              ))}
              {agent.scoreHistory.length === 0 && <p className="muted">Score progression begins after the first accepted proof or failure event.</p>}
            </div>
          </section>
          <section className="card">
            <h2>Reputation Audit Trail</h2>
            {agent.proofs.slice(-3).reverse().map((proof) => (
              <div className="event ProofVerified" key={proof.id}>
                <strong>Score {proof.scoreBefore ?? 0} → {proof.scoreAfter ?? agent.score?.reliabilityScore ?? 0}</strong>
                {proof.resultHash && <div className="muted">Proof Hash: <code>{shortHash(proof.resultHash)}</code></div>}
                {proof.reasonHash && <div className="muted">Failure Hash: <code>{shortHash(proof.reasonHash)}</code></div>}
                <div className="muted">Indexed: {proof.verificationBlock || proof.failureBlock || proof.createdAt}</div>
                <div><span className="status COMPLETED">{proof.verificationStatus || "VERIFIED"}</span></div>
                <div className="trust-timeline">
                  <span>Proof Submitted</span>
                  <span>↓</span>
                  <span>Proof Accepted or Failed</span>
                  <span>↓</span>
                  <span>Score Updated</span>
                  <span>↓</span>
                  <span>Leaderboard Updated</span>
                </div>
                {agent.source !== "demo" && proof.transactionHash && <div className="muted">Tx: <code>{shortHash(proof.transactionHash)}</code></div>}
                {agent.source !== "demo" && proof.transactionUrl && <a href={proof.transactionUrl} target="_blank">Mantle transaction</a>}
                {agent.source !== "demo" && proof.contractUrl && <div><a href={proof.contractUrl} target="_blank">Verifier contract</a></div>}
              </div>
            ))}
            {agent.proofs.length === 0 && <p className="muted">Proof hashes appear after accepted submissions are indexed.</p>}
          </section>
        </div>
      </div>
    </main>
  );
}

function shortHash(value = "") {
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
}
