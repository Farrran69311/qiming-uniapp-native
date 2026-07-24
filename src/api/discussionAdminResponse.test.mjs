import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("discussion admin adapter covers every supported response outcome", async () => {
  const source = await readFile(
    new URL("./discussion-admin.ts", import.meta.url),
    "utf8"
  );
  const assertionBlock = source.slice(
    source.indexOf("export function assertSuccessfulDiscussionAdminResponse"),
    source.indexOf("export function unwrapResponseData")
  );
  const unwrapBlock = source.slice(
    source.indexOf("export function unwrapResponseData"),
    source.indexOf("function assertListPayload")
  );

  assert.match(assertionBlock, /response\.success === false/);
  assert.match(assertionBlock, /responseData\?\.success === false/);
  assert.match(assertionBlock, /code !== 0 && code !== 200/);
  assert.match(assertionBlock, /if \(!isRecord\(response\)\) return/);
  assert.match(unwrapBlock, /response\.data == null/);
});

test("discussion admin requests propagate failures and preserve sort contract", async () => {
  const source = await readFile(
    new URL("./discussion-admin.ts", import.meta.url),
    "utf8"
  );

  const functionBlock = (start, end) =>
    source.slice(source.indexOf(start), source.indexOf(end));
  const readBlocks = [
    functionBlock(
      "export async function getTeacherDiscussions",
      "export async function getAdminDiscussions"
    ),
    functionBlock(
      "export async function getAdminDiscussions",
      "export async function getAdminDiscussionDetail"
    ),
    functionBlock(
      "export async function getAdminDiscussionDetail",
      "export function getTeacherCourseStats"
    )
  ];

  for (const block of readBlocks) {
    assert.doesNotMatch(block, /catch\s*\(/);
    assert.doesNotMatch(block, /list:\s*\[\]/);
  }

  const adminListBlock = readBlocks[1];
  assert.match(adminListBlock, /"most_replies"/);
  assert.match(adminListBlock, /=== "most_replies" \? "replies"/);
  assert.match(source, /response\.success === false/);
  assert.match(source, /responseData\?\.success === false/);
  assert.doesNotMatch(source, /riskLevel:\s*"low"/);
  assert.doesNotMatch(source, /priority:\s*"medium"/);
});

test("discussion administration pages separate errors from real empty states", async () => {
  const pageUrls = [
    new URL("../views/course/discussion/index.vue", import.meta.url),
    new URL("../views/course/discussion/review.vue", import.meta.url),
    new URL("../views/course/discussion/reports.vue", import.meta.url),
    new URL("../views/system/discussion/sensitive-words.vue", import.meta.url),
    new URL("../views/system/discussion/user-reputation.vue", import.meta.url)
  ];

  for (const url of pageUrls) {
    const page = await readFile(url, "utf8");
    assert.match(page, /loadError/);
    assert.match(page, /@click="fetchData"/);
    assert.match(page, /!loadError/);
  }

  const statistics = await readFile(
    new URL("../views/system/discussion/statistics.vue", import.meta.url),
    "utf8"
  );
  assert.match(statistics, /statisticsError/);
  assert.match(statistics, /auditError/);
  assert.match(statistics, /@click="fetchAuditLogs"/);
});
