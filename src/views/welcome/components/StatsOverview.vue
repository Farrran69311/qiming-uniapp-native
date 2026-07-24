<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useDark } from "../utils";
import { ReNormalCountTo } from "@/components/ReCountTo";
import { getCourseStats, type CourseStatsResult } from "@/api/course";

const { isDark } = useDark();
const loading = ref(true);
const loadError = ref("");

interface StatItem {
  title: string;
  value: string | number;
  unit: string;
  icon: string;
  color: string;
  bgColor: string;
}

const colors = ["#5B8FF9", "#5AD8A6", "#F6BD16", "#E8684A"];
const bgColors = ["#EBF1FF", "#EFFFF9", "#FFFBF0", "#FFF7F5"];
const darkBgColors = [
  "rgba(91, 143, 249, 0.15)",
  "rgba(90, 216, 166, 0.15)",
  "rgba(246, 189, 22, 0.15)",
  "rgba(232, 104, 74, 0.15)"
];

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildStats = (data?: CourseStatsResult): StatItem[] => {
  const completionRate = data?.avgCompletionRate ?? data?.completionRate ?? 0;
  const values = [
    {
      title: "课程总数",
      value: toNumber(data?.totalCourses),
      unit: "门",
      icon: "ep:collection"
    },
    {
      title: "累计课时",
      value: toNumber(data?.totalHours),
      unit: data?.totalHoursUnit || "分钟",
      icon: "ep:timer"
    },
    {
      title: "活跃学生",
      value: toNumber(data?.activeStudents),
      unit: "人",
      icon: "ep:user"
    },
    {
      title: "平均完成率",
      value: toNumber(completionRate),
      unit: "%",
      icon: "ep:finished"
    }
  ];

  return values.map((item, index) => ({
    ...item,
    color: colors[index % colors.length],
    bgColor: bgColors[index % bgColors.length]
  }));
};

const stats = ref<StatItem[]>(buildStats());

const fetchStats = async () => {
  loadError.value = "";
  loading.value = true;
  try {
    const response = await getCourseStats();
    if (response?.code !== 200 || !response.data) {
      throw new Error(response?.msg || "课程概览接口未返回有效数据");
    }
    stats.value = buildStats(response.data);
  } catch (error) {
    console.error("Failed to fetch course overview:", error);
    loadError.value = "课程概览暂时无法加载";
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  void fetchStats();
});
</script>

<template>
  <div v-if="loadError && !loading" class="stats-overview-state">
    <el-empty :description="loadError" :image-size="64">
      <el-button type="primary" plain @click="fetchStats">重新加载</el-button>
    </el-empty>
  </div>
  <el-row v-else v-loading="loading" :gutter="20" class="stats-overview-row">
    <el-col
      v-for="(item, index) in stats"
      :key="index"
      class="stat-col"
      :xs="24"
      :sm="12"
      :md="6"
    >
      <div
        class="stat-card p-6 bg-white dark:bg-[var(--el-bg-color-overlay)] rounded-[24px] shadow-sm border border-gray-100 dark:border-transparent mb-4 transition-all duration-500 hover:shadow-xl hover:-translate-y-2 group"
      >
        <!-- 背景装饰 -->
        <div
          class="absolute -right-4 -bottom-4 w-24 h-24 rounded-full opacity-10 transition-transform duration-700 group-hover:scale-150"
          :style="{ backgroundColor: item.color }"
        />

        <div
          class="stat-icon-row flex justify-between items-start mb-6 relative z-10"
        >
          <div
            class="stat-icon w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 shadow-lg shadow-transparent group-hover:shadow-current"
            :style="{
              backgroundColor: isDark
                ? darkBgColors[stats.indexOf(item) % darkBgColors.length]
                : item.bgColor,
              color: item.color,
              '--tw-shadow-color': item.color + '33'
            }"
          >
            <IconifyIconOnline :icon="item.icon" />
          </div>
        </div>

        <div class="stat-copy relative z-10">
          <p
            class="stat-title text-gray-500 dark:text-gray-300 text-sm mb-2 font-semibold tracking-wide uppercase"
          >
            {{ item.title }}
          </p>
          <div class="flex items-baseline gap-2">
            <span
              class="stat-value text-3xl font-black text-gray-900 dark:text-white tabular-nums"
            >
              <ReNormalCountTo
                :startVal="0"
                :endVal="parseFloat(item.value.toString().replace(/,/g, ''))"
                :duration="2000"
                :decimals="item.unit === '%' ? 1 : 0"
              />
            </span>
            <span
              class="stat-unit text-gray-400 dark:text-gray-300 text-sm font-medium"
              >{{ item.unit }}</span
            >
          </div>
        </div>

        <!-- 底部进度条装饰 -->
        <div
          class="absolute bottom-0 left-0 h-1 transition-all duration-500 group-hover:w-full"
          :style="{ width: '30%', backgroundColor: item.color }"
        />
      </div>
    </el-col>
  </el-row>
</template>

<style scoped>
.stats-overview-state {
  display: flex;
  min-height: 180px;
  align-items: center;
  justify-content: center;
}

.stat-card {
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(10px);
}

.stat-card::before {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  content: "";
  background: linear-gradient(
    135deg,
    rgb(255 255 255 / 10%) 0%,
    transparent 100%
  );
}

@media screen and (max-width: 768px),
  screen and (orientation: landscape) and (max-height: 520px) and (pointer: coarse) {
  .stats-overview-row {
    margin-right: -4px !important;
    margin-left: -4px !important;
  }

  .stats-overview-state {
    min-height: 152px;
  }

  .stat-col {
    flex: 0 0 50%;
    max-width: 50%;
    padding-right: 4px !important;
    padding-left: 4px !important;
  }

  .stat-card {
    min-height: 132px;
    padding: 12px !important;
    margin-bottom: 8px !important;
    border-radius: 12px !important;
    transform: none !important;
  }

  .stat-icon-row {
    margin-bottom: 12px !important;
  }

  .stat-icon {
    width: 44px !important;
    height: 44px !important;
    border-radius: 12px !important;
    font-size: 20px !important;
    transform: none !important;
  }

  .stat-title {
    margin-bottom: 4px !important;
    font-size: 13px !important;
    line-height: 1.35;
    letter-spacing: 0 !important;
  }

  .stat-value {
    font-size: 24px !important;
    line-height: 1.15;
  }

  .stat-unit {
    font-size: 12px !important;
  }

  .stat-card > :first-child,
  .stat-card::before {
    display: none;
  }
}
</style>
