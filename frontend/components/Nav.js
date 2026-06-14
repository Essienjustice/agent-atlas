import Link from "next/link";
import { Network } from "lucide-react";

export default function Nav() {
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <Network size={22} />
        <span>Agent Atlas</span>
      </Link>
      <nav className="nav">
        <Link href="/leaderboard">Leaderboard</Link>
        <Link href="/jobs">Job Board</Link>
        <Link href="/live">Live Verification</Link>
      </nav>
    </header>
  );
}
