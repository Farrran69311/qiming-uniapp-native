<template>
  <view class="native-shell" :class="{ 'is-preview-phone': isPhonePreview }">
    <view v-if="!loaded || loadError" class="shell-state">
      <view class="brand-mark">
        <text class="brand-mark__text">启</text>
      </view>
      <text class="shell-title">启明智教</text>
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
          title="启明智教客户端预览"
          @load="handleLoad"
        />
      </view>
      <view class="preview-toolbar">
        <view class="preview-entrybar">
          <button
            v-for="entry in previewEntries"
            :key="entry.path"
            class="preview-entrybar__button"
            :class="{ 'is-active': activePreviewEntry === entry.path }"
            @click="switchPreviewEntry(entry.path)"
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
const previewMode = ref<"phone" | "full">("full");
const appEntryRoute = ref(defaultEntryRoute);

let isH5DevPreview = false;
// #ifdef H5
isH5DevPreview = import.meta.env.DEV;
// #endif

const localAppEntryBase = "./hybrid/html/index.html";
const previewRoles = ["student", "teacher", "admin"] as const;
type PreviewRole = (typeof previewRoles)[number];
const previewRoleLabels = {
  student: "学生",
  teacher: "教师",
  admin: "管理"
};
const previewEntries = [
  { label: "工作台", path: "/welcome/index" },
  { label: "AI App", path: "/account/ai-app" },
  { label: "课程", path: "/account" },
  { label: "试卷", path: "/exam-paper/index" },
  { label: "学生考试", path: "/student-exam-center/list" },
  { label: "用户", path: "/user/list" }
] as const;

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

function appendQuery(url: string, key: string, value: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${key}=${encodeURIComponent(value)}`;
}

const previewRole = computed(() => {
  if (!isH5DevPreview || typeof window === "undefined") return "teacher";
  const role = new URLSearchParams(window.location.search).get("demoRole");
  return isPreviewRole(role) ? role : "teacher";
});

const previewEntryRoute = computed(() => {
  if (!isH5DevPreview || typeof window === "undefined") return defaultEntryRoute;
  const entry = new URLSearchParams(window.location.search).get("entry");
  return normalizeEntryRoute(entry);
});

const activePreviewEntry = computed(() => previewEntryRoute.value);

const h5DevEntryPath = computed(() =>
  appendQuery(
    `http://localhost:8851/#${previewEntryRoute.value}`,
    "demoRole",
    previewRole.value
  )
);

const webviewSrc = computed(() => {
  if (!isH5DevPreview) {
    return `${localAppEntryBase}?v=${webviewVersion.value}#${appEntryRoute.value}`;
  }

  const separator = h5DevEntryPath.value.includes("?") ? "&" : "?";
  return `${h5DevEntryPath.value}${separator}v=${webviewVersion.value}`;
});

const isPhonePreview = computed(
  () => isH5DevPreview && previewMode.value === "phone"
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
}

function handleError(event: any) {
  loaded.value = false;
  loadError.value = true;
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
    }
  }
}

function reloadWebview() {
  loaded.value = false;
  loadError.value = false;
  webviewVersion.value += 1;
}

function switchPreviewRole(role: PreviewRole) {
  if (!isH5DevPreview || typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("demoRole", role);
  window.history.replaceState(null, "", url);
  reloadWebview();
}

function switchPreviewEntry(entryPath: string) {
  if (!isH5DevPreview || typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("entry", normalizeEntryRoute(entryPath));
  window.history.replaceState(null, "", url);
  reloadWebview();
}

function togglePreviewMode() {
  previewMode.value = previewMode.value === "phone" ? "full" : "phone";
}

onLoad(options => {
  appEntryRoute.value = normalizeEntryRoute(
    (options as { entry?: string })?.entry
  );
  uni.setNavigationBarTitle({ title: "启明智教" });
});

onShow(() => {
  uni.setKeepScreenOn({ keepScreenOn: true });
});

onBackPress(() => {
  uni.showModal({
    title: "退出应用",
    content: "确定要退出启明智教吗？",
    confirmText: "退出",
    cancelText: "继续学习",
    success(result) {
      if (result.confirm) {
        // #ifdef APP-PLUS
        plus.runtime.quit();
        // #endif
      }
    }
  });
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
  align-items: stretch;
  justify-content: center;
  width: 100%;
  height: 100%;
  background:
    radial-gradient(circle at 50% 0%, rgba(47, 125, 255, 0.1), transparent 34%),
    #eef2f8;
}

.preview-device {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #fff;
}

.native-shell.is-preview-phone .preview-stage {
  align-items: center;
  padding: 28rpx;
}

.native-shell.is-preview-phone .preview-device {
  width: min(393px, calc(100vw - 32px));
  height: min(852px, calc(100dvh - 32px));
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
  position: absolute;
  right: 20rpx;
  bottom: calc(24rpx + env(safe-area-inset-bottom, 0px));
  left: 20rpx;
  z-index: 10;
  display: flex;
  gap: 10rpx;
  align-items: center;
  justify-content: flex-end;
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
    radial-gradient(circle at 50% 20%, rgba(94, 127, 248, 0.1), transparent 42%),
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
    right: 14rpx;
    bottom: calc(18rpx + env(safe-area-inset-bottom, 0px));
    left: 14rpx;
    flex-wrap: wrap;
  }

  .preview-entrybar {
    order: -1;
    width: 100%;
    max-width: none;
  }
}
</style>
