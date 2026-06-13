<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import {
  Location,
  Check,
  Cpu,
  Reading,
  Guide,
  RefreshRight,
  MagicStick
} from "@element-plus/icons-vue";
import {
  completeAssistantPathNode,
  generateAssistantPath,
  getAssistantCurrentPath,
  replanAssistantPath,
  type AssistantPathRoadmap
} from "@/api/frontend/assistant";

const props = defineProps<{
  courseId?: number;
  targetStudentId?: number;
}>();

const loading = ref(false);
const actionLoading = ref(false);
const status = ref("");
const statusMessage = ref("");
const path = ref<AssistantPathRoadmap | null>(null);

const courseMeta = computed(() => path.value?.course_meta);
const roadmapData = computed(() => path.value?.roadmap || []);
const hasPath = computed(() => !!path.value && roadmapData.value.length > 0);

const loadPath = async () => {
  loading.value = true;
  try {
    const { data } = await getAssistantCurrentPath({
      course_id: props.courseId,
      target_student_id: props.targetStudentId
    });
    path.value = data.path || null;
    status.value = data.status;
    statusMessage.value = data.message || "";
  } catch (error: any) {
    console.error("[AiLearningPath] 学习路径加载失败:", error);
    ElMessage.error(error?.message || "学习路径加载失败");
  } finally {
    loading.value = false;
  }
};

const handleGenerate = async () => {
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
    ElMessage.error(error?.message || "学习路径生成失败");
  } finally {
    actionLoading.value = false;
  }
};

const handleReplan = async () => {
  actionLoading.value = true;
  try {
    const { data } = await replanAssistantPath({
      course_id: props.courseId,
      target_student_id: props.targetStudentId,
      reason: "frontend_manual_replan"
    });
    if (data.path) path.value = data.path;
    status.value = data.status;
    statusMessage.value = data.message || "";
    ElMessage.success(data.message || "已提交重规划");
    await loadPath();
  } catch (error: any) {
    console.error("[AiLearningPath] 学习路径重规划失败:", error);
    ElMessage.error(error?.message || "学习路径重规划失败");
  } finally {
    actionLoading.value = false;
  }
};

const handleComplete = async (nodeId: string) => {
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
    ElMessage.error(error?.message || "完成路径节点失败");
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
    class="ai-learning-path-panel h-full flex flex-col p-6 bg-transparent overflow-y-auto custom-scrollbar"
  >
    <div class="mb-8">
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <el-icon class="text-primary"><Guide /></el-icon>
            <h2 class="text-xl font-bold text-text_color_primary">
              个性化路径规划
            </h2>
          </div>
          <p class="text-sm text-text_color_regular mt-1">
            基于 AI 学情画像动态生成的专属进阶路线
          </p>
        </div>
        <div class="flex gap-2">
          <el-button
            plain
            round
            :loading="actionLoading"
            :disabled="!hasPath"
            @click="handleReplan"
          >
            <el-icon class="mr-1"><RefreshRight /></el-icon>
            重规划
          </el-button>
          <el-button
            type="primary"
            round
            :loading="actionLoading"
            @click="handleGenerate"
          >
            <el-icon class="mr-1"><MagicStick /></el-icon>
            生成路径
          </el-button>
        </div>
      </div>

      <div
        v-if="courseMeta"
        class="mt-4 max-w-4xl bg-bg_color border border-gray-200 dark:border-gray-800 rounded-xl p-5 flex items-center gap-4 transition-all hover:shadow-md"
      >
        <div
          class="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary"
        >
          <el-icon :size="28"><Cpu /></el-icon>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-bold text-text_color_primary lg:text-lg">{{
              courseMeta.name
            }}</span>
            <el-tag size="small" effect="plain" round>{{
              courseMeta.subtitle || status
            }}</el-tag>
          </div>
          <div
            class="mt-2 text-xs text-text_color_regular flex items-center gap-3"
          >
            <span
              >当前阶段：<span class="text-primary font-bold">{{
                courseMeta.current_phase
              }}</span>
              / {{ courseMeta.total_phase }}</span
            >
            <span class="w-[1px] h-3 bg-gray-200 dark:bg-gray-700" />
            <span>预计 {{ courseMeta.estimated_hours }} 学时</span>
          </div>
        </div>
        <el-tag v-if="statusMessage" type="info" effect="plain" round>
          {{ statusMessage }}
        </el-tag>
      </div>
    </div>

    <div v-if="hasPath" class="max-w-4xl w-full relative">
      <div
        v-for="(phase, index) in roadmapData"
        :key="phase.title"
        class="relative pl-10 mb-12"
      >
        <div
          v-if="index !== roadmapData.length - 1"
          class="absolute left-[11px] top-8 bottom-[-48px] w-0.5"
          :class="
            phase.status === 'completed'
              ? 'bg-primary'
              : 'bg-gray-200 dark:bg-gray-800 border-dashed border-l'
          "
        />

        <div
          class="absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center border-2 bg-bg_color z-10"
          :class="{
            'border-primary text-primary': phase.status === 'completed',
            'border-blue-500 shadow-[0_0_12px_rgba(var(--el-color-primary-rgb),0.3)]':
              phase.status === 'active',
            'border-gray-300 dark:border-gray-700': phase.status === 'pending'
          }"
        >
          <el-icon v-if="phase.status === 'completed'" :size="12"
            ><Check
          /></el-icon>
          <div
            v-else-if="phase.status === 'active'"
            class="w-2.5 h-2.5 bg-primary rounded-full animate-ping"
          />
          <div
            v-else
            class="w-2 h-2 bg-gray-300 dark:bg-gray-700 rounded-full"
          />
        </div>

        <div class="flex items-center justify-between mb-4">
          <div>
            <h3
              class="text-lg font-black tracking-tight"
              :class="
                phase.status === 'pending'
                  ? 'text-text_color_regular opacity-40'
                  : 'text-text_color_primary'
              "
            >
              {{ phase.title }}
            </h3>
            <p
              v-if="phase.summary"
              class="mt-1 text-xs text-text_color_regular"
              :class="phase.status === 'pending' ? 'opacity-50' : ''"
            >
              {{ phase.summary }}
            </p>
          </div>
          <el-tag v-if="phase.status === 'active'" size="small" effect="dark"
            >进行中</el-tag
          >
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            v-for="node in phase.nodes"
            :key="node.node_id"
            class="flex items-start p-4 rounded-xl border transition-all duration-300 group"
            :class="{
              'bg-primary/5 border-primary/20 text-primary shadow-sm':
                node.current,
              'bg-bg_color border-gray-100 dark:border-gray-800 opacity-70':
                !node.done && !node.current,
              'bg-bg_color border-gray-100 dark:border-gray-800 hover:border-primary/50 hover:shadow-md':
                node.done || (!node.done && !node.current)
            }"
          >
            <div
              class="w-8 h-8 rounded-lg flex-c mr-3 transition-colors flex-shrink-0"
              :class="
                node.done
                  ? 'bg-green-100 text-green-600 dark:bg-green-900/30'
                  : node.current
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-400 dark:bg-gray-800'
              "
            >
              <el-icon :size="16">
                <Check v-if="node.done" />
                <Location v-else-if="node.current" />
                <Reading v-else />
              </el-icon>
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-medium text-sm truncate">{{
                  node.name
                }}</span>
                <el-tag
                  size="small"
                  effect="plain"
                  class="ml-auto !border-none"
                >
                  {{ node.type }}
                </el-tag>
              </div>
              <p
                v-if="node.reason"
                class="mt-2 text-xs text-text_color_regular"
              >
                {{ node.reason }}
              </p>
              <p v-if="node.resource_id" class="mt-1 text-[11px] text-primary">
                资源：{{ node.resource_id }}
              </p>
              <el-button
                v-if="!node.done"
                size="small"
                link
                type="primary"
                class="!p-0 mt-2"
                :loading="actionLoading"
                @click="handleComplete(node.node_id)"
              >
                标记完成
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div
      v-else
      class="max-w-3xl w-full rounded-2xl border border-dashed border-primary/20 bg-primary/5 p-8 text-center"
    >
      <el-empty
        :description="statusMessage || '当前课程还没有真实学习路径'"
        :image-size="140"
      />
      <el-button
        type="primary"
        round
        :loading="actionLoading"
        @click="handleGenerate"
      >
        <el-icon class="mr-1"><MagicStick /></el-icon>
        生成路径
      </el-button>
    </div>
  </div>
</template>

<style scoped>
@media screen and (max-width: 768px) {
  .ai-learning-path-panel {
    padding: 18px 16px 96px;
  }

  .ai-learning-path-panel > div:first-child {
    margin-bottom: 18px;
  }

  .ai-learning-path-panel > div:first-child > div:first-child {
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
  }

  .ai-learning-path-panel > div:first-child > div:first-child > div:last-child {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .ai-learning-path-panel :deep(.el-button) {
    min-width: 0;
    margin-left: 0;
    padding: 0 12px;
  }

  .ai-learning-path-panel :deep(.el-button .el-icon) {
    margin-right: 4px;
  }

  .ai-learning-path-panel h2 {
    font-size: 20px;
    line-height: 1.25;
    word-break: keep-all;
  }

  .ai-learning-path-panel .max-w-4xl {
    max-width: none;
  }

  .ai-learning-path-panel .mt-4.max-w-4xl {
    align-items: flex-start;
    padding: 16px;
  }

  .ai-learning-path-panel .mt-4.max-w-4xl > div:first-child {
    width: 44px;
    height: 44px;
    border-radius: 14px;
  }

  .ai-learning-path-panel .mt-2.text-xs {
    flex-wrap: wrap;
    gap: 8px;
  }

  .ai-learning-path-panel .relative.pl-10 {
    padding-left: 30px;
    margin-bottom: 28px;
  }

  .ai-learning-path-panel .grid.grid-cols-1 {
    gap: 10px;
  }

  .ai-learning-path-panel .max-w-3xl {
    max-width: none;
    padding: 24px 16px;
  }
}
</style>
