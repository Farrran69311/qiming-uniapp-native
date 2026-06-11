import Cookies from "js-cookie";
import { useUserStoreHook } from "@/store/modules/user";
import { storageLocal, isString, isIncludeAllChildren } from "@pureadmin/utils";
import { responsiveStorageNameSpace, getConfig } from "@/config";

export interface DataInfo<T> {
  /** token */
  accessToken: string;
  /** `accessToken`的过期时间（时间戳） */
  expires: T;
  /** 用于调用刷新accessToken的接口时所需的token */
  refreshToken: string;
  /** 头像 */
  avatar?: string;
  /** 用户名 */
  username?: string;
  /** 昵称 */
  nickname?: string;
  /** 当前登录用户的角色 */
  roles?: Array<string>;
  /** 当前登录用户的按钮级别权限 */
  permissions?: Array<string>;
  /** 角色类型 1:学生 2:教师 3:管理员 */
  roleType?: number;
  /** 用户ID */
  userId?: number;
}

export const userKey = "user-info";
export const TokenKey = "authorized-token";
/**
 * 通过`multiple-tabs`是否在`cookie`中，判断用户是否已经登录系统，
 * 从而支持多标签页打开已经登录的系统后无需再登录。
 * 浏览器完全关闭后`multiple-tabs`将自动从`cookie`中销毁，
 * 再次打开浏览器需要重新登录系统
 * */
export const multipleTabsKey = "multiple-tabs";

/** 获取`token` */
export function getToken(): DataInfo<number> {
  // 此处与`TokenKey`相同，此写法解决初始化时`Cookies`中不存在`TokenKey`报错
  return Cookies.get(TokenKey)
    ? JSON.parse(Cookies.get(TokenKey))
    : storageLocal().getItem(userKey);
}

/**
 * @description 设置`token`以及一些必要信息并采用无感刷新`token`方案
 * 无感刷新：后端返回`accessToken`（访问接口使用的`token`）、`refreshToken`（用于调用刷新`accessToken`的接口时所需的`token`，`refreshToken`的过期时间（比如30天）应大于`accessToken`的过期时间（比如2小时））、`expires`（`accessToken`的过期时间）
 * 将`accessToken`、`expires`、`refreshToken`这三条信息放在key值为authorized-token的cookie里（过期自动销毁）
 * 将`avatar`、`username`、`nickname`、`roles`、`permissions`、`refreshToken`、`expires`、`roleType`这八条信息放在key值为`user-info`的localStorage里（利用`multipleTabsKey`当浏览器完全关闭后自动销毁）
 */
export function setToken(data: DataInfo<Date>) {
  let expires = 0;
  const { accessToken, refreshToken } = data;
  const { isRemembered, loginDay } = useUserStoreHook();
  expires = new Date(data.expires).getTime(); // 如果后端直接设置时间戳，将此处代码改为expires = data.expires，然后把上面的DataInfo<Date>改成DataInfo<number>即可
  const cookieString = JSON.stringify({ accessToken, expires, refreshToken });

  expires > 0
    ? Cookies.set(TokenKey, cookieString, {
        expires: (expires - Date.now()) / 86400000,
        path: "/"
      })
    : Cookies.set(TokenKey, cookieString, { path: "/" });

  // 确保 multipleTabsKey cookie 总是被设置，默认7天过期
  // 这样可以避免登录后立即被路由守卫检测到状态不一致而退出
  Cookies.set(multipleTabsKey, "true", {
    expires: isRemembered ? loginDay : 7,
    path: "/"
  });

  function setUserKey({
    avatar,
    username,
    nickname,
    roles,
    permissions,
    roleType
  }) {
    useUserStoreHook().SET_AVATAR(avatar || "");
    useUserStoreHook().SET_USERNAME(username);
    useUserStoreHook().SET_NICKNAME(nickname);
    useUserStoreHook().SET_ROLES(roles);
    useUserStoreHook().SET_PERMS(permissions);
    storageLocal().setItem(userKey, {
      accessToken,
      refreshToken,
      expires,
      avatar: avatar || "",
      username,
      nickname,
      roles,
      permissions,
      roleType
    });
  }

  if (data.username && data.roles) {
    const { username, roles } = data;
    setUserKey({
      avatar: data?.avatar ?? "",
      username,
      nickname: data?.nickname ?? "",
      roles,
      permissions: data?.permissions ?? [],
      roleType: data?.roleType ?? 0
    });
  } else {
    const avatar =
      storageLocal().getItem<DataInfo<number>>(userKey)?.avatar ?? "";
    const username =
      storageLocal().getItem<DataInfo<number>>(userKey)?.username ?? "";
    const nickname =
      storageLocal().getItem<DataInfo<number>>(userKey)?.nickname ?? "";
    const roles =
      storageLocal().getItem<DataInfo<number>>(userKey)?.roles ?? [];
    const permissions =
      storageLocal().getItem<DataInfo<number>>(userKey)?.permissions ?? [];
    const roleType =
      storageLocal().getItem<DataInfo<number>>(userKey)?.roleType ?? 0;
    setUserKey({
      avatar,
      username,
      nickname,
      roles,
      permissions,
      roleType
    });
  }
}

/** 删除`token`以及key值为`user-info`的localStorage信息 */
export function removeToken() {
  useUserStoreHook().CLEAR_USER_STATE();
  Cookies.remove(TokenKey, { path: "/" });
  Cookies.remove(multipleTabsKey, { path: "/" });
  storageLocal().removeItem(userKey);
  storageLocal().removeItem("userId");
  storageLocal().removeItem("userMobile");
  storageLocal().removeItem("userSex");
  storageLocal().removeItem("userInfo");
  storageLocal().removeItem("userRoleType");

  // 清除持久化的 UI 状态
  storageLocal().removeItem("account_active_menu");
  // 清除所有课程详情页的持久化状态
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (
      key.includes("course_detail_active_") ||
      key.includes("account_active_menu")
    ) {
      localStorage.removeItem(key);
    }
  });

  // 重置主题设置为默认浅色模式，防止不同角色之间主题状态残留
  resetThemeToDefault();
}

/** 重置主题设置为默认浅色模式 */
export function resetThemeToDefault() {
  const layoutKey = `${responsiveStorageNameSpace()}layout`;
  const layout = storageLocal().getItem<StorageConfigs>(layoutKey);

  if (layout) {
    // 重置为默认浅色主题
    layout.darkMode = false;
    layout.overallStyle = "light";
    layout.theme = getConfig().Theme || "light";
    layout.epThemeColor = getConfig().EpThemeColor || "#97b4f7";
    storageLocal().setItem(layoutKey, layout);
  }

  // 移除 DOM 上的 dark 类
  document.documentElement.classList.remove("dark");
  document.documentElement.setAttribute("data-theme", "light");
}

/** 格式化token（jwt格式） */
export const formatToken = (token: string): string => {
  return "Bearer " + token;
};

/** 是否有按钮级别的权限（根据登录接口返回的`permissions`字段进行判断）*/
export const hasPerms = (value: string | Array<string>): boolean => {
  if (!value) return false;
  const allPerms = "*:*:*";
  const { permissions } = useUserStoreHook();
  if (!permissions) return false;
  if (permissions.length === 1 && permissions[0] === allPerms) return true;
  const isAuths = isString(value)
    ? permissions.includes(value)
    : isIncludeAllChildren(value, permissions);
  return isAuths ? true : false;
};

/** 判断用户是否有管理权限（教师或管理员）*/
export const hasManageAccess = (): boolean => {
  const userInfo = storageLocal().getItem<DataInfo<number>>(userKey);
  if (!userInfo) return false;

  // 根据roleType判断 2:教师 3:管理员
  if (userInfo.roleType === 2 || userInfo.roleType === 3) {
    return true;
  }

  return false;
};

/** 判断用户是否是管理员 */
export const isAdmin = (): boolean => {
  const userInfo = storageLocal().getItem<DataInfo<number>>(userKey);
  if (!userInfo) return false;

  // 只有roleType为3(管理员)才返回true
  return userInfo.roleType === 3;
};
