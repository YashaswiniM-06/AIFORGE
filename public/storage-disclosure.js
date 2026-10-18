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
  const storedAt = local ? "this computer" : "the server running PackSignal";

  return {
    workspaceLabel: local ? "Local workspace" : "Hosted workspace",
    storageLabel: local
      ? "Stored on this computer"
      : "Stored on the server running PackSignal",
    uploadNotice: `Files and review records are stored on ${storedAt}. AI-assisted mode also sends review content to the configured AI provider.`,
  };
}
