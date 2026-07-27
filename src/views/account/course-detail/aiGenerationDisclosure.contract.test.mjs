import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const courseStudyPath = new URL("./CourseStudy.vue", import.meta.url);

test("course AI assistant keeps a visible AI-generated-content disclosure", async () => {
  const source = await readFile(courseStudyPath, "utf8");

  assert.match(source, /class="ai-generation-notice"\s+role="note"/);
  assert.match(source, /内容由人工智能生成，仅供学习参考/);
  assert.match(source, /aria-label="以下内容由人工智能生成"/);
  assert.match(source, /<span>人工智能生成<\/span>/);
  assert.match(source, /class="ai-generated-chip">AI生成<\/span>/);
});
