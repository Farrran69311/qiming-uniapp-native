import { http } from "@/utils/http";

export interface CourseCreateParams {
  title: string; // 课程标题
  thumb_url: string; // 课程封面地址
  shortDesc: string; // 课程简介
  isRequired: number; // 是否必修，1: 必修，0: 选修
  categoryIds: number[]; // 课程分类ID列表
  isChapter: number; // 是否章节，1: 是，0: 否
  endingTime: string; // 课程结束时间（yyyy-MM-dd hh:mm:ss）
  chapterList?: Array<{
    // 章节列表（可选）
    chapterId?: number; // 章节ID（可选）
    name: string; // 章节标题
    hourList: Array<{
      // 章节课时
      resourceId: number; // 课时资源ID
      duration: number; // 时长（秒）
      title?: string; // 课时标题（可选）
      rType?: string; // 资源类型（可选）
      hourId?: number; // 课时ID（可选）
      fileUrl?: string; // 课时文件地址（可选）
    }>;
  }>;
  hourList?: Array<{
    // 课时列表（可选）
    resourceId: number; // 课时资源ID
    duration: number; // 时长（秒）
    title?: string; // 课时标题（可选）
    rType?: string; // 资源类型（可选）
    hourId?: number; // 课时ID（可选）
    fileUrl?: string; // 课时文件地址（可选）
  }>;
  attrList?: Array<{
    // 附件资源列表（可选）
    resourceId: number; // 附件资源ID
    title?: string; // 附件标题（可选）
    rType?: string; // 附件类型（可选）
    attrId?: number; // 附件ID（可选）
    fileUrl?: string; // 附件地址（可选）
  }>;
}

export interface CourseUpdateParams {
  courseId: number; // 课程ID
  title?: string; // 课程标题（可选）
  thumbUrl?: string; // 课程封面Url（可选）
  shortDesc?: string; // 课程简介（可选）
  isRequired?: number; // 是否必修，1: 必修，0: 选修
  categoryIds?: number[]; // 课程分类ID列表
  endingTime?: string; // 课程结束时间（yyyy-MM-dd hh:mm:ss）（可选）
}

export interface CourseListResult {
  total: number;
  courseList: Array<{
    courseId: number;
    title: string;
    thumbUrl: string;
    shortDesc: string;
    categoryDesc: string;
    isRequired: number;
    userName: string;
    startTime: string;
    endTime: string;
    categoryList: Array<{
      categoryId: number;
      name: string;
    }>;
  }>;
}

export interface CourseHoursListResult {
  hoursList?: Array<{
    chapterId: number;
    name: string;
    hourList: Array<{
      resourceId: number;
      duration: number;
      title: string;
      rType: string;
      hourId: number;
      fileUrl: string;
    }>;
  }>;
  courseChapters: Array<{
    chapterId: number;
    name: string;
    hourList: Array<{
      resourceId: number;
      duration: number;
      title: string;
      rType: string;
      hourId: number;
      fileUrl: string;
    }>;
  }>;
}

export interface CourseAttrListResult {
  courseWares: Array<{
    resourceId: number;
    title: string;
    rType: string;
    attrId: number;
    fileUrl: string;
  }>;
}

export interface AllocationUserResult {
  total: number;
  list: Array<{
    userId: number;
    userName: string;
    avatar: string;
  }>;
}

export interface StudyUserResult {
  total: number;
  list: Array<{
    userId: number;
    userName: string;
    avatar: string;
    totalHours: number;
    finishedHours: number;
    startStudyTime: string;
    finishedStudyTime?: string;
  }>;
}

export interface ApiResponse<T = any> {
  code: number;
  msg: string;
  data: T;
}

export type TeacherPlanStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "timed_out"
  | "unknown";

export type TeacherPlanAvailability =
  | "synced"
  | "stale"
  | "unavailable"
  | "not_found";

export interface TeacherPlanTaskState {
  taskId: string;
  status: TeacherPlanStatus;
  progressPercent: number;
  stage: string;
  message: string;
  errorCode: string;
  retryable: boolean;
  availability: TeacherPlanAvailability;
}

export interface GenerateTeacherPlanResult extends TeacherPlanTaskState {
  teacherPlanId: number;
  requestId: string;
}

export interface TeacherPlan extends TeacherPlanTaskState {
  teacherPlanId: number;
  courseId: number;
  chapterId: number;
  courseName: string;
  chapterName: string;
  downloadUrl: string;
  updatedAt: string;
  createdAt: string;
}

export interface TeacherPlanProgress extends TeacherPlanTaskState {
  /** 旧版兼容枚举：0 不可用、1 非终态、2 完成、3 失败终态。 */
  progress: number;
  requestId: string;
  updatedAt: string;
  downloadUrl: string;
}

export type CourseRebuildOperationStatus =
  | "queued"
  | "running"
  | "converging"
  | "restoring_source"
  | "completed"
  | "failed"
  | "attention_required";

export type CourseRebuildOperationPhase =
  | "admission"
  | "preflight"
  | "evidence_revoke"
  | "replace"
  | "source_restore"
  | "converge"
  | "done";

export type CourseRebuildJobType =
  | "source_cache_invalidate"
  | "source_storage_cleanup"
  | "source_ai_cleanup"
  | "new_course_hour_initialize"
  | "source_evidence_restore";

export interface CourseRebuildFact {
  status: string;
  pending: number;
  failed: number;
}

export interface CourseRebuildOperation {
  operationId: string;
  status: CourseRebuildOperationStatus;
  phase: CourseRebuildOperationPhase;
  sourceCourseId: number;
  newCourseId: number;
  replacement: CourseRebuildFact;
  cleanup: CourseRebuildFact;
  initialization: CourseRebuildFact;
  errorCode: string;
  errorMessage: string;
  retryable: boolean;
}

export interface CourseRebuildErrorResponse {
  status: "error";
  code: string;
  message: string;
  operationId?: string;
}

/**
 * 发起管理员课程重建。接口返回 202 仅表示 operation 已受理，必须继续查询状态。
 */
export const startCourseRebuild = (data: {
  sourceCourseId: number;
  requestId: string;
}) => {
  return http.request<CourseRebuildOperation>(
    "post",
    "/edu/backend/v1/admin/course/rebuilds",
    { data }
  );
};

/** 获取课程重建 operation 的权威进度。 */
export const getCourseRebuild = (operationId: string) => {
  return http.request<CourseRebuildOperation>(
    "get",
    `/edu/backend/v1/admin/course/rebuilds/${encodeURIComponent(operationId)}`
  );
};

/**
 * 只重试管理员选中的失败作业。attention_required 作业必须显式确认后才能提交。
 */
export const retryCourseRebuildJobs = (
  operationId: string,
  data: {
    jobTypes: CourseRebuildJobType[];
    confirmAmbiguous?: boolean;
  }
) => {
  return http.request<CourseRebuildOperation>(
    "post",
    `/edu/backend/v1/admin/course/rebuilds/${encodeURIComponent(operationId)}/jobs/retry`,
    { data }
  );
};

/**
 * 创建课程
 */
export const createCourse = (data: CourseCreateParams) => {
  return http.request<ApiResponse>("post", "/edu/backend/v1/course/create", {
    data
  });
};

/**
 * 更新课程信息
 */
export const updateCourse = (data: CourseUpdateParams) => {
  return http.request<ApiResponse>("post", "/edu/backend/v1/course/update", {
    data
  });
};

/**
 * 获取课程列表
 */
export const getCourseList = (params: {
  pageNum: number;
  pageSize?: number;
  courseName?: string;
}) => {
  return http.request<ApiResponse<CourseListResult>>(
    "get",
    "/edu/backend/v1/course/list",
    { params }
  );
};

/**
 * 获取课时列表
 */
export const getCourseHoursList = (params: { courseId: number }) => {
  return http.request<ApiResponse<CourseHoursListResult>>(
    "get",
    "/edu/backend/v1/course/hours/list",
    { params }
  );
};

/**
 * 获取课程附件列表
 */
export const getCourseAttrList = (params: { courseId: number }) => {
  return http.request<ApiResponse<CourseAttrListResult>>(
    "get",
    "/edu/backend/v1/course/attr/list",
    { params }
  );
};

/**
 * 获取课程详情
 */
export const getCourseDetail = (params: { courseId: number }) => {
  return http.request<ApiResponse>("get", "/edu/backend/v1/course/detail", {
    params
  });
};

/**
 * 课程分配
 * @param data 课程ID和用户ID列表
 */
export const coursesAllocation = (data: {
  courseId: number;
  userIdList: number[];
}) => {
  return http.request<ApiResponse>(
    "post",
    "/edu/backend/v1/course/allocation",
    { data }
  );
};

/**
 * 获取课程可分配的学员列表
 * @param params 查询参数
 */
export const getAllocationUserList = (params: {
  courseId: number;
  userName?: string;
  pageNum: number;
  pageSize?: number;
}) => {
  return http.request<ApiResponse<AllocationUserResult>>(
    "get",
    "/edu/backend/v1/course/allocation/user/list",
    { params }
  );
};

/**
 * 获取课程学员学习情况列表
 * @param params 查询参数
 */
export const getStudyUserList = (params: {
  courseId: number;
  userName?: string;
  pageNum: number;
  pageSize?: number;
}) => {
  return http.request<ApiResponse<StudyUserResult>>(
    "get",
    "/edu/backend/v1/course/study/user/list",
    { params }
  );
};

/**
 * 删除课程
 * @param data 包含课程ID的数据对象
 */
export const deleteCourse = (data: { courseId: number }) => {
  return http.request<ApiResponse>("post", "/edu/backend/v1/course/delete", {
    data
  });
};

export interface BatchDeleteResult {
  total: number;
  successCount: number;
  partialSuccessCount: number;
  failedCount: number;
  notFoundCount: number;
  items: Array<{
    courseId: number;
    status: string;
    message: string;
    deletedCounts: any;
    storageDeletedCount: number;
    storageFailedCount: number;
    aiCleanupStatus: string;
  }>;
}

/**
 * 批量删除课程 (管理员)
 * @param data 包含课程ID列表的数据对象
 */
export const batchDeleteCourse = (data: { courseIds: number[] }) => {
  return http.request<BatchDeleteResult>(
    "post",
    "/edu/backend/v1/admin/course/batch-delete",
    {
      data
    }
  );
};

/**
 * 新增课程的章节及课时
 * @param data 包含课程ID和章节信息的数据对象
 */
export const createCourseChapter = (data: {
  courseId: number;
  chapter: {
    chapterId?: number;
    name: string;
    hourList: Array<{
      resourceId: number;
      duration: number;
      title?: string;
      rType?: string;
      hourId?: number;
      fileUrl?: string;
    }>;
  };
}) => {
  return http.request<ApiResponse>(
    "post",
    "/edu/backend/v1/course/create/chapter",
    { data }
  );
};

/**
 * 删除章节
 * @param data 包含课程ID和章节ID的数据对象
 */
export const deleteChapter = (data: {
  courseId: number;
  chapterId: number;
}) => {
  return http.request<ApiResponse>(
    "post",
    "/edu/backend/v1/course/delete/chapter",
    { data }
  );
};

/**
 * 删除课时
 * @param data 包含课程ID、章节ID和课时ID的数据对象
 */
export const deleteHour = (data: {
  courseId: number;
  chapterId: number;
  hourId: number;
}) => {
  return http.request<ApiResponse>(
    "post",
    "/edu/backend/v1/course/delete/hour",
    { data }
  );
};

/**
 * 生成教案
 * @param data 包含课程ID和章节ID的数据对象
 */
export const generateTeacherPlan = (data: {
  course_id: number;
  chapter_id: number;
}) => {
  return http.request<ApiResponse<GenerateTeacherPlanResult>>(
    "post",
    "/edu/backend/v1/course/generate/teacher/plan",
    { data }
  );
};

/**
 * 课程统计数据结果
 *
 * 统计口径说明：
 * - 日期范围用于过滤学习记录(user_course_records.created_at)
 * - 仅传startDate或endDate时按单日处理，范围为[startDate, endDate+1)
 * - 日期范围最大支持5年，允许未来日期
 */
export interface CourseStatsResult {
  totalCourses: number; // 日期范围内有学习记录的课程数，未传日期则统计教师所有课程
  totalStudents?: number; // 课程关联学生总数
  totalHours: number; // 范围内有学习记录课程的课时总和
  totalHoursUnit?: string;
  activeStudents: number; // 近7天有学习记录的去重学生数（固定，与日期筛选无关）
  completedStudents?: number;
  inProgressStudents?: number;
  avgCompletionRate?: number; // 加权完成率：完成记录数/总学习记录数×100
  completionRate?: number; // 兼容旧响应字段
  lastUpdatedAt?: string;
}

/**
 * 获取课程统计数据
 * @param params 日期范围参数
 * - startDate/endDate 过滤学习记录时间
 * - totalCourses/totalHours/avgCompletionRate 受日期筛选影响
 * - activeStudents 固定为近7天数据，不受日期筛选影响
 */
export const getCourseStats = (params?: {
  startDate?: string; // 开始日期 yyyy-MM-dd
  endDate?: string; // 结束日期 yyyy-MM-dd
}) => {
  return http.request<ApiResponse<CourseStatsResult>>(
    "get",
    "/edu/backend/v1/course/stats/overview",
    { params }
  );
};

/**
 * 获取教案列表
 * @param params 分页参数
 */
export const getTeacherPlanList = (params: {
  pageNum: number;
  pageSize?: number;
  courseId?: number;
}) => {
  return http.request<
    ApiResponse<{
      total: number;
      teacherPlanList: TeacherPlan[];
    }>
  >("get", "/edu/backend/v1/course/teacher/plan/list", { params });
};

/**
 * 查看教案生成进度
 * @param params 包含教案ID的参数对象
 */
export const getTeacherPlanProgress = (
  params: { teacherPlanId: number },
  signal?: AbortSignal
) => {
  return http.request<ApiResponse<TeacherPlanProgress>>(
    "get",
    "/edu/backend/v1/course/teacher/plan/progress",
    { params, signal }
  );
};
