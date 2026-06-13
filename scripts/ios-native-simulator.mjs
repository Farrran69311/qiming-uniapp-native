#!/usr/bin/env node
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
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
    role
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
  const cases = [
    { role: "teacher", entry: "/welcome/index" },
    { role: "admin", entry: "/welcome/index" },
    { role: "student", entry: "/account?menu=home" },
    { role: "student", entry: "/exam-paper/result/1" }
  ];
  const outputDir = resolveOutputPath(getString("output-dir", "artifacts/ios-simulator/native-smoke"));
  const waitSeconds = getNumber("wait", 12);
  for (const item of cases) {
    const launchStartedAt = Date.now();
    launchApp(deviceId, item.entry, item.role);
    wait(waitSeconds * 1000);
    const outputPath = join(outputDir, `${item.role}-${slugRoute(item.entry)}.png`);
    screenshot(deviceId, outputPath);
    collectDiagnostics(deviceId, outputPath, launchStartedAt);
    console.log(`Smoke screenshot: ${outputPath}`);
  }
}

function collectDiagnostics(deviceId, screenshotPath, startedAtMs) {
  const basePath = screenshotPath.replace(/\.[^.]+$/, "");
  const outputDir = dirname(screenshotPath);
  mkdirSync(outputDir, { recursive: true });

  copyWebViewDiagnostics(deviceId, `${basePath}.webview.jsonl`);
  writeSimulatorLog(deviceId, `${basePath}.simlog.txt`, startedAtMs);
  copyCrashReports(join(outputDir, "crashes"), startedAtMs);
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
