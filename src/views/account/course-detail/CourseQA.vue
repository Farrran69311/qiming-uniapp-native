<template>
  <!-- 课程留言板页面 -->
  <div v-show="visible" class="message-board-wrapper" :class="currentTheme">
    <!-- 头部 -->
    <CourseHeader
      :current-theme="currentTheme"
      title="课程讨论区"
      :user-avatar="userAvatar"
      :user-nickname="userNickname"
      @go-back="$emit('go-back')"
      @toggle-theme="e => $emit('toggle-theme', e)"
      @go-to-account="$emit('go-to-account')"
      @logout="$emit('logout')"
    />

    <div
      v-infinite-scroll="loadMore"
      class="message-board-container"
      :class="currentTheme"
      :infinite-scroll-disabled="!hasMore || isLoadingMore"
      :infinite-scroll-distance="100"
    >
      <!-- 主内容区域 -->
      <div class="board-main-content">
        <!-- 左侧：留言列表 -->
        <div class="board-left-panel">
          <!-- 搜索和筛选栏 -->
          <div class="board-toolbar">
            <div class="search-box">
              <el-input
                v-model="searchKeyword"
                placeholder="搜索讨论内容..."
                :prefix-icon="Search"
                clearable
                @keyup.enter="handleSearch"
              />
            </div>
            <div class="filter-tabs">
              <button
                v-for="tab in filterTabs"
                :key="tab.value"
                class="filter-tab"
                :class="{ active: activeFilter === tab.value }"
                @click="activeFilter = tab.value"
              >
                <component :is="tab.icon" v-if="tab.icon" class="tab-icon" />
                {{ tab.label }}
                <span v-if="tab.count" class="tab-count">{{ tab.count }}</span>
              </button>

              <div style="flex: 1" />
              <el-tooltip content="刷新列表" placement="top">
                <el-button
                  :icon="Refresh"
                  circle
                  class="board-refresh-btn"
                  :loading="isLoading"
                  @click="refreshData"
                />
              </el-tooltip>
            </div>
          </div>

          <!-- 留言列表 -->
          <div class="messages-list">
            <TransitionGroup name="message-list">
              <div
                v-for="message in filteredMessages"
                :key="message.id"
                class="message-card"
                :class="{
                  pinned: message.isPinned,
                  pending: message.status === 'pending',
                  rejected: message.status === 'rejected'
                }"
              >
                <!-- 消息头部 -->
                <div class="message-header">
                  <div class="author-info">
                    <el-avatar
                      :size="42"
                      :src="formatAvatar(message.author.avatar)"
                      class="author-avatar"
                    />
                    <div class="author-details">
                      <div class="author-name">
                        {{ message.author.name }}
                        <el-tag
                          v-if="message.author.isTeacher"
                          type="primary"
                          size="small"
                          effect="dark"
                          class="role-tag"
                        >
                          教师
                        </el-tag>
                        <el-tag
                          v-if="message.author.isAdmin"
                          type="danger"
                          size="small"
                          effect="dark"
                          class="role-tag"
                        >
                          管理员
                        </el-tag>
                      </div>
                      <div class="post-meta">
                        <span class="post-time">
                          <el-icon><Clock /></el-icon>
                          {{ formatRelativeTime(message.createdAt) }}
                        </span>
                        <span v-if="message.editedAt" class="edited-mark">
                          (已编辑)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="header-right-actions">
                    <!-- 置顶标签 -->
                    <div v-if="message.isPinned" class="pinned-badge">
                      <el-icon><Top /></el-icon>
                      置顶
                    </div>

                    <!-- 审核状态标签 -->
                    <div
                      v-if="message.status === 'pending'"
                      class="status-badge pending"
                    >
                      <el-icon><Clock /></el-icon>
                      审核中
                    </div>
                    <div
                      v-if="message.status === 'rejected'"
                      class="status-badge rejected"
                    >
                      <el-icon><CircleClose /></el-icon>
                      未通过
                    </div>

                    <el-dropdown
                      v-if="canManageMessage(message)"
                      trigger="click"
                      popper-class="more-actions-dropdown"
                    >
                      <button class="more-actions-btn">
                        <el-icon><MoreFilled /></el-icon>
                      </button>
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item @click="handleEditMessage(message)">
                            <el-icon><Edit /></el-icon>
                            编辑
                          </el-dropdown-item>
                          <el-dropdown-item
                            @click="handleDeleteMessage(message)"
                          >
                            <el-icon><Delete /></el-icon>
                            删除
                          </el-dropdown-item>
                          <el-dropdown-item
                            v-if="isTeacherOrAdmin"
                            @click="handleTogglePin(message)"
                          >
                            <el-icon><Top /></el-icon>
                            {{ message.isPinned ? "取消置顶" : "置顶" }}
                          </el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                  </div>
                </div>

                <!-- 消息内容 -->
                <div class="message-body">
                  <h3 v-if="message.title" class="message-title">
                    {{ message.title }}
                  </h3>
                  <div
                    class="message-content"
                    :class="{
                      collapsed: message.isCollapsed && !message.expanded
                    }"
                    v-html="
                      message.contentHtml ||
                      parseMarkdownContent(message.content)
                    "
                  />
                  <button
                    v-if="message.isCollapsed"
                    class="expand-btn"
                    @click="message.expanded = !message.expanded"
                  >
                    {{ message.expanded ? "收起" : "展开全文" }}
                    <el-icon>
                      <ArrowUp v-if="message.expanded" />
                      <ArrowDown v-else />
                    </el-icon>
                  </button>

                  <!-- 标签 -->
                  <div v-if="message.tags?.length" class="message-tags">
                    <el-tag
                      v-for="tag in message.tags"
                      :key="tag"
                      size="small"
                      effect="plain"
                      class="tag-item"
                    >
                      {{ tag }}
                    </el-tag>
                  </div>
                </div>

                <!-- 消息底部操作栏 -->
                <div class="message-footer">
                  <div class="action-buttons">
                    <button
                      class="action-btn"
                      :class="{ active: message.isLiked }"
                      @click="handleLike(message)"
                    >
                      <el-icon>
                        <component :is="message.isLiked ? StarFilled : Star" />
                      </el-icon>
                      <span>{{ message.likeCount || 0 }}</span>
                    </button>
                    <button
                      class="action-btn"
                      @click="handleShowReplies(message)"
                    >
                      <el-icon><ChatDotRound /></el-icon>
                      <span>{{ message.replyCount || 0 }} 回复</span>
                    </button>
                    <button class="action-btn" @click="handleReply(message)">
                      <el-icon><Position /></el-icon>
                      <span>回复</span>
                    </button>
                    <button class="action-btn" @click="handleReport(message)">
                      <el-icon><Warning /></el-icon>
                      <span>举报</span>
                    </button>
                  </div>
                  <div class="view-count">
                    <el-icon><TrendCharts /></el-icon>
                    {{ message.viewCount || 0 }} 次浏览
                  </div>
                </div>

                <!-- 回复区域 -->
                <Transition name="fade-slide">
                  <div v-if="message.showReplies" class="replies-section">
                    <div class="replies-list">
                      <div
                        v-for="reply in message.replies"
                        :key="reply.id"
                        class="reply-item"
                      >
                        <el-avatar
                          :size="32"
                          :src="formatAvatar(reply.author.avatar)"
                        />
                        <div class="reply-content">
                          <div class="reply-header">
                            <span class="reply-author">{{
                              reply.author.name
                            }}</span>
                            <el-tag
                              v-if="reply.author.isTeacher"
                              type="primary"
                              size="small"
                              class="role-tag mini"
                            >
                              教师
                            </el-tag>
                            <span v-if="reply.replyTo" class="reply-to">
                              回复
                              <span class="reply-target"
                                >@{{ reply.replyTo }}</span
                              >
                            </span>
                            <span class="reply-time">
                              {{ formatRelativeTime(reply.createdAt) }}
                            </span>
                          </div>
                          <div
                            class="reply-text"
                            v-html="
                              reply.contentHtml ||
                              parseMarkdownContent(reply.content)
                            "
                          />
                          <div class="reply-actions">
                            <button
                              class="reply-action-btn"
                              :class="{ active: reply.isLiked }"
                              @click="handleLikeReply(message, reply)"
                            >
                              <el-icon><Star /></el-icon>
                              {{ reply.likeCount || 0 }}
                            </button>
                            <button
                              class="reply-action-btn"
                              @click="handleReplyToReply(message, reply)"
                            >
                              <el-icon><Position /></el-icon>
                              回复
                            </button>
                            <button
                              class="reply-action-btn"
                              @click="handleReportReply(message, reply)"
                            >
                              <el-icon><Warning /></el-icon>
                              举报
                            </button>
                            <button
                              v-if="reply.isOwner"
                              class="reply-action-btn"
                              @click="handleEditReply(message, reply)"
                            >
                              <el-icon><Edit /></el-icon>
                              编辑
                            </button>
                            <button
                              v-if="reply.isOwner"
                              class="reply-action-btn"
                              @click="handleDeleteReply(message, reply)"
                            >
                              <el-icon><Delete /></el-icon>
                              删除
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 加载更多回复 -->
                    <button
                      v-if="message.hasMoreReplies"
                      class="load-more-btn"
                      @click="loadMoreReplies(message)"
                    >
                      加载更多回复...
                    </button>
                  </div>
                </Transition>

                <!-- 快速回复输入框 -->
                <Transition name="fade-slide">
                  <div v-if="message.showReplyInput" class="quick-reply-box">
                    <el-avatar :size="36" :src="formatAvatar(userAvatar)" />
                    <div class="reply-input-wrapper">
                      <el-input
                        v-model="message.replyContent"
                        type="textarea"
                        :autosize="{ minRows: 1, maxRows: 4 }"
                        :placeholder="
                          message.replyPlaceholder || '写下你的回复...'
                        "
                        @keyup.enter.ctrl="submitReply(message)"
                      />
                      <div class="reply-input-actions">
                        <span class="hint">Ctrl + Enter 发送</span>
                        <el-button
                          type="primary"
                          class="submit-reply-btn"
                          :disabled="!message.replyContent?.trim()"
                          @click="submitReply(message)"
                        >
                          发送
                        </el-button>
                      </div>
                    </div>
                  </div>
                </Transition>
              </div>
            </TransitionGroup>

            <!-- 空状态 -->
            <div v-if="filteredMessages.length === 0" class="empty-state">
              <div class="empty-icon">
                <svg viewBox="0 0 24 24" width="80" height="80" fill="none">
                  <path
                    d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M8 9h8M8 13h4"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>
              </div>
              <h3>暂无讨论内容</h3>
              <p>成为第一个发起讨论的人吧！</p>
            </div>

            <!-- 加载更多 -->
            <div v-if="filteredMessages.length > 0" class="load-more-section">
              <template v-if="hasMore">
                <el-button
                  type="primary"
                  link
                  :loading="isLoadingMore"
                  class="load-more-btn-link"
                  @click="loadMore"
                >
                  {{ isLoadingMore ? "努力加载中..." : "滚动加载更多" }}
                </el-button>
              </template>
              <div v-else class="no-more-data">已经到底部了～</div>
            </div>
          </div>
        </div>

        <!-- 右侧：发帖和统计 -->
        <div class="board-right-panel">
          <!-- 发布新帖子 -->
          <div class="post-composer">
            <div class="composer-header">
              <el-avatar :size="40" :src="formatAvatar(userAvatar)" />
              <div class="composer-title">
                <h3>发起讨论</h3>
                <p>分享你的问题或想法</p>
              </div>
            </div>

            <div class="composer-body">
              <el-input
                v-model="newPost.title"
                placeholder="标题（可选）"
                class="title-input"
                maxlength="100"
                show-word-limit
              />

              <div class="content-editor">
                <el-input
                  v-model="newPost.content"
                  type="textarea"
                  :autosize="{ minRows: 4, maxRows: 12 }"
                  placeholder="请详细描述你的问题或想法...&#10;&#10;支持 Markdown 语法"
                  maxlength="5000"
                  show-word-limit
                />
                <div class="editor-toolbar">
                  <el-tooltip content="粗体 (Ctrl+B)" placement="top">
                    <button class="toolbar-btn" @click="insertMarkdown('bold')">
                      <strong>B</strong>
                    </button>
                  </el-tooltip>
                  <el-tooltip content="斜体 (Ctrl+I)" placement="top">
                    <button
                      class="toolbar-btn"
                      @click="insertMarkdown('italic')"
                    >
                      <em>I</em>
                    </button>
                  </el-tooltip>
                  <el-tooltip content="代码" placement="top">
                    <button class="toolbar-btn" @click="insertMarkdown('code')">
                      <code>&lt;/&gt;</code>
                    </button>
                  </el-tooltip>
                  <el-tooltip content="链接" placement="top">
                    <button class="toolbar-btn" @click="insertMarkdown('link')">
                      🔗
                    </button>
                  </el-tooltip>
                </div>
              </div>

              <div class="tags-input">
                <el-select
                  v-model="newPost.tags"
                  multiple
                  filterable
                  allow-create
                  default-first-option
                  placeholder="添加标签（可选）"
                  class="tags-select"
                  popper-class="tag-select-popper"
                >
                  <el-option
                    v-for="tag in availableTags"
                    :key="tag"
                    :label="tag"
                    :value="tag"
                  />
                </el-select>
              </div>

              <!-- 发布提示 -->
              <div class="post-notice">
                <el-icon><InfoFilled /></el-icon>
                <span>发布内容将经过审核，请遵守社区规范</span>
              </div>

              <el-button
                type="primary"
                class="submit-btn"
                :loading="isSubmitting"
                :disabled="!newPost.content?.trim()"
                @click="handleSubmitPost"
              >
                <el-icon><Position /></el-icon>
                发布讨论
              </el-button>
            </div>
          </div>

          <!-- 统计数据 -->
          <div class="stats-card">
            <h3 class="card-title">
              <el-icon><DataAnalysis /></el-icon>
              讨论统计
            </h3>
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-icon primary">
                  <el-icon><ChatDotSquare /></el-icon>
                </div>
                <div class="stat-info">
                  <span class="stat-value">{{ stats.totalPosts }}</span>
                  <span class="stat-label">总讨论</span>
                </div>
              </div>
              <div class="stat-item">
                <div class="stat-icon success">
                  <el-icon><ChatLineRound /></el-icon>
                </div>
                <div class="stat-info">
                  <span class="stat-value">{{ stats.totalReplies }}</span>
                  <span class="stat-label">总回复</span>
                </div>
              </div>
              <div class="stat-item">
                <div class="stat-icon warning">
                  <el-icon><UserFilled /></el-icon>
                </div>
                <div class="stat-info">
                  <span class="stat-value">{{ stats.activeUsers }}</span>
                  <span class="stat-label">参与人数</span>
                </div>
              </div>
              <div class="stat-item">
                <div class="stat-icon info">
                  <el-icon><Checked /></el-icon>
                </div>
                <div class="stat-info">
                  <span class="stat-value">{{ stats.resolvedRate }}</span>
                  <span class="stat-label">解决率</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 热门标签 -->
          <div class="hot-tags-card">
            <h3 class="card-title">
              <el-icon><CollectionTag /></el-icon>
              热门标签
            </h3>
            <div class="tags-cloud">
              <el-tag
                v-for="tag in hotTags"
                :key="tag.name"
                :type="tag.type"
                effect="plain"
                class="cloud-tag"
                @click="filterByTag(tag.name)"
              >
                {{ tag.name }}
                <span class="tag-count">{{ tag.count }}</span>
              </el-tag>
            </div>
          </div>

          <!-- 社区规范 -->
          <div class="rules-card">
            <h3 class="card-title">
              <el-icon><Warning /></el-icon>
              社区规范
            </h3>
            <ul class="rules-list">
              <li>请保持友善、尊重他人</li>
              <li>禁止发布广告和垃圾信息</li>
              <li>请勿发布敏感或违规内容</li>
              <li>鼓励提供有价值的回答</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- 编辑对话框 -->
    <el-dialog
      v-model="editDialogVisible"
      title="编辑讨论"
      width="600px"
      :close-on-click-modal="false"
      class="edit-dialog"
    >
      <div class="edit-form">
        <div class="edit-form-item">
          <label class="edit-label">标题（可选）</label>
          <el-input
            v-model="editingContent.title"
            placeholder="请输入标题"
            maxlength="100"
            show-word-limit
          />
        </div>
        <div class="edit-form-item">
          <label class="edit-label">内容 <span class="required">*</span></label>
          <el-input
            v-model="editingContent.content"
            type="textarea"
            :autosize="{ minRows: 6, maxRows: 15 }"
            placeholder="请输入内容，支持 Markdown 语法"
            maxlength="5000"
            show-word-limit
          />
        </div>
        <div class="edit-form-item">
          <label class="edit-label">标签（可选）</label>
          <el-select
            v-model="editingContent.tags"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="选择或输入标签"
            class="edit-tags-select"
            popper-class="tag-select-popper"
          >
            <el-option
              v-for="tag in availableTags"
              :key="tag"
              :label="tag"
              :value="tag"
            />
          </el-select>
        </div>
      </div>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="!editingContent.content?.trim()"
          @click="handleSaveEdit"
        >
          保存
        </el-button>
      </template>
    </el-dialog>

    <!-- 编辑回复对话框 -->
    <el-dialog
      v-model="editReplyDialogVisible"
      title="编辑回复"
      width="500px"
      :close-on-click-modal="false"
      class="edit-dialog"
    >
      <div class="edit-form">
        <div class="edit-form-item">
          <label class="edit-label">内容 <span class="required">*</span></label>
          <el-input
            v-model="editingReply.content"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 10 }"
            placeholder="请输入内容"
            maxlength="2000"
            show-word-limit
          />
        </div>
      </div>
      <template #footer>
        <el-button @click="editReplyDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="!editingReply.content?.trim()"
          @click="submitEditReply"
        >
          保存
        </el-button>
      </template>
    </el-dialog>

    <!-- 举报弹窗 -->
    <el-dialog
      v-model="reportDialogVisible"
      title="举报违规内容"
      width="400px"
      destroy-on-close
      :append-to-body="true"
      class="custom-report-dialog"
    >
      <el-form :model="reportForm" label-position="top">
        <el-form-item label="举报原因" required>
          <el-radio-group v-model="reportForm.reason">
            <el-radio value="spam">垃圾广告</el-radio>
            <el-radio value="abuse">恶意攻击</el-radio>
            <el-radio value="inappropriate">不当言论</el-radio>
            <el-radio value="other">其他</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="详细说明">
          <el-input
            v-model="reportForm.description"
            type="textarea"
            :rows="3"
            placeholder="请描述具体违规情况（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="reportDialogVisible = false">取 消</el-button>
          <el-button
            type="primary"
            :loading="submittingReport"
            @click="confirmReport"
          >
            <el-icon class="mr-1"><Position /></el-icon>
            提交举报
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from "vue";
import { ElMessage, ElMessageBox, type TagProps } from "element-plus";
import {
  Search,
  Clock,
  Top,
  MoreFilled,
  Edit,
  Delete,
  Star,
  StarFilled,
  ChatDotRound,
  Position,
  TrendCharts,
  View,
  ArrowUp,
  ArrowDown,
  InfoFilled,
  DataAnalysis,
  ChatDotSquare,
  ChatLineRound,
  UserFilled,
  Checked,
  CollectionTag,
  Warning,
  CircleClose,
  Refresh,
  Document,
  QuestionFilled
} from "@element-plus/icons-vue";
import CourseHeader from "./CourseHeader.vue";
import { formatAvatar } from "@/utils/avatar";
import {
  getDiscussions,
  getDiscussionStats,
  getHotTags,
  createDiscussion,
  updateDiscussion,
  deleteDiscussion,
  getReplies,
  createReply,
  updateReply,
  deleteReply,
  likePost,
  unlikePost,
  likeReply,
  unlikeReply,
  reportPost,
  reportReply,
  pinPost,
  unpinPost,
  DiscussionPost,
  Reply,
  DiscussionStats,
  ReportParams
} from "@/api/discussion";

// 为了兼容原有模板，我们可以扩展类型或者使用 API 返回的类型
interface Message extends DiscussionPost {
  isCollapsed: boolean;
  expanded: boolean;
  showReplies: boolean;
  showReplyInput: boolean;
  replyContent: string;
  replyPlaceholder: string;
}

type CourseQaFilter = "latest" | "hot" | "unanswered" | "all" | "mine";
type HotTagItem = {
  name: string;
  count: number;
  type?: TagProps["type"];
};

// Props
const props = defineProps<{
  visible: boolean;
  currentTheme: string;
  userAvatar: string;
  userNickname: string;
  userId?: string;
  isTeacher?: boolean;
  isAdmin?: boolean;
  courseId: string | number; // 支持字符串或数字类型
}>();

// 将 courseId 转换为字符串，确保 API 调用时使用正确的类型
const normalizedCourseId = computed(() => {
  if (props.courseId === null || props.courseId === undefined) return "";
  return String(props.courseId);
});

// Emits
const emit = defineEmits<{
  (e: "go-back"): void;
  (e: "toggle-theme", event: MouseEvent): void;
  (e: "go-to-account"): void;
  (e: "logout"): void;
}>();

// 响应式状态
const searchKeyword = ref("");
const activeFilter = ref<CourseQaFilter>("all");
const isLoading = ref(false);
const isLoadingMore = ref(false);
const hasMore = ref(true);
const isSubmitting = ref(false);
const editDialogVisible = ref(false);
const currentPage = ref(1);
const pageSize = ref(10);

// 筛选标签配置
const filterTabs = computed<
  Array<{ label: string; value: CourseQaFilter; icon: any; count?: number }>
>(() => [
  { label: "全部", value: "all", icon: Document },
  { label: "最新", value: "latest", icon: Clock },
  { label: "热门", value: "hot", icon: StarFilled },
  { label: "我的", value: "mine", icon: UserFilled },
  { label: "待回复", value: "unanswered", icon: QuestionFilled }
]);

// 热门标签
const hotTags = ref<HotTagItem[]>([]);

// 可用标签（用于发帖时选择）
const availableTags = computed(() => hotTags.value.map(tag => tag.name));

// 统计数据
const stats = ref<DiscussionStats>({
  totalPosts: 0,
  totalReplies: 0,
  activeUsers: 0,
  resolvedRate: "0%",
  hotTags: []
});

// 新帖子数据
const newPost = ref({
  title: "",
  content: "",
  tags: [] as string[]
});

// 编辑中的内容
const editingContent = ref({
  id: "",
  title: "",
  content: "",
  tags: [] as string[]
});

// 举报相关的状态
const reportDialogVisible = ref(false);
const submittingReport = ref(false);
const reportForm = reactive({
  type: "post", // 'post' or 'reply'
  targetId: "",
  reason: "inappropriate" as any,
  description: ""
});

const editReplyDialogVisible = ref(false);
const editingReply = ref({
  id: "",
  content: "",
  messageId: "" // 所属帖子ID
});

// 消息列表
const messages = ref<Message[]>([]);

// 统一监听 visible 和 courseId，只要两者都准备好且 visible 为 true 就加载
watch(
  [() => props.visible, () => normalizedCourseId.value],
  ([newVisible, newCourseId]) => {
    console.log("[CourseQA] Status check:", { newVisible, newCourseId });
    if (newVisible && newCourseId) {
      refreshData();
    }
  },
  { immediate: true }
);

// 监听 tab 切换
watch(activeFilter, () => {
  if (normalizedCourseId.value && props.visible) {
    refreshData();
  }
});

// 监听搜索
watch(searchKeyword, () => {
  // 可以在这里做防抖搜索
});

const refreshData = async () => {
  currentPage.value = 1;
  messages.value = [];
  hasMore.value = true;
  await Promise.all([fetchDiscussions(), fetchStats(), fetchTags()]);
};

defineExpose({
  refreshData
});

const fetchDiscussions = async (append = false) => {
  if (!normalizedCourseId.value) {
    console.log("[CourseQA] fetchDiscussions skipped - no courseId");
    return;
  }

  console.log(
    "[CourseQA] fetchDiscussions - courseId:",
    normalizedCourseId.value
  );

  if (append) {
    isLoadingMore.value = true;
  } else {
    isLoading.value = true;
  }

  try {
    const params: any = {
      page: currentPage.value,
      pageSize: pageSize.value,
      keyword: searchKeyword.value || undefined
    };

    if (activeFilter.value !== "all" && activeFilter.value !== "mine") {
      params.sort = activeFilter.value;
    }

    if (activeFilter.value === "mine") {
      params.authorId = props.userId;
    }

    const { data } = await getDiscussions(normalizedCourseId.value, params);

    const newMessages = data.list.map(item => {
      const safeContent = item.content || "";
      return {
        ...item,
        content: safeContent,
        contentHtml: item.contentHtml || safeContent,
        isCollapsed: safeContent.length > 200,
        expanded: false,
        showReplies: false,
        showReplyInput: false,
        replyContent: "",
        replyPlaceholder: "",
        replies: item.replies || []
      };
    });

    if (append) {
      messages.value = [...messages.value, ...newMessages];
    } else {
      messages.value = newMessages;
    }

    hasMore.value = data.pagination.page < data.pagination.totalPages;
  } catch (error) {
    console.error("加载讨论列表失败", error);
  } finally {
    isLoading.value = false;
    isLoadingMore.value = false;
  }
};

const fetchStats = async () => {
  try {
    const { data } = await getDiscussionStats(normalizedCourseId.value);
    stats.value = data;
  } catch (error) {}
};

const fetchTags = async () => {
  try {
    const { data } = await getHotTags(normalizedCourseId.value);
    const types: Array<NonNullable<TagProps["type"]>> = [
      "primary",
      "success",
      "warning",
      "info",
      "danger"
    ];
    hotTags.value = data.map((tag, index) => ({
      ...tag,
      type: types[index % types.length]
    }));
  } catch (error) {}
};

// 计算属性
const isTeacherOrAdmin = computed(() => props.isTeacher || props.isAdmin);

const filteredMessages = computed(() => {
  if (!messages.value) return [];
  // 复制数组并排序：置顶的永远排在最前面，其余按时间降序
  return [...messages.value].sort((a, b) => {
    // 置顶权重
    const aPin = a.isPinned ? 1 : 0;
    const bPin = b.isPinned ? 1 : 0;
    if (aPin !== bPin) return bPin - aPin;
    // 时间降序
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
});

// 方法
const handleSearch = () => {
  refreshData();
};

const formatRelativeTime = (dateString: string) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

/**
 * 前端简易Markdown 解析（作为后端未返回 contentHtml 时的回退方案）
 * 后端已实现完整的 Markdown 渲染，会返回 contentHtml 字段，更安全
 */
const parseMarkdownContent = (text: string) => {
  if (!text) return "";
  // 简易的前端 markdown 解析，作为后端未返回 contentHtml 时的回退
  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
  return formatted;
};

const canManageMessage = (message: Message) => {
  return message.author.id === props.userId || isTeacherOrAdmin.value;
};

const handleLike = async (message: Message) => {
  // 保存当前状态用于失败回滚
  const oldIsLiked = message.isLiked;
  const oldLikeCount = message.likeCount || 0;

  // 立即更新 UI (乐观更新)
  message.isLiked = !message.isLiked;
  message.likeCount = message.isLiked
    ? oldLikeCount + 1
    : Math.max(0, oldLikeCount - 1);

  try {
    let result: any;
    if (oldIsLiked) {
      result = await unlikePost(message.id);
    } else {
      result = await likePost(message.id);
    }

    // 如果后端返回了新的数量，以此为准同步，否则保持乐观更新的数量
    // 兼容可能的不同返回结构
    const newCount = result?.likeCount ?? result?.data?.likeCount;
    if (typeof newCount === "number") {
      message.likeCount = newCount;
    }
  } catch (error) {
    // 失败时回滚
    message.isLiked = oldIsLiked;
    message.likeCount = oldLikeCount;
    console.error("点赞操作失败:", error);
  }
};

const handleShowReplies = async (message: Message, force = false) => {
  if (force) {
    message.showReplies = true;
  } else {
    message.showReplies = !message.showReplies;
  }

  if (message.showReplies) {
    try {
      const result = await getReplies(message.id);
      message.replies = result.data.list;
      // 关键：点开时同步真实的回复总数，解决后端列表接口返回数量不准的问题
      if (result?.data && typeof result.data.total === "number") {
        message.replyCount = result.data.total;
      }
      message.hasMoreReplies =
        message.replies.length < (result.data.total || 0);
    } catch (error) {
      console.error("获取回复列表失败:", error);
    }
  }
};

const handleReply = (message: Message) => {
  message.showReplyInput = !message.showReplyInput;
  message.replyPlaceholder = `回复 ${message.author.name}...`;
};

const handleReplyToReply = (message: Message, reply: Reply) => {
  message.showReplyInput = true;
  message.replyPlaceholder = `回复 @${reply.author.name}...`;
};

const submitReply = async (message: Message) => {
  if (!message.replyContent?.trim()) return;

  try {
    await createReply(message.id, { content: message.replyContent });
    ElMessage.success("回复已提交，内容将在审核后显示");
    message.replyContent = "";
    message.showReplyInput = false;
    // 提交回复后强制重新获取该帖子的回复列表
    await handleShowReplies(message, true);
    // 同时也刷新一下全局统计数据
    fetchStats();
  } catch (error) {
    ElMessage.error("提交失败");
  }
};

const handleLikeReply = async (message: Message, reply: Reply) => {
  // 保存当前状态用于失败回滚
  const oldIsLiked = reply.isLiked;
  const oldLikeCount = reply.likeCount || 0;

  // 立即更新 UI (乐观更新)
  reply.isLiked = !reply.isLiked;
  reply.likeCount = reply.isLiked
    ? oldLikeCount + 1
    : Math.max(0, oldLikeCount - 1);

  try {
    let result: any;
    if (oldIsLiked) {
      result = await unlikeReply(reply.id);
    } else {
      result = await likeReply(reply.id);
    }

    // 如果后端返回了新的数量，以此为准同步
    const newCount = result?.likeCount ?? result?.data?.likeCount;
    if (typeof newCount === "number") {
      reply.likeCount = newCount;
    }
  } catch (error) {
    // 失败时回滚
    reply.isLiked = oldIsLiked;
    reply.likeCount = oldLikeCount;
    console.error("回复点赞操作失败:", error);
  }
};

const loadMoreReplies = async (message: Message) => {
  try {
    const page = Math.floor(message.replies.length / 5) + 1;
    const result = await getReplies(message.id, { page, pageSize: 5 });
    message.replies = [...message.replies, ...result.data.list];
    message.hasMoreReplies = message.replies.length < result.data.total;

    // 同步回复总数
    if (result?.data && typeof result.data.total === "number") {
      message.replyCount = result.data.total;
    }
  } catch (error) {}
};

const handleEditMessage = (message: Message) => {
  editingContent.value = {
    id: message.id,
    title: message.title || "",
    content: message.content,
    tags: message.tags || []
  };
  editDialogVisible.value = true;
};

const handleEditReply = (message: Message, reply: Reply) => {
  editingReply.value = {
    id: reply.id,
    content: reply.content,
    messageId: message.id
  };
  editReplyDialogVisible.value = true;
};

const submitEditReply = async () => {
  if (!editingReply.value.content?.trim()) return;

  try {
    await updateReply(editingReply.value.id, {
      content: editingReply.value.content
    });
    ElMessage.success("回复已更新");
    editReplyDialogVisible.value = false;

    // 更新本地数据
    const message = messages.value.find(
      m => m.id === editingReply.value.messageId
    );
    if (message) {
      const reply = message.replies.find(r => r.id === editingReply.value.id);
      if (reply) {
        reply.content = editingReply.value.content;
        reply.contentHtml = editingReply.value.content;
      }
    }
  } catch (error) {
    ElMessage.error("更新失败");
  }
};

const handleDeleteReply = async (message: Message, reply: Reply) => {
  try {
    await ElMessageBox.confirm("确定要删除这条回复吗？", "提 示", {
      confirmButtonText: "确 定",
      cancelButtonText: "取 消",
      type: "warning",
      customClass: "custom-message-box"
    });

    await deleteReply(reply.id);
    ElMessage.success("删除成功");

    // 从本地数据中移除，保证界面立即更新
    message.replies = message.replies.filter(r => r.id !== reply.id);
    message.replyCount--;

    // 延迟静默刷新，确保后端同步
    setTimeout(() => {
      fetchDiscussions(false); // 刷新当前页
    }, 1000);
  } catch (error) {
    if (error !== "cancel") {
      ElMessage.error("删除失败");
    }
  }
};

const handleReport = (message: Message) => {
  reportForm.type = "post";
  reportForm.targetId = message.id;
  reportForm.reason = "inappropriate";
  reportForm.description = "";
  reportDialogVisible.value = true;
};

const handleReportReply = (message: Message, reply: Reply) => {
  reportForm.type = "reply";
  reportForm.targetId = reply.id;
  reportForm.reason = "inappropriate";
  reportForm.description = "";
  reportDialogVisible.value = true;
};

const confirmReport = async () => {
  if (!reportForm.reason) {
    ElMessage.warning("请选择举报原因");
    return;
  }
  submittingReport.value = true;
  try {
    const params: ReportParams = {
      reason: reportForm.reason
    };
    if (reportForm.description && reportForm.description.trim()) {
      params.description = reportForm.description.trim();
    }

    console.log("[Report] Submitting:", {
      type: reportForm.type,
      targetId: reportForm.targetId,
      params
    });

    if (reportForm.type === "post") {
      await reportPost(reportForm.targetId, params);
    } else {
      await reportReply(reportForm.targetId, params);
    }

    ElMessage.success("举报已提交，我们将尽快处理");
    reportDialogVisible.value = false;
  } catch (error: any) {
    console.error("[Report] Detailed Error:", error);
    if (error.response) {
      console.error("[Report] Response Data:", error.response.data);
      console.error("[Report] Response Status:", error.response.status);
    }
    const msg = error.response?.data?.msg || "举报提交失败";
    ElMessage.error(msg);
  } finally {
    submittingReport.value = false;
  }
};

const handleSaveEdit = async () => {
  if (!editingContent.value.content?.trim()) {
    ElMessage.warning("内容不能为空");
    return;
  }
  try {
    await updateDiscussion(editingContent.value.id, {
      title: editingContent.value.title,
      content: editingContent.value.content,
      tags: editingContent.value.tags
    });
    ElMessage.success("已保存，审核通过后生效");
    editDialogVisible.value = false;
    refreshData();
  } catch (error) {
    ElMessage.error("保存失败");
  }
};

const handleDeleteMessage = async (message: Message) => {
  try {
    await ElMessageBox.confirm("确定要删除这条内容吗？", "提 示", {
      confirmButtonText: "确 定",
      cancelButtonText: "取 消",
      type: "warning",
      draggable: true,
      customClass: "custom-message-box"
    });
    await deleteDiscussion(message.id);
    // 从本地立即移除
    messages.value = messages.value.filter(m => m.id !== message.id);
    ElMessage.success("已删除");

    // 延迟刷新以同步后端状态
    setTimeout(() => {
      fetchDiscussions(false);
    }, 1000);
  } catch {
    // 取消删除
  }
};

const handleTogglePin = async (message: Message) => {
  try {
    if (message.isPinned) {
      await unpinPost(message.id);
      message.isPinned = false;
      ElMessage.success("已取消置顶");
    } else {
      await pinPost(message.id);
      message.isPinned = true;
      ElMessage.success("已置顶");
    }
  } catch (error) {}
};

const loadMore = async () => {
  if (isLoadingMore.value || !hasMore.value) return;
  currentPage.value++;
  await fetchDiscussions(true);
};

const insertMarkdown = (type: string) => {
  const textarea = document.querySelector(
    ".content-editor textarea"
  ) as HTMLTextAreaElement;
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = newPost.value.content;
  const selected = text.substring(start, end);

  let insert = "";
  switch (type) {
    case "bold":
      insert = `**${selected || "粗体文本"}**`;
      break;
    case "italic":
      insert = `*${selected || "斜体文本"}*`;
      break;
    case "code":
      insert = `\`${selected || "代码"}\``;
      break;
    case "link":
      insert = `[${selected || "链接文本"}](url)`;
      break;
  }

  newPost.value.content =
    text.substring(0, start) + insert + text.substring(end);
};

const handleSubmitPost = async () => {
  if (!newPost.value.content?.trim()) {
    ElMessage.warning("请输入内容");
    return;
  }

  isSubmitting.value = true;

  try {
    await createDiscussion(normalizedCourseId.value, {
      title: newPost.value.title,
      content: newPost.value.content,
      tags: newPost.value.tags
    });

    ElMessage.success("发布成功，内容将在审核后显示");
    newPost.value = { title: "", content: "", tags: [] };
    refreshData();
  } catch (error) {
    ElMessage.error("发布失败，请重试");
  } finally {
    isSubmitting.value = false;
  }
};

const filterByTag = (tagName: string) => {
  searchKeyword.value = tagName;
  refreshData();
};
</script>

<style scoped>
/* 响应式 */
@media (max-width: 1200px) {
  .board-right-panel {
    width: 300px;
  }
}

@media (max-width: 992px) {
  .board-main-content {
    flex-direction: column-reverse;
  }

  .board-right-panel {
    flex-flow: row wrap;
    width: 100%;
  }

  .post-composer {
    flex: 1;
    min-width: 300px;
  }

  .stats-card,
  .hot-tags-card,
  .rules-card {
    flex: 1;
    min-width: 200px;
  }

  .board-toolbar,
  .message-card,
  .post-composer,
  .stats-card,
  .hot-tags-card,
  .rules-card {
    border-radius: 18px;
  }
}

@media (max-width: 768px) {
  .message-board-container {
    height: auto;
    min-height: 100vh;
    padding: var(--course-mobile-top-offset, 176px) 14px
      calc(24px + env(safe-area-inset-bottom));
    overflow: visible;
  }

  .board-main-content {
    gap: 20px;
  }

  .board-left-panel {
    gap: 16px;
  }

  .board-toolbar {
    padding: 16px 14px;
  }

  .filter-tabs {
    flex-wrap: nowrap;
    gap: 10px;
    padding-bottom: 8px;
    overflow-x: auto;
    scroll-snap-type: x proximity;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  .filter-tab {
    height: 36px;
    padding: 0 16px;
    font-size: 13px;
    white-space: nowrap;
    scroll-snap-align: start;
  }

  .message-card {
    padding: 18px 16px;
  }

  .message-card:hover,
  .tag-item:hover,
  .cloud-tag:hover,
  .submit-reply-btn:not(:disabled):hover {
    transform: none;
  }

  .message-header {
    gap: 14px;
    flex-direction: column;
    margin-bottom: 14px;
  }

  .author-info {
    align-items: flex-start;
  }

  .author-details,
  .reply-content,
  .composer-title {
    min-width: 0;
  }

  .author-name {
    flex-wrap: wrap;
    row-gap: 6px;
    font-size: 14px;
    line-height: 1.4;
  }

  .post-meta {
    flex-wrap: wrap;
    font-size: 12px;
  }

  .header-right-actions {
    flex-wrap: wrap;
    gap: 8px;
    width: 100%;
    justify-content: flex-end;
  }

  .pinned-badge,
  .status-badge {
    padding: 4px 10px;
    font-size: 11px;
    letter-spacing: 0;
  }

  .message-title {
    margin-bottom: 10px;
    font-size: 17px;
  }

  .message-content {
    font-size: 13px;
    line-height: 1.75;
  }

  .message-footer {
    gap: 12px;
    align-items: flex-start;
    flex-direction: column;
  }

  .action-buttons {
    flex-wrap: wrap;
    gap: 10px;
    width: 100%;
  }

  .action-btn {
    flex: 0 0 auto;
    gap: 6px;
    padding: 8px 12px;
    font-size: 13px;
  }

  .action-btn .el-icon {
    font-size: 16px;
  }

  .view-count {
    font-size: 12px;
  }

  .replies-section {
    padding-top: 14px;
    margin-top: 14px;
  }

  .reply-item {
    gap: 10px;
    align-items: flex-start;
    padding: 12px 10px;
  }

  .reply-header {
    gap: 6px;
    align-items: flex-start;
  }

  .reply-time {
    width: 100%;
    margin-left: 0;
    font-size: 12px;
  }

  .reply-text {
    font-size: 13px;
  }

  .reply-actions {
    flex-wrap: wrap;
    gap: 8px;
  }

  .reply-action-btn {
    gap: 4px;
    padding: 5px 10px;
    font-size: 12px;
  }

  .reply-action-btn .el-icon {
    font-size: 15px;
  }

  .quick-reply-box {
    gap: 12px;
    align-items: flex-start;
    padding: 14px 12px;
    margin: 14px 0 4px;
    border-radius: 14px;
  }

  .reply-input-wrapper :deep(.el-textarea__inner) {
    padding: 10px 12px;
    font-size: 13px;
  }

  .reply-input-actions {
    gap: 10px;
    align-items: flex-start;
    flex-direction: column;
  }

  .reply-input-actions .hint {
    font-size: 12px;
  }

  .submit-reply-btn {
    width: 100%;
  }

  .board-right-panel {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .post-composer,
  .stats-card,
  .hot-tags-card,
  .rules-card {
    min-width: 0;
  }

  .post-composer {
    padding: 18px 16px;
    border-radius: 18px;
  }

  .composer-header {
    padding-bottom: 14px;
    margin-bottom: 16px;
  }

  .composer-title h3 {
    font-size: 16px;
  }

  .composer-title p {
    font-size: 12px;
  }

  .composer-body {
    gap: 14px;
  }

  .content-editor :deep(.el-textarea__inner) {
    padding: 12px 14px 46px;
    font-size: 13px;
  }

  .editor-toolbar {
    left: 10px;
  }

  .toolbar-btn {
    width: 30px;
    height: 30px;
    font-size: 13px;
  }

  .post-notice {
    align-items: flex-start;
    padding: 10px 12px;
    font-size: 12px;
    line-height: 1.6;
  }

  .submit-btn {
    height: 44px;
    font-size: 15px;
    border-radius: 12px;
  }

  .stats-card,
  .hot-tags-card,
  .rules-card {
    padding: 16px 14px;
    border-radius: 18px;
  }

  .stats-grid {
    gap: 10px;
  }

  .stat-item {
    padding: 10px;
  }

  .stat-value {
    font-size: 16px;
  }

  .cloud-tag {
    padding: 0 12px;
    font-size: 12px;
  }

  .rules-list li {
    line-height: 1.8;
  }

  .empty-state {
    padding: 52px 20px;
  }
}

@media (max-width: 479px) {
  .message-board-container {
    padding: var(--course-mobile-top-offset, 176px) 10px
      calc(20px + env(safe-area-inset-bottom));
  }

  .board-main-content {
    gap: 16px;
  }

  .board-toolbar {
    padding: 14px 12px;
    border-radius: 16px;
  }

  .search-box {
    margin-bottom: 12px;
  }

  .search-box :deep(.el-input__wrapper),
  .title-input :deep(.el-input__wrapper) {
    padding: 7px 12px;
  }

  .filter-tabs {
    gap: 8px;
    padding-bottom: 6px;
  }

  .filter-tab {
    gap: 6px;
    height: 34px;
    padding: 0 13px;
    font-size: 12px;
    border-radius: 9px;
  }

  .tab-icon {
    font-size: 14px;
  }

  .tab-count {
    padding: 1px 5px;
    font-size: 10px;
  }

  .message-card {
    padding: 16px 14px;
    border-radius: 16px;
  }

  .author-info {
    gap: 10px;
  }

  .message-title {
    font-size: 16px;
  }

  .message-tags {
    gap: 6px;
  }

  .tag-item {
    height: 26px;
    padding: 0 10px;
    font-size: 12px;
    line-height: 24px;
  }

  .action-buttons {
    gap: 8px;
  }

  .action-btn {
    padding: 7px 10px;
    font-size: 12px;
  }

  .reply-item {
    flex-direction: column;
    padding: 10px;
  }

  .reply-item > :deep(.el-avatar) {
    align-self: flex-start;
  }

  .reply-text {
    font-size: 12px;
    line-height: 1.7;
  }

  .reply-actions {
    gap: 6px;
  }

  .reply-action-btn {
    padding: 4px 8px;
    font-size: 11px;
  }

  .quick-reply-box {
    flex-direction: column;
    padding: 12px 10px;
  }

  .quick-reply-box > :deep(.el-avatar) {
    align-self: flex-start;
  }

  .post-composer {
    padding: 16px 14px;
    border-radius: 16px;
  }

  .composer-header {
    gap: 10px;
  }

  .composer-title h3 {
    font-size: 15px;
  }

  .content-editor :deep(.el-textarea__inner) {
    padding: 10px 12px 44px;
  }

  .toolbar-btn {
    width: 28px;
    height: 28px;
  }

  .stats-card,
  .hot-tags-card,
  .rules-card {
    padding: 14px 12px;
    border-radius: 16px;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .stat-item {
    gap: 8px;
  }

  .stat-icon {
    width: 32px;
    height: 32px;
    font-size: 16px;
  }

  .card-title {
    margin-bottom: 14px;
    font-size: 14px;
  }
}

.message-board-wrapper {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
  height: 100%;
  overflow-x: hidden;
  background-color: transparent;
  opacity: 0;
  animation: fadeIn 0.4s ease-out forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.message-board-wrapper.dark {
  background-color: transparent;
}

.message-board-container {
  box-sizing: border-box;
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
  height: 100%;
  padding: 80px 32px 24px;
  overflow-x: hidden;
  overflow-y: auto;
}

.message-board-container :deep(.el-input__wrapper.is-focus),
.message-board-container :deep(.el-textarea__inner:focus),
.message-board-container :deep(.el-select__wrapper.is-focused),
:deep(.edit-dialog) :deep(.el-input__wrapper.is-focus),
:deep(.edit-dialog) :deep(.el-textarea__inner:focus),
:deep(.edit-dialog) :deep(.el-select__wrapper.is-focused) {
  border-color: #409eff !important;
  box-shadow: 0 0 0 3px rgb(64 158 255 / 15%) !important;
}

/* 彻底移除所有输入控件的默认聚焦蓝框 */
.message-board-container :deep(input),
.message-board-container :deep(textarea),
.message-board-container :deep(.el-input__wrapper),
.message-board-container :deep(.el-textarea__inner),
.message-board-container :deep(.el-input__inner),
.message-board-container :deep(.el-select__wrapper),
:deep(.edit-dialog) :deep(input),
:deep(.edit-dialog) :deep(textarea),
:deep(.edit-dialog) :deep(.el-input__wrapper),
:deep(.edit-dialog) :deep(.el-textarea__inner),
:deep(.edit-dialog) :deep(.el-input__inner),
:deep(.edit-dialog) :deep(.el-select__wrapper) {
  outline: none !important;
}

/* 移除 Element Plus 默认的 inset box-shadow */
.message-board-container :deep(.el-input__wrapper),
.message-board-container :deep(.el-textarea__inner),
.message-board-container :deep(.el-select__wrapper),
:deep(.edit-dialog) :deep(.el-input__wrapper),
:deep(.edit-dialog) :deep(.el-textarea__inner),
:deep(.edit-dialog) :deep(.el-select__wrapper) {
  box-shadow: none !important;
}

.board-main-content {
  display: flex;
  flex: 1;
  gap: 32px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  margin: 0;
}

/* 左侧面板 */
.board-left-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

/* 工具栏 */
.board-toolbar {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  padding: 20px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgb(0 0 0 / 5%);
}

.dark .board-toolbar {
  background: #242428;
  box-shadow: 0 4px 20px rgb(0 0 0 / 30%);
}

.search-box {
  margin-bottom: 16px;
}

.search-box :deep(.el-input__wrapper) {
  padding: 8px 16px;
  background-color: #f5f7fa;
  border-radius: 12px;
  box-shadow: none !important;
  transition: all 0.3s ease;
}

.search-box :deep(.el-input__inner) {
  box-shadow: none !important;
  outline: none !important;
}

.dark .search-box :deep(.el-input__wrapper) {
  background-color: #1e1e22;
}

.search-box :deep(.el-input__wrapper.is-focus) {
  background-color: #fff !important;
  box-shadow: 0 0 0 4px rgb(64 158 255 / 10%) !important;
}

.dark .search-box :deep(.el-input__wrapper.is-focus) {
  background-color: #242428 !important;
}

.filter-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.filter-tab {
  display: inline-flex;
  flex-shrink: 0;
  gap: 8px;
  align-items: center;
  justify-content: center;
  height: 38px;
  padding: 0 18px;
  font-size: 14px;
  color: #606266;
  white-space: nowrap;
  cursor: pointer;
  background: #f5f7fa;
  border: none;
  border-radius: 10px;
  transition: all 0.3s ease;
}

.dark .filter-tab {
  color: #a0a0a0;
  background: #333;
}

.filter-tab:hover {
  color: #409eff;
  background: #e8f4ff;
}

.dark .filter-tab:hover {
  color: #79bbff;
  background: #3a3a4a;
}

.filter-tab.active {
  color: #fff;
  background: linear-gradient(135deg, #409eff 0%, #79bbff 100%);
  box-shadow: 0 4px 12px rgb(64 158 255 / 30%);
}

.tab-icon {
  font-size: 16px;
}

.tab-count {
  padding: 2px 6px;
  font-size: 11px;
  background: rgb(0 0 0 / 5%);
  border-radius: 8px;
}

.filter-tab.active .tab-count {
  background: rgb(255 255 255 / 20%);
}

/* 消息列表 */
.messages-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

/* 消息卡片 */
.message-card {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  padding: 24px;
  background: #fff;
  border: 1px solid transparent;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgb(0 0 0 / 5%);
  transition: all 0.3s ease;
}

.dark .message-card {
  background: #242428;
  box-shadow: 0 4px 20px rgb(0 0 0 / 30%);
}

.message-card:hover {
  border-color: rgb(64 158 255 / 20%);
  box-shadow: 0 8px 30px rgb(0 0 0 / 10%);
  transform: translateY(-2px);
}

.dark .message-card:hover {
  box-shadow: 0 8px 30px rgb(0 0 0 / 40%);
}

.message-card.pinned {
  background: linear-gradient(135deg, #fff 0%, #fff9f0 100%);
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.dark .message-card.pinned {
  background: linear-gradient(135deg, #242428 0%, #3a3020 100%);
  border-color: rgba(245, 158, 11, 0.4);
}

.message-card.pending {
  border: 1px solid rgba(230, 162, 60, 0.3);
  opacity: 0.8;
}

.message-card.rejected {
  border: 1px solid rgba(245, 108, 108, 0.3);
  opacity: 0.6;
}

/* 置顶和状态标签 */
.header-right-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pinned-badge,
.status-badge {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 5px 14px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  letter-spacing: 1px;
}

.pinned-badge {
  color: #fff;
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
}

.status-badge.pending {
  color: #fff;
  background: linear-gradient(135deg, #e6a23c 0%, #f5d18f 100%);
}

.status-badge.rejected {
  color: #fff;
  background: linear-gradient(135deg, #f56c6c 0%, #fab6b6 100%);
}

/* 消息头部 */
.message-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}

.author-info {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
}

.author-avatar {
  border: 2px solid #fff;
  box-shadow: 0 2px 8px rgb(0 0 0 / 10%);
}

.author-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.author-name {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.dark .author-name {
  color: #e0e0e0;
}

.role-tag {
  height: 22px;
  padding: 0 10px;
  font-size: 12px;
  line-height: 22px;
  border-radius: 6px;
}

.role-tag.mini {
  height: 20px;
  padding: 0 8px;
  font-size: 11px;
  line-height: 20px;
  border-radius: 4px;
}

.post-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 14px;
  color: #909399;
}

.post-time {
  display: flex;
  gap: 4px;
  align-items: center;
}

.edited-mark {
  font-style: italic;
  color: #c0c4cc;
}

.more-actions-btn {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: #606266;
  cursor: pointer;
  background: #f5f7fa;
  border: none;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.dark .more-actions-btn {
  color: #a0a0a0;
  background: #333;
}

.more-actions-btn:hover {
  color: #409eff;
  background: #f5f7fa;
}

.dark .more-actions-btn:hover {
  background: #333;
}

/* 消息内容 */
.message-body {
  margin-bottom: 16px;
}

.message-title {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
  color: #303133;
  overflow-wrap: anywhere;
}

.dark .message-title {
  color: #fff;
}

.message-content {
  font-size: 14px;
  line-height: 1.8;
  color: #606266;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.dark .message-content {
  color: #c0c4cc;
}

.message-content.collapsed {
  position: relative;
  max-height: 120px;
  overflow: hidden;
}

.message-content.collapsed::after {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 40px;
  content: "";
  background: linear-gradient(transparent, #fff);
}

.dark .message-content.collapsed::after {
  background: linear-gradient(transparent, #242428);
}

.message-content :deep(code) {
  padding: 2px 6px;
  font-family: Monaco, monospace;
  font-size: 13px;
  color: #d63384;
  background: #f5f7fa;
  border-radius: 4px;
}

.dark .message-content :deep(code) {
  color: #ff79c6;
  background: #333;
}

.message-content :deep(pre),
.reply-text :deep(pre) {
  box-sizing: border-box;
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.expand-btn {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 8px 0;
  font-size: 13px;
  color: #409eff;
  cursor: pointer;
  background: transparent;
  border: none;
}

.expand-btn:hover {
  text-decoration: underline;
}

.message-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.tag-item {
  height: 28px;
  padding: 0 12px;
  font-size: 13px;
  line-height: 26px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.3s ease;
}

.tag-item:hover {
  transform: scale(1.05);
}

/* 消息底部 */
.message-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 16px;
  border-top: 1px solid #f0f2f5;
}

.dark .message-footer {
  border-top-color: #333;
}

.action-buttons {
  display: flex;
  gap: 16px;
}

.action-btn {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 16px;
  font-size: 14px;
  color: #606266;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 20px;
  transition: all 0.3s ease;
}

.action-btn .el-icon {
  font-size: 18px;
}

.action-btn:hover {
  color: #409eff;
  background: #f5f7fa;
}

.dark .action-btn {
  color: #909399;
}

.dark .action-btn:hover {
  color: #409eff;
  background: #333;
}

.action-btn.active {
  color: #f7ba2a;
}

.view-count {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 14px;
  color: #909399;
}

/* 回复区域 */
.replies-section {
  padding-top: 16px;
  margin-top: 16px;
  border-top: 1px dashed #e4e7ed;
}

.dark .replies-section {
  border-top-color: #333;
}

.replies-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.reply-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #fafbfc;
  border-radius: 12px;
}

.dark .reply-item {
  background: #1e1e22;
}

.reply-content {
  flex: 1;
  min-width: 0;
}

.reply-header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.reply-author {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.dark .reply-author {
  color: #e0e0e0;
}

.reply-to {
  font-size: 12px;
  color: #909399;
}

.reply-target {
  color: #409eff;
}

.reply-time {
  margin-left: auto;
  font-size: 14px;
  color: #909399;
}

.reply-text {
  font-size: 14px;
  line-height: 1.6;
  color: #606266;
  overflow-wrap: anywhere;
}

.dark .reply-text {
  color: #b0b0b0;
}

.reply-actions {
  display: flex;
  gap: 16px;
  margin-top: 10px;
}

.reply-action-btn {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 6px 12px;
  font-size: 14px;
  color: #909399;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.reply-action-btn .el-icon {
  font-size: 18px;
}

.reply-action-btn:hover {
  color: #409eff;
  background: #f0f7ff;
}

.dark .reply-action-btn:hover {
  background: #333;
}

.reply-action-btn.active {
  color: #f7ba2a;
}

.load-more-btn {
  width: 100%;
  padding: 10px;
  font-size: 13px;
  color: #909399;
  cursor: pointer;
  background: transparent;
  border: 1px dashed #dcdfe6;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.load-more-btn:hover {
  color: #409eff;
  border-color: #409eff;
}

/* 快速回复框 */
.quick-reply-box {
  display: flex;
  gap: 16px;
  padding: 20px;
  margin: 16px 0;
  background: #f8f9fb;
  border-radius: 16px;
  border: 1px solid #f0f3f7;
}

.dark .quick-reply-box {
  background: #1e1e22;
  border-color: #333;
}

.reply-input-wrapper {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
}

.reply-input-wrapper :deep(.el-textarea__inner) {
  padding: 12px 16px;
  font-size: 14px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 2%) !important;
  transition: all 0.3s ease;
  outline: none !important;
  border-color: #e4e7ed;
}

.reply-input-wrapper :deep(.el-textarea__inner:focus) {
  background-color: #fff !important;
  box-shadow: 0 0 0 4px rgb(64 158 255 / 10%) !important;
  outline: none !important;
  border-color: #409eff;
}

.dark .reply-input-wrapper :deep(.el-textarea__inner:focus) {
  background-color: #1e1e22 !important;
  border-color: #409eff;
}

.reply-input-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.reply-input-actions .hint {
  font-size: 13px;
  color: #909399;
}

.submit-reply-btn {
  padding: 0 24px !important;
  height: 36px;
  font-weight: 500;
  border-radius: 10px;
  transition: all 0.3s ease;
}

.submit-reply-btn:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgb(64 158 255 / 30%);
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #909399;
  text-align: center;
}

.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  color: #dcdfe6;
}

.dark .empty-icon {
  color: #4a4a4a;
}

.empty-state h3 {
  margin: 0 0 8px;
  font-size: 18px;
  color: #606266;
}

.dark .empty-state h3 {
  color: #a0a0a0;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}

/* 加载更多 */
.load-more-section {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 0;
  text-align: center;
}

.load-more-btn-link {
  font-size: 14px;
  color: #909399;
  transition: all 0.3s ease;

  &:hover {
    color: #409eff;
  }
}

.no-more-data {
  position: relative;
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 13px;
  color: #c0c4cc;

  &::before,
  &::after {
    width: 40px;
    height: 1px;
    content: "";
    background: #e4e7ed;
  }

  .dark &::before,
  .dark &::after {
    background: #333;
  }
}

/* 右侧面板 */
.board-right-panel {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  gap: 20px;
  width: 380px;
  max-width: 100%;
  min-width: 0;
}

/* 发帖卡片 */
.post-composer {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  padding: 24px;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 4px 20px rgb(0 0 0 / 5%);
}

.dark .post-composer {
  background: #242428;
  box-shadow: 0 4px 20px rgb(0 0 0 / 30%);
}

.composer-header {
  display: flex;
  gap: 12px;
  align-items: center;
  padding-bottom: 16px;
  margin-bottom: 20px;
  border-bottom: 1px solid #f0f2f5;
}

.dark .composer-header {
  border-bottom-color: #333;
}

.composer-title h3 {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.dark .composer-title h3 {
  color: #e0e0e0;
}

.composer-title p {
  margin: 0;
  font-size: 14px;
  color: #909399;
}

.composer-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.title-input :deep(.el-input__wrapper) {
  padding: 8px 16px;
  background-color: #f5f7fa;
  border-radius: 12px;
  box-shadow: none !important;
  transition: all 0.3s ease;
}

.title-input :deep(.el-input__inner) {
  box-shadow: none !important;
  outline: none !important;
}

.dark .title-input :deep(.el-input__wrapper) {
  background-color: #1e1e22;
}

.title-input :deep(.el-input__wrapper.is-focus) {
  background-color: #fff !important;
  box-shadow: 0 0 0 4px rgb(64 158 255 / 10%) !important;
}

.dark .title-input :deep(.el-input__wrapper.is-focus) {
  background-color: #242428 !important;
}

.content-editor {
  position: relative;
  min-width: 0;
}

.content-editor :deep(.el-textarea__inner) {
  padding: 12px 16px 48px;
  font-size: 14px;
  background-color: #f5f7fa;
  border-radius: 12px;
  box-shadow: none !important;
  transition: all 0.3s ease;
  outline: none !important;
}

.dark .content-editor :deep(.el-textarea__inner) {
  background-color: #1e1e22;
}

.content-editor :deep(.el-textarea__inner:focus) {
  background-color: #fff !important;
  box-shadow: 0 0 0 4px rgb(64 158 255 / 10%) !important;
  outline: none !important;
}

.dark .content-editor :deep(.el-textarea__inner:focus) {
  background-color: #242428 !important;
}

.editor-toolbar {
  position: absolute;
  bottom: 8px;
  left: 12px;
  display: flex;
  gap: 6px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 14px;
  color: #606266;
  cursor: pointer;
  background: #f5f7fa;
  border: none;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.dark .toolbar-btn {
  color: #a0a0a0;
  background: #333;
}

.toolbar-btn:hover {
  color: #409eff;
  background: #e8f4ff;
}

.tags-select {
  width: 100%;
}

.tags-select :deep(.el-select__wrapper) {
  min-height: 40px;
  padding-right: 16px;
  padding-left: 16px;
  background-color: #f5f7fa;
  border-radius: 12px;
  box-shadow: none !important;
  transition: all 0.3s ease;
  outline: none !important;
}

.dark .tags-select :deep(.el-select__wrapper) {
  background-color: #1e1e22;
}

.tags-select :deep(.el-select__wrapper.is-focused) {
  background-color: #fff !important;
  box-shadow: 0 0 0 4px rgb(64 158 255 / 10%) !important;
  outline: none !important;
}

.dark .tags-select :deep(.el-select__wrapper.is-focused) {
  background-color: #242428 !important;
}

.post-notice {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 12px 16px;
  font-size: 13px;
  color: #e6a23c;
  background: #fff7e6;
  border-radius: 10px;
}

.dark .post-notice {
  background: rgb(230 162 60 / 10%);
}

.submit-btn {
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 14px;
}

/* 统计卡片 */
.stats-card,
.hot-tags-card,
.rules-card {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  padding: 20px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgb(0 0 0 / 5%);
}

.dark .stats-card,
.dark .hot-tags-card,
.dark .rules-card {
  background: #242428;
  box-shadow: 0 4px 20px rgb(0 0 0 / 30%);
}

.card-title {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0 0 16px;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.dark .card-title {
  color: #e0e0e0;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.stat-item {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px;
  background: #fafbfc;
  border-radius: 10px;
}

.dark .stat-item {
  background: #1e1e22;
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  font-size: 18px;
  border-radius: 8px;
}

.stat-icon.primary {
  color: #409eff;
  background: rgb(64 158 255 / 10%);
}

.stat-icon.success {
  color: #67c23a;
  background: rgb(103 194 58 / 10%);
}

.stat-icon.warning {
  color: #e6a23c;
  background: rgb(230 162 60 / 10%);
}

.stat-icon.info {
  color: #909399;
  background: rgb(144 147 153 / 10%);
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  line-height: 1.2;
  color: #303133;
}

.dark .stat-value {
  color: #fff;
}

.stat-label {
  font-size: 11px;
  color: #909399;
}

/* 热门标签 */
.tags-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.cloud-tag {
  height: 30px;
  padding: 0 14px;
  font-size: 13px;
  line-height: 28px;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.cloud-tag:hover {
  transform: scale(1.05);
}

.cloud-tag .tag-count {
  margin-left: 4px;
  opacity: 0.7;
}

/* 社区规范 */
.rules-list {
  padding: 0 0 0 20px;
  margin: 0;
  list-style: disc;
}

.rules-list li {
  font-size: 13px;
  line-height: 2;
  color: #606266;
}

.dark .rules-list li {
  color: #a0a0a0;
}

/* 动画 */
.message-list-enter-active,
.message-list-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.message-list-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.98);
}

.message-list-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* 主容器样式 */

/* 编辑对话框样式 */
.edit-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.edit-form-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-form-item :deep(.el-input__wrapper) {
  padding: 8px 16px;
  background-color: #f5f7fa;
  border-radius: 12px;
  box-shadow: none !important;
  transition: all 0.3s ease;
}

.dark .edit-form-item :deep(.el-input__wrapper) {
  background-color: #1e1e22;
}

.edit-form-item :deep(.el-input__wrapper.is-focus) {
  background-color: #fff !important;
  box-shadow: 0 0 0 4px rgb(64 158 255 / 10%) !important;
  outline: none !important;
}

.dark .edit-form-item :deep(.el-input__wrapper.is-focus) {
  background-color: #242428 !important;
}

.edit-form-item :deep(.el-textarea__inner) {
  padding: 12px 16px;
  background-color: #f5f7fa;
  border-radius: 12px;
  box-shadow: none !important;
  transition: all 0.3s ease;
  outline: none !important;
}

.dark .edit-form-item :deep(.el-textarea__inner) {
  background-color: #1e1e22;
}

.edit-form-item :deep(.el-textarea__inner:focus) {
  background-color: #fff !important;
  box-shadow: 0 0 0 4px rgb(64 158 255 / 10%) !important;
  outline: none !important;
}

.dark .edit-form-item :deep(.el-textarea__inner:focus) {
  background-color: #242428 !important;
}

.edit-label {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.dark .edit-label {
  color: #e0e0e0;
}

.edit-label .required {
  margin-left: 4px;
  color: #f56c6c;
}

.edit-tags-select {
  width: 100%;
}

.edit-tags-select :deep(.el-select__wrapper) {
  min-height: 40px;
  padding-right: 16px;
  padding-left: 16px;
  background-color: #f5f7fa;
  border-radius: 12px;
  box-shadow: none !important;
  transition: all 0.3s ease;
  outline: none !important;
}

.dark .edit-tags-select :deep(.el-select__wrapper) {
  background-color: #1e1e22;
}

.edit-tags-select :deep(.el-select__wrapper.is-focused) {
  background-color: #fff !important;
  box-shadow: 0 0 0 4px rgb(64 158 255 / 10%) !important;
  outline: none !important;
}

.dark .edit-tags-select :deep(.el-select__wrapper.is-focused) {
  background-color: #242428 !important;
}

:deep(.edit-dialog) {
  overflow: hidden;
  border: none !important;
  border-radius: 20px !important;
}

:deep(.edit-dialog .el-dialog__header) {
  padding: 24px 24px 20px;
  margin-right: 0;
  border-bottom: 1px solid #f0f2f5;
}

.dark :deep(.edit-dialog .el-dialog__header) {
  border-bottom-color: #333;
}

:deep(.edit-dialog .el-dialog__body) {
  padding: 24px;
}

:deep(.edit-dialog .el-dialog__footer) {
  padding: 16px 24px 24px;
  border-top: 1px solid #f0f2f5;
}

:deep(.edit-dialog .el-dialog__footer .el-button) {
  height: 40px;
  padding: 0 24px;
  font-size: 14px;
  font-weight: 500;
  border-radius: 10px;
}

:deep(.edit-dialog .el-dialog__footer .el-button--primary) {
  padding: 0 28px;
  font-weight: 600;
}

.dark :deep(.edit-dialog .el-dialog__footer) {
  border-top-color: #333;
}

/* 下拉菜单 R 角 */
:global(.tag-select-popper) {
  padding: 4px !important;
  border-radius: 12px !important;
}

:global(.tag-select-popper .el-select-dropdown__wrap) {
  border-radius: 12px !important;
}

:global(.tag-select-popper .el-select-dropdown__list) {
  padding: 4px !important;
}

:global(.tag-select-popper .el-select-dropdown__item) {
  margin: 2px 0;
  border-radius: 8px;
}

/* 更多操作下拉菜单样式 */
:global(.more-actions-dropdown) {
  padding: 4px !important;
  background-color: #ffffff !important;
  border: 1px solid #e4e7ed !important;
  border-radius: 12px !important;
  box-shadow: 0 10px 30px rgb(0 0 0 / 12%) !important;
}

:global(.more-actions-dropdown .el-popper__arrow::before) {
  background-color: #ffffff !important;
  border: 1px solid #e4e7ed !important;
}

:global(.more-actions-dropdown .el-dropdown-menu) {
  padding: 0 !important;
  background-color: #ffffff !important;
  border: none !important;
}

:global(.more-actions-dropdown .el-dropdown-menu__item) {
  gap: 10px !important;
  padding: 10px 16px !important;
  font-size: 14px !important;
  font-weight: 500 !important;
  color: #606266 !important;
  background-color: transparent !important;
  border: none !important;
  border-radius: 8px !important;
  transition: all 0.2s ease !important;
}

:global(.more-actions-dropdown .el-dropdown-menu__item:hover),
:global(.more-actions-dropdown .el-dropdown-menu__item:focus),
:global(.more-actions-dropdown .el-dropdown-menu__item.is-focus) {
  color: #409eff !important;
  background-color: #f5f7fa !important;
  outline: none !important;
}

/* 适配深色模式 */
:global(.dark-mode) :global(.more-actions-dropdown),
:global(.dark) :global(.more-actions-dropdown) {
  background-color: #242428 !important;
  border-color: #434343 !important;
  box-shadow: 0 10px 30px rgb(0 0 0 / 40%) !important;
}

:global(.dark-mode) :global(.more-actions-dropdown .el-popper__arrow::before),
:global(.dark) :global(.more-actions-dropdown .el-popper__arrow::before) {
  background-color: #242428 !important;
  border-color: #434343 !important;
}

:global(.dark-mode) :global(.more-actions-dropdown .el-dropdown-menu),
:global(.dark) :global(.more-actions-dropdown .el-dropdown-menu) {
  background-color: #242428 !important;
}

:global(.dark-mode) :global(.more-actions-dropdown .el-dropdown-menu__item),
:global(.dark) :global(.more-actions-dropdown .el-dropdown-menu__item) {
  color: #cfd3dc !important;
}

:global(.dark-mode)
  :global(.more-actions-dropdown .el-dropdown-menu__item:hover),
:global(.dark-mode)
  :global(.more-actions-dropdown .el-dropdown-menu__item:focus),
:global(.dark) :global(.more-actions-dropdown .el-dropdown-menu__item:hover),
:global(.dark) :global(.more-actions-dropdown .el-dropdown-menu__item:focus) {
  color: #409eff !important;
  background-color: #333 !important;
}

/* 移除 Element Plus 默认的焦点蓝色背景 */
:global(.more-actions-dropdown .el-dropdown-menu__item--divided:before) {
  display: none !important;
}

:global(.more-actions-dropdown .el-dropdown-menu__item .el-icon) {
  margin-right: 0 !important;
  font-size: 16px !important;
}

/* 自定义确认框样式 */
:global(.custom-message-box) {
  padding-bottom: 8px !important;
  border: none !important;
  border-radius: 20px !important;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1) !important;
}

:global(.custom-message-box .el-message-box__header) {
  padding: 24px 24px 12px !important;
}

:global(.custom-message-box .el-message-box__title) {
  font-size: 18px !important;
  font-weight: 600 !important;
  color: #303133 !important;
}

:global(.custom-message-box .el-message-box__content) {
  padding: 12px 24px 24px !important;
  font-size: 15px !important;
  line-height: 1.6 !important;
  color: #606266 !important;
}

:global(.custom-message-box .el-message-box__status) {
  margin-right: 12px !important;
  font-size: 24px !important;
}

:global(.custom-message-box .el-message-box__message) {
  padding-left: 0 !important;
}

:global(.custom-message-box .el-message-box__btns) {
  padding: 12px 32px 32px !important;
}

:global(.custom-message-box .el-message-box__btns .el-button) {
  height: 46px !important;
  padding: 0 36px !important;
  font-size: 15px !important;
  font-weight: 600 !important;
  border-radius: 14px !important;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
  margin-left: 16px !important;
  letter-spacing: 0.5px !important;
}

:global(.custom-message-box .el-message-box__btns .el-button:first-child) {
  margin-left: 0 !important;
}

:global(.custom-message-box .el-message-box__btns .el-button--primary) {
  background: linear-gradient(135deg, #409eff 0%, #2a7fdf 100%) !important;
  border: none !important;
  box-shadow: 0 6px 16px rgba(64, 158, 255, 0.35) !important;
}

:global(.custom-message-box .el-message-box__btns .el-button--primary:hover) {
  transform: translateY(-1px) !important;
  box-shadow: 0 6px 20px rgba(64, 158, 255, 0.4) !important;
}

:global(.custom-message-box .el-message-box__btns .el-button:active) {
  transform: scale(0.96) !important;
}

/* 深色模式适配 */
:global(.dark) :global(.custom-message-box) {
  background-color: #242428 !important;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4) !important;
}

:global(.dark) :global(.custom-message-box .el-message-box__title) {
  color: #e0e0e0 !important;
}

:global(.dark) :global(.custom-message-box .el-message-box__content) {
  color: #a0a0a0 !important;
}

:global(.dark)
  :global(.custom-message-box .el-button--default:not(.el-button--primary)) {
  color: #cfd3dc !important;
  background-color: #333 !important;
  border-color: #434343 !important;
}

:global(.dark)
  :global(
    .custom-message-box .el-button--default:not(.el-button--primary):hover
  ) {
  color: #409eff !important;
  background-color: #3d3d42 !important;
  border-color: #409eff !important;
}

:global(.dark) :global(.custom-message-box .el-button--primary) {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
}

/* 举报弹窗自定义样式 */
:global(.custom-report-dialog) {
  border-radius: 24px !important;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15) !important;
  border: none !important;
  overflow: hidden !important;
}

:global(.custom-report-dialog .el-dialog__header) {
  margin-right: 0 !important;
  padding: 28px 32px 20px !important;
  background: linear-gradient(to right, #f8faff, #ffffff);
  border-bottom: 1px solid #f0f2f5 !important;
}

:global(.custom-report-dialog .el-dialog__title) {
  font-weight: 700 !important;
  font-size: 20px !important;
  color: #1d1d1f !important;
  letter-spacing: -0.02em !important;
}

:global(.custom-report-dialog .el-dialog__headerbtn) {
  top: 24px !important;
  right: 24px !important;
  font-size: 20px !important;
}

:global(.custom-report-dialog .el-dialog__body) {
  padding: 32px !important;
}

:global(.custom-report-dialog .el-form-item__label) {
  font-weight: 600 !important;
  color: #1d1d1f !important;
  margin-bottom: 12px !important;
  font-size: 15px !important;
}

:global(.custom-report-dialog .el-radio-group) {
  display: grid !important;
  grid-template-columns: 1fr 1fr !important;
  gap: 12px !important;
  width: 100% !important;
}

:global(.custom-report-dialog .el-radio) {
  margin-right: 0 !important;
  padding: 12px 16px !important;
  border: 1px solid #e3e8f0 !important;
  border-radius: 12px !important;
  height: auto !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  width: 100% !important;
  box-sizing: border-box !important;
}

:global(.custom-report-dialog .el-radio.is-checked) {
  background-color: rgba(64, 158, 255, 0.08) !important;
  border-color: #409eff !important;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15) !important;
}

:global(.custom-report-dialog .el-radio__inner) {
  width: 18px !important;
  height: 18px !important;
}

:global(.custom-report-dialog .el-radio__label) {
  font-size: 14px !important;
  padding-left: 8px !important;
  color: #4a5568 !important;
}

:global(.custom-report-dialog .el-radio.is-checked .el-radio__label) {
  color: #409eff !important;
  font-weight: 600 !important;
}

:global(.custom-report-dialog .el-textarea__inner) {
  border-radius: 12px !important;
  padding: 12px 16px !important;
  border: 1px solid #e3e8f0 !important;
  background-color: #f8fafc !important;
  transition: all 0.2s ease !important;
  font-size: 14px !important;
}

:global(.custom-report-dialog .el-textarea__inner:focus) {
  background-color: #ffffff !important;
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.1) !important;
}

:global(.custom-report-dialog .el-dialog__footer) {
  padding: 20px 32px 32px !important;
  border-top: 1px solid #f0f2f5 !important;
  background-color: #fafbfc !important;
}

:global(.custom-report-dialog .dialog-footer) {
  display: flex !important;
  justify-content: flex-end !important;
  gap: 12px !important;
}

:global(.custom-report-dialog .el-button) {
  height: 46px !important;
  padding: 0 36px !important;
  font-size: 15px !important;
  font-weight: 600 !important;
  border-radius: 14px !important;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
  letter-spacing: 0.5px !important;
}

:global(.custom-report-dialog .el-button--default:not(.el-button--primary)) {
  background-color: #ffffff !important;
  border: 1px solid #e3e8f0 !important;
  color: #4a5568 !important;
}

:global(
  .custom-report-dialog .el-button--default:not(.el-button--primary):hover
) {
  color: #1d1d1f !important;
  background-color: #f8fafc !important;
  border-color: #cbd5e1 !important;
}

:global(.custom-report-dialog .el-button--primary) {
  background: linear-gradient(135deg, #409eff 0%, #3a8ee6 100%) !important;
  border: none !important;
  box-shadow: 0 4px 14px rgba(64, 158, 255, 0.35) !important;
}

:global(.custom-report-dialog .el-button--primary:hover) {
  transform: translateY(-1px) !important;
  box-shadow: 0 6px 20px rgba(64, 158, 255, 0.45) !important;
}

:global(.custom-report-dialog .el-button--primary:active) {
  transform: translateY(1px) !important;
}

/* 深色模式适配 - 举报弹窗 */
:global(.dark) :global(.custom-report-dialog) {
  background-color: #1d1d1f !important;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5) !important;
}

:global(.dark) :global(.custom-report-dialog .el-dialog__header) {
  background: linear-gradient(to right, #242428, #1d1d1f) !important;
  border-bottom-color: #2d2d2f !important;
}

:global(.dark) :global(.custom-report-dialog .el-dialog__title) {
  color: #e0e0e0 !important;
}

:global(.dark) :global(.custom-report-dialog .el-form-item__label) {
  color: #e0e0e0 !important;
}

:global(.dark) :global(.custom-report-dialog .el-radio) {
  border-color: #333335 !important;
  background-color: #242428 !important;
}

:global(.dark) :global(.custom-report-dialog .el-radio.is-checked) {
  background-color: rgba(64, 158, 255, 0.1) !important;
  border-color: #409eff !important;
}

:global(.dark) :global(.custom-report-dialog .el-radio__label) {
  color: #a0a0a2 !important;
}

:global(.dark) :global(.custom-report-dialog .el-textarea__inner) {
  background-color: #161618 !important;
  border-color: #333335 !important;
  color: #e0e0e0 !important;
}

:global(.dark) :global(.custom-report-dialog .el-dialog__footer) {
  background-color: #1d1d1f !important;
  border-top-color: #2d2d2f !important;
}

:global(.dark)
  :global(.custom-report-dialog .el-button--default:not(.el-button--primary)) {
  background-color: #2d2d2f !important;
  border-color: #3d3d3f !important;
  color: #e0e0e0 !important;
}
</style>
