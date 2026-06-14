"use client";

import { useEffect, useState } from "react";
import { API_URL, api } from "../lib/api";
import { SEED_EVENTS } from "../lib/seedData";

export default function LivePanel({ compact = false }) {
  const [events, setEvents] = useState(SEED_EVENTS.slice(0, compact ? 6 : 30));
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let source;
    let reconnectTimer;
    let closed = false;

    function mergeEvents(incoming) {
      setEvents((current) => {
        const byId = new Map([...incoming, ...current].map((event) => [event.id || `${event.type}-${event.timestamp}`, event]));
        return [...byId.values()]
          .sort((a, b) => (b.sequence || 0) - (a.sequence || 0))
          .slice(0, compact ? 6 : 30);
      });
    }

    async function hydrate() {
      try {
        mergeEvents(await api("/events/recent"));
      } catch (error) {
        console.warn("Live event feed unavailable; using seed events.", error);
        mergeEvents(SEED_EVENTS);
        setConnected(false);
      }
    }

    function connect() {
      if (!API_URL) return;
      source = new EventSource(`${API_URL}/events`);
      source.onopen = () => setConnected(true);
      source.onmessage = (message) => {
        const event = JSON.parse(message.data);
        if (event.type === "connected") return;
        mergeEvents([event]);
      };
      source.onerror = () => {
        setConnected(false);
        source.close();
        if (!closed) reconnectTimer = setTimeout(connect, 1000);
      };
    }

    hydrate();
    const polling = setInterval(hydrate, 5000);
    connect();
    return () => {
      closed = true;
      clearInterval(polling);
      clearTimeout(reconnectTimer);
      if (source) source.close();
    };
  }, [compact]);

  return (
    <section className="card">
      <h2>Verification Transparency</h2>
      <p className="muted">{connected ? "Live stream connected." : "Polling indexed chain events."}</p>
      <div className="timeline">
        {events.length === 0 && (
          <div className="event">
            <strong>Demo mode - Connect indexer for live events</strong>
            <div className="muted">Seed events are shown until the live indexer stream is available.</div>
          </div>
        )}
        {events.map((event) => (
          <div className={`event event-row ${event.type}`} key={event.id || event.timestamp}>
            <strong className={`event-badge ${event.type}`}>{event.type}</strong>
            {event.agent && <div className="muted">{event.agent}</div>}
            <div className="muted">{formatEventTime(event.timestamp)}</div>
            {["ProofVerified", "ProofFailed"].includes(event.type) && (
              <div className="trust-timeline horizontal">
                <span>{event.type === "ProofFailed" ? "Failure Marked" : "Proof Submitted"}</span>
                <span>↓</span>
                <span>Proof Accepted or Failed</span>
                <span>↓</span>
                <span>Score Updated</span>
                <span>↓</span>
                <span>Leaderboard Updated</span>
              </div>
            )}
            {event.type === "ScoreUpdated" && event.payload && (
              <div className="score-delta">
                Score {event.payload.scoreBefore ?? 0} {"->"} {event.payload.scoreAfter ?? event.payload.reliabilityScore}
              </div>
            )}
            {event.payload?.resultHash && <div><code>{event.payload.resultHash}</code></div>}
            {event.payload?.reasonHash && <div><code>{event.payload.reasonHash}</code></div>}
            {event.payload?.verificationTimestamp && <div className="muted">Verified: {event.payload.verificationTimestamp}</div>}
            {event.payload?.transactionHash && (
              <div className="muted">
                Tx: <a className="tx-link" href={`https://sepolia.mantlescan.xyz/tx/${event.payload.transactionHash}`} target="_blank" rel="noopener noreferrer">
                  {event.payload.transactionHash.slice(0, 10)}...{event.payload.transactionHash.slice(-6)}
                </a>
              </div>
            )}
            {event.payload?.transactionUrl && <span className="badge">Verified On Mantle</span>}
            {event.payload?.transactionUrl && <a href={event.payload.transactionUrl} target="_blank">View proof transaction</a>}
            {event.payload?.contractUrl && <div><a href={event.payload.contractUrl} target="_blank">Verifier contract</a></div>}
            {!event.payload?.resultHash && !event.payload?.transactionUrl && <pre>{JSON.stringify(event.payload, null, 2)}</pre>}
          </div>
        ))}
      </div>
    </section>
  );
}

function formatEventTime(value) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleTimeString();
}
