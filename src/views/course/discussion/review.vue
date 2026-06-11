<script setup lang="ts">
/**
 * 教师端- 课程讨论管理
 *教师可以管理所授课程的讨论内容，包括审核、置顶、删除等操作
 */
import { computed, ref, reactive, onMounted, onActivated, watch } from "vue";
import { useRoute } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { usePageResponsive } from "@/utils/pageResponsive";
import {
  Search,
  Refresh,
  Check,
  Close,
  Delete,
  Edit,
  Clock,
  Top,
  MoreFilled
} from "@element-plus/icons-vue";
import {
  getAdminDiscussionDetail,
  getPendingList,
  getPendingStatistics,
  getUserAvatars,
  mapPendingItemToReviewQueueItem,
  reviewPost,
  reviewReply,
  pinPost,
  unpinPost,
  forceDeletePost,
  forceDeleteReply,
  type PendingItem,
  type ReviewQueueItem
} from "@/api/discussion-admin";
import { updateReply, updateDiscussion } from "@/api/discussion";
import HeartIcon from "@/assets/commentareasrelatedsvgs/heart-svgrepo-com.svg?component";
import CommentIcon from "@/assets/commentareasrelatedsvgs/comment-lines-svgrepo-com.svg?component";
import InfoIcon from "@/assets/commentareasrelatedsvgs/information-circle-svgrepo-com.svg?component";
import { formatAvatar } from "@/utils/avatar";

defineOptions({
  name: "TeacherDiscussionManage"
});

const { isMobile, paginationLayout, getDialogWidth } = usePageResponsive();

// 标签类型
type TagType = "danger" | "warning" | "info" | "success" | "primary";

// 状态
const loading = ref(false);
const discussions = ref<ReviewQueueItem[]>([]);
const selectedIds = ref<string[]>([]);
const detailDialogVisible = ref(false);
const currentDetail = ref<ReviewQueueItem | null>(null);
const selectedCount = computed(() => selectedIds.value.length);

// 统计数据
const stats = ref({
  totalPosts: 0,
  totalReplies: 0,
  pendingPosts: 0,
  pendingReplies: 0,
  pendingTotal: 0,
  todayPosts: 0,
  courses: [] as Array<{
    courseId: string;
    courseName: string;
    pendingPosts: number;
    pendingReplies: number;
    pendingTotal: number;
  }>
});

// 搜索表单
const searchForm = reactive({
  courseId: "",
  type: "all" as "all" | "post" | "reply" // 类型筛选：全部/帖子/回复
});

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
});

// 类型选项（帖子/回复）
const typeOptions = [
  { label: "全部", value: "all" },
  { label: "帖子", value: "post" },
  { label: "回复", value: "reply" }
];
const activeFilterCount = computed(() => {
  let count = 0;

  if (searchForm.courseId) count += 1;
  if (searchForm.type !== "all") count += 1;

  return count;
});
const filterBadgeText = computed(() =>
  activeFilterCount.value > 0
    ? `已启用 ${activeFilterCount.value} 项筛选`
    : "当前展示全部内容"
);
const listSummaryText = computed(() => {
  if (loading.value && pagination.total === 0) {
    return "正在同步讨论内容...";
  }

  if (pagination.total === 0) {
    return "暂无匹配内容";
  }

  if (selectedCount.value > 0) {
    return `共 ${pagination.total} 条内容，已选择 ${selectedCount.value} 条`;
  }

  return `共 ${pagination.total} 条内容，可继续筛选或批量处理`;
});

// 状态标签样式
const statusTagType = (status: string): TagType => {
  const map: Record<string, TagType> = {
    pending: "warning",
    approved: "success",
    rejected: "danger",
    auto_approved: "success"
  };
  return map[status] || "info";
};

// 状态显示文本
const statusText = (status: string): string => {
  const map: Record<string, string> = {
    pending: "待审核",
    approved: "已通过",
    rejected: "已拒绝",
    auto_approved: "自动通过"
  };
  return map[status] || status;
};

// 风险等级标签
const riskLevelType = (level: string): TagType => {
  const map: Record<string, TagType> = {
    low: "success",
    medium: "warning",
    high: "danger",
    critical: "danger"
  };
  return map[level] || "info";
};

const riskLevelText = (level: string): string => {
  const map: Record<string, string> = {
    low: "低风险",
    medium: "中风险",
    high: "高风险",
    critical: "严重"
  };
  return map[level] || level;
};

// 加载待审核列表
const fetchData = async () => {
  if (loading.value && discussions.value.length === 0) return;
  loading.value = true;
  try {
    const responseData = await getPendingList({
      courseId: searchForm.courseId || undefined,
      type: searchForm.type,
      pageNum: pagination.page,
      pageSize: pagination.pageSize
    });
    const userIds = Array.from(
      new Set(
        (responseData.list || []).map((item: PendingItem) => item.authorId)
      )
    );
    let avatarMap = new Map<number, string>();
    if (userIds.length > 0) {
      avatarMap = await getUserAvatars(userIds);
    }
    discussions.value = (responseData.list || []).map((item: PendingItem) =>
      mapPendingItemToReviewQueueItem(item, avatarMap.get(item.authorId))
    );
    pagination.total = responseData.total || 0;
  } catch (error) {
    console.error("加载讨论列表失败", error);
    discussions.value = [];
    pagination.total = 0;
  } finally {
    loading.value = false;
  }
};

// 加载统计数据
const fetchStats = async () => {
  try {
    const statsData = await getPendingStatistics({
      courseId: searchForm.courseId || undefined
    });

    if (statsData) {
      stats.value.totalPosts = Number(statsData.totalPosts || 0);
      stats.value.totalReplies = Number(statsData.totalReplies || 0);
      stats.value.pendingPosts = Number(statsData.pendingPosts || 0);
      stats.value.pendingReplies = Number(statsData.pendingReplies || 0);
      stats.value.pendingTotal = Number(statsData.pendingTotal || 0);
      stats.value.todayPosts = Number(statsData.todayPosts || 0);
      stats.value.courses = Array.isArray(statsData.courses)
        ? statsData.courses.map(course => ({
            courseId: String(course.courseId),
            courseName: course.courseName,
            pendingPosts: Number(course.pendingPosts || 0),
            pendingReplies: Number(course.pendingReplies || 0),
            pendingTotal: Number(course.pendingTotal || 0)
          }))
        : [];
    }
  } catch (error) {
    console.error("加载待审核统计失败", error);
  }
};

//搜索
const handleSearch = async () => {
  pagination.page = 1;
  selectedIds.value = [];
  await fetchStats();
  await fetchData();
};

// 选择变化
const handleSelectionChange = (rows: ReviewQueueItem[]) => {
  selectedIds.value = rows.map(r => r.id);
};

const isSelected = (id: string) => selectedIds.value.includes(id);

const toggleMobileSelection = (id: string, checked: boolean) => {
  if (checked) {
    if (!selectedIds.value.includes(id)) {
      selectedIds.value.push(id);
    }
    return;
  }
  selectedIds.value = selectedIds.value.filter(item => item !== id);
};

// 重置搜索
const resetSearch = () => {
  searchForm.courseId = "";
  searchForm.type = "all";
  handleSearch();
};

// 分页变化
const handlePageChange = (page: number) => {
  pagination.page = page;
  selectedIds.value = [];
  fetchData();
};

const handleSizeChange = (size: number) => {
  pagination.pageSize = size;
  pagination.page = 1;
  selectedIds.value = [];
  fetchData();
};

// 查看详情
const viewDetail = async (row: ReviewQueueItem) => {
  try {
    // 调用详情接口获取完整信息
    const res = await getAdminDiscussionDetail(row.id);
    if (res && res.data) {
      // 转换为 ReviewQueueItem 格式
      currentDetail.value = {
        ...res.data,
        riskLevel: row.riskLevel || "low",
        matchedWords: (res.data as any).matchedWords || [],
        priority: row.priority || "medium",
        itemType: (res.data as any).type || row.itemType,
        courseName: res.data.courseName
      } as ReviewQueueItem;
    } else {
      // 如果获取详情失败，使用列表中的数据
      currentDetail.value = row;
    }
    detailDialogVisible.value = true;
  } catch (error) {
    console.error("获取讨论详情失败:", error);
    // 出错时使用列表中的数据
    currentDetail.value = row;
    detailDialogVisible.value = true;
  }
};

// 审核通过
const handleApprove = async (row: ReviewQueueItem) => {
  try {
    if (row.itemType === "reply") {
      await reviewReply(row.id, { action: "approve" });
    } else {
      await reviewPost(row.id, { action: "approve" });
    }
    ElMessage.success("审核通过");

    // 本地立即移除或更新状态，增强即时感
    const idx = discussions.value.findIndex(d => d.id === row.id);
    if (idx > -1) {
      discussions.value.splice(idx, 1);
      pagination.total = Math.max(0, pagination.total - 1);
    }

    // 延迟刷新以确保后端数据同步
    setTimeout(() => initData(true), 1000);
  } catch (error) {
    ElMessage.error("操作失败");
  }
};

// 审核拒绝
const handleReject = async (row: ReviewQueueItem) => {
  try {
    const { value } = await ElMessageBox.prompt("请输入拒绝原因", "拒绝审核", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      inputPlaceholder: "请输入拒绝原因（选填）",
      customClass: "custom-message-box",
      draggable: true
    });
    if (row.itemType === "reply") {
      await reviewReply(row.id, { action: "reject", note: value });
    } else {
      await reviewPost(row.id, { action: "reject", note: value });
    }
    ElMessage.success("已拒绝");

    // 本地立即移除或更新状态
    const idx = discussions.value.findIndex(d => d.id === row.id);
    if (idx > -1) {
      discussions.value.splice(idx, 1);
      pagination.total = Math.max(0, pagination.total - 1);
    }

    // 延迟刷新以确保后端数据同步
    setTimeout(() => initData(true), 1000);
  } catch (error: any) {
    if (error !== "cancel") {
      ElMessage.error("操作失败");
    }
  }
};

// 批量审核通过
const handleBatchApprove = async () => {
  if (selectedIds.value.length === 0) {
    ElMessage.warning("请先勾选需要审核的内容");
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确定要批量通过选中的 ${selectedIds.value.length} 条内容吗？`,
      "批量通过确认",
      {
        confirmButtonText: "确定通过",
        cancelButtonText: "取消",
        type: "success",
        customClass: "custom-message-box",
        draggable: true
      }
    );

    loading.value = true;
    let successCount = 0;
    let failedCount = 0;

    const idsToProcess = [...selectedIds.value];

    for (const id of idsToProcess) {
      const item = discussions.value.find(i => i.id === id);
      try {
        if (item?.itemType === "reply") {
          await reviewReply(id, { action: "approve" });
        } else {
          await reviewPost(id, { action: "approve" });
        }
        successCount++;
        // 本地移除
        const idx = discussions.value.findIndex(i => i.id === id);
        if (idx > -1) discussions.value.splice(idx, 1);
      } catch (err) {
        console.error(`ID ${id} 审核失败:`, err);
        failedCount++;
      }
    }

    if (failedCount === 0) {
      ElMessage.success(`操作成功：已全部通过 ${successCount} 条内容`);
    } else {
      ElMessage.warning(
        `批量操作完成：成功 ${successCount} 条，失败 ${failedCount} 条`
      );
    }

    selectedIds.value = [];
    // 延迟同步数据，解决后端同步延迟问题
    setTimeout(() => initData(true), 1000);
  } catch (error: any) {
    if (error !== "cancel") {
      ElMessage.error("批量操作过程中产生错误");
    }
  } finally {
    loading.value = false;
  }
};

// 批量审核拒绝
const handleBatchReject = async () => {
  if (selectedIds.value.length === 0) {
    ElMessage.warning("请先勾选需要拒绝的内容");
    return;
  }
  try {
    const { value } = await ElMessageBox.prompt(
      `确定要批量拒绝选中的 ${selectedIds.value.length} 条内容吗？`,
      "批量驳回确认",
      {
        confirmButtonText: "确定拒绝",
        cancelButtonText: "取消",
        inputPlaceholder: "请输入统一的拒绝原因（选填）",
        type: "warning",
        customClass: "custom-message-box",
        draggable: true
      }
    );

    loading.value = true;
    let successCount = 0;
    let failedCount = 0;

    const idsToProcess = [...selectedIds.value];

    for (const id of idsToProcess) {
      const item = discussions.value.find(i => i.id === id);
      try {
        if (item?.itemType === "reply") {
          await reviewReply(id, { action: "reject", note: value });
        } else {
          await reviewPost(id, { action: "reject", note: value });
        }
        successCount++;
        // 本地移除
        const idx = discussions.value.findIndex(i => i.id === id);
        if (idx > -1) discussions.value.splice(idx, 1);
      } catch (err) {
        console.error(`ID ${id} 拒绝失败:`, err);
        failedCount++;
      }
    }

    if (failedCount === 0) {
      ElMessage.success(`操作成功：已批量拒绝 ${successCount} 条内容`);
    } else {
      ElMessage.warning(
        `批量操作完成：成功 ${successCount} 条，失败 ${failedCount} 条`
      );
    }

    selectedIds.value = [];
    // 延迟同步数据，解决后端同步延迟问题
    setTimeout(() => initData(true), 1000);
  } catch (error: any) {
    if (error !== "cancel") {
      ElMessage.error("批量操作失败");
    }
  } finally {
    loading.value = false;
  }
};

// 编辑相关
const editDialogVisible = ref(false);
const editForm = reactive({
  id: "",
  type: "post" as "post" | "reply",
  content: "",
  title: ""
});

const handleEdit = (row: ReviewQueueItem) => {
  editForm.id = row.id;
  editForm.type = row.itemType || "post";
  editForm.content = row.content;
  editForm.title = row.title || "";
  editDialogVisible.value = true;
};

const submitEdit = async () => {
  if (!editForm.content.trim()) {
    ElMessage.warning("内容不能为空");
    return;
  }
  try {
    if (editForm.type === "reply") {
      await updateReply(editForm.id, { content: editForm.content });
    } else {
      await updateDiscussion(editForm.id, {
        title: editForm.title,
        content: editForm.content
      });
    }
    ElMessage.success("编辑成功");
    editDialogVisible.value = false;
    fetchData();
  } catch (error) {
    console.error("编辑失败:", error);
    ElMessage.error("编辑失败");
  }
};

const handleDelete = async (row: ReviewQueueItem) => {
  try {
    // 管理员删除，支持输入原因以供审计
    const result = await ElMessageBox.prompt(
      "确定要删除这条内容吗？此操作不可恢复。请输入删除理由（可选）：",
      "删除确认",
      {
        confirmButtonText: "确定删除",
        cancelButtonText: "取消",
        inputType: "text",
        inputPlaceholder: "输入删除理由...",
        type: "warning",
        draggable: true,
        customClass: "custom-message-box"
      }
    );

    loading.value = true;
    if (row.itemType === "reply") {
      await forceDeleteReply(row.id, result.value);
    } else {
      await forceDeletePost(row.id, result.value);
    }

    // 乐观更新：立即从当前列表中移除该项，不再等待 fetchData 刷新
    const idx = discussions.value.findIndex(i => i.id === row.id);
    if (idx > -1) {
      discussions.value.splice(idx, 1);
      pagination.total -= 1;
    }

    ElMessage.success("已强制删除并记录日志");
    // 延迟同步最新数据
    setTimeout(() => fetchData(), 500);
  } catch (error) {
    if (error !== "cancel") {
      console.error("删除失败:", error);
      ElMessage.error("删除失败");
    }
  } finally {
    loading.value = false;
  }
};

// 置顶逻辑
const handlePin = async (row: ReviewQueueItem) => {
  loading.value = true;
  try {
    await pinPost(row.id);
    // HTTP 200 OK 即为成功
    row.isPinned = true;
    ElMessage.success("成功设为置顶");
    // 不自动刷新列表，本地状态已更新，避免后端同步延迟导致状态被覆盖
  } catch (error) {
    console.error("置顶操作失败:", error);
    ElMessage.error("置顶操作失败");
  } finally {
    loading.value = false;
  }
};

// 取消置顶逻辑
const handleUnpin = async (row: ReviewQueueItem) => {
  loading.value = true;
  try {
    await unpinPost(row.id);
    // HTTP 200 OK 即为成功
    row.isPinned = false;
    ElMessage.success("已取消置顶");
    // 不自动刷新列表，本地状态已更新，避免后端同步延迟导致状态被覆盖
  } catch (error) {
    console.error("取消置顶操作失败:", error);
    ElMessage.error("取消置顶操作失败");
  } finally {
    loading.value = false;
  }
};

// 格式化时间
const formatTime = (dateStr: string) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

// 数据是否已加载的标志
const dataLoaded = ref(false);

// 初始化加载数据
const initData = async (force = false) => {
  if (loading.value || (dataLoaded.value && !force)) return;

  await fetchStats();
  await fetchData();
  dataLoaded.value = true;
};

const route = useRoute();

// 使用 onMounted 确保组件已挂载后再加载数据
onMounted(() => {
  // 使用 setTimeout 延迟加载，确保路由完全稳定
  setTimeout(() => {
    if (!dataLoaded.value) {
      initData();
    }
  }, 100);
});

// 当组件从 keep-alive 缓存中被激活时重新加载数据
onActivated(() => {
  dataLoaded.value = false; // 重置标志以允许重新加载
  initData();
});
</script>

<template>
  <div
    class="discussion-manage"
    :class="{ 'discussion-manage--mobile': isMobile }"
  >
    <!-- 统计卡片 -->
    <div class="discussion-stats-grid mb-6">
      <div class="discussion-stats-grid__item">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-number text-primary">{{ stats.totalPosts }}</div>
            <div class="stat-label">库内讨论总量</div>
          </div>
        </el-card>
      </div>
      <div class="discussion-stats-grid__item">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-number text-success">{{ stats.totalReplies }}</div>
            <div class="stat-label">学生互动回复</div>
          </div>
        </el-card>
      </div>
      <div class="discussion-stats-grid__item">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-number text-warning">
              {{ stats.pendingTotal }}
            </div>
            <div class="stat-label">当前待处理审查</div>
          </div>
        </el-card>
      </div>
      <div class="discussion-stats-grid__item">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-number text-info">{{ stats.todayPosts }}</div>
            <div class="stat-label">今日活跃动态</div>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 搜索栏 -->
    <el-card
      shadow="never"
      class="discussion-panel discussion-filter-panel mb-4"
    >
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
        <el-form-item label="归属课程">
          <el-select
            v-model="searchForm.courseId"
            placeholder="筛选对应课程"
            clearable
            style="width: 220px"
            @change="handleSearch"
          >
            <el-option
              v-for="course in stats.courses"
              :key="course.courseId"
              :label="course.courseName"
              :value="course.courseId"
            >
              <div class="flex justify-between items-center">
                <span>{{ course.courseName }}</span>
                <el-tag
                  v-if="course.pendingTotal > 0"
                  size="small"
                  type="warning"
                  effect="light"
                  round
                >
                  {{ course.pendingTotal }}
                </el-tag>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="内容类型">
          <el-select
            v-model="searchForm.type"
            placeholder="类型筛选"
            style="width: 120px"
            @change="handleSearch"
          >
            <el-option
              v-for="opt in typeOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">
            查询
          </el-button>
          <el-button :icon="Refresh" @click="resetSearch"> 重置 </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 数据表格 -->
    <el-card
      v-loading="loading"
      shadow="never"
      class="discussion-panel discussion-list-panel"
    >
      <div class="flex justify-between items-center mb-4">
        <span class="font-bold text-base">讨论列表</span>
        <div class="text-sm text-gray-500">{{ listSummaryText }}</div>
      </div>
      <div class="flex flex-wrap items-center justify-end gap-2 mb-4">
        <div v-if="selectedCount > 0" class="flex gap-2">
          <el-button type="success" :icon="Check" @click="handleBatchApprove">
            批量通过 ({{ selectedCount }})
          </el-button>
          <el-button type="danger" :icon="Close" @click="handleBatchReject">
            批量拒绝
          </el-button>
        </div>
        <el-button :icon="Refresh" text @click="initData(true)">
          同步状态
        </el-button>
      </div>
      <div v-if="isMobile" class="mobile-discussion-list">
        <div
          v-for="row in discussions"
          :key="row.id"
          class="mobile-discussion-card"
        >
          <div class="mobile-discussion-card__header">
            <div class="mobile-discussion-card__header-main">
              <el-checkbox
                :model-value="isSelected(row.id)"
                @change="value => toggleMobileSelection(row.id, Boolean(value))"
              />
              <span class="mobile-discussion-card__header-note">
                {{ isSelected(row.id) ? "已加入批量操作" : "加入批量操作" }}
              </span>
            </div>
            <div class="mobile-discussion-card__header-tags">
              <el-tag
                :type="row.itemType === 'reply' ? 'info' : 'primary'"
                effect="plain"
                size="small"
                round
              >
                {{ row.itemType === "reply" ? "回复" : "帖子" }}
              </el-tag>
              <el-tag :type="statusTagType(row.status)" effect="light" round>
                {{ statusText(row.status) }}
              </el-tag>
            </div>
          </div>

          <div class="post-content">
            <div class="post-header">
              <el-tag
                v-if="row.isPinned"
                size="small"
                type="warning"
                effect="dark"
                class="pin-tag"
              >
                精选置顶
              </el-tag>
              <span class="post-title">{{ row.title || "(无标题)" }}</span>
            </div>
            <div class="post-excerpt">
              {{ row.content.substring(0, 120)
              }}{{ row.content.length > 120 ? "..." : "" }}
            </div>
            <div class="post-meta">
              <div class="meta-item">
                <el-avatar :size="20" :src="formatAvatar(row.author?.avatar)" />
                <span class="meta-author">{{ row.author?.name }}</span>
              </div>
              <div class="meta-item">
                <span>{{ row.courseName || "未知课程" }}</span>
              </div>
              <div class="meta-item">
                <el-icon :size="16"><Clock /></el-icon>
                <span>{{ formatTime(row.createdAt) }}</span>
              </div>
            </div>
          </div>

          <div class="mobile-discussion-card__stats">
            <div class="stat-item">
              <el-icon :size="18"><HeartIcon /></el-icon>
              <span>{{ row.likeCount }}</span>
            </div>
            <div class="stat-item">
              <el-icon :size="18"><CommentIcon /></el-icon>
              <span>{{ row.replyCount }}</span>
            </div>
            <el-tag
              v-if="row.riskLevel"
              :type="riskLevelType(row.riskLevel)"
              effect="dark"
              size="small"
              round
            >
              {{ riskLevelText(row.riskLevel) }}
            </el-tag>
          </div>

          <div class="mobile-discussion-card__actions">
            <el-button plain @click="viewDetail(row)">详情</el-button>
            <el-button
              v-if="row.status === 'pending'"
              type="success"
              plain
              @click="handleApprove(row)"
            >
              通过
            </el-button>
            <el-button
              v-if="row.status === 'pending'"
              type="warning"
              plain
              @click="handleReject(row)"
            >
              拒绝
            </el-button>
            <el-dropdown
              trigger="click"
              popper-class="modern-dropdown"
              class="mobile-card-more"
            >
              <el-button plain>
                更多操作
                <el-icon class="ml-1"><MoreFilled /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item :icon="Edit" @click="handleEdit(row)">
                    编辑内容
                  </el-dropdown-item>
                  <el-dropdown-item
                    v-if="row.itemType === 'post' && !row.isPinned"
                    :icon="Top"
                    @click="handlePin(row)"
                  >
                    设为置顶
                  </el-dropdown-item>
                  <el-dropdown-item
                    v-if="row.itemType === 'post' && row.isPinned"
                    :icon="Top"
                    @click="handleUnpin(row)"
                  >
                    取消置顶
                  </el-dropdown-item>
                  <el-dropdown-item
                    :icon="Delete"
                    class="delete-item"
                    @click="handleDelete(row)"
                  >
                    删除该条
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>

        <el-empty
          v-if="!loading && discussions.length === 0"
          description="暂无匹配内容"
        />
      </div>

      <el-table
        v-else
        :data="discussions"
        row-class-name="discussion-table-row"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column label="讨论详情" min-width="350">
          <template #default="{ row }">
            <div class="post-content">
              <div class="post-header">
                <el-tag
                  v-if="row.isPinned"
                  size="small"
                  type="warning"
                  effect="dark"
                  class="pin-tag"
                >
                  <el-icon :size="12" class="mr-1"><Top /></el-icon>精选置顶
                </el-tag>
                <span class="post-title">{{ row.title || "(无标题)" }}</span>
              </div>
              <div class="post-excerpt">
                {{ row.content.substring(0, 100)
                }}{{ row.content.length > 100 ? "..." : "" }}
              </div>
              <div class="post-meta">
                <div class="meta-item">
                  <el-avatar
                    :size="20"
                    :src="formatAvatar(row.author?.avatar)"
                  />
                  <span class="meta-author">{{ row.author?.name }}</span>
                </div>
                <el-divider direction="vertical" />
                <div class="meta-item">
                  <span>{{ row.courseName || "未知课程" }}</span>
                </div>
                <el-divider direction="vertical" />
                <div class="meta-item">
                  <el-icon :size="16"><Clock /></el-icon>
                  <span>{{ formatTime(row.createdAt) }}</span>
                </div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="80" align="center">
          <template #default="{ row }">
            <el-tag
              :type="row.itemType === 'reply' ? 'info' : 'primary'"
              effect="plain"
              size="small"
              round
            >
              {{ row.itemType === "reply" ? "回复" : "帖子" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" effect="light" round>
              {{ statusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="AI 预警" width="100" align="center">
          <template #default="{ row }">
            <el-tag
              v-if="row.riskLevel"
              :type="riskLevelType(row.riskLevel)"
              effect="dark"
              size="small"
              round
            >
              {{ riskLevelText(row.riskLevel) }}
            </el-tag>
            <span v-else class="text-gray-300">-</span>
          </template>
        </el-table-column>
        <el-table-column label="内容热度" width="160" align="center">
          <template #default="{ row }">
            <div class="stats-info">
              <div class="stat-item" title="认可度">
                <el-icon :size="22" class="mr-1 text-red-500"
                  ><HeartIcon
                /></el-icon>
                <span>{{ row.likeCount }}</span>
              </div>
              <div class="stat-item" title="研讨数">
                <el-icon :size="22" class="mr-1 text-blue-500"
                  ><CommentIcon
                /></el-icon>
                <span>{{ row.replyCount }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" align="center" fixed="right">
          <template #default="{ row }">
            <div class="action-btns">
              <el-tooltip content="查看详情" placement="top">
                <div class="btn-icon-wrapper view" @click="viewDetail(row)">
                  <el-icon :size="22"><InfoIcon /></el-icon>
                </div>
              </el-tooltip>
              <template v-if="row.status === 'pending'">
                <el-tooltip content="通过" placement="top">
                  <div
                    class="btn-icon-wrapper approve"
                    @click="handleApprove(row)"
                  >
                    <el-icon :size="18"><Check /></el-icon>
                  </div>
                </el-tooltip>
                <el-tooltip content="拒绝" placement="top">
                  <div
                    class="btn-icon-wrapper reject"
                    @click="handleReject(row)"
                  >
                    <el-icon :size="18"><Close /></el-icon>
                  </div>
                </el-tooltip>
              </template>

              <!-- 置顶操作按钮 -->
              <template v-if="row.itemType === 'post'">
                <el-tooltip
                  :content="row.isPinned ? '取消置顶' : '设为置顶'"
                  placement="top"
                >
                  <div
                    class="btn-icon-wrapper pin"
                    :class="{ 'is-active': row.isPinned }"
                    @click="row.isPinned ? handleUnpin(row) : handlePin(row)"
                  >
                    <el-icon :size="20"><Top /></el-icon>
                  </div>
                </el-tooltip>
              </template>

              <!-- 编辑与删除 (更多操作) -->
              <el-dropdown trigger="click" popper-class="modern-dropdown">
                <div class="btn-icon-wrapper more">
                  <el-icon :size="20"><MoreFilled /></el-icon>
                </div>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item :icon="Edit" @click="handleEdit(row)">
                      编辑内容
                    </el-dropdown-item>
                    <el-dropdown-item
                      v-if="row.itemType === 'post' && !row.isPinned"
                      :icon="Top"
                      @click="handlePin(row)"
                    >
                      设为置顶
                    </el-dropdown-item>
                    <el-dropdown-item
                      v-if="row.itemType === 'post' && row.isPinned"
                      :icon="Top"
                      @click="handleUnpin(row)"
                    >
                      取消置顶
                    </el-dropdown-item>
                    <el-dropdown-item
                      :icon="Delete"
                      class="delete-item"
                      @click="handleDelete(row)"
                    >
                      删除该条
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="flex justify-end mt-4">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          :layout="paginationLayout"
          :size="isMobile ? 'small' : 'default'"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <!-- 编辑弹窗 -->
    <el-dialog
      v-model="editDialogVisible"
      :title="editForm.type === 'post' ? '编辑帖子' : '编辑回复'"
      :width="getDialogWidth('600px')"
      destroy-on-close
      class="custom-dialog"
    >
      <el-form :model="editForm" label-position="top" class="p-4">
        <el-form-item v-if="editForm.type === 'post'" label="帖子标题">
          <el-input v-model="editForm.title" placeholder="请输入标题" />
        </el-form-item>
        <el-form-item label="正文内容">
          <el-input
            v-model="editForm.content"
            type="textarea"
            :rows="8"
            placeholder="请输入内容..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div
          class="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3"
        >
          <el-button @click="editDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitEdit">保存修改</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 详情弹窗 -->
    <el-dialog
      v-model="detailDialogVisible"
      title="内容审核"
      :width="getDialogWidth('520px')"
      destroy-on-close
      class="simple-review-dialog"
    >
      <div v-if="currentDetail" class="review-detail">
        <!-- 作者信息 -->
        <div class="author-row">
          <el-avatar
            :size="36"
            :src="formatAvatar(currentDetail.author?.avatar)"
          />
          <div class="author-info">
            <span class="author-name">{{ currentDetail.author?.name }}</span>
            <span class="meta">
              {{ currentDetail.courseName || "未知课程" }} ·
              {{ formatTime(currentDetail.createdAt) }}
            </span>
          </div>
          <el-tag size="small" :type="riskLevelType(currentDetail.riskLevel)">
            {{ riskLevelText(currentDetail.riskLevel) }}
          </el-tag>
        </div>

        <!-- 内容区域 -->
        <div class="content-area">
          <div v-if="currentDetail.title" class="content-title">
            {{ currentDetail.title }}
          </div>
          <div
            class="content-body"
            v-html="currentDetail.contentHtml || currentDetail.content"
          />
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="detailDialogVisible = false">跳过</el-button>
          <el-button type="danger" plain @click="handleReject(currentDetail)"
            >拒绝</el-button
          >
          <el-button type="primary" @click="handleApprove(currentDetail)"
            >通过</el-button
          >
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.discussion-manage {
  .discussion-stats-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 20px;
  }

  .discussion-stats-grid__item {
    min-width: 0;
  }

  :deep(.el-card) {
    border: none;
    border-radius: 8px;
    box-shadow:
      0 1px 3px 0 rgb(0 0 0 / 0.1),
      0 1px 2px -1px rgb(0 0 0 / 0.1);
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

  .stat-card {
    height: 100%;
    border: 1px solid rgb(226 232 240 / 92%);
    border-radius: 24px;
    background: linear-gradient(180deg, #fff 0%, #f8fbff 100%);

    html.dark & {
      border-color: #334155;
      background: linear-gradient(180deg, #1f2937 0%, #111827 100%);
    }

    :deep(.el-card__body) {
      height: 100%;
      padding: 16px 18px;
    }

    .stat-content {
      min-height: 132px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;

      .stat-number {
        font-size: 32px;
        font-weight: 700;
        line-height: 1;
        margin-bottom: 8px;

        &.text-primary {
          color: #3b82f6;
        }
        &.text-success {
          color: #10b981;
        }
        &.text-warning {
          color: #f59e0b;
        }
        &.text-info {
          color: #6366f1;
        }
      }

      .stat-label {
        font-size: 14px;
        font-weight: 500;
        color: #64748b;

        html.dark & {
          color: #94a3b8;
        }
      }
    }
  }

  .discussion-panel {
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

  .discussion-panel__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
  }

  .discussion-panel__copy {
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

  .discussion-panel__eyebrow {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #6366f1;
    text-transform: uppercase;
  }

  .discussion-panel__badge {
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

  .discussion-list-toolbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
  }

  .discussion-list-toolbar__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    justify-content: flex-end;
  }

  .search-form {
    padding: 0;

    :deep(.el-form-item) {
      margin-bottom: 16px;
      margin-right: 16px;
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

  .search-form__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    width: 100%;
  }

  .search-form__primary,
  .search-form__secondary,
  .sync-status-btn,
  .batch-actions :deep(.el-button) {
    min-height: 44px;
    padding-inline: 18px;
    font-weight: 600;
    border-radius: 14px;
  }

  .search-form__actions :deep(.el-button) {
    margin-left: 0;
  }

  .search-form__primary {
    box-shadow: 0 12px 24px rgb(59 130 246 / 18%);
  }

  .batch-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .sync-status-btn {
    margin-left: 0;
  }

  .post-content {
    .post-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;

      .pin-tag {
        flex-shrink: 0;
        border-radius: 6px;
      }

      .post-title {
        font-size: 16px;
        font-weight: 600;
        color: #1e293b;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        html.dark & {
          color: #f1f5f9;
        }
      }
    }

    .post-excerpt {
      font-size: 14px;
      color: #64748b;
      line-height: 1.6;
      margin-bottom: 10px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;

      html.dark & {
        color: #94a3b8;
      }
    }

    .post-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 13px;
      color: #94a3b8;

      .meta-item {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .meta-author {
        font-weight: 500;
        color: #475569;

        html.dark & {
          color: #cbd5e1;
        }
      }

      :deep(.el-divider--vertical) {
        margin: 0;
        height: 12px;
        border-color: #e2e8f0;

        html.dark & {
          border-color: #334155;
        }
      }
    }
  }

  .stats-info {
    display: flex;
    justify-content: center;
    gap: 16px;

    .stat-item {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background: #f1f5f9;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
      transition: all 0.2s;

      html.dark & {
        background: #334155;
        color: #cbd5e1;
      }

      &:hover {
        transform: translateY(-1px);
        background: #e2e8f0;
        box-shadow: 0 2px 4px -1px rgb(0 0 0 / 0.06);

        html.dark & {
          background: #475569;
        }
      }
    }
  }

  .action-btns {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;

    .btn-icon-wrapper {
      padding: 8px;
      border-radius: 10px;
      transition: all 0.2s;
      cursor: pointer;
      color: #64748b;

      &:hover {
        background: rgba(0, 0, 0, 0.05);
        transform: scale(1.1);
      }

      &.approve:hover {
        color: #10b981;
        background: rgba(16, 185, 129, 0.1);
      }
      &.reject:hover {
        color: #f59e0b;
        background: rgba(245, 158, 11, 0.1);
      }
      &.view:hover {
        color: #3b82f6;
        background: rgba(59, 130, 246, 0.1);
      }
      &.more:hover {
        color: #6366f1;
        background: rgba(99, 102, 241, 0.1);
      }

      &.pin {
        &:hover {
          color: #f59e0b;
          background: rgba(245, 158, 11, 0.1);
        }

        &.is-active {
          color: #f59e0b;
          background: rgba(245, 158, 11, 0.15);
        }
      }
    }
  }

  .detail-content {
    .content-html {
      line-height: 1.8;
      font-size: 15px;

      :deep(p) {
        margin-bottom: 1.25em;
      }

      :deep(img) {
        border-radius: 8px;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
      }
    }
  }
}

.mobile-discussion-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.mobile-discussion-card {
  padding: 18px;
  background: linear-gradient(
    180deg,
    rgb(255 255 255 / 98%) 0%,
    rgb(248 250 252 / 96%) 100%
  );
  border: 1px solid rgb(226 232 240 / 88%);
  border-radius: 22px;
  box-shadow: 0 14px 32px rgb(15 23 42 / 8%);
}

.mobile-discussion-card__header {
  justify-content: space-between;
  align-items: flex-start;
}

.mobile-discussion-card__header-main,
.mobile-discussion-card__header-tags {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.mobile-discussion-card__header-note {
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
}

.mobile-discussion-card__header,
.mobile-discussion-card__stats,
.mobile-discussion-card__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mobile-discussion-card__header,
.mobile-discussion-card__stats {
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.mobile-discussion-card__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.mobile-discussion-card__stats {
  padding: 14px 0;
  margin-bottom: 14px;
  border-top: 1px solid rgb(226 232 240 / 88%);
  border-bottom: 1px solid rgb(226 232 240 / 88%);
}

.mobile-discussion-card__stats .stat-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
}

.mobile-discussion-card__actions :deep(.el-button) {
  width: 100%;
  min-height: 42px;
  margin-left: 0;
  font-weight: 600;
  border-radius: 14px;
}

.mobile-card-more {
  width: 100%;
}

.mobile-card-more :deep(.el-button) {
  width: 100%;
}

/* 按钮样式修正 */
.el-button {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 6px;

  &:not(.is-disabled):active {
    transform: scale(0.95);
  }
}

/* 下拉菜单美化 */
:deep(.modern-dropdown) {
  border-radius: 12px !important;
  padding: 6px !important;
  border: none !important;
  box-shadow:
    0 10px 15px -3px rgb(0 0 0 / 0.1),
    0 4px 6px -4px rgb(0 0 0 / 0.1) !important;

  .el-dropdown-menu__item {
    border-radius: 8px !important;
    margin-bottom: 2px !important;
    padding: 10px 16px !important;
    font-weight: 500 !important;
    transition: all 0.2s !important;

    &:last-child {
      margin-bottom: 0 !important;
    }

    &:hover {
      background-color: #f1f5f9 !important;
      color: #3b82f6 !important;

      html.dark & {
        background-color: #334155 !important;
        color: #60a5fa !important;
      }
    }

    &.delete-item:hover {
      background-color: #fef2f2 !important;
      color: #ef4444 !important;

      html.dark & {
        background-color: #450a0a !important;
        color: #f87171 !important;
      }
    }

    .el-icon {
      margin-right: 8px !important;
      font-size: 16px !important;
    }
  }

  :deep(.el-dropdown-menu__item--divided) {
    margin-top: 6px !important;
    border-top: 1px solid #f1f5f9 !important;

    html.dark & {
      border-top-color: #334155 !important;
    }

    &::before {
      display: none !important;
    }
  }
}

.review-detail {
  .author-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;

    .author-info {
      flex: 1;
      display: flex;
      flex-direction: column;

      .author-name {
        font-weight: 600;
        color: #303133;

        html.dark & {
          color: #e5e7eb;
        }
      }

      .meta {
        font-size: 12px;
        color: #909399;
      }
    }
  }

  .content-area {
    padding: 16px;
    background: #f9fafb;
    border-radius: 8px;
    min-height: 100px;
    max-height: 400px;
    overflow-y: auto;

    html.dark & {
      background: #262626;
    }

    .content-title {
      font-size: 15px;
      font-weight: 600;
      color: #303133;
      margin-bottom: 8px;

      html.dark & {
        color: #e5e7eb;
      }
    }

    .content-body {
      font-size: 14px;
      line-height: 1.6;
      color: #606266;
      word-break: break-word;

      html.dark & {
        color: #d1d5db;
      }
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* 滚动条美化 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

@media (width <= 768px) {
  .discussion-manage {
    padding-bottom: calc(
      var(--pure-mobile-tab-height) + var(--pure-safe-area-bottom) + 28px
    );

    .discussion-stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
      margin-bottom: 20px;
    }

    .discussion-panel {
      :deep(.el-card__body) {
        padding: 18px;
      }
    }

    .stat-card {
      :deep(.el-card__body) {
        padding: 14px;
      }

      .stat-content {
        min-height: 124px;
      }

      .stat-number {
        font-size: 30px;
        margin-bottom: 14px;
      }

      .stat-label {
        font-size: 13px;
        line-height: 1.55;
      }
    }

    .discussion-panel__header,
    .discussion-list-toolbar {
      flex-direction: column;
      margin-bottom: 16px;
    }

    .discussion-panel__copy {
      h3 {
        font-size: 20px;
      }

      p {
        font-size: 13px;
      }
    }

    .discussion-panel__badge {
      width: 100%;
      white-space: normal;
    }

    .discussion-list-toolbar__actions {
      width: 100%;
      justify-content: stretch;
    }

    .batch-actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      width: 100%;
    }

    .batch-actions :deep(.el-button),
    .sync-status-btn {
      width: 100%;
    }

    .search-form {
      padding: 0;
    }

    :deep(.search-form .el-form-item) {
      width: 100%;
      margin-right: 0;
      margin-bottom: 12px;
    }

    :deep(.search-form .el-form-item__label) {
      padding: 0 0 8px;
      line-height: 1.25;
    }

    :deep(.search-form .el-form-item__content) {
      width: 100%;
    }

    :deep(.search-form .el-select),
    :deep(.search-form .el-input) {
      width: 100% !important;
    }

    .search-form__actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      width: 100%;
    }

    :deep(.search-form .el-button) {
      width: 100%;
    }

    .post-content .post-meta {
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
    }

    .post-content .post-header {
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 8px;
    }

    .post-content .post-header .post-title {
      white-space: normal;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .post-content .post-excerpt {
      font-size: 13px;
      line-height: 1.7;
      margin-bottom: 12px;
    }
  }
}

@media (width <= 420px) {
  .discussion-manage {
    .discussion-stats-grid {
      gap: 14px;
    }

    .search-form__actions,
    .batch-actions,
    .mobile-discussion-card__actions {
      grid-template-columns: 1fr;
    }

    .mobile-discussion-card {
      padding: 16px;
      border-radius: 20px;
    }

    .stat-card {
      :deep(.el-card__body) {
        padding: 12px;
      }

      .stat-content {
        min-height: 112px;
      }

      .stat-number {
        font-size: 28px;
        margin-bottom: 12px;
      }

      .stat-label {
        font-size: 12px;
        line-height: 1.5;
      }
    }

    .mobile-discussion-card__header-note {
      font-size: 12px;
    }

    .mobile-discussion-card__stats {
      gap: 8px;
    }
  }
}
</style>

<style lang="scss">
/* 详情弹窗样式 */
.simple-review-dialog {
  border-radius: 12px !important;
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2) !important;

  .el-dialog__header {
    margin-right: 0;
    padding: 16px 20px;
    border-bottom: 1px solid #f1f5f9;

    html.dark & {
      border-bottom-color: #334155;
    }

    .el-dialog__title {
      font-size: 16px;
      font-weight: 600;
      color: #303133;

      html.dark & {
        color: #e5e7eb;
      }
    }
  }

  .el-dialog__body {
    padding: 20px !important;
    background: white;

    html.dark & {
      background: #1d1d1d;
    }
  }

  .el-dialog__footer {
    padding: 16px 20px !important;
    border-top: 1px solid #f1f5f9;

    html.dark & {
      border-top-color: #334155;
    }
  }
}

.custom-dialog {
  border-radius: 20px !important;
  overflow: hidden;

  .el-dialog__header {
    margin-right: 0;
    padding: 20px 24px;
    border-bottom: 1px solid #f1f5f9;

    html.dark & {
      border-bottom-color: #334155;
    }

    .el-dialog__title {
      font-size: 18px;
      font-weight: 600;
    }
  }

  .el-dialog__body {
    padding: 24px !important;
  }

  .el-dialog__footer {
    padding: 0 !important;
  }
}

/* 全局下拉菜单样式修正 */
.el-popper.modern-dropdown {
  border-radius: 12px !important;
  border: 1px solid #f1f5f9 !important;
  box-shadow:
    0 10px 25px -5px rgba(0, 0, 0, 0.1),
    0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
  background: white !important;
  padding: 0 !important; /* 关键：移除容器内边距 */

  html.dark & {
    border-color: #334155 !important;
    background-color: #1e1e1e !important;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3) !important;
  }

  /* 移除内部嵌套组件的默认背景和边框 */
  .el-scrollbar,
  .el-dropdown-menu {
    border: none !important;
    background: transparent !important;
    border-radius: 12px !important;
  }

  .el-dropdown-menu {
    padding: 6px !important;
  }

  /* 修正小箭头颜色与边框 */
  .el-popper__arrow::before {
    background: white !important;
    border-color: #f1f5f9 !important;
  }

  html.dark & .el-popper__arrow::before {
    background: #1e1e1e !important;
    border-color: #334155 !important;
  }

  .el-dropdown-menu__item {
    border-radius: 8px !important;
    margin-bottom: 2px !important;
    padding: 10px 16px !important;
    font-size: 14px !important;
    font-weight: 500 !important;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;

    &:last-child {
      margin-bottom: 0 !important;
    }

    &:hover {
      background-color: #eff6ff !important;
      color: #2563eb !important;

      html.dark & {
        background-color: #1e3a8a !important;
        color: #60a5fa !important;
      }
    }

    &.delete-item:hover {
      background-color: #fef2f2 !important;
      color: #dc2626 !important;

      html.dark & {
        background-color: #450a0a !important;
        color: #f87171 !important;
      }
    }

    .el-icon {
      margin-right: 8px !important;
      font-size: 16px !important;
    }
  }

  .el-dropdown-menu__item--divided {
    margin-top: 6px !important;
    border-top: 1px solid #f1f5f9 !important;

    html.dark & {
      border-top-color: #334155 !important;
    }

    &::before {
      display: none !important;
    }
  }
}

/* 自定义确认框样式 */
:global(.custom-message-box) {
  padding-bottom: 8px !important;
  border: none !important;
  border-radius: 20px !important;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1) !important;
}

:global(.custom-message-box .el-message-box__header) {
  padding: 24px 24px 12px !important;
}

:global(.custom-message-box .el-message-box__title) {
  font-size: 18px !important;
  font-weight: 600 !important;
  color: #303133 !important;
}

:global(.custom-message-box .el-message-box__content) {
  padding: 12px 24px 24px !important;
  font-size: 15px !important;
  line-height: 1.6 !important;
  color: #606266 !important;
}

:global(.custom-message-box .el-message-box__status) {
  margin-right: 12px !important;
  font-size: 24px !important;
}

:global(.custom-message-box .el-message-box__message) {
  padding-left: 0 !important;
}

:global(.custom-message-box .el-message-box__btns) {
  padding: 8px 24px 24px !important;
}

:global(.custom-message-box .el-message-box__btns .el-button) {
  height: 40px !important;
  padding: 0 24px !important;
  font-size: 14px !important;
  font-weight: 500 !important;
  border-radius: 10px !important;
  transition: all 0.2s ease !important;
}

:global(.custom-message-box .el-message-box__btns .el-button--primary) {
  padding: 0 28px !important;
  font-weight: 600 !important;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.3) !important;
}

:global(.custom-message-box .el-message-box__btns .el-button:active) {
  transform: scale(0.96) !important;
}

/* 深色模式适配 */
:global(.dark) :global(.custom-message-box) {
  background-color: #242428 !important;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4) !important;
}

:global(.dark) :global(.custom-message-box .el-message-box__title) {
  color: #e0e0e0 !important;
}

:global(.dark) :global(.custom-message-box .el-message-box__content) {
  color: #a0a0a0 !important;
}

:global(.dark)
  :global(.custom-message-box .el-button--default:not(.el-button--primary)) {
  color: #cfd3dc !important;
  background-color: #333 !important;
  border-color: #434343 !important;
}

:global(.dark)
  :global(
    .custom-message-box .el-button--default:not(.el-button--primary):hover
  ) {
  color: #409eff !important;
  background-color: #3d3d42 !important;
  border-color: #409eff !important;
}

:global(.dark) :global(.custom-message-box .el-button--primary) {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
}
</style>
