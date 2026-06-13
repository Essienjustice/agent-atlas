import Nav from "../../components/Nav";
import LivePanel from "../../components/LivePanel";

export default function LivePage() {
  return (
    <main className="shell">
      <Nav />
      <div className="container">
        <div className="toolbar">
          <div>
            <h1>Live Verification</h1>
            <p className="muted">Reputation from creator-accepted task submissions. Watch proof hashes become indexed reputation updates.</p>
          </div>
          <a className="button" href="/jobs">Verify New Work</a>
        </div>
        <LivePanel />
      </div>
    </main>
  );
}
