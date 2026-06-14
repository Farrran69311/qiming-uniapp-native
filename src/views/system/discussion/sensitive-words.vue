<script setup lang="ts">
/**
 * 管理员端 - 敏感词管理
 * 管理敏感词库，包括添加、编辑、删除、导入导出
 */
import { computed, reactive, ref, onMounted } from "vue";
import { ElMessage, ElMessageBox, type TagProps } from "element-plus";
import { usePageResponsive } from "@/utils/pageResponsive";
import {
  Plus,
  Search,
  Refresh,
  Delete,
  Edit,
  Upload,
  Download
} from "@element-plus/icons-vue";
import {
  getSensitiveWords,
  addSensitiveWord,
  updateSensitiveWord,
  deleteSensitiveWord,
  importSensitiveWords,
  type SensitiveWord,
  type SensitiveWordLevel
} from "@/api/discussion-admin";

defineOptions({
  name: "SensitiveWordsManage"
});

const { isMobile, paginationLayout, getDialogWidth } = usePageResponsive();

const loading = ref(false);
const words = ref<SensitiveWord[]>([]);
const selectedRows = ref<SensitiveWord[]>([]);
const dialogVisible = ref(false);
const importDialogVisible = ref(false);
const isEdit = ref(false);
const currentWord = ref<SensitiveWord | null>(null);

const stats = ref({
  total: 0,
  high: 0,
  medium: 0,
  low: 0
});

const searchForm = reactive({
  keyword: "",
  level: "" as SensitiveWordLevel | "",
  category: "",
  isEnabled: undefined as boolean | undefined
});

const formData = reactive({
  word: "",
  level: 2 as SensitiveWordLevel,
  category: "",
  replacement: "***",
  isEnabled: true
});

const importData = reactive({
  content: "",
  level: 2 as SensitiveWordLevel,
  category: ""
});

const pagination = reactive({
  page: 1,
  pageSize: 50,
  total: 0
});

const levelOptions = [
  { label: "高风险", value: 3, type: "danger" },
  { label: "中风险", value: 2, type: "warning" },
  { label: "低风险", value: 1, type: "info" }
] as const;

const categoryOptions = [
  "政治敏感",
  "色情低俗",
  "暴力血腥",
  "恶意广告",
  "人身攻击",
  "违法犯罪",
  "其他"
];

const selectedCount = computed(() => selectedRows.value.length);
const selectedWordIds = computed(
  () => new Set(selectedRows.value.map(item => item.id))
);
const activeFilterCount = computed(() => {
  let count = 0;

  if (searchForm.keyword.trim()) count += 1;
  if (searchForm.level) count += 1;
  if (searchForm.category) count += 1;
  if (typeof searchForm.isEnabled === "boolean") count += 1;

  return count;
});

const filterBadgeText = computed(() =>
  activeFilterCount.value > 0
    ? `已启用 ${activeFilterCount.value} 项筛选`
    : "当前展示全部敏感词"
);

const listSummaryText = computed(() => {
  if (loading.value && pagination.total === 0) {
    return "正在同步敏感词库...";
  }

  if (pagination.total === 0) {
    return "暂无敏感词记录";
  }

  if (selectedCount.value > 0) {
    return `共 ${pagination.total} 个敏感词，已选择 ${selectedCount.value} 个`;
  }

  return `共 ${pagination.total} 个敏感词，可继续筛选或批量处理`;
});

const getLevelType = (level: SensitiveWordLevel) => {
  const map: Record<number, NonNullable<TagProps["type"]>> = {
    3: "danger",
    2: "warning",
    1: "info"
  };
  return map[level] || "info";
};

const getLevelText = (level: SensitiveWordLevel) => {
  const map: Record<number, string> = {
    3: "高风险",
    2: "中风险",
    1: "低风险"
  };
  return map[level] || String(level);
};

const getEnabledText = (isEnabled: boolean) =>
  isEnabled ? "已启用" : "已禁用";

const getContentPreview = (text: string, limit = 20) => {
  if (!text) return "-";
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
};

const fetchData = async () => {
  loading.value = true;
  try {
    const params: {
      pageNum: number;
      pageSize: number;
      keyword?: string;
      level?: SensitiveWordLevel;
      category?: string;
      isEnabled?: number;
    } = {
      pageNum: pagination.page,
      pageSize: pagination.pageSize
    };

    if (searchForm.keyword) params.keyword = searchForm.keyword;
    if (searchForm.level) params.level = searchForm.level;
    if (searchForm.category) params.category = searchForm.category;

    if (searchForm.isEnabled === true) {
      params.isEnabled = 1;
    } else if (searchForm.isEnabled === false) {
      params.isEnabled = 0;
    } else {
      params.isEnabled = -1;
    }

    const res = await getSensitiveWords(params);
    const resData = (res as any).data || res;

    if (resData && typeof resData === "object") {
      if (Array.isArray(resData.list)) {
        words.value = resData.list;
        pagination.total = resData.total || resData.list.length;
      } else if (Array.isArray(resData)) {
        words.value = resData;
        pagination.total = resData.length;
      } else {
        words.value = [];
        pagination.total = 0;
      }
    } else {
      words.value = [];
      pagination.total = 0;
    }

    stats.value = {
      total: pagination.total,
      high: words.value.filter(item => item.level === 3).length,
      medium: words.value.filter(item => item.level === 2).length,
      low: words.value.filter(item => item.level === 1).length
    };
  } catch (error) {
    console.error("加载敏感词失败", error);
    ElMessage.error("加载数据失败，请检查控制台");
  } finally {
    loading.value = false;
  }
};

const handleSearch = () => {
  pagination.page = 1;
  fetchData();
};

const resetSearch = () => {
  searchForm.keyword = "";
  searchForm.level = "";
  searchForm.category = "";
  searchForm.isEnabled = undefined;
  handleSearch();
};

const handlePageChange = (page: number) => {
  pagination.page = page;
  fetchData();
};

const handleSizeChange = (size: number) => {
  pagination.pageSize = size;
  pagination.page = 1;
  fetchData();
};

const handleSelectionChange = (rows: SensitiveWord[]) => {
  selectedRows.value = rows;
};

const isWordSelected = (row: SensitiveWord) =>
  selectedWordIds.value.has(row.id);

const toggleMobileSelection = (row: SensitiveWord, checked: boolean) => {
  if (checked) {
    if (!isWordSelected(row)) {
      selectedRows.value = [...selectedRows.value, row];
    }
    return;
  }

  selectedRows.value = selectedRows.value.filter(item => item.id !== row.id);
};

const refreshData = async () => {
  await fetchData();
};

const openAddDialog = () => {
  isEdit.value = false;
  currentWord.value = null;
  formData.word = "";
  formData.level = 2;
  formData.category = "";
  formData.replacement = "***";
  formData.isEnabled = true;
  dialogVisible.value = true;
};

const openEditDialog = (row: SensitiveWord) => {
  isEdit.value = true;
  currentWord.value = row;
  formData.word = row.word;
  formData.level = row.level;
  formData.category = row.category || "";
  formData.replacement = row.replacement || "***";
  formData.isEnabled = row.isEnabled;
  dialogVisible.value = true;
};

const submitForm = async () => {
  if (!formData.word.trim()) {
    ElMessage.warning("请输入敏感词");
    return;
  }

  try {
    const isEditMode = isEdit.value && currentWord.value;
    const payload: {
      word: string;
      level: SensitiveWordLevel;
      category?: string;
      replacement?: string;
      isEnabled?: number;
    } = {
      word: formData.word,
      level: formData.level,
      category: formData.category || undefined,
      replacement: formData.replacement
    };

    if (isEditMode) {
      payload.isEnabled = formData.isEnabled ? 1 : 0;
    }

    if (isEditMode) {
      const res = await updateSensitiveWord(currentWord.value.id, payload);
      if (
        (res as any)?.code === 0 ||
        (res && typeof (res as any)?.code === "undefined")
      ) {
        ElMessage.success("更新成功");
        dialogVisible.value = false;
        await fetchData();
      } else {
        ElMessage.error((res as any).msg || "更新失败");
      }
    } else {
      const res = await addSensitiveWord(payload);
      if (
        (res as any)?.code === 0 ||
        (res && typeof (res as any)?.code === "undefined")
      ) {
        ElMessage.success("添加成功");
        dialogVisible.value = false;
        await fetchData();
      } else {
        ElMessage.error((res as any).msg || "添加失败");
      }
    }
  } catch (error) {
    console.error("操作失败:", error);
    ElMessage.error(isEdit.value ? "更新失败" : "添加失败");
  }
};

const handleDelete = async (row: SensitiveWord) => {
  try {
    await ElMessageBox.confirm(`确定要删除敏感词「${row.word}」吗？`, "提示", {
      type: "warning"
    });
    const res = await deleteSensitiveWord(row.id);
    if (
      (res as any)?.code === 0 ||
      (res && typeof (res as any)?.code === "undefined")
    ) {
      ElMessage.success("删除成功");
      await fetchData();
    } else {
      ElMessage.error((res as any).msg || "删除失败");
    }
  } catch (error: any) {
    if (error !== "cancel") {
      ElMessage.error("删除失败");
    }
  }
};

const batchDelete = async () => {
  if (selectedRows.value.length === 0) {
    ElMessage.warning("请选择要删除的敏感词");
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedRows.value.length} 个敏感词吗？`,
      "提示",
      { type: "warning" }
    );

    await Promise.all(
      selectedRows.value.map(row => deleteSensitiveWord(row.id))
    );
    ElMessage.success("批量删除成功");
    selectedRows.value = [];
    await fetchData();
  } catch (error: any) {
    if (error !== "cancel") {
      ElMessage.error("批量删除失败");
    }
  }
};

const toggleEnabled = async (row: SensitiveWord) => {
  const oldStatus = row.isEnabled;
  try {
    const newStatus = !row.isEnabled;
    row.isEnabled = newStatus;
    const res = await updateSensitiveWord(row.id, {
      isEnabled: newStatus ? 1 : 0
    });

    if (
      (res as any)?.code === 0 ||
      (res && typeof (res as any)?.code === "undefined")
    ) {
      ElMessage.success(row.isEnabled ? "已启用" : "已禁用");
    } else {
      throw new Error((res as any).msg || "操作失败");
    }
  } catch (error: any) {
    row.isEnabled = oldStatus;
    ElMessage.error(error.message || "操作失败");
  }
};

const openImportDialog = () => {
  importData.content = "";
  importData.level = 2;
  importData.category = "";
  importDialogVisible.value = true;
};

const submitImport = async () => {
  if (!importData.content.trim()) {
    ElMessage.warning("请输入要导入的敏感词");
    return;
  }

  try {
    const wordsToImport = importData.content
      .split("\n")
      .map(word => word.trim())
      .filter(Boolean);

    if (wordsToImport.length === 0) {
      ElMessage.warning("没有有效的敏感词");
      return;
    }

    await importSensitiveWords({
      words: wordsToImport.map(word => ({
        word,
        level: importData.level,
        category: importData.category || undefined
      }))
    });

    ElMessage.success("导入完成");
    importDialogVisible.value = false;
    await fetchData();
  } catch (error) {
    ElMessage.error("导入失败");
  }
};

const handleExport = () => {
  const content = words.value.map(item => item.word).join("\n");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `敏感词_${new Date().toISOString().slice(0, 10)}.txt`;
  link.click();
  URL.revokeObjectURL(url);
  ElMessage.success("导出成功");
};

const formatTime = (dateStr: string) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
};

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div
    class="sensitive-words-page p-4"
    :class="{ 'sensitive-words-page--mobile': isMobile }"
  >
    <div class="sensitive-stats-grid mb-4">
      <div class="sensitive-stats-grid__item">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-number">{{ stats.total }}</div>
            <div class="stat-label">总敏感词</div>
          </div>
        </el-card>
      </div>
      <div class="sensitive-stats-grid__item">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-number text-danger">{{ stats.high }}</div>
            <div class="stat-label">高风险</div>
          </div>
        </el-card>
      </div>
      <div class="sensitive-stats-grid__item">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-number text-warning">{{ stats.medium }}</div>
            <div class="stat-label">中风险</div>
          </div>
        </el-card>
      </div>
      <div class="sensitive-stats-grid__item">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-number text-info">{{ stats.low }}</div>
            <div class="stat-label">低风险</div>
          </div>
        </el-card>
      </div>
    </div>

    <el-card shadow="never" class="mb-4 sensitive-panel">
      <div class="flex justify-between items-center mb-4">
        <span class="font-bold text-base">筛选条件</span>
        <div class="text-sm text-gray-500">
          {{ filterBadgeText }}
        </div>
      </div>

      <el-form
        :inline="!isMobile"
        :label-position="isMobile ? 'top' : 'right'"
        :model="searchForm"
      >
        <el-form-item label="关键词">
          <el-input
            v-model="searchForm.keyword"
            placeholder="搜索敏感词"
            clearable
            :style="{ width: isMobile ? '100%' : '180px' }"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="级别">
          <el-select
            v-model="searchForm.level"
            placeholder="全部级别"
            clearable
            :style="{ width: isMobile ? '100%' : '150px' }"
          >
            <el-option
              v-for="opt in levelOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="分类">
          <el-select
            v-model="searchForm.category"
            placeholder="全部分类"
            clearable
            :style="{ width: isMobile ? '100%' : '170px' }"
          >
            <el-option
              v-for="cat in categoryOptions"
              :key="cat"
              :label="cat"
              :value="cat"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select
            v-model="searchForm.isEnabled"
            placeholder="全部状态"
            clearable
            :style="{ width: isMobile ? '100%' : '140px' }"
          >
            <el-option label="已启用" :value="true" />
            <el-option label="已禁用" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">
            搜索
          </el-button>
          <el-button :icon="Refresh" @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>

      <div class="toolbar-actions">
        <el-button type="primary" :icon="Plus" @click="openAddDialog">
          添加敏感词
        </el-button>
        <el-button type="success" :icon="Upload" @click="openImportDialog">
          批量导入
        </el-button>
        <el-button :icon="Download" @click="handleExport">导出</el-button>
        <el-button
          type="danger"
          :icon="Delete"
          :disabled="selectedCount === 0"
          @click="batchDelete"
        >
          批量删除
        </el-button>
      </div>
    </el-card>

    <el-card shadow="never" class="sensitive-panel data-card">
      <div class="flex justify-between items-center mb-4">
        <span class="font-bold text-base">敏感词管理</span>
        <div class="text-sm text-gray-500">{{ listSummaryText }}</div>
      </div>
      <div class="flex justify-end mb-4">
        <el-button :icon="Refresh" text @click="refreshData">
          同步数据
        </el-button>
      </div>

      <div v-if="isMobile" v-loading="loading" class="mobile-word-list">
        <div v-for="row in words" :key="row.id" class="mobile-word-card">
          <div class="mobile-word-card__header">
            <div class="mobile-word-card__title">
              <el-checkbox
                :model-value="isWordSelected(row)"
                class="mobile-word-card__checkbox"
                @change="
                  checked => toggleMobileSelection(row, Boolean(checked))
                "
              >
                选择
              </el-checkbox>
              <span :class="{ 'is-disabled': !row.isEnabled }">
                {{ getContentPreview(row.word, 28) }}
              </span>
            </div>
            <el-tag :type="getLevelType(row.level)" effect="dark" size="small">
              {{ getLevelText(row.level) }}
            </el-tag>
          </div>

          <div class="mobile-word-card__meta">
            <div class="mobile-word-card__meta-item">
              <span class="label">分类</span>
              <span class="value">{{ row.category || "-" }}</span>
            </div>
            <div class="mobile-word-card__meta-item">
              <span class="label">状态</span>
              <span class="value">{{ getEnabledText(row.isEnabled) }}</span>
            </div>
            <div class="mobile-word-card__meta-item">
              <span class="label">替换文本</span>
              <code class="value">{{ row.replacement || "***" }}</code>
            </div>
            <div class="mobile-word-card__meta-item">
              <span class="label">命中次数</span>
              <span class="value">{{ row.hitCount || 0 }}</span>
            </div>
            <div
              class="mobile-word-card__meta-item mobile-word-card__meta-item--full"
            >
              <span class="label">创建时间</span>
              <span class="value">{{ formatTime(row.createTime) }}</span>
            </div>
          </div>

          <div class="mobile-word-card__status">
            <span class="mobile-word-card__status-label">启用状态</span>
            <el-switch
              :model-value="row.isEnabled"
              size="small"
              @click.stop="toggleEnabled(row)"
            />
          </div>

          <div class="mobile-word-card__actions">
            <el-button plain @click="openEditDialog(row)">编辑</el-button>
            <el-button type="danger" plain @click="handleDelete(row)">
              删除
            </el-button>
          </div>
        </div>

        <el-empty
          v-if="!loading && words.length === 0"
          description="暂无敏感词记录"
        />
      </div>

      <el-table
        v-else
        v-loading="loading"
        :data="words"
        stripe
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column label="敏感词" prop="word" min-width="150">
          <template #default="{ row }">
            <span :class="{ 'text-gray-400 line-through': !row.isEnabled }">
              {{ row.word }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="风险级别" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getLevelType(row.level)" size="small">
              {{ getLevelText(row.level) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          label="分类"
          prop="category"
          width="120"
          align="center"
        >
          <template #default="{ row }">
            {{ row.category || "-" }}
          </template>
        </el-table-column>
        <el-table-column
          label="替换文本"
          prop="replacement"
          width="100"
          align="center"
        >
          <template #default="{ row }">
            <code class="text-xs">{{ row.replacement }}</code>
          </template>
        </el-table-column>
        <el-table-column
          label="命中次数"
          prop="hitCount"
          width="100"
          align="center"
        >
          <template #default="{ row }">
            <el-badge
              :value="row.hitCount || 0"
              :type="row.hitCount > 10 ? 'warning' : 'info'"
            />
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="row.isEnabled"
              size="small"
              @click.stop="toggleEnabled(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="120" align="center">
          <template #default="{ row }">
            <span class="text-sm text-gray-500">
              {{ formatTime(row.createTime) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" align="center" fixed="right">
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              :icon="Edit"
              @click="openEditDialog(row)"
            >
              编辑
            </el-button>
            <el-button
              link
              type="danger"
              :icon="Delete"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-bar">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[50, 100, 200]"
          :layout="paginationLayout"
          :size="isMobile ? 'small' : 'default'"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑敏感词' : '添加敏感词'"
      :width="getDialogWidth('500px')"
      destroy-on-close
    >
      <el-form
        :model="formData"
        :label-position="isMobile ? 'top' : 'right'"
        :label-width="isMobile ? undefined : '100px'"
      >
        <el-form-item label="敏感词" required>
          <el-input
            v-model="formData.word"
            placeholder="请输入敏感词"
            :disabled="isEdit"
          />
        </el-form-item>
        <el-form-item label="风险级别" required>
          <el-radio-group v-model="formData.level" class="level-group">
            <el-radio-button
              v-for="opt in levelOptions"
              :key="opt.value"
              :label="opt.value"
            >
              {{ opt.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="分类">
          <el-select
            v-model="formData.category"
            placeholder="选择分类（可选）"
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="cat in categoryOptions"
              :key="cat"
              :label="cat"
              :value="cat"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="替换文本">
          <el-input
            v-model="formData.replacement"
            placeholder="命中时替换为此文本，默认为 ***"
          />
        </el-form-item>
        <el-form-item label="启用状态">
          <el-switch v-model="formData.isEnabled" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">
          {{ isEdit ? "更新" : "添加" }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="importDialogVisible"
      title="批量导入敏感词"
      :width="getDialogWidth('600px')"
      destroy-on-close
    >
      <el-form
        :model="importData"
        :label-position="isMobile ? 'top' : 'right'"
        :label-width="isMobile ? undefined : '100px'"
      >
        <el-form-item label="敏感词列表" required>
          <el-input
            v-model="importData.content"
            type="textarea"
            :rows="10"
            placeholder="请输入敏感词，每行一个"
          />
        </el-form-item>
        <el-form-item label="默认级别">
          <el-radio-group v-model="importData.level" class="level-group">
            <el-radio-button
              v-for="opt in levelOptions"
              :key="opt.value"
              :label="opt.value"
            >
              {{ opt.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="默认分类">
          <el-select
            v-model="importData.category"
            placeholder="选择分类（可选）"
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="cat in categoryOptions"
              :key="cat"
              :label="cat"
              :value="cat"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <div class="import-tips">
        <p>提示：</p>
        <ul class="list-disc list-inside">
          <li>每行一个敏感词</li>
          <li>重复的敏感词会自动跳过</li>
          <li>导入的敏感词默认启用</li>
        </ul>
      </div>

      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitImport">导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.sensitive-words-page {
  .sensitive-stats-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
  }

  .sensitive-stats-grid__item {
    min-width: 0;
  }

  :deep(.el-card) {
    border: none;
    border-radius: 16px;
    box-shadow:
      0 4px 6px -1px rgb(0 0 0 / 0.1),
      0 2px 4px -2px rgb(0 0 0 / 0.1);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;

    html.dark & {
      background-color: #242424;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.3);
    }

    &:hover {
      transform: translateY(-2px);
      box-shadow:
        0 10px 15px -3px rgb(0 0 0 / 0.1),
        0 4px 6px -4px rgb(0 0 0 / 0.1);

      html.dark & {
        box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.5);
      }
    }
  }

  :deep(.el-table) {
    .el-table__row {
      height: 72px;
    }
  }

  .sensitive-panel {
    border: 1px solid rgb(226 232 240 / 88%);
    border-radius: 28px;
    background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);

    html.dark & {
      border-color: #334155;
      background: linear-gradient(180deg, #1f2937 0%, #111827 100%);
    }

    :deep(.el-card__body) {
      padding: 24px;
    }
  }

  .sensitive-panel__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
  }

  .sensitive-panel__header--compact {
    margin-bottom: 16px;
  }

  .sensitive-panel__copy {
    display: flex;
    flex-direction: column;
    gap: 6px;

    h3 {
      margin: 0;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #0f172a;

      html.dark & {
        color: #f8fafc;
      }
    }

    p {
      margin: 0;
      font-size: 14px;
      line-height: 1.6;
      color: #64748b;

      html.dark & {
        color: #94a3b8;
      }
    }
  }

  .sensitive-panel__eyebrow {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #6366f1;
    text-transform: uppercase;
  }

  .sensitive-panel__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    padding: 0 14px;
    border: 1px solid #dbeafe;
    border-radius: 999px;
    background: #eff6ff;
    font-size: 13px;
    font-weight: 600;
    color: #1d4ed8;
    white-space: nowrap;

    html.dark & {
      border-color: #1d4ed8;
      background: rgb(29 78 216 / 18%);
      color: #bfdbfe;
    }

    &.is-active {
      border-color: #c7d2fe;
      background: #eef2ff;
      color: #4f46e5;

      html.dark & {
        border-color: #4f46e5;
        background: rgb(79 70 229 / 18%);
        color: #c7d2fe;
      }
    }
  }

  .stat-card {
    border: 1px solid rgb(226 232 240 / 92%);
    border-radius: 24px;
    background: linear-gradient(180deg, #fff 0%, #f8fbff 100%);

    html.dark & {
      border-color: #334155;
      background: linear-gradient(180deg, #1f2937 0%, #111827 100%);
    }

    .stat-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 132px;
      padding: 12px 10px;
      text-align: center;

      .stat-number {
        font-size: 32px;
        font-weight: 700;
        line-height: 1;

        &.text-danger {
          color: #ef4444;
        }

        &.text-warning {
          color: #f59e0b;
        }

        &.text-info {
          color: #3b82f6;
        }
      }

      .stat-label {
        margin-top: 10px;
        font-size: 14px;
        font-weight: 500;
        color: #64748b;

        html.dark & {
          color: #94a3b8;
        }
      }
    }
  }

  .search-form {
    padding: 0;

    :deep(.el-form-item) {
      margin-right: 16px;
      margin-bottom: 16px;
    }

    :deep(.el-form-item__label) {
      font-weight: 700;
      color: #334155;

      html.dark & {
        color: #cbd5e1;
      }
    }

    :deep(.el-input__wrapper),
    :deep(.el-select__wrapper) {
      min-height: 46px;
      border-radius: 14px;
      box-shadow: 0 8px 24px rgb(15 23 42 / 6%);
    }
  }

  .search-form__action-item {
    margin-right: 0 !important;

    :deep(.el-form-item__content) {
      width: 100%;
    }
  }

  .search-form__actions,
  .toolbar-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .toolbar-actions {
    margin-top: 4px;
  }

  .search-form__actions :deep(.el-button),
  .toolbar-actions :deep(.el-button),
  .sync-status-btn {
    min-height: 44px;
    margin-left: 0;
    padding-inline: 18px;
    font-weight: 600;
    border-radius: 14px;
  }

  .mobile-word-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .mobile-word-card {
    padding: 18px;
    background: linear-gradient(
      180deg,
      rgb(255 255 255 / 98%) 0%,
      rgb(248 250 252 / 96%) 100%
    );
    border: 1px solid rgb(226 232 240 / 88%);
    border-radius: 22px;
    box-shadow: 0 14px 32px rgb(15 23 42 / 8%);

    html.dark & {
      background: linear-gradient(180deg, #1f2937 0%, #111827 100%);
      border-color: #334155;
      box-shadow: 0 14px 32px rgb(2 6 23 / 24%);
    }
  }

  .mobile-word-card__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .mobile-word-card__title {
    font-size: 16px;
    font-weight: 700;
    color: #1e293b;
    word-break: break-word;

    html.dark & {
      color: #f8fafc;
    }

    .is-disabled {
      color: #94a3b8;
      text-decoration: line-through;
    }
  }

  .mobile-word-card__meta {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid rgb(226 232 240 / 88%);

    html.dark & {
      border-color: #334155;
    }
  }

  .mobile-word-card__meta-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;

    &--full {
      grid-column: 1 / -1;
    }

    .label {
      font-size: 12px;
      font-weight: 700;
      color: #94a3b8;
      letter-spacing: 0.04em;
    }

    .value {
      font-size: 14px;
      line-height: 1.6;
      color: #334155;
      word-break: break-word;

      html.dark & {
        color: #e2e8f0;
      }
    }
  }

  .mobile-word-card__status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 14px;
    padding: 14px 0;
    border-top: 1px solid rgb(226 232 240 / 88%);
    border-bottom: 1px solid rgb(226 232 240 / 88%);

    html.dark & {
      border-color: #334155;
    }
  }

  .mobile-word-card__status-label {
    font-size: 13px;
    color: #94a3b8;
  }

  .mobile-word-card__actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 16px;
  }

  .mobile-word-card__actions :deep(.el-button) {
    width: 100%;
    min-height: 42px;
    margin-left: 0;
    font-weight: 600;
    border-radius: 14px;
  }

  .pagination-bar {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }

  .level-group {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .import-tips {
    margin-top: 8px;
    font-size: 14px;
    color: #64748b;

    html.dark & {
      color: #94a3b8;
    }
  }
}

@media (max-width: 768px) {
  .sensitive-words-page {
    padding-bottom: calc(
      var(--pure-mobile-tab-height) + var(--pure-safe-area-bottom) + 28px
    );

    .sensitive-panel {
      border-radius: 24px;

      :deep(.el-card__body) {
        padding: 18px;
      }
    }

    .sensitive-panel__header {
      flex-direction: column;
      margin-bottom: 16px;
    }

    .sensitive-panel__copy {
      h3 {
        font-size: 20px;
      }

      p {
        font-size: 13px;
      }
    }

    .sensitive-panel__badge {
      width: 100%;
      white-space: normal;
    }

    .search-form {
      :deep(.el-form-item) {
        width: 100%;
        margin-right: 0;
        margin-bottom: 12px;
      }

      :deep(.el-form-item__label) {
        padding: 0 0 8px;
        line-height: 1.25;
      }

      :deep(.el-form-item__content) {
        width: 100%;
      }

      :deep(.el-select) {
        width: 100% !important;
      }
    }

    .search-form__actions,
    .toolbar-actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      width: 100%;
    }

    .pagination-bar {
      justify-content: center;
    }
  }
}

@media (max-width: 420px) {
  .sensitive-words-page {
    .sensitive-stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .mobile-word-card {
      padding: 16px;
      border-radius: 20px;
    }

    .mobile-word-card__meta,
    .search-form__actions,
    .toolbar-actions,
    .mobile-word-card__actions {
      grid-template-columns: 1fr;
    }
  }
}
</style>
