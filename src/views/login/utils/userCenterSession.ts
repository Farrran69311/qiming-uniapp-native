import type { Router } from "vue-router";
import { getUserDetail, type UserCenterLoginResult } from "@/api/user";
import { getTopMenu, initRouter } from "@/router/utils";
import { removeToken, setToken } from "@/utils/auth";

type AuthData = UserCenterLoginResult["data"];

const roleNameByType: Record<number, string> = {
  1: "student",
  2: "teacher",
  3: "admin"
};

const toExpiryDate = (accessExpire: number) => {
  const timestamp = Number(accessExpire);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    throw new Error("登录接口未返回有效的凭证有效期");
  }

  const milliseconds =
    timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
  const expires = new Date(milliseconds);
  if (Number.isNaN(expires.getTime())) {
    throw new Error("登录凭证有效期格式错误");
  }
  return expires;
};

export const requireAuthData = (
  response: UserCenterLoginResult,
  fallbackMessage: string
) => {
  if (response?.code !== 200 || !response.data?.accessToken) {
    throw new Error(response?.msg || fallbackMessage);
  }
  return response.data;
};

export const resolveAuthErrorMessage = (
  error: unknown,
  fallbackMessage: string
) => {
  if (!error || typeof error !== "object") return fallbackMessage;

  const responseMessage = (error as any).response?.data?.msg;
  if (typeof responseMessage === "string" && responseMessage.trim()) {
    return responseMessage;
  }

  const message = (error as Error).message;
  return typeof message === "string" && message.trim()
    ? message
    : fallbackMessage;
};

/**
 * A user is authenticated only after the token, user detail and role-aware routes
 * have all been initialized. Any partial session is removed on failure.
 */
export const completeUserCenterAuthentication = async (
  router: Router,
  mobile: string,
  authData: AuthData
) => {
  const expires = toExpiryDate(authData.accessExpire);

  try {
    setToken({
      accessToken: authData.accessToken,
      refreshToken: authData.accessToken,
      expires,
      username: mobile,
      nickname: mobile,
      roles: [],
      permissions: [],
      roleType: 0
    });

    const detailResponse = await getUserDetail();
    const userInfo = detailResponse?.data?.userInfo;
    if (detailResponse?.code !== 200 || !userInfo) {
      throw new Error(detailResponse?.msg || "无法获取当前用户信息");
    }

    const roleName = roleNameByType[userInfo.roleType];
    if (!roleName) {
      throw new Error("当前账号的角色信息无效，请联系管理员");
    }

    setToken({
      accessToken: authData.accessToken,
      refreshToken: authData.accessToken,
      expires,
      username: userInfo.mobile || mobile,
      nickname: userInfo.nickname || userInfo.mobile || mobile,
      avatar: userInfo.avatar || "",
      roles: [roleName],
      permissions: ["*:*:*"],
      roleType: userInfo.roleType,
      userId: userInfo.id
    });

    localStorage.setItem("userId", String(userInfo.id));
    localStorage.setItem("userMobile", userInfo.mobile || mobile);
    localStorage.setItem("userSex", String(userInfo.sex ?? 0));
    localStorage.setItem("userInfo", userInfo.info || "");
    localStorage.setItem("userRoleType", String(userInfo.roleType));

    await initRouter();
    const targetPath = getTopMenu(true)?.path;
    if (!targetPath) {
      throw new Error("当前账号没有可访问的页面");
    }
    await router.push(targetPath);

    return userInfo;
  } catch (error) {
    removeToken();
    throw error;
  }
};
