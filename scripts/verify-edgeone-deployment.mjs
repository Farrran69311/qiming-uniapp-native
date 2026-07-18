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
    "Usage: node scripts/verify-edgeone-deployment.mjs <deploy-url> [--json <path>] [--binary <path>]"
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
    if (option !== "--json" && option !== "--binary") {
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

function isUnauthorized(response) {
  return response.status === 401;
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

function assertJsonAsset(response, body, path) {
  if (!response.ok) {
    throw new Error(`${path}: HTTP ${response.status}`);
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
    throw new Error(`${path}: HTTP ${response.status}`);
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

async function verifyAsset(baseUrl, tokenData, check) {
  const url = assetUrl(baseUrl, tokenData, check.path);
  let response;
  let body;
  let lastError;
  for (let attempt = 1; attempt <= MAX_ASSET_ATTEMPTS; attempt += 1) {
    try {
      response = await fetchWithTimeout(url, { redirect: "follow" });
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
    throw lastError || new Error(`${check.path}: no response`);
  }
  if (check.kind === "json") assertJsonAsset(response, body, check.path);
  else assertBinaryAsset(response, body, check.path);
  return { url, bytes: body.byteLength };
}

async function verifyDeployment(deployUrl, checks) {
  const baseUrl = getBaseUrl(deployUrl);
  let tokenData = initialAccessToken(deployUrl);

  let refreshes = 0;
  for (;;) {
    try {
      const results = [];
      for (const check of checks) {
        results.push({
          check,
          result: await verifyAsset(baseUrl, tokenData, check)
        });
      }
      return results;
    } catch (error) {
      const unauthorized =
        error instanceof Error && /HTTP 401\b/.test(error.message);
      if (!unauthorized || refreshes >= MAX_TOKEN_REFRESHES) throw error;
      tokenData = await requestFreshAccessToken(baseUrl.hostname);
      refreshes += 1;
      console.warn(
        "EdgeOne access URL token expired; fetched a fresh token for verification."
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
