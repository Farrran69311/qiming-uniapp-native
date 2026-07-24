#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const args = process.argv.slice(2);

function readArg(name, fallback = "") {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const hasFlag = name => args.includes(name);

const maxActionWaitMs = 120_000;

function normalizeActionStep(step, index, fallbackWaitMs) {
  const label = `action step ${index + 1}`;
  if (!step || typeof step !== "object" || Array.isArray(step)) {
    throw new Error(`${label} must be an object`);
  }

  const allowedKeys = new Set([
    "selector",
    "text",
    "waitMs",
    "afterSelector",
    "afterText"
  ]);
  const unknownKey = Object.keys(step).find(key => !allowedKeys.has(key));
  if (unknownKey) {
    throw new Error(`${label} has unsupported field: ${unknownKey}`);
  }

  if (typeof step.selector !== "string" || !step.selector.trim()) {
    throw new Error(`${label} requires a non-empty selector`);
  }
  if (step.text !== undefined && typeof step.text !== "string") {
    throw new Error(`${label} text must be a string`);
  }
  if (
    step.afterSelector !== undefined &&
    (typeof step.afterSelector !== "string" || !step.afterSelector.trim())
  ) {
    throw new Error(`${label} afterSelector must be a non-empty string`);
  }
  if (
    step.afterText !== undefined &&
    (typeof step.afterText !== "string" || !step.afterText.trim())
  ) {
    throw new Error(`${label} afterText must be a non-empty string`);
  }
  if (step.afterText !== undefined && step.afterSelector === undefined) {
    throw new Error(`${label} afterText requires afterSelector`);
  }

  const stepWaitMs = step.waitMs ?? fallbackWaitMs;
  if (
    !Number.isFinite(stepWaitMs) ||
    stepWaitMs < 0 ||
    stepWaitMs > maxActionWaitMs
  ) {
    throw new Error(`${label} waitMs must be between 0 and ${maxActionWaitMs}`);
  }

  return {
    selector: step.selector,
    text: step.text ?? "",
    waitMs: stepWaitMs,
    afterSelector: step.afterSelector ?? null,
    afterText: step.afterText ?? null
  };
}

function parseActionStepsJson(raw, fallbackWaitMs) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Invalid --actions-json: ${error instanceof Error ? error.message : error}`
    );
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("--actions-json must contain a non-empty action array");
  }
  return parsed.map((step, index) =>
    normalizeActionStep(step, index, fallbackWaitMs)
  );
}

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

function environmentInterruption(message) {
  const text = String(message || "");
  const patterns = [
    [
      "device-unavailable",
      /(?:no devices\/emulators found|device .* not found|device offline|device unauthorized|adb server.*(?:failed|not running)|cannot connect to daemon)/i
    ],
    [
      "android-runtime-stopped",
      /(?:Android runtime is not running|Command failed:.*\bpidof\b)/i
    ],
    [
      "webview-devtools-unavailable",
      /(?:Unable to list WebView targets|No WebView page matched|ECONNREFUSED|fetch failed)/i
    ],
    [
      "cdp-connection-lost",
      /(?:Timed out connecting to|Failed to connect to|CDP WebSocket (?:closed|failed)|WebSocket.*(?:closed|not open)|(?:Runtime|Network)\.(?:enable|evaluate|getResponseBody) timed out|Inspected target.*(?:closed|navigated)|Session closed)/i
    ]
  ];
  const matched = patterns.find(([, pattern]) => pattern.test(text));
  return matched ? { code: matched[0], message: text } : null;
}

function executionFailureReport(error) {
  const message = [
    error instanceof Error ? error.message : String(error || "Unknown error"),
    error && typeof error === "object" ? error.stderr : "",
    error && typeof error === "object" ? error.stdout : ""
  ]
    .filter(Boolean)
    .map(value => String(value).trim())
    .filter(Boolean)
    .join("; ");
  const environment = environmentInterruption(message);
  return {
    capturedAt: new Date().toISOString(),
    auditStatus: environment ? "environment-interrupted" : "runner-error",
    androidPackage: packageName,
    requestedEntry: entry || null,
    environment,
    error: { message }
  };
}

function printUsage() {
  process.stdout.write(
    `Usage: node scripts/android-webview-audit.mjs [options]\n\nOptions:\n  --strict                         Exit non-zero when an audit assertion fails\n  --role <student|teacher|admin>   Seed a real role session before auditing\n  --entry <route>                  Navigate to a hash route before auditing\n  --expect-text <text>             Require page/account body text\n  --ready-expect-text <text>       Require text before a configured action\n  --account-menu-text <text>       Require the active account menu and account body\n  --actions-json <json>            Run a validated action-step array in sequence\n  --action-selector <selector>     Click the first visible matching element\n  --action-text <text>             Optionally narrow --action-selector by text\n  --action-after-selector <css>    Require a visible element after the action\n  --action-after-text <text>       Require text inside the post-action element\n  --required-request-path <path>   Require a successful API response and code 0/200\n  --expect-forbidden               Require the route to resolve to the 403 page\n  --serial <adb-serial>             Target one Android device\n  --port <port>                    Local CDP forwarding port (default: 9223)\n  --url-pattern <text>             WebView target URL pattern\n  --wait-ms <ms>                   Wait after navigation/session seed\n  --post-action-wait-ms <ms>       Default wait after each configured action\n  --min-content-ratio <ratio>      Minimum main-content/viewport width ratio\n  --api-origin <url>               API origin used for real login\n  --out <path>                     Write the JSON report to a file\n  --self-test                      Run pure response-envelope checks and exit\n  -h, --help                       Show this help and exit\n`
  );
  process.stdout.write(
    "  --package <application-id>        Android package owning the WebView\n"
  );
  process.stdout.write(
    "  --expect-compact-digital-human   Require visible 2D and no mounted inline 3D iframe\n"
  );
  process.stdout.write(
    "  --min-usable-content-ratio <n>  Minimum route content width after horizontal padding\n"
  );
}

function runSelfTest() {
  const cases = [
    ["numeric-success", '{"code":200}', true, true, 200],
    ["string-success", '{"code":"0"}', true, true, 0],
    ["business-failure", '{"code":500}', true, true, 500],
    ["missing-code", '{"data":[]}', false, false, undefined],
    ["null-code", '{"code":null}', true, false, null],
    ["non-json", "not-json", false, false, undefined]
  ];
  const failures = cases.flatMap(([name, body, present, valid, code]) => {
    const result = inspectBusinessEnvelope(body);
    return result.businessCodePresent === present &&
      result.businessCodeValid === valid &&
      result.businessCode === code
      ? []
      : [`${name}:${JSON.stringify(result)}`];
  });
  const environmentCases = [
    ["Runtime.enable timed out", "cdp-connection-lost"],
    [
      "Command failed: adb shell pidof io.dcloud.HBuilder",
      "android-runtime-stopped"
    ],
    ["device 'R5CT31RDS6E' not found", "device-unavailable"],
    [
      'No WebView page matched "hybrid/html/index.html". Targets: www/index.html',
      "webview-devtools-unavailable"
    ]
  ];
  for (const [message, expectedCode] of environmentCases) {
    const result = environmentInterruption(message);
    if (result?.code !== expectedCode) {
      failures.push(`${expectedCode}:${JSON.stringify(result)}`);
    }
  }
  if (environmentInterruption("expected text not found: 课程")) {
    failures.push("business failure misclassified as environment interruption");
  }
  const actionSteps = parseActionStepsJson(
    JSON.stringify([
      { selector: ".menu-toggle", text: "", waitMs: 250 },
      {
        selector: ".menu-item",
        text: "账户管理",
        afterSelector: ".account-panel",
        afterText: "修改账户密码"
      }
    ]),
    1200
  );
  if (
    actionSteps.length !== 2 ||
    actionSteps[0].waitMs !== 250 ||
    actionSteps[1].waitMs !== 1200 ||
    actionSteps[1].afterText !== "修改账户密码"
  ) {
    failures.push(
      `action sequence normalization failed:${JSON.stringify(actionSteps)}`
    );
  }
  const invalidActionCases = [
    ["non-array", "{}", "non-empty action array"],
    ["empty-array", "[]", "non-empty action array"],
    ["missing-selector", '[{"text":"设置"}]', "non-empty selector"],
    [
      "after-text-without-selector",
      '[{"selector":".item","afterText":"完成"}]',
      "afterText requires afterSelector"
    ],
    [
      "invalid-wait",
      '[{"selector":".item","waitMs":120001}]',
      "waitMs must be between"
    ],
    [
      "unsupported-field",
      '[{"selector":".item","skip":true}]',
      "unsupported field"
    ]
  ];
  for (const [name, raw, expectedMessage] of invalidActionCases) {
    try {
      parseActionStepsJson(raw, 1000);
      failures.push(`${name} action contract did not throw`);
    } catch (error) {
      if (!String(error).includes(expectedMessage)) {
        failures.push(
          `${name} action contract error was not actionable: ${error}`
        );
      }
    }
  }
  if (failures.length) {
    throw new Error(`Self-test failed: ${failures.join(", ")}`);
  }
  process.stdout.write(
    `android-webview-audit self-test: ${cases.length + environmentCases.length + invalidActionCases.length + 2} passed\n`
  );
}

if (hasFlag("-h") || hasFlag("--help")) {
  printUsage();
  process.exit(0);
}
if (hasFlag("--self-test")) {
  runSelfTest();
  process.exit(0);
}

const adb = process.env.ADB || "adb";
const serial = readArg("--serial");
const packageName = readArg(
  "--package",
  process.env.QIMING_ANDROID_PACKAGE || "io.dcloud.HBuilder"
);
const port = Number(readArg("--port", "9223"));
const urlPattern = readArg("--url-pattern", "hybrid/html/index.html");
const outputPath = readArg("--out");
const minContentRatio = Number(readArg("--min-content-ratio", "0.88"));
const minUsableContentRatio = Number(
  readArg("--min-usable-content-ratio", "0.92")
);
const entry = readArg("--entry");
const expectedText = readArg("--expect-text");
const readyExpectedText = readArg("--ready-expect-text");
const actionsJson = readArg("--actions-json");
const actionSelector = readArg("--action-selector");
const actionText = readArg("--action-text");
const actionAfterSelector = readArg("--action-after-selector");
const actionAfterText = readArg("--action-after-text");
const accountMenuText = readArg("--account-menu-text");
const expectCompactDigitalHuman = hasFlag("--expect-compact-digital-human");
const expectForbidden = hasFlag("--expect-forbidden");
const requiredRequestPath = readArg("--required-request-path");
const postActionWaitMs = Number(readArg("--post-action-wait-ms", "2000"));
const role = readArg("--role");
const apiOrigin = new URL(
  readArg(
    "--api-origin",
    process.env.VITE_API_URL || "https://aiedu-api.intelledu.cn"
  )
).origin;
const waitMs = Number(readArg("--wait-ms", "5000"));
const strict = hasFlag("--strict");

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

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid --port value: ${port}`);
}

if (!/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(packageName)) {
  throw new Error(`Invalid --package value: ${packageName}`);
}

if (
  !Number.isFinite(minContentRatio) ||
  minContentRatio <= 0 ||
  minContentRatio > 1
) {
  throw new Error(`Invalid --min-content-ratio value: ${minContentRatio}`);
}

if (
  !Number.isFinite(minUsableContentRatio) ||
  minUsableContentRatio <= 0 ||
  minUsableContentRatio > 1
) {
  throw new Error(
    `Invalid --min-usable-content-ratio value: ${minUsableContentRatio}`
  );
}

if (!Number.isFinite(waitMs) || waitMs < 0 || waitMs > 120_000) {
  throw new Error(`Invalid --wait-ms value: ${waitMs}`);
}

if (
  !Number.isFinite(postActionWaitMs) ||
  postActionWaitMs < 0 ||
  postActionWaitMs > maxActionWaitMs
) {
  throw new Error(`Invalid --post-action-wait-ms value: ${postActionWaitMs}`);
}

if (role && !roleMeta[role]) {
  throw new Error(`Invalid --role value: ${role}`);
}

if (entry && !entry.startsWith("/")) {
  throw new Error(`--entry must start with /: ${entry}`);
}

if (hasFlag("--actions-json") && !actionsJson) {
  throw new Error("--actions-json requires a JSON value");
}
if (actionsJson && actionSelector) {
  throw new Error("--actions-json cannot be combined with --action-selector");
}
if (!actionSelector && actionText) {
  throw new Error("--action-text requires --action-selector");
}
if (!actionSelector && actionAfterSelector) {
  throw new Error("--action-after-selector requires --action-selector");
}
if (!actionAfterSelector && actionAfterText) {
  throw new Error("--action-after-text requires --action-after-selector");
}

const actionSteps = actionsJson
  ? parseActionStepsJson(actionsJson, postActionWaitMs)
  : actionSelector
    ? [
        normalizeActionStep(
          {
            selector: actionSelector,
            ...(actionText ? { text: actionText } : {}),
            waitMs: postActionWaitMs,
            ...(actionAfterSelector
              ? { afterSelector: actionAfterSelector }
              : {}),
            ...(actionAfterText ? { afterText: actionAfterText } : {})
          },
          0,
          postActionWaitMs
        )
      ]
    : [];
const hasActionSequence = Boolean(actionsJson);

if (requiredRequestPath && !requiredRequestPath.startsWith("/")) {
  throw new Error(
    `--required-request-path must start with /: ${requiredRequestPath}`
  );
}

function runAdb(commandArgs) {
  const serialArgs = serial ? ["-s", serial] : [];
  return execFileSync(adb, [...serialArgs, ...commandArgs], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function connectWebSocket(url) {
  return new Promise((resolveSocket, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`Timed out connecting to ${url}`));
    }, 10_000);

    socket.addEventListener(
      "open",
      () => {
        clearTimeout(timer);
        resolveSocket(socket);
      },
      { once: true }
    );
    socket.addEventListener(
      "error",
      () => {
        clearTimeout(timer);
        reject(new Error(`Failed to connect to ${url}`));
      },
      { once: true }
    );
  });
}

function createCdpClient(socket) {
  let sequence = 0;
  const pending = new Map();

  const rejectPending = error => {
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };

  socket.addEventListener("message", event => {
    const message = JSON.parse(String(event.data));
    if (!message.id || !pending.has(message.id)) return;

    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) {
      request.reject(
        new Error(`${request.method}: ${message.error.message || "CDP error"}`)
      );
      return;
    }
    request.resolve(message.result);
  });
  socket.addEventListener("close", () => {
    rejectPending(new Error("CDP WebSocket closed"));
  });
  socket.addEventListener("error", () => {
    rejectPending(new Error("CDP WebSocket failed"));
  });

  return (method, params = {}) =>
    new Promise((resolveCommand, rejectCommand) => {
      if (socket.readyState !== WebSocket.OPEN) {
        rejectCommand(new Error("CDP WebSocket is not open"));
        return;
      }
      const id = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(id);
        rejectCommand(new Error(`${method} timed out`));
      }, 15_000);

      pending.set(id, {
        method,
        resolve: result => {
          clearTimeout(timer);
          resolveCommand(result);
        },
        reject: error => {
          clearTimeout(timer);
          rejectCommand(error);
        }
      });
      socket.send(JSON.stringify({ id, method, params }));
    });
}

const wait = ms => new Promise(resolveWait => setTimeout(resolveWait, ms));

async function executeActionStep(command, step, index) {
  const actionEvaluation = await command("Runtime.evaluate", {
    expression: `(() => {
      const selector = ${JSON.stringify(step.selector)};
      const expectedText = ${JSON.stringify(step.text)};
      const candidates = Array.from(document.querySelectorAll(selector));
      const target = candidates.find(element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity || 1) > 0.01 &&
          element.getAttribute("aria-hidden") !== "true" &&
          rect.width > 0 &&
          rect.height > 0 &&
          String(element.textContent || "").replace(/\\s+/g, " ").trim().includes(expectedText);
      });
      if (!target) {
        return { ok: false, reason: "target-not-found" };
      }
      target.scrollIntoView({ block: "center", inline: "center" });
      if (typeof target.click === "function") target.click();
      else target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      return {
        ok: true,
        tag: target.tagName.toLowerCase(),
        text: String(target.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 160)
      };
    })()`,
    returnByValue: true
  });
  let result;
  if (actionEvaluation.exceptionDetails) {
    result = {
      ok: false,
      reason:
        actionEvaluation.exceptionDetails.exception?.description ||
        actionEvaluation.exceptionDetails.text ||
        "action-evaluation-failed"
    };
  } else {
    result = actionEvaluation.result?.value || {
      ok: false,
      reason: "action-returned-no-result"
    };
  }
  Object.assign(result, {
    step: index + 1,
    selector: step.selector,
    expectedText: step.text,
    waitMs: step.waitMs,
    afterSelector: step.afterSelector,
    afterText: step.afterText
  });
  if (!result.ok) return result;

  await wait(step.waitMs);
  if (!step.afterSelector) return result;

  const afterEvaluation = await command("Runtime.evaluate", {
    expression: `(() => {
      const selector = ${JSON.stringify(step.afterSelector)};
      const element = Array.from(document.querySelectorAll(selector)).find(element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity || 1) > 0.01 &&
          element.getAttribute("aria-hidden") !== "true" &&
          rect.width > 0 &&
          rect.height > 0;
      });
      return {
        visible: Boolean(element),
        text: String(element?.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 1000)
      };
    })()`,
    returnByValue: true
  });
  if (afterEvaluation.exceptionDetails) {
    result.ok = false;
    result.reason =
      afterEvaluation.exceptionDetails.exception?.description ||
      afterEvaluation.exceptionDetails.text ||
      "after-action-evaluation-failed";
    return result;
  }

  const afterResult = afterEvaluation.result?.value || {
    visible: false,
    text: ""
  };
  result.afterSelectorVisible = afterResult.visible === true;
  result.afterSelectorText = afterResult.text;
  result.afterTextFound =
    !step.afterText || String(afterResult.text).includes(step.afterText);
  if (!result.afterSelectorVisible || !result.afterTextFound) {
    result.ok = false;
    result.reason = result.afterSelectorVisible
      ? "after-text-not-found"
      : "after-selector-not-visible";
  }
  return result;
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init);
  const body = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error(`${url} returned non-JSON: ${body.slice(0, 180)}`);
  }
  if (!response.ok) {
    throw new Error(`${url} failed with HTTP ${response.status}: ${body}`);
  }
  return parsed;
}

async function loginRole(selectedRole) {
  const account = accounts[selectedRole];
  const meta = roleMeta[selectedRole];
  const login = await fetchJson(`${apiOrigin}/edu/v1/user/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(account)
  });
  if (Number(login?.code) !== 200 || !login?.data?.accessToken) {
    throw new Error(
      `Login API rejected ${selectedRole}: ${login?.msg || login?.code}`
    );
  }

  const token = login.data.accessToken;
  const detail = await fetchJson(`${apiOrigin}/edu/v1/user/detail`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: "{}"
  });
  const detailUser = detail?.data?.userInfo || {};
  if (
    Number(detail?.code) !== 200 ||
    Number(detailUser.roleType) !== meta.roleType
  ) {
    throw new Error(
      `User detail role mismatch for ${selectedRole}: ${detailUser.roleType || detail?.code}`
    );
  }

  const expiresValue = Number(login.data.accessExpire || 0);
  const expires =
    expiresValue > 100_000_000_000 ? expiresValue : expiresValue * 1000;
  if (!Number.isFinite(expires) || expires <= Date.now()) {
    throw new Error(`Login returned an expired token for ${selectedRole}`);
  }

  return {
    accessToken: token,
    refreshToken: token,
    expires,
    avatar: detailUser.avatar || "/logo.svg",
    username: detailUser.mobile || account.mobile,
    nickname: detailUser.nickname || meta.label,
    roles: meta.roles,
    permissions: ["*:*:*"],
    roleType: Number(detailUser.roleType),
    userId: Number(detailUser.id || 0)
  };
}

function nativeEntryPath(path) {
  if (!path) return "";
  const url = new URL(path, "https://qiming.local");
  url.searchParams.set("qimingNative", "1");
  url.searchParams.set("_androidAudit", String(Date.now()));
  return `${url.pathname}${url.search}`;
}

const auditExpression = `(() => {
  const round = value => Math.round(value * 100) / 100;
  const visible = element => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity || 1) > 0.01 &&
      element.getAttribute("aria-hidden") !== "true" &&
      rect.width > 0 &&
      rect.height > 0;
  };
  const describe = element => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      tag: element.tagName.toLowerCase(),
      id: element.id || "",
      className: typeof element.className === "string" ? element.className.slice(0, 180) : "",
      left: round(rect.left),
      right: round(rect.right),
      top: round(rect.top),
      width: round(rect.width),
      height: round(rect.height),
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      overflowX: style.overflowX
    };
  };
  const selectors = [
    "html",
    "body",
    ".app-main",
    ".app-main-nofixed-header",
    ".el-scrollbar__wrap",
    ".el-scrollbar__view",
    ".course-detail-root .el-scrollbar__wrap",
    ".course-detail-root",
    ".layout-inner-content",
    ".study-container",
    ".rightTreeWarp",
    ".out-ai-showbox-pro",
    ".ai-draggable-dialog",
    ".exam-do-container",
    ".exam-main",
    ".exam-result-page",
    ".main-content",
    ".account-main",
    ".ai-app-root",
    ".course-detail-page",
    ".course-detail-container",
    ".el-main",
    ".welcome-container",
    ".welcome-header",
    ".stats-overview",
    ".chart-card",
    ".chart-card canvas",
    ".ai-float-button",
    ".nav-mobile-container"
  ];
  const measured = {};
  for (const selector of selectors) {
    measured[selector] = Array.from(document.querySelectorAll(selector))
      .filter(visible)
      .slice(0, 24)
      .map(describe);
  }

  const documentWidth = Math.max(
    document.documentElement.scrollWidth,
    document.body?.scrollWidth || 0
  );
  const mainCandidates = [
    ".course-detail-root .el-scrollbar__wrap",
    ".course-detail-root",
    ".exam-do-container",
    ".exam-result-page",
    ".exam-main",
    ".study-container",
    ".layout-inner-content",
    ".main-content",
    ".account-main",
    ".ai-app-root",
    ".course-detail-page",
    ".course-detail-container",
    ".el-main",
    "#app"
  ];
  const mainSelector = mainCandidates.find(selector => {
    const candidate = document.querySelector(selector);
    return candidate && visible(candidate);
  }) || "";
  const main = mainSelector ? document.querySelector(mainSelector) : null;
  const accountMain = document.querySelector(".account-main");
  const appRoot = document.querySelector("#app");
  const initialLoader = appRoot?.querySelector(":scope > .loader");
  const appHasMountedContent = Boolean(
    appRoot &&
      Array.from(appRoot.children).some(
        child => !child.matches("style, .loader")
      )
  );
  const activeAccountMenu = Array.from(
    document.querySelectorAll(".account-menu .el-menu-item.is-active")
  ).find(visible);
  const textWithoutSvg = element => {
    if (!element) return "";
    const clone = element.cloneNode(true);
    clone.querySelectorAll("svg").forEach(node => node.remove());
    return String(clone.textContent || "").replace(/\\s+/g, " ").trim();
  };
  const mainRect = main && visible(main) ? main.getBoundingClientRect() : null;
  const mainStyle = mainRect && main ? getComputedStyle(main) : null;
  const mainPaddingLeft = mainStyle
    ? Number.parseFloat(mainStyle.paddingLeft) || 0
    : 0;
  const mainPaddingRight = mainStyle
    ? Number.parseFloat(mainStyle.paddingRight) || 0
    : 0;
  const mainUsableWidth = mainRect
    ? Math.max(0, mainRect.width - mainPaddingLeft - mainPaddingRight)
    : null;
  const overflow = Array.from(document.querySelectorAll("body *"))
    .filter(visible)
    .map(describe)
    .filter(item =>
      item.left < -1 ||
      item.right > innerWidth + 1 ||
      (item.scrollWidth > item.clientWidth + 1 && item.overflowX === "visible")
    )
    .slice(0, 60);

  const touchTargets = Array.from(
    document.querySelectorAll(
      "button, a[href], input, select, textarea, [role='button'], .el-button"
    )
  )
    .filter(visible)
    .map(describe);
  const smallTouchTargets = touchTargets
    .filter(item => item.width < 44 || item.height < 44)
    .slice(0, 60);

  const chartCanvases = Array.from(document.querySelectorAll("canvas"))
    .filter(visible)
    .map(canvas => {
      const item = describe(canvas);
      const parent = canvas.parentElement;
      const parentRect = parent?.getBoundingClientRect();
      return {
        ...item,
        bitmapWidth: canvas.width,
        bitmapHeight: canvas.height,
        parentWidth: parentRect ? round(parentRect.width) : 0,
        widthRatio: parentRect?.width ? round(item.width / parentRect.width) : 0
      };
    });
  const inlineDigitalHumanFrames = Array.from(
    document.querySelectorAll("iframe[src*='virtual-people/index.html']")
  );
  const floatingDigitalHuman = document.querySelector(".floating-human-2d");
  const aiFloatButton = Array.from(
    document.querySelectorAll(".ai-float-button")
  ).find(visible);
  const mobileDock = Array.from(
    document.querySelectorAll(".nav-mobile-container")
  ).find(visible);
  const floatRect = aiFloatButton?.getBoundingClientRect();
  const dockRect = mobileDock?.getBoundingClientRect();
  const floatDockClearance =
    floatRect && dockRect ? round(dockRect.top - floatRect.bottom) : null;

  let storedUserInfo = {};
  try {
    storedUserInfo = JSON.parse(localStorage.getItem("user-info") || "{}");
  } catch {}

  return {
    capturedAt: new Date().toISOString(),
    title: document.title,
    url: location.href,
    routePath: (() => {
      const hash = location.hash.replace(/^#/, "");
      return hash.split("?")[0] || location.pathname;
    })(),
    textSample: String(document.body?.innerText || "")
      .replace(/\\s+/g, " ")
      .trim()
      .slice(0, 1200),
    appState: {
      initialLoaderVisible: Boolean(initialLoader && visible(initialLoader)),
      hasMountedContent: appHasMountedContent,
      textLength: String(appRoot?.innerText || "").trim().length
    },
    viewport: {
      width: innerWidth,
      height: innerHeight,
      devicePixelRatio,
      orientation: screen.orientation?.type || "unknown"
    },
    document: {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: documentWidth,
      overflowX: documentWidth > document.documentElement.clientWidth + 1
    },
    session: {
      username: String(storedUserInfo.username || ""),
      nickname: String(storedUserInfo.nickname || ""),
      roleType: Number(storedUserInfo.roleType || 0),
      roles: Array.isArray(storedUserInfo.roles) ? storedUserInfo.roles : [],
      tokenPresent: Boolean(storedUserInfo.accessToken),
      userId: Number(storedUserInfo.userId || localStorage.getItem("userId") || 0)
    },
    account: {
      activeMenuText: textWithoutSvg(activeAccountMenu),
      mainText: String(accountMain?.innerText || accountMain?.textContent || "")
        .replace(/\\s+/g, " ")
        .trim()
        .slice(0, 4000)
    },
    mainContentSelector: mainSelector || null,
    mainContentWidthRatio: mainRect ? round(mainRect.width / innerWidth) : null,
    mainContentUsableWidthRatio:
      mainUsableWidth === null ? null : round(mainUsableWidth / innerWidth),
    mainContentGutters: mainRect
      ? {
          left: round(mainRect.left + mainPaddingLeft),
          right: round(innerWidth - mainRect.right + mainPaddingRight),
          paddingLeft: round(mainPaddingLeft),
          paddingRight: round(mainPaddingRight)
        }
      : null,
    measured,
    overflow,
    chartCanvases,
    digitalHuman: {
      inline3DIframeCount: inlineDigitalHumanFrames.length,
      inline3DVisibleCount: inlineDigitalHumanFrames.filter(visible).length,
      floating2DMounted: Boolean(floatingDigitalHuman),
      floating2DVisible: Boolean(
        floatingDigitalHuman && visible(floatingDigitalHuman)
      )
    },
    floatingAssistantDock: {
      floatButton: aiFloatButton ? describe(aiFloatButton) : null,
      mobileDock: mobileDock ? describe(mobileDock) : null,
      clearance: floatDockClearance,
      overlaps:
        floatDockClearance === null ? false : floatDockClearance < 8
    },
    touchTargets: {
      total: touchTargets.length,
      smallCount: smallTouchTargets.length,
      small: smallTouchTargets
    }
  };
})()`;

let socket;
try {
  const pid = runAdb(["shell", "pidof", packageName]);
  if (!pid) {
    throw new Error(`${packageName} Android runtime is not running`);
  }

  runAdb([
    "forward",
    `tcp:${port}`,
    `localabstract:webview_devtools_remote_${pid.split(/\s+/)[0]}`
  ]);

  const targetsResponse = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!targetsResponse.ok) {
    throw new Error(
      `Unable to list WebView targets: HTTP ${targetsResponse.status}`
    );
  }
  const targets = await targetsResponse.json();
  const target = targets.find(
    item => item.type === "page" && String(item.url).includes(urlPattern)
  );
  if (!target?.webSocketDebuggerUrl) {
    const urls = targets
      .map(item => item.url)
      .filter(Boolean)
      .join("\n- ");
    throw new Error(
      `No WebView page matched ${JSON.stringify(urlPattern)}. Targets:\n- ${urls}`
    );
  }

  socket = await connectWebSocket(target.webSocketDebuggerUrl);
  const networkRequests = [];
  const networkResponses = [];
  const requestById = new Map();
  socket.addEventListener("message", event => {
    let message;
    try {
      message = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (message.method === "Network.requestWillBeSent") {
      const request = message.params?.request;
      if (!request?.url) return;
      try {
        const requestUrl = new URL(request.url);
        const item = {
          method: String(request.method || "GET"),
          path: requestUrl.pathname
        };
        requestById.set(message.params.requestId, item);
        networkRequests.push(item);
      } catch {}
      return;
    }
    if (message.method === "Network.responseReceived") {
      const response = message.params?.response;
      if (!response?.url) return;
      try {
        const responseUrl = new URL(response.url);
        networkResponses.push({
          requestId: message.params.requestId,
          method: requestById.get(message.params.requestId)?.method || "GET",
          path: responseUrl.pathname,
          status: Number(response.status || 0),
          mimeType: String(response.mimeType || "")
        });
      } catch {}
    }
  });
  const command = createCdpClient(socket);
  await command("Runtime.enable");
  await command("Network.enable");

  const seededUser = role ? await loginRole(role) : null;
  const destination = nativeEntryPath(entry);
  if (seededUser || destination) {
    const seedExpression = `(() => {
      const userInfo = ${JSON.stringify(seededUser)};
      const destination = ${JSON.stringify(destination)};
      if (userInfo) {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem("user-info", JSON.stringify(userInfo));
        localStorage.setItem("userId", String(userInfo.userId || ""));
        localStorage.setItem("userMobile", userInfo.username || "");
        localStorage.setItem("userRoleType", String(userInfo.roleType || ""));
        localStorage.setItem("qimingNativeWebView", "1");
        localStorage.setItem("qimingRealAuditRole", ${JSON.stringify(role)});
        sessionStorage.setItem("qimingNativeWebView", "1");
      }
      if (userInfo || destination) {
        const nextHash = destination || location.hash.replace(/^#/, "") || "/home?qimingNative=1";
        setTimeout(() => {
          location.hash = "#" + nextHash;
          setTimeout(() => location.reload(), 50);
        }, 0);
      }
      return true;
    })()`;
    await command("Runtime.evaluate", {
      expression: seedExpression,
      returnByValue: true
    });
    await wait(waitMs);
    await command("Runtime.enable");
    await command("Network.enable");
  }

  let actionResult = null;
  let readyTextSample = "";
  if (actionSteps.length > 0) {
    const readyEvaluation = await command("Runtime.evaluate", {
      expression:
        'String(document.body?.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 4000)',
      returnByValue: true
    });
    readyTextSample = String(readyEvaluation.result?.value || "");

    const stepResults = [];
    for (const [index, step] of actionSteps.entries()) {
      const stepResult = await executeActionStep(command, step, index);
      stepResults.push(stepResult);
      if (!stepResult.ok) break;
    }
    const failedStep = stepResults.find(step => !step.ok) || null;
    actionResult = hasActionSequence
      ? {
          ok: !failedStep && stepResults.length === actionSteps.length,
          completedSteps: stepResults.filter(step => step.ok).length,
          totalSteps: actionSteps.length,
          failedStep: failedStep?.step ?? null,
          reason: failedStep?.reason || null,
          steps: stepResults
        }
      : stepResults[0];
  }

  const evaluation = await command("Runtime.evaluate", {
    expression: auditExpression,
    awaitPromise: true,
    returnByValue: true
  });
  if (evaluation.exceptionDetails) {
    throw new Error(
      evaluation.exceptionDetails.exception?.description ||
        evaluation.exceptionDetails.text ||
        "WebView evaluation failed"
    );
  }

  const report = evaluation.result?.value;
  if (!report) throw new Error("WebView audit returned no report");
  let requiredResponse = null;
  if (requiredRequestPath) {
    const response = [...networkResponses]
      .reverse()
      .find(item => item.path === requiredRequestPath);
    if (response) {
      requiredResponse = { ...response };
      try {
        const bodyResult = await command("Network.getResponseBody", {
          requestId: response.requestId
        });
        const body = bodyResult.base64Encoded
          ? Buffer.from(bodyResult.body || "", "base64").toString("utf8")
          : String(bodyResult.body || "");
        Object.assign(requiredResponse, inspectBusinessEnvelope(body));
      } catch (error) {
        requiredResponse.bodyError =
          error instanceof Error ? error.message : String(error);
      }
    }
  }
  report.action = actionResult;
  report.androidPackage = packageName;
  report.networkRequests = networkRequests.slice(-160);
  report.networkResponses = networkResponses
    .slice(-160)
    .map(({ requestId: _requestId, ...item }) => item);
  report.requiredResponse = requiredResponse
    ? (({ requestId: _requestId, ...item }) => item)(requiredResponse)
    : null;

  const failures = [];
  const forbiddenPage =
    report.routePath === "/error/403" ||
    String(report.textSample || "").includes("抱歉，你无权访问该页面");
  if (report.document.overflowX) {
    failures.push(
      `document width ${report.document.scrollWidth}px exceeds ${report.document.clientWidth}px`
    );
  }
  if (strict && report.appState?.initialLoaderVisible) {
    failures.push("initial app loader is still visible");
  }
  if (strict && report.appState && !report.appState.hasMountedContent) {
    failures.push("#app has no mounted application content");
  }
  if (
    typeof report.mainContentWidthRatio === "number" &&
    report.mainContentWidthRatio < minContentRatio
  ) {
    failures.push(
      `main content ratio ${report.mainContentWidthRatio} is below ${minContentRatio}`
    );
  }
  if (
    typeof report.mainContentUsableWidthRatio === "number" &&
    report.mainContentUsableWidthRatio < minUsableContentRatio
  ) {
    failures.push(
      `usable content ratio ${report.mainContentUsableWidthRatio} is below ${minUsableContentRatio}`
    );
  }
  const zeroCharts = report.chartCanvases.filter(
    chart =>
      chart.width < 1 ||
      chart.height < 1 ||
      chart.bitmapWidth < 1 ||
      chart.bitmapHeight < 1
  );
  if (zeroCharts.length > 0) {
    failures.push(
      `${zeroCharts.length} visible chart canvas element(s) are blank-sized`
    );
  }
  if (
    expectCompactDigitalHuman &&
    Number(report.digitalHuman?.inline3DIframeCount || 0) !== 0
  ) {
    failures.push(
      `compact digital human mounted ${report.digitalHuman.inline3DIframeCount} inline 3D iframe(s)`
    );
  }
  if (
    expectCompactDigitalHuman &&
    (!report.digitalHuman?.floating2DMounted ||
      !report.digitalHuman?.floating2DVisible)
  ) {
    failures.push("compact digital human 2D fallback is not visible");
  }
  if (report.floatingAssistantDock?.overlaps) {
    failures.push(
      `AI float button overlaps the mobile dock (clearance ${report.floatingAssistantDock.clearance}px)`
    );
  }
  const textScope = accountMenuText
    ? String(report.account?.mainText || "")
    : String(report.textSample || "");
  if (!expectForbidden && expectedText && !textScope.includes(expectedText)) {
    failures.push(`expected text not found: ${expectedText}`);
  }
  if (
    !expectForbidden &&
    accountMenuText &&
    report.account?.activeMenuText !== accountMenuText
  ) {
    failures.push(
      `account menu mismatch: ${report.account?.activeMenuText || "none"} != ${accountMenuText}`
    );
  }
  if (
    readyExpectedText &&
    !String(readyTextSample || "").includes(readyExpectedText)
  ) {
    failures.push(`ready text not found: ${readyExpectedText}`);
  }
  if (actionSteps.length > 0 && !actionResult?.ok) {
    failures.push(`route action failed: ${actionResult?.reason || "unknown"}`);
  }
  if (requiredRequestPath && !requiredResponse) {
    failures.push(`required response missing: ${requiredRequestPath}`);
  } else if (requiredResponse && requiredResponse.status >= 400) {
    failures.push(
      `required response failed: ${requiredResponse.status} ${requiredRequestPath}`
    );
  } else if (requiredResponse?.bodyError) {
    failures.push(`required response body unavailable: ${requiredRequestPath}`);
  } else if (
    requiredResponse &&
    requiredResponse.businessCodePresent !== true
  ) {
    failures.push(
      `required response business code missing: ${requiredRequestPath}`
    );
  } else if (requiredResponse && requiredResponse.businessCodeValid !== true) {
    failures.push(
      `required response business code invalid: ${requiredRequestPath}`
    );
  } else if (
    requiredResponse &&
    ![0, 200].includes(requiredResponse.businessCode)
  ) {
    failures.push(
      `required response business code failed: ${requiredResponse.businessCode} ${requiredRequestPath}`
    );
  }
  const failedResponses = networkResponses.filter(
    response =>
      response.status >= 400 &&
      response.path !== requiredRequestPath &&
      /^\/edu\//.test(response.path)
  );
  if (failedResponses.length > 0) {
    failures.push(
      `HTTP API failures: ${failedResponses
        .slice(0, 4)
        .map(response => `${response.status}:${response.path}`)
        .join(", ")}`
    );
  }
  if (role) {
    const expectedRole = roleMeta[role];
    if (
      report.session.roleType !== expectedRole.roleType ||
      report.session.roles?.length !== 1 ||
      report.session.roles[0] !== role ||
      report.session.username !== accounts[role].mobile
    ) {
      failures.push(
        `role mismatch: ${report.session.username}/${report.session.roleType}/${report.session.roles?.join("+") || "none"}`
      );
    }
  }
  if (expectForbidden && !forbiddenPage) {
    failures.push(`expected forbidden page, reached: ${report.routePath}`);
  }
  if (
    !expectForbidden &&
    entry &&
    report.routePath !== new URL(entry, "https://qiming.local").pathname
  ) {
    failures.push(`route mismatch: ${report.routePath}`);
  }

  report.strict = {
    enabled: strict,
    minContentRatio,
    minUsableContentRatio,
    role: role || null,
    entry: entry || null,
    expectedText: expectedText || null,
    readyExpectedText: readyExpectedText || null,
    action:
      actionSteps.length > 0
        ? hasActionSequence
          ? { mode: "sequence", steps: actionSteps }
          : {
              selector: actionSelector,
              text: actionText,
              afterSelector: actionAfterSelector || null,
              afterText: actionAfterText || null,
              postActionWaitMs
            }
        : null,
    accountMenuText: accountMenuText || null,
    expectCompactDigitalHuman,
    expectForbidden,
    requiredRequestPath: requiredRequestPath || null,
    passed: failures.length === 0,
    failures
  };

  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (outputPath) {
    const absoluteOutput = resolve(outputPath);
    mkdirSync(dirname(absoluteOutput), { recursive: true });
    writeFileSync(absoluteOutput, serialized, "utf8");
  }
  process.stdout.write(serialized);

  if (strict && failures.length > 0) process.exitCode = 1;
} catch (error) {
  const report = executionFailureReport(error);
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (outputPath) {
    const absoluteOutput = resolve(outputPath);
    mkdirSync(dirname(absoluteOutput), { recursive: true });
    writeFileSync(absoluteOutput, serialized, "utf8");
  }
  process.stdout.write(serialized);
  process.stderr.write(`[${report.auditStatus}] ${report.error.message}\n`);
  process.exitCode = report.auditStatus === "environment-interrupted" ? 2 : 3;
} finally {
  socket?.close();
}
