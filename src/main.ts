import "./polyfills/nativeCompat";
import App from "./App.vue";
import router from "./router";
import { setupStore } from "@/store";
import { useI18n } from "@/plugins/i18n";
import { getPlatformConfig } from "./config";
import { MotionPlugin } from "@vueuse/motion";
import { useEcharts } from "@/plugins/echarts";
import { createApp, type Directive } from "vue";
import { useAppStoreHook } from "@/store/modules/app";
import { storageLocal } from "@pureadmin/utils";
import { useVxeTable } from "@/plugins/vxeTable";
import { useElementPlus } from "@/plugins/elementPlus";
import { injectResponsiveStorage } from "@/utils/responsive";
import { registerPwa } from "@/utils/pwa";
import { initClarity } from "@/utils/clarity";
import { userKey, type DataInfo } from "@/utils/auth";

import Table from "@pureadmin/table";
import PureDescriptions from "@pureadmin/descriptions";

// 引入重置样式
import "./style/reset.scss";
import "element-plus/dist/index.css";
// 导入公共样式
import "./style/index.scss";
// 一定要在main.ts中导入tailwind.css，防止vite每次hmr都会请求src/style/index.scss整体css文件导致热更新慢的问题
import "./style/tailwind.css";
// 导入字体图标
import "./assets/iconfont/iconfont.js";
import "./assets/iconfont/iconfont.css";

function readNativeQueryParams() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashQuery = window.location.hash.includes("?")
    ? window.location.hash.slice(window.location.hash.indexOf("?") + 1)
    : "";
  const hashParams = new URLSearchParams(hashQuery);
  const queryNative =
    searchParams.get("qimingNative") === "1" ||
    hashParams.get("qimingNative") === "1";
  const queryMiniProgram =
    searchParams.get("qimingMiniProgram") === "1" ||
    hashParams.get("qimingMiniProgram") === "1";
  const storedNative =
    sessionStorage.getItem("qimingNativeWebView") === "1" ||
    localStorage.getItem("qimingNativeWebView") === "1";
  const storedMiniProgram =
    sessionStorage.getItem("qimingMiniProgramWebView") === "1" ||
    localStorage.getItem("qimingMiniProgramWebView") === "1";
  const nativeStatusTop =
    hashParams.get("nativeStatusTop") ||
    searchParams.get("nativeStatusTop") ||
    sessionStorage.getItem("qimingNativeStatusTop") ||
    localStorage.getItem("qimingNativeStatusTop") ||
    "";

  if (queryNative || queryMiniProgram) {
    sessionStorage.setItem("qimingNativeWebView", "1");
    localStorage.setItem("qimingNativeWebView", "1");
  }
  if (queryMiniProgram) {
    sessionStorage.setItem("qimingMiniProgramWebView", "1");
    localStorage.setItem("qimingMiniProgramWebView", "1");
  }
  if (nativeStatusTop) {
    sessionStorage.setItem("qimingNativeStatusTop", nativeStatusTop);
    localStorage.setItem("qimingNativeStatusTop", nativeStatusTop);
  }

  return {
    isNative: queryNative || queryMiniProgram || storedNative,
    isMiniProgram: queryMiniProgram || storedMiniProgram,
    nativeStatusTop
  };
}

function normalizeNativeInitialHash() {
  if (typeof window === "undefined") return;
  const hash = window.location.hash || "";
  const queryStart = hash.indexOf("?");
  const path =
    (queryStart >= 0 ? hash.slice(1, queryStart) : hash.slice(1)) || "/";
  const hashQuery = queryStart >= 0 ? hash.slice(queryStart + 1) : "";
  const params = new URLSearchParams(
    hashQuery || window.location.search.slice(1)
  );
  if (params.get("qimingNative") !== "1" || path !== "/home") return;

  const role = params.get("demoRole") || "";
  if (!["student", "teacher", "admin"].includes(role)) return;

  params.delete("menu");
  params.delete("mode");
  const targetPath = role === "student" ? "/account" : "/welcome/index";
  if (role === "student") params.set("menu", "home");
  const targetQuery = params.toString();
  const targetHash = `#${targetPath}${targetQuery ? `?${targetQuery}` : ""}`;
  const targetUrl = `${window.location.pathname}${window.location.search}${targetHash}`;
  window.history.replaceState(window.history.state, "", targetUrl);
}

function normalizeNativeStatusbarTop(value: string, clearance = 0) {
  const statusTop = Number(value);
  if (!Number.isFinite(statusTop) || statusTop <= 0) return 0;
  return Math.min(Math.max(statusTop, 22) + clearance, 64);
}

function readCurrentHashRouteInfo() {
  const hash = window.location.hash || "";
  const queryStart = hash.indexOf("?");
  const path =
    (queryStart >= 0 ? hash.slice(1, queryStart) : hash.slice(1)) || "/";
  const hashQuery = queryStart >= 0 ? hash.slice(queryStart + 1) : "";
  const params = new URLSearchParams(
    hashQuery || window.location.search.slice(1)
  );
  return {
    path,
    role: params.get("demoRole") || ""
  };
}

function resolveMiniProgramDocumentTitle(
  path: string,
  role: string,
  routeTitle?: unknown
) {
  const titleFallbacks: Record<string, string> = {
    "menus.pureHome": "启明智教",
    "menus.pureLogin": "登录",
    "menus.pureEmpty": "启明智教",
    "menus.aiPPT": "AI 课件",
    "menus.virtualLab": "虚拟实验室",
    "menus.competition": "综合赛事",
    "menus.todo": "待办"
  };

  if (path === "/welcome/index") {
    if (role === "admin") return "管理工作台";
    if (role === "teacher") return "教师工作台";
    return "启明智教";
  }
  if (path === "/account") return "学生主页";
  if (path === "/course/list") return "课程";
  if (path === "/course/category") return "课程分类";
  if (path === "/course/assessment") return "作业考试";
  if (path.startsWith("/course/discussion")) return "讨论管理";
  if (path.startsWith("/course/")) return "课程学习";
  if (path === "/user/list") return "用户管理";
  if (path === "/ai-app/workspace" || path === "/account/ai-app") {
    return "AI App";
  }
  if (path.startsWith("/student-exam-center/do")) return "参加考试";
  if (path.startsWith("/exam-paper/result")) return "考试结果";
  if (typeof routeTitle === "string" && routeTitle.trim()) {
    const normalizedTitle = routeTitle.trim();
    if (titleFallbacks[normalizedTitle]) return titleFallbacks[normalizedTitle];
    if (normalizedTitle.startsWith("menus.")) return "启明智教";
    return normalizedTitle;
  }
  return "启明智教";
}

function applyNativeWebViewRuntime() {
  if (typeof window === "undefined") return;
  normalizeNativeInitialHash();
  const { isNative, isMiniProgram, nativeStatusTop } = readNativeQueryParams();
  if (!isNative) return;

  document.title = "启明智教";
  const root = document.documentElement;
  root.classList.add("qiming-native-webview");
  root.dataset.qimingNative = "true";
  const isAndroidNative =
    !isMiniProgram && /Android/i.test(window.navigator.userAgent);
  root.classList.toggle("qiming-native-android", isAndroidNative);
  if (isMiniProgram) {
    root.classList.add("qiming-mini-program-webview");
    root.dataset.qimingMiniProgram = "true";
    const initialRoute = readCurrentHashRouteInfo();
    document.title = resolveMiniProgramDocumentTitle(
      initialRoute.path,
      initialRoute.role
    );
  }
  let maxObservedViewportHeight = 0;
  let focusedNativeInput = false;

  const isEditableElement = (target: EventTarget | null) => {
    return (
      target instanceof HTMLElement &&
      target.matches(
        "input, textarea, [contenteditable='true'], .el-textarea__inner"
      )
    );
  };

  const setViewportVars = () => {
    const viewportHeight =
      window.visualViewport?.height ||
      window.innerHeight ||
      root.clientHeight ||
      0;
    const viewportWidth =
      window.visualViewport?.width ||
      window.innerWidth ||
      root.clientWidth ||
      0;

    if (viewportHeight > 0) {
      root.style.setProperty("--qiming-native-vh", `${viewportHeight}px`);
    }
    if (viewportWidth > 0) {
      root.style.setProperty("--qiming-native-vw", `${viewportWidth}px`);
    }

    const activeEditable = isEditableElement(document.activeElement);
    const screenHeight =
      window.screen?.height > 240 && window.screen.height < 1200
        ? window.screen.height
        : 0;
    const heightCandidates = [
      viewportHeight,
      window.innerHeight || 0,
      root.clientHeight || 0,
      screenHeight
    ].filter(Boolean);

    if (!focusedNativeInput && !activeEditable) {
      maxObservedViewportHeight = Math.max(
        maxObservedViewportHeight,
        ...heightCandidates
      );
    } else if (maxObservedViewportHeight <= 0) {
      maxObservedViewportHeight = Math.max(...heightCandidates);
    }

    const stableViewportHeight =
      maxObservedViewportHeight || Math.max(...heightCandidates);
    const visualKeyboardHeight = Math.max(
      0,
      (window.innerHeight || root.clientHeight || 0) - viewportHeight
    );
    const shrinkKeyboardHeight = Math.max(
      0,
      stableViewportHeight - viewportHeight
    );
    const keyboardOpen =
      visualKeyboardHeight > Math.max(96, stableViewportHeight * 0.16) ||
      ((focusedNativeInput || activeEditable) &&
        shrinkKeyboardHeight > Math.max(96, stableViewportHeight * 0.16));
    const keyboardHeight = keyboardOpen
      ? Math.max(visualKeyboardHeight, shrinkKeyboardHeight)
      : 0;
    root.classList.toggle("qiming-native-keyboard-open", keyboardOpen);
    root.style.setProperty(
      "--qiming-native-keyboard-height",
      keyboardOpen ? `${keyboardHeight}px` : "0px"
    );
  };

  setViewportVars();
  window.addEventListener("resize", setViewportVars, { passive: true });
  window.visualViewport?.addEventListener("resize", setViewportVars, {
    passive: true
  });
  window.visualViewport?.addEventListener("scroll", setViewportVars, {
    passive: true
  });

  document.addEventListener(
    "focusin",
    event => {
      const target = event.target;
      if (!isEditableElement(target)) return;

      focusedNativeInput = true;
      setViewportVars();
      window.setTimeout(() => {
        setViewportVars();
        (target as HTMLElement).scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: "smooth"
        });
      }, 240);
    },
    true
  );
  document.addEventListener(
    "focusout",
    () => {
      window.setTimeout(() => {
        focusedNativeInput = isEditableElement(document.activeElement);
        setViewportVars();
      }, 180);
    },
    true
  );

  const statusTop = normalizeNativeStatusbarTop(
    nativeStatusTop,
    isAndroidNative ? 6 : 0
  );
  if (statusTop > 0) {
    const statusTopPx = `${statusTop}px`;
    root.style.setProperty("--pure-safe-area-top", statusTopPx);
    root.style.setProperty("--qiming-native-safe-top", statusTopPx);
    root.style.setProperty("--qiming-native-status-top", statusTopPx);
    root.style.setProperty("--qiming-native-statusbar-offset", statusTopPx);
  }

  const syncStatusBar = () => {
    try {
      const plusApi = (globalThis as any).plus;
      const isDarkSurface =
        readCurrentHashRouteInfo().path === "/home" ||
        root.classList.contains("dark") ||
        document.body?.classList.contains("dark");
      plusApi?.navigator?.setStatusBarStyle?.(isDarkSurface ? "light" : "dark");
      plusApi?.navigator?.setStatusBarBackground?.("rgba(0,0,0,0)");
    } catch {
      // The H5 preview and some WebView runtimes do not expose plus.navigator.
    }
  };

  syncStatusBar();
  document.addEventListener("plusready", syncStatusBar, { once: true });
  new MutationObserver(syncStatusBar).observe(root, {
    attributes: true,
    attributeFilter: ["class"]
  });

  const notifyNativeShell = (type: "bridge-ready" | "loaded") => {
    const payload = {
      source: "qiming-h5",
      type,
      href: window.location.href,
      title: document.title,
      online: navigator.onLine,
      timestamp: Date.now()
    };
    try {
      (window as any).uni?.postMessage?.({ data: payload });
    } catch {
      // uni.webView bridge is not injected in the desktop H5 preview.
    }
    try {
      window.parent?.postMessage(payload, "*");
    } catch {
      // Cross-origin parent access can be unavailable in some WebViews.
    }
  };

  const getSingleQueryValue = (value: unknown) =>
    Array.isArray(value) ? value[0] : value;

  const syncMiniProgramDocumentTitle = () => {
    if (!isMiniProgram) return;
    const currentRoute = router.currentRoute.value;
    const role = String(getSingleQueryValue(currentRoute.query.demoRole) || "");
    document.title = resolveMiniProgramDocumentTitle(
      currentRoute.path,
      role,
      currentRoute.meta?.title
    );
  };

  const getNativeUserRole = () => {
    const storedUserInfo = storageLocal().getItem<DataInfo<number>>(userKey);
    if (storedUserInfo?.roleType === 3) return "admin";
    if (storedUserInfo?.roleType === 2) return "teacher";
    if (storedUserInfo?.roleType === 1) return "student";
    const storedRoles = Array.isArray(storedUserInfo?.roles)
      ? storedUserInfo.roles
      : [];
    if (storedRoles.includes("admin")) return "admin";
    if (storedRoles.includes("teacher")) return "teacher";
    if (storedRoles.includes("student")) return "student";

    const parseStoredValue = (rawValue: string | null) => {
      if (!rawValue) return null;
      try {
        const parsed = JSON.parse(rawValue);
        return parsed?.value ?? parsed?.data ?? parsed;
      } catch {
        return null;
      }
    };
    const userInfo =
      parseStoredValue(localStorage.getItem("user-info")) ||
      parseStoredValue(localStorage.getItem("authorized-token"));
    const roleType = Number(userInfo?.roleType);
    if (roleType === 3) return "admin";
    if (roleType === 2) return "teacher";
    if (roleType === 1) return "student";
    const roles = Array.isArray(userInfo?.roles) ? userInfo.roles : [];
    if (roles.includes("admin")) return "admin";
    if (roles.includes("teacher")) return "teacher";
    if (roles.includes("student")) return "student";
    return "";
  };

  const buildNativeBackQuery = (
    extra: Record<string, string | number> = {},
    omitKeys: string[] = []
  ) => {
    const currentQuery = router.currentRoute.value.query;
    const query: Record<string, string | number> = {};
    Object.entries(currentQuery).forEach(([key, value]) => {
      const singleValue = getSingleQueryValue(value);
      if (
        singleValue !== undefined &&
        singleValue !== null &&
        typeof singleValue !== "object"
      ) {
        query[key] = String(singleValue);
      }
    });
    [...omitKeys, "demoRole"].forEach(key => {
      delete query[key];
    });
    return {
      ...query,
      qimingNative: "1",
      ...extra
    };
  };

  const stringifyNativeBackQuery = (query: Record<string, string | number>) => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, String(value));
      }
    });
    return params.toString();
  };

  const navigateNativeBack = (
    path: string,
    query: Record<string, string | number>
  ) => {
    const queryString = stringifyNativeBackQuery(query);
    const targetHash = `#${path}${queryString ? `?${queryString}` : ""}`;
    const ensureHashNavigation = () => {
      if (window.location.hash === targetHash) return;
      const targetUrl = `${window.location.pathname}${window.location.search}${targetHash}`;
      window.history.replaceState(window.history.state, "", targetUrl);
    };
    router
      .replace({ path, query })
      .catch(() => {})
      .finally(() => {
        window.setTimeout(ensureHashNavigation, 80);
        window.setTimeout(ensureHashNavigation, 360);
      });
  };

  const normalizeNativeRoleRoute = () => {
    const currentRoute = router.currentRoute.value;
    const role = String(getSingleQueryValue(currentRoute.query.demoRole) || "");
    const isStudentRole = role === "student";
    if (isStudentRole && currentRoute.path === "/home") {
      navigateNativeBack(
        "/account",
        buildNativeBackQuery({ menu: "home" }, ["mode"])
      );
      return;
    }
    if (
      (role === "teacher" || role === "admin") &&
      currentRoute.path === "/home"
    ) {
      navigateNativeBack(
        "/welcome/index",
        buildNativeBackQuery({}, ["menu", "mode"])
      );
    }
  };

  router.afterEach(() => {
    try {
      const currentRoute = router.currentRoute.value;
      if (currentRoute.path !== "/login") {
        sessionStorage.setItem(
          "qimingNativeLastRoute",
          JSON.stringify({
            path: currentRoute.path,
            query: currentRoute.query,
            hash: window.location.hash,
            time: Date.now()
          })
        );
      }
    } catch {
      // Best-effort route restore cache for Android task switching.
    }
    window.setTimeout(normalizeNativeRoleRoute, 40);
    window.setTimeout(syncMiniProgramDocumentTitle, 60);
    window.setTimeout(syncStatusBar, 80);
  });
  window.setTimeout(normalizeNativeRoleRoute, 300);
  window.setTimeout(syncMiniProgramDocumentTitle, 320);

  const dispatchNativeBackEvent = () => {
    const event = new CustomEvent("qiming:native-back", {
      cancelable: true
    });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };

  (window as any).__qimingNativeBack = () => {
    if (dispatchNativeBackEvent()) {
      return "handled";
    }

    const currentRoute = router.currentRoute.value;
    const currentPath = currentRoute.path;
    const currentMenu = String(
      getSingleQueryValue(currentRoute.query.menu) || ""
    );
    const role = String(
      getNativeUserRole() ||
        getSingleQueryValue(currentRoute.query.demoRole) ||
        ""
    );

    const canUseBrowserHistory =
      window.history.length > 1 &&
      !["/account", "/welcome/index", "/home", "/login"].includes(currentPath);

    if (canUseBrowserHistory) {
      router.back();
      return "handled";
    }

    if (currentPath === "/account") {
      if (currentMenu && currentMenu !== "home") {
        navigateNativeBack(
          "/account",
          buildNativeBackQuery({ menu: "home" }, ["mode"])
        );
        return "handled";
      }
      return "root";
    }

    if (currentPath.startsWith("/course/")) {
      navigateNativeBack(
        "/account",
        buildNativeBackQuery({ menu: "course" }, ["mode"])
      );
      return "handled";
    }

    if (currentPath === "/account/ai-app") {
      navigateNativeBack(
        "/account",
        buildNativeBackQuery({ menu: "home" }, ["mode"])
      );
      return "handled";
    }

    if (currentPath !== "/home") {
      const rootPath =
        role === "teacher" || role === "admin" ? "/welcome/index" : "/account";
      const rootQuery =
        rootPath === "/account"
          ? buildNativeBackQuery({ menu: "home" }, ["mode"])
          : buildNativeBackQuery({}, ["menu", "mode"]);
      navigateNativeBack(rootPath, rootQuery);
      return "handled";
    }

    return "root";
  };

  let lastNativeRootBackAt = 0;
  const registerNativeHardwareBack = () => {
    const plusApi = (window as any).plus;
    if (!plusApi?.key?.addEventListener) return;
    if ((window as any).__qimingNativeHardwareBackReady) return;
    (window as any).__qimingNativeHardwareBackReady = true;

    plusApi.key.addEventListener("backbutton", () => {
      const result = (window as any).__qimingNativeBack?.();
      if (result === "handled") return;

      const now = Date.now();
      if (now - lastNativeRootBackAt < 1800) {
        plusApi.runtime?.quit?.();
        return;
      }

      lastNativeRootBackAt = now;
      plusApi.nativeUI?.toast?.("再按一次退出启明智教");
    });
  };

  if ((window as any).plus) {
    registerNativeHardwareBack();
  } else {
    document.addEventListener("plusready", registerNativeHardwareBack, {
      once: true
    });
  }

  document.addEventListener("UniAppJSBridgeReady", () => {
    notifyNativeShell("bridge-ready");
  });
  window.addEventListener("load", () => {
    notifyNativeShell("loaded");
  });
  setTimeout(() => notifyNativeShell("loaded"), 1200);
}

applyNativeWebViewRuntime();

const app = createApp(App);

// 自定义指令
import * as directives from "@/directives";
Object.keys(directives).forEach(key => {
  app.directive(key, (directives as { [key: string]: Directive })[key]);
});

// 全局注册@iconify/vue图标库
import {
  IconifyIconOffline,
  IconifyIconOnline,
  FontIcon
} from "./components/ReIcon";
app.component("IconifyIconOffline", IconifyIconOffline);
app.component("IconifyIconOnline", IconifyIconOnline);
app.component("FontIcon", FontIcon);

// 全局注册按钮级别权限组件
import { Auth } from "@/components/ReAuth";
import { Perms } from "@/components/RePerms";
app.component("Auth", Auth);
app.component("Perms", Perms);

// 全局注册vue-tippy
import "tippy.js/dist/tippy.css";
import "tippy.js/themes/light.css";
import VueTippy from "vue-tippy";
app.use(VueTippy);

getPlatformConfig(app).then(async config => {
  setupStore(app);
  useAppStoreHook().refreshUA();
  registerPwa();
  initClarity();
  app.use(router);
  await router.isReady();
  injectResponsiveStorage(app, config);
  app
    .use(MotionPlugin)
    .use(useI18n)
    .use(useElementPlus)
    .use(Table)
    .use(useVxeTable)
    .use(PureDescriptions)
    .use(useEcharts);
  app.mount("#app");
});
