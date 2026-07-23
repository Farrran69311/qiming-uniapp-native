import { http } from "@/utils/http";
import {
  HTML_ANIMATION_BATCH_LIMIT,
  normalizeHtmlAnimationScope,
  normalizeHtmlAnimationTaskStatus,
  type HtmlAnimationScopeRequest,
  type HtmlAnimationScopeType
} from "./htmlAnimationScope";

export {
  chunkHtmlAnimationBatchItems,
  createHtmlAnimationIdempotencyKey,
  HTML_ANIMATION_BATCH_LIMIT,
  expandHtmlAnimationListScopes,
  htmlAnimationScopeKey,
  matchesHtmlAnimationScope,
  normalizeHtmlAnimationScope,
  normalizeHtmlAnimationTaskStatus
} from "./htmlAnimationScope";
export type {
  HtmlAnimationScope,
  HtmlAnimationScopeRequest,
  HtmlAnimationScopeType
} from "./htmlAnimationScope";

export interface HtmlAnimationTask {
  taskId: string;
  scopeType: HtmlAnimationScopeType;
  hourId?: number;
  status: string;
  version: number;
  fileName: string;
  objectName: string;
  fileUrl?: string;
  coverName?: string;
  coverObject?: string;
  coverUrl?: string;
  fileSize: number;
  errorMessage?: string;
  errorCode?: string;
  errorStage?: string;
  requestId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string;
}

export interface HtmlAnimationListResult {
  courseId: number;
  chapterId: number;
  scopeType: HtmlAnimationScopeType;
  hourId?: number;
  tasks: HtmlAnimationTask[];
  displayVersionRaw: string;
  displayVersionResolved: string;
}

export interface HtmlAnimationGenerateResult {
  courseId: number;
  chapterId: number;
  scopeType: HtmlAnimationScopeType;
  hourId?: number;
  taskId: string;
  status: string;
  message: string;
  reused: boolean;
}

export interface HtmlAnimationReadinessResult {
  ready: boolean;
  code:
    | "READY"
    | "CONTENT_NOT_CURATED"
    | "CONTENT_MISSING"
    | "SEARCH_UNAVAILABLE"
    | string;
  message: string;
  retryable: boolean;
  courseId: number;
  chapterId: number;
  scopeType: HtmlAnimationScopeType;
  hourId?: number;
  availableDocuments: number;
  rawDocuments: number;
}

export interface HtmlAnimationBatchRequest extends HtmlAnimationScopeRequest {
  idempotencyKey?: string;
}

export interface HtmlAnimationBatchItem {
  courseId: number;
  chapterId: number;
  scopeType: HtmlAnimationScopeType;
  hourId?: number;
  taskId?: string;
  status: string;
  action: "accepted" | "reused" | "rejected" | string;
  errorCode?: string;
  retryable: boolean;
  errorMessage?: string;
}

export interface HtmlAnimationBatchResult {
  total: number;
  successful: number;
  failed: number;
  items: HtmlAnimationBatchItem[];
}

export interface HtmlAnimationSyncResult {
  totalChapters: number;
  successChapters: number;
}

export interface HtmlAnimationDisplayResult {
  courseId: number;
  chapterId: number;
  scopeType: HtmlAnimationScopeType;
  hourId?: number;
  available?: boolean;
  message?: string;
  version: string;
  url: string;
  coverUrl?: string;
  previewUrl?: string;
  previewVideoUrl?: string;
}

export interface ApiResponse<T = any> {
  code: number;
  msg: string;
  data: T;
}

export function normalizeHtmlAnimationTask(task: HtmlAnimationTask) {
  return {
    ...task,
    scopeType: task.scopeType || "chapter",
    status: normalizeHtmlAnimationTaskStatus(task)
  };
}

export const generateHtmlAnimation = (
  data: HtmlAnimationScopeRequest & { idempotencyKey?: string }
) => {
  const scope = normalizeHtmlAnimationScope(data);
  return http.request<ApiResponse<HtmlAnimationGenerateResult>>(
    "post",
    "/edu/v1/html-animation/generate",
    {
      data: {
        ...scope,
        ...(data.idempotencyKey ? { idempotencyKey: data.idempotencyKey } : {})
      }
    }
  );
};

export const getHtmlAnimationReadiness = (
  params: HtmlAnimationScopeRequest
) => {
  const scope = normalizeHtmlAnimationScope(params);
  return http.request<ApiResponse<HtmlAnimationReadinessResult>>(
    "get",
    "/edu/v1/html-animation/readiness",
    { params: scope }
  );
};

export const batchGenerateHtmlAnimation = (data: {
  requests: HtmlAnimationBatchRequest[];
}) => {
  if (
    !Array.isArray(data.requests) ||
    data.requests.length < 1 ||
    data.requests.length > HTML_ANIMATION_BATCH_LIMIT
  ) {
    throw new Error("批量生成一次只能提交 1 到 10 个范围");
  }
  const requests = data.requests.map(item => {
    const scope = normalizeHtmlAnimationScope(item);
    return {
      ...scope,
      ...(item.idempotencyKey ? { idempotencyKey: item.idempotencyKey } : {})
    };
  });
  return http.request<ApiResponse<HtmlAnimationBatchResult>>(
    "post",
    "/edu/v1/html-animation/batch-generate",
    { data: { requests } }
  );
};

export const getHtmlAnimationList = (params: HtmlAnimationScopeRequest) => {
  const scope = normalizeHtmlAnimationScope(params);
  return http.request<ApiResponse<HtmlAnimationListResult>>(
    "get",
    "/edu/v1/html-animation/list",
    { params: scope }
  );
};

export const setHtmlAnimationDisplay = (
  data: HtmlAnimationScopeRequest & {
    version: string;
  }
) => {
  const scope = normalizeHtmlAnimationScope(data);
  return http.request<ApiResponse>(
    "post",
    "/edu/v1/html-animation/display/set",
    { data: { ...scope, version: data.version } }
  );
};

export const forceSyncHtmlAnimation = () => {
  return http.request<ApiResponse<HtmlAnimationSyncResult>>(
    "post",
    "/edu/v1/html-animation/sync",
    { data: {} }
  );
};

export const getHtmlAnimationDisplay = (params: HtmlAnimationScopeRequest) => {
  const scope = normalizeHtmlAnimationScope(params);
  return http.request<ApiResponse<HtmlAnimationDisplayResult>>(
    "get",
    "/edu/v1/html-animation/display",
    { params: scope }
  );
};
