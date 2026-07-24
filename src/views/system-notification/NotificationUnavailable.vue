<template>
  <section class="notification-page" :aria-labelledby="titleId">
    <header class="notification-header">
      <span class="notification-header-icon" aria-hidden="true">
        <el-icon><Bell /></el-icon>
      </span>
      <div>
        <component :is="headingTag" :id="titleId">系统通知</component>
        <p>查看平台发布的服务与教学通知</p>
      </div>
    </header>

    <div class="notification-state" role="status" aria-live="polite">
      <el-icon class="notification-state-icon"><InfoFilled /></el-icon>
      <div>
        <h3>通知服务尚未接入</h3>
        <p>
          后端当前没有系统通知列表接口，因此此处不展示模拟通知。接口接入后将显示真实通知记录。
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, useId } from "vue";
import { Bell, InfoFilled } from "@element-plus/icons-vue";

const props = withDefaults(
  defineProps<{
    embedded?: boolean;
  }>(),
  {
    embedded: false
  }
);

const titleId = useId();
const headingTag = computed(() => (props.embedded ? "h2" : "h1"));
</script>

<style lang="scss" scoped>
.notification-page {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 20px;
  color: var(--el-text-color-primary);
}

.notification-header,
.notification-state {
  display: flex;
  align-items: center;
}

.notification-header {
  gap: 12px;

  h1,
  h2,
  p {
    margin: 0;
  }

  h1,
  h2 {
    font-size: 18px;
    line-height: 1.4;
  }

  p {
    margin-top: 3px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--el-text-color-secondary);
  }
}

.notification-header-icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  font-size: 20px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 8px;
}

.notification-state {
  gap: 14px;
  max-width: 720px;
  min-height: 128px;
  padding: 20px;
  margin-top: 20px;
  background: var(--el-color-info-light-9);
  border: 1px solid var(--el-color-info-light-7);
  border-radius: 8px;

  h3,
  p {
    margin: 0;
  }

  h3 {
    font-size: 16px;
    line-height: 1.5;
  }

  p {
    max-width: 65ch;
    margin-top: 5px;
    font-size: 14px;
    line-height: 1.7;
    color: var(--el-text-color-regular);
  }
}

.notification-state-icon {
  flex: 0 0 auto;
  font-size: 28px;
  color: var(--el-color-info);
}

@media (width <= 768px) {
  .notification-page {
    padding: max(8px, env(safe-area-inset-top, 0px))
      max(8px, env(safe-area-inset-right, 0px))
      max(8px, env(safe-area-inset-bottom, 0px))
      max(8px, env(safe-area-inset-left, 0px));
  }

  .notification-state {
    align-items: flex-start;
    padding: 16px;
  }
}

@media (width <= 480px) {
  .notification-page {
    padding-inline-start: max(6px, env(safe-area-inset-left, 0px));
    padding-inline-end: max(6px, env(safe-area-inset-right, 0px));
  }

  .notification-state {
    flex-direction: column;
    padding: 14px;
  }
}
</style>
