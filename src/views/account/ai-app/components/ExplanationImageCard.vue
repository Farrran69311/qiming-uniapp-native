<script setup lang="ts">
import { computed, ref } from "vue";
import { Refresh } from "@element-plus/icons-vue";
import type { AssistantExplanationImage } from "@/api/frontend/assistant";
import AssistantProcessIcon from "./AssistantProcessIcon.vue";

const props = defineProps<{
  image: AssistantExplanationImage;
}>();
const emit = defineEmits<{
  (event: "refresh", imageId: string): void;
}>();
const imageReloadKey = ref(0);

const terminalStatuses = new Set([
  "succeeded",
  "failed",
  "blocked",
  "unknown_outcome",
  "cancelled"
]);

const isTerminal = computed(() => terminalStatuses.has(props.image.status));
const isGenerating = computed(() => !isTerminal.value);
const hasSucceededImage = computed(
  () => props.image.status === "succeeded" && Boolean(props.image.public_url)
);

const statusText = computed(() => {
  if (props.image.status === "succeeded" && !props.image.public_url) {
    return "讲解图片地址不可用";
  }
  const map: Record<string, string> = {
    queued: "正在准备讲解图片",
    generating: "正在生成讲解图片",
    retrying: "正在重试讲解图片",
    succeeded: "讲解图片已生成",
    failed: "讲解图片生成失败",
    blocked: "讲解图片未通过安全审核",
    unknown_outcome: "讲解图片状态未知",
    cancelled: "讲解图片已取消"
  };
  return map[props.image.status] || "讲解图片处理中";
});

const statusDetail = computed(() => {
  const map: Record<string, string> = {
    queued: "任务已进入生成队列",
    generating: "正在绘制关键概念与关系",
    retrying: "生成服务正在恢复"
  };
  return map[props.image.status] || "正在处理图片任务";
});

const tone = computed<"error" | "success" | "warning" | "running">(() => {
  if (props.image.status === "succeeded" && !props.image.public_url) {
    return "error";
  }
  if (["failed", "blocked", "unknown_outcome"].includes(props.image.status)) {
    return "error";
  }
  if (props.image.status === "succeeded") return "success";
  if (props.image.status === "cancelled") return "warning";
  return "running";
});

const errorText = computed(() => {
  const errorCode = props.image.error_code || "";
  const map: Record<string, string> = {
    moderation_blocked: "图片内容未通过安全审核",
    provider_not_configured: "图片服务暂未配置完成",
    provider_connect_failed: "图片服务连接失败",
    provider_call_failed: "图片服务调用失败",
    provider_failed: "图片服务生成失败",
    provider_image_missing: "图片服务未返回有效图片",
    provider_invalid_response: "图片服务返回格式异常",
    provider_response_too_large: "生成图片超过大小限制",
    provider_model_mismatch: "图片模型配置不一致",
    provider_unknown_outcome: "上游结果未确认，为避免重复生成已停止重试",
    stale_generating_unknown_outcome: "生成结果未能确认，请稍后重新提问",
    invalid_image: "生成结果未通过图片校验",
    object_store_failed: "图片保存失败",
    job_enqueue_failed: "图片任务提交失败",
    worker_failed: "图片任务处理失败",
    explanation_image_finalization_pending: "图片结果正在恢复，请稍后刷新"
  };
  return map[errorCode] || errorCode.replaceAll("_", " ") || "图片生成失败";
});

const retryImageLoad = () => {
  imageReloadKey.value += 1;
  if (props.image.image_id) emit("refresh", props.image.image_id);
};
</script>

<template>
  <article class="explanation-image-card" :class="`is-${props.image.status}`">
    <Transition name="explanation-image-reveal" mode="out-in">
      <el-image
        v-if="hasSucceededImage"
        :key="`image-${imageReloadKey}`"
        class="explanation-image-card__image"
        :src="props.image.public_url"
        :alt="props.image.alt_text || 'AI 讲解图片'"
        fit="contain"
        :preview-src-list="[props.image.public_url]"
        :initial-index="0"
        preview-teleported
        hide-on-click-modal
      >
        <template #error>
          <div class="explanation-image-card__state is-image-error">
            <AssistantProcessIcon kind="pencil" tone="error" :size="30" />
            <div>
              <strong>讲解图片加载失败</strong>
              <p>图片地址暂时不可访问，请稍后刷新。</p>
            </div>
            <el-tooltip content="重新加载图片" placement="top">
              <el-button
                :icon="Refresh"
                circle
                aria-label="重新加载图片"
                @click="retryImageLoad"
              />
            </el-tooltip>
          </div>
        </template>
      </el-image>

      <div
        v-else-if="isGenerating"
        key="generating"
        class="explanation-image-generation"
        role="status"
        aria-live="polite"
      >
        <div class="explanation-image-generation__canvas" aria-hidden="true">
          <span class="generation-block generation-block--subject" />
          <span class="generation-block generation-block--context" />
          <span class="generation-block generation-block--detail" />
          <span class="generation-block generation-block--caption" />
          <span class="generation-scan" />
        </div>
        <div class="explanation-image-generation__status">
          <AssistantProcessIcon kind="pencil" :tone="tone" :size="30" />
          <div>
            <strong>{{ statusText }}</strong>
            <p>{{ statusDetail }}</p>
          </div>
        </div>
        <el-progress
          :percentage="props.image.progress ?? 100"
          :show-text="false"
          :stroke-width="4"
          :indeterminate="props.image.progress == null"
          :duration="2"
        />
      </div>

      <div
        v-else
        key="terminal"
        class="explanation-image-card__state"
        role="status"
      >
        <AssistantProcessIcon kind="pencil" :tone="tone" :size="30" />
        <div>
          <strong>{{ statusText }}</strong>
          <p v-if="props.image.error_code">{{ errorText }}</p>
          <p v-else-if="props.image.status === 'succeeded'">
            服务未返回公开图片地址
          </p>
        </div>
      </div>
    </Transition>

    <p
      v-if="hasSucceededImage && props.image.alt_text"
      class="explanation-image-card__alt"
    >
      {{ props.image.alt_text }}
    </p>
  </article>
</template>

<style scoped>
.explanation-image-card {
  overflow: hidden;
  color: #52617a;
  background: #f7f9fc;
  border: 1px solid #e0e7f1;
  border-radius: 8px;
}

.explanation-image-card__image {
  display: block;
  width: 100%;
  min-height: 180px;
  max-height: 420px;
  cursor: zoom-in;
  background: #eef3f9;
}

.explanation-image-card__image :deep(.el-image__inner) {
  width: 100%;
  max-height: 420px;
  object-fit: contain;
}

.explanation-image-generation__canvas {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 2;
  min-height: 180px;
  overflow: hidden;
  background-color: #edf2f7;
  background-image:
    linear-gradient(rgb(255 255 255 / 48%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(255 255 255 / 48%) 1px, transparent 1px);
  background-size: 28px 28px;
}

.generation-block {
  position: absolute;
  overflow: hidden;
  border: 1px solid rgb(148 163 184 / 22%);
  opacity: 0.72;
  animation: generation-develop 3.2s ease-in-out infinite;
}

.generation-block::after {
  position: absolute;
  inset: 0;
  content: "";
  background: linear-gradient(
    105deg,
    transparent 20%,
    rgb(255 255 255 / 72%) 48%,
    transparent 76%
  );
  transform: translateX(-120%);
  animation: generation-light 2.4s ease-in-out infinite;
}

.generation-block--subject {
  inset: 14% 38% 24% 8%;
  background: #cbd8eb;
  border-radius: 6px;
}

.generation-block--context {
  inset: 18% 8% 48% 66%;
  background: #d9e4d6;
  border-radius: 5px;
  animation-delay: 0.24s;
}

.generation-block--detail {
  inset: 58% 8% 24% 66%;
  background: #e8dcc8;
  border-radius: 5px;
  animation-delay: 0.48s;
}

.generation-block--caption {
  right: 8%;
  bottom: 10%;
  left: 8%;
  height: 7%;
  background: #d8dee8;
  border-radius: 3px;
  animation-delay: 0.72s;
}

.generation-scan {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 2px;
  background: rgb(37 99 235 / 50%);
  box-shadow: 0 8px 24px rgb(37 99 235 / 16%);
  animation: generation-scan 2.8s cubic-bezier(0.16, 1, 0.3, 1) infinite;
}

.explanation-image-generation__status,
.explanation-image-card__state {
  display: flex;
  gap: 10px;
  align-items: center;
  min-height: 76px;
  padding: 14px 16px;
}

.explanation-image-generation__status strong,
.explanation-image-card__state strong {
  display: block;
  font-size: 13px;
  color: #43516a;
}

.explanation-image-generation__status p,
.explanation-image-card__state p,
.explanation-image-card__alt {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: #6f7e95;
}

.explanation-image-card__state.is-image-error {
  min-height: 180px;
  justify-content: center;
}

.explanation-image-card__alt {
  padding: 0 14px 12px;
}

.explanation-image-generation :deep(.el-progress) {
  padding: 0 14px 12px;
}

.explanation-image-reveal-enter-active,
.explanation-image-reveal-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.explanation-image-reveal-enter-from,
.explanation-image-reveal-leave-to {
  opacity: 0;
  transform: scale(0.992);
}

@keyframes generation-develop {
  0%,
  100% {
    filter: saturate(0.72);
    opacity: 0.56;
  }
  50% {
    filter: saturate(1);
    opacity: 0.88;
  }
}

@keyframes generation-light {
  0%,
  18% {
    transform: translateX(-120%);
  }
  72%,
  100% {
    transform: translateX(120%);
  }
}

@keyframes generation-scan {
  0% {
    transform: translateY(-4px);
    opacity: 0;
  }
  12% {
    opacity: 1;
  }
  88% {
    opacity: 1;
  }
  100% {
    transform: translateY(420px);
    opacity: 0;
  }
}

:global(html.dark) .explanation-image-card {
  color: var(--ai-app-text-regular, #cbd6e8);
  background: rgb(38 61 96 / 42%);
  border-color: var(--ai-app-border, rgb(148 163 184 / 24%));
}

:global(html.dark) .explanation-image-generation__canvas {
  background-color: #17243a;
  background-image:
    linear-gradient(rgb(148 163 184 / 8%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(148 163 184 / 8%) 1px, transparent 1px);
}

:global(html.dark) .generation-block--subject {
  background: #334a6e;
}

:global(html.dark) .generation-block--context {
  background: #365345;
}

:global(html.dark) .generation-block--detail {
  background: #594934;
}

:global(html.dark) .generation-block--caption {
  background: #3b475b;
}

:global(html.dark) .explanation-image-generation__status strong,
:global(html.dark) .explanation-image-card__state strong {
  color: var(--ai-app-text, #eef4ff);
}

:global(html.dark) .explanation-image-generation__status p,
:global(html.dark) .explanation-image-card__state p,
:global(html.dark) .explanation-image-card__alt {
  color: var(--ai-app-text-muted, #aab6c9);
}

@media (prefers-reduced-motion: reduce) {
  .generation-block,
  .generation-block::after,
  .generation-scan {
    animation: none;
  }

  .generation-scan {
    display: none;
  }

  .explanation-image-reveal-enter-active,
  .explanation-image-reveal-leave-active {
    transition: opacity 120ms ease;
  }

  .explanation-image-reveal-enter-from,
  .explanation-image-reveal-leave-to {
    transform: none;
  }
}
</style>
