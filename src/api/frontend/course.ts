import { http } from "@/utils/http";
import type { ApiResponse } from "./types";

export interface CourseListResult {
  list: Array<{
    courseId: number;
    courseName: string;
    thumbUrl: string;
    isRequired: number;
    totalHours: number;
    finishedHours: number;
  }>;
  total: number;
}

export interface CourseDetailResult {
  courseId: number;
  courseName: string;
  thumbUrl: string;
  isRequired: number;
  totalHours: number;
  finishedHours: number;
  courseDesc: string;
  courseChapterList: Array<{
    chapterId: number;
    name: string;
    hourList: Array<{
      hourId: number;
      duration: number;
      title: string;
      rType: string;
      fileUrl: string;
      finished: number;
    }>;
  }>;
  courseAttrList: Array<{
    resourceId: number;
    title: string;
    rType: string;
    attrId: number;
    fileUrl: string;
  }>;
}

export interface CourseScoreResult {
  courseId: number;
  courseScore: number;
  workScore: number;
  examScore: number;
}

export interface CourseStudyEffectResult {
  courseId: number;
  keyPointNum: number;
  difficultPointNum: number;
  knowledgePointNum: number;
  conceptNum: number;
  chapterList: Array<{
    chapterId: number;
    chapterName: string;
    keyPointArray: Array<{
      title: string;
      content: string;
    }>;
    difficultPointArray: Array<{
      title: string;
      content: string;
    }>;
    knowledgeArray: Array<{
      title: string;
      content: string;
    }>;
    ConceptArray: Array<{
      title: string;
      content: string;
    }>;
  }>;
}

/** 课程成绩详情列表项 */
export interface CourseGradeItem {
  name: string;
  type: string;
  score: number;
  submitTime: string;
  gradedTime: string;
  comment: string;
}

/** 课程成绩详情列表结果 */
export interface CourseGradesListResult {
  list: CourseGradeItem[];
}

/** 课程成绩统计概览结果 */
export interface CourseGradesStatisticsResult {
  totalAssignments: number;
  completedAssignments: number;
  averageScore: number;
  highestScore: number;
  completionRate: number;
}

/** 成绩班级对比数据结果 */
export interface CourseGradesClassComparisonResult {
  categories: string[];
  personalScores: number[];
  classAverages: number[];
}

/**
 * 获取课程列表
 */
export const getCourseList = (params: {
  pageNum: number;
  pageSize?: number;
  queryType?: number;
}) => {
  return http.request<ApiResponse<CourseListResult>>(
    "get",
    "/edu/frontend/v1/course/list",
    { params }
  );
};

/**
 * 获取课程详情
 */
export const getCourseDetail = (params: { courseId: number }) => {
  return http.request<ApiResponse<CourseDetailResult>>(
    "get",
    "/edu/frontend/v1/course/detail",
    { params }
  );
};

/**
 * 课时完成上报
 */
export const reportCourseLesson = (data: {
  courseId: number;
  hourId: number;
}) => {
  return http.request<ApiResponse>(
    "post",
    "/edu/frontend/v1/course/report/lesson",
    { data }
  );
};

/**
 * 获取课程学习效果
 */
export const getCourseStudyEffect = (params: { courseId: number }) => {
  return http.request<ApiResponse<CourseStudyEffectResult>>(
    "get",
    "/edu/frontend/v1/course/study/effect",
    { params }
  );
};

/**
 * 获取课程成绩
 */
export const getCourseScore = (params: { courseId: number }) => {
  return http.request<ApiResponse<CourseScoreResult>>(
    "get",
    "/edu/frontend/v1/course/score",
    { params }
  );
};

/**
 * 获取前台课程列表
 */
export const getFrontendCourseList = (
  params: {
    pageNum: number;
    pageSize?: number;
    queryType?: number;
  },
  options: { timeout?: number } = {}
) => {
  const config = {
    params,
    ...(options.timeout !== undefined ? { timeout: options.timeout } : {})
  };

  return http.request<ApiResponse<CourseListResult>>(
    "get",
    "/edu/frontend/v1/course/list",
    config
  );
};

/**
 * 获取课程成绩详情列表
 *包含每个作业/考试的得分、提交时间、评语等
 */
export const getCourseGradesList = (params: { courseId: number }) => {
  return http.request<ApiResponse<CourseGradesListResult>>(
    "get",
    "/edu/frontend/v1/course/grades/list",
    { params }
  );
};

/**
 * 获取课程成绩统计概览
 * 包含总作业数、完成数、平均分、最高分等指标
 */
export const getCourseGradesStatistics = (params: { courseId: number }) => {
  return http.request<ApiResponse<CourseGradesStatisticsResult>>(
    "get",
    "/edu/frontend/v1/course/grades/statistics",
    { params }
  );
};

/**
 * 获取成绩班级对比数据
 * 用于展示个人得分与班级平均分的对比图表
 */
export const getCourseGradesClassComparison = (params: {
  courseId: number;
}) => {
  return http.request<ApiResponse<CourseGradesClassComparisonResult>>(
    "get",
    "/edu/frontend/v1/course/grades/class-comparison",
    { params }
  );
};
