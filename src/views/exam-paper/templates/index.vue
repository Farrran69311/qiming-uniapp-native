<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useDark } from "@pureadmin/utils";
import { ElMessage, ElMessageBox } from "element-plus";
import { usePageResponsive } from "@/utils/pageResponsive";
import IconDocument from "@/assets/home-icons/document.svg?component";
import IconFolder from "@/assets/home-icons/folder.svg?component";
import {
  getMyTemplates,
  createTemplate,
  deleteTemplate,
  getSystemTemplateStats
} from "@/api/examPaper";
import {
  isNativeWebViewRuntime,
  logNativeFallback
} from "@/utils/nativeRuntime";
import {
  applyTemplateStatsToList,
  cloneNativeDemoMyTemplates,
  nativeDemoSystemTemplateStats,
  type NativeDemoTemplateItem
} from "@/views/exam-paper/nativeDemoTemplates";

defineOptions({
  name: "ExamPaperTemplates"
});

const router = useRouter();
const { isDark } = useDark();
const { isMobile, getDialogWidth } = usePageResponsive();
const previewDialogWidth = computed(() =>
  getDialogWidth("680px", "calc(100vw - 32px)")
);
const createDialogWidth = computed(() =>
  getDialogWidth("500px", "calc(100vw - 32px)")
);
const createDialogLabelPosition = computed(() =>
  isMobile.value ? "top" : "right"
);
const createDialogLabelWidth = computed(() =>
  isMobile.value ? "auto" : "80px"
);

// 系统模板
const systemTemplates = ref([
  {
    id: 1,
    templateKey: "standard",
    name: "标准考试模板",
    description: "单选10道·多选5道·填空5道·大题10道",
    questionTypes: ["单选题", "多选题", "填空题", "大题"],
    totalQuestions: 30,
    totalPoints: 100,
    useCount: 0,
    isSystem: true
  },
  {
    id: 2,
    templateKey: "quick",
    name: "快速测验模板",
    description: "仅包含客观题，适合课堂小测和随堂练习",
    questionTypes: ["单选题", "多选题"],
    totalQuestions: 5,
    totalPoints: 25,
    useCount: 0,
    isSystem: true
  },
  {
    id: 3,
    templateKey: "comprehensive",
    name: "综合能力测试",
    description: "单选10道·简答5道，适合综合能力评估",
    questionTypes: ["单选题", "简答题"],
    totalQuestions: 15,
    totalPoints: 75,
    useCount: 0,
    isSystem: true
  },
  {
    id: 4,
    templateKey: "survey",
    name: "学情调查问卷",
    description: "单选10道·多选2道·简答5道·判断5道",
    questionTypes: ["单选题", "多选题", "简答题", "判断题"],
    totalQuestions: 22,
    totalPoints: 120,
    useCount: 0,
    isSystem: true
  }
]);

// 我的模板（私有模板）
const myTemplates = ref<any[]>([]);
const nativeMyTemplates = ref<NativeDemoTemplateItem[]>(
  cloneNativeDemoMyTemplates()
);
const isUsingNativeDemoData = ref(false);

// 当前激活的标签页
const activeTab = ref("system");

// 新建模板对话框
const createDialogVisible = ref(false);
const newTemplateForm = ref({
  name: "",
  description: ""
});

const applyNativeTemplateStats = () => {
  applyTemplateStatsToList(
    systemTemplates.value,
    nativeDemoSystemTemplateStats
  );
};

const applyNativeMyTemplates = () => {
  myTemplates.value = JSON.parse(JSON.stringify(nativeMyTemplates.value));
};

const applyNativeTemplatesFallback = (reason: string, error?: unknown) => {
  if (!isNativeWebViewRuntime()) return false;

  isUsingNativeDemoData.value = true;
  logNativeFallback(reason, error);
  applyNativeMyTemplates();
  return true;
};

// 加载系统模板统计（使用人数）
const loadTemplateStats = async () => {
  try {
    const result = await getSystemTemplateStats();
    if (result.code === 0 && result.data) {
      applyTemplateStatsToList(systemTemplates.value, result.data);
    } else if (isNativeWebViewRuntime()) {
      logNativeFallback("使用原生演示模板统计", result);
      applyNativeTemplateStats();
    }
  } catch (error) {
    logNativeFallback("加载模板统计失败:", error);
    if (isNativeWebViewRuntime()) applyNativeTemplateStats();
  }
};

// 加载我的模板
const loadMyTemplates = async () => {
  if (isUsingNativeDemoData.value) {
    applyNativeMyTemplates();
    return;
  }

  try {
    const result = await getMyTemplates();
    if (result.code === 0 && result.data) {
      myTemplates.value = result.data;
    } else {
      applyNativeTemplatesFallback("使用原生演示私有模板", result);
    }
  } catch (error) {
    applyNativeTemplatesFallback(
      "加载我的模板失败，已使用原生演示模板:",
      error
    );
  }
};

// 使用模板
const useTemplate = (templateId: number, isSystem: boolean) => {
  if (!isSystem && isUsingNativeDemoData.value) {
    ElMessage.info("已进入模板编辑器，可继续完善私有模板");
    router.push("/exam-paper/editor");
    return;
  }

  const prefix = isSystem ? "" : "my-";
  router.push(`/exam-paper/editor?template=${prefix}${templateId}`);
};

// 预览模板
const previewDialogVisible = ref(false);
const previewLoading = ref(false);
const previewData = ref<any>(null);

// 系统模板预览数据（前端硬编码）
const systemTemplatePreviewData: Record<string, any> = {
  standard: {
    templateKey: "standard",
    name: "标准考试模板",
    description: "包含单选、多选、填空、大题，适合期中期末考试",
    totalQuestions: 30,
    totalPoints: 100,
    questionGroups: [
      {
        groupName: "一、单选题",
        questionType: "radio",
        count: 10,
        pointsPerQuestion: 2,
        subtotal: 20
      },
      {
        groupName: "二、多选题",
        questionType: "checkbox",
        count: 5,
        pointsPerQuestion: 4,
        subtotal: 20
      },
      {
        groupName: "三、填空题",
        questionType: "input",
        count: 5,
        pointsPerQuestion: 4,
        subtotal: 20
      },
      {
        groupName: "四、简答题",
        questionType: "textarea",
        count: 10,
        pointsPerQuestion: 4,
        subtotal: 40
      }
    ]
  },
  quick: {
    templateKey: "quick",
    name: "快速测验模板",
    description: "仅包含客观题，适合课堂小测和随堂练习",
    totalQuestions: 5,
    totalPoints: 25,
    questionGroups: [
      {
        groupName: "一、单选题",
        questionType: "radio",
        count: 3,
        pointsPerQuestion: 5,
        subtotal: 15
      },
      {
        groupName: "二、多选题",
        questionType: "checkbox",
        count: 2,
        pointsPerQuestion: 5,
        subtotal: 10
      }
    ]
  },
  comprehensive: {
    templateKey: "comprehensive",
    name: "综合能力测试",
    description: "包含单选和简答，适合综合能力评估",
    totalQuestions: 15,
    totalPoints: 75,
    questionGroups: [
      {
        groupName: "一、单选题",
        questionType: "radio",
        count: 10,
        pointsPerQuestion: 3,
        subtotal: 30
      },
      {
        groupName: "二、简答题",
        questionType: "textarea",
        count: 5,
        pointsPerQuestion: 9,
        subtotal: 45
      }
    ]
  },
  survey: {
    templateKey: "survey",
    name: "学情调查问卷",
    description: "用于学情调查，了解学生学习情况",
    totalQuestions: 22,
    totalPoints: 120,
    questionGroups: [
      {
        groupName: "一、单选题",
        questionType: "radio",
        count: 10,
        pointsPerQuestion: 4,
        subtotal: 40
      },
      {
        groupName: "二、多选题",
        questionType: "checkbox",
        count: 2,
        pointsPerQuestion: 5,
        subtotal: 10
      },
      {
        groupName: "三、简答题",
        questionType: "textarea",
        count: 5,
        pointsPerQuestion: 10,
        subtotal: 50
      },
      {
        groupName: "四、判断题",
        questionType: "judge",
        count: 5,
        pointsPerQuestion: 4,
        subtotal: 20
      }
    ]
  }
};

const previewTemplate = (templateId: number) => {
  const tpl = systemTemplates.value.find(t => t.id === templateId);
  if (!tpl) return;
  previewDialogVisible.value = true;
  previewLoading.value = false;
  previewData.value = systemTemplatePreviewData[tpl.templateKey] || null;
};

// 使用预览中的模板
const usePreviewTemplate = () => {
  previewDialogVisible.value = false;
  const tpl = systemTemplates.value.find(
    t => t.templateKey === previewData.value?.templateKey
  );
  useTemplate(tpl?.id || 1, true);
};

// 题型名称映射
const questionTypeNameMap: Record<string, string> = {
  radio: "单选题",
  checkbox: "多选题",
  judge: "判断题",
  input: "填空题",
  textarea: "简答/大题"
};

// 打开新建模板对话框
const openCreateDialog = () => {
  newTemplateForm.value = { name: "", description: "" };
  createDialogVisible.value = true;
};

// 创建新模板
const handleCreateTemplate = async () => {
  if (!newTemplateForm.value.name.trim()) {
    ElMessage.warning("请输入模板名称");
    return;
  }

  const createNativeTemplate = () => {
    const templateId = Date.now();
    nativeMyTemplates.value.unshift({
      id: templateId,
      name: newTemplateForm.value.name.trim(),
      description: newTemplateForm.value.description.trim(),
      questionTypes: ["单选题", "多选题", "简答题"],
      totalQuestions: 0,
      totalPoints: 0,
      createTime: new Date().toISOString().slice(0, 10)
    });
    isUsingNativeDemoData.value = true;
    applyNativeMyTemplates();
    ElMessage.success("模板创建成功");
    createDialogVisible.value = false;
    router.push("/exam-paper/editor");
  };

  if (isUsingNativeDemoData.value) {
    createNativeTemplate();
    return;
  }

  try {
    const result = await createTemplate({
      name: newTemplateForm.value.name,
      description: newTemplateForm.value.description
    });
    if (result.code === 0) {
      ElMessage.success("模板创建成功");
      createDialogVisible.value = false;
      // 跳转到编辑器编辑新模板
      router.push(
        `/exam-paper/editor?template=my-${result.data.templateId}&edit=true`
      );
    } else {
      if (
        !applyNativeTemplatesFallback(
          "创建模板失败，已使用原生演示模板",
          result
        )
      ) {
        ElMessage.error(result.msg || "创建失败");
      } else {
        createNativeTemplate();
      }
    }
  } catch (error) {
    if (isNativeWebViewRuntime()) {
      logNativeFallback("创建模板失败，已使用原生演示模板:", error);
      createNativeTemplate();
      return;
    }
    console.error("创建模板失败:", error);
    ElMessage.error("创建模板失败");
  }
};

// 删除我的模板
const deleteMyTemplate = (templateId: number, templateName: string) => {
  ElMessageBox.confirm(`确定要删除模板"${templateName}"吗？`, "删除确认", {
    confirmButtonText: "确定删除",
    cancelButtonText: "取消",
    type: "warning"
  })
    .then(async () => {
      try {
        if (isUsingNativeDemoData.value) {
          nativeMyTemplates.value = nativeMyTemplates.value.filter(
            template => template.id !== templateId
          );
          applyNativeMyTemplates();
          ElMessage.success("删除成功");
          return;
        }

        const result = await deleteTemplate(templateId);
        if (result.code === 0) {
          ElMessage.success("删除成功");
          loadMyTemplates();
        } else {
          ElMessage.error(result.msg || "删除失败");
        }
      } catch (error) {
        if (isNativeWebViewRuntime()) {
          logNativeFallback("删除模板失败，已在本地演示数据中删除:", error);
          nativeMyTemplates.value = nativeMyTemplates.value.filter(
            template => template.id !== templateId
          );
          isUsingNativeDemoData.value = true;
          applyNativeMyTemplates();
          ElMessage.success("删除成功");
          return;
        }
        console.error("删除模板失败:", error);
        ElMessage.error("删除模板失败");
      }
    })
    .catch(() => {});
};

// 编辑我的模板
const editMyTemplate = (templateId: number) => {
  if (isUsingNativeDemoData.value) {
    ElMessage.info("已进入模板编辑器，可继续完善私有模板");
    router.push("/exam-paper/editor");
    return;
  }

  router.push(`/exam-paper/editor?template=my-${templateId}&edit=true`);
};

onMounted(() => {
  loadTemplateStats();
  loadMyTemplates();
});
</script>

<template>
  <div
    class="templates-page"
    :class="{ 'is-dark': isDark, 'is-mobile': isMobile }"
  >
    <div class="page-header">
      <div class="header-content">
        <div class="header-icon">
          <el-icon><Document /></el-icon>
        </div>
        <div class="header-info">
          <h1 class="page-title">试卷模板</h1>
          <p class="page-desc">
            选择一个模板快速开始创建试卷，或创建自己的私有模板
          </p>
        </div>
      </div>
      <div class="header-actions">
        <el-button type="primary" class="create-btn" @click="openCreateDialog">
          <el-icon><Plus /></el-icon>
          新建模板
        </el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="template-tabs">
      <el-tab-pane label="系统模板" name="system">
        <div class="templates-grid">
          <el-card
            v-for="template in systemTemplates"
            :key="template.id"
            class="template-card"
            shadow="hover"
          >
            <div class="template-cover system">
              <IconDocument style="width: 48px; height: 48px; color: #739cf9" />
              <span class="system-badge">系统</span>
            </div>
            <div class="template-info">
              <h3 class="template-name">{{ template.name }}</h3>
              <p class="template-desc">{{ template.description }}</p>
              <div class="template-tags">
                <el-tag
                  v-for="type in template.questionTypes.slice(0, 3)"
                  :key="type"
                  size="small"
                  type="info"
                >
                  {{ type }}
                </el-tag>
                <el-tag
                  v-if="template.questionTypes.length > 3"
                  size="small"
                  type="info"
                >
                  +{{ template.questionTypes.length - 3 }}
                </el-tag>
              </div>
              <div class="template-stats">
                <span>{{ template.totalQuestions }}题</span>
                <span v-if="template.totalPoints"
                  >{{ template.totalPoints }}分</span
                >
                <span>{{ template.useCount }}人使用</span>
              </div>
            </div>
            <div class="template-actions">
              <el-button type="primary" @click="useTemplate(template.id, true)">
                使用模板
              </el-button>
              <el-button @click="previewTemplate(template.id)">预览</el-button>
            </div>
          </el-card>
        </div>
      </el-tab-pane>

      <el-tab-pane label="我的模板" name="my">
        <div v-if="myTemplates.length === 0" class="empty-state">
          <el-empty description="暂无私有模板">
            <el-button type="primary" @click="openCreateDialog">
              <el-icon><Plus /></el-icon>
              创建第一个模板
            </el-button>
          </el-empty>
        </div>
        <div v-else class="templates-grid">
          <el-card
            v-for="template in myTemplates"
            :key="template.id"
            class="template-card"
            shadow="hover"
          >
            <div class="template-cover private">
              <IconFolder style="width: 48px; height: 48px; color: #409eff" />
              <span class="private-badge">私有</span>
            </div>
            <div class="template-info">
              <h3 class="template-name">{{ template.name }}</h3>
              <p class="template-desc">
                {{ template.description || "暂无描述" }}
              </p>
              <div class="template-tags">
                <el-tag
                  v-for="type in (template.questionTypes || []).slice(0, 3)"
                  :key="type"
                  size="small"
                  type="info"
                >
                  {{ type }}
                </el-tag>
              </div>
              <div class="template-stats">
                <span>{{ template.totalQuestions || 0 }}题</span>
                <span v-if="template.totalPoints"
                  >{{ template.totalPoints }}分</span
                >
                <span>创建于 {{ template.createTime }}</span>
              </div>
            </div>
            <div class="template-actions">
              <el-button
                type="primary"
                @click="useTemplate(template.id, false)"
              >
                使用模板
              </el-button>
              <el-button @click="editMyTemplate(template.id)">编辑</el-button>
              <el-button
                type="danger"
                link
                @click="deleteMyTemplate(template.id, template.name)"
              >
                删除
              </el-button>
            </div>
          </el-card>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 系统模板预览对话框 -->
    <el-dialog
      v-model="previewDialogVisible"
      :title="previewData?.name || '模板预览'"
      class="templates-preview-dialog"
      :width="previewDialogWidth"
      :fullscreen="isMobile"
      :close-on-click-modal="true"
    >
      <div v-loading="previewLoading">
        <template v-if="previewData">
          <div class="preview-header">
            <p class="preview-desc">{{ previewData.description }}</p>
            <div class="preview-summary">
              <span>共 {{ previewData.totalQuestions }} 题</span>
              <span>总分 {{ previewData.totalPoints }} 分</span>
            </div>
          </div>
          <div class="preview-groups">
            <div
              v-for="(group, idx) in previewData.questionGroups"
              :key="idx"
              class="preview-group"
            >
              <div class="group-header">
                <span class="group-name">{{ group.groupName }}</span>
                <span class="group-meta"
                  >{{ group.count }}题 × {{ group.pointsPerQuestion }}分 =
                  {{ group.subtotal }}分</span
                >
                <el-tag size="small" type="info">{{
                  questionTypeNameMap[group.questionType] || group.questionType
                }}</el-tag>
              </div>
              <div
                v-if="group.sampleQuestions?.length"
                class="sample-questions"
              >
                <div
                  v-for="(sq, sqIdx) in group.sampleQuestions"
                  :key="sqIdx"
                  class="sample-question"
                >
                  <p class="sample-stem">
                    <span class="sample-label">示例：</span>{{ sq.stem }}
                  </p>
                  <div v-if="sq.options?.length" class="sample-options">
                    <span
                      v-for="opt in sq.options"
                      :key="opt.key"
                      class="sample-option"
                      >{{ opt.key }}. {{ opt.content }}</span
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
      <template #footer>
        <el-button @click="previewDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="usePreviewTemplate"
          >使用此模板</el-button
        >
      </template>
    </el-dialog>

    <!-- 新建模板对话框 -->
    <el-dialog
      v-model="createDialogVisible"
      title="新建私有模板"
      class="templates-create-dialog"
      :width="createDialogWidth"
      :close-on-click-modal="false"
    >
      <el-form
        :model="newTemplateForm"
        :label-width="createDialogLabelWidth"
        :label-position="createDialogLabelPosition"
      >
        <el-form-item label="模板名称" required>
          <el-input
            v-model="newTemplateForm.name"
            placeholder="请输入模板名称"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="模板描述">
          <el-input
            v-model="newTemplateForm.description"
            type="textarea"
            placeholder="请输入模板描述（选填）"
            :rows="3"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreateTemplate"
          >创建并编辑</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
$light-text-primary: var(--el-text-color-primary);
$light-text-secondary: var(--el-text-color-regular);
$light-card-bg: var(--el-bg-color);
$light-border: var(--el-border-color-lighter);
$light-shadow: 0 4px 16px rgb(0 0 0 / 8%);
$dark-text-primary: var(--el-text-color-primary);
$dark-text-secondary: var(--el-text-color-regular);
$dark-card-bg: var(--el-bg-color);
$dark-border: var(--el-border-color-lighter);
$radius-md: 12px;
$radius-lg: 16px;
$primary-gradient: linear-gradient(135deg, #4a7fc8 0%, #739cf9 100%);

.templates-page {
  box-sizing: border-box;
  min-height: 100%;
  padding: 24px;
  overflow-x: hidden;

  &.is-dark {
    .page-header {
      background: $dark-card-bg;
      border-color: $dark-border;

      .page-title {
        color: $dark-text-primary;
      }
      .page-desc {
        color: $dark-text-secondary;
      }
    }

    .template-card {
      background: rgba(30, 41, 59, 0.8);
      border-color: $dark-border;

      .template-cover {
        &.system {
          background: linear-gradient(
            135deg,
            rgba(115, 156, 249, 0.2) 0%,
            rgba(115, 156, 249, 0.1) 100%
          );
        }
        &.private {
          background: linear-gradient(
            135deg,
            rgba(64, 158, 255, 0.2) 0%,
            rgba(64, 158, 255, 0.1) 100%
          );
        }
      }

      .template-info {
        .template-name {
          color: $dark-text-primary;
        }
        .template-desc {
          color: $dark-text-secondary;
        }
        .template-stats {
          color: $dark-text-secondary;
        }
      }

      .template-actions {
        border-top-color: $dark-border;
      }
    }

    .preview-header {
      .preview-desc {
        color: $dark-text-secondary;
      }
      .preview-summary {
        color: $dark-text-primary;
      }
    }

    .preview-groups .preview-group {
      background: rgba(15, 23, 42, 0.6);

      .group-header {
        .group-name {
          color: $dark-text-primary;
        }
        .group-meta {
          color: $dark-text-secondary;
        }
      }

      .sample-question {
        border-top-color: rgba(255, 255, 255, 0.1);

        .sample-stem {
          color: $dark-text-primary;
        }
        .sample-option {
          color: $dark-text-secondary;
        }
      }
    }
  }
}

.page-header {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  min-height: 104px;
  padding: 24px;
  margin-bottom: 24px;
  overflow: hidden;
  background: linear-gradient(135deg, #c7d9fb 0%, #fcd9b6 100%);
  border: 1px solid $light-border;
  border-radius: $radius-lg;
  box-shadow: $light-shadow;

  .header-bg-pattern {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
  }

  .header-content,
  .header-actions {
    position: relative;
    z-index: 1;
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    flex-shrink: 0;
    border-radius: $radius-md;
    background: $primary-gradient;
    box-shadow: 0 6px 16px rgb(74 127 200 / 30%);
    color: #fff;

    :deep(.el-icon) {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      font-size: 28px;
      line-height: 1;
      color: #fff;
    }
  }

  .page-title {
    margin: 0 0 4px;
    font-size: 24px;
    font-weight: 700;
    color: #1f2937;
  }

  .page-desc {
    margin: 0;
    font-size: 14px;
    color: #4b5563;
  }

  .header-actions {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  :deep(.el-button.action-btn) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    height: 48px;
    padding: 0 24px !important;
    border-radius: $radius-md;
    font-size: 15px;
    font-weight: 600;
    line-height: 1 !important;

    .el-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      margin-right: 6px;
    }
  }

  :deep(.el-button.create-btn.el-button--primary) {
    color: #fff;
    background: $primary-gradient;
    border: none;

    &:hover {
      opacity: 0.92;
    }
  }
}

.template-tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 20px;
  }
}

.templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.empty-state {
  padding: 60px 0;
  text-align: center;
}

/* 预览对话框样式 */
.preview-header {
  margin-bottom: 20px;

  .preview-desc {
    margin: 0 0 12px;
    color: #606266;
    font-size: 14px;
  }

  .preview-summary {
    display: flex;
    gap: 20px;
    font-size: 14px;
    font-weight: 500;
    color: #303133;
  }
}

.preview-groups {
  .preview-group {
    margin-bottom: 16px;
    padding: 12px 16px;
    background: #f5f7fa;
    border-radius: 6px;

    .group-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;

      .group-name {
        font-weight: 500;
        font-size: 14px;
      }

      .group-meta {
        font-size: 12px;
        color: #909399;
      }
    }

    .sample-questions {
      .sample-question {
        padding: 8px 0;
        border-top: 1px dashed #dcdfe6;

        .sample-stem {
          margin: 0 0 6px;
          font-size: 13px;
          color: #303133;

          .sample-label {
            color: #409eff;
            font-size: 12px;
            margin-right: 4px;
          }
        }

        .sample-options {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          padding-left: 12px;

          .sample-option {
            font-size: 12px;
            color: #606266;
          }
        }
      }
    }
  }
}

.template-card {
  .template-cover {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 120px;
    border-radius: 4px;
    margin-bottom: 16px;

    &.system {
      background: linear-gradient(135deg, #ebf2fd 0%, #dbe5f7 100%);
    }

    &.private {
      background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
    }

    .system-badge,
    .private-badge {
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 2px 8px;
      font-size: 12px;
      border-radius: 4px;
    }

    .system-badge {
      background: #739cf9;
      color: #fff;
    }

    .private-badge {
      background: #409eff;
      color: #fff;
    }
  }

  .template-info {
    .template-name {
      margin: 0 0 8px;
      font-size: 16px;
    }

    .template-desc {
      margin: 0 0 12px;
      font-size: 13px;
      color: #606266;
      line-height: 1.5;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .template-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 12px;
    }

    .template-stats {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: #909399;
    }
  }

  .template-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #ebeef5;
  }
}

.templates-page.is-mobile {
  padding: 16px 16px calc(var(--pure-mobile-content-bottom-gap, 140px) + 24px);

  .page-header {
    align-items: stretch;
    min-height: auto;
    padding: 18px;
    margin-bottom: 18px;
    border-radius: 14px;

    .header-content {
      align-items: flex-start;
    }

    .header-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;

      :deep(.el-icon) {
        width: 24px;
        height: 24px;
        font-size: 24px;
      }
    }

    .page-title {
      font-size: 22px;
      line-height: 1.25;
    }

    .page-desc {
      font-size: 14px;
      line-height: 1.5;
    }

    :deep(.el-button.create-btn) {
      min-height: 44px;
      height: 44px;
      padding: 0 18px;
      border-radius: 12px;
      font-weight: 600;
    }
  }

  .template-tabs {
    :deep(.el-tabs__header) {
      margin-bottom: 16px;
    }

    :deep(.el-tabs__nav-wrap::after) {
      height: 1px;
    }
  }

  .templates-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }

  .empty-state {
    display: flex;
    justify-content: center;
    min-height: calc(100vh - 420px);
    padding: 32px 0 calc(var(--pure-mobile-content-bottom-gap, 140px) + 24px);

    :deep(.el-empty) {
      width: 100%;
      padding: 0;
    }

    :deep(.el-empty__bottom) {
      margin-top: 18px;
    }

    :deep(.el-button) {
      min-height: 42px;
      border-radius: 12px;
    }
  }

  .template-card {
    border-radius: 12px;

    :deep(.el-card__body) {
      padding: 16px;
    }

    .template-cover {
      height: 96px;
      margin-bottom: 14px;
    }

    .template-info {
      .template-name {
        font-size: 16px;
        line-height: 1.35;
      }

      .template-stats {
        flex-wrap: wrap;
        gap: 8px 14px;
        line-height: 1.4;
      }
    }

    .template-actions {
      flex-wrap: wrap;
      gap: 8px;
      padding-top: 14px;

      :deep(.el-button) {
        flex: 1 1 calc(50% - 4px);
        min-width: 0;
        min-height: 40px;
        margin-left: 0;
        border-radius: 10px;
      }

      :deep(.el-button.is-link) {
        flex: 0 0 auto;
        min-height: 40px;
        padding-right: 6px;
        padding-left: 6px;
      }
    }
  }
}

:global(.templates-preview-dialog.is-fullscreen) {
  display: flex;
  flex-direction: column;
  margin: 0 !important;
  padding-top: env(safe-area-inset-top, 0);
  padding-bottom: env(safe-area-inset-bottom, 0);

  .el-dialog__body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .el-dialog__footer {
    padding: 12px 16px calc(env(safe-area-inset-bottom, 0) + 16px);
    border-top: 1px solid var(--el-border-color-lighter);
  }
}

:global(.templates-create-dialog) {
  max-width: calc(100vw - 32px);
}

@media screen and (max-width: 520px) {
  .templates-page.is-mobile {
    padding-right: 14px;
    padding-left: 14px;

    .page-header {
      flex-direction: column;
      gap: 14px;

      .header-actions,
      :deep(.el-button.create-btn) {
        width: 100%;
      }

      .header-content {
        gap: 12px;
      }
    }

    .template-card {
      .template-actions {
        :deep(.el-button:not(.is-link)) {
          flex-basis: 100%;
        }
      }
    }
  }
}
</style>
