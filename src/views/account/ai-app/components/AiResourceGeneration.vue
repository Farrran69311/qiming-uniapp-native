<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
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
  type AssistantResourceSummary,
  type AssistantResourceTaskItem,
  type AssistantResourceTaskLogItem,
  type AssistantResourceUsageEventType,
  type AssistantResourceVersionItem,
  type AssistantChatTraceStep,
  type AssistantOption
} from "@/api/frontend/assistant";
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
const editMode = ref(false);
const detailActivePanels = ref(["summary", "feedback"]);
const taskActivityExpanded = ref(false);
const demoTasks = ref<AssistantResourceTaskItem[]>([]);
const demoTaskLogs = new Map<string, AssistantResourceTaskLogItem[]>();
const demoTaskTraces = new Map<string, AssistantChatTraceStep[]>();
const demoTaskResources = new Map<string, AssistantResourceSummary[]>();
const demoTaskTimers = new Map<string, number>();
const demoTaskPhaseIndexes = new Map<string, number>();
const demoTaskLabels = new Map<string, string>();
const demoTaskCourseNames = new Map<string, string>();
const demoTaskVariants = new Map<string, "B" | "C">();
const demoSelectedTaskIds = new Map<string, string>();
const backendResourceTaskId = "resource-backend-library";
const demoStorageKey = "ai-resource-generation-demo-state-v2";
let demoStateHydrated = false;
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
  if (isDemoTaskItem(task)) {
    return task.progress >= 100 ? "生成已完成，资源已入库" : "正在生成教学资源";
  }
  return "该任务暂未生成可展示资源";
});

const filteredResources = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase();
  const hasTaskAssociations = resources.value.some(
    resource => resource.task_id
  );
  const demoTaskSelected = isDemoTask(selectedTaskId.value);
  const backendTaskSelected = isBackendResourceTask(selectedTaskId.value);
  return resources.value.filter(resource => {
    const matchesTask =
      !selectedTaskId.value ||
      demoTaskSelected ||
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
  (isBackendResourceTask(task.task_id)
    ? "后端已入库资源"
    : demoTaskLabels.get(task.task_id)) ||
  (task.stage ? statusText(task.stage) : `任务 ${task.task_id.slice(0, 8)}`);

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

const demoTaskIdPrefix = "resource-demo-";
const demoFinalMessage = "已入库，等待人为审核和科学审查";
const isDemoTask = (taskId?: string) =>
  Boolean(taskId?.startsWith(demoTaskIdPrefix));
const isBackendResourceTask = (taskId?: string) =>
  taskId === backendResourceTaskId;
const isDemoTaskItem = (task?: AssistantResourceTaskItem) =>
  isDemoTask(task?.task_id);
const isDemoResource = (resource?: AssistantResourceSummary | null) =>
  isDemoTask(resource?.task_id);

const syncSelectedDemoResources = (taskId: string) => {
  if (selectedTaskId.value !== taskId || !isDemoTask(taskId)) return;
  resources.value = demoTaskResources.get(taskId) || [];
};

const demoContextKey = () =>
  `${String(props.courseId || "")}:${String(props.targetStudentId || "")}`;

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

const reportResourceUsage = async (
  resource: AssistantResourceSummary,
  eventType: AssistantResourceUsageEventType,
  extra: Record<string, any> = {}
) => {
  if (isDemoTask(resource.task_id)) return;
  try {
    await reportAssistantResourceUsage({
      resource_id: resource.resource_id,
      course_id: props.courseId,
      target_student_id: props.targetStudentId,
      event_type: eventType,
      ...extra
    });
  } catch (error) {
    console.warn("[AiResourceGeneration] 资源使用事件上报失败:", error);
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
  const { data } = await listAssistantResources({
    ...params,
    page,
    page_size: pageSize
  });
  return data;
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
  const taskId = selectedTaskId.value;
  const demoTaskSelected = isDemoTask(taskId);
  const backendTaskSelected = isBackendResourceTask(taskId);
  const requestsAllServerResources =
    !taskId || demoTaskSelected || backendTaskSelected;
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
      : listAssistantResources(resourceQuery(taskId)).then(
          response => response.data
        );
    const [taskResult, resourceResult] = await Promise.allSettled([
      listAssistantResourceTasks({
        course_id: props.courseId,
        target_student_id: props.targetStudentId
      }),
      resourceRequest
    ]);
    const serverTasks =
      taskResult.status === "fulfilled"
        ? taskResult.value?.data?.list || []
        : [];
    const currentCourseDemoTasks = demoTasks.value.filter(
      task => Number(task.course_id) === Number(props.courseId)
    );
    tasks.value = orderTasks([
      createBackendResourceTask(),
      ...currentCourseDemoTasks,
      ...serverTasks
    ]);
    if (
      requestSequence === resourceRequestSequence &&
      taskId === selectedTaskId.value
    ) {
      const loadedServerResources =
        resourceResult.status === "fulfilled"
          ? resourceResult.value?.list || []
          : requestsAllServerResources
            ? backendPageResources.value
            : [];
      if (resourceResult.status === "fulfilled") {
        if (requestsAllServerResources) {
          updateBackendResourcePage(
            resourceResult.value,
            requestedBackendPage,
            requestedBackendPageSize
          );
        } else {
          serverResources.value = loadedServerResources;
        }
      }
      resources.value = demoTaskSelected
        ? demoTaskResources.get(taskId) || []
        : loadedServerResources;
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
    ElMessage.error(assistantApiErrorMessage(error, "学习资源加载失败"));
  } finally {
    loading.value = false;
  }
};

const loadTaskActivity = async (taskId: string) => {
  if (isDemoTask(taskId) || isBackendResourceTask(taskId)) {
    taskLogs.value = demoTaskLogs.get(taskId) || [];
    taskTrace.value = demoTaskTraces.get(taskId) || [];
    return;
  }
  try {
    const [logsResult, traceResult] = await Promise.allSettled([
      listAssistantResourceTaskLogs(taskId),
      getAssistantTaskTrace(taskId)
    ]);
    taskLogs.value =
      logsResult.status === "fulfilled"
        ? logsResult.value?.data?.list || []
        : [];
    taskTrace.value =
      traceResult.status === "fulfilled"
        ? traceResult.value?.data?.trace || []
        : [];
  } catch (error: any) {
    console.error("[AiResourceGeneration] 任务日志加载失败:", error);
    ElMessage.error(assistantApiErrorMessage(error, "任务日志加载失败"));
  }
};

const loadTaskResources = async (taskId: string) => {
  if (isDemoTask(taskId)) {
    resourceLoading.value = false;
    syncSelectedDemoResources(taskId);
    return;
  }
  if (isBackendResourceTask(taskId)) {
    const requestSequence = ++resourceRequestSequence;
    const requestedPage = backendResourcePage.value;
    const requestedPageSize = backendResourcePageSize.value;
    resourceLoading.value = true;
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
      }
    } catch (error) {
      if (
        requestSequence === resourceRequestSequence &&
        selectedTaskId.value === taskId
      ) {
        resources.value = backendPageResources.value;
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
  try {
    const { data } = await listAssistantResources(resourceQuery(taskId));
    if (
      requestSequence === resourceRequestSequence &&
      selectedTaskId.value === taskId
    ) {
      serverResources.value = data.list || [];
      resources.value = serverResources.value;
    }
  } catch (error: any) {
    if (
      requestSequence === resourceRequestSequence &&
      selectedTaskId.value === taskId
    ) {
      serverResources.value = [];
      resources.value = [];
      ElMessage.error(assistantApiErrorMessage(error, "任务资源加载失败"));
    }
  } finally {
    if (requestSequence === resourceRequestSequence) {
      resourceLoading.value = false;
    }
  }
};

const selectTask = async (taskId: string) => {
  selectedTaskId.value = taskId;
  taskLogs.value = [];
  taskTrace.value = [];
  resourceType.value = "";
  taskActivityExpanded.value = true;
  if (isDemoTask(taskId)) {
    demoSelectedTaskIds.set(demoContextKey(), taskId);
    persistDemoState();
    syncSelectedDemoResources(taskId);
  } else if (isBackendResourceTask(taskId)) {
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

const demoTimestamp = (offsetMinutes = 0) =>
  new Date(Date.now() + offsetMinutes * 60_000).toLocaleString("zh-CN", {
    hour12: false
  });

const createBackendResourceTask = (): AssistantResourceTaskItem => {
  const resourceTypes = Array.from(
    new Set(
      backendPageResources.value
        .map(resource => resource.resource_type)
        .filter((type): type is string => Boolean(type))
    )
  );
  const timestamp =
    backendPageResources.value[0]?.updated_at || demoTimestamp();
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

type DemoCourseConfig = {
  name: string;
  topic: string;
  unit: string;
  chapter: string;
  overview: string;
  centralQuestion: string;
  goal: string;
  casePrompt: string;
  evidenceRule: string;
  commonMistake: string;
  methodSteps: string[];
  branches: Array<{
    title: string;
    relation: string;
    points: string[];
  }>;
  language?: "zh" | "en";
};

type DemoVariantCode = "B" | "C";
type DemoResourceState = "generating" | "stored";

const demoVariantMeta: Record<
  DemoVariantCode,
  { label: string; focus: string; recommendation: string }
> = {
  B: {
    label: "B 方法应用版",
    focus: "步骤、条件、参数变化与过程复核",
    recommendation: "适合课堂示范、分步练习和方法迁移"
  },
  C: {
    label: "C 案例探究版",
    focus: "案例冲突、替代解释、证据权衡与结论边界",
    recommendation: "适合案例研讨、小组论证和高阶迁移"
  }
};

const randomDemoVariant = (): DemoVariantCode =>
  Math.random() < 0.5 ? "B" : "C";

const demoCourseConfigs: DemoCourseConfig[] = [
  {
    name: "汽车故障诊断与维修",
    topic: "汽车故障诊断策略",
    unit: "1.1",
    chapter: "第1讲 汽车故障诊断及维修基础",
    overview:
      "汽车诊断与快保的核心是用标准流程控制风险和质量，从接车确认、现象复现、规范检测到复检交付均需有记录和协作。",
    centralQuestion:
      "怎样在安全前提下依据故障现象、工况记录和测量证据完成诊断、维修与复检？",
    goal: "建立从故障现象到维修复测的证据链",
    casePrompt:
      "车辆出现怠速抖动并伴随混合气过稀报码，请从安全确认、现象复现、规范检测和维修验证四阶段写出作业逻辑。",
    evidenceRule:
      "每个判断必须回到故障现象、出现工况、诊断仪数据、万用表或压力表读数、技术标准和复检结果。",
    commonMistake: "只依赖诊断仪报码，不核对实际现象和测量条件。",
    methodSteps: [
      "接车和安全确认",
      "复现并记录故障现象",
      "使用诊断设备规范检测",
      "复检、记录并完成交付"
    ],
    branches: [
      {
        title: "接车确认",
        relation: "记录",
        points: [
          "核对车辆和客户描述",
          "确认故障出现条件",
          "保护车内外并告知作业范围"
        ]
      },
      {
        title: "双人协作",
        relation: "分工",
        points: ["一人操作一人核对", "关键步骤互相确认", "沟通使用明确指令"]
      },
      {
        title: "诊断设备",
        relation: "辅助",
        points: [
          "诊断仪读取故障信息",
          "万用表和压力表提供测量",
          "设备结果需结合技术标准解释"
        ]
      },
      {
        title: "交付复检",
        relation: "闭环",
        points: ["确认故障现象消失", "恢复车辆设置", "说明维修内容和注意事项"]
      }
    ]
  },
  {
    name: "大数据导论（通识课版）",
    topic: "大数据与云计算、物联网的关系",
    unit: "2.3",
    chapter: "第2章 大数据与云计算、物联网、人工智能",
    overview:
      "云计算提供弹性计算与存储资源，物联网持续采集现实世界数据，大数据技术负责组织、处理并发现数据价值。",
    centralQuestion:
      "大数据、云计算与物联网如何在数据来源、计算能力、价值发现和治理责任之间形成闭环？",
    goal: "能够根据负载、数据来源和治理要求选择服务模式与部署方式",
    casePrompt:
      "某智慧校园计划接入门禁、能耗与学习行为数据，请设计从物联网采集、云端存储到大数据分析的技术与治理方案。",
    evidenceRule:
      "结论必须标明数据来源、责任主体、服务模式、部署方式、成本性能指标和隐私安全边界。",
    commonMistake:
      "把云计算、物联网和大数据当作同义词，只描述价值而不说明责任和条件。",
    methodSteps: [
      "识别数据来源与负载需求",
      "选择 IaaS、PaaS 或 SaaS 服务模式",
      "确定公有云、私有云或混合云部署",
      "监控成本、性能、权限和安全"
    ],
    branches: [
      {
        title: "服务模式",
        relation: "供给",
        points: ["IaaS 提供基础设施", "PaaS 提供开发平台", "SaaS 提供应用服务"]
      },
      {
        title: "部署方式",
        relation: "配置",
        points: ["公有云共享服务", "私有云专属部署", "混合云协调不同环境"]
      },
      {
        title: "技术关系",
        relation: "协同",
        points: [
          "物联网产生连续数据",
          "云计算提供弹性资源",
          "大数据完成价值发现"
        ]
      },
      {
        title: "治理约束",
        relation: "边界",
        points: [
          "数据质量与接口标准",
          "访问权限与用途限制",
          "成本性能与安全审计"
        ]
      }
    ]
  },
  {
    name: "人工智能基础",
    topic: "知识图谱",
    unit: "4.4",
    chapter: "第四章 知识表示和专家系统",
    overview:
      "知识图谱以实体、关系和属性组织领域知识，并通过模式层、实例层和推理规则支持语义检索、问答与决策。",
    centralQuestion:
      "如何把分散的领域事实转换为可查询、可校验、可扩展的知识图谱？",
    goal: "掌握知识图谱的表示单元、构建流程、质量检查和应用边界",
    casePrompt:
      "为校园课程问答系统构建知识图谱，要求支持课程、教师、知识点、先修关系与学习资源的查询和解释。",
    evidenceRule:
      "每个三元组都要给出实体类型、关系方向、来源证据和冲突处理规则，推理结果不得超出模式约束。",
    commonMistake:
      "把关键词共现当作实体关系，忽略关系方向、实体消歧和来源可信度。",
    methodSteps: [
      "定义领域范围和本体模式",
      "抽取实体、关系与属性",
      "执行实体对齐、知识融合与冲突消解",
      "完成存储查询、质量评估与应用验证"
    ],
    branches: [
      {
        title: "基本单元",
        relation: "组成",
        points: ["实体表示对象", "关系连接实体", "属性描述实体特征"]
      },
      {
        title: "知识表示",
        relation: "规范",
        points: ["三元组表达事实", "模式层约束类型", "实例层承载具体知识"]
      },
      {
        title: "构建流程",
        relation: "加工",
        points: ["知识抽取", "实体对齐与消歧", "知识融合与质量评估"]
      },
      {
        title: "应用边界",
        relation: "验证",
        points: ["语义检索与问答", "规则推理与推荐", "来源追踪与错误修正"]
      }
    ]
  },
  {
    name: "宪法学",
    topic: "宪法平等权（一）",
    unit: "5.1",
    chapter: "第五周 基本权利分论：平等权",
    overview:
      "平等权审查不是抽象判断是否公平，而是识别可比较主体、差别待遇、分类标准、正当目的和手段边界。",
    centralQuestion:
      "面对公共措施中的差别待遇，如何用比较对象、正当目的、相关性和比例边界完成宪法论证？",
    goal: "能够以规范依据、事实比较和审查强度构造完整的平等权论证",
    casePrompt:
      "某公共招录岗位设置特定身体条件并排除一类申请人，请分析可比较主体、差别待遇、目的与手段之间的关系。",
    evidenceRule:
      "论证必须区分规范位阶、制度主体、事实材料和审查结论，并保留权限、程序与事实条件。",
    commonMistake:
      "只说‘不公平’或‘一视同仁’，没有识别比较对象和差别待遇的正当化理由。",
    methodSteps: [
      "确定可比较主体与规范依据",
      "识别差别待遇及分类标准",
      "审查目的正当性和手段相关性",
      "检验是否任意、过度并说明结论边界"
    ],
    branches: [
      {
        title: "比较起点",
        relation: "识别",
        points: [
          "确定可比较的主体",
          "确认是否存在差别待遇",
          "区分形式平等与实质平等"
        ]
      },
      {
        title: "审查理由",
        relation: "正当化",
        points: [
          "限制需有正当目的",
          "分类标准应与目的相关",
          "手段不能任意或过度"
        ]
      },
      {
        title: "审查强度",
        relation: "衡量",
        points: ["一般合理性审查", "重要利益的加强审查", "可疑分类的严格审查"]
      },
      {
        title: "典型场景",
        relation: "应用",
        points: [
          "招录条件与身体标准",
          "地域身份与公共服务",
          "社会保障中的分类待遇"
        ]
      }
    ]
  },
  {
    name: "英语文学导论",
    topic: "Narrator and Images in Hemingway",
    unit: "1.5.2",
    chapter: "Chapter 1 Fiction",
    overview:
      "This lesson treats close reading as a repeatable procedure: locate a textual detail, describe its form, explain its effect, and qualify the interpretation with a boundary or counter-detail.",
    centralQuestion:
      "How do narrator, focalization, image patterns, and causal gaps organize the reader's understanding of a Hemingway passage?",
    goal: "Build an evidence-based close reading that separates observation from inference",
    casePrompt:
      "Annotate a short Hemingway passage and explain how narrative distance and a repeated image shape character, pacing, and thematic ambiguity.",
    evidenceRule:
      "Every claim must return to a locatable word, sentence, shift in perspective, repetition, omission, or contrast; one detail cannot prove the whole work.",
    commonMistake:
      "Retelling the plot or naming a symbol without showing how the language produces the effect.",
    methodSteps: [
      "Locate a narrated event, description, or focalized detail",
      "Identify the narrative device and information pattern",
      "Explain its effect on causality, character, or expectation",
      "Connect the pattern to a qualified thematic claim"
    ],
    branches: [
      {
        title: "Plot, Sequence, and Causality",
        relation: "arrangement",
        points: ["plot sequence", "conflict and turning point", "causal gaps"]
      },
      {
        title: "Setting, Style, and Technique",
        relation: "texture",
        points: ["setting", "style", "narrative technique"]
      },
      {
        title: "Narrator, Focalization, and Character",
        relation: "perspective",
        points: ["narrator", "focalization", "characterization"]
      },
      {
        title: "Theme, Symbol, and Ambiguity",
        relation: "interpretation",
        points: ["image pattern", "symbolic pressure", "qualified ambiguity"]
      }
    ],
    language: "en"
  }
];

const resolveDemoCourseConfig = (courseName?: string): DemoCourseConfig => {
  const normalizedName = String(courseName || "").trim();
  const matched = demoCourseConfigs.find(item =>
    normalizedName.includes(item.name)
  );
  if (matched) return matched;
  return {
    name: normalizedName || "当前课程",
    topic: `${normalizedName || "当前课程"}核心知识与实践`,
    unit: "第1单元",
    chapter: "课程核心单元",
    overview: "围绕课程概念、方法过程和案例证据组织学习资源。",
    centralQuestion: "如何把课程核心概念转化为可执行、可复核的分析过程？",
    goal: "建立课程核心概念之间的联系并完成案例应用",
    casePrompt: "完成一次课程综合案例分析，并说明证据、步骤和结论边界。",
    evidenceRule: "结论必须回到课程材料、数据、规范或文本证据。",
    commonMistake: "只给结论，不说明概念关系、处理步骤和证据来源。",
    methodSteps: [
      "界定对象与边界",
      "选择知识点与方法",
      "执行分析并记录证据",
      "复核结论与迁移条件"
    ],
    branches: [
      {
        title: "概念",
        relation: "定义",
        points: ["核心对象", "基本术语", "适用边界"]
      },
      {
        title: "关系",
        relation: "连接",
        points: ["上下位关系", "因果或条件", "相邻概念辨析"]
      },
      {
        title: "过程",
        relation: "执行",
        points: ["输入条件", "处理步骤", "阶段产出"]
      },
      {
        title: "证据",
        relation: "复核",
        points: ["材料来源", "评价标准", "结论限制"]
      }
    ]
  };
};

const buildDemoExplanationBody = (
  config: DemoCourseConfig,
  variantCode: DemoVariantCode
) => {
  const variant = demoVariantMeta[variantCode];
  const branchSections = config.branches
    .map(
      (branch, index) =>
        `### ${index + 1}. ${branch.title}\n\n- ${branch.points.join("\n- ")}\n\n**关系说明：** ${branch.relation}。本分支必须说明输入条件、与相邻知识点的关系以及可复核证据。`
    )
    .join("\n\n");
  const methodChain = config.methodSteps
    .map(
      (step, index) =>
        `${index + 1}. **${step}**：写明输入、动作、产出、检查点和证据不足时的回退条件。`
    )
    .join("\n");

  if (config.language === "en") {
    return `# ${config.unit} ${config.topic} | ${variant.label}\n\n> Chapter: ${config.chapter}\n> Learning route: ${variant.focus}\n\n## 1. Lesson purpose\n\n${config.overview}\n\n**Driving question.** ${config.centralQuestion}\n\n## 2. Learning outcome\n\n${config.goal}. The answer must follow a reproducible chain: locatable detail -> formal description -> reader effect -> qualified interpretation.\n\n## 3. Knowledge structure\n\n${branchSections}\n\n## 4. Close-reading procedure\n\n${methodChain}\n\n## 5. ${variantCode === "B" ? "Method-in-practice task" : "Case-inquiry task"}\n\n${config.casePrompt}\n\n## 6. Evidence and boundary check\n\n${config.evidenceRule}\n\n**Common mistake.** ${config.commonMistake}\n\n**Required output.** One evidence table, one counter-detail, and one interpretation whose scope is explicitly limited.`;
  }

  return `# ${config.unit} ${config.topic}｜${variant.label}讲解文档\n\n> 章节：${config.chapter}\n> 本版路线：${variant.focus}\n\n## 一、本节定位与核心问题\n\n${config.overview}\n\n**核心问题：** ${config.centralQuestion}\n\n## 二、学习目标\n\n${config.goal}。学习成果不能停留在术语复述，必须形成“对象与边界 → 知识点关系 → 处理步骤 → 证据 → 结论与限制”的可复核链条。\n\n## 三、核心概念与知识关系\n\n${branchSections}\n\n## 四、方法与作业过程\n\n${methodChain}\n\n## 五、${variantCode === "B" ? "方法应用任务" : "案例探究任务"}\n\n${config.casePrompt}\n\n## 六、证据要求与结论边界\n\n${config.evidenceRule}\n\n**典型误区：** ${config.commonMistake}\n\n**课堂产出：** 提交一份过程记录表，至少包含事实、未知量、所用知识点、证据、替代解释和最终结论边界。`;
};

const buildDemoMindMapBody = (
  config: DemoCourseConfig,
  variantCode: DemoVariantCode
) => {
  const nodes: Record<string, any>[] = [
    {
      id: "root",
      text: `${config.unit} ${config.topic}`,
      type: "topic",
      priority: "core"
    }
  ];
  const edges: Record<string, string>[] = [];
  config.branches.forEach((branch, branchIndex) => {
    const branchId = `b${branchIndex + 1}`;
    nodes.push({
      id: branchId,
      text: `${branch.relation}：${branch.title}`,
      type: "branch",
      priority: "high"
    });
    edges.push({ from: "root", to: branchId, relation: branch.relation });
    branch.points.forEach((point, pointIndex) => {
      const pointId = `${branchId}d${pointIndex + 1}`;
      nodes.push({
        id: pointId,
        text: point,
        type: "detail",
        priority: pointIndex === 0 ? "high" : "medium"
      });
      edges.push({ from: branchId, to: pointId, relation: "具体化" });
    });
  });
  return JSON.stringify(
    {
      schema_version: "3.0",
      title: `${config.unit} ${config.topic}`,
      course: config.name,
      chapter: config.chapter,
      variant: {
        id: variantCode,
        label: demoVariantMeta[variantCode].label,
        focus: demoVariantMeta[variantCode].focus
      },
      central_question: config.centralQuestion,
      root: "root",
      nodes,
      edges,
      method_chain: config.methodSteps,
      evidence_rule: config.evidenceRule,
      case_prompt: config.casePrompt
    },
    null,
    2
  );
};

const buildDemoExerciseBody = (
  config: DemoCourseConfig,
  variantCode: DemoVariantCode
) => {
  const questions = [
    {
      id: "Q01",
      type: "single_choice",
      difficulty: "基础",
      score: 5,
      knowledge_points: [
        config.branches[0].title,
        config.branches[0].points[0]
      ],
      stem: `“${config.branches[0].points[0]}”应归入哪个一级知识分支？`,
      options: config.branches.map(branch => branch.title),
      answer: config.branches[0].title,
      analysis: `该知识点属于“${config.branches[0].title}”，判断时要回到知识结构而不是只凭字面。`
    },
    {
      id: "Q02",
      type: "sequence",
      difficulty: "基础",
      score: 10,
      knowledge_points: ["方法链"],
      stem: "请按正确顺序排列本节四个处理步骤，并写出每一步的阶段产出。",
      answer: config.methodSteps,
      analysis: "顺序改变会造成输入条件缺失，答案必须同时说明步骤衔接。"
    },
    {
      id: "Q03",
      type: "short_answer",
      difficulty: "提高",
      score: 15,
      knowledge_points: [config.branches[1].title, config.branches[2].title],
      stem: `围绕“${config.casePrompt}”写出事实、未知量、知识点与证据。`,
      answer: config.evidenceRule,
      analysis: "高质量答案应区分观察事实、推断和结论，并保留不确定性。"
    },
    {
      id: "Q04",
      type: "case_analysis",
      difficulty: variantCode === "C" ? "挑战" : "提高",
      score: 20,
      knowledge_points: config.branches.flatMap(branch => branch.points),
      stem: config.casePrompt,
      answer: `按“${config.methodSteps.join(" → ")}”形成完整理由链。`,
      analysis: `${config.evidenceRule} 同时至少提出一种替代解释。`
    },
    {
      id: "Q05",
      type: "boundary_check",
      difficulty: "挑战",
      score: 10,
      knowledge_points: ["证据", "边界"],
      stem: `指出下列常见错误为什么不成立：${config.commonMistake}`,
      answer: "说明被省略的对象、条件、证据或评价标准，并给出纠偏步骤。",
      analysis:
        "结论必须能够被第三方复核，不能把相关性、标签或价值判断直接当作证明。"
    }
  ];
  return JSON.stringify(
    {
      schema_version: "3.0",
      title: `${config.unit} ${config.topic}练习题集`,
      course: config.name,
      chapter: config.chapter,
      variant: {
        id: variantCode,
        label: demoVariantMeta[variantCode].label,
        focus: demoVariantMeta[variantCode].focus
      },
      learning_focus: config.centralQuestion,
      total_score: questions.reduce((sum, item) => sum + item.score, 0),
      questions
    },
    null,
    2
  );
};

const buildDemoExtendedReadingBody = (
  config: DemoCourseConfig,
  variantCode: DemoVariantCode
) => {
  const branchReading = config.branches
    .map(
      branch =>
        `### ${branch.title}\n\n${branch.points.map(point => `- ${point}`).join("\n")}`
    )
    .join("\n\n");
  const heading =
    config.language === "en"
      ? variantCode === "B"
        ? "Method notes and transfer"
        : "Case dossier and competing readings"
      : variantCode === "B"
        ? "方法阅读与迁移"
        : "案例档案与争议分析";
  return `# ${config.unit} ${config.topic}｜${heading}\n\n${config.overview}\n\n## 中心问题\n\n${config.centralQuestion}\n\n## 知识线索\n\n${branchReading}\n\n## 阅读任务\n\n${config.casePrompt}\n\n## 方法链\n\n${config.methodSteps.map((step, index) => `${index + 1}. ${step}`).join("\n")}\n\n## 证据与边界\n\n${config.evidenceRule}\n\n## 反思问题\n\n${config.commonMistake} 为什么会导致错误结论？请给出一个反例或替代解释。`;
};

const buildDemoCoursewareBody = (
  config: DemoCourseConfig,
  variantCode: DemoVariantCode
) =>
  `${config.unit} ${config.topic}｜${demoVariantMeta[variantCode].label}课件提纲\n\n第 1 页：核心问题与学习目标\n第 2 页：本节对象、范围和证据要求\n第 3-6 页：${config.branches.map(branch => branch.title).join("、")}\n第 7 页：完整方法链 ${config.methodSteps.join(" → ")}\n第 8-9 页：案例任务——${config.casePrompt}\n第 10 页：替代解释与证据冲突\n第 11 页：常见误区——${config.commonMistake}\n第 12 页：课堂产出、评价量规与迁移作业`;

const buildDemoInteractionBody = (
  config: DemoCourseConfig,
  variantCode: DemoVariantCode
) =>
  `<section data-variant="${variantCode}"><h1>${config.unit} ${config.topic}</h1><p>${config.centralQuestion}</p><ol>${config.methodSteps.map(step => `<li>${step}</li>`).join("")}</ol><aside>${config.casePrompt}</aside><footer>${config.evidenceRule}</footer></section>`;

const buildDemoResourceDefinitions = (
  courseName: string | undefined,
  variantCode: DemoVariantCode
) => {
  const config = resolveDemoCourseConfig(courseName);
  const variant = demoVariantMeta[variantCode];
  return [
    {
      resource_type: "exercise_set",
      title: `${config.unit} ${config.topic}｜练习题集`,
      summary: `${variant.label}：覆盖概念定位、过程补全、案例论证与边界检查。`,
      content_format: "json",
      quality_score: variantCode === "B" ? 0.95 : 0.94,
      content_body: buildDemoExerciseBody(config, variantCode)
    },
    {
      resource_type: "extended_reading",
      title: `${config.unit} ${config.topic}｜拓展阅读`,
      summary: `${variant.label}：补充背景材料、方法迁移与争议问题。`,
      content_format: "markdown",
      quality_score: 0.93,
      content_body: buildDemoExtendedReadingBody(config, variantCode)
    },
    {
      resource_type: "explanation_doc",
      title: `${config.unit} ${config.topic}｜讲解文档`,
      summary: `${variant.label}：按知识结构、方法链、证据和结论边界展开。`,
      content_format: "markdown",
      quality_score: 0.96,
      content_body: buildDemoExplanationBody(config, variantCode)
    },
    {
      resource_type: "mind_map",
      title: `${config.unit} ${config.topic}｜思维导图`,
      summary: `${variant.label}：包含中心问题、4 个一级分支、12 个细化节点和方法链。`,
      content_format: "json",
      quality_score: 0.95,
      content_body: buildDemoMindMapBody(config, variantCode)
    },
    {
      resource_type: "courseware_ppt",
      title: `${config.unit} ${config.topic}｜教学课件`,
      summary: `${variant.label}：12 页课堂课件，包含案例、证据检查和迁移任务。`,
      content_format: "pptx",
      quality_score: 0.94,
      content_body: buildDemoCoursewareBody(config, variantCode)
    },
    {
      resource_type: "html_animation",
      title: `${config.unit} ${config.topic}｜交互演示`,
      summary: `${variant.label}：演示方法步骤、条件变化和证据回退过程。`,
      content_format: "html",
      quality_score: 0.92,
      content_body: buildDemoInteractionBody(config, variantCode)
    }
  ] as const;
};

const demoTaskBatches = [
  {
    label: "讲解与知识结构资源包",
    resourceTypes: ["explanation_doc", "mind_map"],
    message: "已生成讲解文档和知识结构资源",
    variantCode: "B" as DemoVariantCode
  },
  {
    label: "课堂练习与案例资源包",
    resourceTypes: ["exercise_set", "extended_reading"],
    message: "已生成课堂练习和拓展阅读资源",
    variantCode: "C" as DemoVariantCode
  },
  {
    label: "课件与交互演示资源包",
    resourceTypes: ["courseware_ppt", "html_animation"],
    message: "已生成教学课件和交互演示资源",
    variantCode: "B" as DemoVariantCode
  }
];

const buildDemoResources = (
  taskId: string,
  courseName?: string,
  resourceTypes?: string[],
  variantCode: DemoVariantCode = randomDemoVariant(),
  state: DemoResourceState = "stored"
): AssistantResourceSummary[] => {
  const timestamp = demoTimestamp();
  const isGenerating = state === "generating";
  const config = resolveDemoCourseConfig(courseName);
  const definitions = buildDemoResourceDefinitions(courseName, variantCode);
  const selectedDefinitions = resourceTypes?.length
    ? definitions.filter(item => resourceTypes.includes(item.resource_type))
    : definitions;
  return (selectedDefinitions.length ? selectedDefinitions : definitions).map(
    (definition, index) => ({
      resource_id: `${taskId}-resource-${index + 1}`,
      task_id: taskId,
      resource_type: definition.resource_type,
      title: definition.title,
      summary: definition.summary,
      description: isGenerating
        ? `${definition.summary} 本资源正在由多 Agent 协同生成，完成后进入科学性审查。`
        : `${definition.summary} 本资源为演示生成内容，已完成入库校验。`,
      status: isGenerating ? "processing" : "stored",
      storage_status: isGenerating ? "processing" : "ready",
      review_status: "pending",
      safety_status: "pending",
      safety_summary: isGenerating
        ? "资源正在生成，完成后将进入 AI 科学性审查；当前不可编辑、预览、发布或提交反馈。"
        : "资源已入库，正在等待 AI 科学性审查；审查完成前不可编辑、预览、发布或提交反馈。",
      safety_flags: ["AI 科学性审查待处理", "人工审核待处理"],
      verification_status: "pending",
      quality_score: definition.quality_score,
      knowledge_point_id: config.unit,
      knowledge_relevance: 0.96,
      content_format: definition.content_format,
      content_body: definition.content_body,
      object_key: `demo/resource/${taskId}/${definition.resource_type}`,
      source_kind: "demo_import",
      mode: "demo",
      version_no: variantCode === "B" ? 2 : 3,
      variant_code: variantCode,
      variant_label: demoVariantMeta[variantCode].label,
      recommendation: demoVariantMeta[variantCode].recommendation,
      created_at: timestamp,
      updated_at: timestamp,
      resource_set_id: taskId,
      citations: [
        {
          source: `${courseName || "当前课程"}课程知识库`,
          title: "课程知识库示例条目",
          snippet: "演示资源已关联当前课程知识点，待教师与学科专家复核。"
        }
      ]
    })
  );
};

type DemoStateSnapshot = {
  version: 2;
  tasks: AssistantResourceTaskItem[];
  logs: Record<string, AssistantResourceTaskLogItem[]>;
  traces: Record<string, AssistantChatTraceStep[]>;
  resources: Record<string, AssistantResourceSummary[]>;
  labels: Record<string, string>;
  courseNames: Record<string, string>;
  variants: Record<string, DemoVariantCode>;
  phaseIndexes: Record<string, number>;
  selectedTaskIds: Record<string, string>;
};

const mapToRecord = <T,>(map: Map<string, T>) =>
  Object.fromEntries(map.entries()) as Record<string, T>;

const restoreMap = <T,>(target: Map<string, T>, source?: Record<string, T>) => {
  target.clear();
  if (!source || typeof source !== "object") return;
  Object.entries(source).forEach(([key, value]) => target.set(key, value));
};

const getDemoStorage = () => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const persistDemoState = () => {
  if (!demoStateHydrated) return;
  const storage = getDemoStorage();
  if (!storage) return;
  const snapshot: DemoStateSnapshot = {
    version: 2,
    tasks: demoTasks.value,
    logs: mapToRecord(demoTaskLogs),
    traces: mapToRecord(demoTaskTraces),
    resources: mapToRecord(demoTaskResources),
    labels: mapToRecord(demoTaskLabels),
    courseNames: mapToRecord(demoTaskCourseNames),
    variants: mapToRecord(demoTaskVariants),
    phaseIndexes: mapToRecord(demoTaskPhaseIndexes),
    selectedTaskIds: mapToRecord(demoSelectedTaskIds)
  };
  try {
    storage.setItem(demoStorageKey, JSON.stringify(snapshot));
  } catch (error) {
    console.warn("[AiResourceGeneration] 演示任务本地缓存写入失败:", error);
  }
};

const hydrateDemoState = () => {
  if (demoStateHydrated) return;
  demoStateHydrated = true;
  const storage = getDemoStorage();
  if (!storage) return;
  const rawSnapshot = storage.getItem(demoStorageKey);
  if (!rawSnapshot) return;
  try {
    const snapshot = JSON.parse(rawSnapshot) as Partial<DemoStateSnapshot>;
    if (snapshot.version !== 2 || !Array.isArray(snapshot.tasks)) return;
    demoTasks.value = snapshot.tasks.filter(isDemoTaskItem);
    restoreMap(demoTaskLogs, snapshot.logs);
    restoreMap(demoTaskTraces, snapshot.traces);
    restoreMap(demoTaskResources, snapshot.resources);
    restoreMap(demoTaskLabels, snapshot.labels);
    restoreMap(demoTaskCourseNames, snapshot.courseNames);
    restoreMap(demoTaskVariants, snapshot.variants);
    restoreMap(demoTaskPhaseIndexes, snapshot.phaseIndexes);
    restoreMap(demoSelectedTaskIds, snapshot.selectedTaskIds);

    demoTasks.value.forEach(task => {
      if (demoTaskResources.has(task.task_id)) return;
      const courseName = demoTaskCourseNames.get(task.task_id) || "当前课程";
      const variantCode = demoTaskVariants.get(task.task_id) || "B";
      demoTaskResources.set(
        task.task_id,
        buildDemoResources(
          task.task_id,
          courseName,
          task.resource_types,
          variantCode,
          Number(task.progress || 0) >= 100 ? "stored" : "generating"
        )
      );
    });
  } catch (error) {
    console.warn("[AiResourceGeneration] 演示任务本地缓存读取失败:", error);
    storage.removeItem(demoStorageKey);
  }
};

const appendDemoActivity = (
  taskId: string,
  phase: {
    stage: string;
    status: string;
    message: string;
    agent: string;
    progress: number;
  }
) => {
  const occurredAt = demoTimestamp();
  const previousLogs = [...(demoTaskLogs.get(taskId) || [])];
  const previousTraces = [...(demoTaskTraces.get(taskId) || [])];
  const previousLog = previousLogs[previousLogs.length - 1];
  const previousTrace = previousTraces[previousTraces.length - 1];
  if (previousLog?.status === "running") previousLog.status = "completed";
  if (previousTrace?.status === "running") {
    previousTrace.status = "completed";
    previousTrace.finished_at = occurredAt;
  }
  const logs = [
    ...previousLogs,
    {
      stage: phase.stage,
      status: phase.status,
      message: phase.message,
      occurred_at: occurredAt
    }
  ];
  const traces = [
    ...previousTraces,
    {
      agent: phase.agent,
      agent_key: phase.agent,
      agent_label: agentText(phase.agent),
      stage: phase.stage,
      status: phase.status,
      summary: phase.message,
      started_at: occurredAt,
      finished_at: phase.progress === 100 ? occurredAt : undefined
    }
  ];
  demoTaskLogs.set(taskId, logs);
  demoTaskTraces.set(taskId, traces);
  if (selectedTaskId.value === taskId) {
    taskLogs.value = logs;
    taskTrace.value = traces;
  }
  persistDemoState();
};

const demoGenerationPhases = [
  {
    progress: 4,
    stage: "preparing",
    status: "running",
    agent: "ContextAgent",
    message: "学情 Agent 正在校验 {course} 的课程上下文和学生范围"
  },
  {
    progress: 10,
    stage: "analyzing",
    status: "running",
    agent: "CurriculumAgent",
    message: "课程分析 Agent 正在解析课程目标、章节结构和教学要求"
  },
  {
    progress: 16,
    stage: "retrieving",
    status: "running",
    agent: "RetrievalAgent",
    message: "资料检索 Agent 正在检索 {course} 的课程大纲、知识点和资料"
  },
  {
    progress: 23,
    stage: "mapping",
    status: "running",
    agent: "KnowledgeGraphAgent",
    message: "知识图谱 Agent 正在建立知识点、先修关系和案例关联"
  },
  {
    progress: 30,
    stage: "analyzing",
    status: "running",
    agent: "ProfileAgent",
    message: "学情画像 Agent 正在匹配学生薄弱点和资源难度层级"
  },
  {
    progress: 38,
    stage: "planning",
    status: "running",
    agent: "PlannerAgent",
    message: "结构规划 Agent 正在规划讲解、练习、课件、导图和拓展阅读"
  },
  {
    progress: 46,
    stage: "drafting",
    status: "running",
    agent: "OutlineAgent",
    message: "内容大纲 Agent 正在构建知识结构、案例主线和课堂活动脚本"
  },
  {
    progress: 56,
    stage: "generating",
    status: "running",
    agent: "ExplanationAgent",
    message: "讲解生成 Agent 正在生成讲解文档、思维导图和拓展阅读"
  },
  {
    progress: 65,
    stage: "generating",
    status: "running",
    agent: "ExerciseAgent",
    message: "练习生成 Agent 正在生成分层练习题、案例题和课堂提问"
  },
  {
    progress: 73,
    stage: "generating",
    status: "running",
    agent: "ContentAgent",
    message: "内容生成 Agent 正在整理教学课件与交互演示资源"
  },
  {
    progress: 80,
    stage: "validating",
    status: "running",
    agent: "AssessmentAgent",
    message: "练习评估 Agent 正在检查题目层级、答案一致性和学习目标覆盖"
  },
  {
    progress: 87,
    stage: "validating",
    status: "running",
    agent: "CitationAgent",
    message: "引用核验 Agent 正在检查资料来源、引用覆盖和事实一致性"
  },
  {
    progress: 92,
    stage: "reviewing",
    status: "running",
    agent: "SafetyAgent",
    message: "科学审查 Agent 正在执行敏感内容、安全风险和科学性自动初检"
  },
  {
    progress: 97,
    stage: "reviewing",
    status: "running",
    agent: "GovernanceAgent",
    message: "审核治理 Agent 正在创建人工审核与科学审查待办记录"
  },
  {
    progress: 99,
    stage: "storing",
    status: "running",
    agent: "StorageAgent",
    message: "资源入库 Agent 正在写入资源库并关联课程知识点"
  },
  {
    progress: 100,
    stage: "stored",
    status: "completed",
    agent: "GovernanceAgent",
    message: demoFinalMessage
  }
] as const;

const updateDemoTask = (task: AssistantResourceTaskItem) => {
  const index = demoTasks.value.findIndex(
    item => item.task_id === task.task_id
  );
  if (index >= 0) {
    demoTasks.value[index] = { ...demoTasks.value[index], ...task };
  } else {
    demoTasks.value = [task, ...demoTasks.value];
  }
  if (Number(task.course_id) === Number(props.courseId)) {
    upsertTask(task);
  }
  persistDemoState();
};

const runDemoTask = (taskId: string, phaseIndex = 0) => {
  if (demoTaskTimers.has(taskId)) return;
  const phase = demoGenerationPhases[phaseIndex];
  if (!phase) return;
  demoTaskPhaseIndexes.set(taskId, phaseIndex);
  persistDemoState();
  const timer = window.setTimeout(
    () => {
      demoTaskTimers.delete(taskId);
      const current = demoTasks.value.find(item => item.task_id === taskId);
      if (!current) {
        demoTaskPhaseIndexes.delete(taskId);
        persistDemoState();
        return;
      }
      const courseName =
        demoTaskCourseNames.get(taskId) || props.courseName || "当前课程";
      const resolvedPhase = {
        ...phase,
        message: phase.message.replace("{course}", courseName)
      };
      const updatedTask: AssistantResourceTaskItem = {
        ...current,
        status: resolvedPhase.status,
        stage: resolvedPhase.stage,
        progress: resolvedPhase.progress,
        health_summary: resolvedPhase.message,
        updated_at: demoTimestamp()
      };
      updateDemoTask(updatedTask);
      appendDemoActivity(taskId, resolvedPhase);
      if (resolvedPhase.progress === 100) {
        const variantCode = demoTaskVariants.get(taskId) || randomDemoVariant();
        demoTaskResources.set(
          taskId,
          buildDemoResources(taskId, courseName, undefined, variantCode)
        );
        syncSelectedDemoResources(taskId);
        appendDemoActivity(taskId, {
          progress: 100,
          stage: "reviewing",
          status: "pending",
          agent: "SafetyAgent",
          message: "资源正在等待 AI 科学性审查"
        });
      }
      if (phaseIndex < demoGenerationPhases.length - 1) {
        demoTaskPhaseIndexes.set(taskId, phaseIndex + 1);
        persistDemoState();
        runDemoTask(taskId, phaseIndex + 1);
      } else {
        demoTaskPhaseIndexes.delete(taskId);
        persistDemoState();
      }
    },
    phaseIndex === 0 ? 4000 : 4500
  );
  demoTaskTimers.set(taskId, timer);
};

const stopDemoTaskTimers = () => {
  demoTaskTimers.forEach(timer => window.clearTimeout(timer));
  demoTaskTimers.clear();
  persistDemoState();
};

const createDemoTask = () => {
  const taskId = `${demoTaskIdPrefix}${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const timestamp = demoTimestamp();
  const courseName = props.courseName || "当前课程";
  const variantCode = randomDemoVariant();
  const definitions = buildDemoResourceDefinitions(courseName, variantCode);
  const task: AssistantResourceTaskItem = {
    task_id: taskId,
    status: "queued",
    stage: "queued",
    progress: 0,
    health_summary: "已创建多 Agent 生成任务，等待调度",
    course_id: props.courseId,
    target_student_id: props.targetStudentId,
    resource_types: definitions.map(item => item.resource_type),
    created_at: timestamp,
    updated_at: timestamp
  };
  demoTasks.value = [task, ...demoTasks.value];
  demoTaskLabels.set(taskId, "多 Agent 资源生成任务");
  demoTaskCourseNames.set(taskId, courseName);
  demoTaskVariants.set(taskId, variantCode);
  demoTaskLogs.set(taskId, [
    {
      stage: "queued",
      status: "queued",
      message: "已创建生成任务，正在等待多 Agent 调度",
      occurred_at: timestamp
    }
  ]);
  demoTaskTraces.set(taskId, [
    {
      agent: "LearningAssistant",
      agent_key: "LearningAssistant",
      agent_label: agentText("LearningAssistant"),
      stage: "queued",
      status: "queued",
      summary: "任务已进入资源生成队列",
      started_at: timestamp
    }
  ]);
  demoTaskResources.set(
    taskId,
    buildDemoResources(taskId, courseName, undefined, variantCode, "generating")
  );
  demoTaskPhaseIndexes.set(taskId, 0);
  persistDemoState();
  upsertTask(task);
  void selectTask(taskId);
  runDemoTask(taskId);
  return task;
};

const createCompletedDemoActivity = (
  courseName: string,
  batchMessage: string,
  completedMinutesAgo: number
) => {
  const entries = [
    {
      stage: "preparing",
      status: "completed",
      agent: "ContextAgent",
      message: `学情 Agent 已完成 ${courseName} 的学生范围与学习画像校验`
    },
    {
      stage: "analyzing",
      status: "completed",
      agent: "CurriculumAgent",
      message: "课程分析 Agent 已完成课程目标和章节结构解析"
    },
    {
      stage: "retrieving",
      status: "completed",
      agent: "RetrievalAgent",
      message: "资料检索 Agent 已完成教学大纲与课程资料检索"
    },
    {
      stage: "mapping",
      status: "completed",
      agent: "KnowledgeGraphAgent",
      message: "知识图谱 Agent 已建立知识点、先修关系与案例关联"
    },
    {
      stage: "planning",
      status: "completed",
      agent: "PlannerAgent",
      message: "结构规划 Agent 已输出资源组合与难度分层方案"
    },
    {
      stage: "generating",
      status: "completed",
      agent: "ContentAgent",
      message: `内容生成 Agent ${batchMessage}`
    },
    {
      stage: "validating",
      status: "completed",
      agent: "CitationAgent",
      message: "引用核验 Agent 已完成知识点关联和引用覆盖检查"
    },
    {
      stage: "validating",
      status: "completed",
      agent: "AssessmentAgent",
      message: "练习评估 Agent 已完成题型、答案与学习目标覆盖检查"
    },
    {
      stage: "stored",
      status: "completed",
      agent: "StorageAgent",
      message: demoFinalMessage
    },
    {
      stage: "reviewing",
      status: "pending",
      agent: "SafetyAgent",
      message: "资源正在等待 AI 科学性审查"
    }
  ];
  return {
    logs: entries.map((entry, index) => ({
      stage: entry.stage,
      status: entry.status,
      message: entry.message,
      occurred_at: demoTimestamp(
        -(completedMinutesAgo + (entries.length - index - 1) * 3)
      )
    })),
    traces: entries.map((entry, index) => {
      const occurredAt = demoTimestamp(
        -(completedMinutesAgo + (entries.length - index - 1) * 3)
      );
      return {
        agent: entry.agent,
        agent_key: entry.agent,
        agent_label: agentText(entry.agent),
        stage: entry.stage,
        status: entry.status,
        summary: entry.message,
        started_at: occurredAt,
        finished_at: occurredAt
      };
    })
  };
};

const ensureDemoTasksForCurrentCourse = () => {
  const courseId = Number(props.courseId);
  if (!Number.isFinite(courseId) || courseId <= 0) return;
  if (demoTasks.value.some(task => Number(task.course_id) === courseId)) return;

  const courseName = props.courseName || "当前课程";
  const seededTasks = demoTaskBatches.map((batch, index) => {
    const taskId = `${demoTaskIdPrefix}seed-${courseId}-${index + 1}`;
    const completedMinutesAgo = 18 + index * 37;
    const activity = createCompletedDemoActivity(
      courseName,
      batch.message,
      completedMinutesAgo
    );
    const task: AssistantResourceTaskItem = {
      task_id: taskId,
      status: "completed",
      stage: "stored",
      progress: 100,
      health_summary: demoFinalMessage,
      course_id: courseId,
      target_student_id: props.targetStudentId,
      resource_types: batch.resourceTypes,
      created_at: demoTimestamp(-(completedMinutesAgo + 30)),
      updated_at: demoTimestamp(-completedMinutesAgo)
    };
    demoTaskLabels.set(taskId, batch.label);
    demoTaskCourseNames.set(taskId, courseName);
    demoTaskVariants.set(taskId, batch.variantCode);
    demoTaskLogs.set(taskId, activity.logs);
    demoTaskTraces.set(taskId, activity.traces);
    demoTaskResources.set(
      taskId,
      buildDemoResources(
        taskId,
        courseName,
        batch.resourceTypes,
        batch.variantCode
      )
    );
    return task;
  });
  demoTasks.value = [...seededTasks, ...demoTasks.value];
  persistDemoState();
};

const nextDemoPhaseIndex = (task: AssistantResourceTaskItem) => {
  const savedIndex = demoTaskPhaseIndexes.get(task.task_id);
  if (
    savedIndex !== undefined &&
    savedIndex >= 0 &&
    savedIndex < demoGenerationPhases.length
  ) {
    return savedIndex;
  }
  return demoGenerationPhases.findIndex(
    phase => phase.progress > Number(task.progress || 0)
  );
};

const resumeDemoTasks = () => {
  demoTasks.value.forEach(task => {
    if (isTerminalTask(task.status)) return;
    const phaseIndex = nextDemoPhaseIndex(task);
    if (phaseIndex >= 0) runDemoTask(task.task_id, phaseIndex);
  });
};

const restoreSelectedDemoTask = () => {
  const savedTaskId = demoSelectedTaskIds.get(demoContextKey());
  if (!savedTaskId) return false;
  const savedTask = demoTasks.value.find(
    task =>
      task.task_id === savedTaskId &&
      Number(task.course_id) === Number(props.courseId)
  );
  if (!savedTask) {
    demoSelectedTaskIds.delete(demoContextKey());
    persistDemoState();
    return false;
  }
  selectedTaskId.value = savedTaskId;
  taskActivityExpanded.value = true;
  syncSelectedDemoResources(savedTaskId);
  return true;
};

const scheduleTaskPolling = () => {
  stopTaskPolling();
  if (
    !tasks.value.some(
      task => !isDemoTaskItem(task) && !isTerminalTask(task.status)
    )
  )
    return;
  const delay = document.hidden ? 10000 : 2000;
  taskPollingTimer = window.setTimeout(() => {
    taskPollingTimer = undefined;
    void refreshPendingTasks();
  }, delay);
};

const refreshPendingTasks = async () => {
  if (taskPollingInFlight || !hasRequiredContext.value) return;
  const pendingTasks = tasks.value.filter(
    task => !isDemoTaskItem(task) && !isTerminalTask(task.status)
  );
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
  if (!ensureCourseContext()) return;
  creating.value = true;
  try {
    createDemoTask();
    ElMessage.success("资源生成任务已创建，正在模拟生成");
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
  if (isDemoResource(resource)) {
    ElMessage.info("资源正在等待 AI 科学性审查");
    return;
  }
  previewPreparing.value = true;
  let resolvedResource = resource;
  try {
    if (resource.resource_id && !isDemoTask(resource.task_id)) {
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
  if (isDemoTask(selectedResource.value?.task_id)) return;
  try {
    const { data } = await listAssistantResourceVersions(resourceId);
    resourceVersions.value = data.list || [];
  } catch (error) {
    console.warn("[AiResourceGeneration] 资源版本加载失败:", error);
  }
};

const handleCompleteResource = async () => {
  if (!selectedResource.value) return;
  if (isDemoResource(selectedResource.value)) return;
  if (!ensureCourseContext()) return;
  completeSubmitting.value = true;
  try {
    await reportResourceUsage(selectedResource.value, "complete", {
      completed: true,
      progress_percent: 100
    });
    ElMessage.success("已记录资源完成状态");
  } finally {
    completeSubmitting.value = false;
  }
};

const handleSubmitFeedback = async () => {
  if (!selectedResource.value) return;
  if (isDemoResource(selectedResource.value)) return;
  if (!ensureCourseContext()) return;
  feedbackSubmitting.value = true;
  try {
    await reportResourceUsage(selectedResource.value, "feedback", {
      feedback_score: resourceFeedbackScore.value,
      feedback_text: resourceFeedbackText.value.trim()
    });
    ElMessage.success("资源反馈已提交");
    resourceFeedbackText.value = "";
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
  if (isDemoResource(selectedResource.value)) return;
  if (!ensureCourseContext()) return;
  governanceSubmitting.value = true;
  try {
    const { data } = await updateAssistantResource(
      selectedResource.value.resource_id,
      {
        ...editForm.value,
        knowledge_relevance: Number(editForm.value.knowledge_relevance || 0)
      }
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
  if (isDemoResource(selectedResource.value)) return;
  if (!ensureCourseContext()) return;
  governanceSubmitting.value = true;
  try {
    const { data } = await reviewAssistantResource(
      selectedResource.value.resource_id,
      {
        review_status: reviewStatus,
        review_comment:
          reviewStatus === "approved"
            ? "内容准确，可以发布"
            : "请根据教师意见调整"
      }
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
  if (isDemoResource(selectedResource.value)) return;
  if (!ensureCourseContext()) return;
  governanceSubmitting.value = true;
  try {
    const { data } = await publishAssistantResource(
      selectedResource.value.resource_id
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
  if (!selectedResource.value) return;
  if (isDemoResource(selectedResource.value)) return;
  if (!ensureCourseContext()) return;
  governanceSubmitting.value = true;
  try {
    const { data } = await deleteAssistantResource(
      selectedResource.value.resource_id
    );
    ElMessage.success(data.message || "资源已删除");
    detailVisible.value = false;
    await loadResources();
  } catch (error: any) {
    console.error("[AiResourceGeneration] 资源删除失败:", error);
    ElMessage.error(assistantApiErrorMessage(error, "资源删除失败"));
  } finally {
    governanceSubmitting.value = false;
  }
};

hydrateDemoState();

onMounted(() => {
  ensureDemoTasksForCurrentCourse();
  upsertTask(createBackendResourceTask());
  const restored = restoreSelectedDemoTask();
  if (!restored) selectedTaskId.value = backendResourceTaskId;
  void loadResources();
  if (restored) void loadTaskActivity(selectedTaskId.value);
  resumeDemoTasks();
});
onBeforeUnmount(() => {
  stopTaskPolling();
  stopDemoTaskTimers();
});
watch(
  () => [props.courseId, props.courseName, props.targetStudentId],
  () => {
    stopTaskPolling();
    resetResourceSelection();
    ensureDemoTasksForCurrentCourse();
    upsertTask(createBackendResourceTask());
    const restored = restoreSelectedDemoTask();
    if (!restored) selectedTaskId.value = backendResourceTaskId;
    void loadResources();
    if (restored) void loadTaskActivity(selectedTaskId.value);
    resumeDemoTasks();
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
            <el-empty v-if="!tasks.length" description="暂无生成任务" />
          </div>
        </div>

        <div
          v-loading="resourceLoading"
          class="min-h-0 overflow-y-auto"
          element-loading-text="正在加载任务资源"
        >
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
              <p v-else class="task-activity-panel__empty">
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
                    isDemoResource(res) ||
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
                    :disabled="isDemoResource(res)"
                    @click="downloadGeneratedResource(res)"
                  >
                    下载
                  </el-button>
                </div>
              </div>
            </article>
          </div>
          <el-empty v-else :description="resourceEmptyDescription" />
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
        <div
          v-if="isDemoResource(selectedResource)"
          class="resource-review-pending"
        >
          <strong>资源正在等待 AI 科学性审查</strong>
          <span>审查完成前不可编辑、预览、发布或提交反馈</span>
        </div>
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
              <el-rate
                v-model="resourceFeedbackScore"
                :max="5"
                :disabled="isDemoResource(selectedResource)"
              />
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
              :disabled="isDemoResource(selectedResource)"
            />
          </el-collapse-item>
        </el-collapse>
      </div>

      <template #footer>
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-2">
            <el-button
              :icon="CircleCheck"
              :loading="completeSubmitting"
              :disabled="isDemoResource(selectedResource)"
              @click="handleCompleteResource"
            >
              标记完成
            </el-button>
            <el-button
              :icon="EditPen"
              plain
              :disabled="isDemoResource(selectedResource)"
              @click="editMode = !editMode"
            >
              编辑
            </el-button>
            <el-button
              :icon="Stamp"
              plain
              :loading="governanceSubmitting"
              :disabled="isDemoResource(selectedResource)"
              @click="handleReviewResource('approved')"
            >
              审核通过
            </el-button>
            <el-button
              type="danger"
              plain
              :icon="Delete"
              :loading="governanceSubmitting"
              :disabled="isDemoResource(selectedResource)"
              @click="handleDeleteResource"
            >
              删除
            </el-button>
          </div>
          <div class="flex items-center gap-2">
            <el-button
              v-if="selectedResourceCanPreview"
              type="primary"
              plain
              :loading="previewPreparing"
              :disabled="isDemoResource(selectedResource)"
              @click="openPlatformPreview()"
            >
              {{
                isDemoResource(selectedResource)
                  ? "资源正在等待 AI 科学性审查"
                  : "平台内预览"
              }}
            </el-button>
            <el-button
              plain
              type="primary"
              :loading="governanceSubmitting"
              :disabled="isDemoResource(selectedResource)"
              @click="handlePublishResource"
            >
              发布
            </el-button>
            <el-button
              type="primary"
              :loading="feedbackSubmitting"
              :disabled="isDemoResource(selectedResource)"
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

.resource-review-pending {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  margin-bottom: 14px;
  color: #8a5a14;
  background: #fff8e8;
  border: 1px solid #f2d39a;
  border-radius: 8px;

  strong {
    font-size: 14px;
    font-weight: 600;
  }

  span {
    font-size: 12px;
    color: #a47732;
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
  overflow: hidden !important;
  border-radius: 18px !important;
}

:global(.assistant-resource-dialog .el-dialog__body),
:global(.assistant-resource-dialog-mask .el-dialog__body) {
  padding-top: 8px;
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

  .resource-review-pending {
    align-items: flex-start;
    flex-direction: column;
  }

  .resource-pagination {
    justify-content: center;

    :deep(.el-pagination) {
      justify-content: center;
    }
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
