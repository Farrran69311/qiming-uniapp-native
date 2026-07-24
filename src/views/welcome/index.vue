<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watchEffect } from "vue";
import { useRouter } from "vue-router";
import ReCol from "@/components/ReCol";
import LottieAnimation from "@/components/LottieAnimation.vue";
import { useDark } from "./utils";
import {
  TeacherStudentUsage,
  WeekUsage,
  CourseStatistics,
  EfficientIndex
} from "./components/charts";
import StatsOverview from "./components/StatsOverview.vue";
import { isAdmin } from "@/utils/auth";
import { useUserStoreHook } from "@/store/modules/user";

// 导入动画
import EducationAnimation from "@/animation/Education.json";

// 导入图标
import MarkdownIcon from "@/assets/new-release/markdown-svgrepo-com.svg?component";

defineOptions({
  name: "Welcome"
});

const router = useRouter();

const handleViewReport = () => {
  document
    .getElementById("efficient-index-report")
    ?.scrollIntoView({ behavior: "smooth" });
};

const { isDark } = useDark();
const userStore = useUserStoreHook();
const nickname = ref(userStore.nickname || userStore.username);

const selectedAnimation = EducationAnimation;

// 获取当前时间段招呼语
const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 6) return "凌晨好";
  if (hour < 9) return "早上好";
  if (hour < 12) return "上午好";
  if (hour < 14) return "中午好";
  if (hour < 17) return "下午好";
  if (hour < 19) return "傍晚好";
  return "晚上好";
});

// 判断当前用户是否是管理员
const isAdminUser = ref(isAdmin());

// 打字机效果
const displayedText = ref("");
const isTyping = ref(true);
let typewriterTimer: ReturnType<typeof setInterval> | undefined;

const startTypewriter = () => {
  if (typewriterTimer) clearInterval(typewriterTimer);
  const fullText = `${greeting.value}, ${nickname.value}!`;
  displayedText.value = "";
  isTyping.value = true;
  let i = 0;

  typewriterTimer = setInterval(() => {
    if (i < fullText.length) {
      displayedText.value += fullText.charAt(i);
      i++;
    } else {
      clearInterval(typewriterTimer);
      typewriterTimer = undefined;
      isTyping.value = false;
    }
  }, 100);
};

// 监听问候语变化重新触发打字机
watchEffect(() => {
  if (greeting.value && nickname.value) {
    startTypewriter();
  }
});

onBeforeUnmount(() => {
  if (typewriterTimer) clearInterval(typewriterTimer);
});
</script>

<template>
  <div class="welcome-container p-4">
    <!-- Modern Welcome Header -->
    <div
      class="welcome-header mb-6 px-4 py-5 md:px-6 md:py-5 rounded-[24px] relative overflow-hidden flex flex-col lg:flex-row justify-between items-center text-slate-800 dark:text-white shadow-sm transition-all duration-300 hover:shadow-lg hover:scale-[1.01]"
    >
      <div
        class="welcome-copy-block z-10 text-center lg:text-left group w-full lg:w-auto"
      >
        <h1
          class="welcome-title text-3xl md:text-5xl font-extrabold mb-4 leading-tight transition-transform duration-300 group-hover:translate-x-2 min-h-[60px] flex items-center justify-center lg:justify-start tracking-tight"
        >
          {{ displayedText }}
          <span v-if="isTyping" class="cursor-blink ml-1">|</span>
          <span v-else class="wave ml-2">👋</span>
        </h1>
        <p
          class="welcome-description text-lg md:text-2xl font-medium leading-relaxed text-slate-600 dark:text-blue-50 opacity-90 max-w-2xl transition-all duration-300 group-hover:opacity-100 mb-8 mx-auto lg:mx-0"
        >
          欢迎回到智慧教学平台。在这里查看课程、学情与教学分析。
        </p>
        <div
          class="welcome-actions mt-8 flex flex-wrap gap-4 justify-center lg:justify-start items-center"
        >
          <el-button
            :color="isDark ? '#a5b4fc' : '#ffffff'"
            :style="{
              color: isDark ? '#ffffff' : '#a5b4fc',
              border: isDark ? 'none' : '1px solid #e2e8f0'
            }"
            round
            size="large"
            class="welcome-action font-bold text-lg px-8 transition-all duration-300 hover:scale-105 shadow-sm"
            @click="router.push('/course/teacherplan')"
          >
            <div class="flex items-center">
              <IconifyIconOnline icon="ep:plus" class="mr-2 text-xl" />
              <span class="relative top-[-1px]">开始新教案</span>
            </div>
          </el-button>
          <el-button
            :color="isDark ? '#a5b4fc' : '#ffffff'"
            round
            size="large"
            class="welcome-action font-bold text-lg px-8 transition-all duration-300 hover:scale-105 shadow-sm"
            :style="{
              color: isDark ? '#ffffff' : '#a5b4fc',
              border: isDark ? 'none' : '1px solid #e2e8f0'
            }"
            @click="handleViewReport"
          >
            <div class="flex items-center">
              <MarkdownIcon class="mr-2 w-[1.2rem] h-[1.2rem] flex-shrink-0" />
              <span class="relative top-[-1px]">查看报告</span>
            </div>
          </el-button>
        </div>
      </div>

      <div
        class="hidden lg:block z-10 opacity-90 transition-all duration-300 hover:scale-110 hover:opacity-100 ml-auto flex items-center justify-end"
      >
        <div
          class="header-illustration relative w-80 h-80 flex items-center justify-center"
        >
          <!-- Lottie 动画 - 默认显示 -->
          <div class="opacity-90 transition-opacity duration-300">
            <div
              class="circle-decoration absolute -top-10 -right-10 w-40 h-40 bg-blue-400/10 rounded-full blur-3xl"
            />
            <div
              class="circle-decoration absolute -bottom-10 -left-10 w-32 h-32 bg-emerald-400/10 rounded-full blur-2xl"
            />
            <LottieAnimation
              :animation-data="selectedAnimation"
              :width="400"
              :height="350"
              class="drop-shadow-xl brightness-110 saturate-[0.8]"
            />
          </div>
        </div>
      </div>

      <!-- Abstract BG patterns -->
      <div
        class="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-blue-100/20 to-transparent skew-x-12 transform origin-top dark:from-white/5"
      />
    </div>

    <!-- Statistics Grid -->
    <StatsOverview class="stats-overview mb-8" />

    <!-- 统计API图表部分 -->
    <el-row class="dashboard-chart-grid" :gutter="24" justify="space-around">
      <!-- 只有管理员才能看到这两个图表 -->
      <template v-if="isAdminUser">
        <re-col
          v-motion
          class="dashboard-chart-col mb-[24px]"
          :value="12"
          :md="12"
          :sm="24"
          :xs="24"
        >
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="flex items-center justify-between">
                <span class="text-lg font-bold flex items-center">
                  <span class="w-1 h-5 bg-blue-500 rounded-full mr-2" />
                  最近7天平台活跃度
                </span>
              </div>
            </template>
            <div class="h-[350px]">
              <TeacherStudentUsage />
            </div>
          </el-card>
        </re-col>

        <re-col
          v-motion
          class="dashboard-chart-col mb-[24px]"
          :value="12"
          :md="12"
          :sm="24"
          :xs="24"
        >
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="flex items-center justify-between">
                <span class="text-lg font-bold flex items-center">
                  <span class="w-1 h-5 bg-cyan-500 rounded-full mr-2" />
                  本周教学趋势分析
                </span>
              </div>
            </template>
            <div class="h-[350px]">
              <WeekUsage />
            </div>
          </el-card>
        </re-col>
      </template>

      <!-- 教学效率指数图表（所有用户可见） -->
      <re-col
        id="efficient-index-report"
        v-motion
        class="dashboard-chart-col mb-[24px]"
        :value="24"
        :md="10"
        :sm="24"
        :xs="24"
      >
        <el-card shadow="never" class="chart-card analysis-chart-card h-full">
          <template #header>
            <div class="flex items-center justify-between">
              <span class="text-lg font-bold flex items-center">
                <span class="w-1 h-5 bg-amber-500 rounded-full mr-2" />
                效率评价指标
              </span>
            </div>
          </template>
          <div class="min-h-0 md:min-h-[600px]">
            <EfficientIndex />
          </div>
        </el-card>
      </re-col>

      <!-- 所有用户(包括教师)都可以看到课程统计 -->
      <re-col
        v-motion
        class="dashboard-chart-col mb-[24px]"
        :value="24"
        :md="14"
        :sm="24"
        :xs="24"
      >
        <el-card shadow="never" class="chart-card analysis-chart-card h-full">
          <template #header>
            <div class="flex items-center justify-between">
              <span class="text-lg font-bold flex items-center">
                <span class="w-1 h-5 bg-emerald-500 rounded-full mr-2" />
                课程参与度深度分析
              </span>
            </div>
          </template>
          <div class="min-h-0 md:min-h-[600px]">
            <CourseStatistics />
          </div>
        </el-card>
      </re-col>
    </el-row>
  </div>
</template>

<style lang="scss" scoped>
.welcome-container {
  min-height: calc(100vh - 120px);
  background: transparent;
}

.welcome-header {
  background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%);
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  html.dark & {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid rgb(255 255 255 / 10%);
  }

  &:hover {
    box-shadow: 0 20px 40px -10px rgb(148 163 184 / 10%);

    html.dark & {
      box-shadow: 0 20px 40px -10px rgb(0 0 0 / 50%);
    }

    .wave {
      animation: wave-animation 0.6s ease-in-out;
    }
  }
}

@keyframes wave-animation {
  0% {
    transform: rotate(0deg);
  }

  10% {
    transform: rotate(14deg);
  }

  20% {
    transform: rotate(-8deg);
  }

  30% {
    transform: rotate(14deg);
  }

  40% {
    transform: rotate(-4deg);
  }

  50% {
    transform: rotate(10deg);
  }

  60% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(0deg);
  }
}

.chart-card {
  background: var(--el-bg-color-overlay);
  border: none;
  border-radius: 24px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    box-shadow:
      0 10px 25px -5px rgb(0 0 0 / 10%),
      0 8px 10px -6px rgb(0 0 0 / 10%);
    transform: translateY(-4px);
  }

  :deep(.el-card__header) {
    padding: 24px 24px 16px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }

  :deep(.el-card__body) {
    padding: 0 24px 24px;
  }
}

.analysis-chart-card {
  :deep(.el-card__body) {
    padding-top: 16px;
  }
}

@media screen and (max-width: 768px),
  screen and (orientation: landscape) and (max-height: 520px) and (pointer: coarse) {
  .welcome-container {
    margin-right: max(8px, env(safe-area-inset-right, 0px));
    margin-left: max(8px, env(safe-area-inset-left, 0px));
    padding-right: 0 !important;
    padding-left: 0 !important;
  }

  .welcome-header {
    padding: 16px 14px !important;
    margin-bottom: 12px !important;
    border-radius: 16px !important;
    transform: none !important;
  }

  .welcome-copy-block {
    min-width: 0;
  }

  .welcome-title {
    min-height: 40px !important;
    margin-bottom: 8px !important;
    font-size: 26px !important;
    line-height: 1.25 !important;
    transform: none !important;
  }

  .welcome-description {
    margin-bottom: 16px !important;
    font-size: 15px !important;
    line-height: 1.6 !important;
  }

  .welcome-actions {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px !important;
    width: 100%;
    margin-top: 0 !important;
  }

  :deep(.welcome-action.el-button) {
    width: 100%;
    min-width: 0;
    min-height: 44px;
    padding: 0 10px !important;
    margin-left: 0 !important;
    font-size: 15px !important;
    transform: none !important;
  }

  .stats-overview {
    margin-bottom: 12px !important;
  }

  .dashboard-chart-grid {
    margin-right: -4px !important;
    margin-left: -4px !important;
  }

  .dashboard-chart-col {
    padding-right: 4px !important;
    padding-left: 4px !important;
    margin-bottom: 12px !important;
  }

  .chart-card {
    border-radius: 12px;

    &:hover {
      box-shadow: none;
      transform: none;
    }

    :deep(.el-card__header) {
      padding: 14px 10px 10px;

      .text-lg {
        min-width: 0;
        font-size: 16px;
        line-height: 1.4;
      }
    }

    :deep(.el-card__body) {
      min-width: 0;
      padding: 8px 4px 12px;
    }
  }

  .analysis-chart-card {
    :deep(.el-card__body) {
      padding-top: 6px;
    }
  }
}

@media screen and (max-width: 340px) {
  .welcome-container {
    margin-right: max(6px, env(safe-area-inset-right, 0px));
    margin-left: max(6px, env(safe-area-inset-left, 0px));
  }

  .welcome-title {
    font-size: 24px !important;
  }

  :deep(.welcome-action.el-button) {
    padding: 0 6px !important;
    font-size: 14px !important;
  }
}

@media screen and (orientation: landscape) and (max-height: 520px) and (pointer: coarse) {
  .welcome-header {
    padding: 12px 16px !important;
  }

  .welcome-title {
    min-height: 32px !important;
    font-size: 24px !important;
  }

  .welcome-description {
    margin-bottom: 10px !important;
    font-size: 14px !important;
  }

  .welcome-actions {
    max-width: 420px;
    margin-right: auto !important;
    margin-left: auto !important;
  }
}

.wave {
  display: inline-block;
  cursor: pointer;
  transform-origin: 70% 70%;
  transition: all 0.3s ease;
  animation: wave-animation 2.5s infinite;

  &:hover {
    animation: wave-animation 0.6s ease-in-out;
  }
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0;
  }
}

.cursor-blink {
  display: inline-block;
  font-weight: 300;
  color: #1f2225;
  animation: blink 1s step-end infinite;

  html.dark & {
    color: rgb(255 255 255 / 80%);
  }
}
</style>
