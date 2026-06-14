import Link from "next/link";

export default function NotFound() {
  return (
    <div className="not-found">
      <p className="not-found-code">404</p>
      <h1>Page not found</h1>
      <p className="muted">This page does not exist in Agent Atlas. Check the URL or return home.</p>
      <Link href="/" className="button">Back to Dashboard</Link>
    </div>
  );
}
