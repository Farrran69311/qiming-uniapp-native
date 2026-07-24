/**
 * 课程讨论区管理端API
 * 对应后端接口文档:doc/backend/course-discussion-api.md
 * 供教师端和管理员端使用
 */

import { http } from "@/utils/http";
import { getUserList } from "./user";

//==================== 用户头像缓存 ====================

/** 用户头像缓存 */
const userAvatarCache = new Map<number, string>();

/**
 * 获取用户头像映射
 * @param userIds 用户 ID 列表
 * @returns 用户 ID 到头像的映射
 */
export async function getUserAvatars(
  userIds: number[]
): Promise<Map<number, string>> {
  // 过滤出缓存中没有的用户 ID
  const uncachedIds = userIds.filter(id => !userAvatarCache.has(id));

  if (uncachedIds.length > 0) {
    try {
      // 获取用户列表（设置较大的 pageSize 以获取更多用户）
      const res = await getUserList({ pageNum: 1, pageSize: 1000 });
      // 兼容后端返回格式：{ code, msg, data: { total, userList } }
      const responseData = (res as any)?.data || res;
      const userList = responseData?.userList || [];

      // 更新缓存
      for (const user of userList) {
        userAvatarCache.set(user.id, user.avatar || "");
      }
    } catch (error) {
      console.error("获取用户列表失败:", error);
    }
  }

  // 返回请求的用户头像
  const result = new Map<number, string>();
  for (const id of userIds) {
    result.set(id, userAvatarCache.get(id) || "");
  }
  return result;
}
import type { DiscussionPost, Pagination, PostStatus } from "./discussion";

//==================== 后端返回类型定义 ====================

/** 后端通用返回结构 */
export interface CommonResponse<T = unknown> {
  code: number | string;
  msg?: string;
  message?: string;
  data?: T | null;
}

type MaybeWrappedResponse<T> = CommonResponse<T> | T;

export class DiscussionAdminResponseError extends Error {
  code?: number | string;

  constructor(message: string, code?: number | string) {
    super(message);
    this.name = "DiscussionAdminResponseError";
    this.code = code;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const hasOwn = (value: object, key: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(value, key);

const responseErrorMessage = (
  response: Record<string, unknown>,
  fallback: string
) => {
  const message = response.msg ?? response.message;
  return typeof message === "string" && message.trim()
    ? message.trim()
    : fallback;
};

/** Validate legacy business envelopes while retaining support for bare payloads. */
export function assertSuccessfulDiscussionAdminResponse(
  response: unknown,
  operationName: string
): void {
  if (!isRecord(response)) return;

  const responseData = isRecord(response.data) ? response.data : undefined;
  if (response.success === false || responseData?.success === false) {
    throw new DiscussionAdminResponseError(
      responseErrorMessage(
        responseData || response,
        responseErrorMessage(response, `${operationName}失败`)
      )
    );
  }

  if (!hasOwn(response, "code")) return;

  const rawCode = response.code;
  const code =
    typeof rawCode === "number"
      ? rawCode
      : typeof rawCode === "string" && rawCode.trim()
        ? Number(rawCode)
        : Number.NaN;

  if (!Number.isFinite(code) || (code !== 0 && code !== 200)) {
    throw new DiscussionAdminResponseError(
      responseErrorMessage(response, `${operationName}失败`),
      typeof rawCode === "number" || typeof rawCode === "string"
        ? rawCode
        : undefined
    );
  }
}

export function unwrapResponseData<T>(
  response: MaybeWrappedResponse<T>,
  resourceName = "数据"
): T {
  assertSuccessfulDiscussionAdminResponse(response, resourceName);

  if (isRecord(response) && hasOwn(response, "code")) {
    if (!hasOwn(response, "data") || response.data == null) {
      throw new DiscussionAdminResponseError(`${resourceName}返回格式异常`);
    }
    return response.data as T;
  }

  return response as T;
}

function assertListPayload<T>(
  payload: unknown,
  resourceName: string
): asserts payload is { total: number; list: T[] } {
  if (
    !isRecord(payload) ||
    typeof payload.total !== "number" ||
    !Number.isFinite(payload.total) ||
    payload.total < 0 ||
    !Array.isArray(payload.list)
  ) {
    throw new DiscussionAdminResponseError(`${resourceName}返回格式异常`);
  }
}

function unwrapListResponse<T>(
  response: MaybeWrappedResponse<{ total: number; list: T[] }>,
  resourceName: string
) {
  const payload = unwrapResponseData(response, resourceName);
  assertListPayload<T>(payload, resourceName);
  return payload;
}

function assertFiniteNumberFields(
  payload: Record<string, unknown>,
  fields: string[],
  resourceName: string
) {
  if (
    fields.some(
      field =>
        typeof payload[field] !== "number" ||
        !Number.isFinite(payload[field] as number)
    )
  ) {
    throw new DiscussionAdminResponseError(`${resourceName}返回格式异常`);
  }
}

function validateMutationResponse(response: unknown, operationName: string) {
  assertSuccessfulDiscussionAdminResponse(response, operationName);
}

/** 后端返回的帖子列表项 */
interface BackendPostListItem {
  postId: number;
  title: string;
  content: string;
  authorId: number;
  authorName: string;
  authorAvatar: string;
  tags: string[];
  likeCount: number;
  replyCount: number;
  viewCount: number;
  isPinned: boolean;
  isLiked: boolean;
  createTime: string;
}

/** 后端返回的列表响应 */
interface BackendListResponse {
  total: number;
  list: BackendPostListItem[];
}

/** 后端返回的帖子详情 */
interface BackendPostDetail {
  postId: number;
  courseId: string;
  courseName: string;
  title: string;
  content: string;
  contentHtml: string;
  authorId: number;
  authorName: string;
  authorAvatar: string;
  tags: string[];
  likeCount: number;
  replyCount: number;
  viewCount: number;
  isPinned: boolean;
  isLiked: boolean;
  isOwner: boolean;
  createTime: string;
  editedAt?: string;
}

// ==================== 类型定义 ====================

/** 举报状态 */
export type ReportStatus = "pending" | "accepted" | "rejected";

/** 举报记录 */
export interface ReportItem {
  reportId: number;
  targetType: "post" | "reply";
  targetId: number;
  targetContent: string;
  reporterId: number;
  reporterName: string;
  reason: string;
  description: string;
  status: ReportStatus;
  createTime: string;
}

/** 举报列表响应结构 */
export interface ReportListResponse {
  total: number;
  list: ReportItem[];
}

/** 举报统计 */
export interface ReportStatistics {
  totalReports: number;
  pendingReports: number;
  resolvedToday: number;
}

/** 处理举报请求 */
export interface HandleReportRequest {
  action: "accept" | "reject";
  note?: string;
}

/** 审核队列项（扩展帖子信息） */
export interface ReviewQueueItem extends DiscussionPost {
  riskLevel?: "low" | "medium" | "high" | "critical";
  matchedWords?: string[];
  priority?: "high" | "medium" | "low";
  courseName?: string;
  itemType?: "post" | "reply";
  postId?: number; // 回复所属的帖子ID
}

/** 待审核项（后端返回格式） */
export interface PendingItem {
  id: number;
  type: "post" | "reply";
  courseId: string | number;
  courseName: string;
  postId?: number;
  postTitle?: string;
  content: string;
  authorId: number;
  authorName: string;
  authorAvatar?: string; // 用户头像
  createTime: string;
}

/** 待审核列表响应 */
export interface PendingListResponse {
  total: number;
  list: PendingItem[];
}

/** 待审核统计 */
export interface PendingStatistics {
  totalPosts: number;
  totalReplies: number;
  pendingPosts: number;
  pendingReplies: number;
  pendingTotal: number;
  todayPosts: number;
  courses: Array<{
    courseId: number;
    courseName: string;
    pendingPosts: number;
    pendingReplies: number;
    pendingTotal: number;
  }>;
}

export function mapPendingItemToReviewQueueItem(
  item: PendingItem,
  avatar?: string
): ReviewQueueItem {
  return {
    id: String(item.id),
    title: item.postTitle || (item.type === "reply" ? "[回复]" : ""),
    content: item.content,
    contentHtml: item.content,
    author: {
      id: String(item.authorId),
      name: item.authorName,
      avatar: avatar || item.authorAvatar || "",
      isTeacher: false,
      isAdmin: false
    },
    tags: [],
    status: "pending",
    isPinned:
      (item as any).isPinned === true ||
      (item as any).isPinned === 1 ||
      String((item as any).isPinned) === "true" ||
      String((item as any).isPinned) === "1",
    likeCount: 0,
    replyCount: 0,
    viewCount: 0,
    isLiked: false,
    createdAt: item.createTime,
    courseName: item.courseName,
    itemType: item.type,
    postId: item.postId
  };
}

/** 敏感词风险等级 (1-低, 2-中, 3-高) */
export type SensitiveWordLevel = number;

/**敏感词 */
export interface SensitiveWord {
  id: number;
  word: string;
  category: string;
  level: SensitiveWordLevel;
  replacement: string;
  isEnabled: boolean;
  hitCount: number;
  createTime: string;
  updateTime: string;
}

/** 用户信誉 */
export interface UserReputation {
  userId: number;
  nickname: string;
  avatar: string;
  reputationScore: number;
  level: "trusted" | "normal" | "restricted";
  postCount: number;
  replyCount: number;
  reportedCount: number;
  lastActiveAt: string;
}

/** 审计日志 */
export interface AuditLog {
  id: number;
  targetType: "post" | "reply" | "report";
  targetId: number;
  action: string;
  operatorId: number;
  operatorName: string;
  operatorRole: string;
  reason: string;
  previousStatus: string;
  newStatus: string;
  createTime: string;
}

/** 全局统计数据 */
export interface GlobalStatistics {
  totalPosts: number;
  totalReplies: number;
  totalLikes: number;
  pendingPosts: number;
  pendingReplies: number;
  pendingReports: number;
  activeUsers: number;
  todayPosts: number;
  todayReplies: number;
  trends?: {
    posts: Array<{ date: string; count: number }>;
    replies: Array<{ date: string; count: number }>;
  };
  topCourses?: Array<{
    courseId: number;
    courseName: string;
    postCount: number;
    replyCount: number;
  }>;
}

// ==================== 教师/管理员接口 ====================

/**
 * 获取审核队列
 * @param params 查询参数
 * @description 对应后端真实待审核接口，不补造后端未提供的风险指标
 */
export async function getReviewQueue(params?: {
  priority?: "high" | "medium" | "low";
  courseId?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  list: ReviewQueueItem[];
  stats: {
    pending: number;
    highPriority: number | null;
    avgWaitTime: string | null;
  };
}> {
  if (params?.priority) {
    throw new DiscussionAdminResponseError("后端暂不支持按优先级筛选");
  }

  const [pendingData, pendingStats] = await Promise.all([
    getPendingList({
      courseId: params?.courseId,
      type: "all",
      pageNum: params?.page || 1,
      pageSize: params?.pageSize || 20
    }),
    getPendingStatistics({ courseId: params?.courseId })
  ]);

  return {
    list: pendingData.list.map(item => mapPendingItemToReviewQueueItem(item)),
    stats: {
      pending: pendingStats.pendingTotal,
      highPriority: null,
      avgWaitTime: null
    }
  };
}

/**
 * 审核帖子
 * @param postId 帖子ID
 * @param data 审核数据
 */
export function reviewPost(
  postId: string | number,
  data: { action: "approve" | "reject"; reason?: string; note?: string }
) {
  const requestData = {
    action: data.action,
    reviewNote: data.note || data.reason
  };
  return http
    .request<unknown>("post", `/edu/backend/v1/discussions/${postId}/review`, {
      data: requestData
    })
    .then(response => validateMutationResponse(response, "审核帖子"));
}

/**
 * 审核回复
 * @param replyId 回复ID
 * @param data 审核数据
 */
export function reviewReply(
  replyId: string | number,
  data: { action: "approve" | "reject"; reason?: string; note?: string }
) {
  const requestData = {
    action: data.action,
    reviewNote: data.note || data.reason
  };
  return http
    .request<unknown>(
      "post",
      `/edu/backend/v1/discussions/replies/${replyId}/review`,
      { data: requestData }
    )
    .then(response => validateMutationResponse(response, "审核回复"));
}

/**
 * 置顶帖子
 * @param postId 帖子ID
 */
export function pinPost(postId: string | number) {
  return http
    .request<unknown>("post", `/edu/backend/v1/discussions/${postId}/pin`)
    .then(response => validateMutationResponse(response, "置顶帖子"));
}

/**
 * 取消置顶
 * @param postId 帖子ID
 */
export function unpinPost(postId: string | number) {
  return http
    .request<unknown>("delete", `/edu/backend/v1/discussions/${postId}/pin`, {
      params: { _t: Date.now() }
    })
    .then(response => validateMutationResponse(response, "取消置顶"));
}

/**
 * 强制删除帖子
 * @param postId 帖子ID
 * @param reason 删除原因
 */
export function forceDeletePost(postId: string | number, reason?: string) {
  return http
    .request<unknown>("delete", `/edu/backend/v1/discussions/${postId}/force`, {
      data: { reason }
    })
    .then(response => validateMutationResponse(response, "删除帖子"));
}

/**
 * 强制删除回复
 * @param replyId 回复ID
 * @param reason 删除原因
 */
export function forceDeleteReply(replyId: string | number, reason?: string) {
  return http
    .request<unknown>(
      "delete",
      `/edu/backend/v1/discussions/replies/${replyId}/force`,
      { data: { reason } }
    )
    .then(response => validateMutationResponse(response, "删除回复"));
}

/**
 * 批量审核
 * @param data 批量审核数据
 */
export function batchReview(data: {
  postIds: string[];
  action: "approve" | "reject";
  note?: string;
}) {
  type BatchReviewResult = {
    success: number;
    failed: number;
    results: Array<{ postId: string; success: boolean; error?: string }>;
  };
  return http
    .request<
      MaybeWrappedResponse<BatchReviewResult>
    >("post", "/edu/backend/v1/discussions/batch-review", { data })
    .then(response => unwrapResponseData(response, "批量审核"));
}

/**
 * 批量删除
 * @param data 批量删除数据
 */
export function batchDelete(data: { postIds: string[]; reason?: string }) {
  return http
    .request<
      MaybeWrappedResponse<{ success: number; failed: number }>
    >("post", "/edu/backend/v1/discussions/batch-delete", { data })
    .then(response => unwrapResponseData(response, "批量删除"));
}

/**
 * 获取举报列表
 * GET /edu/backend/v1/discussions/reports
 */
export function getReportList(params: {
  status?: ReportStatus;
  pageNum: number;
  pageSize?: number;
}): Promise<ReportListResponse> {
  return http
    .request<
      MaybeWrappedResponse<ReportListResponse>
    >("get", "/edu/backend/v1/discussions/reports", { params })
    .then(response => unwrapListResponse<ReportItem>(response, "举报列表"));
}

/**
 * 获取举报统计
 * GET /edu/backend/v1/discussions/reports/statistics
 */
export function getReportStatistics(): Promise<ReportStatistics> {
  return http
    .request<
      MaybeWrappedResponse<ReportStatistics>
    >("get", "/edu/backend/v1/discussions/reports/statistics")
    .then(response => {
      const payload = unwrapResponseData(response, "举报统计");
      if (!isRecord(payload)) {
        throw new DiscussionAdminResponseError("举报统计返回格式异常");
      }
      assertFiniteNumberFields(
        payload,
        ["totalReports", "pendingReports", "resolvedToday"],
        "举报统计"
      );
      return payload as unknown as ReportStatistics;
    });
}

/**
 * 处理举报
 * POST /edu/backend/v1/discussions/reports/{reportId}/handle
 */
export function handleReport(reportId: number, data: HandleReportRequest) {
  return http
    .request<unknown>(
      "post",
      `/edu/backend/v1/discussions/reports/${reportId}/handle`,
      { data }
    )
    .then(response => validateMutationResponse(response, "处理举报"));
}

// ==================== 管理员专属接口 ====================

/**
 * 获取敏感词列表
 * @param params 查询参数
 */
export function getSensitiveWords(params: {
  category?: string;
  level?: number;
  isEnabled?: number; // -1表示全部, 0/1
  keyword?: string;
  pageNum: number;
  pageSize?: number;
}): Promise<{ total: number; list: SensitiveWord[] }> {
  return http
    .request<
      MaybeWrappedResponse<{ total: number; list: SensitiveWord[] }>
    >("get", "/edu/backend/v1/admin/sensitive-words", { params })
    .then(response =>
      unwrapListResponse<SensitiveWord>(response, "敏感词列表")
    );
}

/**
 * 添加敏感词
 * @param data 敏感词数据
 */
export function addSensitiveWord(data: {
  word: string;
  category?: string;
  level?: number;
  replacement?: string;
}): Promise<{ id: number }> {
  return http
    .request<
      MaybeWrappedResponse<{ id: number }>
    >("post", "/edu/backend/v1/admin/sensitive-words", { data })
    .then(response => {
      const payload = unwrapResponseData(response, "添加敏感词");
      if (
        !isRecord(payload) ||
        typeof payload.id !== "number" ||
        !Number.isFinite(payload.id) ||
        payload.id <= 0
      ) {
        throw new DiscussionAdminResponseError("添加敏感词返回格式异常");
      }
      return payload as { id: number };
    });
}

/**
 * 编辑敏感词
 * @param wordId 敏感词ID
 * @param data 更新数据
 */
export function updateSensitiveWord(
  wordId: number | string,
  data: {
    word?: string;
    category?: string;
    level?: number;
    replacement?: string;
    isEnabled?: number; // 是否启用（可选，0/1）
  }
) {
  return http
    .request<unknown>(
      "put",
      `/edu/backend/v1/admin/sensitive-words/${wordId}`,
      { data }
    )
    .then(response => validateMutationResponse(response, "更新敏感词"));
}

/**
 * 删除敏感词
 * @param wordId 敏感词ID
 */
export function deleteSensitiveWord(wordId: number | string) {
  return http
    .request<unknown>(
      "delete",
      `/edu/backend/v1/admin/sensitive-words/${wordId}`
    )
    .then(response => validateMutationResponse(response, "删除敏感词"));
}

/**
 * 批量导入敏感词
 * @param data 导入数据
 */
export function importSensitiveWords(data: {
  words: Array<{
    word: string;
    category?: string;
    level?: number;
    replacement?: string;
  }>;
}): Promise<{ successCount: number; failCount: number }> {
  return http
    .request<
      MaybeWrappedResponse<{ successCount: number; failCount: number }>
    >("post", "/edu/backend/v1/admin/sensitive-words/import", { data })
    .then(response => {
      const payload = unwrapResponseData(response, "导入敏感词");
      if (!isRecord(payload)) {
        throw new DiscussionAdminResponseError("导入敏感词返回格式异常");
      }
      assertFiniteNumberFields(
        payload,
        ["successCount", "failCount"],
        "导入敏感词"
      );
      return payload as { successCount: number; failCount: number };
    });
}

/**
 * 获取用户信誉列表
 * @param params 查询参数
 */
export function getUserReputationList(params?: {
  page?: number;
  pageSize?: number;
  level?: "trusted" | "normal" | "restricted";
  keyword?: string;
  sortBy?: "score" | "postCount" | "replyCount" | "reportCount";
  sortOrder?: "asc" | "desc";
}): Promise<{
  list: UserReputation[];
  pagination: {
    pageNum: number;
    pageSize: number;
    total: number;
  };
  stats: {
    trusted: number;
    normal: number;
    restricted: number;
  };
}> {
  type UserReputationListResponse = {
    list: UserReputation[];
    pagination: {
      pageNum: number;
      pageSize: number;
      total: number;
    };
    stats: {
      trusted: number;
      normal: number;
      restricted: number;
    };
  };

  return http
    .request<
      MaybeWrappedResponse<UserReputationListResponse>
    >("get", "/edu/backend/v1/admin/users/reputations", { params })
    .then(response => {
      const payload = unwrapResponseData(response, "用户信誉列表");
      if (
        !isRecord(payload) ||
        !Array.isArray(payload.list) ||
        !isRecord(payload.pagination) ||
        !isRecord(payload.stats)
      ) {
        throw new DiscussionAdminResponseError("用户信誉列表返回格式异常");
      }
      assertFiniteNumberFields(
        payload.pagination,
        ["pageNum", "pageSize", "total"],
        "用户信誉列表"
      );
      assertFiniteNumberFields(
        payload.stats,
        ["trusted", "normal", "restricted"],
        "用户信誉列表"
      );
      return payload as UserReputationListResponse;
    });
}

/**
 * 调整用户信誉
 * @param userId 用户ID
 * @param data 调整数据
 */
export function updateUserReputation(
  userId: string,
  data: {
    reputationScore: number;
    reason: string;
  }
) {
  return http
    .request<unknown>(
      "put",
      `/edu/backend/v1/admin/users/${userId}/reputation`,
      { data }
    )
    .then(response => validateMutationResponse(response, "调整用户信誉"));
}

/**
 * 获取审计日志
 * @param params 查询参数
 */
export function getAuditLogs(params?: {
  targetType?: "post" | "reply" | "report";
  action?: string;
  operatorId?: number;
  startTime?: string;
  endTime?: string;
  pageNum: number;
  pageSize?: number;
}): Promise<{
  total: number;
  list: AuditLog[];
}> {
  return http
    .request<
      MaybeWrappedResponse<{
        total: number;
        list: AuditLog[];
      }>
    >("get", "/edu/backend/v1/discussions/audit-logs", { params })
    .then(response => unwrapListResponse<AuditLog>(response, "审计日志"));
}

/**
 * 获取全局统计
 * @param params 查询参数
 */
export function getGlobalStatistics(params?: {
  courseId?: number;
  startDate?: string;
  endDate?: string;
}): Promise<GlobalStatistics> {
  return http
    .request<
      MaybeWrappedResponse<GlobalStatistics>
    >("get", "/edu/backend/v1/discussions/statistics", { params })
    .then(response => {
      const payload = unwrapResponseData(response, "讨论统计");
      if (
        !isRecord(payload) ||
        !isRecord(payload.trends) ||
        !Array.isArray(payload.trends.posts) ||
        !Array.isArray(payload.trends.replies) ||
        !Array.isArray(payload.topCourses)
      ) {
        throw new DiscussionAdminResponseError("讨论统计返回格式异常");
      }
      assertFiniteNumberFields(
        payload,
        [
          "totalPosts",
          "totalReplies",
          "totalLikes",
          "pendingPosts",
          "pendingReplies",
          "pendingReports",
          "activeUsers",
          "todayPosts",
          "todayReplies"
        ],
        "讨论统计"
      );
      return payload as unknown as GlobalStatistics;
    });
}

/**
 * 获取待审核列表（管理员/教师）
 * @param params 查询参数
 * @description 对应后端接口 GET /edu/backend/v1/discussions/pending
 */
export async function getPendingList(params?: {
  courseId?: string;
  type?: "all" | "post" | "reply";
  pageNum: number;
  pageSize?: number;
}): Promise<PendingListResponse> {
  return http
    .request<
      MaybeWrappedResponse<PendingListResponse>
    >("get", "/edu/backend/v1/discussions/pending", { params })
    .then(response => unwrapListResponse<PendingItem>(response, "待审核列表"));
}

/**
 * 获取待审核统计
 * GET /edu/backend/v1/discussions/pending/statistics
 */
export function getPendingStatistics(params?: {
  courseId?: string | number;
}): Promise<PendingStatistics> {
  return http
    .request<
      MaybeWrappedResponse<PendingStatistics>
    >("get", "/edu/backend/v1/discussions/pending/statistics", { params })
    .then(response => {
      const payload = unwrapResponseData(response, "待审核统计");
      if (!isRecord(payload) || !Array.isArray(payload.courses)) {
        throw new DiscussionAdminResponseError("待审核统计返回格式异常");
      }
      assertFiniteNumberFields(
        payload,
        [
          "totalPosts",
          "totalReplies",
          "pendingPosts",
          "pendingReplies",
          "pendingTotal",
          "todayPosts"
        ],
        "待审核统计"
      );
      return payload as unknown as PendingStatistics;
    });
}

/**
 * 获取教师课程讨论列表（教师专用，获取所教课程的所有讨论）
 * @param params 查询参数
 */
export async function getTeacherDiscussions(params?: {
  courseId?: string;
  status?: PostStatus;
  keyword?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  data: {
    list: ReviewQueueItem[];
    pagination: Pagination;
  };
}> {
  if (params?.status && params.status !== "pending") {
    throw new DiscussionAdminResponseError("该接口仅支持查询待审核内容");
  }
  if (params?.keyword?.trim()) {
    throw new DiscussionAdminResponseError("后端暂不支持搜索待审核内容");
  }

  const backendParams = {
    courseId: params?.courseId,
    type: "all" as const,
    pageNum: params?.page || 1,
    pageSize: params?.pageSize || 20
  };
  const backendData = await getPendingList(backendParams);
  const total = backendData.total;
  const pageSize = backendParams.pageSize;
  const currentPage = backendParams.pageNum;

  return {
    data: {
      list: backendData.list.map(item => mapPendingItemToReviewQueueItem(item)),
      pagination: {
        page: currentPage,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    }
  };
}

/**
 * 获取管理端/教师端讨论列表
 * @param courseId 课程ID
 * @param params 查询参数
 * @description 对应后端接口 GET /edu/frontend/v1/courses/{courseId}/discussions
 *使用管理员或教师的token进行身份验证
 */
export async function getAdminDiscussions(
  courseId: string,
  params?: {
    page?: number;
    pageSize?: number;
    sortBy?: "latest" | "hot" | "most_replies";
    tag?: string;
  }
): Promise<{
  data: {
    list: DiscussionPost[];
    pagination: Pagination;
  };
}> {
  // 转换参数名：前端 page -> 后端 pageNum
  const backendParams = {
    pageNum: params?.page || 1,
    pageSize: params?.pageSize || 20,
    // 前端文档使用 most_replies，当前 AiEdu 服务端实际识别 replies。
    sortBy: params?.sortBy === "most_replies" ? "replies" : params?.sortBy,
    tag: params?.tag,
    _t: Date.now() // 添加时间戳防止缓存，解决状态切换后刷新过快导致的状态闪烁
  };

  const response = await http.request<
    MaybeWrappedResponse<BackendListResponse>
  >("get", `/edu/frontend/v1/courses/${courseId}/discussions`, {
    params: backendParams
  });
  const backendData = unwrapListResponse<BackendPostListItem>(
    response,
    "课程讨论列表"
  );
  const total = backendData.total;
  const pageSize = backendParams.pageSize;
  const currentPage = backendParams.pageNum;

  const list: DiscussionPost[] = backendData.list.map(item => ({
    id: String(item.postId),
    title: item.title,
    content: item.content,
    contentHtml: item.content,
    author: {
      id: String(item.authorId),
      name: item.authorName,
      avatar: item.authorAvatar || "", // 确保空值时使用空字符串
      isTeacher: false,
      isAdmin: false
    },
    tags: item.tags || [],
    status: "approved" as PostStatus,
    isPinned:
      (item as any).isPinned === true ||
      (item as any).isPinned === 1 ||
      String((item as any).isPinned) === "true" ||
      String((item as any).isPinned) === "1",
    likeCount: item.likeCount,
    replyCount: item.replyCount,
    viewCount: item.viewCount,
    isLiked: item.isLiked,
    createdAt: item.createTime
  }));

  return {
    data: {
      list,
      pagination: {
        page: currentPage,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    }
  };
}

/**
 * 获取管理端/教师端讨论详情
 * @param postId 帖子ID
 * @description 对应后端接口 GET /edu/frontend/v1/discussions/{postId}
 * 使用管理员或教师的token进行身份验证
 */
export async function getAdminDiscussionDetail(
  postId: string | number
): Promise<{
  data: DiscussionPost & {
    courseId: string;
    courseName: string;
    isOwner: boolean;
  };
}> {
  const response = await http.request<MaybeWrappedResponse<BackendPostDetail>>(
    "get",
    `/edu/frontend/v1/discussions/${postId}`
  );
  const backendData = unwrapResponseData(response, "讨论详情");
  if (
    !isRecord(backendData) ||
    typeof backendData.postId !== "number" ||
    String(backendData.postId) !== String(postId)
  ) {
    throw new DiscussionAdminResponseError("讨论详情返回格式异常");
  }

  const detail: DiscussionPost & {
    courseId: string;
    courseName: string;
    isOwner: boolean;
  } = {
    id: String(backendData.postId),
    title: backendData.title,
    content: backendData.content,
    contentHtml: backendData.contentHtml || backendData.content,
    author: {
      id: String(backendData.authorId),
      name: backendData.authorName,
      avatar: backendData.authorAvatar,
      isTeacher: false,
      isAdmin: false
    },
    tags: backendData.tags || [],
    status: "approved" as PostStatus,
    isPinned:
      (backendData as any).isPinned === true ||
      (backendData as any).isPinned === 1 ||
      String((backendData as any).isPinned) === "true" ||
      String((backendData as any).isPinned) === "1",
    likeCount: backendData.likeCount,
    replyCount: backendData.replyCount,
    viewCount: backendData.viewCount,
    isLiked: backendData.isLiked,
    createdAt: backendData.createTime,
    editedAt: backendData.editedAt,
    courseId: backendData.courseId,
    courseName: backendData.courseName,
    isOwner: backendData.isOwner
  };

  return { data: detail };
}

/**
 * 获取教师课程统计
 * @param courseId 课程ID（可选，不传则获取所有课程汇总）
 */
export function getTeacherCourseStats(courseId?: string) {
  return http.request<{
    totalPosts: number;
    totalReplies: number;
    pendingReview: number;
    pendingReports: number;
    todayPosts: number;
    weekPosts: number;
    courses: Array<{
      courseId: string;
      courseName: string;
      postCount: number;
      pendingCount: number;
    }>;
  }>("get", "/edu/backend/v1/teacher/discussions/stats", {
    params: courseId ? { courseId } : undefined
  });
}
