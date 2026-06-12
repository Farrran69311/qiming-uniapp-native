<template>
  <div class="layout-header" :class="currentTheme">
    <div class="header-content">
      <!-- 左侧区域：返回按钮、日期、主题切换 -->
      <div class="header-left">
        <div
          class="back-btn spotlight-button"
          @click="$emit('go-back')"
          @mousemove="handleButtonMouseMove"
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            stroke="currentColor"
            stroke-width="3"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </div>
        <div
          v-if="showClockMeta"
          class="header-date-group header-date-group--rich"
        >
          <span class="header-date">{{ currentDate }}</span>
          <div class="header-clock-row">
            <span class="header-time">{{ currentTime }}</span>
            <span class="header-period">{{ dayPhase }}</span>
          </div>
        </div>
        <span v-else class="header-date header-date--single">{{
          currentDate
        }}</span>
        <div
          class="theme-btn-premium"
          :class="{ 'is-dark': currentTheme === 'dark' }"
          @click="$emit('toggle-theme', $event)"
        >
          <div class="sun-moon-wrapper">
            <div class="icon sun">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            </div>
            <div class="icon moon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </div>
          </div>
          <div class="switch-dot" />
        </div>
      </div>

      <!-- 右侧区域：像素级复刻主导航栏的用户胶囊 -->
      <div class="header-right">
        <el-dropdown
          trigger="click"
          teleported
          :popper-options="{
            modifiers: [{ name: 'offset', options: { offset: [0, 8] } }]
          }"
          popper-class="course-user-dropdown"
          @visible-change="v => (visible = v)"
        >
          <div class="user-capsule">
            <el-avatar :size="24" :src="userAvatar" class="user-avatar" />
            <span v-if="userNickname" class="user-name">
              {{ userNickname }}
            </span>
            <IconifyIconOffline
              :icon="ArrowDown"
              class="dropdown-arrow"
              :class="{ 'rotate-180': visible }"
            />
          </div>
          <template #dropdown>
            <el-dropdown-menu class="logout">
              <el-dropdown-item @click="$emit('go-to-account')">
                <IconifyIconOffline :icon="Setting" style="margin: 5px" />
                账号管理
              </el-dropdown-item>
              <el-dropdown-item
                divided
                class="logout-item"
                @click="$emit('logout')"
              >
                <IconifyIconOffline :icon="LogoutIcon" style="margin: 5px" />
                退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { IconifyIconOffline } from "@/components/ReIcon";
import ArrowDown from "~icons/ep/arrow-down";
import Setting from "~icons/ri/user-settings-line";
import LogoutIcon from "~icons/ri/logout-circle-r-line";

const props = withDefaults(
  defineProps<{
    currentTheme: string;
    title?: string;
    userAvatar: string;
    userNickname: string;
    showClockMeta?: boolean;
  }>(),
  {
    showClockMeta: false
  }
);

const visible = ref(false);
const now = ref(new Date());
let clockTimer: ReturnType<typeof setInterval> | null = null;

defineEmits<{
  (e: "go-back"): void;
  (e: "toggle-theme", event: MouseEvent): void;
  (e: "go-to-account"): void;
  (e: "logout"): void;
}>();

const currentDate = computed(() => {
  const date = now.value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}年${month}月${day}日`;
});

const currentTime = computed(() => {
  const date = now.value;
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${hour}:${minute}:${second}`;
});

const dayPhase = computed(() => {
  const hour = now.value.getHours();
  if (hour < 5) return "凌晨";
  if (hour < 8) return "清晨";
  if (hour < 11) return "上午";
  if (hour < 13) return "中午";
  if (hour < 18) return "下午";
  if (hour < 20) return "傍晚";
  return "晚上";
});

onMounted(() => {
  if (!props.showClockMeta) return;
  clockTimer = setInterval(() => {
    now.value = new Date();
  }, 1000);
});

onUnmounted(() => {
  if (clockTimer) {
    clearInterval(clockTimer);
    clockTimer = null;
  }
});

const handleButtonMouseMove = (e: MouseEvent) => {
  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  target.style.setProperty("--x", `${x}px`);
  target.style.setProperty("--y", `${y}px`);
};
</script>

<style scoped lang="scss">
/* 头部整体布局 */
.layout-header {
  position: fixed;
  top: 15px;
  right: 15px;
  left: 90px;
  z-index: 1000;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0 32px;
  background: rgb(255 255 255 / 70%);
  border: 1px solid rgb(255 255 255 / 30%);
  border-radius: 20px;
  box-shadow: 0 4px 16px rgb(0 0 0 / 6%);
  backdrop-filter: blur(12px);
  transition: all 0.3s ease;

  &.dark {
    background: rgb(30 30 35 / 70%);
    border: 1px solid rgb(255 255 255 / 8%);
    box-shadow: 0 4px 16px rgb(0 0 0 / 30%);
  }
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 100%;
}

/* 左侧区域 */
.header-left {
  display: flex;
  flex: 1;
  align-items: center;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  color: #97b4f7;
  cursor: pointer;
  background: rgb(64 158 255 / 12%);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.back-btn:hover {
  background: rgb(64 158 255 / 20%);
  transform: scale(1.05);
}

.header-date-group {
  display: flex;
  flex-direction: column;
  margin-left: 20px;
  line-height: 1;
}

.header-date {
  font-family:
    "SF Pro Display", "PingFang SC", "Helvetica Neue", Arial, sans-serif;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: #97b4f7;
  white-space: nowrap;
}

.header-date--single {
  margin-left: 20px;
}

.header-date-group--rich .header-date {
  margin-left: 0;
}

.header-clock-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
}

.header-time {
  font-family:
    "SF Mono", "SFMono-Regular", "JetBrains Mono", "Menlo", monospace;
  font-size: 12px;
  font-weight: 700;
  color: rgb(151 180 247 / 92%);
  letter-spacing: 0.08em;
  font-variant-numeric: tabular-nums;
}

.header-period {
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 700;
  color: #6f94eb;
  background: rgb(151 180 247 / 12%);
  border: 1px solid rgb(151 180 247 / 16%);
  border-radius: 999px;
  white-space: nowrap;
}

.layout-header.dark .header-date {
  color: #4facfe;
}

.layout-header.dark .header-time {
  color: rgb(79 172 254 / 92%);
}

.layout-header.dark .header-period {
  color: #8ac8ff;
  background: rgb(79 172 254 / 12%);
  border-color: rgb(79 172 254 / 18%);
}

.layout-header.dark .back-btn {
  color: #4facfe;
  background: #262626;
  border: 1px solid rgb(79 172 254 / 30%);

  &:hover {
    background: #333;
    border-color: #4facfe;
  }
}

/* 主题切换按钮-同步教师端简约风格 */
.theme-btn-premium {
  position: relative;
  width: 52px;
  height: 28px;
  padding: 4px;
  margin-left: 18px;
  cursor: pointer;
  background-color: #e2e8f0;
  border-radius: 100px;
  box-shadow: inset 0 2px 4px rgb(0 0 0 / 10%);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background-color: #cbd5e0;
    transform: scale(1.05);
  }

  &.is-dark {
    background-color: #2d3748;
    box-shadow: inset 0 2px 4px rgb(0 0 0 / 30%);

    .switch-dot {
      background-color: #fff;
      box-shadow: 0 2px 4px rgb(0 0 0 / 40%);
      transform: translateX(24px);
    }

    .sun {
      opacity: 0;
      transform: translateY(20px) scale(0);
    }

    .moon {
      color: #f6e05e;
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .sun-moon-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .icon {
    position: absolute;
    top: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    margin-top: -10px;
    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);

    svg {
      width: 14px;
      height: 14px;
    }
  }

  .sun {
    left: 0;
    color: #f6ad55;
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  .moon {
    right: 0;
    color: #718096;
    opacity: 0;
    transform: translateY(-20px) scale(0);
  }

  .switch-dot {
    position: absolute;
    top: 4px;
    left: 4px;
    z-index: 2;
    width: 20px;
    height: 20px;
    background-color: #fff;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgb(0 0 0 / 20%);
    transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
}

/* 右侧区域 - 像素级复刻主页面 */
.header-right {
  display: flex;
  flex: 1;
  justify-content: flex-end;
}

.user-capsule {
  display: flex;
  align-items: center;
  height: 34px;
  padding: 0 12px;
  cursor: pointer;
  user-select: none;
  background: rgb(0 0 0 / 5%);
  border-radius: 17px;
  transition: all 0.2s ease;

  &:hover {
    background: rgb(0 0 0 / 10%);
  }
}

.layout-header.dark .user-capsule {
  background: rgb(255 255 255 / 15%);

  &:hover {
    background: rgb(255 255 255 / 25%);
  }
}

.user-avatar {
  flex-shrink: 0;
  margin-right: 0;
  background: #f0f2f5;
}

.user-name {
  margin-left: 8px;
  font-size: 14px;
  font-weight: 400;
  color: #000000d9;
  white-space: nowrap;
}

.layout-header.dark .user-name {
  color: #fff;
}

.dropdown-arrow {
  display: inline-block;
  margin-left: 4px;
  font-size: 12px;
  color: #000000d9;
  transition: transform 0.3s ease;

  &.rotate-180 {
    transform: rotate(180deg);
  }
}

.layout-header.dark .dropdown-arrow {
  color: #fff;
}

/* 聚光灯按钮效果 */
.spotlight-button {
  position: relative;
  overflow: hidden;
}

.spotlight-button::before {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: "";
  background: radial-gradient(
    circle at var(--x, 50%) var(--y, 50%),
    rgb(64 158 255 / 40%) 0%,
    transparent 70%
  );
  opacity: 0;
  transition: opacity 0.3s;
}

.spotlight-button:hover::before {
  opacity: 1;
}

/* stylelint-disable-next-line order/order */
@media (max-width: 767px) {
  .layout-header {
    top: calc(12px + var(--pure-safe-area-top, 0px));
    right: 12px;
    left: 12px;
    height: 64px;
    padding: 0 14px;
    border-radius: 22px;
  }

  .header-content {
    gap: 12px;
  }

  .header-left {
    min-width: 0;
  }

  .back-btn {
    width: 36px;
    height: 36px;
    border-radius: 11px;
  }

  .header-date {
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 16px;
  }

  .header-date--single,
  .header-date-group {
    margin-left: 12px;
  }

  .header-clock-row {
    gap: 8px;
    margin-top: 5px;
  }

  .header-time {
    font-size: 11px;
  }

  .header-period {
    padding: 3px 7px;
    font-size: 10px;
  }

  .theme-btn-premium {
    margin-left: 12px;
  }

  .header-right {
    flex: 0 0 auto;
  }

  .user-capsule {
    max-width: 112px;
    padding: 0 10px;
  }

  .user-name {
    max-width: 52px;
    margin-left: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 13px;
  }
}

/* stylelint-disable-next-line order/order */
@media (max-width: 479px) {
  .layout-header {
    height: 60px;
    padding: 0 12px;
  }

  .header-content {
    gap: 8px;
  }

  .header-left {
    gap: 0;
  }

  .back-btn {
    width: 34px;
    height: 34px;
  }

  .header-date {
    font-size: 14px;
  }

  .header-date--single,
  .header-date-group {
    margin-left: 10px;
  }

  .header-clock-row {
    gap: 6px;
    margin-top: 4px;
  }

  .header-time {
    font-size: 10px;
    letter-spacing: 0.05em;
  }

  .header-period {
    padding: 2px 6px;
    font-size: 9px;
  }

  .theme-btn-premium {
    width: 48px;
    height: 26px;
    margin-left: 10px;

    .switch-dot {
      width: 18px;
      height: 18px;
    }

    &.is-dark .switch-dot {
      transform: translateX(22px);
    }
  }

  .user-capsule {
    max-width: 84px;
    padding: 0 8px;
  }

  .user-name {
    max-width: 34px;
  }

  .dropdown-arrow {
    margin-left: 2px;
  }
}

@media (max-width: 379px) {
  .layout-header {
    right: 10px;
    left: 10px;
    padding: 0 10px;
    border-radius: 20px;
  }

  .header-content {
    gap: 6px;
  }

  .header-date {
    font-size: 13px;
  }

  .header-date--single,
  .header-date-group {
    margin-left: 8px;
  }

  .header-time {
    font-size: 9px;
  }

  .header-period {
    display: none;
  }

  .theme-btn-premium {
    margin-left: 8px;
  }

  .user-capsule {
    max-width: 74px;
    padding: 0 7px;
  }

  .user-avatar {
    --el-avatar-size: 22px;
  }

  .user-name {
    max-width: 28px;
    font-size: 12px;
  }
}
</style>

<!-- 非scoped 样式，确保下拉菜单正确显示 -->
<style lang="scss">
.course-user-dropdown {
  z-index: 9999 !important;
  padding: 0 !important;
  background: #fff !important;
  border: 1px solid #ebeef5 !important;
  border-radius: 8px !important;
  box-shadow: 0 2px 12px 0 rgb(0 0 0 / 10%) !important;

  .el-dropdown-menu {
    padding: 0;
    background: #fff;
    border: none;
    box-shadow: none;

    .el-dropdown-menu__item {
      display: inline-flex;
      flex-wrap: wrap;
      min-width: 120px;
      padding: 8px 16px;
      font-size: 14px;
      line-height: 22px;
      color: #606266;

      &:hover {
        color: var(--el-color-primary);
        background-color: #f5f7fa;
      }

      &.is-divided {
        margin-top: 0;
        border-top: 1px solid #ebeef5;

        &::before {
          display: none;
        }
      }
    }
  }

  .logout-item {
    color: #f56c6c !important;

    &:hover {
      color: #f56c6c !important;
      background-color: #fef0f0 !important;
    }
  }
}
</style>
