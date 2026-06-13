#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isMac = process.platform === "darwin";
const isWindows = process.platform === "win32";
const defaultMacChrome =
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge";
const defaultWindowsChrome =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const screenshotTimestamp = new Date().toISOString().replace(/[:.]/g, "-");

const routeSuites = {
  teacher: [
    { label: "教师工作台", path: "/welcome/index", expect: ["教师"] },
    { label: "教师课程", path: "/course/list", expect: ["课程"] },
    {
      label: "课程分类",
      path: "/course/category",
      expect: ["课程分类"],
      selectors: [".mobile-category-list"]
    },
    { label: "教案管理", path: "/course/teacherplan", expect: ["教案"] },
    { label: "作业与考试", path: "/course/assessment", expect: ["作业"] },
    {
      label: "AI 动画",
      path: "/course/animation",
      expect: ["智能动画中心"],
      selectors: [".ai-animation-container.is-mobile-layout"]
    },
    {
      label: "视频分析",
      path: "/course/video-analysis",
      expect: ["视频分析中心"],
      selectors: [".video-analysis-container.is-mobile-layout"]
    },
    {
      label: "讨论列表",
      path: "/course/discussion/review",
      expect: ["讨论列表"],
      selectors: [".discussion-manage--mobile", ".mobile-discussion-list"]
    },
    {
      label: "试卷总览",
      path: "/exam-paper/index",
      expect: ["试卷", "阅卷管理"]
    },
    {
      label: "我的试卷",
      path: "/exam-paper/my-papers",
      expect: ["我的试卷"],
      selectors: [".paper-mobile-list"]
    },
    {
      label: "试卷模板",
      path: "/exam-paper/templates",
      expect: ["试卷模板"]
    },
    {
      label: "阅卷管理",
      path: "/exam-paper/grading",
      expect: ["阅卷管理"],
      selectors: [".grading-mobile-list"]
    },
    {
      label: "学情分析",
      path: "/exam-paper/statistics",
      expect: ["学情分析"]
    },
    {
      label: "题库管理",
      path: "/exam-paper/question-bank",
      expect: ["题库管理"],
      selectors: [".question-mobile-list"]
    },
    {
      label: "教师 AI App",
      path: "/ai-app/workspace",
      expect: ["AI"],
      layout: "ai"
    },
    {
      label: "教师账号",
      path: "/account-settings",
      expect: ["个人信息"],
      layout: "standalone"
    }
  ],
  student: [
    {
      label: "学生首页",
      path: "/account?menu=home",
      expect: ["首页"],
      layout: "account"
    },
    {
      label: "学生课程",
      path: "/account?menu=course",
      expect: ["课程"],
      layout: "account"
    },
    {
      label: "学生虚拟校园",
      path: "/account?menu=classroom",
      expect: ["2D 校园导览"],
      layout: "account"
    },
    {
      label: "学生 AI App",
      path: "/account/ai-app?mode=student",
      expect: ["AI"],
      layout: "account-ai"
    },
    {
      label: "学生云盘",
      path: "/account?menu=cloud-disk",
      expect: ["学习云盘"],
      layout: "account"
    },
    {
      label: "学生通知",
      path: "/account?menu=notification",
      expect: ["系统通知"],
      layout: "account"
    },
    {
      label: "学生待办",
      path: "/account?menu=todo",
      expect: ["待办事项"],
      layout: "account"
    },
    {
      label: "学生虚拟实验室",
      path: "/account?menu=virtual-lab",
      expect: ["虚拟实验室"],
      layout: "account"
    },
    {
      label: "学生赛事场",
      path: "/account?menu=competition",
      expect: ["赛事场"],
      layout: "account"
    },
    {
      label: "学生试卷中心",
      path: "/account?menu=exam-center",
      expect: ["试题试卷中心"],
      layout: "account"
    },
    {
      label: "学生我的",
      path: "/account?menu=profile",
      expect: ["个人中心"],
      layout: "account"
    }
  ],
  admin: [
    { label: "管理工作台", path: "/welcome/index", expect: ["管理员"] },
    { label: "用户管理", path: "/user/list", expect: ["用户"] },
    { label: "管理课程", path: "/course/list", expect: ["课程"] },
    {
      label: "管理课程分类",
      path: "/course/category",
      expect: ["课程分类"],
      selectors: [".mobile-category-list"]
    },
    {
      label: "管理讨论",
      path: "/course/discussion/review",
      expect: ["讨论列表"],
      selectors: [".discussion-manage--mobile", ".mobile-discussion-list"]
    },
    {
      label: "管理试卷总览",
      path: "/exam-paper/index",
      expect: ["试卷", "阅卷管理"]
    },
    {
      label: "管理题库",
      path: "/exam-paper/question-bank",
      expect: ["题库管理"],
      selectors: [".question-mobile-list"]
    },
    {
      label: "管理 AI App",
      path: "/ai-app/workspace",
      expect: ["AI"],
      layout: "ai"
    },
    { label: "管理考核", path: "/course/assessment", expect: ["考核"] }
  ],
  deep: [
    {
      label: "学生试卷列表",
      path: "/student-exam-center/list",
      demoRole: "student",
      expect: ["试题试卷中心", "可答题"],
      selectors: [".mobile-tab-strip"],
      layout: "standard"
    },
    {
      label: "学生试卷详情",
      path: "/student-exam-center/detail/1",
      demoRole: "student",
      expect: ["试卷详情", "开始答题"],
      layout: "standard"
    },
    {
      label: "学生答题页",
      path: "/student-exam-center/do/1",
      demoRole: "student",
      expect: ["答题卡", "交卷"],
      layout: "standalone"
    },
    {
      label: "学生考试结果",
      path: "/exam-paper/result/1",
      demoRole: "student",
      expect: ["考试结果", "答题明细"],
      layout: "standalone"
    },
    {
      label: "教师阅卷详情",
      path: "/exam-paper/grading/1",
      demoRole: "teacher",
      expect: ["学生列表", "提交评分"],
      layout: "standard"
    },
    {
      label: "教师新建试卷",
      path: "/exam-paper/editor",
      demoRole: "teacher",
      expect: ["启明在线组卷", "题目"],
      layout: "standalone"
    },
    {
      label: "教师编辑试卷",
      path: "/exam-paper/editor/1",
      demoRole: "teacher",
      expect: ["启明在线组卷", "题目"],
      layout: "standalone"
    }
  ]
};

const interactionSuites = [
  {
    role: "student",
    label: "学生底部导航",
    startPath: "/account?menu=home",
    steps: [
      {
        label: "切到课程",
        clickText: "课程",
        scope: ".nav-mobile-container",
        expectedPath: "/account",
        expectedQuery: { menu: "course" },
        expect: ["我的课程"],
        activeNav: "课程"
      },
      {
        label: "切到 AI App",
        clickText: "AI App",
        scope: ".nav-mobile-container",
        expectedPath: "/account/ai-app",
        expectedQuery: { mode: "student" },
        expect: ["AI"],
        selector: ".ai-app-root",
        layout: "account-ai"
      },
      {
        label: "切到我的",
        clickText: "我的",
        scope: ".nav-mobile-container",
        expectedPath: "/account",
        expectedQuery: { menu: "profile" },
        expect: ["个人中心"],
        selector: ".account-container.is-native-mobile",
        activeNav: "我的"
      }
    ]
  },
  {
    role: "student",
    label: "学生账号页横向菜单",
    startPath: "/account?menu=home",
    steps: [
      {
        label: "打开学习云盘",
        clickText: "学习云盘",
        scope: ".account-menu",
        expectedPath: "/account",
        expectedQuery: { menu: "cloud-disk" },
        expect: ["学习云盘"],
        activeAccountMenu: "学习云盘"
      },
      {
        label: "打开系统通知",
        clickText: "系统通知",
        scope: ".account-menu",
        expectedPath: "/account",
        expectedQuery: { menu: "notification" },
        expect: ["系统通知"],
        activeAccountMenu: "系统通知"
      },
      {
        label: "打开试卷中心",
        clickText: "试卷中心",
        scope: ".account-menu",
        expectedPath: "/account",
        expectedQuery: { menu: "exam-center" },
        expect: ["试题试卷中心"],
        activeAccountMenu: "试卷中心"
      }
    ]
  },
  {
    role: "teacher",
    label: "教师底部导航",
    startPath: "/welcome/index",
    steps: [
      {
        label: "切到课程",
        clickText: "课程",
        scope: ".nav-mobile-container",
        expectedPath: "/course/list",
        expect: ["课程"],
        activeNav: "课程"
      },
      {
        label: "切到教案",
        clickText: "教案",
        scope: ".nav-mobile-container",
        expectedPath: "/course/teacherplan",
        expect: ["教案"],
        activeNav: "教案"
      },
      {
        label: "切到考核",
        clickText: "考核",
        scope: ".nav-mobile-container",
        expectedPath: "/course/assessment",
        expect: ["作业"],
        activeNav: "考核"
      },
      {
        label: "切回首页",
        clickText: "首页",
        scope: ".nav-mobile-container",
        expectedPath: "/welcome/index",
        expect: ["教师"],
        activeNav: "首页"
      }
    ]
  },
  {
    role: "admin",
    label: "管理员底部导航",
    startPath: "/welcome/index",
    steps: [
      {
        label: "切到用户",
        clickText: "用户",
        scope: ".nav-mobile-container",
        expectedPath: "/user/list",
        expect: ["用户"],
        activeNav: "用户"
      },
      {
        label: "切到课程",
        clickText: "课程",
        scope: ".nav-mobile-container",
        expectedPath: "/course/list",
        expect: ["课程"],
        activeNav: "课程"
      },
      {
        label: "切到 AI App",
        clickText: "AI App",
        scope: ".nav-mobile-container",
        expectedPath: "/ai-app/workspace",
        expect: ["AI"],
        selector: ".ai-app-root.is-native-mobile-workspace",
        activeNav: "AI App"
      },
      {
        label: "切到考核",
        clickText: "考核",
        scope: ".nav-mobile-container",
        expectedPath: "/course/assessment",
        expect: ["考核"],
        activeNav: "考核"
      }
    ]
  }
];

function parseArgs(argv) {
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const raw = arg.slice(2);
    const equal = raw.indexOf("=");
    if (equal !== -1) {
      flags[raw.slice(0, equal)] = raw.slice(equal + 1);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      flags[raw] = next;
      index += 1;
    } else {
      flags[raw] = true;
    }
  }
  return flags;
}

function option(flags, name, fallback = "") {
  const value = flags[name];
  if (value === undefined || value === true) return fallback;
  return String(value);
}

function boolOption(flags, name) {
  return flags[name] === true || flags[name] === "true" || flags[name] === "1";
}

function sleep(ms) {
  return new Promise(resolveSleep => setTimeout(resolveSleep, ms));
}

function slug(value) {
  return String(value || "")
    .trim()
    .replace(/[^\p{Letter}\p{Number}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "screen";
}

async function captureScreenshot(port, sessionId, screenshotDir, name) {
  if (!screenshotDir) return "";
  mkdirSync(screenshotDir, { recursive: true });
  const result = await cdp(
    port,
    "Page.captureScreenshot",
    {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false
    },
    sessionId
  );
  const path = join(screenshotDir, `${name}.png`);
  writeFileSync(path, result.data, "base64");
  return path;
}

async function removeDirQuietly(pathValue) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      rmSync(pathValue, { recursive: true, force: true });
      return;
    } catch {
      await sleep(250);
    }
  }
}

async function isPortListening(port) {
  return new Promise(resolveResult => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolveResult(true);
    });
    socket.once("error", () => resolveResult(false));
  });
}

async function waitForPort(port, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isPortListening(port)) return true;
    await sleep(500);
  }
  return false;
}

function startPreviewServer(commandArgs, cwd, label) {
  const child = spawn("pnpm", commandArgs, {
    cwd,
    env: process.env,
    shell: isWindows,
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout?.on("data", chunk => {
    process.stdout.write(`[${label}] ${chunk}`);
  });
  child.stderr?.on("data", chunk => {
    process.stderr.write(`[${label}] ${chunk}`);
  });
  return child;
}

function findChrome(flags) {
  const explicit =
    option(flags, "chrome", "") ||
    process.env.QIMING_CHROME ||
    process.env.CHROME_PATH;
  if (explicit) return explicit;
  if (isMac) {
    const candidates = [
      "/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    ];
    return candidates.find(path => existsSync(path)) || defaultMacChrome;
  }
  return (
    isWindows ? defaultWindowsChrome : "google-chrome"
  );
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status}`);
  }
  return response.json();
}

async function cdp(port, method, params = {}, sessionId) {
  const payload = {
    id: ++cdp.nextId,
    method,
    params
  };
  if (sessionId) payload.sessionId = sessionId;
  cdp.ws.send(JSON.stringify(payload));
  return new Promise((resolveMessage, rejectMessage) => {
    cdp.pending.set(payload.id, { resolve: resolveMessage, reject: rejectMessage });
  });
}
cdp.nextId = 0;
cdp.pending = new Map();
cdp.events = [];
cdp.ws = null;

async function connectCdp(port) {
  const version = await getJson(`http://127.0.0.1:${port}/json/version`);
  cdp.ws = new WebSocket(version.webSocketDebuggerUrl);
  cdp.ws.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.id && cdp.pending.has(message.id)) {
      const pending = cdp.pending.get(message.id);
      cdp.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
      return;
    }
    cdp.events.push(message);
  });
  await new Promise((resolveOpen, rejectOpen) => {
    cdp.ws.addEventListener("open", resolveOpen, { once: true });
    cdp.ws.addEventListener("error", rejectOpen, { once: true });
  });
}

async function createPageSession(port) {
  const target = await cdp(port, "Target.createTarget", { url: "about:blank" });
  const attached = await cdp(port, "Target.attachToTarget", {
    targetId: target.targetId,
    flatten: true
  });
  const sessionId = attached.sessionId;
  await cdp(port, "Runtime.enable", {}, sessionId);
  await cdp(port, "Page.enable", {}, sessionId);
  await cdp(port, "Log.enable", {}, sessionId);
  await cdp(port, "Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true,
    screenWidth: 390,
    screenHeight: 844
  }, sessionId);
  await cdp(port, "Emulation.setUserAgentOverride", {
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
  }, sessionId);
  return sessionId;
}

function getSessionEvents(sessionId, sinceIndex) {
  return cdp.events
    .slice(sinceIndex)
    .filter(event => event.sessionId === sessionId);
}

async function waitForLoad(sessionId, sinceIndex, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const events = getSessionEvents(sessionId, sinceIndex);
    if (
      events.some(
        event =>
          event.method === "Page.loadEventFired" ||
          event.method === "Page.lifecycleEvent"
      )
    ) {
      return;
    }
    await sleep(100);
  }
}

async function evaluate(sessionId, expression, timeoutMs) {
  const result = await cdp(
    0,
    "Runtime.evaluate",
    {
      expression,
      awaitPromise: true,
      returnByValue: true,
      timeout: timeoutMs
    },
    sessionId
  );
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
  }
  return result.result?.value;
}

async function waitForRenderedRoute(sessionId, expectedPath, timeoutMs) {
  const startedAt = Date.now();
  let lastState = null;
  while (Date.now() - startedAt < timeoutMs) {
    lastState = await evaluate(
      sessionId,
      `(() => {
        const bodyText = document.body?.innerText || "";
        const app = document.querySelector("#app");
        return {
          hash: location.hash,
          bodyTextLength: bodyText.length,
          appHtmlLength: app?.innerHTML.length || 0,
          loadingDots: bodyText.includes("···") || bodyText.includes("加载中")
        };
      })()`,
      5000
    );
    if (
      lastState.hash.includes(expectedPath) &&
      lastState.appHtmlLength > 1000 &&
      lastState.bodyTextLength > 20 &&
      !lastState.loadingDots
    ) {
      return lastState;
    }
    await sleep(300);
  }
  return lastState;
}

function buildRouteUrl(baseUrl, route, cacheKey) {
  const [pathname, rawQuery = ""] = route.path.split("?");
  const query = new URLSearchParams(rawQuery);
  query.set("demoRole", route.role);
  query.set("qimingNative", "1");
  query.set("v", cacheKey);
  const url = new URL(baseUrl);
  url.searchParams.set("nativeSmoke", cacheKey);
  return `${url.toString()}#${pathname}?${query.toString()}`;
}

function collectRoutes(flags) {
  const roles = option(flags, "roles", "student,teacher,admin")
    .split(",")
    .map(role => role.trim())
    .filter(Boolean);
  return roles.flatMap(role =>
    (routeSuites[role] || []).map(route => ({
      ...route,
      suite: role,
      role: route.demoRole || role
    }))
  );
}

function collectInteractionSuites(flags) {
  const roles = option(flags, "roles", "student,teacher,admin")
    .split(",")
    .map(role => role.trim())
    .filter(Boolean);
  return interactionSuites.filter(suite => roles.includes(suite.role));
}

function visibleErrorMessages(events) {
  return events
    .filter(event => {
      if (event.method === "Runtime.exceptionThrown") return true;
      if (event.method === "Log.entryAdded") {
        return event.params?.entry?.level === "error";
      }
      if (event.method === "Runtime.consoleAPICalled") {
        return event.params?.type === "error";
      }
      return false;
    })
    .map(event => {
      if (event.method === "Runtime.exceptionThrown") {
        return event.params?.exceptionDetails?.exception?.description ||
          event.params?.exceptionDetails?.text ||
          "Runtime exception";
      }
      if (event.method === "Log.entryAdded") {
        return event.params?.entry?.text || "Log error";
      }
      return (event.params?.args || [])
        .map(arg => arg.value || arg.description || "")
        .join(" ")
        .trim() || "Console error";
    })
    .filter(Boolean);
}

function isIgnorableSmokeError(message) {
  return (
    /Failed to load resource: (?:net::ERR_CONNECTION_CLOSED|the server responded with a status of (?:400|404))/i.test(
      message
    ) ||
    /WebGL 初始化失败|webgl2: unavailable|experimental-webgl: unavailable/i.test(
      message
    ) ||
    /Blocked attempt to show a 'beforeunload' confirmation panel/i.test(
      message
    )
  );
}

async function validateRoute(
  port,
  sessionId,
  route,
  baseUrl,
  timeoutMs,
  screenshotDir,
  routeIndex
) {
  const eventStart = cdp.events.length;
  const url = buildRouteUrl(baseUrl, route, `smoke-${Date.now()}`);
  const expectedSelectors = JSON.stringify(route.selectors || []);
  console.log(`Checking [${route.role}] ${route.label}: ${route.path}`);
  await cdp(port, "Page.navigate", { url }, sessionId);
  await waitForLoad(sessionId, eventStart, 1500);
  await waitForRenderedRoute(sessionId, route.path.split("?")[0], timeoutMs);
  await sleep(500);

  const state = await evaluate(
    sessionId,
    `(() => {
      const bodyText = document.body?.innerText || "";
      const app = document.querySelector("#app");
      const appWrapper = document.querySelector(".app-wrapper");
      const account = document.querySelector(".account-container");
      const aiRoot = document.querySelector(".ai-app-root");
      const mobileNav = document.querySelector(".nav-mobile-container");
      const activeNav = document.querySelector(".nav-mobile-item.active .nav-title");
      const appRect = app?.getBoundingClientRect();
      const navRect = mobileNav?.getBoundingClientRect();
      const bodyWidth = Math.max(
        document.documentElement.scrollWidth,
        document.body?.scrollWidth || 0
      );
      return {
        href: location.href,
        title: document.title,
        bodyTextLength: bodyText.length,
        bodyText,
        bodyTextSample: bodyText.slice(0, 500),
        appHtmlLength: app?.innerHTML.length || 0,
        appRect: appRect ? {
          width: Math.round(appRect.width),
          height: Math.round(appRect.height)
        } : null,
        hasMobileClass: appWrapper?.classList.contains("mobile") || false,
        hasAccountNativeMobile: account?.classList.contains("is-native-mobile") || false,
        hasAiNativeMobile: aiRoot?.classList.contains("is-native-mobile-workspace") || false,
        hasMobileNav: Boolean(mobileNav),
        selectors: Object.fromEntries(
          ${expectedSelectors}
            .map(selector => [selector, Boolean(document.querySelector(selector))])
        ),
        mobileNavRect: navRect ? {
          y: Math.round(navRect.y),
          width: Math.round(navRect.width),
          height: Math.round(navRect.height)
        } : null,
        activeNav: activeNav?.textContent?.trim() || "",
        nativeClass: document.documentElement.classList.contains("qiming-native-webview"),
        overflowX: bodyWidth > window.innerWidth + 1,
        loadingDots: bodyText.includes("···") || bodyText.includes("加载中")
      };
    })()`,
    timeoutMs
  );
  const allErrors = visibleErrorMessages(getSessionEvents(sessionId, eventStart));
  const errors = allErrors.filter(message => !isIgnorableSmokeError(message));
  const warnings = allErrors.filter(message => isIgnorableSmokeError(message));
  const failures = [];
  if (!state.nativeClass) failures.push("missing qiming-native-webview class");
  const layout = route.layout || "standard";
  if (layout === "standard") {
    if (!state.hasMobileClass) failures.push("layout did not enter mobile mode");
    if (!state.hasMobileNav) failures.push("mobile nav missing");
  } else if (layout === "account") {
    if (!state.hasAccountNativeMobile) {
      failures.push("account page did not enter native mobile mode");
    }
  } else if (layout === "ai") {
    if (!state.hasAiNativeMobile) {
      failures.push("AI app did not enter native mobile mode");
    }
    if (!state.hasMobileNav) failures.push("mobile nav missing");
  }
  if (state.overflowX) failures.push("horizontal overflow detected");
  if (state.loadingDots) failures.push("still showing loading state");
  if (state.appHtmlLength < 1000) failures.push("app content is too small");
  if (state.bodyTextLength < 20) failures.push("visible text is too short");
  for (const expected of route.expect || []) {
    if (!state.bodyText.includes(expected) && !state.title.includes(expected)) {
      failures.push(`expected text missing: ${expected}`);
    }
  }
  for (const selector of route.selectors || []) {
    if (!state.selectors?.[selector]) {
      failures.push(`expected selector missing: ${selector}`);
    }
  }
  if (errors.length > 0) failures.push(`${errors.length} console/page error(s)`);

  let screenshot = "";
  try {
    screenshot = await captureScreenshot(
      port,
      sessionId,
      screenshotDir,
      `${String(routeIndex).padStart(2, "0")}-${slug(route.suite || route.role)}-${slug(route.label)}`
    );
  } catch (error) {
    failures.push(
      `screenshot capture failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  return {
    label: route.label,
    role: route.role,
    suite: route.suite || route.role,
    path: route.path,
    status: failures.length ? "FAIL" : "OK",
    failures,
    errors,
    warnings,
    screenshot,
    state
  };
}

async function clickElementByText(sessionId, scope, text, timeoutMs) {
  const expression = `(() => {
    const normalize = value => String(value || "").replace(/\\s+/g, " ").trim();
    const root = ${JSON.stringify(scope)}
      ? document.querySelector(${JSON.stringify(scope)})
      : document;
    if (!root) return { ok: false, reason: "scope not found" };
    const candidates = Array.from(root.querySelectorAll(
      "button,a,[role='button'],.nav-mobile-item,.el-menu-item,.quick-access-card"
    ));
    const element = candidates.find(item => normalize(item.innerText).includes(${JSON.stringify(text)}));
    if (!element) {
      return {
        ok: false,
        reason: "element not found",
        available: candidates.map(item => normalize(item.innerText)).filter(Boolean).slice(0, 20)
      };
    }
    element.scrollIntoView({ block: "center", inline: "center" });
    const rect = element.getBoundingClientRect();
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);
    element.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: "touch",
      clientX: x,
      clientY: y
    }));
    element.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: "touch",
      clientX: x,
      clientY: y
    }));
    element.click();
    return {
      ok: true,
      text: normalize(element.innerText),
      rect: {
        x,
        y,
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    };
  })()`;
  const clicked = await evaluate(sessionId, expression, timeoutMs);
  if (!clicked?.ok) {
    throw new Error(
      `Unable to click ${text}: ${clicked?.reason || "unknown"} ${JSON.stringify(clicked?.available || [])}`
    );
  }
  return clicked;
}

function queryMatches(actualQuery, expectedQuery = {}) {
  return Object.entries(expectedQuery).every(
    ([key, value]) => String(actualQuery?.[key] || "") === String(value)
  );
}

async function waitForInteractionState(sessionId, step, timeoutMs) {
  const startedAt = Date.now();
  let lastState = null;
  const expectedQuery = JSON.stringify(step.expectedQuery || {});
  while (Date.now() - startedAt < timeoutMs) {
    lastState = await evaluate(
      sessionId,
      `(() => {
        const bodyText = document.body?.innerText || "";
        const query = Object.fromEntries(new URLSearchParams(location.hash.split("?")[1] || location.search.slice(1)));
        const activeNav = document.querySelector(".nav-mobile-item.active .nav-title")?.textContent?.trim() || "";
        const activeAccountMenu = document.querySelector(".account-menu .el-menu-item.is-active span")?.textContent?.trim() || "";
        const bodyWidth = Math.max(
          document.documentElement.scrollWidth,
          document.body?.scrollWidth || 0
        );
        const selector = ${JSON.stringify(step.selector || "")};
        return {
          hash: location.hash,
          path: location.hash.replace(/^#/, "").split("?")[0],
          query,
          title: document.title,
          bodyText,
          appHtmlLength: document.querySelector("#app")?.innerHTML.length || 0,
          activeNav,
          activeAccountMenu,
          selectorFound: selector ? Boolean(document.querySelector(selector)) : true,
          nativeClass: document.documentElement.classList.contains("qiming-native-webview"),
          overflowX: bodyWidth > window.innerWidth + 1,
          loadingDots: bodyText.includes("···") || bodyText.includes("加载中")
        };
      })()`,
      5000
    );
    const pathOk =
      !step.expectedPath ||
      lastState.path === step.expectedPath ||
      lastState.path.startsWith(`${step.expectedPath}/`);
    const queryOk = queryMatches(lastState.query, JSON.parse(expectedQuery));
    const textOk = (step.expect || []).every(
      expected => lastState.bodyText.includes(expected) || lastState.title.includes(expected)
    );
    const navOk = !step.activeNav || lastState.activeNav === step.activeNav;
    const accountMenuOk =
      !step.activeAccountMenu ||
      lastState.activeAccountMenu === step.activeAccountMenu;
    if (
      pathOk &&
      queryOk &&
      textOk &&
      navOk &&
      accountMenuOk &&
      lastState.selectorFound &&
      lastState.nativeClass &&
      !lastState.overflowX &&
      !lastState.loadingDots &&
      lastState.appHtmlLength > 1000
    ) {
      return lastState;
    }
    await sleep(250);
  }
  return lastState;
}

async function validateInteractionSuite(
  port,
  sessionId,
  suite,
  baseUrl,
  timeoutMs,
  screenshotDir,
  suiteIndex
) {
  const eventStart = cdp.events.length;
  const results = [];
  const startRoute = {
    role: suite.role,
    label: suite.label,
    path: suite.startPath,
    expect: [],
    layout: suite.role === "student" ? "account" : "standard"
  };
  const startUrl = buildRouteUrl(baseUrl, startRoute, `interaction-${Date.now()}`);
  console.log(`Interaction [${suite.role}] ${suite.label}: ${suite.startPath}`);
  await cdp(port, "Page.navigate", { url: startUrl }, sessionId);
  await waitForLoad(sessionId, eventStart, 1500);
  await waitForRenderedRoute(sessionId, suite.startPath.split("?")[0], timeoutMs);
  await sleep(500);

  for (const [stepIndex, step] of suite.steps.entries()) {
    const stepStart = cdp.events.length;
    const failures = [];
    let clicked = null;
    let state = null;
    let screenshot = "";
    console.log(`  Clicking ${step.label}: ${step.clickText}`);
    try {
      clicked = await clickElementByText(
        sessionId,
        step.scope || "",
        step.clickText,
        timeoutMs
      );
      state = await waitForInteractionState(sessionId, step, timeoutMs);
      if (!state?.nativeClass) failures.push("missing qiming-native-webview class");
      if (state?.overflowX) failures.push("horizontal overflow detected");
      if (state?.loadingDots) failures.push("still showing loading state");
      if ((state?.appHtmlLength || 0) < 1000) failures.push("app content is too small");
      if (
        step.expectedPath &&
        state?.path !== step.expectedPath &&
        !state?.path?.startsWith(`${step.expectedPath}/`)
      ) {
        failures.push(`expected path ${step.expectedPath}, got ${state?.path || ""}`);
      }
      if (!queryMatches(state?.query, step.expectedQuery || {})) {
        failures.push(
          `expected query ${JSON.stringify(step.expectedQuery || {})}, got ${JSON.stringify(state?.query || {})}`
        );
      }
      for (const expected of step.expect || []) {
        if (!state?.bodyText?.includes(expected) && !state?.title?.includes(expected)) {
          failures.push(`expected text missing: ${expected}`);
        }
      }
      if (step.selector && !state?.selectorFound) {
        failures.push(`expected selector missing: ${step.selector}`);
      }
      if (step.activeNav && state?.activeNav !== step.activeNav) {
        failures.push(`expected active nav ${step.activeNav}, got ${state?.activeNav || ""}`);
      }
      if (
        step.activeAccountMenu &&
        state?.activeAccountMenu !== step.activeAccountMenu
      ) {
        failures.push(
          `expected active account menu ${step.activeAccountMenu}, got ${state?.activeAccountMenu || ""}`
        );
      }
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }

    const allErrors = visibleErrorMessages(getSessionEvents(sessionId, stepStart));
    const errors = allErrors.filter(message => !isIgnorableSmokeError(message));
    const warnings = allErrors.filter(message => isIgnorableSmokeError(message));
    if (errors.length > 0) failures.push(`${errors.length} console/page error(s)`);

    try {
      screenshot = await captureScreenshot(
        port,
        sessionId,
        screenshotDir,
        `${String(suiteIndex).padStart(2, "0")}-${String(stepIndex + 1).padStart(2, "0")}-${slug(suite.role)}-${slug(suite.label)}-${slug(step.label)}`
      );
    } catch (error) {
      failures.push(
        `screenshot capture failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    results.push({
      label: `${suite.label} / ${step.label}`,
      role: suite.role,
      suite: "interactions",
      path: step.expectedPath || suite.startPath,
      status: failures.length ? "FAIL" : "OK",
      failures,
      errors,
      warnings,
      screenshot,
      clicked,
      state
    });
  }
  return results;
}

function printSummary(results) {
  const rows = results.map(result => [
    result.status,
    result.role,
    result.label,
    result.path,
    result.failures.join("; ") || "rendered"
  ]);
  const headers = ["Status", "Role", "Route", "Path", "Detail"];
  const widths = headers.map((header, column) =>
    Math.max(header.length, ...rows.map(row => String(row[column]).length))
  );
  const line = values =>
    values
      .map((value, index) => String(value || "").padEnd(widths[index]))
      .join("  ");
  console.log(line(headers));
  console.log(line(widths.map(width => "-".repeat(width))));
  for (const row of rows) console.log(line(row));
  const ok = results.filter(result => result.status === "OK").length;
  const fail = results.length - ok;
  console.log("");
  console.log(`Native smoke summary: ${ok} OK, ${fail} FAIL`);
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const h5Port = Number(option(flags, "h5-port", "8851"));
  const cdpPort = Number(option(flags, "cdp-port", "9225"));
  const timeoutMs = Number(option(flags, "timeout", "25")) * 1000;
  const baseUrl = option(flags, "base-url", `http://localhost:${h5Port}`);
  const shouldStartApp = !boolOption(flags, "no-start");
  const chromePath = findChrome(flags);
  const userDataDirOverride = option(flags, "user-data-dir", "");
  const userDataDir =
    userDataDirOverride || join(tmpdir(), `qiming-native-smoke-${process.pid}`);
  const shouldCleanProfile =
    !userDataDirOverride && !boolOption(flags, "keep-profile");
  const reportPath = option(
    flags,
    "report",
    join(repoRoot, "native-smoke-report.json")
  );
  const screenshotDir = boolOption(flags, "no-screenshots")
    ? ""
    : option(
        flags,
        "screenshot-dir",
        join(repoRoot, ".native-smoke", "screenshots", screenshotTimestamp)
      );
  const mode = option(flags, "mode", "routes");
  const routes = collectRoutes(flags);
  const interactions = collectInteractionSuites(flags);
  let appProcess = null;
  let chromeProcess = null;

  if (mode !== "routes" && mode !== "interactions") {
    throw new Error("Unknown smoke mode. Use --mode routes or --mode interactions.");
  }

  if (mode === "routes" && routes.length === 0) {
    throw new Error("No smoke routes selected. Use --roles student,teacher,admin.");
  }

  if (mode === "interactions" && interactions.length === 0) {
    throw new Error("No interaction suites selected. Use --roles student,teacher,admin.");
  }

  try {
    if (!(await isPortListening(h5Port))) {
      if (!shouldStartApp) {
        throw new Error(`H5 preview port ${h5Port} is not listening.`);
      }
      appProcess = startPreviewServer(
        ["dev", "--host", "0.0.0.0", "--port", String(h5Port)],
        repoRoot,
        "h5"
      );
      if (!(await waitForPort(h5Port, timeoutMs))) {
        throw new Error(`H5 preview did not start on port ${h5Port}.`);
      }
    }

    rmSync(userDataDir, { recursive: true, force: true });
    mkdirSync(userDataDir, { recursive: true });
    chromeProcess = spawn(
      chromePath,
      [
        `--remote-debugging-port=${cdpPort}`,
        "--remote-debugging-address=127.0.0.1",
        `--user-data-dir=${userDataDir}`,
        "--headless=new",
        "--disable-gpu",
        "--disable-background-networking",
        "--disable-component-update",
        "--disable-default-apps",
        "--disable-extensions",
        "--disable-features=AutofillServerCommunication,MediaRouter,OptimizationHints,Translate",
        "--disable-sync",
        "--metrics-recording-only",
        "--no-first-run",
        "--no-default-browser-check",
        "--password-store=basic",
        "--use-mock-keychain",
        "about:blank"
      ],
      {
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    chromeProcess.stderr?.on("data", chunk => {
      if (boolOption(flags, "browser-log")) process.stderr.write(String(chunk));
    });

    if (!(await waitForPort(cdpPort, timeoutMs))) {
      throw new Error(`Chrome DevTools did not start on port ${cdpPort}.`);
    }
    await connectCdp(cdpPort);
    const sessionId = await createPageSession(cdpPort);
    const results = [];
    if (mode === "routes") {
      for (const [index, route] of routes.entries()) {
        results.push(
          await validateRoute(
            cdpPort,
            sessionId,
            route,
            baseUrl,
            timeoutMs,
            screenshotDir,
            index + 1
          )
        );
      }
    } else {
      for (const [index, suite] of interactions.entries()) {
        results.push(
          ...(await validateInteractionSuite(
            cdpPort,
            sessionId,
            suite,
            baseUrl,
            timeoutMs,
            screenshotDir,
            index + 1
          ))
        );
      }
    }
    writeFileSync(reportPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");
    printSummary(results);
    console.log(`Report: ${reportPath}`);

    if (results.some(result => result.status === "FAIL")) {
      process.exitCode = 1;
    }
  } finally {
    if (cdp.ws) cdp.ws.close();
    chromeProcess?.kill();
    appProcess?.kill();
    if (shouldCleanProfile) await removeDirQuietly(userDataDir);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
