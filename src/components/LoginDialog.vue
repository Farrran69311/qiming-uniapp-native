<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="visible"
        class="login-overlay"
        @click.self="emit('update:visible', false)"
      >
        <div
          class="login-card"
          :class="{ shake: isShaking, 'legal-card': activeLegalDocument }"
        >
          <!--   关闭按钮   -->
          <button
            type="button"
            class="close-btn"
            aria-label="关闭登录弹窗"
            @click="emit('update:visible', false)"
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path
                fill="currentColor"
                d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"
              />
            </svg>
          </button>

          <LoginLegalDocument
            v-if="activeLegalDocument"
            :type="activeLegalDocument"
            @back="activeLegalDocument = null"
            @accept="handleLegalDocumentAccepted"
          />

          <!-- 登录表单 -->
          <template v-else-if="!isRegister">
            <h2 class="card-title">欢迎登录</h2>

            <!-- 账号输入 -->
            <div class="input-group">
              <div
                class="input-wrapper"
                :class="{
                  focus: isPhoneFocused,
                  error: errors.phone,
                  'has-value': !!loginForm.username
                }"
              >
                <svg
                  class="input-icon"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                >
                  <path
                    fill="currentColor"
                    d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"
                  />
                </svg>
                <input
                  ref="phoneInputRef"
                  v-model="loginForm.username"
                  type="text"
                  inputmode="text"
                  autocomplete="username"
                  aria-label="账号或手机号"
                  placeholder=""
                  maxlength="30"
                  @focus="isPhoneFocused = true"
                  @blur="isPhoneFocused = false"
                  @keyup.enter="handlePasswordLogin"
                />
                <label class="floating-label">请输入账号或手机号</label>
              </div>
              <p v-if="errors.phone" class="error-text">{{ errors.phone }}</p>
            </div>

            <!-- 密码登录 -->
            <div class="input-group">
              <div
                class="input-wrapper password-wrapper"
                :class="{
                  focus: isPasswordFocused,
                  error: errors.password,
                  'has-value': !!loginForm.password
                }"
              >
                <svg
                  class="input-icon"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                >
                  <path
                    fill="currentColor"
                    d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z"
                  />
                </svg>
                <input
                  ref="passwordInputRef"
                  v-model="loginForm.password"
                  :type="showLoginPassword ? 'text' : 'password'"
                  autocomplete="current-password"
                  aria-label="密码"
                  placeholder=""
                  @focus="isPasswordFocused = true"
                  @blur="isPasswordFocused = false"
                  @keyup.enter="handlePasswordLogin"
                />
                <label class="floating-label">请输入密码</label>
                <button
                  type="button"
                  class="eye-btn"
                  :aria-label="showLoginPassword ? '隐藏密码' : '显示密码'"
                  @click="showLoginPassword = !showLoginPassword"
                >
                  <svg
                    v-if="showLoginPassword"
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                  >
                    <path
                      fill="currentColor"
                      d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"
                    />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" width="20" height="20">
                    <path
                      fill="currentColor"
                      d="M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,16.8 12.79,17 12,17A5,5 0 0,1 7,12C7,11.21 7.2,10.47 7.53,9.8M2,4.27L4.28,6.55L4.73,7C3.08,8.3 1.78,10 1,12C2.73,16.39 7,19.5 12,19.5C13.55,19.5 15.03,19.2 16.38,18.66L16.81,19.08L19.73,22L21,20.73L3.27,3M12,7A5,5 0 0,1 17,12C17,12.64 16.87,13.26 16.64,13.82L19.57,16.75C21.07,15.5 22.27,13.86 23,12C21.27,7.61 17,4.5 12,4.5C10.6,4.5 9.26,4.75 8,5.2L10.17,7.35C10.74,7.13 11.35,7 12,7Z"
                    />
                  </svg>
                </button>
              </div>
              <p v-if="errors.password" class="error-text">
                {{ errors.password }}
              </p>
            </div>

            <div class="agreement-field" :class="{ error: errors.agreement }">
              <input
                id="login-agreement"
                v-model="agreementAccepted"
                type="checkbox"
                :aria-describedby="
                  errors.agreement ? 'login-agreement-error' : undefined
                "
                @change="handleAgreementChange"
              />
              <div class="agreement-copy">
                <label for="login-agreement">我已阅读并同意</label>
                <button type="button" @click="openLegalDocument('terms')">
                  《用户服务协议》
                </button>
                <span>和</span>
                <button type="button" @click="openLegalDocument('privacy')">
                  《隐私政策》
                </button>
              </div>
              <p
                v-if="errors.agreement"
                id="login-agreement-error"
                class="agreement-error"
                role="alert"
              >
                {{ errors.agreement }}
              </p>
            </div>

            <!-- 登录按钮 -->
            <button
              type="button"
              class="submit-btn"
              :class="{ loading: loading }"
              :disabled="loading"
              @click="handlePasswordLogin"
            >
              <svg
                v-if="loading"
                class="spinner"
                viewBox="0 0 24 24"
                width="20"
                height="20"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="3"
                  fill="none"
                  stroke-dasharray="32"
                  stroke-linecap="round"
                />
              </svg>
              <span v-else>登 录</span>
            </button>

            <!-- 注册链接 -->
            <div class="footer-link">
              还没有账号？<button
                type="button"
                class="link-btn"
                @click="isRegister = true"
              >
                立即注册
              </button>
            </div>
          </template>

          <!-- 注册表单 -->
          <template v-else>
            <button type="button" class="back-btn" @click="isRegister = false">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path
                  fill="currentColor"
                  d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z"
                />
              </svg>
              返回登录
            </button>

            <h2 class="card-title">创建账号</h2>

            <!-- 手机号 -->
            <div class="input-group">
              <div
                class="input-wrapper"
                :class="{
                  focus: registerPhoneFocused,
                  error: errors.registerPhone,
                  'has-value': !!registerForm.phone
                }"
              >
                <svg
                  class="input-icon"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                >
                  <path
                    fill="currentColor"
                    d="M17,19H7V5H17M17,1H7C5.89,1 5,1.89 5,3V21A2,2 0 0,0 7,23H17A2,2 0 0,0 19,21V3C19,1.89 18.1,1 17,1Z"
                  />
                </svg>
                <input
                  v-model="registerForm.phone"
                  type="text"
                  inputmode="tel"
                  autocomplete="tel"
                  aria-label="注册手机号"
                  placeholder=""
                  maxlength="11"
                  @focus="registerPhoneFocused = true"
                  @blur="registerPhoneFocused = false"
                />
                <label class="floating-label">请输入手机号</label>
              </div>
              <p v-if="errors.registerPhone" class="error-text">
                {{ errors.registerPhone }}
              </p>
            </div>

            <!-- 密码 -->
            <div class="input-group">
              <div
                class="input-wrapper password-wrapper"
                :class="{
                  focus: registerPasswordFocused,
                  error: errors.registerPassword,
                  'has-value': !!registerForm.password
                }"
              >
                <svg
                  class="input-icon"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                >
                  <path
                    fill="currentColor"
                    d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z"
                  />
                </svg>
                <input
                  v-model="registerForm.password"
                  :type="showRegisterPassword ? 'text' : 'password'"
                  autocomplete="new-password"
                  aria-label="注册密码"
                  placeholder=""
                  @focus="registerPasswordFocused = true"
                  @blur="registerPasswordFocused = false"
                />
                <label class="floating-label">请设置密码</label>
                <button
                  type="button"
                  class="eye-btn"
                  :aria-label="showRegisterPassword ? '隐藏密码' : '显示密码'"
                  @click="showRegisterPassword = !showRegisterPassword"
                >
                  <svg
                    v-if="showRegisterPassword"
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                  >
                    <path
                      fill="currentColor"
                      d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"
                    />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" width="20" height="20">
                    <path
                      fill="currentColor"
                      d="M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,16.8 12.79,17 12,17A5,5 0 0,1 7,12C7,11.21 7.2,10.47 7.53,9.8M2,4.27L4.28,6.55L4.73,7C3.08,8.3 1.78,10 1,12C2.73,16.39 7,19.5 12,19.5C13.55,19.5 15.03,19.2 16.38,18.66L16.81,19.08L19.73,22L21,20.73L3.27,3M12,7A5,5 0 0,1 17,12C17,12.64 16.87,13.26 16.64,13.82L19.57,16.75C21.07,15.5 22.27,13.86 23,12C21.27,7.61 17,4.5 12,4.5C10.6,4.5 9.26,4.75 8,5.2L10.17,7.35C10.74,7.13 11.35,7 12,7Z"
                    />
                  </svg>
                </button>
              </div>
              <p v-if="errors.registerPassword" class="error-text">
                {{ errors.registerPassword }}
              </p>
            </div>

            <!-- 确认密码 -->
            <div class="input-group">
              <div
                class="input-wrapper password-wrapper"
                :class="{
                  focus: confirmPasswordFocused,
                  error: errors.confirmPassword,
                  'has-value': !!registerForm.confirmPassword
                }"
              >
                <svg
                  class="input-icon"
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                >
                  <path
                    fill="currentColor"
                    d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z"
                  />
                </svg>
                <input
                  v-model="registerForm.confirmPassword"
                  :type="showConfirmPassword ? 'text' : 'password'"
                  autocomplete="new-password"
                  aria-label="确认密码"
                  placeholder=""
                  @focus="confirmPasswordFocused = true"
                  @blur="confirmPasswordFocused = false"
                  @keyup.enter="handleRegister"
                />
                <label class="floating-label">请确认密码</label>
                <button
                  type="button"
                  class="eye-btn"
                  :aria-label="showConfirmPassword ? '隐藏密码' : '显示密码'"
                  @click="showConfirmPassword = !showConfirmPassword"
                >
                  <svg
                    v-if="showConfirmPassword"
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                  >
                    <path
                      fill="currentColor"
                      d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"
                    />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" width="20" height="20">
                    <path
                      fill="currentColor"
                      d="M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,16.8 12.79,17 12,17A5,5 0 0,1 7,12C7,11.21 7.2,10.47 7.53,9.8M2,4.27L4.28,6.55L4.73,7C3.08,8.3 1.78,10 1,12C2.73,16.39 7,19.5 12,19.5C13.55,19.5 15.03,19.2 16.38,18.66L16.81,19.08L19.73,22L21,20.73L3.27,3M12,7A5,5 0 0,1 17,12C17,12.64 16.87,13.26 16.64,13.82L19.57,16.75C21.07,15.5 22.27,13.86 23,12C21.27,7.61 17,4.5 12,4.5C10.6,4.5 9.26,4.75 8,5.2L10.17,7.35C10.74,7.13 11.35,7 12,7Z"
                    />
                  </svg>
                </button>
              </div>
              <p v-if="errors.confirmPassword" class="error-text">
                {{ errors.confirmPassword }}
              </p>
            </div>

            <div class="agreement-field" :class="{ error: errors.agreement }">
              <input
                id="register-agreement"
                v-model="agreementAccepted"
                type="checkbox"
                :aria-describedby="
                  errors.agreement ? 'register-agreement-error' : undefined
                "
                @change="handleAgreementChange"
              />
              <div class="agreement-copy">
                <label for="register-agreement">我已阅读并同意</label>
                <button type="button" @click="openLegalDocument('terms')">
                  《用户服务协议》
                </button>
                <span>和</span>
                <button type="button" @click="openLegalDocument('privacy')">
                  《隐私政策》
                </button>
              </div>
              <p
                v-if="errors.agreement"
                id="register-agreement-error"
                class="agreement-error"
                role="alert"
              >
                {{ errors.agreement }}
              </p>
            </div>

            <!-- 注册按钮 -->
            <button
              type="button"
              class="submit-btn"
              :class="{ loading: registerLoading }"
              :disabled="registerLoading"
              @click="handleRegister"
            >
              <svg
                v-if="registerLoading"
                class="spinner"
                viewBox="0 0 24 24"
                width="20"
                height="20"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="3"
                  fill="none"
                  stroke-dasharray="32"
                  stroke-linecap="round"
                />
              </svg>
              <span v-else>注 册</span>
            </button>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from "vue";
import type { PropType } from "vue";
import { ElMessage } from "element-plus";
import { useUserStoreHook } from "@/store/modules/user";
import { message } from "@/utils/message";
import { useI18n } from "vue-i18n";
import { userRegister, userLogin, getUserDetail } from "@/api/user";
import { setToken, getToken, removeToken } from "@/utils/auth";
import LoginLegalDocument from "@/components/LoginLegalDocument.vue";
import type { LoginLegalDocumentType } from "@/components/loginLegalDocuments";
import { grantPrivacyConsent, hasPrivacyConsent } from "@/utils/privacyConsent";

const rolesForRoleType = (roleType?: number) => {
  switch (Number(roleType)) {
    case 1:
      return ["student"];
    case 2:
      return ["teacher"];
    case 3:
      return ["admin"];
    default:
      return ["common"];
  }
};

const props = defineProps({
  visible: {
    type: Boolean as PropType<boolean>,
    required: true
  }
});

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
  (e: "login-success"): void;
}>();

const { t } = useI18n();

const isRegister = ref(false);
const activeLegalDocument = ref<LoginLegalDocumentType | null>(null);
const agreementAccepted = ref(hasPrivacyConsent());

// 输入引用
const phoneInputRef = ref<HTMLInputElement | null>(null);
const passwordInputRef = ref<HTMLInputElement | null>(null);

// 焦点状态
const isPhoneFocused = ref(false);
const isPasswordFocused = ref(false);
const registerPhoneFocused = ref(false);
const registerPasswordFocused = ref(false);
const confirmPasswordFocused = ref(false);

// 密码可见性状态
const showLoginPassword = ref(false);
const showRegisterPassword = ref(false);
const showConfirmPassword = ref(false);

// 加载状态
const loading = ref(false);
const registerLoading = ref(false);

// 晃动状态
const isShaking = ref(false);

// 触发晃动
const triggerShake = () => {
  console.log("触发晃动！");
  isShaking.value = false;
  // 强制重绘
  void document.body.offsetHeight;
  setTimeout(() => {
    isShaking.value = true;
    setTimeout(() => {
      isShaking.value = false;
    }, 600);
  }, 10);
};

// 表单数据
const loginForm = reactive({
  username: "",
  password: ""
});

const registerForm = reactive({
  phone: "",
  password: "",
  confirmPassword: ""
});

const errors = reactive({
  phone: "",
  password: "",
  registerPhone: "",
  registerPassword: "",
  confirmPassword: "",
  agreement: ""
});

// 清除错误
const clearErrors = () => {
  Object.keys(errors).forEach(key => {
    errors[key as keyof typeof errors] = "";
  });
};

const openLegalDocument = (type: LoginLegalDocumentType) => {
  activeLegalDocument.value = type;
};

const handleLegalDocumentAccepted = () => {
  agreementAccepted.value = true;
  errors.agreement = "";
  activeLegalDocument.value = null;
};

const handleAgreementChange = () => {
  if (agreementAccepted.value) errors.agreement = "";
};

const ensureAgreementAccepted = () => {
  if (!agreementAccepted.value) {
    errors.agreement = "请先阅读并同意用户服务协议和隐私政策";
    triggerShake();
    return false;
  }

  grantPrivacyConsent();
  return true;
};

// 获取用户详细信息
const fetchUserDetail = async () => {
  try {
    const res = await getUserDetail();
    if (res && res.data && res.data.userInfo) {
      const userInfo = res.data.userInfo;
      const userStore = useUserStoreHook();
      userStore.SET_NICKNAME(userInfo.nickname || "");
      userStore.SET_AVATAR(userInfo.avatar || "");

      setToken({
        accessToken: getToken()?.accessToken || "",
        refreshToken: getToken()?.refreshToken || "",
        expires: getToken()?.expires
          ? new Date(getToken().expires)
          : new Date(),
        username: userInfo.mobile,
        nickname: userInfo.nickname,
        avatar: userInfo.avatar,
        roles: rolesForRoleType(userInfo.roleType),
        permissions: ["*:*:*"],
        roleType: userInfo.roleType,
        userId: userInfo.id
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

// 密码登录
const handlePasswordLogin = async () => {
  clearErrors();
  if (!ensureAgreementAccepted()) return;

  if (!loginForm.username) {
    errors.phone = "请输入账号";
    return;
  }
  if (loginForm.username.length < 2) {
    errors.phone = "账号至少2个字符";
    return;
  }
  if (!loginForm.password) {
    errors.password = "请输入密码";
    return;
  }

  loading.value = true;
  try {
    const res = await userLogin({
      mobile: loginForm.username,
      password: loginForm.password
    });

    if (res && res.data && res.data.accessToken) {
      setToken({
        accessToken: res.data.accessToken,
        expires: new Date(res.data.accessExpire * 1000),
        refreshToken: res.data.accessToken,
        username: loginForm.username,
        nickname: loginForm.username,
        roles: [],
        permissions: ["*:*:*"],
        roleType: 0
      });

      const detail = await fetchUserDetail();
      if (!detail?.data?.userInfo) {
        removeToken();
        throw new Error("Unable to load the authenticated user role");
      }
      message(t("login.pureLoginSuccess"), { type: "success" });

      setTimeout(() => {
        emit("login-success");
        emit("update:visible", false);
        resetForm();
      }, 500);
    } else {
      message(t("login.pureLoginFail"), { type: "error" });
      triggerShake();
    }
  } catch (error) {
    console.error("登录失败:", error);
    message(t("login.pureLoginFail"), { type: "error" });
    triggerShake();
  } finally {
    loading.value = false;
  }
};

// 注册处理
const handleRegister = async () => {
  clearErrors();
  if (!ensureAgreementAccepted()) return;

  if (!registerForm.phone) {
    errors.registerPhone = "请输入手机号";
    return;
  }
  if (!/^1[3-9]\d{9}$/.test(registerForm.phone)) {
    errors.registerPhone = "请输入正确的手机号";
    return;
  }
  if (!registerForm.password) {
    errors.registerPassword = "请设置密码";
    return;
  }
  if (registerForm.password.length < 6) {
    errors.registerPassword = "密码至少6位";
    return;
  }
  if (!registerForm.confirmPassword) {
    errors.confirmPassword = "请确认密码";
    return;
  }
  if (registerForm.password !== registerForm.confirmPassword) {
    errors.confirmPassword = "两次输入的密码不一致";
    return;
  }

  registerLoading.value = true;
  try {
    const res = await userRegister({
      mobile: registerForm.phone,
      password: registerForm.password
    });

    if (res && res.data && res.data.accessToken) {
      setToken({
        accessToken: res.data.accessToken,
        expires: new Date(res.data.accessExpire * 1000),
        refreshToken: res.data.accessToken,
        username: registerForm.phone,
        nickname: registerForm.phone,
        roles: [],
        permissions: ["*:*:*"],
        roleType: 0
      });

      const detail = await fetchUserDetail();
      if (!detail?.data?.userInfo) {
        removeToken();
        throw new Error("Unable to load the registered user role");
      }
      ElMessage.success("注册成功，已自动登录");

      setTimeout(() => {
        emit("login-success");
        emit("update:visible", false);
        resetForm();
      }, 500);
    } else {
      ElMessage.error("注册失败");
    }
  } catch (error) {
    console.error("注册失败:", error);
    ElMessage.error("注册失败，请稍后重试");
  } finally {
    registerLoading.value = false;
  }
};

// 重置表单
const resetForm = () => {
  loginForm.username = "";
  loginForm.password = "";
  registerForm.phone = "";
  registerForm.password = "";
  registerForm.confirmPassword = "";
  isRegister.value = false;
  activeLegalDocument.value = null;
  agreementAccepted.value = hasPrivacyConsent();
  clearErrors();
};

// 监听visible变化，重置表单
watch(
  () => props.visible,
  val => {
    if (val) {
      agreementAccepted.value = hasPrivacyConsent();
      activeLegalDocument.value = null;
    } else {
      setTimeout(resetForm, 300);
    }
  }
);
</script>

<style lang="scss" scoped>
@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}

.login-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 100px;
  background: rgb(0 0 0 / 50%);
  backdrop-filter: blur(8px);
}

/* 登录卡片 */
.login-card {
  position: relative;
  width: 380px;
  max-height: calc(100dvh - 132px);
  padding: 36px 32px;
  overflow-y: auto;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 25%);

  &.legal-card {
    width: min(680px, calc(100vw - 40px));
    padding: 0;
    overflow: hidden;
  }
}

/* 关闭按钮 */
.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  color: #8e8e93;
  cursor: pointer;
  background: #f5f5f7;
  border: none;
  border-radius: 8px;
  transition: all 0.2s;

  &:hover {
    color: #1a1a2e;
    background: #e5e5e7;
  }
}

/* 返回按钮 */
.back-btn {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 0;
  margin-bottom: 16px;
  font-size: 14px;
  color: #5dade2;
  cursor: pointer;
  background: transparent;
  border: none;
  transition: all 0.2s;

  &:hover {
    color: #3498db;
    transform: translateX(-3px);
  }
}

/* 标题 */
.card-title {
  margin: 0 0 24px;
  font-size: 24px;
  font-weight: 600;
  color: #1a1a2e;
  text-align: center;
}

/* 输入组 */
.input-group {
  margin-bottom: 16px;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  height: 48px;
  padding: 0 14px;
  background: #f5f7fa;
  border: 1.5px solid transparent;
  border-radius: 12px;
  transition: all 0.2s;

  &.focus {
    background: #fff;
    border-color: #5dade2;
    box-shadow: 0 0 0 3px rgb(93 173 226 / 12%);
  }

  &.error {
    background: #fff5f5;
    border-color: #ff6b6b;
  }
}

.floating-label {
  position: absolute;
  top: 50%;
  left: 44px;
  z-index: 10;
  font-size: 15px;
  color: #bfc3c7;
  pointer-events: none;
  transform: translateY(-50%);
  transition: all 0.2s ease;
}

.input-wrapper.focus .floating-label,
.input-wrapper.has-value .floating-label {
  top: 0;
  left: 12px;
  z-index: 10;
  padding: 0 4px;
  font-size: 12px;
  color: #5dade2;
  background: #fff;
}

.input-wrapper.error.focus .floating-label,
.input-wrapper.error.has-value .floating-label {
  color: #ff6b6b;
}

.input-icon {
  flex-shrink: 0;
  margin-right: 10px;
  color: #8e8e93;
}

.input-wrapper input {
  flex: 1;
  min-width: 0;
  height: 100%;
  font-size: 16px;
  color: #1a1a2e;
  outline: none;
  background: transparent;
  border: none;
  transition: filter 0.3s ease;

  &::placeholder {
    color: #bfc3c7;
  }
}

/* 密码眼睛按钮 */
.password-wrapper {
  padding-right: 8px;
}

.eye-btn {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  color: #8e8e93;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 6px;
  transition: all 0.2s;

  &:hover {
    color: #5dade2;
    background: rgb(0 0 0 / 5%);
  }

  &:active {
    transform: scale(0.95);
  }
}

.error-text {
  padding-left: 2px;
  margin: 6px 0 0;
  font-size: 12px;
  color: #ff6b6b;
}

.agreement-field {
  position: relative;
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  gap: 0 8px;
  align-items: start;
  padding: 3px 2px;
  margin: 2px 0 10px;

  input {
    width: 16px;
    height: 16px;
    margin-top: 2px;
    cursor: pointer;
    accent-color: #3498db;
  }

  &.error input {
    outline: 2px solid rgb(255 107 107 / 24%);
    outline-offset: 2px;
  }
}

.agreement-copy {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  font-size: 12px;
  line-height: 1.6;
  color: #7f8a98;

  label {
    cursor: pointer;
  }

  button {
    padding: 0;
    color: #368cc6;
    cursor: pointer;
    background: transparent;
    border: 0;

    &:hover,
    &:focus-visible {
      color: #1f6faa;
      text-decoration: underline;
      outline: none;
    }
  }
}

.agreement-error {
  grid-column: 2;
  margin: 3px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: #ff6b6b;
}

/* 提交按钮 */
.submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 48px;
  margin-top: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  background: linear-gradient(135deg, #5dade2 0%, #3498db 100%);
  border: none;
  border-radius: 12px;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    box-shadow: 0 8px 20px rgb(52 152 219 / 35%);
    transform: translateY(-1px);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .spinner {
    animation: spin 1s linear infinite;
  }
}

/* 底部链接 */
.footer-link {
  margin-top: 20px;
  font-size: 14px;
  color: #8e8e93;
  text-align: center;

  .link-btn {
    padding: 0;
    font-weight: 500;
    color: #5dade2;
    cursor: pointer;
    background: transparent;
    border: 0;
    text-decoration: none;

    &:hover {
      color: #3498db;
    }
  }
}

/* 动画 */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .login-card,
.modal-leave-to .login-card {
  opacity: 0;
  transform: scale(0.95) translateY(-20px);
}

.modal-enter-active .login-card,
.modal-leave-active .login-card {
  transition: all 0.3s ease;
}

/* 遮罩层 */

/* 移动端适配 */
@media screen and (max-width: 768px) {
  .login-overlay {
    align-items: center;
    padding-top: 0;
    padding: 16px;
  }

  .login-card {
    width: 100%;
    max-width: 320px;
    max-height: calc(100dvh - 32px);
    padding: 24px 20px;
    border-radius: 16px;

    &.legal-card {
      max-width: 560px;
      padding: 0;
    }
  }

  .card-title {
    margin-bottom: 16px;
    font-size: 20px;
  }

  .input-group {
    margin-bottom: 12px;
  }

  .input-wrapper {
    height: 44px;

    input {
      font-size: 16px;
    }

    .floating-label {
      font-size: 13px;
    }

    .input-icon {
      width: 18px;
      height: 18px;
    }
  }

  .submit-btn {
    height: 44px;
    margin-top: 4px;
    font-size: 15px;
    border-radius: 12px;
  }

  .agreement-field {
    margin-bottom: 8px;
  }

  .footer-link {
    margin-top: 14px;
    font-size: 13px;
  }

  .close-btn {
    top: 12px;
    right: 12px;
    width: 40px;
    height: 40px;
  }
}
</style>

<style lang="scss">
/* 全局晃动动画 - 不能 scoped */
@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }

  10%,
  30%,
  50%,
  70%,
  90% {
    transform: translateX(-10px);
  }

  20%,
  40%,
  60%,
  80% {
    transform: translateX(10px);
  }
}

.login-card.shake {
  animation: shake 0.5s ease-in-out;
}
</style>
