<template>
  <div class="virtual-lab" :class="{ 'virtual-lab--mobile': isMobile }">
    <el-card shadow="never" class="lab-panel filter-panel mb-4">
      <div class="flex justify-between items-center mb-4">
        <span class="font-bold text-base">筛选与同步</span>
        <el-button
          type="success"
          :loading="syncLoading"
          @click="handleForceSync"
        >
          <el-icon class="mr-1"><Refresh /></el-icon>
          强制同步
        </el-button>
      </div>

      <el-form :model="searchForm" label-position="top" class="lab-search-form">
        <div class="lab-search-form__grid">
          <el-form-item label="选择课程">
            <el-select
              v-model="searchForm.courseId"
              placeholder="请选择课程"
              filterable
              clearable
              class="lab-search-form__control"
              @change="handleCourseChange"
            >
              <el-option
                v-for="course in courseList"
                :key="course.courseId"
                :label="course.title"
                :value="course.courseId"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="选择章节">
            <el-select
              v-model="searchForm.chapterId"
              placeholder="请选择章节"
              filterable
              clearable
              :disabled="!searchForm.courseId"
              class="lab-search-form__control"
              @change="handleChapterChange"
            >
              <el-option
                v-for="chapter in chapterList"
                :key="chapter.chapterId"
                :label="chapter.name"
                :value="chapter.chapterId"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="生成范围">
            <el-radio-group
              v-model="searchForm.scopeType"
              class="lab-scope-segmented"
              @change="handleScopeChange"
            >
              <el-radio-button value="chapter">整章</el-radio-button>
              <el-radio-button value="hour">单课时</el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item v-if="searchForm.scopeType === 'hour'" label="选择课时">
            <el-select
              v-model="searchForm.hourId"
              placeholder="请选择课时"
              filterable
              clearable
              :disabled="!searchForm.chapterId"
              class="lab-search-form__control"
              @change="handleSearch"
            >
              <el-option
                v-for="hour in hourList"
                :key="hour.hourId"
                :label="hour.title"
                :value="hour.hourId"
              />
            </el-select>
          </el-form-item>
        </div>

        <div class="mt-4 flex gap-2">
          <el-button
            type="primary"
            :disabled="!hasSelection"
            @click="handleSearch"
          >
            查询任务
          </el-button>
          <el-button @click="resetSearch">重置筛选</el-button>
        </div>
      </el-form>
    </el-card>

    <el-card v-if="hasSelection" shadow="never" class="lab-panel focus-panel">
      <div class="flex justify-between items-center mb-4">
        <span class="font-bold text-base"
          >当前范围：{{ currentScopeTitle }} ({{
            selectedCourseTitle || "已选择课程"
          }})</span
        >
        <div class="text-sm">
          <span>展示版本：</span>
          <strong class="text-primary">{{ currentDisplayVersionText }}</strong>
        </div>
      </div>

      <div class="focus-grid">
        <div class="focus-card">
          <span class="focus-card__label">课程 ID</span>
          <strong class="focus-card__value">
            {{ currentAnimationData?.courseId ?? searchForm.courseId }}
          </strong>
        </div>
        <div class="focus-card">
          <span class="focus-card__label">章节 ID</span>
          <strong class="focus-card__value">
            {{ currentAnimationData?.chapterId ?? searchForm.chapterId }}
          </strong>
        </div>
        <div class="focus-card">
          <span class="focus-card__label">范围</span>
          <strong class="focus-card__value focus-card__value--compact">
            {{
              searchForm.scopeType === "hour"
                ? `课时 ${searchForm.hourId}`
                : "整章"
            }}
          </strong>
        </div>
        <div class="focus-card focus-card--wide">
          <span class="focus-card__label">任务概览</span>
          <strong class="focus-card__value focus-card__value--compact">
            {{ taskSummaryText }}
          </strong>
        </div>
      </div>

      <el-alert
        :title="readinessTitle"
        :description="readinessDescription"
        :type="readinessType"
        :closable="false"
        show-icon
        class="scope-readiness"
        aria-live="polite"
      />

      <div class="focus-actions">
        <el-button
          type="primary"
          :loading="generateLoading"
          :disabled="!canGenerate"
          @click="handleGenerate"
        >
          <el-icon class="mr-1"><VideoPlay /></el-icon>
          生成新版本
        </el-button>
        <el-button
          type="warning"
          plain
          :disabled="completedTasks.length === 0"
          @click="showSetVersionDialog = true"
        >
          <el-icon class="mr-1"><Setting /></el-icon>
          设置展示版本
        </el-button>
      </div>

      <p v-if="completedTasks.length === 0" class="focus-panel__note">
        当前还没有已完成版本，生成成功后即可切换展示内容。
      </p>
    </el-card>

    <el-card
      v-loading="loading && hasSelection"
      shadow="never"
      class="lab-panel task-panel"
    >
      <div class="flex justify-between items-center mb-4">
        <span class="font-bold text-base">HTML 动画任务列表</span>

        <div v-if="hasSelection" class="task-panel__summary">
          <span class="summary-chip">已完成 {{ stats.completedTasks }}</span>
          <span class="summary-chip">进行中 {{ stats.processingTasks }}</span>
          <span v-if="stats.failedTasks > 0" class="summary-chip is-danger">
            失败 {{ stats.failedTasks }}
          </span>
        </div>
      </div>

      <el-empty v-if="!hasSelection" description="请先选择课程和章节" />

      <el-empty
        v-else-if="!loading && taskList.length === 0"
        description="当前章节还没有生成记录"
      />

      <div v-else class="task-grid">
        <article
          v-for="row in taskList"
          :key="row.taskId"
          class="task-card"
          :class="{ 'is-display': isDisplayVersion(row) }"
        >
          <div class="task-card__header">
            <div class="task-card__header-main">
              <span class="task-card__section-title">版本状态</span>
              <div class="task-card__tag-group">
                <el-tag
                  v-if="row.version > 0"
                  :type="isDisplayVersion(row) ? 'success' : 'info'"
                  effect="light"
                  round
                >
                  v{{ row.version }}
                </el-tag>
                <el-tag v-else type="warning" effect="light" round>
                  待分配版本
                </el-tag>
                <el-tag
                  v-if="isDisplayVersion(row)"
                  type="success"
                  effect="dark"
                  round
                >
                  当前展示
                </el-tag>
              </div>
            </div>

            <el-tag :type="getStatusTagType(row.status)" effect="light" round>
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </div>

          <div class="task-card__body">
            <div class="task-cover">
              <img
                v-if="row.coverUrl"
                :src="row.coverUrl"
                alt="HTML 动画快照封面"
              />
              <div v-else class="task-cover__empty">暂无快照封面</div>
            </div>

            <div class="task-field task-field--full">
              <span class="task-field__label">任务 ID</span>
              <span class="task-id">{{ row.taskId }}</span>
            </div>

            <div class="task-field task-field--full">
              <span class="task-field__label">文件名</span>
              <span class="task-field__value">{{ row.fileName || "-" }}</span>
            </div>

            <div v-if="row.coverObject" class="task-field task-field--full">
              <span class="task-field__label">封面对象</span>
              <span class="task-field__value">{{ row.coverObject }}</span>
            </div>

            <div class="task-meta-grid">
              <div class="task-field">
                <span class="task-field__label">文件大小</span>
                <span class="task-field__value">
                  {{ row.fileSize > 0 ? formatFileSize(row.fileSize) : "-" }}
                </span>
              </div>
              <div class="task-field">
                <span class="task-field__label">创建时间</span>
                <span class="task-field__value">{{
                  row.createdAt || "-"
                }}</span>
              </div>
              <div class="task-field">
                <span class="task-field__label">更新时间</span>
                <span class="task-field__value">{{
                  row.updatedAt || "-"
                }}</span>
              </div>
              <div class="task-field">
                <span class="task-field__label">完成时间</span>
                <span class="task-field__value">
                  {{ row.completedAt || "-" }}
                </span>
              </div>
            </div>

            <div v-if="row.status === 'failed'" class="task-error">
              <span class="task-error__label">失败原因</span>
              <span>{{ row.errorMessage || row.errorCode || "生成失败" }}</span>
              <small v-if="row.requestId">请求 {{ row.requestId }}</small>
            </div>
          </div>

          <div class="task-card__actions">
            <el-button
              v-if="row.status === 'completed' && row.fileUrl"
              type="primary"
              @click="handlePreview(row)"
            >
              预览动画
            </el-button>
            <el-button
              v-if="row.status === 'completed' && row.version > 0"
              type="success"
              plain
              @click="handleSetVersion(row.version.toString())"
            >
              设为展示
            </el-button>
          </div>
        </article>
      </div>
    </el-card>

    <el-dialog
      v-model="showSetVersionDialog"
      title="设置展示版本"
      :width="getDialogWidth('420px', '92%')"
    >
      <el-form :label-position="isMobile ? 'top' : 'right'" label-width="100px">
        <el-form-item label="版本选择">
          <el-radio-group v-model="setVersionForm.versionType">
            <el-radio value="latest">最新版本 (latest)</el-radio>
            <el-radio value="specific">指定版本</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item
          v-if="setVersionForm.versionType === 'specific'"
          label="版本号"
        >
          <el-select
            v-model="setVersionForm.version"
            placeholder="请选择版本"
            class="dialog-select"
          >
            <el-option
              v-for="task in completedTasks"
              :key="task.version"
              :label="`v${task.version}`"
              :value="task.version.toString()"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSetVersionDialog = false">取消</el-button>
        <el-button
          type="primary"
          :loading="setVersionLoading"
          @click="confirmSetVersion"
        >
          确定
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="previewDialogVisible"
      :title="`HTML 动画预览 - v${currentPreviewTask?.version || ''}`"
      :width="getDialogWidth('90%', '96%')"
      :fullscreen="isMobile"
      class="lab-dialog"
    >
      <div class="lab-iframe-container">
        <iframe
          v-if="currentPreviewTask"
          :src="currentPreviewTask.fileUrl"
          frameborder="0"
          allowfullscreen
          class="lab-iframe"
        />
      </div>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, computed, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { Refresh, VideoPlay, Setting } from "@element-plus/icons-vue";
import { getCourseList, getCourseHoursList } from "@/api/course";
import { usePageResponsive } from "@/utils/pageResponsive";
import {
  createHtmlAnimationIdempotencyKey,
  getHtmlAnimationList,
  getHtmlAnimationReadiness,
  generateHtmlAnimation,
  htmlAnimationScopeKey,
  matchesHtmlAnimationScope,
  setHtmlAnimationDisplay,
  forceSyncHtmlAnimation,
  normalizeHtmlAnimationTask,
  type HtmlAnimationReadinessResult,
  type HtmlAnimationScope,
  type HtmlAnimationScopeType,
  type HtmlAnimationTask,
  type HtmlAnimationListResult
} from "@/api/htmlAnimation";

defineOptions({
  name: "VirtualLabManage"
});

interface CourseItem {
  courseId: number;
  title: string;
}

interface ChapterItem {
  chapterId: number;
  name: string;
  hourList: Array<{
    hourId: number;
    title: string;
  }>;
}

const loading = ref(false);
const { isMobile, getDialogWidth } = usePageResponsive();
const generateLoading = ref(false);
const syncLoading = ref(false);
const setVersionLoading = ref(false);

const courseList = ref<CourseItem[]>([]);
const chapterList = ref<ChapterItem[]>([]);
const currentAnimationData = ref<HtmlAnimationListResult | null>(null);
const taskList = ref<HtmlAnimationTask[]>([]);
const readiness = ref<HtmlAnimationReadinessResult | null>(null);
const readinessLoading = ref(false);
const readinessError = ref("");
const generationIntentKeys = new Map<string, string>();
let scopeRequestSeq = 0;
const isTaskProcessing = (task: HtmlAnimationTask) =>
  ["pending", "submitted", "processing"].includes(task.status);
const isTaskCompleted = (task: HtmlAnimationTask) =>
  task.status === "completed";
const isTaskFailed = (task: HtmlAnimationTask) => task.status === "failed";

const stats = computed(() => {
  const total = taskList.value.length;
  const completed = taskList.value.filter(isTaskCompleted).length;
  const processing = taskList.value.filter(isTaskProcessing).length;
  const failed = taskList.value.filter(isTaskFailed).length;

  return {
    totalTasks: total,
    completedTasks: completed,
    processingTasks: processing,
    failedTasks: failed
  };
});

const completedTasks = computed(() =>
  taskList.value.filter(t => isTaskCompleted(t) && t.version > 0)
);

const searchForm = reactive<{
  courseId: number | null;
  chapterId: number | null;
  scopeType: HtmlAnimationScopeType;
  hourId: number | null;
}>({
  courseId: null as number | null,
  chapterId: null as number | null,
  scopeType: "chapter",
  hourId: null
});

const showSetVersionDialog = ref(false);
const setVersionForm = reactive({
  versionType: "latest",
  version: ""
});

const previewDialogVisible = ref(false);
const currentPreviewTask = ref<HtmlAnimationTask | null>(null);

const currentScope = computed<HtmlAnimationScope | null>(() => {
  if (!searchForm.courseId || !searchForm.chapterId) return null;
  if (searchForm.scopeType === "hour") {
    if (!searchForm.hourId) return null;
    return {
      courseId: searchForm.courseId,
      chapterId: searchForm.chapterId,
      scopeType: "hour",
      hourId: searchForm.hourId
    };
  }
  return {
    courseId: searchForm.courseId,
    chapterId: searchForm.chapterId,
    scopeType: "chapter"
  };
});

const currentScopeKey = computed(() =>
  currentScope.value ? htmlAnimationScopeKey(currentScope.value) : ""
);

const hasSelection = computed(() => Boolean(currentScope.value));

const selectedChapter = computed(() =>
  chapterList.value.find(chapter => chapter.chapterId === searchForm.chapterId)
);

const hourList = computed(
  () => selectedChapter.value?.hourList.filter(hour => hour.hourId > 0) || []
);

const selectedCourseTitle = computed(
  () =>
    courseList.value.find(course => course.courseId === searchForm.courseId)
      ?.title || ""
);

const selectedChapterTitle = computed(
  () =>
    chapterList.value.find(
      chapter => chapter.chapterId === searchForm.chapterId
    )?.name || ""
);

const currentScopeTitle = computed(() => {
  if (searchForm.scopeType === "chapter") {
    return selectedChapterTitle.value || "已选择章节";
  }
  const hourTitle = hourList.value.find(
    hour => hour.hourId === searchForm.hourId
  )?.title;
  return `${selectedChapterTitle.value} / ${hourTitle || "已选择课时"}`;
});

const canGenerate = computed(
  () =>
    Boolean(currentScope.value) &&
    readiness.value?.ready === true &&
    !readinessLoading.value &&
    !taskList.value.some(isTaskProcessing)
);

const readinessTitle = computed(() => {
  if (readinessLoading.value) return "正在检查内容就绪度";
  if (readinessError.value) return "暂时无法检查内容就绪度";
  if (readiness.value?.ready) return "当前范围可以生成动画";
  const titles: Record<string, string> = {
    CONTENT_NOT_CURATED: "课程内容尚未完成梳理",
    CONTENT_MISSING: "当前范围缺少可生成内容",
    SEARCH_UNAVAILABLE: "内容检索服务暂不可用"
  };
  return titles[readiness.value?.code || ""] || "当前范围暂不可生成";
});

const readinessDescription = computed(() => {
  if (readinessLoading.value) return "";
  if (readinessError.value) return readinessError.value;
  if (!readiness.value) return "刷新后重试。";
  return readiness.value.message;
});

const readinessType = computed<"success" | "warning" | "error" | "info">(() => {
  if (readiness.value?.ready) return "success";
  if (readiness.value?.code === "CONTENT_NOT_CURATED") return "warning";
  if (readinessError.value || readiness.value?.code === "SEARCH_UNAVAILABLE") {
    return "error";
  }
  return "info";
});

const currentDisplayVersionText = computed(() => {
  if (!currentAnimationData.value?.displayVersionResolved) {
    return "未设置";
  }

  return currentAnimationData.value.displayVersionRaw === "latest"
    ? `latest (v${currentAnimationData.value.displayVersionResolved})`
    : `v${currentAnimationData.value.displayVersionResolved}`;
});

const selectionBadgeText = computed(() => {
  if (hasSelection.value) {
    return `${selectedCourseTitle.value} / ${selectedChapterTitle.value}`;
  }

  if (searchForm.courseId) {
    return "已选择课程，等待选择章节";
  }

  return "尚未选择课程和章节";
});

const selectionHintText = computed(() => {
  if (hasSelection.value) {
    return "当前章节已定位，可直接管理任务";
  }

  if (searchForm.courseId) {
    return "请继续选择章节";
  }

  return "先完成课程和章节筛选";
});

const taskSummaryText = computed(() => {
  if (!hasSelection.value) {
    return "请选择课程和章节后查看 HTML 动画任务。";
  }

  if (loading.value && taskList.value.length === 0) {
    return "正在加载当前章节的任务记录...";
  }

  if (taskList.value.length === 0) {
    return "当前章节还没有生成记录，可以先生成一个新版本。";
  }

  const summary = `共 ${stats.value.totalTasks} 条任务，已完成 ${stats.value.completedTasks} 条，进行中 ${stats.value.processingTasks} 条`;

  return stats.value.failedTasks > 0
    ? `${summary}，失败 ${stats.value.failedTasks} 条。`
    : `${summary}。`;
});

const getRequestErrorMessage = (error: any, fallback: string) => {
  const status = error?.response?.status;
  const reqUrl = error?.config?.url;

  if (status === 404) {
    return reqUrl
      ? `接口不存在(404): ${reqUrl}，请确认当前环境已部署HTML动画接口`
      : "接口不存在(404)，请确认当前环境已部署HTML动画接口";
  }

  const message =
    error?.response?.data?.msg ||
    error?.response?.data?.message ||
    error?.message ||
    fallback;
  const responseData = error?.response?.data;
  const requestId = String(
    responseData?.request_id ||
      responseData?.requestId ||
      responseData?.data?.request_id ||
      responseData?.data?.requestId ||
      error?.response?.headers?.["x-request-id"] ||
      ""
  ).trim();
  return requestId ? `${message}（请求 ${requestId}）` : message;
};

const isDisplayVersion = (task: HtmlAnimationTask) => {
  if (
    !currentAnimationData.value?.displayVersionResolved ||
    task.version <= 0
  ) {
    return false;
  }

  if (currentAnimationData.value.displayVersionRaw === "latest") {
    return (
      String(task.version) === currentAnimationData.value.displayVersionResolved
    );
  }

  return String(task.version) === currentAnimationData.value.displayVersionRaw;
};

const loadCourseList = async () => {
  try {
    const res = await getCourseList({ pageNum: 1, pageSize: 1000 });
    courseList.value = res.data.courseList.map(c => ({
      courseId: c.courseId,
      title: c.title
    }));
  } catch (error) {
    console.error("获取课程列表失败", error);
    ElMessage.error("获取课程列表失败");
  }
};

const handleCourseChange = async (courseId: number | null) => {
  searchForm.chapterId = null;
  searchForm.hourId = null;
  chapterList.value = [];
  clearScopeData();

  if (!courseId) return;

  try {
    const res = await getCourseHoursList({ courseId });
    chapterList.value = res.data.courseChapters.map(c => ({
      chapterId: c.chapterId,
      name: c.name,
      hourList: (c.hourList || []).map(hour => ({
        hourId: Number(hour.hourId),
        title: hour.title || `课时 ${hour.hourId}`
      }))
    }));
  } catch (error) {
    console.error("获取章节列表失败", error);
    ElMessage.error("获取章节列表失败");
  }
};

const clearScopeData = () => {
  scopeRequestSeq += 1;
  currentAnimationData.value = null;
  taskList.value = [];
  readiness.value = null;
  readinessError.value = "";
  readinessLoading.value = false;
  loading.value = false;
};

const handleChapterChange = () => {
  searchForm.hourId = null;
  clearScopeData();
  if (searchForm.chapterId && searchForm.scopeType === "chapter") {
    handleSearch();
  }
};

const handleScopeChange = () => {
  searchForm.hourId = null;
  clearScopeData();
  if (searchForm.scopeType === "chapter" && searchForm.chapterId) {
    handleSearch();
  }
};

const handleSearch = async () => {
  const scope = currentScope.value;
  if (!scope) {
    clearScopeData();
    return;
  }

  const requestScopeKey = htmlAnimationScopeKey(scope);
  const requestId = ++scopeRequestSeq;
  loading.value = true;
  readinessLoading.value = true;
  readiness.value = null;
  readinessError.value = "";

  await Promise.all([
    getHtmlAnimationList(scope)
      .then(res => {
        if (
          requestId !== scopeRequestSeq ||
          requestScopeKey !== currentScopeKey.value
        ) {
          return;
        }
        if (!matchesHtmlAnimationScope(scope, res.data)) {
          currentAnimationData.value = null;
          taskList.value = [];
          ElMessage.error(
            "动画列表返回的课程、章节或课时与当前选择不一致，已停止展示"
          );
          return;
        }
        currentAnimationData.value = res.data;
        taskList.value = (res.data.tasks || []).map(normalizeHtmlAnimationTask);
      })
      .catch(error => {
        if (requestId !== scopeRequestSeq) return;
        console.error("获取动画任务列表失败", error);
        ElMessage.error(getRequestErrorMessage(error, "获取动画任务列表失败"));
        currentAnimationData.value = null;
        taskList.value = [];
      }),
    getHtmlAnimationReadiness(scope)
      .then(res => {
        if (
          requestId !== scopeRequestSeq ||
          requestScopeKey !== currentScopeKey.value
        ) {
          return;
        }
        if (!matchesHtmlAnimationScope(scope, res.data)) {
          readiness.value = null;
          readinessError.value =
            "内容就绪度返回的课程、章节或课时与当前选择不一致，已停止生成";
          return;
        }
        readiness.value = res.data;
      })
      .catch((error: any) => {
        if (requestId !== scopeRequestSeq) return;
        const code =
          error?.response?.data?.data?.code ||
          error?.response?.data?.code ||
          "";
        const message = getRequestErrorMessage(error, "内容就绪度检查失败");
        readinessError.value = code ? `${message}（${code}）` : message;
      })
  ]);

  if (requestId === scopeRequestSeq) {
    loading.value = false;
    readinessLoading.value = false;
  }
};

const resetSearch = () => {
  searchForm.courseId = null;
  searchForm.chapterId = null;
  searchForm.scopeType = "chapter";
  searchForm.hourId = null;
  chapterList.value = [];
  clearScopeData();
};

const handleGenerate = async () => {
  const scope = currentScope.value;
  if (!canGenerate.value || !scope) return;
  const scopeKey = htmlAnimationScopeKey(scope);
  const idempotencyKey =
    generationIntentKeys.get(scopeKey) ||
    createHtmlAnimationIdempotencyKey(scope);
  generationIntentKeys.set(scopeKey, idempotencyKey);

  generateLoading.value = true;
  try {
    const res = await generateHtmlAnimation({
      ...scope,
      idempotencyKey
    });
    if (!matchesHtmlAnimationScope(scope, res.data)) {
      throw new Error(
        "生成接口返回的课程、章节或课时与当前选择不一致，已停止跟踪任务"
      );
    }
    generationIntentKeys.delete(scopeKey);
    ElMessage.success(
      res.data.reused
        ? `已继续跟踪现有生成任务（任务 ${res.data.taskId}）`
        : `${res.data.message || "生成任务已启动"}（任务 ${res.data.taskId}）`
    );
    if (scopeKey === currentScopeKey.value) await handleSearch();
  } catch (error) {
    console.error("生成动画失败", error);
    ElMessage.error(getRequestErrorMessage(error, "生成动画失败"));
  } finally {
    generateLoading.value = false;
  }
};

const handleForceSync = async () => {
  syncLoading.value = true;
  try {
    const res = await forceSyncHtmlAnimation();
    ElMessage.success(
      `同步完成：共 ${res.data.totalChapters} 章节，成功 ${res.data.successChapters} 章节`
    );

    if (searchForm.courseId && searchForm.chapterId) {
      handleSearch();
    }
  } catch (error) {
    console.error("同步失败", error);
    ElMessage.error(getRequestErrorMessage(error, "同步失败"));
  } finally {
    syncLoading.value = false;
  }
};

const handleSetVersion = async (version: string) => {
  const scope = currentScope.value;
  if (!scope) return;

  try {
    await setHtmlAnimationDisplay({
      ...scope,
      version
    });
    ElMessage.success("设置成功");
    handleSearch();
  } catch (error) {
    console.error("设置展示版本失败", error);
    ElMessage.error(getRequestErrorMessage(error, "设置展示版本失败"));
  }
};

const confirmSetVersion = async () => {
  const scope = currentScope.value;
  if (!scope) return;

  const version =
    setVersionForm.versionType === "latest" ? "latest" : setVersionForm.version;

  if (setVersionForm.versionType === "specific" && !setVersionForm.version) {
    ElMessage.warning("请选择版本号");
    return;
  }

  setVersionLoading.value = true;
  try {
    await setHtmlAnimationDisplay({
      ...scope,
      version
    });
    ElMessage.success("设置成功");
    showSetVersionDialog.value = false;
    handleSearch();
  } catch (error) {
    console.error("设置展示版本失败", error);
    ElMessage.error(getRequestErrorMessage(error, "设置展示版本失败"));
  } finally {
    setVersionLoading.value = false;
  }
};

const handlePreview = (task: HtmlAnimationTask) => {
  currentPreviewTask.value = task;
  previewDialogVisible.value = true;
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: "等待中",
    processing: "生成中",
    completed: "已完成",
    failed: "失败"
  };

  return labels[status] || status;
};

const getStatusTagType = (
  status: string
): "info" | "warning" | "success" | "danger" => {
  const types: Record<string, "info" | "warning" | "success" | "danger"> = {
    pending: "info",
    processing: "warning",
    completed: "success",
    failed: "danger"
  };

  return types[status] || "info";
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

onMounted(() => {
  loadCourseList();
});
</script>

<style lang="scss" scoped>
.virtual-lab {
  min-height: 100%;
  padding: 12px;
  background:
    radial-gradient(circle at top, rgb(151 180 247 / 8%), transparent 36%),
    linear-gradient(180deg, #f8fbff 0%, #f6f8fc 100%);

  .lab-panel {
    margin-bottom: 16px;
    overflow: hidden;
    background: rgb(255 255 255 / 94%);
    border: 1px solid rgb(226 232 240 / 88%);
    border-radius: 26px;
    box-shadow: 0 16px 40px rgb(15 23 42 / 6%);

    html.dark & {
      background: rgb(15 23 42 / 92%);
      border-color: rgb(148 163 184 / 16%);
      box-shadow: 0 18px 44px rgb(2 6 23 / 28%);
    }
  }

  .hero-panel {
    background:
      linear-gradient(
        135deg,
        rgb(239 246 255 / 95%) 0%,
        rgb(240 253 244 / 92%) 100%
      ),
      #fff;

    html.dark & {
      background:
        linear-gradient(
          135deg,
          rgb(30 41 59 / 96%) 0%,
          rgb(15 23 42 / 94%) 100%
        ),
        #0f172a;
    }
  }

  .hero-panel__content,
  .panel-header {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .hero-panel__copy,
  .panel-copy {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .hero-panel__eyebrow,
  .panel-eyebrow,
  .task-card__section-title {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #7c97d9;
    text-transform: uppercase;
  }

  .hero-panel__copy h2,
  .panel-copy h3 {
    margin: 0;
    color: #1e293b;
    letter-spacing: -0.02em;

    html.dark & {
      color: #f8fafc;
    }
  }

  .hero-panel__copy h2 {
    font-size: 30px;
    line-height: 1.18;
  }

  .panel-copy h3 {
    font-size: 22px;
    line-height: 1.24;
  }

  .hero-panel__copy p,
  .panel-copy p,
  .focus-panel__note {
    margin: 0;
    font-size: 14px;
    line-height: 1.7;
    color: #64748b;

    html.dark & {
      color: #94a3b8;
    }
  }

  .hero-panel__selection,
  .panel-header__meta,
  .task-panel__summary,
  .task-card__tag-group,
  .focus-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .hero-chip,
  .panel-badge,
  .summary-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 36px;
    padding: 0 14px;
    font-size: 13px;
    font-weight: 600;
    color: #475569;
    background: rgb(255 255 255 / 80%);
    border: 1px solid rgb(203 213 225 / 92%);
    border-radius: 999px;

    html.dark & {
      color: #cbd5e1;
      background: rgb(30 41 59 / 90%);
      border-color: rgb(71 85 105 / 92%);
    }
  }

  .hero-chip--soft,
  .panel-badge.is-active {
    color: #315ea8;
    background: rgb(151 180 247 / 14%);
    border-color: rgb(151 180 247 / 32%);

    html.dark & {
      color: #bfdbfe;
      background: rgb(59 130 246 / 18%);
      border-color: rgb(96 165 250 / 28%);
    }
  }

  .summary-chip.is-danger {
    color: #b42318;
    background: #fff1f3;
    border-color: #fecdd3;

    html.dark & {
      color: #fecdd3;
      background: rgb(127 29 29 / 38%);
      border-color: rgb(248 113 113 / 34%);
    }
  }

  .hero-panel__stats,
  .focus-grid,
  .task-grid,
  .lab-search-form__grid,
  .task-meta-grid,
  .task-card__actions {
    display: grid;
    gap: 12px;
  }

  .hero-panel__stats,
  .focus-grid,
  .lab-search-form__grid,
  .task-meta-grid,
  .task-card__actions {
    grid-template-columns: 1fr;
  }

  .hero-stat-card,
  .focus-card,
  .task-card {
    background: rgb(255 255 255 / 84%);
    border: 1px solid rgb(226 232 240 / 86%);
    border-radius: 22px;

    html.dark & {
      background: rgb(15 23 42 / 72%);
      border-color: rgb(71 85 105 / 52%);
    }
  }

  .hero-stat-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 16px;
    min-height: 124px;
  }

  .hero-stat-card__label,
  .focus-card__label,
  .task-field__label,
  .focus-panel__version-label,
  .task-error__label {
    font-size: 12px;
    font-weight: 600;
    color: #64748b;

    html.dark & {
      color: #94a3b8;
    }
  }

  .hero-stat-card__value,
  .focus-card__value,
  .focus-panel__version-value {
    color: #0f172a;
    font-weight: 700;
    letter-spacing: -0.03em;

    html.dark & {
      color: #f8fafc;
    }
  }

  .hero-stat-card__value {
    font-size: 34px;
    line-height: 1;
  }

  .hero-stat-card__hint,
  .task-field__value {
    font-size: 13px;
    line-height: 1.65;
    color: #475569;

    html.dark & {
      color: #cbd5e1;
    }
  }

  .panel-sync-button {
    min-height: 42px;
    font-weight: 600;
  }

  .lab-search-form {
    margin-top: 8px;
  }

  .lab-search-form__actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 4px;
  }

  .focus-panel__version {
    display: inline-flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 16px;
    background: rgb(151 180 247 / 10%);
    border: 1px solid rgb(151 180 247 / 24%);
    border-radius: 20px;

    html.dark & {
      background: rgb(59 130 246 / 16%);
      border-color: rgb(96 165 250 / 24%);
    }
  }

  .focus-panel__version-value {
    font-size: 22px;
  }

  .focus-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 16px;
  }

  .focus-card__value {
    font-size: 24px;
    line-height: 1.2;
  }

  .focus-card__value--compact {
    font-size: 16px;
    line-height: 1.6;
    letter-spacing: normal;
  }

  .focus-panel__note {
    margin-top: 12px;
  }

  .task-panel__summary {
    align-items: center;
  }

  .task-card {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px;
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease,
      border-color 0.2s ease;

    &.is-display {
      border-color: rgb(52 211 153 / 38%);
      box-shadow: 0 14px 34px rgb(16 185 129 / 10%);

      html.dark & {
        border-color: rgb(52 211 153 / 34%);
        box-shadow: 0 14px 34px rgb(5 150 105 / 14%);
      }
    }

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 18px 36px rgb(15 23 42 / 8%);

      html.dark & {
        box-shadow: 0 18px 36px rgb(2 6 23 / 24%);
      }
    }
  }

  .task-card__header,
  .task-card__header-main,
  .task-card__body,
  .task-field,
  .task-error {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .task-card__header {
    padding-bottom: 14px;
    border-bottom: 1px solid rgb(226 232 240 / 82%);

    html.dark & {
      border-bottom-color: rgb(71 85 105 / 56%);
    }
  }

  .task-card__header-main {
    gap: 10px;
  }

  .task-card__body {
    gap: 14px;
  }

  .task-cover {
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background:
      linear-gradient(135deg, rgb(151 180 247 / 16%), transparent 42%), #f8fafc;
    border: 1px solid rgb(226 232 240 / 86%);
    border-radius: 16px;

    html.dark & {
      background:
        linear-gradient(135deg, rgb(96 165 250 / 18%), transparent 42%), #0f172a;
      border-color: rgb(71 85 105 / 52%);
    }
  }

  .task-cover img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .task-cover__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 13px;
    font-weight: 700;
    color: #64748b;

    html.dark & {
      color: #cbd5e1;
    }
  }

  .task-field {
    min-width: 0;
    word-break: break-word;
  }

  .task-field--full {
    grid-column: 1 / -1;
  }

  .task-id {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    line-height: 1.7;
    color: #475569;
    word-break: break-all;

    html.dark & {
      color: #cbd5e1;
    }
  }

  .task-error {
    padding: 12px 14px;
    font-size: 13px;
    line-height: 1.6;
    color: #b42318;
    background: #fff1f2;
    border: 1px solid #fecdd3;
    border-radius: 16px;

    html.dark & {
      color: #fecdd3;
      background: rgb(127 29 29 / 32%);
      border-color: rgb(248 113 113 / 26%);
    }
  }

  .lab-iframe-container {
    width: 100%;
    height: 70vh;
  }

  .lab-iframe {
    width: 100%;
    height: 100%;
    background: #f8fafc;
    border-radius: 18px;
  }
}

:deep(.el-card__body) {
  padding: 18px;
}

:deep(.hero-panel .el-card__body) {
  padding: 20px;
}

:deep(.el-dialog) {
  border-radius: 22px;
}

:deep(.el-button) {
  min-height: 42px;
  border-radius: 14px;
  font-weight: 600;
}

.focus-actions :deep(.el-button),
.task-card__actions :deep(.el-button),
.lab-search-form__actions :deep(.el-button) {
  margin-left: 0;
}

.focus-actions :deep(.el-button + .el-button),
.task-card__actions :deep(.el-button + .el-button),
.lab-search-form__actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.lab-scope-segmented {
  display: flex;
  width: 100%;

  :deep(.el-radio-button) {
    flex: 1;
  }

  :deep(.el-radio-button__inner) {
    width: 100%;
  }
}

.scope-readiness {
  margin-top: 14px;
}

:deep(.el-input__wrapper),
:deep(.el-select__wrapper) {
  border-radius: 14px;
}

:deep(.lab-search-form .el-form-item) {
  margin-bottom: 0;
}

:deep(.lab-search-form .el-form-item__label) {
  padding-bottom: 8px;
  font-weight: 600;
  line-height: 1.3;
}

:deep(.lab-search-form .el-form-item__content),
:deep(.lab-search-form .el-select),
:deep(.lab-search-form .el-select__wrapper),
:deep(.lab-search-form .el-input),
.lab-search-form__control,
.dialog-select {
  width: 100%;
}

@media (width >= 768px) {
  .virtual-lab {
    padding: 16px;

    .panel-header {
      flex-direction: row;
      align-items: flex-start;
      justify-content: space-between;
    }

    .panel-header__meta {
      align-items: center;
      justify-content: flex-end;
    }

    .hero-panel__stats,
    .focus-grid,
    .lab-search-form__grid,
    .task-meta-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .task-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .focus-card--wide,
    .task-field--full {
      grid-column: 1 / -1;
    }

    .task-card__header {
      flex-direction: row;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
    }

    .task-card__actions {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  :deep(.hero-panel .el-card__body) {
    padding: 24px;
  }
}

@media (width >= 1100px) {
  .virtual-lab {
    .hero-panel__content {
      flex-direction: row;
      justify-content: space-between;
      align-items: stretch;
    }

    .hero-panel__copy {
      max-width: 540px;
    }

    .hero-panel__stats {
      width: min(520px, 100%);
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .focus-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .task-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .focus-card--wide {
      grid-column: span 1;
    }
  }
}

@media (width <= 767px) {
  .virtual-lab {
    padding: 10px 10px
      calc(var(--pure-mobile-tab-height) + var(--pure-safe-area-bottom) + 24px);

    .hero-panel__copy h2 {
      font-size: 28px;
    }

    .panel-copy h3 {
      font-size: 20px;
    }

    .panel-sync-button,
    .panel-badge {
      width: 100%;
    }

    .focus-actions,
    .task-panel__summary,
    .panel-header__meta {
      display: grid;
      grid-template-columns: 1fr;
    }

    .focus-actions :deep(.el-button),
    .task-card__actions :deep(.el-button) {
      width: 100%;
      justify-content: center;
    }
  }
}

@media (width <= 420px) {
  .virtual-lab {
    .hero-panel__copy h2 {
      font-size: 24px;
    }

    .hero-stat-card__value {
      font-size: 30px;
    }

    .lab-search-form__actions,
    .task-card__actions {
      grid-template-columns: 1fr;
    }

    .task-card,
    .hero-stat-card,
    .focus-card {
      padding: 16px;
    }
  }
}
</style>
