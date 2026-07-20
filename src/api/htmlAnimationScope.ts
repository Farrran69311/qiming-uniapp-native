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
