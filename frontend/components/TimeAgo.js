"use client";

import { useEffect, useState } from "react";
import { formatTimeAgo } from "../lib/chain";

export function TimeAgo({ ts }) {
  const [display, setDisplay] = useState(
    () => formatTimeAgo(ts)
  );

  useEffect(() => {
    setDisplay(formatTimeAgo(ts));
    const id = setInterval(
      () => setDisplay(formatTimeAgo(ts)),
      15000
    );
    return () => clearInterval(id);
  }, [ts]);

  const parsed = new Date(ts);
  const title = Number.isNaN(parsed.getTime()) ? String(ts ?? "") : parsed.toISOString();

  return (
    <span
      title={title}
      className="muted"
    >
      {display}
    </span>
  );
}
