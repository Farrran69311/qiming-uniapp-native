<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  Search,
  MagicStick,
  Refresh,
  Download,
  CircleCheck,
  ArrowDown,
  EditPen,
  Delete,
  Stamp
} from "@element-plus/icons-vue";
import {
  assistantApiErrorMessage,
  createAssistantResourceTask,
  deleteAssistantResource,
  getAssistantResource,
  getAssistantResourceTask,
  getAssistantTaskTrace,
  listAssistantResourceTaskLogs,
  listAssistantResourceTasks,
  listAssistantResourceVersions,
  listAssistantResources,
  publishAssistantResource,
  reportAssistantResourceUsage,
  reviewAssistantResource,
  updateAssistantResource,
  type AssistantCreateResourceTaskResp,
  type AssistantListResourceTaskLogsResp,
  type AssistantListResourceTasksResp,
  type AssistantListResourcesResp,
  type AssistantResourceSummary,
  type AssistantReportResourceUsageResp,
  type AssistantResourceMutationResp,
  type AssistantResourceTaskItem,
  type AssistantResourceTaskLogItem,
  type AssistantResourceUsageEventType,
  type AssistantResourceVersionItem,
  type AssistantChatTraceStep,
  type AssistantOption,
  type AssistantTaskTraceResp
} from "@/api/frontend/assistant";
import { unwrapAssistantResponseData } from "@/api/frontend/assistantResponse";
import {
  PlatformResourcePreviewDialog,
  downloadPlatformResource,
  hasPlatformResourcePreview,
  mapAssistantResourcePreview,
  type PlatformPreviewResource
} from "@/components/PlatformResourcePreview";

const props = defineProps<{
  courseId?: number;
  courseName?: string;
  targetStudentId?: number;
  requiresTargetStudent?: boolean;
  resourceTypes?: AssistantOption[];
}>();

const contextWarning = computed(() => {
  if (!props.courseId) return "请先选择课程";
  if (props.requiresTargetStudent && !props.targetStudentId) {
    return "请先选择学生";
  }
  return "";
});
const hasRequiredContext = computed(() => !contextWarning.value);

const loading = ref(false);
const resourceLoading = ref(false);
const taskRetrying = ref(false);
const creating = ref(false);
const searchQuery = ref("");
const resourceType = ref("");
const tasks = ref<AssistantResourceTaskItem[]>([]);
const resources = ref<AssistantResourceSummary[]>([]);
const serverResources = ref<AssistantResourceSummary[]>([]);
const backendPageResources = ref<AssistantResourceSummary[]>([]);
const backendResourceTotal = ref(0);
const backendResourcePage = ref(1);
const backendResourcePageSize = ref(24);
const backendResourcePageSizes = [24, 50, 100];
const selectedTaskId = ref("");
const taskLogs = ref<AssistantResourceTaskLogItem[]>([]);
const taskTrace = ref<AssistantChatTraceStep[]>([]);
const detailVisible = ref(false);
const selectedResource = ref<AssistantResourceSummary | null>(null);
const platformPreviewVisible = ref(false);
const platformPreviewResource = ref<PlatformPreviewResource | null>(null);
const previewPreparing = ref(false);
const resourceVersions = ref<AssistantResourceVersionItem[]>([]);
const resourceOpenedAt = ref(0);
const resourceFeedbackScore = ref(5);
const resourceFeedbackText = ref("");
const feedbackSubmitting = ref(false);
const completeSubmitting = ref(false);
const governanceSubmitting = ref(false);
const deleteSubmitting = ref(false);
const taskLoadError = ref("");
const resourceLoadError = ref("");
const taskActivityLoadError = ref("");
const editMode = ref(false);
const detailActivePanels = ref(["summary", "feedback"]);
const taskActivityExpanded = ref(false);
const backendResourceTaskId = "resource-backend-library";
let taskPollingTimer: number | undefined;
let taskPollingInFlight = false;
let resourceRequestSequence = 0;
const editForm = ref({
  title: "",
  summary: "",
  description: "",
  content_format: "markdown",
  content_body: "",
  knowledge_point_id: "",
  knowledge_relevance: 0,
  edit_reason: ""
});

const ensureCourseContext = () => {
  if (hasRequiredContext.value) return true;
  ElMessage.warning(contextWarning.value || "请先选择课程");
  return false;
};

const resetResourceSelection = () => {
  resourceRequestSequence += 1;
  resourceLoading.value = false;
  serverResources.value = [];
  backendPageResources.value = [];
  backendResourceTotal.value = 0;
  backendResourcePage.value = 1;
  tasks.value = [];
  resources.value = [];
  selectedTaskId.value = "";
  taskLogs.value = [];
  taskTrace.value = [];
  taskLoadError.value = "";
  resourceLoadError.value = "";
  taskActivityLoadError.value = "";
  taskActivityExpanded.value = false;
  detailVisible.value = false;
  selectedResource.value = null;
  platformPreviewVisible.value = false;
  platformPreviewResource.value = null;
  resourceVersions.value = [];
  editMode.value = false;
};

const selectedTask = computed(() =>
  tasks.value.find(task => task.task_id === selectedTaskId.value)
);

const selectedTaskLabel = computed(() =>
  selectedTask.value ? taskTitle(selectedTask.value) : ""
);

const latestTaskTrace = computed(() =>
  taskTrace.value.length ? taskTrace.value[taskTrace.value.length - 1] : null
);

const completedTraceCount = computed(
  () => taskTrace.value.filter(step => step.status === "completed").length
);

const resourceEmptyDescription = computed(() => {
  const task = selectedTask.value;
  if (!task) return "暂无学习资源";
  if (isBackendResourceTask(task.task_id)) {
    return "后端接口暂未返回资源";
  }
  return "该任务暂未生成可展示资源";
});

const filteredResources = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase();
  const hasTaskAssociations = resources.value.some(
    resource => resource.task_id
  );
  const backendTaskSelected = isBackendResourceTask(selectedTaskId.value);
  return resources.value.filter(resource => {
    const matchesTask =
      !selectedTaskId.value ||
      backendTaskSelected ||
      !hasTaskAssociations ||
      resource.task_id === selectedTaskId.value;
    const matchesKeyword =
      !keyword ||
      resource.title.toLowerCase().includes(keyword) ||
      resource.summary?.toLowerCase().includes(keyword) ||
      resource.recommendation?.toLowerCase().includes(keyword);
    const matchesType =
      !resourceType.value || resource.resource_type === resourceType.value;
    return matchesTask && matchesKeyword && matchesType;
  });
});

const resourceTypeOptions = computed(() =>
  Array.from(
    new Set([
      ...(props.resourceTypes || []).map(item => item.key),
      ...resources.value.map(item => item.resource_type)
    ])
  ).filter(Boolean)
);

const statusTextMap: Record<string, string> = {
  completed: "已完成",
  completed_with_warnings: "带警告完成",
  partial: "部分完成",
  stored: "已入库",
  ready: "可用",
  published: "已发布",
  approved: "已通过",
  safe: "安全",
  failed: "失败",
  blocked: "已阻断",
  rejected: "已驳回",
  deleted: "已删除",
  degraded: "降级",
  processing: "处理中",
  pending: "待处理",
  changes_requested: "需修改",
  draft: "草稿",
  reviewed: "已审核",
  not_configured: "未配置",
  exportable_only: "仅可导出",
  missing: "缺失",
  running: "工作中",
  queued: "排队中",
  preparing: "准备生成",
  retrieving: "检索资料",
  analyzing: "分析学情",
  planning: "规划资源",
  drafting: "构建内容",
  generating: "生成资源",
  validating: "质量校验",
  reviewing: "科学初检",
  mapping: "构建知识图谱",
  storing: "资源入库",
  default: "默认"
};

const warningFlagTextMap: Record<string, string> = {
  rag_empty: "知识库无证据",
  llm_unavailable: "模型不可用",
  llm_json_invalid: "JSON 解析失败",
  json_repair_failed: "JSON 修复失败",
  degraded: "降级生成",
  not_configured: "能力未配置",
  evidence_insufficient: "证据不足",
  storage_degraded: "存储降级",
  html_animation_processing: "动画处理中",
  html_animation_failed: "动画失败",
  pptx_processing: "PPT 处理中",
  question_bank_processing: "题库处理中",
  runtime_not_configured: "运行环境未配置",
  safety_warning: "安全提醒",
  safety_blocked: "安全阻断"
};

const resourceTypeTextMap: Record<string, string> = {
  explanation_doc: "讲解文档",
  mind_map: "思维导图",
  courseware_ppt: "课件",
  exercise_set: "练习题",
  extended_reading: "拓展阅读",
  html_animation: "动画演示",
  coding_practice_case: "编程案例",
  video: "视频",
  animation: "动画",
  html: "网页",
  code: "代码",
  document: "文档"
};

const formatTextMap: Record<string, string> = {
  markdown: "Markdown",
  html: "HTML",
  pptx: "PPTX",
  pdf: "PDF",
  json: "JSON",
  text: "文本"
};

const agentNameMap: Record<string, string> = {
  LearningAssistant: "学习助手 Agent",
  ContextAgent: "学情 Agent",
  ProfileAgent: "学情画像 Agent",
  CurriculumAgent: "课程分析 Agent",
  RetrievalAgent: "资料检索 Agent",
  KnowledgeGraphAgent: "知识图谱 Agent",
  PlannerAgent: "结构规划 Agent",
  OutlineAgent: "内容大纲 Agent",
  ExplanationAgent: "讲解生成 Agent",
  ContentAgent: "内容生成 Agent",
  ExerciseAgent: "练习生成 Agent",
  AssessmentAgent: "练习评估 Agent",
  CitationAgent: "引用核验 Agent",
  SafetyAgent: "科学审查 Agent",
  GovernanceAgent: "审核治理 Agent",
  StorageAgent: "资源入库 Agent",
  ResourceAgent: "资源生成 Agent"
};

const textOf = (
  map: Record<string, string>,
  value?: string,
  fallback = "暂无"
) => {
  const key = String(value || "").trim();
  if (!key) return fallback;
  return map[key] || key;
};

const statusText = (status?: string) => textOf(statusTextMap, status);
const warningFlagText = (flag?: string) => textOf(warningFlagTextMap, flag, "");
const resourceTypeText = (type?: string) => textOf(resourceTypeTextMap, type);
const formatText = (format?: string) => textOf(formatTextMap, format);
const agentText = (name?: string) => textOf(agentNameMap, name, "调度节点");
const taskTitle = (task: AssistantResourceTaskItem) =>
  isBackendResourceTask(task.task_id)
    ? "后端已入库资源"
    : task.stage
      ? statusText(task.stage)
      : `任务 ${task.task_id.slice(0, 8)}`;

const tagType = (status: string) => {
  if (
    ["completed", "stored", "ready", "published", "approved", "safe"].includes(
      status
    )
  )
    return "success";
  if (["failed", "blocked", "rejected", "deleted"].includes(status))
    return "danger";
  if (
    [
      "completed_with_warnings",
      "partial",
      "degraded",
      "processing",
      "pending",
      "changes_requested"
    ].includes(status)
  )
    return "warning";
  return "warning";
};

const statusProgress = (task: AssistantResourceTaskItem) =>
  Math.min(100, Math.max(0, Math.round(Number(task.progress || 0))));
const taskProgressStatus = (task: AssistantResourceTaskItem) => {
  if (["failed", "blocked"].includes(task.status)) return "exception";
  if (["completed_with_warnings", "partial"].includes(task.status)) {
    return "warning";
  }
  if (task.status === "completed") return "success";
  return undefined;
};

const taskTerminalStatuses = new Set([
  "completed",
  "completed_with_warnings",
  "partial",
  "failed",
  "degraded",
  "cancelled",
  "blocked"
]);
const isTerminalTask = (status?: string) =>
  taskTerminalStatuses.has(String(status || "").toLowerCase());

const isBackendResourceTask = (taskId?: string) =>
  taskId === backendResourceTaskId;

const qualityLabel = (score?: number) => {
  if (score === undefined || score === null) return "";
  const normalized = score <= 1 ? score * 100 : score;
  return `${Math.round(normalized)}%`;
};

const hasInlinePreview = (resource?: AssistantResourceSummary | null) =>
  !!resource?.content_body && !resource.preview_url;
const selectedResourceCanPreview = computed(() =>
  selectedResource.value
    ? Boolean(
        selectedResource.value.resource_id ||
          hasPlatformResourcePreview(
            mapAssistantResourcePreview(selectedResource.value)
          )
      )
    : false
);

const incompleteStates = computed(() => {
  const resource = selectedResource.value;
  if (!resource) return [];
  return [
    resource.pptx_status
      ? { label: "PPTX", value: resource.pptx_status }
      : null,
    resource.question_bank_status
      ? { label: "题库", value: resource.question_bank_status }
      : null,
    resource.runtime_status
      ? { label: "代码运行", value: resource.runtime_status }
      : null,
    resource.storage_status
      ? { label: "对象存储", value: resource.storage_status }
      : null,
    resource.html_animation_status
      ? { label: "HTML 动画", value: resource.html_animation_status }
      : null
  ].filter(Boolean) as { label: string; value: string }[];
});

const showAsIncomplete = (value?: string) =>
  [
    "not_configured",
    "exportable_only",
    "degraded",
    "processing",
    "missing"
  ].includes(String(value || ""));

const submitResourceUsage = async (
  resource: AssistantResourceSummary,
  eventType: AssistantResourceUsageEventType,
  extra: Record<string, any> = {}
) => {
  const response = await reportAssistantResourceUsage({
    resource_id: resource.resource_id,
    course_id: props.courseId,
    target_student_id: props.targetStudentId,
    event_type: eventType,
    ...extra
  });
  return unwrapAssistantResponseData<AssistantReportResourceUsageResp>(
    response,
    "记录资源使用",
    { requireAccepted: true }
  );
};

const reportResourceUsage = async (
  resource: AssistantResourceSummary,
  eventType: AssistantResourceUsageEventType,
  extra: Record<string, any> = {}
) => {
  try {
    await submitResourceUsage(resource, eventType, extra);
    return true;
  } catch (error) {
    console.warn("[AiResourceGeneration] 资源使用事件上报失败:", error);
    return false;
  }
};

const resourceQuery = (taskId = selectedTaskId.value) => ({
  course_id: props.courseId,
  target_student_id: props.targetStudentId,
  task_id: taskId || undefined
});

type AssistantResourceQuery = NonNullable<
  Parameters<typeof listAssistantResources>[0]
>;

const listBackendResourcePage = async (
  params: AssistantResourceQuery,
  page = backendResourcePage.value,
  pageSize = backendResourcePageSize.value
) => {
  const response = await listAssistantResources({
    ...params,
    page,
    page_size: pageSize
  });
  return unwrapAssistantResponseData<AssistantListResourcesResp>(
    response,
    "加载资源列表",
    { requireList: true }
  );
};

const updateBackendResourcePage = (
  data: {
    page?: number;
    page_size?: number;
    total?: number;
    list?: AssistantResourceSummary[];
  },
  requestedPage = backendResourcePage.value,
  requestedPageSize = backendResourcePageSize.value
) => {
  const pageResources = data.list || [];
  serverResources.value = pageResources;
  backendPageResources.value = pageResources;
  backendResourceTotal.value = Math.max(
    Number(data.total || 0),
    pageResources.length
  );
  backendResourcePage.value = Math.max(1, Number(data.page || requestedPage));
  backendResourcePageSize.value = Math.max(
    1,
    Number(data.page_size || requestedPageSize)
  );
  upsertTask(createBackendResourceTask());
};

const mergeServerTasks = (serverTasks: AssistantResourceTaskItem[]) => {
  const backendResourceTasks =
    backendResourceTotal.value > 0 || backendPageResources.value.length > 0
      ? [createBackendResourceTask()]
      : [];
  tasks.value = orderTasks([...backendResourceTasks, ...serverTasks]);
};

const retryTaskList = async () => {
  if (taskRetrying.value || !ensureCourseContext()) return;
  taskRetrying.value = true;
  taskLoadError.value = "";
  try {
    const response = await listAssistantResourceTasks({
      course_id: props.courseId,
      target_student_id: props.targetStudentId
    });
    const data = unwrapAssistantResponseData<AssistantListResourceTasksResp>(
      response,
      "加载任务列表",
      { requireList: true }
    );
    mergeServerTasks(data.list || []);
    scheduleTaskPolling();
  } catch (error) {
    taskLoadError.value = assistantApiErrorMessage(
      error,
      "任务列表加载失败，请重试"
    );
  } finally {
    taskRetrying.value = false;
  }
};

const handleBackendResourcePageChange = (page: number) => {
  if (page === backendResourcePage.value) return;
  backendResourcePage.value = page;
  if (isBackendResourceTask(selectedTaskId.value)) {
    void loadTaskResources(backendResourceTaskId);
  }
};

const handleBackendResourcePageSizeChange = (pageSize: number) => {
  if (pageSize === backendResourcePageSize.value) return;
  backendResourcePageSize.value = pageSize;
  backendResourcePage.value = 1;
  if (isBackendResourceTask(selectedTaskId.value)) {
    void loadTaskResources(backendResourceTaskId);
  }
};

const loadResources = async () => {
  if (!hasRequiredContext.value) {
    tasks.value = [];
    serverResources.value = [];
    backendPageResources.value = [];
    resources.value = [];
    resetResourceSelection();
    return;
  }
  loading.value = true;
  taskLoadError.value = "";
  resourceLoadError.value = "";
  const taskId = selectedTaskId.value;
  const backendTaskSelected = isBackendResourceTask(taskId);
  const requestsAllServerResources = !taskId || backendTaskSelected;
  const requestedBackendPage = backendTaskSelected
    ? backendResourcePage.value
    : 1;
  const requestedBackendPageSize = backendResourcePageSize.value;
  const requestSequence = ++resourceRequestSequence;
  try {
    const resourceRequest = requestsAllServerResources
      ? listBackendResourcePage(
          resourceQuery(""),
          requestedBackendPage,
          requestedBackendPageSize
        )
      : listAssistantResources(resourceQuery(taskId)).then(response =>
          unwrapAssistantResponseData<AssistantListResourcesResp>(
            response,
            "加载资源列表",
            { requireList: true }
          )
        );
    const [taskResult, resourceResult] = await Promise.allSettled([
      listAssistantResourceTasks({
        course_id: props.courseId,
        target_student_id: props.targetStudentId
      }).then(response =>
        unwrapAssistantResponseData<AssistantListResourceTasksResp>(
          response,
          "加载任务列表",
          { requireList: true }
        )
      ),
      resourceRequest
    ]);
    if (
      requestSequence === resourceRequestSequence &&
      taskId === selectedTaskId.value
    ) {
      if (resourceResult.status === "fulfilled") {
        const loadedServerResources = resourceResult.value?.list || [];
        if (requestsAllServerResources) {
          updateBackendResourcePage(
            resourceResult.value,
            requestedBackendPage,
            requestedBackendPageSize
          );
        } else {
          serverResources.value = loadedServerResources;
        }
        resources.value = loadedServerResources;
      } else {
        resourceLoadError.value = assistantApiErrorMessage(
          resourceResult.reason,
          "资源列表加载失败，请重试"
        );
      }
    }
    if (taskResult.status === "fulfilled") {
      mergeServerTasks(taskResult.value.list || []);
    } else {
      taskLoadError.value = assistantApiErrorMessage(
        taskResult.reason,
        "任务列表加载失败，请重试"
      );
    }
    scheduleTaskPolling();
    if (
      taskResult.status === "rejected" ||
      resourceResult.status === "rejected"
    ) {
      console.warn("[AiResourceGeneration] 部分学习资源接口加载失败", {
        taskError:
          taskResult.status === "rejected" ? taskResult.reason : undefined,
        resourceError:
          resourceResult.status === "rejected"
            ? resourceResult.reason
            : undefined
      });
    }
  } catch (error: any) {
    console.error("[AiResourceGeneration] 学习资源加载失败:", error);
    const message = assistantApiErrorMessage(error, "学习资源加载失败，请重试");
    taskLoadError.value ||= message;
    resourceLoadError.value ||= message;
  } finally {
    loading.value = false;
  }
};

const loadTaskActivity = async (taskId: string) => {
  if (isBackendResourceTask(taskId)) {
    taskActivityLoadError.value = "";
    taskLogs.value = [];
    taskTrace.value = [];
    return;
  }
  taskActivityLoadError.value = "";
  try {
    const [logsResult, traceResult] = await Promise.allSettled([
      listAssistantResourceTaskLogs(taskId).then(response =>
        unwrapAssistantResponseData<AssistantListResourceTaskLogsResp>(
          response,
          "加载任务日志",
          { requireList: true }
        )
      ),
      getAssistantTaskTrace(taskId).then(response =>
        unwrapAssistantResponseData<AssistantTaskTraceResp>(
          response,
          "加载任务轨迹",
          { requireTrace: true }
        )
      )
    ]);
    if (selectedTaskId.value !== taskId) return;
    if (logsResult.status === "fulfilled") {
      taskLogs.value = logsResult.value.list || [];
    }
    if (traceResult.status === "fulfilled") {
      taskTrace.value = traceResult.value.trace || [];
    }
    if (logsResult.status === "rejected" || traceResult.status === "rejected") {
      const reason =
        logsResult.status === "rejected"
          ? logsResult.reason
          : traceResult.status === "rejected"
            ? traceResult.reason
            : undefined;
      taskActivityLoadError.value = assistantApiErrorMessage(
        reason,
        "生成记录加载失败，请重试"
      );
    }
  } catch (error: any) {
    console.error("[AiResourceGeneration] 任务日志加载失败:", error);
    if (selectedTaskId.value === taskId) {
      taskActivityLoadError.value = assistantApiErrorMessage(
        error,
        "生成记录加载失败，请重试"
      );
    }
  }
};

const loadTaskResources = async (taskId: string) => {
  if (isBackendResourceTask(taskId)) {
    const requestSequence = ++resourceRequestSequence;
    const requestedPage = backendResourcePage.value;
    const requestedPageSize = backendResourcePageSize.value;
    resourceLoading.value = true;
    resourceLoadError.value = "";
    resources.value = backendPageResources.value;
    try {
      const data = await listBackendResourcePage(
        resourceQuery(""),
        requestedPage,
        requestedPageSize
      );
      if (
        requestSequence === resourceRequestSequence &&
        selectedTaskId.value === taskId
      ) {
        updateBackendResourcePage(data, requestedPage, requestedPageSize);
        resources.value = backendPageResources.value;
        resourceLoadError.value = "";
      }
    } catch (error) {
      if (
        requestSequence === resourceRequestSequence &&
        selectedTaskId.value === taskId
      ) {
        resources.value = backendPageResources.value;
        resourceLoadError.value = assistantApiErrorMessage(
          error,
          "资源列表加载失败，请重试"
        );
      }
      console.warn("[AiResourceGeneration] 后端资源列表加载失败:", error);
    } finally {
      if (requestSequence === resourceRequestSequence) {
        resourceLoading.value = false;
      }
    }
    return;
  }
  const requestSequence = ++resourceRequestSequence;
  resourceLoading.value = true;
  resourceLoadError.value = "";
  try {
    const response = await listAssistantResources(resourceQuery(taskId));
    const data = unwrapAssistantResponseData<AssistantListResourcesResp>(
      response,
      "加载任务资源",
      { requireList: true }
    );
    if (
      requestSequence === resourceRequestSequence &&
      selectedTaskId.value === taskId
    ) {
      serverResources.value = data.list || [];
      resources.value = serverResources.value;
      resourceLoadError.value = "";
    }
  } catch (error: any) {
    if (
      requestSequence === resourceRequestSequence &&
      selectedTaskId.value === taskId
    ) {
      resourceLoadError.value = assistantApiErrorMessage(
        error,
        "任务资源加载失败，请重试"
      );
    }
  } finally {
    if (requestSequence === resourceRequestSequence) {
      resourceLoading.value = false;
    }
  }
};

const retryResourceList = () => {
  if (!ensureCourseContext()) return;
  const taskId = selectedTaskId.value || backendResourceTaskId;
  void loadTaskResources(taskId);
};

const retryTaskActivity = () => {
  if (!selectedTaskId.value) return;
  void loadTaskActivity(selectedTaskId.value);
};

const selectTask = async (taskId: string) => {
  selectedTaskId.value = taskId;
  taskLogs.value = [];
  taskTrace.value = [];
  taskActivityLoadError.value = "";
  resourceLoadError.value = "";
  resourceType.value = "";
  taskActivityExpanded.value = true;
  if (isBackendResourceTask(taskId)) {
    resources.value = backendPageResources.value;
  } else {
    resources.value = [];
  }

  await Promise.all([loadTaskActivity(taskId), loadTaskResources(taskId)]);
};

const stopTaskPolling = () => {
  if (taskPollingTimer) window.clearTimeout(taskPollingTimer);
  taskPollingTimer = undefined;
};

const upsertTask = (task: AssistantResourceTaskItem) => {
  const index = tasks.value.findIndex(item => item.task_id === task.task_id);
  if (index >= 0) {
    tasks.value[index] = { ...tasks.value[index], ...task };
  } else {
    tasks.value = [task, ...tasks.value];
  }
  tasks.value = orderTasks(tasks.value);
};

const createBackendResourceTask = (): AssistantResourceTaskItem => {
  const resourceTypes = Array.from(
    new Set(
      backendPageResources.value
        .map(resource => resource.resource_type)
        .filter((type): type is string => Boolean(type))
    )
  );
  const timestamp =
    backendPageResources.value[0]?.updated_at ||
    backendPageResources.value[0]?.created_at ||
    "";
  const resourceCount = Math.max(
    backendResourceTotal.value,
    backendPageResources.value.length
  );
  return {
    task_id: backendResourceTaskId,
    status: "completed",
    stage: "stored",
    progress: 100,
    health_summary: resourceCount
      ? `后端共 ${resourceCount} 项资源`
      : "正在读取后端已入库资源",
    course_id: props.courseId,
    target_student_id: props.targetStudentId,
    resource_types: resourceTypes,
    created_at: timestamp,
    updated_at: timestamp
  };
};

const orderTasks = (taskList: AssistantResourceTaskItem[]) => {
  const backendTask = taskList.find(task =>
    isBackendResourceTask(task.task_id)
  );
  const otherTasks = taskList.filter(
    task => !isBackendResourceTask(task.task_id)
  );
  return backendTask ? [backendTask, ...otherTasks] : otherTasks;
};

const scheduleTaskPolling = () => {
  stopTaskPolling();
  if (!tasks.value.some(task => !isTerminalTask(task.status))) return;
  const delay = document.hidden ? 10000 : 2000;
  taskPollingTimer = window.setTimeout(() => {
    taskPollingTimer = undefined;
    void refreshPendingTasks();
  }, delay);
};

const refreshPendingTasks = async () => {
  if (taskPollingInFlight || !hasRequiredContext.value) return;
  const pendingTasks = tasks.value.filter(task => !isTerminalTask(task.status));
  if (!pendingTasks.length) {
    stopTaskPolling();
    return;
  }

  taskPollingInFlight = true;
  let hasNewTerminalTask = false;
  try {
    const results = await Promise.allSettled(
      pendingTasks.map(task => getAssistantResourceTask(task.task_id))
    );
    results.forEach((result, index) => {
      if (result.status !== "fulfilled" || !result.value.data.task) return;
      const previous = pendingTasks[index];
      const latest = result.value.data.task;
      upsertTask(latest);
      if (!isTerminalTask(previous.status) && isTerminalTask(latest.status)) {
        hasNewTerminalTask = true;
      }
      if (selectedTaskId.value === latest.task_id) {
        void loadTaskActivity(latest.task_id);
      }
    });
  } catch (error) {
    console.warn("[AiResourceGeneration] 任务状态刷新失败:", error);
  } finally {
    taskPollingInFlight = false;
  }

  if (hasNewTerminalTask) void loadResources();
  else scheduleTaskPolling();
};

const handleCreateTask = async () => {
  if (creating.value || !ensureCourseContext()) return;
  creating.value = true;
  try {
    const requestedResourceTypes = (props.resourceTypes || [])
      .map(item => item.key)
      .filter(Boolean);
    const response = await createAssistantResourceTask({
      course_id: props.courseId,
      target_student_id: props.targetStudentId,
      resource_types: requestedResourceTypes.length
        ? requestedResourceTypes
        : [
            "explanation_doc",
            "mind_map",
            "courseware_ppt",
            "exercise_set",
            "extended_reading",
            "html_animation",
            "coding_practice_case"
          ],
      prompt: "请围绕当前课程薄弱点生成一组个性化学习资源"
    });
    const data = unwrapAssistantResponseData<AssistantCreateResourceTaskResp>(
      response,
      "创建资源任务",
      { requireAccepted: true, requireTask: true }
    );
    upsertTask(data.task!);
    ElMessage.success(data.message || "资源生成任务已创建");
    await loadResources();
    upsertTask(data.task!);
    await selectTask(data.task!.task_id);
  } catch (error: any) {
    console.error("[AiResourceGeneration] 创建资源任务失败:", error);
    ElMessage.error(assistantApiErrorMessage(error, "创建资源任务失败"));
  } finally {
    creating.value = false;
  }
};

const openResourceDetail = (resource: AssistantResourceSummary) => {
  selectedResource.value = resource;
  editForm.value = {
    title: resource.title || "",
    summary: resource.summary || "",
    description: resource.description || "",
    content_format: resource.content_format || "markdown",
    content_body: resource.content_body || "",
    knowledge_point_id: resource.knowledge_point_id || "",
    knowledge_relevance: resource.knowledge_relevance || 0,
    edit_reason: ""
  };
  editMode.value = false;
  resourceVersions.value = [];
  detailActivePanels.value = ["summary", "feedback"];
  detailVisible.value = true;
  resourceOpenedAt.value = Date.now();
  resourceFeedbackScore.value = 5;
  resourceFeedbackText.value = "";
  void reportResourceUsage(resource, "open", {
    metadata: {
      content_format: resource.content_format || "",
      html_animation_status: resource.html_animation_status || ""
    }
  });
  void loadResourceVersions(resource.resource_id);
};

const handleResourceDialogClosed = () => {
  const resource = selectedResource.value;
  if (resource && resourceOpenedAt.value) {
    void reportResourceUsage(resource, "heartbeat", {
      dwell_ms: Math.max(Date.now() - resourceOpenedAt.value, 0),
      progress_percent: 100
    });
  }
  selectedResource.value = null;
  resourceOpenedAt.value = 0;
};

const downloadGeneratedResource = async (
  resource: AssistantResourceSummary
) => {
  const previewResource = mapAssistantResourcePreview(resource);
  if (!previewResource.downloadUrl) {
    ElMessage.warning("当前资源暂无可下载文件");
    return;
  }
  try {
    await downloadPlatformResource(previewResource);
    void reportResourceUsage(resource, "view", {
      metadata: { action: "download", target: previewResource.downloadUrl }
    });
  } catch (error) {
    console.warn("[AiResourceGeneration] 资源下载失败:", error);
    ElMessage.error("文件下载失败，请检查资源权限或下载地址");
  }
};

const openPlatformPreview = async (resource = selectedResource.value) => {
  if (!resource) return;
  previewPreparing.value = true;
  let resolvedResource = resource;
  try {
    if (resource.resource_id) {
      const { data } = await getAssistantResource(resource.resource_id, {
        course_id: props.courseId,
        target_student_id: props.targetStudentId
      });
      if (data.resource) {
        resolvedResource = { ...resource, ...data.resource };
        syncSelectedResource(resolvedResource);
      }
    }
  } catch (error) {
    console.warn("[AiResourceGeneration] 预览详情补全失败:", error);
  } finally {
    previewPreparing.value = false;
  }

  const previewResource = mapAssistantResourcePreview(resolvedResource);
  if (!hasPlatformResourcePreview(previewResource)) {
    ElMessage.warning("该资源暂未提供可预览内容");
    return;
  }
  platformPreviewResource.value = previewResource;
  platformPreviewVisible.value = true;
  void reportResourceUsage(resolvedResource, "view", {
    metadata: {
      action: "platform_preview",
      content_format: resolvedResource.content_format || ""
    }
  });
};

const loadResourceVersions = async (resourceId: string) => {
  try {
    const { data } = await listAssistantResourceVersions(resourceId);
    resourceVersions.value = data.list || [];
  } catch (error) {
    console.warn("[AiResourceGeneration] 资源版本加载失败:", error);
  }
};

const handleCompleteResource = async () => {
  if (!selectedResource.value) return;
  if (completeSubmitting.value || !ensureCourseContext()) return;
  completeSubmitting.value = true;
  try {
    await submitResourceUsage(selectedResource.value, "complete", {
      completed: true,
      progress_percent: 100
    });
    ElMessage.success("已记录资源完成状态");
  } catch (error) {
    console.error("[AiResourceGeneration] 资源完成状态上报失败:", error);
    ElMessage.error(
      assistantApiErrorMessage(error, "完成状态记录失败，请重试")
    );
  } finally {
    completeSubmitting.value = false;
  }
};

const handleSubmitFeedback = async () => {
  if (!selectedResource.value) return;
  if (feedbackSubmitting.value || !ensureCourseContext()) return;
  feedbackSubmitting.value = true;
  try {
    await submitResourceUsage(selectedResource.value, "feedback", {
      feedback_score: resourceFeedbackScore.value,
      feedback_text: resourceFeedbackText.value.trim()
    });
    ElMessage.success("资源反馈已提交");
    resourceFeedbackText.value = "";
  } catch (error) {
    console.error("[AiResourceGeneration] 资源反馈上报失败:", error);
    ElMessage.error(
      assistantApiErrorMessage(error, "资源反馈提交失败，请重试")
    );
  } finally {
    feedbackSubmitting.value = false;
  }
};

const syncSelectedResource = (resource?: AssistantResourceSummary) => {
  if (!resource) return;
  selectedResource.value = resource;
  const index = resources.value.findIndex(
    item => item.resource_id === resource.resource_id
  );
  if (index >= 0) resources.value[index] = resource;
};

const handleSaveResource = async () => {
  if (!selectedResource.value) return;
  if (governanceSubmitting.value || !ensureCourseContext()) return;
  governanceSubmitting.value = true;
  try {
    const response = await updateAssistantResource(
      selectedResource.value.resource_id,
      {
        ...editForm.value,
        knowledge_relevance: Number(editForm.value.knowledge_relevance || 0)
      }
    );
    const data = unwrapAssistantResponseData<AssistantResourceMutationResp>(
      response,
      "保存资源",
      { requireResource: true }
    );
    syncSelectedResource(data.resource);
    editMode.value = false;
    ElMessage.success(data.message || "资源已保存为草稿，等待审核");
    await loadResourceVersions(selectedResource.value.resource_id);
  } catch (error: any) {
    console.error("[AiResourceGeneration] 资源保存失败:", error);
    ElMessage.error(assistantApiErrorMessage(error, "资源保存失败"));
  } finally {
    governanceSubmitting.value = false;
  }
};

const handleReviewResource = async (reviewStatus: string) => {
  if (!selectedResource.value) return;
  if (governanceSubmitting.value || !ensureCourseContext()) return;
  governanceSubmitting.value = true;
  try {
    const response = await reviewAssistantResource(
      selectedResource.value.resource_id,
      {
        review_status: reviewStatus,
        review_comment:
          reviewStatus === "approved"
            ? "内容准确，可以发布"
            : "请根据教师意见调整"
      }
    );
    const data = unwrapAssistantResponseData<AssistantResourceMutationResp>(
      response,
      "审核资源",
      { requireResource: true }
    );
    syncSelectedResource(data.resource);
    ElMessage.success(data.message || "资源审核状态已更新");
    await loadResources();
  } catch (error: any) {
    console.error("[AiResourceGeneration] 资源审核失败:", error);
    ElMessage.error(assistantApiErrorMessage(error, "资源审核失败"));
  } finally {
    governanceSubmitting.value = false;
  }
};

const handlePublishResource = async () => {
  if (!selectedResource.value) return;
  if (governanceSubmitting.value || !ensureCourseContext()) return;
  governanceSubmitting.value = true;
  try {
    const response = await publishAssistantResource(
      selectedResource.value.resource_id
    );
    const data = unwrapAssistantResponseData<AssistantResourceMutationResp>(
      response,
      "发布资源",
      { requireResource: true }
    );
    syncSelectedResource(data.resource);
    const status = data.resource?.status || data.status;
    if (status === "degraded" || data.resource?.storage_status === "degraded") {
      ElMessage.warning(data.message || "资源已发布但存在降级状态");
    } else {
      ElMessage.success(data.message || "资源已发布");
    }
    await loadResources();
  } catch (error: any) {
    console.error("[AiResourceGeneration] 资源发布失败:", error);
    ElMessage.error(assistantApiErrorMessage(error, "资源发布失败"));
  } finally {
    governanceSubmitting.value = false;
  }
};

const handleDeleteResource = async () => {
  const resource = selectedResource.value;
  if (!resource) return;
  if (
    deleteSubmitting.value ||
    governanceSubmitting.value ||
    !ensureCourseContext()
  )
    return;
  try {
    await ElMessageBox.confirm(
      `删除后将无法继续预览或发布“${resource.title || "该资源"}”，确认删除吗？`,
      "确认删除资源",
      {
        type: "warning",
        confirmButtonText: "确认删除",
        cancelButtonText: "取消",
        distinguishCancelAndClose: true
      }
    );
  } catch {
    return;
  }
  if (deleteSubmitting.value) return;
  deleteSubmitting.value = true;
  try {
    const response = await deleteAssistantResource(resource.resource_id);
    const data = unwrapAssistantResponseData<AssistantResourceMutationResp>(
      response,
      "删除资源"
    );
    ElMessage.success(data.message || "资源已删除");
    detailVisible.value = false;
    await loadResources();
  } catch (error: any) {
    console.error("[AiResourceGeneration] 资源删除失败:", error);
    ElMessage.error(assistantApiErrorMessage(error, "资源删除失败"));
  } finally {
    deleteSubmitting.value = false;
  }
};

onMounted(() => {
  upsertTask(createBackendResourceTask());
  selectedTaskId.value = backendResourceTaskId;
  void loadResources();
});
onBeforeUnmount(() => {
  stopTaskPolling();
});
watch(
  () => [props.courseId, props.courseName, props.targetStudentId],
  () => {
    stopTaskPolling();
    resetResourceSelection();
    upsertTask(createBackendResourceTask());
    selectedTaskId.value = backendResourceTaskId;
    void loadResources();
  }
);
</script>

<template>
  <div
    v-loading="loading"
    class="resource-workbench h-full flex flex-col bg-transparent overflow-hidden"
  >
    <div class="resource-shell">
      <div class="resource-toolbar">
        <div class="resource-toolbar__title">
          <h2>资源生成工作台</h2>
          <p v-if="selectedTaskLabel" class="resource-toolbar__scope">
            当前展示：{{ selectedTaskLabel }} 的生成资源
          </p>
        </div>

        <div class="resource-toolbar__controls">
          <el-input
            v-model="searchQuery"
            placeholder="搜索资源标题、摘要或建议"
            class="resource-search"
            :prefix-icon="Search"
          />
          <el-select
            v-model="resourceType"
            placeholder="资源类型"
            class="resource-type-select"
            clearable
          >
            <el-option label="全部" value="" />
            <el-option
              v-for="type in resourceTypeOptions"
              :key="type"
              :label="resourceTypeText(type)"
              :value="type"
            />
          </el-select>
          <el-button plain :icon="Refresh" @click="loadResources">
            刷新
          </el-button>
          <el-button
            type="primary"
            :loading="creating"
            :disabled="!hasRequiredContext"
            @click="handleCreateTask"
          >
            <template #icon>
              <el-icon><MagicStick /></el-icon>
            </template>
            新建生成任务
          </el-button>
        </div>
      </div>

      <div class="resource-main">
        <div class="workbench-panel task-panel">
          <div class="workbench-panel__header">
            <span>任务中心</span>
            <el-tag size="small" effect="plain"
              >{{ tasks.length }} 个任务</el-tag
            >
          </div>
          <div class="flex-1 overflow-y-auto p-3 space-y-2.5">
            <div
              v-if="taskLoadError"
              class="load-error-state"
              role="alert"
              aria-live="polite"
            >
              <p>{{ taskLoadError }}</p>
              <el-button
                size="small"
                plain
                :loading="taskRetrying"
                @click="retryTaskList"
              >
                重试任务列表
              </el-button>
            </div>
            <div
              v-for="task in tasks"
              :key="task.task_id"
              class="task-card"
              :class="selectedTaskId === task.task_id ? 'is-active' : ''"
              role="button"
              tabindex="0"
              :aria-pressed="selectedTaskId === task.task_id"
              @click="selectTask(task.task_id)"
              @keydown.enter.prevent="selectTask(task.task_id)"
              @keydown.space.prevent="selectTask(task.task_id)"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="font-semibold text-base text-gray-800 truncate">
                  {{ taskTitle(task) }}
                </span>
                <el-tag
                  size="small"
                  :type="tagType(task.status)"
                  effect="plain"
                >
                  {{ statusText(task.status) }}
                </el-tag>
              </div>
              <el-progress
                class="resource-progress mt-3"
                :percentage="statusProgress(task)"
                :status="taskProgressStatus(task)"
                :stroke-width="8"
                striped
                striped-flow
                :duration="14"
              />
              <p v-if="task.error_message" class="mt-2 text-xs text-red-500">
                {{ task.error_message }}
              </p>
              <p
                v-else-if="task.health_summary"
                class="mt-2 line-clamp-2 text-xs leading-5 text-gray-500"
              >
                {{ task.health_summary }}
              </p>
              <div
                v-if="
                  task.incomplete_resource_count || task.failed_resource_count
                "
                class="mt-2 flex flex-wrap gap-1.5"
              >
                <el-tag
                  v-if="task.incomplete_resource_count"
                  size="small"
                  type="warning"
                  effect="plain"
                >
                  {{ task.incomplete_resource_count }} 个不完整
                </el-tag>
                <el-tag
                  v-if="task.failed_resource_count"
                  size="small"
                  type="danger"
                  effect="plain"
                >
                  {{ task.failed_resource_count }} 个失败
                </el-tag>
              </div>
              <div
                v-if="task.warning_flags?.length"
                class="mt-2 flex flex-wrap gap-1.5"
              >
                <el-tag
                  v-for="flag in task.warning_flags.slice(0, 4)"
                  :key="flag"
                  size="small"
                  type="warning"
                  effect="plain"
                  class="!rounded-md"
                >
                  {{ warningFlagText(flag) || flag }}
                </el-tag>
                <el-tag
                  v-if="task.warning_flags.length > 4"
                  size="small"
                  type="warning"
                  effect="plain"
                  class="!rounded-md"
                >
                  +{{ task.warning_flags.length - 4 }}
                </el-tag>
              </div>
              <div class="mt-3 flex flex-wrap gap-1.5">
                <el-tag
                  v-for="type in (task.resource_types || []).slice(0, 2)"
                  :key="type"
                  size="small"
                  effect="plain"
                  class="!rounded-md"
                >
                  {{ resourceTypeText(type) }}
                </el-tag>
                <el-tag
                  v-if="(task.resource_types || []).length > 2"
                  size="small"
                  effect="plain"
                  class="!rounded-md"
                >
                  +{{ (task.resource_types || []).length - 2 }}
                </el-tag>
              </div>
            </div>
            <el-empty
              v-if="!tasks.length && !taskLoadError"
              description="暂无生成任务"
            />
          </div>
        </div>

        <div
          v-loading="resourceLoading"
          class="min-h-0 overflow-y-auto"
          element-loading-text="正在加载任务资源"
        >
          <div
            v-if="resourceLoadError"
            class="load-error-state resource-load-error"
            role="alert"
            aria-live="polite"
          >
            <p>{{ resourceLoadError }}</p>
            <el-button
              size="small"
              plain
              :loading="resourceLoading"
              @click="retryResourceList"
            >
              重试资源列表
            </el-button>
          </div>
          <section
            v-if="selectedTaskId && !isBackendResourceTask(selectedTaskId)"
            class="task-activity-panel"
          >
            <button
              type="button"
              class="task-activity-panel__header"
              :aria-expanded="taskActivityExpanded"
              @click="taskActivityExpanded = !taskActivityExpanded"
            >
              <span class="task-activity-panel__title">
                <strong>生成记录</strong>
                <small v-if="taskTrace.length">
                  {{ completedTraceCount }}/{{ taskTrace.length }} 节点完成
                </small>
              </span>
              <span class="task-activity-panel__latest">
                <template v-if="latestTaskTrace">
                  {{
                    agentText(
                      latestTaskTrace.agent_label ||
                        latestTaskTrace.agent ||
                        latestTaskTrace.agent_key
                    )
                  }}
                  ·
                  {{
                    latestTaskTrace.summary || statusText(latestTaskTrace.stage)
                  }}
                </template>
                <template v-else>等待 Agent 开始处理</template>
              </span>
              <el-icon
                class="task-activity-panel__arrow"
                :class="taskActivityExpanded ? 'is-expanded' : ''"
              >
                <ArrowDown />
              </el-icon>
            </button>
            <div
              v-show="taskActivityExpanded"
              class="task-activity-panel__body"
            >
              <div
                v-if="taskActivityLoadError"
                class="load-error-state task-activity-load-error"
                role="alert"
                aria-live="polite"
              >
                <p>{{ taskActivityLoadError }}</p>
                <el-button size="small" plain @click="retryTaskActivity">
                  重试生成记录
                </el-button>
              </div>
              <div v-if="taskTrace.length" class="agent-trace-list">
                <div
                  v-for="(step, index) in taskTrace"
                  :key="`${step.agent_key || step.agent}-${step.stage}-${index}`"
                  class="agent-trace-row"
                >
                  <span
                    class="agent-trace-row__dot"
                    :class="`is-${step.status}`"
                    aria-hidden="true"
                  />
                  <div class="min-w-0">
                    <div class="agent-trace-row__meta">
                      <strong>
                        {{
                          agentText(
                            step.agent_label || step.agent || step.agent_key
                          )
                        }}
                      </strong>
                      <el-tag
                        size="small"
                        :type="tagType(step.status)"
                        effect="plain"
                      >
                        {{ statusText(step.status) }}
                      </el-tag>
                    </div>
                    <p>
                      {{
                        step.degraded_reason ||
                        step.summary ||
                        statusText(step.stage)
                      }}
                    </p>
                  </div>
                  <time>{{ step.finished_at || step.started_at || "" }}</time>
                </div>
              </div>
              <p
                v-else-if="!taskActivityLoadError"
                class="task-activity-panel__empty"
              >
                当前任务尚未产生调度记录
              </p>
            </div>
          </section>
          <div
            v-if="filteredResources.length"
            class="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 auto-rows-max"
          >
            <article
              v-for="res in filteredResources"
              :key="res.resource_id"
              class="resource-card"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <el-tag
                    size="small"
                    effect="plain"
                    :type="tagType(res.status)"
                  >
                    {{ resourceTypeText(res.resource_type) }}
                  </el-tag>
                  <h3
                    class="mt-3 text-lg font-semibold text-gray-800 line-clamp-2"
                  >
                    {{ res.title }}
                  </h3>
                </div>
                <el-tag size="small" :type="tagType(res.status)" effect="plain">
                  {{ statusText(res.status) }}
                </el-tag>
              </div>

              <p class="mt-3 text-sm text-gray-600 leading-6 line-clamp-2">
                {{ res.summary || res.recommendation || "暂无摘要" }}
              </p>

              <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div class="resource-metric">
                  <span>质量</span>
                  <b>{{ qualityLabel(res.quality_score) || "暂无" }}</b>
                </div>
                <div class="resource-metric">
                  <span>格式</span>
                  <b>{{ formatText(res.content_format) }}</b>
                </div>
              </div>

              <div class="resource-state-group">
                <div class="resource-state-tags">
                  <el-tag
                    v-if="res.review_status"
                    size="small"
                    :type="tagType(res.review_status)"
                    effect="plain"
                  >
                    人工审核 {{ statusText(res.review_status) }}
                  </el-tag>
                  <el-tag
                    v-if="res.safety_status"
                    size="small"
                    :type="res.safety_status === 'safe' ? 'success' : 'warning'"
                    effect="plain"
                  >
                    科学审查 {{ statusText(res.safety_status) }}
                  </el-tag>
                  <el-tag v-if="res.version_no" size="small" effect="plain">
                    v{{ res.version_no }}
                  </el-tag>
                  <el-tag v-if="res.variant_label" size="small" effect="plain">
                    {{ res.variant_label }}
                  </el-tag>
                </div>

                <p
                  v-if="
                    (res.html_animation_status &&
                      res.html_animation_status !== 'ready') ||
                    showAsIncomplete(res.storage_status)
                  "
                  class="resource-state-alert line-clamp-2"
                >
                  {{
                    res.safety_summary ||
                    res.html_animation_message ||
                    res.html_animation_error ||
                    res.storage_error ||
                    "资源存在处理中或降级状态"
                  }}
                </p>
              </div>
              <div
                class="mt-5 flex items-center justify-between pt-4 border-t border-gray-100"
              >
                <span class="text-sm text-gray-400">
                  {{ res.updated_at || "暂无更新时间" }}
                </span>
                <div class="flex items-center gap-2">
                  <el-button
                    size="small"
                    type="primary"
                    plain
                    @click="openResourceDetail(res)"
                  >
                    详情
                  </el-button>
                  <el-button
                    size="small"
                    plain
                    :icon="Download"
                    @click="downloadGeneratedResource(res)"
                  >
                    下载
                  </el-button>
                </div>
              </div>
            </article>
          </div>
          <el-empty
            v-else-if="!resourceLoadError"
            :description="resourceEmptyDescription"
          />
          <div
            v-if="isBackendResourceTask(selectedTaskId) && backendResourceTotal"
            class="resource-pagination"
          >
            <el-pagination
              :current-page="backendResourcePage"
              :page-size="backendResourcePageSize"
              :page-sizes="backendResourcePageSizes"
              :total="backendResourceTotal"
              :pager-count="7"
              layout="total, sizes, prev, pager, next, jumper"
              background
              @current-change="handleBackendResourcePageChange"
              @size-change="handleBackendResourcePageSizeChange"
            />
          </div>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="detailVisible"
      width="min(820px, calc(100vw - 24px))"
      destroy-on-close
      class="assistant-resource-dialog"
      modal-class="assistant-resource-dialog-mask"
      @closed="handleResourceDialogClosed"
    >
      <template #header>
        <div class="pr-8">
          <div class="text-base font-bold text-gray-800">
            {{ selectedResource?.title || "资源详情" }}
          </div>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <el-tag size="small" effect="plain">
              {{ resourceTypeText(selectedResource?.resource_type) }}
            </el-tag>
            <el-tag
              v-if="selectedResource?.content_format"
              size="small"
              effect="plain"
            >
              {{ formatText(selectedResource.content_format) }}
            </el-tag>
            <el-tag
              v-if="selectedResource?.quality_score !== undefined"
              size="small"
              type="success"
              effect="plain"
            >
              质量 {{ qualityLabel(selectedResource.quality_score) }}
            </el-tag>
            <el-tag
              v-if="selectedResource?.safety_status"
              size="small"
              :type="
                selectedResource.safety_status === 'safe'
                  ? 'success'
                  : 'warning'
              "
              effect="plain"
            >
              科学审查 {{ statusText(selectedResource.safety_status) }}
            </el-tag>
            <el-tag
              v-if="selectedResource?.review_status"
              size="small"
              :type="tagType(selectedResource.review_status)"
              effect="plain"
            >
              人工审核 {{ statusText(selectedResource.review_status) }}
            </el-tag>
            <el-tag
              v-if="selectedResource?.version_no"
              size="small"
              effect="plain"
            >
              v{{ selectedResource.version_no }}
            </el-tag>
            <el-tag
              v-if="selectedResource?.variant_label"
              size="small"
              effect="plain"
            >
              {{ selectedResource.variant_label }}
            </el-tag>
          </div>
        </div>
      </template>

      <div v-if="selectedResource" class="resource-detail">
        <el-collapse v-model="detailActivePanels">
          <el-collapse-item title="资源摘要" name="summary">
            <p class="text-base text-gray-700 leading-7">
              {{
                selectedResource.description ||
                selectedResource.summary ||
                selectedResource.recommendation ||
                "暂无摘要"
              }}
            </p>
            <div class="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div class="detail-metric">
                <span>知识点</span>
                <b>{{ selectedResource.knowledge_point_id || "未关联" }}</b>
              </div>
              <div class="detail-metric">
                <span>关联度</span>
                <b>{{
                  qualityLabel(selectedResource.knowledge_relevance) || "暂无"
                }}</b>
              </div>
              <div class="detail-metric">
                <span>更新时间</span>
                <b>{{ selectedResource.updated_at || "暂无" }}</b>
              </div>
              <div class="detail-metric">
                <span>对象存储</span>
                <b>{{ statusText(selectedResource.storage_status) }}</b>
              </div>
            </div>
          </el-collapse-item>

          <el-collapse-item v-if="editMode" title="编辑草稿" name="edit">
            <div class="space-y-3">
              <el-input v-model="editForm.title" placeholder="资源标题" />
              <el-input v-model="editForm.summary" placeholder="资源摘要" />
              <el-input
                v-model="editForm.description"
                type="textarea"
                :rows="2"
                placeholder="资源说明"
              />
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <el-input
                  v-model="editForm.content_format"
                  placeholder="正文格式"
                />
                <el-input
                  v-model="editForm.knowledge_point_id"
                  placeholder="知识点标识"
                />
                <el-input-number
                  v-model="editForm.knowledge_relevance"
                  :min="0"
                  :max="1"
                  :step="0.05"
                  class="!w-full"
                />
              </div>
              <el-input
                v-model="editForm.content_body"
                type="textarea"
                :rows="8"
                placeholder="资源正文"
              />
              <el-input v-model="editForm.edit_reason" placeholder="编辑原因" />
              <div class="flex justify-end gap-2">
                <el-button @click="editMode = false">取消</el-button>
                <el-button
                  type="primary"
                  :loading="governanceSubmitting"
                  @click="handleSaveResource"
                >
                  保存草稿
                </el-button>
              </div>
            </div>
          </el-collapse-item>

          <el-collapse-item
            v-if="hasInlinePreview(selectedResource)"
            title="正文预览"
            name="preview"
          >
            <pre class="content-preview">{{
              selectedResource.content_body
            }}</pre>
          </el-collapse-item>

          <el-collapse-item
            v-if="
              incompleteStates.length ||
              selectedResource.html_animation_task_id ||
              selectedResource.object_key
            "
            title="状态与存储"
            name="status"
          >
            <div v-if="incompleteStates.length" class="flex flex-wrap gap-2">
              <el-tag
                v-for="item in incompleteStates"
                :key="`${item.label}-${item.value}`"
                size="small"
                :type="showAsIncomplete(item.value) ? 'warning' : 'success'"
                effect="plain"
              >
                {{ item.label }}：{{ statusText(item.value) }}
              </el-tag>
            </div>
            <div
              v-if="selectedResource.html_animation_task_id"
              class="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700"
            >
              <div class="font-semibold">
                动画任务：{{
                  statusText(selectedResource.html_animation_status)
                }}
              </div>
              <div class="mt-1 leading-6">
                {{
                  selectedResource.html_animation_message ||
                  selectedResource.html_animation_error ||
                  "暂无状态说明"
                }}
              </div>
              <div class="mt-2 font-mono text-xs">
                {{ selectedResource.html_animation_task_id }}
              </div>
            </div>
            <div
              v-if="selectedResource.object_key"
              class="mt-4 text-sm text-gray-500"
            >
              存储标识：{{ selectedResource.object_key }}
            </div>
          </el-collapse-item>

          <el-collapse-item
            v-if="
              selectedResource.safety_summary ||
              selectedResource.safety_flags?.length
            "
            title="安全与引用状态"
            name="safety"
          >
            <p
              v-if="selectedResource.safety_summary"
              class="text-sm leading-7 text-gray-600"
            >
              {{ selectedResource.safety_summary }}
            </p>
            <div
              v-if="selectedResource.safety_flags?.length"
              class="mt-3 flex flex-wrap gap-2"
            >
              <el-tag
                v-for="flag in selectedResource.safety_flags"
                :key="flag"
                size="small"
                type="warning"
                effect="plain"
              >
                {{ flag }}
              </el-tag>
            </div>
          </el-collapse-item>

          <el-collapse-item
            v-if="selectedResource.citations?.length"
            title="引用来源"
            name="citations"
          >
            <div class="space-y-3">
              <div
                v-for="(citation, index) in selectedResource.citations"
                :key="`${citation.title || citation.url || index}`"
                class="rounded-lg border border-gray-100 px-4 py-3 text-sm text-gray-600"
              >
                <div class="font-semibold text-gray-700">
                  {{ citation.title || citation.source || `引用 ${index + 1}` }}
                </div>
                <div v-if="citation.snippet" class="mt-1 leading-7">
                  {{ citation.snippet }}
                </div>
                <a
                  v-if="citation.url"
                  :href="citation.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="mt-1 inline-block text-primary"
                >
                  {{ citation.url }}
                </a>
              </div>
            </div>
          </el-collapse-item>

          <el-collapse-item
            v-if="resourceVersions.length"
            title="资源版本"
            name="versions"
          >
            <div class="space-y-3">
              <div
                v-for="version in resourceVersions"
                :key="version.version_id"
                class="rounded-lg border border-gray-100 px-4 py-3 text-sm text-gray-600"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="font-semibold text-gray-700">
                    v{{ version.version_no }} · {{ version.title }}
                  </span>
                  <el-tag
                    v-if="version.safety_status"
                    size="small"
                    :type="
                      version.safety_status === 'safe' ? 'success' : 'warning'
                    "
                    effect="plain"
                  >
                    {{ statusText(version.safety_status) }}
                  </el-tag>
                </div>
                <p v-if="version.edit_reason" class="mt-1">
                  {{ version.edit_reason }}
                </p>
                <div class="mt-1 text-gray-400">
                  {{ version.created_at || "" }}
                </div>
              </div>
            </div>
          </el-collapse-item>

          <el-collapse-item title="资源反馈" name="feedback">
            <div class="flex items-center gap-3">
              <el-rate v-model="resourceFeedbackScore" :max="5" />
              <span class="text-sm text-gray-500"
                >{{ resourceFeedbackScore }} / 5</span
              >
            </div>
            <el-input
              v-model="resourceFeedbackText"
              class="mt-3"
              type="textarea"
              :rows="3"
              maxlength="300"
              show-word-limit
              placeholder="这份资源对你是否有帮助？"
            />
          </el-collapse-item>
        </el-collapse>
      </div>

      <template #footer>
        <div class="resource-dialog__footer">
          <div class="resource-dialog__action-group">
            <el-button
              :icon="CircleCheck"
              :loading="completeSubmitting"
              @click="handleCompleteResource"
            >
              标记完成
            </el-button>
            <el-button :icon="EditPen" plain @click="editMode = !editMode">
              编辑
            </el-button>
            <el-button
              :icon="Stamp"
              plain
              :loading="governanceSubmitting"
              @click="handleReviewResource('approved')"
            >
              审核通过
            </el-button>
            <el-button
              type="danger"
              plain
              :icon="Delete"
              :loading="deleteSubmitting"
              :disabled="governanceSubmitting"
              @click="handleDeleteResource"
            >
              删除
            </el-button>
          </div>
          <div class="resource-dialog__action-group">
            <el-button
              v-if="selectedResourceCanPreview"
              type="primary"
              plain
              :loading="previewPreparing"
              @click="openPlatformPreview()"
            >
              平台内预览
            </el-button>
            <el-button
              plain
              type="primary"
              :loading="governanceSubmitting"
              @click="handlePublishResource"
            >
              发布
            </el-button>
            <el-button
              type="primary"
              :loading="feedbackSubmitting"
              @click="handleSubmitFeedback"
            >
              提交反馈
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <PlatformResourcePreviewDialog
      v-model="platformPreviewVisible"
      :resource="platformPreviewResource"
    />
  </div>
</template>

<style scoped lang="scss">
.resource-workbench {
  --resource-radius: 12px;
  --resource-inner-radius: 8px;
  --resource-border: #e8edf5;
}

.resource-shell {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 16px;
  background: transparent;
}

.resource-main {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 16px;
  background: transparent;
}

.resource-toolbar {
  position: relative;
  display: flex;
  gap: 14px;
  align-items: center;
  justify-content: space-between;
  min-height: 58px;
  padding: 10px 12px 10px 16px;
  overflow: visible;
  background: #fff;
  border: 1px solid #e1e7ef;
  border-radius: var(--resource-radius);
  box-shadow: none;
  backdrop-filter: none;
}

@media (max-width: 1280px) {
  .resource-main {
    grid-template-columns: 1fr;
  }
}

.resource-toolbar::before {
  content: "";
  display: none;
}

.resource-toolbar__title,
.resource-toolbar__controls {
  position: relative;
  z-index: 1;
}

.resource-toolbar__title {
  min-width: 0;
}

.resource-toolbar__title h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.2;
  color: #2f3746;
}

.resource-toolbar__scope {
  margin: 4px 0 0;
  overflow: hidden;
  font-size: 13px;
  line-height: 18px;
  color: #64748b;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-toolbar__controls {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
}

.resource-search {
  width: min(360px, 38vw);
}

.resource-type-select {
  width: 150px;
}

.resource-toolbar :deep(.el-input__wrapper) {
  min-height: 36px;
  background: #fff;
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px #dce3ec !important;
}

.resource-toolbar :deep(.el-button) {
  border-radius: 8px;
}

.resource-card {
  background: #fff;
  border: 1px solid #e1e7ef;
  border-radius: var(--resource-inner-radius);
  box-shadow: none;
}

.workbench-panel {
  display: flex;
  min-height: 0;
  overflow: hidden;
  flex-direction: column;
  background: #f7f9fc;
  border: 1px solid #dbe5f1;
  border-radius: var(--resource-radius);
  box-shadow: none;
}

.task-panel {
  background: #f7f9fc;
}

.workbench-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  font-size: 15px;
  font-weight: 600;
  color: #2f3746;
  background: #fafcff;
  border-bottom: 1px solid #dbe5f1;
}

.task-card {
  padding: 12px;
  cursor: pointer;
  background: #fff;
  border: 1px solid #dce6f2;
  border-radius: var(--resource-inner-radius);
  transition:
    background-color 0.18s ease-out,
    border-color 0.18s ease-out;

  &:hover,
  &.is-active {
    background: #f4f8ff;
    border-color: #7aa7ed;
  }

  &:focus-visible {
    outline: 2px solid #5b8def;
    outline-offset: 2px;
  }
}

.resource-card {
  padding: 18px;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease;

  &:hover {
    background: #fbfdff;
    border-color: #9cbcf3;
    box-shadow: 0 12px 28px rgba(58, 94, 150, 0.08);
  }
}

.resource-metric,
.detail-metric {
  min-width: 0;
  padding: 12px;
  background: #f7f9fc;
  border-radius: 10px;

  span {
    display: block;
    font-size: 13px;
    color: #8a95a6;
  }

  b {
    display: block;
    margin-top: 4px;
    overflow: hidden;
    font-size: 15px;
    font-weight: 600;
    color: #303847;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.resource-state-group {
  display: grid;
  row-gap: 22px;
  margin-top: 18px;
}

.resource-state-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
  align-items: flex-start;
}

.resource-state-alert {
  min-height: 52px;
  padding: 12px 16px;
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: #b45309;
  background: #fff8e6;
  border-radius: 10px;
}

.resource-progress {
  :deep(.el-progress-bar__outer) {
    background-color: #edf1f7;
  }
}

.load-error-state {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  color: #9f3a38;
  background: #fff6f5;
  border: 1px solid #f4ceca;
  border-radius: var(--resource-inner-radius);

  p {
    min-width: 0;
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }

  :deep(.el-button) {
    min-height: 36px;
    margin-left: 0;
    flex: 0 0 auto;
  }
}

.resource-load-error {
  margin-bottom: 12px;
}

.task-activity-load-error {
  margin: 12px 14px;
}

.resource-pagination {
  display: flex;
  justify-content: flex-end;
  padding: 16px 4px 4px;
  margin-top: 16px;
  border-top: 1px solid #e7ebf0;

  :deep(.el-pagination) {
    flex-wrap: wrap;
    justify-content: flex-end;
    row-gap: 8px;
  }
}

.task-activity-panel {
  margin-bottom: 12px;
  overflow: hidden;
  background: #fff;
  border: 1px solid #dfe6ef;
  border-radius: var(--resource-inner-radius);
}

.task-activity-panel__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 20px;
  gap: 16px;
  align-items: center;
  width: 100%;
  min-height: 56px;
  padding: 10px 14px;
  color: #303847;
  text-align: left;
  cursor: pointer;
  background: #fff;
  border: 0;

  &:hover {
    background: #f8fafc;
  }

  &:focus-visible {
    outline: 2px solid #5b8def;
    outline-offset: -2px;
  }
}

.task-activity-panel__title {
  display: flex;
  gap: 8px;
  align-items: baseline;

  strong {
    font-size: 15px;
    font-weight: 650;
  }

  small {
    font-size: 12px;
    color: #778397;
  }
}

.task-activity-panel__latest {
  overflow: hidden;
  font-size: 13px;
  color: #667085;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-activity-panel__arrow {
  color: #697586;
  transition: transform 0.18s ease-out;

  &.is-expanded {
    transform: rotate(180deg);
  }
}

.task-activity-panel__body {
  max-height: 340px;
  overflow: auto;
  border-top: 1px solid #e7ebf0;
}

.agent-trace-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.agent-trace-row {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
  min-width: 0;
  padding: 12px 14px;
  border-bottom: 1px solid #edf0f4;

  &:nth-child(odd) {
    border-right: 1px solid #edf0f4;
  }

  p {
    margin: 4px 0 0;
    font-size: 13px;
    line-height: 1.55;
    color: #667085;
  }

  time {
    padding-top: 2px;
    font-size: 11px;
    color: #98a2b3;
    white-space: nowrap;
  }
}

.agent-trace-row__dot {
  width: 8px;
  height: 8px;
  margin-top: 6px;
  background: #f3a73f;
  border-radius: 50%;

  &.is-completed {
    background: #38a169;
  }

  &.is-failed,
  &.is-blocked {
    background: #dc5c5c;
  }
}

.agent-trace-row__meta {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;

  strong {
    overflow: hidden;
    font-size: 13px;
    font-weight: 650;
    color: #344054;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.task-activity-panel__empty {
  padding: 20px 14px;
  margin: 0;
  font-size: 13px;
  color: #7d8795;
}

.resource-detail {
  :deep(.el-collapse) {
    border-top: none;
    border-bottom: none;
  }

  :deep(.el-collapse-item__header) {
    height: 48px;
    font-size: 16px;
    font-weight: 600;
    color: #303847;
  }

  :deep(.el-collapse-item__content) {
    padding-bottom: 18px;
  }
}

.resource-dialog__footer {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 12px;
  align-items: center;
  justify-content: space-between;
}

.resource-dialog__action-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;

  :deep(.el-button) {
    margin-left: 0;
  }
}

.content-preview {
  max-height: 340px;
  padding: 16px;
  overflow: auto;
  font-size: 14px;
  line-height: 1.8;
  color: #374151;
  white-space: pre-wrap;
  word-break: break-word;
  background: #f7f9fc;
  border: 1px solid var(--resource-border);
  border-radius: var(--resource-radius);
}

:global(.assistant-resource-dialog.el-dialog),
:global(.assistant-resource-dialog-mask .el-dialog) {
  display: flex;
  max-height: calc(100dvh - 24px);
  overflow: hidden !important;
  flex-direction: column;
  border-radius: 18px !important;
}

:global(.assistant-resource-dialog .el-dialog__header),
:global(.assistant-resource-dialog .el-dialog__footer),
:global(.assistant-resource-dialog-mask .el-dialog__header),
:global(.assistant-resource-dialog-mask .el-dialog__footer) {
  flex: 0 0 auto;
}

:global(.assistant-resource-dialog .el-dialog__body),
:global(.assistant-resource-dialog-mask .el-dialog__body) {
  min-height: 0;
  padding-top: 8px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

:global(.assistant-resource-dialog .el-button.is-disabled),
:global(.assistant-resource-dialog-mask .el-button.is-disabled) {
  color: #a6afbd !important;
  background: #f3f5f8 !important;
  border-color: #dfe4eb !important;
  box-shadow: none !important;
}

@media (max-width: 960px) {
  .resource-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .resource-toolbar__controls {
    justify-content: flex-start;
    width: 100%;
  }

  .resource-search,
  .resource-type-select {
    flex: 1 1 220px;
    width: auto;
  }

  .task-activity-panel__header {
    grid-template-columns: minmax(0, 1fr) 20px;
  }

  .task-activity-panel__latest {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .agent-trace-list {
    grid-template-columns: 1fr;
  }

  .agent-trace-row:nth-child(odd) {
    border-right: 0;
  }

  .resource-pagination {
    justify-content: center;

    :deep(.el-pagination) {
      justify-content: center;
    }
  }
}

@media (max-width: 480px) {
  .load-error-state {
    align-items: stretch;
    flex-direction: column;

    :deep(.el-button) {
      width: 100%;
      min-height: 44px;
    }
  }

  .resource-dialog__footer {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    width: 100%;
  }

  .resource-dialog__action-group {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;

    :deep(.el-button) {
      width: 100%;
      min-width: 0;
      min-height: 44px;
      padding-right: 8px;
      padding-left: 8px;
      white-space: normal;
    }
  }

  :global(.assistant-resource-dialog.el-dialog),
  :global(.assistant-resource-dialog-mask .el-dialog) {
    width: calc(100vw - 16px) !important;
    max-height: calc(100dvh - 16px);
    margin: max(8px, env(safe-area-inset-top, 0px)) auto 0;
  }

  :global(.assistant-resource-dialog .el-dialog__header),
  :global(.assistant-resource-dialog-mask .el-dialog__header) {
    padding: 16px 40px 12px 16px;
  }

  :global(.assistant-resource-dialog .el-dialog__body),
  :global(.assistant-resource-dialog-mask .el-dialog__body) {
    padding: 8px 12px 12px;
  }

  :global(.assistant-resource-dialog .el-dialog__footer),
  :global(.assistant-resource-dialog-mask .el-dialog__footer) {
    max-height: 42dvh;
    padding: 12px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
}

@media (prefers-reduced-motion: reduce) {
  .task-card,
  .resource-card,
  .task-activity-panel__arrow {
    transition: none;
  }
}
</style>
