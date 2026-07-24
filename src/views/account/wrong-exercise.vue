<template>
  <div
    class="practice-container"
    :class="currentTheme"
    :data-embedded="embedded"
  >
    <div v-if="!embedded" class="header" :class="currentTheme">
      <div class="header-content">
        <div class="back-btn" @click="goBack">
          <el-icon><ArrowLeft /></el-icon> 返回
        </div>
        <div class="title">随练</div>
        <div class="placeholder" />
      </div>
    </div>

    <div class="main-content" :class="currentTheme">
      <el-card>
        <template #header>
          <div class="card-header">
            <!-- 筛选区域 -->
            <div
              class="filters-section"
              :class="{ dark: currentTheme === 'dark' }"
            >
              <!-- 第一行：基础筛选 -->
              <div class="filter-row primary-filters">
                <div class="filter-group">
                  <label class="filter-label">来源</label>
                  <el-select
                    v-model="filterSource"
                    placeholder=" 全部来源 "
                    clearable
                    size="default"
                    class="filter-select"
                    popper-class="custom-select-popper"
                    @change="refreshList"
                  >
                    <el-option label="作业" :value="1" />
                    <el-option label="考试" :value="2" />
                    <el-option label="自测题" :value="3" />
                  </el-select>
                </div>

                <div class="filter-group">
                  <label class="filter-label">题型</label>
                  <el-select
                    v-model="filterType"
                    placeholder=" 全部题型 "
                    clearable
                    size="default"
                    class="filter-select"
                    popper-class="custom-select-popper"
                  >
                    <el-option
                      v-for="(txt, val) in questionTypeMap"
                      :key="val"
                      :label="txt"
                      :value="Number(val)"
                    />
                  </el-select>
                </div>

                <div class="filter-group date-group">
                  <label class="filter-label">日期范围</label>
                  <el-date-picker
                    v-model="filterDateRange"
                    type="daterange"
                    unlink-panels
                    range-separator="至"
                    start-placeholder="开始日期"
                    end-placeholder="结束日期"
                    size="default"
                    value-format="YYYY-MM-DD"
                    class="filter-date"
                    style="
                      width: 100%;
                      max-width: 100%;
                      --el-date-editor-width: 100%;
                    "
                    popper-class="custom-select-popper"
                  />
                </div>

                <div class="filter-actions">
                  <el-button
                    type="primary"
                    size="default"
                    class="action-btn primary-btn"
                    @click="refreshList"
                  >
                    <el-icon><Search /></el-icon>
                    筛选
                  </el-button>
                  <el-button
                    size="default"
                    class="action-btn"
                    @click="resetFilters"
                  >
                    <el-icon><RefreshLeft /></el-icon>
                    重置
                  </el-button>
                </div>
              </div>

              <!-- 第二行：批量操作 -->
              <div class="filter-row batch-operations">
                <div class="batch-left">
                  <el-button
                    size="default"
                    :type="selectionMode ? 'warning' : 'primary'"
                    :disabled="batchAnalyzing || !courseId"
                    class="action-btn"
                    @click="toggleSelectionMode"
                  >
                    <el-icon><Grid /></el-icon>
                    {{ selectionMode ? "退出多选" : "多选模式" }}
                  </el-button>

                  <template v-if="selectionMode">
                    <el-button
                      size="default"
                      :disabled="batchAnalyzing || !filteredRecords.length"
                      class="action-btn"
                      @click="selectAllVisible"
                    >
                      <el-icon><Select /></el-icon>
                      全选
                    </el-button>
                    <el-button
                      size="default"
                      :disabled="batchAnalyzing || !filteredRecords.length"
                      class="action-btn"
                      @click="invertSelectionVisible"
                    >
                      <el-icon><Sort /></el-icon>
                      反选
                    </el-button>
                  </template>
                </div>

                <div class="batch-right">
                  <div v-if="!batchAnalyzing" class="concurrency-control">
                    <label class="filter-label">并发数</label>
                    <el-input-number
                      v-model="concurrency"
                      :min="1"
                      :max="10"
                      size="default"
                      :disabled="batchAnalyzing || !courseId"
                      class="concurrency-input"
                    />
                  </div>

                  <el-button
                    v-if="selectionMode"
                    size="default"
                    type="success"
                    :disabled="
                      batchAnalyzing ||
                      !courseId ||
                      selectedUnAnalyzedCount === 0
                    "
                    :loading="batchAnalyzing"
                    class="action-btn analyze-btn"
                    @click="batchAnalyzeSelected"
                  >
                    <el-icon v-if="!batchAnalyzing"><MagicStick /></el-icon>
                    分析所选 ({{ selectedUnAnalyzedCount }})
                  </el-button>
                  <el-button
                    v-else
                    size="default"
                    type="success"
                    :disabled="
                      batchAnalyzing || !courseId || unAnalyzedCount === 0
                    "
                    :loading="batchAnalyzing"
                    class="action-btn analyze-btn"
                    @click="() => batchAnalyze()"
                  >
                    <el-icon v-if="!batchAnalyzing"><MagicStick /></el-icon>
                    批量分析 ({{ unAnalyzedCount }})
                  </el-button>

                  <el-button
                    v-if="batchAnalyzing"
                    size="default"
                    type="danger"
                    class="action-btn"
                    @click="cancelBatch"
                  >
                    <el-icon><Close /></el-icon>
                    取消
                  </el-button>
                </div>
              </div>
            </div>
          </div>
        </template>

        <el-alert
          v-if="!courseId"
          class="course-context-alert"
          title="当前显示全部课程错题；请从具体课程进入随练后使用 AI 分析。"
          type="info"
          show-icon
          :closable="false"
        />

        <el-empty v-if="loading" description="加载中..." />

        <el-result
          v-else-if="loadError"
          icon="warning"
          title="错题记录加载失败"
          :sub-title="loadError"
        >
          <template #extra>
            <el-button type="primary" @click="fetchList">重新加载</el-button>
          </template>
        </el-result>

        <div v-else>
          <el-alert
            v-if="analysisHistoryError"
            class="analysis-history-alert"
            :title="analysisHistoryError"
            type="warning"
            show-icon
            :closable="false"
          />
          <el-empty v-if="!records.length" description="暂无错题记录" />

          <template v-else>
            <div class="list-stats">
              <span class="stats-label">共</span>
              <span class="stats-count">{{ total }}</span>
              <span class="stats-label">道错题</span>
            </div>
            <div class="wrong-list">
              <div
                v-for="item in filteredRecords"
                :key="item.id"
                class="wrong-item"
                :class="{ dark: currentTheme === 'dark' }"
                @click="!selectionMode && openDetail(item)"
              >
                <div v-if="selectionMode" class="select-box" @click.stop>
                  <el-checkbox
                    v-model="selectionMap[item.id]"
                    @change="onSelectChange(item)"
                  />
                </div>
                <div class="wrong-icon" aria-hidden="true">
                  <span class="wrong-icon-text">错</span>
                </div>
                <div class="wrong-main">
                  <div class="w-title" v-html="item.stem" />
                  <div class="w-meta">
                    <span class="meta-tag source-tag">
                      {{ sourceText(item.sourceType) }}
                    </span>
                    <span class="meta-tag count-tag">
                      错 {{ item.wrongNum }} 次
                    </span>
                    <span
                      v-if="isAnalyzed(item)"
                      class="meta-tag analyzed-tag"
                      :class="{
                        'new-analyzed': newlyAnalyzedKeys.has(
                          String(item.questionId || item.id)
                        )
                      }"
                    >
                      已分析
                    </span>
                  </div>
                </div>
                <div class="wrong-footer">
                  <span class="time">{{ item.lastWrongTime }}</span>
                  <el-button
                    size="small"
                    type="primary"
                    class="view-btn"
                    @click.stop="openDetail(item)"
                  >
                    查看详情
                  </el-button>
                </div>
              </div>
            </div>

            <div class="pager">
              <el-pagination
                background
                layout="prev, pager, next"
                :total="total"
                :page-size="pageSize"
                :current-page="page"
                @current-change="handlePageChange"
              />
            </div>
          </template>
        </div>
      </el-card>
    </div>

    <!-- 批量分析全屏进度 -->
    <transition name="fade">
      <div v-if="batchAnalyzing" class="batch-overlay">
        <div class="overlay-content" :class="{ dark: currentTheme === 'dark' }">
          <h3>AI 分析中...</h3>
          <el-progress
            :percentage="batchProgressPercent"
            :stroke-width="20"
            style="width: 320px; margin: 10px 0 16px"
          />
          <div class="stats">
            <span>总数: {{ totalToAnalyze }}</span>
            <span>完成: {{ completedCount }}</span>
            <span>成功: {{ successCount }}</span>
            <span>失败: {{ failedCount }}</span>
          </div>
          <el-button type="danger" size="small" @click="cancelBatch"
            >取消</el-button
          >
        </div>
      </div>
    </transition>

    <!-- 详情（沿用现有错题弹窗） -->
    <WrongQuestionDetailWithAI
      v-model="detailVisible"
      :course-id="detailCourseId"
      :current-theme="currentTheme"
      :wrong="normalizeWrong(itemForDetail)"
      :initial-analysis="findHistory(itemForDetail)"
      @analyzed="cacheAnalysis"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ArrowLeft,
  Search,
  RefreshLeft,
  Grid,
  Select,
  Sort,
  MagicStick,
  Close
} from "@element-plus/icons-vue";
import dayjs from "dayjs";
import WrongQuestionDetailWithAI from "@/components/WrongQuestionDetailWithAI.vue";
import {
  getWrongExerciseHistory,
  type WrongExerciseAnalyzeResponse
} from "@/api/frontend/wrong-exercise";
import {
  getUserWrongQuestionList,
  type WrongQuestionListResult
} from "@/api/frontend/work";
import { ElMessage } from "element-plus";

const route = useRoute();
const router = useRouter();

// 嵌入模式 props
const props = defineProps<{
  embedded?: boolean;
  courseId?: number;
  currentTheme?: string;
}>();

const currentTheme = computed(() => props.currentTheme || "light");
const embedded = computed(() => !!props.embedded);

const page = ref(1);
const pageSize = ref(10);
const total = ref(0);
const loading = ref(false);
const loadError = ref("");
const analysisHistoryError = ref("");
const records = ref<WrongQuestionListResult["list"]>([] as any);
// 筛选状态
const filterSource = ref<number | undefined>();
const filterType = ref<number | undefined>();
const filterDateRange = ref<[string, string] | undefined>();
const questionTypeMap: Record<number, string> = {
  1: "单选",
  2: "多选",
  3: "判断",
  4: "填空",
  5: "简答",
  6: "论述"
};

const filteredRecords = computed(() => {
  return records.value.filter(r => {
    if (filterSource.value && r.sourceType !== filterSource.value) return false;
    if (filterType.value && r.questionType !== filterType.value) return false;
    if (filterDateRange.value) {
      const [s, e] = filterDateRange.value;
      const d = r.lastWrongTime.substring(0, 10);
      if (d < s || d > e) return false;
    }
    return true;
  });
});

function refreshList() {
  page.value = 1;
  fetchList();
}

function resetFilters() {
  filterSource.value = undefined;
  filterType.value = undefined;
  filterDateRange.value = undefined;
  refreshList();
}

const courseId = computed<number | undefined>(() => {
  const raw = props.courseId ?? route.query.courseId ?? route.params.id;
  if (Array.isArray(raw)) return undefined;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
});

const detailCourseId = computed(() => courseId.value ?? "");

const analysisHistoryMap = ref<Record<string, WrongExerciseAnalyzeResponse>>(
  {}
);

// 多选相关状态
const selectionMode = ref(false);
const selectionMap = ref<Record<string, boolean>>({});
const selectedIds = computed(() =>
  Object.keys(selectionMap.value).filter(id => selectionMap.value[id])
);
const selectedUnAnalyzedCount = computed(() => {
  return filteredRecords.value.filter(
    r => selectionMap.value[r.id] && !isAnalyzed(r)
  ).length;
});
function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value;
  if (!selectionMode.value) selectionMap.value = {};
}
function onSelectChange(item: any) {
  if (!selectionMode.value) return;
  const id = String(item.id);
  if (!selectionMap.value[id]) delete selectionMap.value[id];
}
function selectAllVisible() {
  for (const item of filteredRecords.value) {
    selectionMap.value[item.id] = true;
  }
}
function invertSelectionVisible() {
  for (const item of filteredRecords.value) {
    const id = item.id;
    selectionMap.value[id] = !selectionMap.value[id];
    if (!selectionMap.value[id]) delete selectionMap.value[id];
  }
}
async function batchAnalyzeSelected() {
  if (batchAnalyzing.value) return;
  const subset = filteredRecords.value.filter(
    r => selectionMap.value[r.id] && !isAnalyzed(r)
  );
  if (!subset.length) return;
  await batchAnalyze(subset);
}

const fetchList = async () => {
  loading.value = true;
  loadError.value = "";
  const params: Parameters<typeof getUserWrongQuestionList>[0] = {
    pageNum: page.value,
    pageSize: pageSize.value
  };
  if (courseId.value !== undefined) params.courseId = courseId.value;
  if (filterSource.value !== undefined) params.sourceType = filterSource.value;
  try {
    const { code, data } = await getUserWrongQuestionList(params);
    if (
      code !== 200 ||
      !data ||
      !Array.isArray((data as any).list) ||
      typeof (data as any).total !== "number"
    ) {
      throw new Error("错题列表返回异常");
    }
    records.value = (data as any).list;
    total.value = (data as any).total;
  } catch (error) {
    records.value = [] as any;
    total.value = 0;
    const source = error as any;
    loadError.value =
      source?.response?.data?.msg ||
      source?.message ||
      "错题记录加载失败，请稍后重试";
    console.error("错题记录加载失败:", error);
  } finally {
    loading.value = false;
  }
};

const fetchAnalyzedHistory = async () => {
  analysisHistoryError.value = "";
  if (!courseId.value) {
    analysisHistoryMap.value = {};
    return;
  }
  try {
    const { code, msg, data } = await getWrongExerciseHistory({
      course_id: courseId.value,
      page: 1,
      page_size: 100
    });
    const historyRecords = data?.records ?? [];
    if (
      (code !== 0 && code !== 200) ||
      !data ||
      !Array.isArray(historyRecords)
    ) {
      throw new Error(msg || "AI 分析历史返回异常");
    }
    const map: Record<string, WrongExerciseAnalyzeResponse> = {};
    for (const rec of historyRecords) {
      map[String(rec.original_exercise_id)] = {
        analysis: rec.analysis,
        generated_exercises: rec.generated_exercises
      } as WrongExerciseAnalyzeResponse;
    }
    analysisHistoryMap.value = map;
  } catch (error) {
    const source = error as any;
    analysisHistoryError.value =
      source?.response?.data?.msg ||
      source?.message ||
      "AI 分析历史暂未加载，已有分析标记可能不完整";
    console.warn("错题 AI 分析历史加载失败:", error);
  }
};

const handlePageChange = (p: number) => {
  page.value = p;
  fetchList();
};

// 详情弹窗
const detailVisible = ref(false);
const itemForDetail = ref<any | null>(null);
const openDetail = (item: any) => {
  itemForDetail.value = item;
  detailVisible.value = true;
};
function normalizeWrong(item: any | null) {
  if (!item) return null;
  return {
    id: item.id,
    questionId: item.questionId,
    questionType: item.questionType,
    title: item.title,
    stem: item.stem,
    options: item.options,
    analysis: item.analysis,
    answer: item.answer,
    userAnswer: item.userAnswer
  };
}

function findHistory(item: any | null) {
  if (!item) return null;
  const key = String(item.questionId || item.id);
  return analysisHistoryMap.value[key] || null;
}

function cacheAnalysis(payload: {
  key: string;
  response: WrongExerciseAnalyzeResponse;
}) {
  analysisHistoryMap.value[payload.key] = payload.response;
}

function isAnalyzed(item: any) {
  const key = String(item.questionId || item.id);
  return !!analysisHistoryMap.value[key];
}

const unAnalyzedCount = computed(
  () => filteredRecords.value.filter(r => !isAnalyzed(r)).length
);

// 批量分析（并发+可取消）
const batchAnalyzing = ref(false);
const batchCancelled = ref(false);
const completedCount = ref(0);
const totalToAnalyze = ref(0);
const concurrency = ref(3);
const batchProgressPercent = computed(() =>
  totalToAnalyze.value === 0
    ? 0
    : Math.round((completedCount.value / totalToAnalyze.value) * 100)
);
const failedCount = ref(0);
const successCount = ref(0);
const newlyAnalyzedKeys = ref<Set<string>>(new Set());

function cancelBatch() {
  batchCancelled.value = true;
}

async function batchAnalyze(customList?: any[]) {
  if (batchAnalyzing.value) return;
  const analysisCourseId = courseId.value;
  if (!analysisCourseId) {
    ElMessage.warning("请从具体课程进入随练后使用 AI 分析");
    return;
  }
  const toAnalyze =
    customList || filteredRecords.value.filter(r => !isAnalyzed(r));
  if (!toAnalyze.length) return;
  batchCancelled.value = false;
  batchAnalyzing.value = true;
  completedCount.value = 0;
  totalToAnalyze.value = toAnalyze.length;
  failedCount.value = 0;
  successCount.value = 0;
  const queue = [...toAnalyze];
  let running = 0;

  return new Promise<void>(resolve => {
    const finalizeIfDone = () => {
      if (
        completedCount.value === totalToAnalyze.value ||
        (batchCancelled.value && running === 0)
      ) {
        batchAnalyzing.value = false;
        if (batchCancelled.value) {
          ElMessage.info(
            `已取消：完成 ${completedCount.value}/${totalToAnalyze.value}，成功 ${successCount.value}，失败 ${failedCount.value}`
          );
        } else {
          ElMessage.success(
            `分析完成：成功 ${successCount.value}，失败 ${failedCount.value}`
          );
        }
        resolve();
        return true;
      }
      return false;
    };
    const next = () => {
      if (finalizeIfDone()) return;
      if (batchCancelled.value && running === 0) {
        finalizeIfDone();
        return;
      }
      const currentMax = Math.min(10, Math.max(1, concurrency.value));
      while (running < currentMax && queue.length && !batchCancelled.value) {
        const item = queue.shift();
        if (!item) break;
        running++;
        (async () => {
          try {
            const key = String(item.questionId || item.id);
            const { analyzeWrongExercise } = await import(
              "@/api/frontend/wrong-exercise"
            );
            const { data } = await analyzeWrongExercise({
              course_id: analysisCourseId,
              original_exercise_id: key,
              original_exercise_content: item.stem,
              student_answer: item.userAnswer || "",
              correct_answer: item.answer || ""
            });
            if (data) {
              analysisHistoryMap.value[key] = data;
              successCount.value++;
              newlyAnalyzedKeys.value.add(key);
              // 触发响应性
              newlyAnalyzedKeys.value = new Set(newlyAnalyzedKeys.value);
              setTimeout(() => {
                newlyAnalyzedKeys.value.delete(key);
                newlyAnalyzedKeys.value = new Set(newlyAnalyzedKeys.value);
              }, 1600);
            } else {
              failedCount.value++;
            }
          } catch {
            failedCount.value++;
          } finally {
            completedCount.value++;
            running--;
            next();
          }
        })();
      }
    };
    next();
  });
}

const formatTime = (t: string) => dayjs(t).format("YYYY-MM-DD HH:mm");
const sourceText = (s: number) =>
  (({ 1: "作业", 2: "考试", 3: "自测题" }) as any)[s] || "未知";

const goBack = () => {
  if (!embedded.value) router.back();
};

onMounted(async () => {
  await fetchList();
  fetchAnalyzedHistory();
});
</script>

<style scoped>
@keyframes pop-in {
  0% {
    opacity: 0;
    transform: scale(0.6);
  }

  40% {
    opacity: 1;
    transform: scale(1.05);
  }

  60% {
    transform: scale(0.95);
  }

  100% {
    transform: scale(1);
  }
}

/* ============== 容器 ============== */
.practice-container {
  min-height: 100vh;
  min-height: 100dvh;
  box-sizing: border-box;
  padding: calc(70px + var(--pure-safe-area-top, env(safe-area-inset-top, 0px)))
    0
    calc(30px + var(--pure-safe-area-bottom, env(safe-area-inset-bottom, 0px)));
  background-color: transparent;
}

.practice-container.dark {
  background-color: transparent;
}

.practice-container[data-embedded="true"] {
  min-height: auto;
  padding: 8px 0 0;
  background-color: transparent;
}

/* ============== 头部（独立访问时） ============== */
.header {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 1000;
  height: calc(60px + var(--pure-safe-area-top, env(safe-area-inset-top, 0px)));
  box-sizing: border-box;
  padding-top: var(--pure-safe-area-top, env(safe-area-inset-top, 0));
  background: linear-gradient(135deg, #fff, #f8faff);
  border-bottom: 1px solid rgb(220 226 247 / 60%);
  box-shadow: 0 2px 12px rgb(151 180 247 / 12%);
}

.header.dark {
  background: linear-gradient(135deg, #111b2d, #0f172a);
  border-bottom-color: #1e293b;
  box-shadow: 0 2px 12px rgb(0 0 0 / 30%);
}

.header .header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1200px;
  height: 60px;
  box-sizing: border-box;
  padding: 0 32px;
  margin: 0 auto;
}

.header .back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  font-size: 14px;
  font-weight: 600;
  color: #5a6b8a;
  cursor: pointer;
  border-radius: 10px;
  transition: all 0.3s ease;
}

.header .back-btn:hover {
  color: #1a1a1a;
  background: linear-gradient(135deg, #dce2f7, #97b4f7);
}

.header.dark .back-btn {
  color: #94a3b8;
}

.header.dark .back-btn:hover {
  color: #f1f5f9;
  background: linear-gradient(135deg, #38bdf8, #0ea5e9);
}

.header .title {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: 0.3px;
}

.header.dark .title {
  color: #f1f5f9;
}

.header .placeholder {
  min-width: 60px;
}

/* ============== 主内容 ============== */
.main-content {
  max-width: 1200px;
  padding: 0 32px;
  margin: 0 auto;
}

.main-content :deep(.el-card) {
  background: linear-gradient(145deg, #fff, #f8faff);
  border: 1px solid rgb(220 226 247 / 60%);
  border-radius: 20px;
  box-shadow: 0 4px 20px rgb(151 180 247 / 10%);
}

.main-content.dark :deep(.el-card) {
  color: #e2e8f0;
  background: linear-gradient(145deg, #111b2d, #0f172a);
  border-color: #1e293b;
  box-shadow: 0 4px 20px rgb(0 0 0 / 30%);
}

.main-content.dark :deep(.el-card__header) {
  color: #e2e8f0;
  border-bottom-color: #1e293b;
}

.main-content.dark :deep(.el-empty__description p) {
  color: #94a3b8;
}

.main-content.dark :deep(.el-empty__image img),
.main-content.dark :deep(.el-empty__image svg) {
  opacity: 0.8;
  filter: brightness(0.7);
}

/* 嵌入模式：融入父容器 */
.practice-container[data-embedded="true"] .main-content {
  width: 100%;
  max-width: 100%;
  padding: 0;
}

.practice-container[data-embedded="true"] :deep(.el-card) {
  width: 100%;
  background: transparent;
  border: none;
  box-shadow: none;
}

.practice-container[data-embedded="true"] :deep(.el-card__header) {
  padding: 0 0 16px;
  border-bottom: none;
}

.practice-container[data-embedded="true"] :deep(.el-card__body) {
  padding: 0;
}

/* ============== 卡片头部 ============== */
.card-header {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 0 20px;
  padding: 4px 2px;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.4;
  color: #1a1a1a;
  letter-spacing: 0.3px;
}

.main-content.dark .header-title {
  color: #f1f5f9;
}

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 26px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 700;
  color: #1a1a1a;
  background: linear-gradient(135deg, #dce2f7, #97b4f7);
  border-radius: 13px;
  box-shadow: 0 2px 8px rgb(151 180 247 / 30%);
}

.main-content.dark .count-badge {
  color: #f1f5f9;
  background: linear-gradient(135deg, #38bdf8, #0ea5e9);
  box-shadow: 0 2px 8px rgb(56 189 248 / 30%);
}

/* 列表统计条 */
.list-stats {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  margin: 20px 0 12px;
  padding: 8px 16px;
  font-size: 14px;
  color: #5a6b8a;
  background: linear-gradient(135deg, rgb(220 226 247 / 35%), transparent);
  border-left: 3px solid #97b4f7;
  border-radius: 6px;
}

.main-content.dark .list-stats {
  color: #94a3b8;
  background: linear-gradient(135deg, rgb(56 189 248 / 8%), transparent);
  border-left-color: #38bdf8;
}

.list-stats .stats-label {
  font-weight: 500;
}

.list-stats .stats-count {
  font-size: 18px;
  font-weight: 700;
  color: #5a6cd1;
}

.main-content.dark .list-stats .stats-count {
  color: #38bdf8;
}

.course-context-alert,
.analysis-history-alert {
  margin-bottom: 16px;
}

/* ============== 筛选区 ============== */
.filters-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: linear-gradient(135deg, rgb(220 226 247 / 25%), transparent);
  border: 1px solid rgb(220 226 247 / 60%);
  border-radius: 16px;
}

.filters-section.dark {
  background: linear-gradient(135deg, rgb(56 189 248 / 6%), transparent);
  border-color: #1e293b;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}

.primary-filters {
  padding-bottom: 16px;
  border-bottom: 1px solid rgb(220 226 247 / 60%);
}

.filters-section.dark .primary-filters {
  border-bottom-color: rgb(56 189 248 / 12%);
}

.batch-operations {
  justify-content: space-between;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.date-group {
  flex: 1;
  min-width: 280px;
}

.filter-label {
  font-size: 13px;
  font-weight: 600;
  color: #5a6b8a;
  letter-spacing: 0.3px;
}

.filters-section.dark .filter-label {
  color: #94a3b8;
}

.filter-select {
  width: 140px;
}

.filter-select :deep(.el-input__wrapper),
.filter-select :deep(.el-input__inner),
.filter-date :deep(.el-input__wrapper),
.filter-date :deep(.el-input__inner),
.filter-date :deep(.el-range-input) {
  border-radius: 12px !important;
}

:deep(.el-select-dropdown) {
  border-radius: 12px !important;
}

.filter-date {
  width: 100%;
}

.concurrency-input :deep(.el-input__wrapper),
.concurrency-input :deep(.el-input__inner) {
  border-radius: 10px !important;
}

.filter-actions {
  display: flex;
  gap: 12px;
  margin-left: auto;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.action-btn:hover {
  transform: translateY(-2px);
}

.primary-btn {
  color: #1a1a1a;
  background: linear-gradient(135deg, #dce2f7, #97b4f7);
  border: none;
  box-shadow: 0 4px 12px rgb(151 180 247 / 30%);
}

.primary-btn:hover {
  color: #1a1a1a;
  background: linear-gradient(135deg, #c9d2f3, #7f9ff5);
  box-shadow: 0 6px 16px rgb(151 180 247 / 40%);
}

.filters-section.dark .primary-btn {
  color: #f1f5f9;
  background: linear-gradient(135deg, #38bdf8, #0ea5e9);
  box-shadow: 0 4px 12px rgb(56 189 248 / 30%);
}

.filters-section.dark .primary-btn:hover {
  background: linear-gradient(135deg, #0ea5e9, #0284c7);
}

.analyze-btn {
  color: #fff;
  background: linear-gradient(135deg, #5eead4, #14b8a6);
  border: none;
  box-shadow: 0 4px 12px rgb(20 184 166 / 30%);
}

.analyze-btn:hover {
  background: linear-gradient(135deg, #2dd4bf, #0d9488);
  box-shadow: 0 6px 16px rgb(20 184 166 / 40%);
}

.filters-section.dark .analyze-btn {
  background: linear-gradient(135deg, #14b8a6, #0d9488);
}

.batch-left,
.batch-right {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.concurrency-control {
  display: flex;
  gap: 8px;
  align-items: center;
}

.concurrency-input {
  width: 120px;
}

/* ============== 错题列表（与课程详情卡片风格一致） ============== */
.wrong-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.wrong-item {
  position: relative;
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  align-items: center;
  gap: 20px;
  padding: 20px 24px;
  cursor: pointer;
  background: linear-gradient(145deg, #fff, #f8faff);
  border: 1px solid rgb(220 226 247 / 60%);
  border-radius: 16px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.wrong-item:hover {
  border-color: #97b4f7;
  box-shadow: 0 8px 24px rgb(151 180 247 / 18%);
  transform: translateY(-2px);
}

.wrong-item.dark {
  background: linear-gradient(145deg, #111b2d, #0f172a);
  border-color: #1e293b;
}

.wrong-item.dark:hover {
  border-color: #38bdf8;
  box-shadow: 0 8px 24px rgb(56 189 248 / 18%);
}

/* 多选 */
.select-box {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 图标徽章 */
.wrong-icon {
  position: relative;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  overflow: hidden;
  background: linear-gradient(135deg, #fef3f2 0%, #fee4e2 100%);
  border: 1px solid rgb(252 165 165 / 50%);
  border-radius: 14px;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 80%),
    0 2px 6px rgb(239 68 68 / 12%);
  transition: all 0.3s ease;
}

.wrong-icon::after {
  position: absolute;
  top: -40%;
  left: -40%;
  width: 80%;
  height: 80%;
  pointer-events: none;
  content: "";
  background: radial-gradient(
    circle,
    rgb(255 255 255 / 60%) 0%,
    rgb(255 255 255 / 0%) 70%
  );
}

.wrong-item:hover .wrong-icon {
  transform: scale(1.05);
}

.wrong-icon-text {
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 22px;
  font-weight: 700;
  color: #dc2626;
  letter-spacing: 0;
  text-shadow: 0 1px 0 rgb(255 255 255 / 60%);
}

.wrong-item.dark .wrong-icon {
  background: linear-gradient(135deg, #3b1818 0%, #4a1d1d 100%);
  border-color: rgb(239 68 68 / 40%);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 10%),
    0 2px 6px rgb(0 0 0 / 30%);
}

.wrong-item.dark .wrong-icon-text {
  color: #fca5a5;
  text-shadow: 0 1px 2px rgb(0 0 0 / 40%);
}

/* 主内容 */
.wrong-main {
  min-width: 0;
  overflow: hidden;
}

.w-title {
  display: -webkit-box;
  margin-bottom: 10px;
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
  color: #1a1a1a;
  text-overflow: ellipsis;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.wrong-item.dark .w-title {
  color: #f1f5f9;
}

.w-title :deep(p) {
  margin: 0;
}

.w-title :deep(img) {
  max-height: 24px;
  vertical-align: middle;
}

.w-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 12px;
}

.meta-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 8px;
}

.source-tag {
  color: #5a6b8a;
  background: rgb(220 226 247 / 60%);
}

.wrong-item.dark .source-tag {
  color: #94a3b8;
  background: rgb(56 189 248 / 12%);
}

.count-tag {
  color: #c2410c;
  background: rgb(254 215 170 / 70%);
}

.wrong-item.dark .count-tag {
  color: #fdba74;
  background: rgb(234 88 12 / 18%);
}

.analyzed-tag {
  color: #0d9488;
  background: rgb(94 234 212 / 50%);
}

.wrong-item.dark .analyzed-tag {
  color: #5eead4;
  background: rgb(20 184 166 / 18%);
}

/* 右侧底部 */
.wrong-footer {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: 10px;
  align-items: flex-end;
}

.wrong-footer .time {
  font-size: 12px;
  color: #94a3b8;
  white-space: nowrap;
}

.wrong-item.dark .wrong-footer .time {
  color: #64748b;
}

.view-btn {
  padding: 8px 18px;
  font-size: 13px;
  font-weight: 600;
  color: #1a1a1a;
  background: linear-gradient(135deg, #dce2f7, #97b4f7);
  border: none;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgb(151 180 247 / 25%);
  transition: all 0.3s ease;
}

.view-btn:hover {
  color: #1a1a1a;
  background: linear-gradient(135deg, #c9d2f3, #7f9ff5);
  box-shadow: 0 4px 12px rgb(151 180 247 / 35%);
  transform: translateY(-1px);
}

.wrong-item.dark .view-btn {
  color: #f1f5f9;
  background: linear-gradient(135deg, #38bdf8, #0ea5e9);
  box-shadow: 0 2px 8px rgb(56 189 248 / 25%);
}

.wrong-item.dark .view-btn:hover {
  background: linear-gradient(135deg, #0ea5e9, #0284c7);
}

/* 分页 */
.pager {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}

:deep(.el-pagination.is-background .el-pager li) {
  border-radius: 8px;
}

:deep(.el-pagination.is-background .el-pager li.is-active) {
  background: linear-gradient(135deg, #dce2f7, #97b4f7) !important;
  color: #1a1a1a !important;
}

.main-content.dark :deep(.el-pagination.is-background .el-pager li.is-active) {
  background: linear-gradient(135deg, #38bdf8, #0ea5e9) !important;
  color: #f1f5f9 !important;
}

/* ============== 批量分析遮罩 ============== */
.batch-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(15 23 42 / 55%);
  backdrop-filter: blur(4px);
}

.overlay-content {
  padding: 32px 40px;
  text-align: center;
  background: linear-gradient(145deg, #fff, #f8faff);
  border: 1px solid rgb(220 226 247 / 60%);
  border-radius: 20px;
  box-shadow: 0 10px 40px rgb(0 0 0 / 25%);
}

.overlay-content.dark {
  color: #f1f5f9;
  background: linear-gradient(145deg, #111b2d, #0f172a);
  border-color: #1e293b;
}

.overlay-content h3 {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 700;
}

.overlay-content .stats {
  display: flex;
  gap: 14px;
  justify-content: center;
  margin: 0 0 16px;
  font-size: 13px;
  color: #5a6b8a;
}

.overlay-content.dark .stats {
  color: #94a3b8;
}

/* 动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.analyzed-tag.new-analyzed {
  position: relative;
  animation: pop-in 1.1s ease;
}

/* ============== 响应式 ============== */
@media (max-width: 1024px) {
  .filter-row {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-group,
  .date-group {
    width: 100%;
    min-width: 0;
  }

  .filter-select,
  .filter-date {
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }

  .filter-date.el-date-editor--daterange {
    width: 100% !important;
  }

  .filter-date :deep(.el-range-input) {
    flex: 1 1 0;
    width: 0;
    min-width: 0;
  }

  .filter-date :deep(.el-range-separator) {
    flex: 0 0 24px;
    padding: 0;
  }

  .filter-actions {
    width: 100%;
    margin-left: 0;
  }

  .batch-operations {
    flex-direction: column;
    align-items: stretch;
  }

  .batch-left,
  .batch-right {
    width: 100%;
    justify-content: flex-start;
  }
}

@media (max-width: 768px) {
  .practice-container {
    width: 100%;
    padding: calc(
        68px + var(--pure-safe-area-top, env(safe-area-inset-top, 0px))
      )
      0
      calc(
        30px + var(--pure-safe-area-bottom, env(safe-area-inset-bottom, 0px))
      );
    margin: 0 !important;
  }

  .practice-container[data-embedded="true"] {
    padding: 8px 0 0;
  }

  .practice-container .header .header-content {
    gap: 6px;
    padding: 0 8px;
  }

  .practice-container .header .back-btn {
    min-width: 44px;
    min-height: 44px;
  }

  .practice-container .header .placeholder {
    min-width: 44px;
  }

  .practice-container:not([data-embedded="true"]) .main-content {
    width: 100%;
    min-width: 0;
    max-width: none;
    padding: 0 8px;
    margin: 0 !important;
  }

  .practice-container .main-content :deep(.el-card) {
    width: 100%;
    border-radius: 14px;
  }

  .practice-container .main-content :deep(.el-card__header),
  .practice-container .main-content :deep(.el-card__body) {
    padding: 10px;
  }

  .practice-container .date-group {
    min-width: 0;
  }

  .practice-container :deep(.filter-date) {
    width: 100% !important;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
  }

  .practice-container .filter-actions,
  .practice-container .batch-left,
  .practice-container .batch-right {
    min-width: 0;
    flex-wrap: wrap;
  }

  .filters-section {
    padding: 12px;
    border-radius: 12px;
  }

  .header-title {
    font-size: 18px;
  }

  .action-btn {
    padding: 8px 16px;
    font-size: 13px;
  }

  .action-btn.is-disabled,
  .action-btn.is-disabled:hover {
    color: #94a3b8;
    cursor: not-allowed;
    background: #eef2f7;
    border-color: #d8e0ea;
    box-shadow: none;
    opacity: 1;
    transform: none;
  }

  .wrong-item {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 12px;
  }

  .wrong-icon {
    width: 44px;
    height: 44px;
  }

  .wrong-icon-text {
    font-size: 18px;
  }

  .wrong-footer {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

@media (width <= 380px) {
  .practice-container:not([data-embedded="true"]) .main-content {
    padding-right: 6px;
    padding-left: 6px;
  }

  .practice-container .main-content :deep(.el-card__header),
  .practice-container .main-content :deep(.el-card__body) {
    padding: 8px;
  }
}
</style>

<style lang="scss">
/* 全局样式，用于自定义下拉框弹出层圆角 (R 角) */
.custom-select-popper {
  border-radius: 12px !important;
  overflow: hidden;
  box-shadow:
    0 10px 15px -3px rgb(0 0 0 / 10%),
    0 4px 6px -4px rgb(0 0 0 / 10%) !important;

  .el-select-dropdown__wrap,
  .el-scrollbar__wrap {
    border-radius: 12px !important;
  }

  .el-select-dropdown__list {
    padding: 6px 0 !important;
  }

  /* 下拉选项内边距 */
  .el-select-dropdown__item {
    padding: 8px 16px !important;
  }

  /* 针对日期选择器的面板圆角 */
  &.el-picker-panel,
  .el-picker-panel__body-wrapper {
    border-radius: 12px !important;
  }
}
</style>
