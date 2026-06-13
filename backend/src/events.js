const clients = new Set();
const recentEvents = [];
const processedKeys = new Set();
let sequence = 0;
let chain = Promise.resolve();

function emitNow(event) {
  const enriched = {
    id: event.id || `${++sequence}-${event.type}`,
    sequence,
    timestamp: new Date().toISOString(),
    ...event
  };
  recentEvents.push(enriched);
  recentEvents.splice(50);

  for (const res of clients) {
    try {
      res.write(`id: ${enriched.id}\ndata: ${JSON.stringify(enriched)}\n\n`);
    } catch (error) {
      clients.delete(res);
    }
  }

  return enriched;
}

function pushEvent(event) {
  const idempotencyKey = event.idempotencyKey || `${event.type}:${JSON.stringify(event.payload || {})}`;
  if (processedKeys.has(idempotencyKey)) return null;
  processedKeys.add(idempotencyKey);
  chain = chain.then(() => emitNow({ ...event, idempotencyKey })).catch((error) => {
    console.error("event processing failed", { idempotencyKey, error: error.message });
  });
  return chain;
}

function streamEvents(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  res.write(`data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`);
  const lastEventId = req.headers["last-event-id"];
  const missed = lastEventId ? recentEvents.filter((event) => event.id > lastEventId) : recentEvents.slice(-20);
  for (const event of missed) {
    res.write(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`);
  }
  clients.add(res);
  req.on("close", () => clients.delete(res));
}

function getRecentEvents() {
  return [...recentEvents].reverse();
}

module.exports = { pushEvent, streamEvents, getRecentEvents };
