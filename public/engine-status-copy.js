export function engineStatusCopy(status = {}) {
  const usage = status.aiUsage || {};
  const connection = status.aiConnection;
  const connectionCopy =
    connection === "verified"
      ? "The most recent live AI request completed successfully. Future availability can still vary."
      : connection === "configured"
        ? "AI provider credentials are configured. New reviews can use AI assistance; retries are bounded and configured alternate credentials may be tried."
        : connection === "running"
          ? "An AI request is running now."
          : connection === "attention"
            ? `The latest AI request needs attention (${usage.lastOutcome || "provider unavailable"}). Exact checks remain available.`
            : "Exact document comparisons are available. AI assistance is not configured on this server.";
  const seconds = Math.max(1, Math.round((Number(usage.minIntervalMs) || 6000) / 1000));

  return {
    connection: connectionCopy,
    service: "PackSignal responded to this status check.",
    pacing: `At least ${seconds} seconds between provider request attempts; retries are bounded.`,
    failover:
      "Configured alternate credentials may be tried after a key is paused; availability is not guaranteed.",
    credentials: "Provider API keys stay on the server; the browser never receives them.",
    lastDispatch: `Last provider request: ${usage.lastOutcome || "No live request yet"}.`,
    cooldownUntil: usage.cooldownUntil || null,
    allowance:
      usage.remainingAttempts === 0
        ? "AI requests are paused for this session. Exact checks and cached AI results remain available."
        : "",
  };
}
