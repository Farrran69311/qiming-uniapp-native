#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const routeSource = join(root, "scripts", "wechat-real-session-audit.mjs");
const routeAudit = join(root, "scripts", "android-webview-audit.mjs");
const argv = process.argv.slice(2);

function printUsage() {
  process.stdout.write(
    `Usage: node scripts/android-real-device-audit.mjs [options]\n\nOptions:\n  --role <student|teacher|admin>  Audit one role from the shared matrix\n  --route, --only <name>          Audit one named route\n  --from-route <name>             Resume inclusively from one matrix route\n  --serial <adb-serial>            Target one Android device\n  --api-origin <url>              API origin used for real login/fixtures\n  --fixture-check                 Resolve real API fixtures without touching a device\n  --wait-ms <ms>                  Per-route navigation wait\n  --min-content-ratio <ratio>     Minimum main-content/viewport width ratio\n  --min-usable-content-ratio <r>  Minimum width after route-root padding\n  --max-routes <count>            Limit routes after all other filters\n  --out-dir <path>                Artifact output directory\n  --list                          List selected routes and exit\n  --list-json                     Print selected route definitions as JSON\n  --self-test                     Validate the shared matrix without a device\n  -h, --help                      Show this help and exit\n`
  );
  process.stdout.write(
    "  --allow-exam-start              Allow exam-do to start or resume a real session\n" +
      "  --package <application-id>       Android package owning the WebView\n"
  );
}

if (argv.includes("-h") || argv.includes("--help")) {
  printUsage();
  process.exit(0);
}

function readArg(name, fallback = "") {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
}

const roleFilter = readArg("--role");
const routeFilter = readArg("--route") || readArg("--only");
const fromRoute = readArg("--from-route");
const serial = readArg("--serial");
const packageName = readArg(
  "--package",
  process.env.QIMING_ANDROID_PACKAGE || "io.dcloud.HBuilder"
);
const apiOrigin = readArg(
  "--api-origin",
  process.env.VITE_API_URL || "https://aiedu-api.intelledu.cn"
);
const waitMs = Number(readArg("--wait-ms", "4500"));
const minContentRatio = readArg("--min-content-ratio", "0.88");
const minUsableContentRatio = readArg("--min-usable-content-ratio", "0.92");
const maxRoutes = Number(readArg("--max-routes", "0"));
const listOnly = argv.includes("--list");
const listJson = argv.includes("--list-json");
const fixtureCheck = argv.includes("--fixture-check");
const allowExamStart =
  argv.includes("--allow-exam-start") ||
  process.env.QIMING_AUDIT_ALLOW_EXAM_START === "1";
const selfTest = argv.includes("--self-test");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = resolve(
  readArg(
    "--out-dir",
    join(root, "artifacts", "android", `real-device-audit-${timestamp}`)
  )
);

const accounts = {
  student: {
    mobile: process.env.QIMING_AUDIT_STUDENT_MOBILE || "13111111112",
    password: process.env.QIMING_AUDIT_STUDENT_PASSWORD || "123456"
  }
};

const androidDynamicRoutes = [
  {
    role: "student",
    name: "student-homework-detail",
    entry:
      "/account/homework-detail?homeworkId={homeworkId}&courseId={courseId}",
    expect: ["总题数"],
    fixtureKind: "homework",
    requiredRequestPath: "/edu/frontend/v1/homework/detail"
  },
  {
    role: "student",
    name: "student-course-exam-detail",
    entry: "/account/exam-detail?examId={examId}&courseId={courseId}",
    expect: ["总题数"],
    fixtureKind: "course-exam",
    requiredRequestPath: "/edu/frontend/v1/exam/detail"
  },
  {
    role: "student",
    name: "student-paper-detail",
    entry: "/student-exam-center/detail/{paperId}",
    expect: ["考试时长"],
    fixtureKind: "paper-detail",
    requiredRequestPath: "/edu/frontend/v1/paper/detail/{paperId}"
  },
  {
    role: "student",
    name: "student-exam-do",
    entry: "/student-exam-center/do/{paperId}",
    expect: ["剩余时间"],
    fixtureKind: "exam-do",
    requiresWriteOptIn: true,
    requiredRequestPath: "/edu/frontend/v1/exam/start"
  },
  {
    role: "student",
    name: "student-exam-result",
    entry: "/exam-paper/result/{submissionId}",
    expect: ["考试结果"],
    fixtureKind: "exam-result",
    requiredRequestPath: "/edu/frontend/v1/exam/result/{submissionId}"
  }
];

if (roleFilter && !["student", "teacher", "admin"].includes(roleFilter)) {
  throw new Error(`Unsupported --role value: ${roleFilter}`);
}
if (!Number.isFinite(waitMs) || waitMs < 0 || waitMs > 120_000) {
  throw new Error(`Unsupported --wait-ms value: ${waitMs}`);
}
if (!Number.isInteger(maxRoutes) || maxRoutes < 0) {
  throw new Error(`Unsupported --max-routes value: ${maxRoutes}`);
}
if (!/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(packageName)) {
  throw new Error(`Unsupported --package value: ${packageName}`);
}

function runNode(script, args, options = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    ...options
  });
}

function legacyEnvironmentInterruption(message) {
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

function parseAuditExecution(auditResult) {
  let report = null;
  let parseError = "";
  try {
    report = JSON.parse(auditResult.stdout);
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }

  if (report?.auditStatus === "environment-interrupted" && report.environment) {
    return {
      auditResult,
      report,
      parseError,
      interruption: {
        kind: "environment-interrupted",
        ...report.environment
      }
    };
  }
  if (report?.auditStatus === "runner-error") {
    return {
      auditResult,
      report,
      parseError,
      interruption: {
        kind: "runner-error",
        code: "audit-runner-error",
        message: report.error?.message || "Android audit runner failed"
      }
    };
  }
  if (report) return { auditResult, report, parseError, interruption: null };

  const details = [parseError, auditResult.stderr, auditResult.stdout]
    .filter(Boolean)
    .join("; ");
  const environment = legacyEnvironmentInterruption(details);
  return {
    auditResult,
    report: null,
    parseError,
    interruption: environment
      ? { kind: "environment-interrupted", ...environment }
      : {
          kind: "runner-error",
          code: "audit-output-unavailable",
          message: details || `audit child exited ${auditResult.status}`
        }
  };
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

function isSuccessfulBusinessResponse(result) {
  return (
    result.httpStatus >= 200 &&
    result.httpStatus < 300 &&
    result.json !== null &&
    [0, 200].includes(Number(result.json?.code))
  );
}

function fixtureEvidence(result, extra = {}) {
  return {
    endpoint: result.path,
    httpStatus: result.httpStatus,
    businessCode:
      result.json?.code === undefined ? null : Number(result.json.code),
    message: String(
      result.error ||
        result.json?.msg ||
        result.json?.message ||
        result.bodySample ||
        ""
    ).slice(0, 240),
    ...extra
  };
}

async function probeFixtureApi(path, token) {
  const url = `${new URL(apiOrigin).origin}${path}`;
  try {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token}` }
    });
    const body = await response.text();
    let json = null;
    try {
      json = JSON.parse(body);
    } catch {}
    return {
      path: new URL(url).pathname,
      httpStatus: response.status,
      json,
      bodySample: json === null ? body.slice(0, 180) : ""
    };
  } catch (error) {
    return {
      path: new URL(url).pathname,
      httpStatus: 0,
      json: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function positiveId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}

function resolveFixtureTemplate(value, fixtures) {
  return String(value).replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (_, key) => {
    const id = positiveId(fixtures?.[key]);
    if (!id) throw new Error(`Missing dynamic fixture: ${key}`);
    return String(id);
  });
}

async function loginStudentFixtureSession() {
  const login = await fetchJson(
    `${new URL(apiOrigin).origin}/edu/v1/user/login`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(accounts.student)
    }
  );
  if (Number(login?.code) !== 200 || !login?.data?.accessToken) {
    throw new Error(
      `Student fixture login failed: ${login?.msg || login?.code}`
    );
  }
  return { token: login.data.accessToken };
}

function unavailableFixture(reason, evidence) {
  return { reason, evidence };
}

function getRouteFixtureUnavailable(
  route,
  fixtureResult,
  { allowWriteRoutes = false } = {}
) {
  if (fixtureResult?.unavailable) return fixtureResult.unavailable;
  if (!route.requiresWriteOptIn || allowWriteRoutes) return null;
  return unavailableFixture("exam-start-requires-explicit-opt-in", {
    endpoint: "/edu/frontend/v1/exam/start",
    httpStatus: null,
    businessCode: null,
    message:
      "rerun with --allow-exam-start to start or resume a real exam session"
  });
}

async function resolveStudentRouteFixtures(selectedRoutes) {
  const fixtureRoutes = selectedRoutes.filter(
    route =>
      route.role === "student" && (route.requiresCourse || route.fixtureKind)
  );
  const resolved = new Map();
  if (fixtureRoutes.length === 0) return resolved;

  let token = "";
  try {
    ({ token } = await loginStudentFixtureSession());
  } catch (error) {
    const evidence = {
      endpoint: "/edu/v1/user/login",
      httpStatus: 0,
      businessCode: null,
      message: error instanceof Error ? error.message : String(error)
    };
    for (const route of fixtureRoutes) {
      resolved.set(route.name, {
        unavailable: unavailableFixture(
          "student-fixture-login-unavailable",
          evidence
        )
      });
    }
    return resolved;
  }
  const needsCourses = fixtureRoutes.some(
    route =>
      route.requiresCourse ||
      route.fixtureKind === "homework" ||
      route.fixtureKind === "course-exam"
  );
  let courseItems = [];
  let courseEvidence = null;
  if (needsCourses) {
    const courseProbe = await probeFixtureApi(
      "/edu/frontend/v1/course/list?pageNum=1&pageSize=100",
      token
    );
    courseItems = isSuccessfulBusinessResponse(courseProbe)
      ? (courseProbe.json?.data?.list || []).filter(item =>
          positiveId(item?.courseId)
        )
      : [];
    courseEvidence = fixtureEvidence(courseProbe, {
      returnedItems: courseItems.length
    });
    for (const route of fixtureRoutes.filter(item => item.requiresCourse)) {
      const courseId = positiveId(courseItems[0]?.courseId);
      resolved.set(
        route.name,
        courseId
          ? { fixtures: { courseId }, evidence: [courseEvidence] }
          : {
              unavailable: unavailableFixture(
                courseEvidence.httpStatus >= 200 &&
                  courseEvidence.httpStatus < 300
                  ? "student-course-list-empty"
                  : "student-course-api-unavailable",
                courseEvidence
              )
            }
      );
    }
  }

  for (const fixtureKind of ["homework", "course-exam"]) {
    const targetRoutes = fixtureRoutes.filter(
      route => route.fixtureKind === fixtureKind
    );
    if (targetRoutes.length === 0) continue;
    const resourceName = fixtureKind === "homework" ? "homework" : "exam";
    const idKey = fixtureKind === "homework" ? "homeworkId" : "examId";
    let match = null;
    const probes = [];
    for (const course of courseItems) {
      const courseId = positiveId(course.courseId);
      const path = `/edu/frontend/v1/course/${resourceName}/list?courseId=${courseId}`;
      const probe = await probeFixtureApi(path, token);
      const items = isSuccessfulBusinessResponse(probe)
        ? probe.json?.data?.list || []
        : [];
      probes.push(
        fixtureEvidence(probe, { courseId, returnedItems: items.length })
      );
      const item =
        items.find(
          candidate =>
            positiveId(candidate?.[idKey]) && Number(candidate?.status) === 2
        ) || items.find(candidate => positiveId(candidate?.[idKey]));
      if (item) {
        match = { courseId, [idKey]: positiveId(item[idKey]) };
        break;
      }
    }
    const lastEvidence = probes.at(-1) ||
      courseEvidence || {
        endpoint: `/edu/frontend/v1/course/${resourceName}/list`,
        httpStatus: 0,
        businessCode: null,
        message: "course fixture unavailable",
        returnedItems: 0
      };
    for (const route of targetRoutes) {
      resolved.set(
        route.name,
        match
          ? { fixtures: match, evidence: probes }
          : {
              unavailable: unavailableFixture(
                courseItems.length === 0
                  ? "student-course-fixture-unavailable"
                  : `student-${resourceName}-list-empty-or-unavailable`,
                { ...lastEvidence, probes }
              )
            }
      );
    }
  }

  const paperRoutes = fixtureRoutes.filter(route =>
    ["paper-list", "paper-detail", "exam-do", "exam-result"].includes(
      route.fixtureKind
    )
  );
  if (paperRoutes.length > 0) {
    const paperProbe = await probeFixtureApi(
      "/edu/frontend/v1/paper/list?pageNum=1&pageSize=100",
      token
    );
    const paperItems = isSuccessfulBusinessResponse(paperProbe)
      ? paperProbe.json?.data?.list || []
      : [];
    const statusCounts = Object.fromEntries(
      [
        ...new Set(paperItems.map(item => String(item?.status || "unknown")))
      ].map(status => [
        status,
        paperItems.filter(item => String(item?.status || "unknown") === status)
          .length
      ])
    );
    const evidence = fixtureEvidence(paperProbe, {
      returnedItems: paperItems.length,
      statusCounts
    });
    for (const route of paperRoutes) {
      if (route.fixtureKind === "paper-list") {
        resolved.set(
          route.name,
          isSuccessfulBusinessResponse(paperProbe)
            ? { fixtures: {}, evidence: [evidence] }
            : {
                unavailable: unavailableFixture(
                  "student-paper-api-unavailable",
                  evidence
                )
              }
        );
        continue;
      }
      let item = null;
      if (route.fixtureKind === "exam-do") {
        item = paperItems.find(
          candidate =>
            positiveId(candidate?.id) &&
            ["available", "retake"].includes(String(candidate?.status))
        );
      } else if (route.fixtureKind === "exam-result") {
        item =
          paperItems.find(
            candidate =>
              String(candidate?.status) === "completed" &&
              positiveId(candidate?.submissionId)
          ) ||
          paperItems.find(candidate => positiveId(candidate?.submissionId));
      } else item = paperItems.find(candidate => positiveId(candidate?.id));
      const fixtures =
        route.fixtureKind === "exam-result"
          ? { submissionId: positiveId(item?.submissionId) }
          : { paperId: positiveId(item?.id) };
      const hasFixture = Object.values(fixtures).every(positiveId);
      resolved.set(
        route.name,
        hasFixture
          ? { fixtures, evidence: [evidence] }
          : {
              unavailable: unavailableFixture(
                isSuccessfulBusinessResponse(paperProbe)
                  ? route.fixtureKind === "exam-result"
                    ? "student-paper-list-has-no-submission"
                    : route.fixtureKind === "exam-do"
                      ? "student-paper-list-has-no-answerable-paper"
                      : "student-paper-list-empty"
                  : "student-paper-api-unavailable",
                evidence
              )
            }
      );
    }
  }

  return resolved;
}

function selectAuditRoutes(
  matrix,
  { role = "", route = "", from = "", limit = 0 } = {}
) {
  if (route && from) {
    throw new Error("--route/--only cannot be combined with --from-route");
  }
  if (route && !matrix.some(item => item.name === route)) {
    throw new Error(`Unknown --route value: ${route}`);
  }
  if (from && !matrix.some(item => item.name === from)) {
    throw new Error(`Unknown --from-route value: ${from}`);
  }

  let selected = role ? matrix.filter(item => item.role === role) : [...matrix];
  if (route) {
    selected = selected.filter(item => item.name === route);
    if (selected.length === 0) {
      throw new Error(`Route ${route} is outside the selected ${role} role`);
    }
  }
  if (from) {
    const resumeIndex = selected.findIndex(item => item.name === from);
    if (resumeIndex < 0) {
      throw new Error(`Route ${from} is outside the selected ${role} role`);
    }
    selected = selected.slice(resumeIndex);
  }
  return limit > 0 ? selected.slice(0, limit) : selected;
}

function expectsCompactDigitalHuman(entry) {
  const pathname = new URL(entry, "https://qiming.local").pathname;
  return new Set(["/account/ai-app", "/ai-app/chat", "/ai-app/workspace"]).has(
    pathname
  );
}

function routeActionSteps(route) {
  if (!route.action) return [];
  return Array.isArray(route.action) ? route.action : [route.action];
}

function validateRouteActionContract(route) {
  if (!route.action) return [];
  if (Array.isArray(route.action) && route.action.length === 0) {
    return [`invalid interaction contract: ${route.name} has no action steps`];
  }

  const allowedKeys = new Set([
    "selector",
    "text",
    "waitMs",
    "afterSelector",
    "afterText"
  ]);
  return routeActionSteps(route).flatMap((step, index) => {
    const label = `${route.name} action step ${index + 1}`;
    if (!step || typeof step !== "object" || Array.isArray(step)) {
      return [`invalid interaction contract: ${label} must be an object`];
    }
    const stepFailures = [];
    const unknownKey = Object.keys(step).find(key => !allowedKeys.has(key));
    if (unknownKey) {
      stepFailures.push(`${label} has unsupported field: ${unknownKey}`);
    }
    if (typeof step.selector !== "string" || !step.selector.trim()) {
      stepFailures.push(`${label} requires a non-empty selector`);
    }
    if (step.text !== undefined && typeof step.text !== "string") {
      stepFailures.push(`${label} text must be a string`);
    }
    if (
      step.waitMs !== undefined &&
      (!Number.isFinite(step.waitMs) ||
        step.waitMs < 0 ||
        step.waitMs > 120_000)
    ) {
      stepFailures.push(`${label} waitMs must be between 0 and 120000`);
    }
    if (
      step.afterSelector !== undefined &&
      (typeof step.afterSelector !== "string" || !step.afterSelector.trim())
    ) {
      stepFailures.push(`${label} afterSelector must be a non-empty string`);
    }
    if (
      step.afterText !== undefined &&
      (typeof step.afterText !== "string" || !step.afterText.trim())
    ) {
      stepFailures.push(`${label} afterText must be a non-empty string`);
    }
    if (step.afterText !== undefined && step.afterSelector === undefined) {
      stepFailures.push(`${label} afterText requires afterSelector`);
    }
    return stepFailures;
  });
}

function appendRouteActionArgs(commandArgs, route) {
  if (!route.action) return;
  const contractFailures = validateRouteActionContract(route);
  if (contractFailures.length > 0) {
    throw new Error(contractFailures.join("; "));
  }

  const routeWaitMs = route.postActionWaitMs ?? 2000;
  let actionWaitMs = routeWaitMs;
  if (Array.isArray(route.action)) {
    commandArgs.push("--actions-json", JSON.stringify(route.action));
  } else {
    actionWaitMs = route.action.waitMs ?? routeWaitMs;
    commandArgs.push("--action-selector", route.action.selector);
    if (route.action.text) {
      commandArgs.push("--action-text", route.action.text);
    }
    if (route.action.afterSelector) {
      commandArgs.push("--action-after-selector", route.action.afterSelector);
    }
    if (route.action.afterText) {
      commandArgs.push("--action-after-text", route.action.afterText);
    }
  }
  commandArgs.push("--post-action-wait-ms", String(actionWaitMs));
}

const routeResult = runNode(routeSource, ["--list-json"]);
if (routeResult.status !== 0) {
  throw new Error(
    `Unable to read route matrix: ${(routeResult.stderr || routeResult.stdout).trim()}`
  );
}

const sharedRoutes = JSON.parse(routeResult.stdout).map(route =>
  route.name === "student-exam-center-list"
    ? { ...route, fixtureKind: "paper-list" }
    : route
);
const firstNonStudentIndex = sharedRoutes.findIndex(
  route => route.role !== "student"
);
const matrixRoutes = [
  ...sharedRoutes.slice(0, firstNonStudentIndex),
  ...androidDynamicRoutes,
  ...sharedRoutes.slice(firstNonStudentIndex)
];
const routes = selectAuditRoutes(matrixRoutes, {
  role: roleFilter,
  route: routeFilter,
  from: fromRoute,
  limit: maxRoutes
});
if (routes.length === 0) throw new Error("No Android audit routes selected");

if (selfTest) {
  const failures = [];
  const names = matrixRoutes.map(route => route.name);
  if (new Set(names).size !== names.length)
    failures.push("duplicate route names");
  for (const role of ["student", "teacher", "admin"]) {
    if (!matrixRoutes.some(route => route.role === role)) {
      failures.push(`missing ${role} routes`);
    }
  }
  for (const route of matrixRoutes.filter(item => item.requiresCourse)) {
    if (
      route.role !== "student" ||
      !/^\/course\/1(?=([?#]|$))/.test(route.entry)
    ) {
      failures.push(`invalid course fixture route: ${route.name}`);
      continue;
    }
    const resolvedEntry = route.entry.replace(
      /\/course\/1(?=\?|$)/,
      "/course/37"
    );
    if (
      new URL(resolvedEntry, "https://qiming.local").pathname !== "/course/37"
    ) {
      failures.push(`invalid resolved course path: ${route.name}`);
    }
  }
  for (const route of matrixRoutes.filter(item => item.accountMenuText)) {
    if (!route.entry.startsWith("/account?menu=")) {
      failures.push(`invalid account menu route: ${route.name}`);
    }
  }
  for (const route of matrixRoutes.filter(item => item.requiredRequestPath)) {
    if (!route.requiredRequestPath.startsWith("/")) {
      failures.push(`invalid required request path: ${route.name}`);
    }
  }
  const interactionRoutes = matrixRoutes.filter(route => route.action);
  if (interactionRoutes.length !== 16) {
    failures.push(
      `expected 16 shared interaction routes, got ${interactionRoutes.length}`
    );
  }
  const multiStepInteractionRoutes = interactionRoutes.filter(route =>
    Array.isArray(route.action)
  );
  if (multiStepInteractionRoutes.length !== 3) {
    failures.push(
      `expected 3 multi-step interaction routes, got ${multiStepInteractionRoutes.length}`
    );
  }
  const interactionSteps = interactionRoutes.reduce(
    (total, route) => total + routeActionSteps(route).length,
    0
  );
  if (interactionSteps !== 20) {
    failures.push(`expected 20 interaction steps, got ${interactionSteps}`);
  }
  for (const route of interactionRoutes) {
    if (!Array.isArray(route.readyExpect)) {
      failures.push(`invalid interaction contract: ${route.name}`);
    }
    failures.push(...validateRouteActionContract(route));
  }
  for (const route of multiStepInteractionRoutes) {
    const actionArgs = [];
    appendRouteActionArgs(actionArgs, route);
    const jsonIndex = actionArgs.indexOf("--actions-json");
    if (jsonIndex < 0 || actionArgs.includes("--action-selector")) {
      failures.push(`multi-step action transport is not JSON: ${route.name}`);
      continue;
    }
    try {
      const transportedSteps = JSON.parse(actionArgs[jsonIndex + 1]);
      if (
        !Array.isArray(transportedSteps) ||
        transportedSteps.length !== route.action.length
      ) {
        failures.push(`multi-step action transport changed: ${route.name}`);
      }
    } catch (error) {
      failures.push(
        `multi-step action transport is invalid: ${route.name}:${error}`
      );
    }
  }
  const singleStepRoute = interactionRoutes.find(
    route => !Array.isArray(route.action)
  );
  if (singleStepRoute) {
    const actionArgs = [];
    appendRouteActionArgs(actionArgs, singleStepRoute);
    if (
      !actionArgs.includes("--action-selector") ||
      actionArgs.includes("--actions-json")
    ) {
      failures.push("legacy single-step action transport changed");
    }
  }
  const zeroWaitArgs = [];
  appendRouteActionArgs(zeroWaitArgs, {
    name: "zero-wait-action",
    action: { selector: ".action", waitMs: 0 },
    postActionWaitMs: 900
  });
  const zeroWaitIndex = zeroWaitArgs.indexOf("--post-action-wait-ms");
  if (zeroWaitArgs[zeroWaitIndex + 1] !== "0") {
    failures.push("single-step action wait transport does not preserve zero");
  }
  for (const route of androidDynamicRoutes) {
    if (!route.fixtureKind || !/\{[A-Za-z][A-Za-z0-9]*\}/.test(route.entry)) {
      failures.push(`dynamic fixture contract missing: ${route.name}`);
    }
    try {
      const fixtures = {
        courseId: 37,
        homeworkId: 414,
        examId: 11,
        paperId: 101,
        submissionId: 202
      };
      const resolvedEntry = resolveFixtureTemplate(route.entry, fixtures);
      const resolvedRequestPath = resolveFixtureTemplate(
        route.requiredRequestPath,
        fixtures
      );
      if (/\{[^}]+\}/.test(`${resolvedEntry}${resolvedRequestPath}`)) {
        failures.push(`dynamic fixture unresolved: ${route.name}`);
      }
    } catch (error) {
      failures.push(
        `dynamic fixture resolution failed: ${route.name}:${error}`
      );
    }
  }
  try {
    resolveFixtureTemplate("/paper/{paperId}", {});
    failures.push("missing dynamic fixture did not throw");
  } catch (error) {
    if (!String(error).includes("paperId")) {
      failures.push(
        `missing dynamic fixture error was not actionable: ${error}`
      );
    }
  }
  const writeRoute = { requiresWriteOptIn: true };
  const backendGap = unavailableFixture("backend-gap", { httpStatus: 404 });
  if (
    getRouteFixtureUnavailable(writeRoute, { unavailable: backendGap })
      ?.reason !== "backend-gap"
  ) {
    failures.push("backend fixture gap did not take precedence");
  }
  if (
    getRouteFixtureUnavailable(writeRoute, { fixtures: { paperId: 101 } })
      ?.reason !== "exam-start-requires-explicit-opt-in"
  ) {
    failures.push("exam start route did not require explicit opt-in");
  }
  if (
    getRouteFixtureUnavailable(
      writeRoute,
      { fixtures: { paperId: 101 } },
      { allowWriteRoutes: true }
    ) !== null
  ) {
    failures.push("explicit exam start opt-in did not release the route");
  }
  for (const route of matrixRoutes.filter(item => !item.expectedForbidden)) {
    const visibleExpectations = [
      ...(route.expect || []),
      ...(route.readyExpect || [])
    ].filter(Boolean);
    if (visibleExpectations.length === 0) {
      failures.push(`visible page expectation missing: ${route.name}`);
    }
  }
  const cloudRequirements = [
    "student-account-cloud-disk",
    "teacher-cloud-disk",
    "admin-online-disk"
  ];
  for (const name of cloudRequirements) {
    const route = matrixRoutes.find(item => item.name === name);
    if (route?.requiredRequestPath !== "/edu/backend/v1/user/file/list") {
      failures.push(`cloud API evidence missing: ${name}`);
    }
  }
  const childSelfTest = runNode(routeAudit, ["--self-test"]);
  if (childSelfTest.status !== 0) {
    failures.push(
      `android webview self-test failed: ${(childSelfTest.stderr || childSelfTest.stdout).trim()}`
    );
  }
  const executionCases = [
    {
      name: "structured environment interruption",
      result: {
        status: 2,
        stdout: JSON.stringify({
          auditStatus: "environment-interrupted",
          environment: { code: "cdp-connection-lost", message: "closed" }
        }),
        stderr: ""
      },
      kind: "environment-interrupted"
    },
    {
      name: "legacy CDP timeout",
      result: {
        status: 1,
        stdout: "",
        stderr: "Error: Runtime.enable timed out"
      },
      kind: "environment-interrupted"
    },
    {
      name: "unstructured runner failure",
      result: { status: 1, stdout: "", stderr: "SyntaxError: broken" },
      kind: "runner-error"
    },
    {
      name: "normal audit report",
      result: { status: 0, stdout: '{"session":{}}', stderr: "" },
      kind: null
    }
  ];
  for (const executionCase of executionCases) {
    const execution = parseAuditExecution(executionCase.result);
    const actualKind = execution.interruption?.kind || null;
    if (actualKind !== executionCase.kind) {
      failures.push(
        `${executionCase.name}: expected ${executionCase.kind}, got ${actualKind}`
      );
    }
  }
  const selectionMatrix = [
    { name: "student-a", role: "student" },
    { name: "teacher-a", role: "teacher" },
    { name: "teacher-b", role: "teacher" },
    { name: "student-b", role: "student" }
  ];
  const resumed = selectAuditRoutes(selectionMatrix, { from: "teacher-a" });
  if (
    resumed.map(item => item.name).join(",") !== "teacher-a,teacher-b,student-b"
  ) {
    failures.push("--from-route is not inclusive or does not preserve order");
  }
  const filteredResume = selectAuditRoutes(selectionMatrix, {
    role: "teacher",
    from: "teacher-b",
    limit: 1
  });
  if (filteredResume.map(item => item.name).join(",") !== "teacher-b") {
    failures.push("role/from-route/max-routes filter order is invalid");
  }
  for (const [name, options, expectedMessage] of [
    ["unknown", { from: "missing" }, "Unknown --from-route"],
    [
      "role mismatch",
      { role: "student", from: "teacher-a" },
      "outside the selected student role"
    ],
    [
      "conflicting filters",
      { route: "student-a", from: "student-a" },
      "cannot be combined"
    ]
  ]) {
    try {
      selectAuditRoutes(selectionMatrix, options);
      failures.push(`${name} selection did not throw`);
    } catch (error) {
      if (!String(error).includes(expectedMessage)) {
        failures.push(`${name} selection error was not actionable: ${error}`);
      }
    }
  }
  if (failures.length)
    throw new Error(`Matrix self-test failed: ${failures.join("; ")}`);
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        routes: matrixRoutes.length,
        roles: Object.fromEntries(
          ["student", "teacher", "admin"].map(role => [
            role,
            matrixRoutes.filter(route => route.role === role).length
          ])
        ),
        courseFixtures: matrixRoutes.filter(route => route.requiresCourse)
          .length,
        dynamicFixtures: androidDynamicRoutes.length,
        fixturePolicyAssertions: 3,
        requiredResponses: matrixRoutes.filter(
          route => route.requiredRequestPath
        ).length,
        interactionRoutes: interactionRoutes.length,
        multiStepInteractionRoutes: multiStepInteractionRoutes.length,
        interactionSteps,
        resumePolicyAssertions: 5,
        child: childSelfTest.stdout.trim()
      },
      null,
      2
    )}\n`
  );
  process.exit(0);
}

if (listOnly) {
  routes.forEach(route => {
    process.stdout.write(
      `${route.role.padEnd(7)} ${route.name} ${route.entry}\n`
    );
  });
  process.exit(0);
}
if (listJson) {
  process.stdout.write(`${JSON.stringify(routes, null, 2)}\n`);
  process.exit(0);
}

const routeFixtures = await resolveStudentRouteFixtures(routes);
if (fixtureCheck) {
  const fixtureResults = routes
    .filter(route => route.requiresCourse || route.fixtureKind)
    .map(route => {
      const fixtureResult = routeFixtures.get(route.name);
      const unavailable = getRouteFixtureUnavailable(route, fixtureResult, {
        allowWriteRoutes: allowExamStart
      });
      if (unavailable) {
        return {
          role: route.role,
          name: route.name,
          status: "skipped",
          reason: unavailable.reason,
          evidence: unavailable.evidence
        };
      }
      const fixtures = fixtureResult?.fixtures || {};
      return {
        role: route.role,
        name: route.name,
        status: "resolved",
        fixtures,
        resolvedEntry: route.requiresCourse
          ? route.entry.replace(
              /\/course\/1(?=\?|$)/,
              `/course/${fixtures.courseId}`
            )
          : resolveFixtureTemplate(route.entry, fixtures),
        requiredRequestPath: route.requiredRequestPath
          ? resolveFixtureTemplate(route.requiredRequestPath, fixtures)
          : null,
        evidence: fixtureResult?.evidence || []
      };
    });
  const skipped = fixtureResults.filter(item => item.status === "skipped");
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: skipped.length === 0,
        status: skipped.length === 0 ? "resolved" : "partial",
        resolved: fixtureResults.length - skipped.length,
        skipped: skipped.length,
        results: fixtureResults
      },
      null,
      2
    )}\n`
  );
  if (skipped.length > 0) process.exitCode = 4;
  process.exit();
}

mkdirSync(outDir, { recursive: true });
const expectedRole = {
  student: { roleType: 1, mobile: "13111111112" },
  teacher: { roleType: 2, mobile: "13111111113" },
  admin: { roleType: 3, mobile: "13111111111" }
};
const results = [];
let activeRole = "";
let terminalInterruption = null;

for (const [routeIndex, route] of routes.entries()) {
  const fixtureResult = routeFixtures.get(route.name);
  const fixtureUnavailable = getRouteFixtureUnavailable(route, fixtureResult, {
    allowWriteRoutes: allowExamStart
  });
  if (fixtureUnavailable) {
    const skipped = {
      role: route.role,
      name: route.name,
      entry: route.entry,
      resolvedEntry: null,
      expectedText:
        route.expect?.find(Boolean) || route.readyExpect?.find(Boolean) || "",
      status: "skipped",
      ok: false,
      failures: [],
      skip: fixtureUnavailable,
      fixtureEvidence: fixtureResult?.evidence || []
    };
    results.push(skipped);
    process.stdout.write(
      `[SKIP] ${route.role.padEnd(7)} ${route.name.padEnd(34)} ${fixtureUnavailable.reason}: ${fixtureUnavailable.evidence?.message || "fixture unavailable"}\n`
    );
    continue;
  }
  let routeEntry = route.entry;
  if (route.requiresCourse) {
    routeEntry = routeEntry.replace(
      /\/course\/1(?=\?|$)/,
      `/course/${fixtureResult.fixtures.courseId}`
    );
  }
  if (route.fixtureKind) {
    routeEntry = resolveFixtureTemplate(routeEntry, fixtureResult.fixtures);
  }
  const expected =
    route.expect?.find(Boolean) || route.readyExpect?.find(Boolean) || "";
  const reportPath = join(outDir, `${route.name}.json`);
  const commandArgs = [
    "--strict",
    "--entry",
    routeEntry,
    "--wait-ms",
    String(waitMs),
    "--min-content-ratio",
    minContentRatio,
    "--min-usable-content-ratio",
    minUsableContentRatio,
    "--api-origin",
    apiOrigin,
    "--out",
    reportPath
  ];
  if (serial) commandArgs.push("--serial", serial);
  commandArgs.push("--package", packageName);
  if (expected) commandArgs.push("--expect-text", expected);
  const expectedAccountMenuText =
    route.action && route.afterActionAccountMenuText
      ? route.afterActionAccountMenuText
      : route.accountMenuText;
  if (expectedAccountMenuText) {
    commandArgs.push("--account-menu-text", expectedAccountMenuText);
  }
  if (route.expectedForbidden) commandArgs.push("--expect-forbidden");
  const readyExpected = route.readyExpect?.find(Boolean) || "";
  if (readyExpected && route.action) {
    commandArgs.push("--ready-expect-text", readyExpected);
  }
  appendRouteActionArgs(commandArgs, route);
  if (route.requiredRequestPath) {
    commandArgs.push(
      "--required-request-path",
      route.fixtureKind
        ? resolveFixtureTemplate(
            route.requiredRequestPath,
            fixtureResult.fixtures
          )
        : route.requiredRequestPath
    );
  }
  if (expectsCompactDigitalHuman(routeEntry)) {
    commandArgs.push("--expect-compact-digital-human");
  }
  if (activeRole !== route.role) {
    commandArgs.push("--role", route.role);
  }

  const execution = parseAuditExecution(runNode(routeAudit, commandArgs));

  if (execution.interruption?.kind === "environment-interrupted") {
    terminalInterruption = {
      ...execution.interruption,
      route: route.name,
      routeIndex,
      reason: execution.interruption.message
    };
  } else if (execution.interruption?.kind === "runner-error") {
    terminalInterruption = {
      ...execution.interruption,
      route: route.name,
      routeIndex,
      reason: execution.interruption.message
    };
  }

  if (terminalInterruption) {
    results.push({
      role: route.role,
      name: route.name,
      entry: route.entry,
      resolvedEntry: routeEntry,
      expectedText: expected,
      status: terminalInterruption.kind,
      ok: false,
      failures: [],
      reportPath,
      report: execution.report,
      interruption: terminalInterruption,
      fixtureEvidence: fixtureResult?.evidence || []
    });
    process.stdout.write(
      `[INTERRUPTED] ${route.role.padEnd(7)} ${route.name}: ${terminalInterruption.code} ${String(terminalInterruption.reason).replace(/\s+/g, " ")}\n`
    );
    break;
  }

  const { auditResult, report } = execution;

  const roleExpectation = expectedRole[route.role];
  const roleMatches =
    report?.session?.roleType === roleExpectation.roleType &&
    report?.session?.username === roleExpectation.mobile &&
    report?.session?.roles?.length === 1 &&
    report.session.roles[0] === route.role;
  const failures = [...(report?.strict?.failures || [])];
  if (!roleMatches) {
    failures.push(
      `role mismatch: ${report?.session?.username || "none"}/${report?.session?.roleType || 0}/${report?.session?.roles?.join("+") || "none"}`
    );
  }
  const result = {
    role: route.role,
    name: route.name,
    entry: route.entry,
    resolvedEntry: routeEntry,
    expectedText: expected,
    status:
      auditResult.status === 0 && failures.length === 0 ? "passed" : "failed",
    ok: auditResult.status === 0 && failures.length === 0,
    failures,
    reportPath,
    report,
    fixtureEvidence: fixtureResult?.evidence || []
  };
  results.push(result);
  if (roleMatches) activeRole = route.role;

  process.stdout.write(
    `[${result.ok ? "OK" : "FAIL"}] ${route.role.padEnd(7)} ${route.name.padEnd(34)} width=${report?.mainContentWidthRatio ?? "?"} usable=${report?.mainContentUsableWidthRatio ?? "?"} overflow=${report?.document?.overflowX ?? "?"} ${failures.join(", ")}\n`
  );
}

const summary = {
  generatedAt: new Date().toISOString(),
  deviceSerial: serial || "default",
  androidPackage: packageName,
  apiOrigin: new URL(apiOrigin).origin,
  waitMs,
  minContentRatio: Number(minContentRatio),
  minUsableContentRatio: Number(minUsableContentRatio),
  fromRoute: fromRoute || null,
  status: terminalInterruption
    ? terminalInterruption.kind
    : results.some(result => result.status === "failed")
      ? "failed"
      : results.some(result => result.status === "skipped")
        ? "partial"
        : "passed",
  totals: {
    routes: routes.length,
    completed: results.filter(result =>
      ["passed", "failed"].includes(result.status)
    ).length,
    ok: results.filter(result => result.status === "passed").length,
    fail: results.filter(result => result.status === "failed").length,
    environmentInterrupted: results.filter(
      result => result.status === "environment-interrupted"
    ).length,
    runnerError: results.filter(result => result.status === "runner-error")
      .length,
    notRun: routes.length - results.length,
    skipped: results.filter(result => result.status === "skipped").length
  },
  interruption: terminalInterruption,
  notRunRoutes: terminalInterruption
    ? routes.slice(terminalInterruption.routeIndex + 1).map(route => ({
        role: route.role,
        name: route.name,
        entry: route.entry,
        reason: "matrix stopped after audit execution interruption"
      }))
    : [],
  results
};
const summaryPath = join(outDir, "summary.json");
writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
process.stdout.write(`Summary written: ${summaryPath}\n`);
if (terminalInterruption?.kind === "environment-interrupted")
  process.exitCode = 2;
else if (terminalInterruption?.kind === "runner-error") process.exitCode = 3;
else if (summary.totals.fail > 0) process.exitCode = 1;
else if (summary.totals.skipped > 0) process.exitCode = 4;
