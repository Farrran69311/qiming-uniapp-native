#!/usr/bin/env node
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const iosRoot = join(repoRoot, "ios-native");
const buildRoot = join(iosRoot, "build");
const appName = "QimingIntellEdu";
const bundleId = "cn.intelledu.qiming.native";
const appPath = join(buildRoot, `${appName}.app`);
const resourceSource = join(repoRoot, "native-app", "src", "hybrid", "html");
const resourceTarget = join(appPath, "AppResources");
const defaultDeviceName = "iPhone 16 Pro";
const defaultSmokeRoles = "student,teacher,admin";

const routeSuites = {
  teacher: [
    { label: "教师工作台", entry: "/welcome/index", expect: ["教师"] },
    { label: "教师课程", entry: "/course/list", expect: ["课程"] },
    { label: "课程分类", entry: "/course/category", expect: ["课程分类"] },
    { label: "教案管理", entry: "/course/teacherplan", expect: ["教案"] },
    { label: "作业与考试", entry: "/course/assessment", expect: ["作业"] },
    { label: "AI 动画", entry: "/course/animation", expect: ["智能动画中心"] },
    { label: "视频分析", entry: "/course/video-analysis", expect: ["视频分析中心"] },
    { label: "讨论列表", entry: "/course/discussion/review", expect: ["讨论列表"] },
    { label: "试卷总览", entry: "/exam-paper/index", expect: ["试卷", "阅卷管理"] },
    { label: "我的试卷", entry: "/exam-paper/my-papers", expect: ["我的试卷"] },
    { label: "试卷模板", entry: "/exam-paper/templates", expect: ["试卷模板"] },
    { label: "阅卷管理", entry: "/exam-paper/grading", expect: ["阅卷管理"] },
    { label: "学情分析", entry: "/exam-paper/statistics", expect: ["学情分析"] },
    { label: "题库管理", entry: "/exam-paper/question-bank", expect: ["题库管理"] },
    { label: "教师 AI App", entry: "/ai-app/workspace", expect: ["AI"] },
    { label: "教师账号", entry: "/account-settings", expect: ["个人信息"] }
  ],
  student: [
    { label: "学生首页", entry: "/account?menu=home", expect: ["首页"] },
    { label: "学生课程", entry: "/account?menu=course", expect: ["课程"] },
    { label: "学生虚拟校园", entry: "/account?menu=classroom", expect: ["2D 校园导览"] },
    { label: "学生 AI App", entry: "/account/ai-app?mode=student", expect: ["AI"] },
    { label: "学生云盘", entry: "/account?menu=cloud-disk", expect: ["学习云盘"] },
    { label: "学生通知", entry: "/account?menu=notification", expect: ["系统通知"] },
    { label: "学生待办", entry: "/account?menu=todo", expect: ["待办事项"] },
    { label: "学生虚拟实验室", entry: "/account?menu=virtual-lab", expect: ["虚拟实验室"] },
    { label: "学生赛事场", entry: "/account?menu=competition", expect: ["赛事场"] },
    { label: "学生试卷中心", entry: "/account?menu=exam-center", expect: ["试题试卷中心"] },
    { label: "学生我的", entry: "/account?menu=profile", expect: ["个人中心"] }
  ],
  admin: [
    { label: "管理工作台", entry: "/welcome/index", expect: ["管理员"] },
    { label: "用户管理", entry: "/user/list", expect: ["用户"] },
    { label: "管理课程", entry: "/course/list", expect: ["课程"] },
    { label: "管理课程分类", entry: "/course/category", expect: ["课程分类"] },
    { label: "管理讨论", entry: "/course/discussion/review", expect: ["讨论列表"] },
    { label: "管理试卷总览", entry: "/exam-paper/index", expect: ["试卷", "阅卷管理"] },
    { label: "管理题库", entry: "/exam-paper/question-bank", expect: ["题库管理"] },
    { label: "管理 AI App", entry: "/ai-app/workspace", expect: ["AI"] },
    { label: "管理考核", entry: "/course/assessment", expect: ["考核"] }
  ],
  deep: [
    {
      label: "学生试卷列表",
      entry: "/student-exam-center/list",
      demoRole: "student",
      expect: ["试题试卷中心", "可答题"]
    },
    {
      label: "学生试卷详情",
      entry: "/student-exam-center/detail/1",
      demoRole: "student",
      expect: ["试卷详情", "开始答题"]
    },
    {
      label: "学生答题页",
      entry: "/student-exam-center/do/1",
      demoRole: "student",
      expect: ["答题卡", "交卷"]
    },
    {
      label: "学生考试结果",
      entry: "/exam-paper/result/1",
      demoRole: "student",
      expect: ["考试结果", "答题明细"]
    },
    {
      label: "教师阅卷详情",
      entry: "/exam-paper/grading/1",
      demoRole: "teacher",
      expect: ["学生列表", "提交评分"]
    },
    {
      label: "教师新建试卷",
      entry: "/exam-paper/editor",
      demoRole: "teacher",
      expect: ["启明在线组卷", "题目"]
    },
    {
      label: "教师编辑试卷",
      entry: "/exam-paper/editor/1",
      demoRole: "teacher",
      expect: ["启明在线组卷", "题目"]
    }
  ]
};

const args = process.argv.slice(2);
const command = args[0] && !args[0].startsWith("-") ? args.shift() : "run";
const flags = parseFlags(args);

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  if (command === "build") {
    buildApp();
    return;
  }
  if (command === "install") {
    buildApp();
    installApp(resolveDeviceId());
    return;
  }
  if (command === "launch") {
    launchApp(resolveDeviceId(), getEntry(), getDemoRole());
    return;
  }
  if (command === "screenshot") {
    screenshot(resolveDeviceId(), resolveOutputPath(getString("output", "artifacts/ios-simulator/ios-native.png")));
    return;
  }
  if (command === "diagnostics") {
    const output = resolveOutputPath(getString("output", "artifacts/ios-simulator/ios-native.png"));
    collectDiagnostics(resolveDeviceId(), output, Date.now() - getNumber("last", 180) * 1000);
    return;
  }
  if (command === "smoke") {
    buildApp();
    const deviceId = resolveDeviceId();
    installApp(deviceId);
    runSmoke(deviceId);
    return;
  }
  if (command === "run") {
    buildApp();
    const deviceId = resolveDeviceId();
    installApp(deviceId);
    const launchStartedAt = Date.now();
    launchApp(deviceId, getEntry(), getDemoRole());
    const output = flags.output
      ? resolveOutputPath(String(flags.output))
      : join(repoRoot, "artifacts", "ios-simulator", `${getDemoRole()}-${slugRoute(getEntry())}-native.png`);
    wait(getNumber("wait", 12) * 1000);
    screenshot(deviceId, output);
    collectDiagnostics(deviceId, output, launchStartedAt);
    console.log(`iOS native screenshot: ${output}`);
    return;
  }

  throw new Error(`Unknown ios native simulator command: ${command}`);
}

function buildApp() {
  ensureFile(join(resourceSource, "index.html"), "Offline bundle is missing. Run pnpm native:prepare first.");
  rmSync(appPath, { recursive: true, force: true });
  mkdirSync(appPath, { recursive: true });
  cpSync(resourceSource, resourceTarget, { recursive: true });
  copyFileSync(join(iosRoot, "Resources", "Info.plist"), join(appPath, "Info.plist"));
  writeFileSync(join(appPath, "PkgInfo"), "APPL????");

  const sdkPath = capture("xcrun", ["--sdk", "iphonesimulator", "--show-sdk-path"]);
  const sourceFiles = [
    join(iosRoot, "Sources", "QimingApp", "AppDelegate.swift"),
    join(iosRoot, "Sources", "QimingApp", "SceneDelegate.swift"),
    join(iosRoot, "Sources", "QimingApp", "QimingWebViewController.swift")
  ];
  run("xcrun", [
    "swiftc",
    "-sdk",
    sdkPath,
    "-target",
    "arm64-apple-ios17.0-simulator",
    "-module-name",
    "QimingIntellEdu",
    "-O",
    "-emit-executable",
    "-o",
    join(appPath, appName),
    ...sourceFiles
  ]);
  run("codesign", [
    "--force",
    "--sign",
    "-",
    "--entitlements",
    join(iosRoot, "Resources", "Entitlements.plist"),
    appPath
  ]);
  console.log(`Built iOS native app: ${appPath}`);
}

function installApp(deviceId) {
  run("xcrun", ["simctl", "uninstall", deviceId, bundleId], { allowFailure: true });
  run("xcrun", ["simctl", "install", deviceId, appPath]);
  console.log(`Installed ${bundleId} on ${deviceId}`);
}

function launchApp(deviceId, entry, role) {
  run("xcrun", ["simctl", "terminate", deviceId, bundleId], { allowFailure: true });
    run("xcrun", [
      "simctl",
      "launch",
      deviceId,
      bundleId,
      "--entry",
      entry,
      "--demoRole",
      role,
      ...testScriptLaunchArgs()
    ]);
  console.log(`Launched ${bundleId}: role=${role} entry=${entry}`);
}

function screenshot(deviceId, outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });
  const tempPath = join(tmpdir(), `qiming-ios-${Date.now()}-${Math.random().toString(16).slice(2)}.png`);
  run("xcrun", ["simctl", "io", deviceId, "screenshot", tempPath]);
  copyFileSync(tempPath, outputPath);
  rmSync(tempPath, { force: true });
}

function runSmoke(deviceId) {
  const cases = collectSmokeCases();
  const outputDir = resolveOutputPath(getString("output-dir", "artifacts/ios-simulator/native-smoke"));
  const waitSeconds = getNumber("wait", 12);
  const results = [];
  for (const [index, item] of cases.entries()) {
    const launchStartedAt = Date.now();
    launchApp(deviceId, item.entry, item.role);
    wait(waitSeconds * 1000);
    const outputPath = join(
      outputDir,
      `${String(index + 1).padStart(2, "0")}-${item.role}-${slugRoute(item.entry)}.png`
    );
    screenshot(deviceId, outputPath);
    const diagnostics = collectDiagnostics(deviceId, outputPath, launchStartedAt);
    console.log(`Smoke screenshot: ${outputPath}`);
    const result = evaluateSmokeCase(item, outputPath, diagnostics);
    results.push(result);
    const details = result.failures.length ? `: ${result.failures.join("; ")}` : "";
    console.log(`${result.status} [${item.role}] ${item.label}${details}`);
  }
  const failures = results.filter(result => result.status === "FAIL");
  writeFileSync(
    join(outputDir, "summary.json"),
    `${JSON.stringify({ results }, null, 2)}\n`
  );
  console.log(`iOS native smoke summary: ${results.length - failures.length} OK, ${failures.length} FAIL`);
  if (failures.length) {
    throw new Error(
      `iOS native smoke failed: ${failures
        .map(result => `[${result.role}] ${result.label}`)
        .join(", ")}`
    );
  }
}

function collectDiagnostics(deviceId, screenshotPath, startedAtMs) {
  const basePath = screenshotPath.replace(/\.[^.]+$/, "");
  const outputDir = dirname(screenshotPath);
  mkdirSync(outputDir, { recursive: true });

  const webviewPath = `${basePath}.webview.jsonl`;
  const simlogPath = `${basePath}.simlog.txt`;
  copyWebViewDiagnostics(deviceId, webviewPath);
  writeSimulatorLog(deviceId, simlogPath, startedAtMs);
  copyCrashReports(join(outputDir, "crashes"), startedAtMs);
  return { webviewPath, simlogPath };
}

function copyWebViewDiagnostics(deviceId, outputPath) {
  try {
    const dataContainer = capture("xcrun", [
      "simctl",
      "get_app_container",
      deviceId,
      bundleId,
      "data"
    ]);
    const diagnosticsPath = join(dataContainer, "Library", "Caches", "qiming-native-diagnostics.jsonl");
    if (!existsSync(diagnosticsPath)) {
      console.warn(`WebView diagnostics not found: ${diagnosticsPath}`);
      return;
    }
    copyFileSync(diagnosticsPath, outputPath);
    console.log(`WebView diagnostics: ${outputPath}`);
  } catch (error) {
    console.warn(`Could not collect WebView diagnostics: ${formatError(error)}`);
  }
}

function writeSimulatorLog(deviceId, outputPath, startedAtMs) {
  const seconds = Math.max(30, Math.ceil((Date.now() - startedAtMs) / 1000) + 20);
  const predicate = [
    'eventMessage CONTAINS[c] "[QimingNative]"',
    'eventMessage CONTAINS[c] "[QimingNativeScheme]"',
    'subsystem == "cn.intelledu.qiming.native"'
  ].join(" OR ");
  const result = spawnSync(
    "xcrun",
    [
      "simctl",
      "spawn",
      deviceId,
      "log",
      "show",
      "--style",
      "compact",
      "--last",
      `${seconds}s`,
      "--predicate",
      predicate
    ],
    { cwd: repoRoot, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }
  );
  const body = [
    result.stdout || "",
    result.stderr ? `\n--- stderr ---\n${result.stderr}` : ""
  ].join("");
  writeFileSync(outputPath, body || "(no simulator diagnostics log output)\n");
  console.log(`Simulator diagnostics log: ${outputPath}`);
}

function copyCrashReports(outputDir, startedAtMs) {
  const reportsDir = join(process.env.HOME || "", "Library", "Logs", "DiagnosticReports");
  if (!reportsDir || !existsSync(reportsDir)) return;
  mkdirSync(outputDir, { recursive: true });

  const startedAtSeconds = Math.floor(startedAtMs / 1000) - 10;
  const copied = [];
  for (const name of readdirSync(reportsDir)) {
    if (!/^QimingIntellEdu.*\.(ips|crash)$/.test(name)) continue;
    const source = join(reportsDir, name);
    const stat = statSync(source);
    if (Math.floor(stat.mtimeMs / 1000) < startedAtSeconds) continue;
    const target = join(outputDir, name);
    copyFileSync(source, target);
    copied.push(target);
  }
  if (copied.length) {
    console.log(`Crash reports: ${copied.join(", ")}`);
  } else {
    writeFileSync(join(outputDir, "NO_RECENT_QIMING_CRASHES.txt"), "No recent QimingIntellEdu crash reports were found for this run.\n");
  }
}

function collectSmokeCases() {
  const roles = getString("roles", defaultSmokeRoles)
    .split(",")
    .map(role => role.trim())
    .filter(Boolean);
  const cases = roles.flatMap(role =>
    (routeSuites[role] || []).map(route => ({
      ...route,
      suite: role,
      role: route.demoRole || role
    }))
  );
  if (!cases.length) {
    throw new Error(`No iOS smoke cases matched --roles=${roles.join(",")}`);
  }
  return cases;
}

function evaluateSmokeCase(item, screenshotPath, diagnostics) {
  const events = readDiagnostics(diagnostics.webviewPath);
  const latestProbe = [...events].reverse().find(event => event.type === "web-probe");
  const probe = parseProbePayload(latestProbe?.payload);
  const webMessages = events
    .filter(event => event.type === "web-message" && event.payload?.type)
    .map(event => event.payload);
  const failures = [];
  const consoleErrors = webMessages.filter(event => event.type === "console.error");
  const runtimeErrors = webMessages.filter(event => event.type === "error");
  const resourceErrors = webMessages.filter(event => event.type === "resource-error");
  const unhandledRejections = webMessages.filter(event => event.type === "unhandledrejection");
  const fetchErrors = webMessages.filter(event => event.type === "fetch-error");
  const probeErrors = events.filter(event => event.type === "web-probe-error");
  const testScriptErrors = events.filter(event => event.type === "test-script-error");
  const testScriptFailures = events.filter(event => {
    if (event.type !== "test-script") return false;
    const result = event.payload?.result ?? event.payload;
    return result && typeof result === "object" && result.ok === false;
  });

  if (!events.length) failures.push("missing WebView diagnostics");
  if (!probe) failures.push("missing DOM probe");
  if (consoleErrors.length) failures.push(`${consoleErrors.length} console error(s)`);
  if (runtimeErrors.length) failures.push(`${runtimeErrors.length} runtime error(s)`);
  if (resourceErrors.length) failures.push(`${resourceErrors.length} resource error(s)`);
  if (unhandledRejections.length) failures.push(`${unhandledRejections.length} unhandled rejection(s)`);
  if (fetchErrors.length) failures.push(`${fetchErrors.length} fetch error(s)`);
  if (probeErrors.length) failures.push(`${probeErrors.length} probe error(s)`);
  if (testScriptErrors.length) failures.push(`${testScriptErrors.length} test script error(s)`);
  if (testScriptFailures.length) failures.push(`${testScriptFailures.length} test script failure(s)`);

  if (probe) {
    const appText = probe.appText || "";
    const appBox = probe.appBox || {};
    if (!probe.htmlClass?.includes("qiming-native-webview")) {
      failures.push("missing qiming-native-webview class");
    }
    if (probe.loaderVisible) failures.push("loader still visible");
    if (!appText || appText.length < 20) failures.push("visible text is too short");
    if ((appBox.height || 0) < 300) failures.push("app content height is too small");
    for (const expected of item.expect || []) {
      if (!appText.includes(expected) && !String(probe.title || "").includes(expected)) {
        failures.push(`expected text missing: ${expected}`);
      }
    }
  }

  return {
    label: item.label,
    role: item.role,
    suite: item.suite,
    entry: item.entry,
    status: failures.length ? "FAIL" : "OK",
    failures,
    screenshot: screenshotPath,
    diagnostics,
    probe
  };
}

function readDiagnostics(path) {
  if (!existsSync(path)) return [];
  const text = captureFile(path);
  return text
    .split(/\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .flatMap(line => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function parseProbePayload(payload) {
  if (!payload) return null;
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }
  return payload;
}

function resolveDeviceId() {
  const explicit = getString("device-id", "");
  if (explicit) return explicit;

  const booted = capture("xcrun", ["simctl", "list", "devices", "booted"]);
  const bootedMatch = booted.match(new RegExp(`${escapeRegExp(defaultDeviceName)} \\(([0-9A-F-]+)\\) \\(Booted\\)`));
  if (bootedMatch) return bootedMatch[1];

  const firstBooted = booted.match(/\(([0-9A-F-]{20,})\) \(Booted\)/);
  if (firstBooted) return firstBooted[1];

  throw new Error("No booted iOS simulator found. Boot an iPhone simulator or pass --device-id <UDID>.");
}

function getEntry() {
  return getString("entry", "/welcome/index");
}

function getDemoRole() {
  const role = getString("demo-role", getString("demoRole", "teacher"));
  return ["student", "teacher", "admin"].includes(role) ? role : "teacher";
}

function testScriptLaunchArgs() {
  const script = resolveTestScript();
  return script ? ["--test-script", script] : [];
}

function resolveTestScript() {
  const inline = getString("test-script", "");
  if (inline) return inline;
  const file = getString("test-script-file", "");
  if (!file) return "";
  return captureFile(resolve(repoRoot, file));
}

function resolveOutputPath(value) {
  return resolve(repoRoot, value);
}

function parseFlags(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function getString(name, fallback) {
  const value = flags[name];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getNumber(name, fallback) {
  const value = Number(flags[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function slugRoute(route) {
  return route
    .replace(/^\//, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "root";
}

function ensureFile(path, message) {
  if (!existsSync(path)) throw new Error(message);
}

function capture(commandName, commandArgs) {
  const result = spawnSync(commandName, commandArgs, { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `${commandName} failed`).trim());
  }
  return result.stdout.trim();
}

function captureFile(path) {
  return readFileSync(path, "utf8");
}

function run(commandName, commandArgs, options = {}) {
  const result = spawnSync(commandName, commandArgs, { cwd: repoRoot, stdio: "inherit" });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${commandName} ${commandArgs.join(" ")} failed with exit code ${result.status}`);
  }
}

function wait(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
