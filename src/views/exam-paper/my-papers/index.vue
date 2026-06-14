<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useDark } from "@pureadmin/utils";
import { useAppStoreHook } from "@/store/modules/app";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  Plus,
  Folder,
  FolderAdd,
  MoreFilled,
  Search,
  Refresh,
  Edit,
  Upload,
  FolderOpened,
  CopyDocument,
  Delete
} from "@element-plus/icons-vue";
import {
  getMyPaperStatistics,
  getPaperList,
  getPaperFolders,
  createPaperFolder,
  updatePaperFolder,
  deletePaperFolder,
  movePapersToFolder,
  type PaperStatus,
  type PaperFolder
} from "@/api/examPaper";
import {
  isNativeWebViewRuntime,
  logNativeFallback
} from "@/utils/nativeRuntime";
import {
  nativeDemoMyPaperFolders,
  nativeDemoMyPaperList,
  type NativeDemoMyPaperItem
} from "@/views/exam-paper/nativeDemoMyPapers";

// 导入 SVG 图标组件
import IconDocument from "@/assets/home-icons/document.svg?component";
import IconCheckCircle from "@/assets/home-icons/check-circle.svg?component";
import IconEdit from "@/assets/home-icons/edit.svg?component";
import IconClock from "@/assets/home-icons/clock.svg?component";

defineOptions({
  name: "ExamPaperMyPapers"
});

const router = useRouter();
const { isDark } = useDark();
const appStore = useAppStoreHook();
const isMobile = computed(() => appStore.getDevice === "mobile");

// 搜索表单
const searchForm = reactive({
  keyword: "",
  status: "",
  courseId: ""
});

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 3
});

// 试卷列表
const paperList = ref<any[]>([]);

const loading = ref(false);
const isUsingNativeDemoData = ref(false);
const nativePaperList = ref<NativeDemoMyPaperItem[]>(
  JSON.parse(JSON.stringify(nativeDemoMyPaperList))
);
const nativePaperFolders = ref<PaperFolder[]>(
  JSON.parse(JSON.stringify(nativeDemoMyPaperFolders))
);

// 课程列表
const courseList = ref([
  { id: 1, name: "高等数学" },
  { id: 2, name: "嵌入式 Linux" },
  { id: 3, name: "计算机基础" },
  { id: 4, name: "线性代数" },
  { id: 5, name: "概率论" }
]);

// 统计数据
const statistics = ref({
  total: 0,
  published: 0,
  draft: 0,
  recent: 0
});

const statCards = computed(() => [
  {
    label: "试卷总数",
    value: statistics.value.total,
    icon: IconDocument,
    color: "#4A7FC8"
  },
  {
    label: "已发布",
    value: statistics.value.published,
    icon: IconCheckCircle,
    color: "#739CF9"
  },
  {
    label: "草稿箱",
    value: statistics.value.draft,
    icon: IconEdit,
    color: "#f59e0b"
  },
  {
    label: "最近编辑",
    value: statistics.value.recent,
    icon: IconClock,
    color: "#475569"
  }
]);

const paginationLayout = computed(() =>
  isMobile.value
    ? "prev, pager, next"
    : "total, sizes, prev, pager, next, jumper"
);

const getPaperQuestionCount = (paper: any) => {
  return paper.questionCount ?? paper.totalQuestions ?? 0;
};

const getPaperPublishCount = (paper: any) => {
  return paper.publishCount ?? paper.publishTimes ?? 0;
};

const getPaperUpdateTime = (paper: any) => {
  return paper.updateTime || paper.updatedAt || paper.createTime || "-";
};

const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

// ==================== 文件夹相关状态 ====================
const folderList = ref<PaperFolder[]>([]);
const folderTreeData = computed(() => {
  return [
    { id: 0, name: "全部试卷", paperCount: statistics.value.total },
    ...folderList.value
  ];
});
const selectedFolderId = ref<number | null>(null);
const folderDialogVisible = ref(false);
const editingFolder = ref<{ id?: number; name: string; parentId?: number }>({
  name: ""
});
const isNewFolder = ref(false);
const moveDialogVisible = ref(false);
const targetFolderId = ref<number | null>(null);
const selectedPaperIds = ref<number[]>([]);

const refreshNativePaperFolders = () => {
  nativePaperFolders.value = nativePaperFolders.value.map(folder => ({
    ...folder,
    paperCount: nativePaperList.value.filter(
      paper => paper.folderId === folder.id
    ).length
  }));
};

const applyNativePaperStatistics = () => {
  statistics.value = {
    total: nativePaperList.value.length,
    published: nativePaperList.value.filter(paper => paper.status === 1).length,
    draft: nativePaperList.value.filter(paper => paper.status === 0).length,
    recent: nativePaperList.value.filter(paper =>
      String(paper.updateTime || paper.createTime || "").startsWith("2026-06")
    ).length
  };
};

const applyNativePaperList = () => {
  const keyword = searchForm.keyword.trim().toLowerCase();
  const status =
    searchForm.status !== "" ? Number(searchForm.status) : undefined;
  const courseId = searchForm.courseId ? Number(searchForm.courseId) : null;
  const selectedCourseName = courseList.value.find(
    course => course.id === courseId
  )?.name;

  const filtered = nativePaperList.value.filter(paper => {
    const matchesKeyword =
      !keyword ||
      paper.title.toLowerCase().includes(keyword) ||
      paper.courseName.toLowerCase().includes(keyword) ||
      (paper.folderName || "").toLowerCase().includes(keyword);
    const matchesStatus = status === undefined || paper.status === status;
    const matchesCourse =
      !selectedCourseName || paper.courseName === selectedCourseName;
    const matchesFolder =
      selectedFolderId.value === null ||
      paper.folderId === selectedFolderId.value;

    return matchesKeyword && matchesStatus && matchesCourse && matchesFolder;
  });

  pagination.total = filtered.length;
  const start = (pagination.page - 1) * pagination.pageSize;
  paperList.value = filtered.slice(start, start + pagination.pageSize);
};

const refreshNativePaperState = () => {
  refreshNativePaperFolders();
  applyNativePaperStatistics();
  folderList.value = nativePaperFolders.value;
  applyNativePaperList();
};

const applyNativeMyPapersFallback = (reason: string, error?: unknown) => {
  if (!isNativeWebViewRuntime()) return false;

  isUsingNativeDemoData.value = true;
  logNativeFallback(reason, error);
  refreshNativePaperState();
  return true;
};

const resolveFolderName = (folderId?: number | null) =>
  nativePaperFolders.value.find(folder => folder.id === folderId)?.name || "";

// 搜索
const handleSearch = () => {
  pagination.page = 1;
  if (isUsingNativeDemoData.value) {
    applyNativePaperList();
    return;
  }
  loadData();
};

// 重置
const handleReset = () => {
  searchForm.keyword = "";
  searchForm.status = "";
  searchForm.courseId = "";
  handleSearch();
};

// 加载统计数据
const loadStatistics = async () => {
  if (isUsingNativeDemoData.value) {
    applyNativePaperStatistics();
    return;
  }

  try {
    const res = await getMyPaperStatistics();
    if (res.code === 0 && res.data) {
      statistics.value = res.data;
    } else {
      applyNativeMyPapersFallback("使用原生演示试卷统计", res);
    }
  } catch (e) {
    applyNativeMyPapersFallback("获取统计数据失败，已使用原生演示试卷", e);
  }
};

// 加载试卷列表
const loadData = async () => {
  if (isUsingNativeDemoData.value) {
    applyNativePaperList();
    return;
  }

  loading.value = true;
  try {
    const res = await getPaperList({
      pageNum: pagination.page,
      pageSize: pagination.pageSize,
      keyword: searchForm.keyword || undefined,
      status:
        searchForm.status !== ""
          ? (Number(searchForm.status) as PaperStatus)
          : undefined,
      courseId: searchForm.courseId ? Number(searchForm.courseId) : undefined
    });
    if (res.code === 0 && res.data) {
      paperList.value = res.data.list || [];
      pagination.total = res.data.total || 0;
    } else {
      applyNativeMyPapersFallback("使用原生演示试卷列表", res);
    }
  } catch (e) {
    applyNativeMyPapersFallback("获取试卷列表失败，已使用原生演示试卷", e);
  } finally {
    loading.value = false;
  }
};

// ==================== 文件夹相关方法 ====================
const fetchFolders = async () => {
  if (isUsingNativeDemoData.value) {
    refreshNativePaperFolders();
    folderList.value = nativePaperFolders.value;
    return;
  }

  try {
    const res = await getPaperFolders();
    if (res.code === 0 && res.data) {
      folderList.value = res.data;
    } else {
      applyNativeMyPapersFallback("使用原生演示试卷文件夹", res);
    }
  } catch (e) {
    applyNativeMyPapersFallback("获取文件夹列表失败，已使用原生演示文件夹", e);
  }
};

const selectFolder = (folderId: number | null) => {
  selectedFolderId.value = folderId === 0 ? null : folderId;
  pagination.page = 1;
  loadData();
};

const openNewFolderDialog = () => {
  isNewFolder.value = true;
  editingFolder.value = { name: "" };
  folderDialogVisible.value = true;
};

const openEditFolderDialog = (folder: PaperFolder) => {
  isNewFolder.value = false;
  editingFolder.value = { id: folder.id, name: folder.name };
  folderDialogVisible.value = true;
};

const saveFolder = async () => {
  if (!editingFolder.value.name.trim()) {
    ElMessage.warning("请输入文件夹名称");
    return;
  }
  try {
    if (isNewFolder.value) {
      if (isUsingNativeDemoData.value) {
        nativePaperFolders.value.push({
          id: Date.now(),
          name: editingFolder.value.name.trim(),
          parentId: editingFolder.value.parentId,
          paperCount: 0,
          createTime: new Date().toISOString().split("T")[0]
        });
        ElMessage.success("创建成功");
        folderDialogVisible.value = false;
        refreshNativePaperState();
        return;
      }

      await createPaperFolder({
        name: editingFolder.value.name,
        parentId: editingFolder.value.parentId
      });
      ElMessage.success("创建成功");
    } else {
      if (isUsingNativeDemoData.value) {
        nativePaperFolders.value = nativePaperFolders.value.map(folder =>
          folder.id === editingFolder.value.id
            ? { ...folder, name: editingFolder.value.name.trim() }
            : folder
        );
        nativePaperList.value = nativePaperList.value.map(paper =>
          paper.folderId === editingFolder.value.id
            ? { ...paper, folderName: editingFolder.value.name.trim() }
            : paper
        );
        ElMessage.success("更新成功");
        folderDialogVisible.value = false;
        refreshNativePaperState();
        return;
      }

      await updatePaperFolder({
        id: editingFolder.value.id!,
        name: editingFolder.value.name
      });
      ElMessage.success("更新成功");
    }
    folderDialogVisible.value = false;
    fetchFolders();
  } catch (e) {
    console.error("保存文件夹失败", e);
  }
};

const handleDeleteFolder = (folder: PaperFolder) => {
  ElMessageBox.confirm(
    `确定要删除文件夹"${folder.name}"吗？文件夹内的试卷将移至"全部试卷"`,
    "提示",
    {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning"
    }
  ).then(async () => {
    try {
      if (isUsingNativeDemoData.value) {
        nativePaperFolders.value = nativePaperFolders.value.filter(
          item => item.id !== folder.id
        );
        nativePaperList.value = nativePaperList.value.map(paper =>
          paper.folderId === folder.id
            ? { ...paper, folderId: undefined, folderName: "" }
            : paper
        );
        if (selectedFolderId.value === folder.id) {
          selectedFolderId.value = null;
        }
        ElMessage.success("删除成功");
        refreshNativePaperState();
        return;
      }

      await deletePaperFolder(folder.id);
      ElMessage.success("删除成功");
      if (selectedFolderId.value === folder.id) {
        selectedFolderId.value = null;
      }
      fetchFolders();
      loadData();
    } catch (e) {
      console.error("删除文件夹失败", e);
    }
  });
};

const openMoveDialog = (paperIds: number[]) => {
  selectedPaperIds.value = paperIds;
  targetFolderId.value = null;
  moveDialogVisible.value = true;
};

const handleMoveToFolder = async () => {
  if (targetFolderId.value === null) {
    ElMessage.warning("请选择目标文件夹");
    return;
  }
  try {
    if (isUsingNativeDemoData.value) {
      const folderName = resolveFolderName(targetFolderId.value);
      nativePaperList.value = nativePaperList.value.map(paper =>
        selectedPaperIds.value.includes(paper.paperId)
          ? { ...paper, folderId: targetFolderId.value!, folderName }
          : paper
      );
      ElMessage.success("移动成功");
      moveDialogVisible.value = false;
      selectedPaperIds.value = [];
      refreshNativePaperState();
      return;
    }

    await movePapersToFolder({
      paperIds: selectedPaperIds.value,
      folderId: targetFolderId.value
    });
    ElMessage.success("移动成功");
    moveDialogVisible.value = false;
    loadData();
    fetchFolders();
  } catch (e) {
    console.error("移动试卷失败", e);
  }
};

// 创建新试卷
const createPaper = () => {
  router.push("/exam-paper/editor");
};

// 编辑试卷
const editPaper = (paper: any) => {
  router.push(`/exam-paper/editor/${paper.paperId}`);
};

// 复制试卷
const copyPaper = (paper: any) => {
  ElMessageBox.confirm(`确定要复制试卷"${paper.title}"吗？`, "提示", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "info"
  }).then(() => {
    if (isUsingNativeDemoData.value) {
      nativePaperList.value.unshift({
        ...deepClone(paper),
        paperId: Date.now(),
        title: `${paper.title} 副本`,
        status: 0,
        statusText: "草稿",
        publishCount: 0,
        createTime: new Date().toISOString().slice(0, 16).replace("T", " "),
        updateTime: new Date().toISOString().slice(0, 16).replace("T", " ")
      });
      ElMessage.success("复制成功");
      refreshNativePaperState();
      return;
    }

    ElMessage.success("复制成功");
  });
};

// 删除试卷
const deletePaper = (paper: any) => {
  ElMessageBox.confirm(`确定要删除试卷"${paper.title}"吗？`, "警告", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning"
  }).then(() => {
    if (isUsingNativeDemoData.value) {
      nativePaperList.value = nativePaperList.value.filter(
        item => item.paperId !== paper.paperId
      );
      ElMessage.success("删除成功");
      refreshNativePaperState();
      return;
    }

    ElMessage.success("删除成功");
    loadData();
  });
};

// 发布试卷
const publishPaper = (paper: any) => {
  router.push({
    path: `/exam-paper/editor/${paper.paperId}`,
    query: { publish: "1" }
  });
};

const handleMobileAction = (command: string, paper: any) => {
  switch (command) {
    case "edit":
      editPaper(paper);
      break;
    case "publish":
      publishPaper(paper);
      break;
    case "move":
      openMoveDialog([paper.paperId]);
      break;
    case "copy":
      copyPaper(paper);
      break;
    case "delete":
      deletePaper(paper);
      break;
    default:
      break;
  }
};

// 获取状态标签类型
const getStatusType = (status: number) => {
  return status === 1 ? "success" : "info";
};

// 获取状态文本
const getStatusText = (status: number) => {
  return status === 1 ? "已发布" : "草稿";
};

// 分页变化
const handlePageChange = () => {
  if (isUsingNativeDemoData.value) {
    applyNativePaperList();
    return;
  }
  loadData();
};

onMounted(() => {
  loadStatistics();
  loadData();
  fetchFolders();
});
</script>

<template>
  <div class="my-papers-page" :class="{ 'is-dark': isDark }">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-icon">
          <IconifyIconOnline icon="ri:folder-2-line" />
        </div>
        <div class="header-info">
          <h1 class="page-title">我的试卷</h1>
          <p class="page-desc">
            管理您创建的所有试卷，支持编辑、发布和删除操作
          </p>
        </div>
      </div>
      <div class="header-actions">
        <el-button size="large" class="action-btn" @click="openNewFolderDialog">
          <el-icon class="mr-1"><FolderAdd /></el-icon>
          新建文件夹
        </el-button>
        <el-button
          type="primary"
          size="large"
          class="action-btn create-btn"
          @click="createPaper"
        >
          <el-icon class="mr-2"><Plus /></el-icon>
          新建试卷
        </el-button>
      </div>
    </div>

    <!-- 统计概览 -->
    <div class="stats-section">
      <div v-for="item in statCards" :key="item.label" class="stat-card">
        <div
          class="stat-icon"
          :class="{
            published: item.label === '已发布',
            draft: item.label === '草稿箱',
            recent: item.label === '最近编辑'
          }"
        >
          <component :is="item.icon" />
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ item.value }}</div>
          <div class="stat-label">{{ item.label }}</div>
        </div>
      </div>
    </div>

    <!-- 主内容区域：左侧文件夹 + 右侧列表 -->
    <div class="papers-layout">
      <!-- 左侧文件夹侧边栏 -->
      <div class="folder-sidebar">
        <div class="folder-header">
          <span class="folder-title">文件夹</span>
        </div>
        <div class="folder-tree">
          <div
            v-for="folder in folderTreeData"
            :key="folder.id"
            class="folder-item"
            :class="{
              active:
                selectedFolderId === (folder.id === 0 ? null : folder.id) ||
                (folder.id === 0 && selectedFolderId === null)
            }"
            @click="selectFolder(folder.id)"
          >
            <el-icon><Folder /></el-icon>
            <span class="folder-name">{{ folder.name }}</span>
            <span class="folder-count">{{ folder.paperCount || 0 }}</span>
            <div v-if="folder.id !== 0" class="folder-actions" @click.stop>
              <el-button
                link
                size="small"
                @click="openEditFolderDialog(folder as PaperFolder)"
              >
                <el-icon><Edit /></el-icon>
              </el-button>
              <el-button
                link
                size="small"
                type="danger"
                @click="handleDeleteFolder(folder as PaperFolder)"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧内容区域 -->
      <div class="content-area">
        <!-- 工具栏 -->
        <div class="toolbar-card">
          <div class="toolbar">
            <div class="toolbar-left">
              <el-input
                v-model="searchForm.keyword"
                placeholder="搜索试卷标题..."
                :style="{ width: isMobile ? '100%' : '240px' }"
                :prefix-icon="Search"
                clearable
                @keyup.enter="handleSearch"
                @clear="handleSearch"
              />
              <el-select
                v-model="searchForm.status"
                placeholder="试卷状态"
                :style="{ width: isMobile ? '100%' : '120px' }"
                clearable
                @change="handleSearch"
              >
                <el-option label="草稿" value="0" />
                <el-option label="已发布" value="1" />
              </el-select>
              <el-select
                v-model="searchForm.courseId"
                placeholder="所属课程"
                :style="{ width: isMobile ? '100%' : '150px' }"
                clearable
                @change="handleSearch"
              >
                <el-option
                  v-for="course in courseList"
                  :key="course.id"
                  :label="course.name"
                  :value="course.id"
                />
              </el-select>
            </div>
            <div class="toolbar-right">
              <el-button @click="loadData">
                <el-icon class="mr-1"><Refresh /></el-icon>
                刷新
              </el-button>
            </div>
          </div>
        </div>

        <!-- 试卷列表 -->
        <div class="list-card">
          <template v-if="isMobile">
            <div v-loading="loading" class="paper-mobile-list">
              <div
                v-for="row in paperList"
                :key="row.paperId"
                class="paper-mobile-card"
              >
                <div class="mobile-card-head">
                  <div class="paper-title-cell">
                    <div class="paper-icon">
                      <IconDocument />
                    </div>
                    <div class="paper-info">
                      <el-link type="primary" @click="editPaper(row)">
                        {{ row.title }}
                      </el-link>
                      <span class="paper-course">{{ row.courseName }}</span>
                    </div>
                  </div>
                  <el-tag
                    :type="getStatusType(row.status)"
                    size="small"
                    effect="light"
                  >
                    {{ getStatusText(row.status) }}
                  </el-tag>
                </div>

                <div class="mobile-meta-grid">
                  <div class="mobile-meta-item">
                    <span class="meta-label">题目数</span>
                    <span class="count-badge"
                      >{{ getPaperQuestionCount(row) }}题</span
                    >
                  </div>
                  <div class="mobile-meta-item">
                    <span class="meta-label">总分</span>
                    <span class="score-badge">{{ row.totalPoints }}分</span>
                  </div>
                  <div class="mobile-meta-item">
                    <span class="meta-label">发布次数</span>
                    <span class="usage-badge"
                      >{{ getPaperPublishCount(row) }}次</span
                    >
                  </div>
                  <div class="mobile-meta-item">
                    <span class="meta-label">更新时间</span>
                    <span class="meta-value">{{
                      getPaperUpdateTime(row)
                    }}</span>
                  </div>
                </div>

                <div class="mobile-action-grid">
                  <el-button
                    size="small"
                    type="primary"
                    @click="editPaper(row)"
                  >
                    <el-icon class="mr-1"><Edit /></el-icon>
                    编辑
                  </el-button>
                  <el-button size="small" @click="publishPaper(row)">
                    <el-icon class="mr-1"><Upload /></el-icon>
                    发布
                  </el-button>
                  <el-dropdown
                    trigger="click"
                    @command="
                      command => handleMobileAction(command as string, row)
                    "
                  >
                    <el-button size="small">
                      <el-icon class="mr-1"><MoreFilled /></el-icon>
                      更多
                    </el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="move">
                          <el-icon><FolderOpened /></el-icon>
                          移动
                        </el-dropdown-item>
                        <el-dropdown-item command="copy">
                          <el-icon><CopyDocument /></el-icon>
                          复制
                        </el-dropdown-item>
                        <el-dropdown-item command="delete">
                          <el-icon><Delete /></el-icon>
                          删除
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </div>

              <el-empty
                v-if="!loading && paperList.length === 0"
                description="暂无试卷数据"
                class="mobile-empty"
              />
            </div>
          </template>

          <el-table
            v-else
            v-loading="loading"
            :data="paperList"
            class="paper-table"
            style="width: 100%"
          >
            <el-table-column prop="title" label="试卷标题" min-width="240">
              <template #default="{ row }">
                <div class="paper-title-cell">
                  <div class="paper-icon">
                    <IconDocument />
                  </div>
                  <div class="paper-info">
                    <el-link type="primary" @click="editPaper(row)">
                      {{ row.title }}
                    </el-link>
                    <span class="paper-course">{{ row.courseName }}</span>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column
              prop="questionCount"
              label="题目数"
              width="100"
              align="center"
            >
              <template #default="{ row }">
                <span class="count-badge"
                  >{{ getPaperQuestionCount(row) }}题</span
                >
              </template>
            </el-table-column>
            <el-table-column
              prop="totalPoints"
              label="总分"
              width="100"
              align="center"
            >
              <template #default="{ row }">
                <span class="score-badge">{{ row.totalPoints }}分</span>
              </template>
            </el-table-column>
            <el-table-column
              prop="status"
              label="状态"
              width="100"
              align="center"
            >
              <template #default="{ row }">
                <el-tag
                  :type="getStatusType(row.status)"
                  size="small"
                  effect="light"
                >
                  {{ getStatusText(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              prop="publishCount"
              label="发布次数"
              width="100"
              align="center"
            >
              <template #default="{ row }">
                <span class="usage-badge"
                  >{{ getPaperPublishCount(row) }}次</span
                >
              </template>
            </el-table-column>
            <el-table-column
              prop="updateTime"
              label="更新时间"
              width="160"
              align="center"
            >
              <template #default="{ row }">
                {{ getPaperUpdateTime(row) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="260" fixed="right">
              <template #default="{ row }">
                <el-button
                  type="primary"
                  link
                  size="small"
                  @click="editPaper(row)"
                >
                  <el-icon class="mr-1"><Edit /></el-icon>
                  编辑
                </el-button>
                <el-button
                  type="primary"
                  link
                  size="small"
                  @click="publishPaper(row)"
                >
                  <el-icon class="mr-1"><Upload /></el-icon>
                  发布
                </el-button>
                <el-button
                  type="info"
                  link
                  size="small"
                  @click="openMoveDialog([row.paperId])"
                >
                  <el-icon class="mr-1"><FolderOpened /></el-icon>
                  移动
                </el-button>
                <el-button
                  type="warning"
                  link
                  size="small"
                  @click="copyPaper(row)"
                >
                  <el-icon class="mr-1"><CopyDocument /></el-icon>
                  复制
                </el-button>
                <el-button
                  type="danger"
                  link
                  size="small"
                  @click="deletePaper(row)"
                >
                  <el-icon class="mr-1"><Delete /></el-icon>
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <!-- 分页 -->
          <div class="pagination-wrapper">
            <el-pagination
              v-model:current-page="pagination.page"
              v-model:page-size="pagination.pageSize"
              :total="pagination.total"
              :page-sizes="[10, 20, 50, 100]"
              :layout="paginationLayout"
              background
              @size-change="handlePageChange"
              @current-change="handlePageChange"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 文件夹编辑对话框 -->
    <el-dialog
      v-model="folderDialogVisible"
      :title="isNewFolder ? '新建文件夹' : '编辑文件夹'"
      width="400px"
    >
      <el-form label-width="80px">
        <el-form-item label="文件夹名">
          <el-input
            v-model="editingFolder.name"
            placeholder="请输入文件夹名称"
            maxlength="20"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="folderDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveFolder">确定</el-button>
      </template>
    </el-dialog>

    <!-- 移动到文件夹对话框 -->
    <el-dialog v-model="moveDialogVisible" title="移动到文件夹" width="400px">
      <el-form label-width="80px">
        <el-form-item label="目标文件夹">
          <el-select
            v-model="targetFolderId"
            placeholder="请选择文件夹"
            style="width: 100%"
          >
            <el-option
              v-for="folder in folderList"
              :key="folder.id"
              :label="folder.name"
              :value="folder.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="moveDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleMoveToFolder">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
$light-bg: var(--el-bg-color-page);
$light-card-bg: var(--el-bg-color);
$light-text-primary: var(--el-text-color-primary);
$light-text-secondary: var(--el-text-color-regular);
$light-border: var(--el-border-color-lighter);
$light-shadow:
  0 4px 6px -1px rgb(0 0 0 / 10%),
  0 2px 4px -2px rgb(0 0 0 / 10%);

$dark-bg: var(--el-bg-color-page);
$dark-card-bg: var(--el-bg-color);
$dark-text-primary: var(--el-text-color-primary);
$dark-text-secondary: var(--el-text-color-regular);
$dark-border: var(--el-border-color-lighter);
$dark-shadow:
  0 4px 6px -1px rgb(0 0 0 / 30%),
  0 2px 4px -2px rgb(0 0 0 / 30%);

$primary-gradient: linear-gradient(135deg, #4a7fc8 0%, #739cf9 100%);
$success-gradient: linear-gradient(135deg, #739cf9 0%, #80c8fa 100%);
$warning-gradient: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
$danger-gradient: linear-gradient(135deg, #ef4444 0%, #f87171 100%);
$info-gradient: linear-gradient(135deg, #475569 0%, #64748b 100%);

$radius-md: 12px;
$radius-lg: 16px;

.my-papers-page {
  box-sizing: border-box;
  min-height: 100%;
  padding: 24px;
  overflow-x: hidden;

  &.is-dark {
    .page-header,
    .stat-card,
    .toolbar-card,
    .list-card,
    .folder-sidebar {
      background: $dark-card-bg;
      border-color: $dark-border;
      box-shadow: $dark-shadow;
    }

    .page-header {
      .page-title {
        color: $dark-text-primary;
      }

      .page-desc {
        color: $dark-text-secondary;
      }
    }

    .stat-card {
      .stat-info {
        .stat-value {
          color: $dark-text-primary;
        }

        .stat-label {
          color: $dark-text-secondary;
        }
      }
    }

    .folder-sidebar {
      .folder-header {
        border-bottom-color: $dark-border;

        .folder-title {
          color: $dark-text-primary;
        }
      }

      .folder-item {
        color: $dark-text-secondary;

        &:hover {
          background: rgba(74, 127, 200, 0.18);
        }

        &.active {
          background: rgba(74, 127, 200, 0.28);
          color: #80c8fa;
        }

        .folder-name {
          color: inherit;
        }

        .folder-count {
          background: rgba(255, 255, 255, 0.05);
          color: $dark-text-secondary;
        }

        &.active .folder-count {
          background: #80c8fa;
          color: #fff;
        }
      }
    }

    .list-card {
      .paper-mobile-card {
        background: rgba(15, 23, 42, 0.68);
        border-color: $dark-border;
        box-shadow: $dark-shadow;
      }

      .meta-label {
        color: $dark-text-secondary;
      }

      .meta-value {
        color: $dark-text-primary;
      }

      .mobile-meta-item {
        .count-badge,
        .score-badge,
        .usage-badge {
          color: $dark-text-primary;
        }
      }

      .paper-title-cell {
        .paper-icon {
          background: rgba(74, 127, 200, 0.2);
          color: #80c8fa;
        }

        .paper-course {
          color: $dark-text-secondary;
        }
      }

      .count-badge,
      .score-badge,
      .usage-badge {
        background: rgba(255, 255, 255, 0.05);
        color: $dark-text-primary;
      }

      .pagination-wrapper {
        border-top-color: $dark-border;
      }

      :deep(.el-table) {
        background-color: transparent;
        --el-table-bg-color: transparent;
        --el-table-tr-bg-color: transparent;
        --el-table-header-bg-color: rgba(255, 255, 255, 0.05);
        --el-table-row-hover-bg-color: rgba(255, 255, 255, 0.03);
        --el-table-border-color: rgba(255, 255, 255, 0.1);
        color: $dark-text-primary;
      }

      :deep(.el-table__header th) {
        background-color: rgba(255, 255, 255, 0.05);
        color: $dark-text-primary;
        border-bottom-color: $dark-border;
      }

      :deep(.el-table__body tr) {
        &:hover > td {
          background-color: rgba(255, 255, 255, 0.03);
        }
      }

      :deep(.el-table td),
      :deep(.el-table th.is-leaf) {
        border-bottom-color: $dark-border;
      }
    }
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    min-height: 104px;
    padding: 24px;
    background: $light-card-bg;
    border-radius: $radius-lg;
    box-shadow: $light-shadow;
    margin-bottom: 24px;
    border: 1px solid $light-border;

    .header-content {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-icon {
      width: 56px;
      height: 56px;
      border-radius: $radius-md;
      background: $primary-gradient;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 6px 16px rgb(74 127 200 / 30%);

      :deep(> svg) {
        width: 28px;
        height: 28px;
        color: #fff;
        display: block;
      }
    }

    .page-title {
      font-size: 24px;
      font-weight: 700;
      color: $light-text-primary;
      margin: 0 0 4px;
    }

    .page-desc {
      font-size: 14px;
      color: $light-text-secondary;
      margin: 0;
    }

    .header-actions {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      justify-content: flex-end;

      :deep(.el-button + .el-button) {
        margin-left: 0;
      }
    }

    :deep(.el-button.action-btn) {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 48px;
      height: 48px;
      padding: 0 24px !important;
      border-radius: $radius-md;
      font-weight: 600;
      font-size: 15px;
      line-height: 1 !important;
      white-space: nowrap;

      .el-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
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

  .stats-section {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    margin: 0 0 24px 0;
    width: 100%;
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 24px;
    background: $light-card-bg;
    border-radius: $radius-lg;
    box-shadow: $light-shadow;
    border: 1px solid $light-border;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-4px);
    }

    .stat-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: $radius-md;
      background: $primary-gradient;
      color: #fff;
      flex-shrink: 0;

      &.published {
        background: $success-gradient;
      }
      &.draft {
        background: $warning-gradient;
      }
      &.recent {
        background: $info-gradient;
      }

      :deep(> svg) {
        width: 26px;
        height: 26px;
        color: #fff;
        display: block;
      }
    }

    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: $light-text-primary;
    }

    .stat-label {
      font-size: 14px;
      color: $light-text-secondary;
    }
  }

  .papers-layout {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    width: 100%;
    margin: 0;
    align-items: start;
  }

  .folder-sidebar {
    grid-column: span 1;
    background: $light-card-bg;
    border-radius: $radius-lg;
    box-shadow: $light-shadow;
    border: 1px solid $light-border;
    padding: 24px;

    .folder-header {
      padding-bottom: 12px;
      border-bottom: 1px solid $light-border;
      margin-bottom: 12px;

      .folder-title {
        font-weight: 600;
        color: $light-text-primary;
      }
    }

    .folder-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: rgba(74, 127, 200, 0.08);
      }

      &.active {
        background: rgba(74, 127, 200, 0.14);
        color: #4a7fc8;
      }

      &.child {
        padding-left: 32px;
      }

      .folder-name {
        flex: 1;
        font-size: 14px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .folder-count {
        font-size: 12px;
        color: $light-text-secondary;
        background: #f1f5f9;
        padding: 2px 8px;
        border-radius: 10px;
      }

      &.active .folder-count {
        background: #4a7fc8;
        color: #fff;
      }

      .folder-actions {
        display: none;
      }

      &:hover .folder-actions {
        display: flex;
      }
    }
  }

  .content-area {
    grid-column: span 3;
    min-width: 0;
  }

  .toolbar-card {
    padding: 24px;
    background: $light-card-bg;
    border-radius: $radius-lg;
    box-shadow: $light-shadow;
    border: 1px solid $light-border;
    margin-bottom: 20px;

    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }

    .toolbar-left,
    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }
  }

  .list-card {
    background: $light-card-bg;
    border-radius: $radius-lg;
    box-shadow: $light-shadow;
    border: 1px solid $light-border;
    overflow: hidden;

    .paper-title-cell {
      display: flex;
      gap: 12px;
      align-items: center;

      .paper-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        color: #4a7fc8;
        background: linear-gradient(135deg, #ebf2fd 0%, #ebf2fd 100%);
        border-radius: 8px;

        :deep(svg) {
          width: 22px;
          height: 22px;
        }
      }

      .paper-info {
        display: flex;
        flex-direction: column;
        gap: 2px;

        .paper-course {
          font-size: 12px;
          color: $light-text-secondary;
        }
      }
    }

    .count-badge,
    .score-badge,
    .usage-badge {
      display: inline-block;
      padding: 4px 10px;
      font-size: 13px;
      font-weight: 500;
      color: $light-text-secondary;
      background: #f1f5f9;
      border-radius: 6px;
    }

    .paper-mobile-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px;
    }

    .paper-mobile-card {
      padding: 16px;
      border: 1px solid $light-border;
      border-radius: 14px;
      background: linear-gradient(180deg, rgb(255 255 255 / 96%), #fff);
      box-shadow: 0 10px 24px rgb(15 23 42 / 6%);
    }

    .mobile-card-head {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 14px;
    }

    .mobile-meta-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 14px;
    }

    .mobile-meta-item {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;

      .count-badge,
      .score-badge,
      .usage-badge,
      .meta-value {
        display: inline-flex;
        align-items: center;
        min-height: 20px;
        padding: 0;
        font-size: 14px;
        font-weight: 600;
        line-height: 1.5;
        color: $light-text-primary;
        background: transparent;
        border-radius: 0;
      }
    }

    .meta-label {
      font-size: 12px;
      color: $light-text-secondary;
    }

    .meta-value {
      font-size: 13px;
      line-height: 1.5;
      color: $light-text-primary;
      word-break: break-word;
    }

    .mobile-action-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;

      > * {
        flex: 1 1 calc(33.333% - 6px);
        min-width: 0;
      }

      .el-button {
        width: 100%;
        margin-left: 0;
      }

      :deep(.el-dropdown) {
        display: block;
        width: 100%;
      }
    }

    .mobile-empty {
      padding: 12px 0 0;
    }

    .pagination-wrapper {
      padding: 24px;
      display: flex;
      justify-content: flex-end;
      border-top: 1px solid $light-border;
    }
  }

  @media screen and (max-width: 1024px) {
    .stats-section {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .papers-layout {
      grid-template-columns: 1fr;
    }

    .folder-sidebar,
    .content-area {
      grid-column: auto;
    }
  }

  @media screen and (max-width: 768px) {
    padding: 12px calc(16px + env(safe-area-inset-right, 0px)) 20px 12px;

    .page-header {
      flex-direction: column;
      align-items: stretch;
      padding: 18px;
      gap: 16px;

      .header-content {
        align-items: flex-start;
      }

      .header-icon {
        width: 48px;
        height: 48px;

        :deep(svg) {
          width: 24px;
          height: 24px;
        }
      }

      .page-title {
        font-size: 20px;
      }

      .page-desc {
        font-size: 13px;
        line-height: 1.6;
      }

      .header-actions {
        justify-content: stretch;

        .el-button,
        .create-btn {
          flex: 1;
          min-width: 0;
        }
      }

      :deep(.el-button.create-btn) {
        min-height: 42px;
        height: 42px;
        padding: 0 16px !important;
        font-size: 14px;
      }
    }

    .stats-section {
      gap: 12px;
      margin-bottom: 16px;
    }

    .stat-card {
      gap: 12px;
      padding: 16px;

      .stat-icon {
        width: 42px;
        height: 42px;

        :deep(svg) {
          width: 22px;
          height: 22px;
        }
      }

      .stat-value {
        font-size: 22px;
      }

      .stat-label {
        font-size: 12px;
      }
    }

    .papers-layout {
      gap: 16px;
    }

    .folder-sidebar,
    .toolbar-card {
      padding: 16px;
    }

    .folder-sidebar {
      .folder-header {
        padding-bottom: 10px;
        margin-bottom: 10px;
      }

      .folder-tree {
        display: flex;
        gap: 10px;
        overflow-x: auto;
        padding-right: 12px;
        padding-bottom: 4px;
        scrollbar-width: none;

        &::-webkit-scrollbar {
          display: none;
        }
      }

      .folder-item {
        flex: 0 0 auto;
        min-width: 120px;
      }
    }

    .toolbar-card {
      margin-bottom: 16px;

      .toolbar,
      .toolbar-left,
      .toolbar-right {
        width: 100%;
      }

      .toolbar-left {
        flex-direction: column;
        align-items: stretch;
      }

      .toolbar-right {
        justify-content: stretch;

        .el-button {
          width: 100%;
          margin-left: 0;
        }
      }

      :deep(.el-input__wrapper),
      :deep(.el-select__wrapper) {
        min-height: 42px;
        border-radius: 12px;
      }
    }

    .list-card {
      .paper-title-cell {
        align-items: flex-start;

        .paper-icon {
          width: 40px;
          height: 40px;
        }

        .paper-info {
          min-width: 0;
        }
      }

      .pagination-wrapper {
        padding: 16px;
        justify-content: center;

        :deep(.el-pagination) {
          justify-content: center;
          row-gap: 8px;
        }
      }
    }
  }

  @media screen and (max-width: 520px) {
    .stats-section {
      grid-template-columns: 1fr;
    }

    .page-header {
      .header-actions {
        flex-direction: column;

        .el-button,
        .create-btn {
          width: 100%;
        }
      }
    }

    .folder-sidebar {
      .folder-tree {
        flex-wrap: wrap;
        gap: 8px;
        overflow: visible;
        padding-right: 12px;
        padding-bottom: 0;
      }

      .folder-item {
        flex: 1 1 calc(50% - 4px);
        min-width: 0;
        padding: 12px 10px;
        align-items: flex-start;
        flex-wrap: wrap;
      }

      .folder-name {
        min-width: 0;
        white-space: normal;
        line-height: 1.35;
        word-break: break-word;
      }

      .folder-count {
        margin-left: auto;
      }

      .folder-item .folder-actions {
        display: none;
        width: 100%;
        justify-content: flex-end;
        margin-top: 4px;
      }

      .folder-item.active .folder-actions {
        display: flex;
      }
    }

    .list-card {
      .paper-mobile-list {
        padding: 12px;
      }

      .paper-mobile-card {
        padding: 14px;
      }

      .mobile-card-head {
        flex-direction: column;
        align-items: stretch;
      }

      .mobile-meta-grid {
        grid-template-columns: 1fr;
      }

      .mobile-action-grid {
        gap: 10px;

        .el-button {
          flex: 1 1 calc(50% - 4px);
          min-width: 0;
        }
      }
    }
  }
}
</style>
