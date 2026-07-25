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

test("student home starts its fallback immediately without blocking home data", () => {
  assert.match(accountView, /import \{ getLearningSummary \}/);
  assert.match(accountView, /:data-summary-status="aiSummaryStatus"/);
  assert.match(accountView, /:aria-busy="aiSummaryStatus === 'loading'"/);
  assert.match(accountView, /实时总结暂不可用，当前展示学习总结示例/);
  assert.match(accountView, /const LEARNING_SUMMARY_TIMEOUT_MS = 8000/);
  assert.match(accountView, /await Promise\.race\(\[/);
  assert.match(accountView, /code === 200 && responseItems\.length > 0/);
  assert.match(accountView, /fallbackAiSummaryItems/);
  assert.match(accountView, /window\.setTimeout\(typeNextChar, typingSpeed\)/);
  assert.match(accountView, /window\.setTimeout\(typeNextChar, 320\)/);
  assert.match(accountView, /prefers-reduced-motion: reduce/);
  assert.match(
    accountView,
    /requestId !== learningSummaryRequestId \|\| activeMenu\.value !== "home"/
  );
  assert.match(
    accountView,
    /if \(newVal !== "home"\) \{[\s\S]*learningSummaryRequestId \+= 1;[\s\S]*resetTyping\(\)/
  );
  assert.match(accountView, /window\.clearTimeout\(timeoutTimer\)/);
  assert.match(
    accountView,
    /onUnmounted\([\s\S]*learningSummaryRequestId \+= 1;[\s\S]*resetTyping\(\)/
  );
  assert.match(accountView, /onUnmounted\([\s\S]*resetTyping\(\)/);
  assert.doesNotMatch(
    accountView,
    /setTimeout\(\(\) => startTyping\(\), 150\)/
  );

  const homeDataBlock = accountView.match(
    /const loadHomeData = async \(\) => \{([\s\S]*?)\n\};\n\n\/\/ 加载课程页面数据/
  )?.[1];
  assert.ok(homeDataBlock);
  assert.match(homeDataBlock, /void loadLearningSummary\(\);/);
  assert.doesNotMatch(homeDataBlock, /await loadLearningSummary\(\)/);
  assert.doesNotMatch(homeDataBlock, /Promise\.all/);

  assert.match(
    accountView,
    /aiSummaryStatus\.value = "loading";[\s\S]*startTyping\(\);[\s\S]*await Promise\.race/
  );
  assert.match(
    accountView,
    /aiSummaryStatus\.value = "live";[\s\S]*startTyping\(\)/
  );

  const summaryBlock = accountView.match(
    /const fallbackAiSummaryItems = \[([\s\S]*?)\]\s+as const;/
  )?.[1];
  assert.equal(summaryBlock?.match(/^\s*"/gm)?.length, 6);
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
