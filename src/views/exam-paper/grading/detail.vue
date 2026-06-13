<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useDark } from "@pureadmin/utils";
import { ElMessage, ElMessageBox } from "element-plus";

import IconDocument from "@/assets/home-icons/document.svg?component";

defineOptions({
  name: "ExamPaperGradingDetail"
});

const route = useRoute();
const router = useRouter();
const { isDark } = useDark();

const paperId = computed(() => route.params.id as string);
const loading = ref(false);
const submitting = ref(false);

const paperInfo = ref({
  id: 1,
  title: "2024年春季概率论期末考试",
  courseName: "概率论",
  totalScore: 100,
  studentCount: 45,
  gradedCount: 30
});

const currentStudentIndex = ref(0);

interface Answer {
  questionId: number;
  questionType: string;
  questionTitle: string;
  options?: string[];
  correctAnswer: string | string[];
  studentAnswer: string | string[];
  score: number | null;
  maxScore: number;
  isCorrect: boolean | null;
  comment: string;
}

interface StudentAnswer {
  id: number;
  studentId: string;
  studentName: string;
  submitTime: string;
  status: string;
  totalScore: number | null;
  answers: Answer[];
}

const studentAnswers = ref<StudentAnswer[]>([
  {
    id: 1,
    studentId: "2024001",
    studentName: "陈明轩",
    submitTime: "2024-04-15 10:30",
    status: "pending",
    totalScore: null,
    answers: [
      {
        questionId: 1,
        questionType: "single",
        questionTitle: "下列函数中，哪个是偶函数？",
        options: [
          "A. f(x) = x",
          "B. f(x) = x²",
          "C. f(x) = x³",
          "D. f(x) = 1/x"
        ],
        correctAnswer: "B",
        studentAnswer: "B",
        score: 5,
        maxScore: 5,
        isCorrect: true,
        comment: ""
      },
      {
        questionId: 2,
        questionType: "essay",
        questionTitle: "请证明：对于任意实数 a, b，有 (a+b)² ≥ 0",
        correctAnswer:
          "证明：(a+b)² = a² + 2ab + b²，由于平方数总是非负的，所以 (a+b)² ≥ 0",
        studentAnswer:
          "因为 (a+b)² 是一个平方数，平方数总是大于等于0的，所以 (a+b)² ≥ 0。",
        score: null,
        maxScore: 15,
        isCorrect: null,
        comment: ""
      }
    ]
  },
  {
    id: 2,
    studentId: "2024002",
    studentName: "林若彤",
    submitTime: "2024-04-15 10:45",
    status: "graded",
    totalScore: 85,
    answers: [
      {
        questionId: 1,
        questionType: "single",
        questionTitle: "下列函数中，哪个是偶函数？",
        options: [
          "A. f(x) = x",
          "B. f(x) = x²",
          "C. f(x) = x³",
          "D. f(x) = 1/x"
        ],
        correctAnswer: "B",
        studentAnswer: "B",
        score: 5,
        maxScore: 5,
        isCorrect: true,
        comment: ""
      },
      {
        questionId: 2,
        questionType: "essay",
        questionTitle: "请证明：对于任意实数 a, b，有 (a+b)² ≥ 0",
        correctAnswer: "证明过程",
        studentAnswer:
          "证明：设 a, b 为任意实数。(a+b)² = a² + 2ab + b²，必然 ≥ 0。证毕。",
        score: 15,
        maxScore: 15,
        isCorrect: true,
        comment: "证明过程完整"
      }
    ]
  }
]);

const currentStudent = computed(
  () => studentAnswers.value[currentStudentIndex.value]
);

const currentTotalScore = computed(() => {
  if (!currentStudent.value) return 0;
  return currentStudent.value.answers.reduce(
    (sum, answer) => sum + (answer.score || 0),
    0
  );
});

const allGraded = computed(() => {
  if (!currentStudent.value) return false;
  return currentStudent.value.answers.every(answer => answer.score !== null);
});

const pendingCount = computed(
  () => studentAnswers.value.filter(s => s.status === "pending").length
);
const gradedCount = computed(
  () => studentAnswers.value.filter(s => s.status === "graded").length
);

const goBack = () => router.push("/exam-paper/grading");
const switchStudent = (index: number) => {
  currentStudentIndex.value = index;
};
const prevStudent = () => {
  if (currentStudentIndex.value > 0) currentStudentIndex.value--;
};
const nextStudent = () => {
  if (currentStudentIndex.value < studentAnswers.value.length - 1)
    currentStudentIndex.value++;
};

const updateScore = (questionIndex: number, score: number | null) => {
  if (score === null) return;
  const answer = currentStudent.value.answers[questionIndex];
  answer.score = Math.max(0, Math.min(score, answer.maxScore));
};

const giveFullScore = (questionIndex: number) => {
  currentStudent.value.answers[questionIndex].score =
    currentStudent.value.answers[questionIndex].maxScore;
};

const giveZeroScore = (questionIndex: number) => {
  currentStudent.value.answers[questionIndex].score = 0;
};

const submitGrading = async () => {
  if (!allGraded.value) {
    ElMessage.warning("请先完成所有题目的评分");
    return;
  }
  try {
    submitting.value = true;
    await new Promise(resolve => setTimeout(resolve, 500));
    currentStudent.value.status = "graded";
    currentStudent.value.totalScore = currentTotalScore.value;
    ElMessage.success("阅卷结果已保存");
  } catch {
    ElMessage.error("保存失败");
  } finally {
    submitting.value = false;
  }
};

const getQuestionTypeText = (type: string) => {
  const types: Record<string, string> = {
    single: "单选题",
    multiple: "多选题",
    fill: "填空题",
    essay: "问答题"
  };
  return types[type] || "未知";
};

const getStatusType = (status: string) =>
  status === "graded" ? "success" : "warning";
const getStatusText = (status: string) =>
  status === "graded" ? "已阅" : "待阅";

const isOptionCorrect = (answer: Answer, option: string) => {
  const letter = option.charAt(0);
  return Array.isArray(answer.correctAnswer)
    ? answer.correctAnswer.includes(letter)
    : answer.correctAnswer === letter;
};

const isOptionSelected = (answer: Answer, option: string) => {
  const letter = option.charAt(0);
  return Array.isArray(answer.studentAnswer)
    ? answer.studentAnswer.includes(letter)
    : answer.studentAnswer === letter;
};

const formatAnswer = (answer: string | string[]) =>
  Array.isArray(answer) ? answer.join(", ") : answer;

const avatarGradients = [
  "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
  "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
  "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
  "linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)"
];

const getAvatarText = (name: string) => name?.slice(-1) || "学";

const getAvatarStyle = (studentId: string) => {
  const gradientIndex = Number(studentId.slice(-1)) % avatarGradients.length;
  return {
    background: avatarGradients[gradientIndex]
  };
};

onMounted(() => {
  loading.value = true;
  console.log("Loading paper:", paperId.value);
  setTimeout(() => {
    loading.value = false;
  }, 500);
});
</script>

<template>
  <div class="grading-detail-container" :class="{ 'is-dark': isDark }">
    <div class="top-nav">
      <div class="nav-left">
        <el-button text @click="goBack">
          <el-icon class="mr-1"><ArrowLeft /></el-icon>
          返回列表
        </el-button>
        <el-divider direction="vertical" />
        <div class="paper-title">
          <IconDocument class="title-icon" />
          <span>{{ paperInfo.title }}</span>
        </div>
      </div>
      <div class="nav-right">
        <div class="progress-info">
          <span>阅卷进度：</span>
          <el-progress
            :percentage="
              Math.round((gradedCount / studentAnswers.length) * 100)
            "
            :stroke-width="8"
            style="width: 120px"
          />
          <span>{{ gradedCount }}/{{ studentAnswers.length }}</span>
        </div>
      </div>
    </div>

    <div v-loading="loading" class="grading-main-content">
      <div class="student-list-panel">
        <div class="panel-header">
          <h3>学生列表</h3>
          <div class="filter-tags">
            <el-tag size="small" type="warning">待阅 {{ pendingCount }}</el-tag>
            <el-tag size="small" type="primary">已阅 {{ gradedCount }}</el-tag>
          </div>
        </div>
        <div class="student-list">
          <div
            v-for="(student, index) in studentAnswers"
            :key="student.id"
            class="student-item"
            :class="{ active: index === currentStudentIndex }"
            @click="switchStudent(index)"
          >
            <div
              class="student-avatar"
              :style="getAvatarStyle(student.studentId)"
            >
              {{ getAvatarText(student.studentName) }}
            </div>
            <div class="student-info">
              <div class="student-name">{{ student.studentName }}</div>
              <div class="student-id">{{ student.studentId }}</div>
            </div>
            <el-tag :type="getStatusType(student.status)" size="small">{{
              getStatusText(student.status)
            }}</el-tag>
            <div v-if="student.totalScore !== null" class="student-score">
              {{ student.totalScore }}分
            </div>
          </div>
        </div>
      </div>

      <div class="answer-panel">
        <div class="panel-header">
          <div class="student-header">
            <div
              class="student-avatar large"
              :style="getAvatarStyle(currentStudent?.studentId || '0')"
            >
              {{ getAvatarText(currentStudent?.studentName || "") }}
            </div>
            <div class="student-detail">
              <h3>{{ currentStudent?.studentName }}</h3>
              <p>
                学号：{{ currentStudent?.studentId }} | 提交时间：{{
                  currentStudent?.submitTime
                }}
              </p>
            </div>
          </div>
          <div class="nav-buttons">
            <el-button
              :disabled="currentStudentIndex === 0"
              @click="prevStudent"
              >上一个</el-button
            >
            <el-button
              :disabled="currentStudentIndex === studentAnswers.length - 1"
              @click="nextStudent"
              >下一个</el-button
            >
          </div>
        </div>

        <div class="answer-list">
          <div
            v-for="(answer, index) in currentStudent?.answers"
            :key="answer.questionId"
            class="answer-item"
            :class="{ 'needs-grading': answer.score === null }"
          >
            <div class="question-header">
              <div class="question-number">
                <span class="number">{{ index + 1 }}</span>
                <el-tag size="small" effect="plain">{{
                  getQuestionTypeText(answer.questionType)
                }}</el-tag>
              </div>
              <span class="max-score">满分 {{ answer.maxScore }} 分</span>
            </div>

            <div class="question-content">
              <div class="question-title">{{ answer.questionTitle }}</div>
              <div v-if="answer.options" class="question-options">
                <div
                  v-for="option in answer.options"
                  :key="option"
                  class="option-item"
                  :class="{
                    'is-correct': isOptionCorrect(answer, option),
                    'is-selected': isOptionSelected(answer, option)
                  }"
                >
                  {{ option }}
                </div>
              </div>
            </div>

            <div class="answer-section">
              <div class="answer-row">
                <span class="answer-label">学生答案：</span
                ><span>{{ formatAnswer(answer.studentAnswer) }}</span>
              </div>
              <div class="answer-row">
                <span class="answer-label">正确答案：</span
                ><span class="correct-answer">{{
                  formatAnswer(answer.correctAnswer)
                }}</span>
              </div>
              <div v-if="answer.isCorrect !== null" class="answer-row">
                <span class="answer-label">判定结果：</span>
                <el-tag
                  :type="answer.isCorrect ? 'success' : 'danger'"
                  size="small"
                  >{{ answer.isCorrect ? "正确" : "错误" }}</el-tag
                >
              </div>
            </div>

            <div class="grading-section">
              <div class="score-input">
                <span class="label">评分：</span>
                <el-input-number
                  v-model="answer.score"
                  :min="0"
                  :max="answer.maxScore"
                  :precision="0"
                  @change="val => updateScore(index, val)"
                />
                <span class="unit">/ {{ answer.maxScore }} 分</span>
                <el-button
                  size="small"
                  type="primary"
                  plain
                  @click="giveFullScore(index)"
                  >满分</el-button
                >
                <el-button
                  size="small"
                  type="danger"
                  plain
                  @click="giveZeroScore(index)"
                  >零分</el-button
                >
              </div>
              <div class="comment-input">
                <span class="label">评语：</span>
                <el-input
                  v-model="answer.comment"
                  type="textarea"
                  :rows="2"
                  placeholder="输入评语（可选）"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="summary-panel">
        <div class="panel-header"><h3>评分汇总</h3></div>
        <div class="summary-content">
          <div class="total-score">
            <div class="score-value">{{ currentTotalScore }}</div>
            <div class="score-label">当前总分</div>
          </div>
          <el-divider />
          <div class="score-breakdown">
            <div
              v-for="(answer, index) in currentStudent?.answers"
              :key="answer.questionId"
              class="score-item"
            >
              <span class="item-label">第 {{ index + 1 }} 题</span>
              <span
                class="item-score"
                :class="{ 'not-graded': answer.score === null }"
                >{{ answer.score !== null ? answer.score : "?" }} /
                {{ answer.maxScore }}</span
              >
            </div>
          </div>
          <el-divider />
          <div class="submit-section">
            <el-button
              type="primary"
              size="large"
              :loading="submitting"
              :disabled="!allGraded || currentStudent?.status === 'graded'"
              @click="submitGrading"
            >
              {{ currentStudent?.status === "graded" ? "已提交" : "提交评分" }}
            </el-button>
            <p v-if="!allGraded" class="submit-tip">
              <el-icon><Warning /></el-icon>
              还有
              {{ currentStudent?.answers.filter(a => a.score === null).length }}
              道题未评分
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
$light-bg: var(--el-bg-color-page);
$light-card-bg: var(--el-bg-color);
$light-text-primary: var(--el-text-color-primary);
$light-text-secondary: var(--el-text-color-regular);
$light-text-muted: var(--el-text-color-secondary);
$light-border: var(--el-border-color-lighter);
$light-shadow: 0 4px 6px -1px rgb(0 0 0 / 10%);
$dark-bg: var(--el-bg-color-page);
$dark-card-bg: var(--el-bg-color);
$dark-text-primary: var(--el-text-color-primary);
$dark-text-secondary: var(--el-text-color-regular);
$dark-border: var(--el-border-color-lighter);
$primary-color: #667eea;
$success-color: #739cf9;
$warning-color: #f59e0b;
$danger-color: #ef4444;
$radius-sm: 8px;
$radius-md: 12px;
$radius-lg: 16px;

.grading-detail-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: $light-bg;

  &.is-dark {
    background: $dark-bg;
    .top-nav,
    .student-list-panel,
    .answer-panel,
    .summary-panel {
      background: $dark-card-bg;
      border-color: $dark-border;
    }
    .paper-title,
    .panel-header h3,
    .student-name,
    .question-title,
    .score-value {
      color: $dark-text-primary;
    }
    .student-id,
    .answer-label,
    .item-label {
      color: $dark-text-secondary;
    }
    .student-item:hover,
    .student-item.active {
      background: rgba(102, 126, 234, 0.1);
    }
    .answer-item {
      background: rgba(255, 255, 255, 0.02);
      border-color: $dark-border;
    }
  }
}

.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: $light-card-bg;
  border-bottom: 1px solid $light-border;
  box-shadow: $light-shadow;

  .nav-left,
  .nav-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .paper-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: $light-text-primary;
  }
  .title-icon {
    width: 20px;
    height: 20px;
    color: $primary-color;
  }
  .progress-info {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    color: $light-text-secondary;
  }
}

.grading-main-content {
  display: flex;
  flex: 1;
  gap: 20px;
  padding: 20px;
  overflow: hidden;
}

.student-list-panel {
  width: 280px;
  flex-shrink: 0;
  background: $light-card-bg;
  border: 1px solid $light-border;
  border-radius: $radius-lg;
  box-shadow: $light-shadow;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .panel-header {
    padding: 16px 20px;
    border-bottom: 1px solid $light-border;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .panel-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: $light-text-primary;
  }
  .filter-tags {
    display: flex;
    gap: 8px;
  }
  .student-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }
  .student-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: $radius-sm;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid transparent;
  }
  .student-item:hover {
    background: rgba(102, 126, 234, 0.05);
  }
  .student-item.active {
    background: rgba(102, 126, 234, 0.1);
    border-color: $primary-color;
  }
  .student-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    border: 2px solid rgba(255, 255, 255, 0.85);
    box-shadow: 0 6px 14px rgba(15, 23, 42, 0.12);
  }
  .student-info {
    flex: 1;
    min-width: 0;
  }
  .student-name {
    font-weight: 500;
    color: $light-text-primary;
    margin-bottom: 2px;
  }
  .student-id {
    font-size: 12px;
    color: $light-text-muted;
  }
  .student-score {
    font-weight: 600;
    color: $primary-color;
  }
}

.answer-panel {
  flex: 1;
  background: $light-card-bg;
  border: 1px solid $light-border;
  border-radius: $radius-lg;
  box-shadow: $light-shadow;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .panel-header {
    padding: 16px 20px;
    border-bottom: 1px solid $light-border;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .student-header {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .student-avatar.large {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 16px;
    font-weight: 700;
    border: 2px solid rgba(255, 255, 255, 0.9);
    box-shadow: 0 8px 18px rgba(15, 23, 42, 0.15);
    line-height: 1;
    flex-shrink: 0;
  }
  .student-detail h3 {
    margin: 0 0 4px;
    font-size: 18px;
    font-weight: 600;
    color: $light-text-primary;
  }
  .student-detail p {
    margin: 0;
    font-size: 13px;
    color: $light-text-secondary;
  }
  .nav-buttons {
    display: flex;
    gap: 8px;
  }
  .answer-list {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }
  .answer-item {
    background: #fafbfc;
    border: 1px solid $light-border;
    border-radius: $radius-md;
    padding: 20px;
    margin-bottom: 16px;
  }
  .answer-item.needs-grading {
    border-color: $warning-color;
    background: rgba(245, 158, 11, 0.05);
  }
  .question-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .question-number {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .question-number .number {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: $primary-color;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 14px;
  }
  .max-score {
    font-size: 14px;
    color: $light-text-secondary;
  }
  .question-content {
    margin-bottom: 16px;
  }
  .question-title {
    font-size: 15px;
    font-weight: 500;
    color: $light-text-primary;
    margin-bottom: 12px;
    line-height: 1.6;
  }
  .question-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .option-item {
    padding: 10px 16px;
    background: #fff;
    border: 1px solid $light-border;
    border-radius: $radius-sm;
    font-size: 14px;
    color: $light-text-primary;
  }
  .option-item.is-correct {
    background: rgba(115, 156, 249, 0.1);
    border-color: $success-color;
    color: $success-color;
  }
  .option-item.is-selected {
    border-width: 2px;
    font-weight: 500;
  }
  .option-item.is-selected:not(.is-correct) {
    background: rgba(239, 68, 68, 0.1);
    border-color: $danger-color;
    color: $danger-color;
  }
  .answer-section {
    background: #fff;
    border: 1px solid $light-border;
    border-radius: $radius-sm;
    padding: 16px;
    margin-bottom: 16px;
  }
  .answer-row {
    display: flex;
    align-items: flex-start;
    margin-bottom: 12px;
  }
  .answer-row:last-child {
    margin-bottom: 0;
  }
  .answer-label {
    width: 80px;
    flex-shrink: 0;
    font-size: 14px;
    color: $light-text-secondary;
  }
  .correct-answer {
    color: $success-color;
  }
  .grading-section {
    background: #fff;
    border: 1px solid $light-border;
    border-radius: $radius-sm;
    padding: 16px;
  }
  .score-input {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }
  .score-input .label,
  .comment-input .label {
    font-size: 14px;
    color: $light-text-secondary;
  }
  .score-input .unit {
    font-size: 14px;
    color: $light-text-muted;
  }
  .comment-input {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }
  .comment-input .label {
    padding-top: 8px;
  }
  .comment-input .el-textarea {
    flex: 1;
  }
}

.summary-panel {
  width: 260px;
  flex-shrink: 0;
  background: $light-card-bg;
  border: 1px solid $light-border;
  border-radius: $radius-lg;
  box-shadow: $light-shadow;
  display: flex;
  flex-direction: column;

  .panel-header {
    padding: 16px 20px;
    border-bottom: 1px solid $light-border;
  }
  .panel-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: $light-text-primary;
  }
  .summary-content {
    padding: 20px;
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .total-score {
    text-align: center;
    padding: 20px 0;
  }
  .score-value {
    font-size: 48px;
    font-weight: 700;
    color: $primary-color;
    line-height: 1;
    margin-bottom: 8px;
  }
  .score-label {
    font-size: 14px;
    color: $light-text-secondary;
  }
  .score-breakdown {
    flex: 1;
  }
  .score-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px dashed $light-border;
  }
  .score-item:last-child {
    border-bottom: none;
  }
  .item-label {
    font-size: 14px;
    color: $light-text-secondary;
  }
  .item-score {
    font-size: 14px;
    font-weight: 600;
    color: $light-text-primary;
  }
  .item-score.not-graded {
    color: $warning-color;
  }
  .submit-section {
    text-align: center;
    padding-top: 16px;
  }
  .submit-section .el-button {
    width: 100%;
  }
  .submit-tip {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    margin-top: 12px;
    font-size: 12px;
    color: $warning-color;
  }
}

/* SVG 图标样式 —— 仅作用于本页显式标记为线性图标的元素，避免误伤 el-empty / el-icon / echarts */
:deep(.title-icon),
:deep(.title-icon svg) {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

@media (max-width: 768px) {
  .grading-detail-container {
    height: auto;
    min-height: 100vh;
    padding-bottom: var(--pure-mobile-content-bottom-gap, 140px);
    overflow: visible;
  }

  .top-nav {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    margin: 8px 10px 12px;
    padding: 12px;
    border: 1px solid $light-border;
    border-radius: $radius-lg;

    .nav-left,
    .nav-right {
      width: 100%;
      min-width: 0;
      align-items: flex-start;
      gap: 10px;
      flex-wrap: wrap;
    }

    :deep(.el-divider--vertical) {
      display: none;
    }

    .paper-title {
      width: 100%;
      min-width: 0;
      align-items: flex-start;
      font-size: 17px;
      line-height: 1.35;
    }

    .paper-title span {
      min-width: 0;
      flex: 1 1 auto;
      white-space: normal;
      word-break: keep-all;
      overflow-wrap: break-word;
    }

    .progress-info {
      width: 100%;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 13px;
    }

    .progress-info :deep(.el-progress) {
      flex: 1 1 130px;
      min-width: 130px;
      max-width: 180px;
    }
  }

  .grading-main-content {
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    padding: 0 10px 12px;
    overflow: visible;
  }

  .student-list-panel,
  .answer-panel,
  .summary-panel {
    width: 100%;
    flex: 0 0 auto;
    border-radius: 14px;
  }

  .student-list-panel {
    .panel-header {
      align-items: flex-start;
      gap: 8px;
      padding: 12px;
      flex-wrap: wrap;
    }

    .filter-tags {
      flex-wrap: wrap;
    }

    .student-list {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
      max-height: none;
      padding: 10px;
      overflow: visible;
    }

    .student-item {
      gap: 10px;
      padding: 10px;
    }

    .student-avatar {
      width: 36px;
      height: 36px;
    }
  }

  .summary-panel {
    order: 2;

    .panel-header {
      padding: 12px;
    }

    .summary-content {
      padding: 12px;
    }

    .total-score {
      padding: 8px 0 12px;
    }

    .score-value {
      font-size: 36px;
    }

    .submit-section .el-button {
      min-height: 40px;
    }
  }

  .answer-panel {
    order: 3;

    .panel-header {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
      padding: 12px;
    }

    .student-header {
      min-width: 0;
      gap: 10px;
    }

    .student-detail {
      min-width: 0;
    }

    .student-detail h3 {
      font-size: 16px;
    }

    .student-detail p {
      line-height: 1.4;
      white-space: normal;
    }

    .nav-buttons {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      width: 100%;
    }

    .nav-buttons .el-button {
      width: 100%;
      margin-left: 0;
    }

    .answer-list {
      padding: 12px;
      overflow: visible;
    }

    .answer-item {
      padding: 12px;
      margin-bottom: 12px;
      border-radius: 12px;
      scroll-margin-top: calc(var(--pure-safe-area-top, 0px) + 104px);
    }

    .question-header {
      align-items: flex-start;
      gap: 8px;
      flex-wrap: wrap;
    }

    .question-number {
      min-width: 0;
      gap: 8px;
      flex-wrap: wrap;
    }

    .question-title {
      font-size: 14px;
    }

    .answer-section,
    .grading-section {
      padding: 12px;
    }

    .answer-row {
      flex-direction: column;
      gap: 4px;
    }

    .answer-label {
      width: auto;
    }

    .score-input {
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .score-input .label {
      flex: 0 0 44px;
    }

    .score-input .unit {
      flex: 1 1 auto;
    }

    .score-input :deep(.el-input-number) {
      width: 132px;
    }

    .score-input .el-button {
      margin-left: 0;
    }

    .comment-input {
      flex-direction: column;
      gap: 6px;
    }

    .comment-input .label {
      padding-top: 0;
    }

    .comment-input .el-textarea {
      width: 100%;
    }
  }
}
</style>
