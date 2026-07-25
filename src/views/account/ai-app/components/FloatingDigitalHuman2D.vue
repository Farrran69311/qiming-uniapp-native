<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";

import listeningVideo from "@/assets/ai-app/digital-human-2d/listening_circle.webm";
import sayingVideo from "@/assets/ai-app/digital-human-2d/saying_circle.webm";
import standbyVideo from "@/assets/ai-app/digital-human-2d/standby_circle.webm";
import thinkingVideo from "@/assets/ai-app/digital-human-2d/thinking_circle.webm";
import fallbackPoster from "@/assets/ai-app/assistant-avatar.png";
import embeddedStandbyVideo from "@/assets/生成数字人待机视频.mp4";

defineOptions({ name: "FloatingDigitalHuman2D" });

type DigitalHumanState = "standby" | "listening" | "thinking" | "saying";

const props = withDefaults(
  defineProps<{
    roleLabel?: string;
    courseName?: string;
    state?: DigitalHumanState;
    anchor?: "viewportTopRight" | "appLeftBottom";
    anchorSelector?: string;
    leftZoneWidth?: number;
    bottomOffset?: number;
    storageKey?: string;
    avoidSelector?: string;
    layoutKey?: string | number;
  }>(),
  {
    roleLabel: "学生",
    courseName: "",
    state: "standby",
    anchor: "viewportTopRight",
    anchorSelector: "",
    leftZoneWidth: 260,
    bottomOffset: 140,
    storageKey: "",
    avoidSelector: "",
    layoutKey: ""
  }
);

const stateAssets: Record<DigitalHumanState, string> = {
  standby: standbyVideo,
  listening: listeningVideo,
  thinking: thinkingVideo,
  saying: sayingVideo
};

const stateLabels: Record<DigitalHumanState, string> = {
  standby: "待机",
  listening: "倾听",
  thinking: "思考",
  saying: "讲解"
};

const bubbleSize = 88;
const windowPadding = 18;
const storageKey = computed(
  () => props.storageKey || `ai-app-floating-digital-human-2d-${props.anchor}`
);

const videoRef = ref<HTMLVideoElement | null>(null);
const isReady = ref(false);
const isPaused = ref(false);
const forceMp4Playback = ref(false);
const isEmbeddedMobile = ref(false);
const localSpeaking = ref(false);
const speechAmplitude = ref(0);
const position = ref({ x: 0, y: 0 });
const hasUserPosition = ref(false);
const dragState = ref<{
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
} | null>(null);

let speakingTimer: ReturnType<typeof setTimeout> | null = null;
let avoidanceResizeObserver: ResizeObserver | null = null;

const currentState = computed<DigitalHumanState>(() =>
  localSpeaking.value ? "saying" : props.state
);
const currentVideo = computed(() => stateAssets[currentState.value]);
const usesMp4Playback = computed(
  () => isEmbeddedMobile.value || forceMp4Playback.value
);
const playbackVideo = computed(() =>
  usesMp4Playback.value ? embeddedStandbyVideo : currentVideo.value
);
const statusLabel = computed(() => stateLabels[currentState.value]);
const ariaLabel = computed(
  () =>
    `${props.roleLabel}端2D数字人，当前状态：${statusLabel.value}${
      props.courseName ? `，课程：${props.courseName}` : ""
    }`
);
const bubbleStyle = computed(() => ({
  width: `${bubbleSize}px`,
  height: `${bubbleSize}px`,
  transform: `translate3d(${position.value.x}px, ${position.value.y}px, 0) scale(${1 + speechAmplitude.value * 0.035})`,
  opacity: isReady.value ? 1 : 0
}));

const getReservedBottom = () => {
  let reservedBottom =
    props.anchor === "appLeftBottom"
      ? Math.max(windowPadding, props.bottomOffset)
      : windowPadding;

  if (props.anchor !== "appLeftBottom" || !props.avoidSelector) {
    return reservedBottom;
  }

  document
    .querySelectorAll<HTMLElement>(props.avoidSelector)
    .forEach(element => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const isVisible =
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || 1) > 0.01 &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight;
      if (!isVisible) return;
      reservedBottom = Math.max(
        reservedBottom,
        window.innerHeight - Math.max(0, rect.top) + 12
      );
    });

  return reservedBottom;
};

const clampPosition = (nextX: number, nextY: number) => {
  const reservedBottom = getReservedBottom();
  const maxX = Math.max(
    windowPadding,
    window.innerWidth - bubbleSize - windowPadding
  );
  const maxY = Math.max(
    windowPadding,
    window.innerHeight - bubbleSize - reservedBottom
  );
  return {
    x: Math.min(Math.max(windowPadding, nextX), maxX),
    y: Math.min(Math.max(windowPadding, nextY), maxY)
  };
};

const getAnchorRect = () => {
  const target = props.anchorSelector
    ? document.querySelector<HTMLElement>(props.anchorSelector)
    : null;

  if (target) return target.getBoundingClientRect();

  return {
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
    width: window.innerWidth,
    height: window.innerHeight
  };
};

const getDefaultPosition = () => {
  if (props.anchor === "appLeftBottom") {
    const rect = getAnchorRect();
    const zoneWidth = Math.min(props.leftZoneWidth, rect.width);
    const leftOffset = Math.max(
      windowPadding,
      Math.round((zoneWidth - bubbleSize) / 2)
    );

    return clampPosition(
      rect.left + leftOffset,
      rect.bottom - bubbleSize - props.bottomOffset
    );
  }

  return clampPosition(
    window.innerWidth - bubbleSize - 30,
    window.innerWidth >= 768 ? 78 : 68
  );
};

const savePosition = () => {
  window.localStorage.setItem(storageKey.value, JSON.stringify(position.value));
};

const restorePosition = () => {
  try {
    const raw = window.localStorage.getItem(storageKey.value);
    const cached = raw ? JSON.parse(raw) : null;
    if (Number.isFinite(cached?.x) && Number.isFinite(cached?.y)) {
      position.value = clampPosition(cached.x, cached.y);
      hasUserPosition.value = true;
      return;
    }
  } catch (error) {
    console.warn("[FloatingDigitalHuman2D] restore position failed", error);
  }

  hasUserPosition.value = false;
  position.value = getDefaultPosition();
};

const playVideo = async () => {
  await nextTick();
  const video = videoRef.value;
  if (!video || isPaused.value) return;
  try {
    await video.play();
  } catch {
    if (!usesMp4Playback.value) forceMp4Playback.value = true;
  }
};

const detectEmbeddedMobile = () => {
  const locationText = `${window.location.search}&${window.location.hash}`;
  const runtimeClassList = document.documentElement.classList;
  return (
    /(?:qimingMiniProgram|qimingNative)=1/.test(locationText) ||
    runtimeClassList.contains("qiming-mini-program-webview") ||
    runtimeClassList.contains("qiming-native-webview") ||
    window.localStorage.getItem("qimingMiniProgramWebView") === "1" ||
    window.localStorage.getItem("qimingNativeWebView") === "1" ||
    window.sessionStorage.getItem("qimingMiniProgramWebView") === "1" ||
    window.sessionStorage.getItem("qimingNativeWebView") === "1"
  );
};

const handleVideoReady = () => {
  isReady.value = true;
};

const handleVideoError = () => {
  if (!usesMp4Playback.value) {
    forceMp4Playback.value = true;
    return;
  }
  isReady.value = true;
};

const handlePointerDown = (event: PointerEvent) => {
  if (event.button !== 0) return;
  dragState.value = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: position.value.x,
    originY: position.value.y
  };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
};

const handlePointerMove = (event: PointerEvent) => {
  const drag = dragState.value;
  if (!drag || drag.pointerId !== event.pointerId) return;
  const deltaX = event.clientX - drag.startX;
  const deltaY = event.clientY - drag.startY;
  position.value = clampPosition(drag.originX + deltaX, drag.originY + deltaY);
};

const handlePointerUp = (event: PointerEvent) => {
  const drag = dragState.value;
  if (!drag || drag.pointerId !== event.pointerId) return;
  dragState.value = null;
  hasUserPosition.value = true;
  savePosition();
};

const handleResize = () => {
  position.value = hasUserPosition.value
    ? clampPosition(position.value.x, position.value.y)
    : getDefaultPosition();
  if (hasUserPosition.value) savePosition();
};

const bindAvoidanceObserver = async () => {
  await nextTick();
  avoidanceResizeObserver?.disconnect();
  avoidanceResizeObserver = null;

  if (props.avoidSelector && typeof ResizeObserver !== "undefined") {
    avoidanceResizeObserver = new ResizeObserver(handleResize);
    document
      .querySelectorAll<HTMLElement>(props.avoidSelector)
      .forEach(element => avoidanceResizeObserver?.observe(element));
  }

  handleResize();
};

const pauseRender = () => {
  isPaused.value = true;
  videoRef.value?.pause();
};

const resumeRender = () => {
  isPaused.value = false;
  void playVideo();
};

function speak(text = "") {
  if (speakingTimer) clearTimeout(speakingTimer);
  localSpeaking.value = true;
  const duration = Math.min(Math.max(text.length * 80, 1600), 5200);
  speakingTimer = setTimeout(() => {
    localSpeaking.value = false;
  }, duration);
  void playVideo();
}

function setSpeechState(state: string) {
  if (speakingTimer) clearTimeout(speakingTimer);
  localSpeaking.value = state === "speaking";
  if (!localSpeaking.value) speechAmplitude.value = 0;
  void playVideo();
}

function setAmplitude(value: number) {
  speechAmplitude.value = Math.min(1, Math.max(0, Number(value) || 0));
  if (speechAmplitude.value > 0.03) localSpeaking.value = true;
}

function applyViseme(id: string, weight: number) {
  setAmplitude(id === "sil" ? 0 : weight);
}

function triggerMotion() {
  // 2D 资源使用 speaking 视频表达动作，定时 motion 由 3D 模型消费。
}

function resetSpeech() {
  if (speakingTimer) clearTimeout(speakingTimer);
  localSpeaking.value = false;
  speechAmplitude.value = 0;
}

watch(playbackVideo, () => {
  isReady.value = false;
  void playVideo();
});

watch(
  () => [
    props.anchor,
    props.anchorSelector,
    props.leftZoneWidth,
    props.bottomOffset,
    props.avoidSelector,
    props.layoutKey
  ],
  () => {
    position.value = hasUserPosition.value
      ? clampPosition(position.value.x, position.value.y)
      : getDefaultPosition();
    if (hasUserPosition.value) savePosition();
    void bindAvoidanceObserver();
  }
);

onMounted(() => {
  isEmbeddedMobile.value = detectEmbeddedMobile();
  restorePosition();
  isReady.value = true;
  window.addEventListener("resize", handleResize);
  void bindAvoidanceObserver();
  void playVideo();
});

onUnmounted(() => {
  if (speakingTimer) clearTimeout(speakingTimer);
  avoidanceResizeObserver?.disconnect();
  window.removeEventListener("resize", handleResize);
});

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
  <div
    class="floating-human-2d"
    :class="[`is-${currentState}`, { 'is-dragging': Boolean(dragState) }]"
    :style="bubbleStyle"
    :aria-label="ariaLabel"
    role="status"
    :title="ariaLabel"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointercancel="handlePointerUp"
  >
    <video
      :key="playbackVideo"
      ref="videoRef"
      :src="playbackVideo"
      :poster="fallbackPoster"
      :data-playback-format="usesMp4Playback ? 'mp4' : 'webm'"
      muted
      autoplay
      loop
      playsinline
      preload="auto"
      @loadeddata="handleVideoReady"
      @error="handleVideoError"
    />
    <span class="floating-human-2d__dot" />
  </div>
</template>

<style scoped lang="scss">
.floating-human-2d {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1200;
  display: block;
  overflow: visible;
  cursor: grab;
  background:
    radial-gradient(
      circle at 50% 24%,
      rgba(255, 255, 255, 0.95),
      transparent 45%
    ),
    linear-gradient(145deg, #f6f9ff, #fff4fb);
  border: 1px solid rgba(191, 203, 230, 0.9);
  border-radius: 999px;
  box-shadow:
    0 12px 34px rgba(94, 127, 248, 0.18),
    0 3px 10px rgba(31, 41, 55, 0.08);
  transition:
    opacity 160ms ease,
    box-shadow 160ms ease,
    border-color 160ms ease;
  user-select: none;
  touch-action: none;

  &::before {
    position: absolute;
    inset: -5px;
    z-index: -1;
    content: "";
    border: 2px solid rgba(94, 127, 248, 0.14);
    border-radius: inherit;
    opacity: 0.9;
  }

  &.is-dragging {
    cursor: grabbing;
    box-shadow:
      0 18px 44px rgba(94, 127, 248, 0.24),
      0 5px 14px rgba(31, 41, 55, 0.12);
  }

  &.is-thinking::before,
  &.is-saying::before {
    animation: floating-human-pulse 1.2s ease-in-out infinite;
  }
}

.floating-human-2d video {
  width: 100%;
  height: 100%;
  overflow: hidden;
  object-fit: cover;
  background: #f8fbff;
  border: 4px solid rgba(255, 255, 255, 0.92);
  border-radius: inherit;
}

.floating-human-2d__dot {
  position: absolute;
  right: 7px;
  bottom: 12px;
  width: 13px;
  height: 13px;
  background: #34d399;
  border: 2px solid #fff;
  border-radius: 999px;
  box-shadow: 0 0 0 4px rgba(52, 211, 153, 0.16);
}

.floating-human-2d.is-thinking .floating-human-2d__dot {
  background: #f59e0b;
  box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.16);
}

.floating-human-2d.is-saying .floating-human-2d__dot {
  background: #5e7ff8;
  box-shadow: 0 0 0 4px rgba(94, 127, 248, 0.18);
}

@keyframes floating-human-pulse {
  0%,
  100% {
    opacity: 0.75;
    transform: scale(1);
  }
  50% {
    opacity: 0.28;
    transform: scale(1.08);
  }
}

@media (max-width: 768px) {
  .floating-human-2d {
    transform-origin: top left;
  }
}
</style>
