import { $t } from "@/plugins/i18n";
const Layout = () => import("@/layout/index.vue");

export default [
  {
    path: "/home",
    name: "Home",
    component: () => import("@/views/home/index.vue"),
    meta: {
      title: $t("menus.pureHome"),
      showLink: false,
      rank: 100
    }
  },
  {
    path: "/login",
    name: "Login",
    component: () => import("@/views/login/index.vue"),
    meta: {
      title: $t("menus.pureLogin"),
      showLink: false,
      rank: 101
    }
  },
  {
    path: "/redirect",
    component: Layout,
    meta: {
      title: $t("status.pureLoad"),
      showLink: false,
      rank: 102
    },
    children: [
      {
        path: "/redirect/:path(.*)",
        name: "Redirect",
        component: () => import("@/layout/redirect.vue")
      }
    ]
  },
  // 下面是一个无layout菜单的例子（一个全屏空白页面），因为这种情况极少发生，所以只需要在前端配置即可（配置路径：src/router/modules/remaining.ts）
  {
    path: "/empty",
    name: "Empty",
    component: () => import("@/views/empty/index.vue"),
    meta: {
      title: $t("menus.pureEmpty"),
      showLink: false,
      rank: 103
    }
  },
  {
    path: "/account-settings",
    name: "AccountSettings",
    component: () => import("@/views/account-settings/index.vue"),
    meta: {
      title: $t("buttons.pureAccountSettings"),
      showLink: false,
      rank: 104
    }
  },
  {
    path: "/account",
    name: "Account",
    component: () => import("@/views/account/index.vue"),
    meta: {
      title: "账号管理",
      showLink: false,
      rank: 105
    }
  },
  {
    path: "/account/ai-app",
    name: "AccountAiApp",
    component: () => import("@/views/account/ai-app/index.vue"),
    meta: {
      title: "AI App",
      showLink: false,
      rank: 105.5
    }
  },
  {
    path: "/ai-app/workspace",
    name: "AiAppWorkspace",
    component: () => import("@/views/ai-app/index.vue"),
    meta: {
      title: "AI App",
      showLink: false,
      rank: 105.6,
      roles: ["admin", "teacher", "student"],
      activePath: "/ai-app/index"
    }
  },
  {
    path: "/course/:id",
    name: "CourseDetail",
    component: () => import("@/views/account/course-detail.vue"),
    meta: {
      title: "课程学习",
      showLink: false,
      rank: 106,
      roles: ["admin", "teacher", "student"]
    }
  },
  {
    path: "/account/homework-detail",
    name: "HomeworkDetail",
    component: () => import("@/views/account/homework-detail.vue"),
    meta: {
      title: "作业详情",
      showLink: false,
      rank: 107
    }
  },
  {
    path: "/account/exam-detail",
    name: "ExamDetail",
    component: () => import("@/views/account/exam-detail.vue"),
    meta: {
      title: "考试详情",
      showLink: false,
      rank: 108
    }
  },
  // 学生答卷页面（全屏，无布局）
  {
    path: "/student-exam-center/do/:id",
    name: "StudentExamDo",
    component: () => import("@/views/exam-paper/do/index.vue"),
    meta: {
      title: "参加考试",
      showLink: false,
      rank: 109,
      roles: ["student"]
    }
  },
  {
    path: "/exam-paper/result/:submissionId",
    name: "ExamPaperResult",
    component: () => import("@/views/exam-paper/result/index.vue"),
    meta: {
      title: "考试结果",
      showLink: false,
      rank: 110,
      roles: ["student"]
    }
  }
  // 嵌入到课程详情中的随练页面已不再需要独立路由
] satisfies Array<RouteConfigsTable>;
