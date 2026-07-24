<script setup lang="ts">
/**
 * 管理员端 - 用户信誉管理
 * 管理用户的发言信誉分，可以查看、调整信誉分
 */
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, type TagProps } from "element-plus";
import { usePageResponsive } from "@/utils/pageResponsive";
import { Search, Refresh, Edit } from "@element-plus/icons-vue";
import {
  getUserReputationList,
  updateUserReputation,
  type UserReputation
} from "@/api/discussion-admin";
import InfoIcon from "@/assets/commentareasrelatedsvgs/information-circle-svgrepo-com.svg?component";

defineOptions({
  name: "UserReputationManage"
});

const { isMobile, paginationLayout, getDialogWidth } = usePageResponsive();

const loading = ref(false);
const adjusting = ref(false);
const loadError = ref("");
const dataLoaded = ref(false);
const users = ref<UserReputation[]>([]);
const detailDialogVisible = ref(false);
const adjustDialogVisible = ref(false);
const currentUser = ref<UserReputation | null>(null);

const searchForm = reactive({
  keyword: "",
  level: "" as "" | "trusted" | "normal" | "restricted",
  sortBy: "score" as "score" | "postCount" | "replyCount" | "reportCount",
  sortOrder: "desc" as "asc" | "desc"
});

const adjustForm = reactive({
  reputationScore: 0,
  reason: ""
});

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
});

const stats = ref({
  trusted: 0,
  normal: 0,
  restricted: 0
});

const levelOptions = [
  { label: "信誉良好", value: "trusted" },
  { label: "信誉普通", value: "normal" },
  { label: "信誉受限", value: "restricted" }
];

const sortByOptions = [
  { label: "信誉分", value: "score" },
  { label: "发帖数", value: "postCount" },
  { label: "回复数", value: "replyCount" },
  { label: "被举报数", value: "reportCount" }
];

const activeFilterCount = computed(() => {
  let count = 0;

  if (searchForm.keyword.trim()) count += 1;
  if (searchForm.level) count += 1;
  if (searchForm.sortBy !== "score") count += 1;
  if (searchForm.sortOrder !== "desc") count += 1;

  return count;
});

const filterBadgeText = computed(() =>
  activeFilterCount.value > 0
    ? `已启用 ${activeFilterCount.value} 项筛选`
    : "当前展示默认信誉排序"
);

const listSummaryText = computed(() => {
  if (loadError.value) return "用户信誉数据加载失败";

  if (loading.value && pagination.total === 0) {
    return "正在同步用户信誉数据...";
  }

  if (pagination.total === 0) {
    return "暂无用户信誉记录";
  }

  return `共 ${pagination.total} 位用户，可查看详情或直接调整信誉分`;
});

const getScoreColor = (score: number) => {
  if (score >= 80) return "#67c23a";
  if (score >= 60) return "#409eff";
  if (score >= 40) return "#e6a23c";
  return "#f56c6c";
};

const getLevelType = (level: string) => {
  const map: Record<string, NonNullable<TagProps["type"]>> = {
    trusted: "success",
    normal: "primary",
    restricted: "warning"
  };
  return map[level] || "info";
};

const getLevelText = (level: string) => {
  const map: Record<string, string> = {
    trusted: "良好",
    normal: "普通",
    restricted: "受限"
  };
  return map[level] || level;
};

const getReportedText = (count: number) =>
  count > 0 ? `${count} 次举报` : "暂无举报";

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

let latestDataRequest = 0;

const fetchData = async () => {
  const requestId = ++latestDataRequest;
  loading.value = true;
  loadError.value = "";
  try {
    const params: Record<string, any> = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      sortBy: searchForm.sortBy,
      sortOrder: searchForm.sortOrder
    };

    if (searchForm.keyword) params.keyword = searchForm.keyword;
    if (searchForm.level) params.level = searchForm.level;

    const data = await getUserReputationList(params);
    if (requestId !== latestDataRequest) return;
    users.value = data.list;
    pagination.total = data.pagination.total;
    stats.value = data.stats;
    dataLoaded.value = true;
  } catch (error) {
    if (requestId !== latestDataRequest) return;
    console.error("加载用户信誉列表失败", error);
    users.value = [];
    pagination.total = 0;
    stats.value = { trusted: 0, normal: 0, restricted: 0 };
    dataLoaded.value = false;
    loadError.value = getErrorMessage(error, "加载用户信誉数据失败，请重试");
  } finally {
    if (requestId === latestDataRequest) loading.value = false;
  }
};

const handleSearch = () => {
  pagination.page = 1;
  fetchData();
};

const resetSearch = () => {
  searchForm.keyword = "";
  searchForm.level = "";
  searchForm.sortBy = "score";
  searchForm.sortOrder = "desc";
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

const refreshData = async () => {
  await fetchData();
};

const viewDetail = (row: UserReputation) => {
  currentUser.value = row;
  detailDialogVisible.value = true;
};

const openAdjustDialog = (row: UserReputation) => {
  currentUser.value = row;
  adjustForm.reputationScore = row.reputationScore;
  adjustForm.reason = "";
  adjustDialogVisible.value = true;
};

const submitAdjust = async () => {
  if (!currentUser.value) return;

  if (!adjustForm.reason.trim()) {
    ElMessage.warning("请输入调整原因");
    return;
  }
  if (adjusting.value) return;
  adjusting.value = true;

  try {
    await updateUserReputation(currentUser.value.userId.toString(), {
      reputationScore: adjustForm.reputationScore,
      reason: adjustForm.reason
    });
    ElMessage.success("操作成功");
    adjustDialogVisible.value = false;
    await fetchData();
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "操作失败"));
  } finally {
    adjusting.value = false;
  }
};

const formatTime = (dateStr: string) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
};

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div
    class="user-reputation-page p-4 max-[769px]:p-0"
    :class="{ 'user-reputation-page--mobile': isMobile }"
  >
    <el-card shadow="never" class="mb-4 reputation-panel">
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
        <el-form-item label="搜索用户">
          <el-input
            v-model="searchForm.keyword"
            placeholder="搜索昵称"
            clearable
            :style="{ width: isMobile ? '100%' : '220px' }"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="信誉等级">
          <el-select
            v-model="searchForm.level"
            placeholder="全部等级"
            clearable
            :style="{ width: isMobile ? '100%' : '160px' }"
          >
            <el-option
              v-for="opt in levelOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="排序字段">
          <el-select
            v-model="searchForm.sortBy"
            placeholder="排序字段"
            :style="{ width: isMobile ? '100%' : '160px' }"
          >
            <el-option
              v-for="opt in sortByOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="排序方向">
          <el-select
            v-model="searchForm.sortOrder"
            :style="{ width: isMobile ? '100%' : '140px' }"
          >
            <el-option label="降序" value="desc" />
            <el-option label="升序" value="asc" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">
            搜索
          </el-button>
          <el-button :icon="Refresh" @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="reputation-stats-grid mb-4">
      <div class="reputation-stats-grid__item">
        <el-card shadow="hover" class="status-card">
          <div class="status-card__content">
            <div class="status-card__label">良好用户</div>
            <div class="status-card__value text-success">
              {{ dataLoaded ? stats.trusted : "--" }}
            </div>
          </div>
        </el-card>
      </div>
      <div class="reputation-stats-grid__item">
        <el-card shadow="hover" class="status-card">
          <div class="status-card__content">
            <div class="status-card__label">普通用户</div>
            <div class="status-card__value text-primary">
              {{ dataLoaded ? stats.normal : "--" }}
            </div>
          </div>
        </el-card>
      </div>
      <div class="reputation-stats-grid__item">
        <el-card shadow="hover" class="status-card">
          <div class="status-card__content">
            <div class="status-card__label">受限用户</div>
            <div class="status-card__value text-warning">
              {{ dataLoaded ? stats.restricted : "--" }}
            </div>
          </div>
        </el-card>
      </div>
    </div>

    <el-card shadow="never" class="reputation-panel data-card">
      <div class="flex justify-between items-center mb-4">
        <span class="font-bold text-base">用户信誉管理</span>
        <div class="text-sm text-gray-500">{{ listSummaryText }}</div>
      </div>
      <div class="flex justify-end mb-4">
        <el-button
          :icon="Refresh"
          text
          :disabled="loading || adjusting"
          @click="refreshData"
        >
          同步数据
        </el-button>
      </div>

      <div v-if="loadError" class="load-error mb-4">
        <el-alert
          title="用户信誉数据加载失败"
          :description="loadError"
          type="error"
          show-icon
          :closable="false"
        />
        <el-button type="primary" plain :icon="Refresh" @click="fetchData">
          重试
        </el-button>
      </div>

      <div v-if="isMobile" v-loading="loading" class="mobile-user-list">
        <div v-for="row in users" :key="row.userId" class="mobile-user-card">
          <div class="mobile-user-card__header">
            <div class="mobile-user-card__identity">
              <el-avatar :size="48" :src="row.avatar" />
              <div class="mobile-user-card__identity-copy">
                <div class="mobile-user-card__name">{{ row.nickname }}</div>
                <div class="mobile-user-card__id">ID: {{ row.userId }}</div>
              </div>
            </div>
            <div
              class="mobile-user-card__score"
              :style="{ color: getScoreColor(row.reputationScore) }"
            >
              {{ row.reputationScore }}
            </div>
          </div>

          <div class="mobile-user-card__meta">
            <div class="mobile-user-card__meta-item">
              <span class="label">信誉等级</span>
              <el-tag :type="getLevelType(row.level)" size="small">
                {{ getLevelText(row.level) }}
              </el-tag>
            </div>
            <div class="mobile-user-card__meta-item">
              <span class="label">被举报</span>
              <span class="value">
                {{ getReportedText(row.reportedCount) }}
              </span>
            </div>
            <div class="mobile-user-card__meta-item">
              <span class="label">发帖数</span>
              <span class="value">{{ row.postCount }}</span>
            </div>
            <div class="mobile-user-card__meta-item">
              <span class="label">回复数</span>
              <span class="value">{{ row.replyCount }}</span>
            </div>
            <div
              class="mobile-user-card__meta-item mobile-user-card__meta-item--full"
            >
              <span class="label">最后活跃</span>
              <span class="value">{{ formatTime(row.lastActiveAt) }}</span>
            </div>
          </div>

          <div class="mobile-user-card__actions">
            <el-button plain @click="viewDetail(row)">详情</el-button>
            <el-button
              type="primary"
              plain
              :disabled="adjusting"
              @click="openAdjustDialog(row)"
            >
              调整
            </el-button>
          </div>
        </div>

        <el-empty
          v-if="!loading && !loadError && users.length === 0"
          description="暂无用户信誉记录"
        />
      </div>

      <el-table
        v-else
        v-loading="loading"
        :data="users"
        :empty-text="loadError ? '数据加载失败' : '暂无用户信誉记录'"
        stripe
        class="reputation-table"
      >
        <el-table-column label="用户" min-width="220">
          <template #default="{ row }">
            <div class="table-user">
              <el-avatar :size="60" :src="row.avatar" />
              <div>
                <div class="table-user__name">{{ row.nickname }}</div>
                <div class="table-user__id">ID: {{ row.userId }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="信誉分" width="130" align="center">
          <template #default="{ row }">
            <div class="table-score">
              <div class="table-score__circle">
                <el-progress
                  type="circle"
                  :percentage="row.reputationScore"
                  :width="64"
                  :stroke-width="6"
                  :show-text="false"
                  :color="getScoreColor(row.reputationScore)"
                />
                <span
                  class="table-score__value"
                  :style="{ color: getScoreColor(row.reputationScore) }"
                >
                  {{ row.reputationScore }}
                </span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="等级" width="130" align="center">
          <template #default="{ row }">
            <el-tag
              :type="getLevelType(row.level)"
              size="large"
              class="reputation-tag"
            >
              {{ getLevelText(row.level) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发帖数" width="110" align="center">
          <template #default="{ row }">
            <span class="table-number">{{ row.postCount }}</span>
          </template>
        </el-table-column>
        <el-table-column label="回复数" width="110" align="center">
          <template #default="{ row }">
            <span class="table-number">{{ row.replyCount }}</span>
          </template>
        </el-table-column>
        <el-table-column label="被举报" width="120" align="center">
          <template #default="{ row }">
            <el-badge
              :value="row.reportedCount"
              :type="row.reportedCount > 0 ? 'warning' : 'info'"
              :max="999"
              class="large-badge"
            />
          </template>
        </el-table-column>
        <el-table-column label="最后活跃" width="180" align="center">
          <template #default="{ row }">
            <span class="table-time">{{ formatTime(row.lastActiveAt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" align="center" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button
                link
                type="primary"
                :size="'default'"
                :icon="InfoIcon"
                class="text-[22px] !m-0"
                @click="viewDetail(row)"
              >
                详情
              </el-button>
              <el-button
                link
                type="primary"
                :size="'default'"
                :icon="Edit"
                class="text-[22px] !m-0"
                @click="openAdjustDialog(row)"
              >
                调整
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="!loadError" class="pagination-bar">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[20, 50, 100]"
          :layout="paginationLayout"
          :size="isMobile ? 'small' : 'default'"
          class="large-pagination"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="detailDialogVisible"
      title="用户信誉详情"
      :width="getDialogWidth('600px')"
      destroy-on-close
    >
      <div v-if="currentUser" class="user-detail">
        <div class="user-detail__hero">
          <div class="user-detail__identity">
            <el-avatar :size="64" :src="currentUser.avatar" />
            <div>
              <div class="user-detail__name">{{ currentUser.nickname }}</div>
              <div class="user-detail__id">
                用户 ID: {{ currentUser.userId }}
              </div>
            </div>
          </div>
          <div class="user-detail__score">
            <el-progress
              type="dashboard"
              :percentage="currentUser.reputationScore"
              :width="100"
              :color="getScoreColor(currentUser.reputationScore)"
            />
            <div class="user-detail__score-label">信誉分</div>
          </div>
        </div>

        <div class="user-detail__stats">
          <div class="detail-stat-item">
            <div class="detail-stat-item__value">
              {{ currentUser.postCount }}
            </div>
            <div class="detail-stat-item__label">总发帖数</div>
          </div>
          <div class="detail-stat-item">
            <div class="detail-stat-item__value">
              {{ currentUser.replyCount }}
            </div>
            <div class="detail-stat-item__label">总回复数</div>
          </div>
          <div class="detail-stat-item">
            <div class="detail-stat-item__value text-warning">
              {{ currentUser.reportedCount }}
            </div>
            <div class="detail-stat-item__label">被举报次数</div>
          </div>
        </div>

        <div class="user-detail__info">
          <div class="user-detail__info-row">
            <span class="label">信誉等级</span>
            <el-tag :type="getLevelType(currentUser.level)" size="default">
              {{ getLevelText(currentUser.level) }}
            </el-tag>
          </div>
          <div class="user-detail__info-row">
            <span class="label">最后活跃</span>
            <span class="value">
              {{ formatTime(currentUser.lastActiveAt) }}
            </span>
          </div>
        </div>
      </div>

      <template #footer>
        <div
          class="dialog-footer"
          :class="{ 'dialog-footer--mobile': isMobile }"
        >
          <el-button @click="detailDialogVisible = false">关闭</el-button>
          <el-button
            type="primary"
            @click="
              detailDialogVisible = false;
              openAdjustDialog(currentUser!);
            "
          >
            调整信誉
          </el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="adjustDialogVisible"
      title="调整用户信誉"
      :width="getDialogWidth('500px')"
      destroy-on-close
    >
      <div v-if="currentUser" class="adjust-form">
        <div class="adjust-form__user">
          <el-avatar :size="40" :src="currentUser.avatar" />
          <div>
            <div class="adjust-form__name">{{ currentUser.nickname }}</div>
            <div class="adjust-form__score">
              当前信誉分：{{ currentUser.reputationScore }}
            </div>
          </div>
        </div>

        <el-form
          :model="adjustForm"
          :label-position="isMobile ? 'top' : 'right'"
          :label-width="isMobile ? undefined : '100px'"
        >
          <el-form-item label="信誉分" required>
            <el-input-number
              v-model="adjustForm.reputationScore"
              :min="0"
              :max="100"
              :style="{ width: isMobile ? '100%' : '200px' }"
            />
            <div class="adjust-form__hint">设置范围：0 - 100</div>
          </el-form-item>
          <el-form-item label="原因" required>
            <el-input
              v-model="adjustForm.reason"
              type="textarea"
              :rows="3"
              placeholder="请输入调整原因"
            />
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <div
          class="dialog-footer"
          :class="{ 'dialog-footer--mobile': isMobile }"
        >
          <el-button @click="adjustDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="adjusting" @click="submitAdjust">
            确认
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.user-reputation-page {
  .load-error {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    min-width: 0;
  }

  .reputation-stats-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }

  .reputation-stats-grid__item {
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

  .reputation-panel {
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

  .reputation-panel__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
  }

  .reputation-panel__header--compact {
    margin-bottom: 16px;
  }

  .reputation-panel__copy {
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

  .reputation-panel__eyebrow {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #6366f1;
    text-transform: uppercase;
  }

  .reputation-panel__badge {
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

  .search-form__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    width: 100%;
  }

  .search-form__actions :deep(.el-button),
  .sync-status-btn {
    min-height: 44px;
    margin-left: 0;
    padding-inline: 18px;
    font-weight: 600;
    border-radius: 14px;
  }

  .status-card {
    border: 1px solid rgb(226 232 240 / 92%);
    border-radius: 24px;
    background: linear-gradient(180deg, #fff 0%, #f8fbff 100%);

    html.dark & {
      border-color: #334155;
      background: linear-gradient(180deg, #1f2937 0%, #111827 100%);
    }
  }

  .status-card__content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 120px;
    padding: 16px 18px;
  }

  .status-card__label {
    font-size: 16px;
    font-weight: 600;
    color: #64748b;

    html.dark & {
      color: #94a3b8;
    }
  }

  .status-card__value {
    font-size: 36px;
    font-weight: 800;
    line-height: 1;
  }

  .mobile-user-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .mobile-user-card {
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

  .mobile-user-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .mobile-user-card__identity {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .mobile-user-card__identity-copy {
    min-width: 0;
  }

  .mobile-user-card__name {
    font-size: 16px;
    font-weight: 700;
    color: #1e293b;
    word-break: break-word;

    html.dark & {
      color: #f8fafc;
    }
  }

  .mobile-user-card__id {
    margin-top: 4px;
    font-size: 12px;
    color: #94a3b8;
  }

  .mobile-user-card__score {
    font-size: 30px;
    font-weight: 800;
    line-height: 1;
    flex-shrink: 0;
  }

  .mobile-user-card__meta {
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

  .mobile-user-card__meta-item {
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

  .mobile-user-card__actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 16px;
  }

  .mobile-user-card__actions :deep(.el-button) {
    width: 100%;
    min-height: 42px;
    margin-left: 0;
    font-weight: 600;
    border-radius: 14px;
  }

  .reputation-table {
    :deep(.el-table__header-wrapper) {
      th {
        font-size: 16px;
        font-weight: bold;
        color: #333;
        background-color: #f8f9fb;
      }
    }

    :deep(.el-table__body-wrapper) {
      td {
        font-size: 16px;
        padding: 16px 0;
      }
    }
  }

  .table-user {
    display: flex;
    align-items: center;
    gap: 16px;
    min-height: 72px;
  }

  .table-user__name {
    font-size: 18px;
    font-weight: 700;
    line-height: 1.2;
  }

  .table-user__id {
    margin-top: 6px;
    font-size: 14px;
    color: #94a3b8;
  }

  .table-score {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 72px;
  }

  .table-score__circle {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
  }

  .table-score__value {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 700;
  }

  .reputation-tag {
    font-size: 15px;
    padding: 12px 16px;
    height: auto;
  }

  .table-number {
    font-size: 18px;
    font-weight: 500;
  }

  .table-time {
    font-size: 16px;
    color: #64748b;
  }

  .table-actions {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    min-height: 72px;
  }

  .large-badge {
    :deep(.el-badge__content) {
      font-size: 15px;
      height: 24px;
      line-height: 24px;
      padding: 0 10px;
      border-radius: 12px;
    }
  }

  .large-pagination {
    :deep(.btn-prev),
    :deep(.btn-next),
    :deep(.el-pager li),
    :deep(.el-pagination__total),
    :deep(.el-pagination__sizes .el-input__wrapper) {
      font-size: 15px;
      height: 36px;
      line-height: 36px;
      min-width: 36px;
    }

    :deep(.el-select__wrapper) {
      font-size: 15px;
      height: 36px;
    }
  }

  .pagination-bar {
    display: flex;
    justify-content: flex-end;
    margin-top: 24px;
  }

  .user-detail__hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 24px;
  }

  .user-detail__identity {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .user-detail__name {
    font-size: 18px;
    font-weight: 700;
    color: #1e293b;
  }

  .user-detail__id {
    margin-top: 6px;
    font-size: 14px;
    color: #94a3b8;
  }

  .user-detail__score {
    text-align: center;
  }

  .user-detail__score-label {
    margin-top: 8px;
    font-size: 13px;
    color: #94a3b8;
  }

  .user-detail__stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }

  .detail-stat-item {
    padding: 16px;
    text-align: center;
    background: #f5f7fa;
    border-radius: 12px;

    html.dark & {
      background: rgb(148 163 184 / 12%);
    }
  }

  .detail-stat-item__value {
    font-size: 24px;
    font-weight: 700;
    color: #303133;
  }

  .detail-stat-item__label {
    margin-top: 6px;
    font-size: 14px;
    color: #909399;
  }

  .user-detail__info {
    padding: 16px;
    background: #f8fafc;
    border-radius: 12px;

    html.dark & {
      background: rgb(148 163 184 / 10%);
    }
  }

  .user-detail__info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;

    &:not(:last-child) {
      margin-bottom: 12px;
    }

    .label {
      color: #64748b;
    }

    .value {
      color: #334155;
    }
  }

  .adjust-form__user {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding: 14px;
    background: #f8fafc;
    border-radius: 12px;

    html.dark & {
      background: rgb(148 163 184 / 10%);
    }
  }

  .adjust-form__name {
    font-weight: 700;
    color: #1e293b;
  }

  .adjust-form__score {
    margin-top: 4px;
    font-size: 13px;
    color: #64748b;
  }

  .adjust-form__hint {
    margin-top: 6px;
    font-size: 12px;
    color: #94a3b8;
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
}

@media (width <= 768px) {
  .user-reputation-page {
    padding-bottom: calc(
      var(--pure-mobile-tab-height) + var(--pure-safe-area-bottom) + 28px
    );

    .reputation-panel {
      border-radius: 24px;

      :deep(.el-card__body) {
        padding: 18px;
      }
    }

    .reputation-panel__header {
      flex-direction: column;
      margin-bottom: 16px;
    }

    .reputation-panel__copy {
      h3 {
        font-size: 20px;
      }

      p {
        font-size: 13px;
      }
    }

    .reputation-panel__badge {
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

    .search-form__actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .status-card__content {
      flex-direction: column;
      justify-content: center;
      gap: 12px;
      min-height: 132px;
      text-align: center;
    }

    .pagination-bar {
      justify-content: center;
    }

    .user-detail__hero {
      flex-direction: column;
      align-items: flex-start;
    }

    .user-detail__stats {
      grid-template-columns: 1fr;
    }

    .dialog-footer {
      flex-direction: column;
    }

    .dialog-footer--mobile :deep(.el-button) {
      width: 100%;
      margin-left: 0;
    }
  }
}

@media (width <= 420px) {
  .user-reputation-page {
    .reputation-stats-grid,
    .mobile-user-card__meta,
    .search-form__actions,
    .mobile-user-card__actions {
      grid-template-columns: 1fr;
    }

    .mobile-user-card {
      padding: 16px;
      border-radius: 20px;
    }

    .mobile-user-card__header {
      align-items: flex-start;
    }
  }
}
</style>
