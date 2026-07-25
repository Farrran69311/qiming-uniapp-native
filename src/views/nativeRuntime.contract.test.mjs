import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = relativePath =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const packageJson = JSON.parse(read("../../package.json"));
const assistantFloatButton = read(
  "../components/AiScreenCapture/FloatButton.vue"
);
const mobileNav = read("../layout/components/NavMobile.vue");
const userProfile = read("account/components/UserProfile.vue");
const accountShell = read("account/index.vue");
const aiAppShell = read("account/ai-app/index.vue");
const courseHeader = read("account/course-detail/CourseHeader.vue");
const courseSidebar = read("account/course-detail/CourseSidebar.vue");
const androidAudit = read("../../scripts/android-webview-audit.mjs");
const sharedRouteMatrix = read("../../scripts/wechat-real-session-audit.mjs");
const mainRuntime = read("../main.ts");
const globalStyles = read("../style/index.scss");
const nativeSync = read("../../scripts/sync-app-h5.mjs");
const wechatMiniProgram = read("../../scripts/wechat-miniprogram.mjs");
const platformResourcePreview = read(
  "../components/PlatformResourcePreview/resource-preview.ts"
);
const edgeOneBuild = read("../../scripts/build-edgeone-wechat-h5.mjs");
const edgeFileProxy = read("../../edge-functions/mindmap-file/[[default]].js");
const viteConfig = read("../../vite.config.ts");

test("Android native status bar keeps an extra top clearance", () => {
  assert.match(mainRuntime, /isAndroidNative \? 6 : 0/);
  assert.match(mainRuntime, /qiming-native-android/);
  assert.match(
    globalStyles,
    /qiming-native-android[\s\S]*qiming-native-env-safe-top[\s\S]*\+ 6px/
  );
  assert.match(
    globalStyles,
    /qiming-native-android \.fixed-header[\s\S]*padding-top: var\(--pure-safe-area-top/
  );
  assert.match(
    globalStyles,
    /qiming-native-android \.app-main[\s\S]*64px \+ var\(--pure-safe-area-top/
  );
  assert.match(
    nativeSync,
    /isAndroidNative[\s\S]*\+ \(isAndroidNative \? 6 : 0\)/
  );
});

test("native device runs rebuild the embedded H5 before launch", () => {
  assert.match(
    packageJson.scripts["native:run:android"],
    /^pnpm native:prepare && /
  );
  assert.match(
    packageJson.scripts["native:run:ios"],
    /^pnpm native:prepare && /
  );
});

test("WeChat bootstrap installs the nested uni-app outside the root workspace", () => {
  assert.match(
    wechatMiniProgram,
    /native-app[\s\S]*install[\s\S]*frozen-lockfile/
  );
});

test("mobile production resource previews use the fixed EdgeOne file proxy", () => {
  assert.match(
    platformResourcePreview,
    /VITE_PLATFORM_FILE_PROXY_ORIGIN[\s\S]*platformFileProxyPrefix/
  );
  assert.match(
    viteConfig,
    /mode === "app" \|\| isEdgeOneWechatH5[\s\S]*aiedu-mp\.intelledu\.cn/
  );
  assert.match(edgeOneBuild, /cpSync\(edgeFunctionsDir[\s\S]*edge-functions/);
  assert.match(
    edgeFileProxy,
    /const upstreamOrigin = "https:\/\/aiedu-file\.intelledu\.cn"/
  );
  assert.match(
    edgeFileProxy,
    /allowedMethods = new Set\(\["GET", "HEAD", "OPTIONS"\]\)/
  );
  assert.match(edgeFileProxy, /redirectUrl\.origin !== upstreamOrigin/);
});

test("WeChat DevTools smoke launches the generated project", () => {
  assert.match(
    wechatMiniProgram,
    /automator\.launch\([\s\S]*projectPath: buildDir/
  );
});
test("mobile AI assistant stays above the rendered bottom dock", () => {
  assert.match(assistantFloatButton, /getVisibleBottomDock/);
  assert.match(
    assistantFloatButton,
    /querySelectorAll<HTMLElement>\("\.nav-mobile-container"\)/
  );
  assert.match(
    assistantFloatButton,
    /window\.innerHeight - obstructionTop \+ MOBILE_DOCK_GAP/
  );
  assert.match(assistantFloatButton, /getVisibleAiComposer/);
  assert.match(
    assistantFloatButton,
    /\.ai-mobile-composer-surface, \.nav-mobile-container/
  );
  assert.match(
    assistantFloatButton,
    /window\.innerHeight - size - bottomOffset/
  );
  assert.match(mobileNav, /\.nav-mobile-container\s*\{[\s\S]*position: fixed/);
  assert.match(mobileNav, /bottom: 0/);
  assert.match(androidAudit, /floatingAssistantDock/);
  assert.match(androidAudit, /floatDockClearance < 8/);
});

test("standalone account, AI platform and course shells consume native insets", () => {
  assert.match(
    accountShell,
    /\.header\s*\{[\s\S]*height: calc\(72px \+ var\(--pure-safe-area-top, 0px\)\)[\s\S]*padding-top: var\(--pure-safe-area-top, 0\)/
  );
  assert.match(
    accountShell,
    /\.account-content\s*\{[\s\S]*padding: calc\(84px \+ var\(--pure-safe-area-top, 0px\)\)/
  );
  assert.match(
    aiAppShell,
    /\.ai-app-root\s*\{[\s\S]*height: var\(--qiming-native-vh, 100dvh\)[\s\S]*padding-top: var\(--pure-safe-area-top, 0\)[\s\S]*padding-bottom: var\(--pure-safe-area-bottom, 0\)/
  );
  assert.match(
    courseHeader,
    /\.layout-header\s*\{[\s\S]*top: calc\(15px \+ var\(--pure-safe-area-top, 0px\)\)/
  );
  assert.match(
    courseHeader,
    /@media \(width <= 767px\)[\s\S]*top: calc\(12px \+ var\(--pure-safe-area-top, 0px\)/
  );
  assert.match(
    courseSidebar,
    /\.layout-sidebar\s*\{[\s\S]*top: calc\(80px \+ var\(--pure-safe-area-top, 0px\)\)/
  );
  assert.match(
    courseSidebar,
    /@media \(width <= 767px\)[\s\S]*top: calc\(88px \+ var\(--pure-safe-area-top, 0px\)/
  );
  assert.match(
    courseSidebar,
    /@media \(width <= 479px\)[\s\S]*top: calc\(86px \+ var\(--pure-safe-area-top, 0px\)/
  );
});

test("native profile keeps local activity fallback without calling an absent API", () => {
  assert.doesNotMatch(userProfile, /完成了《Python 基础入门》/);
  assert.match(userProfile, /const learningActivities = ref\(\[\]\)/);
  assert.match(userProfile, /classList\.contains\("qiming-native-webview"\)/);
  assert.match(
    userProfile,
    /const isNativeWebView =[\s\S]*if \(\s*isNativeWebView \|\|[\s\S]*return;/
  );
});

test("account audit ignores SVG style text and expects rendered page content", () => {
  assert.match(androidAudit, /clone\.querySelectorAll\("svg"\)/);
  assert.match(
    androidAudit,
    /activeMenuText: textWithoutSvg\(activeAccountMenu\)/
  );
  assert.match(
    androidAudit,
    /if \(userInfo \|\| destination\)[\s\S]*location\.reload\(\)/
  );
  assert.match(androidAudit, /\.course-detail-root/);
  assert.match(androidAudit, /\.course-detail-root \.el-scrollbar__wrap/);
  assert.match(androidAudit, /\.rightTreeWarp/);
  assert.match(androidAudit, /\.ai-draggable-dialog/);
  assert.match(androidAudit, /\.exam-do-container/);
  assert.match(androidAudit, /\.exam-result-page/);
  assert.match(
    sharedRouteMatrix,
    /name: "student-account-home"[\s\S]*readyExpect: \["课程信息", "AI总结"\][\s\S]*selector: "\.quick-access-card\.course-access"[\s\S]*expect: \["我的课程"\][\s\S]*afterActionAccountMenuText: "课程"/
  );
  assert.match(sharedRouteMatrix, /expect: \["启明智教 · 2D 校园导览"\]/);
  assert.match(
    sharedRouteMatrix,
    /name: "student-course-work"[\s\S]*expect: \["作业考试"\]/
  );
});

test("real route audit enforces usable width on teacher mobile workflows", () => {
  assert.match(sharedRouteMatrix, /minContentUtilization: 0\.9/g);
  assert.equal(
    sharedRouteMatrix.match(/minContentUtilization: 0\.9/g)?.length,
    6
  );
  assert.match(sharedRouteMatrix, /contentUtilizationRoutes\.length !== 6/);
  assert.match(sharedRouteMatrix, /content-too-narrow:/);
  assert.match(sharedRouteMatrix, /activeDialogBody/);
  assert.match(sharedRouteMatrix, /primaryRouteChild/);
  assert.match(sharedRouteMatrix, /Emulation\.setUserAgentOverride/);
  assert.match(sharedRouteMatrix, /QimingTest/);
});

test("Android route runner enforces compact digital-human checks", () => {
  const androidRunner = read("../../scripts/android-real-device-audit.mjs");
  assert.match(androidRunner, /expect-compact-digital-human/);
  assert.match(androidRunner, /expectsCompactDigitalHuman/);
  assert.match(androidRunner, /"\/account\/ai-app"/);
  assert.match(androidRunner, /"\/ai-app\/chat"/);
  assert.match(androidRunner, /"\/ai-app\/workspace"/);
  assert.doesNotMatch(androidRunner, /routePath\.startsWith\("\/ai-app\/"\)/);
});

test("Android route runner resolves real student deep-link fixtures", () => {
  const androidRunner = read("../../scripts/android-real-device-audit.mjs");
  assert.match(androidRunner, /name: "student-homework-detail"/);
  assert.match(androidRunner, /name: "student-course-exam-detail"/);
  assert.match(androidRunner, /name: "student-paper-detail"/);
  assert.match(androidRunner, /name: "student-exam-do"/);
  assert.match(androidRunner, /name: "student-exam-result"/);
  assert.match(
    androidRunner,
    /homeworkId=\{homeworkId\}&courseId=\{courseId\}/
  );
  assert.match(androidRunner, /examId=\{examId\}&courseId=\{courseId\}/);
  assert.match(androidRunner, /student-exam-center\/detail\/\{paperId\}/);
  assert.match(androidRunner, /student-exam-center\/do\/\{paperId\}/);
  assert.match(androidRunner, /exam-paper\/result\/\{submissionId\}/);
  assert.match(androidRunner, /course\/\$\{resourceName\}\/list\?courseId=/);
  assert.match(
    androidRunner,
    /frontend\/v1\/paper\/list\?pageNum=1&pageSize=100/
  );
});

test("Android dynamic fixture gaps remain explicit partial skips", () => {
  const androidRunner = read("../../scripts/android-real-device-audit.mjs");
  assert.match(androidRunner, /--fixture-check/);
  assert.match(androidRunner, /--allow-exam-start/);
  assert.match(androidRunner, /requiresWriteOptIn: true/);
  assert.match(androidRunner, /getRouteFixtureUnavailable/);
  assert.match(androidRunner, /fixturePolicyAssertions: 3/);
  assert.match(androidRunner, /status: "skipped"/);
  assert.match(androidRunner, /\? "resolved" : "partial"/);
  assert.match(androidRunner, /student-paper-api-unavailable/);
  assert.match(androidRunner, /fixtureUnavailable/);
  assert.match(androidRunner, /summary\.totals\.skipped > 0/);
  assert.match(androidRunner, /process\.exitCode = 4/);
});
