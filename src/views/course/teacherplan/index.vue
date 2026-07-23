<template>
  <div
    :class="[
      'teacher-plan-container h-[calc(100vh-var(--tags-view-height)-80px)] m-4 flex gap-5 overflow-hidden',
      { 'is-mobile-layout': isMobileLayout }
    ]"
  >
    <!-- 左侧课程选择侧边栏 -->
    <div
      class="course-sidebar w-[320px] flex flex-col bg-white dark:bg-[#1d1d1d] rounded-3xl shadow-sm border-2 border-slate-100 dark:border-slate-800 overflow-hidden transition-colors duration-300"
    >
      <div
        class="pt-8 px-8 pb-4 border-b-2 border-slate-100 dark:border-slate-800 bg-[#f8fafc] dark:bg-[#252525]/50"
      >
        <h3
          class="text-xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center tracking-tight"
          style="margin-bottom: 20px"
        >
          <div
            class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-500 dark:text-blue-400 flex items-center justify-center mr-3"
          >
            <el-icon><Reading /></el-icon>
          </div>
          教学中心
        </h3>
        <el-input
          v-model="courseSearchQuery"
          placeholder="搜索您管理的课程..."
          clearable
          class="!w-full custom-search-v2"
          @input="handleCourseSearch"
        >
          <template #prefix>
            <el-icon class="text-slate-400 dark:text-slate-500"
              ><Search
            /></el-icon>
          </template>
        </el-input>
      </div>

      <div
        v-loading="courseLoading"
        class="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2 dark:bg-[#1d1d1d]"
      >
        <button
          v-for="course in courseOptions"
          :key="course.courseId"
          type="button"
          :class="[
            'course-item',
            selectedCourseId === course.courseId ? 'active' : ''
          ]"
          :aria-pressed="selectedCourseId === course.courseId"
          class="dark:bg-[#252525] dark:border-slate-800"
          @click="selectCourse(course)"
        >
          <el-image
            :src="course.thumbUrl"
            class="w-14 h-10 rounded-lg object-cover mr-3 bg-[var(--el-fill-color-light)] dark:bg-slate-800 shadow-sm"
          >
            <template #error
              ><div
                class="flex items-center justify-center w-full h-full text-[10px] text-[var(--el-text-color-placeholder)]"
              >
                封面
              </div></template
            >
          </el-image>
          <div class="flex-1 overflow-hidden">
            <div
              class="course-name truncate text-sm font-bold text-slate-700 dark:text-slate-200"
            >
              {{ course.title }}
            </div>
            <div class="flex justify-between items-center mt-1">
              <span
                class="text-[10px] px-1.5 py-0.5 rounded-md font-bold"
                :class="
                  course.isRequired === 1
                    ? 'bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400'
                    : 'bg-green-50 dark:bg-green-900/30 text-green-500 dark:text-green-400'
                "
              >
                {{ course.isRequired === 1 ? "必修" : "选修" }}
              </span>
              <span
                class="text-[10px] text-slate-400 dark:text-slate-500 font-medium"
                >{{ course.userName }}</span
              >
            </div>
          </div>
        </button>
        <el-empty
          v-if="courseOptions.length === 0"
          description="暂无课程"
          :image-size="60"
        />
      </div>
    </div>

    <!-- 右侧内容管理区 -->
    <div
      class="teacher-plan-panel flex-1 bg-white dark:bg-[#1d1d1d] rounded-3xl shadow-sm border-2 border-slate-100 dark:border-slate-800 flex flex-col overflow-hidden relative transition-colors duration-300"
    >
      <template v-if="selectedCourseId">
        <!-- 顶部信息栏 -->
        <div
          class="teacher-plan-course-header px-6 py-4 border-b border-[var(--el-border-color-lighter)] flex justify-between items-center bg-[var(--el-bg-color-overlay)] z-10"
        >
          <div class="teacher-plan-course-summary flex items-center gap-4">
            <div
              class="teacher-plan-course-icon p-2 bg-[var(--el-color-primary-light-9)] rounded-lg text-[var(--el-color-primary)]"
            >
              <el-icon class="text-xl"><Collection /></el-icon>
            </div>
            <div class="teacher-plan-course-copy">
              <h2
                class="teacher-plan-course-title text-lg font-bold text-[var(--el-text-color-primary)] leading-none mb-1.5"
              >
                {{ currentCourse?.title }}
              </h2>
              <p
                class="teacher-plan-course-meta text-[11px] text-[var(--el-text-color-secondary)]"
              >
                授课教师: {{ currentCourse?.userName }} · 课程编号:
                {{ currentCourse?.courseId }}
              </p>
            </div>
          </div>
          <div class="teacher-plan-course-actions flex items-center gap-4">
            <div
              class="teacher-plan-status-pill hidden md:flex items-center space-x-2 text-[var(--el-color-success)] text-xs bg-[var(--el-color-success-light-9)] px-4 py-2 rounded-full font-medium"
            >
              <div
                class="w-2 h-2 rounded-full bg-[var(--el-color-success)] animate-pulse"
              />
              <span>AI Engine Connected</span>
            </div>
          </div>
        </div>

        <!-- 标签页内容区 -->
        <div class="flex-1 overflow-hidden flex flex-col">
          <el-tabs
            v-model="activeTab"
            class="teacher-plan-tabs"
            tab-position="top"
          >
            <el-tab-pane
              label="AI 智能生成工作台"
              name="generate"
              class="h-full"
            >
              <plan-generator
                :course-id="selectedCourseId"
                :course-name="currentCourse?.title || ''"
                @switch-tab="switchTab"
                @plan-created="handlePlanCreated"
              />
            </el-tab-pane>
            <el-tab-pane label="已生成教案库" name="list" class="h-full">
              <plan-list
                :course-id="selectedCourseId"
                :created-plan="createdPlan"
                @switch-tab="switchTab"
                @created-plan-consumed="handleCreatedPlanConsumed"
              />
            </el-tab-pane>
          </el-tabs>
        </div>
      </template>

      <!-- 未选择状态 -->
      <div
        v-else
        class="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/30 dark:bg-transparent"
      >
        <lottie-animation
          :animation-data="EducationAnim"
          :width="360"
          :height="360"
          class="mb-4"
        />
        <h2
          class="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-4 tracking-tight"
        >
          开启智能教案设计
        </h2>
        <p
          class="text-base text-slate-500 dark:text-slate-400 mb-12 max-w-lg text-center leading-relaxed"
        >
          选择左侧课程，AI 助手将帮你一键生成生动、规范的教学大纲与教案
        </p>

        <div
          class="flex flex-col sm:flex-row gap-8 max-w-3xl w-full justify-center"
        >
          <div
            v-for="item in emptyStateHighlights"
            :key="item.title"
            class="flex-1 p-8 bg-white dark:bg-[#252525] rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-start gap-5 transition-all hover:shadow-md hover:-translate-y-1"
          >
            <div
              class="p-3.5 rounded-xl flex-shrink-0"
              :class="
                item.tone === 'sky'
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-500'
                  : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500'
              "
            >
              <el-icon size="28">
                <component :is="item.icon" />
              </el-icon>
            </div>
            <div class="text-left mt-0.5">
              <div
                class="font-bold text-lg text-slate-800 dark:text-slate-200 mb-2"
              >
                {{ item.title }}
              </div>
              <div
                class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed"
              >
                {{ item.description }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { getCourseList } from "@/api/course";
import { useAppStoreHook } from "@/store/modules/app";
import PlanGenerator from "./components/PlanGenerator.vue";
import PlanList from "./components/PlanList.vue";
import LottieAnimation from "@/components/LottieAnimation.vue";
import EducationAnim from "@/animation/Education.json";
import type { TeacherPlanCreationHandoff } from "./teacherPlanState";
import {
  Search,
  Reading,
  Collection,
  Cpu,
  Document,
  ArrowRightBold
} from "@element-plus/icons-vue";

defineOptions({
  name: "CourseTeacherPlan"
});

// 标签页控制
const activeTab = ref("generate");
const createdPlan = ref<TeacherPlanCreationHandoff | null>(null);
const appStore = useAppStoreHook();
const isMobileLayout = computed(() => appStore.getDevice === "mobile");
const emptyStateAnimationSize = computed(() => {
  const viewportWidth = appStore.getViewportWidth;

  if (viewportWidth < 390) {
    return 148;
  }

  if (viewportWidth < 768) {
    return 176;
  }

  return 220;
});
const emptyStateHighlights = [
  {
    title: "大模型智能解析",
    description: "自动识别重难点，精准抓取教学目标。",
    icon: Cpu,
    tone: "sky"
  },
  {
    title: "一键输出文档",
    description: "自动排版 Markdown 与 PDF，打印与分发都更顺手。",
    icon: Document,
    tone: "emerald"
  }
] as const;

// 课程选择相关
const selectedCourseId = ref(null);
const courseOptions = ref([]);
const courseLoading = ref(false);
const currentCourse = ref(null);
const courseSearchQuery = ref("");

// 搜索课程
const handleCourseSearch = async () => {
  courseLoading.value = true;
  try {
    const { data } = await getCourseList({
      pageNum: 1,
      pageSize: 50,
      courseName: courseSearchQuery.value
    });
    courseOptions.value = data?.courseList || [];
  } catch (error) {
    console.error("搜索课程失败", error);
  } finally {
    courseLoading.value = false;
  }
};

const selectCourse = (course: any) => {
  selectedCourseId.value = course.courseId;
  currentCourse.value = course;
  createdPlan.value = null;
};

// 获取初始课程列表
const fetchInitialCourses = async () => {
  courseLoading.value = true;
  try {
    const { data } = await getCourseList({
      pageNum: 1,
      pageSize: 50
    });
    courseOptions.value = data?.courseList || [];
  } catch (error) {
    console.error("获取课程列表失败", error);
    ElMessage.error("获取课程列表失败");
  } finally {
    courseLoading.value = false;
  }
};

// 切换标签页
const switchTab = (tabName: string) => {
  activeTab.value = tabName;
};

const handlePlanCreated = (creation: TeacherPlanCreationHandoff) => {
  const course = courseOptions.value.find(
    item => Number(item.courseId) === creation.courseId
  );
  selectedCourseId.value = creation.courseId;
  currentCourse.value =
    course ||
    ({
      courseId: creation.courseId,
      title: creation.courseName,
      userName: currentCourse.value?.userName || ""
    } as any);
  createdPlan.value = creation;
  activeTab.value = "list";
};

const handleCreatedPlanConsumed = (identity: string) => {
  const current = createdPlan.value;
  if (!current) return;
  const currentIdentity = `${current.courseId}:${current.teacherPlanId}:${current.taskId}`;
  if (currentIdentity === identity) createdPlan.value = null;
};

onMounted(() => {
  fetchInitialCourses();
});
</script>

<style lang="scss" scoped>
.course-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 12px;
  margin-bottom: 8px;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  background-color: #ffffff;
  border: 2px solid transparent;
  border-radius: 16px;
  transition: all 0.2s ease-out;

  &:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 2px;
  }

  html.dark & {
    background-color: #252525;
  }

  &:hover {
    border-color: #e2e8f0;
    transform: translateY(-2px);
    box-shadow: 0 4px 0 0 #f1f5f9;

    html.dark & {
      background-color: #2d2d2d;
      border-color: #334155;
      box-shadow: 0 4px 0 0 #1e293b;
    }
  }

  &.active {
    background-color: #f0f9ff;
    border-color: #bae6fd;
    transform: translateY(-2px);
    box-shadow: 0 4px 0 0 #e0f2fe;

    html.dark & {
      background-color: #0c4a6e;
      border-color: #0369a1;
      box-shadow: 0 4px 0 0 #082f49;
    }

    .course-name {
      color: #0369a1;

      html.dark & {
        color: #e0f2fe;
      }
    }

    .course-icon-box {
      color: white;
      background-color: var(--el-color-primary);
    }
  }
}

.custom-search-v2 :deep(.el-input__wrapper) {
  padding: 6px 14px;
  background-color: #ffffff;
  border-radius: 16px;
  box-shadow: 0 2px 0 0 #e2e8f0;
  border: 2px solid transparent;

  html.dark & {
    background-color: #252525;
    box-shadow: 0 2px 0 0 #334155;
  }

  &.is-focus {
    border-color: #bae6fd;
    box-shadow: 0 2px 0 0 #bae6fd;

    html.dark & {
      border-color: #0369a1;
      box-shadow: 0 2px 0 0 #0369a1;
    }
  }

  html.dark & .el-input__inner {
    color: #f1f5f9;
  }
}

.custom-search :deep(.el-input__wrapper) {
  padding: 4px 12px;
  background-color: var(--el-bg-color);
  border-radius: 12px;
  box-shadow: 0 2px 6px rgb(0 0 0 / 4%);

  &.is-focus {
    box-shadow:
      0 0 0 1px var(--el-color-primary) inset,
      0 4px 12px rgba(var(--el-color-primary-rgb), 0.1);
  }
}

.teacher-plan-tabs {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 0 24px;
  overflow: hidden;

  :deep(.el-tabs__header) {
    flex-shrink: 0;
    order: -1 !important;
    padding: 12px 0 0;
    margin-bottom: 0;
  }

  :deep(.el-tabs__item) {
    height: 44px;
    padding: 0 20px;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.3s;

    &.is-active {
      color: var(--el-color-primary);
    }
  }

  :deep(.el-tabs__active-bar) {
    height: 3px;
    border-radius: 3px;
  }

  :deep(.el-tabs__nav-wrap::after) {
    height: 1px;
    background-color: var(--el-border-color-lighter);
  }

  :deep(.el-tabs__content) {
    display: flex;
    flex: 1;
    flex-direction: column;
    order: 1 !important;
    min-height: 0;
    padding: 12px 0;
    overflow: hidden;
  }

  :deep(.el-tab-pane) {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }
}

.custom-scrollbar {
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--el-border-color-lighter);
    border-radius: 10px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }
}

.teacher-plan-empty-state {
  position: relative;
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 40px 32px;
  overflow: hidden;
  background:
    radial-gradient(circle at top, rgba(191, 219, 254, 0.55), transparent 42%),
    linear-gradient(180deg, #f8fafc 0%, #eef5ff 100%);
  transition:
    background 0.3s ease,
    color 0.3s ease;

  html.dark & {
    background:
      radial-gradient(circle at top, rgba(30, 64, 175, 0.3), transparent 40%),
      linear-gradient(180deg, #111827 0%, #0f172a 100%);
  }
}

.teacher-plan-empty-state__blob {
  position: absolute;
  border-radius: 999px;
  filter: blur(40px);
  opacity: 0.9;
  animation: teacher-plan-blob-float 10s ease-in-out infinite;
  pointer-events: none;
}

@mixin teacher-plan-mobile-layout {
  height: auto !important;
  min-height: calc(100vh - 140px);
  margin: 0;
  gap: 12px;
  overflow: visible;
  flex-direction: column;
  padding: 12px;
  scroll-padding-top: calc(var(--pure-safe-area-top, 0px) + 84px);
}

@mixin teacher-plan-mobile-panel-layout {
  width: 100% !important;
  min-width: 0;
  border-radius: 24px;
}

.teacher-plan-container.is-mobile-layout {
  @include teacher-plan-mobile-layout;

  .course-sidebar,
  .teacher-plan-panel {
    @include teacher-plan-mobile-panel-layout;
  }

  .course-sidebar {
    max-height: 48vh;
  }

  .teacher-plan-panel {
    min-height: calc(100vh - 280px);
  }
}

.teacher-plan-container.is-mobile-layout .course-item {
  padding: 10px;
  border-radius: 14px;
}

.teacher-plan-container.is-mobile-layout .teacher-plan-tabs {
  padding: 0 14px;

  :deep(.el-tabs__header) {
    padding-top: 0;
    overflow-x: auto;
  }

  :deep(.el-tabs__nav-wrap) {
    padding-bottom: 6px;
  }

  :deep(.el-tabs__item) {
    height: 40px;
    padding: 0 14px;
    font-size: 13px;
    white-space: nowrap;
  }
}

.teacher-plan-container.is-mobile-layout .teacher-plan-course-header {
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
}

.teacher-plan-container.is-mobile-layout .teacher-plan-course-summary {
  width: 100%;
  align-items: flex-start;
  gap: 12px;
}

.teacher-plan-container.is-mobile-layout .teacher-plan-course-icon {
  padding: 10px;
  border-radius: 16px;
}

.teacher-plan-container.is-mobile-layout .teacher-plan-course-copy {
  min-width: 0;
}

.teacher-plan-container.is-mobile-layout .teacher-plan-course-title {
  margin-bottom: 6px;
  font-size: 18px;
  line-height: 1.35;
  word-break: break-word;
}

.teacher-plan-container.is-mobile-layout .teacher-plan-course-meta {
  font-size: 12px;
  line-height: 1.6;
}

.teacher-plan-container.is-mobile-layout .teacher-plan-course-actions {
  width: 100%;
}

.teacher-plan-container.is-mobile-layout .teacher-plan-panel {
  min-height: calc(100vh - 240px);
}

.teacher-plan-container.is-mobile-layout .teacher-plan-empty-state {
  align-items: flex-start;
  justify-content: flex-start;
  padding: 24px 18px 28px;
}

.teacher-plan-container.is-mobile-layout .teacher-plan-empty-state__content {
  align-items: stretch;
  width: 100%;
  text-align: left;
}

.teacher-plan-container.is-mobile-layout .teacher-plan-empty-state__eyebrow {
  justify-content: flex-start;
  margin-bottom: 14px;
}

.teacher-plan-container.is-mobile-layout
  .teacher-plan-empty-state__illustration {
  margin-bottom: 18px;
}

.teacher-plan-container.is-mobile-layout .teacher-plan-empty-state__title {
  max-width: none;
  font-size: clamp(28px, 8.6vw, 34px);
}

.teacher-plan-container.is-mobile-layout
  .teacher-plan-empty-state__description {
  max-width: none;
  margin-top: 12px;
  font-size: 14px;
  line-height: 1.7;
}

.teacher-plan-container.is-mobile-layout .teacher-plan-empty-state__features {
  grid-template-columns: 1fr;
  gap: 12px;
  margin-top: 24px;
}

.teacher-plan-container.is-mobile-layout .teacher-plan-empty-state__feature {
  min-height: 0;
  padding: 16px;
  border-radius: 20px;
  gap: 14px;
}

.teacher-plan-container.is-mobile-layout
  .teacher-plan-empty-state__feature-copy
  h4 {
  font-size: 16px;
}

.teacher-plan-container.is-mobile-layout
  .teacher-plan-empty-state__feature-copy
  p {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.6;
}

@media screen and (max-width: 768px) {
  .teacher-plan-container {
    @include teacher-plan-mobile-layout;
  }

  .course-sidebar,
  .teacher-plan-panel {
    @include teacher-plan-mobile-panel-layout;
  }

  .course-sidebar {
    max-height: 48vh;
  }

  .teacher-plan-panel {
    min-height: calc(100vh - 280px);
  }

  .course-item {
    padding: 10px;
    border-radius: 14px;
  }

  .teacher-plan-tabs {
    padding: 0 14px;

    :deep(.el-tabs__header) {
      padding-top: 0;
      overflow-x: auto;
    }

    :deep(.el-tabs__nav-wrap) {
      padding-bottom: 6px;
    }

    :deep(.el-tabs__item) {
      height: 40px;
      padding: 0 14px;
      font-size: 13px;
      white-space: nowrap;
    }
  }

  .teacher-plan-course-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
  }

  .teacher-plan-course-summary {
    width: 100%;
    align-items: flex-start;
    gap: 12px;
  }

  .teacher-plan-course-icon {
    padding: 10px;
    border-radius: 16px;
  }

  .teacher-plan-course-copy {
    min-width: 0;
  }

  .teacher-plan-course-title {
    margin-bottom: 6px;
    font-size: 18px;
    line-height: 1.35;
    word-break: break-word;
  }

  .teacher-plan-course-meta {
    font-size: 12px;
    line-height: 1.6;
  }

  .teacher-plan-course-actions {
    width: 100%;
  }

  .teacher-plan-panel {
    min-height: calc(100vh - 240px);
  }

  .teacher-plan-empty-state {
    align-items: flex-start;
    justify-content: flex-start;
    padding: 24px 18px 28px;
  }

  .teacher-plan-empty-state__content {
    align-items: stretch;
    width: 100%;
    text-align: left;
  }

  .teacher-plan-empty-state__eyebrow {
    justify-content: flex-start;
    margin-bottom: 14px;
  }

  .teacher-plan-empty-state__illustration {
    margin-bottom: 18px;
  }

  .teacher-plan-empty-state__title {
    max-width: none;
    font-size: clamp(28px, 8.6vw, 34px);
  }

  .teacher-plan-empty-state__description {
    max-width: none;
    margin-top: 12px;
    font-size: 14px;
    line-height: 1.7;
  }

  .teacher-plan-empty-state__features {
    grid-template-columns: 1fr;
    gap: 12px;
    margin-top: 24px;
  }

  .teacher-plan-empty-state__feature {
    min-height: 0;
    padding: 16px;
    border-radius: 20px;
    gap: 14px;
  }

  .teacher-plan-empty-state__feature-copy h4 {
    font-size: 16px;
  }

  .teacher-plan-empty-state__feature-copy p {
    margin-top: 6px;
    font-size: 13px;
    line-height: 1.6;
  }
}

@media screen and (max-width: 420px) {
  .teacher-plan-empty-state__eyebrow {
    gap: 8px;
  }

  .teacher-plan-empty-state__eyebrow-main,
  .teacher-plan-empty-state__eyebrow-tag {
    font-size: 12px;
    padding: 7px 12px;
  }

  .teacher-plan-empty-state__feature {
    align-items: flex-start;
  }

  .teacher-plan-empty-state__feature-arrow {
    margin-top: 4px;
  }
}
</style>
