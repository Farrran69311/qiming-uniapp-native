<script setup lang="ts">
import { computed, ref, nextTick, onMounted, onUnmounted, watch } from "vue";
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
  Microphone,
  Expand,
  Fold,
  Avatar,
  Clock,
  DataBoard,
  Close,
  Menu,
  Plus
} from "@element-plus/icons-vue";

// 引入三个拆分后的组件
import AiSidebar from "./components/AiSidebar.vue";
import AiChatModule from "./components/AiChatModule.vue";
import AiInspector from "./components/AiInspector.vue";
import AgentPdfWorkbench from "./AgentPdfWorkbench.vue";
import AiAppEmptyState from "./components/AiAppEmptyState.vue";

import AiResourceGeneration from "./components/AiResourceGeneration.vue";
import AiStudentResourceLibrary from "./components/AiStudentResourceLibrary.vue";
import AiLearningPath from "./components/AiLearningPath.vue";
import AiLearningProfile from "./components/AiLearningProfile.vue";
import AiAssessment from "./components/AiAssessment.vue";
import AiGovernanceDashboard from "./components/AiGovernanceDashboard.vue";
import VirtualHumanPanel from "./components/VirtualHumanPanel.vue";
import FloatingDigitalHuman2D from "./components/FloatingDigitalHuman2D.vue";
import {
  PlatformResourcePreviewDialog,
  hasPlatformResourcePreview,
  mapAssistantResourcePreview,
  type PlatformPreviewResource
} from "@/components/PlatformResourcePreview";

import { useUserStore } from "@/store/modules/user";
import { formatAvatar } from "@/utils/avatar";
import { type DataInfo, userKey } from "@/utils/auth";
import {
  getCourseDetail,
  type CourseDetailResult
} from "@/api/frontend/course";
import {
  getVideoAnalyzeTask,
  getVideoAnalyzeResult,
  type VideoAnalyzeFullResult
} from "@/api/frontend/videoAnalysis";
import {
  assistantApiErrorMessage,
  assistantModelReasonText,
  createAssistantConversation,
  getAssistantBootstrap,
  getAssistantConversation,
  getAssistantConversationGroups,
  getAssistantExplanationImage,
  getAssistantResource,
  getAssistantResourceTask,
  streamAssistantChat,
  uploadAssistantDocumentAttachment,
  type AssistantBootstrapCourse,
  type AssistantBootstrapResp,
  type AssistantBootstrapStudent,
  type AssistantChatResource,
  type AssistantChatStreamEvent,
  type AssistantChatTraceStep,
  type AssistantChatVideoSegment,
  type AssistantConversationItem,
  type AssistantExplanationImage,
  type AssistantExplanationImageMode,
  type AssistantInteractionScope,
  type AssistantOption,
  type AssistantResourceSummary,
  type AssistantResourceTaskItem,
  type AssistantSkill,
  type AssistantSpeechSession,
  type AssistantSpeechSessionSummary
} from "@/api/frontend/assistant";
import {
  isSpeechArchiveRecovering,
  mapSpeechSessionPlaybackState,
  SpeechPlaybackController,
  shouldPollSpeechSession,
  type SpeechPlaybackDiagnostic,
  type SpeechPlaybackState
} from "./speech-playback-controller";
import {
  explanationImageTerminalStatuses,
  shouldApplyExplanationImageUpdate
} from "./explanationImageState";
import {
  directVideoSegmentUrl,
  findCourseVideoUrl,
  listCourseVideoCandidates,
  videoTaskMatchesCourseCandidate
} from "./videoSegmentPreview";

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

type StreamProgressItem = {
  sequence?: number;
  stage: string;
  status: string;
  summary: string;
  elapsedMs?: number;
};

type ResourceTaskView = NonNullable<AssistantChatStreamEvent["resource_task"]> &
  Partial<AssistantResourceTaskItem>;

type ChatMessageView = {
  id: string | number;
  role: string;
  type: "system" | "user";
  content: string;
  avatar?: string;
  resources?: AssistantChatResource[];
  sourceRefs?: AssistantChatStreamEvent["source_refs"];
  videoSegments?: AssistantChatStreamEvent["video_segments"];
  followups?: AssistantChatStreamEvent["followups"];
  resourceTask?: ResourceTaskView;
  explanationImages?: AssistantExplanationImage[];
  safetyStatus?: string;
  safetySummary?: string;
  safetyFlags?: string[];
  metadata?: Record<string, any>;
  profileEvent?: Record<string, any>;
  requestId?: string;
  progressTimeline?: StreamProgressItem[];
  elapsedMs?: number;
  streamStatus?: string;
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
  partial?: boolean;
  stopped?: boolean;
  reasoningSummary?: string;
  streaming?: boolean;
  error?: boolean;
  speech?: AssistantSpeechSession | AssistantSpeechSessionSummary | null;
  speechPlaybackState?: SpeechPlaybackState;
};

type ChatSendPayload =
  | string
  | {
      text: string;
      files?: File[];
    };

const documentAttachmentContentTypes: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain"
};

const assistantBootstrap = ref<AssistantBootstrapResp | null>(null);
const isBootstrapping = ref(false);
const isChatStreaming = ref(false);
const featureFlags = computed(
  () => assistantBootstrap.value?.feature_flags || {}
);
const selectedSpeechVoiceAlias = ref("");
const speechTransportStatus = ref("语音能力检测中");
const speechDiagnostic = ref<SpeechPlaybackDiagnostic>({});
const speechDiagnosticText = computed(() => {
  const diagnostic = speechDiagnostic.value;
  const entries = [
    ["pipeline_mode", diagnostic.pipelineMode],
    ["text_tts_parallel", diagnostic.textTtsParallel],
    ["command_protocol", diagnostic.commandProtocol],
    ["timeline_clock", diagnostic.timelineClock],
    ["recovery_enabled", diagnostic.recoveryEnabled],
    ["durable_archive_enabled", diagnostic.durableArchiveEnabled],
    ["phase", diagnostic.phase],
    ["server_event", diagnostic.serverEvent],
    ["client_event", diagnostic.clientEvent],
    ["client_cleanup_reason", diagnostic.clientCleanupReason],
    ["server_terminal_received", diagnostic.serverTerminalReceived],
    ["event_seq", diagnostic.eventSequence],
    ["stream_id", diagnostic.streamId],
    ["session_id", diagnostic.sessionId],
    ["segment_seq", diagnostic.segmentSequence],
    ["audio_seq", diagnostic.audioSequence],
    ["audio_seq_gap_count", diagnostic.audioSequenceGapCount],
    ["max_audio_frame_gap_ms", diagnostic.maxAudioFrameGapMs],
    ["played_sample", diagnostic.playedSample],
    ["buffered_ms", diagnostic.bufferedMs],
    ["min_buffered_ms", diagnostic.minBufferedMs],
    ["underrun_count", diagnostic.underrunCount],
    ["rebuffering", diagnostic.rebuffering],
    ["peak_rms", diagnostic.peakRms],
    ["reservation_ms", diagnostic.reservationLatencyMs],
    ["websocket_ready_ms", diagnostic.websocketReadyLatencyMs],
    ["stream_bind_ms", diagnostic.streamBindLatencyMs],
    ["bind_to_first_audio_ms", diagnostic.firstAudioLatencyMs],
    ["first_audio_to_playback_ms", diagnostic.playbackBufferLatencyMs],
    ["audio_context_state", diagnostic.audioContextState],
    ["websocket_close_code", diagnostic.websocketCloseCode],
    ["websocket_close_reason", diagnostic.websocketCloseReason],
    ["websocket_was_clean", diagnostic.websocketWasClean],
    ["session_status", diagnostic.sessionStatus],
    ["live_delivery_status", diagnostic.liveDeliveryStatus],
    ["archive_status", diagnostic.archiveStatus],
    ["archive_failure_stage", diagnostic.archiveFailureStage],
    ["archive_retry_after", diagnostic.archiveRetryAfter],
    ["archive_retain_until", diagnostic.archiveRetainUntil],
    ["archive_redrive_count", diagnostic.archiveRedriveCount],
    ["terminal_event", diagnostic.terminalEvent],
    ["archive_disposition", diagnostic.archiveDisposition],
    ["last_audio_seq", diagnostic.lastAudioSequence],
    ["audio_sample_count", diagnostic.audioSampleCount],
    ["relayed_sample_count", diagnostic.relayedSampleCount],
    ["last_played_sample", diagnostic.lastPlayedSample],
    ["archive_resume_ms", diagnostic.archiveResumeMs],
    ["poll_after_ms", diagnostic.pollAfterMs],
    ["error_code", diagnostic.errorCode]
  ].filter(([, value]) => value !== undefined && value !== "");
  return entries.map(([key, value]) => `${key}=${String(value)}`).join("\n");
});

const copySpeechDiagnostics = async () => {
  const text = speechDiagnosticText.value;
  if (!text) {
    ElMessage.warning("暂无语音诊断信息");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success("语音诊断信息已复制");
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    copied
      ? ElMessage.success("语音诊断信息已复制")
      : ElMessage.error("复制失败，请打开浏览器控制台查看诊断信息");
  }
};

const testSpeechOutput = async () => {
  const started = await speechController.testAudioOutput();
  started
    ? ElMessage.info("正在播放测试音；听不到请检查标签页静音和系统输出设备")
    : ElMessage.error("测试音启动失败，请检查浏览器音频权限");
};

const selectedAgentKey = ref("");
const selectedModelKey = ref("");
const thinkingModeKey = ref("");
const selectedSkillKeys = ref<string[]>([]);
const explanationImageMode = ref<AssistantExplanationImageMode>("auto_wide");

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
const explanationImageEnabled = computed(
  () =>
    apiMode.value === "student" &&
    featureFlags.value.explanation_image_generation === true
);
const currentUserRoleLabel = computed(() => roleMode.value.userLabel);
const isStaffMode = computed(() => apiMode.value !== "student");
const currentUserAvatar = computed(() => formatAvatar(userStore.avatar));

const isNewTab = ref(false);

const layoutStorage = storageLocal().getItem("responsive-layout") as
  | { darkMode?: boolean }
  | undefined;
const currentTheme = ref(
  (storageLocal().getItem("course_theme") as string) ||
    (layoutStorage?.darkMode ? "dark" : "light")
);
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
    "governance",
    "automation"
  ];
  return knownRails.includes(key) ? key : "chat";
};

// 会话数据集
const activeRail = ref(resolveRailFromPath(route.path));
const resourceWorkspaceMode = ref<"generated">("generated");
watch(
  () => route.path,
  newPath => {
    activeRail.value = resolveRailFromPath(newPath);
  }
);
const activeCourse = ref<CourseView | null>(null);

// 课程与会话侧栏状态
const sidebarWidthStorageKey = "ai-app-course-sidebar-width";
const sidebarDefaultWidth = 260;
const sidebarMinWidth = 220;
const sidebarAbsoluteMaxWidth = 420;
const isCompactAiViewport = () =>
  typeof window !== "undefined" && window.innerWidth <= 768;
const getSidebarMaxWidth = () =>
  typeof window === "undefined"
    ? sidebarAbsoluteMaxWidth
    : Math.max(
        sidebarMinWidth,
        Math.min(sidebarAbsoluteMaxWidth, Math.floor(window.innerWidth * 0.36))
      );
const sidebarMaxWidth = ref(getSidebarMaxWidth());
const savedSidebarWidth = storageLocal().getItem<number>(
  sidebarWidthStorageKey
);
const sidebarWidth = ref(
  Math.min(
    sidebarMaxWidth.value,
    Math.max(
      sidebarMinWidth,
      typeof savedSidebarWidth === "number" &&
        Number.isFinite(savedSidebarWidth)
        ? savedSidebarWidth
        : sidebarDefaultWidth
    )
  )
);
const isCompactViewport = ref(isCompactAiViewport());
const sidebarCollapsed = ref(isCompactAiViewport());
const sidebarResizing = ref(false);
const humanCollapsed = ref(false);
const canMountInline3D = ref(false);
const courseDrawerRef = ref<HTMLElement | null>(null);
const courseDrawerTriggerRef = ref<HTMLButtonElement | null>(null);
let courseDrawerRestoreFocus: HTMLElement | null = null;
let sidebarWasCompact = isCompactAiViewport();
const toggleSidebar = () => (sidebarCollapsed.value = !sidebarCollapsed.value);
const openCourseDrawer = () => {
  if (!isCompactViewport.value) {
    sidebarCollapsed.value = false;
    return;
  }
  courseDrawerRestoreFocus =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : courseDrawerTriggerRef.value;
  sidebarCollapsed.value = false;
  void nextTick(() => {
    courseDrawerRef.value
      ?.querySelector<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      )
      ?.focus();
  });
};
const closeCourseDrawer = (
  options: { restoreFocus?: boolean } = { restoreFocus: true }
) => {
  if (!isCompactViewport.value) return;
  sidebarCollapsed.value = true;
  const restoreTarget =
    courseDrawerRestoreFocus || courseDrawerTriggerRef.value;
  courseDrawerRestoreFocus = null;
  if (options.restoreFocus !== false) {
    void nextTick(() => restoreTarget?.focus());
  }
};
const handleCourseDrawerKeydown = (event: KeyboardEvent) => {
  if (!isCompactViewport.value || sidebarCollapsed.value) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeCourseDrawer();
    return;
  }
  if (event.key !== "Tab" || !courseDrawerRef.value) return;

  const focusable = Array.from(
    courseDrawerRef.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter(element => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden"
    );
  });
  if (!focusable.length) {
    event.preventDefault();
    courseDrawerRef.value.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};
const toggleHuman = () => (humanCollapsed.value = !humanCollapsed.value);
const sidebarRenderedWidth = computed(() =>
  sidebarCollapsed.value
    ? isCompactViewport.value
      ? 0
      : 34
    : sidebarWidth.value
);
const floatingHumanBottomOffset = computed(() =>
  isCompactViewport.value ? (activeRail.value === "chat" ? 156 : 104) : 104
);
const floatingHumanStorageKey = computed(() =>
  isCompactViewport.value
    ? "ai-app-floating-digital-human-2d-mobile"
    : "ai-app-floating-digital-human-2d-left-bottom"
);

let sidebarResizePointerId: number | null = null;
let sidebarResizeStartX = 0;
let sidebarResizeStartWidth = sidebarDefaultWidth;

const clampSidebarWidth = (width: number) =>
  Math.min(sidebarMaxWidth.value, Math.max(sidebarMinWidth, Math.round(width)));

const persistSidebarWidth = () => {
  storageLocal().setItem(sidebarWidthStorageKey, sidebarWidth.value);
};

const setSidebarWidth = (width: number, persist = false) => {
  sidebarWidth.value = clampSidebarWidth(width);
  if (persist) persistSidebarWidth();
};

const beginSidebarResize = (event: PointerEvent) => {
  if (sidebarCollapsed.value || event.button !== 0) return;
  event.preventDefault();
  sidebarResizePointerId = event.pointerId;
  sidebarResizeStartX = event.clientX;
  sidebarResizeStartWidth = sidebarWidth.value;
  sidebarResizing.value = true;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  document.documentElement.classList.add("ai-app-sidebar-resizing");
};

const updateSidebarResize = (event: PointerEvent) => {
  if (!sidebarResizing.value || sidebarResizePointerId !== event.pointerId)
    return;
  setSidebarWidth(
    sidebarResizeStartWidth + event.clientX - sidebarResizeStartX
  );
};

const endSidebarResize = (event: PointerEvent) => {
  if (sidebarResizePointerId !== event.pointerId) return;
  const target = event.currentTarget as HTMLElement;
  sidebarResizePointerId = null;
  if (target.hasPointerCapture(event.pointerId)) {
    target.releasePointerCapture(event.pointerId);
  }
  sidebarResizing.value = false;
  document.documentElement.classList.remove("ai-app-sidebar-resizing");
  persistSidebarWidth();
};

const resetSidebarWidth = () => {
  setSidebarWidth(sidebarDefaultWidth, true);
};

const handleSidebarResizeKeydown = (event: KeyboardEvent) => {
  const step = event.shiftKey ? 32 : 12;
  let nextWidth: number | undefined;
  if (event.key === "ArrowLeft") nextWidth = sidebarWidth.value - step;
  if (event.key === "ArrowRight") nextWidth = sidebarWidth.value + step;
  if (event.key === "Home") nextWidth = sidebarMinWidth;
  if (event.key === "End") nextWidth = sidebarMaxWidth.value;
  if (nextWidth === undefined) return;
  event.preventDefault();
  setSidebarWidth(nextWidth, true);
};

const syncSidebarWidthLimit = () => {
  const compact = isCompactAiViewport();
  if (compact && !sidebarWasCompact) sidebarCollapsed.value = true;
  isCompactViewport.value = compact;
  sidebarWasCompact = compact;
  sidebarMaxWidth.value = getSidebarMaxWidth();
  setSidebarWidth(sidebarWidth.value);
  canMountInline3D.value =
    typeof window !== "undefined" &&
    window.innerWidth > 1280 &&
    /^https?:$/.test(window.location.protocol);
};

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
  setSpeechState?: (state: string) => void;
  setAmplitude?: (value: number) => void;
  applyViseme?: (id: string, weight: number) => void;
  triggerMotion?: (key: string, durationMs: number, targetRef?: string) => void;
  resetSpeech?: () => void;
  pauseRender?: () => void;
  resumeRender?: () => void;
} | null>(null);
const floatingHumanRef = ref<{
  speak?: (text: string) => void;
  setSpeechState?: (state: string) => void;
  setAmplitude?: (value: number) => void;
  applyViseme?: (id: string, weight: number) => void;
  triggerMotion?: (key: string, durationMs: number, targetRef?: string) => void;
  resetSpeech?: () => void;
  pauseRender?: () => void;
  resumeRender?: () => void;
} | null>(null);

const speechRenderTargets = () => [
  virtualHumanRef.value,
  floatingHumanRef.value
];

let localDigitalHumanSpeechTimer: ReturnType<typeof setTimeout> | null = null;

const localDigitalHumanSpeech = (content: string) => {
  const text = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#*_>`~\[\]()/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 900);
  if (!text) return;

  digitalHumanStreamState.value = "saying";
  if (localDigitalHumanSpeechTimer) clearTimeout(localDigitalHumanSpeechTimer);

  if (virtualHumanRef.value?.speak) {
    virtualHumanRef.value.triggerMotion?.("explain", 4200);
    virtualHumanRef.value.speak(text);
  }
  floatingHumanRef.value?.speak?.(text);
  localDigitalHumanSpeechTimer = setTimeout(
    () => {
      digitalHumanStreamState.value = null;
      localDigitalHumanSpeechTimer = null;
    },
    Math.min(Math.max(text.length * 80, 1600), 5200)
  );
};

const updateMessageSpeech = (
  clientMessageId: string | number,
  speech: AssistantSpeechSession,
  playbackState: SpeechPlaybackState
) => {
  const message = messages.value.find(item => item.id === clientMessageId);
  if (!message) return;
  message.speech = speech;
  message.speechPlaybackState = playbackState;
};

const speechController = new SpeechPlaybackController({
  renderer: {
    setState(state) {
      digitalHumanStreamState.value =
        state === "speaking"
          ? "saying"
          : state === "thinking"
            ? "thinking"
            : state === "listening"
              ? "listening"
              : null;
      speechRenderTargets().forEach(target => target?.setSpeechState?.(state));
    },
    setAmplitude(value) {
      speechRenderTargets().forEach(target => target?.setAmplitude?.(value));
    },
    applyViseme(id, weight) {
      speechRenderTargets().forEach(target =>
        target?.applyViseme?.(id, weight)
      );
    },
    triggerMotion(key, durationMs, targetRef) {
      speechRenderTargets().forEach(target =>
        target?.triggerMotion?.(key, durationMs, targetRef)
      );
    },
    reset() {
      digitalHumanStreamState.value = null;
      speechRenderTargets().forEach(target => target?.resetSpeech?.());
    }
  },
  onStatus(_state, message) {
    if (message) speechTransportStatus.value = message;
  },
  onDiagnostic(diagnostic) {
    speechDiagnostic.value = diagnostic;
  },
  onSession: updateMessageSpeech
});

const myCourses = ref<CourseView[]>([]);
const myStudents = ref<StudentView[]>([]);
const selectedStudentId = ref<number | undefined>();
const interactionScope = ref<AssistantInteractionScope>("personal_learning");
const conversations = ref<ConversationView[]>([]);
const activeConversationId = ref("");
const manuallySelectedCourseId = ref<number | undefined>();

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
  interactionScope.value === "student_analysis"
    ? selectedStudentId.value
    : undefined
);
// Student-scoped workspaces keep their existing data context. It is separate
// from the chat subject, which must remain empty for course_general.
const selectedStudentContextId = computed(() =>
  isStaffMode.value ? selectedStudentId.value : undefined
);
const courseScopedRails = [
  "chat",
  "generation",
  "path",
  "profile",
  "assessment",
  "governance"
];
const studentScopedRails = ["generation", "path", "profile", "assessment"];
const ensureStudentContextForActiveRail = () => {
  if (
    !isStaffMode.value ||
    !studentScopedRails.includes(activeRail.value) ||
    selectedStudentId.value ||
    !myStudents.value.length
  ) {
    return;
  }
  selectedStudentId.value = myStudents.value[0].id;
};
const showCourseContext = computed(() =>
  courseScopedRails.includes(activeRail.value)
);
const showStudentContext = computed(
  () =>
    isStaffMode.value &&
    (studentScopedRails.includes(activeRail.value) ||
      (activeRail.value === "chat" &&
        interactionScope.value === "student_analysis"))
);
const supportedInteractionScopes = computed<AssistantInteractionScope[]>(() => {
  const supported =
    assistantBootstrap.value?.supported_interaction_scopes || [];
  if (supported.length) return supported;
  return isStaffMode.value
    ? ["course_general", "student_analysis"]
    : ["personal_learning"];
});
const interactionScopeLabel = computed(() => {
  const labels: Record<AssistantInteractionScope, string> = {
    personal_learning: "个人学习",
    course_general: "课程通用问答",
    student_analysis: "学生学情分析"
  };
  return labels[interactionScope.value];
});
const currentConversation = computed(() =>
  conversations.value.find(
    conversation => conversation.conversation_id === activeConversationId.value
  )
);

const buildAssistantIdentity = (courseId?: number) => {
  const scope = interactionScope.value;
  if (scope === "student_analysis") {
    if (!selectedStudentId.value) {
      throw new Error("请选择要分析的学生");
    }
    return {
      ...(courseId ? { course_id: courseId } : {}),
      interaction_scope: scope,
      target_student_id: selectedStudentId.value
    };
  }
  return {
    ...(courseId ? { course_id: courseId } : {}),
    interaction_scope: scope
  };
};
const courseContextLabel = computed(() => "课程:");
const isCourseSwitching = ref(false);
const isInteractionScopeSwitching = ref(false);
const selectedCoursePickerId = computed({
  get: () =>
    activeRail.value === "chat"
      ? activeCourse.value?.id
      : selectedCourseId.value,
  set: courseId => {
    void handleCourseContextChange(Number(courseId));
  }
});

async function handleCourseContextChange(courseId?: number) {
  const normalizedCourseId = Number(courseId);
  if (!Number.isFinite(normalizedCourseId) || normalizedCourseId <= 0) return;
  const targetCourse = myCourses.value.find(
    course => course.id === normalizedCourseId
  );
  if (!targetCourse) return;
  if (targetCourse.id === selectedCourseId.value) {
    activeCourse.value = targetCourse;
    manuallySelectedCourseId.value = targetCourse.id;
    return;
  }

  isCourseSwitching.value = true;
  manuallySelectedCourseId.value = targetCourse.id;
  activeCourse.value = targetCourse;
  activeConversationId.value = "";
  if (isStaffMode.value) {
    selectedStudentId.value = undefined;
    myStudents.value = [];
  }
  resetChatGreeting();
  try {
    await loadAssistantBootstrap();
  } finally {
    isCourseSwitching.value = false;
  }
}

const handleInteractionScopeChange = async (
  scope: AssistantInteractionScope
) => {
  if (!supportedInteractionScopes.value.includes(scope)) return;
  if (scope === interactionScope.value) return;
  isInteractionScopeSwitching.value = true;
  try {
    interactionScope.value = scope;
    // A subject must always be explicitly chosen for a new analysis context.
    selectedStudentId.value = undefined;
    activeConversationId.value = "";
    conversations.value = [];
    resetChatGreeting();
    await loadAssistantBootstrap();
  } finally {
    isInteractionScopeSwitching.value = false;
  }
};

// 【请求还原】：保留原版所有的侧边功能项
const railItems = ref([
  { key: "chat", label: "互动答疑", icon: "ChatDotRound" },
  { key: "generation", label: "教学资源", icon: "FolderOpened" },
  { key: "agentpdf", label: "资料研读", icon: "Document" },
  { key: "path", label: "学习计划", icon: "Guide" },
  { key: "profile", label: "学情分析", icon: "User" },
  { key: "assessment", label: "测验评估", icon: "DataAnalysis" },
  { key: "governance", label: "治理看板", icon: "DataBoard" },
  { key: "automation", label: "常规任务", icon: "Check" }
]);
const mobileChatTitle = computed(() => activeCourse.value?.name || "学习助手");

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
const activeStreamMessageId = ref<string | number | null>(null);
const activeStreamRunId = ref(0);
const activeRequestId = ref("");
const lastStreamSequence = ref(0);
const resourceTaskTimers = new Map<string, number>();
const resourceTaskPollingStartedAt = new Map<string, number>();
const resourceTaskPollingInFlight = new Set<string>();
const explanationImageTimers = new Map<string, number>();
const explanationImagePollingStartedAt = new Map<string, number>();
const explanationImagePollingInFlight = new Set<string>();
const messages = ref<ChatMessageView[]>([]);

const streamStageTextMap: Record<string, string> = {
  request_started: "已开始处理请求",
  request_validating: "正在校验请求",
  request_preparing: "正在读取课程与会话上下文",
  context_loading: "正在加载课程上下文",
  knowledge_retrieval: "正在检索课程资料",
  answer_generating: "正在生成回答",
  safety_checking: "正在进行安全检查",
  persisting: "正在保存回答",
  postprocess_queued: "后台处理已入队",
  profile_refresh: "画像与评估正在后台刷新",
  stream: "连接状态"
};

const resourceTaskTerminalStatuses = new Set([
  "completed",
  "completed_with_warnings",
  "partial",
  "failed",
  "degraded",
  "cancelled",
  "blocked"
]);

const agentItems = computed(() => {
  if (agentTrace.value.length) {
    return agentTrace.value.map((step, index) => ({
      id: `${step.agent}-${step.stage}-${index}`,
      name: step.agent || step.stage || "学习助手",
      desc:
        step.status === "degraded" || step.status === "blocked"
          ? step.degraded_reason || step.summary || step.stage || "降级处理中"
          : step.summary || step.stage || "处理中",
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
  streamCancel.value?.();
  speechController.reset();
  streamCancel.value = null;
  clearAllExplanationImagePolling();
  activeStreamRunId.value += 1;
  activeStreamMessageId.value = null;
  activeRequestId.value = "";
  lastStreamSequence.value = 0;
  isChatStreaming.value = false;
  digitalHumanStreamState.value = null;
  const courseName = selectedCourseName.value || "当前课程";
  const greeting =
    interactionScope.value === "course_general"
      ? `你好，${courseName} 的课程助手已就绪。你可以直接提出课程教学、知识结构或资料相关问题。`
      : interactionScope.value === "student_analysis"
        ? `已进入学生学情分析。请提出关于该学生学习情况的问题，我会以第三人称给出分析。`
        : `你好，${courseName} 的学习助手已就绪。你可以直接提出学习问题，我会结合课程、画像和学习路径给出建议。`;
  messages.value = [
    {
      id: "assistant-greeting",
      role: "智能助教",
      type: "system",
      content: assistantBootstrap.value?.message || greeting
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

const streamProgressSummary = (event: AssistantChatStreamEvent) => {
  const stage = event.stage || "request_started";
  return event.summary || streamStageTextMap[stage] || "正在处理请求";
};

const appendStreamProgress = (
  assistantMessageId: string | number,
  event: AssistantChatStreamEvent
) => {
  const message = messages.value.find(item => item.id === assistantMessageId);
  if (!message) return;

  const stage = event.stage || "request_started";
  const next: StreamProgressItem = {
    sequence: event.sequence,
    stage,
    status: event.status || "running",
    summary: streamProgressSummary(event),
    elapsedMs: event.elapsed_ms
  };
  const timeline = [...(message.progressTimeline || [])];
  const previous = timeline[timeline.length - 1];
  if (previous?.stage === next.stage) {
    timeline[timeline.length - 1] = { ...previous, ...next };
  } else {
    timeline.push(next);
  }

  updateAssistantMessage(assistantMessageId, {
    requestId: event.request_id || message.requestId,
    progressTimeline: timeline.slice(-8),
    elapsedMs: event.elapsed_ms ?? message.elapsedMs,
    streamStatus: event.status || message.streamStatus
  });
};

const clearResourceTaskPolling = (taskId: string) => {
  const timer = resourceTaskTimers.get(taskId);
  if (timer) window.clearTimeout(timer);
  resourceTaskTimers.delete(taskId);
  resourceTaskPollingStartedAt.delete(taskId);
  resourceTaskPollingInFlight.delete(taskId);
};

const clearAllResourceTaskPolling = () => {
  [...resourceTaskTimers.keys()].forEach(clearResourceTaskPolling);
};

const clearExplanationImagePolling = (imageId: string) => {
  const timer = explanationImageTimers.get(imageId);
  if (timer) window.clearTimeout(timer);
  explanationImageTimers.delete(imageId);
  explanationImagePollingStartedAt.delete(imageId);
  explanationImagePollingInFlight.delete(imageId);
};

const clearAllExplanationImagePolling = () => {
  const imageIds = new Set([
    ...explanationImageTimers.keys(),
    ...explanationImagePollingStartedAt.keys(),
    ...explanationImagePollingInFlight
  ]);
  imageIds.forEach(clearExplanationImagePolling);
};

const updateMessageExplanationImage = (
  assistantMessageId: string | number,
  image: AssistantExplanationImage
) => {
  const message = messages.value.find(item => item.id === assistantMessageId);
  if (!message || !image.image_id) return;
  const images = [...(message.explanationImages || [])];
  const index = images.findIndex(item => item.image_id === image.image_id);
  if (index === -1) images.push(image);
  else {
    const current = images[index];
    if (shouldApplyExplanationImageUpdate(current.status, image.status)) {
      images[index] = { ...current, ...image };
    }
  }
  updateAssistantMessage(assistantMessageId, { explanationImages: images });
};

const pollExplanationImage = async (
  imageId: string,
  assistantMessageId: string | number
) => {
  if (explanationImagePollingInFlight.has(imageId)) return;
  const message = messages.value.find(item => item.id === assistantMessageId);
  if (
    !message ||
    !message.explanationImages?.some(item => item.image_id === imageId)
  ) {
    clearExplanationImagePolling(imageId);
    return;
  }

  explanationImagePollingInFlight.add(imageId);
  try {
    const response = await getAssistantExplanationImage(imageId);
    const image = response.image;
    if (image) {
      updateMessageExplanationImage(assistantMessageId, image);
      if (explanationImageTerminalStatuses.has(image.status)) {
        clearExplanationImagePolling(imageId);
        return;
      }
    }
  } catch (error) {
    console.warn("[AiApp] 讲解图片状态刷新失败:", error);
  } finally {
    explanationImagePollingInFlight.delete(imageId);
  }

  const currentMessage = messages.value.find(
    item => item.id === assistantMessageId
  );
  const currentImage = currentMessage?.explanationImages?.find(
    item => item.image_id === imageId
  );
  if (
    !currentImage ||
    explanationImageTerminalStatuses.has(currentImage.status)
  ) {
    clearExplanationImagePolling(imageId);
    return;
  }

  const startedAt = explanationImagePollingStartedAt.get(imageId) || Date.now();
  const elapsed = Date.now() - startedAt;
  const delay = document.hidden ? 10000 : elapsed < 30000 ? 2000 : 5000;
  explanationImageTimers.set(
    imageId,
    window.setTimeout(() => {
      explanationImageTimers.delete(imageId);
      void pollExplanationImage(imageId, assistantMessageId);
    }, delay)
  );
};

const startExplanationImagePolling = (
  image: AssistantExplanationImage,
  assistantMessageId: string | number
) => {
  updateMessageExplanationImage(assistantMessageId, image);
  if (!image.image_id || explanationImageTerminalStatuses.has(image.status)) {
    if (image.image_id) clearExplanationImagePolling(image.image_id);
    return;
  }
  if (!explanationImagePollingStartedAt.has(image.image_id)) {
    explanationImagePollingStartedAt.set(image.image_id, Date.now());
  }
  if (!explanationImageTimers.has(image.image_id)) {
    void pollExplanationImage(image.image_id, assistantMessageId);
  }
};

const handleRefreshExplanationImage = async (payload: {
  imageId: string;
  messageId: string | number;
}) => {
  const imageId = String(payload?.imageId || "").trim();
  const message = messages.value.find(item => item.id === payload?.messageId);
  if (
    !imageId ||
    !message ||
    !message.explanationImages?.some(image => image.image_id === imageId)
  ) {
    return;
  }

  try {
    const response = await getAssistantExplanationImage(imageId);
    if (!response.image?.image_id) {
      throw new Error("讲解图片状态响应缺少图片标识");
    }
    updateMessageExplanationImage(payload.messageId, response.image);
    if (!explanationImageTerminalStatuses.has(response.image.status)) {
      startExplanationImagePolling(response.image, payload.messageId);
    }
  } catch (error) {
    console.warn("[AiApp] 讲解图片手动刷新失败:", error);
    ElMessage.warning("讲解图片状态刷新失败，请稍后重试");
  }
};

const updateMessageResourceTask = (
  assistantMessageId: string | number,
  task: ResourceTaskView | AssistantResourceTaskItem
) => {
  const message = messages.value.find(item => item.id === assistantMessageId);
  if (!message || message.resourceTask?.task_id !== task.task_id) return;
  updateAssistantMessage(assistantMessageId, {
    resourceTask: { ...message.resourceTask, ...task }
  });
};

const isTerminalResourceTask = (status?: string) =>
  resourceTaskTerminalStatuses.has(String(status || "").toLowerCase());

const pollResourceTask = async (
  taskId: string,
  assistantMessageId: string | number
) => {
  if (resourceTaskPollingInFlight.has(taskId)) return;
  const message = messages.value.find(item => item.id === assistantMessageId);
  if (!message || message.resourceTask?.task_id !== taskId) {
    clearResourceTaskPolling(taskId);
    return;
  }

  resourceTaskPollingInFlight.add(taskId);
  try {
    const { data } = await getAssistantResourceTask(taskId);
    if (data.task) {
      updateMessageResourceTask(assistantMessageId, data.task);
      if (isTerminalResourceTask(data.task.status)) {
        clearResourceTaskPolling(taskId);
        return;
      }
    }
  } catch (error) {
    console.warn("[AiApp] 资源任务状态刷新失败:", error);
  } finally {
    resourceTaskPollingInFlight.delete(taskId);
  }

  const startedAt = resourceTaskPollingStartedAt.get(taskId) || Date.now();
  const elapsed = Date.now() - startedAt;
  const delay = document.hidden ? 10000 : elapsed < 30000 ? 2000 : 5000;
  resourceTaskTimers.set(
    taskId,
    window.setTimeout(() => {
      resourceTaskTimers.delete(taskId);
      void pollResourceTask(taskId, assistantMessageId);
    }, delay)
  );
};

const startResourceTaskPolling = (
  task: ResourceTaskView,
  assistantMessageId: string | number
) => {
  updateMessageResourceTask(assistantMessageId, task);
  if (!task.task_id || isTerminalResourceTask(task.status)) {
    if (task.task_id) clearResourceTaskPolling(task.task_id);
    return;
  }
  if (!resourceTaskPollingStartedAt.has(task.task_id)) {
    resourceTaskPollingStartedAt.set(task.task_id, Date.now());
  }
  if (!resourceTaskTimers.has(task.task_id)) {
    void pollResourceTask(task.task_id, assistantMessageId);
  }
};

const acceptStreamEvent = (
  event: AssistantChatStreamEvent,
  assistantMessageId: string | number,
  streamRunId: number
) => {
  if (
    streamRunId !== activeStreamRunId.value ||
    activeStreamMessageId.value !== assistantMessageId
  ) {
    return false;
  }
  if (event.request_id) {
    if (activeRequestId.value && activeRequestId.value !== event.request_id) {
      return false;
    }
    activeRequestId.value = event.request_id;
  }
  if (typeof event.sequence === "number") {
    if (event.sequence <= lastStreamSequence.value) return false;
    lastStreamSequence.value = event.sequence;
  }
  return true;
};

const releaseActiveStream = (assistantMessageId: string | number) => {
  if (activeStreamMessageId.value !== assistantMessageId) return;
  streamCancel.value = null;
  activeStreamMessageId.value = null;
  activeRequestId.value = "";
  lastStreamSequence.value = 0;
  isChatStreaming.value = false;
};

const handleAssistantStreamEvent = (
  event: AssistantChatStreamEvent,
  assistantMessageId: string | number,
  streamRunId: number
) => {
  if (!acceptStreamEvent(event, assistantMessageId, streamRunId)) return;
  const hasBackendHumanState = applyDigitalHumanDirective(event);

  if (event.conversation_id) {
    activeConversationId.value = event.conversation_id;
  }
  if (event.request_id) {
    updateAssistantMessage(assistantMessageId, { requestId: event.request_id });
  }

  if (event.speech || event.event.startsWith("speech.")) {
    speechController.handleChatEvent(event, assistantMessageId);
  }

  if (event.event === "digital_human.directive") {
    return;
  }

  if (
    event.event === "speech.stream.bound" ||
    event.event === "speech.stream.degraded"
  ) {
    return;
  }

  if (
    ["assistant.started", "assistant.progress", "postprocess.queued"].includes(
      event.event
    )
  ) {
    appendStreamProgress(assistantMessageId, event);
    if (!hasBackendHumanState) digitalHumanStreamState.value = "thinking";
    return;
  }

  if (event.event === "heartbeat") {
    const message = messages.value.find(item => item.id === assistantMessageId);
    if (message) {
      updateAssistantMessage(assistantMessageId, {
        elapsedMs: event.elapsed_ms ?? message.elapsedMs
      });
    }
    return;
  }

  if (event.event === "conversation.created") {
    if (!hasBackendHumanState) digitalHumanStreamState.value = "thinking";
    void loadConversationGroups();
    return;
  }

  if (event.event === "resource.task.created" && event.resource_task) {
    updateAssistantMessage(assistantMessageId, {
      resourceTask: event.resource_task
    });
    startResourceTaskPolling(event.resource_task, assistantMessageId);
    return;
  }

  if (event.event === "explanation_image.queued" && event.explanation_image) {
    startExplanationImagePolling(event.explanation_image, assistantMessageId);
    return;
  }

  if (
    event.event === "assistant.reasoning_summary.delta" &&
    featureFlags.value.reasoning_summary_stream
  ) {
    const target = messages.value.find(item => item.id === assistantMessageId);
    if (target && event.delta) {
      updateAssistantMessage(assistantMessageId, {
        reasoningSummary: `${target.reasoningSummary || ""}${event.delta}`
      });
    }
    return;
  }

  if (event.event === "assistant.delta") {
    if (!hasBackendHumanState) digitalHumanStreamState.value = "thinking";
    const target = messages.value.find(item => item.id === assistantMessageId);
    if (target) target.content += event.delta || "";
    return;
  }

  if (event.event === "assistant.completed") {
    const currentMessage = messages.value.find(
      item => item.id === assistantMessageId
    );
    const streamedContent = currentMessage?.content || "";
    const content = event.content_text || streamedContent;
    const resourceTask = event.resource_task || currentMessage?.resourceTask;
    updateAssistantMessage(assistantMessageId, {
      content: content || "学习助手已完成回复。",
      resources: event.resources || [],
      sourceRefs: event.source_refs || [],
      videoSegments: event.video_segments || [],
      followups: event.followups || [],
      resourceTask,
      explanationImages: currentMessage?.explanationImages,
      safetyStatus: event.safety_status,
      safetySummary: event.safety_summary,
      safetyFlags: event.safety_flags || [],
      profileEvent: event.profile_event,
      streaming: false,
      streamStatus: event.status || "completed",
      elapsedMs: event.elapsed_ms ?? currentMessage?.elapsedMs,
      partial: false,
      error: false,
      errorMessage: ""
    });
    if (resourceTask)
      startResourceTaskPolling(resourceTask, assistantMessageId);
    if (event.explanation_image) {
      startExplanationImagePolling(event.explanation_image, assistantMessageId);
    }
    agentTrace.value = event.trace || [];
    generatedResources.value = event.resources || [];
    if (event.conversation_title) {
      const active = conversations.value.find(
        item => item.conversation_id === event.conversation_id
      );
      if (active) active.title = event.conversation_title;
    }
    if (event.speech) {
      speechController.trackSession(
        event.speech,
        assistantMessageId,
        true,
        "event"
      );
    } else if (
      !assistantBootstrap.value?.speech?.enabled &&
      !currentMessage?.speech?.session_id
    ) {
      localDigitalHumanSpeech(content || "学习助手已完成回复。");
    } else if (!hasBackendHumanState) {
      digitalHumanStreamState.value = null;
    }
    releaseActiveStream(assistantMessageId);
    void loadConversationGroups();
    return;
  }

  if (event.event === "error") {
    const currentMessage = messages.value.find(
      item => item.id === assistantMessageId
    );
    const hasPartialContent = !!currentMessage?.content.trim();
    const keepPartial = Boolean(event.partial && hasPartialContent);
    appendStreamProgress(assistantMessageId, {
      ...event,
      status: event.status || (keepPartial ? "partial" : "failed"),
      summary: event.error_message || event.summary
    });
    updateAssistantMessage(assistantMessageId, {
      content: keepPartial
        ? currentMessage?.content || ""
        : event.error_message || "学习助手响应失败，请稍后重试。",
      streaming: false,
      error: !keepPartial,
      partial: keepPartial,
      retryable: Boolean(event.retryable),
      streamStatus: event.status || (keepPartial ? "partial" : "failed"),
      errorCode: event.error_code,
      errorMessage: event.error_message || "学习助手响应失败，请稍后重试。",
      elapsedMs: event.elapsed_ms ?? currentMessage?.elapsedMs,
      speechPlaybackState: "failed"
    });
    void speechController.stopPlayback(false);
    digitalHumanStreamState.value = null;
    releaseActiveStream(assistantMessageId);
    if (keepPartial) {
      ElMessage.warning(event.error_message || "回答未完整生成");
    } else {
      ElMessage.error(event.error_message || "学习助手响应失败");
    }
  }
};

const getDocumentAttachmentExtension = (file: File) =>
  (file.name.split(".").pop()?.trim() || "").toLowerCase();

const resolveDocumentAttachmentContentType = (file: File) => {
  const extension = getDocumentAttachmentExtension(file);
  return documentAttachmentContentTypes[extension] || file.type || "";
};

const uploadDocumentAttachmentsForMessage = async (files: File[]) => {
  if (!files.length) return [];
  const allowedFiles = files.slice(0, 3);
  const unsupported = allowedFiles.find(
    file =>
      !documentAttachmentContentTypes[getDocumentAttachmentExtension(file)]
  );
  if (unsupported) {
    throw new Error(`${unsupported.name} 暂不支持，请上传 PDF、DOCX 或 TXT`);
  }
  const oversize = allowedFiles.find(file => file.size > 20 * 1024 * 1024);
  if (oversize) {
    throw new Error(`${oversize.name} 超过 20MB`);
  }

  const uploaded = await Promise.all(
    allowedFiles.map(file =>
      uploadAssistantDocumentAttachment(file, {
        scene: "assistant",
        course_id: selectedCourseId.value,
        conversation_id: activeConversationId.value || undefined,
        content_type: resolveDocumentAttachmentContentType(file)
      })
    )
  );
  return uploaded.map(item => item.attachment_id).filter(Boolean);
};

const handleSendMessage = async (payload: ChatSendPayload) => {
  const text = typeof payload === "string" ? payload : payload.text;
  const files = typeof payload === "string" ? [] : payload.files || [];
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
  if (
    interactionScope.value === "student_analysis" &&
    !selectedTargetStudentId.value
  ) {
    ElMessage.warning("请选择要分析的学生");
    return;
  }
  if (currentConversation.value?.legacy_read_only) {
    ElMessage.warning("历史会话仅供查看，请新建会话后继续讨论");
    return;
  }
  if (!selectedModelReady.value) {
    ElMessage.warning(selectedModelDisabledReason.value || "当前没有可用模型");
    return;
  }
  speechController.primeRealtimeAudio();

  let attachmentIds: string[] = [];
  let uploadMessage: ReturnType<typeof ElMessage> | undefined;
  try {
    if (files.length) {
      uploadMessage = ElMessage({
        message: "正在上传并解析文档附件...",
        type: "info",
        duration: 0,
        showClose: true
      });
      attachmentIds = await uploadDocumentAttachmentsForMessage(files);
      uploadMessage.close();
      ElMessage.success("文档解析完成，已加入本轮问答");
    }
  } catch (error: any) {
    uploadMessage?.close();
    ElMessage.error(
      assistantApiErrorMessage(error, error?.message || "文档附件上传失败")
    );
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
    streaming: true,
    speechPlaybackState: assistantBootstrap.value?.speech?.enabled
      ? "preparing"
      : "disabled"
  });

  isChatStreaming.value = true;
  digitalHumanStreamState.value = "thinking";
  agentTrace.value = [];
  streamCancel.value?.();
  const streamRunId = activeStreamRunId.value + 1;
  activeStreamRunId.value = streamRunId;
  activeStreamMessageId.value = assistantMessageId;
  activeRequestId.value = "";
  lastStreamSequence.value = 0;
  const speechRequest = await speechController.prepareSpeech({
    conversationId: activeConversationId.value || undefined,
    courseId: selectedCourseId.value,
    targetStudentId: selectedTargetStudentId.value,
    interactionScope: interactionScope.value,
    voiceAlias: selectedSpeechVoiceAlias.value || undefined
  });
  if (!speechRequest) {
    updateAssistantMessage(assistantMessageId, {
      speechPlaybackState: "disabled"
    });
  }
  if (
    activeStreamMessageId.value !== assistantMessageId ||
    streamRunId !== activeStreamRunId.value
  ) {
    return;
  }
  const explanationImageRequestMode = explanationImageEnabled.value
    ? attachmentIds.length === 0
      ? explanationImageMode.value
      : "off"
    : undefined;
  const conversationId = activeConversationId.value || undefined;
  const identity = conversationId
    ? {}
    : buildAssistantIdentity(selectedCourseId.value);
  streamCancel.value = streamAssistantChat(
    {
      conversation_id: conversationId,
      ...identity,
      mode: apiMode.value,
      selected_agent: selectedAgentKey.value || undefined,
      skill_keys: selectedSkillKeys.value,
      selected_model: selectedModelKey.value || undefined,
      thinking_mode: thinkingModeKey.value || undefined,
      message: trimmed,
      attachment_ids: attachmentIds,
      enable_realtime_resource:
        selectedSkillKeys.value.includes("resource_hint"),
      preferred_explanation_mode:
        explanationImageRequestMode && explanationImageRequestMode !== "off"
          ? "visual"
          : undefined,
      explanation_image_mode: explanationImageRequestMode,
      speech: speechRequest,
      metadata: { ui_entry: "ai_app_workbench" }
    },
    event => handleAssistantStreamEvent(event, assistantMessageId, streamRunId)
  );
};

const handleStopStreaming = () => {
  const assistantMessageId = activeStreamMessageId.value;
  if (!assistantMessageId || !isChatStreaming.value) return;

  const currentMessage = messages.value.find(
    item => item.id === assistantMessageId
  );
  const hasPartialContent = !!currentMessage?.content.trim();
  streamCancel.value?.();
  void speechController.stopPlayback(true);
  appendStreamProgress(assistantMessageId, {
    event: "assistant.progress",
    stage: "answer_generating",
    status: "cancelled",
    summary: "已停止生成，已保留当前内容。",
    partial: hasPartialContent,
    finished: true
  });
  updateAssistantMessage(assistantMessageId, {
    streaming: false,
    stopped: true,
    partial: hasPartialContent,
    retryable: true,
    streamStatus: "cancelled",
    error: false,
    errorMessage: "已停止生成，已保留当前内容。"
  });
  digitalHumanStreamState.value = null;
  releaseActiveStream(assistantMessageId);
};

const handleRegenerateMessage = (assistantMessageId: string | number) => {
  const assistantIndex = messages.value.findIndex(
    item => item.id === assistantMessageId
  );
  const searchEnd =
    assistantIndex >= 0 ? assistantIndex : messages.value.length - 1;
  const lastUserMessage = messages.value
    .slice(0, searchEnd + 1)
    .reverse()
    .find(item => item.type === "user" && item.content.trim());

  if (!lastUserMessage) {
    ElMessage.warning("没有找到可重新生成的问题");
    return;
  }

  handleSendMessage(lastUserMessage.content);
};

const handlePlaySpeech = (assistantMessageId: string | number) => {
  const message = messages.value.find(item => item.id === assistantMessageId);
  if (!message?.speech?.session_id) return;
  void speechController.playSession(
    { session_id: message.speech.session_id },
    assistantMessageId
  );
};

const handleStopSpeech = (assistantMessageId: string | number) => {
  updateAssistantMessage(assistantMessageId, {
    speechPlaybackState: "paused"
  });
  void speechController.stopPlayback(false);
};

// === 栈操作预览弹窗 ===
const stackPreviewVisible = ref(false);
const platformPreviewVisible = ref(false);
const platformPreviewResource = ref<PlatformPreviewResource | null>(null);
const videoSegmentPreviewingId = ref("");
let platformPreviewRequestVersion = 0;
let videoSegmentPreviewRequestVersion = 0;
const courseVideoDetailRequests = new Map<
  number,
  Promise<CourseDetailResult>
>();
const videoSegmentSourceCache = new Map<string, string>();
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
function toPlatformPreviewResource(
  resource: Partial<AssistantResourceSummary> & {
    type?: string;
    desc?: string;
  }
): PlatformPreviewResource {
  return mapAssistantResourcePreview({
    ...resource,
    resource_type: resource.resource_type || resource.type,
    description: resource.description || resource.desc
  });
}

function hasPlatformPreviewSource(resource: PlatformPreviewResource) {
  return hasPlatformResourcePreview(resource);
}

async function handlePreview(res: AssistantChatResource) {
  if (res?.type === "animation") {
    stackPreviewVisible.value = true;
    return;
  }

  const requestVersion = ++platformPreviewRequestVersion;
  const initialResource = toPlatformPreviewResource(res || {});
  platformPreviewResource.value = initialResource;
  if (hasPlatformPreviewSource(initialResource)) {
    platformPreviewVisible.value = true;
  }

  if (!res?.resource_id) {
    if (!hasPlatformPreviewSource(initialResource)) {
      ElMessage.warning("该资源暂未提供可预览内容");
    }
    return;
  }

  try {
    const { data } = await getAssistantResource(res.resource_id, {
      course_id: selectedCourseId.value,
      target_student_id: selectedTargetStudentId.value
    });
    if (requestVersion !== platformPreviewRequestVersion) return;
    const detail = data.resource;
    if (!detail) throw new Error(data.message || "资源详情为空");
    platformPreviewResource.value = toPlatformPreviewResource({
      ...res,
      ...detail
    });
    platformPreviewVisible.value = true;
  } catch (error) {
    if (requestVersion !== platformPreviewRequestVersion) return;
    if (!hasPlatformPreviewSource(initialResource)) {
      ElMessage.error(assistantApiErrorMessage(error, "资源详情加载失败"));
    }
  }
}

function loadCourseVideoDetail(courseId: number) {
  const cached = courseVideoDetailRequests.get(courseId);
  if (cached) return cached;

  const request = getCourseDetail({ courseId })
    .then(response => response.data)
    .catch(error => {
      courseVideoDetailRequests.delete(courseId);
      throw error;
    });
  courseVideoDetailRequests.set(courseId, request);
  return request;
}

async function findVideoUrlByAnalysisTask(
  courseId: number,
  detail: CourseDetailResult,
  analysis: VideoAnalyzeFullResult | null,
  videoId: string
) {
  if (!videoId) return "";
  const candidates = listCourseVideoCandidates(detail, analysis || {}).filter(
    candidate => candidate.chapterId > 0 && candidate.hourId > 0
  );
  const batchSize = 4;
  for (let offset = 0; offset < candidates.length; offset += batchSize) {
    const batch = candidates.slice(offset, offset + batchSize);
    const urls = await Promise.all(
      batch.map(async candidate => {
        try {
          const response = await getVideoAnalyzeTask({
            courseId,
            chapterId: candidate.chapterId,
            hourId: candidate.hourId
          });
          return videoTaskMatchesCourseCandidate(
            response.data,
            candidate,
            videoId
          )
            ? candidate.fileUrl
            : "";
        } catch {
          return "";
        }
      })
    );
    const matchedUrl = urls.find(Boolean);
    if (matchedUrl) return matchedUrl;
  }
  return "";
}

async function resolveVideoSegmentSource(segment: AssistantChatVideoSegment) {
  const directUrl = directVideoSegmentUrl(segment);
  if (directUrl) {
    return { url: directUrl, analysis: null as VideoAnalyzeFullResult | null };
  }

  const videoId = String(segment.video_id || "").trim();
  const cachedUrl = videoSegmentSourceCache.get(videoId);
  if (cachedUrl) {
    return { url: cachedUrl, analysis: null as VideoAnalyzeFullResult | null };
  }
  let analysis: VideoAnalyzeFullResult | null = null;
  let analysisError: unknown;
  if (videoId) {
    try {
      const response = await getVideoAnalyzeResult({ taskId: videoId });
      analysis = response.data;
    } catch (error) {
      analysisError = error;
    }
  }

  const courseIds = [analysis?.courseId, selectedCourseId.value]
    .map(Number)
    .filter(
      (courseId, index, list) =>
        Number.isFinite(courseId) &&
        courseId > 0 &&
        list.indexOf(courseId) === index
    );
  for (const courseId of courseIds) {
    try {
      const detail = await loadCourseVideoDetail(courseId);
      const inferredUrl = findCourseVideoUrl(detail, analysis || {}, videoId);
      const url =
        inferredUrl ||
        (await findVideoUrlByAnalysisTask(courseId, detail, analysis, videoId));
      if (url) {
        if (videoId) videoSegmentSourceCache.set(videoId, url);
        return { url, analysis };
      }
    } catch (error) {
      analysisError ||= error;
    }
  }

  if (analysisError) throw analysisError;
  throw new Error("暂时未找到该片段对应的课程视频");
}

async function handleVideoSegmentPreview(segment: AssistantChatVideoSegment) {
  if (!segment?.segment_id) return;
  const requestVersion = ++videoSegmentPreviewRequestVersion;
  const courseIdAtRequest = selectedCourseId.value;
  videoSegmentPreviewingId.value = segment.segment_id;

  try {
    const { url, analysis } = await resolveVideoSegmentSource(segment);
    if (
      requestVersion !== videoSegmentPreviewRequestVersion ||
      courseIdAtRequest !== selectedCourseId.value
    ) {
      return;
    }

    platformPreviewResource.value = {
      title: segment.title || analysis?.fileName || "课程视频",
      url,
      previewUrl: url,
      downloadUrl: url,
      resourceType: "video",
      description: segment.summary || segment.reason,
      initialTimeMs: Math.max(0, Number(segment.start_ms || 0)),
      segmentStartMs: Math.max(0, Number(segment.start_ms || 0)),
      segmentEndMs: Math.max(0, Number(segment.end_ms || 0)),
      autoPlay: true
    };
    platformPreviewVisible.value = true;
  } catch (error) {
    if (requestVersion !== videoSegmentPreviewRequestVersion) return;
    ElMessage.error(
      assistantApiErrorMessage(error, "暂时无法定位该片段对应的完整视频")
    );
  } finally {
    if (requestVersion === videoSegmentPreviewRequestVersion) {
      videoSegmentPreviewingId.value = "";
    }
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
const modelSelectableStatuses = new Set(["available", "deprecated"]);
const normalizedModelStatus = (model?: AssistantOption) =>
  model?.status || "available";
const isAssistantModelSelectable = (model?: AssistantOption) =>
  !!model && modelSelectableStatuses.has(normalizedModelStatus(model));
const modelStatusText = (status?: string) => {
  const map: Record<string, string> = {
    available: "可用",
    unavailable: "不可用",
    degraded: "降级",
    deprecated: "兼容"
  };
  return map[status || ""] || status || "";
};
const selectableModels = computed(() =>
  (assistantBootstrap.value?.models || []).filter(isAssistantModelSelectable)
);
const selectedModelOption = computed(() =>
  (assistantBootstrap.value?.models || []).find(
    item => item.key === selectedModelKey.value
  )
);
const selectedModelReady = computed(() =>
  isAssistantModelSelectable(selectedModelOption.value)
);
const selectedModelDisabledReason = computed(() => {
  const models = assistantBootstrap.value?.models || [];
  if (!models.length) return "模型列表为空";
  if (!selectableModels.value.length) return "当前没有可用模型";
  const model = selectedModelOption.value;
  if (!model) return "请选择可用模型";
  if (isAssistantModelSelectable(model)) return "";
  return model.reason
    ? assistantModelReasonText(model.reason)
    : "该模型当前不可用";
});
const selectDefaultModelKey = (models: AssistantOption[], current?: string) => {
  const currentModel = models.find(model => model.key === current);
  if (isAssistantModelSelectable(currentModel)) return currentModel?.key || "";
  return (
    models.find(
      model =>
        isAssistantModelSelectable(model) &&
        model.default_for?.includes("a3_chat")
    )?.key ||
    models.find(isAssistantModelSelectable)?.key ||
    ""
  );
};
const handleModelSelect = (modelKey: string) => {
  const model = (assistantBootstrap.value?.models || []).find(
    item => item.key === modelKey
  );
  if (!isAssistantModelSelectable(model)) {
    ElMessage.warning(
      model?.reason
        ? assistantModelReasonText(model.reason)
        : "该模型当前不可用"
    );
    return;
  }
  selectedModelKey.value = modelKey;
};

const selectedAgentLabel = computed(() =>
  optionLabel(assistantBootstrap.value?.agents || [], selectedAgentKey.value)
);
const selectedModelLabel = computed(() =>
  selectedModelKey.value
    ? optionLabel(
        assistantBootstrap.value?.models || [],
        selectedModelKey.value
      )
    : "暂无可用模型"
);
const thinkingModeLabel = computed(() =>
  optionLabel(
    assistantBootstrap.value?.thinking_modes || [],
    thinkingModeKey.value
  )
);

const applyBootstrap = (data: AssistantBootstrapResp) => {
  const previousStudentId = selectedStudentId.value;
  const resolvedScope =
    data.interaction_scope ||
    data.default_interaction_scope ||
    (isStaffMode.value ? "course_general" : "personal_learning");
  interactionScope.value = resolvedScope;
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

  selectedStudentId.value =
    resolvedScope === "student_analysis"
      ? data.selected_student_id ||
        myStudents.value.find(student => student.id === previousStudentId)?.id
      : undefined;
  ensureStudentContextForActiveRail();
  const previousCourseId = activeCourse.value?.id;
  const manuallySelectedCourse = manuallySelectedCourseId.value
    ? myCourses.value.find(
        course => course.id === manuallySelectedCourseId.value
      )
    : null;
  const routeSelectedCourse = routeCourseId.value
    ? myCourses.value.find(course => course.id === routeCourseId.value)
    : null;
  const preservedCourse = previousCourseId
    ? myCourses.value.find(course => course.id === previousCourseId)
    : null;
  activeCourse.value =
    manuallySelectedCourse || routeSelectedCourse || preservedCourse || null;
  selectedAgentKey.value = data.agents?.[0]?.key || "";
  selectedModelKey.value = selectDefaultModelKey(
    data.models || [],
    selectedModelKey.value
  );
  thinkingModeKey.value = data.thinking_modes?.[0]?.key || "";
  selectedSkillKeys.value = (data.skills || [])
    .filter((skill: AssistantSkill) => skill.default_on)
    .map(skill => skill.key);
  selectedSpeechVoiceAlias.value =
    (selectedSpeechVoiceAlias.value &&
    data.speech?.voices?.some(
      voice => voice.alias === selectedSpeechVoiceAlias.value
    )
      ? selectedSpeechVoiceAlias.value
      : data.speech?.default_voice_alias || data.speech?.voices?.[0]?.alias) ||
    "";
  speechController.configure(data.speech);
  speechTransportStatus.value = data.speech?.enabled
    ? data.speech.realtime?.enabled
      ? data.speech.realtime.pipeline_mode === "incremental_rules" &&
        data.speech.realtime.text_tts_parallel
        ? "真实时语音已就绪"
        : "实时语音已就绪（终态模式）"
      : "完整录音模式"
    : "语音能力未开放";

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
    if (!assistantBootstrap.value) {
      interactionScope.value = isStaffMode.value
        ? "course_general"
        : "personal_learning";
    }
    const { data } = await getAssistantBootstrap(
      buildAssistantIdentity(selectedCourseId.value)
    );
    applyBootstrap(data);
    await loadConversationGroups();
  } catch (error: any) {
    console.error("[AiApp] 学习助手启动上下文加载失败:", error);
    ElMessage.error(
      assistantApiErrorMessage(error, "学习助手启动上下文加载失败")
    );
  } finally {
    isBootstrapping.value = false;
  }
};

const loadConversationGroups = async () => {
  try {
    const { data } = await getAssistantConversationGroups(
      buildAssistantIdentity()
    );
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
    const { data } = await getAssistantConversation(
      conversation.conversation_id
    );
    activeConversationId.value = conversation.conversation_id;
    const detailConversation = data.conversation || conversation;
    const existingIndex = conversations.value.findIndex(
      item => item.conversation_id === detailConversation.conversation_id
    );
    const normalizedConversation = normalizeConversation(
      detailConversation,
      conversation.course
    );
    if (existingIndex >= 0)
      conversations.value[existingIndex] = normalizedConversation;
    else conversations.value.unshift(normalizedConversation);
    if (detailConversation.metadata)
      conversation.metadata = detailConversation.metadata;
    const course =
      myCourses.value.find(
        item =>
          item.id === (detailConversation.course_id || conversation.course_id)
      ) || myCourses.value.find(item => item.name === conversation.course);
    if (course) activeCourse.value = course;
    messages.value = (data.messages || data.list || []).map(item => ({
      id: item.message_id,
      role: item.role === "user" ? currentUserRoleLabel.value : "智能助教",
      type: item.role === "user" ? "user" : "system",
      content: item.content_text || "",
      avatar: item.role === "user" ? currentUserAvatar.value : undefined,
      resources: item.resources || [],
      metadata: item.metadata,
      explanationImages:
        item.explanation_images || item.metadata?.explanation_images || [],
      speech: item.speech || null,
      speechPlaybackState: item.speech
        ? mapSpeechSessionPlaybackState(item.speech)
        : "disabled"
    }));
    messages.value.forEach(message => {
      if (message.type !== "system") return;
      if (
        message.speech?.session_id &&
        (shouldPollSpeechSession(message.speech) ||
          isSpeechArchiveRecovering(message.speech))
      ) {
        speechController.resumeSession(message.speech.session_id, message.id);
      }
      (message.explanationImages || []).forEach(image => {
        startExplanationImagePolling(image, message.id);
      });
    });
    if (!messages.value.length) resetChatGreeting();
  } catch (error: any) {
    console.error("[AiApp] 学习助手会话消息加载失败:", error);
    ElMessage.error(assistantApiErrorMessage(error, "会话消息加载失败"));
  }
};

const handleSidebarConversationSelect = async (
  conversation: ConversationView
) => {
  closeCourseDrawer();
  await loadConversationMessages(conversation);
};

const handleSwitchCourse = (courseName: string) => {
  const target = myCourses.value.find(course => course.name === courseName);
  if (!target) return;
  if (target.id !== selectedCourseId.value) {
    void handleCourseContextChange(target.id);
    return;
  }
  activeCourse.value = target;
  activeConversationId.value = "";
  resetChatGreeting();
};

const handleProfileLoaded = (payload: { dimensions?: any[] }) => {
  if (payload.dimensions?.length) {
    profileDimensions.value = payload.dimensions;
  }
};

const handleGovernanceSelectStudent = (payload: {
  studentId: number;
  rail: "profile" | "path" | "assessment";
}) => {
  selectedStudentId.value = payload.studentId;
  activeRail.value = payload.rail;
  if (route.path.startsWith("/ai-app/")) {
    void router.push(`/ai-app/${payload.rail}`);
  }
};

const handleGovernanceNavigate = (rail: "generation") => {
  activeRail.value = rail;
  if (route.path.startsWith("/ai-app/")) {
    void router.push(`/ai-app/${rail}`);
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
const quickVoiceListening = ref(false);
const hasQuickVoiceCapability = () =>
  typeof window !== "undefined" &&
  Boolean(
    (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      (window as any).plus?.speech?.startRecognize
  );
const quickVoiceSupported = ref(hasQuickVoiceCapability());
const quickUploadInputRef = ref<HTMLInputElement | null>(null);
let quickSpeechRecognition: any = null;
let quickNativeSpeechActive = false;
let quickNativeSpeechStopRequested = false;
type QuickAttachmentPreview = {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  extension: string;
  previewUrl?: string;
};
const quickAttachments = ref<QuickAttachmentPreview[]>([]);
const quickInteractionMessages = [
  "老师好",
  "这一段没听懂",
  "请再讲一遍",
  "我做完了"
];

const handleQuickInteraction = (text: string) => {
  void handleSendMessage(text);
};

const handleQuickUploadClick = () => {
  quickUploadInputRef.value?.click();
};

const getQuickFileExtension = (file: File) => {
  const nameExtension = file.name.split(".").pop()?.trim();
  const typeExtension = file.type.split("/").pop()?.trim();
  return (nameExtension || typeExtension || "file").slice(0, 8).toUpperCase();
};

const formatQuickFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  const units = ["KB", "MB", "GB"];
  let value = size / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${
    units[unitIndex]
  }`;
};

const getQuickAttachmentKind = (attachment: QuickAttachmentPreview) => {
  const type = attachment.type.toLowerCase();
  const extension = attachment.extension.toUpperCase();
  if (type.startsWith("image/")) return "图片";
  if (type.includes("pdf") || extension === "PDF") return "PDF";
  if (type.includes("word") || ["DOC", "DOCX"].includes(extension)) {
    return "Word";
  }
  if (
    type.includes("spreadsheet") ||
    ["XLS", "XLSX", "CSV"].includes(extension)
  ) {
    return "表格";
  }
  if (type.includes("presentation") || ["PPT", "PPTX"].includes(extension)) {
    return "PPT";
  }
  return extension || "文件";
};

const revokeQuickAttachmentUrl = (attachment: QuickAttachmentPreview) => {
  if (attachment.previewUrl) {
    URL.revokeObjectURL(attachment.previewUrl);
  }
};

const clearQuickAttachments = () => {
  quickAttachments.value.forEach(revokeQuickAttachmentUrl);
  quickAttachments.value = [];
};

const removeQuickAttachment = (id: string) => {
  const attachment = quickAttachments.value.find(item => item.id === id);
  if (attachment) revokeQuickAttachmentUrl(attachment);
  quickAttachments.value = quickAttachments.value.filter(
    item => item.id !== id
  );
};

const handleQuickAttachmentChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  if (!files.length) return;

  const createdAt = Date.now();
  const nextAttachments: QuickAttachmentPreview[] = [];
  const rejected: string[] = [];
  files.forEach((file, index) => {
    const extension = getQuickFileExtension(file).toLowerCase();
    if (!documentAttachmentContentTypes[extension]) {
      rejected.push(`${file.name} 格式不支持`);
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      rejected.push(`${file.name} 超过 20MB`);
      return;
    }
    nextAttachments.push({
      id: `${file.name}-${file.size}-${file.lastModified}-${createdAt}-${index}`,
      file,
      name: file.name,
      size: file.size,
      type: file.type || "",
      extension: getQuickFileExtension(file),
      previewUrl: undefined
    });
  });
  if (nextAttachments.length) {
    quickAttachments.value = [
      ...quickAttachments.value,
      ...nextAttachments
    ].slice(0, 3);
    ElMessage.success(`已选择 ${nextAttachments.length} 个文档附件`);
  }
  if (rejected.length) {
    ElMessage.warning(rejected.slice(0, 2).join("；"));
  }
  input.value = "";
};

const handleQuickVoiceInput = () => {
  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  const nativeSpeech = (window as any).plus?.speech;

  if (!SpeechRecognition && nativeSpeech?.startRecognize) {
    if (quickNativeSpeechActive) {
      quickNativeSpeechStopRequested = true;
      nativeSpeech.stopRecognize?.();
      quickNativeSpeechActive = false;
      quickVoiceListening.value = false;
      return;
    }

    const initialText = quickMessage.value.trim();
    quickNativeSpeechStopRequested = false;
    quickNativeSpeechActive = true;
    quickVoiceListening.value = true;
    try {
      nativeSpeech.startRecognize(
        {
          engine: "iFly",
          lang: "zh-cn",
          continue: false,
          punctuation: true,
          userInterface: false
        },
        (result: string) => {
          const spokenText = String(result || "").trim();
          const separator = initialText && spokenText ? " " : "";
          quickMessage.value = `${initialText}${separator}${spokenText}`.trim();
          quickNativeSpeechActive = false;
          quickVoiceListening.value = false;
        },
        (error: { message?: string }) => {
          quickNativeSpeechActive = false;
          quickVoiceListening.value = false;
          if (!quickNativeSpeechStopRequested) {
            ElMessage.warning(error?.message || "语音输入暂时不可用");
          }
          quickNativeSpeechStopRequested = false;
        }
      );
    } catch {
      quickNativeSpeechActive = false;
      quickVoiceListening.value = false;
      ElMessage.warning("语音输入暂时不可用");
    }
    return;
  }

  if (!SpeechRecognition) {
    ElMessage.warning("当前环境暂不支持系统语音输入");
    return;
  }

  if (quickVoiceListening.value && quickSpeechRecognition) {
    quickSpeechRecognition.stop?.();
    return;
  }

  const initialText = quickMessage.value.trim();
  const recognition = new SpeechRecognition();
  quickSpeechRecognition = recognition;
  recognition.lang = "zh-CN";
  recognition.continuous = false;
  recognition.interimResults = true;
  let committedSpeechText = "";

  recognition.onresult = (event: any) => {
    let interimText = "";
    for (let index = event.resultIndex; index < event.results.length; index++) {
      const transcript = event.results[index][0]?.transcript || "";
      if (event.results[index].isFinal) {
        committedSpeechText += transcript;
      } else {
        interimText += transcript;
      }
    }
    const spokenText = `${committedSpeechText}${interimText}`.trim();
    const separator = initialText && spokenText ? " " : "";
    quickMessage.value = `${initialText}${separator}${spokenText}`.trim();
  };

  recognition.onerror = (event: any) => {
    quickVoiceListening.value = false;
    if (event?.error === "not-allowed") {
      ElMessage.warning("请允许浏览器使用麦克风");
    } else if (!["aborted", "no-speech"].includes(event?.error)) {
      ElMessage.warning("语音输入暂时不可用");
    }
  };

  recognition.onend = () => {
    quickVoiceListening.value = false;
    quickSpeechRecognition = null;
  };

  try {
    quickVoiceListening.value = true;
    recognition.start();
  } catch {
    quickVoiceListening.value = false;
    quickSpeechRecognition = null;
  }
};

const handleNewChat = async (payload: { course: string }) => {
  const course = myCourses.value.find(item => item.name === payload.course);
  if (!course) {
    ElMessage.warning("请先选择课程");
    if (isCompactViewport.value) openCourseDrawer();
    return;
  }
  if (course.id !== selectedCourseId.value) {
    await handleCourseContextChange(course.id);
  } else {
    activeCourse.value = course;
  }
  const courseId = course.id;
  const courseName = course.name;
  if (
    interactionScope.value === "student_analysis" &&
    !selectedTargetStudentId.value
  ) {
    ElMessage.warning("请选择要分析的学生");
    return;
  }
  if (!selectedModelReady.value) {
    ElMessage.warning(selectedModelDisabledReason.value || "当前没有可用模型");
    return;
  }
  resetChatGreeting();
  try {
    const identity = buildAssistantIdentity(courseId);
    const { data } = await createAssistantConversation({
      ...identity,
      course_id: courseId,
      title:
        interactionScope.value === "course_general"
          ? `${courseName} 课程通用问答`
          : interactionScope.value === "student_analysis"
            ? `${courseName} 学情分析`
            : courseName
              ? `${courseName} 学习辅导`
              : "学习辅导",
      metadata: {
        ui_entry: "ai_app_sidebar",
        selected_agent: selectedAgentKey.value,
        selected_model: selectedModelKey.value,
        thinking_mode: thinkingModeKey.value,
        skill_keys: selectedSkillKeys.value.join(",")
      }
    });
    const conversationId =
      data.conversation?.conversation_id || data.conversation_id;
    if (!conversationId) {
      throw new Error("后端未返回会话 ID");
    }
    const conversation: AssistantConversationItem = data.conversation || {
      conversation_id: conversationId,
      title: data.title || (courseName ? `${courseName} 学习辅导` : "学习辅导"),
      message_count: 0,
      course_id: courseId,
      target_student_id: selectedTargetStudentId.value,
      subject_student_id: selectedTargetStudentId.value,
      interaction_scope: interactionScope.value,
      visibility_scope: isStaffMode.value ? "staff_private" : "student_private",
      identity_version: 2,
      legacy_read_only: false
    };
    activeConversationId.value = conversation.conversation_id;
    conversations.value = [
      normalizeConversation(conversation, course?.name),
      ...conversations.value.filter(
        item => item.conversation_id !== conversation.conversation_id
      )
    ];
  } catch (error: any) {
    console.error("[AiApp] 创建学习助手会话失败:", error);
    ElMessage.error(assistantApiErrorMessage(error, "创建会话失败"));
    return;
  }

  const pendingMessage = quickMessage.value.trim();
  if (pendingMessage) {
    const pendingFiles = quickAttachments.value.map(item => item.file);
    // 切换到聊天栏目，确保数字人状态与课程上下文同步。
    activeRail.value = "chat";
    // 微延时等待课程上下文切换完成。
    setTimeout(() => {
      void handleSendMessage({ text: pendingMessage, files: pendingFiles });
      quickMessage.value = "";
      clearQuickAttachments();
    }, 100);
  }
};

const handleSidebarNewChat = async (payload: { course: string }) => {
  closeCourseDrawer();
  await handleNewChat(payload);
};

const handleMobileNewChat = async () => {
  activeRail.value = "chat";
  const courseName = activeCourse.value?.name || "";
  if (!courseName) {
    ElMessage.info("请先选择课程");
    openCourseDrawer();
    return;
  }
  closeCourseDrawer({ restoreFocus: false });
  await handleNewChat({ course: courseName });
};

const syncHumanRenderState = () => {
  const shouldPauseVirtualHuman =
    document.hidden ||
    activeRail.value !== "chat" ||
    humanCollapsed.value ||
    !canMountInline3D.value;
  if (shouldPauseVirtualHuman) {
    virtualHumanRef.value?.pauseRender?.();
  } else {
    virtualHumanRef.value?.resumeRender?.();
  }

  if (document.hidden) {
    floatingHumanRef.value?.pauseRender?.();
  } else {
    floatingHumanRef.value?.resumeRender?.();
  }
};

watch([activeRail, humanCollapsed, canMountInline3D], () => {
  syncHumanRenderState();
});

watch(activeRail, () => {
  ensureStudentContextForActiveRail();
});

watch(selectedStudentId, () => {
  if (
    isCourseSwitching.value ||
    isInteractionScopeSwitching.value ||
    isBootstrapping.value ||
    !assistantBootstrap.value ||
    !isStaffMode.value ||
    interactionScope.value !== "student_analysis"
  )
    return;
  activeConversationId.value = "";
  resetChatGreeting();
  void loadAssistantBootstrap();
});

const handleVisibilityChange = () => {
  syncHumanRenderState();
};

const refreshQuickVoiceCapability = () => {
  quickVoiceSupported.value = hasQuickVoiceCapability();
};

onMounted(() => {
  document.addEventListener("visibilitychange", handleVisibilityChange);
  document.addEventListener("plusready", refreshQuickVoiceCapability);
  window.addEventListener("resize", syncSidebarWidthLimit);
  refreshQuickVoiceCapability();
  syncSidebarWidthLimit();
  setTimeout(() => {
    syncHumanRenderState();
  }, 0);
});

onUnmounted(() => {
  streamCancel.value?.();
  speechController.dispose();
  clearAllResourceTaskPolling();
  clearAllExplanationImagePolling();
  quickSpeechRecognition?.stop?.();
  quickSpeechRecognition = null;
  if (localDigitalHumanSpeechTimer) clearTimeout(localDigitalHumanSpeechTimer);
  if (quickNativeSpeechActive) {
    quickNativeSpeechStopRequested = true;
    (window as any).plus?.speech?.stopRecognize?.();
    quickNativeSpeechActive = false;
  }
  clearQuickAttachments();
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  document.removeEventListener("plusready", refreshQuickVoiceCapability);
  window.removeEventListener("resize", syncSidebarWidthLimit);
  document.documentElement.classList.remove("ai-app-sidebar-resizing");
});
</script>

<template>
  <div
    class="ai-app-root h-[100dvh] flex flex-col overflow-hidden"
    :class="[
      currentTheme,
      {
        'is-chat': activeRail === 'chat',
        'is-compact-viewport': isCompactViewport
      }
    ]"
  >
    <div class="flex-1 min-h-0 flex overflow-hidden">
      <!-- 极简左侧边栏 (第一块) -->
      <aside
        v-if="activeRail === 'chat'"
        id="ai-app-course-sidebar"
        ref="courseDrawerRef"
        class="ai-app-left-rail flex-shrink-0 z-20 flex flex-col relative"
        :class="{
          'is-collapsed': sidebarCollapsed,
          'is-resizing': sidebarResizing
        }"
        :style="{ width: `${sidebarRenderedWidth}px` }"
        aria-label="课程与会话侧栏"
        :role="isCompactViewport && !sidebarCollapsed ? 'dialog' : undefined"
        :aria-modal="
          isCompactViewport && !sidebarCollapsed ? 'true' : undefined
        "
        tabindex="-1"
        @keydown="handleCourseDrawerKeydown"
      >
        <div v-show="!sidebarCollapsed" class="ai-course-drawer-header">
          <div>
            <strong>课程与对话</strong>
            <span>{{ mode }}</span>
          </div>
          <button
            type="button"
            aria-label="关闭课程与对话"
            title="关闭课程与对话"
            @click="closeCourseDrawer()"
          >
            <el-icon><Close /></el-icon>
          </button>
        </div>
        <div v-show="!sidebarCollapsed" class="flex-1 overflow-hidden">
          <AiSidebar
            v-model:activeRail="activeRail"
            :conversations="conversations"
            :courses="myCourses.map(course => course.name)"
            @new-chat="handleSidebarNewChat"
            @select-chat="handleSidebarConversationSelect"
          />
        </div>

        <!-- 收起态：竖向标识 -->
        <div
          v-show="sidebarCollapsed"
          class="flex-1 flex flex-col items-center justify-center text-gray-400 select-none cursor-pointer"
          @click="toggleSidebar"
        >
          <el-icon :size="14" class="rotate-90 mb-2"><FolderOpened /></el-icon>
          <span
            class="text-[11px] tracking-widest"
            style="writing-mode: vertical-rl"
            >课程 · 历史</span
          >
        </div>

        <button
          v-if="!sidebarCollapsed"
          type="button"
          class="ai-app-left-rail__resize-handle"
          role="separator"
          aria-label="调整课程侧栏宽度"
          aria-controls="ai-app-course-sidebar"
          aria-orientation="vertical"
          :aria-valuemin="sidebarMinWidth"
          :aria-valuemax="sidebarMaxWidth"
          :aria-valuenow="sidebarWidth"
          tabindex="0"
          title="拖动调整宽度，双击恢复默认"
          @pointerdown="beginSidebarResize"
          @pointermove="updateSidebarResize"
          @pointerup="endSidebarResize"
          @pointercancel="endSidebarResize"
          @lostpointercapture="endSidebarResize"
          @dblclick="resetSidebarWidth"
          @keydown="handleSidebarResizeKeydown"
        >
          <span aria-hidden="true" />
        </button>

        <!-- 收起 / 展开 把手 -->
        <button
          class="absolute top-3 -right-3 w-6 h-6 rounded-md bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-500 hover:text-primary hover:border-primary/40 transition-colors z-30"
          :title="sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'"
          @click="toggleSidebar"
        >
          <el-icon :size="12">
            <Expand v-if="sidebarCollapsed" />
            <Fold v-else />
          </el-icon>
        </button>
      </aside>

      <button
        v-if="isCompactViewport && activeRail === 'chat' && !sidebarCollapsed"
        type="button"
        class="ai-course-drawer-scrim"
        aria-label="关闭课程与对话"
        @click="closeCourseDrawer()"
      />

      <!-- 右边总体容器 (主体) -->
      <div class="ai-app-main-column flex-1 flex flex-col min-w-0">
        <header
          v-if="isCompactViewport && activeRail === 'chat'"
          class="ai-mobile-app-bar"
        >
          <button
            ref="courseDrawerTriggerRef"
            type="button"
            aria-label="打开课程与对话"
            title="课程与对话"
            aria-controls="ai-app-course-sidebar"
            :aria-expanded="!sidebarCollapsed"
            @click="openCourseDrawer"
          >
            <el-icon><Menu /></el-icon>
          </button>
          <div class="ai-mobile-app-bar__title">
            <strong>{{ mobileChatTitle }}</strong>
            <span>{{ mode }}</span>
          </div>
          <button
            type="button"
            aria-label="新建对话"
            title="新建对话"
            @click="handleMobileNewChat"
          >
            <el-icon><Plus /></el-icon>
          </button>
        </header>

        <!-- 课程 / 学生上下文工具栏 -->
        <div
          v-if="
            showCourseContext &&
            (!isCompactViewport || activeRail !== 'chat' || isStaffMode)
          "
          class="ai-course-context-bar flex-none flex items-center justify-end gap-3 bg-white mb-5 px-6 py-3 border border-gray-100 rounded-lg z-10 relative overflow-hidden"
        >
          <span class="text-xs text-gray-500 font-medium">{{
            courseContextLabel
          }}</span>
          <el-select
            v-model="selectedCoursePickerId"
            placeholder="请选择课程"
            size="small"
            style="width: 220px"
            class="course-select"
            :disabled="isBootstrapping || !myCourses.length"
          >
            <template #prefix>
              <el-icon><FolderOpened /></el-icon>
            </template>
            <el-option
              v-for="item in myCourses"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            >
              <div class="flex items-center justify-between gap-3">
                <span class="text-sm truncate">{{ item.name }}</span>
                <span
                  v-if="item.subtitle"
                  class="text-xs text-gray-400 truncate max-w-[110px]"
                >
                  {{ item.subtitle }}
                </span>
              </div>
            </el-option>
          </el-select>
          <template v-if="isStaffMode && activeRail === 'chat'">
            <span class="text-xs text-gray-500 font-medium">问答范围:</span>
            <el-select
              :model-value="interactionScope"
              :title="interactionScopeLabel"
              size="small"
              style="width: 180px"
              class="interaction-scope-select"
              :disabled="isBootstrapping || isChatStreaming"
              @update:model-value="handleInteractionScopeChange"
            >
              <el-option
                v-for="scope in supportedInteractionScopes"
                :key="scope"
                :label="
                  scope === 'course_general' ? '课程通用问答' : '学生学情分析'
                "
                :value="scope"
              />
            </el-select>
          </template>
          <template v-if="showStudentContext">
            <span class="text-xs text-gray-500 font-medium">分析对象:</span>
            <el-select
              v-model="selectedStudentId"
              placeholder="请选择学生"
              size="small"
              style="width: 160px"
              class="student-select"
              :disabled="isBootstrapping || isCourseSwitching"
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
          </template>
        </div>

        <!-- 主体内容 (第三块) -->
        <main class="ai-app-content flex-1 min-w-0 overflow-hidden relative">
          <!-- 【场景 A1】 智能辅导对谈框 (已选课) -->
          <div
            v-if="activeRail === `chat` && activeCourse"
            class="ai-chat-workbench h-full w-full min-w-0 flex items-stretch p-4 gap-4 overflow-hidden"
          >
            <!-- 对话流核心面板 -->
            <transition appear name="panel-slide">
              <div
                class="ai-chat-dialog-panel ai-workbench-panel flex-1 min-w-0 h-full overflow-hidden relative"
              >
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
                  :explanation-image-enabled="explanationImageEnabled"
                  :explanation-image-mode="explanationImageMode"
                  :model-ready="selectedModelReady"
                  :model-disabled-reason="selectedModelDisabledReason"
                  :loading="isChatStreaming"
                  :video-segment-previewing-id="videoSegmentPreviewingId"
                  @send="handleSendMessage"
                  @stop="handleStopStreaming"
                  @preview="handlePreview"
                  @preview-video-segment="handleVideoSegmentPreview"
                  @regenerate="handleRegenerateMessage"
                  @refresh-explanation-image="handleRefreshExplanationImage"
                  @play-speech="handlePlaySpeech"
                  @stop-speech="handleStopSpeech"
                  @switch-course="handleSwitchCourse"
                  @update:selectedAgent="selectedAgentKey = $event"
                  @update:selectedModel="handleModelSelect"
                  @update:thinkingMode="thinkingModeKey = $event"
                  @update:explanationImageMode="explanationImageMode = $event"
                />
              </div>
            </transition>

            <!-- 数字人面板：保留原右侧 VRM 数字人模块 -->
            <transition appear name="panel-reveal">
              <div
                v-if="canMountInline3D"
                class="ai-human-column h-full min-w-0 flex flex-col gap-4 transition-all duration-200 ease-out relative"
                :class="{ 'is-collapsed': humanCollapsed }"
              >
                <!-- 收起 / 展开把手：挂在外层，避免被圆角容器裁切 -->
                <button
                  class="absolute top-4 left-0 -translate-x-1/2 w-7 h-7 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-500 hover:text-primary hover:border-primary/40 transition-colors z-[140]"
                  :title="humanCollapsed ? '展开数字人' : '收起数字人'"
                  @click="toggleHuman"
                >
                  <el-icon :size="12">
                    <Fold v-if="humanCollapsed" />
                    <Expand v-else />
                  </el-icon>
                </button>

                <div
                  class="ai-workbench-panel flex-1 min-w-0 overflow-hidden relative"
                >
                  <VirtualHumanPanel
                    v-show="activeRail === 'chat' && !humanCollapsed"
                    ref="virtualHumanRef"
                    :speech-enabled="
                      Boolean(assistantBootstrap?.speech?.enabled)
                    "
                    :voices="assistantBootstrap?.speech?.voices || []"
                    :voice-alias="selectedSpeechVoiceAlias"
                    :speech-status="speechTransportStatus"
                    :speech-detail="speechDiagnosticText"
                    @update:voice-alias="selectedSpeechVoiceAlias = $event"
                    @test-speech-output="testSpeechOutput"
                    @copy-speech-diagnostics="copySpeechDiagnostics"
                  />

                  <div
                    v-show="humanCollapsed"
                    class="h-full flex flex-col items-center justify-center text-gray-400 select-none cursor-pointer gap-6 group/btn"
                    @click="toggleHuman"
                  >
                    <div
                      class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary transition-colors duration-200"
                    >
                      <el-icon :size="20"><Avatar /></el-icon>
                    </div>
                    <span
                      class="text-[11px] font-semibold tracking-normal text-gray-500 group-hover/btn:text-primary transition-colors"
                      style="writing-mode: vertical-rl"
                    >
                      专属助教
                    </span>
                  </div>
                </div>

                <transition name="el-zoom-in-bottom">
                  <div
                    v-show="!humanCollapsed"
                    class="ai-workbench-panel flex-none min-w-0 p-3 flex flex-col gap-2 overflow-hidden z-[100]"
                    style="min-height: 180px"
                  >
                    <div
                      class="text-[12px] font-semibold text-gray-600 text-center border-b border-gray-100 pb-1.5 mb-1"
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
                        class="!w-full !m-0 !text-[12px] !rounded-lg !border-blue-100 !bg-blue-50/50 hover:!bg-blue-100 hover:!text-primary transition-colors duration-200"
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
            class="ai-welcome-center h-full w-full p-4 flex items-center justify-center relative"
          >
            <div
              class="ai-welcome-content w-full max-w-5xl px-6 space-y-8 relative z-10 transform -translate-y-8"
            >
              <div class="ai-welcome-heading text-center space-y-4">
                <h1
                  class="text-3xl sm:text-[38px] font-bold tracking-tight text-primary"
                >
                  今天想学习什么？
                </h1>
                <p class="text-[15px] font-medium tracking-wide text-gray-500">
                  请先选择一门课程，然后随时寻求学习辅导
                </p>
              </div>

              <div
                class="quick-chat-card ai-mobile-composer-surface"
                data-ai-mobile-composer="welcome"
              >
                <input
                  ref="quickUploadInputRef"
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  class="quick-chat-file-input"
                  @change="handleQuickAttachmentChange"
                />
                <div
                  v-if="quickAttachments.length"
                  class="quick-attachment-shelf"
                >
                  <div
                    v-for="attachment in quickAttachments"
                    :key="attachment.id"
                    class="quick-attachment-card"
                    :title="`${attachment.name} · ${formatQuickFileSize(
                      attachment.size
                    )} · ${getQuickAttachmentKind(attachment)}`"
                  >
                    <div class="quick-attachment-preview">
                      <img
                        v-if="attachment.previewUrl"
                        :src="attachment.previewUrl"
                        :alt="attachment.name"
                      />
                      <span v-else>{{ attachment.extension }}</span>
                    </div>
                    <div class="quick-attachment-info">
                      <span class="quick-attachment-name">
                        {{ attachment.name }}
                      </span>
                      <span class="quick-attachment-meta">
                        {{ formatQuickFileSize(attachment.size) }} ·
                        {{ getQuickAttachmentKind(attachment) }}
                      </span>
                    </div>
                    <button
                      type="button"
                      class="quick-attachment-remove"
                      title="删除附件"
                      aria-label="删除附件"
                      @click="removeQuickAttachment(attachment.id)"
                    >
                      <el-icon><Close /></el-icon>
                    </button>
                  </div>
                </div>
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

                <div class="quick-chat-toolbar">
                  <div class="quick-chat-tools-left">
                    <button
                      type="button"
                      class="quick-chat-icon-button quick-chat-upload-button"
                      title="上传资料"
                      @click="handleQuickUploadClick"
                    >
                      <span class="quick-chat-upload-plus" aria-hidden="true">
                        +
                      </span>
                    </button>

                    <el-dropdown
                      trigger="click"
                      popper-class="quick-chat-dropdown"
                      @command="c => (quickCourse = c)"
                    >
                      <span
                        class="quick-chat-chip quick-chat-chip--interactive"
                        :class="{ 'is-selected': quickCourse }"
                      >
                        <el-icon class="quick-chat-chip__icon">
                          <FolderOpened />
                        </el-icon>
                        <span class="quick-chat-chip__text">
                          {{ quickCourse || "选择课程" }}
                        </span>
                        <el-icon class="quick-chat-chip__arrow">
                          <ArrowDown />
                        </el-icon>
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

                    <span class="quick-chat-chip quick-chat-chip--static">
                      <el-icon class="quick-chat-chip__icon">
                        <Monitor />
                      </el-icon>
                      <span class="quick-chat-chip__text">{{ mode }}</span>
                    </span>

                    <el-dropdown
                      trigger="click"
                      popper-class="quick-chat-dropdown"
                      @command="a => (selectedAgentKey = a)"
                    >
                      <span
                        class="quick-chat-chip quick-chat-chip--interactive"
                      >
                        <el-icon class="quick-chat-chip__icon">
                          <Cpu />
                        </el-icon>
                        <span class="quick-chat-chip__text">
                          {{ selectedAgentLabel || "选择助手" }}
                        </span>
                        <el-icon class="quick-chat-chip__arrow">
                          <ArrowDown />
                        </el-icon>
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

                  <div class="quick-chat-tools-right">
                    <el-dropdown
                      trigger="click"
                      popper-class="quick-chat-dropdown"
                      @command="handleModelSelect"
                    >
                      <span class="quick-chat-model-trigger">
                        <span>{{ selectedModelLabel || "选择模型" }}</span>
                        <el-icon class="quick-chat-chip__arrow">
                          <ArrowDown />
                        </el-icon>
                      </span>
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item
                            v-for="model in assistantBootstrap?.models || []"
                            :key="model.key"
                            :command="model.key"
                            :disabled="!isAssistantModelSelectable(model)"
                            :title="
                              [
                                model.description,
                                model.reason
                                  ? assistantModelReasonText(model.reason)
                                  : ''
                              ]
                                .filter(Boolean)
                                .join(' · ')
                            "
                          >
                            <span class="quick-model-option">
                              <span>{{ model.label }}</span>
                              <span
                                v-if="
                                  model.status && model.status !== 'available'
                                "
                                class="quick-model-option__status"
                              >
                                {{ modelStatusText(model.status) }}
                              </span>
                            </span>
                          </el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>

                    <button
                      type="button"
                      class="quick-chat-icon-button quick-chat-voice-button"
                      :class="{ 'is-listening': quickVoiceListening }"
                      :disabled="!quickVoiceSupported"
                      :title="
                        !quickVoiceSupported
                          ? '当前环境不支持系统语音输入'
                          : quickVoiceListening
                            ? '停止语音输入'
                            : '语音输入'
                      "
                      @click="handleQuickVoiceInput"
                    >
                      <el-icon><Microphone /></el-icon>
                    </button>
                    <button
                      type="button"
                      class="quick-chat-send-button"
                      :class="{
                        'is-ready':
                          quickCourse &&
                          quickMessage.trim() &&
                          selectedModelReady
                      }"
                      :disabled="
                        !quickCourse ||
                        !quickMessage.trim() ||
                        !selectedModelReady
                      "
                      :title="
                        !selectedModelReady
                          ? selectedModelDisabledReason || '当前没有可用模型'
                          : '发送'
                      "
                      @click="
                        quickCourse
                          ? handleNewChat({ course: quickCourse })
                          : null
                      "
                    >
                      <svg
                        class="quick-chat-send-icon"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d="M12 19V5" />
                        <path d="M5.5 11.5 12 5l6.5 6.5" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 【场景 B】 Agent PDF 工作台 -->
          <div
            v-else-if="activeRail === `agentpdf`"
            class="h-full w-full min-w-0 overflow-hidden"
          >
            <div class="agent-pdf-shell h-full w-full min-w-0 overflow-hidden">
              <AgentPdfWorkbench :service-url="pdfServiceUrl" />
            </div>
          </div>

          <div
            v-else-if="activeRail === `generation`"
            class="h-full w-full min-w-0 overflow-hidden"
          >
            <div
              v-if="isStaffMode"
              class="h-full w-full min-w-0 bg-transparent overflow-hidden"
            >
              <el-tabs
                v-model="resourceWorkspaceMode"
                class="resource-workspace-tabs h-full flex flex-col"
              >
                <el-tab-pane
                  label="AI 生成资源"
                  name="generated"
                  class="h-full"
                >
                  <div
                    v-if="!selectedStudentId"
                    class="h-full w-full min-w-0 flex items-center justify-center bg-transparent"
                  >
                    <AiAppEmptyState
                      title="请选择学生"
                      description="选择学生后可查看资源生成任务和学习资源。"
                      :icon="User"
                    />
                  </div>
                  <AiResourceGeneration
                    v-else
                    :course-id="selectedCourseId"
                    :course-name="selectedCourseName"
                    :target-student-id="selectedStudentContextId"
                    :requires-target-student="isStaffMode"
                    :resource-types="assistantBootstrap?.resource_types || []"
                  />
                </el-tab-pane>
              </el-tabs>
            </div>
            <AiStudentResourceLibrary v-else :course-id="selectedCourseId" />
          </div>

          <div
            v-else-if="activeRail === `path`"
            class="h-full w-full min-w-0 overflow-hidden"
          >
            <div
              v-if="isStaffMode && !selectedStudentId"
              class="h-full w-full min-w-0 flex items-center justify-center bg-transparent"
            >
              <AiAppEmptyState
                title="请选择学生"
                description="选择学生后可查看个性化学习路径。"
                :icon="Guide"
              />
            </div>
            <div
              v-else
              class="h-full w-full min-w-0 bg-transparent overflow-hidden"
            >
              <AiLearningPath
                :course-id="selectedCourseId"
                :target-student-id="selectedStudentContextId"
                :requires-target-student="isStaffMode"
              />
            </div>
          </div>

          <div
            v-else-if="activeRail === `profile`"
            class="h-full w-full min-w-0 overflow-hidden bg-transparent"
          >
            <div
              v-if="isStaffMode && !selectedStudentId"
              class="h-full w-full min-w-0 flex items-center justify-center"
            >
              <AiAppEmptyState
                title="请选择学生"
                description="选择学生后可查看画像、知识掌握和风险标签。"
                :icon="User"
              />
            </div>
            <div
              v-else
              class="ai-profile-workspace h-full w-full min-w-0 min-h-0 flex gap-4 overflow-hidden"
            >
              <div
                class="ai-profile-main flex-1 min-w-0 h-full min-h-0 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <AiLearningProfile
                  :course-id="selectedCourseId"
                  :target-student-id="selectedStudentContextId"
                  :requires-target-student="isStaffMode"
                  :enrolled-courses="myCourses"
                  @profile-loaded="handleProfileLoaded"
                />
              </div>
              <div
                class="ai-profile-inspector w-[440px] flex-shrink-0 h-full min-h-0 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <AiInspector
                  :profileDimensions="profileDimensions"
                  :agentItems="agentItems"
                  :resources="inspectorResources"
                />
              </div>
            </div>
          </div>

          <div
            v-else-if="activeRail === `assessment`"
            class="h-full w-full min-w-0 overflow-hidden"
          >
            <div
              v-if="isStaffMode && !selectedStudentId"
              class="h-full w-full min-w-0 flex items-center justify-center bg-transparent"
            >
              <AiAppEmptyState
                title="请选择学生"
                description="选择学生后可查看阶段评估、证据链和优化动作。"
                :icon="DataAnalysis"
              />
            </div>
            <div
              v-else
              class="h-full w-full min-w-0 bg-transparent overflow-hidden"
            >
              <AiAssessment
                :course-id="selectedCourseId"
                :target-student-id="selectedStudentContextId"
                :requires-target-student="isStaffMode"
              />
            </div>
          </div>

          <div
            v-else-if="activeRail === `governance`"
            class="h-full w-full min-w-0 overflow-hidden"
          >
            <div class="governance-shell h-full w-full min-w-0 overflow-hidden">
              <AiGovernanceDashboard
                :course-id="selectedCourseId"
                :course-name="selectedCourseName"
                :is-staff-mode="isStaffMode"
                :viewer-role="apiMode"
                @select-student="handleGovernanceSelectStudent"
                @navigate="handleGovernanceNavigate"
              />
            </div>
          </div>

          <!-- 【场景 C】 常规任务 -->
          <div
            v-else-if="activeRail === `automation`"
            class="ai-automation-view h-full w-full min-w-0 overflow-hidden flex items-center justify-center bg-white p-4"
          >
            <div
              class="ai-automation-empty-shell h-full w-full min-w-0 flex items-center justify-center"
            >
              <AiAppEmptyState
                title="常规任务暂未接入"
                description="当前后端尚未提供常规任务的配置、启停与执行记录接口。"
                :icon="Clock"
              />
            </div>
          </div>

          <!-- 【场景 D】 其他未开发项 -->
          <div
            v-else
            class="h-full w-full min-w-0 flex items-center justify-center p-4"
          >
            <div class="h-full w-full min-w-0 flex items-center justify-center">
              <AiAppEmptyState
                title="模块建设中"
                :description="`「${railItems.find(r => r.key === activeRail)?.label || '当前模块'}」暂未开放。`"
                :icon="Box"
              />
            </div>
          </div>
        </main>
      </div>
    </div>

    <FloatingDigitalHuman2D
      ref="floatingHumanRef"
      :role-label="currentUserRoleLabel"
      :course-name="selectedCourseName"
      :state="digitalHumanState"
      anchor="appLeftBottom"
      anchor-selector=".ai-app-root"
      :left-zone-width="sidebarRenderedWidth"
      :bottom-offset="floatingHumanBottomOffset"
      :storage-key="floatingHumanStorageKey"
      avoid-selector=".ai-mobile-composer-surface, .nav-mobile-container"
      :layout-key="`${activeRail}-${selectedCourseId || 'none'}-${quickAttachments.length}`"
    />

    <PlatformResourcePreviewDialog
      v-model="platformPreviewVisible"
      :resource="platformPreviewResource"
    />

    <!-- 栈操作可视化预览弹窗 -->
    <el-dialog
      v-model="stackPreviewVisible"
      title="栈 (Stack) 操作可视化"
      width="min(640px, calc(100vw - 24px))"
      align-center
      destroy-on-close
    >
      <div class="stack-preview-content flex gap-6">
        <!-- 栈可视化区 -->
        <div
          class="stack-preview-visual relative w-44 h-72 mx-auto bg-gray-50 rounded-2xl border border-dashed border-blue-200 flex flex-col-reverse items-center p-3 gap-2 overflow-hidden"
        >
          <div
            class="absolute top-2 left-3 text-[11px] font-bold text-blue-500"
          >
            栈顶 (top) ↑
          </div>
          <div
            class="absolute bottom-2 right-3 text-[11px] font-bold text-gray-500"
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
              class="w-28 h-9 rounded-lg bg-blue-500 text-white font-bold flex items-center justify-center shadow-sm"
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
        <div class="stack-preview-actions flex-1 flex flex-col gap-3">
          <div class="stack-preview-controls flex flex-wrap gap-2">
            <el-button type="primary" @click="stackPush">push 压栈</el-button>
            <el-button type="danger" @click="stackPop">pop 出栈</el-button>
            <el-button type="warning" @click="stackPeek">peek 栈顶</el-button>
            <el-button @click="stackReset">重置</el-button>
          </div>
          <div class="text-xs text-gray-500">
            栈大小：<b class="text-blue-600">{{ stackItems.length }}</b> ｜
            栈顶元素：<b class="text-blue-600">{{
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
  transition:
    opacity 0.18s ease-out,
    transform 0.22s ease-out;
}
.stack-anim-enter-from {
  opacity: 0;
  transform: translateY(-16px) scale(0.96);
}
.stack-anim-leave-to {
  opacity: 0;
  transform: translateY(-16px) scale(0.96);
}
</style>

<style scoped lang="scss">
.ai-app-root {
  --el-color-primary: #2f6fcb;
  --ai-app-shell-bg: #f3f6fa;
  --ai-app-panel-bg: rgb(255 255 255 / 84%);
  --ai-app-panel-border: #d8e1ec;
  --ai-app-panel-shadow:
    0 12px 30px rgb(51 65 85 / 8%), inset 0 1px 0 rgb(255 255 255 / 88%);
  --ai-app-font:
    "Inter", "NotionInter", -apple-system, BlinkMacSystemFont, "Segoe UI",
    "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Helvetica, Arial,
    sans-serif;

  font-family: var(--ai-app-font);
  font-synthesis-weight: none;
  color: #1f2937;
  background: var(--ai-app-shell-bg);
  -webkit-font-smoothing: antialiased;
  box-sizing: border-box;
  height: var(--qiming-native-vh, 100dvh);
  width: auto;
  min-width: 0;
  max-width: 100%;
  padding-top: var(--pure-safe-area-top, 0);
  padding-bottom: var(--pure-safe-area-bottom, 0);
  position: relative;
  text-rendering: optimizeLegibility;
}

.ai-app-root *,
.ai-app-root *::before,
.ai-app-root *::after {
  box-sizing: border-box;
}

.ai-app-content {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

.ai-course-drawer-header,
.ai-course-drawer-scrim,
.ai-mobile-app-bar {
  display: none;
}

.resource-workspace-tabs {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  padding: 0 20px 20px;
  overflow: hidden;
}

.resource-workspace-tabs :deep(.el-tabs__header),
.resource-workspace-tabs :deep(.el-tabs__content),
.resource-workspace-tabs :deep(.el-tab-pane) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

.resource-workspace-tabs :deep(.el-tabs__content),
.resource-workspace-tabs :deep(.el-tab-pane) {
  overflow: hidden;
}

.ai-workbench-panel {
  background: var(--ai-app-panel-bg);
  border: 1px solid var(--ai-app-panel-border);
  border-radius: 24px;
  box-shadow: var(--ai-app-panel-shadow);
  backdrop-filter: blur(16px) saturate(120%);
  -webkit-backdrop-filter: blur(16px) saturate(120%);
}

.ai-app-left-rail {
  background: rgb(255 255 255 / 86%);
  border: 1px solid var(--ai-app-panel-border);
  border-radius: 24px;
  box-shadow: 0 10px 26px rgb(51 65 85 / 7%);
  backdrop-filter: blur(16px) saturate(120%);
  -webkit-backdrop-filter: blur(16px) saturate(120%);
  transition: width 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}

.ai-app-left-rail.is-resizing {
  transition: none;
  will-change: width;
}

.ai-app-left-rail__resize-handle {
  position: absolute;
  top: 42px;
  right: -6px;
  bottom: 12px;
  z-index: 25;
  display: flex;
  width: 12px;
  padding: 0;
  touch-action: none;
  cursor: col-resize;
  background: transparent;
  border: 0;
  outline: none;
}

.ai-app-left-rail__resize-handle::before {
  position: absolute;
  inset-block: 0;
  left: 50%;
  width: 1px;
  content: "";
  background: transparent;
  transform: translateX(-50%);
  transition: background-color 0.16s ease-out;
}

.ai-app-left-rail__resize-handle span {
  width: 3px;
  height: 40px;
  margin: auto;
  background: #aeb9c8;
  border-radius: 3px;
  opacity: 0.34;
  transition:
    opacity 0.16s ease-out,
    background-color 0.16s ease-out;
}

.ai-app-left-rail__resize-handle:hover::before,
.ai-app-left-rail__resize-handle:focus-visible::before,
.ai-app-left-rail.is-resizing .ai-app-left-rail__resize-handle::before {
  background: rgb(47 111 203 / 36%);
}

.ai-app-left-rail__resize-handle:hover span,
.ai-app-left-rail__resize-handle:focus-visible span,
.ai-app-left-rail.is-resizing .ai-app-left-rail__resize-handle span {
  background: var(--el-color-primary);
  opacity: 0.9;
}

:global(html.ai-app-sidebar-resizing),
:global(html.ai-app-sidebar-resizing *) {
  cursor: col-resize !important;
  user-select: none !important;
}

@media (prefers-reduced-motion: reduce) {
  .ai-app-left-rail,
  .ai-app-left-rail__resize-handle::before,
  .ai-app-left-rail__resize-handle span {
    transition: none;
  }
}

.ai-chat-workbench {
  position: relative;
  display: block;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  padding: 0 436px 0 12px;
  overflow: clip;
}

.ai-chat-dialog-panel {
  min-width: 0;
  width: 100%;
  height: 100%;
}

.ai-human-column {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 420px;
  min-width: 0;
  max-width: none;
}

.ai-human-column.is-collapsed {
  right: 0;
  width: 64px;
  min-width: 64px;
  max-width: 64px;
}

.ai-app-root :deep(*) {
  font-family: var(--ai-app-font);
}

.ai-app-root :deep(.iconfont),
.ai-app-root :deep([class^="el-icon-"]),
.ai-app-root :deep([class*=" el-icon-"]),
.ai-app-root :deep(.iconify) {
  font-family:
    "iconfont", element-icons, "IconifyIconOnline", "IconifyIconOffline",
    sans-serif !important;
}

.agent-pdf-shell {
  background: transparent;
  border-radius: 24px;
}

.governance-shell {
  background: transparent;
  border-radius: 8px;
}

:deep(.course-select .el-select__wrapper) {
  border-radius: 8px;
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
  transition:
    opacity 0.2s ease-out,
    transform 0.22s ease-out;
}
.panel-slide-enter-from {
  opacity: 0;
  transform: translateX(-12px);
}

.panel-reveal-enter-active {
  transition:
    opacity 0.2s ease-out,
    transform 0.22s ease-out;
}
.panel-reveal-enter-from {
  opacity: 0;
  transform: translateX(12px);
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

.quick-chat-card {
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--ai-app-panel-border);
  border-radius: 24px;
  box-shadow: var(--ai-app-panel-shadow);
  transition:
    border-color 0.25s ease,
    box-shadow 0.25s ease;
}

.quick-chat-card:focus-within {
  border-color: rgb(47 111 203 / 38%);
  box-shadow: 0 0 0 3px rgb(47 111 203 / 10%);
}

.quick-chat-file-input {
  display: none;
}

.quick-attachment-shelf {
  display: flex;
  gap: 12px;
  padding: 18px 18px 0;
  overflow-x: auto;
  overscroll-behavior-x: contain;
}

.quick-attachment-shelf::-webkit-scrollbar {
  height: 4px;
}

.quick-attachment-shelf::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.28);
  border-radius: 999px;
}

.quick-attachment-card {
  position: relative;
  display: flex;
  flex: 0 0 156px;
  flex-direction: column;
  gap: 9px;
  min-height: 128px;
  padding: 10px;
  overflow: hidden;
  background: rgba(243, 246, 251, 0.92);
  border: 1px solid rgba(226, 232, 240, 0.88);
  border-radius: 19px;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.quick-attachment-card:hover {
  background: #fff;
  border-color: rgba(203, 213, 225, 0.95);
  box-shadow: 0 12px 28px rgba(48, 64, 93, 0.12);
  transform: translateY(-1px);
}

.quick-attachment-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 72px;
  overflow: hidden;
  color: #6b7280;
  font-size: 21px;
  font-weight: 750;
  letter-spacing: 0.01em;
  background: linear-gradient(135deg, #fff, #eef2f7);
  border: 1px solid rgba(226, 232, 240, 0.82);
  border-radius: 15px;
}

.quick-attachment-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.quick-attachment-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.quick-attachment-name,
.quick-attachment-meta {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-attachment-name {
  color: #475467;
  font-size: 13px;
  font-weight: 700;
}

.quick-attachment-meta {
  color: #98a2b3;
  font-size: 11px;
  font-weight: 600;
}

.quick-attachment-remove {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: #fff;
  pointer-events: none;
  background: rgba(15, 23, 42, 0.76);
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 999px;
  opacity: 0;
  transition:
    opacity 0.18s ease,
    transform 0.18s ease,
    background 0.18s ease;
  transform: scale(0.86);
}

.quick-attachment-card:hover .quick-attachment-remove {
  pointer-events: auto;
  opacity: 1;
  transform: scale(1);
}

.quick-attachment-card:focus-within .quick-attachment-remove,
.quick-attachment-remove:focus-visible {
  pointer-events: auto;
  opacity: 1;
  transform: scale(1);
}

.quick-attachment-remove:focus-visible {
  outline: 2px solid #1570ef;
  outline-offset: 2px;
}

.quick-attachment-remove:hover {
  background: rgba(220, 38, 38, 0.9);
}

.quick-chat-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 16px;
  background: rgba(248, 250, 252, 0.78);
  border-top: 1px solid rgba(241, 245, 249, 0.95);
}

.quick-chat-tools-left,
.quick-chat-tools-right {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.quick-chat-tools-left {
  flex-wrap: wrap;
}

.quick-chat-tools-right {
  flex-shrink: 0;
  justify-content: flex-end;
}

.quick-chat-chip {
  display: inline-flex;
  align-items: center;
  max-width: 250px;
  height: 38px;
  padding: 0 14px;
  color: #4b5565;
  white-space: nowrap;
  background: #f1f3f7;
  border: 1px solid transparent;
  border-radius: 16px;
  box-shadow: 0 0 0 rgba(56, 67, 95, 0);
  transition:
    color 0.2s ease,
    background 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.quick-chat-chip--interactive {
  cursor: pointer;
}

.quick-chat-chip--interactive:hover {
  color: #334155;
  background: #eef1f6;
  border-color: rgba(213, 219, 230, 0.95);
  box-shadow: 0 8px 18px rgba(56, 67, 95, 0.08);
  transform: translateY(-1px);
}

.quick-chat-chip--interactive.is-selected {
  color: #4f69d9;
  background: rgba(94, 127, 248, 0.12);
}

.quick-chat-chip--static {
  cursor: default;
}

.quick-chat-chip__icon {
  flex: 0 0 auto;
  margin-right: 8px;
  font-size: 15px;
}

.quick-chat-chip__text {
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  text-overflow: ellipsis;
}

.quick-chat-chip__arrow {
  flex: 0 0 auto;
  margin-left: 7px;
  font-size: 13px;
  color: currentColor;
  opacity: 0.72;
}

.quick-chat-model-trigger {
  display: inline-flex;
  align-items: center;
  max-width: 240px;
  height: 36px;
  padding: 0 8px 0 12px;
  color: #9099aa;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  border-radius: 14px;
  transition:
    color 0.2s ease,
    background 0.2s ease;
}

.quick-chat-model-trigger span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.quick-chat-model-trigger:hover {
  color: #667085;
  background: rgba(241, 243, 247, 0.86);
}

.quick-model-option {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  width: 100%;
  gap: 8px;
}

.quick-model-option > span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-model-option__status {
  flex: 0 0 auto;
  padding: 2px 6px;
  color: #7a4c00;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  background: #fff4d6;
  border-radius: 999px;
}

.quick-chat-icon-button,
.quick-chat-send-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 17px;
  transition:
    color 0.2s ease,
    background 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.quick-chat-icon-button {
  color: #667085;
  background: transparent;
  border: 1px solid transparent;
}

.quick-chat-icon-button:hover {
  color: #344054;
  background: #f1f3f7;
  border-color: rgba(213, 219, 230, 0.95);
}

.quick-chat-icon-button:disabled {
  color: #98a2b3;
  cursor: not-allowed;
  background: transparent;
  border-color: transparent;
  opacity: 0.55;
}

.quick-chat-upload-button {
  flex: 0 0 auto;
  background: #fff;
  border-color: rgba(223, 228, 236, 0.9);
}

.quick-chat-upload-plus {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-size: 31px;
  font-weight: 300;
  line-height: 1;
  transform: translateY(-1px);
}

.quick-chat-voice-button.is-listening {
  color: var(--el-color-primary);
  background: rgba(94, 127, 248, 0.12);
  box-shadow: 0 0 0 4px rgba(94, 127, 248, 0.12);
}

.quick-chat-send-button {
  color: #98a2b3;
  cursor: not-allowed;
  background: #fff;
  border: 1px solid #dfe4ec;
}

.quick-chat-send-button.is-ready {
  color: #fff;
  cursor: pointer;
  background: var(--el-color-primary);
  border-color: var(--el-color-primary);
  box-shadow: 0 10px 22px rgba(94, 127, 248, 0.24);
}

.quick-chat-send-button.is-ready:hover {
  box-shadow: 0 14px 28px rgba(94, 127, 248, 0.3);
  transform: translateY(-1px);
}

.quick-chat-send-button:active,
.quick-chat-icon-button:active,
.quick-chat-chip--interactive:active {
  transform: translateY(0) scale(0.98);
}

.quick-chat-send-icon {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.1;
}

:global(.quick-chat-dropdown.el-popper) {
  overflow: visible !important;
  background: #fff !important;
  border: 1px solid rgba(216, 225, 240, 0.95) !important;
  border-radius: 18px !important;
  box-shadow: 0 18px 42px rgba(48, 64, 93, 0.14) !important;
}

:global(.quick-chat-dropdown .el-dropdown-menu) {
  min-width: 220px !important;
  padding: 8px !important;
  overflow: hidden;
  background: #fff !important;
  border-radius: 18px !important;
  box-shadow: none !important;
}

:global(.quick-chat-dropdown .el-dropdown-menu__item) {
  height: 40px !important;
  padding: 0 14px !important;
  margin: 2px 0;
  color: #4f5c6f !important;
  font-size: 14px !important;
  font-weight: 500 !important;
  line-height: 40px !important;
  border-radius: 12px !important;
  transition:
    color 0.18s ease,
    background 0.18s ease;
}

:global(.quick-chat-dropdown .el-dropdown-menu__item:not(.is-disabled):hover),
:global(.quick-chat-dropdown .el-dropdown-menu__item:not(.is-disabled):focus) {
  color: var(--el-color-primary) !important;
  background: rgba(94, 127, 248, 0.1) !important;
}

:global(.quick-chat-dropdown .el-popper__arrow::before) {
  background: #fff !important;
  border-color: rgba(216, 225, 240, 0.95) !important;
  border-radius: 3px;
}

@media (max-width: 1440px) {
  .ai-chat-workbench {
    padding-right: 376px;
  }

  .ai-human-column {
    right: 0;
    width: 360px;
  }
}

@media (max-width: 1280px) {
  .ai-chat-workbench {
    padding-right: 16px;
  }

  .ai-human-column {
    display: none;
  }
}

@media (max-width: 1180px) {
  .ai-chat-workbench {
    padding: 10px 14px 10px 10px;
  }
}

@media (hover: none), (pointer: coarse) {
  .quick-attachment-remove {
    top: 4px;
    right: 4px;
    width: 44px;
    height: 44px;
    color: #b42318;
    pointer-events: auto;
    touch-action: manipulation;
    background: rgb(255 255 255 / 96%);
    border-color: rgb(254 202 202 / 96%);
    box-shadow: 0 4px 12px rgb(15 23 42 / 14%);
    opacity: 1;
    transform: scale(1);
  }

  .quick-attachment-remove:hover,
  .quick-attachment-remove:focus-visible {
    color: #fff;
    background: #d92d20;
  }
}

@media (max-width: 768px) {
  .ai-app-root {
    width: 100%;
    min-width: 0;
    height: var(--qiming-native-vh, 100dvh);
    min-height: var(--qiming-native-vh, 100dvh);
    overflow: hidden;
  }

  .ai-app-root > .flex-1 {
    position: relative;
    width: 100%;
    min-width: 0;
  }

  .ai-app-main-column {
    width: 100%;
    min-width: 0;
  }

  .ai-mobile-app-bar {
    display: grid;
    flex: 0 0 auto;
    grid-template-columns: 44px minmax(0, 1fr) 44px;
    gap: 8px;
    align-items: center;
    min-height: 54px;
    padding: 5px 10px;
    background: #fff;
    border-bottom: 1px solid #e5eaf1;
  }

  .ai-mobile-app-bar > button,
  .ai-course-drawer-header > button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    color: #42526a;
    touch-action: manipulation;
    background: transparent;
    border: 0;
    border-radius: 10px;
  }

  .ai-mobile-app-bar > button:active,
  .ai-course-drawer-header > button:active {
    background: #edf3fb;
    transform: scale(0.98);
  }

  .ai-mobile-app-bar__title {
    display: flex;
    flex-direction: column;
    min-width: 0;
    text-align: center;
  }

  .ai-mobile-app-bar__title strong,
  .ai-mobile-app-bar__title span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ai-mobile-app-bar__title strong {
    color: #243247;
    font-size: 15px;
    font-weight: 700;
    line-height: 1.25;
  }

  .ai-mobile-app-bar__title span {
    margin-top: 2px;
    color: #748198;
    font-size: 11px;
    line-height: 1.2;
  }

  .ai-welcome-center {
    align-items: stretch !important;
    justify-content: stretch !important;
    padding: 12px 8px 8px !important;
    overflow-x: hidden;
    overflow-y: hidden;
  }

  .ai-welcome-content {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    height: 100%;
    min-height: 0;
    margin: 0 auto;
    padding-right: 8px !important;
    padding-left: 8px !important;
    transform: none !important;
  }

  .ai-welcome-heading {
    align-self: center;
    padding-bottom: 24px;
    margin: 0;
  }

  .ai-welcome-content h1 {
    font-size: 24px !important;
    line-height: 1.2;
  }

  .ai-welcome-content p {
    font-size: 13px !important;
    line-height: 1.55;
  }

  .ai-welcome-content .quick-chat-card {
    flex: 0 0 auto;
    margin-top: 0 !important;
    border-radius: 18px;
    box-shadow: 0 12px 30px rgb(41 62 91 / 10%);
  }

  .ai-course-context-bar {
    align-items: stretch;
    justify-content: flex-start;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 8px;
    padding: 12px;
    overflow: visible;
  }

  .ai-app-root.is-chat .ai-course-context-bar {
    display: grid !important;
    flex: 0 0 auto;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 8px 10px;
    align-items: center;
    justify-content: stretch;
    margin: 0 8px 8px;
    margin-bottom: 8px;
    padding: 8px 10px;
    overflow: visible;
    border-radius: 12px;
  }

  .ai-app-root.is-chat .ai-course-context-bar > span {
    margin: 0 !important;
    color: #58667a !important;
    font-size: 12px !important;
    white-space: nowrap;
  }

  .ai-course-context-bar :deep(.el-select) {
    width: 100% !important;
    max-width: 100%;
  }

  .ai-course-context-bar :deep(.el-select__wrapper) {
    min-height: 44px;
  }

  .ai-profile-workspace {
    flex-direction: column;
    gap: 12px;
    padding: 0 0 8px;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior-y: contain;
  }

  .ai-profile-main {
    flex: 0 0 auto;
    width: 100%;
    height: auto !important;
    min-height: 0;
    overflow: visible;
    border-radius: 12px;
  }

  .ai-profile-main .profile-page {
    height: auto !important;
    min-height: 0;
    overflow: visible;
  }

  .ai-profile-inspector {
    flex: 0 0 auto;
    width: 100% !important;
    height: clamp(420px, 64dvh, 620px) !important;
    min-height: 420px;
    border-radius: 12px;
  }

  .ai-automation-view {
    align-items: flex-start;
    padding: 12px 8px !important;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior-y: contain;
  }

  .ai-automation-empty-shell {
    align-items: flex-start;
    height: auto !important;
    padding-top: 8px;
  }

  .ai-automation-workspace {
    flex-direction: column;
    gap: 12px;
    height: auto !important;
    min-height: 100%;
    padding: 4px 0 12px;
  }

  .ai-automation-list {
    flex: 0 0 auto;
    width: 100% !important;
    height: auto !important;
    padding: 0;
    overflow: visible;
  }

  .ai-automation-workspace.is-task-selected .ai-automation-list {
    min-height: 320px;
    max-height: 48dvh;
    padding-right: 4px;
    overflow-y: auto;
  }

  .ai-automation-task-card {
    gap: 8px;
    padding: 16px;
  }

  .ai-automation-task-icon {
    width: 44px;
    height: 44px;
  }

  .ai-automation-task-actions {
    min-width: 44px;
    padding-left: 0;
  }

  .ai-automation-record-button {
    min-width: 44px;
    min-height: 44px;
    padding-inline: 4px;
    opacity: 1 !important;
  }

  .ai-automation-history {
    flex: 0 0 auto;
    width: 100%;
    height: min(560px, 68dvh) !important;
    min-height: 360px;
    border-radius: 16px;
  }

  .stack-preview-content {
    align-items: stretch;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }

  .stack-preview-visual {
    flex: 0 0 auto;
    width: min(176px, 100%);
  }

  .stack-preview-actions {
    width: 100%;
    min-width: 0;
  }

  .stack-preview-controls :deep(.el-button) {
    min-height: 44px;
    margin-left: 0;
  }

  .ai-app-left-rail {
    position: absolute !important;
    inset: 0 auto 0 0;
    z-index: 2200;
    width: min(86vw, 320px) !important;
    max-width: calc(100vw - 44px);
    min-width: min(86vw, 320px);
    overflow: hidden;
    background: #fff;
    border: 0;
    border-right: 1px solid #dce4ee;
    border-radius: 0 16px 16px 0;
    box-shadow: 18px 0 44px rgb(30 45 70 / 18%);
    transform: translateX(0);
    visibility: visible;
    transition:
      transform 0.22s cubic-bezier(0.22, 1, 0.36, 1),
      visibility 0.22s step-start;
  }

  .ai-app-left-rail.is-collapsed {
    width: min(86vw, 320px) !important;
    min-width: min(86vw, 320px);
    pointer-events: none;
    transform: translateX(-105%);
    visibility: hidden;
    transition:
      transform 0.18s ease-in,
      visibility 0.18s step-end;
  }

  .ai-course-drawer-header {
    display: flex;
    flex: 0 0 60px;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px 8px 16px;
    border-bottom: 1px solid #e5eaf1;
  }

  .ai-course-drawer-header > div {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .ai-course-drawer-header strong {
    color: #243247;
    font-size: 15px;
  }

  .ai-course-drawer-header span {
    margin-top: 2px;
    color: #748198;
    font-size: 11px;
  }

  .ai-course-drawer-scrim {
    position: absolute;
    inset: 0;
    z-index: 2190;
    display: block;
    padding: 0;
    background: rgb(20 31 48 / 48%);
    border: 0;
  }

  .ai-app-left-rail__resize-handle {
    display: none;
  }

  .ai-app-left-rail > button.absolute {
    display: none !important;
  }

  .resource-workspace-tabs {
    padding: 0 12px 12px;
  }

  .ai-app-root.is-chat .ai-chat-workbench {
    gap: 0;
    padding: 8px;
  }

  .quick-chat-toolbar {
    gap: 8px;
    align-items: stretch;
    flex-direction: column;
    padding: 10px;
  }

  .quick-chat-tools-left {
    flex-wrap: nowrap;
    width: 100%;
    padding-bottom: 2px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
  }

  .quick-chat-tools-left::-webkit-scrollbar {
    display: none;
  }

  .quick-chat-chip {
    flex: 0 0 auto;
    max-width: min(220px, 72vw);
    min-height: 44px;
  }

  .quick-chat-chip--static {
    display: none;
  }

  .quick-chat-tools-right {
    justify-content: space-between;
    width: 100%;
  }

  .quick-chat-model-trigger {
    min-height: 44px;
    max-width: min(180px, 48vw);
  }

  .quick-attachment-remove {
    top: 4px;
    right: 4px;
    width: 44px;
    height: 44px;
    color: #b42318;
    pointer-events: auto;
    touch-action: manipulation;
    background: rgb(255 255 255 / 96%);
    border-color: rgb(254 202 202 / 96%);
    box-shadow: 0 4px 12px rgb(15 23 42 / 14%);
    opacity: 1;
    transform: scale(1);
  }

  .quick-attachment-remove:hover,
  .quick-attachment-remove:focus-visible {
    color: #fff;
    background: #d92d20;
  }
}

@media (max-width: 390px) {
  .ai-app-root.is-chat .ai-course-context-bar {
    gap: 6px 8px;
    margin-inline: 6px;
    padding-inline: 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ai-app-left-rail,
  .ai-course-drawer-scrim,
  .ai-mobile-app-bar > button {
    transition: none !important;
  }
}
</style>
