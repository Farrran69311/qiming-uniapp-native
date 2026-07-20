<template>
  <div
    :class="[
      'video-analysis-container h-[calc(100vh-140px)] m-3 flex gap-3 overflow-hidden font-sans',
      { 'is-mobile-layout': isMobileLayout }
    ]"
  >
    <!-- 左侧课程选择 -->
    <div
      class="sidebar-card w-80 bg-[var(--el-bg-color-overlay)] rounded-2xl shadow-sm border border-[var(--el-border-color-light)] flex flex-col shrink-0 overflow-hidden transition-all duration-300 hover:shadow-lg"
    >
      <div
        class="header-section p-6 border-b border-[var(--el-border-color-light)] bg-[var(--el-fill-color-light)]/30"
      >
        <h3 class="font-bold flex items-center text-xl !mb-0">
          <div
            class="icon-box w-12 h-12 bg-gradient-to-br from-[var(--el-color-primary)] to-[var(--el-color-primary-dark-2)] rounded-xl mr-3 shadow-lg flex items-center justify-center transition-transform duration-300"
          >
            <el-icon :size="28" color="#fff"><VideoCamera /></el-icon>
          </div>
          视频分析中心
        </h3>
        <p
          class="header-subtitle text-sm text-[var(--el-text-color-placeholder)] ml-[60px]"
        >
          AI 辅助视频转写、摘要与知识提取
        </p>
      </div>

      <div class="p-6 space-y-6 flex-1 overflow-auto custom-scrollbar">
        <div class="space-y-3">
          <label
            class="text-base font-semibold text-[var(--el-text-color-secondary)] flex items-center"
          >
            <el-icon class="mr-2 text-[var(--el-color-primary)]"
              ><Reading
            /></el-icon>
            目标课程
          </label>
          <el-select
            v-model="selectedCourseId"
            filterable
            remote
            clearable
            placeholder="搜索或选择课程..."
            :remote-method="searchCourses"
            :loading="courseLoading"
            class="w-full !rounded-xl"
            size="large"
            @change="handleCourseChange"
          >
            <el-option
              v-for="c in courseOptions"
              :key="c.courseId"
              :label="c.title"
              :value="c.courseId"
            />
          </el-select>
        </div>

        <div class="space-y-3">
          <label
            class="text-base font-semibold text-[var(--el-text-color-secondary)] flex items-center"
          >
            <el-icon class="mr-2 text-[var(--el-color-primary)]"
              ><Management
            /></el-icon>
            对应章节
          </label>
          <el-select
            v-model="selectedChapterId"
            :disabled="!selectedCourseId"
            placeholder="请选择课程内的章节..."
            clearable
            filterable
            class="w-full !rounded-xl"
            size="large"
            @change="handleChapterChange"
          >
            <el-option
              v-for="ch in chapterOptions"
              :key="ch.chapterId"
              :label="ch.name"
              :value="ch.chapterId"
            />
          </el-select>
        </div>

        <!-- 任务看板 -->
        <div class="mt-8">
          <div class="flex items-center justify-between mb-4">
            <span
              class="text-base font-semibold text-[var(--el-text-color-primary)]"
              >任务看板</span
            >
            <el-icon
              class="text-[var(--el-text-color-placeholder)] transition-transform duration-300 hover:rotate-180 cursor-pointer"
              @click="loadTaskList"
              ><DataAnalysis
            /></el-icon>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div
              class="stat-card bg-[var(--el-color-primary-light-9)] rounded-2xl p-4 text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-md cursor-default"
            >
              <div
                class="text-2xl font-black text-[var(--el-color-success)] leading-none mb-2"
              >
                {{ stats.completed }}
              </div>
              <div
                class="text-xs font-medium text-[var(--el-text-color-secondary)] tracking-wider"
              >
                已完成
              </div>
            </div>
            <div
              class="stat-card bg-[var(--el-color-primary-light-9)] rounded-2xl p-4 text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-md cursor-default"
            >
              <div
                class="text-2xl font-black text-[var(--el-color-warning)] leading-none mb-2"
              >
                {{ stats.processing }}
              </div>
              <div
                class="text-xs font-medium text-[var(--el-text-color-secondary)] tracking-wider"
              >
                处理中
              </div>
            </div>
            <div
              class="stat-card bg-[var(--el-color-primary-light-9)] rounded-2xl p-4 text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-md cursor-default"
            >
              <div
                class="text-2xl font-black text-[var(--el-color-danger)] leading-none mb-2"
              >
                {{ stats.failed }}
              </div>
              <div
                class="text-xs font-medium text-[var(--el-text-color-secondary)] tracking-wider"
              >
                失败
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧内容区域 -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- 合并后的内容卡片 -->
      <div
        class="flex-1 bg-[var(--el-bg-color-overlay)] rounded-2xl shadow-sm border border-[var(--el-border-color-light)] overflow-hidden flex flex-col"
      >
        <!-- 顶部操作栏（内嵌在卡片顶部） -->
        <div
          class="px-6 py-4 border-b border-[var(--el-border-color-lighter)] flex justify-between items-center bg-[var(--el-fill-color-light)]/30 flex-shrink-0"
        >
          <div class="flex items-center space-x-4">
            <span
              v-if="polling"
              class="flex items-center text-[var(--el-color-primary)] text-sm font-semibold px-4 py-2 bg-[var(--el-color-primary-light-9)] rounded-xl"
            >
              <el-icon class="mr-2 animate-spin"><Loading /></el-icon>
              自动刷新中...
            </span>
            <span
              v-else
              class="text-[var(--el-text-color-secondary)] text-sm font-medium"
            >
              共 {{ taskList.length }} 个任务
            </span>
          </div>

          <div class="flex gap-2">
            <el-button
              :icon="RefreshRight"
              class="!rounded-xl !h-10 !px-4"
              @click="loadTaskList"
            >
              刷新
            </el-button>
            <el-button
              type="primary"
              :disabled="!canSubmit"
              :loading="submitLoading"
              class="!rounded-xl !h-10 !px-6 !font-bold shadow-md"
              @click="showSubmitDialog"
            >
              <el-icon class="mr-1"><VideoCamera /></el-icon>
              提交视频分析
            </el-button>
          </div>
        </div>

        <!-- 内容体 -->
        <div class="flex-1 p-6 overflow-hidden flex flex-col">
          <!-- 空状态：未选择课程 -->
          <div
            v-if="!selectedCourseId"
            class="flex-1 flex flex-col items-center justify-center relative"
          >
            <div
              class="absolute top-[15%] left-[20%] w-28 h-28 bg-purple-200/30 dark:bg-purple-800/20 rounded-full filter blur-2xl pointer-events-none"
            />
            <div
              class="absolute bottom-[20%] right-[15%] w-36 h-36 bg-teal-200/30 dark:bg-teal-800/20 rounded-full filter blur-2xl pointer-events-none"
            />
            <div class="text-center relative z-10">
              <div class="lottie-glass mx-auto mb-8">
                <lottie-animation
                  :animation-data="EdenAnim"
                  :width="200"
                  :height="200"
                />
              </div>
              <h3
                class="text-2xl font-black text-[var(--el-text-color-primary)] mb-3"
              >
                选择课程开始分析
              </h3>
              <p
                class="text-base text-[var(--el-text-color-secondary)] max-w-sm mx-auto leading-relaxed mb-8"
              >
                从左侧选择目标课程，即可查看和管理视频分析任务
              </p>
            </div>
          </div>

          <!-- 有课程时显示表格 -->
          <div
            v-else
            class="task-table-scroll flex-1 overflow-auto custom-scrollbar"
            role="region"
            aria-label="视频分析任务表格"
            tabindex="0"
          >
            <el-table
              :data="taskList"
              style="width: 100%"
              height="100%"
              class="task-table"
              :header-cell-class-name="
                isCompactLayout
                  ? '!bg-[var(--el-fill-color-light)] !text-[var(--el-text-color-primary)] !font-bold !text-sm !py-2.5'
                  : '!bg-[var(--el-fill-color-light)] !text-[var(--el-text-color-primary)] !font-bold !text-base !py-4'
              "
            >
              <el-table-column label="文件名" prop="fileName" min-width="200">
                <template #default="{ row }">
                  <div class="flex items-center">
                    <el-icon class="mr-2 text-[var(--el-color-primary)]"
                      ><VideoPlay
                    /></el-icon>
                    <span class="truncate">{{ row.fileName || "-" }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column
                label="课时 ID"
                prop="hourId"
                width="110"
                align="center"
              >
                <template #default="{ row }">
                  {{ row.hourId || "历史任务" }}
                </template>
              </el-table-column>
              <el-table-column
                label="状态"
                prop="status"
                width="120"
                align="left"
              >
                <template #default="{ row }">
                  <el-tag
                    :type="statusTagType(row.status)"
                    effect="light"
                    round
                    size="default"
                  >
                    {{ statusLabel(row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column
                label="进度"
                prop="progress"
                width="100"
                align="center"
              >
                <template #default="{ row }">
                  <el-progress
                    v-if="['submitted', 'processing'].includes(row.status)"
                    :percentage="row.progress || 0"
                    :stroke-width="6"
                    :show-text="false"
                  />
                  <span v-else>{{ row.progress ?? 0 }}%</span>
                </template>
              </el-table-column>
              <el-table-column
                label="提交时间"
                prop="createdAt"
                min-width="200"
              />
              <el-table-column
                label="完成时间"
                prop="completedAt"
                min-width="200"
              >
                <template #default="{ row }">
                  {{ row.completedAt || "-" }}
                </template>
              </el-table-column>
              <el-table-column
                label="操作"
                width="160"
                align="center"
                :fixed="isMobileLayout ? false : 'right'"
              >
                <template #default="{ row }">
                  <el-button
                    type="primary"
                    link
                    size="small"
                    @click="viewDetail(row)"
                  >
                    查看详情
                  </el-button>
                  <el-button
                    v-if="
                      ['submitted', 'processing', 'pending'].includes(
                        row.status
                      )
                    "
                    type="primary"
                    link
                    size="small"
                    @click="refreshTask(row)"
                  >
                    刷新
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </div>
    </div>

    <!-- 提交视频分析对话框 -->
    <el-dialog
      v-model="submitDialogVisible"
      title="提交视频分析任务"
      width="min(520px, calc(100vw - 24px))"
      :close-on-click-modal="false"
    >
      <el-form
        ref="submitFormRef"
        :model="submitForm"
        :rules="submitRules"
        label-width="90px"
      >
        <el-form-item label="课程" prop="courseId">
          <el-select
            v-model="submitForm.courseId"
            filterable
            remote
            placeholder="搜索课程..."
            :remote-method="searchCourses"
            :loading="courseLoading"
            class="w-full"
            @change="handleSubmitCourseChange"
          >
            <el-option
              v-for="c in courseOptions"
              :key="c.courseId"
              :label="c.title"
              :value="c.courseId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="章节">
          <el-select
            v-model="submitForm.chapterId"
            :disabled="!submitForm.courseId"
            placeholder="请选择章节（可选）"
            clearable
            filterable
            class="w-full"
            @change="handleSubmitChapterChange"
          >
            <el-option
              v-for="ch in submitChapterOptions"
              :key="ch.chapterId"
              :label="ch.name"
              :value="ch.chapterId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="视频课时" prop="hourId">
          <el-select
            v-model="submitForm.hourId"
            :disabled="!submitForm.courseId"
            placeholder="请选择视频课时"
            filterable
            class="w-full"
            @change="handleVideoSelect"
          >
            <el-option
              v-for="h in videoHourOptions"
              :key="`${h.chapterId}:${h.hourId}`"
              :label="h.title"
              :value="h.hourId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="文件名">
          <el-input
            v-model="submitForm.fileName"
            placeholder="自动填充，可修改"
            clearable
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="submitDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="onSubmit">
          提交任务
        </el-button>
      </template>
    </el-dialog>

    <!-- 任务详情对话框 -->
    <el-dialog
      v-model="detailDialogVisible"
      title="视频分析结果"
      width="80%"
      top="5vh"
      :close-on-click-modal="false"
    >
      <div v-if="detailLoading" class="flex justify-center py-12">
        <el-icon class="animate-spin text-4xl text-[var(--el-color-primary)]"
          ><Loading
        /></el-icon>
      </div>
      <div v-else-if="taskDetail" class="space-y-6">
        <!-- 基本信息 -->
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-[var(--el-text-color-secondary)]">任务ID：</span>
            <span class="font-mono">{{ taskDetail.taskId }}</span>
          </div>
          <div>
            <span class="text-[var(--el-text-color-secondary)]">状态：</span>
            <el-tag
              :type="statusTagType(taskDetail.status)"
              effect="light"
              round
            >
              {{ statusLabel(taskDetail.status) }}
            </el-tag>
          </div>
          <div>
            <span class="text-[var(--el-text-color-secondary)]">文件名：</span>
            {{ taskDetail.fileName }}
          </div>
          <div>
            <span class="text-[var(--el-text-color-secondary)]">进度：</span>
            {{ taskDetail.progress }}%
          </div>
          <div>
            <span class="text-[var(--el-text-color-secondary)]"
              >提交时间：</span
            >
            {{ taskDetail.createdAt }}
          </div>
          <div>
            <span class="text-[var(--el-text-color-secondary)]"
              >完成时间：</span
            >
            {{ taskDetail.completedAt || "-" }}
          </div>
        </div>

        <!-- 分析结果 tabs -->
        <el-tabs
          v-if="taskDetail.status === 'completed'"
          v-model="activeTab"
          type="border-card"
        >
          <el-tab-pane label="摘要" name="summary">
            <div class="whitespace-pre-wrap leading-relaxed p-4">
              {{ taskDetail.summary || "暂无摘要" }}
            </div>
          </el-tab-pane>
          <el-tab-pane label="语音转写" name="transcription">
            <div
              class="whitespace-pre-wrap leading-relaxed p-4 max-h-96 overflow-auto"
            >
              {{ taskDetail.transcriptionText || "暂无转写内容" }}
            </div>
          </el-tab-pane>
          <el-tab-pane label="章节速览" name="chapters">
            <div v-if="parsedChapters.length" class="space-y-3 p-4">
              <div
                v-for="(ch, i) in parsedChapters"
                :key="i"
                class="p-4 bg-[var(--el-fill-color-light)] rounded-lg"
              >
                <h4 class="font-semibold mb-1">{{ ch.title }}</h4>
                <p class="text-sm text-[var(--el-text-color-secondary)]">
                  {{ ch.summary }}
                </p>
              </div>
            </div>
            <div v-else class="p-4 text-[var(--el-text-color-placeholder)]">
              暂无章节数据
            </div>
          </el-tab-pane>
          <el-tab-pane label="问答回顾" name="qa">
            <div v-if="parsedQA.length" class="space-y-3 p-4">
              <div
                v-for="(item, i) in parsedQA"
                :key="i"
                class="p-4 bg-[var(--el-fill-color-light)] rounded-lg"
              >
                <h4 class="font-semibold mb-1 text-[var(--el-color-primary)]">
                  Q: {{ item.question }}
                </h4>
                <p class="text-sm">A: {{ item.answer }}</p>
              </div>
            </div>
            <div v-else class="p-4 text-[var(--el-text-color-placeholder)]">
              暂无问答数据
            </div>
          </el-tab-pane>
          <el-tab-pane label="思维导图" name="mindmap">
            <MindMapPreview :source="taskDetail.mindMapUrl" />
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from "vue";
import {
  VideoCamera,
  VideoPlay,
  Reading,
  Management,
  DataAnalysis,
  Loading,
  RefreshRight
} from "@element-plus/icons-vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import {
  submitVideoAnalysis,
  getVideoAnalysisList,
  getVideoAnalysisStatus,
  type VideoAnalysisTask,
  type VideoAnalysisStatusResult
} from "@/api/videoAnalysis";
import { getCourseList, getCourseHoursList } from "@/api/course";
import { useAppStoreHook } from "@/store/modules/app";
import LottieAnimation from "@/components/LottieAnimation.vue";
import EdenAnim from "@/assets/eden.json";
import MindMapPreview from "./MindMapPreview.vue";

defineOptions({ name: "VideoAnalysis" });

const appStore = useAppStoreHook();
const isMobileLayout = computed(() => appStore.getDevice === "mobile");
const isCompactLayout = ref(false);

const updateCompactLayout = () => {
  if (typeof window === "undefined") return;
  isCompactLayout.value = window.innerWidth <= 1120 && !isMobileLayout.value;
};

// ========== 课程/章节选择 ==========
const selectedCourseId = ref<number>();
const selectedChapterId = ref<number>();
const courseLoading = ref(false);
const courseOptions = ref<Array<{ courseId: number; title: string }>>([]);
const chapterOptions = ref<Array<{ chapterId: number; name: string }>>([]);

const searchCourses = async (query: string) => {
  courseLoading.value = true;
  try {
    const { data } = await getCourseList({
      pageNum: 1,
      pageSize: 50,
      courseName: query || undefined
    });
    courseOptions.value = data?.courseList || [];
  } catch {
    courseOptions.value = [];
    ElMessage.error("课程加载失败，请检查网络或重新登录");
  } finally {
    courseLoading.value = false;
  }
};

const loadChapters = async (courseId: number) => {
  try {
    const { data } = await getCourseHoursList({ courseId });
    chapterOptions.value = (data?.courseChapters || []).map(ch => ({
      chapterId: ch.chapterId,
      name: ch.name
    }));
  } catch {
    chapterOptions.value = [];
  }
};

const handleCourseChange = (val: number) => {
  selectedChapterId.value = undefined;
  chapterOptions.value = [];
  if (val) {
    loadChapters(val);
    loadTaskList();
  } else {
    taskList.value = [];
  }
};

const handleChapterChange = () => {
  loadTaskList();
};

// ========== 任务列表 ==========
const taskList = ref<VideoAnalysisTask[]>([]);
const polling = ref(false);
let pollTimer: ReturnType<typeof setInterval> | null = null;

const stats = computed(() => {
  const list = taskList.value;
  return {
    completed: list.filter(t => t.status === "completed").length,
    processing: list.filter(t =>
      ["pending", "submitted", "processing"].includes(t.status)
    ).length,
    failed: list.filter(t => t.status === "failed").length
  };
});

const loadTaskList = async () => {
  if (!selectedCourseId.value) return;
  try {
    const { data } = await getVideoAnalysisList({
      courseId: selectedCourseId.value,
      chapterId: selectedChapterId.value || undefined
    });
    taskList.value = data?.tasks || [];
    // 如果有进行中的任务，启动轮询
    if (stats.value.processing > 0) {
      startPolling();
    } else {
      stopPolling();
    }
  } catch {
    taskList.value = [];
  }
};

const startPolling = () => {
  if (pollTimer) return;
  polling.value = true;
  pollTimer = setInterval(loadTaskList, 10000);
};

const stopPolling = () => {
  polling.value = false;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

// ========== 提交任务 ==========
const submitDialogVisible = ref(false);
const submitLoading = ref(false);
const submitFormRef = ref<FormInstance>();
const submitChapterOptions = ref<Array<{ chapterId: number; name: string }>>(
  []
);
const videoHourOptions = ref<
  Array<{
    title: string;
    fileUrl: string;
    rType: string;
    chapterId: number;
    hourId: number;
  }>
>([]);
const allHoursData = ref<
  Array<{
    chapterId: number;
    name: string;
    hourList: Array<{
      title: string;
      fileUrl: string;
      rType: string;
      resourceId: number;
      duration: number;
      hourId: number;
    }>;
  }>
>([]);

const submitForm = reactive({
  courseId: undefined as number | undefined,
  chapterId: undefined as number | undefined,
  hourId: undefined as number | undefined,
  filePath: "",
  fileName: ""
});

const submitRules: FormRules = {
  courseId: [{ required: true, message: "请选择课程", trigger: "change" }],
  hourId: [{ required: true, message: "请选择视频课时", trigger: "change" }]
};

const canSubmit = computed(() => !!selectedCourseId.value);

const showSubmitDialog = () => {
  submitForm.courseId = selectedCourseId.value;
  submitForm.chapterId = selectedChapterId.value;
  submitForm.hourId = undefined;
  submitForm.filePath = "";
  submitForm.fileName = "";
  submitDialogVisible.value = true;
  if (submitForm.courseId) {
    loadSubmitChapters(submitForm.courseId);
  }
};

const loadSubmitChapters = async (courseId: number) => {
  try {
    const { data } = await getCourseHoursList({ courseId });
    const chapters = data?.courseChapters || [];
    allHoursData.value = chapters;
    submitChapterOptions.value = chapters.map(ch => ({
      chapterId: ch.chapterId,
      name: ch.name
    }));
    updateVideoOptions();
  } catch {
    submitChapterOptions.value = [];
    allHoursData.value = [];
    videoHourOptions.value = [];
  }
};

const handleSubmitCourseChange = (val: number) => {
  submitForm.chapterId = undefined;
  submitForm.hourId = undefined;
  submitForm.filePath = "";
  submitForm.fileName = "";
  submitChapterOptions.value = [];
  videoHourOptions.value = [];
  if (val) {
    loadSubmitChapters(val);
  }
};

const handleSubmitChapterChange = () => {
  submitForm.hourId = undefined;
  submitForm.filePath = "";
  submitForm.fileName = "";
  updateVideoOptions();
};

const updateVideoOptions = () => {
  let hours: Array<{
    title: string;
    fileUrl: string;
    rType: string;
    chapterId: number;
    hourId: number;
  }> = [];
  const chapters = allHoursData.value;
  if (submitForm.chapterId) {
    const ch = chapters.find(c => c.chapterId === submitForm.chapterId);
    if (ch) {
      hours = ch.hourList
        .filter(h => h.rType === "VIDEO" && h.hourId > 0)
        .map(h => ({
          title: h.title,
          fileUrl: h.fileUrl,
          rType: h.rType,
          chapterId: ch.chapterId,
          hourId: h.hourId
        }));
    }
  } else {
    hours = chapters.flatMap(ch =>
      ch.hourList
        .filter(h => h.rType === "VIDEO" && h.hourId > 0)
        .map(h => ({
          title: `[${ch.name}] ${h.title}`,
          fileUrl: h.fileUrl,
          rType: h.rType,
          chapterId: ch.chapterId,
          hourId: h.hourId
        }))
    );
  }
  videoHourOptions.value = hours;
};

const handleVideoSelect = (hourId: number) => {
  const hour = videoHourOptions.value.find(h => h.hourId === hourId);
  if (hour) {
    submitForm.chapterId = hour.chapterId;
    submitForm.filePath = hour.fileUrl;
    submitForm.fileName = hour.title;
  }
};

/** 从完整 URL 中提取 OSS 对象键（去掉协议+域名前缀） */
const extractObjectKey = (url: string): string => {
  try {
    const u = new URL(url);
    // 去掉开头的 '/'
    return u.pathname.replace(/^\//, "");
  } catch {
    // 如果本身就不是完整 URL，直接返回
    return url;
  }
};

const onSubmit = async () => {
  if (!submitFormRef.value) return;
  await submitFormRef.value.validate();
  submitLoading.value = true;
  try {
    const { code, msg } = await submitVideoAnalysis({
      courseId: submitForm.courseId!,
      chapterId: submitForm.chapterId,
      hourId: submitForm.hourId,
      filePath: extractObjectKey(submitForm.filePath),
      fileName: submitForm.fileName || undefined
    });
    if (code === 200) {
      ElMessage.success("视频分析任务已提交");
      submitDialogVisible.value = false;
      // 同步左侧选择并刷新列表
      selectedCourseId.value = submitForm.courseId;
      selectedChapterId.value = submitForm.chapterId;
      if (submitForm.courseId) {
        loadChapters(submitForm.courseId);
      }
      loadTaskList();
    } else {
      ElMessage.error(msg || "提交失败");
    }
  } catch (e: any) {
    ElMessage.error(e?.message || "提交失败");
  } finally {
    submitLoading.value = false;
  }
};

// ========== 任务详情 ==========
const detailDialogVisible = ref(false);
const detailLoading = ref(false);
const taskDetail = ref<VideoAnalysisStatusResult | null>(null);
const activeTab = ref("summary");

const parsedChapters = computed(() => {
  if (!taskDetail.value?.chaptersJson) return [];
  try {
    return JSON.parse(taskDetail.value.chaptersJson);
  } catch {
    return [];
  }
});

const parsedQA = computed(() => {
  if (!taskDetail.value?.qaJson) return [];
  try {
    return JSON.parse(taskDetail.value.qaJson);
  } catch {
    return [];
  }
});

const viewDetail = async (row: VideoAnalysisTask) => {
  detailDialogVisible.value = true;
  detailLoading.value = true;
  activeTab.value = "summary";
  try {
    const { data } = await getVideoAnalysisStatus({ taskId: row.taskId });
    taskDetail.value = data;
  } catch {
    taskDetail.value = null;
    ElMessage.error("获取任务详情失败");
  } finally {
    detailLoading.value = false;
  }
};

const refreshTask = async (row: VideoAnalysisTask) => {
  try {
    const { data } = await getVideoAnalysisStatus({ taskId: row.taskId });
    if (data) {
      const idx = taskList.value.findIndex(t => t.taskId === row.taskId);
      if (idx !== -1) {
        taskList.value[idx] = {
          ...taskList.value[idx],
          status: data.status,
          progress: data.progress,
          completedAt: data.completedAt
        };
      }
    }
  } catch {
    ElMessage.error("刷新任务状态失败");
  }
};

// ========== 状态辅助 ==========
const statusTagType = (status: string) => {
  const map: Record<string, string> = {
    completed: "success",
    processing: "warning",
    submitted: "warning",
    pending: "info",
    failed: "danger",
    cancelled: "info"
  };
  return (map[status] || "info") as any;
};

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    pending: "等待中",
    submitted: "已提交",
    processing: "处理中",
    completed: "已完成",
    failed: "失败",
    cancelled: "已取消"
  };
  return map[status] || status;
};

// ========== 生命周期 ==========
onMounted(() => {
  updateCompactLayout();
  window.addEventListener("resize", updateCompactLayout);
  searchCourses("");
});

onUnmounted(() => {
  window.removeEventListener("resize", updateCompactLayout);
  stopPolling();
});
</script>

<style lang="scss" scoped>
// 表格美化
.task-table {
  :deep(.el-table__inner-wrapper) {
    overflow: hidden;
    border-radius: 12px;
  }

  :deep(.el-table__header-wrapper) {
    th {
      padding: 14px 0;
      font-size: 14px;
      font-weight: 600;
      border-bottom: none !important;
    }
  }

  :deep(.el-table__body-wrapper) {
    tr {
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

      td {
        padding: 12px 0;
        border-bottom: 1px solid var(--el-border-color-lighter) !important;
      }

      &:last-child td {
        border-bottom: none !important;
      }

      &:hover {
        position: relative;
        z-index: 1;
        box-shadow: 0 4px 12px rgb(0 0 0 / 8%);
        transform: scale(1.005);
      }
    }
  }
}

.task-table-scroll {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-gutter: stable;
}

// 侧边栏卡片动效
.sidebar-card {
  .header-section:hover .icon-box {
    transform: rotate(-5deg) scale(1.05);
  }

  .header-subtitle {
    margin-top: 8px !important;
  }
}

// 输入框聚焦动效
:deep(.el-select),
:deep(.el-input) {
  .el-input__wrapper {
    transition: all 0.25s ease;

    &:hover {
      box-shadow: 0 0 0 1px var(--el-color-primary-light-5) inset;
    }

    &.is-focus {
      box-shadow:
        0 0 0 1px var(--el-color-primary) inset,
        0 4px 12px var(--el-color-primary-light-8);
      transform: translateY(-1px);
    }
  }
}

// 自定义滚动条
.custom-scrollbar {
  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--el-border-color);
    border-radius: 3px;
    transition: background 0.2s ease;

    &:hover {
      background: var(--el-border-color-darker);
    }
  }
}

// Lottie 毛玻璃光效容器
.lottie-glass {
  position: relative;
  width: 240px;
  height: 240px;
  border-radius: 2rem;
  background: rgb(255 255 255 / 45%);
  backdrop-filter: blur(20px) saturate(1.6);
  box-shadow:
    0 8px 32px rgba(var(--el-color-primary-rgb), 0.12),
    inset 0 0 0 1px rgb(255 255 255 / 40%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;

  // 将 Lottie 动画色相旋转到平台主色蓝
  :deep(div) {
    filter: hue-rotate(160deg) saturate(0.85) brightness(0.88);
  }

  &::before {
    content: "";
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    padding: 1.5px;
    background: linear-gradient(
      135deg,
      rgba(var(--el-color-primary-rgb), 0.5),
      transparent 40%,
      transparent 60%,
      rgba(var(--el-color-primary-rgb), 0.35)
    );
    mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
  }

  &::after {
    content: "";
    position: absolute;
    top: -30%;
    left: 10%;
    width: 80%;
    height: 60%;
    background: radial-gradient(
      ellipse,
      rgb(255 255 255 / 30%) 0%,
      transparent 70%
    );
    border-radius: 50%;
    pointer-events: none;
  }

  &:hover {
    transform: scale(1.04);
    box-shadow:
      0 12px 40px rgba(var(--el-color-primary-rgb), 0.18),
      inset 0 0 0 1px rgb(255 255 255 / 50%);
  }

  html.dark & {
    background: rgb(30 30 40 / 50%);
    box-shadow:
      0 8px 32px rgba(var(--el-color-primary-rgb), 0.15),
      inset 0 0 0 1px rgb(255 255 255 / 8%);

    &::before {
      background: linear-gradient(
        135deg,
        rgba(var(--el-color-primary-rgb), 0.35),
        transparent 40%,
        transparent 60%,
        rgba(var(--el-color-primary-rgb), 0.25)
      );
    }

    &::after {
      background: radial-gradient(
        ellipse,
        rgb(255 255 255 / 8%) 0%,
        transparent 70%
      );
    }

    &:hover {
      box-shadow:
        0 12px 40px rgba(var(--el-color-primary-rgb), 0.22),
        inset 0 0 0 1px rgb(255 255 255 / 12%);
    }
  }
}

.video-analysis-container.is-mobile-layout {
  height: auto !important;
  min-height: calc(100vh - 140px);
  margin: 0;
  gap: 12px;
  overflow: visible;
  flex-direction: column;
  padding: 12px;
}

.video-analysis-container.is-mobile-layout .sidebar-card,
.video-analysis-container.is-mobile-layout > .flex-1 {
  width: 100% !important;
  min-width: 0;
}

.video-analysis-container.is-mobile-layout .sidebar-card {
  max-height: 48vh;
}

.video-analysis-container.is-mobile-layout .sidebar-card .header-section,
.video-analysis-container.is-mobile-layout .flex-1 > .flex-1 > div:first-child {
  padding: 16px;
}

.video-analysis-container.is-mobile-layout .sidebar-card .header-subtitle {
  margin-left: 0;
}

.video-analysis-container.is-mobile-layout .flex-1 > .flex-1 > div:first-child {
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
}

.video-analysis-container.is-mobile-layout .flex-1 > .flex-1 .p-6 {
  padding: 16px;
}

.video-analysis-container.is-mobile-layout :deep(.task-table) {
  min-width: 720px;
}

.video-analysis-container.is-mobile-layout .task-table-scroll {
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.video-analysis-container.is-mobile-layout :deep(.task-table .el-button) {
  min-height: 44px;
  padding-right: 12px;
  padding-left: 12px;
}
</style>
