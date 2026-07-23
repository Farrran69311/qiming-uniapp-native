#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { PNG } from "pngjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const nativeProject = join(root, "native-app");
const buildDir = join(nativeProject, "dist", "build", "mp-weixin");
const projectConfigPath = join(buildDir, "project.config.json");
const artifactsDir = join(root, "artifacts", "wechat-miniprogram");
const wrongExerciseViewPath = join(
  root,
  "src/views/account/wrong-exercise.vue"
);
const wrongExerciseApiPath = join(root, "src/api/frontend/wrong-exercise.ts");
const defaultWebviewOrigin = "https://aiedu-mp.intelledu.cn";
const defaultLaunchEntry = "/home";
const defaultLaunchRole = "";

const realAppIdPattern = /^wx[a-zA-Z0-9]{16}$/;

const roleLabels = {
  student: "student",
  teacher: "teacher",
  admin: "admin"
};

const routeMatrix = [
  {
    name: "student-home",
    role: "student",
    entry: "/account?menu=home",
    expectText: "吴同学"
  },
  {
    name: "student-courses",
    role: "student",
    entry: "/account?menu=course",
    expectText: "我的课程"
  },
  {
    name: "student-course-study",
    role: "student",
    entry: "/course/1?section=course-learn",
    expectText: "章节目录"
  },
  {
    name: "student-course-mastery",
    role: "student",
    entry: "/course/1?section=mastery",
    expectText: "知识点"
  },
  {
    name: "student-course-qa",
    role: "student",
    entry: "/course/1?section=course-qa",
    expectText: "课程问答"
  },
  {
    name: "student-course-work",
    role: "student",
    entry: "/course/1?section=homework-exam",
    expectText: "作业考试"
  },
  {
    name: "student-exams",
    role: "student",
    entry: "/account?menu=exam-center",
    expectText: "试题试卷中心"
  },
  {
    name: "student-exam-do",
    role: "student",
    entry: "/student-exam-center/do/1",
    expectText: "考试"
  },
  {
    name: "student-exam-result",
    role: "student",
    entry: "/exam-paper/result/1",
    expectText: "考试结果"
  },
  {
    name: "student-ai-app",
    role: "student",
    entry: "/account/ai-app?mode=student",
    expectText: "学生模式"
  },
  {
    name: "teacher-dashboard",
    role: "teacher",
    entry: "/welcome/index",
    expectText: "教师"
  },
  {
    name: "teacher-courses",
    role: "teacher",
    entry: "/course/list",
    expectText: "课程名称"
  },
  {
    name: "teacher-course-category",
    role: "teacher",
    entry: "/course/category",
    expectText: "课程分类"
  },
  {
    name: "teacher-course-assessment",
    role: "teacher",
    entry: "/course/assessment",
    expectText: "课程中心"
  },
  {
    name: "teacher-discussion-review",
    role: "teacher",
    entry: "/course/discussion/review",
    expectText: "筛选条件"
  },
  {
    name: "teacher-ai-app",
    role: "teacher",
    entry: "/ai-app/workspace",
    expectText: "教师模式"
  },
  {
    name: "admin-dashboard",
    role: "admin",
    entry: "/welcome/index",
    expectText: "管理员"
  },
  {
    name: "admin-users",
    role: "admin",
    entry: "/user/list",
    expectText: "用户列表"
  },
  {
    name: "admin-course-category",
    role: "admin",
    entry: "/course/category",
    expectText: "课程分类"
  },
  {
    name: "admin-discussion-review",
    role: "admin",
    entry: "/course/discussion/review",
    expectText: "筛选条件"
  }
];

function parseArgs(argv) {
  const args = [...argv];
  const command = args.shift() || "doctor";
  const options = {
    appid:
      process.env.WECHAT_MINIPROGRAM_APPID ||
      process.env.MP_WEIXIN_APPID ||
      "",
    cli: process.env.WECHAT_DEVTOOLS_CLI || "",
    devServer:
      process.env.QIMING_MINIPROGRAM_WEBVIEW_ORIGIN ||
      process.env.WECHAT_MINIPROGRAM_DEV_SERVER ||
      "",
    role: process.env.QIMING_MINIPROGRAM_ROLE || "",
    entry: process.env.QIMING_MINIPROGRAM_ENTRY || "",
    pureSimulator: false,
    version: process.env.WECHAT_MINIPROGRAM_VERSION || "",
    desc: process.env.WECHAT_MINIPROGRAM_DESC || "",
    browser: process.env.QIMING_MINIPROGRAM_BROWSER || "",
    outDir: "",
    route: process.env.QIMING_MINIPROGRAM_SMOKE_ROUTE || "",
    waitMs: Number(process.env.QIMING_MINIPROGRAM_H5_WAIT_MS || 8000),
    devtoolsWaitMs: Number(
      process.env.QIMING_MINIPROGRAM_DEVTOOLS_WAIT_MS || 16000
    ),
    devtoolsPort: Number(process.env.WECHAT_DEVTOOLS_PORT || 0),
    headed: false,
    allowLocalhostPreview: false
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === "--") {
      continue;
    } else if (arg === "--appid" && next) {
      options.appid = next;
      i += 1;
    } else if (arg === "--cli" && next) {
      options.cli = next;
      i += 1;
    } else if (arg === "--dev-server" && next) {
      options.devServer = next;
      i += 1;
    } else if (arg === "--role" && next) {
      options.role = next;
      i += 1;
    } else if (arg === "--entry" && next) {
      options.entry = next;
      i += 1;
    } else if (arg === "--pure-simulator") {
      options.pureSimulator = true;
    } else if (arg === "--version" && next) {
      options.version = next;
      i += 1;
    } else if (arg === "--desc" && next) {
      options.desc = next;
      i += 1;
    } else if (arg === "--browser" && next) {
      options.browser = next;
      i += 1;
    } else if (arg === "--out-dir" && next) {
      options.outDir = next;
      i += 1;
    } else if ((arg === "--route" || arg === "--only") && next) {
      options.route = next;
      i += 1;
    } else if (arg === "--wait-ms" && next) {
      options.waitMs = Number(next);
      i += 1;
    } else if (arg === "--devtools-wait-ms" && next) {
      options.devtoolsWaitMs = Number(next);
      i += 1;
    } else if (arg === "--devtools-port" && next) {
      options.devtoolsPort = Number(next);
      i += 1;
    } else if (arg === "--headed") {
      options.headed = true;
    } else if (arg === "--allow-localhost-preview") {
      options.allowLocalhostPreview = true;
    } else if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  options.devServer = normalizeOrigin(options.devServer);
  options.role = normalizeRole(options.role);
  options.entry = normalizeEntry(options.entry);
  if (!Number.isFinite(options.waitMs) || options.waitMs < 0) {
    throw new Error(`Unsupported wait time: ${options.waitMs}`);
  }
  if (!Number.isFinite(options.devtoolsWaitMs) || options.devtoolsWaitMs < 0) {
    throw new Error(`Unsupported DevTools wait time: ${options.devtoolsWaitMs}`);
  }
  if (!Number.isFinite(options.devtoolsPort) || options.devtoolsPort < 0) {
    throw new Error(`Unsupported DevTools port: ${options.devtoolsPort}`);
  }
  options.route = String(options.route || "").trim();
  return { command, options };
}

function normalizeOrigin(input) {
  const value = String(input || "").trim();
  if (!value) return "";
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`Unsupported dev server protocol: ${value}`);
  }
  return parsed.origin;
}

function normalizeRole(input) {
  const value = String(input || "").trim();
  if (!value) return "";
  if (["student", "teacher", "admin"].includes(value)) return value;
  throw new Error(`Unsupported mini program role: ${value}`);
}

function normalizeEntry(input) {
  let value = String(input || "").trim();
  if (!value) return "";
  try {
    value = decodeURIComponent(value);
  } catch {
    value = "/welcome/index";
  }
  value = value.replace(/^#/, "");
  if (!value.startsWith("/")) value = `/${value}`;
  if (value.startsWith("//") || value.includes("://")) {
    throw new Error(`Unsupported mini program entry: ${input}`);
  }
  return value;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function run(command, args, cwd = root, env = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...env }
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with ${result.status}`);
  }
}

function runCapture(command, args, cwd = root, env = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...env }
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(
      `${command} ${args.join(" ")} failed with ${result.status}\n${output}`
    );
  }
  return `${result.stdout || ""}${result.stderr || ""}`;
}

function pnpmCommand() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function resolveCliPath(explicitPath = "") {
  const candidates = [
    explicitPath,
    "/Applications/wechatwebdevtools.app/Contents/MacOS/cli",
    "/Applications/WeChatWebDevTools.app/Contents/MacOS/cli",
    "/Applications/WeChat DevTools.app/Contents/MacOS/cli",
    "/Applications/WeChatDeveloperTool.app/Contents/MacOS/cli",
    "/Applications/微信开发者工具.app/Contents/MacOS/cli"
  ].filter(Boolean);
  return candidates.find(candidate => existsSync(candidate)) || "";
}

function resolveBrowserPath(explicitPath = "") {
  const candidates = [
    explicitPath,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
  ].filter(Boolean);
  return candidates.find(candidate => existsSync(candidate)) || "";
}

function withDevToolsPort(args, options) {
  if (options.devtoolsPort > 0) {
    args.push("--port", String(options.devtoolsPort));
  }
  return args;
}

function hasPackage(packageName) {
  try {
    require.resolve(packageName);
    return true;
  } catch {
    return false;
  }
}

function buildQuery(route, role, devServer) {
  const params = new URLSearchParams();
  params.set("entry", route);
  if (role) params.set("demoRole", role);
  if (devServer) params.set("devServer", devServer);
  return params.toString();
}

function readLaunchOptions(config) {
  const condition = config.condition?.miniprogram;
  const currentIndex = Number.isInteger(condition?.current) ? condition.current : 0;
  const current = condition?.list?.[currentIndex] || condition?.list?.[0];
  if (!current?.query) return {};
  const params = new URLSearchParams(current.query);
  return {
    entry: params.get("entry") || "",
    role: params.get("demoRole") || "",
    devServer: params.get("devServer") || ""
  };
}

function readExistingLaunchOptions() {
  if (!existsSync(projectConfigPath)) return {};
  try {
    return readLaunchOptions(readJson(projectConfigPath));
  } catch {
    return {};
  }
}

function resolveLaunchOptions(options) {
  return {
    entry: normalizeEntry(options.entry || defaultLaunchEntry),
    role: normalizeRole(options.role || defaultLaunchRole),
    devServer: normalizeOrigin(options.devServer || defaultWebviewOrigin)
  };
}

function hasLaunchOverrides(options) {
  return Boolean(options.devServer || options.role || options.entry);
}

function isLocalhostOrigin(origin) {
  if (!origin) return false;
  const { hostname } = new URL(origin);
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}

function assertPhonePreviewTarget(launch, options, command) {
  if (!launch.devServer) {
    throw new Error(
      `${command} needs --dev-server https://your-h5-domain. Without a web-view H5 origin, the QR code opens the fallback shell page.`
    );
  }

  const parsed = new URL(launch.devServer);
  if (parsed.protocol !== "https:" || isLocalhostOrigin(launch.devServer)) {
    if (options.allowLocalhostPreview) {
      console.warn(
        `[WARN] ${command} is using ${launch.devServer}. A phone QR preview usually cannot open localhost/http web-view pages; use this only for DevTools-side debugging.`
      );
      return;
    }
    throw new Error(
      `${command} needs a phone-accessible HTTPS H5 origin, but got ${launch.devServer}. Use mini:open for local DevTools simulator checks, or pass --dev-server https://your-h5-domain after adding it as a WeChat web-view business domain.`
    );
  }
}

function collectPhoneTargetChecks(options, launch, command = "mini:preflight") {
  const checks = [];
  const add = (status, name, detail = "") => checks.push({ status, name, detail });
  const appid = options.appid || "";
  const cliPath = resolveCliPath(options.cli);
  add(
    hasRealAppId(appid) ? "OK" : "FAIL",
    "WeChat AppID",
    appid || "set WECHAT_MINIPROGRAM_APPID=wx... or pass --appid wx..."
  );
  add(
    cliPath ? "OK" : "FAIL",
    "WeChat DevTools CLI",
    cliPath || "install WeChat DevTools or set WECHAT_DEVTOOLS_CLI"
  );

  if (!launch.devServer) {
    add(
      "FAIL",
      "web-view H5 origin",
      `${command} needs --dev-server https://your-h5-domain`
    );
    return checks;
  }

  const parsed = new URL(launch.devServer);
  add(
    parsed.protocol === "https:" ? "OK" : "FAIL",
    "HTTPS H5 origin",
    launch.devServer
  );
  add(
    !isLocalhostOrigin(launch.devServer) ? "OK" : "FAIL",
    "phone reachable origin",
    isLocalhostOrigin(launch.devServer)
      ? "localhost is only usable from this Mac, not from phone QR preview"
      : launch.devServer
  );
  return checks;
}

async function collectH5OriginChecks(origin) {
  const checks = [];
  const add = (status, name, detail = "") => checks.push({ status, name, detail });
  if (!origin) return checks;
  try {
    const response = await fetch(origin, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(10000)
    });
    add(
      response.ok ? "OK" : "FAIL",
      "H5 origin HTTP",
      `${response.status} ${response.statusText} ${response.url}`
    );
    const contentType = response.headers.get("content-type") || "";
    add(
      contentType.includes("text/html") ? "OK" : "WARN",
      "H5 origin content-type",
      contentType || "empty"
    );
    const html = await response.text();
    const bodySize = new TextEncoder().encode(html).length;
    add(
      bodySize > 1024 ? "OK" : "FAIL",
      "H5 origin body",
      `${bodySize} bytes`
    );
    add(
      /<script\b[^>]+src=["'][^"']*\/static\/js\//.test(html) ? "OK" : "FAIL",
      "H5 origin assets",
      "expected Vite entry script under /static/js/"
    );
  } catch (error) {
    add(
      "FAIL",
      "H5 origin HTTP",
      error instanceof Error ? error.message : String(error)
    );
  }
  return checks;
}

function patchProjectConfig(options) {
  if (!existsSync(projectConfigPath)) {
    throw new Error(
      `Missing WeChat project config: ${projectConfigPath}. Run mini:build first.`
    );
  }
  const config = readJson(projectConfigPath);
  const launch = resolveLaunchOptions(options);
  config.appid = hasRealAppId(options.appid)
    ? options.appid
    : hasRealAppId(config.appid)
      ? config.appid
      : "";
  config.projectname = config.projectname || "IntellEdu";
  config.condition = config.condition || {};
  config.condition.miniprogram = {
    current: 0,
    list: [
      {
        name: "current",
        pathName: "pages/index/index",
        query: buildQuery(launch.entry, launch.role, launch.devServer)
      },
      ...routeMatrix.map((route, index) => ({
        id: index,
        name: route.name,
        pathName: "pages/index/index",
        query: buildQuery(route.entry, "", launch.devServer),
        scene: null
      }))
    ]
  };
  writeJson(projectConfigPath, config);
  return config;
}

function hasRealAppId(appid) {
  return realAppIdPattern.test(String(appid || ""));
}

function assertRealAppId(options, command) {
  if (hasRealAppId(options.appid)) return;
  throw new Error(
    `${command} requires a real WeChat Mini Program AppID. Set WECHAT_MINIPROGRAM_APPID=wx... or pass --appid wx....`
  );
}

function ensureBuildInstalled() {
  if (existsSync(join(nativeProject, "node_modules"))) return;
  run(pnpmCommand(), ["--dir", "native-app", "install", "--frozen-lockfile"]);
}

function runBuild(options) {
  const launch = resolveLaunchOptions(options);
  const buildOptions = { ...options, ...launch };
  ensureBuildInstalled();
  run(pnpmCommand(), ["--dir", "native-app", "build:mp-weixin"], root, {
    VITE_QIMING_MINIPROGRAM_WEBVIEW_ORIGIN: buildOptions.devServer,
    VITE_QIMING_MINIPROGRAM_ROLE: buildOptions.role,
    VITE_QIMING_MINIPROGRAM_ENTRY: buildOptions.entry
  });
  patchProjectConfig(buildOptions);
}

function collectChecks(options) {
  const checks = [];
  const add = (status, name, detail = "") => checks.push({ status, name, detail });
  const requiredFiles = [
    "app.js",
    "app.json",
    "app.wxss",
    "project.config.json",
    "pages/index/index.js",
    "pages/index/index.json",
    "pages/index/index.wxml",
    "pages/index/index.wxss"
  ];

  const wrongExerciseViewSource = existsSync(wrongExerciseViewPath)
    ? readFileSync(wrongExerciseViewPath, "utf8")
    : "";
  const wrongExerciseApiSource = existsSync(wrongExerciseApiPath)
    ? readFileSync(wrongExerciseApiPath, "utf8")
    : "";
  const historyLoader = wrongExerciseViewSource.match(
    /const fetchAnalyzedHistory = async \(\) => \{([\s\S]*?)\n\};\n\nconst handlePageChange/
  )?.[1];
  add(
    historyLoader?.includes("getWrongExerciseHistory(") &&
      !/qiming(?:MiniProgram|-mini-program)/i.test(historyLoader) &&
      wrongExerciseApiSource.includes(
        "/edu/frontend/v1/ai/wrong-exercise/history"
      )
      ? "OK"
      : "FAIL",
    "cross-client wrong-exercise history",
    "shared request required for Web, Android, and WeChat"
  );

  if (!existsSync(buildDir)) {
    add("FAIL", "mp-weixin build output", `missing: ${buildDir}`);
    return checks;
  }

  add("OK", "mp-weixin build output", buildDir);
  for (const file of requiredFiles) {
    const fullPath = join(buildDir, file);
    add(existsSync(fullPath) ? "OK" : "FAIL", file, fullPath);
  }

  if (existsSync(join(buildDir, "app.json"))) {
    const appJson = readJson(join(buildDir, "app.json"));
    add(
      appJson.pages?.includes("pages/index/index") ? "OK" : "FAIL",
      "app.json pages",
      JSON.stringify(appJson.pages || [])
    );
  }

  let launchOptions = {};
  if (existsSync(projectConfigPath)) {
    const config = patchProjectConfig(options);
    launchOptions = readLaunchOptions(config);
    const list = config.condition?.miniprogram?.list || [];
    add(
      list.length >= routeMatrix.length + 1 ? "OK" : "FAIL",
      "route matrix",
      `${list.length}/${routeMatrix.length + 1} launch conditions`
    );
    add(
      hasRealAppId(config.appid) ? "OK" : "WARN",
      "WeChat AppID",
      config.appid || "empty for simulator import; set WECHAT_MINIPROGRAM_APPID for preview/upload/auto"
    );
  }

  const wxmlPath = join(buildDir, "pages", "index", "index.wxml");
  const jsPath = join(buildDir, "pages", "index", "index.js");
  if (existsSync(wxmlPath)) {
    const wxml = readFileSync(wxmlPath, "utf8");
    add(
      wxml.includes("<web-view") ? "OK" : "FAIL",
      "WeChat web-view branch",
      "pages/index/index.wxml"
    );
    add(
      wxml.includes("微信小程序") ? "OK" : "WARN",
      "fallback status UI",
      "visible when devServer is not provided"
    );
  }
  if (existsSync(jsPath)) {
    const js = readFileSync(jsPath, "utf8");
    add(
      js.includes("qimingMiniProgram") ? "OK" : "FAIL",
      "mini program runtime query",
      "qimingMiniProgram=1"
    );
  }

  const cliPath = resolveCliPath(options.cli);
  add(
    cliPath ? "OK" : "WARN",
    "WeChat DevTools CLI",
    cliPath || "not installed or WECHAT_DEVTOOLS_CLI not set"
  );
  add(
    launchOptions.devServer ? "OK" : "WARN",
    "web-view dev server",
    launchOptions.devServer || "not set; fallback status page will render"
  );
  add(
    hasPackage("miniprogram-automator") ? "OK" : "WARN",
    "DevTools automator SDK",
    hasPackage("miniprogram-automator")
      ? "miniprogram-automator"
      : "missing; run pnpm install"
  );
  return checks;
}

function printChecks(checks) {
  const width = Math.max(...checks.map(check => check.name.length), 12);
  for (const check of checks) {
    const padded = check.name.padEnd(width, " ");
    console.log(`[${check.status}] ${padded} ${check.detail}`);
  }
  const failCount = checks.filter(check => check.status === "FAIL").length;
  const warnCount = checks.filter(check => check.status === "WARN").length;
  console.log(`Summary: ${checks.length - warnCount - failCount} OK, ${warnCount} WARN, ${failCount} FAIL`);
  if (failCount > 0) process.exitCode = 1;
}

function wait(ms) {
  return new Promise(resolveWait => setTimeout(resolveWait, ms));
}

function hasValidRouteContent(info, route) {
  const textLength = Number(info?.textLength);
  if (!Number.isFinite(textLength) || textLength === 0 || info?.blank) {
    return false;
  }
  const activeLoadingMasks = Number(info?.activeLoadingMasks || 0);
  if (Number.isFinite(activeLoadingMasks) && activeLoadingMasks > 0) {
    return false;
  }
  const overflowX = Number(info?.overflowX);
  if (Number.isFinite(overflowX) && overflowX > 0) {
    return false;
  }
  return route.expectText
    ? String(info?.textSample || "").includes(route.expectText)
    : true;
}

function isAcceptedProductWordmark(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "intelledu" || normalized === "启明智教";
}

function getH5RouteSmokeFailures(info, route) {
  const failures = [];
  const textLength = Number(info?.textLength);
  if (!Number.isFinite(textLength) || textLength === 0) {
    failures.push("empty-text");
  }
  if (info?.blank) failures.push("blank");
  const activeLoadingMasks = Number(info?.activeLoadingMasks || 0);
  if (Number.isFinite(activeLoadingMasks) && activeLoadingMasks > 0) {
    failures.push(`active-loading:${activeLoadingMasks}`);
  }
  const overflowX = Number(info?.overflowX);
  if (Number.isFinite(overflowX) && overflowX > 0) {
    failures.push(`overflow-x:${overflowX}`);
  }
  if (
    route.expectText &&
    !String(info?.textSample || "").includes(route.expectText)
  ) {
    failures.push(`missing-text:${route.expectText}`);
  }
  const topbar = info?.layout?.topbar;
  if (topbar?.exists) {
    if (!topbar.hamburgerVisible) failures.push("topbar-missing-menu-button");
    if (!topbar.themeToggleVisible) failures.push("topbar-missing-theme-button");
    if (!topbar.userChipVisible) failures.push("topbar-missing-user-button");
    const topbarBrandText = String(topbar.brandText || "").trim();
    if (topbarBrandText && !isAcceptedProductWordmark(topbarBrandText)) {
      failures.push(`topbar-brand-text:${topbarBrandText}`);
    }
    if (isAcceptedProductWordmark(topbarBrandText) && !topbar.brandComplete) {
      failures.push("topbar-brand-truncated");
    }
    const toolbarRects = [
      topbar.hamburger,
      topbar.brand,
      topbar.themeToggle,
      topbar.userChip
    ].filter(rect => rect?.visible);
    if (toolbarRects.length >= 3) {
      const topY = Math.min(...toolbarRects.map(rect => Number(rect.y)));
      const bottomY = Math.max(
        ...toolbarRects.map(rect => Number(rect.y) + Number(rect.height))
      );
      if (bottomY - topY > 66) {
        failures.push(`topbar-controls-not-single-row:${Math.round(bottomY - topY)}px`);
      }
    }
  }
  const bottom = info?.layout?.bottom;
  const bottomContentGap = Number(bottom?.contentGap);
  if (
    bottom?.scrollable &&
    Number.isFinite(bottomContentGap) &&
    bottomContentGap > 180
  ) {
    failures.push(`bottom-empty-gap:${bottomContentGap}px`);
  }
  if (route.name === "teacher-dashboard" && info?.sidebarCheck) {
    if (!info.sidebarCheck.logoVisible && !info.sidebarCheck.wordmarkVisible) {
      failures.push("sidebar-missing-brand");
    }
    const sidebarBrandText = String(info.sidebarCheck.text || "").trim();
    if (
      info.sidebarCheck.wordmarkVisible &&
      !isAcceptedProductWordmark(sidebarBrandText)
    ) {
      failures.push(`sidebar-brand-text:${sidebarBrandText}`);
    }
    if (
      isAcceptedProductWordmark(sidebarBrandText) &&
      !info.sidebarCheck.wordmarkComplete
    ) {
      failures.push("sidebar-brand-truncated");
    }
  }
  return failures;
}

function inspectPng(file) {
  const png = PNG.sync.read(readFileSync(file));
  const pixels = png.width * png.height;
  const sampleStep = Math.max(4, Math.floor(pixels / 12000)) * 4;
  let dark = 0;
  let colored = 0;
  let nonWhite = 0;
  let sampled = 0;
  for (let i = 0; i < png.data.length; i += sampleStep) {
    const r = png.data[i];
    const g = png.data[i + 1];
    const b = png.data[i + 2];
    const a = png.data[i + 3];
    if (a < 16) continue;
    sampled += 1;
    if (r < 245 || g < 245 || b < 245) nonWhite += 1;
    if (r < 210 || g < 210 || b < 210) dark += 1;
    if (Math.max(r, g, b) - Math.min(r, g, b) > 18) colored += 1;
  }
  return {
    width: png.width,
    height: png.height,
    sampled,
    nonWhiteRatio: sampled ? nonWhite / sampled : 0,
    darkRatio: sampled ? dark / sampled : 0,
    coloredRatio: sampled ? colored / sampled : 0
  };
}

function hasValidDevToolsScreenshot(metrics) {
  return (
    metrics.width >= 300 &&
    metrics.height >= 600 &&
    metrics.nonWhiteRatio > 0.015 &&
    (metrics.darkRatio > 0.003 || metrics.coloredRatio > 0.003)
  );
}

function findValueContaining(value, needle) {
  if (typeof value === "string") {
    return value.includes(needle) ? value : "";
  }
  if (!value || typeof value !== "object") return "";
  for (const item of Array.isArray(value) ? value : Object.values(value)) {
    const found = findValueContaining(item, needle);
    if (found) return found;
  }
  return "";
}

function getFreePort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") {
          resolvePort(address.port);
        } else {
          rejectPort(new Error("Unable to allocate a local browser debug port."));
        }
      });
    });
    server.on("error", rejectPort);
  });
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`${url} failed with HTTP ${response.status}`);
  }
  return response.json();
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
      lastError instanceof Error ? lastError.message : lastError
    }`
  );
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
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
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message || "CDP command failed."));
      } else {
        pending.resolve(message.result);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolveCommand, rejectCommand) => {
      this.pending.set(id, { resolve: resolveCommand, reject: rejectCommand });
      this.socket.send(payload);
    });
  }

  close() {
    this.socket?.close();
  }
}

function h5RouteUrl(devServer, route, smokeId = "") {
  const params = new URLSearchParams({
    demoRole: route.role,
    qimingNative: "1",
    qimingMiniProgram: "1"
  });
  if (smokeId) params.set("_qimingSmoke", smokeId);
  return `${devServer}/#${route.entry}${
    route.entry.includes("?") ? "&" : "?"
  }${params.toString()}`;
}

async function runH5Smoke(options) {
  const devServer = normalizeOrigin(options.devServer);
  if (!devServer) {
    throw new Error(
      "mini:h5-smoke requires --dev-server or QIMING_MINIPROGRAM_WEBVIEW_ORIGIN."
    );
  }

  const browserPath = resolveBrowserPath(options.browser);
  if (!browserPath) {
    throw new Error(
      "Chrome/Edge not found. Pass --browser /path/to/Chrome or install a Chromium browser."
    );
  }

  const debugPort = await getFreePort();
  const profileDir = mkdtempSync(join(tmpdir(), "qiming-mini-h5-smoke-"));
  const outDir =
    options.outDir ||
    join(
      artifactsDir,
      `h5-route-smoke-${new Date().toISOString().replace(/[:.]/g, "-")}`
    );
  mkdirSync(outDir, { recursive: true });

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
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true
    });
    await client.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `(() => {
        const hashQuery = location.hash.includes("?")
          ? location.hash.slice(location.hash.indexOf("?") + 1)
          : "";
        const params = new URLSearchParams(hashQuery);
        const role = params.get("demoRole");
        if (
          params.has("_qimingSmoke") &&
          ["student", "teacher", "admin"].includes(role)
        ) {
          localStorage.clear();
          sessionStorage.clear();
          document.cookie.split(";").forEach(cookie => {
            const name = cookie.split("=")[0]?.trim();
            if (name) {
              document.cookie = name + "=; Max-Age=0; path=/";
            }
          });
          localStorage.setItem("qiming-demo-role", role);
        }
      })();`
    });

    const inspectPageExpression = `(() => {
      const rectInfo = el => {
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          visible:
            rect.width > 1 &&
            rect.height > 1 &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity || 1) > 0.01
        };
      };
      const getMainScrollElement = () => {
        const selectors = [
          ".main-container > .el-scrollbar > .el-scrollbar__wrap",
          ".main-container > .el-scrollbar .el-scrollbar__wrap",
          ".main-container .app-main > .el-scrollbar > .el-scrollbar__wrap",
          ".main-container .app-main .el-scrollbar__wrap",
          ".mobile-main-container",
          ".app-main",
          ".app-main-nofixed-header",
          document.scrollingElement ? "__document__" : ""
        ];
        for (const selector of selectors) {
          const el =
            selector === "__document__"
              ? document.scrollingElement
              : selector
                ? document.querySelector(selector)
                : null;
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          const scrollable = el.scrollHeight > el.clientHeight + 8;
          const visible = rect.width > 1 && rect.height > 1;
          const inMainArea =
            selector === "__document__" ||
            selector.includes("main-container") ||
            selector.includes("mobile-main-container") ||
            selector.includes("app-main");
          if (scrollable && visible && inMainArea) {
            return { el, selector };
          }
        }
        return { el: document.scrollingElement || document.documentElement, selector: "__document__" };
      };
      const text = (document.body?.innerText || "").replace(/\\s+/g, " ").trim();
      const app = document.querySelector("#app");
      const topbar = document.querySelector(".navbar");
      const hamburger = document.querySelector(".hamburger-container");
      const brand = document.querySelector(".mobile-brand-wordmark");
      const themeToggle = document.querySelector("#header-overall, .theme-toggle-container");
      const userChip = document.querySelector(".vertical-header-right .el-dropdown-link");
      const navMobile = document.querySelector(".nav-mobile-container");
      const mainContent = document.querySelector(".main-content");
      const appMain = document.querySelector(".app-main");
      const bottomSelectors = [
        ".main-content",
        ".account-container",
        ".course-detail-page",
        ".course-detail-container",
        ".course-study-page",
        ".course-layout",
        ".exam-page",
        ".ai-app-root",
        ".el-main",
        "#app > *"
      ];
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      const maxScrollWidth = Math.max(
        document.body.scrollWidth,
        document.documentElement.scrollWidth
      );
      const scrollHeight = Math.round(Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      ));
      const visibleContentRects = [];
      for (const selector of bottomSelectors) {
        document.querySelectorAll(selector).forEach(el => {
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          if (
            rect.width > 1 &&
            rect.height > 1 &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity || 1) > 0.01
          ) {
            visibleContentRects.push({ selector, rect });
          }
        });
      }
      const bottomTarget = visibleContentRects.reduce(
        (best, item) => (!best || item.rect.bottom > best.rect.bottom ? item : best),
        null
      );
      const bottomGap = bottomTarget
        ? Math.max(0, Math.round(vh - bottomTarget.rect.bottom))
        : 0;
      const mainRect = mainContent?.getBoundingClientRect();
      const appMainRect = appMain?.getBoundingClientRect();
      const mainScroll = getMainScrollElement();
      const mainScrollRect = mainScroll.el?.getBoundingClientRect();
      const activeLoadingMasks = Array.from(
        document.querySelectorAll(".el-loading-mask, .pure-loading, .loading, [class*=loading], [class*=Loading]")
      ).filter(el => isVisibleElement(el)).length;
      return {
        href: location.href,
        title: document.title,
        textLength: text.length,
        textSample: text.slice(0, 420),
        appChildren: app?.children?.length || 0,
        overflowX: Math.max(0, Math.round(maxScrollWidth - vw)),
        scrollHeight,
        blank: Boolean(app) && !text,
        loadingDots: document.querySelectorAll(
          ".pure-loading, .loading, [class*=loading], [class*=Loading]"
        ).length,
        activeLoadingMasks,
        layout: {
          topbar: {
            exists: Boolean(topbar),
            rect: rectInfo(topbar),
            brand: rectInfo(brand),
            brandText: brand?.textContent?.trim() || "",
            brandComplete: Boolean(
              brand &&
                brand.textContent?.trim() === "IntellEdu" &&
                brand.getBoundingClientRect().width >= 70 &&
                getComputedStyle(brand).textOverflow !== "ellipsis"
            ),
            hamburger: rectInfo(hamburger),
            hamburgerVisible: Boolean(rectInfo(hamburger)?.visible),
            themeToggle: rectInfo(themeToggle),
            themeToggleVisible: Boolean(rectInfo(themeToggle)?.visible),
            userChip: rectInfo(userChip),
            userChipVisible: Boolean(rectInfo(userChip)?.visible)
          },
          content: {
            mainContent: rectInfo(mainContent),
            appMain: rectInfo(appMain),
            navMobile: rectInfo(navMobile)
          },
          bottom: {
            scrollable:
              scrollHeight > vh + 8 ||
              mainScroll.el.scrollHeight > mainScroll.el.clientHeight + 8,
            viewportHeight: vh,
            scrollHeight,
            mainScroll: {
              selector: mainScroll.selector,
              scrollTop: Math.round(mainScroll.el.scrollTop || 0),
              scrollHeight: Math.round(mainScroll.el.scrollHeight || 0),
              clientHeight: Math.round(mainScroll.el.clientHeight || 0),
              rect: mainScrollRect
                ? {
                    x: Math.round(mainScrollRect.x),
                    y: Math.round(mainScrollRect.y),
                    width: Math.round(mainScrollRect.width),
                    height: Math.round(mainScrollRect.height)
                  }
                : null
            },
            contentBottom: mainRect ? Math.round(mainRect.bottom) : null,
            measuredSelector: bottomTarget?.selector || "",
            measuredBottom: bottomTarget
              ? Math.round(bottomTarget.rect.bottom)
              : null,
            appMainBottom: appMainRect ? Math.round(appMainRect.bottom) : null,
            contentGap: bottomGap
          }
        }
      };
    })()`;
    const inspectPage = async () => {
      const evaluation = await client.send("Runtime.evaluate", {
        returnByValue: true,
        awaitPromise: true,
        expression: inspectPageExpression
      });
      return evaluation.result?.value || {};
    };
    const waitForImages = async () => {
      await client.send("Runtime.evaluate", {
        awaitPromise: true,
        expression: `Promise.all(Array.from(document.images).map(img => {
          if (img.complete && img.naturalWidth > 0) return true;
          if (typeof img.decode === "function") {
            return img.decode().then(() => true).catch(() => false);
          }
          return new Promise(resolve => {
            img.addEventListener("load", () => resolve(true), { once: true });
            img.addEventListener("error", () => resolve(false), { once: true });
            setTimeout(() => resolve(false), 1200);
          });
        }))`
      });
      await wait(180);
    };

    const selectedRoutes = options.route
      ? routeMatrix.filter(route => route.name === options.route)
      : routeMatrix;
    if (options.route && selectedRoutes.length === 0) {
      throw new Error(
        `Unknown H5 smoke route: ${options.route}. Known routes: ${routeMatrix
          .map(route => route.name)
          .join(", ")}`
      );
    }

    const results = [];
    for (const route of selectedRoutes) {
      const url = h5RouteUrl(devServer, route, `${Date.now()}-${route.name}`);
      await client.send("Page.navigate", { url: "about:blank" });
      await wait(150);
      await client.send("Page.navigate", { url });
      const startedAt = Date.now();
      let info = await inspectPage();
      while (
        Date.now() - startedAt < options.waitMs &&
        !hasValidRouteContent(info, route)
      ) {
        await wait(300);
        info = await inspectPage();
      }
      await waitForImages();
      // CSS panel transitions can finish after the route text is already present.
      // Capture settled UI states so screenshots are useful for visual review.
      await wait(900);
      info = await inspectPage();
      info.matchedExpectedText = route.expectText
        ? String(info.textSample || "").includes(route.expectText)
        : true;
      const screenshot = await client.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true
      });
      const screenshotPath = join(outDir, `${route.name}.png`);
      writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
      for (let scrollAttempt = 0; scrollAttempt < 8; scrollAttempt += 1) {
        await client.send("Runtime.evaluate", {
          awaitPromise: true,
          expression: `(() => {
            const selectors = [
              ".main-container > .el-scrollbar > .el-scrollbar__wrap",
              ".main-container > .el-scrollbar .el-scrollbar__wrap",
              ".main-container .app-main > .el-scrollbar > .el-scrollbar__wrap",
              ".main-container .app-main .el-scrollbar__wrap",
              ".mobile-main-container",
              ".app-main",
              ".app-main-nofixed-header"
            ];
            let target = null;
            for (const selector of selectors) {
              const el = document.querySelector(selector);
              if (el && el.scrollHeight > el.clientHeight + 8) {
                const rect = el.getBoundingClientRect();
                if (rect.width > 1 && rect.height > 1) {
                  target = el;
                  break;
                }
              }
            }
            target ||= document.scrollingElement || document.documentElement;
            const top = Math.max(0, target.scrollHeight - target.clientHeight);
            target.scrollTo?.({ top, left: 0, behavior: "instant" });
            target.scrollTop = top;
            target.scrollLeft = 0;
            target.dispatchEvent(new Event("scroll", { bubbles: true }));
            window.scrollTo(0, Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
          })()`
        });
        await wait(160);
      }
      const bottomInfo = await inspectPage();
      info.layout = {
        ...(info.layout || {}),
        bottom: bottomInfo.layout?.bottom || info.layout?.bottom
      };
      const bottomScreenshot = await client.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true
      });
      const bottomScreenshotPath = join(outDir, `${route.name}-bottom.png`);
      writeFileSync(
        bottomScreenshotPath,
        Buffer.from(bottomScreenshot.data, "base64")
      );
      let sidebarScreenshotPath = "";
      if (route.name === "teacher-dashboard") {
        await client.send("Runtime.evaluate", {
          awaitPromise: true,
          expression: `(() => {
            window.scrollTo(0, 0);
            const button = document.querySelector(".hamburger-container");
            button?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
          })()`
        });
        await wait(420);
        const sidebarCheck = await client.send("Runtime.evaluate", {
          returnByValue: true,
          awaitPromise: true,
          expression: `(() => {
            const logo = document.querySelector(".sidebar-logo-container");
            const wordmark = document.querySelector(".sidebar-logo-container .sidebar-title");
            const logoRect = logo?.getBoundingClientRect();
            const wordmarkRect = wordmark?.getBoundingClientRect();
            const style = wordmark ? getComputedStyle(wordmark) : null;
            const text = wordmark?.textContent?.trim() || "";
            const acceptedWordmark =
              text.toLowerCase() === "intelledu" || text === "启明智教";
            const wordmarkFits = Boolean(
              wordmark && wordmark.scrollWidth <= wordmark.clientWidth + 1
            );
            return {
              text,
              logoVisible: Boolean(logoRect && logoRect.width > 1 && logoRect.height > 1),
              wordmarkVisible: Boolean(
                wordmarkRect &&
                  wordmarkRect.width > 20 &&
                  wordmarkRect.height > 12 &&
                  style?.display !== "none" &&
                  style?.visibility !== "hidden" &&
                  Number(style?.opacity || 1) > 0.01
              ),
              wordmarkComplete: Boolean(
                acceptedWordmark &&
                  wordmarkRect &&
                  wordmarkRect.width >= 96 &&
                  (style?.textOverflow !== "ellipsis" || wordmarkFits)
              ),
              logoRect: logoRect
                ? {
                    x: Math.round(logoRect.x),
                    y: Math.round(logoRect.y),
                    width: Math.round(logoRect.width),
                    height: Math.round(logoRect.height)
                  }
                : null,
              wordmarkRect: wordmarkRect
                ? {
                    x: Math.round(wordmarkRect.x),
                    y: Math.round(wordmarkRect.y),
                    width: Math.round(wordmarkRect.width),
                    height: Math.round(wordmarkRect.height)
                  }
                : null
            };
          })()`
        });
        info.sidebarCheck = sidebarCheck.result?.value || {};
        const sidebarScreenshot = await client.send("Page.captureScreenshot", {
          format: "png",
          fromSurface: true
        });
        sidebarScreenshotPath = join(outDir, `${route.name}-sidebar.png`);
        writeFileSync(
          sidebarScreenshotPath,
          Buffer.from(sidebarScreenshot.data, "base64")
        );
      }
      const failReasons = getH5RouteSmokeFailures(info, route);
      const ok = failReasons.length === 0;
      results.push({
        ...route,
        url,
        screenshotPath,
        bottomScreenshotPath,
        sidebarScreenshotPath,
        info,
        ok,
        failReasons
      });
      const status = ok ? "OK" : "FAIL";
      console.log(
        `[${status}] ${route.name.padEnd(18, " ")} text=${String(
          info.textLength ?? 0
        ).padStart(4, " ")} overflowX=${info.overflowX ?? "?"} bottomGap=${
          info.layout?.bottom?.contentGap ?? "?"
        } expect=${route.expectText || "-"} ${screenshotPath}`
      );
    }

    const summary = {
      generatedAt: new Date().toISOString(),
      devServer,
      viewport: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true },
      browserPath,
      totals: {
        routes: results.length,
        ok: results.filter(result => result.ok).length,
        fail: results.filter(result => !result.ok).length
      },
      results
    };
    writeJson(join(outDir, "summary.json"), summary);
    const failed = results.filter(result => !result.ok);
    console.log(`Summary written: ${join(outDir, "summary.json")}`);
    console.log(
      `H5 route smoke: ${results.length - failed.length} OK, ${failed.length} FAIL`
    );
    if (failed.length > 0) process.exitCode = 1;
  } finally {
    client?.close();
    browserProcess.kill();
    await wait(300);
    try {
      rmSync(profileDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
    } catch (error) {
      console.warn(
        `[WARN] temporary browser profile cleanup skipped: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  if (browserError && process.env.QIMING_MINIPROGRAM_DEBUG_BROWSER === "1") {
    console.error(browserError.trim());
  }
}

async function runDevToolsSmoke(options) {
  assertRealAppId(options, "mini:devtools-smoke");
  const launch = resolveLaunchOptions(options);
  runBuild({ ...options, ...launch });
  const checks = collectChecks({ ...options, ...launch });
  const failedChecks = checks.filter(check => check.status === "FAIL");
  if (failedChecks.length > 0) {
    printChecks(checks);
    process.exitCode = 1;
    return;
  }

  const cliPath = resolveCliPath(options.cli);
  if (!cliPath) {
    throw new Error(
      "WeChat DevTools CLI not found. Install WeChat DevTools or set WECHAT_DEVTOOLS_CLI."
    );
  }
  const automator = require("miniprogram-automator");
  const outDir =
    options.outDir ||
    join(
      artifactsDir,
      `devtools-smoke-${new Date().toISOString().replace(/[:.]/g, "-")}`
    );
  mkdirSync(outDir, { recursive: true });
  const screenshotPath = join(outDir, "current.png");
  const summaryPath = join(outDir, "summary.json");

  let miniProgram;
  try {
    miniProgram = await automator.launch({
      cliPath,
      projectPath: buildDir,
      timeout: Math.max(30000, options.devtoolsWaitMs + 30000),
      trustProject: true
    });

    const query = buildQuery(launch.entry, launch.role, launch.devServer);
    const page = await miniProgram.reLaunch(
      `/pages/index/index?${query}&_qimingDevtoolsSmoke=${Date.now()}`
    );
    await page.waitFor(options.devtoolsWaitMs);
    const currentPage = await miniProgram.currentPage();
    const systemInfo = await miniProgram.systemInfo();
    const pageData = currentPage ? await currentPage.data() : {};
    await miniProgram.screenshot({ path: screenshotPath });
    const screenshot = inspectPng(screenshotPath);
    const webviewSrc = findValueContaining(pageData, "qimingMiniProgram=1");
    const result = {
      generatedAt: new Date().toISOString(),
      entry: launch.entry,
      role: launch.role,
      devServer: launch.devServer,
      webviewSrc,
      page: currentPage
        ? { path: currentPage.path, query: currentPage.query }
        : null,
      systemInfo: {
        brand: systemInfo.brand,
        model: systemInfo.model,
        platform: systemInfo.platform,
        screenWidth: systemInfo.screenWidth,
        screenHeight: systemInfo.screenHeight,
        windowWidth: systemInfo.windowWidth,
        windowHeight: systemInfo.windowHeight,
        SDKVersion: systemInfo.SDKVersion
      },
      screenshotPath,
      screenshot
    };
    writeJson(summaryPath, result);
    const pageOk = currentPage?.path === "pages/index/index";
    const webviewOk =
      webviewSrc.includes(launch.devServer) &&
      webviewSrc.includes("qimingMiniProgram=1") &&
      webviewSrc.includes(`#${launch.entry}`);
    const screenshotOk = hasValidDevToolsScreenshot(screenshot);
    console.log(
      `[${pageOk ? "OK" : "FAIL"}] DevTools page ${currentPage?.path || "-"}`
    );
    console.log(
      `[${webviewOk ? "OK" : "FAIL"}] DevTools web-view ${webviewSrc || "-"}`
    );
    console.log(
      `[${screenshotOk ? "OK" : "WARN"}] DevTools screenshot ${screenshotPath} nonWhite=${screenshot.nonWhiteRatio.toFixed(4)} dark=${screenshot.darkRatio.toFixed(4)} colored=${screenshot.coloredRatio.toFixed(4)}`
    );
    console.log(`Summary written: ${summaryPath}`);
    if (!pageOk || !webviewOk) process.exitCode = 1;
  } finally {
    miniProgram?.disconnect?.();
  }
}

function runDoctor(options) {
  const checks = [];
  const add = (status, name, detail = "") => checks.push({ status, name, detail });
  add(existsSync(nativeProject) ? "OK" : "FAIL", "native-app project", nativeProject);
  add(
    existsSync(join(nativeProject, "package.json")) ? "OK" : "FAIL",
    "native-app package",
    join(nativeProject, "package.json")
  );
  add(
    existsSync(join(nativeProject, "pnpm-lock.yaml")) ? "OK" : "FAIL",
    "native-app lockfile",
    join(nativeProject, "pnpm-lock.yaml")
  );
  add(
    existsSync(join(nativeProject, "node_modules")) ? "OK" : "WARN",
    "native-app node_modules",
    existsSync(join(nativeProject, "node_modules"))
      ? join(nativeProject, "node_modules")
      : "missing; mini:build will install from lockfile"
  );
  add(
    existsSync(buildDir) ? "OK" : "WARN",
    "mp-weixin build output",
    existsSync(buildDir) ? buildDir : "missing; run pnpm mini:build"
  );
  const cliPath = resolveCliPath(options.cli);
  add(
    cliPath ? "OK" : "WARN",
    "WeChat DevTools CLI",
    cliPath || "install WeChat DevTools or set WECHAT_DEVTOOLS_CLI"
  );
  printChecks(checks);
}

async function runPreflight(options) {
  assertRealAppId(options, "mini:preflight");
  const launch = resolveLaunchOptions(options);
  runBuild({ ...options, ...launch });
  const checks = [
    ...collectPhoneTargetChecks(options, launch, "mini:preflight"),
    ...collectChecks({ ...options, ...launch }),
    ...(await collectH5OriginChecks(launch.devServer))
  ];
  printChecks(checks);
}

function runOpen(options) {
  if (!existsSync(buildDir) || hasLaunchOverrides(options)) {
    runBuild(options);
  } else {
    patchProjectConfig(options);
  }
  const cliPath = resolveCliPath(options.cli);
  if (!cliPath) {
    throw new Error(
      "WeChat DevTools CLI not found. Install WeChat DevTools or set WECHAT_DEVTOOLS_CLI."
    );
  }
  const args = withDevToolsPort(["open", "--project", buildDir], options);
  if (options.pureSimulator) args.push("--pure-simulator");
  run(cliPath, args);
}

function runPreview(options) {
  assertRealAppId(options, "mini:preview");
  const launch = resolveLaunchOptions(options);
  assertPhonePreviewTarget(launch, options, "mini:preview");
  runBuild({ ...options, ...launch });
  const cliPath = resolveCliPath(options.cli);
  if (!cliPath) {
    throw new Error(
      "WeChat DevTools CLI not found. Install WeChat DevTools or set WECHAT_DEVTOOLS_CLI."
    );
  }
  mkdirSync(artifactsDir, { recursive: true });
  run(cliPath, withDevToolsPort([
    "preview",
    "--project",
    buildDir,
    "--qr-format",
    "image",
    "--qr-output",
    join(artifactsDir, "preview.png"),
    "--info-output",
    join(artifactsDir, "preview-info.json")
  ], options));
}

function runAuto(options) {
  assertRealAppId(options, "mini:auto");
  if (!existsSync(buildDir) || hasLaunchOverrides(options)) {
    runBuild(options);
  } else {
    patchProjectConfig(options);
  }
  const cliPath = resolveCliPath(options.cli);
  if (!cliPath) {
    throw new Error(
      "WeChat DevTools CLI not found. Install WeChat DevTools or set WECHAT_DEVTOOLS_CLI."
    );
  }
  const output = runCapture(cliPath, withDevToolsPort([
    "auto",
    "--project",
    buildDir,
    "--trust-project"
  ], options));
  console.log(output.trim());
}

function runUpload(options) {
  assertRealAppId(options, "mini:upload");
  if (!options.version) {
    throw new Error("Missing --version or WECHAT_MINIPROGRAM_VERSION.");
  }
  const launch = resolveLaunchOptions(options);
  assertPhonePreviewTarget(launch, options, "mini:upload");
  runBuild({ ...options, ...launch });
  const cliPath = resolveCliPath(options.cli);
  if (!cliPath) {
    throw new Error(
      "WeChat DevTools CLI not found. Install WeChat DevTools or set WECHAT_DEVTOOLS_CLI."
    );
  }
  mkdirSync(artifactsDir, { recursive: true });
  run(cliPath, withDevToolsPort([
    "upload",
    "--project",
    buildDir,
    "--version",
    options.version,
    "--desc",
    options.desc || `IntellEdu mini program ${options.version}`,
    "--info-output",
    join(artifactsDir, "upload-info.json")
  ], options));
}

function printHelp() {
  console.log(`Usage: node scripts/wechat-miniprogram.mjs <command> [options]

Commands:
  doctor   Check local mini program tooling.
  build    Build native-app as mp-weixin and patch launch conditions.
  smoke    Verify generated mp-weixin files and route conditions.
  h5-smoke Capture mobile screenshots for the H5 route matrix.
  devtools-smoke
           Launch WeChat DevTools automation and capture the generated mini program shell.
  preflight
           Build and verify AppID, HTTPS H5 origin, DevTools CLI, and route matrix before preview/upload.
  open     Open the generated project in WeChat DevTools.
  preview  Generate a WeChat preview QR code through DevTools CLI.
  auto     Enable WeChat DevTools automation; requires a real AppID.
  upload   Upload through DevTools CLI; requires --version.

Options:
  --appid <wxappid>       Override WECHAT_MINIPROGRAM_APPID.
  --cli <path>            Override WECHAT_DEVTOOLS_CLI.
  --dev-server <origin>   H5 origin for web-view debugging, e.g. http://localhost:8851.
  --role <role>           Launch role: student, teacher, or admin.
  --entry <path>          Launch H5 route, e.g. /welcome/index.
  --pure-simulator        Use DevTools pure simulator mode for open.
  --browser <path>        Chromium browser path for h5-smoke.
  --out-dir <path>        Screenshot output directory for h5-smoke.
  --wait-ms <ms>          Per-route wait time for h5-smoke.
  --devtools-wait-ms <ms> Wait time before DevTools screenshot capture.
  --devtools-port <port>  WeChat DevTools local HTTP server port.
  --headed                Run h5-smoke with a visible browser window.
  --allow-localhost-preview
                          Allow localhost/http preview QR generation for DevTools-only debugging.
  --version <semver>      Upload version.
  --desc <text>           Upload description.
`);
}

try {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (options.help || command === "help") {
    printHelp();
  } else if (command === "doctor") {
    runDoctor(options);
  } else if (command === "build") {
    runBuild(options);
    printChecks(collectChecks(options));
  } else if (command === "smoke") {
    printChecks(collectChecks(options));
  } else if (command === "h5-smoke") {
    await runH5Smoke(options);
  } else if (command === "devtools-smoke") {
    await runDevToolsSmoke(options);
  } else if (command === "preflight") {
    await runPreflight(options);
  } else if (command === "open") {
    runOpen(options);
  } else if (command === "preview") {
    runPreview(options);
  } else if (command === "auto") {
    runAuto(options);
  } else if (command === "upload") {
    runUpload(options);
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
