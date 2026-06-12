<script setup lang="ts">
import { useI18n } from "vue-i18n";
import Motion from "./utils/motion";
import { useRouter } from "vue-router";
import { message } from "@/utils/message";
import { loginRules } from "./utils/rule";
import TypeIt from "@/components/ReTypeit";
import { debounce } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import { useEventListener } from "@vueuse/core";
import type { FormInstance } from "element-plus";
import { $t, transformI18n } from "@/plugins/i18n";
import { operates, thirdParty } from "./utils/enums";
import { useLayout } from "@/layout/hooks/useLayout";
import LoginPhone from "./components/LoginPhone.vue";
import LoginRegist from "./components/LoginRegist.vue";
import LoginUpdate from "./components/LoginUpdate.vue";
import LoginQrCode from "./components/LoginQrCode.vue";
import ParticlesBg from "./components/ParticlesBg.vue";
import { useUserStoreHook } from "@/store/modules/user";
import { initRouter, getTopMenu } from "@/router/utils";
import { bg, avatar, illustration } from "./utils/static";
import { ReImageVerify } from "@/components/ReImageVerify";
import { ref, toRaw, reactive, watch, computed, onMounted } from "vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { useTranslationLang } from "@/layout/hooks/useTranslationLang";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";
import { resetThemeToDefault, setToken, getToken } from "@/utils/auth";
import { getUserDetail } from "@/api/user";

import dayIcon from "@/assets/svg/day.svg?component";
import darkIcon from "@/assets/svg/dark.svg?component";
import globalization from "@/assets/svg/globalization.svg?component";
import Lock from "~icons/ri/lock-fill";
import Eye from "~icons/ri/eye-line";
import EyeOff from "~icons/ri/eye-off-line";
import Check from "~icons/ep/check";
import User from "~icons/ri/user-3-fill";
import Info from "~icons/ri/information-line";
import Keyhole from "~icons/ri/shield-keyhole-line";
import Tenant from "~icons/ri/home-gear-line";

defineOptions({
  name: "Login"
});

const imgCode = ref("");
const loginDay = ref(7);
const router = useRouter();
const loading = ref(false);
const checked = ref(false);
const disabled = ref(false);
const ruleFormRef = ref<FormInstance>();
const isTenantFocused = ref(false);
const isUsernameFocused = ref(false);
const isPasswordFocused = ref(false);
const isVerifyCodeFocused = ref(false);
const passwordVisible = ref(false);
const currentPage = computed(() => {
  return useUserStoreHook().currentPage;
});

// 动画状态
const isLoaded = ref(false);

onMounted(() => {
  setTimeout(() => {
    isLoaded.value = true;
  }, 100);
});

const { t } = useI18n();
const { initStorage } = useLayout();

// 管理员/教师端登录页：强制重置为浅色主题，防止从学生端残留深色模式
resetThemeToDefault();
initStorage();

const { dataTheme, overallStyle, dataThemeChange } = useDataThemeChange();
dataThemeChange(overallStyle.value);
const { title, getDropdownItemStyle, getDropdownItemClass } = useNav();
const {
  locale,
  translationCh,
  translationTw,
  translationEn,
  translationJa,
  translationKo
} = useTranslationLang();
const { VITE_ENABLE_TENANT } = import.meta.env;

const ruleForm = reactive({
  tenant: "pure-admin",
  username: "admin",
  password: "admin123",
  verifyCode: ""
});

// 特性列表
const features = [
  {
    icon: "🚀",
    title: "高性能",
    desc: "基于 Vue3 + Vite 构建，极速体验"
  },
  {
    icon: "🎨",
    title: "优雅设计",
    desc: "现代化 UI 设计，响应式布局"
  },
  {
    icon: "🔐",
    title: "安全可靠",
    desc: "完善的权限管理和安全机制"
  },
  {
    icon: "⚡",
    title: "开箱即用",
    desc: "丰富的组件和功能模块"
  }
];

// 统计数据
const statistics = [
  { number: "10K+", label: "活跃用户" },
  { number: "500+", label: "企业客户" },
  { number: "99.9%", label: "系统稳定性" },
  { number: "24/7", label: "技术支持" }
];

// 获取用户详细信息（包括头像）
const roleTypeToRoles = (roleType: number): string[] => {
  if (roleType === 3) return ["admin"];
  if (roleType === 2) return ["teacher"];
  if (roleType === 1) return ["student"];
  return ["common"];
};

const readNativeQuery = () => {
  const output: Record<string, string> = {};
  if (typeof window === "undefined") return output;

  const searchParams = new URLSearchParams(window.location.search);
  const hashQuery = window.location.hash.includes("?")
    ? window.location.hash.slice(window.location.hash.indexOf("?") + 1)
    : "";
  const hashParams = new URLSearchParams(hashQuery);
  const qimingNative =
    searchParams.get("qimingNative") ||
    hashParams.get("qimingNative") ||
    localStorage.getItem("qimingNativeWebView");
  const nativeStatusTop =
    searchParams.get("nativeStatusTop") ||
    hashParams.get("nativeStatusTop") ||
    localStorage.getItem("qimingNativeStatusTop") ||
    "";

  if (qimingNative === "1") output.qimingNative = "1";
  if (nativeStatusTop) output.nativeStatusTop = nativeStatusTop;
  return output;
};

const isNativeLoginRuntime = () => {
  if (typeof window === "undefined") return false;
  return (
    readNativeQuery().qimingNative === "1" ||
    document.documentElement.classList.contains("qiming-native-webview")
  );
};

const resolvePostLoginTarget = (roleType: number) => {
  if (!isNativeLoginRuntime()) return getTopMenu(true).path;

  const query = readNativeQuery();
  if (roleType === 2 || roleType === 3) {
    return {
      path: "/welcome/index",
      query
    };
  }

  return {
    path: "/account",
    query: {
      ...query,
      menu: "home"
    }
  };
};

const getResolvedRoleType = () => {
  const token = getToken();
  const storedRoleType = Number(localStorage.getItem("userRoleType") || 0);
  const roleType = Number((token as any)?.roleType || storedRoleType || 0);
  return [1, 2, 3].includes(roleType) ? roleType : 0;
};

const fetchUserDetail = async () => {
  try {
    const res = await getUserDetail();
    if (res && res.data && res.data.userInfo) {
      const userInfo = res.data.userInfo;
      const userStore = useUserStoreHook();
      // 直接使用后端返回的头像
      userStore.SET_NICKNAME(userInfo.nickname || "");
      userStore.SET_AVATAR(userInfo.avatar || "");

      // 根据 roleType 设置正确的角色
      // roleType: 1=学生, 2=教师, 3=管理员
      const roles = roleTypeToRoles(Number(userInfo.roleType));

      setToken({
        accessToken: getToken()?.accessToken || "",
        refreshToken: getToken()?.refreshToken || "",
        expires: getToken()?.expires
          ? new Date(getToken().expires)
          : new Date(),
        username: userInfo.mobile,
        nickname: userInfo.nickname,
        avatar: userInfo.avatar || "",
        roles: roles,
        permissions: ["*:*:*"],
        roleType: userInfo.roleType
      });

      localStorage.setItem("userId", userInfo.id.toString());
      localStorage.setItem("userMobile", userInfo.mobile);
      localStorage.setItem("userSex", userInfo.sex.toString());
      localStorage.setItem("userInfo", userInfo.info || "");
      localStorage.setItem("userRoleType", userInfo.roleType.toString());
    }
    return res;
  } catch (error) {
    console.error("获取用户详细信息出错:", error);
    return null;
  }
};

const ensureLoginRoleType = async () => {
  let roleType = getResolvedRoleType();
  if ([1, 2, 3].includes(roleType)) return roleType;

  const detail = await fetchUserDetail();
  roleType = Number(detail?.data?.userInfo?.roleType || getResolvedRoleType());
  if ([1, 2, 3].includes(roleType)) return roleType;

  console.warn("[Login] missing roleType after login", { detail });
  message("未获取到账号角色，请重新登录", { type: "error" });
  return 0;
};

const onLogin = async (formEl: FormInstance | undefined) => {
  if (!formEl) return;
  await formEl.validate(valid => {
    if (valid) {
      loading.value = true;
      useUserStoreHook()
        .loginByUsername({
          username: ruleForm.username,
          password: ruleForm.password
        })
        .then(async res => {
          if (res.success) {
            localStorage.removeItem("qiming-demo-role");
            sessionStorage.removeItem("qiming-demo-role");
            // 获取用户详细信息（包括头像）
            await fetchUserDetail();
            // 获取后端路由
            return initRouter().then(() => {
              disabled.value = true;
              return ensureLoginRoleType().then(roleType => {
                if (!roleType) {
                  disabled.value = false;
                  return;
                }

                return router
                  .push(resolvePostLoginTarget(roleType))
                  .then(() => {
                    message(t("login.pureLoginSuccess"), { type: "success" });
                  })
                  .finally(() => (disabled.value = false));
              });
            });
          } else {
            message(t("login.pureLoginFail"), { type: "error" });
          }
        })
        .finally(() => (loading.value = false));
    }
  });
};

const immediateDebounce: any = debounce(
  formRef => onLogin(formRef),
  1000,
  true
);

useEventListener(document, "keydown", ({ code }) => {
  if (
    ["Enter", "NumpadEnter"].includes(code) &&
    !disabled.value &&
    !loading.value
  )
    immediateDebounce(ruleFormRef.value);
});

watch(imgCode, value => {
  useUserStoreHook().SET_VERIFYCODE(value);
});
watch(checked, bool => {
  useUserStoreHook().SET_ISREMEMBERED(bool);
});
watch(loginDay, value => {
  useUserStoreHook().SET_LOGINDAY(value);
});
</script>

<template>
  <div class="login-page select-none">
    <!-- 粒子背景 -->
    <ParticlesBg />

    <!-- 渐变背景 -->
    <div class="gradient-bg" />

    <!-- 顶部工具栏 -->
    <div class="top-toolbar">
      <div class="brand">
        <avatar class="brand-logo" />
        <span class="brand-name">Pure Admin</span>
      </div>
      <div class="toolbar-actions">
        <!-- 主题切换 -->
        <el-switch
          v-model="dataTheme"
          inline-prompt
          :active-icon="dayIcon"
          :inactive-icon="darkIcon"
          @change="dataThemeChange"
        />
        <!-- 国际化 -->
        <el-dropdown trigger="click">
          <globalization
            class="hover:text-primary hover:bg-transparent w-[20px] h-[20px] ml-3 cursor-pointer outline-hidden duration-300"
          />
          <template #dropdown>
            <el-dropdown-menu class="translation">
              <el-dropdown-item
                :style="getDropdownItemStyle(locale, 'zh')"
                :class="['dark:text-white', getDropdownItemClass(locale, 'zh')]"
                @click="translationCh"
              >
                <IconifyIconOffline
                  v-show="locale === 'zh'"
                  class="check-btn"
                  :icon="Check"
                />
                简体中文
              </el-dropdown-item>
              <el-dropdown-item
                :style="getDropdownItemStyle(locale, 'tw')"
                :class="['dark:text-white', getDropdownItemClass(locale, 'tw')]"
                @click="translationTw"
              >
                <IconifyIconOffline
                  v-show="locale === 'tw'"
                  class="check-btn"
                  :icon="Check"
                />
                繁體中文
              </el-dropdown-item>
              <el-dropdown-item
                :style="getDropdownItemStyle(locale, 'en')"
                :class="['dark:text-white', getDropdownItemClass(locale, 'en')]"
                @click="translationEn"
              >
                <span v-show="locale === 'en'" class="check-btn">
                  <IconifyIconOffline :icon="Check" />
                </span>
                English
              </el-dropdown-item>
              <el-dropdown-item
                :style="getDropdownItemStyle(locale, 'ja')"
                :class="['dark:text-white', getDropdownItemClass(locale, 'ja')]"
                @click="translationJa"
              >
                <span v-show="locale === 'ja'" class="check-btn">
                  <IconifyIconOffline :icon="Check" />
                </span>
                日本語
              </el-dropdown-item>
              <el-dropdown-item
                :style="getDropdownItemStyle(locale, 'ko')"
                :class="['dark:text-white', getDropdownItemClass(locale, 'ko')]"
                @click="translationKo"
              >
                <span v-show="locale === 'ko'" class="check-btn">
                  <IconifyIconOffline :icon="Check" />
                </span>
                한국어
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="main-content">
      <!-- 左侧展示区 -->
      <div class="showcase-section" :class="{ loaded: isLoaded }">
        <!-- 主标题 -->
        <div class="hero-section">
          <h1 class="hero-title">
            <span class="gradient-text">智慧管理</span>
            <br />
            <span class="sub-title">新一代企业级管理平台</span>
          </h1>
          <p class="hero-desc">
            基于 Vue 3.0 + TypeScript + Vite + Element Plus
            构建的企业级后台管理系统，
            提供丰富的组件和功能模块，助力企业数字化转型。
          </p>
        </div>

        <!-- 特性展示 -->
        <div class="features-grid">
          <div
            v-for="(feature, index) in features"
            :key="index"
            class="feature-card"
            :style="{ animationDelay: `${index * 0.1}s` }"
          >
            <div class="feature-icon">{{ feature.icon }}</div>
            <div class="feature-content">
              <h3>{{ feature.title }}</h3>
              <p>{{ feature.desc }}</p>
            </div>
          </div>
        </div>

        <!-- 统计数据 -->
        <div class="statistics-bar">
          <div
            v-for="(stat, index) in statistics"
            :key="index"
            class="stat-item"
          >
            <div class="stat-number">{{ stat.number }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </div>

        <!-- 插图 -->
        <div class="illustration-wrapper">
          <component :is="toRaw(illustration)" class="main-illustration" />
        </div>
      </div>

      <!-- 右侧登录区 -->
      <div class="login-section" :class="{ loaded: isLoaded }">
        <div class="login-card">
          <div class="login-header">
            <avatar class="login-avatar" />
            <Motion>
              <h2 class="login-title">
                <TypeIt
                  :options="{ strings: [title], cursor: false, speed: 100 }"
                />
              </h2>
            </Motion>
            <p class="login-subtitle">欢迎回来，请登录您的账户</p>
          </div>

          <el-form
            v-if="currentPage === 0"
            ref="ruleFormRef"
            :model="ruleForm"
            :rules="loginRules"
            size="large"
            class="login-form"
          >
            <Motion v-if="VITE_ENABLE_TENANT === 'true'">
              <el-form-item
                :rules="[
                  {
                    required: true,
                    message: transformI18n($t('login.pureTenantReg')),
                    trigger: 'blur'
                  }
                ]"
                prop="tenant"
                class="floating-label-item"
                :class="{
                  'has-value': !!ruleForm.tenant,
                  'is-focused': isTenantFocused
                }"
              >
                <el-input
                  v-model="ruleForm.tenant"
                  clearable
                  placeholder=""
                  :prefix-icon="useRenderIcon(Tenant)"
                  @focus="isTenantFocused = true"
                  @blur="isTenantFocused = false"
                />
                <label class="floating-label">{{
                  t("login.pureTenant")
                }}</label>
              </el-form-item>
            </Motion>

            <Motion :delay="100">
              <el-form-item
                :rules="[
                  {
                    required: true,
                    message: transformI18n($t('login.pureUsernameReg')),
                    trigger: 'blur'
                  }
                ]"
                prop="username"
                class="floating-label-item"
                :class="{
                  'has-value': !!ruleForm.username,
                  'is-focused': isUsernameFocused
                }"
              >
                <el-input
                  v-model="ruleForm.username"
                  clearable
                  placeholder=""
                  :prefix-icon="useRenderIcon(User)"
                  @focus="isUsernameFocused = true"
                  @blur="isUsernameFocused = false"
                />
                <label class="floating-label">{{
                  t("login.pureUsername")
                }}</label>
              </el-form-item>
            </Motion>

            <Motion :delay="150">
              <el-form-item
                prop="password"
                class="floating-label-item"
                :class="{
                  'has-value': !!ruleForm.password,
                  'is-focused': isPasswordFocused
                }"
              >
                <el-input
                  v-model="ruleForm.password"
                  clearable
                  :type="passwordVisible ? 'text' : 'password'"
                  placeholder=""
                  :prefix-icon="useRenderIcon(Lock)"
                  @focus="isPasswordFocused = true"
                  @blur="isPasswordFocused = false"
                >
                  <template #suffix>
                    <IconifyIconOffline
                      :icon="passwordVisible ? Eye : EyeOff"
                      class="cursor-pointer"
                      @click="passwordVisible = !passwordVisible"
                    />
                  </template>
                </el-input>
                <label class="floating-label">{{
                  t("login.purePassword")
                }}</label>
              </el-form-item>
            </Motion>

            <Motion :delay="200">
              <el-form-item
                prop="verifyCode"
                class="floating-label-item"
                :class="{
                  'has-value': !!ruleForm.verifyCode,
                  'is-focused': isVerifyCodeFocused
                }"
              >
                <el-input
                  v-model="ruleForm.verifyCode"
                  clearable
                  placeholder=""
                  :prefix-icon="useRenderIcon(Keyhole)"
                  @focus="isVerifyCodeFocused = true"
                  @blur="isVerifyCodeFocused = false"
                >
                  <template v-slot:append>
                    <ReImageVerify v-model:code="imgCode" />
                  </template>
                </el-input>
                <label class="floating-label">{{
                  t("login.pureVerifyCode")
                }}</label>
              </el-form-item>
            </Motion>

            <Motion :delay="250">
              <el-form-item>
                <div class="w-full h-[20px] flex justify-between items-center">
                  <el-checkbox v-model="checked">
                    <span class="flex">
                      <select
                        v-model="loginDay"
                        :style="{
                          width: loginDay < 10 ? '10px' : '16px',
                          outline: 'none',
                          background: 'none',
                          appearance: 'none',
                          border: 'none'
                        }"
                      >
                        <option value="1">1</option>
                        <option value="7">7</option>
                        <option value="30">30</option>
                      </select>
                      {{ t("login.pureRemember") }}
                      <IconifyIconOffline
                        v-tippy="{
                          content: t('login.pureRememberInfo'),
                          placement: 'top'
                        }"
                        :icon="Info"
                        class="ml-1"
                      />
                    </span>
                  </el-checkbox>
                  <el-button
                    link
                    type="primary"
                    @click="useUserStoreHook().SET_CURRENTPAGE(4)"
                  >
                    {{ t("login.pureForget") }}
                  </el-button>
                </div>
                <el-button
                  class="w-full mt-4 login-btn"
                  size="default"
                  type="primary"
                  :loading="loading"
                  :disabled="disabled"
                  @click="onLogin(ruleFormRef)"
                >
                  {{ t("login.pureLogin") }}
                </el-button>
              </el-form-item>
            </Motion>

            <Motion :delay="300">
              <el-form-item>
                <div class="w-full h-[20px] flex justify-between items-center">
                  <el-button
                    v-for="(item, index) in operates"
                    :key="index"
                    class="w-full mt-4"
                    size="default"
                    @click="useUserStoreHook().SET_CURRENTPAGE(index + 1)"
                  >
                    {{ t(item.title) }}
                  </el-button>
                </div>
              </el-form-item>
            </Motion>
          </el-form>

          <Motion v-if="currentPage === 0" :delay="350">
            <el-form-item>
              <el-divider>
                <p class="text-gray-500 text-xs">
                  {{ t("login.pureThirdLogin") }}
                </p>
              </el-divider>
              <div class="w-full flex justify-evenly third-party-icons">
                <span
                  v-for="(item, index) in thirdParty"
                  :key="index"
                  :title="t(item.title)"
                  class="third-party-item"
                >
                  <IconifyIconOnline
                    :icon="`ri:${item.icon}-fill`"
                    width="24"
                    class="cursor-pointer"
                  />
                </span>
              </div>
            </el-form-item>
          </Motion>

          <!-- 手机号登录 -->
          <LoginPhone v-if="currentPage === 1" />
          <!-- 二维码登录 -->
          <LoginQrCode v-if="currentPage === 2" />
          <!-- 注册 -->
          <LoginRegist v-if="currentPage === 3" />
          <!-- 忘记密码 -->
          <LoginUpdate v-if="currentPage === 4" />
        </div>
      </div>
    </div>

    <!-- 底部信息 -->
    <div class="footer-info">
      <div class="footer-links">
        <a href="https://pure-admin.cn" target="_blank">官方文档</a>
        <span class="divider">|</span>
        <a href="https://github.com/pure-admin" target="_blank">GitHub</a>
        <span class="divider">|</span>
        <a href="#">技术支持</a>
        <span class="divider">|</span>
        <a href="#">隐私政策</a>
      </div>
      <p class="copyright">
        © {{ new Date().getFullYear() }} 吉林省云创迅捷软件开发有限公司
        版权所有
      </p>
      <p
        class="beian"
        style="
          display: flex;
          gap: 15px;
          align-items: center;
          justify-content: center;
          margin-top: 5px;
          font-size: 12px;
          color: #888;
        "
      >
        <a
          href="https://beian.miit.gov.cn/"
          target="_blank"
          style="color: inherit; text-decoration: none"
          >吉ICP备2025035820号-1</a
        >
        <a
          href="https://beian.mps.gov.cn/#/query/webSearch?code=22017302000511"
          rel="noreferrer"
          target="_blank"
          style="
            display: inline-flex;
            align-items: center;
            color: inherit;
            text-decoration: none;
          "
        >
          <img
            src="https://jsd.kai233.top/web/img/batb.png"
            style="width: 16px; margin-right: 3px"
            alt="备案图标"
          />吉公网安备22017302000511号
        </a>
      </p>
    </div>
  </div>
</template>

<style scoped>
@import url("@/style/login.css");
</style>

<style lang="scss" scoped>
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-20px);
  }
}

// 响应式设计
@media screen and (max-width: 1200px) {
  .main-content {
    grid-template-columns: 1fr;
    gap: 40px;
    padding: 100px 40px;
  }

  .showcase-section {
    order: 2;
  }

  .login-section {
    order: 1;
  }

  .hero-title {
    font-size: 40px;
  }

  .sub-title {
    font-size: 24px;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }

  .statistics-bar {
    flex-wrap: wrap;
    justify-content: center;
  }

  .illustration-wrapper {
    display: none;
  }
}

@media screen and (max-width: 768px) {
  .top-toolbar {
    padding: 16px 20px;
  }

  .brand-name {
    display: none;
  }

  .main-content {
    padding: 80px 20px 100px;
  }

  .hero-title {
    font-size: 32px;
  }

  .sub-title {
    font-size: 20px;
  }

  .hero-desc {
    font-size: 14px;
  }

  .login-card {
    padding: 24px;
    border-radius: 16px;
  }

  .feature-card {
    padding: 16px;
  }

  .statistics-bar {
    gap: 24px;
  }

  .stat-number {
    font-size: 28px;
  }
}

.login-page {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
}

.gradient-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  background:
    radial-gradient(
      ellipse at 20% 50%,
      rgb(120 119 198 / 30%) 0%,
      transparent 50%
    ),
    radial-gradient(
      ellipse at 80% 20%,
      rgb(255 119 198 / 20%) 0%,
      transparent 40%
    ),
    radial-gradient(
      ellipse at 40% 80%,
      rgb(120 200 255 / 20%) 0%,
      transparent 40%
    );
}

.top-toolbar {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 40px;
  background: rgb(255 255 255 / 10%);
  border-bottom: 1px solid rgb(255 255 255 / 10%);
  backdrop-filter: blur(10px);
}

.brand {
  display: flex;
  gap: 12px;
  align-items: center;
}

.brand-logo {
  width: 40px;
  height: 40px;
}

.brand-name {
  font-size: 24px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 2px 4px rgb(0 0 0 / 10%);
}

.toolbar-actions {
  display: flex;
  gap: 16px;
  align-items: center;
}

.main-content {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr 480px;
  gap: 60px;
  min-height: 100vh;
  padding: 100px 60px 80px;
}

.showcase-section {
  display: flex;
  flex-direction: column;
  justify-content: center;
  opacity: 0;
  transform: translateX(-30px);
  transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);

  &.loaded {
    opacity: 1;
    transform: translateX(0);
  }
}

.hero-section {
  margin-bottom: 40px;
}

.hero-title {
  margin-bottom: 24px;
  font-size: 56px;
  font-weight: 800;
  line-height: 1.2;
}

.gradient-text {
  text-shadow: none;
  background: linear-gradient(135deg, #fff 0%, #e0e7ff 100%);
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.sub-title {
  font-size: 32px;
  font-weight: 600;
  color: rgb(255 255 255 / 90%);
}

.hero-desc {
  max-width: 600px;
  font-size: 18px;
  line-height: 1.8;
  color: rgb(255 255 255 / 80%);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 40px;
}

.feature-card {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 20px;
  background: rgb(255 255 255 / 10%);
  border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 16px;
  opacity: 0;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  animation: fade-in-up 0.6s ease forwards;

  &:hover {
    background: rgb(255 255 255 / 15%);
    box-shadow: 0 20px 40px rgb(0 0 0 / 10%);
    transform: translateY(-4px);
  }
}

.feature-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  font-size: 32px;
  background: rgb(255 255 255 / 20%);
  border-radius: 12px;
}

.feature-content {
  h3 {
    margin-bottom: 6px;
    font-size: 18px;
    font-weight: 600;
    color: #fff;
  }

  p {
    margin: 0;
    font-size: 14px;
    color: rgb(255 255 255 / 70%);
  }
}

.statistics-bar {
  display: flex;
  gap: 40px;
  padding: 30px 0;
  margin-bottom: 40px;
  border-top: 1px solid rgb(255 255 255 / 20%);
  border-bottom: 1px solid rgb(255 255 255 / 20%);
}

.stat-item {
  text-align: center;
}

.stat-number {
  margin-bottom: 8px;
  font-size: 36px;
  font-weight: 800;
  line-height: 1;
  color: #fff;
}

.stat-label {
  font-size: 14px;
  color: rgb(255 255 255 / 70%);
}

.illustration-wrapper {
  display: flex;
  justify-content: center;

  .main-illustration {
    width: 100%;
    max-width: 500px;
    height: auto;
    filter: drop-shadow(0 20px 40px rgb(0 0 0 / 20%));
    animation: float 6s ease-in-out infinite;
  }
}

.login-section {
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: translateX(30px);
  transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  transition-delay: 0.2s;

  &.loaded {
    opacity: 1;
    transform: translateX(0);
  }
}

.login-card {
  width: 100%;
  max-width: 420px;
  padding: 40px;
  background: rgb(255 255 255 / 95%);
  border-radius: 24px;
  box-shadow:
    0 25px 50px rgb(0 0 0 / 15%),
    0 0 0 1px rgb(255 255 255 / 20%);
  backdrop-filter: blur(20px);
}

.login-header {
  margin-bottom: 32px;
  text-align: center;
}

.login-avatar {
  width: 80px;
  height: 80px;
  margin-bottom: 16px;
}

.login-title {
  margin-bottom: 8px;
  font-size: 28px;
  font-weight: 700;
  color: #1f2937;
}

.login-subtitle {
  font-size: 14px;
  color: #6b7280;
}

.login-form {
  .floating-label-item {
    position: relative;

    :deep(.el-input__wrapper) {
      height: 48px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgb(0 0 0 / 4%);
    }

    .floating-label {
      position: absolute;
      top: 50%;
      left: 40px;
      z-index: 10;
      font-size: 15px;
      color: #bfc3c7;
      pointer-events: none;
      transform: translateY(-50%);
      transition: all 0.2s ease;
    }

    &.is-focused .floating-label,
    &.has-value .floating-label {
      top: 0;
      left: 12px;
      z-index: 10;
      padding: 0 4px;
      font-size: 12px;
      color: #667eea;
      background: #fff;
    }
  }

  :deep(.el-button--primary) {
    height: 48px;
    font-size: 16px;
    font-weight: 600;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    border-radius: 12px;
    transition: all 0.3s ease;

    &:hover {
      box-shadow: 0 10px 30px rgb(102 126 234 / 40%);
      transform: translateY(-2px);
    }
  }
}

.third-party-icons {
  margin-top: 16px;
}

.third-party-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  color: #6b7280;
  background: #f3f4f6;
  border-radius: 12px;
  transition: all 0.3s ease;

  &:hover {
    color: #fff;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    box-shadow: 0 10px 20px rgb(102 126 234 / 30%);
    transform: translateY(-4px);
  }
}

.footer-info {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 10;
  padding: 20px;
  text-align: center;
  background: rgb(0 0 0 / 10%);
  backdrop-filter: blur(10px);
}

.footer-links {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-bottom: 8px;

  a {
    font-size: 14px;
    color: rgb(255 255 255 / 80%);
    text-decoration: none;
    transition: color 0.3s;

    &:hover {
      color: #fff;
    }
  }

  .divider {
    color: rgb(255 255 255 / 40%);
  }
}

.copyright {
  margin: 0;
  font-size: 12px;
  color: rgb(255 255 255 / 60%);
}

:deep(.el-input-group__append, .el-input-group__prepend) {
  padding: 0;
}

.translation {
  :deep(.el-dropdown-menu__item) {
    padding: 5px 40px;
  }

  .check-btn {
    position: absolute;
    left: 20px;
  }
}
</style>
