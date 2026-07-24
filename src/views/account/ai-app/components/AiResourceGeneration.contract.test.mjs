import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("./AiResourceGeneration.vue", import.meta.url),
  "utf8"
);
const aiAppSource = await readFile(
  new URL("../index.vue", import.meta.url),
  "utf8"
);
const assistantApiSource = await readFile(
  new URL("../../../../api/frontend/assistantResponse.ts", import.meta.url),
  "utf8"
);

const sourceBlock = (start, end) =>
  source.slice(source.indexOf(start), source.indexOf(end));

test("resource generation creates a real backend task", () => {
  const createBlock = sourceBlock(
    "const handleCreateTask",
    "const openResourceDetail"
  );

  assert.match(createBlock, /await createAssistantResourceTask\(\{/);
  assert.match(createBlock, /unwrapAssistantResponseData/);
  assert.match(createBlock, /requireAccepted: true, requireTask: true/);
  assert.match(createBlock, /await selectTask\(data\.task!\.task_id\)/);
  assert.doesNotMatch(createBlock, /createDemoTask\(\)/);
  assert.doesNotMatch(createBlock, /正在模拟生成/);
});

test("task, resource and activity reads reject invalid business envelopes", () => {
  assert.ok((source.match(/requireList: true/g) || []).length >= 5);
  assert.match(source, /requireTrace: true/);
  assert.match(source, /AssistantListResourceTasksResp/);
  assert.match(source, /AssistantListResourcesResp/);
  assert.match(source, /AssistantListResourceTaskLogsResp/);
});

test("resource task lists contain only backend data", () => {
  const mergeBlock = sourceBlock(
    "const mergeServerTasks",
    "const retryTaskList"
  );
  const lifecycleBlock = sourceBlock("onMounted(() =>", "</script>");

  assert.match(mergeBlock, /backendResourceTotal\.value > 0/);
  assert.match(mergeBlock, /createBackendResourceTask\(\)/);
  assert.match(mergeBlock, /\.\.\.serverTasks/);
  assert.doesNotMatch(mergeBlock, /demoTasks|currentCourseDemoTasks/);
  assert.doesNotMatch(
    lifecycleBlock,
    /ensureDemoTasksForCurrentCourse|hydrateDemoState|resumeDemoTasks|restoreSelectedDemoTask/
  );
  assert.doesNotMatch(
    source,
    /demoTasks|demoTaskBatches|createDemoTask|buildDemoResources|ai-resource-generation-demo-state/
  );
  assert.doesNotMatch(source, /const currentTimestamp/);
});

test("routine task rail reports the unavailable backend capability honestly", () => {
  const automationBlock = aiAppSource.slice(
    aiAppSource.indexOf("activeRail === `automation`"),
    aiAppSource.indexOf("<!-- 【场景 D】")
  );

  assert.match(automationBlock, /常规任务暂未接入/);
  assert.match(
    automationBlock,
    /后端尚未提供常规任务的配置、启停与执行记录接口/
  );
  assert.doesNotMatch(aiAppSource, /const routineTasks/);
  assert.doesNotMatch(automationBlock, /el-switch|上次执行|任务执行历史记录/);
});

test("task, resource and activity failures expose independent retries", () => {
  for (const state of [
    "taskLoadError",
    "resourceLoadError",
    "taskActivityLoadError"
  ]) {
    assert.match(source, new RegExp(`v-if="${state}"`));
  }
  for (const retry of [
    "retryTaskList",
    "retryResourceList",
    "retryTaskActivity"
  ]) {
    assert.match(source, new RegExp(`@click="${retry}"`));
  }
  assert.match(source, /v-else-if="!resourceLoadError"/);
  assert.match(source, /!tasks\.length && !taskLoadError/);
});

test("required usage writes cannot report success after a failed request", () => {
  const completeBlock = sourceBlock(
    "const handleCompleteResource",
    "const handleSubmitFeedback"
  );
  const feedbackBlock = sourceBlock(
    "const handleSubmitFeedback",
    "const syncSelectedResource"
  );

  for (const block of [completeBlock, feedbackBlock]) {
    assert.match(block, /await submitResourceUsage\(/);
    assert.match(block, /catch \(error\)/);
    assert.match(block, /ElMessage\.error\(/);
  }
  assert.match(source, /requireAccepted: true/);
  assert.match(assistantApiSource, /code !== 0 && code !== 200/);
  assert.match(assistantApiSource, /data\.accepted !== true/);
});

test("resource mutations validate business envelopes before success", () => {
  for (const marker of ["保存资源", "审核资源", "发布资源", "删除资源"]) {
    assert.match(
      source,
      new RegExp(`unwrapAssistantResponseData[\\s\\S]{0,160}${marker}`)
    );
  }
  assert.equal(source.match(/requireResource: true/g)?.length, 3);
});

test("resource deletion is confirmed and protected from duplicate submits", () => {
  const deleteBlock = sourceBlock(
    "const handleDeleteResource",
    "onMounted(() =>"
  );

  assert.match(deleteBlock, /deleteSubmitting\.value/);
  assert.match(deleteBlock, /await ElMessageBox\.confirm\(/);
  assert.match(
    deleteBlock,
    /await deleteAssistantResource\(resource\.resource_id\)/
  );
  assert.ok(
    deleteBlock.indexOf("ElMessageBox.confirm") <
      deleteBlock.indexOf("deleteAssistantResource")
  );
});

test("phone resource dialogs scroll without clipping action groups", () => {
  assert.match(source, /max-height: calc\(100dvh - 16px\)/);
  assert.match(
    source,
    /assistant-resource-dialog \.el-dialog__body[\s\S]*overflow-y: auto/
  );
  assert.match(
    source,
    /\.resource-dialog__action-group[\s\S]*min-height: 44px/
  );
  assert.match(
    source,
    /assistant-resource-dialog \.el-dialog__footer[\s\S]*overflow-y: auto/
  );
});
