import { $t } from "@/plugins/i18n";
import { withBackendCapability } from "@/router/backendCapabilityRoute";

const guardCompetitionRoute = (
  name: string,
  title: string,
  loader: () => Promise<any>,
  probePaths: string[]
) =>
  withBackendCapability(loader, {
    name,
    title,
    moduleName: "赛事管理",
    probePaths,
    kind: "competition",
    fallbackPath: "/welcome/index"
  });

export default {
  path: "/competition",
  redirect: "/competition/overview",
  meta: {
    icon: "ri:trophy-line",
    title: $t("menus.competition"),
    rank: 13,
    roles: ["admin", "teacher"]
  },
  children: [
    {
      path: "/competition/overview",
      name: "CompetitionOverview",
      component: guardCompetitionRoute(
        "CompetitionOverviewCapability",
        "赛事大屏概览",
        () => import("@/views/competition/overview/index.vue"),
        [
          "/edu/backend/v1/oj/stats",
          "/edu/backend/v1/competition/event/list?pageNum=1&pageSize=1",
          "/edu/backend/v1/question-bank/stats"
        ]
      ),
      meta: {
        icon: "ri:dashboard-3-line",
        title: "大屏概览"
      }
    },
    {
      path: "/competition/oj",
      name: "CompetitionOJ",
      component: guardCompetitionRoute(
        "CompetitionOjCapability",
        "在线 OJ 管理",
        () => import("@/views/competition/oj/index.vue"),
        [
          "/edu/backend/v1/oj/problem/list?pageNum=1&pageSize=1",
          "/edu/backend/v1/oj/stats"
        ]
      ),
      meta: {
        icon: "ri:code-s-slash-line",
        title: "编程竞赛(OJ)"
      }
    },
    {
      path: "/competition/question-bank",
      name: "CompetitionQuestionBank",
      component: guardCompetitionRoute(
        "CompetitionQuestionBankCapability",
        "知识竞赛题库管理",
        () => import("@/views/competition/question-bank/index.vue"),
        [
          "/edu/backend/v1/question-bank/question/list?pageNum=1&pageSize=1",
          "/edu/backend/v1/question-bank/category/tree",
          "/edu/backend/v1/question-bank/stats"
        ]
      ),
      meta: {
        icon: "ri:questionnaire-line",
        title: "知识竞赛题库"
      }
    },
    {
      path: "/competition/essay",
      name: "CompetitionEssay",
      component: guardCompetitionRoute(
        "CompetitionEssayCapability",
        "作文批改管理",
        () => import("@/views/competition/essay/index.vue"),
        [
          "/edu/backend/v1/essay/list?pageNum=1&pageSize=1",
          "/edu/backend/v1/essay/stats"
        ]
      ),
      meta: {
        icon: "ri:file-text-line",
        title: "作文比赛"
      }
    },
    {
      path: "/competition/event-manage",
      name: "CompetitionEventManage",
      component: guardCompetitionRoute(
        "CompetitionEventsCapability",
        "综合赛事管理",
        () => import("@/views/competition/event-manage/index.vue"),
        [
          "/edu/backend/v1/competition/event/list?pageNum=1&pageSize=1",
          "/edu/backend/v1/competition/event/stats"
        ]
      ),
      meta: {
        icon: "ri:calendar-event-line",
        title: "综合赛事管理"
      }
    }
  ]
} satisfies RouteConfigsTable;
