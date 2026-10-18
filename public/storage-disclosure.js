export function storageDisclosure(hostname = "") {
  const host = String(hostname)
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  const local =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".localhost");
  // The currently deployed Render service is on Free compute without a disk.
  // Update this note if the service moves to durable storage.
  const renderFree = host === "packsignal.onrender.com";
  const storedAt = local ? "this computer" : "the server running PackSignal";

  return {
    workspaceLabel: local ? "Local workspace" : "Hosted workspace",
    storageLabel: local
      ? "Stored on this computer"
      : renderFree
        ? "Temporary server storage · may reset"
        : "Stored on the server running PackSignal",
    historyNotice: local
      ? "Saved on this computer with source files and decision history."
      : renderFree
        ? "This Render Free service has no persistent disk. Reviews may be lost on spin-down, restart, or redeploy."
        : "Hosted review retention depends on the server's persistent-storage configuration.",
    uploadNotice: local
      ? `Files and review records are stored on ${storedAt}. AI-assisted mode also sends review content to the configured AI provider.`
      : renderFree
        ? "Files and review records use temporary server storage on this Render Free service, which has no persistent disk. They may be lost on spin-down, restart, or redeploy. AI-assisted mode also sends review content to the configured AI provider."
        : `Files and review records are stored on ${storedAt}. Retention depends on the server's persistent-storage configuration. AI-assisted mode also sends review content to the configured AI provider.`,
  };
}
