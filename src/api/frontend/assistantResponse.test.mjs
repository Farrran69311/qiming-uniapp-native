import assert from "node:assert/strict";
import test from "node:test";

import {
  AssistantResponseError,
  unwrapAssistantResponseData
} from "./assistantResponse.ts";

test("assistant mutations accept valid success envelopes", () => {
  const mutationData = {
    status: "updated",
    message: "保存成功",
    resource: { resource_id: "resource-1" }
  };

  assert.strictEqual(
    unwrapAssistantResponseData(
      { code: 200, msg: "OK", data: mutationData },
      "保存资源",
      { requireResource: true }
    ),
    mutationData
  );
  assert.deepEqual(
    unwrapAssistantResponseData(
      { code: "0", data: { status: "deleted" } },
      "删除资源"
    ),
    { status: "deleted" }
  );
});

test("assistant mutations reject explicit business failures", () => {
  for (const response of [
    { code: 500, msg: "服务端保存失败", data: { status: "updated" } },
    { code: 200, data: { status: "failed", message: "资源处理失败" } },
    { code: 200, success: false, data: { status: "updated" } },
    { code: 200, data: { status: "updated", success: false } }
  ]) {
    assert.throws(
      () => unwrapAssistantResponseData(response, "资源操作"),
      AssistantResponseError
    );
  }
});

test("assistant usage requires accepted data and mutations require resources", () => {
  assert.throws(
    () =>
      unwrapAssistantResponseData(
        {
          code: 200,
          data: { accepted: false, status: "rejected", message: "未记录" }
        },
        "记录资源使用",
        { requireAccepted: true }
      ),
    /未记录/
  );

  for (const response of [
    { code: 200, data: null },
    { code: 200, data: {} },
    { code: 200, data: { status: "updated" } },
    {
      code: 200,
      data: { status: "updated", resource: { resource_id: "" } }
    }
  ]) {
    assert.throws(
      () =>
        unwrapAssistantResponseData(response, "保存资源", {
          requireResource: true
        }),
      AssistantResponseError
    );
  }
});

test("assistant task creation requires an accepted task with a stable id", () => {
  const taskData = {
    accepted: true,
    status: "pending",
    task: { task_id: "task-1" }
  };
  assert.strictEqual(
    unwrapAssistantResponseData({ code: 200, data: taskData }, "创建资源任务", {
      requireAccepted: true,
      requireTask: true
    }),
    taskData
  );

  for (const data of [
    { accepted: false, status: "unavailable", task: { task_id: "task-1" } },
    { accepted: true, status: "pending" },
    { accepted: true, status: "pending", task: {} },
    { accepted: true, status: "pending", task: { task_id: "" } }
  ]) {
    assert.throws(
      () =>
        unwrapAssistantResponseData({ code: 200, data }, "创建资源任务", {
          requireAccepted: true,
          requireTask: true
        }),
      AssistantResponseError
    );
  }
});

test("assistant collection and trace responses require arrays", () => {
  assert.deepEqual(
    unwrapAssistantResponseData(
      { code: 200, data: { status: "ok", list: [] } },
      "加载资源列表",
      { requireList: true }
    ),
    { status: "ok", list: [] }
  );
  assert.deepEqual(
    unwrapAssistantResponseData(
      { code: 200, data: { status: "ok", trace: [] } },
      "加载任务轨迹",
      { requireTrace: true }
    ),
    { status: "ok", trace: [] }
  );

  for (const [data, options] of [
    [{ status: "ok", list: {} }, { requireList: true }],
    [{ status: "ok", trace: null }, { requireTrace: true }]
  ]) {
    assert.throws(
      () =>
        unwrapAssistantResponseData(
          { code: 200, data },
          "加载资源数据",
          options
        ),
      AssistantResponseError
    );
  }
});
