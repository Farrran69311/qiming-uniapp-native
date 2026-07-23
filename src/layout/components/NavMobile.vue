<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useUserStoreHook } from "@/store/modules/user";

type MobileNavItem = {
  title: string;
  icon: string;
  path: string;
};

const route = useRoute();
const router = useRouter();
const userStore = useUserStoreHook();

const isAdminOrTeacher = computed(() =>
  userStore.roles?.some(role => role === "admin" || role === "teacher")
);

const profilePath = computed(() =>
  isAdminOrTeacher.value ? "/account-settings" : "/account"
);

const adminMobileNavItems: MobileNavItem[] = [
  {
    title: "首页",
    icon: "ep:home-filled",
    path: "/welcome"
  },
  {
    title: "课程",
    icon: "ep:reading",
    path: "/course/list"
  },
  {
    title: "教案",
    icon: "ep:edit-pen",
    path: "/course/teacherplan"
  },
  {
    title: "考核",
    icon: "ep:document-checked",
    path: "/course/assessment"
  }
];

const defaultMobileNavItems = computed<MobileNavItem[]>(() => [
  {
    title: "首页",
    icon: "ep:home-filled",
    path: "/account?menu=home"
  },
  {
    title: "课程",
    icon: "ep:reading",
    path: "/account?menu=course"
  },
  {
    title: "AI助手",
    icon: "ep:chat-dot-round",
    path: "/account/ai-app?mode=student"
  },
  {
    title: "我的",
    icon: "ep:user",
    path: isAdminOrTeacher.value ? profilePath.value : "/account?menu=profile"
  }
]);

const navItems = computed<MobileNavItem[]>(() =>
  isAdminOrTeacher.value ? adminMobileNavItems : defaultMobileNavItems.value
);

const visibleNavItems = computed(() =>
  navItems.value.filter(item => router.resolve(item.path).matched.length > 0)
);

const isActive = (path: string) => {
  const target = router.resolve(path);
  if (route.path !== target.path) return false;
  return Object.entries(target.query).every(([key, value]) => {
    const current = route.query[key];
    return Array.isArray(current)
      ? current.includes(String(value))
      : current === value;
  });
};

const handleJump = (path: string) => {
  if (isActive(path)) return;
  router.push(path);
};
</script>

<template>
  <nav class="nav-mobile-container" aria-label="移动端主导航">
    <button
      v-for="item in visibleNavItems"
      :key="item.path"
      type="button"
      class="nav-mobile-item"
      :class="{ active: isActive(item.path) }"
      :aria-current="isActive(item.path) ? 'page' : undefined"
      :aria-label="item.title"
      @click="handleJump(item.path)"
    >
      <IconifyIconOnline :icon="item.icon" class="nav-icon" />
      <span class="nav-title">{{ item.title }}</span>
    </button>
  </nav>
</template>

<style lang="scss" scoped>
.nav-mobile-container {
  position: fixed;
  bottom: 0;
  left: 0;
  z-index: 2000;
  display: flex;
  width: 100%;
  height: var(--pure-mobile-tab-height);
  padding-bottom: var(--pure-safe-area-bottom);
  background: rgb(255 255 255 / 88%);
  border-top: 1px solid rgb(226 232 240 / 90%);
  box-shadow: 0 -8px 24px rgb(15 23 42 / 6%);
  backdrop-filter: blur(18px);
}

.nav-mobile-item {
  display: flex;
  flex: 1;
  min-width: 0;
  padding: 0;
  font: inherit;
  cursor: pointer;
  background: transparent;
  border: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-regular);
  transition:
    color 0.2s ease,
    background-color 0.2s ease,
    opacity 0.2s ease;

  &:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: -4px;
  }

  .nav-icon {
    font-size: 20px;
    margin-bottom: 3px;
  }

  .nav-title {
    max-width: 100%;
    overflow: hidden;
    font-size: 11px;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &.active {
    color: var(--el-color-primary);

    .nav-icon {
      transform: translateY(-2px);
    }
  }

  &:active {
    opacity: 0.7;
    background: var(--el-fill-color-light);
  }
}

@media screen and (max-width: 768px) {
  .nav-mobile-container {
    height: calc(var(--pure-mobile-tab-height) + 4px);
  }

  .nav-mobile-item {
    .nav-icon {
      font-size: 19px;
    }

    .nav-title {
      font-size: 10px;
      transform: scale(0.96);
      transform-origin: center top;
    }
  }
}
</style>
