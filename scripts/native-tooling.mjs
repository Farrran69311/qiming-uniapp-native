#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nativeProject = join(repoRoot, "native-app");
const platform = process.platform;
const isWindows = platform === "win32";
const defaultWindowsToolsRoot = "G:\\qiming-uniapp-native-tools";
const defaultMacToolsRoot = "/Volumes/KINGSTON/qiming-uniapp-native-tools";

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const raw = arg.slice(2);
    const equalsIndex = raw.indexOf("=");
    if (equalsIndex !== -1) {
      flags[raw.slice(0, equalsIndex)] = raw.slice(equalsIndex + 1);
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
  return { flags, positional };
}

function option(flags, name, fallback = "") {
  const value = flags[name];
  if (value === undefined || value === true) return fallback;
  return String(value);
}

function boolOption(flags, name) {
  return flags[name] === true || flags[name] === "true" || flags[name] === "1";
}

function run(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    encoding: "utf8",
    env: options.env || process.env,
    shell: false,
    timeout: options.timeoutMs
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  return {
    status: result.status ?? (result.error ? 1 : 0),
    output,
    error: result.error
  };
}

function shellQuote(value) {
  if (isWindows) return `"${String(value).replace(/"/g, '\\"')}"`;
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function commandExists(command) {
  if (isWindows) {
    return run("where", [command], { timeoutMs: 8000 }).status === 0;
  }
  return (
    spawnSync("sh", ["-lc", `command -v ${shellQuote(command)}`], {
      encoding: "utf8",
      timeout: 8000
    }).status === 0
  );
}

function which(command) {
  if (isWindows) {
    const result = run("where", [command], { timeoutMs: 8000 });
    if (result.status !== 0) return "";
    return result.output.split(/\r?\n/).find(Boolean) || "";
  }
  const result = spawnSync("sh", ["-lc", `command -v ${shellQuote(command)}`], {
    encoding: "utf8",
    timeout: 8000
  });
  if (result.status !== 0) return "";
  return String(result.stdout || "")
    .trim()
    .split(/\r?\n/)
    .find(Boolean) || "";
}

function pathCandidates(...items) {
  return items.flat().filter(Boolean);
}

function firstExisting(paths) {
  return paths.find(pathValue => pathValue && existsSync(pathValue)) || "";
}

function getToolsRoot() {
  return (
    process.env.QIMING_NATIVE_TOOLS_ROOT ||
    (isWindows ? defaultWindowsToolsRoot : defaultMacToolsRoot)
  );
}

function getHBuilderCli() {
  if (process.env.QIMING_HBUILDERX_CLI) {
    return process.env.QIMING_HBUILDERX_CLI;
  }
  const toolsRoot = getToolsRoot();
  if (isWindows) {
    return join(toolsRoot, "HBuilderX-5.07", "HBuilderX", "cli.exe");
  }
  return firstExisting(
    pathCandidates(
      join(toolsRoot, "HBuilderX.app", "Contents", "MacOS", "cli"),
      join(toolsRoot, "HBuilderX", "HBuilderX.app", "Contents", "MacOS", "cli"),
      "/Applications/HBuilderX.app/Contents/MacOS/cli",
      "/Applications/HBuilderX/HBuilderX.app/Contents/MacOS/cli",
      which("cli")
    )
  );
}

function getAdb() {
  if (process.env.QIMING_ADB) return process.env.QIMING_ADB;
  const toolsRoot = getToolsRoot();
  if (isWindows) {
    return join(toolsRoot, "android-sdk", "platform-tools", "adb.exe");
  }
  return firstExisting(
    pathCandidates(
      join(toolsRoot, "android-sdk", "platform-tools", "adb"),
      `${process.env.ANDROID_HOME || ""}/platform-tools/adb`,
      `${process.env.ANDROID_SDK_ROOT || ""}/platform-tools/adb`,
      which("adb")
    )
  );
}

function printRows(rows) {
  const headers = ["Name", "Status", "Detail"];
  const widths = headers.map((header, column) =>
    Math.max(
      header.length,
      ...rows.map(row => String(row[column] || "").length)
    )
  );
  const line = values =>
    values
      .map((value, index) => String(value || "").padEnd(widths[index]))
      .join("  ");
  console.log(line(headers));
  console.log(line(widths.map(width => "-".repeat(width))));
  for (const row of rows) console.log(line(row));
}

function summarize(label, checks) {
  printRows(checks.map(item => [item.name, item.status, item.detail]));
  const ok = checks.filter(item => item.status === "OK").length;
  const warn = checks.filter(item => item.status === "WARN").length;
  const fail = checks.filter(item => item.status === "FAIL").length;
  console.log("");
  console.log(`${label} summary: ${ok} OK, ${warn} WARN, ${fail} FAIL`);
  return { ok, warn, fail };
}

function addCheck(checks, name, status, detail) {
  checks.push({ name, status, detail: String(detail || "") });
}

function readJson(pathValue) {
  return JSON.parse(readFileSync(pathValue, "utf8"));
}

function writeJson(pathValue, value) {
  writeFileSync(pathValue, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function missingValue(value) {
  if (value === null || value === undefined) return true;
  const text = String(value);
  return text.trim() === "" || text.includes("CHANGE_ME");
}

function getConfigValue(configValue, envName) {
  const envValue = process.env[envName];
  if (!missingValue(envValue)) {
    return { value: envValue, source: "env" };
  }
  return { value: configValue, source: "config" };
}

function splitPlatforms(value) {
  return String(value || "android,ios")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function valueCheck(checks, name, value, okDetail, warnDetail) {
  addCheck(
    checks,
    name,
    missingValue(value) ? "WARN" : "OK",
    missingValue(value) ? warnDetail : okDetail
  );
}

function fileCheck(checks, name, pathValue, missingDetail) {
  if (missingValue(pathValue)) {
    addCheck(checks, name, "WARN", missingDetail);
  } else if (existsSync(String(pathValue))) {
    addCheck(checks, name, "OK", String(pathValue));
  } else {
    addCheck(checks, name, "WARN", `file not found: ${pathValue}`);
  }
}

function findFiles(root, predicate, limit = 100) {
  const output = [];
  const stack = [root];
  while (stack.length && output.length < limit) {
    const current = stack.pop();
    if (!current || !existsSync(current)) continue;
    let entries = [];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const entryPath = join(current, entry.name);
      if (entry.isDirectory()) {
        if (![".git", "node_modules", "dist"].includes(entry.name)) {
          stack.push(entryPath);
        }
      } else if (predicate(entryPath)) {
        output.push(entryPath);
        if (output.length >= limit) break;
      }
    }
  }
  return output;
}

async function isPortListening(port) {
  return new Promise(resolveResult => {
    const server = createServer();
    server.once("error", () => resolveResult(true));
    server.once("listening", () => {
      server.close(() => resolveResult(false));
    });
    server.listen(port, "0.0.0.0");
  });
}

function startDetachedWithLogs(name, cwd, commandArgs, outFile, errFile) {
  rmSync(outFile, { force: true });
  rmSync(errFile, { force: true });
  const stdout = openSync(outFile, "a");
  const stderr = openSync(errFile, "a");
  const child = spawn("pnpm", commandArgs, {
    cwd,
    detached: true,
    shell: isWindows,
    stdio: ["ignore", stdout, stderr]
  });
  child.on("error", error => {
    throw new Error(`Failed to start ${name}: ${error.message}`);
  });
  child.unref();
  console.log(`Started ${name} on pid ${child.pid}.`);
}

async function commandPreview(flags) {
  const role = option(flags, "role", "teacher");
  const entryPath = option(flags, "entry", option(flags, "entry-path", "/welcome/index"));
  const h5Port = Number(option(flags, "h5-port", "8851"));
  const shellPort = Number(option(flags, "shell-port", "8861"));
  const h5Out = join(repoRoot, ".dev-server.out.log");
  const h5Err = join(repoRoot, ".dev-server.err.log");
  const shellOut = join(repoRoot, ".native-dev.out.log");
  const shellErr = join(repoRoot, ".native-dev.err.log");

  if (!(await isPortListening(h5Port))) {
    startDetachedWithLogs(
      "H5 app",
      repoRoot,
      ["dev", "--host", "0.0.0.0", "--port", String(h5Port)],
      h5Out,
      h5Err
    );
  } else {
    console.log(`H5 app already appears to be running on port ${h5Port}.`);
  }

  if (!(await isPortListening(shellPort))) {
    startDetachedWithLogs(
      "uni-app shell",
      nativeProject,
      ["dev:h5", "--host", "0.0.0.0", "--port", String(shellPort)],
      shellOut,
      shellErr
    );
  } else {
    console.log(`uni-app shell already appears to be running on port ${shellPort}.`);
  }

  const encodedEntry = encodeURIComponent(entryPath);
  console.log("");
  console.log("Live native preview:");
  console.log(`  http://localhost:${shellPort}/?demoRole=${role}&entry=${encodedEntry}`);
  console.log("");
  console.log("Logs:");
  console.log(`  ${h5Out}`);
  console.log(`  ${h5Err}`);
  console.log(`  ${shellOut}`);
  console.log(`  ${shellErr}`);
}

function commandPackConfig(flags) {
  const mode = option(flags, "mode", "check");
  const force = boolOption(flags, "force");
  const strict = boolOption(flags, "strict");
  const platformOption = option(flags, "platform", "android,ios");
  const examplePath = join(nativeProject, "pack-config.example.json");
  const configPath = join(nativeProject, "pack-config.local.json");
  const manifestPath = join(nativeProject, "src", "manifest.json");
  const checks = [];

  if (mode === "init") {
    if (!existsSync(examplePath)) {
      throw new Error(`Missing example pack config: ${examplePath}`);
    }
    if (existsSync(configPath) && !force) {
      console.log(`Local pack config already exists: ${configPath}`);
    } else {
      copyFileSync(examplePath, configPath);
      console.log(`Created local pack config: ${configPath}`);
    }
  } else if (mode !== "check") {
    throw new Error(`Unknown pack-config mode: ${mode}`);
  }

  if (!existsSync(configPath)) {
    addCheck(checks, "pack config file", "WARN", "missing; run pnpm native:pack:init");
    const summary = summarize("Pack config", checks);
    if (strict || summary.fail > 0) process.exit(1);
    return;
  }

  addCheck(checks, "pack config file", "OK", configPath);
  let config = null;
  let manifest = null;

  try {
    config = readJson(configPath);
    addCheck(checks, "pack config JSON", "OK", "valid JSON");
  } catch (error) {
    addCheck(checks, "pack config JSON", "FAIL", error.message);
  }

  try {
    manifest = readJson(manifestPath);
    addCheck(checks, "manifest JSON", "OK", "valid JSON");
  } catch (error) {
    addCheck(checks, "manifest JSON", "FAIL", error.message);
  }

  if (manifest) {
    const appidConfig = getConfigValue(manifest.appid, "QIMING_DCLOUD_APPID");
    const appid = String(appidConfig.value || "");
    if (missingValue(appid) || appid === "__UNI__QIMING" || !appid.startsWith("__UNI__")) {
      addCheck(
        checks,
        "DCloud AppID",
        "WARN",
        "replace manifest appid with a registered DCloud __UNI__ appid"
      );
    } else {
      addCheck(
        checks,
        "DCloud AppID",
        "OK",
        appidConfig.source === "env" ? "configured via env" : appid
      );
    }
  }

  if (config && manifest) {
    const platforms = splitPlatforms(platformOption);
    if (platforms.includes("android")) {
      const android = config.android;
      const manifestAndroid = manifest["app-plus"]?.distribute?.android || {};
      if (!android) {
        addCheck(checks, "android config", "FAIL", "missing android config block");
      } else {
        const packageName = String(android.packagename || "");
        valueCheck(checks, "android package", packageName, packageName, "android.packagename is required");
        const manifestPackage = String(manifestAndroid.packagename || "");
        if (!missingValue(packageName) && !missingValue(manifestPackage)) {
          addCheck(
            checks,
            "android package match",
            packageName === manifestPackage ? "OK" : "WARN",
            packageName === manifestPackage
              ? manifestPackage
              : `config ${packageName} differs from manifest ${manifestPackage}`
          );
        }
        addCheck(
          checks,
          "android cert mode",
          Number(android.androidpacktype) === 0 ? "OK" : "WARN",
          Number(android.androidpacktype) === 0
            ? "own certificate"
            : "expected androidpacktype 0 for own release certificate"
        );
        fileCheck(checks, "android certfile", android.certfile, "android.certfile is required");
        valueCheck(
          checks,
          "android certalias",
          android.certalias,
          String(android.certalias || ""),
          "android.certalias is required"
        );
        const certPassword = getConfigValue(android.certpassword, "QIMING_ANDROID_CERT_PASSWORD");
        const storePassword = getConfigValue(android.storepassword, "QIMING_ANDROID_STORE_PASSWORD");
        if (missingValue(certPassword.value) || missingValue(storePassword.value)) {
          addCheck(
            checks,
            "android passwords",
            "WARN",
            "android certpassword/storepassword are missing or placeholders"
          );
        } else {
          addCheck(
            checks,
            "android passwords",
            "OK",
            certPassword.source === "env" || storePassword.source === "env"
              ? "configured via env"
              : "configured"
          );
        }
      }
    }

    if (platforms.includes("ios")) {
      const ios = config.ios;
      const manifestIos = manifest["app-plus"]?.distribute?.ios || {};
      if (!ios) {
        addCheck(checks, "ios config", "FAIL", "missing ios config block");
      } else {
        const bundle = String(ios.bundle || "");
        valueCheck(checks, "ios bundle", bundle, bundle, "ios.bundle is required");
        const manifestBundle = String(manifestIos.bundleIdentifier || "");
        if (!missingValue(bundle) && !missingValue(manifestBundle)) {
          addCheck(
            checks,
            "ios bundle match",
            bundle === manifestBundle ? "OK" : "WARN",
            bundle === manifestBundle
              ? manifestBundle
              : `config ${bundle} differs from manifest ${manifestBundle}`
          );
        }
        fileCheck(checks, "ios profile", ios.profile, "ios.profile .mobileprovision path is required");
        fileCheck(checks, "ios certfile", ios.certfile, "ios.certfile .p12 path is required");
        const iosPassword = getConfigValue(ios.certpassword, "QIMING_IOS_CERT_PASSWORD");
        valueCheck(
          checks,
          "ios certpassword",
          iosPassword.value,
          iosPassword.source === "env" ? "configured via env" : "configured",
          "ios.certpassword is missing or placeholder"
        );
      }
    }
  }

  const summary = summarize("Pack config", checks);
  if (summary.fail > 0 || (strict && summary.warn > 0)) process.exit(1);
}

async function commandDevices(flags) {
  const target = option(flags, "platform", "all");
  const timeoutMs = Number(option(flags, "timeout", "20")) * 1000;
  const checks = [];
  const hbuilderCli = getHBuilderCli();
  const adb = getAdb();

  if (hbuilderCli && existsSync(hbuilderCli)) {
    addCheck(checks, "HBuilderX CLI", "OK", hbuilderCli);
  } else {
    addCheck(
      checks,
      "HBuilderX CLI",
      "WARN",
      "missing; set QIMING_HBUILDERX_CLI or install HBuilderX"
    );
  }

  if (target === "all" || target === "android") {
    if (adb && existsSync(adb)) {
      const adbResult = run(adb, ["devices", "-l"], { timeoutMs });
      const lines = adbResult.output
        .split(/\r?\n/)
        .filter(line => /\bdevice\b/.test(line) && !/List of devices/.test(line));
      const physical = lines.filter(line => !line.startsWith("emulator-"));
      addCheck(
        checks,
        "ADB android devices",
        lines.length > 0 ? "OK" : "WARN",
        lines.length > 0 ? lines.join("; ") : "no Android device attached"
      );
      addCheck(
        checks,
        "ADB physical devices",
        physical.length > 0 ? "OK" : "WARN",
        physical.length > 0
          ? `${physical.length} physical device(s)`
          : "only emulator/no physical Android device visible to ADB"
      );
    } else {
      addCheck(checks, "ADB", "WARN", "missing; set QIMING_ADB or install Android platform-tools");
    }

    if (hbuilderCli && existsSync(hbuilderCli)) {
      const cliResult = run(hbuilderCli, ["devices", "list", "--platform", "android"], {
        timeoutMs
      });
      const count = countHBuilderDevices(cliResult.output);
      addCheck(
        checks,
        "HBuilderX android devices",
        cliResult.status !== 0 ? "WARN" : count > 0 ? "OK" : "WARN",
        cliResult.status !== 0
          ? cliResult.output || `exit ${cliResult.status}`
          : count > 0
            ? `${count} device(s)`
            : "no device returned by HBuilderX"
      );
    }
  }

  if (target === "all" || target === "ios-iPhone" || target === "ios-simulator") {
    if (isWindows) {
      addCheck(
        checks,
        "iOS devices",
        "WARN",
        "iOS device/simulator launch requires macOS or HBuilderX iOS tooling; current host is Windows."
      );
    } else {
      const xcode = getXcodeStatus();
      addCheck(checks, "Xcode", xcode.status, xcode.detail);
      const simctl = run("xcrun", ["simctl", "list", "devices", "available"], {
        timeoutMs
      });
      const simulatorCount =
        simctl.status === 0
          ? simctl.output
              .split(/\r?\n/)
              .filter(line => /\([0-9A-F-]{20,}\)/i.test(line) && /\(.*\)$/.test(line)).length
          : 0;
      addCheck(
        checks,
        "iOS simulators",
        simulatorCount > 0 ? "OK" : "WARN",
        simctl.status === 0
          ? simulatorCount > 0
            ? `${simulatorCount} available simulator(s)`
            : "no available simulator returned by simctl"
          : simctl.output || "simctl unavailable"
      );
      if (hbuilderCli && existsSync(hbuilderCli)) {
        const iosPlatform = target === "ios-simulator" ? "ios-simulator" : "ios-iPhone";
        const cliResult = run(hbuilderCli, ["devices", "list", "--platform", iosPlatform], {
          timeoutMs
        });
        const count = countHBuilderDevices(cliResult.output);
        addCheck(
          checks,
          `HBuilderX ${iosPlatform} devices`,
          cliResult.status !== 0 ? "WARN" : count > 0 ? "OK" : "WARN",
          cliResult.status !== 0
            ? cliResult.output || `exit ${cliResult.status}`
            : count > 0
              ? `${count} device(s)`
              : "no device returned by HBuilderX"
        );
      }
    }
  }

  const summary = summarize("Native devices", checks);
  if (summary.fail > 0) process.exit(1);
}

function countHBuilderDevices(output) {
  if (!output.trim()) return 0;
  return output
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(
      line =>
        line &&
        !/^\[|\bCLI\b|未检测到已打开的HBuilderX|请先执行cli open|error|failed/i.test(
          line
        )
    ).length;
}

function getXcodeStatus() {
  const select = run("xcode-select", ["-p"], { timeoutMs: 8000 });
  if (select.status !== 0) {
    return { status: "WARN", detail: select.output || "xcode-select is unavailable" };
  }
  const developerDir = select.output.split(/\r?\n/)[0] || "";
  const version = run("xcodebuild", ["-version"], { timeoutMs: 12000 });
  if (version.status !== 0) {
    return {
      status: "WARN",
      detail: `${developerDir}; ${version.output || "xcodebuild unavailable"}`
    };
  }
  if (developerDir.includes("CommandLineTools")) {
    return {
      status: "WARN",
      detail: `${developerDir}; full Xcode is required for iOS simulator/device launch`
    };
  }
  return { status: "OK", detail: version.output.replace(/\r?\n/g, "; ") };
}

async function commandDoctor(flags) {
  const h5Port = Number(option(flags, "h5-port", "8851"));
  const shellPort = Number(option(flags, "shell-port", "8861"));
  const checks = [];
  const hbuilderCli = getHBuilderCli();
  const adb = getAdb();
  const packConfigPath = join(nativeProject, "pack-config.local.json");
  const sourceManifestPath = join(nativeProject, "src", "manifest.json");
  const appManifestPath = join(nativeProject, "dist", "build", "app", "manifest.json");

  const branch = run("git", ["-C", repoRoot, "rev-parse", "--abbrev-ref", "HEAD"]);
  addCheck(
    checks,
    "git branch",
    branch.output === "main" ? "OK" : "WARN",
    branch.output || "unknown"
  );
  const status = run("git", ["-C", repoRoot, "status", "--short"]);
  addCheck(
    checks,
    "git clean",
    status.output ? "WARN" : "OK",
    status.output || "clean"
  );
  addCheck(
    checks,
    `H5 preview port ${h5Port}`,
    (await isPortListening(h5Port)) ? "OK" : "WARN",
    (await isPortListening(h5Port)) ? "listening" : "not listening; run pnpm native:preview"
  );
  addCheck(
    checks,
    `uni shell port ${shellPort}`,
    (await isPortListening(shellPort)) ? "OK" : "WARN",
    (await isPortListening(shellPort)) ? "listening" : "not listening; run pnpm native:preview"
  );
  addCheck(
    checks,
    "HBuilderX CLI",
    hbuilderCli && existsSync(hbuilderCli) ? "OK" : "WARN",
    hbuilderCli || "missing; set QIMING_HBUILDERX_CLI or install HBuilderX"
  );
  const java = which("java");
  addCheck(checks, "Java", java ? "OK" : "WARN", java || "java not found in PATH");
  const keytool = which("keytool");
  addCheck(checks, "Keytool", keytool ? "OK" : "WARN", keytool || "keytool not found in PATH");
  addCheck(
    checks,
    "ADB",
    adb && existsSync(adb) ? "OK" : "WARN",
    adb || "missing; set QIMING_ADB or install Android platform-tools"
  );

  if (hbuilderCli && existsSync(hbuilderCli)) {
    const user = run(hbuilderCli, ["user", "info"], { timeoutMs: 15000 });
    addCheck(
      checks,
      "DCloud login",
      /user info:OK/.test(user.output) ? "OK" : "WARN",
      user.output || "unable to query HBuilderX login"
    );
  } else {
    addCheck(checks, "DCloud login", "WARN", "not checked because HBuilderX CLI is unavailable");
  }

  if (adb && existsSync(adb)) {
    const adbResult = run(adb, ["devices", "-l"], { timeoutMs: 15000 });
    const deviceCount = adbResult.output
      .split(/\r?\n/)
      .filter(line => /\bdevice\b/.test(line) && !/List of devices/.test(line)).length;
    addCheck(
      checks,
      "Android device",
      deviceCount > 0 ? "OK" : "WARN",
      deviceCount > 0 ? `${deviceCount} device(s)` : "no device attached"
    );
  } else {
    addCheck(checks, "Android device", "WARN", "not checked because ADB is unavailable");
  }

  if (existsSync(sourceManifestPath)) {
    try {
      const manifest = readJson(sourceManifestPath);
      const appid = process.env.QIMING_DCLOUD_APPID || manifest.appid;
      const appidDetail = process.env.QIMING_DCLOUD_APPID
        ? "configured via env"
        : appid || "missing manifest appid";
      addCheck(
        checks,
        "DCloud AppID",
        appid && appid !== "__UNI__QIMING" && String(appid).startsWith("__UNI__")
          ? "OK"
          : "WARN",
        appidDetail
      );
    } catch (error) {
      addCheck(checks, "DCloud AppID", "WARN", error.message);
    }
  } else {
    addCheck(checks, "DCloud AppID", "WARN", "missing native-app/src/manifest.json");
  }

  if (existsSync(packConfigPath)) {
    const text = readFileSync(packConfigPath, "utf8");
    addCheck(
      checks,
      "pack-config.local.json",
      /CHANGE_ME/.test(text) ? "WARN" : "OK",
      /CHANGE_ME/.test(text)
        ? "contains placeholders; run pnpm native:pack:check"
        : packConfigPath
    );
  } else {
    addCheck(checks, "pack-config.local.json", "WARN", "missing; run pnpm native:pack:init");
  }

  const certRoots = [
    getToolsRoot(),
    nativeProject,
    repoRoot
  ].filter(Boolean);
  const iosCerts = new Set();
  for (const root of certRoots) {
    for (const file of findFiles(
      root,
      filePath => /\.(p12|mobileprovision)$/i.test(filePath),
      20
    )) {
      iosCerts.add(file);
    }
  }
  addCheck(
    checks,
    "iOS certificates",
    iosCerts.size > 0 ? "OK" : "WARN",
    iosCerts.size > 0 ? `${iosCerts.size} file(s)` : "no .p12/.mobileprovision found"
  );

  if (!isWindows) {
    const xcode = getXcodeStatus();
    addCheck(checks, "Xcode", xcode.status, xcode.detail);
  }

  addCheck(
    checks,
    "App build resource",
    existsSync(appManifestPath) ? "OK" : "WARN",
    existsSync(appManifestPath)
      ? appManifestPath
      : "missing; run pnpm --dir native-app build:app"
  );

  const summary = summarize("Native doctor", checks);
  if (summary.fail > 0) process.exit(1);
}

function buildEffectivePackConfig(config, manifest, platformOption) {
  const output = structuredClone(config);
  const androidCertPassword = process.env.QIMING_ANDROID_CERT_PASSWORD;
  const androidStorePassword = process.env.QIMING_ANDROID_STORE_PASSWORD;
  const iosCertPassword = process.env.QIMING_IOS_CERT_PASSWORD;
  if (androidCertPassword && output.android) output.android.certpassword = androidCertPassword;
  if (androidStorePassword && output.android) output.android.storepassword = androidStorePassword;
  if (iosCertPassword && output.ios) output.ios.certpassword = iosCertPassword;
  output.platform = platformOption;
  return output;
}

function commandPack(flags) {
  const platformOption = option(flags, "platform", "android");
  const skipPrepare = boolOption(flags, "skip-prepare");
  const dryRun = boolOption(flags, "dry-run");
  const hbuilderCli = getHBuilderCli();
  const configPath = join(nativeProject, "pack-config.local.json");
  const examplePath = join(nativeProject, "pack-config.example.json");
  const effectiveConfigPath = join(nativeProject, "pack-config.effective.tmp.json");
  const manifestPath = join(nativeProject, "src", "manifest.json");

  if (!existsSync(nativeProject)) throw new Error(`native app project not found: ${nativeProject}`);
  if (!existsSync(configPath)) {
    throw new Error(
      `Missing local pack config: ${configPath}. Copy ${examplePath} to pack-config.local.json and fill local certificate values.`
    );
  }
  if (!existsSync(manifestPath)) throw new Error(`Native manifest not found: ${manifestPath}`);

  const packConfigResult = spawnSync(
    process.execPath,
    [
      fileURLToPath(import.meta.url),
      "pack-config",
      "--mode",
      "check",
      "--platform",
      platformOption,
      "--strict"
    ],
    { cwd: repoRoot, stdio: "inherit" }
  );
  if (packConfigResult.status !== 0) {
    throw new Error("Native pack config check failed. Fix the WARN/FAIL items above before packaging.");
  }

  const config = readJson(configPath);
  const manifestBytes = readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const dcloudAppid = process.env.QIMING_DCLOUD_APPID;

  try {
    if (dcloudAppid) {
      manifest.appid = dcloudAppid;
      writeJson(manifestPath, manifest);
    }
    writeJson(effectiveConfigPath, buildEffectivePackConfig(config, manifest, platformOption));

    if (dryRun) {
      console.log("Native pack dry run passed. Effective config and temporary manifest changes were generated and will be cleaned up.");
      return;
    }

    if (!hbuilderCli || !existsSync(hbuilderCli)) {
      throw new Error("HBuilderX CLI not found. Set QIMING_HBUILDERX_CLI or install HBuilderX before packaging.");
    }
    if (!skipPrepare) {
      const prepare = spawnSync("pnpm", ["native:prepare"], {
        cwd: repoRoot,
        stdio: "inherit",
        shell: isWindows
      });
      if (prepare.status !== 0) throw new Error("pnpm native:prepare failed.");
    }

    const open = run(hbuilderCli, ["project", "open", "--path", nativeProject], {
      timeoutMs: 30000
    });
    if (open.status !== 0) {
      throw new Error(open.output || "HBuilderX project open failed.");
    }
    const pack = spawnSync(
      hbuilderCli,
      [
        "pack",
        "--project",
        nativeProject,
        "--platform",
        platformOption,
        "--config",
        effectiveConfigPath,
        "--safemode",
        "true",
        "--sourceMap",
        "false"
      ],
      { cwd: repoRoot, stdio: "inherit" }
    );
    if (pack.status !== 0) throw new Error(`HBuilderX pack failed with exit code ${pack.status}.`);
  } finally {
    rmSync(effectiveConfigPath, { force: true });
    if (dcloudAppid) writeFileSync(manifestPath, manifestBytes);
  }
}

function commandRun(flags) {
  const target = option(flags, "platform", "android");
  if (isWindows && commandExists("powershell")) {
    const psArgs = [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      join(repoRoot, "scripts", "run-native.ps1"),
      "-Platform",
      target
    ];
    const passThrough = {
      "device-id": "-DeviceId",
      entry: "-EntryPath",
      "entry-path": "-EntryPath",
      "dev-server": "-DevServer",
      "demo-role": "-DemoRole",
      "launch-timeout": "-LaunchTimeoutSeconds"
    };
    for (const [flag, psName] of Object.entries(passThrough)) {
      const value = option(flags, flag, "");
      if (value) psArgs.push(psName, value);
    }
    if (boolOption(flags, "skip-prepare")) psArgs.push("-SkipPrepare");
    if (boolOption(flags, "native-log")) psArgs.push("-NativeLog");
    const result = spawnSync("powershell", psArgs, { cwd: repoRoot, stdio: "inherit" });
    process.exit(result.status || 0);
  }

  if (target === "android") {
    throw new Error(
      "Android launch automation is currently implemented by scripts/run-native.ps1 on Windows. Use native:devices on macOS for preflight, or run through HBuilderX manually."
    );
  }

  const xcode = getXcodeStatus();
  if (xcode.status !== "OK") {
    throw new Error(`iOS launch is blocked on this host: ${xcode.detail}`);
  }
  const hbuilderCli = getHBuilderCli();
  if (!hbuilderCli || !existsSync(hbuilderCli)) {
    throw new Error("iOS launch requires HBuilderX CLI. Set QIMING_HBUILDERX_CLI after installing HBuilderX.");
  }
  throw new Error(
    "iOS launch preflight passed far enough to require HBuilderX device selection. Use HBuilderX to launch native-app, or extend this script once a simulator/device is available."
  );
}

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));
  const command = positional[0] || "doctor";
  try {
    if (command === "preview") await commandPreview(flags);
    else if (command === "pack-config") commandPackConfig(flags);
    else if (command === "devices") await commandDevices(flags);
    else if (command === "doctor") await commandDoctor(flags);
    else if (command === "pack") commandPack(flags);
    else if (command === "run") commandRun(flags);
    else {
      throw new Error(`Unknown native tooling command: ${command}`);
    }
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}

main();
