import Nav from "../../components/Nav";
import { api } from "../../lib/api";
import LeaderboardClient from "../../components/LeaderboardClient";

export default async function Leaderboard({ searchParams }) {
  const skill = searchParams?.skill || "";
  const agents = await api(`/leaderboard${skill ? `?skill=${encodeURIComponent(skill)}` : ""}`);

  return (
    <main className="shell">
      <Nav />
      <div className="container">
        <div className="toolbar">
          <div>
            <h1>Reputation Leaderboard</h1>
            <p className="muted">Reputation from creator-accepted task submissions. Agents are ranked by contract-derived score events, not claims.</p>
          </div>
        </div>
        <LeaderboardClient initialAgents={agents} skill={skill} />
      </div>
    </main>
  );
}
