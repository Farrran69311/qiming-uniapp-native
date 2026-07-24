<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import type { FormInstance, FormRules } from "element-plus";
import Motion from "../utils/motion";
import { userRegister } from "@/api/user";
import { message } from "@/utils/message";
import { useUserStoreHook } from "@/store/modules/user";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import {
  completeUserCenterAuthentication,
  requireAuthData,
  resolveAuthErrorMessage
} from "../utils/userCenterSession";
import Lock from "~icons/ri/lock-fill";
import Eye from "~icons/ri/eye-line";
import EyeOff from "~icons/ri/eye-off-line";
import Iphone from "~icons/ep/iphone";

const router = useRouter();
const loading = ref(false);
const isMobileFocused = ref(false);
const isPasswordFocused = ref(false);
const isRepeatPasswordFocused = ref(false);
const passwordVisible = ref(false);
const repeatPasswordVisible = ref(false);
const ruleFormRef = ref<FormInstance>();
const ruleForm = reactive({
  mobile: "",
  password: "",
  repeatPassword: ""
});

const registerRules: FormRules = {
  mobile: [
    { required: true, message: "请输入手机号", trigger: "blur" },
    {
      pattern: /^1[3-9]\d{9}$/,
      message: "请输入正确的手机号",
      trigger: "blur"
    }
  ],
  password: [
    { required: true, message: "请设置密码", trigger: "blur" },
    { min: 6, max: 64, message: "密码长度应为 6 至 64 位", trigger: "blur" }
  ],
  repeatPassword: [
    {
      validator: (_rule, value, callback) => {
        if (!value) {
          callback(new Error("请再次输入密码"));
        } else if (value !== ruleForm.password) {
          callback(new Error("两次输入的密码不一致"));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ]
};

const onRegister = async (formEl: FormInstance | undefined) => {
  if (!formEl || loading.value) return;

  const valid = await formEl.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    const mobile = ruleForm.mobile.trim();
    const response = await userRegister({
      mobile,
      password: ruleForm.password
    });
    const authData = requireAuthData(response, "注册失败，请稍后重试");
    await completeUserCenterAuthentication(router, mobile, authData);
    message("注册成功，已为您登录", { type: "success" });
  } catch (error) {
    message(resolveAuthErrorMessage(error, "注册失败，请稍后重试"), {
      type: "error"
    });
  } finally {
    loading.value = false;
  }
};

const onBack = () => {
  useUserStoreHook().SET_CURRENTPAGE(0);
};
</script>

<template>
  <el-form
    ref="ruleFormRef"
    :model="ruleForm"
    :rules="registerRules"
    size="large"
    class="registration-form"
    @submit.prevent
  >
    <Motion>
      <el-form-item
        prop="mobile"
        class="floating-label-item"
        :class="{
          'has-value': !!ruleForm.mobile,
          'is-focused': isMobileFocused
        }"
      >
        <el-input
          v-model.trim="ruleForm.mobile"
          clearable
          inputmode="tel"
          autocomplete="tel"
          maxlength="11"
          placeholder=""
          :prefix-icon="useRenderIcon(Iphone)"
          @focus="isMobileFocused = true"
          @blur="isMobileFocused = false"
        />
        <label class="floating-label">手机号</label>
      </el-form-item>
    </Motion>

    <Motion :delay="100">
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
          autocomplete="new-password"
          placeholder=""
          :prefix-icon="useRenderIcon(Lock)"
          @focus="isPasswordFocused = true"
          @blur="isPasswordFocused = false"
        >
          <template #suffix>
            <IconifyIconOffline
              :icon="passwordVisible ? Eye : EyeOff"
              class="cursor-pointer"
              :aria-label="passwordVisible ? '隐藏密码' : '显示密码'"
              @click="passwordVisible = !passwordVisible"
            />
          </template>
        </el-input>
        <label class="floating-label">密码</label>
      </el-form-item>
    </Motion>

    <Motion :delay="150">
      <el-form-item
        prop="repeatPassword"
        class="floating-label-item"
        :class="{
          'has-value': !!ruleForm.repeatPassword,
          'is-focused': isRepeatPasswordFocused
        }"
      >
        <el-input
          v-model="ruleForm.repeatPassword"
          clearable
          :type="repeatPasswordVisible ? 'text' : 'password'"
          autocomplete="new-password"
          placeholder=""
          :prefix-icon="useRenderIcon(Lock)"
          @focus="isRepeatPasswordFocused = true"
          @blur="isRepeatPasswordFocused = false"
          @keyup.enter="onRegister(ruleFormRef)"
        >
          <template #suffix>
            <IconifyIconOffline
              :icon="repeatPasswordVisible ? Eye : EyeOff"
              class="cursor-pointer"
              :aria-label="repeatPasswordVisible ? '隐藏密码' : '显示密码'"
              @click="repeatPasswordVisible = !repeatPasswordVisible"
            />
          </template>
        </el-input>
        <label class="floating-label">确认密码</label>
      </el-form-item>
    </Motion>

    <Motion :delay="200">
      <el-form-item>
        <el-button
          class="w-full register-button"
          size="default"
          type="primary"
          :loading="loading"
          :disabled="loading"
          @click="onRegister(ruleFormRef)"
        >
          注册并登录
        </el-button>
      </el-form-item>
    </Motion>

    <Motion :delay="250">
      <el-form-item>
        <el-button
          class="w-full"
          size="default"
          :disabled="loading"
          @click="onBack"
        >
          返回登录
        </el-button>
      </el-form-item>
    </Motion>
  </el-form>
</template>

<style lang="scss" scoped>
.registration-form {
  width: 100%;
  min-width: 0;
}

.floating-label-item {
  position: relative;

  :deep(.el-input__wrapper) {
    height: 48px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgb(0 0 0 / 4%);
  }
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

.floating-label-item.is-focused .floating-label,
.floating-label-item.has-value .floating-label {
  top: 0;
  left: 12px;
  padding: 0 4px;
  font-size: 12px;
  color: #667eea;
  background: #fff;
}

.register-button {
  height: 48px;
  font-size: 16px;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: 0;
  border-radius: 12px;
}
</style>
