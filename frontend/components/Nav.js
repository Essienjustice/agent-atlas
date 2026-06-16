"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AtlasLogo } from "./AtlasLogo";

export default function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    function closeOnScroll() {
      setMobileOpen(false);
    }
    window.addEventListener("scroll", closeOnScroll, { passive: true });
    return () => window.removeEventListener("scroll", closeOnScroll);
  }, [mobileOpen]);

  function closeMenu() {
    setMobileOpen(false);
  }

  return (
    <header className="topbar">
      <a href="https://agent-atlas-site.vercel.app" style={{display:'flex', alignItems:'center', gap:'10px', textDecoration:'none', color:'inherit'}}>
        <AtlasLogo size={40} />
        <span style={{fontWeight:700, fontSize:'1.1rem'}}>Agent Atlas</span>
      </a>
      <button
        className="nav-toggle"
        type="button"
        aria-expanded={mobileOpen}
        aria-label="Toggle navigation"
        onClick={() => setMobileOpen((open) => !open)}
      >
        Menu
      </button>
      {mobileOpen && <div className="nav-overlay" onClick={closeMenu} aria-hidden="true" />}
      <nav className={`nav ${mobileOpen ? "open" : ""}`}>
        <Link href="/protocol" onClick={closeMenu}>Try It</Link>
        <a href="https://agent-atlas-site.vercel.app" target="_blank" rel="noopener noreferrer" onClick={closeMenu}>About</a>
        <Link href="/profile" onClick={closeMenu}>Profile</Link>
        <Link href="/leaderboard" onClick={closeMenu}>Leaderboard</Link>
        <Link href="/jobs" onClick={closeMenu}>Job Board</Link>
        <Link href="/live" onClick={closeMenu}>Live Activity</Link>
      </nav>
    </header>
  );
}
