import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("student paper list uses real filters and ignores stale requests", async () => {
  const source = await read("./student-center/index.vue");

  assert.match(source, /getFrontendCourseList/);
  assert.match(source, /const requestId = \+\+latestPaperRequest/);
  assert.match(source, /requestId !== latestPaperRequest/);
  assert.match(source, /res\.code !== 0 \|\| !res\.data/);
  assert.match(source, /v-if="!loading && loadError"/);
  assert.match(source, /@click="fetchPapers"/);
  assert.doesNotMatch(source, /高等数学|大学英语|计算机基础/);
});

test("detail and result deep links fail visibly and can recover", async () => {
  const [detail, result] = await Promise.all([
    read("./student-center/detail.vue"),
    read("./result/index.vue")
  ]);

  assert.match(detail, /Number\.isInteger\(paperId\.value\)/);
  assert.match(detail, /Number\(res\.data\.paperId\) !== paperId\.value/);
  assert.match(detail, /class="detail-error"/);
  assert.match(detail, /@click="fetchPaperDetail"/);
  assert.match(detail, /router\.push\("\/student-exam-center\/list"\)/);
  assert.doesNotMatch(detail, /router\.back\(\)/);

  assert.match(result, /Number\.isInteger\(submissionId\.value\)/);
  assert.match(
    result,
    /Number\(res\.data\.submissionId\) !== submissionId\.value/
  );
  assert.match(result, /class="result-error"/);
  assert.match(result, /@click="fetchResult"/);
  assert.match(result, /Object\.values\(answer\)/);
});

test("exam submission is locked again after manual confirmation", async () => {
  const source = await read("./do/index.vue");

  assert.match(source, /const confirmingSubmit = ref\(false\)/);
  assert.match(source, /if \(confirmingSubmit\.value\) return/);
  assert.match(
    source,
    /if \(submitting\.value \|\| submitCompleted \|\| !examData\.submissionId\) return;\s+submitting\.value = true/
  );
  assert.match(
    source,
    /Number\(res\.data\.paper\.paperId\) !== paperId\.value/
  );
  assert.match(source, /:disabled="confirmingSubmit"/);
});

test("student exam pages retain narrow-screen containment", async () => {
  const [list, detail, exam, result] = await Promise.all([
    read("./student-center/index.vue"),
    read("./student-center/detail.vue"),
    read("./do/index.vue"),
    read("./result/index.vue")
  ]);

  assert.match(list, /@media \(width <= 479px\)/);
  assert.match(detail, /@media \(width <= 380px\)/);
  assert.match(exam, /@media screen and \(max-width: 900px\)/);
  assert.match(exam, /overflow-x: auto/);
  assert.match(result, /\.answer-table-scroll[\s\S]*overflow-x: auto/);
});
