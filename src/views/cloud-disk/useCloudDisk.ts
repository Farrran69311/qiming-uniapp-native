import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { getFileList, uploadFile } from "@/api/user";
import { downloadPlatformResource } from "@/components/PlatformResourcePreview/resource-preview";
import { copyPlatformText, openPlatformUrl } from "@/utils/platformCapability";
import {
  getCloudDiskErrorMessage,
  normalizeCloudDiskPage,
  normalizeCloudDiskUpload,
  resolveCloudDiskFileUrl,
  type CloudDiskFile
} from "./cloudDiskRuntime";

export const CLOUD_DISK_DELETE_UNAVAILABLE =
  "文件服务尚未提供删除接口，删除功能当前不可用。";

const getCloudDiskURLBase = () => {
  const configuredBase = String(import.meta.env.VITE_API_URL || "").trim();
  const browserOrigin =
    typeof window !== "undefined" ? window.location.origin : "";

  try {
    if (configuredBase) {
      return new URL(configuredBase, browserOrigin || undefined).toString();
    }
    return browserOrigin ? new URL(browserOrigin).toString() : undefined;
  } catch {
    return browserOrigin.startsWith("http") ? browserOrigin : undefined;
  }
};

export const useCloudDisk = () => {
  const files = ref<CloudDiskFile[]>([]);
  const total = ref(0);
  const pageNum = ref(1);
  const pageSize = 20;
  const searchQuery = ref("");
  const loading = ref(false);
  const uploading = ref(false);
  const loadError = ref("");
  let requestVersion = 0;

  const filteredFiles = computed(() => {
    const keyword = searchQuery.value.trim().toLocaleLowerCase();
    if (!keyword) return files.value;
    return files.value.filter(file =>
      file.name.toLocaleLowerCase().includes(keyword)
    );
  });

  const loadFiles = async (nextPage = pageNum.value) => {
    const currentRequest = ++requestVersion;
    loading.value = true;
    loadError.value = "";

    try {
      const response = await getFileList({ pageNum: nextPage, pageSize });
      const page = normalizeCloudDiskPage(response);
      if (currentRequest !== requestVersion) return false;

      pageNum.value = nextPage;
      files.value = page.files;
      total.value = page.total;
      return true;
    } catch (error) {
      if (currentRequest !== requestVersion) return false;

      files.value = [];
      total.value = 0;
      loadError.value = getCloudDiskErrorMessage(
        error,
        "文件列表暂时无法加载，请稍后重试。"
      );
      return false;
    } finally {
      if (currentRequest === requestVersion) loading.value = false;
    }
  };

  const uploadCloudFile = async (file: File) => {
    if (!file || uploading.value) return false;

    uploading.value = true;
    try {
      const formData = new FormData();
      formData.append("file", file, file.name);
      const response = await uploadFile(formData);
      normalizeCloudDiskUpload(response);

      const refreshed = await loadFiles(1);
      if (refreshed) {
        ElMessage.success(`文件“${file.name}”上传成功`);
      } else {
        ElMessage.warning("文件已上传，但列表刷新失败，请稍后重试。");
      }
      return true;
    } catch (error) {
      ElMessage.error(
        getCloudDiskErrorMessage(error, "文件上传失败，请稍后重试。")
      );
      return false;
    } finally {
      uploading.value = false;
    }
  };

  const getSafeFileUrl = (file: CloudDiskFile) =>
    resolveCloudDiskFileUrl(file.url, getCloudDiskURLBase());

  const openCloudFile = (file: CloudDiskFile) => {
    const safeUrl = getSafeFileUrl(file);
    if (!safeUrl) {
      ElMessage.warning("文件地址无效或使用了不受支持的协议");
      return;
    }
    if (!openPlatformUrl(safeUrl).opened) {
      ElMessage.warning("当前环境无法打开该文件");
    }
  };

  const downloadCloudFile = async (file: CloudDiskFile) => {
    const safeUrl = getSafeFileUrl(file);
    if (!safeUrl) {
      ElMessage.warning("下载地址无效或使用了不受支持的协议");
      return;
    }

    try {
      await downloadPlatformResource({
        title: file.name,
        url: safeUrl,
        downloadUrl: safeUrl
      });
    } catch {
      ElMessage.error("文件下载失败，请稍后重试");
    }
  };

  const shareCloudFile = async (file: CloudDiskFile) => {
    const safeUrl = getSafeFileUrl(file);
    if (!safeUrl) {
      ElMessage.warning("分享地址无效或使用了不受支持的协议");
      return;
    }
    if (await copyPlatformText(safeUrl)) {
      ElMessage.success("分享链接已复制");
    } else {
      ElMessage.error("分享链接复制失败");
    }
  };

  onMounted(() => {
    void loadFiles();
  });

  return {
    files,
    filteredFiles,
    total,
    pageNum,
    pageSize,
    searchQuery,
    loading,
    uploading,
    loadError,
    loadFiles,
    uploadCloudFile,
    openCloudFile,
    downloadCloudFile,
    shareCloudFile
  };
};
