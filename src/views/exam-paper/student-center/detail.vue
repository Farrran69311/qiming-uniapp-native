<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDark } from "@pureadmin/utils";
import { ArrowLeft } from "@element-plus/icons-vue";
import {
  getStudentPaperDetail,
  getQuestionTypeName,
  normalizeQuestionType,
  type StudentPaperDetail,
  type QuestionTypeLike
} from "@/api/examPaper";

defineOptions({
  name: "StudentPaperDetail"
});

const route = useRoute();
const router = useRouter();
const { isDark } = useDark();

const paperId = computed(() => Number(route.params.id));
const loading = ref(false);
const paper = ref<StudentPaperDetail | null>(null);
const loadError = ref("");
let latestDetailRequest = 0;

// 获取试卷详情
const fetchPaperDetail = async () => {
  const requestId = ++latestDetailRequest;
  loading.value = true;
  loadError.value = "";
  paper.value = null;
  try {
    if (!Number.isInteger(paperId.value) || paperId.value <= 0) {
      throw new Error("试卷 ID 无效");
    }
    const res = await getStudentPaperDetail(paperId.value);
    if (requestId !== latestDetailRequest) return;
    if (res.code !== 0 || !res.data) {
      throw new Error(res.msg || "获取试卷详情失败");
    }
    if (Number(res.data.paperId) !== paperId.value) {
      throw new Error("试卷详情与当前链接不一致");
    }
    paper.value = res.data;
  } catch (error) {
    if (requestId !== latestDetailRequest) return;
    console.error("获取试卷详情失败:", error);
    const responseMessage = (
      error as { response?: { data?: { msg?: string } } }
    )?.response?.data?.msg;
    loadError.value =
      responseMessage ||
      (error instanceof Error && error.message
        ? error.message
        : "获取试卷详情失败，请稍后重试");
  } finally {
    if (requestId === latestDetailRequest) {
      loading.value = false;
    }
  }
};

const getTypeCode = (type: QuestionTypeLike) =>
  normalizeQuestionType(type) || 0;

// 格式化时间
const formatTime = (time: string): string => {
  if (!time) return "-";
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

// 返回列表
const goBack = () => {
  void router.push("/student-exam-center/list");
};

// 开始答题
const startExam = () => {
  if (!paper.value || !Number.isInteger(paperId.value) || paperId.value <= 0)
    return;
  void router.push(`/student-exam-center/do/${paperId.value}`);
};

watch(paperId, () => void fetchPaperDetail(), { immediate: true });
</script>

<template>
  <div class="student-paper-detail" :class="{ 'is-dark': isDark }">
    <div v-loading="loading" class="detail-container">
      <!-- 页面头部 -->
      <div class="page-header">
        <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
        <div v-if="paper && !loadError" class="header-actions">
          <el-button type="primary" size="large" @click="startExam">
            <el-icon><Edit /></el-icon>
            开始答题
          </el-button>
        </div>
      </div>

      <section
        v-if="loadError && !loading"
        class="detail-error"
        role="alert"
        aria-live="assertive"
      >
        <el-empty :description="loadError" :image-size="96">
          <div class="detail-error-actions">
            <el-button @click="goBack">返回试卷中心</el-button>
            <el-button type="primary" @click="fetchPaperDetail">
              重新加载
            </el-button>
          </div>
        </el-empty>
      </section>

      <template v-if="paper">
        <!-- 试卷基本信息 -->
        <div class="paper-info-card">
          <div class="card-header">
            <h1 class="paper-title">{{ paper.title }}</h1>
            <el-tag type="primary" size="large">{{ paper.courseName }}</el-tag>
          </div>

          <p v-if="paper.description" class="paper-description">
            {{ paper.description }}
          </p>

          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">考试时长</div>
              <div class="info-value">{{ paper.timeLimit }} 分钟</div>
            </div>
            <div class="info-item">
              <div class="info-label">总分</div>
              <div class="info-value">{{ paper.totalPoints }} 分</div>
            </div>
            <div class="info-item">
              <div class="info-label">题目数量</div>
              <div class="info-value">{{ paper.totalQuestions }} 题</div>
            </div>
            <div class="info-item">
              <div class="info-label">开始时间</div>
              <div class="info-value">{{ formatTime(paper.startTime) }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">截止时间</div>
              <div class="info-value">{{ formatTime(paper.endTime) }}</div>
            </div>
            <div class="info-item">
              <div class="info-label">创建者</div>
              <div class="info-value">{{ paper.creatorName }}</div>
            </div>
          </div>
        </div>

        <!-- 试卷结构 -->
        <div class="paper-structure-card">
          <div class="card-title">
            <el-icon><List /></el-icon>
            试卷结构
          </div>

          <div class="structure-list">
            <div
              v-for="group in paper.questionGroups"
              :key="group.groupId"
              class="structure-item"
            >
              <div class="structure-header">
                <div class="structure-info">
                  <span class="group-name">{{ group.groupName }}</span>
                  <el-tag size="small" type="info">
                    {{ getQuestionTypeName(group.questionType) }}
                  </el-tag>
                </div>
                <div class="structure-stats">
                  <span class="question-count">
                    {{ group.questions.length }} 题
                  </span>
                  <span class="total-points">
                    共
                    {{ group.questions.reduce((sum, q) => sum + q.points, 0) }}
                    分
                  </span>
                </div>
              </div>

              <!-- 题目列表 -->
              <div class="questions-preview">
                <div
                  v-for="(question, qIndex) in group.questions"
                  :key="question.questionId"
                  class="question-item"
                >
                  <div class="question-header">
                    <span class="question-number">
                      第 {{ qIndex + 1 }} 题
                    </span>
                    <span class="question-points"
                      >{{ question.points }} 分</span
                    >
                  </div>
                  <div class="question-stem" v-html="question.stem" />

                  <!-- 选项预览（单选/多选/判断） -->
                  <div
                    v-if="question.options && question.options.length > 0"
                    class="question-options"
                  >
                    <div
                      v-for="option in question.options"
                      :key="option.key"
                      class="option-item"
                    >
                      <span class="option-key">{{ option.key }}.</span>
                      <span class="option-content">{{ option.content }}</span>
                    </div>
                  </div>

                  <!-- 填空题提示 -->
                  <div
                    v-if="getTypeCode(group.questionType) === 4"
                    class="question-hint"
                  >
                    <el-icon><Edit /></el-icon>
                    填空题
                  </div>

                  <!-- 主观题提示 -->
                  <div
                    v-if="[5, 6].includes(getTypeCode(group.questionType))"
                    class="question-hint"
                  >
                    <el-icon><Document /></el-icon>
                    需要文字作答
                  </div>

                  <div
                    v-if="[7, 8].includes(getTypeCode(group.questionType))"
                    class="question-hint"
                  >
                    <el-icon><Document /></el-icon>
                    矩阵题（按行作答）
                  </div>

                  <div
                    v-if="getTypeCode(group.questionType) === 9"
                    class="question-hint"
                  >
                    <el-icon><Document /></el-icon>
                    连线题（配对作答）
                  </div>

                  <div
                    v-if="getTypeCode(group.questionType) === 10"
                    class="question-hint"
                  >
                    <el-icon><Document /></el-icon>
                    排序题（按顺序作答）
                  </div>

                  <div
                    v-if="getTypeCode(group.questionType) === 11"
                    class="question-hint"
                  >
                    <el-icon><Document /></el-icon>
                    滑动评分题
                  </div>

                  <div
                    v-if="getTypeCode(group.questionType) === 12"
                    class="question-hint"
                  >
                    <el-icon><Document /></el-icon>
                    NPS评分题
                  </div>

                  <div
                    v-if="getTypeCode(group.questionType) === 13"
                    class="question-hint"
                  >
                    <el-icon><Star /></el-icon>
                    星级评分题
                  </div>

                  <div
                    v-if="getTypeCode(group.questionType) === 14"
                    class="question-hint"
                  >
                    <el-icon><Document /></el-icon>
                    组合材料题（含子题）
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部操作栏 -->
        <div class="bottom-actions">
          <el-button size="large" @click="goBack">返回列表</el-button>
          <el-button type="primary" size="large" @click="startExam">
            <el-icon><Edit /></el-icon>
            开始答题
          </el-button>
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
$primary-color: #739cf9;

.student-paper-detail {
  min-height: 100vh;
  padding: 24px;
  background: linear-gradient(135deg, #f5f7fa 0%, #f0f2f5 100%);

  &.is-dark {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);

    .paper-info-card,
    .paper-structure-card {
      background: rgba(30, 41, 59, 0.8);
      border-color: rgba(255, 255, 255, 0.1);
    }

    .paper-title,
    .info-value,
    .group-name {
      color: #f1f5f9;
    }

    .paper-description,
    .info-label {
      color: #94a3b8;
    }

    .structure-item {
      background: rgba(15, 23, 42, 0.5);
      border-color: rgba(255, 255, 255, 0.1);
    }

    .question-item {
      background: rgba(30, 41, 59, 0.5);
      border-color: rgba(255, 255, 255, 0.05);
    }
  }

  .detail-container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .detail-error {
    padding: 48px 16px;

    .detail-error-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
    }
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }

  .paper-info-card {
    background: #fff;
    border-radius: 16px;
    padding: 32px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    margin-bottom: 24px;

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .paper-title {
      font-size: 28px;
      font-weight: 700;
      margin: 0;
      color: #1f2937;
      flex: 1;
    }

    .paper-description {
      font-size: 16px;
      color: #6b7280;
      line-height: 1.6;
      margin: 0 0 24px;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
    }

    .info-item {
      .info-label {
        font-size: 14px;
        color: #6b7280;
        margin-bottom: 8px;
      }

      .info-value {
        font-size: 18px;
        font-weight: 600;
        color: #1f2937;
      }
    }
  }

  .paper-structure-card {
    background: #fff;
    border-radius: 16px;
    padding: 32px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    margin-bottom: 24px;

    .card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 24px;
      color: #1f2937;
    }
  }

  .structure-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .structure-item {
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 20px;
    background: #f9fafb;

    .structure-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e5e7eb;
    }

    .structure-info {
      display: flex;
      align-items: center;
      gap: 12px;

      .group-name {
        font-size: 18px;
        font-weight: 600;
        color: #1f2937;
      }
    }

    .structure-stats {
      display: flex;
      gap: 16px;
      font-size: 14px;
      color: #6b7280;

      .question-count,
      .total-points {
        font-weight: 500;
      }
    }
  }

  .questions-preview {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .question-item {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 16px;

    .question-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;

      .question-number {
        font-weight: 600;
        color: $primary-color;
      }

      .question-points {
        font-size: 14px;
        color: #6b7280;
      }
    }

    .question-stem {
      font-size: 15px;
      line-height: 1.6;
      color: #1f2937;
      margin-bottom: 12px;
    }

    .question-options {
      display: flex;
      flex-direction: column;
      gap: 8px;

      .option-item {
        display: flex;
        gap: 8px;
        padding: 8px 12px;
        background: #f9fafb;
        border-radius: 6px;
        font-size: 14px;

        .option-key {
          font-weight: 600;
          color: $primary-color;
        }

        .option-content {
          color: #4b5563;
        }
      }
    }

    .question-hint {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: rgba($primary-color, 0.1);
      border-radius: 6px;
      font-size: 14px;
      color: $primary-color;
    }
  }

  .bottom-actions {
    display: flex;
    justify-content: center;
    gap: 16px;
    padding: 24px 0;
  }
}

@media (width <= 768px) {
  .student-paper-detail {
    min-width: 0;
    padding: 8px;
    margin: 0 !important;
  }

  .student-paper-detail .page-header {
    gap: 8px;
    margin-bottom: 8px;
  }

  .student-paper-detail .page-header :deep(.el-button),
  .student-paper-detail .bottom-actions :deep(.el-button),
  .student-paper-detail .detail-error :deep(.el-button) {
    min-height: 44px;
    margin: 0;
  }

  .student-paper-detail .paper-info-card,
  .student-paper-detail .paper-structure-card {
    padding: 8px;
    margin-bottom: 8px;
    border-radius: 8px;
  }

  .student-paper-detail .paper-info-card .card-header {
    align-items: stretch;
    flex-direction: column;
    gap: 8px;
  }

  .student-paper-detail .paper-info-card .card-header :deep(.el-tag) {
    align-self: flex-start;
    max-width: 100%;
    height: auto;
    white-space: normal;
  }

  .student-paper-detail .paper-info-card .paper-title {
    min-width: 0;
    font-size: 20px;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .student-paper-detail .paper-info-card .paper-description {
    margin-bottom: 12px;
    font-size: 14px;
  }

  .student-paper-detail .paper-info-card .info-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }

  .student-paper-detail .paper-structure-card .card-title {
    margin-bottom: 12px;
    font-size: 17px;
  }

  .student-paper-detail .structure-list,
  .student-paper-detail .questions-preview {
    gap: 8px;
  }

  .student-paper-detail .structure-item,
  .student-paper-detail .question-item {
    min-width: 0;
    padding: 8px;
    border-radius: 8px;
  }

  .student-paper-detail .structure-item .structure-header,
  .student-paper-detail .question-item .question-header {
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 8px;
    padding-bottom: 8px;
    margin-bottom: 8px;
  }

  .student-paper-detail .structure-item .structure-info,
  .student-paper-detail .structure-item .structure-stats,
  .student-paper-detail .question-item .option-item,
  .student-paper-detail .question-item .option-content {
    min-width: 0;
  }

  .student-paper-detail .structure-item .structure-info,
  .student-paper-detail .structure-item .structure-stats {
    flex-wrap: wrap;
    gap: 6px 10px;
  }

  .student-paper-detail .structure-item .group-name,
  .student-paper-detail .question-item .question-stem,
  .student-paper-detail .question-item .option-content {
    overflow-wrap: anywhere;
  }

  .student-paper-detail .bottom-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    padding: 8px 0;
  }

  .student-paper-detail .detail-error {
    padding: 32px 8px;

    .detail-error-actions {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
    }
  }

  .student-paper-detail .bottom-actions :deep(.el-button) {
    width: 100%;
  }
}

@media (width <= 380px) {
  .student-paper-detail {
    padding: 6px;
  }

  .student-paper-detail .paper-info-card,
  .student-paper-detail .paper-structure-card,
  .student-paper-detail .structure-item,
  .student-paper-detail .question-item {
    padding: 6px;
  }
}
</style>
