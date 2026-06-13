import { http } from "@/utils/http";
import { usePermissionStoreHook } from "@/store/modules/permission";
import { useUserStoreHook } from "@/store/modules/user";

type Role = "student" | "teacher" | "admin";

const ACCOUNTS: Record<Role, string> = {
  student: "13111111112",
  teacher: "13111111113",
  admin: "13111111111"
};

const ROLE_META: Record<
  Role,
  { roleType: number; fallbackNickname: string; roles: Role[] }
> = {
  student: { roleType: 1, fallbackNickname: "吴同学", roles: ["student"] },
  teacher: { roleType: 2, fallbackNickname: "教师", roles: ["teacher"] },
  admin: { roleType: 3, fallbackNickname: "管理员", roles: ["admin"] }
};

const PASSWORD = "123456";
const nativeApiBaseURL = "https://aiedu-api.intelledu.cn";

let currentRole: Role | null = null;
let inflight: Promise<void> | null = null;

interface LoginResp {
  data: {
    accessToken: string;
    accessExpire: number;
    refreshAfter?: number;
  };
}

interface DetailResp {
  data: {
    userInfo: {
      id: number;
      mobile: string;
      nickname: string;
      avatar?: string;
      roleType: number;
      sex?: number;
      info?: string;
      bannerUrl?: string;
    };
  };
}

function getCachedUserInfo() {
  try {
    return JSON.parse(localStorage.getItem("user-info") || "{}") || {};
  } catch {
    return {};
  }
}

function cachedSessionMatches(role: Role) {
  const cached = getCachedUserInfo();
  const cachedDemoRole =
    localStorage.getItem("qiming-demo-role") ||
    sessionStorage.getItem("qiming-demo-role");
  return (
    (!currentRole || currentRole === role) &&
    cachedDemoRole === role &&
    Number(cached?.roleType) === ROLE_META[role].roleType &&
    Array.isArray(cached?.roles) &&
    cached.roles.includes(role) &&
    Boolean(cached?.accessToken || cached?.refreshToken)
  );
}

function isNativePreviewRuntime() {
  const query = `${window.location.search}&${window.location.hash}`;
  return (
    document.documentElement.classList.contains("qiming-native-webview") ||
    query.includes("qimingNative=1") ||
    localStorage.getItem("qimingNativeWebView") === "1" ||
    sessionStorage.getItem("qimingNativeWebView") === "1"
  );
}

function writeDemoSession(
  role: Role,
  tokenValue: string,
  expiresMs: number,
  backendUser?: DetailResp["data"]["userInfo"]
) {
  const cookieVal = JSON.stringify({
    accessToken: tokenValue,
    expires: expiresMs,
    refreshToken: tokenValue
  });
  document.cookie = `authorized-token=${encodeURIComponent(cookieVal)}; path=/; expires=${new Date(expiresMs).toUTCString()}`;
  document.cookie = `multiple-tabs=true; path=/; max-age=${7 * 86400}`;

  const roleMeta = ROLE_META[role];
  const useBackendIdentity = backendUser?.roleType === roleMeta.roleType;
  const userInfo = {
    accessToken: tokenValue,
    refreshToken: tokenValue,
    expires: expiresMs,
    avatar: useBackendIdentity ? backendUser?.avatar || "" : "",
    username: useBackendIdentity ? backendUser.mobile : ACCOUNTS[role],
    nickname:
      useBackendIdentity && backendUser?.nickname
        ? backendUser.nickname
        : roleMeta.fallbackNickname,
    roles: roleMeta.roles,
    permissions: ["*:*:*"],
    roleType: roleMeta.roleType,
    userId: backendUser?.id ?? roleMeta.roleType
  };

  localStorage.setItem("user-info", JSON.stringify(userInfo));
  localStorage.setItem("userRoleType", String(userInfo.roleType));
  localStorage.setItem("userMobile", userInfo.username);
  localStorage.setItem("userId", String(userInfo.userId));
  localStorage.setItem("qiming-demo-role", role);
  sessionStorage.setItem("qiming-demo-role", role);

  const userStore = useUserStoreHook();
  userStore.SET_AVATAR(userInfo.avatar);
  userStore.SET_USERNAME(userInfo.username);
  userStore.SET_NICKNAME(userInfo.nickname);
  userStore.SET_ROLES(userInfo.roles);
  userStore.SET_PERMS(userInfo.permissions);
  userStore.SET_USERID(userInfo.userId);
  usePermissionStoreHook().clearAllCachePage();

  window.dispatchEvent(
    new CustomEvent("userInfoUpdated", {
      detail: userInfo
    })
  );
  currentRole = role;
}

function apiUrl(path: string) {
  const configuredBase = import.meta.env.VITE_API_URL || "/api";
  const base = (
    isNativePreviewRuntime() && configuredBase.startsWith("/")
      ? nativeApiBaseURL
      : configuredBase
  ).replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function nativeFetchJson<T>(
  path: string,
  init: RequestInit,
  originalError: unknown
) {
  const url = apiUrl(path);
  let lastError: unknown = originalError;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        credentials: "include",
        ...init,
        headers: {
          Accept: "application/json",
          ...((init.headers || {}) as Record<string, string>)
        }
      });

      if (response.ok) return (await response.json()) as T;
      lastError = new Error(`Native fetch failed: ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await sleep(300 * (attempt + 1));
  }

  console.warn("[DemoSession] native backend retry failed", {
    url,
    error: lastError
  });
  throw originalError;
}

async function fetchUserDetailWithToken(token: string) {
  try {
    return await http.request<DetailResp>(
      "post",
      "/edu/v1/user/detail",
      { data: {} },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (error) {
    if (!isNativePreviewRuntime()) throw error;

    return await nativeFetchJson<DetailResp>(
      "/edu/v1/user/detail",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: "{}"
      },
      error
    );
  }
}

async function requestLogin(role: Role) {
  try {
    return await http.request<LoginResp>("post", "/edu/v1/user/login", {
      data: { mobile: ACCOUNTS[role], password: PASSWORD }
    });
  } catch (error) {
    if (!isNativePreviewRuntime()) throw error;

    return await nativeFetchJson<LoginResp>(
      "/edu/v1/user/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ mobile: ACCOUNTS[role], password: PASSWORD })
      },
      error
    );
  }
}

async function doLogin(role: Role) {
  const loginRes = await requestLogin(role);
  const token = loginRes.data.accessToken;
  const expiresMs = loginRes.data.accessExpire * 1000;

  const detailRes = await fetchUserDetailWithToken(token);
  writeDemoSession(role, token, expiresMs, detailRes.data.userInfo);
}

export async function ensureDemoSession(role: Role = "teacher") {
  if (cachedSessionMatches(role)) {
    currentRole = role;
    return;
  }

  if (inflight) await inflight;

  if (cachedSessionMatches(role)) {
    currentRole = role;
    return;
  }

  inflight = doLogin(role)
    .catch(error => {
      console.error("[DemoSession] backend login failed", error);
      throw error;
    })
    .finally(() => (inflight = null));

  await inflight;
}

export function buildIframeUrl(route: string) {
  const base = window.location.origin;
  return `${base}/#${route.startsWith("/") ? route : "/" + route}`;
}
