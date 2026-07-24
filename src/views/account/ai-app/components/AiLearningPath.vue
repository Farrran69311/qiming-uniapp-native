<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { Check, RefreshRight, MagicStick } from "@element-plus/icons-vue";
import {
  assistantApiErrorMessage,
  applyAssistantPathAction,
  completeAssistantPathNode,
  completeAssistantPathPushTask,
  generateAssistantPath,
  getAssistantCurrentPath,
  listAssistantPathActions,
  listAssistantPathHistory,
  listAssistantPathPushTasks,
  replanAssistantPath,
  type AssistantPathActionItem,
  type AssistantPathHistoryItem,
  type AssistantPathPushTaskItem,
  type AssistantPathRoadmap
} from "@/api/frontend/assistant";

const props = defineProps<{
  courseId?: number;
  targetStudentId?: number;
  requiresTargetStudent?: boolean;
}>();

const loading = ref(false);
const actionLoading = ref(false);
const status = ref("");
const statusMessage = ref("");
const path = ref<AssistantPathRoadmap | null>(null);
const pathActions = ref<AssistantPathActionItem[]>([]);
const pathHistory = ref<AssistantPathHistoryItem[]>([]);
const pushTasks = ref<AssistantPathPushTaskItem[]>([]);

const courseMeta = computed(() => path.value?.course_meta);
const roadmapData = computed(() => path.value?.roadmap || []);
const hasPath = computed(() => !!path.value && roadmapData.value.length > 0);
const pendingActions = computed(() =>
  pathActions.value.filter(item => item.status !== "applied")
);
const totalNodes = computed(() =>
  roadmapData.value.reduce((total, phase) => total + phase.nodes.length, 0)
);
const completedNodes = computed(() =>
  roadmapData.value.reduce(
    (total, phase) => total + phase.nodes.filter(node => node.done).length,
    0
  )
);
const completionPercent = computed(() =>
  totalNodes.value
    ? Math.round((completedNodes.value / totalNodes.value) * 100)
    : 0
);
const activePhase = computed(
  () =>
    roadmapData.value.find(phase => phase.status === "active") ||
    roadmapData.value[0]
);
const estimatedMinutes = computed(() =>
  roadmapData.value.reduce(
    (total, phase) =>
      total +
      phase.nodes.reduce(
        (phaseTotal, node) => phaseTotal + Number(node.estimated_minutes || 0),
        0
      ),
    0
  )
);
const pathSummary = computed(
  () => path.value?.summary || path.value?.goal || ""
);
const contextWarning = computed(() => {
  if (!props.courseId) return "请先选择课程";
  if (props.requiresTargetStudent && !props.targetStudentId) {
    return "请先选择学生";
  }
  return "";
});
const hasRequiredContext = computed(() => !contextWarning.value);
const visibleStatusMessage = computed(() =>
  String(statusMessage.value || "")
    .replace(/，?请调用\s*\/assistant\/path\/generate。?/g, "")
    .trim()
);

const statusTextMap: Record<string, string> = {
  completed: "已完成",
  done: "已完成",
  active: "进行中",
  pending: "待开始",
  applied: "已应用",
  pending_apply: "待应用",
  preview: "预览",
  draft: "草稿",
  generated: "已生成",
  failed: "失败",
  blocked: "已阻断"
};

const nodeTypeTextMap: Record<string, string> = {
  explanation: "讲解",
  exercise: "练习",
  reading: "阅读",
  review: "复习",
  quiz: "测验",
  resource: "资源",
  video: "视频",
  practice: "实践",
  project: "项目"
};

const ruleTypeTextMap: Record<string, string> = {
  resource_complete: "完成资源",
  quiz_score: "测验达标",
  evidence_required: "提交证明",
  manual: "手动确认"
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

const statusText = (value?: string) => textOf(statusTextMap, value);
const nodeTypeText = (value?: string) => textOf(nodeTypeTextMap, value);
const ruleTypeText = (value?: string) => textOf(ruleTypeTextMap, value);

const tagType = (value?: string) => {
  const normalized = String(value || "").toLowerCase();
  if (
    ["completed", "done", "applied", "active", "generated"].includes(normalized)
  )
    return "success";
  if (["pending", "pending_apply", "preview", "draft"].includes(normalized))
    return "warning";
  if (["failed", "blocked"].includes(normalized)) return "danger";
  return "info";
};

const formatMinutes = (minutes?: number) => {
  const value = Number(minutes || 0);
  if (!value) return "";
  if (value < 60) return `${value} 分钟`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
};

const nodeMeta = (
  node: AssistantPathRoadmap["roadmap"][number]["nodes"][number]
) =>
  [
    node.knowledge_point_id,
    formatMinutes(node.estimated_minutes),
    node.status ? statusText(node.status) : "",
    node.video_segment_refs?.length
      ? `视频 ${node.video_segment_refs.length}`
      : ""
  ].filter(Boolean);

const nodeNote = (
  node: AssistantPathRoadmap["roadmap"][number]["nodes"][number]
) =>
  node.status_reason ||
  (node.completion_rule?.type
    ? `完成规则：${ruleTypeText(node.completion_rule.type)}`
    : "") ||
  (node.due_at ? `截止：${node.due_at}` : "");

const ensureCourseContext = () => {
  if (hasRequiredContext.value) return true;
  ElMessage.warning(contextWarning.value || "请先选择课程");
  return false;
};

const loadPath = async () => {
  if (!hasRequiredContext.value) {
    path.value = null;
    pathActions.value = [];
    pathHistory.value = [];
    pushTasks.value = [];
    status.value = "";
    statusMessage.value = contextWarning.value || "请先选择课程";
    return;
  }
  loading.value = true;
  try {
    const params = {
      course_id: props.courseId,
      target_student_id: props.targetStudentId
    };
    const [currentResult, actionsResult, historyResult, pushResult] =
      await Promise.allSettled([
        getAssistantCurrentPath(params),
        listAssistantPathActions(params),
        listAssistantPathHistory(params),
        listAssistantPathPushTasks(params)
      ]);
    const currentData =
      currentResult.status === "fulfilled"
        ? currentResult.value?.data
        : undefined;
    path.value = currentData?.path || null;
    status.value = currentData?.status || "";
    statusMessage.value = currentData?.message || "";
    pathActions.value =
      actionsResult.status === "fulfilled"
        ? actionsResult.value?.data?.list || []
        : [];
    pathHistory.value =
      historyResult.status === "fulfilled"
        ? historyResult.value?.data?.list || []
        : [];
    pushTasks.value =
      pushResult.status === "fulfilled"
        ? pushResult.value?.data?.list || []
        : [];
    if (
      currentResult.status === "rejected" ||
      actionsResult.status === "rejected" ||
      historyResult.status === "rejected" ||
      pushResult.status === "rejected"
    ) {
      console.warn("[AiLearningPath] 部分学习路径接口加载失败", {
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
        pushError:
          pushResult.status === "rejected" ? pushResult.reason : undefined
      });
    }
  } catch (error: any) {
    console.error("[AiLearningPath] 学习路径加载失败:", error);
    ElMessage.error(assistantApiErrorMessage(error, "学习路径加载失败"));
  } finally {
    loading.value = false;
  }
};

const handleGenerate = async () => {
  if (!ensureCourseContext()) return;
  actionLoading.value = true;
  try {
    const { data } = await generateAssistantPath({
      course_id: props.courseId,
      target_student_id: props.targetStudentId,
      goal: "基于当前画像生成个性化学习路径"
    });
    if (data.path) path.value = data.path;
    status.value = data.status;
    statusMessage.value = data.message || "";
    ElMessage.success(data.message || "学习路径已生成");
    await loadPath();
  } catch (error: any) {
    console.error("[AiLearningPath] 学习路径生成失败:", error);
    ElMessage.error(assistantApiErrorMessage(error, "学习路径生成失败"));
  } finally {
    actionLoading.value = false;
  }
};

const handleReplan = async () => {
  if (!ensureCourseContext()) return;
  actionLoading.value = true;
  try {
    const { data } = await replanAssistantPath({
      course_id: props.courseId,
      target_student_id: props.targetStudentId,
      reason: "frontend_manual_replan",
      apply_immediately: false
    });
    status.value = data.status;
    statusMessage.value = data.message || "";
    ElMessage.success(data.message || "已生成重规划预览，确认后可应用");
    await loadPath();
  } catch (error: any) {
    console.error("[AiLearningPath] 学习路径重规划失败:", error);
    ElMessage.error(assistantApiErrorMessage(error, "学习路径重规划失败"));
  } finally {
    actionLoading.value = false;
  }
};

const handleApplyAction = async (actionId: string) => {
  if (!ensureCourseContext()) return;
  actionLoading.value = true;
  try {
    const { data } = await applyAssistantPathAction(actionId);
    if (data.path) path.value = data.path;
    ElMessage.success(data.message || "重规划预览已应用");
    await loadPath();
  } catch (error: any) {
    console.error("[AiLearningPath] 应用路径动作失败:", error);
    ElMessage.error(assistantApiErrorMessage(error, "应用路径动作失败"));
  } finally {
    actionLoading.value = false;
  }
};

const handleCompletePushTask = async (pushId: string) => {
  if (!ensureCourseContext()) return;
  actionLoading.value = true;
  try {
    const { data } = await completeAssistantPathPushTask(pushId);
    ElMessage.success(data.message || "推送任务已完成");
    await loadPath();
  } catch (error: any) {
    console.error("[AiLearningPath] 完成推送任务失败:", error);
    ElMessage.error(assistantApiErrorMessage(error, "完成推送任务失败"));
  } finally {
    actionLoading.value = false;
  }
};

const handleComplete = async (nodeId: string) => {
  if (!ensureCourseContext()) return;
  actionLoading.value = true;
  try {
    const { data } = await completeAssistantPathNode(nodeId, {
      course_id: props.courseId,
      target_student_id: props.targetStudentId,
      completion_evidence: "前端标记完成"
    });
    ElMessage.success(data.message || "节点已完成");
    await loadPath();
  } catch (error: any) {
    console.error("[AiLearningPath] 完成路径节点失败:", error);
    ElMessage.error(assistantApiErrorMessage(error, "完成路径节点失败"));
  } finally {
    actionLoading.value = false;
  }
};

onMounted(loadPath);
watch(() => [props.courseId, props.targetStudentId], loadPath);
</script>

<template>
  <div
    v-loading="loading"
    class="learning-path-page h-full flex flex-col bg-transparent overflow-y-auto custom-scrollbar"
  >
    <div class="path-toolbar">
      <div class="path-toolbar__title">
        <div class="eyebrow">学习计划</div>
        <h2>个性化路径规划</h2>
      </div>
      <div class="path-toolbar__actions">
        <el-button
          plain
          :loading="actionLoading"
          :disabled="!hasPath"
          @click="handleReplan"
        >
          <template #icon>
            <el-icon><RefreshRight /></el-icon>
          </template>
          重规划
        </el-button>
        <el-button
          type="primary"
          :loading="actionLoading"
          @click="handleGenerate"
        >
          <template #icon>
            <el-icon><MagicStick /></el-icon>
          </template>
          生成路径
        </el-button>
      </div>
    </div>

    <section v-if="courseMeta" class="path-summary-panel">
      <div class="course-block">
        <div class="course-title-row">
          <h3>{{ courseMeta.name }}</h3>
          <el-tag
            v-if="courseMeta.subtitle || status"
            size="small"
            effect="plain"
          >
            {{ courseMeta.subtitle || statusText(status) }}
          </el-tag>
          <el-tag
            v-if="path?.apply_status"
            size="small"
            :type="tagType(path.apply_status)"
            effect="plain"
          >
            {{ statusText(path.apply_status) }}
          </el-tag>
        </div>
        <p v-if="pathSummary" class="course-summary">{{ pathSummary }}</p>
      </div>

      <div class="summary-grid">
        <div class="summary-item">
          <span>当前阶段</span>
          <b>{{ activePhase?.title || courseMeta.current_phase }}</b>
        </div>
        <div class="summary-item">
          <span>完成进度</span>
          <b>{{ completedNodes }} / {{ totalNodes }}</b>
        </div>
        <div class="summary-item">
          <span>预计投入</span>
          <b>{{
            formatMinutes(estimatedMinutes) ||
            courseMeta.estimated_hours + " 学时"
          }}</b>
        </div>
        <div class="summary-item">
          <span>路径版本</span>
          <b>{{ path?.path_version ? `v${path.path_version}` : "暂无" }}</b>
        </div>
      </div>

      <el-progress
        class="path-progress"
        :percentage="completionPercent"
        :stroke-width="12"
        striped
        striped-flow
        :duration="14"
      />
    </section>

    <section v-if="pendingActions.length" class="path-notice-panel">
      <div class="notice-head">
        <span>待应用重规划</span>
        <div class="notice-actions">
          <el-button
            v-for="action in pendingActions"
            :key="action.action_id"
            type="warning"
            plain
            size="small"
            :loading="actionLoading"
            @click="handleApplyAction(action.action_id)"
          >
            应用{{
              action.action_type ? ` ${statusText(action.action_type)}` : ""
            }}
          </el-button>
        </div>
      </div>
      <div class="notice-list">
        <p
          v-for="action in pendingActions"
          :key="`${action.action_id}-summary`"
        >
          {{ action.reason || action.path?.summary || "重规划预览待确认" }}
        </p>
      </div>
    </section>

    <section v-if="path?.natural_plan" class="natural-plan-panel">
      <div class="panel-heading">规划说明</div>
      <pre>{{ path.natural_plan }}</pre>
    </section>

    <section v-if="hasPath" class="roadmap-board">
      <article
        v-for="(phase, index) in roadmapData"
        :key="phase.title"
        class="phase-panel"
        :class="`is-${phase.status || 'pending'}`"
      >
        <div class="phase-head">
          <div class="phase-index">
            {{ String(index + 1).padStart(2, "0") }}
          </div>
          <div class="phase-title">
            <div class="phase-title-row">
              <h3>{{ phase.title }}</h3>
              <el-tag size="small" :type="tagType(phase.status)" effect="plain">
                {{ statusText(phase.status) }}
              </el-tag>
            </div>
            <p v-if="phase.summary">{{ phase.summary }}</p>
          </div>
        </div>

        <div class="node-grid">
          <article
            v-for="node in phase.nodes"
            :key="node.node_id"
            class="node-card"
            :class="{ 'is-current': node.current, 'is-done': node.done }"
          >
            <div class="node-card__head">
              <div class="node-status">
                <el-icon v-if="node.done"><Check /></el-icon>
                <span v-else>{{ node.current ? "进行" : "待办" }}</span>
              </div>
              <el-tag size="small" effect="plain">
                {{ nodeTypeText(node.type) }}
              </el-tag>
            </div>
            <h4>{{ node.name }}</h4>
            <p v-if="node.reason" class="node-reason">{{ node.reason }}</p>
            <div v-if="nodeMeta(node).length" class="node-meta">
              <span v-for="meta in nodeMeta(node)" :key="meta">{{ meta }}</span>
            </div>
            <p v-if="node.resource_id" class="node-resource">
              资源：{{ node.resource_id }}
            </p>
            <p v-if="nodeNote(node)" class="node-note">{{ nodeNote(node) }}</p>
            <div class="node-actions">
              <el-button
                v-if="!node.done"
                size="small"
                plain
                type="primary"
                :loading="actionLoading"
                @click="handleComplete(node.node_id)"
              >
                标记完成
              </el-button>
            </div>
          </article>
        </div>
      </article>
    </section>

    <section v-else class="path-empty-panel">
      <el-empty
        :description="visibleStatusMessage || '当前课程还没有学习路径'"
        :image-size="110"
      />
      <el-button
        type="primary"
        :loading="actionLoading"
        @click="handleGenerate"
      >
        <template #icon>
          <el-icon><MagicStick /></el-icon>
        </template>
        生成路径
      </el-button>
    </section>

    <section class="path-secondary-grid">
      <article class="secondary-panel">
        <div class="panel-heading">路径推送任务</div>
        <div v-if="pushTasks.length" class="task-list">
          <div v-for="task in pushTasks" :key="task.push_id" class="task-row">
            <div>
              <div class="task-title">{{ task.title }}</div>
              <p v-if="task.summary || task.reason">
                {{ task.summary || task.reason }}
              </p>
              <span>{{ task.scheduled_at || task.created_at || "" }}</span>
            </div>
            <div class="task-row__side">
              <el-tag size="small" :type="tagType(task.status)" effect="plain">
                {{ statusText(task.status) }}
              </el-tag>
              <el-button
                v-if="task.status !== 'completed'"
                size="small"
                link
                type="primary"
                :loading="actionLoading"
                @click="handleCompletePushTask(task.push_id)"
              >
                标记完成
              </el-button>
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无推送任务" :image-size="80" />
      </article>

      <article class="secondary-panel">
        <div class="panel-heading">路径版本历史</div>
        <el-timeline v-if="pathHistory.length" class="history-timeline">
          <el-timeline-item
            v-for="item in pathHistory"
            :key="item.path_id"
            :timestamp="item.updated_at || item.created_at"
            hollow
          >
            <div class="history-title">
              <span>v{{ item.path_version }}</span>
              <el-tag size="small" :type="tagType(item.status)" effect="plain">
                {{ statusText(item.status) }}
              </el-tag>
              <el-tag
                size="small"
                :type="tagType(item.apply_status)"
                effect="plain"
              >
                {{ statusText(item.apply_status) }}
              </el-tag>
            </div>
            <p>{{ item.summary || item.goal || "路径版本已记录" }}</p>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-else description="暂无路径历史" :image-size="80" />
      </article>
    </section>
  </div>
</template>

<style scoped lang="scss">
.learning-path-page {
  gap: 16px;
  padding: 0;
  color: #303847;
}

.learning-path-page > * {
  flex-shrink: 0;
}

.path-toolbar,
.path-summary-panel,
.path-notice-panel,
.natural-plan-panel,
.phase-panel,
.path-empty-panel,
.secondary-panel {
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(224, 233, 247, 0.88);
  border-radius: 18px;
  box-shadow:
    0 12px 30px rgba(38, 54, 78, 0.055),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(16px);
}

.path-toolbar {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  min-height: 64px;
  padding: 12px 16px;
}

.path-toolbar__title h2 {
  margin: 2px 0 0;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.25;
  color: #273142;
}

.eyebrow {
  font-size: 12px;
  font-weight: 600;
  color: #6d7a8d;
}

.path-toolbar__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.path-toolbar :deep(.el-button) {
  border-radius: 10px;
}

.path-summary-panel {
  display: grid;
  grid-template-columns: minmax(260px, 1.4fr) minmax(420px, 2fr);
  gap: 18px;
  padding: 18px;
}

.course-title-row,
.phase-title-row,
.notice-head,
.history-title {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.course-title-row h3,
.phase-title-row h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.35;
  color: #273142;
}

.course-block {
  min-width: 0;
}

.course-title-row :deep(.el-tag),
.course-title-row :deep(.el-tag__content) {
  max-width: 100%;
  height: auto;
  white-space: normal;
  overflow-wrap: anywhere;
}

.course-title-row :deep(.el-tag) {
  min-height: 24px;
  padding-block: 3px;
  line-height: 1.45;
}

.course-summary,
.phase-title p,
.node-reason,
.node-note,
.task-row p,
.history-timeline p,
.notice-list p {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.8;
  color: #637083;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.summary-item {
  min-width: 0;
  padding: 12px;
  background: rgba(247, 250, 253, 0.9);
  border: 1px solid rgba(229, 236, 247, 0.86);
  border-radius: 14px;
}

.summary-item span {
  display: block;
  font-size: 12px;
  color: #8490a2;
}

.summary-item b {
  display: block;
  margin-top: 6px;
  overflow: hidden;
  font-size: 15px;
  font-weight: 700;
  color: #303847;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.path-progress {
  grid-column: 1 / -1;
}

.path-progress :deep(.el-progress-bar__outer) {
  background: #edf2f8;
}

.path-notice-panel,
.natural-plan-panel,
.path-empty-panel,
.secondary-panel {
  padding: 16px;
}

.notice-head {
  justify-content: space-between;
  font-weight: 700;
  color: #875b1a;
}

.notice-list {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}

.notice-list p {
  padding: 10px 12px;
  background: rgba(255, 250, 238, 0.88);
  border: 1px solid #f3dfb7;
  border-radius: 12px;
  color: #8a6427;
}

.panel-heading {
  margin-bottom: 12px;
  font-size: 15px;
  font-weight: 700;
  color: #303847;
}

.natural-plan-panel pre {
  margin: 0;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.85;
  color: #586579;
  white-space: pre-wrap;
  word-break: break-word;
}

.roadmap-board {
  display: grid;
  gap: 14px;
}

.phase-panel {
  padding: 18px;
}

.phase-head {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  margin-bottom: 16px;
}

.phase-index {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  font-size: 13px;
  font-weight: 700;
  color: #5f8fe8;
  background: #eef5ff;
  border: 1px solid #dbe8ff;
  border-radius: 10px;
}

.node-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}

.node-card {
  display: flex;
  min-height: 190px;
  padding: 14px;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(225, 233, 245, 0.9);
  border-radius: 14px;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background-color 0.18s ease;
}

.node-card:hover,
.node-card.is-current {
  background: #fff;
  border-color: #9cbcf3;
  box-shadow: 0 10px 24px rgba(72, 110, 166, 0.08);
}

.node-card.is-done {
  border-color: rgba(116, 190, 136, 0.45);
}

.node-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.node-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 24px;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: #5f8fe8;
  background: #eef5ff;
  border-radius: 8px;
}

.node-card.is-done .node-status {
  color: #3f9b67;
  background: #edf8f2;
}

.node-card h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.45;
  color: #273142;
}

.node-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.node-meta span {
  padding: 4px 8px;
  font-size: 12px;
  line-height: 1.4;
  color: #637083;
  background: #f5f8fc;
  border-radius: 8px;
}

.node-resource {
  margin: 10px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: #5f8fe8;
  word-break: break-word;
}

.node-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: auto;
  padding-top: 12px;
}

.node-actions :deep(.el-button) {
  border-radius: 9px;
}

.path-secondary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  padding-bottom: 16px;
}

.task-list {
  display: grid;
  gap: 10px;
}

.task-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  padding: 12px;
  background: rgba(247, 250, 253, 0.9);
  border: 1px solid rgba(229, 236, 247, 0.86);
  border-radius: 12px;
}

.task-title {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
  color: #303847;
}

.task-row span {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: #8a95a6;
}

.task-row__side {
  display: flex;
  align-items: flex-end;
  flex-direction: column;
  gap: 8px;
}

.history-title span {
  font-size: 14px;
  font-weight: 700;
  color: #303847;
}

.history-timeline {
  padding-top: 4px;
}

@media (max-width: 1180px) {
  .path-summary-panel,
  .path-secondary-grid {
    grid-template-columns: 1fr;
  }

  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .learning-path-page {
    padding: 0;
  }

  .path-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .course-title-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .summary-grid,
  .node-grid {
    grid-template-columns: 1fr;
  }

  .task-row {
    grid-template-columns: 1fr;
  }

  .task-row__side {
    align-items: flex-start;
  }
}
</style>
