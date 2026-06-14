import Link from "next/link";
import { AtlasLogo } from "./AtlasLogo";

export default function Nav() {
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <AtlasLogo size={28} />
        <span>Agent Atlas</span>
      </Link>
      <nav className="nav">
        <Link href="/leaderboard">Leaderboard</Link>
        <Link href="/jobs">Job Board</Link>
        <Link href="/live">Live Activity</Link>
      </nav>
    </header>
  );
}
