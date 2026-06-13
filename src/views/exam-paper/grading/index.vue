<script setup lang="ts">
import { ref, reactive, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useDark } from "@pureadmin/utils";
import { useAppStoreHook } from "@/store/modules/app";
import { ElMessage } from "element-plus";
import {
  getGradingStatistics,
  getGradingPaperList,
  autoGradeObjective,
  type GradingPaperItem,
  type GradingStatistics
} from "@/api/examPaper";
import { isNativeWebViewRuntime, logNativeFallback } from "@/utils/nativeRuntime";

// 导入 SVG 图标组件
import IconEdit from "@/assets/home-icons/edit.svg?component";
import IconClock from "@/assets/home-icons/clock.svg?component";
import IconCheckCircle from "@/assets/home-icons/check-circle.svg?component";
import IconDocument from "@/assets/home-icons/document.svg?component";

defineOptions({
  name: "ExamPaperGrading"
});

const router = useRouter();
const { isDark } = useDark();
const appStore = useAppStoreHook();
const isMobile = computed(() => appStore.getDevice === "mobile");

// 搜索条件
const searchForm = reactive({
  keyword: "",
  status: "",
  courseId: null as number | null
});

// 课程列表
const courseList = ref([
  { id: 1, name: "高等数学" },
  { id: 2, name: "线性代数" },
  { id: 3, name: "概率论" }
]);

// 状态选项
const statusOptions = [
  { value: "pending", label: "待阅卷" },
  { value: "grading", label: "阅卷中" },
  { value: "completed", label: "已完成" }
];

// 统计数据
const statistics = ref<GradingStatistics>({
  pending: 0,
  grading: 0,
  completed: 0,
  total: 0
});

// 待阅卷列表
const gradingList = ref<GradingPaperItem[]>([]);

// 分页
const pagination = reactive({
  currentPage: 1,
  pageSize: 10,
  total: 3
});

// 加载状态
const loading = ref(false);

const paginationLayout = computed(() =>
  isMobile.value ? "prev, pager, next" : "total, prev, pager, next"
);

const nativeDemoGradingList: GradingPaperItem[] = [
  {
    id: 1,
    paperTitle: "2024年春季概率论期末考试",
    courseName: "概率论",
    studentCount: 45,
    gradedCount: 30,
    pendingCount: 15,
    status: "grading",
    deadline: "2099-04-15",
    publishTime: "2024-04-01 09:30"
  },
  {
    id: 2,
    paperTitle: "高等数学单元测验",
    courseName: "高等数学",
    studentCount: 36,
    gradedCount: 36,
    pendingCount: 0,
    status: "completed",
    deadline: "2024-04-08",
    publishTime: "2024-03-30 14:00"
  },
  {
    id: 3,
    paperTitle: "线性代数综合练习",
    courseName: "线性代数",
    studentCount: 28,
    gradedCount: 0,
    pendingCount: 28,
    status: "pending",
    deadline: "2099-05-01",
    publishTime: "2024-04-12 10:15"
  }
];

const nativeDemoStatistics: GradingStatistics = {
  pending: nativeDemoGradingList.filter(item => item.status === "pending")
    .length,
  grading: nativeDemoGradingList.filter(item => item.status === "grading")
    .length,
  completed: nativeDemoGradingList.filter(item => item.status === "completed")
    .length,
  total: nativeDemoGradingList.reduce((sum, item) => sum + item.studentCount, 0)
};

const isSuccessResponse = (res: { code?: unknown; success?: unknown }) =>
  res?.code === 0 ||
  res?.code === 200 ||
  res?.code === "0" ||
  res?.code === "200" ||
  res?.success === true;

const applyNativeDemoStatistics = () => {
  statistics.value = { ...nativeDemoStatistics };
};

const applyNativeDemoGradingList = () => {
  const keyword = searchForm.keyword.trim();
  const visibleList = nativeDemoGradingList.filter(item => {
    const matchesKeyword =
      !keyword ||
      item.paperTitle.includes(keyword) ||
      item.courseName.includes(keyword);
    const matchesStatus = !searchForm.status || item.status === searchForm.status;
    const matchesCourse =
      !searchForm.courseId ||
      courseList.value.find(course => course.id === searchForm.courseId)
        ?.name === item.courseName;

    return matchesKeyword && matchesStatus && matchesCourse;
  });

  gradingList.value = visibleList;
  pagination.total = visibleList.length;
};

// 加载统计数据
const loadStatistics = async () => {
  try {
    const res = await getGradingStatistics();
    if (isSuccessResponse(res) && res.data) {
      statistics.value = res.data;
    } else if (isNativeWebViewRuntime()) {
      logNativeFallback("使用原生演示阅卷统计", res);
      applyNativeDemoStatistics();
    }
  } catch (e) {
    logNativeFallback("获取阅卷统计失败", e);
    if (isNativeWebViewRuntime()) applyNativeDemoStatistics();
  }
};

// 搜索/加载列表
const handleSearch = async () => {
  loading.value = true;
  try {
    const res = await getGradingPaperList({
      pageNum: pagination.currentPage,
      pageSize: pagination.pageSize,
      keyword: searchForm.keyword || undefined,
      status: (searchForm.status as any) || undefined,
      courseId: searchForm.courseId || undefined
    });
    if (isSuccessResponse(res) && res.data) {
      gradingList.value = res.data.list || [];
      pagination.total = res.data.total || 0;
    } else if (isNativeWebViewRuntime()) {
      logNativeFallback("使用原生演示阅卷列表", res);
      applyNativeDemoGradingList();
    }
  } catch (e) {
    logNativeFallback("获取阅卷列表失败", e);
    if (isNativeWebViewRuntime()) applyNativeDemoGradingList();
  } finally {
    loading.value = false;
  }
};

// 重置搜索
const handleReset = () => {
  searchForm.keyword = "";
  searchForm.status = "";
  searchForm.courseId = null;
  handleSearch();
};

// 进入阅卷
const handleGrade = (row: any) => {
  router.push(`/exam-paper/grading/${row.id}`);
};

// 批量自动批改客观题
const handleAutoGrade = async (row: any) => {
  try {
    const res = await autoGradeObjective(row.id);
    if (res.code === 0) {
      ElMessage.success(`已自动批改 ${res.data.gradedCount} 份客观题`);
      loadStatistics();
      handleSearch();
    } else {
      ElMessage.error(res.msg || "自动批改失败");
    }
  } catch (error) {
    console.error("自动批改失败:", error);
    ElMessage.error("自动批改失败");
  }
};

// 查看详情
const handleView = (row: any) => {
  router.push(`/exam-paper/grading/${row.id}/detail`);
};

// 获取状态标签类型
const getStatusType = (
  status: string
): "success" | "warning" | "info" | "primary" | "danger" => {
  const types: Record<
    string,
    "success" | "warning" | "info" | "primary" | "danger"
  > = {
    pending: "warning",
    grading: "primary",
    completed: "success"
  };
  return types[status] || "info";
};

// 获取状态文本
const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    pending: "待阅卷",
    grading: "阅卷中",
    completed: "已完成"
  };
  return texts[status] || "未知";
};

// 计算进度百分比
const getProgress = (row: any) => {
  if (row.studentCount === 0) return 0;
  return Math.round((row.gradedCount / row.studentCount) * 100);
};

// 分页变化
const handlePageChange = (page: number) => {
  pagination.currentPage = page;
  handleSearch();
};

onMounted(() => {
  loadStatistics();
  handleSearch();
});
</script>

<template>
  <div class="grading-container" :class="{ 'is-dark': isDark }">
    <!-- 页面标题区域 -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-icon">
          <IconifyIconOnline icon="ri:clipboard-line" />
        </div>
        <div class="header-info">
          <h1 class="page-title">阅卷管理</h1>
          <p class="page-desc">管理和批阅学生提交的试卷答案</p>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-section">
      <div class="stat-card">
        <div class="stat-icon pending">
          <IconClock />
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ statistics.pending }}</div>
          <div class="stat-label">待阅卷</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon grading">
          <IconEdit />
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ statistics.grading }}</div>
          <div class="stat-label">阅卷中</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon completed">
          <IconCheckCircle />
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ statistics.completed }}</div>
          <div class="stat-label">已完成</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon total">
          <IconDocument />
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ statistics.total }}</div>
          <div class="stat-label">总答卷数</div>
        </div>
      </div>
    </div>

    <!-- 搜索区域 -->
    <div class="search-card">
      <el-form
        :model="searchForm"
        :inline="!isMobile"
        :label-position="isMobile ? 'top' : 'right'"
        class="search-form"
      >
        <el-form-item label="关键词">
          <el-input
            v-model="searchForm.keyword"
            placeholder="试卷名称"
            clearable
            :style="{ width: isMobile ? '100%' : '200px' }"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select
            v-model="searchForm.status"
            placeholder="全部状态"
            clearable
            :style="{ width: isMobile ? '100%' : '140px' }"
          >
            <el-option
              v-for="item in statusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="课程">
          <el-select
            v-model="searchForm.courseId"
            placeholder="全部课程"
            clearable
            :style="{ width: isMobile ? '100%' : '160px' }"
          >
            <el-option
              v-for="course in courseList"
              :key="course.id"
              :label="course.name"
              :value="course.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item class="search-actions">
          <el-button
            type="primary"
            class="search-btn"
            size="large"
            @click="handleSearch"
          >
            <el-icon class="mr-1"><Search /></el-icon>
            <span>搜索</span>
          </el-button>
          <el-button class="reset-btn" size="large" @click="handleReset">
            <el-icon class="mr-1"><Refresh /></el-icon>
            <span>重置</span>
          </el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 阅卷列表 -->
    <div class="list-card">
      <template v-if="isMobile">
        <div v-loading="loading" class="grading-mobile-list">
          <div
            v-for="row in gradingList"
            :key="row.id"
            class="grading-mobile-card"
          >
            <div class="mobile-card-head">
              <div class="paper-info-cell">
                <div class="paper-icon">
                  <IconDocument />
                </div>
                <div class="paper-details">
                  <span class="paper-title">{{ row.paperTitle }}</span>
                  <span class="paper-course">{{ row.courseName }}</span>
                </div>
              </div>
              <el-tag
                :type="getStatusType(row.status)"
                size="small"
                effect="light"
              >
                {{ getStatusText(row.status) }}
              </el-tag>
            </div>

            <div class="progress-panel">
              <div class="progress-panel-head">
                <span class="mobile-meta-label">阅卷进度</span>
                <span class="progress-text">
                  {{ row.gradedCount }}/{{ row.studentCount }}
                </span>
              </div>
              <el-progress
                :percentage="getProgress(row)"
                :status="row.status === 'completed' ? 'success' : ''"
                :stroke-width="10"
              />
            </div>

            <div class="mobile-meta-grid">
              <div class="mobile-meta-item">
                <span class="mobile-meta-label">答卷数</span>
                <span class="mobile-meta-value">{{ row.studentCount }}</span>
              </div>
              <div class="mobile-meta-item">
                <span class="mobile-meta-label">完成度</span>
                <span class="mobile-meta-value">{{ getProgress(row) }}%</span>
              </div>
              <div class="mobile-meta-item">
                <span class="mobile-meta-label">截止时间</span>
                <span class="mobile-meta-value">{{ row.deadline || "-" }}</span>
              </div>
              <div class="mobile-meta-item">
                <span class="mobile-meta-label">发布时间</span>
                <span class="mobile-meta-value">{{
                  row.publishTime || "-"
                }}</span>
              </div>
            </div>

            <div class="mobile-action-grid">
              <el-button
                v-if="row.status !== 'completed'"
                class="operation-btn"
                type="primary"
                size="small"
                @click="handleGrade(row)"
              >
                <el-icon><Edit /></el-icon>
                <span>阅卷</span>
              </el-button>
              <el-button
                v-if="row.status !== 'completed'"
                class="operation-btn"
                type="primary"
                size="small"
                @click="handleAutoGrade(row)"
              >
                <el-icon><MagicStick /></el-icon>
                <span>自动批改</span>
              </el-button>
              <el-button
                class="operation-btn"
                size="small"
                @click="handleView(row)"
              >
                <el-icon><View /></el-icon>
                <span>详情</span>
              </el-button>
            </div>
          </div>

          <el-empty
            v-if="!loading && gradingList.length === 0"
            description="暂无阅卷任务"
            class="mobile-empty"
          />
        </div>
      </template>

      <el-table
        v-else
        v-loading="loading"
        :data="gradingList"
        class="grading-table"
      >
        <el-table-column prop="paperTitle" label="试卷名称" min-width="200">
          <template #default="{ row }">
            <div class="paper-info-cell">
              <div class="paper-icon">
                <IconDocument />
              </div>
              <div class="paper-details">
                <span class="paper-title">{{ row.paperTitle }}</span>
                <span class="paper-course">{{ row.courseName }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="studentCount"
          label="答卷数"
          width="100"
          align="center"
        >
          <template #default="{ row }">
            <span class="count-badge">{{ row.studentCount }}</span>
          </template>
        </el-table-column>
        <el-table-column label="阅卷进度" width="220">
          <template #default="{ row }">
            <div class="progress-info">
              <el-progress
                :percentage="getProgress(row)"
                :status="row.status === 'completed' ? 'success' : ''"
                :stroke-width="10"
              />
              <span class="progress-text">
                {{ row.gradedCount }}/{{ row.studentCount }}
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag
              :type="getStatusType(row.status)"
              size="small"
              effect="light"
            >
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="deadline"
          label="截止时间"
          width="120"
          align="center"
        />
        <el-table-column
          prop="publishTime"
          label="发布时间"
          width="160"
          align="center"
        />
        <el-table-column label="操作" width="280" align="center" fixed="right">
          <template #default="{ row }">
            <div class="operation-actions">
              <el-button
                v-if="row.status !== 'completed'"
                class="operation-btn"
                type="primary"
                size="small"
                @click="handleGrade(row)"
              >
                <el-icon><Edit /></el-icon>
                <span>阅卷</span>
              </el-button>
              <el-button
                v-if="row.status !== 'completed'"
                class="operation-btn"
                type="primary"
                size="small"
                @click="handleAutoGrade(row)"
              >
                <el-icon><MagicStick /></el-icon>
                <span>自动批改</span>
              </el-button>
              <el-button
                class="operation-btn"
                size="small"
                @click="handleView(row)"
              >
                <el-icon><View /></el-icon>
                <span>详情</span>
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.currentPage"
          :page-size="pagination.pageSize"
          :total="pagination.total"
          :layout="paginationLayout"
          background
          @current-change="handlePageChange"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* 浅色模式变量 */
$light-bg: var(--el-bg-color-page);
$light-card-bg: var(--el-bg-color);
$light-text-primary: var(--el-text-color-primary);
$light-text-secondary: var(--el-text-color-regular);
$light-text-muted: var(--el-text-color-secondary);
$light-border: var(--el-border-color-lighter);
$light-shadow:
  0 4px 6px -1px rgb(0 0 0 / 10%),
  0 2px 4px -2px rgb(0 0 0 / 10%);
$light-shadow-lg:
  0 10px 15px -3px rgb(0 0 0 / 10%),
  0 4px 6px -4px rgb(0 0 0 / 10%);

/* 深色模式变量 */
$dark-bg: var(--el-bg-color-page);
$dark-card-bg: var(--el-bg-color);
$dark-text-primary: var(--el-text-color-primary);
$dark-text-secondary: var(--el-text-color-regular);
$dark-text-muted: var(--el-text-color-secondary);
$dark-border: var(--el-border-color-lighter);
$dark-shadow:
  0 4px 6px -1px rgb(0 0 0 / 30%),
  0 2px 4px -2px rgb(0 0 0 / 30%);
$dark-shadow-lg:
  0 10px 15px -3px rgb(0 0 0 / 40%),
  0 4px 6px -4px rgb(0 0 0 / 40%);

/* 主色调 */
$primary-gradient: linear-gradient(135deg, #4a7fc8 0%, #739cf9 100%);
$success-gradient: linear-gradient(135deg, #739cf9 0%, #80c8fa 100%);
$warning-gradient: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
$info-gradient: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
$danger-gradient: linear-gradient(135deg, #ef4444 0%, #f87171 100%);

/* 统一圆角 */
$radius-sm: 8px;
$radius-md: 12px;
$radius-lg: 16px;
$radius-xl: 20px;

.grading-container {
  box-sizing: border-box;
  min-height: 100%;
  padding: 24px;
  overflow-x: hidden;
  transition: all 0.3s ease;

  &.is-dark {
    .page-header {
      background: $dark-card-bg;
      border-color: $dark-border;

      .page-title {
        color: $dark-text-primary;
      }

      .page-desc {
        color: $dark-text-secondary;
      }

      .header-icon {
        background: rgba(102, 126, 234, 0.15);
        color: #80c8fa;
      }
    }

    .stat-card {
      background: $dark-card-bg;
      border-color: $dark-border;
      box-shadow: $dark-shadow;

      &:hover {
        box-shadow: $dark-shadow-lg;
      }

      .stat-info {
        .stat-value {
          color: $dark-text-primary;
        }

        .stat-label {
          color: $dark-text-secondary;
        }
      }
    }

    .search-card {
      background: $dark-card-bg;
      border-color: $dark-border;
      box-shadow: $dark-shadow;
    }

    .list-card {
      background: $dark-card-bg;
      border-color: $dark-border;
      box-shadow: $dark-shadow;

      .grading-mobile-card {
        background: rgba(15, 23, 42, 0.68);
        border-color: $dark-border;
        box-shadow: $dark-shadow;
      }

      .progress-panel {
        background: rgba(255, 255, 255, 0.04);
        border-color: $dark-border;
      }

      .mobile-meta-label,
      .progress-text {
        color: $dark-text-secondary;
      }

      .mobile-meta-value {
        color: $dark-text-primary;
      }

      .grading-table {
        :deep(.el-table) {
          background-color: transparent;
          --el-table-bg-color: transparent;
          --el-table-tr-bg-color: transparent;
          --el-table-header-bg-color: rgba(255, 255, 255, 0.05);
          --el-table-row-hover-bg-color: rgba(255, 255, 255, 0.03);
          --el-table-border-color: rgba(255, 255, 255, 0.1);
          color: $dark-text-primary;
        }

        :deep(.el-table__header th) {
          background-color: rgba(255, 255, 255, 0.05);
          color: $dark-text-primary;
          border-bottom-color: $dark-border;
        }

        :deep(.el-table__body tr) {
          &:hover > td {
            background-color: rgba(255, 255, 255, 0.03);
          }
        }

        :deep(.el-table td),
        :deep(.el-table th.is-leaf) {
          border-bottom-color: $dark-border;
        }
      }

      .paper-info-cell {
        .paper-icon {
          background: rgba(102, 126, 234, 0.15);
          color: #80c8fa;
        }

        .paper-course {
          color: $dark-text-muted;
        }

        .paper-title {
          color: $dark-text-primary;
        }
      }

      .count-badge {
        background: rgba(255, 255, 255, 0.05);
        color: $dark-text-secondary;
      }

      .progress-text {
        color: $dark-text-muted;
      }
    }
  }
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 104px;
  padding: 24px;
  margin-bottom: 24px;
  background: $light-card-bg;
  border: 1px solid $light-border;
  border-radius: $radius-lg;
  box-shadow: $light-shadow;

  .header-content {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    color: #fff;
    background: $primary-gradient;
    border-radius: $radius-md;
    flex-shrink: 0;
    box-shadow: 0 6px 16px rgb(74 127 200 / 30%);

    svg {
      width: 28px !important;
      height: 28px !important;
      display: block;
    }
  }

  .header-info {
    .page-title {
      margin: 0 0 4px;
      font-size: 24px;
      font-weight: 700;
      color: $light-text-primary;
    }

    .page-desc {
      margin: 0;
      font-size: 14px;
      color: $light-text-secondary;
    }
  }
}

.stats-section {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 24px;

  @media (max-width: 1200px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }

  .stat-card {
    display: flex;
    gap: 20px;
    align-items: center;
    padding: 24px;
    cursor: pointer;
    background: $light-card-bg;
    border: 1px solid $light-border;
    border-radius: $radius-lg;
    box-shadow: $light-shadow;
    transition: all 0.3s ease;

    &:hover {
      box-shadow: $light-shadow-lg;
      transform: translateY(-4px);
    }

    .stat-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      color: #fff;
      border-radius: $radius-md;
      flex-shrink: 0;

      &.pending {
        background: $danger-gradient;
      }

      &.grading {
        background: $info-gradient;
      }

      &.completed {
        background: $success-gradient;
      }

      &.total {
        background: $warning-gradient;
      }

      svg {
        width: 26px !important;
        height: 26px !important;
        display: block;
      }
    }

    .stat-info {
      .stat-value {
        margin-bottom: 4px;
        font-size: 28px;
        font-weight: 700;
        line-height: 1;
        color: $light-text-primary;
      }

      .stat-label {
        font-size: 14px;
        color: $light-text-secondary;
      }
    }
  }
}

.search-card {
  padding: 20px 24px;
  margin-bottom: 24px;
  background: $light-card-bg;
  border: 1px solid $light-border;
  border-radius: $radius-lg;
  box-shadow: $light-shadow;

  :deep(.el-form-item) {
    margin-bottom: 0;
  }

  .search-form {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 16px;
    align-items: flex-end;

    :deep(.el-form-item) {
      margin-right: 0;
    }
  }

  /* 解决按钮文字未居中问题 */
  :deep(.el-button.search-btn),
  :deep(.el-button.reset-btn) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    height: 40px;
    padding: 0 16px !important;
    line-height: 1 !important;
    white-space: nowrap;
    border-radius: 12px;

    > span {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1 !important;
    }
  }

  :deep(.el-button.search-btn.el-button--primary) {
    color: #fff;
    border: none;
    background: $info-gradient;
  }

  :deep(.el-button + .el-button) {
    margin-left: 0;
  }

  :deep(.el-button .el-icon) {
    margin-right: 4px !important;
    line-height: 1 !important;
  }
}

.list-card {
  background: $light-card-bg;
  border: 1px solid $light-border;
  border-radius: $radius-lg;
  box-shadow: $light-shadow;
  overflow: hidden;

  .grading-mobile-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
  }

  .grading-mobile-card {
    padding: 16px;
    border: 1px solid $light-border;
    border-radius: $radius-lg;
    background: linear-gradient(180deg, rgb(255 255 255 / 96%), #fff);
    box-shadow: 0 10px 24px rgb(15 23 42 / 6%);
  }

  .mobile-card-head {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 14px;
  }

  .progress-panel {
    padding: 12px;
    margin-bottom: 14px;
    background: #f8fafc;
    border: 1px solid #eef2f7;
    border-radius: $radius-md;
  }

  .progress-panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }

  .mobile-meta-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 14px;
  }

  .mobile-meta-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .mobile-meta-label {
    font-size: 12px;
    color: $light-text-secondary;
  }

  .mobile-meta-value {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.5;
    color: $light-text-primary;
    word-break: break-word;
  }

  .grading-table {
    :deep(.el-table__header th) {
      background: #f8fafc;
      font-weight: 600;
    }
  }

  .paper-info-cell {
    display: flex;
    gap: 12px;
    align-items: center;

    .paper-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      color: #7c3aed;
      background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%);
      border-radius: $radius-sm;

      svg {
        width: 22px;
        height: 22px;
      }
    }

    .paper-details {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .paper-title {
        font-weight: 500;
        color: $light-text-primary;
      }

      .paper-course {
        font-size: 12px;
        color: $light-text-muted;
      }
    }
  }

  .count-badge {
    display: inline-block;
    padding: 4px 12px;
    font-size: 14px;
    font-weight: 600;
    color: $light-text-secondary;
    background: #f1f5f9;
    border-radius: 6px;
  }

  .progress-info {
    display: flex;
    gap: 12px;
    align-items: center;

    .el-progress {
      flex: 1;
    }

    .progress-text {
      font-size: 12px;
      color: $light-text-muted;
      white-space: nowrap;
    }
  }

  .pagination-wrapper {
    display: flex;
    justify-content: flex-end;
    padding: 16px 24px;
    border-top: 1px solid $light-border;
  }

  .operation-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;

    .operation-btn {
      min-width: 64px;
      height: 28px;
      padding: 0 10px;
      margin: 0;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 4px;
      line-height: 1 !important;
      border-radius: 8px;

      :deep(span) {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        line-height: 1 !important;
      }

      :deep(.el-icon) {
        margin: 0 !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
    }
  }

  .mobile-action-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    > * {
      flex: 1 1 calc(33.333% - 6px);
      min-width: 0;
    }

    .el-button {
      width: 100%;
      margin-left: 0;
    }
  }

  .mobile-empty {
    padding: 12px 0 0;
  }
}

@media (max-width: 768px) {
  .grading-container {
    padding: 10px 8px calc(var(--pure-mobile-tab-height, 58px) + 24px);
  }

  .page-header {
    min-height: 0;
    padding: 14px;
    margin-bottom: 12px;
    border-radius: 18px;

    .header-content {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr);
      gap: 12px;
      align-items: center;
    }

    .header-icon {
      width: 44px;
      height: 44px;
      border-radius: 14px;

      svg {
        width: 22px;
        height: 22px;
      }
    }

    .header-info {
      min-width: 0;

      .page-title {
        margin-bottom: 4px;
        font-size: 21px;
        line-height: 1.2;
      }

      .page-desc {
        font-size: 13px;
        line-height: 1.45;
      }
    }
  }

  .stats-section {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 16px;

    .stat-card {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      min-height: 78px;
      padding: 12px;
      border-radius: 18px;

      .stat-icon {
        grid-column: 1;
        width: 40px;
        height: 40px;
        border-radius: 14px;

        svg {
          width: 20px;
          height: 20px;
        }
      }

      .stat-info {
        grid-column: 2;
        min-width: 0;

        .stat-value {
          margin-bottom: 4px;
          font-size: 22px;
          line-height: 1.05;
        }

        .stat-label {
          font-size: 12px;
          line-height: 1.35;
          white-space: normal;
        }
      }
    }
  }

  .search-card {
    padding: 14px;
    margin-bottom: 12px;
    border-radius: 18px;

    .search-form {
      display: block;

      :deep(.el-form-item) {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        margin-bottom: 10px;
      }

      :deep(.el-form-item__label) {
        width: auto !important;
        height: auto;
        padding: 0 0 6px;
        line-height: 1.4;
      }

      :deep(.el-form-item__content) {
        margin-left: 0 !important;
        width: 100%;
      }
    }

    .search-actions {
      :deep(.el-form-item__content) {
        display: flex;
        gap: 10px;
      }
    }

    :deep(.el-button.search-btn),
    :deep(.el-button.reset-btn) {
      flex: 1;
      min-height: 36px;
      height: 36px;
      font-size: 13px;
    }

    :deep(.el-input__wrapper),
    :deep(.el-select__wrapper) {
      min-height: 36px;
      border-radius: 12px;
    }
  }

  .list-card {
    .pagination-wrapper {
      justify-content: center;
      padding: 16px;

      :deep(.el-pagination) {
        justify-content: center;
        row-gap: 8px;
      }
    }
  }
}

@media (max-width: 360px) {
  .stats-section {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .search-card {
    .search-actions {
      :deep(.el-form-item__content) {
        flex-direction: column;
      }
    }

    :deep(.el-button.search-btn),
    :deep(.el-button.reset-btn) {
      width: 100%;
    }
  }

  .list-card {
    .grading-mobile-list {
      padding: 12px;
    }

    .grading-mobile-card {
      padding: 14px;
    }

    .mobile-card-head {
      flex-direction: column;
      align-items: stretch;
    }

    .mobile-meta-grid {
      grid-template-columns: 1fr;
    }

    .mobile-action-grid {
      > * {
        flex: 1 1 calc(50% - 4px);
      }
    }
  }
}

/* SVG 图标样式 —— 仅作用于本页的线性图标容器，避免影响 el-empty / el-icon / echarts 等填充型 SVG */
:deep(.header-icon svg),
:deep(.stat-icon svg),
:deep(.paper-icon svg) {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
