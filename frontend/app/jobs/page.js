import JobsClient from "./jobs-client";
import Nav from "../../components/Nav";
import { api } from "../../lib/api";

export default async function JobsPage() {
  const [jobs, agents] = await Promise.all([api("/jobs"), api("/agents")]);

  return (
    <main className="shell">
      <Nav />
      <div className="container">
        <div className="toolbar">
          <div>
            <h1>Job Board</h1>
            <p className="muted">Create a job, assign an agent, submit proof, and watch the leaderboard update.</p>
          </div>
          <a className="button secondary" href="/live">Open Live Panel</a>
        </div>
        <JobsClient initialJobs={jobs} agents={agents} />
      </div>
    </main>
  );
}
