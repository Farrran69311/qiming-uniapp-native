<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage } from "element-plus";
import {
  Close,
  Document,
  Download,
  Minus,
  Plus
} from "@element-plus/icons-vue";
import PlatformResourcePreviewPane from "./PlatformResourcePreviewPane.vue";
import {
  downloadPlatformResource,
  platformPreviewKindLabel,
  resolvePlatformPreviewSource,
  type PlatformPreviewResource
} from "./resource-preview";

defineOptions({ name: "PlatformResourcePreviewDialog" });

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    resource?: PlatformPreviewResource | null;
  }>(),
  { resource: null }
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

const resolved = computed(() => resolvePlatformPreviewSource(props.resource));
const formatLabel = computed(() =>
  platformPreviewKindLabel(resolved.value.kind)
);
const formatMediaTime = (value?: number) => {
  const totalSeconds = Math.max(0, Math.floor(Number(value || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
};
const previewLabel = computed(() => {
  const startMs = Number(props.resource?.segmentStartMs);
  const endMs = Number(props.resource?.segmentEndMs);
  if (
    resolved.value.kind !== "video" ||
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    endMs <= startMs
  ) {
    return formatLabel.value;
  }
  return `${formatLabel.value} · 片段 ${formatMediaTime(startMs)} - ${formatMediaTime(endMs)} · 完整视频`;
});
const canDownload = computed(() => Boolean(resolved.value.downloadUrl));
const fontScale = ref(1);
const fontPercent = computed(() => Math.round(fontScale.value * 100));
const supportsFontScale = computed(() =>
  ["markdown", "text", "json"].includes(resolved.value.kind)
);

function adjustFontScale(delta: number) {
  fontScale.value = Math.min(
    1.4,
    Math.max(0.8, Number((fontScale.value + delta).toFixed(1)))
  );
}

function closeDialog() {
  emit("update:modelValue", false);
}

async function downloadResource() {
  if (!props.resource) return;
  try {
    await downloadPlatformResource(props.resource);
  } catch (error) {
    console.warn("[PlatformResourcePreviewDialog] download failed", error);
    ElMessage.error("文件下载失败，请检查资源权限或下载地址");
  }
}
</script>

<template>
  <el-dialog
    :model-value="props.modelValue"
    class="platform-resource-preview-dialog"
    modal-class="platform-resource-preview-dialog__modal"
    width="min(1180px, 94vw)"
    align-center
    append-to-body
    destroy-on-close
    :show-close="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header="{ titleId, titleClass }">
      <div class="platform-resource-preview-dialog__header">
        <div class="platform-resource-preview-dialog__heading">
          <span
            class="platform-resource-preview-dialog__file-icon"
            aria-hidden="true"
          >
            <el-icon :size="19"><Document /></el-icon>
          </span>
          <div>
            <h2 :id="titleId" :class="titleClass">
              {{ resolved.title }}
            </h2>
            <p>{{ previewLabel }}</p>
          </div>
        </div>
        <div class="platform-resource-preview-dialog__actions">
          <template v-if="supportsFontScale">
            <el-tooltip content="减小字号" placement="bottom">
              <el-button
                class="platform-resource-preview-dialog__tool-button"
                :icon="Minus"
                aria-label="减小字号"
                :disabled="fontScale <= 0.8"
                @click="adjustFontScale(-0.1)"
              />
            </el-tooltip>
            <el-tooltip content="恢复默认字号" placement="bottom">
              <button
                type="button"
                class="platform-resource-preview-dialog__font-reset"
                aria-label="恢复默认字号"
                @click="fontScale = 1"
              >
                {{ fontPercent }}%
              </button>
            </el-tooltip>
            <el-tooltip content="增大字号" placement="bottom">
              <el-button
                class="platform-resource-preview-dialog__tool-button"
                :icon="Plus"
                aria-label="增大字号"
                :disabled="fontScale >= 1.4"
                @click="adjustFontScale(0.1)"
              />
            </el-tooltip>
          </template>
          <el-tooltip
            v-if="canDownload"
            content="下载原文件"
            placement="bottom"
          >
            <el-button
              class="platform-resource-preview-dialog__tool-button"
              :icon="Download"
              aria-label="下载原文件"
              @click="downloadResource"
            />
          </el-tooltip>
          <el-tooltip content="关闭预览" placement="bottom">
            <el-button
              class="platform-resource-preview-dialog__tool-button"
              :icon="Close"
              aria-label="关闭预览"
              @click="closeDialog"
            />
          </el-tooltip>
        </div>
      </div>
    </template>

    <PlatformResourcePreviewPane
      :resource="props.resource"
      :font-scale="fontScale"
    />
  </el-dialog>
</template>

<style>
.platform-resource-preview-dialog.el-dialog {
  display: flex;
  height: min(860px, 90vh);
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 24px 70px rgb(15 23 42 / 20%);
}

.platform-resource-preview-dialog .el-dialog__header {
  flex: 0 0 auto;
  padding: 0;
  margin: 0;
}

.platform-resource-preview-dialog .el-dialog__body {
  min-height: 0;
  flex: 1 1 auto;
  height: auto;
  padding: 0;
  overflow: hidden;
}

.platform-resource-preview-dialog__header {
  display: flex;
  min-height: 68px;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px 10px 18px;
  background: #fff;
  border-bottom: 1px solid #e5eaf0;
}

.platform-resource-preview-dialog__heading {
  display: flex;
  min-width: 0;
  gap: 11px;
  align-items: center;
}

.platform-resource-preview-dialog__heading > div {
  min-width: 0;
}

.platform-resource-preview-dialog__heading h2 {
  max-width: min(760px, 68vw);
  margin: 0;
  overflow: hidden;
  color: #263449;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.45;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.platform-resource-preview-dialog__heading p {
  max-width: min(760px, 68vw);
  margin: 2px 0 0;
  overflow: hidden;
  color: #8390a2;
  font-size: 12px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.platform-resource-preview-dialog__file-icon {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
  width: 34px;
  height: 38px;
  align-items: center;
  justify-content: center;
  background: #edf4fc;
  border: 1px solid #c9dcf1;
  border-radius: 5px;
}

.platform-resource-preview-dialog__file-icon .el-icon {
  color: #4f83c2;
}

.platform-resource-preview-dialog__actions {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 8px;
  align-items: center;
}

.platform-resource-preview-dialog__tool-button,
.platform-resource-preview-dialog__font-reset {
  display: inline-flex;
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: #53677e;
  cursor: pointer;
  background: #fff;
  border: 1px solid #d7e0e9;
  border-radius: 4px;
}

.platform-resource-preview-dialog__font-reset {
  font-size: 10px;
  font-weight: 700;
}

.platform-resource-preview-dialog__tool-button:hover,
.platform-resource-preview-dialog__font-reset:hover {
  color: #2468b3;
  background: #edf4fc;
  border-color: #bcd1e8;
}

.platform-resource-preview-dialog__font-reset:focus-visible {
  outline: 2px solid #78a4d5;
  outline-offset: 2px;
}

.platform-resource-preview-dialog__modal {
  background: rgb(15 23 42 / 42%);
  backdrop-filter: blur(2px);
}

.dark .platform-resource-preview-dialog__header {
  background: #151d2b;
  border-bottom-color: rgb(255 255 255 / 10%);
}

.dark .platform-resource-preview-dialog__heading h2 {
  color: #e5edf7;
}

.dark .platform-resource-preview-dialog__tool-button,
.dark .platform-resource-preview-dialog__font-reset {
  color: #c4d0de;
  background: #1b2738;
  border-color: #35475d;
}

@media (max-width: 768px) {
  .platform-resource-preview-dialog.el-dialog {
    width: 100vw !important;
    height: 100dvh;
    max-height: none;
    margin: 0;
    border-radius: 0;
  }

  .platform-resource-preview-dialog__heading h2 {
    max-width: 38vw;
  }

  .platform-resource-preview-dialog__heading p {
    max-width: 52vw;
  }
}
</style>
