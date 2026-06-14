import Link from "next/link";
import { AtlasLogo } from "./AtlasLogo";

export default function Nav() {
  return (
    <header className="topbar">
      <a href="https://agent-atlas-site.vercel.app" style={{display:'flex', alignItems:'center', gap:'10px', textDecoration:'none', color:'inherit'}}>
        <AtlasLogo size={40} />
        <span style={{fontWeight:700, fontSize:'1.1rem'}}>Agent Atlas</span>
      </a>
      <nav className="nav">
        <Link href="/leaderboard">Leaderboard</Link>
        <Link href="/jobs">Job Board</Link>
        <Link href="/live">Live Activity</Link>
      </nav>
    </header>
  );
}
