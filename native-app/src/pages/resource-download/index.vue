<template>
  <view class="resource-download-page">
    <view class="resource-summary">
      <text class="resource-kind">{{ kindLabel }}</text>
      <text class="resource-title">{{ resourceTitle }}</text>
      <text class="resource-status" :class="`is-${phase}`">
        {{ statusText }}
      </text>

      <view v-if="phase === 'downloading'" class="progress-area">
        <progress
          class="download-progress"
          :percent="progress"
          :stroke-width="6"
          active-color="#2563eb"
          background-color="#dfe4ea"
        />
        <text class="progress-value">{{ progress }}%</text>
      </view>

      <text v-if="errorText" class="error-text">{{ errorText }}</text>
      <text v-if="openError" class="open-error-text">{{ openError }}</text>
    </view>

    <view v-if="readyFilePath && isImage" class="media-preview image-preview">
      <image
        class="preview-image"
        :src="readyFilePath"
        mode="aspectFit"
        @click="previewImage"
      />
    </view>

    <view v-if="readyFilePath && isVideo" class="media-preview">
      <video
        class="preview-video"
        :src="readyFilePath"
        controls
        playsinline
        object-fit="contain"
      />
    </view>

    <view v-if="readyFilePath && isAudio" class="media-preview audio-preview">
      <audio
        class="preview-audio"
        :src="readyFilePath"
        :name="resourceTitle"
        controls
      />
    </view>

    <scroll-view
      v-if="phase === 'ready' && isTextResource && textPreviewReady"
      class="text-preview"
      scroll-y
      enhanced
      :show-scrollbar="true"
    >
      <text class="text-preview__content" selectable user-select>
        {{ textPreview || "文档内容为空。" }}
      </text>
      <text v-if="textPreviewTruncated" class="text-preview__notice">
        文档较长，当前显示前 512 KB 内容。
      </text>
    </scroll-view>

    <view class="resource-actions">
      <button
        v-if="phase === 'error' && resourceUrl"
        class="action-button is-primary"
        @click="startDownload"
      >
        重新下载
      </button>
      <button
        v-else-if="phase === 'ready' && isImage"
        class="action-button is-primary"
        @click="previewImage"
      >
        查看图片
      </button>
      <button
        v-else-if="phase === 'ready' && canOpenDocument"
        class="action-button is-primary"
        @click="openDownloadedDocument"
      >
        打开文件
      </button>
      <button
        v-else-if="phase === 'ready' && !isMedia && !isTextResource"
        class="action-button is-primary"
        @click="openDownloadedDocument"
      >
        尝试打开
      </button>
      <button
        v-if="phase === 'ready' && isTextResource && textPreviewReady"
        class="action-button is-primary"
        @click="copyTextPreview"
      >
        复制内容
      </button>
      <button
        v-else-if="phase === 'ready' && isTextResource"
        class="action-button is-primary"
        :disabled="textPreviewLoading"
        @click="reloadTextPreview"
      >
        {{ textPreviewLoading ? "正在读取" : "重新读取" }}
      </button>
      <button
        v-if="phase === 'ready'"
        class="action-button is-secondary"
        @click="startDownload"
      >
        重新下载
      </button>
      <button class="action-button is-secondary" @click="returnToLearningPage">
        返回学习平台
      </button>
    </view>

    <text v-if="phase === 'ready'" class="saved-hint">
      {{ savedHint }}
    </text>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";

type DownloadPhase = "idle" | "downloading" | "opening" | "ready" | "error";
type ResourceKind =
  | "html"
  | "markdown"
  | "text"
  | "mindmap"
  | "json"
  | "docx"
  | "pptx"
  | "spreadsheet"
  | "pdf"
  | "video"
  | "audio"
  | "image"
  | "unsupported";

interface NativeDownloadPayload {
  url?: string;
  title?: string;
  kind?: string;
  mime?: string;
  createdAt?: number;
  returnRoute?: string;
}

const nativeDownloadPayloadPrefix = "qiming.resource-download.payload.";
const nativeDownloadAckPrefix = "qiming.resource-download.ack.";
let isMiniProgramRuntime = false;
// #ifdef MP-WEIXIN
isMiniProgramRuntime = true;
// #endif

const resourceKinds: readonly ResourceKind[] = [
  "html",
  "markdown",
  "text",
  "mindmap",
  "json",
  "docx",
  "pptx",
  "spreadsheet",
  "pdf",
  "video",
  "audio",
  "image",
  "unsupported"
];
const documentKinds: readonly ResourceKind[] = [
  "docx",
  "pptx",
  "spreadsheet",
  "pdf"
];
const textKinds: readonly ResourceKind[] = [
  "html",
  "markdown",
  "text",
  "mindmap",
  "json"
];
const textPreviewByteLimit = 512 * 1024;
const kindLabels: Record<ResourceKind, string> = {
  html: "HTML 互动资料",
  markdown: "Markdown 文档",
  text: "文本文件",
  mindmap: "思维导图",
  json: "结构化资料",
  docx: "Word 文档",
  pptx: "演示文稿",
  spreadsheet: "电子表格",
  pdf: "PDF 文档",
  video: "视频资料",
  audio: "音频资料",
  image: "图片资料",
  unsupported: "课程文件"
};

const phase = ref<DownloadPhase>("idle");
const progress = ref(0);
const resourceUrl = ref("");
const resourceTitle = ref("课程资料");
const resourceKind = ref<ResourceKind>("unsupported");
const mimeType = ref("");
const returnRoute = ref("/home");
const tempFilePath = ref("");
const savedFilePath = ref("");
const errorText = ref("");
const openError = ref("");
const textPreview = ref("");
const textPreviewLoading = ref(false);
const textPreviewReady = ref(false);
const textPreviewTruncated = ref(false);
let downloadTask: UniNamespace.DownloadTask | null = null;

const kindLabel = computed(() => kindLabels[resourceKind.value]);
const isImage = computed(() => resourceKind.value === "image");
const isVideo = computed(() => resourceKind.value === "video");
const isAudio = computed(() => resourceKind.value === "audio");
const isMedia = computed(() => isImage.value || isVideo.value || isAudio.value);
const isTextResource = computed(() => textKinds.includes(resourceKind.value));
const canOpenDocument = computed(() =>
  documentKinds.includes(resourceKind.value)
);
const readyFilePath = computed(() => savedFilePath.value || tempFilePath.value);
const statusText = computed(() => {
  if (phase.value === "downloading") return "正在下载资源，请保持网络连接";
  if (textPreviewLoading.value) return "正在读取文档内容";
  if (phase.value === "opening") return "正在调用系统预览";
  if (phase.value === "ready") {
    if (isTextResource.value) {
      return textPreviewReady.value
        ? "下载完成，可在下方阅读"
        : "下载完成，暂时无法读取内容";
    }
    if (isVideo.value || isAudio.value) return "下载完成，可在下方播放";
    if (isImage.value) return "下载完成，点击图片可全屏查看";
    return "下载完成，可打开查看";
  }
  if (phase.value === "error") return "下载未完成";
  return "正在准备资源";
});
const savedHint = computed(() =>
  savedFilePath.value
    ? "文件已保存在应用本地，可在本页重复打开。"
    : "文件已下载为临时文件，离开后可能由系统自动清理。"
);

function decodeRouteValue(value?: string) {
  const source = String(value || "").trim();
  if (!source || /^https?:\/\//i.test(source)) return source;
  try {
    return decodeURIComponent(source);
  } catch {
    return source;
  }
}

function normalizeResourceUrl(value?: string) {
  const source = decodeRouteValue(value);
  return /^https?:\/\//i.test(source) ? source : "";
}

function normalizeResourceKind(value?: string): ResourceKind {
  const source = decodeRouteValue(value) as ResourceKind;
  return resourceKinds.includes(source) ? source : "unsupported";
}

function normalizeReturnRoute(value?: string) {
  const source = decodeRouteValue(value);
  if (
    !source.startsWith("/") ||
    source.startsWith("//") ||
    source.includes("://")
  ) {
    return "/home";
  }
  return source.slice(0, 1024);
}

function isValidDownloadPayload(
  payload?: NativeDownloadPayload | null
): payload is NativeDownloadPayload {
  return Boolean(
    payload?.createdAt &&
      Math.abs(Date.now() - payload.createdAt) <= 30_000 &&
      normalizeResourceUrl(payload.url)
  );
}

function readNativeDownloadPayload(key?: string) {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) return null;

  // #ifdef APP-PLUS
  const plusStorage = (globalThis as any).plus?.storage;
  const payloadKey = `${nativeDownloadPayloadPrefix}${normalizedKey}`;
  const ackKey = `${nativeDownloadAckPrefix}${normalizedKey}`;
  try {
    const raw = plusStorage?.getItem?.(payloadKey);
    plusStorage?.removeItem?.(payloadKey);
    if (!raw) {
      plusStorage?.setItem?.(ackKey, "error");
      return null;
    }
    const payload = JSON.parse(raw) as NativeDownloadPayload;
    if (!isValidDownloadPayload(payload)) {
      plusStorage?.setItem?.(ackKey, "error");
      return null;
    }
    plusStorage?.setItem?.(ackKey, "started");
    return payload;
  } catch {
    plusStorage?.setItem?.(ackKey, "error");
    return null;
  }
  // #endif

  return null;
}

function wait(delay: number) {
  return new Promise(resolve => setTimeout(resolve, delay));
}

async function readMiniProgramDownloadPayload(key?: string) {
  if (!isMiniProgramRuntime) return null;
  const normalizedKey = String(key || "").trim();
  if (!/^[a-z0-9-]{16,80}$/i.test(normalizedKey)) return null;
  const payloadKey = `${nativeDownloadPayloadPrefix}${normalizedKey}`;
  const deadline = Date.now() + 3500;

  while (Date.now() < deadline) {
    try {
      const raw = uni.getStorageSync(payloadKey) as
        | NativeDownloadPayload
        | string
        | undefined;
      if (raw) {
        uni.removeStorageSync(payloadKey);
        const payload =
          typeof raw === "string"
            ? (JSON.parse(raw) as NativeDownloadPayload)
            : raw;
        return isValidDownloadPayload(payload) ? payload : null;
      }
    } catch {
      return null;
    }
    await wait(50);
  }
  return null;
}

function errorMessageFromDownload(error?: unknown) {
  const message = String(
    (error as { errMsg?: string } | undefined)?.errMsg || ""
  ).toLowerCase();
  if (message.includes("timeout")) return "下载超时，请检查网络后重试。";
  if (message.includes("domain")) {
    return "当前资源域名未被允许，请检查小程序下载域名配置后重试。";
  }
  return "下载失败，请检查网络连接后重试。";
}

function finishDownload(filePath: string, persistedPath = "") {
  tempFilePath.value = filePath;
  savedFilePath.value = persistedPath;
  progress.value = 100;
  phase.value = "ready";
  if (isTextResource.value && loadTextPreview(persistedPath || filePath)) {
    return;
  }
  if (canOpenDocument.value) {
    openDownloadedDocument();
  }
}

function applyTextPreview(value: string, truncated = false) {
  textPreview.value = value;
  textPreviewTruncated.value = truncated;
  textPreviewReady.value = true;
  textPreviewLoading.value = false;
  openError.value = "";
}

function failTextPreview() {
  textPreviewLoading.value = false;
  textPreviewReady.value = false;
  openError.value =
    "文件已下载，但暂时无法读取文本内容。您可以重新读取或重新下载。";
}

function loadTextPreview(filePath: string) {
  if (!filePath || !isTextResource.value) return false;
  textPreview.value = "";
  textPreviewReady.value = false;
  textPreviewTruncated.value = false;
  textPreviewLoading.value = true;
  openError.value = "";

  // #ifdef MP-WEIXIN
  try {
    const fileSystem = uni.getFileSystemManager();
    fileSystem.stat({
      path: filePath,
      success: result => {
        const stats = Array.isArray(result.stats) ? undefined : result.stats;
        const size = Number(stats?.size || 0);
        if (size === 0) {
          applyTextPreview("");
          return;
        }
        fileSystem.readFile({
          filePath,
          encoding: "utf8",
          position: 0,
          length: Math.min(size, textPreviewByteLimit),
          success: readResult =>
            applyTextPreview(
              String(readResult.data || ""),
              size > textPreviewByteLimit
            ),
          fail: failTextPreview
        });
      },
      fail: failTextPreview
    });
    return true;
  } catch {
    failTextPreview();
    return true;
  }
  // #endif

  // #ifdef APP-PLUS
  try {
    const plusApi = (globalThis as any).plus;
    if (!plusApi?.io?.resolveLocalFileSystemURL || !plusApi.io.FileReader) {
      failTextPreview();
      return true;
    }
    plusApi.io.resolveLocalFileSystemURL(
      filePath,
      (entry: any) => {
        entry.file((file: any) => {
          const fileSize = Number(file?.size || 0);
          const isTruncated = fileSize > textPreviewByteLimit;
          if (isTruncated && typeof file?.slice !== "function") {
            failTextPreview();
            return;
          }
          const previewFile = isTruncated
            ? file.slice(0, textPreviewByteLimit)
            : file;
          const reader = new plusApi.io.FileReader();
          reader.onload = (event: any) => {
            const value = String(event?.target?.result || "");
            applyTextPreview(value, isTruncated);
          };
          reader.onerror = failTextPreview;
          reader.readAsText(previewFile, "utf-8");
        }, failTextPreview);
      },
      failTextPreview
    );
    return true;
  } catch {
    failTextPreview();
    return true;
  }
  // #endif

  failTextPreview();
  return false;
}

function persistDownloadedFile(filePath: string) {
  uni.saveFile({
    tempFilePath: filePath,
    success: result => finishDownload(filePath, result.savedFilePath),
    fail: () => finishDownload(filePath)
  });
}

function startDownload() {
  if (!resourceUrl.value || phase.value === "downloading") return;

  downloadTask?.abort();
  tempFilePath.value = "";
  savedFilePath.value = "";
  errorText.value = "";
  openError.value = "";
  progress.value = 0;
  phase.value = "downloading";

  downloadTask = uni.downloadFile({
    url: resourceUrl.value,
    timeout: 60_000,
    success: result => {
      if (
        result.statusCode < 200 ||
        result.statusCode >= 300 ||
        !result.tempFilePath
      ) {
        phase.value = "error";
        errorText.value = `资源服务返回异常（${result.statusCode}），请稍后重试。`;
        return;
      }
      persistDownloadedFile(result.tempFilePath);
    },
    fail: error => {
      phase.value = "error";
      errorText.value = errorMessageFromDownload(error);
    },
    complete: () => {
      downloadTask = null;
    }
  });
  downloadTask.onProgressUpdate(result => {
    progress.value = Math.max(0, Math.min(100, Math.round(result.progress)));
  });
}

function extensionFromResource() {
  const source = `${resourceTitle.value} ${resourceUrl.value}`
    .split(/[?#]/)[0]
    .toLowerCase();
  return source.match(/\.([a-z0-9]+)(?:\s|$)/)?.[1] || "";
}

function openDocumentFileType() {
  const extension = extensionFromResource();
  if (
    ["doc", "docx", "xls", "xlsx", "ppt", "pptx", "pdf"].includes(extension)
  ) {
    return extension;
  }
  if (resourceKind.value === "docx") return "docx";
  if (resourceKind.value === "pptx") return "pptx";
  if (resourceKind.value === "spreadsheet") return "xlsx";
  if (resourceKind.value === "pdf") return "pdf";
  return undefined;
}

function openWithSystemApplication(filePath: string) {
  // #ifdef APP-PLUS
  const plusApi = (globalThis as any).plus;
  if (plusApi?.runtime?.openFile) {
    phase.value = "opening";
    openError.value = "";
    try {
      plusApi.runtime.openFile(filePath, {}, () => {
        phase.value = "ready";
        openError.value =
          "系统中没有可打开此格式的应用，文件仍保留在应用本地。";
      });
      phase.value = "ready";
      return true;
    } catch {
      phase.value = "ready";
    }
  }
  // #endif
  return false;
}

function openDownloadedDocument() {
  const filePath = readyFilePath.value;
  if (!filePath) return;
  if (!canOpenDocument.value && openWithSystemApplication(filePath)) return;
  phase.value = "opening";
  openError.value = "";
  uni.openDocument({
    filePath,
    fileType: openDocumentFileType(),
    success: () => {
      phase.value = "ready";
    },
    fail: () => {
      phase.value = "ready";
      openError.value = canOpenDocument.value
        ? "系统暂时无法打开该文件，您可以重新下载后再试。"
        : "当前系统不支持直接打开此格式，文件仍保留在应用本地。";
    }
  });
}

function previewImage() {
  const filePath = readyFilePath.value;
  if (!filePath) return;
  uni.previewImage({ current: filePath, urls: [filePath] });
}

function reloadTextPreview() {
  const filePath = readyFilePath.value;
  if (filePath) loadTextPreview(filePath);
}

function copyTextPreview() {
  if (!textPreviewReady.value) return;
  uni.setClipboardData({ data: textPreview.value });
}

function returnToLearningPage() {
  if (isMiniProgramRuntime) {
    uni.reLaunch({
      url: `/pages/index/index?entry=${encodeURIComponent(returnRoute.value)}`
    });
    return;
  }
  uni.navigateBack({
    delta: 1,
    fail: () => uni.reLaunch({ url: "/pages/index/index" })
  });
}

async function initializeDownloadPage(
  routeOptions: Record<string, string | undefined>
) {
  const payload =
    readNativeDownloadPayload(routeOptions.key) ||
    (await readMiniProgramDownloadPayload(routeOptions.key));
  resourceUrl.value = normalizeResourceUrl(payload?.url);
  resourceTitle.value = decodeRouteValue(payload?.title) || "课程资料";
  resourceKind.value = normalizeResourceKind(payload?.kind);
  mimeType.value = String(payload?.mime || "");
  returnRoute.value = normalizeReturnRoute(payload?.returnRoute);

  if (!resourceUrl.value) {
    phase.value = "error";
    errorText.value = "资源地址无效，请返回原页面后重新下载。";
    return;
  }
  startDownload();
}

onLoad(options => {
  const routeOptions = (options || {}) as Record<string, string | undefined>;
  void initializeDownloadPage(routeOptions);
});

onUnload(() => {
  downloadTask?.abort();
  downloadTask = null;
});
</script>

<style scoped>
.resource-download-page {
  box-sizing: border-box;
  width: 100%;
  height: 100vh;
  min-height: 100vh;
  padding: 48rpx 32rpx calc(40rpx + env(safe-area-inset-bottom));
  overflow-y: auto;
  background: #f4f6f8;
}

.resource-summary {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  max-width: 920rpx;
  margin: 0 auto;
}

.resource-kind {
  padding: 8rpx 16rpx;
  font-size: 24rpx;
  line-height: 1.4;
  color: #155e75;
  background: #cffafe;
  border-radius: 6rpx;
}

.resource-title {
  width: 100%;
  margin-top: 24rpx;
  overflow-wrap: anywhere;
  font-size: 38rpx;
  font-weight: 650;
  line-height: 1.35;
  color: #172033;
}

.resource-status {
  margin-top: 16rpx;
  font-size: 28rpx;
  line-height: 1.6;
  color: #5b6473;
}

.resource-status.is-error,
.error-text {
  color: #b42318;
}

.progress-area {
  display: flex;
  align-items: center;
  width: 100%;
  margin-top: 32rpx;
}

.download-progress {
  flex: 1;
  min-width: 0;
}

.progress-value {
  width: 88rpx;
  margin-left: 20rpx;
  font-size: 26rpx;
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: #344054;
}

.error-text,
.open-error-text {
  margin-top: 20rpx;
  font-size: 26rpx;
  line-height: 1.6;
}

.open-error-text {
  color: #9a6700;
}

.media-preview {
  width: 100%;
  max-width: 920rpx;
  margin: 40rpx auto 0;
  overflow: hidden;
  background: #101828;
  border-radius: 8rpx;
}

.image-preview {
  background: #e8ecf1;
}

.preview-image,
.preview-video {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 16 / 9;
}

.audio-preview {
  padding: 24rpx;
  background: #ffffff;
  border: 1rpx solid #d0d5dd;
}

.preview-audio {
  display: block;
  width: 100%;
}

.text-preview {
  box-sizing: border-box;
  width: 100%;
  max-width: 920rpx;
  height: 56vh;
  min-height: 480rpx;
  max-height: 920rpx;
  margin: 40rpx auto 0;
  padding: 28rpx;
  overflow: hidden;
  background: #ffffff;
  border: 1rpx solid #d0d5dd;
  border-radius: 8rpx;
}

.text-preview__content,
.text-preview__notice {
  display: block;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 27rpx;
  line-height: 1.75;
  color: #253044;
}

.text-preview__notice {
  margin-top: 28rpx;
  color: #9a6700;
}

.resource-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
  width: 100%;
  max-width: 920rpx;
  margin: 48rpx auto 0;
}

.action-button {
  box-sizing: border-box;
  min-width: 220rpx;
  min-height: 96rpx;
  margin: 0;
  padding: 22rpx 32rpx;
  font-size: 28rpx;
  font-weight: 600;
  line-height: 1.5;
  border-radius: 8rpx;
}

.action-button::after {
  border: 0;
}

.action-button.is-primary {
  color: #ffffff;
  background: #2563eb;
}

.action-button.is-secondary {
  color: #344054;
  background: #ffffff;
  border: 1rpx solid #cbd2dc;
}

.saved-hint {
  display: block;
  width: 100%;
  max-width: 920rpx;
  margin: 24rpx auto 0;
  font-size: 24rpx;
  line-height: 1.6;
  color: #667085;
}
</style>
