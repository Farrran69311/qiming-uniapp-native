<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { openPlatformUrl } from "@/utils/platformCapability";
import {
  Refresh,
  FullScreen,
  Warning,
  Loading,
  VideoPlay
} from "@element-plus/icons-vue";

// 数字人已集成到项目 public/virtual-people 目录下，由 Vite 统一托管
const humanBaseUrl = computed(() => {
  return new URL("virtual-people/index.html", window.location.href).href;
});
const humanUrl = computed(() => `${humanBaseUrl.value}?embed=ai-app`);
const messageTargetOrigin = computed(() => {
  const target = new URL(humanBaseUrl.value);
  return target.origin === "null" || !/^https?:$/.test(target.protocol)
    ? "*"
    : target.origin;
});

const iframeRef = ref<HTMLIFrameElement | null>(null);
const loading = ref(true);
const errored = ref(false);
const reloadKey = ref(0);
let probeTimer: ReturnType<typeof setTimeout> | null = null;
let iframeReady = false;
const pendingSpeakQueue: string[] = [];

function flushPendingSpeak() {
  const iframe = iframeRef.value;
  if (!iframe || !iframe.contentWindow) return;
  while (pendingSpeakQueue.length) {
    const text = pendingSpeakQueue.shift()!;
    try {
      iframe.contentWindow.postMessage(
        { type: "speak", text },
        messageTargetOrigin.value
      );
    } catch (err) {
      console.warn("[VirtualHumanPanel] flush speak failed", err);
    }
  }
}

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
  iframeReady = false;
  schedulePing();
}

function handleError() {
  iframeReady = false;
  if (probeTimer) clearTimeout(probeTimer);
  probeTimer = null;
  loading.value = false;
  errored.value = true;
}

function handleChildMessage(event: MessageEvent) {
  const iframe = iframeRef.value;
  if (!iframe || event.source !== iframe.contentWindow) return;

  const target = new URL(humanBaseUrl.value);
  if (/^https?:$/.test(target.protocol) && event.origin !== target.origin)
    return;

  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (data.source !== "qiming-virtual-people") return;

  if (data.type === "ready") {
    loading.value = false;
    errored.value = false;
    iframeReady = true;
    if (probeTimer) clearTimeout(probeTimer);
    probeTimer = null;
    postControlMessage({ type: "resumeRender" });
    syncTtsEngine();
    flushPendingSpeak();
  } else if (data.type === "error") {
    handleError();
  }
}

function refresh() {
  loading.value = true;
  errored.value = false;
  iframeReady = false;
  reloadKey.value++;
  schedulePing();
}

function openFull() {
  openPlatformUrl(humanBaseUrl.value);
}

function syncTtsEngine() {
  postControlMessage({ type: "setTtsEngine", engine: "browser" });
}

function previewVoice() {
  postControlMessage({
    type: "previewTts",
    text: "你好，我是启明数字人。现在使用中文女声为你朗读。"
  });
}

function schedulePing() {
  if (probeTimer) clearTimeout(probeTimer);
  // Wait for the child model-ready message, not only iframe document load.
  probeTimer = setTimeout(() => {
    if (loading.value) {
      errored.value = true;
      loading.value = false;
    }
  }, 30000);
}

onMounted(() => {
  window.addEventListener("message", handleChildMessage);
  schedulePing();
});

onUnmounted(() => {
  if (probeTimer) clearTimeout(probeTimer);
  window.removeEventListener("message", handleChildMessage);
});

// 对外暴露：让父组件可以触发数字人朗读 (自动带口型)
// 如果 iframe 尚未加载完成，先把文本排队，加载完后再统一发送
function speak(text: string) {
  const iframe = iframeRef.value;
  if (!iframe || !iframe.contentWindow || !iframeReady) {
    pendingSpeakQueue.push(text);
    return;
  }
  try {
    iframe.contentWindow.postMessage(
      { type: "speak", text },
      messageTargetOrigin.value
    );
  } catch (err) {
    console.warn("[VirtualHumanPanel] speak() postMessage failed", err);
  }
}

function pauseRender() {
  postControlMessage({ type: "pauseRender" });
}

function resumeRender() {
  postControlMessage({ type: "resumeRender" });
}

defineExpose({ speak, pauseRender, resumeRender });
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

    <div class="virtual-human-panel__voicebar" aria-label="朗读音色">
      <div class="virtual-human-panel__voice-label">
        <span>朗读音色</span>
        <strong>系统中文音色</strong>
      </div>
      <el-button
        :icon="VideoPlay"
        class="virtual-human-panel__voice-btn"
        size="small"
        text
        @click="previewVoice"
      >
        试听
      </el-button>
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
            >public/virtual-people/motions.json</code
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
}

.virtual-human-panel__viewer {
  min-height: 0;
  overflow: hidden;
}

.virtual-human-panel__voicebar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-bottom: 1px solid #eef3fb;
  background: rgba(255, 255, 255, 0.94);
}

.virtual-human-panel__voice-label {
  display: flex;
  flex: 1 1 190px;
  align-items: center;
  min-width: 190px;
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
  min-width: 126px;
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

.virtual-human-panel__voice-btn {
  height: 28px;
  padding: 0 8px;
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
