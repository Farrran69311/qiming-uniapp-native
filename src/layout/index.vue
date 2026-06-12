<script setup lang="ts">
import "animate.css";
// 引入 src/components/ReIcon/src/offlineIcon.ts 文件中所有使用addIcon添加过的本地图标
import "@/components/ReIcon/src/offlineIcon";
import { setType } from "./types";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { useLayout } from "./hooks/useLayout";
import { useAppStoreHook } from "@/store/modules/app";
import { useSettingStoreHook } from "@/store/modules/settings";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";
import {
  h,
  ref,
  reactive,
  computed,
  watch,
  onMounted,
  onBeforeMount,
  defineComponent
} from "vue";
import { useDark, useGlobal, useResizeObserver } from "@pureadmin/utils";

import LayTag from "./components/lay-tag/index.vue";
import LayNavbar from "./components/lay-navbar/index.vue";
import LayContent from "./components/lay-content/index.vue";
import LaySetting from "./components/lay-setting/index.vue";
import NavVertical from "./components/lay-sidebar/NavVertical.vue";
import NavHorizontal from "./components/lay-sidebar/NavHorizontal.vue";
import NavMobile from "./components/NavMobile.vue";
import BackTopIcon from "@/assets/svg/back_top.svg?component";

const { t } = useI18n();
const route = useRoute();
const appWrapperRef = ref();
const { isDark } = useDark();
const { layout } = useLayout();
const appStore = useAppStoreHook();
const pureSetting = useSettingStoreHook();
const { $storage } = useGlobal<GlobalPropertiesApi>();

const set: setType = reactive({
  sidebar: computed(() => {
    return appStore.sidebar;
  }),

  device: computed(() => {
    return appStore.device;
  }),

  fixedHeader: computed(() => {
    return pureSetting.fixedHeader;
  }),

  classes: computed(() => {
    return {
      hideSidebar: !set.sidebar.opened,
      openSidebar: set.sidebar.opened,
      withoutAnimation: set.sidebar.withoutAnimation,
      mobile: set.device === "mobile"
    };
  }),

  hideTabs: computed(() => {
    return $storage?.configure.hideTabs;
  })
});

function setTheme(layoutModel: string) {
  window.document.body.setAttribute("layout", layoutModel);
  $storage.layout = {
    layout: `${layoutModel}`,
    theme: $storage.layout?.theme,
    darkMode: $storage.layout?.darkMode,
    sidebarStatus: $storage.layout?.sidebarStatus,
    epThemeColor: $storage.layout?.epThemeColor,
    themeColor: $storage.layout?.themeColor,
    overallStyle: $storage.layout?.overallStyle
  };
}

function toggle(device: "mobile" | "desktop", bool: boolean) {
  appStore.toggleDevice(device);
  appStore.toggleSideBar(bool, "resize");
}

// 判断是否可自动关闭菜单栏
let isAutoCloseSidebar = true;

useResizeObserver(appWrapperRef, entries => {
  const entry = entries[0];
  const borderBox = Array.isArray(entry.borderBoxSize)
    ? entry.borderBoxSize[0]
    : entry.borderBoxSize;
  const width = borderBox?.inlineSize ?? entry.contentRect.width;
  const height = borderBox?.blockSize ?? entry.contentRect.height;
  const wasMobileLayout = appStore.getDevice === "mobile";

  appStore.setViewportSize({ width, height });
  appStore.refreshUA(width);

  const forceMobileLayout = appStore.getUA.isMobile || appStore.getUA.isTablet;
  if (forceMobileLayout) {
    setTheme("vertical");
    if (!wasMobileLayout) {
      toggle("mobile", false);
    } else {
      appStore.toggleDevice("mobile");
    }
    isAutoCloseSidebar = true;
    return;
  }

  width <= 760 ? setTheme("vertical") : setTheme(appStore.layout);
  /** width app-wrapper类容器宽度
   * 0 < width <= 760 隐藏侧边栏
   * 760 < width <= 990 折叠侧边栏
   * width > 990 展开侧边栏
   */
  if (width > 0 && width <= 760) {
    toggle("mobile", false);
    isAutoCloseSidebar = true;
  } else if (width > 760 && width <= 990) {
    if (isAutoCloseSidebar) {
      toggle("desktop", false);
      isAutoCloseSidebar = false;
    }
  } else if (width > 990 && !set.sidebar.isClickCollapse) {
    toggle("desktop", true);
    isAutoCloseSidebar = true;
  } else {
    toggle("desktop", false);
    isAutoCloseSidebar = false;
  }
});

onMounted(() => {
  const width = document.documentElement.clientWidth;
  const height = document.documentElement.clientHeight;
  appStore.setViewportSize({ width, height });
  appStore.refreshUA(width);

  if (appStore.getDevice === "mobile") {
    setTheme("vertical");
    toggle("mobile", false);
  }
});

watch(
  () => route.fullPath,
  () => {
    if (set.device === "mobile" && set.sidebar.opened) {
      appStore.toggleSideBar(false, "resize");
    }
  }
);

onBeforeMount(() => {
  useDataThemeChange().dataThemeChange($storage.layout?.overallStyle);
});

const LayHeader = defineComponent({
  name: "LayHeader",
  render() {
    return h(
      "div",
      {
        class: { "fixed-header": set.fixedHeader },
        style: [
          set.hideTabs && layout.value.includes("horizontal")
            ? isDark.value
              ? "box-shadow: 0 1px 4px #0d0d0d"
              : "box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08)"
            : ""
        ]
      },
      {
        default: () => [
          !pureSetting.hiddenSideBar && /vertical|mix|double/.test(layout.value)
            ? h(LayNavbar)
            : null,
          !pureSetting.hiddenSideBar && layout.value.includes("horizontal")
            ? h(NavHorizontal)
            : null,
          set.device !== "mobile" ? h(LayTag) : null
        ]
      }
    );
  }
});
</script>

<template>
  <div ref="appWrapperRef" :class="['app-wrapper', set.classes]">
    <div
      v-show="
        set.device === 'mobile' &&
        set.sidebar.opened &&
        layout.includes('vertical')
      "
      class="app-mask"
      @click="appStore.toggleSideBar(false, 'resize')"
    />
    <NavVertical
      v-show="
        !pureSetting.hiddenSideBar &&
        (layout.includes('vertical') ||
          layout.includes('mix') ||
          layout.includes('double'))
      "
    />
    <div
      :class="[
        'main-container',
        pureSetting.hiddenSideBar ? 'main-hidden' : '',
        set.device === 'mobile' ? 'mobile-main-container' : ''
      ]"
    >
      <div v-if="set.fixedHeader">
        <LayHeader />
        <!-- 主体内容 -->
        <LayContent :fixed-header="set.fixedHeader" />
      </div>
      <el-scrollbar v-else>
        <el-backtop
          :title="t('buttons.pureBackTop')"
          :right="10"
          :bottom="10"
          target=".main-container .el-scrollbar__wrap"
        >
          <BackTopIcon />
        </el-backtop>
        <LayHeader />
        <!-- 主体内容 -->
        <LayContent :fixed-header="set.fixedHeader" />
      </el-scrollbar>
    </div>
    <!-- 系统设置 -->
    <LaySetting />
    <!-- 移动端底部导航 -->
    <NavMobile v-if="set.device === 'mobile'" />
  </div>
</template>

<style lang="scss" scoped>
.app-wrapper {
  position: relative;
  width: 100%;
  height: 100%;

  &.mobile {
    .main-container {
      margin-left: 0 !important;
    }

    .mobile-main-container {
      padding-bottom: var(--pure-mobile-tab-height); // 预留底部导航高度
    }
  }

  &::after {
    clear: both;
    display: table;
    content: "";
  }

  &.mobile.openSidebar {
    position: fixed;
    top: 0;
  }
}

.app-mask {
  position: absolute;
  top: 0;
  z-index: 2001;
  width: 100%;
  height: 100%;
  background: #000;
  opacity: 0.3;
}

.re-screen {
  margin-top: 12px;
}
</style>
