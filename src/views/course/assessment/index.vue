<template>
  <div
    :class="[
      'assessment-management flex h-[calc(100vh-160px)] overflow-hidden m-4 gap-4',
      { 'is-mobile-layout': isMobileLayout }
    ]"
  >
    <!-- 左侧课程选择侧边栏 -->
    <div
      class="course-sidebar w-[300px] flex flex-col bg-[var(--el-bg-color-overlay)] rounded-lg shadow-sm border border-[var(--el-border-color-light)] overflow-hidden"
    >
      <div
        class="p-4 border-b border-[var(--el-border-color-light)] bg-[var(--el-fill-color-light)]"
      >
        <h3
          class="text-lg font-bold text-[var(--el-text-color-primary)] mb-3 ml-1"
        >
          课程中心
        </h3>
        <el-input
          v-model="courseSearchQuery"
          placeholder="搜索课程..."
          clearable
          class="!w-full"
          @input="handleCourseSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>

      <div
        v-loading="courseLoading"
        class="flex-1 overflow-y-auto custom-scrollbar p-2"
      >
        <div
          v-for="course in courseOptions"
          :key="course.courseId"
          :class="[
            'course-item',
            selectedCourseId === course.courseId ? 'active' : ''
          ]"
          @click="selectCourse(course)"
        >
          <el-image
            :src="course.thumbUrl"
            class="w-12 h-9 rounded object-cover mr-3 bg-[var(--el-fill-color-light)]"
          >
            <template #error
              ><div
                class="flex items-center justify-center w-full h-full text-xs text-[var(--el-text-color-placeholder)]"
              >
                无图
              </div></template
            >
          </el-image>
          <div class="flex-1 overflow-hidden">
            <div
              class="course-name truncate text-sm font-medium text-[var(--el-text-color-primary)]"
            >
              {{ course.title }}
            </div>
            <div
              class="course-meta text-[11px] text-[var(--el-text-color-placeholder)] mt-0.5"
            >
              {{ course.isRequired === 1 ? "必修" : "选修" }} ·
              {{ course.userName }}
            </div>
          </div>
        </div>
        <el-empty
          v-if="courseOptions.length === 0"
          description="未找到匹配课程"
          :image-size="60"
        />
      </div>
    </div>

    <!-- 右侧内容管理区 -->
    <div
      class="assessment-panel flex-1 bg-[var(--el-bg-color-overlay)] rounded-lg shadow-sm border border-[var(--el-border-color-light)] flex flex-col overflow-hidden"
    >
      <template v-if="selectedCourseId">
        <div
          class="p-5 border-b border-[var(--el-border-color-light)] flex justify-between items-center bg-[var(--el-bg-color-overlay)]"
        >
          <div class="flex items-center gap-3">
            <h2 class="text-xl font-bold text-[var(--el-text-color-primary)]">
              {{ currentCourse?.title }}
            </h2>
            <el-tag
              :type="currentCourse?.isRequired === 1 ? 'danger' : 'success'"
              effect="plain"
              round
              size="small"
            >
              {{ currentCourse?.isRequired === 1 ? "必修" : "选修" }}
            </el-tag>
          </div>
          <div class="flex gap-4 text-sm text-[var(--el-text-color-secondary)]">
            <span>创建人: {{ currentCourse?.userName }}</span>
          </div>
        </div>

        <div class="flex-1 overflow-hidden flex flex-col p-5">
          <el-tabs
            v-model="activeTab"
            class="assessment-tabs flex-1 flex flex-col"
          >
            <el-tab-pane label="课程作业" name="homework">
              <homework-management
                :course-id="selectedCourseId"
                :course-end-time="currentCourse?.endTime"
              />
            </el-tab-pane>
            <el-tab-pane label="课程考试" name="exam">
              <exam-management :course-id="selectedCourseId" />
            </el-tab-pane>
          </el-tabs>
        </div>
      </template>

      <div
        v-else
        class="flex-1 flex flex-col items-center justify-center bg-[var(--el-fill-color-light)]"
      >
        <el-empty
          description="请从左侧选择一个课程开始管理"
          :image-size="120"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { getCourseList } from "@/api/course";
import { useAppStoreHook } from "@/store/modules/app";
import HomeworkManagement from "./components/HomeworkManagement.vue";
import ExamManagement from "./components/ExamManagement.vue";
import { Search } from "@element-plus/icons-vue";

// 标签页控制
const activeTab = ref("homework");
const appStore = useAppStoreHook();
const isMobileLayout = computed(() => appStore.getDevice === "mobile");

// 课程选择相关
const selectedCourseId = ref(null);
const courseOptions = ref([]);
const courseLoading = ref(false);
const currentCourse = ref(null);
const courseSearchQuery = ref("");

// 搜索课程
const handleCourseSearch = async () => {
  courseLoading.value = true;
  try {
    const { data } = await getCourseList({
      pageNum: 1,
      pageSize: 50,
      courseName: courseSearchQuery.value
    });
    courseOptions.value = data?.courseList || [];

    // 如果没有选中课程且列表有数据，默认选第一个
    if (!selectedCourseId.value && courseOptions.value.length > 0) {
      // selectCourse(courseOptions.value[0]);
    }
  } catch (error) {
    console.error("搜索课程失败", error);
  } finally {
    courseLoading.value = false;
  }
};

const selectCourse = (course: any) => {
  selectedCourseId.value = course.courseId;
  currentCourse.value = course;
};

// 获取初始课程列表
const fetchInitialCourses = async () => {
  courseLoading.value = true;
  try {
    const { data } = await getCourseList({
      pageNum: 1,
      pageSize: 50
    });
    courseOptions.value = data?.courseList || [];
  } catch (error) {
    console.error("获取课程列表失败", error);
    ElMessage.error("获取课程列表失败");
  } finally {
    courseLoading.value = false;
  }
};

// 页面加载时获取初始课程列表
onMounted(() => {
  fetchInitialCourses();
});
</script>

<style lang="scss" scoped>
.course-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 4px;
  cursor: pointer;
  border: 1px solid transparent;
  border-radius: 8px;
  transition: all 0.2s;

  &:hover {
    background-color: var(--el-fill-color-light);
  }

  &.active {
    background-color: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary-light-8);

    .course-name {
      color: var(--el-color-primary);
    }
  }
}

.assessment-tabs {
  :deep(.el-tabs__content) {
    flex: 1;
    padding-top: 15px;
    overflow-y: auto;
  }

  :deep(.el-tabs__header) {
    margin-bottom: 0;
  }
}

.custom-scrollbar {
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--el-border-color-lighter);
    border-radius: 10px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }
}

@mixin assessment-mobile-layout {
  height: auto !important;
  min-height: calc(100vh - 140px);
  margin: 0;
  gap: 12px;
  overflow: visible;
  flex-direction: column;
  padding: 0;
}

@mixin assessment-mobile-panel-layout {
  width: 100% !important;
  min-width: 0;
  border-radius: 20px;
}

.assessment-management.is-mobile-layout {
  @include assessment-mobile-layout;

  .course-sidebar,
  .assessment-panel {
    @include assessment-mobile-panel-layout;
  }

  .course-sidebar {
    max-height: 48vh;
  }

  .assessment-panel {
    min-height: calc(100vh - 280px);
  }
}

.assessment-management.is-mobile-layout .course-item {
  padding: 10px;
  border-radius: 12px;
}

.assessment-management.is-mobile-layout .assessment-tabs {
  :deep(.el-tabs__header) {
    overflow-x: auto;
  }

  :deep(.el-tabs__nav-wrap) {
    padding-bottom: 6px;
  }

  :deep(.el-tabs__item) {
    height: 40px;
    padding: 0 14px;
    font-size: 13px;
    white-space: nowrap;
  }
}

@media screen and (max-width: 768px) {
  .assessment-management {
    @include assessment-mobile-layout;

    .course-sidebar,
    .assessment-panel {
      @include assessment-mobile-panel-layout;
    }

    .course-sidebar {
      max-height: 48vh;
    }

    .assessment-panel {
      min-height: calc(100vh - 280px);
    }
  }

  .course-item {
    padding: 10px;
    border-radius: 12px;
  }

  .assessment-tabs {
    :deep(.el-tabs__header) {
      overflow-x: auto;
    }

    :deep(.el-tabs__nav-wrap) {
      padding-bottom: 6px;
    }

    :deep(.el-tabs__item) {
      height: 40px;
      padding: 0 14px;
      font-size: 13px;
      white-space: nowrap;
    }
  }
}
</style>
