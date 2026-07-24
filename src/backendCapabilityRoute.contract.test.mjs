import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("backend-only management pages are capability guarded", async () => {
  const [examRoutes, competitionRoutes] = await Promise.all([
    read("./router/modules/examPaper.ts"),
    read("./router/modules/competition.ts")
  ]);

  assert.match(examRoutes, /guardExamPaperRoute/);
  assert.match(competitionRoutes, /guardCompetitionRoute/);
  assert.match(examRoutes, /ExamPaperGradingDetailCapability/);
  assert.match(examRoutes, /ExamPaperGradingViewCapability/);
  assert.match(examRoutes, /fallbackPath: "\/welcome\/index"/);
  assert.match(competitionRoutes, /fallbackPath: "\/welcome\/index"/);

  for (const path of [
    "/paper/overview/statistics",
    "/paper/list",
    "/paper/grading/list",
    "/question-bank/list"
  ]) {
    assert.ok(examRoutes.includes(path), `missing exam probe ${path}`);
  }

  for (const path of [
    "/competition/event/list",
    "/oj/problem/list",
    "/question-bank/question/list",
    "/essay/list"
  ]) {
    assert.ok(
      competitionRoutes.includes(path),
      `missing competition probe ${path}`
    );
  }
});

test("unavailable capability state is honest and recoverable", async () => {
  const [guard, state] = await Promise.all([
    read("./router/backendCapabilityRoute.ts"),
    read("./components/BackendCapabilityUnavailable.vue")
  ]);

  assert.match(guard, /Promise\.all/);
  assert.match(guard, /timeout: 8000/);
  assert.match(guard, /assertCapabilityProbeSucceeded/);
  assert.match(guard, /status\.value = "unavailable"/);
  assert.match(state, /data-backend-capability-state/);
  assert.match(state, /服务暂不可用/);
  assert.match(state, /重新检查/);
  assert.match(state, /返回工作台/);
  assert.doesNotMatch(state, /模拟数据|mock/i);
});
