import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const loginDir = dirname(fileURLToPath(import.meta.url));
const readLoginFile = relativePath =>
  readFileSync(resolve(loginDir, relativePath), "utf8");

const login = readLoginFile("index.vue");
const register = readLoginFile("components/LoginRegist.vue");
const session = readLoginFile("utils/userCenterSession.ts");
const userApi = readLoginFile("../../api/user.ts");

test("login and registration use only the documented user-center APIs", () => {
  assert.match(login, /await userLogin\(\{/);
  assert.doesNotMatch(login, /loginByUsername|admin123|username:\s*"admin"/);
  assert.match(register, /await userRegister\(\{/);
  assert.match(register, /mobile,[\s\S]*password: ruleForm\.password/);
  assert.doesNotMatch(register, /setTimeout|verifyCode|短信|验证码/);
  assert.match(userApi, /"post", "\/edu\/v1\/user\/login"/);
  assert.match(userApi, /"post", "\/edu\/v1\/user\/register"/);
});

test("successful authentication requires user detail and a valid role first", () => {
  const detailIndex = session.indexOf("await getUserDetail()");
  const routerIndex = session.indexOf("await initRouter()");

  assert.ok(detailIndex >= 0);
  assert.ok(routerIndex > detailIndex);
  assert.match(
    session,
    /response\?\.code !== 200 \|\| !response\.data\?\.accessToken/
  );
  assert.match(session, /detailResponse\?\.code !== 200 \|\| !userInfo/);
  assert.match(session, /if \(!roleName\)/);
  assert.match(session, /catch \(error\) \{[\s\S]*removeToken\(\)/);
  assert.match(login, /await completeUserCenterAuthentication/);
  assert.match(
    login,
    /completeUserCenterAuthentication[\s\S]*pureLoginSuccess/
  );
});

test("unsupported and fabricated login choices are absent", () => {
  assert.doesNotMatch(
    login,
    /LoginPhone|LoginQrCode|LoginUpdate|thirdParty|pureThirdLogin|pureForget/
  );
  assert.doesNotMatch(
    login,
    /Pure Admin|pure-admin\.cn|10K\+|500\+|99\.9%|24\/7/
  );
  assert.match(login, /<span class="gradient-text">启明智教<\/span>/);
  assert.match(login, /\|\| "启明智教"/);

  for (const relativePath of [
    "components/LoginPhone.vue",
    "components/LoginQrCode.vue",
    "components/LoginUpdate.vue",
    "utils/enums.ts",
    "utils/verifyCode.ts"
  ]) {
    assert.equal(existsSync(resolve(loginDir, relativePath)), false);
  }
});

test("the login card releases fixed widths at 390px", () => {
  assert.equal(login.match(/class="main-content"/g)?.length, 1);
  assert.equal(login.match(/class="login-section"/g)?.length, 1);
  assert.equal(login.match(/class="login-card"/g)?.length, 1);
  assert.match(login, /\.login-form \{[\s\S]*width: 100%;[\s\S]*min-width: 0;/);
  assert.match(login, /@media screen and \(width <= 390px\)/);
  assert.match(
    login,
    /\.main-content \{[\s\S]*box-sizing: border-box;[\s\S]*width: 100%;[\s\S]*min-width: 0;[\s\S]*margin: 0;/
  );
  assert.match(
    login,
    /@media screen and \(width <= 1200px\)[\s\S]*overflow-x: hidden;/
  );
  assert.match(
    register,
    /\.registration-form \{[\s\S]*width: 100%;[\s\S]*min-width: 0;/
  );
});
