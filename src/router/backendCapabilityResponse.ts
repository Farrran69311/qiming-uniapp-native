export class BackendCapabilityResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackendCapabilityResponseError";
  }
}

export function assertCapabilityProbeSucceeded(response: unknown): void {
  if (!response || typeof response !== "object") {
    throw new BackendCapabilityResponseError("服务能力检查返回了无效响应");
  }

  const envelope = response as {
    code?: unknown;
    success?: unknown;
    msg?: unknown;
  };
  if (Object.prototype.hasOwnProperty.call(envelope, "code")) {
    const code =
      typeof envelope.code === "number"
        ? envelope.code
        : typeof envelope.code === "string" && envelope.code.trim()
          ? Number(envelope.code)
          : Number.NaN;
    if (!Number.isFinite(code) || (code !== 0 && code !== 200)) {
      throw new BackendCapabilityResponseError(
        typeof envelope.msg === "string" && envelope.msg.trim()
          ? envelope.msg.trim()
          : "服务能力检查未通过"
      );
    }
  }

  if (envelope.success === false) {
    throw new BackendCapabilityResponseError(
      typeof envelope.msg === "string" && envelope.msg.trim()
        ? envelope.msg.trim()
        : "服务能力检查未通过"
    );
  }
}
