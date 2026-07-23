import { formatToken, getToken } from "@/utils/auth";
import {
  buildPlatformObjectUrl,
  normalizePlatformResourceUrl,
  uniquePlatformResourceUrls
} from "./resource-url";

export type PlatformPreviewKind =
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

export interface PlatformPreviewResource {
  title: string;
  url?: string;
  previewUrl?: string;
  previewPdfUrl?: string | null;
  downloadUrl?: string;
  objectKey?: string;
  content?: string;
  contentFormat?: string;
  mimeType?: string;
  resourceType?: string;
  description?: string;
  exerciseItems?: Record<string, unknown>[];
  language?: string;
  starterCode?: string;
  testCases?: Record<string, unknown>[];
  rubric?: Record<string, unknown> | string;
  runtimeStatus?: string;
  structuredData?: unknown;
  initialTimeMs?: number;
  segmentStartMs?: number;
  segmentEndMs?: number;
  autoPlay?: boolean;
}

export interface AssistantPreviewResourceLike {
  title?: string;
  preview_url?: string;
  preview_pdf_url?: string | null;
  download_url?: string;
  object_key?: string;
  content_body?: string;
  content_format?: string;
  mime_type?: string;
  resource_type?: string;
  description?: string;
  summary?: string;
  exercise_items?: Record<string, unknown>[];
  language?: string;
  starter_code?: string;
  test_cases?: Record<string, unknown>[];
  rubric?: Record<string, unknown> | string;
  runtime_status?: string;
  structured_data?: unknown;
}

export interface ResolvedPlatformPreviewSource {
  kind: PlatformPreviewKind;
  url: string;
  downloadUrl: string;
  urlCandidates: string[];
  downloadUrlCandidates: string[];
  content: string;
  title: string;
}

export interface PlatformResourceBufferResult {
  buffer: ArrayBuffer;
  contentType: string;
  contentDisposition: string;
  url: string;
  requestUrl: string;
}

interface PlatformUniNavigationOptions {
  url: string;
}

interface PlatformUniMessageOptions {
  data: Record<string, unknown>;
}

interface PlatformUniBridge {
  navigateTo?: (options: PlatformUniNavigationOptions) => unknown;
  redirectTo?: (options: PlatformUniNavigationOptions) => unknown;
  postMessage?: (options: PlatformUniMessageOptions) => unknown;
}

type PlatformBridgeWindow = Window & {
  uni?: PlatformUniBridge;
  wx?: {
    miniProgram?: PlatformUniBridge;
  };
};

const clean = (value?: string | null) => String(value || "").trim();
const platformFileProxyPrefix = "/mindmap-file";
const platformNativeDownloadPayloadPrefix = "qiming.resource-download.payload.";
const platformNativeDownloadAckPrefix = "qiming.resource-download.ack.";
const platformFileProxyTarget = clean(
  import.meta.env.VITE_MINDMAP_FILE_PROXY_TARGET
).replace(/\/$/, "");
const platformResourceUrlOptions = () => ({
  fileBaseUrl: platformFileProxyTarget,
  pageProtocol:
    typeof window === "undefined" ? "https:" : window.location.protocol
});

export function normalizePlatformResourceFetchUrl(url: string) {
  const source = normalizePlatformResourceUrl(
    url,
    platformResourceUrlOptions()
  );
  if (
    !source ||
    !import.meta.env.DEV ||
    !platformFileProxyTarget ||
    !/^https?:\/\//i.test(source)
  ) {
    return source;
  }

  try {
    const resource = new URL(source);
    const fileTarget = new URL(platformFileProxyTarget);
    if (resource.origin !== fileTarget.origin) return source;
    return `${platformFileProxyPrefix}${resource.pathname}${resource.search}`;
  } catch {
    return source;
  }
}

export function mapAssistantResourcePreview(
  resource: AssistantPreviewResourceLike
): PlatformPreviewResource {
  const descriptor = `${resource.resource_type || ""} ${
    resource.content_format || ""
  } ${resource.title || ""}`.toLowerCase();
  const usesStructuredSource =
    /(json|markdown|\bmd\b|text|mind[_\s-]*map|mermaid|coding[_\s-]*practice|exercise[_\s-]*set|编程|练习题集|思维导图)/.test(
      descriptor
    );
  const hasInlineStructuredSource = Boolean(
    clean(resource.content_body) ||
      resource.structured_data !== undefined ||
      resource.exercise_items?.length ||
      clean(resource.starter_code) ||
      resource.test_cases?.length ||
      resource.rubric
  );
  const previewPdfUrl =
    usesStructuredSource && hasInlineStructuredSource
      ? undefined
      : resource.preview_pdf_url;
  return {
    title: resource.title || "课程资料",
    url:
      previewPdfUrl ||
      resource.preview_url ||
      resource.download_url ||
      undefined,
    previewUrl: resource.preview_url,
    previewPdfUrl,
    downloadUrl: resource.download_url || resource.preview_url,
    objectKey: resource.object_key,
    content: resource.content_body,
    contentFormat: resource.content_format,
    mimeType: resource.mime_type,
    resourceType: resource.resource_type,
    description: resource.summary || resource.description,
    exerciseItems: resource.exercise_items,
    language: resource.language,
    starterCode: resource.starter_code,
    testCases: resource.test_cases,
    rubric: resource.rubric,
    runtimeStatus: resource.runtime_status,
    structuredData: resource.structured_data
  };
}

export function hasPlatformResourcePreview(
  resource?: PlatformPreviewResource | null
) {
  return Boolean(
    resource &&
      (resource.url ||
        resource.previewUrl ||
        resource.previewPdfUrl ||
        resource.downloadUrl ||
        resource.objectKey ||
        resource.content ||
        resource.structuredData !== undefined ||
        resource.exerciseItems?.length ||
        resource.starterCode ||
        resource.testCases?.length ||
        resource.rubric)
  );
}

export function getResourceUrlExtension(url?: string) {
  const source = clean(url).split(/[?#]/)[0];
  const filename = source.split("/").pop() || "";
  const extension = filename.includes(".") ? filename.split(".").pop() : "";
  return clean(extension).toLowerCase();
}

function kindFromExtension(extension: string): PlatformPreviewKind | undefined {
  if (["html", "htm"].includes(extension)) return "html";
  if (["md", "markdown"].includes(extension)) return "markdown";
  if (["txt", "log", "ini", "yaml", "yml", "xml"].includes(extension)) {
    return "text";
  }
  if (extension === "json") return "json";
  if (extension === "docx") return "docx";
  if (extension === "pptx") return "pptx";
  if (["xlsx", "xls", "csv"].includes(extension)) return "spreadsheet";
  if (extension === "pdf") return "pdf";
  if (["mp4", "mov", "avi", "mkv", "webm", "m4v"].includes(extension)) {
    return "video";
  }
  if (["mp3", "wav", "aac", "ogg", "m4a", "flac"].includes(extension)) {
    return "audio";
  }
  if (["jpg", "jpeg", "png", "webp", "gif", "svg", "bmp"].includes(extension)) {
    return "image";
  }
  return undefined;
}

function kindFromFormat(format: string): PlatformPreviewKind | undefined {
  const normalized = format.toLowerCase().replace(/^\./, "");
  if (["html", "htm", "text/html"].includes(normalized)) return "html";
  if (["markdown", "md", "text/markdown"].includes(normalized)) {
    return "markdown";
  }
  if (
    ["text", "txt", "plain", "text/plain", "yaml", "yml", "xml"].includes(
      normalized
    )
  ) {
    return "text";
  }
  if (["mindmap", "mind_map", "mermaid"].includes(normalized)) {
    return "mindmap";
  }
  if (["json", "application/json"].includes(normalized)) return "json";
  if (
    [
      "docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ].includes(normalized)
  ) {
    return "docx";
  }
  if (
    [
      "pptx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ].includes(normalized)
  ) {
    return "pptx";
  }
  if (
    [
      "xlsx",
      "xls",
      "csv",
      "spreadsheet",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ].includes(normalized)
  ) {
    return "spreadsheet";
  }
  if (["pdf", "application/pdf"].includes(normalized)) return "pdf";
  if (normalized.startsWith("video/")) return "video";
  if (normalized.startsWith("audio/")) return "audio";
  if (normalized.startsWith("image/")) return "image";
  return undefined;
}

export function detectPlatformPreviewKind(
  resource?: PlatformPreviewResource | null
): PlatformPreviewKind {
  if (!resource) return "unsupported";
  if (clean(resource.previewPdfUrl)) return "pdf";

  const descriptor = `${resource.resourceType || ""} ${resource.title || ""}`
    .toLowerCase()
    .trim();
  if (/(mind[_\s-]*map|思维导图|知识导图)/.test(descriptor)) {
    return "mindmap";
  }
  if (
    /(coding[_\s-]*practice|programming|exercise[_\s-]*set|编程|代码练习|练习题集)/.test(
      descriptor
    )
  ) {
    return "json";
  }

  const preferredUrl =
    clean(resource.url) ||
    clean(resource.previewUrl) ||
    clean(resource.downloadUrl) ||
    clean(resource.objectKey);
  const urlKind = kindFromExtension(getResourceUrlExtension(preferredUrl));
  if (urlKind) return urlKind;

  const formatKind =
    kindFromFormat(clean(resource.contentFormat)) ||
    kindFromFormat(clean(resource.mimeType));
  if (formatKind) return formatKind;

  const titleKind = kindFromExtension(getResourceUrlExtension(resource.title));
  if (titleKind) return titleKind;

  if (/(video|视频)/.test(descriptor)) return "video";
  if (/(audio|音频|语音)/.test(descriptor)) return "audio";
  if (/(image|图片|插图)/.test(descriptor)) return "image";
  if (/\bpdf\b/.test(descriptor)) return "pdf";
  return "unsupported";
}

export function resolvePlatformPreviewSource(
  resource?: PlatformPreviewResource | null
): ResolvedPlatformPreviewSource {
  const urlOptions = platformResourceUrlOptions();
  const previewPdfUrl = normalizePlatformResourceUrl(
    resource?.previewPdfUrl,
    urlOptions
  );
  const previewUrl = normalizePlatformResourceUrl(
    resource?.previewUrl,
    urlOptions
  );
  const directUrl = normalizePlatformResourceUrl(resource?.url, urlOptions);
  const downloadUrl = normalizePlatformResourceUrl(
    resource?.downloadUrl,
    urlOptions
  );
  const objectUrl = buildPlatformObjectUrl(resource?.objectKey, urlOptions);
  const urlCandidates = uniquePlatformResourceUrls(
    [previewPdfUrl, previewUrl, directUrl, downloadUrl, objectUrl],
    urlOptions
  );
  const downloadUrlCandidates = uniquePlatformResourceUrls(
    [downloadUrl, directUrl, previewUrl, previewPdfUrl, objectUrl],
    urlOptions
  );
  const url = urlCandidates[0] || "";
  return {
    kind: previewPdfUrl ? "pdf" : detectPlatformPreviewKind(resource),
    url,
    downloadUrl: downloadUrlCandidates[0] || "",
    urlCandidates,
    downloadUrlCandidates,
    content: String(resource?.content || ""),
    title: clean(resource?.title) || "课程资料"
  };
}

export function platformPreviewKindLabel(kind: PlatformPreviewKind) {
  const labels: Record<PlatformPreviewKind, string> = {
    html: "HTML 互动资料",
    markdown: "Markdown 文档",
    text: "文本文件",
    mindmap: "思维导图",
    json: "JSON 结构化内容",
    docx: "Word 文档",
    pptx: "PowerPoint 演示文稿",
    spreadsheet: "电子表格",
    pdf: "PDF 文档",
    video: "视频资料",
    audio: "音频资料",
    image: "图片资料",
    unsupported: "课程文件"
  };
  return labels[kind];
}

export function isOfficePreviewKind(kind: PlatformPreviewKind) {
  return ["docx", "pptx", "spreadsheet"].includes(kind);
}

export function isTextPreviewKind(kind: PlatformPreviewKind) {
  return ["markdown", "text", "mindmap", "json"].includes(kind);
}

export function isPlatformNativeResourceRuntime() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const root = document.documentElement;
  if (
    root.classList.contains("qiming-native-webview") ||
    root.classList.contains("qiming-mini-program-webview") ||
    root.dataset.qimingNative === "true" ||
    root.dataset.qimingMiniProgram === "true"
  ) {
    return true;
  }

  const hashQuery = window.location.hash.includes("?")
    ? window.location.hash.slice(window.location.hash.indexOf("?") + 1)
    : "";
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(hashQuery);
  if (
    searchParams.get("qimingNative") === "1" ||
    searchParams.get("qimingMiniProgram") === "1" ||
    hashParams.get("qimingNative") === "1" ||
    hashParams.get("qimingMiniProgram") === "1"
  ) {
    return true;
  }

  try {
    return (
      localStorage.getItem("qimingNativeWebView") === "1" ||
      localStorage.getItem("qimingMiniProgramWebView") === "1" ||
      sessionStorage.getItem("qimingNativeWebView") === "1" ||
      sessionStorage.getItem("qimingMiniProgramWebView") === "1"
    );
  } catch {
    return false;
  }
}

export function isPlatformMiniProgramResourceRuntime() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }
  const root = document.documentElement;
  if (
    root.classList.contains("qiming-mini-program-webview") ||
    root.dataset.qimingMiniProgram === "true"
  ) {
    return true;
  }

  const hashQuery = window.location.hash.includes("?")
    ? window.location.hash.slice(window.location.hash.indexOf("?") + 1)
    : "";
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(hashQuery);
  if (
    searchParams.get("qimingMiniProgram") === "1" ||
    hashParams.get("qimingMiniProgram") === "1"
  ) {
    return true;
  }

  try {
    return (
      localStorage.getItem("qimingMiniProgramWebView") === "1" ||
      sessionStorage.getItem("qimingMiniProgramWebView") === "1"
    );
  } catch {
    return false;
  }
}

function getPlatformPlusStorage() {
  if (
    !isPlatformNativeResourceRuntime() ||
    isPlatformMiniProgramResourceRuntime()
  ) {
    return undefined;
  }
  const storage = (window as any).plus?.storage;
  return storage?.setItem && storage?.getItem && storage?.removeItem
    ? storage
    : undefined;
}

function getPlatformUniBridge() {
  if (!getPlatformPlusStorage()) return undefined;
  const bridge = (window as PlatformBridgeWindow).uni;
  return typeof bridge?.navigateTo === "function" ? bridge : undefined;
}

function getPlatformMiniProgramBridge() {
  if (!isPlatformMiniProgramResourceRuntime()) return undefined;
  const bridgeWindow = window as PlatformBridgeWindow;
  const bridge = bridgeWindow.wx?.miniProgram || bridgeWindow.uni;
  return typeof bridge?.redirectTo === "function" &&
    typeof bridge?.postMessage === "function"
    ? bridge
    : undefined;
}

function createPlatformDownloadKey() {
  const bytes = new Uint8Array(12);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return `${Date.now().toString(36)}-${Array.from(bytes, byte =>
    byte.toString(16).padStart(2, "0")
  ).join("")}`;
}

export function buildPlatformNativeDownloadRoute(key: string) {
  const params = new URLSearchParams();
  params.set("key", key);
  return `/pages/resource-download/index?${params.toString()}`;
}

function getPlatformDownloadReturnRoute() {
  const hashRoute = clean(window.location.hash.replace(/^#/, ""));
  if (!hashRoute.startsWith("/") || hashRoute.includes("://")) return "/home";
  const queryIndex = hashRoute.indexOf("?");
  if (queryIndex < 0) return hashRoute.slice(0, 1024);

  const path = hashRoute.slice(0, queryIndex);
  const params = new URLSearchParams(hashRoute.slice(queryIndex + 1));
  params.delete("qimingNative");
  params.delete("qimingMiniProgram");
  params.delete("nativeStatusTop");
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}`.slice(0, 1024);
}

async function redirectToPlatformMiniProgramDownload(
  resource: PlatformPreviewResource,
  url: string
) {
  const bridge = getPlatformMiniProgramBridge();
  if (!bridge?.redirectTo || !bridge.postMessage) return false;

  let absoluteUrl = "";
  try {
    const target = new URL(url, window.location.href);
    absoluteUrl = /^https?:$/.test(target.protocol) ? target.href : "";
  } catch {
    return false;
  }
  if (!absoluteUrl) return false;

  const key = createPlatformDownloadKey();
  const route = buildPlatformNativeDownloadRoute(key);
  const returnRoute = getPlatformDownloadReturnRoute();

  return new Promise<boolean>(resolve => {
    let settled = false;
    let fallbackTimer = 0;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallbackTimer);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      resolve(result);
    };
    const handlePageHide = () => finish(true);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") finish(true);
    };

    window.addEventListener("pagehide", handlePageHide, { once: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    try {
      bridge.postMessage({
        data: {
          source: "qiming-h5",
          type: "resource-download",
          resource: {
            key,
            url: absoluteUrl,
            title: suggestedFilename(resource, absoluteUrl),
            kind: detectPlatformPreviewKind(resource),
            mime: clean(resource.mimeType),
            createdAt: Date.now(),
            returnRoute
          }
        }
      });
      bridge.redirectTo({ url: route });
    } catch (error) {
      console.warn(
        "[PlatformResourcePreview] mini-program download handoff failed",
        error
      );
      finish(false);
      return;
    }

    fallbackTimer = window.setTimeout(() => finish(false), 3000);
  });
}

async function navigateToPlatformNativeDownload(
  resource: PlatformPreviewResource,
  url: string
) {
  const bridge = getPlatformUniBridge();
  const storage = getPlatformPlusStorage();
  if (!bridge?.navigateTo || !storage) return false;

  let absoluteUrl = "";
  try {
    const target = new URL(url, window.location.href);
    absoluteUrl = /^https?:$/.test(target.protocol) ? target.href : "";
  } catch {
    return false;
  }
  if (!absoluteUrl) return false;

  const key = createPlatformDownloadKey();
  const payloadStorageKey = `${platformNativeDownloadPayloadPrefix}${key}`;
  const ackStorageKey = `${platformNativeDownloadAckPrefix}${key}`;
  const route = buildPlatformNativeDownloadRoute(key);
  try {
    storage.setItem(
      payloadStorageKey,
      JSON.stringify({
        url: absoluteUrl,
        title: suggestedFilename(resource, absoluteUrl),
        kind: detectPlatformPreviewKind(resource),
        mime: clean(resource.mimeType),
        createdAt: Date.now()
      })
    );
  } catch {
    return false;
  }

  return new Promise<boolean>(resolve => {
    let settled = false;
    let pollTimer = 0;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      window.clearInterval(pollTimer);
      storage.removeItem(ackStorageKey);
      if (!result) storage.removeItem(payloadStorageKey);
      resolve(result);
    };

    try {
      bridge.navigateTo({ url: route });
    } catch (error) {
      console.warn(
        "[PlatformResourcePreview] native download navigation failed",
        error
      );
      finish(false);
      return;
    }

    const startedAt = Date.now();
    pollTimer = window.setInterval(() => {
      let ack = "";
      try {
        ack = storage.getItem(ackStorageKey) || "";
      } catch {
        finish(false);
        return;
      }
      if (ack === "started") {
        finish(true);
      } else if (ack === "error" || Date.now() - startedAt >= 3000) {
        finish(false);
      }
    }, 50);
  });
}

function isTrustedResourceUrl(url: string) {
  if (typeof window === "undefined") return false;
  try {
    const target = new URL(url, window.location.href);
    const apiBase = new URL(
      String(import.meta.env.VITE_API_URL || "/api"),
      window.location.href
    );
    if (
      target.origin === window.location.origin &&
      target.pathname.startsWith(`${platformFileProxyPrefix}/`)
    ) {
      return false;
    }
    return (
      target.origin === window.location.origin ||
      target.origin === apiBase.origin
    );
  } catch {
    return false;
  }
}

export function buildPlatformResourceRequestInit(
  url: string,
  signal?: AbortSignal,
  accept = "*/*"
): RequestInit {
  const trusted = isTrustedResourceUrl(url);
  const headers: Record<string, string> = { Accept: accept };
  if (trusted) {
    const token = getToken();
    if (token?.accessToken) {
      headers.Authorization = formatToken(token.accessToken);
    }
    headers["X-Requested-With"] = "XMLHttpRequest";
  }
  return {
    headers,
    signal,
    credentials: trusted ? "include" : "omit",
    cache: "no-store"
  };
}

function mobileOfficePreviewLimit(options?: {
  maxBytes?: number;
  accept?: string;
}) {
  const requestedLimit = options?.maxBytes;
  const isOfficeRequest = /(?:openxmlformats|ms-excel|application\/pdf)/i.test(
    options?.accept || ""
  );
  if (!isPlatformNativeResourceRuntime() || !isOfficeRequest) {
    return requestedLimit;
  }
  return Math.min(requestedLimit || Number.POSITIVE_INFINITY, 16 * 1024 * 1024);
}

async function readPlatformResponseBuffer(
  response: Response,
  maxBytes?: number
) {
  const reader = maxBytes ? response.body?.getReader() : undefined;
  if (!reader) {
    const buffer = await response.arrayBuffer();
    if (maxBytes && buffer.byteLength > maxBytes) {
      throw new Error("RESOURCE_TOO_LARGE");
    }
    return buffer;
  }

  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) {
        await reader.cancel("RESOURCE_TOO_LARGE");
        throw new Error("RESOURCE_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const output = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output.buffer;
}

export async function fetchPlatformResourceBuffer(
  url: string | readonly string[],
  options?: {
    signal?: AbortSignal;
    maxBytes?: number;
    accept?: string;
    validate?: (result: PlatformResourceBufferResult) => void;
  }
) {
  const maxBytes = mobileOfficePreviewLimit(options);
  const sourceUrls = uniquePlatformResourceUrls(
    Array.isArray(url) ? [...url] : [url],
    platformResourceUrlOptions()
  );
  let lastError: unknown = new Error("RESOURCE_URL_MISSING");

  for (const sourceUrl of sourceUrls) {
    const requestUrl = normalizePlatformResourceFetchUrl(sourceUrl);
    try {
      const response = await fetch(
        requestUrl,
        buildPlatformResourceRequestInit(
          requestUrl,
          options?.signal,
          options?.accept || "*/*"
        )
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const contentLength = Number(response.headers.get("content-length") || 0);
      if (maxBytes && contentLength > maxBytes) {
        throw new Error("RESOURCE_TOO_LARGE");
      }

      const buffer = await readPlatformResponseBuffer(response, maxBytes);
      const result: PlatformResourceBufferResult = {
        buffer,
        contentType: response.headers.get("content-type") || "",
        contentDisposition: response.headers.get("content-disposition") || "",
        url: sourceUrl,
        requestUrl
      };
      options?.validate?.(result);
      return result;
    } catch (error) {
      if (
        options?.signal?.aborted ||
        (error instanceof Error && error.message === "RESOURCE_TOO_LARGE")
      ) {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError;
}

function normalizeCharset(value?: string) {
  const charset = clean(value).toLowerCase().replace(/["']/g, "");
  if (["gbk", "gb2312", "cp936"].includes(charset)) return "gb18030";
  if (charset === "utf8") return "utf-8";
  return charset;
}

function charsetFromContentType(contentType?: string) {
  const match = clean(contentType).match(/charset\s*=\s*([^;\s]+)/i);
  return normalizeCharset(match?.[1]);
}

function decodeWith(buffer: ArrayBuffer, encoding: string, fatal = false) {
  return new TextDecoder(encoding, { fatal }).decode(buffer);
}

export function decodePlatformTextBuffer(
  buffer: ArrayBuffer,
  contentType?: string
) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return decodeWith(buffer.slice(3), "utf-8");
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return decodeWith(buffer.slice(2), "utf-16le");
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return decodeWith(buffer.slice(2), "utf-16be");
  }

  const declaredCharset = charsetFromContentType(contentType);
  if (declaredCharset) {
    try {
      return decodeWith(buffer, declaredCharset);
    } catch {
      // Continue with the platform fallbacks below.
    }
  }

  try {
    return decodeWith(buffer, "utf-8", true);
  } catch {
    try {
      return decodeWith(buffer, "gb18030");
    } catch {
      return decodeWith(buffer, "utf-8");
    }
  }
}

export async function fetchPlatformResourceText(
  url: string | readonly string[],
  options?: { signal?: AbortSignal; maxBytes?: number }
) {
  const result = await fetchPlatformResourceBuffer(url, {
    signal: options?.signal,
    maxBytes: options?.maxBytes || 8 * 1024 * 1024,
    accept:
      "text/plain, text/markdown, application/json, text/html, application/xml, */*"
  });
  return decodePlatformTextBuffer(result.buffer, result.contentType);
}

function filenameFromDisposition(value: string) {
  const utf8Match = value.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim().replace(/["']/g, ""));
    } catch {
      return utf8Match[1].trim().replace(/["']/g, "");
    }
  }
  return (
    value.match(/filename\s*=\s*"([^"]+)"/i)?.[1] ||
    value.match(/filename\s*=\s*([^;]+)/i)?.[1]?.trim() ||
    ""
  );
}

function suggestedFilename(resource: PlatformPreviewResource, url: string) {
  const title = clean(resource.title) || "课程资料";
  if (getResourceUrlExtension(title)) return title;
  const extension = getResourceUrlExtension(url);
  return extension ? `${title}.${extension}` : title;
}

export async function downloadPlatformResource(
  resource: PlatformPreviewResource
) {
  const resolved = resolvePlatformPreviewSource(resource);
  const candidates = resolved.downloadUrlCandidates.length
    ? resolved.downloadUrlCandidates
    : resolved.urlCandidates;
  const url = candidates[0] || "";
  if (!url) throw new Error("RESOURCE_URL_MISSING");
  const requestUrl = normalizePlatformResourceFetchUrl(url);
  const publicDownloadUrl = candidates.find(
    candidate =>
      !isTrustedResourceUrl(normalizePlatformResourceFetchUrl(candidate))
  );

  if (isPlatformMiniProgramResourceRuntime() && publicDownloadUrl) {
    if (
      await redirectToPlatformMiniProgramDownload(resource, publicDownloadUrl)
    ) {
      return;
    }
    throw new Error("MINI_PROGRAM_DOWNLOAD_HANDOFF_FAILED");
  }

  // Native utility pages cannot receive the authenticated H5 session without
  // exposing credentials. Keep protected API downloads in the existing
  // authenticated fetch path; use the native page for signed/public files.
  if (
    publicDownloadUrl &&
    (await navigateToPlatformNativeDownload(resource, publicDownloadUrl))
  ) {
    return;
  }

  if (!isTrustedResourceUrl(requestUrl)) {
    const anchor = document.createElement("a");
    anchor.href = requestUrl;
    anchor.download = suggestedFilename(resource, url);
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return;
  }

  const result = await fetchPlatformResourceBuffer(candidates, {
    accept: "*/*"
  });
  const blob = new Blob([result.buffer], {
    type: result.contentType || "application/octet-stream"
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download =
    filenameFromDisposition(result.contentDisposition) ||
    suggestedFilename(resource, url);
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
