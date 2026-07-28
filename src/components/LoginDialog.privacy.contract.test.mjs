import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const loginSource = readFileSync(
  new URL("./LoginDialog.vue", import.meta.url),
  "utf8"
);
const legalSource = readFileSync(
  new URL("./loginLegalDocuments.ts", import.meta.url),
  "utf8"
);
const indexSource = readFileSync(
  new URL("../../index.html", import.meta.url),
  "utf8"
);
const claritySource = readFileSync(
  new URL("../utils/clarity.ts", import.meta.url),
  "utf8"
);
const analyticsSource = readFileSync(
  new URL("../utils/googleAnalytics.ts", import.meta.url),
  "utf8"
);

test("login and registration visibly require both legal agreements", () => {
  assert.equal(
    (loginSource.match(/v-model="agreementAccepted"/g) || []).length,
    2
  );
  assert.equal((loginSource.match(/《用户服务协议》/g) || []).length, 2);
  assert.equal((loginSource.match(/《隐私政策》/g) || []).length, 2);
  assert.match(loginSource, /agreementAccepted = ref\(hasPrivacyConsent\(\)\)/);
  assert.match(loginSource, /请先阅读并同意用户服务协议和隐私政策/);
});

test("every account collection action is guarded by explicit consent", () => {
  for (const handler of ["handlePasswordLogin", "handleRegister"]) {
    assert.match(
      loginSource,
      new RegExp(
        `const ${handler} = [\\s\\S]{0,120}if \\(!ensureAgreementAccepted\\(\\)\\) return;`
      ),
      `${handler} must check consent before continuing`
    );
  }

  assert.ok(
    loginSource.indexOf("if (!ensureAgreementAccepted()) return;") <
      loginSource.indexOf("await userLogin("),
    "login request must occur after consent guard"
  );
});

test("legal documents identify the operator, purposes, rights and processors", () => {
  for (const requiredText of [
    "吉林省云创迅捷软件开发有限公司",
    "账号与身份信息",
    "学习与教学记录",
    "AI交互内容",
    "信息存储与保护",
    "您的权利",
    "腾讯云对象存储服务",
    "Microsoft Clarity",
    "Google Analytics",
    "xcxedu@sorkai.com"
  ]) {
    assert.match(legalSource, new RegExp(requiredText));
  }
});

test("analytics never starts from static HTML or before stored consent", () => {
  assert.doesNotMatch(
    indexSource,
    /googletagmanager|fonts\.googleapis|fonts\.gstatic/
  );
  assert.match(claritySource, /!hasPrivacyConsent\(\)/);
  assert.match(analyticsSource, /!hasPrivacyConsent\(\)/);
  assert.match(analyticsSource, /study\.intelledu\.cn/);
  assert.doesNotMatch(analyticsSource, /aiedu-mp\.intelledu\.cn/);
});
