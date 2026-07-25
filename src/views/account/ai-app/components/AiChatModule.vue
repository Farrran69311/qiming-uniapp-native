<template>
  <div
    class="ai-chat-module h-full min-w-0 overflow-hidden flex flex-col bg-transparent"
  >
    <!-- 顶部精简导航 -->
    <div
      class="ai-chat-course-head flex items-center justify-between p-4 bg-white rounded-t-2xl border-b border-gray-100 z-10"
    >
      <div class="flex items-center gap-2">
        <el-tag size="small" effect="plain" round>{{ activeCourse }}</el-tag>
      </div>
    </div>

    <!-- 消息流：移除背景修饰文字，保持纯净 -->
    <el-scrollbar
      ref="scrollbarRef"
      class="ai-chat-message-scroll flex-1 min-h-0 min-w-0 px-4 py-6 scroll-smooth"
      @scroll="handleChatScroll"
      @wheel.passive="pauseStreamingAnswerFollow"
      @touchstart.passive="pauseStreamingAnswerFollow"
    >
      <transition-group
        appear
        name="chat-list"
        tag="div"
        class="w-full min-w-0 space-y-5 pb-10"
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
            <section
              v-if="msg.type === 'system' && shouldShowProcessPanel(msg)"
              class="stream-progress"
              :class="{
                'is-error': msg.error,
                'is-partial': msg.partial || msg.stopped,
                'is-expanded': isProcessExpanded(msg)
              }"
              aria-live="polite"
            >
              <button
                type="button"
                class="stream-progress__header"
                :aria-expanded="isProcessExpanded(msg)"
                :aria-controls="getProcessPanelId(msg.id)"
                @click="toggleProcessPanel(msg)"
              >
                <span class="stream-progress__heading">
                  <AssistantProcessIcon
                    kind="terminal"
                    :tone="getMessageProgressTone(msg)"
                    :size="26"
                  />
                  <span>思考及处理过程</span>
                </span>
                <span class="stream-progress__header-meta">
                  <span v-if="msg.elapsedMs !== undefined">
                    {{ formatElapsed(msg.elapsedMs) }}
                  </span>
                  <el-icon class="stream-progress__chevron">
                    <ArrowDown />
                  </el-icon>
                </span>
              </button>

              <transition name="process-collapse">
                <div
                  v-if="isProcessExpanded(msg)"
                  :id="getProcessPanelId(msg.id)"
                  class="stream-progress__body"
                >
                  <div
                    v-if="
                      !msg.progressTimeline?.length && isMessagePending(msg)
                    "
                    class="stream-progress__pending"
                  >
                    <div class="thinking-status" aria-label="智能助教正在思考">
                      <AssistantProcessIcon
                        :stage="getCurrentThinkingStage(msg)"
                        tone="running"
                        :size="38"
                        class="thinking-process-icon"
                      />
                      <div class="thinking-copy">
                        <span class="thinking-eyebrow">学习助手正在处理</span>
                        <span
                          :key="getThinkingText(msg)"
                          class="thinking-typewriter"
                          :style="{
                            '--thinking-chars': getThinkingText(msg).length,
                            '--thinking-width': `${getThinkingText(msg).length}em`
                          }"
                        >
                          {{ getThinkingText(msg) }}
                        </span>
                      </div>
                      <span class="thinking-dots" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                    </div>
                  </div>
                  <ol
                    v-if="msg.progressTimeline?.length"
                    class="stream-progress__timeline"
                  >
                    <li
                      v-for="(step, index) in msg.progressTimeline"
                      :key="`${step.sequence || index}-${step.stage}`"
                      :class="`is-${progressTone(step.status)}`"
                    >
                      <AssistantProcessIcon
                        :stage="step.stage"
                        :tone="progressTone(step.status)"
                        :size="30"
                        class="stream-progress__icon"
                      />
                      <div class="stream-progress__content">
                        <div class="stream-progress__meta">
                          <strong>{{ formatStreamStage(step.stage) }}</strong>
                          <span>{{ formatStatusLabel(step.status) }}</span>
                        </div>
                        <p>{{ step.summary }}</p>
                      </div>
                    </li>
                  </ol>
                  <p v-if="msg.errorMessage" class="stream-progress__notice">
                    {{ msg.errorMessage }}
                  </p>
                  <button
                    v-if="msg.retryable && !msg.streaming"
                    type="button"
                    class="stream-progress__retry"
                    @click="emit('regenerate', msg.id)"
                  >
                    重新生成
                  </button>
                </div>
              </transition>
            </section>

            <!-- 消息气泡 -->
            <div
              v-if="!isMessagePending(msg)"
              :ref="element => setAssistantAnswerRef(msg, element)"
              :class="[
                'message-bubble',
                msg.type === 'user'
                  ? 'message-bubble-user'
                  : 'message-bubble-system'
              ]"
            >
              <div
                v-if="msg.type === 'system'"
                class="message-content markdown-content"
                v-html="renderMarkdownContent(msg.content)"
              />
              <div v-else class="message-content">
                {{
                  formatMessageContent(msg.content) ||
                  "我把相关学习信息整理在下面。"
                }}
              </div>
            </div>

            <div
              v-if="msg.type === 'system' && hasSpeechControl(msg)"
              class="speech-control"
              :class="`is-${msg.speechPlaybackState || 'ready'}`"
              aria-live="polite"
            >
              <span class="speech-control__status">
                <span class="speech-control__dot" />
                {{ speechStatusText(msg) }}
              </span>
              <button
                v-if="canPlaySpeech(msg)"
                type="button"
                class="speech-control__button"
                title="播放语音"
                @click="emit('play-speech', msg.id)"
              >
                <el-icon><VideoPlay /></el-icon>
                <span>播放</span>
              </button>
              <button
                v-else-if="msg.speechPlaybackState === 'playing'"
                type="button"
                class="speech-control__button"
                title="停止播放"
                @click="emit('stop-speech', msg.id)"
              >
                <el-icon><CircleClose /></el-icon>
                <span>停止</span>
              </button>
            </div>

            <section
              v-if="msg.type === 'system' && msg.explanationImages?.length"
              class="explanation-image-list"
            >
              <ExplanationImageCard
                v-for="image in msg.explanationImages"
                :key="image.image_id"
                :image="image"
                @refresh="
                  imageId =>
                    emit('refresh-explanation-image', {
                      imageId,
                      messageId: msg.id
                    })
                "
              />
            </section>

            <!-- 资源卡片：多种形态 -->
            <transition-group
              v-if="msg.type === 'system' && msg.resources?.length"
              appear
              name="stagger-list"
              tag="div"
              class="assistant-resource-grid"
            >
              <div
                v-for="(res, index) in msg.resources"
                :key="res.title"
                :style="{ transitionDelay: `${index * 100}ms` }"
                class="flex flex-col gap-2 p-3 rounded-xl bg-gray-50/80 border border-gray-100 hover:border-primary/40 hover:bg-white cursor-pointer shadow-sm transition-colors duration-200 group"
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
                  class="h-24 w-full rounded-lg relative overflow-hidden flex items-end justify-center gap-1 px-3 py-2 bg-slate-100 border border-slate-200"
                >
                  <div
                    class="absolute inset-0 bg-white/20 transition-colors duration-200"
                  />
                  <div class="flex flex-col-reverse gap-1 z-10">
                    <div
                      class="w-12 h-4 rounded bg-white text-[10px] font-bold text-slate-700 flex items-center justify-center border border-slate-200"
                    >
                      A
                    </div>
                    <div
                      class="w-12 h-4 rounded bg-white text-[10px] font-bold text-slate-700 flex items-center justify-center border border-slate-200"
                    >
                      B
                    </div>
                    <div
                      class="w-12 h-4 rounded bg-white text-[10px] font-bold text-primary flex items-center justify-center border border-blue-200"
                    >
                      C
                    </div>
                  </div>
                  <div
                    class="absolute top-1 left-2 text-[10px] font-bold text-slate-500 z-10"
                  >
                    Stack · LIFO
                  </div>
                  <div
                    class="absolute bottom-1 right-1 text-[10px] bg-white text-slate-500 border border-slate-200 px-1.5 rounded z-10"
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

            <div
              v-if="canShowAssistantActions(msg)"
              class="assistant-action-row"
            >
              <button
                type="button"
                class="assistant-action-button"
                :class="{ 'is-active': isSafetyExpanded(msg.id) }"
                @click="toggleSafetyDetails(msg.id)"
              >
                <ReviewFileIcon class="assistant-action-svg" />
                <span>
                  {{
                    isSafetyExpanded(msg.id)
                      ? "收起安全状态"
                      : "查看详细安全状态"
                  }}
                </span>
              </button>
              <button
                type="button"
                class="assistant-action-button"
                :class="{ 'is-active': isMessageLiked(msg.id) }"
                @click="toggleLikedMessage(msg.id)"
              >
                <el-icon><Star /></el-icon>
                <span>{{ isMessageLiked(msg.id) ? "已点赞" : "点赞" }}</span>
              </button>
              <el-dropdown
                trigger="click"
                @command="command => handleMoreCommand(command, msg)"
              >
                <button
                  type="button"
                  class="assistant-action-button"
                  aria-label="更多选项"
                >
                  <el-icon><MoreFilled /></el-icon>
                  <span>更多</span>
                </button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="copy">
                      <el-icon><CopyDocument /></el-icon>
                      复制回答
                    </el-dropdown-item>
                    <el-dropdown-item command="review">
                      <ReviewFileIcon class="assistant-menu-svg" />
                      再次审查
                    </el-dropdown-item>
                    <el-dropdown-item command="regenerate">
                      <el-icon><Refresh /></el-icon>
                      再次生成
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>

            <transition name="fade-detail">
              <div
                v-if="canShowAssistantActions(msg) && isSafetyExpanded(msg.id)"
                class="safety-detail-panel"
                :class="`is-${getSafetyTone(msg)}`"
              >
                <div class="safety-detail-header">
                  <span>安全状态：{{ getSafetyLabel(msg) }}</span>
                  <span v-if="msg.safetyFlags?.length" class="safety-count">
                    {{ msg.safetyFlags.length }} 条命中
                  </span>
                </div>
                <p class="safety-summary">
                  {{
                    msg.safetySummary ||
                    "本次回答已完成安全检查，暂无额外告警。"
                  }}
                </p>
                <div v-if="msg.safetyFlags?.length" class="safety-flag-list">
                  <span
                    v-for="flag in msg.safetyFlags"
                    :key="flag"
                    class="safety-flag"
                  >
                    {{ formatMachineLabel(flag) }}
                  </span>
                </div>
              </div>
            </transition>

            <div v-if="hasAssistantDetails(msg)" class="assistant-detail-stack">
              <div v-if="msg.sourceRefs?.length" class="assistant-detail-panel">
                <div
                  class="assistant-detail-title assistant-detail-title--icon"
                >
                  <AssistantProcessIcon kind="search" :size="28" />
                  <span>回答依据</span>
                </div>
                <div class="source-ref-list">
                  <div
                    v-for="source in msg.sourceRefs"
                    :key="`${source.source_type}-${source.ref_id || source.title}`"
                    class="source-ref-item"
                  >
                    <div class="source-ref-meta">
                      <AssistantProcessIcon
                        :stage="source.source_type"
                        :size="24"
                        bare
                      />
                      <span class="source-ref-type">
                        {{ formatSourceType(source.source_type) }}
                      </span>
                      <strong>{{ source.title }}</strong>
                      <span v-if="source.confidence">
                        {{ Math.round(source.confidence * 100) }}%
                      </span>
                    </div>
                    <p v-if="source.summary">
                      {{ source.summary }}
                    </p>
                  </div>
                </div>
              </div>

              <div
                v-if="msg.videoSegments?.length"
                class="assistant-detail-panel"
              >
                <div class="assistant-detail-title">相关视频片段</div>
                <div class="video-segment-grid">
                  <button
                    v-for="segment in msg.videoSegments"
                    :key="segment.segment_id"
                    type="button"
                    class="video-segment-card"
                    :class="{
                      'is-loading':
                        props.videoSegmentPreviewingId === segment.segment_id
                    }"
                    :disabled="
                      props.videoSegmentPreviewingId === segment.segment_id
                    "
                    :aria-busy="
                      props.videoSegmentPreviewingId === segment.segment_id
                    "
                    :aria-label="`播放视频片段：${segment.title}`"
                    @click="emit('preview-video-segment', segment)"
                  >
                    <div class="video-segment-title">
                      <el-icon
                        :class="{
                          'is-loading':
                            props.videoSegmentPreviewingId ===
                            segment.segment_id
                        }"
                      >
                        <Loading
                          v-if="
                            props.videoSegmentPreviewingId ===
                            segment.segment_id
                          "
                        />
                        <VideoPlay v-else />
                      </el-icon>
                      <span>{{ segment.title }}</span>
                    </div>
                    <p v-if="segment.summary">
                      {{ segment.summary }}
                    </p>
                    <div class="video-segment-time">
                      {{ formatMs(segment.start_ms) }} -
                      {{ formatMs(segment.end_ms) }}
                      <span v-if="segment.source_status">
                        · {{ formatStatusLabel(segment.source_status) }}
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              <div
                v-if="msg.resourceTask"
                class="assistant-detail-panel is-task"
              >
                <div
                  class="assistant-detail-title assistant-detail-title--icon"
                >
                  <AssistantProcessIcon
                    kind="tools"
                    :tone="progressTone(msg.resourceTask.status)"
                    :size="28"
                  />
                  <span>
                    实时资源任务：{{
                      formatStatusLabel(msg.resourceTask.status)
                    }}
                  </span>
                </div>
                <p>{{ formatResourceTaskText(msg.resourceTask) }}</p>
                <el-progress
                  v-if="typeof msg.resourceTask.progress === 'number'"
                  class="resource-task-progress"
                  :percentage="
                    Math.min(100, Math.max(0, msg.resourceTask.progress))
                  "
                  :status="resourceTaskProgressStatus(msg.resourceTask.status)"
                  :stroke-width="8"
                />
                <p
                  v-if="msg.resourceTask.error_message"
                  class="task-error-copy"
                >
                  {{ msg.resourceTask.error_message }}
                </p>
              </div>

              <details
                v-if="msg.reasoningSummary"
                class="assistant-detail-panel reasoning-summary"
              >
                <summary>
                  <span class="reasoning-summary__label">
                    <AssistantProcessIcon kind="pencil" :size="28" />
                    <span>分析摘要</span>
                  </span>
                  <el-icon class="reasoning-summary__chevron">
                    <ArrowDown />
                  </el-icon>
                </summary>
                <p>{{ msg.reasoningSummary }}</p>
              </details>
            </div>

            <div
              v-if="msg.type === 'system' && msg.followups?.length"
              class="followup-panel"
            >
              <div class="followup-title">推荐提问</div>
              <div
                class="followup-grid"
                :class="{ 'is-single': msg.followups.length === 1 }"
              >
                <button
                  v-for="(followup, index) in msg.followups"
                  :key="followup.text"
                  type="button"
                  class="followup-card"
                  @click="emit('send', followup.text)"
                >
                  <span class="followup-index">
                    {{ getFollowupLabel(index) }}
                  </span>
                  <span class="followup-text">
                    {{ followup.text }}
                  </span>
                  <span
                    v-if="msg.followups.length === 1"
                    class="followup-action"
                  >
                    立即追问
                  </span>
                </button>
              </div>
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
      <div
        v-if="answerAnchorSpacerHeight > 0"
        class="assistant-answer-anchor-space"
        :style="{ height: `${answerAnchorSpacerHeight}px` }"
        aria-hidden="true"
      />
    </el-scrollbar>

    <!-- 输入区：悬浮极简设计，带常驻选择器 -->
    <div class="ai-chat-composer-shell p-4 bg-transparent z-10 w-full min-w-0">
      <div class="w-full min-w-0 relative group">
        <div
          class="ai-chat-composer ai-mobile-composer-surface relative bg-white border border-gray-200 rounded-2xl shadow-sm focus-within:border-primary/40 focus-within:shadow-[0_0_0_3px_rgba(47,111,203,0.10)] transition-all duration-200 overflow-hidden"
          data-ai-mobile-composer="chat"
        >
          <!-- 输入框 -->
          <input
            ref="attachmentInputRef"
            type="file"
            multiple
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            class="chat-attachment-input"
            @change="handleAttachmentChange"
          />
          <div class="ai-chat-composer__input-row flex items-end gap-2 p-2">
            <el-button
              :icon="Plus"
              class="!rounded-lg mb-1 hover:bg-gray-100 transition-colors duration-200 hover:!border-primary/50"
              :disabled="loading"
              title="上传 PDF、DOCX 或 TXT"
              @click="handleAttachmentButtonClick"
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
              v-if="loading"
              :icon="CircleClose"
              title="停止生成"
              class="!rounded-lg mb-1"
              @click="emit('stop')"
            />
            <el-button
              v-else
              type="primary"
              :icon="Promotion"
              :disabled="!input.trim() || modelReady === false"
              :title="
                modelReady === false
                  ? modelDisabledReason || '当前没有可用模型'
                  : '发送'
              "
              class="!rounded-lg mb-1 transform transition-all duration-200 active:scale-95"
              :class="
                input
                  ? 'scale-100 opacity-100 translate-x-0'
                  : 'scale-0 opacity-0 translate-x-4'
              "
              @click="handleSend"
            />
          </div>
          <div v-if="pendingAttachments.length" class="chat-attachment-shelf">
            <div
              v-for="attachment in pendingAttachments"
              :key="attachment.id"
              class="chat-attachment-pill"
              :title="`${attachment.name} · ${formatAttachmentSize(
                attachment.size
              )}`"
            >
              <el-icon class="chat-attachment-pill__icon">
                <Document />
              </el-icon>
              <span class="chat-attachment-pill__name">
                {{ attachment.name }}
              </span>
              <span class="chat-attachment-pill__meta">
                {{ attachment.extension }}
              </span>
              <button
                type="button"
                class="chat-attachment-pill__remove"
                title="移除附件"
                @click="removeAttachment(attachment.id)"
              >
                ×
              </button>
            </div>
          </div>

          <!-- 常驻工具栏：课程 / 模式 / 智能体 / 思考模式 / 模型 -->
          <div
            class="ai-chat-toolbar flex min-w-0 flex-wrap items-center justify-between gap-2 px-3 py-2 bg-gray-50/60 border-t border-gray-100"
          >
            <div class="chat-toolbar-left flex min-w-0 flex-wrap items-center">
              <el-dropdown
                v-if="courses && courses.length"
                trigger="click"
                popper-class="ai-chat-toolbar-dropdown"
                @command="c => emit('switch-course', c)"
              >
                <span class="chat-toolbar-chip chat-toolbar-chip--active">
                  <el-icon class="chat-toolbar-chip__icon">
                    <FolderOpened />
                  </el-icon>
                  <span class="chat-toolbar-chip__text">
                    {{ activeCourse }}
                  </span>
                  <el-icon class="chat-toolbar-chip__arrow">
                    <ArrowDown />
                  </el-icon>
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

              <span class="chat-toolbar-chip chat-toolbar-chip--static">
                <el-icon class="chat-toolbar-chip__icon"><Monitor /></el-icon>
                <span class="chat-toolbar-chip__text">{{ mode }}</span>
              </span>

              <el-dropdown
                v-if="explanationImageEnabled"
                trigger="click"
                popper-class="ai-chat-toolbar-dropdown"
                @command="m => emit('update:explanationImageMode', m)"
              >
                <span
                  class="chat-toolbar-chip chat-toolbar-chip--interactive"
                  :title="
                    explanationImageMode === 'off'
                      ? '已关闭讲解图片'
                      : '讲解图片将在文字回答完成后异步生成'
                  "
                >
                  <el-icon class="chat-toolbar-chip__icon"><Picture /></el-icon>
                  <span class="chat-toolbar-chip__text">
                    讲解图
                    {{ explanationImageMode === "off" ? "关闭" : "自动" }}
                  </span>
                  <el-icon class="chat-toolbar-chip__arrow">
                    <ArrowDown />
                  </el-icon>
                </span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="auto_wide">
                      讲解图自动生成
                    </el-dropdown-item>
                    <el-dropdown-item command="off">
                      关闭讲解图片
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>

              <el-dropdown
                trigger="click"
                popper-class="ai-chat-toolbar-dropdown"
                @command="a => emit('update:selectedAgent', a)"
              >
                <span class="chat-toolbar-chip chat-toolbar-chip--interactive">
                  <el-icon class="chat-toolbar-chip__icon"><Cpu /></el-icon>
                  <span class="chat-toolbar-chip__text">
                    {{ selectedAgent }}
                  </span>
                  <el-icon class="chat-toolbar-chip__arrow">
                    <ArrowDown />
                  </el-icon>
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
                popper-class="ai-chat-toolbar-dropdown"
                @command="t => emit('update:thinkingMode', t)"
              >
                <span class="chat-toolbar-chip chat-toolbar-chip--interactive">
                  <AssistantProcessIcon
                    kind="terminal"
                    :size="17"
                    bare
                    class="chat-toolbar-chip__icon"
                  />
                  <span class="chat-toolbar-chip__text">
                    {{ thinkingMode }}
                  </span>
                  <el-icon class="chat-toolbar-chip__arrow">
                    <ArrowDown />
                  </el-icon>
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
              popper-class="ai-chat-toolbar-dropdown"
              @command="m => emit('update:selectedModel', m)"
            >
              <span
                class="ai-chat-model-trigger text-[11px] text-gray-400 font-medium tracking-wide flex min-w-0 items-center cursor-pointer hover:text-gray-600 transition-colors"
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
                    :disabled="!isModelSelectable(model)"
                    :title="modelOptionTitle(model)"
                  >
                    <span class="model-option">
                      <span class="model-option__label">
                        {{ model.label }}
                      </span>
                      <span
                        v-if="model.status && model.status !== 'available'"
                        class="model-option__status"
                        :class="`is-${model.status}`"
                      >
                        {{ modelStatusText(model.status) }}
                      </span>
                    </span>
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
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from "vue";
import MarkdownIt from "markdown-it";
import assistantAvatar from "@/assets/ai-app/assistant-avatar.png";
import {
  User,
  Cpu,
  Document,
  Film,
  VideoPlay,
  Promotion,
  Plus,
  FolderOpened,
  Monitor,
  Picture,
  ArrowDown,
  Star,
  Refresh,
  MoreFilled,
  CopyDocument,
  CircleClose,
  Loading
} from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { assistantModelReasonText } from "@/api/frontend/assistant";
import ReviewFileIcon from "@/assets/review-file-svgrepo-com.svg?component";
import AssistantProcessIcon from "./AssistantProcessIcon.vue";
import ExplanationImageCard from "./ExplanationImageCard.vue";

const markdownRenderer = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true
});
const defaultLinkOpenRenderer =
  markdownRenderer.renderer.rules.link_open ||
  ((tokens, idx, options, _env, self) =>
    self.renderToken(tokens, idx, options));
markdownRenderer.renderer.rules.link_open = (
  tokens,
  idx,
  options,
  env,
  self
) => {
  const token = tokens[idx];
  const href = token.attrGet("href") || "";
  const normalizedHref = /^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(href)
    ? `https://${href}`
    : href;
  if (normalizedHref !== href) {
    token.attrSet("href", normalizedHref);
  }
  if (/^https?:\/\//i.test(normalizedHref)) {
    token.attrSet("target", "_blank");
    token.attrSet("rel", "noopener noreferrer");
  }
  return defaultLinkOpenRenderer(tokens, idx, options, env, self);
};

type AssistantOptionView = {
  key: string;
  label: string;
  description?: string;
  status?: string;
  capabilities?: string[];
  default_for?: string[];
  limits?: Record<string, number>;
  reason?: string;
};

type ExplanationImageMode = "off" | "auto" | "auto_wide";

const props = defineProps<{
  messages: any[];
  activeCourse: string;
  courses?: string[];
  mode?: string;
  userAvatar?: string;
  agents?: AssistantOptionView[];
  models?: AssistantOptionView[];
  thinkingModes?: AssistantOptionView[];
  selectedAgent?: string;
  selectedModel?: string;
  thinkingMode?: string;
  explanationImageEnabled?: boolean;
  explanationImageMode?: ExplanationImageMode;
  modelReady?: boolean;
  modelDisabledReason?: string;
  loading?: boolean;
  videoSegmentPreviewingId?: string;
}>();

const emit = defineEmits([
  "send",
  "switch-course",
  "exit",
  "preview",
  "preview-video-segment",
  "regenerate",
  "stop",
  "play-speech",
  "stop-speech",
  "refresh-explanation-image",
  "update:selectedAgent",
  "update:selectedModel",
  "update:thinkingMode",
  "update:explanationImageMode"
]);
const input = ref("");
const attachmentInputRef = ref<HTMLInputElement | null>(null);
type PendingAttachment = {
  id: string;
  file: File;
  name: string;
  size: number;
  extension: string;
};
const pendingAttachments = ref<PendingAttachment[]>([]);
const maxAttachmentSize = 20 * 1024 * 1024;
const supportedAttachmentExtensions = new Set(["PDF", "DOCX", "TXT"]);

type ChatScrollbarInstance = {
  wrapRef?: HTMLDivElement;
  setScrollTop: (scrollTop: number) => void;
};

type MessageId = string | number;

const scrollbarRef = ref<ChatScrollbarInstance | null>(null);
const shouldFollowLatestMessages = ref(true);
const autoFollowThreshold = 48;
const processExpandedById = ref<Record<string, boolean>>({});
const answerAnchorSpacerHeight = ref(0);
const expandedSafetyIds = ref<Set<string | number>>(new Set());
const likedMessageIds = ref<Set<string | number>>(new Set());
const thinkingStepIndex = ref(0);
const thinkingTexts = ["正在思考", "正在个性化总结", "正在深度推理"];
const assistantAnswerElements = new Map<string, HTMLElement>();
const pendingAssistantMessageIds = new Set<string>();
const streamingBodyStartedIds = new Set<string>();
const messageContentLengths = new Map<string, number>();
let answerAnchorMessageId = "";
let streamingAnswerFollowEnabled = true;
let streamingAnswerFollowReadyAt = 0;
let answerAnchorTimer: number | undefined;
let streamingAnswerFollowFrame: number | undefined;
let viewportResizeObserver: ResizeObserver | undefined;
let thinkingTimer: number | undefined;
const machineLabelMap: Record<string, string> = {
  platform_data: "平台数据",
  generated_resource: "生成资源",
  course_material: "课程资料",
  knowledge_base: "知识库",
  student_profile: "学习画像",
  conversation_history: "历史对话",
  video_segment: "视频片段",
  web_search: "网络检索",
  rag_empty: "知识库为空",
  chat_answer_checked: "回答已检查",
  request_input_checked: "输入已检查",
  llm_unavailable: "模型不可用",
  video_segment_index_missing: "视频索引缺失",
  citation_low_coverage: "引用覆盖不足",
  python_status_degraded: "Python 状态降级",
  sensitive_term_hit: "命中敏感词",
  sensitive_term_blocked: "敏感词已拦截",
  blocked: "已阻断",
  degraded: "降级",
  warning: "提醒",
  checked: "已检查",
  safe: "已通过",
  completed: "已完成",
  completed_with_warnings: "带警告完成",
  partial: "部分完成",
  cancelled: "已停止",
  running: "进行中",
  pending: "等待中",
  failed: "失败",
  ready: "就绪",
  request_started: "已开始处理",
  request_validating: "请求校验",
  request_preparing: "准备上下文",
  context_loading: "加载上下文",
  knowledge_retrieval: "检索资料",
  answer_generating: "生成回答",
  safety_checking: "安全检查",
  persisting: "保存回答",
  postprocess_queued: "后台处理已入队",
  profile_refresh: "刷新画像与评估",
  stream: "连接状态"
};

const hasSpeechControl = (message: any) =>
  Boolean(
    message.speech?.session_id ||
      (message.speechPlaybackState &&
        message.speechPlaybackState !== "disabled")
  );

const canPlaySpeech = (message: any) =>
  Boolean(
    message.speech?.session_id &&
      ["ready", "paused"].includes(message.speechPlaybackState || "")
  );

const speechStatusText = (message: any) => {
  const state = message.speechPlaybackState || message.speech?.status || "";
  const labels: Record<string, string> = {
    preparing: "正在准备实时语音",
    connecting: "语音正在生成",
    streaming: "正在实时播报",
    finalizing: "正在生成完整录音",
    ready: "完整录音可播放",
    playing: "正在播放完整录音",
    paused: "语音已暂停",
    cancelled: "语音已停止",
    failed: "语音不可用或已失效",
    unavailable: "本次回答仅提供文字"
  };
  return labels[state] || "语音状态更新中";
};

const selectableModelStatuses = new Set(["available", "deprecated"]);
const normalizedModelStatus = (model?: AssistantOptionView) =>
  model?.status || "available";
const isModelSelectable = (model?: AssistantOptionView) =>
  selectableModelStatuses.has(normalizedModelStatus(model));
const modelStatusText = (status?: string) => {
  const map: Record<string, string> = {
    available: "可用",
    unavailable: "不可用",
    degraded: "降级",
    deprecated: "兼容"
  };
  return map[status || ""] || status || "";
};
const modelOptionTitle = (model: AssistantOptionView) => {
  const reason = model.reason ? assistantModelReasonText(model.reason) : "";
  return [model.description, reason].filter(Boolean).join(" · ");
};

const getAttachmentExtension = (file: File) =>
  (file.name.split(".").pop()?.trim() || "").toUpperCase();
const formatAttachmentSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};
const isSupportedAttachment = (file: File) =>
  supportedAttachmentExtensions.has(getAttachmentExtension(file));
const handleAttachmentButtonClick = () => {
  if (props.loading) return;
  attachmentInputRef.value?.click();
};
const handleAttachmentChange = (event: Event) => {
  const inputEl = event.target as HTMLInputElement;
  const files = Array.from(inputEl.files || []);
  if (!files.length) return;

  const accepted: PendingAttachment[] = [];
  const rejected: string[] = [];
  files.forEach((file, index) => {
    const extension = getAttachmentExtension(file);
    if (!isSupportedAttachment(file)) {
      rejected.push(`${file.name} 格式不支持`);
      return;
    }
    if (file.size > maxAttachmentSize) {
      rejected.push(`${file.name} 超过 20MB`);
      return;
    }
    accepted.push({
      id: `${file.name}-${file.size}-${file.lastModified}-${Date.now()}-${index}`,
      file,
      name: file.name,
      size: file.size,
      extension
    });
  });

  if (accepted.length) {
    pendingAttachments.value = [...pendingAttachments.value, ...accepted].slice(
      0,
      3
    );
    ElMessage.success(`已添加 ${accepted.length} 个文档附件`);
  }
  if (rejected.length) {
    ElMessage.warning(rejected.slice(0, 2).join("；"));
  }
  inputEl.value = "";
};
const removeAttachment = (id: string) => {
  pendingAttachments.value = pendingAttachments.value.filter(
    item => item.id !== id
  );
};

const wordLabelMap: Record<string, string> = {
  platform: "平台",
  data: "数据",
  generated: "生成",
  resource: "资源",
  course: "课程",
  material: "资料",
  student: "学生",
  profile: "画像",
  conversation: "对话",
  history: "历史",
  video: "视频",
  segment: "片段",
  source: "来源",
  status: "状态",
  index: "索引",
  missing: "缺失",
  sensitive: "敏感",
  term: "词",
  hit: "命中",
  blocked: "阻断",
  checked: "检查",
  request: "请求",
  input: "输入",
  answer: "回答",
  citation: "引用",
  low: "不足",
  coverage: "覆盖",
  unavailable: "不可用",
  degraded: "降级",
  empty: "为空"
};

const getMessageAvatar = (msg: any) => {
  if (msg.avatar) return msg.avatar;
  if (msg.type === "user") return props.userAvatar || "";
  return assistantAvatar;
};

const getMessageAvatarSize = (msg: any) => (msg.type === "system" ? 40 : 28);

const messageKey = (id: MessageId) => String(id);

const hasAssistantTextContent = (msg: any) =>
  msg.type === "system" && !!String(msg.content || "").trim();

const isMessagePending = (msg: any) =>
  msg.type === "system" && msg.streaming && !String(msg.content || "").trim();

const setAssistantAnswerRef = (msg: any, element: unknown) => {
  if (msg.type !== "system") return;
  const key = messageKey(msg.id);
  if (element instanceof HTMLElement) {
    assistantAnswerElements.set(key, element);
  } else {
    assistantAnswerElements.delete(key);
  }
};

const hasMessageContent = (msg: any) =>
  !!String(msg.content || "").trim() ||
  (Array.isArray(msg.resources) && msg.resources.length > 0) ||
  (Array.isArray(msg.sourceRefs) && msg.sourceRefs.length > 0) ||
  (Array.isArray(msg.videoSegments) && msg.videoSegments.length > 0) ||
  (Array.isArray(msg.followups) && msg.followups.length > 0) ||
  (Array.isArray(msg.explanationImages) && msg.explanationImages.length > 0) ||
  !!msg.resourceTask ||
  !!msg.safetyStatus ||
  !!msg.safetySummary ||
  (Array.isArray(msg.safetyFlags) && msg.safetyFlags.length > 0) ||
  hasStreamStatus(msg);

const shouldRenderMessage = (msg: any) =>
  hasMessageContent(msg) || isMessagePending(msg);

const visibleMessages = computed(() =>
  (props.messages || []).filter(shouldRenderMessage)
);

const currentThinkingText = computed(
  () => thinkingTexts[thinkingStepIndex.value % thinkingTexts.length]
);

const getThinkingText = (msg: any) => {
  const timeline = Array.isArray(msg.progressTimeline)
    ? msg.progressTimeline
    : [];
  return timeline[timeline.length - 1]?.summary || currentThinkingText.value;
};

const getCurrentThinkingStage = (msg: any) => {
  const timeline = Array.isArray(msg.progressTimeline)
    ? msg.progressTimeline
    : [];
  return timeline[timeline.length - 1]?.stage || "request_started";
};

const hasStreamStatus = (msg: any) =>
  (Array.isArray(msg.progressTimeline) && msg.progressTimeline.length > 0) ||
  !!msg.errorMessage ||
  !!msg.stopped;

const shouldShowProcessPanel = (msg: any) =>
  !!msg.streaming ||
  hasStreamStatus(msg) ||
  streamingBodyStartedIds.has(messageKey(msg.id));

const getProcessPanelId = (id: MessageId) =>
  `assistant-process-${messageKey(id).replace(/[^a-zA-Z0-9_-]/g, "-")}`;

const hasExplicitProcessState = (id: MessageId) =>
  Object.prototype.hasOwnProperty.call(
    processExpandedById.value,
    messageKey(id)
  );

const isProcessExpanded = (msg: any) => {
  const key = messageKey(msg.id);
  if (hasExplicitProcessState(msg.id)) {
    return processExpandedById.value[key];
  }
  return (
    isMessagePending(msg) ||
    (!hasAssistantTextContent(msg) && (msg.error || msg.stopped))
  );
};

const setProcessExpanded = (id: MessageId, expanded: boolean) => {
  processExpandedById.value = {
    ...processExpandedById.value,
    [messageKey(id)]: expanded
  };
};

const toggleProcessPanel = (msg: any) => {
  const expanded = !isProcessExpanded(msg);
  setProcessExpanded(msg.id, expanded);
  if (!expanded && answerAnchorMessageId === messageKey(msg.id)) {
    scheduleAssistantAnswerAnchor(msg.id);
  }
};

const formatStreamStage = (stage?: string) => formatMachineLabel(stage);

const formatElapsed = (value?: number) => {
  const totalSeconds = Math.max(0, Math.round(Number(value || 0) / 1000));
  if (totalSeconds < 60) return `${totalSeconds} 秒`;
  return `${Math.floor(totalSeconds / 60)} 分 ${totalSeconds % 60} 秒`;
};

const progressTone = (status?: string) => {
  if (["failed", "blocked"].includes(String(status || ""))) return "error";
  if (
    ["partial", "degraded", "cancelled", "completed_with_warnings"].includes(
      String(status || "")
    )
  ) {
    return "warning";
  }
  if (["completed", "ready", "safe"].includes(String(status || ""))) {
    return "success";
  }
  return "running";
};

const getMessageProgressTone = (msg: any) => {
  if (msg.error) return "error";
  if (msg.partial || msg.stopped) return "warning";
  if (!msg.streaming && msg.streamStatus === "completed") return "success";
  return "running";
};

const resourceTaskProgressStatus = (status?: string) => {
  const tone = progressTone(status);
  if (tone === "error") return "exception";
  if (tone === "warning") return "warning";
  if (tone === "success") return "success";
  return undefined;
};

const formatMessageContent = (content: unknown) => String(content || "").trim();
const renderMarkdownContent = (content: unknown) =>
  markdownRenderer.render(
    formatMessageContent(content) || "我把相关学习信息整理在下面。"
  );

const canShowAssistantActions = (msg: any) =>
  msg.type === "system" &&
  msg.id !== "assistant-greeting" &&
  !msg.streaming &&
  !msg.error;

const hasAssistantDetails = (msg: any) =>
  msg.sourceRefs?.length ||
  msg.videoSegments?.length ||
  msg.resourceTask ||
  msg.reasoningSummary;

const isSafetyExpanded = (id: string | number) =>
  expandedSafetyIds.value.has(id);

const isMessageLiked = (id: string | number) => likedMessageIds.value.has(id);

const toggleSetItem = (
  target: typeof expandedSafetyIds,
  id: string | number
) => {
  const next = new Set(target.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  target.value = next;
};

const toggleSafetyDetails = (id: string | number) => {
  toggleSetItem(expandedSafetyIds, id);
};

const toggleLikedMessage = (id: string | number) => {
  toggleSetItem(likedMessageIds, id);
};

const formatMachineLabel = (value?: string) => {
  const raw = String(value || "").trim();
  if (!raw) return "暂无";
  if (machineLabelMap[raw]) return machineLabelMap[raw];
  return raw
    .split("_")
    .filter(Boolean)
    .map(part => wordLabelMap[part] || part)
    .join("");
};

const formatSourceType = (value?: string) => formatMachineLabel(value);

const formatStatusLabel = (value?: string) => formatMachineLabel(value);

const localizeInlineText = (value?: unknown) => {
  let text = String(value || "").trim();
  Object.entries(machineLabelMap).forEach(([key, label]) => {
    text = text.replace(new RegExp(`\\b${key}\\b`, "g"), label);
  });
  return text;
};

const formatResourceTaskText = (task: any) =>
  localizeInlineText(task?.summary || task?.stage || task?.task_id || "");

const getSafetyTone = (msg: any) => {
  if (msg.safetyStatus === "blocked") return "blocked";
  if (msg.safetyStatus === "degraded" || msg.safetyStatus === "warning") {
    return "warning";
  }
  return "checked";
};

const getSafetyLabel = (msg: any) =>
  formatStatusLabel(msg.safetyStatus) || "已检查";

const getFollowupLabel = (index: number) =>
  String.fromCharCode("A".charCodeAt(0) + index);

const formatMs = (value?: number) => {
  const totalSeconds = Math.max(0, Math.floor(Number(value || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = `${totalSeconds % 60}`.padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const buildCopyText = (msg: any) => {
  const content = formatMessageContent(msg.content);
  if (content) return content;
  if (Array.isArray(msg.followups) && msg.followups.length) {
    return msg.followups.map((item: any) => item.text).join("\n");
  }
  return "";
};

const copyTextToClipboard = async (text: string) => {
  if (!text) {
    ElMessage.warning("暂无可复制内容");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success("回答已复制");
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    ElMessage.success("回答已复制");
  }
};

const expandSafetyDetails = (id: string | number) => {
  if (expandedSafetyIds.value.has(id)) return;
  expandedSafetyIds.value = new Set([...expandedSafetyIds.value, id]);
};

const handleMoreCommand = (command: string | number | object, msg: any) => {
  const action = String(command);
  if (action === "copy") {
    void copyTextToClipboard(buildCopyText(msg));
    return;
  }
  if (action === "review") {
    expandSafetyDetails(msg.id);
    ElMessage.info("已展开安全审查结果");
    return;
  }
  if (action === "regenerate") {
    emit("regenerate", msg.id);
  }
};

const handleEnter = (event: KeyboardEvent) => {
  if (event.isComposing || event.shiftKey) return;
  event.preventDefault();
  handleSend();
};

const isNearLatestMessage = (scrollTop?: number) => {
  const wrap = scrollbarRef.value?.wrapRef;
  if (!wrap) return true;
  const currentScrollTop = scrollTop ?? wrap.scrollTop;
  return (
    wrap.scrollHeight - currentScrollTop - wrap.clientHeight <=
    autoFollowThreshold
  );
};

const handleChatScroll = ({ scrollTop }: { scrollTop: number }) => {
  shouldFollowLatestMessages.value = isNearLatestMessage(scrollTop);
};

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

const getScrollBehavior = (): ScrollBehavior =>
  prefersReducedMotion() ? "auto" : "smooth";

const syncAnswerAnchorSpacer = (id: MessageId) => {
  const key = messageKey(id);
  if (answerAnchorMessageId !== key) return;
  const wrap = scrollbarRef.value?.wrapRef;
  if (!wrap) return;
  const answer = assistantAnswerElements.get(key);
  const answerHeight = answer?.offsetHeight || 48;
  const viewportHeight = Math.min(wrap.clientHeight, window.innerHeight);
  answerAnchorSpacerHeight.value = Math.max(
    24,
    viewportHeight - answerHeight - 24
  );
};

const clearAnswerAnchor = () => {
  if (answerAnchorTimer) window.clearTimeout(answerAnchorTimer);
  if (streamingAnswerFollowFrame) {
    window.cancelAnimationFrame(streamingAnswerFollowFrame);
  }
  answerAnchorTimer = undefined;
  streamingAnswerFollowFrame = undefined;
  answerAnchorMessageId = "";
  answerAnchorSpacerHeight.value = 0;
  streamingAnswerFollowEnabled = true;
  streamingAnswerFollowReadyAt = 0;
};

const scrollAssistantAnswerToTop = (id: MessageId) => {
  const key = messageKey(id);
  if (answerAnchorMessageId !== key) return;
  const wrap = scrollbarRef.value?.wrapRef;
  const answer = assistantAnswerElements.get(key);
  if (!wrap || !answer) return;

  const wrapRect = wrap.getBoundingClientRect();
  const answerRect = answer.getBoundingClientRect();
  const targetTop = Math.max(
    0,
    wrap.scrollTop + answerRect.top - wrapRect.top - 12
  );
  wrap.scrollTo({ top: targetTop, behavior: getScrollBehavior() });
};

const followStreamingAnswer = (id: MessageId) => {
  const key = messageKey(id);
  if (
    answerAnchorMessageId !== key ||
    !streamingAnswerFollowEnabled ||
    Date.now() < streamingAnswerFollowReadyAt
  ) {
    return;
  }

  void nextTick(() => {
    if (answerAnchorMessageId !== key || !streamingAnswerFollowEnabled) {
      return;
    }
    syncAnswerAnchorSpacer(id);
    if (streamingAnswerFollowFrame) {
      window.cancelAnimationFrame(streamingAnswerFollowFrame);
    }
    streamingAnswerFollowFrame = window.requestAnimationFrame(() => {
      const wrap = scrollbarRef.value?.wrapRef;
      const answer = assistantAnswerElements.get(key);
      if (!wrap || !answer || answerAnchorMessageId !== key) return;

      const wrapRect = wrap.getBoundingClientRect();
      const answerRect = answer.getBoundingClientRect();
      const overflow = answerRect.bottom - (wrapRect.bottom - 36);
      if (overflow <= 0) return;

      const maxStep = Math.max(
        32,
        Math.min(wrap.clientHeight, window.innerHeight) * 0.18
      );
      const targetTop = Math.min(
        wrap.scrollHeight - wrap.clientHeight,
        wrap.scrollTop + Math.min(overflow, maxStep)
      );
      wrap.scrollTo({ top: targetTop, behavior: getScrollBehavior() });
    });
  });
};

const scheduleAssistantAnswerAnchor = (id: MessageId) => {
  if (answerAnchorTimer) window.clearTimeout(answerAnchorTimer);
  const collapseDelay = prefersReducedMotion() ? 0 : 280;
  streamingAnswerFollowReadyAt = Date.now() + collapseDelay + 360;
  answerAnchorTimer = window.setTimeout(() => {
    void nextTick(() => {
      syncAnswerAnchorSpacer(id);
      scrollAssistantAnswerToTop(id);
      answerAnchorTimer = window.setTimeout(
        () => followStreamingAnswer(id),
        prefersReducedMotion() ? 0 : 320
      );
    });
  }, collapseDelay);
};

const beginStreamingAnswer = (msg: any) => {
  const key = messageKey(msg.id);
  setProcessExpanded(msg.id, false);
  answerAnchorMessageId = key;
  streamingAnswerFollowEnabled = true;
  shouldFollowLatestMessages.value = true;

  const wrap = scrollbarRef.value?.wrapRef;
  const viewportHeight = Math.min(wrap?.clientHeight || 0, window.innerHeight);
  answerAnchorSpacerHeight.value = Math.max(24, viewportHeight - 72);
  void nextTick(() => syncAnswerAnchorSpacer(msg.id));
  scheduleAssistantAnswerAnchor(msg.id);
};

const pauseStreamingAnswerFollow = () => {
  if (!answerAnchorMessageId) return;
  streamingAnswerFollowEnabled = false;
};

const scrollToLatestMessage = () => {
  void nextTick(() => {
    const scrollbar = scrollbarRef.value;
    const wrap = scrollbar?.wrapRef;
    if (!shouldFollowLatestMessages.value || !scrollbar || !wrap) return;
    scrollbar.setScrollTop(wrap.scrollHeight);
  });
};

const handleSend = () => {
  const text = input.value.trim();
  if (!text || props.loading) return;
  if (props.modelReady === false) {
    ElMessage.warning(props.modelDisabledReason || "当前没有可用模型");
    return;
  }
  shouldFollowLatestMessages.value = true;
  emit("send", {
    text,
    files: pendingAttachments.value.map(item => item.file)
  });
  input.value = "";
  pendingAttachments.value = [];
};

watch(
  () => props.messages,
  (messages, previousMessages) => {
    if (messages !== previousMessages) {
      pendingAssistantMessageIds.clear();
      streamingBodyStartedIds.clear();
      messageContentLengths.clear();
      processExpandedById.value = {};
      clearAnswerAnchor();
      shouldFollowLatestMessages.value = true;
    }

    const activeMessageIds = new Set(
      messages.map(message => messageKey(message.id))
    );
    let startedAnswer: any;
    let updatedAnswer: any;

    messages.forEach(msg => {
      const key = messageKey(msg.id);
      const contentLength = String(msg.content || "").trim().length;
      const previousLength = messageContentLengths.get(key);

      if (msg.type === "system" && msg.streaming && contentLength === 0) {
        if (!pendingAssistantMessageIds.has(key)) {
          if (answerAnchorMessageId && answerAnchorMessageId !== key) {
            clearAnswerAnchor();
          }
          shouldFollowLatestMessages.value = true;
          pendingAssistantMessageIds.add(key);
        }
      }

      const answerJustStarted =
        msg.type === "system" &&
        contentLength > 0 &&
        !streamingBodyStartedIds.has(key) &&
        (pendingAssistantMessageIds.has(key) || msg.streaming);

      if (answerJustStarted) {
        pendingAssistantMessageIds.delete(key);
        streamingBodyStartedIds.add(key);
        startedAnswer = msg;
      }

      if (
        streamingBodyStartedIds.has(key) &&
        previousLength !== undefined &&
        contentLength !== previousLength
      ) {
        updatedAnswer = msg;
      }

      messageContentLengths.set(key, contentLength);
    });

    [...pendingAssistantMessageIds].forEach(key => {
      if (!activeMessageIds.has(key)) pendingAssistantMessageIds.delete(key);
    });
    [...streamingBodyStartedIds].forEach(key => {
      if (!activeMessageIds.has(key)) streamingBodyStartedIds.delete(key);
    });
    [...messageContentLengths.keys()].forEach(key => {
      if (!activeMessageIds.has(key)) messageContentLengths.delete(key);
    });

    const anchoredMessage = answerAnchorMessageId
      ? messages.find(
          message => messageKey(message.id) === answerAnchorMessageId
        )
      : undefined;
    if (
      answerAnchorMessageId &&
      (!anchoredMessage || !anchoredMessage.streaming)
    ) {
      clearAnswerAnchor();
      scrollToLatestMessage();
      return;
    }

    if (startedAnswer) {
      beginStreamingAnswer(startedAnswer);
      return;
    }
    if (
      updatedAnswer &&
      answerAnchorMessageId === messageKey(updatedAnswer.id)
    ) {
      void nextTick(() => syncAnswerAnchorSpacer(updatedAnswer.id));
      followStreamingAnswer(updatedAnswer.id);
      return;
    }
    if (!answerAnchorMessageId) scrollToLatestMessage();
  },
  { deep: true, flush: "post" }
);

watch(
  () => props.loading,
  loading => {
    if (!loading) {
      if (answerAnchorMessageId) {
        clearAnswerAnchor();
        scrollToLatestMessage();
      }
      return;
    }
    thinkingStepIndex.value = 0;
  }
);

onMounted(() => {
  scrollToLatestMessage();
  void nextTick(() => {
    const wrap = scrollbarRef.value?.wrapRef;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    viewportResizeObserver = new ResizeObserver(() => {
      if (!answerAnchorMessageId) return;
      syncAnswerAnchorSpacer(answerAnchorMessageId);
    });
    viewportResizeObserver.observe(wrap);
  });
  thinkingTimer = window.setInterval(() => {
    if (props.loading) {
      thinkingStepIndex.value =
        (thinkingStepIndex.value + 1) % thinkingTexts.length;
    }
  }, 1800);
});

onBeforeUnmount(() => {
  if (thinkingTimer) window.clearInterval(thinkingTimer);
  if (answerAnchorTimer) window.clearTimeout(answerAnchorTimer);
  if (streamingAnswerFollowFrame) {
    window.cancelAnimationFrame(streamingAnswerFollowFrame);
  }
  viewportResizeObserver?.disconnect();
});
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

.chat-toolbar-left {
  flex: 1 1 auto;
  gap: 8px;
  overflow: hidden;
}

.chat-toolbar-chip {
  display: inline-flex;
  flex: 1 1 112px;
  align-items: center;
  justify-content: center;
  min-width: 0;
  max-width: 240px;
  height: 34px;
  padding: 0 14px;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  color: #4d5b70;
  white-space: nowrap;
  cursor: pointer;
  background: #f3f5f8;
  border: 1px solid transparent;
  border-radius: 17px;
  box-shadow: none;
  transition:
    color 0.18s ease,
    background 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.chat-toolbar-chip--active {
  flex: 1 1 126px;
  color: #2f80ed;
  background: #eef6ff;
}

.chat-toolbar-chip--static {
  flex: 1 1 112px;
  cursor: default;
}

.chat-toolbar-chip--interactive {
  flex: 1 1 132px;
  min-width: 0;
  background: transparent;
}

.chat-toolbar-chip--active:hover,
.chat-toolbar-chip--interactive:hover {
  color: #2f80ed;
  background: #eef6ff;
}

.chat-toolbar-chip__icon,
.chat-toolbar-chip__arrow {
  flex: 0 0 auto;
}

.chat-toolbar-chip__icon {
  font-size: 17px;
}

.chat-toolbar-chip__arrow {
  font-size: 13px;
}

.chat-toolbar-chip__text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ai-chat-model-trigger {
  flex: 0 1 190px;
  max-width: 190px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-attachment-input {
  display: none;
}

.chat-attachment-shelf {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 10px 10px;
}

.chat-attachment-pill {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  max-width: min(100%, 320px);
  height: 32px;
  padding: 0 7px 0 10px;
  color: #4f5c6f;
  background: #f6f8fb;
  border: 1px solid #e3e9f2;
  border-radius: 10px;
}

.chat-attachment-pill__icon {
  flex: 0 0 auto;
  margin-right: 6px;
  color: #5b74a8;
}

.chat-attachment-pill__name {
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-attachment-pill__meta {
  flex: 0 0 auto;
  margin-left: 7px;
  font-size: 11px;
  font-weight: 700;
  color: #7b8797;
}

.chat-attachment-pill__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  margin-left: 6px;
  color: #8c96a8;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 999px;
}

.chat-attachment-pill__remove:hover {
  color: #b42318;
  background: #fff1f0;
}

.model-option {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  max-width: 260px;
  gap: 8px;
  line-height: 1;
}

.model-option__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-option__status {
  flex: 0 0 auto;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  color: #7a4c00;
  background: #fff4d6;
  border-radius: 999px;
}

.model-option__status.is-deprecated {
  color: #5d6678;
  background: #eef2f7;
}

.model-option__status.is-unavailable,
.model-option__status.is-degraded {
  color: #9f2f2f;
  background: #ffe8e8;
}

:global(.ai-chat-toolbar-dropdown.el-popper) {
  overflow: visible;
  background: #fff;
  border: 1px solid rgba(216, 225, 240, 0.95);
  border-radius: 16px;
  box-shadow: 0 16px 38px rgba(48, 64, 93, 0.14);
}

:global(.ai-chat-toolbar-dropdown .el-dropdown-menu) {
  min-width: 180px;
  padding: 6px;
  background: #fff;
  border-radius: 16px;
  box-shadow: none;
}

:global(.ai-chat-toolbar-dropdown .el-dropdown-menu__item) {
  height: 38px;
  padding: 0 13px;
  font-size: 14px;
  font-weight: 500;
  line-height: 38px;
  color: #4f5c6f;
  border-radius: 12px;
  transition:
    color 0.18s ease,
    background 0.18s ease;
}

:global(
  .ai-chat-toolbar-dropdown .el-dropdown-menu__item:not(.is-disabled):hover
),
:global(
  .ai-chat-toolbar-dropdown .el-dropdown-menu__item:not(.is-disabled):focus
) {
  color: #2f80ed;
  background: #eef6ff;
}

:global(.ai-chat-toolbar-dropdown .el-popper__arrow::before) {
  background: #fff;
  border-color: rgba(216, 225, 240, 0.95);
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
  min-width: 0;
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
  min-width: 0;
  max-width: min(84%, 980px);
  gap: 10px;
}

.message-stack.is-user {
  align-items: flex-end;
  max-width: min(68%, 640px);
}

.message-bubble {
  position: relative;
  min-width: 0;
  max-width: 100%;
  padding: 16px 18px;
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
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(217, 225, 240, 0.95);
  border-radius: 22px;
  box-shadow: 0 10px 28px rgba(44, 58, 87, 0.08);
}

.message-bubble.is-pending {
  width: auto;
  min-width: 250px;
  padding: 14px 16px;
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
  min-width: 0;
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.markdown-content {
  color: #253044;
  line-height: 1.78;
  white-space: normal;
}

.markdown-content :deep(*) {
  max-width: 100%;
}

.markdown-content :deep(p) {
  margin: 0 0 14px;
}

.markdown-content :deep(p:last-child),
.markdown-content :deep(ul:last-child),
.markdown-content :deep(ol:last-child),
.markdown-content :deep(blockquote:last-child),
.markdown-content :deep(pre:last-child),
.markdown-content :deep(table:last-child) {
  margin-bottom: 0;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4) {
  margin: 18px 0 10px;
  color: #1f2a3d;
  font-weight: 750;
  line-height: 1.38;
  text-wrap: pretty;
}

.markdown-content :deep(h1:first-child),
.markdown-content :deep(h2:first-child),
.markdown-content :deep(h3:first-child),
.markdown-content :deep(h4:first-child) {
  margin-top: 0;
}

.markdown-content :deep(h1) {
  font-size: 20px;
}

.markdown-content :deep(h2) {
  font-size: 18px;
}

.markdown-content :deep(h3) {
  font-size: 16px;
}

.markdown-content :deep(h4) {
  font-size: 15px;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  display: grid;
  gap: 7px;
  padding-left: 1.35em;
  margin: 0 0 14px;
}

.markdown-content :deep(li) {
  padding-left: 2px;
}

.markdown-content :deep(li > p) {
  margin: 0;
}

.markdown-content :deep(strong) {
  color: #1f2a3d;
  font-weight: 750;
}

.markdown-content :deep(a) {
  color: #2f6fcb;
  font-weight: 650;
  text-decoration: none;
  border-bottom: 1px solid rgba(47, 111, 203, 0.25);
}

.markdown-content :deep(a:hover) {
  color: #1f5db4;
  border-bottom-color: rgba(31, 93, 180, 0.55);
}

.markdown-content :deep(code) {
  padding: 2px 5px;
  color: #26405f;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 0.92em;
  background: #f3f6fb;
  border: 1px solid rgba(210, 219, 235, 0.88);
  border-radius: 6px;
}

.markdown-content :deep(pre) {
  max-width: 100%;
  padding: 13px 14px;
  margin: 12px 0 14px;
  overflow-x: auto;
  color: #24324a;
  background: #f7f9fc;
  border: 1px solid rgba(213, 222, 238, 0.92);
  border-radius: 12px;
}

.markdown-content :deep(pre code) {
  display: block;
  min-width: max-content;
  padding: 0;
  color: inherit;
  white-space: pre;
  background: transparent;
  border: 0;
  border-radius: 0;
}

.markdown-content :deep(blockquote) {
  margin: 12px 0 14px;
  padding: 10px 13px;
  color: #4d5d75;
  background: #f7faff;
  border: 1px solid rgba(190, 207, 238, 0.74);
  border-radius: 12px;
}

.markdown-content :deep(table) {
  display: block;
  width: 100%;
  margin: 12px 0 14px;
  overflow-x: auto;
  border-collapse: collapse;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  padding: 8px 10px;
  white-space: nowrap;
  border: 1px solid #e1e7f0;
}

.markdown-content :deep(th) {
  color: #253044;
  font-weight: 750;
  background: #f3f6fb;
}

.markdown-content :deep(hr) {
  height: 1px;
  margin: 18px 0;
  background: #e3e9f2;
  border: 0;
}

.assistant-resource-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  width: 100%;
}

.explanation-image-list {
  display: grid;
  gap: 10px;
  width: 100%;
}

.assistant-action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  padding: 2px 2px 0;
}

.assistant-action-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  color: #62718a;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(210, 219, 237, 0.9);
  border-radius: 999px;
  box-shadow: 0 5px 12px rgba(56, 74, 105, 0.05);
  transition:
    color 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.assistant-action-button:hover,
.assistant-action-button.is-active {
  color: #3d6df2;
  background: #f5f8ff;
  border-color: rgba(100, 139, 246, 0.45);
  box-shadow: 0 8px 18px rgba(78, 112, 204, 0.12);
}

.assistant-action-button:active {
  transform: translateY(1px);
}

.assistant-action-svg,
.assistant-menu-svg {
  flex: 0 0 auto;
  width: 17px;
  height: 17px;
}

.assistant-menu-svg {
  margin-right: 5px;
}

.safety-detail-panel {
  width: 100%;
  padding: 13px 14px;
  background: #fff;
  border: 1px solid rgba(219, 226, 240, 0.92);
  border-radius: 16px;
  box-shadow: 0 8px 22px rgba(42, 59, 92, 0.05);
}

.safety-detail-panel.is-blocked {
  color: #b4232a;
  background: #fff7f7;
  border-color: rgba(248, 147, 152, 0.48);
}

.safety-detail-panel.is-warning {
  color: #9a5f00;
  background: #fff9eb;
  border-color: rgba(245, 184, 82, 0.5);
}

.safety-detail-panel.is-checked {
  color: #46638f;
  background: #f7faff;
  border-color: rgba(149, 176, 244, 0.44);
}

.safety-detail-header,
.source-ref-meta,
.video-segment-title {
  display: flex;
  gap: 8px;
  align-items: center;
}

.safety-detail-header {
  justify-content: space-between;
  font-size: 13px;
  font-weight: 700;
}

.safety-count {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.72;
}

.safety-summary {
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.65;
}

.safety-flag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.safety-flag {
  padding: 3px 8px;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid currentcolor;
  border-radius: 7px;
}

.stream-progress {
  width: 100%;
  color: #56647b;
  border-bottom: 1px solid rgba(222, 229, 241, 0.8);
}

.assistant-answer-anchor-space {
  width: 1px;
  min-height: 0;
  pointer-events: none;
}

.speech-control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 34px;
  padding: 5px 8px 5px 10px;
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.speech-control__status,
.speech-control__button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.speech-control__status {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.speech-control__dot {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  background: #3b82f6;
  border-radius: 50%;
}

.speech-control.is-playing .speech-control__dot,
.speech-control.is-streaming .speech-control__dot {
  background: #16a34a;
}

.speech-control.is-failed .speech-control__dot,
.speech-control.is-unavailable .speech-control__dot {
  background: #94a3b8;
}

.speech-control__button {
  flex: 0 0 auto;
  min-height: 26px;
  padding: 3px 8px;
  color: #1d4ed8;
  cursor: pointer;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 7px;
}

.speech-control__button:hover {
  background: #dbeafe;
}

.stream-progress.is-error {
  color: #a94442;
}

.stream-progress.is-partial {
  color: #8a6416;
}

.stream-progress__meta {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.stream-progress__header {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 42px;
  padding: 7px 2px;
  font-size: 12px;
  font-weight: 800;
  color: #738097;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 8px;
  transition:
    color 0.18s ease-out,
    background 0.18s ease-out;
}

.stream-progress__header:hover {
  color: #52627c;
  background: rgba(244, 247, 252, 0.72);
}

.stream-progress__header:focus-visible {
  outline: 2px solid rgba(47, 111, 214, 0.72);
  outline-offset: 2px;
}

.stream-progress__heading {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.stream-progress__heading > span:last-child {
  color: #4c5b72;
  font-size: 13px;
  font-weight: 750;
}

.stream-progress__header-meta {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 8px;
  align-items: center;
}

.stream-progress__header-meta > span,
.stream-progress__meta > span {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 600;
  color: #8996aa;
}

.stream-progress__chevron {
  color: #8996aa;
  transition: transform 0.2s ease-out;
}

.stream-progress.is-expanded .stream-progress__chevron {
  transform: rotate(180deg);
}

.stream-progress__body {
  padding: 1px 2px 12px;
  overflow: hidden;
}

.stream-progress__pending {
  padding: 4px 0 8px;
}

.process-collapse-enter-active,
.process-collapse-leave-active {
  max-height: 960px;
  overflow: hidden;
  transition:
    max-height 0.22s ease-out,
    opacity 0.18s ease-out,
    transform 0.22s ease-out;
}

.process-collapse-enter-from,
.process-collapse-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-4px);
}

.stream-progress__timeline {
  display: grid;
  gap: 10px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.stream-progress__timeline li {
  position: relative;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  gap: 10px;
  min-width: 0;
}

.stream-progress__timeline li:not(:last-child)::after {
  position: absolute;
  top: 30px;
  left: 14px;
  width: 1px;
  height: calc(100% - 20px);
  content: "";
  background: #dce4ef;
}

.stream-progress__icon {
  position: relative;
  z-index: 1;
}

.stream-progress__content {
  min-width: 0;
  padding: 3px 0 8px;
}

.stream-progress__meta strong {
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  color: #43516a;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stream-progress__content p,
.stream-progress__notice {
  margin: 2px 0 0;
  font-size: 13px;
  line-height: 1.55;
}

.stream-progress__notice {
  padding-top: 8px;
}

.stream-progress__retry {
  margin-top: 8px;
  padding: 0;
  color: #2f6fd6;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.stream-progress__retry:hover {
  color: #1f55a8;
  text-decoration: underline;
}

.assistant-detail-stack {
  display: grid;
  gap: 8px;
  padding: 2px 0;
}

.assistant-detail-panel {
  padding: 9px 0;
  color: #56647b;
  background: transparent;
}

.assistant-detail-panel + .assistant-detail-panel:not(.is-task) {
  border-top: 1px solid rgba(222, 229, 241, 0.8);
}

.assistant-detail-panel.is-task {
  padding: 10px 12px;
  color: #4d6fd6;
  background: rgba(244, 247, 255, 0.72);
  border: 1px solid rgba(129, 158, 245, 0.26);
  border-radius: 12px;
}

.resource-task-progress {
  margin-top: 10px;
}

.task-error-copy {
  color: #b54747;
}

.reasoning-summary summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 32px;
  list-style: none;
  cursor: pointer;
  color: #52627c;
  font-size: 13px;
  font-weight: 700;
}

.reasoning-summary summary::-webkit-details-marker {
  display: none;
}

.reasoning-summary__label {
  display: inline-flex;
  gap: 9px;
  align-items: center;
}

.reasoning-summary__chevron {
  flex: 0 0 auto;
  color: #7f8da2;
  transition: transform 0.18s ease-out;
}

.reasoning-summary[open] .reasoning-summary__chevron {
  transform: rotate(180deg);
}

.assistant-detail-title {
  margin-bottom: 9px;
  font-size: 12px;
  font-weight: 800;
  color: #738097;
}

.assistant-detail-title--icon {
  display: flex;
  gap: 9px;
  align-items: center;
  min-height: 28px;
  margin-bottom: 10px;
  color: #4c5b72;
  font-size: 13px;
  font-weight: 750;
}

.source-ref-list {
  display: grid;
  gap: 0;
}

.source-ref-item {
  padding: 10px 0;
  font-size: 13px;
  line-height: 1.55;
  border-top: 1px solid rgba(222, 229, 241, 0.8);
}

.source-ref-item:first-child {
  padding-top: 0;
  border-top: 0;
}

.source-ref-type {
  flex: 0 0 auto;
  padding: 3px 8px;
  font-size: 12px;
  font-weight: 700;
  color: #4d6ff0;
  background: rgba(240, 245, 255, 0.9);
  border: 1px solid rgba(122, 153, 244, 0.26);
  border-radius: 7px;
}

.source-ref-meta {
  flex-wrap: wrap;
}

.source-ref-meta strong {
  min-width: 0;
  color: #2d374c;
  overflow-wrap: anywhere;
}

.source-ref-meta span:last-child {
  color: #9aa6b8;
}

.source-ref-item p,
.assistant-detail-panel p,
.video-segment-card p {
  margin-top: 6px;
}

.video-segment-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.video-segment-card {
  width: 100%;
  padding: 11px;
  font-size: 12px;
  font-family: inherit;
  line-height: 1.55;
  color: #3561b7;
  text-align: left;
  cursor: pointer;
  background: #f4f8ff;
  border: 1px solid rgba(143, 174, 244, 0.34);
  border-radius: 12px;
  transition:
    color 180ms ease,
    background-color 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;
}

.video-segment-card:hover {
  color: #2755ad;
  background: #fff;
  border-color: rgba(91, 131, 217, 0.58);
  box-shadow: 0 6px 16px rgba(52, 91, 164, 0.1);
  transform: translateY(-1px);
}

.video-segment-card:active {
  transform: translateY(0);
}

.video-segment-card:focus-visible {
  outline: 2px solid rgba(64, 116, 211, 0.72);
  outline-offset: 2px;
}

.video-segment-card:disabled {
  cursor: wait;
  opacity: 0.72;
  transform: none;
}

.video-segment-title {
  font-weight: 800;
}

.video-segment-title span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.video-segment-time {
  margin-top: 8px;
  color: #5b83d9;
}

.followup-panel {
  width: 100%;
  padding: 10px 2px 0;
  background: transparent;
}

.followup-title {
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 800;
  color: #738097;
}

.followup-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.followup-grid.is-single {
  grid-template-columns: minmax(0, 1fr);
}

.followup-card {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  min-height: 92px;
  padding: 16px;
  text-align: left;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.64);
  border: 1px solid rgba(188, 204, 236, 0.78);
  border-radius: 18px;
  box-shadow: 0 8px 18px rgba(48, 69, 105, 0.045);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease,
    background 0.2s ease;
}

.followup-card:hover {
  background: rgba(255, 255, 255, 0.92);
  border-color: rgba(100, 139, 246, 0.5);
  box-shadow: 0 12px 28px rgba(66, 91, 140, 0.12);
  transform: translateY(-1px);
}

.followup-grid.is-single .followup-card {
  align-items: center;
  min-height: 88px;
  padding: 18px 20px;
}

.followup-index {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  font-size: 13px;
  font-weight: 900;
  color: #416ef0;
  background: #eef3ff;
  border-radius: 9px;
}

.followup-text {
  color: #2e3850;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.5;
}

.followup-action {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  padding: 8px 14px;
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
  background: #2f66f4;
  border-radius: 999px;
  box-shadow: 0 8px 18px rgba(47, 102, 244, 0.22);
}

.thinking-status {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 14px;
  min-width: 230px;
  max-width: 100%;
}

.thinking-process-icon {
  animation: process-icon-pulse 1.8s ease-in-out infinite;
}

.thinking-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.thinking-eyebrow {
  font-size: 11px;
  font-weight: 700;
  color: #8b98ad;
}

.thinking-typewriter {
  display: inline-block;
  width: var(--thinking-width);
  max-width: min(44vw, 420px);
  overflow: hidden;
  color: #26334d;
  font-size: 14px;
  font-weight: 800;
  white-space: nowrap;
  border-right: 2px solid rgba(94, 127, 248, 0.8);
  animation:
    thinking-type 1.15s steps(var(--thinking-chars)) both,
    caret-blink 0.72s step-end infinite;
}

.thinking-dots {
  display: inline-flex;
  gap: 4px;
  margin-left: auto;
}

.thinking-dots span {
  width: 4px;
  height: 4px;
  background: #98a6bc;
  border-radius: 999px;
  animation: dot-fade 1.2s ease-in-out infinite;
}

.thinking-dots span:nth-child(2) {
  animation-delay: 0.16s;
}

.thinking-dots span:nth-child(3) {
  animation-delay: 0.32s;
}

.fade-detail-enter-active,
.fade-detail-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.fade-detail-enter-from,
.fade-detail-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@keyframes thinking-type {
  from {
    width: 0;
  }
}

@keyframes caret-blink {
  50% {
    border-color: transparent;
  }
}

@keyframes dot-fade {
  0%,
  80%,
  100% {
    opacity: 0.35;
  }

  40% {
    opacity: 1;
  }
}

@keyframes process-icon-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgb(47 104 178 / 0%);
  }

  50% {
    box-shadow: 0 0 0 4px rgb(47 104 178 / 10%);
  }
}

:global(html.dark) .stream-progress,
:global(html.dark) .assistant-detail-panel {
  color: var(--ai-app-text-regular, #cbd6e8);
  border-color: var(--ai-app-border, rgb(148 163 184 / 24%));
}

:global(html.dark) .stream-progress__heading > span:last-child,
:global(html.dark) .stream-progress__meta strong,
:global(html.dark) .assistant-detail-title--icon,
:global(html.dark) .reasoning-summary summary,
:global(html.dark) .source-ref-meta strong,
:global(html.dark) .thinking-typewriter {
  color: var(--ai-app-text, #eef4ff);
}

:global(html.dark) .stream-progress__header-meta > span,
:global(html.dark) .stream-progress__meta > span,
:global(html.dark) .thinking-eyebrow,
:global(html.dark) .reasoning-summary__chevron,
:global(html.dark) .stream-progress__chevron {
  color: var(--ai-app-text-muted, #92a0b8);
}

:global(html.dark) .stream-progress__header:hover {
  background: rgb(31 47 72 / 42%);
}

:global(html.dark) .stream-progress__timeline li:not(:last-child)::after {
  background: var(--ai-app-border-strong, rgb(148 163 184 / 38%));
}

:global(html.dark) .assistant-detail-panel.is-task {
  color: var(--ai-app-text-regular, #cbd6e8);
  background: rgb(38 61 96 / 42%);
  border-color: rgb(142 175 255 / 28%);
}

@media (max-width: 900px) {
  .assistant-resource-grid,
  .video-segment-grid,
  .followup-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .ai-chat-module {
    background: #f5f7fb;
  }

  .ai-chat-course-head {
    display: none;
  }

  .ai-chat-message-scroll {
    padding: 12px 10px 16px !important;
  }

  .ai-chat-message-scroll :deep(.el-scrollbar__view) {
    min-height: 100%;
    padding-bottom: 8px;
  }

  .ai-chat-composer-shell {
    flex: 0 0 auto;
    padding: 8px !important;
    background: #fff;
    border-top: 1px solid #e5eaf1;
  }

  .ai-chat-composer {
    border-color: #dce3ed;
    border-radius: 18px !important;
    box-shadow: 0 10px 28px rgb(41 62 91 / 10%);
  }

  .ai-chat-composer__input-row {
    gap: 6px;
    min-height: 58px;
    padding: 7px;
  }

  .ai-chat-composer__input-row :deep(.el-button) {
    flex: 0 0 44px;
    width: 44px;
    height: 44px;
    padding: 0;
    margin-bottom: 0 !important;
  }

  :deep(.ai-input-base .el-textarea__inner) {
    min-height: 44px !important;
    padding: 11px 8px;
    font-size: 15px;
    line-height: 22px;
  }

  .ai-chat-toolbar {
    flex-wrap: nowrap !important;
    justify-content: flex-start !important;
    gap: 6px !important;
    padding: 6px 8px 8px !important;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    background: #fff !important;
    scrollbar-width: none;
  }

  .ai-chat-toolbar::-webkit-scrollbar {
    display: none;
  }

  .chat-toolbar-left {
    flex: 0 0 auto;
    flex-wrap: nowrap !important;
    overflow: visible;
  }

  .chat-toolbar-chip,
  .chat-attachment-pill,
  .assistant-action-button,
  .speech-control__button,
  .reasoning-summary summary {
    height: auto;
    min-height: 44px;
  }

  .chat-toolbar-chip {
    flex: 0 0 auto;
    max-width: min(190px, 62vw);
    padding-inline: 12px;
  }

  .chat-toolbar-chip--static {
    display: none;
  }

  .ai-chat-model-trigger {
    flex: 0 0 auto;
    max-width: min(150px, 46vw);
    min-height: 44px;
  }

  .chat-message-row {
    gap: 8px;
  }

  .message-avatar {
    width: 36px !important;
    height: 36px !important;
  }

  .message-stack,
  .message-stack.is-user {
    max-width: calc(100% - 44px);
  }

  .message-bubble {
    padding: 12px 14px;
    font-size: 14px;
    line-height: 1.65;
  }

  .message-bubble-system {
    border-radius: 16px;
    box-shadow: 0 6px 18px rgb(44 58 87 / 7%);
  }

  .message-bubble-user {
    min-height: 40px;
    border-radius: 16px 6px 16px 16px;
    line-height: 1.4;
  }

  .chat-attachment-pill__remove {
    width: 44px;
    height: 44px;
    margin-right: -7px;
    margin-left: 2px;
  }

  .thinking-status {
    gap: 10px;
    min-width: 0;
  }

  .thinking-typewriter {
    max-width: 52vw;
  }

  .stream-progress__meta {
    align-items: flex-start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .thinking-process-icon,
  .thinking-typewriter,
  .thinking-dots span,
  .reasoning-summary__chevron,
  .stream-progress__chevron,
  .video-segment-card,
  .process-collapse-enter-active,
  .process-collapse-leave-active {
    animation: none;
    transition: none;
  }

  .video-segment-card:hover {
    transform: none;
  }

  .thinking-typewriter {
    width: auto;
    border-right: 0;
  }
}

/* 消息列表过渡动画 */
.chat-list-enter-active,
.chat-list-leave-active {
  transition:
    opacity 0.2s ease-out,
    transform 0.22s ease-out;
}
.chat-list-enter-from,
.chat-list-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* 资源卡片交错出现动画 */
.stagger-list-enter-active,
.stagger-list-leave-active {
  transition:
    opacity 0.2s ease-out,
    transform 0.22s ease-out;
}
.stagger-list-enter-from,
.stagger-list-leave-to {
  opacity: 0;
  transform: translateY(10px);
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

<style lang="scss">
.ai-chat-toolbar-dropdown.el-popper {
  overflow: visible !important;
  background: #fff !important;
  border: 1px solid rgba(216, 225, 240, 0.95) !important;
  border-radius: 16px !important;
  box-shadow: 0 16px 38px rgba(48, 64, 93, 0.14) !important;
}

.ai-chat-toolbar-dropdown .el-dropdown-menu {
  min-width: 180px !important;
  padding: 6px !important;
  overflow: hidden;
  background: #fff !important;
  border-radius: 16px !important;
  box-shadow: none !important;
}

.ai-chat-toolbar-dropdown .el-dropdown-menu__item {
  height: 38px !important;
  padding: 0 13px !important;
  margin: 1px 0;
  font-size: 14px !important;
  font-weight: 500 !important;
  line-height: 38px !important;
  color: #4f5c6f !important;
  border-radius: 12px !important;
  transition:
    color 0.18s ease,
    background 0.18s ease;
}

.ai-chat-toolbar-dropdown .el-dropdown-menu__item:not(.is-disabled):hover,
.ai-chat-toolbar-dropdown .el-dropdown-menu__item:not(.is-disabled):focus {
  color: #2f80ed !important;
  background: #eef6ff !important;
}

.ai-chat-toolbar-dropdown .el-popper__arrow::before {
  background: #fff !important;
  border-color: rgba(216, 225, 240, 0.95) !important;
}
</style>
