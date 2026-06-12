<template>
  <div class="cloud-disk-container" :class="currentTheme">
    <div class="disk-header">
      <div class="disk-heading">
        <div class="disk-title">
          <div class="title-icon">
            <CloudIcon />
          </div>
          <span>学习云盘</span>
        </div>
        <p class="disk-subtitle">整理课程资料、课件与个人学习文件</p>
      </div>
      <div class="actions">
        <el-input
          v-model="searchQuery"
          placeholder="搜索您的文件"
          :prefix-icon="Search"
          clearable
          class="search-input"
        />
        <button class="upload-btn" @click="handleUpload">
          <el-icon><Upload /></el-icon>
          <span>上传文件</span>
        </button>
      </div>
    </div>

    <template v-if="isMobile">
      <div class="mobile-file-list">
        <div
          v-for="file in filteredFiles"
          :key="file.id"
          class="mobile-file-card"
        >
          <div class="mobile-file-main">
            <div class="file-icon-wrap" :class="`icon-${file.type}`">
              <el-icon :size="18">
                <component :is="getFileIcon(file.type)" />
              </el-icon>
            </div>
            <div class="mobile-file-body">
              <div class="mobile-file-name">{{ file.name }}</div>
              <div class="mobile-file-meta">
                <span>{{ file.size }}</span>
                <span>{{ file.date }}</span>
              </div>
            </div>
          </div>
          <div class="mobile-file-actions">
            <button
              class="action-link primary"
              @click.stop="handleDownload(file)"
            >
              下载
            </button>
            <button class="action-link primary" @click.stop="handleShare(file)">
              分享
            </button>
            <button class="action-link danger" @click.stop="handleDelete(file)">
              删除
            </button>
          </div>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="file-list-header">
        <span class="col-name">文件名</span>
        <span class="col-size">大小</span>
        <span class="col-date">修改日期</span>
        <span class="col-action">操作</span>
      </div>
      <div class="file-list-body">
        <div v-for="file in filteredFiles" :key="file.id" class="file-row">
          <div class="col-name">
            <div class="file-icon-wrap" :class="`icon-${file.type}`">
              <el-icon :size="18">
                <component :is="getFileIcon(file.type)" />
              </el-icon>
            </div>
            <span class="file-name-text">{{ file.name }}</span>
          </div>
          <span class="col-size">{{ file.size }}</span>
          <span class="col-date">{{ file.date }}</span>
          <div class="col-action">
            <button
              class="action-link primary"
              @click.stop="handleDownload(file)"
            >
              下载
            </button>
            <button class="action-link primary" @click.stop="handleShare(file)">
              分享
            </button>
            <button class="action-link danger" @click.stop="handleDelete(file)">
              删除
            </button>
          </div>
        </div>
      </div>
    </template>

    <div v-if="filteredFiles.length === 0 && !loading" class="empty-state">
      <el-empty description="没有找到文件或文件夹为空" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { usePageResponsive } from "@/utils/pageResponsive";
import {
  Upload,
  Search,
  Folder,
  Document,
  Picture as PictureIcon,
  VideoCamera,
  Headset
} from "@element-plus/icons-vue";
import CloudIcon from "@/new student interface icons/file-svgrepo-com.svg?component";

defineProps<{
  currentTheme?: string;
}>();

const { isMobile } = usePageResponsive();

// 文件类型定义
type FileType = "folder" | "doc" | "image" | "video" | "audio" | "other";

// 文件接口
interface CloudFile {
  id: number;
  name: string;
  type: FileType;
  size: string;
  date: string;
  url?: string; // 下载地址
}

const searchQuery = ref("");
const loading = ref(false);

const files = ref<CloudFile[]>([
  {
    id: 1,
    name: "2024年12月六级真题（第一套）-听力音频.mp3",
    type: "audio",
    size: "19.9 MB",
    date: "2025-07-18 15:21",
    url: "https://aiedu-api.intelledu.cn/files/xi28g985hsr1hlnpeycv45whrk311frr45vb55dfalp8v/2024%E5%B9%B412%E6%9C%88%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98%EF%BC%88%E7%AC%AC%E4%B8%80%E5%A5%97%EF%BC%89-%E5%90%AC%E5%8A%9B%E9%9F%B3%E9%A2%91.mp3"
  },
  {
    id: 2,
    name: "2024年12月六级真题（第一套）.pdf",
    type: "doc",
    size: "1.1 MB",
    date: "2025-07-18 12:34",
    url: "https://aiedu-api.intelledu.cn/files/xi28g985hsr1hlnpeycv45whrk311frr45vb55dfalp8v/2024%E5%B9%B412%E6%9C%88%E5%85%AD%E7%BA%A7%E7%9C%9F%E9%A2%98%EF%BC%88%E7%AC%AC%E4%B8%80%E5%A5%97%EF%BC%89.pdf"
  },
  {
    id: 3,
    name: "同济版高等数学-1.pdf",
    type: "doc",
    size: "73.1 MB",
    date: "2025-07-17 09:12",
    url: "https://aiedu-api.intelledu.cn/files/xi28g985hsr1hlnpeycv45whrk311frr45vb55dfalp8v/%E5%90%8C%E6%B5%8E%E7%89%88%E9%AB%98%E7%AD%89%E6%95%B0%E5%AD%A6-1.pdf"
  },
  {
    id: 4,
    name: "大学普通化学电子书.pdf",
    type: "doc",
    size: "9.8 MB",
    date: "2025-07-16 20:00",
    url: "https://aiedu-api.intelledu.cn/files/xi28g985hsr1hlnpeycv45whrk311frr45vb55dfalp8v/%E5%A4%A7%E5%AD%A6%E6%99%AE%E9%80%9A%E5%8C%96%E5%AD%A6%E7%94%B5%E5%AD%90%E4%B9%A6.pdf"
  },
  {
    id: 5,
    name: "大学普通物理电子书.pdf",
    type: "doc",
    size: "59.1 MB",
    date: "2025-07-15 11:05",
    url: "https://aiedu-api.intelledu.cn/files/xi28g985hsr1hlnpeycv45whrk311frr45vb55dfalp8v/%E5%A4%A7%E5%AD%A6%E6%99%AE%E9%80%9A%E7%89%A9%E7%90%86%E7%94%B5%E5%AD%90%E4%B9%A6.pdf"
  },
  {
    id: 6,
    name: "大学语文第一节.pptx",
    type: "doc",
    size: "458 KB",
    date: "2025-07-14 18:20",
    url: "https://aiedu-api.intelledu.cn/files/xi28g985hsr1hlnpeycv45whrk311frr45vb55dfalp8v/%E5%A4%A7%E5%AD%A6%E8%AF%AD%E6%96%87%E7%AC%AC%E4%B8%80%E8%8A%82.pptx"
  },
  {
    id: 7,
    name: "嵌入式Linux开发实践教程第一节.pptx",
    type: "doc",
    size: "1021 KB",
    date: "2025-07-13 14:00",
    url: "https://aiedu-api.intelledu.cn/files/xi28g985hsr1hlnpeycv45whrk311frr45vb55dfalp8v/%E5%B5%8C%E5%85%A5%E5%BC%8FLinux%E5%BC%80%E5%8F%91%E5%AE%9E%E8%B7%B5%E6%95%99%E7%A8%8B%E7%AC%AC%E4%B8%80%E8%8A%82.pptx"
  },
  {
    id: 8,
    name: "开展第二学期选修课的通知.docx",
    type: "doc",
    size: "5.9 MB",
    date: "2025-07-15 17:04",
    url: "https://aiedu-api.intelledu.cn/files/xi28g985hsr1hlnpeycv45whrk311frr45vb55dfalp8v/%E5%BC%80%E5%B1%95%E7%AC%AC%E4%BA%8C%E5%AD%A6%E6%9C%9F%E9%80%89%E4%BF%AE%E8%AF%BE%E7%9A%84%E9%80%9A%E7%9F%A5.docx"
  },
  {
    id: 9,
    name: "形势与政策课程报告.docx",
    type: "doc",
    size: "5.9 MB",
    date: "2025-07-11 12:22",
    url: "https://aiedu-api.intelledu.cn/files/xi28g985hsr1hlnpeycv45whrk311frr45vb55dfalp8v/%E5%BD%A2%E5%8A%BF%E4%B8%8E%E6%94%BF%E7%AD%96%E8%AF%BE%E7%A8%8B%E6%8A%A5%E5%91%8A.docx"
  },
  {
    id: 10,
    name: "数字电路-设计01.ms14",
    type: "image",
    size: "98 KB",
    date: "2025-07-14 09:37",
    url: "https://aiedu-api.intelledu.cn/files/xi28g985hsr1hlnpeycv45whrk311frr45vb55dfalp8v/%E6%95%B0%E5%AD%97%E7%94%B5%E8%B7%AF-%E8%AE%BE%E8%AE%A101.ms14"
  },
  {
    id: 11,
    name: "数字电路-课程设计指导书.pdf",
    type: "doc",
    size: "113 KB",
    date: "2025-07-13 11:55",
    url: "https://aiedu-api.intelledu.cn/files/xi28g985hsr1hlnpeycv45whrk311frr45vb55dfalp8v/%E6%95%B0%E5%AD%97%E7%94%B5%E8%B7%AF-%E8%AF%BE%E7%A8%8B%E8%AE%BE%E8%AE%A1%E6%8C%87%E5%AF%BC%E4%B9%A6.pdf"
  },
  {
    id: 12,
    name: "有关于开展“校园AI绘画大赛”的通知.docx",
    type: "doc",
    size: "2.9 MB",
    date: "2025-07-12 14:48",
    url: "https://aiedu-api.intelledu.cn/files/xi28g985hsr1hlnpeycv45whrk311frr45vb55dfalp8v/%E6%9C%89%E5%85%B3%E4%BA%8E%E5%BC%80%E5%B1%95%E2%80%9C%E6%A0%A1%E5%9B%ADAI%E7%BB%98%E7%94%BB%E5%A4%A7%E8%B5%9B%E2%80%9D%E7%9A%84%E9%80%9A%E7%9F%A5.docx"
  },
  {
    id: 13,
    name: "计算机组成原理.pdf",
    type: "doc",
    size: "19.7 MB",
    date: "2025-07-12 12:50",
    url: "https://aiedu-api.intelledu.cn/files/xi28g985hsr1hlnpeycv45whrk311frr45vb55dfalp8v/%E8%AE%A1%E7%AE%97%E6%9C%BA%E7%BB%84%E6%88%90%E5%8E%9F%E7%90%86.pdf"
  },
  {
    id: 14,
    name: "美育课程专项-漫画艺术赏析.pptx",
    type: "doc",
    size: "6.5 MB",
    date: "2025-07-15 16:50",
    url: "https://aiedu-api.intelledu.cn/files/xi28g985hsr1hlnpeycv45whrk311frr45vb55dfalp8v/%E7%BE%8E%E8%82%B2%E8%AF%BE%E7%A8%8B%E4%B8%93%E9%A1%B9-%E6%BC%AB%E7%94%BB%E8%89%BA%E6%9C%AF%E8%B5%8F%E6%9E%90.pptx"
  }
]);

// 根据搜索查询过滤文件
const filteredFiles = computed(() => {
  if (!searchQuery.value) {
    return files.value;
  }
  return files.value.filter(file =>
    file.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  );
});

// 根据文件类型获取图标
const getFileIcon = (type: FileType) => {
  switch (type) {
    case "folder":
      return Folder;
    case "doc":
      return Document;
    case "image":
      return PictureIcon;
    case "video":
      return VideoCamera;
    case "audio":
      return Headset;
    default:
      return Document;
  }
};

// 模拟上传
const handleUpload = () => {
  ElMessage.info("管理员已停用上传");
};

const openNativeExternalUrl = (url?: string) => {
  if (!url || url === "#") return false;
  const plusApi = (window as any).plus;
  const isNativeWebView = document.documentElement.classList.contains(
    "qiming-native-webview"
  );
  if (!isNativeWebView || !plusApi?.runtime?.openURL) return false;
  try {
    plusApi.runtime.openURL(url);
    return true;
  } catch (error) {
    console.warn("Native openURL failed:", error);
    return false;
  }
};

const isNativeWebView = () =>
  document.documentElement.classList.contains("qiming-native-webview");

const copyDownloadUrl = (url: string) => {
  const writePromise = navigator.clipboard?.writeText?.(url);
  if (!writePromise) {
    ElMessage.info("当前 App 暂不支持直接下载，请稍后在浏览器打开");
    return;
  }

  writePromise
    .then(() => {
      ElMessage.success("下载链接已复制，请在浏览器中打开");
    })
    .catch(() => {
      ElMessage.info("当前 App 暂不支持直接下载，请稍后在浏览器打开");
    });
};

// 模拟下载
const handleDownload = (file: CloudFile) => {
  if (file.type === "folder") {
    ElMessage.warning("文件夹不能直接下载");
    return;
  }
  if (!file.url || file.url === "#") {
    ElMessage.warning("该文件没有可用的下载链接");
    return;
  }
  ElMessage.success(`开始下载文件: ${file.name}`);
  if (openNativeExternalUrl(file.url)) return;
  if (isNativeWebView()) {
    copyDownloadUrl(file.url);
    return;
  }
  window.open(file.url, "_blank", "noopener,noreferrer");
};

// 文件分享
const handleShare = (file: CloudFile) => {
  if (file.url && file.url !== "#") {
    navigator.clipboard
      .writeText(file.url)
      .then(() => {
        ElMessage.success("分享链接已复制到剪贴板");
      })
      .catch(err => {
        ElMessage.error("复制分享链接失败");
        console.error("Failed to copy: ", err);
      });
  } else {
    ElMessage.warning("该文件没有可用的分享链接");
  }
};

// 模拟删除
const handleDelete = (file: CloudFile) => {
  ElMessageBox.confirm(
    `确定要删除 "${file.name}" 吗？此操作不可恢复。`,
    "警告",
    {
      confirmButtonText: "删除",
      cancelButtonText: "取消",
      type: "warning"
    }
  )
    .then(() => {
      files.value = files.value.filter(f => f.id !== file.id);
      ElMessage.success(`文件 "${file.name}" 已删除`);
    })
    .catch(() => {
      // 用户取消
    });
};
</script>

<style lang="scss" scoped>
.cloud-disk-container {
  box-sizing: border-box;
  width: calc(100% - 2px);
  min-width: 0;
  max-width: 100%;
  padding: 24px;
  overflow: hidden;
  background: linear-gradient(160deg, #fff, #f8faff);
  border: 1px solid rgb(151 180 247 / 12%);
  border-radius: 16px;
  box-shadow: 0 4px 20px -4px rgb(151 180 247 / 15%);

  .dark & {
    background: linear-gradient(160deg, #111b2d, #0f172a);
    border-color: rgb(56 189 248 / 10%);
    box-shadow: 0 4px 20px rgb(0 0 0 / 25%);
  }

  .disk-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 22px;

    .disk-heading {
      display: grid;
      gap: 6px;
      min-width: 0;

      .disk-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 17px;
        font-weight: 700;
        color: #1a1a2e;

        .dark & {
          color: #f1f5f9;
        }

        .title-icon {
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
          }
        }
      }

      .disk-subtitle {
        margin: 0;
        font-size: 12.5px;
        line-height: 1.6;
        color: #7a8bb8;

        .dark & {
          color: #94a3b8;
        }
      }
    }

    .actions {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .search-input {
      width: 200px;

      :deep(.el-input__wrapper) {
        background: #f8faff;
        border-radius: 10px;
        box-shadow: 0 0 0 1px rgb(151 180 247 / 18%) inset;
        transition: all 0.3s ease;

        &:hover,
        &.is-focus {
          box-shadow: 0 0 0 1px rgb(151 180 247 / 40%) inset;
        }

        .dark & {
          background-color: #1e293b;
          box-shadow: 0 0 0 1px #334155 inset;
        }
      }

      :deep(.el-input__inner) {
        font-size: 13px;

        .dark & {
          color: #f1f5f9;

          &::placeholder {
            color: #64748b;
          }
        }
      }
    }

    .upload-btn {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      padding: 8px 20px;
      font-size: 13px;
      font-weight: 600;
      color: #fff;
      letter-spacing: 0.3px;
      cursor: pointer;
      background: linear-gradient(135deg, #97b4f7, #7c9cf5);
      border: none;
      border-radius: 10px;
      box-shadow:
        0 4px 14px rgb(151 180 247 / 40%),
        inset 0 1px 0 rgb(255 255 255 / 20%);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

      &:hover {
        box-shadow:
          0 6px 20px rgb(151 180 247 / 50%),
          inset 0 1px 0 rgb(255 255 255 / 25%);
        transform: translateY(-2px);
      }

      &:active {
        transform: translateY(0);
      }

      .el-icon {
        font-size: 15px;
      }
    }
  }

  .file-icon-wrap {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 9px;
    transition: transform 0.2s ease;

    &.icon-doc {
      color: #6366f1;
      background: linear-gradient(135deg, #e0e7ff, #c7d2fe);

      .dark & {
        color: #818cf8;
        background: rgb(99 102 241 / 12%);
      }
    }

    &.icon-audio {
      color: #f59e0b;
      background: linear-gradient(135deg, #fef3c7, #fde68a);

      .dark & {
        color: #fbbf24;
        background: rgb(245 158 11 / 12%);
      }
    }

    &.icon-image {
      color: #10b981;
      background: linear-gradient(135deg, #d1fae5, #a7f3d0);

      .dark & {
        color: #34d399;
        background: rgb(16 185 129 / 12%);
      }
    }

    &.icon-video {
      color: #ef4444;
      background: linear-gradient(135deg, #fee2e2, #fecaca);

      .dark & {
        color: #f87171;
        background: rgb(239 68 68 / 12%);
      }
    }

    &.icon-folder {
      color: #97b4f7;
      background: linear-gradient(135deg, #eef2ff, #dce2f7);

      .dark & {
        color: #38bdf8;
        background: rgb(56 189 248 / 12%);
      }
    }

    &.icon-other {
      color: #6b7280;
      background: linear-gradient(135deg, #f3f4f6, #e5e7eb);

      .dark & {
        color: #94a3b8;
        background: rgb(107 114 128 / 12%);
      }
    }
  }

  .file-list-header {
    display: flex;
    align-items: center;
    padding: 0 16px 12px;
    font-size: 12px;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid rgb(151 180 247 / 10%);

    .dark & {
      color: #64748b;
      border-bottom-color: rgb(56 189 248 / 8%);
    }

    .col-name {
      flex: 1;
      min-width: 0;
    }

    .col-size {
      flex-shrink: 0;
      width: 90px;
      text-align: right;
      white-space: nowrap;
    }

    .col-date {
      flex-shrink: 0;
      width: 150px;
      text-align: right;
      white-space: nowrap;
    }

    .col-action {
      flex-shrink: 0;
      width: 170px;
      text-align: right;
      white-space: nowrap;
    }
  }

  .file-list-body {
    max-height: 600px;
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

  .file-row {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    margin-top: 4px;
    border-radius: 10px;
    transition: all 0.25s ease;

    &:hover {
      background: linear-gradient(135deg, #f0f4ff, #e8edff);
      box-shadow: 0 2px 10px rgb(151 180 247 / 10%);

      .dark & {
        background: linear-gradient(135deg, #1e293b, #253348);
        box-shadow: 0 2px 10px rgb(56 189 248 / 6%);
      }

      .col-action .action-link {
        opacity: 1;
      }
    }

    .col-name {
      display: flex;
      flex: 1;
      gap: 12px;
      align-items: center;
      min-width: 0;

      .file-icon-wrap {
        display: flex;
        flex-shrink: 0;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 9px;
        transition: transform 0.2s ease;

        &.icon-doc {
          color: #6366f1;
          background: linear-gradient(135deg, #e0e7ff, #c7d2fe);

          .dark & {
            color: #818cf8;
            background: rgb(99 102 241 / 12%);
          }
        }

        &.icon-audio {
          color: #f59e0b;
          background: linear-gradient(135deg, #fef3c7, #fde68a);

          .dark & {
            color: #fbbf24;
            background: rgb(245 158 11 / 12%);
          }
        }

        &.icon-image {
          color: #10b981;
          background: linear-gradient(135deg, #d1fae5, #a7f3d0);

          .dark & {
            color: #34d399;
            background: rgb(16 185 129 / 12%);
          }
        }

        &.icon-video {
          color: #ef4444;
          background: linear-gradient(135deg, #fee2e2, #fecaca);

          .dark & {
            color: #f87171;
            background: rgb(239 68 68 / 12%);
          }
        }

        &.icon-folder {
          color: #97b4f7;
          background: linear-gradient(135deg, #eef2ff, #dce2f7);

          .dark & {
            color: #38bdf8;
            background: rgb(56 189 248 / 12%);
          }
        }

        &.icon-other {
          color: #6b7280;
          background: linear-gradient(135deg, #f3f4f6, #e5e7eb);

          .dark & {
            color: #94a3b8;
            background: rgb(107 114 128 / 12%);
          }
        }
      }

      .file-name-text {
        overflow: hidden;
        font-size: 14px;
        font-weight: 500;
        color: #1e293b;
        text-overflow: ellipsis;
        white-space: nowrap;

        .dark & {
          color: #e2e8f0;
        }
      }
    }

    .col-size {
      flex-shrink: 0;
      width: 90px;
      font-size: 13px;
      color: #64748b;
      text-align: right;
      white-space: nowrap;

      .dark & {
        color: #94a3b8;
      }
    }

    .col-date {
      flex-shrink: 0;
      width: 150px;
      font-size: 13px;
      color: #64748b;
      text-align: right;
      white-space: nowrap;

      .dark & {
        color: #94a3b8;
      }
    }

    .col-action {
      display: flex;
      flex-shrink: 0;
      gap: 6px;
      justify-content: flex-end;
      width: 170px;
      white-space: nowrap;

      .action-link {
        padding: 4px 8px;
        font-size: 12.5px;
        font-weight: 600;
        cursor: pointer;
        background: none;
        border: none;
        border-radius: 6px;
        opacity: 0.6;
        transition: all 0.2s ease;

        &.primary {
          color: #7c9cf5;

          &:hover {
            color: #fff;
            background: linear-gradient(135deg, #97b4f7, #7c9cf5);
            box-shadow: 0 2px 8px rgb(151 180 247 / 35%);
          }
        }

        &.danger {
          color: #f87171;

          &:hover {
            color: #fff;
            background: linear-gradient(135deg, #f87171, #ef4444);
            box-shadow: 0 2px 8px rgb(248 113 113 / 35%);
          }
        }
      }
    }
  }

  .mobile-file-list {
    display: grid;
    gap: 12px;
  }

  .mobile-file-card {
    padding: 15px;
    background: linear-gradient(180deg, #fff 0%, #f8fbff 100%);
    border: 1px solid rgb(151 180 247 / 12%);
    border-radius: 18px;
    box-shadow: 0 6px 18px rgb(151 180 247 / 10%);

    .dark & {
      background: linear-gradient(180deg, #162033 0%, #101827 100%);
      border-color: rgb(56 189 248 / 10%);
      box-shadow: 0 6px 18px rgb(0 0 0 / 20%);
    }
  }

  .mobile-file-main {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr);
    gap: 14px;
    align-items: flex-start;
  }

  .mobile-file-main > .file-icon-wrap {
    width: 42px;
    height: 42px;
    margin-top: 2px;
  }

  .mobile-file-body {
    flex: 1;
    min-width: 0;
  }

  .mobile-file-name {
    display: -webkit-box;
    overflow: hidden;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.45;
    color: #1e293b;
    word-break: break-word;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;

    .dark & {
      color: #e2e8f0;
    }
  }

  .mobile-file-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    margin-top: 8px;
    font-size: 12px;
    line-height: 1.2;
    color: #7a8bb8;

    span + span {
      position: relative;
      padding-left: 12px;

      &::before {
        position: absolute;
        top: 50%;
        left: 0;
        width: 4px;
        height: 4px;
        content: "";
        background: rgb(151 180 247 / 60%);
        border-radius: 999px;
        transform: translateY(-50%);
      }
    }

    .dark & {
      color: #94a3b8;
    }
  }

  .mobile-file-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;

    .action-link {
      flex: 1 1 84px;
      min-height: 38px;
      padding: 8px 12px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      appearance: none;
      -webkit-appearance: none;
      border: none;
      border-radius: 10px;
      box-shadow: none;
      opacity: 1;

      &:hover,
      &:focus,
      &:focus-visible,
      &:active {
        box-shadow: none;
      }

      &.primary {
        color: #6f8ff0;
        background: rgb(151 180 247 / 10%);
      }

      &.danger {
        color: #ef4444;
        background: rgb(248 113 113 / 10%);
      }
    }
  }

  .empty-state {
    margin-top: 40px;
  }
}

@media (max-width: 767px) {
  .cloud-disk-container {
    padding: 18px 16px;
    border-radius: 20px;

    .disk-header {
      flex-direction: column;
      align-items: stretch;
      margin-bottom: 18px;

      .disk-heading {
        .disk-title {
          font-size: 18px;
        }
      }

      .actions {
        flex-direction: column;
        align-items: stretch;
      }

      .search-input {
        width: 100%;
      }

      .upload-btn {
        justify-content: center;
        min-height: 48px;
        padding: 10px 18px;
        font-size: 14px;
      }
    }

    .file-list-body {
      max-height: none;
      overflow: visible;
    }

    .empty-state {
      margin-top: 18px;
    }
  }
}
</style>
