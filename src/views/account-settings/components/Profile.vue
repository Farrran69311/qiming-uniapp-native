<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { message } from "@/utils/message";
import { type UserInfo, getMine, uploadFile } from "@/api/user";
import { updateFrontendUserInfo } from "@/api/frontend/user";
import type { FormInstance, FormRules } from "element-plus";
import ReCropperPreview from "@/components/ReCropperPreview";
import { storageLocal } from "@pureadmin/utils";
import { useMediaQuery } from "@vueuse/core";
import { useUserStoreHook } from "@/store/modules/user";
import { userKey } from "@/utils/auth";
import { formatAvatar } from "@/utils/avatar";
import uploadLine from "~icons/ri/upload-line";

defineOptions({
  name: "Profile"
});

const imgSrc = ref("");
const cropperBlob = ref();
const cropRef = ref();
const uploadRef = ref();
const isShow = ref(false);
const userInfoFormRef = ref<FormInstance>();
const profileLoading = ref(false);
const uploadLoading = ref(false);
const saving = ref(false);
const loadError = ref("");
const profileLoaded = ref(false);
const originalDescription = ref("");
const isMobile = useMediaQuery("(max-width: 768px)");

const userInfos = reactive({
  avatar: "",
  username: "",
  nickname: "",
  email: "",
  phone: "",
  description: "",
  sex: 0
});

const rules = reactive<FormRules<UserInfo>>({
  nickname: [{ required: true, message: "昵称必填", trigger: "blur" }]
});

const onChange = selectedFile => {
  if (!selectedFile.raw) return;
  if (selectedFile.raw.size > 2 * 1024 * 1024) {
    message("头像大小不能超过 2MB", { type: "warning" });
    uploadRef.value?.clearFiles();
    return;
  }
  cropperBlob.value = undefined;
  const reader = new FileReader();
  reader.onload = e => {
    imgSrc.value = e.target.result as string;
    isShow.value = true;
  };
  reader.readAsDataURL(selectedFile.raw);
};

const handleClose = () => {
  cropRef.value?.hidePopover?.();
  uploadRef.value?.clearFiles?.();
  cropperBlob.value = undefined;
  isShow.value = false;
};

const onCropper = ({ blob }) => (cropperBlob.value = blob);

const handleSubmitImage = async () => {
  if (!cropperBlob.value) {
    message("请先完成头像裁剪", { type: "warning" });
    return;
  }

  const formData = new FormData();
  formData.append("file", cropperBlob.value, `avatar_${Date.now()}.png`);
  uploadLoading.value = true;
  try {
    const response = await uploadFile(formData);
    if (response.code !== 200 || !response.data?.url) {
      throw new Error(response.msg || "头像上传失败");
    }
    userInfos.avatar = response.data.url;
    message("头像已上传，保存资料后生效", { type: "success" });
    handleClose();
  } catch (error: any) {
    message(error?.response?.data?.msg || error?.message || "头像上传失败", {
      type: "error"
    });
  } finally {
    uploadLoading.value = false;
  }
};

const syncStoredProfile = () => {
  const userStore = useUserStoreHook();
  userStore.SET_NICKNAME(userInfos.nickname);
  userStore.SET_AVATAR(userInfos.avatar);

  const cachedUser =
    (storageLocal().getItem(userKey) as Record<string, any> | null) || {};
  const updatedUser = {
    ...cachedUser,
    username: userInfos.username || cachedUser.username,
    nickname: userInfos.nickname,
    avatar: userInfos.avatar,
    sex: userInfos.sex,
    info: userInfos.description
  };
  storageLocal().setItem(userKey, updatedUser);
  localStorage.setItem("userSex", String(userInfos.sex));
  localStorage.setItem("userInfo", userInfos.description);
  window.dispatchEvent(
    new CustomEvent("userInfoUpdated", {
      detail: updatedUser
    })
  );
};

const loadProfile = async () => {
  profileLoading.value = true;
  loadError.value = "";
  profileLoaded.value = false;
  try {
    const response = await getMine();
    Object.assign(userInfos, response.data);
    originalDescription.value = response.data.description;
    profileLoaded.value = true;
  } catch (error: any) {
    loadError.value =
      error?.response?.data?.msg || error?.message || "请检查网络后重试";
  } finally {
    profileLoading.value = false;
  }
};

const onSubmit = async (formEl?: FormInstance) => {
  if (!formEl) return;
  if (!profileLoaded.value) {
    message("请先重新加载个人资料", { type: "warning" });
    return;
  }
  const valid = await formEl.validate().catch(() => false);
  if (!valid) return;
  const nickname = userInfos.nickname.trim();
  if (!nickname) {
    message("昵称不能为空", { type: "warning" });
    return;
  }
  const description = userInfos.description.trim();
  if (originalDescription.value.trim() && !description) {
    message("当前服务暂不支持清空简介，请保留或修改简介内容", {
      type: "warning"
    });
    return;
  }

  saving.value = true;
  try {
    const response = await updateFrontendUserInfo({
      nickname,
      avatar: userInfos.avatar,
      info: description,
      sex: userInfos.sex
    });
    if (response.code !== 200) {
      throw new Error(response.msg || "资料保存失败");
    }
    const persisted = await getMine();
    Object.assign(userInfos, persisted.data);
    originalDescription.value = persisted.data.description;
    syncStoredProfile();
    message("资料修改成功", { type: "success" });
  } catch (error: any) {
    message(error?.response?.data?.msg || error?.message || "资料保存失败", {
      type: "error"
    });
  } finally {
    saving.value = false;
  }
};

onMounted(loadProfile);
</script>

<template>
  <div class="min-w-[180px] w-full max-w-full min-[769px]:max-w-[70%]">
    <h3 class="my-8">个人信息</h3>
    <el-alert
      v-if="loadError"
      class="mb-4"
      type="warning"
      title="个人资料暂时无法加载"
      :description="loadError"
      :closable="false"
      show-icon
    />
    <el-button v-if="loadError" class="mb-4" @click="loadProfile">
      重新加载
    </el-button>
    <el-form
      ref="userInfoFormRef"
      v-loading="profileLoading"
      label-position="top"
      :rules="rules"
      :model="userInfos"
    >
      <el-form-item label="头像">
        <el-avatar :size="80" :src="formatAvatar(userInfos.avatar)" />
        <el-upload
          ref="uploadRef"
          accept="image/*"
          action="#"
          :limit="1"
          :auto-upload="false"
          :show-file-list="false"
          :on-change="onChange"
          :disabled="!profileLoaded"
        >
          <el-button plain class="ml-4">
            <IconifyIconOffline :icon="uploadLine" />
            <span class="ml-2">更新头像</span>
          </el-button>
        </el-upload>
      </el-form-item>
      <el-form-item label="昵称" prop="nickname">
        <el-input v-model="userInfos.nickname" placeholder="请输入昵称" />
      </el-form-item>
      <el-form-item label="邮箱" prop="email">
        <el-input
          v-model="userInfos.email"
          disabled
          placeholder="当前账户暂未提供邮箱设置"
        />
      </el-form-item>
      <el-form-item label="联系电话">
        <el-input v-model="userInfos.phone" disabled placeholder="登录手机号" />
      </el-form-item>
      <el-form-item label="简介">
        <el-input
          v-model="userInfos.description"
          placeholder="请输入简介"
          type="textarea"
          :autosize="{ minRows: 6, maxRows: 8 }"
          maxlength="56"
          show-word-limit
        />
      </el-form-item>
      <el-button
        type="primary"
        :loading="saving"
        :disabled="!profileLoaded || profileLoading"
        @click="onSubmit(userInfoFormRef)"
      >
        更新信息
      </el-button>
    </el-form>
    <el-dialog
      v-model="isShow"
      width="40%"
      title="编辑头像"
      destroy-on-close
      :closeOnClickModal="false"
      :before-close="handleClose"
      :fullscreen="isMobile"
    >
      <ReCropperPreview ref="cropRef" :imgSrc="imgSrc" @cropper="onCropper" />
      <template #footer>
        <div class="dialog-footer">
          <el-button bg text @click="handleClose">取消</el-button>
          <el-button
            bg
            text
            type="primary"
            :loading="uploadLoading"
            @click="handleSubmitImage"
          >
            确定
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>
