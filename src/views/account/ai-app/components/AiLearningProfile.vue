<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import {
  User,
  TrendCharts,
  Reading,
  VideoPlay,
  Avatar,
  Refresh,
  EditPen,
  Clock
} from "@element-plus/icons-vue";
import {
  assistantApiErrorMessage,
  createAssistantProfileCorrection,
  getAssistantProfileCurrent,
  listAssistantProfileCorrections,
  listAssistantProfileEvents,
  listAssistantProfileHistory,
  refreshAssistantProfile,
  type AssistantProfileCorrectionItem,
  type AssistantProfileCurrentResp,
  type AssistantProfileEvent,
  type AssistantProfileHistoryItem
} from "@/api/frontend/assistant";
import linuxCourseCover from "@/assets/course/嵌入式Linux开发实践教程.webp";
import dataStructureCourseCover from "@/assets/course/数据结构与算法.png";
import mathCourseCover from "@/assets/course/高等数学.png";
import networkCourseCover from "@/assets/course/计算机网络.webp";

type EnrolledCourse = {
  id?: number;
  course_id?: number;
  name?: string;
  course_name?: string;
  subtitle?: string;
  thumb_url?: string;
};

const props = defineProps<{
  courseId?: number;
  targetStudentId?: number;
  requiresTargetStudent?: boolean;
  enrolledCourses?: EnrolledCourse[];
}>();

const emit = defineEmits<{
  (event: "profile-loaded", payload: AssistantProfileCurrentResp): void;
}>();

const loading = ref(false);
const refreshing = ref(false);
const correctionSubmitting = ref(false);
const profile = ref<AssistantProfileCurrentResp | null>(null);
const profileHistory = ref<AssistantProfileHistoryItem[]>([]);
const profileEvents = ref<AssistantProfileEvent[]>([]);
const profileCorrections = ref<AssistantProfileCorrectionItem[]>([]);
const correctionDimension = ref("");
const correctionValue = ref(80);
const correctionReason = ref("");
const selectedDimension = ref<any | null>(null);
const dimensionDetailVisible = ref(false);

const learner = computed(
  () =>
    profile.value?.learner || {
      name: "学习者",
      role: "student",
      course: "当前课程",
      enroll_days: 0,
      study_minutes: 0
    }
);

const roleLabelMap: Record<string, string> = {
  student: "学生",
  teacher: "教师",
  admin: "管理员"
};

const statusLabelMap: Record<string, string> = {
  at_risk: "需关注",
  developing: "发展中",
  stable: "稳定",
  excellent: "优秀",
  write_delta: "已写入更新",
  skip: "本次跳过",
  merge_without_event: "合并更新",
  risk_high: "高风险",
  risk_state: "风险状态",
  profile_agent_degraded_rules: "画像规则降级",
  "wrong-question-repair-needed": "错题修复待处理"
};

const learnerRoleLabel = computed(() => {
  const role = String(learner.value.role || "student").toLowerCase();
  return roleLabelMap[role] || learner.value.role || "学生";
});

const localizeStatusText = (value?: string) => {
  if (!value) return "暂无";
  const normalized = value.replace(/-/g, "_");
  return statusLabelMap[value] || statusLabelMap[normalized] || value;
};

const localizeTag = (tag: string) => {
  if (tag.startsWith("course:")) return `课程：${tag.slice(7)}`;
  if (tag === "mode:student") return "学生模式";
  if (tag === "mode:teacher") return "教师模式";
  return localizeStatusText(tag);
};

const courseCoverByName = (name: string) => {
  if (/linux|嵌入式/i.test(name)) return linuxCourseCover;
  if (/数据结构|算法/.test(name)) return dataStructureCourseCover;
  if (/高等数学|数学/.test(name)) return mathCourseCover;
  if (/计算机网络|网络/.test(name)) return networkCourseCover;
  return linuxCourseCover;
};

const dimensionPalette = [
  "#5f8fe8",
  "#45b59f",
  "#d6a23f",
  "#7f95bf",
  "#e27b73",
  "#b89155"
];

const toPercentValue = (value?: number) => {
  if (value === undefined || value === null) return 0;
  const normalized = value <= 1 ? value * 100 : value;
  return Math.min(100, Math.max(0, Math.round(normalized)));
};

const dimensions = computed(() =>
  (profile.value?.dimensions || []).map((dimension, index) => ({
    ...dimension,
    value: toPercentValue(dimension.value ?? dimension.score),
    color: dimensionPalette[index % dimensionPalette.length]
  }))
);
const previewDimensions = computed(() => dimensions.value.slice(0, 6));
const knowledgeMap = computed(() => profile.value?.knowledge_map || []);
const tags = computed(() => profile.value?.tags || []);
const displayTags = computed(() =>
  tags.value.map(tag => ({ raw: tag, label: localizeTag(tag) }))
);
const profileMeta = computed<Partial<AssistantProfileCurrentResp>>(
  () => profile.value || {}
);
const joinedCourses = computed(() => {
  const fallbackCourse = learner.value.course
    ? [
        {
          id: props.courseId,
          name: learner.value.course,
          subtitle: "当前分析课程"
        }
      ]
    : [];
  const source = props.enrolledCourses?.length
    ? props.enrolledCourses
    : fallbackCourse;
  const seen = new Set<string>();
  return source
    .map(course => {
      const id = course.id ?? course.course_id;
      const name = course.name || course.course_name || "未命名课程";
      const key = `${id || ""}-${name}`;
      return {
        id,
        key,
        name,
        subtitle:
          course.subtitle ||
          (id === props.courseId ? "当前分析课程" : "已加入学习"),
        cover: course.thumb_url || courseCoverByName(name),
        active: id === props.courseId || name === learner.value.course
      };
    })
    .filter(course => {
      if (seen.has(course.key)) return false;
      seen.add(course.key);
      return true;
    })
    .slice(0, 3);
});
const canCreateCorrection = computed(() => !!props.targetStudentId);
const currentDimension = computed(() =>
  dimensions.value.find(
    item => (item.key || item.label) === correctionDimension.value
  )
);
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

const percentLabel = (value?: number) => {
  if (value === undefined || value === null) return "暂无";
  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.round(normalized)}%`;
};

const decisionType = (decision?: string) => {
  if (decision === "write_delta") return "success";
  if (decision === "skip") return "info";
  if (decision === "merge_without_event") return "warning";
  return "info";
};

const dimensionEvidence = (dimension: any) =>
  Array.isArray(dimension?.evidence) ? dimension.evidence : [];

const openDimensionDetail = (dimension: any) => {
  selectedDimension.value = dimension;
  dimensionDetailVisible.value = true;
};

const loadProfile = async () => {
  if (!hasRequiredContext.value) {
    profile.value = null;
    profileHistory.value = [];
    profileEvents.value = [];
    profileCorrections.value = [];
    return;
  }
  loading.value = true;
  try {
    const params = {
      course_id: props.courseId,
      target_student_id: props.targetStudentId
    };
    const [currentResult, historyResult, eventsResult, correctionsResult] =
      await Promise.allSettled([
        getAssistantProfileCurrent(params),
        listAssistantProfileHistory({ ...params, limit: 6 }),
        listAssistantProfileEvents({ ...params, limit: 8 }),
        listAssistantProfileCorrections({ ...params, limit: 6 })
      ]);
    if (currentResult.status === "fulfilled") {
      profile.value = currentResult.value?.data || null;
    } else {
      profile.value = null;
      console.warn(
        "[AiLearningProfile] 当前画像接口加载失败:",
        currentResult.reason
      );
    }
    profileHistory.value =
      historyResult.status === "fulfilled"
        ? historyResult.value?.data?.items || []
        : [];
    profileEvents.value =
      eventsResult.status === "fulfilled"
        ? eventsResult.value?.data?.items || []
        : [];
    profileCorrections.value =
      correctionsResult.status === "fulfilled"
        ? correctionsResult.value?.data?.items || []
        : [];
    if (!correctionDimension.value && profile.value?.dimensions?.length) {
      const first = profile.value.dimensions[0];
      correctionDimension.value = first.key || first.label;
      correctionValue.value = first.value || Math.round(first.score || 80);
    }
    if (profile.value) emit("profile-loaded", profile.value);
  } catch (error: any) {
    console.error("[AiLearningProfile] 学习画像加载失败:", error);
    ElMessage.error(assistantApiErrorMessage(error, "学习画像加载失败"));
  } finally {
    loading.value = false;
  }
};

const handleRefresh = async () => {
  if (!ensureCourseContext()) return;
  refreshing.value = true;
  try {
    const { data } = await refreshAssistantProfile({
      course_id: props.courseId,
      target_student_id: props.targetStudentId,
      trigger: "manual_refresh"
    });
    if (data.decision === "skip") {
      ElMessage.info(data.skip_reason || data.message || "本次画像无需更新");
    } else {
      ElMessage.success(data.message || "学习画像刷新完成");
    }
    await loadProfile();
  } catch (error: any) {
    console.error("[AiLearningProfile] 学习画像刷新失败:", error);
    ElMessage.error(assistantApiErrorMessage(error, "学习画像刷新失败"));
  } finally {
    refreshing.value = false;
  }
};

const handleSubmitCorrection = async () => {
  if (!ensureCourseContext()) return;
  if (!props.targetStudentId) {
    ElMessage.warning("请选择需要纠偏的学生");
    return;
  }
  if (!correctionDimension.value) {
    ElMessage.warning("请选择画像维度");
    return;
  }
  correctionSubmitting.value = true;
  try {
    const dimension = currentDimension.value;
    const afterJson = JSON.stringify({
      key: dimension?.key || correctionDimension.value,
      label: dimension?.label || correctionDimension.value,
      value: correctionValue.value,
      score: correctionValue.value,
      level: dimension?.level,
      evidence: ["教师纠偏"],
      updated_at: new Date().toISOString()
    });
    const { data } = await createAssistantProfileCorrection({
      course_id: props.courseId,
      target_student_id: props.targetStudentId,
      dimension_key: correctionDimension.value,
      after_json: afterJson,
      reason: correctionReason.value.trim() || "教师人工纠偏"
    });
    ElMessage.success(data.message || "画像纠偏已提交");
    correctionReason.value = "";
    await loadProfile();
  } catch (error: any) {
    console.error("[AiLearningProfile] 学习画像纠偏失败:", error);
    ElMessage.error(assistantApiErrorMessage(error, "学习画像纠偏失败"));
  } finally {
    correctionSubmitting.value = false;
  }
};

onMounted(loadProfile);
watch(() => [props.courseId, props.targetStudentId], loadProfile);
</script>

<template>
  <div
    v-loading="loading"
    class="profile-page h-full flex flex-col p-6 bg-transparent overflow-y-auto"
  >
    <div class="mb-5 flex items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <el-icon class="text-primary"><User /></el-icon>
          <h2 class="text-xl font-bold text-text_color_primary">学情分析</h2>
        </div>
      </div>
      <el-button
        type="primary"
        plain
        round
        :loading="refreshing"
        @click="handleRefresh"
      >
        <el-icon class="mr-1"><Refresh /></el-icon>
        刷新画像
      </el-button>
    </div>

    <div
      class="profile-primary-grid grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-5"
    >
      <div
        class="profile-summary bg-bg_color rounded-xl p-6 border border-gray-100 dark:border-gray-800 flex flex-col items-center"
      >
        <div
          class="relative w-24 h-24 rounded-full border border-gray-200 bg-gray-50 p-1 mb-5"
        >
          <div
            class="w-full h-full rounded-full bg-bg_color flex items-center justify-center overflow-hidden"
          >
            <el-icon :size="48" class="text-primary"><Avatar /></el-icon>
          </div>
        </div>
        <h3 class="text-lg font-semibold text-text_color_primary">
          {{ learner.name }}
        </h3>
        <p class="text-sm text-text_color_regular mt-1 mb-5">
          {{ learnerRoleLabel }}
        </p>

        <div class="w-full grid grid-cols-2 gap-3 text-center">
          <div class="rounded-lg bg-gray-50 px-3 py-3">
            <span
              class="block text-2xl font-semibold text-text_color_primary"
              >{{ learner.enroll_days }}</span
            >
            <span class="block mt-1 text-xs text-text_color_regular"
              >学习天数</span
            >
          </div>
          <div class="rounded-lg bg-gray-50 px-3 py-3">
            <span
              class="block text-2xl font-semibold text-text_color_primary"
              >{{ learner.study_minutes }}</span
            >
            <span class="block mt-1 text-xs text-text_color_regular"
              >累计分钟</span
            >
          </div>
        </div>

        <div v-if="joinedCourses.length" class="joined-courses">
          <div class="joined-courses__head">
            <span>已加入课程</span>
            <b>{{ joinedCourses.length }} 门</b>
          </div>
          <div class="joined-courses__list">
            <article
              v-for="course in joinedCourses"
              :key="course.key"
              class="joined-course"
              :class="{ 'is-active': course.active }"
            >
              <img :src="course.cover" :alt="`${course.name}课程封面`" />
              <div class="min-w-0 flex-1">
                <h4>{{ course.name }}</h4>
                <p>{{ course.subtitle }}</p>
              </div>
              <el-tag
                v-if="course.active"
                size="small"
                effect="plain"
                class="!rounded-md"
              >
                当前
              </el-tag>
            </article>
          </div>
        </div>

        <div
          v-if="displayTags.length"
          class="mt-5 flex flex-wrap justify-center gap-2"
        >
          <el-tag
            v-for="tag in displayTags.slice(0, 4)"
            :key="tag.raw"
            effect="plain"
            size="small"
          >
            {{ tag.label }}
          </el-tag>
        </div>

        <div class="mt-6 w-full space-y-2 text-xs text-text_color_regular">
          <div class="flex items-center justify-between">
            <span>画像版本</span>
            <b class="text-text_color_primary">
              v{{ profileMeta.profile_version || 0 }}
            </b>
          </div>
          <div class="flex items-center justify-between">
            <span>置信度</span>
            <b class="text-text_color_primary">
              {{ percentLabel(profileMeta.confidence) }}
            </b>
          </div>
          <div class="flex items-center justify-between">
            <span>更新决策</span>
            <el-tag
              size="small"
              effect="plain"
              :type="decisionType(profileMeta.last_update_decision)"
            >
              {{ localizeStatusText(profileMeta.last_update_decision) }}
            </el-tag>
          </div>
        </div>

        <div v-if="profileMeta.risk_flags?.length" class="mt-5 w-full">
          <div class="mb-2 text-xs font-bold text-text_color_regular">
            风险标记
          </div>
          <div class="flex flex-wrap gap-2">
            <el-tag
              v-for="flag in profileMeta.risk_flags"
              :key="flag"
              type="warning"
              effect="plain"
              size="small"
              class="!rounded-md"
            >
              {{ localizeStatusText(flag) }}
            </el-tag>
          </div>
        </div>
      </div>

      <div
        class="dimension-preview bg-bg_color rounded-xl p-6 border border-gray-100 dark:border-gray-800"
      >
        <div class="mb-5 flex items-center justify-between">
          <h4
            class="font-semibold text-text_color_primary flex items-center gap-2"
          >
            <el-icon class="text-primary"><TrendCharts /></el-icon>
            能力维度
          </h4>
          <span class="text-xs text-text_color_regular">
            {{ previewDimensions.length }} 项
          </span>
        </div>

        <div
          v-if="previewDimensions.length"
          class="grid grid-cols-1 2xl:grid-cols-2 gap-4"
        >
          <button
            v-for="dim in previewDimensions"
            :key="dim.key || dim.label"
            type="button"
            class="dimension-card"
            @click="openDimensionDetail(dim)"
            @keydown.enter.prevent="openDimensionDetail(dim)"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0 text-left">
                <div
                  class="text-base font-semibold text-text_color_primary truncate"
                >
                  {{ dim.label }}
                </div>
                <div
                  v-if="dim.level || dim.trend"
                  class="mt-1 text-sm text-text_color_regular truncate"
                >
                  {{ localizeStatusText(dim.level || dim.trend) }}
                </div>
              </div>
              <span class="dimension-value" :style="{ color: dim.color }">
                {{ dim.value }}%
              </span>
            </div>
            <el-progress
              class="dimension-progress mt-4"
              :percentage="dim.value"
              :color="dim.color"
              :stroke-width="14"
              :show-text="false"
              stroke-linecap="round"
              striped
              striped-flow
              :duration="14"
            />
            <div
              v-if="dimensionEvidence(dim).length"
              class="mt-3 flex flex-wrap gap-2"
            >
              <el-tag
                v-for="evidence in dimensionEvidence(dim).slice(0, 2)"
                :key="evidence"
                size="small"
                effect="plain"
                class="!rounded-md"
              >
                {{ localizeTag(evidence) }}
              </el-tag>
            </div>
            <div
              class="mt-4 flex items-center justify-between text-xs text-text_color_regular"
            >
              <span>{{ dim.updated_at || "暂无更新时间" }}</span>
              <span class="text-primary">查看</span>
            </div>
          </button>
        </div>
        <el-empty v-else description="暂无学习画像维度" :image-size="100" />
      </div>
    </div>

    <div
      class="profile-secondary-grid mt-6 grid grid-cols-1 xl:grid-cols-3 gap-6"
    >
      <div
        class="bg-bg_color rounded-xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm"
      >
        <h4
          class="font-bold text-text_color_primary flex items-center gap-2 mb-5"
        >
          <el-icon class="text-primary"><Clock /></el-icon>
          画像历史
        </h4>
        <el-timeline v-if="profileHistory.length">
          <el-timeline-item
            v-for="item in profileHistory"
            :key="item.profile_id"
            :timestamp="item.updated_at"
            hollow
          >
            <div class="text-sm font-bold text-text_color_primary">
              v{{ item.profile_version }}
              <span class="ml-2 text-xs font-normal text-text_color_regular">
                {{ percentLabel(item.confidence) }}
              </span>
            </div>
            <p class="mt-1 text-xs text-text_color_regular leading-relaxed">
              {{ item.summary || item.updated_reason || "画像快照已更新" }}
            </p>
            <div
              v-if="item.risk_flags?.length"
              class="mt-2 flex flex-wrap gap-1"
            >
              <el-tag
                v-for="flag in item.risk_flags"
                :key="flag"
                size="small"
                effect="plain"
                class="!rounded-md"
              >
                {{ localizeStatusText(flag) }}
              </el-tag>
            </div>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-else description="暂无历史版本" :image-size="90" />
      </div>

      <div
        class="bg-bg_color rounded-xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm"
      >
        <h4
          class="font-bold text-text_color_primary flex items-center gap-2 mb-5"
        >
          <el-icon class="text-primary"><TrendCharts /></el-icon>
          更新事件
        </h4>
        <div v-if="profileEvents.length" class="space-y-3">
          <div
            v-for="event in profileEvents"
            :key="`${event.event_source}-${event.trigger_id || event.summary}`"
            class="rounded-lg border border-gray-100 dark:border-gray-800 p-3"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-bold text-text_color_primary">
                {{ event.event_source }}
              </span>
              <el-tag
                size="small"
                effect="plain"
                :type="decisionType(event.decision)"
              >
                {{ localizeStatusText(event.decision || "unknown") }}
              </el-tag>
            </div>
            <p class="mt-2 text-xs text-text_color_regular leading-relaxed">
              {{ event.summary || event.skip_reason || "画像事件已记录" }}
            </p>
            <div
              v-if="event.changed_dimensions?.length"
              class="mt-2 flex flex-wrap gap-1"
            >
              <el-tag
                v-for="dimension in event.changed_dimensions"
                :key="dimension"
                size="small"
                type="success"
                effect="plain"
                class="!rounded-md"
              >
                {{ localizeStatusText(dimension) }}
              </el-tag>
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无画像事件" :image-size="90" />
      </div>

      <div
        class="bg-bg_color rounded-xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm"
      >
        <h4
          class="font-bold text-text_color_primary flex items-center gap-2 mb-5"
        >
          <el-icon class="text-primary"><EditPen /></el-icon>
          教师纠偏
        </h4>
        <div v-if="canCreateCorrection" class="space-y-3">
          <el-select
            v-model="correctionDimension"
            class="w-full"
            placeholder="选择画像维度"
          >
            <el-option
              v-for="dim in dimensions"
              :key="dim.key || dim.label"
              :label="dim.label"
              :value="dim.key || dim.label"
            />
          </el-select>
          <div>
            <div class="mb-2 text-xs text-text_color_regular">
              调整分值：{{ correctionValue }}
            </div>
            <el-slider v-model="correctionValue" :min="0" :max="100" />
          </div>
          <el-input
            v-model="correctionReason"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="填写纠偏原因"
          />
          <el-button
            type="primary"
            class="w-full"
            :loading="correctionSubmitting"
            @click="handleSubmitCorrection"
          >
            提交纠偏
          </el-button>
        </div>
        <el-alert
          v-else
          type="info"
          show-icon
          :closable="false"
          title="学生本人可查看纠偏记录；教师/管理员选择学生后可提交纠偏。"
        />

        <div class="mt-5 space-y-2">
          <div
            v-for="item in profileCorrections"
            :key="item.correction_id"
            class="rounded-lg bg-gray-50/70 dark:bg-gray-800/30 px-3 py-2 text-xs"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-text_color_primary">
                {{ item.dimension_key }}
              </span>
              <el-tag size="small" effect="plain">{{ item.status }}</el-tag>
            </div>
            <p class="mt-1 text-text_color_regular line-clamp-2">
              {{ item.reason || "暂无原因" }}
            </p>
            <div class="mt-1 text-text_color_regular opacity-60">
              {{ item.operator_role }} · {{ item.created_at }}
            </div>
          </div>
          <el-empty
            v-if="!profileCorrections.length"
            description="暂无纠偏记录"
            :image-size="80"
          />
        </div>
      </div>
    </div>

    <div
      class="mt-6 bg-bg_color rounded-xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all"
    >
      <div class="flex items-center justify-between mb-8">
        <h4 class="font-bold text-text_color_primary flex items-center gap-2">
          <el-icon class="text-primary"><Reading /></el-icon>
          知识图谱掌握度
        </h4>
        <span class="text-xs text-text_color_regular opacity-60 italic">{{
          learner.course || "当前课程"
        }}</span>
      </div>

      <div
        v-if="knowledgeMap.length"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-x-12 gap-y-6"
      >
        <div
          v-for="node in knowledgeMap"
          :key="node.label"
          class="flex items-center gap-4 group"
        >
          <span
            class="w-48 flex-shrink-0 text-sm text-text_color_regular truncate group-hover:text-primary transition-colors"
            >{{ node.label }}</span
          >
          <el-progress
            class="flex-1"
            :percentage="node.mastery"
            :stroke-width="10"
            :color="
              node.mastery >= 80
                ? '#10b981'
                : node.mastery >= 60
                  ? '#3b82f6'
                  : node.mastery >= 40
                    ? '#f59e0b'
                    : '#ef4444'
            "
            stroke-linecap="round"
          />
          <span
            class="text-xs font-mono text-text_color_regular w-8 text-right"
            >{{ node.mastery }}</span
          >
        </div>
      </div>
      <el-empty v-else description="暂无知识图谱数据" :image-size="100" />

      <div
        v-if="profile?.message"
        class="mt-8 p-4 bg-primary/5 rounded-xl border border-primary/10 flex items-center gap-3 text-xs text-text_color_regular"
      >
        <el-icon color="var(--el-color-primary)" :size="20"
          ><VideoPlay
        /></el-icon>
        <div class="flex-1">
          <span class="font-bold text-text_color_primary">画像状态：</span>
          {{ profile.message }}
        </div>
      </div>
    </div>

    <el-dialog
      v-model="dimensionDetailVisible"
      width="min(560px, calc(100vw - 24px))"
      class="profile-dimension-dialog"
      destroy-on-close
    >
      <template #header>
        <div v-if="selectedDimension" class="pr-8">
          <div class="text-base font-semibold text-text_color_primary">
            {{ selectedDimension.label }}
          </div>
          <div class="mt-2 flex items-center gap-2">
            <el-tag effect="plain">{{ selectedDimension.value }}%</el-tag>
            <el-tag v-if="selectedDimension.level" effect="plain">
              {{ localizeStatusText(selectedDimension.level) }}
            </el-tag>
            <el-tag v-if="selectedDimension.trend" effect="plain">
              {{ localizeStatusText(selectedDimension.trend) }}
            </el-tag>
          </div>
        </div>
      </template>

      <div v-if="selectedDimension" class="space-y-5">
        <el-progress
          class="dimension-progress"
          :percentage="selectedDimension.value"
          :color="selectedDimension.color"
          :stroke-width="16"
          :show-text="false"
          stroke-linecap="round"
          striped
          striped-flow
          :duration="14"
        />
        <div
          v-if="selectedDimension.description"
          class="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm leading-7 text-text_color_regular"
        >
          {{ selectedDimension.description }}
        </div>
        <div v-if="dimensionEvidence(selectedDimension).length">
          <div class="mb-2 text-sm font-medium text-text_color_primary">
            依据
          </div>
          <div class="flex flex-wrap gap-2">
            <el-tag
              v-for="evidence in dimensionEvidence(selectedDimension)"
              :key="evidence"
              effect="plain"
            >
              {{ localizeTag(evidence) }}
            </el-tag>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div class="rounded-lg bg-gray-50 px-4 py-3">
            <div class="text-text_color_regular">维度键</div>
            <div class="mt-1 font-medium text-text_color_primary break-all">
              {{ selectedDimension.key || selectedDimension.label }}
            </div>
          </div>
          <div class="rounded-lg bg-gray-50 px-4 py-3">
            <div class="text-text_color_regular">更新时间</div>
            <div class="mt-1 font-medium text-text_color_primary">
              {{ selectedDimension.updated_at || "暂无" }}
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.profile-page {
  --profile-border: #edf0f5;
}

.profile-page > * {
  flex-shrink: 0;
}

.profile-summary,
.dimension-preview {
  box-shadow: none;
}

.joined-courses {
  width: 100%;
  margin-top: 18px;
}

.joined-courses__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 12px;
  color: var(--el-text-color-regular);

  span {
    font-weight: 700;
    color: var(--el-text-color-primary);
  }

  b {
    font-weight: 700;
    color: var(--el-color-primary);
  }
}

.joined-courses__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.joined-course {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px;
  border: 1px solid var(--profile-border);
  border-radius: 12px;
  background: #fbfcff;
  text-align: left;

  &.is-active {
    border-color: rgb(95 143 232 / 38%);
    background: rgb(95 143 232 / 7%);
  }

  img {
    width: 48px;
    height: 48px;
    flex: 0 0 auto;
    border-radius: 10px;
    object-fit: cover;
  }

  h4 {
    margin: 0;
    overflow: hidden;
    color: var(--el-text-color-primary);
    font-size: 13px;
    font-weight: 700;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  p {
    margin: 4px 0 0;
    overflow: hidden;
    color: var(--el-text-color-regular);
    font-size: 12px;
    line-height: 1.3;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.dimension-card {
  width: 100%;
  min-height: 150px;
  padding: 18px;
  text-align: left;
  cursor: pointer;
  background: var(--el-bg-color);
  border: 1px solid var(--profile-border);
  border-radius: 12px;
  outline: none;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease;

  &:hover,
  &:focus-visible {
    background: #fafbfc;
    border-color: #cfd7e3;
  }
}

.dimension-value {
  flex: 0 0 auto;
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.dimension-progress {
  :deep(.el-progress-bar__outer) {
    background-color: #eef1f5;
  }

  :deep(.el-progress-bar__inner) {
    transition: width 0.55s ease;
  }
}

.profile-dimension-dialog {
  :deep(.el-dialog__body) {
    padding-top: 8px;
  }
}

@media (width <= 768px) {
  .profile-page {
    padding: 8px !important;
  }

  .profile-summary,
  .dimension-preview,
  .profile-page > .mt-6 > div,
  .profile-page > .mt-6.bg-bg_color {
    padding: 14px !important;
  }

  .profile-page > .mb-5 {
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 14px;
  }

  .profile-page > .mb-5 :deep(.el-button) {
    min-height: 44px;
    flex: 0 0 auto;
  }

  .profile-primary-grid,
  .profile-secondary-grid {
    display: flex !important;
    flex-direction: column !important;
    gap: 12px;
  }

  .profile-primary-grid > *,
  .profile-secondary-grid > * {
    flex: 0 0 auto !important;
    min-height: max-content;
  }

  .dimension-card {
    padding: 14px !important;
  }
}
</style>
