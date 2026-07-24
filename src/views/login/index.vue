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
import { useLayout } from "@/layout/hooks/useLayout";
import LoginRegist from "./components/LoginRegist.vue";
import ParticlesBg from "./components/ParticlesBg.vue";
import { useUserStoreHook } from "@/store/modules/user";
import { avatar, illustration } from "./utils/static";
import { ref, toRaw, reactive, watch, computed, onMounted } from "vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { useTranslationLang } from "@/layout/hooks/useTranslationLang";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";
import { resetThemeToDefault } from "@/utils/auth";
import { userLogin } from "@/api/user";
import {
  completeUserCenterAuthentication,
  requireAuthData,
  resolveAuthErrorMessage
} from "./utils/userCenterSession";

import dayIcon from "@/assets/svg/day.svg?component";
import darkIcon from "@/assets/svg/dark.svg?component";
import globalization from "@/assets/svg/globalization.svg?component";
import Lock from "~icons/ri/lock-fill";
import Eye from "~icons/ri/eye-line";
import EyeOff from "~icons/ri/eye-off-line";
import Check from "~icons/ep/check";
import User from "~icons/ri/user-3-fill";
import Info from "~icons/ri/information-line";

defineOptions({
  name: "Login"
});

const loginDay = ref(7);
const router = useRouter();
const loading = ref(false);
const checked = ref(false);
const disabled = ref(false);
const ruleFormRef = ref<FormInstance>();
const isUsernameFocused = ref(false);
const isPasswordFocused = ref(false);
const passwordVisible = ref(false);
const currentPage = computed(() => {
  return useUserStoreHook().currentPage;
});

// 动画状态
const isLoaded = ref(false);

onMounted(() => {
  useUserStoreHook().SET_CURRENTPAGE(0);
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
const productTitle = computed(
  () => String(title.value || "").trim() || "启明智教"
);
const {
  locale,
  translationCh,
  translationTw,
  translationEn,
  translationJa,
  translationKo
} = useTranslationLang();
const ruleForm = reactive({
  username: "",
  password: ""
});

const features = [
  {
    icon: "book-open-line",
    title: "课程教学",
    desc: "集中管理课程、资料与学习进度"
  },
  {
    icon: "file-list-3-line",
    title: "作业考试",
    desc: "支持作业练习、在线考试与成绩查看"
  },
  {
    icon: "discuss-line",
    title: "教学互动",
    desc: "通过课程讨论连接教师与学生"
  },
  {
    icon: "sparkling-2-line",
    title: "智能助学",
    desc: "在教学流程中使用智能学习工具"
  }
];

const onLogin = async (formEl: FormInstance | undefined) => {
  if (!formEl || loading.value) return;

  const valid = await formEl.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  disabled.value = true;
  try {
    const mobile = ruleForm.username.trim();
    const response = await userLogin({
      mobile,
      password: ruleForm.password
    });
    const authData = requireAuthData(response, "手机号或密码错误");
    await completeUserCenterAuthentication(router, mobile, authData);
    message(t("login.pureLoginSuccess"), { type: "success" });
  } catch (error) {
    message(resolveAuthErrorMessage(error, "登录失败，请稍后重试"), {
      type: "error"
    });
  } finally {
    loading.value = false;
    disabled.value = false;
  }
};

const immediateDebounce = debounce(
  () => onLogin(ruleFormRef.value),
  1000,
  true
);

useEventListener(document, "keydown", ({ code }) => {
  if (
    ["Enter", "NumpadEnter"].includes(code) &&
    currentPage.value === 0 &&
    !disabled.value &&
    !loading.value
  )
    immediateDebounce();
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
        <span class="brand-name">{{ productTitle }}</span>
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
            <span class="gradient-text">启明智教</span>
            <br />
            <span class="sub-title">教学、学习与课程协作平台</span>
          </h1>
          <p class="hero-desc">
            面向教师与学生，覆盖课程学习、作业考试、教学讨论和智能助学等日常教学场景。
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
            <div class="feature-icon">
              <IconifyIconOnline :icon="`ri:${feature.icon}`" width="28" />
            </div>
            <div class="feature-content">
              <h3>{{ feature.title }}</h3>
              <p>{{ feature.desc }}</p>
            </div>
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
                  :options="{
                    strings: [productTitle],
                    cursor: false,
                    speed: 100
                  }"
                />
              </h2>
            </Motion>
            <p class="login-subtitle">
              {{
                currentPage === 3
                  ? "使用手机号创建账号"
                  : "请使用手机号和密码登录"
              }}
            </p>
          </div>

          <el-form
            v-if="currentPage === 0"
            ref="ruleFormRef"
            :model="ruleForm"
            :rules="loginRules"
            size="large"
            class="login-form"
          >
            <Motion>
              <el-form-item
                prop="username"
                class="floating-label-item"
                :class="{
                  'has-value': !!ruleForm.username,
                  'is-focused': isUsernameFocused
                }"
              >
                <el-input
                  v-model.trim="ruleForm.username"
                  clearable
                  inputmode="tel"
                  autocomplete="username"
                  maxlength="11"
                  placeholder=""
                  :prefix-icon="useRenderIcon(User)"
                  @focus="isUsernameFocused = true"
                  @blur="isUsernameFocused = false"
                />
                <label class="floating-label">手机号</label>
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
                  autocomplete="current-password"
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
              <el-form-item>
                <div class="w-full remember-row">
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

            <Motion :delay="250">
              <el-form-item>
                <el-button
                  class="w-full"
                  size="default"
                  @click="useUserStoreHook().SET_CURRENTPAGE(3)"
                >
                  注册账号
                </el-button>
              </el-form-item>
            </Motion>
          </el-form>

          <LoginRegist v-if="currentPage === 3" />
        </div>
      </div>
    </div>

    <!-- 底部信息 -->
    <div class="footer-info">
      <p class="copyright">
        © {{ new Date().getFullYear() }} 吉林省云创迅捷软件开发有限公司
        版权所有
      </p>
      <p class="beian">
        <a href="https://beian.miit.gov.cn/" target="_blank"
          >吉ICP备2025035820号-2X</a
        >
        <a
          href="https://beian.mps.gov.cn/#/query/webSearch?code=22017302000511"
          rel="noreferrer"
          target="_blank"
        >
          <img
            src="https://jsd.kai233.top/web/img/batb.png"
            class="beian-icon"
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

.login-page {
  position: relative;
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
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
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 1fr 480px;
  gap: 60px;
  width: 100%;
  min-width: 0;
  min-height: 100vh;
  padding: 100px 60px 80px;
  margin: 0;
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
  width: 100%;
  min-width: 0;
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
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
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
  width: 100%;
  min-width: 0;

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

.beian {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 15px;
  align-items: center;
  justify-content: center;
  margin: 5px 0 0;
  font-size: 12px;
  color: #b8b8b8;

  a {
    display: inline-flex;
    align-items: center;
    color: inherit;
    text-decoration: none;
  }
}

.beian-icon {
  width: 16px;
  margin-right: 3px;
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

@media screen and (width <= 1200px) {
  .login-page {
    overflow-x: hidden;
    overflow-y: auto;
  }

  .main-content {
    grid-template-columns: minmax(0, 1fr);
    gap: 40px;
    padding: 100px 40px 120px;
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

  .illustration-wrapper {
    display: none;
  }
}

@media screen and (width <= 768px) {
  .top-toolbar {
    padding: 14px 16px;
  }

  .brand {
    gap: 8px;
    min-width: 0;
  }

  .brand-logo {
    width: 34px;
    height: 34px;
  }

  .brand-name {
    overflow: hidden;
    font-size: 18px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .toolbar-actions {
    flex: 0 0 auto;
    gap: 8px;
  }

  .main-content {
    min-height: 100vh;
    min-height: 100dvh;
    padding: 84px 16px 132px;
  }

  .showcase-section {
    display: none;
  }

  .login-card {
    max-width: 420px;
    padding: 24px;
    border-radius: 16px;
  }

  .footer-info {
    position: absolute;
    padding: 12px 8px;
  }
}

@media screen and (width <= 390px) {
  .main-content {
    padding-right: 12px;
    padding-left: 12px;
  }

  .login-card {
    max-width: 100%;
    padding: 22px 16px;
  }

  .login-header {
    margin-bottom: 24px;
  }

  .login-avatar {
    width: 64px;
    height: 64px;
  }

  .beian {
    flex-direction: column;
    gap: 3px;
  }
}
</style>
