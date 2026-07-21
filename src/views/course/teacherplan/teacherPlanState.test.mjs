import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  canDownloadTeacherPlan,
  canPollTeacherPlan,
  claimTeacherPlanPoller,
  clampTeacherPlanProgress,
  getTeacherPlanPollDelay,
  isValidTeacherPlanCreation,
  isTeacherPlanTerminal,
  mergeTeacherPlanProgress,
  normalizeTeacherPlan,
  normalizeTeacherPlanProgress,
  normalizeTeacherPlanStatus,
  teacherPlanFromCreation,
  teacherPlanMatchesCreation,
  teacherPlanProgressFromPlan,
  teacherPlanStateSignature
} from "./teacherPlanState.ts";

const basePlan = {
  teacherPlanId: 123,
  courseId: 39,
  chapterId: 97,
  courseName: "测试课程",
  chapterName: "测试章节",
  taskId: "task-123",
  status: "pending",
  progressPercent: 0,
  stage: "queued",
  message: "任务已创建",
  errorCode: "",
  retryable: false,
  downloadUrl: "",
  availability: "synced",
  updatedAt: "2026-07-20T12:00:00Z",
  createdAt: "2026-07-20T12:00:00Z"
};

const creation = {
  teacherPlanId: 124,
  taskId: "task-124",
  status: "pending",
  progressPercent: 0,
  stage: "queued",
  message: "教案生成任务已创建",
  errorCode: "",
  retryable: false,
  requestId: "request-124",
  availability: "synced",
  courseId: 39,
  chapterId: 97,
  courseName: "测试课程",
  chapterName: "测试章节",
  createdAt: "2026-07-21T02:00:00Z"
};

test("normalizes every documented progress percentage without fake growth", () => {
  for (const percentage of [0, 10, 30, 75]) {
    const plan = normalizeTeacherPlan({
      ...basePlan,
      status: percentage === 0 ? "pending" : "processing",
      progressPercent: percentage
    });
    assert.equal(plan.progressPercent, percentage);
  }

  const completed = normalizeTeacherPlan({
    ...basePlan,
    status: "completed",
    progressPercent: 99
  });
  assert.equal(completed.progressPercent, 100);
  assert.equal(clampTeacherPlanProgress(-5, "processing"), 0);
  assert.equal(clampTeacherPlanProgress(120, "processing"), 100);
});

test("uses the rich status contract and treats legacy progress as an enum", () => {
  assert.equal(normalizeTeacherPlanStatus("created"), "pending");
  assert.equal(normalizeTeacherPlanStatus("running"), "processing");
  assert.equal(normalizeTeacherPlanStatus("succeeded"), "completed");
  assert.equal(normalizeTeacherPlanStatus("canceled"), "cancelled");
  assert.equal(normalizeTeacherPlanStatus("timeout"), "timed_out");
  assert.equal(normalizeTeacherPlanStatus(undefined, 2), "completed");
  assert.equal(normalizeTeacherPlanStatus(undefined, 3), "failed");
  assert.equal(normalizeTeacherPlanStatus(undefined, 75), "unknown");
  assert.equal(normalizeTeacherPlanStatus(undefined, 100), "unknown");
});

test("keeps terminal, availability, polling, and download decisions separate", () => {
  for (const status of ["completed", "failed", "cancelled", "timed_out"]) {
    assert.equal(isTeacherPlanTerminal(status), true);
  }
  assert.equal(isTeacherPlanTerminal("processing"), false);

  assert.equal(
    canPollTeacherPlan({ status: "processing", availability: "synced" }),
    true
  );
  assert.equal(
    canPollTeacherPlan({ status: "processing", availability: "stale" }),
    true
  );
  assert.equal(
    canPollTeacherPlan({ status: "processing", availability: "unavailable" }),
    false
  );
  assert.equal(
    canPollTeacherPlan({ status: "processing", availability: "not_found" }),
    false
  );
  assert.equal(
    canPollTeacherPlan({ status: "failed", availability: "synced" }),
    false
  );

  assert.equal(
    canDownloadTeacherPlan({
      status: "completed",
      downloadUrl: "https://files.example/plan.md"
    }),
    true
  );
  assert.equal(
    canDownloadTeacherPlan({ status: "completed", downloadUrl: "" }),
    false
  );
  assert.equal(
    canDownloadTeacherPlan({
      status: "processing",
      downloadUrl: "https://files.example/plan.md"
    }),
    false
  );
});

test("merges a progress response into the matching list item", () => {
  const plan = normalizeTeacherPlan(basePlan);
  const progress = normalizeTeacherPlanProgress({
    progress: 1,
    taskId: "task-123",
    status: "processing",
    progressPercent: 30,
    stage: "model_generation",
    message: "正在生成教案内容",
    errorCode: "",
    retryable: false,
    requestId: "request-123",
    availability: "synced",
    updatedAt: "2026-07-20T12:01:00Z",
    downloadUrl: ""
  });
  const merged = mergeTeacherPlanProgress(plan, progress);

  assert.equal(merged.teacherPlanId, plan.teacherPlanId);
  assert.equal(merged.status, "processing");
  assert.equal(merged.progressPercent, 30);
  assert.equal(merged.stage, "model_generation");
  assert.equal(merged.updatedAt, progress.updatedAt);
  assert.deepEqual(
    teacherPlanProgressFromPlan(merged).progressPercent,
    progress.progressPercent
  );
});

test("creation identity creates and matches only the authoritative plan", () => {
  assert.equal(isValidTeacherPlanCreation(creation), true);
  assert.equal(isValidTeacherPlanCreation({ ...creation, taskId: "" }), false);

  const createdPlan = teacherPlanFromCreation(creation);
  assert.equal(createdPlan.teacherPlanId, creation.teacherPlanId);
  assert.equal(createdPlan.taskId, creation.taskId);
  assert.equal(createdPlan.courseId, creation.courseId);
  assert.equal(createdPlan.chapterId, creation.chapterId);
  assert.equal(teacherPlanMatchesCreation(createdPlan, creation), true);
  assert.equal(
    teacherPlanMatchesCreation(
      { ...createdPlan, taskId: "stale-legacy-task" },
      creation
    ),
    false
  );
  assert.equal(
    teacherPlanMatchesCreation({ ...createdPlan, courseId: 41 }, creation),
    false
  );
});

test("backs polling off and adds deterministic jitter after network errors", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 8].map(count => getTeacherPlanPollDelay(count)),
    [2000, 3000, 5000, 10000, 15000, 15000]
  );
  assert.deepEqual(
    [1, 2, 3, 4, 5].map(errors => getTeacherPlanPollDelay(0, errors, 0.5)),
    [2000, 4000, 8000, 15000, 15000]
  );
});

test("state signatures change for authoritative progress fields", () => {
  const plan = normalizeTeacherPlan(basePlan);
  const initial = teacherPlanStateSignature(plan);
  assert.notEqual(
    teacherPlanStateSignature({ ...plan, progressPercent: 10 }),
    initial
  );
  assert.notEqual(
    teacherPlanStateSignature({ ...plan, availability: "stale" }),
    initial
  );
});

test("one teacher plan can have only one active poller", () => {
  let firstStops = 0;
  let secondStops = 0;
  const releaseFirst = claimTeacherPlanPoller(123, () => {
    firstStops += 1;
  });
  const releaseSecond = claimTeacherPlanPoller(123, () => {
    secondStops += 1;
  });

  assert.equal(firstStops, 1);
  assert.equal(secondStops, 0);
  releaseFirst();
  releaseSecond();
});

test("PlanList uses list state directly and wires the full polling lifecycle", () => {
  const source = readFileSync(
    new URL("./components/PlanList.vue", import.meta.url),
    "utf8"
  );
  const listLoader = source.slice(
    source.indexOf("const fetchPlanList"),
    source.indexOf("function scheduleProgressPoll")
  );

  assert.doesNotMatch(source, /:percentage\s*=\s*["']75["']/);
  assert.doesNotMatch(listLoader, /Promise\.all|getTeacherPlanProgress/);
  assert.match(source, /currentProgress\.progressPercent/);
  assert.match(source, /pending/);
  assert.match(source, /processing/);
  assert.match(source, /completed/);
  assert.match(source, /failed/);
  assert.match(source, /cancelled/);
  assert.match(source, /timed_out/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /onBeforeUnmount/);
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /canDownloadTeacherPlan/);
});

test("teacher-plan creation response is handed off and focused by exact identity", () => {
  const generator = readFileSync(
    new URL("./components/PlanGenerator.vue", import.meta.url),
    "utf8"
  );
  const page = readFileSync(new URL("./index.vue", import.meta.url), "utf8");
  const list = readFileSync(
    new URL("./components/PlanList.vue", import.meta.url),
    "utf8"
  );

  assert.match(generator, /hasAuthoritativeTaskIdentity\(res\.data\)/);
  assert.match(generator, /emit\("plan-created", creation\)/);
  assert.match(page, /:created-plan="createdPlan"/);
  assert.match(page, /@plan-created="handlePlanCreated"/);
  assert.match(list, /teacherPlanMatchesCreation/);
  assert.match(list, /item\.teacherPlanId === creation\.teacherPlanId/);
  assert.match(list, /item\.taskId === creation\.taskId/);
  assert.match(list, /nextProgress\.taskId !== plan\.taskId/);
  const retryFlow = list.slice(
    list.indexOf("const retryPlan"),
    list.indexOf("watch(\n  () => props.courseId")
  );
  assert.match(retryFlow, /isValidTeacherPlanCreation\(retryCreation\)/);
  assert.match(retryFlow, /teacherPlanFromCreation\(retryCreation\)/);
  assert.doesNotMatch(list, /checkProgress\(planList\.value\[0\]\)/);
});

test("course API exposes the complete teacher-plan contract", () => {
  const source = readFileSync(
    new URL("../../../api/course.ts", import.meta.url),
    "utf8"
  );
  for (const field of [
    "taskId",
    "status",
    "progressPercent",
    "stage",
    "message",
    "errorCode",
    "retryable",
    "requestId",
    "availability",
    "downloadUrl",
    "updatedAt",
    "createdAt"
  ]) {
    assert.match(source, new RegExp(`\\b${field}\\b`));
  }
});
