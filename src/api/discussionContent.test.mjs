import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isSafeDiscussionLink,
  renderDiscussionContent
} from "./discussionContent.ts";

test("discussion Markdown renders formatting while escaping raw HTML", () => {
  const rendered = renderDiscussionContent(
    '**重点**\n<img src=x onerror="alert(1)">\n<script>alert(1)</script>'
  );

  assert.match(rendered, /<strong>重点<\/strong>/);
  assert.match(rendered, /&lt;img/);
  assert.match(rendered, /&lt;script&gt;/);
  assert.doesNotMatch(rendered, /<(?:img|script)\b/i);
});

test("discussion Markdown only creates links for approved protocols", () => {
  const safe = renderDiscussionContent("[官网](https://example.com/docs)");
  const unsafeValues = [
    "javascript:alert(1)",
    "JaVaScRiPt%3Aalert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "%2F%2Fevil.example"
  ];

  assert.match(safe, /<a href="https:\/\/example\.com\/docs">官网<\/a>/);
  for (const value of unsafeValues) {
    assert.equal(isSafeDiscussionLink(value), false);
    assert.doesNotMatch(
      renderDiscussionContent(`[危险链接](${value})`),
      /<a\b/i
    );
  }
});

test("all discussion content consumers ignore backend HTML", async () => {
  const consumerPaths = [
    "../views/account/course-detail/CourseQA.vue",
    "../views/course/discussion/index.vue",
    "../views/course/discussion/review.vue"
  ];

  for (const relativePath of consumerPaths) {
    const source = await readFile(
      new URL(relativePath, import.meta.url),
      "utf8"
    );
    assert.match(source, /renderDiscussionContent/);
    assert.doesNotMatch(source, /v-html="[^"]*contentHtml/);
  }

  const apiSource = await readFile(
    new URL("./discussion.ts", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(
    apiSource,
    /contentHtml:\s*item\.(?:contentHtml|content)/
  );
});
