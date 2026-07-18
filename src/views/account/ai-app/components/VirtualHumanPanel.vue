<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import {
  Refresh,
  FullScreen,
  Warning,
  Loading,
  CopyDocument,
  Headset
} from "@element-plus/icons-vue";

const props = withDefaults(
  defineProps<{
    speechEnabled?: boolean;
    voices?: Array<{ alias: string; label: string }>;
    voiceAlias?: string;
    speechStatus?: string;
    speechDetail?: string;
  }>(),
  {
    speechEnabled: false,
    voices: () => [],
    voiceAlias: "",
    speechStatus: "语音未启用",
    speechDetail: ""
  }
);
const emit = defineEmits<{
  (event: "update:voiceAlias", value: string): void;
  (event: "copySpeechDiagnostics"): void;
  (event: "testSpeechOutput"): void;
}>();

// 数字人已集成到项目 public/virtual-people 目录下，由 Vite 统一托管
const humanBaseUrl = computed(() => {
  const baseUrl = new URL(
    import.meta.env.BASE_URL || "/",
    window.location.origin
  );
  return new URL("virtual-people/index.html", baseUrl).href;
});
const humanUrl = computed(() => `${humanBaseUrl.value}?embed=ai-app`);
const messageTargetOrigin = computed(() => {
  return new URL(humanBaseUrl.value).origin;
});

const iframeRef = ref<HTMLIFrameElement | null>(null);
const loading = ref(true);
const errored = ref(false);
const reloadKey = ref(0);
const iframeReady = ref(false);
let probeTimer: ReturnType<typeof setTimeout> | null = null;

function postControlMessage(payload: Record<string, unknown>) {
  const iframe = iframeRef.value;
  if (!iframe || !iframe.contentWindow) return;
  try {
    iframe.contentWindow.postMessage(payload, messageTargetOrigin.value);
  } catch (err) {
    console.warn("[VirtualHumanPanel] control postMessage failed", err);
  }
}

function handleLoad() {
  // iframe load only means that a document arrived. The VRM page reports
  // readiness after its model and motion manifest are loaded.
  iframeReady.value = false;
}

function handleMessage(event: MessageEvent) {
  const iframe = iframeRef.value;
  if (!iframe || event.source !== iframe.contentWindow) return;
  if (event.origin !== messageTargetOrigin.value) return;

  const data = event.data;
  if (!data || typeof data !== "object") return;

  if (data.type === "virtual-human-ready") {
    iframeReady.value = true;
    loading.value = false;
    errored.value = false;
    if (probeTimer) {
      clearTimeout(probeTimer);
      probeTimer = null;
    }
    postControlMessage({ type: "resumeRender" });
    postControlMessage({ type: "speechReset" });
  } else if (data.type === "virtual-human-error") {
    iframeReady.value = false;
    loading.value = false;
    errored.value = true;
  }
}

function handleError() {
  if (probeTimer) {
    clearTimeout(probeTimer);
    probeTimer = null;
  }
  iframeReady.value = false;
  loading.value = false;
  errored.value = true;
}

function refresh() {
  loading.value = true;
  errored.value = false;
  iframeReady.value = false;
  reloadKey.value++;
  schedulePing();
}

function openFull() {
  window.open(humanBaseUrl.value, "_blank", "noopener");
}

function handleVoiceChange(event: Event) {
  const value = (event.target as HTMLSelectElement | null)?.value;
  if (value) emit("update:voiceAlias", value);
}

function schedulePing() {
  if (probeTimer) clearTimeout(probeTimer);
  // The document can load before the VRM, background and motion assets finish.
  probeTimer = setTimeout(() => {
    if (loading.value) {
      errored.value = true;
      loading.value = false;
      iframeReady.value = false;
    }
  }, 15000);
}

onMounted(() => {
  window.addEventListener("message", handleMessage);
  schedulePing();
});

onUnmounted(() => {
  window.removeEventListener("message", handleMessage);
  if (probeTimer) clearTimeout(probeTimer);
});

function setSpeechState(state: string) {
  postControlMessage({ type: "speechState", state });
}

function speak(text: string) {
  const normalized = text.trim();
  if (!normalized) return;
  postControlMessage({ type: "speak", text: normalized });
}

function setAmplitude(value: number) {
  postControlMessage({ type: "speechAmplitude", value });
}

function applyViseme(id: string, weight: number) {
  postControlMessage({ type: "speechViseme", id, weight });
}

function triggerMotion(key: string, durationMs: number, targetRef?: string) {
  postControlMessage({
    type: "speechMotion",
    key,
    durationMs,
    targetRef
  });
}

function resetSpeech() {
  postControlMessage({ type: "speechReset" });
}

function pauseRender() {
  postControlMessage({ type: "pauseRender" });
}

function resumeRender() {
  postControlMessage({ type: "resumeRender" });
}

defineExpose({
  speak,
  setSpeechState,
  setAmplitude,
  applyViseme,
  triggerMotion,
  resetSpeech,
  pauseRender,
  resumeRender
});
</script>

<template>
  <div class="virtual-human-panel h-full w-full flex flex-col bg-white">
    <!-- 顶部条 -->
    <div
      class="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-white/80 backdrop-blur rounded-t-3xl"
    >
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span class="text-[13px] font-semibold text-gray-700">启明数字人</span>
      </div>
      <div class="flex items-center gap-1.5">
        <el-tooltip content="刷新" placement="top">
          <el-button
            :icon="Refresh"
            circle
            size="small"
            text
            @click="refresh"
          />
        </el-tooltip>
        <el-tooltip content="新窗口打开" placement="top">
          <el-button
            :icon="FullScreen"
            circle
            size="small"
            text
            @click="openFull"
          />
        </el-tooltip>
      </div>
    </div>

    <div class="virtual-human-panel__voicebar" aria-label="实时语音设置">
      <label class="virtual-human-panel__voice-label">
        <span>后端音色</span>
        <select
          :value="props.voiceAlias"
          class="virtual-human-panel__voice-select"
          :disabled="!props.speechEnabled || props.voices.length <= 1"
          @change="handleVoiceChange"
        >
          <option
            v-for="option in props.voices"
            :key="option.alias"
            :value="option.alias"
          >
            {{ option.label }}
          </option>
          <option v-if="!props.voices.length" value="">暂无可用音色</option>
        </select>
      </label>
      <span
        class="virtual-human-panel__speech-status"
        :class="{ 'is-disabled': !props.speechEnabled }"
        :title="props.speechDetail || props.speechStatus"
      >
        {{ props.speechStatus }}
      </span>
      <el-tooltip
        v-if="props.speechDetail"
        content="测试扬声器"
        placement="top"
      >
        <el-button
          :icon="Headset"
          circle
          size="small"
          text
          aria-label="测试扬声器"
          @click="emit('testSpeechOutput')"
        />
      </el-tooltip>
      <el-tooltip
        v-if="props.speechDetail"
        content="复制语音诊断信息"
        placement="top"
      >
        <el-button
          :icon="CopyDocument"
          circle
          size="small"
          text
          aria-label="复制语音诊断信息"
          @click="emit('copySpeechDiagnostics')"
        />
      </el-tooltip>
    </div>

    <!-- 主区 -->
    <div
      class="virtual-human-panel__viewer flex-1 relative bg-gradient-to-br from-slate-50 to-white"
    >
      <!-- iframe -->
      <iframe
        v-show="!errored"
        ref="iframeRef"
        :key="reloadKey"
        :src="humanUrl"
        class="absolute inset-0 w-full h-full border-0"
        allow="autoplay; xr-spatial-tracking; fullscreen"
        @load="handleLoad"
        @error="handleError"
      />

      <!-- 加载态 -->
      <div
        v-if="loading && !errored"
        class="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-3"
      >
        <el-icon :size="28" class="animate-spin"><Loading /></el-icon>
        <span class="text-xs">正在加载数字人资源...</span>
      </div>

      <!-- 错误兜底 -->
      <div
        v-if="errored"
        class="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
      >
        <el-icon :size="36" class="text-amber-500 mb-3"><Warning /></el-icon>
        <h4 class="text-sm font-bold text-gray-700 mb-1">数字人资源加载失败</h4>
        <p class="text-xs text-gray-500 leading-relaxed max-w-[260px]">
          请检查
          <code
            class="bg-gray-100 text-rose-500 px-1 py-0.5 rounded text-[11px] mx-0.5"
            >virtual-people/motions.json</code
          >
          与对应的
          <code
            class="bg-gray-100 text-rose-500 px-1 py-0.5 rounded text-[11px] mx-0.5"
            >VRM / FBX / GLB</code
          >
          静态文件是否存在且可访问，然后再刷新。
        </p>
        <el-button class="mt-4" type="primary" plain round @click="refresh"
          ><el-icon class="mr-1"><Refresh /></el-icon>重新加载</el-button
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
.virtual-human-panel {
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

.virtual-human-panel__viewer {
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

.virtual-human-panel__voicebar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  min-width: 0;
  gap: 8px;
  padding: 7px 12px;
  border-bottom: 1px solid #eef3fb;
  background: rgba(255, 255, 255, 0.94);
}

.virtual-human-panel__voice-label {
  display: flex;
  flex: 1 1 190px;
  align-items: center;
  min-width: 0;
  gap: 8px;
}

.virtual-human-panel__voice-label span {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}

.virtual-human-panel__voice-select {
  flex: 1;
  min-width: 0;
  max-width: 190px;
  height: 28px;
  padding: 0 24px 0 9px;
  font-size: 12px;
  color: #334155;
  outline: none;
  background: #f8fbff;
  border: 1px solid #dbe6f5;
  border-radius: 8px;
}

.virtual-human-panel__voice-select:focus {
  border-color: #93c5fd;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.12);
}

.virtual-human-panel__voice-select:disabled {
  color: #64748b;
  cursor: not-allowed;
  background: #f1f5f9;
}

.virtual-human-panel__speech-status {
  flex: 1 1 120px;
  max-width: 160px;
  overflow: hidden;
  font-size: 12px;
  color: #166534;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.virtual-human-panel__speech-status.is-disabled {
  color: #64748b;
}

.animate-spin {
  animation: vh-spin 1s linear infinite;
}

@keyframes vh-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
