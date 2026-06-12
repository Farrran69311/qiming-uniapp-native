<script setup lang="ts">
import {
  watch,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  type Component
} from "vue";
import * as echarts from "echarts";
import {
  Document,
  TrendCharts,
  Trophy,
  Calendar,
  Clock,
  Edit,
  Coffee,
  ArrowUp,
  ArrowDown
} from "@element-plus/icons-vue";
import CourseHeader from "./CourseHeader.vue";
import {
  type CourseGradeItem,
  type CourseGradesClassComparisonResult,
  type CourseGradesStatisticsResult,
  type CourseScoreResult,
  getCourseGradesList,
  getCourseGradesStatistics,
  getCourseGradesClassComparison
} from "@/api/frontend/course";

defineOptions({
  name: "CourseGrades"
});

// Props
const props = defineProps<{
  visible: boolean;
  currentTheme: string;
  courseScores: CourseScoreResult | null;
  userAvatar: string;
  userNickname: string;
  courseId: number;
}>();

// Emits
defineEmits<{
  (e: "go-back"): void;
  (e: "toggle-theme", event: MouseEvent): void;
  (e: "go-to-account"): void;
  (e: "logout"): void;
}>();

const createEmptyStatistics = (): CourseGradesStatisticsResult => ({
  totalAssignments: 0,
  completedAssignments: 0,
  averageScore: 0,
  highestScore: 0,
  completionRate: 0
});

const createEmptyClassComparison = (): CourseGradesClassComparisonResult => ({
  categories: [],
  personalScores: [],
  classAverages: []
});

// 成绩列表数据（从API获取）
const gradesList = ref<CourseGradeItem[]>([]);

// 统计数据（从API获取）
const statistics = ref<CourseGradesStatisticsResult>(createEmptyStatistics());

// 班级对比数据（从API获取）
const classComparisonData = ref<CourseGradesClassComparisonResult>(
  createEmptyClassComparison()
);

const resetGradesState = () => {
  gradesList.value = [];
  statistics.value = createEmptyStatistics();
  classComparisonData.value = createEmptyClassComparison();
};

const fetchGradesList = async (
  courseId: number
): Promise<CourseGradeItem[]> => {
  try {
    const res = await getCourseGradesList({ courseId });
    return res?.code === 200 && Array.isArray(res?.data?.list)
      ? res.data.list
      : [];
  } catch (error) {
    console.error("获取成绩列表失败:", error);
    return [];
  }
};

const fetchStatistics = async (
  courseId: number
): Promise<CourseGradesStatisticsResult> => {
  try {
    const res = await getCourseGradesStatistics({ courseId });
    return res?.code === 200 && res?.data ? res.data : createEmptyStatistics();
  } catch (error) {
    console.error("获取成绩统计失败:", error);
    return createEmptyStatistics();
  }
};

const fetchClassComparison = async (
  courseId: number
): Promise<CourseGradesClassComparisonResult> => {
  try {
    const res = await getCourseGradesClassComparison({ courseId });
    return res?.code === 200 && res?.data
      ? res.data
      : createEmptyClassComparison();
  } catch (error) {
    console.error("获取班级对比数据失败:", error);
    return createEmptyClassComparison();
  }
};

let latestLoadRequestId = 0;

// 加载状态
const loading = ref(false);

// 加载所有数据
const loadAllData = async () => {
  if (!props.courseId) {
    resetGradesState();
    return;
  }

  const requestId = ++latestLoadRequestId;
  loading.value = true;
  try {
    const [list, stats, comparison] = await Promise.all([
      fetchGradesList(props.courseId),
      fetchStatistics(props.courseId),
      fetchClassComparison(props.courseId)
    ]);

    if (requestId !== latestLoadRequestId) return;

    gradesList.value = list;
    statistics.value = stats;
    classComparisonData.value = comparison;

    await nextTick();
    initAllCharts();
  } finally {
    if (requestId === latestLoadRequestId) {
      loading.value = false;
    }
  }
};

// 获取成绩等级
const getGradeLevel = (score: number) => {
  if (score >= 90)
    return { label: "优秀", type: "success" as const, color: "#67c23a" };
  if (score >= 80)
    return { label: "良好", type: "success" as const, color: "#95d475" };
  if (score >= 70)
    return { label: "中等", type: "warning" as const, color: "#e6a23c" };
  if (score >= 60)
    return { label: "及格", type: "warning" as const, color: "#f0ad4e" };
  return { label: "不及格", type: "danger" as const, color: "#f56c6c" };
};

// 获取作业类型图标
const getAssignmentIcon = (type: string) => {
  const icons: Record<string, Component> = {
    作业: Document,
    考试: Trophy,
    实验: TrendCharts
  };
  return icons[type] || Document;
};

// 滚动到成绩列表
const gradesListCardRef = ref<any>(null);
const gradesListCollapsed = ref(false);
const scrollToGradesList = () => {
  if (gradesListCollapsed.value) {
    gradesListCollapsed.value = false;
  }
  nextTick(() => {
    if (gradesListCardRef.value?.$el) {
      gradesListCardRef.value.$el.scrollIntoView({ behavior: "smooth" });
    }
  });
};

const toggleGradesListCollapsed = () => {
  gradesListCollapsed.value = !gradesListCollapsed.value;
};

const gradesChartRef = ref<HTMLElement | null>(null);
const trendChartRef = ref<HTMLElement | null>(null);
const classChartRef = ref<HTMLElement | null>(null);
const masteryChartRef = ref<HTMLElement | null>(null);

let gradeChartInstance: echarts.ECharts | null = null;
let trendChartInstance: echarts.ECharts | null = null;
let classChartInstance: echarts.ECharts | null = null;
let masteryChartInstance: echarts.ECharts | null = null;

// 初始化成绩占比图表 (Pie)
const initGradesChart = () => {
  if (!gradesChartRef.value || !props.courseScores) {
    gradeChartInstance?.dispose();
    gradeChartInstance = null;
    return;
  }
  if (gradeChartInstance) gradeChartInstance.dispose();
  gradeChartInstance = echarts.init(
    gradesChartRef.value,
    props.currentTheme === "dark" ? "dark" : undefined
  );

  const option = {
    backgroundColor: "transparent",
    title: {
      text: "成绩占比分布",
      left: "center",
      textStyle: {
        fontSize: 14,
        color: props.currentTheme === "dark" ? "#e0e0e0" : "#333"
      }
    },
    tooltip: { trigger: "item", formatter: "{b}: {c}" },
    legend: {
      orient: "horizontal",
      top: 30,
      textStyle: { color: props.currentTheme === "dark" ? "#e0e0e0" : "#333" }
    },
    series: [
      {
        type: "pie",
        radius: ["40%", "70%"],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: props.currentTheme === "dark" ? "#2a2a2a" : "#fff",
          borderWidth: 2
        },
        label: { show: false, position: "center" },
        emphasis: {
          label: { show: true, fontSize: 16, fontWeight: "bold" }
        },
        data: [
          {
            value: props.courseScores.courseScore,
            name: "课时成绩",
            itemStyle: { color: "#97b4f7" }
          },
          {
            value: props.courseScores.workScore,
            name: "作业成绩",
            itemStyle: { color: "#604ffd" }
          },
          {
            value: props.courseScores.examScore,
            name: "考试成绩",
            itemStyle: { color: "#ff6b6b" }
          }
        ]
      }
    ]
  };
  gradeChartInstance.setOption(option);
};

// 初始化成绩趋势图表 (Line)
const initTrendChart = () => {
  if (!trendChartRef.value) {
    trendChartInstance?.dispose();
    trendChartInstance = null;
    return;
  }
  if (trendChartInstance) trendChartInstance.dispose();
  trendChartInstance = echarts.init(
    trendChartRef.value,
    props.currentTheme === "dark" ? "dark" : undefined
  );

  const option = {
    backgroundColor: "transparent",
    title: {
      text: "学习成绩趋势",
      left: "center",
      textStyle: {
        fontSize: 14,
        color: props.currentTheme === "dark" ? "#e0e0e0" : "#333"
      }
    },
    grid: {
      top: 50,
      bottom: 100
    },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: gradesList.value.map(item => item.name),
      axisLabel: {
        color: props.currentTheme === "dark" ? "#a0a0a0" : "#666",
        interval: 0,
        rotate: 45
      }
    },
    yAxis: {
      type: "value",
      max: 100,
      axisLabel: { color: props.currentTheme === "dark" ? "#a0a0a0" : "#666" },
      splitLine: {
        lineStyle: { color: props.currentTheme === "dark" ? "#3e3e3e" : "#eee" }
      }
    },
    dataZoom: [
      {
        type: "slider",
        show: gradesList.value.length > 5,
        start:
          gradesList.value.length > 5
            ? ((gradesList.value.length - 5) / gradesList.value.length) * 100
            : 0,
        end: 100,
        height: 15,
        bottom: 5,
        borderColor: "transparent",
        backgroundColor: props.currentTheme === "dark" ? "#333" : "#f4f4f4",
        fillerColor: "rgba(96, 79, 253, 0.2)",
        handleStyle: { color: "#604ffd" }
      }
    ],
    series: [
      {
        data: gradesList.value.map(item => item.score),
        type: "line",
        smooth: true,
        symbolSize: 8,
        lineStyle: { width: 3, color: "#604ffd" },
        itemStyle: { color: "#604ffd" },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(96, 79, 253, 0.3)" },
            { offset: 1, color: "rgba(96, 79, 253, 0)" }
          ])
        }
      }
    ]
  };
  trendChartInstance.setOption(option);
};

// 初始化班级对比图表 (Bar)
const initClassChart = () => {
  if (!classChartRef.value) {
    classChartInstance?.dispose();
    classChartInstance = null;
    return;
  }
  if (classChartInstance) classChartInstance.dispose();
  classChartInstance = echarts.init(
    classChartRef.value,
    props.currentTheme === "dark" ? "dark" : undefined
  );

  const option = {
    backgroundColor: "transparent",
    title: {
      text: "班级成绩对比",
      left: "center",
      textStyle: {
        fontSize: 14,
        color: props.currentTheme === "dark" ? "#e0e0e0" : "#333"
      }
    },
    grid: {
      top: 70,
      bottom: 100
    },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: {
      top: 30,
      textStyle: { color: props.currentTheme === "dark" ? "#e0e0e0" : "#333" }
    },
    xAxis: {
      type: "category",
      data: classComparisonData.value.categories,
      axisLabel: {
        color: props.currentTheme === "dark" ? "#a0a0a0" : "#666",
        interval: 0,
        rotate: 45
      }
    },
    yAxis: {
      type: "value",
      max: 100,
      axisLabel: { color: props.currentTheme === "dark" ? "#a0a0a0" : "#666" },
      splitLine: {
        lineStyle: { color: props.currentTheme === "dark" ? "#3e3e3e" : "#eee" }
      }
    },
    dataZoom: [
      {
        type: "slider",
        show: classComparisonData.value.categories.length > 5,
        start:
          classComparisonData.value.categories.length > 5
            ? ((classComparisonData.value.categories.length - 5) /
                classComparisonData.value.categories.length) *
              100
            : 0,
        end: 100,
        height: 15,
        bottom: 0,
        borderColor: "transparent",
        backgroundColor: props.currentTheme === "dark" ? "#333" : "#f4f4f4",
        fillerColor: "rgba(64, 158, 255, 0.2)",
        handleStyle: { color: "#97b4f7" }
      }
    ],
    series: [
      {
        name: "个人得分",
        type: "bar",
        data: classComparisonData.value.personalScores,
        itemStyle: { color: "#97b4f7", borderRadius: [4, 4, 0, 0] }
      },
      {
        name: "班级平均",
        type: "bar",
        data: classComparisonData.value.classAverages,
        itemStyle: { color: "#67c23a", borderRadius: [4, 4, 0, 0] }
      }
    ]
  };
  classChartInstance.setOption(option);
};

// 初始化个人雷达图 (Radar)
const initMasteryChart = () => {
  if (!masteryChartRef.value || !props.courseScores) {
    masteryChartInstance?.dispose();
    masteryChartInstance = null;
    return;
  }
  if (masteryChartInstance) masteryChartInstance.dispose();
  masteryChartInstance = echarts.init(
    masteryChartRef.value,
    props.currentTheme === "dark" ? "dark" : undefined
  );

  const option = {
    backgroundColor: "transparent",
    title: {
      text: "个人雷达图",
      left: "center",
      textStyle: {
        fontSize: 14,
        color: props.currentTheme === "dark" ? "#e0e0e0" : "#333"
      }
    },
    radar: {
      indicator: [
        { name: "课时成绩", max: 100 },
        { name: "作业成绩", max: 100 },
        { name: "考试成绩", max: 100 },
        { name: "平均分", max: 100 },
        { name: "完成率", max: 100 }
      ],
      nameGap: 10,
      radius: "60%",
      center: ["50%", "55%"],
      axisName: {
        color: props.currentTheme === "dark" ? "#a0a0a0" : "#666",
        formatter: (name: string) => {
          return name === "课时成绩" ? `{a|${name}}` : name;
        },
        rich: {
          a: {
            padding: [40, 0, 0, 0]
          }
        }
      },
      splitArea: { show: false },
      splitLine: {
        lineStyle: { color: props.currentTheme === "dark" ? "#3e3e3e" : "#eee" }
      }
    },
    series: [
      {
        type: "radar",
        data: [
          {
            value: [
              props.courseScores?.courseScore || 0,
              props.courseScores?.workScore || 0,
              props.courseScores?.examScore || 0,
              statistics.value.averageScore || 0,
              statistics.value.completionRate || 0
            ],
            name: "个人能力",
            itemStyle: { color: "#604ffd" },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: "rgba(96, 79, 253, 0.4)" },
                { offset: 1, color: "rgba(96, 79, 253, 0.1)" }
              ])
            }
          }
        ]
      }
    ]
  };
  masteryChartInstance.setOption(option);
};

const initAllCharts = () => {
  initGradesChart();
  initTrendChart();
  initClassChart();
  initMasteryChart();
};

const refreshCharts = async () => {
  if (!props.visible) return;
  await nextTick();
  initAllCharts();
};

// 进入成绩页时加载数据
watch(
  () => props.visible,
  async visible => {
    if (visible) {
      await loadAllData();
    }
  },
  { immediate: true }
);

// 监听 courseId 变化
watch(
  () => props.courseId,
  async newId => {
    if (newId && props.visible) {
      await loadAllData();
    } else if (!newId) {
      resetGradesState();
    }
  }
);

// 课程分数和主题变化时只刷新图表，不重复请求接口
watch(
  () => [props.currentTheme, props.courseScores],
  () => {
    refreshCharts();
  },
  { deep: true }
);

const handleResize = () => {
  gradeChartInstance?.resize();
  trendChartInstance?.resize();
  classChartInstance?.resize();
  masteryChartInstance?.resize();
};

onMounted(async () => {
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  gradeChartInstance?.dispose();
  trendChartInstance?.dispose();
  classChartInstance?.dispose();
  masteryChartInstance?.dispose();
});
</script>

<template>
  <div v-show="visible" class="course-grades-wrapper" :class="currentTheme">
    <!-- 头部 -->
    <CourseHeader
      :current-theme="currentTheme"
      title="课程成绩"
      :user-avatar="userAvatar"
      :user-nickname="userNickname"
      @go-back="$emit('go-back')"
      @toggle-theme="e => $emit('toggle-theme', e)"
      @go-to-account="$emit('go-to-account')"
      @logout="$emit('logout')"
    />

    <div class="course-grades-container" :class="currentTheme">
      <div class="grades-content">
        <!-- 核心成绩指标卡片 -->
        <div class="grades-cards reveal-up" style="--reveal-delay: 0.05s">
          <div class="grades-card" :class="currentTheme">
            <div class="grades-card-header">
              <el-icon><Edit /></el-icon>
              <h3>课时成绩</h3>
            </div>
            <div class="grades-card-content">
              <div v-if="courseScores" class="grades-score">
                {{ courseScores.courseScore || 0 }}
              </div>
              <el-skeleton v-else :rows="1" />
            </div>
          </div>

          <div class="grades-card" :class="currentTheme">
            <div class="grades-card-header">
              <el-icon><Document /></el-icon>
              <h3>作业成绩</h3>
            </div>
            <div class="grades-card-content">
              <div v-if="courseScores" class="grades-score">
                {{ courseScores.workScore || 0 }}
              </div>
              <el-skeleton v-else :rows="1" />
            </div>
          </div>

          <div class="grades-card" :class="currentTheme">
            <div class="grades-card-header">
              <el-icon><Coffee /></el-icon>
              <h3>考试成绩</h3>
            </div>
            <div class="grades-card-content">
              <div v-if="courseScores" class="grades-score">
                {{ courseScores.examScore || 0 }}
              </div>
              <el-skeleton v-else :rows="1" />
            </div>
          </div>
        </div>

        <!-- 统计分析卡片区域 -->
        <div
          class="statistics-cards reveal-up"
          :class="currentTheme"
          style="--reveal-delay: 0.15s"
        >
          <el-card class="stat-card" shadow="hover" :class="currentTheme">
            <div class="stat-content">
              <div class="stat-icon total">
                <el-icon :size="32"><Document /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ statistics.totalAssignments }}</div>
                <div class="stat-label">总作业数</div>
              </div>
            </div>
          </el-card>

          <el-card class="stat-card" shadow="hover" :class="currentTheme">
            <div class="stat-content">
              <div class="stat-icon completed">
                <el-icon :size="32"><Trophy /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">
                  {{ statistics.completedAssignments }}
                </div>
                <div class="stat-label">已完成</div>
              </div>
            </div>
          </el-card>

          <el-card class="stat-card" shadow="hover" :class="currentTheme">
            <div class="stat-content">
              <div class="stat-icon average">
                <el-icon :size="32"><TrendCharts /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ statistics.averageScore }}</div>
                <div class="stat-label">平均分</div>
              </div>
            </div>
          </el-card>

          <el-card class="stat-card" shadow="hover" :class="currentTheme">
            <div class="stat-content">
              <div class="stat-icon highest">
                <el-icon :size="32"><Trophy /></el-icon>
              </div>
              <div class="stat-info">
                <div class="stat-value">{{ statistics.highestScore }}</div>
                <div class="stat-label">最高分</div>
              </div>
            </div>
          </el-card>

          <el-card class="stat-card" shadow="hover" :class="currentTheme">
            <div class="stat-content">
              <div class="stat-icon completion">
                <div class="completion-circle">
                  <span>{{ statistics.completionRate }}%</span>
                </div>
              </div>
              <div class="stat-info">
                <div class="stat-label">完成率</div>
              </div>
            </div>
          </el-card>
        </div>

        <!-- 成绩多维分析图表区域 -->
        <div
          class="grades-charts-section reveal-up"
          :class="currentTheme"
          style="--reveal-delay: 0.25s"
        >
          <div class="section-header">
            <h3>成绩多维分析</h3>
            <el-button type="primary" link @click="scrollToGradesList">
              查看全部数据 <el-icon class="el-icon--right"><Clock /></el-icon>
            </el-button>
          </div>
          <div class="charts-grid">
            <div class="chart-item-wrapper" :class="currentTheme">
              <div ref="masteryChartRef" class="grades-chart" />
            </div>
            <div class="chart-item-wrapper" :class="currentTheme">
              <div ref="gradesChartRef" class="grades-chart" />
            </div>
            <div class="chart-item-wrapper" :class="currentTheme">
              <div ref="trendChartRef" class="grades-chart" />
            </div>
            <div class="chart-item-wrapper" :class="currentTheme">
              <div ref="classChartRef" class="grades-chart" />
            </div>
          </div>
        </div>

        <!-- 成绩列表详情 -->
        <el-card
          ref="gradesListCardRef"
          class="grades-list-card reveal-up"
          :class="[currentTheme, { 'is-collapsed': gradesListCollapsed }]"
          shadow="never"
          style="--reveal-delay: 0.35s"
        >
          <template #header>
            <div class="card-header">
              <h3>成绩详情</h3>
              <el-button
                class="collapse-btn"
                type="primary"
                link
                @click="toggleGradesListCollapsed"
              >
                {{ gradesListCollapsed ? "展开" : "收起" }}
                <el-icon class="el-icon--right">
                  <component :is="gradesListCollapsed ? ArrowDown : ArrowUp" />
                </el-icon>
              </el-button>
            </div>
          </template>

          <transition name="slow-collapse">
            <div
              v-show="!gradesListCollapsed"
              class="grades-list-collapse-wrapper"
            >
              <div v-if="gradesList.length === 0" class="empty-state">
                <el-empty description="暂无成绩记录" />
              </div>

              <div v-else class="grades-list" :class="currentTheme">
                <div
                  v-for="(item, index) in gradesList"
                  :key="index"
                  class="grade-item"
                  :style="{ '--row-delay': `${index * 0.04}s` }"
                >
                  <div class="grade-item-header">
                    <div class="item-title">
                      <el-icon class="item-icon" :size="20">
                        <component :is="getAssignmentIcon(item.type)" />
                      </el-icon>
                      <span class="item-name">{{ item.name }}</span>
                      <el-tag
                        v-if="item.type"
                        size="small"
                        class="item-type-tag"
                        effect="plain"
                      >
                        {{ item.type }}
                      </el-tag>
                    </div>
                    <div class="item-score-section">
                      <div v-if="item.score !== null" class="score-display">
                        <div
                          class="score-number"
                          :style="{ color: getGradeLevel(item.score).color }"
                        >
                          {{ item.score }}
                        </div>
                        <div class="score-total">/ 100</div>
                        <el-tag
                          :type="getGradeLevel(item.score).type"
                          size="small"
                          class="grade-tag"
                          effect="dark"
                        >
                          {{ getGradeLevel(item.score).label }}
                        </el-tag>
                      </div>
                      <el-tag v-else type="info" size="small">未评分</el-tag>
                    </div>
                  </div>

                  <div class="grade-item-body">
                    <div class="item-progress">
                      <div class="score-bar-track">
                        <div
                          class="score-bar-fill"
                          :class="getGradeLevel(item.score || 0).type"
                          :style="{
                            width: `${Math.max(0, Math.min(100, item.score || 0))}%`,
                            background: getGradeLevel(item.score || 0).color
                          }"
                        >
                          <span class="score-bar-shine" />
                        </div>
                      </div>
                    </div>
                    <div class="item-meta">
                      <div class="meta-item">
                        <el-icon><Calendar /></el-icon>
                        <span>提交时间: {{ item.submitTime || "未提交" }}</span>
                      </div>
                      <div v-if="item.gradedTime" class="meta-item">
                        <el-icon><Clock /></el-icon>
                        <span>评分时间: {{ item.gradedTime }}</span>
                      </div>
                    </div>
                  </div>

                  <div v-if="item.comment" class="grade-item-footer">
                    <div class="teacher-comment">
                      <div class="comment-label">教师评语:</div>
                      <div class="comment-content">{{ item.comment }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </transition>
        </el-card>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.course-grades-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background-color: transparent;

  &.dark {
    background-color: transparent;
  }
}

.course-grades-container {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 100%;
  padding: 80px 32px 24px;
  overflow-y: auto;
  background-color: transparent;

  &.dark {
    background-color: transparent;
  }
}

.grades-content {
  width: 100%;
  padding: 0;
}

.grades-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.grades-card {
  padding: 24px;
  background-color: #fff;
  border: 1px solid #c6e2ff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgb(64 158 255 / 10%);
  transition: all 0.3s;

  &.dark {
    background-color: #2a2a2a;
    border-color: #3e3e3e;
    box-shadow: 0 2px 6px rgb(0 0 0 / 20%);
  }

  &:hover {
    border-color: #97b4f7;
    box-shadow: 0 8px 24px rgb(64 158 255 / 20%);
    transform: translateY(-5px);
  }

  .grades-card-header {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 20px;

    .el-icon {
      font-size: 24px;
      color: #97b4f7;
    }

    h3 {
      margin: 0;
      font-size: 18px;
      font-weight: bold;
      color: #1a1a1a;
    }
  }

  &.dark .grades-card-header h3 {
    color: #e0e0e0;
  }

  .grades-score {
    font-size: 48px;
    font-weight: 800;
    color: #5f5be3;
    text-align: center;
  }
}

.statistics-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 24px;

  .stat-card {
    border-radius: 12px;
    transition: all 0.3s ease;

    &.dark {
      background-color: #2a2a2a;
      border-color: #3e3e3e;

      .stat-value {
        color: #e0e0e0;
      }

      .stat-label {
        color: #a0a0a0;
      }
    }

    &:hover {
      transform: translateY(-4px);
    }

    :deep(.el-card__body) {
      padding: 20px;
    }
  }

  .stat-content {
    display: flex;
    gap: 16px;
    align-items: center;
  }

  .stat-icon {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 12px;

    &.total {
      color: white;
      background: linear-gradient(135deg, #748ae1 0%, #8263ad 100%);
    }

    &.completed {
      color: white;
      background: linear-gradient(135deg, #e497e5 0%, #e76e80 100%);
    }

    &.average {
      color: white;
      background: linear-gradient(135deg, #63b2f4 0%, #4ccfe6 100%);
    }

    &.highest {
      color: white;
      background: linear-gradient(135deg, #5de092 0%, #5edfc8 100%);
    }

    &.completion {
      color: white;
      background: linear-gradient(135deg, #ee85a7 0%, #f3d45d 100%);
    }
  }

  .completion-circle {
    font-size: 18px;
    font-weight: bold;
  }

  .stat-value {
    font-size: 28px;
    font-weight: bold;
    line-height: 1.2;
    color: #303133;
  }

  .stat-label {
    font-size: 14px;
    color: #909399;
  }
}

.grades-charts-section {
  padding: 24px;
  margin-bottom: 30px;
  background-color: #fff;
  border: 1px solid #c6e2ff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgb(64 158 255 / 10%);

  &.dark {
    background-color: #2a2a2a;
    border-color: #3e3e3e;
    box-shadow: 0 2px 6px rgb(0 0 0 / 20%);

    .section-header h3 {
      color: #e0e0e0;
    }
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 15px;
    margin-bottom: 25px;
    border-bottom: 1px solid #f0f2f5;

    h3 {
      margin: 0;
      font-size: 20px;
      font-weight: bold;
      color: #1a1a1a;
    }
  }

  .charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 20px;

    @media (max-width: 992px) {
      grid-template-columns: 1fr;
    }
  }

  .chart-item-wrapper {
    height: 380px;
    padding: 16px;
    background: #fcfcfd;
    border: 1px solid #f0f2f5;
    border-radius: 8px;

    &.dark {
      background: #333;
      border-color: #444;
    }
  }

  .grades-chart {
    width: 100%;
    height: 100%;
  }
}

.grades-list-card {
  overflow: hidden;
  border: 1px solid #eef1f6;
  border-radius: 16px;
  box-shadow: 0 6px 24px rgb(64 87 158 / 6%);

  :deep(.el-card__header) {
    padding: 20px 24px;
    margin: 0;
    border-bottom: 1px solid #f0f2f5;
  }

  .collapse-btn {
    font-weight: 600;
    transition: all 0.25s ease;

    &:hover {
      transform: translateY(-1px);
    }

    .el-icon--right {
      transition: transform 0.3s ease;
    }
  }

  .grades-list-collapse-wrapper {
    overflow: hidden;
    width: 100%;
  }

  // 自定义缓慢推开动画
  .slow-collapse-enter-active,
  .slow-collapse-leave-active {
    transition:
      max-height 0.7s cubic-bezier(0.4, 0, 0.2, 1),
      opacity 0.5s ease;
    max-height: 2000px; // 足够大的高度以容纳列表
  }

  .slow-collapse-enter-from,
  .slow-collapse-leave-to {
    max-height: 0;
    opacity: 0;
  }

  &.dark {
    background-color: #2a2a2a;
    border-color: #3e3e3e;

    :deep(.el-card__header) {
      border-bottom-color: #3e3e3e;
    }

    .card-header h3 {
      color: #e0e0e0;
    }

    :deep(.el-empty__image img),
    :deep(.el-empty__image svg) {
      opacity: 0.8;
      filter: brightness(0.7);
    }
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    h3 {
      margin: 0;
      font-size: 20px;
      font-weight: bold;
      color: #1a1a1a;
    }
  }

  :deep(.el-card__body) {
    padding: 0;
  }
}

.grades-list {
  &.dark {
    .grade-item {
      border-bottom-color: #3e3e3e;

      &:hover {
        background: #333;
      }

      .item-name {
        color: #e0e0e0;
      }

      .score-total,
      .meta-item {
        color: #a0a0a0;
      }

      .grade-item-footer .teacher-comment {
        color: #cbd5e1;
        background: #2a2a2a;
      }
    }
  }

  .grade-item {
    position: relative;
    padding: 22px 24px;
    border-bottom: 1px solid #eef1f6;
    transition:
      background 0.25s ease,
      box-shadow 0.25s ease,
      transform 0.25s ease;
    opacity: 0;
    animation: gradeRowIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    animation-delay: var(--row-delay, 0s);

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background: linear-gradient(90deg, #f7faff 0%, #fdfdff 100%);
      box-shadow: 0 6px 18px rgb(64 87 158 / 6%);
      transform: translateY(-1px);
    }

    .grade-item-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .item-title {
      display: flex;
      gap: 12px;
      align-items: center;

      .item-name {
        font-size: 16px;
        font-weight: 600;
      }
    }

    .score-display {
      display: flex;
      gap: 4px;
      align-items: baseline;

      .score-number {
        font-size: 32px;
        font-weight: bold;
      }
    }

    .grade-item-body {
      .item-progress {
        margin-bottom: 14px;
      }

      .score-bar-track {
        position: relative;
        width: 100%;
        height: 10px;
        overflow: hidden;
        background: linear-gradient(
          90deg,
          rgba(148, 163, 184, 0.14),
          rgba(148, 163, 184, 0.08)
        );
        border-radius: 999px;
      }

      .score-bar-fill {
        position: relative;
        height: 100%;
        border-radius: 999px;
        background: #97b4f7;
        box-shadow: 0 2px 6px rgb(64 158 255 / 28%);
        animation: scoreBarGrow 0.9s cubic-bezier(0.22, 1, 0.36, 1) both;
        transform-origin: left center;
      }

      .score-bar-shine {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        width: 28px;
        background: linear-gradient(
          90deg,
          rgba(255, 255, 255, 0) 0%,
          rgba(255, 255, 255, 0.55) 50%,
          rgba(255, 255, 255, 0) 100%
        );
        border-radius: 999px;
        opacity: 0.6;
        animation: scoreBarShine 2.4s ease-in-out infinite;
      }

      .item-meta {
        display: flex;
        gap: 24px;
        font-size: 14px;
        color: #666;

        .meta-item {
          display: flex;
          gap: 6px;
          align-items: center;
        }
      }
    }

    .grade-item-footer {
      padding-top: 16px;
      margin-top: 16px;
      border-top: 1px dashed #e4e7ed;

      .teacher-comment {
        padding: 12px 16px;
        background: #f0f9ff;
        border-left: 3px solid #97b4f7;
        border-radius: 4px;

        .comment-label {
          margin-bottom: 4px;
          font-weight: 600;
          color: #97b4f7;
        }
      }
    }
  }
}

@media (max-width: 768px) {
  .course-grades-wrapper {
    min-height: 100vh;
  }

  .course-grades-container {
    align-items: stretch;
    height: auto;
    min-height: 100vh;
    padding: var(--course-mobile-top-offset, 176px) 14px
      calc(24px + env(safe-area-inset-bottom));
    overflow: visible;
  }

  .grades-cards,
  .statistics-cards {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .grades-card,
  .grades-charts-section {
    padding: 18px 16px;
    border-radius: 18px;
  }

  .grades-card {
    .grades-card-header {
      margin-bottom: 16px;

      h3 {
        font-size: 16px;
      }
    }

    .grades-score {
      font-size: 40px;
    }
  }

  .grades-charts-section {
    margin-bottom: 20px;

    .section-header h3 {
      font-size: 18px;
    }

    .charts-grid {
      grid-template-columns: 1fr;
      gap: 16px;
    }

    .chart-item-wrapper {
      height: 320px;
      padding: 12px;
    }
  }

  .grade-item-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .grades-list {
    .grade-item {
      padding: 18px 16px;
    }
  }
}

@media (max-width: 479px) {
  .course-grades-container {
    padding: var(--course-mobile-top-offset, 176px) 10px
      calc(20px + env(safe-area-inset-bottom));
  }

  .grades-cards,
  .statistics-cards {
    gap: 14px;
  }

  .grades-card,
  .grades-charts-section {
    padding: 16px 14px;
    border-radius: 16px;
  }

  .grades-card {
    .grades-card-header {
      gap: 10px;

      h3 {
        font-size: 15px;
      }
    }

    .grades-score {
      font-size: 34px;
    }
  }

  .statistics-cards {
    .stat-card {
      :deep(.el-card__body) {
        padding: 16px 14px;
      }
    }

    .stat-content {
      gap: 12px;
    }

    .stat-icon {
      width: 52px;
      height: 52px;
    }

    .stat-value {
      font-size: 24px;
    }

    .stat-label {
      font-size: 13px;
    }
  }

  .grades-charts-section {
    .section-header h3,
    .card-header h3 {
      font-size: 16px;
    }

    .chart-item-wrapper {
      height: 280px;
      padding: 10px;
    }
  }

  .grades-list {
    .grade-item {
      padding: 16px 14px;

      .item-title {
        gap: 10px;
      }

      .score-display .score-number {
        font-size: 28px;
      }

      .grade-item-body .item-meta {
        gap: 8px;
        flex-direction: column;
      }
    }
  }
}

.reveal-up {
  opacity: 0;
  transform: translateY(14px);
  animation: revealUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: var(--reveal-delay, 0s);
}

@keyframes revealUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes gradeRowIn {
  0% {
    opacity: 0;
    transform: translateY(8px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes scoreBarGrow {
  0% {
    transform: scaleX(0);
  }
  100% {
    transform: scaleX(1);
  }
}

@keyframes scoreBarShine {
  0% {
    transform: translateX(-30px);
    opacity: 0;
  }
  40% {
    opacity: 0.6;
  }
  100% {
    transform: translateX(8px);
    opacity: 0;
  }
}
</style>
