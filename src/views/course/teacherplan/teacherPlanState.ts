import type {
  TeacherPlan,
  TeacherPlanAvailability,
  TeacherPlanProgress,
  TeacherPlanStatus
} from "../../../api/course";

const TERMINAL_STATUSES = new Set<TeacherPlanStatus>([
  "completed",
  "failed",
  "cancelled",
  "timed_out"
]);

const VALID_AVAILABILITIES = new Set<TeacherPlanAvailability>([
  "synced",
  "stale",
  "unavailable",
  "not_found"
]);

const STATUS_ALIASES: Record<string, TeacherPlanStatus> = {
  created: "pending",
  queued: "pending",
  submitting: "pending",
  pending: "pending",
  processing: "processing",
  running: "processing",
  downloading: "processing",
  completed: "completed",
  succeeded: "completed",
  failed: "failed",
  cancelled: "cancelled",
  canceled: "cancelled",
  timed_out: "timed_out",
  timeout: "timed_out"
};

const POLL_DELAYS_MS = [2000, 3000, 5000, 10000, 15000];
const ACTIVE_POLLERS = new Map<number, () => void>();

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeTeacherPlanStatus(
  value: unknown,
  legacyProgress?: unknown
): TeacherPlanStatus {
  const normalized = text(value).toLowerCase();
  if (STATUS_ALIASES[normalized]) return STATUS_ALIASES[normalized];

  const legacy = finiteNumber(legacyProgress);
  if (legacy === 2) return "completed";
  if (legacy === 3) return "failed";
  if (legacy === 1) return "processing";
  return "unknown";
}

export function normalizeTeacherPlanAvailability(
  value: unknown,
  status: TeacherPlanStatus
): TeacherPlanAvailability {
  const normalized = text(value).toLowerCase() as TeacherPlanAvailability;
  if (VALID_AVAILABILITIES.has(normalized)) return normalized;
  return status === "unknown" ? "unavailable" : "stale";
}

export function clampTeacherPlanProgress(
  value: unknown,
  status: TeacherPlanStatus
): number {
  if (status === "completed") return 100;
  const number = finiteNumber(value);
  if (number === null) return 0;
  return Math.min(100, Math.max(0, number));
}

export function legacyProgressForTeacherPlanStatus(
  status: TeacherPlanStatus,
  availability: TeacherPlanAvailability
): number {
  if (status === "completed") return 2;
  if (TERMINAL_STATUSES.has(status)) return 3;
  if (availability === "unavailable" || availability === "not_found") return 0;
  return 1;
}

export function normalizeTeacherPlan(raw: any): TeacherPlan {
  const value = raw || {};
  const status = normalizeTeacherPlanStatus(value.status, value.progress);
  const availability = normalizeTeacherPlanAvailability(
    value.availability,
    status
  );

  return {
    teacherPlanId: finiteNumber(value.teacherPlanId) ?? 0,
    courseId: finiteNumber(value.courseId) ?? 0,
    chapterId: finiteNumber(value.chapterId) ?? 0,
    courseName: text(value.courseName),
    chapterName: text(value.chapterName),
    taskId: text(value.taskId),
    status,
    progressPercent: clampTeacherPlanProgress(value.progressPercent, status),
    stage: text(value.stage),
    message: text(value.message),
    errorCode: text(value.errorCode),
    retryable: value.retryable === true,
    downloadUrl: text(value.downloadUrl),
    availability,
    updatedAt: text(value.updatedAt),
    createdAt: text(value.createdAt)
  };
}

export function normalizeTeacherPlanProgress(
  raw: any,
  fallback: Partial<TeacherPlanProgress> = {}
): TeacherPlanProgress {
  const value = raw || {};
  const status = normalizeTeacherPlanStatus(
    value.status ?? fallback.status,
    value.progress ?? fallback.progress
  );
  const availability = normalizeTeacherPlanAvailability(
    value.availability ?? fallback.availability,
    status
  );

  return {
    progress:
      finiteNumber(value.progress) ??
      legacyProgressForTeacherPlanStatus(status, availability),
    taskId: text(value.taskId ?? fallback.taskId),
    status,
    progressPercent: clampTeacherPlanProgress(
      value.progressPercent ?? fallback.progressPercent,
      status
    ),
    stage: text(value.stage ?? fallback.stage),
    message: text(value.message ?? fallback.message),
    errorCode: text(value.errorCode ?? fallback.errorCode),
    retryable:
      value.retryable === true ||
      (value.retryable === undefined && fallback.retryable === true),
    requestId: text(value.requestId ?? fallback.requestId ?? value.taskId),
    availability,
    updatedAt: text(value.updatedAt ?? fallback.updatedAt),
    downloadUrl: text(value.downloadUrl ?? fallback.downloadUrl)
  };
}

export function teacherPlanProgressFromPlan(
  plan: TeacherPlan
): TeacherPlanProgress {
  return normalizeTeacherPlanProgress({
    progress: legacyProgressForTeacherPlanStatus(
      plan.status,
      plan.availability
    ),
    taskId: plan.taskId,
    status: plan.status,
    progressPercent: plan.progressPercent,
    stage: plan.stage,
    message: plan.message,
    errorCode: plan.errorCode,
    retryable: plan.retryable,
    requestId: plan.taskId,
    availability: plan.availability,
    updatedAt: plan.updatedAt,
    downloadUrl: plan.downloadUrl
  });
}

export function mergeTeacherPlanProgress(
  plan: TeacherPlan,
  progress: TeacherPlanProgress
): TeacherPlan {
  return normalizeTeacherPlan({
    ...plan,
    ...progress,
    teacherPlanId: plan.teacherPlanId,
    courseId: plan.courseId,
    chapterId: plan.chapterId,
    courseName: plan.courseName,
    chapterName: plan.chapterName,
    updatedAt: progress.updatedAt || plan.updatedAt,
    createdAt: plan.createdAt
  });
}

export function isTeacherPlanTerminal(status: TeacherPlanStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function canPollTeacherPlan(state: {
  status: TeacherPlanStatus;
  availability: TeacherPlanAvailability;
}): boolean {
  return (
    !isTeacherPlanTerminal(state.status) &&
    state.availability !== "unavailable" &&
    state.availability !== "not_found"
  );
}

export function canDownloadTeacherPlan(state: {
  status: TeacherPlanStatus;
  downloadUrl?: string;
}): boolean {
  return state.status === "completed" && Boolean(text(state.downloadUrl));
}

export function teacherPlanStateSignature(state: {
  status: TeacherPlanStatus;
  progressPercent: number;
  stage: string;
  availability: TeacherPlanAvailability;
  updatedAt: string;
}): string {
  return [
    state.status,
    state.progressPercent,
    state.stage,
    state.availability,
    state.updatedAt
  ].join("|");
}

export function isTeacherPlanStateChanged(
  previous: string,
  state: Parameters<typeof teacherPlanStateSignature>[0]
): boolean {
  return previous !== teacherPlanStateSignature(state);
}

/**
 * Returns the next delay without making normal polling time-dependent. A small
 * jitter is applied only after transport failures to avoid synchronized retry bursts.
 */
export function getTeacherPlanPollDelay(
  unchangedPolls = 0,
  networkErrors = 0,
  random = 0.5
): number {
  const index = Math.min(
    Math.max(Math.trunc(unchangedPolls), 0),
    POLL_DELAYS_MS.length - 1
  );
  const base =
    networkErrors > 0
      ? Math.min(15000, 2000 * 2 ** Math.min(networkErrors - 1, 3))
      : POLL_DELAYS_MS[index];
  if (networkErrors <= 0) return base;
  const safeRandom = Math.min(1, Math.max(0, Number(random) || 0));
  return Math.round(base * (0.9 + safeRandom * 0.2));
}

/** Ensures that one teacher plan has at most one active poller per browser bundle. */
export function claimTeacherPlanPoller(
  teacherPlanId: number,
  stop: () => void
): () => void {
  const previousStop = ACTIVE_POLLERS.get(teacherPlanId);
  if (previousStop && previousStop !== stop) previousStop();
  ACTIVE_POLLERS.set(teacherPlanId, stop);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (ACTIVE_POLLERS.get(teacherPlanId) === stop) {
      ACTIVE_POLLERS.delete(teacherPlanId);
    }
  };
}
