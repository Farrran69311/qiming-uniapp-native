<script setup lang="ts">
import { useI18n } from "vue-i18n";
import LayFrame from "../lay-frame/index.vue";
import LayFooter from "../lay-footer/index.vue";
import { useTags } from "@/layout/hooks/useTag";
import { useAppStoreHook } from "@/store/modules/app";
import { useGlobal, isNumber } from "@pureadmin/utils";
import BackTopIcon from "@/assets/svg/back_top.svg?component";
import {
  h,
  watch,
  nextTick,
  computed,
  Transition,
  defineComponent,
  type CSSProperties
} from "vue";
import { useRoute } from "vue-router";
import { usePermissionStoreHook } from "@/store/modules/permission";

const props = defineProps({
  fixedHeader: Boolean
});

const appStore = useAppStoreHook();
const route = useRoute();
const { t } = useI18n();
const { showModel } = useTags();
const { $storage, $config } = useGlobal<GlobalPropertiesApi>();

const isKeepAlive = computed(() => {
  return $config?.KeepAlive;
});

const transitions = computed(() => {
  return route => {
    return route.meta.transition;
  };
});

const hideTabs = computed(() => {
  return $storage?.configure?.hideTabs ?? false;
});

const hideFooter = computed(() => {
  return ($storage?.configure?.hideFooter ?? false) || route.meta?.hideFooter === true;
});

const stretch = computed(() => {
  return $storage?.configure?.stretch ?? false;
});

const isMobile = computed(() => appStore.getDevice === "mobile");

const getMainWidth = computed(() => {
  return isNumber(stretch.value)
    ? stretch.value + "px"
    : stretch.value
      ? "1440px"
      : "100%";
});

const mobileFooterOffset = computed(() => {
  return isMobile.value ? "calc(var(--pure-mobile-tab-height) + 16px)" : "0px";
});

function getNativeSafeAreaTop() {
  if (typeof window === "undefined") return 0;
  if (!document.documentElement.classList.contains("qiming-native-webview")) {
    return 0;
  }
  const rawValue = getComputedStyle(document.documentElement)
    .getPropertyValue("--pure-safe-area-top")
    .trim();
  const safeTop = Number.parseFloat(rawValue);
  return Number.isFinite(safeTop) ? safeTop : 0;
}

function resetMobileScrollPosition() {
  if (typeof window === "undefined" || !isMobile.value) return;

  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  window.scrollTo({ left: 0, top: 0 });

  [
    ".main-container > .el-scrollbar .el-scrollbar__wrap",
    ".main-container .app-main .el-scrollbar__wrap",
    ".main-container",
    ".app-main",
    ".app-main-nofixed-header"
  ].forEach(selector => {
    document.querySelectorAll<HTMLElement>(selector).forEach(el => {
      el.scrollTop = 0;
      el.scrollLeft = 0;
    });
  });
}

watch(
  () => route.fullPath,
  () => {
    if (!isMobile.value) return;

    nextTick(() => {
      resetMobileScrollPosition();
      requestAnimationFrame(resetMobileScrollPosition);
      window.setTimeout(resetMobileScrollPosition, 160);
    });
  },
  { immediate: true }
);

const fixedScrollWrapStyle = computed<CSSProperties>(() => {
  return {
    display: "flex",
    width: "100%",
    flexWrap: "wrap",
    maxWidth: getMainWidth.value,
    margin: "0 auto",
    transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)"
  };
});

const fixedScrollViewStyle = computed<CSSProperties>(() => {
  return {
    display: "flex",
    flex: "auto",
    overflow: "hidden",
    flexDirection: "column",
    boxSizing: "border-box",
    paddingBottom: mobileFooterOffset.value
  };
});

const getSectionStyle = computed<CSSProperties>(() => {
  const nativeSafeAreaTop = isMobile.value ? getNativeSafeAreaTop() : 0;
  const headerOnlyHeight = isMobile.value ? 64 + nativeSafeAreaTop : 72;
  const headerWithTagsHeight = isMobile.value
    ? 64 + nativeSafeAreaTop
    : showModel.value == "chrome"
      ? 116
      : 112;

  if (props.fixedHeader) {
    return {
      paddingTop: `${hideTabs.value ? headerOnlyHeight : headerWithTagsHeight}px`
    };
  }

  return {
    paddingTop: "0",
    minHeight: `calc(100vh - ${
      hideTabs.value ? headerOnlyHeight : headerWithTagsHeight
    }px)`,
    boxSizing: "border-box",
    paddingBottom: mobileFooterOffset.value
  };
});

const transitionMain = defineComponent({
  props: {
    route: {
      type: undefined,
      required: true
    }
  },
  render() {
    const disableNativeMobileTransition =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("qiming-native-webview") &&
      document.documentElement.classList.contains("ua-mobile");
    const transitionName =
      transitions.value(this.route)?.name || "fade-transform";
    const enterTransition = transitions.value(this.route)?.enterTransition;
    const leaveTransition = transitions.value(this.route)?.leaveTransition;
    return h(
      Transition,
      {
        name: disableNativeMobileTransition
          ? undefined
          : enterTransition
            ? "pure-classes-transition"
            : transitionName,
        enterActiveClass:
          !disableNativeMobileTransition && enterTransition
            ? `animate__animated ${enterTransition}`
            : undefined,
        leaveActiveClass:
          !disableNativeMobileTransition && leaveTransition
            ? `animate__animated ${leaveTransition}`
            : undefined,
        mode: "out-in",
        appear: !disableNativeMobileTransition
      },
      {
        default: () => [this.$slots.default()]
      }
    );
  }
});
</script>

<template>
  <section
    :class="[fixedHeader ? 'app-main' : 'app-main-nofixed-header']"
    :style="getSectionStyle"
  >
    <router-view>
      <template #default="{ Component, route }">
        <LayFrame :currComp="Component" :currRoute="route">
          <template #default="{ Comp, fullPath, frameInfo }">
            <el-scrollbar
              v-if="fixedHeader"
              :wrap-style="fixedScrollWrapStyle"
              :view-style="fixedScrollViewStyle"
            >
              <el-backtop
                :title="t('buttons.pureBackTop')"
                :right="10"
                :bottom="10"
                target=".app-main .el-scrollbar__wrap"
              >
                <BackTopIcon />
              </el-backtop>
              <div class="grow">
                <transitionMain :route="route">
                  <keep-alive
                    v-if="isKeepAlive"
                    :include="usePermissionStoreHook().cachePageList"
                  >
                    <component
                      :is="Comp"
                      :key="fullPath"
                      :frameInfo="frameInfo"
                      class="main-content"
                    />
                  </keep-alive>
                  <component
                    :is="Comp"
                    v-else
                    :key="fullPath"
                    :frameInfo="frameInfo"
                    class="main-content"
                  />
                </transitionMain>
              </div>
              <LayFooter v-if="!hideFooter" />
            </el-scrollbar>
            <div v-else class="grow">
              <transitionMain :route="route">
                <keep-alive
                  v-if="isKeepAlive"
                  :include="usePermissionStoreHook().cachePageList"
                >
                  <component
                    :is="Comp"
                    :key="fullPath"
                    :frameInfo="frameInfo"
                    class="main-content"
                  />
                </keep-alive>
                <component
                  :is="Comp"
                  v-else
                  :key="fullPath"
                  :frameInfo="frameInfo"
                  class="main-content"
                />
              </transitionMain>
            </div>
          </template>
        </LayFrame>
      </template>
    </router-view>

    <LayFooter v-if="!hideFooter && !fixedHeader" />
  </section>
</template>

<style scoped>
.app-main {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow-x: hidden;
}

.app-main-nofixed-header {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
}

.main {
  margin: 10px;
}
</style>
