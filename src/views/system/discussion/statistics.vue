<script setup lang="ts">
/**
 * 管理员端 - 讨论区统计与审计面板
 * 展示讨论区核心指标、趋势图表以及操作审计日志
 *
 * 接口对接：
 * - GET /edu/backend/v1/discussions/statistics - 获取讨论统计数据
 * - GET /edu/backend/v1/discussions/audit-logs - 获取审计日志
 */
import { ref, reactive, onMounted, computed, watch } from "vue";
import { ElMessage } from "element-plus";
import { usePageResponsive } from "@/utils/pageResponsive";
import {
  Refresh,
  TrendCharts,
  DataLine,
  Warning,
  User,
  Document,
  ChatLineRound,
  Star,
  Timer,
  Operation,
  Search,
  Message,
  Bell,
  PieChart,
  Histogram,
  Flag,
  Clock
} from "@element-plus/icons-vue";
import {
  getGlobalStatistics,
  getAuditLogs,
  type GlobalStatistics,
  type AuditLog
} from "@/api/discussion-admin";
import { getTeacherUsage, getStudentUsage } from "@/api/statistics";
import { getCourseList } from "@/api/course";
import { useECharts, useDark } from "@pureadmin/utils";

defineOptions({
  name: "DiscussionStatistics"
});

const { isMobile, paginationLayout } = usePageResponsive();
const { isDark } = useDark();
const theme = computed(() => (isDark.value ? "dark" : "light"));

type CourseOption = {
  courseId: number;
  title: string;
};

const createEmptyStatistics = (): GlobalStatistics => ({
  totalPosts: 0,
  totalReplies: 0,
  totalLikes: 0,
  pendingPosts: 0,
  pendingReplies: 0,
  pendingReports: 0,
  activeUsers: 0,
  todayPosts: 0,
  todayReplies: 0,
  trends: {
    posts: [],
    replies: []
  },
  topCourses: []
});

const normalizeTrendItems = (
  items?: Array<{ date?: string; count?: number | string }>
) =>
  Array.isArray(items)
    ? items
        .map(item => ({
          date: item?.date || "",
          count: Number(item?.count || 0)
        }))
        .filter(item => item.date)
    : [];

const normalizeStatistics = (
  data?: Partial<GlobalStatistics> | null
): GlobalStatistics => ({
  totalPosts: Number(data?.totalPosts || 0),
  totalReplies: Number(data?.totalReplies || 0),
  totalLikes: Number(data?.totalLikes || 0),
  pendingPosts: Number(data?.pendingPosts || 0),
  pendingReplies: Number(data?.pendingReplies || 0),
  pendingReports: Number(data?.pendingReports || 0),
  activeUsers: Number(data?.activeUsers || 0),
  todayPosts: Number(data?.todayPosts || 0),
  todayReplies: Number(data?.todayReplies || 0),
  trends: {
    posts: normalizeTrendItems(data?.trends?.posts),
    replies: normalizeTrendItems(data?.trends?.replies)
  },
  topCourses: Array.isArray(data?.topCourses)
    ? data.topCourses.map(item => ({
        courseId: Number(item?.courseId || 0),
        courseName: item?.courseName || "",
        postCount: Number(item?.postCount || 0),
        replyCount: Number(item?.replyCount || 0)
      }))
    : []
});

// ==================== 状态统计 ====================

const loading = ref(false);
const stats = ref<GlobalStatistics | null>(null);
const selectedCourse = ref<number | null | undefined>(null);
const courses = ref<CourseOption[]>([]);

// 获取课程列表用于过滤
const fetchCourses = async () => {
  try {
    const { data } = await getCourseList({ pageNum: 1, pageSize: 100 });
    courses.value = data?.courseList || [];
  } catch (error) {
    console.error("加载课程列表失败", error);
  }
};

// 所有统计字段的卡片配置
const allStatCards = computed(() => {
  if (!stats.value) return [];
  return [
    {
      label: "总帖子数",
      value: stats.value.totalPosts,
      icon: Document,
      color: "#409eff",
      bg: "linear-gradient(135deg, rgba(64, 158, 255, 0.15) 0%, rgba(64, 158, 255, 0.05) 100%)",
      borderColor: "rgba(64, 158, 255, 0.3)",
      tip: "全站累计发布的讨论帖总数",
      category: "content"
    },
    {
      label: "总回复数",
      value: stats.value.totalReplies,
      icon: ChatLineRound,
      color: "#67c23a",
      bg: "linear-gradient(135deg, rgba(103, 194, 58, 0.15) 0%, rgba(103, 194, 58, 0.05) 100%)",
      borderColor: "rgba(103, 194, 58, 0.3)",
      tip: "全站累计产生的回复与评论",
      category: "content"
    },
    {
      label: "总点赞数",
      value: stats.value.totalLikes,
      icon: Star,
      color: "#f59e0b",
      bg: "linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.05) 100%)",
      borderColor: "rgba(245, 158, 11, 0.3)",
      tip: "互动产生的认可与点赞总量",
      category: "engagement"
    },
    {
      label: "活跃用户数",
      value: stats.value.activeUsers,
      icon: User,
      color: "#8b5cf6",
      bg: "linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.05) 100%)",
      borderColor: "rgba(139, 92, 246, 0.3)",
      tip: "最近24小时内参与互动的用户",
      category: "user"
    },
    {
      label: "今日新帖",
      value: stats.value.todayPosts,
      icon: Clock,
      color: "#06b6d4",
      bg: "linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(6, 182, 212, 0.05) 100%)",
      borderColor: "rgba(6, 182, 212, 0.3)",
      tip: "今日 00:00 至今新增的发帖",
      isNew: true,
      category: "today"
    },
    {
      label: "今日新回复",
      value: stats.value.todayReplies,
      icon: Message,
      color: "#10b981",
      bg: "linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)",
      borderColor: "rgba(16, 185, 129, 0.3)",
      tip: "今日 00:00 至今新增的回复",
      isNew: true,
      category: "today"
    },
    {
      label: "待审核帖子",
      value: stats.value.pendingPosts,
      icon: Flag,
      color: "#f97316",
      bg: "linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(249, 115, 22, 0.05) 100%)",
      borderColor: "rgba(249, 115, 22, 0.3)",
      tip: "需要尽快完成内容审核",
      isPending: true,
      category: "pending"
    },
    {
      label: "待审核回复",
      value: stats.value.pendingReplies,
      icon: Bell,
      color: "#eab308",
      bg: "linear-gradient(135deg, rgba(234, 179, 8, 0.15) 0%, rgba(234, 179, 8, 0.05) 100%)",
      borderColor: "rgba(234, 179, 8, 0.3)",
      tip: "需要尽快完成回复审核",
      isPending: true,
      category: "pending"
    },
    {
      label: "待处理举报",
      value: stats.value.pendingReports,
      icon: Warning,
      color: "#ef4444",
      bg: "linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.05) 100%)",
      borderColor: "rgba(239, 68, 68, 0.3)",
      tip: "用户发起的违规举报",
      isPending: true,
      category: "pending"
    }
  ];
});

// 待处理指标卡片
const pendingCards = computed(() => {
  if (!stats.value)
    return allStatCards.value.filter(c => c.category === "pending");
  return allStatCards.value.filter(c => c.category === "pending");
});
const pendingTotal = computed(
  () =>
    (stats.value?.pendingPosts || 0) +
    (stats.value?.pendingReplies || 0) +
    (stats.value?.pendingReports || 0)
);

// 用户与互动统计卡片
const engagementCards = computed(() => {
  if (!stats.value) return [];
  return allStatCards.value.filter(
    c => c.category === "engagement" || c.category === "user"
  );
});
const topCourses = computed(() => stats.value?.topCourses || []);
const trendDates = computed(() => {
  const postDates = stats.value?.trends?.posts.map(item => item.date) || [];
  if (postDates.length > 0) return postDates;
  return stats.value?.trends?.replies.map(item => item.date) || [];
});

const getOperatorRoleType = (role: string) => {
  if (role === "admin") return "danger";
  if (role === "teacher") return "warning";
  return "info";
};

const getOperatorRoleText = (role: string) => {
  if (role === "admin") return "管理员";
  if (role === "teacher") return "教师";
  return role || "未知";
};

const getTargetTypeText = (type: string) => {
  if (type === "post") return "帖子";
  if (type === "reply") return "回复";
  if (type === "report") return "举报";
  return type || "未知";
};

// ==================== 图表逻辑 ====================

const trendChartRef = ref();
const ratioChartRef = ref();
const usageChartRef = ref();
const summaryChartRef = ref();
const { setOptions: setTrendOptions } = useECharts(trendChartRef, { theme });
const { setOptions: setRatioOptions } = useECharts(ratioChartRef, { theme });
const { setOptions: setUsageOptions } = useECharts(usageChartRef, { theme });
const { setOptions: setSummaryOptions } = useECharts(summaryChartRef, {
  theme
});

const initCharts = async () => {
  const currentStats = stats.value || createEmptyStatistics();
  const postData = currentStats.trends?.posts.map(item => item.count) || [];
  const replyData = currentStats.trends?.replies.map(item => item.count) || [];

  setTrendOptions({
    tooltip: { trigger: "axis" },
    legend: { data: ["发帖数", "回复数"], bottom: 0 },
    grid: { left: "3%", right: "4%", bottom: "12%", containLabel: true },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: trendDates.value
    },
    yAxis: { type: "value" },
    series: [
      {
        name: "发帖数",
        type: "line",
        smooth: true,
        data: postData,
        color: "#409eff",
        areaStyle: { opacity: 0.1 }
      },
      {
        name: "回复数",
        type: "line",
        smooth: true,
        data: replyData,
        color: "#67c23a",
        areaStyle: { opacity: 0.1 }
      }
    ]
  });

  // 占比图 (Pie Chart)
  setRatioOptions({
    tooltip: { trigger: "item" },
    legend: { orient: "vertical", left: "left", bottom: 0 },
    series: [
      {
        name: "内容分布",
        type: "pie",
        radius: ["40%", "70%"],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: isDark.value ? "#1d1e1f" : "#fff",
          borderWidth: 2
        },
        label: { show: false, position: "center" },
        emphasis: {
          label: { show: true, fontSize: "16", fontWeight: "bold" }
        },
        labelLine: { show: false },
        data: [
          {
            value: currentStats.totalPosts,
            name: "帖子",
            itemStyle: { color: "#409eff" }
          },
          {
            value: currentStats.totalReplies,
            name: "回复",
            itemStyle: { color: "#67c23a" }
          },
          {
            value: currentStats.totalLikes,
            name: "点赞",
            itemStyle: { color: "#f59e0b" }
          }
        ]
      }
    ]
  });

  // 待处理统计图 (Bar Chart)
  setSummaryOptions({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
    xAxis: {
      type: "category",
      data: ["待审核帖子", "待审核回复", "待处理举报"]
    },
    yAxis: { type: "value" },
    series: [
      {
        name: "待处理数量",
        type: "bar",
        barWidth: "50%",
        data: [
          {
            value: currentStats.pendingPosts,
            itemStyle: { color: "#f97316" }
          },
          {
            value: currentStats.pendingReplies,
            itemStyle: { color: "#eab308" }
          },
          {
            value: currentStats.pendingReports,
            itemStyle: { color: "#ef4444" }
          }
        ],
        itemStyle: {
          borderRadius: [6, 6, 0, 0]
        }
      }
    ]
  });

  // 平台使用趋势图 (Enrichment)
  try {
    const [teacherRes, studentRes] = await Promise.all([
      getTeacherUsage(),
      getStudentUsage()
    ]);
    const tData = teacherRes.data.usageInfoList || [];
    const sData = studentRes.data.usageInfoList || [];

    setUsageOptions({
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        confine: true
      },
      legend: {
        data: ["教师使用量", "学生使用量"],
        top: 0,
        itemWidth: 12,
        itemHeight: 12,
        textStyle: { fontSize: 12 }
      },
      grid: [
        { left: "10%", right: "5%", top: "15%", height: "32%" },
        { left: "10%", right: "5%", top: "54%", height: "32%" }
      ],
      xAxis: [
        {
          type: "category",
          gridIndex: 0,
          data: tData.map(i => i.date),
          axisLabel: { show: false },
          axisTick: { show: false },
          axisLine: { lineStyle: { color: isDark.value ? "#333" : "#eee" } }
        },
        {
          type: "category",
          gridIndex: 1,
          data: sData.map(i => i.date),
          axisLabel: {
            fontSize: 10,
            color: isDark.value ? "#999" : "#666",
            hideOverlap: true,
            interval: "auto"
          },
          axisLine: { lineStyle: { color: isDark.value ? "#333" : "#eee" } }
        }
      ],
      yAxis: [
        {
          type: "value",
          gridIndex: 0,
          splitLine: { show: true, lineStyle: { type: "dashed" } },
          axisLabel: { fontSize: 10 },
          minInterval: 1
        },
        {
          type: "value",
          gridIndex: 1,
          splitLine: { show: true, lineStyle: { type: "dashed" } },
          axisLabel: { fontSize: 10 },
          minInterval: 1
        }
      ],
      series: [
        {
          name: "教师使用量",
          type: "bar",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: tData.map(i => i.usageNum),
          color: "#409eff",
          barWidth: "45%",
          itemStyle: { borderRadius: [4, 4, 0, 0] }
        },
        {
          name: "学生使用量",
          type: "bar",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: sData.map(i => i.usageNum),
          color: "#67c23a",
          barWidth: "45%",
          itemStyle: { borderRadius: [4, 4, 0, 0] }
        }
      ]
    });
  } catch (error) {
    console.warn("加载额外统计图表失败", error);
  }
};

// ==================== 审计日志 ====================

const auditLoading = ref(false);
const auditLogs = ref<AuditLog[]>([]);
const total = ref(0);
const queryForm = reactive({
  targetType: "",
  action: "",
  operatorId: null,
  startTime: "",
  endTime: "",
  pageNum: 1,
  pageSize: 10
});

const timeRange = ref([]);

const fetchAuditLogs = async () => {
  auditLoading.value = true;
  try {
    const params: any = {
      pageNum: queryForm.pageNum,
      pageSize: queryForm.pageSize
    };
    if (queryForm.targetType) params.targetType = queryForm.targetType;
    if (queryForm.action) params.action = queryForm.action;
    if (queryForm.operatorId) params.operatorId = queryForm.operatorId;
    if (timeRange.value && timeRange.value.length === 2) {
      params.startTime = timeRange.value[0];
      params.endTime = timeRange.value[1];
    }
    const result = await getAuditLogs(params);
    auditLogs.value = result?.list || [];
    total.value = result?.total || 0;
  } catch (error) {
    console.error("加载审计日志失败", error);
  } finally {
    auditLoading.value = false;
  }
};

const handleSearch = () => {
  queryForm.pageNum = 1;
  fetchAuditLogs();
};

const handleReset = () => {
  Object.assign(queryForm, {
    targetType: "",
    action: "",
    operatorId: null,
    startTime: "",
    endTime: "",
    pageNum: 1,
    pageSize: 10
  });
  timeRange.value = [];
  fetchAuditLogs();
};

const handleSizeChange = (val: number) => {
  queryForm.pageSize = val;
  fetchAuditLogs();
};

const handleCurrentChange = (val: number) => {
  queryForm.pageNum = val;
  fetchAuditLogs();
};

// ==================== 数据加载 ====================

const fetchData = async () => {
  loading.value = true;
  try {
    const params =
      selectedCourse.value != null
        ? { courseId: selectedCourse.value }
        : undefined;
    const result = await getGlobalStatistics(params);
    stats.value = normalizeStatistics(result);
    await initCharts();
  } catch (error) {
    console.error("加载统计数据失败", error);
    ElMessage.error("加载统计数据失败");
    stats.value = createEmptyStatistics();
    await initCharts();
  } finally {
    loading.value = false;
  }
};

const handleRefresh = () => {
  fetchData();
  fetchAuditLogs();
};

const handleCourseChange = () => {
  fetchData();
};

onMounted(() => {
  fetchCourses();
  fetchData();
  fetchAuditLogs();
});

watch(theme, () => {
  initCharts();
});
</script>

<template>
  <div class="statistics-container p-4">
    <div class="statistics-toolbar mb-6">
      <el-select
        v-model="selectedCourse"
        placeholder="全部课程"
        clearable
        filterable
        class="statistics-toolbar__select"
        @change="handleCourseChange"
      >
        <el-option
          v-for="item in courses"
          :key="item.courseId"
          :label="item.title"
          :value="item.courseId"
        />
      </el-select>
      <el-button
        type="primary"
        :icon="Refresh"
        :loading="loading"
        class="statistics-toolbar__button"
        @click="handleRefresh"
      >
        同步最新数据
      </el-button>
    </div>

    <!-- 核心数据总览 - 9个字段全部展示 -->
    <div class="mb-8">
      <div class="section-heading mb-4">
        <div class="section-heading__bar section-heading__bar--blue" />
        <span class="text-base font-bold">核心数据指标</span>
      </div>

      <div class="statistics-section-stack">
        <div class="stats-grid stats-grid--content">
          <div
            v-for="item in allStatCards.filter(c => c.category === 'content')"
            :key="item.label"
            class="stat-card-modern stat-card-modern--large"
            :style="{
              background: item.bg,
              border: `1px solid ${item.borderColor}`
            }"
          >
            <div class="stat-card-modern__content">
              <div class="stat-card-modern__copy">
                <div class="stat-card-modern__label-row">
                  <el-tooltip :content="item.tip" placement="top">
                    <span class="stat-card-modern__label">
                      {{ item.label }}
                    </span>
                  </el-tooltip>
                </div>
                <div
                  class="stat-card-modern__value stat-card-modern__value--large"
                  :style="{ color: item.color }"
                >
                  {{ item.value?.toLocaleString() || 0 }}
                </div>
              </div>
              <div
                class="stat-card-modern__icon stat-card-modern__icon--large"
                :style="{ backgroundColor: `${item.color}15` }"
              >
                <el-icon :size="28" :color="item.color">
                  <component :is="item.icon" />
                </el-icon>
              </div>
            </div>
          </div>
        </div>

        <div class="stats-grid stats-grid--compact">
          <div
            v-for="item in engagementCards"
            :key="item.label"
            class="stat-card-modern"
            :style="{
              background: item.bg,
              border: `1px solid ${item.borderColor}`
            }"
          >
            <div class="stat-card-modern__content">
              <div class="stat-card-modern__copy">
                <el-tooltip :content="item.tip" placement="top">
                  <span
                    class="stat-card-modern__label stat-card-modern__label--sm"
                  >
                    {{ item.label }}
                  </span>
                </el-tooltip>
                <div
                  class="stat-card-modern__value stat-card-modern__value--sm"
                  :style="{ color: item.color }"
                >
                  {{ item.value?.toLocaleString() || 0 }}
                </div>
              </div>
              <div
                class="stat-card-modern__icon stat-card-modern__icon--sm"
                :style="{ backgroundColor: `${item.color}15` }"
              >
                <el-icon :size="22" :color="item.color">
                  <component :is="item.icon" />
                </el-icon>
              </div>
            </div>
          </div>

          <div
            v-for="item in allStatCards.filter(c => c.category === 'today')"
            :key="item.label"
            class="stat-card-modern stat-card-modern--new"
            :style="{
              background: item.bg,
              border: `1px solid ${item.borderColor}`
            }"
          >
            <div v-if="item.isNew" class="stat-card-modern__flag">
              <el-tag
                size="small"
                type="danger"
                effect="dark"
                round
                class="animate-pulse"
                >NEW</el-tag
              >
            </div>
            <div class="stat-card-modern__content">
              <div class="stat-card-modern__copy">
                <el-tooltip :content="item.tip" placement="top">
                  <span
                    class="stat-card-modern__label stat-card-modern__label--sm"
                  >
                    {{ item.label }}
                  </span>
                </el-tooltip>
                <div
                  class="stat-card-modern__value stat-card-modern__value--sm"
                  :style="{ color: item.color }"
                >
                  {{ item.value?.toLocaleString() || 0 }}
                </div>
              </div>
              <div
                class="stat-card-modern__icon stat-card-modern__icon--sm"
                :style="{ backgroundColor: `${item.color}15` }"
              >
                <el-icon :size="22" :color="item.color">
                  <component :is="item.icon" />
                </el-icon>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 待处理任务预警 -->
    <div class="mb-8">
      <div class="section-heading mb-4">
        <div class="section-heading__bar section-heading__bar--warm" />
        <span class="text-base font-bold">待处理任务预警</span>
        <el-badge :value="pendingTotal" :max="99" class="ml-3" />
      </div>

      <div class="pending-grid">
        <div v-for="item in pendingCards" :key="item.label">
          <div
            class="pending-card"
            :style="{
              background: item.bg,
              border: `1px solid ${item.borderColor}`
            }"
          >
            <div
              class="pending-card__ornament"
              :style="{ backgroundColor: item.color }"
            />

            <div class="pending-card__content">
              <div class="pending-card__main">
                <div
                  class="pending-card__icon"
                  :style="{ backgroundColor: `${item.color}20` }"
                >
                  <el-icon :size="24" :color="item.color">
                    <component :is="item.icon" />
                  </el-icon>
                </div>
                <div class="pending-card__copy">
                  <div
                    class="pending-card__title"
                    :style="{ color: item.color }"
                  >
                    {{ item.label }}
                  </div>
                  <div class="pending-card__tip">{{ item.tip }}</div>
                </div>
              </div>
              <div class="pending-card__count">
                <span
                  class="pending-card__count-value"
                  :style="{ color: item.color }"
                >
                  {{ item.value || 0 }}
                </span>
                <span class="pending-card__count-label">件待处理</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 图表展示 -->
    <el-row :gutter="16" class="mb-8 charts-grid">
      <el-col :xs="24" :lg="14">
        <el-card
          shadow="never"
          class="!rounded-2xl border-none shadow-sm h-full"
        >
          <template #header>
            <div class="flex items-center">
              <div
                class="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mr-3"
              >
                <el-icon class="text-blue-500" :size="18"><DataLine /></el-icon>
              </div>
              <span class="font-bold">近七日讨论活跃度趋势</span>
            </div>
          </template>
          <div ref="trendChartRef" class="h-[300px]" />
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="5">
        <el-card
          shadow="never"
          class="!rounded-2xl border-none shadow-sm h-full"
        >
          <template #header>
            <div class="flex items-center">
              <div
                class="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center mr-3"
              >
                <el-icon class="text-orange-500" :size="18"
                  ><PieChart
                /></el-icon>
              </div>
              <span class="font-bold">内容构成</span>
            </div>
          </template>
          <div ref="ratioChartRef" class="h-[300px]" />
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="5">
        <el-card
          shadow="never"
          class="!rounded-2xl border-none shadow-sm h-full"
        >
          <template #header>
            <div class="flex items-center">
              <div
                class="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center mr-3"
              >
                <el-icon class="text-red-500" :size="18"><Histogram /></el-icon>
              </div>
              <span class="font-bold">待处理分布</span>
            </div>
          </template>
          <div ref="summaryChartRef" class="h-[300px]" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 平台角色活跃与课程排行 -->
    <el-row :gutter="16" class="mb-8 insights-grid">
      <el-col :xs="24" :lg="8">
        <el-card
          shadow="never"
          class="!rounded-2xl border-none shadow-sm h-full"
        >
          <template #header>
            <div class="flex items-center">
              <div
                class="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center mr-3"
              >
                <el-icon class="text-green-500" :size="18"><User /></el-icon>
              </div>
              <span class="font-bold">平台角色活跃分布</span>
            </div>
          </template>
          <div ref="usageChartRef" class="h-[320px]" />
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="16">
        <el-card
          shadow="never"
          class="!rounded-2xl border-none shadow-sm h-full"
        >
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center">
                <div
                  class="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mr-3"
                >
                  <el-icon class="text-indigo-500" :size="18"
                    ><ChatLineRound
                  /></el-icon>
                </div>
                <span class="font-bold">热门课程讨论排行</span>
              </div>
              <el-button
                type="primary"
                link
                @click="$router.push('/course/list')"
              >
                查看更多
              </el-button>
            </div>
          </template>
          <div v-if="isMobile" class="top-course-list">
            <div
              v-for="(row, index) in topCourses"
              :key="row.courseId"
              class="top-course-card"
            >
              <div class="top-course-card__rank">
                {{ index + 1 }}
              </div>
              <div class="top-course-card__content">
                <div class="top-course-card__name">{{ row.courseName }}</div>
                <div class="top-course-card__meta">
                  <span>帖子 {{ row.postCount }}</span>
                  <span>回复 {{ row.replyCount }}</span>
                </div>
              </div>
            </div>
          </div>
          <el-table v-else :data="topCourses" style="width: 100%" height="250">
            <el-table-column
              type="index"
              label="排名"
              width="80"
              align="center"
            >
              <template #default="{ $index }">
                <div
                  v-if="$index < 3"
                  class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white mx-auto"
                  :class="{
                    'bg-gradient-to-br from-yellow-400 to-yellow-600':
                      $index === 0,
                    'bg-gradient-to-br from-gray-300 to-gray-500': $index === 1,
                    'bg-gradient-to-br from-orange-300 to-orange-500':
                      $index === 2
                  }"
                >
                  {{ $index + 1 }}
                </div>
                <span v-else class="text-gray-400">{{ $index + 1 }}</span>
              </template>
            </el-table-column>
            <el-table-column
              prop="courseName"
              label="课程名称"
              show-overflow-tooltip
            />
            <el-table-column
              prop="postCount"
              label="帖子数"
              width="120"
              align="right"
            >
              <template #default="{ row }">
                <span class="font-bold text-blue-500">{{ row.postCount }}</span>
              </template>
            </el-table-column>
            <el-table-column
              prop="replyCount"
              label="回复数"
              width="120"
              align="right"
            >
              <template #default="{ row }">
                <span class="font-bold text-green-500">{{
                  row.replyCount
                }}</span>
              </template>
            </el-table-column>
          </el-table>
          <div
            v-if="!topCourses.length"
            class="flex flex-col items-center justify-center py-8 text-gray-400"
          >
            <el-empty :image-size="60" description="暂无热门课程数据" />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 审计日志 -->
    <el-card shadow="never" class="!rounded-2xl border-none">
      <template #header>
        <div class="flex justify-between items-center">
          <div class="flex items-center">
            <div
              class="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center mr-3"
            >
              <el-icon class="text-purple-500" :size="18"
                ><Operation
              /></el-icon>
            </div>
            <div>
              <span class="font-bold">全平台操作审计日志</span>
            </div>
          </div>
          <el-tag type="warning" effect="plain" round
            >共 {{ total }} 条记录</el-tag
          >
        </div>
      </template>

      <!-- 搜索栏 -->
      <div class="audit-search-panel">
        <el-form
          :inline="!isMobile"
          :label-position="isMobile ? 'top' : 'right'"
          :model="queryForm"
          class="search-form audit-search-form"
        >
          <el-form-item label="目标类型">
            <el-select
              v-model="queryForm.targetType"
              placeholder="全部类型"
              clearable
              :class="isMobile ? '' : '!w-[120px]'"
            >
              <el-option label="帖子" value="post" />
              <el-option label="回复" value="reply" />
              <el-option label="举报" value="report" />
            </el-select>
          </el-form-item>
          <el-form-item label="操作动作">
            <el-input
              v-model="queryForm.action"
              placeholder="审批/删除等"
              clearable
              :class="isMobile ? '' : '!w-[140px]'"
            />
          </el-form-item>
          <el-form-item label="时间范围">
            <el-date-picker
              v-model="timeRange"
              type="datetimerange"
              range-separator="至"
              start-placeholder="开始时间"
              end-placeholder="结束时间"
              value-format="YYYY-MM-DD HH:mm:ss"
              :class="isMobile ? 'audit-search-form__range' : '!w-[360px]'"
            />
          </el-form-item>
          <el-form-item class="search-form__action-item">
            <div class="search-form__actions">
              <el-button type="primary" :icon="Search" @click="handleSearch">
                搜索
              </el-button>
              <el-button :icon="Refresh" @click="handleReset">重置</el-button>
            </div>
          </el-form-item>
        </el-form>
      </div>

      <div v-if="isMobile" v-loading="auditLoading" class="audit-log-list">
        <div v-for="row in auditLogs" :key="row.id" class="audit-log-card">
          <div class="audit-log-card__header">
            <div class="audit-log-card__title">
              <el-tag
                :type="row.targetType === 'post' ? 'primary' : 'success'"
                effect="light"
                size="small"
              >
                {{ getTargetTypeText(row.targetType) }}
              </el-tag>
              <span class="audit-log-card__id">#{{ row.targetId }}</span>
            </div>
            <span class="audit-log-card__time">
              {{ new Date(row.createTime).toLocaleString() }}
            </span>
          </div>

          <div class="audit-log-card__operator">
            <el-avatar
              :size="32"
              class="bg-gradient-to-br from-blue-400 to-purple-500"
            >
              {{ row.operatorName?.charAt(0) }}
            </el-avatar>
            <div class="audit-log-card__operator-copy">
              <div class="audit-log-card__operator-name">
                {{ row.operatorName }}
              </div>
              <div class="audit-log-card__operator-meta">
                <span>ID: {{ row.operatorId }}</span>
                <el-tag
                  size="small"
                  :type="getOperatorRoleType(row.operatorRole)"
                  effect="plain"
                  round
                >
                  {{ getOperatorRoleText(row.operatorRole) }}
                </el-tag>
              </div>
            </div>
          </div>

          <div class="audit-log-card__body">
            <div class="audit-log-card__row">
              <span class="label">操作动作</span>
              <span class="value text-blue-600 dark:text-blue-400">
                {{ row.action }}
              </span>
            </div>
            <div class="audit-log-card__row">
              <span class="label">状态变化</span>
              <div class="audit-log-card__status">
                <span class="audit-log-card__status-from">
                  {{ row.previousStatus || "无" }}
                </span>
                <el-icon class="text-gray-300"><TrendCharts /></el-icon>
                <span class="audit-log-card__status-to">
                  {{ row.newStatus || "无" }}
                </span>
              </div>
            </div>
            <div class="audit-log-card__row audit-log-card__row--full">
              <span class="label">操作原因</span>
              <span class="value">{{ row.reason || "-" }}</span>
            </div>
          </div>
        </div>

        <el-empty
          v-if="!auditLoading && auditLogs.length === 0"
          description="暂无审计日志"
        />
      </div>

      <el-table
        v-else
        v-loading="auditLoading"
        :data="auditLogs"
        border
        stripe
        style="width: 100%"
        class="!rounded-xl overflow-hidden"
      >
        <el-table-column prop="id" label="ID" width="80" align="center">
          <template #default="{ row }">
            <span class="text-xs text-gray-400">#{{ row.id }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="操作时间" width="180">
          <template #default="{ row }">
            <div class="flex items-center text-xs">
              <el-icon class="mr-1.5 text-blue-400"><Timer /></el-icon>
              {{ new Date(row.createTime).toLocaleString() }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作者" width="200">
          <template #default="{ row }">
            <div class="flex items-center">
              <el-avatar
                :size="28"
                class="mr-2 bg-gradient-to-br from-blue-400 to-purple-500"
              >
                {{ row.operatorName?.charAt(0) }}
              </el-avatar>
              <div class="flex flex-col">
                <span class="font-bold text-xs">{{ row.operatorName }}</span>
                <span class="text-[10px] text-gray-400"
                  >ID: {{ row.operatorId }}</span
                >
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="operatorRole" label="身份角色" width="100">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="getOperatorRoleType(row.operatorRole)"
              effect="plain"
              round
            >
              {{ getOperatorRoleText(row.operatorRole) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="目标对象" width="160">
          <template #default="{ row }">
            <div class="flex items-center">
              <el-tag
                :type="row.targetType === 'post' ? 'primary' : 'success'"
                effect="light"
                size="small"
                class="mr-2"
              >
                {{ getTargetTypeText(row.targetType) }}
              </el-tag>
              <span class="text-xs text-gray-400">#{{ row.targetId }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="action" label="操作动作" width="120">
          <template #default="{ row }">
            <span class="font-medium text-blue-600 dark:text-blue-400">{{
              row.action
            }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态变化" width="240">
          <template #default="{ row }">
            <div class="flex items-center gap-2 overflow-hidden">
              <span
                class="truncate text-[11px] px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-500 max-w-[80px]"
                >{{ row.previousStatus || "无" }}</span
              >
              <el-icon class="text-gray-300 flex-shrink-0"
                ><TrendCharts
              /></el-icon>
              <span
                class="truncate text-[11px] px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded max-w-[80px]"
                >{{ row.newStatus || "无" }}</span
              >
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="reason"
          label="操作原因"
          min-width="180"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span class="text-gray-600 dark:text-gray-300">{{
              row.reason || "-"
            }}</span>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-bar">
        <el-pagination
          v-model:current-page="queryForm.pageNum"
          v-model:page-size="queryForm.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :layout="paginationLayout"
          :size="isMobile ? 'small' : 'default'"
          :total="total"
          background
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.statistics-container {
  max-width: 1600px;
  margin: 0 auto;
}

.statistics-toolbar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
}

.statistics-toolbar__select {
  width: 200px;
}

.statistics-toolbar__button {
  min-height: 42px;
  padding-inline: 18px;
  font-weight: 600;
  border-radius: 14px;
}

.section-heading {
  display: flex;
  align-items: center;
}

.section-heading__bar {
  width: 6px;
  height: 20px;
  margin-right: 12px;
  border-radius: 999px;
}

.section-heading__bar--blue {
  background: linear-gradient(to bottom, #3b82f6, #60a5fa);
}

.section-heading__bar--warm {
  background: linear-gradient(to bottom, #f97316, #ef4444);
}

.statistics-section-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats-grid {
  display: grid;
  gap: 16px;
}

.stats-grid--content {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.stats-grid--compact {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.stat-card-modern {
  backdrop-filter: blur(10px);
  padding: 16px;
  border-radius: 20px;
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.stat-card-modern--large {
  padding: 20px;
}

.stat-card-modern__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.stat-card-modern__copy {
  min-width: 0;
  flex: 1;
}

.stat-card-modern__label-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.stat-card-modern__label {
  font-size: 14px;
  font-weight: 600;
  color: rgb(107 114 128);
}

.stat-card-modern__label--sm {
  font-size: 12px;
}

.stat-card-modern__value {
  font-weight: 800;
  letter-spacing: -0.02em;
}

.stat-card-modern__value--large {
  font-size: 40px;
  line-height: 1;
}

.stat-card-modern__value--sm {
  margin-top: 6px;
  font-size: 34px;
  line-height: 1;
}

.stat-card-modern__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 20px;
  box-shadow: 0 8px 20px rgb(15 23 42 / 8%);
}

.stat-card-modern__icon--large {
  width: 56px;
  height: 56px;
}

.stat-card-modern__icon--sm {
  width: 44px;
  height: 44px;
  border-radius: 16px;
}

.stat-card-modern__flag {
  position: absolute;
  top: 10px;
  right: 10px;
}

.pending-card {
  backdrop-filter: blur(10px);
  padding: 20px;
  border-radius: 20px;
  position: relative;
  overflow: hidden;
}

.pending-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.pending-card__ornament {
  position: absolute;
  right: -16px;
  bottom: -16px;
  width: 96px;
  height: 96px;
  border-radius: 999px;
  opacity: 0.1;
}

.pending-card__content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.pending-card__main {
  display: flex;
  align-items: center;
  min-width: 0;
}

.pending-card__icon {
  width: 48px;
  height: 48px;
  margin-right: 16px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.pending-card__copy {
  min-width: 0;
}

.pending-card__title {
  margin-bottom: 4px;
  font-size: 15px;
  font-weight: 700;
}

.pending-card__tip {
  font-size: 12px;
  line-height: 1.5;
  color: rgb(107 114 128);
}

.pending-card__count {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
}

.pending-card__count-value {
  font-size: 40px;
  font-weight: 900;
  line-height: 1;
}

.pending-card__count-label {
  margin-top: 4px;
  font-size: 11px;
  color: rgb(156 163 175);
}

.top-course-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.top-course-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid rgb(226 232 240 / 88%);
  border-radius: 16px;
  background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
}

.top-course-card__rank {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #3b82f6, #60a5fa);
}

.top-course-card__content {
  min-width: 0;
  flex: 1;
}

.top-course-card__name {
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
  word-break: break-word;
}

.top-course-card__meta {
  display: flex;
  gap: 14px;
  margin-top: 6px;
  font-size: 12px;
  color: #64748b;
}

.audit-search-panel {
  padding: 20px;
  margin-bottom: 28px;
  border-radius: 20px;
  background: rgb(248 250 252);
}

.audit-log-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.audit-log-card {
  padding: 16px;
  border: 1px solid rgb(226 232 240 / 88%);
  border-radius: 18px;
  background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
}

.audit-log-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.audit-log-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.audit-log-card__id {
  font-size: 12px;
  color: #94a3b8;
}

.audit-log-card__time {
  font-size: 12px;
  color: #94a3b8;
  text-align: right;
}

.audit-search-form {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 0;
}

.audit-log-card__operator {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
}

.audit-log-card__operator-copy {
  min-width: 0;
  flex: 1;
}

.audit-log-card__operator-name {
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
}

.audit-log-card__operator-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  font-size: 12px;
  color: #64748b;
}

.audit-log-card__body {
  display: grid;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgb(226 232 240 / 88%);
}

.audit-log-card__row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.audit-log-card__row .label {
  font-size: 12px;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 0.04em;
}

.audit-log-card__row .value {
  font-size: 14px;
  line-height: 1.6;
  color: #334155;
  word-break: break-word;
}

.audit-log-card__status {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.audit-log-card__status-from,
.audit-log-card__status-to {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
}

.audit-log-card__status-from {
  color: #6b7280;
  background: rgb(243 244 246);
}

.audit-log-card__status-to {
  color: #2563eb;
  background: rgb(239 246 255);
}

:deep(.el-card__header) {
  border-bottom: 1px solid var(--el-border-color-lighter);
  padding: 16px 20px;
}

:deep(.el-table) {
  --el-table-header-bg-color: var(--el-fill-color-light);
  font-size: 13px;
}

:deep(.el-table th.el-table__cell) {
  background-color: var(--el-fill-color-lighter);
  font-weight: 600;
}

.search-form {
  :deep(.el-form-item) {
    margin-bottom: 0;
    margin-right: 20px;
  }
}

.search-form__action-item {
  :deep(.el-form-item__content) {
    width: 100%;
  }
}

.search-form__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.search-form__actions :deep(.el-button) {
  margin-left: 0;
}

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
}

@media (width <= 768px) {
  .statistics-container {
    padding-bottom: calc(
      var(--pure-mobile-tab-height) + var(--pure-safe-area-bottom) + 28px
    );
  }

  .statistics-toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .statistics-toolbar__select,
  .statistics-toolbar__button {
    width: 100%;
  }

  .charts-grid,
  .insights-grid {
    row-gap: 18px;
  }

  .stats-grid--content,
  .pending-grid {
    grid-template-columns: 1fr;
  }

  .stats-grid--compact {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stat-card-modern--large .stat-card-modern__value--large {
    font-size: 34px;
  }

  .pending-card {
    padding: 18px;
  }

  .pending-card__content {
    align-items: flex-start;
    flex-direction: column;
  }

  .pending-card__count {
    align-items: flex-start;
  }

  .audit-search-panel {
    padding: 20px 16px;
    margin-bottom: 24px;
    border-radius: 22px;
  }

  .search-form {
    :deep(.el-form-item) {
      width: 100%;
      margin-right: 0;
      margin-bottom: 18px;
    }

    :deep(.el-form-item__label) {
      padding: 0 0 10px;
      line-height: 1.25;
      font-weight: 700;
      font-size: 15px;
      text-align: left;
      justify-content: flex-start;
    }

    :deep(.el-form-item__content) {
      width: 100%;
    }

    :deep(.el-input),
    :deep(.el-select),
    :deep(.el-date-editor) {
      width: 100% !important;
    }
  }

  .audit-search-form__range {
    :deep(.el-range-input) {
      font-size: 14px;
    }

    :deep(.el-range-separator) {
      padding: 0 8px;
    }
  }

  .search-form__actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
    gap: 14px;
  }

  .search-form__actions :deep(.el-button) {
    width: 100%;
    min-height: 46px;
    font-weight: 700;
    border-radius: 16px;
  }

  .pagination-bar {
    justify-content: center;
  }

  .audit-log-list {
    gap: 18px;
  }

  .audit-log-card {
    padding: 18px;
    border-radius: 20px;
  }
}

@media (width <= 420px) {
  .stats-grid--compact,
  .search-form__actions {
    grid-template-columns: 1fr;
  }
}

// 动画效果
@keyframes pulse-slow {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.animate-pulse {
  animation: pulse-slow 2s ease-in-out infinite;
}
</style>
