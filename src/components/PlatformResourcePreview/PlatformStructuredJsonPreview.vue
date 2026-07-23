<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import {
  ArrowLeft,
  ArrowRight,
  CopyDocument,
  Document
} from "@element-plus/icons-vue";
import type {
  StructuredExerciseOption,
  StructuredPreviewView
} from "./structured-json";
import { copyPlatformText } from "@/utils/platformCapability";

defineOptions({ name: "PlatformStructuredJsonPreview" });

const props = defineProps<{ view: StructuredPreviewView }>();

const activeQuestionIndex = ref(0);
const activeTestCaseIndex = ref(0);
const showAnswers = ref(false);

const codingView = computed(() =>
  props.view.kind === "coding" ? props.view : null
);
const exerciseView = computed(() =>
  props.view.kind === "exercise" ? props.view : null
);
const documentView = computed(() =>
  props.view.kind === "document" ? props.view : null
);
const activeQuestion = computed(
  () => exerciseView.value?.questions[activeQuestionIndex.value]
);
const activeTestCase = computed(
  () => codingView.value?.testCases[activeTestCaseIndex.value]
);
const codeLines = computed(() =>
  (codingView.value?.starterCode || "").replace(/\r\n/g, "\n").split("\n")
);
const questionCodeLines = computed(() =>
  (activeQuestion.value?.code || "").replace(/\r\n/g, "\n").split("\n")
);

watch(
  () => props.view,
  () => {
    activeQuestionIndex.value = 0;
    activeTestCaseIndex.value = 0;
    showAnswers.value = false;
  }
);

async function copyText(value: string, label: string) {
  if (!value) return;
  if (await copyPlatformText(value)) {
    ElMessage.success(`${label}已复制`);
  } else {
    ElMessage.error("复制失败，请检查浏览器剪贴板权限");
  }
}

function selectQuestion(index: number) {
  activeQuestionIndex.value = Math.max(
    0,
    Math.min(index, (exerciseView.value?.questions.length || 1) - 1)
  );
}

function normalizeAnswer(value: string) {
  return value.toLowerCase().replace(/[\s,，、;；.。]/g, "");
}

function optionIsAnswer(option: StructuredExerciseOption) {
  if (!showAnswers.value || !activeQuestion.value?.answer) return false;
  const answer = normalizeAnswer(activeQuestion.value.answer);
  return [option.key, option.text].some(value =>
    answer.includes(normalizeAnswer(value))
  );
}
</script>

<template>
  <article class="structured-preview" :class="`is-${props.view.kind}`">
    <template v-if="codingView">
      <header class="structured-preview__hero">
        <div>
          <p class="structured-preview__eyebrow">编程练习</p>
          <h1>{{ codingView.title }}</h1>
          <p v-if="codingView.description" class="structured-preview__lead">
            {{ codingView.description }}
          </p>
        </div>
        <dl v-if="codingView.metadata.length" class="structured-preview__meta">
          <div v-for="item in codingView.metadata" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>
      </header>

      <div class="coding-workspace">
        <div class="coding-workspace__brief">
          <section v-if="codingView.inputSpec || codingView.outputSpec">
            <h2>输入与输出</h2>
            <dl class="coding-specs">
              <div v-if="codingView.inputSpec">
                <dt>输入</dt>
                <dd>{{ codingView.inputSpec }}</dd>
              </div>
              <div v-if="codingView.outputSpec">
                <dt>输出</dt>
                <dd>{{ codingView.outputSpec }}</dd>
              </div>
            </dl>
          </section>

          <section v-if="codingView.constraints.length">
            <h2>约束条件</h2>
            <ul class="structured-list">
              <li v-for="item in codingView.constraints" :key="item">
                {{ item }}
              </li>
            </ul>
          </section>

          <section v-if="codingView.hints.length">
            <h2>解题提示</h2>
            <ul class="structured-list">
              <li v-for="item in codingView.hints" :key="item">{{ item }}</li>
            </ul>
          </section>

          <section v-if="codingView.testCases.length">
            <div class="section-heading">
              <h2>测试样例</h2>
              <div class="case-tabs" aria-label="测试样例选择">
                <button
                  v-for="(testCase, index) in codingView.testCases"
                  :key="`${testCase.name}-${index}`"
                  type="button"
                  :class="{ 'is-active': activeTestCaseIndex === index }"
                  @click="activeTestCaseIndex = index"
                >
                  {{ index + 1 }}
                </button>
              </div>
            </div>
            <div v-if="activeTestCase" class="test-case">
              <div v-if="activeTestCase.input">
                <span>输入</span>
                <pre>{{ activeTestCase.input }}</pre>
              </div>
              <div v-if="activeTestCase.output">
                <span>预期输出</span>
                <pre>{{ activeTestCase.output }}</pre>
              </div>
              <p v-if="activeTestCase.explanation">
                {{ activeTestCase.explanation }}
              </p>
            </div>
          </section>

          <section v-if="codingView.rubric.length">
            <h2>评分标准</h2>
            <dl class="structured-fields">
              <div v-for="item in codingView.rubric" :key="item.label">
                <dt>{{ item.label }}</dt>
                <dd>{{ item.value }}</dd>
              </div>
            </dl>
          </section>
        </div>

        <aside class="code-panel" aria-label="起始代码">
          <header class="code-panel__header">
            <div>
              <span>{{ codingView.language }}</span>
              <small>起始代码</small>
            </div>
            <el-tooltip content="复制起始代码" placement="bottom">
              <el-button
                class="square-tool-button"
                :icon="CopyDocument"
                aria-label="复制起始代码"
                :disabled="!codingView.starterCode"
                @click="copyText(codingView.starterCode, '起始代码')"
              />
            </el-tooltip>
          </header>
          <ol v-if="codingView.starterCode" class="code-lines">
            <li v-for="(line, index) in codeLines" :key="index">
              <code>{{ line || " " }}</code>
            </li>
          </ol>
          <div v-else class="code-panel__empty">
            <el-icon><Document /></el-icon>
            <span>该练习未提供起始代码，可根据题目自行编写。</span>
          </div>
          <footer>
            当前预览用于阅读与复制；代码提交和运行请进入对应编程环境。
          </footer>
        </aside>
      </div>
    </template>

    <template v-else-if="exerciseView">
      <header class="structured-preview__hero">
        <div>
          <p class="structured-preview__eyebrow">练习题集</p>
          <h1>{{ exerciseView.title }}</h1>
          <p v-if="exerciseView.description" class="structured-preview__lead">
            {{ exerciseView.description }}
          </p>
        </div>
        <dl class="structured-preview__meta">
          <div v-for="item in exerciseView.metadata" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>
      </header>

      <div class="exercise-workspace">
        <nav class="exercise-nav" aria-label="题目导航">
          <button
            v-for="(_question, index) in exerciseView.questions"
            :key="index"
            type="button"
            :class="{ 'is-active': activeQuestionIndex === index }"
            :aria-label="`查看第 ${index + 1} 题`"
            @click="selectQuestion(index)"
          >
            {{ index + 1 }}
          </button>
        </nav>

        <section v-if="activeQuestion" class="exercise-question">
          <header class="exercise-question__header">
            <div>
              <p>{{ activeQuestion.title }}</p>
              <span>{{ activeQuestion.type }}</span>
              <span v-if="activeQuestion.difficulty">
                {{ activeQuestion.difficulty }}
              </span>
              <span v-if="activeQuestion.score">
                {{ activeQuestion.score }} 分
              </span>
            </div>
            <label
              v-if="activeQuestion.answer || activeQuestion.explanation"
              class="answer-toggle"
            >
              <span>{{ showAnswers ? "隐藏答案" : "显示答案" }}</span>
              <el-switch v-model="showAnswers" aria-label="显示参考答案" />
            </label>
          </header>

          <p class="exercise-question__prompt">{{ activeQuestion.prompt }}</p>

          <div v-if="activeQuestion.options.length" class="exercise-options">
            <div
              v-for="option in activeQuestion.options"
              :key="option.key"
              :class="{ 'is-answer': optionIsAnswer(option) }"
            >
              <span>{{ option.key }}</span>
              <p>{{ option.text }}</p>
            </div>
          </div>

          <div v-if="activeQuestion.code" class="question-code">
            <header>
              <span>{{ activeQuestion.language || "代码" }}</span>
              <el-tooltip content="复制代码" placement="bottom">
                <el-button
                  class="square-tool-button"
                  :icon="CopyDocument"
                  aria-label="复制代码"
                  @click="copyText(activeQuestion.code, '代码')"
                />
              </el-tooltip>
            </header>
            <ol class="code-lines">
              <li v-for="(line, index) in questionCodeLines" :key="index">
                <code>{{ line || " " }}</code>
              </li>
            </ol>
          </div>

          <div v-if="showAnswers" class="answer-panel">
            <div v-if="activeQuestion.answer">
              <span>参考答案</span>
              <p>{{ activeQuestion.answer }}</p>
            </div>
            <div v-if="activeQuestion.explanation">
              <span>题目解析</span>
              <p>{{ activeQuestion.explanation }}</p>
            </div>
          </div>

          <footer class="exercise-question__footer">
            <span>
              第 {{ activeQuestionIndex + 1 }} /
              {{ exerciseView.questions.length }}
              题
            </span>
            <div>
              <el-tooltip content="上一题" placement="top">
                <el-button
                  class="square-tool-button"
                  :icon="ArrowLeft"
                  aria-label="上一题"
                  :disabled="activeQuestionIndex === 0"
                  @click="selectQuestion(activeQuestionIndex - 1)"
                />
              </el-tooltip>
              <el-tooltip content="下一题" placement="top">
                <el-button
                  class="square-tool-button"
                  :icon="ArrowRight"
                  aria-label="下一题"
                  :disabled="
                    activeQuestionIndex === exerciseView.questions.length - 1
                  "
                  @click="selectQuestion(activeQuestionIndex + 1)"
                />
              </el-tooltip>
            </div>
          </footer>
        </section>
      </div>
    </template>

    <template v-else-if="documentView">
      <header class="structured-preview__hero">
        <div>
          <p class="structured-preview__eyebrow">结构化资料</p>
          <h1>{{ documentView.title }}</h1>
          <p v-if="documentView.description" class="structured-preview__lead">
            {{ documentView.description }}
          </p>
        </div>
        <dl
          v-if="documentView.metadata.length"
          class="structured-preview__meta"
        >
          <div v-for="item in documentView.metadata" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>
      </header>

      <div v-if="documentView.invalid" class="structured-empty">
        <el-icon><Document /></el-icon>
        <h2>暂时无法整理这份结构化内容</h2>
        <p>文件内容不是完整的 JSON，请联系资源发布者重新生成或上传。</p>
      </div>

      <div v-else class="document-sections">
        <section
          v-for="(section, sectionIndex) in documentView.sections"
          :key="`${section.title}-${sectionIndex}`"
        >
          <h2>{{ section.title }}</h2>
          <p v-if="section.kind === 'text'" class="section-text">
            {{ section.text }}
          </p>
          <ul v-else-if="section.kind === 'list'" class="structured-list">
            <li v-for="(item, index) in section.items" :key="index">
              {{ item }}
            </li>
          </ul>
          <dl v-else-if="section.kind === 'fields'" class="structured-fields">
            <div v-for="item in section.fields" :key="item.label">
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value }}</dd>
            </div>
          </dl>
          <div
            v-else-if="section.kind === 'table' && section.table"
            class="structured-table-wrap"
          >
            <table>
              <thead>
                <tr>
                  <th v-for="column in section.table.columns" :key="column.key">
                    {{ column.label }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, rowIndex) in section.table.rows"
                  :key="rowIndex"
                >
                  <td v-for="column in section.table.columns" :key="column.key">
                    {{ row[column.key] || "-" }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <div v-if="!documentView.sections.length" class="structured-empty">
          <el-icon><Document /></el-icon>
          <h2>暂无可展示内容</h2>
          <p>资源已识别，但没有面向学习者的正文数据。</p>
        </div>
      </div>
    </template>
  </article>
</template>

<style scoped>
.structured-preview {
  container-type: inline-size;
  box-sizing: border-box;
  width: 100%;
  min-height: 100%;
  padding: 32px clamp(24px, 4cqw, 54px) 56px;
  color: #29384d;
  font-size: inherit;
  line-height: 1.68;
  background: #fff;
}

.structured-preview__hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 32px;
  padding-bottom: 26px;
  border-bottom: 1px solid #dfe6ee;
}

.structured-preview__hero > div {
  min-width: 0;
}

.structured-preview__eyebrow {
  margin: 0 0 7px;
  color: #2c67a9;
  font-size: 0.78em;
  font-weight: 700;
}

.structured-preview h1,
.structured-preview h2,
.structured-preview p,
.structured-preview dl,
.structured-preview dd {
  margin-top: 0;
}

.structured-preview h1 {
  margin-bottom: 10px;
  color: #17263a;
  font-size: 1.48em;
  line-height: 1.34;
  letter-spacing: 0;
}

.structured-preview__lead {
  max-width: 78ch;
  margin-bottom: 0;
  color: #53657a;
  white-space: pre-wrap;
}

.structured-preview__meta {
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: repeat(2, minmax(96px, 1fr));
  min-width: min(310px, 42%);
  gap: 1px;
  padding: 1px;
  margin-bottom: 0;
  background: #dfe6ee;
  border: 1px solid #dfe6ee;
  border-radius: 6px;
}

.structured-preview__meta div {
  padding: 9px 11px;
  background: #f8fafc;
}

.structured-preview__meta dt,
.structured-fields dt,
.coding-specs dt {
  color: #7a899a;
  font-size: 0.74em;
}

.structured-preview__meta dd {
  margin-bottom: 0;
  color: #25364b;
  font-size: 0.88em;
  font-weight: 650;
}

.coding-workspace {
  display: grid;
  grid-template-columns: minmax(280px, 0.88fr) minmax(360px, 1.12fr);
  gap: clamp(28px, 4cqw, 52px);
  padding-top: 28px;
}

.coding-workspace__brief section,
.document-sections > section {
  padding: 0 0 24px;
  margin: 0 0 24px;
  border-bottom: 1px solid #e4eaf0;
}

.coding-workspace__brief section:last-child,
.document-sections > section:last-child {
  border-bottom: 0;
}

.structured-preview h2 {
  margin-bottom: 12px;
  color: #1d2d42;
  font-size: 1.03em;
  line-height: 1.4;
  letter-spacing: 0;
}

.coding-specs,
.structured-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 18px;
  margin-bottom: 0;
}

.coding-specs div,
.structured-fields div {
  min-width: 0;
  padding-left: 11px;
  border-left: 2px solid #c8d8ea;
}

.coding-specs dd,
.structured-fields dd {
  margin-bottom: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.structured-list {
  padding: 0;
  margin: 0;
  list-style: none;
}

.structured-list li {
  position: relative;
  padding-left: 18px;
  margin-bottom: 8px;
  overflow-wrap: anywhere;
}

.structured-list li::before {
  position: absolute;
  top: 0.68em;
  left: 2px;
  width: 6px;
  height: 6px;
  background: #5b86b8;
  border-radius: 50%;
  content: "";
  transform: translateY(-50%);
}

.section-heading,
.code-panel__header,
.question-code header,
.exercise-question__header,
.exercise-question__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-heading h2 {
  margin-bottom: 0;
}

.case-tabs {
  display: inline-flex;
  gap: 4px;
}

.case-tabs button,
.exercise-nav button {
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  padding: 0;
  color: #53677f;
  font-size: 0.78em;
  cursor: pointer;
  background: #fff;
  border: 1px solid #d4dee9;
  border-radius: 4px;
}

.case-tabs button:hover,
.case-tabs button.is-active,
.exercise-nav button:hover,
.exercise-nav button.is-active {
  color: #fff;
  background: #326caa;
  border-color: #326caa;
}

.test-case {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin-top: 12px;
  overflow: hidden;
  background: #dfe6ee;
  border: 1px solid #dfe6ee;
  border-radius: 6px;
}

.test-case > div,
.test-case > p {
  min-width: 0;
  padding: 12px 14px;
  margin: 0;
  background: #f8fafc;
}

.test-case > p {
  grid-column: 1 / -1;
  color: #64758a;
}

.test-case span {
  display: block;
  margin-bottom: 5px;
  color: #75859a;
  font-size: 0.74em;
}

.test-case pre {
  margin: 0;
  overflow: auto;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 0.86em;
  line-height: 1.55;
  white-space: pre-wrap;
}

.code-panel,
.question-code {
  align-self: start;
  overflow: hidden;
  color: #dbe7f5;
  background: #172234;
  border: 1px solid #273750;
  border-radius: 6px;
}

.code-panel {
  position: sticky;
  top: 0;
  max-height: min(680px, calc(100vh - 210px));
}

.code-panel__header,
.question-code header {
  min-height: 48px;
  padding: 7px 9px 7px 15px;
  background: #1e2d43;
  border-bottom: 1px solid #33445c;
}

.code-panel__header > div {
  display: flex;
  flex-direction: column;
}

.code-panel__header span,
.question-code header > span {
  color: #f1f6fc;
  font-size: 0.84em;
  font-weight: 650;
}

.code-panel__header small {
  color: #8fa2ba;
  font-size: 0.7em;
}

.square-tool-button {
  width: 34px;
  height: 34px;
  padding: 0;
  border-radius: 4px;
}

.code-panel .square-tool-button,
.question-code .square-tool-button {
  color: #dbe7f5;
  background: #25364e;
  border-color: #435774;
}

.code-lines {
  min-height: 210px;
  max-height: calc(min(680px, 100vh - 210px) - 90px);
  padding: 15px 0 17px 3.8em;
  margin: 0;
  overflow: auto;
  color: #71859f;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 0.83em;
  line-height: 1.75;
  background: #172234;
}

.code-lines li {
  padding: 0 18px 0 8px;
}

.code-lines code {
  display: block;
  color: #d8e4f2;
  white-space: pre;
}

.code-panel__empty,
.structured-empty {
  display: flex;
  min-height: 210px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  color: #91a4bc;
  text-align: center;
}

.code-panel footer {
  padding: 9px 14px;
  color: #8fa2ba;
  font-size: 0.7em;
  line-height: 1.45;
  background: #1e2d43;
  border-top: 1px solid #33445c;
}

.exercise-workspace {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr);
  gap: 26px;
  padding-top: 28px;
}

.exercise-nav {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.exercise-nav button {
  width: 38px;
  height: 38px;
}

.exercise-question {
  min-width: 0;
}

.exercise-question__header {
  padding-bottom: 16px;
  border-bottom: 1px solid #e1e7ee;
}

.exercise-question__header > div {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
}

.exercise-question__header p {
  width: 100%;
  margin-bottom: 2px;
  color: #1d2d42;
  font-size: 1.04em;
  font-weight: 700;
}

.exercise-question__header > div > span {
  padding: 2px 7px;
  color: #59708a;
  font-size: 0.72em;
  background: #f1f5f9;
  border: 1px solid #dbe4ed;
  border-radius: 4px;
}

.answer-toggle {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  color: #63758a;
  font-size: 0.78em;
}

.exercise-question__prompt {
  margin: 24px 0;
  color: #24354a;
  font-size: 1.06em;
  line-height: 1.78;
  white-space: pre-wrap;
}

.exercise-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 24px;
}

.exercise-options > div {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 10px;
  padding: 11px 12px;
  background: #fafbfd;
  border: 1px solid #dfe6ee;
  border-radius: 6px;
}

.exercise-options > div > span {
  display: inline-flex;
  flex: 0 0 auto;
  width: 25px;
  height: 25px;
  align-items: center;
  justify-content: center;
  color: #42668d;
  font-size: 0.76em;
  font-weight: 700;
  background: #eaf1f8;
  border-radius: 4px;
}

.exercise-options p {
  margin-bottom: 0;
  overflow-wrap: anywhere;
}

.exercise-options > div.is-answer {
  background: #f1faf5;
  border-color: #add4bd;
}

.exercise-options > div.is-answer > span {
  color: #fff;
  background: #28744e;
}

.question-code {
  margin: 22px 0;
}

.question-code .code-lines {
  min-height: 120px;
  max-height: 360px;
}

.answer-panel {
  padding: 4px 0;
  margin: 22px 0;
  background: #f7faf8;
  border-top: 1px solid #cfe1d6;
  border-bottom: 1px solid #cfe1d6;
}

.answer-panel > div {
  padding: 13px 16px;
}

.answer-panel > div + div {
  border-top: 1px solid #dce9e1;
}

.answer-panel span {
  display: block;
  margin-bottom: 4px;
  color: #26704c;
  font-size: 0.74em;
  font-weight: 700;
}

.answer-panel p {
  margin-bottom: 0;
  white-space: pre-wrap;
}

.exercise-question__footer {
  padding-top: 18px;
  color: #718196;
  font-size: 0.78em;
  border-top: 1px solid #e1e7ee;
}

.exercise-question__footer > div {
  display: inline-flex;
  gap: 7px;
}

.document-sections {
  padding-top: 28px;
}

.section-text {
  margin-bottom: 0;
  white-space: pre-wrap;
}

.structured-table-wrap {
  width: 100%;
  overflow: auto;
  border: 1px solid #dfe6ee;
  border-radius: 6px;
}

.structured-table-wrap table {
  width: 100%;
  min-width: 560px;
  border-spacing: 0;
  border-collapse: collapse;
}

.structured-table-wrap th,
.structured-table-wrap td {
  padding: 10px 12px;
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
  border-right: 1px solid #e3e9ef;
  border-bottom: 1px solid #e3e9ef;
}

.structured-table-wrap th {
  color: #53657a;
  font-size: 0.78em;
  font-weight: 700;
  background: #f3f6f9;
}

.structured-table-wrap td {
  font-size: 0.87em;
}

.structured-table-wrap tr:last-child td {
  border-bottom: 0;
}

.structured-table-wrap th:last-child,
.structured-table-wrap td:last-child {
  border-right: 0;
}

.structured-empty {
  min-height: 320px;
  color: #7d8da0;
}

.structured-empty .el-icon {
  font-size: 30px;
}

.structured-empty h2,
.structured-empty p {
  margin-bottom: 0;
}

.structured-empty p {
  max-width: 46ch;
}

:global(.dark) .structured-preview {
  color: #cbd7e5;
  background: #182131;
}

:global(.dark) .structured-preview h1,
:global(.dark) .structured-preview h2,
:global(.dark) .exercise-question__prompt {
  color: #e6edf7;
}

:global(.dark) .structured-preview__meta,
:global(.dark) .test-case {
  background: #33445b;
  border-color: #33445b;
}

:global(.dark) .structured-preview__meta div,
:global(.dark) .test-case > div,
:global(.dark) .test-case > p,
:global(.dark) .exercise-options > div,
:global(.dark) .structured-table-wrap th {
  background: #1e2a3b;
}

@container (max-width: 820px) {
  .structured-preview__hero,
  .coding-workspace {
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .structured-preview__meta {
    width: 100%;
    min-width: 0;
  }

  .code-panel {
    position: static;
    max-height: none;
  }

  .code-lines {
    max-height: 460px;
  }
}

@container (max-width: 560px) {
  .structured-preview {
    padding: 18px 12px 32px;
  }

  .coding-specs,
  .structured-fields,
  .test-case,
  .exercise-options {
    grid-template-columns: 1fr;
  }

  .exercise-workspace {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .exercise-nav {
    flex-direction: row;
    padding-bottom: 5px;
    overflow-x: auto;
  }

  .exercise-nav button {
    flex: 0 0 auto;
    width: 44px;
    height: 44px;
  }

  .exercise-question__header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
