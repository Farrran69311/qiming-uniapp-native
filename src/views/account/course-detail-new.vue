<template>
  <div class="course-detail-root" :class="currentTheme">
    <div class="layout-container" :class="currentTheme">
      <!-- 侧边栏菜单 -->
      <CourseSidebar
        :current-theme="currentTheme"
        :active-menu="activeMenu"
        @menu-click="handleMenuClick"
      />

      <div class="layout-inner-content" :class="currentTheme">
        <!-- 课程资料 -->
        <CourseMaterials
          :visible="activeMenu === 'course-materials'"
          :current-theme="currentTheme"
          :course-attr-list="courseAttrList"
          :user-avatar="userAvatar"
          :user-nickname="userNickname"
          @go-back="goBack"
          @toggle-theme="toggleTheme"
          @go-to-account="goToAccount"
          @logout="handleLogout"
        />

        <!-- HTML 动画列表 -->
        <HtmlAnimations
          :visible="activeMenu === 'html-animations'"
          :current-theme="currentTheme"
          :loading="htmlAnimationLoading"
          :animation-list="htmlAnimationList"
          :user-avatar="userAvatar"
          :user-nickname="userNickname"
          @go-back="goBack"
          @toggle-theme="toggleTheme"
          @go-to-account="goToAccount"
          @logout="handleLogout"
        />

        <!-- 作业考试 -->
        <HomeworkExam
          :visible="activeMenu === 'homework-exam'"
          :current-theme="currentTheme"
          :course-id="courseId"
          :homework-list="homeworkList"
          :exam-list="examList"
          :user-avatar="userAvatar"
          :user-nickname="userNickname"
          @go-back="goBack"
          @toggle-theme="toggleTheme"
          @go-to-account="goToAccount"
          @logout="handleLogout"
        />

        <!-- 课程成绩 -->
        <CourseGrades
          :visible="activeMenu === 'grades'"
          :current-theme="currentTheme"
          :course-id="courseId"
          :course-scores="courseScores"
          :user-avatar="userAvatar"
          :user-nickname="userNickname"
          @go-back="goBack"
          @toggle-theme="toggleTheme"
          @go-to-account="goToAccount"
          @logout="handleLogout"
        />

        <!-- 课程学习、知识点、课程问答 - 保持原有结构，后续可继续拆分 -->
        <!-- 这些模块较复杂，包含 AI 助教等交互功能，暂时保留在主文件中 -->

        <!-- 课程学习占位 -->
        <div
          v-show="activeMenu === 'course-learn'"
          class="course-learn-placeholder"
        >
          <CourseHeader
            :current-theme="currentTheme"
            title="章节模式"
            :user-avatar="userAvatar"
            :user-nickname="userNickname"
            @go-back="goBack"
            @toggle-theme="toggleTheme"
            @go-to-account="goToAccount"
            @logout="handleLogout"
          />
          <div class="placeholder-content">
            <p>课程学习模块（包含视频播放、目录、AI助教）</p>
            <p>该模块较复杂，建议后续继续拆分为：</p>
            <ul>
              <li>CourseVideoPlayer.vue - 视频播放器</li>
              <li>CourseCatalog.vue - 课程目录</li>
              <li>AiAssistant.vue - AI助教对话</li>
            </ul>
          </div>
        </div>

        <!-- 知识点占位 -->
        <div v-show="activeMenu === 'mastery'" class="mastery-placeholder">
          <CourseHeader
            :current-theme="currentTheme"
            title="知识点掌握"
            :user-avatar="userAvatar"
            :user-nickname="userNickname"
            @go-back="goBack"
            @toggle-theme="toggleTheme"
            @go-to-account="goToAccount"
            @logout="handleLogout"
          />
          <div class="placeholder-content">
            <p>知识点掌握模块</p>
            <p>该模块包含图表展示，建议后续拆分为 MasteryPage.vue</p>
          </div>
        </div>

        <!-- 课程问答占位 -->
        <div v-show="activeMenu === 'course-qa'" class="course-qa-placeholder">
          <CourseHeader
            :current-theme="currentTheme"
            title="课程问答"
            :user-avatar="userAvatar"
            :user-nickname="userNickname"
            @go-back="goBack"
            @toggle-theme="toggleTheme"
            @go-to-account="goToAccount"
            @logout="handleLogout"
          />
          <div class="placeholder-content">
            <p>课程问答模块</p>
            <p>该模块包含聊天功能，建议后续拆分为 CourseQA.vue</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from "vue";
import { useRouter, useRoute } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { storageLocal } from "@pureadmin/utils";
import { formatAvatar } from "@/utils/avatar";
import { userKey } from "@/utils/auth";
import { useUserStoreHook } from "@/store/modules/user";

// 导入拆分后的组件
import {
  CourseHeader,
  CourseSidebar,
  CourseMaterials,
  HtmlAnimations,
  HomeworkExam,
  CourseGrades
} from "./course-detail/index";

// 导入 API
import {
  getCourseDetail,
  getCourseScore,
  CourseScoreResult
} from "@/api/frontend/course";
import {
  getUserCourseHomeworkList,
  getUserCourseExamList
} from "@/api/frontend/work";
import { getHtmlAnimationDisplay } from "@/api/htmlAnimation";

// 导入资源
import avatarDefault from "@/assets/course-detail-images/avatar-default.png";

const router = useRouter();
const route = useRoute();

// 基础状态
const baseCourseId = ref<number | null>(null);
const courseId = computed(() => baseCourseId.value);
const courseDetail = ref<any>(null);
const loading = ref(false);
const currentTheme = ref(
  (storageLocal().getItem("course_theme") as string) || "light"
);
const activeMenu = ref(
  (storageLocal().getItem(
    `course_detail_active_menu_${route.params.id}`
  ) as string) || "course-learn"
);

// 监听路由参数变化，处理课程切换
watch(
  () => route.params.id,
  newId => {
    if (newId) {
      const id = Number(newId);
      baseCourseId.value = id;

      // 恢复新课程的菜单状态
      const savedMenu = storageLocal().getItem(
        `course_detail_active_menu_${id}`
      ) as string;
      activeMenu.value = savedMenu || "course-learn";

      fetchCourseDetail();

      // 如果不是默认页，加载对应数据
      if (activeMenu.value !== "course-learn") {
        const menuName = activeMenu.value;
        if (menuName === "homework-exam") {
          fetchHomeworkList();
          fetchExamList();
        } else if (menuName === "grades") {
          fetchCourseScores();
        } else if (menuName === "html-animations") {
          fetchHtmlAnimations();
        }
      }
    }
  }
);

// 用户信息
const userStore = useUserStoreHook();
const userAvatar = computed(() =>
  formatAvatar(userStore.avatar, avatarDefault)
);
const userNickname = computed(
  () => userStore.nickname || userStore.username || "用户"
);

// 课程资料
const courseAttrList = ref<any[]>([]);

// HTML 动画
const htmlAnimationList = ref<any[]>([]);
const htmlAnimationLoading = ref(false);

// 作业考试
const homeworkList = ref<any[]>([]);
const examList = ref<any[]>([]);

// 成绩
const courseScores = ref<CourseScoreResult | null>(null);

// 主题切换
const toggleTheme = () => {
  const oldTheme = currentTheme.value;
  const newTheme = oldTheme === "light" ? "dark" : "light";

  document.documentElement.classList.remove(oldTheme);
  document.documentElement.classList.add(newTheme);
  document.body.classList.remove(oldTheme);
  document.body.classList.add(newTheme);

  currentTheme.value = newTheme;
};

// 菜单切换
const handleMenuClick = (menuName: string) => {
  activeMenu.value = menuName;

  // 根据菜单加载对应数据
  if (menuName === "homework-exam") {
    fetchHomeworkList();
    fetchExamList();
  }

  if (menuName === "grades") {
    fetchCourseScores();
  }

  if (menuName === "html-animations") {
    fetchHtmlAnimations();
  }
};

// 返回
const goBack = () => {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push("/account");
  }
};

// 跳转账号管理
const goToAccount = () => {
  if (
    useUserStoreHook().roles?.includes("admin") ||
    useUserStoreHook().roles?.includes("teacher")
  ) {
    router.push("/welcome");
  } else {
    router.push("/account");
  }
};

// 退出登录
const handleLogout = () => {
  ElMessageBox.confirm("确定要退出登录吗？", "提示", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning",
    customClass: "custom-message-box"
  })
    .then(() => {
      useUserStoreHook().logOut();
    })
    .catch(() => {});
};

// 获取课程详情
const fetchCourseDetail = async () => {
  if (!courseId.value) return;

  loading.value = true;
  try {
    const { code, data, msg } = await getCourseDetail({
      courseId: courseId.value
    });

    if (code === 200 && data) {
      courseDetail.value = data;
      if (data.courseAttrList) {
        courseAttrList.value = data.courseAttrList;
      }
    } else {
      ElMessage.error(msg || "获取课程详情失败");
    }
  } catch (error) {
    console.error("获取课程详情出错:", error);
    ElMessage.error("获取课程详情数据失败，请稍后重试");
  } finally {
    loading.value = false;
  }
};

// 获取作业列表
const fetchHomeworkList = async () => {
  if (!courseId.value) return;

  try {
    const { code, data, msg } = await getUserCourseHomeworkList({
      courseId: courseId.value
    });

    if (code === 200 && data && (data as any).list) {
      homeworkList.value = (data as any).list;
    }
  } catch (error) {
    console.error("获取作业列表出错:", error);
  }
};

// 获取考试列表
const fetchExamList = async () => {
  if (!courseId.value) return;

  try {
    const { code, data, msg } = await getUserCourseExamList({
      courseId: courseId.value
    });

    if (code === 200 && data && (data as any).list) {
      examList.value = (data as any).list;
    }
  } catch (error) {
    console.error("获取考试列表出错:", error);
  }
};

// 获取 HTML 动画
const fetchHtmlAnimations = async () => {
  if (!courseDetail.value) return;
  htmlAnimationLoading.value = true;

  try {
    const chapters = courseDetail.value.courseChapterList || [];
    const results = await Promise.all(
      chapters.map(async (ch: any) => {
        try {
          const response: any = await getHtmlAnimationDisplay({
            courseId: courseDetail.value.courseId,
            chapterId: ch.chapterId
          });
          const data = response?.data || response;
          if (data?.url) {
            return {
              chapterId: ch.chapterId,
              chapterName: ch.name || ch.chapterName,
              version: data.version,
              url: data.url,
              coverUrl: data.coverUrl || data.previewUrl,
              previewUrl: data.previewUrl || data.coverUrl,
              previewVideoUrl: data.previewVideoUrl,
              available: data.available !== false,
              message: data.message,
              status: "ready"
            };
          }
          if (data?.available === false) {
            return {
              chapterId: ch.chapterId,
              chapterName: ch.name || ch.chapterName,
              version: "",
              url: "",
              available: false,
              message: data.message || "暂无可用HTML动画版本",
              status: "unavailable"
            };
          }
        } catch (e) {
          const status = e?.response?.status;
          const message =
            e?.response?.data?.message ||
            e?.response?.data?.msg ||
            e?.message ||
            "";
          if (status === 404) {
            return {
              chapterId: ch.chapterId,
              chapterName: ch.name || ch.chapterName,
              version: "",
              url: "",
              available: false,
              message: message || "暂无可展示动画",
              status:
                message.includes("对象不存在") || message.includes("版本对象")
                  ? "missing"
                  : "unavailable"
            };
          }
          return null;
        }
        return null;
      })
    );

    const animationData = results.filter(item => item !== null);
    const uniqueMap = new Map();
    animationData.forEach(item => {
      if (!uniqueMap.has(item.chapterId)) {
        uniqueMap.set(item.chapterId, item);
      }
    });

    htmlAnimationList.value = Array.from(uniqueMap.values());
  } finally {
    htmlAnimationLoading.value = false;
  }
};

// 获取课程成绩
const fetchCourseScores = async () => {
  if (!courseId.value) return;

  try {
    const response = await getCourseScore({ courseId: courseId.value });
    if (response && response.code === 200 && response.data) {
      courseScores.value = response.data;
    }
  } catch (error) {
    console.error("获取课程成绩失败:", error);
  }
};

onMounted(async () => {
  document.body.classList.add("course-page");
  baseCourseId.value = Number(route.params.id);
  document.body.classList.add(currentTheme.value);
  await fetchCourseDetail();

  // 初始化加载对应数据（如果不是默认页）
  if (activeMenu.value !== "course-learn") {
    const menuName = activeMenu.value;
    if (menuName === "homework-exam") {
      fetchHomeworkList();
      fetchExamList();
    } else if (menuName === "grades") {
      fetchCourseScores();
    } else if (menuName === "html-animations") {
      fetchHtmlAnimations();
    }
  }
});

// 监听菜单变化并持久化
watch(activeMenu, newVal => {
  storageLocal().setItem(
    `course_detail_active_menu_${route.params.id}`,
    newVal
  );
  // 加载对应数据
  if (newVal === "homework-exam") {
    fetchHomeworkList();
    fetchExamList();
  } else if (newVal === "grades") {
    fetchCourseScores();
  } else if (newVal === "html-animations") {
    fetchHtmlAnimations();
  }
});

// 监听主题变化
watch(
  currentTheme,
  val => {
    storageLocal().setItem("course_theme", val);
    const other = val === "light" ? "dark" : "light";
    document.documentElement.classList.remove(other);
    document.documentElement.classList.add(val);
    document.body.classList.remove(other);
    document.body.classList.add(val);

    // 同步到管理后台主题设置
    const layout = storageLocal().getItem("responsive-layout") as any;
    if (layout) {
      layout.darkMode = val === "dark";
      storageLocal().setItem("responsive-layout", layout);
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  document.body.classList.remove("course-page");
  document.documentElement.classList.remove("dark", "light");
  document.body.classList.remove("dark", "light");
});
</script>

<style lang="scss">
@import url("@/../coursecss/css/chunk-b3e9f934.1c00050a.css");
@import url("@/../coursecss/css/chunk-8cf7ce30.92e48af1.css");
@import url("@/../coursecss/css/chunk-3cf64ec0.4f07a253.css");
@import url("@/../coursecss/css/chunk-3248eec0.130a3cd9.css");
@import url("@/../coursecss/css/app.a5f91bbb.css");
@import url("@/../coursecss/css/chunk-b4b575b6.fcb08796.css");

.course-detail-root {
  width: 100%;
  min-height: 100vh;
  background-color: #fff;

  &.dark {
    background-color: #1a1a1a;
  }

  .layout-container {
    position: relative;
    display: flex;
    width: 100%;
    min-height: 100vh;

    &.dark {
      background-color: #1a1a1a;
    }
  }

  .layout-inner-content {
    position: relative;
    flex: 1;
    height: calc(100vh - 35px);
    margin: 20px 15px 15px 90px;
    overflow: hidden;
    background-color: #f5f7fa;
    border: 1px solid #eef2f7;
    border-radius: 24px;
    box-shadow: 0 10px 40px -10px rgb(64 158 255 / 10%);
    transition: all 0.3s ease;

    &.dark {
      background-color: #1a1a1a;
      border: 1px solid rgb(60 60 80 / 80%);
      box-shadow: 0 8px 32px -4px rgb(0 0 0 / 60%);
    }
  }
}
</style>

<style scoped lang="scss">
@keyframes sidebar-glow-border {
  0% {
    background-position: 0% 0%;
  }

  100% {
    background-position: 200% 0%;
  }
}

.course-learn-placeholder,
.mastery-placeholder,
.course-qa-placeholder {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.placeholder-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #909399;

  p {
    margin: 10px 0;
  }

  ul {
    margin-top: 20px;
    text-align: left;
  }

  li {
    margin: 8px 0;
    color: #606266;
  }
}

/* 侧边栏样式 */
:deep(.layout-sidebar) {
  position: fixed;
  top: 20px;
  left: 10px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 80px;
  min-width: 80px;
  height: calc(100vh - 35px);
  padding: 15px 0;
  overflow: hidden auto;
  background: rgb(255 255 255 / 80%);
  border: 1px solid rgb(64 158 255 / 20%);
  border-radius: 24px;
  box-shadow: 0 8px 32px -4px rgb(64 158 255 / 20%);
  backdrop-filter: blur(20px) saturate(180%);

  &::after {
    position: absolute;
    inset: 0;
    padding: 1.5px;
    pointer-events: none;
    content: "";
    background: linear-gradient(90deg, #97b4f7, #604ffd, #97b4f7);
    background-size: 200% 100%;
    border-radius: 24px;
    mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    mask-composite: exclude;
    animation: sidebar-glow-border 3s linear infinite;
  }

  &.dark {
    background: rgb(30 30 40 / 90%);
    border: 1px solid rgb(255 255 255 / 10%);
    box-shadow: 0 8px 32px -4px rgb(0 0 0 / 60%);
  }
}

:deep(.layout-header) {
  top: 20px;
  left: 95px;
  z-index: 150;
  width: calc(100% - 110px);
  background: rgb(255 255 255 / 90%);
  border: 1px solid rgb(0 0 0 / 5%);
  border-radius: 20px;
  box-shadow: 0 4px 12px rgb(0 0 0 / 5%);
  backdrop-filter: blur(10px);

  &.dark {
    background: rgb(26 26 26 / 90%);
    border: 1px solid rgb(255 255 255 / 10%);
    box-shadow: 0 4px 12px rgb(0 0 0 / 30%);
  }
}

/* 占位内容样式 */
</style>
