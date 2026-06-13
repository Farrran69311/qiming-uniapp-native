<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useUserStoreHook } from "@/store/modules/user";

type MobileNavItem = {
  title: string;
  icon: string;
  path: string;
  menu?: string;
  mode?: string;
};

const route = useRoute();
const router = useRouter();
const userStore = useUserStoreHook();

const isAdmin = computed(() => userStore.roles?.includes("admin"));
const isTeacher = computed(() => userStore.roles?.includes("teacher"));
const isAdminOrTeacher = computed(() => isAdmin.value || isTeacher.value);

const profilePath = computed(() =>
  isAdminOrTeacher.value ? "/account-settings" : "/account"
);

const adminMobileNavItems: MobileNavItem[] = [
  {
    title: "首页",
    icon: "ep:home-filled",
    path: "/welcome/index"
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

const teacherMobileNavItems = adminMobileNavItems;

const managerMobileNavItems: MobileNavItem[] = [
  {
    title: "\u9996\u9875",
    icon: "ep:home-filled",
    path: "/welcome/index"
  },
  {
    title: "\u7528\u6237",
    icon: "ep:user-filled",
    path: "/user/list"
  },
  {
    title: "\u8bfe\u7a0b",
    icon: "ep:reading",
    path: "/course/list"
  },
  {
    title: "AI App",
    icon: "ep:chat-dot-round",
    path: "/ai-app/workspace"
  },
  {
    title: "\u8003\u6838",
    icon: "ep:document-checked",
    path: "/course/assessment"
  }
];

const defaultMobileNavItems = computed<MobileNavItem[]>(() => [
  {
    title: "首页",
    icon: "ep:home-filled",
    path: "/account",
    menu: "home"
  },
  {
    title: "课程",
    icon: "ep:reading",
    path: "/account",
    menu: "course"
  },
  {
    title: "AI App",
    icon: "ep:chat-dot-round",
    path: "/account/ai-app",
    mode: "student"
  },
  {
    title: "我的",
    icon: "ep:user",
    path: profilePath.value,
    menu: "profile"
  }
]);

const navItems = computed<MobileNavItem[]>(() =>
  isAdmin.value
    ? managerMobileNavItems
    : isTeacher.value
      ? teacherMobileNavItems
      : defaultMobileNavItems.value
);

const visibleNavItems = computed(() =>
  navItems.value.filter(item => router.resolve(item.path).matched.length > 0)
);

const activePath = computed(() => route.path);

const getQueryValue = (value: unknown) =>
  Array.isArray(value) ? value[0] : value;

const isActive = (item: MobileNavItem) => {
  if (item.menu) {
    const menu = getQueryValue(route.query.menu);
    return (
      activePath.value === item.path &&
      (menu === item.menu || (!menu && item.menu === "home"))
    );
  }
  if (item.mode) {
    return (
      activePath.value === item.path &&
      getQueryValue(route.query.mode) === item.mode
    );
  }
  return (
    activePath.value === item.path ||
    activePath.value.startsWith(`${item.path}/`)
  );
};

const buildJumpQuery = (item: MobileNavItem) => {
  const query: Record<string, any> = { ...route.query };
  if (item.menu) {
    query.menu = item.menu;
  } else {
    delete query.menu;
  }

  if (item.mode) {
    query.mode = item.mode;
  } else {
    delete query.mode;
  }
  return query;
};

const handleJump = (item: MobileNavItem) => {
  const query = buildJumpQuery(item);
  const samePath = route.path === item.path;
  const sameMenu = getQueryValue(route.query.menu) === item.menu;
  const sameMode = getQueryValue(route.query.mode) === item.mode;
  if (samePath && sameMenu && sameMode) return;

  router.push({
    path: item.path,
    query
  });
};
</script>

<template>
  <div class="nav-mobile-container">
    <div
      v-for="item in visibleNavItems"
      :key="`${item.path}:${item.menu || item.mode || item.title}`"
      class="nav-mobile-item"
      :class="{ active: isActive(item) }"
      @click="handleJump(item)"
    >
      <IconifyIconOnline :icon="item.icon" class="nav-icon" />
      <span class="nav-title">{{ item.title }}</span>
    </div>
  </div>
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
  background: var(--qiming-native-dock-bg, rgb(255 255 255 / 98%));
  border-top: 1px solid var(--qiming-native-dock-border, rgb(226 232 240 / 90%));
  box-shadow: var(--qiming-native-dock-shadow, 0 -8px 24px rgb(15 23 42 / 6%));
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  opacity: 1;
}

.nav-mobile-item {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-regular);
  transition: all 0.3s;

  .nav-icon {
    display: block;
    flex: 0 0 auto;
    font-size: 20px;
    margin-bottom: 5px;
    line-height: 1;
  }

  .nav-title {
    max-width: 100%;
    overflow: hidden;
    font-size: 11px;
    font-weight: 500;
    line-height: 1.1;
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
    height: var(--pure-mobile-tab-height);
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
<style lang="scss">
html.qiming-native-webview.ua-mobile .nav-mobile-container {
  height: var(--pure-mobile-tab-height);
  padding-bottom: var(--pure-safe-area-bottom);
  background: var(--qiming-native-dock-bg);
  border-top-color: var(--qiming-native-dock-border);
  box-shadow: var(--qiming-native-dock-shadow);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  opacity: 1;
  isolation: isolate;
}

html.qiming-native-webview.ua-mobile.dark .nav-mobile-item {
  color: var(--qiming-native-text-secondary);

  &.active {
    color: var(--el-color-primary);
  }

  &:active {
    background: rgb(148 163 184 / 10%);
  }
}
</style>
