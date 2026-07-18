import { http } from "@/utils/http";
import { getToken, formatToken } from "@/utils/auth";
import { useUserStoreHook } from "@/store/modules/user";
import COS from "cos-js-sdk-v5";

export interface ApiResponse<T> {
  code: number;
  msg: string;
  data: T;
}

const normalizeAssistantApiResponse = <T>(
  payload: ApiResponse<T> | T
): ApiResponse<T> => {
  if (
    payload &&
    typeof payload === "object" &&
    "code" in payload &&
    "data" in payload
  ) {
    return payload as ApiResponse<T>;
  }
  return { code: 200, msg: "OK", data: payload as T };
};

const genericAxiosErrorPattern = /^Request failed with status code \d+$/;
const htmlGatewayErrorPattern = /<\/?html|<!doctype|bad gateway|openresty/i;

const extractEmbeddedAssistantError = (text: string): string | undefined => {
  const match = text.match(/returned status \d+:\s*(.+)$/);
  if (!match?.[1]) return undefined;
  try {
    return normalizeAssistantErrorText(JSON.parse(match[1]));
  } catch {
    return undefined;
  }
};

const normalizeAssistantErrorText = (value: unknown): string | undefined => {
  if (Array.isArray(value)) {
    const text = value
      .map(item => normalizeAssistantErrorText(item))
      .filter(Boolean)
      .join("; ");
    return text || undefined;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const loc = Array.isArray(record.loc) ? record.loc.join(".") : "";
    const message = normalizeAssistantErrorText(
      record.msg ?? record.message ?? record.error ?? record.detail
    );
    const text = [loc, message].filter(Boolean).join(": ");
    return text || undefined;
  }
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (
    !text ||
    genericAxiosErrorPattern.test(text) ||
    htmlGatewayErrorPattern.test(text)
  ) {
    return undefined;
  }
  return extractEmbeddedAssistantError(text) || text;
};

const assistantModelReasonTextMap: Record<string, string> = {
  model_capability_service_unavailable:
    "模型能力服务暂不可用，无法确认可用模型",
  model_key_not_registered: "模型配置不存在，请重新拉取模型列表",
  model_not_available_for_feature: "该模型不支持当前功能",
  model_capability_unsupported: "该模型缺少当前功能所需能力",
  model_context_limit_exceeded: "输入内容超过模型上下文限制",
  model_not_configured: "模型凭据或 provider 未配置",
  model_health_unavailable: "模型健康检查不可用",
  deprecated_legacy_llm_config: "旧 LLM 配置兼容项，后续会迁移",
  deprecated_legacy_multimodal_chat_config: "旧多模态配置兼容项，后续会迁移",
  deprecated_legacy_html_animation_config: "旧 HTML 动画配置兼容项，后续会迁移",
  deprecated_legacy_video_curation_config: "旧视频梳理配置兼容项，后续会迁移"
};

export const assistantModelReasonText = (reason?: string) => {
  if (!reason) return "";
  return assistantModelReasonTextMap[reason] || "模型当前不可用";
};

export const assistantApiErrorMessage = (error: unknown, fallback: string) => {
  const axiosError = error as any;
  const status = Number(axiosError?.response?.status);
  if ([502, 503, 504].includes(status)) {
    return "学习助手服务暂不可用，请稍后重试或联系管理员检查 API 服务。";
  }
  const data = axiosError?.response?.data;
  const candidates = [
    assistantModelReasonText(data?.reason),
    assistantModelReasonText(data?.error?.code),
    assistantModelReasonText(data?.data?.reason),
    assistantModelReasonText(data?.data?.error?.code),
    data?.msg,
    data?.message,
    data?.error,
    data?.detail,
    data?.data?.msg,
    data?.data?.message,
    data?.data?.error,
    data?.data?.detail,
    typeof data === "string" ? data : undefined,
    axiosError?.message
  ];
  return (
    candidates.map(item => normalizeAssistantErrorText(item)).find(Boolean) ||
    fallback
  );
};

export interface AssistantBootstrapCourse {
  course_id: number;
  course_name: string;
  subtitle?: string;
  thumb_url?: string;
}

export interface AssistantBootstrapStudent {
  student_id: number;
  student_name: string;
  avatar?: string;
}

export type AssistantInteractionScope =
  | "personal_learning"
  | "course_general"
  | "student_analysis";

export type AssistantConversationScope =
  | AssistantInteractionScope
  | "legacy_unknown";

export type AssistantVisibilityScope =
  | "student_private"
  | "staff_private"
  | "legacy_inherited";

interface AssistantAttachmentStsCredentials {
  tmp_secret_id?: string;
  tmp_secret_key?: string;
  security_token?: string;
  session_token?: string;
  tmpSecretId?: string;
  tmpSecretKey?: string;
  securityToken?: string;
  sessionToken?: string;
  region?: string;
  bucket?: string;
  upload_host?: string;
  upload_url?: string;
}

export interface AssistantDocumentAttachmentStsInitReq {
  scene?: string;
  course_id?: number;
  conversation_id?: string;
  file_name: string;
  content_type: string;
  file_size: number;
}

export interface AssistantDocumentAttachmentStsInitResp {
  attachment_id: string;
  upload_token: string;
  object_key: string;
  upload_url?: string;
  credentials?: AssistantAttachmentStsCredentials;
  expired_time?: number;
}

export interface AssistantDocumentAttachmentCompleteReq {
  upload_token: string;
  sha256?: string;
}

export interface AssistantChatAttachmentStatus {
  attachment_id: string;
  attachment_type?: string;
  file_name?: string;
  url?: string;
  mime_type?: string;
  file_size?: number;
  status?: string;
  parse_status?: "pending" | "processing" | "ready" | "failed" | string;
  parse_error?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AssistantOption {
  key: string;
  label: string;
  description?: string;
  status?: "available" | "unavailable" | "degraded" | "deprecated" | string;
  capabilities?: string[];
  default_for?: string[];
  limits?: Record<string, number>;
  reason?: string;
  kind?: string;
  strategy?: Record<string, string | number | boolean>;
  output_formats?: string[];
  incomplete_statuses?: string[];
}

export interface AssistantSkill extends AssistantOption {
  default_on: boolean;
}

export interface AssistantBootstrapResp {
  role: string;
  mode: string;
  interaction_scope?: AssistantInteractionScope;
  default_interaction_scope?: AssistantInteractionScope;
  supported_interaction_scopes?: AssistantInteractionScope[];
  selected_course_id?: number;
  selected_student_id?: number;
  courses: AssistantBootstrapCourse[];
  students: AssistantBootstrapStudent[];
  agents: AssistantOption[];
  skills: AssistantSkill[];
  models: AssistantOption[];
  thinking_modes: AssistantOption[];
  resource_types?: AssistantOption[];
  schema_version?: string;
  warnings?: string[];
  profile_summary?: {
    status: string;
    dimension_count: number;
    last_updated_at?: string;
    summary?: string;
    evidence_available: boolean;
  };
  path_summary?: {
    status: string;
    current_phase?: string;
    completed_nodes: number;
    total_nodes: number;
    last_generated_at?: string;
  };
  conversation_summary?: {
    conversation_id?: string;
    title?: string;
    last_message_at?: string;
    message_count: number;
  };
  feature_flags?: Record<string, boolean>;
  speech?: AssistantSpeechCapabilities | null;
  message?: string;
}

export type SpeechTimelineRequest = "none" | "word" | "viseme";
export type SpeechDelivery = "archive" | "realtime" | "auto";
export type AssistantExplanationImageMode = "off" | "auto" | "auto_wide";

export interface AssistantSpeechRequest {
  enabled: boolean;
  delivery?: SpeechDelivery;
  stream_id?: string;
  voice_alias?: string;
  timeline?: SpeechTimelineRequest;
  motion_cues?: boolean;
}

export interface AssistantSpeechCapabilities {
  contract_version: string;
  enabled: boolean;
  default_voice_alias?: string;
  voices: Array<{ alias: string; label: string }>;
  audio_formats: string[];
  sample_rates_hz: number[];
  timeline_kinds: string[];
  motion_cues: boolean;
  delivery_modes?: string[];
  realtime?: {
    enabled: boolean;
    contract_version: string;
    reservation_endpoint: string;
    codec: string;
    sample_rate_hz: number;
    channels: number;
    frame_duration_ms: number;
    recommended_jitter_buffer_ms: number;
    pipeline_mode?: "terminal" | "incremental_rules" | string;
    text_tts_parallel?: boolean;
    command_protocol?: string;
    timeline_clock?: string;
    recovery_enabled?: boolean;
    durable_archive_enabled?: boolean;
    reason?: string;
  };
  archive?: {
    enabled: boolean;
    formats: string[];
  };
  reason?: string;
}

export interface AssistantSpeechStreamReservationRequest {
  conversation_id?: string;
  course_id?: number;
  target_student_id?: number;
  interaction_scope?: AssistantInteractionScope;
  voice_alias?: string;
  timeline?: SpeechTimelineRequest;
  motion_cues?: boolean;
  client: {
    contract_version: "assistant_speech_stream.v1";
    audio_formats: string[];
    audio_worklet: true;
    renderer?: string;
  };
}

export interface AssistantSpeechStreamAudio {
  codec: "pcm_s16le";
  sample_rate_hz: number;
  channels: number;
  frame_duration_ms: number;
}

export interface AssistantSpeechStreamReservationResponse {
  status: "reserved";
  stream: {
    stream_id: string;
    ws_url: string;
    ticket: string;
    ticket_expires_at: string;
    audio: AssistantSpeechStreamAudio;
    recommended_jitter_buffer_ms: number;
  };
}

export interface AssistantSpeechServerControl {
  event: string;
  event_seq: number;
  stream_id?: string;
  session_id?: string;
  message_id?: string;
  status?: string;
  phase?: string;
  provider?: string;
  dispatch?: string;
  error_code?: string;
  partial?: boolean;
  retryable?: boolean;
  audio?: AssistantSpeechStreamAudio;
  jitter_buffer_ms?: number;
  segment_seq?: number;
  char_start?: number;
  char_end?: number;
  archive_status?: string;
  terminal_event?: string;
  archive_disposition?: string;
  last_audio_seq?: number;
  audio_sample_count?: number;
  relayed_sample_count?: number;
  last_played_sample?: number;
  archive_resume_ms?: number;
  timeline?: AssistantSpeechTimeline;
}

export interface AssistantSpeechAudio {
  format: string;
  content_type: string;
  sample_rate_hz: number;
  duration_ms: number;
  size_bytes: number;
  url: string;
  url_expires_at: string;
}

export interface AssistantSpeechWordCue {
  text: string;
  start_ms: number;
  end_ms: number;
}

export interface AssistantSpeechVisemeCue {
  id: string;
  start_ms: number;
  end_ms: number;
  weight: number;
}

export interface AssistantSpeechMotionCue {
  key: string;
  start_ms: number;
  duration_ms: number;
  target_ref?: string;
}

export interface AssistantSpeechTimeline {
  version: string;
  source: string;
  status: string;
  duration_ms: number;
  words?: AssistantSpeechWordCue[] | null;
  visemes?: AssistantSpeechVisemeCue[] | null;
  degraded_reasons?: string[] | null;
}

export interface AssistantSpeechSession {
  contract_version: string;
  session_id?: string;
  message_id?: string;
  stream_id?: string;
  delivery?: string;
  status: string;
  live_delivery_status?: string;
  archive_status?: string;
  archive_failure_stage?: string;
  archive_retry_after?: string;
  archive_retain_until?: string;
  archive_redrive_count?: number;
  terminal_event?: string;
  archive_disposition?: string;
  last_audio_seq?: number;
  audio_sample_count?: number;
  relayed_sample_count?: number;
  last_played_sample?: number;
  archive_resume_ms?: number;
  poll_after_ms?: number;
  voice_alias?: string;
  timeline_requested?: string;
  motion_cues_requested?: boolean;
  retryable?: boolean;
  error_code?: string;
  audio?: AssistantSpeechAudio | null;
  timeline?: AssistantSpeechTimeline | null;
  motion_cues?: AssistantSpeechMotionCue[] | null;
  created_at?: string;
  updated_at?: string;
  expires_at?: string;
}

export interface AssistantSpeechSessionResponse {
  status: string;
  message?: string;
  speech: AssistantSpeechSession;
}

export interface AssistantSpeechSessionSummary {
  session_id: string;
  status: string;
  voice_alias: string;
  audio_format?: string;
  duration_ms?: number;
  timeline_status?: string;
  timeline_version?: string;
  timeline_source?: string;
  live_delivery_status?: string;
  archive_status?: string;
  archive_failure_stage?: string;
  archive_retry_after?: string;
  archive_retain_until?: string;
  archive_redrive_count?: number;
  terminal_event?: string;
  archive_resume_ms?: number;
  retryable?: boolean;
  error_code?: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

export interface AssistantSpeechAPIError {
  status: "error";
  code: number | string;
  message: string;
}

export interface AssistantChatStreamReq {
  conversation_id?: string;
  course_id?: number;
  chapter_id?: number;
  target_student_id?: number;
  interaction_scope?: AssistantInteractionScope;
  mode?: string;
  selected_agent?: string;
  skill_keys?: string[];
  selected_model?: string;
  thinking_mode?: string;
  message: string;
  attachment_ids?: string[];
  enable_realtime_resource?: boolean;
  preferred_explanation_mode?: string;
  explanation_image_mode?: AssistantExplanationImageMode;
  current_path_node_id?: string;
  metadata?: Record<string, string>;
  speech?: AssistantSpeechRequest;
}

export interface AssistantChatTraceStep {
  agent: string;
  agent_key?: string;
  agent_label?: string;
  stage: string;
  resource_type?: string;
  call_id?: string;
  status: string;
  summary?: string;
  started_at?: string;
  finished_at?: string;
  duration_ms?: number;
  degraded_reason?: string;
  warning_flags?: string[];
  metadata?: Record<string, string | number | boolean>;
}

export interface AssistantChatResource {
  resource_id?: string;
  type: string;
  title: string;
  desc?: string;
  preview_url?: string;
}

export interface AssistantChatSourceRef {
  source_type: string;
  ref_id?: string;
  title: string;
  summary?: string;
  url?: string;
  confidence?: number;
  document_chunks?: {
    index: number;
    page?: number;
    text: string;
  }[];
  document_refs?: {
    title: string;
    page?: number;
    snippet?: string;
    attachment_id?: string;
  }[];
}

export interface AssistantChatVideoSegment {
  segment_id: string;
  video_id?: string;
  title: string;
  summary?: string;
  start_ms: number;
  end_ms: number;
  reason?: string;
  source_status?: string;
}

export interface AssistantChatFollowup {
  text: string;
  intent?: string;
}

export interface AssistantChatResourceTask {
  task_id: string;
  status: string;
  stage?: string;
  summary?: string;
  progress?: number;
  error_message?: string;
  health_summary?: string;
  warning_flags?: string[];
}

export type AssistantExplanationImageStatus =
  | "queued"
  | "generating"
  | "retrying"
  | "succeeded"
  | "failed"
  | "blocked"
  | "unknown_outcome"
  | "cancelled"
  | string;

export interface AssistantExplanationImage {
  image_id: string;
  status: AssistantExplanationImageStatus;
  alt_text?: string;
  public_url?: string;
  progress?: number;
  retryable?: boolean;
  error_code?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AssistantExplanationImageResp {
  status: AssistantExplanationImageStatus;
  message?: string;
  image: AssistantExplanationImage;
}

type AssistantExplanationImageApiPayload =
  | AssistantExplanationImageResp
  | ApiResponse<AssistantExplanationImageResp>;

const normalizeAssistantExplanationImageResponse = (
  payload: AssistantExplanationImageApiPayload
): AssistantExplanationImageResp => {
  if (
    payload &&
    typeof payload === "object" &&
    "image" in payload &&
    payload.image
  ) {
    return payload as AssistantExplanationImageResp;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    payload.data &&
    typeof payload.data === "object" &&
    "image" in payload.data &&
    payload.data.image
  ) {
    return payload.data as AssistantExplanationImageResp;
  }

  throw new Error("讲解图片状态响应格式异常");
};

export interface AssistantDigitalHumanDirective {
  state?: string;
  status?: string;
  phase?: string;
  action?: string;
  mode?: string;
  emotion?: string;
  gesture?: string;
  speech_text?: string;
  highlight_text?: string;
  focus_resource_id?: string;
  speak?: boolean;
  expression_intensity?: number;
  gesture_duration_ms?: number;
  posture?: string;
  speech_rate?: number;
  priority?: number;
}

export interface AssistantChatStreamEvent {
  event: string;
  request_id?: string;
  sequence?: number;
  stage?: string;
  status?: string;
  summary?: string;
  elapsed_ms?: number;
  error_code?: string;
  conversation_id?: string;
  message_id?: string;
  interaction_scope?: AssistantInteractionScope;
  subject_student_id?: number;
  visibility_scope?: AssistantVisibilityScope;
  delta?: string;
  content_text?: string;
  finish_reason?: string;
  error_message?: string;
  retryable?: boolean;
  partial?: boolean;
  created_at?: string;
  finished?: boolean;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  resources?: AssistantChatResource[];
  trace?: AssistantChatTraceStep[];
  digital_human?: AssistantDigitalHumanDirective;
  profile_event?: AssistantProfileEvent;
  source_refs?: AssistantChatSourceRef[];
  video_segments?: AssistantChatVideoSegment[];
  followups?: AssistantChatFollowup[];
  resource_task?: AssistantChatResourceTask;
  conversation_title?: string;
  safety_status?: string;
  safety_summary?: string;
  safety_flags?: string[];
  sensitive_word_hits?: string[];
  explanation_image?: AssistantExplanationImage;
  speech?: AssistantSpeechSession | null;
}

export interface AssistantConversationItem {
  conversation_id: string;
  title: string;
  summary?: string;
  last_message_at?: string;
  message_count: number;
  course_id?: number;
  /** Compatibility field. New clients should read subject_student_id first. */
  target_student_id?: number;
  subject_student_id?: number;
  interaction_scope?: AssistantConversationScope;
  visibility_scope?: AssistantVisibilityScope;
  identity_version?: number;
  legacy_read_only?: boolean;
  metadata?: Record<string, any>;
}

export interface AssistantConversationGroup {
  course_id: number;
  course_name: string;
  conversations: AssistantConversationItem[];
}

export interface AssistantConversationGroupedResp {
  status: string;
  message?: string;
  interaction_scope?: AssistantInteractionScope;
  list: AssistantConversationGroup[];
}

export interface AssistantConversationMessagesResp {
  status: string;
  message?: string;
  total: number;
  list: AssistantConversationMessageItem[];
}

export interface AssistantCoursesResp {
  status: string;
  message?: string;
  selected_course_id?: number;
  interaction_scope?: AssistantInteractionScope;
  target_student_id?: number;
  selected_student_id?: number;
  latest_conversation_id?: string;
  latest_conversation?: AssistantConversationItem;
  list?: (AssistantBootstrapCourse & {
    selected?: boolean;
    latest_conversation_id?: string;
  })[];
  courses?: AssistantBootstrapCourse[];
}

export interface AssistantCreateConversationResp {
  created?: boolean;
  status: string;
  message?: string;
  conversation?: AssistantConversationItem;
  conversation_id?: string;
  title?: string;
}

export interface AssistantConversationDetailResp {
  status: string;
  message?: string;
  conversation?: AssistantConversationItem;
  total?: number;
  messages?: AssistantConversationMessageItem[];
  list?: AssistantConversationMessageItem[];
}

export interface AssistantConversationMessageItem {
  message_id: string;
  role: string;
  content_text?: string;
  created_at: string;
  resources?: AssistantChatResource[];
  metadata?: Record<string, any>;
  explanation_images?: AssistantExplanationImage[];
  speech?: AssistantSpeechSessionSummary | null;
}

export interface AssistantProfileCurrentResp {
  status: string;
  message?: string;
  updated_at?: string;
  schema_version?: string;
  profile_id?: string;
  profile_version?: number;
  confidence?: number;
  risk_flags?: string[];
  last_update_decision?: string;
  learner: AssistantProfileLearner;
  dimensions: AssistantProfileDimension[];
  knowledge_map: {
    label: string;
    mastery: number;
  }[];
  tags: string[];
}

export interface AssistantProfileRefreshResp {
  accepted: boolean;
  status: string;
  message?: string;
  decision?: "write_delta" | "merge_without_event" | "skip" | string;
  skip_reason?: string;
  profile_id?: string;
  profile_version?: number;
  updated_at?: string;
  event?: AssistantProfileEvent;
}

export interface AssistantProfileLearner {
  user_id: number;
  name: string;
  role: string;
  course?: string;
  enroll_days: number;
  study_minutes: number;
}

export interface AssistantProfileDimension {
  key?: string;
  label: string;
  value: number;
  score?: number;
  level?: string;
  description?: string;
  color?: string;
  evidence?: string[];
  evidence_refs?: string[];
  source_refs?: string[];
  trend?: string;
  updated_at?: string;
}

export interface AssistantProfileEvent {
  event_source: string;
  summary?: string;
  decision?: string;
  skip_reason?: string;
  confidence?: number;
  trigger_id?: string;
  delta_json?: string;
  changed_dimensions?: string[];
  evidence?: string[];
  source_refs?: string[];
}

export interface AssistantProfileHistoryItem {
  profile_id: string;
  profile_version: number;
  summary?: string;
  confidence?: number;
  updated_reason?: string;
  updated_at: string;
  dimensions?: AssistantProfileDimension[];
  risk_flags?: string[];
}

export interface AssistantProfileHistoryResp {
  status: string;
  items: AssistantProfileHistoryItem[];
}

export interface AssistantProfileEventsResp {
  status: string;
  items: AssistantProfileEvent[];
}

export interface AssistantProfileStudentItem {
  student_id: number;
  student_name: string;
  avatar?: string;
  progress?: number;
  study_minutes?: number;
  profile_status: string;
  profile_version?: number;
  summary?: string;
  confidence?: number;
  last_updated_at?: string;
  last_update_decision?: string;
  risk_flags?: string[];
}

export interface AssistantProfileStudentsResp {
  status: string;
  course_id: number;
  items: AssistantProfileStudentItem[];
}

export interface AssistantProfileCorrectionItem {
  correction_id: string;
  profile_id: string;
  target_student_id: number;
  dimension_key: string;
  before_json?: string;
  after_json?: string;
  reason?: string;
  operator_id: number;
  operator_role: string;
  status: string;
  created_at: string;
  updated_at?: string;
}

export interface AssistantProfileCorrectionsResp {
  status: string;
  items: AssistantProfileCorrectionItem[];
}

export interface AssistantProfileCorrectionCreateResp {
  accepted: boolean;
  status: string;
  message?: string;
  correction?: AssistantProfileCorrectionItem;
  profile_event?: AssistantProfileEvent;
}

export interface AssistantResourceTaskItem {
  task_id: string;
  status: string;
  stage?: string;
  progress: number;
  error_message?: string;
  health_summary?: string;
  warning_flags?: string[];
  incomplete_resource_count?: number;
  failed_resource_count?: number;
  course_id?: number;
  chapter_id?: number;
  target_student_id?: number;
  resource_types?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface AssistantResourceTaskLogItem {
  stage: string;
  status: string;
  message: string;
  occurred_at: string;
}

export interface AssistantResourceEffectiveTarget {
  target_type: "course" | "chapter" | "hour" | string;
  target_id: number;
  target_source: "mapping" | "replace_override" | string;
  mapping_method?: string;
  mapping_confidence?: number | null;
  knowledge_relevance?: number | null;
}

export interface AssistantResourceSummary {
  resource_id: string;
  task_id?: string;
  resource_type: string;
  title: string;
  summary?: string;
  status: string;
  storage_status?: string;
  storage_error?: string;
  preview_url?: string;
  download_url?: string;
  recommendation?: string;
  object_key?: string;
  description?: string;
  knowledge_point_id?: string;
  knowledge_relevance?: number | null;
  review_status?: string;
  version_no?: number;
  created_at?: string;
  updated_at?: string;
  published_at?: string;
  content_format?: string;
  content_body?: string;
  mime_type?: string;
  structured_data?: unknown;
  html_animation_task_id?: string;
  html_animation_status?: string;
  html_animation_message?: string;
  html_animation_error?: string;
  asset_kind?: string;
  slide_count?: number;
  slides?: Record<string, any>[];
  pptx_status?: string;
  exercise_items?: Record<string, any>[];
  question_bank_status?: string;
  language?: string;
  starter_code?: string;
  test_cases?: Record<string, any>[];
  rubric?: Record<string, any> | string;
  runtime_status?: string;
  quality_score?: number | null;
  safety_status?: string;
  safety_flags?: string[];
  safety_summary?: string;
  citation_coverage?: number | null;
  citations?: AssistantResourceCitation[];
  source_kind?: "generated" | "demo_import" | string;
  mode?: "demo" | "mixed" | string;
  verification_status?: string;
  course_id?: number;
  chapter_id?: number;
  hour_id?: number;
  scope_level?: "course" | "chapter" | "lesson" | string;
  resource_set_id?: string;
  revision_id?: string;
  variant_code?: string;
  variant_label?: string;
  resolution_key?: string;
  effective_targets?: AssistantResourceEffectiveTarget[];
  applicable_context_count?: number;
  visible_context_count?: number;
  preview_pdf_url?: string | null;
}

export interface AssistantResourceCitation {
  title?: string;
  url?: string;
  source?: string;
  snippet?: string;
  [key: string]: any;
}

export interface AssistantCreateResourceTaskResp {
  accepted: boolean;
  resolved?: boolean;
  status: string;
  message?: string;
  task?: AssistantResourceTaskItem;
  resources?: AssistantChatResource[];
}

export interface AssistantResourceArtifactCheck {
  check_type: string;
  gate_level?: string;
  verdict?: string;
  code?: string;
  summary?: string;
  override_reason?: string;
}

export interface AssistantResourceArtifactFile {
  file_id: string;
  role?: string;
  mime_type?: string;
  size_bytes?: number;
  sha256?: string;
  access_scope?: string;
  download_path?: string;
}

export interface AssistantResourceArtifact {
  artifact_id: string;
  task_id?: string;
  resource_type?: string;
  revision_no?: number;
  status: string;
  safety_status?: string;
  hard_gate_status?: string;
  visibility_scope?: "personal" | "course" | string;
  published_resource_id?: string;
  spec_json?: string;
  manifest_json?: string;
  checks?: AssistantResourceArtifactCheck[];
  files?: AssistantResourceArtifactFile[];
  message?: string;
  [key: string]: any;
}

export interface AssistantResourceArtifactsResp {
  status: string;
  message?: string;
  list: AssistantResourceArtifact[];
}

export interface AssistantResourceArtifactDetailResp {
  status: string;
  message?: string;
  artifact: AssistantResourceArtifact;
}

export interface AssistantResourceArtifactFilesResp {
  status: string;
  message?: string;
  list: AssistantResourceArtifactFile[];
}

export interface AssistantResourceArtifactMutationResp {
  status: string;
  message?: string;
  artifact?: AssistantResourceArtifact;
}

export interface AssistantResourceArtifactPreviewAccessResp {
  status: string;
  message?: string;
  access_token: string;
  expires_at: string;
  preview_path: string;
  sandbox_policy?: string;
  csp?: string;
}

export interface AssistantListResourceTasksResp {
  status: string;
  message?: string;
  total: number;
  list: AssistantResourceTaskItem[];
}

export interface AssistantListResourcesResp {
  status: string;
  message?: string;
  mode?: "generated" | "demo" | "mixed" | string;
  total: number;
  page?: number;
  page_size?: number;
  list: AssistantResourceSummary[];
}

export interface AssistantListResourceTaskLogsResp {
  status: string;
  message?: string;
  list: AssistantResourceTaskLogItem[];
}

export interface AssistantResourceMutationResp {
  status: string;
  message?: string;
  resource?: AssistantResourceSummary;
}

export interface AssistantResourceVersionItem {
  version_id: string;
  resource_id: string;
  version_no: number;
  title: string;
  summary?: string;
  description?: string;
  content_format?: string;
  content_body?: string;
  citations?: AssistantResourceCitation[];
  quality_score?: number;
  safety_status?: string;
  editor_id?: number;
  edit_reason?: string;
  created_at?: string;
}

export interface AssistantListResourceVersionsResp {
  status: string;
  message?: string;
  total: number;
  list: AssistantResourceVersionItem[];
}

export type AssistantResourceUsageEventType =
  | "open"
  | "view"
  | "heartbeat"
  | "complete"
  | "feedback";

export interface AssistantResourceUsageMetrics {
  resource_id?: string;
  usage_count?: number;
  dwell_seconds?: number;
  completion_rate?: number;
  average_feedback?: number;
  last_event_at?: string;
  open_count?: number;
  view_count?: number;
  heartbeat_count?: number;
  complete_count?: number;
  feedback_count?: number;
  total_dwell_ms?: number;
  max_progress_percent?: number;
  completed?: boolean;
  average_feedback_score?: number;
  [key: string]: any;
}

export interface AssistantReportResourceUsageResp {
  accepted: boolean;
  status: string;
  message?: string;
  metrics?: AssistantResourceUsageMetrics;
}

export interface AssistantPathRoadmap {
  schema_version?: string;
  path_id?: string;
  path_version?: number;
  summary?: string;
  goal?: string;
  natural_plan?: string;
  apply_status?: string;
  updated_at?: string;
  course_meta: {
    name: string;
    subtitle?: string;
    total_phase: number;
    current_phase: number;
    estimated_hours: number;
  };
  roadmap: {
    title: string;
    status: string;
    summary?: string;
    nodes: {
      node_id: string;
      name: string;
      type: string;
      done: boolean;
      current: boolean;
      reason?: string;
      resource_id?: string;
      knowledge_point_id?: string;
      resource_refs?: string[];
      video_segment_refs?: string[];
      completion_rule?: AssistantPathCompletionRule;
      estimated_minutes?: number;
      priority?: number;
      status?: string;
      status_reason?: string;
      started_at?: string;
      due_at?: string;
    }[];
  }[];
}

export interface AssistantPathCompletionRule {
  type?: string;
  required_resource_count?: number;
  quiz_score_min?: number;
  required_evidence?: string[];
}

export interface AssistantGetCurrentPathResp {
  status: string;
  message?: string;
  path?: AssistantPathRoadmap | null;
}

export interface AssistantGeneratePathResp {
  generated: boolean;
  accepted?: boolean;
  status: string;
  message?: string;
  path?: AssistantPathRoadmap;
}

export interface AssistantCompletePathNodeResp {
  completed: boolean;
  status: string;
  message?: string;
  node_id: string;
}

export interface AssistantPathHistoryItem {
  path_id: string;
  path_version: number;
  status: string;
  apply_status: string;
  summary?: string;
  goal?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AssistantListPathHistoryResp {
  status: string;
  message?: string;
  total: number;
  list: AssistantPathHistoryItem[];
}

export interface AssistantPathActionItem {
  action_id: string;
  action_type: string;
  path_id: string;
  status: string;
  reason?: string;
  created_at?: string;
  path?: AssistantPathRoadmap;
}

export interface AssistantListPathActionsResp {
  status: string;
  message?: string;
  total: number;
  list: AssistantPathActionItem[];
}

export interface AssistantApplyPathActionResp {
  accepted: boolean;
  status: string;
  message?: string;
  path?: AssistantPathRoadmap;
}

export interface AssistantPathPushTaskItem {
  push_id: string;
  path_id?: string;
  node_id?: string;
  resource_id?: string;
  push_type: string;
  title: string;
  summary?: string;
  reason?: string;
  status: string;
  scheduled_at?: string;
  delivered_at?: string;
  created_at?: string;
}

export interface AssistantListPathPushTasksResp {
  status: string;
  message?: string;
  total: number;
  list: AssistantPathPushTaskItem[];
}

export interface AssistantCompletePathPushTaskResp {
  accepted: boolean;
  status: string;
  message?: string;
  push_id: string;
}

export interface AssistantAssessmentCurrentResp {
  status: string;
  message?: string;
  course_info: {
    name: string;
    subtitle?: string;
    total_chapters: number;
    finished_chapters: number;
  };
  stats: {
    label: string;
    value: string;
    sub?: string;
  }[];
  strengths: {
    title: string;
    desc: string;
  }[];
  weak_points: {
    level: string;
    title: string;
    desc: string;
  }[];
  timeline: {
    time: string;
    content: string;
    type: string;
  }[];
  suggestions: string[];
  resource_usage?: AssistantAssessmentResourceUsage;
  feedback_summary?: AssistantAssessmentFeedbackSummary;
  evidence?: AssistantAssessmentEvidenceItem[];
  confidence?: number;
  recommended_actions?: AssistantAssessmentRecommendedAction[];
  need_replan?: boolean;
}

export interface AssistantAssessmentResourceUsage {
  usage_count?: number;
  dwell_seconds?: number;
  completion_rate?: number;
  feedback_count?: number;
  average_feedback?: number;
  last_event_at?: string;
  open_count?: number;
  view_count?: number;
  heartbeat_count?: number;
  complete_count?: number;
  total_dwell_ms?: number;
  dwell_ms?: number;
  average_progress_percent?: number;
  resource_feedback_count?: number;
  average_resource_score?: number;
  average_feedback_score?: number;
  [key: string]: any;
}

export interface AssistantAssessmentFeedbackSummary {
  feedback_count?: number;
  average_rating?: number;
  last_feedback_at?: string;
  latest_comment?: string;
  count?: number;
  average_score?: number;
  avg_score?: number;
  latest_feedback_at?: string;
  latest_at?: string;
  latest_feedback?: string;
  latest_content?: string;
  [key: string]: any;
}

export interface AssistantAssessmentRefreshResp {
  accepted: boolean;
  status: string;
  message?: string;
  job_id?: string;
  assessment_id?: string;
  need_replan?: boolean;
  recommended_actions?: AssistantAssessmentRecommendedAction[];
}

export interface AssistantAssessmentFeedbackResp {
  accepted: boolean;
  status: string;
  message?: string;
  feedback_id?: string;
  job_id?: string;
  feedback_summary?: AssistantAssessmentFeedbackSummary;
}

export interface AssistantAssessmentEvidenceItem {
  source: string;
  summary: string;
  confidence?: number;
}

export interface AssistantAssessmentRecommendedAction {
  action: string;
  reason: string;
  priority?: string;
  target_type?: string;
  target_id?: string;
  auto_triggered?: boolean;
}

export interface AssistantAssessmentHistoryItem {
  assessment_id: string;
  assessment_version: number;
  overall_level: string;
  predicted_score: number;
  summary?: string;
  need_replan: boolean;
  confidence?: number;
  auto_action_status?: string;
  source_job_id?: string;
  evidence?: AssistantAssessmentEvidenceItem[];
  recommended_actions?: AssistantAssessmentRecommendedAction[];
  created_at?: string;
  updated_at?: string;
}

export interface AssistantAssessmentHistoryResp {
  status: string;
  message?: string;
  total: number;
  list: AssistantAssessmentHistoryItem[];
}

export interface AssistantAssessmentActionItem {
  action_id: string;
  assessment_id: string;
  action: string;
  reason: string;
  priority?: string;
  target_type?: string;
  target_id?: string;
  status: string;
  auto_triggered?: boolean;
  created_at?: string;
}

export interface AssistantAssessmentActionsResp {
  status: string;
  message?: string;
  total: number;
  list: AssistantAssessmentActionItem[];
}

export interface AssistantApplyAssessmentActionResp {
  accepted: boolean;
  status: string;
  message?: string;
  action_id: string;
  action: string;
  path?: AssistantPathRoadmap;
  resource_task?: AssistantResourceTaskItem;
  push_task?: AssistantPathPushTaskItem;
}

export interface AssistantAssessmentJobItem {
  job_id: string;
  job_type: string;
  status: string;
  trigger_source?: string;
  trigger_id?: string;
  priority: number;
  attempt_count: number;
  max_attempts: number;
  assessment_id?: string;
  error_message?: string;
  scheduled_at?: string;
  started_at?: string;
  finished_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AssistantAssessmentJobsResp {
  status: string;
  message?: string;
  total: number;
  list: AssistantAssessmentJobItem[];
}

export interface AssistantDashboardCountItem {
  key: string;
  label?: string;
  count: number;
}

export interface AssistantDashboardStudentsSummary {
  total_students: number;
  profile_ready_count: number;
  high_risk_count: number;
  need_replan_count: number;
  average_progress: number;
}

export interface AssistantDashboardStudentItem {
  student_id: number;
  student_name: string;
  avatar?: string;
  progress?: number;
  study_minutes?: number;
  profile_status: string;
  last_updated_at?: string;
  summary?: string;
  dimension_scores?: AssistantProfileDimension[];
  risk_flags?: string[];
  latest_event?: string;
  need_teacher_attention: boolean;
  predicted_score?: number;
  need_replan?: boolean;
}

export interface AssistantDashboardStudentsResp {
  status: string;
  message?: string;
  course_id: number;
  total: number;
  summary: AssistantDashboardStudentsSummary;
  list: AssistantDashboardStudentItem[];
}

export interface AssistantDashboardResourcesResp {
  status: string;
  message?: string;
  course_id: number;
  summary: {
    total_resources: number;
    pending_review_count: number;
    blocked_count: number;
    degraded_count: number;
    average_quality: number;
  };
  type_distribution: AssistantDashboardCountItem[];
  status_distribution: AssistantDashboardCountItem[];
  review_distribution: AssistantDashboardCountItem[];
  recent_tasks: AssistantResourceTaskItem[];
}

export interface AssistantDashboardRisksResp {
  status: string;
  message?: string;
  course_id: number;
  summary: {
    high_risk_students: number;
    low_completion_students: number;
    need_replan_students: number;
    negative_feedback_students: number;
  };
  risk_flags: AssistantDashboardCountItem[];
  attention_students: AssistantDashboardStudentItem[];
}

export interface AssistantDashboardPathsResp {
  status: string;
  message?: string;
  course_id: number;
  summary: {
    active_path_students: number;
    average_completion_rate: number;
    overdue_node_count: number;
    need_replan_count: number;
  };
  list: {
    student_id: number;
    student_name?: string;
    path_id: string;
    path_version: number;
    status: string;
    apply_status?: string;
    summary?: string;
    completion_rate: number;
    completed_nodes: number;
    total_nodes: number;
    overdue_nodes: number;
    updated_at?: string;
  }[];
}

export interface AssistantTaskTraceResp {
  status: string;
  message?: string;
  task: AssistantResourceTaskItem;
  trace: AssistantChatTraceStep[];
  logs: AssistantResourceTaskLogItem[];
}

export interface AssistantConversationTraceResp {
  status: string;
  message?: string;
  conversation_id: string;
  title?: string;
  trace: AssistantChatTraceStep[];
  safety?: {
    status?: string;
    summary?: string;
    flags?: string[];
  };
  source_refs?: Record<string, string>[];
  resource_links?: {
    resource_id: string;
    link_source: string;
    reason?: string;
    created_at?: string;
  }[];
}

function buildAuthHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    "X-Requested-With": "XMLHttpRequest"
  };
  if (token?.accessToken) {
    headers.Authorization = formatToken(token.accessToken);
  }
  return headers;
}

function apiBaseURL() {
  return (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
}

async function parseAssistantSpeechError(response: Response) {
  let payload: Partial<AssistantSpeechAPIError> | undefined;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }
  const error = new Error(
    payload?.message || `语音服务请求失败 (HTTP ${response.status})`
  ) as Error & {
    status?: number;
    code?: number | string;
  };
  error.status = response.status;
  error.code = payload?.code;
  return error;
}

async function requestAssistantSpeech<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Requested-With", "XMLHttpRequest");
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (token?.accessToken) {
    headers.set("Authorization", formatToken(token.accessToken));
  }

  const response = await fetch(
    /^https?:\/\//i.test(path) ? path : `${apiBaseURL()}${path}`,
    {
      ...options,
      headers,
      cache: "no-store"
    }
  );
  if (response.status === 401) {
    void useUserStoreHook().logOut();
  }
  if (!response.ok) throw await parseAssistantSpeechError(response);
  return response.json() as Promise<T>;
}

export function createAssistantSpeechStreamReservation(
  data: AssistantSpeechStreamReservationRequest,
  signal?: AbortSignal,
  endpoint = "/edu/frontend/v1/assistant/speech/stream-reservations"
) {
  return requestAssistantSpeech<AssistantSpeechStreamReservationResponse>(
    endpoint,
    {
      method: "POST",
      body: JSON.stringify(data),
      signal
    }
  );
}

export function getAssistantSpeechSession(
  sessionId: string,
  includeTimeline = false,
  signal?: AbortSignal
) {
  const query = new URLSearchParams({
    include_timeline: String(includeTimeline)
  });
  return requestAssistantSpeech<AssistantSpeechSessionResponse>(
    `/edu/frontend/v1/assistant/speech/sessions/${encodeURIComponent(sessionId)}?${query}`,
    { signal }
  );
}

export function cancelAssistantSpeechSession(
  sessionId: string,
  signal?: AbortSignal
) {
  return requestAssistantSpeech<AssistantSpeechSessionResponse>(
    `/edu/frontend/v1/assistant/speech/sessions/${encodeURIComponent(sessionId)}/cancel`,
    {
      method: "POST",
      body: "{}",
      signal
    }
  );
}

function emitSSEBlock(
  block: string,
  onEvent: (data: AssistantChatStreamEvent) => void
): boolean {
  let eventName = "";
  const dataLines: string[] = [];

  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  const payload = dataLines.join("\n").trim();
  if (!payload || payload === "[DONE]") return false;

  try {
    const event = JSON.parse(payload) as AssistantChatStreamEvent;
    if (!event.event && eventName) event.event = eventName;
    onEvent(event);
    return event.event === "assistant.completed" || event.event === "error";
  } catch (error) {
    console.error("解析学习助手 SSE 消息失败:", error, payload);
    return false;
  }
}

async function parseSSEStream(
  response: Response,
  onEvent: (data: AssistantChatStreamEvent) => void,
  isAborted: () => boolean
) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("无法获取响应流");

  const decoder = new TextDecoder();
  let buffer = "";
  let receivedTerminal = false;

  const flushBlocks = () => {
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || "";
    blocks.forEach(block => {
      receivedTerminal = emitSSEBlock(block, onEvent) || receivedTerminal;
    });
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    flushBlocks();
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    receivedTerminal = emitSSEBlock(buffer, onEvent) || receivedTerminal;
  }

  if (!receivedTerminal && !isAborted()) {
    onEvent({
      event: "error",
      stage: "stream",
      status: "partial",
      error_code: "stream_ended_without_terminal",
      error_message: "连接已提前结束，未收到最终结果。",
      retryable: true,
      partial: true,
      finished: true
    });
  }
}

export const getAssistantBootstrap = (params?: {
  course_id?: number;
  target_student_id?: number;
  interaction_scope?: AssistantInteractionScope;
}) =>
  http.request<ApiResponse<AssistantBootstrapResp>>(
    "get",
    "/edu/frontend/v1/assistant/bootstrap",
    { params }
  );

export const getAssistantCourses = (params?: {
  course_id?: number;
  target_student_id?: number;
  interaction_scope?: AssistantInteractionScope;
}) =>
  http.request<ApiResponse<AssistantCoursesResp>>(
    "get",
    "/edu/frontend/v1/assistant/courses",
    { params }
  );

export const getAssistantConversationGroups = (params?: {
  target_student_id?: number;
  interaction_scope?: AssistantInteractionScope;
}) =>
  http.request<ApiResponse<AssistantConversationGroupedResp>>(
    "get",
    "/edu/frontend/v1/assistant/conversations/grouped",
    { params }
  );

export const getAssistantConversationsByCourse = (params: {
  course_id: number;
  target_student_id?: number;
  interaction_scope?: AssistantInteractionScope;
}) =>
  http.request<
    ApiResponse<{
      status: string;
      message?: string;
      total: number;
      list: AssistantConversationItem[];
    }>
  >("get", "/edu/frontend/v1/assistant/conversations/by-course", { params });

export const createAssistantConversation = (data: {
  course_id: number;
  chapter_id?: number;
  target_student_id?: number;
  interaction_scope?: AssistantInteractionScope;
  title?: string;
  metadata?: Record<string, string>;
}) =>
  http.request<ApiResponse<AssistantCreateConversationResp>>(
    "post",
    "/edu/frontend/v1/assistant/conversations",
    { data }
  );

export const getAssistantConversation = (conversationId: string) =>
  http.request<ApiResponse<AssistantConversationDetailResp>>(
    "get",
    `/edu/frontend/v1/assistant/conversations/${encodeURIComponent(conversationId)}`
  );

export const getAssistantConversationMessages = (conversationId: string) =>
  http.request<ApiResponse<AssistantConversationMessagesResp>>(
    "get",
    `/edu/frontend/v1/assistant/conversations/${encodeURIComponent(conversationId)}/messages`
  );

export const getAssistantExplanationImage = (imageId: string) =>
  http
    .request<AssistantExplanationImageApiPayload>(
      "get",
      `/edu/frontend/v1/assistant/explanation-images/${encodeURIComponent(imageId)}`,
      {
        // Polling must bypass browser/CDN caches without adding a custom
        // cross-origin request header outside the backend CORS allow-list.
        params: { _ts: Date.now() }
      }
    )
    .then(normalizeAssistantExplanationImageResponse);

const pickAssistantField = <T = string>(
  source: Record<string, any> | undefined,
  keys: string[]
): T | undefined => {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") {
      return value as T;
    }
  }
  return undefined;
};

const digestFileSha256 = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
};

const createAssistantCosClient = (
  credentials: AssistantAttachmentStsCredentials = {},
  uploadUrl?: string
) => {
  const tmpSecretId = pickAssistantField(credentials, [
    "tmp_secret_id",
    "tmpSecretId",
    "TmpSecretId"
  ]);
  const tmpSecretKey = pickAssistantField(credentials, [
    "tmp_secret_key",
    "tmpSecretKey",
    "TmpSecretKey"
  ]);
  const securityToken = pickAssistantField(credentials, [
    "security_token",
    "session_token",
    "securityToken",
    "sessionToken",
    "SessionToken",
    "Token"
  ]);
  const bucket = pickAssistantField(credentials, ["bucket", "Bucket"]);
  const region = pickAssistantField(credentials, ["region", "Region"]);

  if (!tmpSecretId || !tmpSecretKey || !securityToken || !bucket || !region) {
    throw new Error("文档附件上传凭证不完整");
  }

  let uploadDomain: string | undefined;
  if (uploadUrl) {
    try {
      uploadDomain = new URL(uploadUrl).host;
    } catch {
      uploadDomain = undefined;
    }
  }

  return {
    cos: new COS({
      SecretId: tmpSecretId,
      SecretKey: tmpSecretKey,
      SecurityToken: securityToken,
      Protocol: "https:",
      Domain: uploadDomain
    }),
    bucket,
    region
  };
};

const putAssistantDocumentObject = async (
  file: File,
  initData: AssistantDocumentAttachmentStsInitResp
) => {
  const { cos, bucket, region } = createAssistantCosClient(
    initData.credentials,
    initData.upload_url
  );

  await new Promise((resolve, reject) => {
    cos.putObject(
      {
        Bucket: bucket,
        Region: region,
        Key: initData.object_key,
        Body: file,
        ContentType: file.type || "application/octet-stream"
      },
      (error, data) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(data);
      }
    );
  });
};

const wait = (ms: number) =>
  new Promise(resolve => {
    window.setTimeout(resolve, ms);
  });

const assistantChatAttachmentsPath = "/edu/frontend/v1/ai/chat/attachments";
const assistantChatDocumentAttachmentsPath =
  "/edu/frontend/v1/ai/chat/document-attachments";

export const initAssistantDocumentAttachmentSts = (
  data: AssistantDocumentAttachmentStsInitReq
) =>
  http.request<ApiResponse<AssistantDocumentAttachmentStsInitResp>>(
    "post",
    `${assistantChatDocumentAttachmentsPath}/sts/init`,
    { data }
  );

export const completeAssistantDocumentAttachmentSts = (
  data: AssistantDocumentAttachmentCompleteReq
) =>
  http.request<ApiResponse<AssistantChatAttachmentStatus>>(
    "post",
    `${assistantChatDocumentAttachmentsPath}/sts/complete`,
    { data }
  );

export const getAssistantChatAttachmentStatus = (attachmentId: string) =>
  http.request<ApiResponse<AssistantChatAttachmentStatus>>(
    "get",
    `${assistantChatAttachmentsPath}/${encodeURIComponent(attachmentId)}/status`
  );

export const waitAssistantDocumentAttachmentReady = async (
  attachmentId: string,
  options: { intervalMs?: number; maxAttempts?: number } = {}
) => {
  const intervalMs = options.intervalMs ?? 1500;
  const maxAttempts = options.maxAttempts ?? 24;
  let latest: AssistantChatAttachmentStatus | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { data } = await getAssistantChatAttachmentStatus(attachmentId);
    latest = data;
    if (data.parse_status === "ready") return data;
    if (data.parse_status === "failed") {
      throw new Error(data.parse_error || "文档解析失败");
    }
    await wait(intervalMs);
  }

  throw new Error(latest?.parse_error || "文档仍在解析中，请稍后重新发送");
};

export const uploadAssistantDocumentAttachment = async (
  file: File,
  options: {
    scene?: string;
    course_id?: number;
    conversation_id?: string;
    content_type?: string;
  }
) => {
  const { data: initData } = await initAssistantDocumentAttachmentSts({
    scene: options.scene || "assistant",
    course_id: options.course_id,
    // Assistant conversations use a different ownership domain from /ai/chat attachments.
    conversation_id:
      options.scene === "assistant" ? undefined : options.conversation_id,
    file_name: file.name,
    content_type:
      options.content_type || file.type || "application/octet-stream",
    file_size: file.size
  });

  if (!initData.upload_token || !initData.object_key) {
    throw new Error("文档附件初始化失败");
  }

  await putAssistantDocumentObject(file, initData);
  const sha256 = await digestFileSha256(file);
  const { data: completeData } = await completeAssistantDocumentAttachmentSts({
    upload_token: initData.upload_token,
    sha256
  });

  return waitAssistantDocumentAttachmentReady(
    completeData.attachment_id || initData.attachment_id
  );
};

export function streamAssistantChat(
  params: AssistantChatStreamReq,
  onEvent: (data: AssistantChatStreamEvent) => void
): () => void {
  const controller = new AbortController();

  void (async () => {
    try {
      const response = await fetch(
        `${apiBaseURL()}/edu/frontend/v1/assistant/chat/stream`,
        {
          method: "POST",
          headers: buildAuthHeaders(),
          body: JSON.stringify(params),
          signal: controller.signal
        }
      );
      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
          const data = await response.json();
          message = data?.error?.message || data?.msg || message;
        } catch {
          // ignore non-json errors
        }
        throw new Error(message);
      }
      await parseSSEStream(response, onEvent, () => controller.signal.aborted);
    } catch (error: any) {
      if (error.name === "AbortError") return;
      console.error("学习助手流式请求失败:", error);
      onEvent({
        event: "error",
        conversation_id: params.conversation_id,
        error_message: error.message || "学习助手响应失败",
        finished: true
      });
    }
  })();

  return () => controller.abort();
}

export const getAssistantProfileCurrent = (params?: {
  course_id?: number;
  target_student_id?: number;
}) =>
  http.request<ApiResponse<AssistantProfileCurrentResp>>(
    "get",
    "/edu/frontend/v1/assistant/profile/current",
    { params }
  );

export const refreshAssistantProfile = (data: {
  course_id?: number;
  target_student_id?: number;
  trigger?: string;
  message?: string;
}) =>
  http.request<ApiResponse<AssistantProfileRefreshResp>>(
    "post",
    "/edu/frontend/v1/assistant/profile/refresh",
    { data }
  );

export const listAssistantProfileHistory = (params?: {
  course_id?: number;
  target_student_id?: number;
  limit?: number;
}) =>
  http
    .request<
      ApiResponse<AssistantProfileHistoryResp> | AssistantProfileHistoryResp
    >("get", "/edu/frontend/v1/assistant/profile/history", { params })
    .then(normalizeAssistantApiResponse);

export const listAssistantProfileEvents = (params?: {
  course_id?: number;
  target_student_id?: number;
  limit?: number;
}) =>
  http
    .request<
      ApiResponse<AssistantProfileEventsResp> | AssistantProfileEventsResp
    >("get", "/edu/frontend/v1/assistant/profile/events", { params })
    .then(normalizeAssistantApiResponse);

export const listAssistantProfileStudents = (params?: {
  course_id?: number;
  limit?: number;
}) =>
  http
    .request<
      ApiResponse<AssistantProfileStudentsResp> | AssistantProfileStudentsResp
    >("get", "/edu/frontend/v1/assistant/profile/students", { params })
    .then(normalizeAssistantApiResponse);

export const listAssistantProfileCorrections = (params?: {
  course_id?: number;
  target_student_id?: number;
  limit?: number;
}) =>
  http
    .request<
      | ApiResponse<AssistantProfileCorrectionsResp>
      | AssistantProfileCorrectionsResp
    >("get", "/edu/frontend/v1/assistant/profile/corrections", { params })
    .then(normalizeAssistantApiResponse);

export const createAssistantProfileCorrection = (data: {
  course_id?: number;
  target_student_id: number;
  dimension_key: string;
  after_json: string;
  reason?: string;
}) =>
  http
    .request<
      | ApiResponse<AssistantProfileCorrectionCreateResp>
      | AssistantProfileCorrectionCreateResp
    >("post", "/edu/frontend/v1/assistant/profile/corrections", { data })
    .then(normalizeAssistantApiResponse);

export const createAssistantResourceTask = (data: {
  course_id?: number;
  chapter_id?: number;
  target_student_id?: number;
  resource_types?: string[];
  prompt?: string;
}) =>
  http.request<ApiResponse<AssistantCreateResourceTaskResp>>(
    "post",
    "/edu/frontend/v1/assistant/resources/tasks",
    { data }
  );

export const listAssistantResourceTasks = (params?: {
  course_id?: number;
  target_student_id?: number;
  status?: string;
}) =>
  http.request<ApiResponse<AssistantListResourceTasksResp>>(
    "get",
    "/edu/frontend/v1/assistant/resources/tasks",
    { params }
  );

export const listAssistantResourceTaskLogs = (taskId: string) =>
  http.request<ApiResponse<AssistantListResourceTaskLogsResp>>(
    "get",
    `/edu/frontend/v1/assistant/resources/tasks/${encodeURIComponent(taskId)}/logs`
  );

const normalizeRawAssistantResponse = <T>(payload: T) =>
  normalizeAssistantApiResponse<T>(payload);

export const listAssistantResourceArtifacts = (taskId: string) =>
  http
    .request<AssistantResourceArtifactsResp>(
      "get",
      `/edu/frontend/v1/assistant/resources/tasks/${encodeURIComponent(taskId)}/artifacts`
    )
    .then(normalizeRawAssistantResponse);

export const getAssistantResourceArtifact = (artifactId: string) =>
  http
    .request<AssistantResourceArtifactDetailResp>(
      "get",
      `/edu/frontend/v1/assistant/resources/artifacts/${encodeURIComponent(artifactId)}`
    )
    .then(normalizeRawAssistantResponse);

export const listAssistantResourceArtifactFiles = (artifactId: string) =>
  http
    .request<AssistantResourceArtifactFilesResp>(
      "get",
      `/edu/frontend/v1/assistant/resources/artifacts/${encodeURIComponent(artifactId)}/files`
    )
    .then(normalizeRawAssistantResponse);

export const retryAssistantResourceArtifact = (
  artifactId: string,
  data: { reason?: string } = {}
) =>
  http
    .request<AssistantResourceArtifactMutationResp>(
      "post",
      `/edu/frontend/v1/assistant/resources/artifacts/${encodeURIComponent(artifactId)}/retry`,
      { data }
    )
    .then(normalizeRawAssistantResponse);

export const reviewAssistantResourceArtifact = (
  artifactId: string,
  data: { decision: "approved" | "rejected"; reason?: string }
) =>
  http
    .request<AssistantResourceArtifactMutationResp>(
      "post",
      `/edu/frontend/v1/assistant/resources/artifacts/${encodeURIComponent(artifactId)}/review`,
      { data }
    )
    .then(normalizeRawAssistantResponse);

export const publishAssistantResourceArtifact = (artifactId: string) =>
  http
    .request<AssistantResourceArtifactMutationResp>(
      "post",
      `/edu/frontend/v1/assistant/resources/artifacts/${encodeURIComponent(artifactId)}/publish`,
      { data: {} }
    )
    .then(normalizeRawAssistantResponse);

export const updateAssistantResourceArtifactVisibility = (
  artifactId: string,
  visibility_scope: "personal" | "course"
) =>
  http
    .request<AssistantResourceArtifactMutationResp>(
      "post",
      `/edu/frontend/v1/assistant/resources/artifacts/${encodeURIComponent(artifactId)}/visibility`,
      { data: { visibility_scope } }
    )
    .then(normalizeRawAssistantResponse);

export const getAssistantResourceArtifactPreviewAccess = (artifactId: string) =>
  http
    .request<AssistantResourceArtifactPreviewAccessResp>(
      "get",
      `/edu/frontend/v1/assistant/resources/artifacts/${encodeURIComponent(artifactId)}/preview-access`
    )
    .then(normalizeRawAssistantResponse);

export const getAssistantResourceArtifactFileContent = async (
  artifactId: string,
  fileId: string
) => {
  const token = getToken();
  const response = await fetch(
    `${apiBaseURL()}/edu/frontend/v1/assistant/resources/artifacts/${encodeURIComponent(artifactId)}/files/${encodeURIComponent(fileId)}/content`,
    {
      headers: token?.accessToken
        ? { Authorization: formatToken(token.accessToken) }
        : undefined
    }
  );
  if (!response.ok) {
    throw new Error(`资源文件读取失败（HTTP ${response.status}）`);
  }
  return response.blob();
};

export const getAssistantResourceTask = (taskId: string) =>
  http.request<
    ApiResponse<{
      status: string;
      message?: string;
      task: AssistantResourceTaskItem;
    }>
  >(
    "get",
    `/edu/frontend/v1/assistant/resources/tasks/${encodeURIComponent(taskId)}`
  );

export const listAssistantResources = (params?: {
  course_id?: number;
  target_student_id?: number;
  chapter_id?: number;
  hour_id?: number;
  task_id?: string;
  resource_type?: string;
  source_kind?: "generated" | "demo_import";
  page?: number;
  page_size?: number;
}) =>
  http.request<ApiResponse<AssistantListResourcesResp>>(
    "get",
    "/edu/frontend/v1/assistant/resources",
    { params }
  );

export const getAssistantResource = (
  resourceId: string,
  params?: {
    course_id?: number;
    target_student_id?: number;
    chapter_id?: number;
    hour_id?: number;
  }
) =>
  http.request<
    ApiResponse<{
      status: string;
      message?: string;
      resource: AssistantResourceSummary;
    }>
  >(
    "get",
    `/edu/frontend/v1/assistant/resources/${encodeURIComponent(resourceId)}`,
    { params }
  );

export const updateAssistantResource = (
  resourceId: string,
  data: {
    title?: string;
    summary?: string;
    description?: string;
    content_format?: string;
    content_body?: string;
    knowledge_point_id?: string;
    knowledge_relevance?: number;
    citations?: AssistantResourceCitation[];
    edit_reason?: string;
  }
) =>
  http.request<ApiResponse<AssistantResourceMutationResp>>(
    "patch",
    `/edu/frontend/v1/assistant/resources/${encodeURIComponent(resourceId)}`,
    { data }
  );

export const reviewAssistantResource = (
  resourceId: string,
  data: {
    review_status:
      | "pending"
      | "approved"
      | "rejected"
      | "changes_requested"
      | string;
    review_comment?: string;
  }
) =>
  http.request<ApiResponse<AssistantResourceMutationResp>>(
    "post",
    `/edu/frontend/v1/assistant/resources/${encodeURIComponent(resourceId)}/review`,
    { data }
  );

export const publishAssistantResource = (resourceId: string) =>
  http.request<ApiResponse<AssistantResourceMutationResp>>(
    "post",
    `/edu/frontend/v1/assistant/resources/${encodeURIComponent(resourceId)}/publish`
  );

export const deleteAssistantResource = (resourceId: string) =>
  http.request<ApiResponse<AssistantResourceMutationResp>>(
    "delete",
    `/edu/frontend/v1/assistant/resources/${encodeURIComponent(resourceId)}`
  );

export const listAssistantResourceVersions = (resourceId: string) =>
  http.request<ApiResponse<AssistantListResourceVersionsResp>>(
    "get",
    `/edu/frontend/v1/assistant/resources/${encodeURIComponent(resourceId)}/versions`
  );

export const reportAssistantResourceUsage = (data: {
  resource_id: string;
  course_id?: number;
  target_student_id?: number;
  event_type: AssistantResourceUsageEventType;
  dwell_ms?: number;
  progress_percent?: number;
  completed?: boolean;
  feedback_score?: number;
  feedback_text?: string;
  metadata?: Record<string, any>;
}) =>
  http.request<ApiResponse<AssistantReportResourceUsageResp>>(
    "post",
    "/edu/frontend/v1/assistant/resources/usage/events",
    { data }
  );

export const getAssistantCurrentPath = (params?: {
  course_id?: number;
  target_student_id?: number;
}) =>
  http.request<ApiResponse<AssistantGetCurrentPathResp>>(
    "get",
    "/edu/frontend/v1/assistant/path/current",
    { params }
  );

export const generateAssistantPath = (data: {
  course_id?: number;
  target_student_id?: number;
  goal?: string;
}) =>
  http.request<ApiResponse<AssistantGeneratePathResp>>(
    "post",
    "/edu/frontend/v1/assistant/path/generate",
    { data }
  );

export const completeAssistantPathNode = (
  nodeId: string,
  data: {
    course_id?: number;
    target_student_id?: number;
    completion_evidence?: string;
  }
) =>
  http.request<ApiResponse<AssistantCompletePathNodeResp>>(
    "post",
    `/edu/frontend/v1/assistant/path/nodes/${encodeURIComponent(nodeId)}/complete`,
    { data }
  );

export const replanAssistantPath = (data: {
  course_id?: number;
  target_student_id?: number;
  reason?: string;
  apply_immediately?: boolean;
}) =>
  http.request<ApiResponse<AssistantGeneratePathResp>>(
    "post",
    "/edu/frontend/v1/assistant/path/replan",
    { data }
  );

export const listAssistantPathHistory = (params?: {
  course_id?: number;
  target_student_id?: number;
}) =>
  http
    .request<
      ApiResponse<AssistantListPathHistoryResp> | AssistantListPathHistoryResp
    >("get", "/edu/frontend/v1/assistant/path/history", { params })
    .then(normalizeAssistantApiResponse);

export const listAssistantPathActions = (params?: {
  course_id?: number;
  target_student_id?: number;
}) =>
  http
    .request<
      ApiResponse<AssistantListPathActionsResp> | AssistantListPathActionsResp
    >("get", "/edu/frontend/v1/assistant/path/actions", { params })
    .then(normalizeAssistantApiResponse);

export const applyAssistantPathAction = (actionId: string) =>
  http
    .request<
      ApiResponse<AssistantApplyPathActionResp> | AssistantApplyPathActionResp
    >("post", `/edu/frontend/v1/assistant/path/actions/${encodeURIComponent(actionId)}/apply`)
    .then(normalizeAssistantApiResponse);

export const listAssistantPathPushTasks = (params?: {
  course_id?: number;
  target_student_id?: number;
  status?: string;
}) =>
  http
    .request<
      | ApiResponse<AssistantListPathPushTasksResp>
      | AssistantListPathPushTasksResp
    >("get", "/edu/frontend/v1/assistant/path/push-tasks", { params })
    .then(normalizeAssistantApiResponse);

export const completeAssistantPathPushTask = (pushId: string) =>
  http
    .request<
      | ApiResponse<AssistantCompletePathPushTaskResp>
      | AssistantCompletePathPushTaskResp
    >("post", `/edu/frontend/v1/assistant/path/push-tasks/${encodeURIComponent(pushId)}/complete`)
    .then(normalizeAssistantApiResponse);

export const getAssistantAssessmentCurrent = (params?: {
  course_id?: number;
  target_student_id?: number;
}) =>
  http.request<ApiResponse<AssistantAssessmentCurrentResp>>(
    "get",
    "/edu/frontend/v1/assistant/assessment/current",
    { params }
  );

export const refreshAssistantAssessment = (data: {
  course_id?: number;
  target_student_id?: number;
  trigger?: string;
  reason?: string;
  mode?: "sync" | "async" | string;
}) =>
  http.request<ApiResponse<AssistantAssessmentRefreshResp>>(
    "post",
    "/edu/frontend/v1/assistant/assessment/refresh",
    { data: { ...data, reason: data.reason || data.trigger } }
  );

export const submitAssistantAssessmentFeedback = (data: {
  course_id?: number;
  target_student_id?: number;
  assessment_id?: string;
  target_type?: string;
  target_id?: string;
  score?: number;
  feedback_text?: string;
  rating?: number;
  content?: string;
  metadata?: Record<string, string>;
}) =>
  http.request<ApiResponse<AssistantAssessmentFeedbackResp>>(
    "post",
    "/edu/frontend/v1/assistant/assessment/feedback",
    {
      data: {
        ...data,
        rating: data.rating ?? data.score,
        content: data.content ?? data.feedback_text
      }
    }
  );

export const listAssistantAssessmentHistory = (params?: {
  course_id?: number;
  target_student_id?: number;
}) =>
  http
    .request<
      | ApiResponse<AssistantAssessmentHistoryResp>
      | AssistantAssessmentHistoryResp
    >("get", "/edu/frontend/v1/assistant/assessment/history", { params })
    .then(normalizeAssistantApiResponse);

export const listAssistantAssessmentActions = (params?: {
  course_id?: number;
  target_student_id?: number;
  status?: string;
}) =>
  http
    .request<
      | ApiResponse<AssistantAssessmentActionsResp>
      | AssistantAssessmentActionsResp
    >("get", "/edu/frontend/v1/assistant/assessment/actions", { params })
    .then(normalizeAssistantApiResponse);

export const applyAssistantAssessmentAction = (actionId: string) =>
  http
    .request<
      | ApiResponse<AssistantApplyAssessmentActionResp>
      | AssistantApplyAssessmentActionResp
    >("post", `/edu/frontend/v1/assistant/assessment/actions/${encodeURIComponent(actionId)}/apply`)
    .then(normalizeAssistantApiResponse);

export const listAssistantAssessmentJobs = (params?: {
  course_id?: number;
  target_student_id?: number;
  status?: string;
}) =>
  http
    .request<
      ApiResponse<AssistantAssessmentJobsResp> | AssistantAssessmentJobsResp
    >("get", "/edu/frontend/v1/assistant/assessment/jobs", { params })
    .then(normalizeAssistantApiResponse);

export const getAssistantDashboardStudents = (params?: {
  course_id?: number;
  keyword?: string;
  risk_level?: string;
  profile_updated_after?: string;
  page?: number;
  page_size?: number;
}) =>
  http.request<ApiResponse<AssistantDashboardStudentsResp>>(
    "get",
    "/edu/frontend/v1/assistant/dashboard/students",
    { params }
  );

export const getAssistantDashboardResources = (params?: {
  course_id?: number;
}) =>
  http.request<ApiResponse<AssistantDashboardResourcesResp>>(
    "get",
    "/edu/frontend/v1/assistant/dashboard/resources",
    { params }
  );

export const getAssistantDashboardRisks = (params?: { course_id?: number }) =>
  http.request<ApiResponse<AssistantDashboardRisksResp>>(
    "get",
    "/edu/frontend/v1/assistant/dashboard/risks",
    { params }
  );

export const getAssistantDashboardPaths = (params?: { course_id?: number }) =>
  http.request<ApiResponse<AssistantDashboardPathsResp>>(
    "get",
    "/edu/frontend/v1/assistant/dashboard/paths",
    { params }
  );

export const getAssistantTaskTrace = (taskId: string) =>
  http
    .request<
      ApiResponse<AssistantTaskTraceResp> | AssistantTaskTraceResp
    >("get", `/edu/frontend/v1/assistant/tasks/${encodeURIComponent(taskId)}/trace`)
    .then(normalizeAssistantApiResponse);

export const getAssistantConversationTrace = (conversationId: string) =>
  http
    .request<
      | ApiResponse<AssistantConversationTraceResp>
      | AssistantConversationTraceResp
    >("get", `/edu/frontend/v1/assistant/conversations/${encodeURIComponent(conversationId)}/trace`)
    .then(normalizeAssistantApiResponse);
