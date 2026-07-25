<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { getToken } from "@/utils/auth";
import { useAppStoreHook } from "@/store/modules/app";
import AiHubIcon from "@/assets/new-release/ai-hub-svgrepo-com.svg?component";

defineOptions({
  name: "AiFloatButton"
});

const props = defineProps<{
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "click"): void;
}>();

const appStore = useAppStoreHook();
const route = useRoute();
const isMobile = computed(() => appStore.getDevice === "mobile");
const buttonRef = ref<HTMLElement | null>(null);
const activePointerId = ref<number | null>(null);
const isDragging = ref(false);
const preventNextClick = ref(false);
const dragStart = ref({ x: 0, y: 0 });
const dragOrigin = ref({ left: 0, top: 0 });
const position = ref({
  left: 0,
  top: 0
});

const DESKTOP_BUTTON_SIZE = 56;
const MOBILE_BUTTON_SIZE = 48;
const POSITION_PADDING = 10;
const DRAG_THRESHOLD = 6;
const MOBILE_DOCK_GAP = 12;

const isLoggedIn = computed(() => {
  const token = getToken();
  return !!token?.accessToken;
});

const getCssPixelValue = (name: string) => {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getButtonSize = () => {
  return (
    buttonRef.value?.offsetWidth ||
    (isMobile.value ? MOBILE_BUTTON_SIZE : DESKTOP_BUTTON_SIZE)
  );
};

const getVisibleBottomDock = () => {
  if (!isMobile.value) return null;

  return (
    Array.from(
      document.querySelectorAll<HTMLElement>(".nav-mobile-container")
    ).find(element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || 1) > 0.01 &&
        rect.width > 0 &&
        rect.height > 0
      );
    }) || null
  );
};

const getVisibleAiComposer = () => {
  if (!isMobile.value) return null;

  return (
    Array.from(
      document.querySelectorAll<HTMLElement>(".ai-mobile-composer-surface")
    ).find(element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || 1) > 0.01 &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight
      );
    }) || null
  );
};

const getMobileBottomOffset = () => {
  const dock = getVisibleBottomDock();
  const composer = getVisibleAiComposer();
  const obstructionTops = [dock, composer]
    .filter((element): element is HTMLElement => Boolean(element))
    .map(element => element.getBoundingClientRect().top);
  if (obstructionTops.length) {
    const obstructionTop = Math.min(...obstructionTops);
    return Math.max(
      POSITION_PADDING,
      window.innerHeight - obstructionTop + MOBILE_DOCK_GAP
    );
  }

  return getCssPixelValue("--pure-safe-area-bottom") + POSITION_PADDING + 8;
};

const clampPosition = (left: number, top: number) => {
  const size = getButtonSize();
  const maxLeft = Math.max(
    POSITION_PADDING,
    window.innerWidth - size - POSITION_PADDING
  );
  const bottomOffset = isMobile.value
    ? getMobileBottomOffset()
    : POSITION_PADDING;
  const maxTop = Math.max(
    POSITION_PADDING,
    window.innerHeight - size - bottomOffset
  );

  return {
    left: Math.min(Math.max(POSITION_PADDING, left), maxLeft),
    top: Math.min(Math.max(POSITION_PADDING, top), maxTop)
  };
};

const getDefaultPosition = () => {
  const size = getButtonSize();
  const rightOffset = isMobile.value ? 12 : 30;
  const bottomOffset = isMobile.value ? getMobileBottomOffset() : 100;

  return clampPosition(
    window.innerWidth - size - rightOffset,
    window.innerHeight - size - bottomOffset
  );
};

const syncPosition = (reset = false) => {
  if (
    reset ||
    (position.value.left === 0 && position.value.top === 0 && !isDragging.value)
  ) {
    position.value = getDefaultPosition();
    return;
  }

  position.value = clampPosition(position.value.left, position.value.top);
};

const releasePointerCapture = (pointerId: number | null) => {
  if (
    buttonRef.value &&
    pointerId !== null &&
    buttonRef.value.hasPointerCapture(pointerId)
  ) {
    buttonRef.value.releasePointerCapture(pointerId);
  }
};

const handleClick = () => {
  if (props.disabled || isDragging.value) return;

  if (preventNextClick.value) {
    preventNextClick.value = false;
    return;
  }

  emit("click");
};

const handlePointerDown = (e: PointerEvent) => {
  if (props.disabled || !e.isPrimary) return;
  if (e.pointerType === "mouse" && e.button !== 0) return;

  activePointerId.value = e.pointerId;
  isDragging.value = false;
  preventNextClick.value = false;
  dragStart.value = {
    x: e.clientX,
    y: e.clientY
  };
  dragOrigin.value = { ...position.value };

  buttonRef.value?.setPointerCapture(e.pointerId);
  e.preventDefault();
};

const handlePointerMove = (e: PointerEvent) => {
  if (activePointerId.value !== e.pointerId) return;

  const deltaX = e.clientX - dragStart.value.x;
  const deltaY = e.clientY - dragStart.value.y;

  if (
    !isDragging.value &&
    (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD)
  ) {
    isDragging.value = true;
  }

  if (!isDragging.value) return;

  position.value = clampPosition(
    dragOrigin.value.left + deltaX,
    dragOrigin.value.top + deltaY
  );
  e.preventDefault();
};

const finishDrag = (pointerId: number | null) => {
  releasePointerCapture(pointerId);
  activePointerId.value = null;

  if (isDragging.value) {
    preventNextClick.value = true;
  }

  window.setTimeout(() => {
    isDragging.value = false;
  }, 0);
};

const handlePointerUp = (e: PointerEvent) => {
  if (activePointerId.value !== e.pointerId) return;
  finishDrag(e.pointerId);
};

const handlePointerCancel = (e: PointerEvent) => {
  if (activePointerId.value !== e.pointerId) return;
  isDragging.value = false;
  preventNextClick.value = false;
  finishDrag(e.pointerId);
};

const handleResize = () => {
  syncPosition();
};

let positionSyncFrame = 0;
let bottomAvoidanceBindFrame = 0;
let bottomAvoidanceObserver: ResizeObserver | null = null;
let bottomAvoidanceMutationObserver: MutationObserver | null = null;
const schedulePositionSync = (reset = false) => {
  window.cancelAnimationFrame(positionSyncFrame);
  positionSyncFrame = window.requestAnimationFrame(() => {
    syncPosition(reset);
  });
};

const bindBottomAvoidanceObserver = async () => {
  await nextTick();
  bottomAvoidanceObserver?.disconnect();
  bottomAvoidanceObserver = null;
  if (typeof ResizeObserver === "undefined") return;

  bottomAvoidanceObserver = new ResizeObserver(() => schedulePositionSync());
  document
    .querySelectorAll<HTMLElement>(
      ".ai-mobile-composer-surface, .nav-mobile-container"
    )
    .forEach(element => bottomAvoidanceObserver?.observe(element));
  schedulePositionSync();
};

const scheduleBottomAvoidanceRebind = () => {
  window.cancelAnimationFrame(bottomAvoidanceBindFrame);
  bottomAvoidanceBindFrame = window.requestAnimationFrame(() => {
    void bindBottomAvoidanceObserver();
  });
};

const bindBottomAvoidanceMutationObserver = () => {
  bottomAvoidanceMutationObserver?.disconnect();
  bottomAvoidanceMutationObserver = null;
  if (typeof MutationObserver === "undefined" || !document.body) return;
  bottomAvoidanceMutationObserver = new MutationObserver(() => {
    scheduleBottomAvoidanceRebind();
  });
  bottomAvoidanceMutationObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
};

const buttonStyle = computed(() => ({
  left: `${position.value.left}px`,
  top: `${position.value.top}px`
}));

const getButtonCenter = () => {
  const size = getButtonSize();
  return {
    x: position.value.left + size / 2,
    y: position.value.top + size / 2
  };
};

const getButtonCenterFromDom = () => {
  const buttonEl = buttonRef.value;
  if (buttonEl) {
    const rect = buttonEl.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  return getButtonCenter();
};

onMounted(() => {
  void nextTick(() => schedulePositionSync(true));
  void bindBottomAvoidanceObserver();
  bindBottomAvoidanceMutationObserver();
  window.addEventListener("resize", handleResize, { passive: true });
});

onUnmounted(() => {
  bottomAvoidanceObserver?.disconnect();
  bottomAvoidanceMutationObserver?.disconnect();
  window.removeEventListener("resize", handleResize);
  window.cancelAnimationFrame(positionSyncFrame);
  window.cancelAnimationFrame(bottomAvoidanceBindFrame);
  releasePointerCapture(activePointerId.value);
});

watch(isMobile, () => {
  schedulePositionSync(true);
});

watch(
  () => route.fullPath,
  () => {
    scheduleBottomAvoidanceRebind();
  }
);

defineExpose({
  getButtonCenter: getButtonCenterFromDom,
  position
});
</script>

<template>
  <Transition name="fade">
    <div
      v-if="isLoggedIn"
      ref="buttonRef"
      class="ai-float-button"
      :class="{ disabled: disabled, dragging: isDragging }"
      :style="buttonStyle"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerCancel"
      @click="handleClick"
    >
      <el-tooltip content="AI识屏助手" placement="left" :disabled="isDragging">
        <div class="button-inner">
          <AiHubIcon class="ai-icon" />
        </div>
      </el-tooltip>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
.ai-float-button {
  position: fixed;
  z-index: 2000;
  width: 56px;
  height: 56px;
  cursor: pointer;
  user-select: none;
  touch-action: none;
  transition: transform 0.2s ease;

  &:hover:not(.disabled, .dragging) {
    transform: scale(1.1);
  }

  &:active:not(.disabled) {
    transform: scale(0.95);
  }

  &.disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  &.dragging {
    cursor: grabbing;
  }

  .button-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%);
    border: 1px solid #e2e8f0;
    border-radius: 50%;
    box-shadow: 0 4px 15px rgb(148 163 184 / 30%);
    transition: all 0.3s ease;

    &:hover {
      box-shadow: 0 6px 20px rgb(148 163 184 / 50%);
    }

    html.dark & {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      border: 1px solid rgb(255 255 255 / 10%);
      box-shadow: 0 4px 15px rgb(0 0 0 / 30%);

      &:hover {
        box-shadow: 0 6px 20px rgb(0 0 0 / 50%);
      }
    }
  }

  .ai-icon {
    width: 28px;
    height: 28px;
    color: #64748b;

    html.dark & {
      color: #e2e8f0;
    }
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media screen and (max-width: 768px) {
  .ai-float-button {
    width: 48px;
    height: 48px;
  }

  .ai-float-button .ai-icon {
    width: 22px;
    height: 22px;
  }
}
</style>
