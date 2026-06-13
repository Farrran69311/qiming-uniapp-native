<template>
  <div class="ai-chat-module h-full flex flex-col bg-transparent">
    <!-- 顶部精简导航 -->
    <div
      class="ai-chat-module-topbar flex items-center justify-between p-4 bg-white/50 backdrop-blur-md rounded-t-2xl border-b border-gray-100 z-10"
    >
      <div class="ai-chat-module-course flex items-center gap-2">
        <el-tag size="small" effect="plain" round class="animate-pulse">{{
          activeCourse
        }}</el-tag>
      </div>
      <div class="ai-chat-module-actions flex items-center gap-3">
        <el-button-group>
          <el-button
            :icon="RefreshRight"
            class="!rounded-lg hover:rotate-180 transition-all duration-500 hover:!border-primary/50 hover:!shadow-[0_0_10px_rgba(94,127,248,0.3)]"
          />
          <el-button
            :icon="More"
            class="!rounded-lg hover:scale-110 transition-all duration-300 hover:!border-primary/50 hover:!shadow-[0_0_10px_rgba(94,127,248,0.3)]"
          />
        </el-button-group>
      </div>
    </div>

    <!-- 消息流：移除背景修饰文字，保持纯净 -->
    <el-scrollbar ref="scrollbarRef" class="flex-1 px-4 py-6 scroll-smooth">
      <transition-group
        appear
        name="chat-list"
        tag="div"
        class="w-full space-y-5 pb-10"
      >
        <div
          v-for="msg in visibleMessages"
          :key="msg.id"
          :class="[
            'chat-message-row',
            msg.type === 'user' ? 'is-user' : 'is-system'
          ]"
        >
          <el-avatar
            v-if="msg.type === 'system'"
            :size="getMessageAvatarSize(msg)"
            :src="getMessageAvatar(msg)"
            :icon="Cpu"
            class="message-avatar assistant-message-avatar"
          />
          <div
            :class="[
              'message-stack',
              msg.type === 'user' ? 'is-user' : 'is-system'
            ]"
          >
            <!-- 消息气泡 -->
            <div
              :class="[
                'message-bubble',
                msg.type === 'user'
                  ? 'message-bubble-user'
                  : 'message-bubble-system',
                isMessagePending(msg) ? 'is-pending' : ''
              ]"
            >
              <div
                v-if="isMessagePending(msg)"
                class="typing-indicator"
                aria-label="智能助教正在思考"
              >
                <span />
                <span />
                <span />
              </div>
              <div v-else class="message-content">
                {{ formatMessageContent(msg.content) }}
              </div>

              <!-- 资源卡片：多种形态 -->
              <transition-group
                appear
                name="stagger-list"
                tag="div"
                class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 relative z-10"
              >
                <div
                  v-for="(res, index) in msg.resources"
                  :key="res.title"
                  :style="{ transitionDelay: `${index * 100}ms` }"
                  class="flex flex-col gap-2 p-3 rounded-xl bg-gray-50/80 border border-gray-100 hover:border-primary/50 hover:bg-primary/5 cursor-pointer shadow-sm hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300 group"
                  @click="emit('preview', res)"
                >
                  <div
                    v-if="res.type === 'video'"
                    class="h-24 w-full bg-gray-800 rounded-lg relative overflow-hidden flex items-center justify-center group-hover:shadow-inner"
                  >
                    <div
                      class="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-300"
                    />
                    <el-icon
                      class="text-white text-3xl opacity-80 group-hover:scale-125 group-hover:text-primary transition-all duration-300 z-10"
                      ><VideoPlay
                    /></el-icon>
                    <div
                      class="absolute bottom-1 right-1 text-xs bg-black/60 text-white px-1.5 rounded z-10 font-mono"
                    >
                      03:45
                    </div>
                  </div>

                  <!-- 动画预览：栈操作可视化缩略图 -->
                  <div
                    v-else-if="res.type === 'animation'"
                    class="h-24 w-full rounded-lg relative overflow-hidden flex items-end justify-center gap-1 px-3 py-2 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 group-hover:shadow-inner"
                  >
                    <div
                      class="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-300"
                    />
                    <div class="flex flex-col-reverse gap-1 z-10">
                      <div
                        class="w-12 h-4 rounded bg-white/90 text-[10px] font-bold text-indigo-600 flex items-center justify-center shadow"
                      >
                        A
                      </div>
                      <div
                        class="w-12 h-4 rounded bg-white/80 text-[10px] font-bold text-purple-600 flex items-center justify-center shadow"
                      >
                        B
                      </div>
                      <div
                        class="w-12 h-4 rounded bg-white/70 text-[10px] font-bold text-pink-600 flex items-center justify-center shadow animate-bounce"
                      >
                        C
                      </div>
                    </div>
                    <div
                      class="absolute top-1 left-2 text-[10px] font-bold text-white/90 z-10"
                    >
                      Stack · LIFO
                    </div>
                    <div
                      class="absolute bottom-1 right-1 text-[10px] bg-black/40 text-white px-1.5 rounded z-10"
                    >
                      点击预览
                    </div>
                  </div>

                  <div class="flex items-start gap-2">
                    <el-icon
                      :class="[
                        'mt-0.5 text-lg transition-transform duration-300 group-hover:rotate-12',
                        res.type === 'video' ? 'text-red-500' : 'text-primary'
                      ]"
                    >
                      <component
                        :is="res.type === 'video' ? 'Film' : 'Document'"
                      />
                    </el-icon>
                    <div class="flex-1 min-w-0">
                      <p
                        class="text-sm font-bold text-gray-800 truncate group-hover:text-primary transition-colors"
                      >
                        {{ res.title }}
                      </p>
                      <p class="text-xs text-gray-400 truncate">
                        {{ res.desc || "AI 助教生成" }}
                      </p>
                    </div>
                  </div>
                </div>
              </transition-group>
            </div>
          </div>
          <el-avatar
            v-if="msg.type === 'user'"
            :size="getMessageAvatarSize(msg)"
            :src="getMessageAvatar(msg)"
            :icon="User"
            class="message-avatar"
          />
        </div>
      </transition-group>
    </el-scrollbar>

    <!-- 输入区：悬浮极简设计，带常驻选择器 -->
    <div class="p-4 bg-transparent z-10 w-full">
      <div class="w-full relative group">
        <!-- 发光的呼吸框 -->
        <div
          class="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-secondary/30 rounded-[24px] blur opacity-0 group-focus-within:opacity-100 group-focus-within:animate-pulse transition duration-500"
        />
        <div
          class="relative bg-white border border-gray-200 rounded-[24px] shadow-sm focus-within:shadow-lg focus-within:-translate-y-1 transition-all duration-300 overflow-hidden"
        >
          <!-- 输入框 -->
          <div class="flex items-end gap-2 p-2">
            <el-button
              :icon="Plus"
              class="!rounded-lg mb-1 hover:rotate-90 hover:bg-gray-100 transition-all duration-300 hover:!border-primary/50 hover:!shadow-[0_0_10px_rgba(94,127,248,0.3)]"
            />
            <el-input
              v-model="input"
              type="textarea"
              :autosize="{ minRows: 1, maxRows: 5 }"
              placeholder="随时提问，描述你的学习需求..."
              class="ai-input-base"
              @keydown.enter="handleEnter"
            />
            <el-button
              type="primary"
              :icon="Promotion"
              :loading="loading"
              :disabled="loading || !input.trim()"
              class="!rounded-lg mb-1 transform transition-all duration-300 hover:scale-110 hover:shadow-md hover:shadow-primary/40 active:scale-95 hover:!shadow-[0_0_12px_rgba(94,127,248,0.5)]"
              :class="
                input
                  ? 'scale-100 opacity-100 translate-x-0'
                  : 'scale-0 opacity-0 translate-x-4'
              "
              @click="handleSend"
            />
          </div>

          <!-- 常驻工具栏：课程 / 模式 / 智能体 / 思考模式 / 模型 -->
          <div
            class="flex items-center justify-between px-3 py-2 bg-gray-50/60 border-t border-gray-100"
          >
            <div class="flex flex-wrap items-center gap-1">
              <el-dropdown
                v-if="courses && courses.length"
                trigger="click"
                @command="c => emit('switch-course', c)"
              >
                <span
                  class="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-medium bg-primary/10 text-primary cursor-pointer hover:bg-primary/15 transition-colors"
                >
                  <el-icon class="mr-1 text-[13px]"><FolderOpened /></el-icon>
                  {{ activeCourse }}
                  <el-icon class="ml-1 text-xs"><ArrowDown /></el-icon>
                </span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      v-for="c in courses"
                      :key="c"
                      :command="c"
                    >
                      {{ c }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>

              <span
                class="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-medium text-gray-600 bg-gray-100"
              >
                <el-icon class="mr-1 text-[13px]"><Monitor /></el-icon>
                {{ mode }}
              </span>

              <el-dropdown
                trigger="click"
                @command="a => emit('update:selectedAgent', a)"
              >
                <span
                  class="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors"
                >
                  <el-icon class="mr-1 text-[13px]"><Cpu /></el-icon>
                  {{ selectedAgent }}
                  <el-icon class="ml-1 text-xs"><ArrowDown /></el-icon>
                </span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      v-for="agent in agents || []"
                      :key="agent.key"
                      :command="agent.key"
                    >
                      {{ agent.label }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>

              <el-dropdown
                trigger="click"
                @command="t => emit('update:thinkingMode', t)"
              >
                <span
                  class="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors"
                >
                  <el-icon class="mr-1 text-[13px]"><MagicStick /></el-icon>
                  {{ thinkingMode }}
                  <el-icon class="ml-1 text-xs"><ArrowDown /></el-icon>
                </span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      v-for="thinking in thinkingModes || []"
                      :key="thinking.key"
                      :command="thinking.key"
                    >
                      {{ thinking.label }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>

            <el-dropdown
              trigger="click"
              @command="m => emit('update:selectedModel', m)"
            >
              <span
                class="text-[11px] text-gray-400 font-medium tracking-wide flex items-center cursor-pointer hover:text-gray-600 transition-colors"
              >
                {{ selectedModel }}
                <el-icon class="ml-1"><ArrowDown /></el-icon>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="model in models || []"
                    :key="model.key"
                    :command="model.key"
                  >
                    {{ model.label }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from "vue";
import assistantAvatar from "@/assets/ai-app/assistant-avatar.png";
import {
  User,
  Cpu,
  Document,
  Film,
  VideoPlay,
  Promotion,
  Plus,
  RefreshRight,
  More,
  FolderOpened,
  Monitor,
  ArrowDown,
  MagicStick
} from "@element-plus/icons-vue";

const props = defineProps<{
  messages: any[];
  activeCourse: string;
  courses?: string[];
  mode?: string;
  agents?: { key: string; label: string; description?: string }[];
  models?: { key: string; label: string; description?: string }[];
  thinkingModes?: { key: string; label: string; description?: string }[];
  selectedAgent?: string;
  selectedModel?: string;
  thinkingMode?: string;
  loading?: boolean;
}>();

const emit = defineEmits([
  "send",
  "switch-course",
  "exit",
  "preview",
  "update:selectedAgent",
  "update:selectedModel",
  "update:thinkingMode"
]);
const input = ref("");

const scrollbarRef = ref();

const getMessageAvatar = (msg: any) => {
  if (msg.avatar) return msg.avatar;
  return msg.type === "user" ? "" : assistantAvatar;
};

const getMessageAvatarSize = (msg: any) => (msg.type === "system" ? 40 : 28);

const isMessagePending = (msg: any) =>
  msg.type === "system" && msg.streaming && !String(msg.content || "").trim();

const hasMessageContent = (msg: any) =>
  !!String(msg.content || "").trim() ||
  (Array.isArray(msg.resources) && msg.resources.length > 0);

const shouldRenderMessage = (msg: any) =>
  hasMessageContent(msg) || isMessagePending(msg);

const visibleMessages = computed(() =>
  (props.messages || []).filter(shouldRenderMessage)
);

const formatMessageContent = (content: unknown) => String(content || "").trim();

const handleEnter = (event: KeyboardEvent) => {
  if (event.isComposing || event.shiftKey) return;
  event.preventDefault();
  handleSend();
};

const handleSend = () => {
  const text = input.value.trim();
  if (!text || props.loading) return;
  emit("send", text);
  input.value = "";

  nextTick(() => {
    if (scrollbarRef.value) {
      // 添加滚动动画延迟，让消息先渲染完
      setTimeout(() => {
        scrollbarRef.value.setScrollTop(9999);
      }, 100);
    }
  });
};

watch(
  () => props.messages,
  () => {
    nextTick(() => {
      if (scrollbarRef.value) {
        setTimeout(() => {
          scrollbarRef.value.setScrollTop(9999);
        }, 100);
      }
    });
  },
  { deep: true }
);
</script>

<style scoped lang="scss">
:deep(.ai-input-base) {
  .el-textarea__inner {
    border: none !important;
    box-shadow: none !important;
    padding: 8px 12px;
    background: transparent;
    font-size: 14px;
    resize: none;
    transition: all 0.3s;
  }
  .el-textarea__inner:focus {
    background: transparent;
  }
}

.assistant-message-avatar {
  border: 2px solid #fff;
  box-shadow:
    0 0 0 1px rgba(94, 127, 248, 0.18),
    0 8px 18px rgba(94, 127, 248, 0.16);
}

.assistant-message-avatar :deep(img) {
  object-position: center 38%;
}

.chat-message-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
}

.chat-message-row.is-user {
  justify-content: flex-end;
}

.chat-message-row.is-system {
  justify-content: flex-start;
}

.message-avatar {
  flex: 0 0 auto;
  margin-top: 2px;
  background: #fff;
}

.message-stack {
  display: flex;
  flex-direction: column;
  max-width: min(76%, 900px);
}

.message-stack.is-user {
  align-items: flex-end;
  max-width: min(68%, 640px);
}

.message-bubble {
  position: relative;
  max-width: 100%;
  padding: 14px 16px;
  overflow: hidden;
  font-size: 15px;
  line-height: 1.75;
  overflow-wrap: anywhere;
  transition:
    transform 0.22s ease,
    box-shadow 0.22s ease,
    background 0.22s ease;
}

.chat-message-row:hover .message-bubble {
  transform: translateY(-1px);
}

.message-bubble-system {
  color: #253044;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(224, 229, 240, 0.9);
  border-radius: 16px 18px 18px 6px;
  box-shadow: 0 8px 24px rgba(44, 58, 87, 0.08);
}

.message-bubble.is-pending {
  width: auto;
  min-width: 60px;
  padding: 8px 12px;
}

.message-bubble-user {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: auto;
  min-height: 44px;
  padding: 8px 14px;
  color: #fff;
  background: linear-gradient(135deg, #4097f4 0%, #2f7ee8 100%);
  border-radius: 18px 6px 18px 18px;
  box-shadow: 0 10px 22px rgba(47, 126, 232, 0.2);
  line-height: 1.35;
}

.message-bubble-user .message-content {
  line-height: 1.35;
}

.message-content {
  position: relative;
  z-index: 1;
  white-space: pre-wrap;
}

.typing-indicator {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 44px;
  height: 22px;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  background: #8da2c8;
  border-radius: 999px;
  animation: typing-pulse 1.2s ease-in-out infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.16s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.32s;
}

@keyframes typing-pulse {
  0%,
  80%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }

  40% {
    opacity: 1;
    transform: translateY(-3px);
  }
}

/* 消息列表过渡动画 */
.chat-list-enter-active,
.chat-list-leave-active {
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.chat-list-enter-from,
.chat-list-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}

/* 资源卡片交错出现动画 */
.stagger-list-enter-active,
.stagger-list-leave-active {
  transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.stagger-list-enter-from,
.stagger-list-leave-to {
  opacity: 0;
  transform: translateY(15px) scale(0.9);
}

::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-thumb {
  background: #e5e7eb;
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: #d1d5db;
}
</style>

<style scoped lang="scss">
:global(.ai-app-root.is-native-mobile-workspace) {
  .ai-chat-module-topbar {
    min-height: 64px;
    padding-left: 70px;
    gap: 10px;
  }

  .ai-chat-module-course {
    min-width: 0;

    :deep(.el-tag) {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .ai-chat-module-actions {
    flex-shrink: 0;
  }
}

@media (max-width: 768px) {
  :global(.ai-app-root.is-native-mobile-workspace) {
    .ai-chat-module-topbar {
      padding-top: 12px;
      padding-right: 12px;
      padding-bottom: 12px;
      border-top-left-radius: 24px;
      border-top-right-radius: 24px;
    }
  }
}
</style>
