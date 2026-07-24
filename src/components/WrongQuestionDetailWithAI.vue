<template>
  <el-dialog
    v-model="visible"
    :title="titleText"
    width="70%"
    :before-close="handleClose"
    :class="['custom-ai-detail-dialog', currentTheme]"
    :append-to-body="true"
    :destroy-on-close="true"
  >
    <div
      v-loading="loading"
      class="wrap"
      :class="{ dark: currentTheme === 'dark' }"
    >
      <!-- 原题区域 -->
      <section class="block">
        <h3 class="h3">题目</h3>
        <div class="stem" v-html="wrong?.stem" />
        <div v-if="isChoice" class="options">
          <ul>
            <li v-for="(opt, i) in parsedOptions" :key="i">
              <b class="label">{{ opt.optionId }}.</b>
              <span v-html="opt.content" />
            </li>
          </ul>
        </div>
        <div class="answers">
          <el-button text type="primary" @click="toggleBase">{{
            baseOpened ? "隐藏答案/解析" : "查看答案/解析"
          }}</el-button>
          <el-collapse-transition>
            <div v-show="baseOpened" class="base">
              <div class="line">
                <span>学生答案：</span
                ><b class="uans">{{ wrong?.userAnswer }}</b>
              </div>
              <div class="line">
                <span>正确答案：</span
                ><b class="cans">{{ displayCorrectAnswer }}</b>
              </div>
              <div v-if="wrong?.analysis" class="prewrap">
                {{ wrong?.analysis }}
              </div>
            </div>
          </el-collapse-transition>
        </div>
      </section>

      <!-- AI 分析 -->
      <section class="block">
        <div class="ai-header">
          <h3 class="h3">AI 错题分析</h3>
          <el-button
            v-if="!analysis"
            type="primary"
            :loading="analyzing"
            :disabled="!canAnalyze"
            @click="doAnalyze"
            >立即分析</el-button
          >
        </div>

        <el-alert
          v-if="!analysis && !canAnalyze"
          class="course-context-alert"
          title="请从具体课程进入随练后使用 AI 分析。"
          type="info"
          show-icon
          :closable="false"
        />

        <div v-if="analysis" class="analysis">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="错误类型">{{
              analysis.error_type
            }}</el-descriptions-item>
            <el-descriptions-item label="涉及知识点">
              <el-tag
                v-for="(kp, i) in analysis.knowledge_points"
                :key="i"
                class="mr8"
                type="info"
                >{{ kp }}</el-tag
              >
            </el-descriptions-item>
            <el-descriptions-item :span="2" label="错误原因">
              <div class="prewrap">{{ analysis.error_reason }}</div>
            </el-descriptions-item>
            <el-descriptions-item :span="2" label="学习建议">
              <div class="prewrap">{{ analysis.learning_suggestions }}</div>
            </el-descriptions-item>
          </el-descriptions>
        </div>
        <el-empty v-else description="未分析，点击立即分析获取结果" />
      </section>

      <!-- 相似练习 -->
      <section v-if="generatedExercises.length" class="block">
        <h3 class="h3">相似练习（{{ generatedExercises.length }}）</h3>
        <div class="sim-list">
          <div
            v-for="(ex, idx) in generatedExercises"
            :key="ex.exercise_id || idx"
            class="sim-item"
          >
            <div class="q">
              <b>{{ idx + 1 }}.</b>
              <div class="qtxt" v-html="ex.question" />
            </div>
            <div v-if="ex.options && ex.options.length" class="opts">
              <ul>
                <li v-for="(o, i2) in ex.options" :key="i2">
                  <template v-if="needsPrefix(o)"
                    ><b>{{ abcd(i2) }}.</b> {{ stripPrefix(o) }}</template
                  >
                  <template v-else><span v-html="o" /></template>
                </li>
              </ul>
            </div>
            <el-button text type="primary" @click="toggleExplain(idx)">{{
              showExplain[idx] ? "隐藏解析" : "查看解析"
            }}</el-button>
            <el-collapse-transition>
              <div v-show="showExplain[idx]" class="exp">
                <div v-if="ex.correct_answer" class="line">
                  正确答案：<b>{{ ex.correct_answer }}</b>
                </div>
                <div v-if="ex.explanation" class="prewrap">
                  {{ ex.explanation }}
                </div>
              </div>
            </el-collapse-transition>
          </div>
        </div>
      </section>
    </div>

    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { ElMessage } from "element-plus";
import {
  analyzeWrongExercise,
  type WrongExerciseAnalyzeResponse,
  type GeneratedExercise
} from "@/api/frontend/wrong-exercise";

export interface NormalizedWrongQuestion {
  id: number | string;
  questionId?: number | string;
  questionType?: number;
  title?: string;
  stem: string;
  options?: string | null;
  analysis?: string | null;
  answer?: string;
  userAnswer?: string;
}

const props = defineProps<{
  modelValue: boolean;
  courseId?: number | string;
  currentTheme?: string;
  wrong: NormalizedWrongQuestion | null;
  initialAnalysis?: WrongExerciseAnalyzeResponse | null;
}>();

const emit = defineEmits(["update:modelValue", "analyzed"]);

const visible = ref<boolean>(props.modelValue);
const loading = ref(false);
const analyzing = ref(false);
const baseOpened = ref(false);
const analysis = ref<WrongExerciseAnalyzeResponse["analysis"] | null>(
  props.initialAnalysis?.analysis || null
);
const generatedExercises = ref<GeneratedExercise[]>(
  props.initialAnalysis?.generated_exercises || []
);

watch(
  () => props.modelValue,
  v => (visible.value = v)
);
watch(
  () => visible.value,
  v => emit("update:modelValue", v)
);
watch(
  () => props.initialAnalysis,
  v => {
    analysis.value = v?.analysis || null;
    generatedExercises.value = v?.generated_exercises || [];
  }
);

const titleText = computed(() => props.wrong?.title || "错题详情");
const canAnalyze = computed(() => {
  const courseId = Number(props.courseId);
  return Number.isSafeInteger(courseId) && courseId > 0;
});
const isChoice = computed(
  () => props.wrong?.questionType === 1 || props.wrong?.questionType === 2
);

const parsedOptions = computed(() => {
  const raw = props.wrong?.options;
  const out: Array<{ optionId: string; content: string }> = [];
  if (!raw || !isChoice.value) return out;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) {
      return parsed.map((c: any, i: number) => ({
        optionId: String.fromCharCode(65 + i),
        content: String(c)
      }));
    }
    if (parsed && typeof parsed === "object") {
      // { "A": "...", "B": "..." }
      const keys = Object.keys(parsed).sort();
      for (const k of keys)
        out.push({ optionId: k, content: String(parsed[k]) });
      return out;
    }
    return out;
  } catch {
    return out;
  }
});

const displayCorrectAnswer = computed(() => {
  const ans = props.wrong?.answer;
  if (!ans) return "";
  try {
    const parsed = JSON.parse(ans);
    return Array.isArray(parsed) ? parsed.join(", ") : String(parsed);
  } catch {
    return String(ans);
  }
});

const toggleBase = () => (baseOpened.value = !baseOpened.value);
const abcd = (i: number) => String.fromCharCode(65 + i);
// 判断是否需要我们加前缀（如果后端已经带 'A.' 或 'A、' 等就不再加）
const needsPrefix = (o: string) => !/^\s*[A-D][\.|、]/.test(o);
const stripPrefix = (o: string) => o.replace(/^\s*[A-D][\.|、]\s*/, "");
const showExplain = ref<Record<number, boolean>>({});
const toggleExplain = (i: number) =>
  (showExplain.value[i] = !showExplain.value[i]);

const doAnalyze = async () => {
  if (!props.wrong) return;
  const courseId = Number(props.courseId);
  if (!Number.isSafeInteger(courseId) || courseId <= 0) {
    ElMessage.warning("请从具体课程进入随练后使用 AI 分析");
    return;
  }
  analyzing.value = true;
  try {
    const original_exercise_id = String(
      props.wrong.questionId || props.wrong.id
    );
    const { data } = await analyzeWrongExercise({
      course_id: courseId,
      original_exercise_id,
      original_exercise_content: props.wrong.stem,
      student_answer: props.wrong.userAnswer || "",
      correct_answer: props.wrong.answer || ""
    });
    if (data) {
      analysis.value = data.analysis;
      generatedExercises.value = data.generated_exercises || [];
      emit("analyzed", { key: original_exercise_id, response: data });
      ElMessage.success("分析完成");
    }
  } catch (e) {
    ElMessage.error("分析失败");
  } finally {
    analyzing.value = false;
  }
};

const handleClose = () => (visible.value = false);
</script>

<style scoped>
.wrap {
  box-sizing: border-box;
  max-height: 75vh;
  overflow-y: auto;
}

.wrap.dark {
  color: #e2e8f0;
}

.block {
  margin-bottom: 28px;
}

.block:last-child {
  margin-bottom: 0;
}

.course-context-alert {
  margin-bottom: 16px;
}

.h3 {
  position: relative;
  margin: 0 0 16px;
  padding-left: 12px;
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: 0.3px;
}

.h3::before {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 0;
  width: 4px;
  content: "";
  background: linear-gradient(180deg, #dce2f7, #97b4f7);
  border-radius: 3px;
}

.wrap.dark .h3 {
  color: #f1f5f9;
}

.wrap.dark .h3::before {
  background: linear-gradient(180deg, #38bdf8, #0ea5e9);
}

.stem {
  padding: 18px 22px;
  margin-bottom: 16px;
  font-size: 15px;
  line-height: 1.7;
  color: #1a1a1a;
  background: linear-gradient(145deg, #fff, #f4f7ff);
  border: 1px solid rgb(220 226 247 / 70%);
  border-radius: 14px;
}

.wrap.dark .stem {
  color: #e2e8f0;
  background: linear-gradient(145deg, #111b2d, #0f172a);
  border-color: #1e293b;
}

.wrap.dark .stem :deep(*) {
  color: #e2e8f0;
}

.options ul {
  padding: 0;
  margin: 12px 0 0;
  list-style: none;
}

.options li {
  display: flex;
  align-items: flex-start;
  padding: 10px 0;
  font-size: 15px;
  color: #1a1a1a;
}

.wrap.dark .options li {
  color: #e2e8f0;
}

.options .label {
  margin-right: 12px;
  font-weight: bold;
  color: #5a6cd1;
}

.wrap.dark .options .label {
  color: #38bdf8;
}

.answers {
  margin-top: 16px;
}

.base {
  padding: 18px 22px;
  margin-top: 14px;
  background: linear-gradient(145deg, rgb(220 226 247 / 25%), transparent);
  border: 1px solid rgb(220 226 247 / 60%);
  border-radius: 14px;
}

.wrap.dark .base {
  color: #e2e8f0;
  background: linear-gradient(145deg, rgb(56 189 248 / 6%), transparent);
  border-color: #1e293b;
}

.base .line {
  margin-bottom: 8px;
  font-size: 14px;
}

.base .line:last-child {
  margin-bottom: 0;
}

.uans {
  color: #5a6cd1;
}

.cans {
  color: #14b8a6;
}

.wrap.dark .uans {
  color: #38bdf8;
}

.wrap.dark .cans {
  color: #5eead4;
}

.ai-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.ai-header :deep(.el-button--primary) {
  padding: 10px 22px;
  font-size: 13px;
  font-weight: 600;
  color: #1a1a1a;
  background: linear-gradient(135deg, #dce2f7, #97b4f7);
  border: none;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgb(151 180 247 / 30%);
}

.ai-header :deep(.el-button--primary:hover) {
  color: #1a1a1a;
  background: linear-gradient(135deg, #c9d2f3, #7f9ff5);
  box-shadow: 0 6px 16px rgb(151 180 247 / 40%);
  transform: translateY(-1px);
}

.wrap.dark .ai-header :deep(.el-button--primary) {
  color: #f1f5f9;
  background: linear-gradient(135deg, #38bdf8, #0ea5e9);
  box-shadow: 0 4px 12px rgb(56 189 248 / 30%);
}

.wrap.dark .ai-header :deep(.el-button--primary:hover) {
  background: linear-gradient(135deg, #0ea5e9, #0284c7);
}

.answers :deep(.el-button--text),
.sim-item :deep(.el-button--text) {
  padding: 4px 10px;
  font-weight: 600;
  color: #5a6cd1;
  border-radius: 8px;
}

.answers :deep(.el-button--text:hover),
.sim-item :deep(.el-button--text:hover) {
  color: #4753b8;
  background: rgb(220 226 247 / 50%);
}

.wrap.dark .answers :deep(.el-button--text),
.wrap.dark .sim-item :deep(.el-button--text) {
  color: #38bdf8;
}

.wrap.dark .answers :deep(.el-button--text:hover),
.wrap.dark .sim-item :deep(.el-button--text:hover) {
  color: #7dd3fc;
  background: rgb(56 189 248 / 12%);
}

.prewrap {
  line-height: 1.7;
  white-space: pre-wrap;
}

.analysis :deep(.el-descriptions) {
  border-radius: 14px;
  overflow: hidden;
}

.analysis :deep(.el-descriptions__body),
.analysis :deep(.el-descriptions__cell),
.analysis :deep(.el-descriptions__label),
.analysis :deep(.el-descriptions__content) {
  border-color: rgb(220 226 247 / 70%) !important;
}

.wrap.dark .analysis :deep(.el-descriptions__body),
.wrap.dark .analysis :deep(.el-descriptions__cell),
.wrap.dark .analysis :deep(.el-descriptions__label),
.wrap.dark .analysis :deep(.el-descriptions__content) {
  border-color: #1e293b !important;
}

.sim-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sim-item {
  padding: 20px 22px;
  color: #1a1a1a;
  background: linear-gradient(145deg, #fff, #f8faff);
  border: 1px solid rgb(220 226 247 / 60%);
  border-radius: 14px;
  transition: all 0.3s ease;
}

.sim-item:hover {
  border-color: #97b4f7;
  box-shadow: 0 6px 18px rgb(151 180 247 / 15%);
}

.wrap.dark .sim-item {
  color: #e2e8f0;
  background: linear-gradient(145deg, #111b2d, #0f172a);
  border-color: #1e293b;
}

.wrap.dark .sim-item:hover {
  border-color: #38bdf8;
  box-shadow: 0 6px 18px rgb(56 189 248 / 15%);
}

.q {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
  font-size: 15px;
  font-weight: 600;
}

.qtxt {
  flex: 1;
}

.exp {
  padding: 14px 18px;
  margin-top: 12px;
  font-size: 14px;
  line-height: 1.7;
  background: linear-gradient(145deg, rgb(220 226 247 / 25%), transparent);
  border-left: 3px solid #97b4f7;
  border-radius: 10px;
}

.wrap.dark .exp {
  color: #e2e8f0;
  background: linear-gradient(145deg, rgb(56 189 248 / 6%), transparent);
  border-left-color: #38bdf8;
}

.mr8 {
  margin-right: 8px;
  border-radius: 8px;
}
</style>

<style>
/* 彻底加固弹窗样式（处理 Portal 渲染） */
.custom-ai-detail-dialog .el-dialog {
  overflow: hidden !important;
  background: linear-gradient(145deg, #fff, #f8faff) !important;
  border: 1px solid rgb(220 226 247 / 60%) !important;
  border-radius: 20px !important;
  box-shadow: 0 20px 60px rgb(151 180 247 / 25%) !important;
}

.custom-ai-detail-dialog .el-dialog__header {
  padding: 22px 32px 18px !important;
  margin-right: 0 !important;
  background: linear-gradient(
    135deg,
    rgb(220 226 247 / 30%),
    transparent
  ) !important;
  border-bottom: 1px solid rgb(220 226 247 / 60%) !important;
}

.custom-ai-detail-dialog .el-dialog__title {
  font-size: 16px !important;
  font-weight: 700 !important;
  color: #1a1a1a !important;
  letter-spacing: 0.3px;
}

.custom-ai-detail-dialog .el-dialog__headerbtn {
  top: 18px !important;
  right: 18px !important;
  width: 32px !important;
  height: 32px !important;
  background: rgb(220 226 247 / 40%) !important;
  border-radius: 10px !important;
  transition: all 0.3s ease;
}

.custom-ai-detail-dialog .el-dialog__headerbtn:hover {
  background: linear-gradient(135deg, #dce2f7, #97b4f7) !important;
}

.custom-ai-detail-dialog .el-dialog__close {
  font-size: 16px !important;
  color: #5a6b8a !important;
}

.custom-ai-detail-dialog .el-dialog__headerbtn:hover .el-dialog__close {
  color: #1a1a1a !important;
}

.custom-ai-detail-dialog .el-dialog__body {
  padding: 0 !important;
}

.custom-ai-detail-dialog .wrap {
  padding: 28px 32px 32px !important;
}

.custom-ai-detail-dialog .el-dialog__footer {
  padding: 14px 32px 20px !important;
  background: linear-gradient(
    180deg,
    transparent,
    rgb(220 226 247 / 20%)
  ) !important;
  border-top: 1px solid rgb(220 226 247 / 60%) !important;
}

.custom-ai-detail-dialog .el-dialog__footer .el-button {
  padding: 8px 22px !important;
  font-weight: 600 !important;
  border-radius: 10px !important;
}

.custom-ai-detail-dialog.dark .el-dialog,
html.dark .custom-ai-detail-dialog .el-dialog {
  --el-dialog-bg-color: #0f172a;

  background: linear-gradient(145deg, #111b2d, #0f172a) !important;
  border-color: #1e293b !important;
  box-shadow: 0 20px 60px rgb(0 0 0 / 50%) !important;
}

.custom-ai-detail-dialog.dark .el-dialog__header,
html.dark .custom-ai-detail-dialog .el-dialog__header {
  background: linear-gradient(
    135deg,
    rgb(56 189 248 / 8%),
    transparent
  ) !important;
  border-bottom-color: #1e293b !important;
}

.custom-ai-detail-dialog.dark .el-dialog__title,
html.dark .custom-ai-detail-dialog .el-dialog__title {
  color: #f1f5f9 !important;
}

.custom-ai-detail-dialog.dark .el-dialog__headerbtn,
html.dark .custom-ai-detail-dialog .el-dialog__headerbtn {
  background: rgb(56 189 248 / 12%) !important;
}

.custom-ai-detail-dialog.dark .el-dialog__headerbtn:hover,
html.dark .custom-ai-detail-dialog .el-dialog__headerbtn:hover {
  background: linear-gradient(135deg, #38bdf8, #0ea5e9) !important;
}

.custom-ai-detail-dialog.dark .el-dialog__close,
html.dark .custom-ai-detail-dialog .el-dialog__close {
  color: #94a3b8 !important;
}

.custom-ai-detail-dialog.dark .el-dialog__headerbtn:hover .el-dialog__close,
html.dark
  .custom-ai-detail-dialog
  .el-dialog__headerbtn:hover
  .el-dialog__close {
  color: #f1f5f9 !important;
}

.custom-ai-detail-dialog.dark .el-dialog__footer,
html.dark .custom-ai-detail-dialog .el-dialog__footer {
  background: linear-gradient(
    180deg,
    transparent,
    rgb(56 189 248 / 6%)
  ) !important;
  border-top-color: #1e293b !important;
}
html.dark .custom-ai-detail-dialog .el-dialog__header {
  background: linear-gradient(
    135deg,
    rgb(56 189 248 / 8%),
    transparent
  ) !important;
  border-bottom: 1px solid #1e293b !important;
}

.custom-ai-detail-dialog.dark .el-dialog__title,
html.dark .custom-ai-detail-dialog .el-dialog__title {
  color: #f1f5f9 !important;
}

.custom-ai-detail-dialog.dark .el-dialog__body,
html.dark .custom-ai-detail-dialog .el-dialog__body {
  color: #e2e8f0;
  background: transparent !important;
}

.custom-ai-detail-dialog.dark .el-dialog__footer,
html.dark .custom-ai-detail-dialog .el-dialog__footer {
  background: linear-gradient(
    180deg,
    transparent,
    rgb(56 189 248 / 6%)
  ) !important;
  border-top: 1px solid #1e293b !important;
}

/* 描述列表深色模式加固 */
.custom-ai-detail-dialog.dark .el-descriptions__body,
html.dark .custom-ai-detail-dialog .el-descriptions__body {
  background-color: transparent;
}

.custom-ai-detail-dialog.dark .el-descriptions__label,
html.dark .custom-ai-detail-dialog .el-descriptions__label {
  color: #94a3b8;
  background: rgb(56 189 248 / 8%);
  border-color: #1e293b !important;
}

.custom-ai-detail-dialog.dark .el-descriptions__content,
html.dark .custom-ai-detail-dialog .el-descriptions__content {
  color: #e2e8f0;
  background-color: transparent;
  border-color: #1e293b !important;
}

.custom-ai-detail-dialog.dark .el-descriptions--border,
html.dark .custom-ai-detail-dialog .el-descriptions--border {
  border-color: #1e293b !important;
}

/* 按钮和空状态加固 */
.custom-ai-detail-dialog.dark .el-button--default:not(.is-text),
html.dark .custom-ai-detail-dialog .el-button--default:not(.is-text) {
  color: #e2e8f0;
  background: rgb(56 189 248 / 8%);
  border-color: #1e293b;
}

.custom-ai-detail-dialog.dark .el-button--default:not(.is-text):hover,
html.dark .custom-ai-detail-dialog .el-button--default:not(.is-text):hover {
  color: #f1f5f9;
  background: linear-gradient(135deg, #38bdf8, #0ea5e9);
  border-color: transparent;
}

.custom-ai-detail-dialog.dark .el-empty__description p,
html.dark .custom-ai-detail-dialog .el-empty__description p {
  color: #94a3b8;
}
</style>
