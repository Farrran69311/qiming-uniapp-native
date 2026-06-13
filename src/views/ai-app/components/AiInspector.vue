<template>
  <div
    class="ai-inspector h-full flex flex-col p-4 bg-white italic-safe border-l border-gray-100 relative overflow-hidden"
  >
    <el-tabs
      v-model="activeTab"
      class="custom-tabs h-full flex flex-col relative z-10"
    >
      <!-- 学习画像 -->
      <el-tab-pane label="学习画像" name="profile">
        <div
          class="space-y-6 pt-2 overflow-y-auto custom-scrollbar h-full pr-2"
        >
          <!-- 动态雷达图区域 -->
          <div
            class="w-full h-48 bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-100 p-2 relative group hover:shadow-md transition-shadow duration-500"
          >
            <div
              ref="radarChartRef"
              class="w-full h-full transform transition-transform duration-700 group-hover:scale-105"
            />
            <div
              class="absolute top-2 right-2 flex items-center gap-1 transition-opacity duration-300"
            >
              <span class="relative flex h-2 w-2">
                <span
                  class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"
                />
                <span
                  class="relative inline-flex rounded-full h-2 w-2 bg-success"
                />
              </span>
              <span
                class="text-xs text-gray-400 font-bold group-hover:text-success transition-colors"
                >实时同步 中</span
              >
            </div>
            <!-- 指示光效 -->
            <div
              class="absolute -inset-1 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 blur-lg transition-opacity duration-700 pointer-events-none"
            />
          </div>

          <!-- Agent 状态列表: 动画组 -->
          <div class="space-y-3 mt-4">
            <div
              class="text-xs font-bold text-gray-400 uppercase tracking-widest px-1 flex justify-between group cursor-pointer"
            >
              <span
                class="group-hover:text-primary transition-colors duration-300"
                >专属助手调度流
              </span>
              <el-icon
                class="opacity-0 group-hover:opacity-100 group-hover:rotate-180 transition-all duration-500"
                ><RefreshRight
              /></el-icon>
            </div>

            <transition-group
              appear
              name="agent-list"
              tag="div"
              class="space-y-3"
            >
              <div
                v-for="(agent, index) in agentItems"
                :key="agent.id"
                :style="{ transitionDelay: `${index * 100}ms` }"
                class="flex flex-col p-3 rounded-xl border border-gray-100 bg-white hover:border-primary/30 hover:bg-primary/5 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group/agent"
              >
                <div
                  v-if="agent.status === 'running'"
                  class="absolute top-0 left-0 w-1 h-full bg-primary animate-pulse"
                />
                <div
                  v-else
                  class="absolute top-0 left-0 w-1 h-full bg-success transition-all duration-500 transform origin-left"
                />

                <div
                  class="flex items-center justify-between mb-1 relative z-10"
                >
                  <span
                    class="text-sm font-bold text-gray-800 group-hover/agent:text-primary transition-colors"
                    >{{ agent.name }}</span
                  >

                  <transition name="fade" mode="out-in">
                    <el-tag
                      v-if="agent.status === 'running'"
                      size="small"
                      type="primary"
                      effect="light"
                      class="!scale-90 origin-right !rounded-full"
                    >
                      <div class="flex items-center gap-1">
                        <el-icon class="is-loading"><Loading /></el-icon>
                        处理中
                      </div>
                    </el-tag>
                    <el-tag
                      v-else
                      size="small"
                      type="success"
                      effect="plain"
                      class="!scale-90 origin-right !border-none flex items-center gap-1 bg-success/10 text-success"
                    >
                      <el-icon><Check /></el-icon>
                      已完成
                    </el-tag>
                  </transition>
                </div>
                <span class="text-[13px] text-gray-400 relative z-10">{{
                  agent.desc
                }}</span>
              </div>
            </transition-group>
          </div>
        </div>
      </el-tab-pane>

      <!-- 生成的资源 -->
      <el-tab-pane label="拓展资源" name="resources">
        <div
          class="space-y-4 pt-2 overflow-y-auto custom-scrollbar h-full pr-2 pb-10"
        >
          <transition-group
            appear
            name="stagger-list"
            tag="div"
            class="space-y-4"
          >
            <div
              v-for="(res, index) in resources"
              :key="res.title"
              :style="{ transitionDelay: `${index * 80}ms` }"
              class="group/res p-3 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-400 cursor-pointer relative overflow-hidden"
            >
              <!-- 悬浮光效背景 -->
              <div
                class="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-gradient-to-br from-white/0 via-primary/5 to-white/0 opacity-0 group-hover/res:opacity-100 group-hover/res:animate-spin-slow pointer-events-none transition-opacity duration-500"
              />

              <div class="flex items-start justify-between mb-2 relative z-10">
                <el-tag
                  size="small"
                  :type="
                    res.eta.includes('马上') || res.eta.includes('完成')
                      ? 'success'
                      : 'info'
                  "
                  round
                  class="!px-2 transition-transform duration-300 group-hover/res:scale-105"
                  >{{ res.kind }}</el-tag
                >
                <el-button
                  :icon="Download"
                  circle
                  size="small"
                  text
                  class="group-hover/res:bg-primary group-hover/res:text-white transition-all duration-300 transform group-hover/res:scale-110"
                />
              </div>
              <h4
                class="text-base font-bold text-gray-700 mb-1 group-hover/res:text-primary transition-colors relative z-10"
              >
                {{ res.title }}
              </h4>
              <p
                v-if="res.desc"
                class="text-xs text-gray-400 leading-snug relative z-10"
              >
                {{ res.desc }}
              </p>
            </div>
          </transition-group>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import {
  InfoFilled,
  Download,
  Check,
  Loading,
  RefreshRight
} from "@element-plus/icons-vue";
import * as echarts from "echarts/core";
import { RadarChart } from "echarts/charts";
import { TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([RadarChart, TooltipComponent, CanvasRenderer]);

const props = defineProps<{
  profileDimensions: any[];
  agentItems: any[];
  resources: any[];
}>();

const activeTab = ref("profile");
const radarChartRef = ref<HTMLElement>();
let radarInstance: echarts.ECharts | null = null;

const renderRadar = () => {
  if (!radarChartRef.value) return;
  if (!radarInstance) {
    radarInstance = echarts.init(radarChartRef.value);
  }

  const indicator = props.profileDimensions.map(d => ({
    name: d.dimension || d.label,
    max: 100
  }));
  const values = props.profileDimensions.map(d => d.score || d.value || 0);

  const option = {
    tooltip: { trigger: "item" },
    radar: {
      indicator,
      radius: "60%",
      center: ["50%", "55%"],
      splitNumber: 4,
      axisName: { color: "#6b7280", fontSize: 10 },
      splitLine: { lineStyle: { color: "rgba(209, 213, 219, 0.4)" } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: "rgba(209, 213, 219, 0.4)" } }
    },
    series: [
      {
        name: "Learning Profile",
        type: "radar",
        data: [
          {
            value: values,
            name: "You",
            areaStyle: { color: "rgba(94, 127, 248, 0.2)" },
            lineStyle: { width: 2, color: "#5e7ff8" },
            itemStyle: { color: "#5e7ff8" },
            // Echarts 内置动画
            animationDurationUpdate: 800,
            animationEasingUpdate: "quinticInOut"
          }
        ]
      }
    ]
  };
  radarInstance.setOption(option);
};

onMounted(() => {
  renderRadar();
  window.addEventListener("resize", () => radarInstance?.resize());
});

onUnmounted(() => {
  radarInstance?.dispose();
  window.removeEventListener("resize", () => radarInstance?.resize());
});

watch(() => props.profileDimensions, renderRadar, { deep: true });
</script>

<style scoped lang="scss">
.custom-tabs {
  :deep(.el-tabs__header) {
    margin: 0 0 16px 0;
  }
  :deep(.el-tabs__nav-wrap::after) {
    height: 1px;
    background-color: #f3f4f6;
  }
  :deep(.el-tabs__item) {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #9ca3af;
    transition: all 0.3s;
    &.is-active {
      color: var(--el-color-primary);
    }
  }
}

/* Agent 列表进入/离开动画 */
.agent-list-enter-active,
.agent-list-leave-active {
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.agent-list-enter-from,
.agent-list-leave-to {
  opacity: 0;
  transform: translateX(30px) scale(0.95);
}

/* 资源列表交错动画 */
.stagger-list-enter-active,
.stagger-list-leave-active {
  transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.stagger-list-enter-from,
.stagger-list-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.9);
}

/* 渐变切换动画 */
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

/* 背景缓慢旋转动画 (仅在Hover时通过类触发) */
@keyframes spin-slow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.animate-spin-slow {
  animation: spin-slow 10s linear infinite;
}

/* 滚动条美化 */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 4px;
  transition: background 0.3s;
}
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background: #cbd5e1;
}

@media screen and (max-width: 768px) {
  .ai-inspector {
    height: auto;
    min-height: 0;
    padding: 14px 14px 96px;
    border-left: 0;
    overflow: visible;
  }

  .custom-tabs {
    height: auto;

    :deep(.el-tabs__content) {
      overflow: visible;
    }

    :deep(.el-tab-pane) {
      height: auto;
      overflow: visible;
    }
  }

  .ai-inspector :deep(.custom-scrollbar) {
    height: auto;
    max-height: none;
    overflow: visible;
    padding-right: 0;
  }

  .ai-inspector :deep(.el-tabs__item) {
    padding: 0 12px;
    font-size: 12px;
    letter-spacing: 0;
  }
}
</style>
