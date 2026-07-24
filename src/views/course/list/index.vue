<template>
  <div class="main course-list-page p-4">
    <!-- 统计概览 -->
    <CourseStats :stats="courseStats" @date-change="handleStatsDateChange" />

    <el-card
      shadow="always"
      class="mb-4 search-card"
      :style="{ boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)' }"
    >
      <div
        class="search-toolbar flex justify-between items-center flex-wrap gap-4"
      >
        <el-form
          :inline="!isMobile"
          :model="searchForm"
          class="search-form !mb-[-18px]"
        >
          <el-form-item label="课程名称">
            <el-input
              v-model="searchForm.courseName"
              placeholder="请输入课程名称"
              clearable
              class="search-input"
              @keyup.enter="handleSearch"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
          </el-form-item>
          <el-form-item class="search-form__actions">
            <el-button type="primary" @click="handleSearch">搜索</el-button>
            <el-button @click="resetSearch">重置</el-button>
            <el-button
              type="success"
              :disabled="selectedCourseIds.length !== 1"
              @click="handleEditSelected"
              >编辑课程</el-button
            >
            <el-button
              v-if="isAdminUser"
              type="danger"
              :disabled="selectedCourseIds.length === 0"
              @click="handleBatchDelete"
              >删除课程</el-button
            >
          </el-form-item>
        </el-form>

        <div class="course-action-buttons">
          <el-button
            v-if="canBulkImportCourses"
            :icon="FolderOpened"
            class="bulk-import-btn"
            @click="openBulkCourseUpload"
          >
            一键上传课程
          </el-button>
          <el-button
            type="primary"
            :icon="Plus"
            class="create-course-btn"
            @click="openCreateDialog"
          >
            创建课程
          </el-button>
        </div>
      </div>
    </el-card>

    <div v-loading="loading">
      <div v-if="courseList.length > 0">
        <el-row :gutter="20">
          <el-col
            v-for="course in courseList"
            :key="course.courseId"
            :xs="24"
            :sm="12"
            :md="8"
            :lg="6"
            class="mb-5"
          >
            <CourseCard
              :course="course"
              :is-selected="selectedCourseIds.includes(course.courseId)"
              :can-delete="canDeleteCourse(course)"
              :can-rebuild="isAdminUser && !isCourseRebuildAdmissionDisabled"
              :is-rebuilding="rebuildStartingCourseId === course.courseId"
              @toggle-select="toggleCourseSelection"
              @edit="editCourse"
              @delete="confirmDelete"
              @view-hours="viewHours"
              @view-attrs="viewAttrs"
              @allocation="showAllocationDialog"
              @study-status="showStudyStatusDialog"
              @rebuild="confirmCourseRebuild"
            />
          </el-col>
        </el-row>

        <div class="pagination-container flex justify-end mt-4">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[12, 24, 36, 48]"
            :layout="paginationLayout"
            :size="isMobile ? 'small' : 'default'"
            :total="total"
            class="course-pagination"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>
      </div>
      <el-empty v-else description="暂无课程数据" />
    </div>

    <!-- 课程详情弹窗 -->

    <el-dialog v-model="detailDialogVisible" title="课程详情" width="70%">
      <div v-loading="detailLoading">
        <div v-if="!detailLoading && !courseDetail" class="empty-state">
          未找到课程信息或加载失败
        </div>
        <div v-else class="course-detail">
          <div class="course-header">
            <div class="course-thumb">
              <el-image
                style="width: 200px; height: 120px"
                :src="courseDetail?.thumbUrl"
                fit="cover"
                :preview-src-list="
                  courseDetail?.thumbUrl ? [courseDetail.thumbUrl] : []
                "
                :initial-index="0"
                teleported
                preview-teleported
              >
                <template #error>
                  <div class="image-placeholder">无图片</div>
                </template>
              </el-image>
            </div>
            <div class="course-info">
              <h2>{{ courseDetail?.title }}</h2>
              <p class="course-desc">{{ courseDetail?.shortDesc }}</p>
              <div class="meta-info">
                <span class="meta-item">
                  <label>分类描述:</label>
                  <span>{{ courseDetail?.categoryDesc || "-" }}</span>
                </span>
                <span class="meta-item">
                  <label>必修/选修:</label>
                  <el-tag
                    :type="courseDetail?.isRequired === 1 ? 'danger' : 'info'"
                    size="small"
                  >
                    {{ courseDetail?.isRequired === 1 ? "必修" : "选修" }}
                  </el-tag>
                </span>
                <span class="meta-item">
                  <label>创建人:</label>
                  {{ courseDetail?.userName }}
                </span>
              </div>
              <div class="meta-info">
                <span class="meta-item">
                  <label>开始时间:</label>
                  <span>{{ courseDetail?.startTime || "-" }}</span>
                </span>
                <span class="meta-item">
                  <label>结束时间:</label>
                  <span>{{ courseDetail?.endTime || "-" }}</span>
                </span>
              </div>
            </div>
          </div>

          <el-divider />

          <!-- 课程分类 -->
          <div
            v-if="
              courseDetail?.categoryList && courseDetail.categoryList.length > 0
            "
            class="detail-section"
          >
            <h3>课程分类</h3>
            <div class="category-list">
              <el-tag
                v-for="category in courseDetail?.categoryList"
                :key="category.categoryId"
                class="category-tag"
              >
                {{ category.name }}
              </el-tag>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="detailDialogVisible = false">关闭</el-button>
          <!-- <el-button type="primary" @click="editCourse(courseDetail)"
            >编辑课程</el-button
          > -->
        </div>
      </template>
    </el-dialog>

    <!-- 课时列表弹窗 -->
    <el-dialog
      v-model="hoursDialogVisible"
      class="course-hours-dialog"
      title="课时列表"
      width="70%"
    >
      <div v-loading="hoursLoading">
        <div
          v-if="!hoursLoading && courseHours.length === 0"
          class="empty-state"
        >
          该课程暂无课时信息
        </div>
        <div v-else>
          <!-- 课程信息头部 -->
          <div v-if="currentCourse" class="course-header">
            <div class="course-info">
              <h2>{{ currentCourse.title }}</h2>
              <div class="meta-info">
                <span class="meta-item">
                  <label>类型:</label>
                  <el-tag
                    :type="currentCourse.isRequired === 1 ? 'danger' : 'info'"
                    size="small"
                  >
                    {{ currentCourse.isRequired === 1 ? "必修" : "选修" }}
                  </el-tag>
                </span>
                <span class="meta-item">
                  <label>创建人:</label>
                  {{ currentCourse.userName }}
                </span>
              </div>
            </div>
            <div>
              <el-button type="primary" @click="showAddChapterDialog">
                新增章节
              </el-button>
            </div>
          </div>

          <el-divider />

          <!-- 章节和课时内容 -->
          <div class="chapter-list">
            <div
              v-for="chapter in courseHours"
              :key="'chapter-' + chapter.chapterId"
              class="chapter-item"
            >
              <div class="chapter-title">
                {{ chapter.name }}
                <el-button
                  size="small"
                  type="danger"
                  @click="confirmDeleteChapter(chapter, currentCourse)"
                  >删除章节</el-button
                >
              </div>

              <div v-if="isMobile" class="mobile-hour-list">
                <article
                  v-for="hour in chapter.hourList"
                  :key="hour.hourId"
                  class="mobile-hour-card"
                >
                  <div class="mobile-hour-card__header">
                    <span class="mobile-hour-card__id"
                      >课时 {{ hour.hourId }}</span
                    >
                    <el-tag size="small">{{ hour.rType }}</el-tag>
                  </div>
                  <h4 class="mobile-hour-card__title">{{ hour.title }}</h4>
                  <div class="mobile-hour-card__meta">
                    时长：{{ formatDuration(hour.duration) }}
                  </div>
                  <div class="mobile-hour-card__actions">
                    <el-button
                      size="small"
                      type="primary"
                      @click="previewResource(hour.fileUrl)"
                    >
                      预览
                    </el-button>
                    <el-button
                      size="small"
                      type="danger"
                      @click="confirmDeleteHour(hour, chapter, currentCourse)"
                    >
                      删除
                    </el-button>
                  </div>
                </article>
              </div>

              <el-table
                v-else
                :data="chapter.hourList"
                stripe
                style="width: 100%"
                border
              >
                <el-table-column prop="hourId" label="ID" width="80" />
                <el-table-column
                  prop="title"
                  label="课时标题"
                  min-width="150"
                />
                <el-table-column label="时长" width="100">
                  <template #default="scope">
                    <span>{{ formatDuration(scope.row.duration) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="资源类型" width="100">
                  <template #default="scope">
                    <el-tag size="small">{{ scope.row.rType }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="180">
                  <template #default="scope">
                    <el-button
                      size="small"
                      type="primary"
                      @click="previewResource(scope.row.fileUrl)"
                      >预览</el-button
                    >
                    <el-button
                      size="small"
                      type="danger"
                      @click="
                        confirmDeleteHour(scope.row, chapter, currentCourse)
                      "
                      >删除</el-button
                    >
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 附件列表弹窗 -->
    <el-dialog v-model="attrDialogVisible" title="附件列表" width="60%">
      <div v-loading="attrLoading">
        <div v-if="courseAttrs.length === 0" class="empty-text">
          该课程暂无附件
        </div>
        <el-table v-else :data="courseAttrs" stripe style="width: 100%">
          <el-table-column prop="attrId" label="ID" width="80" />
          <el-table-column
            prop="title"
            label="附件标题"
            min-width="200"
            show-overflow-tooltip
          />
          <el-table-column prop="rType" label="类型" width="120" />
          <el-table-column label="操作" width="100">
            <template #default="scope">
              <el-button
                v-if="scope.row.fileUrl"
                size="small"
                @click="downloadAttachment(scope.row)"
                >下载</el-button
              >
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>

    <!-- 创建/编辑课程弹窗 -->
    <el-dialog
      v-model="courseFormDialogVisible"
      :title="isEdit ? '编辑课程' : '创建课程'"
      width="70%"
    >
      <div v-loading="courseFormLoading">
        <CourseForm
          ref="courseFormRef"
          v-model="courseForm"
          :loading="courseFormLoading"
          :is-edit="isEdit"
        />
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="courseFormDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitCourseForm">确定</el-button>
        </div>
      </template>
    </el-dialog>

    <BulkCourseUploadDialog
      v-if="canBulkImportCourses"
      ref="bulkCourseUploadRef"
      @completed="handleBulkCourseUploadCompleted"
    />

    <!-- 课程分配弹窗 -->
    <el-dialog v-model="allocationDialogVisible" title="课程分配" width="60%">
      <div v-loading="allocationLoading">
        <div v-if="currentCourse" class="allocation-header">
          <h3>{{ currentCourse.title }} - 为该课程分配学员</h3>
        </div>

        <el-form :inline="true" class="search-form">
          <el-form-item label="学员姓名">
            <el-input
              v-model="allocationSearchForm.userName"
              placeholder="请输入学员姓名"
              clearable
              @keyup.enter="searchAllocationUsers"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="searchAllocationUsers"
              >搜索</el-button
            >
            <el-button @click="resetAllocationSearch">重置</el-button>
          </el-form-item>
        </el-form>

        <!-- 可分配学员表格 -->
        <div style="height: 40vh; overflow-y: auto">
          <el-table
            v-loading="allocationTableLoading"
            :data="allocationUsers"
            stripe
            style="width: 100%"
            @selection-change="handleSelectionChange"
          >
            <el-table-column type="selection" width="55" />
            <el-table-column prop="userId" label="ID" width="80" />
            <el-table-column label="头像" width="80">
              <template #default="scope">
                <el-avatar :size="40" :src="formatAvatar(scope.row.avatar)">
                  {{ scope.row.userName?.charAt(0) || "U" }}
                </el-avatar>
              </template>
            </el-table-column>
            <el-table-column prop="userName" label="用户名" />
          </el-table>
        </div>

        <div class="pagination-container">
          <el-pagination
            v-model:current-page="allocationCurrentPage"
            v-model:page-size="allocationPageSize"
            :page-sizes="[10, 20, 30, 50]"
            layout="total, sizes, prev, pager, next, jumper"
            :total="allocationTotal"
            @size-change="handleAllocationSizeChange"
            @current-change="handleAllocationCurrentChange"
          />
        </div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="allocationDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitAllocation"
            >确定分配</el-button
          >
        </div>
      </template>
    </el-dialog>

    <!-- 学习情况弹窗 -->
    <el-dialog
      v-model="studyStatusDialogVisible"
      title="学员学习情况"
      width="80%"
    >
      <div v-loading="studyStatusLoading">
        <div v-if="currentCourse" class="allocation-header">
          <h3>{{ currentCourse.title }} - 学员学习情况列表</h3>
        </div>

        <el-form :inline="true" class="search-form">
          <el-form-item label="学员姓名">
            <el-input
              v-model="studyStatusSearchForm.userName"
              placeholder="请输入学员姓名"
              clearable
              @keyup.enter="searchStudyUsers"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="searchStudyUsers">搜索</el-button>
            <el-button @click="resetStudySearch">重置</el-button>
          </el-form-item>
        </el-form>

        <!-- 学习情况表格 -->
        <div style="height: 40vh; overflow-y: auto">
          <el-table
            v-loading="studyStatusTableLoading"
            :data="studyUsers"
            stripe
            style="width: 100%"
          >
            <el-table-column prop="userId" label="ID" width="80" sortable />
            <el-table-column label="头像" width="80">
              <template #default="scope">
                <el-avatar :size="40" :src="formatAvatar(scope.row.avatar)">
                  {{ scope.row.userName?.charAt(0) || "U" }}
                </el-avatar>
              </template>
            </el-table-column>
            <el-table-column prop="userName" label="用户名" min-width="150" />
            <el-table-column prop="totalHours" label="总课时数" width="100" />
            <el-table-column
              prop="finishedHours"
              label="已完成课时数"
              width="140"
              sortable
            />
            <el-table-column
              label="完成率"
              width="220"
              sortable
              :sort-method="sortProgress"
            >
              <template #default="scope">
                <el-progress
                  :percentage="
                    calculateProgress(
                      scope.row.finishedHours,
                      scope.row.totalHours
                    )
                  "
                  :format="percentageFormat"
                />
              </template>
            </el-table-column>
            <el-table-column
              prop="startStudyTime"
              label="开始学习时间"
              width="180"
              sortable
            />
            <el-table-column
              prop="finishedStudyTime"
              label="完成学习时间"
              width="180"
              sortable
            >
              <template #default="scope">
                {{ scope.row.finishedStudyTime || "-" }}
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div class="pagination-container">
          <el-pagination
            v-model:current-page="studyStatusCurrentPage"
            v-model:page-size="studyStatusPageSize"
            :page-sizes="[10, 20, 30, 50]"
            layout="total, sizes, prev, pager, next, jumper"
            :total="studyStatusTotal"
            @size-change="handleStudyStatusSizeChange"
            @current-change="handleStudyStatusCurrentChange"
          />
        </div>
      </div>
    </el-dialog>

    <!-- 删除课程确认对话框 -->
    <el-dialog
      v-model="deleteConfirmVisible"
      title="确认删除"
      width="30%"
      center
    >
      <span
        >确定要删除课程 "{{ currentCourse?.title }}" 吗？此操作不可恢复！</span
      >
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="deleteConfirmVisible = false">取消</el-button>
          <el-button type="danger" @click="handleDeleteCourse"
            >确定删除</el-button
          >
        </div>
      </template>
    </el-dialog>

    <!-- 新增章节对话框 -->
    <el-dialog v-model="addChapterDialogVisible" title="新增章节" width="70%">
      <div v-loading="addChapterLoading">
        <el-form
          ref="newChapterFormRef"
          :model="newChapterForm"
          label-width="120px"
        >
          <el-form-item
            label="章节名称"
            prop="name"
            :rules="[
              { required: true, message: '请输入章节名称', trigger: 'blur' }
            ]"
          >
            <el-input
              v-model="newChapterForm.name"
              placeholder="请输入章节名称"
            />
          </el-form-item>

          <div class="form-section">
            <div class="section-header">
              <h3>课时列表</h3>
              <div>
                <el-button type="primary" @click="addHour">添加课时</el-button>
              </div>
            </div>

            <div
              v-if="newChapterForm.hourList.length === 0"
              class="empty-placeholder"
            >
              尚未添加课时，点击"添加课时"按钮添加
            </div>
            <div v-else class="hour-list">
              <el-collapse v-model="activeHours">
                <el-collapse-item
                  v-for="(hour, hourIndex) in newChapterForm.hourList"
                  :key="'hour-' + hourIndex"
                  :name="hourIndex"
                >
                  <template #title>
                    <div class="hour-header">
                      <span
                        >{{ hour.title || "未命名课时" }}
                        <span class="required-mark">*</span>
                      </span>
                      <div class="hour-title-actions">
                        <el-button
                          type="danger"
                          size="small"
                          @click.stop="removeHour(hourIndex)"
                          >删除课时</el-button
                        >
                      </div>
                    </div>
                  </template>
                  <div class="hour-content">
                    <div class="hour-card">
                      <el-row :gutter="20">
                        <el-col :span="24">
                          <el-form-item :label="'课时标题'">
                            <el-input
                              v-model="hour.title"
                              placeholder="将使用上传的文件名"
                              disabled
                            />
                          </el-form-item>
                        </el-col>
                      </el-row>

                      <el-row :gutter="20">
                        <el-col :span="24">
                          <el-form-item
                            :label="'时长(秒)'"
                            :prop="`hourList[${hourIndex}].duration`"
                            :rules="videoDurationRules"
                          >
                            <el-input-number
                              v-model="hour.duration"
                              :min="0"
                              :step="1"
                              disabled
                              placeholder="上传视频后自动获取"
                            />
                          </el-form-item>
                        </el-col>
                      </el-row>

                      <el-form-item
                        :label="'课时资源'"
                        :prop="`hourList[${hourIndex}].resourceId`"
                        :rules="[
                          {
                            required: true,
                            type: 'number',
                            min: 1,
                            message: '请上传视频资源',
                            trigger: 'change'
                          }
                        ]"
                      >
                        <div class="upload-with-preview">
                          <div v-if="hour.fileUrl" class="resource-preview">
                            <div class="resource-info">
                              <i class="el-icon-video-camera" />
                              <span class="resource-name">{{
                                hour.originalFileName ||
                                getFileName(hour.fileUrl)
                              }}</span>
                            </div>
                            <div class="resource-actions">
                              <el-button
                                size="small"
                                @click="previewResource(hour.fileUrl)"
                                >预览</el-button
                              >
                              <el-button
                                size="small"
                                type="danger"
                                @click="
                                  removeResource(
                                    newChapterForm.hourList,
                                    hourIndex
                                  )
                                "
                                >移除</el-button
                              >
                            </div>
                          </div>
                          <div
                            v-if="hour.isUploading"
                            class="uploading-overlay"
                          >
                            <div class="uploading-indicator">
                              <el-icon class="is-loading"><Loading /></el-icon>
                              <span>上传中...</span>
                            </div>
                          </div>
                          <el-upload
                            v-if="!hour.isUploading && !hour.fileUrl"
                            class="resource-upload"
                            action="#"
                            :auto-upload="false"
                            :show-file-list="false"
                            :accept="'.mp4,.webm,.ogg'"
                            :on-change="
                              file => {
                                newChapterForm.hourList[hourIndex].isUploading =
                                  true;
                                handleResourceUpload(
                                  file,
                                  newChapterForm.hourList,
                                  hourIndex
                                );
                              }
                            "
                          >
                            <div class="upload-icon-container">
                              <el-icon><Plus /></el-icon>
                              <p class="upload-tip">点击上传课时视频</p>
                            </div>
                          </el-upload>
                        </div>
                      </el-form-item>
                    </div>
                  </div>
                </el-collapse-item>
              </el-collapse>
            </div>
          </div>
        </el-form>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="addChapterDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitNewChapter">确定</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, reactive, computed } from "vue";
import { useRouter } from "vue-router";
import { useAppStoreHook } from "@/store/modules/app";
import { useUserStoreHook } from "@/store/modules/user";
import { formatAvatar } from "@/utils/avatar";
import { hasManageAccess, isAdmin } from "@/utils/auth";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  getCourseList,
  getCourseHoursList,
  getCourseAttrList,
  getCourseDetail,
  createCourse,
  updateCourse,
  coursesAllocation,
  getAllocationUserList,
  getStudyUserList,
  deleteCourse,
  batchDeleteCourse,
  deleteChapter,
  deleteHour,
  createCourseChapter,
  getCourseStats,
  startCourseRebuild
} from "@/api/course";
import type {
  CourseCreateParams,
  CourseRebuildErrorResponse,
  CourseUpdateParams
} from "@/api/course";
import CourseForm from "./components/CourseForm.vue";
import CourseCard from "./components/CourseCard.vue";
import CourseStats from "./components/CourseStats.vue";
import BulkCourseUploadDialog from "./components/BulkCourseUploadDialog.vue";
import { FolderOpened, Plus, Loading, Search } from "@element-plus/icons-vue";
import { openPlatformUrl } from "@/utils/platformCapability";
import { uploadFileWithSts } from "@/utils/sts-upload";
import { downloadPlatformResource } from "@/components/PlatformResourcePreview/resource-preview";
import { getVideoDuration } from "./utils/course-package";

const appStore = useAppStoreHook();
const router = useRouter();
const isMobile = computed(() => appStore.getDevice === "mobile");
const paginationLayout = computed(() =>
  isMobile.value
    ? "sizes, prev, pager, next"
    : "total, sizes, prev, pager, next, jumper"
);
const userStore = useUserStoreHook();
const isAdminUser = computed(() => isAdmin());
const canBulkImportCourses = computed(() => hasManageAccess());
const currentUserId = computed(() => userStore.userId);
const currentUserNames = computed(() =>
  [userStore.nickname, userStore.username]
    .map(name => name?.trim())
    .filter(Boolean)
);

// 统计数据
const courseStats = reactive({
  totalCourses: 0,
  totalStudents: 0,
  totalHours: 0,
  completionRate: "0%"
});

// 统计筛选日期
const statsDateFilter = ref<{ startDate?: string; endDate?: string }>({});

const courseFormRef = ref<{
  validate: () => Promise<boolean>;
  scrollToFirstError?: () => void;
}>();
const bulkCourseUploadRef = ref<{
  openFolderPicker: () => void;
}>();

// 数据定义
const courseList = ref([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(20);
const loading = ref(false);
const searchForm = ref({
  courseName: ""
});

// 选择的课程ID列表
const selectedCourseIds = ref<number[]>([]);
const rebuildStartingCourseId = ref<number | null>(null);
const isCourseRebuildAdmissionDisabled = ref(false);

const getRebuildError = (error: unknown): CourseRebuildErrorResponse | null => {
  const responseData = (error as any)?.response?.data;
  return responseData && typeof responseData.code === "string"
    ? (responseData as CourseRebuildErrorResponse)
    : null;
};

const createRebuildRequestId = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, character => {
    const random = (Math.random() * 16) | 0;
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

const submitCourseRebuild = async (courseId: number, requestId: string) => {
  try {
    return await startCourseRebuild({ sourceCourseId: courseId, requestId });
  } catch (error) {
    if (getRebuildError(error)) throw error;

    try {
      await ElMessageBox.confirm(
        "当前无法确认服务器是否已经受理该请求。重试会复用本次请求 ID，不会创建第二个重建操作。",
        "重试课程重建",
        {
          confirmButtonText: "重试同一请求",
          cancelButtonText: "暂不重试",
          type: "warning",
          closeOnClickModal: false
        }
      );
    } catch {
      return null;
    }

    return startCourseRebuild({ sourceCourseId: courseId, requestId });
  }
};

const confirmCourseRebuild = async (course: any) => {
  if (!isAdminUser.value) {
    ElMessage.warning("只有管理员可以重建课程");
    return;
  }

  try {
    await ElMessageBox.confirm(
      `重建「${course.title}」后，源课程（ID：${course.courseId}）及其学习、作业、考试、讨论和 AI 历史数据将被删除。新课程会获得新的 ID。`,
      "确认重建课程",
      {
        confirmButtonText: "确认重建",
        cancelButtonText: "取消",
        type: "error",
        closeOnClickModal: false,
        closeOnPressEscape: false
      }
    );
  } catch {
    return;
  }

  rebuildStartingCourseId.value = course.courseId;
  const requestId = createRebuildRequestId();
  try {
    const operation = await submitCourseRebuild(course.courseId, requestId);

    if (!operation) return;

    if (!operation.operationId) {
      throw new Error("课程重建接口未返回 operationId");
    }

    sessionStorage.setItem(
      `course-rebuild-started-at:${operation.operationId}`,
      String(Date.now())
    );
    ElMessage.success("课程重建已受理，正在打开进度页");
    await router.push({
      name: "CourseRebuildProgress",
      params: { operationId: operation.operationId }
    });
  } catch (error) {
    const apiError = getRebuildError(error);
    if (
      apiError?.code === "course_rebuild_in_progress" &&
      apiError.operationId
    ) {
      ElMessage.warning("该课程已有进行中的重建任务，已打开原进度页");
      await router.push({
        name: "CourseRebuildProgress",
        params: { operationId: apiError.operationId }
      });
      return;
    }

    if (apiError?.code === "course_rebuild_admission_disabled") {
      isCourseRebuildAdmissionDisabled.value = true;
      ElMessage.error("当前环境未开放课程重建，请联系运维");
      return;
    }

    if (apiError?.code === "course_rebuild_idempotency_conflict") {
      ElMessage.error("本次重建请求发生幂等冲突，请重新确认后再发起");
      return;
    }

    ElMessage.error(apiError?.message || "课程重建发起失败，请稍后重试");
  } finally {
    rebuildStartingCourseId.value = null;
  }
};

const canDeleteCourse = (course: any) => {
  if (!course) return false;
  if (isAdminUser.value) return true;

  const courseCreatorId = Number(course.userId);
  if (
    Number.isFinite(courseCreatorId) &&
    courseCreatorId > 0 &&
    currentUserId.value
  ) {
    return courseCreatorId === currentUserId.value;
  }

  const courseCreatorName = course.userName?.trim();
  if (!courseCreatorName) return false;
  return currentUserNames.value.includes(courseCreatorName);
};

const toggleCourseSelection = (courseId: number) => {
  const index = selectedCourseIds.value.indexOf(courseId);
  if (index > -1) {
    selectedCourseIds.value.splice(index, 1);
  } else {
    selectedCourseIds.value.push(courseId);
  }
};

// 课时列表相关
const hoursDialogVisible = ref(false);
const hoursLoading = ref(false);
const courseHours = ref([]);
const currentCourse = ref(null);

// 附件列表相关
const attrDialogVisible = ref(false);
const attrLoading = ref(false);
const courseAttrs = ref([]);

// 课程详情相关
const detailDialogVisible = ref(false);
const detailLoading = ref(false);
const courseDetail = ref(null);

// 课程分配相关
const allocationDialogVisible = ref(false);
const allocationLoading = ref(false);
const allocationTableLoading = ref(false);
const allocationUsers = ref([]);
const allocationTotal = ref(0);
const allocationCurrentPage = ref(1);
const allocationPageSize = ref(20);
const selectedUsers = ref([]);
const allocationSearchForm = ref({
  userName: ""
});

// 课程表单相关
const courseFormDialogVisible = ref(false);
const courseFormLoading = ref(false);
const isEdit = ref(false);
const courseForm = ref({
  courseId: 0,
  title: "",
  shortDesc: "",
  thumb: 0,
  thumb_url: "",
  isRequired: 1,
  isChapter: 1, // 默认为有章节模式
  categoryIds: [],
  endingTime: "",
  chapterList: [],
  hourList: [],
  attrList: []
});

// 格式化时长显示
const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}分${remainingSeconds}秒`;
};

const toPositiveNumber = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0;
};

const cleanHourPayload = (hour: any) => {
  const payload: CourseCreateParams["hourList"][number] = {
    resourceId: toPositiveNumber(hour?.resourceId),
    duration: Number(hour?.duration || 0)
  };

  if (hour?.title) payload.title = String(hour.title).trim();
  if (hour?.rType) payload.rType = hour.rType;
  if (toPositiveNumber(hour?.hourId))
    payload.hourId = toPositiveNumber(hour.hourId);
  if (hour?.fileUrl) payload.fileUrl = hour.fileUrl;

  return payload;
};

const cleanAttrPayload = (attr: any) => {
  const payload: CourseCreateParams["attrList"][number] = {
    resourceId: toPositiveNumber(attr?.resourceId)
  };

  if (attr?.title) payload.title = String(attr.title).trim();
  if (attr?.rType) payload.rType = attr.rType;
  if (toPositiveNumber(attr?.attrId))
    payload.attrId = toPositiveNumber(attr.attrId);
  if (attr?.fileUrl) payload.fileUrl = attr.fileUrl;

  return payload;
};

const buildCreateCoursePayload = (): CourseCreateParams => {
  const formData = courseForm.value;
  const basePayload = {
    title: formData.title.trim(),
    thumb_url: formData.thumb_url,
    shortDesc: formData.shortDesc.trim(),
    isRequired: Number(formData.isRequired),
    categoryIds: [...formData.categoryIds].map(Number),
    isChapter: Number(formData.isChapter),
    endingTime: formData.endingTime,
    attrList: (formData.attrList || [])
      .map(cleanAttrPayload)
      .filter(attr => attr.resourceId > 0)
  };

  if (Number(formData.isChapter) === 1) {
    return {
      ...basePayload,
      chapterList: (formData.chapterList || []).map(chapter => ({
        ...(toPositiveNumber(chapter?.chapterId)
          ? { chapterId: toPositiveNumber(chapter.chapterId) }
          : {}),
        name: String(chapter?.name || "").trim(),
        hourList: (chapter?.hourList || []).map(cleanHourPayload)
      }))
    };
  }

  return {
    ...basePayload,
    hourList: (formData.hourList || []).map(cleanHourPayload)
  };
};

const buildUpdateCoursePayload = (): CourseUpdateParams => {
  const formData = courseForm.value;
  return {
    courseId: Number(formData.courseId),
    title: formData.title.trim(),
    thumbUrl: formData.thumb_url,
    shortDesc: formData.shortDesc.trim(),
    isRequired: Number(formData.isRequired),
    categoryIds: [...formData.categoryIds].map(Number),
    endingTime: formData.endingTime
  };
};

// 提交课程表单
const submitCourseForm = async () => {
  if (!courseFormRef.value) return;

  let valid = false;
  try {
    valid = await courseFormRef.value.validate();
  } catch (error) {
    console.warn("课程表单校验未通过:", error);
    courseFormRef.value.scrollToFirstError?.();
    ElMessage.warning("请先完善课程必填信息");
    return;
  }

  if (!valid) {
    courseFormRef.value.scrollToFirstError?.();
    ElMessage.warning("请先完善课程必填信息");
    return;
  }

  try {
    courseFormLoading.value = true;

    if (isEdit.value) {
      const res = await updateCourse(buildUpdateCoursePayload());

      if (res && res.code === 200) {
        ElMessage.success("课程更新成功");
        courseFormDialogVisible.value = false;
        fetchCourseList(); // 刷新列表
      } else {
        ElMessage.error(res?.msg || "课程更新失败");
      }
      return;
    }

    const res = await createCourse(buildCreateCoursePayload());

    if (res && res.code === 200) {
      ElMessage.success("课程创建成功");
      courseFormDialogVisible.value = false;
      fetchCourseList(); // 刷新列表
    } else {
      ElMessage.error(res?.msg || "课程创建失败");
    }
  } catch (error) {
    console.error(isEdit.value ? "更新课程失败:" : "创建课程失败:", error);
    ElMessage.error(isEdit.value ? "更新课程失败" : "创建课程失败");
  } finally {
    courseFormLoading.value = false;
  }
};

// 处理页面大小变化
const handleSizeChange = (val: number) => {
  pageSize.value = val;
  fetchCourseList();
};

// 处理页码变化
const handleCurrentChange = (val: number) => {
  currentPage.value = val;
  fetchCourseList();
};

// 搜索课程
const handleSearch = () => {
  currentPage.value = 1;
  fetchCourseList();
};

// 重置搜索条件
const resetSearch = () => {
  searchForm.value.courseName = "";
  handleSearch();
};

// 获取课程列表数据
const fetchCourseList = async () => {
  loading.value = true;
  try {
    const res = await getCourseList({
      pageNum: currentPage.value,
      pageSize: pageSize.value,
      courseName: searchForm.value.courseName
    });

    if (res && res.code === 200 && res.data) {
      courseList.value = res.data.courseList || [];
      total.value = res.data.total || 0;
    } else {
      courseList.value = [];
      total.value = 0;
      ElMessage.warning("获取课程列表失败");
    }
    // 列表刷新后，清空选中状态
    selectedCourseIds.value = [];
  } catch (error) {
    console.error("获取课程列表失败:", error);
    ElMessage.error("获取课程列表失败");
  } finally {
    loading.value = false;
  }
};

// 获取课程统计数据（支持日期筛选学习行为）
const fetchCourseStats = async () => {
  try {
    const res = await getCourseStats(statsDateFilter.value);
    console.log("=== 课程统计API调试 ===");
    console.log("完整响应:", JSON.stringify(res, null, 2));
    console.log("res.data:", res?.data);
    console.log("========================");

    if (res && res.code === 200 && res.data) {
      // 课程总数、累计课时、完成率 受日期筛选影响
      courseStats.totalCourses = res.data.totalCourses ?? 0;
      courseStats.totalHours = res.data.totalHours ?? 0;
      const rate = res.data.avgCompletionRate ?? res.data.completionRate ?? 0;
      courseStats.completionRate = `${rate}%`;
      // 在学人数固定为近7天，不受日期筛选影响
      courseStats.totalStudents = res.data.activeStudents ?? 0;
    } else {
      console.warn("课程统计API返回数据异常:", res);
    }
  } catch (error) {
    console.error("获取课程统计失败:", error);
  }
};

// 处理统计日期筛选变化
const handleStatsDateChange = (dateFilter: {
  startDate?: string;
  endDate?: string;
}) => {
  statsDateFilter.value = dateFilter;
  fetchCourseStats();
};

// 打开创建课程弹窗
const openCreateDialog = () => {
  isEdit.value = false;
  courseForm.value = {
    courseId: 0,
    title: "",
    shortDesc: "",
    thumb: 0,
    thumb_url: "", // 使用thumb_url字段与API参数一致
    isRequired: 1,
    isChapter: 1, // 默认为有章节模式
    categoryIds: [],
    endingTime: "",
    chapterList: [],
    hourList: [],
    attrList: []
  };
  courseFormDialogVisible.value = true;
};

const openBulkCourseUpload = () => {
  bulkCourseUploadRef.value?.openFolderPicker();
};

const handleBulkCourseUploadCompleted = () => {
  fetchCourseList();
  fetchCourseStats();
};

// 查看课程详情
const viewCourse = async course => {
  currentCourse.value = course;
  detailDialogVisible.value = true;
  detailLoading.value = true;

  try {
    const res = await getCourseDetail({
      courseId: course.courseId
    });

    if (res && res.code === 200 && res.data) {
      courseDetail.value = res.data;
    } else {
      courseDetail.value = null;
      ElMessage.warning("获取课程详情失败");
    }
  } catch (error) {
    console.error("获取课程详情失败:", error);
    ElMessage.error("获取课程详情失败");
  } finally {
    detailLoading.value = false;
  }
};

// 编辑课程
const editCourse = course => {
  isEdit.value = true;
  // 关闭详情弹窗（如果打开了）
  detailDialogVisible.value = false;

  // 填充表单数据
  courseForm.value = {
    courseId: course.courseId,
    title: course.title,
    shortDesc: course.shortDesc || "",
    thumb: course.thumb || 0,
    thumb_url: course.thumbUrl || "", // 从API返回的thumbUrl映射到表单的thumb_url字段
    isRequired: course.isRequired !== undefined ? course.isRequired : 1,
    isChapter: course.isChapter !== undefined ? course.isChapter : 0,
    categoryIds: course.categoryList
      ? course.categoryList.map(c => c.categoryId)
      : [],
    endingTime: course.endTime || "",
    chapterList: course.chapterList || [],
    hourList: course.hourList || [],
    attrList: course.attrList || []
  };

  courseFormDialogVisible.value = true;
};

// 编辑选中的课程
const handleEditSelected = () => {
  if (selectedCourseIds.value.length === 1) {
    const courseId = selectedCourseIds.value[0];
    const course = courseList.value.find(c => c.courseId === courseId);
    if (course) {
      editCourse(course);
    }
  }
};

// 查看课时列表
const viewHours = async course => {
  currentCourse.value = course;
  hoursDialogVisible.value = true;
  hoursLoading.value = true;

  try {
    const res = await getCourseHoursList({
      courseId: course.courseId
    });

    if (res && res.code === 200 && res.data) {
      courseHours.value = res.data.courseChapters || [];
    } else {
      courseHours.value = [];
      ElMessage.warning("获取课时列表失败");
    }
  } catch (error) {
    console.error("获取课时列表失败:", error);
    ElMessage.error("获取课时列表失败");
  } finally {
    hoursLoading.value = false;
  }
};

// 查看附件列表
const viewAttrs = async course => {
  currentCourse.value = course;
  attrDialogVisible.value = true;
  attrLoading.value = true;

  try {
    const res = await getCourseAttrList({
      courseId: course.courseId
    });

    if (res && res.code === 200 && res.data) {
      courseAttrs.value = res.data.courseWares || [];
    } else {
      courseAttrs.value = [];
      ElMessage.warning("获取课程附件列表失败");
    }
  } catch (error) {
    console.error("获取课程附件列表失败:", error);
    ElMessage.error("获取课程附件列表失败");
  } finally {
    attrLoading.value = false;
  }
};

// 预览资源
const previewResource = (url: string) => {
  if (!url) return;
  if (!openPlatformUrl(url).opened) {
    ElMessage.warning("当前环境无法打开该资源");
  }
};

// 下载附件
const downloadAttachment = async attachment => {
  if (attachment.fileUrl) {
    try {
      await downloadPlatformResource({
        title: attachment.fileName || attachment.name || "课程附件",
        url: attachment.fileUrl,
        downloadUrl: attachment.fileUrl
      });
    } catch {
      ElMessage.error("附件下载失败，请稍后重试");
    }
  } else {
    ElMessage.warning("无效的附件链接");
  }
};

// 显示分配弹窗
const showAllocationDialog = course => {
  currentCourse.value = course;
  allocationDialogVisible.value = true;
  allocationCurrentPage.value = 1;
  allocationPageSize.value = 20;
  selectedUsers.value = [];
  allocationSearchForm.value.userName = "";
  allocationLoading.value = true;

  // 加载可分配的用户
  fetchAllocationUsers();
};

// 获取可分配的用户列表
const fetchAllocationUsers = async () => {
  allocationTableLoading.value = true;
  try {
    const res = await getAllocationUserList({
      courseId: currentCourse.value.courseId,
      userName: allocationSearchForm.value.userName,
      pageNum: allocationCurrentPage.value,
      pageSize: allocationPageSize.value
    });

    if (res && res.code === 200 && res.data) {
      allocationUsers.value = res.data.list || [];
      allocationTotal.value = res.data.total || 0;
    } else {
      allocationUsers.value = [];
      allocationTotal.value = 0;
      ElMessage.warning("获取用户列表失败");
    }
  } catch (error) {
    console.error("获取用户列表失败:", error);
    ElMessage.error("获取用户列表失败");
    allocationUsers.value = [];
    allocationTotal.value = 0;
  } finally {
    allocationTableLoading.value = false;
    allocationLoading.value = false;
  }
};

// 搜索用户
const searchAllocationUsers = () => {
  allocationCurrentPage.value = 1;
  fetchAllocationUsers();
};

// 重置搜索
const resetAllocationSearch = () => {
  allocationSearchForm.value.userName = "";
  allocationCurrentPage.value = 1;
  fetchAllocationUsers();
};

// 处理表格选择变化
const handleSelectionChange = selection => {
  selectedUsers.value = selection;
};

// 处理分配页面大小变化
const handleAllocationSizeChange = (val: number) => {
  allocationPageSize.value = val;
  fetchAllocationUsers();
};

// 处理分配页码变化
const handleAllocationCurrentChange = (val: number) => {
  allocationCurrentPage.value = val;
  fetchAllocationUsers();
};

// 提交课程分配
const submitAllocation = async () => {
  if (selectedUsers.value.length === 0) {
    ElMessage.warning("请选择需要分配的用户");
    return;
  }

  try {
    allocationLoading.value = true;
    const userIds = selectedUsers.value.map(user => user.userId);

    const res = await coursesAllocation({
      courseId: currentCourse.value.courseId,
      userIdList: userIds
    });

    if (res && res.code === 200) {
      ElMessage.success("课程分配成功");
      allocationDialogVisible.value = false;
    } else {
      ElMessage.error("课程分配失败");
    }
  } catch (error) {
    console.error("课程分配失败:", error);
    ElMessage.error("课程分配失败");
  } finally {
    allocationLoading.value = false;
  }
};

// 学习情况对话框数据
const studyStatusDialogVisible = ref(false);
const studyStatusLoading = ref(false);
const studyStatusTableLoading = ref(false);
const studyUsers = ref<any[]>([]);
const studyStatusCurrentPage = ref(1);
const studyStatusPageSize = ref(10);
const studyStatusTotal = ref(0);
const studyStatusSearchForm = ref({
  userName: ""
});

// 显示学习情况对话框
const showStudyStatusDialog = async (row: any) => {
  currentCourse.value = row;
  studyStatusDialogVisible.value = true;
  studyStatusLoading.value = true;
  await fetchStudyUserList();
  studyStatusLoading.value = false;
};

// 获取学习情况列表
const fetchStudyUserList = async () => {
  try {
    studyStatusTableLoading.value = true;
    const params = {
      courseId: currentCourse.value?.courseId,
      pageNum: studyStatusCurrentPage.value,
      pageSize: studyStatusPageSize.value,
      ...(studyStatusSearchForm.value.userName
        ? { userName: studyStatusSearchForm.value.userName }
        : {})
    };

    const { data } = await getStudyUserList(params);
    studyUsers.value = data.list;
    studyStatusTotal.value = data.total;
  } catch (error) {
    console.error("获取学习情况列表失败", error);
    ElMessage.error("获取学习情况列表失败");
  } finally {
    studyStatusTableLoading.value = false;
  }
};

// 搜索学习记录
const searchStudyUsers = () => {
  studyStatusCurrentPage.value = 1;
  fetchStudyUserList();
};

// 重置学习情况搜索
const resetStudySearch = () => {
  studyStatusSearchForm.value.userName = "";
  searchStudyUsers();
};

// 处理学习情况分页变化
const handleStudyStatusCurrentChange = (val: number) => {
  studyStatusCurrentPage.value = val;
  fetchStudyUserList();
};

// 处理学习情况每页条数变化
const handleStudyStatusSizeChange = (val: number) => {
  studyStatusPageSize.value = val;
  studyStatusCurrentPage.value = 1;
  fetchStudyUserList();
};

// 计算进度百分比
const calculateProgress = (finished: number, total: number) => {
  if (!total) return 0;
  const percentage = (finished / total) * 100;
  return parseFloat(percentage.toFixed(1));
};

// 完成率排序方法
const sortProgress = (a: any, b: any) => {
  const progressA = calculateProgress(a.finishedHours, a.totalHours);
  const progressB = calculateProgress(b.finishedHours, b.totalHours);
  return progressA - progressB;
};

// 格式化百分比显示
const percentageFormat = (percentage: number) => {
  return `${percentage}%`;
};

// 删除课程确认对话框
const deleteConfirmVisible = ref(false);

// 打开删除确认对话框
const confirmDelete = (row: any) => {
  if (!canDeleteCourse(row)) {
    ElMessage.warning("只能删除自己创建的课程");
    return;
  }
  currentCourse.value = row;
  deleteConfirmVisible.value = true;
};

// 处理删除课程
const handleDeleteCourse = async () => {
  if (!canDeleteCourse(currentCourse.value)) {
    ElMessage.warning("只能删除自己创建的课程");
    deleteConfirmVisible.value = false;
    return;
  }
  try {
    loading.value = true;
    const response = await deleteCourse({
      courseId: currentCourse.value.courseId
    });

    if (response.code === 200) {
      ElMessage.success("课程删除成功");
      deleteConfirmVisible.value = false;
      // 重新获取课程列表
      fetchCourseList();
    } else {
      ElMessage.error(response.msg || "删除失败，请稍后重试");
    }
  } catch (error: any) {
    console.error("删除课程出错:", error);
    // 处理API错误响应，显示服务器返回的错误信息
    if (error.response && error.response.data) {
      ElMessage.error(error.response.data.msg || "删除失败，请稍后重试");
    } else {
      ElMessage.error("删除失败，请稍后重试");
    }
  } finally {
    loading.value = false;
  }
};

// 批量删除选中的课程
const handleBatchDelete = () => {
  if (!isAdminUser.value) {
    ElMessage.warning("只有管理员可以删除课程");
    return;
  }
  if (selectedCourseIds.value.length === 0) return;
  ElMessageBox.confirm(
    `确定要删除选中的 ${selectedCourseIds.value.length} 门课程吗？会级联删除课程相关学习记录、作业考试、讨论、AI 资源等数据，此操作不可恢复！`,
    "批量删除确认",
    {
      confirmButtonText: "确定删除",
      cancelButtonText: "取消",
      type: "warning"
    }
  )
    .then(async () => {
      try {
        loading.value = true;
        const res = await batchDeleteCourse({
          courseIds: selectedCourseIds.value
        });
        // 注意：此接口直接返回业务数据，没有包裹在 code/data 中
        if (res && typeof res.total === "number") {
          if (
            res.failedCount > 0 &&
            res.successCount === 0 &&
            res.partialSuccessCount === 0
          ) {
            ElMessage.error(
              `删除失败：${res.items?.[0]?.message || "所有选中课程删除失败"}`
            );
          } else if (res.partialSuccessCount > 0) {
            ElMessage.warning(
              `部分课程已删除，但外部资源部分清理失败，可稍后重试。共选中 ${res.total} 门，成功 ${res.successCount} 门。`
            );
            fetchCourseList();
          } else {
            ElMessage.success("批量删除成功");
            fetchCourseList();
          }
        } else if ((res as any).code === 200) {
          // 兼容处理：如果后端未来改为包裹格式
          ElMessage.success("批量删除成功");
          fetchCourseList();
        } else {
          ElMessage.error((res as any).msg || "批量删除失败");
        }
      } catch (error: any) {
        console.error("批量删除出错:", error);
        if (error.response && error.response.data) {
          ElMessage.error(
            error.response.data.msg || "批量删除失败，请稍后重试"
          );
        } else {
          ElMessage.error("批量删除失败，请稍后重试");
        }
      } finally {
        loading.value = false;
      }
    })
    .catch(() => {
      // 已取消删除
    });
};

// 删除章节
const confirmDeleteChapter = async (chapter: any, course: any) => {
  try {
    const response = await deleteChapter({
      courseId: course.courseId,
      chapterId: chapter.chapterId
    });

    if (response.code === 200) {
      ElMessage.success("章节删除成功");
      // 重新获取课时列表
      await viewHours(course);
    } else {
      ElMessage.error(response.msg || "删除章节失败，请稍后重试");
    }
  } catch (error: any) {
    console.error("删除章节出错:", error);
    // 处理API错误响应，显示服务器返回的错误信息
    if (error.response && error.response.data) {
      ElMessage.error(error.response.data.msg || "删除章节失败，请稍后重试");
    } else {
      ElMessage.error("删除章节失败，请稍后重试");
    }
  }
};

// 删除课时
const confirmDeleteHour = async (hour: any, chapter: any, course: any) => {
  try {
    const response = await deleteHour({
      courseId: course.courseId,
      chapterId: chapter.chapterId,
      hourId: hour.hourId
    });

    if (response.code === 200) {
      ElMessage.success("课时删除成功");
      // 重新获取课时列表
      await viewHours(course);
    } else {
      ElMessage.error(response.msg || "删除课时失败，请稍后重试");
    }
  } catch (error: any) {
    console.error("删除课时出错:", error);
    // 处理API错误响应，显示服务器返回的错误信息
    if (error.response && error.response.data) {
      ElMessage.error(error.response.data.msg || "删除课时失败，请稍后重试");
    } else {
      ElMessage.error("删除课时失败，请稍后重试");
    }
  }
};

// 新增章节相关
const addChapterDialogVisible = ref(false);
const addChapterLoading = ref(false);
const newChapterFormRef = ref();
const newChapterForm = ref({
  name: "",
  hourList: [] as any[]
});
const activeHours = ref([0]); // 默认展开第一个课时
const videoDurationRules = [
  {
    required: true,
    type: "number" as const,
    min: 1,
    message: "无法读取视频时长，请重新上传有效视频",
    trigger: "change"
  }
];
const supportedVideoMimeTypes = new Set([
  "video/mp4",
  "video/webm",
  "video/ogg"
]);
const supportedVideoExtensions = new Set(["mp4", "webm", "ogg"]);

const isSupportedVideoFile = (file: File) => {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  return (
    supportedVideoMimeTypes.has(file.type.toLowerCase()) ||
    supportedVideoExtensions.has(extension)
  );
};

// 显示新增章节对话框
const showAddChapterDialog = () => {
  newChapterForm.value = {
    name: "",
    hourList: []
  };
  activeHours.value = [];
  addChapterDialogVisible.value = true;
};

// 添加课时
const addHour = () => {
  const newIndex = newChapterForm.value.hourList.length;
  newChapterForm.value.hourList.push({
    title: "",
    resourceId: null,
    duration: null,
    rType: "",
    fileUrl: "",
    isUploading: false,
    originalFileName: ""
  });

  // 添加课时后自动展开
  activeHours.value.push(newIndex);
};

// 移除课时
const removeHour = (index: number) => {
  newChapterForm.value.hourList.splice(index, 1);
  // 更新活动课时索引
  activeHours.value = activeHours.value
    .filter(i => i !== index)
    .map(i => (i > index ? i - 1 : i));
};

// 处理资源上传
const handleResourceUpload = async (
  file: any,
  hourList: any[],
  hourIndex: number
) => {
  const hour = hourList[hourIndex];
  const rawFile = file?.raw as File | undefined;
  if (!hour || !rawFile) {
    if (hour) hour.isUploading = false;
    ElMessage.error("无法读取所选视频，请重新选择");
    return;
  }

  try {
    hour.isUploading = true;
    if (!isSupportedVideoFile(rawFile)) {
      ElMessage.error("请上传视频文件（MP4、WebM、Ogg 格式）");
      return;
    }

    const duration = await getVideoDuration(rawFile);
    if (!Number.isFinite(duration) || duration <= 0) {
      hour.duration = null;
      ElMessage.error("无法读取视频时长，请重新选择可正常播放的视频");
      return;
    }

    const courseId = Number(currentCourse.value?.courseId || 0);
    const uploaded = await uploadFileWithSts(rawFile, {
      bizType: "resource_upload",
      ...(courseId > 0 ? { courseId } : {})
    });

    hour.resourceId = uploaded.fileId;
    hour.title = rawFile.name.replace(/\.[^.]+$/, "") || rawFile.name;
    hour.fileUrl = uploaded.url;
    hour.rType = "video";
    hour.duration = duration;
    hour.originalFileName = rawFile.name;
    ElMessage.success("视频上传成功，已读取标题和时长");
  } catch (error) {
    console.error("上传资源失败:", error);
    hour.resourceId = null;
    hour.fileUrl = "";
    hour.duration = null;
    ElMessage.error("上传资源失败，请重试");
  } finally {
    hour.isUploading = false;
  }
};

// 从文件URL中提取文件名
const getFileName = (url: string) => {
  if (!url) return "";
  const parts = url.split("/");
  return parts[parts.length - 1];
};

// 移除资源
const removeResource = (hourList: any[], hourIndex: number) => {
  hourList[hourIndex].resourceId = null;
  hourList[hourIndex].title = "";
  hourList[hourIndex].fileUrl = "";
  hourList[hourIndex].rType = "";
  hourList[hourIndex].duration = null;
  hourList[hourIndex].originalFileName = "";
};

// 提交新章节
const submitNewChapter = async () => {
  // 表单验证
  if (!newChapterFormRef.value) return;

  try {
    // 检查是否有课时
    if (newChapterForm.value.hourList.length === 0) {
      ElMessage.warning("请至少添加一个课时");
      return;
    }

    const uploadingHourIndex = newChapterForm.value.hourList.findIndex(
      hour => hour.isUploading
    );
    if (uploadingHourIndex >= 0) {
      activeHours.value = Array.from(
        new Set([...activeHours.value, uploadingHourIndex])
      );
      ElMessage.warning("视频仍在上传，请等待上传完成");
      return;
    }

    const invalidHourIndex = newChapterForm.value.hourList.findIndex(
      hour =>
        Number(hour.resourceId || 0) <= 0 ||
        !hour.fileUrl ||
        !Number.isFinite(Number(hour.duration)) ||
        Number(hour.duration) <= 0
    );
    if (invalidHourIndex >= 0) {
      activeHours.value = Array.from(
        new Set([...activeHours.value, invalidHourIndex])
      );
      ElMessage.warning("请为每个课时上传可读取时长的有效视频");
      return;
    }

    await newChapterFormRef.value.validate();

    addChapterLoading.value = true;

    // 提交数据
    const response = await createCourseChapter({
      courseId: currentCourse.value.courseId,
      chapter: {
        name: newChapterForm.value.name,
        hourList: newChapterForm.value.hourList.map(hour => ({
          resourceId: Number(hour.resourceId),
          duration: Number(hour.duration),
          title: hour.title,
          rType: hour.rType,
          fileUrl: hour.fileUrl
        }))
      }
    });

    if (response.code === 200) {
      ElMessage.success("章节添加成功");
      addChapterDialogVisible.value = false;
      // 重新获取课时列表
      await viewHours(currentCourse.value);
    } else {
      ElMessage.error(response.msg || "添加章节失败，请稍后重试");
    }
  } catch (error: any) {
    console.error("添加章节出错:", error);
    if (error.response && error.response.data) {
      ElMessage.error(error.response.data.msg || "添加章节失败，请稍后重试");
    } else if (error.message) {
      ElMessage.error(error.message);
    } else {
      ElMessage.error("添加章节失败，请稍后重试");
    }
  } finally {
    addChapterLoading.value = false;
  }
};

// 页面加载时获取数据
onMounted(async () => {
  // 先加载课程列表
  await fetchCourseList();
  // 再加载统计数据（这样如果统计API失败，可以用课程列表数据做备用）
  await fetchCourseStats();
});
</script>

<style lang="scss" scoped>
.main {
  margin: 10px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.search-form {
  margin-bottom: 20px;
}

.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 15px;
}

.chapter-item {
  margin-bottom: 20px;
}

.chapter-title {
  padding-left: 8px;
  margin-bottom: 8px;
  font-size: 16px;
  font-weight: bold;
  border-left: 3px solid #97b4f7;
}

.empty-text {
  padding: 20px 0;
  color: #909399;
  text-align: center;
}

.image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 50px;
  font-size: 12px;
  color: #909399;
  background-color: #f5f7fa;
}

.empty-state {
  padding: 40px 0;
  font-size: 16px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.course-header {
  display: flex;
  margin-bottom: 20px;
}

.course-thumb {
  margin-right: 20px;
  overflow: hidden;
  border-radius: var(--el-border-radius-base);
}

.course-info {
  flex: 1;

  h2 {
    margin-top: 0;
    margin-bottom: 10px;
    color: var(--el-text-color-primary);
  }

  .course-desc {
    margin-bottom: 15px;
    color: var(--el-text-color-regular);
  }
}

.meta-info {
  display: flex;
  flex-wrap: wrap;
}

.meta-item {
  margin-right: 20px;
  margin-bottom: 10px;
  color: var(--el-text-color-primary);

  label {
    margin-right: 5px;
    color: var(--el-text-color-secondary);
  }
}

.detail-section {
  margin-top: 15px;
  margin-bottom: 15px;

  h3 {
    margin-top: 0;
    font-size: 16px;
    color: var(--el-text-color-primary);
  }
}

.category-list {
  display: flex;
  flex-wrap: wrap;
}

.category-tag {
  margin-right: 10px;
  margin-bottom: 10px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
}

.upload-box {
  display: flex;
}

.upload-preview {
  position: relative;
  overflow: hidden;
  border-radius: var(--el-border-radius-base);

  .upload-actions {
    position: absolute;
    right: 5px;
    bottom: 5px;
  }
}

.upload-trigger {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 200px;
  height: 120px;
  cursor: pointer;
  background-color: var(--el-fill-color-blank);
  border: 1px dashed var(--el-border-color);
  border-radius: var(--el-border-radius-base);

  .upload-hint {
    margin-top: 10px;
    font-size: 12px;
    color: var(--el-text-color-placeholder);
  }
}

// 添加标签样式
.el-tag {
  margin-right: 5px;
}

// 修改操作按钮样式
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.button-row {
  display: flex;
  gap: 8px;
}

.category-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

// 避免每行只显示一个标签
.category-tag {
  margin: 0;
}

.course-form-dialog {
  .dialog-content-wrapper {
    max-height: 55vh;
    padding-right: 10px;
    overflow-y: auto;
  }
}

.allocation-header {
  padding-bottom: 10px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);

  h3 {
    margin-top: 0;
    margin-bottom: 8px;
    font-size: 18px;
    font-weight: bold;
    color: var(--el-text-color-primary);
  }

  p {
    margin: 0;
    color: var(--el-text-color-regular);
  }
}

// 章节标题样式
.chapter-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 8px;
  margin-bottom: 8px;
  font-size: 16px;
  font-weight: bold;
  color: var(--el-text-color-primary);
  border-left: 3px solid var(--el-color-primary);
}

// 新增章节相关样式
.hours-list {
  margin-top: 15px;
}

.hour-item {
  margin-bottom: 20px;
}

.hour-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.add-hour-btn {
  display: flex;
  justify-content: center;
  margin-top: 15px;
}

.form-section {
  margin-bottom: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.empty-placeholder {
  padding: 20px 0;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.hour-list {
  margin-top: 15px;
}

.hour-content {
  padding: 10px;
}

.hour-card {
  padding: 10px;
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
}

.required-mark {
  margin-left: 5px;
  color: var(--el-color-danger);
}

.hour-title-actions {
  float: right;
}

/* 上传相关样式 */
.upload-with-preview {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 150px;
  overflow: hidden;
  background-color: var(--el-fill-color-blank);
  border: 1px dashed var(--el-border-color);
  border-radius: var(--el-border-radius-base);
}

.resource-upload {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.upload-icon-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--el-text-color-placeholder);
  cursor: pointer;
}

.upload-tip {
  margin-top: 10px;
  font-size: 14px;
}

.resource-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 15px;
}

.resource-info {
  display: flex;
  gap: 8px;
  align-items: center;
  max-width: 70%;
}

.resource-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resource-actions {
  display: flex;
  gap: 8px;
}

.uploading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: var(--el-mask-color-extra-light);
}

.uploading-indicator {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  justify-content: center;
}

.search-card {
  overflow: hidden;
  border: none !important;
  border-radius: 16px;
  box-shadow: 0 4px 16px rgb(0 0 0 / 8%) !important;
}

.search-input {
  width: min(100%, 280px);
}

:deep(.el-dialog) {
  overflow: hidden;
  border-radius: 20px;

  .el-dialog__header {
    padding: 20px 24px 16px;
    border-bottom: 1px solid var(--el-border-color-lighter);

    .el-dialog__title {
      font-size: 18px;
      font-weight: 600;
    }
  }

  .el-dialog__body {
    padding: 24px;
  }

  .el-dialog__footer {
    padding: 16px 24px 20px;
    border-top: 1px solid var(--el-border-color-lighter);
  }
}

:deep(.el-button) {
  font-size: 14px;
  border-radius: 10px;
}

:deep(.el-input__wrapper) {
  border-radius: 10px;
}

:deep(.el-textarea__inner) {
  border-radius: 10px;
}

:deep(.el-select__wrapper) {
  border-radius: 10px;
}

:deep(.el-date-editor) {
  border-radius: 10px;
}

:deep(.el-table) {
  overflow: hidden;
  border-radius: 12px;
}

:deep(.el-card) {
  overflow: hidden;
  border-radius: 16px;
}

:deep(.el-card__header) {
  border-radius: 16px 16px 0 0;
}

:deep(.el-form-item__label) {
  font-size: 14px;
  font-weight: 500;
}

:deep(.el-checkbox__label),
:deep(.el-radio__label) {
  font-size: 14px;
}

:deep(.el-collapse) {
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
}

:deep(.el-collapse-item__header) {
  height: 48px;
  padding: 0 16px;
  font-size: 15px;
}

.course-action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

@media screen and (max-width: 768px) {
  .main {
    padding: 0;
    margin: 0;
  }

  .search-toolbar {
    flex-direction: column;
    align-items: stretch !important;
  }

  .search-form {
    width: 100%;
    margin-bottom: 0;
  }

  .course-action-buttons {
    width: 100%;
  }

  .course-action-buttons .el-button {
    flex: 1;
    margin-left: 0;
  }

  .pagination-container {
    justify-content: center;
  }

  .course-header,
  .section-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .course-thumb {
    margin-right: 0;
    margin-bottom: 12px;
  }

  .meta-info {
    flex-direction: column;
    gap: 8px;
  }

  .resource-preview {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .resource-info,
  .resource-actions {
    width: 100%;
    max-width: 100%;
  }

  :deep(.search-form .el-form-item) {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    margin-right: 0;
    margin-bottom: 12px;
  }

  :deep(.search-form .el-form-item__label) {
    width: 100%;
    justify-content: flex-start;
    padding: 0 0 6px;
    line-height: 1.4;
  }

  :deep(.search-form .el-form-item__content) {
    width: 100%;
    margin-left: 0 !important;
  }

  :deep(.search-form .el-input) {
    width: 100% !important;
  }

  :deep(.search-form__actions .el-form-item__content) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    width: 100%;
  }

  :deep(.search-form__actions .el-button) {
    margin-left: 0;
  }

  :deep(.course-pagination) {
    justify-content: center;
    flex-wrap: wrap;
  }

  :deep(.course-pagination .el-pagination__total),
  :deep(.course-pagination .el-pagination__jump) {
    display: none;
  }

  :deep(.el-dialog) {
    width: calc(100vw - 24px) !important;
    margin-top: 5vh !important;
  }

  :deep(.el-dialog__body) {
    padding: 16px;
  }

  .mobile-hour-list {
    display: grid;
    gap: 10px;
  }

  .mobile-hour-card {
    display: grid;
    gap: 8px;
    min-width: 0;
    padding: 12px;
    background: var(--el-bg-color-overlay);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 12px;
  }

  .mobile-hour-card__header,
  .mobile-hour-card__actions {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  }

  .mobile-hour-card__id,
  .mobile-hour-card__meta {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .mobile-hour-card__title {
    min-width: 0;
    margin: 0;
    overflow-wrap: anywhere;
    font-size: 15px;
    line-height: 1.5;
    color: var(--el-text-color-primary);
  }

  .mobile-hour-card__actions {
    justify-content: flex-end;
  }

  .mobile-hour-card__actions .el-button {
    min-width: 72px;
    min-height: 40px;
    margin-left: 0;
  }
}
</style>
