import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const welcomeDir = dirname(fileURLToPath(import.meta.url));
const readWelcomeFile = relativePath =>
  readFileSync(resolve(welcomeDir, relativePath), "utf8");

const welcome = readWelcomeFile("index.vue");
const stats = readWelcomeFile("components/StatsOverview.vue");
const teacherStudentUsage = readWelcomeFile(
  "components/charts/TeacherStudentUsage.vue"
);
const weekUsage = readWelcomeFile("components/charts/WeekUsage.vue");
const efficientIndex = readWelcomeFile("components/charts/EfficientIndex.vue");
const courseStatistics = readWelcomeFile(
  "components/charts/CourseStatistics.vue"
);

test("welcome copy and visuals do not claim fabricated live preparation", () => {
  assert.doesNotMatch(welcome, /实时更新|已经为您准备好了/);
  assert.doesNotMatch(welcome, /Math\.random/);
  assert.match(welcome, /在这里查看课程、学情与教学分析/);
});

test("overview and admin usage charts separate failures from real empty data", () => {
  assert.match(stats, /response\?\.code !== 200/);
  assert.match(stats, /v-if="loadError && !loading"/);
  assert.match(stats, /@click="fetchStats"/);

  for (const source of [teacherStudentUsage, weekUsage]) {
    assert.match(source, /loadError\.value/);
    assert.match(source, /v-if="loadError"/);
    assert.match(source, /@click="fetchData"/);
    assert.match(source, /v-else-if=/);
  }
});

test("course analysis uses only authoritative progress and score statistics", () => {
  assert.match(courseStatistics, /getCourseUsersProgress\(\)/);
  assert.match(courseStatistics, /getCourseUsersExamInfo\(\)/);
  assert.doesNotMatch(courseStatistics, /@\/api\/(?:homework|exam)/);
  assert.doesNotMatch(
    courseStatistics,
    /getHomeworkList|getExamList|scoreDistribution|基本信息统计/
  );
  assert.match(courseStatistics, /progressLoadError\.value/);
  assert.match(courseStatistics, /examLoadError\.value/);
  assert.match(courseStatistics, /v-if="progressLoadError"/);
  assert.match(courseStatistics, /v-if="examLoadError"/);
});

test("report export is real, guarded and failure-aware", () => {
  assert.match(courseStatistics, /writeFile\(wb,/);
  assert.match(courseStatistics, /当前课程暂无可导出的分析数据/);
  assert.match(courseStatistics, /分析报告导出失败，请重试/);
  assert.match(courseStatistics, /:disabled="!hasExportData"/);
});

test("efficiency analysis exposes retry and keeps its dialog within a phone", () => {
  assert.match(efficientIndex, /效率评价指标暂时无法加载/);
  assert.match(efficientIndex, /activeCourseResponse\.status !== "fulfilled"/);
  assert.match(efficientIndex, /@click="fetchData"/);
  assert.match(efficientIndex, /width="min\(500px, calc\(100vw - 24px\)\)"/);
  assert.match(efficientIndex, /v-for="\(item, index\) in pagedSuggestions"/);
});

test("unused random dashboard templates are not kept as production sources", () => {
  for (const relativePath of [
    "data.ts",
    "components/table/index.vue",
    "components/table/columns.tsx",
    "components/charts/ChartBar.vue",
    "components/charts/ChartLine.vue",
    "components/charts/ChartRound.vue"
  ]) {
    assert.equal(existsSync(resolve(welcomeDir, relativePath)), false);
  }
});
