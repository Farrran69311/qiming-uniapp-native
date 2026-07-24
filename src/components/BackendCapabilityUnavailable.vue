<script setup lang="ts">
import { computed, useId } from "vue";
import { useRouter } from "vue-router";
import {
  House,
  RefreshRight,
  Tickets,
  Trophy,
  WarningFilled
} from "@element-plus/icons-vue";

const props = withDefaults(
  defineProps<{
    title: string;
    moduleName: string;
    kind?: "exam" | "competition";
    checking?: boolean;
    fallbackPath?: string;
  }>(),
  {
    kind: "exam",
    checking: false,
    fallbackPath: "/"
  }
);

const emit = defineEmits<{
  retry: [];
}>();

const router = useRouter();
const titleId = useId();
const headerIcon = computed(() =>
  props.kind === "competition" ? Trophy : Tickets
);

const returnToWorkspace = () => {
  router.push(props.fallbackPath);
};
</script>

<template>
  <section
    class="backend-capability-page"
    :aria-labelledby="titleId"
    :data-backend-capability-state="checking ? 'checking' : 'unavailable'"
  >
    <header class="backend-capability-header">
      <span class="backend-capability-header__icon" aria-hidden="true">
        <el-icon><component :is="headerIcon" /></el-icon>
      </span>
      <div>
        <h1 :id="titleId">{{ title }}</h1>
        <p>{{ moduleName }}所需的服务器能力检查</p>
      </div>
    </header>

    <div
      class="backend-capability-state"
      role="status"
      aria-live="polite"
      :aria-busy="checking"
    >
      <el-icon class="backend-capability-state__icon">
        <RefreshRight v-if="checking" class="is-loading" />
        <WarningFilled v-else />
      </el-icon>
      <div class="backend-capability-state__content">
        <h2>
          {{ checking ? "正在检查服务" : `${moduleName}服务暂不可用` }}
        </h2>
        <p v-if="checking">正在确认服务器是否已恢复，请稍候。</p>
        <p v-else>
          相关服务正在更新，暂时无法加载真实数据。为避免显示空数据或造成操作丢失，本页已暂停编辑与提交。
        </p>
        <div v-if="!checking" class="backend-capability-actions">
          <el-button type="primary" @click="emit('retry')">
            <el-icon><RefreshRight /></el-icon>
            重新检查
          </el-button>
          <el-button @click="returnToWorkspace">
            <el-icon><House /></el-icon>
            返回工作台
          </el-button>
        </div>
      </div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.backend-capability-page {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 20px;
  color: var(--el-text-color-primary);
}

.backend-capability-header,
.backend-capability-state {
  display: flex;
  align-items: center;
}

.backend-capability-header {
  gap: 12px;

  h1,
  p {
    margin: 0;
  }

  h1 {
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

.backend-capability-header__icon {
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

.backend-capability-state {
  gap: 14px;
  max-width: 720px;
  min-height: 128px;
  padding: 20px;
  margin-top: 20px;
  background: var(--el-color-warning-light-9);
  border: 1px solid var(--el-color-warning-light-7);
  border-radius: 8px;

  h2,
  p {
    margin: 0;
  }

  h2 {
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

.backend-capability-state__icon {
  flex: 0 0 auto;
  font-size: 28px;
  color: var(--el-color-warning);
}

.backend-capability-state__content {
  min-width: 0;
}

.backend-capability-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;

  .el-button {
    margin-left: 0;
  }
}

@media (width <= 768px) {
  .backend-capability-page {
    padding: max(8px, env(safe-area-inset-top, 0px))
      max(8px, env(safe-area-inset-right, 0px))
      max(8px, env(safe-area-inset-bottom, 0px))
      max(8px, env(safe-area-inset-left, 0px));
  }

  .backend-capability-state {
    align-items: flex-start;
    padding: 16px;
  }
}

@media (width <= 340px) {
  .backend-capability-page {
    padding-inline-start: max(6px, env(safe-area-inset-left, 0px));
    padding-inline-end: max(6px, env(safe-area-inset-right, 0px));
  }

  .backend-capability-state {
    flex-direction: column;
  }

  .backend-capability-actions {
    display: grid;
    grid-template-columns: 1fr;

    .el-button {
      width: 100%;
    }
  }
}
</style>
