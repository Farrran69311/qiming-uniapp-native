<template>
  <div class="homework-management" :class="{ 'is-mobile-layout': isMobileLayout }">
    <div
      class="homework-toolbar mb-5 flex justify-between items-center bg-[var(--el-fill-color-light)] p-4 rounded-lg"
    >
      <div class="text-[var(--el-text-color-regular)] font-medium">
        <el-icon class="mr-1 mt-0.5"><Notebook /></el-icon>
        作业列表 ({{ total }})
      </div>
      <el-button type="primary" :icon="Plus" round @click="showCreateDialog">
        添加作业
      </el-button>
    </div>

    <!-- 作业列表 -->
    <el-table
      v-loading="loading"
      class="desktop-homework-table"
      :data="homeworkList"
      style="width: 100%"
      border
      stripe
      header-cell-class-name="bg-[var(--el-fill-color-light)] text-[var(--el-text-color-primary)] !font-semibold"
    >
      <el-table-column prop="homeworkId" label="ID" width="80" align="center" />
      <el-table-column prop="title" label="作业标题" min-width="180">
        <template #default="{ row }">
          <span
            class="font-medium text-[var(--el-color-primary)] cursor-pointer hover:underline"
            @click="showQuestionDialog(row)"
            >{{ row.title }}</span
          >
        </template>
      </el-table-column>
      <el-table-column
        prop="chapterName"
        label="所属章节"
        min-width="150"
        show-overflow-tooltip
      />
      <el-table-column
        prop="hourName"
        label="所属课时"
        min-width="150"
        show-overflow-tooltip
      />
      <el-table-column
        prop="questionNum"
        label="题量"
        width="80"
        align="center"
      >
        <template #default="{ row }">
          <el-badge
            :value="row.questionNum"
            :type="row.questionNum > 0 ? 'primary' : 'info'"
          />
        </template>
      </el-table-column>
      <el-table-column
        prop="totalPoints"
        label="总分"
        width="80"
        align="center"
      />
      <el-table-column
        prop="dueDate"
        label="截止日期"
        width="170"
        align="center"
      />
      <el-table-column label="操作" width="220" fixed="right" align="center">
        <template #default="scope">
          <el-button link type="primary" @click="showQuestionDialog(scope.row)"
            >试题管理</el-button
          >
          <el-divider direction="vertical" />
          <el-button link type="primary" @click="showEditDialog(scope.row)"
            >编辑</el-button
          >
          <el-divider direction="vertical" />
          <el-button link type="danger" @click="confirmDelete(scope.row)"
            >删除</el-button
          >
        </template>
      </el-table-column>
    </el-table>

    <div v-loading="loading" class="mobile-homework-list">
      <div
        v-for="homework in homeworkList"
        :key="homework.homeworkId"
        class="mobile-homework-card"
      >
        <div class="mobile-homework-card__header">
          <div class="min-w-0">
            <div class="mobile-homework-card__id">ID {{ homework.homeworkId }}</div>
            <button
              class="mobile-homework-card__title"
              type="button"
              @click="showQuestionDialog(homework)"
            >
              {{ homework.title || "未命名作业" }}
            </button>
          </div>
          <el-tag size="small" effect="plain">
            {{ homework.questionNum || 0 }} 题
          </el-tag>
        </div>

        <div class="mobile-homework-card__meta">
          <span>章节：{{ homework.chapterName || "-" }}</span>
          <span>课时：{{ homework.hourName || "-" }}</span>
          <span>总分：{{ homework.totalPoints ?? "-" }}</span>
          <span>截止：{{ homework.dueDate || "-" }}</span>
        </div>

        <div class="mobile-homework-card__actions">
          <el-button
            type="primary"
            plain
            round
            @click="showQuestionDialog(homework)"
          >
            试题管理
          </el-button>
          <el-button round @click="showEditDialog(homework)">编辑</el-button>
          <el-button type="danger" plain round @click="confirmDelete(homework)">
            删除
          </el-button>
        </div>
      </div>

      <el-empty
        v-if="!loading && homeworkList.length === 0"
        description="暂无作业"
      />
    </div>

    <!-- 分页 -->
    <div class="pagination-container">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 30, 50]"
        :layout="paginationLayout"
        :small="isMobileLayout"
        :total="total"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>

    <!-- 创建/编辑作业对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑作业' : '创建作业'"
      :width="formDialogWidth"
      align-center
    >
      <el-form
        ref="formRef"
        v-loading="formLoading"
        :model="form"
        :rules="rules"
        label-width="100px"
      >
        <el-form-item label="作业标题" prop="title">
          <el-input v-model="form.title" placeholder="请输入作业标题" />
        </el-form-item>

        <el-form-item v-if="!isEdit" label="所属章节" prop="chapterId">
          <el-select
            v-model="form.chapterId"
            placeholder="请选择章节"
            style="width: 100%"
            @change="handleChapterChange"
          >
            <el-option
              v-for="chapter in chapterOptions"
              :key="chapter.chapterId"
              :label="chapter.name"
              :value="chapter.chapterId"
            />
          </el-select>
        </el-form-item>

        <el-form-item v-if="!isEdit" label="所属课时" prop="hourId">
          <el-select
            v-model="form.hourId"
            placeholder="请选择课时"
            style="width: 100%"
          >
            <el-option
              v-for="hour in hourOptions"
              :key="hour.hourId"
              :label="hour.title"
              :value="hour.hourId"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="作业描述" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="4"
            placeholder="请输入作业描述"
          />
        </el-form-item>

        <el-form-item label="截止日期" prop="dueDate">
          <el-date-picker
            v-model="form.dueDate"
            type="datetime"
            placeholder="选择截止日期"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
            popper-class="date-picker-popper"
            :teleported="false"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitForm">确定</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 作业管理对话框 -->
    <el-dialog
      v-model="questionDialogVisible"
      title="作业管理"
      width="90%"
      :fullscreen="isMobileLayout"
      top="5vh"
      @closed="handleQuestionDialogClosed"
    >
      <div v-if="currentHomework" class="question-dialog-header">
        <h3>{{ currentHomework.title }}</h3>
      </div>

      <div class="question-operation-bar">
        <el-button type="primary" @click="addRandomQuestion">
          <el-icon><Plus /></el-icon>AI生成新试题
        </el-button>
      </div>

      <div class="question-table-scroll">
        <el-table
          v-loading="questionLoading"
          class="question-management-table"
          :data="questionList"
          style="width: 100%"
          border
          stripe
        >
          <el-table-column prop="questionType" label="题型" width="100">
            <template #default="scope">
              {{ getQuestionTypeName(scope.row.questionType) }}
            </template>
          </el-table-column>
          <el-table-column prop="title" label="标题" width="150" />
          <el-table-column
            prop="stem"
            label="题干"
            min-width="250"
            show-overflow-tooltip
          />
          <el-table-column prop="points" label="分值" width="80" />
          <el-table-column prop="difficulty" label="难度" width="150">
            <template #default="scope">
              <el-rate
                v-model="scope.row.difficulty"
                disabled
                text-color="#ff9900"
              />
            </template>
          </el-table-column>
          <el-table-column prop="sortOrder" label="排序" width="80" />
          <el-table-column label="操作" width="150" :fixed="questionActionFixed">
            <template #default="scope">
              <el-button
                size="small"
                type="primary"
                @click="viewQuestionDetail(scope.row)"
                >查看</el-button
              >
              <el-button
                size="small"
                type="danger"
                @click="deleteQuestion(scope.row)"
                >删除</el-button
              >
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="pagination-container">
        <el-pagination
          v-model:current-page="questionCurrentPage"
          v-model:page-size="questionPageSize"
          :page-sizes="[10, 20, 30, 50]"
          :layout="paginationLayout"
          :small="isMobileLayout"
          :total="questionTotal"
          @size-change="handleQuestionSizeChange"
          @current-change="handleQuestionCurrentChange"
        />
      </div>
    </el-dialog>

    <!-- 查看试题详情弹窗 -->
    <el-dialog
      v-model="detailDialogVisible"
      title="试题详情"
      :width="detailDialogWidth"
    >
      <div v-if="currentQuestion" class="question-detail">
        <el-descriptions border :column="1" size="default">
          <el-descriptions-item label="题型">
            {{ getQuestionTypeName(currentQuestion.questionType) }}
          </el-descriptions-item>
          <el-descriptions-item label="标题">
            {{ currentQuestion.title }}
          </el-descriptions-item>
          <el-descriptions-item label="题干">
            {{ currentQuestion.stem }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="currentQuestion.options && currentQuestion.options !== 'null'"
            label="选项"
          >
            <div
              v-for="(option, index) in parseOptions(currentQuestion.options)"
              :key="index"
              class="option-item"
            >
              {{ getOptionLabel(index) }}: {{ option }}
            </div>
          </el-descriptions-item>
          <el-descriptions-item label="正确答案">
            <div v-if="isMultipleChoice(currentQuestion)">
              {{ formatMultipleAnswers(currentQuestion.correctAnswer) }}
            </div>
            <div v-else>
              {{ currentQuestion.correctAnswer }}
            </div>
          </el-descriptions-item>
          <el-descriptions-item label="分析">
            <div class="analysis-content">{{ currentQuestion.analysis }}</div>
          </el-descriptions-item>
          <el-descriptions-item label="分值">
            {{ currentQuestion.points }}
          </el-descriptions-item>
          <el-descriptions-item label="难度">
            <el-rate
              v-model="currentQuestion.difficulty"
              disabled
              text-color="#ff9900"
            />
          </el-descriptions-item>
          <el-descriptions-item label="排序">
            {{ currentQuestion.sortOrder }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Plus } from "@element-plus/icons-vue";
import { useAppStoreHook } from "@/store/modules/app";
import {
  getHomeworkList,
  getHomeworkQuestionList,
  createHomework,
  updateHomework,
  deleteHomework
} from "@/api/homework";
import { deleteWorkQuestion, addRandomWorkQuestion } from "@/api/work";
import { getCourseHoursList } from "@/api/course";

const props = defineProps({
  courseId: {
    type: [Number, null],
    required: true
  }
});

const appStore = useAppStoreHook();
const isNativeMobile = () =>
  typeof document !== "undefined" &&
  document.documentElement.classList.contains("qiming-native-webview");
const isMobileLayout = computed(
  () => appStore.getDevice === "mobile" || isNativeMobile()
);
const paginationLayout = computed(() =>
  isMobileLayout.value ? "prev, pager, next" : "total, sizes, prev, pager, next, jumper"
);
const formDialogWidth = computed(() => (isMobileLayout.value ? "92vw" : "600px"));
const detailDialogWidth = computed(() => (isMobileLayout.value ? "92vw" : "70%"));
const questionActionFixed = computed(() =>
  isMobileLayout.value ? false : "right"
);

interface HomeworkItem {
  homeworkId: number;
  title?: string;
  chapterName?: string;
  hourName?: string;
  questionNum?: number;
  totalPoints?: number;
  dueDate?: string;
}

interface QuestionItem {
  questionId?: number;
  questionType: number;
  title?: string;
  stem?: string;
  options?: string;
  correctAnswer?: string;
  analysis?: string;
  points?: number;
  difficulty?: number;
  sortOrder?: number;
}

// 作业列表相关
const loading = ref(false);
const homeworkList = ref<HomeworkItem[]>([]);
const currentPage = ref(1);
const pageSize = ref(10);
const total = ref(0);

// 章节和课时选项
const chapterOptions = ref([]);
const hourOptions = ref([]);

// 作业表单相关
const dialogVisible = ref(false);
const formLoading = ref(false);
const isEdit = ref(false);
const formRef = ref(null);
// 当前正在编辑的作业ID
const currentEditId = ref<number | null>(null);
const form = ref({
  courseId: Number(props.courseId) || 0,
  chapterId: null as number | null,
  hourId: null as number | null,
  title: "",
  description: "",
  dueDate: ""
});

// 表单验证规则
const rules = {
  title: [{ required: true, message: "请输入作业标题", trigger: "blur" }],
  chapterId: [{ required: true, message: "请选择章节", trigger: "change" }],
  hourId: [{ required: true, message: "请选择课时", trigger: "change" }],
  description: [{ required: true, message: "请输入作业描述", trigger: "blur" }],
  dueDate: [{ required: true, message: "请选择截止日期", trigger: "change" }]
};

// 试题管理相关
const questionDialogVisible = ref(false);
const questionLoading = ref(false);
const currentHomework = ref<HomeworkItem | null>(null);
const questionList = ref<QuestionItem[]>([]);
const questionCurrentPage = ref(1);
const questionPageSize = ref(10);
const questionTotal = ref(0);

// 试题详情相关
const detailDialogVisible = ref(false);
const currentQuestion = ref<QuestionItem | null>(null);

// 监听课程ID变化，重新加载数据
watch(
  () => props.courseId,
  newVal => {
    if (newVal) {
      currentPage.value = 1;
      fetchHomeworkList();
      fetchChapters();
    } else {
      homeworkList.value = [];
      total.value = 0;
    }
  }
);

// 获取作业列表
const fetchHomeworkList = async () => {
  if (!props.courseId) return;

  loading.value = true;
  try {
    const { data } = await getHomeworkList({
      pageNum: currentPage.value,
      pageSize: pageSize.value,
      courseId: props.courseId
    });
    homeworkList.value = data.homeworkList;
    total.value = data.total;
  } catch (error) {
    console.error("获取作业列表失败", error);
    ElMessage.error("获取作业列表失败");
  } finally {
    loading.value = false;
  }
};

// 获取章节和课时列表
const fetchChapters = async () => {
  try {
    const { data } = await getCourseHoursList({ courseId: props.courseId });
    chapterOptions.value = data.courseChapters || [];
  } catch (error) {
    console.error("获取章节列表失败", error);
    ElMessage.error("获取章节列表失败");
  }
};

// 处理章节变化，加载对应的课时
const handleChapterChange = chapterId => {
  form.value.hourId = null;
  const chapter = chapterOptions.value.find(c => c.chapterId === chapterId);
  if (chapter) {
    hourOptions.value = chapter.hourList || [];
  } else {
    hourOptions.value = [];
  }
};

// 分页相关
const handleSizeChange = (val: number) => {
  pageSize.value = val;
  fetchHomeworkList();
};

const handleCurrentChange = (val: number) => {
  currentPage.value = val;
  fetchHomeworkList();
};

// 显示创建对话框
const showCreateDialog = () => {
  isEdit.value = false;
  form.value = {
    courseId: Number(props.courseId) || 0,
    chapterId: null as number | null,
    hourId: null as number | null,
    title: "",
    description: "",
    dueDate: ""
  };
  dialogVisible.value = true;
};

// 显示编辑对话框
const showEditDialog = row => {
  isEdit.value = true;
  // 编辑时临时保存当前作业ID
  currentEditId.value = row.homeworkId;
  form.value = {
    courseId: Number(props.courseId) || 0,
    chapterId: row.chapterId,
    hourId: row.hourId,
    title: row.title,
    description: row.description,
    dueDate: row.dueDate
  };
  dialogVisible.value = true;
};

// 提交表单
const submitForm = async () => {
  if (!formRef.value) return;

  await formRef.value.validate(async valid => {
    if (valid) {
      formLoading.value = true;
      try {
        if (isEdit.value) {
          await updateHomework({
            homeworkId: currentEditId.value!,
            title: form.value.title,
            description: form.value.description,
            dueDate: form.value.dueDate
          });
          ElMessage.success("更新作业成功");
        } else {
          // 创建作业时不传递 homeworkId，确保类型转换正确
          await createHomework({
            courseId: Number(props.courseId),
            chapterId: Number(form.value.chapterId),
            hourId: Number(form.value.hourId),
            title: form.value.title,
            description: form.value.description,
            dueDate: form.value.dueDate
          });
          ElMessage.success("创建作业成功");
        }
        dialogVisible.value = false;
        fetchHomeworkList();
      } catch (error) {
        console.error(isEdit.value ? "更新作业失败" : "创建作业失败", error);
        ElMessage.error(isEdit.value ? "更新作业失败" : "创建作业失败");
      } finally {
        formLoading.value = false;
      }
    }
  });
};

// 确认删除
const confirmDelete = row => {
  ElMessageBox.confirm(`确定要删除作业 "${row.title}" 吗？`, "提示", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning"
  })
    .then(async () => {
      try {
        await deleteHomework({ homeworkId: row.homeworkId });
        ElMessage.success("删除作业成功");
        fetchHomeworkList();
      } catch (error) {
        console.error("删除作业失败", error);
        ElMessage.error("删除作业失败");
      }
    })
    .catch(() => {});
};

// 显示试题管理对话框
const showQuestionDialog = async row => {
  currentHomework.value = row;
  questionDialogVisible.value = true;
  questionCurrentPage.value = 1;
  await fetchQuestionList();
};

// 获取试题列表
const fetchQuestionList = async () => {
  if (!currentHomework.value) return;

  // 检查作业ID是否存在且有效（不为0）
  if (
    currentHomework.value.homeworkId === 0 ||
    currentHomework.value.homeworkId === null ||
    currentHomework.value.homeworkId === undefined
  ) {
    ElMessage.error("无效的作业ID，无法获取试题列表");
    return;
  }

  questionLoading.value = true;
  try {
    const { data } = await getHomeworkQuestionList({
      pageNum: questionCurrentPage.value,
      pageSize: questionPageSize.value,
      homeworkId: currentHomework.value.homeworkId
    });
    questionList.value = data.questionList;
    questionTotal.value = data.total;
  } catch (error) {
    console.error("获取试题列表失败", error);
    ElMessage.error("获取试题列表失败");
  } finally {
    questionLoading.value = false;
  }
};

// 试题分页相关
const handleQuestionSizeChange = (val: number) => {
  questionPageSize.value = val;
  fetchQuestionList();
};

const handleQuestionCurrentChange = (val: number) => {
  questionCurrentPage.value = val;
  fetchQuestionList();
};

// 显示添加试题对话框
const showAddQuestionDialog = () => {
  // 这里可以实现添加试题的逻辑
  ElMessage.info("添加试题功能待实现");
};

// 编辑试题
const editQuestion = row => {
  // 这里可以实现编辑试题的逻辑
  ElMessage.info("编辑试题功能待实现");
};

// 随机添加一道试题
const addRandomQuestion = async () => {
  if (!currentHomework.value) return;

  try {
    await addRandomWorkQuestion({
      addType: 2, // 2表示作业
      sourceId: currentHomework.value.homeworkId
    });
    ElMessage.success("AI生成新试题成功");
    // 重新获取试题列表
    await fetchQuestionList();
  } catch (error) {
    console.error("AI生成新试题失败", error);
    ElMessage.error("AI生成新试题失败");
  }
};

// 删除试题
const deleteQuestion = row => {
  ElMessageBox.confirm(`确定要删除该试题吗？`, "提示", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning"
  })
    .then(async () => {
      try {
        console.log("要删除的试题:", row);
        await deleteWorkQuestion({
          deleteType: 2, // 2表示作业
          sourceId: currentHomework.value.homeworkId,
          questionId: row.questionId // 只使用questionId字段
        });
        ElMessage.success("删除试题成功");
        // 重新获取试题列表
        await fetchQuestionList();
      } catch (error) {
        console.error("删除试题失败", error);
        ElMessage.error(
          `删除试题失败：${error.message || JSON.stringify(error)}`
        );
      }
    })
    .catch(() => {});
};

// 获取题型名称
const getQuestionTypeName = (type: number) => {
  const typeMap = {
    1: "单选题",
    2: "多选题",
    3: "判断题",
    4: "填空题",
    5: "简答题",
    6: "论述题"
  };
  return typeMap[type] || "未知题型";
};

// 查看试题详情
const viewQuestionDetail = question => {
  currentQuestion.value = question;
  detailDialogVisible.value = true;
};

// 解析选项字符串
const parseOptions = optionsStr => {
  try {
    if (!optionsStr || optionsStr === "null") return [];
    return JSON.parse(optionsStr);
  } catch (e) {
    console.error("解析选项出错", e);
    return [];
  }
};

// 获取选项标签 (A, B, C...)
const getOptionLabel = index => {
  return String.fromCharCode(65 + index); // 65 是 ASCII 码中 'A' 的值
};

// 判断是否为多选题
const isMultipleChoice = question => {
  return question.questionType === 2;
};

// 格式化多选题答案
const formatMultipleAnswers = answerStr => {
  try {
    const answers = JSON.parse(answerStr);
    if (Array.isArray(answers)) {
      return answers.join(", ");
    }
    return answerStr;
  } catch (e) {
    return answerStr;
  }
};

// 处理作业管理对话框关闭
const handleQuestionDialogClosed = () => {
  // 刷新作业列表
  fetchHomeworkList();
};

// 页面加载时获取数据
onMounted(() => {
  if (props.courseId) {
    fetchHomeworkList();
    fetchChapters();
  }
});
</script>

<style lang="scss" scoped>
.homework-management {
  padding: 10px 0;
}

.mobile-homework-list {
  display: none;
}

.operation-bar {
  margin-bottom: 20px;
}

.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.question-dialog-header {
  margin-bottom: 20px;

  h3 {
    margin-top: 0;
    margin-bottom: 10px;
    color: var(--el-text-color-primary);
  }

  p {
    margin: 0;
    color: var(--el-text-color-regular);
  }
}

.question-operation-bar {
  margin-bottom: 20px;
}

.question-table-scroll {
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
}

.question-management-table {
  min-width: 820px;
}

.question-detail {
  .option-item {
    margin-bottom: 8px;
  }

  .analysis-content {
    line-height: 1.5;
    white-space: pre-wrap;
  }
}

@media screen and (max-width: 768px) {
  .homework-management.is-mobile-layout {
    padding: 0;
  }

  .homework-toolbar {
    align-items: stretch;
    gap: 12px;
    padding: 14px;
    border-radius: 18px;

    :deep(.el-button) {
      width: auto;
      min-width: 112px;
      height: 40px;
      margin-left: auto;
    }
  }

  .desktop-homework-table {
    display: none;
  }

  .mobile-homework-list {
    display: grid;
    gap: 12px;
  }

  .mobile-homework-card {
    padding: 16px;
    background: var(--el-bg-color-overlay);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 18px;
    box-shadow: 0 10px 26px rgb(15 23 42 / 6%);
  }

  .mobile-homework-card__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .mobile-homework-card__id {
    margin-bottom: 4px;
    color: var(--el-text-color-placeholder);
    font-size: 12px;
    line-height: 1.2;
  }

  .mobile-homework-card__title {
    display: block;
    width: 100%;
    padding: 0;
    color: var(--el-text-color-primary);
    font-size: 17px;
    font-weight: 800;
    line-height: 1.35;
    text-align: left;
    word-break: break-word;
    background: transparent;
    border: 0;
  }

  .mobile-homework-card__meta {
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
    margin-top: 12px;
    color: var(--el-text-color-regular);
    font-size: 13px;
    line-height: 1.45;
  }

  .mobile-homework-card__actions {
    display: grid;
    grid-template-columns: 1fr 0.8fr 0.8fr;
    gap: 8px;
    margin-top: 14px;

    :deep(.el-button) {
      min-width: 0;
      margin-left: 0;
      padding: 0 10px;
    }
  }

  .pagination-container {
    justify-content: center;
    margin-top: 16px;
    overflow-x: auto;
  }

  :deep(.el-dialog) {
    max-width: calc(100vw - 24px);
    border-radius: 22px;
  }

  :deep(.el-dialog__body) {
    max-height: min(68vh, 620px);
    overflow-y: auto;
    padding: 16px 18px;
  }

  .question-dialog-header {
    margin-bottom: 14px;

    h3 {
      font-size: 20px;
      line-height: 1.25;
      word-break: break-word;
    }
  }

  .question-operation-bar {
    display: flex;
    justify-content: center;
    margin-bottom: 16px;
  }

  .question-table-scroll {
    margin: 0 -4px;
    padding: 0 4px 8px;
    overscroll-behavior-x: contain;
  }

  .question-management-table {
    min-width: 760px;
  }

  :deep(.el-form-item) {
    display: block;
  }

  :deep(.el-form-item__label) {
    justify-content: flex-start;
    margin-bottom: 6px;
    font-weight: 700;
  }
}
</style>
