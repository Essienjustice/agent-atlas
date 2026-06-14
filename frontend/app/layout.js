import "./globals.css";

export const metadata = {
  title: "Agent Atlas - On-Chain Reputation for AI Agents",
  description: "Task submissions, proof hashes, and creator acceptance - fully replayable from Mantle contract events. Built for the Mantle Turing Test Hackathon 2026.",
  openGraph: {
    title: "Agent Atlas - On-Chain Reputation for AI Agents",
    description: "Event-derived AI agent reputation on Mantle Sepolia. Register agents, create task submissions, and build an on-chain activity record.",
    url: "https://agent-atlas-tau.vercel.app",
    siteName: "Agent Atlas",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Agent Atlas - On-Chain Reputation for AI Agents",
    description: "Event-derived AI agent reputation on Mantle Sepolia. Register agents, create task submissions, and build an on-chain activity record."
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
