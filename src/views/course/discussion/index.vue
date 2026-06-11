<script setup lang="ts">
/**
 * 教师端 - 内容审核队列
 * 教师可以审核所授课程中待审核的讨论内容
 */
import { computed, ref, reactive, onActivated, watch } from "vue";
import { useRoute } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { usePageResponsive } from "@/utils/pageResponsive";
import {
  Search,
  Refresh,
  Check,
  Close,
  Warning,
  Clock,
  Top
} from "@element-plus/icons-vue";
import {
  reviewPost,
  reviewReply,
  pinPost,
  unpinPost,
  getPendingList,
  getPendingStatistics,
  getUserAvatars,
  mapPendingItemToReviewQueueItem,
  type ReviewQueueItem,
  type PendingItem
} from "@/api/discussion-admin";
import { formatAvatar } from "@/utils/avatar";
import InfoIcon from "@/assets/commentareasrelatedsvgs/information-circle-svgrepo-com.svg?component";

defineOptions({
  name: "TeacherReviewQueue"
});

const { isMobile, paginationLayout, getDialogWidth } = usePageResponsive();

// 标签类型
type TagType = "danger" | "warning" | "info" | "success" | "primary";

// 状态
const loading = ref(false);
const reviewItems = ref<ReviewQueueItem[]>([]);
const selectedIds = ref<string[]>([]);
const detailDialogVisible = ref(false);
const currentDetail = ref<ReviewQueueItem | null>(null);
const selectedCount = computed(() => selectedIds.value.length);

// 统计数据
const stats = ref({
  pending: 0,
  highPriority: 0,
  avgWaitTime: "0小时",
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
  priority: "" as "" | "high" | "medium" | "low"
});

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
});

// 优先级选项
const priorityOptions = [
  { label: "全部", value: "" },
  { label: "高优先级", value: "high" },
  { label: "中优先级", value: "medium" },
  { label: "低优先级", value: "low" }
];
const activeFilterCount = computed(() => {
  let count = 0;

  if (searchForm.courseId) count += 1;
  if (searchForm.priority) count += 1;

  return count;
});
const filterBadgeText = computed(() =>
  activeFilterCount.value > 0
    ? `已启用 ${activeFilterCount.value} 项筛选`
    : "当前展示全部待审内容"
);
const queueSummaryText = computed(() => {
  if (loading.value && pagination.total === 0) {
    return "正在同步待审内容...";
  }

  if (pagination.total === 0) {
    return "暂无待审核内容";
  }

  if (selectedCount.value > 0) {
    return `共 ${pagination.total} 条待审内容，已选择 ${selectedCount.value} 条`;
  }

  return `共 ${pagination.total} 条待审内容，可继续筛选或批量处理`;
});

// 优先级标签样式
const priorityTagType = (priority: string): TagType => {
  const map: Record<string, TagType> = {
    high: "danger",
    medium: "warning",
    low: "info"
  };
  return map[priority] || "info";
};

const priorityText = (priority: string): string => {
  const map: Record<string, string> = {
    high: "高",
    medium: "中",
    low: "低"
  };
  return map[priority] || priority;
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

// 加载数据- 使用 getPendingList获取待审核内容（包括帖子和回复）
const fetchData = async () => {
  // 注意：批量操作时 loading 己由外部设置，此处不要重复判断 return
  // 如果是普通加载且正在加载中，则跳过
  if (loading.value && reviewItems.value.length === 0) return;

  loading.value = true;
  reviewItems.value = []; // 清空当前列表，防止筛选后由于加载慢导致"没动弹"的错觉
  try {
    // 使用待审核列表接口获取待审核内容
    const res = await getPendingList({
      courseId: searchForm.courseId || undefined,
      type: "all", // 获取所有类型（帖子和回复）
      pageNum: pagination.page,
      pageSize: pagination.pageSize
    });

    // 兼容后端返回格式
    const list = res?.list || [];
    const total = res?.total || 0;

    // 提取所有用户 ID，获取用户头像
    const userIds = list.map((item: PendingItem) => item.authorId);
    let avatarMap = new Map<number, string>();
    if (userIds.length > 0) {
      try {
        avatarMap = await getUserAvatars(userIds);
      } catch (avatarError) {
        console.error("[fetchData] 获取用户头像失败:", avatarError);
      }
    }

    // 转换 PendingItem 为 ReviewQueueItem 格式
    reviewItems.value = list.map((item: PendingItem) =>
      mapPendingItemToReviewQueueItem(item, avatarMap.get(item.authorId))
    );

    pagination.total = total;
    stats.value.pending = total;
  } catch (error) {
    console.error("加载审核队列失败", error);
  } finally {
    loading.value = false;
  }
};

// 加载课程列表
const fetchCourses = async () => {
  try {
    const data = await getPendingStatistics();
    stats.value.pending = Number(data.pendingTotal || 0);
    stats.value.courses = Array.isArray(data.courses)
      ? data.courses.map(course => ({
          courseId: String(course.courseId),
          courseName: course.courseName,
          pendingPosts: Number(course.pendingPosts || 0),
          pendingReplies: Number(course.pendingReplies || 0),
          pendingTotal: Number(course.pendingTotal || 0)
        }))
      : [];
  } catch (error) {
    console.error("加载待审核统计失败", error);
  }
};

// 搜索
const handleSearch = () => {
  pagination.page = 1;
  selectedIds.value = [];
  fetchData();
};

// 重置搜索
const resetSearch = () => {
  searchForm.courseId = "";
  searchForm.priority = "";
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

// 查看详情
const viewDetail = (row: ReviewQueueItem) => {
  // 待审核内容直接使用列表中的数据显示详情
  // 因为前端接口 /edu/frontend/v1/discussions/{postId} 可能无法获取 pending 状态的帖子
  currentDetail.value = row;
  detailDialogVisible.value = true;
};

// 审核通过
const handleApprove = async (row: ReviewQueueItem) => {
  try {
    if (row.itemType === "reply") {
      await reviewReply(row.id, { action: "approve" });
    } else {
      await reviewPost(row.id, { action: "approve" });
    }

    // 从本地立即移除，解决列表残留问题
    const idx = reviewItems.value.findIndex(i => i.id === row.id);
    if (idx > -1) reviewItems.value.splice(idx, 1);

    ElMessage.success({
      message: "审核通过",
      type: "success"
    });
    // 增加延迟刷新，防止后端同步延迟
    setTimeout(() => fetchData(), 800);
  } catch (error) {
    ElMessage.error("审核操作失败，请重试");
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

    // 从本地立即移除
    const idx = reviewItems.value.findIndex(i => i.id === row.id);
    if (idx > -1) reviewItems.value.splice(idx, 1);

    ElMessage.success("已成功拒绝该内容");
    // 增加延迟刷新
    setTimeout(() => fetchData(), 800);
  } catch (error: any) {
    if (error !== "cancel") {
      ElMessage.error("操作失败，请检查网络");
    }
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

// 批量审核通过
const handleBatchApprove = async () => {
  if (selectedIds.value.length === 0) {
    ElMessage.warning("请先勾选需要审核的内容");
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确定要批量通过选中的 ${selectedIds.value.length} 条内容吗？`,
      "批量审核确认",
      {
        confirmButtonText: "立即通过",
        cancelButtonText: "取消",
        type: "info",
        customClass: "custom-message-box",
        draggable: true
      }
    );

    loading.value = true;
    let successCount = 0;
    let failedCount = 0;

    // 复制一份 ID 列表以防遍历时干扰
    const idsToProcess = [...selectedIds.value];

    // 遍历执行单次操作以确保稳定性（如用户所建议）
    for (const id of idsToProcess) {
      const item = reviewItems.value.find(i => i.id === id);
      try {
        if (item?.itemType === "reply") {
          await reviewReply(id, { action: "approve" });
        } else {
          await reviewPost(id, { action: "approve" });
        }
        successCount++;
        // 本地实时移除
        const idx = reviewItems.value.findIndex(i => i.id === id);
        if (idx > -1) reviewItems.value.splice(idx, 1);
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
    // 增加延迟同步，防止后端数据刷新延迟导致 404
    setTimeout(() => fetchData(), 1000);
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

    // 遍历执行单次操作以保证成功率
    for (const id of idsToProcess) {
      const item = reviewItems.value.find(i => i.id === id);
      try {
        if (item?.itemType === "reply") {
          await reviewReply(id, { action: "reject", note: value });
        } else {
          await reviewPost(id, { action: "reject", note: value });
        }
        successCount++;
        // 本地实时移除
        const idx = reviewItems.value.findIndex(i => i.id === id);
        if (idx > -1) reviewItems.value.splice(idx, 1);
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
    // 增加延迟同步，防止后端数据刷新延迟导致 404
    setTimeout(() => fetchData(), 1000);
  } catch (error: any) {
    if (error !== "cancel") {
      ElMessage.error("批量操作失败");
    }
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

// 计算等待时间
const getWaitTime = (dateStr: string) => {
  if (!dateStr) return "-";
  const now = new Date();
  const created = new Date(dateStr);
  const diffMs = now.getTime() - created.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffHours > 24) {
    const days = Math.floor(diffHours / 24);
    return `${days}天${diffHours % 24}小时`;
  }
  if (diffHours > 0) {
    return `${diffHours}小时${diffMins}分钟`;
  }
  return `${diffMins}分钟`;
};

// 处理详情弹窗审核通过
const handleDetailApprove = () => {
  if (currentDetail.value) {
    handleApprove(currentDetail.value);
    detailDialogVisible.value = false;
  }
};

// 处理详情弹窗审核拒绝
const handleDetailReject = () => {
  if (currentDetail.value) {
    handleReject(currentDetail.value);
    detailDialogVisible.value = false;
  }
};

// 数据是否已加载的标志
const dataLoaded = ref(false);

// 初始化加载数据
const initData = async (force = false) => {
  // 防止重复加载
  if (loading.value || (dataLoaded.value && !force)) return;

  await fetchCourses();
  await fetchData();
  dataLoaded.value = true;
};

const route = useRoute();

// 监听路由名称变化，当路由名称存在时加载数据
// 根据 vue-pure-admin 的路由机制，route.name 存在表示动态路由已完全初始化
// 这是解决页面刷新时数据不加载的关键
watch(
  () => route.name,
  newName => {
    // 当路由名称存在时加载数据
    if (newName && !dataLoaded.value) {
      initData();
    }
  },
  { immediate: true }
);

// 当组件从 keep-alive 缓存中被激活时重新加载数据
onActivated(() => {
  dataLoaded.value = false; // 重置标志以允许重新加载
  initData();
});
</script>

<template>
  <div class="review-queue" :class="{ 'review-queue--mobile': isMobile }">
    <!-- 统计卡片 -->
    <div class="review-stats-grid mb-6">
      <div class="review-stats-grid__item">
        <el-card shadow="hover" class="stat-card pending">
          <div class="stat-content">
            <div class="stat-icon warning">
              <el-icon :size="30"><Clock /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-number">{{ stats.pending }}</div>
              <div class="stat-label">待审核内容</div>
            </div>
          </div>
        </el-card>
      </div>
      <div class="review-stats-grid__item">
        <el-card shadow="hover" class="stat-card high">
          <div class="stat-content">
            <div class="stat-icon danger">
              <el-icon :size="30"><Warning /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-number">{{ stats.highPriority }}</div>
              <div class="stat-label">高风险预警</div>
            </div>
          </div>
        </el-card>
      </div>
      <div class="review-stats-grid__item">
        <el-card shadow="hover" class="stat-card avg">
          <div class="stat-content">
            <div class="stat-icon info">
              <el-icon :size="30"><Clock /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-number">{{ stats.avgWaitTime }}</div>
              <div class="stat-label">平均处理时效</div>
            </div>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 搜索栏 -->
    <el-card shadow="never" class="mb-4 search-card review-panel">
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
        <el-form-item label="所属课程">
          <el-select
            v-model="searchForm.courseId"
            placeholder="筛选课程"
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
                  effect="plain"
                  round
                >
                  {{ course.pendingTotal }}
                </el-tag>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="优先级">
          <el-select
            v-model="searchForm.priority"
            placeholder="内容优先级"
            clearable
            style="width: 150px"
            @change="handleSearch"
          >
            <el-option
              v-for="opt in priorityOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">
            查询审核
          </el-button>
          <el-button :icon="Refresh" @click="resetSearch"> 重置条件 </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 操作栏 -->
    <el-card shadow="never" class="mb-4 action-bar review-panel">
      <div class="flex justify-between items-center mb-4">
        <span class="font-bold text-base">内容审核列表</span>
        <div class="text-sm text-gray-500">{{ queueSummaryText }}</div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <el-button
          type="success"
          :icon="Check"
          :disabled="selectedCount === 0"
          @click="handleBatchApprove"
        >
          批量通过
        </el-button>
        <el-button
          type="danger"
          :icon="Close"
          :disabled="selectedCount === 0"
          @click="handleBatchReject"
        >
          批量拒绝
        </el-button>
        <div
          v-if="selectedCount > 0"
          class="text-sm text-orange-500 ml-2 mr-2 flex items-center gap-1"
        >
          <el-icon><Warning /></el-icon>
          已选中 {{ selectedCount }} 个待审项
        </div>
        <el-button :icon="Refresh" text @click="initData(true)">
          同步数据
        </el-button>
      </div>
    </el-card>

    <!-- 数据表格 -->
    <el-card v-loading="loading" shadow="never" class="data-card review-panel">
      <div v-if="isMobile" class="mobile-review-list">
        <div
          v-for="row in reviewItems"
          :key="row.id"
          class="mobile-review-card"
        >
          <div class="mobile-review-card__header">
            <div class="mobile-review-card__header-main">
              <el-checkbox
                :model-value="isSelected(row.id)"
                @change="value => toggleMobileSelection(row.id, Boolean(value))"
              />
              <span class="mobile-review-card__header-note">
                {{ isSelected(row.id) ? "已加入批量处理" : "加入批量处理" }}
              </span>
            </div>
            <div class="mobile-review-card__header-tags">
              <el-tag
                :type="priorityTagType(row.priority)"
                effect="light"
                round
                size="small"
              >
                {{ priorityText(row.priority) }}优先级
              </el-tag>
              <el-tag
                :type="riskLevelType(row.riskLevel)"
                effect="dark"
                round
                size="small"
              >
                {{ riskLevelText(row.riskLevel) }}
              </el-tag>
            </div>
          </div>

          <div class="discussion-item-classic">
            <div v-if="row.title" class="item-title">
              {{ row.title }}
            </div>

            <div class="item-excerpt">
              {{ row.content }}
            </div>

            <div class="item-footer">
              <div class="author-box">
                <el-avatar
                  :size="22"
                  :src="formatAvatar(row.author?.avatar)"
                  class="author-avatar"
                />
                <span class="author-name">{{ row.author?.name }}</span>
              </div>
              <span class="course-name">{{
                row.courseName || "未知课程"
              }}</span>
              <span class="post-time">{{ formatTime(row.createdAt) }}</span>
              <el-tag
                v-if="row.itemType === 'reply'"
                size="small"
                class="type-tag"
                effect="plain"
              >
                回复
              </el-tag>
            </div>
          </div>

          <div class="mobile-review-card__wait">
            <span class="wait-label">已等待</span>
            <span
              class="wait-value"
              :class="{
                'is-urgent': getWaitTime(row.createdAt).includes('天')
              }"
            >
              {{ getWaitTime(row.createdAt) }}
            </span>
          </div>

          <div class="mobile-review-card__actions">
            <el-button plain @click="viewDetail(row)">详情审核</el-button>
            <el-button type="success" plain @click="handleApprove(row)">
              直接通过
            </el-button>
            <el-button type="danger" plain @click="handleReject(row)">
              违规拒绝
            </el-button>
            <el-button
              v-if="row.itemType === 'post'"
              type="warning"
              plain
              @click="row.isPinned ? handleUnpin(row) : handlePin(row)"
            >
              {{ row.isPinned ? "取消置顶" : "设为置顶" }}
            </el-button>
          </div>
        </div>

        <el-empty
          v-if="!loading && reviewItems.length === 0"
          description="暂无待审核内容"
        />
      </div>

      <el-table
        v-else
        :data="reviewItems"
        row-class-name="review-table-row"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column label="讨论内容" min-width="450">
          <template #default="{ row }">
            <div class="discussion-item-classic">
              <!-- 第一行：标题 -->
              <div v-if="row.title" class="item-title">
                {{ row.title }}
              </div>

              <!-- 第二行：正文预览 -->
              <div class="item-excerpt">
                {{ row.content }}
              </div>

              <!-- 第三行：元数据行 -->
              <div class="item-footer">
                <div class="author-box">
                  <el-avatar
                    :size="24"
                    :src="formatAvatar(row.author?.avatar)"
                    class="author-avatar"
                  />
                  <span class="author-name">{{ row.author?.name }}</span>
                </div>
                <span class="separator">|</span>
                <span class="course-name">{{
                  row.courseName || "未知课程"
                }}</span>
                <span class="separator">|</span>
                <span class="post-time">{{ formatTime(row.createdAt) }}</span>

                <el-tag
                  v-if="row.itemType === 'reply'"
                  size="small"
                  class="ml-2 type-tag"
                  effect="plain"
                >
                  回复
                </el-tag>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="优先级" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="priorityTagType(row.priority)" effect="light" round>
              {{ priorityText(row.priority) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="风险评估" width="110" align="center">
          <template #default="{ row }">
            <el-tag
              :type="riskLevelType(row.riskLevel)"
              effect="dark"
              round
              size="small"
            >
              {{ riskLevelText(row.riskLevel) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="命词词库" width="160">
          <template #default="{ row }">
            <div v-if="row.matchedWords?.length" class="flex flex-wrap gap-1">
              <el-tag
                v-for="word in row.matchedWords.slice(0, 2)"
                :key="word"
                type="danger"
                size="small"
                effect="plain"
              >
                {{ word }}
              </el-tag>
              <el-tooltip
                v-if="row.matchedWords.length > 2"
                :content="row.matchedWords.slice(2).join(', ')"
              >
                <el-tag type="info" size="small" effect="plain">
                  +{{ row.matchedWords.length - 2 }}
                </el-tag>
              </el-tooltip>
            </div>
            <span v-else class="text-gray-300">-</span>
          </template>
        </el-table-column>
        <el-table-column label="等待已久" width="120" align="center">
          <template #default="{ row }">
            <div
              class="flex flex-col items-center"
              :class="{
                'text-red-500 font-bold': getWaitTime(row.createdAt).includes(
                  '天'
                )
              }"
            >
              <span class="text-xs text-gray-400 mb-1">已等待</span>
              <span class="text-sm">
                {{ getWaitTime(row.createdAt) }}
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          label="审核操作"
          width="200"
          align="center"
          fixed="right"
        >
          <template #default="{ row }">
            <div class="action-btns">
              <el-tooltip content="进入详情审核" placement="top">
                <div class="btn-icon-wrapper view" @click="viewDetail(row)">
                  <el-icon :size="18"><InfoIcon /></el-icon>
                </div>
              </el-tooltip>
              <el-tooltip content="直接通过" placement="top">
                <div
                  class="btn-icon-wrapper approve"
                  @click="handleApprove(row)"
                >
                  <el-icon :size="18"><Check /></el-icon>
                </div>
              </el-tooltip>
              <el-tooltip content="违规拒绝" placement="top">
                <div class="btn-icon-wrapper reject" @click="handleReject(row)">
                  <el-icon :size="18"><Close /></el-icon>
                </div>
              </el-tooltip>

              <!-- 置顶操作 -->
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
                    <el-icon :size="18"><Top /></el-icon>
                  </div>
                </el-tooltip>
              </template>
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
          :page-sizes="[10, 20, 50]"
          :layout="paginationLayout"
          :size="isMobile ? 'small' : 'default'"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

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
          <el-button type="danger" plain @click="handleDetailReject"
            >拒绝</el-button
          >
          <el-button type="primary" @click="handleDetailApprove"
            >通过</el-button
          >
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.review-queue {
  .review-stats-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
  }

  .review-stats-grid__item {
    min-width: 0;
  }

  :deep(.el-card) {
    border: none;
    border-radius: 12px;
    box-shadow: none !important;
    transition: all 0.2s;
    overflow: hidden;

    html.dark & {
      background-color: #1d1d1d;
    }
  }

  .review-panel {
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

  .review-panel__header,
  .review-toolbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
  }

  .review-panel__copy {
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

  .review-panel__eyebrow {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #6366f1;
    text-transform: uppercase;
  }

  .review-panel__badge {
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

  /* 移除固定列自带的阴影 bug */
  :deep(.el-table__fixed-right) {
    box-shadow: none !important;
    background: transparent !important;
    &::before {
      display: none !important;
    }
  }

  :deep(.el-table__fixed-column--left-is-scrolled),
  :deep(.el-table__fixed-column--right-is-scrolled) {
    box-shadow: none !important;
  }

  .stat-card {
    position: relative;
    border: 1px solid rgb(226 232 240 / 92%);
    border-radius: 24px;
    background: linear-gradient(180deg, #fff 0%, #f8fbff 100%);

    html.dark & {
      border-color: #334155;
      background: linear-gradient(180deg, #1f2937 0%, #111827 100%);
    }

    .stat-content {
      display: flex;
      gap: 16px;
      align-items: center;
      padding: 8px 4px;

      .stat-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        color: #fff;
        border-radius: 10px;
        transition: transform 0.2s;

        &.warning {
          background: #f59e0b;
        }

        &.danger {
          background: #ef4444;
        }

        &.info {
          background: #3b82f6;
        }
      }

      .stat-info {
        .stat-number {
          font-size: 24px;
          font-weight: 600;
          color: #1e293b;

          html.dark & {
            color: #f1f5f9;
          }
        }

        .stat-label {
          font-size: 13px;
          color: #64748b;

          html.dark & {
            color: #94a3b8;
          }
        }
      }
    }
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
    display: flex;
    width: 100%;
  }

  .search-form__primary {
    box-shadow: 0 12px 24px rgb(59 130 246 / 18%);
  }

  .review-toolbar__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    justify-content: flex-end;
  }

  .batch-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .batch-info {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 0 12px;
    border-radius: 999px;
    background: #fff7ed;
    color: #c2410c;
    font-size: 13px;
    font-weight: 600;

    html.dark & {
      background: rgb(194 65 12 / 16%);
      color: #fdba74;
    }
  }

  .sync-status-btn {
    margin-left: 0;
  }

  .batch-actions :deep(.el-button) {
    margin-left: 0;
    display: flex;
    width: 100%;
  }

  .data-card {
    :deep(.el-table) {
      border-radius: 8px;
      --el-table-row-hover-bg-color: #f8fafc;
      border: none !important;

      html.dark & {
        --el-table-row-hover-bg-color: #262626;
      }

      .el-table__row {
        height: auto;
      }

      /* 彻底消除固定列阴影和各种残留线条 */
      .el-table__fixed-right,
      .el-table__fixed {
        box-shadow: none !important;
        border-left: none !important;
        &::before {
          display: none !important;
        }
      }

      .el-table__fixed-column--right-is-scrolled,
      .el-table__fixed-column--left-is-scrolled {
        box-shadow: none !important;
      }

      /* 移除单元格可能存在的阴影 */
      .el-table__cell {
        border-bottom: 1px solid #f1f5f9 !important;
        box-shadow: none !important;

        html.dark & {
          border-bottom-color: #333 !important;
        }
      }
    }

    .discussion-item-classic {
      padding: 2px 0;
      display: flex;
      flex-direction: column;
      gap: 4px;

      .item-title {
        font-size: 15px;
        font-weight: 600;
        color: #334155;
        line-height: 1.3;

        html.dark & {
          color: #e2e8f0;
        }
      }

      .item-excerpt {
        font-size: 13.5px;
        color: #64748b;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        word-break: break-all;

        html.dark & {
          color: #94a3b8;
        }
      }

      .item-footer {
        display: flex;
        align-items: center;
        font-size: 12px;
        color: #94a3b8;
        margin-top: 2px;

        .author-box {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-right: 8px;

          .author-name {
            font-weight: 500;
            color: #475569;

            html.dark & {
              color: #cbd5e1;
            }
          }
        }

        .separator {
          color: #cbd5e1;
          margin: 0 8px;
          opacity: 0.5;

          html.dark & {
            color: #334155;
          }
        }

        .course-name,
        .post-time {
          color: #94a3b8;
        }

        .type-tag {
          margin-left: 8px;
          font-size: 10px;
          border-radius: 4px;
          opacity: 0.7;
          height: 18px;
          padding: 0 4px;
          line-height: 16px;
        }
      }
    }

    .action-btns {
      display: flex;
      justify-content: center;
      gap: 12px;

      .btn-icon-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        cursor: pointer;
        border-radius: 8px;
        transition: all 0.2s;
        background: transparent;
        color: #94a3b8;
        outline: none !important;
        box-shadow: none !important;

        html.dark & {
          color: #64748b;
        }

        &:hover {
          transform: translateY(-2px);
          background: #f1f5f9;
        }

        &.view:hover {
          background: #e0f2fe;
          color: #0ea5e9;
        }

        &.approve:hover {
          background: #f0fdf4;
          color: #22c55e;
        }

        &.reject:hover {
          background: #fef2f2;
          color: #ef4444;
        }

        &.pin:hover {
          background: #fef3c7;
          color: #f59e0b;
        }

        &.pin.is-active {
          background: #fef3c7;
          color: #f59e0b;
        }
      }
    }
  }

  .mobile-review-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .mobile-review-card {
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

  .mobile-review-card__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }

  .mobile-review-card__header-main,
  .mobile-review-card__header-tags {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .mobile-review-card__header-note {
    font-size: 13px;
    font-weight: 600;
    color: #64748b;

    html.dark & {
      color: #94a3b8;
    }
  }

  .mobile-review-card__wait {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 0;
    margin-top: 14px;
    border-top: 1px solid rgb(226 232 240 / 88%);
    border-bottom: 1px solid rgb(226 232 240 / 88%);

    html.dark & {
      border-color: #334155;
    }
  }

  .wait-label {
    font-size: 13px;
    color: #94a3b8;
  }

  .wait-value {
    font-size: 14px;
    font-weight: 700;
    color: #334155;

    html.dark & {
      color: #e2e8f0;
    }

    &.is-urgent {
      color: #ef4444;
    }
  }

  .mobile-review-card__actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 14px;
  }

  .mobile-review-card__actions :deep(.el-button) {
    width: 100%;
    min-height: 42px;
    margin-left: 0;
    font-weight: 600;
    border-radius: 14px;
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
}

@media (width <= 768px) {
  .review-queue {
    padding-bottom: calc(
      var(--pure-mobile-tab-height) + var(--pure-safe-area-bottom) + 28px
    );

    .review-stats-grid {
      grid-template-columns: 1fr;
      gap: 14px;
      margin-bottom: 20px;
    }

    .review-panel {
      :deep(.el-card__body) {
        padding: 18px;
      }
    }

    .review-panel__header,
    .review-toolbar {
      flex-direction: column;
      margin-bottom: 16px;
    }

    .review-panel__copy {
      h3 {
        font-size: 20px;
      }

      p {
        font-size: 13px;
      }
    }

    .review-panel__badge {
      width: 100%;
      white-space: normal;
    }

    .stat-card {
      .stat-content {
        align-items: flex-start;
        min-height: 110px;
        padding: 4px 0;
      }
    }

    .review-toolbar__actions {
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

    .search-form__actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      width: 100%;
    }

    .discussion-item-classic {
      gap: 8px;

      .item-title {
        font-size: 16px;
        line-height: 1.45;
      }

      .item-excerpt {
        font-size: 13px;
        line-height: 1.7;
      }

      .item-footer {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
        margin-top: 8px;
        text-align: left;

        .separator {
          display: none;
        }

        .author-box {
          justify-content: flex-start;
          width: 100%;
          margin-right: 0;
        }

        .course-name,
        .post-time {
          margin-right: 0;
          width: 100%;
          text-align: left;
        }

        .type-tag {
          margin-left: 0;
        }
      }
    }
  }
}

@media (width <= 420px) {
  .review-queue {
    .batch-actions,
    .search-form__actions,
    .mobile-review-card__actions {
      grid-template-columns: 1fr;
    }

    .mobile-review-card {
      padding: 16px;
      border-radius: 20px;
    }

    .mobile-review-card__header-note {
      font-size: 12px;
    }
  }
}

/* 全局弹窗简约化 */
:deep(.el-dialog) {
  border-radius: 12px !important;
  overflow: hidden;
}

/* 自定义确认框样式 */
:global(.custom-message-box) {
  padding-bottom: 8px !important;
  border: none !important;
  border-radius: 12px !important;
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1) !important;
}

:global(.custom-message-box .el-message-box__btns .el-button) {
  border-radius: 6px !important;
}

/* 按钮 R 角统一 */
.el-button {
  border-radius: 6px !important;
  box-shadow: none !important;
}

/* 彻底消除所有可能的阴影 bug */
:deep(*) {
  box-shadow: none !important;
}

/* 恢复弹窗和特定组件的阴影，否则没法看 */
:deep(.el-dialog),
:deep(.el-message-box),
:deep(.el-dropdown-menu) {
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2) !important;
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

/* 深色模式下的 MessageBox 自定义样式 */
:global(.dark) :global(.custom-message-box) {
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

/* 按钮点击波纹效果增强 */
.el-button {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 10px;

  &:not(.is-disabled):active {
    transform: scale(0.95);
  }
}
</style>
