<template>
  <div class="todo-container" :class="currentTheme">
    <div class="todo-header card">
      <div class="header-left">
        <h3>待办事项</h3>
        <p>共 {{ totalTodos }} 项，已完成 {{ completedTodos }} 项</p>
      </div>
      <div class="header-right flex items-center gap-4">
        <el-radio-group v-model="filterStatus" size="default">
          <el-radio-button value="all">全部</el-radio-button>
          <el-radio-button value="pending">待处理</el-radio-button>
          <el-radio-button value="completed">已完成</el-radio-button>
        </el-radio-group>
        <el-button
          type="primary"
          :icon="Plus"
          round
          class="add-btn"
          @click="openAddDialog"
          >添加待办</el-button
        >
      </div>
    </div>

    <div class="todo-list mt-8">
      <div
        v-for="todo in filteredTodos"
        :key="todo.id"
        class="todo-row card mb-4"
      >
        <div class="todo-info">
          <div class="status-icon">
            <el-checkbox
              :model-value="todo.completed"
              size="large"
              @change="toggleStatus(todo)"
            />
          </div>
          <div class="text-content">
            <div class="title-row">
              <span :class="['title', { 'is-completed': todo.completed }]">
                {{ todo.title }}
              </span>
              <el-tag
                :type="todo.completed ? 'success' : 'warning'"
                size="default"
              >
                {{ todo.completed ? "已完成" : "待处理" }}
              </el-tag>
            </div>
            <div class="meta-row mt-2">
              <span
                ><el-icon class="relative top-[2px]"><User /></el-icon>
                {{ todo.publisher }}</span
              >
              <span
                ><el-icon class="relative top-[2px]"><Clock /></el-icon>
                {{ todo.time }}</span
              >
            </div>
          </div>
        </div>
        <div class="todo-actions">
          <button
            type="button"
            class="todo-action-btn todo-action-btn--edit"
            @click="openEditDialog(todo)"
          >
            编辑
          </button>
          <button
            type="button"
            class="todo-action-btn todo-action-btn--delete"
            @click="deleteTodo(todo)"
          >
            删除
          </button>
        </div>
      </div>
    </div>

    <el-empty
      v-if="filteredTodos.length === 0 && !loading"
      description="暂无待办事项"
      class="card"
    />

    <!-- 添加/编辑待办对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditMode ? '编辑待办' : '添加待办'"
      width="500px"
      class="student-todo-dialog"
      align-center
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" label-width="80px">
        <el-form-item label="标题" prop="title" required>
          <el-input v-model="form.title" placeholder="请输入标题" />
        </el-form-item>
        <el-form-item label="关系人" prop="publisher" required>
          <el-input v-model="form.publisher" placeholder="请输入关系人" />
        </el-form-item>
        <el-form-item label="详细信息" prop="details">
          <el-input
            v-model="form.details"
            type="textarea"
            placeholder="请输入详细信息"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Plus, User, Clock } from "@element-plus/icons-vue";

defineProps<{
  currentTheme?: string;
}>();

interface TodoItem {
  id: number;
  title: string;
  publisher: string;
  details: string;
  time: string;
  completed: boolean;
}

const loading = ref(true);
const todos = ref<TodoItem[]>([]);
const dialogVisible = ref(false);
const isEditMode = ref(false);
const formRef = ref(null);
const filterStatus = ref("all"); // all, pending, completed

const initialFormState = {
  id: 0,
  title: "",
  publisher: "",
  details: "",
  time: "",
  completed: false
};
const form = ref<TodoItem>({ ...initialFormState });

const TODO_STORAGE_KEY = "vue-pure-admin-todos";

const initialTodos: TodoItem[] = [
  {
    id: 1,
    title: "完成高等数学作业",
    publisher: "王小明",
    details: "完成第5章习题并上传至学习平台。",
    time: "2025-07-15 10:00:00",
    completed: false
  },
  {
    id: 2,
    title: "准备英语口语考试",
    publisher: "李晓红",
    details: "整理考试重点，练习自我介绍和常见问答。",
    time: "2025-07-20 14:30:00",
    completed: false
  },
  {
    id: 3,
    title: "小组项目讨论",
    publisher: "张伟",
    details: "与小组成员线上讨论数据库课程设计方案。",
    time: "2025-07-12 18:00:00",
    completed: true
  }
];

// 过滤后的待办事项
const filteredTodos = computed(() => {
  if (filterStatus.value === "pending") {
    return todos.value.filter(todo => !todo.completed);
  }
  if (filterStatus.value === "completed") {
    return todos.value.filter(todo => todo.completed);
  }
  return todos.value;
});

// 统计信息
const totalTodos = computed(() => todos.value.length);
const completedTodos = computed(
  () => todos.value.filter(todo => todo.completed).length
);

// 从localStorage加载数据
const loadTodos = () => {
  loading.value = true;
  setTimeout(() => {
    const storedTodos = localStorage.getItem(TODO_STORAGE_KEY);
    if (storedTodos) {
      todos.value = JSON.parse(storedTodos);
    } else {
      // 如果没有存储数据，则使用初始数据
      todos.value = initialTodos;
      saveTodos();
    }
    loading.value = false;
  }, 500); // 模拟加载效果
};

// 保存数据到localStorage
const saveTodos = () => {
  localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos.value));
};

onMounted(() => {
  loadTodos();
});

// 打开添加对话框
const openAddDialog = () => {
  isEditMode.value = false;
  resetForm();
  dialogVisible.value = true;
};

// 打开编辑对话框
const openEditDialog = (row: TodoItem) => {
  isEditMode.value = true;
  form.value = { ...row };
  dialogVisible.value = true;
};

// 重置表单
const resetForm = () => {
  form.value = { ...initialFormState };
  if (formRef.value) {
    (formRef.value as any).resetFields();
  }
};

// 提交表单
const handleSubmit = () => {
  if (!form.value.title || !form.value.publisher) {
    ElMessage.error("标题和发布者不能为空");
    return;
  }

  if (isEditMode.value) {
    // 编辑模式
    const index = todos.value.findIndex(t => t.id === form.value.id);
    if (index !== -1) {
      todos.value[index] = { ...form.value };
      ElMessage.success("修改成功");
    }
  } else {
    // 添加模式
    const newTodo: TodoItem = {
      ...form.value,
      id: Date.now(),
      time: new Date().toLocaleString(),
      completed: false
    };
    todos.value.unshift(newTodo);
    ElMessage.success("添加成功");
  }

  saveTodos();
  dialogVisible.value = false;
};

// 删除待办
const deleteTodo = (row: TodoItem) => {
  ElMessageBox.confirm(`确定要删除 "${row.title}" 吗?`, "提示", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning"
  })
    .then(() => {
      const index = todos.value.findIndex(t => t.id === row.id);
      if (index !== -1) {
        todos.value.splice(index, 1);
        saveTodos();
        ElMessage.success("删除成功");
      }
    })
    .catch(() => {
      // 用户取消
    });
};

// 切换完成状态
const toggleStatus = (row: TodoItem) => {
  const index = todos.value.findIndex(t => t.id === row.id);
  if (index !== -1) {
    todos.value[index].completed = !todos.value[index].completed;
    saveTodos();
    ElMessage.success("状态更新成功");
  }
};
</script>

<style lang="scss" scoped>
.todo-container {
  .card {
    padding: 24px 30px;
    margin-bottom: 20px;
    background-color: #fff;
    border: none;
    border-radius: 16px;
    box-shadow: 0 4px 16px rgb(0 0 0 / 5%);
    transition: all 0.3s ease;
  }

  &.dark .card {
    background-color: #1e293b;
    box-shadow: 0 4px 20px rgb(0 0 0 / 20%);
  }

  .todo-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 15px;

    .header-left {
      min-width: 0;

      h3 {
        margin: 0 0 8px;
        font-size: 26px;
        font-weight: 700;
        color: #333;
      }

      p {
        margin: 0;
        font-size: 15px;
        color: #909399;
      }
    }

    .header-right {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
      justify-content: flex-end;
    }

    :deep(.el-radio-group) {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 0;
      overflow: hidden;
      border-radius: 18px;
      box-shadow: none;
    }

    :deep(.el-radio-button__inner) {
      min-width: 88px;
      padding: 10px 18px;
      font-size: 14px;
      font-weight: 600;
      box-shadow: none !important;
    }

    :deep(.el-radio-button:first-child .el-radio-button__inner) {
      border-top-left-radius: 18px;
      border-bottom-left-radius: 18px;
    }

    :deep(.el-radio-button:last-child .el-radio-button__inner) {
      border-top-right-radius: 18px;
      border-bottom-right-radius: 18px;
    }

    .add-btn {
      min-height: 42px;
      padding: 0 20px;
      box-shadow: none !important;

      &:hover,
      &:focus,
      &:focus-visible,
      &:active {
        box-shadow: none !important;
      }
    }
  }

  &.dark .todo-header {
    .header-left {
      h3 {
        color: #f1f5f9;
      }

      p {
        color: #94a3b8;
      }
    }
  }

  .todo-controls {
    display: flex;
    justify-content: flex-end;
  }

  &.dark .todo-controls {
    :deep(.el-radio-group) {
      .el-radio-button__inner {
        color: #94a3b8;
        background-color: #0f172a;
        border-color: #334155;
      }

      .el-radio-button__orig-radio:checked + .el-radio-button__inner {
        color: #fff;
        background-color: #3b82f6;
        border-color: #3b82f6;
      }
    }
  }

  .todo-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 20px 30px;
    margin-bottom: 15px;
    background-color: var(--el-bg-color);
    border-radius: 16px;
    transition: all 0.3s ease;

    &:hover {
      box-shadow: 0 6px 18px rgb(0 0 0 / 8%);
      transform: translateY(-2px);
    }

    .todo-info {
      display: flex;
      flex: 1;
      align-items: center;
      gap: 24px;
      min-width: 0;
    }

    .status-icon {
      flex-shrink: 0;
    }

    .text-content {
      min-width: 0;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .title {
      font-size: 18px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      word-break: break-word;

      &.is-completed {
        color: var(--el-text-color-placeholder);
        text-decoration: line-through;
      }
    }

    .meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0 24px;
      align-items: center;
      font-size: 15px;
      color: var(--el-text-color-secondary);
      line-height: 1.7;
    }

    .todo-actions {
      display: flex;
      gap: 16px;
      flex-shrink: 0;
      align-items: center;

      .todo-action-btn {
        min-width: auto;
        padding: 0;
        font-size: 16px;
        font-weight: 600;
        line-height: 1.4;
        color: inherit;
        cursor: pointer;
        background: transparent;
        border: none;
        border-radius: 0;
        white-space: nowrap;
        box-shadow: none !important;
        transition:
          color 0.2s ease,
          opacity 0.2s ease;

        &:hover,
        &:focus,
        &:focus-visible,
        &:active {
          opacity: 0.85;
          outline: none;
          box-shadow: none !important;
        }
      }

      .todo-action-btn--edit {
        color: var(--el-color-primary);
      }

      .todo-action-btn--delete {
        color: var(--el-color-danger);
      }
    }
  }

  &.dark .todo-row {
    background-color: #1e293b;

    .title {
      color: #f1f5f9;

      &.is-completed {
        color: #64748b;
      }
    }
  }
}

// Table transitions
:deep(.el-table__row) {
  transition: all 0.3s ease;
}

@media (max-width: 767px) {
  .todo-container {
    .card {
      padding: 22px 20px;
      border-radius: 20px;
    }

    .todo-header {
      align-items: stretch;
      flex-direction: column;
      gap: 18px;

      .header-left {
        h3 {
          font-size: 24px;
          line-height: 1.2;
        }

        p {
          font-size: 14px;
          line-height: 1.7;
        }
      }

      .header-right {
        align-items: stretch;
        flex-direction: column;
        gap: 14px;
      }

      :deep(.el-radio-group) {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        width: 100%;
      }

      :deep(.el-radio-button) {
        width: 100%;
      }

      :deep(.el-radio-button__inner) {
        width: 100%;
        min-width: 0;
        padding: 12px 10px;
        font-size: 15px;
        border-left: 1px solid var(--el-border-color) !important;
        border-radius: 0 !important;
      }

      :deep(.el-radio-button:first-child .el-radio-button__inner) {
        border-top-left-radius: 18px !important;
        border-bottom-left-radius: 18px !important;
        border-left: 1px solid var(--el-border-color) !important;
      }

      :deep(.el-radio-button:last-child .el-radio-button__inner) {
        border-top-right-radius: 18px !important;
        border-bottom-right-radius: 18px !important;
      }

      .add-btn {
        justify-content: center;
        width: 100%;
        min-height: 48px;
        font-size: 15px;
      }
    }

    .todo-list {
      margin-top: 18px;
    }

    .todo-row {
      flex-direction: column;
      justify-content: flex-start;
      align-items: stretch;
      padding: 20px;
      margin-bottom: 14px;

      &:hover {
        transform: none;
      }

      .todo-info {
        width: 100%;
        align-items: flex-start;
        gap: 14px;
      }

      .text-content {
        width: 100%;
      }

      .title-row {
        flex-wrap: wrap;
        gap: 10px;
      }

      .title {
        font-size: 17px;
        line-height: 1.55;
      }

      .meta-row {
        gap: 8px 16px;
        margin-top: 10px;
        font-size: 14px;
      }

      .todo-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-items: stretch;
        width: 100%;
        gap: 10px;
        margin-top: 16px;
        margin-left: 0;
        padding-top: 14px;
        border-top: 1px solid var(--el-border-color-lighter);

        .todo-action-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          min-height: 40px;
          margin: 0;
          padding: 0 12px;
          font-size: 14px;
          font-weight: 600;
          border: 1px solid transparent;
          border-radius: 14px;
          box-shadow: none !important;
          white-space: nowrap;
        }

        .todo-action-btn--edit {
          color: var(--el-color-primary);
          background: var(--el-color-primary-light-9);
          border-color: var(--el-color-primary-light-7);
        }

        .todo-action-btn--delete {
          color: var(--el-color-danger);
          background: var(--el-color-danger-light-9);
          border-color: var(--el-color-danger-light-7);
        }
      }
    }

    :deep(.el-dialog) {
      display: flex;
      flex-direction: column;
      width: min(500px, calc(100vw - 24px)) !important;
      max-height: calc(100vh - 24px);
      max-height: calc(100dvh - 24px);
      margin: 12px auto !important;
      border-radius: 20px;
    }

    :deep(.el-dialog__body) {
      flex: 1 1 auto;
      min-height: 0;
      padding: 16px 18px 8px !important;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }

    :deep(.el-form-item) {
      display: block;
      margin-bottom: 18px;
    }

    :deep(.el-form-item__label) {
      justify-content: flex-start;
      width: auto !important;
      height: auto;
      margin-bottom: 8px;
      line-height: 1.3;
    }

    :deep(.el-dialog__footer) {
      flex: 0 0 auto;
      padding: 12px 18px 18px;
    }

    :deep(.el-dialog__footer .el-button) {
      min-height: 42px;
      padding: 0 18px;
    }
  }
}
</style>

<style lang="scss">
@media (max-width: 768px) {
  .student-todo-dialog {
    width: min(500px, calc(100vw - 24px)) !important;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 24px);
    max-height: calc(100dvh - 24px);
    margin: 12px auto !important;
    overflow: hidden;
    border-radius: 20px;

    .el-dialog__header {
      padding: 18px 18px 8px;
    }

    .el-dialog__body {
      flex: 1 1 auto;
      min-height: 0;
      max-height: none;
      padding: 16px 18px 8px !important;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }

    .el-form-item {
      display: block;
      margin-bottom: 18px;
    }

    .el-form-item__label {
      justify-content: flex-start;
      width: auto !important;
      height: auto;
      margin-bottom: 8px;
      line-height: 1.3;
    }

    .el-form-item__content {
      width: 100%;
      margin-left: 0 !important;
    }

    .el-dialog__footer {
      flex: 0 0 auto;
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      padding: 12px 18px 18px;
    }

    .el-dialog__footer .el-button {
      min-height: 42px;
      padding: 0 18px;
    }
  }
}
</style>
