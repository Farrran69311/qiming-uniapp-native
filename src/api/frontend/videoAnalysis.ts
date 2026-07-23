import { http } from "@/utils/http";
import type { ApiResponse } from "./types";

/** 视频分析任务信息 */
export type VideoAnalyzeTaskStatus =
  | "completed"
  | "processing"
  | "submitted"
  | "pending"
  | "failed"
  | "cancelled"
  | string;

export interface GetVideoAnalyzeTaskParams {
  courseId: number;
  chapterId: number;
  hourId: number;
  /** 仅用于旧数据兼容，正常学生端请求不传。 */
  filePath?: string;
  /** 仅用于旧数据兼容，正常学生端请求不传。 */
  fileName?: string;
}

export interface VideoAnalyzeTask {
  taskId: string;
  status: VideoAnalyzeTaskStatus;
  progress: number;
  message?: string | null;
  courseId: number;
  chapterId: number;
  hourId?: number;
  filePath?: string | null;
  fileName: string;
  createdAt: string;
  completedAt?: string | null;
}

/** 视频分析完整结果 */
export interface VideoAnalyzeFullResult {
  taskId: string;
  status: string;
  courseId: number;
  chapterId: number;
  hourId?: number;
  fileName: string;
  transcriptionText: string;
  summary: string;
  chaptersJson: string;
  qaJson: string;
  mindMapUrl: string;
  pptJson: string;
  createdAt: string;
  completedAt: string;
}

/** 章节速览项 */
export interface ChapterItem {
  title: string;
  summary: string;
  startTime: number;
  endTime: number;
}

/** 问答回顾项 */
export interface QaItem {
  question: string;
  answer: string;
}

/** PPT 页面项 */
export interface PptPage {
  pageIndex: number;
  imageUrl: string;
  summary: string;
  startTime: number;
  endTime: number;
}

/** 按模块查看的视频分析结果 */
export interface VideoAnalyzeModuleResult {
  taskId: string;
  status: string;
  courseId: number;
  chapterId: number;
  hourId?: number;
  fileName: string;
  createdAt: string;
  completedAt?: string | null;
  schemaVersion: string;
  modules: string[];
  moduleStatus: Record<string, string>;
  transcription?: { text: string };
  summary?: { text: string };
  chapters?: ChapterItem[];
  qaItems?: QaItem[];
  mindMap?: any;
  mindMapUrl?: string;
  mindmapUrl?: string;
  mind_map_url?: string;
  pptPages?: PptPage[];
  meeting?: {
    keywords: string[];
    keyInformation: string[];
  };
}

/** 获取当前视频课时对应的分析任务 */
export const getVideoAnalyzeTask = (
  params: GetVideoAnalyzeTaskParams,
  signal?: AbortSignal
) => {
  return http.request<ApiResponse<VideoAnalyzeTask>>(
    "get",
    "/edu/frontend/v1/video/analyze/task",
    { params, signal }
  );
};

/** 学生查看视频分析结果 */
export const getVideoAnalyzeResult = (
  params: { taskId: string },
  signal?: AbortSignal
) => {
  return http.request<ApiResponse<VideoAnalyzeFullResult>>(
    "get",
    "/edu/frontend/v1/video/analyze/result",
    { params, signal }
  );
};

/** 按模块查看视频分析结果 */
export const getVideoAnalyzeModules = (
  params: {
    taskId: string;
    modules?: string;
  },
  signal?: AbortSignal
) => {
  return http.request<ApiResponse<VideoAnalyzeModuleResult>>(
    "get",
    "/edu/frontend/v1/video/analyze/result/modules",
    { params, signal }
  );
};
