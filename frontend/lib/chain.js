export const EXPLORER = "https://sepolia.mantlescan.xyz";

export function txUrl(hash) {
  return `${EXPLORER}/tx/${hash}`;
}

export function addrUrl(address) {
  return `${EXPLORER}/address/${address}`;
}

export function shortHash(s) {
  if (!s || s.length < 10) return s ?? "";
  return s.slice(0, 6) + "..." + s.slice(-4);
}

export function formatTimeAgo(ts) {
  const ms = typeof ts === "number" && ts < 1e12
    ? ts * 1000
    : new Date(ts).getTime();
  const s = Math.floor((Date.now() - ms) / 1000);
  if (isNaN(s) || s < 0) return "—";
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ms).toLocaleDateString();
}
