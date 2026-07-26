import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workbench = await readFile(
  new URL("./index.vue", import.meta.url),
  "utf8"
);
const sharedEntry = await readFile(
  new URL("../../ai-app/index.vue", import.meta.url),
  "utf8"
);
const profile = await readFile(
  new URL("./components/AiLearningProfile.vue", import.meta.url),
  "utf8"
);
const floatingHuman = await readFile(
  new URL("./components/FloatingDigitalHuman2D.vue", import.meta.url),
  "utf8"
);
const chatModule = await readFile(
  new URL("./components/AiChatModule.vue", import.meta.url),
  "utf8"
);
const sidebar = await readFile(
  new URL("./components/AiSidebar.vue", import.meta.url),
  "utf8"
);
const routes = await readFile(
  new URL("../../../router/modules/remaining.ts", import.meta.url),
  "utf8"
);
const globalStyles = await readFile(
  new URL("../../../style/index.scss", import.meta.url),
  "utf8"
);
const mainRuntime = await readFile(
  new URL("../../../main.ts", import.meta.url),
  "utf8"
);
const layoutShell = await readFile(
  new URL("../../../layout/index.vue", import.meta.url),
  "utf8"
);
const layContent = await readFile(
  new URL("../../../layout/components/lay-content/index.vue", import.meta.url),
  "utf8"
);
const assistantFloatButton = await readFile(
  new URL(
    "../../../components/AiScreenCapture/FloatButton.vue",
    import.meta.url
  ),
  "utf8"
);

test("student AI App and staff learning assistant share one chat workbench", () => {
  assert.match(
    routes,
    /path: "\/account\/ai-app"[\s\S]*account\/ai-app\/index\.vue/
  );
  assert.match(
    routes,
    /path: "\/ai-app\/workspace"[\s\S]*views\/ai-app\/index\.vue/
  );
  assert.match(
    sharedEntry,
    /import AiAppWorkbench from "@\/views\/account\/ai-app\/index\.vue"/
  );

  assert.match(workbench, /activeRail === `chat` && activeCourse/);
  assert.match(workbench, /activeRail === `chat` && !activeCourse/);
  assert.match(workbench, /v-if="isStaffMode && activeRail === 'chat'"/);
});

test("phone chat uses a full-width Doubao-style conversation shell", () => {
  assert.match(
    workbench,
    /const isCompactViewport = ref\(isCompactAiViewport\(\)\)/
  );
  assert.match(workbench, /isCompactViewport\.value[\s\S]*\? 0[\s\S]*: 34/);
  assert.match(workbench, /class="ai-mobile-app-bar"/);
  assert.doesNotMatch(workbench, /ai-mobile-workspace-nav/);
  assert.match(workbench, /class="ai-course-drawer-scrim"/);
  assert.match(workbench, /aria-label="关闭课程与对话"/);
  assert.match(workbench, /aria-controls="ai-app-course-sidebar"/);
  assert.match(workbench, /const openCourseDrawer = \(\) =>/);
  assert.match(workbench, /event\.key === "Escape"/);
  assert.match(workbench, /event\.key !== "Tab"/);
  assert.match(workbench, /courseDrawerRestoreFocus/);
  assert.match(
    workbench,
    /const handleSidebarConversationSelect[\s\S]*closeCourseDrawer\(\);[\s\S]*loadConversationMessages/
  );
  assert.match(
    workbench,
    /const handleSidebarNewChat[\s\S]*closeCourseDrawer\(\);[\s\S]*handleNewChat/
  );
  assert.match(
    workbench,
    /const courseName = activeCourse\.value\?\.name \|\| "";[\s\S]*openCourseDrawer\(\)/
  );
  assert.match(workbench, /if \(!course\) \{[\s\S]*openCourseDrawer\(\)/);
  assert.doesNotMatch(
    workbench,
    /const courseId = course\?\.id \|\| selectedCourseId\.value/
  );
  assert.match(sidebar, /:aria-label="`为\$\{course\}新建辅导会话`"/);
  assert.match(
    sidebar,
    /@media \(hover: none\), \(pointer: coarse\), \(max-width: 768px\)[\s\S]*opacity: 1 !important/
  );
  assert.match(workbench, /quick-chat-card ai-mobile-composer-surface/);
  assert.match(chatModule, /ai-chat-composer ai-mobile-composer-surface/);
  assert.match(chatModule, /class="ai-chat-message-scroll/);
  assert.match(
    workbench,
    /@media \(max-width: 768px\)[\s\S]*\.ai-app-main-column \{[\s\S]*width: 100%/
  );
  assert.match(
    workbench,
    /\.ai-app-left-rail\.is-collapsed \{[\s\S]*translateX\(-105%\)[\s\S]*visibility: hidden/
  );
  assert.match(
    chatModule,
    /@media \(max-width: 768px\)[\s\S]*\.ai-chat-course-head \{[\s\S]*display: none[\s\S]*\.ai-chat-composer-shell \{[\s\S]*padding: 6px !important;[\s\S]*border-top/
  );
  assert.match(
    workbench,
    /\.quick-chat-toolbar \{[\s\S]*display: grid;[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto/
  );
});

test("native runtime drawer overrides the old fixed compact rail", () => {
  assert.match(
    globalStyles,
    /\.ai-app-root\.is-compact-viewport[\s\S]*\.ai-app-left-rail \{[\s\S]*position: absolute !important;[\s\S]*z-index: 2200 !important/
  );
  assert.match(
    workbench,
    /\.ai-app-left-rail \{[\s\S]*inset: 0;[\s\S]*width: 100% !important;[\s\S]*max-width: none;[\s\S]*border-radius: 0;[\s\S]*box-shadow: none/
  );
  assert.match(
    globalStyles,
    /\.ai-app-root\.is-compact-viewport[\s\S]*\.ai-app-left-rail \{[\s\S]*inset: 0 !important;[\s\S]*width: 100% !important;[\s\S]*max-width: none !important;[\s\S]*border-radius: 0 !important;[\s\S]*box-shadow: none !important/
  );
  assert.match(
    globalStyles,
    /\.ai-app-root\.is-compact-viewport[\s\S]*\.ai-app-left-rail\.is-collapsed[\s\S]*translateX\(-105%\) !important;[\s\S]*visibility: hidden !important/
  );
  assert.match(workbench, /\.ai-course-drawer-scrim \{[\s\S]*z-index: 2190/);
});

test("mobile AI workspace is neutral, edge-to-edge and content dense", () => {
  assert.doesNotMatch(globalStyles, /rgb\(253 229 250 \/ 68%\)|#fff4fb/);
  assert.match(
    globalStyles,
    /\.ai-app-root[\s\S]*background: var\(--ai-app-shell-bg, #f3f6fa\) !important/
  );
  assert.match(
    globalStyles,
    /qiming-mini-program-webview\.ua-mobile[\s\S]*\.main-content\.ai-app-root \{[\s\S]*max-width: 100vw !important;[\s\S]*margin: 0 !important/
  );
  assert.match(
    mainRuntime,
    /if \(isMiniProgram\) \{[\s\S]*removeItem\("qimingNativeStatusTop"\)[\s\S]*--pure-safe-area-top[\s\S]*"0px"/
  );
  assert.match(
    layoutShell,
    /miniProgramNativeTitleRoutes[\s\S]*"\/account\/ai-app"[\s\S]*"\/ai-app\/workspace"/
  );
  assert.match(layContent, /usesMiniProgramNativeTitle[\s\S]*paddingTop: "0"/);
  assert.match(chatModule, /class="chat-message-list w-full min-w-0"/);
  assert.match(
    chatModule,
    /@media \(max-width: 768px\)[\s\S]*\.message-stack\.is-system \{[\s\S]*width: calc\(100% - 38px\)[\s\S]*max-width: calc\(100% - 38px\)[\s\S]*\.message-bubble-system \{[\s\S]*padding: 2px 0;[\s\S]*background: transparent;[\s\S]*border: 0;[\s\S]*box-shadow: none/
  );
  assert.match(
    workbench,
    /\.ai-app-root\.is-chat \.ai-chat-workbench \{[\s\S]*padding: 0 !important;[\s\S]*\.ai-chat-dialog-panel \{[\s\S]*border-radius: 0 !important;[\s\S]*box-shadow: none !important/
  );
  assert.match(
    workbench,
    /\.ai-app-root\.is-chat \.ai-course-context-bar \{[\s\S]*flex-direction: row;[\s\S]*flex-wrap: nowrap;[\s\S]*overflow-x: auto/
  );
  assert.match(
    workbench,
    /selectedAgentDisplayLabel[\s\S]*label === "LearningAssistant"[\s\S]*\? "学习助手"/
  );
  assert.match(workbench, /随时提问，输入 @ 提及课程或文件/);
});

test("learning profile keeps the learner figure and content at natural height", () => {
  assert.match(profile, /class="profile-avatar relative w-24 h-24/);
  assert.match(
    profile,
    /\.profile-avatar \{[\s\S]*flex: 0 0 96px;[\s\S]*overflow: visible/
  );
  assert.match(profile, /\.profile-page > \* \{[\s\S]*flex-shrink: 0/);
  assert.match(
    profile,
    /\.profile-primary-grid > \*,[\s\S]*flex: 0 0 auto !important;[\s\S]*min-height: max-content/
  );
  assert.match(
    workbench,
    /\.ai-profile-main \{[\s\S]*height: auto !important;[\s\S]*overflow: visible/
  );
});

test("embedded runtimes use the MP4 human and keep it above bottom controls", () => {
  const floatingHumanMount = workbench.match(
    /<FloatingDigitalHuman2D[\s\S]*?\/>/
  )?.[0];
  assert.ok(floatingHumanMount);
  assert.doesNotMatch(floatingHumanMount, /v-if=/);
  assert.match(
    floatingHumanMount,
    /v-show="!isCompactViewport \|\| sidebarCollapsed"/
  );
  assert.match(
    floatingHumanMount,
    /:size="isCompactViewport \? \(activeCourse \? 56 : 80\) : 88"/
  );
  assert.match(
    workbench,
    /if \(document\.hidden\) \{[\s\S]*floatingHumanRef\.value\?\.pauseRender\?\.\(\);[\s\S]*floatingHumanRef\.value\?\.resumeRender\?\.\(\);/
  );
  assert.match(floatingHuman, /生成数字人待机视频\.mp4/);
  assert.match(floatingHuman, /qiming-mini-program-webview/);
  assert.match(floatingHuman, /qiming-native-webview/);
  assert.match(
    floatingHuman,
    /querySelectorAll<HTMLElement>\(props\.avoidSelector\)/
  );
  assert.match(floatingHuman, /new ResizeObserver\(handleResize\)/);
  assert.match(floatingHuman, /Math\.min\(112, Math\.max\(56/);
  assert.match(assistantFloatButton, /getVisibleAiComposer/);
  assert.match(
    assistantFloatButton,
    /\.ai-mobile-composer-surface, \.nav-mobile-container/
  );
  assert.match(
    assistantFloatButton,
    /new ResizeObserver\(\(\) => schedulePositionSync\(\)\)/
  );
  assert.match(assistantFloatButton, /new MutationObserver\(\(\) =>/);
  assert.match(assistantFloatButton, /scheduleBottomAvoidanceRebind\(\)/);
  assert.match(
    floatingHuman,
    /window\.innerHeight - bubbleSize(?:\.value)? - reservedBottom/
  );
  assert.match(floatingHuman, /:poster="fallbackPoster"/);
  assert.match(
    floatingHuman,
    /:data-playback-format="usesMp4Playback \? 'mp4' : 'webm'"/
  );
  assert.match(workbench, /activeRail\.value === "chat" \? 156 : 104/);
  assert.match(workbench, /ai-app-floating-digital-human-2d-mobile/);
  assert.match(
    workbench,
    /avoid-selector="\.ai-mobile-composer-surface, \.nav-mobile-container"/
  );
  assert.match(
    chatModule,
    /\.speech-control,[\s\S]*\.assistant-action-row \{[\s\S]*margin-left: 68px;/
  );
});
