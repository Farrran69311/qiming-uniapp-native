import { http } from "@/utils/http";

//==================== 类型定义 ====================

/** 试卷状态枚举 */
export enum PaperStatus {
  /** 草稿 - 未发布 */
  DRAFT = 0,
  /** 已发布 - 等待考试 */
  PUBLISHED = 1,
  /** 考试中 */
  IN_PROGRESS = 2,
  /** 考试结束 - 未批改 */
  ENDED = 3,
  /** 批改中 */
  GRADING = 4,
  /** 批改完成 - 未发布成绩 */
  GRADED = 5,
  /** 已发布成绩 */
  SCORE_RELEASED = 6
}

/** 题型枚举 */
export enum QuestionType {
  /** 单选题 */
  SINGLE_CHOICE = 1,
  /** 多选题 */
  MULTIPLE_CHOICE = 2,
  /** 判断题 */
  TRUE_FALSE = 3,
  /** 填空题 */
  FILL_BLANK = 4,
  /** 简答题 */
  SHORT_ANSWER = 5,
  /** 论述题 */
  ESSAY = 6,
  /** 矩阵单选 */
  MATRIX_SINGLE = 7,
  /** 矩阵多选 */
  MATRIX_MULTIPLE = 8,
  /** 连线题 */
  MATCHING = 9,
  /** 排序题 */
  ORDERING = 10,
  /** 滑动评分 */
  SLIDER = 11,
  /** NPS评分 */
  NPS_RATING = 12,
  /** 星级评分 */
  STAR_RATING = 13,
  /** 组合材料题 */
  COMPOSITE = 14
}

/** 题型字符串标识（教师编辑器使用） */
export type QuestionTypeKey =
  | "radio"
  | "checkbox"
  | "judge"
  | "input"
  | "textarea"
  | "textarea-essay"
  | "matrix-single"
  | "matrix-multiple"
  | "matching"
  | "ordering"
  | "slider"
  | "nps-rating"
  | "star-rating"
  | "composite";

/** 兼容型题型（数字/字符串） */
export type QuestionTypeLike = QuestionType | QuestionTypeKey;

/** 用户角色枚举 */
export enum UserRole {
  /** 学生 */
  STUDENT = 1,
  /** 教师 */
  TEACHER = 2,
  /** 管理员 */
  ADMIN = 3
}

/** API响应类型 */
export interface ApiResponse<T = any> {
  code: number;
  msg: string;
  data: T;
}

/** 分页参数 */
export interface PageParams {
  pageNum: number;
  pageSize?: number;
}

/** 分页结果 */
export interface PageResult<T> {
  total: number;
  list: T[];
}

// ==================== 试卷相关类型 ====================

/** 题目选项 */
export interface QuestionOption {
  key: string;
  content: string;
}

/** 矩阵题行/列 */
export interface MatrixItem {
  key: string;
  content: string;
}

/** 连线题配对项 */
export interface MatchingPair {
  left: string;
  right: string;
}

/** 题目数据 */
export interface Question {
  questionId: number;
  questionType: QuestionTypeLike;
  /** 题目标题（简短描述） */
  title: string;
  /** 题干内容 */
  stem: string;
  /** 选项（单选/多选/判断） */
  options?: QuestionOption[];
  /** 矩阵题行 */
  matrixRows?: MatrixItem[];
  /** 矩阵题列 */
  matrixCols?: MatrixItem[];
  /** 连线题配对 */
  matchingPairs?: MatchingPair[];
  /** 排序题选项 */
  orderingItems?: string[];
  /** 滑动评分范围 */
  sliderMin?: number;
  sliderMax?: number;
  sliderStep?: number;
  sliderDefaultValue?: number;
  sliderLabels?: { left?: string; right?: string };
  /** NPS评分范围 */
  npsMin?: number;
  npsMax?: number;
  npsLabels?: {
    min?: string;
    max?: string;
    low?: string;
    mid?: string;
    high?: string;
  };
  /** 星级评分 */
  starCount?: number;
  starLabels?: string[];
  /** 组合材料题 */
  material?: string;
  subQuestions?: Array<{
    subId: number | string;
    questionType: QuestionTypeLike;
    stem: string;
    points: number;
    options?: QuestionOption[];
  }>;
  /** 正确答案（单选/判断/填空） */
  correctAnswer?: string;
  /** 正确答案（多选/矩阵） */
  correctAnswers?: string[];
  /** 参考答案（简答/论述） */
  referenceAnswer?: string;
  /** 答案解析 */
  analysis?: string;
  /** 分值 */
  points: number;
  /** 难度等级(1-5) */
  difficulty?: number;
  /** 知识点标签 */
  knowledgePoints?: string[];
  /** 排序 */
  sortOrder: number;
}

// ==================== 题库相关类型 ====================

/** 题库题目 */
export interface QuestionBankItem {
  id: number;
  type: string;
  typeName: string;
  stem: string;
  options?: QuestionOption[];
  correctAnswer?: string;
  correctAnswers?: string[];
  blanks?: Array<{ answer: string }>;
  referenceAnswer?: string;
  analysis?: string;
  knowledgePoints: string[];
  difficulty: string;
  difficultyName: string;
  points: number;
  createTime: string;
  useCount: number;
}

/** 搜索题库参数 */
export interface SearchQuestionBankParams {
  keyword?: string;
  type?: string;
  difficulty?: string;
  knowledgePoint?: string;
  pageNum?: number;
  pageSize?: number;
}

/** AI 出题参数 */
export interface AIGenerateQuestionParams {
  knowledgePoints: string;
  questionType: string;
  difficulty: string;
  count: number;
  includeAnalysis: boolean;
  polishMode?: boolean;
  originalContent?: string;
  /** 生成模式：generate-生成新题 | recommend-从题库推荐 | polish-润色 */
  mode?: "generate" | "recommend" | "polish";
  /** recommend 模式下排除的题目ID */
  excludeQuestionIds?: number[];
}

/** AI 试卷分析参数 */
export interface AIPaperAnalyzeParams {
  questionGroups: Array<{
    groupName: string;
    questionType: string;
    questions: Array<{
      stem: string;
      points: number;
      difficulty?: number;
      knowledgePoints?: string[];
    }>;
  }>;
}

/** 题型分布项 */
export interface QuestionTypeDistributionItem {
  /** 题型名称 */
  name: string;
  /** 题型标识 */
  type: string;
  /** 题目数量 */
  count: number;
  /** 占比百分比 */
  percentage: number;
}

/** AI 试卷分析结果 */
export interface AIPaperAnalyzeResult {
  /** 整体难度 1-5 */
  difficulty: number;
  /** 难度描述 */
  difficultyDescription: string;
  /** 知识点覆盖率 0-100 */
  knowledgeCoverage: number;
  /** 题型平衡度 0-100 */
  typeBalance: number;
  /** 预估完成时间（分钟） */
  estimatedTime: number;
  /** 整体评分 0-100 */
  overallScore: number;
  /** 题型分布 */
  questionTypeDistribution: QuestionTypeDistributionItem[];
  /** 改进建议 */
  suggestions: string[];
}

/** AI 生成的题目 */
export interface AIGeneratedQuestion {
  id: number;
  type: string;
  stem: string;
  options?: QuestionOption[];
  correctAnswer?: string;
  correctAnswers?: string[];
  blanks?: Array<{ answer: string }>;
  referenceAnswer?: string;
  analysis?: string;
  difficulty: string;
  knowledgePoints: string[];
}

/** 知识点 */
export interface KnowledgePoint {
  id: number;
  name: string;
  parentId?: number;
  questionCount: number;
  children?: KnowledgePoint[];
}

/** 题目分组 */
export interface QuestionGroup {
  groupId: number;
  groupName: string;
  questionType: QuestionTypeLike;
  questions: Question[];
  sortOrder: number;
}

/** 试卷基本信息 */
export interface Paper {
  paperId: number;
  /** 试卷标题 */
  title: string;
  /** 试卷描述 */
  description?: string;
  /** 所属课程ID */
  courseId: number;
  /** 所属课程名称 */
  courseName?: string;
  /** 创建者ID */
  creatorId: number;
  /** 创建者名称 */
  creatorName?: string;
  /** 试卷状态 */
  status: PaperStatus;
  /** 考试时长（分钟） */
  timeLimit: number;
  /** 总分 */
  totalPoints: number;
  /** 总题数 */
  totalQuestions: number;
  /** 开始时间 */
  startTime?: string;
  /** 结束时间 */
  endTime?: string;
  /** 创建时间 */
  createTime: string;
  /** 更新时间 */
  updateTime: string;
  /** 题目分组 */
  questionGroups?: QuestionGroup[];
}

/** 试卷列表项 */
export interface PaperListItem {
  paperId: number;
  title: string;
  courseName: string;
  creatorName: string;
  status: PaperStatus;
  statusText: string;
  timeLimit: number;
  totalPoints: number;
  totalQuestions: number;
  startTime?: string;
  endTime?: string;
  createTime: string;
  /** 参与人数 */
  participantCount: number;
  /** 已提交人数 */
  submittedCount: number;
  /** 已批改人数 */
  gradedCount: number;
}

// ==================== 发布相关类型 ====================

/** 发布目标类型 */
export enum PublishTargetType {
  /** 全部学生 */
  ALL = 1,
  /** 指定班级 */
  CLASS = 2,
  /** 指定学生 */
  STUDENT = 3
}

/** 发布配置 */
export interface PublishConfig {
  /** 发布目标类型 */
  targetType: PublishTargetType;
  /** 目标ID列表（班级ID或学生ID） */
  targetIds?: number[];
  /** 开始时间 */
  startTime: string;
  /** 结束时间 */
  endTime: string;
  /** 是否允许迟交 */
  allowLateSubmit?: boolean;
  /** 迟交截止时间 */
  lateSubmitDeadline?: string;
  /** 是否打乱题目顺序 */
  shuffleQuestions?: boolean;
  /** 是否打乱选项顺序 */
  shuffleOptions?: boolean;
  /** 是否显示答案解析（交卷后） */
  showAnalysis?: boolean;
  /** 是否显示正确答案（交卷后） */
  showCorrectAnswer?: boolean;
}

/** 发布目标学生 */
export interface PublishTargetStudent {
  studentId: number;
  studentName: string;
  studentNo: string;
  className: string;
  selected?: boolean;
}

/** 班级信息 */
export interface ClassInfo {
  classId: number;
  className: string;
  studentCount: number;
}

// ==================== 答卷相关类型 ====================

/** 学生答案 */
export interface StudentAnswer {
  questionId: number;
  answer: StudentAnswerValue;
  /** 得分（批改后） */
  score?: number;
  /** 批改评语 */
  comment?: string;
  /** 是否正确（客观题自动判断） */
  isCorrect?: boolean;
}

/** 学生答卷 */
export interface StudentSubmission {
  submissionId: number;
  paperId: number;
  paperTitle: string;
  studentId: number;
  studentName: string;
  studentNo: string;
  className: string;
  /** 提交状态：0-未提交 1-已提交 2-迟交 */
  submitStatus: number;
  /** 提交时间 */
  submitTime?: string;
  /** 开始答题时间 */
  startTime?: string;
  /** 用时（秒） */
  duration?: number;
  /** 总分 */
  totalScore?: number;
  /** 得分 */
  score?: number;
  /** 批改状态：0-未批改 1-批改中 2-已批改 */
  gradeStatus: number;
  /** 批改人ID */
  graderId?: number;
  /** 批改人名称 */
  graderName?: string;
  /** 批改时间 */
  gradeTime?: string;
  /** 学生答案列表 */
  answers?: StudentAnswer[];
}

/** 批改数据 */
export interface GradeData {
  submissionId: number;
  grades: Array<{
    questionId: number;
    score: number;
    comment?: string;
  }>;
}

// ==================== 统计相关类型 ====================

/** 试卷统计数据 */
export interface PaperStatistics {
  paperId: number;
  paperTitle: string;
  /** 参与人数 */
  participantCount: number;
  /** 已提交人数 */
  submittedCount: number;
  /** 已批改人数 */
  gradedCount: number;
  /** 平均分 */
  averageScore: number;
  /** 最高分 */
  maxScore: number;
  /** 最低分 */
  minScore: number;
  /** 及格率 */
  passRate: number;
  /** 优秀率（>=90分） */
  excellentRate: number;
  /** 分数分布 */
  scoreDistribution: Array<{
    range: string;
    count: number;
    percentage: number;
  }>;
  /** 题目正确率 */
  questionAccuracy: Array<{
    questionId: number;
    questionTitle: string;
    accuracy: number;
  }>;
}

// ==================== API请求参数类型 ====================

/** 获取试卷列表参数 */
export interface GetPaperListParams extends PageParams {
  /** 课程ID */
  courseId?: number;
  /** 试卷状态 */
  status?: PaperStatus;
  /** 关键词搜索 */
  keyword?: string;
  /** 创建者ID（教师查看自己的试卷） */
  creatorId?: number;
}

/** 创建试卷参数 */
export interface CreatePaperParams {
  title: string;
  description?: string;
  courseId: number;
  timeLimit: number;
  questionGroups: Array<{
    groupName: string;
    questionType: QuestionTypeLike;
    questions: Array<Omit<Question, "questionId" | "sortOrder">>;
  }>;
}

/** 更新试卷参数 */
export interface UpdatePaperParams {
  paperId: number;
  title?: string;
  description?: string;
  timeLimit?: number;
  questionGroups?: Array<{
    groupId?: number;
    groupName: string;
    questionType: QuestionTypeLike;
    questions: Array<Omit<Question, "sortOrder"> & { questionId?: number }>;
  }>;
}

/** 发布试卷参数 */
export interface PublishPaperParams {
  paperId: number;
  config: PublishConfig;
}

/** 获取答卷列表参数 */
export interface GetSubmissionListParams extends PageParams {
  paperId: number;
  /** 提交状态 */
  submitStatus?: number;
  /** 批改状态 */
  gradeStatus?: number;
  /** 学生姓名/学号搜索 */
  keyword?: string;
}

/** 获取学生考试列表参数（学生端） */
export interface GetStudentExamListParams extends PageParams {
  /** 课程ID */
  courseId?: number;
  /** 状态：0-待考试 1-进行中 2-已结束 */
  status?: number;
}

// ==================== API接口 ====================

/** 总览统计数据 */
export interface OverviewStatistics {
  /** 试卷总数 */
  totalPapers: number;
  /** 已发布数 */
  publishedCount: number;
  /** 待阅卷数 */
  gradingCount: number;
  /** 平均分 */
  averageScore: number;
}

/** 最近编辑的试卷 */
export interface RecentPaperItem {
  id: number;
  title: string;
  courseName: string;
  updateTime: string;
  status: number;
  questionCount: number;
  totalPoints: number;
}

/** 我的试卷统计数据 */
export interface MyPaperStatistics {
  /** 试卷总数 */
  total: number;
  /** 已发布数 */
  published: number;
  /** 草稿数 */
  draft: number;
  /** 近7天创建数 */
  recent: number;
}

/**
 * 获取我的试卷统计数据
 */
export const getMyPaperStatistics = () => {
  return http.request<ApiResponse<MyPaperStatistics>>(
    "get",
    "/edu/backend/v1/paper/my/statistics"
  );
};

/**
 * 获取总览统计数据
 */
export const getOverviewStatistics = () => {
  return http.request<ApiResponse<OverviewStatistics>>(
    "get",
    "/edu/backend/v1/paper/overview/statistics"
  );
};

/**
 * 获取最近编辑的试卷
 */
export const getRecentPapers = (limit = 5) => {
  return http.request<ApiResponse<RecentPaperItem[]>>(
    "get",
    "/edu/backend/v1/paper/recent",
    { params: { limit } }
  );
};

/**
 * 获取试卷列表（教师/管理员）
 */
export const getPaperList = (params: GetPaperListParams) => {
  return http.request<ApiResponse<PageResult<PaperListItem>>>(
    "get",
    "/edu/backend/v1/paper/list",
    { params }
  );
};

/**
 * 获取试卷详情
 */
export const getPaperDetail = (paperId: number) => {
  return http.request<ApiResponse<Paper>>(
    "get",
    `/edu/backend/v1/paper/detail/${paperId}`
  );
};

/**
 * 创建试卷
 */
export const createPaper = (data: CreatePaperParams) => {
  return http.request<ApiResponse<{ paperId: number }>>(
    "post",
    "/edu/backend/v1/paper/create",
    { data }
  );
};

/**
 * 更新试卷
 */
export const updatePaper = (data: UpdatePaperParams) => {
  return http.request<ApiResponse>("post", "/edu/backend/v1/paper/update", {
    data
  });
};

/**
 * 删除试卷
 */
export const deletePaper = (paperId: number) => {
  return http.request<ApiResponse>("post", "/edu/backend/v1/paper/delete", {
    data: { paperId }
  });
};

/**
 * 发布试卷
 */
export const publishPaper = (data: PublishPaperParams) => {
  return http.request<ApiResponse>("post", "/edu/backend/v1/paper/publish", {
    data
  });
};

/**
 * 撤回发布
 */
export const unpublishPaper = (paperId: number) => {
  return http.request<ApiResponse>("post", "/edu/backend/v1/paper/unpublish", {
    data: { paperId }
  });
};

/**
 * 获取可发布的班级列表
 */
export const getPublishClasses = (courseId: number) => {
  return http.request<ApiResponse<ClassInfo[]>>(
    "get",
    "/edu/backend/v1/paper/publish/classes",
    { params: { courseId } }
  );
};

/**
 * 获取可发布的学生列表
 */
export const getPublishStudents = (params: {
  courseId: number;
  classId?: number;
  keyword?: string;
}) => {
  return http.request<ApiResponse<PublishTargetStudent[]>>(
    "get",
    "/edu/backend/v1/paper/publish/students",
    { params }
  );
};

/** 阅卷统计数据 */
export interface GradingStatistics {
  /** 待阅卷试卷数 */
  pending: number;
  /** 阅卷中试卷数 */
  grading: number;
  /** 已完成试卷数 */
  completed: number;
  /** 总答卷数 */
  total: number;
}

/** 待阅卷试卷列表项 */
export interface GradingPaperItem {
  /** 试卷ID */
  id: number;
  /** 试卷名称 */
  paperTitle: string;
  /** 课程名称 */
  courseName: string;
  /** 答卷数（学生数） */
  studentCount: number;
  /** 已批改数 */
  gradedCount: number;
  /** 待批改数 */
  pendingCount: number;
  /** 状态：pending-待阅卷 grading-阅卷中 completed-已完成 */
  status: "pending" | "grading" | "completed";
  /** 截止时间 */
  deadline: string;
  /** 发布时间 */
  publishTime: string;
}

/** 获取待阅卷试卷列表参数 */
export interface GetGradingPaperListParams extends PageParams {
  /** 关键词搜索 */
  keyword?: string;
  /** 状态筛选 */
  status?: "pending" | "grading" | "completed";
  /** 课程ID */
  courseId?: number;
}

/**
 * 获取阅卷统计数据
 */
export const getGradingStatistics = () => {
  return http.request<ApiResponse<GradingStatistics>>(
    "get",
    "/edu/backend/v1/paper/grading/statistics"
  );
};

/**
 * 获取待阅卷试卷列表（按试卷分组）
 */
export const getGradingPaperList = (params: GetGradingPaperListParams) => {
  return http.request<ApiResponse<PageResult<GradingPaperItem>>>(
    "get",
    "/edu/backend/v1/paper/grading/list",
    { params }
  );
};

/**
 * 获取答卷列表（阅卷用）
 */
export const getSubmissionList = (params: GetSubmissionListParams) => {
  return http.request<ApiResponse<PageResult<StudentSubmission>>>(
    "get",
    "/edu/backend/v1/paper/submission/list",
    { params }
  );
};

/**
 * 获取答卷详情（阅卷用）
 */
export const getSubmissionDetail = (submissionId: number) => {
  return http.request<ApiResponse<StudentSubmission>>(
    "get",
    `/edu/backend/v1/paper/submission/detail/${submissionId}`
  );
};

/**
 * 提交批改
 */
export const submitGrade = (data: GradeData) => {
  return http.request<ApiResponse>(
    "post",
    "/edu/backend/v1/paper/grade/submit",
    { data }
  );
};

/**
 * 批量自动批改（客观题）
 */
export const autoGradeObjective = (paperId: number) => {
  return http.request<ApiResponse<{ gradedCount: number }>>(
    "post",
    "/edu/backend/v1/paper/grade/auto",
    { data: { paperId } }
  );
};

/**
 * 发布成绩
 */
export const releaseScores = (paperId: number) => {
  return http.request<ApiResponse>(
    "post",
    "/edu/backend/v1/paper/score/release",
    { data: { paperId } }
  );
};

/**
 * 获取试卷统计数据
 */
export const getPaperStatistics = (paperId: number) => {
  return http.request<ApiResponse<PaperStatistics>>(
    "get",
    `/edu/backend/v1/paper/statistics/${paperId}`
  );
};

// ==================== 学情分析相关类型 ====================

/** 学情分析总览数据 */
export interface LearningAnalyticsOverview {
  /** 考试总数 */
  totalExams: number;
  /** 参与学生数 */
  totalStudents: number;
  /** 平均分 */
  avgScore: number;
  /** 及格率 */
  passRate: number;
}

/** 成绩分布项 */
export interface ScoreDistributionItem {
  range: string;
  count: number;
  percentage: number;
}

/** 知识点掌握情况 */
export interface KnowledgePointMastery {
  name: string;
  mastery: number;
  questionCount: number;
}

/** 题型统计 */
export interface QuestionTypeStatItem {
  type: string;
  correctRate: number;
  avgTime: number;
}

/** 考试趋势 */
export interface ExamTrendItem {
  date: string;
  avgScore: number;
  passRate: number;
}

/** 学生排名 */
export interface StudentRankingItem {
  rank: number;
  name: string;
  studentId: string;
  score: number;
  trend: "up" | "down" | "same";
}

/** 学情分析完整数据 */
export interface LearningAnalyticsData {
  overview: LearningAnalyticsOverview;
  scoreDistribution: ScoreDistributionItem[];
  knowledgePoints: KnowledgePointMastery[];
  questionTypeStats: QuestionTypeStatItem[];
  examTrends: ExamTrendItem[];
  studentRanking: StudentRankingItem[];
}

/** 获取学情分析参数 */
export interface GetLearningAnalyticsParams {
  courseId?: number;
  startDate?: string;
  endDate?: string;
}

/**
 * 获取学情分析数据
 */
export const getLearningAnalytics = (params?: GetLearningAnalyticsParams) => {
  return http.request<ApiResponse<LearningAnalyticsData>>(
    "get",
    "/edu/backend/v1/paper/learning-analytics",
    { params }
  );
};

/**
 * 获取课程列表（用于筛选）
 */
export const getCourseList = () => {
  return http.request<ApiResponse<Array<{ id: number; name: string }>>>(
    "get",
    "/edu/backend/v1/paper/course/list"
  );
};

// ==================== 题库和题目助手API ====================

/**
 * 搜索题库题目
 */
export const searchQuestionBank = (params: SearchQuestionBankParams) => {
  return http.request<ApiResponse<PageResult<QuestionBankItem>>>(
    "get",
    "/edu/backend/v1/question-bank/search",
    { params }
  );
};

/**
 * AI 生成题目
 */
export const aiGenerateQuestion = (data: AIGenerateQuestionParams) => {
  return http.request<ApiResponse<AIGeneratedQuestion[]>>(
    "post",
    "/edu/backend/v1/ai/generate-question",
    { data }
  );
};

/**
 * 获取知识点列表
 */
export const getKnowledgePoints = () => {
  return http.request<ApiResponse<KnowledgePoint[]>>(
    "get",
    "/edu/backend/v1/knowledge-points"
  );
};

/**
 * AI 分析试卷
 */
export const aiAnalyzePaper = (data: AIPaperAnalyzeParams) => {
  return http.request<ApiResponse<AIPaperAnalyzeResult>>(
    "post",
    "/edu/backend/v1/ai/paper/analyze",
    { data }
  );
};

// ==================== 题库管理API ====================

/** 题库文件夹 */
export interface QuestionFolder {
  id: number;
  name: string;
  parentId?: number;
  questionCount: number;
  createTime: string;
  children?: QuestionFolder[];
}

/** 获取题库列表参数 */
export interface GetQuestionBankListParams extends PageParams {
  keyword?: string;
  type?: string;
  difficulty?: string;
  knowledgePoint?: string;
  folderId?: number;
}

/** 题库题目完整信息 */
export interface QuestionBankFullItem extends QuestionBankItem {
  folderId?: number;
  folderName?: string;
  subject?: string;
  subjectName?: string;
}

/** 题库统计数据 */
export interface QuestionBankStatistics {
  total: number;
  radio: number;
  checkbox: number;
  judge: number;
  input: number;
  textarea: number;
}

/**
 * 获取题库列表
 */
export const getQuestionBankList = (params: GetQuestionBankListParams) => {
  return http.request<ApiResponse<PageResult<QuestionBankFullItem>>>(
    "get",
    "/edu/backend/v1/question-bank/list",
    { params }
  );
};

/**
 * 获取题库统计数据
 */
export const getQuestionBankStatistics = () => {
  return http.request<ApiResponse<QuestionBankStatistics>>(
    "get",
    "/edu/backend/v1/question-bank/statistics"
  );
};

/**
 * 创建题目
 */
export const createQuestion = (data: Partial<QuestionBankFullItem>) => {
  return http.request<ApiResponse<{ id: number }>>(
    "post",
    "/edu/backend/v1/question-bank/create",
    { data }
  );
};

/**
 * 更新题目
 */
export const updateQuestion = (data: Partial<QuestionBankFullItem>) => {
  return http.request<ApiResponse>(
    "post",
    "/edu/backend/v1/question-bank/update",
    { data }
  );
};

/**
 * 删除题目
 */
export const deleteQuestion = (id: number) => {
  return http.request<ApiResponse>(
    "post",
    "/edu/backend/v1/question-bank/delete",
    { data: { id } }
  );
};

/**
 * 批量删除题目
 */
export const batchDeleteQuestions = (ids: number[]) => {
  return http.request<ApiResponse>(
    "post",
    "/edu/backend/v1/question-bank/batch-delete",
    { data: { ids } }
  );
};

/**
 * 导入题目
 */
export const importQuestions = (data: {
  file?: File;
  questions?: Partial<QuestionBankFullItem>[];
  folderId?: number;
}) => {
  return http.request<
    ApiResponse<{ importedCount: number; failedCount: number }>
  >("post", "/edu/backend/v1/question-bank/import", { data });
};

/**
 * 导出题目
 */
export const exportQuestions = (params: {
  ids?: number[];
  folderId?: number;
  format?: "json" | "excel" | "word";
}) => {
  return http.request<ApiResponse<{ downloadUrl: string }>>(
    "get",
    "/edu/backend/v1/question-bank/export",
    { params }
  );
};

/**
 * 获取题库文件夹列表
 */
export const getQuestionFolders = () => {
  return http.request<ApiResponse<QuestionFolder[]>>(
    "get",
    "/edu/backend/v1/question-bank/folders"
  );
};

/**
 * 创建题库文件夹
 */
export const createQuestionFolder = (data: {
  name: string;
  parentId?: number;
}) => {
  return http.request<ApiResponse<{ id: number }>>(
    "post",
    "/edu/backend/v1/question-bank/folders/create",
    { data }
  );
};

/**
 * 更新题库文件夹
 */
export const updateQuestionFolder = (data: { id: number; name: string }) => {
  return http.request<ApiResponse>(
    "post",
    "/edu/backend/v1/question-bank/folders/update",
    { data }
  );
};

/**
 * 删除题库文件夹
 */
export const deleteQuestionFolder = (id: number) => {
  return http.request<ApiResponse>(
    "post",
    "/edu/backend/v1/question-bank/folders/delete",
    { data: { id } }
  );
};

/**
 * 移动题目到文件夹
 */
export const moveQuestionsToFolder = (data: {
  questionIds: number[];
  folderId: number;
}) => {
  return http.request<ApiResponse>(
    "post",
    "/edu/backend/v1/question-bank/move-to-folder",
    { data }
  );
};

/**
 * 归档题目到题库
 */
export const archiveQuestionToBank = (data: {
  questions: Array<Partial<QuestionBankFullItem>>;
}) => {
  return http.request<ApiResponse<{ archivedCount: number }>>(
    "post",
    "/edu/backend/v1/question-bank/archive",
    { data }
  );
};

/**
 * 批量归档题目到题库
 */
export const batchArchiveToBank = (data: {
  questions: Array<Partial<QuestionBankFullItem>>;
}) => {
  return http.request<ApiResponse<{ archivedCount: number }>>(
    "post",
    "/edu/backend/v1/question-bank/batch-archive",
    { data }
  );
};

// ==================== 试卷文件夹管理API ====================

/** 试卷文件夹 */
export interface PaperFolder {
  id: number;
  name: string;
  parentId?: number;
  paperCount: number;
  createTime: string;
  children?: PaperFolder[];
}

/**
 * 获取试卷文件夹列表
 */
export const getPaperFolders = () => {
  return http.request<ApiResponse<PaperFolder[]>>(
    "get",
    "/edu/backend/v1/paper/folders"
  );
};

/**
 * 创建试卷文件夹
 */
export const createPaperFolder = (data: {
  name: string;
  parentId?: number;
}) => {
  return http.request<ApiResponse<{ id: number }>>(
    "post",
    "/edu/backend/v1/paper/folders/create",
    { data }
  );
};

/**
 * 更新试卷文件夹
 */
export const updatePaperFolder = (data: { id: number; name: string }) => {
  return http.request<ApiResponse>(
    "post",
    "/edu/backend/v1/paper/folders/update",
    { data }
  );
};

/**
 * 删除试卷文件夹
 */
export const deletePaperFolder = (id: number) => {
  return http.request<ApiResponse>(
    "post",
    "/edu/backend/v1/paper/folders/delete",
    { data: { id } }
  );
};

/**
 * 移动试卷到文件夹
 */
export const movePapersToFolder = (data: {
  paperIds: number[];
  folderId: number;
}) => {
  return http.request<ApiResponse>(
    "post",
    "/edu/backend/v1/paper/move-to-folder",
    { data }
  );
};

/**
 * 保存为模板
 */
export const saveAsTemplate = (data: {
  name: string;
  description?: string;
  questionGroups: any[];
}) => {
  return http.request<ApiResponse<{ templateId: number }>>(
    "post",
    "/edu/backend/v1/paper/save-as-template",
    { data }
  );
};

/**
 * 获取我的模板列表
 */
export const getMyTemplates = () => {
  return http.request<
    ApiResponse<
      Array<{
        id: number;
        name: string;
        description?: string;
        questionTypes: string[];
        totalQuestions: number;
        totalPoints: number;
        createTime: string;
      }>
    >
  >("get", "/edu/backend/v1/paper/template/my");
};

/**
 * 获取模板详情
 */
export const getTemplateDetail = (templateId: string) => {
  return http.request<ApiResponse<any>>(
    "get",
    `/edu/backend/v1/paper/template/${templateId}`
  );
};

/**
 * 创建空白模板
 */
export const createTemplate = (data: {
  name: string;
  description?: string;
}) => {
  return http.request<ApiResponse<{ templateId: number }>>(
    "post",
    "/edu/backend/v1/paper/template/create",
    { data }
  );
};

/**
 * 删除模板
 */
export const deleteTemplate = (templateId: number) => {
  return http.request<ApiResponse>(
    "post",
    "/edu/backend/v1/paper/template/delete",
    { data: { templateId } }
  );
};

/** 系统模板统计数据 */
export interface SystemTemplateStats {
  /** 模板标识（如 midterm, final, unit-test 等） */
  templateKey: string;
  /** 题目数量 */
  questionCount: number;
  /** 总分值 */
  totalPoints: number;
  /** 使用人数 */
  useCount: number;
}

/** 系统模板预览数据 */
export interface SystemTemplatePreview {
  templateKey: string;
  name: string;
  description: string;
  totalQuestions: number;
  totalPoints: number;
  questionGroups: Array<{
    groupName: string;
    questionType: string;
    count: number;
    pointsPerQuestion: number;
    subtotal: number;
    sampleQuestions: Array<{
      stem: string;
      options?: Array<{ key: string; content: string }>;
    }>;
  }>;
}

/**
 * 获取系统模板预览（题目结构详情）
 */
export const getSystemTemplatePreview = (templateKey: string) => {
  return http.request<ApiResponse<SystemTemplatePreview>>(
    "get",
    "/edu/backend/v1/paper/template/system/preview",
    { params: { templateKey } }
  );
};

/**
 * 获取系统模板统计数据
 * 系统模板的基本信息（名称、描述、图标）在前端定义
 * 此接口仅返回动态统计数据：题数、分值、使用人数
 */
export const getSystemTemplateStats = () => {
  return http.request<ApiResponse<SystemTemplateStats[]>>(
    "get",
    "/edu/backend/v1/paper/template/system/stats"
  );
};

/**
 * 导出答卷（Word/PDF）
 */
export const exportSubmissions = (params: {
  paperId: number;
  submissionIds?: number[];
  format: "word" | "pdf" | "excel";
  includeAnswer?: boolean;
  includeScore?: boolean;
}) => {
  return http.request<ApiResponse<{ downloadUrl: string }>>(
    "get",
    "/edu/backend/v1/paper/submission/export",
    { params }
  );
};

// ==================== 试卷发布高级配置 ====================

/** 试卷高级发布配置 */
export interface AdvancedPublishConfig extends PublishConfig {
  /** 防作弊设置 */
  antiCheat?: {
    /** 是否启用IP限制（同一IP只能答一次） */
    ipRestriction?: boolean;
    /** 是否启用浏览器指纹检测 */
    browserFingerprint?: boolean;
    /** 是否禁止切换窗口 */
    preventWindowSwitch?: boolean;
    /** 切换窗口警告次数上限 */
    maxWindowSwitchWarnings?: number;
  };
  /** 补考设置 */
  retake?: {
    /** 是否允许补考 */
    allowRetake?: boolean;
    /** 最大补考次数 */
    maxRetakeCount?: number;
    /** 补考开始时间 */
    retakeStartTime?: string;
    /** 补考结束时间 */
    retakeEndTime?: string;
    /** 补考是否使用原题 */
    useOriginalQuestions?: boolean;
  };
  /** 成绩设置 */
  scoring?: {
    /** 及格分数线 */
    passScore?: number;
    /** 是否取最高分（多次考试） */
    useHighestScore?: boolean;
  };
}

/**
 * 发布试卷（高级配置）
 */
export const publishPaperAdvanced = (data: {
  paperId: number;
  config: AdvancedPublishConfig;
}) => {
  return http.request<ApiResponse>(
    "post",
    "/edu/backend/v1/paper/publish-advanced",
    { data }
  );
};

// ==================== 学生端API ====================

/** 学生端试卷列表项 */
export interface StudentPaperItem {
  id: number;
  title: string;
  description?: string;
  courseId: number;
  courseName: string;
  timeLimit: number;
  totalPoints: number;
  totalQuestions: number;
  startTime: string;
  endTime: string;
  /** 状态：
   * available - 可答题（已发布/考试中）
   * submitted - 已提交待批改（已结束/批改中）
   * graded - 已批改待发布（已批改但成绩未发布）
   * completed - 已完成（成绩已发布）
   * expired - 已过期（超过截止时间未提交）
   * retake - 补考中（允许补考且在补考时间内）
   */
  status:
    | "available"
    | "submitted"
    | "graded"
    | "completed"
    | "expired"
    | "retake";
  /** 提交ID（已提交时） */
  submissionId?: number | null;
  /** 得分（已完成且成绩发布后） */
  score?: number | null;
  /** 是否允许补考 */
  allowRetake?: boolean;
  /** 剩余补考次数 */
  remainingRetakeCount?: number;
  /** 补考开始时间 */
  retakeStartTime?: string;
  /** 补考结束时间 */
  retakeEndTime?: string;
}

/** 获取学生试卷列表参数 */
export interface GetStudentPaperListParams extends PageParams {
  /** 状态筛选 */
  status?:
    | "available"
    | "submitted"
    | "graded"
    | "completed"
    | "expired"
    | "retake";
  /** 课程ID */
  courseId?: number;
  /** 关键词搜索 */
  keyword?: string;
}

/** 学生试卷统计数据 */
export interface StudentPaperStatistics {
  /** 待完成数量（可答题+补考中） */
  available: number;
  /** 已提交待批改数量 */
  submitted: number;
  /** 已批改待发布数量 */
  graded: number;
  /** 已完成数量（成绩已发布） */
  completed: number;
  /** 已过期数量 */
  expired: number;
  /** 补考中数量 */
  retake: number;
  /** 平均分 */
  avgScore: number;
}

/** 学生端题目（脱敏，不包含标准答案） */
export type StudentExamQuestion = Omit<
  Question,
  "correctAnswer" | "correctAnswers" | "referenceAnswer" | "analysis"
>;

/** 学生端题目分组（脱敏） */
export interface StudentExamQuestionGroup
  extends Omit<QuestionGroup, "questions"> {
  questions: StudentExamQuestion[];
}

/** 学生端试卷详情（脱敏） */
export interface StudentPaperDetail extends Omit<Paper, "questionGroups"> {
  questionGroups?: StudentExamQuestionGroup[];
}

/** 开始考试响应 */
export interface StartExamResult {
  submissionId: number;
  paper: StudentPaperDetail;
  remainingTime: number;
  /** 服务端时间戳（毫秒，用于前后端时钟校准） */
  serverTime?: number;
}

/** 学生答案值 */
export type StudentAnswerValue =
  | string
  | string[]
  | number
  | null
  | Record<string, any>
  | Array<string | number>;

/** 考试会话快照（断线恢复） */
export interface ExamSessionSnapshot {
  submissionId: number;
  remainingTime: number;
  status: "in_progress" | "submitted" | "expired";
  answers: Array<{
    questionId: number;
    answer: StudentAnswerValue;
    duration?: number;
  }>;
}

/**
 * 获取学生试卷列表（试题试卷中心）
 */
export const getStudentPaperList = (params: GetStudentPaperListParams) => {
  return http.request<
    ApiResponse<
      PageResult<StudentPaperItem> & { statistics?: StudentPaperStatistics }
    >
  >("get", "/edu/frontend/v1/paper/list", { params });
};

/**
 * 获取学生试卷详情（脱敏）
 */
export const getStudentPaperDetail = (paperId: number) => {
  return http.request<ApiResponse<StudentPaperDetail>>(
    "get",
    `/edu/frontend/v1/paper/detail/${paperId}`
  );
};

/**
 * 获取学生考试列表
 */
export const getStudentExamList = (params: GetStudentExamListParams) => {
  return http.request<
    ApiResponse<
      PageResult<{
        paperId: number;
        paperTitle: string;
        courseName: string;
        timeLimit: number;
        totalPoints: number;
        startTime: string;
        endTime: string;
        /** 状态：0-待考试 1-进行中 2-已结束 */
        status: number;
        /** 是否已提交 */
        submitted: boolean;
        /** 得分（成绩发布后） */
        score?: number;
      }>
    >
  >("get", "/edu/frontend/v1/exam/list", { params });
};

/**
 * 开始考试
 */
export const startExam = (paperId: number) => {
  return http.request<ApiResponse<StartExamResult>>(
    "post",
    "/edu/frontend/v1/exam/start",
    { data: { paperId } }
  );
};

/**
 * 保存答案（自动保存）
 */
export const saveAnswer = (data: {
  submissionId: number;
  questionId: number;
  answer: StudentAnswerValue;
  duration?: number; // 该题累计答题时长（秒）
}) => {
  return http.request<ApiResponse>("post", "/edu/frontend/v1/exam/save", {
    data
  });
};

/**
 * 批量保存答案（弱网优化）
 */
export const saveAnswersBatch = (data: {
  submissionId: number;
  answers: Array<{
    questionId: number;
    answer: StudentAnswerValue;
  }>;
}) => {
  return http.request<ApiResponse<{ savedCount: number }>>(
    "post",
    "/edu/frontend/v1/exam/save-batch",
    { data }
  );
};

/**
 * 保存答题时长（使用时间戳）
 */
export const saveDuration = (data: {
  submissionId: number;
  questionId: number;
  enterTime: number; // 进入该题的时间戳（毫秒）
  leaveTime: number; // 离开该题的时间戳（毫秒）
}) => {
  return http.request<ApiResponse<{ duration: number }>>(
    "post",
    "/edu/frontend/v1/exam/save-duration",
    { data }
  );
};

/**
 * 获取题目答题时长（用于显示实时用时）
 */
export const getQuestionDuration = (data: {
  submissionId: number;
  questionId: number;
}) => {
  return http.request<ApiResponse<{ duration: number }>>(
    "post",
    "/edu/frontend/v1/exam/question-duration",
    { data }
  );
};

/**
 * 获取考试会话快照（断线恢复）
 */
export const getExamSession = (submissionId: number) => {
  return http.request<ApiResponse<ExamSessionSnapshot>>(
    "get",
    `/edu/frontend/v1/exam/session/${submissionId}`
  );
};

/**
 * 考试心跳（在线状态）
 */
export const examHeartbeat = (data: {
  submissionId: number;
  clientTime: number;
}) => {
  return http.request<ApiResponse<{ serverTime: number }>>(
    "post",
    "/edu/frontend/v1/exam/heartbeat",
    { data }
  );
};

/**
 * 防作弊事件上报
 */
export const reportAntiCheatEvent = (data: {
  submissionId: number;
  eventType: string;
  eventTime: number;
  detail?: string;
}) => {
  return http.request<ApiResponse>(
    "post",
    "/edu/frontend/v1/exam/anti-cheat/event",
    {
      data
    }
  );
};

/**
 * 提交试卷
 */
export const submitExam = (submissionId: number) => {
  return http.request<
    ApiResponse<{
      score?: number;
      showScore: boolean;
    }>
  >("post", "/edu/frontend/v1/exam/submit", { data: { submissionId } });
};

/**
 * 查看考试结果
 */
export const getExamResult = (submissionId: number) => {
  return http.request<ApiResponse<StudentSubmission>>(
    "get",
    `/edu/frontend/v1/exam/result/${submissionId}`
  );
};

// ==================== 工具函数 ====================

/**
 * 获取试卷状态文本
 */
export const getPaperStatusText = (status: PaperStatus): string => {
  const statusMap: Record<PaperStatus, string> = {
    [PaperStatus.DRAFT]: "草稿",
    [PaperStatus.PUBLISHED]: "已发布",
    [PaperStatus.IN_PROGRESS]: "考试中",
    [PaperStatus.ENDED]: "已结束",
    [PaperStatus.GRADING]: "批改中",
    [PaperStatus.GRADED]: "已批改",
    [PaperStatus.SCORE_RELEASED]: "已发布成绩"
  };
  return statusMap[status] || "未知";
};

/**
 * 获取试卷状态标签类型
 */
export const getPaperStatusType = (status: PaperStatus): string => {
  const typeMap: Record<PaperStatus, string> = {
    [PaperStatus.DRAFT]: "info",
    [PaperStatus.PUBLISHED]: "primary",
    [PaperStatus.IN_PROGRESS]: "warning",
    [PaperStatus.ENDED]: "danger",
    [PaperStatus.GRADING]: "warning",
    [PaperStatus.GRADED]: "success",
    [PaperStatus.SCORE_RELEASED]: "success"
  };
  return typeMap[status] || "info";
};

/**
 * 题型归一化（兼容数字/字符串）
 */
export const normalizeQuestionType = (
  type: QuestionTypeLike | string | number | null | undefined
): QuestionType | null => {
  if (type === null || type === undefined) return null;
  if (typeof type === "number") {
    if (type >= 1 && type <= 14) return type as QuestionType;
    return null;
  }
  const map: Record<string, QuestionType> = {
    radio: QuestionType.SINGLE_CHOICE,
    checkbox: QuestionType.MULTIPLE_CHOICE,
    judge: QuestionType.TRUE_FALSE,
    input: QuestionType.FILL_BLANK,
    textarea: QuestionType.SHORT_ANSWER,
    "textarea-essay": QuestionType.ESSAY,
    "matrix-single": QuestionType.MATRIX_SINGLE,
    "matrix-multiple": QuestionType.MATRIX_MULTIPLE,
    matching: QuestionType.MATCHING,
    ordering: QuestionType.ORDERING,
    slider: QuestionType.SLIDER,
    "nps-rating": QuestionType.NPS_RATING,
    "star-rating": QuestionType.STAR_RATING,
    composite: QuestionType.COMPOSITE
  };
  return map[type] ?? null;
};

/**
 * 获取题型名称
 */
export const getQuestionTypeName = (type: QuestionTypeLike): string => {
  const normalized = normalizeQuestionType(type);
  if (!normalized) return "未知题型";
  const typeMap: Record<QuestionType, string> = {
    [QuestionType.SINGLE_CHOICE]: "单选题",
    [QuestionType.MULTIPLE_CHOICE]: "多选题",
    [QuestionType.TRUE_FALSE]: "判断题",
    [QuestionType.FILL_BLANK]: "填空题",
    [QuestionType.SHORT_ANSWER]: "简答题",
    [QuestionType.ESSAY]: "论述题",
    [QuestionType.MATRIX_SINGLE]: "矩阵单选",
    [QuestionType.MATRIX_MULTIPLE]: "矩阵多选",
    [QuestionType.MATCHING]: "连线题",
    [QuestionType.ORDERING]: "排序题",
    [QuestionType.SLIDER]: "滑动评分",
    [QuestionType.NPS_RATING]: "NPS评分",
    [QuestionType.STAR_RATING]: "星级评分",
    [QuestionType.COMPOSITE]: "组合材料题"
  };
  return typeMap[normalized] || "未知题型";
};

/**
 * 判断是否为客观题（可自动批改）
 */
export const isObjectiveQuestion = (type: QuestionTypeLike): boolean => {
  const normalized = normalizeQuestionType(type);
  if (!normalized) return false;
  return [
    QuestionType.SINGLE_CHOICE,
    QuestionType.MULTIPLE_CHOICE,
    QuestionType.TRUE_FALSE,
    QuestionType.FILL_BLANK,
    QuestionType.MATRIX_SINGLE,
    QuestionType.MATRIX_MULTIPLE,
    QuestionType.MATCHING,
    QuestionType.ORDERING
  ].includes(normalized);
};

/**
 * 判断是否为主观题（需人工批改）
 */
export const isSubjectiveQuestion = (type: QuestionTypeLike): boolean => {
  const normalized = normalizeQuestionType(type);
  if (!normalized) return false;
  return [
    QuestionType.SHORT_ANSWER,
    QuestionType.ESSAY,
    QuestionType.COMPOSITE
  ].includes(normalized);
};
