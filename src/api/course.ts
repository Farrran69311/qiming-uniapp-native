import { http, resolveApiURL } from "@/utils/http";

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

async function requestWithNativeFetchFallback<T>(
  path: string,
  params: Record<string, unknown> | undefined,
  request: () => Promise<ApiResponse<T>>
) {
  try {
    return await request();
  } catch (error) {
    const isNativePreview =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("qiming-native-webview");
    if (!isNativePreview) throw error;

    const tokenInfo = (() => {
      try {
        return JSON.parse(localStorage.getItem("user-info") || "{}");
      } catch {
        return {};
      }
    })();
    const token = tokenInfo.accessToken || tokenInfo.refreshToken;
    if (!token) throw error;

    const url = resolveApiURL(path, params);
    let lastFetchError: unknown = error;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(url, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`
          }
        });

        if (response.ok) return (await response.json()) as ApiResponse<T>;
        lastFetchError = new Error(`Native fetch failed: ${response.status}`);
      } catch (fetchError) {
        lastFetchError = fetchError;
      }

      await new Promise(resolve => setTimeout(resolve, 260 * (attempt + 1)));
    }

    console.warn("[NativeFetchFallback] course request failed", {
      url,
      error: lastFetchError
    });
    throw error;
  }
}

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
  return requestWithNativeFetchFallback<CourseListResult>(
    "/edu/backend/v1/course/list",
    params,
    () =>
      http.request<ApiResponse<CourseListResult>>(
        "get",
        "/edu/backend/v1/course/list",
        { params }
      )
  );
};

/**
 * 获取课时列表
 */
export const getCourseHoursList = (params: { courseId: number }) => {
  return requestWithNativeFetchFallback<CourseHoursListResult>(
    "/edu/backend/v1/course/hours/list",
    params,
    () =>
      http.request<ApiResponse<CourseHoursListResult>>(
        "get",
        "/edu/backend/v1/course/hours/list",
        { params }
      )
  );
};

/**
 * 获取课程附件列表
 */
export const getCourseAttrList = (params: { courseId: number }) => {
  return requestWithNativeFetchFallback<CourseAttrListResult>(
    "/edu/backend/v1/course/attr/list",
    params,
    () =>
      http.request<ApiResponse<CourseAttrListResult>>(
        "get",
        "/edu/backend/v1/course/attr/list",
        { params }
      )
  );
};

/**
 * 获取课程详情
 */
export const getCourseDetail = (params: { courseId: number }) => {
  return requestWithNativeFetchFallback(
    "/edu/backend/v1/course/detail",
    params,
    () =>
      http.request<ApiResponse>("get", "/edu/backend/v1/course/detail", {
        params
      })
  );
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
  return requestWithNativeFetchFallback<AllocationUserResult>(
    "/edu/backend/v1/course/allocation/user/list",
    params,
    () =>
      http.request<ApiResponse<AllocationUserResult>>(
        "get",
        "/edu/backend/v1/course/allocation/user/list",
        { params }
      )
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
  return requestWithNativeFetchFallback<StudyUserResult>(
    "/edu/backend/v1/course/study/user/list",
    params,
    () =>
      http.request<ApiResponse<StudyUserResult>>(
        "get",
        "/edu/backend/v1/course/study/user/list",
        { params }
      )
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
  return http.request<ApiResponse>(
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
  totalHours: number; // 范围内有学习记录课程的课时总和（单位：分钟）
  activeStudents: number; // 近7天有学习记录的去重学生数（固定，与日期筛选无关）
  completionRate: number; // 加权完成率：完成记录数/总学习记录数×100
}

/**
 * 获取课程统计数据
 * @param params 日期范围参数
 * - startDate/endDate 过滤学习记录时间
 * - totalCourses/totalHours/completionRate 受日期筛选影响
 * - activeStudents 固定为近7天数据，不受日期筛选影响
 */
export const getCourseStats = (params?: {
  startDate?: string; // 开始日期 yyyy-MM-dd
  endDate?: string; // 结束日期 yyyy-MM-dd
}) => {
  return requestWithNativeFetchFallback<CourseStatsResult>(
    "/edu/backend/v1/course/stats/overview",
    params,
    () =>
      http.request<ApiResponse<CourseStatsResult>>(
        "get",
        "/edu/backend/v1/course/stats/overview",
        { params }
      )
  );
};

/**
 * 获取教案列表
 * @param params 分页参数
 */
export const getTeacherPlanList = (params: {
  pageNum: number;
  pageSize?: number;
}) => {
  return requestWithNativeFetchFallback<{
    total: number;
    teacherPlanList: Array<{
      teacherPlanId: number;
      courseId: number;
      chapterId: number;
      courseName: string;
      chapterName: string;
    }>;
  }>("/edu/backend/v1/course/teacher/plan/list", params, () =>
    http.request<
      ApiResponse<{
        total: number;
        teacherPlanList: Array<{
          teacherPlanId: number;
          courseId: number;
          chapterId: number;
          courseName: string;
          chapterName: string;
        }>;
      }>
    >("get", "/edu/backend/v1/course/teacher/plan/list", { params })
  );
};

/**
 * 查看教案生成进度
 * @param params 包含教案ID的参数对象
 */
export const getTeacherPlanProgress = (params: { teacherPlanId: number }) => {
  return requestWithNativeFetchFallback<{
    progress: number;
    downloadUrl?: string;
  }>("/edu/backend/v1/course/teacher/plan/progress", params, () =>
    http.request<
      ApiResponse<{
        progress: number;
        downloadUrl?: string;
      }>
    >("get", "/edu/backend/v1/course/teacher/plan/progress", { params })
  );
};
