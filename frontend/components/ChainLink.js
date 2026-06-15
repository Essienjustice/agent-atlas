"use client";

import { useState } from "react";
import { addrUrl, shortHash, txUrl } from "../lib/chain";

export function ChainLink({ value, type, label }) {
  const [copied, setCopied] = useState(false);
  const url = type === "tx" ? txUrl(value) : addrUrl(value);
  const display = label ?? shortHash(value);

  function handleCopy() {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="tx-link"
      >
        {display}
      </a>{" "}
      <button
        onClick={handleCopy}
        type="button"
        className="muted"
        title="Copy to clipboard"
      >
        {copied ? "✓" : "copy"}
      </button>{" "}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="muted"
        title="View on Mantlescan"
      >
        ↗
      </a>
    </span>
  );
}
