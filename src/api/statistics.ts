import { http, resolveApiURL } from "@/utils/http";

// 接口返回数据类型定义
interface TeacherUsageResult {
  usageInfoList: Array<{
    date: string; // 日期 yyyy-MM-dd
    usageNum: number; // 使用次数
  }>;
}

interface StudentUsageResult {
  usageInfoList: Array<{
    date: string; // 日期 yyyy-MM-dd
    usageNum: number; // 使用次数
  }>;
}

interface WeekUsageResult {
  studentTotalNum: number; // 学生总次数
  teacherTotalNum: number; // 老师总次数
}

interface CourseUsersProgressResult {
  courseUsersProgress: Array<{
    courseId: number; // 课程id
    courseName: string; // 课程名称
    usersProgress: Array<{
      userId: number; // 用户id
      userName: string; // 用户名称
      progress: number; // 进度 后端返回50代表完成50%
    }>;
  }>;
  list?: Array<{
    courseId: number;
    courseName: string;
    usersProgress: Array<{
      userId: number;
      userName: string;
      progress: number;
    }>;
  }>;
}

interface CourseUsersExamInfoResult {
  courseUsersExamInfoList: Array<{
    courseId: number; // 课程id
    courseName: string; // 课程名称
    examId: number; // 考试id
    examName: string; // 考试名称
    examInfo: Array<{
      level: number; // 成绩等级 1:差 2:中等 3:良好 4:优秀
      levelNum: number; // 等级对应的学生人数
      levelUserList: Array<{
        userId: number; // 用户id
        userName: string; // 用户名称
      }>;
    }>;
  }>;
  courseUsersExamInfo?: Array<{
    courseId: number;
    courseName: string;
    examId: number;
    examName: string;
    examInfo: Array<{
      level: number;
      levelNum: number;
      levelUserList: Array<{
        userId: number;
        userName: string;
      }>;
    }>;
  }>;
  list?: Array<{
    courseId: number;
    courseName: string;
    examId: number;
    examName: string;
    examInfo: Array<{
      level: number;
      levelNum: number;
      levelUserList: Array<{
        userId: number;
        userName: string;
      }>;
    }>;
  }>;
}

interface EfficientIndexResult {
  efficientIndexList: Array<{
    courseName: string; // 课程名称
    planTime: number; // 备课耗时(分钟)
    correctPlanTime: number; // 备课修正耗时(分钟)
    planWorkTime: number; // 作业设计耗时(分钟)
    correctPlanWorkTime: number; // 作业设计修正耗时(分钟)
    optimizeDirection?: string; // 优化方向建议
    expectedEffect?: string; // 预期效果
    difficulty?: string; // 执行难度
  }>;
}

export interface PlatformStatsResult {
  stats: Array<{
    title: string;
    value: string | number;
    unit: string;
    trend: number;
    icon: string;
  }>;
}

interface ApiResponse<T = any> {
  code: number;
  msg: string;
  data: T;
  list?: any[];
}

async function requestWithNativeFetchFallback<T>(
  path: string,
  request: () => Promise<ApiResponse<T>>
) {
  try {
    return await request();
  } catch (error) {
    const tokenInfo = (() => {
      try {
        return JSON.parse(localStorage.getItem("user-info") || "{}");
      } catch {
        return {};
      }
    })();
    const token = tokenInfo.accessToken || tokenInfo.refreshToken;
    const isNativePreview =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("qiming-native-webview");

    if (!isNativePreview || !token) throw error;

    const response = await fetch(resolveApiURL(path), {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) throw error;
    return (await response.json()) as ApiResponse<T>;
  }
}

/**
 * 获取最近7天老师使用情况【管理端统计】
 */
export const getTeacherUsage = () => {
  return requestWithNativeFetchFallback(
    "/edu/backend/v1/statistics/teacher/usage",
    () =>
      http.request<ApiResponse<TeacherUsageResult>>(
        "get",
        "/edu/backend/v1/statistics/teacher/usage"
      )
  );
};

/**
 * 获取最近7天学生使用情况【管理端统计】
 */
export const getStudentUsage = () => {
  return requestWithNativeFetchFallback(
    "/edu/backend/v1/statistics/student/usage",
    () =>
      http.request<ApiResponse<StudentUsageResult>>(
        "get",
        "/edu/backend/v1/statistics/student/usage"
      )
  );
};

/**
 * 获取一周内学生、老师的总使用情况【管理端统计】
 */
export const getWeekUsage = () => {
  return requestWithNativeFetchFallback(
    "/edu/backend/v1/statistics/week/usage",
    () =>
      http.request<ApiResponse<WeekUsageResult>>(
        "get",
        "/edu/backend/v1/statistics/week/usage"
      )
  );
};

/**
 * 统计老师课程下学生完成的进度【老师端统计】
 */
export const getCourseUsersProgress = () => {
  return http.request<ApiResponse<CourseUsersProgressResult>>(
    "get",
    "/edu/backend/v1/statistics/course/users/progress"
  );
};

/**
 * 统计老师课程考试学生成绩情况【老师端统计】
 */
export const getCourseUsersExamInfo = () => {
  return http.request<ApiResponse<CourseUsersExamInfoResult>>(
    "get",
    "/edu/backend/v1/statistics/course/users/exam/info"
  );
};

/**
 * 获取教学效率指数数据
 */
export const getEfficientIndex = () => {
  return http.request<ApiResponse<EfficientIndexResult>>(
    "get",
    "/edu/backend/v1/statistics/efficient/index"
  );
};

/**
 * 获取平台概览数据统计（顶部四个卡片）
 */
export const getPlatformStats = () => {
  return http.request<ApiResponse<PlatformStatsResult>>(
    "get",
    "/edu/backend/v1/statistics/platform/overview"
  );
};
