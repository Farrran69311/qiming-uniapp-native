<template>
  <div class="account-container" :class="currentTheme">
    <!-- 顶部导航 -->
    <div class="header" :class="{ 'header-scrolled': isScrolled }">
      <div class="header-content">
        <div class="logo" @click="router.push('/home')">
          <img src="@/assets/logo.png" alt="Logo" class="app-logo-img" />
        </div>
        <div class="header-right">
          <!-- 主题切换按钮 -->
          <div class="theme-toggle-wrapper">
            <button
              type="button"
              class="theme-toggle-hit-area"
              role="switch"
              :aria-checked="currentTheme === 'dark'"
              :aria-label="
                currentTheme === 'dark' ? '切换到浅色主题' : '切换到深色主题'
              "
              @click="toggleTheme"
            >
              <span
                class="theme-btn-premium"
                :class="{ 'is-dark': currentTheme === 'dark' }"
                aria-hidden="true"
              >
                <div class="sun-moon-wrapper">
                  <div class="icon sun">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                  </div>
                  <div class="icon moon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path
                        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                      />
                    </svg>
                  </div>
                </div>
                <div class="switch-dot" />
              </span>
            </button>
          </div>

          <template v-if="userInfo">
            <el-dropdown trigger="click" @command="handleCommand">
              <div class="user-info">
                <el-avatar :size="32" :src="formatAvatar(userInfo.avatar)" />
                <span class="nickname">{{
                  userInfo.nickname || userInfo.username
                }}</span>
                <el-icon class="el-icon--right"><arrow-down /></el-icon>
              </div>
              <template #dropdown>
                <el-dropdown-menu class="logout-menu">
                  <el-dropdown-item v-if="hasAdminAccess" command="space">
                    <el-icon><User /></el-icon>
                    进入空间
                  </el-dropdown-item>
                  <el-dropdown-item command="editProfile">
                    <el-icon><Edit /></el-icon>
                    修改资料
                  </el-dropdown-item>
                  <el-dropdown-item command="changePassword">
                    <el-icon><Lock /></el-icon>
                    修改密码
                  </el-dropdown-item>
                  <el-dropdown-item command="logout" divided>
                    <el-icon><SwitchButton /></el-icon>
                    退出登录
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
          <el-button
            v-else
            type="primary"
            class="login-btn"
            @click="showLoginDialog = true"
            >登录</el-button
          >
        </div>
      </div>
    </div>

    <!-- 账号管理内容 -->
    <div class="account-content">
      <div class="account-sidebar">
        <div class="user-info-card">
          <div class="avatar-wrapper">
            <el-avatar :size="80" :src="formatAvatar(userInfo?.avatar)" />
            <div class="avatar-ring" />
          </div>
          <h3>{{ userInfo?.nickname || userInfo?.username }}</h3>
          <p class="user-role">学生</p>
        </div>
        <el-menu
          :default-active="activeMenu"
          class="account-menu"
          @select="handleMenuSelect"
        >
          <el-menu-item index="home">
            <el-icon><HomeIcon /></el-icon>
            <span>首页</span>
          </el-menu-item>
          <el-menu-item index="course">
            <el-icon><CourseIcon /></el-icon>
            <span>课程</span>
          </el-menu-item>
          <el-menu-item index="student-resources">
            <el-icon><Reading /></el-icon>
            <span>教学资源</span>
          </el-menu-item>
          <el-menu-item index="classroom">
            <el-icon><ClassroomIcon /></el-icon>
            <span>虚拟校园</span>
          </el-menu-item>
          <el-menu-item index="profile">
            <el-icon><StudentIcon /></el-icon>
            <span>个人资料</span>
          </el-menu-item>
          <el-menu-item index="learning-profile">
            <el-icon><TrendCharts /></el-icon>
            <span>学生画像</span>
          </el-menu-item>
          <el-menu-item index="learning-path">
            <el-icon><Guide /></el-icon>
            <span>学习路径规划</span>
          </el-menu-item>
          <el-menu-item index="cloud-disk">
            <el-icon><CloudIcon /></el-icon>
            <span>学习云盘</span>
          </el-menu-item>
          <el-menu-item index="notification">
            <el-icon><NotificationIcon /></el-icon>
            <span>系统通知</span>
          </el-menu-item>
          <el-menu-item index="todo">
            <el-icon><TodoIcon /></el-icon>
            <span>待办事项</span>
          </el-menu-item>
          <el-menu-item index="ai-app">
            <el-icon><Cpu /></el-icon>
            <span>AI App</span>
          </el-menu-item>
          <el-menu-item index="virtual-lab">
            <el-icon><LabIcon /></el-icon>
            <span>虚拟实验室</span>
          </el-menu-item>
          <el-menu-item index="competition">
            <el-icon><CompetitionIcon /></el-icon>
            <span>赛事场</span>
          </el-menu-item>
          <el-menu-item index="exam-center">
            <el-icon><Document /></el-icon>
            <span>试卷中心</span>
          </el-menu-item>
        </el-menu>
      </div>
      <div
        class="account-main"
        :class="{
          'account-main--student-resources': activeMenu === 'student-resources'
        }"
      >
        <div v-if="activeMenu === 'profile'">
          <user-profile
            :current-theme="currentTheme"
            @to-course="activeMenu = 'course'"
          />
        </div>
        <div v-else-if="activeMenu === 'learning-profile'">
          <student-learning-profile :current-theme="currentTheme" />
        </div>
        <div v-else-if="activeMenu === 'learning-path'">
          <student-learning-path-planner :current-theme="currentTheme" />
        </div>
        <div v-else-if="activeMenu === 'cloud-disk'">
          <cloud-disk :current-theme="currentTheme" />
        </div>
        <div v-else-if="activeMenu === 'notification'">
          <system-notification :current-theme="currentTheme" />
        </div>
        <div v-else-if="activeMenu === 'todo'">
          <todo :current-theme="currentTheme" />
        </div>
        <div v-else-if="activeMenu === 'virtual-lab'">
          <virtual-lab :current-theme="currentTheme" />
        </div>
        <div v-else-if="activeMenu === 'competition'">
          <competition :current-theme="currentTheme" />
        </div>
        <div v-else-if="activeMenu === 'exam-center'">
          <student-exam-center :current-theme="currentTheme" />
        </div>
        <div
          v-else-if="activeMenu === 'student-resources'"
          class="account-main__student-resources"
        >
          <StudentResourceWorkbench fixed-viewport />
        </div>
        <div v-else-if="activeMenu === 'classroom'">
          <Classroom3D />
        </div>
        <div v-else-if="activeMenu === 'home'">
          <!-- 快速入口卡片 -->
          <div class="quick-access-section">
            <div
              class="quick-access-card lab-access"
              @click="activeMenu = 'virtual-lab'"
            >
              <div class="access-icon">
                <LabIcon style="width: 32px; height: 32px" />
              </div>
              <div class="access-info">
                <h4>虚拟实验室</h4>
                <p>探索 HTML 动画与 AI 小游戏</p>
              </div>
              <div class="access-arrow">→</div>
            </div>
            <div
              class="quick-access-card competition-access"
              @click="activeMenu = 'competition'"
            >
              <div class="access-icon">
                <CompetitionIcon style="width: 32px; height: 32px" />
              </div>
              <div class="access-info">
                <h4>赛事场</h4>
                <p>在线 OJ、题库训练、作文批改</p>
              </div>
              <div class="access-arrow">→</div>
            </div>
            <div
              class="quick-access-card course-access"
              @click="activeMenu = 'course'"
            >
              <div class="access-icon">
                <CourseIcon style="width: 32px; height: 32px" />
              </div>
              <div class="access-info">
                <h4>我的课程</h4>
                <p>查看全部课程学习进度</p>
              </div>
              <div class="access-arrow">→</div>
            </div>
            <div
              class="quick-access-card cloud-access"
              @click="activeMenu = 'cloud-disk'"
            >
              <div class="access-icon">
                <CloudIcon style="width: 32px; height: 32px" />
              </div>
              <div class="access-info">
                <h4>学习云盘</h4>
                <p>管理你的学习资料</p>
              </div>
              <div class="access-arrow">→</div>
            </div>
          </div>

          <!-- 上方卡片 -->
          <div class="card" :class="currentTheme">
            <!-- 重要提醒 -->
            <div class="reminder">
              <el-carousel
                height="46px"
                direction="vertical"
                :autoplay="true"
                :interval="4000"
                indicator-position="none"
                arrow="never"
              >
                <el-carousel-item
                  v-for="(notice, index) in notices"
                  :key="index"
                >
                  <div class="reminder-content">
                    <el-icon><InfoFilled /></el-icon>
                    <span class="notice-text">{{ notice }}</span>
                  </div>
                </el-carousel-item>
              </el-carousel>
            </div>
            <!-- 课程信息和AI总结 -->
            <div class="info-section">
              <div class="course-info">
                <h3>
                  <CourseIcon
                    style="
                      width: 24px;
                      height: 24px;
                      margin-right: 8px;
                      vertical-align: middle;
                    "
                  />
                  课程信息
                </h3>
                <div class="course-card">
                  <!-- 加载状态 -->
                  <div v-if="loading" class="loading-container">
                    <el-skeleton animated :rows="3" />
                  </div>

                  <template v-else>
                    <!-- 将要考试的课程 -->
                    <div
                      v-if="myCourses.examList.length > 0"
                      class="course-section"
                    >
                      <h4>将要考试的</h4>
                      <div class="mini-course-list">
                        <div
                          v-for="course in myCourses.examList"
                          :key="'exam-' + course.courseId"
                          class="mini-course-item"
                          @click="handleCourseClick(course.courseId)"
                        >
                          <div
                            class="course-thumb"
                            :style="{
                              backgroundColor: course.thumbUrl
                                ? ''
                                : getCoverColor(course.courseId)
                            }"
                          >
                            <img
                              v-if="course.thumbUrl"
                              :src="course.thumbUrl"
                              class="thumb-image"
                            />
                            <el-tag type="warning">考试</el-tag>
                          </div>
                          <div class="course-content">
                            <span class="course-name">{{
                              course.courseName
                            }}</span>
                            <span class="course-time"
                              >{{ course.daysLeft }}天后</span
                            >
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 将要结课的课程 -->
                    <div
                      v-if="myCourses.endingList.length > 0"
                      class="course-section"
                    >
                      <h4>将要结课的</h4>
                      <div class="mini-course-list">
                        <div
                          v-for="course in myCourses.endingList"
                          :key="'end-' + course.courseId"
                          class="mini-course-item"
                          @click="handleCourseClick(course.courseId)"
                        >
                          <div
                            class="course-thumb"
                            :style="{
                              backgroundColor: course.thumbUrl
                                ? ''
                                : getCoverColor(course.courseId)
                            }"
                          >
                            <img
                              v-if="course.thumbUrl"
                              :src="course.thumbUrl"
                              class="thumb-image"
                            />
                            <el-tag type="success">结课</el-tag>
                          </div>
                          <div class="course-content">
                            <span class="course-name">{{
                              course.courseName
                            }}</span>
                            <span class="course-time"
                              >{{ course.daysLeft }}天后</span
                            >
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 作业未交的课程 -->
                    <div
                      v-if="myCourses.homeworkList.length > 0"
                      class="course-section"
                    >
                      <h4>作业未交的</h4>
                      <div class="mini-course-list">
                        <div
                          v-for="course in myCourses.homeworkList"
                          :key="'homework-' + course.courseId"
                          class="mini-course-item"
                          @click="handleCourseClick(course.courseId)"
                        >
                          <div
                            class="course-thumb"
                            :style="{
                              backgroundColor: course.thumbUrl
                                ? ''
                                : getCoverColor(course.courseId)
                            }"
                          >
                            <img
                              v-if="course.thumbUrl"
                              :src="course.thumbUrl"
                              class="thumb-image"
                            />
                            <el-tag type="danger">作业</el-tag>
                          </div>
                          <div class="course-content">
                            <span class="course-name">{{
                              course.courseName
                            }}</span>
                            <span class="course-time"
                              >{{ course.daysLeft }}天后</span
                            >
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 无数据提示 -->
                    <el-empty
                      v-if="
                        !myCourses.examList.length &&
                        !myCourses.endingList.length &&
                        !myCourses.homeworkList.length
                      "
                      description="暂无课程数据"
                    />
                  </template>
                </div>
              </div>
              <div class="ai-summary">
                <h3>AI总结</h3>
                <div
                  class="summary-card"
                  :class="currentTheme"
                  :data-summary-status="aiSummaryStatus"
                  :aria-busy="aiSummaryStatus === 'loading'"
                >
                  <p class="summary-title">{{ aiSummaryTitle }}</p>
                  <p class="summary-status" role="status" aria-live="polite">
                    {{ aiSummaryStatusText }}
                  </p>
                  <ul>
                    <li v-for="(item, idx) in displayedSummary" :key="idx">
                      {{ item }}
                    </li>
                    <li v-if="isTyping" class="typing-cursor">
                      正在生成中<span v-for="n in 3" :key="n" class="dot"
                        >.</span
                      >
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else-if="activeMenu === 'course'">
          <!-- 课程列表卡片 -->
          <div class="card course-list" :class="currentTheme">
            <div class="course-header" :class="currentTheme">
              <h3>
                <CourseIcon
                  style="
                    width: 24px;
                    height: 24px;
                    margin-right: 8px;
                    vertical-align: middle;
                  "
                />
                我的课程
              </h3>
              <div class="course-filter">
                <el-select v-model="courseFilter" placeholder="课程状态">
                  <el-option label="全部" value="all" />
                  <el-option label="进行中" value="ongoing" />
                  <el-option label="已完成" value="completed" />
                  <el-option label="未开始" value="upcoming" />
                </el-select>
              </div>
            </div>

            <!-- 加载状态 -->
            <div v-if="coursesData.loading" class="loading-container">
              <el-skeleton animated :rows="3" />
            </div>

            <!-- 课程网格 -->
            <template v-else>
              <div v-if="coursesData.list.length > 0" class="course-grid">
                <div
                  v-for="course in coursesData.list"
                  :key="course.courseId"
                  class="course-item"
                  @click="handleCourseClick(course.courseId)"
                >
                  <div
                    class="course-cover"
                    :style="{
                      backgroundColor: course.thumbUrl
                        ? ''
                        : getCoverColor(course.courseId)
                    }"
                  >
                    <img
                      v-if="course.thumbUrl"
                      :src="course.thumbUrl"
                      class="cover-image"
                    />
                    <div class="course-status">
                      <el-tag
                        :type="
                          course.finishedHours >= course.totalHours
                            ? 'info'
                            : course.finishedHours > 0
                              ? 'success'
                              : 'warning'
                        "
                      >
                        {{
                          course.finishedHours >= course.totalHours
                            ? "已完成"
                            : course.finishedHours > 0
                              ? "进行中"
                              : "未开始"
                        }}
                      </el-tag>
                    </div>
                  </div>
                  <div class="course-info">
                    <h4>{{ course.courseName }}</h4>
                    <p>
                      {{ course.isRequired === 1 ? "必修课程" : "选修课程" }}
                    </p>
                    <div class="course-meta">
                      <span>
                        <el-icon><Clock /></el-icon>
                        学习进度：{{
                          Math.floor(
                            (course.finishedHours / course.totalHours) * 100
                          )
                        }}%
                      </span>
                      <span>
                        <el-icon><Calendar /></el-icon>
                        课时：{{ course.totalHours }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 无数据提示 -->
              <el-empty v-else description="暂无课程数据" />
            </template>

            <!-- 分页 -->
            <div v-if="coursesData.list.length > 0" class="pagination">
              <el-button :disabled="currentPage === 1" @click="handlePrevPage">
                <el-icon><ArrowLeft /></el-icon>
                上一页
              </el-button>
              <span class="page-info"
                >{{ currentPage }} / {{ totalPages }}</span
              >
              <el-button
                :disabled="currentPage === totalPages"
                @click="handleNextPage"
              >
                下一页
                <el-icon><ArrowRight /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 登录弹窗 -->
    <login-dialog
      v-model:visible="showLoginDialog"
      @login-success="handleLoginSuccess"
    />

    <!-- 页尾版权信息 -->
    <LayFooter />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { emitter } from "@/utils/mitt";
import {
  User,
  SwitchButton,
  Setting,
  ArrowDown,
  HomeFilled,
  Reading,
  Document,
  Folder,
  Edit,
  Lock,
  Clock,
  Calendar,
  InfoFilled,
  ArrowLeft,
  ArrowRight,
  Bell,
  Tickets,
  Cpu,
  Trophy,
  Sunny,
  Moon,
  TrendCharts,
  Guide
} from "@element-plus/icons-vue";
import LoginDialog from "@/components/LoginDialog.vue";
import { storageLocal } from "@pureadmin/utils";
import { formatAvatar } from "@/utils/avatar";
import { userKey, removeToken, hasManageAccess } from "@/utils/auth";
import { ElMessage } from "element-plus";
import type { DataInfo } from "@/utils/auth";
import {
  UserProfile,
  SystemNotification,
  Todo,
  VirtualLab,
  Competition
} from "./components";
import CloudDisk from "./components/CloudDisk.vue";
import StudentLearningProfile from "./components/StudentLearningProfile.vue";
import StudentLearningPathPlanner from "./components/StudentLearningPathPlanner.vue";
import Classroom3D from "@/views/course/classroom/index.vue";
import StudentExamCenter from "@/views/exam-paper/student-center/index.vue";
import StudentResourceWorkbench from "@/views/course/student-resource/index.vue";
import { getFrontendCourseList } from "@/api/frontend/course";
import { getLearningSummary } from "@/api/frontend/user";

// 导入新图标
import LabIcon from "@/new student interface icons/lab-medical-test-svgrepo-com.svg?component";
import CompetitionIcon from "@/new student interface icons/trophy-prize-medal-3-svgrepo-com.svg?component";
import CourseIcon from "@/new student interface icons/books-and-people-svgrepo-com.svg?component";
import CloudIcon from "@/new student interface icons/file-svgrepo-com.svg?component";
import ClassroomIcon from "@/assets/newicon/classroom-teacher-svgrepo-com.svg?component";
import StudentIcon from "@/assets/newicon/student-svgrepo-com.svg?component";

// 导入侧边栏新图标
import HomeIcon from "@/side bar new icons/school-svgrepo-com.svg?component";
import NotificationIcon from "@/side bar new icons/notification-unread-lines-svgrepo-com.svg?component";
import TodoIcon from "@/side bar new icons/list-tasks-svgrepo-com.svg?component";
import LayFooter from "@/layout/components/lay-footer/index.vue";

const router = useRouter();
const route = useRoute();
const isScrolled = ref(false);
const showLoginDialog = ref(false);
const isMiniProgramDemoRoute = computed(
  () =>
    route.query.qimingMiniProgram === "1" || route.query.qimingNative === "1"
);

const menuKeys = [
  "home",
  "course",
  "classroom",
  "profile",
  "cloud-disk",
  "notification",
  "todo",
  "ai-app",
  "virtual-lab",
  "competition",
  "exam-center",
  "student-resources",
  "learning-profile",
  "learning-path"
];

const readRouteMenu = () => {
  const menu = Array.isArray(route.query.menu)
    ? route.query.menu[0]
    : route.query.menu;
  return typeof menu === "string" && menuKeys.includes(menu) ? menu : "";
};

const demoCourses = [
  {
    courseId: 1,
    courseName: "嵌入式 Linux 开发实践教程",
    thumbUrl: "",
    isRequired: 1,
    totalHours: 24,
    finishedHours: 8
  },
  {
    courseId: 2,
    courseName: "数据结构动画课件",
    thumbUrl: "",
    isRequired: 1,
    totalHours: 18,
    finishedHours: 12
  },
  {
    courseId: 3,
    courseName: "AI 助教学习诊断",
    thumbUrl: "",
    isRequired: 0,
    totalHours: 12,
    finishedHours: 4
  },
  {
    courseId: 4,
    courseName: "计算机组成原理测评",
    thumbUrl: "",
    isRequired: 1,
    totalHours: 20,
    finishedHours: 15
  }
];

const userInfo = ref<DataInfo<number> | null>(storageLocal().getItem(userKey));

// 主题相关
const currentTheme = ref(
  (storageLocal().getItem("course_theme") as string) ||
    ((storageLocal().getItem("responsive-layout") as any)?.darkMode
      ? "dark"
      : "light")
);

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

const isAnimating = ref(false);
const toggleTheme = (event: MouseEvent) => {
  if (isAnimating.value) return;
  isAnimating.value = true;

  const x = event.clientX;
  const y = event.clientY;
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  // 1. 创建扩散层
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
    background: ${isToDark ? "#0b1120" : "#f7f8fc"};
    clip-path: circle(0px at ${x}px ${y}px);
    transition: clip-path 600ms cubic-bezier(0.4, 0, 0.2, 1);
  `;
  document.body.appendChild(overlay);

  // 2. 触发扩散动画
  requestAnimationFrame(() => {
    overlay.style.clipPath = `circle(${endRadius}px at ${x}px ${y}px)`;
  });

  // 3. 切换实际主题
  setTimeout(() => {
    currentTheme.value = isToDark ? "dark" : "light";

    // 4. 让遮罩层淡出
    overlay.style.transition =
      "opacity 500ms ease, clip-path 600ms cubic-bezier(0.4, 0, 0.2, 1)";
    overlay.style.opacity = "0";

    setTimeout(() => {
      overlay.remove();
      isAnimating.value = false;
    }, 500);
  }, 500);
};

// 当前激活的菜单项
const activeMenu = ref<string>("home");

// 初始化菜单状态
const initActiveMenu = () => {
  const routeMenu = readRouteMenu();
  if (routeMenu) {
    activeMenu.value = routeMenu;
    storageLocal().setItem("account_active_menu", routeMenu);
    return;
  }

  const savedMenu = storageLocal().getItem("account_active_menu");
  if (typeof savedMenu === "string" && savedMenu) {
    activeMenu.value = savedMenu;
  } else {
    activeMenu.value = "home";
  }
};

// 分页相关
const currentPage = ref(1);
const pageSize = ref(12); // 每页显示12个课程
const total = ref(15); // 假设总共15个课程
const totalPages = computed(() => Math.ceil(total.value / pageSize.value));

// 添加课程筛选状态
const courseFilter = ref("all");

// 课程数据加载状态
const loading = ref(false);

// 我的课程数据
const myCourses = ref({
  examList: [], // 考试课程
  endingList: [], // 结课课程
  homeworkList: [] // 作业课程
});

// 轮播通知数据
const notices = ref([
  "重要提示:同学们，新学期到了，系统已经分配最新的课程，请各位同学抓紧学习 书山有路勤为径，学海无涯苦作舟 🎉",
  "温馨提示：请同学们按时提交作业，避免影响课程进度和最终成绩。如有疑问请及时联系课程导师。",
  "新功能上线：虚拟实验室现已支持更多实验场景，欢迎同学们前往体验，探索科学的奥秘。",
  "赛事预告：下周将举行全校程序设计大赛，感兴趣的同学请在赛事场报名，展示你的编程才华。",
  "学习建议：合理安排学习时间，利用好学习云盘整理资料，保持良好的学习习惯是成功的关键。"
]);

// 课程页面数据
const coursesData = ref({
  list: [], // 课程列表
  loading: false // 加载状态
});

// 获取课程列表
const fetchCourseList = async () => {
  try {
    loading.value = true;
    const { code, data, msg } = await getFrontendCourseList(
      {
        pageNum: 1,
        pageSize: 100 // 获取足够多的课程数据
      },
      { timeout: isMiniProgramDemoRoute.value ? 8000 : 0 }
    );

    if (code === 200 && data) {
      return data.list || [];
    } else {
      if (isMiniProgramDemoRoute.value) return demoCourses;
      ElMessage.error(msg || "获取课程列表失败");
      return [];
    }
  } catch (error) {
    console.error("获取课程列表出错:", error);
    if (isMiniProgramDemoRoute.value) return demoCourses;
    ElMessage.error("获取课程数据失败，请稍后重试");
    return [];
  } finally {
    loading.value = false;
  }
};

// 加载主页数据
const loadHomeData = async () => {
  loading.value = true;
  beginLearningSummaryRefresh();

  try {
    const courseList = await fetchCourseList();

    // 这里只是模拟数据，实际项目中应该根据后端接口返回的数据进行处理
    // 将数据分类到不同的列表中
    if (courseList.length > 0) {
      // 随机分配一些课程到各个类别，实际项目中应该根据业务逻辑处理
      myCourses.value.examList = courseList.slice(0, 2).map(course => ({
        ...course,
        daysLeft: Math.floor(Math.random() * 5) + 1 // 随机1-5天
      }));

      myCourses.value.endingList = courseList.slice(2, 5).map(course => ({
        ...course,
        daysLeft: Math.floor(Math.random() * 7) + 3 // 随机3-10天
      }));

      myCourses.value.homeworkList = courseList.slice(5, 9).map(course => ({
        ...course,
        daysLeft: Math.floor(Math.random() * 5) + 1 // 随机1-5天
      }));
    } else {
      // 如果没有数据，则清空所有列表
      myCourses.value.examList = [];
      myCourses.value.endingList = [];
      myCourses.value.homeworkList = [];
    }
  } catch (error) {
    console.error("加载主页数据失败:", error);
  } finally {
    loading.value = false;
  }
};

// 加载课程页面数据
const loadCoursePageData = async () => {
  coursesData.value.loading = true;
  try {
    // 分页获取课程列表
    const { code, data, msg } = await getFrontendCourseList(
      {
        pageNum: currentPage.value,
        pageSize: pageSize.value,
        status: courseFilter.value === "all" ? undefined : courseFilter.value
      },
      { timeout: isMiniProgramDemoRoute.value ? 8000 : 0 }
    );

    if (code === 200 && data) {
      coursesData.value.list = data.list || [];
      total.value = data.total || 0;
    } else {
      if (isMiniProgramDemoRoute.value) {
        coursesData.value.list = demoCourses;
        total.value = demoCourses.length;
        return;
      }
      ElMessage.error(msg || "获取课程列表失败");
      coursesData.value.list = [];
      total.value = 0;
    }
  } catch (error) {
    console.error("获取课程列表出错:", error);
    if (isMiniProgramDemoRoute.value) {
      coursesData.value.list = demoCourses;
      total.value = demoCourses.length;
      return;
    }
    ElMessage.error("获取课程数据失败，请稍后重试");
    coursesData.value.list = [];
    total.value = 0;
  } finally {
    coursesData.value.loading = false;
  }
};

// 处理菜单选择
const handleMenuSelect = (index: string) => {
  if (index === "ai-app") {
    router.push("/account/ai-app?mode=student");
    return;
  }
  activeMenu.value = index;
  storageLocal().setItem("account_active_menu", index);
};

// 监听滚动事件
const handleScroll = () => {
  isScrolled.value = window.scrollY > 50;
};

// 监听用户信息更新事件
const handleUserInfoUpdate = (event: CustomEvent) => {
  userInfo.value = event.detail;
};

const handleExternalMenuSelect = (menu: string) => {
  activeMenu.value = menu;
  storageLocal().setItem("account_active_menu", menu);
};

onUnmounted(() => {
  window.removeEventListener("scroll", handleScroll);
  window.removeEventListener(
    "userInfoUpdated",
    handleUserInfoUpdate as EventListener
  );
});

// 监听课程筛选变化
watch(courseFilter, () => {
  currentPage.value = 1; // 重置为第一页
  loadCoursePageData();
});

// 检查用户是否有管理权限（教师或管理员）
const hasAdminAccess = computed(() => {
  return hasManageAccess();
});

// 处理下拉菜单命令
const handleCommand = (command: string) => {
  switch (command) {
    case "space":
      // 只有管理员或教师可以访问管理空间
      if (hasAdminAccess.value) {
        router.push("/welcome/index");
      } else {
        ElMessage.warning("您没有权限访问管理空间");
      }
      break;
    case "editProfile":
      emitter.emit("openEditProfile");
      break;
    case "changePassword":
      emitter.emit("openChangePassword");
      break;
    case "logout":
      removeToken();
      userInfo.value = null;
      ElMessage.success("退出登录成功");
      router.push("/home");
      break;
  }
};

// 登录成功处理
const handleLoginSuccess = () => {
  userInfo.value = storageLocal().getItem(userKey);
  showLoginDialog.value = false;
};

// 进度条格式化
const format = (percentage: number) => {
  return percentage === 100 ? "完成" : `${percentage}%`;
};

const handlePrevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
    loadCoursePageData();
  }
};

const handleNextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
    loadCoursePageData();
  }
};

// 生成课程封面颜色
const getCoverColor = (index: number) => {
  const colors = [
    "#e6f7ff", // 浅蓝
    "#f6ffed", // 浅绿
    "#fff7e6", // 浅橙
    "#f9f0ff", // 浅紫
    "#fff1f0", // 浅红
    "#f0f5ff", // 浅靛
    "#e6fffb", // 浅青
    "#fff2e8", // 浅棕
    "#f9f0ff", // 浅紫
    "#fffbe6", // 浅黄
    "#f4ffb8", // 浅柠
    "#d9f7be", // 浅绿
    "#b7eb8f", // 浅青绿
    "#e6fffb", // 浅青
    "#bae7ff" // 浅天蓝
  ];
  return colors[(index - 1) % colors.length];
};

// 修改课程点击处理函数
const handleCourseClick = (courseId: number) => {
  router.push(`/course/${courseId}`);
};

// ---------------- AI 总结相关 ----------------
const fallbackAiSummaryTitle = "根据您的学习进度，AI助手小启为您总结：";
const fallbackAiSummaryItems = [
  "您目前已完成基础模块学习，知识点体系良好",
  "建议加强实践环节的练习",
  "下周将开始新模块的学习",
  "根据您的习题练习已经生成相似题目推荐，推荐练习",
  "您可以结合AI课程动画再次复习知识点体系",
  "知识点已生成可以在课程主页进行观看"
] as const;
type LearningSummaryStatus = "loading" | "live" | "fallback";
const LEARNING_SUMMARY_TIMEOUT_MS = 8000;
const aiSummaryTitle = ref(fallbackAiSummaryTitle);
const aiSummaryList = ref<string[]>([...fallbackAiSummaryItems]);
const aiSummaryStatus = ref<LearningSummaryStatus>("loading");
const aiSummaryStatusText = computed(() => {
  if (aiSummaryStatus.value === "loading") {
    return "正在获取实时学习总结，当前先展示学习总结示例";
  }
  if (aiSummaryStatus.value === "live") return "实时学习总结已更新";
  return "实时总结暂不可用，当前展示学习总结示例";
});

// 打字效果相关状态
const typingIndex = ref(0); // 当前正在打的行索引
const charIndex = ref(0); // 当前行字符位置
const typedLines = ref<string[]>([]); // 已经显示的内容（含正在输入的行）
const isTyping = ref(false);
const typingSpeed = 55; // 每个字符毫秒
let typingTimer: number | null = null;
let learningSummaryRequestId = 0;
const learningSummaryRequestCancels = new Map<number, () => void>();

const resetTyping = () => {
  if (typingTimer !== null) {
    window.clearTimeout(typingTimer);
    typingTimer = null;
  }
  typedLines.value = [];
  typingIndex.value = 0;
  charIndex.value = 0;
  isTyping.value = false;
};

const typeNextChar = () => {
  const lines = aiSummaryList.value;
  if (typingIndex.value >= lines.length) {
    isTyping.value = false;
    typingTimer = null;
    return;
  }

  const currentLine = lines[typingIndex.value];
  if (typedLines.value[typingIndex.value] === undefined) {
    typedLines.value[typingIndex.value] = "";
  }

  typedLines.value[typingIndex.value] += currentLine[charIndex.value];
  charIndex.value += 1;

  if (charIndex.value < currentLine.length) {
    typingTimer = window.setTimeout(typeNextChar, typingSpeed);
    return;
  }

  typingIndex.value += 1;
  charIndex.value = 0;
  typingTimer = window.setTimeout(typeNextChar, 320);
};

const startTyping = () => {
  resetTyping();
  if (!aiSummaryList.value.length) return;

  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    typedLines.value = [...aiSummaryList.value];
    return;
  }

  isTyping.value = true;
  typeNextChar();
};

// 供模板使用的展示列表
const displayedSummary = computed(() => typedLines.value);

const invalidateLearningSummaryRequest = () => {
  learningSummaryRequestId += 1;
  for (const cancelRequest of learningSummaryRequestCancels.values()) {
    cancelRequest();
  }
  learningSummaryRequestCancels.clear();
};

const requestLearningSummaryWithTimeout = async (requestId: number) => {
  let timeoutTimer: number | null = null;
  let cancelRequest: () => void = () => undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutTimer = window.setTimeout(
      () => reject(new Error("学习总结请求超时")),
      LEARNING_SUMMARY_TIMEOUT_MS
    );
  });
  const cancellationPromise = new Promise<never>((_, reject) => {
    cancelRequest = () => reject(new Error("学习总结请求已失效"));
  });
  learningSummaryRequestCancels.set(requestId, cancelRequest);

  try {
    return await Promise.race([
      Promise.resolve().then(() => getLearningSummary()),
      timeoutPromise,
      cancellationPromise
    ]);
  } finally {
    if (timeoutTimer !== null) window.clearTimeout(timeoutTimer);
    if (learningSummaryRequestCancels.get(requestId) === cancelRequest) {
      learningSummaryRequestCancels.delete(requestId);
    }
  }
};

const loadLearningSummary = async (requestId: number) => {
  let responseItems: string[] = [];

  try {
    const { code, data } = await requestLearningSummaryWithTimeout(requestId);
    responseItems = Array.isArray(data?.items)
      ? data.items
          .filter((item): item is string => typeof item === "string")
          .map(item => item.trim())
          .filter(Boolean)
      : [];

    if (code === 200 && responseItems.length > 0) {
      if (
        requestId !== learningSummaryRequestId ||
        activeMenu.value !== "home"
      ) {
        return;
      }

      aiSummaryTitle.value =
        typeof data?.title === "string" && data.title.trim()
          ? data.title.trim()
          : fallbackAiSummaryTitle;
      aiSummaryList.value = responseItems;
      aiSummaryStatus.value = "live";
      startTyping();
      return;
    }
  } catch (error) {
    if (requestId !== learningSummaryRequestId) return;
    console.warn("获取学习总结失败，使用本地总结回退:", error);
  }

  if (requestId !== learningSummaryRequestId || activeMenu.value !== "home") {
    return;
  }

  aiSummaryTitle.value = fallbackAiSummaryTitle;
  aiSummaryList.value = [...fallbackAiSummaryItems];
  aiSummaryStatus.value = "fallback";
};

const beginLearningSummaryRefresh = () => {
  invalidateLearningSummaryRequest();
  const requestId = learningSummaryRequestId;
  aiSummaryTitle.value = fallbackAiSummaryTitle;
  aiSummaryList.value = [...fallbackAiSummaryItems];
  aiSummaryStatus.value = "loading";
  startTyping();
  void loadLearningSummary(requestId);
};

const initialLoadDone = ref(false);

// 监听菜单变化并持久化
watch(activeMenu, async newVal => {
  storageLocal().setItem("account_active_menu", newVal);
  if (newVal !== "home") {
    invalidateLearningSummaryRequest();
    resetTyping();
  }
  if (!initialLoadDone.value) return;

  if (newVal === "home") {
    await loadHomeData();
  } else if (newVal === "course") {
    await loadCoursePageData();
  }
});

watch(
  () => route.query.menu,
  async () => {
    const routeMenu = readRouteMenu();
    if (!routeMenu || routeMenu === activeMenu.value) return;
    activeMenu.value = routeMenu;
    if (routeMenu === "home") {
      await loadHomeData();
    } else if (routeMenu === "course") {
      await loadCoursePageData();
    }
  }
);

// 初次挂载如果就在首页也启动
onMounted(async () => {
  window.addEventListener("scroll", handleScroll);
  window.addEventListener(
    "userInfoUpdated",
    handleUserInfoUpdate as EventListener
  );
  emitter.on("accountMenuSelect", handleExternalMenuSelect);

  initActiveMenu();

  if (activeMenu.value === "home") {
    await loadHomeData();
  } else if (activeMenu.value === "course") {
    await loadCoursePageData();
  }

  initialLoadDone.value = true;
});

onUnmounted(() => {
  window.removeEventListener("scroll", handleScroll);
  window.removeEventListener(
    "userInfoUpdated",
    handleUserInfoUpdate as EventListener
  );
  emitter.off("accountMenuSelect", handleExternalMenuSelect);
  invalidateLearningSummaryRequest();
  resetTyping();
});
</script>

<style lang="scss" scoped>
@mixin text-ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-container {
  height: 100vh;
  min-height: 100vh;
  overflow: hidden;
  background-color: #f7f8fc;
  transition: background-color 0.3s ease;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }

  &.dark {
    color: #f1f5f9;
    background-color: #0b1120;
  }

  :deep(.layout-footer) {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 20;
    padding: 8px 0 6px;
    pointer-events: none;
    background: transparent;
  }

  .header {
    position: fixed;
    top: 0;
    right: 0;
    left: 0;
    z-index: 1000;
    height: 64px;
    background: linear-gradient(45deg, #97b4f7, #dce2f7);
    box-shadow: 0 2px 8px rgb(0 0 0 / 10%);
    transition: all 0.3s ease;

    &.header-scrolled {
      background: #fff;
      box-shadow: 0 4px 12px rgb(0 0 0 / 15%);

      .user-info .nickname,
      .user-info .el-icon--right {
        color: #333;

        .dark & {
          color: #f1f5f9;
        }
      }
    }

    .dark & {
      background: linear-gradient(45deg, #1e293b, #0f172a);
      border-bottom: 1px solid rgb(255 255 255 / 5%);

      &.header-scrolled {
        background: #111b2d;
      }

      .theme-toggle {
        color: #38bdf8;
        background-color: rgb(255 255 255 / 5%);
      }
    }

    .header-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 100%;
      padding: 0 80px;
      margin: 0 auto;

      .logo {
        height: 48px;
        padding: 6px;
        cursor: pointer;
        background-color: #fff;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgb(0 0 0 / 10%);

        .dark & {
          background-color: #1e293b;
        }

        img {
          height: 100%;
        }
      }

      .header-right {
        display: flex;
        align-items: center;

        .theme-toggle-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 20px;
        }

        .theme-toggle-hit-area {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 60px;
          height: 44px;
          padding: 8px 4px;
          cursor: pointer;
          background: transparent;
          border: 0;
          border-radius: 10px;

          &:focus-visible {
            outline: 2px solid var(--el-color-primary);
            outline-offset: 2px;
          }
        }

        .theme-btn-premium {
          position: relative;
          display: block;
          width: 52px;
          height: 28px;
          padding: 4px;
          cursor: pointer;
          background-color: rgb(255 255 255 / 40%);
          border-radius: 100px;
          box-shadow: inset 0 2px 4px rgb(0 0 0 / 10%);
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          pointer-events: none;

          &:hover {
            background-color: rgb(255 255 255 / 60%);
            transform: scale(1.05);
          }

          &.is-dark {
            background-color: #2d3748;
            box-shadow: inset 0 2px 4px rgb(0 0 0 / 30%);

            .switch-dot {
              background-color: #1a202c;
              box-shadow: 0 2px 4px rgb(0 0 0 / 40%);
              transform: translateX(24px);
            }

            .sun {
              opacity: 0;
              transform: translateY(20px) scale(0);
            }

            .moon {
              color: #f6e05e;
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          .sun-moon-wrapper {
            position: relative;
            width: 100%;
            height: 100%;
            overflow: hidden;
          }

          .icon {
            position: absolute;
            top: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);

            svg {
              width: 16px;
              height: 16px;
            }
          }

          .sun {
            left: 0;
            color: #f6ad55;
            opacity: 1;
            transform: translateY(0) scale(1);
          }

          .moon {
            right: 0;
            color: #718096;
            opacity: 0;
            transform: translateY(-20px) scale(0);
          }

          .switch-dot {
            position: absolute;
            top: 4px;
            left: 4px;
            width: 20px;
            height: 20px;
            background-color: #fff;
            border-radius: 50%;
            box-shadow: 0 2px 4px rgb(0 0 0 / 20%);
            transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
        }

        .user-info {
          display: flex;
          align-items: center;
          padding: 0 8px;
          cursor: pointer;
          border-radius: 18px;
          transition: all 0.3s;

          &:hover {
            background-color: rgb(255 255 255 / 20%);

            .el-icon--right {
              transform: rotate(180deg);
            }
          }

          .nickname {
            margin: 0 8px;
            font-size: 16px;
            font-weight: 600;
            color: #333;
            transition: color 0.3s;

            .dark & {
              color: #f1f5f9;
            }
          }

          .el-icon--right {
            font-size: 18px;
            font-weight: bold;
            color: #333;
            transition: all 0.3s ease;

            .dark & {
              color: #f1f5f9;
            }
          }
        }
      }
    }
  }

  .account-content {
    position: relative;
    display: block;
    box-sizing: border-box;
    height: 100vh;
    min-height: 0;
    padding: calc(88px + var(--pure-safe-area-top, 0px)) 32px 28px;

    .account-sidebar {
      position: fixed;
      top: 88px;
      bottom: 28px;
      left: 32px;
      width: 240px;
      height: auto;
      padding-bottom: 32px;
      overflow-y: auto;

      &::-webkit-scrollbar {
        width: 0;
      }

      .user-info-card {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 32px 20px 26px;
        margin-bottom: 16px;
        overflow: hidden;
        text-align: center;
        background: linear-gradient(160deg, #fff, #f8faff);
        border: 1px solid rgb(151 180 247 / 12%);
        border-radius: 18px;
        box-shadow:
          0 4px 24px rgb(151 180 247 / 15%),
          0 1px 4px rgb(0 0 0 / 4%);
        transition: all 0.3s ease;

        &::before {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 60px;
          content: "";
          background: linear-gradient(135deg, #97b4f7, #dce2f7);
          opacity: 0.15;
        }

        &:hover {
          box-shadow:
            0 8px 32px rgb(151 180 247 / 22%),
            0 2px 8px rgb(0 0 0 / 6%);
          transform: translateY(-2px);

          .avatar-ring {
            border-color: #97b4f7;
            transform: scale(1.05);
          }
        }

        .avatar-wrapper {
          position: relative;
          z-index: 1;
          margin-bottom: 10px;

          .el-avatar {
            border: 3px solid #fff;
            box-shadow:
              0 4px 16px rgb(151 180 247 / 30%),
              0 0 0 3px rgb(151 180 247 / 15%);
            transition: transform 0.3s ease;
          }

          &:hover .el-avatar {
            transform: scale(1.05);
          }

          .avatar-ring {
            position: absolute;
            inset: -7px;
            border: 2px dashed rgb(151 180 247 / 50%);
            border-radius: 50%;
            transition: all 0.4s ease;
            animation: rotate 12s linear infinite;
          }
        }

        h3 {
          position: relative;
          z-index: 1;
          margin: 12px 0 6px;
          font-size: 18px;
          font-weight: 700;
          color: #1a1a2e;

          .dark & {
            color: #f1f5f9;
          }
        }

        .user-role {
          position: relative;
          z-index: 1;
          padding: 4px 14px;
          margin: 0;
          font-size: 12px;
          font-weight: 600;
          color: #fff;
          letter-spacing: 0.5px;
          background: linear-gradient(135deg, #97b4f7, #7c9cf5);
          border-radius: 20px;
          box-shadow: 0 2px 8px rgb(151 180 247 / 35%);

          .dark & {
            color: #38bdf8;
            background: linear-gradient(135deg, #0ea5e9, #0284c7);
            box-shadow: 0 2px 8px rgb(56 189 248 / 25%);
          }
        }

        .dark & {
          background: linear-gradient(160deg, #111b2d, #0f172a);
          border-color: rgb(56 189 248 / 10%);
          box-shadow: 0 4px 24px rgb(0 0 0 / 30%);

          &::before {
            background: linear-gradient(135deg, #38bdf8, #0ea5e9);
            opacity: 0.08;
          }

          .avatar-ring {
            border-color: #334155;
          }
        }
      }

      .account-menu {
        padding: 14px;
        background: linear-gradient(160deg, #fff, #f8faff);
        border: 1px solid rgb(151 180 247 / 12%);
        border-radius: 18px;
        box-shadow:
          0 4px 24px rgb(151 180 247 / 12%),
          0 1px 4px rgb(0 0 0 / 4%);

        .dark & {
          background: linear-gradient(160deg, #111b2d, #0f172a);
          border-color: rgb(56 189 248 / 10%);
          box-shadow: 0 4px 24px rgb(0 0 0 / 30%);
        }

        :deep(.el-menu-item) {
          position: relative;
          height: 46px;
          margin-bottom: 4px;
          overflow: hidden;
          line-height: 46px;
          color: #555;
          background-color: transparent;
          border-radius: 12px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

          &::before {
            position: absolute;
            top: 50%;
            left: 0;
            width: 3px;
            height: 0;
            content: "";
            background: linear-gradient(180deg, #97b4f7, #7c9cf5);
            border-radius: 0 4px 4px 0;
            box-shadow: 0 0 8px rgb(151 180 247 / 40%);
            transform: translateY(-50%);
            transition: height 0.3s ease;
          }

          &:hover {
            color: #1a1a2e;
            background: linear-gradient(
              90deg,
              rgb(151 180 247 / 12%),
              transparent
            );

            &::before {
              height: 55%;
            }

            span {
              font-weight: 600;
            }
          }

          &.is-active {
            font-weight: 700;
            color: #1a1a2e;
            background: linear-gradient(
              90deg,
              rgb(151 180 247 / 18%),
              rgb(220 226 247 / 10%)
            );
            border: 1px solid rgb(151 180 247 / 15%);
            box-shadow: 0 2px 8px rgb(151 180 247 / 12%);

            .dark & {
              color: #f1f5f9;
              background: linear-gradient(
                90deg,
                rgb(56 189 248 / 15%),
                transparent
              );
              border-color: rgb(56 189 248 / 15%);
              box-shadow: 0 2px 8px rgb(56 189 248 / 10%);
            }

            &::before {
              height: 65%;
              background: linear-gradient(180deg, #97b4f7, #7c9cf5);
              box-shadow: 0 0 10px rgb(151 180 247 / 50%);

              .dark & {
                background: linear-gradient(180deg, #38bdf8, #0ea5e9);
              }
            }

            .el-icon {
              color: #97b4f7;

              .dark & {
                color: #38bdf8;
              }
            }
          }

          .dark & {
            color: #94a3b8;

            &:hover {
              color: #f1f5f9;
              background: linear-gradient(
                90deg,
                rgb(56 189 248 / 10%),
                transparent
              );

              .el-icon {
                color: #38bdf8;
              }
            }
          }

          .el-icon {
            margin-right: 12px;
            font-size: 22px;
            color: #8a9bbf;
            transition: all 0.3s ease;
          }

          span {
            font-size: 14px;
            letter-spacing: 0.2px;
            transition: all 0.3s ease;
          }
        }
      }
    }

    .account-main {
      height: 100%;
      margin-left: 264px;
      min-width: 0;
      min-height: 0;
      padding: 0 0 56px;
      overflow-y: auto;
      background-color: transparent;
      border-radius: 12px;
      box-shadow: none;
      scrollbar-width: none;

      &::-webkit-scrollbar {
        display: none;
        width: 0;
      }

      &.account-main--student-resources {
        padding-bottom: 0;
        overflow: hidden;
      }

      .account-main__student-resources {
        height: 100%;
        min-height: 0;
        overflow: hidden;
      }

      .quick-access-section {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        margin-bottom: 24px;

        .quick-access-card {
          display: flex;
          gap: 16px;
          align-items: center;
          padding: 20px;
          cursor: pointer;
          background: linear-gradient(160deg, #fff, #f8faff);
          border: 1px solid rgb(151 180 247 / 10%);
          border-radius: 16px;
          box-shadow:
            0 4px 20px rgb(151 180 247 / 10%),
            0 1px 3px rgb(0 0 0 / 4%);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

          .dark & {
            background: linear-gradient(160deg, #111b2d, #0f172a);
            border-color: rgb(56 189 248 / 8%);
            box-shadow: 0 4px 20px rgb(0 0 0 / 20%);

            &.lab-access .access-icon {
              background: linear-gradient(135deg, #2e1065, #4c1d95);
            }

            &.competition-access .access-icon {
              background: linear-gradient(135deg, #451a03, #78350f);
            }

            &.course-access .access-icon {
              background: linear-gradient(135deg, #064e3b, #065f46);
            }

            &.cloud-access .access-icon {
              background: linear-gradient(135deg, #0c4a6e, #075985);
            }
          }

          &:hover {
            border-color: rgb(151 180 247 / 25%);
            box-shadow:
              0 8px 32px rgb(151 180 247 / 18%),
              0 2px 6px rgb(0 0 0 / 5%);
            transform: translateY(-4px);

            .access-arrow {
              opacity: 1;
              transform: translateX(4px);
            }
          }

          .access-icon {
            display: flex;
            flex-shrink: 0;
            align-items: center;
            justify-content: center;
            width: 52px;
            height: 52px;
            font-size: 26px;
            border-radius: 14px;
            box-shadow: 0 2px 8px rgb(0 0 0 / 6%);
          }

          .access-info {
            flex: 1;
            min-width: 0;

            h4 {
              margin: 0 0 4px;
              font-size: 16px;
              font-weight: 700;
              color: #1a1a2e;

              .dark & {
                color: #f1f5f9;
              }
            }

            p {
              margin: 0;
              overflow: hidden;
              text-overflow: ellipsis;
              font-size: 12px;
              color: #999;
              white-space: nowrap;

              .dark & {
                color: #94a3b8;
              }
            }
          }

          .access-arrow {
            font-size: 20px;
            font-weight: bold;
            color: #999;
            opacity: 0.5;
            transition: all 0.3s ease;

            .dark & {
              color: #38bdf8;
              opacity: 1;
            }
          }

          &.lab-access .access-icon {
            background: linear-gradient(135deg, #ede9fe, #ddd6fe);
          }

          &.competition-access .access-icon {
            background: linear-gradient(135deg, #fef3c7, #fde68a);
          }

          &.course-access .access-icon {
            background: linear-gradient(135deg, #dcfce7, #bbf7d0);
          }

          &.cloud-access .access-icon {
            background: linear-gradient(135deg, #e0f2fe, #bae6fd);
          }
        }
      }

      .card {
        padding: 28px;
        margin-bottom: 24px;
        background: linear-gradient(160deg, #fff, #f8faff);
        border: 1px solid rgb(151 180 247 / 10%);
        border-radius: 16px;
        box-shadow:
          0 4px 24px rgb(151 180 247 / 12%),
          0 1px 4px rgb(0 0 0 / 4%);

        .dark & {
          background: linear-gradient(160deg, #111b2d, #0f172a);
          border-color: rgb(56 189 248 / 10%);
          box-shadow: 0 4px 24px rgb(0 0 0 / 30%);
        }

        .reminder {
          margin-bottom: 20px;

          :deep(.el-carousel__item) {
            display: flex;
            align-items: center;
          }

          .reminder-content {
            display: flex;
            align-items: center;
            width: 100%;
            height: 100%;
            padding: 0 16px;
            font-size: 14px;
            color: #5a6b8a;
            background-color: rgb(220 226 247 / 30%);
            border: 1px solid rgb(220 226 247 / 60%);
            border-radius: 12px;

            .dark & {
              color: #38bdf8;
              background-color: rgb(56 189 248 / 5%);
              border-color: rgb(56 189 248 / 20%);
            }

            .el-icon {
              margin-right: 12px;
              font-size: 20px;
              color: #7a8bb8;
            }

            .notice-text {
              flex: 1;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
          }
        }

        .info-section {
          display: flex;
          gap: 24px;

          .course-info {
            flex: 0.7;

            h3 {
              display: flex;
              align-items: center;
              margin: 0 0 16px;
              font-size: 18px;
              font-weight: 600;
              color: #333;

              .dark & {
                color: #f1f5f9;
              }
            }

            .course-card {
              min-height: 50vh;
              padding: 16px;
              background-color: #f7f8fc;
              border: 1px solid #eef0f5;
              border-radius: 12px;

              .dark & {
                background-color: #0f172a;
                border-color: #1e293b;
              }

              .course-section {
                margin-bottom: 16px;

                &:last-child {
                  margin-bottom: 0;
                }

                h4 {
                  margin: 0 0 8px;
                  font-size: 14px;
                  font-weight: 600;
                  color: #666;

                  .dark & {
                    color: #cbd5e1;
                  }
                }

                .mini-course-list {
                  display: grid;
                  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                  gap: 12px;
                }

                .mini-course-item {
                  display: flex;
                  gap: 12px;
                  align-items: center;
                  padding: 12px;
                  cursor: pointer;
                  background: #fff;
                  border: 1px solid #ebeef5;
                  border-radius: 12px;
                  box-shadow: 0 2px 8px rgb(0 0 0 / 5%);
                  transition: all 0.3s ease;

                  .dark & {
                    background: #1e293b;
                    border-color: #334155;
                    box-shadow: 0 2px 8px rgb(0 0 0 / 20%);

                    &:hover {
                      background: #334155;
                      box-shadow: 0 6px 16px rgb(0 0 0 / 40%);
                    }
                  }

                  &:hover {
                    box-shadow: 0 6px 16px rgb(0 0 0 / 10%);
                    transform: translateY(-4px) scale(1.02);
                  }

                  .course-thumb {
                    position: relative;
                    flex-shrink: 0;
                    width: 64px;
                    height: 64px;
                    overflow: hidden;
                    border-radius: 8px;

                    .thumb-image {
                      position: absolute;
                      top: 0;
                      left: 0;
                      width: 100%;
                      height: 100%;
                      object-fit: cover;
                    }

                    .el-tag {
                      position: absolute;
                      top: 4px;
                      right: 4px;
                      z-index: 1;
                    }
                  }

                  .course-content {
                    display: flex;
                    flex: 1;
                    flex-direction: column;
                    gap: 4px;
                    min-width: 0;

                    .course-name {
                      @include text-ellipsis;

                      font-size: 14px;
                      font-weight: 600;
                      color: #333;

                      .dark & {
                        color: #f1f5f9;
                      }
                    }

                    .course-time {
                      font-size: 13px;
                      color: #606266;

                      .dark & {
                        color: #94a3b8;
                      }
                    }
                  }
                }
              }
            }
          }

          .ai-summary {
            position: relative;
            flex: 0.3;

            h3 {
              margin: 0 0 16px;
              font-size: 18px;
              font-weight: 600;
              color: #333;

              .dark & {
                color: #f1f5f9;
              }
            }

            .summary-card {
              position: absolute;
              inset: 45px 0 0;
              display: flex;
              flex-direction: column;
              padding: 16px;
              overflow: hidden;
              color: #333;
              background: linear-gradient(135deg, #dce2f7, #97b4f7);
              border-radius: 12px;
              box-shadow: 0 4px 12px rgb(220 226 247 / 60%);

              .dark & {
                color: #cbd5e1;
                background: linear-gradient(135deg, #1e293b, #0f172a);
                border: 1px solid rgb(56 189 248 / 20%);
                box-shadow: 0 4px 12px rgb(0 0 0 / 40%);
              }

              .summary-title {
                margin: 0 0 12px;
                font-size: 14px;
                font-weight: 500;
              }

              .summary-status {
                margin: -4px 0 10px;
                font-size: 12px;
                line-height: 1.5;
                color: #334155;

                .dark & {
                  color: #bae6fd;
                }
              }

              ul {
                flex: 1 1 auto;
                min-height: 0;
                padding-left: 0;
                margin: 0;
                overflow-y: auto;
                list-style: none;

                &::-webkit-scrollbar {
                  width: 4px;
                }

                &::-webkit-scrollbar-thumb {
                  background-color: rgb(255 255 255 / 50%);
                  border-radius: 2px;
                }

                li {
                  position: relative;
                  padding-left: 16px;
                  margin-bottom: 8px;
                  font-size: 14px;
                  line-height: 1.6;

                  &:last-child {
                    margin-bottom: 0;
                  }

                  &::before {
                    position: absolute;
                    top: 0.9em;
                    left: 0;
                    width: 6px;
                    height: 6px;
                    content: "";
                    background: #fff;
                    border-radius: 50%;
                    opacity: 0.9;
                    transform: translateY(-50%);
                  }

                  &.typing-cursor {
                    color: #94a3b8;

                    &::before {
                      display: none;
                    }
                  }
                }
              }
            }
          }
        }
      }

      .course-list {
        .course-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          margin-bottom: 20px;
          background: linear-gradient(135deg, #dce2f7, #97b4f7);
          border-radius: 12px;

          .dark & {
            background: linear-gradient(135deg, #1e293b, #0f172a);
            border: 1px solid rgb(56 189 248 / 20%);
          }

          h3 {
            display: flex;
            align-items: center;
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: #333;

            .dark & {
              color: #f1f5f9;
            }
          }

          .course-filter {
            :deep(.el-select) {
              .el-select__wrapper {
                background: #97b4f7;
                border: none;
                border-radius: 8px;
                box-shadow: none;

                .dark & {
                  background: #334155;
                }
              }

              .el-select__placeholder {
                color: #333;

                .dark & {
                  color: #f1f5f9;
                }
              }

              .el-select__suffix {
                color: #000;

                .dark & {
                  color: #f1f5f9;
                }

                .el-icon {
                  color: #000;

                  .dark & {
                    color: #f1f5f9;
                  }
                }
              }
            }
          }
        }

        .course-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 20px;
          margin-bottom: 24px;

          .course-item {
            position: relative;
            overflow: hidden;
            cursor: pointer;
            background: linear-gradient(145deg, #fff, #f8faff);
            border: 1px solid rgb(220 226 247 / 60%);
            border-radius: 16px;
            box-shadow: 0 4px 20px rgb(0 0 0 / 6%);
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

            &::before {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 3px;
              content: "";
              background: linear-gradient(90deg, #97b4f7, #dce2f7);
              opacity: 0;
              transition: opacity 0.3s ease;
            }

            &:hover::before {
              opacity: 1;
            }

            .dark & {
              background: linear-gradient(145deg, #111b2d, #0f172a);
              border-color: #1e293b;
              box-shadow: 0 4px 20px rgb(0 0 0 / 30%);

              &::before {
                background: linear-gradient(90deg, #38bdf8, #0ea5e9);
              }

              &:hover {
                border-color: #38bdf8;
                box-shadow: 0 12px 40px rgb(56 189 248 / 20%);
              }
            }

            &:hover {
              border-color: #97b4f7;
              box-shadow: 0 12px 40px rgb(151 180 247 / 30%);
              transform: translateY(-8px) scale(1.02);
            }

            .course-cover {
              position: relative;
              width: 100%;
              padding-top: 56.25%; // 16:9
              overflow: hidden;
              background: linear-gradient(
                135deg,
                rgb(220 226 247 / 30%),
                rgb(200 212 240 / 20%)
              );

              .cover-image {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                object-fit: cover;
                transition: transform 0.4s ease;
              }

              .course-status {
                position: absolute;
                top: 12px;
                right: 12px;
                z-index: 1;

                .el-tag {
                  padding: 6px 14px;
                  font-size: 12px;
                  font-weight: 600;
                  border: none;
                  border-radius: 8px;
                  box-shadow: 0 2px 8px rgb(0 0 0 / 15%);
                  backdrop-filter: blur(8px);
                }
              }
            }

            &:hover .course-cover .cover-image {
              transform: scale(1.08);
            }

            .course-info {
              padding: 18px;
              background: linear-gradient(180deg, #fff, rgb(220 226 247 / 10%));

              .dark & {
                background: linear-gradient(
                  180deg,
                  #111b2d,
                  rgb(56 189 248 / 5%)
                );
              }

              h4 {
                @include text-ellipsis;

                margin: 0 0 10px;
                font-size: 16px;
                font-weight: 700;
                line-height: 1.4;
                color: #1a1a1a;
                letter-spacing: 0.3px;

                .dark & {
                  color: #f1f5f9;
                }
              }

              p {
                height: 32px;
                margin: 0 0 12px;
                font-size: 13px;
                line-height: 1.5;
                color: #5a6b8a;

                .dark & {
                  color: #94a3b8;
                }
              }

              .course-meta {
                display: flex;
                justify-content: space-between;
                padding-top: 12px;
                font-size: 12px;
                color: #7a8bb8;
                border-top: 1px solid rgb(220 226 247 / 40%);

                .dark & {
                  color: #64748b;
                  border-top-color: rgb(56 189 248 / 10%);
                }

                span {
                  display: flex;
                  gap: 4px;
                  align-items: center;

                  .el-icon {
                    font-size: 14px;
                    color: #97b4f7;

                    .dark & {
                      color: #38bdf8;
                    }
                  }
                }
              }
            }
          }
        }

        .pagination {
          display: flex;
          gap: 12px;
          align-items: center;
          justify-content: center;
          padding-top: 16px;
          margin-top: 16px;
          border-top: 1px solid rgb(220 226 247 / 60%);

          .dark & {
            border-top-color: #1e293b;
          }

          .page-info {
            min-width: 60px;
            padding: 4px 12px;
            font-size: 14px;
            color: #5a6b8a;
            text-align: center;
            background: linear-gradient(
              135deg,
              rgb(220 226 247 / 40%),
              rgb(200 212 240 / 30%)
            );
            border-radius: 10px;

            .dark & {
              color: #38bdf8;
              background: linear-gradient(135deg, #1e293b, #0f172a);
              border: 1px solid rgb(56 189 248 / 20%);
            }
          }
        }
      }
    }
  }

  /* stylelint-disable-next-line order/order */
  @media (width <= 1199px) {
    .header {
      .header-content {
        padding: 0 24px;
      }
    }

    .account-content {
      gap: 20px;
      padding: 84px 20px 24px;

      .account-sidebar {
        top: 84px;
        bottom: 24px;
        left: 20px;
        width: 220px;
      }

      .account-main {
        padding-bottom: 56px;
        margin-left: 240px;

        .quick-access-section {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .card {
          .info-section {
            flex-direction: column;

            .course-info,
            .ai-summary {
              flex: 1 1 auto;
            }

            .ai-summary {
              .summary-card {
                position: static;
                min-height: 240px;
              }
            }
          }
        }
      }
    }
  }

  /* stylelint-disable-next-line order/order */
  @media (width <= 767px) {
    height: auto;
    min-height: 100vh;
    overflow: visible;

    :deep(.layout-footer) {
      position: static;
      padding-bottom: max(8px, env(safe-area-inset-bottom, 0px));
      pointer-events: auto;
    }

    .header {
      height: calc(72px + var(--pure-safe-area-top, 0px));
      padding-top: var(--pure-safe-area-top, 0);
      box-sizing: border-box;

      .header-content {
        height: 72px;
        padding: 0 16px;

        .logo {
          height: 42px;
          padding: 5px;
          border-radius: 12px;
        }

        .header-right {
          gap: 10px;

          .theme-toggle-wrapper {
            margin-right: 0;
          }

          .user-info {
            max-width: calc(100vw - 150px);
            padding: 0 4px;

            .nickname {
              @include text-ellipsis;

              max-width: 72px;
              margin: 0 6px;
              font-size: 14px;
            }

            .el-icon--right {
              font-size: 16px;
            }
          }
        }
      }
    }

    .account-content {
      flex-direction: column;
      gap: 18px;
      height: auto;
      min-height: calc(100vh - 72px);
      padding: calc(84px + var(--pure-safe-area-top, 0px)) 14px 0;

      .account-sidebar {
        position: static;
        inset: auto;
        width: 100%;
        height: auto;
        padding-bottom: 0;
        overflow: visible;

        .user-info-card {
          display: flex;
          flex-direction: column;
          gap: 10px;
          align-items: center;
          justify-content: center;
          padding: 26px 18px 20px;
          margin-bottom: 14px;
          text-align: center;
          border-radius: 22px;

          &::before {
            height: 72px;
            background: linear-gradient(
              135deg,
              rgb(151 180 247 / 18%),
              transparent
            );
          }

          .avatar-wrapper {
            margin-bottom: 0;
          }

          h3 {
            margin: 4px 0 0;
            font-size: 22px;
          }

          .user-role {
            justify-self: center;
            padding: 6px 20px;
            font-size: 13px;
          }
        }

        .account-menu {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: nowrap;
          gap: 10px;
          padding: 14px;
          overflow: auto hidden;
          scroll-snap-type: x proximity;
          scroll-padding-inline: 14px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          white-space: nowrap;
          border-radius: 22px;

          &::-webkit-scrollbar {
            display: none;
          }

          :deep(.el-menu-item) {
            display: inline-flex;
            flex: 0 0 auto;
            flex-direction: row;
            gap: 8px;
            align-items: center;
            justify-content: center;
            min-width: max-content;
            height: auto;
            padding: 12px 18px;
            margin-bottom: 0;
            line-height: 1.1;
            white-space: nowrap;
            background-color: transparent;
            border: 1px solid rgb(151 180 247 / 8%);
            border-radius: 18px;
            scroll-snap-align: start;

            &::before {
              display: none;
            }

            .el-icon {
              margin-right: 0;
              font-size: 20px;
            }

            span {
              display: block;
              font-size: 13px;
              line-height: 1.1;
              white-space: nowrap;
            }
          }
        }
      }

      .account-main {
        height: auto;
        margin-left: 0;
        padding-bottom: 56px;
        overflow: visible;

        &.account-main--student-resources {
          padding-bottom: 56px;
          overflow: visible;
        }

        .account-main__student-resources {
          height: auto;
          overflow: visible;
        }

        .quick-access-section {
          grid-template-columns: 1fr;
          gap: 12px;
          margin-bottom: 16px;

          .quick-access-card {
            padding: 16px;

            .access-icon {
              width: 46px;
              height: 46px;
            }

            .access-info {
              p {
                white-space: normal;
              }
            }
          }
        }

        .card {
          padding: 18px 16px;
          margin-bottom: 16px;
          border-radius: 22px;

          .reminder {
            margin-bottom: 16px;

            .reminder-content {
              padding: 0 12px;
              font-size: 13px;
            }
          }

          .info-section {
            gap: 16px;

            .course-info {
              h3 {
                margin-bottom: 12px;
                font-size: 17px;
              }

              .course-card {
                min-height: auto;
                padding: 12px;

                .course-section {
                  .mini-course-list {
                    grid-template-columns: 1fr;
                    gap: 10px;
                  }

                  .mini-course-item {
                    padding: 10px;
                  }
                }
              }
            }

            .ai-summary {
              h3 {
                margin-bottom: 12px;
                font-size: 17px;
              }

              .summary-card {
                min-height: 220px;
                padding: 14px;
              }
            }
          }
        }

        .course-list {
          .course-header {
            flex-direction: column;
            gap: 12px;
            align-items: stretch;
            padding: 16px;
            border-radius: 18px;

            h3 {
              font-size: 17px;
            }

            .course-filter {
              :deep(.el-select) {
                width: 100%;
              }
            }
          }

          .course-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .pagination {
            gap: 10px;
            justify-content: space-between;

            .el-button {
              flex: 1;
            }

            .page-info {
              min-width: auto;
            }
          }
        }
      }
    }
  }

  /* stylelint-disable-next-line order/order */
  @media (width <= 479px) {
    .header {
      .header-content {
        .logo {
          height: 38px;
        }

        .header-right {
          gap: 8px;

          .user-info {
            max-width: calc(100vw - 136px);

            .nickname {
              max-width: 56px;
            }
          }
        }
      }
    }

    .account-content {
      padding: calc(84px + var(--pure-safe-area-top, 0px)) 10px 0;

      .account-sidebar {
        .user-info-card {
          padding: 22px 14px 18px;
        }

        .account-menu {
          padding: 12px;

          :deep(.el-menu-item) {
            padding: 11px 16px;
          }
        }
      }

      .account-main {
        .card {
          padding: 16px;
        }

        .course-list {
          .pagination {
            flex-wrap: wrap;
          }
        }
      }
    }
  }
} // 添加文本省略混入
</style>

<style lang="scss">
/* 全局样式 - 下拉菜单圆角 */

/* 针对 el-popper 容器（dropdown 的外层包装） */
.el-popper:has(.logout-menu) {
  overflow: hidden !important;
  background: transparent !important;
  border: none !important;
  border-radius: 16px !important;
  box-shadow: none !important;

  /* 隐藏箭头 */
  .el-popper__arrow {
    display: none !important;
  }
}

.logout-menu {
  padding: 8px !important;
  margin: 0 !important;
  overflow: hidden !important;
  background-color: rgb(255 255 255 / 95%) !important;
  border: 1px solid rgb(220 226 247 / 60%) !important;
  border-radius: 16px !important;
  box-shadow:
    0 10px 25px -3px rgb(0 0 0 / 10%),
    0 4px 6px -2px rgb(0 0 0 / 5%) !important;
  backdrop-filter: blur(40px);

  /* 清除默认的 margin/padding 可能造成的衬底 */
  &::before,
  &::after {
    display: none !important;
  }

  .el-dropdown-menu__item {
    padding: 10px 18px;
    margin-bottom: 4px;
    font-weight: 500;
    border-radius: 10px;
    transition: all 0.2s ease;

    &:last-child {
      margin-bottom: 0;
      color: #f56c6c;

      &:hover {
        color: #f56c6c !important;
        background-color: rgb(245 108 108 / 10%) !important;
      }
    }

    &:hover {
      color: #333 !important;
      background-color: rgb(200 212 240 / 40%) !important;
    }

    .el-icon {
      margin-right: 8px;
    }
  }
}

/* 深色模式适配 */
html.dark .el-popper:has(.logout-menu),
.dark .el-popper:has(.logout-menu) {
  background: transparent !important;
}

html.dark .logout-menu,
.dark .logout-menu {
  background-color: rgb(17 27 45 / 98%) !important;
  border: 1px solid rgb(56 189 248 / 20%) !important;
  box-shadow: 0 10px 25px -3px rgb(0 0 0 / 40%) !important;

  .el-dropdown-menu__item {
    color: #e2e8f0;

    &:hover {
      color: #f1f5f9 !important;
      background-color: rgb(56 189 248 / 15%) !important;
    }
  }

  .el-dropdown-menu__item:last-child {
    color: #f87171;

    &:hover {
      color: #f87171 !important;
      background-color: rgb(248 113 113 / 15%) !important;
    }
  }
}
</style>
