<template>
  <!-- HTML 动画列表 -->
  <div v-show="visible" class="course-materials-wrapper" :class="currentTheme">
    <!-- 头部 -->
    <CourseHeader
      :current-theme="currentTheme"
      title="HTML动画"
      :user-avatar="userAvatar"
      :user-nickname="userNickname"
      @go-back="$emit('go-back')"
      @toggle-theme="e => $emit('toggle-theme', e)"
      @go-to-account="$emit('go-to-account')"
      @logout="$emit('logout')"
    />

    <!-- 内容 -->
    <div class="materials-container" :class="currentTheme">
      <div v-if="loading" class="materials-list empty-state">
        <el-empty description="加载中..." />
      </div>
      <div
        v-else-if="animationList.length === 0"
        class="materials-list empty-state"
      >
        <el-empty description="暂无可展示的章节动画" />
      </div>
      <div v-else class="materials-list album-grid">
        <div
          v-for="(item, index) in animationList"
          :key="item.chapterId"
          v-motion
          class="animation-card"
          :class="{
            dark: currentTheme === 'dark',
            'is-unavailable': !item.url
          }"
          :initial="{ opacity: 0, y: 20, scale: 0.95 }"
          :visible-once="{
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
              type: 'spring',
              stiffness: 100,
              damping: 15,
              delay: (index % 4) * 100
            }
          }"
          @click="openHtmlAnimation(item)"
          @mouseenter="hoveredChapterId = item.chapterId"
          @mouseleave="hoveredChapterId = null"
        >
          <div class="card-preview">
            <template
              v-if="item.previewVideoUrl && hoveredChapterId === item.chapterId"
            >
              <video
                :src="item.previewVideoUrl"
                autoplay
                loop
                muted
                playsinline
                class="hover-video"
              />
            </template>
            <template v-else>
              <img
                v-if="resolveCoverUrl(item)"
                :src="resolveCoverUrl(item)"
                alt="预览图"
              />
              <div v-else class="cover-placeholder">
                <el-icon size="42">
                  <component :is="VideoPlay" />
                </el-icon>
                <span>{{ item.url ? "默认封面" : statusText(item) }}</span>
              </div>
            </template>
            <div v-if="item.url" class="play-overlay">
              <el-icon size="48">
                <component :is="VideoPlay" />
              </el-icon>
            </div>
          </div>
          <!-- 毛玻璃内容层：带平滑渐变 mask -->
          <div class="card-info-glass">
            <div class="card-title">{{ item.chapterName }}</div>
            <div class="card-version">
              {{ item.version ? `Version ${item.version}` : statusText(item) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 预览弹窗 -->
    <el-dialog
      v-model="htmlAnimPreviewVisible"
      width="90%"
      top="2vh"
      :class="['immersive-dialog', currentTheme]"
      :show-close="false"
      destroy-on-close
    >
      <div class="dialog-header-custom">
        <div class="header-info">
          <el-icon><component :is="VideoPlay" /></el-icon>
          <span class="title">HTML动画预览</span>
        </div>
        <div class="header-actions">
          <!-- 管理员预览时可见的快照按钮 (示例) -->
          <div
            class="action-btn capture-btn"
            title="截取当前画面为封面"
            @click="captureAndUpload"
          >
            <el-icon size="18"><component :is="Camera" /></el-icon>
            <span class="btn-text">设为封面</span>
          </div>
          <div class="action-btn" title="新窗口打开" @click="openHtmlAnimInNew">
            <el-icon size="18"><component :is="ExternalLink" /></el-icon>
          </div>
          <div
            class="action-btn close"
            title="关闭"
            @click="htmlAnimPreviewVisible = false"
          >
            <el-icon size="18"><component :is="Close" /></el-icon>
          </div>
        </div>
      </div>
      <div v-if="htmlAnimPreviewUrl" class="preview-wrapper-immersive">
        <div v-if="iframeLoading" class="loading-overlay">
          <el-icon class="is-loading" size="40"
            ><component :is="Loading"
          /></el-icon>
        </div>
        <iframe
          :src="htmlAnimPreviewUrl"
          frameborder="0"
          class="preview-iframe"
          @load="iframeLoading = false"
        />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import CourseHeader from "./CourseHeader.vue";
import VideoPlay from "~icons/ep/video-play";
import Close from "~icons/ep/close";
import ExternalLink from "~icons/ep/link";
import Loading from "~icons/ep/loading";
import Camera from "~icons/ep/camera";

// Props
const props = defineProps<{
  visible: boolean;
  currentTheme: string;
  loading: boolean;
  animationList: Array<{
    chapterId: number;
    chapterName: string;
    version: string;
    url: string;
    coverUrl?: string;
    previewUrl?: string;
    previewVideoUrl?: string;
    available?: boolean;
    message?: string;
    status?: string;
  }>;
  userAvatar: string;
  userNickname: string;
}>();

// Emits
defineEmits<{
  (e: "go-back"): void;
  (e: "toggle-theme", event: MouseEvent): void;
  (e: "go-to-account"): void;
  (e: "logout"): void;
}>();

// 内部状态
const hoveredChapterId = ref<number | null>(null);
const htmlAnimPreviewVisible = ref(false);
const htmlAnimPreviewUrl = ref("");
const iframeLoading = ref(true);

const resolveCoverUrl = (item: { coverUrl?: string; previewUrl?: string }) =>
  item.coverUrl || item.previewUrl || "";

const statusText = (item: {
  status?: string;
  message?: string;
  url?: string;
}) => {
  if (item.url) return "可播放";
  if (item.status === "missing") return "文件缺失";
  if (item.status === "processing") return "生成中";
  return item.message || "暂无动画";
};

// 监听弹窗打开，重置加载状态
watch(htmlAnimPreviewVisible, val => {
  if (val) iframeLoading.value = true;
});

// 模拟快照采集（实际开发中需通过 iframe postMessage 获取或画布截取）
const captureAndUpload = () => {
  const chapter = props.animationList.find(
    a => a.url === htmlAnimPreviewUrl.value
  );
  if (!chapter) return;

  // 这里可以具体扩展为调用 html2canvas 或后端接口
  console.log(`正在为章节 ${chapter.chapterName} 采集画面并设为封面...`);
  // 后续对接：ElMessage.success("快照已提交，正在生成新封面...");
};

// 打开 HTML 动画预览
const openHtmlAnimation = (item: { url: string }) => {
  if (!item.url) return;
  htmlAnimPreviewUrl.value = item.url;
  htmlAnimPreviewVisible.value = true;
};

// 在新窗口打开
const openHtmlAnimInNew = () => {
  if (htmlAnimPreviewUrl.value) {
    window.open(htmlAnimPreviewUrl.value, "_blank");
  }
};
</script>

<style scoped lang="scss">
/* 根容器背景统一为系统浅色调渐变 */
.course-materials-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: transparent; /* 背景透明，防止侧边栏色差 */

  &.dark {
    background: transparent;
  }

  .materials-container {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;

    /* 顶部 80px 偏移以避开 Header，左右 32px 保持对齐 */
    padding: 80px 32px 24px;
    overflow-y: auto;
  }
}

.materials-list.empty-state {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.materials-list.album-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 32px;
  width: 100%;
  padding: 0;
}

.animation-card {
  position: relative;
  width: 100%;
  height: 240px;
  overflow: hidden;
  cursor: pointer;
  background-color: rgb(255 255 255 / 80%);
  border: 1px solid rgb(255 255 255 / 50%);
  border-radius: 24px;
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 8%);

  /* 强制开启 GPU 加速，修复毛玻璃边缘渲染 Bug */
  transform: translateZ(0);
  transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1);
}

.animation-card:hover {
  border-color: rgb(64 158 255 / 40%);

  /* 统一使用系统标准蓝色 #97b4f7 */
  box-shadow: 0 20px 40px rgb(64 158 255 / 20%);
  transform: translateY(-10px);
}

.animation-card.is-unavailable {
  cursor: default;
}

.animation-card.is-unavailable:hover {
  border-color: rgb(255 255 255 / 50%);
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 8%);
  transform: none;
}

.animation-card.dark {
  background-color: rgb(40 40 40 / 80%);
  border-color: rgb(255 255 255 / 10%);
  box-shadow: 0 10px 25px rgb(0 0 0 / 30%);
}

.animation-card.dark.is-unavailable:hover {
  border-color: rgb(255 255 255 / 10%);
  box-shadow: 0 10px 25px rgb(0 0 0 / 30%);
}

.card-preview {
  position: relative;
  width: 100%;
  height: 100%;
}

.card-preview img,
.hover-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.8s ease;
}

.animation-card:hover .card-preview img,
.animation-card:hover .hover-video {
  transform: scale(1.1);
}

.animation-card.is-unavailable:hover .card-preview img,
.animation-card.is-unavailable:hover .hover-video,
.animation-card.is-unavailable:hover .cover-placeholder {
  transform: none;
}

.cover-placeholder {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #64748b;
  background:
    linear-gradient(135deg, rgb(151 180 247 / 18%), transparent 42%),
    linear-gradient(315deg, rgb(0 184 212 / 16%), transparent 45%), #f8fafc;
  transition: transform 0.8s ease;
}

.cover-placeholder span {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.animation-card:hover .cover-placeholder {
  transform: scale(1.06);
}

.dark .cover-placeholder {
  color: #cbd5e1;
  background:
    linear-gradient(135deg, rgb(151 180 247 / 20%), transparent 42%),
    linear-gradient(315deg, rgb(0 184 212 / 14%), transparent 45%), #0f172a;
}

.play-overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(0 184 212 / 10%);
  opacity: 0;
  transition: all 0.4s ease;
}

.animation-card:hover .play-overlay {
  opacity: 1;
}

.play-overlay .el-icon {
  font-size: 56px;
  color: #fff;
  filter: drop-shadow(0 0 10px rgb(0 184 212 / 60%));
}

/* 优化的平滑毛玻璃过渡：由于 mask-image 实现模糊渐变更加优雅 */
.card-info-glass {
  position: absolute;
  right: -1px;
  bottom: -1px;
  left: -1px;
  z-index: 3;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 80px 32px 24px;

  /* 降低背景颜色遮挡，使其更透明 */
  background: linear-gradient(
    to bottom,
    transparent 0%,
    rgb(255 255 255 / 10%) 40%,
    rgb(255 255 255 / 60%) 100%
  );
  border-radius: 0 0 24px 24px;
  backdrop-filter: blur(12px) saturate(180%);

  /* 调整 mask 渐变，确保底部完全不透明以修复边缘缝隙 */
  mask-image: linear-gradient(to bottom, transparent 0%, black 60%, black 100%);
  transition: all 0.4s ease;
}

.dark .card-info-glass {
  background: linear-gradient(
    to bottom,
    transparent 0%,
    rgb(0 0 0 / 20%) 40%,
    rgb(0 0 0 / 80%) 100%
  );
}

.animation-card:hover .card-info-glass {
  padding-bottom: 28px;
}

.card-title {
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 18px;
  font-weight: 700;
  color: #1d1d1f;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgb(255 255 255 / 50%);
  transition: color 0.3s ease;
}

.animation-card:hover .card-title {
  color: #00b8d4;

  /* 增加白色描边，确保在各种背景图上都能看清 */
  text-shadow:
    -1px -1px 0 #fff,
    1px -1px 0 #fff,
    -1px 1px 0 #fff,
    1px 1px 0 #fff,
    0 2px 4px rgb(0 0 0 / 20%);
}

.dark .card-title {
  color: #fff;
  text-shadow: 0 2px 4px rgb(0 0 0 / 50%);
}

.dark .animation-card:hover .card-title {
  color: #00b8d4;

  /* 深色模式下同样使用白色描边，配合青色文字会有很强的霓虹感 */
  text-shadow:
    -1px -1px 0 #fff,
    1px -1px 0 #fff,
    -1px 1px 0 #fff,
    1px 1px 0 #fff;
}

.card-version {
  font-size: 13px;
  font-weight: 700;
  color: #1d1d1f;
  letter-spacing: 0.5px;
}

.dark .card-version {
  color: #00b8d4;
}

.dark :deep(.el-empty__image img),
.dark :deep(.el-empty__image svg) {
  opacity: 0.8;
  filter: brightness(0.7);
}

/* 预览弹窗样式统一 */
.course-materials-wrapper {
  :deep(.immersive-dialog) {
    overflow: hidden;
    background: rgb(248 250 252 / 80%);
    border: 1px solid rgb(255 255 255 / 50%);
    border-radius: 32px;
    box-shadow: 0 30px 60px -12px rgb(0 0 0 / 25%);
    backdrop-filter: blur(20px) saturate(180%);

    &.dark {
      background: rgb(15 23 42 / 90%);
      border: 1px solid rgb(255 255 255 / 8%);
    }

    .el-dialog__header {
      display: none;
    }

    .el-dialog__body {
      padding: 0;
    }
  }
}

.dialog-header-custom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  margin: 20px 20px 16px;
  background: rgb(255 255 255 / 60%);
  border: 1px solid rgb(255 255 255 / 50%);
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 5%);
  backdrop-filter: blur(10px);
}

.dark .dialog-header-custom {
  background: rgb(30 41 59 / 70%);
  border: 1px solid rgb(255 255 255 / 10%);
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 20%);
}

.header-info {
  display: flex;
  gap: 12px;
  align-items: center;
}

.header-info .el-icon {
  font-size: 20px;
  color: #00b8d4;
}

.header-info .title {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  letter-spacing: 0.5px;
}

.dark .header-info .title {
  color: #f1f5f9;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  color: #475569;
  cursor: pointer;
  background: rgb(0 0 0 / 3%);
  border-radius: 10px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.action-btn.capture-btn {
  gap: 6px;
  width: auto;
  padding: 0 12px;
  color: #97b4f7;
  background: rgb(64 158 255 / 10%);
  border: 1px solid rgb(64 158 255 / 20%);
}

.action-btn.capture-btn .btn-text {
  font-size: 13px;
  font-weight: 500;
}

.action-btn.capture-btn:hover {
  color: white;
  background: #97b4f7;
}

.dark .action-btn {
  color: #cbd5e1;
  background: rgb(255 255 255 / 6%);
}

.dark .action-btn.capture-btn {
  background: rgb(64 158 255 / 15%);
  border-color: rgb(64 158 255 / 30%);
}

.action-btn:hover {
  color: #00b8d4;
  background: rgb(0 184 212 / 15%);
  transform: translateY(-2px);
}

.action-btn.close:hover {
  color: #f43f5e;
  background: rgb(244 63 94 / 15%);
}

.preview-wrapper-immersive {
  position: relative;
  width: calc(100% - 40px);
  height: 80vh;
  margin: 0 20px 20px;
  overflow: hidden;
  background: #f8fafc;
  border: 1px solid rgb(0 0 0 / 5%);
  border-radius: 20px;
  box-shadow: inset 0 2px 4px rgb(0 0 0 / 5%);
}

.dark .preview-wrapper-immersive {
  background: #0f172a;
  border: 1px solid rgb(255 255 255 / 5%);
}

.loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #97b4f7;
  background: inherit;
}

.preview-iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: none;
}

/* 统一配色方案 */
:deep(.light .card-version) {
  color: #1d1d1f;
  opacity: 0.8;
}

@media (max-width: 768px) {
  .course-materials-wrapper {
    min-height: 100vh;

    .materials-container {
      height: auto;
      min-height: 100vh;
      padding: var(--course-mobile-top-offset, 176px) 14px
        calc(24px + env(safe-area-inset-bottom));
      overflow: visible;
    }
  }

  .materials-list.album-grid {
    gap: 18px;
    grid-template-columns: minmax(0, 1fr);
  }

  .animation-card {
    height: 220px;
    border-radius: 20px;
  }

  .card-info-glass {
    padding: 72px 20px 18px;
    border-radius: 0 0 20px 20px;
  }

  .card-title {
    font-size: 16px;
  }

  .dialog-header-custom {
    gap: 12px;
    padding: 12px 14px;
    margin: 14px 14px 12px;
  }

  .header-actions {
    gap: 8px;
  }
}

@media (max-width: 479px) {
  .course-materials-wrapper {
    .materials-container {
      padding: var(--course-mobile-top-offset, 176px) 10px
        calc(20px + env(safe-area-inset-bottom));
    }
  }

  .materials-list.album-grid {
    gap: 14px;
  }

  .animation-card {
    height: 204px;
    border-radius: 18px;
  }

  .card-info-glass {
    padding: 64px 16px 16px;
    border-radius: 0 0 18px 18px;
  }

  .card-title {
    font-size: 15px;
  }

  .card-version {
    font-size: 12px;
  }
}
</style>
