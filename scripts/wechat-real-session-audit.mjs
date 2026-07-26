#!/usr/bin/env node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const root = resolve(new URL("..", import.meta.url).pathname);
const defaultOrigin = "https://aiedu-mp.intelledu.cn";
const defaultApiOrigin = "https://aiedu-api.intelledu.cn";
const artifactsDir = join(root, "artifacts", "wechat-miniprogram");

const accounts = {
  admin: {
    mobile: process.env.QIMING_AUDIT_ADMIN_MOBILE || "13111111111",
    password: process.env.QIMING_AUDIT_ADMIN_PASSWORD || "123456"
  },
  student: {
    mobile: process.env.QIMING_AUDIT_STUDENT_MOBILE || "13111111112",
    password: process.env.QIMING_AUDIT_STUDENT_PASSWORD || "123456"
  },
  teacher: {
    mobile: process.env.QIMING_AUDIT_TEACHER_MOBILE || "13111111113",
    password: process.env.QIMING_AUDIT_TEACHER_PASSWORD || "123456"
  }
};

const roleMeta = {
  admin: { roleType: 3, roles: ["admin"], label: "管理员" },
  teacher: { roleType: 2, roles: ["teacher"], label: "教师" },
  student: { roleType: 1, roles: ["student"], label: "学生" }
};

const allowedHttpFailures = [
  {
    status: 404,
    pathname: "/edu/v1/html-animation/display",
    routes: new Set(["student-course-animations"]),
    reason: "HTML animation display version is not configured",
    matches: issue =>
      Number(issue.responseJson?.code) === 404 &&
      typeof issue.responseJson?.message === "string" &&
      issue.responseJson.message.includes("尚未配置展示版本")
  }
];

function inspectBusinessEnvelope(body) {
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return {
      businessCodePresent: false,
      businessCodeValid: false,
      bodySample: String(body || "").slice(0, 200)
    };
  }

  const hasCode =
    parsed !== null &&
    typeof parsed === "object" &&
    Object.prototype.hasOwnProperty.call(parsed, "code");
  if (!hasCode) {
    return {
      businessCodePresent: false,
      businessCodeValid: false,
      bodySample: String(body || "").slice(0, 200)
    };
  }

  const rawCode = parsed.code;
  const numericCode =
    rawCode === null || rawCode === "" ? Number.NaN : Number(rawCode);
  return {
    businessCodePresent: true,
    businessCodeValid: Number.isFinite(numericCode),
    businessCode: Number.isFinite(numericCode) ? numericCode : null,
    businessCodeRaw: Number.isFinite(numericCode)
      ? undefined
      : String(rawCode).slice(0, 80),
    businessMessage: String(parsed?.msg || parsed?.message || "").slice(0, 200)
  };
}

const routes = [
  {
    role: "student",
    name: "student-account-home",
    entry: "/account?menu=home",
    accountMenuText: "首页",
    readyExpect: ["课程信息", "AI总结"],
    action: { selector: ".quick-access-card.course-access" },
    expect: ["我的课程"],
    afterActionAccountMenuText: "课程",
    postActionWaitMs: 1200
  },
  {
    role: "student",
    name: "student-account-course",
    entry: "/account?menu=course",
    accountMenuText: "课程",
    expect: ["课程"]
  },
  {
    role: "student",
    name: "student-account-resources",
    entry: "/account?menu=student-resources",
    accountMenuText: "教学资源",
    readyExpect: ["点击资源卡片进入在线预览与文件辅导"],
    action: {
      selector: ".resource-card",
      afterSelector: ".resource-preview__back"
    },
    expect: ["资源列表"],
    postActionWaitMs: 2500
  },
  {
    role: "student",
    name: "student-account-classroom",
    entry: "/account?menu=classroom",
    accountMenuText: "虚拟校园",
    expect: ["启明智教 · 2D 校园导览"]
  },
  {
    role: "student",
    name: "student-account-profile",
    entry: "/account?menu=profile",
    accountMenuText: "个人资料",
    expect: ["个人资料"]
  },
  {
    role: "student",
    name: "student-learning-profile",
    entry: "/account?menu=learning-profile",
    accountMenuText: "学生画像",
    readyExpect: ["学习画像", "画像地形"],
    action: {
      selector: ".radar-point",
      afterSelector: ".account-assistant-dialog"
    },
    expect: ["画像地形"],
    postActionWaitMs: 1200
  },
  {
    role: "student",
    name: "student-learning-path",
    entry: "/account?menu=learning-path",
    accountMenuText: "学习路径规划",
    expect: ["学习路径规划", "路径节点"]
  },
  {
    role: "student",
    name: "student-account-cloud-disk",
    entry: "/account?menu=cloud-disk",
    accountMenuText: "学习云盘",
    expect: ["学习云盘", "云盘"],
    requiredRequestPath: "/edu/backend/v1/user/file/list"
  },
  {
    role: "student",
    name: "student-account-notification",
    entry: "/account?menu=notification",
    accountMenuText: "系统通知",
    expect: ["通知"]
  },
  {
    role: "student",
    name: "student-account-todo",
    entry: "/account?menu=todo",
    accountMenuText: "待办事项",
    expect: ["待办"]
  },
  {
    role: "student",
    name: "student-account-virtual-lab",
    entry: "/account?menu=virtual-lab",
    accountMenuText: "虚拟实验室",
    expect: ["虚拟实验室"]
  },
  {
    role: "student",
    name: "student-account-competition",
    entry: "/account?menu=competition",
    accountMenuText: "赛事场",
    expect: ["赛事"]
  },
  {
    role: "student",
    name: "student-account-exam-center",
    entry: "/account?menu=exam-center",
    accountMenuText: "试卷中心",
    expect: ["试卷", "考试"]
  },
  {
    role: "student",
    name: "student-account-settings",
    entry: "/account-settings",
    expect: ["个人信息", "偏好设置"]
  },
  {
    role: "student",
    name: "student-course-classroom",
    entry: "/course/classroom",
    expect: ["欢迎来到启明智教"]
  },
  {
    role: "student",
    name: "student-wrong-exercise-page",
    entry: "/account/wrong-exercise",
    expect: ["暂无错题记录", "道错题"],
    requiredRequestPath: "/edu/frontend/v1/ai/wrong-exercise/history"
  },
  {
    role: "student",
    name: "student-exam-center-list",
    entry: "/student-exam-center/list",
    expect: ["试题试卷中心"],
    requiredRequestPath: "/edu/frontend/v1/paper/list"
  },
  {
    role: "student",
    name: "student-course-study",
    entry: "/course/1?section=course-learn",
    expect: ["AI 视频分析"],
    requiresCourse: true,
    courseState: {
      section: "course-learn",
      menu: "course-learn",
      contentKey: "study",
      contentText: "AI 视频分析"
    }
  },
  {
    role: "student",
    name: "student-course-mastery",
    entry: "/course/1?section=mastery",
    expect: ["基础知识点"],
    requiresCourse: true,
    courseState: {
      section: "mastery",
      menu: "mastery",
      contentKey: "mastery",
      contentText: "基础知识点"
    }
  },
  {
    role: "student",
    name: "student-course-qa",
    entry: "/course/1?section=course-qa",
    expect: ["课程问答"],
    requiresCourse: true,
    courseState: { section: "course-qa", menu: "course-qa", contentKey: "qa" }
  },
  {
    role: "student",
    name: "student-course-work",
    entry: "/course/1?section=homework-exam",
    expect: ["作业考试"],
    requiresCourse: true,
    courseState: {
      section: "homework-exam",
      menu: "homework-exam",
      contentKey: "work",
      activeTab: "作业"
    }
  },
  {
    role: "student",
    name: "student-course-materials",
    entry: "/course/1?section=course-materials",
    expect: ["课程资料"],
    requiresCourse: true,
    courseState: {
      section: "course-materials",
      menu: "course-materials",
      contentKey: "materials"
    }
  },
  {
    role: "student",
    name: "student-course-animations",
    entry: "/course/1?section=html-animations",
    expect: ["HTML动画"],
    requiresCourse: true,
    courseState: {
      section: "html-animations",
      menu: "html-animations",
      contentKey: "animations"
    }
  },
  {
    role: "student",
    name: "student-course-grades",
    entry: "/course/1?section=grades",
    expect: ["课时成绩"],
    requiresCourse: true,
    courseState: {
      section: "grades",
      menu: "grades",
      contentKey: "grades",
      contentText: "课时成绩"
    }
  },
  {
    role: "student",
    name: "student-course-wrong-exercise",
    entry: "/course/1?section=homework-exam",
    readyExpect: [],
    action: { selector: ".homework-tabs .el-tabs__item", text: "随练" },
    expect: ["多选模式", "暂无错题记录", "道错题"],
    requiresCourse: true,
    courseState: {
      section: "homework-exam",
      menu: "homework-exam",
      contentKey: "work"
    },
    afterActionState: {
      activeTab: "随练",
      contentKey: "work",
      contentText: "多选模式"
    },
    requiredRequestPath: "/edu/frontend/v1/ai/wrong-exercise/history",
    postActionWaitMs: 2000
  },
  {
    role: "student",
    name: "student-ai-app",
    entry: "/account/ai-app?mode=student",
    expect: ["学生模式", "学习助手"]
  },
  {
    role: "student",
    name: "student-ai-chat",
    entry: "/ai-app/chat",
    expect: ["学生模式", "互动答疑"]
  },
  {
    role: "student",
    name: "student-ai-generation",
    entry: "/ai-app/generation",
    expect: ["教学资源"]
  },
  {
    role: "student",
    name: "student-ai-path",
    entry: "/ai-app/path",
    expect: ["学习计划"]
  },
  {
    role: "student",
    name: "student-ai-profile",
    entry: "/ai-app/profile",
    expect: ["学情分析"]
  },
  {
    role: "student",
    name: "student-ai-assessment",
    entry: "/ai-app/assessment",
    expect: ["测验评估"]
  },
  {
    role: "student",
    name: "student-ai-workspace",
    entry: "/ai-app/workspace",
    expect: ["学生模式", "今天想学习什么"]
  },
  {
    role: "student",
    name: "student-ai-agentpdf",
    entry: "/ai-app/agentpdf",
    expect: ["资料研读"]
  },
  {
    role: "student",
    name: "student-ai-automation",
    entry: "/ai-app/automation",
    expect: ["常规任务"]
  },
  {
    role: "student",
    name: "student-forbidden-exam-paper-admin",
    entry: "/exam-paper/index",
    expectedForbidden: true
  },
  {
    role: "teacher",
    name: "teacher-dashboard",
    entry: "/welcome/index",
    expect: ["教师"]
  },
  {
    role: "teacher",
    name: "teacher-course-list",
    entry: "/course/list",
    minContentUtilization: 0.9,
    readyExpect: ["课程名称"],
    action: { selector: ".course-card .action-btn", text: "章节课时" },
    expect: ["课时列表"],
    postActionWaitMs: 1600
  },
  {
    role: "teacher",
    name: "teacher-course-category",
    entry: "/course/category",
    expect: ["课程分类"]
  },
  {
    role: "teacher",
    name: "teacher-course-assessment",
    entry: "/course/assessment",
    minContentUtilization: 0.9,
    readyExpect: ["请从左侧选择一个课程开始管理"],
    action: { selector: ".assessment-management .course-item" },
    expect: ["作业列表"],
    postActionWaitMs: 1200
  },
  {
    role: "teacher",
    name: "teacher-course-plan",
    entry: "/course/teacherplan",
    minContentUtilization: 0.9,
    readyExpect: ["开启智能教案设计"],
    action: { selector: ".teacher-plan-container .course-item" },
    expect: ["AI 智能生成工作台"],
    postActionWaitMs: 1200
  },
  {
    role: "teacher",
    name: "teacher-course-animation",
    entry: "/course/animation",
    expect: ["AI动画", "动画"]
  },
  {
    role: "teacher",
    name: "teacher-video-analysis",
    entry: "/course/video-analysis",
    expect: ["视频分析"]
  },
  {
    role: "teacher",
    name: "teacher-discussion-review",
    entry: "/course/discussion/review",
    expect: ["讨论", "筛选"]
  },
  {
    role: "teacher",
    name: "teacher-cloud-disk",
    entry: "/cloud-disk",
    expect: ["教学云盘", "云盘"],
    requiredRequestPath: "/edu/backend/v1/user/file/list"
  },
  { role: "teacher", name: "teacher-todo", entry: "/todo", expect: ["待办"] },
  {
    role: "teacher",
    name: "teacher-ai-chat",
    entry: "/ai-app/chat",
    expect: ["教师模式", "互动答疑"]
  },
  {
    role: "teacher",
    name: "teacher-ai-workspace",
    entry: "/ai-app/workspace",
    expect: ["教师模式", "互动答疑"]
  },
  {
    role: "teacher",
    name: "teacher-ai-generation",
    entry: "/ai-app/generation",
    expect: ["教学资源"]
  },
  {
    role: "teacher",
    name: "teacher-ai-agentpdf",
    entry: "/ai-app/agentpdf",
    expect: ["资料研读"]
  },
  {
    role: "teacher",
    name: "teacher-ai-path",
    entry: "/ai-app/path",
    expect: ["学习计划"]
  },
  {
    role: "teacher",
    name: "teacher-ai-profile",
    entry: "/ai-app/profile",
    expect: ["学情分析"]
  },
  {
    role: "teacher",
    name: "teacher-ai-assessment",
    entry: "/ai-app/assessment",
    expect: ["测验评估"]
  },
  {
    role: "teacher",
    name: "teacher-ai-governance",
    entry: "/ai-app/governance",
    readyExpect: ["治理看板"],
    action: {
      selector: ".a3-governance-tabs .el-tabs__item",
      text: "教学资源"
    },
    expect: ["查看教学资源"],
    postActionWaitMs: 1200
  },
  {
    role: "teacher",
    name: "teacher-ai-automation",
    entry: "/ai-app/automation",
    expect: ["常规任务"]
  },
  {
    role: "teacher",
    name: "teacher-discussion-moderation",
    entry: "/course/discussion/index",
    expect: ["内容审核", "筛选条件"]
  },
  {
    role: "teacher",
    name: "teacher-discussion-reports",
    entry: "/course/discussion/reports",
    expect: ["举报处理", "筛选条件"]
  },
  {
    role: "teacher",
    name: "teacher-exam-paper-overview",
    entry: "/exam-paper/index",
    expect: ["题目组卷器", "新建空白试卷"]
  },
  {
    role: "teacher",
    name: "teacher-exam-paper-my-papers",
    entry: "/exam-paper/my-papers",
    expect: ["我的试卷"]
  },
  {
    role: "teacher",
    name: "teacher-exam-paper-templates",
    entry: "/exam-paper/templates",
    expect: ["试卷模板"]
  },
  {
    role: "teacher",
    name: "teacher-exam-paper-grading",
    entry: "/exam-paper/grading",
    expect: ["阅卷管理", "待阅卷"]
  },
  {
    role: "teacher",
    name: "teacher-exam-paper-statistics",
    entry: "/exam-paper/statistics",
    expect: ["学情分析"]
  },
  {
    role: "teacher",
    name: "teacher-exam-paper-question-bank",
    entry: "/exam-paper/question-bank",
    expect: ["题库管理", "新建题目"]
  },
  {
    role: "teacher",
    name: "teacher-exam-paper-editor",
    entry: "/exam-paper/editor",
    expect: ["启明在线组卷", "请输入试卷标题"]
  },
  {
    role: "teacher",
    name: "teacher-competition-overview",
    entry: "/competition/overview",
    expect: ["赛事大屏概览"]
  },
  {
    role: "teacher",
    name: "teacher-competition-oj",
    entry: "/competition/oj",
    expect: ["在线 OJ 管理"]
  },
  {
    role: "teacher",
    name: "teacher-competition-question-bank",
    entry: "/competition/question-bank",
    expect: ["题库管理", "知识竞赛"]
  },
  {
    role: "teacher",
    name: "teacher-competition-essay",
    entry: "/competition/essay",
    expect: ["作文批改管理"]
  },
  {
    role: "teacher",
    name: "teacher-competition-events",
    entry: "/competition/event-manage",
    expect: ["综合赛事管理"]
  },
  {
    role: "teacher",
    name: "teacher-virtual-lab",
    entry: "/virtual-lab",
    expect: ["筛选与同步", "HTML 动画任务列表"]
  },
  {
    role: "teacher",
    name: "teacher-system-notification",
    entry: "/system-notification",
    expect: ["系统通知"]
  },
  {
    role: "teacher",
    name: "teacher-account-settings",
    entry: "/account-settings",
    expect: ["个人信息", "偏好设置"]
  },
  {
    role: "teacher",
    name: "teacher-account-ai-app",
    entry: "/account/ai-app?mode=teacher",
    expect: ["教师模式", "互动答疑"]
  },
  {
    role: "teacher",
    name: "teacher-forbidden-user-admin",
    entry: "/user/list",
    expectedForbidden: true
  },
  {
    role: "admin",
    name: "admin-dashboard",
    entry: "/welcome/index",
    expect: ["管理员"]
  },
  {
    role: "admin",
    name: "admin-user-list",
    entry: "/user/list",
    readyExpect: ["用户列表", "用户"],
    action: {
      selector: ".mobile-user-card__actions .el-button",
      text: "修改角色",
      afterSelector: ".el-dialog",
      afterText: "修改用户角色"
    },
    expect: ["用户列表"],
    postActionWaitMs: 1200
  },
  {
    role: "admin",
    name: "admin-course-list",
    entry: "/course/list",
    minContentUtilization: 0.9,
    readyExpect: ["课程名称"],
    action: { selector: ".course-card .action-btn", text: "章节课时" },
    expect: ["课时列表"],
    postActionWaitMs: 1600
  },
  {
    role: "admin",
    name: "admin-course-category",
    entry: "/course/category",
    expect: ["课程分类"]
  },
  {
    role: "admin",
    name: "admin-course-assessment",
    entry: "/course/assessment",
    minContentUtilization: 0.9,
    readyExpect: ["请从左侧选择一个课程开始管理"],
    action: { selector: ".assessment-management .course-item" },
    expect: ["作业列表"],
    postActionWaitMs: 1200
  },
  {
    role: "admin",
    name: "admin-discussion-review",
    entry: "/course/discussion/review",
    expect: ["讨论", "筛选"]
  },
  {
    role: "admin",
    name: "admin-discussion-moderation",
    entry: "/course/discussion/index",
    expect: ["内容审核", "筛选条件"]
  },
  {
    role: "admin",
    name: "admin-discussion-reports",
    entry: "/course/discussion/reports",
    expect: ["举报处理", "筛选条件"]
  },
  {
    role: "admin",
    name: "admin-sensitive-words",
    entry: "/course/discussion/sensitive-words",
    expect: ["敏感词管理", "筛选条件"]
  },
  {
    role: "admin",
    name: "admin-user-reputation",
    entry: "/course/discussion/user-reputation",
    expect: ["用户信誉管理", "筛选条件"]
  },
  {
    role: "admin",
    name: "admin-discussion-statistics",
    entry: "/course/discussion/statistics",
    expect: ["讨论统计", "待处理举报"]
  },
  {
    role: "admin",
    name: "admin-video-analysis",
    entry: "/course/video-analysis",
    expect: ["视频分析"]
  },
  {
    role: "admin",
    name: "admin-ai-chat",
    entry: "/ai-app/chat",
    expect: ["管理员模式", "互动答疑"]
  },
  {
    role: "admin",
    name: "admin-ai-workspace",
    entry: "/ai-app/workspace",
    expect: ["管理员模式", "互动答疑"]
  },
  {
    role: "admin",
    name: "admin-ai-generation",
    entry: "/ai-app/generation",
    expect: ["教学资源"]
  },
  {
    role: "admin",
    name: "admin-ai-governance",
    entry: "/ai-app/governance",
    readyExpect: ["治理看板"],
    action: {
      selector: ".a3-governance-tabs .el-tabs__item",
      text: "教学资源"
    },
    expect: ["查看教学资源"],
    postActionWaitMs: 1200
  },
  {
    role: "admin",
    name: "admin-exam-paper-overview",
    entry: "/exam-paper/index",
    expect: ["题目组卷器", "新建空白试卷"]
  },
  {
    role: "admin",
    name: "admin-exam-paper-my-papers",
    entry: "/exam-paper/my-papers",
    expect: ["我的试卷"]
  },
  {
    role: "admin",
    name: "admin-exam-paper-templates",
    entry: "/exam-paper/templates",
    expect: ["试卷模板"]
  },
  {
    role: "admin",
    name: "admin-exam-paper-grading",
    entry: "/exam-paper/grading",
    expect: ["阅卷管理", "待阅卷"]
  },
  {
    role: "admin",
    name: "admin-exam-paper-statistics",
    entry: "/exam-paper/statistics",
    expect: ["学情分析"]
  },
  {
    role: "admin",
    name: "admin-exam-paper-question-bank",
    entry: "/exam-paper/question-bank",
    expect: ["题库管理", "新建题目"]
  },
  {
    role: "admin",
    name: "admin-exam-paper-editor",
    entry: "/exam-paper/editor",
    expect: ["启明在线组卷", "请输入试卷标题"]
  },
  {
    role: "admin",
    name: "admin-competition-overview",
    entry: "/competition/overview",
    expect: ["赛事大屏概览"]
  },
  {
    role: "admin",
    name: "admin-competition-oj",
    entry: "/competition/oj",
    expect: ["在线 OJ 管理"]
  },
  {
    role: "admin",
    name: "admin-competition-question-bank",
    entry: "/competition/question-bank",
    expect: ["题库管理", "知识竞赛"]
  },
  {
    role: "admin",
    name: "admin-competition-essay",
    entry: "/competition/essay",
    expect: ["作文批改管理"]
  },
  {
    role: "admin",
    name: "admin-competition-events",
    entry: "/competition/event-manage",
    expect: ["综合赛事管理"]
  },
  {
    role: "admin",
    name: "admin-virtual-lab",
    entry: "/virtual-lab",
    expect: ["筛选与同步", "HTML 动画任务列表"]
  },
  {
    role: "admin",
    name: "admin-system-notification",
    entry: "/system-notification",
    expect: ["系统通知"]
  },
  {
    role: "admin",
    name: "admin-online-disk",
    entry: "/online-disk",
    expect: ["在线云盘", "上传文件"],
    requiredRequestPath: "/edu/backend/v1/user/file/list"
  },
  {
    role: "admin",
    name: "admin-account-settings",
    entry: "/account-settings",
    expect: ["个人信息", "偏好设置"]
  },
  {
    role: "admin",
    name: "admin-account-ai-app",
    entry: "/account/ai-app?mode=admin",
    expect: ["管理员模式", "互动答疑"]
  },
  {
    role: "admin",
    name: "admin-course-plan",
    entry: "/course/teacherplan",
    minContentUtilization: 0.9,
    readyExpect: ["开启智能教案设计"],
    action: { selector: ".teacher-plan-container .course-item" },
    expect: ["AI 智能生成工作台"],
    postActionWaitMs: 1200
  },
  {
    role: "admin",
    name: "admin-course-animation",
    entry: "/course/animation",
    expect: ["智能动画中心"]
  },
  {
    role: "admin",
    name: "admin-todo",
    entry: "/todo",
    expect: ["待办事项"]
  },
  {
    role: "admin",
    name: "admin-ai-agentpdf",
    entry: "/ai-app/agentpdf",
    expect: ["资料研读"]
  },
  {
    role: "admin",
    name: "admin-ai-path",
    entry: "/ai-app/path",
    expect: ["学习计划"]
  },
  {
    role: "admin",
    name: "admin-ai-profile",
    entry: "/ai-app/profile",
    expect: ["学情分析"]
  },
  {
    role: "admin",
    name: "admin-ai-assessment",
    entry: "/ai-app/assessment",
    expect: ["测验评估"]
  },
  {
    role: "admin",
    name: "admin-ai-automation",
    entry: "/ai-app/automation",
    expect: ["常规任务"]
  },
  {
    role: "admin",
    name: "admin-forbidden-teacher-cloud-disk",
    entry: "/cloud-disk",
    expectedForbidden: true
  }
];

function parseArgs(argv) {
  const options = {
    origin: process.env.QIMING_MINIPROGRAM_WEBVIEW_ORIGIN || defaultOrigin,
    apiOrigin: process.env.VITE_API_URL || defaultApiOrigin,
    outDir: "",
    route: "",
    role: "",
    waitMs: Number(process.env.QIMING_REAL_AUDIT_WAIT_MS || 9000),
    headed: false,
    browser: process.env.QIMING_MINIPROGRAM_BROWSER || "",
    help: false,
    list: false,
    listJson: false,
    selfTest: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--") {
      continue;
    } else if (arg === "--origin" && next) {
      options.origin = next;
      i += 1;
    } else if (arg === "--api-origin" && next) {
      options.apiOrigin = next;
      i += 1;
    } else if (arg === "--out-dir" && next) {
      options.outDir = next;
      i += 1;
    } else if ((arg === "--route" || arg === "--only") && next) {
      options.route = next;
      i += 1;
    } else if (arg === "--role" && next) {
      options.role = next;
      i += 1;
    } else if (arg === "--wait-ms" && next) {
      options.waitMs = Number(next);
      i += 1;
    } else if (arg === "--headed") {
      options.headed = true;
    } else if (arg === "--browser" && next) {
      options.browser = next;
      i += 1;
    } else if (arg === "--list") {
      options.list = true;
    } else if (arg === "--list-json") {
      options.listJson = true;
    } else if (arg === "--self-test") {
      options.selfTest = true;
    } else if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  options.origin = new URL(options.origin).origin;
  options.apiOrigin = new URL(options.apiOrigin).origin;
  if (!Number.isFinite(options.waitMs) || options.waitMs < 0) {
    throw new Error(`Unsupported wait time: ${options.waitMs}`);
  }
  if (options.role && !roleMeta[options.role]) {
    throw new Error(`Unsupported role: ${options.role}`);
  }
  return options;
}

function printUsage() {
  console.log(`Usage: node scripts/wechat-real-session-audit.mjs [options]

Options:
  --role <student|teacher|admin>  Audit only one real account role
  --route, --only <name>          Audit only one named route
  --origin <url>                  H5 origin to audit
  --api-origin <url>              API origin used for real login
  --wait-ms <ms>                  Per-route readiness timeout
  --browser <path>                Chrome, Edge, or Chromium executable
  --headed                        Show the browser window
  --out-dir <path>                Artifact output directory
  --list                          List route names and exit
  --list-json                     Print selected route definitions as JSON
  --self-test                     Validate matrix and response-code logic offline
  -h, --help                      Show this help and exit`);
}

function resolveBrowserPath(explicitPath = "") {
  const candidates = [
    explicitPath,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
  ].filter(Boolean);
  return candidates.find(Boolean);
}

function wait(ms) {
  return new Promise(resolveWait => setTimeout(resolveWait, ms));
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${url} returned non-JSON: ${text.slice(0, 180)}`);
  }
  if (!response.ok) {
    throw new Error(`${url} failed with HTTP ${response.status}: ${text}`);
  }
  return json;
}

async function loginRole(role, apiOrigin) {
  const account = accounts[role];
  const login = await fetchJson(`${apiOrigin}/edu/v1/user/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(account)
  });
  if (Number(login?.code) !== 200) {
    throw new Error(`Login API rejected ${role}: ${login?.msg || login?.code}`);
  }
  const token = login?.data?.accessToken;
  if (!token) throw new Error(`Login did not return token for ${role}`);
  const detail = await fetchJson(`${apiOrigin}/edu/v1/user/detail`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: "{}"
  });
  if (Number(detail?.code) !== 200) {
    throw new Error(
      `User detail API rejected ${role}: ${detail?.msg || detail?.code}`
    );
  }
  const userInfo = detail?.data?.userInfo || {};
  const meta = roleMeta[role];
  const actualRoleType = Number(userInfo.roleType);
  if (actualRoleType !== meta.roleType) {
    throw new Error(
      `Real ${role} account returned roleType=${actualRoleType}; expected ${meta.roleType}`
    );
  }
  const expiresValue = Number(login.data.accessExpire || 0);
  const expires =
    expiresValue > 100000000000 ? expiresValue : expiresValue * 1000;
  if (!Number.isFinite(expires) || expires <= Date.now()) {
    throw new Error(`Real ${role} account returned an expired access token`);
  }
  return {
    role,
    token,
    expires,
    userInfo: {
      accessToken: token,
      refreshToken: token,
      expires,
      avatar: userInfo.avatar || "/logo.svg",
      username: userInfo.mobile || account.mobile,
      nickname: userInfo.nickname || meta.label,
      roles: meta.roles,
      permissions: ["*:*:*"],
      roleType: actualRoleType,
      userId: Number(userInfo.id || 0)
    }
  };
}

async function resolveRoleFixtures(role, apiOrigin, session, requiresCourse) {
  const fixtures = {};
  if (role !== "student" || !requiresCourse) return fixtures;

  const courseList = await fetchJson(
    `${apiOrigin}/edu/frontend/v1/course/list?pageNum=1&pageSize=20`,
    {
      headers: {
        authorization: `Bearer ${session.token}`
      }
    }
  );
  if (Number(courseList?.code) !== 200 && courseList?.code !== undefined) {
    throw new Error(
      `Student course fixture API failed: ${courseList?.msg || courseList?.code}`
    );
  }
  const firstCourse = courseList?.data?.list?.find(item => item?.courseId);
  if (!firstCourse?.courseId) {
    throw new Error(
      "Real student account has no course fixture for deep-link audit"
    );
  }
  fixtures.courseId = Number(firstCourse.courseId);

  return fixtures;
}

async function getFreePort() {
  const { createServer } = await import("node:net");
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") resolvePort(address.port);
        else rejectPort(new Error("Unable to allocate debug port"));
      });
    });
    server.on("error", rejectPort);
  });
}

async function waitForBrowser(port, timeoutMs = 20000) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await fetchJson(`http://127.0.0.1:${port}/json/version`);
    } catch (error) {
      lastError = error;
      await wait(200);
    }
  }
  throw new Error(
    `Browser did not expose DevTools port ${port}: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
  }

  async connect() {
    this.socket = new WebSocket(this.wsUrl);
    await new Promise((resolveConnect, rejectConnect) => {
      this.socket.addEventListener("open", resolveConnect, { once: true });
      this.socket.addEventListener(
        "error",
        () => rejectConnect(new Error(`Unable to connect CDP: ${this.wsUrl}`)),
        { once: true }
      );
    });
    this.socket.addEventListener("message", event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error)
          pending.reject(
            new Error(message.error.message || "CDP command failed.")
          );
        else pending.resolve(message.result);
        return;
      }
      for (const listener of this.listeners) listener(message);
    });
  }

  onMessage(listener) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) this.listeners.splice(index, 1);
    };
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolveCommand, rejectCommand) => {
      this.pending.set(id, { resolve: resolveCommand, reject: rejectCommand });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async close() {
    const socket = this.socket;
    this.socket = undefined;
    this.listeners = [];
    for (const request of this.pending.values()) {
      request.reject(new Error("CDP client closed"));
    }
    this.pending.clear();
    if (!socket || socket.readyState === WebSocket.CLOSED) return;

    await new Promise(resolveClose => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolveClose();
      };
      const timer = setTimeout(finish, 750);
      socket.addEventListener("close", finish, { once: true });
      socket.addEventListener("error", finish, { once: true });
      socket.close();
    });
  }
}

function appendMiniQuery(entry, extra = {}) {
  const [path, rawQuery = ""] = entry.split("?");
  const params = new URLSearchParams(rawQuery);
  params.set("qimingMiniProgram", "1");
  params.set("qimingNative", "1");
  Object.entries(extra).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}`;
}

function applyRouteFixtures(entry, fixtures = {}) {
  if (fixtures.courseId) {
    return entry.replace(
      /^\/course\/1(?=([?#]|$))/,
      `/course/${fixtures.courseId}`
    );
  }
  return entry;
}

function buildUrl(origin, route, fixtures = {}) {
  const routePath = appendMiniQuery(applyRouteFixtures(route.entry, fixtures), {
    _qimingRealAudit: `${Date.now()}-${route.name}`
  });
  return `${origin}/#${routePath}`;
}

function routePathFromAuditUrl(url) {
  const hash = new URL(url).hash.replace(/^#/, "");
  const path = hash.split("?")[0] || "/";
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

async function resetSession(client, origin) {
  await client.send("Page.navigate", { url: "about:blank" });
  await wait(100);
  await client.send("Network.clearBrowserCookies");
  await client.send("Storage.clearDataForOrigin", {
    origin,
    storageTypes: "cookies,local_storage,indexeddb"
  });
}

async function seedSession(client, origin, session) {
  await client.send("Page.navigate", { url: `${origin}/?seed=${Date.now()}` });
  await wait(500);
  await client.send("Runtime.evaluate", {
    awaitPromise: true,
    expression: `(() => {
      const userInfo = ${JSON.stringify(session.userInfo)};
      localStorage.clear();
      sessionStorage.clear();
      const cookieInfo = {
        accessToken: userInfo.accessToken,
        expires: userInfo.expires,
        refreshToken: userInfo.refreshToken
      };
      document.cookie = 'authorized-token=' + encodeURIComponent(JSON.stringify(cookieInfo)) + '; path=/; expires=' + new Date(userInfo.expires).toUTCString();
      document.cookie = 'multiple-tabs=true; path=/; max-age=${7 * 86400}';
      localStorage.setItem('user-info', JSON.stringify(userInfo));
      localStorage.setItem('userId', String(userInfo.userId || ''));
      localStorage.setItem('userMobile', userInfo.username || '');
      localStorage.setItem('userRoleType', String(userInfo.roleType || ''));
      localStorage.setItem('qimingNativeWebView', '1');
      localStorage.setItem('qimingMiniProgramWebView', '1');
      localStorage.setItem('qimingRealAuditRole', ${JSON.stringify(session.role)});
      sessionStorage.setItem('qimingNativeWebView', '1');
      sessionStorage.setItem('qimingMiniProgramWebView', '1');
    })()`
  });
}

const isVisibleElementSource = `function isVisibleElement(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  return rect.width > 1 && rect.height > 1 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0.01;
}`;

const inspectExpression = `(() => {
  ${isVisibleElementSource}
  let storedUserInfo = {};
  try {
    storedUserInfo = JSON.parse(localStorage.getItem('user-info') || '{}');
  } catch {}
  const rectInfo = el => {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      visible: isVisibleElement(el)
    };
  };
  const boxInfo = el => {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(style.paddingRight) || 0;
    const contentInnerWidth = Math.max(
      0,
      rect.width - paddingLeft - paddingRight
    );
    const roundRatio = value => Math.round(value * 1000) / 1000;
    return {
      ...rectInfo(el),
      className: String(el.className || '').slice(0, 240),
      paddingLeft: Math.round(paddingLeft),
      paddingRight: Math.round(paddingRight),
      innerWidth: Math.round(contentInnerWidth),
      leftGap: Math.max(0, Math.round(rect.left)),
      rightGap: Math.max(0, Math.round(viewportWidth - rect.right)),
      widthRatio: viewportWidth ? roundRatio(rect.width / viewportWidth) : 0,
      innerWidthRatio: viewportWidth
        ? roundRatio(contentInnerWidth / viewportWidth)
        : 0
    };
  };
  const text = (document.body?.innerText || '').replace(/\\s+/g, ' ').trim();
  const loadingEls = Array.from(document.querySelectorAll('.el-loading-mask, .pure-loading, [class*=loading], [class*=Loading]')).filter(isVisibleElement);
  const brokenImages = Array.from(document.images)
    .filter(img => isVisibleElement(img) && img.complete && img.naturalWidth === 0)
    .slice(0, 20)
    .map(img => img.currentSrc || img.src || img.getAttribute('src') || '');
  const visibleImages = Array.from(document.images).filter(img => isVisibleElement(img));
  const app = document.querySelector('#app');
  const mainCandidates = [
    '.app-main',
    '.main-content',
    '.account-main',
    '.ai-app-root',
    '.course-detail-page',
    '.course-detail-container',
    '.el-main',
    '#app'
  ];
  const main = mainCandidates.map(selector => document.querySelector(selector)).find(isVisibleElement);
  const navbar = document.querySelector('.navbar, .header');
  const accountMain = document.querySelector('.account-main');
  const activeAccountMenu = Array.from(document.querySelectorAll('.account-menu .el-menu-item.is-active')).find(isVisibleElement);
  const textWithoutSvg = element => {
    if (!element) return '';
    const clone = element.cloneNode(true);
    clone.querySelectorAll('svg, style, script').forEach(node => node.remove());
    return String(clone.textContent || '').replace(/\\s+/g, ' ').trim();
  };
  const routeContent = Array.from(document.querySelectorAll('.qiming-route-content')).find(isVisibleElement);
  const routeChildren = Array.from(routeContent?.children || [])
    .filter(isVisibleElement)
    .sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      return rightRect.width - leftRect.width || rightRect.height - leftRect.height;
    });
  const primaryRouteChild = routeChildren[0] || null;
  const activeDialog = Array.from(document.querySelectorAll('.el-dialog')).filter(isVisibleElement).at(-1) || null;
  const activeDialogBody = activeDialog?.querySelector('.el-dialog__body') || null;
  const measuredContent = activeDialogBody || primaryRouteChild || routeContent;
  const measuredContentBox = boxInfo(measuredContent);
  const contentUtilization = measuredContentBox
    ? activeDialogBody
      ? measuredContentBox.innerWidthRatio
      : measuredContentBox.widthRatio
    : 0;
  const aiRoot = document.querySelector('.ai-app-root');
  const aiLeftRail = document.querySelector('.ai-app-left-rail');
  const sidebarLogo = document.querySelector('.sidebar-logo-container');
  const sidebarWordmark = document.querySelector('.sidebar-logo-container .sidebar-title');
  const scrollHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  const viewportHeight = document.documentElement.clientHeight;
  const viewportWidth = document.documentElement.clientWidth;
  const maxScrollWidth = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth);
  const courseContentSelectors = [
    ['study', '.course-study-root'],
    ['mastery', '.mastery-page-content'],
    ['qa', '.message-board-wrapper'],
    ['work', '.homework-exam-wrapper'],
    ['materials', '.course-materials-wrapper .material-item, .course-materials-wrapper .empty-wrapper'],
    ['animations', '.course-materials-wrapper .animation-card, .course-materials-wrapper .materials-list.empty-state'],
    ['grades', '.course-grades-wrapper']
  ];
  const visibleCourseContents = courseContentSelectors.flatMap(([key, selector]) =>
    Array.from(document.querySelectorAll(selector))
      .filter(isVisibleElement)
      .map(el => ({
        key,
        selector,
        text: String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 1200)
      }))
  );
  const activeCourseMenu = document.querySelector('#layout-sidebar [data-menu].active');
  const activeCourseTab = Array.from(document.querySelectorAll('.homework-tabs .el-tabs__item.is-active')).find(isVisibleElement);
  const hashQuery = location.hash.includes('?') ? location.hash.slice(location.hash.indexOf('?') + 1) : '';
  return {
    href: location.href,
    htmlClass: String(document.documentElement.className || ''),
    routePath: (() => {
      const hash = location.hash.replace(/^#/, '');
      const path = hash.split('?')[0] || location.pathname;
      try { return decodeURIComponent(path); } catch { return path; }
    })(),
    title: document.title,
    textLength: text.length,
    textSample: text.slice(0, 700),
    appChildren: app?.children?.length || 0,
    blank: Boolean(app) && text.length < 20,
    loadingCount: loadingEls.length,
    brokenImages,
    visibleImageCount: visibleImages.length,
    overflowX: Math.max(0, Math.round(maxScrollWidth - viewportWidth)),
    scrollHeight,
    viewportHeight,
    bottomGap: Math.max(0, Math.round(viewportHeight - (main?.getBoundingClientRect().bottom || 0))),
    session: {
      username: String(storedUserInfo.username || ''),
      roleType: Number(storedUserInfo.roleType || 0),
      roles: Array.isArray(storedUserInfo.roles) ? storedUserInfo.roles : [],
      auditRole: localStorage.getItem('qimingRealAuditRole') || ''
    },
    account: {
      activeMenuText: textWithoutSvg(activeAccountMenu),
      mainText: String(accountMain?.innerText || accountMain?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 4000)
    },
    course: {
      section: new URLSearchParams(hashQuery).get('section') || '',
      activeMenu: activeCourseMenu?.getAttribute('data-menu') || '',
      activeTab: String(activeCourseTab?.textContent || '').replace(/\s+/g, ' ').trim(),
      visibleContents: visibleCourseContents
    },
    layout: {
      navbar: rectInfo(navbar),
      main: rectInfo(main),
      accountMain: rectInfo(accountMain),
      routeContent: boxInfo(routeContent),
      primaryRouteChild: boxInfo(primaryRouteChild),
      activeDialog: boxInfo(activeDialog),
      activeDialogBody: boxInfo(activeDialogBody),
      contentUtilization,
      aiRoot: rectInfo(aiRoot),
      aiLeftRail: rectInfo(aiLeftRail),
      sidebarLogo: rectInfo(sidebarLogo),
      sidebarWordmark: rectInfo(sidebarWordmark),
      sidebarText: sidebarWordmark?.textContent?.trim() || ''
    }
  };
})()`;

function allowedHttpFailure(issue, route) {
  let pathname = "";
  try {
    pathname = new URL(issue.url).pathname;
  } catch {
    return null;
  }
  return (
    allowedHttpFailures.find(
      item =>
        item.status === issue.status &&
        item.pathname === pathname &&
        item.routes.has(route.name) &&
        (!item.matches || item.matches(issue))
    ) || null
  );
}

function courseStateFailures(info, state, prefix = "course") {
  if (!state) return [];
  const failures = [];
  const course = info.course || {};
  if (state.section && course.section !== state.section) {
    failures.push(
      `${prefix}-section-mismatch:${course.section || "none"}!=${state.section}`
    );
  }
  if (state.menu && course.activeMenu !== state.menu) {
    failures.push(
      `${prefix}-menu-mismatch:${course.activeMenu || "none"}!=${state.menu}`
    );
  }
  if (state.activeTab && course.activeTab !== state.activeTab) {
    failures.push(
      `${prefix}-tab-mismatch:${course.activeTab || "none"}!=${state.activeTab}`
    );
  }
  if (state.contentKey) {
    const contentVisible = (course.visibleContents || []).some(
      item =>
        item.key === state.contentKey &&
        (!state.contentText ||
          String(item.text || "").includes(state.contentText))
    );
    if (!contentVisible) {
      failures.push(
        `${prefix}-content-not-visible:${state.contentKey}:${state.contentText || "any"}`
      );
    }
  }
  return failures;
}

function analyze(
  info,
  route,
  consoleErrors,
  networkIssues,
  actionResult,
  requestedUrls,
  requiredResponse
) {
  const failures = [];
  const warnings = [];
  if (info.blank || info.textLength < 20) failures.push("blank-page");
  if (info.loadingCount > 0)
    failures.push(`loading-visible:${info.loadingCount}`);
  if (info.overflowX > 2) failures.push(`overflow-x:${info.overflowX}`);
  if (route.minContentUtilization) {
    const contentUtilization = Number(info.layout?.contentUtilization || 0);
    if (contentUtilization < route.minContentUtilization) {
      failures.push(
        `content-too-narrow:${contentUtilization.toFixed(3)}<${route.minContentUtilization.toFixed(3)}`
      );
    }
  }
  if (info.brokenImages?.length)
    failures.push(`broken-images:${info.brokenImages.length}`);
  const forbiddenPage =
    info.routePath === "/error/403" ||
    info.textSample.includes("抱歉，你无权访问该页面");
  const expectedPath =
    route.expectedPath || new URL(route.entry, "https://qiming.local").pathname;
  if (!route.expectedForbidden && info.routePath !== expectedPath) {
    failures.push(
      `route-mismatch:${info.routePath || "none"}!=${expectedPath}`
    );
  }
  const expectedAccountMenuText =
    actionResult?.ok && route.afterActionAccountMenuText
      ? route.afterActionAccountMenuText
      : route.accountMenuText;
  const textScope = expectedAccountMenuText
    ? String(info.account?.mainText || "")
    : info.textSample;
  if (
    !route.expectedForbidden &&
    route.expect?.length &&
    !route.expect.some(item => textScope.includes(item))
  ) {
    failures.push(`missing-expected:${route.expect.join("|")}`);
  }
  if (
    !route.expectedForbidden &&
    expectedAccountMenuText &&
    info.account?.activeMenuText !== expectedAccountMenuText
  ) {
    failures.push(
      `account-menu-mismatch:${info.account?.activeMenuText || "none"}!=${expectedAccountMenuText}`
    );
  }
  failures.push(...courseStateFailures(info, route.courseState));
  if (route.afterActionState && actionResult?.ok) {
    failures.push(
      ...courseStateFailures(info, route.afterActionState, "after-action")
    );
  }
  if (route.expectedForbidden && !forbiddenPage) {
    failures.push(`expected-forbidden-but-reached:${info.routePath || "none"}`);
  } else if (!route.expectedForbidden && forbiddenPage) {
    failures.push("forbidden-route-redirect");
  }
  if (info.routePath === "/login") failures.push("session-lost-to-login");
  const expectedRole = roleMeta[route.role];
  const sessionRoles = Array.isArray(info.session?.roles)
    ? info.session.roles
    : [];
  if (
    info.session?.auditRole !== route.role ||
    info.session?.roleType !== expectedRole.roleType ||
    sessionRoles.length !== 1 ||
    sessionRoles[0] !== route.role ||
    info.session?.username !== accounts[route.role].mobile
  ) {
    failures.push(
      `role-session-mismatch:${info.session?.auditRole || "none"}/${info.session?.roleType || 0}/${sessionRoles.join("+") || "none"}`
    );
  }
  if (actionResult && !actionResult.ok)
    failures.push(`route-action-failed:${actionResult.reason}`);
  if (route.requiredRequestPath) {
    const requiredRequestObserved = requestedUrls.some(url => {
      try {
        return new URL(url).pathname === route.requiredRequestPath;
      } catch {
        return false;
      }
    });
    if (!requiredRequestObserved) {
      failures.push(`required-request-missing:${route.requiredRequestPath}`);
    } else if (!requiredResponse) {
      failures.push(`required-response-missing:${route.requiredRequestPath}`);
    } else if (requiredResponse.status >= 400) {
      failures.push(
        `required-response-http:${requiredResponse.status}:${route.requiredRequestPath}`
      );
    } else if (requiredResponse.bodyError) {
      failures.push(
        `required-response-body-unavailable:${route.requiredRequestPath}`
      );
    } else if (requiredResponse.businessCodePresent !== true) {
      failures.push(
        `required-response-code-missing:${route.requiredRequestPath}`
      );
    } else if (requiredResponse.businessCodeValid !== true) {
      failures.push(
        `required-response-code-invalid:${route.requiredRequestPath}`
      );
    } else if (![0, 200].includes(requiredResponse.businessCode)) {
      failures.push(
        `required-response-code:${requiredResponse.businessCode}:${route.requiredRequestPath}`
      );
    }
  }
  const seriousConsole = consoleErrors.filter(
    item =>
      /uncaught|TypeError|ReferenceError|Cannot access|Unhandled error/i.test(
        item
      ) && !/Access to XMLHttpRequest|Failed to load resource/i.test(item)
  );
  if (seriousConsole.length)
    failures.push(`console-errors:${seriousConsole.length}`);
  const httpNetwork = networkIssues.filter(item => item.status >= 400);
  const allowedNetwork = httpNetwork.filter(item =>
    allowedHttpFailure(item, route)
  );
  const unexpectedNetwork = httpNetwork.filter(
    item => !allowedHttpFailure(item, route)
  );
  const browserAbortNetwork = networkIssues.filter(item => item.errorText);
  if (unexpectedNetwork.length) {
    const sample = unexpectedNetwork
      .slice(0, 3)
      .map(item => {
        try {
          return `${item.status}:${new URL(item.url).pathname}`;
        } catch {
          return `${item.status}:${item.url}`;
        }
      })
      .join("|");
    failures.push(`http-errors:${unexpectedNetwork.length}:${sample}`);
  }
  if (allowedNetwork.length) {
    const reasons = [
      ...new Set(
        allowedNetwork
          .map(item => allowedHttpFailure(item, route)?.reason)
          .filter(Boolean)
      )
    ];
    warnings.push(`allowed-http:${allowedNetwork.length}:${reasons.join("|")}`);
  }
  if (browserAbortNetwork.length) {
    warnings.push(`browser-network:${browserAbortNetwork.length}`);
  }
  if (
    route.name.includes("ai-") &&
    info.layout?.aiLeftRail?.visible &&
    info.layout.aiLeftRail.width > 120
  ) {
    failures.push(`ai-left-rail-too-wide:${info.layout.aiLeftRail.width}`);
  }
  return { failures, warnings };
}

async function inspectPage(client) {
  const evaluated = await client.send("Runtime.evaluate", {
    returnByValue: true,
    awaitPromise: true,
    expression: inspectExpression
  });
  return evaluated.result?.value || {};
}

async function waitForExpectedPage(
  client,
  expected,
  waitMs,
  route,
  includeAfterAction = false
) {
  const startedAt = Date.now();
  let info = {};
  do {
    await wait(500);
    info = await inspectPage(client);
    const expectedReady =
      !expected?.length ||
      expected.some(item => String(info.textSample || "").includes(item));
    const courseReady =
      courseStateFailures(info, route?.courseState).length === 0;
    const afterActionReady =
      !includeAfterAction ||
      courseStateFailures(info, route?.afterActionState).length === 0;
    if (
      !info.blank &&
      info.textLength > 80 &&
      info.loadingCount === 0 &&
      expectedReady &&
      courseReady &&
      afterActionReady
    )
      break;
  } while (Date.now() - startedAt < waitMs);
  return info;
}

async function performRouteAction(client, action) {
  if (!action) return null;
  const actionStartedAt = Date.now();
  const actionWaitMs = Number(action.waitMs || 6000);
  let actionResult = { ok: false, reason: "target-not-found" };
  do {
    const evaluated = await client.send("Runtime.evaluate", {
      returnByValue: true,
      awaitPromise: true,
      expression: `(() => {
        ${isVisibleElementSource}
        const selector = ${JSON.stringify(action.selector)};
        const expectedText = ${JSON.stringify(action.text || "")};
        const target = Array.from(document.querySelectorAll(selector)).find(el =>
          isVisibleElement(el) && String(el.textContent || '').replace(/\\s+/g, ' ').trim().includes(expectedText)
        );
        if (!target) return { ok: false, reason: 'target-not-found', selector, expectedText };
        target.click();
        return { ok: true, selector, expectedText, clickedText: String(target.textContent || '').replace(/\\s+/g, ' ').trim() };
      })()`
    });
    actionResult = evaluated.result?.value || {
      ok: false,
      reason: "no-action-result"
    };
    if (actionResult.ok || actionResult.reason !== "target-not-found") break;
    await wait(200);
  } while (Date.now() - actionStartedAt < actionWaitMs);

  if (!actionResult.ok || !action.afterSelector) return actionResult;

  const startedAt = Date.now();
  let lastAfterResult = { visible: false, text: "" };
  do {
    await wait(200);
    const afterEvaluation = await client.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => {
        ${isVisibleElementSource}
        const selector = ${JSON.stringify(action.afterSelector)};
        const element = Array.from(document.querySelectorAll(selector)).find(isVisibleElement);
        return {
          visible: Boolean(element),
          text: String(element?.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 1000)
        };
      })()`
    });
    lastAfterResult = afterEvaluation.result?.value || lastAfterResult;
    const afterTextFound =
      !action.afterText || lastAfterResult.text.includes(action.afterText);
    if (lastAfterResult.visible && afterTextFound) {
      return {
        ...actionResult,
        afterSelector: action.afterSelector,
        afterSelectorVisible: true,
        afterSelectorText: lastAfterResult.text,
        afterText: action.afterText || null,
        afterTextFound
      };
    }
  } while (Date.now() - startedAt < 4000);

  return {
    ...actionResult,
    ok: false,
    reason: lastAfterResult.visible
      ? "after-text-not-found"
      : "after-selector-not-visible",
    afterSelector: action.afterSelector,
    afterSelectorVisible: lastAfterResult.visible,
    afterSelectorText: lastAfterResult.text,
    afterText: action.afterText || null,
    afterTextFound: false
  };
}

async function captureBottom(client) {
  await client.send("Runtime.evaluate", {
    awaitPromise: true,
    expression: `(() => {
      const candidates = ['.main-container .el-scrollbar__wrap', '.app-main', '.account-container', document.scrollingElement ? '__doc__' : ''];
      for (const selector of candidates) {
        const el = selector === '__doc__' ? document.scrollingElement : selector ? document.querySelector(selector) : null;
        if (!el) continue;
        if (el.scrollHeight > el.clientHeight + 8) {
          el.scrollTop = el.scrollHeight;
          return selector;
        }
      }
      window.scrollTo(0, Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
      return 'window';
    })()`
  });
  await wait(350);
}

function runSelfTest() {
  const failures = [];
  const envelopeCases = [
    ["numeric-success", '{"code":200}', true, true, 200],
    ["string-success", '{"code":"0"}', true, true, 0],
    ["business-failure", '{"code":500}', true, true, 500],
    ["missing-code", '{"data":[]}', false, false, undefined],
    ["null-code", '{"code":null}', true, false, null],
    ["non-json", "not-json", false, false, undefined]
  ];
  for (const [name, body, present, valid, code] of envelopeCases) {
    const result = inspectBusinessEnvelope(body);
    if (
      result.businessCodePresent !== present ||
      result.businessCodeValid !== valid ||
      result.businessCode !== code
    ) {
      failures.push(`${name}:${JSON.stringify(result)}`);
    }
  }

  const names = routes.map(route => route.name);
  if (new Set(names).size !== names.length)
    failures.push("duplicate route names");
  for (const role of ["student", "teacher", "admin"]) {
    if (!routes.some(route => route.role === role)) {
      failures.push(`missing ${role} routes`);
    }
  }
  for (const route of routes.filter(item => item.requiresCourse)) {
    if (
      route.role !== "student" ||
      !/^\/course\/1(?=([?#]|$))/.test(route.entry)
    ) {
      failures.push(`invalid course fixture route: ${route.name}`);
    }
  }
  for (const route of routes.filter(item => item.accountMenuText)) {
    if (!route.entry.startsWith("/account?menu=")) {
      failures.push(`invalid account menu route: ${route.name}`);
    }
  }
  const interactionRoutes = routes.filter(route => route.action);
  if (interactionRoutes.length !== 13) {
    failures.push(
      `expected 13 interaction routes, got ${interactionRoutes.length}`
    );
  }
  for (const route of interactionRoutes) {
    if (!route.action.selector || !Array.isArray(route.readyExpect)) {
      failures.push(`invalid interaction contract: ${route.name}`);
    }
    if (
      route.action.afterSelector !== undefined &&
      !String(route.action.afterSelector).trim()
    ) {
      failures.push(`invalid post-action selector: ${route.name}`);
    }
    if (
      route.action.afterText !== undefined &&
      (!route.action.afterSelector || !String(route.action.afterText).trim())
    ) {
      failures.push(`invalid post-action text: ${route.name}`);
    }
    if (
      route.action.waitMs !== undefined &&
      (!Number.isFinite(Number(route.action.waitMs)) ||
        Number(route.action.waitMs) < 0 ||
        Number(route.action.waitMs) > 30_000)
    ) {
      failures.push(`invalid action wait: ${route.name}`);
    }
  }
  const contentUtilizationRoutes = routes.filter(
    route => route.minContentUtilization !== undefined
  );
  if (contentUtilizationRoutes.length !== 6) {
    failures.push(
      `expected 6 content-utilization routes, got ${contentUtilizationRoutes.length}`
    );
  }
  for (const route of contentUtilizationRoutes) {
    if (
      !Number.isFinite(route.minContentUtilization) ||
      route.minContentUtilization < 0.8 ||
      route.minContentUtilization > 1
    ) {
      failures.push(`invalid content-utilization contract: ${route.name}`);
    }
  }
  for (const name of [
    "student-account-cloud-disk",
    "teacher-cloud-disk",
    "admin-online-disk"
  ]) {
    const route = routes.find(item => item.name === name);
    if (route?.requiredRequestPath !== "/edu/backend/v1/user/file/list") {
      failures.push(`cloud API evidence missing: ${name}`);
    }
  }

  const courseRoute = routes.find(route => route.requiresCourse);
  if (!courseRoute) {
    failures.push("missing course fixture routes");
  } else {
    const resolvedUrl = buildUrl("https://audit.example", courseRoute, {
      courseId: 37
    });
    if (routePathFromAuditUrl(resolvedUrl) !== "/course/37") {
      failures.push(`resolved course path mismatch: ${resolvedUrl}`);
    }
  }

  if (failures.length) {
    throw new Error(`Self-test failed: ${failures.join("; ")}`);
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        routes: routes.length,
        roles: Object.fromEntries(
          ["student", "teacher", "admin"].map(role => [
            role,
            routes.filter(route => route.role === role).length
          ])
        ),
        courseFixtures: routes.filter(route => route.requiresCourse).length,
        requiredResponses: routes.filter(route => route.requiredRequestPath)
          .length,
        interactionRoutes: interactionRoutes.length,
        contentUtilizationRoutes: contentUtilizationRoutes.length,
        envelopeCases: envelopeCases.length
      },
      null,
      2
    )}\n`
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const selectedRoutes = routes.filter(route => {
    if (options.route && route.name !== options.route) return false;
    if (options.role && route.role !== options.role) return false;
    return true;
  });
  if (options.help) {
    printUsage();
    return;
  }
  if (options.list) {
    selectedRoutes.forEach(route =>
      console.log(`${route.role.padEnd(7, " ")} ${route.name} ${route.entry}`)
    );
    return;
  }
  if (options.listJson) {
    console.log(JSON.stringify(selectedRoutes, null, 2));
    return;
  }
  if (options.selfTest) {
    runSelfTest();
    return;
  }
  if (!selectedRoutes.length) {
    throw new Error("No matching routes for audit.");
  }
  const browserPath = resolveBrowserPath(options.browser);
  if (!browserPath) throw new Error("Chrome/Edge not found.");
  const outDir =
    options.outDir ||
    join(
      artifactsDir,
      `real-session-audit-${new Date().toISOString().replace(/[:.]/g, "-")}`
    );
  mkdirSync(outDir, { recursive: true });

  const sessions = {};
  const fixtures = {};
  for (const role of [...new Set(selectedRoutes.map(route => route.role))]) {
    sessions[role] = await loginRole(role, options.apiOrigin);
    fixtures[role] = await resolveRoleFixtures(
      role,
      options.apiOrigin,
      sessions[role],
      selectedRoutes.some(route => route.role === role && route.requiresCourse)
    );
  }

  const debugPort = await getFreePort();
  const profileDir = mkdtempSync(join(tmpdir(), "qiming-real-audit-"));
  const browserArgs = [
    "--remote-debugging-address=127.0.0.1",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-renderer-backgrounding",
    "--window-size=390,844"
  ];
  if (!options.headed) browserArgs.push("--headless=new");
  const browserProcess = spawn(browserPath, browserArgs, {
    stdio: ["ignore", "ignore", "pipe"]
  });
  let browserError = "";
  browserProcess.stderr.on("data", chunk => {
    browserError += chunk.toString();
  });

  const results = [];
  let client;
  try {
    await waitForBrowser(debugPort);
    const tab = await fetchJson(`http://127.0.0.1:${debugPort}/json/new`, {
      method: "PUT"
    });
    client = new CdpClient(tab.webSocketDebuggerUrl);
    await client.connect();
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Network.enable");
    await client.send("Log.enable");
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true
    });
    await client.send("Emulation.setUserAgentOverride", {
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; QimingTest) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36",
      acceptLanguage: "zh-CN,zh;q=0.9",
      platform: "Android",
      mobile: true
    });

    for (const route of selectedRoutes) {
      await resetSession(client, options.origin);
      await seedSession(client, options.origin, sessions[route.role]);
      await client.send("Network.disable");
      await client.send("Network.enable");

      const consoleErrors = [];
      const networkIssues = [];
      const requestUrls = new Map();
      const responseRecords = [];
      const responseIssues = new Map();
      const onMessage = message => {
        if (message.method === "Runtime.consoleAPICalled") {
          const text = (message.params.args || [])
            .map(arg => arg.value || arg.description || "")
            .join(" ");
          if (
            message.params.type === "error" ||
            /error|failed|timeout|uncaught/i.test(text)
          ) {
            consoleErrors.push(text.slice(0, 300));
          }
        }
        if (message.method === "Runtime.exceptionThrown") {
          const details = message.params.exceptionDetails || {};
          const description =
            details.exception?.description ||
            details.exception?.value ||
            details.text ||
            "Runtime exception";
          const stack = details.stackTrace?.callFrames
            ?.slice(0, 5)
            .map(
              frame =>
                `${frame.url}:${frame.lineNumber + 1}:${frame.columnNumber + 1}`
            )
            .join(" <- ");
          consoleErrors.push(
            `${String(description).slice(0, 500)}${stack ? `\n${stack}` : ""}`
          );
        }
        if (message.method === "Log.entryAdded") {
          const entry = message.params.entry;
          if (entry.level === "error")
            consoleErrors.push(String(entry.text || "").slice(0, 300));
        }
        if (message.method === "Network.responseReceived") {
          const response = message.params.response;
          try {
            responseRecords.push({
              requestId: message.params.requestId,
              path: new URL(response.url).pathname,
              status: Number(response.status || 0),
              mimeType: String(response.mimeType || "")
            });
          } catch {}
          if (response.status >= 400) {
            const issue = {
              status: response.status,
              url: response.url.slice(0, 220)
            };
            networkIssues.push(issue);
            if (response.status === 404) {
              try {
                if (
                  new URL(response.url).pathname ===
                  "/edu/v1/html-animation/display"
                ) {
                  responseIssues.set(message.params.requestId, issue);
                }
              } catch {}
            }
          }
        }
        if (message.method === "Network.requestWillBeSent") {
          requestUrls.set(message.params.requestId, message.params.request.url);
        }
        if (message.method === "Network.loadingFailed") {
          networkIssues.push({
            status: 0,
            errorText: message.params.errorText,
            url:
              requestUrls.get(message.params.requestId) ||
              message.params.requestId
          });
        }
      };
      const unsubscribe = client.onMessage(onMessage);

      const url = buildUrl(options.origin, route, fixtures[route.role]);
      await client.send("Page.navigate", { url });

      let info = await waitForExpectedPage(
        client,
        route.readyExpect || route.expect,
        options.waitMs,
        route
      );
      const actionResult = await performRouteAction(client, route.action);
      if (actionResult?.ok) {
        info = await waitForExpectedPage(
          client,
          route.expect,
          options.waitMs,
          route,
          true
        );
      }
      await wait(route.postActionWaitMs || 600);
      const firstShot = await client.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true
      });
      const screenshotPath = join(outDir, `${route.name}.png`);
      writeFileSync(screenshotPath, Buffer.from(firstShot.data, "base64"));

      await captureBottom(client);
      const bottomEval = await client.send("Runtime.evaluate", {
        returnByValue: true,
        awaitPromise: true,
        expression: inspectExpression
      });
      const bottomInfo = bottomEval.result?.value || {};
      const bottomShot = await client.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true
      });
      const bottomScreenshotPath = join(outDir, `${route.name}-bottom.png`);
      writeFileSync(
        bottomScreenshotPath,
        Buffer.from(bottomShot.data, "base64")
      );

      await Promise.allSettled(
        [...responseIssues].map(async ([requestId, issue]) => {
          const result = await client.send("Network.getResponseBody", {
            requestId
          });
          const responseBody = result.base64Encoded
            ? Buffer.from(result.body, "base64").toString("utf8")
            : result.body;
          issue.responseBody = String(responseBody || "").slice(0, 1000);
          try {
            issue.responseJson = JSON.parse(responseBody);
          } catch {}
        })
      );

      let requiredResponse = null;
      if (route.requiredRequestPath) {
        const responseRecord = [...responseRecords]
          .reverse()
          .find(item => item.path === route.requiredRequestPath);
        if (responseRecord) {
          const { requestId, ...safeResponse } = responseRecord;
          requiredResponse = safeResponse;
          try {
            const bodyResult = await client.send("Network.getResponseBody", {
              requestId
            });
            const responseBody = bodyResult.base64Encoded
              ? Buffer.from(bodyResult.body || "", "base64").toString("utf8")
              : String(bodyResult.body || "");
            Object.assign(
              requiredResponse,
              inspectBusinessEnvelope(responseBody)
            );
          } catch (error) {
            requiredResponse.bodyError =
              error instanceof Error ? error.message : String(error);
          }
        }
      }

      const { failures, warnings } = analyze(
        info,
        { ...route, expectedPath: routePathFromAuditUrl(url) },
        consoleErrors,
        networkIssues,
        actionResult,
        [...requestUrls.values()],
        requiredResponse
      );
      const result = {
        label: route.name,
        ...route,
        url,
        ok: failures.length === 0,
        failures,
        warnings,
        screenshotPath,
        bottomScreenshotPath,
        info,
        bottomInfo,
        actionResult,
        requiredResponse,
        consoleErrors: consoleErrors.slice(0, 20),
        networkIssues: networkIssues.slice(0, 30)
      };
      results.push(result);
      console.log(
        `[${result.ok ? "OK" : "FAIL"}] ${route.name.padEnd(32, " ")} text=${String(info.textLength || 0).padStart(4)} broken=${info.brokenImages?.length || 0} overflowX=${info.overflowX ?? "?"} content=${info.layout?.contentUtilization ?? "?"} ${failures.join(",") || screenshotPath}${warnings.length ? ` warnings=${warnings.join(",")}` : ""}`
      );
      unsubscribe();
    }
  } finally {
    await client?.close();
    const browserExit =
      browserProcess.exitCode === null
        ? new Promise(resolveExit => browserProcess.once("exit", resolveExit))
        : Promise.resolve();
    if (browserProcess.exitCode === null) browserProcess.kill();
    await Promise.race([browserExit, wait(1000)]);
    browserProcess.stderr.destroy();
    rmSync(profileDir, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 150
    });
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    origin: options.origin,
    apiOrigin: options.apiOrigin,
    totals: {
      routes: results.length,
      ok: results.filter(item => item.ok).length,
      fail: results.filter(item => !item.ok).length
    },
    results
  };
  const summaryPath = join(outDir, "summary.json");
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`Summary written: ${summaryPath}`);
  if (summary.totals.fail > 0) process.exitCode = 1;
  if (browserError && process.env.QIMING_REAL_AUDIT_DEBUG_BROWSER === "1") {
    console.error(browserError.trim());
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
