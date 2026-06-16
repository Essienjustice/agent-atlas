"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";
import { ChainLink } from "./ChainLink";
import { TimeAgo } from "./TimeAgo";

export default function LivePanel({ compact = false }) {
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const [failed, setFailed] = useState(false);

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
        const response = await fetch(`${API_URL}/events/recent`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        const data = await response.json();
        mergeEvents(Array.isArray(data) ? data.filter((event) => !isDemoEvent(event)) : []);
        setFailed(false);
      } catch (error) {
        console.warn("Live event feed unavailable.", error);
        setEvents([]);
        setFailed(true);
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
        if (!isDemoEvent(event)) {
          mergeEvents([event]);
          setFailed(false);
        }
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
      <h2>Submission Transparency</h2>
      <p className="muted">{connected ? "Live indexer stream connected." : "Live indexer stream connecting..."}</p>
      <div className="timeline">
        {events.length === 0 && (
          <div className="event">
            <strong>Live indexer stream connecting...</strong>
            <div className="muted">
              {failed ? "Live protocol data unavailable. Real-time Mantle events appear here as they are indexed." : "Real-time Mantle events appear here as they are indexed."}
            </div>
          </div>
        )}
        {events.map((event) => {
          const isDemo = isDemoEvent(event);
          if (isDemo) return null;
          return (
          <div className={`event event-row ${event.type}`} key={event.id || event.timestamp}>
            <strong className={`event-badge ${event.type}`}>{event.type}</strong>
            {event.agent && <div className="muted">{event.agent}</div>}
            <div><TimeAgo ts={event.timestamp} /></div>
            {["ProofVerified", "ProofFailed"].includes(event.type) && (
              <div className="trust-timeline horizontal">
                <span>{event.type === "ProofFailed" ? "Failure Marked" : "Proof Submitted"}</span>
                <span>↓</span>
                <span>Submission Accepted or Failed</span>
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
            {event.payload?.verificationTimestamp && <div className="muted">Accepted: <TimeAgo ts={event.payload.verificationTimestamp} /></div>}
            {!isDemo && event.payload?.transactionHash && (
              <div className="muted">
                Tx: <ChainLink value={event.payload.transactionHash} type="tx" />
              </div>
            )}
            {!isDemo && event.payload?.transactionUrl && <span className="badge">Mantle Event</span>}
            {!isDemo && event.payload?.transactionUrl && <a className="tx-link" href={event.payload.transactionUrl} target="_blank" rel="noopener noreferrer">View Mantle transaction</a>}
            {!isDemo && event.payload?.contractAddress && <div><ChainLink value={event.payload.contractAddress} type="address" label="Verifier contract" /></div>}
            {!isDemo && !event.payload?.contractAddress && event.payload?.contractUrl && <div><a className="tx-link" href={event.payload.contractUrl} target="_blank" rel="noopener noreferrer">Verifier contract</a></div>}
            {!isDemo && !event.payload?.resultHash && !event.payload?.transactionUrl && <pre>{JSON.stringify(event.payload, null, 2)}</pre>}
          </div>
        );})}
      </div>
    </section>
  );
}

function isDemoEvent(event) {
  return event?.source === "demo" || event?.payload?.demoSnapshot;
}
