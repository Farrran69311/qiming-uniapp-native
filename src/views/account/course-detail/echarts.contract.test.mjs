import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = relativePath =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const plugin = read("../../../plugins/echarts.ts");
const masteryPage = read("MasteryPage.vue");
const courseGrades = read("CourseGrades.vue");

test("course detail charts reuse the shared ECharts core registry", () => {
  assert.match(plugin, /RadarChart/);
  for (const component of [masteryPage, courseGrades]) {
    assert.match(component, /import echarts from "@\/plugins\/echarts"/);
    assert.doesNotMatch(component, /from "echarts"/);
  }
});
