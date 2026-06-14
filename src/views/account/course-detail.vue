<template>
  <div ref="courseRootEl" class="course-detail-root" :class="currentTheme">
    <div class="layout-container" :class="currentTheme">
      <!-- 侧边栏菜单 -->
      <CourseSidebar
        :current-theme="currentTheme"
        :active-menu="activeMenu"
        @menu-click="handleMenuClick"
      />

      <div class="layout-inner-content" :class="currentTheme">
        <!-- 课程学习 (视频、目录、AI助教) -->
        <CourseStudy
          v-if="courseId"
          ref="courseStudyRef"
          :visible="activeMenu === 'course-learn'"
          :current-theme="currentTheme"
          :user-avatar="userAvatar"
          :user-nickname="userNickname"
          :course-name="courseDetail?.courseName"
          :course-id="courseId"
          :chapter-id="currentChapterId"
          :current-hour="currentHour"
          :current-video-url="currentVideoUrl"
          :loading="loading"
          :is-ai-dialog-visible="isAiDialogVisible"
          :chat-messages="chatMessages"
          :is-typing="isTyping"
          :sending-message="sendingMessage"
          :chapter-list="courseDetail?.courseChapterList"
          :active-node="activeNode"
          @go-back="goBack"
          @toggle-theme="e => toggleTheme(e)"
          @go-to-account="goToAccount"
          @logout="handleLogout"
          @video-loaded="videoLoaded"
          @video-ended="videoEnded"
          @open-ai="openAiDialog"
          @close-ai="closeAiDialog"
          @clear-chat="clearChat"
          @send-message="handleSendMessage"
          @node-click="handleNodeClick"
        />

        <!-- 知识点掌握 -->
        <MasteryPage
          :visible="activeMenu === 'mastery'"
          :current-theme="currentTheme"
          :study-effect-data="studyEffectData"
          :user-avatar="userAvatar"
          :user-nickname="userNickname"
          @go-back="goBack"
          @toggle-theme="e => toggleTheme(e)"
          @go-to-account="goToAccount"
          @logout="handleLogout"
        />

        <!-- 课程问答 -->
        <CourseQA
          ref="courseQARef"
          :visible="activeMenu === 'course-qa'"
          :current-theme="currentTheme"
          :course-id="courseId"
          :user-id="userIdStr"
          :user-avatar="userAvatar"
          :user-nickname="userNickname"
          :is-teacher="isTeacher"
          :is-admin="isAdmin"
          @go-back="goBack"
          @toggle-theme="e => toggleTheme(e)"
          @go-to-account="goToAccount"
          @logout="handleLogout"
        />

        <!-- 作业考试 -->
        <HomeworkExam
          v-if="courseId"
          :visible="activeMenu === 'homework-exam'"
          :current-theme="currentTheme"
          :course-id="courseId"
          :homework-list="homeworkList"
          :exam-list="examList"
          :user-avatar="userAvatar"
          :user-nickname="userNickname"
          @go-back="goBack"
          @toggle-theme="e => toggleTheme(e)"
          @go-to-account="goToAccount"
          @logout="handleLogout"
        />

        <!-- 课程资料 -->
        <CourseMaterials
          :visible="activeMenu === 'course-materials'"
          :current-theme="currentTheme"
          :course-attr-list="courseAttrList"
          :user-avatar="userAvatar"
          :user-nickname="userNickname"
          @go-back="goBack"
          @toggle-theme="e => toggleTheme(e)"
          @go-to-account="goToAccount"
          @logout="handleLogout"
        />

        <!-- HTML 动画 -->
        <HtmlAnimations
          :visible="activeMenu === 'html-animations'"
          :current-theme="currentTheme"
          :loading="htmlAnimationLoading"
          :animation-list="htmlAnimationList"
          :user-avatar="userAvatar"
          :user-nickname="userNickname"
          @go-back="goBack"
          @toggle-theme="e => toggleTheme(e)"
          @go-to-account="goToAccount"
          @logout="handleLogout"
        />

        <!-- 课程成绩 -->
        <CourseGrades
          :visible="activeMenu === 'grades'"
          :current-theme="currentTheme"
          :course-scores="courseScores"
          :user-avatar="userAvatar"
          :user-nickname="userNickname"
          :course-id="courseId"
          @go-back="goBack"
          @toggle-theme="e => toggleTheme(e)"
          @go-to-account="goToAccount"
          @logout="handleLogout"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  onActivated,
  nextTick,
  watch,
  onBeforeUnmount
} from "vue";
import { useRouter, useRoute } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { storageLocal } from "@pureadmin/utils";
import { formatAvatar } from "@/utils/avatar";
import { getSavedCourseTheme, setSavedCourseTheme } from "@/utils/courseTheme";
import { userKey } from "@/utils/auth";
import { useUserStoreHook } from "@/store/modules/user";
import { setAiScreenCaptureVisibilityOverride } from "@/components/AiScreenCapture/visibility";

// 导入 API
import {
  getCourseDetail,
  reportCourseLesson,
  type CourseScoreResult,
  getCourseScore,
  getCourseStudyEffect
} from "@/api/frontend/course";
import { getUserDetail } from "@/api/user";
import {
  courseAIChatStream,
  getConversationHistory
} from "@/api/frontend/chat";
import {
  getUserCourseHomeworkList,
  getUserCourseExamList
} from "@/api/frontend/work";
import { getHtmlAnimationDisplay } from "@/api/htmlAnimation";

// 导入拆分后的组件
import {
  CourseSidebar,
  CourseStudy,
  MasteryPage,
  CourseQA,
  HomeworkExam,
  CourseMaterials,
  HtmlAnimations,
  CourseGrades
} from "./course-detail/index";

// 导入资源
import avatarDefault from "@/assets/course-detail-images/avatar-default.png";

const router = useRouter();
const route = useRoute();

// 基础状态
const baseCourseId = ref<number | null>(null);
const courseId = computed(() => baseCourseId.value);
const courseDetail = ref<any>(null);
const loading = ref(false);
const currentTheme = ref(getSavedCourseTheme("light"));
const activeMenu = ref(
  (storageLocal().getItem(
    `course_detail_active_menu_${route.params.id}`
  ) as string) || "course-learn"
);

// 监听菜单变化并持久化
watch(activeMenu, newVal => {
  storageLocal().setItem(
    `course_detail_active_menu_${route.params.id}`,
    newVal
  );
  // 切换菜单时加载对应数据
  if (newVal === "homework-exam") {
    fetchHomeworkList();
    fetchExamList();
  } else if (newVal === "grades") {
    fetchCourseScores();
  } else if (newVal === "html-animations") {
    fetchHtmlAnimations();
  } else if (newVal === "mastery") {
    fetchCourseStudyEffect();
  } else if (newVal === "course-qa") {
    nextTick(() => {
      if (courseId.value) {
        courseQARef.value?.refreshData?.();
      }
    });
  }

  nextTick(() => {
    scheduleMobileTopOffsetUpdate();
  });
});

// 监听路由参数变化，处理课程切换
watch(
  () => route.params.id,
  newId => {
    if (newId) {
      const id = Number(newId);
      baseCourseId.value = id;
      courseScores.value = null;

      // 恢复新课程的菜单状态
      const savedMenu = storageLocal().getItem(
        `course_detail_active_menu_${id}`
      ) as string;
      activeMenu.value = savedMenu || "course-learn";

      // 恢复新课程的课时状态
      const savedNode = storageLocal().getItem(
        `course_detail_active_node_${id}`
      ) as string;
      activeNode.value = savedNode || "1.1";

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
        } else if (menuName === "mastery") {
          fetchCourseStudyEffect();
        }
      }

      nextTick(() => {
        scheduleMobileTopOffsetUpdate();
      });
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
// 将userId 转换为字符串（CourseQA 期望字符串类型）
const userIdStr = computed(() => {
  if (userStore.userId === null || userStore.userId === undefined) return "";
  return String(userStore.userId);
});
// 从 localStorage 获取 roleType判断是否是教师/管理员
const userRoleType = computed(() => {
  const userInfo = storageLocal().getItem<any>(userKey);
  return userInfo?.roleType ?? 0;
});
const isTeacher = computed(() => userRoleType.value === 2);
const isAdmin = computed(() => userRoleType.value === 3);
const showStudentScreenCapture = computed(
  () =>
    !isTeacher.value && !isAdmin.value && activeMenu.value !== "homework-exam"
);

watch(
  showStudentScreenCapture,
  visible => {
    setAiScreenCaptureVisibilityOverride(visible);
  },
  { immediate: true }
);

// 课程学习相关
const courseStudyRef = ref(null);
const courseQARef = ref<any>(null);
const currentHour = ref(null);
const currentVideoUrl = ref("");
const activeNode = ref(
  (storageLocal().getItem(
    `course_detail_active_node_${route.params.id}`
  ) as string) || "1.1"
);
const autoPlayOnLoad = ref(false);
const currentChapterId = computed(() => {
  if (!currentHour.value || !courseDetail.value?.courseChapterList) return 0;
  for (const chapter of courseDetail.value.courseChapterList) {
    if (chapter.hourList?.some(h => h.hourId === currentHour.value.hourId)) {
      return chapter.chapterId;
    }
  }
  return 0;
});

// AI 聊天相关
const isAiDialogVisible = ref(false);
const conversationId = ref("");
const previousChapterId = ref<number | null>(null);
const chatMessages = ref<any[]>([]);
const isTyping = ref(false);
const sendingMessage = ref(false);
const cancelStreamRequest = ref<any>(null);

// 知识点掌握相关
const studyEffectData = ref<any>({
  courseId: 0,
  keyPointNum: 0,
  difficultPointNum: 0,
  knowledgePointNum: 0,
  conceptNum: 0,
  chapterList: []
});

// 课程问答相关
const qaStats = ref({
  totalQuestions: 12,
  solvedQuestions: 10,
  solveRate: "83%",
  avgResponseTime: "5分钟"
});
const qaHistoryList = ref<any[]>([]);

// 作业考试相关
const homeworkList = ref<any[]>([]);
const examList = ref<any[]>([]);

// 课程资料相关
const courseAttrList = ref<any[]>([]);

// HTML 动画相关
const htmlAnimationList = ref<any[]>([]);
const htmlAnimationLoading = ref(false);

// 成绩相关
const courseScores = ref<CourseScoreResult | null>(null);

const MOBILE_BREAKPOINT = 767;
const courseRootEl = ref<HTMLElement | null>(null);
let mobileOffsetRafId: number | null = null;

const isNativeCourseWebView = () =>
  typeof document !== "undefined" &&
  document.documentElement.classList.contains("qiming-native-webview");

const isCourseMobileViewport = () =>
  typeof window !== "undefined" &&
  (window.innerWidth <= MOBILE_BREAKPOINT || isNativeCourseWebView());

const updateMobileTopOffset = () => {
  const root = courseRootEl.value;
  if (!root) return;

  const isNative = isNativeCourseWebView();
  if (!isNative && window.innerWidth > MOBILE_BREAKPOINT) {
    root.style.removeProperty("--course-mobile-top-offset");
    return;
  }

  const headerEl = document.querySelector(
    ".layout-header"
  ) as HTMLElement | null;
  const sidebarEl = document.querySelector(
    "#layout-sidebar"
  ) as HTMLElement | null;
  const headerBottom = headerEl?.getBoundingClientRect().bottom ?? 0;
  const sidebarBottom = sidebarEl?.getBoundingClientRect().bottom ?? 0;
  const sidebarCollapsed =
    sidebarEl?.classList.contains("mobile-collapsed") ?? false;
  const safeGap = isNative ? 14 : 12;
  const measuredOffset = Math.ceil(
    Math.max(headerBottom, sidebarCollapsed ? 0 : sidebarBottom) + safeGap
  );
  const fallbackOffset = sidebarCollapsed
    ? isNative
      ? 106
      : 92
    : isNative
      ? 174
      : 158;

  root.style.setProperty(
    "--course-mobile-top-offset",
    `${Math.max(measuredOffset, fallbackOffset)}px`
  );
  root.style.setProperty(
    "--course-mobile-fab-clearance",
    isNative ? "64px" : "72px"
  );
};

const scheduleMobileTopOffsetUpdate = () => {
  if (mobileOffsetRafId !== null) {
    cancelAnimationFrame(mobileOffsetRafId);
  }

  mobileOffsetRafId = requestAnimationFrame(() => {
    mobileOffsetRafId = null;
    updateMobileTopOffset();
  });
};

const handleViewportResize = () => {
  scheduleMobileTopOffsetUpdate();
};

const COURSE_SCROLL_CONTAINERS = [
  ".app-main",
  ".app-main-nofixed-header",
  ".layout-inner-content",
  ".study-container",
  ".message-board-container",
  ".mastery-page-content",
  ".homework-container",
  ".materials-container",
  ".course-grades-container",
  ".animations-container",
  ".left-scroll",
  ".el-scrollbar__wrap"
];

const resetCourseScrollPosition = () => {
  if (!isCourseMobileViewport()) return;

  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  COURSE_SCROLL_CONTAINERS.forEach(selector => {
    document.querySelectorAll<HTMLElement>(selector).forEach(el => {
      el.scrollTop = 0;
      el.scrollLeft = 0;
    });
  });
};

const handleCourseSidebarCollapseChange = () => {
  scheduleMobileTopOffsetUpdate();
};

// ================= 方法 =================

// 主题切换
const toggleTheme = (event?: MouseEvent) => {
  if (loading.value) return;

  const x = event?.clientX ?? window.innerWidth / 2;
  const y = event.clientY ?? window.innerHeight / 2;
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  // 创建扩散遮罩层 (全浏览器兼容方案)
  const overlay = document.createElement("div");
  const isToDark = currentTheme.value === "light";

  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 2147483647;
    pointer-events: none;
    background: ${isToDark ? "#1a1a1a" : "#f5f7fa"};
    clip-path: circle(0px at ${x}px ${y}px);
    transition: clip-path 600ms cubic-bezier(0.4, 0, 0.2, 1);
  `;
  document.body.appendChild(overlay);

  // 触发扩散
  requestAnimationFrame(() => {
    overlay.style.clipPath = `circle(${endRadius}px at ${x}px ${y}px)`;
  });

  // 切换实际主题
  setTimeout(() => {
    performThemeToggle();
    nextTick(() => {
      // 渐隐移除遮罩
      overlay.style.transition =
        "opacity 500ms ease, clip-path 600ms cubic-bezier(0.4, 0, 0.2, 1)";
      overlay.style.opacity = "0";

      setTimeout(() => {
        overlay.remove();
      }, 500);
    });
  }, 500);
};

const performThemeToggle = () => {
  const oldTheme = currentTheme.value;
  const newTheme = oldTheme === "light" ? "dark" : "light";
  currentTheme.value = newTheme;
};

const resolveVideoPlayerEl = () => {
  const player = (courseStudyRef.value as any)?.videoPlayer;
  if (!player) return null;
  return (player as any).value ?? player;
};

// 监听主题变化
watch(
  currentTheme,
  val => {
    setSavedCourseTheme(val);
    const other = val === "light" ? "dark" : "light";
    document.documentElement.classList.remove(other);
    document.documentElement.classList.add(val);
    document.body.classList.remove(other);
    document.body.classList.add(val);

    // 同步到管理后台主题设置
    nextTick(() => {
      scheduleMobileTopOffsetUpdate();
    });
  },
  { immediate: true }
);

// 菜单切换
const handleMenuClick = (menuName: string) => {
  activeMenu.value = menuName;

  // 如果视频正在播放且切换到了非课程学习菜单，则暂停视频
  const videoPlayerEl = resolveVideoPlayerEl();
  if (menuName !== "course-learn" && videoPlayerEl) {
    if (typeof videoPlayerEl.pause === "function" && !videoPlayerEl.paused) {
      videoPlayerEl.pause();
    }
  }

  requestAnimationFrame(() => {
    resetCourseScrollPosition();
    scheduleMobileTopOffsetUpdate();
  });

  // 数据加载统一由 watch(activeMenu) 处理，避免重复请求
};

// 返回
const goBack = () => {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push("/account");
  }
};

const goBackToCourseList = () => {
  router.push({
    path: "/account",
    query: {
      ...route.query,
      menu: "course",
      qimingNative: "1"
    }
  });
};

const handleNativeBack = (event: Event) => {
  if (!document.documentElement.classList.contains("qiming-native-webview")) {
    return;
  }
  event.preventDefault();
  goBackToCourseList();
};

// 跳转账号管理
const goToAccount = () => {
  // 课程详情页是从学生中心进入的，账号管理应跳转回学生中心
  router.push("/account");
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
      if (data.courseAttrList) courseAttrList.value = data.courseAttrList;

      // 恢复上次观看的课时或默认加载第一个课时
      if (data.courseChapterList?.length > 0) {
        const savedNodeId = storageLocal().getItem(
          `course_detail_active_node_${courseId.value}`
        ) as string;
        let targetHour = null;
        let targetNodeId = "1.1";

        if (savedNodeId) {
          const parts = savedNodeId.split(".");
          if (parts.length === 2) {
            const cIdx = parseInt(parts[0]) - 1;
            const hIdx = parseInt(parts[1]) - 1;
            targetHour = data.courseChapterList[cIdx]?.hourList?.[hIdx];
            if (targetHour) {
              targetNodeId = savedNodeId;
            }
          }
        }

        if (!targetHour) {
          targetHour = data.courseChapterList[0].hourList?.[0];
        }

        if (targetHour) {
          currentHour.value = targetHour;
          currentVideoUrl.value = targetHour.fileUrl;
          activeNode.value = targetNodeId;
          // 只有在课程学习标签页时才自动播放
          autoPlayOnLoad.value = activeMenu.value === "course-learn";
        }
      }
    } else {
      ElMessage.error(msg || "获取课程详情失败");
    }
  } catch (error) {
    console.error("获取课程详情出错:", error);
  } finally {
    loading.value = false;
  }
};

// 视频加载与播放
const videoLoaded = () => {
  const videoPlayerEl = resolveVideoPlayerEl();
  if (autoPlayOnLoad.value && videoPlayerEl) {
    if (typeof videoPlayerEl.play === "function") {
      videoPlayerEl.play();
    }
    autoPlayOnLoad.value = false;
  }
};

const videoEnded = async () => {
  if (currentHour.value && currentHour.value.finished !== 1) {
    try {
      await reportCourseLesson({
        courseId: courseId.value,
        hourId: currentHour.value.hourId
      });
      currentHour.value.finished = 1;
      if (courseDetail.value) courseDetail.value.finishedHours += 1;
      ElMessage.success("学习进度已更新");
    } catch (error) {
      console.error("进度上报失败:", error);
    }
  }
};

const handleNodeClick = (nodeId: string, hour: any) => {
  activeNode.value = nodeId;
  storageLocal().setItem(`course_detail_active_node_${courseId.value}`, nodeId);
  if (hour?.fileUrl) {
    currentHour.value = hour;
    const oldUrl = currentVideoUrl.value;
    currentVideoUrl.value = hour.fileUrl;
    if (oldUrl !== hour.fileUrl) autoPlayOnLoad.value = true;

    const videoPlayerEl = resolveVideoPlayerEl();
    if (videoPlayerEl && oldUrl === hour.fileUrl) {
      videoPlayerEl.currentTime = 0;
      if (typeof videoPlayerEl.play === "function") {
        videoPlayerEl.play();
      }
    }
  }
};

// AI 聊天逻辑
const openAiDialog = () => {
  isAiDialogVisible.value = true;
};
const closeAiDialog = () => {
  isAiDialogVisible.value = false;
  if (cancelStreamRequest.value) {
    cancelStreamRequest.value();
    cancelStreamRequest.value = null;
  }
};

const getCurrentChapterId = () => {
  if (!currentHour.value || !courseDetail.value?.courseChapterList) return null;
  for (const chapter of courseDetail.value.courseChapterList) {
    if (chapter.hourList?.some(h => h.hourId === currentHour.value.hourId)) {
      return chapter.chapterId;
    }
  }
  return null;
};

const handleSendMessage = async (content: string) => {
  if (!content.trim() || sendingMessage.value) return;
  const userMsg = content.trim();
  const chatChapterId = getCurrentChapterId();

  if (
    chatChapterId !== null &&
    previousChapterId.value !== null &&
    chatChapterId !== previousChapterId.value
  ) {
    conversationId.value =
      Date.now().toString() + Math.random().toString(36).substring(2);
    chatMessages.value = [];
  }
  previousChapterId.value = chatChapterId;

  chatMessages.value.push({
    role: "user",
    content: userMsg,
    timestamp: new Date().toISOString()
  });
  sendingMessage.value = true;
  isTyping.value = true;

  try {
    let aiMessageAdded = false;
    cancelStreamRequest.value = courseAIChatStream(
      {
        course_id: courseId.value,
        conversation_id: conversationId.value,
        message: userMsg,
        chapter_id: chatChapterId
      },
      data => {
        if (data.conversation_id) conversationId.value = data.conversation_id;
        if (data.delta) {
          if (!aiMessageAdded) {
            isTyping.value = false;
            aiMessageAdded = true;
            chatMessages.value.push({
              role: "ai",
              content: data.delta,
              timestamp: new Date().toISOString()
            });
          } else {
            chatMessages.value[chatMessages.value.length - 1].content +=
              data.delta;
          }
        }
        if (data.finished) {
          sendingMessage.value = false;
          isTyping.value = false;
        }
      }
    );
  } catch (error) {
    ElMessage.error("发送失败");
    sendingMessage.value = false;
    isTyping.value = false;
  }
};

const clearChat = () => {
  ElMessageBox.confirm("确定清空聊天记录？", "清空对话", {
    confirmButtonText: "确定清空",
    cancelButtonText: "取消",
    type: "warning",
    customClass: "clear-chat-confirm-dialog",
    confirmButtonClass: "clear-chat-confirm-btn",
    cancelButtonClass: "clear-chat-cancel-btn",
    showClose: true,
    closeOnClickModal: true,
    closeOnPressEscape: true,
    center: true,
    draggable: true,
    icon: "Delete"
  })
    .then(() => {
      chatMessages.value = [];
      ElMessage.success("聊天记录已清空");
    })
    .catch(() => {});
};

// 数据获取方法
const fetchHomeworkList = async () => {
  if (!courseId.value) return;
  try {
    const { code, data } = await getUserCourseHomeworkList({
      courseId: courseId.value
    });
    if (code === 200) homeworkList.value = (data as any).list || [];
  } catch (e) {}
};

const fetchExamList = async () => {
  if (!courseId.value) return;
  try {
    const { code, data } = await getUserCourseExamList({
      courseId: courseId.value
    });
    if (code === 200) examList.value = (data as any).list || [];
  } catch (e) {}
};

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
              chapterName: ch.name,
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
              chapterName: ch.name,
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
              chapterName: ch.name,
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

    // 过滤掉空值并进行去重（根据 chapterId），防止后端数据重复或并发引起的重复
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

const fetchCourseScores = async () => {
  if (!courseId.value) {
    courseScores.value = null;
    return;
  }
  try {
    const response = await getCourseScore({ courseId: courseId.value });
    if (response?.code === 200) courseScores.value = response.data;
    else courseScores.value = null;
  } catch (e) {
    courseScores.value = null;
  }
};

const normalizePointList = (
  input: any
): Array<{ title: string; content: string }> => {
  if (!Array.isArray(input)) return [];
  return input
    .map((item: any) => ({
      title: String(item?.title ?? item?.name ?? ""),
      content: String(item?.content ?? item?.desc ?? item?.description ?? "")
    }))
    .filter(item => item.title || item.content);
};

const normalizeStudyEffectData = (raw: any, cid: number) => {
  const source = raw || {};
  const chapters = Array.isArray(source.chapterList)
    ? source.chapterList
    : Array.isArray(source.chapters)
      ? source.chapters
      : [];

  const chapterList = chapters.map((chapter: any, index: number) => {
    return {
      chapterId: Number(chapter?.chapterId ?? chapter?.id ?? index + 1),
      chapterName: String(
        chapter?.chapterName ?? chapter?.name ?? `第${index + 1}章`
      ),
      keyPointArray: normalizePointList(
        chapter?.keyPointArray ?? chapter?.keyPoints ?? chapter?.key_points
      ),
      difficultPointArray: normalizePointList(
        chapter?.difficultPointArray ??
          chapter?.difficultPoints ??
          chapter?.difficult_points
      ),
      knowledgeArray: normalizePointList(
        chapter?.knowledgeArray ??
          chapter?.knowledgePoints ??
          chapter?.knowledge_points
      ),
      ConceptArray: normalizePointList(
        chapter?.ConceptArray ?? chapter?.conceptArray ?? chapter?.concepts
      )
    };
  });

  const sum = (arr: any[], key: string) =>
    arr.reduce((total, item) => total + (item?.[key]?.length || 0), 0);

  return {
    courseId: Number(source.courseId ?? cid),
    keyPointNum: Number(
      source.keyPointNum ?? sum(chapterList, "keyPointArray")
    ),
    difficultPointNum: Number(
      source.difficultPointNum ?? sum(chapterList, "difficultPointArray")
    ),
    knowledgePointNum: Number(
      source.knowledgePointNum ?? sum(chapterList, "knowledgeArray")
    ),
    conceptNum: Number(source.conceptNum ?? sum(chapterList, "ConceptArray")),
    chapterList
  };
};

const parseStudyEffectResponse = (response: any) => {
  // 场景1: 统一响应体 { code, msg, data }
  if (response && typeof response === "object" && "code" in response) {
    return {
      ok: Number((response as any).code) === 200,
      msg: (response as any).msg,
      data: (response as any).data
    };
  }

  // 场景2: axios 风格 { data: { code, msg, data } }
  if (
    response?.data &&
    typeof response.data === "object" &&
    "code" in response.data
  ) {
    return {
      ok: Number((response.data as any).code) === 200,
      msg: (response.data as any).msg,
      data: (response.data as any).data
    };
  }

  // 场景3: 后端直接返回学习效果对象（无 code/msg）
  if (
    response &&
    typeof response === "object" &&
    ("chapterList" in response ||
      "chapters" in response ||
      "keyPointNum" in response ||
      "knowledgePointNum" in response)
  ) {
    return {
      ok: true,
      msg: "",
      data: response
    };
  }

  // 场景4: axios 风格 { data: rawObject }
  if (
    response?.data &&
    typeof response.data === "object" &&
    ("chapterList" in response.data ||
      "chapters" in response.data ||
      "keyPointNum" in response.data ||
      "knowledgePointNum" in response.data)
  ) {
    return {
      ok: true,
      msg: "",
      data: response.data
    };
  }

  return {
    ok: false,
    msg: "知识点接口返回格式不匹配",
    data: null
  };
};

const fetchCourseStudyEffect = async () => {
  const cid = Number(courseId.value);
  if (!cid || Number.isNaN(cid)) {
    console.warn("[CourseDetail] skip study effect request: invalid courseId", {
      courseId: courseId.value,
      activeMenu: activeMenu.value
    });
    return;
  }

  console.info("[CourseDetail] requesting study effect", {
    courseId: cid,
    activeMenu: activeMenu.value
  });

  try {
    const response = await getCourseStudyEffect({ courseId: cid });
    const parsed = parseStudyEffectResponse(response);

    if (parsed.ok) {
      const normalized = normalizeStudyEffectData(parsed.data, cid);
      studyEffectData.value = normalized;
      console.info("[CourseDetail] study effect response", {
        code: (response as any)?.code ?? (response as any)?.data?.code ?? 200,
        chapterCount: normalized.chapterList.length,
        keyPointNum: normalized.keyPointNum,
        difficultPointNum: normalized.difficultPointNum,
        knowledgePointNum: normalized.knowledgePointNum,
        conceptNum: normalized.conceptNum,
        raw: parsed.data
      });

      if (
        normalized.chapterList.length === 0 &&
        normalized.keyPointNum === 0 &&
        normalized.difficultPointNum === 0 &&
        normalized.knowledgePointNum === 0 &&
        normalized.conceptNum === 0
      ) {
        ElMessage.warning("当前课程暂无知识点学习效果数据");
      }
    } else {
      ElMessage.warning(parsed.msg || "知识点数据为空或接口异常");
      console.warn("[CourseDetail] study effect request not successful", {
        parsed,
        rawResponse: response
      });
    }
  } catch (e) {
    console.error("[CourseDetail] fetch study effect failed", e);
    ElMessage.error("知识点数据加载失败");
  }
};

// 初始化课程问答历史数据
const initQAHistory = () => {
  qaHistoryList.value = [
    {
      question: "这门课程的考核方式是什么？",
      answer:
        "本课程采用线上考试的方式进行考核，总成绩由平时作业（30%）、课堂表现（20%）和期末考试（50%）三部分构成。",
      timestamp: "2025-08-13T16:30:00Z"
    },
    {
      question: "这门课程的成绩构成是怎么样的？",
      answer:
        "课程成绩由平时作业（30%）、课堂表现（20%）和期末考试（50%）三部分构成。平时作业包括每周的课后练习和项目作业，课堂表现包括课堂参与度和小组讨论。",
      timestamp: "2025-08-13T15:45:00Z"
    },
    {
      question: "期末考试的范围是什么？",
      answer:
        "期末考试范围包括课程的所有章节内容，特别关注第3、4、7章的核心概念和应用案例。考试形式为线上闭卷，时间为90分钟。",
      timestamp: "2025-08-12T09:15:00Z"
    }
  ];
};

onMounted(async () => {
  document.body.classList.add("course-page");
  courseRootEl.value = document.querySelector(
    ".course-detail-root"
  ) as HTMLElement | null;
  baseCourseId.value = Number(route.params.id);
  window.addEventListener("resize", handleViewportResize, { passive: true });
  window.addEventListener(
    "qiming:course-sidebar-collapse-change",
    handleCourseSidebarCollapseChange
  );
  window.addEventListener("qiming:native-back", handleNativeBack);

  // 获取用户ID（如果还没有）
  if (!userStore.userId) {
    try {
      const { code, data } = await getUserDetail();
      if (code === 200 && data?.userInfo?.id) {
        userStore.SET_USERID(data.userInfo.id);
        // 同时更新 localStorage
        const userInfo = (storageLocal().getItem(userKey) || {}) as Record<
          string,
          any
        >;
        storageLocal().setItem(userKey, {
          ...userInfo,
          userId: data.userInfo.id
        });
      }
    } catch (error) {
      console.error("获取用户信息失败:", error);
    }
  }

  await fetchCourseDetail();
  initQAHistory();

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
    } else if (menuName === "mastery") {
      fetchCourseStudyEffect();
    } else if (menuName === "course-qa") {
      nextTick(() => {
        if (courseId.value) {
          courseQARef.value?.refreshData?.();
        }
      });
    }
  }

  // 初始化 AI 聊天
  const storedId = localStorage.getItem(`chat_${courseId.value}`);
  if (storedId) {
    conversationId.value = storedId;
    try {
      const res = await getConversationHistory(storedId);
      if (res?.history) chatMessages.value = res.history || [];
    } catch (e) {}
  } else {
    conversationId.value =
      Date.now().toString() + Math.random().toString(36).substring(2);
    localStorage.setItem(`chat_${courseId.value}`, conversationId.value);
  }

  nextTick(() => {
    scheduleMobileTopOffsetUpdate();
  });
});

// 当组件从keep-alive缓存中被激活时重新加载当前菜单数据
onActivated(() => {
  // 如果当前是课程问答页面，刷新数据
  if (activeMenu.value === "course-qa" && courseId.value) {
    nextTick(() => {
      courseQARef.value?.refreshData?.();
    });
  }

  nextTick(() => {
    scheduleMobileTopOffsetUpdate();
  });
});

onBeforeUnmount(() => {
  setAiScreenCaptureVisibilityOverride(null);
  document.body.classList.remove("course-page");
  window.removeEventListener("resize", handleViewportResize);
  window.removeEventListener(
    "qiming:course-sidebar-collapse-change",
    handleCourseSidebarCollapseChange
  );
  window.removeEventListener("qiming:native-back", handleNativeBack);
  if (mobileOffsetRafId !== null) {
    cancelAnimationFrame(mobileOffsetRafId);
    mobileOffsetRafId = null;
  }
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
  --course-mobile-top-offset: 176px;
  --course-mobile-fab-clearance: 92px;
  width: 100%;
  min-height: 100vh;
  background-color: #f5f7fa;
  transition: background-color 0.3s ease;

  &.dark {
    background-color: #1a1a1a;
  }

  .layout-container {
    position: relative;
    display: flex;
    width: 100%;
    min-height: 100vh;
    background-color: #f5f7fa;
    transition: background-color 0.3s ease;

    &.dark {
      background-color: #1a1a1a;
    }
  }

  /* 覆盖外部CSS中的侧边栏样式 */
  .layout-sidebar {
    &.light,
    &[class*="light"] {
      height: auto;
      max-height: calc(100vh - 97px);
    }
  }

  .layout-inner-content {
    position: relative;
    flex: 1;
    min-width: 0;
    height: calc(100vh - 35px);
    margin: 20px 15px 15px 90px;
    overflow: hidden; /* 容器层级不滚动，由子页面内部滚动 */
    background-color: #f5f7fa;
    border-radius: 24px;
    transition: all 0.3s ease;

    &.dark {
      background-color: #1a1a1a;
    }
  }

  /* stylelint-disable-next-line order/order */
  @media (max-width: 767px) {
    .layout-container {
      display: block;
      min-height: 100vh;
    }

    .layout-sidebar {
      &.light,
      &[class*="light"] {
        max-height: none;
      }
    }

    .layout-inner-content {
      height: auto;
      min-height: 100vh;
      margin: 0;
      overflow: visible;
      border-radius: 0;
    }
  }
}

/* 清空对话 确认框美化 */
.clear-chat-confirm-dialog {
  max-width: 400px !important;
  padding: 8px;
  overflow: hidden;
  border: none !important;
  border-radius: 20px !important;
  box-shadow: 0 12px 32px 4px rgb(0 0 0 / 15%) !important;

  .el-message-box__header {
    padding-top: 25px;
    padding-bottom: 5px;

    .el-message-box__title {
      font-size: 18px;
      font-weight: 600;
      color: #303133;
    }

    .el-message-box__headerbtn {
      top: 15px;
      right: 15px;
      font-size: 20px;
    }
  }

  .el-message-box__content {
    padding: 15px 30px 25px;

    .el-message-box__container {
      justify-content: center;
      margin-left: 0;
    }

    .el-message-box__status {
      display: none;
    }

    .el-message-box__message {
      font-size: 15px;
      font-weight: 500;
      color: #606266;
    }
  }

  .el-message-box__btns {
    display: flex;
    gap: 16px;
    justify-content: center;
    padding: 0 20px 25px;

    button {
      width: 120px;
      height: 42px;
      padding: 0;
      margin: 0 !important;
      font-size: 14px;
      font-weight: 600;
      border-radius: 12px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
  }
}

.clear-chat-cancel-btn {
  color: #909399 !important;
  background: #f4f7f9 !important;
  border: 1px solid #e4e7ed !important;

  &:hover {
    color: #606266 !important;
    background: #eef2f5 !important;
    border-color: #dcdfe6 !important;
  }
}

.clear-chat-confirm-btn {
  color: white !important;
  background: linear-gradient(135deg, #97b4f7 0%, #604ffd 100%) !important;
  border: none !important;
  box-shadow: 0 4px 12px rgb(64 158 255 / 30%);

  &:hover {
    box-shadow: 0 6px 16px rgb(64 158 255 / 40%);
    opacity: 0.9;
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0);
  }
}

/* 深色模式适配 */
html.dark {
  .clear-chat-confirm-dialog {
    background-color: #1a1a24 !important;
    border: 1px solid rgb(255 255 255 / 10%) !important;

    .el-message-box__title {
      color: #e0e0e0 !important;
    }

    .el-message-box__message {
      color: #c0c4cc !important;
    }
  }

  .clear-chat-cancel-btn {
    color: #909399 !important;
    background: #2a2a3a !important;
    border-color: #3a3a4a !important;

    &:hover {
      color: #e0e0e0 !important;
      background: #3a3a4a !important;
    }
  }
}
</style>

<style scoped lang="scss">
@keyframes ai-glow-border {
  0% {
    background-position: 0% 0%;
  }

  100% {
    background-position: 200% 0%;
  }
}

@keyframes pulse-dot {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.6;
    transform: scale(0.8);
  }
}

.course-detail-root {
  :deep(.ai-helper-sections) {
    position: relative;
  }

  :deep(.out-ai-pro-talk-box) {
    padding: 16px;
    background: linear-gradient(
      135deg,
      rgb(255 255 255 / 90%) 0%,
      rgb(245 247 250 / 90%) 100%
    );
    border: 1px solid rgb(64 158 255 / 20%);
    border-radius: 20px;
    box-shadow: 0 8px 32px -4px rgb(64 158 255 / 20%);
    backdrop-filter: blur(20px) saturate(180%);
    transition: all 0.3s ease;

    .inset-div {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .photo {
      flex-shrink: 0;
      width: 48px;
      height: 48px;
      overflow: hidden;
      border: 2px solid rgb(64 158 255 / 30%);
      border-radius: 50%;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .ai-hepler-pro-box {
      flex: 1;
      min-width: 0;
    }

    .people-name {
      margin-bottom: 4px;
      font-size: 14px;
      font-weight: 600;
      color: #303133;
    }

    .init-talk-cotent {
      font-size: 12px;
      color: #909399;
    }

    .ai-hepler-pro-input {
      position: relative;
      margin-top: 12px;

      .el-input__inner {
        height: 40px;
        padding-right: 44px;
        padding-left: 16px;
        font-size: 13px;
        background: #fff;
        border: 1px solid #dcdfe6;
        border-radius: 20px;
        transition: all 0.3s ease;

        &:focus {
          border-color: #97b4f7;
          box-shadow: 0 0 0 2px rgb(64 158 255 / 20%);
        }
      }
    }

    .mock-send-btn {
      position: absolute;
      top: 50%;
      right: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      cursor: pointer;
      background: linear-gradient(135deg, #97b4f7 0%, #66b1ff 100%);
      border-radius: 50%;
      transform: translateY(-50%);
      transition: all 0.3s ease;

      &:hover {
        box-shadow: 0 4px 12px rgb(64 158 255 / 40%);
        transform: translateY(-50%) scale(1.1);
      }

      svg {
        width: 14px;
        height: 14px;
        fill: white;
      }
    }
  }

  &.dark :deep(.out-ai-pro-talk-box) {
    background: linear-gradient(
      135deg,
      rgb(40 40 50 / 90%) 0%,
      rgb(30 30 40 / 90%) 100%
    );
    border: 1px solid rgb(64 158 255 / 30%);
    box-shadow: 0 8px 32px -4px rgb(0 0 0 / 40%);

    .people-name {
      color: #e0e0e0;
    }

    .ai-hepler-pro-input .el-input__inner {
      color: #e0e0e0;
      background: #2c2c2c;
      border-color: #444;
    }
  }

  :deep(.glow-border) {
    position: relative;

    &::before {
      position: absolute;
      inset: -2px;
      padding: 2px;
      pointer-events: none;
      content: "";
      background: linear-gradient(90deg, #97b4f7, #604ffd, #97b4f7);
      background-size: 200% 100%;
      border-radius: 22px;
      mask:
        linear-gradient(#fff 0 0) content-box,
        linear-gradient(#fff 0 0);
      mask-composite: exclude;
      animation: ai-glow-border 3s linear infinite;
    }
  }

  :deep(.ai-draggable-dialog) {
    position: fixed;
    overflow: hidden;
    background: rgb(255 255 255 / 95%);
    border: 1px solid rgb(255 255 255 / 30%);
    border-radius: 20px;
    box-shadow: 0 20px 60px -10px rgb(64 158 255 / 25%);
    backdrop-filter: blur(25px) saturate(150%);

    &::after {
      position: absolute;
      inset: 0;
      padding: 1.5px;
      pointer-events: none;
      content: "";
      background: linear-gradient(90deg, #97b4f7, #604ffd, #97b4f7);
      background-size: 200% 100%;
      border-radius: 20px;
      mask:
        linear-gradient(#fff 0 0) content-box,
        linear-gradient(#fff 0 0);
      mask-composite: exclude;
      animation: ai-glow-border 3s linear infinite;
    }
  }

  &.dark :deep(.ai-draggable-dialog) {
    background: rgb(30 30 40 / 95%);
    border: 1px solid rgb(255 255 255 / 10%);
    box-shadow: 0 20px 60px -10px rgb(0 0 0 / 50%);
  }

  :deep(.ai-dialog-header-bar) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: linear-gradient(
      135deg,
      rgb(64 158 255 / 10%) 0%,
      rgb(96 79 253 / 10%) 100%
    );
    border-bottom: 1px solid rgb(64 158 255 / 10%);

    .header-title-wrap {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      background: #67c23a;
      border-radius: 50%;
      animation: pulse-dot 2s ease-in-out infinite;
    }

    .header-title {
      font-size: 15px;
      font-weight: 600;
      color: #303133;
    }

    .header-left,
    .header-right {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .header-back-btn,
    .header-action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      cursor: pointer;
      background: rgb(64 158 255 / 10%);
      border-radius: 8px;
      transition: all 0.3s ease;

      &:hover {
        background: rgb(64 158 255 / 20%);
        transform: scale(1.05);
      }
    }
  }

  &.dark :deep(.ai-dialog-header-bar) {
    .header-title {
      color: #e0e0e0;
    }
  }

  :deep(.ai-fill-bg) {
    background: linear-gradient(
      180deg,
      rgb(245 247 250 / 50%) 0%,
      rgb(255 255 255 / 80%) 100%
    );
  }

  &.dark :deep(.ai-fill-bg) {
    background: linear-gradient(
      180deg,
      rgb(30 30 40 / 50%) 0%,
      rgb(40 40 50 / 80%) 100%
    );
  }

  :deep(.ai-talk-box) {
    height: 100%;
    overflow: hidden;
  }

  :deep(.chat-scrollbar) {
    height: 100%;
  }

  :deep(.header-tips-box) {
    padding: 20px;
    text-align: center;

    .robbot-icon {
      width: 60px;
      height: 60px;
      margin: 0 auto 12px;
      overflow: hidden;
      border: 3px solid rgb(64 158 255 / 30%);
      border-radius: 50%;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .code-hello {
      margin: 12px 0 8px;
      font-size: 16px;
      font-weight: 600;
      color: #303133;
    }

    .ai-heler-header-tips {
      font-size: 13px;
      line-height: 1.6;
      color: #909399;
    }
  }

  &.dark :deep(.header-tips-box .code-hello) {
    color: #e0e0e0;
  }

  :deep(.talk-input-box) {
    padding: 12px 16px;
    background: rgb(255 255 255 / 80%);
    border-top: 1px solid rgb(64 158 255 / 10%);

    .input-box {
      display: flex;
      gap: 12px;
      align-items: flex-end;
    }

    .ai-pro-content-edit-box {
      flex: 1;

      .el-textarea__inner {
        max-height: 120px;
        padding: 10px 16px;
        font-size: 14px;
        resize: none;
        border: 1px solid #dcdfe6;
        border-radius: 16px;
        transition: all 0.3s ease;

        &:focus {
          border-color: #97b4f7;
          box-shadow: 0 0 0 2px rgb(64 158 255 / 20%);
        }
      }
    }

    .send-btn {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      cursor: pointer;
      background: linear-gradient(135deg, #97b4f7 0%, #66b1ff 100%);
      border-radius: 12px;
      transition: all 0.3s ease;

      &:hover {
        box-shadow: 0 4px 166px rgb(64 158 255 / 40%);
        transform: scale(1.05);
      }

      svg {
        width: 20px;
        height: 20px;
        fill: white;
      }
    }

    .not-send-btn {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background: #e4e7ed;
      border-radius: 12px;

      svg {
        width: 20px;
        height: 20px;
        fill: #909399;
      }
    }
  }

  &.dark :deep(.talk-input-box) {
    background: rgb(30 30 40 / 80%);
    border-top-color: rgb(255 255 255 / 10%);

    .ai-pro-content-edit-box .el-textarea__inner {
      color: #e0e0e0;
      background: #2c2c2c;
      border-color: #444;
    }

    .not-send-btn {
      background: #444;
    }
  }

  /* ====================3. 目录样式修复 ==================== */
  :deep(.rightTreeWarp) {
    position: fixed;
    right: 1vw;
    width: 25vw;
    overflow: hidden;
    background: rgb(255 255 255 / 90%);
    border: 1px solid rgb(64 158 255 / 15%);
    border-radius: 16px;
    box-shadow: 0 8px 32px -4px rgb(64 158 255 / 15%);
    backdrop-filter: blur(20px) saturate(180%);
    transition: top 0.4s cubic-bezier(0.4, 0, 0.2, 1);

    &::after {
      position: absolute;
      inset: 0;
      padding: 1.5px;
      pointer-events: none;
      content: "";
      background: linear-gradient(90deg, #97b4f7, #604ffd, #97b4f7);
      background-size: 200% 100%;
      border-radius: 16px;
      mask:
        linear-gradient(#fff 0 0) content-box,
        linear-gradient(#fff 0 0);
      mask-composite: exclude;
      animation: ai-glow-border 3s linear infinite;
    }

    .top-title {
      padding: 16px 20px;
      font-size: 16px;
      font-weight: 600;
      color: #303133;
      background: linear-gradient(
        135deg,
        rgb(64 158 255 / 5%) 0%,
        rgb(96 79 253 / 5%) 100%
      );
      border-bottom: 1px solid rgb(64 158 255 / 10%);
    }

    .chapterList-box {
      padding: 12px;
    }

    .list {
      padding: 0;
      margin: 0;
      list-style: none;
    }

    .chapter {
      padding: 12px 16px;
      margin-bottom: 8px;
      background: linear-gradient(
        135deg,
        rgb(64 158 255 / 8%) 0%,
        rgb(96 79 253 / 8%) 100%
      );
      border-radius: 10px;

      .catalogue_title3 {
        margin-right: 8px;
        font-size: 13px;
        font-weight: 600;
        color: #97b4f7;
      }

      .catalogue_title {
        font-size: 14px;
        font-weight: 500;
        color: #303133;
      }
    }

    .inner-li {
      margin-left: 8px;
    }

    .video {
      padding: 10px 12px;
      margin-bottom: 4px;
      cursor: pointer;
      border: 1px solid transparent;
      border-radius: 8px;
      transition: all 0.3s ease;

      &:hover {
        background: rgb(64 158 255 / 8%);
        border-color: rgb(64 158 255 / 20%);
      }

      &.activeNode {
        background: linear-gradient(
          135deg,
          rgb(64 158 255 / 15%) 0%,
          rgb(96 79 253 / 15%) 100%
        );
        border-color: rgb(64 158 255 / 30%);
      }

      .catalogue_title3 {
        margin-right: 8px;
        font-size: 12px;
        color: #909399;
      }

      .catalogue_title {
        font-size: 13px;
        line-height: 1.4;
        color: #606266;
      }

      .resource-box {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-top: 6px;
      }

      .resource-text {
        font-size: 11px;
        color: #909399;
      }

      .resource-bar {
        flex: 1;
        max-width: 80px;
      }

      .icon-box .isFinish {
        width: 20px;
        height: 20px;

        img {
          width: 100%;
          height: 100%;
        }
      }
    }

    .el-progress-bar__outer {
      background: #e4e7ed;
      border-radius: 4px;
    }

    .el-progress-bar__inner {
      background: linear-gradient(90deg, #97b4f7, #66b1ff);
      border-radius: 4px;
    }
  }

  &.dark :deep(.rightTreeWarp) {
    background: rgb(30 30 40 / 90%);
    border: 1px solid rgb(255 255 255 / 10%);
    box-shadow: 0 8px 32px -4px rgb(0 0 0 / 40%);

    .top-title {
      color: #e0e0e0;
      border-bottom-color: rgb(255 255 255 / 10%);
    }

    .chapter .catalogue_title {
      color: #e0e0e0;
    }

    .video .catalogue_title {
      color: #c0c4cc;
    }

    .el-progress-bar__outer {
      background: #444;
    }
  }
}

/* ==================== 2. AI 对话窗口样式修复 ==================== */
</style>
