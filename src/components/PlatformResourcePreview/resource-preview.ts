import { formatToken, getToken } from "@/utils/auth";

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
  content: string;
  title: string;
}

const clean = (value?: string | null) => String(value || "").trim();
const platformFileProxyPrefix = "/mindmap-file";
const platformFileProxyTarget = clean(
  import.meta.env.VITE_MINDMAP_FILE_PROXY_TARGET
).replace(/\/$/, "");

export function normalizePlatformResourceFetchUrl(url: string) {
  const source = clean(url);
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
  const previewPdfUrl = usesStructuredSource
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
        resource.content ||
        resource.structuredData ||
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
    clean(resource.downloadUrl);
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
  const previewPdfUrl = clean(resource?.previewPdfUrl);
  const url =
    previewPdfUrl ||
    clean(resource?.url) ||
    clean(resource?.previewUrl) ||
    clean(resource?.downloadUrl);
  return {
    kind: previewPdfUrl ? "pdf" : detectPlatformPreviewKind(resource),
    url,
    downloadUrl:
      clean(resource?.downloadUrl) ||
      clean(resource?.url) ||
      clean(resource?.previewUrl) ||
      previewPdfUrl,
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

function isTrustedResourceUrl(url: string) {
  if (typeof window === "undefined") return false;
  try {
    const target = new URL(url, window.location.href);
    const apiBase = new URL(
      String(import.meta.env.VITE_API_URL || "/api"),
      window.location.href
    );
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

export async function fetchPlatformResourceBuffer(
  url: string,
  options?: {
    signal?: AbortSignal;
    maxBytes?: number;
    accept?: string;
  }
) {
  const requestUrl = normalizePlatformResourceFetchUrl(url);
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
  if (options?.maxBytes && contentLength > options.maxBytes) {
    throw new Error("RESOURCE_TOO_LARGE");
  }

  const buffer = await response.arrayBuffer();
  if (options?.maxBytes && buffer.byteLength > options.maxBytes) {
    throw new Error("RESOURCE_TOO_LARGE");
  }
  return {
    buffer,
    contentType: response.headers.get("content-type") || "",
    contentDisposition: response.headers.get("content-disposition") || ""
  };
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
  url: string,
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
  const url = resolved.downloadUrl || resolved.url;
  if (!url) throw new Error("RESOURCE_URL_MISSING");
  const requestUrl = normalizePlatformResourceFetchUrl(url);

  const response = await fetch(
    requestUrl,
    buildPlatformResourceRequestInit(requestUrl, undefined, "*/*")
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download =
    filenameFromDisposition(
      response.headers.get("content-disposition") || ""
    ) || suggestedFilename(resource, url);
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
