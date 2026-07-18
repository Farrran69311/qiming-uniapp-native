#!/usr/bin/env node

const EDGEONE_API_ENDPOINTS = {
  china: "https://pages-api.cloud.tencent.com/v1",
  global: "https://pages-api.edgeone.ai/v1"
};

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_TOKEN_REFRESHES = 2;
const MAX_ASSET_ATTEMPTS = 5;
const ASSET_RETRY_DELAY_MS = 2_000;

function usage() {
  console.error(
    "Usage: node scripts/verify-edgeone-deployment.mjs <deploy-url> [--json <path>] [--binary <path>] [--asset <path>]"
  );
}

function parseArguments(argv) {
  const [deployUrl, ...rest] = argv;
  if (!deployUrl) {
    usage();
    throw new Error("EdgeOne deployment URL is required");
  }

  const checks = [];
  for (let index = 0; index < rest.length; index += 1) {
    const option = rest[index];
    if (option !== "--json" && option !== "--binary" && option !== "--asset") {
      usage();
      throw new Error(`Unknown option: ${option}`);
    }
    const path = rest[index + 1];
    if (!path || path.startsWith("--")) {
      usage();
      throw new Error(`${option} requires a path`);
    }
    checks.push({ kind: option.slice(2), path });
    index += 1;
  }

  if (checks.length === 0) {
    usage();
    throw new Error("At least one deployment asset must be checked");
  }

  return { deployUrl, checks };
}

function normalizeAuthorization(token) {
  const value = String(token || "").trim();
  if (!value) return "";
  return /^bearer\s+/i.test(value) ? value : `Bearer ${value}`;
}

function getBaseUrl(value) {
  const url = new URL(value);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

function withAccessToken(baseUrl, tokenData) {
  const url = new URL(baseUrl.toString());
  if (tokenData?.token) {
    url.searchParams.set("eo_token", tokenData.token);
    url.searchParams.set("eo_time", String(tokenData.timestamp));
  }
  return url;
}

function assetUrl(baseUrl, tokenData, path) {
  const url = new URL(withAccessToken(baseUrl, tokenData));
  url.pathname = `/${String(path).replace(/^\/+/, "")}`;
  return url;
}

function initialAccessToken(deployUrl) {
  const url = new URL(deployUrl);
  const token = url.searchParams.get("eo_token");
  const timestamp = url.searchParams.get("eo_time");
  if (!token || !timestamp) return null;
  return { token, timestamp };
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function cookiePairsFromResponse(response) {
  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
  return setCookies
    .map(value => String(value).split(";", 1)[0].trim())
    .filter(Boolean)
    .map(value => {
      const separator = value.indexOf("=");
      return separator > 0
        ? [value.slice(0, separator), value.slice(separator + 1)]
        : null;
    })
    .filter(Boolean);
}

function cookieMapFromHeader(value = "") {
  const cookies = new Map();
  for (const pair of String(value).split(";")) {
    const separator = pair.indexOf("=");
    if (separator > 0) {
      cookies.set(
        pair.slice(0, separator).trim(),
        pair.slice(separator + 1).trim()
      );
    }
  }
  return cookies;
}

function cookieHeaderFromMap(cookies) {
  return Array.from(cookies, ([name, value]) => `${name}=${value}`).join("; ");
}

async function fetchFollowingRedirects(url, options = {}) {
  let currentUrl = new URL(url);
  const headers = new Headers(options.headers || {});
  const cookies = cookieMapFromHeader(headers.get("cookie") || "");
  headers.delete("cookie");

  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    const requestHeaders = new Headers(headers);
    const cookieHeader = cookieHeaderFromMap(cookies);
    if (cookieHeader) requestHeaders.set("Cookie", cookieHeader);
    const response = await fetchWithTimeout(currentUrl, {
      ...options,
      headers: requestHeaders,
      redirect: "manual"
    });
    for (const [name, value] of cookiePairsFromResponse(response)) {
      cookies.set(name, value);
    }

    const location = response.headers.get("location");
    if (location && response.status >= 300 && response.status < 400) {
      currentUrl = new URL(location, currentUrl);
      continue;
    }
    return {
      response,
      cookieHeader: cookieHeaderFromMap(cookies)
    };
  }

  throw new Error("EdgeOne access redirect limit exceeded");
}

function responsePayloadToken(payload) {
  const response =
    payload?.Data?.Response ||
    payload?.data?.Response ||
    payload?.Response ||
    payload;
  const token = response?.Token || response?.token;
  const timestamp = response?.Timestamp || response?.timestamp;
  if (!token || timestamp === undefined || timestamp === null) return null;
  return { token: String(token), timestamp: String(timestamp) };
}

async function requestFreshAccessToken(hostname) {
  const rawApiToken = process.env.EDGEONE_API_TOKEN;
  const authorization = normalizeAuthorization(rawApiToken);
  if (!authorization) {
    throw new Error(
      "EDGEONE_API_TOKEN is unavailable; cannot refresh the deployment URL token"
    );
  }

  const configuredRegion = String(
    process.env.EDGEONE_PAGES_API_REGION || ""
  ).toLowerCase();
  const regions =
    configuredRegion === "china" || configuredRegion === "global"
      ? [configuredRegion]
      : ["china", "global"];
  const endpointOverride = String(
    process.env.EDGEONE_PAGES_API_ENDPOINT || ""
  ).trim();
  const endpoints = endpointOverride
    ? [["custom", endpointOverride]]
    : regions.map(region => [region, EDGEONE_API_ENDPOINTS[region]]);
  const failures = [];

  for (const [region, endpoint] of endpoints) {
    try {
      const response = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: authorization
        },
        body: JSON.stringify({
          Action: "DescribePagesEncipherToken",
          Text: hostname
        })
      });
      const payload = await response.json().catch(() => null);
      const tokenData = responsePayloadToken(payload);
      if (response.ok && tokenData) {
        return tokenData;
      }
      failures.push(`${region}:${response.status}`);
    } catch (error) {
      failures.push(
        `${region}:${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  throw new Error(
    `EdgeOne access token refresh failed (${failures.join(", ") || "no response"})`
  );
}

async function readResponseBody(response) {
  return Buffer.from(await response.arrayBuffer());
}

function isRetryableAssetStatus(status) {
  return (
    status === 404 ||
    status === 408 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  );
}

function sleep(durationMs) {
  return new Promise(resolve => setTimeout(resolve, durationMs));
}

function contentType(response) {
  return String(response.headers.get("content-type") || "").toLowerCase();
}

function responseStatus(response) {
  const message = response.headers.get("x-eop-msg");
  return `HTTP ${response.status}${message ? ` (${message})` : ""}`;
}

async function requestAsset(url, headers = {}) {
  let response;
  let body;
  let lastError;
  let cookieHeader = headers.Cookie || headers.cookie || "";
  for (let attempt = 1; attempt <= MAX_ASSET_ATTEMPTS; attempt += 1) {
    try {
      const requestHeaders = { ...headers };
      if (cookieHeader) requestHeaders.Cookie = cookieHeader;
      const result = await fetchFollowingRedirects(url, {
        headers: requestHeaders
      });
      response = result.response;
      cookieHeader = result.cookieHeader || cookieHeader;
      body = await readResponseBody(response);
      if (
        !isRetryableAssetStatus(response.status) ||
        attempt === MAX_ASSET_ATTEMPTS
      ) {
        break;
      }
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ASSET_ATTEMPTS) throw error;
    }
    await sleep(ASSET_RETRY_DELAY_MS);
  }
  if (!response || !body) {
    throw lastError || new Error("EdgeOne returned no response");
  }
  return { response, body, cookieHeader };
}

async function establishAccessSession(baseUrl, tokenData) {
  if (!tokenData?.token) return { tokenData: null, cookieHeader: "" };
  const rootUrl = withAccessToken(baseUrl, tokenData);
  const { response, cookieHeader } = await requestAsset(rootUrl);
  if (!response.ok) {
    throw new Error(`EdgeOne access session: ${responseStatus(response)}`);
  }
  return {
    tokenData,
    cookieHeader
  };
}

function assertJsonAsset(response, body, path) {
  if (!response.ok) {
    throw new Error(`${path}: ${responseStatus(response)}`);
  }
  if (!/^application\/json(?:\s*;|$)/i.test(contentType(response))) {
    throw new Error(
      `${path}: unexpected content type ${contentType(response) || "<missing>"}`
    );
  }
  try {
    JSON.parse(body.toString("utf8"));
  } catch {
    throw new Error(`${path}: response is not valid JSON`);
  }
}

function assertBinaryAsset(response, body, path) {
  if (!response.ok) {
    throw new Error(`${path}: ${responseStatus(response)}`);
  }
  if (
    !/^(?:application\/octet-stream|model\/gltf-binary|application\/vrm)(?:\s*;|$)/i.test(
      contentType(response)
    )
  ) {
    throw new Error(
      `${path}: unexpected content type ${contentType(response) || "<missing>"}`
    );
  }
  if (body.byteLength <= 1_000_000) {
    throw new Error(
      `${path}: response is unexpectedly small (${body.byteLength} bytes)`
    );
  }
  if (body.toString("ascii", 0, 4) !== "glTF") {
    throw new Error(`${path}: response is not a glTF/VRM binary`);
  }
}

function assertStaticAsset(response, body, path) {
  if (!response.ok) {
    throw new Error(`${path}: ${responseStatus(response)}`);
  }

  const type = contentType(response);
  if (!type || /^text\/html(?:\s*;|$)/i.test(type)) {
    throw new Error(
      `${path}: unexpected content type ${type || "<missing>"}; expected a static asset response`
    );
  }
  if (body.byteLength === 0) {
    throw new Error(`${path}: response is empty`);
  }
  if (/^\s*(?:<!doctype\s+html|<html\b)/i.test(body.toString("utf8", 0, 256))) {
    throw new Error(`${path}: response contains the SPA HTML fallback`);
  }
}

async function verifyAsset(baseUrl, accessSession, check) {
  const useCookie = Boolean(accessSession.cookieHeader);
  const url = assetUrl(
    baseUrl,
    useCookie ? null : accessSession.tokenData,
    check.path
  );
  const headers = useCookie ? { Cookie: accessSession.cookieHeader } : {};
  const { response, body } = await requestAsset(url, headers);
  if (check.kind === "json") assertJsonAsset(response, body, check.path);
  else if (check.kind === "binary")
    assertBinaryAsset(response, body, check.path);
  else assertStaticAsset(response, body, check.path);
  return { url, bytes: body.byteLength };
}

async function verifyDeployment(deployUrl, checks) {
  const baseUrl = getBaseUrl(deployUrl);
  let tokenData = initialAccessToken(deployUrl);
  let accessSession = await establishAccessSession(baseUrl, tokenData).catch(
    error => {
      if (!(error instanceof Error) || !/HTTP 401\b/.test(error.message)) {
        throw error;
      }
      return null;
    }
  );

  let refreshes = 0;
  for (;;) {
    try {
      if (!accessSession) {
        throw new Error("EdgeOne access session: HTTP 401");
      }
      const results = [];
      for (const check of checks) {
        results.push({
          check,
          result: await verifyAsset(baseUrl, accessSession, check)
        });
      }
      return results;
    } catch (error) {
      const unauthorized =
        error instanceof Error && /HTTP 401\b/.test(error.message);
      if (!unauthorized || refreshes >= MAX_TOKEN_REFRESHES) throw error;
      tokenData = await requestFreshAccessToken(baseUrl.hostname);
      accessSession = await establishAccessSession(baseUrl, tokenData);
      refreshes += 1;
      console.warn(
        "EdgeOne access session was rejected; fetched a fresh token and renewed the session."
      );
    }
  }
}

try {
  const { deployUrl, checks } = parseArguments(process.argv.slice(2));
  const results = await verifyDeployment(deployUrl, checks);
  for (const { check, result } of results) {
    console.log(
      `EdgeOne asset verified: ${check.path} (${result.bytes} bytes)`
    );
  }
} catch (error) {
  console.error(
    `EdgeOne deployment verification failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
}
