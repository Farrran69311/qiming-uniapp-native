import { http } from "@/utils/http";

export interface VideoAnalyzeParams {
  courseId: number;
  chapterId?: number;
  /** 新任务必须绑定真实课时；仅旧章节级任务允许省略。 */
  hourId?: number;
  filePath: string;
  fileName?: string;
}

export interface VideoAnalyzeResult {
  taskId: string;
  tingwuTaskId: string;
  status: string;
  message: string;
}

export interface VideoAnalysisTask {
  taskId: string;
  tingwuTaskId: string;
  status: string;
  progress: number;
  message: string;
  fileName: string;
  courseId: number;
  chapterId: number;
  hourId?: number;
  filePath?: string;
  createdAt: string;
  completedAt: string;
}

export interface VideoAnalysisListResult {
  total: number;
  tasks: VideoAnalysisTask[];
}

export interface VideoAnalysisStatusResult {
  taskId: string;
  tingwuTaskId: string;
  status: string;
  progress: number;
  message: string;
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
  rawResultUrl: string;
  createdAt: string;
  completedAt: string;
}

export interface ApiResponse<T = any> {
  code: number;
  msg: string;
  data: T;
}

/** 提交视频分析任务 */
export const submitVideoAnalysis = (data: VideoAnalyzeParams) => {
  return http.request<ApiResponse<VideoAnalyzeResult>>(
    "post",
    "/edu/backend/v1/video/analyze",
    { data }
  );
};

/** 查询单个任务状态 */
export const getVideoAnalysisStatus = (params: { taskId: string }) => {
  return http.request<ApiResponse<VideoAnalysisStatusResult>>(
    "get",
    "/edu/backend/v1/video/analyze/status",
    { params }
  );
};

/** 查询课程/章节下的任务列表 */
export const getVideoAnalysisList = (params: {
  courseId: number;
  chapterId?: number;
}) => {
  return http.request<ApiResponse<VideoAnalysisListResult>>(
    "get",
    "/edu/backend/v1/video/analyze/list",
    { params }
  );
};
