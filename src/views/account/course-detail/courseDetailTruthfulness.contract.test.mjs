import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = relativePath =>
  readFile(new URL(relativePath, import.meta.url), "utf8");

test("HTML animation preview exposes no simulated cover action", async () => {
  const source = await readSource("./HtmlAnimations.vue");

  assert.doesNotMatch(source, /设为封面|captureAndUpload|Camera/);
  assert.doesNotMatch(source, /模拟快照采集|正在为章节/);
  assert.match(source, /@click="openHtmlAnimInNew"/);
});

test("course study shares through a real platform capability", async () => {
  const source = await readSource("./CourseStudy.vue");

  assert.doesNotMatch(source, /title="收藏"|>收藏</);
  assert.match(source, /aria-label="分享当前课时"/);
  assert.match(source, /@click="handleShare"/);
  assert.match(source, /typeof navigator\.share === "function"/);
  assert.match(source, /await copyPlatformText\(shareUrl\)/);
  assert.match(source, /name: "CourseDetail"/);
  assert.match(source, /query: \{ section: "course-learn" \}/);
});

test("student virtual-lab statistics are derived from current items", async () => {
  const source = await readSource("../components/VirtualLab.vue");

  assert.match(source, /const stats = computed\(\(\) => \(\{/);
  assert.match(
    source,
    /animations: labItems\.value\.filter\(item => item\.category === "animation"\)/
  );
  assert.match(
    source,
    /games: labItems\.value\.filter\(item => item\.category === "game"\)/
  );
  assert.match(source, /total: labItems\.value\.length/);
  assert.match(source, /stats\.total/);
  assert.match(source, /实验总数/);
  assert.doesNotMatch(source, /stats\.completed|completed:\s*5|已完成/);
});

test("course materials expose unavailable resources without a no-op action", async () => {
  const source = await readSource("./CourseMaterials.vue");

  assert.match(source, /const hasMaterialUrl =/);
  assert.match(source, /:disabled="!hasMaterialUrl\(item\)"/);
  assert.match(source, /该资料暂未提供可访问地址/);
  assert.match(source, /@click\.stop="viewMaterial\(item\)"/);
  assert.match(source, /\? "查看" : "暂不可用"/);
});

test("homework and exam cards only advertise reachable detail actions", async () => {
  const [source, shell] = await Promise.all([
    readSource("./HomeworkExam.vue"),
    readSource("../course-detail.vue")
  ]);

  assert.match(source, /const canViewHomework =/);
  assert.match(source, /const canViewExam =/);
  assert.match(source, /:disabled="!canViewHomework\(item\)"/);
  assert.match(source, /:disabled="!canViewExam\(item\)"/);
  assert.match(source, /作业信息不完整，暂时无法查看/);
  assert.match(source, /考试信息不完整，暂时无法查看/);
  assert.match(source, /v-else-if="loadError"/);
  assert.match(source, /@click="\$emit\('retry'\)"/);
  assert.match(shell, /const homeworkExamError = ref\(""\)/);
  assert.match(shell, /const loadHomeworkExamData = async/);
  assert.match(shell, /Promise\.all\(\[/);
  assert.doesNotMatch(shell, /const initQAHistory|qaHistoryList|qaStats/);
  assert.doesNotMatch(shell, /catch \([^)]*\) \{\s*\}\s*;?/);
  assert.match(
    source,
    /@media \(max-width: 479px\)[\s\S]*\.homework-tabs \.el-tabs__nav[\s\S]*width: 100%/
  );
});

test("course grades distinguish loading, failure, empty, and unavailable scores", async () => {
  const source = await readSource("./CourseGrades.vue");

  assert.match(source, /const loadError = ref\(""\)/);
  assert.match(source, /v-if="loading" class="grades-loading-state"/);
  assert.match(source, /v-else-if="loadError" class="grades-error-state"/);
  assert.match(source, /throw new Error\(res\?\.msg/);
  assert.match(source, /@click="loadAllData"/);
  assert.match(source, /class="grades-score is-unavailable">--/);
  assert.doesNotMatch(
    source,
    /catch \(error\) \{[\s\S]{0,180}return createEmptyStatistics/
  );
});

test("course discussion hides fake aggregates and validates write responses", async () => {
  const source = await readSource("./CourseQA.vue");
  const apiSource = await readSource("../../../api/discussion.ts");

  assert.doesNotMatch(source, /<div class="stats-card">/);
  assert.doesNotMatch(source, /<div class="hot-tags-card">/);
  assert.doesNotMatch(source, /getDiscussionStats|getHotTags/);
  assert.doesNotMatch(
    apiSource,
    /DiscussionStats|getDiscussionStats|getHotTags|getReviewQueue|mockStats|mockTags|\/api\/v1\/admin\/discussions\/review-queue/
  );
  assert.doesNotMatch(
    source,
    /搜索讨论内容|searchKeyword|value:\s*"mine"|value:\s*"unanswered"/
  );
  assert.match(source, /type CourseQaFilter = "latest" \| "hot" \| "all"/);
  assert.match(source, /parentReplyId: reply\.id/);
  assert.match(source, /replyToUserId: reply\.author\.id/);
  assert.match(source, /\.\.\.\(message\.replyTarget \|\| \{\}\)/);
  assert.match(source, /const ensureDiscussionActionSucceeded =/);
  assert.match(source, /code !== 0 && code !== 200/);
  assert.match(
    source,
    /ensureDiscussionActionSucceeded\(result, "发布讨论失败"\)/
  );
  assert.match(source, /v-else-if="listError" class="list-error-state"/);
});

test("wrong-exercise failures are not presented as empty records", async () => {
  const source = await readSource("../wrong-exercise.vue");

  assert.match(source, /const loadError = ref\(""\)/);
  assert.match(source, /v-else-if="loadError"/);
  assert.match(source, /错题记录加载失败/);
  assert.match(source, /const analysisHistoryError = ref\(""\)/);
  assert.match(source, /AI 分析历史暂未加载/);
  assert.match(source, /Number\.isSafeInteger\(value\) && value > 0/);
  assert.match(source, /const historyRecords = data\?\.records \?\? \[\]/);
  assert.match(source, /请从具体课程进入随练后使用 AI 分析/);
  assert.match(source, /\.filter-date\.el-date-editor--daterange/);
  assert.match(source, /width: 100% !important/);
  assert.doesNotMatch(source, /catch\s*\{\s*\}/);
});
