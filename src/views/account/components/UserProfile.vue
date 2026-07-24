<template>
  <div class="user-profile" :class="currentTheme">
    <!-- 顶部资料概览区域 -->
    <div class="profile-banner" :style="bannerStyle">
      <div class="banner-overlay">
        <div class="banner-text">
          <div class="banner-title">个人中心</div>
          <div class="banner-sub">学习与账户概览</div>
        </div>
      </div>
    </div>
    <div class="profile-header">
      <h3>个人资料</h3>
      <div class="action-buttons">
        <el-button
          class="btn-elevated info"
          size="small"
          @click="openEditDialog"
        >
          <span>修改资料</span>
        </el-button>
        <el-button
          class="btn-elevated warn"
          size="small"
          @click="openPasswordDialog"
        >
          <span>修改密码</span>
        </el-button>
      </div>
    </div>

    <div class="profile-content">
      <div class="profile-avatar">
        <el-avatar :size="100" :src="formatAvatar(userInfo?.avatar)" />
        <div class="user-name">
          {{ userInfo?.nickname || userInfo?.username }}
        </div>
        <div class="user-role">{{ userRole }}</div>
      </div>

      <div class="profile-info">
        <div class="info-group">
          <div class="group-title">基本信息</div>
          <div class="info-item">
            <div class="label">用户名</div>
            <div class="value">
              {{ userInfo?.username || userInfo?.mobile || "-" }}
            </div>
          </div>
          <div class="info-item">
            <div class="label">昵称</div>
            <div class="value">{{ userInfo?.nickname || "未设置" }}</div>
          </div>
          <div class="info-item">
            <div class="label">邮箱</div>
            <div class="value email-value">
              暂未提供
              <el-tag size="small" type="info" effect="plain">
                服务未接入
              </el-tag>
            </div>
          </div>
          <div class="info-item">
            <div class="label">性别</div>
            <div class="value">{{ getSexLabel }}</div>
          </div>
          <div class="info-item signature">
            <div class="label">个性签名</div>
            <div class="value">
              {{ displaySignature }}
            </div>
          </div>
        </div>
        <div class="info-group timeline">
          <div class="group-title">账户时间</div>
          <div class="info-item">
            <div class="label">注册时间</div>
            <div class="value time-value">暂未提供</div>
          </div>
          <div class="info-item">
            <div class="label">最后登录</div>
            <div class="value time-value">暂未提供</div>
          </div>
        </div>
        <div v-show="showStats" class="info-group stats">
          <div class="group-title">学习统计</div>
          <div
            :class="[
              'stats-content',
              {
                'is-loading-effect':
                  isFetchingStats && studyStats.totalHours === null
              }
            ]"
          >
            <div class="info-item">
              <div class="label">入驻日期</div>
              <div class="value">
                <span>{{ studyStats.joinDate }}</span>
              </div>
            </div>
            <div class="info-item">
              <div class="label">作业均分</div>
              <div class="value">
                <span class="score-value">{{ studyStats.avgScore }}</span>
              </div>
            </div>
            <div class="info-item">
              <div class="label">累计学时</div>
              <div class="value">
                <template v-if="studyStats.totalHours !== null">
                  <span class="number-solid">{{ studyStats.totalHours }}</span>
                  小时
                </template>
                <span v-else class="loading-placeholder">计算中...</span>
              </div>
            </div>
            <div class="info-item">
              <div class="label">总体进度</div>
              <div class="value progress-value">
                <template v-if="studyStats.totalProgress !== null">
                  <el-progress
                    :percentage="sanitizeProgress(studyStats.totalProgress)"
                    :format="val => val + '%'"
                    :stroke-width="10"
                    striped
                    striped-flow
                  />
                </template>
                <div
                  v-else
                  class="loading-placeholder"
                  style="
                    width: 100%;
                    height: 10px;
                    background: #eee;
                    border-radius: 5px;
                  "
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 最近学习与学习动态 -->
    <div class="profile-extra-sections">
      <div class="extra-section recent-courses">
        <div class="section-header">
          <div class="section-title">
            <span>最近学习的课程</span>
          </div>
          <el-button link type="primary" @click="emit('to-course')"
            >查看全部</el-button
          >
        </div>
        <div v-if="recentCourses.length > 0" class="course-grid">
          <div
            v-for="course in recentCourses"
            :key="course.courseId"
            class="course-mini-card"
            role="button"
            tabindex="0"
            @click="
              router.push({
                path: `/course/${course.courseId}`
              })
            "
            @keydown.enter="
              router.push({
                path: `/course/${course.courseId}`
              })
            "
            @keydown.space.prevent="
              router.push({
                path: `/course/${course.courseId}`
              })
            "
          >
            <div class="course-thumb">
              <img
                v-if="course.thumbUrl"
                :src="course.thumbUrl"
                :alt="course.courseName"
                loading="lazy"
              />
              <div v-else class="thumb-placeholder">
                {{ course.courseName.charAt(0) }}
              </div>
              <div
                class="course-type-tag"
                :class="course.isRequired ? 'required' : 'elective'"
              >
                {{ course.isRequired ? "必修" : "选修" }}
              </div>
            </div>
            <div class="course-mini-info">
              <div class="course-name">{{ course.courseName }}</div>
              <div class="course-progress">
                <el-progress
                  :percentage="
                    normalizeProgress(course.finishedHours / course.totalHours)
                  "
                  :show-text="false"
                  :stroke-width="4"
                />
                <span class="progress-text"
                  >已学
                  {{
                    normalizeProgress(course.finishedHours / course.totalHours)
                  }}%</span
                >
              </div>
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无学习记录" :image-size="60" />
      </div>

      <div class="extra-section learning-dynamics">
        <div class="section-header">
          <div class="section-title">
            <span>学习动态</span>
          </div>
        </div>
        <div class="dynamics-list">
          <div
            v-for="activity in learningActivities"
            :key="activity.id"
            class="activity-item"
          >
            <div class="activity-dot" :class="`dot-${activity.type}`">
              <AccountSvgIcon
                :name="activity.icon || 'activity'"
                class="activity-icon-svg"
              />
            </div>
            <div class="activity-body">
              <div class="activity-content">{{ activity.content }}</div>
              <div class="activity-time">{{ activity.timestamp }}</div>
            </div>
          </div>
          <el-empty
            v-if="learningActivities.length === 0"
            description="学习动态服务暂未接入"
            :image-size="60"
          />
        </div>
      </div>
    </div>

    <!-- 编辑资料弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      title="修改个人资料"
      width="min(500px, calc(100vw - 24px))"
      destroy-on-close
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="头像">
          <el-upload
            class="avatar-uploader"
            action="#"
            :auto-upload="false"
            :show-file-list="false"
            :on-change="handleAvatarChange"
          >
            <div class="avatar-container">
              <el-avatar v-if="avatarUrl" :src="avatarUrl" :size="100" />
              <div v-else class="avatar-uploader-icon">
                <AccountSvgIcon name="plus" />
              </div>
              <div class="edit-icon">
                <AccountSvgIcon name="edit" />
              </div>
            </div>
          </el-upload>
        </el-form-item>
        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="form.nickname" placeholder="请输入昵称" />
        </el-form-item>
        <el-form-item label="性别">
          <el-radio-group v-model="form.sex">
            <el-radio :value="1">男</el-radio>
            <el-radio :value="2">女</el-radio>
            <el-radio :value="0">保密</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="个性签名" prop="info">
          <el-input
            v-model="form.info"
            type="textarea"
            :rows="4"
            placeholder="请输入个性签名"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="submitForm">
          保存
        </el-button>
      </template>
    </el-dialog>

    <!-- 图片裁剪弹窗 -->
    <el-dialog
      v-model="cropperDialogVisible"
      title="裁剪头像"
      width="min(800px, calc(100vw - 24px))"
      append-to-body
      destroy-on-close
    >
      <div v-if="cropperDialogVisible" class="cropper-container">
        <ReCropper
          ref="cropperRef"
          :src="croppingImage"
          :realTimePreview="false"
          crossorigin="anonymous"
          :options="{
            aspectRatio: 1,
            viewMode: 1,
            guides: true,
            checkCrossOrigin: true
          }"
          height="400px"
          @cropper="handleCropperResult"
          @error="handleCropperError"
        />
      </div>
      <template #footer>
        <el-button @click="cropperDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="handleConfirmCrop">
          确认裁剪
        </el-button>
      </template>
    </el-dialog>

    <!-- 修改密码弹窗 -->
    <el-dialog
      v-model="passwordDialogVisible"
      title="修改密码"
      width="min(500px, calc(100vw - 24px))"
      destroy-on-close
      :close-on-click-modal="false"
    >
      <el-form
        ref="passwordFormRef"
        :model="passwordForm"
        :rules="passwordRules"
        label-width="100px"
      >
        <el-form-item label="原密码" prop="oldPassword">
          <el-input
            v-model="passwordForm.oldPassword"
            type="password"
            placeholder="请输入原密码"
            show-password
          />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input
            v-model="passwordForm.newPassword"
            type="password"
            placeholder="请输入新密码"
            show-password
          />
        </el-form-item>
        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input
            v-model="passwordForm.confirmPassword"
            type="password"
            placeholder="请再次输入新密码"
            show-password
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="passwordLoading"
          @click="submitPasswordForm"
        >
          确认修改
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from "vue";
import { useRouter } from "vue-router";
import type { FormInstance } from "element-plus";
import { ElMessage } from "element-plus";
import ReCropper from "@/components/ReCropper";
import AccountSvgIcon from "./AccountSvgIcon.vue";
import defaultAvatar from "@/assets/user.jpg";
import defaultBanner from "@/assets/publicbackgroundpreset/9cc666916ece355333bbe45723e2921d.jpeg";
import { storageLocal } from "@pureadmin/utils";
import { formatAvatar } from "@/utils/avatar";
import { userKey, removeToken, getToken, setToken } from "@/utils/auth";
import type { DataInfo } from "@/utils/auth";
import {
  updateFrontendUserInfo,
  updateFrontendUserPassword,
  type UpdateUserInfoParams
} from "@/api/frontend/user";
import { uploadFile, getUserDetail, getStudentStats } from "@/api/user";
import { getFrontendCourseList } from "@/api/frontend/course";

const props = defineProps<{
  currentTheme?: string;
}>();

const emit = defineEmits(["to-course"]);

const router = useRouter();
const dialogVisible = ref(false);
const loading = ref(false);
const userInfo = ref<DataInfo<number> | any>(storageLocal().getItem(userKey));

// 弹窗与加载状态
const cropperDialogVisible = ref(false);
const croppingImage = ref("");
const cropperRef = ref();

// 修改密码相关
const passwordDialogVisible = ref(false);
const passwordLoading = ref(false);
const passwordFormRef = ref<FormInstance>();
const passwordForm = reactive({
  oldPassword: "",
  newPassword: "",
  confirmPassword: ""
});

const formRef = ref<FormInstance>();
const avatarUrl = ref("");
const profileOriginalInfo = ref("");

// 表单数据
const form = reactive({
  nickname: "",
  sex: 0,
  avatar: "",
  info: ""
});

// 签名兜底：优先展示用户详情里的 info，缺失时尝试从其他接口补齐
const signatureFallback = ref("");
const displaySignature = computed(
  () => userInfo.value?.info || signatureFallback.value || "暂未填写"
);

// 学习统计数据：入驻/均分取自 /user/study，学时/进度取自 /user/status，失败时回落到课程列表计算
// 学习统计持久化 Key
const STATS_STORAGE_KEY = "userStudyStatsCache";
const getStatsStorageKey = () => {
  const userId = userInfo.value?.userId || userInfo.value?.id;
  return userId ? `${STATS_STORAGE_KEY}:${userId}` : "";
};

// 必杀技 1：从缓存初始化，实现“秒开”不闪烁
const getInitialStats = () => {
  const statsStorageKey = getStatsStorageKey();
  const cached = statsStorageKey
    ? (storageLocal().getItem(statsStorageKey) as any)
    : null;
  // 核心改进：显式标记 null，区分“初始状态”和“数值为0”
  return {
    joinDate: cached?.joinDate || "--",
    avgScore: cached?.avgScore || "--",
    totalHours: cached?.totalHours !== undefined ? cached.totalHours : null,
    totalProgress:
      cached?.totalProgress !== undefined ? cached.totalProgress : null
  };
};

const studyStats = reactive(getInitialStats());
const persistStudyStats = () => {
  const statsStorageKey = getStatsStorageKey();
  if (statsStorageKey) {
    storageLocal().setItem(statsStorageKey, { ...studyStats });
  }
};

// 最近学习课程
const recentCourses = ref([]);

const learningActivities = ref<
  Array<{
    id: number | string;
    content: string;
    timestamp: string;
    type: string;
    icon?: string;
  }>
>([]);

const sanitizeProgress = (val: any) => {
  const num = Number(val);
  return isNaN(num) || num < 0 ? 0 : Math.min(num, 100);
};

const normalizeProgress = (value?: number) => {
  const num = Number(value ?? 0);
  if (Number.isNaN(num)) return 0;
  if (num <= 1) return Math.round(num * 100);
  return Math.round(Math.min(num, 100));
};

// 已废弃 fillStatsFromCourses，统一由 fetchStudyStats 管理数据源

const isFetchingStats = ref(false);
const fetchStudyStats = async () => {
  // 严格锁：正在加载或角色不对直接退出
  if (userRole.value !== "学生" || isFetchingStats.value) return;

  isFetchingStats.value = true;

  try {
    // 【核心修复】直接从课程列表计算学时和进度，这是唯一可靠的数据源
    const courseRes = await getFrontendCourseList({
      pageNum: 1,
      pageSize: 100
    }).catch(() => null);

    if (courseRes?.code === 200 && courseRes.data?.list) {
      const list = courseRes.data.list;

      if (list.length > 0) {
        // 计算累计学时
        const totalHours = list.reduce(
          (acc, curr) => acc + (curr.finishedHours || 0),
          0
        );

        // 计算总体进度（百分比）
        const totalProg = list.reduce((acc, curr) => {
          const finished = curr.finishedHours || 0;
          const total = curr.totalHours || 0;
          return acc + (total > 0 ? finished / total : 0);
        }, 0);
        const totalProgress = Math.round((totalProg / list.length) * 100);

        // 直接更新，因为这是从可靠数据源计算出来的
        studyStats.totalHours = totalHours;
        studyStats.totalProgress = totalProgress;

        // 设置最近学习的课程（取前3个）
        recentCourses.value = list.slice(0, 3);

        // 持久化缓存
        persistStudyStats();
      }
    }

    // 尝试获取入驻日期和均分（这些接口可能没有 mock）
    const statsRes = await getStudentStats().catch(() => null);
    if (statsRes?.code === 200 && statsRes.data) {
      const stats = statsRes.data;
      if (
        stats.avgScore &&
        stats.avgScore !== "暂无" &&
        stats.avgScore !== "--"
      ) {
        studyStats.avgScore = stats.avgScore;
      }
      if (stats.joinDate && stats.joinDate !== "--") {
        studyStats.joinDate = stats.joinDate;
      }
      const sig = stats.signature || stats.info || "";
      if (sig && !signatureFallback.value) {
        signatureFallback.value = sig;
      }
      // 更新缓存
      persistStudyStats();
    }
  } catch (error) {
    console.error("获取学习统计失败:", error);
  } finally {
    isFetchingStats.value = false;
  }
};

// 表单验证规则
const rules = {
  nickname: [{ max: 20, message: "昵称长度不能超过20个字符", trigger: "blur" }],
  info: [
    { max: 200, message: "个性签名长度不能超过200个字符", trigger: "blur" }
  ]
};

// 密码表单验证规则
const validateConfirmPassword = (rule, value, callback) => {
  if (value === "") {
    callback(new Error("请再次输入新密码"));
  } else if (value !== passwordForm.newPassword) {
    callback(new Error("两次输入的密码不一致"));
  } else {
    callback();
  }
};

const passwordRules = {
  oldPassword: [
    { required: true, message: "请输入原密码", trigger: "blur" },
    { min: 6, message: "密码长度不能少于6个字符", trigger: "blur" }
  ],
  newPassword: [
    { required: true, message: "请输入新密码", trigger: "blur" },
    { min: 6, message: "密码长度不能少于6个字符", trigger: "blur" }
  ],
  confirmPassword: [
    { required: true, message: "请再次输入新密码", trigger: "blur" },
    { validator: validateConfirmPassword, trigger: "blur" }
  ]
};

// 计算属性：用户角色展示
const userRole = computed(() => {
  const roleType = userInfo.value?.roleType;
  if (roleType === undefined || roleType === null) return "普通用户";
  const rt = Number(roleType);
  switch (rt) {
    case 1:
      return "学生";
    case 2:
      return "教师";
    case 3:
      return "管理员";
    default:
      return "普通用户";
  }
});

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

const showStats = computed(() => userRole.value === "学生");

// 计算属性：性别显示
const getSexLabel = computed(() => {
  const sex = userInfo.value?.sex || 0;
  return sex === 1 ? "男" : sex === 2 ? "女" : "保密";
});

// 获取用户详情
const fetchUserDetail = async () => {
  try {
    const res = await getUserDetail();
    // 兼容多种 Mock 响应格式
    const isSuccess = res && (res.code === 200 || (res as any).success);
    const detailData =
      res?.data?.userInfo || (res as any)?.userInfo || res?.data;

    if (isSuccess && detailData) {
      const newUserInfo = detailData;

      // 验证关键字段，防止被后端空值覆盖导致 UI 闪烁
      if (newUserInfo.roleType === undefined || newUserInfo.roleType === null) {
        newUserInfo.roleType = userInfo.value?.roleType;
      }

      // 增量更新用户信息，必须确保认证元数据（refreshToken, expires, accessToken）绝对不丢失
      const tokenData = getToken();
      const localData = (storageLocal().getItem(userKey) as any) || {};

      // 深度合并新老数据，确保不丢失已有的认证字段
      const mergedUserInfo: any = {
        ...localData,
        ...newUserInfo
      };

      // 强行恢复可能被覆盖的关键认证字段
      if (tokenData) {
        mergedUserInfo.accessToken =
          (tokenData as any).accessToken || localData.accessToken;
        mergedUserInfo.refreshToken =
          (tokenData as any).refreshToken || localData.refreshToken;
        mergedUserInfo.expires =
          (tokenData as any).expires || localData.expires;
      }

      // 认证元数据沿用登录态，角色缺失时按后端 roleType 收敛。
      mergedUserInfo.permissions = mergedUserInfo.permissions || ["*:*:*"];
      mergedUserInfo.roles =
        mergedUserInfo.roles?.length > 0
          ? mergedUserInfo.roles
          : rolesForRoleType(mergedUserInfo.roleType);

      // 更新响应式数据
      userInfo.value = mergedUserInfo;
      profileOriginalInfo.value = newUserInfo.info || "";
      localStorage.setItem("userSex", String(newUserInfo.sex ?? 0));
      localStorage.setItem("userInfo", newUserInfo.info || "");

      // 只要有 accessToken 就走 setToken 链路进行同步
      if (mergedUserInfo.accessToken) {
        setToken({
          ...mergedUserInfo,
          // 统一 expires 格式为 Date 供 setToken 内部使用
          expires: mergedUserInfo.expires
            ? new Date(mergedUserInfo.expires)
            : new Date(Date.now() + 86400000)
        } as any);
      } else {
        storageLocal().setItem(userKey, mergedUserInfo);
      }

      // 通知全局 UI 更新
      window.dispatchEvent(
        new CustomEvent("userInfoUpdated", { detail: mergedUserInfo })
      );
      return true;
    } else {
      console.warn("获取用户详情失败，响应无效:", res);
      return false;
    }
  } catch (error) {
    console.error("同步用户信息出错:", error);
    return false;
  }
};

// 打开编辑对话框
const openEditDialog = () => {
  if (userInfo.value) {
    form.nickname = userInfo.value.nickname || "";
    form.sex = userInfo.value.sex || 0;
    form.info = userInfo.value.info || "";
    avatarUrl.value = userInfo.value.avatar || defaultAvatar;
  }
  dialogVisible.value = true;
};

// 处理头像变更
const handleAvatarChange = file => {
  const isLt2M = file.size / 1024 / 1024 < 2;
  if (!isLt2M) {
    ElMessage.error("头像图片大小不能超过 2MB!");
    return false;
  }
  croppingImage.value = URL.createObjectURL(file.raw);
  cropperDialogVisible.value = true;
};

// 处理裁剪错误
const handleCropperError = (error: any) => {
  console.error("裁剪组件发生错误:", error);
  ElMessage.error(`图片处理失败: ${error.message || "未知错误"}`);
  loading.value = false;
  cropperDialogVisible.value = false;
};

// 确认裁剪
const handleConfirmCrop = () => {
  if (cropperRef.value) {
    loading.value = true;
    cropperRef.value.croppered();
  }
};

// 接收裁剪结果
const handleCropperResult = async ({ blob, base64 }) => {
  try {
    const formData = new FormData();
    formData.append("file", blob, `crop_${Date.now()}.png`);

    const res = await uploadFile(formData);

    if (res.code === 200 && res.data?.url) {
      form.avatar = res.data.url;
      avatarUrl.value = base64;
      cropperDialogVisible.value = false;
      ElMessage.success("图片处理成功");
    } else {
      ElMessage.error(res.msg || "图片上传失败");
    }
  } catch (error: any) {
    console.error("处理裁剪图片失败:", error);
    ElMessage.error(`图片处理失败: ${error.message || "未知错误"}`);
  } finally {
    loading.value = false;
  }
};

// 提交表单
const submitForm = async () => {
  if (!formRef.value) return;

  await formRef.value.validate(async valid => {
    if (valid) {
      const nickname = form.nickname.trim();
      if (!nickname) {
        ElMessage.warning("昵称不能为空");
        return;
      }
      const info = form.info.trim();
      if (profileOriginalInfo.value.trim() && !info) {
        ElMessage.warning("当前服务暂不支持清空签名，请保留或修改签名内容");
        return;
      }
      try {
        loading.value = true;

        const updateData: UpdateUserInfoParams = {
          nickname,
          sex: form.sex,
          info
        };

        if (form.avatar) {
          updateData.avatar = form.avatar;
        }

        const res = await updateFrontendUserInfo(updateData);
        // 兼容不同的响应格式 (code 200 或 success true)
        const isSuccess = res && (res.code === 200 || (res as any).success);

        if (isSuccess) {
          // 等待用户信息同步完成，确保本地存储和 UI 状态一致
          const syncSuccess = await fetchUserDetail();
          if (syncSuccess) {
            ElMessage.success("资料修改成功");
            dialogVisible.value = false;
          }
        } else {
          ElMessage.error(res?.msg || "资料修改失败");
        }
      } catch (error) {
        console.error("更新个人资料失败:", error);
        ElMessage.error("更新资料时发生错误，请检查网络后重试");
      } finally {
        loading.value = false;
      }
    }
  });
};

// 打开修改密码对话框
const openPasswordDialog = () => {
  passwordForm.oldPassword = "";
  passwordForm.newPassword = "";
  passwordForm.confirmPassword = "";
  passwordDialogVisible.value = true;
};

// 根据错误码获取友好的错误提示
const getPasswordErrorMessage = (code: number, msg?: string): string => {
  const errorMessages: Record<number, string> = {
    400: msg || "请求参数错误，请检查输入",
    401: "登录已过期，请重新登录后再试",
    429: "操作过于频繁，请稍后再试",
    500: "服务器繁忙，请稍后重试"
  };

  // 优先使用后端返回的具体错误信息
  if (msg && msg !== "系统错误" && msg !== "error" && msg.length > 0) {
    return msg;
  }

  return errorMessages[code] || msg || "密码修改失败，请稍后重试";
};

// 提交密码修改表单
const submitPasswordForm = async () => {
  if (!passwordFormRef.value) return;

  await passwordFormRef.value.validate(async valid => {
    if (valid) {
      try {
        passwordLoading.value = true;

        const { code, msg } = await updateFrontendUserPassword({
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword
        });

        if (code === 200) {
          ElMessage.success("密码修改成功，即将退出登录");
          passwordDialogVisible.value = false;

          setTimeout(() => {
            removeToken();
            router.push("/home");
          }, 1500);
        } else {
          const errorMsg = getPasswordErrorMessage(code, msg);
          ElMessage.error(errorMsg);

          // 如果是原密码错误，清空原密码输入框方便用户重新输入
          if ((code === 400 || code === 100001) && msg?.includes("原密码")) {
            passwordForm.oldPassword = "";
          }
          // 如果是登录过期，提示用户重新登录
          if (code === 401) {
            setTimeout(() => {
              removeToken();
              router.push("/home");
            }, 1500);
          }
        }
      } catch (error: any) {
        console.error("修改密码失败:", error);
        // 优先从响应中获取错误信息
        const responseData = error.response?.data;
        const code = responseData?.code || error.code || 500;
        const msg = responseData?.msg || error.msg || error.message;

        // 网络错误特殊处理
        if (
          error.message?.includes("Network Error") ||
          error.message?.includes("timeout")
        ) {
          ElMessage.error("网络连接失败，请检查网络后重试");
        } else {
          const errorMsg = getPasswordErrorMessage(code, msg);
          ElMessage.error(errorMsg);
        }
      } finally {
        passwordLoading.value = false;
      }
    }
  });
};

const bannerStyle = computed(() => ({
  backgroundImage: `url(${defaultBanner})`
}));

onMounted(async () => {
  // 先同步用户信息
  await fetchUserDetail();

  // 确认是学生后，获取学习统计（只调用一次，避免竞态）
  if (userRole.value === "学生") {
    await fetchStudyStats();
  }
});
</script>

<style lang="scss" scoped>
.user-profile {
  .profile-banner {
    position: relative;
    display: flex;
    align-items: flex-end;
    width: 100%;
    height: 200px;
    margin: 0 0 28px;
    overflow: hidden;
    background-repeat: no-repeat;
    background-position: center center;
    background-size: cover;
    border-radius: 20px;
    box-shadow:
      0 8px 30px -6px rgb(151 180 247 / 25%),
      0 2px 8px rgb(0 0 0 / 8%);

    .dark & {
      box-shadow:
        0 8px 30px -6px rgb(0 0 0 / 40%),
        0 2px 8px rgb(0 0 0 / 20%);
    }

    .banner-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: flex-end;
      padding: 24px 32px;
      background: linear-gradient(
        to bottom,
        rgb(151 180 247 / 5%) 0%,
        rgb(0 0 0 / 10%) 30%,
        rgb(0 0 0 / 55%) 100%
      );
      backdrop-filter: blur(1px);
    }

    .banner-text {
      color: #fff;
    }

    .banner-title {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 1px;
      text-shadow: 0 2px 8px rgb(0 0 0 / 30%);
    }

    .banner-sub {
      margin-top: 6px;
      font-size: 14px;
      letter-spacing: 0.5px;
      opacity: 0.9;
      text-shadow: 0 1px 4px rgb(0 0 0 / 20%);
    }
  }

  .profile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;

    h3 {
      position: relative;
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: #1a1a2e;
      letter-spacing: 0.3px;

      &::after {
        position: absolute;
        bottom: -6px;
        left: 0;
        width: 40px;
        height: 3px;
        content: "";
        background: linear-gradient(90deg, #97b4f7, #dce2f7);
        border-radius: 2px;
      }

      .dark & {
        color: #f1f5f9;

        &::after {
          background: linear-gradient(90deg, #38bdf8, #0ea5e9);
        }
      }
    }

    .action-buttons {
      display: flex;
      gap: 12px;

      .btn-elevated {
        position: relative;
        display: inline-flex;
        gap: 6px;
        align-items: center;
        padding: 8px 18px;
        overflow: hidden;
        font-size: 13px;
        font-weight: 600;
        color: #fff;
        letter-spacing: 0.3px;
        background: linear-gradient(135deg, #97b4f7, #7c9cf5);
        border: none;
        border-radius: 10px;
        box-shadow:
          0 4px 14px rgb(151 180 247 / 40%),
          inset 0 1px 0 rgb(255 255 255 / 20%);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

        &.warn {
          background: linear-gradient(135deg, #f59e0b, #f97316);
          box-shadow:
            0 4px 14px rgb(251 146 60 / 35%),
            inset 0 1px 0 rgb(255 255 255 / 20%);
        }

        &.info {
          background: linear-gradient(135deg, #97b4f7, #7c9cf5);
        }

        &:hover {
          box-shadow:
            0 6px 20px rgb(151 180 247 / 50%),
            inset 0 1px 0 rgb(255 255 255 / 25%);
          transform: translateY(-2px);

          &.warn {
            box-shadow:
              0 6px 20px rgb(251 146 60 / 50%),
              inset 0 1px 0 rgb(255 255 255 / 25%);
          }
        }

        &:active {
          transform: translateY(0);
        }
      }
    }
  }

  .profile-content {
    display: flex;
    gap: 28px;

    @media (width <= 768px) {
      flex-direction: column;
      gap: 20px;
    }
  }

  .profile-avatar {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 28px 24px;
    text-align: center;
    background: linear-gradient(160deg, #f8faff, #eef2ff);
    border: 1px solid rgb(151 180 247 / 15%);
    border-radius: 16px;
    box-shadow: 0 4px 20px rgb(151 180 247 / 12%);
    transition: all 0.3s ease;

    &:hover {
      box-shadow: 0 8px 28px rgb(151 180 247 / 20%);
      transform: translateY(-2px);
    }

    .dark & {
      background: linear-gradient(160deg, #111b2d, #0f172a);
      border-color: rgb(56 189 248 / 10%);
      box-shadow: 0 4px 20px rgb(0 0 0 / 25%);

      &:hover {
        box-shadow: 0 8px 28px rgb(56 189 248 / 15%);
      }
    }

    .el-avatar {
      margin-bottom: 16px;
      border: 3px solid #fff;
      box-shadow:
        0 4px 16px rgb(151 180 247 / 30%),
        0 0 0 3px rgb(151 180 247 / 15%);

      .dark & {
        border-color: #1e293b;
        box-shadow:
          0 4px 16px rgb(0 0 0 / 35%),
          0 0 0 3px rgb(56 189 248 / 15%);
      }
    }

    .user-name {
      margin-bottom: 8px;
      font-size: 17px;
      font-weight: 700;
      color: #1a1a2e;

      .dark & {
        color: #f1f5f9;
      }
    }

    .user-role {
      padding: 4px 16px;
      font-size: 13px;
      font-weight: 600;
      color: #fff;
      letter-spacing: 0.5px;
      background: linear-gradient(135deg, #97b4f7, #7c9cf5);
      border-radius: 20px;
      box-shadow: 0 2px 8px rgb(151 180 247 / 35%);
    }
  }

  .profile-info {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    gap: 20px;

    .info-group {
      position: relative;
      flex: 1 1 280px;
      padding: 22px 24px 12px;
      overflow: hidden;
      background: linear-gradient(160deg, #fff, #f8faff);
      border: 1px solid rgb(151 180 247 / 15%);
      border-radius: 16px;
      box-shadow: 0 4px 20px rgb(0 0 0 / 5%);
      backdrop-filter: blur(8px);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

      &::after {
        display: none;
        content: none;
      }

      .dark & {
        background: linear-gradient(160deg, #111b2d, #0f172a);
        border-color: rgb(56 189 248 / 10%);
        box-shadow: 0 4px 20px rgb(0 0 0 / 25%);

        &::after {
          background: linear-gradient(90deg, #38bdf8, #0ea5e9, transparent);
        }
      }

      &:hover {
        box-shadow:
          0 8px 30px -4px rgb(151 180 247 / 20%),
          0 2px 8px rgb(0 0 0 / 4%);
        transform: translateY(-3px);

        .dark & {
          box-shadow:
            0 8px 30px -4px rgb(56 189 248 / 15%),
            0 2px 8px rgb(0 0 0 / 15%);
        }
      }

      &.timeline {
        background: linear-gradient(160deg, #fefefe, #f0f4ff);

        .dark & {
          background: linear-gradient(160deg, #0f172a, #111b2d);
        }
      }

      .group-title {
        position: relative;
        padding-left: 14px;
        margin-bottom: 20px;
        font-size: 16px;
        font-weight: 700;
        color: #1a1a2e;
        letter-spacing: 0.3px;

        .dark & {
          color: #f1f5f9;
        }

        &::before {
          position: absolute;
          top: 2px;
          left: 0;
          width: 4px;
          height: 16px;
          content: "";
          background: linear-gradient(180deg, #97b4f7, #7c9cf5);
          border-radius: 3px;
          box-shadow: 0 2px 6px rgb(151 180 247 / 30%);
        }
      }

      .info-item {
        display: flex;
        align-items: flex-start;
        padding: 8px 10px;
        margin-bottom: 6px;
        font-size: 14.5px;
        line-height: 24px;
        border-radius: 8px;
        transition: background-color 0.2s ease;

        &:hover {
          background: rgb(151 180 247 / 5%);

          .dark & {
            background: rgb(56 189 248 / 5%);
          }
        }

        .label {
          width: 80px;
          flex-shrink: 0;
          font-weight: 600;
          color: #6b7280;

          .dark & {
            color: #94a3b8;
          }
        }

        .value {
          display: flex;
          flex: 1;
          gap: 6px;
          align-items: center;
          color: #1a1a2e;
          word-break: break-all;

          .dark & {
            color: #e2e8f0;
          }
        }

        &.signature .value {
          line-height: 1.5;
          white-space: pre-wrap;
        }

        .time-value {
          font-size: 14.5px;
        }

        .email-value {
          font-size: 14.5px;
        }

        .score-value {
          font-size: 15px;
          font-weight: 700;
          color: #f59e0b;
        }

        .progress-value {
          flex: 1;
          max-width: 180px;
          margin-left: 8px;
        }
      }
    }

    .info-group.stats {
      background: linear-gradient(160deg, #fefefe, #f0f4ff);
      border-color: rgb(151 180 247 / 15%);

      .dark & {
        background: linear-gradient(160deg, #0f172a, #111b2d);
        border-color: rgb(56 189 248 / 10%);
      }

      &::after {
        display: none;
        content: none;
      }
    }

    .stats-content {
      position: relative;

      &.is-loading-effect {
        &::after {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          content: "";
          background: rgb(255 255 255 / 30%);
          border-radius: 8px;
        }
      }

      .number-solid {
        display: inline-block;
        min-width: 12px;
        font-size: 15px;
        font-weight: 800;
        color: #4f7df3;
      }

      .loading-placeholder {
        color: #999;
        animation: pulse 1.5s infinite;
      }
    }
  }
}

@keyframes pulse {
  0% {
    opacity: 0.6;
  }

  50% {
    opacity: 1;
  }

  100% {
    opacity: 0.6;
  }
}

.avatar-uploader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  text-align: center;

  .avatar-container {
    position: relative;
    cursor: pointer;

    .avatar-uploader-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100px;
      height: 100px;
      font-size: 28px;
      color: #8c939d;
      background: #f5f7fa;
      border: 1px dashed #d9d9d9;
      border-radius: 50%;
    }

    .edit-icon {
      position: absolute;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      color: #fff;
      background-color: #97b4f7;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgb(0 0 0 / 15%);

      .el-icon {
        font-size: 14px;
      }
    }
  }
}

.cropper-container {
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

@media (width <= 768px) {
  .user-profile {
    .profile-header {
      gap: 14px;
      align-items: stretch;
      margin-bottom: 20px;

      .action-buttons {
        gap: 10px;

        .btn-elevated {
          min-height: 44px;
          padding: 10px 16px;
        }
      }
    }

    .profile-info {
      flex-direction: column;
      gap: 16px;

      .info-group {
        padding: 20px 18px 18px;

        .group-title {
          margin-bottom: 18px;
        }

        .info-item {
          flex-direction: column;
          gap: 8px;
          align-items: stretch;
          padding: 14px 0;
          margin-bottom: 0;
          line-height: 1.7;
          border-bottom: 1px solid rgb(151 180 247 / 10%);

          &:last-child {
            padding-bottom: 0;
            border-bottom: none;
          }

          .label {
            width: auto;
            font-size: 13px;
            line-height: 1.4;
          }

          .value {
            align-items: flex-start;
            line-height: 1.75;
            word-break: break-word;
          }

          .email-value,
          .time-value {
            flex-wrap: wrap;
          }

          .progress-value {
            width: 100%;
            max-width: none;
            margin-left: 0;
          }

          &.signature {
            padding: 16px 14px;
            margin-top: 6px;
            background: linear-gradient(180deg, #f8fbff 0%, #f2f6ff 100%);
            border: 1px solid rgb(151 180 247 / 14%);
            border-radius: 14px;

            .value {
              display: block;
            }
          }
        }
      }
    }
  }
}

/* 最近学习与学习动态样式 */
.profile-extra-sections {
  display: flex;
  gap: 24px;
  margin-top: 28px;
  margin-bottom: 28px;

  .extra-section {
    display: flex;
    flex: 1;
    flex-direction: column;
    padding: 24px;
    overflow: hidden;
    background: linear-gradient(160deg, #fff, #f8faff);
    border: 1px solid rgb(151 180 247 / 12%);
    border-radius: 16px;
    box-shadow: 0 4px 20px -4px rgb(151 180 247 / 15%);
    transition: all 0.3s ease;

    &:hover {
      box-shadow: 0 8px 28px -4px rgb(151 180 247 / 22%);
      transform: translateY(-2px);
    }

    .dark & {
      background: linear-gradient(160deg, #111b2d, #0f172a);
      border-color: rgb(56 189 248 / 10%);
      box-shadow: 0 4px 20px rgb(0 0 0 / 25%);

      &:hover {
        box-shadow: 0 8px 28px rgb(56 189 248 / 12%);
      }
    }

    .section-header {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;

      .section-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 17px;
        font-weight: 700;
        color: #1a1a2e;

        .dark & {
          color: #f1f5f9;
        }

        .el-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          color: #97b4f7;
          background: linear-gradient(135deg, #eef2ff, #dce2f7);
          border-radius: 8px;

          .dark & {
            color: #38bdf8;
            background: rgb(56 189 248 / 10%);
          }

          svg {
            width: 18px;
            height: 18px;

            path[stroke] {
              stroke: currentColor;
            }

            path[fill]:not([fill="none"]):not([fill="white"]) {
              fill: currentColor;
            }

            rect[stroke] {
              stroke: currentColor;
            }
          }
        }
      }
    }
  }

  .course-grid {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    overflow-y: auto;

    &::-webkit-scrollbar {
      width: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: rgb(151 180 247 / 25%);
      border-radius: 4px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }
  }

  .course-mini-card {
    display: flex;
    gap: 16px;
    padding: 14px;
    background: linear-gradient(135deg, #f8faff, #f0f4ff);
    border: 1px solid rgb(151 180 247 / 10%);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    .dark & {
      background: linear-gradient(135deg, #1e293b, #0f172a);
      border-color: rgb(56 189 248 / 8%);
    }

    &:hover {
      background: linear-gradient(135deg, #eef2ff, #dce2f7);
      border-color: rgb(151 180 247 / 25%);
      box-shadow: 0 6px 20px rgb(151 180 247 / 18%);
      transform: translateY(-2px);

      .dark & {
        background: linear-gradient(135deg, #1e293b, #334155);
        border-color: rgb(56 189 248 / 20%);
        box-shadow: 0 6px 20px rgb(56 189 248 / 10%);
      }
    }

    .course-thumb {
      position: relative;
      flex-shrink: 0;
      width: 100px;
      height: 64px;
      overflow: hidden;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgb(0 0 0 / 8%);

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.3s ease;
      }

      &:hover img {
        transform: scale(1.05);
      }

      .thumb-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        font-size: 22px;
        font-weight: 700;
        color: #97b4f7;
        background: linear-gradient(135deg, #eef2ff, #dce2f7);
      }

      .course-type-tag {
        position: absolute;
        top: 4px;
        right: 4px;
        padding: 2px 8px;
        font-size: 10px;
        font-weight: 600;
        color: #fff;
        border-radius: 6px;
        box-shadow: 0 2px 6px rgb(0 0 0 / 20%);

        &.required {
          background: linear-gradient(135deg, #ef4444, #dc2626);
        }

        &.elective {
          background: linear-gradient(135deg, #6366f1, #4f46e5);
        }
      }
    }

    .course-mini-info {
      display: flex;
      flex: 1;
      flex-direction: column;
      justify-content: space-between;

      .course-name {
        display: -webkit-box;
        overflow: hidden;
        font-size: 15.5px;
        font-weight: 600;
        color: #1a1a2e;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;

        .dark & {
          color: #f1f5f9;
        }
      }

      .course-progress {
        display: flex;
        align-items: center;
        gap: 12px;

        .el-progress {
          flex: 1;
        }

        .progress-text {
          font-size: 13px;
          font-weight: 500;
          color: #6b7280;
          white-space: nowrap;

          .dark & {
            color: #94a3b8;
          }
        }
      }
    }
  }

  .dynamics-list {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 6px;
    min-height: 0;
    padding-top: 4px;
    overflow-y: auto;

    &::-webkit-scrollbar {
      width: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: rgb(151 180 247 / 25%);
      border-radius: 4px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    .activity-item {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      padding: 14px 16px;
      background: linear-gradient(135deg, #f8faff, #f2f5ff);
      border: 1px solid rgb(151 180 247 / 10%);
      border-radius: 12px;
      transition: all 0.25s ease;

      .dark & {
        background: linear-gradient(135deg, #1e293b, #0f172a);
        border-color: rgb(56 189 248 / 8%);
      }

      &:hover {
        background: linear-gradient(135deg, #eef2ff, #dce2f7);
        border-color: rgb(151 180 247 / 20%);
        box-shadow: 0 4px 14px rgb(151 180 247 / 14%);

        .dark & {
          background: linear-gradient(135deg, #1e293b, #334155);
          border-color: rgb(56 189 248 / 18%);
          box-shadow: 0 4px 14px rgb(56 189 248 / 8%);
        }
      }

      .activity-dot {
        display: flex;
        flex-shrink: 0;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        border-radius: 10px;

        .activity-icon-svg {
          width: 30px;
          height: 30px;
          --account-icon-stroke: 2.7;
        }

        &.dot-success {
          color: #4f7df3;
          background: linear-gradient(135deg, #e8eeff, #d8e3ff);

          .dark & {
            color: #8fb1ff;
            background: rgb(79 125 243 / 16%);
          }
        }

        &.dot-primary {
          color: #6366f1;
          background: linear-gradient(135deg, #e0e7ff, #c7d2fe);

          .dark & {
            color: #818cf8;
            background: rgb(99 102 241 / 15%);
          }
        }

        &.dot-warning {
          color: #f59e0b;
          background: linear-gradient(135deg, #fef3c7, #fde68a);

          .dark & {
            color: #fbbf24;
            background: rgb(245 158 11 / 15%);
          }
        }

        &.dot-info {
          color: #6b7280;
          background: linear-gradient(135deg, #f3f4f6, #e5e7eb);

          .dark & {
            color: #94a3b8;
            background: rgb(107 114 128 / 15%);
          }
        }

        &.dot-danger {
          color: #ef4444;
          background: linear-gradient(135deg, #fee2e2, #fecaca);

          .dark & {
            color: #f87171;
            background: rgb(239 68 68 / 15%);
          }
        }
      }

      .activity-body {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
        padding-top: 2px;

        .activity-content {
          font-size: 14px;
          font-weight: 500;
          line-height: 1.5;
          color: #1e293b;

          .dark & {
            color: #e2e8f0;
          }
        }

        .activity-time {
          font-size: 12px;
          font-weight: 400;
          color: #94a3b8;

          .dark & {
            color: #64748b;
          }
        }
      }
    }
  }
}

/* 暗色模式适配 */
.dark .profile-extra-sections .extra-section {
  box-shadow: 0 4px 20px rgb(0 0 0 / 30%);
}

@media (width <= 1200px) {
  .profile-extra-sections {
    flex-direction: column;
  }
}
</style>
