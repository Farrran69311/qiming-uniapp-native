<template>
  <div class="ai-sidebar h-full flex flex-col p-4 bg-transparent italic-safe">
    <!-- Sessions: Grouped by Course -->
    <div
      class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 custom-scrollbar space-y-6"
    >
      <!-- 1. 智能辅导 (按课程展开) -->
      <div v-show="activeRail === 'chat'">
        <div v-for="course in courses" :key="course" class="mb-4">
          <!-- 课程分类标题栏 + 新建按钮 -->
          <div
            class="text-sm font-semibold text-gray-700 tracking-normal mb-2 px-3 flex items-center justify-between group/course cursor-pointer"
          >
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-2 border-0 bg-transparent p-0 text-left"
              :aria-expanded="!collapsedCourses.includes(course)"
              @click="toggleCourse(course)"
            >
              <el-icon
                class="text-primary/70 transition-transform duration-300"
                :class="{ '-rotate-90': collapsedCourses.includes(course) }"
              >
                <ArrowDown />
              </el-icon>
              <el-icon class="text-primary/70"><Reading /></el-icon>
              <span class="min-w-0 flex-1 truncate">{{ course }}</span>
            </button>
            <div class="flex items-center gap-1">
              <el-tooltip content="新建该课程的辅导会话" placement="right">
                <el-button
                  text
                  :icon="Plus"
                  class="ai-sidebar__course-add opacity-0 group-hover/course:opacity-100 transition-opacity duration-150"
                  @click.stop="$emit('new-chat', { course })"
                />
              </el-tooltip>
            </div>
          </div>

          <el-collapse-transition>
            <div v-show="!collapsedCourses.includes(course)">
              <transition-group appear name="list" tag="div" class="space-y-1">
                <button
                  v-for="(conv, index) in groupedConversations[course] || []"
                  :key="conv.id"
                  type="button"
                  :style="{ transitionDelay: `${index * 50}ms` }"
                  class="relative w-full box-border overflow-hidden px-3 py-3 rounded-xl bg-transparent text-left hover:bg-white cursor-pointer group transition-all duration-200 hover:shadow-sm hover:border-gray-200 border border-transparent"
                  @click="emit('select-chat', conv)"
                >
                  <div
                    class="flex items-center justify-between gap-2 relative overflow-hidden"
                  >
                    <span
                      class="text-[15px] text-gray-600 truncate group-hover:text-primary group-hover:font-medium transition-colors duration-200 relative z-10"
                      :title="
                        conv.legacy_read_only
                          ? '历史会话，仅供查看'
                          : conv.title
                      "
                    >
                      {{ conv.title }}
                    </span>
                    <span
                      v-if="conv.legacy_read_only"
                      class="text-[11px] text-amber-600 whitespace-nowrap"
                    >
                      只读
                    </span>
                  </div>
                </button>
              </transition-group>
            </div>
          </el-collapse-transition>
        </div>
      </div>

      <!-- 2. 最近聊天记录 (全局历史) -->
      <div class="mt-8">
        <div
          class="text-sm font-medium text-gray-400 tracking-normal mb-3 px-3 flex items-center gap-2"
        >
          <el-icon><Timer /></el-icon>
          <span>历史记录</span>
        </div>
        <div class="space-y-1">
          <button
            v-for="conv in recentHistory"
            :key="'recent-' + conv.id"
            type="button"
            class="relative w-full box-border overflow-hidden px-3 py-2.5 rounded-xl bg-transparent text-left hover:bg-white cursor-pointer group transition-all duration-200 border border-transparent hover:border-gray-100"
            @click="emit('select-chat', conv)"
          >
            <div class="flex items-center justify-between gap-2">
              <span
                class="text-sm text-gray-500 truncate group-hover:text-gray-700"
                :title="
                  conv.legacy_read_only ? '历史会话，仅供查看' : conv.title
                "
              >
                {{ conv.title }}
              </span>
              <span
                v-if="conv.course"
                class="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded italic"
              >
                {{ conv.course }}
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>

    <div class="ai-sidebar__digital-human-reserve" aria-hidden="true" />

    <!-- User Profile Area -->
    <div
      class="mt-auto pt-4 border-t border-gray-100 flex items-center gap-3 relative overflow-hidden group cursor-pointer rounded-xl p-2 hover:bg-white hover:shadow-sm transition-colors duration-200"
    >
      <img
        :src="avatarSrc"
        alt="user avatar"
        class="w-8 h-8 rounded-full object-cover shadow-sm border border-white"
        @error="handleAvatarError"
      />
      <div class="flex-1 min-w-0 relative z-10">
        <p
          class="text-sm font-semibold text-gray-700 truncate group-hover:text-primary transition-colors"
        >
          系统设置
        </p>
        <p
          class="text-xs text-gray-400 truncate group-hover:text-gray-500 transition-colors"
        >
          当前版本
        </p>
      </div>
      <el-icon
        class="text-gray-300 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0 z-10"
        ><ArrowRight
      /></el-icon>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Plus,
  ArrowRight,
  Reading,
  Timer,
  ArrowDown
} from "@element-plus/icons-vue";
import { computed, onMounted, ref, watch } from "vue";
import DefaultAvatar from "@/assets/user.jpg";
import { getUserDetail } from "@/api/user";
import { useUserStoreHook } from "@/store/modules/user";
import { formatAvatar } from "@/utils/avatar";

const props = defineProps<{
  activeRail: string;
  conversations: any[];
  courses: string[];
}>();

const groupedConversations = computed(() => {
  const groups: Record<string, any[]> = {};
  props.courses.forEach(course => {
    groups[course] = props.conversations.filter(c => c.course === course);
  });
  return groups;
});

const recentHistory = computed(() => {
  return props.conversations.slice(0, 5);
});

const collapsedCourses = ref<string[]>([]);
const userStore = useUserStoreHook();
const avatarSrc = ref(formatAvatar(userStore.avatar));

watch(
  () => userStore.avatar,
  avatar => {
    avatarSrc.value = formatAvatar(avatar);
  },
  { immediate: true }
);

const handleAvatarError = () => {
  avatarSrc.value = DefaultAvatar;
};

const toggleCourse = (course: string) => {
  const index = collapsedCourses.value.indexOf(course);
  if (index > -1) {
    collapsedCourses.value.splice(index, 1);
  } else {
    collapsedCourses.value.push(course);
  }
};

onMounted(() => {
  getUserDetail()
    .then(res => {
      const userInfo = res?.data?.userInfo;
      if (!userInfo) return;

      if (userInfo.avatar !== undefined) {
        userStore.SET_AVATAR(userInfo.avatar || "");
      }
      if (userInfo.nickname) {
        userStore.SET_NICKNAME(userInfo.nickname);
      }
    })
    .catch(error => {
      console.error("[AiSidebar] 获取用户信息失败:", error);
    });
});

const emit = defineEmits(["update:activeRail", "new-chat", "select-chat"]);
</script>

<style scoped>
.italic-safe {
  font-style: normal;
}

.ai-sidebar {
  position: relative;
  min-width: 0;
  overflow: visible;
}

.ai-sidebar__digital-human-reserve {
  flex: 0 0 132px;
  margin: 0 0 10px;
}

.ai-sidebar__course-add {
  width: 28px;
  height: 28px;
  padding: 0;
  color: #64748b;
  background: transparent;
  border: 0;
  box-shadow: none;
}

.ai-sidebar__course-add:hover,
.ai-sidebar__course-add:focus {
  color: #3f6ef2;
  background: #f1f5f9;
  border: 0;
  box-shadow: none;
}

/* 列表进入过渡 */
.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* 自定义淡入动画 */
@keyframes fadeInRight {
  from {
    opacity: 0;
    transform: translateX(-5px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
.animate-fade-in-right {
  animation: fadeInRight 0.3s ease-out forwards;
}

/* 滚动条美化 */
.custom-scrollbar::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: transparent;
}

.custom-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
</style>
