<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storageLocal } from "@pureadmin/utils";
import { ElMessage } from "element-plus";
import {
  Cpu,
  FolderOpened,
  Document,
  Guide,
  User,
  DataAnalysis,
  MagicStick,
  Box,
  Monitor,
  ArrowDown,
  Top,
  Expand,
  Fold,
  Avatar,
  Clock,
  DataBoard,
  Calendar,
  Bell,
  ChatLineRound,
  Close,
  ArrowRight
} from "@element-plus/icons-vue";

// 引入三个拆分后的组件
import AiSidebar from "./components/AiSidebar.vue";
import AiChatModule from "./components/AiChatModule.vue";
import AiInspector from "./components/AiInspector.vue";
import AgentPdfWorkbench from "./AgentPdfWorkbench.vue";
import LottieAnimation from "@/components/LottieAnimation.vue";

import AiResourceGeneration from "./components/AiResourceGeneration.vue";
import AiLearningPath from "./components/AiLearningPath.vue";
import AiLearningProfile from "./components/AiLearningProfile.vue";
import AiAssessment from "./components/AiAssessment.vue";
import VirtualHumanPanel from "./components/VirtualHumanPanel.vue";
import FloatingDigitalHuman2D from "./components/FloatingDigitalHuman2D.vue";

import emptyStateDevelopmentAnimation from "@/assets/aiapplottie/empty-state-development-animation.json";
import onlineChartAnimation from "@/assets/aiapplottie/online-chart-animation.json";
import saasAnimation from "@/assets/aiapplottie/saas-animation.json";

import { useUserStore } from "@/store/modules/user";
import { formatAvatar } from "@/utils/avatar";
import { type DataInfo, userKey } from "@/utils/auth";
import {
  getResponsiveLayoutTheme,
  getSavedCourseTheme
} from "@/utils/courseTheme";
import {
  getAssistantBootstrap,
  getAssistantConversationGroups,
  getAssistantConversationMessages,
  streamAssistantChat,
  type AssistantBootstrapCourse,
  type AssistantBootstrapResp,
  type AssistantBootstrapStudent,
  type AssistantChatResource,
  type AssistantChatStreamEvent,
  type AssistantChatTraceStep,
  type AssistantConversationItem,
  type AssistantOption,
  type AssistantSkill
} from "@/api/frontend/assistant";

defineOptions({ name: "AiAppWorkbench" });

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

type CourseView = AssistantBootstrapCourse & {
  id: number;
  name: string;
};

type StudentView = AssistantBootstrapStudent & {
  id: number;
  name: string;
  avatar: string;
};

type ConversationView = AssistantConversationItem & {
  id: string;
  title: string;
  time?: string;
  course: string;
  courseId?: number;
  status?: string;
};

type ChatMessageView = {
  id: string | number;
  role: string;
  type: "system" | "user";
  content: string;
  avatar?: string;
  resources?: AssistantChatResource[];
  streaming?: boolean;
  error?: boolean;
};

const assistantBootstrap = ref<AssistantBootstrapResp | null>(null);
const isBootstrapping = ref(false);
const isChatStreaming = ref(false);
const featureFlags = computed(
  () => assistantBootstrap.value?.feature_flags || {}
);

const selectedAgentKey = ref("");
const selectedModelKey = ref("");
const thinkingModeKey = ref("");
const selectedSkillKeys = ref<string[]>([]);

const loginRoleType = computed(() => {
  const userInfoRoleType =
    storageLocal().getItem<DataInfo<number>>(userKey)?.roleType;
  const localRoleType = window.localStorage.getItem("userRoleType");
  return Number(userInfoRoleType || localRoleType) || 0;
});
const bootstrapRole = computed(() =>
  String(assistantBootstrap.value?.role || "").toLowerCase()
);
const normalizedRoles = computed(() =>
  (userStore.roles || []).map(role => String(role).toLowerCase())
);

const roleMode = computed<{
  mode: "管理员模式" | "教师模式" | "学生模式";
  apiMode: "admin" | "teacher" | "student";
  userLabel: "管理员" | "教师" | "学生";
}>(() => {
  if (loginRoleType.value === 1) {
    return { mode: "学生模式", apiMode: "student", userLabel: "学生" };
  }
  if (loginRoleType.value === 2) {
    return { mode: "教师模式", apiMode: "teacher", userLabel: "教师" };
  }
  if (loginRoleType.value === 3) {
    return { mode: "管理员模式", apiMode: "admin", userLabel: "管理员" };
  }

  if (bootstrapRole.value === "student") {
    return { mode: "学生模式", apiMode: "student", userLabel: "学生" };
  }
  if (bootstrapRole.value === "teacher") {
    return { mode: "教师模式", apiMode: "teacher", userLabel: "教师" };
  }
  if (bootstrapRole.value === "admin") {
    return { mode: "管理员模式", apiMode: "admin", userLabel: "管理员" };
  }

  if (
    normalizedRoles.value.includes("student") ||
    normalizedRoles.value.includes("common")
  ) {
    return { mode: "学生模式", apiMode: "student", userLabel: "学生" };
  }
  if (normalizedRoles.value.includes("teacher")) {
    return { mode: "教师模式", apiMode: "teacher", userLabel: "教师" };
  }
  if (normalizedRoles.value.includes("admin")) {
    return { mode: "管理员模式", apiMode: "admin", userLabel: "管理员" };
  }

  return { mode: "学生模式", apiMode: "student", userLabel: "学生" };
});
const mode = computed(() => roleMode.value.mode);
const apiMode = computed(() => roleMode.value.apiMode);
const currentUserRoleLabel = computed(() => roleMode.value.userLabel);
const isStaffMode = computed(() => apiMode.value !== "student");
const currentUserAvatar = computed(() => formatAvatar(userStore.avatar));

const isNewTab = ref(false);

const currentTheme = ref(getSavedCourseTheme(getResponsiveLayoutTheme()));
const pdfServiceUrl = "https://agentpdf.intelledu.cn";

const resolveRailFromPath = (path: string) => {
  const key = path.split("/").filter(Boolean).pop() || "chat";
  const knownRails = [
    "chat",
    "generation",
    "agentpdf",
    "path",
    "profile",
    "assessment",
    "automation"
  ];
  return knownRails.includes(key) ? key : "chat";
};

// 会话数据集
const activeRail = ref(resolveRailFromPath(route.path));
watch(
  () => route.path,
  newPath => {
    activeRail.value = resolveRailFromPath(newPath);
  }
);
const activeCourse = ref<CourseView | null>(null);

// 侧边栏收起状态
const isMobileViewport = ref(false);
const sidebarCollapsed = ref(
  typeof window !== "undefined" &&
    (window.innerWidth <= 768 ||
      document.documentElement.classList.contains("qiming-native-webview") ||
      new URLSearchParams(window.location.search).get("qimingNative") === "1" ||
      new URLSearchParams(window.location.hash.split("?")[1] || "").get(
        "qimingNative"
      ) === "1")
);
const humanCollapsed = ref(false);
const toggleSidebar = () => (sidebarCollapsed.value = !sidebarCollapsed.value);
const toggleHuman = () => (humanCollapsed.value = !humanCollapsed.value);
const shouldShowFloatingHuman = computed(
  () => !isMobileViewport.value || Boolean(activeCourse.value)
);

type DigitalHumanState = "standby" | "listening" | "thinking" | "saying";

const digitalHumanStreamState = ref<DigitalHumanState | null>(null);
const digitalHumanState = computed<DigitalHumanState>(() => {
  if (digitalHumanStreamState.value) return digitalHumanStreamState.value;
  if (activeRail.value === "chat" && activeCourse.value) return "listening";
  return "standby";
});

const normalizeDigitalHumanState = (
  value?: string | null
): DigitalHumanState | null => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, "");

  if (!normalized) return null;

  const stateMap: Record<string, DigitalHumanState> = {
    idle: "standby",
    standby: "standby",
    waiting: "standby",
    wait: "standby",
    ready: "standby",
    待机: "standby",
    listening: "listening",
    listen: "listening",
    hearing: "listening",
    倾听: "listening",
    聆听: "listening",
    thinking: "thinking",
    think: "thinking",
    reasoning: "thinking",
    processing: "thinking",
    loading: "thinking",
    思考: "thinking",
    推理: "thinking",
    saying: "saying",
    speaking: "saying",
    speak: "saying",
    talking: "saying",
    answer: "saying",
    answering: "saying",
    explaining: "saying",
    讲解: "saying",
    说话: "saying",
    回答: "saying"
  };

  return stateMap[normalized] || null;
};

const applyDigitalHumanDirective = (event: AssistantChatStreamEvent) => {
  const directive = event.digital_human;
  const backendState = normalizeDigitalHumanState(
    directive?.state ||
      directive?.status ||
      directive?.phase ||
      directive?.action ||
      directive?.mode ||
      directive?.gesture ||
      directive?.emotion
  );

  if (backendState) {
    digitalHumanStreamState.value = backendState;
    return true;
  }

  return false;
};

// 数字人引用：右侧 VRM 面板负责原有展示，小圆圈负责轻量状态检查。
const virtualHumanRef = ref<{
  speak?: (text: string) => void;
  pauseRender?: () => void;
  resumeRender?: () => void;
} | null>(null);
const floatingHumanRef = ref<{
  speak?: (text: string) => void;
  pauseRender?: () => void;
  resumeRender?: () => void;
} | null>(null);

const speakDigitalHumans = (text: string) => {
  const speakText = text || "";
  if (!speakText) return;
  virtualHumanRef.value?.speak?.(speakText);
  floatingHumanRef.value?.speak?.(speakText);
};

const myCourses = ref<CourseView[]>([]);
const myStudents = ref<StudentView[]>([]);
const selectedStudentId = ref<number | undefined>();
const conversations = ref<ConversationView[]>([]);
const activeConversationId = ref("");

const routeCourseId = computed(() => {
  const raw = route.query.courseId || route.query.course_id;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const courseId = Number(value);
  return Number.isFinite(courseId) && courseId > 0 ? courseId : undefined;
});
const fallbackCourse = computed(
  () =>
    myCourses.value.find(
      course => course.id === assistantBootstrap.value?.selected_course_id
    ) ||
    myCourses.value[0] ||
    null
);
const effectiveCourse = computed(
  () => activeCourse.value || fallbackCourse.value
);
const selectedCourseId = computed(() => effectiveCourse.value?.id);
const selectedCourseName = computed(() => effectiveCourse.value?.name || "");
const selectedTargetStudentId = computed(() =>
  isStaffMode.value ? selectedStudentId.value : undefined
);

// 【请求还原】：保留原版所有的侧边功能项
const railItems = ref([
  { key: "chat", label: "互动答疑", icon: "ChatDotRound" },
  { key: "generation", label: "教学资源", icon: "FolderOpened" },
  { key: "agentpdf", label: "资料研读", icon: "Document" },
  { key: "path", label: "学习计划", icon: "Guide" },
  { key: "profile", label: "学情分析", icon: "User" },
  { key: "assessment", label: "测验评估", icon: "DataAnalysis" },
  { key: "automation", label: "常规任务", icon: "Check" }
]);

const selectedTaskId = ref("");

const routineTasks = ref([
  {
    id: "r1",
    title: "学情周报生成",
    desc: "每周五 18:00 自动汇总本周学习数据并生成专属报告",
    role: "student",
    status: "active",
    lastRun: "上周五 18:00",
    icon: "Calendar"
  },
  {
    id: "r2",
    title: "遗忘曲线复习推送",
    desc: "每日 20:00 基于艾宾浩斯曲线生成错题回顾任务",
    role: "student",
    status: "active",
    lastRun: "昨天 20:00",
    icon: "Bell"
  },
  {
    id: "r3",
    title: "课前预习资料速递",
    desc: "根据明日课表提前生成包含重难点的预习大纲",
    role: "student",
    status: "paused",
    lastRun: "-",
    icon: "Document"
  },
  {
    id: "r4",
    title: "班级共性错题汇总",
    desc: "每日 22:00 分析班级作业数据并生成共性盲点看板",
    role: "teacher",
    status: "active",
    lastRun: "昨天 22:00",
    icon: "DataBoard"
  },
  {
    id: "r5",
    title: "答疑区高频问题聚合",
    desc: "每周日 12:00 自动整理答疑区相似提问并生成FAQ",
    role: "teacher",
    status: "active",
    lastRun: "上周日 12:00",
    icon: "ChatLineRound"
  }
]);
const routineTaskRole = computed(() =>
  apiMode.value === "student" ? "student" : "teacher"
);
const visibleRoutineTasks = computed(() =>
  routineTasks.value.filter(task => task.role === routineTaskRole.value)
);

// === 智能画像、智能体与资源数据 ===
const profileDimensions = ref([
  { label: "知识基础", value: 85 },
  { label: "认知风格", value: 78 },
  { label: "易错点偏好", value: 65 },
  { label: "学习进度", value: 90 },
  { label: "探索欲", value: 82 },
  { label: "抗挫折能力", value: 88 }
]);

const agentTrace = ref<AssistantChatTraceStep[]>([]);
const generatedResources = ref<AssistantChatResource[]>([]);
const streamCancel = ref<null | (() => void)>(null);
const messages = ref<ChatMessageView[]>([]);

const agentItems = computed(() => {
  if (agentTrace.value.length) {
    return agentTrace.value.map((step, index) => ({
      id: `${step.agent}-${step.stage}-${index}`,
      name: step.agent || step.stage || "学习助手",
      desc: step.summary || step.stage || "处理中",
      status:
        step.status === "done" || step.status === "completed"
          ? "done"
          : "running"
    }));
  }

  return (assistantBootstrap.value?.agents || []).map(agent => ({
    id: agent.key,
    name: agent.label,
    desc: agent.description || "学习助手 Agent",
    status: "done"
  }));
});

const inspectorResources = computed(() =>
  generatedResources.value.map(resource => ({
    title: resource.title,
    kind: resource.type || "学习资源",
    desc: resource.desc || "学习助手推荐资源",
    eta: resource.preview_url ? "可预览" : "已生成",
    preview_url: resource.preview_url
  }))
);

const resetChatGreeting = () => {
  const courseName = selectedCourseName.value || "当前课程";
  messages.value = [
    {
      id: "assistant-greeting",
      role: "智能助教",
      type: "system",
      content:
        assistantBootstrap.value?.message ||
        `你好，${courseName} 的学习助手已就绪。你可以直接提出学习问题，我会结合课程、画像和学习路径给出建议。`
    }
  ];
};

const updateAssistantMessage = (
  id: string | number,
  patch: Partial<ChatMessageView>
) => {
  const target = messages.value.find(item => item.id === id);
  if (target) Object.assign(target, patch);
};

const handleAssistantStreamEvent = (
  event: AssistantChatStreamEvent,
  assistantMessageId: string | number
) => {
  const hasBackendHumanState = applyDigitalHumanDirective(event);

  if (event.conversation_id) {
    activeConversationId.value = event.conversation_id;
  }

  if (event.event === "conversation.created") {
    if (!hasBackendHumanState) digitalHumanStreamState.value = "thinking";
    void loadConversationGroups();
    return;
  }

  if (event.event === "assistant.delta") {
    if (!hasBackendHumanState) digitalHumanStreamState.value = "thinking";
    const target = messages.value.find(item => item.id === assistantMessageId);
    if (target) target.content += event.delta || "";
    return;
  }

  if (event.event === "assistant.completed") {
    const content = event.content_text || "";
    updateAssistantMessage(assistantMessageId, {
      content:
        content ||
        messages.value.find(item => item.id === assistantMessageId)?.content ||
        "学习助手已完成回复。",
      resources: event.resources || [],
      streaming: false
    });
    agentTrace.value = event.trace || [];
    generatedResources.value = event.resources || [];
    if (!hasBackendHumanState) digitalHumanStreamState.value = "saying";
    speakDigitalHumans(
      event.digital_human?.speech_text ||
        content ||
        event.digital_human?.highlight_text ||
        ""
    );
    isChatStreaming.value = false;
    window.setTimeout(() => {
      if (!isChatStreaming.value && digitalHumanStreamState.value === "saying") {
        digitalHumanStreamState.value = null;
      }
    }, 2400);
    void loadConversationGroups();
    return;
  }

  if (event.event === "error") {
    updateAssistantMessage(assistantMessageId, {
      content: event.error_message || "学习助手响应失败，请稍后重试。",
      streaming: false,
      error: true
    });
    isChatStreaming.value = false;
    digitalHumanStreamState.value = null;
    ElMessage.error(event.error_message || "学习助手响应失败");
  }
};

const handleSendMessage = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed || isChatStreaming.value) return;
  if (featureFlags.value.chat_stream === false) {
    ElMessage.warning("当前学习助手对话能力暂不可用");
    return;
  }
  if (!selectedCourseId.value) {
    ElMessage.warning("请先选择课程");
    return;
  }
  if (isStaffMode.value && !selectedTargetStudentId.value) {
    ElMessage.warning("教师/管理员模式下请先选择学生");
    return;
  }

  messages.value.push({
    id: `user-${Date.now()}`,
    role: currentUserRoleLabel.value,
    type: "user",
    content: trimmed,
    avatar: currentUserAvatar.value
  });

  const assistantMessageId = `assistant-${Date.now()}`;
  messages.value.push({
    id: assistantMessageId,
    role: "智能助教",
    type: "system",
    content: "",
    streaming: true
  });

  isChatStreaming.value = true;
  digitalHumanStreamState.value = "thinking";
  agentTrace.value = [];
  streamCancel.value?.();
  streamCancel.value = streamAssistantChat(
    {
      conversation_id: activeConversationId.value || undefined,
      course_id: selectedCourseId.value,
      target_student_id: selectedTargetStudentId.value,
      mode: apiMode.value,
      selected_agent: selectedAgentKey.value || undefined,
      skill_keys: selectedSkillKeys.value,
      selected_model: selectedModelKey.value || undefined,
      thinking_mode: thinkingModeKey.value || undefined,
      message: trimmed,
      attachment_ids: [],
      metadata: { ui_entry: "ai_app_workbench" }
    },
    event => handleAssistantStreamEvent(event, assistantMessageId)
  );
};

// === 栈操作预览弹窗 ===
const stackPreviewVisible = ref(false);
const stackItems = ref<{ key: number; value: string }[]>([
  { key: 1, value: "A" },
  { key: 2, value: "B" },
  { key: 3, value: "C" }
]);
let stackKeySeed = 100;
const stackLog = ref<string[]>(["初始状态：栈顶 -> C, B, A (最后压入 C)"]);
function stackPush() {
  const candidate = ["D", "E", "F", "G", "H", "X", "Y", "Z"];
  const v = candidate[Math.floor(Math.random() * candidate.length)];
  stackItems.value.push({ key: ++stackKeySeed, value: v });
  stackLog.value.unshift(`push(${v})  → 栈顶现为 ${v}`);
}
function stackPop() {
  if (!stackItems.value.length) {
    stackLog.value.unshift("pop() 失败：栈为空");
    return;
  }
  const top = stackItems.value[stackItems.value.length - 1];
  stackItems.value.pop();
  stackLog.value.unshift(
    `pop()    → 弹出 ${top.value}，现栈顶 ${stackItems.value[stackItems.value.length - 1]?.value || "空"}`
  );
}
function stackPeek() {
  const top = stackItems.value[stackItems.value.length - 1];
  stackLog.value.unshift(
    top ? `peek()   → 栈顶是 ${top.value}` : "peek() 失败：栈为空"
  );
}
function stackReset() {
  stackItems.value = [
    { key: ++stackKeySeed, value: "A" },
    { key: ++stackKeySeed, value: "B" },
    { key: ++stackKeySeed, value: "C" }
  ];
  stackLog.value = ["重置：栈顶 -> C, B, A"];
}
function handlePreview(res: any) {
  if (res?.type === "animation") {
    stackPreviewVisible.value = true;
    return;
  }
  if (res?.preview_url) {
    window.open(res.preview_url, "_blank");
  }
}

const formatConversationTime = (value?: string) => {
  if (!value) return "";
  return value.slice(5, 16);
};

const courseNameById = (courseId?: number) =>
  myCourses.value.find(course => course.id === courseId)?.name ||
  selectedCourseName.value ||
  "未命名课程";

const normalizeConversation = (
  item: AssistantConversationItem,
  fallbackCourseName?: string
): ConversationView => ({
  ...item,
  id: item.conversation_id,
  title: item.title || "未命名会话",
  time: formatConversationTime(item.last_message_at),
  course: fallbackCourseName || courseNameById(item.course_id),
  courseId: item.course_id,
  status: item.message_count > 0 ? "已同步" : "新会话"
});

const optionLabel = (options: AssistantOption[], key: string) =>
  options.find(item => item.key === key)?.label || key;

const selectedAgentLabel = computed(() =>
  optionLabel(assistantBootstrap.value?.agents || [], selectedAgentKey.value)
);
const selectedModelLabel = computed(() =>
  optionLabel(assistantBootstrap.value?.models || [], selectedModelKey.value)
);
const thinkingModeLabel = computed(() =>
  optionLabel(
    assistantBootstrap.value?.thinking_modes || [],
    thinkingModeKey.value
  )
);

const applyBootstrap = (data: AssistantBootstrapResp) => {
  assistantBootstrap.value = data;
  myCourses.value = (data.courses || []).map(course => ({
    ...course,
    id: course.course_id,
    name: course.course_name
  }));
  myStudents.value = (data.students || []).map(student => ({
    ...student,
    id: student.student_id,
    name: student.student_name,
    avatar:
      student.avatar ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.student_id}`
  }));

  selectedStudentId.value = data.selected_student_id || myStudents.value[0]?.id;
  const previousCourseId = activeCourse.value?.id;
  const routeSelectedCourse = routeCourseId.value
    ? myCourses.value.find(course => course.id === routeCourseId.value)
    : null;
  const preservedCourse = previousCourseId
    ? myCourses.value.find(course => course.id === previousCourseId)
    : null;
  activeCourse.value = routeSelectedCourse || preservedCourse || null;
  selectedAgentKey.value = data.agents?.[0]?.key || "";
  selectedModelKey.value = data.models?.[0]?.key || "";
  thinkingModeKey.value = data.thinking_modes?.[0]?.key || "";
  selectedSkillKeys.value = (data.skills || [])
    .filter((skill: AssistantSkill) => skill.default_on)
    .map(skill => skill.key);

  if (activeCourse.value) {
    resetChatGreeting();
  } else {
    activeConversationId.value = "";
    messages.value = [];
  }
};

const loadAssistantBootstrap = async () => {
  isBootstrapping.value = true;
  try {
    const { data } = await getAssistantBootstrap({
      course_id: selectedCourseId.value,
      target_student_id: selectedTargetStudentId.value
    });
    applyBootstrap(data);
    await loadConversationGroups();
  } catch (error: any) {
    console.error("[AiApp] 学习助手启动上下文加载失败:", error);
    ElMessage.error(error?.message || "学习助手启动上下文加载失败");
  } finally {
    isBootstrapping.value = false;
  }
};

const loadConversationGroups = async () => {
  try {
    const { data } = await getAssistantConversationGroups({
      target_student_id: selectedTargetStudentId.value
    });
    conversations.value = (data.list || []).flatMap(group =>
      (group.conversations || []).map(item =>
        normalizeConversation(item, group.course_name)
      )
    );
  } catch (error) {
    console.error("[AiApp] 学习助手会话加载失败:", error);
  }
};

const loadConversationMessages = async (conversation: ConversationView) => {
  if (!conversation.conversation_id) return;
  try {
    const { data } = await getAssistantConversationMessages(
      conversation.conversation_id
    );
    activeConversationId.value = conversation.conversation_id;
    const course =
      myCourses.value.find(item => item.id === conversation.course_id) ||
      myCourses.value.find(item => item.name === conversation.course);
    if (course) activeCourse.value = course;
    messages.value = (data.list || []).map(item => ({
      id: item.message_id,
      role: item.role === "user" ? currentUserRoleLabel.value : "智能助教",
      type: item.role === "user" ? "user" : "system",
      content: item.content_text || "",
      avatar: item.role === "user" ? currentUserAvatar.value : undefined
    }));
    if (!messages.value.length) resetChatGreeting();
  } catch (error: any) {
    console.error("[AiApp] 学习助手会话消息加载失败:", error);
    ElMessage.error(error?.message || "会话消息加载失败");
  }
};

const handleSwitchCourse = (courseName: string) => {
  const target = myCourses.value.find(course => course.name === courseName);
  if (!target) return;
  activeCourse.value = target;
  activeConversationId.value = "";
  resetChatGreeting();
};

const handleProfileLoaded = (payload: { dimensions?: any[] }) => {
  if (payload.dimensions?.length) {
    profileDimensions.value = payload.dimensions;
  }
};

const goBack = () => {
  if (window.history.state && window.history.length > 1) {
    router.back();
  } else {
    router.push("/");
  }
};

onMounted(() => {
  if (route.query.newTab === "true") {
    isNewTab.value = true;
    document.title = `学习助手 (${mode.value})`;
  }
  void loadAssistantBootstrap();
});

const quickMessage = ref("");
const quickCourse = ref("");
const quickInteractionMessages = [
  "老师好",
  "这一段没听懂",
  "请再讲一遍",
  "我做完了"
];

const handleQuickInteraction = (text: string) => {
  speakDigitalHumans(text);
};

const handleNewChat = (payload: { course: string }) => {
  const course = myCourses.value.find(item => item.name === payload.course);
  if (course) activeCourse.value = course;
  activeConversationId.value = "";
  resetChatGreeting();
  if (quickMessage.value.trim()) {
    // 切换到聊天栏目，确保数字人状态与课程上下文同步。
    activeRail.value = "chat";
    // 微延时等待课程上下文切换完成。
    setTimeout(() => {
      handleSendMessage(quickMessage.value);
      quickMessage.value = "";
    }, 100);
  }
};

const syncHumanRenderState = () => {
  if (!virtualHumanRef.value) return;
  const shouldPause =
    document.hidden || activeRail.value !== "chat" || humanCollapsed.value;
  if (shouldPause) {
    virtualHumanRef.value.pauseRender?.();
  } else {
    virtualHumanRef.value.resumeRender?.();
  }
};

watch([activeRail, humanCollapsed], () => {
  syncHumanRenderState();
});

const updateMobileViewportState = () => {
  isMobileViewport.value = window.innerWidth <= 768;
  if (isMobileViewport.value) {
    sidebarCollapsed.value = true;
    humanCollapsed.value = false;
  }
  syncHumanRenderState();
};

watch(selectedStudentId, () => {
  if (isBootstrapping.value || !assistantBootstrap.value || !isStaffMode.value)
    return;
  activeConversationId.value = "";
  resetChatGreeting();
  void loadAssistantBootstrap();
});

const handleVisibilityChange = () => {
  syncHumanRenderState();
};

onMounted(() => {
  updateMobileViewportState();
  window.addEventListener("resize", updateMobileViewportState, {
    passive: true
  });
  document.addEventListener("visibilitychange", handleVisibilityChange);
  setTimeout(() => {
    syncHumanRenderState();
  }, 0);
});

onUnmounted(() => {
  streamCancel.value?.();
  window.removeEventListener("resize", updateMobileViewportState);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
});
</script>

<template>
  <div
    class="ai-app-root h-[100dvh] w-full flex flex-col overflow-hidden bg-white"
    :class="[
      activeRail === 'chat'
        ? 'bg-gradient-to-br from-[rgb(253,229,250)] via-[rgb(233,231,255)] to-[rgb(254,214,233)]'
        : '',
      currentTheme
    ]"
  >
    <div class="flex-1 min-h-0 flex overflow-hidden">
      <!-- 极简左侧边栏 (第一块) -->
      <aside
        v-if="activeRail === 'chat'"
        class="ai-app-left-rail flex-shrink-0 z-20 bg-white border-r border-gray-100 flex flex-col transition-all duration-300 relative"
        :class="sidebarCollapsed ? 'is-collapsed w-[34px]' : 'w-[260px]'"
      >
        <div v-show="!sidebarCollapsed" class="flex-1 overflow-hidden">
          <AiSidebar
            v-model:activeRail="activeRail"
            :conversations="conversations"
            :courses="myCourses.map(course => course.name)"
            @new-chat="handleNewChat"
            @select-chat="loadConversationMessages"
          />
        </div>

        <!-- 收起态：桌面保留竖向标识，移动端仅保留独立按钮 -->
        <div
          v-show="sidebarCollapsed && !isMobileViewport"
          class="flex-1 flex flex-col items-center justify-center text-gray-400 select-none cursor-pointer collapsed-rail-label"
          @click="toggleSidebar"
        >
          <el-icon :size="14" class="rotate-90 mb-2"><FolderOpened /></el-icon>
          <span
            class="text-[11px] tracking-widest"
            style="writing-mode: vertical-rl"
            >课程 · 历史</span
          >
        </div>

        <!-- 收起 / 展开 把手 -->
        <button
          class="absolute top-3 -right-3 w-6 h-6 rounded-md bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-500 hover:text-primary hover:border-primary/40 hover:scale-110 transition-all z-30"
          :class="{ 'is-mobile-collapsed-trigger': sidebarCollapsed && isMobileViewport }"
          :title="sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'"
          @click="toggleSidebar"
        >
          <el-icon :size="12">
            <Expand v-if="sidebarCollapsed" />
            <Fold v-else />
          </el-icon>
        </button>
      </aside>

      <!-- 右边总体容器 (主体) -->
      <div class="flex-1 flex flex-col min-w-0">
        <!-- 教师专属：顶部学生选择器工具栏 -->
        <div
          v-if="
            isStaffMode &&
            ['path', 'profile', 'assessment'].includes(activeRail)
          "
          class="flex-none flex items-center justify-end gap-3 bg-white px-6 py-3 border-b border-gray-100 z-10 relative shadow-sm"
        >
          <span class="text-xs text-gray-500 font-medium">分析对象:</span>
          <el-select
            v-model="selectedStudentId"
            placeholder="请选择学生"
            size="small"
            style="width: 160px"
            class="student-select"
          >
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
            <el-option
              v-for="item in myStudents"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            >
              <div class="flex items-center gap-2">
                <el-avatar :size="18" :src="item.avatar" />
                <span class="text-sm">{{ item.name }}</span>
              </div>
            </el-option>
          </el-select>
        </div>

        <!-- 主体内容 (第三块) -->
        <main class="flex-1 overflow-hidden relative">
          <!-- 【场景 A1】 智能辅导对谈框 (已选课) -->
          <div
            v-if="activeRail === `chat` && activeCourse"
            class="ai-chat-scene h-full w-full min-w-0 flex stretch p-4 gap-4 overflow-hidden"
          >
            <!-- 对话流核心面板 -->
            <transition appear name="panel-slide">
              <div
                class="ai-chat-card flex-1 h-full bg-white/70 backdrop-blur-xl rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-white/50 overflow-hidden relative group transition-all duration-500 hover:shadow-[0_20px_40px_rgba(94,127,248,0.1)]"
              >
                <!-- 柔和的顶部遮罩渐变 -->
                <div
                  class="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-white/80 to-transparent pointer-events-none z-10"
                />
                <AiChatModule
                  :messages="messages"
                  :activeCourse="activeCourse.name"
                  :courses="myCourses.map(course => course.name)"
                  :mode="mode"
                  :user-avatar="currentUserAvatar"
                  :agents="assistantBootstrap?.agents || []"
                  :models="assistantBootstrap?.models || []"
                  :thinkingModes="assistantBootstrap?.thinking_modes || []"
                  :selectedAgent="selectedAgentLabel"
                  :selectedModel="selectedModelLabel"
                  :thinkingMode="thinkingModeLabel"
                  :loading="isChatStreaming"
                  @send="handleSendMessage"
                  @preview="handlePreview"
                  @switch-course="handleSwitchCourse"
                  @update:selectedAgent="selectedAgentKey = $event"
                  @update:selectedModel="selectedModelKey = $event"
                  @update:thinkingMode="thinkingModeKey = $event"
                />
              </div>
            </transition>

            <!-- 数字人面板：保留原右侧 VRM 数字人模块 -->
            <transition appear name="panel-reveal">
              <div
                class="ai-app-human-panel flex-shrink-0 h-full flex flex-col gap-4 transition-all duration-700 cubic-bezier(0.34, 1.56, 0.64, 1) relative"
                :class="humanCollapsed ? 'w-16' : 'w-[420px]'"
              >
                <!-- 收起 / 展开把手：挂在外层，避免被圆角容器裁切 -->
                <button
                  class="absolute top-4 left-0 -translate-x-1/2 w-7 h-7 rounded-full bg-white/95 backdrop-blur border border-gray-200 shadow-md flex items-center justify-center text-gray-500 hover:text-primary hover:border-primary/40 hover:scale-110 transition-all z-[140]"
                  :title="humanCollapsed ? '展开数字人' : '收起数字人'"
                  @click="toggleHuman"
                >
                  <el-icon :size="12">
                    <Fold v-if="humanCollapsed" />
                    <Expand v-else />
                  </el-icon>
                </button>

                <div
                  class="flex-1 bg-white/70 backdrop-blur-xl rounded-[2.5rem] shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-white/50 overflow-hidden relative"
                >
                  <VirtualHumanPanel
                    ref="virtualHumanRef"
                    v-show="!humanCollapsed"
                  />

                  <div
                    v-show="humanCollapsed"
                    class="h-full flex flex-col items-center justify-center text-gray-400 select-none cursor-pointer gap-6 group/btn"
                    @click="toggleHuman"
                  >
                    <div
                      class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover/btn:scale-125 transition-transform duration-500"
                    >
                      <el-icon :size="20"><Avatar /></el-icon>
                    </div>
                    <span
                      class="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 group-hover/btn:text-primary transition-colors"
                      style="writing-mode: vertical-rl"
                    >
                      专属助教
                    </span>
                  </div>
                </div>

                <transition name="el-zoom-in-bottom">
                  <div
                    v-show="!humanCollapsed"
                    class="ai-human-actions flex-none bg-white/80 backdrop-blur-md rounded-2xl border border-white/60 p-3 shadow-md flex flex-col gap-2 overflow-hidden z-[100]"
                    style="min-height: 180px"
                  >
                    <div
                      class="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center border-b border-gray-100 pb-1.5 mb-1"
                    >
                      快速互动
                    </div>
                    <div class="flex flex-col gap-2">
                      <el-button
                        v-for="msg in quickInteractionMessages"
                        :key="msg"
                        type="primary"
                        plain
                        size="default"
                        class="!w-full !m-0 !text-[12px] !rounded-xl !border-blue-100 !bg-blue-50/50 hover:!bg-blue-500 hover:!text-white transition-all duration-300"
                        @click="handleQuickInteraction(msg)"
                      >
                        {{ msg }}
                      </el-button>
                    </div>
                  </div>
                </transition>
              </div>
            </transition>
          </div>

          <!-- 【场景 A2】 智能辅导欢迎中心 (未选课) -->
          <div
            v-else-if="activeRail === `chat` && !activeCourse"
            class="ai-chat-welcome h-full w-full p-4 flex items-center justify-center relative"
          >
            <!-- 背景装饰 -->
            <div class="absolute inset-0 overflow-hidden pointer-events-none">
              <div
                class="absolute -top-[10%] -right-[5%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-3xl opacity-60"
              />
              <div
                class="absolute -bottom-[10%] -left-[5%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-3xl opacity-60"
              />
            </div>

            <div
              class="ai-chat-welcome-card w-full max-w-3xl px-6 space-y-10 relative z-10 transform -translate-y-8"
            >
              <div class="ai-chat-welcome-human">
                <VirtualHumanPanel ref="virtualHumanRef" />
                <div class="ai-chat-welcome-actions">
                  <button
                    v-for="msg in quickInteractionMessages"
                    :key="`welcome-${msg}`"
                    type="button"
                    @click="handleQuickInteraction(msg)"
                  >
                    {{ msg }}
                  </button>
                </div>
              </div>

              <div class="text-center space-y-4">
                <h1
                  class="text-3xl sm:text-[38px] font-bold tracking-tight gradient-text-animate"
                >
                  今天想学习什么？
                </h1>
                <p
                  class="text-[15px] font-medium tracking-wide"
                  style="color: rgba(140, 80, 159, 0.7)"
                >
                  请先选择一门课程，然后随时寻求学习辅导
                </p>
              </div>

              <div
                class="quick-chat-box bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 focus-within:shadow-[0_8px_30px_rgb(0,0,0,0.08)] focus-within:border-primary/20 transition-all duration-500 overflow-hidden"
              >
                <el-input
                  v-model="quickMessage"
                  type="textarea"
                  :autosize="{ minRows: 2, maxRows: 8 }"
                  placeholder="可以输入想要了解的知识点。输入 @ 提及课程或文件..."
                  class="quick-chat-input"
                  resize="none"
                  @keyup.enter.prevent="
                    quickCourse ? handleNewChat({ course: quickCourse }) : null
                  "
                />

                <div
                  class="flex items-center justify-between px-4 py-3 bg-gray-50/50 border-t border-gray-50"
                >
                  <div class="flex flex-wrap items-center gap-1.5">
                    <el-dropdown
                      trigger="click"
                      @command="c => (quickCourse = c)"
                    >
                      <span
                        class="inline-flex items-center px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors"
                        :class="
                          quickCourse
                            ? 'bg-primary/10 text-primary'
                            : 'text-gray-600 hover:bg-gray-100 cursor-pointer'
                        "
                      >
                        <el-icon class="mr-1.5 text-[14px]"
                          ><FolderOpened
                        /></el-icon>
                        {{ quickCourse || "选择课程" }}
                        <el-icon class="ml-1 text-[12px]"
                          ><ArrowDown
                        /></el-icon>
                      </span>
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item
                            v-for="c in myCourses"
                            :key="c.id"
                            :command="c.name"
                          >
                            {{ c.name }}
                          </el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>

                    <span
                      class="inline-flex items-center px-3 py-1.5 rounded-xl text-[13px] font-medium text-gray-600 bg-gray-100"
                    >
                      <el-icon class="mr-1.5 text-[14px]"><Monitor /></el-icon>
                      {{ mode }}
                    </span>

                    <el-dropdown
                      trigger="click"
                      @command="a => (selectedAgentKey = a)"
                    >
                      <span
                        class="inline-flex items-center px-3 py-1.5 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors"
                      >
                        <el-icon class="mr-1.5 text-[14px]"><Cpu /></el-icon>
                        {{ selectedAgentLabel || "选择助手" }}
                        <el-icon class="ml-1 text-[12px]"
                          ><ArrowDown
                        /></el-icon>
                      </span>
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item
                            v-for="agent in assistantBootstrap?.agents || []"
                            :key="agent.key"
                            :command="agent.key"
                          >
                            {{ agent.label }}
                          </el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                  </div>

                  <div class="flex items-center gap-3">
                    <span
                      class="text-[12px] text-gray-400 font-medium tracking-wide flex items-center pr-2 cursor-pointer hover:text-gray-600 transition-colors"
                    >
                      {{ selectedModelLabel || "选择模型" }}
                      <el-icon class="ml-1"><ArrowDown /></el-icon>
                    </span>
                    <button
                      class="w-10 h-10 flex items-center justify-center rounded-xl transition-all transform border"
                      :class="
                        quickCourse && quickMessage.trim()
                          ? 'bg-[#c199f9] border-[#c199f9] text-white hover:bg-[#b085f7] hover:scale-105 shadow-lg shadow-purple-100 cursor-pointer'
                          : 'bg-white border-gray-200 text-gray-300 cursor-not-allowed'
                      "
                      :disabled="!quickCourse || !quickMessage.trim()"
                      @click="
                        quickCourse
                          ? handleNewChat({ course: quickCourse })
                          : null
                      "
                    >
                      <el-icon
                        class="text-lg"
                        :class="
                          quickCourse && quickMessage.trim() ? '' : 'font-bold'
                        "
                        ><Top
                      /></el-icon>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 【场景 B】 Agent PDF 工作台 -->
          <div
            v-else-if="activeRail === `agentpdf`"
            class="h-full w-full overflow-hidden"
          >
            <div class="h-full bg-white overflow-hidden">
              <AgentPdfWorkbench :service-url="pdfServiceUrl" />
            </div>
          </div>

          <div v-else-if="activeRail === `generation`" class="h-full w-full">
            <div class="h-full bg-white overflow-hidden">
              <AiResourceGeneration
                :course-id="selectedCourseId"
                :target-student-id="selectedTargetStudentId"
              />
            </div>
          </div>

          <div v-else-if="activeRail === `path`" class="h-full w-full">
            <div
              v-if="isStaffMode && !selectedStudentId"
              class="h-full w-full flex items-center justify-center bg-white"
            >
              <div
                class="flex flex-col items-center justify-center bg-transparent lottie-empty-state"
              >
                <LottieAnimation
                  :animationData="onlineChartAnimation"
                  :width="360"
                  :height="360"
                />
                <h3 class="mt-4 text-lg font-black text-gray-600">
                  尚未选择学生
                </h3>
                <p class="mt-2 text-sm text-gray-400">
                  请在顶部选择需要分析的学生以查看个性化路径规划
                </p>
              </div>
            </div>
            <div v-else class="h-full bg-white overflow-hidden">
              <AiLearningPath
                :course-id="selectedCourseId"
                :target-student-id="selectedTargetStudentId"
              />
            </div>
          </div>

          <div
            v-else-if="activeRail === `profile`"
            class="h-full w-full p-4 bg-white"
          >
            <div
              v-if="isStaffMode && !selectedStudentId"
              class="h-full w-full flex items-center justify-center"
            >
              <div
                class="flex flex-col items-center justify-center bg-transparent lottie-empty-state"
              >
                <LottieAnimation
                  :animationData="emptyStateDevelopmentAnimation"
                  :width="360"
                  :height="360"
                />
                <h3 class="mt-4 text-lg font-black text-gray-600">
                  尚未选择学生
                </h3>
                <p class="mt-2 text-sm text-gray-400">
                  请在顶部选择学生以查看学习画像与学情分析
                </p>
              </div>
            </div>
            <div v-else class="h-full flex gap-4 overflow-hidden">
              <!-- 左：完整学习画像 -->
              <div
                class="flex-1 h-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <AiLearningProfile
                  :course-id="selectedCourseId"
                  :target-student-id="selectedTargetStudentId"
                  @profile-loaded="handleProfileLoaded"
                />
              </div>
              <!-- 右：原 chat 右侧的画像 / 智能体 / 拓展资源 选项卡 -->
              <div
                class="w-[360px] flex-shrink-0 h-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <AiInspector
                  :profileDimensions="profileDimensions"
                  :agentItems="agentItems"
                  :resources="inspectorResources"
                />
              </div>
            </div>
          </div>

          <div v-else-if="activeRail === `assessment`" class="h-full w-full">
            <div
              v-if="isStaffMode && !selectedStudentId"
              class="h-full w-full flex items-center justify-center bg-white"
            >
              <div
                class="flex flex-col items-center justify-center bg-transparent lottie-empty-state"
              >
                <LottieAnimation
                  :animationData="saasAnimation"
                  :width="360"
                  :height="360"
                />
                <h3 class="mt-4 text-lg font-black text-gray-600">
                  尚未选择学生
                </h3>
                <p class="mt-2 text-sm text-gray-400">
                  请在顶部选择学生以查看学习评估报告
                </p>
              </div>
            </div>
            <div v-else class="h-full bg-white overflow-hidden">
              <AiAssessment
                :course-id="selectedCourseId"
                :target-student-id="selectedTargetStudentId"
              />
            </div>
          </div>

          <!-- 【场景 C】 常规任务 (原自动化) -->
          <div
            v-else-if="activeRail === `automation`"
            class="h-full w-full overflow-hidden flex justify-center bg-white"
          >
            <div
              class="flex w-full h-full gap-4 transition-all duration-500 ease-in-out p-6"
              :class="selectedTaskId ? 'max-w-full' : 'max-w-5xl'"
            >
              <!-- 左侧：任务列表 -->
              <div
                class="h-full bg-white p-2 overflow-y-auto transition-all duration-500"
                :class="selectedTaskId ? 'w-[45%]' : 'w-full'"
              >
                <div class="mb-8">
                  <h2 class="text-2xl font-bold text-gray-800">常规任务计划</h2>
                  <p class="text-sm text-gray-500 mt-2">
                    助手会在后台为您自动执行这些周期性或触发式任务，提升教与学的效率。
                  </p>
                </div>

                <div class="space-y-4">
                  <div
                    v-for="task in visibleRoutineTasks"
                    :key="task.id"
                    class="flex items-start justify-between p-5 rounded-2xl border transition-all group cursor-pointer"
                    :class="
                      selectedTaskId === task.id
                        ? 'border-primary/40 bg-primary/5 shadow-md shadow-primary/10'
                        : 'border-gray-100 hover:border-primary/20 hover:shadow-md bg-gray-50/50'
                    "
                    @click="selectedTaskId = task.id"
                  >
                    <div class="flex items-start gap-4">
                      <div
                        class="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center transition-transform"
                        :class="
                          selectedTaskId === task.id
                            ? 'text-primary scale-110'
                            : 'text-primary group-hover:scale-110'
                        "
                      >
                        <component :is="task.icon" class="w-6 h-6" />
                      </div>
                      <div>
                        <h4
                          class="text-base font-semibold text-gray-800 flex items-center gap-2"
                        >
                          {{ task.title }}
                          <span
                            class="px-2 py-0.5 text-[10px] rounded-full"
                            :class="
                              task.status === 'active'
                                ? 'bg-green-100 text-green-600'
                                : 'bg-gray-200 text-gray-500'
                            "
                          >
                            {{ task.status === "active" ? "运行中" : "已暂停" }}
                          </span>
                        </h4>
                        <p class="text-sm text-gray-500 mt-1 line-clamp-2">
                          {{ task.desc }}
                        </p>
                        <p
                          class="text-xs text-gray-400 mt-2 flex items-center gap-1"
                        >
                          <el-icon><Clock /></el-icon> 上次执行：{{
                            task.lastRun
                          }}
                        </p>
                      </div>
                    </div>
                    <div
                      class="flex flex-col items-end justify-between h-full pl-2"
                    >
                      <el-switch
                        v-model="task.status"
                        active-value="active"
                        inactive-value="paused"
                        style="--el-switch-on-color: var(--el-color-primary)"
                        @click.stop
                      />
                      <el-button
                        type="primary"
                        link
                        class="mt-4 transition-opacity"
                        :class="
                          selectedTaskId === task.id
                            ? 'opacity-100 font-bold'
                            : 'opacity-0 group-hover:opacity-100'
                        "
                      >
                        记录 <el-icon class="ml-1"><ArrowRight /></el-icon>
                      </el-button>
                    </div>
                  </div>

                  <div
                    v-if="visibleRoutineTasks.length === 0"
                    class="text-center py-12 text-gray-400"
                  >
                    <el-empty
                      description="暂无计划中的常规任务"
                      :image-size="120"
                    />
                  </div>
                </div>
              </div>

              <!-- 右侧：历史记录面板 -->
              <div
                v-if="selectedTaskId"
                class="flex-1 h-full bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col overflow-hidden animate-fade-in"
              >
                <!-- 头部 -->
                <div
                  class="flex items-center justify-between p-6 border-b border-gray-50"
                >
                  <div class="flex items-center gap-3">
                    <div
                      class="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center"
                    >
                      <el-icon :size="20"><Document /></el-icon>
                    </div>
                    <div>
                      <h3 class="text-lg font-bold text-gray-800">
                        {{
                          routineTasks.find(t => t.id === selectedTaskId)?.title
                        }}
                      </h3>
                      <p class="text-[13px] text-gray-400 mt-0.5">
                        任务执行历史记录
                      </p>
                    </div>
                  </div>
                  <el-button
                    circle
                    plain
                    size="small"
                    @click="selectedTaskId = ''"
                  >
                    <el-icon><Close /></el-icon>
                  </el-button>
                </div>

                <!-- 时间轴区域 -->
                <div class="flex-1 overflow-y-auto p-8 relative bg-gray-50/30">
                  <el-empty description="暂无真实执行记录" :image-size="120" />
                </div>
              </div>
            </div>
          </div>

          <!-- 【场景 D】 其他未开发项 -->
          <div
            v-else
            class="h-full w-full flex items-center justify-center p-4"
          >
            <div
              class="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-gray-100 shadow-[0_2px_20px_rgba(0,0,0,0.02)] w-full max-w-2xl transform hover:scale-[1.01] transition-transform duration-500"
            >
              <el-icon :size="80" class="text-gray-200 mb-6 drop-shadow-sm"
                ><Box
              /></el-icon>
              <h3 class="text-xl font-black text-gray-700 mb-2">
                正在积极建设中
              </h3>
              <p class="text-sm text-gray-400">
                目前「{{
                  railItems.find(r => r.key === activeRail)?.label
                }}」属于预期规划内，即将上线，敬请期待...
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>

    <FloatingDigitalHuman2D
      v-if="shouldShowFloatingHuman"
      ref="floatingHumanRef"
      :role-label="currentUserRoleLabel"
      :course-name="selectedCourseName"
      :state="digitalHumanState"
      anchor="appLeftBottom"
      anchor-selector=".ai-app-root"
      :left-zone-width="sidebarCollapsed ? 34 : 260"
      :bottom-offset="isMobileViewport ? 24 : 104"
      :storage-key="
        isMobileViewport
          ? 'ai-app-floating-digital-human-2d-mobile-status'
          : 'ai-app-floating-digital-human-2d-left-bottom'
      "
    />

    <!-- 栈操作可视化预览弹窗 -->
    <el-dialog
      v-model="stackPreviewVisible"
      title="栈 (Stack) 操作可视化"
      width="640px"
      align-center
      destroy-on-close
    >
      <div class="flex gap-6">
        <!-- 栈可视化区 -->
        <div
          class="relative w-44 h-72 mx-auto bg-gradient-to-b from-indigo-50 to-purple-50 rounded-2xl border-2 border-dashed border-indigo-300 flex flex-col-reverse items-center p-3 gap-2 overflow-hidden"
        >
          <div
            class="absolute top-2 left-3 text-[11px] font-bold text-indigo-500"
          >
            栈顶 (top) ↑
          </div>
          <div
            class="absolute bottom-2 right-3 text-[11px] font-bold text-purple-500"
          >
            栈底 (bottom)
          </div>
          <transition-group
            name="stack-anim"
            tag="div"
            class="flex flex-col-reverse gap-2 w-full items-center"
          >
            <div
              v-for="item in stackItems"
              :key="item.key"
              class="w-28 h-9 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold flex items-center justify-center shadow-lg"
            >
              {{ item.value }}
            </div>
          </transition-group>
          <div
            v-if="!stackItems.length"
            class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm"
          >
            栈为空
          </div>
        </div>

        <!-- 操作 + 日志 -->
        <div class="flex-1 flex flex-col gap-3">
          <div class="flex flex-wrap gap-2">
            <el-button type="primary" @click="stackPush">push 压栈</el-button>
            <el-button type="danger" @click="stackPop">pop 出栈</el-button>
            <el-button type="warning" @click="stackPeek">peek 栈顶</el-button>
            <el-button @click="stackReset">重置</el-button>
          </div>
          <div class="text-xs text-gray-500">
            栈大小：<b class="text-indigo-600">{{ stackItems.length }}</b> ｜
            栈顶元素：<b class="text-pink-600">{{
              stackItems[stackItems.length - 1]?.value || "—"
            }}</b>
          </div>
          <div
            class="flex-1 min-h-[180px] max-h-[220px] overflow-auto rounded-lg bg-gray-900 text-emerald-300 font-mono text-[12px] p-3 leading-relaxed"
          >
            <div v-for="(line, i) in stackLog" :key="i">› {{ line }}</div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="stackPreviewVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.stack-anim-enter-active,
.stack-anim-leave-active {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.stack-anim-enter-from {
  opacity: 0;
  transform: translateY(-30px) scale(0.7);
}
.stack-anim-leave-to {
  opacity: 0;
  transform: translateY(-40px) scale(0.7);
}
</style>

<style scoped lang="scss">
.ai-app-root {
  --el-color-primary: #5e7ff8; // 强制保持平台蓝
  --ai-app-font:
    "Inter", "NotionInter", -apple-system, BlinkMacSystemFont, "Segoe UI",
    "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Helvetica, Arial,
    sans-serif;

  font-family: var(--ai-app-font);
  font-synthesis-weight: none;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;

  :global(html.dark) & {
    color: var(--qiming-native-text-primary, #f8fafc);
    background: var(--qiming-native-page-bg, #020409) !important;
  }
}

.ai-app-root :deep(*) {
  font-family: var(--ai-app-font);
}

.ai-app-root :deep(.iconfont),
.ai-app-root :deep([class^="el-icon-"]),
.ai-app-root :deep([class*=" el-icon-"]),
.ai-app-root :deep(.iconify) {
  font-family:
    "iconfont", element-icons, "IconifyIconOnline", "IconifyIconOffline", sans-serif !important;
}

/* 让 Lottie 空状态动画的白色区域与渐变背景融合，呈现真正的"透明"效果 */
.lottie-empty-state {
  :deep(svg) {
    mix-blend-mode: multiply;
    background: transparent !important;
  }
}

/* 全局交互 UI 增强 */
:deep(.el-radio-button__inner) {
  border-radius: 12px !important;
  margin: 0 4px;
  border: 1px solid transparent !important;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  &:hover {
    background: rgba(94, 127, 248, 0.05);
  }
}

:deep(.student-select .el-input__wrapper) {
  border-radius: 12px !important;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.03) !important;
  transition: all 0.3s ease;
  &:hover {
    box-shadow: 0 4px 16px rgba(94, 127, 248, 0.1) !important;
  }
}

/* 面板转场动画 */
.panel-slide-enter-active {
  transition: all 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.panel-slide-enter-from {
  opacity: 0;
  transform: translateX(-30px) scale(0.98);
}

.panel-reveal-enter-active {
  transition: all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.panel-reveal-enter-from {
  opacity: 0;
  transform: translateX(50px) rotate(1deg);
}

.gradient-text-animate {
  background: linear-gradient(
    -45deg,
    rgb(140, 80, 159),
    rgb(190, 120, 200),
    rgb(140, 80, 159)
  );
  background-size: 200% auto;
  color: transparent;
  -webkit-background-clip: text;
  background-clip: text;
  animation: gradientShift 6s ease-in-out infinite;
}

@keyframes gradientShift {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

.placeholder-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: white;
  h2 {
    margin-top: 20px;
    font-weight: bold;
  }
  p {
    color: #666;
    margin-top: 10px;
  }
  .reopen-btn {
    margin-top: 30px;
    padding: 10px 24px;
    border-radius: 20px;
    border: 1px solid #ddd;
    background: none;
    cursor: pointer;
  }
}

.pulse-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 20px;
  font-weight: 900;
  color: var(--el-color-primary);
  letter-spacing: -0.5px;
  &::before {
    content: "";
    display: block;
    width: 24px;
    height: 24px;
    background: linear-gradient(135deg, var(--el-color-primary), #829eff);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(94, 127, 248, 0.3);
    animation: simple-pulse 2s infinite;
  }
  &::after {
    content: "IntellEdu";
  }
}

:deep(.quick-chat-input) {
  font-size: 15px;
  color: #374151;
  background-color: transparent !important;
  .el-textarea__inner {
    border: none !important;
    box-shadow: none !important;
    padding: 16px 20px;
    background-color: transparent !important;
    color: #374151;
    &::placeholder {
      color: #9ca3af;
    }
  }
}

@keyframes simple-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(94, 127, 248, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(94, 127, 248, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(94, 127, 248, 0);
  }
}

@media (max-width: 768px) {
  .ai-app-root {
    width: 100%;
    height: var(--qiming-native-vh, 100dvh);
    min-height: var(--qiming-native-vh, 100dvh);
    min-width: 0;
    overflow: hidden;
  }

  .ai-app-root > .flex-1 {
    min-width: 0;
  }

  .ai-app-root > .flex-1 > .flex-1 {
    width: 100%;
  }

  .ai-app-left-rail {
    position: fixed !important;
    top: calc(24px + var(--pure-safe-area-top, 0px));
    bottom: calc(82px + var(--pure-safe-area-bottom, 0px));
    left: 18px;
    z-index: 120 !important;
    width: min(292px, calc(100vw - 36px)) !important;
    max-width: calc(100vw - 36px);
    border: 1px solid rgba(226, 232, 240, 0.92);
    border-radius: 22px;
    box-shadow: 0 18px 42px rgba(15, 23, 42, 0.12);
  }

  .ai-app-left-rail.is-collapsed {
    top: calc(24px + var(--pure-safe-area-top, 0px));
    bottom: auto;
    width: 46px !important;
    min-width: 46px !important;
    max-width: 46px !important;
    height: 46px;
    min-height: 46px !important;
    overflow: visible;
    background: transparent !important;
    border: 0;
    border-radius: 16px;
    box-shadow: none;
    pointer-events: none;
  }

  .ai-app-left-rail.is-collapsed :deep(.ai-sidebar) {
    padding: 0;
  }

  .ai-app-left-rail.is-collapsed > div:first-child,
  .ai-app-left-rail.is-collapsed > div:nth-child(2),
  .ai-app-left-rail.is-collapsed .collapsed-rail-label {
    display: none !important;
  }

  .ai-app-left-rail.is-collapsed > button {
    position: absolute !important;
    top: 0 !important;
    right: auto !important;
    left: 0 !important;
    width: 46px !important;
    height: 46px !important;
    transform: none !important;
    border-radius: 14px !important;
    border-color: rgba(226, 232, 240, 0.82) !important;
    box-shadow: 0 12px 28px rgba(94, 127, 248, 0.18) !important;
    pointer-events: auto;
  }

  .ai-app-left-rail:not(.is-collapsed) > button {
    top: 14px !important;
    right: 14px !important;
    width: 34px !important;
    height: 34px !important;
    color: #6b7a96 !important;
    background: rgba(255, 255, 255, 0.86) !important;
    border-color: rgba(203, 213, 225, 0.78) !important;
    border-radius: 12px !important;
    box-shadow: 0 8px 20px rgba(35, 50, 82, 0.08) !important;
    transform: none !important;
  }

  .ai-app-left-rail.is-collapsed > button.is-mobile-collapsed-trigger {
    background: rgba(255, 255, 255, 0.92) !important;
    backdrop-filter: blur(16px);
  }

  .ai-chat-scene,
  .ai-chat-welcome,
  main > div[class*="p-4"] {
    padding:
      calc(54px + var(--pure-safe-area-top, 0px)) 12px
      calc(74px + var(--pure-safe-area-bottom, 0px)) !important;
    gap: 10px !important;
  }

  .ai-chat-scene {
    flex-direction: column;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .ai-chat-card {
    flex: 0 0 auto;
    height: clamp(340px, 50vh, 420px) !important;
    min-height: 340px;
    border-radius: 24px !important;
  }

  .ai-app-human-panel {
    flex: 0 0 auto;
    width: 100% !important;
    height: auto !important;
    min-height: 0;
    gap: 6px;
  }

  .ai-app-human-panel > button {
    display: none !important;
  }

  .ai-app-human-panel > div:first-of-type {
    height: clamp(188px, 28vh, 246px);
    min-height: 188px;
    border-radius: 24px !important;
  }

  .ai-human-actions {
    padding: 8px !important;
    min-height: 0 !important;
    border-radius: 20px !important;
  }

  .ai-human-actions[style] {
    min-height: 112px !important;
    max-height: 126px !important;
  }

  .ai-human-actions > div:last-child {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .ai-human-actions > div:first-child {
    padding-bottom: 5px !important;
    margin-bottom: 2px !important;
  }

  .ai-human-actions :deep(.el-button) {
    min-height: 30px !important;
    padding: 6px 8px !important;
    font-size: 11px !important;
  }

  main > div[class*="p-4"] > .flex-1 {
    min-width: 0;
    border-radius: 24px !important;
  }

  .gradient-text-animate {
    font-size: 24px !important;
    line-height: 1.14;
    letter-spacing: 0;
  }

  .ai-chat-welcome {
    align-items: stretch !important;
    justify-content: flex-start !important;
    padding-bottom: calc(24px + var(--pure-safe-area-bottom, 0px)) !important;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch;
  }

  .ai-chat-welcome-card {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    gap: 12px !important;
    max-width: none !important;
    min-height: 100%;
    width: 100%;
    padding: 0 0 10px;
    transform: none !important;
  }

  .ai-chat-welcome-card > .text-center {
    order: 1;
    padding: 0 4px;
    text-align: left;
    margin: 0 !important;
    gap: 6px;
  }

  .ai-chat-welcome-card > .text-center p {
    max-width: 340px;
    font-size: 13px !important;
    line-height: 1.4;
  }

  .quick-chat-box {
    order: 2;
    display: flex !important;
    flex-direction: column;
    border-radius: 20px !important;
    box-shadow: 0 12px 34px rgba(94, 127, 248, 0.1) !important;
  }

  .quick-chat-box :deep(.el-textarea__inner) {
    height: 78px !important;
    min-height: 78px !important;
    padding: 14px 14px !important;
    font-size: 14px !important;
    line-height: 1.42;
  }

  .quick-chat-box > div:last-child {
    display: flex !important;
    flex-direction: column;
    align-items: stretch;
    gap: 7px;
    padding: 9px !important;
  }

  .quick-chat-box > div:last-child > div:first-child {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .quick-chat-box > div:last-child > div:last-child {
    justify-content: space-between;
    width: 100%;
  }

  .quick-chat-box > div:last-child span {
    justify-content: center;
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
    min-height: 32px;
    padding-right: 8px !important;
    padding-left: 8px !important;
    font-size: 12px !important;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .quick-chat-box > div:last-child button {
    position: relative;
    z-index: 2;
    width: 44px !important;
    height: 44px !important;
    min-width: 44px !important;
    min-height: 44px !important;
    touch-action: manipulation;
  }

  .quick-chat-box > div:last-child > div:last-child > span {
    justify-content: flex-start;
    max-width: calc(100% - 46px);
  }

  .ai-chat-welcome-human {
    order: 3;
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    margin-top: 8px;
    min-height: 292px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.76);
    border: 1px solid rgba(255, 255, 255, 0.72);
    border-radius: 24px;
    box-shadow: 0 16px 42px rgba(94, 127, 248, 0.12);
  }

  :global(html.dark) .ai-chat-welcome-human {
    background: rgb(15 23 42 / 82%);
    border-color: rgb(148 163 184 / 22%);
    box-shadow: 0 18px 44px rgb(0 0 0 / 30%);
  }

  .ai-chat-welcome-human :deep(.virtual-human-panel) {
    flex: 1 1 auto;
    height: auto;
    min-height: 224px;
    background: transparent;
  }

  .ai-chat-welcome-actions {
    display: grid;
    flex: 0 0 auto;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.82);
    border-top: 1px solid rgba(226, 232, 240, 0.7);
  }

  :global(html.dark) .ai-chat-welcome-actions {
    background: rgb(2 6 23 / 74%);
    border-top-color: rgb(148 163 184 / 20%);
  }

  .ai-chat-welcome-actions button {
    min-width: 0;
    min-height: 32px;
    padding: 0 8px;
    overflow: hidden;
    font-size: 11px;
    font-weight: 600;
    color: #5e7ff8;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: rgba(239, 246, 255, 0.8);
    border: 1px solid rgba(191, 219, 254, 0.8);
    border-radius: 12px;
  }

  :global(html.dark) .ai-chat-welcome-actions button {
    color: #c7d2fe;
    background: rgb(30 41 59 / 80%);
    border-color: rgb(129 140 248 / 24%);
  }

  :deep(.el-dialog) {
    width: calc(100vw - 24px) !important;
    max-width: calc(100vw - 24px) !important;
  }
}
</style>
