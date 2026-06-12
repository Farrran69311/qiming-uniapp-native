<script setup lang="ts">
import { computed, ref, reactive, onMounted, onUnmounted } from "vue";
import { ElMessage, type FormInstance } from "element-plus";
import {
  Plus,
  Camera,
  User,
  Lock,
  Key,
  Check,
  InfoFilled
} from "@element-plus/icons-vue";
import { emitter } from "@/utils/mitt";
import { storageLocal } from "@pureadmin/utils";
import { userKey, removeToken } from "@/utils/auth";
import { useRouter } from "vue-router";
import ReCropper from "@/components/ReCropper";
import {
  updateFrontendUserInfo,
  updateFrontendUserPassword,
  type UpdateUserInfoParams
} from "@/api/frontend/user";
import { uploadFile, getUserDetail, getStudentStats } from "@/api/user";
import { formatAvatar } from "@/utils/avatar";
import { useUserStoreHook } from "@/store/modules/user";
import { getFrontendCourseList } from "@/api/frontend/course";
import {
  getCourseUsersProgress,
  getWeekUsage,
  getEfficientIndex,
  getPlatformStats,
  getTeacherUsage
} from "@/api/statistics";

const router = useRouter();

// 修改资料相关
const editProfileVisible = ref(false);
const loading = ref(false);
const formRef = ref<FormInstance>();

const profileForm = reactive({
  nickname: "",
  avatar: "",
  info: "",
  sex: 0,
  username: "", // 增加 username 用于显示
  createdAt: "", // 增加创建时间
  roleType: 0
});

// 账号角色判断
const isStudent = ref(false);
const isTeacher = ref(false);
const isAdmin = ref(false);

// 学习统计接口定义 (对接后端用)
export interface CourseProgress {
  name: string;
  cover: string;
  progress: number;
}

export interface StudentStudyStats {
  joinedCourses: CourseProgress[];
  totalHours: string | number;
  avgScore: string | number;
  totalProgress: string | number;
  joinDate?: string;
}

const studyStats = reactive<StudentStudyStats>({
  joinedCourses: [],
  totalHours: 0,
  avgScore: 0,
  totalProgress: 0,
  joinDate: ""
});

// 教师统计定义
export interface TeacherStats {
  totalStudents: number;
  activeCourses: number;
  avgEfficiency: number;
  joinDate: string;
  courseProgress: Array<{
    name: string;
    avgProgress: number;
    studentCount: number;
  }>;
}

const teacherStats = reactive<TeacherStats>({
  totalStudents: 0,
  activeCourses: 0,
  avgEfficiency: 0,
  joinDate: "",
  courseProgress: []
});

// 管理员统计定义
export interface AdminStats {
  totalActivity: number;
  platformEfficiency: number;
  totalResources: number;
  joinDate: string;
  teacherActivity: Array<{
    name: string;
    value: number;
    unit: string;
  }>;
}

const adminStats = reactive<AdminStats>({
  totalActivity: 0,
  platformEfficiency: 0,
  totalResources: 0,
  joinDate: "",
  teacherActivity: []
});

// 获取学习统计数据
const fetchStudentStats = async () => {
  try {
    // 获取课程列表数据
    const res = await getFrontendCourseList({ pageNum: 1, pageSize: 10 });
    if (res.code === 200) {
      const list = res.data.list || [];
      studyStats.joinedCourses = list.map(item => ({
        name: item.courseName,
        cover: item.thumbUrl,
        progress:
          item.totalHours > 0
            ? Math.round((item.finishedHours / item.totalHours) * 100)
            : 0
      }));

      // 从课程列表计算累计学时和总体进度（这是可靠的数据源）
      const calculatedHours = list.reduce(
        (acc, curr) => acc + (curr.finishedHours || 0),
        0
      );
      const totalProg = list.reduce((acc, curr) => {
        const p =
          curr.totalHours > 0 ? curr.finishedHours / curr.totalHours : 0;
        return acc + p;
      }, 0);
      const calculatedProgress =
        list.length > 0 ? Math.round((totalProg / list.length) * 100) : 0;

      // 直接使用计算值，不再被后续接口覆盖
      studyStats.totalHours = calculatedHours;
      studyStats.totalProgress = calculatedProgress;
    }

    // 获取入驻日期和作业均分（通过新接口）
    const statsRes = await getStudentStats().catch(() => null);
    if (statsRes?.code === 200 && statsRes.data) {
      studyStats.avgScore = statsRes.data.avgScore ?? "暂无";
      studyStats.joinDate = statsRes.data.joinDate || "--";
      // 【修复】不再用接口返回的 totalHours/totalProgress 覆盖课程列表计算的值
      // 因为 getStudentStats 接口没有 mock，返回的值不可靠
    }
  } catch (e) {
    console.error("获取统计失败", e);
  }
};

// 获取教师统计数据
const fetchTeacherStats = async () => {
  try {
    const res = await getCourseUsersProgress();
    if (res.code === 200 && res.data) {
      const list = res.data.courseUsersProgress || [];
      teacherStats.activeCourses = list.length;

      let totalStudents = 0;
      teacherStats.courseProgress = list.map(course => {
        const students = course.usersProgress?.length || 0;
        totalStudents += students;
        const avg =
          students > 0
            ? Math.round(
                course.usersProgress.reduce((a, b) => a + b.progress, 0) /
                  students
              )
            : 0;
        return {
          name: course.courseName,
          avgProgress: avg,
          studentCount: students
        };
      });
      teacherStats.totalStudents = totalStudents;
    }

    const effRes = await getEfficientIndex();
    if (effRes.code === 200 && effRes.data) {
      const effList = effRes.data.efficientIndexList || [];
      if (effList.length > 0) {
        teacherStats.avgEfficiency = Math.round(
          effList.reduce((a, b) => a + (b.planTime || 0), 0) / effList.length
        );
      }
    }
    teacherStats.joinDate = profileForm.createdAt;
  } catch (e) {
    console.error("获取教师统计失败", e);
  }
};

// 获取管理员统计数据
const fetchAdminStats = async () => {
  try {
    const weekRes = await getWeekUsage();
    if (weekRes.code === 200 && weekRes.data) {
      adminStats.totalActivity =
        (weekRes.data.studentTotalNum || 0) +
        (weekRes.data.teacherTotalNum || 0);
    }

    const platRes = await getPlatformStats();
    if (platRes.code === 200 && platRes.data) {
      const stats = platRes.data.stats || [];
      const resourceStat = stats.find(
        s => s.title.includes("资源") || s.title.includes("课")
      );
      adminStats.totalResources = resourceStat ? Number(resourceStat.value) : 0;
    }

    // 获取教师相关数据
    const teacherUsageRes = await getTeacherUsage();
    if (teacherUsageRes.code === 200 && teacherUsageRes.data) {
      const usageList = teacherUsageRes.data.usageInfoList || [];
      const totalUsage = usageList.reduce(
        (acc, curr) => acc + curr.usageNum,
        0
      );
      const avgUsage =
        usageList.length > 0 ? Math.round(totalUsage / usageList.length) : 0;

      adminStats.teacherActivity = [
        { name: "教师周活跃总次", value: totalUsage, unit: "次" },
        { name: "日均教研频率", value: avgUsage, unit: "次/日" },
        { name: "入驻教师总数", value: 42, unit: "人" }, // 模拟数据
        { name: "教学资源覆盖率", value: 88, unit: "%" }
      ];
    }

    adminStats.platformEfficiency = 94;
    adminStats.joinDate = profileForm.createdAt;
  } catch (e) {
    console.error("获取管理员统计失败", e);
  }
};

const rules = {
  nickname: [
    { required: true, message: "请输入姓名", trigger: "blur" },
    { min: 2, max: 20, message: "长度在 2 到 20 个字符", trigger: "blur" }
  ]
};

// 修改密码相关
const changePasswordVisible = ref(false);
const passwordLoading = ref(false);
const passwordFormRef = ref<FormInstance>();
const passwordForm = reactive({
  oldPassword: "",
  newPassword: "",
  confirmPassword: ""
});

const passwordRules = {
  oldPassword: [{ required: true, message: "请输入原密码", trigger: "blur" }],
  newPassword: [
    { required: true, message: "请输入新密码", trigger: "blur" },
    { min: 6, message: "密码长度不能少于6位", trigger: "blur" },
    { max: 70, message: "密码长度最大值不能超过70位", trigger: "blur" },
    {
      validator: (rule, value, callback) => {
        if (value && value === passwordForm.oldPassword) {
          callback(new Error("新密码不能与原密码相同"));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ],
  confirmPassword: [
    { required: true, message: "请再次输入新密码", trigger: "blur" },
    {
      validator: (rule, value, callback) => {
        if (value !== passwordForm.newPassword) {
          callback(new Error("两次输入的密码不一致"));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ]
};

// 密码强度检测
const passwordStrength = computed(() => {
  const pwd = passwordForm.newPassword;
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 6) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
});

const getStrengthInfo = (score: number) => {
  const levels = [
    { text: "很弱", color: "#f56c6c" },
    { text: "一般", color: "#e6a23c" },
    { text: "安全", color: "#67c23a" },
    { text: "非常安全", color: "#97b4f7" }
  ];
  return levels[score - 1] || { text: "", color: "#eee" };
};

// 图片裁剪相关
const cropperDialogVisible = ref(false);
const croppingImage = ref("");
const cropperRef = ref();
const avatarUrl = ref("");

const handleEditProfile = () => {
  const cachedUser = storageLocal().getItem(userKey) as any;
  if (!cachedUser) {
    ElMessage.warning("请先登录");
    return;
  }

  profileForm.nickname = cachedUser.nickname || cachedUser.username || "";
  profileForm.avatar = cachedUser.avatar || "";
  profileForm.info = cachedUser.info || "";
  profileForm.username = cachedUser.username || "ID: 未知";
  profileForm.sex = cachedUser.sex ?? 0;
  // 增强日期获取兼容性
  const rawDate =
    cachedUser.createtime ||
    cachedUser.createdAt ||
    cachedUser.createTime ||
    cachedUser["create-time"] ||
    "";
  profileForm.createdAt = rawDate ? rawDate.split(" ")[0] : "--";
  profileForm.roleType = cachedUser.roleType ?? 0;

  // 角色展示判断
  isStudent.value = profileForm.roleType === 1;
  isTeacher.value = profileForm.roleType === 2;
  isAdmin.value = profileForm.roleType === 3;

  if (isStudent.value) {
    fetchStudentStats();
  } else if (isTeacher.value) {
    fetchTeacherStats();
  } else if (isAdmin.value) {
    fetchAdminStats();
  }

  avatarUrl.value = formatAvatar(profileForm.avatar);
  editProfileVisible.value = true;
};

const handleChangePassword = () => {
  passwordForm.oldPassword = "";
  passwordForm.newPassword = "";
  passwordForm.confirmPassword = "";
  changePasswordVisible.value = true;
};

const handleAvatarChange = file => {
  const isLt2M = file.raw.size / 1024 / 1024 < 2;
  if (!isLt2M) {
    ElMessage.error("头像大小不能超过 2MB!");
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    croppingImage.value = e.target.result as string;
    cropperDialogVisible.value = true;
  };
  reader.readAsDataURL(file.raw);
};

const handleConfirmCrop = () => {
  cropperRef.value.getBlob(blob => {
    const formData = new FormData();
    formData.append("file", blob, `avatar_${Date.now()}.png`);
    loading.value = true;

    uploadFile(formData)
      .then(res => {
        const data = (res.data || res) as any;
        if (res.code === 200 || (res as any).success) {
          const url = data.url;
          profileForm.avatar = url;
          avatarUrl.value = url;
          cropperDialogVisible.value = false;
          ElMessage.success("头像上传成功，保存后生效");
        } else {
          ElMessage.error(res.msg || "上传失败");
        }
      })
      .finally(() => {
        loading.value = false;
      });
  });
};

const submitProfile = async () => {
  if (!formRef.value) return;
  await formRef.value.validate(async valid => {
    if (valid) {
      loading.value = true;
      try {
        const res = await updateFrontendUserInfo({
          nickname: profileForm.nickname,
          avatar: profileForm.avatar,
          info: profileForm.info,
          sex: profileForm.sex
        });
        if (res.code === 200 || (res as any).success) {
          ElMessage.success({
            message: "资料修改成功",
            type: "success",
            duration: 2000
          });

          const detailRes = await getUserDetail();
          const detailData = (detailRes.data || detailRes) as any;
          if (detailData && detailData.userInfo) {
            const newUser = detailData.userInfo;
            const userStore = useUserStoreHook();

            const cachedUser = storageLocal().getItem(userKey) as any;
            if (cachedUser) {
              const updatedUser = { ...cachedUser, ...newUser };
              storageLocal().setItem(userKey, updatedUser);
            }

            userStore.SET_NICKNAME(newUser.nickname);
            userStore.SET_AVATAR(newUser.avatar);

            window.dispatchEvent(
              new CustomEvent("userInfoUpdated", { detail: newUser })
            );
          }

          editProfileVisible.value = false;
        } else {
          ElMessage.error(res.msg || "资料修改失败");
        }
      } catch (e: any) {
        console.error("修改资料错误:", e);
        const errMsg =
          e.response?.data?.msg || e.msg || e.message || "系统错误，请检查网络";
        ElMessage.error(errMsg);
      } finally {
        loading.value = false;
      }
    }
  });
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

const submitPassword = async () => {
  if (!passwordFormRef.value) return;
  await passwordFormRef.value.validate(async valid => {
    if (valid) {
      passwordLoading.value = true;
      try {
        const res = await updateFrontendUserPassword({
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword
        });
        if (res.code === 200 || (res as any).success) {
          ElMessage.success("密码修改成功，请重新登录");
          changePasswordVisible.value = false;
          setTimeout(() => {
            removeToken();
            router.push("/home");
          }, 1500);
        } else {
          const errorMsg = getPasswordErrorMessage(res.code, res.msg);
          ElMessage.error(errorMsg);

          // 如果是原密码错误，清空原密码输入框方便用户重新输入
          if (res.code === 400 && res.msg?.includes("原密码")) {
            passwordForm.oldPassword = "";
          }
          // 如果是登录过期，提示用户重新登录
          if (res.code === 401) {
            setTimeout(() => {
              removeToken();
              router.push("/home");
            }, 1500);
          }
        }
      } catch (e: any) {
        console.error("修改密码错误:", e);
        // 优先从响应中获取错误信息
        const responseData = e.response?.data;
        const code = responseData?.code || e.code || 500;
        const msg = responseData?.msg || e.msg || e.message;

        // 网络错误特殊处理
        if (
          e.message?.includes("Network Error") ||
          e.message?.includes("timeout")
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

onMounted(() => {
  emitter.on("openEditProfile", handleEditProfile);
  emitter.on("openChangePassword", handleChangePassword);
});

onUnmounted(() => {
  emitter.off("openEditProfile", handleEditProfile);
  emitter.off("openChangePassword", handleChangePassword);
});
</script>

<template>
  <div class="re-account-settings">
    <el-dialog
      v-model="editProfileVisible"
      title="个人信息档案"
      :width="isStudent || isTeacher || isAdmin ? '1080px' : '640px'"
      class="premium-dialog id-card-dialog"
      align-center
    >
      <div
        class="profile-layout-container"
        :class="{ 'is-student-layout': isStudent || isTeacher || isAdmin }"
      >
        <div class="id-card-side">
          <div class="id-card-container">
            <div class="id-card-main">
              <div class="card-brand">
                <span class="brand-en">IntellEdu</span>
                <span class="brand-cn">启明智教</span>
              </div>

              <div class="card-avatar-section">
                <el-upload
                  class="avatar-uploader-modern"
                  action="#"
                  :auto-upload="false"
                  :show-file-list="false"
                  :on-change="handleAvatarChange"
                >
                  <div class="id-avatar-wrapper">
                    <el-avatar
                      v-if="avatarUrl"
                      :src="avatarUrl"
                      :size="120"
                      class="id-avatar-img"
                    />
                    <div v-else class="id-placeholder-avatar">
                      <el-icon><Plus /></el-icon>
                    </div>
                    <div class="id-upload-mask">
                      <el-icon><Camera /></el-icon>
                    </div>
                  </div>
                </el-upload>
                <!-- 安全设置按钮 -->
                <div class="card-security-btn" @click="handleChangePassword">
                  <el-icon><Lock /></el-icon>
                  <span>安全/密码</span>
                </div>
              </div>

              <div class="card-info-form">
                <el-form
                  ref="formRef"
                  :model="profileForm"
                  :rules="rules"
                  label-position="right"
                  label-width="60px"
                  class="id-card-form-body"
                >
                  <el-form-item
                    label="姓名"
                    prop="nickname"
                    class="id-form-item"
                  >
                    <el-input
                      v-model="profileForm.nickname"
                      placeholder="请输入姓名"
                    />
                  </el-form-item>

                  <el-form-item label="性别" class="id-form-item">
                    <div class="id-radio-box">
                      <el-radio-group
                        v-model="profileForm.sex"
                        class="id-radio-group"
                      >
                        <el-radio :value="1">男</el-radio>
                        <el-radio :value="2">女</el-radio>
                        <el-radio :value="0">保密</el-radio>
                      </el-radio-group>
                    </div>
                  </el-form-item>

                  <el-form-item label="签名" class="id-form-item">
                    <el-input
                      v-model="profileForm.info"
                      type="textarea"
                      :rows="2"
                      placeholder="这个同学很懒，什么都没留下..."
                      maxlength="50"
                      class="id-textarea"
                    />
                  </el-form-item>
                </el-form>
              </div>

              <div class="card-id-number">
                <span class="label">Citizen ID</span>
                <span class="number">{{ profileForm.username }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 额外个人信息展示 (按角色展示) -->
        <div v-if="isStudent || isTeacher || isAdmin" class="extra-stats-side">
          <div class="extra-stats-container">
            <template v-if="isStudent">
              <div class="stats-header">
                <span class="title">学习表现录</span>
                <span class="subtitle">LEARNING REPORT</span>
              </div>

              <div class="stats-grid">
                <div class="stat-item">
                  <div class="stat-label">累计学时</div>
                  <div class="stat-value">
                    {{ studyStats.totalHours || 0 }}h
                  </div>
                </div>
                <div class="stat-item">
                  <div class="stat-label">作业均分</div>
                  <div class="stat-value highlight">
                    {{ studyStats.avgScore || 0 }}
                  </div>
                </div>
                <div class="stat-item">
                  <div class="stat-label">总体进度</div>
                  <div class="stat-value">
                    {{ studyStats.totalProgress || 0 }}%
                  </div>
                </div>
                <div class="stat-item">
                  <div class="stat-label">入驻日期</div>
                  <div class="stat-value date">
                    {{ studyStats.joinDate || "--" }}
                  </div>
                </div>
              </div>

              <div class="courses-section">
                <div class="section-title">我的课程库</div>
                <div class="course-grid">
                  <div
                    v-for="(course, index) in studyStats.joinedCourses"
                    :key="index"
                    class="course-mini-card"
                  >
                    <div class="course-cover-wrapper">
                      <img
                        v-if="course.cover"
                        :src="course.cover"
                        class="course-mini-cover"
                      />
                      <div v-else class="course-placeholder-cover">无封面</div>
                      <div class="course-progress-badge">
                        {{ course.progress }}%
                      </div>
                    </div>
                    <div class="course-name">{{ course.name }}</div>
                    <el-progress
                      :percentage="course.progress"
                      :stroke-width="4"
                      :show-text="false"
                    />
                  </div>
                  <div
                    v-if="studyStats.joinedCourses.length === 0"
                    class="no-data-hint"
                  >
                    暂无已加入的课程
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="isTeacher">
              <div class="stats-header">
                <span class="title">教学成果录</span>
                <span class="subtitle">TEACHING REPORT</span>
              </div>

              <div class="stats-grid">
                <div class="stat-item">
                  <div class="stat-label">授课学生</div>
                  <div class="stat-value">
                    {{ teacherStats.totalStudents || 0 }}人
                  </div>
                </div>
                <div class="stat-item">
                  <div class="stat-label">活跃课程</div>
                  <div class="stat-value highlight">
                    {{ teacherStats.activeCourses || 0 }}
                  </div>
                </div>
                <div class="stat-item">
                  <div class="stat-label">备课均时</div>
                  <div class="stat-value">
                    {{ teacherStats.avgEfficiency || 0 }}m
                  </div>
                </div>
                <div class="stat-item">
                  <div class="stat-label">入驻日期</div>
                  <div class="stat-value date">
                    {{ teacherStats.joinDate || "--" }}
                  </div>
                </div>
              </div>

              <div class="courses-section">
                <div class="section-title">课程进度监控 (Avg.)</div>
                <div class="course-grid">
                  <div
                    v-for="(course, index) in teacherStats.courseProgress"
                    :key="index"
                    class="course-mini-card"
                  >
                    <div class="course-cover-wrapper teacher-dashboard-style">
                      <div class="dashboard-inner">
                        <div class="dashboard-stat">
                          <span class="num">{{ course.avgProgress }}</span>
                          <span class="unit">%</span>
                        </div>
                        <div class="dashboard-label">平均进度</div>
                      </div>
                      <div class="student-bubble">
                        <el-icon :size="10"><User /></el-icon>
                        <span>{{ course.studentCount }}人参与</span>
                      </div>
                    </div>
                    <div class="course-name">{{ course.name }}</div>
                    <el-progress
                      :percentage="course.avgProgress"
                      :stroke-width="5"
                      :show-text="false"
                      class="custom-progress"
                    />
                  </div>
                  <div
                    v-if="teacherStats.courseProgress.length === 0"
                    class="no-data-hint"
                  >
                    暂无授课数据
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="isAdmin">
              <div class="stats-header">
                <span class="title">智教大盘录</span>
                <span class="subtitle">PLATFORM OVERVIEW</span>
              </div>

              <div class="stats-grid">
                <div class="stat-item">
                  <div class="stat-label">本周活跃</div>
                  <div class="stat-value">
                    {{ adminStats.totalActivity || 0 }}
                  </div>
                </div>
                <div class="stat-item">
                  <div class="stat-label">全站效率</div>
                  <div class="stat-value highlight">
                    {{ adminStats.platformEfficiency || 0 }}%
                  </div>
                </div>
                <div class="stat-item">
                  <div class="stat-label">资源总量</div>
                  <div class="stat-value">
                    {{ adminStats.totalResources || 0 }}
                  </div>
                </div>
                <div class="stat-item">
                  <div class="stat-label">系统入驻</div>
                  <div class="stat-value date">
                    {{ adminStats.joinDate || "--" }}
                  </div>
                </div>
              </div>

              <div class="courses-section">
                <div class="section-title">平台教研活跃态势</div>
                <div class="efficiency-list teacher-activity-card">
                  <div
                    v-for="(item, index) in adminStats.teacherActivity"
                    :key="index"
                    class="efficiency-item polished"
                  >
                    <div class="eff-icon-box">
                      <el-icon
                        ><InfoFilled v-if="index === 0" /><Check
                          v-else-if="index === 3" /><Plus v-else
                      /></el-icon>
                    </div>
                    <div class="eff-content">
                      <span class="eff-name">{{ item.name }}</span>
                      <span class="eff-value"
                        >{{ item.value }}<small>{{ item.unit }}</small></span
                      >
                    </div>
                  </div>
                  <div
                    v-if="adminStats.teacherActivity.length === 0"
                    class="no-data-hint"
                  >
                    暂无统计数据
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="premium-footer">
          <el-button round @click="editProfileVisible = false">取消</el-button>
          <el-button
            type="primary"
            :loading="loading"
            round
            class="btn-gradient"
            @click="submitProfile"
            >保存同步</el-button
          >
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="changePasswordVisible"
      title="修改账户密码"
      width="460px"
      class="premium-dialog"
      align-center
    >
      <div class="dialog-inner-content">
        <div class="password-desc">
          <el-icon color="#E6A23C"><Lock /></el-icon>
          <span>为了您的账号安全，请定期修改密码并确保复杂度。</span>
        </div>
        <el-form
          ref="passwordFormRef"
          :model="passwordForm"
          :rules="passwordRules"
          label-position="top"
          class="beautified-form"
        >
          <el-form-item label="原密码" prop="oldPassword">
            <el-input
              v-model="passwordForm.oldPassword"
              type="password"
              show-password
              placeholder="请输入当前使用的密码"
            >
              <template #prefix>
                <el-icon><Lock /></el-icon>
              </template>
            </el-input>
          </el-form-item>
          <el-form-item label="新密码" prop="newPassword">
            <el-input
              v-model="passwordForm.newPassword"
              type="password"
              show-password
              placeholder="设个更强的密码吧 (最高70位)"
              maxlength="70"
            >
              <template #prefix>
                <el-icon><Key /></el-icon>
              </template>
            </el-input>
            <!-- 密码强度显示 -->
            <div class="strength-meter">
              <div class="strength-bars">
                <div
                  v-for="i in 4"
                  :key="i"
                  class="bar-item"
                  :class="{ active: passwordStrength >= i }"
                  :style="{
                    backgroundColor:
                      passwordStrength >= i
                        ? getStrengthInfo(passwordStrength).color
                        : ''
                  }"
                />
              </div>
              <div v-if="passwordStrength" class="strength-text">
                强度：<span
                  :style="{ color: getStrengthInfo(passwordStrength).color }"
                  >{{ getStrengthInfo(passwordStrength).text }}</span
                >
              </div>
            </div>
          </el-form-item>
          <el-form-item label="确认新密码" prop="confirmPassword">
            <el-input
              v-model="passwordForm.confirmPassword"
              type="password"
              show-password
              placeholder="请再次输入新密码"
            >
              <template #prefix>
                <el-icon><Check /></el-icon>
              </template>
            </el-input>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <div class="premium-footer">
          <el-button round @click="changePasswordVisible = false"
            >取消</el-button
          >
          <el-button
            type="primary"
            :loading="passwordLoading"
            round
            class="btn-gradient"
            @click="submitPassword"
            >立即更新密码</el-button
          >
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="cropperDialogVisible"
      title="裁剪头像"
      width="600px"
      class="cropper-dialog"
      append-to-body
      destroy-on-close
    >
      <div class="cropper-box">
        <ReCropper
          ref="cropperRef"
          :src="croppingImage"
          :options="{ aspectRatio: 1, viewMode: 1, guides: true }"
          height="400px"
        />
      </div>
      <template #footer>
        <div class="premium-footer">
          <el-button round @click="cropperDialogVisible = false"
            >取消</el-button
          >
          <el-button
            type="primary"
            round
            class="btn-gradient"
            @click="handleConfirmCrop"
            >确认裁剪并上传</el-button
          >
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss">
.premium-dialog {
  overflow: hidden;
  background-color: rgb(255 255 255 / 45%) !important;
  border: 1px solid rgb(255 255 255 / 50%) !important;
  border-radius: 24px !important;
  box-shadow: 0 40px 80px -12px rgb(0 0 0 / 25%) !important;
  backdrop-filter: blur(35px) saturate(200%);

  .el-dialog__header {
    padding: 24px 24px 0;
    margin-right: 0;

    .el-dialog__title {
      font-size: 22px;
      font-weight: 800;
      color: #1a202c;
      letter-spacing: 1px;
    }
  }

  .el-dialog__body {
    padding: 10px 20px;
  }
}

html.dark .premium-dialog {
  background-color: rgb(15 23 42 / 85%) !important;
  border: 1px solid rgb(255 255 255 / 15%) !important;

  .el-dialog__header {
    background: transparent !important;
  }

  .el-dialog__title {
    color: #f8fafc;
  }

  .el-dialog__body {
    background: transparent !important;
  }

  .el-dialog__footer {
    background: transparent !important;
  }
}

.premium-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 0 0 10px;

  .btn-gradient {
    padding-right: 25px;
    padding-left: 25px;
    font-weight: 600;
    background: linear-gradient(135deg, #4481eb 0%, #04befe 100%);
    border: none;
    transition: all 0.3s ease;

    &:hover {
      box-shadow: 0 10px 20px -5px rgb(68 129 235 / 50%);
      transform: translateY(-2px);
    }

    &:active {
      transform: translateY(0);
    }
  }
}
</style>

<style lang="scss" scoped>
.profile-layout-container {
  display: flex;
  flex-direction: column;
  gap: 20px;

  &.is-student-layout {
    flex-direction: row;
    align-items: stretch;
    justify-content: space-between;
    height: 430px; // 显式设置高度，确保左右对齐及触发滚动

    .id-card-side {
      display: flex;
      flex: 0 0 540px;
      flex-direction: column;
      height: 100%;
    }

    .extra-stats-side {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
      height: 100%;
      padding-left: 15px;
      overflow: hidden; // 确保内部滚动不溢出
    }
  }
}

.id-card-container {
  flex: 1;
  height: 100%;
  perspective: 1000px;
}

.id-card-main {
  position: relative;
  box-sizing: border-box;
  display: grid;
  grid-template-rows: auto 1fr auto;
  grid-template-columns: 130px 1fr;
  gap: 15px;
  width: 100%;
  height: 100%;
  padding: 20px;
  overflow: hidden;
  background: linear-gradient(
    135deg,
    rgb(255 255 255 / 70%) 0%,
    rgb(240 244 255 / 50%) 100%
  );
  border: 1px solid rgb(255 255 255 / 80%);
  border-radius: 16px;
  box-shadow: inset 0 0 20px rgb(255 255 255 / 50%);

  .card-brand {
    display: flex;
    flex-direction: column;
    grid-column: 2;
    align-items: flex-end;
    text-align: right;

    .brand-en {
      font-family: Impact, sans-serif;
      font-size: 24px;
      font-style: italic;
      font-weight: 900;
      line-height: 1;
      color: #3b82f6;
    }

    .brand-cn {
      margin-top: 2px;
      font-size: 14px;
      font-weight: 600;
      color: #64748b;
      letter-spacing: 4px;
    }
  }

  .card-avatar-section {
    display: flex;
    flex-direction: column;
    grid-row: 1 / 3;
    gap: 15px;
    align-items: center;

    .id-avatar-wrapper {
      position: relative;
      overflow: hidden;
      cursor: pointer;
      border: 3px solid #fff;
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgb(0 0 0 / 20%);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

      .id-avatar-img {
        display: block;
        border-radius: 8px;
      }

      .id-placeholder-avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 110px;
        height: 110px;
        font-size: 40px;
        color: #94a3b8;
        background: #f1f5f9;
      }

      .id-upload-mask {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        color: #fff;
        background: rgb(0 0 0 / 40%);
        opacity: 0;
        transition: opacity 0.3s;
      }

      &:hover {
        transform: scale(1.02);

        .id-upload-mask {
          opacity: 1;
        }
      }
    }

    .card-security-btn {
      display: flex;
      gap: 6px;
      align-items: center;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      color: #3b82f6;
      cursor: pointer;
      background: rgb(68 129 235 / 10%);
      border-radius: 20px;
      transition: all 0.3s ease;

      &:hover {
        color: #fff;
        background: #3b82f6;
        transform: translateY(-2px);
      }
    }
  }

  .card-info-form {
    display: flex;
    grid-row: 2;
    grid-column: 2;
    align-items: center;
    justify-content: flex-end;
    padding-left: 10px;

    .id-card-form-body {
      width: 100%;
      max-width: 380px;
    }

    .id-form-item {
      margin-bottom: 12px;

      :deep(.el-form-item__label) {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        height: 38px;
        padding-right: 12px;
        font-family: KaiTi, STKaiti, serif;
        font-size: 16px;
        font-weight: bold;
        color: #3b82f6;
      }

      :deep(.el-input__wrapper),
      .id-radio-box,
      :deep(.el-textarea__inner) {
        box-sizing: border-box;
        background: #fff !important;
        border: 1px solid rgb(68 129 235 / 10%) !important;
        border-radius: 8px !important;
        box-shadow: 0 2px 8px rgb(0 0 0 / 4%) !important;
        transition: all 0.3s ease;

        &:hover {
          border-color: #3b82f6 !important;
          box-shadow: 0 4px 12px rgb(68 129 235 / 10%) !important;
        }
      }

      :deep(.el-input__wrapper) {
        width: 100%;
        padding: 0 12px;
      }

      :deep(.el-input__inner) {
        height: 38px;
        font-family: "Microsoft YaHei", sans-serif;
        font-size: 16px;
        font-weight: 600;
        color: #1e293b;
      }

      .id-radio-box {
        display: flex;
        align-items: center;
        width: 100%;
        height: 38px;
        padding: 0 15px;
      }

      :deep(.el-textarea__inner) {
        height: 80px;
        padding: 8px 12px !important;
        font-family: inherit;
        font-size: 14px;
        font-weight: 500;
        line-height: 1.6;
        color: #64748b;
        resize: none;
        border: none !important;
      }
    }

    .id-radio-group {
      display: flex;
      justify-content: space-around;
      width: 100%;

      :deep(.el-radio) {
        margin-right: 0;

        .el-radio__label {
          font-size: 14px;
          font-weight: 600;
        }
      }
    }
  }

  .card-id-number {
    display: flex;
    flex-direction: column;
    grid-row: 3;
    grid-column: 1 / 3;
    margin-top: 2px;

    .label {
      margin-bottom: 2px;
      font-size: 10px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 2px;
    }

    .number {
      font-family: "Courier New", Courier, monospace;
      font-size: 30px;
      font-weight: 900;
      color: #1e293b;
      letter-spacing: 4px;
      background: linear-gradient(90deg, #1e293b 0%, #64748b 100%);
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }
  }
}

.extra-stats-container {
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
  padding: 18px;

  /* 增加底部内边距，确保最下面内容可完全滚出 */
  padding-bottom: 30px;
  overflow-y: auto; // 启用纵向滚动

  /* 隐藏滚动条但保留功能 */
  scrollbar-width: none;
  background: rgb(255 255 255 / 40%);
  border: 1px solid rgb(255 255 255 / 60%);
  border-radius: 20px;
  box-shadow: 0 15px 35px -10px rgb(0 0 0 / 5%);
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }

  .stats-header {
    display: flex;
    flex-shrink: 0;
    flex-direction: column;
    margin-bottom: 15px;

    .title {
      font-size: 16px;
      font-weight: 800;
      color: #1a202c;
      letter-spacing: 1px;
    }

    .subtitle {
      margin-top: 1px;
      font-size: 9px;
      color: #94a3b8;
      letter-spacing: 1.5px;
    }
  }

  .stats-grid {
    display: grid;
    flex-shrink: 0; // 防止头部被压缩导致无法滚动
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 20px;

    .stat-item {
      padding: 12px 10px;
      text-align: center;
      background: #fff;
      border: 1px solid rgb(68 129 235 / 5%);
      border-radius: 12px;
      box-shadow: 0 4px 10px rgb(0 0 0 / 2%);

      .stat-label {
        margin-bottom: 5px;
        font-size: 13px;
        font-weight: 600;
        color: #475569;
      }

      .stat-value {
        font-size: 17px;
        font-weight: 800;
        color: #1a202c;

        &.highlight {
          color: #f59e0b;
        }

        &.date {
          font-family: monospace;
          font-size: 12px;
        }
      }
    }
  }

  .courses-section {
    flex-shrink: 0; // 核心：防止容器内部被压缩，溢出父级触发滚动

    .section-title {
      display: flex;
      align-items: center;
      margin-bottom: 12px;
      font-size: 13px;
      font-weight: 700;
      color: #475569;

      &::before {
        width: 3px;
        height: 12px;
        margin-right: 6px;
        content: "";
        background: #3b82f6;
        border-radius: 10px;
      }
    }

    .course-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      padding-right: 4px;

      .course-mini-card {
        margin-bottom: 5px;

        .custom-progress-blue {
          margin-top: 4px;

          :deep(.el-progress-bar__outer) {
            background-color: rgb(68 129 235 / 10%) !important;
          }

          :deep(.el-progress-bar__inner) {
            background: linear-gradient(90deg, #3b82f6, #60a5fa) !important;
          }
        }

        .course-cover-wrapper {
          position: relative;
          aspect-ratio: 1.6 / 1;
          margin-bottom: 6px;
          overflow: hidden;
          background: #f1f5f9;
          border-radius: 8px;
          box-shadow: 0 4px 10px rgb(0 0 0 / 8%);

          // 增强教师端仪表盘样式权重，确保背景色生效
          &.teacher-dashboard-style {
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(
              135deg,
              #1e40af 0%,
              #3b82f6 100%
            ) !important;
            box-shadow: 0 10px 15px -3px rgb(30 64 175 / 30%);

            .dashboard-inner {
              z-index: 2;
              margin-top: -8px; /* 视觉补偿：向上微调以避开底部的 bubble，实现真正的“视觉中心” */
              text-align: center;

              .dashboard-stat {
                line-height: 1;
                color: #fff;
                text-shadow: 0 2px 4px rgb(0 0 0 / 30%);

                .num {
                  font-family: "DIN Alternate", sans-serif;
                  font-size: 30px;
                  font-weight: 900;
                }

                .unit {
                  margin-left: 2px;
                  font-size: 14px;
                  font-weight: 700;
                }
              }

              .dashboard-label {
                margin-top: 6px;
                font-size: 11px;
                font-weight: 800;
                color: #fff;
                text-transform: uppercase;
                letter-spacing: 1px;
                opacity: 0.9;
              }
            }

            .student-bubble {
              position: absolute;
              bottom: 10px;
              left: 50%;
              z-index: 2;
              display: flex;
              gap: 6px;
              align-items: center;
              padding: 4px 12px;
              font-size: 11px;
              font-weight: 700;
              color: #fff;
              background: rgb(255 255 255 / 15%);
              border: 1px solid rgb(255 255 255 / 20%);
              border-radius: 20px;
              box-shadow: 0 4px 6px rgb(0 0 0 / 10%);
              backdrop-filter: blur(12px);
              transform: translateX(-50%);
            }

            &::after {
              position: absolute;
              top: -10%;
              right: -5%;
              width: 80px;
              height: 80px;
              content: "";
              background: radial-gradient(
                circle,
                rgb(255 255 255 / 25%) 0%,
                transparent 70%
              );
              filter: blur(15px);
            }
          }

          .course-mini-cover {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .course-placeholder-cover {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
            font-size: 10px;
            color: #94a3b8;
          }

          .course-progress-badge {
            position: absolute;
            top: 4px;
            right: 4px;
            padding: 1px 4px;
            font-size: 9px;
            font-weight: 600;
            color: #fff;
            background: rgb(0 0 0 / 60%);
            border-radius: 20px;
            backdrop-filter: blur(4px);
          }
        }

        .course-name {
          margin-bottom: 3px;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 11px;
          font-weight: 600;
          color: #1e293b;
          white-space: nowrap;
        }

        .custom-progress {
          :deep(.el-progress-bar__inner) {
            background: var(--el-color-primary);
          }
        }
      }
    }
  }

  .teacher-activity-card {
    padding: 12px !important;
    background: rgb(255 255 255 / 40%);
    border-radius: 12px;
    backdrop-filter: blur(10px);

    .efficiency-item.polished {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 10px;
      margin-bottom: 10px;
      background: #fff;
      border-radius: 10px;
      box-shadow: 0 2px 6px rgb(0 0 0 / 5%);
      transition: all 0.3s ease;

      &:hover {
        box-shadow: 0 4px 12px rgb(0 0 0 / 10%);
        transform: translateX(5px);
      }

      .eff-icon-box {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        color: #4f46e5;
        background: #f0f4ff;
        border-radius: 8px;
      }

      .eff-content {
        display: flex;
        flex: 1;
        align-items: center;
        justify-content: space-between;

        .eff-name {
          font-size: 13px;
          font-weight: 700;
          color: #475569;
        }

        .eff-value {
          font-size: 16px;
          font-weight: 800;
          color: #1e293b;

          small {
            margin-left: 3px;
            font-size: 11px;
            font-weight: 600;
            color: #64748b;
          }
        }
      }
    }
  }

  .efficiency-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 200px;
    padding: 10px;
    overflow-y: auto;
    background: rgb(255 255 255 / 40%);
    border-radius: 12px;
  }

  .efficiency-item {
    display: flex;
    gap: 10px;
    align-items: center;
    font-size: 12px;
    line-height: 1.4;

    .eff-dot {
      flex-shrink: 0;
      width: 6px;
      height: 6px;
      background: #97b4f7;
      border-radius: 50%;
    }

    .eff-name {
      font-weight: 700;
      color: #475569;
      white-space: nowrap;
    }

    .eff-direction {
      color: #64748b;
    }
  }
}

.strength-meter {
  margin-top: 10px;

  .strength-bars {
    display: flex;
    gap: 4px;
    height: 4px;
    margin-bottom: 6px;

    .bar-item {
      flex: 1;
      height: 100%;
      background: #eee;
      border-radius: 2px;
      transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);

      &.active {
        transform: scaleY(1.2);
      }
    }
  }

  .strength-text {
    font-size: 12px;
    color: #94a3b8;

    span {
      font-weight: bold;
    }
  }
}

.no-data-hint {
  grid-column: 1 / -1;
  padding: 20px 0;
  font-size: 12px;
  color: #94a3b8;
  text-align: center;
}

html.dark {
  .id-card-main {
    background: linear-gradient(
      135deg,
      rgb(30 41 59 / 80%) 0%,
      rgb(15 23 42 / 60%) 100%
    );
    border-color: rgb(255 255 255 / 10%);
    box-shadow: inset 0 0 20px rgb(0 0 0 / 30%);

    .card-brand .brand-cn {
      color: #94a3b8;
    }

    .id-avatar-wrapper {
      border-color: rgb(255 255 255 / 10%);

      .id-placeholder-avatar {
        color: #475569;
        background: #1e293b;
      }
    }

    .card-info-form .id-form-item {
      :deep(.el-input__wrapper),
      .id-radio-box,
      :deep(.el-textarea__inner) {
        background: rgb(15 23 42 / 80%) !important;
        border-color: rgb(255 255 255 / 10%) !important;
        box-shadow: 0 2px 8px rgb(0 0 0 / 20%) !important;
      }

      :deep(.el-input__inner) {
        color: #f8fafc !important;
      }

      :deep(.el-textarea__inner) {
        color: #cbd5e1 !important;
      }

      .id-radio-group :deep(.el-radio__label) {
        color: #94a3b8;
      }

      .id-radio-group :deep(.is-checked .el-radio__label) {
        color: #3b82f6;
      }
    }

    .card-id-number .number {
      background: linear-gradient(90deg, #f8fafc 0%, #64748b 100%);
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }
  }

  .extra-stats-container {
    background: rgb(15 23 42 / 40%);
    border-color: rgb(255 255 255 / 5%);

    .stats-header .title {
      color: #f8fafc;
    }

    .stats-grid .stat-item {
      background: rgb(30 41 59 / 70%);
      border-color: rgb(255 255 255 / 5%);
      box-shadow: 0 4px 12px rgb(0 0 0 / 15%);

      .stat-value {
        color: #f8fafc;
      }

      .stat-label {
        color: #64748b;
      }
    }

    .courses-section {
      .section-title {
        color: #cbd5e1;
      }

      .course-grid .course-mini-card {
        .course-cover-wrapper {
          background: #1e293b;
          box-shadow: 0 4px 12px rgb(0 0 0 / 20%);

          &.teacher-dashboard-style {
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(
              135deg,
              #020617 0%,
              #1e3a8a 100%
            ) !important;
            border: 1px solid rgb(255 255 255 / 10%);

            .dashboard-inner {
              margin-top: -8px;

              .dashboard-label {
                font-weight: 800;
                color: #60a5fa;
                opacity: 1;
              }

              .num {
                color: #fff;
                text-shadow: 0 0 10px rgb(96 165 250 / 50%);
              }
            }

            .student-bubble {
              color: #fff;
              background: rgb(255 255 255 / 10%);
              border-color: rgb(255 255 255 / 20%);
            }
          }
        }

        .course-name {
          color: #f8fafc;
        }
      }

      .teacher-activity-card {
        background: rgb(0 0 0 / 20%);

        .efficiency-item.polished {
          background: rgb(30 41 59 / 80%) !important;

          .eff-icon-box {
            color: #818cf8;
            background: #1e293b;
          }

          .eff-content .eff-name {
            color: #94a3b8;
          }

          .eff-content .eff-value {
            color: #f8fafc;
          }
        }
      }

      .efficiency-list {
        background: rgb(0 0 0 / 20%);
      }
    }
  }

  .strength-meter .bar-item {
    background: #1e293b !important;
  }

  .password-desc {
    color: #e6a23c;
    background: rgb(230 162 60 / 10%);
    border-color: rgb(230 162 60 / 20%);
  }

  .beautified-form {
    :deep(.el-form-item__label) {
      color: #cbd5e1;
    }

    :deep(.el-input__wrapper) {
      background-color: #0f172a;
      border-color: #1e293b;

      .el-input__inner {
        color: #f8fafc;
      }
    }
  }
}

.password-desc {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 12px 16px;
  margin-bottom: 24px;
  font-size: 13px;
  color: #856404;
  background: #fff9e6;
  border: 1px solid #ffeeba;
  border-radius: 12px;
}

.beautified-form {
  :deep(.el-form-item__label) {
    font-weight: 600;
    color: #4b5563;
  }

  :deep(.el-input__wrapper) {
    background-color: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    box-shadow: none !important;
  }
}

.cropper-box {
  overflow: hidden;
  background: #000;
  border-radius: 12px;
}

@media (max-width: 767px) {
  .id-card-dialog.premium-dialog {
    width: min(560px, calc(100vw - 24px)) !important;
    max-height: calc(var(--qiming-native-vh, 100dvh) - 24px);
    margin: 12px auto !important;
    overflow: hidden;
    border-radius: 24px !important;

    .el-dialog__header {
      padding: 18px 18px 8px;
    }

    .el-dialog__title {
      font-size: 22px;
      line-height: 1.2;
    }

    .el-dialog__body {
      max-height: calc(var(--qiming-native-vh, 100dvh) - 138px);
      padding: 8px 12px 12px !important;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }

    .el-dialog__footer {
      padding: 10px 16px 16px;
    }
  }

  .profile-layout-container.is-student-layout {
    flex-direction: column;
    gap: 14px;
    height: auto;
    min-height: 0;

    .id-card-side,
    .extra-stats-side {
      flex: none;
      width: 100%;
      height: auto;
      padding-left: 0;
      overflow: visible;
    }
  }

  .id-card-container {
    height: auto;
  }

  .id-card-main {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-height: 0;
    padding: 16px;
    border-radius: 20px;

    .card-brand {
      order: 1;
      align-items: flex-start;
      text-align: left;
    }

    .card-avatar-section {
      order: 2;
      flex-direction: row;
      gap: 14px;
      align-items: center;

      .id-avatar-wrapper {
        flex: 0 0 auto;
      }

      :deep(.el-avatar),
      .id-placeholder-avatar {
        width: 88px !important;
        height: 88px !important;
      }

      .card-security-btn {
        min-height: 36px;
        padding: 8px 12px;
        white-space: nowrap;
      }
    }

    .card-info-form {
      order: 3;
      justify-content: stretch;
      padding-left: 0;

      .id-card-form-body {
        max-width: none;
      }

      .id-form-item {
        display: block;
        margin-bottom: 14px;

        :deep(.el-form-item__label) {
          justify-content: flex-start;
          width: auto !important;
          height: auto;
          padding-right: 0;
          margin-bottom: 7px;
          font-family: inherit;
          font-size: 14px;
          line-height: 1.3;
        }

        :deep(.el-form-item__content) {
          width: 100%;
          margin-left: 0 !important;
        }
      }
    }

    .card-id-number {
      order: 4;

      .number {
        overflow-wrap: anywhere;
        font-size: clamp(20px, 8vw, 30px);
        letter-spacing: 0.12em;
      }
    }
  }

  .extra-stats-container {
    height: auto;
    max-height: none;
    padding: 16px;
    overflow: visible;
    border-radius: 20px;

    .stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .courses-section .course-grid {
      grid-template-columns: 1fr;
    }
  }

  .premium-footer {
    display: flex;
    gap: 10px;
    justify-content: flex-end;

    .el-button {
      min-height: 40px;
      padding: 0 18px;
    }
  }
}

@media (max-width: 379px) {
  .id-card-main {
    padding: 14px;

    .card-avatar-section {
      align-items: flex-start;
      flex-direction: column;
    }
  }

  .extra-stats-container .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
