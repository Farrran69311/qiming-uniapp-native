import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DiscussionResponseError,
  isDiscussionPostListItemPayload,
  isDiscussionReplyListItemPayload,
  normalizeOptionalDiscussionId,
  toBackendDiscussionId,
  unwrapDiscussionListResponse,
  unwrapDiscussionMutationResponse,
  unwrapDiscussionResponseData
} from "./discussionResponse.ts";

const validEmptyPayload = { total: 0, list: [] };
const validPostItem = {
  postId: 11,
  title: "标题",
  content: "正文",
  authorId: 21,
  authorName: "教师",
  authorAvatar: "",
  tags: ["答疑"],
  likeCount: 0,
  replyCount: 1,
  viewCount: 2,
  isPinned: 0,
  isLiked: "false",
  createTime: "2026-07-24T12:00:00Z"
};
const validReplyItem = {
  replyId: 31,
  content: "回复",
  authorId: 41,
  authorName: "学生",
  authorAvatar: "",
  parentReplyId: null,
  replyToUserId: 0,
  replyToUserName: "",
  likeCount: 0,
  isLiked: false,
  isOwner: true,
  createTime: "2026-07-24T12:01:00Z"
};

test("optional discussion IDs only preserve positive integer identifiers", () => {
  assert.equal(normalizeOptionalDiscussionId(12), "12");
  assert.equal(normalizeOptionalDiscussionId(" 0042 "), "42");
  assert.equal(
    normalizeOptionalDiscussionId("9223372036854775807"),
    "9223372036854775807"
  );

  for (const value of [
    undefined,
    null,
    0,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    "",
    "0",
    "-1",
    "undefined",
    "12x"
  ]) {
    assert.equal(normalizeOptionalDiscussionId(value), undefined);
  }
});

test("reply identifiers are serialized as documented int64-compatible numbers", () => {
  assert.equal(toBackendDiscussionId("0042", "父回复ID"), 42);
  assert.equal(toBackendDiscussionId(17, "被回复用户ID"), 17);
  assert.throws(
    () => toBackendDiscussionId("12x", "父回复ID"),
    /父回复ID格式异常/
  );
  assert.throws(
    () => toBackendDiscussionId("9223372036854775807", "父回复ID"),
    /父回复ID格式异常/
  );
});

test("discussion list adapter preserves real empty success responses", () => {
  assert.strictEqual(
    unwrapDiscussionListResponse(
      { code: 0, msg: "success", data: validEmptyPayload },
      "讨论列表"
    ),
    validEmptyPayload
  );
  assert.strictEqual(
    unwrapDiscussionListResponse(
      { code: 200, msg: "success", data: validEmptyPayload },
      "讨论列表"
    ),
    validEmptyPayload
  );
  assert.strictEqual(
    unwrapDiscussionListResponse(validEmptyPayload, "讨论列表"),
    validEmptyPayload
  );
});

test("discussion list adapter rejects business errors and malformed payloads", () => {
  assert.throws(
    () =>
      unwrapDiscussionListResponse(
        { code: 40301, msg: "无权查看讨论", data: null },
        "讨论列表"
      ),
    error =>
      error instanceof DiscussionResponseError &&
      error.code === 40301 &&
      error.message === "无权查看讨论"
  );
  assert.throws(
    () =>
      unwrapDiscussionListResponse(
        { code: 0, msg: "success", data: null },
        "讨论列表"
      ),
    /讨论列表返回格式异常/
  );
  assert.throws(
    () => unwrapDiscussionListResponse({ total: 0 }, "回复列表"),
    /回复列表返回格式异常/
  );
  assert.throws(
    () =>
      unwrapDiscussionListResponse(
        { code: null, msg: "invalid", data: validEmptyPayload },
        "讨论列表"
      ),
    /invalid/
  );
});

test("discussion list adapter rejects malformed post and reply items", () => {
  assert.equal(isDiscussionPostListItemPayload(validPostItem, 0), true);
  assert.equal(isDiscussionReplyListItemPayload(validReplyItem, 0), true);
  assert.equal(
    isDiscussionPostListItemPayload(
      {
        ...validPostItem,
        title: undefined,
        authorAvatar: undefined,
        tags: undefined,
        isPinned: undefined,
        isLiked: undefined
      },
      0
    ),
    true
  );
  assert.equal(
    isDiscussionReplyListItemPayload(
      {
        ...validReplyItem,
        authorAvatar: undefined,
        replyToUserName: undefined,
        isLiked: undefined,
        isOwner: undefined
      },
      0
    ),
    true
  );

  for (const invalidItem of [
    { ...validPostItem, postId: undefined },
    { ...validPostItem, content: undefined },
    { ...validPostItem, authorName: undefined },
    { ...validPostItem, likeCount: -1 },
    { ...validPostItem, tags: ["有效", null] }
  ]) {
    assert.throws(
      () =>
        unwrapDiscussionListResponse(
          { total: 1, list: [invalidItem] },
          "讨论列表",
          isDiscussionPostListItemPayload
        ),
      /讨论列表第1项返回格式异常/
    );
  }

  for (const invalidItem of [
    { ...validReplyItem, replyId: undefined },
    { ...validReplyItem, content: undefined },
    { ...validReplyItem, authorId: undefined },
    { ...validReplyItem, likeCount: Number.NaN },
    { ...validReplyItem, parentReplyId: "invalid" }
  ]) {
    assert.throws(
      () =>
        unwrapDiscussionListResponse(
          { total: 1, list: [invalidItem] },
          "回复列表",
          isDiscussionReplyListItemPayload
        ),
      /回复列表第1项返回格式异常/
    );
  }
});

test("discussion envelopes unwrap documented success and preserve bare payloads", () => {
  const payload = { postId: 1001, status: "auto_approved" };

  assert.strictEqual(
    unwrapDiscussionResponseData(
      { code: 0, msg: "success", data: payload },
      "发布讨论"
    ),
    payload
  );
  assert.strictEqual(
    unwrapDiscussionResponseData(
      { code: "200", msg: "success", data: payload },
      "发布讨论"
    ),
    payload
  );
  assert.strictEqual(
    unwrapDiscussionResponseData(payload, "发布讨论"),
    payload
  );
});

test("discussion envelopes reject every explicit business failure", () => {
  for (const response of [
    { code: 40301, msg: "无权操作", data: {} },
    { code: "500", message: "服务失败", data: {} },
    { code: null, msg: "业务码异常", data: {} },
    { success: false, msg: "写入失败" },
    { code: 0, msg: "outer", data: { success: false, msg: "保存失败" } }
  ]) {
    assert.throws(
      () => unwrapDiscussionResponseData(response, "讨论操作"),
      DiscussionResponseError
    );
  }

  assert.throws(
    () =>
      unwrapDiscussionResponseData(
        { code: 0, msg: "success", data: null },
        "讨论详情"
      ),
    /讨论详情返回格式异常/
  );
});

test("discussion mutation adapter accepts object payloads and validates counts", () => {
  const wrappedPayload = { likeCount: 7 };
  assert.strictEqual(
    unwrapDiscussionMutationResponse(
      { code: 0, msg: "success", data: wrappedPayload },
      "点赞讨论"
    ),
    wrappedPayload
  );

  const barePayload = {};
  assert.strictEqual(
    unwrapDiscussionMutationResponse(barePayload, "删除讨论"),
    barePayload
  );

  assert.throws(
    () => unwrapDiscussionMutationResponse(null, "删除讨论"),
    /删除讨论返回格式异常/
  );
  assert.throws(
    () =>
      unwrapDiscussionMutationResponse(
        { code: 0, data: { likeCount: -1 } },
        "点赞讨论"
      ),
    /点赞讨论返回格式异常/
  );
});

test("discussion requests propagate adapter and transport failures", async () => {
  const source = await readFile(new URL("./discussion.ts", import.meta.url), {
    encoding: "utf8"
  });
  const discussionsBlock = source.slice(
    source.indexOf("export async function getDiscussions"),
    source.indexOf("export async function getDiscussionDetail")
  );
  const repliesBlock = source.slice(
    source.indexOf("export async function getReplies"),
    source.indexOf("export async function createReply")
  );

  for (const block of [discussionsBlock, repliesBlock]) {
    assert.match(block, /unwrapDiscussionListResponse/);
    assert.doesNotMatch(block, /catch\s*\(/);
  }
  assert.doesNotMatch(discussionsBlock, /list:\s*\[\]/);
  assert.doesNotMatch(repliesBlock, /list:\s*\[\]/);
  assert.match(discussionsBlock, /isDiscussionPostListItemPayload/);
  assert.match(repliesBlock, /isDiscussionReplyListItemPayload/);
  assert.doesNotMatch(
    repliesBlock,
    /String\(item\.(?:replyToUserId|parentReplyId)\)/
  );
  assert.match(
    repliesBlock,
    /normalizeOptionalDiscussionId\(item\.replyToUserId\)/
  );
  assert.match(
    repliesBlock,
    /normalizeOptionalDiscussionId\(item\.parentReplyId\)/
  );
});

test("detail and every discussion write are wired through runtime adapters", async () => {
  const source = await readFile(new URL("./discussion.ts", import.meta.url), {
    encoding: "utf8"
  });
  const functionBlock = name => {
    const start = source.indexOf(`export async function ${name}`);
    assert.ok(start >= 0, `${name} must be async and present`);
    const next = source.indexOf("\nexport ", start + 1);
    return source.slice(start, next < 0 ? source.length : next);
  };

  const detailBlock = functionBlock("getDiscussionDetail");
  assert.match(detailBlock, /unwrapDiscussionResponseData<BackendPostDetail>/);
  assert.match(detailBlock, /detailResponse|backendData/);
  assert.doesNotMatch(detailBlock, /return http\.request/);

  for (const name of ["createDiscussion", "createReply"]) {
    const block = functionBlock(name);
    assert.match(block, /unwrapDiscussionResponseData<unknown>/);
    assert.match(block, /assertCreationResult/);
    assert.doesNotMatch(block, /return http\.request/);
  }

  const createReplyBlock = functionBlock("createReply");
  assert.match(createReplyBlock, /toBackendDiscussionId/);
  assert.match(createReplyBlock, /data: requestData/);

  for (const name of [
    "updateDiscussion",
    "deleteDiscussion",
    "updateReply",
    "deleteReply",
    "likePost",
    "unlikePost",
    "likeReply",
    "unlikeReply",
    "reportPost",
    "reportReply",
    "pinPost",
    "unpinPost",
    "reviewPost"
  ]) {
    const block = functionBlock(name);
    assert.match(block, /unwrapDiscussionMutationResponse\(response,/);
    assert.doesNotMatch(block, /return http\.request/);
  }

  assert.match(
    functionBlock("reviewPost"),
    /\/edu\/backend\/v1\/discussions\/\$\{postId\}\/review/
  );
  assert.match(functionBlock("reviewPost"), /\{ reason \}/);
});
