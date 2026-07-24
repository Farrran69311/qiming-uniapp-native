<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useDark, useECharts, useResizeObserver } from "@pureadmin/utils";
import { getTeacherUsage, getStudentUsage } from "@/api/statistics";
import { useAppStoreHook } from "@/store/modules/app";

defineOptions({
  name: "TeacherStudentUsage"
});

const loading = ref(true);
const loadError = ref("");
const teacherData = ref<{ date: string; usageNum: number }[]>([]);
const studentData = ref<{ date: string; usageNum: number }[]>([]);
const hasUsageData = computed(
  () => teacherData.value.length > 0 || studentData.value.length > 0
);
const appStore = useAppStoreHook();
const isMobile = computed(() => appStore.getDevice === "mobile");

const { isDark } = useDark();
const theme = computed(() => (isDark.value ? "dark" : "light"));

const chartRef = ref();
const { setOptions, resize } = useECharts(chartRef, {
  theme
});

useResizeObserver(chartRef, () => resize(), {
  time: 80
});

// 获取教师和学生使用情况数据
const fetchData = async () => {
  loadError.value = "";
  loading.value = true;
  try {
    const [teacherRes, studentRes] = await Promise.all([
      getTeacherUsage(),
      getStudentUsage()
    ]);

    if (
      teacherRes?.code !== 200 ||
      studentRes?.code !== 200 ||
      !Array.isArray(teacherRes.data?.usageInfoList) ||
      !Array.isArray(studentRes.data?.usageInfoList)
    ) {
      throw new Error("平台活跃度接口未返回有效数据");
    }

    teacherData.value = teacherRes.data.usageInfoList;
    studentData.value = studentRes.data.usageInfoList;
  } catch (error) {
    console.error("获取使用情况数据失败:", error);
    teacherData.value = [];
    studentData.value = [];
    loadError.value = "平台活跃度暂时无法加载";
  } finally {
    loading.value = false;
    await nextTick();
    if (!loadError.value && hasUsageData.value) renderChart();
  }
};

// 渲染图表
const renderChart = () => {
  const dates = Array.from(
    new Set([
      ...teacherData.value.map(item => item.date),
      ...studentData.value.map(item => item.date)
    ])
  ).sort();
  const teacherUsageMap = new Map(
    teacherData.value.map(item => [item.date, item.usageNum])
  );
  const studentUsageMap = new Map(
    studentData.value.map(item => [item.date, item.usageNum])
  );
  const teacherUsage = dates.map(date => teacherUsageMap.get(date) ?? 0);
  const studentUsage = dates.map(date => studentUsageMap.get(date) ?? 0);

  setOptions({
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "line",
        lineStyle: {
          color: "#2563eb",
          width: 1,
          type: "dashed"
        }
      },
      backgroundColor: isDark.value
        ? "rgba(30, 30, 35, 0.9)"
        : "rgba(255, 255, 255, 0.9)",
      borderColor: isDark.value ? "#334155" : "#f1f5f9",
      borderWidth: 1,
      textStyle: {
        color: isDark.value ? "#fafafa" : "#1e293b"
      }
    },
    legend: {
      data: ["教研活动", "学生学习"],
      bottom: 0,
      icon: "circle",
      itemGap: isMobile.value ? 12 : 24,
      textStyle: {
        color: isDark.value ? "#fafafa" : "#4b5563"
      }
    },
    grid: {
      top: isMobile.value ? 24 : 30,
      left: isMobile.value ? 8 : 40,
      right: isMobile.value ? 8 : 20,
      bottom: isMobile.value ? 64 : 50,
      containLabel: isMobile.value
    },
    xAxis: [
      {
        type: "category",
        data: dates,
        boundaryGap: false,
        axisLine: {
          lineStyle: {
            color: isDark.value ? "#334155" : "#f1f5f9"
          }
        },
        axisLabel: {
          color: isDark.value ? "#cbd5e1" : "#94a3b8",
          fontSize: 11
        },
        axisTick: {
          show: false
        }
      }
    ],
    yAxis: [
      {
        type: "value",
        splitLine: {
          lineStyle: {
            color: isDark.value ? "#334155" : "#f1f5f9",
            type: "dashed"
          }
        },
        axisLabel: {
          color: isDark.value ? "#cbd5e1" : "#94a3b8",
          fontSize: 11
        }
      }
    ],
    series: [
      {
        name: "教研活动",
        type: "line",
        smooth: true,
        showSymbol: false,
        lineStyle: {
          width: 3,
          color: "#2563eb"
        },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(37, 99, 235, 0.2)" },
              { offset: 1, color: "rgba(37, 99, 235, 0)" }
            ]
          }
        },
        data: teacherUsage
      },
      {
        name: "学生学习",
        type: "line",
        smooth: true,
        showSymbol: false,
        lineStyle: {
          width: 3,
          color: "#06b6d4"
        },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(6, 182, 212, 0.2)" },
              { offset: 1, color: "rgba(6, 182, 212, 0)" }
            ]
          }
        },
        data: studentUsage
      }
    ]
  });
};

watch(
  () => isMobile.value,
  () => {
    if (hasUsageData.value) renderChart();
  }
);

// 监听主题变化，重新渲染图表
watch(
  () => isDark.value,
  () => {
    if (!loading.value && hasUsageData.value) {
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
        <el-empty v-if="loadError" :description="loadError" :image-size="64">
          <el-button type="primary" plain @click="fetchData">
            重新加载
          </el-button>
        </el-empty>
        <el-empty
          v-else-if="!hasUsageData"
          description="最近 7 天暂无平台活跃数据"
          :image-size="64"
        />
        <div
          v-else
          ref="chartRef"
          class="usage-chart"
          style="width: 100%; height: 350px"
        />
      </template>
    </el-skeleton>
  </div>
</template>

<style scoped>
@media screen and (max-width: 768px),
  screen and (orientation: landscape) and (max-height: 520px) and (pointer: coarse) {
  .usage-chart {
    height: 320px !important;
  }
}
</style>
