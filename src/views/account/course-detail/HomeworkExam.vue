<template>
  <!-- 作业考试 -->
  <div
    v-show="visible"
    data-v-2cf49992=""
    class="homework-exam-wrapper"
    :class="currentTheme"
  >
    <!-- 头部 -->
    <CourseHeader
      :current-theme="currentTheme"
      title="作业考试"
      :user-avatar="userAvatar"
      :user-nickname="userNickname"
      @go-back="$emit('go-back')"
      @toggle-theme="e => $emit('toggle-theme', e)"
      @go-to-account="$emit('go-to-account')"
      @logout="$emit('logout')"
    />

    <!-- 内容 -->
    <div class="homework-container" :class="currentTheme">
      <el-tabs v-model="homeworkExamTab" class="homework-tabs">
        <el-tab-pane label="作业" name="homework">
          <div
            v-if="homeworkList && homeworkList.length > 0"
            class="homework-list"
          >
            <div
              v-for="(item, index) in homeworkList"
              :key="index"
              class="homework-item"
              :class="{ dark: currentTheme === 'dark' }"
              @click="viewHomework(item)"
            >
              <div class="homework-header">
                <div class="homework-icon">
                  <img :src="logo" alt="作业" />
                </div>
                <div class="homework-info">
                  <div class="homework-title">{{ item.title }}</div>
                  <div class="homework-meta">
                    <span>题目数量: {{ item.questionNum }}</span>
                    <span>总分: {{ item.totalPoints }}</span>
                    <span>截止日期: {{ formatDate(item.dueDate) }}</span>
                  </div>
                </div>
              </div>
              <div class="homework-footer">
                <div class="homework-status">
                  <el-tag
                    :type="getHomeworkStatusType(item.status)"
                    effect="plain"
                  >
                    {{ getHomeworkStatusText(item.status) }}
                  </el-tag>
                </div>
                <div class="homework-action">
                  <el-button size="small" type="primary">查看</el-button>
                </div>
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无作业">
            <template #image>
              <img
                :src="homeworkEmptyImg"
                alt="暂无作业"
                style="width: 120px; height: 120px"
              />
            </template>
          </el-empty>
        </el-tab-pane>
        <el-tab-pane label="考试" name="exam">
          <div v-if="examList && examList.length > 0" class="exam-list">
            <div
              v-for="(item, index) in examList"
              :key="index"
              class="exam-item"
              :class="{ dark: currentTheme === 'dark' }"
              @click="viewExam(item)"
            >
              <div class="exam-header">
                <div class="exam-icon">
                  <img :src="logo" alt="考试" />
                </div>
                <div class="exam-info">
                  <div class="exam-title">{{ item.title }}</div>
                  <div class="exam-meta">
                    <span>题目数量: {{ item.questionNum }}</span>
                    <span>总分: {{ item.totalPoints }}</span>
                    <span>时间限制: {{ item.timeLimit }}分钟</span>
                    <span>开始时间: {{ formatDate(item.availableFrom) }}</span>
                    <span>结束时间: {{ formatDate(item.availableTo) }}</span>
                  </div>
                </div>
              </div>
              <div class="exam-footer">
                <div class="exam-status">
                  <el-tag :type="getExamStatusType(item.status)" effect="plain">
                    {{ getExamStatusText(item.status) }}
                  </el-tag>
                </div>
                <div class="exam-action">
                  <el-button size="small" type="primary">查看</el-button>
                </div>
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无考试" />
        </el-tab-pane>
        <!-- 随练标签页：嵌入新版随练组件 -->
        <el-tab-pane label="随练" name="practice">
          <WrongExercise
            :embedded="true"
            :course-id="courseId"
            :current-theme="currentTheme"
          />
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import CourseHeader from "./CourseHeader.vue";
import WrongExercise from "@/views/account/wrong-exercise.vue";
import logo from "@/assets/iconss/exam-test-checklist-online-learning-education-online-document-svgrepo-com.svg?url";
import homeworkEmptyImg from "@/assets/new-release/homework-svgrepo-com.svg?url";

// Props
const props = defineProps<{
  visible: boolean;
  currentTheme: string;
  courseId: number;
  homeworkList: any[];
  examList: any[];
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

const router = useRouter();
const homeworkExamTab = ref("homework");

// 格式化日期
const formatDate = (dateString: string) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

// 获取作业状态类型
const getHomeworkStatusType = (status: number) => {
  const typeMap: Record<
    number,
    "info" | "warning" | "success" | "danger" | "primary"
  > = {
    1: "info", // 未开始
    2: "warning", // 进行中
    3: "success", // 已完成
    4: "danger" // 已过期
  };
  return typeMap[status] || "info";
};

// 获取作业状态文本
const getHomeworkStatusText = (status: number) => {
  const textMap: Record<number, string> = {
    1: "未开始",
    2: "进行中",
    3: "已完成",
    4: "已过期"
  };
  return textMap[status] || "未知状态";
};

// 获取考试状态类型
const getExamStatusType = (status: number) => {
  const typeMap: Record<
    number,
    "info" | "warning" | "success" | "danger" | "primary"
  > = {
    1: "info", // 未开始
    2: "warning", // 进行中
    3: "success", // 已完成
    4: "danger" // 已过期
  };
  return typeMap[status] || "info";
};

// 获取考试状态文本
const getExamStatusText = (status: number) => {
  const textMap: Record<number, string> = {
    1: "未开始",
    2: "进行中",
    3: "已完成",
    4: "已过期"
  };
  return textMap[status] || "未知状态";
};

// 查看作业
const viewHomework = (homework: any) => {
  if (homework && homework.homeworkId) {
    if (homework.status === 2) {
      router.push({
        path: `/account/homework-detail`,
        query: {
          homeworkId: homework.homeworkId,
          courseId: props.courseId.toString(),
          theme: props.currentTheme
        }
      });
    } else {
      ElMessage.warning(
        `${getHomeworkStatusText(homework.status)}状态的作业不可查看`
      );
    }
  }
};

// 查看考试
const viewExam = (exam: any) => {
  if (exam && exam.examId) {
    if (exam.status === 2) {
      router.push({
        path: `/account/exam-detail`,
        query: {
          examId: exam.examId,
          courseId: props.courseId.toString(),
          theme: props.currentTheme
        }
      });
    } else {
      ElMessage.warning(`${getExamStatusText(exam.status)}状态的考试不可查看`);
    }
  }
};
</script>

<style scoped>
/* 作业考试相关样式 - 全新设计 */
.homework-exam-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background-color: transparent;
}

.homework-exam-wrapper.dark {
  background-color: transparent;
}

.homework-container {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: 80px 32px 24px;
  overflow-y: auto;
  background-color: transparent;
}

.dark :deep(.el-empty__image img),
.dark :deep(.el-empty__image svg) {
  opacity: 0.8;
  filter: brightness(0.7);
}

.homework-container.dark {
  background-color: transparent;
}

.homework-tabs {
  width: 100%;
}

/* 标签页样式优化 */
:deep(.homework-tabs .el-tabs__header) {
  margin-bottom: 32px;
  background: linear-gradient(135deg, #fff, #f8faff);
  border-radius: 16px;
  padding: 8px;
}

.dark :deep(.homework-tabs .el-tabs__header) {
  background: linear-gradient(135deg, #111b2d, #0f172a);
  border: 1px solid rgb(56 189 248 / 20%);
}

:deep(.homework-tabs .el-tabs__nav-wrap::after) {
  display: none;
}

:deep(.homework-tabs .el-tabs__item) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  margin-right: 12px;
  padding: 0 !important;
  width: 100px;
  height: 48px !important;
  line-height: normal !important;
  font-size: 16px;
  font-weight: 600;
  color: #606266;
  border-radius: 14px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-sizing: border-box;
}

:deep(.homework-tabs .el-tabs__item span) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  margin: 0 !important;
  padding: 0 !important;
  text-align: center;
}

:deep(.homework-tabs .el-tabs__item:last-child) {
  margin-right: 0;
}

:deep(.homework-tabs .el-tabs__item:hover) {
  color: #5a6b8a;
  background: linear-gradient(
    135deg,
    rgb(220 226 247 / 40%),
    rgb(200 212 240 / 30%)
  );
}

:deep(.homework-tabs .el-tabs__item.is-active) {
  color: #333;
  background: linear-gradient(135deg, #dce2f7, #97b4f7);
}

.dark :deep(.homework-tabs .el-tabs__item) {
  color: #94a3b8;
}

.dark :deep(.homework-tabs .el-tabs__item:hover) {
  color: #f1f5f9;
  background: linear-gradient(135deg, rgb(56 189 248 / 10%), transparent);
}

.dark :deep(.homework-tabs .el-tabs__item.is-active) {
  color: #f1f5f9;
  background: linear-gradient(135deg, #38bdf8, #0ea5e9);
}

:deep(.homework-tabs .el-tabs__active-bar) {
  display: none;
}

/* 列表布局 - 网格模式 */
.homework-list,
.exam-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 24px;
  width: 100%;
  margin-top: 20px;
}

/* 卡片样式 - 全新设计 */
.homework-item,
.exam-item {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  cursor: pointer;
  background: linear-gradient(145deg, #fff, #f8faff);
  border: 1px solid rgb(220 226 247 / 60%);
  border-radius: 20px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.homework-item::before,
.exam-item::before {
  display: none;
}

.homework-item.dark,
.exam-item.dark {
  background: linear-gradient(145deg, #111b2d, #0f172a);
  border-color: #1e293b;
}

.homework-item:hover,
.exam-item:hover {
  border-color: #97b4f7;
  box-shadow: none;
}

.homework-item.dark:hover,
.exam-item.dark:hover {
  border-color: #38bdf8;
  box-shadow: none;
}

/* 卡片头部 */
.homework-header,
.exam-header {
  display: flex;
  align-items: center;
  padding: 24px;
  background: linear-gradient(135deg, rgb(220 226 247 / 20%), transparent);
}

.homework-item.dark .homework-header,
.exam-item.dark .exam-header {
  background: linear-gradient(135deg, rgb(56 189 248 / 5%), transparent);
}

.homework-icon,
.exam-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  margin-right: 20px;
  background: linear-gradient(135deg, #dce2f7, #97b4f7);
  border-radius: 18px;
  transition: all 0.3s ease;
}

.homework-item:hover .homework-icon,
.exam-item:hover .exam-icon {
  transform: none;
}

.homework-item.dark .homework-icon,
.exam-item.dark .exam-icon {
  background: linear-gradient(135deg, #38bdf8, #0ea5e9);
}

.homework-icon img,
.exam-icon img {
  width: 40px;
  height: 40px;
  object-fit: contain;
  filter: brightness(0) invert(1);
}

.homework-info,
.exam-info {
  flex-grow: 1;
  overflow: hidden;
}

.homework-title,
.exam-title {
  margin-bottom: 12px;
  overflow: hidden;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.4;
  color: #1a1a1a;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: 0.3px;
}

.homework-item.dark .homework-title,
.exam-item.dark .exam-title {
  color: #f1f5f9;
}

.homework-meta,
.exam-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  color: #5a6b8a;
}

.homework-meta span,
.exam-meta span {
  display: flex;
  align-items: center;
  gap: 6px;
}

.homework-meta span::before,
.exam-meta span::before {
  width: 4px;
  height: 4px;
  content: "";
  background: #97b4f7;
  border-radius: 50%;
}

.homework-item.dark .homework-meta,
.exam-item.dark .exam-meta {
  color: #94a3b8;
}

.homework-item.dark .homework-meta span::before,
.exam-item.dark .exam-meta span::before {
  background: #38bdf8;
}

/* 卡片底部 */
.homework-footer,
.exam-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  background: linear-gradient(180deg, transparent, rgb(220 226 247 / 10%));
  border-top: 1px solid rgb(220 226 247 / 40%);
}

.homework-item.dark .homework-footer,
.exam-item.dark .exam-footer {
  background: linear-gradient(180deg, transparent, rgb(56 189 248 / 5%));
  border-top-color: rgb(56 189 248 / 10%);
}

.homework-status,
.exam-status {
  margin: 0;
}

.homework-status :deep(.el-tag),
.exam-status :deep(.el-tag) {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  border: none;
  border-radius: 10px;
}

.homework-action,
.exam-action {
  flex-shrink: 0;
}

.homework-action :deep(.el-button),
.exam-action :deep(.el-button) {
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgb(64 158 255 / 30%);
  transition: all 0.3s ease;
}

.homework-action :deep(.el-button:hover),
.exam-action :deep(.el-button:hover) {
  box-shadow: none;
  transform: translateY(-2px);
}

/* 空状态优化 */
:deep(.el-empty) {
  padding: 80px 20px;
}

:deep(.el-empty__description) {
  margin-top: 20px;
  font-size: 16px;
  color: #909399;
}

.dark :deep(.el-empty__description) {
  color: #64748b;
}

/* 响应式布局 */
@media (max-width: 1200px) {
  .homework-list,
  .exam-list {
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  }
}

@media (max-width: 768px) {
  .homework-exam-wrapper {
    min-height: 100vh;
  }

  .homework-container {
    height: auto;
    min-height: 100vh;
    padding: var(--course-mobile-top-offset, 176px) 16px
      calc(24px + env(safe-area-inset-bottom));
    overflow: visible;
  }

  .homework-list,
  .exam-list {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 479px) {
  .homework-container {
    padding: var(--course-mobile-top-offset, 176px) 10px
      calc(20px + env(safe-area-inset-bottom));
  }
}
</style>
