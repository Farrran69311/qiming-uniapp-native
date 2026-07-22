<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch
} from "vue";
import MarkdownIt from "markdown-it";
import { ElMessage } from "element-plus";
import {
  Connection,
  Document,
  Download,
  Loading,
  Refresh,
  WarningFilled
} from "@element-plus/icons-vue";
import "@vue-office/docx/lib/v3/index.css";
import "@vue-office/excel/lib/v3/index.css";
import PlatformMindMapPreview from "./PlatformMindMapPreview.vue";
import PlatformStructuredJsonPreview from "./PlatformStructuredJsonPreview.vue";
import {
  decodePlatformTextBuffer,
  downloadPlatformResource,
  fetchPlatformResourceBuffer,
  fetchPlatformResourceText,
  getResourceUrlExtension,
  isOfficePreviewKind,
  resolvePlatformPreviewSource,
  type PlatformPreviewResource
} from "./resource-preview";
import {
  extractPlatformMindMapTree,
  stripStructuredCodeFence,
  type PlatformMindMapNode
} from "./mind-map";
import {
  normalizeStructuredPreview,
  type StructuredPreviewView
} from "./structured-json";

defineOptions({ name: "PlatformResourcePreviewPane" });

const props = withDefaults(
  defineProps<{
    resource?: PlatformPreviewResource | null;
    embedded?: boolean;
    fontScale?: number;
  }>(),
  { resource: null, embedded: false, fontScale: 1 }
);

const emit = defineEmits<{
  loaded: [];
  error: [message: string];
}>();

const VueOfficeDocx = defineAsyncComponent(() =>
  import("@vue-office/docx/lib/v3/index.js").then(module =>
    Promise.resolve(module.default as any)
  )
);
const VueOfficeExcel = defineAsyncComponent(() =>
  import("@vue-office/excel/lib/v3/index.js").then(module =>
    Promise.resolve(module.default as any)
  )
);

const markdownRenderer = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: true
});

const defaultLinkOpen =
  markdownRenderer.renderer.rules.link_open ||
  ((tokens, index, options, _env, self) =>
    self.renderToken(tokens, index, options));
markdownRenderer.renderer.rules.link_open = (
  tokens,
  index,
  options,
  env,
  self
) => {
  const token = tokens[index];
  token.attrSet("rel", "noopener noreferrer");
  const href = token.attrGet("href") || "";
  const baseUrl = String((env as { baseUrl?: string })?.baseUrl || "");
  if (baseUrl && href && !/^(?:[a-z]+:|#|\/)/i.test(href)) {
    try {
      token.attrSet("href", new URL(href, baseUrl).href);
    } catch {
      // Keep the source href when it cannot be normalized.
    }
  }
  return defaultLinkOpen(tokens, index, options, env, self);
};

const defaultImage = markdownRenderer.renderer.rules.image;
markdownRenderer.renderer.rules.image = (tokens, index, options, env, self) => {
  const token = tokens[index];
  const src = token.attrGet("src") || "";
  const baseUrl = String((env as { baseUrl?: string })?.baseUrl || "");
  if (baseUrl && src && !/^(?:[a-z]+:|data:|\/)/i.test(src)) {
    try {
      token.attrSet("src", new URL(src, baseUrl).href);
    } catch {
      // Keep the source path when it cannot be normalized.
    }
  }
  return defaultImage
    ? defaultImage(tokens, index, options, env, self)
    : self.renderToken(tokens, index, options);
};

const resolved = computed(() => resolvePlatformPreviewSource(props.resource));
const previewFontVariables = computed(() => ({
  "--platform-preview-markdown-font-size": `${15 * props.fontScale}px`,
  "--platform-preview-mono-font-size": `${13 * props.fontScale}px`,
  "--platform-preview-structured-font-size": `${14 * props.fontScale}px`
}));
const loading = ref(false);
const errorMessage = ref("");
const markdownHtml = ref("");
const plainText = ref("");
const mindMapTree = ref<PlatformMindMapNode | null>(null);
const mindMapImageUrl = ref("");
const structuredJsonView = ref<StructuredPreviewView | null>(null);
const officeBuffer = shallowRef<ArrayBuffer | null>(null);
const officeHostRef = ref<HTMLElement | null>(null);
const officePdfFallbackUrl = ref("");
const officeRenderKey = ref(0);
let previewAbortController: AbortController | null = null;
let pptxViewer: import("@aiden0z/pptx-renderer").PptxViewer | null = null;
let mindMapImageObjectUrl = "";

const hasStructuredSource = computed(() =>
  Boolean(
    props.resource?.structuredData ||
      props.resource?.exerciseItems?.length ||
      props.resource?.starterCode ||
      props.resource?.testCases?.length ||
      props.resource?.rubric
  )
);
const hasPreviewSource = computed(() =>
  Boolean(
    resolved.value.url || resolved.value.content || hasStructuredSource.value
  )
);
const hasDownload = computed(() => Boolean(resolved.value.downloadUrl));
const showsMindMap = computed(
  () =>
    Boolean(mindMapTree.value) &&
    ["mindmap", "json"].includes(resolved.value.kind)
);
const officeComponent = computed(() => {
  if (resolved.value.kind === "docx") return VueOfficeDocx;
  return VueOfficeExcel;
});
const officeOptions = computed(() =>
  resolved.value.kind === "spreadsheet"
    ? { minColLength: 12, minRowLength: 24, showContextmenu: false }
    : {}
);

function clearOfficePdfFallback() {
  if (officePdfFallbackUrl.value) {
    URL.revokeObjectURL(officePdfFallbackUrl.value);
    officePdfFallbackUrl.value = "";
  }
}

function clearMindMapImage() {
  if (mindMapImageObjectUrl) {
    URL.revokeObjectURL(mindMapImageObjectUrl);
    mindMapImageObjectUrl = "";
  }
  mindMapImageUrl.value = "";
}

function destroyPptxViewer() {
  pptxViewer?.destroy();
  pptxViewer = null;
  if (officeHostRef.value) officeHostRef.value.innerHTML = "";
}

function resetContent() {
  destroyPptxViewer();
  markdownHtml.value = "";
  plainText.value = "";
  mindMapTree.value = null;
  clearMindMapImage();
  structuredJsonView.value = null;
  officeBuffer.value = null;
  clearOfficePdfFallback();
  errorMessage.value = "";
}

function normalizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message === "RESOURCE_TOO_LARGE") {
    return "文件体积超过平台内预览上限，请下载后查看。";
  }
  if (/abort/i.test(message)) return "";
  if (/HTTP 401|HTTP 403/.test(message)) {
    return "当前账号没有读取该文件的权限，或预览地址已经过期。";
  }
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
    return "文件地址未允许平台读取，请检查预览地址或对象存储跨域配置。";
  }
  if (/INVALID_OFFICE_FILE|PPTX_EMPTY_RENDER/.test(message)) {
    return "演示文稿没有生成可显示的幻灯片，请重新生成预览或下载原文件查看。";
  }
  return "该文件暂时无法在平台内解析，请稍后重试。";
}

function completeLoading() {
  loading.value = false;
  emit("loaded");
}

function failPreview(error: unknown) {
  const message = normalizeError(error);
  if (!message) return;
  loading.value = false;
  errorMessage.value = message;
  emit("error", message);
  console.warn("[PlatformResourcePreview] preview failed", error);
}

function renderMarkdown(content: string) {
  markdownHtml.value = markdownRenderer.render(content || "暂无可渲染内容。", {
    baseUrl: resolved.value.url
  });
}

function renderStructuredContent(content: string) {
  const normalized = stripStructuredCodeFence(content);
  if (resolved.value.kind === "mindmap") {
    mindMapTree.value = extractPlatformMindMapTree(normalized, {
      fallbackTitle: resolved.value.title,
      allowObjectMap: true
    });
    if (!mindMapTree.value) throw new Error("MIND_MAP_PARSE_FAILED");
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    parsed = normalized;
  }

  const descriptor = `${props.resource?.resourceType || ""} ${
    props.resource?.title || ""
  }`.toLowerCase();
  mindMapTree.value = extractPlatformMindMapTree(parsed, {
    fallbackTitle: resolved.value.title,
    allowObjectMap: /(mind[_\s-]*map|思维导图|知识导图)/.test(descriptor)
  });
  if (!mindMapTree.value) {
    structuredJsonView.value = normalizeStructuredPreview(
      parsed,
      props.resource || { title: resolved.value.title }
    );
  }
}

function imageMimeTypeFromExtension(extension: string) {
  const types: Record<string, string> = {
    svg: "image/svg+xml",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif"
  };
  return types[extension] || "";
}

async function loadTextPreview(signal: AbortSignal) {
  const usesInlineStructuredFields =
    resolved.value.kind === "json" && hasStructuredSource.value;
  const inlineStructuredData = props.resource?.structuredData;
  let content =
    resolved.value.content ||
    (inlineStructuredData !== undefined
      ? JSON.stringify(inlineStructuredData)
      : "");

  if (
    !content &&
    !usesInlineStructuredFields &&
    resolved.value.kind === "mindmap" &&
    resolved.value.url
  ) {
    const { buffer, contentType } = await fetchPlatformResourceBuffer(
      resolved.value.url,
      {
        signal,
        maxBytes: 16 * 1024 * 1024,
        accept: "application/json, text/plain, text/markdown, image/*, */*"
      }
    );
    if (signal.aborted) return;

    const extension = getResourceUrlExtension(resolved.value.url);
    const fallbackImageType = imageMimeTypeFromExtension(extension);
    const responseType = contentType.split(";")[0].trim().toLowerCase();
    if (responseType.startsWith("image/") || fallbackImageType) {
      mindMapImageObjectUrl = URL.createObjectURL(
        new Blob([buffer], {
          type: responseType.startsWith("image/")
            ? responseType
            : fallbackImageType
        })
      );
      mindMapImageUrl.value = mindMapImageObjectUrl;
      return;
    }
    content = decodePlatformTextBuffer(buffer, contentType);
  } else if (!content && !usesInlineStructuredFields && resolved.value.url) {
    content = await fetchPlatformResourceText(resolved.value.url, {
      signal,
      maxBytes: 8 * 1024 * 1024
    });
  }
  if (signal.aborted) return;

  if (resolved.value.kind === "markdown") renderMarkdown(content);
  else if (["mindmap", "json"].includes(resolved.value.kind)) {
    renderStructuredContent(content);
  } else plainText.value = content;
  completeLoading();
}

async function renderPptxPreview(buffer: ArrayBuffer, signal: AbortSignal) {
  officeBuffer.value = buffer;
  officeRenderKey.value += 1;
  await nextTick();
  const host = officeHostRef.value;
  if (!host || signal.aborted) return;

  const { PptxViewer, RECOMMENDED_ZIP_LIMITS } = await import(
    "@aiden0z/pptx-renderer"
  );
  if (signal.aborted) return;

  destroyPptxViewer();
  pptxViewer = await PptxViewer.open(buffer, host, {
    fitMode: "contain",
    renderMode: "list",
    scrollContainer: host,
    zipLimits: RECOMMENDED_ZIP_LIMITS,
    lazyMedia: true,
    lazySlides: true,
    listOptions: {
      windowed: true,
      batchSize: 8,
      initialSlides: 4,
      overscanViewport: 1.5
    },
    signal,
    onSlideError: (index, error) => {
      console.warn(
        `[PlatformResourcePreview] slide ${index + 1} failed`,
        error
      );
    }
  });

  if (signal.aborted) {
    destroyPptxViewer();
    return;
  }
  if (!pptxViewer.slideCount) throw new Error("PPTX_EMPTY_RENDER");
  completeLoading();
}

async function loadOfficePreview(signal: AbortSignal) {
  const { buffer, contentType } = await fetchPlatformResourceBuffer(
    resolved.value.url,
    {
      signal,
      maxBytes: 64 * 1024 * 1024,
      accept:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.openxmlformats-officedocument.presentationml.presentation, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, application/pdf, */*"
    }
  );
  if (signal.aborted) return;

  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 8));
  const isPdf =
    contentType.toLowerCase().includes("application/pdf") ||
    String.fromCharCode(...bytes.slice(0, 4)) === "%PDF";
  if (resolved.value.kind === "pptx" && isPdf) {
    officePdfFallbackUrl.value = URL.createObjectURL(
      new Blob([buffer], { type: "application/pdf" })
    );
    completeLoading();
    return;
  }

  const isZip =
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06) ||
      (bytes[2] === 0x07 && bytes[3] === 0x08));
  if (resolved.value.kind !== "spreadsheet" && !isZip) {
    throw new Error("INVALID_OFFICE_FILE");
  }

  if (resolved.value.kind === "pptx") {
    await renderPptxPreview(buffer, signal);
    return;
  }
  officeBuffer.value = buffer;
}

async function loadPreview() {
  previewAbortController?.abort();
  previewAbortController = new AbortController();
  const { signal } = previewAbortController;
  resetContent();

  if (!hasPreviewSource.value) {
    loading.value = false;
    errorMessage.value = "该资源暂未提供可读取的文件或正文。";
    return;
  }

  loading.value = true;
  try {
    if (["markdown", "text", "mindmap", "json"].includes(resolved.value.kind)) {
      await loadTextPreview(signal);
      return;
    }
    if (isOfficePreviewKind(resolved.value.kind)) {
      if (!resolved.value.url) throw new Error("RESOURCE_URL_MISSING");
      await loadOfficePreview(signal);
      return;
    }
    if (resolved.value.kind === "unsupported") {
      loading.value = false;
      return;
    }
    if (
      resolved.value.kind === "html" &&
      resolved.value.content &&
      !resolved.value.url
    ) {
      return;
    }
    if (!resolved.value.url) throw new Error("RESOURCE_URL_MISSING");
  } catch (error) {
    if (!signal.aborted) failPreview(error);
  }
}

async function handleDownload() {
  if (!props.resource) return;
  try {
    await downloadPlatformResource(props.resource);
  } catch (error) {
    console.warn("[PlatformResourcePreview] download failed", error);
    ElMessage.error("文件下载失败，请检查资源权限或下载地址");
  }
}

function handleHtmlLoad() {
  completeLoading();
}

function handleMediaError() {
  failPreview(new Error("MEDIA_LOAD_FAILED"));
}

async function handleVideoMetadata(event: Event) {
  const video = event.currentTarget as HTMLVideoElement;
  const requestedSeconds = Math.max(
    0,
    Number(props.resource?.initialTimeMs || 0) / 1000
  );
  const duration = Number(video.duration);
  const targetSeconds =
    Number.isFinite(duration) && duration > 0
      ? Math.min(requestedSeconds, Math.max(0, duration - 0.05))
      : requestedSeconds;

  if (targetSeconds > 0 && Math.abs(video.currentTime - targetSeconds) > 0.1) {
    try {
      video.currentTime = targetSeconds;
    } catch {
      // Keep the video playable from the beginning when the source cannot seek.
    }
  }
  completeLoading();

  if (props.resource?.autoPlay) {
    await nextTick();
    try {
      await video.play();
    } catch {
      // Browsers may require a second user gesture for audible playback.
    }
  }
}

function handlePptxWheel(event: WheelEvent) {
  if (event.ctrlKey || event.metaKey || resolved.value.kind !== "pptx") return;
  const host = officeHostRef.value;
  if (!host || host.scrollHeight <= host.clientHeight) return;

  const unit =
    event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : host.clientHeight;
  const delta =
    event.deltaMode === WheelEvent.DOM_DELTA_PIXEL
      ? event.deltaY
      : event.deltaY * unit;
  if (!delta) return;

  const nextScrollTop = Math.max(
    0,
    Math.min(host.scrollTop + delta, host.scrollHeight - host.clientHeight)
  );
  if (nextScrollTop === host.scrollTop) return;

  event.preventDefault();
  event.stopPropagation();
  host.scrollTop = nextScrollTop;
}

function handleOfficeRendered() {
  completeLoading();
}

watch(
  () => [
    props.resource?.title,
    props.resource?.url,
    props.resource?.previewUrl,
    props.resource?.previewPdfUrl,
    props.resource?.downloadUrl,
    props.resource?.content,
    props.resource?.contentFormat,
    props.resource?.resourceType,
    props.resource?.structuredData,
    props.resource?.exerciseItems,
    props.resource?.language,
    props.resource?.starterCode,
    props.resource?.testCases,
    props.resource?.rubric,
    props.resource?.runtimeStatus,
    props.resource?.initialTimeMs,
    props.resource?.segmentStartMs,
    props.resource?.segmentEndMs,
    props.resource?.autoPlay
  ],
  loadPreview,
  { immediate: true }
);

onBeforeUnmount(() => {
  previewAbortController?.abort();
  destroyPptxViewer();
  clearMindMapImage();
  clearOfficePdfFallback();
});

defineExpose({ reload: loadPreview, download: handleDownload });
</script>

<template>
  <section
    class="platform-resource-preview"
    :class="[`is-${resolved.kind}`, { 'is-embedded': props.embedded }]"
    :style="previewFontVariables"
    aria-live="polite"
  >
    <div v-if="loading" class="platform-resource-preview__loading">
      <el-icon class="is-loading" :size="22"><Loading /></el-icon>
      <span>正在准备{{ resolved.title }}</span>
    </div>

    <div
      v-if="errorMessage"
      class="platform-resource-preview__feedback"
      role="alert"
    >
      <el-icon :size="30"><WarningFilled /></el-icon>
      <h3>资源暂时无法预览</h3>
      <p>{{ errorMessage }}</p>
      <div class="platform-resource-preview__feedback-actions">
        <el-button :icon="Refresh" @click="loadPreview">重新加载</el-button>
        <el-button
          v-if="hasDownload"
          type="primary"
          :icon="Download"
          @click="handleDownload"
        >
          下载文件
        </el-button>
      </div>
    </div>

    <template v-else>
      <iframe
        v-if="resolved.kind === 'html'"
        :key="resolved.url || resolved.content"
        :src="resolved.url || undefined"
        :srcdoc="resolved.url ? undefined : resolved.content || undefined"
        class="platform-resource-preview__frame"
        title="HTML 课程资料预览"
        sandbox="allow-downloads allow-forms allow-scripts"
        @load="handleHtmlLoad"
      />

      <article
        v-else-if="resolved.kind === 'markdown'"
        class="platform-resource-preview__markdown"
        v-html="markdownHtml"
      />

      <pre
        v-else-if="resolved.kind === 'text'"
        class="platform-resource-preview__text"
        >{{ plainText }}</pre
      >

      <PlatformMindMapPreview
        v-else-if="showsMindMap && mindMapTree"
        :tree="mindMapTree"
      />

      <div
        v-else-if="resolved.kind === 'mindmap' && mindMapImageUrl"
        class="platform-resource-preview__image is-mind-map"
      >
        <img
          :src="mindMapImageUrl"
          :alt="resolved.title"
          @load="completeLoading"
          @error="handleMediaError"
        />
      </div>

      <PlatformStructuredJsonPreview
        v-else-if="resolved.kind === 'json' && structuredJsonView"
        :view="structuredJsonView"
        class="platform-resource-preview__structured"
      />

      <div
        v-else-if="resolved.kind === 'pptx' && officeBuffer"
        ref="officeHostRef"
        :key="`${resolved.url}:${officeRenderKey}`"
        class="platform-resource-preview__office"
        :class="`is-${resolved.kind}`"
        @wheel.capture="handlePptxWheel"
      />

      <div
        v-else-if="isOfficePreviewKind(resolved.kind) && officeBuffer"
        class="platform-resource-preview__office"
        :class="`is-${resolved.kind}`"
      >
        <component
          :is="officeComponent"
          :key="`${resolved.url}:${officeRenderKey}`"
          :src="officeBuffer"
          :options="officeOptions"
          @rendered="handleOfficeRendered"
          @error="failPreview"
        />
      </div>

      <iframe
        v-else-if="officePdfFallbackUrl"
        :key="officePdfFallbackUrl"
        :src="officePdfFallbackUrl"
        class="platform-resource-preview__frame"
        title="PowerPoint PDF 预览"
        @load="handleHtmlLoad"
      />

      <iframe
        v-else-if="resolved.kind === 'pdf'"
        :key="resolved.url"
        :src="resolved.url"
        class="platform-resource-preview__frame"
        title="PDF 课程资料预览"
        @load="handleHtmlLoad"
      />

      <div
        v-else-if="resolved.kind === 'video'"
        class="platform-resource-preview__media"
      >
        <video
          :key="`${resolved.url}:${props.resource?.initialTimeMs || 0}`"
          :src="resolved.url"
          controls
          playsinline
          preload="metadata"
          @loadedmetadata="handleVideoMetadata"
          @error="handleMediaError"
        />
      </div>

      <div
        v-else-if="resolved.kind === 'audio'"
        class="platform-resource-preview__audio"
      >
        <el-icon :size="34"><Document /></el-icon>
        <h3>{{ resolved.title }}</h3>
        <audio
          :src="resolved.url"
          controls
          preload="metadata"
          @loadedmetadata="completeLoading"
          @error="handleMediaError"
        />
      </div>

      <div
        v-else-if="resolved.kind === 'image'"
        class="platform-resource-preview__image"
      >
        <img
          :src="resolved.url"
          :alt="resolved.title"
          @load="completeLoading"
          @error="handleMediaError"
        />
      </div>

      <div
        v-else-if="resolved.kind === 'unsupported'"
        class="platform-resource-preview__feedback"
      >
        <el-icon :size="30"><Document /></el-icon>
        <h3>该格式暂不支持平台内解析</h3>
        <p>可以下载原文件，或由后端生成 PDF 预览版本后继续在平台内查看。</p>
        <el-button
          v-if="hasDownload"
          type="primary"
          :icon="Download"
          @click="handleDownload"
        >
          下载文件
        </el-button>
      </div>

      <div
        v-else-if="!hasPreviewSource"
        class="platform-resource-preview__feedback"
      >
        <el-icon :size="30"><Connection /></el-icon>
        <h3>暂无可预览内容</h3>
        <p>资源生成或发布完成后会直接显示在这里。</p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.platform-resource-preview {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 460px;
  overflow: auto;
  color: #263449;
  background: #f4f6f9;
}

.platform-resource-preview.is-embedded {
  min-height: 100%;
}

.platform-resource-preview.is-pptx {
  overflow: hidden;
}

.platform-resource-preview__loading {
  position: absolute;
  inset: 0;
  z-index: 8;
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: center;
  color: #65758a;
  font-size: 14px;
  background: rgb(247 249 252 / 88%);
  backdrop-filter: blur(3px);
}

.platform-resource-preview__frame {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 640px;
  background: #fff;
  border: 0;
}

.platform-resource-preview__markdown {
  box-sizing: border-box;
  width: 100%;
  min-height: 100%;
  padding: 46px clamp(28px, 5vw, 72px) 72px;
  margin: 0;
  color: #25344b;
  font-size: var(--platform-preview-markdown-font-size, 15px);
  line-height: 1.8;
  background: #fff;
}

.platform-resource-preview__markdown :deep(h1),
.platform-resource-preview__markdown :deep(h2),
.platform-resource-preview__markdown :deep(h3) {
  margin: 1.6em 0 0.65em;
  color: #18263a;
  line-height: 1.35;
  letter-spacing: 0;
}

.platform-resource-preview__markdown :deep(h1) {
  margin-top: 0;
  font-size: 28px;
}

.platform-resource-preview__markdown :deep(h2) {
  padding-bottom: 8px;
  font-size: 22px;
  border-bottom: 1px solid #e5eaf0;
}

.platform-resource-preview__markdown :deep(h3) {
  font-size: 18px;
}

.platform-resource-preview__markdown :deep(p),
.platform-resource-preview__markdown :deep(ul),
.platform-resource-preview__markdown :deep(ol) {
  margin: 0.8em 0;
}

.platform-resource-preview__markdown :deep(blockquote) {
  padding: 10px 16px;
  margin: 18px 0;
  color: #52647a;
  background: #f3f7fb;
  border-left: 3px solid #4f83c2;
}

.platform-resource-preview__markdown :deep(pre) {
  padding: 16px 18px;
  overflow: auto;
  color: #e6edf3;
  background: #1f2937;
  border-radius: 6px;
}

.platform-resource-preview__markdown :deep(code) {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 0.9em;
}

.platform-resource-preview__markdown :deep(:not(pre) > code) {
  padding: 2px 5px;
  color: #a33d45;
  background: #f8ecee;
  border-radius: 4px;
}

.platform-resource-preview__markdown :deep(table) {
  width: 100%;
  margin: 20px 0;
  overflow: hidden;
  border-spacing: 0;
  border-collapse: collapse;
  border: 1px solid #dfe5ec;
}

.platform-resource-preview__markdown :deep(th),
.platform-resource-preview__markdown :deep(td) {
  padding: 9px 12px;
  text-align: left;
  border: 1px solid #dfe5ec;
}

.platform-resource-preview__markdown :deep(th) {
  background: #f3f6f9;
}

.platform-resource-preview__markdown :deep(img) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 20px auto;
}

.platform-resource-preview__markdown :deep(a) {
  color: #2468b3;
}

.platform-resource-preview__text {
  box-sizing: border-box;
  width: min(980px, calc(100% - 48px));
  min-height: calc(100% - 48px);
  padding: 34px 38px 56px;
  margin: 24px auto;
  overflow: visible;
  color: #25344b;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: var(--platform-preview-mono-font-size, 13px);
  line-height: 1.72;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: #fff;
  border: 1px solid #e1e7ee;
  border-radius: 4px;
}

.platform-resource-preview__structured {
  font-size: var(--platform-preview-structured-font-size, 14px);
}

.platform-resource-preview__office {
  width: 100%;
  min-height: 100%;
  padding: 24px;
  overflow: auto;
}

.platform-resource-preview__office.is-docx :deep(.vue-office-docx) {
  min-height: 100%;
  background: transparent;
}

.platform-resource-preview__office.is-pptx {
  height: 100%;
  min-height: 0;
  padding: 20px 0 36px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  background: #eef2f7;
}

.platform-resource-preview__office.is-pptx :deep([data-slide-index]) {
  border-radius: 4px;
}

.platform-resource-preview__office.is-pptx
  :deep([data-slide-index] > [data-mounted="1"]) {
  border: 1px solid rgb(30 45 61 / 10%);
  border-radius: 4px;
}

.platform-resource-preview__office.is-spreadsheet {
  padding: 0;
  background: #fff;
}

.platform-resource-preview__media,
.platform-resource-preview__image,
.platform-resource-preview__audio {
  display: flex;
  width: 100%;
  min-height: 100%;
  align-items: center;
  justify-content: center;
  padding: 28px;
}

.platform-resource-preview__media video {
  width: min(100%, 1100px);
  max-height: calc(100vh - 190px);
  background: #111827;
}

.platform-resource-preview__image img {
  display: block;
  max-width: 100%;
  max-height: calc(100vh - 190px);
  object-fit: contain;
}

.platform-resource-preview__audio {
  flex-direction: column;
  gap: 14px;
  color: #52647a;
}

.platform-resource-preview__audio h3 {
  margin: 0;
  color: #263449;
  font-size: 17px;
  letter-spacing: 0;
}

.platform-resource-preview__audio audio {
  width: min(560px, 100%);
}

.platform-resource-preview__feedback {
  display: flex;
  min-height: 460px;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
  padding: 36px;
  color: #718096;
  text-align: center;
  background: #fff;
}

.platform-resource-preview__feedback h3 {
  margin: 2px 0 0;
  color: #263449;
  font-size: 17px;
  letter-spacing: 0;
}

.platform-resource-preview__feedback p {
  max-width: 560px;
  margin: 0;
  font-size: 13px;
  line-height: 1.65;
}

.platform-resource-preview__feedback-actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}

:global(.dark) .platform-resource-preview {
  color: #e5edf7;
  background: #111827;
}

:global(.dark) .platform-resource-preview__markdown,
:global(.dark) .platform-resource-preview__text,
:global(.dark) .platform-resource-preview__feedback {
  color: #d7e0eb;
  background: #182131;
  border-color: rgb(255 255 255 / 10%);
}

@media (max-width: 768px) {
  .platform-resource-preview {
    min-height: 100%;
  }

  .platform-resource-preview__markdown,
  .platform-resource-preview__text {
    width: 100%;
    min-height: 100%;
    padding: 28px 20px 46px;
    margin: 0;
    border: 0;
    box-shadow: none;
  }

  .platform-resource-preview__markdown :deep(h1) {
    font-size: 24px;
  }

  .platform-resource-preview__office {
    padding: 10px;
  }
}
</style>
