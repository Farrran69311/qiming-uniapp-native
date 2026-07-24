interface AssistantApiEnvelope {
  code?: unknown;
  msg?: unknown;
  success?: unknown;
  data?: unknown;
}

export interface AssistantResponseValidationOptions {
  requireAccepted?: boolean;
  requireList?: boolean;
  requireResource?: boolean;
  requireTask?: boolean;
  requireTrace?: boolean;
}

export class AssistantResponseError extends Error {
  code?: number | string;

  constructor(message: string, code?: number | string) {
    super(message);
    this.name = "AssistantResponseError";
    this.code = code;
  }
}

const failureStatuses = new Set([
  "error",
  "failed",
  "failure",
  "denied",
  "not_accepted"
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const responseMessage = (
  response: AssistantApiEnvelope,
  data: Record<string, unknown> | undefined,
  fallback: string
) => {
  for (const value of [response.msg, data?.message]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
};

export function unwrapAssistantResponseData<T>(
  response: unknown,
  operationName: string,
  options: AssistantResponseValidationOptions = {}
): T {
  if (!isRecord(response)) {
    throw new AssistantResponseError(`${operationName}返回格式异常`);
  }

  const envelope = response as AssistantApiEnvelope;
  const rawCode = envelope.code;
  const errorCode =
    typeof rawCode === "number" || typeof rawCode === "string"
      ? rawCode
      : undefined;
  const code =
    typeof rawCode === "number"
      ? rawCode
      : typeof rawCode === "string" && rawCode.trim()
        ? Number(rawCode)
        : Number.NaN;
  const data = isRecord(envelope.data) ? envelope.data : undefined;

  if (
    !Number.isFinite(code) ||
    (code !== 0 && code !== 200) ||
    envelope.success === false
  ) {
    throw new AssistantResponseError(
      responseMessage(envelope, data, `${operationName}失败`),
      errorCode
    );
  }

  if (!data) {
    throw new AssistantResponseError(`${operationName}返回格式异常`, errorCode);
  }

  const status =
    typeof data.status === "string" ? data.status.trim().toLowerCase() : "";
  if (!status) {
    throw new AssistantResponseError(`${operationName}返回格式异常`, errorCode);
  }
  if (failureStatuses.has(status) || data.success === false) {
    throw new AssistantResponseError(
      responseMessage(envelope, data, `${operationName}失败`),
      errorCode
    );
  }

  if (options.requireAccepted && data.accepted !== true) {
    throw new AssistantResponseError(
      responseMessage(envelope, data, `${operationName}未被服务端接受`),
      errorCode
    );
  }

  if (options.requireList && !Array.isArray(data.list)) {
    throw new AssistantResponseError(`${operationName}返回格式异常`, errorCode);
  }

  if (options.requireResource) {
    const resource = isRecord(data.resource) ? data.resource : undefined;
    if (
      !resource ||
      typeof resource.resource_id !== "string" ||
      !resource.resource_id.trim()
    ) {
      throw new AssistantResponseError(
        `${operationName}返回格式异常`,
        errorCode
      );
    }
  }

  if (options.requireTask) {
    const task = isRecord(data.task) ? data.task : undefined;
    if (!task || typeof task.task_id !== "string" || !task.task_id.trim()) {
      throw new AssistantResponseError(
        `${operationName}返回格式异常`,
        errorCode
      );
    }
  }

  if (options.requireTrace && !Array.isArray(data.trace)) {
    throw new AssistantResponseError(`${operationName}返回格式异常`, errorCode);
  }

  return data as T;
}
