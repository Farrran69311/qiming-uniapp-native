<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
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

const submissionId = computed(() => Number(route.params.submissionId));

const totalAnswerCount = computed(() => result.value?.answers?.length || 0);

const answeredCount = computed(() => {
  if (!result.value?.answers?.length) return 0;
  return result.value.answers.filter(item => {
    if (Array.isArray(item.answer)) return item.answer.length > 0;
    return (
      item.answer !== "" && item.answer !== null && item.answer !== undefined
    );
  }).length;
});

const objectiveAccuracy = computed(() => {
  if (!result.value?.answers?.length) return "-";
  const objective = result.value.answers.filter(
    item => item.isCorrect !== undefined
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
  if (!seconds || seconds <= 0) return "-";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remain = seconds % 60;
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

const isNativeDemoResult = computed(
  () =>
    String(route.query.qimingNative || "") === "1" &&
    String(route.query.demoRole || "") === "student" &&
    submissionId.value === 1
);

const createNativeDemoResult = (): StudentSubmission => ({
  submissionId: 1,
  paperId: 1,
  paperTitle: "2024年春季期中考试",
  studentId: 1001,
  studentName: "吴同学",
  studentNo: "2021001001",
  className: "计算机科学2021级1班",
  submitStatus: 1,
  submitTime: "2024-04-15 10:45:00",
  startTime: "2024-04-15 09:00:00",
  duration: 6300,
  totalScore: 100,
  score: 85,
  gradeStatus: 2,
  graderId: 101,
  graderName: "张老师",
  gradeTime: "2024-04-16 14:00:00",
  answers: [
    { questionId: 101, answer: "B", score: 4, isCorrect: true },
    { questionId: 102, answer: "C", score: 4, isCorrect: true },
    {
      questionId: 201,
      answer: ["A", "B", "D"],
      score: 5,
      isCorrect: true
    },
    { questionId: 301, answer: "A", score: 3, isCorrect: true },
    { questionId: 401, answer: "x^3/3", score: 4, isCorrect: true },
    {
      questionId: 501,
      answer: "解题过程完整，关键公式使用正确。",
      score: 8,
      comment: "正确"
    },
    {
      questionId: 601,
      answer: "拉格朗日中值定理可用于证明函数区间内的增量关系。",
      score: 10,
      comment: "表达清晰，可补充条件说明"
    }
  ]
});

const goBack = () => {
  router.push("/student-exam-center/list");
};

const fetchResult = async () => {
  loadError.value = "";
  if (!submissionId.value) {
    loadError.value = "参数错误：缺少 submissionId";
    ElMessage.error(loadError.value);
    return;
  }

  loading.value = true;
  try {
    const res = await getExamResult(submissionId.value);
    if (res.code !== 0 || !res.data) {
      if (isNativeDemoResult.value) {
        console.warn("[ExamPaperResult] using native demo result fallback", {
          submissionId: submissionId.value,
          message: res.msg
        });
        result.value = createNativeDemoResult();
        return;
      }
      loadError.value = res.msg || "获取考试结果失败";
      ElMessage.error(loadError.value);
      return;
    }
    result.value = res.data;
  } catch (error) {
    if (isNativeDemoResult.value) {
      console.warn("[ExamPaperResult] using native demo result fallback", error);
      result.value = createNativeDemoResult();
      return;
    }
    console.error("获取考试结果失败:", error);
    loadError.value = "获取考试结果失败，请检查网络后重试";
    ElMessage.error(loadError.value);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchResult();
});
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
          <el-table class="desktop-answer-table" :data="result.answers || []" border stripe>
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
                  v-if="scope.row.isCorrect !== undefined"
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
          <div class="mobile-answer-list">
            <div
              v-for="item in result.answers || []"
              :key="item.questionId"
              class="mobile-answer-card"
            >
              <div class="mobile-answer-head">
                <span>题号 {{ item.questionId }}</span>
                <el-tag
                  v-if="item.isCorrect !== undefined"
                  :type="item.isCorrect ? 'success' : 'danger'"
                  size="small"
                >
                  {{ item.isCorrect ? "正确" : "错误" }}
                </el-tag>
              </div>
              <div class="mobile-answer-body">
                <div>
                  <span class="field-label">你的答案</span>
                  <p>{{ formatAnswer(item.answer) }}</p>
                </div>
                <div>
                  <span class="field-label">得分</span>
                  <p>{{ item.score ?? "-" }}</p>
                </div>
                <div v-if="item.comment">
                  <span class="field-label">评语</span>
                  <p>{{ item.comment }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
      <el-empty
        v-else-if="!loading"
        class="result-empty"
        :description="loadError || '暂无考试结果'"
      >
        <el-button type="primary" @click="fetchResult">重新加载</el-button>
        <el-button @click="goBack">返回试卷中心</el-button>
      </el-empty>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.exam-result-page {
  min-height: 100vh;
  padding: 24px;
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

.mobile-answer-list {
  display: none;
}

.result-empty {
  min-height: 420px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
}

@media (max-width: 980px) {
  .exam-result-page {
    padding: calc(18px + var(--pure-safe-area-top, 0px)) 12px
      calc(var(--pure-mobile-content-bottom-gap, 120px) + 16px);
  }

  .header-row {
    align-items: flex-start;
    gap: 14px;
    margin-bottom: 16px;

    .title {
      font-size: 26px;
      line-height: 1.18;
    }

    .subtitle {
      font-size: 15px;
      line-height: 1.5;
    }

    .el-button {
      flex: 0 0 auto;
      min-width: 128px;
      height: 40px;
      padding: 0 12px;
    }
  }

  .score-card {
    grid-template-columns: 1fr;
    border-radius: 14px;
    padding: 16px;

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

  .answer-card {
    border-radius: 14px;
    padding: 14px;
  }

  .desktop-answer-table {
    display: none;
  }

  .mobile-answer-list {
    display: grid;
    gap: 10px;
  }

  .mobile-answer-card {
    padding: 12px;
    background: rgba(248, 250, 252, 0.9);
    border: 1px solid #e2e8f0;
    border-radius: 12px;
  }

  .mobile-answer-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
    font-weight: 700;
    color: #0f172a;
  }

  .mobile-answer-body {
    display: grid;
    gap: 8px;

    .field-label {
      display: block;
      margin-bottom: 4px;
      font-size: 12px;
      color: #64748b;
    }

    p {
      margin: 0;
      color: #1e293b;
      line-height: 1.55;
      word-break: break-word;
    }
  }

  .result-empty {
    min-height: 360px;
  }
}
</style>
