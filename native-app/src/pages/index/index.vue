<template>
  <view class="native-shell" :class="{ 'is-preview-phone': isPhonePreview }">
    <view v-if="showShellState" class="shell-state">
      <view class="brand-mark">
        <text class="brand-mark__text">启</text>
      </view>
      <text class="shell-title">IntellEdu</text>
      <text class="shell-subtitle">{{ stateText }}</text>
      <button v-if="loadError" class="retry-button" @click="reloadWebview">
        重新加载
      </button>
    </view>

    <!-- #ifdef H5 -->
    <view v-if="isH5DevPreview" class="preview-stage">
      <view class="preview-device">
        <view class="preview-device__speaker" />
        <iframe
          id="qiming-preview-frame"
          class="qiming-preview-frame"
          :src="webviewSrc"
          title="IntellEdu 客户端预览"
          @load="handleLoad"
        />
      </view>
      <view class="preview-toolbar">
        <view class="preview-entrybar">
          <button
            v-for="entry in previewEntries"
            :key="entry.path"
            class="preview-entrybar__button"
            :class="{
              'is-active': activePreviewEntry === resolvePreviewEntryPath(entry)
            }"
            @click="switchPreviewEntry(resolvePreviewEntryPath(entry))"
          >
            {{ entry.label }}
          </button>
        </view>
        <view class="preview-switcher">
          <button
            v-for="role in previewRoles"
            :key="role"
            class="preview-switcher__button"
            :class="{ 'is-active': previewRole === role }"
            @click="switchPreviewRole(role)"
          >
            {{ previewRoleLabels[role] }}
          </button>
        </view>
        <button class="preview-mode-button" @click="togglePreviewMode">
          {{ isPhonePreview ? "全屏" : "手机" }}
        </button>
      </view>
    </view>
    <!-- #endif -->

    <!-- #ifdef APP-PLUS -->
    <web-view
      id="qiming-webview"
      class="qiming-webview"
      :src="webviewSrc"
      :webview-styles="webviewStyles"
      :update-title="false"
      @load="handleLoad"
      @error="handleError"
      @message="handleMessage"
    />
    <!-- #endif -->
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onBackPress, onLoad, onShow } from "@dcloudio/uni-app";

type WebMessage = {
  source?: string;
  type?: string;
  href?: string;
  title?: string;
  online?: boolean;
  timestamp?: number;
};

const defaultEntryRoute = "/home";
const loaded = ref(false);
const loadError = ref(false);
const webviewVersion = ref(0);
const lastMessage = ref<WebMessage | null>(null);
const previewMode = ref<"phone" | "full">("phone");
const appEntryRoute = ref(defaultEntryRoute);
const appDevServer = ref("");
const appDemoRole = ref("");
const appNativeStatusTop = ref(0);
let loadFallbackTimer: ReturnType<typeof setTimeout> | null = null;

let isH5DevPreview = false;
// #ifdef H5
isH5DevPreview = import.meta.env.DEV;
// #endif

const localAppEntryBase = "./hybrid/html/index.html";
const previewRoles = ["student", "teacher", "admin"] as const;
type PreviewRole = (typeof previewRoles)[number];
type PreviewEntry = {
  label: string;
  path: string;
  studentPath?: string;
  teacherPath?: string;
  adminPath?: string;
};
const previewRoleLabels = {
  student: "学生",
  teacher: "教师",
  admin: "管理"
};
const previewEntries: readonly PreviewEntry[] = [
  {
    label: "工作台",
    path: "/welcome/index",
    studentPath: "/account?menu=home"
  },
  {
    label: "AI App",
    path: "/ai-app/workspace",
    studentPath: "/account/ai-app?mode=student",
    teacherPath: "/ai-app/workspace",
    adminPath: "/ai-app/workspace"
  },
  { label: "课程", path: "/course/list", studentPath: "/account?menu=course" },
  {
    label: "试卷",
    path: "/course/assessment",
    studentPath: "/account?menu=exam-center"
  },
  { label: "学生考试", path: "/student-exam-center/list" },
  {
    label: "用户",
    path: "/user/list",
    studentPath: "/account?menu=profile",
    teacherPath: "/account-settings"
  }
];

function isPreviewRole(role: string | null): role is PreviewRole {
  return !!role && (previewRoles as readonly string[]).includes(role);
}

function normalizeEntryRoute(route: string | null | undefined) {
  let value = route?.trim() || defaultEntryRoute;
  try {
    value = decodeURIComponent(value);
  } catch {
    value = defaultEntryRoute;
  }
  value = value.replace(/^#/, "");
  if (!value.startsWith("/")) value = `/${value}`;
  if (value.startsWith("//") || value.includes("://")) return defaultEntryRoute;
  return value;
}

function resolveEntryForRole(
  route: string | null | undefined,
  role: PreviewRole | ""
) {
  const normalized = normalizeEntryRoute(route);
  const normalizedPath = normalized.split("?")[0];
  if (role === "student" && normalizedPath === "/home") {
    return "/account?menu=home";
  }
  if (role === "teacher" || role === "admin") {
    if (
      normalizedPath === "/home" ||
      normalized === "/account?menu=home" ||
      normalized === "/account"
    ) {
      return "/welcome/index";
    }
    if (normalizedPath === "/account/ai-app") {
      return "/ai-app/workspace";
    }
  }
  return normalized;
}

const h5PreviewRole = ref<PreviewRole>("teacher");
const h5PreviewEntryRoute = ref(defaultEntryRoute);

function syncH5PreviewStateFromLocation() {
  if (!isH5DevPreview || typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const role = params.get("demoRole");
  h5PreviewRole.value = isPreviewRole(role) ? role : "teacher";
  h5PreviewEntryRoute.value = resolveEntryForRole(
    params.get("entry"),
    h5PreviewRole.value
  );
}

syncH5PreviewStateFromLocation();

function appendQuery(url: string, key: string, value: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${key}=${encodeURIComponent(value)}`;
}

function appendNativeQuery(url: string) {
  let output = appendQuery(url, "qimingNative", "1");
  if (appNativeStatusTop.value > 0) {
    output = appendQuery(
      output,
      "nativeStatusTop",
      String(appNativeStatusTop.value)
    );
  }
  return output;
}

function normalizeDevServer(url: string | null | undefined) {
  const value = url?.trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return parsed.origin;
  } catch {
    return "";
  }
}

function normalizeDemoRole(role: string | null | undefined) {
  return isPreviewRole(role || "") ? role || "" : "";
}

const previewRole = computed(() => {
  if (!isH5DevPreview || typeof window === "undefined") return "teacher";
  return h5PreviewRole.value;
});

const previewEntryRoute = computed(() => {
  if (!isH5DevPreview || typeof window === "undefined")
    return defaultEntryRoute;
  return h5PreviewEntryRoute.value;
});

const activePreviewEntry = computed(() => previewEntryRoute.value);

function resolvePreviewEntryPath(entry: PreviewEntry): string {
  if (previewRole.value === "student" && entry.studentPath) {
    return entry.studentPath;
  }
  if (previewRole.value === "teacher" && entry.teacherPath) {
    return entry.teacherPath;
  }
  if (previewRole.value === "admin" && entry.adminPath) {
    return entry.adminPath;
  }
  return entry.path;
}

const h5PreviewOrigin = computed(() => {
  if (!isH5DevPreview || typeof window === "undefined") {
    return "http://localhost:8851";
  }

  const params = new URLSearchParams(window.location.search);
  const host = window.location.hostname || "localhost";
  const port = params.get("h5Port") || "8851";
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  return `${protocol}//${host}:${port}`;
});

const h5DevEntryPath = computed(() =>
  appendNativeQuery(
    appendQuery(
      `${h5PreviewOrigin.value}/#${previewEntryRoute.value}`,
      "demoRole",
      previewRole.value
    )
  )
);

const webviewSrc = computed(() => {
  if (!isH5DevPreview) {
    if (appDevServer.value) {
      const base = `${appDevServer.value}/#${appEntryRoute.value}`;
      const withRole = appDemoRole.value
        ? appendQuery(base, "demoRole", appDemoRole.value)
        : base;
      return appendQuery(
        appendNativeQuery(withRole),
        "v",
        String(webviewVersion.value)
      );
    }
    return `${localAppEntryBase}?v=${webviewVersion.value}#${appEntryRoute.value}`;
  }

  const separator = h5DevEntryPath.value.includes("?") ? "&" : "?";
  return `${h5DevEntryPath.value}${separator}v=${webviewVersion.value}`;
});

const isPhonePreview = computed(
  () => isH5DevPreview && previewMode.value === "phone"
);

const showShellState = computed(
  () => !isH5DevPreview && (!loaded.value || loadError.value)
);

const webviewStyles = {
  progress: {
    color: "#2F7DFF"
  }
};

const stateText = computed(() => {
  if (loadError.value) return "页面加载失败，请检查离线资源或网络连接。";
  if (lastMessage.value?.type === "offline") {
    return "当前网络不可用，已保留本地页面。";
  }
  return "正在打开学习助手...";
});

function extractMessages(event: any): WebMessage[] {
  const data = event?.detail?.data;
  if (Array.isArray(data)) return data;
  if (data) return [data];
  return [];
}

function handleLoad() {
  loaded.value = true;
  loadError.value = false;
  clearLoadFallbackTimer();
}

function handleError(event: any) {
  loaded.value = false;
  loadError.value = true;
  clearLoadFallbackTimer();
  console.error("[QimingNative] web-view load failed", event);
}

function handleMessage(event: any) {
  const messages = extractMessages(event);
  const message = messages.find(item => item?.source === "qiming-h5");
  if (message) {
    lastMessage.value = message;
    if (message.type === "loaded" || message.type === "bridge-ready") {
      loaded.value = true;
      loadError.value = false;
      clearLoadFallbackTimer();
    }
  }
}

function reloadWebview() {
  loaded.value = false;
  loadError.value = false;
  webviewVersion.value += 1;
  scheduleLoadFallback();
}

function getRoleRootRoute() {
  if (appDemoRole.value === "student") return "/account";
  if (appDemoRole.value === "teacher" || appDemoRole.value === "admin") {
    return "/welcome/index";
  }
  return normalizeEntryRoute(appEntryRoute.value || defaultEntryRoute);
}

function buildRoleRootHash() {
  const rootRoute = getRoleRootRoute();
  let hash = `#${rootRoute}`;
  if (appDemoRole.value) {
    hash = appendQuery(hash, "demoRole", appDemoRole.value);
  }
  hash = appendQuery(hash, "qimingNative", "1");
  if (appNativeStatusTop.value > 0) {
    hash = appendQuery(
      hash,
      "nativeStatusTop",
      String(appNativeStatusTop.value)
    );
  }
  if (rootRoute === "/account") {
    hash = appendQuery(hash, "menu", "home");
  }
  return hash;
}

function resetToRoleRoot() {
  appEntryRoute.value = getRoleRootRoute();
  reloadWebview();
}

function dispatchBackToInnerWebview() {
  // #ifdef APP-PLUS
  try {
    const plusApi = (globalThis as any).plus;
    const currentWebview = plusApi?.webview?.currentWebview?.();
    const webviews = (plusApi?.webview?.all?.() || []) as Array<{
      id?: string;
      getURL?: () => string;
      evalJS?: (code: string) => void;
    }>;
    const candidates = webviews.filter(webview => {
      if (!webview || webview === currentWebview) return false;
      const url = webview.getURL?.() || "";
      return (
        (appDevServer.value && url.includes(appDevServer.value)) ||
        url.includes("hybrid/html/index.html") ||
        url.includes("#/")
      );
    });
    const target = candidates[candidates.length - 1];
    if (!target?.evalJS) return false;
    const fallbackHash = JSON.stringify(buildRoleRootHash());
    target.evalJS(`
      (function () {
        var fallbackHash = ${fallbackHash};
        var fallbackBase = fallbackHash.split("?")[0];
        function isAtFallbackRoot() {
          var hash = String(window.location && window.location.hash || "");
          if (fallbackBase === "#/account") {
            return hash.indexOf("#/account") === 0 && hash.indexOf("menu=home") !== -1;
          }
          return hash.indexOf(fallbackBase) === 0;
        }
        function forceFallbackRoot() {
          if (!isAtFallbackRoot()) {
            window.location.hash = fallbackHash;
          }
        }
        try {
          if (window.__qimingNativeBack) {
            window.__qimingNativeBack();
          } else if (window.history && window.history.length > 1) {
            window.history.back();
          }
        } catch (error) {
          forceFallbackRoot();
        }
        window.setTimeout(forceFallbackRoot, 220);
        window.setTimeout(forceFallbackRoot, 640);
      })();
    `);
    return true;
  } catch (error) {
    console.warn("[QimingNative] native back dispatch failed", error);
    return false;
  }
  // #endif
  return false;
}

function clearLoadFallbackTimer() {
  if (loadFallbackTimer) {
    clearTimeout(loadFallbackTimer);
    loadFallbackTimer = null;
  }
}

function scheduleLoadFallback() {
  clearLoadFallbackTimer();
  if (!appDevServer.value) return;
  loadFallbackTimer = setTimeout(() => {
    // HBuilderX devServer 调试时，外层 uni-app 不一定收到内嵌 web-view 的
    // load/message 事件；只要没有 error，就撤掉 loading 层，避免白屏遮住 H5。
    if (!loadError.value) loaded.value = true;
  }, 6000);
}

function detectNativeStatusTop() {
  // #ifdef APP-PLUS
  try {
    const plusApi = (globalThis as any).plus;
    const statusTop = Number(plusApi?.navigator?.getStatusbarHeight?.() || 0);
    if (Number.isFinite(statusTop) && statusTop > 0) {
      appNativeStatusTop.value = statusTop;
    }
  } catch (error) {
    console.warn("[QimingNative] statusbar height unavailable", error);
  }
  // #endif
}

function switchPreviewRole(role: PreviewRole) {
  if (!isH5DevPreview || typeof window === "undefined") return;
  const entryRoute = resolveEntryForRole(h5PreviewEntryRoute.value, role);
  const url = new URL(window.location.href);
  url.searchParams.set("demoRole", role);
  url.searchParams.set("entry", entryRoute);
  window.history.replaceState(null, "", url);
  h5PreviewRole.value = role;
  h5PreviewEntryRoute.value = entryRoute;
  reloadWebview();
}

function switchPreviewEntry(entryPath: string) {
  if (!isH5DevPreview || typeof window === "undefined") return;
  const normalizedEntry = normalizeEntryRoute(entryPath);
  const url = new URL(window.location.href);
  url.searchParams.set("entry", normalizedEntry);
  window.history.replaceState(null, "", url);
  h5PreviewEntryRoute.value = normalizedEntry;
  reloadWebview();
}

function togglePreviewMode() {
  previewMode.value = previewMode.value === "phone" ? "full" : "phone";
}

onLoad(options => {
  detectNativeStatusTop();
  const pageOptions = options as {
    entry?: string;
    devServer?: string;
    demoRole?: string;
  };
  appDemoRole.value = normalizeDemoRole(pageOptions?.demoRole);
  appEntryRoute.value = resolveEntryForRole(
    pageOptions?.entry,
    appDemoRole.value
  );
  appDevServer.value = normalizeDevServer(pageOptions?.devServer);
  scheduleLoadFallback();
  uni.setNavigationBarTitle({ title: "IntellEdu" });
});

onShow(() => {
  detectNativeStatusTop();
  uni.setKeepScreenOn({ keepScreenOn: true });
});

onBackPress(() => {
  if (!dispatchBackToInnerWebview()) {
    resetToRoleRoot();
  }
  return true;
});
</script>

<style scoped>
.native-shell {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  min-height: 100%;
  overflow: hidden;
  background: #f7f8fc;
}

.qiming-webview,
.qiming-preview-frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}

.qiming-webview {
  position: absolute;
  inset: 0;
}

.preview-stage {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 14rpx;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 18rpx;
  background:
    radial-gradient(circle at 50% 0%, rgba(47, 125, 255, 0.1), transparent 34%),
    #eef2f8;
}

.preview-device {
  position: relative;
  flex: 1 1 auto;
  width: 100%;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background: #fff;
}

.native-shell.is-preview-phone .preview-stage {
  align-items: center;
  padding: 24rpx 24rpx calc(18rpx + env(safe-area-inset-bottom, 0px));
}

.native-shell.is-preview-phone .preview-device {
  flex: 0 1 auto;
  width: min(393px, calc(100vw - 32px));
  height: min(852px, calc(100dvh - 178rpx));
  border: 1rpx solid rgba(122, 137, 166, 0.26);
  border-radius: 42rpx;
  box-shadow:
    0 32rpx 96rpx rgba(47, 67, 103, 0.22),
    0 0 0 10rpx rgba(255, 255, 255, 0.54);
}

.preview-device__speaker {
  display: none;
}

.native-shell.is-preview-phone .preview-device__speaker {
  position: absolute;
  top: 14rpx;
  left: 50%;
  z-index: 3;
  display: block;
  width: 96rpx;
  height: 10rpx;
  border-radius: 999rpx;
  background: rgba(31, 41, 55, 0.18);
  transform: translateX(-50%);
}

.preview-toolbar {
  position: relative;
  z-index: 10;
  display: flex;
  flex: 0 0 auto;
  gap: 10rpx;
  align-items: center;
  justify-content: flex-end;
  width: min(100%, 1320rpx);
  pointer-events: none;
}

.preview-entrybar,
.preview-switcher {
  display: flex;
  gap: 8rpx;
  padding: 8rpx;
  border: 1rpx solid rgba(204, 213, 230, 0.8);
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 12rpx 36rpx rgba(47, 84, 158, 0.16);
  pointer-events: auto;
}

.preview-entrybar {
  max-width: min(920rpx, calc(100vw - 380rpx));
  overflow-x: auto;
}

.preview-entrybar::-webkit-scrollbar {
  display: none;
}

.preview-entrybar__button,
.preview-switcher__button {
  height: 48rpx;
  min-width: 76rpx;
  padding: 0 18rpx;
  border: 0;
  border-radius: 999rpx;
  color: #667085;
  font-size: 22rpx;
  line-height: 48rpx;
  white-space: nowrap;
  background: transparent;
}

.preview-entrybar__button::after,
.preview-switcher__button::after {
  border: 0;
}

.preview-entrybar__button.is-active,
.preview-switcher__button.is-active {
  color: #fff;
  background: #2f7dff;
}

.preview-mode-button {
  height: 64rpx;
  min-width: 88rpx;
  padding: 0 22rpx;
  border: 1rpx solid rgba(204, 213, 230, 0.88);
  border-radius: 999rpx;
  color: #344054;
  font-size: 22rpx;
  line-height: 64rpx;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 12rpx 36rpx rgba(47, 84, 158, 0.14);
  pointer-events: auto;
}

.preview-mode-button::after {
  border: 0;
}

.shell-state {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
  background:
    radial-gradient(
      circle at 50% 20%,
      rgba(94, 127, 248, 0.1),
      transparent 42%
    ),
    #f7f8fc;
}

.brand-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 112rpx;
  height: 112rpx;
  margin-bottom: 28rpx;
  border-radius: 32rpx;
  background: #2f7dff;
  box-shadow: 0 20rpx 48rpx rgba(47, 125, 255, 0.24);
}

.brand-mark__text {
  color: #fff;
  font-size: 48rpx;
  font-weight: 700;
}

.shell-title {
  color: #172033;
  font-size: 40rpx;
  font-weight: 700;
  line-height: 1.3;
}

.shell-subtitle {
  max-width: 560rpx;
  margin-top: 16rpx;
  color: #68748a;
  font-size: 28rpx;
  line-height: 1.5;
  text-align: center;
}

.retry-button {
  min-width: 208rpx;
  height: 88rpx;
  margin-top: 36rpx;
  padding: 0 36rpx;
  border: 0;
  border-radius: 44rpx;
  color: #fff;
  font-size: 28rpx;
  line-height: 88rpx;
  background: #2f7dff;
}

@media (max-width: 760px) {
  .preview-toolbar {
    flex-wrap: wrap;
  }

  .preview-entrybar {
    order: -1;
    width: 100%;
    max-width: none;
  }
}
</style>
