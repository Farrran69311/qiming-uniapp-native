<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useDark } from "@pureadmin/utils";
import { ElMessage } from "element-plus";
import { usePageResponsive } from "@/utils/pageResponsive";
import { Search } from "@element-plus/icons-vue";
import {
  getStudentExamList,
  getStudentPaperList,
  type StudentPaperItem,
  type StudentPaperStatistics
} from "@/api/examPaper";
import WaitingToCompleteIcon from "@/assets/papercentreicons/waitingtocomplete.svg?component";
import AlreadyCompletedIcon from "@/assets/papercentreicons/alreadycompleted.svg?component";
import AlreadyDeadlineIcon from "@/assets/papercentreicons/alreadydeadline.svg?component";
import AverageScoreIcon from "@/assets/papercentreicons/averagescore.svg?component";
import TestPaperCenterIcon from "@/assets/papercentreicons/TestPaperCenter.svg?component";

defineOptions({
  name: "StudentExamCenter"
});

const router = useRouter();
const { isDark } = useDark();
const { isMobile, paginationLayout } = usePageResponsive();

// 筛选条件
const activeTab = ref<
  "available" | "submitted" | "graded" | "completed" | "expired" | "retake"
>("available");
type ExamTabKey = typeof activeTab.value;
const searchQuery = ref("");
const selectedCourse = ref("");
const selectedStatus = ref("");

// 数据
const papers = ref<StudentPaperItem[]>([]);
const loading = ref(false);

// 分页
const currentPage = ref(1);
const pageSize = ref(12);
const total = ref(0);

// 课程选项(从后端获取)
const courseOptions = ref([
  { id: 0, name: "全部课程" },
  { id: 1, name: "高等数学" },
  { id: 2, name: "大学英语" },
  { id: 3, name: "计算机基础" }
]);

// 统计数据
const statistics = ref({
  available: 0,
  submitted: 0,
  graded: 0,
  completed: 0,
  expired: 0,
  retake: 0,
  avgScore: 0
});

const mobileTabOptions = computed(() => [
  {
    key: "available" as ExamTabKey,
    label: "可答题",
    count: statistics.value.available
  },
  {
    key: "submitted" as ExamTabKey,
    label: "待批改",
    count: statistics.value.submitted
  },
  {
    key: "graded" as ExamTabKey,
    label: "待发布",
    count: statistics.value.graded
  },
  {
    key: "completed" as ExamTabKey,
    label: "已完成",
    count: statistics.value.completed
  },
  {
    key: "retake" as ExamTabKey,
    label: "补考中",
    count: statistics.value.retake
  },
  {
    key: "expired" as ExamTabKey,
    label: "已过期",
    count: statistics.value.expired
  }
]);

// 直接使用后端返回的数据，不需要前端再次筛选
const filteredPapers = computed(() => papers.value);

type StudentPaperStatus = StudentPaperItem["status"];

const paperStatuses: StudentPaperStatus[] = [
  "available",
  "submitted",
  "graded",
  "completed",
  "expired",
  "retake"
];

const createEmptyStatistics = (): StudentPaperStatistics => ({
  available: 0,
  submitted: 0,
  graded: 0,
  completed: 0,
  expired: 0,
  retake: 0,
  avgScore: 0
});

const isSuccessResponse = (res: { code?: unknown; success?: unknown }) =>
  res?.code === 0 ||
  res?.code === 200 ||
  res?.code === "0" ||
  res?.code === "200" ||
  res?.success === true;

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readPageList = (data: any) => {
  const list =
    data?.list ?? data?.records ?? data?.rows ?? data?.data?.list ?? [];
  return Array.isArray(list) ? list : [];
};

const readPageTotal = (data: any, fallback: number) =>
  toFiniteNumber(
    data?.total ?? data?.totalCount ?? data?.count ?? data?.pagination?.total,
    fallback
  );

const resolvePaperStatus = (item: any): StudentPaperStatus => {
  const status = item?.status;
  if (
    typeof status === "string" &&
    paperStatuses.includes(status as StudentPaperStatus)
  ) {
    return status as StudentPaperStatus;
  }

  const score = item?.score ?? item?.finalScore ?? item?.studentScore;
  if (item?.allowRetake || toFiniteNumber(item?.remainingRetakeCount) > 0) {
    return "retake";
  }
  if (item?.submitted === true) {
    return score === null || score === undefined ? "submitted" : "completed";
  }

  const numericStatus = Number(status);
  if (numericStatus === 0 || numericStatus === 1) return "available";
  if (numericStatus === 2) return "expired";
  return "available";
};

const normalizeStudentPaper = (item: any): StudentPaperItem => {
  const score = item?.score ?? item?.finalScore ?? item?.studentScore;
  const submissionId = item?.submissionId ?? item?.submitId;

  return {
    id: toFiniteNumber(item?.id ?? item?.paperId ?? item?.examId),
    title: String(item?.title ?? item?.paperTitle ?? item?.examName ?? ""),
    description: item?.description ?? item?.paperDescription ?? item?.remark,
    courseId: toFiniteNumber(item?.courseId),
    courseName: String(item?.courseName ?? item?.course?.name ?? ""),
    timeLimit: toFiniteNumber(
      item?.timeLimit ?? item?.duration ?? item?.limitMinutes
    ),
    totalPoints: toFiniteNumber(
      item?.totalPoints ?? item?.totalScore ?? item?.scoreTotal
    ),
    totalQuestions: toFiniteNumber(
      item?.totalQuestions ?? item?.questionCount ?? item?.questionNum
    ),
    startTime: String(
      item?.startTime ?? item?.availableFrom ?? item?.beginTime ?? ""
    ),
    endTime: String(item?.endTime ?? item?.availableTo ?? item?.deadline ?? ""),
    status: resolvePaperStatus(item),
    submissionId:
      submissionId === null || submissionId === undefined
        ? null
        : toFiniteNumber(submissionId),
    score:
      score === null || score === undefined ? null : toFiniteNumber(score),
    allowRetake: Boolean(item?.allowRetake),
    remainingRetakeCount: toFiniteNumber(item?.remainingRetakeCount),
    retakeStartTime: item?.retakeStartTime,
    retakeEndTime: item?.retakeEndTime
  };
};

const normalizeStatistics = (
  value: Partial<StudentPaperStatistics> | undefined,
  allPapers: StudentPaperItem[]
): StudentPaperStatistics => {
  const computedStatistics = createEmptyStatistics();
  allPapers.forEach(item => {
    computedStatistics[item.status] += 1;
  });

  const scoredPapers = allPapers.filter(item => typeof item.score === "number");
  computedStatistics.avgScore = scoredPapers.length
    ? Math.round(
        scoredPapers.reduce((sum, item) => sum + Number(item.score), 0) /
          scoredPapers.length
      )
    : 0;

  if (!value) return computedStatistics;

  return {
    available: toFiniteNumber(value.available, computedStatistics.available),
    submitted: toFiniteNumber(value.submitted, computedStatistics.submitted),
    graded: toFiniteNumber(value.graded, computedStatistics.graded),
    completed: toFiniteNumber(value.completed, computedStatistics.completed),
    expired: toFiniteNumber(value.expired, computedStatistics.expired),
    retake: toFiniteNumber(value.retake, computedStatistics.retake),
    avgScore: toFiniteNumber(value.avgScore, computedStatistics.avgScore)
  };
};

const applyPaperPayload = (
  data: any,
  options: { clientFilterByTab?: boolean } = {}
) => {
  const allPapers = readPageList(data)
    .map(normalizeStudentPaper)
    .filter(item => item.id > 0);
  const visiblePapers = options.clientFilterByTab
    ? allPapers.filter(item => item.status === activeTab.value)
    : allPapers;

  papers.value = visiblePapers;
  total.value = options.clientFilterByTab
    ? visiblePapers.length
    : readPageTotal(data, visiblePapers.length);
  statistics.value = normalizeStatistics(data?.statistics, allPapers);
};

const buildLegacyExamParams = () => {
  const params: any = {
    pageNum: currentPage.value,
    pageSize: pageSize.value
  };

  if (selectedCourse.value && selectedCourse.value !== "0") {
    params.courseId = Number(selectedCourse.value);
  }

  return params;
};

const fetchPapersFromLegacyApi = async () => {
  try {
    const legacyRes = await getStudentExamList(buildLegacyExamParams());
    if (!isSuccessResponse(legacyRes)) return false;
    applyPaperPayload(legacyRes.data, { clientFilterByTab: true });
    return true;
  } catch (legacyError) {
    console.warn("Student legacy exam list API failed:", legacyError);
    return false;
  }
};

// 获取试卷列表
const fetchPapers = async () => {
  loading.value = true;
  try {
    const params: any = {
      pageNum: currentPage.value,
      pageSize: pageSize.value,
      status: activeTab.value
    };

    // 只有在有值时才添加可选参数
    if (searchQuery.value) {
      params.keyword = searchQuery.value;
    }
    if (selectedCourse.value && selectedCourse.value !== "0") {
      params.courseId = Number(selectedCourse.value);
    }

    console.log("获取试卷列表参数:", params);
    const res = await getStudentPaperList(params);
    console.log("获取试卷列表响应:", res);

    if (isSuccessResponse(res)) {
      applyPaperPayload(res.data);
      return;
    } else if (await fetchPapersFromLegacyApi()) {
      return;
    } else {
      ElMessage.error(res.msg || "获取试卷列表失败");
    }
  } catch (error) {
    console.error("获取试卷列表失败:", error);
    if (await fetchPapersFromLegacyApi()) {
      return;
    }
    ElMessage.error("获取试卷列表失败");
  } finally {
    loading.value = false;
  }
};

// 开始考试
const startExam = (paper: StudentPaperItem) => {
  if (paper.status !== "available" && paper.status !== "retake") {
    ElMessage.warning("该试卷当前不可答题");
    return;
  }
  router.push(`/student-exam-center/do/${paper.id}`);
};

// 查看详情
const viewDetail = (paper: StudentPaperItem) => {
  router.push(`/student-exam-center/detail/${paper.id}`);
};

// 查看成绩
const viewScore = (paper: StudentPaperItem) => {
  if (paper.status !== "completed") {
    ElMessage.warning("该试卷尚未完成");
    return;
  }
  router.push(`/exam-paper/result/${paper.submissionId}`);
};

// 获取状态标签类型
const getStatusType = (
  status: string
): "success" | "warning" | "danger" | "info" => {
  switch (status) {
    case "available":
      return "success";
    case "submitted":
      return "warning";
    case "graded":
      return "info";
    case "completed":
      return "success";
    case "expired":
      return "danger";
    case "retake":
      return "warning";
    default:
      return "info";
  }
};

// 获取状态文本
const getStatusText = (status: string): string => {
  switch (status) {
    case "available":
      return "可答题";
    case "submitted":
      return "待批改";
    case "graded":
      return "待发布";
    case "completed":
      return "已完成";
    case "expired":
      return "已过期";
    case "retake":
      return "补考中";
    default:
      return "未知";
  }
};

// 格式化时间
const formatTime = (time: string): string => {
  if (!time) return "-";
  const date = new Date(time);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

// 计算剩余时间
const getRemainingTime = (endTime: string): string => {
  if (!endTime) return "-";
  const now = new Date().getTime();
  const end = new Date(endTime).getTime();
  const diff = end - now;

  if (diff <= 0) return "已截止";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `剩余${days}天`;
  if (hours > 0) return `剩余${hours}小时`;
  return "即将截止";
};

// 切换标签页
const handleTabChange = () => {
  currentPage.value = 1;
  fetchPapers();
};

// 搜索
const handleSearch = () => {
  currentPage.value = 1;
  fetchPapers();
};

// 分页变化
const handlePageChange = () => {
  fetchPapers();
};

onMounted(() => {
  fetchPapers();
});
</script>

<template>
  <div class="student-exam-center" :class="{ 'is-dark': isDark }">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <TestPaperCenterIcon class="custom-icon" />
          </div>
          <div class="header-info">
            <h1 class="page-title">试题试卷中心</h1>
            <p class="page-desc">查看和完成老师发布的试卷</p>
          </div>
        </div>
        <div class="header-stats">
          <div class="stat-item">
            <span class="stat-value">{{ statistics.available }}</span>
            <span class="stat-label">待完成</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ statistics.completed }}</span>
            <span class="stat-label">已完成</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ statistics.avgScore }}</span>
            <span class="stat-label">平均分</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-section">
      <div class="stat-card available">
        <div class="stat-icon">
          <WaitingToCompleteIcon class="custom-icon" />
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ statistics.available }}</div>
          <div class="stat-label">待完成</div>
        </div>
      </div>
      <div class="stat-card completed">
        <div class="stat-icon">
          <AlreadyCompletedIcon class="custom-icon" />
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ statistics.completed }}</div>
          <div class="stat-label">已完成</div>
        </div>
      </div>
      <div class="stat-card expired">
        <div class="stat-icon">
          <AlreadyDeadlineIcon class="custom-icon" />
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ statistics.expired }}</div>
          <div class="stat-label">已过期</div>
        </div>
      </div>
      <div class="stat-card score">
        <div class="stat-icon">
          <AverageScoreIcon class="custom-icon" />
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ statistics.avgScore }}</div>
          <div class="stat-label">平均分</div>
        </div>
      </div>
    </div>

    <!-- 筛选工具栏 -->
    <div class="filter-toolbar">
      <div class="toolbar-left">
        <div v-if="isMobile" class="mobile-tab-strip">
          <button
            v-for="tab in mobileTabOptions"
            :key="tab.key"
            type="button"
            class="mobile-tab-button"
            :class="{ 'is-active': activeTab === tab.key }"
            @click="
              activeTab = tab.key;
              handleTabChange();
            "
          >
            <span class="mobile-tab-text">{{ tab.label }}</span>
            <span v-if="tab.count > 0" class="mobile-tab-count">
              {{ tab.count }}
            </span>
          </button>
        </div>
        <el-tabs v-else v-model="activeTab" @tab-change="handleTabChange">
          <el-tab-pane label="可答题" name="available">
            <template #label>
              <span class="tab-label">
                <el-icon><DocumentChecked /></el-icon>
                可答题
                <el-badge
                  v-if="statistics.available > 0"
                  :value="statistics.available"
                  class="tab-badge"
                />
              </span>
            </template>
          </el-tab-pane>
          <el-tab-pane label="待批改" name="submitted">
            <template #label>
              <span class="tab-label">
                <el-icon><Loading /></el-icon>
                待批改
                <el-badge
                  v-if="statistics.submitted > 0"
                  :value="statistics.submitted"
                  class="tab-badge"
                />
              </span>
            </template>
          </el-tab-pane>
          <el-tab-pane label="待发布" name="graded">
            <template #label>
              <span class="tab-label">
                <el-icon><Check /></el-icon>
                待发布
                <el-badge
                  v-if="statistics.graded > 0"
                  :value="statistics.graded"
                  class="tab-badge"
                />
              </span>
            </template>
          </el-tab-pane>
          <el-tab-pane label="已完成" name="completed">
            <template #label>
              <span class="tab-label">
                <el-icon><CircleCheck /></el-icon>
                已完成
              </span>
            </template>
          </el-tab-pane>
          <el-tab-pane label="补考中" name="retake">
            <template #label>
              <span class="tab-label">
                <el-icon><RefreshRight /></el-icon>
                补考中
                <el-badge
                  v-if="statistics.retake > 0"
                  :value="statistics.retake"
                  class="tab-badge"
                />
              </span>
            </template>
          </el-tab-pane>
          <el-tab-pane label="已过期" name="expired">
            <template #label>
              <span class="tab-label">
                <el-icon><Clock /></el-icon>
                已过期
              </span>
            </template>
          </el-tab-pane>
        </el-tabs>
      </div>
      <div class="toolbar-right">
        <el-input
          v-model="searchQuery"
          placeholder="搜索试卷..."
          :prefix-icon="isMobile ? undefined : Search"
          clearable
          style="width: 240px"
          @change="handleSearch"
          @clear="handleSearch"
        />
        <el-select
          v-model="selectedCourse"
          placeholder="选择课程"
          style="width: 160px"
          @change="handleSearch"
        >
          <el-option
            v-for="course in courseOptions"
            :key="course.id"
            :label="course.name"
            :value="String(course.id)"
          />
        </el-select>
      </div>
    </div>

    <!-- 试卷列表 -->
    <div v-loading="loading" class="papers-grid">
      <div
        v-for="paper in filteredPapers"
        :key="paper.id"
        class="paper-card"
        :class="paper.status"
      >
        <!-- 卡片头部 -->
        <div class="card-header">
          <div class="header-left">
            <el-tag :type="getStatusType(paper.status)" size="small">
              {{ getStatusText(paper.status) }}
            </el-tag>
            <span v-if="paper.courseName" class="course-tag">
              {{ paper.courseName }}
            </span>
          </div>
          <div v-if="paper.status === 'available'" class="remaining-time">
            <el-icon><Clock /></el-icon>
            <span>{{ getRemainingTime(paper.endTime) }}</span>
          </div>
        </div>

        <!-- 卡片内容 -->
        <div class="card-body">
          <h3 class="paper-title" @click="viewDetail(paper)">
            {{ paper.title }}
          </h3>
          <p v-if="paper.description" class="paper-desc">
            {{ paper.description }}
          </p>

          <div class="paper-meta">
            <div class="meta-item">
              <el-icon><Document /></el-icon>
              <span>{{ paper.totalQuestions }} 题</span>
            </div>
            <div class="meta-item">
              <el-icon><Star /></el-icon>
              <span>{{ paper.totalPoints }} 分</span>
            </div>
            <div class="meta-item">
              <el-icon><Timer /></el-icon>
              <span>{{ paper.timeLimit }} 分钟</span>
            </div>
          </div>

          <div class="paper-time">
            <div class="time-item">
              <span class="time-label">开始时间:</span>
              <span class="time-value">{{ formatTime(paper.startTime) }}</span>
            </div>
            <div class="time-item">
              <span class="time-label">截止时间:</span>
              <span class="time-value">{{ formatTime(paper.endTime) }}</span>
            </div>
          </div>

          <!-- 已完成显示成绩 -->
          <div
            v-if="paper.status === 'completed' && paper.score !== null"
            class="score-display"
          >
            <div class="score-label">得分</div>
            <div class="score-value">{{ paper.score }}</div>
          </div>
        </div>

        <!-- 卡片底部操作 -->
        <div class="card-footer">
          <el-button
            v-if="paper.status === 'available' || paper.status === 'retake'"
            type="primary"
            size="large"
            class="action-btn"
            @click="startExam(paper)"
          >
            <el-icon><Edit /></el-icon>
            {{ paper.status === "retake" ? "开始补考" : "开始答题" }}
          </el-button>
          <el-button
            v-else-if="paper.status === 'submitted'"
            size="large"
            class="action-btn"
            disabled
          >
            <el-icon><Loading /></el-icon>
            批改中
          </el-button>
          <el-button
            v-else-if="paper.status === 'graded'"
            size="large"
            class="action-btn"
            disabled
          >
            <el-icon><Check /></el-icon>
            待发布成绩
          </el-button>
          <el-button
            v-else-if="paper.status === 'completed'"
            type="primary"
            size="large"
            class="action-btn"
            @click="viewScore(paper)"
          >
            <el-icon><View /></el-icon>
            查看成绩
          </el-button>
          <el-button v-else size="large" class="action-btn" disabled>
            <el-icon><Lock /></el-icon>
            已过期
          </el-button>
          <el-button link type="primary" @click="viewDetail(paper)">
            查看详情
          </el-button>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="!loading && filteredPapers.length === 0" class="empty-state">
        <el-empty
          :description="
            activeTab === 'available'
              ? '暂无可答题的试卷'
              : activeTab === 'submitted'
                ? '暂无待批改的试卷'
                : activeTab === 'graded'
                  ? '暂无待发布的试卷'
                  : activeTab === 'completed'
                    ? '暂无已完成的试卷'
                    : activeTab === 'retake'
                      ? '暂无补考中的试卷'
                      : '暂无已过期的试卷'
          "
          :image-size="120"
        />
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="total > pageSize" class="pagination-wrapper">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[12, 24, 36, 48]"
        :total="total"
        :layout="paginationLayout"
        :small="isMobile"
        background
        @size-change="handlePageChange"
        @current-change="handlePageChange"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
$primary-color: #739cf9;
$success-color: #739cf9;
$warning-color: #f59e0b;
$danger-color: #ef4444;
$info-color: #6b7280;

.student-exam-center {
  min-height: 100%;
  padding: 0 24px 24px;
  background: linear-gradient(135deg, #f5f7fa 0%, #f0f2f5 100%);

  &.is-dark {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);

    .page-header {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      box-shadow: 0 8px 32px rgb(0 0 0 / 40%);

      .page-title {
        color: #f1f5f9;
      }

      .page-desc {
        color: #94a3b8;
      }

      .header-icon {
        background: rgba(255, 255, 255, 0.1);
        color: #f1f5f9;

        .custom-icon {
          color: #f1f5f9;
        }
      }

      .header-stats .stat-item {
        .stat-value {
          color: #f1f5f9;
        }

        .stat-label {
          color: #94a3b8;
        }
      }
    }

    .stat-card,
    .filter-toolbar,
    .paper-card {
      background: rgba(30, 41, 59, 0.8);
      border-color: rgba(255, 255, 255, 0.1);
    }

    .stat-value,
    .paper-title {
      color: #f1f5f9;
    }

    .stat-label,
    .paper-desc {
      color: #94a3b8;
    }
  }

  .page-header {
    padding: 24px;
    margin-bottom: 24px;
    background: linear-gradient(135deg, #97b4f7 0%, #7c9cf5 60%, #a8c0ff 100%);
    border-radius: 16px;
    box-shadow: 0 8px 32px rgb(151 180 247 / 25%);

    .header-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
      min-width: 0;
    }

    .header-icon {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.25);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      color: #1a2a4a;

      .custom-icon {
        width: 32px;
        height: 32px;
        color: inherit;
      }
    }

    .page-title {
      font-size: 24px;
      font-weight: 700;
      margin: 0 0 4px;
      color: #1a2a4a;
      line-height: 1.2;
    }

    .page-desc {
      font-size: 14px;
      color: #2a3f5f;
      margin: 0;
      line-height: 1.7;
    }

    .header-stats {
      display: flex;
      flex-shrink: 0;
      gap: 32px;

      .stat-item {
        text-align: center;

        .stat-value {
          display: block;
          font-size: 28px;
          font-weight: 700;
          color: #1a2a4a;
        }

        .stat-label {
          font-size: 12px;
          color: #2a3f5f;
        }
      }
    }
  }

  .stats-section {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    margin-bottom: 24px;
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 4px 20px rgb(0 0 0 / 8%);
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 30px rgb(0 0 0 / 12%);
    }

    .stat-info {
      min-width: 0;
    }

    .stat-icon {
      width: 48px;
      height: 48px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      color: #fff;

      .custom-icon {
        width: 28px;
        height: 28px;
        color: inherit;
      }
    }

    &.available .stat-icon {
      background: linear-gradient(135deg, $success-color 0%, #80c8fa 100%);
    }

    &.completed .stat-icon {
      background: linear-gradient(135deg, $primary-color 0%, #4a7fc8 100%);
    }

    &.expired .stat-icon {
      background: linear-gradient(135deg, $danger-color 0%, #f87171 100%);
    }

    &.score .stat-icon {
      background: linear-gradient(135deg, $warning-color 0%, #fbbf24 100%);
    }

    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: #1f2937;
    }

    .stat-label {
      font-size: 14px;
      color: #6b7280;
    }
  }

  .filter-toolbar {
    background: #fff;
    border-radius: 16px;
    padding: 16px 24px;
    box-shadow: 0 4px 20px rgb(0 0 0 / 8%);
    margin-bottom: 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;

    .toolbar-left {
      flex: 1;
      min-width: 0;

      .mobile-tab-strip {
        display: flex;
        gap: 10px;
        overflow-x: auto;
        overflow-y: hidden;
        padding-bottom: 4px;
        scrollbar-width: none;
        -webkit-overflow-scrolling: touch;

        &::-webkit-scrollbar {
          display: none;
        }

        .mobile-tab-button {
          display: inline-flex;
          flex: 0 0 auto;
          gap: 8px;
          align-items: center;
          justify-content: center;
          min-height: 42px;
          padding: 0 16px;
          font-size: 14px;
          font-weight: 600;
          color: #475569;
          white-space: nowrap;
          cursor: pointer;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          box-shadow: none;
          transition:
            color 0.2s ease,
            background-color 0.2s ease,
            border-color 0.2s ease;

          &.is-active {
            color: #fff;
            background: linear-gradient(135deg, #739cf9 0%, #5b87f5 100%);
            border-color: transparent;
          }

          .mobile-tab-count {
            min-width: 20px;
            height: 20px;
            padding: 0 6px;
            font-size: 12px;
            line-height: 20px;
            color: inherit;
            background: rgb(255 255 255 / 22%);
            border-radius: 999px;
          }
        }
      }

      :deep(.el-tabs) {
        .el-tabs__header {
          margin: 0;
        }

        .el-tabs__nav-wrap {
          overflow: auto;
        }

        .el-tabs__nav-wrap::after {
          display: none;
        }

        .tab-label {
          display: flex;
          align-items: center;
          gap: 6px;

          .tab-badge {
            margin-left: 4px;
          }
        }
      }
    }

    .toolbar-right {
      display: flex;
      flex-shrink: 0;
      flex-wrap: wrap;
      gap: 12px;

      :deep(.el-input),
      :deep(.el-select) {
        min-width: 0;
      }
    }
  }

  .papers-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 20px;
    margin-bottom: 24px;
  }

  .paper-card {
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 4px 20px rgb(0 0 0 / 8%);
    overflow: hidden;
    transition: all 0.3s ease;
    border: 2px solid transparent;

    &:hover {
      transform: translateY(-8px);
      box-shadow: 0 12px 40px rgb(0 0 0 / 15%);
    }

    &.available {
      border-color: rgba($success-color, 0.2);

      &:hover {
        border-color: $success-color;
      }
    }

    &.completed {
      border-color: rgba($primary-color, 0.2);

      &:hover {
        border-color: $primary-color;
      }
    }

    &.expired {
      opacity: 0.7;
      border-color: rgba($danger-color, 0.2);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      background: linear-gradient(135deg, #f9fafb 0%, #f5f7fa 100%);
      border-bottom: 1px solid #e5e7eb;

      .header-left {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        min-width: 0;

        .course-tag {
          font-size: 12px;
          color: #6b7280;
          padding: 2px 8px;
          background: rgba(115, 156, 249, 0.1);
          border-radius: 4px;
        }
      }

      .remaining-time {
        display: flex;
        flex-shrink: 0;
        align-items: center;
        gap: 4px;
        font-size: 13px;
        color: $warning-color;
        font-weight: 500;
      }
    }

    .card-body {
      padding: 20px;

      .paper-title {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 8px;
        color: #1f2937;
        cursor: pointer;
        transition: color 0.2s;
        line-height: 1.45;

        &:hover {
          color: $primary-color;
        }
      }

      .paper-desc {
        font-size: 14px;
        color: #6b7280;
        margin: 0 0 16px;
        line-height: 1.5;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .paper-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        margin-bottom: 16px;

        .meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          color: #6b7280;

          .el-icon {
            color: $primary-color;
          }
        }
      }

      .paper-time {
        padding: 12px;
        background: #f9fafb;
        border-radius: 8px;
        margin-bottom: 16px;

        .time-item {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-size: 13px;
          margin-bottom: 4px;

          &:last-child {
            margin-bottom: 0;
          }

          .time-label {
            color: #6b7280;
          }

          .time-value {
            color: #1f2937;
            font-weight: 500;
            text-align: right;
          }
        }
      }

      .score-display {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 16px;
        background: linear-gradient(
          135deg,
          rgba($primary-color, 0.1) 0%,
          rgba($primary-color, 0.05) 100%
        );
        border-radius: 8px;
        margin-top: 16px;

        .score-label {
          font-size: 14px;
          color: #6b7280;
        }

        .score-value {
          font-size: 32px;
          font-weight: 700;
          color: $primary-color;
        }
      }
    }

    .card-footer {
      padding: 16px 20px;
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;

      .action-btn {
        flex: 1;
        font-weight: 500;
      }

      :deep(.el-button) {
        box-shadow: none !important;
      }
    }
  }

  .empty-state {
    grid-column: 1 / -1;
    padding: 60px 0;
  }

  .pagination-wrapper {
    display: flex;
    justify-content: center;
    padding: 20px 0;
  }
}

@media (max-width: 767px) {
  .student-exam-center {
    padding: 0 14px 20px;

    .page-header {
      padding: 20px 18px;
      margin-bottom: 18px;
      border-radius: 22px;

      .header-content {
        align-items: stretch;
        flex-direction: column;
        gap: 18px;
      }

      .header-left {
        align-items: flex-start;
        gap: 14px;
      }

      .header-icon {
        width: 52px;
        height: 52px;
        border-radius: 16px;

        .custom-icon {
          width: 30px;
          height: 30px;
        }
      }

      .page-title {
        font-size: 21px;
      }

      .page-desc {
        font-size: 14px;
      }

      .header-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
        gap: 10px;

        .stat-item {
          padding: 12px 8px;
          background: rgb(255 255 255 / 18%);
          border-radius: 16px;

          .stat-value {
            font-size: 24px;
            line-height: 1.1;
          }

          .stat-label {
            display: block;
            margin-top: 6px;
            font-size: 12px;
            line-height: 1.4;
          }
        }
      }
    }

    .stats-section {
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 14px;
      margin-bottom: 18px;
    }

    .stat-card {
      align-items: flex-start;
      flex-direction: column;
      gap: 12px;
      padding: 18px;
      border-radius: 20px;

      &:hover {
        transform: none;
      }

      .stat-icon {
        width: 46px;
        height: 46px;
        border-radius: 14px;
      }

      .stat-value {
        font-size: 24px;
        line-height: 1.1;
      }

      .stat-label {
        font-size: 13px;
      }
    }

    .filter-toolbar {
      flex-direction: column;
      align-items: stretch;
      padding: 18px 16px;
      margin-bottom: 18px;
      border-radius: 22px;

      .toolbar-left {
        .mobile-tab-strip {
          margin-bottom: 2px;

          .mobile-tab-button {
            min-height: 40px;
            padding: 0 15px;
          }
        }
      }

      .toolbar-right {
        flex-direction: column;
        gap: 10px;

        :deep(.el-input),
        :deep(.el-select) {
          width: 100% !important;
        }
      }
    }

    .papers-grid {
      grid-template-columns: 1fr;
      gap: 16px;
      margin-bottom: 18px;
    }

    .paper-card {
      border-radius: 22px;

      &:hover {
        transform: none;
      }

      .card-header {
        align-items: flex-start;
        flex-direction: column;
        padding: 14px 16px;

        .remaining-time {
          font-size: 12px;
        }
      }

      .card-body {
        padding: 18px 16px;

        .paper-title {
          font-size: 17px;
        }

        .paper-desc {
          margin-bottom: 14px;
          font-size: 14px;
          line-height: 1.7;
        }

        .paper-meta {
          gap: 10px 14px;
          margin-bottom: 14px;

          .meta-item {
            font-size: 13px;
          }
        }

        .paper-time {
          padding: 12px 14px;
          margin-bottom: 14px;

          .time-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 2px;
            margin-bottom: 10px;

            &:last-child {
              margin-bottom: 0;
            }

            .time-value {
              text-align: left;
            }
          }
        }

        .score-display {
          gap: 10px;
          padding: 14px;

          .score-value {
            font-size: 28px;
          }
        }
      }

      .card-footer {
        flex-direction: column;
        align-items: stretch;
        padding: 14px 16px 16px;

        .action-btn {
          width: 100%;
          min-height: 44px;
        }

        :deep(.el-button--link) {
          justify-content: center;
          min-height: 22px;
          padding: 0;
        }
      }
    }

    .empty-state {
      padding: 28px 0;
    }

    .pagination-wrapper {
      justify-content: stretch;
      padding: 8px 0 0;

      :deep(.el-pagination) {
        justify-content: center;
        flex-wrap: wrap;
        row-gap: 10px;
      }
    }
  }
}

@media (max-width: 360px) {
  .student-exam-center {
    padding: 0 10px 18px;

    .page-header {
      padding: 18px 16px;
    }

    .filter-toolbar {
      padding: 16px 14px;
    }

    .paper-card {
      .card-body {
        .paper-meta {
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
        }
      }
    }
  }
}
</style>
