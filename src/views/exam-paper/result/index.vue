<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDark } from "@pureadmin/utils";
import { getExamResult, type StudentSubmission } from "@/api/examPaper";

defineOptions({
  name: "ExamPaperResult"
});

const route = useRoute();
const router = useRouter();
const { isDark } = useDark();

const loading = ref(false);
const result = ref<StudentSubmission | null>(null);
const loadError = ref("");
let latestResultRequest = 0;

const submissionId = computed(() => Number(route.params.submissionId));
const hasValidSubmissionId = computed(
  () => Number.isInteger(submissionId.value) && submissionId.value > 0
);

const totalAnswerCount = computed(() => result.value?.answers?.length || 0);

const answeredCount = computed(() => {
  if (!result.value?.answers?.length) return 0;
  return result.value.answers.filter(item => isAnsweredValue(item.answer))
    .length;
});

const isAnsweredValue = (answer: unknown): boolean => {
  if (answer === null || answer === undefined) return false;
  if (typeof answer === "string") return answer.trim().length > 0;
  if (typeof answer === "number") return Number.isFinite(answer);
  if (Array.isArray(answer)) return answer.some(item => isAnsweredValue(item));
  if (typeof answer === "object") {
    return Object.values(answer).some(item => isAnsweredValue(item));
  }
  return false;
};

const objectiveAccuracy = computed(() => {
  if (!result.value?.answers?.length) return "-";
  const objective = result.value.answers.filter(
    item => typeof item.isCorrect === "boolean"
  );
  if (!objective.length) return "-";
  const correctCount = objective.filter(item => item.isCorrect).length;
  return `${Math.round((correctCount / objective.length) * 100)}%`;
});

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const formatDuration = (seconds?: number) => {
  const totalSeconds = Number(seconds);
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "-";
  const normalizedSeconds = Math.floor(totalSeconds);
  const hours = Math.floor(normalizedSeconds / 3600);
  const minutes = Math.floor((normalizedSeconds % 3600) / 60);
  const remain = normalizedSeconds % 60;
  if (hours > 0) {
    return `${hours}小时${minutes}分${remain}秒`;
  }
  return `${minutes}分${remain}秒`;
};

const formatAnswer = (answer: unknown) => {
  if (Array.isArray(answer)) {
    return answer.join("，");
  }
  if (typeof answer === "object" && answer !== null) {
    return JSON.stringify(answer);
  }
  return String(answer ?? "-");
};

const goBack = () => {
  void router.push("/student-exam-center/list");
};

const fetchResult = async () => {
  const requestId = ++latestResultRequest;
  result.value = null;
  loadError.value = "";
  if (!hasValidSubmissionId.value) {
    loadError.value = "考试结果链接无效";
    loading.value = false;
    return;
  }

  loading.value = true;
  try {
    const res = await getExamResult(submissionId.value);
    if (requestId !== latestResultRequest) return;
    if (res.code !== 0 || !res.data) {
      throw new Error(res.msg || "获取考试结果失败");
    }
    if (Number(res.data.submissionId) !== submissionId.value) {
      throw new Error("考试结果与当前链接不一致");
    }
    result.value = res.data;
  } catch (error) {
    if (requestId !== latestResultRequest) return;
    console.error("获取考试结果失败:", error);
    const responseMessage = (
      error as { response?: { data?: { msg?: string } } }
    )?.response?.data?.msg;
    loadError.value =
      responseMessage ||
      (error instanceof Error && error.message
        ? error.message
        : "获取考试结果失败，请稍后重试");
  } finally {
    if (requestId === latestResultRequest) {
      loading.value = false;
    }
  }
};

watch(submissionId, () => void fetchResult(), { immediate: true });
</script>

<template>
  <div class="exam-result-page" :class="{ 'is-dark': isDark }">
    <div v-loading="loading" class="result-wrapper">
      <div class="header-row">
        <div>
          <h1 class="title">考试结果</h1>
          <p class="subtitle">查看本次考试成绩与作答记录</p>
        </div>
        <el-button type="primary" @click="goBack">返回试卷中心</el-button>
      </div>

      <section
        v-if="loadError && !loading"
        class="result-error"
        role="alert"
        aria-live="assertive"
      >
        <el-empty :description="loadError" :image-size="96">
          <div class="result-error-actions">
            <el-button @click="goBack">返回试卷中心</el-button>
            <el-button
              v-if="hasValidSubmissionId"
              type="primary"
              @click="fetchResult"
            >
              重新加载
            </el-button>
          </div>
        </el-empty>
      </section>

      <template v-if="result">
        <div class="score-card">
          <div class="score-main">
            <div class="label">总得分</div>
            <div class="score">
              {{ result.score ?? "-" }}
              <span class="unit">/ {{ result.totalScore ?? "-" }}</span>
            </div>
          </div>
          <div class="score-meta">
            <div class="item">
              <span class="item-label">试卷名称</span>
              <span class="item-value">{{ result.paperTitle }}</span>
            </div>
            <div class="item">
              <span class="item-label">提交时间</span>
              <span class="item-value">{{
                formatDateTime(result.submitTime)
              }}</span>
            </div>
            <div class="item">
              <span class="item-label">考试用时</span>
              <span class="item-value">{{
                formatDuration(result.duration)
              }}</span>
            </div>
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-label">总题数</div>
            <div class="summary-value">{{ totalAnswerCount }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">已作答</div>
            <div class="summary-value">{{ answeredCount }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">客观题正确率</div>
            <div class="summary-value">{{ objectiveAccuracy }}</div>
          </div>
        </div>

        <div class="answer-card">
          <div class="card-title">答题明细</div>
          <div
            class="answer-table-scroll"
            role="region"
            aria-label="考试答题明细表格"
            tabindex="0"
          >
            <el-table :data="result.answers || []" border stripe>
              <el-table-column prop="questionId" label="题号" width="100" />
              <el-table-column label="你的答案" min-width="220">
                <template #default="scope">
                  <span>{{ formatAnswer(scope.row.answer) }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="score" label="得分" width="100" />
              <el-table-column label="判题" width="120">
                <template #default="scope">
                  <el-tag
                    v-if="typeof scope.row.isCorrect === 'boolean'"
                    :type="scope.row.isCorrect ? 'success' : 'danger'"
                    size="small"
                  >
                    {{ scope.row.isCorrect ? "正确" : "错误" }}
                  </el-tag>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column
                prop="comment"
                label="评语"
                min-width="220"
                show-overflow-tooltip
              />
            </el-table>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.exam-result-page {
  min-height: 100vh;
  min-height: 100dvh;
  box-sizing: border-box;
  padding: calc(24px + var(--pure-safe-area-top, env(safe-area-inset-top, 0px)))
    24px
    calc(24px + var(--pure-safe-area-bottom, env(safe-area-inset-bottom, 0px)));
  background: linear-gradient(120deg, #f4f7fb 0%, #eaf1ff 100%);

  &.is-dark {
    background: linear-gradient(120deg, #0f172a 0%, #111827 100%);

    .title,
    .summary-value,
    .score {
      color: #f8fafc;
    }

    .subtitle,
    .label,
    .item-label,
    .summary-label,
    .item-value {
      color: #94a3b8;
    }

    .score-card,
    .summary-card,
    .answer-card {
      background: rgba(30, 41, 59, 0.82);
      border-color: rgba(148, 163, 184, 0.2);
    }
  }
}

.result-wrapper {
  max-width: 1160px;
  margin: 0 auto;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;

  .title {
    margin: 0;
    font-size: 28px;
    font-weight: 700;
    color: #0f172a;
  }

  .subtitle {
    margin: 8px 0 0;
    color: #475569;
  }
}

.result-error {
  padding: 48px 16px;

  .result-error-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
  }
}

.score-card {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 16px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;

  .score-main {
    border-right: 1px dashed #cbd5e1;
    padding-right: 12px;

    .label {
      color: #64748b;
      margin-bottom: 8px;
    }

    .score {
      font-size: 42px;
      font-weight: 700;
      line-height: 1.2;
      color: #0f172a;

      .unit {
        font-size: 18px;
        color: #64748b;
        margin-left: 8px;
      }
    }
  }

  .score-meta {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;

    .item {
      padding: 10px;
      border-radius: 10px;
      background: rgba(148, 163, 184, 0.08);
    }

    .item-label {
      display: block;
      font-size: 12px;
      color: #64748b;
      margin-bottom: 6px;
    }

    .item-value {
      color: #1e293b;
      font-weight: 600;
      word-break: break-word;
    }
  }
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.summary-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;

  .summary-label {
    font-size: 13px;
    color: #64748b;
    margin-bottom: 8px;
  }

  .summary-value {
    font-size: 24px;
    font-weight: 700;
    color: #0f172a;
  }
}

.answer-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 16px;

  .card-title {
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 12px;
  }
}

.answer-table-scroll {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-gutter: stable;

  :deep(.el-table) {
    min-width: 760px;
  }
}

@media (max-width: 980px) {
  .score-card {
    grid-template-columns: 1fr;

    .score-main {
      border-right: none;
      border-bottom: 1px dashed #cbd5e1;
      padding-right: 0;
      padding-bottom: 12px;
    }

    .score-meta {
      grid-template-columns: 1fr;
    }
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }
}

@media (width <= 768px) {
  .exam-result-page {
    min-width: 0;
    width: 100%;
    padding: calc(
        8px + var(--pure-safe-area-top, env(safe-area-inset-top, 0px))
      )
      8px
      calc(8px + var(--pure-safe-area-bottom, env(safe-area-inset-bottom, 0px)));
    margin: 0 !important;
    overflow-x: hidden;
  }

  .header-row {
    align-items: stretch;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 12px;

    .title {
      font-size: 20px;
    }

    .subtitle {
      line-height: 1.6;
    }

    :deep(.el-button) {
      width: 100%;
      min-height: 44px;
      margin: 0;
    }
  }

  .result-wrapper {
    width: 100%;
    min-width: 0;
  }

  .score-card,
  .summary-card {
    padding: 12px;
  }

  .answer-card {
    min-width: 0;
    padding: 8px;
    border-radius: 10px;
  }

  .result-error {
    padding: 32px 8px;

    .result-error-actions {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
    }

    :deep(.el-button) {
      width: 100%;
      min-height: 44px;
      margin: 0;
    }
  }

  .answer-table-scroll {
    width: 100%;
    max-width: 100%;
  }
}

@media (width <= 380px) {
  .exam-result-page {
    padding: calc(
        6px + var(--pure-safe-area-top, env(safe-area-inset-top, 0px))
      )
      6px
      calc(6px + var(--pure-safe-area-bottom, env(safe-area-inset-bottom, 0px)));
  }

  .score-card,
  .summary-card,
  .answer-card {
    padding: 6px;
  }
}
</style>
