/**
 * 课程讨论区 API
 * 对应后端接口文档:doc/backend/course-discussion-api.md
 */

import { http } from "@/utils/http";
import {
  type DiscussionListPayload,
  type DiscussionMutationPayload,
  DiscussionResponseError,
  isDiscussionPostListItemPayload,
  isDiscussionReplyListItemPayload,
  normalizeOptionalDiscussionId,
  toBackendDiscussionId,
  unwrapDiscussionListResponse,
  unwrapDiscussionMutationResponse,
  unwrapDiscussionResponseData
} from "./discussionResponse";

//==================== 类型定义 ====================

/** 作者信息 */
export interface Author {
  id: string;
  name: string;
  avatar: string;
  isTeacher?: boolean;
  isAdmin?: boolean;
}

/** 回复 */
export interface Reply {
  id: string;
  author: Author;
  content: string;
  contentHtml: string;
  likeCount: number;
  isLiked: boolean;
  isOwner?: boolean;
  replyTo?: string;
  replyToId?: string;
  parentReplyId?: string;
  createdAt: string;
}

/** 帖子状态 */
export type PostStatus = "pending" | "approved" | "rejected" | "auto_approved";

/** 讨论帖子 */
export interface DiscussionPost {
  id: string;
  title?: string;
  content: string;
  contentHtml: string;
  author: Author;
  tags: string[];
  status: PostStatus;
  isPinned: boolean;
  likeCount: number;
  replyCount: number;
  viewCount: number;
  isLiked: boolean;
  createdAt: string;
  editedAt?: string;
  replies?: Reply[];
  hasMoreReplies?: boolean;
}

/** 分页信息 */
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** 获取讨论列表参数（前端使用） */
export interface GetDiscussionsParams {
  page?: number;
  pageSize?: number;
  sort?: "latest" | "hot" | "most_replies";
  tag?: string;
}

/** 后端返回的帖子列表项 */
interface BackendPostListItem {
  postId: number;
  title?: string | null;
  content: string;
  authorId: number;
  authorName: string;
  authorAvatar?: string | null;
  tags?: string[] | null;
  likeCount: number;
  replyCount: number;
  viewCount: number;
  isPinned?: boolean | number | string | null;
  isLiked?: boolean | number | string | null;
  createTime: string;
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
  authorAvatar?: string | null;
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

/** 后端返回的回复列表项 */
interface BackendReplyListItem {
  replyId: number;
  content: string;
  contentHtml: string;
  authorId: number;
  authorName: string;
  authorAvatar: string;
  parentReplyId?: number | string | null;
  replyToUserId?: number | string | null;
  replyToUserName?: string | null;
  likeCount: number;
  isLiked?: boolean | number | string | null;
  isOwner?: boolean | number | string | null;
  createTime: string;
}

/** 后端返回的列表响应 */
type BackendListResponse = DiscussionListPayload<BackendPostListItem>;

/** 后端回复列表响应 */
type BackendReplyListResponse = DiscussionListPayload<BackendReplyListItem>;

/** 发布讨论参数 */
export interface CreateDiscussionParams {
  title?: string;
  content: string;
  tags?: string[];
}

export interface CreateDiscussionResult {
  postId: number;
  status: "pending" | "auto_approved";
}

/** 发布回复参数 */
export interface CreateReplyParams {
  content: string;
  parentReplyId?: string | number;
  replyToUserId?: string | number;
}

export interface CreateReplyResult {
  replyId: number;
  status: "pending" | "auto_approved";
}

/** 举报原因 */
export type ReportReason = "spam" | "abuse" | "inappropriate" | "other";

/** 举报参数 */
export interface ReportParams {
  reason: ReportReason;
  description?: string;
}

/** 审核参数 */
export interface ReviewParams {
  action: "approve" | "reject";
  reason?: string;
  /** @deprecated Use `reason`; retained for existing callers. */
  note?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const normalizeBackendBoolean = (value: unknown) =>
  value === true || value === 1 || value === "true" || value === "1";

function assertCreationResult<T extends "postId" | "replyId">(
  payload: unknown,
  idKey: T,
  operationName: string
): asserts payload is Record<T, number> & {
  status: "pending" | "auto_approved";
} {
  if (
    !isRecord(payload) ||
    !Number.isSafeInteger(payload[idKey]) ||
    (payload[idKey] as number) <= 0 ||
    (payload.status !== "pending" && payload.status !== "auto_approved")
  ) {
    throw new DiscussionResponseError(`${operationName}返回格式异常`);
  }
}

// ==================== API 接口 ====================

/**
 * 获取讨论列表
 * @param courseId 课程ID
 * @param params 查询参数
 */
export async function getDiscussions(
  courseId: string,
  params?: GetDiscussionsParams
): Promise<{ data: { list: DiscussionPost[]; pagination: Pagination } }> {
  // 转换参数名：前端 page -> 后端 pageNum，前端 sort -> 后端 sortBy
  const backendParams: any = {
    pageNum: params?.page || 1,
    pageSize: params?.pageSize || 20,
    _t: Date.now() // 添加时间戳防止缓存
  };

  // 转换排序参数
  if (params?.sort) {
    backendParams.sortBy = params.sort;
  }

  if (params?.tag) {
    backendParams.tag = params.tag;
  }

  const response = await http.request<
    | {
        code: number;
        msg: string;
        data: BackendListResponse;
      }
    | BackendListResponse
  >("get", `/edu/frontend/v1/courses/${courseId}/discussions`, {
    params: backendParams
  });

  const backendData = unwrapDiscussionListResponse<BackendPostListItem>(
    response,
    "讨论列表",
    isDiscussionPostListItemPayload
  );
  const total = backendData.total;
  const pageSize = backendParams.pageSize;
  const currentPage = backendParams.pageNum;
  const totalPages = Math.ceil(total / pageSize);

  const list: DiscussionPost[] = backendData.list.map(item => ({
    id: String(item.postId),
    title: typeof item.title === "string" ? item.title : "",
    content: item.content,
    contentHtml: "",
    author: {
      id: String(item.authorId),
      name: item.authorName,
      avatar: typeof item.authorAvatar === "string" ? item.authorAvatar : "",
      isTeacher: false,
      isAdmin: false
    },
    tags: Array.isArray(item.tags) ? item.tags : [],
    status: "approved" as PostStatus,
    isPinned: normalizeBackendBoolean(item.isPinned),
    likeCount: item.likeCount,
    replyCount: item.replyCount,
    viewCount: item.viewCount,
    isLiked: normalizeBackendBoolean(item.isLiked),
    createdAt: item.createTime
  }));

  return {
    data: {
      list,
      pagination: {
        page: currentPage,
        pageSize,
        total,
        totalPages
      }
    }
  };
}

/**
 * 获取讨论详情
 * @param postId 帖子ID
 */
export async function getDiscussionDetail(postId: string): Promise<
  DiscussionPost & {
    courseId: string;
    courseName: string;
    isOwner: boolean;
  }
> {
  const response = await http.request<unknown>(
    "get",
    `/edu/frontend/v1/discussions/${postId}`
  );
  const backendData = unwrapDiscussionResponseData<BackendPostDetail>(
    response,
    "讨论详情"
  );
  if (
    !isRecord(backendData) ||
    !isFiniteNumber(backendData.postId) ||
    String(backendData.postId) !== String(postId) ||
    !isFiniteNumber(backendData.authorId) ||
    !isFiniteNumber(backendData.likeCount) ||
    !isFiniteNumber(backendData.replyCount) ||
    !isFiniteNumber(backendData.viewCount) ||
    typeof backendData.content !== "string" ||
    typeof backendData.createTime !== "string"
  ) {
    throw new DiscussionResponseError("讨论详情返回格式异常");
  }

  return {
    id: String(backendData.postId),
    title: typeof backendData.title === "string" ? backendData.title : "",
    content: backendData.content,
    contentHtml: "",
    author: {
      id: String(backendData.authorId),
      name:
        typeof backendData.authorName === "string"
          ? backendData.authorName
          : "",
      avatar:
        typeof backendData.authorAvatar === "string"
          ? backendData.authorAvatar
          : "",
      isTeacher: false,
      isAdmin: false
    },
    tags: Array.isArray(backendData.tags)
      ? backendData.tags.filter(tag => typeof tag === "string")
      : [],
    status: "approved",
    isPinned: normalizeBackendBoolean(backendData.isPinned),
    likeCount: backendData.likeCount,
    replyCount: backendData.replyCount,
    viewCount: backendData.viewCount,
    isLiked: normalizeBackendBoolean(backendData.isLiked),
    createdAt: backendData.createTime,
    editedAt:
      typeof backendData.editedAt === "string"
        ? backendData.editedAt
        : undefined,
    courseId: String(backendData.courseId ?? ""),
    courseName:
      typeof backendData.courseName === "string" ? backendData.courseName : "",
    isOwner: normalizeBackendBoolean(backendData.isOwner)
  };
}

/**
 * 发布讨论
 * @param courseId 课程ID
 * @param data 帖子数据
 */
export async function createDiscussion(
  courseId: string,
  data: CreateDiscussionParams
): Promise<CreateDiscussionResult> {
  const response = await http.request<unknown>(
    "post",
    `/edu/frontend/v1/courses/${courseId}/discussions`,
    { data }
  );
  const payload = unwrapDiscussionResponseData<unknown>(response, "发布讨论");
  assertCreationResult(payload, "postId", "发布讨论");
  return payload;
}

/**
 * 编辑讨论
 * @param postId 帖子ID
 * @param data 更新数据
 */
export async function updateDiscussion(
  postId: string,
  data: CreateDiscussionParams
): Promise<DiscussionMutationPayload> {
  const response = await http.request<unknown>(
    "put",
    `/edu/frontend/v1/discussions/${postId}`,
    { data }
  );
  return unwrapDiscussionMutationResponse(response, "编辑讨论");
}

/**
 * 删除讨论
 * @param postId 帖子ID
 */
export async function deleteDiscussion(
  postId: string
): Promise<DiscussionMutationPayload> {
  const response = await http.request<unknown>(
    "delete",
    `/edu/frontend/v1/discussions/${postId}`
  );
  return unwrapDiscussionMutationResponse(response, "删除讨论");
}

/**
 * 获取回复列表
 * @param postId 帖子ID
 * @param params 分页参数
 */
export async function getReplies(
  postId: string,
  params?: { page?: number; pageSize?: number }
): Promise<{ data: { list: Reply[]; total: number } }> {
  const backendParams: any = {
    pageNum: params?.page || 1,
    pageSize: params?.pageSize || 20,
    _t: Date.now() // 添加时间戳防止缓存
  };

  const response = await http.request<
    | {
        code: number;
        msg: string;
        data: BackendReplyListResponse;
      }
    | BackendReplyListResponse
  >("get", `/edu/frontend/v1/discussions/${postId}/replies`, {
    params: backendParams
  });

  const backendData = unwrapDiscussionListResponse<BackendReplyListItem>(
    response,
    "回复列表",
    isDiscussionReplyListItemPayload
  );
  const list: Reply[] = backendData.list.map(item => ({
    id: String(item.replyId),
    author: {
      id: String(item.authorId),
      name: item.authorName,
      avatar: typeof item.authorAvatar === "string" ? item.authorAvatar : "",
      isTeacher: false,
      isAdmin: false
    },
    content: item.content,
    contentHtml: "",
    likeCount: item.likeCount,
    isLiked: normalizeBackendBoolean(item.isLiked),
    isOwner: normalizeBackendBoolean(item.isOwner),
    replyTo:
      typeof item.replyToUserName === "string"
        ? item.replyToUserName
        : undefined,
    replyToId: normalizeOptionalDiscussionId(item.replyToUserId),
    parentReplyId: normalizeOptionalDiscussionId(item.parentReplyId),
    createdAt: item.createTime
  }));

  return {
    data: {
      list,
      total: backendData.total
    }
  };
}

/**
 * 发布回复
 * @param postId 帖子ID
 * @param data 回复数据
 */
export async function createReply(
  postId: string,
  data: CreateReplyParams
): Promise<CreateReplyResult> {
  const requestData: {
    content: string;
    parentReplyId?: number;
    replyToUserId?: number;
  } = { content: data.content };
  if (data.parentReplyId !== undefined) {
    requestData.parentReplyId = toBackendDiscussionId(
      data.parentReplyId,
      "父回复ID"
    );
  }
  if (data.replyToUserId !== undefined) {
    requestData.replyToUserId = toBackendDiscussionId(
      data.replyToUserId,
      "被回复用户ID"
    );
  }

  const response = await http.request<unknown>(
    "post",
    `/edu/frontend/v1/discussions/${postId}/replies`,
    { data: requestData }
  );
  const payload = unwrapDiscussionResponseData<unknown>(response, "发布回复");
  assertCreationResult(payload, "replyId", "发布回复");
  return payload;
}

/**
 * 编辑回复
 * @param replyId 回复ID
 * @param data 更新数据
 */
export async function updateReply(
  replyId: string,
  data: { content: string }
): Promise<DiscussionMutationPayload> {
  const response = await http.request<unknown>(
    "put",
    `/edu/frontend/v1/discussions/replies/${replyId}`,
    { data }
  );
  return unwrapDiscussionMutationResponse(response, "编辑回复");
}

/**
 * 删除回复
 * @param replyId 回复ID
 */
export async function deleteReply(
  replyId: string
): Promise<DiscussionMutationPayload> {
  const response = await http.request<unknown>(
    "delete",
    `/edu/frontend/v1/discussions/replies/${replyId}`
  );
  return unwrapDiscussionMutationResponse(response, "删除回复");
}

/**
 * 点赞帖子
 * @param postId 帖子ID
 */
export async function likePost(
  postId: string
): Promise<DiscussionMutationPayload> {
  const response = await http.request<unknown>(
    "post",
    `/edu/frontend/v1/discussions/${postId}/like`
  );
  return unwrapDiscussionMutationResponse(response, "点赞讨论");
}

/**
 * 取消点赞帖子
 * @param postId 帖子ID
 */
export async function unlikePost(
  postId: string
): Promise<DiscussionMutationPayload> {
  const response = await http.request<unknown>(
    "delete",
    `/edu/frontend/v1/discussions/${postId}/like`
  );
  return unwrapDiscussionMutationResponse(response, "取消讨论点赞");
}

/**
 * 点赞回复
 * @param replyId 回复ID
 */
export async function likeReply(
  replyId: string
): Promise<DiscussionMutationPayload> {
  const response = await http.request<unknown>(
    "post",
    `/edu/frontend/v1/discussions/replies/${replyId}/like`
  );
  return unwrapDiscussionMutationResponse(response, "点赞回复");
}

/**
 * 取消点赞回复
 * @param replyId 回复ID
 */
export async function unlikeReply(
  replyId: string
): Promise<DiscussionMutationPayload> {
  const response = await http.request<unknown>(
    "delete",
    `/edu/frontend/v1/discussions/replies/${replyId}/like`
  );
  return unwrapDiscussionMutationResponse(response, "取消回复点赞");
}

/**
 * 举报帖子
 * @param postId 帖子ID
 * @param data 举报数据
 */
export async function reportPost(
  postId: string | number,
  data: ReportParams
): Promise<DiscussionMutationPayload> {
  const id = typeof postId === "string" ? parseInt(postId, 10) : postId;
  const response = await http.request<unknown>(
    "post",
    `/edu/frontend/v1/discussions/${id}/report`,
    { data }
  );
  return unwrapDiscussionMutationResponse(response, "举报讨论");
}

/**
 * 举报回复
 * @param replyId 回复ID
 * @param data 举报数据
 */
export async function reportReply(
  replyId: string | number,
  data: ReportParams
): Promise<DiscussionMutationPayload> {
  const id = typeof replyId === "string" ? parseInt(replyId, 10) : replyId;
  const response = await http.request<unknown>(
    "post",
    `/edu/frontend/v1/discussions/replies/${id}/report`,
    { data }
  );
  return unwrapDiscussionMutationResponse(response, "举报回复");
}

/**
 * 置顶帖子（管理员/教师专用）
 * @param postId 帖子ID
 */
export async function pinPost(
  postId: string | number
): Promise<DiscussionMutationPayload> {
  const response = await http.request<unknown>(
    "post",
    `/edu/backend/v1/discussions/${postId}/pin`
  );
  return unwrapDiscussionMutationResponse(response, "置顶讨论");
}

/**
 * 取消置顶帖子（管理员/教师专用）
 * @param postId 帖子ID
 */
export async function unpinPost(
  postId: string | number
): Promise<DiscussionMutationPayload> {
  const response = await http.request<unknown>(
    "delete",
    `/edu/backend/v1/discussions/${postId}/pin`,
    { params: { _t: Date.now() } }
  );
  return unwrapDiscussionMutationResponse(response, "取消置顶讨论");
}

/**
 * 审核帖子（管理员/教师）
 * @param postId 帖子ID
 * @param data 审核数据
 */
export async function reviewPost(
  postId: string,
  data: ReviewParams
): Promise<DiscussionMutationPayload> {
  const reason = data.reason ?? data.note;
  const requestData = {
    action: data.action,
    ...(reason !== undefined ? { reason } : {})
  };
  const response = await http.request<unknown>(
    "post",
    `/edu/backend/v1/discussions/${postId}/review`,
    { data: requestData }
  );
  return unwrapDiscussionMutationResponse(response, "审核讨论");
}
