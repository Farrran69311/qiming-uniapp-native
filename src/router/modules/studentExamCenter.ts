export default {
  path: "/student-exam-center",
  name: "StudentExamCenter",
  redirect: "/student-exam-center/list",
  meta: {
    icon: "ri:file-list-2-line",
    title: "试题试卷中心",
    rank: 5,
    roles: ["student"]
  },
  children: [
    {
      path: "/student-exam-center/list",
      name: "StudentExamCenterList",
      component: () => import("@/views/exam-paper/student-center/index.vue"),
      meta: {
        title: "试卷列表",
        showLink: false,
        roles: ["student"]
      }
    },
    {
      path: "/student-exam-center/detail/:id",
      name: "StudentPaperDetail",
      component: () => import("@/views/exam-paper/student-center/detail.vue"),
      meta: {
        title: "试卷详情",
        showLink: false,
        activePath: "/student-exam-center",
        roles: ["student"]
      }
    }
  ]
} as RouteConfigsTable;
