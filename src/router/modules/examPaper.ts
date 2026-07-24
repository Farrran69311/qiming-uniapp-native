import { withBackendCapability } from "@/router/backendCapabilityRoute";

const guardExamPaperRoute = (
  name: string,
  title: string,
  loader: () => Promise<any>,
  probePaths: string[]
) =>
  withBackendCapability(loader, {
    name,
    title,
    moduleName: "试卷管理",
    probePaths,
    kind: "exam",
    fallbackPath: "/welcome/index"
  });

export default {
  path: "/exam-paper",
  redirect: "/exam-paper/index",
  meta: {
    icon: "ri:file-list-3-line",
    title: "题目组卷器",
    rank: 8,
    roles: ["admin", "teacher"]
  },
  children: [
    {
      path: "/exam-paper/index",
      name: "ExamPaperIndex",
      component: guardExamPaperRoute(
        "ExamPaperOverviewCapability",
        "题目组卷器",
        () => import("@/views/exam-paper/index.vue"),
        [
          "/edu/backend/v1/paper/overview/statistics",
          "/edu/backend/v1/paper/learning-analytics",
          "/edu/backend/v1/paper/template/system/stats"
        ]
      ),
      meta: {
        title: "试卷总览",
        icon: "ri:dashboard-line"
      }
    },
    {
      path: "/exam-paper/my-papers",
      name: "ExamPaperMyPapers",
      component: guardExamPaperRoute(
        "ExamPaperListCapability",
        "我的试卷",
        () => import("@/views/exam-paper/my-papers/index.vue"),
        [
          "/edu/backend/v1/paper/list?pageNum=1&pageSize=1",
          "/edu/backend/v1/paper/folders",
          "/edu/backend/v1/paper/my/statistics"
        ]
      ),
      meta: {
        title: "我的试卷",
        icon: "ri:file-paper-2-line"
      }
    },
    {
      path: "/exam-paper/templates",
      name: "ExamPaperTemplates",
      component: guardExamPaperRoute(
        "ExamPaperTemplatesCapability",
        "试卷模板",
        () => import("@/views/exam-paper/templates/index.vue"),
        [
          "/edu/backend/v1/paper/template/my",
          "/edu/backend/v1/paper/template/system/stats"
        ]
      ),
      meta: {
        title: "试卷模板",
        icon: "ri:layout-grid-line"
      }
    },
    {
      path: "/exam-paper/grading",
      name: "ExamPaperGrading",
      component: guardExamPaperRoute(
        "ExamPaperGradingCapability",
        "阅卷管理",
        () => import("@/views/exam-paper/grading/index.vue"),
        [
          "/edu/backend/v1/paper/grading/list?pageNum=1&pageSize=1",
          "/edu/backend/v1/paper/grading/statistics"
        ]
      ),
      meta: {
        title: "阅卷管理",
        icon: "ri:edit-box-line"
      }
    },
    {
      path: "/exam-paper/statistics",
      name: "ExamPaperStatistics",
      component: guardExamPaperRoute(
        "ExamPaperStatisticsCapability",
        "学情分析",
        () => import("@/views/exam-paper/statistics/index.vue"),
        ["/edu/backend/v1/paper/learning-analytics"]
      ),
      meta: {
        title: "学情分析",
        icon: "ri:bar-chart-box-line"
      }
    },
    {
      path: "/exam-paper/question-bank",
      name: "ExamPaperQuestionBank",
      component: guardExamPaperRoute(
        "ExamPaperQuestionBankCapability",
        "题库管理",
        () => import("@/views/exam-paper/question-bank/index.vue"),
        [
          "/edu/backend/v1/question-bank/list?pageNum=1&pageSize=1",
          "/edu/backend/v1/question-bank/statistics",
          "/edu/backend/v1/knowledge-points"
        ]
      ),
      meta: {
        title: "题库管理",
        icon: "ri:database-2-line"
      }
    },
    {
      path: "/exam-paper/editor",
      name: "ExamPaperEditor",
      component: guardExamPaperRoute(
        "ExamPaperCreateCapability",
        "启明在线组卷",
        () => import("@/views/exam-paper/editor/index.vue"),
        ["/edu/backend/v1/paper/list?pageNum=1&pageSize=1"]
      ),
      meta: {
        title: "编辑试卷",
        showLink: false,
        showParent: false,
        hiddenTag: true
      }
    },
    {
      path: "/exam-paper/editor/:id",
      name: "ExamPaperEditorEdit",
      component: guardExamPaperRoute(
        "ExamPaperEditCapability",
        "启明在线组卷",
        () => import("@/views/exam-paper/editor/index.vue"),
        ["/edu/backend/v1/paper/list?pageNum=1&pageSize=1"]
      ),
      meta: {
        title: "编辑试卷",
        showLink: false,
        showParent: false,
        hiddenTag: true
      }
    },
    {
      path: "/exam-paper/publish/:id",
      name: "ExamPaperPublish",
      component: guardExamPaperRoute(
        "ExamPaperPublishCapability",
        "发布试卷",
        () => import("@/views/exam-paper/editor/index.vue"),
        ["/edu/backend/v1/paper/list?pageNum=1&pageSize=1"]
      ),
      meta: {
        title: "发布试卷",
        showLink: false,
        showParent: false,
        hiddenTag: true
      }
    },
    {
      path: "/exam-paper/grading/:id",
      name: "ExamPaperGradingDetail",
      component: guardExamPaperRoute(
        "ExamPaperGradingDetailCapability",
        "阅卷详情",
        () => import("@/views/exam-paper/grading/detail.vue"),
        ["/edu/backend/v1/paper/grading/list?pageNum=1&pageSize=1"]
      ),
      meta: {
        title: "阅卷详情",
        showLink: false,
        showParent: false,
        hiddenTag: true
      }
    },
    {
      path: "/exam-paper/grading/:id/detail",
      name: "ExamPaperGradingView",
      component: guardExamPaperRoute(
        "ExamPaperGradingViewCapability",
        "查看阅卷",
        () => import("@/views/exam-paper/grading/detail.vue"),
        ["/edu/backend/v1/paper/grading/list?pageNum=1&pageSize=1"]
      ),
      meta: {
        title: "查看阅卷",
        showLink: false,
        showParent: false,
        hiddenTag: true
      }
    }
  ]
} satisfies RouteConfigsTable;
