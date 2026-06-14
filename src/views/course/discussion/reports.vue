<script setup lang="ts">
/**
 * 教师端 - 举报处理
 * 教师可以处理所授课程中被举报的内容
 */
import { computed, reactive, ref, onActivated, watch } from "vue";
import { useRoute } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { usePageResponsive } from "@/utils/pageResponsive";
import {
  Search,
  Refresh,
  Check,
  Close,
  MoreFilled
} from "@element-plus/icons-vue";
import {
  getReportList,
  getReportStatistics,
  handleReport,
  type ReportItem,
  type ReportStatus
} from "@/api/discussion-admin";
import InfoIcon from "@/assets/commentareasrelatedsvgs/information-circle-svgrepo-com.svg?component";

defineOptions({
  name: "TeacherReportManage"
});

const { isMobile, paginationLayout, getDialogWidth } = usePageResponsive();

type TagType = "warning" | "success" | "info" | "primary" | "danger";

const loading = ref(false);
const reports = ref<ReportItem[]>([]);
const detailDialogVisible = ref(false);
const handleDialogVisible = ref(false);
const currentReport = ref<ReportItem | null>(null);

const stats = ref({
  pending: 0,
  resolvedToday: 0,
  totalReports: 0
});

const searchForm = reactive({
  status: "pending" as ReportStatus | ""
});

const handleForm = reactive({
  action: "reject" as "accept" | "reject",
  note: ""
});

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
});

const statusOptions = [
  { label: "待处理", value: "pending" },
  { label: "已报送", value: "accepted" },
  { label: "已驳回", value: "rejected" }
];

const actionOptions = [
  { label: "驳回举报（内容无问题）", value: "reject" },
  { label: "接受举报（内容受处理）", value: "accept" }
];

const getReasonText = (reason: string): string => {
  const map: Record<string, string> = {
    spam: "垃圾广告",
    inappropriate: "不当内容",
    harassment: "骚扰攻击",
    misinformation: "虚假信息",
    copyright: "侵权内容",
    other: "其他原因"
  };
  return map[reason] || reason || "未知原因";
};

const getStatusTagType = (status: ReportStatus): TagType => {
  const map: Record<string, TagType> = {
    pending: "warning",
    accepted: "success",
    rejected: "info"
  };
  return map[status] || "info";
};

const getStatusText = (status: ReportStatus): string => {
  const map: Record<string, string> = {
    pending: "待处理",
    accepted: "已接受",
    rejected: "已驳回"
  };
  return map[status] || status;
};

const getTargetTypeText = (targetType: ReportItem["targetType"]) =>
  targetType === "post" ? "帖子" : "回复";

const getContentPreview = (content: string, limit = 92) => {
  if (!content) return "-";
  return content.length > limit ? `${content.slice(0, limit)}...` : content;
};

const filterBadgeText = computed(() => {
  if (!searchForm.status) {
    return "当前展示全部举报";
  }

  return `当前筛选：${getStatusText(searchForm.status as ReportStatus)}`;
});

const listSummaryText = computed(() => {
  if (loading.value && pagination.total === 0) {
    return "正在同步举报记录...";
  }

  if (pagination.total === 0) {
    return "暂无举报记录";
  }

  if (searchForm.status) {
    return `共 ${pagination.total} 条${getStatusText(searchForm.status as ReportStatus)}举报`;
  }

  return `共 ${pagination.total} 条举报记录`;
});

const normalizeFilteredReports = (
  list: ReportItem[],
  status: ReportStatus | ""
) => {
  if (!status) return list;
  return list.filter(item => item.status === status);
};

const fetchData = async () => {
  loading.value = true;
  try {
    const params: {
      pageNum: number;
      pageSize: number;
      status?: ReportItem["status"];
    } = {
      pageNum: pagination.page,
      pageSize: pagination.pageSize
    };

    if (searchForm.status) params.status = searchForm.status;

    const res = await getReportList(params);
    const rawList = res.list || [];
    const filteredList = normalizeFilteredReports(rawList, searchForm.status);
    reports.value = filteredList;
    pagination.total =
      searchForm.status && filteredList.length !== rawList.length
        ? filteredList.length
        : res.total || filteredList.length;
  } catch (error) {
    console.error("加载举报列表失败", error);
    reports.value = [];
    pagination.total = 0;
  } finally {
    loading.value = false;
  }
};

const fetchStats = async () => {
  try {
    const data = await getReportStatistics();
    stats.value = {
      pending: Number(data.pendingReports || 0),
      resolvedToday: Number(data.resolvedToday || 0),
      totalReports: Number(data.totalReports || 0)
    };
  } catch (error) {
    console.error("加载举报统计失败", error);
  }
};

const handleSearch = () => {
  pagination.page = 1;
  fetchData();
};

const resetSearch = () => {
  searchForm.status = "pending";
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

const viewDetail = (row: ReportItem) => {
  currentReport.value = row;
  detailDialogVisible.value = true;
};

const openHandleDialog = (row: ReportItem) => {
  currentReport.value = row;
  handleForm.action = "reject";
  handleForm.note = "";
  handleDialogVisible.value = true;
};

const quickDismiss = async (row: ReportItem) => {
  try {
    await ElMessageBox.confirm("确定要驳回这条举报吗？", "提示", {
      type: "info",
      customClass: "custom-message-box",
      draggable: true
    });
    await handleReport(row.reportId, { action: "reject", note: "内容无问题" });
    ElMessage.success("已驳回");
    await Promise.all([fetchStats(), fetchData()]);
  } catch (error: any) {
    if (error !== "cancel") {
      ElMessage.error("操作失败");
    }
  }
};

const quickDelete = async (row: ReportItem) => {
  try {
    await ElMessageBox.confirm("确定要接受这条举报吗？", "警告", {
      type: "warning",
      customClass: "custom-message-box",
      draggable: true
    });
    await handleReport(row.reportId, { action: "accept", note: "内容违规" });
    ElMessage.success("已接受");
    await Promise.all([fetchStats(), fetchData()]);
  } catch (error: any) {
    if (error !== "cancel") {
      ElMessage.error("操作失败");
    }
  }
};

const submitHandle = async () => {
  if (!currentReport.value) return;

  try {
    await handleReport(currentReport.value.reportId, {
      action: handleForm.action,
      note: handleForm.note
    });

    ElMessage.success("处理成功");
    handleDialogVisible.value = false;
    await Promise.all([fetchStats(), fetchData()]);
  } catch (error) {
    ElMessage.error("处理失败");
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

const dataLoaded = ref(false);

const initData = async () => {
  if (loading.value || dataLoaded.value) return;

  await Promise.all([fetchStats(), fetchData()]);
  dataLoaded.value = true;
};

const refreshData = async () => {
  dataLoaded.value = false;
  await Promise.all([fetchStats(), fetchData()]);
  dataLoaded.value = true;
};

const route = useRoute();

watch(
  () => route.name,
  newName => {
    if (newName && !dataLoaded.value) {
      initData();
    }
  },
  { immediate: true }
);

onActivated(() => {
  dataLoaded.value = false;
  initData();
});
</script>

<template>
  <div class="report-manage p-4" :class="{ 'report-manage--mobile': isMobile }">
    <div class="report-stats-grid mb-4">
      <div class="report-stats-grid__item">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-number text-warning">{{ stats.pending }}</div>
            <div class="stat-label">待处理</div>
          </div>
        </el-card>
      </div>
      <div class="report-stats-grid__item">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-number text-success">
              {{ stats.resolvedToday }}
            </div>
            <div class="stat-label">今日已处理</div>
          </div>
        </el-card>
      </div>
      <div class="report-stats-grid__item">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <div class="stat-number text-info">{{ stats.totalReports }}</div>
            <div class="stat-label">累计举报</div>
          </div>
        </el-card>
      </div>
    </div>

    <el-card shadow="never" class="mb-4 report-panel">
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
        <el-form-item label="状态">
          <el-select
            v-model="searchForm.status"
            placeholder="全部状态"
            clearable
            :style="{ width: isMobile ? '100%' : '180px' }"
          >
            <el-option
              v-for="opt in statusOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
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

    <el-card shadow="never" class="report-panel data-card">
      <div class="flex justify-between items-center mb-4">
        <span class="font-bold text-base">举报处理</span>
        <div class="text-sm text-gray-500">{{ listSummaryText }}</div>
      </div>
      <div class="flex justify-end mb-4">
        <el-button :icon="Refresh" text @click="refreshData">
          同步数据
        </el-button>
      </div>

      <div v-if="isMobile" v-loading="loading" class="mobile-report-list">
        <div
          v-for="row in reports"
          :key="row.reportId"
          class="mobile-report-card"
        >
          <div class="mobile-report-card__header">
            <div class="mobile-report-card__header-tags">
              <el-tag effect="plain" round size="small">
                {{ getTargetTypeText(row.targetType) }}
              </el-tag>
              <el-tag type="danger" effect="plain" round size="small">
                {{ getReasonText(row.reason) }}
              </el-tag>
            </div>
            <el-tag
              :type="getStatusTagType(row.status)"
              effect="dark"
              size="small"
            >
              {{ getStatusText(row.status) }}
            </el-tag>
          </div>

          <div class="mobile-report-card__content">
            {{ getContentPreview(row.targetContent) }}
          </div>

          <div class="mobile-report-card__meta">
            <div class="mobile-report-card__meta-item">
              <span class="label">举报人</span>
              <span class="value">{{ row.reporterName || "-" }}</span>
            </div>
            <div class="mobile-report-card__meta-item">
              <span class="label">举报时间</span>
              <span class="value">{{ formatTime(row.createTime) }}</span>
            </div>
            <div
              class="mobile-report-card__meta-item mobile-report-card__meta-item--full"
            >
              <span class="label">举报说明</span>
              <span class="value">{{ row.description || "无补充说明" }}</span>
            </div>
          </div>

          <div class="mobile-report-card__actions">
            <el-button plain @click="viewDetail(row)">查看详情</el-button>
            <template v-if="row.status === 'pending'">
              <el-button type="success" plain @click="quickDelete(row)">
                接受举报
              </el-button>
              <el-button type="danger" plain @click="quickDismiss(row)">
                驳回举报
              </el-button>
              <el-button type="warning" plain @click="openHandleDialog(row)">
                更多处理
              </el-button>
            </template>
          </div>
        </div>

        <el-empty
          v-if="!loading && reports.length === 0"
          description="暂无举报记录"
        />
      </div>

      <el-table v-else v-loading="loading" :data="reports" stripe>
        <el-table-column label="被举报内容" min-width="300">
          <template #default="{ row }">
            <div class="report-content">
              <el-tag size="small" class="mb-1">
                {{ getTargetTypeText(row.targetType) }}
              </el-tag>
              <div class="content-text text-sm mt-1">
                {{ getContentPreview(row.targetContent, 100) }}
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="举报原因" width="120" align="center">
          <template #default="{ row }">
            <el-tag type="danger" size="small">
              {{ getReasonText(row.reason) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="举报人" width="120">
          <template #default="{ row }">
            <div class="flex items-center gap-2">
              <span class="text-sm">{{ row.reporterName }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="举报时间" width="160" align="center">
          <template #default="{ row }">
            <span class="text-sm text-gray-500">
              {{ formatTime(row.createTime) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" align="center" fixed="right">
          <template #default="{ row }">
            <div class="action-btns">
              <el-tooltip content="查看详情" placement="top">
                <el-button
                  link
                  type="primary"
                  size="large"
                  :icon="InfoIcon"
                  @click="viewDetail(row)"
                />
              </el-tooltip>
              <template v-if="row.status === 'pending'">
                <el-tooltip content="接受举报" placement="top">
                  <el-button
                    link
                    type="success"
                    size="large"
                    :icon="Check"
                    @click="quickDelete(row)"
                  />
                </el-tooltip>
                <el-tooltip content="驳回举报" placement="top">
                  <el-button
                    link
                    type="danger"
                    size="large"
                    :icon="Close"
                    @click="quickDismiss(row)"
                  />
                </el-tooltip>
                <el-tooltip content="更多处理" placement="top">
                  <el-button
                    link
                    type="warning"
                    size="large"
                    :icon="MoreFilled"
                    @click="openHandleDialog(row)"
                  />
                </el-tooltip>
              </template>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-bar">
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

    <el-dialog
      v-model="detailDialogVisible"
      title="举报详情"
      :width="getDialogWidth('600px')"
      destroy-on-close
    >
      <div v-if="currentReport" class="report-detail">
        <el-descriptions :column="isMobile ? 1 : 2" border>
          <el-descriptions-item label="举报类型">
            {{ getTargetTypeText(currentReport.targetType) }}
          </el-descriptions-item>
          <el-descriptions-item label="举报原因">
            <el-tag type="danger" size="small">
              {{ getReasonText(currentReport.reason) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="举报人">
            {{ currentReport.reporterName }}
          </el-descriptions-item>
          <el-descriptions-item label="举报时间" :span="isMobile ? 1 : 2">
            {{ formatTime(currentReport.createTime) }}
          </el-descriptions-item>
          <el-descriptions-item label="举报说明" :span="isMobile ? 1 : 2">
            {{ currentReport.description || "无" }}
          </el-descriptions-item>
        </el-descriptions>

        <el-divider>被举报内容</el-divider>

        <div class="reported-content p-4 bg-gray-50 rounded">
          <div class="content-text">
            {{ currentReport.targetContent }}
          </div>
        </div>

        <template v-if="currentReport.status !== 'pending'">
          <el-divider>处理结果</el-divider>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="处理状态">
              <el-tag
                :type="getStatusTagType(currentReport.status)"
                size="small"
              >
                {{ getStatusText(currentReport.status) }}
              </el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </template>
      </div>

      <template #footer>
        <div
          class="dialog-footer"
          :class="{ 'dialog-footer--mobile': isMobile }"
        >
          <div v-if="currentReport?.status === 'pending'">
            <el-button
              type="success"
              @click="
                quickDelete(currentReport!);
                detailDialogVisible = false;
              "
            >
              接受举报
            </el-button>
            <el-button
              type="danger"
              @click="
                quickDismiss(currentReport!);
                detailDialogVisible = false;
              "
            >
              驳回举报
            </el-button>
          </div>
          <el-button @click="detailDialogVisible = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="handleDialogVisible"
      title="处理举报"
      :width="getDialogWidth('500px')"
      destroy-on-close
    >
      <el-form
        :model="handleForm"
        :label-position="isMobile ? 'top' : 'right'"
        :label-width="isMobile ? undefined : '100px'"
      >
        <el-form-item label="处理方式" required>
          <el-radio-group
            v-model="handleForm.action"
            class="handle-action-group"
          >
            <el-radio
              v-for="opt in actionOptions"
              :key="opt.value"
              :label="opt.value"
            >
              {{ opt.label }}
            </el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="处理备注">
          <el-input
            v-model="handleForm.note"
            type="textarea"
            :rows="3"
            placeholder="请输入处理备注（选填）"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="handleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitHandle">确认处理</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.report-manage {
  font-size: 16px;

  .report-stats-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }

  .report-stats-grid__item {
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
    font-size: 16px;

    .el-table__header {
      font-size: 17px;
      font-weight: bold;
    }

    .el-table__row {
      height: 80px;
    }
  }

  .report-panel {
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

  .report-panel__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
  }

  .report-panel__header--compact {
    margin-bottom: 16px;
  }

  .report-panel__copy {
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

  .report-panel__eyebrow {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #6366f1;
    text-transform: uppercase;
  }

  .report-panel__badge {
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
        margin-bottom: 8px;

        &.text-warning {
          color: #f59e0b;
        }

        &.text-success {
          color: #10b981;
        }

        &.text-info {
          color: #3b82f6;
        }
      }

      .stat-label {
        font-size: 14px;
        font-weight: 500;
        color: #64748b;
        white-space: nowrap;

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

  .pagination-bar {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }

  .mobile-report-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .mobile-report-card {
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

  .mobile-report-card__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .mobile-report-card__header-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .mobile-report-card__content {
    margin-top: 14px;
    font-size: 14px;
    line-height: 1.75;
    color: #334155;

    html.dark & {
      color: #e2e8f0;
    }
  }

  .mobile-report-card__meta {
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

  .mobile-report-card__meta-item {
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

  .mobile-report-card__actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 16px;
  }

  .mobile-report-card__actions :deep(.el-button) {
    width: 100%;
    min-height: 42px;
    margin-left: 0;
    font-weight: 600;
    border-radius: 14px;
  }

  .report-content {
    .content-text {
      line-height: 1.7;
      color: #334155;

      html.dark & {
        color: #e2e8f0;
      }
    }
  }

  .action-btns {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;

    :deep(.el-button) {
      font-size: 20px;
      padding: 8px;
    }
  }

  .dialog-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .handle-action-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
}

@media (width <= 768px) {
  .report-manage {
    padding-bottom: calc(
      var(--pure-mobile-tab-height) + var(--pure-safe-area-bottom) + 28px
    );

    .report-stats-grid {
      gap: 12px;
    }

    .report-panel {
      border-radius: 24px;

      :deep(.el-card__body) {
        padding: 18px;
      }
    }

    .report-panel__header {
      flex-direction: column;
      margin-bottom: 16px;
    }

    .report-panel__copy {
      h3 {
        font-size: 20px;
      }

      p {
        font-size: 13px;
      }
    }

    .report-panel__badge {
      width: 100%;
      white-space: normal;
    }

    .stat-card {
      .stat-content {
        min-height: 110px;
        padding: 10px 8px;
      }
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

    .pagination-bar {
      justify-content: center;
    }

    .dialog-footer {
      flex-direction: column;
      align-items: stretch;
    }

    .dialog-footer > div {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
  }
}

@media (width <= 420px) {
  .report-manage {
    .report-stats-grid {
      grid-template-columns: 1fr;
    }

    .mobile-report-card {
      padding: 16px;
      border-radius: 20px;
    }

    .mobile-report-card__meta,
    .search-form__actions,
    .mobile-report-card__actions {
      grid-template-columns: 1fr;
    }
  }
}

.el-button {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 10px;

  &:not(.is-disabled):active {
    transform: scale(0.95);
  }
}
</style>
