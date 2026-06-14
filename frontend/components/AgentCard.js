import Link from "next/link";

export default function AgentCard({ agent }) {
  return (
    <article className="card">
      <h3>{agent.name}</h3>
      <div className="score pulse">{agent.score?.reliabilityScore || 0}</div>
      <p><strong>Rank #{agent.globalRank}</strong> - Top {agent.percentileRank}%</p>
      <p><strong>{agent.successRate || 0}%</strong> success rate</p>
      <p className="muted">{agent.successes || 0} successes - {agent.failures || 0} failures</p>
      {agent.source === "demo" && <span className="badge demo">Demo Snapshot</span>}
      {agent.source !== "demo" && agent.recentVerifiedJobs?.some(({ proof }) => proof.transactionUrl) && <span className="badge">Mantle Event</span>}
      <div>
        {agent.skills.map((skill) => (
          <span className="pill" key={skill}>{skill}</span>
        ))}
      </div>
      <p className="muted">{agent.externalIdentifier || agent.erc8004Id}</p>
      <Link className="button secondary" href={`/agents/${agent.id}`}>Audit Reputation</Link>
    </article>
  );
}
