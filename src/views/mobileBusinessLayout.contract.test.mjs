import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const viewsDir = dirname(fileURLToPath(import.meta.url));
const readView = relativePath =>
  readFileSync(resolve(viewsDir, relativePath), "utf8");

const studentPaperDetail = readView("exam-paper/student-center/detail.vue");
const homeworkDetail = readView("account/homework-detail.vue");
const examDetail = readView("account/exam-detail.vue");
const paperEditor = readView("exam-paper/editor/index.vue");
const paperTemplates = readView("exam-paper/templates/index.vue");
const paperStatistics = readView("exam-paper/statistics/index.vue");
const classroom = readView("course/classroom/index.vue");
const aiApp = readView("account/ai-app/index.vue");
const courseStudy = readView("account/course-detail/CourseStudy.vue");
const courseQa = readView("account/course-detail/CourseQA.vue");
const accountSettings = readView("account-settings/index.vue");
const accountSettingPanels = [
  "Profile.vue",
  "Preferences.vue",
  "SecurityLog.vue",
  "AccountManagement.vue"
].map(file => readView(`account-settings/components/${file}`));
const videoAnalysis = readView("course/video-analysis/index.vue");
const courseAnimation = readView("course/animation/index.vue");
const courseAssessment = readView("course/assessment/index.vue");
const coursePlan = readView("course/teacherplan/index.vue");
const discussionReview = readView("course/discussion/review.vue");
const examResult = readView("exam-paper/result/index.vue");
const accountHome = readView("account/index.vue");
const wrongExercise = readView("account/wrong-exercise.vue");
const homeworkExam = readView("account/course-detail/HomeworkExam.vue");
const aiLearningPath = readView("account/ai-app/components/AiLearningPath.vue");
const aiLearningProfile = readView(
  "account/ai-app/components/AiLearningProfile.vue"
);
const aiAssessment = readView("account/ai-app/components/AiAssessment.vue");
const aiFloatButton = readView("../components/AiScreenCapture/FloatButton.vue");
const floatingDigitalHuman = readView(
  "account/ai-app/components/FloatingDigitalHuman2D.vue"
);
const homeworkManagement = readView(
  "course/assessment/components/HomeworkManagement.vue"
);
const examManagement = readView(
  "course/assessment/components/ExamManagement.vue"
);
const courseList = readView("course/list/index.vue");
const teacherPlan = readView("course/teacherplan/index.vue");
const assessment = readView("course/assessment/index.vue");
const virtualLab = readView("account/components/VirtualLab.vue");
const studentResources = readView("course/student-resource/index.vue");
const structuredResourcePreview = readView(
  "../components/PlatformResourcePreview/PlatformStructuredJsonPreview.vue"
);
const layContent = readView("../layout/components/lay-content/index.vue");
const globalStyles = readView("../style/index.scss");
const androidAudit = readView("../../scripts/android-webview-audit.mjs");

test("Android route roots use compact gutters and audit usable width", () => {
  assert.equal(
    layContent.match(/main-content qiming-route-content/g)?.length,
    4
  );
  assert.match(
    globalStyles,
    /qiming-native-android[\s\S]*\.qiming-route-content[\s\S]*max-width: calc\(100vw - 12px\)[\s\S]*margin: 6px 6px 0 !important[\s\S]*padding-right: 6px !important[\s\S]*padding-left: 6px !important/
  );
  assert.match(androidAudit, /mainContentUsableWidthRatio/);
  assert.match(androidAudit, /--min-usable-content-ratio/);
});

test("teacher mobile workflows do not stack route and page gutters", () => {
  assert.match(
    globalStyles,
    /:is\([\s\S]*\.course-list-page,[\s\S]*\.teacher-plan-container,[\s\S]*\.assessment-management[\s\S]*\)\.qiming-route-content[\s\S]*padding-right: 0 !important[\s\S]*padding-left: 0 !important/
  );
  assert.match(courseList, /class="main course-list-page p-4"/);
  assert.match(courseList, /class="course-hours-dialog"/);
  assert.match(courseList, /v-if="isMobile" class="mobile-hour-list"/);
  assert.match(courseList, /<el-table\s+v-else/);
  assert.match(
    globalStyles,
    /qiming-mini-program-webview\.ua-mobile \.app-main[\s\S]*padding-top: 0 !important/
  );
  assert.match(teacherPlan, /teacher-plan-container/);
  assert.match(assessment, /assessment-management/);
});

test("student detail flows remove layered mobile gutters", () => {
  assert.match(studentPaperDetail, /@media \(width <= 768px\)/);
  assert.match(studentPaperDetail, /margin: 0 !important/);
  assert.match(studentPaperDetail, /\.paper-info-card,[\s\S]*padding: 8px/);
  assert.match(
    homeworkDetail,
    /\.main-content[\s\S]*max-width: calc\(100vw - 12px\) !important[\s\S]*padding: 0 6px[\s\S]*margin: 0 6px !important/
  );
  assert.match(
    examDetail,
    /\.main-content[\s\S]*max-width: calc\(100vw - 12px\) !important[\s\S]*padding: 0 6px[\s\S]*margin: 0 6px !important/
  );
});

test("wrong exercise keeps phone content wide and reports real API errors", () => {
  assert.match(
    wrongExercise,
    /practice-container:not\(\[data-embedded="true"\]\) \.main-content[\s\S]*padding: 0 8px[\s\S]*margin: 0 !important/
  );
  assert.match(wrongExercise, /courseId\.value !== undefined/);
  assert.match(
    wrongExercise,
    /:deep\(\.filter-date\)[\s\S]*width: 100% !important/
  );
  assert.match(wrongExercise, /错题记录加载失败/);
  assert.match(wrongExercise, /analysisHistoryError/);
});

test("student detail controls preserve phone touch targets", () => {
  assert.match(studentPaperDetail, /min-height: 44px/);
  assert.match(homeworkDetail, /min-height: 44px/);
  assert.match(examDetail, /min-height: 44px/);
});

test("student resource previews do not stack mobile side gutters", () => {
  assert.match(studentResources, /正在加载课程资源/);
  assert.match(studentResources, /class="workbench-skeleton__status"/);
  assert.match(
    studentResources,
    /@media \(max-width: 560px\)[\s\S]*\.resource-workbench__body \{[\s\S]*padding: 0/
  );
  assert.match(
    studentResources,
    /\.resource-preview__canvas \{[\s\S]*padding: 146px 0 8px/
  );
  assert.match(
    structuredResourcePreview,
    /@container \(max-width: 560px\)[\s\S]*\.structured-preview \{[\s\S]*padding: 18px 12px 32px/
  );
  assert.match(
    structuredResourcePreview,
    /\.exercise-nav button \{[\s\S]*width: 44px;[\s\S]*height: 44px/
  );
});

test("paper editor wraps mobile actions and keeps a single-column outline", () => {
  assert.match(
    paperEditor,
    /\.header-right \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)[\s\S]*overflow: visible/
  );
  assert.match(
    paperEditor,
    /\.toolbar-items \{[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/
  );
  assert.doesNotMatch(paperEditor, /\.toolbar-groups[\s\S]*overflow-x: auto/);
  assert.match(
    paperEditor,
    /\.editor-outline,[\s\S]*\.editor-outline\.collapsed[\s\S]*width: 100%/
  );
});

test("paper templates collapse below their former 300px minimum", () => {
  assert.match(paperTemplates, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(paperTemplates, /\.templates-page[\s\S]*padding: 8px/);
  assert.match(paperTemplates, /min-height: 44px/);
});

test("paper statistics release chart width on phones", () => {
  assert.match(paperStatistics, /\.statistics-container[\s\S]*padding: 8px/);
  assert.match(
    paperStatistics,
    /\.chart-card,[\s\S]*\.detail-card[\s\S]*min-width: 0[\s\S]*padding: 8px/
  );
});

test("mobile campus exposes reachable alternatives to scaled SVG hotspots", () => {
  assert.match(classroom, /class="mobile-campus-nav"/);
  assert.match(
    classroom,
    /\.campus-container \.hot-zone[\s\S]*pointer-events: none/
  );
  assert.match(classroom, /\.mobile-campus-action[\s\S]*min-height: 48px/);
});

test("mobile AI attachments keep an explicit 44px delete control", () => {
  assert.match(aiApp, /aria-label="删除附件"/);
  assert.match(
    aiApp,
    /@media \(max-width: 768px\)[\s\S]*\.quick-attachment-remove[\s\S]*width: 44px[\s\S]*height: 44px/
  );
  assert.match(aiApp, /pointer-events: auto/);
  assert.match(aiApp, /opacity: 1/);
  assert.match(aiApp, /@media \(hover: none\), \(pointer: coarse\)/);
  assert.match(
    aiApp,
    /\.quick-attachment-card:focus-within \.quick-attachment-remove/
  );
});

test("mobile AI workspaces release desktop fixed widths", () => {
  assert.match(aiApp, /title="常规任务暂未接入"/);
  assert.match(aiApp, /class="ai-course-context-bar/);
  assert.match(
    aiApp,
    /@media \(max-width: 768px\)[\s\S]*\.ai-course-context-bar \{[\s\S]*flex-direction: column[\s\S]*\.ai-course-context-bar :deep\(\.el-select\) \{[\s\S]*width: 100% !important/
  );
  assert.match(aiApp, /class="ai-profile-workspace/);
  assert.match(
    aiApp,
    /\.ai-profile-workspace \{[\s\S]*flex-direction: column[\s\S]*overflow-y: auto/
  );
  assert.match(
    aiApp,
    /\.ai-profile-main \{[\s\S]*height: auto !important;[\s\S]*overflow: visible/
  );
  assert.match(
    aiApp,
    /\.ai-profile-main \.profile-page \{[\s\S]*height: auto !important;[\s\S]*overflow: visible/
  );
  assert.match(aiApp, /\.ai-profile-inspector \{[\s\S]*width: 100% !important/);
  assert.match(
    aiApp,
    /class="ai-automation-view h-full w-full min-w-0 overflow-hidden flex items-center justify-center bg-white p-4"/
  );
  assert.match(aiApp, /width="min\(640px, calc\(100vw - 24px\)\)"/);
  assert.match(
    aiApp,
    /\.stack-preview-content \{[\s\S]*flex-direction: column/
  );
});

test("course learning and discussion mobile controls stay touch sized", () => {
  assert.match(
    courseStudy,
    /@media \(width <= 767px\)[\s\S]*\.action-btn[\s\S]*width: 44px[\s\S]*height: 44px/
  );
  assert.match(
    courseStudy,
    /\.header-btn[\s\S]*width: 44px[\s\S]*height: 44px/
  );
  assert.match(
    courseStudy,
    /@media \(width <= 479px\)[\s\S]*\.study-container \{[\s\S]*156px\) 8px/
  );
  assert.match(
    courseStudy,
    /\.card-body \{[\s\S]*\.el-scrollbar__wrap \{[\s\S]*padding: 6px/
  );
  assert.match(courseQa, /\.filter-tab[\s\S]*min-height: 44px/);
  assert.match(courseQa, /\.toolbar-btn[\s\S]*width: 44px[\s\S]*height: 44px/);
  assert.match(courseQa, /\.reply-action-btn[\s\S]*min-height: 44px/);
  assert.match(
    courseQa,
    /\.content-editor :deep\(\.el-textarea__inner\)[\s\S]*padding: 12px 14px 62px/
  );
  assert.ok(
    courseQa.lastIndexOf(".message-board-container {") >
      courseQa.indexOf("padding: 80px 32px 24px")
  );
  assert.match(
    courseQa,
    /@media \(width <= 768px\)[\s\S]*\.message-board-container \{[\s\S]*156px\) 8px/
  );
});

test("mobile content width does not depend on desktop UA detection", () => {
  for (const panel of accountSettingPanels) {
    assert.doesNotMatch(panel, /deviceDetection\(\)/);
    assert.match(panel, /w-full max-w-full min-\[769px\]:max-w-\[70%\]/);
  }

  assert.match(
    wrongExercise,
    /@media \(max-width: 768px\)[\s\S]*\.practice-container:not\(\[data-embedded="true"\]\) \.main-content \{[\s\S]*max-width: none;[\s\S]*padding: 0 8px;/
  );
  assert.match(
    wrongExercise,
    /\.practice-container \.main-content :deep\(\.el-card__header\),[\s\S]*\.el-card__body\)[\s\S]*padding: 10px/
  );
  assert.match(
    homeworkExam,
    /@media \(max-width: 479px\)[\s\S]*\.homework-icon,[\s\S]*width: 48px;[\s\S]*margin-right: 12px/
  );
});

test("AI status text wraps inside the phone viewport", () => {
  assert.match(
    aiLearningPath,
    /\.learning-path-page > \* \{[\s\S]*flex-shrink: 0/
  );
  assert.match(aiLearningPath, /\.course-block \{[\s\S]*min-width: 0/);
  assert.match(
    aiLearningPath,
    /\.course-title-row :deep\(\.el-tag\)[\s\S]*max-width: 100%;[\s\S]*white-space: normal;[\s\S]*overflow-wrap: anywhere/
  );
  assert.match(
    aiAssessment,
    /class="assessment-toolbar-actions[^\"]*flex-wrap/
  );
  assert.match(
    aiAssessment,
    /\.assessment-toolbar-actions :deep\(\.el-tag\)[\s\S]*white-space: normal;[\s\S]*overflow-wrap: anywhere/
  );
});

test("AI learning profile avoids nested desktop padding on phones", () => {
  assert.match(
    aiLearningProfile,
    /\.profile-page > \* \{[\s\S]*flex-shrink: 0/
  );
  assert.match(
    aiLearningProfile,
    /@media \(width <= 768px\)[\s\S]*\.profile-page \{[\s\S]*padding: 8px !important/
  );
  assert.match(
    aiLearningProfile,
    /\.profile-summary,[\s\S]*\.dimension-preview,[\s\S]*padding: 14px !important/
  );
  assert.match(
    aiLearningProfile,
    /\.profile-primary-grid,[\s\S]*display: flex !important;[\s\S]*flex-direction: column !important/
  );
  assert.match(aiAssessment, /\.assessment-page > \* \{[\s\S]*flex-shrink: 0/);
});

test("embedded AI workspace keeps an MP4 digital-human fallback", () => {
  assert.match(floatingDigitalHuman, /生成数字人待机视频\.mp4/);
  assert.match(floatingDigitalHuman, /const detectEmbeddedMobile/);
  assert.match(
    floatingDigitalHuman,
    /:data-playback-format="usesMp4Playback \? 'mp4' : 'webm'"/
  );
  assert.match(floatingDigitalHuman, /:poster="fallbackPoster"/);
  assert.match(floatingDigitalHuman, /@error="handleVideoError"/);
  assert.match(
    aiApp,
    /if \(document\.hidden\) \{[\s\S]*floatingHumanRef\.value\?\.pauseRender[\s\S]*else \{[\s\S]*floatingHumanRef\.value\?\.resumeRender/
  );
  assert.doesNotMatch(
    aiApp,
    /const renderTargets = \[virtualHumanRef\.value, floatingHumanRef\.value\]/
  );
});

test("teacher workbenches enter full-width mobile layout by viewport", () => {
  assert.match(
    courseAnimation,
    /@media \(width <= 768px\)[\s\S]*\.ai-animation-container \{[\s\S]*margin: 0;[\s\S]*flex-direction: column/
  );
  assert.match(
    videoAnalysis,
    /@media \(width <= 768px\)[\s\S]*\.video-analysis-container,[\s\S]*padding: 0 !important/
  );
  assert.match(
    videoAnalysis,
    /\.video-analysis-container\.is-mobile-layout \.sidebar-card \{[\s\S]*max-height: none;[\s\S]*overflow: visible/
  );
  assert.match(
    courseAssessment,
    /@mixin assessment-mobile-layout[\s\S]*padding: 0/
  );
  assert.match(
    coursePlan,
    /@mixin teacher-plan-mobile-layout[\s\S]*padding: 0/
  );
  assert.match(discussionReview, /<el-form[\s\S]*class="search-form"/);
});

test("AI floating action stays above the measured mobile dock", () => {
  assert.match(
    aiFloatButton,
    /querySelectorAll<HTMLElement>\("\.nav-mobile-container"\)/
  );
  assert.match(
    aiFloatButton,
    /window\.innerHeight - dockTop \+ MOBILE_DOCK_GAP/
  );
  assert.match(
    aiFloatButton,
    /const bottomOffset = isMobile\.value[\s\S]*getMobileBottomOffset\(\)[\s\S]*POSITION_PADDING/
  );
  assert.match(aiFloatButton, /window\.innerHeight - size - bottomOffset/);
  assert.match(aiFloatButton, /Number\.parseFloat\(value\)/);
});

test("account settings mobile navigation overlays instead of shrinking content", () => {
  assert.match(accountSettings, /useMediaQuery\("\(max-width: 768px\)"\)/);
  assert.doesNotMatch(accountSettings, /deviceDetection\(\)/);
  assert.match(accountSettings, /class="account-settings-backdrop"/);
  assert.match(accountSettings, /&\.is-mobile[\s\S]*position: fixed/);
  assert.match(accountSettings, /width: min\(84vw, 300px\) !important/);
  assert.match(
    accountSettings,
    /background: var\(--pure-theme-menu-bg\) !important/
  );
  assert.match(accountSettings, /aria-modal="isMobile \? 'true' : undefined"/);
  assert.match(accountSettings, /event\.key === "Escape"/);
  assert.match(accountSettings, /event\.key !== "Tab"/);
  assert.match(accountSettings, /getMobileMenuFocusable/);
  assert.match(accountSettings, /\[role="menuitem"\]/);
  assert.match(accountSettings, /focusableElements\[nextIndex\]\?\.focus\(\)/);
  assert.match(accountSettings, /const restoreBodyScroll/);
  assert.match(accountSettings, /if \(!mobile\) restoreBodyScroll\(\)/);
  assert.match(
    accountSettings,
    /onBeforeUnmount\(\(\) => \{[\s\S]*restoreBodyScroll\(\)/
  );
  assert.match(accountSettings, /\.account-settings-main[\s\S]*padding: 8px/);
});

test("student account mobile page scrolls without a fixed footer overlay", () => {
  assert.match(accountHome, /<el-dropdown trigger="click"/);
  assert.match(
    accountHome,
    /@media \(width <= 767px\)[\s\S]*height: auto;[\s\S]*overflow: visible/
  );
  assert.match(
    accountHome,
    /:deep\(\.layout-footer\)[\s\S]*position: static[\s\S]*pointer-events: auto/
  );
});

test("wide business tables scroll inside bounded regions", () => {
  assert.match(videoAnalysis, /class="task-table-scroll/);
  assert.match(videoAnalysis, /\.task-table-scroll[\s\S]*overflow-x: auto/);
  assert.match(videoAnalysis, /:fixed="isMobileLayout \? false : 'right'"/);
  assert.match(
    videoAnalysis,
    /\.task-table \.el-button[\s\S]*min-height: 44px/
  );
  assert.match(examResult, /class="answer-table-scroll"/);
  assert.match(examResult, /\.answer-table-scroll[\s\S]*overflow-x: auto/);
  assert.match(examResult, /min-width: 760px/);
});

test("assessment management tables and actions remain usable on phones", () => {
  for (const view of [homeworkManagement, examManagement]) {
    assert.match(view, /class="business-table-scroll/);
    assert.match(view, /:fixed="isMobile \? false : 'right'"/);
    assert.match(view, /\? 'prev, pager, next'/);
    assert.match(view, /: 'total, sizes, prev, pager, next, jumper'/);
    assert.match(view, /:pager-count="isMobile \? 5 : 7"/);
    assert.match(view, /\.more-action-btn \{[\s\S]*min-height: 44px/);
    assert.match(
      view,
      /assessment-action-dropdown \.el-dropdown-menu__item\)[\s\S]*min-height: 44px/
    );
    assert.match(
      view,
      /\.business-table-scroll \{[\s\S]*max-width: 100%;[\s\S]*overflow-x: auto/
    );
  }

  assert.match(homeworkManagement, /handleHomeworkAction/);
  assert.match(examManagement, /handleExamAction/);
});

test("assessment dialogs fit the mobile viewport", () => {
  for (const view of [homeworkManagement, examManagement]) {
    assert.match(view, /'calc\(100vw - 24px\)'/);
    assert.match(view, /'calc\(100vw - 16px\)'/);
    assert.match(view, /:label-position="isMobile \? 'top' : 'right'"/);
    assert.match(
      view,
      /@media \(max-width: 767px\)[\s\S]*max-height: calc\(100dvh - 16px\)/
    );
    assert.match(view, /\.el-dialog__headerbtn\)[\s\S]*width: 44px/);
  }
});

test("virtual lab reflows header, categories and dialog at 360px", () => {
  assert.match(virtualLab, /:title="`\$\{currentLab\.title\}实验内容`"/);
  assert.match(
    virtualLab,
    /@media \(max-width: 767px\)[\s\S]*\.header-content \{[\s\S]*flex-direction: column/
  );
  assert.match(
    virtualLab,
    /\.header-stats \{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/
  );
  assert.match(
    virtualLab,
    /\.category-tabs[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/
  );
  assert.match(
    virtualLab,
    /\.el-radio-button__inner \{[\s\S]*min-height: 44px/
  );
  assert.match(virtualLab, /width="min\(1100px, calc\(100vw - 24px\)\)"/);
  assert.match(
    virtualLab,
    /\.lab-iframe-container \{[\s\S]*height: calc\(100dvh - 108px\)/
  );
});

test("routine task rail exposes an honest unavailable state", () => {
  assert.match(aiApp, /常规任务暂未接入/);
  assert.match(aiApp, /后端尚未提供常规任务的配置、启停与执行记录接口/);
  assert.doesNotMatch(aiApp, /class="ai-automation-task-main/);
  assert.doesNotMatch(aiApp, /const routineTasks/);
});
