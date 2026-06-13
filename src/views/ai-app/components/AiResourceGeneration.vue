<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import {
  Document,
  VideoPlay,
  Monitor,
  Search,
  MagicStick,
  Refresh,
  Download,
  View,
  CircleCheck,
  ChatDotRound
} from "@element-plus/icons-vue";
import {
  createAssistantResourceTask,
  listAssistantResourceTaskLogs,
  listAssistantResourceTasks,
  listAssistantResources,
  reportAssistantResourceUsage,
  type AssistantResourceSummary,
  type AssistantResourceTaskItem,
  type AssistantResourceTaskLogItem,
  type AssistantResourceUsageEventType
} from "@/api/frontend/assistant";

const props = defineProps<{
  courseId?: number;
  targetStudentId?: number;
}>();

const loading = ref(false);
const creating = ref(false);
const searchQuery = ref("");
const resourceType = ref("");
const tasks = ref<AssistantResourceTaskItem[]>([]);
const resources = ref<AssistantResourceSummary[]>([]);
const selectedTaskId = ref("");
const taskLogs = ref<AssistantResourceTaskLogItem[]>([]);
const detailVisible = ref(false);
const selectedResource = ref<AssistantResourceSummary | null>(null);
const resourceOpenedAt = ref(0);
const resourceFeedbackScore = ref(5);
const resourceFeedbackText = ref("");
const feedbackSubmitting = ref(false);
const completeSubmitting = ref(false);

const filteredResources = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase();
  return resources.value.filter(resource => {
    const matchesKeyword =
      !keyword ||
      resource.title.toLowerCase().includes(keyword) ||
      resource.summary?.toLowerCase().includes(keyword) ||
      resource.recommendation?.toLowerCase().includes(keyword);
    const matchesType =
      !resourceType.value || resource.resource_type === resourceType.value;
    return matchesKeyword && matchesType;
  });
});

const resourceTypeOptions = computed(() =>
  Array.from(new Set(resources.value.map(item => item.resource_type))).filter(
    Boolean
  )
);

const resourceIcon = (type: string) => {
  if (type.includes("video") || type.includes("animation")) return VideoPlay;
  if (type.includes("code") || type.includes("html")) return Monitor;
  return Document;
};

const tagType = (status: string) => {
  if (status === "completed" || status === "ready") return "success";
  if (status === "failed") return "danger";
  return "warning";
};

const qualityLabel = (score?: number) => {
  if (score === undefined || score === null) return "";
  const normalized = score <= 1 ? score * 100 : score;
  return `${Math.round(normalized)}%`;
};

const hasInlinePreview = (resource?: AssistantResourceSummary | null) =>
  !!resource?.content_body && !resource.preview_url;

const reportResourceUsage = async (
  resource: AssistantResourceSummary,
  eventType: AssistantResourceUsageEventType,
  extra: Record<string, any> = {}
) => {
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

const loadResources = async () => {
  loading.value = true;
  try {
    const [taskResp, resourceResp] = await Promise.all([
      listAssistantResourceTasks({
        course_id: props.courseId,
        target_student_id: props.targetStudentId
      }),
      listAssistantResources({
        course_id: props.courseId,
        target_student_id: props.targetStudentId
      })
    ]);
    tasks.value = taskResp.data.list || [];
    resources.value = resourceResp.data.list || [];
  } catch (error: any) {
    console.error("[AiResourceGeneration] 学习资源加载失败:", error);
    ElMessage.error(error?.message || "学习资源加载失败");
  } finally {
    loading.value = false;
  }
};

const loadTaskLogs = async (taskId: string) => {
  selectedTaskId.value = taskId;
  try {
    const { data } = await listAssistantResourceTaskLogs(taskId);
    taskLogs.value = data.list || [];
  } catch (error: any) {
    console.error("[AiResourceGeneration] 任务日志加载失败:", error);
    ElMessage.error(error?.message || "任务日志加载失败");
  }
};

const handleCreateTask = async () => {
  creating.value = true;
  try {
    const { data } = await createAssistantResourceTask({
      course_id: props.courseId,
      target_student_id: props.targetStudentId,
      resource_types: [
        "explanation_doc",
        "mind_map",
        "exercise_set",
        "extended_reading",
        "html_animation",
        "coding_practice_case"
      ],
      prompt: "请围绕当前课程薄弱点生成一组个性化学习资源"
    });
    ElMessage.success(data.message || "资源生成任务已创建");
    await loadResources();
    if (data.task?.task_id) await loadTaskLogs(data.task.task_id);
  } catch (error: any) {
    console.error("[AiResourceGeneration] 创建资源任务失败:", error);
    ElMessage.error(error?.message || "创建资源任务失败");
  } finally {
    creating.value = false;
  }
};

const openResourceDetail = (resource: AssistantResourceSummary) => {
  selectedResource.value = resource;
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

const openUrl = (url?: string, resource?: AssistantResourceSummary) => {
  if (!url) {
    ElMessage.warning("当前资源暂无可访问链接");
    return;
  }
  if (resource) {
    void reportResourceUsage(resource, "view", {
      metadata: { target: url }
    });
  }
  window.open(url, "_blank");
};

const handleCompleteResource = async () => {
  if (!selectedResource.value) return;
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

onMounted(loadResources);
watch(() => [props.courseId, props.targetStudentId], loadResources);
</script>

<template>
  <div
    v-loading="loading"
    class="ai-resource-generation-panel h-full flex flex-col p-6 bg-gray-50/30 overflow-hidden"
  >
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-bold text-gray-800">资源生成工作台</h2>
        <p class="text-sm text-gray-500 mt-1">
          根据学习画像自动推演和生成的专属教学物料
        </p>
      </div>
      <div class="flex gap-2">
        <el-button plain round :icon="Refresh" @click="loadResources">
          刷新
        </el-button>
        <el-button
          type="primary"
          size="large"
          round
          :loading="creating"
          @click="handleCreateTask"
        >
          <template #icon>
            <el-icon><MagicStick /></el-icon>
          </template>
          新建生成任务
        </el-button>
      </div>
    </div>

    <div class="mb-6 flex gap-4">
      <el-input
        v-model="searchQuery"
        placeholder="搜索生成的资源..."
        class="max-w-md"
        :prefix-icon="Search"
      />
      <el-select
        v-model="resourceType"
        placeholder="资源类型"
        class="w-40"
        clearable
      >
        <el-option label="全部" value="" />
        <el-option
          v-for="type in resourceTypeOptions"
          :key="type"
          :label="type"
          :value="type"
        />
      </el-select>
    </div>

    <div class="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
      <div
        class="bg-white border border-gray-100 rounded-xl overflow-hidden flex flex-col"
      >
        <div class="px-5 py-4 border-b border-gray-100 font-bold text-gray-700">
          任务中心
        </div>
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          <div
            v-for="task in tasks"
            :key="task.task_id"
            class="p-4 rounded-xl border cursor-pointer transition-all hover:shadow-sm"
            :class="
              selectedTaskId === task.task_id
                ? 'border-primary bg-primary/5'
                : 'border-gray-100 bg-gray-50/50 hover:border-primary/30'
            "
            @click="loadTaskLogs(task.task_id)"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-sm text-gray-700 truncate">{{
                task.stage || task.task_id
              }}</span>
              <el-tag size="small" :type="tagType(task.status)" effect="plain">
                {{ task.status }}
              </el-tag>
            </div>
            <el-progress
              class="mt-3"
              :percentage="task.progress || 0"
              :status="task.status === 'failed' ? 'exception' : undefined"
            />
            <p v-if="task.error_message" class="mt-2 text-xs text-red-500">
              {{ task.error_message }}
            </p>
            <div class="mt-3 flex flex-wrap gap-1">
              <el-tag
                v-for="type in task.resource_types || []"
                :key="type"
                size="small"
                effect="plain"
                class="!rounded-md"
              >
                {{ type }}
              </el-tag>
            </div>
          </div>
          <el-empty v-if="!tasks.length" description="暂无生成任务" />
        </div>
        <div
          v-if="selectedTaskId"
          class="max-h-60 overflow-y-auto border-t border-gray-100 p-4 bg-gray-50/50"
        >
          <el-timeline>
            <el-timeline-item
              v-for="log in taskLogs"
              :key="`${log.occurred_at}-${log.stage}`"
              :timestamp="log.occurred_at"
              :type="tagType(log.status)"
              hollow
            >
              <span class="text-xs text-gray-600">{{ log.message }}</span>
            </el-timeline-item>
          </el-timeline>
          <el-empty
            v-if="!taskLogs.length"
            description="暂无任务日志"
            :image-size="80"
          />
        </div>
      </div>

      <div class="overflow-y-auto pr-1">
        <div
          v-if="filteredResources.length"
          class="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6 auto-rows-max"
        >
          <div
            v-for="res in filteredResources"
            :key="res.resource_id"
            class="bg-white rounded-xl p-5 border border-gray-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group"
          >
            <div class="flex items-start justify-between mb-4">
              <div class="p-3 rounded-xl text-primary bg-primary/10">
                <el-icon :size="24"
                  ><component :is="resourceIcon(res.resource_type)"
                /></el-icon>
              </div>
              <el-tag
                size="small"
                effect="light"
                class="rounded-full !border-none"
                :type="tagType(res.status)"
              >
                {{ res.resource_type }}
              </el-tag>
            </div>
            <h3
              class="text-lg font-bold text-gray-700 mb-2 group-hover:text-primary transition-colors"
            >
              {{ res.title }}
            </h3>
            <p class="text-sm text-gray-500 mb-3 line-clamp-2">
              {{ res.summary || "暂无摘要" }}
            </p>
            <p
              v-if="res.recommendation"
              class="text-xs text-primary mb-4 line-clamp-2"
            >
              {{ res.recommendation }}
            </p>
            <div class="mb-4 flex flex-wrap gap-1.5">
              <el-tag
                v-if="res.content_format"
                size="small"
                effect="plain"
                class="!rounded-md"
              >
                {{ res.content_format }}
              </el-tag>
              <el-tag
                v-if="res.quality_score !== undefined"
                size="small"
                type="success"
                effect="plain"
                class="!rounded-md"
              >
                质量 {{ qualityLabel(res.quality_score) }}
              </el-tag>
              <el-tag
                v-if="res.safety_status"
                size="small"
                :type="res.safety_status === 'safe' ? 'success' : 'warning'"
                effect="plain"
                class="!rounded-md"
              >
                {{ res.safety_status }}
              </el-tag>
              <el-tag
                v-if="res.html_animation_status"
                size="small"
                :type="tagType(res.html_animation_status)"
                effect="plain"
                class="!rounded-md"
              >
                动画 {{ res.html_animation_status }}
              </el-tag>
            </div>
            <p
              v-if="
                res.html_animation_status &&
                res.html_animation_status !== 'ready'
              "
              class="text-xs text-amber-600 mb-4 line-clamp-2"
            >
              {{
                res.html_animation_message ||
                res.html_animation_error ||
                "动画任务处理中"
              }}
            </p>
            <div
              class="flex items-center justify-between text-xs text-gray-400 pt-4 border-t border-gray-50"
            >
              <span>{{ res.status }}</span>
              <div class="flex items-center gap-2">
                <el-button
                  size="small"
                  text
                  type="primary"
                  :icon="View"
                  @click="openResourceDetail(res)"
                >
                  查看
                </el-button>
                <el-button
                  size="small"
                  text
                  :icon="Download"
                  @click="openUrl(res.download_url, res)"
                >
                  下载
                </el-button>
              </div>
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无学习资源" />
      </div>
    </div>

    <el-dialog
      v-model="detailVisible"
      width="760px"
      destroy-on-close
      class="assistant-resource-dialog"
      @closed="handleResourceDialogClosed"
    >
      <template #header>
        <div class="pr-8">
          <div class="text-base font-bold text-gray-800">
            {{ selectedResource?.title || "资源详情" }}
          </div>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <el-tag size="small" effect="plain">
              {{ selectedResource?.resource_type || "resource" }}
            </el-tag>
            <el-tag
              v-if="selectedResource?.content_format"
              size="small"
              effect="plain"
            >
              {{ selectedResource.content_format }}
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
              {{ selectedResource.safety_status }}
            </el-tag>
          </div>
        </div>
      </template>

      <div v-if="selectedResource" class="space-y-5">
        <p class="text-sm text-gray-600 leading-relaxed">
          {{
            selectedResource.summary ||
            selectedResource.recommendation ||
            "暂无摘要"
          }}
        </p>

        <div
          v-if="selectedResource.html_animation_task_id"
          class="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700"
        >
          <div class="font-bold">
            动画任务：{{ selectedResource.html_animation_status || "pending" }}
          </div>
          <div class="mt-1 text-xs leading-relaxed">
            {{
              selectedResource.html_animation_message ||
              selectedResource.html_animation_error ||
              "可通过任务 ID 进入动画状态轮询流程"
            }}
          </div>
          <div class="mt-2 font-mono text-xs text-amber-600">
            {{ selectedResource.html_animation_task_id }}
          </div>
        </div>

        <div
          v-if="hasInlinePreview(selectedResource)"
          class="rounded-xl border border-gray-100 bg-gray-50 p-4"
        >
          <div class="mb-3 text-xs font-bold text-gray-500 uppercase">
            内联预览
          </div>
          <pre
            class="max-h-80 overflow-auto whitespace-pre-wrap break-words text-sm leading-7 text-gray-700"
            >{{ selectedResource.content_body }}</pre
          >
        </div>

        <div v-if="selectedResource.object_key" class="text-xs text-gray-500">
          对象存储 Key：{{ selectedResource.object_key }}
        </div>

        <div v-if="selectedResource.citations?.length" class="space-y-2">
          <div class="text-xs font-bold text-gray-500 uppercase">引用来源</div>
          <div
            v-for="(citation, index) in selectedResource.citations"
            :key="`${citation.title || citation.url || index}`"
            class="rounded-lg border border-gray-100 px-3 py-2 text-xs text-gray-600"
          >
            <div class="font-medium text-gray-700">
              {{ citation.title || citation.source || `引用 ${index + 1}` }}
            </div>
            <div v-if="citation.snippet" class="mt-1 leading-relaxed">
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

        <div class="rounded-xl border border-gray-100 p-4">
          <div class="flex items-center gap-2 text-sm font-bold text-gray-700">
            <el-icon><ChatDotRound /></el-icon>
            资源反馈
          </div>
          <div class="mt-3 flex items-center gap-3">
            <el-rate v-model="resourceFeedbackScore" :max="5" />
            <span class="text-xs text-gray-400"
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
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-between gap-3">
          <el-button
            :icon="CircleCheck"
            :loading="completeSubmitting"
            @click="handleCompleteResource"
          >
            标记完成
          </el-button>
          <div class="flex items-center gap-2">
            <el-button
              v-if="selectedResource?.preview_url"
              type="primary"
              plain
              :icon="View"
              @click="openUrl(selectedResource.preview_url, selectedResource)"
            >
              打开预览
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
  </div>
</template>

<style scoped>
@media screen and (max-width: 768px) {
  .ai-resource-generation-panel {
    padding: 18px 16px 96px;
    overflow-y: auto;
  }

  .ai-resource-generation-panel > div:first-child {
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
    margin-bottom: 16px;
  }

  .ai-resource-generation-panel h2 {
    font-size: 20px;
    line-height: 1.25;
    word-break: keep-all;
  }

  .ai-resource-generation-panel > div:first-child > div:last-child {
    display: grid;
    grid-template-columns: 0.72fr 1.28fr;
    gap: 10px;
  }

  .ai-resource-generation-panel :deep(.el-button) {
    min-width: 0;
    margin-left: 0;
    padding: 0 12px;
  }

  .ai-resource-generation-panel .mb-6.flex.gap-4 {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
    margin-bottom: 16px;
  }

  .ai-resource-generation-panel :deep(.el-input),
  .ai-resource-generation-panel :deep(.el-select) {
    width: 100%;
    max-width: none;
  }

  .ai-resource-generation-panel .flex-1.min-h-0.grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 14px;
    min-height: auto;
    overflow: visible;
  }

  .ai-resource-generation-panel .bg-white.border.border-gray-100.rounded-xl {
    max-height: none;
    border-radius: 18px;
  }

  .ai-resource-generation-panel .overflow-y-auto.pr-1 {
    overflow: visible;
    padding-right: 0;
  }

  .ai-resource-generation-panel .grid.grid-cols-1.md\:grid-cols-2 {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .ai-resource-generation-panel .bg-white.rounded-xl.p-5 {
    padding: 16px;
    border-radius: 18px;
  }

  .assistant-resource-dialog :deep(.el-dialog__body) {
    max-height: 72vh;
    overflow-y: auto;
  }

  .assistant-resource-dialog :deep(.el-dialog__footer > div) {
    flex-direction: column;
    align-items: stretch;
  }

  .assistant-resource-dialog :deep(.el-dialog__footer .el-button) {
    width: 100%;
  }
}
</style>
