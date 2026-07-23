export type HtmlAnimationScopeType = "chapter" | "hour";

export interface HtmlAnimationScope {
  courseId: number;
  chapterId: number;
  scopeType: HtmlAnimationScopeType;
  hourId?: number;
}

export interface HtmlAnimationScopeRequest {
  courseId: number;
  chapterId: number;
  scopeType?: HtmlAnimationScopeType;
  hourId?: number;
}

export const HTML_ANIMATION_BATCH_LIMIT = 10;

export function chunkHtmlAnimationBatchItems<T>(
  items: readonly T[],
  limit = HTML_ANIMATION_BATCH_LIMIT
): T[][] {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("HTML 动画批量大小必须为正整数");
  }
  const chunks: T[][] = [];
  for (let offset = 0; offset < items.length; offset += limit) {
    chunks.push(items.slice(offset, offset + limit));
  }
  return chunks;
}

/**
 * Expands a chapter overview into the chapter scope plus every known hour
 * scope. The list is intentionally not capped; only batch submission has the
 * backend's ten-item limit.
 */
export function expandHtmlAnimationListScopes(
  request: HtmlAnimationScopeRequest,
  hourIds: readonly number[]
): HtmlAnimationScope[] {
  const scope = normalizeHtmlAnimationScope(request);
  if (scope.scopeType === "hour") return [scope];
  const uniqueHourIds = [...new Set(hourIds.map(Number))].filter(
    hourId => Number.isInteger(hourId) && hourId > 0
  );
  return [
    scope,
    ...uniqueHourIds.map(hourId => ({
      courseId: scope.courseId,
      chapterId: scope.chapterId,
      scopeType: "hour" as const,
      hourId
    }))
  ];
}

export function normalizeHtmlAnimationScope(
  request: HtmlAnimationScopeRequest
): HtmlAnimationScope {
  const courseId = Number(request.courseId);
  const chapterId = Number(request.chapterId);
  const scopeType = request.scopeType || "chapter";
  const hourId = Number(request.hourId || 0);

  if (courseId <= 0 || chapterId <= 0) {
    throw new Error("课程和章节 ID 必须为正数");
  }
  if (scopeType === "hour" && hourId <= 0) {
    throw new Error("课时范围必须提供有效的 hourId");
  }
  if (scopeType === "chapter" && hourId > 0) {
    throw new Error("章节范围不能携带 hourId");
  }

  return scopeType === "hour"
    ? { courseId, chapterId, scopeType, hourId }
    : { courseId, chapterId, scopeType };
}

export function htmlAnimationScopeKey(scope: HtmlAnimationScopeRequest) {
  const normalized = normalizeHtmlAnimationScope(scope);
  return [
    normalized.courseId,
    normalized.chapterId,
    normalized.scopeType,
    normalized.hourId || 0
  ].join(":");
}

export function matchesHtmlAnimationScope(
  expected: HtmlAnimationScopeRequest,
  actual: HtmlAnimationScopeRequest | null | undefined
): boolean {
  if (!actual) return false;
  try {
    return htmlAnimationScopeKey(expected) === htmlAnimationScopeKey(actual);
  } catch {
    return false;
  }
}

export function createHtmlAnimationIdempotencyKey(
  scope: HtmlAnimationScopeRequest,
  intentId = Date.now().toString(36)
) {
  return `html-animation:${htmlAnimationScopeKey(scope)}:${intentId}`;
}

interface HtmlAnimationTaskState {
  status?: string;
  version?: number;
  fileUrl?: string;
  errorCode?: string;
}

const PROCESSING_STATUSES = new Set([
  "pending",
  "submitted",
  "processing",
  "queued",
  "running",
  "in_progress",
  "generating"
]);

const COMPLETED_STATUSES = new Set([
  "completed",
  "success",
  "succeeded",
  "done",
  "finished"
]);

const FAILED_STATUSES = new Set([
  "failed",
  "failure",
  "error",
  "cancelled",
  "canceled"
]);

export function normalizeHtmlAnimationTaskStatus(
  task?: HtmlAnimationTaskState | null
) {
  const rawStatus = String(task?.status || "")
    .trim()
    .toLowerCase();
  const hasPreviewableArtifact =
    Number(task?.version || 0) > 0 && Boolean(task?.fileUrl);

  if (task?.errorCode || FAILED_STATUSES.has(rawStatus)) return "failed";

  if (COMPLETED_STATUSES.has(rawStatus)) {
    return hasPreviewableArtifact ? "completed" : "failed";
  }

  if (hasPreviewableArtifact) return "completed";
  if (PROCESSING_STATUSES.has(rawStatus) || !rawStatus) return "processing";
  return rawStatus;
}
