<script setup lang="ts">
import { onMounted, ref, watch, computed, nextTick } from "vue";
import { useDark, useECharts, useResizeObserver } from "@pureadmin/utils";
import { message } from "@/utils/message";
import ClipboardIcon from "@/assets/new-release/clipboard-note-document-report-paper-list-data-svgrepo-com.svg?component";
import { utils, writeFile } from "xlsx";
import {
  getCourseUsersProgress,
  getCourseUsersExamInfo
} from "@/api/statistics";
import { getCourseList } from "@/api/course";
import {
  ElPagination,
  ElSelect,
  ElOption,
  ElButton,
  ElRadioGroup,
  ElRadioButton
} from "element-plus";

interface CourseOption {
  value: number;
  label: string;
}

interface ExamOption {
  value: number;
  label: string;
  examId: number;
  examName: string;
}

const loading = ref(true);
const progressLoading = ref(false);
const examLoading = ref(false);
const courseLoadError = ref("");
const progressLoadError = ref("");
const examLoadError = ref("");
const courseOptions = ref<CourseOption[]>([]);
const examOptions = ref<ExamOption[]>([]);
const selectedCourse = ref<number>();
const selectedExam = ref<number>();

// 进度排序与分页
const progressSortOrder = ref<"none" | "asc" | "desc">("none");
const progressPage = ref(1);
const progressPageSize = ref(10);

// 缓存所有课程的数据
const allProgressData = ref<any[]>([]);
const allExamData = ref<any[]>([]);

const progressChartRef = ref();
const examChartRef = ref();

const { isDark } = useDark();
const theme = computed(() => (isDark.value ? "dark" : "light"));

const { setOptions: setProgressOptions, resize: resizeProgressChart } =
  useECharts(progressChartRef, {
    theme
  });

const { setOptions: setExamOptions, resize: resizeExamChart } = useECharts(
  examChartRef,
  {
    theme
  }
);

useResizeObserver(progressChartRef, () => resizeProgressChart(), {
  time: 80
});
useResizeObserver(examChartRef, () => resizeExamChart(), {
  time: 80
});

const handleExport = () => {
  if (!selectedCourse.value) {
    message("请先选择课程", { type: "warning" });
    return;
  }

  const course = courseOptions.value.find(
    c => c.value === selectedCourse.value
  );
  const courseName = course?.label || "课程";

  // 1. 学生进度数据
  const progressData = sortedUsers.value.map(user => ({
    学生姓名: user.userName,
    "完成百分比(%)": user.progress
  }));

  // 2. 成绩分布数据
  const courseExamData = allExamData.value.filter(
    item => Number(item.courseId) === Number(selectedCourse.value)
  );

  const examRows: Array<Record<string, string | number>> = [];
  const levelTexts = { 1: "差", 2: "中等", 3: "良好", 4: "优秀" };

  courseExamData.forEach(exam => {
    (Array.isArray(exam.examInfo) ? exam.examInfo : []).forEach(info => {
      examRows.push({
        考核项目: exam.examName,
        成绩等级: levelTexts[info.level] || `等级${info.level}`,
        学生人数: info.levelNum
      });
    });
  });

  if (progressData.length === 0 && examRows.length === 0) {
    message("当前课程暂无可导出的分析数据", { type: "warning" });
    return;
  }

  try {
    const wb = utils.book_new();
    const ws1 = utils.json_to_sheet(progressData);
    const ws2 = utils.json_to_sheet(examRows);

    utils.book_append_sheet(wb, ws1, "学生进度详情");
    utils.book_append_sheet(wb, ws2, "成绩分布统计");

    writeFile(wb, `${courseName}_分析报告_${new Date().getTime()}.xlsx`);
    message("导出分析报告成功", { type: "success" });
  } catch (error) {
    console.error("导出分析报告失败:", error);
    message("分析报告导出失败，请重试", { type: "error" });
  }
};

// 获取课程列表
const fetchCourseList = async () => {
  courseLoadError.value = "";
  loading.value = true;
  try {
    const res = await getCourseList({ pageNum: 1, pageSize: 100 });
    if (res?.code !== 200 || !Array.isArray(res.data?.courseList)) {
      throw new Error(res?.msg || "课程列表接口未返回有效数据");
    }
    courseOptions.value = res.data.courseList.map(course => ({
      value: course.courseId,
      label: course.title
    }));
    selectedCourse.value = courseOptions.value[0]?.value;
  } catch (error) {
    console.error("获取课程列表失败:", error);
    courseOptions.value = [];
    selectedCourse.value = undefined;
    courseLoadError.value = "课程列表暂时无法加载";
  } finally {
    loading.value = false;
  }
};

// 获取所有课程数据（每次进入调用）
const fetchAllData = async () => {
  progressLoadError.value = "";
  examLoadError.value = "";
  progressLoading.value = true;
  examLoading.value = true;
  try {
    const [progressRes, examRes] = await Promise.allSettled([
      getCourseUsersProgress(),
      getCourseUsersExamInfo()
    ]);

    if (progressRes.status === "fulfilled") {
      const progressData =
        progressRes.value.data?.courseUsersProgress ??
        progressRes.value.data?.list;
      if (progressRes.value.code === 200 && Array.isArray(progressData)) {
        allProgressData.value = progressData;
      } else {
        allProgressData.value = [];
        progressLoadError.value = "学生进度暂时无法加载";
      }
    } else {
      console.error("获取进度数据失败:", progressRes.reason);
      allProgressData.value = [];
      progressLoadError.value = "学生进度暂时无法加载";
    }

    if (examRes.status === "fulfilled") {
      const examData =
        examRes.value.data?.courseUsersExamInfoList ??
        examRes.value.data?.courseUsersExamInfo ??
        examRes.value.data?.list;
      if (examRes.value.code === 200 && Array.isArray(examData)) {
        allExamData.value = examData;
      } else {
        allExamData.value = [];
        examLoadError.value = "考试成绩暂时无法加载";
      }
    } else {
      console.error("获取考试数据失败:", examRes.reason);
      allExamData.value = [];
      examLoadError.value = "考试成绩暂时无法加载";
    }
  } catch (error) {
    console.error("获取课程数据中发生错误:", error);
    progressLoadError.value = "学生进度暂时无法加载";
    examLoadError.value = "考试成绩暂时无法加载";
  } finally {
    progressLoading.value = false;
    examLoading.value = false;
    if (selectedCourse.value) {
      nextTick(() => {
        renderCourseData(selectedCourse.value);
      });
    }
  }
};

// 根据选择的课程ID渲染对应的数据
const renderCourseData = (courseId: number) => {
  try {
    if (!progressLoadError.value) {
      const progressData = allProgressData.value.find(
        item => Number(item.courseId) === Number(courseId)
      );
      if (progressData) {
        renderProgressChart(progressData);
      } else {
        renderEmptyProgressChart("该课程暂无学生进度数据");
      }
    }

    const courseExamData = allExamData.value.filter(
      item => Number(item.courseId) === Number(courseId)
    );
    if (!examLoadError.value && courseExamData.length > 0) {
      // 更新考试选项
      examOptions.value = courseExamData.map(item => ({
        value: item.examId,
        label: item.examName,
        examId: item.examId,
        examName: item.examName
      }));

      // 默认选择第一个考试
      if (examOptions.value.length > 0) {
        selectedExam.value = examOptions.value[0].value;
        const selectedExamData = courseExamData.find(
          item => Number(item.examId) === Number(selectedExam.value)
        );
        if (selectedExamData) {
          renderExamChart(selectedExamData);
        }
      }
    } else if (!examLoadError.value) {
      examOptions.value = [];
      selectedExam.value = undefined;
      renderEmptyExamChart("该课程暂无考试成绩数据");
    }
  } catch (error) {
    console.error("渲染课程数据失败:", error);
    renderEmptyProgressChart();
    renderEmptyExamChart();
  } finally {
    progressLoading.value = false;
    examLoading.value = false;
  }
};

// 根据选择的考试渲染考试图表
const renderSelectedExamChart = (examId: number) => {
  if (!selectedCourse.value || !examId) return;

  const courseExamData = allExamData.value.filter(
    item => Number(item.courseId) === Number(selectedCourse.value)
  );
  const selectedExamData = courseExamData.find(
    item => Number(item.examId) === Number(examId)
  );

  if (selectedExamData) {
    renderExamChart(selectedExamData);
  } else {
    renderEmptyExamChart("该考试暂无成绩数据");
  }
};

// 获取当前选中课程的全部学生进度
const currentCourseUsers = computed(() => {
  if (!selectedCourse.value) return [];
  const courseData = allProgressData.value.find(
    item => Number(item.courseId) === Number(selectedCourse.value)
  );
  return courseData?.usersProgress || [];
});

// 排序后的学生数据
const sortedUsers = computed(() => {
  const users = [...currentCourseUsers.value];
  if (progressSortOrder.value === "asc") {
    return users.sort((a, b) => Number(a.progress) - Number(b.progress));
  } else if (progressSortOrder.value === "desc") {
    return users.sort((a, b) => Number(b.progress) - Number(a.progress));
  }
  return users;
});

const hasExportData = computed(() => {
  if (sortedUsers.value.length > 0) return true;
  if (!selectedCourse.value) return false;
  return allExamData.value.some(
    item =>
      Number(item.courseId) === Number(selectedCourse.value) &&
      Array.isArray(item.examInfo) &&
      item.examInfo.length > 0
  );
});

// 分页后的学生数据
const pagedUsers = computed(() => {
  const start = (progressPage.value - 1) * progressPageSize.value;
  return sortedUsers.value.slice(start, start + progressPageSize.value);
});

// 监听状态变化重新渲染图表
watch([pagedUsers, progressSortOrder], () => {
  if (progressLoading.value) return;
  if (pagedUsers.value.length > 0) {
    updateProgressChart(pagedUsers.value);
  } else {
    renderEmptyProgressChart("暂无数据");
  }
});

// 渲染学生进度图表（改名为 updateProgressChart，接收已处理的数据）
const updateProgressChart = users => {
  const userNames = users.map(user => user.userName);
  const progressData = users.map(user => user.progress);

  setProgressOptions({
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "shadow"
      }
    },
    grid: {
      left: 20,
      right: 60, // 增加右侧间距以显示百分比文字
      top: 20,
      bottom: 20,
      containLabel: true
    },
    xAxis: {
      type: "value",
      name: "完成进度(%)",
      max: 100,
      axisLabel: {
        formatter: "{value}%",
        color: isDark.value ? "#cbd5e1" : "#64748b"
      },
      splitLine: {
        lineStyle: {
          color: isDark.value ? "#475569" : "#f1f5f9",
          type: "dashed"
        }
      }
    },
    yAxis: {
      type: "category",
      data: userNames,
      axisLabel: {
        fontSize: 12,
        color: isDark.value ? "#fafafa" : "#475569"
      },
      axisLine: {
        lineStyle: {
          color: isDark.value ? "#475569" : "#e5e7eb"
        }
      }
    },
    series: [
      {
        name: "完成进度",
        type: "bar",
        data: progressData,
        barMaxWidth: 24,
        label: {
          show: true,
          position: "right",
          formatter: "{c}%",
          color: isDark.value ? "#ffffff" : "#4b5563",
          fontWeight: "bold"
        },
        itemStyle: {
          color: function (params) {
            const progress = params.value as number;
            if (progress < 30) return "#E8684A";
            if (progress < 70) return "#F6BD16";
            return "#5B8FF9";
          },
          borderRadius: [0, 6, 6, 0]
        }
      }
    ]
  });
};

// 保持原有的 renderProgressChart 逻辑以初始化加载
const renderProgressChart = courseData => {
  progressPage.value = 1; // 切换课程时重置页码
  if (!courseData.usersProgress || courseData.usersProgress.length === 0) {
    renderEmptyProgressChart("该课程暂无学生进度数据");
    return;
  }
  // 直接使用传入的数据进行渲染，避免 computed 属性的时序问题
  const usersToRender = courseData.usersProgress.slice(
    0,
    progressPageSize.value
  );
  if (usersToRender.length > 0) {
    updateProgressChart(usersToRender);
  } else {
    renderEmptyProgressChart("该课程暂无学生进度数据");
  }
};

// 渲染空的进度图表
const renderEmptyProgressChart = (message = "暂无课程进度数据") => {
  setProgressOptions({
    title: {
      text: message,
      left: "center",
      top: "center",
      textStyle: {
        color: isDark.value ? "#52525b" : "#9ca3af",
        fontSize: 14,
        fontWeight: "normal"
      }
    },
    xAxis: { show: false },
    yAxis: { show: false },
    series: []
  });
};

// 渲染考试成绩图表
const renderExamChart = courseData => {
  // 如果有成绩分布数据，显示饼图
  if (courseData.examInfo && courseData.examInfo.length > 0) {
    // 转换等级为文字说明
    const levelTexts = {
      1: "差",
      2: "中等",
      3: "良好",
      4: "优秀"
    };

    const levels = courseData.examInfo.map(
      item => levelTexts[item.level] || `等级${item.level}`
    );
    const counts = courseData.examInfo.map(item => item.levelNum);

    setExamOptions({
      title: {
        text: courseData.examName,
        left: "center",
        top: 10,
        textStyle: {
          fontSize: 16,
          fontWeight: "bold",
          color: isDark.value ? "#ffffff" : "#1e293b"
        }
      },
      tooltip: {
        trigger: "item",
        formatter: "{b}: {c}人 ({d}%)"
      },
      legend: {
        bottom: "5%",
        itemGap: 20,
        data: levels,
        textStyle: {
          color: isDark.value ? "#fafafa" : "#334155",
          fontSize: 13
        }
      },
      series: [
        {
          name: "成绩分布",
          type: "pie",
          radius: ["40%", "65%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 12,
            borderColor: isDark.value ? "#1d1e1f" : "#fff",
            borderWidth: 4
          },
          data: levels.map((level, index) => ({
            name: level,
            value: counts[index],
            itemStyle: {
              color: ["#E8684A", "#F6BD16", "#5B8FF9", "#5AD8A6"][index % 4]
            }
          })),
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: "rgba(0, 0, 0, 0.5)"
            }
          },
          label: {
            show: true,
            formatter: "{b}: {c}人",
            color: isDark.value ? "#ffffff" : "#334155",
            fontSize: 12,
            fontWeight: 500
          },
          labelLine: {
            show: true,
            lineStyle: {
              color: isDark.value ? "#cbd5e1" : "#cbd5e1"
            }
          }
        }
      ]
    });
    return;
  }

  renderEmptyExamChart("该考试暂无成绩数据");
};

// 渲染空的考试图表
const renderEmptyExamChart = (message = "暂无考试成绩数据") => {
  setExamOptions({
    title: {
      text: message,
      left: "center",
      top: "center",
      textStyle: {
        color: isDark.value ? "#52525b" : "#9ca3af",
        fontSize: 14,
        fontWeight: "normal"
      }
    },
    series: []
  });
};

// 课程变化时从缓存中渲染对应数据
watch(
  () => selectedCourse.value,
  newCourseId => {
    if (newCourseId) {
      // 无论是否有数据都尝试渲染，renderCourseData 会处理空数据情况
      renderCourseData(newCourseId);
    }
  }
);

// 考试变化时重新渲染考试图表
watch(
  () => selectedExam.value,
  newExamId => {
    if (newExamId) {
      renderSelectedExamChart(newExamId);
    }
  }
);

// 监听主题变化，重新渲染所有图表
watch(
  () => isDark.value,
  () => {
    if (!loading.value && selectedCourse.value) {
      // 重新渲染进度图表
      if (pagedUsers.value.length > 0) {
        updateProgressChart(pagedUsers.value);
      } else {
        renderEmptyProgressChart();
      }
      // 重新渲染考试图表
      if (selectedExam.value) {
        renderSelectedExamChart(selectedExam.value);
      }
    }
  }
);

const refreshDashboardData = async () => {
  await fetchCourseList();
  await fetchAllData();

  if (selectedCourse.value) {
    await nextTick();
    if (selectedCourse.value) {
      renderCourseData(selectedCourse.value);
    }
  }
};

onMounted(() => {
  void refreshDashboardData();
});
</script>

<template>
  <div class="course-statistics-panel w-full">
    <el-skeleton :loading="loading" animated :rows="1">
      <template #default>
        <div class="flex flex-col gap-6">
          <div
            class="analysis-toolbar flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6 bg-gradient-to-br from-blue-50/60 to-sky-50/40 dark:from-[var(--el-bg-color-overlay)] dark:to-[var(--el-bg-color-overlay)] rounded-2xl border border-blue-100/50 dark:border-blue-500/20 shadow-lg backdrop-blur-md"
          >
            <div
              class="analysis-toolbar-main flex flex-col md:flex-row items-start md:items-center gap-6 flex-1 w-full"
            >
              <div
                class="analysis-toolbar-brand flex items-center gap-4 shrink-0"
              >
                <div
                  class="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-sky-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30"
                >
                  <ClipboardIcon class="w-6 h-6 [&_path]:!fill-white" />
                </div>
                <div class="analysis-brand-copy flex flex-col">
                  <span
                    class="text-xl font-black text-blue-700 dark:text-blue-300 uppercase tracking-wider"
                    >分析课程数据</span
                  >
                  <span
                    class="text-xs text-blue-400 dark:text-blue-300/60 font-medium mt-0.5"
                    >STATISTICS & GROWTH</span
                  >
                </div>
              </div>

              <div
                class="hidden md:block h-12 w-[1px] bg-gradient-to-b from-transparent via-blue-200/50 to-transparent dark:via-blue-500/20 mx-2"
              />

              <div
                class="analysis-toolbar-select flex items-center gap-3 flex-1 w-full max-lg:max-w-none max-w-lg"
              >
                <el-select
                  v-model="selectedCourse"
                  placeholder="请选择需要分析的课程"
                  size="large"
                  class="w-full custom-select-high"
                  :disabled="courseOptions.length === 0"
                >
                  <template #prefix>
                    <IconifyIconOnline
                      icon="ep:reading"
                      class="text-blue-500"
                    />
                  </template>
                  <el-option
                    v-for="item in courseOptions"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </div>
            </div>

            <div
              class="analysis-actions flex items-center gap-3 shrink-0 self-end md:self-auto"
            >
              <el-button
                color="#6366f1"
                size="large"
                :loading="loading || progressLoading || examLoading"
                class="analysis-action-btn !rounded-xl shadow-md shadow-blue-200/50 dark:shadow-none hover:translate-y-[-2px] transition-all"
                @click="refreshDashboardData"
              >
                <template #icon>
                  <IconifyIconOnline icon="ep:refresh" />
                </template>
                刷新
              </el-button>
              <el-button
                type="primary"
                size="large"
                :disabled="!hasExportData"
                class="analysis-action-btn !rounded-xl shadow-md shadow-blue-200/50 dark:shadow-none hover:translate-y-[-2px] transition-all"
                @click="handleExport"
              >
                <template #icon>
                  <IconifyIconOnline icon="ep:download" />
                </template>
                导出分析报告
              </el-button>
            </div>
          </div>

          <div
            v-if="courseLoadError"
            class="analysis-course-state flex min-h-[260px] items-center justify-center"
          >
            <el-empty :description="courseLoadError" :image-size="72">
              <el-button type="primary" plain @click="refreshDashboardData">
                重新加载
              </el-button>
            </el-empty>
          </div>
          <el-empty
            v-else-if="courseOptions.length === 0"
            description="暂无可分析的课程"
            class="analysis-course-state min-h-[260px]"
          />
          <div
            v-else
            class="analysis-panel-grid grid grid-cols-1 md:grid-cols-2 gap-8 mt-4"
          >
            <!-- 课程进度图表 -->
            <div
              v-loading="progressLoading"
              class="analysis-panel relative bg-white dark:bg-[var(--el-bg-color-overlay)] p-6 rounded-3xl border border-gray-100 dark:border-blue-500/10 shadow-sm transition-all hover:shadow-md"
            >
              <div
                class="analysis-panel-header flex justify-between items-center mb-6 px-2"
              >
                <div class="analysis-panel-title flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400"
                  >
                    <IconifyIconOnline icon="ep:user" />
                  </div>
                  <span
                    class="analysis-section-title text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center"
                  >
                    学生个人进度报告
                  </span>
                </div>
                <div class="analysis-panel-tools flex items-center gap-4">
                  <div
                    class="analysis-sort-box flex items-center gap-2 px-2 py-1 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700"
                  >
                    <span class="text-xs text-gray-500 font-medium">排序:</span>
                    <el-radio-group
                      v-model="progressSortOrder"
                      size="small"
                      class="custom-radio-group"
                    >
                      <el-radio-button value="none">默认</el-radio-button>
                      <el-radio-button value="desc">进度降序</el-radio-button>
                      <el-radio-button value="asc">进度升序</el-radio-button>
                    </el-radio-group>
                  </div>
                </div>
              </div>
              <el-empty
                v-if="progressLoadError"
                :description="progressLoadError"
                :image-size="64"
                class="analysis-chart-state"
              >
                <el-button type="primary" plain @click="fetchAllData">
                  重新加载
                </el-button>
              </el-empty>
              <div
                v-show="!progressLoadError"
                ref="progressChartRef"
                class="chart-container progress-chart"
                style="width: 100%"
              />
              <!-- 学生进度分页器 -->
              <div
                v-if="
                  !progressLoadError && sortedUsers.length > progressPageSize
                "
                class="mt-6 flex justify-center"
              >
                <el-pagination
                  v-model:current-page="progressPage"
                  :page-size="progressPageSize"
                  :total="sortedUsers.length"
                  layout="prev, pager, next"
                  class="pure-pagination"
                />
              </div>
            </div>

            <!-- 考试成绩图表 -->
            <div
              v-loading="examLoading"
              class="analysis-panel relative bg-white dark:bg-[var(--el-bg-color-overlay)] p-6 rounded-3xl border border-gray-100 dark:border-blue-500/10 shadow-sm transition-all hover:shadow-md"
            >
              <div
                class="analysis-panel-header flex justify-between items-center mb-6 px-2"
              >
                <div class="analysis-panel-title flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400"
                  >
                    <IconifyIconOnline icon="ep:document-checked" />
                  </div>
                  <span
                    class="analysis-section-title text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center"
                  >
                    成绩分布深度分析
                  </span>
                </div>
                <div class="analysis-panel-tools flex items-center gap-2">
                  <el-select
                    v-model="selectedExam"
                    placeholder="选择考试"
                    size="small"
                    style="width: 140px"
                    class="analysis-exam-select custom-select"
                    :disabled="examOptions.length === 0"
                  >
                    <el-option
                      v-for="item in examOptions"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                </div>
              </div>
              <el-empty
                v-if="examLoadError"
                :description="examLoadError"
                :image-size="64"
                class="analysis-chart-state"
              >
                <el-button type="primary" plain @click="fetchAllData">
                  重新加载
                </el-button>
              </el-empty>
              <div
                v-show="!examLoadError"
                ref="examChartRef"
                class="chart-container exam-chart"
                style="width: 100%"
              />
            </div>
          </div>
        </div>
      </template>
    </el-skeleton>
  </div>
</template>

<style scoped>
.text-glow {
  text-shadow: 0 0 10px rgb(37 99 235 / 20%);
}

:deep(.custom-select-high) {
  .el-input__wrapper {
    padding: 2px 12px;
    background-color: var(--el-bg-color) !important;
    border-radius: 12px !important;
    box-shadow: 0 4px 12px rgb(37 99 235 / 8%) !important;
    backdrop-filter: blur(4px);
    transition: all 0.3s;

    &:hover,
    &.is-focus {
      box-shadow: 0 4px 15px rgb(37 99 235 / 15%) !important;
    }
  }

  .el-input__inner {
    font-weight: 600;
  }
}

.chart-container {
  transition: all 0.3s ease;
}

.progress-chart,
.exam-chart {
  height: 550px;
}

.analysis-chart-state {
  min-height: 550px;
}

:deep(.el-select) {
  --el-select-input-focus-border-color: #2563eb;
}

@media screen and (max-width: 991px) {
  .analysis-toolbar {
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 10px !important;
    padding: 10px !important;
    border-radius: 16px !important;
  }

  .analysis-toolbar-main {
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 10px !important;
  }

  .analysis-toolbar-main,
  .analysis-toolbar-brand,
  .analysis-panel-header,
  .analysis-panel-title,
  .analysis-panel-tools,
  .analysis-sort-box {
    min-width: 0;
  }

  .analysis-toolbar-brand,
  .analysis-brand-copy,
  .analysis-toolbar-select,
  .analysis-actions,
  .analysis-panel-tools {
    width: 100%;
  }

  .analysis-actions {
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
    gap: 8px !important;
    align-self: stretch;
  }

  :deep(.analysis-actions .el-button) {
    width: 100%;
    margin-left: 0;
  }

  .analysis-panel-grid {
    grid-template-columns: minmax(0, 1fr) !important;
    gap: 12px !important;
    margin-top: 0;
  }

  .analysis-panel {
    padding: 8px !important;
    border-radius: 12px !important;
  }

  .analysis-panel-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    padding: 0 !important;
    margin-bottom: 12px !important;
  }

  .analysis-section-title {
    min-width: 0;
    font-size: 17px;
    line-height: 1.45;
    white-space: normal;
  }

  .analysis-sort-box {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 8px !important;
  }

  .analysis-exam-select {
    width: 100% !important;
  }

  .progress-chart,
  .exam-chart {
    height: 360px;
  }

  .analysis-chart-state {
    min-height: 360px;
  }

  :deep(.custom-radio-group) {
    display: flex;
    flex-wrap: wrap;
    width: 100%;
  }

  :deep(.custom-radio-group .el-radio-button__inner) {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 6px 8px;
    font-size: 12px;
    white-space: normal;
  }

  :deep(.custom-radio-group .el-radio-button) {
    flex: 1 1 0;
  }

  :deep(.analysis-action-btn.el-button) {
    min-width: 0;
    min-height: 44px;
    padding: 0 8px;
    transform: none !important;
  }

  :deep(.analysis-exam-select .el-input__wrapper),
  :deep(.analysis-toolbar-select .el-input__wrapper) {
    min-height: 44px;
  }

  :deep(.pure-pagination) {
    flex-wrap: wrap;
    justify-content: center;
  }

  :deep(.pure-pagination .btn-prev),
  :deep(.pure-pagination .btn-next),
  :deep(.pure-pagination .number),
  :deep(.pure-pagination .more) {
    min-width: 44px;
    height: 44px;
    margin: 0;
    line-height: 44px;
  }
}

@media screen and (max-width: 359px) {
  :deep(.pure-pagination .number:not(.is-active)),
  :deep(.pure-pagination .more) {
    display: none;
  }
}
</style>
