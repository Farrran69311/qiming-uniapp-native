<template>
  <div
    v-loading="loading"
    :class="[
      'list-container h-full flex flex-col',
      { 'is-mobile-layout': isMobileLayout }
    ]"
  >
    <!-- 顶部统计与工具栏 -->
    <div
      class="plan-list-toolbar flex justify-between items-center mb-6 bg-[var(--el-fill-color-blank)] p-4 rounded-2xl border border-[var(--el-border-color-lighter)] shadow-sm"
    >
      <div v-if="props.courseId" class="plan-list-toolbar__copy flex flex-col">
        <h3
          class="text-lg font-bold text-[var(--el-text-color-primary)] flex items-center mb-0.5"
        >
          <el-icon class="mr-2 text-[var(--el-color-primary)]"
            ><Collection
          /></el-icon>
          已生成教案 ({{ total }})
        </h3>
        <p class="text-xs text-[var(--el-text-color-secondary)] opacity-80">
          当前显示所选课程关联的教案库
        </p>
      </div>
      <div v-else class="plan-list-toolbar__copy flex flex-col">
        <h3
          class="text-lg font-bold text-[var(--el-text-color-primary)] flex items-center mb-0.5"
        >
          <el-icon class="mr-2 text-[var(--el-color-primary)]"
            ><Collection
          /></el-icon>
          全部教案库
        </h3>
        <p class="text-xs text-[var(--el-text-color-secondary)] opacity-80">
          查看并管理您的 AI 生成历史
        </p>
      </div>
      <div class="plan-list-toolbar__actions flex items-center gap-3">
        <el-button
          type="primary"
          :icon="Refresh"
          plain
          class="!rounded-xl"
          @click="fetchPlanList"
        >
          刷新
        </el-button>
      </div>
    </div>

    <el-alert
      v-if="createdPlanIdentityError"
      :title="createdPlanIdentityError"
      type="error"
      show-icon
      closable
      class="mb-4"
      @close="createdPlanIdentityError = ''"
    />

    <!-- 列表展示区 - 垂直铺满 -->
    <div class="flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
      <div
        v-if="planList.length > 0"
        class="plan-card-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-6"
      >
        <div
          v-for="item in planList"
          :key="item.teacherPlanId"
          class="plan-card group bg-[var(--el-bg-color-overlay)] border border-[var(--el-border-color-light)] rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:border-[var(--el-color-primary-light-5)] relative overflow-hidden flex flex-col h-full"
        >
          <el-icon
            class="absolute -right-6 -bottom-6 text-8xl text-[var(--el-fill-color-light)] group-hover:text-[var(--el-color-primary-light-9)] transition-colors pointer-events-none opacity-50"
          >
            <Document />
          </el-icon>

          <div class="relative z-10 flex flex-col h-full">
            <div
              class="plan-card__header flex justify-between items-start mb-5"
            >
              <span
                class="px-2.5 py-1 bg-[var(--el-fill-color-light)] text-[var(--el-text-color-secondary)] text-xs font-semibold rounded-md border border-[var(--el-border-color-lighter)]"
              >
                ID: {{ item.teacherPlanId }}
              </span>
              <el-dropdown trigger="click">
                <el-button
                  circle
                  size="small"
                  aria-label="教案操作"
                  title="教案操作"
                  class="plan-card__menu !bg-transparent !border-transparent hover:!bg-[var(--el-fill-color-light)]"
                >
                  <el-icon><MoreFilled /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item :icon="View" @click="checkProgress(item)"
                      >查看详情</el-dropdown-item
                    >
                    <el-dropdown-item
                      :icon="Download"
                      :disabled="!canDownloadTeacherPlan(item)"
                      @click="openDownload(item)"
                      >下载文件</el-dropdown-item
                    >
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>

            <h4
              class="text-lg font-bold text-[var(--el-text-color-primary)] mb-3 line-clamp-1"
              :title="item.courseName"
            >
              {{ item.courseName }}
            </h4>
            <div class="space-y-2 mb-6">
              <p
                class="text-sm text-[var(--el-text-color-regular)] flex items-center"
                :title="item.chapterName"
              >
                <el-icon class="mr-2 opacity-60"><Memo /></el-icon>
                {{ item.chapterName }}
              </p>
              <p
                class="text-[12px] text-[var(--el-text-color-secondary)] flex items-center"
              >
                <el-icon class="mr-2 opacity-60"><Calendar /></el-icon>
                {{ formatPlanDate(item.updatedAt || item.createdAt) }}
              </p>
              <p
                v-if="item.availability !== 'synced'"
                class="text-[12px] flex items-center"
                :class="getAvailabilityTextClass(item.availability)"
              >
                <el-icon class="mr-2 opacity-70"><WarningFilled /></el-icon>
                {{ getAvailabilityCardLabel(item.availability) }}
              </p>
            </div>

            <div
              class="plan-card__footer mt-auto pt-5 border-t border-[var(--el-border-color-lighter)] flex justify-between items-center"
            >
              <el-tag
                size="small"
                :type="getStatusTagType(item)"
                effect="dark"
                class="plan-card__status !rounded-full !px-3 font-medium"
              >
                {{ getStatusLabel(item) }}
              </el-tag>

              <el-button
                type="primary"
                size="small"
                class="plan-card__action !rounded-lg !px-4 hover:shadow-sm"
                @click="checkProgress(item)"
              >
                管理
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div
        v-else
        class="py-20 flex flex-col items-center justify-center bg-[var(--el-bg-color-overlay)] border border-[var(--el-border-color-light)] rounded-3xl shadow-sm"
      >
        <div
          class="w-32 h-32 bg-[var(--el-fill-color-light)] rounded-full flex items-center justify-center mb-6"
        >
          <el-icon class="text-6xl text-[var(--el-text-color-placeholder)]"
            ><Box
          /></el-icon>
        </div>
        <h3 class="text-xl font-bold text-[var(--el-text-color-primary)] mb-2">
          暂无教案内容
        </h3>
        <p
          class="text-[var(--el-text-color-secondary)] mb-8 max-w-xs text-center"
        >
          {{
            props.courseId
              ? "该课程下还没有生成的教案，请切换到“智能生成”选项卡。"
              : "您还没有生成过任何教案。"
          }}
        </p>
        <el-button
          type="primary"
          size="large"
          class="!rounded-xl px-10"
          @click="$emit('switch-tab', 'generate')"
        >
          立即去生成
        </el-button>
      </div>
    </div>

    <!-- 分页 -->
    <div
      v-if="planList.length > 0"
      class="plan-list-pagination mt-8 flex justify-center"
    >
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[8, 12, 16, 24]"
        layout="total, prev, pager, next, sizes"
        :total="total"
        background
        class="custom-pagination"
        @current-change="handleCurrentChange"
        @size-change="handleSizeChange"
      />
    </div>

    <!-- 详情对话框 -->
    <el-dialog
      v-model="progressDialogVisible"
      title="教案处理状态"
      :width="isMobileLayout ? 'calc(100vw - 32px)' : '480px'"
      center
      align-center
      class="rounded-dialog plan-progress-dialog"
    >
      <div
        v-loading="progressLoading"
        class="plan-progress-content min-h-[280px] flex flex-col"
      >
        <span class="sr-only" aria-live="polite" aria-atomic="true">
          {{ progressAnnouncement }}
        </span>
        <div v-if="currentProgress">
          <div
            class="plan-progress-summary bg-[var(--el-fill-color-light)] rounded-2xl p-6 mb-8 border border-[var(--el-border-color-lighter)]"
          >
            <div class="mb-4">
              <span
                class="text-xs text-[var(--el-text-color-secondary)] font-medium block mb-1"
                >所属课程</span
              >
              <div
                class="text-base font-bold text-[var(--el-text-color-primary)] flex items-center"
              >
                <div
                  class="w-1.5 h-4 bg-[var(--el-color-primary)] rounded-full mr-2"
                />
                {{ currentPlan?.courseName }}
              </div>
            </div>
            <div>
              <span
                class="text-xs text-[var(--el-text-color-secondary)] font-medium block mb-1"
                >对应章节</span
              >
              <div
                class="text-sm font-medium text-[var(--el-text-color-regular)] flex items-center"
              >
                <div
                  class="w-1.5 h-4 bg-[var(--el-color-warning)] rounded-full mr-2"
                />
                {{ currentPlan?.chapterName }}
              </div>
            </div>
          </div>

          <el-alert
            v-if="currentProgress.availability !== 'synced'"
            :title="getAvailabilityLabel(currentProgress.availability)"
            :type="getAvailabilityAlertType(currentProgress.availability)"
            :closable="false"
            show-icon
            class="mb-5"
          />

          <el-alert
            v-if="progressError"
            :title="progressError"
            type="warning"
            :closable="false"
            show-icon
            class="mb-5"
          />

          <div
            v-if="isCompletedProgress"
            class="plan-progress-state text-center pb-4"
          >
            <div class="plan-progress-icon w-20 h-20 mx-auto mb-2">
              <lottie-animation
                v-if="!prefersReducedMotion"
                :animation-data="SuccessAnim"
                :width="80"
                :height="80"
              />
              <div
                v-else
                class="w-16 h-16 mx-auto rounded-full bg-[var(--el-color-success-light-9)] text-[var(--el-color-success)] flex items-center justify-center"
              >
                <el-icon class="text-4xl"><CircleCheckFilled /></el-icon>
              </div>
            </div>
            <h4 class="plan-progress-title text-lg font-bold mb-2">生成成功</h4>
            <p class="text-sm text-[var(--el-text-color-secondary)] mb-2">
              {{ currentProgress.message || "教案已完成，可下载文件" }}
            </p>
            <p
              v-if="!canDownloadTeacherPlan(currentProgress)"
              class="text-sm text-[var(--el-color-warning)]"
            >
              文件地址尚未确认，请刷新状态后再试
            </p>
            <div class="plan-progress-actions flex gap-4 mt-8">
              <el-button
                v-if="canDownloadTeacherPlan(currentProgress)"
                type="primary"
                size="large"
                class="plan-progress-button flex-1 !rounded-xl !h-12 shadow-md"
                @click="downloadPlan(currentProgress)"
              >
                <el-icon class="mr-2"><Download /></el-icon>
                下载教案
              </el-button>
              <el-button
                v-else
                type="primary"
                size="large"
                :loading="progressLoading"
                class="plan-progress-button flex-1 !rounded-xl !h-12 shadow-md"
                @click="refreshProgressManually"
              >
                <el-icon v-if="!progressLoading" class="mr-2"
                  ><Refresh
                /></el-icon>
                刷新状态
              </el-button>
              <el-button
                size="large"
                class="plan-progress-button !rounded-xl !h-12 !px-6"
                @click="progressDialogVisible = false"
              >
                关闭
              </el-button>
            </div>
          </div>

          <div
            v-else-if="isFailedProgress"
            class="plan-progress-state text-center pb-4"
          >
            <div
              class="plan-progress-icon w-16 h-16 bg-[var(--el-color-danger-light-9)] text-[var(--el-color-danger)] rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <el-icon class="text-3xl"><CircleCloseFilled /></el-icon>
            </div>
            <h4 class="plan-progress-title text-lg font-bold mb-2">生成失败</h4>
            <p class="text-sm text-[var(--el-text-color-secondary)] mb-2">
              {{ currentProgress.message || "教案生成未完成" }}
            </p>
            <el-tag
              v-if="currentProgress.errorCode"
              type="danger"
              effect="plain"
              class="!rounded-full"
            >
              错误码：{{ currentProgress.errorCode }}
            </el-tag>
            <div class="plan-progress-actions flex gap-4 mt-8">
              <el-button
                v-if="currentProgress.retryable"
                type="primary"
                size="large"
                :loading="retryLoading"
                class="plan-progress-button flex-1 !rounded-xl !h-12 shadow-md"
                @click="retryPlan"
              >
                <el-icon v-if="!retryLoading" class="mr-2"><Refresh /></el-icon>
                重新生成
              </el-button>
              <el-button
                size="large"
                class="plan-progress-button !rounded-xl !h-12 !px-6"
                @click="progressDialogVisible = false"
              >
                关闭
              </el-button>
            </div>
          </div>

          <div
            v-else-if="isCancelledProgress"
            class="plan-progress-state text-center pb-4"
          >
            <div
              class="plan-progress-icon w-16 h-16 bg-[var(--el-fill-color-light)] text-[var(--el-text-color-secondary)] rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <el-icon class="text-3xl"><WarningFilled /></el-icon>
            </div>
            <h4 class="plan-progress-title text-lg font-bold mb-2">
              {{
                currentProgress.status === "timed_out"
                  ? "生成超时"
                  : "任务已取消"
              }}
            </h4>
            <p class="text-sm text-[var(--el-text-color-secondary)] mb-2">
              {{ currentProgress.message || "任务没有产出可用教案" }}
            </p>
            <div class="plan-progress-actions flex gap-4 mt-8">
              <el-button
                v-if="currentProgress.retryable"
                type="primary"
                size="large"
                :loading="retryLoading"
                class="plan-progress-button flex-1 !rounded-xl !h-12 shadow-md"
                @click="retryPlan"
              >
                <el-icon v-if="!retryLoading" class="mr-2"><Refresh /></el-icon>
                重新生成
              </el-button>
              <el-button
                size="large"
                class="plan-progress-button !rounded-xl !h-12 !px-6"
                @click="progressDialogVisible = false"
              >
                关闭
              </el-button>
            </div>
          </div>

          <div v-else class="plan-progress-state text-center pb-4">
            <div
              class="plan-progress-icon w-16 h-16 bg-[var(--el-color-primary-light-9)] text-[var(--el-color-primary)] rounded-full flex items-center justify-center mx-auto mb-4"
              :class="{ 'animate-pulse': isActiveProgress }"
            >
              <el-icon class="text-3xl"><Cpu /></el-icon>
            </div>
            <h4 class="plan-progress-title text-lg font-bold mb-2">
              {{ getProgressStatusLabel(currentProgress) }}
            </h4>
            <p class="text-sm text-[var(--el-text-color-secondary)] mb-2">
              {{ currentProgress.message || "正在等待任务状态" }}
            </p>
            <el-progress
              :percentage="currentProgress.progressPercent"
              :stroke-width="15"
              :striped="isActiveProgress"
              :striped-flow="isActiveProgress"
              aria-label="教案生成进度"
              class="plan-progress-bar mb-4 px-4 mt-8"
              :color="'var(--el-color-primary)'"
            />
            <div
              v-if="currentProgress.stage"
              class="text-xs text-[var(--el-text-color-placeholder)] mb-5"
            >
              当前阶段：{{ getProgressStageLabel(currentProgress.stage) }}
            </div>
            <div class="plan-progress-actions flex gap-4 mt-8">
              <el-button
                size="large"
                :loading="progressLoading"
                class="plan-progress-button flex-1 !rounded-xl !h-12"
                @click="refreshProgressManually"
              >
                <el-icon v-if="!progressLoading" class="mr-2"
                  ><Refresh
                /></el-icon>
                刷新状态
              </el-button>
              <el-button
                size="large"
                class="plan-progress-button !rounded-xl !h-12 !px-6"
                @click="progressDialogVisible = false"
              >
                关闭
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type PropType
} from "vue";
import { useMediaQuery } from "@vueuse/core";
import { ElMessage } from "element-plus";
import {
  generateTeacherPlan,
  getTeacherPlanList,
  getTeacherPlanProgress,
  type TeacherPlan,
  type TeacherPlanAvailability,
  type TeacherPlanProgress
} from "@/api/course";
import { useAppStoreHook } from "@/store/modules/app";
import {
  Refresh,
  Collection,
  Document,
  Memo,
  View,
  CircleCheckFilled,
  CircleCloseFilled,
  Download,
  Cpu,
  MoreFilled,
  Box,
  Calendar,
  WarningFilled
} from "@element-plus/icons-vue";
import LottieAnimation from "@/components/LottieAnimation.vue";
import SuccessAnim from "@/lottie/Free Success Alert icon Animation.json";
import {
  canDownloadTeacherPlan,
  canPollTeacherPlan,
  getTeacherPlanPollDelay,
  claimTeacherPlanPoller,
  isTeacherPlanStateChanged,
  isValidTeacherPlanCreation,
  mergeTeacherPlanProgress,
  normalizeTeacherPlan,
  normalizeTeacherPlanProgress,
  teacherPlanFromCreation,
  teacherPlanMatchesCreation,
  teacherPlanProgressFromPlan,
  teacherPlanStateSignature,
  type TeacherPlanCreationHandoff
} from "../teacherPlanState";

const props = defineProps({
  courseId: {
    type: Number,
    default: null
  },
  createdPlan: {
    type: Object as PropType<TeacherPlanCreationHandoff | null>,
    default: null
  }
});

const emit = defineEmits<{
  (event: "switch-tab", tab: "generate" | "list"): void;
  (event: "created-plan-consumed", identity: string): void;
}>();
const appStore = useAppStoreHook();
const isMobileLayout = computed(() => appStore.getDevice === "mobile");
const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

const planList = ref<TeacherPlan[]>([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(12);
const loading = ref(false);

const progressDialogVisible = ref(false);
const progressLoading = ref(false);
const retryLoading = ref(false);
const progressError = ref("");
const createdPlanIdentityError = ref("");
const currentPlan = ref<TeacherPlan | null>(null);
const currentProgress = ref<TeacherPlanProgress | null>(null);

let listRequestVersion = 0;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let pollAbortController: AbortController | null = null;
let pollGeneration = 0;
let pollInFlight = false;
let unchangedPolls = 0;
let networkErrors = 0;
let previousProgressSignature = "";
let pollStartedAt = 0;
let releasePollOwnership: (() => void) | null = null;
let handledCreationIdentity = "";

const MAX_POLL_DURATION_MS = 15 * 60 * 1000;
const MAX_NETWORK_ERRORS = 5;

const isCompletedProgress = computed(
  () => currentProgress.value?.status === "completed"
);
const isFailedProgress = computed(
  () => currentProgress.value?.status === "failed"
);
const isCancelledProgress = computed(() =>
  ["cancelled", "timed_out"].includes(currentProgress.value?.status || "")
);
const isActiveProgress = computed(() => {
  const progress = currentProgress.value;
  return Boolean(
    progress &&
      ["pending", "processing"].includes(progress.status) &&
      progress.availability === "synced" &&
      !prefersReducedMotion.value
  );
});
const progressAnnouncement = computed(() => {
  const progress = currentProgress.value;
  if (!progress) return progressError.value;
  const status = getProgressStatusLabel(progress);
  const percentage = `${Math.round(progress.progressPercent)}%`;
  return [status, percentage, progress.message, progressError.value]
    .filter(Boolean)
    .join("，");
});

function getErrorMessage(error: unknown, fallback: string): string {
  const value = error as {
    response?: { data?: { msg?: string; message?: string } };
    message?: string;
  };
  return (
    value?.response?.data?.msg ||
    value?.response?.data?.message ||
    value?.message ||
    fallback
  );
}

function isAbortError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      ((error as { code?: string }).code === "ERR_CANCELED" ||
        (error as { name?: string }).name === "CanceledError" ||
        (error as { name?: string }).name === "AbortError")
  );
}

function formatPlanDate(value: string): string {
  if (!value) return "时间待确认";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getStatusLabel(plan: TeacherPlan): string {
  switch (plan.status) {
    case "pending":
      return "排队中";
    case "processing":
      return `生成中 ${Math.round(plan.progressPercent)}%`;
    case "completed":
      return "生成完成";
    case "failed":
      return "生成失败";
    case "cancelled":
      return "已取消";
    case "timed_out":
      return "已超时";
    default:
      return "状态待确认";
  }
}

function getStatusTagType(
  plan: TeacherPlan
): "primary" | "success" | "warning" | "danger" | "info" {
  if (["unavailable", "not_found"].includes(plan.availability)) return "info";
  switch (plan.status) {
    case "completed":
      return "success";
    case "failed":
    case "timed_out":
      return "danger";
    case "cancelled":
      return "warning";
    case "pending":
    case "processing":
      return "primary";
    default:
      return "info";
  }
}

function getProgressStatusLabel(progress: TeacherPlanProgress): string {
  if (progress.availability === "unavailable") return "状态暂不可用";
  if (progress.availability === "not_found") return "任务状态异常";
  switch (progress.status) {
    case "pending":
      return "等待任务开始";
    case "processing":
      return "AI 智能撰写中";
    case "completed":
      return "生成成功";
    case "failed":
      return "生成失败";
    case "cancelled":
      return "任务已取消";
    case "timed_out":
      return "生成超时";
    default:
      return "状态待确认";
  }
}

function getProgressStageLabel(stage: string): string {
  const labels: Record<string, string> = {
    queued: "等待调度",
    pending: "等待任务开始",
    content_loading: "加载课程内容",
    model_generation: "生成教案内容",
    document_generation: "整理教案文档",
    processing: "生成处理中",
    completed: "生成完成",
    cancelled: "任务已取消",
    timed_out: "生成超时",
    legacy: "历史任务"
  };
  return labels[stage] || stage.replace(/[_-]+/g, " ");
}

function getAvailabilityLabel(availability: TeacherPlanAvailability): string {
  switch (availability) {
    case "stale":
      return "状态待确认，保留最近一次结果";
    case "unavailable":
      return "暂时无法确认任务状态，请手动刷新";
    case "not_found":
      return "上游任务不存在，请刷新或联系支持排查";
    default:
      return "状态已同步";
  }
}

function getAvailabilityCardLabel(
  availability: TeacherPlanAvailability
): string {
  switch (availability) {
    case "stale":
      return "状态待确认";
    case "unavailable":
      return "状态暂不可用";
    case "not_found":
      return "任务状态异常";
    default:
      return "状态已同步";
  }
}

function getAvailabilityTextClass(
  availability: TeacherPlanAvailability
): string {
  return availability === "stale"
    ? "text-[var(--el-color-warning)]"
    : "text-[var(--el-color-danger)]";
}

function getAvailabilityAlertType(
  availability: TeacherPlanAvailability
): "warning" | "error" | "info" | "success" {
  if (availability === "stale") return "warning";
  if (availability === "unavailable" || availability === "not_found") {
    return "error";
  }
  return "info";
}

function clearPollTimer() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function stopProgressPolling() {
  pollGeneration += 1;
  clearPollTimer();
  pollAbortController?.abort();
  pollAbortController = null;
  pollInFlight = false;
  const release = releasePollOwnership;
  releasePollOwnership = null;
  release?.();
}

function isDocumentVisible(): boolean {
  return (
    typeof document === "undefined" || document.visibilityState === "visible"
  );
}

function mergePlanIntoList(plan: TeacherPlan) {
  const index = planList.value.findIndex(
    item => item.teacherPlanId === plan.teacherPlanId
  );
  if (index >= 0) {
    planList.value.splice(index, 1, plan);
  }
}

function replacePlanInList(previousId: number, plan: TeacherPlan) {
  const index = planList.value.findIndex(
    item =>
      item.teacherPlanId === previousId ||
      item.teacherPlanId === plan.teacherPlanId
  );
  if (index >= 0) {
    planList.value.splice(index, 1, plan);
  } else {
    planList.value.unshift(plan);
    total.value += 1;
  }
}

const fetchPlanList = async () => {
  const requestVersion = ++listRequestVersion;
  loading.value = true;
  try {
    const params: { pageNum: number; pageSize: number; courseId?: number } = {
      pageNum: currentPage.value,
      pageSize: pageSize.value
    };
    if (props.courseId) params.courseId = props.courseId;

    const res = await getTeacherPlanList(params);
    if (requestVersion !== listRequestVersion) return;

    if (res?.code === 200 && res.data) {
      planList.value = (res.data.teacherPlanList || []).map(
        normalizeTeacherPlan
      );
      total.value = res.data.total || 0;
    } else {
      planList.value = [];
      total.value = 0;
      ElMessage.warning(res?.msg || "获取教案列表失败");
    }
  } catch (error) {
    if (requestVersion === listRequestVersion) {
      console.error("获取教案列表失败:", error);
      ElMessage.error(getErrorMessage(error, "获取教案列表失败"));
    }
  } finally {
    if (requestVersion === listRequestVersion) loading.value = false;
  }
};

function scheduleProgressPoll(generation: number, changed: boolean) {
  clearPollTimer();
  if (
    generation !== pollGeneration ||
    !progressDialogVisible.value ||
    !currentProgress.value ||
    !canPollTeacherPlan(currentProgress.value) ||
    !isDocumentVisible()
  ) {
    return;
  }

  if (Date.now() - pollStartedAt >= MAX_POLL_DURATION_MS) {
    progressError.value =
      "等待时间较长，已暂停自动刷新。您可以稍后手动刷新状态。";
    return;
  }

  if (changed) unchangedPolls = 0;
  const delay = getTeacherPlanPollDelay(
    Math.max(unchangedPolls - 1, 0),
    networkErrors
  );
  pollTimer = setTimeout(() => {
    pollTimer = null;
    void requestProgress(generation, false);
  }, delay);
}

async function requestProgress(generation: number, showLoading: boolean) {
  const plan = currentPlan.value;
  if (
    !plan ||
    generation !== pollGeneration ||
    !progressDialogVisible.value ||
    !isDocumentVisible() ||
    pollInFlight
  ) {
    return;
  }

  pollInFlight = true;
  if (showLoading) progressLoading.value = true;
  const controller = new AbortController();
  pollAbortController = controller;
  const previousSignature = previousProgressSignature;

  try {
    const res = await getTeacherPlanProgress(
      { teacherPlanId: plan.teacherPlanId },
      controller.signal
    );
    if (generation !== pollGeneration || !currentPlan.value) return;
    if (res?.code !== 200 || !res.data) {
      throw new Error(res?.msg || "获取生成进度失败");
    }

    const nextProgress = normalizeTeacherPlanProgress(
      res.data,
      currentProgress.value || teacherPlanProgressFromPlan(plan)
    );
    if (plan.taskId && nextProgress.taskId !== plan.taskId) {
      progressError.value =
        "进度接口返回的任务身份与当前教案不一致，已停止自动轮询";
      clearPollTimer();
      return;
    }
    const changed = isTeacherPlanStateChanged(previousSignature, nextProgress);
    currentProgress.value = nextProgress;
    currentPlan.value = mergeTeacherPlanProgress(plan, nextProgress);
    mergePlanIntoList(currentPlan.value);
    previousProgressSignature = teacherPlanStateSignature(nextProgress);
    progressError.value = "";
    networkErrors = 0;
    unchangedPolls = changed ? 0 : unchangedPolls + 1;

    if (!canPollTeacherPlan(nextProgress)) {
      clearPollTimer();
      return;
    }
    scheduleProgressPoll(generation, changed);
  } catch (error) {
    if (
      generation !== pollGeneration ||
      isAbortError(error) ||
      controller.signal.aborted
    ) {
      return;
    }
    progressError.value = getErrorMessage(
      error,
      "获取生成进度失败，请稍后重试"
    );
    networkErrors += 1;
    if (networkErrors >= MAX_NETWORK_ERRORS) {
      progressError.value =
        "连续获取状态失败，已暂停自动刷新。请检查网络后手动刷新。";
      clearPollTimer();
      return;
    }
    if (currentProgress.value && canPollTeacherPlan(currentProgress.value)) {
      scheduleProgressPoll(generation, false);
    } else {
      clearPollTimer();
    }
  } finally {
    if (generation === pollGeneration) {
      pollInFlight = false;
      pollAbortController = null;
      progressLoading.value = false;
    }
  }
}

function startProgressPolling(showLoading = true) {
  stopProgressPolling();
  unchangedPolls = 0;
  networkErrors = 0;
  previousProgressSignature = currentProgress.value
    ? teacherPlanStateSignature(currentProgress.value)
    : "";
  pollStartedAt = Date.now();
  if (currentPlan.value) {
    releasePollOwnership = claimTeacherPlanPoller(
      currentPlan.value.teacherPlanId,
      stopProgressPolling
    );
  }
  const generation = pollGeneration;
  void requestProgress(generation, showLoading);
}

const checkProgress = (plan: TeacherPlan) => {
  stopProgressPolling();
  const normalizedPlan = normalizeTeacherPlan(plan);
  currentPlan.value = normalizedPlan;
  currentProgress.value = teacherPlanProgressFromPlan(normalizedPlan);
  progressError.value = "";
  progressDialogVisible.value = true;
  startProgressPolling(true);
};

function getCreationIdentity(creation: TeacherPlanCreationHandoff): string {
  return `${creation.courseId}:${creation.teacherPlanId}:${creation.taskId}`;
}

function rejectCreatedPlan(
  creation: TeacherPlanCreationHandoff,
  message: string
) {
  createdPlanIdentityError.value = message;
  stopProgressPolling();
  progressDialogVisible.value = false;
  currentPlan.value = null;
  currentProgress.value = null;
  ElMessage.error(message);
  emit("created-plan-consumed", getCreationIdentity(creation));
}

async function focusCreatedPlan(creation: TeacherPlanCreationHandoff) {
  if (props.courseId !== creation.courseId) return;

  const identity = getCreationIdentity(creation);
  if (identity === handledCreationIdentity) return;
  handledCreationIdentity = identity;
  createdPlanIdentityError.value = "";

  if (!isValidTeacherPlanCreation(creation)) {
    rejectCreatedPlan(
      creation,
      "创建响应缺少有效的教案任务身份，已停止自动轮询"
    );
    return;
  }

  currentPage.value = 1;
  await fetchPlanList();

  if (props.courseId !== creation.courseId) return;

  const identityCandidate = planList.value.find(
    item =>
      item.teacherPlanId === creation.teacherPlanId ||
      item.taskId === creation.taskId
  );
  if (
    identityCandidate &&
    !teacherPlanMatchesCreation(identityCandidate, creation)
  ) {
    rejectCreatedPlan(
      creation,
      "新建教案与列表返回的课程、章节或任务身份不一致，已停止自动轮询"
    );
    return;
  }

  const plan = identityCandidate || teacherPlanFromCreation(creation);
  if (!teacherPlanMatchesCreation(plan, creation)) {
    rejectCreatedPlan(
      creation,
      "无法确认本次新建教案的任务身份，已停止自动轮询"
    );
    return;
  }

  if (!identityCandidate) {
    planList.value.unshift(plan);
    total.value = Math.max(total.value, planList.value.length);
  }
  checkProgress(plan);
  emit("created-plan-consumed", identity);
}

const refreshProgressManually = () => {
  if (!currentPlan.value) return;
  progressError.value = "";
  startProgressPolling(true);
};

const openDownload = (plan: TeacherPlan) => {
  if (canDownloadTeacherPlan(plan)) {
    downloadPlan(plan);
  } else {
    checkProgress(plan);
  }
};

const downloadPlan = (state: {
  status: TeacherPlanProgress["status"];
  downloadUrl?: string;
}) => {
  if (!canDownloadTeacherPlan(state) || !state.downloadUrl) {
    ElMessage.warning("当前教案尚无可用下载文件");
    return;
  }
  try {
    const url = new URL(state.downloadUrl, window.location.origin);
    if (!["http:", "https:"].includes(url.protocol))
      throw new Error("invalid url");
    window.open(url.toString(), "_blank", "noopener,noreferrer");
    ElMessage.success("开始下载 Markdown 教案");
  } catch {
    ElMessage.warning("下载链接无效，请刷新状态后再试");
  }
};

const retryPlan = async () => {
  const plan = currentPlan.value;
  if (!plan || retryLoading.value) return;
  retryLoading.value = true;
  stopProgressPolling();
  try {
    const res = await generateTeacherPlan({
      course_id: plan.courseId,
      chapter_id: plan.chapterId
    });
    if (res?.code !== 200 || !res.data) {
      throw new Error(res?.msg || "重新生成失败");
    }

    const nextPlan = normalizeTeacherPlan({
      ...plan,
      ...res.data,
      courseName: plan.courseName,
      chapterName: plan.chapterName,
      createdAt: plan.createdAt
    });
    currentPlan.value = nextPlan;
    currentProgress.value = teacherPlanProgressFromPlan(nextPlan);
    progressError.value = "";
    replacePlanInList(plan.teacherPlanId, nextPlan);
    ElMessage.success("已重新提交教案生成任务");
    startProgressPolling(false);
  } catch (error) {
    progressError.value = getErrorMessage(error, "重新生成失败，请稍后重试");
    ElMessage.error(progressError.value);
  } finally {
    retryLoading.value = false;
  }
};

watch(
  () => props.courseId,
  () => {
    stopProgressPolling();
    progressDialogVisible.value = false;
    currentPlan.value = null;
    currentProgress.value = null;
    createdPlanIdentityError.value = "";
    currentPage.value = 1;
    void fetchPlanList();
  }
);

watch(
  [() => props.createdPlan, () => props.courseId],
  ([creation, courseId]) => {
    if (!creation || courseId !== creation.courseId) return;
    void focusCreatedPlan(creation);
  },
  { immediate: true }
);

watch(progressDialogVisible, visible => {
  if (!visible) {
    stopProgressPolling();
  } else if (currentProgress.value && !pollInFlight) {
    startProgressPolling(false);
  }
});

const handleSizeChange = (val: number) => {
  pageSize.value = val;
  void fetchPlanList();
};

const handleCurrentChange = (val: number) => {
  currentPage.value = val;
  void fetchPlanList();
};

const handleVisibilityChange = () => {
  if (!isDocumentVisible()) {
    stopProgressPolling();
    return;
  }
  if (
    progressDialogVisible.value &&
    currentProgress.value &&
    canPollTeacherPlan(currentProgress.value)
  ) {
    startProgressPolling(false);
  }
};

onMounted(() => {
  document.addEventListener("visibilitychange", handleVisibilityChange);
  void fetchPlanList();
});

onBeforeUnmount(() => {
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  stopProgressPolling();
});
</script>

<style lang="scss" scoped>
.list-container {
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

:deep(.custom-pagination) {
  .el-pagination__sizes {
    margin-right: 20px;
  }

  &.is-background .el-pager li:not(.is-disabled).is-active {
    font-weight: bold;
    background-color: var(--el-color-primary);
    border-radius: 8px;
  }

  &.is-background .el-pager li {
    background-color: var(--el-bg-color-overlay);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }
}

:deep(.rounded-dialog) {
  overflow: hidden;
  border-radius: 20px;
  align-self: center;

  .el-dialog__header {
    margin-right: 0;
  }
}

.custom-scrollbar {
  &::-webkit-scrollbar {
    width: 5px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--el-border-color-lighter);
    border-radius: 10px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }
}

.line-clamp-1 {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
}

.list-container.is-mobile-layout {
  padding-bottom: 4px;
}

.list-container.is-mobile-layout .plan-list-toolbar {
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
  padding: 16px;
  border-radius: 20px;
}

.list-container.is-mobile-layout .plan-list-toolbar__copy {
  width: 100%;
}

.list-container.is-mobile-layout .plan-list-toolbar__copy h3 {
  font-size: 16px;
  line-height: 1.4;
}

.list-container.is-mobile-layout .plan-list-toolbar__copy p {
  font-size: 12px;
  line-height: 1.6;
}

.list-container.is-mobile-layout .plan-list-toolbar__actions {
  width: 100%;
}

.list-container.is-mobile-layout .plan-list-toolbar__actions :deep(.el-button) {
  width: 100%;
  height: 44px;
  margin-left: 0;
}

.list-container.is-mobile-layout .plan-card-grid {
  gap: 12px;
  padding-bottom: 12px;
}

.list-container.is-mobile-layout .plan-card {
  padding: 16px;
  border-radius: 20px;
}

.list-container.is-mobile-layout .plan-card__header {
  margin-bottom: 14px;
}

.list-container.is-mobile-layout .plan-card__menu {
  width: 44px;
  height: 44px;
  margin-top: -10px;
  margin-right: -10px;
}

.list-container.is-mobile-layout .plan-card h4 {
  margin-bottom: 10px;
  font-size: 16px;
  line-height: 1.45;
}

.list-container.is-mobile-layout .plan-card .space-y-2 {
  margin-bottom: 16px;
}

.list-container.is-mobile-layout .plan-card .space-y-2 p {
  align-items: flex-start;
  font-size: 13px;
  line-height: 1.6;
}

.list-container.is-mobile-layout .plan-card__footer {
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
}

.list-container.is-mobile-layout .plan-card__status {
  flex-shrink: 0;
  max-width: 100%;
}

.list-container.is-mobile-layout .plan-card__action {
  min-width: 88px;
  height: 44px;
  margin-left: auto;
  padding-inline: 14px !important;
}

.list-container.is-mobile-layout .plan-list-pagination {
  margin-top: 12px;
  padding-bottom: 4px;
}

.list-container.is-mobile-layout .plan-list-pagination :deep(.el-pagination) {
  justify-content: center;
  row-gap: 8px;
}

.list-container.is-mobile-layout .plan-list-pagination :deep(button),
.list-container.is-mobile-layout .plan-list-pagination :deep(.el-pager li) {
  min-width: 44px;
  height: 44px;
  line-height: 44px;
}

.list-container.is-mobile-layout
  .plan-list-pagination
  :deep(.el-select__wrapper) {
  min-height: 44px;
}

.list-container.is-mobile-layout
  .plan-list-pagination
  :deep(.el-pagination__sizes) {
  margin-right: 0;
}

.list-container.is-mobile-layout .plan-progress-summary {
  padding: 14px;
  margin-bottom: 16px;
  border-radius: 16px;
}

.list-container.is-mobile-layout .plan-progress-content {
  min-height: 180px;
}

.list-container.is-mobile-layout .plan-progress-icon {
  width: 56px;
  height: 56px;
  margin-bottom: 12px;
}

.list-container.is-mobile-layout .plan-progress-title {
  font-size: 16px;
  line-height: 1.4;
}

.list-container.is-mobile-layout .plan-progress-bar {
  margin-top: 18px;
  margin-bottom: 0;
  padding-inline: 0 !important;
}

.list-container.is-mobile-layout .plan-progress-state h4 {
  font-size: 16px;
}

.list-container.is-mobile-layout .plan-progress-actions {
  flex-direction: column;
  gap: 10px;
}

.list-container.is-mobile-layout .plan-progress-button {
  width: 100%;
  height: 44px !important;
  margin-left: 0 !important;
}

.list-container.is-mobile-layout :deep(.rounded-dialog) {
  width: calc(100vw - 32px);
  max-width: 420px;
  max-height: calc(100dvh - 48px);
  margin: 0 auto;
  border-radius: 18px;
  align-self: center;
}

.list-container.is-mobile-layout :deep(.rounded-dialog .el-dialog__header) {
  padding: 18px 18px 10px;
}

.list-container.is-mobile-layout :deep(.rounded-dialog .el-dialog__body) {
  max-height: calc(100dvh - 160px);
  padding: 12px 16px 18px;
  overflow-y: auto;
}

@media screen and (max-width: 768px) {
  .list-container {
    padding-bottom: 4px;
  }

  .plan-list-toolbar {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 16px;
    padding: 16px;
    border-radius: 20px;
  }

  .plan-list-toolbar__copy {
    width: 100%;
  }

  .plan-list-toolbar__copy h3 {
    font-size: 16px;
    line-height: 1.4;
  }

  .plan-list-toolbar__copy p {
    font-size: 12px;
    line-height: 1.6;
  }

  .plan-list-toolbar__actions {
    width: 100%;
  }

  .plan-list-toolbar__actions :deep(.el-button) {
    width: 100%;
    height: 44px;
    margin-left: 0;
  }

  .plan-card-grid {
    gap: 12px;
    padding-bottom: 12px;
  }

  .plan-card {
    padding: 16px;
    border-radius: 20px;
  }

  .plan-card__header {
    margin-bottom: 14px;
  }

  .plan-card__menu {
    width: 44px;
    height: 44px;
    margin-top: -10px;
    margin-right: -10px;
  }

  .plan-card h4 {
    margin-bottom: 10px;
    font-size: 16px;
    line-height: 1.45;
  }

  .plan-card .space-y-2 {
    margin-bottom: 16px;
  }

  .plan-card .space-y-2 p {
    align-items: flex-start;
    font-size: 13px;
    line-height: 1.6;
  }

  .plan-card__footer {
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding-top: 12px;
  }

  .plan-card__status {
    flex-shrink: 0;
    max-width: 100%;
  }

  .plan-card__action {
    min-width: 88px;
    height: 44px;
    margin-left: auto;
    padding-inline: 14px !important;
  }

  .plan-list-pagination {
    margin-top: 12px;
    padding-bottom: 4px;
  }

  .plan-list-pagination :deep(.el-pagination) {
    justify-content: center;
    row-gap: 8px;
  }

  .plan-list-pagination :deep(button),
  .plan-list-pagination :deep(.el-pager li) {
    min-width: 44px;
    height: 44px;
    line-height: 44px;
  }

  .plan-list-pagination :deep(.el-select__wrapper) {
    min-height: 44px;
  }

  .plan-list-pagination :deep(.el-pagination__sizes) {
    margin-right: 0;
  }

  .plan-progress-summary {
    padding: 14px;
    margin-bottom: 16px;
    border-radius: 16px;
  }

  .plan-progress-content {
    min-height: 180px;
  }

  .plan-progress-icon {
    width: 56px;
    height: 56px;
    margin-bottom: 12px;
  }

  .plan-progress-title {
    font-size: 16px;
    line-height: 1.4;
  }

  .plan-progress-bar {
    margin-top: 18px;
    margin-bottom: 0;
    padding-inline: 0 !important;
  }

  .plan-progress-state h4 {
    font-size: 16px;
  }

  .plan-progress-actions {
    flex-direction: column;
    gap: 10px;
  }

  .plan-progress-button {
    width: 100%;
    height: 44px !important;
    margin-left: 0 !important;
  }

  :deep(.rounded-dialog) {
    width: calc(100vw - 32px);
    max-width: 420px;
    max-height: calc(100dvh - 48px);
    margin: 0 auto;
    border-radius: 18px;
    align-self: center;
  }

  :deep(.rounded-dialog .el-dialog__header) {
    padding: 18px 18px 10px;
  }

  :deep(.rounded-dialog .el-dialog__body) {
    max-height: calc(100dvh - 160px);
    padding: 12px 16px 18px;
    overflow-y: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .list-container {
    animation: none;
  }

  .plan-card,
  .plan-card :deep(*) {
    transition: none !important;
  }
}
</style>
