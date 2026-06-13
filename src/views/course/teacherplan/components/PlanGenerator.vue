<template>
  <div
    :class="[
      'generator-container h-full flex flex-col p-6 overflow-y-auto custom-scrollbar',
      { 'is-mobile-layout': isMobileLayout }
    ]"
  >
    <div
      v-show="!generateSuccess"
      class="generator-shell flex-1 flex flex-col gap-8 max-w-[1400px] mx-auto w-full"
    >
      <!-- 顶部向导 - 宽度铺满 -->
      <div
        class="generator-hero bg-gradient-to-r from-[var(--el-color-primary-light-9)] to-[var(--el-bg-color-overlay)] border border-[var(--el-border-color-light)] rounded-3xl p-8 flex items-start space-x-8 shadow-sm relative overflow-hidden"
      >
        <!-- 装饰性光晕 -->
        <div
          class="absolute -right-20 -top-20 w-64 h-64 bg-[var(--el-color-primary)] opacity-[0.03] rounded-full blur-3xl pointer-events-none"
        />

        <div class="absolute right-0 top-0 opacity-[0.05] blur-[1px]">
          <el-icon class="text-9xl"><MagicStick /></el-icon>
        </div>

        <div
          class="generator-hero__icon w-20 h-20 bg-[var(--el-bg-color-overlay)] rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] flex items-center justify-center flex-shrink-0 text-[var(--el-color-primary)] border border-[var(--el-border-color-lighter)] relative z-10"
        >
          <el-icon class="text-4xl"><Cpu /></el-icon>
        </div>

        <div class="generator-hero__copy flex-1 relative z-10">
          <h3
            class="generator-hero__title text-2xl font-bold text-[var(--el-text-color-primary)] mb-2 tracking-tight"
          >
            AI 教案智能生成工作台
          </h3>
          <p
            class="generator-hero__description text-base text-[var(--el-text-color-regular)] leading-relaxed max-w-4xl opacity-90 font-medium"
          >
            欢迎使用 AI
            教学辅助系统。请在左侧课程中心选择目标课程，并在下方指定该课程的教学章节。我们将调用业内领先的教育大模型，为您深度拆解教学重难点，并输出一份结构完整的标准化教案。
          </p>
        </div>
      </div>

      <div
        class="generator-grid flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0"
      >
        <!-- 主要选择区 - 占据核心位置 -->
        <div
          class="generator-main-card lg:col-span-8 bg-[var(--el-bg-color-overlay)] rounded-3xl p-12 border border-[var(--el-border-color-light)] shadow-sm relative overflow-hidden flex flex-col justify-center min-h-[460px]"
        >
          <!-- 背景装饰 -->
          <div
            class="absolute -top-32 -right-32 w-96 h-96 bg-[var(--el-color-primary)] opacity-[0.04] rounded-full blur-3xl pointer-events-none"
          />
          <div
            class="absolute -bottom-16 -left-16 w-64 h-64 bg-[var(--el-color-success)] opacity-[0.03] rounded-full blur-3xl pointer-events-none"
          />

          <el-form
            :model="form"
            label-position="top"
            class="w-full relative z-10"
          >
            <el-form-item class="!mb-14">
              <template #label>
                <div
                  class="generator-section-label flex items-center justify-between w-full mb-6"
                >
                  <span
                    class="generator-section-title flex items-center text-xl font-bold text-[var(--el-text-color-primary)]"
                  >
                    <el-icon class="mr-3 text-[var(--el-color-primary)]"
                      ><Management
                    /></el-icon>
                    指定生成章节
                  </span>
                  <div class="flex items-center gap-3">
                    <el-tag
                      v-if="props.courseId"
                      size="large"
                      type="success"
                      effect="plain"
                      class="!rounded-xl border-[var(--el-color-success-light-5)]"
                    >
                      <span class="flex items-center"
                        ><el-icon class="mr-1"><Check /></el-icon>
                        课程已关联</span
                      >
                    </el-tag>
                  </div>
                </div>
              </template>

              <el-select
                v-model="form.chapterId"
                placeholder="请点击下拉菜单选择需要生成教案的章节内容"
                class="w-full custom-select-large"
                size="large"
                :loading="chapterLoading"
                :disabled="!props.courseId"
              >
                <template #empty>
                  <div
                    class="py-14 text-center text-[var(--el-text-color-placeholder)]"
                  >
                    <el-icon class="text-6xl mb-4 opacity-20"><Box /></el-icon>
                    <p v-if="!props.courseId" class="text-base font-bold">
                      请先在左侧课程中心激活目标课程
                    </p>
                    <p v-else class="text-base">
                      该课程暂无章节数据，请先维护课程章节
                    </p>
                  </div>
                </template>
                <el-option
                  v-for="chapter in chapterOptions"
                  :key="chapter.chapterId"
                  :label="chapter.name"
                  :value="chapter.chapterId"
                />
              </el-select>
            </el-form-item>

            <div
              class="flex flex-col items-center justify-center pt-8 border-t border-[var(--el-border-color-lighter)]"
            >
              <el-button
                type="primary"
                :disabled="!props.courseId || !form.chapterId"
                :loading="loading"
                size="large"
                class="generator-submit-button !rounded-2xl !px-20 !h-16 !text-xl shadow-2xl shadow-[var(--el-color-primary-light-7)] transform transition-all hover:scale-[1.02] hover:-translate-y-1 active:scale-95"
                @click="generatePlan"
              >
                <template #icon>
                  <el-icon v-if="!loading" class="mr-2"><MagicStick /></el-icon>
                </template>
                {{
                  loading
                    ? isMobileLayout
                      ? "AI 生成中..."
                      : "大模型深度计算生成中..."
                    : isMobileLayout
                      ? "立即生成教案"
                      : "立即开启 AI 智能解析生成"
                }}
              </el-button>
              <p
                class="generator-submit-hint mt-8 text-sm text-[var(--el-text-color-placeholder)] flex items-center"
              >
                <el-icon class="mr-2 text-[var(--el-color-warning)]"
                  ><InfoFilled
                /></el-icon>
                AI 将根据章节内容自动撰写 MD 格式教案，预计耗时 15-30 秒。
              </p>
            </div>
          </el-form>
        </div>

        <!-- 侧边特性区 -->
        <div class="generator-side-cards lg:col-span-4 flex flex-col gap-6">
          <div
            class="generator-feature-card flex-1 group p-8 bg-[var(--el-bg-color-overlay)] border border-[var(--el-border-color-light)] rounded-3xl transition-all duration-300 hover:border-[var(--el-color-primary-light-3)] hover:shadow-xl flex flex-col items-center text-center justify-center"
          >
            <div
              class="generator-feature-card__icon w-16 h-16 bg-[var(--el-color-success-light-9)] text-[var(--el-color-success)] rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:rotate-6"
            >
              <el-icon class="text-4xl"><Star /></el-icon>
            </div>
            <h4
              class="generator-feature-card__title font-bold text-lg text-[var(--el-text-color-primary)] mb-3"
            >
              深度知识解析
            </h4>
            <p
              class="generator-feature-card__description text-sm text-[var(--el-text-color-secondary)] leading-relaxed opacity-80"
            >
              自动提取章节核心知识点，并进行教学维度的重难点标注与分层教学建议。
            </p>
          </div>

          <div
            class="generator-feature-card flex-1 group p-8 bg-[var(--el-bg-color-overlay)] border border-[var(--el-border-color-light)] rounded-3xl transition-all duration-300 hover:border-[var(--el-color-primary-light-3)] hover:shadow-xl flex flex-col items-center text-center justify-center"
          >
            <div
              class="generator-feature-card__icon w-16 h-16 bg-[var(--el-color-primary-light-9)] text-[var(--el-color-primary)] rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:rotate-6"
            >
              <el-icon class="text-4xl"><CopyDocument /></el-icon>
            </div>
            <h4
              class="generator-feature-card__title font-bold text-lg text-[var(--el-text-color-primary)] mb-3"
            >
              全流程结构
            </h4>
            <p
              class="generator-feature-card__description text-sm text-[var(--el-text-color-secondary)] leading-relaxed opacity-80"
            >
              产出包含导入、讲授、练习全环节的标准化教案文档，支持 Markdown
              导出。
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 成功结果页 - 垂直居中铺满 -->
    <div
      v-if="generateSuccess"
      class="generator-success-panel flex-1 flex flex-col items-center justify-center text-center bg-[var(--el-bg-color-overlay)] rounded-3xl border border-[var(--el-border-color-light)] shadow-lg p-20 max-w-4xl mx-auto w-full my-auto"
    >
      <div
        class="generator-success-panel__icon w-32 h-32 bg-[var(--el-color-success-light-9)] text-[var(--el-color-success)] rounded-full flex items-center justify-center mb-10 shadow-inner animate-bounce"
      >
        <el-icon class="text-7xl"><Check /></el-icon>
      </div>
      <h2
        class="generator-success-panel__title text-4xl font-bold text-[var(--el-text-color-primary)] mb-6"
      >
        教案智算任务已入列
      </h2>
      <p
        class="generator-success-panel__description text-lg text-[var(--el-text-color-secondary)] mb-14 max-w-xl mx-auto leading-relaxed"
      >
        教案生成请求已成功发送至 AI 计算引擎！<br />
        您可以前往“教案库”跟踪生成进度，完成后即可管理与下载。
      </p>
      <div class="generator-success-panel__actions flex justify-center gap-8">
        <el-button
          type="primary"
          size="large"
          class="generator-success-panel__button !rounded-2xl px-16 !h-16 !text-lg shadow-xl"
          @click="viewPlanList"
        >
          立即前往教案库
        </el-button>
        <el-button
          size="large"
          class="generator-success-panel__button !rounded-2xl px-16 !h-16 !text-lg shadow-sm border-[var(--el-border-color-light)]"
          @click="generateSuccess = false"
        >
          返回继续生成
        </el-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, reactive, onMounted, watch } from "vue";
import { ElMessage } from "element-plus";
import { getCourseHoursList, generateTeacherPlan } from "@/api/course";
import { useAppStoreHook } from "@/store/modules/app";
import {
  Management,
  Cpu,
  Star,
  CopyDocument,
  Check,
  MagicStick,
  InfoFilled,
  Box
} from "@element-plus/icons-vue";

const props = defineProps({
  courseId: {
    type: Number,
    default: null
  }
});

const emit = defineEmits(["switch-tab"]);
const appStore = useAppStoreHook();
const isNativeMobile = () =>
  typeof document !== "undefined" &&
  document.documentElement.classList.contains("qiming-native-webview");
const isMobileLayout = computed(
  () => appStore.getDevice === "mobile" || isNativeMobile()
);

// 表单数据
const form = reactive({
  chapterId: null
});

// 数据加载状态
const loading = ref(false);
const chapterLoading = ref(false);

// 章节选项
const chapterOptions = ref([]);

// 生成成功标志
const generateSuccess = ref(false);

// 获取章节列表
const fetchChapters = async (courseId: number) => {
  if (!courseId) {
    chapterOptions.value = [];
    return;
  }

  chapterLoading.value = true;
  try {
    const res = await getCourseHoursList({
      courseId: courseId
    });

    if (res && res.code === 200 && res.data) {
      chapterOptions.value =
        res.data.hoursList || res.data.courseChapters || [];
    } else {
      ElMessage.warning("获取章节列表失败");
    }
  } catch (error) {
    console.error("获取章节列表失败:", error);
    ElMessage.error("获取章节列表失败");
  } finally {
    chapterLoading.value = false;
  }
};

// 监听课程变化
watch(
  () => props.courseId,
  newId => {
    form.chapterId = null;
    if (newId) {
      fetchChapters(newId);
    } else {
      chapterOptions.value = [];
    }
  },
  { immediate: true }
);

// 生成教案
const generatePlan = async () => {
  if (!props.courseId || !form.chapterId) {
    ElMessage.warning("请选择课程和章节");
    return;
  }

  loading.value = true;
  try {
    const res = await generateTeacherPlan({
      course_id: props.courseId,
      chapter_id: form.chapterId
    });

    if (res && res.code === 200) {
      generateSuccess.value = true;
      ElMessage.success("已成功提交 AI 生成请求");
    } else {
      ElMessage.error(res.msg || "提交生成请求失败");
    }
  } catch (error) {
    console.error("生成教案失败:", error);
    ElMessage.error("网络异常，请稍后再试");
  } finally {
    loading.value = false;
  }
};

// 切换到教案库
const viewPlanList = () => {
  emit("switch-tab", "list");
};

onMounted(() => {
  if (props.courseId) {
    fetchChapters(props.courseId);
  }
});
</script>

<style lang="scss" scoped>
.generator-container {
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.custom-select :deep(.el-input__wrapper) {
  padding: 4px 12px;
  border-radius: 12px;
  box-shadow: 0 0 0 1px var(--el-border-color) inset;
  transition: all 0.3s;

  &:hover {
    box-shadow: 0 0 0 1px var(--el-color-primary) inset;
  }

  &.is-focus {
    box-shadow: 0 0 0 1px var(--el-color-primary) inset !important;
  }
}

:deep(.el-form-item__label) {
  width: 100%;
}

.generator-container.is-mobile-layout {
  padding: 16px 0 20px;
}

.generator-container.is-mobile-layout .generator-shell {
  gap: 16px;
}

.generator-container.is-mobile-layout .generator-hero {
  flex-direction: column;
  gap: 16px;
  padding: 20px 18px;
  border-radius: 24px;
}

.generator-container.is-mobile-layout .generator-hero__icon {
  width: 64px;
  height: 64px;
  border-radius: 18px;
}

.generator-container.is-mobile-layout .generator-hero__icon :deep(.el-icon) {
  font-size: 30px;
}

.generator-container.is-mobile-layout .generator-hero__copy {
  min-width: 0;
}

.generator-container.is-mobile-layout .generator-hero__title {
  margin-bottom: 10px;
  font-size: 24px;
  line-height: 1.3;
  word-break: break-word;
}

.generator-container.is-mobile-layout .generator-hero__description {
  font-size: 14px;
  line-height: 1.8;
}

.generator-container.is-mobile-layout .generator-grid {
  gap: 16px;
}

.generator-container.is-mobile-layout .generator-main-card {
  min-height: 0;
  padding: 22px 18px;
  border-radius: 24px;
}

.generator-container.is-mobile-layout .generator-section-label {
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 16px;
}

.generator-container.is-mobile-layout .generator-section-title {
  font-size: 18px;
  line-height: 1.4;
}

.generator-container.is-mobile-layout
  .generator-main-card
  :deep(.el-form-item) {
  margin-bottom: 28px !important;
}

.generator-container.is-mobile-layout .custom-select-large {
  width: 100%;
}

.generator-container.is-mobile-layout
  .custom-select-large:deep(.el-select__wrapper) {
  min-height: 48px;
  padding-top: 8px;
  padding-bottom: 8px;
  border-radius: 16px;
}

.generator-container.is-mobile-layout .generator-submit-button {
  width: 100%;
  min-width: 0;
  height: 52px !important;
  padding: 0 18px !important;
  font-size: 14px !important;
  line-height: 1.2;
  white-space: nowrap;
}

.generator-container.is-mobile-layout .generator-submit-hint {
  margin-top: 16px;
  align-items: flex-start;
  font-size: 12px;
  line-height: 1.6;
}

.generator-container.is-mobile-layout .generator-side-cards {
  gap: 12px;
}

.generator-container.is-mobile-layout .generator-feature-card {
  align-items: flex-start;
  padding: 18px;
  border-radius: 22px;
  text-align: left;
}

.generator-container.is-mobile-layout .generator-feature-card__icon {
  width: 52px;
  height: 52px;
  margin-bottom: 14px;
  border-radius: 16px;
}

.generator-container.is-mobile-layout
  .generator-feature-card__icon
  :deep(.el-icon) {
  font-size: 28px;
}

.generator-container.is-mobile-layout .generator-feature-card__title {
  margin-bottom: 8px;
  font-size: 16px;
}

.generator-container.is-mobile-layout .generator-feature-card__description {
  font-size: 13px;
  line-height: 1.7;
}

.generator-container.is-mobile-layout .generator-success-panel {
  padding: 28px 18px;
  border-radius: 24px;
}

.generator-container.is-mobile-layout .generator-success-panel__icon {
  width: 88px;
  height: 88px;
  margin-bottom: 20px;
}

.generator-container.is-mobile-layout
  .generator-success-panel__icon
  :deep(.el-icon) {
  font-size: 42px;
}

.generator-container.is-mobile-layout .generator-success-panel__title {
  margin-bottom: 12px;
  font-size: 26px;
  line-height: 1.3;
}

.generator-container.is-mobile-layout .generator-success-panel__description {
  margin-bottom: 24px;
  font-size: 14px;
  line-height: 1.8;
}

.generator-container.is-mobile-layout .generator-success-panel__actions {
  width: 100%;
  flex-direction: column;
  gap: 12px;
}

.generator-container.is-mobile-layout .generator-success-panel__button {
  width: 100%;
  height: 48px !important;
  margin-left: 0 !important;
  padding: 0 18px !important;
  font-size: 15px !important;
}

@media screen and (max-width: 768px) {
  .generator-container {
    padding: 16px 0 20px;
  }

  .generator-shell {
    gap: 16px;
  }

  .generator-hero {
    flex-direction: column;
    gap: 16px;
    padding: 20px 18px;
    border-radius: 24px;
  }

  .generator-hero__icon {
    width: 64px;
    height: 64px;
    border-radius: 18px;
  }

  .generator-hero__icon :deep(.el-icon) {
    font-size: 30px;
  }

  .generator-hero__copy {
    min-width: 0;
  }

  .generator-hero__title {
    margin-bottom: 10px;
    font-size: 24px;
    line-height: 1.3;
    word-break: break-word;
  }

  .generator-hero__description {
    font-size: 14px;
    line-height: 1.8;
  }

  .generator-grid {
    gap: 16px;
  }

  .generator-main-card {
    min-height: 0;
    padding: 22px 18px;
    border-radius: 24px;
  }

  .generator-section-label {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 16px;
  }

  .generator-section-title {
    font-size: 18px;
    line-height: 1.4;
  }

  .generator-main-card :deep(.el-form-item) {
    margin-bottom: 28px !important;
  }

  .custom-select-large {
    width: 100%;
  }

  .custom-select-large:deep(.el-select__wrapper) {
    min-height: 48px;
    padding-top: 8px;
    padding-bottom: 8px;
    border-radius: 16px;
  }

  .generator-submit-button {
    width: 100%;
    min-width: 0;
    height: 52px !important;
    padding: 0 18px !important;
    font-size: 14px !important;
    line-height: 1.2;
    white-space: nowrap;
  }

  .generator-submit-hint {
    margin-top: 16px;
    align-items: flex-start;
    font-size: 12px;
    line-height: 1.6;
  }

  .generator-side-cards {
    gap: 12px;
  }

  .generator-feature-card {
    align-items: flex-start;
    padding: 18px;
    border-radius: 22px;
    text-align: left;
  }

  .generator-feature-card__icon {
    width: 52px;
    height: 52px;
    margin-bottom: 14px;
    border-radius: 16px;
  }

  .generator-feature-card__icon :deep(.el-icon) {
    font-size: 28px;
  }

  .generator-feature-card__title {
    margin-bottom: 8px;
    font-size: 16px;
  }

  .generator-feature-card__description {
    font-size: 13px;
    line-height: 1.7;
  }

  .generator-success-panel {
    padding: 28px 18px;
    border-radius: 24px;
  }

  .generator-success-panel__icon {
    width: 88px;
    height: 88px;
    margin-bottom: 20px;
  }

  .generator-success-panel__icon :deep(.el-icon) {
    font-size: 42px;
  }

  .generator-success-panel__title {
    margin-bottom: 12px;
    font-size: 26px;
    line-height: 1.3;
  }

  .generator-success-panel__description {
    margin-bottom: 24px;
    font-size: 14px;
    line-height: 1.8;
  }

  .generator-success-panel__actions {
    width: 100%;
    flex-direction: column;
    gap: 12px;
  }

  .generator-success-panel__button {
    width: 100%;
    height: 48px !important;
    margin-left: 0 !important;
    padding: 0 18px !important;
    font-size: 15px !important;
  }
}
</style>
