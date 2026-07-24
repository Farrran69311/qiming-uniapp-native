import { http } from "@/utils/http";
import { adaptUserDetailToMine } from "./mobileApiAdapters";

export type UserResult = {
  success: boolean;
  data: {
    /** 头像 */
    avatar: string;
    /** 用户名 */
    username: string;
    /** 昵称 */
    nickname: string;
    /** 当前登录用户的角色 */
    roles: Array<string>;
    /** 按钮级别权限 */
    permissions: Array<string>;
    /** `token` */
    accessToken: string;
    /** 用于调用刷新`accessToken`的接口时所需的`token` */
    refreshToken: string;
    /** `accessToken`的过期时间（格式'xxxx/xx/xx xx:xx:xx'） */
    expires: Date;
  };
};

export type RefreshTokenResult = {
  success: boolean;
  data: {
    /** `token` */
    accessToken: string;
    /** 用于调用刷新`accessToken`的接口时所需的`token` */
    refreshToken: string;
    /** `accessToken`的过期时间（格式'xxxx/xx/xx xx:xx:xx'） */
    expires: Date;
  };
};

export type UserInfo = {
  /** 头像 */
  avatar: string;
  /** 用户名 */
  username: string;
  /** 昵称 */
  nickname: string;
  /** 邮箱 */
  email: string;
  /** 联系电话 */
  phone: string;
  /** 简介 */
  description: string;
  /** 性别，更新资料时必须原样回传，避免后端按缺省值覆盖 */
  sex: number;
};

export type UserInfoResult = {
  success: boolean;
  data: UserInfo;
};

export type UserCenterLoginResult = {
  code: number;
  msg: string;
  data: {
    accessToken: string;
    accessExpire: number;
    refreshAfter: number;
  };
};

export type UserCenterDetailResult = {
  code: number;
  msg: string;
  data: {
    userInfo: {
      id: number;
      mobile: string;
      nickname: string;
      sex: number;
      avatar: string;
      info: string;
      roleType: number;
      bannerUrl: string;
    };
  };
};

export type UploadResult = {
  code: number;
  msg: string;
  data: {
    url: string;
    fileId: number;
  };
};

export type StsUploadInitRequest = {
  biz_type: string;
  file_name: string;
  content_type: string;
  file_size: number;
  course_id?: number;
};

export type StsUploadCredentials = {
  tmp_secret_id?: string;
  tmp_secret_key?: string;
  security_token?: string;
  tmpSecretId?: string;
  tmpSecretKey?: string;
  securityToken?: string;
  bucket?: string;
  region?: string;
};

export type StsUploadInitResult = {
  code: number;
  msg: string;
  data: {
    upload_token?: string;
    uploadToken?: string;
    object_key?: string;
    objectKey?: string;
    upload_url?: string;
    uploadUrl?: string;
    credentials?: StsUploadCredentials;
  };
};

export type StsUploadCompleteRequest = {
  upload_token: string;
};

export type StsUploadCompleteResult = {
  code: number;
  msg: string;
  data: {
    fileId?: number;
    file_id?: number;
    url: string;
    objectKey?: string;
    object_key?: string;
  };
};

export type FileResource = {
  fileId: number;
  fileUrl: string;
  fileName: string;
  extension: string;
  size: number;
  resourceType: string;
};

export type FileListPayload = {
  total: number;
  fileList: FileResource[];
};

export type FileListResult = {
  code?: number;
  msg?: string;
  total?: number;
  fileList?: FileResource[];
  data?: {
    total?: number;
    fileList?: FileResource[];
  };
};

export type UserListResult = {
  total: number;
  userList: Array<{
    id: number;
    mobile: string;
    nickname: string;
    sex: number;
    avatar: string;
    info: string;
    roleType: number;
  }>;
  data?: {
    total?: number;
    userList?: Array<{
      id: number;
      mobile: string;
      nickname: string;
      sex: number;
      avatar: string;
      info: string;
      roleType: number;
    }>;
  };
};

/** 登录 */
export const getLogin = (data?: object) => {
  return http.request<UserResult>("post", "/login", { data });
};

/** 刷新`token` */
export const refreshTokenApi = (data?: object) => {
  return http.request<RefreshTokenResult>("post", "/refresh-token", { data });
};

// 新增用户中心接口

/** 用户注册 */
export const userRegister = (data: { mobile: string; password: string }) => {
  return http.request<UserCenterLoginResult>("post", "/edu/v1/user/register", {
    data
  });
};

/** 用户登录 */
export const userLogin = (data: { mobile: string; password: string }) => {
  return http.request<UserCenterLoginResult>("post", "/edu/v1/user/login", {
    data
  });
};

/** 获取用户信息 */
export const getUserDetail = () => {
  return http.request<UserCenterDetailResult>(
    "post",
    "/edu/v1/user/detail",
    {}
  );
};

/**
 * 账户设置-个人信息
 *
 * The legacy `/mine` endpoint is not part of the current user-center API.
 * Keep the old response shape for existing account-settings consumers while
 * sourcing the data from the canonical user-detail endpoint.
 */
export const getMine = (_data?: object): Promise<UserInfoResult> => {
  return getUserDetail().then(response => {
    const user = response?.data?.userInfo;
    if ((response?.code !== 0 && response?.code !== 200) || !user) {
      throw new Error(response?.msg || "个人资料暂时无法加载");
    }

    const adapted = adaptUserDetailToMine(response);
    return {
      ...adapted,
      success: true,
      data: {
        ...adapted.data,
        nickname: user.nickname || user.mobile || "",
        sex: Number(user.sex ?? 0)
      }
    };
  });
};

/** 文件上传 */
export const uploadFile = (data: FormData) => {
  return http.request<UploadResult>(
    "post",
    "/edu/v1/user/upload",
    { data },
    {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    }
  );
};

/** STS 初始化上传 */
export const initStsUpload = (data: StsUploadInitRequest) => {
  return http.request<StsUploadInitResult>(
    "post",
    "/edu/v1/user/upload/sts/init",
    {
      data
    }
  );
};

/** STS 完成上传 */
export const completeStsUpload = (data: StsUploadCompleteRequest) => {
  return http.request<StsUploadCompleteResult>(
    "post",
    "/edu/v1/user/upload/sts/complete",
    { data }
  );
};

/** 获取文件列表 */
export const getFileList = (params: { pageNum: number; pageSize?: number }) => {
  return http.request<FileListResult>("get", "/edu/backend/v1/user/file/list", {
    params
  });
};

/** 获取用户列表 */
export const getUserList = (params: {
  pageNum: number;
  pageSize?: number;
  mobile?: string;
}) => {
  return http.request<UserListResult>("get", "/edu/backend/v1/user/list", {
    params
  });
};

/** 修改用户角色 */
export const updateUserRole = (data: {
  targetUserId: number;
  roleType: number;
}) => {
  return http.request<{ code: number; msg: string; data: any }>(
    "post",
    "/edu/backend/v1/user/update/role",
    { data }
  );
};

/** 学生学习统计数据类型 */
export type StudentStatsResult = {
  code: number;
  msg: string;
  data: {
    /** 入驻日期 */
    joinDate: string;
    /** 作业均分 */
    avgScore: number | string;
    /** 个性签名（可选，部分接口返回） */
    signature?: string;
    info?: string;
  };
};

/** 获取学生学习统计数据（入驻日期、作业均分等） */
export const getStudentStats = () => {
  return http.request<StudentStatsResult>(
    "get",
    "/edu/frontend/v1/user/study",
    {}
  );
};

export type UserStatusResult = {
  code: number;
  msg: string;
  data: {
    /** 累计学时 */
    totalHours?: number;
    /** 总体进度（百分比或小数，前端做归一化） */
    totalProgress?: number;
    /** 兜底签名字段（如后端返回） */
    signature?: string;
    info?: string;
  };
};

/** 获取学生状态数据（累计学时、总体进度等） */
export const getUserStatus = () => {
  return http.request<UserStatusResult>(
    "get",
    "/edu/frontend/v1/user/status",
    {}
  );
};

/** 学习动态数据类型 */
export type UserActivity = {
  id: number;
  content: string;
  timestamp: string;
  type: "success" | "primary" | "warning" | "info" | "danger";
  iconName: string;
};

export type UserActivitiesResult = {
  code: number;
  msg: string;
  data: {
    list: Array<UserActivity>;
  };
};

/** 获取学习动态列表 */
export const getUserActivities = () => {
  return http.request<UserActivitiesResult>(
    "get",
    "/edu/frontend/v1/user/activities",
    {}
  );
};
