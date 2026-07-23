<template>
  <div class="video-analysis-panel" :class="currentTheme">
    <!-- 加载状态 -->
    <div v-if="loading" class="panel-loading">
      <div class="loading-spinner" />
      <span>正在加载视频分析数据...</span>
    </div>

    <!-- 请求错误状态 -->
    <div v-else-if="taskError" class="panel-error">
      <div class="error-icon">
        <svg
          viewBox="0 0 24 24"
          width="42"
          height="42"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
        >
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="7" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <span>{{ taskError.message }}</span>
      <button
        v-if="taskError.retryable"
        type="button"
        class="retry-button"
        @click="fetchAnalysis()"
      >
        重新加载
      </button>
    </div>

    <!-- 无任务状态 -->
    <div v-else-if="!taskData" class="panel-empty">
      <div class="empty-icon">
        <svg
          viewBox="0 0 24 24"
          width="48"
          height="48"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path
            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
          />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      </div>
      <span>{{ emptyMessage }}</span>
    </div>

    <!-- 处理中状态 -->
    <div v-else-if="taskData.status !== 'completed'" class="panel-processing">
      <div class="processing-header">
        <div class="status-badge processing">
          <span class="status-dot" />
          {{ statusText }}
        </div>
        <span class="file-name">{{ taskData.fileName }}</span>
      </div>
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: `${taskData.progress ?? 0}%` }"
        />
      </div>
      <p class="processing-msg">{{ taskData.message || statusMessage }}</p>
    </div>

    <!-- 分析结果展示 -->
    <div v-else class="panel-result">
      <!-- 结果信息头 -->
      <div class="result-header">
        <div class="result-meta">
          <span class="status-badge completed">
            <span class="status-dot" />
            分析完成
          </span>
          <span
            v-if="moduleData?.fileName"
            class="meta-item file-name-tag"
            :title="moduleData.fileName"
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
              />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            {{ moduleData.fileName }}
          </span>
        </div>
        <div class="result-times">
          <span v-if="moduleData?.createdAt" class="meta-item">
            <svg
              viewBox="0 0 24 24"
              width="13"
              height="13"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            创建: {{ formatDatetime(moduleData.createdAt) }}
          </span>
          <span v-if="moduleData?.completedAt" class="meta-item">
            <svg
              viewBox="0 0 24 24"
              width="13"
              height="13"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            完成: {{ formatDatetime(moduleData.completedAt) }}
          </span>
          <span v-if="moduleData?.schemaVersion" class="meta-item version-tag">
            v{{ moduleData.schemaVersion }}
          </span>
        </div>
      </div>

      <!-- 模块标签切换 -->
      <div class="module-tabs">
        <button
          v-for="tab in availableTabs"
          :key="tab.key"
          class="tab-btn"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          <component :is="tab.icon" />
          {{ tab.label }}
        </button>
      </div>

      <!-- 摘要 -->
      <div v-if="activeTab === 'summary'" class="module-content">
        <div class="summary-block">
          <div class="section-header">
            <span class="ai-badge">AI 生成</span>
          </div>
          <p class="summary-text">
            {{ moduleData?.summary?.text || "暂无摘要" }}
          </p>
        </div>
      </div>

      <!-- 章节速览 -->
      <div v-if="activeTab === 'chapters'" class="module-content">
        <div
          v-for="(ch, idx) in moduleData?.chapters || []"
          :key="idx"
          class="chapter-item"
          @click="$emit('seek-video', ch.startTime)"
        >
          <div class="chapter-time">
            <span class="time-badge">
              {{ formatTime(ch.startTime) }}
              <template v-if="ch.endTime != null">
                ~ {{ formatTime(ch.endTime) }}
              </template>
            </span>
          </div>
          <div class="chapter-info">
            <h4 class="chapter-title">{{ ch.title }}</h4>
            <p class="chapter-summary">{{ ch.summary }}</p>
            <span v-if="ch.endTime != null" class="chapter-duration"
              >时长 {{ formatDuration(ch.startTime, ch.endTime) }}</span
            >
          </div>
        </div>
        <div v-if="!moduleData?.chapters?.length" class="module-empty">
          暂无章节数据
        </div>
      </div>

      <!-- 问答回顾 -->
      <div v-if="activeTab === 'qa'" class="module-content">
        <div
          v-for="(qa, idx) in moduleData?.qaItems || []"
          :key="idx"
          class="qa-item"
        >
          <div class="qa-question">
            <span class="qa-icon q">Q</span>
            <span>{{ qa.question }}</span>
          </div>
          <div class="qa-answer">
            <span class="qa-icon a">A</span>
            <span>{{ qa.answer }}</span>
          </div>
        </div>
        <div v-if="!moduleData?.qaItems?.length" class="module-empty">
          暂无问答数据
        </div>
      </div>

      <!-- 转写文本 -->
      <div v-if="activeTab === 'transcription'" class="module-content">
        <div class="transcription-block">
          <p class="transcription-text">
            {{ moduleData?.transcription?.text || "暂无转写文本" }}
          </p>
        </div>
      </div>

      <!-- 要点提炼 -->
      <div v-if="activeTab === 'meeting'" class="module-content">
        <div
          v-if="moduleData?.meeting?.keywords?.length"
          class="meeting-section"
        >
          <h4 class="meeting-label">关键词</h4>
          <div class="keyword-tags">
            <span
              v-for="(kw, idx) in moduleData.meeting.keywords"
              :key="idx"
              class="keyword-tag"
            >
              {{ kw }}
            </span>
          </div>
        </div>
        <div
          v-if="moduleData?.meeting?.keyInformation?.length"
          class="meeting-section"
        >
          <h4 class="meeting-label">重点内容</h4>
          <ul class="key-info-list">
            <li
              v-for="(info, idx) in moduleData.meeting.keyInformation"
              :key="idx"
            >
              {{ info }}
            </li>
          </ul>
        </div>
        <div
          v-if="
            !moduleData?.meeting?.keywords?.length &&
            !moduleData?.meeting?.keyInformation?.length
          "
          class="module-empty"
        >
          暂无要点数据
        </div>
      </div>

      <!-- 思维导图 -->
      <div v-if="activeTab === 'mindmap'" class="module-content">
        <div v-if="hasMindmapContent" class="mindmap-block">
          <div class="mindmap-toolbar">
            <div v-if="mindmapFlowNodes.length" class="mindmap-tools-group">
              <button class="mindmap-action" @click="centerMindmap">
                <svg
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v4" />
                  <path d="M12 18v4" />
                  <path d="M2 12h4" />
                  <path d="M18 12h4" />
                </svg>
                居中
              </button>
              <button class="mindmap-action" @click="fitMindmap">
                <svg
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                  <path d="M16 3h3a2 2 0 0 1 2 2v3" />
                  <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
                  <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
                </svg>
                适配
              </button>
            </div>
            <a
              v-if="mindmapResourceUrl"
              class="mindmap-action mindmap-source"
              :href="mindmapResourceUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg
                viewBox="0 0 24 24"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
                />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              打开源文件
            </a>
          </div>
          <div ref="mindmapCanvasRef" class="mindmap-canvas">
            <VueFlow
              v-if="mindmapFlowNodes.length"
              v-model:nodes="mindmapFlowNodes"
              v-model:edges="mindmapFlowEdges"
              class="mindmap-viewer"
              :min-zoom="0.35"
              :max-zoom="1.8"
              :nodes-draggable="true"
              :nodes-connectable="false"
              :elements-selectable="false"
              :pan-on-scroll="false"
              :zoom-on-scroll="true"
              :zoom-on-pinch="true"
              :zoom-on-double-click="false"
              :prevent-scrolling="true"
              :fit-view-on-init="true"
              @nodes-initialized="onMindmapNodesInitialized"
            >
              <template #node-mindmap="{ data }">
                <div
                  class="mindmap-flow-node"
                  :class="`depth-${data.depth}`"
                  :style="{ width: `${data.width}px` }"
                  :title="data.rawLabel"
                >
                  <Handle
                    v-if="data.depth > 0"
                    id="target"
                    type="target"
                    :position="
                      data.side === 'left' ? Position.Right : Position.Left
                    "
                  />
                  <Handle
                    id="source-left"
                    type="source"
                    :position="Position.Left"
                  />
                  <Handle
                    id="source-right"
                    type="source"
                    :position="Position.Right"
                  />
                  <span>{{ data.label }}</span>
                </div>
              </template>
            </VueFlow>
            <div v-else-if="mindmapResourceUrl" class="mindmap-resource-stage">
              <img
                v-if="isMindmapImage && !mindmapResourceLoadError"
                class="mindmap-resource-image"
                :src="mindmapResourceUrl"
                alt="思维导图"
                draggable="false"
                @error="onMindmapResourceError"
              />
              <iframe
                v-else-if="!isMindmapJson && !mindmapResourceLoadError"
                class="mindmap-resource-frame"
                :src="mindmapResourceUrl"
                title="思维导图"
                @error="onMindmapResourceError"
              />
              <div v-else class="mindmap-resource-error">
                <span>
                  {{
                    isMindmapJson
                      ? "思维导图数据暂时无法解析"
                      : "源文件暂时无法内嵌预览"
                  }}
                </span>
                <a
                  :href="mindmapResourceUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  打开源文件
                </a>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="module-empty">暂无思维导图</div>
      </div>

      <!-- PPT 抽取 -->
      <div v-if="activeTab === 'ppt'" class="module-content">
        <div
          v-for="(page, idx) in moduleData?.pptPages || []"
          :key="idx"
          class="ppt-item"
          @click="$emit('seek-video', page.startTime)"
        >
          <div class="ppt-thumb">
            <img :src="page.imageUrl" :alt="`第${page.pageIndex}页`" />
          </div>
          <div class="ppt-info">
            <span class="ppt-page">第 {{ page.pageIndex }} 页</span>
            <span class="ppt-time">
              {{ formatTime(page.startTime) }}
              <template v-if="page.endTime">
                ~ {{ formatTime(page.endTime) }}</template
              >
            </span>
            <p class="ppt-summary">{{ page.summary }}</p>
          </div>
        </div>
        <div v-if="!moduleData?.pptPages?.length" class="module-empty">
          暂无 PPT 数据
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, h, nextTick, onBeforeUnmount } from "vue";
import { getToken, formatToken, hasManageAccess } from "@/utils/auth";
import { normalizeMindmapResourceUrl } from "@/utils/mindmap-resource.mjs";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import {
  Handle,
  Position,
  VueFlow,
  useVueFlow,
  type Edge,
  type Node
} from "@vue-flow/core";
import {
  getVideoAnalyzeTask,
  getVideoAnalyzeModules,
  getVideoAnalyzeResult,
  type VideoAnalyzeTask,
  type VideoAnalyzeModuleResult,
  type VideoAnalyzeFullResult,
  type ChapterItem,
  type QaItem,
  type PptPage
} from "@/api/frontend/videoAnalysis";
import {
  getVideoAnalysisList,
  type VideoAnalysisTask
} from "@/api/videoAnalysis";

const props = defineProps<{
  courseId: number;
  chapterId: number;
  currentTheme: string;
  currentHourId?: number;
  currentHourTitle?: string;
  currentHourFileUrl?: string;
}>();

defineEmits(["seek-video"]);

const loading = ref(false);
const taskData = ref<VideoAnalyzeTask | null>(null);
const moduleData = ref<VideoAnalyzeModuleResult | null>(null);
const activeTab = ref("chapters");
const emptyMessage = ref("本节暂无视频分析任务");

interface TaskErrorState {
  message: string;
  retryable: boolean;
}

class VideoAnalysisScopeError extends Error {}

const taskError = ref<TaskErrorState | null>(null);

interface MindmapNodeData {
  id: string;
  label: string;
  children?: MindmapNodeData[];
}
interface MindmapViewNode {
  label: string;
  rawLabel: string;
  depth: number;
  width: number;
  side: "left" | "right" | "root";
}

const mindmapCanvasRef = ref<HTMLElement | null>(null);
const mindmapFlowNodes = ref<Node<MindmapViewNode>[]>([]);
const mindmapFlowEdges = ref<Edge[]>([]);
const mindmapResourceLoadError = ref(false);
const { fitView, setCenter } = useVueFlow();

const apiBaseURL = () =>
  (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

const mindmapFileProxyPrefix = "/mindmap-file";
const mindmapFileProxyTarget =
  import.meta.env.VITE_MINDMAP_FILE_PROXY_TARGET || "";
const mindmapFileProxyOrigin =
  import.meta.env.VITE_PLATFORM_FILE_PROXY_ORIGIN || "";

const isAbsoluteUrl = (url: string) => /^https?:\/\//i.test(url);

const buildMindmapResourceUrl = (url: string) => {
  const value = String(url || "").trim();
  if (!value) return "";
  if (isAbsoluteUrl(value)) {
    return normalizeMindmapResourceUrl(value, {
      target: mindmapFileProxyTarget,
      proxyOrigin: mindmapFileProxyOrigin,
      dev: import.meta.env.DEV
    });
  }
  if (value.startsWith("//")) return `${window.location.protocol}${value}`;
  if (value.startsWith("/api/")) return value;

  const objectKey = value.replace(/^\/+/, "");
  if (mindmapFileProxyTarget) {
    return import.meta.env.DEV
      ? `${mindmapFileProxyPrefix}/${objectKey}`
      : `${mindmapFileProxyTarget.replace(/\/$/, "")}/${objectKey}`;
  }
  return `${apiBaseURL()}/${objectKey}`;
};

const isSameOriginResource = (url: string) => {
  if (!isAbsoluteUrl(url)) return true;

  try {
    return new URL(url).origin === window.location.origin;
  } catch {
    return false;
  }
};

const isMindmapFileProxyUrl = (url: string) =>
  url === mindmapFileProxyPrefix ||
  url.startsWith(`${mindmapFileProxyPrefix}/`);

const buildMindmapFetchUrl = (resourceUrl: string) => {
  if (
    !import.meta.env.DEV ||
    !isAbsoluteUrl(resourceUrl) ||
    !mindmapFileProxyTarget
  ) {
    return resourceUrl;
  }

  try {
    const resource = new URL(resourceUrl);
    const proxyTarget = new URL(mindmapFileProxyTarget);

    if (resource.origin !== proxyTarget.origin) return resourceUrl;

    return `${mindmapFileProxyPrefix}${resource.pathname}${resource.search}`;
  } catch {
    return resourceUrl;
  }
};

const isMindmapUrlLike = (value: unknown) => {
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (!text) return false;
  return (
    /^(https?:)?\/\//i.test(text) ||
    /^\/[^/]/.test(text) ||
    /\.(json|png|jpe?g|webp|gif|svg|html?|pdf)(\?|#|$)/i.test(text)
  );
};

const buildMindmapFetchOptions = (url: string): RequestInit => {
  if (!isSameOriginResource(url) || isMindmapFileProxyUrl(url)) {
    return {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      headers: {
        Accept: "application/json, text/plain, */*"
      }
    };
  }

  const token = getToken();
  const headers: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    "X-Requested-With": "XMLHttpRequest"
  };

  if (token?.accessToken) {
    headers.Authorization = formatToken(token.accessToken);
  }

  return {
    method: "GET",
    headers,
    credentials: "include"
  };
};

const parseMaybeJson = (value: unknown): unknown => {
  if (typeof value !== "string") return value;

  const text = value.trim();
  if (!text || !/^[\[{]/.test(text)) return value;

  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
};

const getField = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    if (key in source) return source[key];

    const matchedKey = Object.keys(source).find(
      item => item.toLowerCase() === key.toLowerCase()
    );
    if (matchedKey) return source[matchedKey];
  }

  return undefined;
};

const pickText = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = getField(source, [key]);
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
};

const pickChildren = (source: Record<string, unknown>) => {
  const childKeys = [
    "children",
    "childNodes",
    "childrenNodes",
    "subTopics",
    "subtopics",
    "topics",
    "nodes",
    "subNodes",
    "sub_nodes",
    "items",
    "points",
    "list"
  ];

  for (const key of childKeys) {
    const value = parseMaybeJson(getField(source, [key]));
    if (Array.isArray(value)) return value;
  }

  return [];
};

const normalizeMindmapNode = (
  value: unknown,
  path = "root",
  fallbackLabel = "思维导图"
): MindmapNodeData | null => {
  const parsed = parseMaybeJson(value);

  if (Array.isArray(parsed)) {
    const children = parsed
      .map((item, index) =>
        normalizeMindmapNode(item, `${path}-${index}`, fallbackLabel)
      )
      .filter(Boolean) as MindmapNodeData[];

    return children.length
      ? {
          id: path,
          label: fallbackLabel,
          children
        }
      : null;
  }

  if (!parsed || typeof parsed !== "object") {
    return typeof parsed === "string" &&
      parsed.trim() &&
      !isMindmapUrlLike(parsed)
      ? {
          id: path,
          label: parsed.trim()
        }
      : null;
  }

  const source = parsed as Record<string, unknown>;
  const label =
    pickText(source, [
      "label",
      "title",
      "name",
      "text",
      "topic",
      "value",
      "content",
      "summary",
      "key"
    ]) || "";
  const rawChildren = pickChildren(source);
  const children = rawChildren
    .map((item, index) =>
      normalizeMindmapNode(item, `${path}-${index}`, fallbackLabel)
    )
    .filter(Boolean) as MindmapNodeData[];

  if (!label && !children.length) return null;

  return {
    id: path,
    label: label || (path === "root" ? fallbackLabel : "分支"),
    children: children.length ? children : undefined
  };
};

const extractMindmapTree = (payload: unknown): MindmapNodeData | null => {
  const raw = parseMaybeJson(payload) as any;
  if (!raw) return null;

  const candidates = [
    raw?.data?.mindMap?.tree,
    raw?.data?.mindmap?.tree,
    raw?.data?.mind_map?.tree,
    raw?.data?.mindMapTree,
    raw?.data?.mind_map_tree,
    raw?.data?.tree,
    raw?.data?.root,
    raw?.mindMap?.tree,
    raw?.mindmap?.tree,
    raw?.mind_map?.tree,
    raw?.mindMapTree,
    raw?.mind_map_tree,
    raw?.tree,
    raw?.root,
    raw?.data?.mindMap,
    raw?.data?.mindmap,
    raw?.data?.mind_map,
    raw?.mindMap,
    raw?.mindmap,
    raw?.mind_map,
    raw?.data,
    raw
  ];

  for (const candidate of candidates) {
    const tree = normalizeMindmapNode(candidate);
    if (tree) return tree;
  }

  return null;
};

const normalizeKeyName = (key: string) =>
  key.toLowerCase().replace(/[^a-z0-9]/g, "");

const collectMindmapUrlCandidates = (
  value: unknown,
  contextKey = "",
  depth = 0,
  result: Array<{ value: string; score: number }> = []
) => {
  if (depth > 5 || value == null) return result;

  const parsed = parseMaybeJson(value);

  if (typeof parsed === "string") {
    const text = parsed.trim();
    if (!isMindmapUrlLike(text)) return result;

    const key = normalizeKeyName(contextKey);
    const lowerUrl = text.toLowerCase();
    const hasMindKey = key.includes("mind") || key.includes("map");
    const hasUrlKey = key.includes("url") || key.includes("path");
    const hasMindPath =
      lowerUrl.includes("mind_map") || lowerUrl.includes("mindmap");

    result.push({
      value: text,
      score:
        (hasMindKey && hasUrlKey ? 100 : 0) +
        (hasMindPath ? 40 : 0) +
        (hasMindKey ? 20 : 0) +
        (hasUrlKey ? 10 : 0) -
        depth
    });
    return result;
  }

  if (Array.isArray(parsed)) {
    parsed.forEach((item, index) => {
      collectMindmapUrlCandidates(
        item,
        `${contextKey}_${index}`,
        depth + 1,
        result
      );
    });
    return result;
  }

  if (typeof parsed !== "object") return result;

  Object.entries(parsed as Record<string, unknown>).forEach(([key, item]) => {
    const normalized = normalizeKeyName(key);
    const parent = normalizeKeyName(contextKey);
    const nextContext =
      parent.includes("mind") || normalized.includes("mind")
        ? `${contextKey}_${key}`
        : key;

    if (
      normalized === "mindmapurl" ||
      normalized === "mindmapfileurl" ||
      normalized === "mindmapjsonurl" ||
      (normalized.includes("mind") &&
        (normalized.includes("url") || normalized.includes("path")))
    ) {
      collectMindmapUrlCandidates(item, nextContext, depth, result);
      return;
    }

    if (parent.includes("mind") || normalized.includes("mind")) {
      collectMindmapUrlCandidates(item, nextContext, depth + 1, result);
    } else if (depth < 3 && typeof item === "object" && item !== null) {
      collectMindmapUrlCandidates(item, key, depth + 1, result);
    }
  });

  return result;
};

const extractMindmapUrl = (payload: unknown) => {
  const raw = parseMaybeJson(payload) as any;
  const candidates = [
    raw,
    raw?.mindMap?.url,
    raw?.mindMap?.fileUrl,
    raw?.mindMap?.jsonUrl,
    raw?.mindMap?.path,
    raw?.mindmap?.url,
    raw?.mindmap?.fileUrl,
    raw?.mindmap?.jsonUrl,
    raw?.mindmap?.path,
    raw?.mind_map?.url,
    raw?.mind_map?.file_url,
    raw?.mind_map?.json_url,
    raw?.mind_map?.path,
    raw?.mindMapUrl,
    raw?.mindmapUrl,
    raw?.mind_map_url,
    raw?.mindMapFileUrl,
    raw?.mindMapJsonUrl,
    raw?.mindMapPath,
    raw?.data?.mindMap?.url,
    raw?.data?.mindMap?.fileUrl,
    raw?.data?.mindMap?.jsonUrl,
    raw?.data?.mindMap?.path,
    raw?.data?.mindmap?.url,
    raw?.data?.mindmap?.fileUrl,
    raw?.data?.mindmap?.jsonUrl,
    raw?.data?.mindmap?.path,
    raw?.data?.mind_map?.url,
    raw?.data?.mind_map?.file_url,
    raw?.data?.mind_map?.json_url,
    raw?.data?.mind_map?.path,
    raw?.data?.mindMapUrl,
    raw?.data?.mindmapUrl,
    raw?.data?.mind_map_url,
    raw?.data?.mindMapFileUrl,
    raw?.data?.mindMapJsonUrl,
    raw?.data?.mindMapPath
  ];

  const direct = candidates.find(isMindmapUrlLike) as string | undefined;
  if (direct) return direct.trim();

  const deepCandidates = collectMindmapUrlCandidates(raw)
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return deepCandidates[0]?.value;
};

const normalizeMindmapPayload = (payload: unknown) => {
  const tree = extractMindmapTree(payload);
  const url = extractMindmapUrl(payload);

  if (!tree && !url) return null;

  return {
    ...(url ? { url } : {}),
    ...(tree ? { tree } : {})
  };
};

const fetchMindmapTreeFromUrl = async (url: string) => {
  const resourceUrl = buildMindmapResourceUrl(url);
  if (!resourceUrl) return null;

  const fetchUrl = buildMindmapFetchUrl(resourceUrl);

  const response = await fetch(fetchUrl, buildMindmapFetchOptions(fetchUrl));

  if (!response.ok) {
    throw new Error(`Mindmap resource request failed: ${response.status}`);
  }

  const text = await response.text();
  const payload = parseMaybeJson(text);
  return extractMindmapTree(payload);
};

const mindmapResourceUrl = computed(() => {
  const url = moduleData.value?.mindMap?.url;
  return url ? buildMindmapResourceUrl(url) : "";
});

const isMindmapImage = computed(() =>
  /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(mindmapResourceUrl.value)
);

const isMindmapJson = computed(() =>
  /\.json(\?|#|$)/i.test(mindmapResourceUrl.value)
);

const hasMindmapContent = computed(
  () => mindmapFlowNodes.value.length > 0 || Boolean(mindmapResourceUrl.value)
);

const onMindmapResourceError = () => {
  mindmapResourceLoadError.value = true;
};

const hydrateMindmapTree = async (
  requestId: number,
  requestCourseId: number,
  requestChapterId: number,
  requestHourId: number
) => {
  const mindMap = moduleData.value?.mindMap;
  if (!mindMap || mindMap.tree || !mindMap.url) return;

  try {
    const tree = await fetchMindmapTreeFromUrl(mindMap.url);
    if (
      isStaleRequest(
        requestId,
        requestCourseId,
        requestChapterId,
        requestHourId
      )
    )
      return;
    if (tree && moduleData.value?.mindMap) {
      moduleData.value.mindMap = {
        ...moduleData.value.mindMap,
        tree
      };
    }
  } catch (error) {
    console.warn("[VideoAnalysisPanel] mindmap url load failed", {
      url: mindMap.url,
      error
    });
  }
};

const splitMindmapLabel = (label: string, maxChars: number) => {
  const normalized = String(label || "")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length <= maxChars) return [normalized];

  const lines: string[] = [];
  let rest = normalized;
  const preferredBreaks = ["：", "，", "、", "；", ":", ",", ";", "，", " "];

  while (rest.length > maxChars && lines.length < 4) {
    const windowText = rest.slice(0, maxChars + 1);
    let breakIndex = -1;

    for (const mark of preferredBreaks) {
      const index = windowText.lastIndexOf(mark);
      if (index >= Math.floor(maxChars * 0.45)) {
        breakIndex = index + (mark === " " ? 0 : 1);
        break;
      }
    }

    if (breakIndex <= 0) breakIndex = maxChars;

    lines.push(rest.slice(0, breakIndex).trim());
    rest = rest.slice(breakIndex).trim();
  }

  if (rest) lines.push(rest);
  return lines.filter(Boolean);
};

const formatMindmapLabel = (label: string, depth: number) => {
  const maxChars = depth === 0 ? 18 : depth === 1 ? 12 : 14;
  return splitMindmapLabel(label, maxChars).join("\n");
};

const estimateMindmapNodeWidth = (depth: number) => {
  if (depth === 0) return 260;
  if (depth === 1) return 220;
  return 245;
};

const estimateMindmapNodeHeight = (label: string, depth: number) => {
  const lineCount = formatMindmapLabel(label, depth).split("\n").length;
  return Math.max(depth === 0 ? 58 : 50, lineCount * 22 + 26);
};

const estimateMindmapSubtreeHeight = (
  node: MindmapNodeData,
  depth: number
): number => {
  const ownHeight = estimateMindmapNodeHeight(node.label, depth);
  const children = node.children || [];
  if (!children.length) return ownHeight;

  const childHeights = children.map(child =>
    estimateMindmapSubtreeHeight(child, depth + 1)
  );
  const childrenHeight =
    childHeights.reduce((sum, height) => sum + height, 0) +
    Math.max(0, childHeights.length - 1) * 18;

  return Math.max(ownHeight, childrenHeight);
};

const mindmapNodeX = (
  side: MindmapViewNode["side"],
  depth: number,
  width: number
) => {
  if (side === "root") return -width / 2;

  const gap = depth === 1 ? 260 : 300;
  const offset = 150 + (depth - 1) * gap;
  return side === "left" ? -offset - width : offset;
};

const createMindmapFlowNode = (
  source: MindmapNodeData,
  depth: number,
  side: MindmapViewNode["side"],
  yCenter: number,
  nodes: Node<MindmapViewNode>[],
  path: string
) => {
  const width = estimateMindmapNodeWidth(depth);
  const height = estimateMindmapNodeHeight(source.label, depth);
  const id = path;

  nodes.push({
    id,
    type: "mindmap",
    position: {
      x: mindmapNodeX(side, depth, width),
      y: yCenter - height / 2
    },
    data: {
      label: formatMindmapLabel(source.label, depth),
      rawLabel: source.label,
      depth,
      side,
      width
    },
    draggable: true,
    selectable: false,
    connectable: false
  });

  return id;
};

const createMindmapEdge = (
  parentId: string,
  childId: string,
  side: MindmapViewNode["side"]
): Edge => ({
  id: `${parentId}-${childId}`,
  source: parentId,
  target: childId,
  sourceHandle: side === "left" ? "source-left" : "source-right",
  targetHandle: "target",
  type: "default",
  pathOptions: {
    curvature: 0.28
  },
  selectable: false,
  class: "mindmap-flow-edge",
  style: {
    stroke: "rgba(99, 102, 241, 0.38)",
    strokeWidth: 2.4
  }
});

const layoutMindmapSubtree = (
  node: MindmapNodeData,
  depth: number,
  side: "left" | "right",
  yCenter: number,
  parentId: string,
  path: string,
  nodes: Node<MindmapViewNode>[],
  edges: Edge[]
) => {
  const nodeId = createMindmapFlowNode(node, depth, side, yCenter, nodes, path);

  edges.push(createMindmapEdge(parentId, nodeId, side));

  const children = node.children || [];
  if (!children.length) return;

  const childHeights = children.map(child =>
    estimateMindmapSubtreeHeight(child, depth + 1)
  );
  const totalHeight =
    childHeights.reduce((sum, height) => sum + height, 0) +
    Math.max(0, childHeights.length - 1) * 18;
  let cursor = yCenter - totalHeight / 2;

  children.forEach((child, index) => {
    const childHeight = childHeights[index];
    const childCenter = cursor + childHeight / 2;

    layoutMindmapSubtree(
      child,
      depth + 1,
      side,
      childCenter,
      nodeId,
      `${path}-${index}`,
      nodes,
      edges
    );

    cursor += childHeight + 18;
  });
};

const buildMindmapFlow = (tree: MindmapNodeData) => {
  const nodes: Node<MindmapViewNode>[] = [];
  const edges: Edge[] = [];
  const rootId = createMindmapFlowNode(tree, 0, "root", 0, nodes, "root");
  const children = tree.children || [];
  const splitIndex = Math.ceil(children.length / 2);
  const leftChildren = children.slice(splitIndex);
  const rightChildren = children.slice(0, splitIndex);

  const layoutSide = (
    sideChildren: MindmapNodeData[],
    side: "left" | "right"
  ) => {
    const heights = sideChildren.map(child =>
      estimateMindmapSubtreeHeight(child, 1)
    );
    const totalHeight =
      heights.reduce((sum, height) => sum + height, 0) +
      Math.max(0, heights.length - 1) * 26;
    let cursor = -totalHeight / 2;

    sideChildren.forEach((child, index) => {
      const childHeight = heights[index];
      const childCenter = cursor + childHeight / 2;

      layoutMindmapSubtree(
        child,
        1,
        side,
        childCenter,
        rootId,
        `${side}-${index}`,
        nodes,
        edges
      );

      cursor += childHeight + 26;
    });
  };

  layoutSide(rightChildren, "right");
  layoutSide(leftChildren, "left");

  return { nodes, edges };
};

const fitMindmap = () => {
  nextTick(() => {
    fitView({ padding: 0.18, maxZoom: 1, duration: 180 });
  });
};

const centerMindmap = () => {
  setCenter(0, 0, { zoom: 0.9, duration: 180 });
};

const onMindmapNodesInitialized = () => {
  fitMindmap();
};

const buildMindmapFromData = async () => {
  const tree = moduleData.value?.mindMap?.tree as MindmapNodeData | undefined;
  if (!tree) {
    mindmapFlowNodes.value = [];
    mindmapFlowEdges.value = [];
    return;
  }

  const { nodes, edges } = buildMindmapFlow(tree);
  mindmapFlowNodes.value = nodes;
  mindmapFlowEdges.value = edges;
  await nextTick();
  fitMindmap();
};

const statusText = computed(() => {
  const s = taskData.value?.status;
  if (s === "processing") return "处理中";
  if (s === "submitted") return "已提交";
  if (s === "pending") return "等待中";
  if (s === "failed") return "处理失败";
  if (s === "cancelled") return "任务已取消";
  return s || "未知";
});

const statusMessage = computed(() => {
  const status = taskData.value?.status;
  if (status === "failed") return "本节视频分析失败";
  if (status === "cancelled") return "本节视频分析任务已取消";
  if (status === "submitted") return "任务已提交，等待开始分析";
  if (status === "pending") return "任务正在排队";
  return "正在分析中...";
});

// Tab 图标用 render function
const IconSummary = () =>
  h(
    "svg",
    {
      viewBox: "0 0 24 24",
      width: 16,
      height: 16,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 2
    },
    [
      h("path", {
        d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
      }),
      h("polyline", { points: "14 2 14 8 20 8" })
    ]
  );

const IconChapters = () =>
  h(
    "svg",
    {
      viewBox: "0 0 24 24",
      width: 16,
      height: 16,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 2
    },
    [
      h("line", { x1: 8, y1: 6, x2: 21, y2: 6 }),
      h("line", { x1: 8, y1: 12, x2: 21, y2: 12 }),
      h("line", { x1: 8, y1: 18, x2: 21, y2: 18 }),
      h("line", { x1: 3, y1: 6, x2: 3.01, y2: 6 }),
      h("line", { x1: 3, y1: 12, x2: 3.01, y2: 12 }),
      h("line", { x1: 3, y1: 18, x2: 3.01, y2: 18 })
    ]
  );

const IconQa = () =>
  h(
    "svg",
    {
      viewBox: "0 0 24 24",
      width: 16,
      height: 16,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 2
    },
    [
      h("circle", { cx: 12, cy: 12, r: 10 }),
      h("path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }),
      h("line", { x1: 12, y1: 17, x2: 12.01, y2: 17 })
    ]
  );

const IconTranscription = () =>
  h(
    "svg",
    {
      viewBox: "0 0 24 24",
      width: 16,
      height: 16,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 2
    },
    [
      h("path", { d: "M4 7V4h16v3" }),
      h("path", { d: "M9 20h6" }),
      h("path", { d: "M12 4v16" })
    ]
  );

const IconMeeting = () =>
  h(
    "svg",
    {
      viewBox: "0 0 24 24",
      width: 16,
      height: 16,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 2
    },
    [
      h("polygon", {
        points:
          "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
      })
    ]
  );

const IconMindmap = () =>
  h(
    "svg",
    {
      viewBox: "0 0 24 24",
      width: 16,
      height: 16,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 2
    },
    [
      h("circle", { cx: 12, cy: 12, r: 3 }),
      h("path", { d: "M12 2v7" }),
      h("path", { d: "M12 15v7" }),
      h("path", { d: "M2 12h7" }),
      h("path", { d: "M15 12h7" })
    ]
  );

const IconPpt = () =>
  h(
    "svg",
    {
      viewBox: "0 0 24 24",
      width: 16,
      height: 16,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 2
    },
    [
      h("rect", { x: 2, y: 3, width: 20, height: 14, rx: 2, ry: 2 }),
      h("line", { x1: 8, y1: 21, x2: 16, y2: 21 }),
      h("line", { x1: 12, y1: 17, x2: 12, y2: 21 })
    ]
  );

const allTabs = [
  { key: "summary", label: "摘要", icon: IconSummary },
  { key: "chapters", label: "章节速览", icon: IconChapters },
  { key: "qa", label: "问答回顾", icon: IconQa },
  { key: "meeting", label: "要点提炼", icon: IconMeeting },
  { key: "transcription", label: "转写文本", icon: IconTranscription },
  { key: "mindmap", label: "思维导图", icon: IconMindmap },
  { key: "ppt", label: "PPT", icon: IconPpt }
];

const availableTabs = computed(() => {
  return allTabs;
});

const formatTime = (ms: number | undefined | null) => {
  if (ms == null) return "--:--";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
};

const formatDuration = (
  startMs: number | null | undefined,
  endMs: number | null | undefined
) => {
  if (startMs == null || endMs == null) return "";
  const diff = Math.max(0, endMs - startMs);
  const totalSec = Math.floor(diff / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}分${s}秒` : `${s}秒`;
};

const formatDatetime = (dt: string | undefined | null) => {
  if (!dt) return "";
  try {
    const d = new Date(dt);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return dt;
  }
};

const normalizeLessonText = (value: string) => {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/^.*\//, "")
    .replace(/\.[a-z0-9]{2,6}$/i, "")
    .replace(/[\s_\-—–()（）\[\]【】《》:：'"`·]/g, "")
    .replace(/^第?\d+(\.\d+)?[章节课讲]?/, "");
};

const extractLessonIndex = (value: string): string | null => {
  const raw = String(value || "").toLowerCase();

  // 1.1.1 / 1-1-1 / 1_1_1
  const triple = raw.match(
    /(\d{1,3})\s*[._\-]\s*(\d{1,3})\s*[._\-]\s*(\d{1,3})/
  );
  if (triple) {
    return `${Number(triple[1])}.${Number(triple[2])}.${Number(triple[3])}`;
  }

  // 1.2 / 1-2 / 1_2
  const pair = raw.match(/(\d{1,2})\s*[._\-]\s*(\d{1,2})/);
  if (pair) return `${Number(pair[1])}.${Number(pair[2])}`;

  // 第1章第2节
  const zh = raw.match(
    /第\s*(\d{1,2})\s*章[^\d]{0,6}第\s*(\d{1,2})\s*[节课讲]/
  );
  if (zh) return `${Number(zh[1])}.${Number(zh[2])}`;

  return null;
};

const normalizeVideoPath = (value: string) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return decodeURIComponent(new URL(raw).pathname).replace(/^\/+/, "");
  } catch {
    return raw.split(/[?#]/, 1)[0].replace(/^\/+/, "");
  }
};

const isLikelySameLesson = (fileName: string, hourTitle: string) => {
  const fileIndex = extractLessonIndex(fileName);
  const hourIndex = extractLessonIndex(hourTitle);

  // 优先匹配三级课时编号；旧文件名只有两级编号时兼容前两级。
  if (fileIndex && hourIndex) {
    if (fileIndex === hourIndex) return true;
    const fileParts = fileIndex.split(".");
    const hourParts = hourIndex.split(".");
    if (fileParts.length !== hourParts.length) {
      return (
        fileParts.slice(0, 2).join(".") === hourParts.slice(0, 2).join(".")
      );
    }
    return false;
  }

  const fileNorm = normalizeLessonText(fileName);
  const hourNorm = normalizeLessonText(hourTitle);
  if (!fileNorm || !hourNorm) return true;
  return (
    fileNorm === hourNorm ||
    fileNorm.includes(hourNorm) ||
    hourNorm.includes(fileNorm)
  );
};

const pickPreferredLessonTask = <
  T extends { fileName: string; status: string; hourId?: number }
>(
  tasks: T[]
) => {
  const statusOrder = [
    "completed",
    "processing",
    "submitted",
    "pending",
    "failed",
    "cancelled"
  ];
  const pickByStatus = (candidates: T[]) => {
    for (const status of statusOrder) {
      const task = candidates.find(item => item.status === status);
      if (task) return task;
    }
    return candidates[0] || null;
  };

  const currentHourId = Number(props.currentHourId || 0);
  const exactHourMatches = currentHourId
    ? tasks.filter(task => Number(task.hourId || 0) === currentHourId)
    : [];
  if (exactHourMatches.length) return pickByStatus(exactHourMatches);

  // 带 hourId 的任务已具备明确归属，不能再通过相似文件名匹配到别的课时。
  const legacyTasks = tasks.filter(task => Number(task.hourId || 0) <= 0);
  const currentPath = normalizeVideoPath(props.currentHourFileUrl || "");
  const tasksWithPath = currentPath
    ? legacyTasks.filter(task => {
        const candidate = normalizeVideoPath(
          String((task as T & { filePath?: string }).filePath || "")
        );
        if (!candidate) return false;
        return (
          candidate === currentPath ||
          candidate.endsWith(`/${currentPath}`) ||
          currentPath.endsWith(`/${candidate}`)
        );
      })
    : [];
  const titleMatches = props.currentHourTitle
    ? legacyTasks.filter(task =>
        isLikelySameLesson(task.fileName || "", props.currentHourTitle || "")
      )
    : legacyTasks;
  const matching = tasksWithPath.length ? tasksWithPath : titleMatches;
  return pickByStatus(matching);
};

const parseArrayValue = (value: unknown): unknown[] => {
  const parsed = parseMaybeJson(value);
  return Array.isArray(parsed) ? parsed : [];
};

const normalizeChapterItems = (value: unknown): ChapterItem[] =>
  parseArrayValue(value)
    .map(item => {
      const source = item as Record<string, unknown>;
      return {
        title: String(source?.title || ""),
        summary: String(source?.summary || ""),
        startTime: Number(source?.startTime ?? source?.start_time ?? 0),
        endTime: Number(source?.endTime ?? source?.end_time ?? 0)
      };
    })
    .filter(item => item.title || item.summary);

const normalizeQaItems = (value: unknown): QaItem[] =>
  parseArrayValue(value)
    .map(item => {
      const source = item as Record<string, unknown>;
      return {
        question: String(source?.question || ""),
        answer: String(source?.answer || "")
      };
    })
    .filter(item => item.question || item.answer);

const normalizePptPages = (value: unknown): PptPage[] =>
  parseArrayValue(value)
    .map(item => {
      const source = item as Record<string, unknown>;
      return {
        pageIndex: Number(source?.pageIndex ?? source?.page_index ?? 0),
        imageUrl: String(source?.imageUrl ?? source?.image_url ?? ""),
        summary: String(source?.summary || ""),
        startTime: Number(source?.startTime ?? source?.start_time ?? 0),
        endTime: Number(source?.endTime ?? source?.end_time ?? 0)
      };
    })
    .filter(item => item.imageUrl || item.summary);

const mergeAnalysisResults = (
  task: VideoAnalyzeTask,
  moduleResult?: VideoAnalyzeModuleResult | null,
  fullResult?: VideoAnalyzeFullResult | null
): VideoAnalyzeModuleResult => {
  const full = (fullResult || {}) as any;
  const summaryText =
    typeof full.summary === "string"
      ? full.summary
      : String(full.summary?.text || "");
  const transcriptionText = String(
    full.transcriptionText || full.transcription?.text || ""
  );
  const chapters = normalizeChapterItems(
    full.chaptersJson || full.chapters || full.chapterList
  );
  const qaItems = normalizeQaItems(full.qaJson || full.qaItems || full.qaList);
  const pptPages = normalizePptPages(full.pptJson || full.pptPages);
  const normalizedMindMap = normalizeMindmapPayload(fullResult);

  const merged: VideoAnalyzeModuleResult = {
    ...(moduleResult || ({} as VideoAnalyzeModuleResult)),
    taskId: moduleResult?.taskId || full.taskId || task.taskId,
    status: moduleResult?.status || full.status || task.status,
    courseId: Number(moduleResult?.courseId || full.courseId || task.courseId),
    chapterId: Number(
      moduleResult?.chapterId || full.chapterId || task.chapterId
    ),
    hourId:
      Number(moduleResult?.hourId || full.hourId || task.hourId || 0) ||
      undefined,
    fileName: moduleResult?.fileName || full.fileName || task.fileName,
    createdAt: moduleResult?.createdAt || full.createdAt || task.createdAt,
    completedAt:
      moduleResult?.completedAt || full.completedAt || task.completedAt,
    schemaVersion: moduleResult?.schemaVersion || "videoAnalysis.v1",
    modules: moduleResult?.modules?.length
      ? moduleResult.modules
      : allTabs.map(tab => tab.key),
    moduleStatus: { ...(moduleResult?.moduleStatus || {}) }
  };

  if (!merged.summary?.text && summaryText) {
    merged.summary = { text: summaryText };
  }
  if (!merged.transcription?.text && transcriptionText) {
    merged.transcription = { text: transcriptionText };
  }
  if (!merged.chapters?.length && chapters.length) merged.chapters = chapters;
  if (!merged.qaItems?.length && qaItems.length) merged.qaItems = qaItems;
  if (!merged.pptPages?.length && pptPages.length) merged.pptPages = pptPages;

  const moduleMindMap = normalizeMindmapPayload(moduleResult);
  const mindMap = moduleMindMap || normalizedMindMap;
  if (mindMap) {
    merged.mindMap = {
      ...merged.mindMap,
      ...mindMap
    };
  }

  return merged;
};

const requestSeq = ref(0);
let requestController: AbortController | null = null;
let taskPollTimer: ReturnType<typeof setTimeout> | null = null;

const clearTaskPollTimer = () => {
  if (!taskPollTimer) return;
  clearTimeout(taskPollTimer);
  taskPollTimer = null;
};

const isStaleRequest = (
  requestId: number,
  requestCourseId: number,
  requestChapterId: number,
  requestHourId: number
) => {
  return (
    requestId !== requestSeq.value ||
    requestCourseId !== props.courseId ||
    requestChapterId !== props.chapterId ||
    requestHourId !== Number(props.currentHourId || 0)
  );
};

const asFrontendTask = (task: VideoAnalysisTask): VideoAnalyzeTask => ({
  taskId: task.taskId,
  status: task.status,
  progress: task.progress,
  message: task.message,
  courseId: Number(task.courseId),
  chapterId: Number(task.chapterId),
  hourId: Number(task.hourId || 0) || undefined,
  filePath: task.filePath,
  fileName: task.fileName,
  createdAt: task.createdAt,
  completedAt: task.completedAt
});

const loadCurrentLessonTask = async (
  courseId: number,
  chapterId: number,
  hourId: number,
  signal: AbortSignal
): Promise<VideoAnalyzeTask | null> => {
  // 管理端列表接口会返回本章全部视频任务；前端据此为当前课时选择唯一 taskId。
  if (hasManageAccess()) {
    try {
      const listRes = await getVideoAnalysisList({ courseId, chapterId });
      if (signal.aborted) return null;
      const matched = pickPreferredLessonTask(listRes.data?.tasks || []);
      if (matched) return asFrontendTask(matched);
    } catch {
      // 管理端列表不可用时继续使用前台任务接口。
    }
  }

  if (signal.aborted) return null;

  const taskRes = await getVideoAnalyzeTask(
    {
      courseId,
      chapterId,
      hourId
    },
    signal
  );
  const task = taskRes.data;
  if (!task) return null;

  const returnedCourseId = Number(task.courseId);
  const returnedChapterId = Number(task.chapterId);
  const returnedHourId = Number(task.hourId || 0);
  if (returnedHourId <= 0) {
    // 旧服务会忽略 hourId 并返回章内任一任务。仅在文件名/路径能确认
    // 属于当前课时时展示，否则按本节无任务处理，避免把别节结果串过来。
    const legacyMatchedTask = pickPreferredLessonTask([task]);
    if (!legacyMatchedTask) {
      emptyMessage.value = "本节视频分析结果暂不可用";
      console.warn(
        "[VideoAnalysisPanel] legacy task response does not match current hour",
        {
          requestedHourId: hourId,
          currentHourTitle: props.currentHourTitle,
          returnedFileName: task.fileName
        }
      );
      return null;
    }
    return legacyMatchedTask;
  }
  if (
    returnedCourseId !== courseId ||
    returnedChapterId !== chapterId ||
    returnedHourId !== hourId
  ) {
    throw new VideoAnalysisScopeError("返回的视频分析任务不属于当前课时");
  }

  return task;
};

const isCancelledRequest = (error: unknown) => {
  const source = error as any;
  return (
    source?.code === "ERR_CANCELED" ||
    source?.name === "CanceledError" ||
    source?.isCancelRequest === true
  );
};

const applyTaskRequestError = (error: unknown) => {
  const source = error as any;
  const status = Number(source?.response?.status || 0);
  const payload = source?.response?.data as
    | { code?: number; msg?: string }
    | undefined;
  const message = String(payload?.msg || "").trim();

  if (error instanceof VideoAnalysisScopeError) {
    taskError.value = {
      message: error.message,
      retryable: false
    };
    return;
  }

  if (status === 404) {
    emptyMessage.value = message || "本节暂无视频分析任务";
    return;
  }

  if (status === 403) {
    taskError.value = {
      message: message || "无权查看该课程的视频分析结果",
      retryable: false
    };
    return;
  }

  if (status === 400 || status === 409) {
    taskError.value = {
      message: message || "当前课时与视频分析任务绑定异常",
      retryable: false
    };
    return;
  }

  taskError.value = {
    message: message || "视频分析加载失败，请稍后重试",
    retryable: true
  };
};

interface FetchAnalysisOptions {
  background?: boolean;
}

const fetchAnalysis = async (options: FetchAnalysisOptions = {}) => {
  clearTaskPollTimer();
  const requestCourseId = props.courseId;
  const requestChapterId = props.chapterId;
  const requestHourId = Number(props.currentHourId || 0);
  const requestId = ++requestSeq.value;
  const background = options.background === true && Boolean(taskData.value);
  requestController?.abort();
  requestController = null;

  loading.value = !background;
  if (!background) {
    taskData.value = null;
    moduleData.value = null;
  }
  taskError.value = null;
  emptyMessage.value = "本节暂无视频分析任务";

  if (requestCourseId <= 0 || requestChapterId <= 0 || requestHourId <= 0) {
    loading.value = false;
    if (props.currentHourTitle && requestHourId <= 0) {
      taskError.value = {
        message: "当前视频课时缺少 hourId，无法查询视频分析",
        retryable: false
      };
    }
    return;
  }

  const controller = new AbortController();
  requestController = controller;

  try {
    const task = await loadCurrentLessonTask(
      requestCourseId,
      requestChapterId,
      requestHourId,
      controller.signal
    );

    if (
      isStaleRequest(
        requestId,
        requestCourseId,
        requestChapterId,
        requestHourId
      )
    ) {
      return;
    }

    if (!task) return;
    taskData.value = task;

    if (String(task.status).toLowerCase() !== "completed" || !task.taskId) {
      if (["processing", "submitted", "pending"].includes(task.status)) {
        taskPollTimer = setTimeout(() => {
          void fetchAnalysis({ background: true });
        }, 8000);
      }
      return;
    }

    const [moduleResult, fullResult] = await Promise.allSettled([
      getVideoAnalyzeModules(
        {
          taskId: task.taskId,
          modules: "summary,chapters,qa,transcription,meeting,mindmap,ppt"
        },
        controller.signal
      ),
      getVideoAnalyzeResult({ taskId: task.taskId }, controller.signal)
    ]);

    if (
      isStaleRequest(
        requestId,
        requestCourseId,
        requestChapterId,
        requestHourId
      )
    ) {
      return;
    }

    const moduleDataResult =
      moduleResult.status === "fulfilled" ? moduleResult.value.data : null;
    const fullDataResult =
      fullResult.status === "fulfilled" ? fullResult.value.data : null;

    if (!moduleDataResult && !fullDataResult) {
      throw (
        (moduleResult.status === "rejected" && moduleResult.reason) ||
        (fullResult.status === "rejected" && fullResult.reason) ||
        new Error("视频分析结果为空")
      );
    }

    moduleData.value = mergeAnalysisResults(
      task,
      moduleDataResult,
      fullDataResult
    );

    await hydrateMindmapTree(
      requestId,
      requestCourseId,
      requestChapterId,
      requestHourId
    );

    if (
      !isStaleRequest(
        requestId,
        requestCourseId,
        requestChapterId,
        requestHourId
      )
    ) {
      await nextTick();
      await buildMindmapFromData();
    }
  } catch (error) {
    if (
      !isStaleRequest(
        requestId,
        requestCourseId,
        requestChapterId,
        requestHourId
      ) &&
      !isCancelledRequest(error)
    ) {
      taskData.value = null;
      moduleData.value = null;
      applyTaskRequestError(error);
      console.warn("[VideoAnalysisPanel] load lesson analysis failed", error);
    }
  } finally {
    if (
      !isStaleRequest(
        requestId,
        requestCourseId,
        requestChapterId,
        requestHourId
      )
    ) {
      loading.value = false;
      if (requestController === controller) requestController = null;
    }
  }
};

watch(
  () => [
    props.courseId,
    props.chapterId,
    props.currentHourId,
    props.currentHourTitle,
    props.currentHourFileUrl
  ],
  () => {
    activeTab.value = "chapters";
    fetchAnalysis();
  },
  { immediate: true }
);

watch(
  () => activeTab.value,
  tab => {
    if (tab === "mindmap" && mindmapFlowNodes.value.length) {
      fitMindmap();
    }
  }
);

watch(mindmapResourceUrl, () => {
  mindmapResourceLoadError.value = false;
});

onBeforeUnmount(() => {
  requestSeq.value += 1;
  clearTaskPollTimer();
  requestController?.abort();
  requestController = null;
});
</script>

<style scoped lang="scss">
$primary: #6366f1;
$primary-light: #818cf8;
$accent: #f43f5e;
$ai-pink: #b94f62;
$ai-pink-light: #e68a99;
$success: #10b981;

$gray-50: #f8fafc;
$gray-100: #f1f5f9;
$gray-200: #e2e8f0;
$gray-300: #cbd5e1;
$gray-400: #94a3b8;
$gray-500: #64748b;
$gray-600: #475569;
$gray-700: #334155;
$gray-800: #1e293b;

$radius-md: 12px;
$radius-lg: 16px;

.video-analysis-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 加载态 */
.panel-loading {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: $gray-400;
  font-size: 14px;

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid $gray-200;
    border-top-color: $primary;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .dark & {
    color: $gray-500;
    .loading-spinner {
      border-color: rgb(255 255 255 / 10%);
      border-top-color: $primary-light;
    }
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 空态 */
.panel-empty {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: $gray-400;
  font-size: 14px;

  .empty-icon {
    opacity: 0.4;
  }

  .dark & {
    color: $gray-500;
  }
}

/* 请求错误态 */
.panel-error {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #dc2626;
  font-size: 14px;
  text-align: center;

  .error-icon {
    opacity: 0.72;
  }

  .retry-button {
    padding: 6px 14px;
    color: #fff;
    font-size: 13px;
    background: $primary;
    border: 0;
    border-radius: 6px;
    cursor: pointer;

    &:hover {
      background: #4f46e5;
    }

    &:focus-visible {
      outline: 2px solid $primary-light;
      outline-offset: 2px;
    }
  }

  .dark & {
    color: #f87171;
  }
}

/* 处理中 */
.panel-processing {
  padding: 20px 0;

  .processing-header {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 16px;
  }

  .status-badge {
    &.processing {
      color: #d97706;
      background: rgb(245 158 11 / 10%);
    }

    .status-dot {
      animation: blink 1.4s ease-in-out infinite;
    }
  }

  .file-name {
    font-size: 13px;
    color: $gray-500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .progress-bar {
    height: 6px;
    background: $gray-100;
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 8px;

    .dark & {
      background: rgb(255 255 255 / 10%);
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, $primary, $primary-light);
      border-radius: 3px;
      transition: width 0.3s ease;
    }
  }

  .processing-msg {
    margin: 0;
    font-size: 13px;
    color: $gray-400;
  }
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.4;
  }
}

/* 结果信息头 */
.result-header {
  padding-bottom: 14px;
  margin-bottom: 4px;
  border-bottom: 1px solid rgb(0 0 0 / 5%);

  .dark & {
    border-bottom-color: rgb(255 255 255 / 5%);
  }
}

.result-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.result-times {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: $gray-400;

  svg {
    flex-shrink: 0;
  }

  .dark & {
    color: $gray-500;
  }
}

.file-name-tag {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: $gray-500;
  font-weight: 500;

  .dark & {
    color: $gray-400;
  }
}

.version-tag {
  padding: 1px 6px;
  font-size: 11px;
  font-family: monospace;
  color: $gray-400;
  background: rgb(0 0 0 / 4%);
  border-radius: 4px;

  .dark & {
    background: rgb(255 255 255 / 6%);
    color: $gray-500;
  }
}

.status-badge {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 20px;

  &.completed {
    color: $success;
    background: rgb(16 185 129 / 10%);
  }

  .status-dot {
    width: 6px;
    height: 6px;
    background: currentColor;
    border-radius: 50%;
  }
}

/* 模块标签 */
.module-tabs {
  display: flex;
  gap: 4px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgb(0 0 0 / 5%);
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }

  .dark & {
    border-bottom-color: rgb(255 255 255 / 5%);
  }

  .tab-btn {
    display: flex;
    gap: 6px;
    align-items: center;
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 500;
    color: $gray-500;
    white-space: nowrap;
    cursor: pointer;
    background: none;
    border: 1px solid transparent;
    border-radius: 20px;
    transition: all 0.2s ease;

    &:hover {
      color: $ai-pink;
      background: rgb(185 79 98 / 6%);
    }

    &.active {
      color: $ai-pink;
      background: rgb(185 79 98 / 10%);
      border-color: rgb(185 79 98 / 20%);
      font-weight: 600;
    }

    .dark & {
      color: $gray-400;

      &:hover {
        color: $ai-pink-light;
        background: rgb(230 138 153 / 12%);
      }

      &.active {
        color: $ai-pink-light;
        background: rgb(230 138 153 / 16%);
        border-color: rgb(230 138 153 / 24%);
      }
    }
  }
}

/* 模块内容 */
.module-content {
  padding-top: 16px;
}

.module-empty {
  padding: 32px 0;
  text-align: center;
  color: $gray-400;
  font-size: 14px;

  .dark & {
    color: $gray-500;
  }
}

/* 摘要 */
.summary-block {
  .section-header {
    margin-bottom: 12px;
  }

  .ai-badge {
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 600;
    color: $ai-pink;
    background: rgb(240 228 227 / 74%);
    border: 1px solid rgb(185 79 98 / 12%);
    border-radius: 20px;
  }

  .summary-text {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    line-height: 1.8;
    color: $gray-600;
    white-space: pre-wrap;

    .dark & {
      color: $gray-300;
    }
  }
}

/* 章节速览 */
.chapter-item {
  display: flex;
  gap: 16px;
  padding: 14px 12px;
  margin: 0 -12px;
  cursor: pointer;
  overflow: hidden;
  border-bottom: 1px solid rgb(0 0 0 / 5%);
  border-radius: 12px;
  transition: background 0.15s;

  &:hover {
    background: rgb(240 228 227 / 16%);
  }

  &:last-child {
    border-bottom: none;
  }

  .dark & {
    border-bottom-color: rgb(255 255 255 / 5%);
  }

  .chapter-time {
    flex: 0 0 148px;
    padding-top: 1px;
  }

  .time-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 112px;
    padding: 3px 8px;
    font-size: 12px;
    font-weight: 600;
    font-family: monospace;
    color: $ai-pink;
    background: rgb(240 228 227 / 76%);
    border: 1px solid rgb(185 79 98 / 10%);
    border-radius: 6px;
    white-space: nowrap;
  }

  .chapter-title {
    margin: 0 0 4px;
    font-size: 14px;
    font-weight: 600;
    color: $gray-700;

    .dark & {
      color: $gray-200;
    }
  }

  .chapter-summary {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    color: $gray-500;

    .dark & {
      color: $gray-400;
    }
  }

  .chapter-duration {
    display: inline-block;
    margin-top: 4px;
    font-size: 11px;
    color: $gray-400;
    background: rgb(0 0 0 / 3%);
    padding: 1px 8px;
    border-radius: 10px;

    .dark & {
      color: $gray-500;
      background: rgb(255 255 255 / 5%);
    }
  }
}

/* 问答回顾 */
.qa-item {
  padding: 14px 0;
  border-bottom: 1px solid rgb(0 0 0 / 5%);

  &:last-child {
    border-bottom: none;
  }

  .dark & {
    border-bottom-color: rgb(255 255 255 / 5%);
  }
}

.qa-question,
.qa-answer {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font-size: 14px;
  line-height: 1.6;
}

.qa-question {
  color: $gray-700;
  margin-bottom: 8px;

  .dark & {
    color: $gray-200;
  }
}

.qa-answer {
  color: $gray-500;

  .dark & {
    color: $gray-400;
  }
}

.qa-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  border-radius: 50%;

  &.q {
    background: $primary;
  }

  &.a {
    background: $success;
  }
}

/* 转写文本 */
.transcription-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.8;
  color: $gray-600;
  white-space: pre-wrap;

  .dark & {
    color: $gray-300;
  }
}

/* 要点提炼 */
.meeting-section {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }
}

.meeting-label {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
  color: $gray-700;

  .dark & {
    color: $gray-200;
  }
}

.keyword-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.keyword-tag {
  padding: 4px 12px;
  font-size: 13px;
  color: $ai-pink;
  background: rgb(240 228 227 / 76%);
  border: 1px solid rgb(185 79 98 / 10%);
  border-radius: 14px;

  .dark & {
    color: $ai-pink-light;
    background: rgb(230 138 153 / 16%);
  }
}

.key-info-list {
  margin: 0;
  padding-left: 20px;

  li {
    padding: 4px 0;
    font-size: 14px;
    line-height: 1.6;
    color: $gray-600;

    .dark & {
      color: $gray-300;
    }
  }
}

/* 思维导图 */
.mindmap-block {
  .mindmap-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: flex-end;
    margin-bottom: 12px;
  }

  .mindmap-tools-group {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .mindmap-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-height: 30px;
    padding: 6px 11px;
    font-size: 12px;
    font-weight: 600;
    color: $gray-500;
    background: #fff;
    border: 1px solid $gray-200;
    border-radius: 8px;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.15s;

    &.icon-only {
      width: 30px;
      padding: 0;
    }

    &:hover {
      color: $ai-pink;
      border-color: rgb(185 79 98 / 34%);
      background: rgb(240 228 227 / 42%);
    }

    &:disabled {
      color: $gray-300;
      cursor: not-allowed;
      background: $gray-50;
      border-color: $gray-200;
    }

    &.mindmap-source {
      margin-left: auto;
    }

    .dark & {
      color: $gray-400;
      background: rgb(255 255 255 / 5%);
      border-color: rgb(255 255 255 / 10%);

      &:hover {
        color: $ai-pink-light;
        border-color: $ai-pink-light;
      }

      &:disabled {
        color: rgb(255 255 255 / 20%);
        background: rgb(255 255 255 / 4%);
        border-color: rgb(255 255 255 / 8%);
      }
    }
  }

  .mindmap-canvas {
    position: relative;
    width: 100%;
    height: 540px;
    overflow: hidden;
    border: 1px solid $gray-200;
    border-radius: 12px;
    background: #f8fafc;

    .dark & {
      border-color: rgb(255 255 255 / 8%);
      background: rgb(15 23 42 / 55%);
    }
  }

  .mindmap-viewer {
    width: 100%;
    height: 100%;
  }

  .mindmap-viewer :deep(.vue-flow__pane),
  .mindmap-viewer :deep(.vue-flow__renderer) {
    background:
      linear-gradient(rgb(148 163 184 / 7%) 1px, transparent 1px),
      linear-gradient(90deg, rgb(148 163 184 / 7%) 1px, transparent 1px),
      #f8fafc;
    background-size: 26px 26px;

    .dark & {
      background:
        linear-gradient(rgb(255 255 255 / 6%) 1px, transparent 1px),
        linear-gradient(90deg, rgb(255 255 255 / 6%) 1px, transparent 1px),
        rgb(15 23 42 / 55%);
      background-size: 26px 26px;
    }
  }

  .mindmap-viewer :deep(.vue-flow__node) {
    background: transparent;
    border: 0;
    box-shadow: none;
  }

  .mindmap-flow-node {
    position: relative;
    box-sizing: border-box;
    padding: 10px 14px;
    font-size: 13px;
    font-weight: 650;
    line-height: 1.45;
    color: #1f2a68;
    white-space: pre-line;
    overflow-wrap: anywhere;
    word-break: break-word;
    background: rgb(255 255 255 / 96%);
    border: 1px solid rgb(148 163 184 / 34%);
    border-radius: 10px;
    box-shadow: 0 10px 24px rgb(15 23 42 / 8%);

    &.depth-0 {
      padding: 11px 16px;
      font-size: 14px;
      font-weight: 750;
      color: #312e81;
      background: #eef2ff;
      border-color: rgb(99 102 241 / 32%);
    }

    &.depth-1 {
      color: #27316f;
      background: #fff;
      border-color: rgb(99 102 241 / 24%);
    }

    &.depth-2,
    &.depth-3,
    &.depth-4 {
      font-size: 12.5px;
      color: #334155;
      background: #fff;
      border-color: rgb(148 163 184 / 28%);
    }

    .dark & {
      color: rgb(226 232 240 / 94%);
      background: rgb(15 23 42 / 92%);
      border-color: rgb(255 255 255 / 13%);
      box-shadow: 0 10px 22px rgb(0 0 0 / 24%);

      &.depth-0 {
        color: #eef2ff;
        background: rgb(49 46 129 / 84%);
        border-color: rgb(129 140 248 / 32%);
      }
    }
  }

  .mindmap-viewer :deep(.vue-flow__handle) {
    width: 1px;
    min-width: 1px;
    height: 1px;
    min-height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  .mindmap-viewer :deep(.vue-flow__edge-path) {
    stroke: rgb(99 102 241 / 38%);
    stroke-width: 2.4;
  }

  .mindmap-viewer :deep(.vue-flow__edge.selected .vue-flow__edge-path) {
    stroke: rgb(99 102 241 / 55%);
  }

  .mindmap-resource-stage {
    width: 100%;
    height: 100%;
    padding: 18px;
  }

  .mindmap-resource-image,
  .mindmap-resource-frame {
    display: block;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #fff;
    border: 1px solid rgb(148 163 184 / 30%);
    border-radius: 14px;
    box-shadow: 0 14px 34px rgb(15 23 42 / 10%);
  }

  .mindmap-resource-image {
    object-fit: contain;
    pointer-events: none;
  }

  .mindmap-resource-frame {
    pointer-events: auto;
  }

  .mindmap-resource-error {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: $gray-500;
    background: #fff;
    border: 1px dashed $gray-300;
    border-radius: 14px;

    a {
      color: $primary;
      font-weight: 600;
      text-decoration: none;
    }

    .dark & {
      color: $gray-400;
      background: rgb(15 23 42 / 82%);
      border-color: rgb(255 255 255 / 16%);
    }
  }
}

/* PPT */
.ppt-item {
  display: flex;
  gap: 14px;
  padding: 12px;
  margin: 0 -12px;
  cursor: pointer;
  overflow: hidden;
  border-bottom: 1px solid rgb(0 0 0 / 5%);
  border-radius: 12px;
  transition: background 0.15s;

  &:hover {
    background: rgb(240 228 227 / 16%);
  }

  &:last-child {
    border-bottom: none;
  }

  .dark & {
    border-bottom-color: rgb(255 255 255 / 5%);
  }

  .ppt-thumb {
    flex-shrink: 0;
    width: 100px;
    height: 60px;
    overflow: hidden;
    border-radius: 8px;
    background: $gray-100;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .dark & {
      background: rgb(255 255 255 / 5%);
    }
  }

  .ppt-info {
    flex: 1;
    min-width: 0;
  }

  .ppt-page {
    font-size: 13px;
    font-weight: 600;
    color: $gray-700;
    margin-right: 8px;

    .dark & {
      color: $gray-200;
    }
  }

  .ppt-time {
    font-size: 12px;
    font-family: monospace;
    color: $primary;
  }

  .ppt-summary {
    margin: 4px 0 0;
    font-size: 13px;
    line-height: 1.5;
    color: $gray-500;

    .dark & {
      color: $gray-400;
    }
  }
}

@media (width <= 767px) {
  .video-analysis-panel {
    min-width: 0;
  }

  .retry-button,
  .module-tabs .tab-btn,
  .mindmap-block .mindmap-action {
    min-height: 44px;
  }

  .result-header {
    min-width: 0;
  }

  .result-meta,
  .result-times {
    gap: 8px;
    align-items: flex-start;
  }

  .file-name-tag {
    max-width: 100%;
  }

  .module-tabs {
    margin-inline: -4px;
    padding-inline: 4px;
    scroll-padding-inline: 4px;
  }

  .chapter-item {
    flex-direction: column;
    gap: 8px;
    padding: 14px 4px;
    margin: 0;

    .chapter-time {
      flex: none;
      width: 100%;
      padding-top: 0;
    }

    .time-badge {
      min-width: 0;
      min-height: 32px;
    }

    .chapter-info {
      min-width: 0;
    }
  }

  .mindmap-block {
    .mindmap-toolbar,
    .mindmap-tools-group {
      align-items: stretch;
    }

    .mindmap-tools-group {
      display: flex;
      flex: 1 1 100%;
      flex-wrap: wrap;
    }

    .mindmap-action {
      flex: 1 1 auto;
      padding-inline: 12px;

      &.icon-only {
        width: 44px;
      }

      &.mindmap-source {
        flex-basis: 100%;
        margin-left: 0;
      }
    }

    .mindmap-canvas {
      height: min(64vh, 480px);
      min-height: 360px;
    }

    .mindmap-resource-stage {
      padding: 8px;
    }
  }
}
</style>
