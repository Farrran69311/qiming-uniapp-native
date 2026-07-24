import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("account settings use real profile APIs without template endpoints", async () => {
  const [api, profile] = await Promise.all([
    read("./api/user.ts"),
    read("./views/account-settings/components/Profile.vue")
  ]);

  assert.match(api, /\/edu\/v1\/user\/detail/);
  assert.doesNotMatch(api, /["']\/mine(?:-logs)?["']/);
  assert.match(profile, /updateFrontendUserInfo/);
  assert.match(profile, /uploadFile/);
  assert.match(api, /sex:\s*Number\(user\.sex \?\? 0\)/);
  assert.match(profile, /sex:\s*userInfos\.sex/);
  assert.match(profile, /当前服务暂不支持清空简介/);
  assert.match(profile, /profileLoaded/);
  assert.match(profile, /:disabled="!profileLoaded \|\| profileLoading"/);
  assert.doesNotMatch(profile, /formUpload|更新信息成功.*console\.log/);
});

test("profile dialogs load and persist server-owned fields", async () => {
  const settings = await read("./components/ReAccountSettings/index.vue");

  assert.match(settings, /const handleEditProfile = async/);
  assert.match(settings, /const detailRes = await getUserDetail\(\)/);
  assert.match(settings, /profileForm\.sex = Number\(freshUser\.sex \?\? 0\)/);
  assert.match(settings, /sex:\s*profileForm\.sex/);
  assert.match(settings, /当前服务暂不支持清空签名/);
});

test("user profile exposes only truthful account capabilities", async () => {
  const profile = await read("./views/account/components/UserProfile.vue");

  assert.match(profile, /学习动态服务暂未接入/);
  assert.match(profile, /@\/assets\/user\.jpg/);
  assert.match(profile, /@\/assets\/publicbackgroundpreset\//);
  assert.match(profile, /sex:\s*form\.sex/);
  assert.doesNotMatch(profile, /userExtraInfo|getUserActivities/);
  assert.doesNotMatch(profile, /完成了《Python 基础入门》/);
  assert.doesNotMatch(profile, /form\.(?:email|bannerUrl)/);
  assert.doesNotMatch(profile, /bannerUrl:\s*form\.bannerUrl/);
});

test("login dialog hides unsupported authentication methods", async () => {
  const dialog = await read("./components/LoginDialog.vue");

  assert.match(dialog, /@click="handlePasswordLogin"/);
  assert.doesNotMatch(dialog, /验证码已发送|验证码登录功能开发中/);
  assert.doesNotMatch(dialog, /handleSmsLogin|sendSmsCode|sendRegisterSmsCode/);
  assert.doesNotMatch(dialog, /handleWechatLogin|handleQQLogin/);
  assert.doesNotMatch(dialog, /registerForm\.code|loginForm\.smsCode/);
  assert.doesNotMatch(dialog, /title="(?:微信|QQ)登录"/);
});

test("unsupported account settings never pretend to save", async () => {
  const [preferences, security, management] = await Promise.all([
    read("./views/account-settings/components/Preferences.vue"),
    read("./views/account-settings/components/SecurityLog.vue"),
    read("./views/account-settings/components/AccountManagement.vue")
  ]);

  assert.match(preferences, /通知偏好服务尚未接入/);
  assert.doesNotMatch(preferences, /设置成功/);
  assert.match(security, /不展示模拟登录记录/);
  assert.doesNotMatch(security, /getMineLogs/);
  assert.match(management, /openChangePassword/);
  assert.doesNotMatch(management, /158\*\*\*\*6789|pure\*\*\*@163\.com/);
});
