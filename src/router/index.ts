import "@/utils/sso";
import Cookies from "js-cookie";
import { getConfig } from "@/config";
import NProgress from "@/utils/progress";
import { transformI18n } from "@/plugins/i18n";
import { buildHierarchyTree } from "@/utils/tree";
import remainingRouter from "./modules/remaining";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";
import { usePermissionStoreHook } from "@/store/modules/permission";
import {
  isUrl,
  openLink,
  cloneDeep,
  isAllEmpty,
  storageLocal
} from "@pureadmin/utils";
import {
  ascending,
  getTopMenu,
  initRouter,
  isOneOfArray,
  getHistoryMode,
  findRouteByPath,
  handleAliveRoute,
  formatTwoStageRoutes,
  formatFlatteningRoutes
} from "./utils";
import {
  type Router,
  type RouteRecordRaw,
  type RouteComponent,
  createRouter
} from "vue-router";
import {
  type DataInfo,
  userKey,
  removeToken,
  multipleTabsKey
} from "@/utils/auth";

/** 自动导入全部静态路由，无需再手动引入！匹配 src/router/modules 目录（任何嵌套级别）中具有 .ts 扩展名的所有文件，除了 remaining.ts 文件
 * 如何匹配所有文件请看：https://github.com/mrmlnc/fast-glob#basic-syntax
 * 如何排除文件请看：https://cn.vitejs.dev/guide/features.html#negative-patterns
 */
const modules: Record<string, any> = import.meta.glob(
  ["./modules/**/*.ts", "!./modules/**/remaining.ts"],
  {
    eager: true
  }
);

/** 原始静态路由（未做任何处理） */
const routes = [];

Object.keys(modules).forEach(key => {
  routes.push(modules[key].default);
});

/** 导出处理后的静态路由（三级及以上的路由全部拍成二级） */
export const constantRoutes: Array<RouteRecordRaw> = formatTwoStageRoutes(
  formatFlatteningRoutes(buildHierarchyTree(ascending(routes.flat(Infinity))))
);

/** 初始的静态路由，用于退出登录时重置路由 */
const initConstantRoutes: Array<RouteRecordRaw> = cloneDeep(constantRoutes);

/** 用于渲染菜单，保持原始层级 */
export const constantMenus: Array<RouteComponent> = ascending(
  routes.flat(Infinity)
).concat(...remainingRouter);

// 调试输出
console.log("[Router Init] 静态路由 constantMenus:", constantMenus);
console.log("[Router Init] constantMenus 数量:", constantMenus.length);

/** 不参与菜单的路由 */
export const remainingPaths = Object.keys(remainingRouter).map(v => {
  return remainingRouter[v].path;
});

/** 创建路由实例 */
export const router: Router = createRouter({
  history: getHistoryMode(import.meta.env.VITE_ROUTER_HISTORY),
  routes: constantRoutes.concat(...(remainingRouter as any)),
  strict: true,
  scrollBehavior(to, from, savedPosition) {
    return new Promise(resolve => {
      if (savedPosition) {
        resolve(savedPosition);
        return;
      }
      if (from.meta.saveSrollTop) {
        const top: number =
          document.documentElement.scrollTop || document.body.scrollTop;
        resolve({ left: 0, top });
        return;
      }
      resolve({ left: 0, top: 0 });
    });
  }
});

/** 重置路由 */
export function resetRouter() {
  router.clearRoutes();
  for (const route of initConstantRoutes.concat(...(remainingRouter as any))) {
    router.addRoute(route);
  }
  router.options.routes = formatTwoStageRoutes(
    formatFlatteningRoutes(buildHierarchyTree(ascending(routes.flat(Infinity))))
  );
  usePermissionStoreHook().clearAllCachePage();
}

/** 路由白名单 */
const whiteList = ["/login", "/home"];

const { VITE_HIDE_HOME } = import.meta.env;
const demoRoles = ["student", "teacher", "admin"] as const;
type DemoRole = (typeof demoRoles)[number];
const demoRoleTypes = {
  student: 1,
  teacher: 2,
  admin: 3
};
const nativeDemoSessionReady = new Set<DemoRole>();

const isNativeWebViewRuntime = () => {
  return (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("qiming-native-webview")
  );
};

const hasNativeStoredSession = (userInfo?: DataInfo<number> | null) => {
  return (
    isNativeWebViewRuntime() &&
    !!userInfo?.accessToken &&
    Array.isArray(userInfo?.roles) &&
    userInfo.roles.length > 0
  );
};

router.beforeEach((to: ToRouteType, _from, next) => {
  console.log(`[Router Guard] ${to.path} <- ${_from.path}`);
  if (to.meta?.keepAlive) {
    handleAliveRoute(to, "add");
    // 页面整体刷新和点击标签页刷新
    if (_from.name === undefined || _from.name === "Redirect") {
      handleAliveRoute(to);
    }
  }
  const userInfo = storageLocal().getItem<DataInfo<number>>(userKey);
  const demoRole = String(to.query?.demoRole || "");
  const normalizedDemoRole = demoRoles.includes(demoRole as DemoRole)
    ? (demoRole as DemoRole)
    : null;
  const isNativeDemoRoute = String(to.query?.qimingNative || "") === "1";
  const userRoles = userInfo?.roles ?? [];
  const hasRequiredDemoIdentity =
    normalizedDemoRole !== "student" || !!userInfo?.avatar;
  const hasDemoSessionMarker =
    !!Cookies.get(multipleTabsKey) ||
    (isNativeDemoRoute && hasNativeStoredSession(userInfo));
  const demoSessionMatchesRole =
    !!normalizedDemoRole &&
    userInfo?.roleType === demoRoleTypes[normalizedDemoRole] &&
    Array.isArray(userRoles) &&
    userRoles.includes(normalizedDemoRole) &&
    hasRequiredDemoIdentity &&
    localStorage.getItem("qiming-demo-role") === normalizedDemoRole &&
    hasDemoSessionMarker;

  if (isNativeDemoRoute && normalizedDemoRole && demoSessionMatchesRole) {
    nativeDemoSessionReady.add(normalizedDemoRole);
  }

  if (isNativeDemoRoute && normalizedDemoRole && to.path === "/home") {
    const query = { ...to.query };
    delete query.menu;
    delete query.mode;
    if (normalizedDemoRole === "student") {
      next({
        path: "/account",
        query: { ...query, menu: "home" },
        replace: true
      });
      return;
    }
    next({
      path: "/welcome/index",
      query,
      replace: true
    });
    return;
  }

  if (
    (import.meta.env.DEV || isNativeDemoRoute) &&
    normalizedDemoRole &&
    !demoSessionMatchesRole
  ) {
    import("@/views/home/demoSession")
      .then(({ ensureDemoSession }) => ensureDemoSession(normalizedDemoRole))
      .then(() => {
        nativeDemoSessionReady.add(normalizedDemoRole);
        next({ ...to, replace: true });
      })
      .catch(error => {
        console.error("[Router Guard] Demo session bootstrap failed", error);
        next({ path: "/home" });
      });
    return;
  }
  console.log(
    "[Router Guard] 用户信息:",
    userInfo ? "已登录" : "未登录",
    "roleType:",
    userInfo?.roleType
  );
  NProgress.start();

  const hasSessionMarker =
    !!Cookies.get(multipleTabsKey) || hasNativeStoredSession(userInfo);

  // 注意：在没有后端的开发环境下，跳过 cookie 检查
  // 如果 userInfo 存在但 cookie 不存在，尝试恢复 cookie 而不是强制退出
  if (userInfo && !Cookies.get(multipleTabsKey)) {
    // 尝试恢复 multipleTabsKey cookie，而不是清理登录状态
    Cookies.set(multipleTabsKey, "true", { path: "/" });
    console.log("[Router Guard] 检测到登录状态不一致，已自动恢复 cookie");
  }

  const externalLink = isUrl(to?.name as string);
  if (!externalLink) {
    to.matched.some(item => {
      if (!item.meta.title) return "";
      const Title = getConfig().Title;
      if (Title)
        document.title = `${transformI18n(item.meta.title)} | ${Title}`;
      else document.title = transformI18n(item.meta.title);
    });
  }

  /** 如果已经登录并存在登录信息后不能跳转到路由白名单，而是继续保持在当前页面 */
  function toCorrectRoute() {
    console.log("[Router Guard] 执行 toCorrectRoute, to:", to.path);
    // 登录后允许访问 /home
    if (to.fullPath === "/home") {
      next();
    } else {
      whiteList.includes(to.fullPath) ? next(_from.fullPath) : next();
    }
  }

  if (hasSessionMarker && userInfo) {
    console.log("[Router Guard] 登录状态校验通过");
    // 管理端默认权限白名单（这些路由任何已登录用户都可以访问）
    const publicRoutes = [
      "/home",
      "/error/403",
      "/error/404",
      "/error/500",
      "/account",
      "/account/ai-app"
    ];
    const isPublicRoute = publicRoutes.some(route => to.path.startsWith(route));

    // 权限检查逻辑：
    // 1. 如果路由明确指定了 roles，检查用户是否有对应角色
    // 2. 如果路由没有指定 roles 且不是公开路由，默认需要 admin 或 teacher 角色
    const userRoles = userInfo?.roles ?? [];
    const requiredRoles = to.meta?.roles;

    if (requiredRoles) {
      // 路由明确指定了权限要求
      if (!isOneOfArray(requiredRoles, userRoles)) {
        next({ path: "/error/403" });
        return;
      }
    } else if (!isPublicRoute) {
      // 路由没有指定权限，但不是公开路由，需要 admin 或 teacher 权限
      const hasAdminAccess = isOneOfArray(["admin", "teacher"], userRoles);
      if (!hasAdminAccess) {
        console.warn(
          `[Router] 用户角色 ${userRoles} 无权访问管理端路由: ${to.path}`
        );
        next({ path: "/error/403" });
        return;
      }
    }

    // 开启隐藏首页后在浏览器地址栏手动输入首页welcome路由则跳转到404页面
    if (VITE_HIDE_HOME === "true" && to.fullPath === "/welcome") {
      next({ path: "/error/404" });
    }
    if (_from?.name) {
      // name为超链接
      if (externalLink) {
        openLink(to?.name as string);
        NProgress.done();
      } else {
        toCorrectRoute();
      }
    } else {
      // 刷新
      if (
        usePermissionStoreHook().wholeMenus.length === 0 &&
        to.path !== "/login"
      ) {
        initRouter().then((router: Router) => {
          if (!useMultiTagsStoreHook().getMultiTagsCache) {
            const { path } = to;
            const route = findRouteByPath(
              path,
              router.options.routes[0].children
            );
            getTopMenu(true);
            // query、params模式路由传参数的标签页不在此处处理
            if (route && route.meta?.title) {
              if (isAllEmpty(route.parentId) && route.meta?.backstage) {
                // 此处为动态顶级路由（目录）
                const { path, name, meta } = route.children[0];
                useMultiTagsStoreHook().handleTags("push", {
                  path,
                  name,
                  meta
                });
              } else {
                const { path, name, meta } = route;
                useMultiTagsStoreHook().handleTags("push", {
                  path,
                  name,
                  meta
                });
              }
            }
          }
          // 确保动态路由完全加入路由列表并且不影响静态路由（注意：动态路由刷新时router.beforeEach可能会触发两次，第一次触发动态路由还未完全添加，第二次动态路由才完全添加到路由列表，如果需要在router.beforeEach做一些判断可以在to.name存在的条件下去判断，这样就只会触发一次）
          if (isAllEmpty(to.name)) {
            router.push(to.fullPath);
          } else {
            next({ ...to, replace: true });
          }
        });
        return;
      }
      toCorrectRoute();
    }
  } else {
    console.log("[Router Guard] 未登录或 Cookie 缺失，跳转到 home 或 login");
    if (to.path !== "/login") {
      if (whiteList.indexOf(to.path) !== -1) {
        next();
      } else {
        console.warn(
          "[Router Guard] 拒绝访问非白名单页面，清除 token 并回退到首页"
        );
        removeToken();
        next({ path: "/home" });
      }
    } else {
      next();
    }
  }
});

router.afterEach(() => {
  NProgress.done();
});

export default router;
