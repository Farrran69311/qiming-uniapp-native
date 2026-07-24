<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useDark, useECharts, useResizeObserver } from "@pureadmin/utils";
import { useAppStoreHook } from "@/store/modules/app";
import { getEfficientIndex } from "@/api/statistics";
import { getCourseList } from "@/api/course";
import {
  ElTooltip,
  ElCheckbox,
  ElCheckboxGroup,
  ElDialog,
  ElButton,
  ElPagination
} from "element-plus";
import ChartIcon from "@/assets/new-release/graph-chart-data-analytics-statistic-report-analysis-svgrepo-com.svg?component";

defineOptions({
  name: "EfficientIndex"
});

const loading = ref(true);
const loadError = ref("");
const efficientData = ref<any[]>([]);
const selectedCourses = ref<number[]>([]);
const showOptimizePanel = ref(false); // 默认折叠优化建议面板

const currentPage = ref(1);
const appStore = useAppStoreHook();
const isMobile = computed(() => appStore.getDevice === "mobile");
const pageSize = computed(() => (isMobile.value ? 1 : 5));

const { isDark } = useDark();
const theme = computed(() => (isDark.value ? "dark" : "light"));

const chartRef = ref();
const { setOptions, resize } = useECharts(chartRef, {
  theme
});

useResizeObserver(chartRef, () => resize(), {
  time: 80
});

type ActiveCourseIndex = {
  ready: boolean;
  ids: Set<number>;
  names: Set<string>;
};

const normalizeCourseName = (value: unknown) => String(value ?? "").trim();

const normalizeCourseId = (value: unknown) => {
  const courseId = Number(value);
  return Number.isFinite(courseId) && courseId > 0 ? courseId : null;
};

const readEfficientCourseId = (item: any) =>
  normalizeCourseId(item?.courseId ?? item?.id);

const readEfficientCourseName = (item: any) =>
  normalizeCourseName(item?.courseName ?? item?.title ?? item?.name);

const normalizeDuration = (value: unknown) => {
  const duration = Number(value);
  return Number.isFinite(duration) ? duration : 0;
};

const fetchActiveCourseIndex = async (): Promise<ActiveCourseIndex> => {
  const pageSize = 1000;
  const firstPage = await getCourseList({ pageNum: 1, pageSize });

  if (firstPage?.code !== 200 || !firstPage?.data) {
    throw new Error("获取课程列表失败");
  }

  const firstList = firstPage?.data?.courseList || [];
  const total = firstPage?.data?.total || firstList.length;
  const pageCount = Math.ceil(total / pageSize);
  let courseList = [...firstList];

  if (pageCount > 1) {
    const restPages = await Promise.allSettled(
      Array.from({ length: pageCount - 1 }, (_, index) =>
        getCourseList({ pageNum: index + 2, pageSize })
      )
    );

    if (
      restPages.some(
        result =>
          result.status === "rejected" ||
          result.value?.code !== 200 ||
          !Array.isArray(result.value?.data?.courseList)
      )
    ) {
      throw new Error("课程列表分页加载不完整");
    }

    restPages.forEach(result => {
      if (result.status === "fulfilled") {
        courseList = courseList.concat(result.value.data.courseList);
      }
    });
  }

  return {
    ready: true,
    ids: new Set(
      courseList
        .map(course => normalizeCourseId(course.courseId))
        .filter((courseId): courseId is number => courseId !== null)
    ),
    names: new Set(
      courseList
        .map(course => normalizeCourseName(course.title))
        .filter(Boolean)
    )
  };
};

const normalizeEfficientList = (
  list: any[],
  activeCourses: ActiveCourseIndex
) =>
  list
    .map(item => ({
      ...item,
      courseId: readEfficientCourseId(item) ?? item?.courseId,
      courseName: readEfficientCourseName(item),
      planTime: normalizeDuration(item?.planTime),
      correctPlanTime: normalizeDuration(item?.correctPlanTime),
      planWorkTime: normalizeDuration(item?.planWorkTime),
      correctPlanWorkTime: normalizeDuration(item?.correctPlanWorkTime)
    }))
    .filter(item => {
      if (!item.courseName) return false;
      if (!activeCourses.ready) return true;

      const courseId = readEfficientCourseId(item);
      if (courseId !== null && activeCourses.ids.size > 0) {
        return activeCourses.ids.has(courseId);
      }

      return activeCourses.names.has(item.courseName);
    });

// 获取教学效率指数数据
const fetchData = async () => {
  loadError.value = "";
  loading.value = true;
  try {
    const [efficientResponse, activeCourseResponse] = await Promise.allSettled([
      getEfficientIndex(),
      fetchActiveCourseIndex()
    ]);

    if (efficientResponse.status !== "fulfilled") {
      throw efficientResponse.reason;
    }

    const response = efficientResponse.value;
    if (
      response?.code !== 200 ||
      !Array.isArray(response.data?.efficientIndexList)
    ) {
      throw new Error(response?.msg || "效率评价接口未返回有效数据");
    }
    if (activeCourseResponse.status !== "fulfilled") {
      throw activeCourseResponse.reason;
    }
    const activeCourses = activeCourseResponse.value;

    efficientData.value = normalizeEfficientList(
      response.data.efficientIndexList,
      activeCourses
    );
    // 默认选中所有课程
    selectedCourses.value = efficientData.value.map((_, index) => index);
    currentPage.value = 1;
  } catch (error) {
    console.error("获取教学效率指数数据失败:", error);
    efficientData.value = [];
    selectedCourses.value = [];
    loadError.value = "效率评价指标暂时无法加载";
  } finally {
    loading.value = false;
    await nextTick();
    if (!loadError.value && efficientData.value.length > 0) renderChart();
  }
};

// 过滤后的总数据
const totalFilteredData = computed(() => {
  return selectedCourses.value.map(index => efficientData.value[index]);
});

// 分页后的图表数据
const pagedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return totalFilteredData.value.slice(start, end);
});

// 监听分页和选中项变化重新渲染图表
watch([currentPage, selectedCourses, isMobile], () => {
  renderChart();
});

watch([totalFilteredData, isMobile], () => {
  const totalPages = Math.max(
    1,
    Math.ceil(totalFilteredData.value.length / pageSize.value)
  );
  if (currentPage.value > totalPages) {
    currentPage.value = totalPages;
  }
  if (currentPage.value < 1) {
    currentPage.value = 1;
  }
});

// 渲染图表
const renderChart = () => {
  if (!pagedData.value.length) {
    setOptions({
      xAxis: { data: [] },
      series: []
    });
    return;
  }

  const courseNames = pagedData.value.map(item => item.courseName);
  const planTimeData = pagedData.value.map(item => item.planTime);
  const correctPlanTimeData = pagedData.value.map(item => item.correctPlanTime);
  const planWorkTimeData = pagedData.value.map(item => item.planWorkTime);
  const correctPlanWorkTimeData = pagedData.value.map(
    item => item.correctPlanWorkTime
  );

  setOptions({
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "shadow"
      },
      formatter: params => {
        const idx = params[0].dataIndex;
        const item = pagedData.value[idx];
        let html = `<div style="font-weight:bold">${item.courseName}</div>`;

        params.forEach(param => {
          html += `<div style="display:flex;justify-content:space-between;align-items:center;margin:5px 0">
            <span style="display:inline-block;margin-right:5px;border-radius:50%;width:10px;height:10px;background-color:${param.color}"></span>
            <span>${param.seriesName}：${param.value} 分钟</span>
          </div>`;
        });

        return html;
      }
    },
    legend: {
      type: isMobile.value ? "scroll" : "plain",
      data: ["备课耗时", "备课修正耗时", "作业设计耗时", "作业设计修正耗时"],
      left: 0,
      right: 0,
      bottom: isMobile.value ? 10 : 0,
      itemGap: isMobile.value ? 10 : 20,
      itemWidth: isMobile.value ? 12 : 16,
      itemHeight: isMobile.value ? 8 : 12,
      textStyle: {
        color: isDark.value ? "#fafafa" : "#334155",
        fontSize: isMobile.value ? 11 : 12
      },
      pageTextStyle: {
        color: isDark.value ? "#fafafa" : "#334155"
      }
    },
    grid: {
      top: 40,
      left: 20,
      right: 20,
      bottom: isMobile.value ? 105 : 60,
      containLabel: true
    },
    xAxis: [
      {
        type: "category",
        data: courseNames,
        axisTick: {
          alignWithLabel: true
        },
        axisLabel: {
          fontSize: isMobile.value ? 11 : 12,
          interval: 0,
          color: isDark.value ? "#fafafa" : "#64748b",
          rotate: isMobile.value ? 0 : courseNames.length > 5 ? 30 : 0,
          // 自动换行：每行最多8个字
          formatter: (value: string) => {
            if (courseNames.length > 5) return value;
            const maxPerLine = 8;
            if (!value) return "";
            if (value.length <= maxPerLine) return value;
            const lines: string[] = [];
            for (let i = 0; i < value.length; i += maxPerLine) {
              lines.push(value.slice(i, i + maxPerLine));
            }
            return lines.join("\n");
          }
        },
        axisLine: {
          lineStyle: {
            color: isDark.value ? "#475569" : "#e5e7eb"
          }
        }
      }
    ],
    yAxis: [
      {
        type: "value",
        name: "耗时(分钟)",
        nameTextStyle: {
          color: isDark.value ? "#fafafa" : "#334155",
          padding: [0, 0, 0, 40],
          fontWeight: "bold"
        },
        splitLine: {
          lineStyle: {
            color: isDark.value ? "#475569" : "#f1f5f9",
            type: "dashed"
          }
        },
        axisLabel: {
          fontSize: 11,
          color: isDark.value ? "#cbd5e1" : "#64748b"
        }
      }
    ],
    series: [
      {
        name: "备课耗时",
        type: "bar",
        barMaxWidth: 25,
        itemStyle: {
          color: "#5B8FF9",
          borderRadius: [4, 4, 0, 0]
        },
        data: planTimeData
      },
      {
        name: "备课修正耗时",
        type: "bar",
        barMaxWidth: 25,
        itemStyle: {
          color: "#F6BD16",
          borderRadius: [4, 4, 0, 0]
        },
        data: correctPlanTimeData
      },
      {
        name: "作业设计耗时",
        type: "bar",
        barMaxWidth: 25,
        itemStyle: {
          color: "#5AD8A6",
          borderRadius: [4, 4, 0, 0]
        },
        data: planWorkTimeData
      },
      {
        name: "作业设计修正耗时",
        type: "bar",
        barMaxWidth: 25,
        itemStyle: {
          color: "#E8684A",
          borderRadius: [4, 4, 0, 0]
        },
        data: correctPlanWorkTimeData
      }
    ]
  });
};

// 更新选中的课程
const handleCoursesChange = () => {
  renderChart();
};

// 提供优化建议显示
const optimizeSuggestions = computed(() => {
  return efficientData.value
    .filter(item => item.optimizeDirection?.trim())
    .map(item => ({
      courseName: item.courseName,
      optimizeDirection: item.optimizeDirection,
      expectedEffect: item.expectedEffect,
      difficulty: item.difficulty
    }));
});
const pagedSuggestions = computed(() =>
  pagedData.value.filter(item => item.optimizeDirection?.trim())
);

const dialogVisible = ref(false);
const selectedSuggestion = ref(null);

const showDetails = item => {
  selectedSuggestion.value = item;
  dialogVisible.value = true;
};

// 默认显示优化建议
showOptimizePanel.value = true;

watch(
  () => selectedCourses.value,
  () => {
    renderChart();
  },
  { deep: true }
);

// 监听主题变化，重新渲染图表
watch(
  () => isDark.value,
  () => {
    if (!loading.value && pagedData.value.length > 0) {
      renderChart();
    }
  }
);

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div class="w-full">
    <el-skeleton :loading="loading" animated :rows="6">
      <template #default>
        <el-empty v-if="loadError" :description="loadError" class="py-16">
          <el-button type="primary" plain @click="fetchData">
            重新加载
          </el-button>
        </el-empty>
        <el-empty
          v-else-if="!efficientData.length"
          description="暂无可展示的课程效率指标"
          class="py-16"
        />
        <div v-else class="flex flex-col gap-6">
          <!-- 筛选控制区域 -->
          <div
            class="efficient-filter-panel flex flex-col md:flex-row items-start md:items-center gap-6 p-6 bg-gradient-to-br from-blue-50/60 to-sky-50/40 dark:from-[var(--el-bg-color-overlay)] dark:to-[var(--el-bg-color-overlay)] rounded-2xl border border-blue-100/50 dark:border-blue-500/20 shadow-lg backdrop-blur-md"
          >
            <div
              class="efficient-filter-brand flex items-center gap-4 shrink-0"
            >
              <div
                class="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-sky-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30"
              >
                <ChartIcon class="w-7 h-7 [&_path]:!fill-white" />
              </div>
              <div class="flex flex-col">
                <span
                  class="text-xl font-black text-blue-700 dark:text-blue-300 uppercase tracking-wider"
                  >筛选分析课程</span
                >
                <span
                  class="text-xs text-blue-400 dark:text-blue-300/60 font-medium mt-0.5"
                  >FILTER & ANALYSIS</span
                >
              </div>
            </div>

            <div
              class="hidden md:block h-12 w-[1px] bg-gradient-to-b from-transparent via-blue-200/50 to-transparent dark:via-blue-500/20 mx-2"
            />

            <div class="flex-1 w-full overflow-hidden">
              <el-checkbox-group
                v-model="selectedCourses"
                class="efficient-course-options flex flex-wrap gap-x-10 gap-y-4"
                @change="handleCoursesChange"
              >
                <el-checkbox
                  v-for="(item, index) in efficientData"
                  :key="index"
                  :label="index"
                  size="large"
                >
                  <span
                    class="text-base font-bold text-slate-700 dark:text-slate-200 hover:text-blue-600 transition-colors"
                    >{{ item.courseName }}</span
                  >
                </el-checkbox>
              </el-checkbox-group>
            </div>
          </div>

          <!-- 图表主体 -->
          <div
            class="efficient-chart-panel relative bg-white/50 dark:bg-[var(--el-bg-color-overlay)] p-8 rounded-3xl border border-blue-100/50 dark:border-blue-500/10 shadow-sm"
          >
            <div
              ref="chartRef"
              class="chart-container"
              style="width: 100%; height: 600px"
            />

            <!-- 分页部件 -->
            <div
              v-if="totalFilteredData.length > pageSize"
              class="flex justify-center mt-6"
            >
              <el-pagination
                v-model:current-page="currentPage"
                :page-size="pageSize"
                :total="totalFilteredData.length"
                :pager-count="isMobile ? 5 : 7"
                :size="isMobile ? 'small' : 'default'"
                layout="prev, pager, next"
                class="pure-pagination efficient-pagination"
              />
            </div>
          </div>

          <!-- 智能建议板块 -->
          <div
            v-if="optimizeSuggestions.length && pagedSuggestions.length"
            class="optimize-suggestions mt-4"
          >
            <div class="flex items-center justify-between mb-6">
              <h3
                class="flex items-center text-lg font-bold text-gray-800 dark:text-gray-200"
              >
                <span
                  class="w-2 h-6 bg-gradient-to-b from-blue-500 to-sky-500 rounded-full mr-3"
                />
                AI 提效建议报告
              </h3>
              <el-button
                type="primary"
                plain
                round
                size="small"
                @click="showOptimizePanel = !showOptimizePanel"
              >
                {{ showOptimizePanel ? "关闭报告" : "展开报告" }}
              </el-button>
            </div>

            <el-collapse-transition>
              <div v-show="showOptimizePanel">
                <el-row :gutter="20" class="suggestion-row">
                  <el-col
                    v-for="(item, index) in pagedSuggestions"
                    :key="index"
                    :xs="24"
                    :sm="12"
                    :md="12"
                    class="mb-6"
                  >
                    <div
                      class="suggestion-card-new p-5 h-full flex flex-col justify-between bg-white dark:bg-[var(--el-bg-color-overlay)] border border-slate-100 dark:border-gray-800"
                    >
                      <div>
                        <div class="flex items-center gap-2 mb-4">
                          <div
                            class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400"
                          >
                            <IconifyIconOnline icon="ep:opportunity" />
                          </div>
                          <span
                            class="font-bold text-gray-800 dark:text-gray-200 truncate"
                            >{{ item.courseName }}</span
                          >
                        </div>
                        <p
                          class="text-sm text-gray-500 dark:text-gray-400 line-clamp-4 leading-relaxed italic mb-4"
                        >
                          "{{ item.optimizeDirection }}"
                        </p>
                      </div>
                      <div
                        class="flex justify-end pt-3 border-t border-gray-50 dark:border-gray-800 text-right"
                      >
                        <el-button
                          type="primary"
                          link
                          size="small"
                          class="group"
                          @click="showDetails(item)"
                        >
                          深度解析
                          <IconifyIconOnline
                            icon="ep:arrow-right"
                            class="ml-1 transition-transform group-hover:translate-x-1"
                          />
                        </el-button>
                      </div>
                    </div>
                  </el-col>
                </el-row>
              </div>
            </el-collapse-transition>
          </div>
        </div>

        <!-- 优化建议详情弹窗 -->
        <el-dialog
          v-model="dialogVisible"
          :title="selectedSuggestion?.courseName + ' 提效方案'"
          width="min(500px, calc(100vw - 24px))"
          destroy-on-close
          class="rounded-2xl"
          append-to-body
        >
          <div class="p-4">
            <div
              class="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-5 border border-blue-100 dark:border-blue-500/20 mb-6"
            >
              <h4
                class="font-bold text-blue-700 dark:text-blue-400 flex items-center mb-2"
              >
                <IconifyIconOnline icon="ep:magic-stick" class="mr-2" />
                AI 诊断核心方向
              </h4>
              <p class="text-blue-600 dark:text-blue-300 leading-relaxed">
                {{ selectedSuggestion?.optimizeDirection }}
              </p>
            </div>
            <div class="space-y-4">
              <div class="flex gap-3">
                <div class="text-emerald-500 mt-1">
                  <IconifyIconOnline icon="ep:circle-check" />
                </div>
                <div>
                  <h5
                    class="text-sm font-bold text-gray-700 dark:text-gray-300"
                  >
                    预期效果
                  </h5>
                  <p class="text-xs text-gray-500 dark:text-gray-500">
                    {{ selectedSuggestion?.expectedEffect || "暂无数据" }}
                  </p>
                </div>
              </div>
              <div class="flex gap-3">
                <div class="text-amber-500 mt-1">
                  <IconifyIconOnline icon="ep:warning" />
                </div>
                <div>
                  <h5
                    class="text-sm font-bold text-gray-700 dark:text-gray-300"
                  >
                    执行难度
                  </h5>
                  <p class="text-xs text-gray-500 dark:text-gray-500">
                    {{ selectedSuggestion?.difficulty || "暂无数据" }}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <template #footer>
            <div class="px-6 pb-6">
              <el-button
                type="primary"
                class="w-full h-11 rounded-xl"
                @click="dialogVisible = false"
              >
                我知道了
              </el-button>
            </div>
          </template>
        </el-dialog>
      </template>
    </el-skeleton>
  </div>
</template>

<style lang="scss" scoped>
.suggestion-card-new {
  border-radius: 16px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 4%);
    transform: translateY(-2px);
  }
}

.text-glow {
  text-shadow: 0 0 10px rgb(37 99 235 / 20%);
}

:deep(.el-checkbox) {
  min-height: 44px;
  height: auto;
  margin-right: 0;
}

:deep(.el-checkbox__label) {
  font-weight: 500;
  color: #64748b;
}

:deep(.el-checkbox.is-checked .el-checkbox__label) {
  color: #5b8ff9;
}

.line-clamp-4 {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
}

.chart-container {
  transition: all 0.3s ease;
}

:deep(.efficient-pagination) {
  justify-content: center;
}

@media screen and (max-width: 991px) {
  .efficient-filter-panel {
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 10px !important;
    padding: 10px !important;
    border-radius: 16px !important;
  }

  .efficient-filter-brand {
    min-width: 0;
  }

  .efficient-course-options {
    gap: 4px 16px !important;
  }

  .efficient-chart-panel {
    padding: 6px !important;
    border-radius: 12px !important;
  }

  .chart-container {
    height: 360px !important;
  }

  :deep(.optimize-suggestions .el-button),
  :deep(.suggestion-card-new .el-button) {
    min-height: 44px;
  }

  :deep(.efficient-pagination) {
    flex-wrap: wrap;
    gap: 4px;
  }

  :deep(.efficient-pagination .btn-prev),
  :deep(.efficient-pagination .btn-next),
  :deep(.efficient-pagination .number),
  :deep(.efficient-pagination .more) {
    min-width: 44px;
    height: 44px;
    margin: 0;
    font-size: 12px;
    line-height: 44px;
  }

  :deep(.efficient-pagination .btn-prev),
  :deep(.efficient-pagination .btn-next) {
    padding: 0 10px;
  }
}

@media screen and (max-width: 359px) {
  :deep(.efficient-pagination .number:not(.is-active)),
  :deep(.efficient-pagination .more) {
    display: none;
  }
}
</style>
