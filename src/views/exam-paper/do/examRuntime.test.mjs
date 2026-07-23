import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ExamAnswerRetryQueue,
  createExamDeadlineClock,
  getAnswerRetryDelay,
  getExamRemainingSeconds,
  updateExamServerOffset
} from "./examRuntime.ts";

test("an older failed save cannot replace a newer pending answer", () => {
  const queue = new ExamAnswerRetryQueue();
  const firstRevision = queue.nextRevision(101);
  const secondRevision = queue.nextRevision(101);

  queue.enqueue({ questionId: 101, answer: "B", revision: secondRevision });
  queue.enqueue({ questionId: 101, answer: "A", revision: firstRevision });

  assert.deepEqual(queue.snapshot(), [
    { questionId: 101, answer: "B", revision: secondRevision }
  ]);
});

test("a newer direct save acknowledges an older queued retry", () => {
  const queue = new ExamAnswerRetryQueue();
  const firstRevision = queue.nextRevision(101);
  const secondRevision = queue.nextRevision(101);

  queue.enqueue({ questionId: 101, answer: "A", revision: firstRevision });
  queue.acknowledge(101, secondRevision);

  assert.equal(queue.size, 0);
});

test("batch acknowledgement preserves an answer changed during the request", () => {
  const queue = new ExamAnswerRetryQueue();
  const firstRevision = queue.nextRevision(101);
  queue.enqueue({ questionId: 101, answer: "A", revision: firstRevision });
  const batch = queue.snapshot();

  const secondRevision = queue.nextRevision(101);
  queue.enqueue({ questionId: 101, answer: "B", revision: secondRevision });
  queue.acknowledgeBatch(batch);

  assert.deepEqual(queue.snapshot(), [
    { questionId: 101, answer: "B", revision: secondRevision }
  ]);
});

test("restored revisions continue monotonically and retry delay is capped", () => {
  const queue = new ExamAnswerRetryQueue();
  queue.restore([{ questionId: 201, answer: ["A"], revision: 7 }]);

  assert.equal(queue.nextRevision(201), 8);
  assert.equal(getAnswerRetryDelay(0), 1000);
  assert.equal(getAnswerRetryDelay(10), 30000);
});

test("exam deadline follows server time across background timer suspension", () => {
  const clock = createExamDeadlineClock(120, 1_000_000, 900_000);
  assert.equal(getExamRemainingSeconds(clock, 930_000), 90);
  assert.equal(getExamRemainingSeconds(clock, 1_030_000), 0);

  const corrected = updateExamServerOffset(clock, 1_031_000, 930_000);
  assert.equal(getExamRemainingSeconds(corrected, 930_000), 89);
});

test("answer page keeps the recovery, heartbeat and anti-cheat runtime wired", async () => {
  const source = await readFile(
    new URL("./index.vue", import.meta.url),
    "utf8"
  );
  const requiredRuntimeCalls = [
    "getExamSession(examData.submissionId)",
    "saveAnswersBatch({",
    "examHeartbeat({",
    "reportAntiCheatEvent({",
    'reportExamEvent("window_blur"',
    'document.addEventListener("visibilitychange"',
    "await prepareAnswersForSubmit()"
  ];

  requiredRuntimeCalls.forEach(snippet => {
    assert.equal(
      source.includes(snippet),
      true,
      `missing runtime wiring: ${snippet}`
    );
  });
});

test("answer page keeps server-time countdown and mobile structure wired", async () => {
  const source = await readFile(
    new URL("./index.vue", import.meta.url),
    "utf8"
  );
  const requiredLayoutAndClock = [
    "resetExamClock(",
    "syncExamServerTime(res.data?.serverTime)",
    "setInterval(syncExamRemainingTime, 1000)",
    "@media screen and (max-width: 900px)",
    "flex: 0 0 44px",
    "min-width: 520px"
  ];

  requiredLayoutAndClock.forEach(snippet => {
    assert.equal(
      source.includes(snippet),
      true,
      `missing mobile/clock wiring: ${snippet}`
    );
  });
});

test("answer page keeps a recoverable entry failure state", async () => {
  const source = await readFile(
    new URL("./index.vue", import.meta.url),
    "utf8"
  );

  [
    'const loadError = ref("")',
    "getExamLoadErrorMessage(error)",
    'class="exam-load-error"',
    "retryLoadExam",
    'router.replace("/student-exam-center/list")'
  ].forEach(snippet => {
    assert.equal(
      source.includes(snippet),
      true,
      `missing recoverable entry failure state: ${snippet}`
    );
  });
  assert.doesNotMatch(source, /router\.back\(\)/);
});
