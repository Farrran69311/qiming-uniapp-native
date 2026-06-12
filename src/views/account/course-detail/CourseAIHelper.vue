<template>
  <div class="ai-helper-sections" :class="currentTheme">
    <!-- AI 助教入口框 -->
    <div class="out-ai-showbox-pro">
      <div class="out-ai-pro-talk-box glow-border">
        <div class="inset-div">
          <div class="photo">
            <img :src="aiPeopleAvatar" alt="" />
          </div>
          <div class="ai-hepler-pro-box">
            <div class="people-name">AI助教</div>
            <div class="init-talk-cotent">Hi～我是您的AI助教</div>
          </div>
          <div class="ai-hepler-pro-input">
            <div class="el-input">
              <input
                type="text"
                autocomplete="off"
                placeholder="输入您的问题，与AI助教互动问答..."
                class="el-input__inner"
                style="padding-right: 40px; padding-left: 10px; font-size: 14px"
                @click="openAiDialog"
              />
            </div>
            <span class="mock-send-btn" @click="openAiDialog">
              <SendIcon />
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- AI 展开对话框 -->
    <transition name="ai-slide">
      <div
        v-if="isAiDialogVisible"
        ref="aiDialogRef"
        class="ai-draggable-dialog auto"
        :class="{ fullscreen: isFullscreen }"
      >
        <div class="ai-dialog-header-bar">
          <div class="header-left">
            <div
              class="header-back-btn spotlight-button"
              @click="closeAiDialog"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                stroke="#97b4f7"
                stroke-width="4"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </div>
          </div>
          <div class="header-title-wrap">
            <span class="status-dot" />
            <span class="header-title">AI 智能助教</span>
          </div>
          <div class="header-right">
            <el-tooltip
              :content="isFullscreen ? '退出全屏' : '全屏显示'"
              placement="top"
            >
              <div class="header-action-btn" @click="toggleFullscreen">
                <svg
                  v-if="!isFullscreen"
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
                <svg
                  v-else
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="9 3 3 3 3 9" />
                  <polyline points="15 21 21 21 21 15" />
                  <line x1="3" y1="3" x2="10" y2="10" />
                  <line x1="21" y1="21" x2="14" y2="14" />
                </svg>
              </div>
            </el-tooltip>
            <el-tooltip content="清空对话" placement="top">
              <div class="header-action-btn" @click="clearChat">
                <i class="el-icon-delete" />
              </div>
            </el-tooltip>
            <div class="header-action-btn close-btn" @click="closeAiDialog">
              <i class="el-icon-close" />
            </div>
          </div>
        </div>

        <div class="ai-fill-bg">
          <div class="dialog-content">
            <div class="ai-talk-box">
              <el-scrollbar
                ref="scrollbarRef"
                style="box-sizing: border-box; height: 100%"
              >
                <div class="header-tips-box">
                  <div class="robbot-icon">
                    <img
                      :src="aiPeopleAvatar"
                      alt=""
                      style="transform: scaleX(-1)"
                    />
                  </div>
                  <div class="code-icon">
                    <img
                      src="@/assets/course-detail-images/course-detail-icon2.png"
                      alt=""
                    />
                  </div>
                  <p class="code-hello">Hi～我是您的AI助教</p>
                  <div class="ai-heler-header-tips">
                    课程学习中欢迎随时提问，我将全力为您答疑解惑，共同进步哦！
                  </div>
                </div>

                <transition-group
                  name="chat-list"
                  tag="div"
                  class="chat-messages-list"
                >
                  <div
                    v-for="(message, index) in chatMessages"
                    :key="index"
                    class="chat-message-item"
                    :class="
                      message.role === 'user' ? 'user-message' : 'ai-message'
                    "
                  >
                    <div class="ai-chat-share-container_nVXTe">
                      <div class="chat-common_3Wk2t margin-bottom-16">
                        <div
                          :class="
                            message.role === 'user'
                              ? 'question-container_2GfLA'
                              : 'answer-box-wrapper_1QYRS'
                          "
                        >
                          <div
                            :class="
                              message.role === 'user'
                                ? 'question-content_1e1fE'
                                : 'answer-content-box_2Pu7S'
                            "
                          >
                            <div v-if="message.role === 'user'">
                              {{ message.content }}
                            </div>
                            <div v-else class="markdown-content">
                              <p
                                class="result"
                                v-html="parseMarkdown(message.content)"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div v-if="isTyping" key="typing">
                    <div class="ai-chat-share-container_nVXTe">
                      <div class="chat-common_3Wk2t margin-bottom-16">
                        <div
                          class="answer-box-wrapper_1QYRS full-line_3ITtH chat-ans_1oSN6"
                        >
                          <div
                            class="answer-content-box_2Pu7S chat-answer-content-box"
                          >
                            <div class="markdown-content">
                              <p class="result">
                                <span class="typing-dot">.</span>
                                <span class="typing-dot">.</span>
                                <span class="typing-dot">.</span>
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </transition-group>
              </el-scrollbar>
            </div>
            <div class="talk-input-box">
              <div class="input-box">
                <div class="ai-pro-content-edit-box">
                  <div class="input-fill-box-new">
                    <div class="el-textarea">
                      <textarea
                        v-model="currentMessage"
                        autocomplete="off"
                        placeholder="请输入您的问题"
                        maxlength="300"
                        class="el-textarea__inner"
                        :class="{ 'has-content': currentMessage.trim() }"
                        @keydown.enter.prevent="sendMessage"
                      />
                    </div>
                  </div>
                  <div
                    class="add-new-talk"
                    :class="{ 'not-allowed': !currentMessage.trim() }"
                  >
                    <AddNewTalkIcon />
                  </div>
                </div>
                <div
                  :class="
                    currentMessage.trim() && !sendingMessage
                      ? 'send-btn'
                      : 'not-send-btn'
                  "
                  @click="sendMessage"
                >
                  <NotSendBtnIcon
                    v-if="!currentMessage.trim() || sendingMessage"
                  />
                  <SendIcon v-else />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import SendIcon from "@/assets/course-icons/send-icon.svg?component";
import AddNewTalkIcon from "@/assets/course-icons/add-new-talk-icon.svg?component";
import NotSendBtnIcon from "@/assets/course-icons/not-send-btn.svg?component";
import {
  courseAIChatStream,
  getConversationHistory
} from "@/api/frontend/chat";

const props = defineProps<{
  courseId: number;
  currentTheme: string;
  chapterId: number | null;
}>();

const aiPeopleAvatar = `${import.meta.env.BASE_URL}virtualpeopleanimation/virtual_people_pic.png`;

const isAiDialogVisible = ref(false);
const isFullscreen = ref(false);
const aiDialogRef = ref(null);
const scrollbarRef = ref(null);
const chatMessages = ref<
  Array<{ role: string; content: string; timestamp: string }>
>([]);
const currentMessage = ref("");
const sendingMessage = ref(false);
const isTyping = ref(false);
const conversationId = ref("");
const previousChapterId = ref<number | null>(null);
const cancelStreamRequest = ref<any>(null);

//监听聊天记录变化，自动滚动到底部
watch(
  () => chatMessages.value,
  () => {
    nextTick(() => {
      scrollToBottom();
    });
  },
  { deep: true }
);

// 监听对话框显示，添加外部点击监听
watch(isAiDialogVisible, newVal => {
  if (newVal) {
    nextTick(() => {
      document.addEventListener("click", handleClickOutside);
    });
  } else {
    document.removeEventListener("click", handleClickOutside);
  }
});

const scrollToBottom = () => {
  if (scrollbarRef.value) {
    const scrollEl = (scrollbarRef.value as any).$el.querySelector(
      ".el-scrollbar__wrap"
    );
    if (scrollEl) {
      scrollEl.scrollTop = scrollEl.scrollHeight;
    }
  }
};

const openAiDialog = () => {
  isAiDialogVisible.value = true;
};

const closeAiDialog = () => {
  isAiDialogVisible.value = false;
  isFullscreen.value = false;
  if (cancelStreamRequest.value) {
    cancelStreamRequest.value();
    cancelStreamRequest.value = null;
  }
};

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value;
};

const handleEscapeKey = (event: KeyboardEvent) => {
  if (!isAiDialogVisible.value || event.key !== "Escape") return;
  if (isFullscreen.value) {
    isFullscreen.value = false;
    return;
  }
  closeAiDialog();
};

const handleClickOutside = (event: MouseEvent) => {
  if (!aiDialogRef.value) return;
  const target = event.target as HTMLElement;
  if (
    aiDialogRef.value &&
    !(aiDialogRef.value as any).contains(target) &&
    !target.closest(".out-ai-showbox-pro")
  ) {
    closeAiDialog();
  }
};

const initChat = () => {
  const storedConversationId = localStorage.getItem(`chat_${props.courseId}`);
  if (storedConversationId) {
    conversationId.value = storedConversationId;
    loadChatHistory();
  } else {
    conversationId.value =
      Date.now().toString() + Math.random().toString(36).substring(2);
    localStorage.setItem(`chat_${props.courseId}`, conversationId.value);
    previousChapterId.value = props.chapterId;
  }
};

const loadChatHistory = async () => {
  try {
    const response = await getConversationHistory(conversationId.value);
    if (response?.history) {
      chatMessages.value = response.history;
    }
  } catch (error) {
    console.error("加载聊天历史失败:", error);
  }
};

const sendMessage = async () => {
  if (!currentMessage.value.trim() || sendingMessage.value) return;

  const userMessage = currentMessage.value.trim();
  const currentChapterId = props.chapterId;

  if (
    currentChapterId !== null &&
    previousChapterId.value !== null &&
    currentChapterId !== previousChapterId.value
  ) {
    conversationId.value =
      Date.now().toString() + Math.random().toString(36).substring(2);
    localStorage.setItem(`chat_${props.courseId}`, conversationId.value);
    chatMessages.value = [];
  }

  previousChapterId.value = currentChapterId;

  chatMessages.value.push({
    role: "user",
    content: userMessage,
    timestamp: new Date().toISOString()
  });

  currentMessage.value = "";
  sendingMessage.value = true;
  isTyping.value = true;

  try {
    let aiMessageAdded = false;
    let currentResponseIndex = -1;

    cancelStreamRequest.value = courseAIChatStream(
      {
        course_id: props.courseId,
        conversation_id: conversationId.value,
        message: userMessage,
        chapter_id: currentChapterId
      },
      data => {
        if (data.conversation_id) {
          conversationId.value = data.conversation_id;
          localStorage.setItem(`chat_${props.courseId}`, conversationId.value);
        }

        if (data.delta) {
          if (!aiMessageAdded) {
            isTyping.value = false;
            aiMessageAdded = true;
            currentResponseIndex = chatMessages.value.length;
            chatMessages.value.push({
              role: "ai",
              content: data.delta,
              timestamp: new Date().toISOString()
            });
          } else {
            chatMessages.value[currentResponseIndex].content += data.delta;
          }
        }

        if (data.finished) {
          sendingMessage.value = false;
          isTyping.value = false;
        }
      }
    );
  } catch (error) {
    console.error("发送消息失败:", error);
    ElMessage.error("发送失败，请重试");
    chatMessages.value.push({
      role: "ai",
      content: "抱歉，发生了错误，请稍后重试。",
      timestamp: new Date().toISOString()
    });
    sendingMessage.value = false;
    isTyping.value = false;
  }
};

const parseMarkdown = (text: string) => {
  if (!text) return "";
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\\n/g, "<br>");
};

const clearChat = () => {
  ElMessageBox.confirm("确定要清空所有聊天记录吗？", "提示", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning",
    customClass: "clear-chat-confirm-dialog"
  })
    .then(() => {
      chatMessages.value = [];
      ElMessage.success("聊天记录已清空");
    })
    .catch(() => {});
};

onMounted(() => {
  initChat();
  document.addEventListener("keydown", handleEscapeKey);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
  document.removeEventListener("keydown", handleEscapeKey);
});

defineExpose({
  isAiDialogVisible,
  openAiDialog,
  closeAiDialog,
  handleExternalSend: (content: string) => {
    currentMessage.value = content;
    sendMessage();
  }
});
</script>

<style scoped lang="scss">
@keyframes ai-border-marquee {
  0% {
    background-position: 0% 0%;
  }

  100% {
    background-position: 200% 0%;
  }
}

@keyframes dot-pulse {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(1);
  }

  50% {
    opacity: 1;
    transform: scale(1.3);
  }
}

.ai-helper-sections {
  position: relative;

  .out-ai-showbox-pro {
    position: fixed;
    top: 5.8333vw;
    right: 1vw;
    z-index: 100;
    width: 25vw;
    height: 10.4167vw;
  }

  .out-ai-pro-talk-box {
    position: relative;
    overflow: hidden;
    background: rgb(255 255 255 / 5%);
    border-radius: 12px;
    transition: all 0.3s ease;

    &::after {
      position: absolute;
      inset: 0;
      padding: 1.5px;
      pointer-events: none;
      content: "";
      background: linear-gradient(90deg, #97b4f7, #604ffd, #97b4f7);
      background-size: 200% 100%;
      border-radius: inherit;
      mask:
        linear-gradient(#fff 0 0) content-box,
        linear-gradient(#fff 0 0);
      mask-composite: exclude;
      animation: ai-border-marquee 3s linear infinite;
    }
  }

  .ai-draggable-dialog {
    position: fixed;
    top: calc(5.8333vw + 10.4167vw + 0.5vw);
    right: 1vw;
    z-index: 999;
    display: flex;
    flex-direction: column;
    width: 25vw;
    height: 600px;
    background: rgb(255 255 255 / 60%);
    border: 1px solid rgb(255 255 255 / 30%);
    border-radius: 20px;
    box-shadow: -10px 0 40px rgb(0 0 0 / 10%);
    backdrop-filter: blur(25px) saturate(150%);

    &.dark {
      background: rgb(30 30 30 / 70%);
      border: 1px solid rgb(255 255 255 / 10%);
    }

    &.fullscreen {
      top: 0;
      right: 0;
      width: 100vw;
      height: 100vh;
      border-radius: 0;
      box-shadow: none;
      backdrop-filter: blur(20px) saturate(150%);
    }
  }

  .ai-fill-bg {
    display: flex;
    flex: 1;
    flex-direction: column;
    overflow: hidden;
    background: transparent;
    border: none;

    .dialog-content {
      flex: 1;
      overflow: hidden;
    }
  }

  .el-textarea__inner {
    height: 40px;
    min-height: 40px;
    padding-top: 0;
    padding-right: 40px;
    padding-bottom: 0;
    line-height: 40px;

    &.has-content {
      min-height: 40px;
      padding-right: 40px;
      line-height: 1.5;
    }
  }
}

.ai-dialog-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgb(0 0 0 / 5%);
}

.header-back-btn {
  position: absolute;
  top: 50%;
  left: -45px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  cursor: pointer;
  background: rgb(255 255 255 / 90%);
  border: 1px solid rgb(64 158 255 / 20%);
  border-radius: 10px;
  box-shadow: -4px 4px 12px rgb(0 0 0 / 10%);
  transform: translateY(-50%);
}

.ai-draggable-dialog.fullscreen .header-back-btn {
  display: none;
}

.ai-slide-enter-active,
.ai-slide-leave-active {
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.ai-slide-enter-from,
.ai-slide-leave-to {
  opacity: 0;
  transform: translateX(100%) scale(0.9);
}

.typing-dot {
  display: inline-block;
  margin: 0 2px;
  font-weight: bold;
  color: #97b4f7;
  animation: dot-pulse 1.5s infinite;
}

.markdown-content {
  font-size: 14px;
  line-height: 1.6;
}

.question-content_1e1fE {
  padding: 12px 16px;
  color: white;
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  border-radius: 18px 18px 2px;
}

.answer-content-box_2Pu7S {
  padding: 12px 16px;
  background: #f4f7f9;
  border: 1px solid #eef2f5;
  border-radius: 18px 18px 18px 2px;

  &.dark {
    color: #e0e0e0;
    background: #2c2c2c;
    border-color: #444;
  }
}

/* 包含必要的 AI 相关样式 */
</style>
