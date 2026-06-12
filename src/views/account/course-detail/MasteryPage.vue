<template>
  <!-- 知识点 -->
  <div v-show="visible" class="mastery-page-content" :class="currentTheme">
    <!-- 头部 -->
    <CourseHeader
      :current-theme="currentTheme"
      title="知识点掌握"
      :user-avatar="userAvatar"
      :user-nickname="userNickname"
      @go-back="$emit('go-back')"
      @toggle-theme="e => $emit('toggle-theme', e)"
      @go-to-account="$emit('go-to-account')"
      @logout="$emit('logout')"
    />

    <div class="mastery-content-left" style="width: 100%">
      <div class="left-scroll">
        <div class="mastery-summary-wrapper">
          <div class="mastery-summary-left">
            <div class="summary-card" :class="currentTheme">
              <div class="summary-title">基础知识点</div>
              <div class="summary-value">
                {{ studyEffectData.knowledgePointNum || 0 }}
              </div>
            </div>
            <div class="summary-card" :class="currentTheme">
              <div class="summary-title">重点数量</div>
              <div class="summary-value">
                {{ studyEffectData.keyPointNum || 0 }}
              </div>
            </div>
            <div class="summary-card" :class="currentTheme">
              <div class="summary-title">难点数量</div>
              <div class="summary-value">
                {{ studyEffectData.difficultPointNum || 0 }}
              </div>
            </div>
            <div class="summary-card" :class="currentTheme">
              <div class="summary-title">概念数量</div>
              <div class="summary-value">
                {{ studyEffectData.conceptNum || 0 }}
              </div>
            </div>
          </div>
          <div class="mastery-summary-charts" :class="currentTheme">
            <div class="chart-box bar-chart-box">
              <div class="summary-chart-title">数量分布</div>
              <div ref="masterySummaryChartRef" class="summary-chart-bar" />
            </div>
            <div class="chart-box pie-chart-box">
              <div class="summary-chart-title">占比分布</div>
              <div ref="masteryPieChartRef" class="summary-chart-pie" />
            </div>
          </div>
        </div>

        <div
          v-if="
            studyEffectData.chapterList &&
            studyEffectData.chapterList.length > 0
          "
          class="chapters-grid"
        >
          <div
            v-for="(chapter, index) in studyEffectData.chapterList"
            :key="index"
            class="chapter-section"
            :class="[
              currentTheme,
              {
                'slide-in-left': index % 2 === 0,
                'slide-in-right': index % 2 === 1
              }
            ]"
            :style="{ animationDelay: `${index * 0.1}s` }"
          >
            <h2
              class="collapsible-header"
              :class="{ 'is-expanded': isChapterExpanded(chapter.chapterId) }"
              @click="toggleChapterCollapse(chapter.chapterId)"
            >
              {{ chapter.chapterName }}
              <i
                class="el-icon-arrow-down"
                :class="{
                  rotated: !isChapterExpanded(chapter.chapterId)
                }"
              />
            </h2>

            <transition
              @enter="collapseEnter"
              @after-enter="collapseAfterEnter"
              @leave="collapseLeave"
              @after-leave="collapseAfterLeave"
            >
              <div
                v-show="isChapterExpanded(chapter.chapterId)"
                class="chapter-body"
              >
                <!-- 重点部分 -->
                <div
                  v-if="
                    chapter.keyPointArray && chapter.keyPointArray.length > 0
                  "
                  class="point-section"
                  :class="currentTheme"
                >
                  <h3
                    class="collapsible-header spotlight-button"
                    :class="{
                      'is-expanded': isSubsectionExpanded(
                        chapter.chapterId,
                        'keyPoint'
                      )
                    }"
                    @click="
                      toggleSubsectionCollapse(chapter.chapterId, 'keyPoint')
                    "
                    @mousemove="handleButtonMouseMove"
                  >
                    <div style="display: flex; align-items: center">
                      <span class="count-badge">{{
                        chapter.keyPointArray.length
                      }}</span>
                      <span style="font-weight: 600">重点内容</span>
                    </div>
                    <i
                      class="el-icon-arrow-down"
                      :class="{
                        rotated: isSubsectionExpanded(
                          chapter.chapterId,
                          'keyPoint'
                        )
                      }"
                    />
                  </h3>
                  <transition
                    @enter="collapseEnter"
                    @after-enter="collapseAfterEnter"
                    @leave="collapseLeave"
                    @after-leave="collapseAfterLeave"
                  >
                    <div
                      v-show="
                        isSubsectionExpanded(chapter.chapterId, 'keyPoint')
                      "
                      class="subsection-wrapper"
                    >
                      <transition-group name="point-fade" tag="div">
                        <div
                          v-for="(item, idx) in chapter.keyPointArray || []"
                          :key="'key-' + idx"
                          class="point-item"
                          :class="currentTheme"
                        >
                          <div class="point-title" :class="currentTheme">
                            {{ item.title }}
                          </div>
                          <div class="point-content" :class="currentTheme">
                            {{ item.content }}
                          </div>
                        </div>
                      </transition-group>
                    </div>
                  </transition>
                </div>

                <!-- 难点部分 -->
                <div
                  v-if="
                    chapter.difficultPointArray &&
                    chapter.difficultPointArray.length > 0
                  "
                  class="point-section"
                  :class="currentTheme"
                >
                  <h3
                    class="collapsible-header spotlight-button"
                    :class="{
                      'is-expanded': isSubsectionExpanded(
                        chapter.chapterId,
                        'difficultPoint'
                      )
                    }"
                    @click="
                      toggleSubsectionCollapse(
                        chapter.chapterId,
                        'difficultPoint'
                      )
                    "
                    @mousemove="handleButtonMouseMove"
                  >
                    <div style="display: flex; align-items: center">
                      <span class="count-badge">{{
                        chapter.difficultPointArray.length
                      }}</span>
                      <span style="font-weight: 600">难点解析</span>
                    </div>
                    <i
                      class="el-icon-arrow-down"
                      :class="{
                        rotated: isSubsectionExpanded(
                          chapter.chapterId,
                          'difficultPoint'
                        )
                      }"
                    />
                  </h3>
                  <transition
                    @enter="collapseEnter"
                    @after-enter="collapseAfterEnter"
                    @leave="collapseLeave"
                    @after-leave="collapseAfterLeave"
                  >
                    <div
                      v-show="
                        isSubsectionExpanded(
                          chapter.chapterId,
                          'difficultPoint'
                        )
                      "
                      class="subsection-wrapper"
                    >
                      <transition-group name="point-fade" tag="div">
                        <div
                          v-for="(item, idx) in chapter.difficultPointArray ||
                          []"
                          :key="'diff-' + idx"
                          class="point-item"
                          :class="currentTheme"
                        >
                          <div class="point-title" :class="currentTheme">
                            {{ item.title }}
                          </div>
                          <div class="point-content" :class="currentTheme">
                            {{ item.content }}
                          </div>
                        </div>
                      </transition-group>
                    </div>
                  </transition>
                </div>

                <!-- 知识点部分 -->
                <div
                  v-if="
                    chapter.knowledgeArray && chapter.knowledgeArray.length > 0
                  "
                  class="point-section"
                  :class="currentTheme"
                >
                  <h3
                    class="collapsible-header spotlight-button"
                    :class="{
                      'is-expanded': isSubsectionExpanded(
                        chapter.chapterId,
                        'knowledge'
                      )
                    }"
                    @click="
                      toggleSubsectionCollapse(chapter.chapterId, 'knowledge')
                    "
                    @mousemove="handleButtonMouseMove"
                  >
                    <div style="display: flex; align-items: center">
                      <span class="count-badge">{{
                        chapter.knowledgeArray.length
                      }}</span>
                      <span style="font-weight: 600">基础知识点</span>
                    </div>
                    <i
                      class="el-icon-arrow-down"
                      :class="{
                        rotated: isSubsectionExpanded(
                          chapter.chapterId,
                          'knowledge'
                        )
                      }"
                    />
                  </h3>
                  <transition
                    @enter="collapseEnter"
                    @after-enter="collapseAfterEnter"
                    @leave="collapseLeave"
                    @after-leave="collapseAfterLeave"
                  >
                    <div
                      v-show="
                        isSubsectionExpanded(chapter.chapterId, 'knowledge')
                      "
                      class="subsection-wrapper"
                    >
                      <transition-group name="point-fade" tag="div">
                        <div
                          v-for="(item, idx) in chapter.knowledgeArray || []"
                          :key="'know-' + idx"
                          class="point-item"
                          :class="currentTheme"
                        >
                          <div class="point-title" :class="currentTheme">
                            {{ item.title }}
                          </div>
                          <div class="point-content" :class="currentTheme">
                            {{ item.content }}
                          </div>
                        </div>
                      </transition-group>
                    </div>
                  </transition>
                </div>

                <!-- 概念部分 -->
                <div
                  v-if="chapter.ConceptArray && chapter.ConceptArray.length > 0"
                  class="point-section"
                  :class="currentTheme"
                >
                  <h3
                    class="collapsible-header spotlight-button"
                    :class="{
                      'is-expanded': isSubsectionExpanded(
                        chapter.chapterId,
                        'concept'
                      )
                    }"
                    @click="
                      toggleSubsectionCollapse(chapter.chapterId, 'concept')
                    "
                    @mousemove="handleButtonMouseMove"
                  >
                    <div style="display: flex; align-items: center">
                      <span class="count-badge">{{
                        chapter.ConceptArray.length
                      }}</span>
                      <span style="font-weight: 600">核心概念</span>
                    </div>
                    <i
                      class="el-icon-arrow-down"
                      :class="{
                        rotated: isSubsectionExpanded(
                          chapter.chapterId,
                          'concept'
                        )
                      }"
                    />
                  </h3>
                  <transition
                    @enter="collapseEnter"
                    @after-enter="collapseAfterEnter"
                    @leave="collapseLeave"
                    @after-leave="collapseAfterLeave"
                  >
                    <div
                      v-show="
                        isSubsectionExpanded(chapter.chapterId, 'concept')
                      "
                      class="subsection-wrapper"
                    >
                      <transition-group name="point-fade" tag="div">
                        <div
                          v-for="(item, idx) in chapter.ConceptArray || []"
                          :key="'con-' + idx"
                          class="point-item"
                          :class="currentTheme"
                        >
                          <div class="point-title" :class="currentTheme">
                            {{ item.title }}
                          </div>
                          <div class="point-content" :class="currentTheme">
                            {{ item.content }}
                          </div>
                        </div>
                      </transition-group>
                    </div>
                  </transition>
                </div>

                <div
                  v-if="!chapterHasStudyContent(chapter)"
                  class="chapter-empty"
                >
                  <el-empty description="本章暂无知识点数据" :image-size="64" />
                </div>
              </div>
            </transition>
          </div>
        </div>

        <!-- 如果没有章节数据，显示无数据提示 -->
        <div v-else class="empty-wrapper">
          <el-empty description="暂无学习效果数据" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  reactive,
  computed,
  watch,
  nextTick,
  onMounted,
  onUnmounted
} from "vue";
import * as echarts from "echarts";
import CourseHeader from "./CourseHeader.vue";

// Props
const props = defineProps<{
  visible: boolean;
  currentTheme: string;
  studyEffectData: {
    knowledgePointNum: number;
    keyPointNum: number;
    difficultPointNum: number;
    conceptNum: number;
    chapterList: any[];
  };
  userAvatar: string;
  userNickname: string;
}>();

// Emits
defineEmits<{
  (e: "go-back"): void;
  (e: "toggle-theme", event: MouseEvent): void;
  (e: "go-to-account"): void;
  (e: "logout"): void;
}>();

const MOBILE_BREAKPOINT = 767;
const SMALL_BREAKPOINT = 479;

const isMobileViewport = () => window.innerWidth <= MOBILE_BREAKPOINT;
const isSmallViewport = () => window.innerWidth <= SMALL_BREAKPOINT;

// 引用状态
const masterySummaryChartRef = ref<HTMLElement | null>(null);
let masterySummaryChart: echarts.ECharts | null = null;
const masteryPieChartRef = ref<HTMLElement | null>(null);
let masteryPieChart: echarts.ECharts | null = null;

// 折叠状态映射
const chapterCollapseStates = reactive(new Map<number, boolean>());
const subsectionCollapseStates = reactive(new Map<string, boolean>());

// 折叠控制函数
const toggleChapterCollapse = (chapterId: number) => {
  chapterCollapseStates.set(chapterId, !chapterCollapseStates.get(chapterId));
};

const isChapterExpanded = (chapterId: number) => {
  return chapterCollapseStates.get(chapterId) ?? false;
};

const toggleSubsectionCollapse = (chapterId: number, sectionType: string) => {
  const key = `${chapterId}-${sectionType}`;
  subsectionCollapseStates.set(key, !subsectionCollapseStates.get(key));
};

const isSubsectionExpanded = (chapterId: number, sectionType: string) => {
  const key = `${chapterId}-${sectionType}`;
  return subsectionCollapseStates.get(key) ?? false;
};

const chapterHasStudyContent = (chapter: any) => {
  return !!(
    chapter?.keyPointArray?.length ||
    chapter?.difficultPointArray?.length ||
    chapter?.knowledgeArray?.length ||
    chapter?.ConceptArray?.length
  );
};

// 处理按钮光效
const handleButtonMouseMove = (e: MouseEvent) => {
  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  target.style.setProperty("--x", `${x}px`);
  target.style.setProperty("--y", `${y}px`);
};

// ============ JS 动画钩子 ============
const collapseEnter = (el: Element) => {
  const element = el as HTMLElement;
  element.style.height = "auto";
  element.style.paddingTop = "";
  element.style.paddingBottom = "";
  element.style.marginTop = "";
  element.style.marginBottom = "";
  element.style.opacity = "";
  element.style.overflow = "visible";

  const fullHeight = element.offsetHeight;
  const initialStyle = window.getComputedStyle(element);
  const fullPaddingTop = initialStyle.paddingTop;
  const fullPaddingBottom = initialStyle.paddingBottom;
  const fullMarginTop = initialStyle.marginTop;
  const fullMarginBottom = initialStyle.marginBottom;

  element.style.height = "0";
  element.style.paddingTop = "0";
  element.style.paddingBottom = "0";
  element.style.marginTop = "0";
  element.style.marginBottom = "0";
  element.style.opacity = "0";
  element.style.overflow = "hidden";

  void element.offsetHeight;

  element.style.transition =
    "height 0.4s cubic-bezier(0.4, 0, 0.2, 1), padding 0.4s cubic-bezier(0.4, 0, 0.2, 1), margin 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)";
  element.style.willChange = "height, padding, margin, opacity";

  requestAnimationFrame(() => {
    element.style.height = fullHeight + "px";
    element.style.paddingTop = fullPaddingTop;
    element.style.paddingBottom = fullPaddingBottom;
    element.style.marginTop = fullMarginTop;
    element.style.marginBottom = fullMarginBottom;
    element.style.opacity = "1";
  });
};

const collapseAfterEnter = (el: Element) => {
  const element = el as HTMLElement;
  element.style.height = "";
  element.style.overflow = "";
  element.style.transition = "";
  element.style.willChange = "";
  element.style.paddingTop = "";
  element.style.paddingBottom = "";
  element.style.marginTop = "";
  element.style.marginBottom = "";
  element.style.opacity = "";
};

const collapseLeave = (el: Element) => {
  const element = el as HTMLElement;
  const fullHeight = element.offsetHeight;
  const initialStyle = window.getComputedStyle(element);

  element.style.height = fullHeight + "px";
  element.style.paddingTop = initialStyle.paddingTop;
  element.style.paddingBottom = initialStyle.paddingBottom;
  element.style.marginTop = initialStyle.marginTop;
  element.style.marginBottom = initialStyle.marginBottom;
  element.style.overflow = "hidden";

  void element.offsetHeight;

  element.style.transition =
    "height 0.4s cubic-bezier(0.4, 0, 0.2, 1), padding 0.4s cubic-bezier(0.4, 0, 0.2, 1), margin 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)";
  element.style.willChange = "height, padding, margin, opacity";

  requestAnimationFrame(() => {
    element.style.height = "0";
    element.style.paddingTop = "0";
    element.style.paddingBottom = "0";
    element.style.marginTop = "0";
    element.style.marginBottom = "0";
    element.style.opacity = "0";
  });
};

const collapseAfterLeave = (el: Element) => {
  const element = el as HTMLElement;
  element.style.transition = "";
  element.style.willChange = "";
};

// ============ 图表逻辑 ============
const updateMasteryPieChart = () => {
  if (!masteryPieChart) return;
  const isDark = props.currentTheme === "dark";
  const isMobile = isMobileViewport();
  const isSmall = isSmallViewport();
  const rawData = [
    { value: props.studyEffectData.knowledgePointNum || 0, name: "基础知识点" },
    { value: props.studyEffectData.keyPointNum || 0, name: "重点" },
    { value: props.studyEffectData.difficultPointNum || 0, name: "难点" },
    { value: props.studyEffectData.conceptNum || 0, name: "概念" }
  ];
  const total = rawData.reduce((sum, item) => sum + item.value, 0);
  const chartData = rawData.filter(d => d.value > 0);
  const colors = isDark
    ? ["#4facfe", "#00f2fe", "#2ecc71", "#f1c40f"]
    : ["#97b4f7", "#67c23a", "#e6a23c", "#f56c6c"];

  masteryPieChart.setOption({
    tooltip: {
      trigger: "item",
      formatter: "{b}: {c} ({d}%)",
      backgroundColor: isDark
        ? "rgba(30, 30, 38, 0.9)"
        : "rgba(255, 255, 255, 0.9)",
      borderColor: isDark ? "#3d3f55" : "#ebeef5",
      borderWidth: 1,
      textStyle: { color: isDark ? "#fff" : "#303133" }
    },
    legend: isMobile
      ? {
          orient: "horizontal",
          left: "center",
          bottom: 0,
          itemWidth: isSmall ? 10 : 12,
          itemHeight: isSmall ? 10 : 12,
          itemGap: isSmall ? 12 : 16,
          formatter: (name: string) => {
            const item = rawData.find(d => d.name === name);
            return `{name|${name}} {val|${item?.value || 0}}`;
          },
          textStyle: {
            rich: {
              name: {
                fontSize: isSmall ? 11 : 12,
                color: isDark ? "#b4b4c7" : "#606266",
                padding: [0, 4, 0, 0]
              },
              val: {
                fontSize: isSmall ? 12 : 13,
                fontWeight: "bold",
                color: isDark ? "#fff" : "#303133"
              }
            }
          }
        }
      : {
          orient: "vertical",
          left: "0",
          top: "center",
          itemWidth: 14,
          itemHeight: 14,
          itemGap: 20,
          formatter: (name: string) => {
            const item = rawData.find(d => d.name === name);
            return `{name|${name}}   {val|${item?.value || 0}}`;
          },
          textStyle: {
            rich: {
              name: {
                fontSize: 14,
                color: isDark ? "#b4b4c7" : "#606266",
                width: 90
              },
              val: {
                fontSize: 15,
                fontWeight: "bold",
                color: isDark ? "#fff" : "#303133"
              }
            }
          }
        },
    series: [
      {
        name: "知识点分布",
        type: "pie",
        radius: isMobile ? ["46%", "68%"] : ["55%", "75%"],
        center: isMobile ? ["50%", "42%"] : ["65%", "50%"],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 8,
          borderColor: isDark ? "#1e1e26" : "#fff",
          borderWidth: isMobile ? 2 : 3
        },
        label: {
          show: true,
          position: "center",
          formatter: `{total|${total}}\n{text|总计}`,
          rich: {
            total: {
              fontSize: isSmall ? 24 : isMobile ? 28 : 36,
              fontWeight: "bold",
              color: isDark ? "#fff" : "#303133",
              padding: [0, 0, 4, 0]
            },
            text: {
              fontSize: isMobile ? 12 : 14,
              color: isDark ? "#888" : "#999"
            }
          }
        },
        emphasis: {
          scale: true,
          scaleSize: 10,
          label: {
            show: true,
            fontSize: isSmall ? 28 : isMobile ? 32 : 40,
            fontWeight: "bold"
          }
        },
        labelLine: { show: false },
        data: chartData.map((d, i) => ({
          ...d,
          itemStyle: { color: colors[i % colors.length] }
        }))
      }
    ]
  });
};

const updateMasterySummaryChart = () => {
  if (!masterySummaryChart) return;
  const isDark = props.currentTheme === "dark";
  const isMobile = isMobileViewport();
  const isSmall = isSmallViewport();
  const textColor = isDark ? "#b4b4c7" : "#909399";
  const borderColor = isDark ? "rgba(255,255,255,0.05)" : "#f0f2f5";
  const dataValues = [
    props.studyEffectData.knowledgePointNum || 0,
    props.studyEffectData.keyPointNum || 0,
    props.studyEffectData.difficultPointNum || 0,
    props.studyEffectData.conceptNum || 0
  ];
  const maxVal = Math.max(...dataValues);

  masterySummaryChart.setOption({
    grid: isMobile
      ? {
          left: isSmall ? "10%" : "11%",
          right: "4%",
          top: "12%",
          bottom: isSmall ? "15%" : "14%"
        }
      : { left: "15%", right: "5%", top: "15%", bottom: "15%" },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "none" },
      backgroundColor: isDark
        ? "rgba(30, 30, 38, 0.9)"
        : "rgba(255, 255, 255, 0.9)",
      borderColor: isDark ? "#3d3f55" : "#ebeef5",
      borderWidth: 1,
      borderRadius: 12,
      padding: [10, 14],
      textStyle: { color: isDark ? "#fff" : "#303133", fontWeight: 500 }
    },
    xAxis: {
      type: "category",
      data: ["基础", "重点", "难点", "概念"],
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: textColor,
        fontSize: isSmall ? 11 : 12,
        margin: isMobile ? 12 : 15
      }
    },
    yAxis: {
      type: "value",
      min: 0,
      max: maxVal > 0 ? Math.ceil(maxVal * 1.2) : undefined,
      minInterval: 1,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: borderColor, type: "solid" } },
      axisLabel: {
        show: true,
        color: textColor,
        fontSize: isSmall ? 10 : 11
      }
    },
    series: [
      {
        name: "数量",
        type: "bar",
        data: dataValues.map((v, i) => {
          const colors = isDark
            ? [
                ["#4facfe", "#00f2fe"],
                ["#72D5FF", "#4facfe"],
                ["#a8b8e8", "#72D5FF"],
                ["#97b4f7", "#a8b8e8"]
              ]
            : [
                ["#97b4f7", "#72D5FF"],
                ["#604ffd", "#97b4f7"],
                ["#72D5FF", "#CFD8F0"],
                ["#CFD8F0", "#a8b8e8"]
              ];
          const [c1, c2] = colors[i];
          return {
            value: v,
            itemStyle: {
              borderRadius: [8, 8, 8, 8],
              color: new (echarts as any).graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: c1 },
                { offset: 1, color: c2 }
              ]),
              shadowColor: isDark
                ? "rgba(0,0,0,0.5)"
                : "rgba(96, 79, 253, 0.15)",
              shadowBlur: 12,
              shadowOffsetY: 6
            }
          };
        }),
        barWidth: isSmall ? 18 : isMobile ? 22 : 28,
        showBackground: false,
        label: {
          show: true,
          position: "top",
          distance: isMobile ? 2 : 5,
          color: isDark ? "#fff" : "#303133",
          fontWeight: "bold",
          fontSize: isSmall ? 12 : 14
        }
      }
    ]
  });
};

const handleResize = () => {
  masterySummaryChart?.resize();
  masteryPieChart?.resize();
  if (props.visible) {
    updateMasterySummaryChart();
    updateMasteryPieChart();
  }
};

watch(
  () => [props.visible, props.currentTheme, props.studyEffectData],
  () => {
    if (props.visible) {
      nextTick(() => {
        if (!masterySummaryChart && masterySummaryChartRef.value)
          masterySummaryChart = echarts.init(masterySummaryChartRef.value);
        if (!masteryPieChart && masteryPieChartRef.value)
          masteryPieChart = echarts.init(masteryPieChartRef.value);
        updateMasterySummaryChart();
        updateMasteryPieChart();
      });
    }
  },
  { deep: true }
);

// 监听数据初始化折叠状态
watch(
  () => props.studyEffectData.chapterList,
  newList => {
    if (newList && newList.length > 0) {
      newList.forEach(chapter => {
        if (!chapterCollapseStates.has(chapter.chapterId)) {
          chapterCollapseStates.set(chapter.chapterId, false);
        }
      });
      // 默认展开第一个
      const first = newList[0];
      if (first && !chapterCollapseStates.get(first.chapterId)) {
        setTimeout(() => {
          chapterCollapseStates.set(first.chapterId, true);
        }, 300);
      }
    }
  },
  { immediate: true }
);

onMounted(() => {
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  masterySummaryChart?.dispose();
  masteryPieChart?.dispose();
});
</script>

<style scoped lang="scss">
@keyframes slideInFromLeft {
  from {
    opacity: 0;
    transform: translateX(-60px) rotateY(8deg);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes slideInFromRight {
  from {
    opacity: 0;
    transform: translateX(60px) rotateY(-8deg);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes pointSlideIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@media (max-width: 1280px) {
  .chapters-grid {
    grid-template-columns: 1fr;
  }
}

.mastery-page-content {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 0;
  margin: 0;
  overflow: hidden auto; /* 关键：允许纵向滚动 */
  background: transparent;

  .mastery-content-left {
    width: 100%;
    max-width: 100%;
    height: 100%;
    padding: 0;
  }

  .left-scroll {
    width: 100%;
    max-width: 100%;
    height: 100%;
    padding: 80px 32px 24px;
    overflow-y: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .mastery-summary-wrapper {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    align-items: stretch;
    margin-bottom: 32px;
  }

  .mastery-summary-left {
    display: grid;
    flex: 1 1 380px;
    grid-template-columns: repeat(2, minmax(140px, 1fr));
    gap: 16px;
    max-width: 520px;
    padding: 20px;
    background: #f3f0ff;
    border-radius: 24px;
  }

  &.dark .mastery-summary-left {
    background: rgb(106 90 205 / 10%);
  }

  .summary-card {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 24px;
    overflow: hidden;
    background: #fff;
    border: 1px solid rgb(220 226 247 / 30%);
    border-radius: 20px;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      border-color: #604ffd;
      box-shadow: 0 20px 40px -15px rgb(96 79 253 / 35%);
      transform: translateY(-8px) scale(1.02);
    }

    &.dark {
      background: #2a2a2a;
      border-color: rgb(255 255 255 / 10%);
    }
  }

  .summary-title {
    z-index: 1;
    margin-bottom: 12px;
    font-size: 15px;
    font-weight: 600;
    color: #909399;
  }

  &.dark .summary-title {
    color: #b4b4c7;
  }

  .summary-value {
    z-index: 1;
    font-size: 48px;
    font-weight: 800;
    line-height: 1;
    color: transparent;
    letter-spacing: -1px;
    background: linear-gradient(135deg, #97b4f7, #604ffd);
    background-clip: text;
  }

  .mastery-summary-charts {
    display: flex;
    flex: 1.5 1 600px;
    gap: 24px;
    padding: 24px;
    background: transparent;
    border: 1px solid rgb(220 226 247 / 30%);
    border-radius: 20px;

    &.dark {
      border-color: rgb(61 63 85 / 50%);

      .summary-chart-title {
        color: #4facfe;
      }
    }
  }

  .chart-box {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 280px;
  }

  .summary-chart-title {
    display: flex;
    align-items: center;
    margin-bottom: 16px;
    font-size: 16px;
    font-weight: 600;
    color: #1a1a1a;

    &::before {
      width: 4px;
      height: 16px;
      margin-right: 8px;
      content: "";
      background: #97b4f7;
      border-radius: 2px;
    }
  }

  .summary-chart-bar,
  .summary-chart-pie {
    width: 100%;
    height: 320px;
  }
}

.chapters-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
  perspective: 1000px;
}

.chapter-section {
  padding: 24px;
  background: #fff;
  border: 1px solid rgb(220 226 247 / 50%);
  border-radius: 20px;
  box-shadow: 0 10px 30px -12px rgb(90 107 138 / 15%);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.chapter-section:hover {
  border-color: #97b4f7;
  box-shadow: 0 20px 40px -15px rgb(90 107 138 / 25%);
  transform: translateY(-6px) scale(1.01);
}

.dark .chapter-section {
  background: #2a2a2a;
  border-color: rgb(255 255 255 / 10%);
  box-shadow: 0 10px 30px -12px rgb(0 0 0 / 50%);
}

.chapter-section h2 {
  display: flex;
  justify-content: space-between;
  padding-bottom: 12px;
  margin-bottom: 20px;
  font-size: 20px;
  font-weight: bold;
  color: #1a1a1a;
  border-bottom: 1px solid #f0f2f5;
}

.dark .chapter-section h2 {
  color: #fff;
  border-bottom-color: #3d3f55;
}

.point-section {
  position: relative;
  padding-left: 14px;
  margin-bottom: 16px;
}

.point-section > .collapsible-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  margin: 8px 0 12px;
  cursor: pointer;
  background: linear-gradient(145deg, #fff, #f8faff);
  border: 1px solid rgb(220 226 247 / 80%);
  border-radius: 16px;
  transition: all 0.4s;
}

.point-section.dark > .collapsible-header {
  color: #4facfe;
  background: linear-gradient(145deg, #2a2a35, #23232b);
  border-color: rgb(61 63 85 / 80%);
}

.point-section > .collapsible-header.is-expanded {
  border-color: #97b4f7;
  box-shadow: 0 10px 30px -10px rgb(64 158 255 / 30%);
}

.point-item {
  padding: 16px;
  margin-bottom: 12px;
  background: rgb(255 255 255 / 50%);
  border: 1px solid rgb(220 226 247 / 50%);
  border-radius: 12px;
  backdrop-filter: blur(5px);
  transition: transform 0.3s;
}

.point-item:hover {
  background: #fff;
  border-color: #97b4f7;
  transform: translateX(8px);
}

.dark .point-item {
  background: rgb(42 42 53 / 40%);
  border-color: rgb(61 63 85 / 50%);
}

.point-title {
  margin-bottom: 6px;
  font-size: 15px;
  font-weight: bold;
  color: #303133;
}

.dark .point-title {
  color: #fff;
}

.point-content {
  font-size: 14px;
  line-height: 1.6;
  color: #606266;
}

.dark .point-content {
  color: #e0e0e0;
}

.count-badge {
  padding: 2px 8px;
  margin-right: 12px;
  font-size: 12px;
  font-weight: bold;
  color: #97b4f7;
  background: rgb(64 158 255 / 10%);
  border-radius: 20px;
}

.dark .count-badge {
  color: #4facfe;
  background: rgb(79 172 254 / 10%);
}

/* 动画特效 */
.slide-in-left {
  animation: slideInFromLeft 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.slide-in-right {
  animation: slideInFromRight 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.collapsible-header i {
  transition: transform 0.4s;
}

.collapsible-header i.rotated {
  transform: rotate(-180deg);
}

.point-fade-enter-active {
  animation: pointSlideIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.spotlight-button {
  position: relative;
  overflow: hidden;
}

.spotlight-button::before {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: "";
  background: radial-gradient(
    circle at var(--x, 50%) var(--y, 50%),
    rgb(64 158 255 / 40%) 0%,
    transparent 70%
  );
  opacity: 0;
  transition: opacity 0.3s;
}

.spotlight-button:hover::before {
  opacity: 1;
}

@media (max-width: 1100px) {
  .mastery-page-content {
    .mastery-summary-left,
    .mastery-summary-charts {
      max-width: none;
      flex-basis: 100%;
    }
  }
}

@media (max-width: 767px) {
  .mastery-page-content {
    min-height: 100vh;
    overflow: visible;

    .left-scroll {
      height: auto;
      min-height: 100vh;
        padding: var(--course-mobile-top-offset, 176px) 14px
        calc(24px + env(safe-area-inset-bottom));
      overflow: visible;
    }

    .mastery-summary-wrapper {
      gap: 16px;
      margin-bottom: 24px;
    }

    .mastery-summary-left {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      width: 100%;
      padding: 14px;
      border-radius: 22px;
    }

    .summary-card {
      min-height: 132px;
      padding: 18px 16px;
      border-radius: 18px;
    }

    .summary-title {
      margin-bottom: 8px;
      font-size: 14px;
      line-height: 1.4;
    }

    .summary-value {
      font-size: 40px;
    }

    .mastery-summary-charts {
      flex-direction: column;
      gap: 18px;
      padding: 18px 14px;
      border-radius: 22px;
    }

    .chart-box {
      min-width: 0;
    }

    .summary-chart-title {
      margin-bottom: 12px;
      font-size: 15px;
    }

    .summary-chart-bar,
    .summary-chart-pie {
      height: 280px;
    }
  }

  .chapters-grid {
    gap: 16px;
  }

  .chapter-section {
    padding: 18px;
    border-radius: 18px;
  }

  .chapter-section:hover,
  .point-item:hover {
    transform: none;
  }

  .chapter-section h2 {
    gap: 12px;
    margin-bottom: 16px;
    font-size: 18px;
    line-height: 1.4;
  }

  .point-section {
    padding-left: 0;
    margin-bottom: 14px;
  }

  .point-section > .collapsible-header {
    gap: 12px;
    padding: 12px 14px;
    margin: 0 0 10px;
    border-radius: 14px;
  }

  .point-section > .collapsible-header > div {
    flex: 1;
    min-width: 0;
    gap: 10px;
  }

  .point-section > .collapsible-header > div > span:last-child,
  .chapter-section h2 {
    word-break: break-word;
  }

  .point-item {
    padding: 14px;
  }

  .point-title {
    font-size: 14px;
  }

  .point-content {
    font-size: 13px;
    line-height: 1.7;
  }

  .count-badge {
    margin-right: 0;
  }

  .empty-wrapper {
    padding: 80px 0 40px;
  }
}

@media (max-width: 479px) {
  .mastery-page-content {
    .left-scroll {
        padding: var(--course-mobile-top-offset, 176px) 10px
        calc(20px + env(safe-area-inset-bottom));
    }

    .mastery-summary-left {
      padding: 12px;
    }

    .summary-card {
      min-height: 116px;
      padding: 16px 14px;
    }

    .summary-title {
      font-size: 13px;
    }

    .summary-value {
      font-size: 34px;
    }

    .mastery-summary-charts {
      padding: 16px 12px;
    }

    .summary-chart-bar,
    .summary-chart-pie {
      height: 240px;
    }
  }

  .chapter-section {
    padding: 16px 14px;
  }

  .chapter-section h2 {
    font-size: 16px;
  }

  .count-badge {
    padding: 2px 7px;
    font-size: 11px;
  }
}

.empty-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 40px 0;
}

.chapter-empty {
  padding: 20px 0;
}

.dark :deep(.el-empty__image img),
.dark :deep(.el-empty__image svg) {
  opacity: 0.8;
  filter: brightness(0.7);
}

.no-data {
  padding: 40px 0;
  font-size: 14px;
  color: #909399;
  text-align: center;
}
</style>
