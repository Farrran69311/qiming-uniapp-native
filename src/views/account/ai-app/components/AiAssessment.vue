<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { Refresh } from "@element-plus/icons-vue";
import {
  assistantApiErrorMessage,
  applyAssistantAssessmentAction,
  getAssistantAssessmentCurrent,
  listAssistantAssessmentActions,
  listAssistantAssessmentHistory,
  listAssistantAssessmentJobs,
  refreshAssistantAssessment,
  submitAssistantAssessmentFeedback,
  type AssistantAssessmentActionItem,
  type AssistantAssessmentCurrentResp,
  type AssistantAssessmentHistoryItem,
  type AssistantAssessmentJobItem
} from "@/api/frontend/assistant";

const props = defineProps<{
  courseId?: number;
  targetStudentId?: number;
  requiresTargetStudent?: boolean;
}>();

const loading = ref(false);
const refreshLoading = ref(false);
const feedbackSubmitting = ref(false);
const actionSubmitting = ref("");
const assessment = ref<AssistantAssessmentCurrentResp | null>(null);
const assessmentActions = ref<AssistantAssessmentActionItem[]>([]);
const assessmentHistory = ref<AssistantAssessmentHistoryItem[]>([]);
const assessmentJobs = ref<AssistantAssessmentJobItem[]>([]);
const feedbackScore = ref(5);
const feedbackText = ref("");

const courseInfo = computed(
  () =>
    assessment.value?.course_info || {
      name: "当前课程",
      subtitle: "",
      total_chapters: 0,
      finished_chapters: 0
    }
);
const stats = computed(() => assessment.value?.stats || []);
const strengths = computed(() => assessment.value?.strengths || []);
const weakPoints = computed(() => assessment.value?.weak_points || []);
const timeline = computed(() => assessment.value?.timeline || []);
const suggestions = computed(() => assessment.value?.suggestions || []);
const resourceUsage = computed(() => assessment.value?.resource_usage || {});
const feedbackSummary = computed(
  () => assessment.value?.feedback_summary || {}
);
const evidence = computed(() => assessment.value?.evidence || []);
const recommendedActions = computed(() =>
  assessmentActions.value.length
    ? assessmentActions.value
    : (assessment.value?.recommended_actions || []).map((item, index) => ({
        action_id: `current_${index}`,
        assessment_id: "",
        action: item.action,
        reason: item.reason,
        priority: item.priority,
        target_type: item.target_type,
        target_id: item.target_id,
        status: "pending",
        auto_triggered: item.auto_triggered
      }))
);
const formatDuration = (value?: number) => {
  if (resourceUsage.value.dwell_seconds && !value) {
    const minutes = Math.max(
      1,
      Math.round(resourceUsage.value.dwell_seconds / 60)
    );
    if (minutes < 60) return `${minutes} 分钟`;
    return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
  }
  const ms =
    value ||
    resourceUsage.value.total_dwell_ms ||
    resourceUsage.value.dwell_ms ||
    0;
  if (!ms) return "0 分钟";
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} 分钟`;
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
};
const percentLabel = (value?: number) => {
  const normalized = Number(value || 0);
  return `${Math.round(normalized <= 1 ? normalized * 100 : normalized)}%`;
};
const scoreLabel = (value?: number) => {
  if (value === undefined || value === null) return "暂无";
  return `${Number(value).toFixed(1)} / 5`;
};

const tokenTextMap: Record<string, string> = {
  action: "动作",
  active: "活跃",
  applied: "已应用",
  approved: "已通过",
  assessment: "评估",
  auto: "自动",
  average: "平均",
  blocked: "已阻断",
  chapter: "章节",
  completed: "已完成",
  completion: "完成",
  confidence: "置信",
  count: "数量",
  create: "创建",
  current: "当前",
  danger: "高风险",
  draft: "草稿",
  dwell: "停留",
  evidence: "证据",
  exam: "测验",
  exercise: "练习",
  failed: "失败",
  feedback: "反馈",
  finished: "完成",
  frontend: "前端",
  generate: "生成",
  high: "高",
  history: "历史",
  homework: "作业",
  info: "提示",
  job: "任务",
  latest: "最近",
  level: "等级",
  low: "低",
  manual: "手动",
  medium: "中",
  missing: "缺失",
  normal: "普通",
  open: "打开",
  overall: "综合",
  path: "路径",
  percent: "百分比",
  period: "周期",
  pending: "待处理",
  plan: "规划",
  planner: "规划",
  point: "知识点",
  predicted: "预测",
  processing: "处理中",
  profile: "画像",
  question: "题目",
  queued: "排队中",
  quiz: "测验",
  rate: "率",
  refresh: "刷新",
  rejected: "已驳回",
  replan: "重规划",
  repair: "修复",
  resource: "资源",
  review: "审核",
  reviewed: "已审核",
  running: "运行中",
  safe: "安全",
  safety: "安全",
  scheduled: "定时",
  score: "分数",
  source: "来源",
  start: "开始",
  stable: "稳定",
  status: "状态",
  strength: "优势",
  student: "学生",
  success: "成功",
  system: "系统",
  teacher: "教师",
  timeline: "动态",
  total: "总计",
  trigger: "触发",
  triggered: "已触发",
  type: "类型",
  usage: "使用",
  warning: "预警",
  weak: "薄弱",
  wrong: "错题"
};

const translateBackendText = (
  value?: string | number | null,
  fallback = "暂无",
  map: Record<string, string> = {}
) => {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  if (/[\u4e00-\u9fa5]/.test(raw)) return raw;
  const normalized = raw.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
  if (map[raw]) return map[raw];
  if (map[normalized]) return map[normalized];
  const tokens = normalized.split(/[^a-z0-9]+/).filter(Boolean);
  if (!tokens.length) return fallback;
  const translated = tokens.map(token => tokenTextMap[token]);
  return translated.every(Boolean) ? translated.join("") : fallback;
};

const statusTextMap: Record<string, string> = {
  applied: "已应用",
  approved: "已通过",
  auto_reviewed: "自动审核",
  blocked: "已阻断",
  cancelled: "已取消",
  canceled: "已取消",
  completed: "已完成",
  degraded: "降级",
  failed: "失败",
  pending: "待处理",
  processing: "处理中",
  queued: "排队中",
  rejected: "已驳回",
  reviewed: "已审核",
  running: "运行中",
  skipped: "已跳过",
  success: "成功"
};

const priorityTextMap: Record<string, string> = {
  high: "高优先级",
  low: "低优先级",
  medium: "中优先级",
  normal: "普通"
};

const sourceTextMap: Record<string, string> = {
  assessment: "学习评估",
  feedback: "反馈记录",
  learning_profile: "学习画像",
  path: "学习路径",
  profile: "学习画像",
  quiz: "测验记录",
  resource: "资源使用",
  resource_usage: "资源使用",
  timeline: "学习动态"
};

const actionTextMap: Record<string, string> = {
  assign_exercise: "安排练习",
  create_explanation: "补充讲解",
  generate_resource: "生成补充资源",
  path_replan: "重新规划路径",
  recommend_resource: "推荐资源",
  refresh_assessment: "刷新评估",
  refresh_profile: "刷新学习画像",
  repair_wrong_question: "错题修复",
  replan_path: "重新规划路径",
  schedule_review: "安排复习",
  update_assessment: "刷新评估"
};

const labelTextMap: Record<string, string> = {
  active_days: "活跃天数",
  average_score: "平均分",
  completion_rate: "完成率",
  confidence: "置信度",
  learning_minutes: "学习时长",
  overall_level: "综合等级",
  predicted_score: "预测分",
  quiz_score: "测验分",
  resource_completion_rate: "资源完成率",
  wrong_question_count: "错题数"
};

const fieldPathTextMap: Record<string, string> = {
  "assessment.confidence": "评估置信度",
  "assessment.need_replan": "是否需要重规划",
  "feedback.average_score": "平均反馈评分",
  "feedback.latest_feedback": "最近反馈",
  "feedback.latest_feedback_at": "最近反馈时间",
  "learning_assessment.confidence": "评估置信度",
  "learning_assessment.feedback": "评估反馈",
  "learning_assessment.need_replan": "是否需要重规划",
  "learning_assessment.overall_level": "综合等级",
  "learning_assessment.period_end": "评估结束时间",
  "learning_assessment.period_start": "评估开始时间",
  "learning_assessment.predicted_score": "预测分",
  "learning_assessment.quiz_score": "测验分",
  "learning_assessment.risk_json.confidence": "评估置信度",
  learning_assessment_feedback: "评估反馈",
  learning_resource_usage_event: "资源使用记录",
  "learning_resource_usage_event.completed": "资源完成状态",
  "learning_resource_usage_event.dwell_ms": "资源停留时长",
  "learning_resource_usage_event.progress_percent": "资源完成率",
  "learning_path.current_node": "当前学习节点",
  "learning_path.progress": "学习进度",
  "learning_profile.risk_status": "风险状态",
  "learning_profile.weak_points": "薄弱点",
  period_end: "结束时间",
  period_start: "开始时间",
  predicted_score_below_68: "预测分低于 68",
  progress_percent: "进度百分比",
  "quiz.score": "测验分",
  quiz_score_min: "最低测验分",
  "resource_usage.completion_rate": "资源完成率",
  "resource_usage.dwell_seconds": "资源停留时长",
  "resource_usage.usage_count": "资源使用次数",
  resource_completion_low: "资源完成率偏低",
  wrong_questions_high: "错题偏多"
};

const levelTextMap: Record<string, string> = {
  at_risk: "需关注",
  average: "一般",
  excellent: "优秀",
  good: "良好",
  high: "高风险",
  improving: "提升中",
  low: "低风险",
  medium: "中风险",
  stable: "稳定",
  weak: "薄弱"
};

const jobTextMap: Record<string, string> = {
  assessment_refresh: "评估刷新",
  auto_refresh: "自动刷新",
  feedback_refresh: "反馈触发刷新",
  manual_refresh: "手动刷新",
  refresh_assessment: "评估刷新",
  replan: "路径重规划"
};

const triggerTextMap: Record<string, string> = {
  auto: "自动触发",
  feedback: "反馈触发",
  frontend_manual_refresh: "手动刷新",
  manual: "手动触发",
  scheduled: "定时触发",
  system: "系统触发"
};

const statusText = (value?: string, fallback = "待处理") =>
  translateBackendText(value, fallback, statusTextMap);
const priorityText = (value?: string) =>
  translateBackendText(value, "普通", priorityTextMap);
const sourceText = (value?: string) =>
  translateBackendText(value, "评估来源", sourceTextMap);
const actionText = (value?: string) =>
  translateBackendText(value, "评估动作", actionTextMap);
const labelText = (value?: string) =>
  translateBackendText(value, "指标", labelTextMap);
const levelText = (value?: string) =>
  translateBackendText(value, "暂无等级", levelTextMap);
const jobText = (value?: string) =>
  translateBackendText(value, "评估任务", jobTextMap);
const triggerText = (value?: string) =>
  translateBackendText(value, "手动触发", triggerTextMap);
const inlineTextMap = {
  ...fieldPathTextMap,
  ...labelTextMap,
  ...statusTextMap,
  ...priorityTextMap,
  ...levelTextMap,
  ...sourceTextMap,
  ...actionTextMap,
  ...jobTextMap,
  ...triggerTextMap
};

const localizeInlineText = (value?: string, fallback = "暂无内容") => {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const direct = translateBackendText(raw, raw, inlineTextMap);
  if (direct !== raw) return direct;
  const localized = raw.replace(
    /\b[a-z][a-z0-9]*(?:[._][a-z0-9]+)+\b|\b(?:completed|processing|pending|queued|running|failed|reviewed|approved|rejected|high|medium|low|normal|manual|auto)\b/gi,
    match => translateBackendText(match, match, inlineTextMap)
  );
  return localized.replace(/^来自\s+/, "依据：");
};
const readableText = (value?: string, fallback = "暂无内容") =>
  localizeInlineText(value, fallback);
const statValueText = (value?: string | number | null) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "暂无";
  if (/^-?\d+(\.\d+)?%?$/.test(raw)) return raw;
  if (raw === "true") return "是";
  if (raw === "false") return "否";
  return localizeInlineText(raw, raw);
};

const contextWarning = computed(() => {
  if (!props.courseId) return "请先选择课程";
  if (props.requiresTargetStudent && !props.targetStudentId) {
    return "请先选择学生";
  }
  return "";
});
const hasRequiredContext = computed(() => !contextWarning.value);

const ensureCourseContext = () => {
  if (hasRequiredContext.value) return true;
  ElMessage.warning(contextWarning.value || "请先选择课程");
  return false;
};

const timelineType = (type: string) => {
  if (["primary", "success", "warning", "danger", "info"].includes(type)) {
    return type as "primary" | "success" | "warning" | "danger" | "info";
  }
  return "primary";
};

const loadAssessment = async () => {
  if (!hasRequiredContext.value) {
    assessment.value = null;
    assessmentActions.value = [];
    assessmentHistory.value = [];
    assessmentJobs.value = [];
    return;
  }
  loading.value = true;
  try {
    const params = {
      course_id: props.courseId,
      target_student_id: props.targetStudentId
    };
    const [currentResult, actionsResult, historyResult, jobsResult] =
      await Promise.allSettled([
        getAssistantAssessmentCurrent(params),
        listAssistantAssessmentActions(params),
        listAssistantAssessmentHistory(params),
        listAssistantAssessmentJobs(params)
      ]);
    assessment.value =
      currentResult.status === "fulfilled"
        ? currentResult.value?.data || null
        : null;
    assessmentActions.value =
      actionsResult.status === "fulfilled"
        ? actionsResult.value?.data?.list || []
        : [];
    assessmentHistory.value =
      historyResult.status === "fulfilled"
        ? historyResult.value?.data?.list || []
        : [];
    assessmentJobs.value =
      jobsResult.status === "fulfilled"
        ? jobsResult.value?.data?.list || []
        : [];
    if (
      currentResult.status === "rejected" ||
      actionsResult.status === "rejected" ||
      historyResult.status === "rejected" ||
      jobsResult.status === "rejected"
    ) {
      console.warn("[AiAssessment] 部分学习评估接口加载失败", {
        currentError:
          currentResult.status === "rejected"
            ? currentResult.reason
            : undefined,
        actionsError:
          actionsResult.status === "rejected"
            ? actionsResult.reason
            : undefined,
        historyError:
          historyResult.status === "rejected"
            ? historyResult.reason
            : undefined,
        jobsError:
          jobsResult.status === "rejected" ? jobsResult.reason : undefined
      });
    }
  } catch (error: any) {
    console.error("[AiAssessment] 学习评估加载失败:", error);
    ElMessage.error(assistantApiErrorMessage(error, "学习评估加载失败"));
  } finally {
    loading.value = false;
  }
};

const handleRefreshAssessment = async () => {
  if (!ensureCourseContext()) return;
  refreshLoading.value = true;
  try {
    const { data } = await refreshAssistantAssessment({
      course_id: props.courseId,
      target_student_id: props.targetStudentId,
      reason: "frontend_manual_refresh",
      mode: "sync"
    });
    ElMessage.success(data.message || "评估刷新已提交");
    await loadAssessment();
  } catch (error: any) {
    console.error("[AiAssessment] 学习评估刷新失败:", error);
    ElMessage.error(assistantApiErrorMessage(error, "学习评估刷新失败"));
  } finally {
    refreshLoading.value = false;
  }
};

const handleSubmitFeedback = async () => {
  if (!ensureCourseContext()) return;
  if (!feedbackText.value.trim() && !feedbackScore.value) {
    ElMessage.warning("请先填写评分或反馈内容");
    return;
  }
  feedbackSubmitting.value = true;
  try {
    const { data } = await submitAssistantAssessmentFeedback({
      course_id: props.courseId,
      target_student_id: props.targetStudentId,
      target_type: "assessment",
      rating: feedbackScore.value,
      content: feedbackText.value.trim(),
      metadata: { ui_entry: "ai_assessment_panel" }
    });
    ElMessage.success(data.message || "评估反馈已提交，已入队刷新评估");
    feedbackText.value = "";
    await loadAssessment();
  } catch (error: any) {
    console.error("[AiAssessment] 评估反馈提交失败:", error);
    ElMessage.error(assistantApiErrorMessage(error, "评估反馈提交失败"));
  } finally {
    feedbackSubmitting.value = false;
  }
};

const actionType = (priority?: string) => {
  if (priority === "high") return "danger";
  if (priority === "medium") return "warning";
  return "info";
};

const jobType = (status?: string) => {
  if (status === "completed") return "success";
  if (status === "failed") return "danger";
  if (status === "running" || status === "processing") return "warning";
  return "info";
};

const handleApplyAction = async (action: AssistantAssessmentActionItem) => {
  if (!ensureCourseContext()) return;
  if (action.action_id.startsWith("current_")) {
    ElMessage.info("该动作来自当前快照，请刷新动作列表后再应用");
    return;
  }
  actionSubmitting.value = action.action_id;
  try {
    const { data } = await applyAssistantAssessmentAction(action.action_id);
    ElMessage.success(data.message || "评估动作已应用");
    await loadAssessment();
  } catch (error: any) {
    console.error("[AiAssessment] 应用评估动作失败:", error);
    ElMessage.error(assistantApiErrorMessage(error, "应用评估动作失败"));
  } finally {
    actionSubmitting.value = "";
  }
};

onMounted(loadAssessment);
watch(() => [props.courseId, props.targetStudentId], loadAssessment);
</script>

<template>
  <div
    v-loading="loading"
    class="assessment-page h-full flex flex-col bg-transparent overflow-y-auto"
  >
    <div
      class="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[18px] border border-gray-100 bg-white px-4 py-4 shadow-sm md:px-6 md:py-5"
    >
      <div class="min-w-0">
        <h2 class="text-xl font-semibold text-text_color_primary">
          阶段学习评估
        </h2>
        <div
          class="mt-2 flex flex-wrap items-center gap-2 text-sm leading-6 text-text_color_regular"
        >
          <span>课程：{{ courseInfo.name }}</span>
          <span v-if="courseInfo.subtitle" class="text-text_color_secondary">
            {{ courseInfo.subtitle }}
          </span>
        </div>
      </div>
      <div
        class="assessment-toolbar-actions flex min-w-0 max-w-full flex-wrap items-center gap-3"
      >
        <el-tag effect="plain" round size="large" class="!bg-bg_color">
          章节 {{ courseInfo.finished_chapters }} /
          {{ courseInfo.total_chapters }}
        </el-tag>
        <el-tag v-if="assessment?.message" type="info" effect="plain" round>
          {{ readableText(assessment.message, "评估已生成") }}
        </el-tag>
        <el-tag
          v-if="assessment?.confidence"
          type="success"
          effect="plain"
          round
        >
          置信度 {{ percentLabel(assessment.confidence) }}
        </el-tag>
        <el-tag
          v-if="assessment?.need_replan"
          type="warning"
          effect="plain"
          round
        >
          建议重规划
        </el-tag>
        <el-button
          type="primary"
          plain
          round
          :icon="Refresh"
          :loading="refreshLoading"
          @click="handleRefreshAssessment"
        >
          刷新评估
        </el-button>
      </div>
    </div>

    <section
      class="mb-6 rounded-[18px] border border-blue-100 bg-white p-4 shadow-sm md:p-6"
    >
      <div class="mb-5 flex items-center justify-between gap-3">
        <h4 class="text-base font-semibold text-text_color_primary">
          提升建议
        </h4>
        <el-tag v-if="suggestions.length" type="primary" effect="plain">
          {{ suggestions.length }} 条
        </el-tag>
      </div>

      <div v-if="suggestions.length" class="grid grid-cols-1 gap-3">
        <div
          v-for="(tip, i) in suggestions"
          :key="tip"
          class="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-sm md:px-4"
        >
          <span
            class="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-blue-50 text-sm font-semibold text-primary"
          >
            {{ i + 1 }}
          </span>
          <span class="text-sm font-medium leading-7 text-text_color_primary">
            {{ readableText(tip, "暂无建议") }}
          </span>
        </div>
      </div>
      <el-empty v-else description="暂无提升建议" :image-size="90" />
    </section>

    <div
      v-if="evidence.length || recommendedActions.length"
      class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6"
    >
      <div
        class="bg-bg_color p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm"
      >
        <h4 class="mb-5 text-base font-semibold text-text_color_primary">
          评估证据链
        </h4>
        <div v-if="evidence.length" class="space-y-3">
          <div
            v-for="item in evidence"
            :key="`${item.source}-${item.summary}`"
            class="rounded-xl bg-gray-50/70 dark:bg-gray-800/30 p-4 text-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-text_color_primary">
                {{ sourceText(item.source) }}
              </span>
              <el-tag v-if="item.confidence" size="small" effect="plain">
                {{ percentLabel(item.confidence) }}
              </el-tag>
            </div>
            <p class="mt-2 leading-6 text-text_color_regular">
              {{ readableText(item.summary, "暂无证据说明") }}
            </p>
          </div>
        </div>
        <el-empty v-else description="暂无评估证据" :image-size="90" />
      </div>

      <div
        class="bg-bg_color p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm"
      >
        <h4 class="mb-5 text-base font-semibold text-text_color_primary">
          待处理优化动作
        </h4>
        <div v-if="recommendedActions.length" class="space-y-3">
          <div
            v-for="action in recommendedActions"
            :key="action.action_id"
            class="rounded-xl bg-gray-50/70 dark:bg-gray-800/30 p-4 text-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="font-bold text-text_color_primary">
                  {{ actionText(action.action) }}
                </span>
                <el-tag
                  size="small"
                  effect="plain"
                  :type="actionType(action.priority)"
                >
                  {{ priorityText(action.priority) }}
                </el-tag>
              </div>
              <el-tag size="small" effect="plain">
                {{ statusText(action.status) }}
              </el-tag>
            </div>
            <p class="mt-2 leading-6 text-text_color_regular">
              {{ readableText(action.reason, "需根据评估结果处理") }}
            </p>
            <div class="mt-3 text-right">
              <el-button
                size="small"
                type="primary"
                plain
                :loading="actionSubmitting === action.action_id"
                :disabled="action.action_id.startsWith('current_')"
                @click="handleApplyAction(action)"
              >
                应用动作
              </el-button>
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无待处理动作" :image-size="90" />
      </div>
    </div>

    <div v-if="stats.length" class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div
        v-for="s in stats"
        :key="s.label"
        class="bg-bg_color p-6 rounded-xl border border-gray-100 dark:border-gray-800 flex flex-col justify-center items-center shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
      >
        <div class="mb-3 text-sm font-medium text-text_color_regular">
          {{ labelText(s.label) }}
        </div>
        <div class="mb-2 text-3xl font-semibold text-text_color_primary">
          {{ statValueText(s.value) }}
        </div>
        <div
          v-if="s.sub"
          class="rounded-full border border-primary/10 bg-primary/5 px-3 py-1.5 text-sm font-medium leading-5 text-primary"
        >
          {{ readableText(s.sub) }}
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div
        class="bg-bg_color p-6 rounded-xl border border-red-100 dark:border-gray-800 shadow-sm"
      >
        <h4 class="mb-6 text-base font-semibold text-red-600">
          薄弱知识点警示
        </h4>
        <div v-if="weakPoints.length" class="space-y-4">
          <div
            v-for="w in weakPoints"
            :key="w.title"
            class="group p-4 rounded-xl bg-gray-50/50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800 transition-all duration-200 hover:-translate-y-0.5 hover:border-red-200 hover:bg-white hover:shadow-sm"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-semibold text-text_color_primary">{{
                readableText(w.title, "未命名薄弱点")
              }}</span>
              <el-tag
                :type="w.level === 'high' ? 'danger' : 'warning'"
                size="small"
                effect="dark"
                round
              >
                {{ w.level === "high" ? "高危" : "中危" }}
              </el-tag>
            </div>
            <p class="text-sm leading-6 text-text_color_regular opacity-80">
              {{ readableText(w.desc, "暂无薄弱点说明") }}
            </p>
          </div>
        </div>
        <el-empty v-else description="暂无薄弱点数据" :image-size="90" />
      </div>

      <div
        class="bg-bg_color p-6 rounded-xl border border-green-100 dark:border-gray-800 shadow-sm"
      >
        <h4 class="mb-6 text-base font-semibold text-green-600">
          稳定优势能力
        </h4>
        <div v-if="strengths.length" class="space-y-4">
          <div
            v-for="item in strengths"
            :key="item.title"
            class="p-4 rounded-xl bg-gray-50/50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800 transition-all duration-200 hover:-translate-y-0.5 hover:border-green-200 hover:bg-white hover:shadow-sm"
          >
            <span
              class="text-sm font-semibold text-text_color_primary block mb-2"
              >{{ readableText(item.title, "未命名优势") }}</span
            >
            <span
              class="text-sm leading-6 text-text_color_regular opacity-80"
              >{{ readableText(item.desc, "暂无优势说明") }}</span
            >
          </div>
        </div>
        <el-empty v-else description="暂无优势能力数据" :image-size="90" />
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      <div
        class="bg-bg_color p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm"
      >
        <h4 class="mb-5 text-base font-semibold text-text_color_primary">
          资源使用闭环
        </h4>
        <div class="grid grid-cols-2 gap-3">
          <div
            class="rounded-xl bg-gray-50/70 dark:bg-gray-800/30 p-4 transition-all duration-200 hover:bg-white hover:shadow-sm"
          >
            <div class="text-sm text-text_color_regular">使用次数</div>
            <div class="mt-2 text-2xl font-semibold text-text_color_primary">
              {{ resourceUsage.usage_count || resourceUsage.open_count || 0 }}
            </div>
          </div>
          <div
            class="rounded-xl bg-gray-50/70 dark:bg-gray-800/30 p-4 transition-all duration-200 hover:bg-white hover:shadow-sm"
          >
            <div class="text-sm text-text_color_regular">停留时长</div>
            <div class="mt-2 text-2xl font-semibold text-text_color_primary">
              {{ formatDuration() }}
            </div>
          </div>
          <div
            class="rounded-xl bg-gray-50/70 dark:bg-gray-800/30 p-4 transition-all duration-200 hover:bg-white hover:shadow-sm"
          >
            <div class="text-sm text-text_color_regular">完成率</div>
            <div class="mt-2 text-2xl font-semibold text-text_color_primary">
              {{ percentLabel(resourceUsage.completion_rate) }}
            </div>
          </div>
          <div
            class="rounded-xl bg-gray-50/70 dark:bg-gray-800/30 p-4 transition-all duration-200 hover:bg-white hover:shadow-sm"
          >
            <div class="text-sm text-text_color_regular">资源评分</div>
            <div class="mt-2 text-2xl font-semibold text-text_color_primary">
              {{
                scoreLabel(
                  resourceUsage.average_resource_score ||
                    resourceUsage.average_feedback_score ||
                    resourceUsage.average_feedback
                )
              }}
            </div>
            <div class="mt-1 text-sm text-text_color_regular">
              {{
                resourceUsage.resource_feedback_count ||
                resourceUsage.feedback_count ||
                0
              }}
              条反馈
            </div>
          </div>
        </div>
      </div>

      <div
        class="bg-bg_color p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm"
      >
        <h4 class="mb-5 text-base font-semibold text-text_color_primary">
          评估反馈
        </h4>
        <div class="grid grid-cols-3 gap-3 mb-4">
          <div
            class="rounded-xl bg-gray-50/70 dark:bg-gray-800/30 p-4 transition-all duration-200 hover:bg-white hover:shadow-sm"
          >
            <div class="text-sm text-text_color_regular">反馈数量</div>
            <div class="mt-2 text-xl font-semibold text-text_color_primary">
              {{ feedbackSummary.feedback_count || feedbackSummary.count || 0 }}
            </div>
          </div>
          <div
            class="rounded-xl bg-gray-50/70 dark:bg-gray-800/30 p-4 transition-all duration-200 hover:bg-white hover:shadow-sm"
          >
            <div class="text-sm text-text_color_regular">平均评分</div>
            <div class="mt-2 text-xl font-semibold text-text_color_primary">
              {{
                scoreLabel(
                  feedbackSummary.average_score || feedbackSummary.avg_score
                )
              }}
            </div>
          </div>
          <div
            class="rounded-xl bg-gray-50/70 dark:bg-gray-800/30 p-4 transition-all duration-200 hover:bg-white hover:shadow-sm"
          >
            <div class="text-sm text-text_color_regular">最近反馈</div>
            <div
              class="mt-2 text-sm font-medium leading-6 text-text_color_primary line-clamp-2"
            >
              {{
                feedbackSummary.latest_feedback_at ||
                feedbackSummary.last_feedback_at ||
                feedbackSummary.latest_at ||
                "暂无"
              }}
            </div>
          </div>
        </div>
        <p
          v-if="
            feedbackSummary.latest_feedback ||
            feedbackSummary.latest_content ||
            feedbackSummary.latest_comment
          "
          class="mb-4 rounded-xl bg-primary/5 px-4 py-3 text-sm leading-6 text-text_color_regular"
        >
          {{
            readableText(
              feedbackSummary.latest_feedback ||
                feedbackSummary.latest_content ||
                feedbackSummary.latest_comment,
              "暂无反馈内容"
            )
          }}
        </p>
        <div class="flex items-center gap-3">
          <el-rate v-model="feedbackScore" />
          <span class="text-sm text-text_color_regular"
            >{{ feedbackScore }} / 5</span
          >
        </div>
        <el-input
          v-model="feedbackText"
          class="mt-3"
          type="textarea"
          :rows="3"
          maxlength="300"
          show-word-limit
          placeholder="对这次学习评估有什么补充？"
        />
        <div class="mt-3 text-right">
          <el-button
            type="primary"
            :loading="feedbackSubmitting"
            @click="handleSubmitFeedback"
          >
            提交评估反馈
          </el-button>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      <div
        class="bg-bg_color p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm"
      >
        <h4 class="mb-5 text-base font-semibold text-text_color_primary">
          评估历史
        </h4>
        <el-timeline v-if="assessmentHistory.length">
          <el-timeline-item
            v-for="item in assessmentHistory"
            :key="item.assessment_id"
            :timestamp="item.updated_at || item.created_at"
            hollow
          >
            <div class="flex items-center gap-2">
              <span class="text-sm font-bold text-text_color_primary">
                v{{ item.assessment_version }} ·
                {{ levelText(item.overall_level) }}
              </span>
              <el-tag
                v-if="item.need_replan"
                size="small"
                type="warning"
                effect="plain"
              >
                需重规划
              </el-tag>
              <el-tag
                v-if="item.auto_action_status"
                size="small"
                effect="plain"
              >
                {{ statusText(item.auto_action_status) }}
              </el-tag>
            </div>
            <p class="mt-1 text-sm leading-6 text-text_color_regular">
              {{ readableText(item.summary, `预测分 ${item.predicted_score}`) }}
            </p>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-else description="暂无评估历史" :image-size="90" />
      </div>

      <div
        class="bg-bg_color p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm"
      >
        <h4 class="mb-5 text-base font-semibold text-text_color_primary">
          评估队列任务
        </h4>
        <div v-if="assessmentJobs.length" class="space-y-3">
          <div
            v-for="job in assessmentJobs"
            :key="job.job_id"
            class="rounded-xl bg-gray-50/70 dark:bg-gray-800/30 p-4 text-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-text_color_primary">
                {{ jobText(job.job_type) }} ·
                {{ triggerText(job.trigger_source) }}
              </span>
              <el-tag size="small" :type="jobType(job.status)" effect="plain">
                {{ statusText(job.status) }}
              </el-tag>
            </div>
            <div class="mt-2 text-text_color_regular">
              尝试 {{ job.attempt_count }}/{{ job.max_attempts }}
            </div>
            <p v-if="job.error_message" class="mt-1 text-red-500">
              {{ readableText(job.error_message, "任务异常") }}
            </p>
          </div>
        </div>
        <el-empty v-else description="暂无评估队列任务" :image-size="90" />
      </div>
    </div>

    <div class="grid grid-cols-1 gap-6 mt-6 pb-6">
      <div
        class="bg-bg_color p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm"
      >
        <h4 class="mb-8 text-base font-semibold text-text_color_primary">
          最近评估动态
        </h4>
        <el-timeline v-if="timeline.length" class="pl-2">
          <el-timeline-item
            v-for="activity in timeline"
            :key="`${activity.time}-${activity.content}`"
            :type="timelineType(activity.type)"
            :timestamp="activity.time"
            hollow
          >
            <span class="text-sm leading-6 text-text_color_regular">{{
              readableText(activity.content, "暂无动态")
            }}</span>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-else description="暂无评估动态" :image-size="90" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.assessment-page > * {
  flex-shrink: 0;
}

.assessment-toolbar-actions :deep(.el-tag),
.assessment-toolbar-actions :deep(.el-tag__content) {
  max-width: 100%;
  height: auto;
  white-space: normal;
  overflow-wrap: anywhere;
}

.assessment-toolbar-actions :deep(.el-tag) {
  min-height: 32px;
  padding-block: 5px;
  line-height: 1.45;
}
</style>
