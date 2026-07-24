export interface DiscussionListPayload<T> {
  total: number;
  list: T[];
}

export interface DiscussionApiEnvelope<T> {
  code: number | string;
  msg?: string;
  message?: string;
  data?: T | null;
}

export interface DiscussionMutationPayload extends Record<string, unknown> {
  success?: boolean;
  likeCount?: number;
}

export type DiscussionListItemValidator = (
  item: unknown,
  index: number
) => boolean;

export class DiscussionResponseError extends Error {
  code?: number | string;

  constructor(message: string, code?: number | string) {
    super(message);
    this.name = "DiscussionResponseError";
    this.code = code;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const hasOwn = (value: object, key: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(value, key);

const isPositiveSafeInteger = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

const isNonNegativeNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isBackendBoolean = (value: unknown) =>
  typeof value === "boolean" ||
  value === 0 ||
  value === 1 ||
  value === "0" ||
  value === "1" ||
  value === "false" ||
  value === "true";

const isOptionalBackendBoolean = (value: unknown) =>
  value == null || isBackendBoolean(value);

const isStringArray = (value: unknown) =>
  Array.isArray(value) && value.every(item => typeof item === "string");

const getResponseMessage = (
  response: Record<string, unknown>,
  fallbackMessage: string
) => {
  const message = response.msg ?? response.message;
  return typeof message === "string" && message.trim()
    ? message.trim()
    : fallbackMessage;
};

const assertSuccessfulDiscussionResponse = (
  response: Record<string, unknown>,
  resourceName: string
) => {
  const responseData = isRecord(response.data) ? response.data : undefined;
  if (response.success === false || responseData?.success === false) {
    throw new DiscussionResponseError(
      getResponseMessage(
        responseData || response,
        getResponseMessage(response, `${resourceName}失败`)
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
    throw new DiscussionResponseError(
      getResponseMessage(response, `${resourceName}失败`),
      typeof rawCode === "number" || typeof rawCode === "string"
        ? rawCode
        : undefined
    );
  }
};

/** Validate the documented business envelope while accepting its bare payload. */
export function unwrapDiscussionResponseData<T>(
  response: unknown,
  resourceName: string
): T {
  if (!isRecord(response)) {
    throw new DiscussionResponseError(`${resourceName}返回格式异常`);
  }

  assertSuccessfulDiscussionResponse(response, resourceName);

  if (hasOwn(response, "code")) {
    if (!hasOwn(response, "data") || response.data == null) {
      throw new DiscussionResponseError(`${resourceName}返回格式异常`);
    }
    return response.data as T;
  }

  return response as T;
}

export function unwrapDiscussionMutationResponse(
  response: unknown,
  operationName: string
): DiscussionMutationPayload {
  const payload = unwrapDiscussionResponseData<unknown>(
    response,
    operationName
  );
  if (!isRecord(payload)) {
    throw new DiscussionResponseError(`${operationName}返回格式异常`);
  }

  if (
    hasOwn(payload, "likeCount") &&
    (typeof payload.likeCount !== "number" ||
      !Number.isFinite(payload.likeCount) ||
      payload.likeCount < 0)
  ) {
    throw new DiscussionResponseError(`${operationName}返回格式异常`);
  }

  return payload as DiscussionMutationPayload;
}

const isDiscussionListPayload = <T>(
  value: unknown
): value is DiscussionListPayload<T> =>
  isRecord(value) &&
  typeof value.total === "number" &&
  Number.isFinite(value.total) &&
  value.total >= 0 &&
  Array.isArray(value.list);

/** Required fields consumed when a post list item is mapped to the UI model. */
export const isDiscussionPostListItemPayload: DiscussionListItemValidator =
  item =>
    isRecord(item) &&
    isPositiveSafeInteger(item.postId) &&
    (item.title == null || typeof item.title === "string") &&
    typeof item.content === "string" &&
    isPositiveSafeInteger(item.authorId) &&
    typeof item.authorName === "string" &&
    (item.authorAvatar == null || typeof item.authorAvatar === "string") &&
    (item.tags == null || isStringArray(item.tags)) &&
    isNonNegativeNumber(item.likeCount) &&
    isNonNegativeNumber(item.replyCount) &&
    isNonNegativeNumber(item.viewCount) &&
    isOptionalBackendBoolean(item.isPinned) &&
    isOptionalBackendBoolean(item.isLiked) &&
    typeof item.createTime === "string";

/** Required fields consumed when a reply list item is mapped to the UI model. */
export const isDiscussionReplyListItemPayload: DiscussionListItemValidator =
  item =>
    isRecord(item) &&
    isPositiveSafeInteger(item.replyId) &&
    typeof item.content === "string" &&
    isPositiveSafeInteger(item.authorId) &&
    typeof item.authorName === "string" &&
    (item.authorAvatar == null || typeof item.authorAvatar === "string") &&
    (item.parentReplyId == null ||
      item.parentReplyId === 0 ||
      item.parentReplyId === "0" ||
      normalizeOptionalDiscussionId(item.parentReplyId) !== undefined) &&
    (item.replyToUserId == null ||
      item.replyToUserId === 0 ||
      item.replyToUserId === "0" ||
      normalizeOptionalDiscussionId(item.replyToUserId) !== undefined) &&
    (item.replyToUserName == null ||
      typeof item.replyToUserName === "string") &&
    isNonNegativeNumber(item.likeCount) &&
    isOptionalBackendBoolean(item.isLiked) &&
    isOptionalBackendBoolean(item.isOwner) &&
    typeof item.createTime === "string";

export const normalizeOptionalDiscussionId = (
  value: unknown
): string | undefined => {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? String(value) : undefined;
  }

  if (typeof value !== "string") return undefined;

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return undefined;

  const withoutLeadingZeros = normalized.replace(/^0+(?=\d)/, "");
  return withoutLeadingZeros === "0" ? undefined : withoutLeadingZeros;
};

export const toBackendDiscussionId = (
  value: unknown,
  fieldName = "讨论ID"
): number => {
  const normalized = normalizeOptionalDiscussionId(value);
  const numericId = normalized ? Number(normalized) : Number.NaN;
  if (!Number.isSafeInteger(numericId) || numericId <= 0) {
    throw new DiscussionResponseError(`${fieldName}格式异常`);
  }
  return numericId;
};

export function unwrapDiscussionListResponse<T>(
  response: unknown,
  resourceName: string,
  validateItem?: DiscussionListItemValidator
): DiscussionListPayload<T> {
  const payload = unwrapDiscussionResponseData<unknown>(response, resourceName);

  if (!isDiscussionListPayload<T>(payload)) {
    throw new DiscussionResponseError(`${resourceName}返回格式异常`);
  }

  if (validateItem) {
    const invalidIndex = payload.list.findIndex(
      (item, index) => !validateItem(item, index)
    );
    if (invalidIndex >= 0) {
      throw new DiscussionResponseError(
        `${resourceName}第${invalidIndex + 1}项返回格式异常`
      );
    }
  }

  return payload;
}
