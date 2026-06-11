<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="visible"
        class="login-overlay"
        :style="nativeOverlayVars"
        @click.self="emit('update:visible', false)"
      >
        <div class="login-card" :class="{ shake: isShaking }">
          <!--   关闭按钮   -->
          <button class="close-btn" @click="emit('update:visible', false)">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path
                fill="currentColor"
                d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"
              />
            </svg>
          </button>

          <!-- 登录表单 -->
          <template v-if="!isRegister">
            <h2 class="card-title">欢迎登录</h2>

            <!-- 登录方式切换 -->
            <div class="login-tabs">
              <button
                class="tab-btn"
                :class="{ active: loginType === 'password' }"
                @click="loginType = 'password'"
              >
                密码登录
              </button>
              <button
                class="tab-btn"
                :class="{ active: loginType === 'sms' }"
                @click="loginType = 'sms'"
              >
                验证码登录
              </button>
            </div>

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
                  placeholder=""
                  maxlength="30"
                  @focus="isPhoneFocused = true"
                  @blur="isPhoneFocused = false"
                  @keyup.enter="
                    loginType === 'sms' ? sendSmsCode() : handlePasswordLogin()
                  "
                />
                <label class="floating-label">{{
                  loginType === "sms" ? "请输入手机号" : "请输入账号或手机号"
                }}</label>
              </div>
              <p v-if="errors.phone" class="error-text">{{ errors.phone }}</p>
            </div>

            <!-- 密码登录 -->
            <template v-if="loginType === 'password'">
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
                    placeholder=""
                    @focus="isPasswordFocused = true"
                    @blur="isPasswordFocused = false"
                    @keyup.enter="handlePasswordLogin"
                  />
                  <label class="floating-label">请输入密码</label>
                  <button
                    type="button"
                    class="eye-btn"
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
            </template>

            <!-- 验证码登录 -->
            <template v-else>
              <div class="input-group">
                <div class="sms-row">
                  <div
                    class="input-wrapper sms-input"
                    :class="{
                      focus: isCodeFocused,
                      error: errors.code,
                      'has-value': !!loginForm.smsCode
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
                        d="M17,3H7A2,2 0 0,0 5,5V21L12,18L19,21V5A2,2 0 0,0 17,3M12,13L9,10H11V6H13V10H15L12,13Z"
                      />
                    </svg>
                    <input
                      v-model="loginForm.smsCode"
                      type="text"
                      placeholder=""
                      maxlength="6"
                      @focus="isCodeFocused = true"
                      @blur="isCodeFocused = false"
                      @keyup.enter="handleSmsLogin"
                    />
                    <label class="floating-label">请输入验证码</label>
                  </div>
                  <button
                    class="sms-btn"
                    :disabled="smsCooldown > 0"
                    @click="sendSmsCode"
                  >
                    {{ smsCooldown > 0 ? `${smsCooldown}s` : "获取验证码" }}
                  </button>
                </div>
                <p v-if="errors.code" class="error-text">{{ errors.code }}</p>
              </div>
            </template>

            <!-- 登录按钮 -->
            <button
              class="submit-btn"
              :class="{ loading: loading }"
              :disabled="loading"
              @click="
                loginType === 'sms' ? handleSmsLogin() : handlePasswordLogin()
              "
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

            <!-- 第三方登录 -->
            <div class="third-party">
              <div class="divider">
                <span>其他登录方式</span>
              </div>
              <div class="social-btns">
                <button
                  class="social-btn wechat"
                  title="微信登录"
                  @click="handleWechatLogin"
                >
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path
                      fill="currentColor"
                      d="M9.5,4C5.36,4 2,6.69 2,10C2,11.89 3.08,13.56 4.78,14.66L4,17L6.5,15.5C7.39,15.81 8.37,16 9.41,16C9.15,15.37 9,14.7 9,14C9,10.69 12.13,8 16,8C16.19,8 16.38,8 16.56,8.03C15.54,5.69 12.78,4 9.5,4M6.5,6.5A1,1 0 0,1 7.5,7.5A1,1 0 0,1 6.5,8.5A1,1 0 0,1 5.5,7.5A1,1 0 0,1 6.5,6.5M11.5,6.5A1,1 0 0,1 12.5,7.5A1,1 0 0,1 11.5,8.5A1,1 0 0,1 10.5,7.5A1,1 0 0,1 11.5,6.5M16,9C12.69,9 10,11.24 10,14C10,16.76 12.69,19 16,19C16.67,19 17.31,18.92 17.91,18.75L20,20L19.38,18.13C20.95,17.22 22,15.71 22,14C22,11.24 19.31,9 16,9M14,11.5A1,1 0 0,1 15,12.5A1,1 0 0,1 14,13.5A1,1 0 0,1 13,12.5A1,1 0 0,1 14,11.5M18,11.5A1,1 0 0,1 19,12.5A1,1 0 0,1 18,13.5A1,1 0 0,1 17,12.5A1,1 0 0,1 18,11.5Z"
                    />
                  </svg>
                </button>
                <button
                  class="social-btn qq"
                  title="QQ登录"
                  @click="handleQQLogin"
                >
                  <svg viewBox="0 0 1024 1024" width="24" height="24">
                    <path
                      fill="currentColor"
                      d="M824.8 613.2c-16-51.4-34.4-94.6-62.7-165.3C766.5 262.2 689.3 112 511.5 112 331.7 112 256.2 265.2 261 447.9c-28.4 70.8-46.7 113.7-62.7 165.3-34 109.5-23 154.8-14.6 155.8 18 2.2 70.1-82.4 70.1-82.4 0 49 25.2 112.9 79.8 159-26.4 8.1-85.7 29.9-71.6 53.8 11.4 19.3 196.2 12.3 249.5 6.3 53.3 6 238.1 13 249.5-6.3 14.1-23.8-45.3-45.7-71.6-53.8 54.6-46.2 79.8-110.1 79.8-159 0 0 52.1 84.6 70.1 82.4 8.5-1.1 19.5-46.4-14.5-155.8z"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <!-- 注册链接 -->
            <div class="footer-link">
              还没有账号？<a href="javascript:;" @click="isRegister = true"
                >立即注册</a
              >
            </div>
          </template>

          <!-- 注册表单 -->
          <template v-else>
            <button class="back-btn" @click="isRegister = false">
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

            <!-- 验证码 -->
            <div class="input-group">
              <div class="sms-row">
                <div
                  class="input-wrapper sms-input"
                  :class="{
                    focus: registerCodeFocused,
                    error: errors.registerCode,
                    'has-value': !!registerForm.code
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
                      d="M17,3H7A2,2 0 0,0 5,5V21L12,18L19,21V5A2,2 0 0,0 17,3M12,13L9,10H11V6H13V10H15L12,13Z"
                    />
                  </svg>
                  <input
                    v-model="registerForm.code"
                    type="text"
                    placeholder=""
                    maxlength="6"
                    @focus="registerCodeFocused = true"
                    @blur="registerCodeFocused = false"
                  />
                  <label class="floating-label">请输入验证码</label>
                </div>
                <button
                  class="sms-btn"
                  :disabled="registerSmsCooldown > 0"
                  @click="sendRegisterSmsCode"
                >
                  {{
                    registerSmsCooldown > 0
                      ? `${registerSmsCooldown}s`
                      : "获取验证码"
                  }}
                </button>
              </div>
              <p v-if="errors.registerCode" class="error-text">
                {{ errors.registerCode }}
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
                  placeholder=""
                  @focus="registerPasswordFocused = true"
                  @blur="registerPasswordFocused = false"
                />
                <label class="floating-label">请设置密码</label>
                <button
                  type="button"
                  class="eye-btn"
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
                  placeholder=""
                  @focus="confirmPasswordFocused = true"
                  @blur="confirmPasswordFocused = false"
                  @keyup.enter="handleRegister"
                />
                <label class="floating-label">请确认密码</label>
                <button
                  type="button"
                  class="eye-btn"
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

            <!-- 注册按钮 -->
            <button
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
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch
} from "vue";
import type { PropType } from "vue";
import type { StyleValue } from "vue";
import { ElMessage } from "element-plus";
import { useUserStoreHook } from "@/store/modules/user";
import { message } from "@/utils/message";
import { useI18n } from "vue-i18n";
import { userRegister, userLogin, getUserDetail } from "@/api/user";
import { setToken, getToken } from "@/utils/auth";

const ROLE_BY_TYPE: Record<number, string[]> = {
  1: ["student"],
  2: ["teacher"],
  3: ["admin"]
};

function rolesFromRoleType(roleType?: number) {
  return ROLE_BY_TYPE[Number(roleType)] || ["common"];
}

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

const nativeViewportTop = ref(0);
const nativeViewportHeight = ref(0);

const isQimingNativeWebView = () =>
  typeof document !== "undefined" &&
  document.documentElement.classList.contains("qiming-native-webview");

const syncNativeOverlayBounds = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  nativeViewportTop.value =
    window.scrollY ||
    document.documentElement.scrollTop ||
    document.body?.scrollTop ||
    0;
  nativeViewportHeight.value =
    window.innerHeight || document.documentElement.clientHeight || 0;
};

const nativeOverlayVars = computed<StyleValue | undefined>(() => {
  if (!props.visible || !isQimingNativeWebView()) return undefined;
  const height =
    nativeViewportHeight.value ||
    (typeof window !== "undefined" ? window.innerHeight : 0);

  return {
    "--qiming-login-overlay-top": `${nativeViewportTop.value}px`,
    "--qiming-login-overlay-height": `${height}px`,
    position: "absolute",
    inset: "auto",
    top: `${nativeViewportTop.value}px`,
    right: "auto",
    bottom: "auto",
    left: "0",
    zIndex: "10050",
    width: "100vw",
    height: `${height}px`,
    minHeight: `${height}px`,
    maxHeight: `${height}px`,
    transform: "none"
  };
});

const handleNativeBack = (event: Event) => {
  if (!props.visible) return;
  event.preventDefault();
  emit("update:visible", false);
};

// 登录类型
const loginType = ref<"password" | "sms">("password");
const isRegister = ref(false);

// 输入引用
const phoneInputRef = ref<HTMLInputElement | null>(null);
const passwordInputRef = ref<HTMLInputElement | null>(null);

// 焦点状态
const isPhoneFocused = ref(false);
const isPasswordFocused = ref(false);
const isCodeFocused = ref(false);
const registerPhoneFocused = ref(false);
const registerCodeFocused = ref(false);
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

// 验证码倒计时
const smsCooldown = ref(0);
const registerSmsCooldown = ref(0);

// 表单数据
const loginForm = reactive({
  username: "",
  password: "",
  smsCode: ""
});

const registerForm = reactive({
  phone: "",
  code: "",
  password: "",
  confirmPassword: ""
});

const errors = reactive({
  phone: "",
  password: "",
  code: "",
  registerPhone: "",
  registerCode: "",
  registerPassword: "",
  confirmPassword: ""
});

// 清除错误
const clearErrors = () => {
  Object.keys(errors).forEach(key => {
    errors[key as keyof typeof errors] = "";
  });
};

// 发送登录验证码
const sendSmsCode = () => {
  if (!loginForm.username) {
    errors.phone = "请输入手机号";
    return;
  }
  if (!/^1[3-9]\d{9}$/.test(loginForm.username)) {
    errors.phone = "请输入正确的手机号";
    return;
  }

  errors.phone = "";
  smsCooldown.value = 60;
  const timer = setInterval(() => {
    smsCooldown.value--;
    if (smsCooldown.value <= 0) {
      clearInterval(timer);
    }
  }, 1000);

  ElMessage.success("验证码已发送");
  // TODO: 调用发送验证码API
};

// 发送注册验证码
const sendRegisterSmsCode = () => {
  if (!registerForm.phone) {
    errors.registerPhone = "请输入手机号";
    return;
  }
  if (!/^1[3-9]\d{9}$/.test(registerForm.phone)) {
    errors.registerPhone = "请输入正确的手机号";
    return;
  }

  errors.registerPhone = "";
  registerSmsCooldown.value = 60;
  const timer = setInterval(() => {
    registerSmsCooldown.value--;
    if (registerSmsCooldown.value <= 0) {
      clearInterval(timer);
    }
  }, 1000);

  ElMessage.success("验证码已发送");
  // TODO: 调用发送验证码API
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
      userStore.SET_ROLES(rolesFromRoleType(userInfo.roleType));

      setToken({
        accessToken: getToken()?.accessToken || "",
        refreshToken: getToken()?.refreshToken || "",
        expires: getToken()?.expires
          ? new Date(getToken().expires)
          : new Date(),
        username: userInfo.mobile,
        nickname: userInfo.nickname,
        avatar: userInfo.avatar,
        roles: rolesFromRoleType(userInfo.roleType),
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

// 密码登录
const handlePasswordLogin = async () => {
  clearErrors();

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
        roles: ["common"],
        permissions: ["*:*:*"]
      });

      await fetchUserDetail();
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

// 验证码登录
const handleSmsLogin = async () => {
  clearErrors();

  if (!loginForm.username) {
    errors.phone = "请输入手机号";
    return;
  }
  if (!/^1[3-9]\d{9}$/.test(loginForm.username)) {
    errors.phone = "请输入正确的手机号";
    return;
  }
  if (!loginForm.smsCode) {
    errors.code = "请输入验证码";
    return;
  }

  loading.value = true;
  try {
    // TODO: 调用验证码登录API
    ElMessage.info("验证码登录功能开发中...");
  } catch (error) {
    console.error("登录失败:", error);
    ElMessage.error("登录失败");
  } finally {
    loading.value = false;
  }
};

// 微信登录
const handleWechatLogin = () => {
  ElMessage.info("微信登录功能开发中...");
  // TODO: 调用微信登录
};

// QQ登录
const handleQQLogin = () => {
  ElMessage.info("QQ登录功能开发中...");
  // TODO: 调用QQ登录
};

// 注册处理
const handleRegister = async () => {
  clearErrors();

  if (!registerForm.phone) {
    errors.registerPhone = "请输入手机号";
    return;
  }
  if (!/^1[3-9]\d{9}$/.test(registerForm.phone)) {
    errors.registerPhone = "请输入正确的手机号";
    return;
  }
  if (!registerForm.code) {
    errors.registerCode = "请输入验证码";
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
        roles: ["admin"],
        permissions: ["*:*:*"]
      });

      await fetchUserDetail();
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
  loginForm.smsCode = "";
  registerForm.phone = "";
  registerForm.code = "";
  registerForm.password = "";
  registerForm.confirmPassword = "";
  isRegister.value = false;
  loginType.value = "password";
  clearErrors();
};

// 监听visible变化，重置表单
watch(
  () => props.visible,
  val => {
    if (val) {
      syncNativeOverlayBounds();
      void nextTick(syncNativeOverlayBounds);
      return;
    }

    setTimeout(resetForm, 300);
  }
);

onMounted(() => {
  syncNativeOverlayBounds();
  window.addEventListener("resize", syncNativeOverlayBounds);
  window.addEventListener("orientationchange", syncNativeOverlayBounds);
  window.addEventListener("scroll", syncNativeOverlayBounds, true);
  window.addEventListener("qiming:native-back", handleNativeBack);
});

onUnmounted(() => {
  window.removeEventListener("resize", syncNativeOverlayBounds);
  window.removeEventListener("orientationchange", syncNativeOverlayBounds);
  window.removeEventListener("scroll", syncNativeOverlayBounds, true);
  window.removeEventListener("qiming:native-back", handleNativeBack);
});
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
  padding: 36px 32px;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 25%);
}

/* 关闭按钮 */
.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
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

/* 登录方式切换 */
.login-tabs {
  display: flex;
  gap: 8px;
  padding: 4px;
  margin-bottom: 24px;
  background: #f5f5f7;
  border-radius: 12px;
}

.tab-btn {
  flex: 1;
  height: 40px;
  font-size: 14px;
  font-weight: 500;
  color: #8e8e93;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 10px;
  transition: all 0.2s;

  &.active {
    color: #1a1a2e;
    background: #fff;
    box-shadow: 0 2px 8px rgb(0 0 0 / 8%);
  }

  &:hover:not(.active) {
    color: #5dade2;
  }
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
  font-size: 15px;
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
  width: 32px;
  height: 32px;
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

/* 验证码行 */
.sms-row {
  display: flex;
  gap: 10px;
  width: 100%;
}

.sms-input {
  flex: 1 1 0;
  min-width: 0;
}

.sms-btn {
  flex-shrink: 0;
  width: 100px;
  height: 48px;
  font-size: 13px;
  font-weight: 500;
  color: #5dade2;
  cursor: pointer;
  background: #f5f7fa;
  border: 1.5px solid #e8eaed;
  border-radius: 12px;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: #fff;
    border-color: #5dade2;
  }

  &:disabled {
    color: #bfc3c7;
    cursor: not-allowed;
  }
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

/* 第三方登录 */
.third-party {
  margin-top: 24px;
}

.divider {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  font-size: 13px;
  color: #bfc3c7;

  &::before,
  &::after {
    flex: 1;
    height: 1px;
    content: "";
    background: #e8eaed;
  }

  span {
    padding: 0 16px;
  }
}

.social-btns {
  display: flex;
  gap: 20px;
  justify-content: center;
}

.social-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  cursor: pointer;
  background: #f5f7fa;
  border: none;
  border-radius: 50%;
  transition: all 0.2s;

  &:hover {
    transform: translateY(-2px);
  }

  &.wechat {
    color: #07c160;

    &:hover {
      background: rgb(7 193 96 / 10%);
    }
  }

  &.qq {
    color: #12b7f5;

    &:hover {
      background: rgb(18 183 245 / 10%);
    }
  }
}

/* 底部链接 */
.footer-link {
  margin-top: 20px;
  font-size: 14px;
  color: #8e8e93;
  text-align: center;

  a {
    font-weight: 500;
    color: #5dade2;
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
    justify-content: center;
    padding-top: 0;
    padding: 16px;
  }

  .login-card {
    width: 100%;
    max-width: 320px;
    padding: 24px 20px;
    border-radius: 16px;
  }

  .card-title {
    margin-bottom: 16px;
    font-size: 20px;
  }

  .login-tabs {
    margin-bottom: 16px;
    border-radius: 10px;
  }

  .tab-btn {
    padding: 8px;
    font-size: 13px;
  }

  .input-group {
    margin-bottom: 12px;
  }

  .input-wrapper {
    height: 44px;

    input {
      font-size: 14px;
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

  .third-party {
    margin-top: 16px;

    .divider {
      margin-bottom: 12px;
      font-size: 12px;
    }

    .social-btns {
      gap: 12px;
    }

    .social-btn {
      width: 40px;
      height: 40px;
    }
  }

  .footer-link {
    margin-top: 14px;
    font-size: 13px;
  }

  .close-btn {
    top: 12px;
    right: 12px;
    width: 28px;
    height: 28px;
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

html.qiming-native-webview .login-overlay {
  position: absolute !important;
  inset: auto !important;
  top: var(--qiming-login-overlay-top, 0) !important;
  right: auto !important;
  bottom: auto !important;
  left: 0 !important;
  z-index: 10050 !important;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 100vw !important;
  height: var(
    --qiming-login-overlay-height,
    var(--qiming-native-vh, 100dvh)
  ) !important;
  min-height: var(
    --qiming-login-overlay-height,
    var(--qiming-native-vh, 100dvh)
  ) !important;
  max-height: var(
    --qiming-login-overlay-height,
    var(--qiming-native-vh, 100dvh)
  ) !important;
  padding: calc(var(--qiming-native-status-top, 0px) + 14px) 16px
    calc(env(safe-area-inset-bottom, 0px) + 16px);
  overflow: auto;
  overscroll-behavior: contain;
  transform: none !important;
}

html.qiming-native-webview .login-card {
  width: min(100%, 360px);
  max-width: calc(100vw - 32px);
  max-height: calc(
    var(--qiming-native-vh, 100dvh) - var(
        --qiming-native-status-top,
        0px
      ) - env(safe-area-inset-bottom, 0px) -
      34px
  );
  padding: 24px 20px;
  overflow-y: auto;
  border-radius: 18px;
  transform: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

html.qiming-native-webview .third-party {
  margin-top: 18px;
}

html.qiming-native-webview .footer-link {
  margin-top: 16px;
}

html.qiming-native-webview.dark .login-overlay {
  background: rgb(0 0 0 / 62%);
}

html.qiming-native-webview.dark .login-card {
  color: var(--qiming-native-text-primary, #f8fafc);
  background: var(--qiming-native-surface-bg, #111827);
  border: 1px solid var(--qiming-native-border-color, rgb(148 163 184 / 20%));
}

html.qiming-native-webview.dark .card-title,
html.qiming-native-webview.dark .tab-btn.active {
  color: var(--qiming-native-text-primary, #f8fafc);
}

html.qiming-native-webview.dark .login-tabs,
html.qiming-native-webview.dark .input-wrapper,
html.qiming-native-webview.dark .sms-btn,
html.qiming-native-webview.dark .social-btn,
html.qiming-native-webview.dark .close-btn {
  color: var(--qiming-native-text-regular, #d4d4d8);
  background: var(--qiming-native-surface-soft-bg, #0b1220);
  border-color: var(--qiming-native-border-color, rgb(148 163 184 / 20%));
}

html.qiming-native-webview.dark .input-wrapper input {
  color: var(--qiming-native-text-primary, #f8fafc);
}

html.qiming-native-webview.dark .input-wrapper.focus,
html.qiming-native-webview.dark .tab-btn.active {
  background: rgb(15 23 42 / 96%);
}

html.qiming-native-webview.dark .input-wrapper.focus .floating-label,
html.qiming-native-webview.dark .input-wrapper.has-value .floating-label {
  background: var(--qiming-native-surface-bg, #111827);
}
</style>
