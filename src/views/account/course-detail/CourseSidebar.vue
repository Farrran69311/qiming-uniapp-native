<template>
  <!-- 侧边栏菜单 -->
  <div
    id="layout-sidebar"
    class="layout-sidebar"
    :class="[
      currentTheme,
      { 'mobile-collapsed': mobileCollapsed && isMobileView }
    ]"
  >
    <div
      ref="sidebarRef"
      class="layout-sidebar-scroll"
      :class="{ collapsed: mobileCollapsed }"
    >
      <template
        v-for="(item, index) in sidebarMenuItems"
        :key="item.key || index"
      >
        <!-- 分割线 -->
        <div v-if="item.type === 'divider'" class="line" />
        <!-- 菜单项 -->
        <div
          v-else
          :ref="el => setItemRef(item.key, el as HTMLDivElement | null)"
          class="el-tooltip item"
          :class="{ active: activeMenu === item.key }"
          tabindex="0"
          :data-menu="item.key"
          @click="$emit('menu-click', item.key)"
        >
          <div class="hover-box" :class="{ active: activeMenu === item.key }">
            <component :is="item.icon" />
            <div class="side-name">{{ item.label }}</div>
          </div>
        </div>
      </template>
    </div>
    <button
      v-if="isMobileView"
      type="button"
      class="mobile-sidebar-toggle"
      :class="{ visible: mobileCollapsed }"
      :aria-expanded="!mobileCollapsed"
      :aria-label="mobileCollapsed ? '展开课程标签栏' : '课程标签栏已展开'"
      @click.stop="handleMobileToggle"
    >
      <component
        :is="activeMenuItem?.icon || CourseLearnIcon"
        class="toggle-active-icon"
      />
      <svg
        class="toggle-arrow"
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from "vue";
import CourseLearnIcon from "@/assets/course-icons/course-learn-new.svg?component";
import MasteryIcon from "@/assets/course-icons/mastery-new.svg?component";
import CourseQaIcon from "@/assets/table-bar/chat-bubble-dots-svgrepo-com.svg?component";
import HomeworkExamIcon from "@/assets/newicons/check-education-exam-svgrepo-com.svg?component";
import GradesIcon from "@/assets/course-icons/grades.svg?component";
import CourseMaterialsIcon from "@/assets/course-icons/course-materials-new.svg?component";
import HtmlAnimationIcon from "@/assets/newicons/3ds-blend-files-svgrepo-com.svg?component";

// Props
const props = defineProps<{
  currentTheme: string;
  activeMenu: string;
}>();

const MOBILE_BREAKPOINT = 767;
const MOBILE_COLLAPSE_DISTANCE = 72;
const MOBILE_TOP_RESET = 8;
const sidebarRef = ref<HTMLElement | null>(null);
const itemRefs = new Map<string, HTMLElement>();
const isMobileView = ref(false);
const mobileCollapsed = ref(false);
const mobileExpandAnchor = ref(0);

// Emits
defineEmits<{
  (e: "menu-click", menuName: string): void;
}>();

const isMobileViewport = () => isMobileView.value;

const getWindowScrollTop = () => {
  const scrollCandidates = [
    window.scrollY,
    document.documentElement.scrollTop,
    document.body.scrollTop,
    ...Array.from(
      document.querySelectorAll<HTMLElement>(
        [
          ".app-main",
          ".app-main-nofixed-header",
          ".layout-inner-content",
          ".study-container",
          ".message-board-container",
          ".mastery-page-content",
          ".homework-container",
          ".materials-container",
          ".course-grades-container",
          ".animations-container",
          ".left-scroll",
          ".el-scrollbar__wrap"
        ].join(",")
      )
    ).map(el => el.scrollTop)
  ];

  return Math.max(0, ...scrollCandidates.filter(Number.isFinite));
};

const notifyCollapseChange = () => {
  window.dispatchEvent(
    new CustomEvent("qiming:course-sidebar-collapse-change", {
      detail: { collapsed: mobileCollapsed.value }
    })
  );
};

const setItemRef = (key: string, el: HTMLDivElement | null) => {
  if (!key) return;
  if (el) itemRefs.set(key, el);
  else itemRefs.delete(key);
};

const ensureActiveItemVisible = () => {
  if (!isMobileViewport()) return;

  const container = sidebarRef.value;
  const activeItem = itemRefs.get(props.activeMenu);
  if (!container || !activeItem) return;

  const containerRect = container.getBoundingClientRect();
  const activeRect = activeItem.getBoundingClientRect();
  const overflowLeft = activeRect.left < containerRect.left;
  const overflowRight = activeRect.right > containerRect.right;

  if (overflowLeft || overflowRight) {
    activeItem.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest"
    });
  }
};

const updateViewportState = () => {
  isMobileView.value = window.innerWidth <= MOBILE_BREAKPOINT;

  if (!isMobileView.value) {
    mobileCollapsed.value = false;
    mobileExpandAnchor.value = 0;
  }
};

const handleMobileScrollState = () => {
  if (!isMobileViewport()) return;

  const scrollTop = getWindowScrollTop();

  if (scrollTop <= MOBILE_TOP_RESET) {
    mobileCollapsed.value = false;
    mobileExpandAnchor.value = 0;
    return;
  }

  if (mobileCollapsed.value) return;

  if (
    Math.abs(scrollTop - mobileExpandAnchor.value) >= MOBILE_COLLAPSE_DISTANCE
  ) {
    mobileCollapsed.value = true;
  }
};

const handleMobileToggle = () => {
  if (!isMobileViewport()) return;

  mobileCollapsed.value = false;
  mobileExpandAnchor.value = getWindowScrollTop();

  nextTick(() => ensureActiveItemVisible());
};

const handleViewportResize = () => {
  updateViewportState();
  nextTick(() => ensureActiveItemVisible());
  handleMobileScrollState();
};

const handleWindowScroll = () => {
  handleMobileScrollState();
};

// 侧边栏菜单配置
const sidebarMenuItems = [
  { key: "course-learn", label: "课程学习", icon: CourseLearnIcon },
  { key: "mastery", label: "知识点", icon: MasteryIcon },
  { type: "divider" },
  { key: "course-qa", label: "课程问答", icon: CourseQaIcon },
  { key: "homework-exam", label: "作业考试", icon: HomeworkExamIcon },
  { key: "course-materials", label: "课程资料", icon: CourseMaterialsIcon },
  { key: "html-animations", label: "HTML动画", icon: HtmlAnimationIcon },
  { key: "grades", label: "成绩", icon: GradesIcon }
];

const activeMenuItem = computed(
  () =>
    sidebarMenuItems.find(
      item => "key" in item && item.key === props.activeMenu
    ) as { key: string; label: string; icon: any } | undefined
);

watch(
  () => props.activeMenu,
  async () => {
    await nextTick();
    ensureActiveItemVisible();

    if (isMobileViewport() && !mobileCollapsed.value) {
      mobileExpandAnchor.value = getWindowScrollTop();
    }
  },
  { immediate: true }
);

watch(
  mobileCollapsed,
  () => {
    notifyCollapseChange();
  },
  { flush: "post" }
);

onMounted(() => {
  updateViewportState();
  window.addEventListener("resize", handleViewportResize, { passive: true });
  window.addEventListener("scroll", handleWindowScroll, { passive: true });
  document.addEventListener("scroll", handleWindowScroll, {
    capture: true,
    passive: true
  });
  nextTick(() => ensureActiveItemVisible());
  handleMobileScrollState();
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleViewportResize);
  window.removeEventListener("scroll", handleWindowScroll);
  document.removeEventListener("scroll", handleWindowScroll, true);
});
</script>

<style scoped lang="scss">
@keyframes sidebar-glow-border {
  0% {
    background-position: 0% 0%;
  }

  100% {
    background-position: 200% 0%;
  }
}

.layout-sidebar {
  position: fixed;
  top: 80px;
  left: 10px;
  z-index: 100;
  width: 80px;
  min-width: 80px;
  overflow: hidden;
  background: rgb(255 255 255 / 80%);
  border: 1px solid rgb(64 158 255 / 20%);
  border-radius: 24px;
  box-shadow: 0 8px 32px -4px rgb(64 158 255 / 20%);
  isolation: isolate;
  backdrop-filter: blur(20px) saturate(180%);

  &::after {
    position: absolute;
    inset: 0;
    z-index: 0;
    padding: 1.5px;
    pointer-events: none;
    content: "";
    background: linear-gradient(90deg, #97b4f7, #604ffd, #97b4f7);
    background-size: 200% 100%;
    border-radius: 24px;
    mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    mask-composite: exclude;
    animation: sidebar-glow-border 3s linear infinite;
  }

  &.light {
    background: #f5f7fa; /* 与页面背景完全统一，消除色差 */
  }

  &.dark {
    background: #1a1a1a; /* 与深色模式背景完全统一 */
    border: 1px solid rgb(255 255 255 / 5%);
    box-shadow: 0 8px 32px -4px rgb(0 0 0 / 40%);
  }
}

.layout-sidebar-scroll {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: auto;
  max-height: calc(100vh - 97px);
  padding: 15px 0;
  overflow: hidden auto;
  position: relative;
  z-index: 1;
  width: 100%;
}

.layout-sidebar.dark {
  .side-name {
    color: #a8b8e8;
  }

  .item.active .hover-box {
    background: #4a5a7a;
    box-shadow: 0 4px 12px rgb(0 0 0 / 40%);
  }

  .line {
    background: linear-gradient(
      90deg,
      transparent,
      rgb(79 172 254 / 40%),
      rgb(151 180 247 / 50%),
      rgb(79 172 254 / 40%),
      transparent
    );
  }

  .hover-box {
    svg {
      color: #4facfe; /* 深色模式使用亮蓝色，确保清晰可见 */
    }

    &:hover {
      .side-name {
        color: #fff;
      }

      svg {
        color: #fff;
      }
    }
  }
}

.item {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  width: 100%;
  padding: 6px 10px;
  outline: none;

  &:focus,
  &:focus-visible {
    outline: none;
  }

  &.active {
    .hover-box {
      background: #97b4f7;
      box-shadow: 0 6px 16px rgb(64 158 255 / 30%);

      .side-name {
        font-weight: bold;
        color: #fff;
      }

      svg {
        color: #fff;
        filter: none;
      }
    }
  }
}

.hover-box {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 12px 0;
  overflow: hidden;
  cursor: pointer;
  border-radius: 16px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &.active {
    background: #97b4f7;
    box-shadow: 0 6px 16px rgb(64 158 255 / 30%);

    .side-name {
      font-weight: bold;
      color: #fff;
    }

    svg {
      color: #fff;
      filter: none;
    }
  }

  &:hover {
    background: rgb(207 216 240 / 40%);
    transform: translateY(-2px) scale(1.05);

    .side-name {
      color: #2d3a53;
    }

    svg {
      color: #97b4f7;
    }
  }

  svg {
    width: 25px;
    height: 25px;
    color: #5a6b8a;
    transition: all 0.3s ease;

    :deep(*) {
      fill: currentcolor;
      stroke: currentcolor;
    }
  }
}

.side-name {
  display: inline-block;
  max-width: 100%;
  margin-top: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #5a6b8a;
  text-align: center;
  white-space: nowrap;
  transition:
    transform 0.2s ease-in-out,
    color 0.3s;
}

.line {
  width: calc(100% - 16px);
  height: 2px;
  margin: 10px 8px;
  background: linear-gradient(
    90deg,
    transparent,
    rgb(96 79 253 / 40%),
    rgb(151 180 247 / 60%),
    rgb(96 79 253 / 40%),
    transparent
  );
  border-radius: 1px;

  &:last-child {
    display: none;
  }
}

.mobile-sidebar-toggle {
  display: none;
}

/* 侧边栏样式优化 - 独立显示，与左右保持距离 */

/* stylelint-disable-next-line order/order */
@media (max-width: 767px) {
  .layout-sidebar {
    --mobile-sidebar-easing: cubic-bezier(0.65, 0, 0.35, 1);
    top: calc(84px + var(--pure-safe-area-top, 0px));
    right: 12px;
    left: 12px;
    z-index: 120;
    width: auto;
    min-width: 0;
    height: 64px;
    min-height: 64px;
    max-height: none;
    border-radius: 22px;
    overflow: hidden;
    transition:
      width 0.42s var(--mobile-sidebar-easing),
      min-width 0.42s var(--mobile-sidebar-easing),
      box-shadow 0.42s var(--mobile-sidebar-easing),
      background 0.42s var(--mobile-sidebar-easing),
      border-radius 0.42s var(--mobile-sidebar-easing);

    &::after {
      border-radius: 22px;
      opacity: 0.55;
      animation-duration: 5s;
    }

    &.mobile-collapsed {
      right: auto;
      width: 64px;
      min-width: 64px;

      .layout-sidebar-scroll {
        opacity: 0;
        pointer-events: none;
        transform: translateX(-16px);
      }

      .mobile-sidebar-toggle {
        opacity: 1;
        pointer-events: auto;
      }
    }
  }

  .layout-sidebar-scroll {
    display: flex;
    flex-direction: row;
    gap: 10px;
    align-items: center;
    width: 100%;
    height: 100%;
    max-height: none;
    padding: 10px 12px;
    overflow: auto hidden;
    scroll-snap-type: x proximity;
    scroll-padding-inline: 12px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    transition:
      opacity 0.34s var(--mobile-sidebar-easing),
      transform 0.42s var(--mobile-sidebar-easing);

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .mobile-sidebar-toggle {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    gap: 6px;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 0;
    color: #5a6b8a;
    cursor: pointer;
    background: linear-gradient(
      135deg,
      rgb(255 255 255 / 92%),
      rgb(245 247 250 / 96%)
    );
    border: none;
    opacity: 0;
    pointer-events: none;
    transition:
      opacity 0.32s var(--mobile-sidebar-easing),
      color 0.32s var(--mobile-sidebar-easing),
      background 0.32s var(--mobile-sidebar-easing),
      transform 0.42s var(--mobile-sidebar-easing);

    &:active {
      transform: scale(0.98);
    }

    .toggle-active-icon,
    .toggle-arrow {
      color: currentcolor;
    }

    .toggle-active-icon {
      width: 20px;
      height: 20px;

      :deep(*) {
        fill: currentcolor;
        stroke: currentcolor;
      }
    }
  }

  .layout-sidebar.dark .mobile-sidebar-toggle {
    color: #dbeafe;
    background: linear-gradient(
      135deg,
      rgb(30 41 59 / 94%),
      rgb(15 23 42 / 96%)
    );
  }

  .layout-sidebar {
    .item {
      flex: 0 0 auto;
      width: auto;
      padding: 0;
      scroll-snap-align: start;

      &::after {
        display: none !important;
      }
    }

    .hover-box {
      flex-direction: row;
      gap: 8px;
      align-items: center;
      justify-content: center;
      width: auto;
      min-width: fit-content;
      max-width: calc(100vw - 72px);
      min-height: 0;
      padding: 12px 18px;
      background: transparent;
      border-radius: 18px;
      box-shadow: none;

      &.active {
        background: #97b4f7;
        box-shadow: 0 6px 16px rgb(64 158 255 / 22%);

        .side-name {
          color: #fff;
        }

        svg {
          color: #fff;
        }
      }

      &:hover {
        transform: translateY(-1px);
      }

      svg {
        width: 20px;
        height: 20px;
      }
    }

    .side-name {
      margin-top: 0;
      font-size: 13px;
      line-height: 1.1;
      white-space: nowrap;
    }

    .line {
      display: none;
    }
  }
}

/* stylelint-disable-next-line order/order */
@media (max-width: 479px) {
  .layout-sidebar {
    top: calc(82px + var(--pure-safe-area-top, 0px));
    right: 10px;
    left: 10px;
    height: 60px;
    min-height: 60px;

    &.mobile-collapsed {
      width: 60px;
      min-width: 60px;
    }
  }

  .layout-sidebar-scroll {
    padding: 8px 10px;
  }

  .layout-sidebar {
    .hover-box {
      max-width: calc(100vw - 64px);
      padding: 11px 15px;
    }

    .side-name {
      font-size: 12px;
    }
  }
}
</style>
