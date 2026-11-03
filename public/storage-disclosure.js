export function storageDisclosure(hostname = "", storage = {}) {
  const host = String(hostname)
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  const local =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".localhost");
  const storedAt = local ? "this computer" : "the server running PackSignal";
  const persistent = !local && storage.persistent === true;

  return {
    workspaceLabel: local ? "Local workspace" : "Hosted workspace",
    storageLabel: local
      ? "Stored on this computer"
      : persistent
        ? "Persistent service disk"
        : "Server storage · retention depends on setup",
    historyNotice: local
      ? "Saved on this computer with source files and decision history."
      : persistent
        ? "Reviews are saved on the configured persistent service disk. Backup and retention still follow the hosting provider's policy."
        : "Hosted review retention depends on the server's persistent-storage configuration.",
    uploadNotice: local
      ? `Files and review records are stored on ${storedAt}. AI-assisted mode also sends review content to the configured AI provider.`
      : persistent
        ? `Files and review records are stored on the configured persistent service disk. Backup and retention follow the hosting provider's policy. AI-assisted mode also sends review content to the configured AI provider.`
        : `Files and review records are stored on ${storedAt}. Retention depends on the server's persistent-storage configuration. AI-assisted mode also sends review content to the configured AI provider.`,
  };
}
