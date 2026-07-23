export const explanationImageTerminalStatuses = new Set<string>([
  "succeeded",
  "failed",
  "blocked",
  "unknown_outcome",
  "cancelled"
]);

/**
 * Poll responses are authoritative, but an older response must not move a
 * task backwards. `retrying -> generating` is the one intentional non-linear
 * transition in the worker state machine.
 */
export const shouldApplyExplanationImageUpdate = (
  currentStatus: string,
  incomingStatus: string
) => {
  const current = String(currentStatus || "").toLowerCase();
  const incoming = String(incomingStatus || "").toLowerCase();
  if (!current || current === incoming) return true;
  if (explanationImageTerminalStatuses.has(current)) return false;
  if (explanationImageTerminalStatuses.has(incoming)) return true;
  if (incoming === "queued") return current === "queued";
  return true;
};
