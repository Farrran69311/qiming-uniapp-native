import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = relativePath =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const accountView = read("index.vue");
const globalStyles = read("../../style/index.scss");

test("student home keeps five reminders on a four-second vertical carousel", () => {
  assert.match(accountView, /direction="vertical"/);
  assert.match(accountView, /:interval="4000"/);
  assert.match(accountView, /v-for="\(notice, index\) in notices"/);

  const noticesBlock = accountView.match(
    /const notices = ref\(\[([\s\S]*?)\]\);/
  )?.[1];
  assert.equal(noticesBlock?.match(/^\s*"/gm)?.length, 5);
});

test("student home prefers a valid learning summary and types the six-item fallback", () => {
  assert.match(accountView, /import \{ getLearningSummary \}/);
  assert.match(accountView, /code === 200 && responseItems\.length > 0/);
  assert.match(accountView, /fallbackAiSummaryItems/);
  assert.match(accountView, /window\.setTimeout\(typeNextChar, typingSpeed\)/);
  assert.match(accountView, /window\.setTimeout\(typeNextChar, 320\)/);
  assert.match(accountView, /prefers-reduced-motion: reduce/);
  assert.match(accountView, /const LEARNING_SUMMARY_TIMEOUT_MS = 8000/);
  assert.match(accountView, /return await Promise\.race\(\[/);
  assert.match(
    accountView,
    /window\.setTimeout\([\s\S]*LEARNING_SUMMARY_TIMEOUT_MS/
  );
  assert.match(accountView, /requestId !== learningSummaryRequestId/);
  assert.match(accountView, /data-summary-status="aiSummaryStatus"/);
  assert.match(accountView, /实时总结暂不可用，当前展示学习总结示例/);
  assert.match(accountView, /aiSummaryStatus\.value = "loading"/);
  assert.match(accountView, /aiSummaryStatus\.value = "live"/);
  assert.match(accountView, /aiSummaryStatus\.value = "fallback"/);
  assert.match(
    accountView,
    /newVal !== "home"[\s\S]*invalidateLearningSummaryRequest\(\)[\s\S]*resetTyping\(\)/
  );
  assert.match(
    accountView,
    /onUnmounted\([\s\S]*invalidateLearningSummaryRequest\(\)[\s\S]*resetTyping\(\)/
  );
  assert.doesNotMatch(
    accountView,
    /setTimeout\(\(\) => startTyping\(\), 150\)/
  );

  const summaryBlock = accountView.match(
    /const fallbackAiSummaryItems = \[([\s\S]*?)\]\s+as const;/
  )?.[1];
  assert.equal(summaryBlock?.match(/^\s*"/gm)?.length, 6);

  const loadHomeBlock = accountView.slice(
    accountView.indexOf("const loadHomeData = async"),
    accountView.indexOf("// 加载课程页面数据")
  );
  assert.match(loadHomeBlock, /beginLearningSummaryRefresh\(\);/);
  assert.doesNotMatch(loadHomeBlock, /await loadLearningSummary/);
  assert.doesNotMatch(loadHomeBlock, /Promise\.all/);

  const refreshBlock = accountView.slice(
    accountView.indexOf("const beginLearningSummaryRefresh"),
    accountView.indexOf("const initialLoadDone")
  );
  assert.match(
    refreshBlock,
    /aiSummaryList\.value = \[\.\.\.fallbackAiSummaryItems\];[\s\S]*aiSummaryStatus\.value = "loading";[\s\S]*startTyping\(\);/
  );
  assert.ok(
    refreshBlock.indexOf("startTyping();") <
      refreshBlock.indexOf("void loadLearningSummary(requestId);")
  );
});

test("native account layout applies its shared gap to every destination", () => {
  const accountLayoutBlock = globalStyles.match(
    /html\.qiming-native-webview \.account-container \.account-content,[\s\S]*?\{([\s\S]*?)\n\}/
  )?.[1];

  assert.ok(accountLayoutBlock);
  assert.match(accountLayoutBlock, /display: flex !important;/);
  assert.match(accountLayoutBlock, /flex-direction: column !important;/);
  assert.match(accountLayoutBlock, /gap: 14px !important;/);
  assert.doesNotMatch(accountLayoutBlock, /classroom/i);
});
