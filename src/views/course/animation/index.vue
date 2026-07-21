<template>
  <div
    :class="[
      'ai-animation-container m-3 flex gap-3 font-sans',
      isMobile ? 'is-mobile-layout' : 'h-[calc(100vh-140px)] overflow-hidden'
    ]"
  >
    <!-- 左侧课程选择 -->
    <div
      class="sidebar-card w-80 bg-[var(--el-bg-color-overlay)] rounded-2xl shadow-sm border border-[var(--el-border-color-light)] flex flex-col shrink-0 overflow-hidden transition-all duration-300 hover:shadow-lg"
    >
      <div
        class="header-section p-6 border-b border-[var(--el-border-color-light)] bg-[var(--el-fill-color-light)]/30"
      >
        <h3 class="font-bold flex items-center text-xl !mb-0">
          <div
            class="icon-box w-12 h-12 bg-gradient-to-br from-[var(--el-color-primary)] to-[var(--el-color-primary-dark-2)] rounded-xl mr-3 shadow-lg flex items-center justify-center transition-transform duration-300"
          >
            <img
              :src="htmlIconSvg"
              class="w-7 h-7 brightness-0 invert"
              alt="智能动画中心"
            />
          </div>
          智能动画中心
        </h3>
        <p
          class="header-subtitle text-sm text-[var(--el-text-color-placeholder)] ml-[60px]"
        >
          AI 辅助生成教学动画与演示
        </p>
      </div>

      <div class="p-6 space-y-6 flex-1 overflow-auto custom-scrollbar">
        <div class="space-y-3">
          <label
            class="text-base font-semibold text-[var(--el-text-color-secondary)] flex items-center"
          >
            <el-icon class="mr-2 text-[var(--el-color-primary)]"
              ><Reading
            /></el-icon>
            目标课程
          </label>
          <el-select
            v-model="selectedCourseId"
            filterable
            remote
            clearable
            placeholder="搜索或选择课程..."
            :remote-method="searchCourses"
            :loading="courseLoading"
            class="w-full !rounded-xl"
            size="large"
            @change="handleCourseChange"
          >
            <el-option
              v-for="c in courseOptions"
              :key="c.courseId"
              :label="c.title"
              :value="c.courseId"
            />
          </el-select>
        </div>

        <div class="space-y-3">
          <label
            class="text-base font-semibold text-[var(--el-text-color-secondary)] flex items-center"
          >
            <el-icon class="mr-2 text-[var(--el-color-primary)]"
              ><Management
            /></el-icon>
            对应章节
          </label>
          <el-select
            v-model="selectedChapterId"
            :disabled="!selectedCourseId"
            placeholder="请选择课程内的章节..."
            clearable
            filterable
            class="w-full !rounded-xl"
            size="large"
            @change="handleChapterChange"
          >
            <el-option
              v-for="ch in chapterOptions"
              :key="ch.chapterId"
              :label="ch.name"
              :value="ch.chapterId"
            />
          </el-select>
        </div>

        <div class="space-y-3">
          <label
            class="text-base font-semibold text-[var(--el-text-color-secondary)] flex items-center"
          >
            <el-icon class="mr-2 text-[var(--el-color-primary)]">
              <Film />
            </el-icon>
            生成范围
          </label>
          <el-radio-group
            v-model="selectedScopeType"
            class="scope-segmented"
            size="large"
            @change="handleScopeChange"
          >
            <el-radio-button value="chapter">整章</el-radio-button>
            <el-radio-button value="hour">单课时</el-radio-button>
          </el-radio-group>
        </div>

        <div v-if="selectedScopeType === 'hour'" class="space-y-3">
          <label
            class="text-base font-semibold text-[var(--el-text-color-secondary)] flex items-center"
          >
            <el-icon class="mr-2 text-[var(--el-color-primary)]">
              <VideoPlay />
            </el-icon>
            对应课时
          </label>
          <el-select
            v-model="selectedHourId"
            :disabled="!selectedChapterId"
            placeholder="请选择章节内的课时..."
            clearable
            filterable
            class="w-full !rounded-xl"
            size="large"
            @change="handleHourChange"
          >
            <el-option
              v-for="hour in hourOptions"
              :key="hour.hourId"
              :label="hour.title"
              :value="hour.hourId"
            />
          </el-select>
        </div>

        <!-- 任务统计看板 -->
        <div class="mt-8">
          <div class="flex items-center justify-between mb-4">
            <span
              class="text-base font-semibold text-[var(--el-text-color-primary)]"
              >任务看板</span
            >
            <el-icon
              class="text-[var(--el-text-color-placeholder)] transition-transform duration-300 hover:rotate-180 cursor-pointer"
              ><DataAnalysis
            /></el-icon>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div
              class="stat-card bg-[var(--el-color-primary-light-9)] rounded-2xl p-4 text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-md cursor-default"
            >
              <div
                class="text-2xl font-black text-[var(--el-color-success)] leading-none mb-2"
              >
                {{ stats.completed }}
              </div>
              <div
                class="text-xs font-medium text-[var(--el-text-color-secondary)] tracking-wider"
              >
                已完成
              </div>
            </div>
            <div
              class="stat-card bg-[var(--el-color-primary-light-9)] rounded-2xl p-4 text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-md cursor-default"
            >
              <div
                class="text-2xl font-black text-[var(--el-color-warning)] leading-none mb-2"
              >
                {{ stats.processing }}
              </div>
              <div
                class="text-xs font-medium text-[var(--el-text-color-secondary)] tracking-wider"
              >
                处理中
              </div>
            </div>
            <div
              class="stat-card bg-[var(--el-color-primary-light-9)] rounded-2xl p-4 text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-md cursor-default"
            >
              <div
                class="text-2xl font-black text-[var(--el-color-danger)] leading-none mb-2"
              >
                {{ stats.failed }}
              </div>
              <div
                class="text-xs font-medium text-[var(--el-text-color-secondary)] tracking-wider"
              >
                失败
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧内容区域 -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- 合并后的内容卡片 -->
      <div
        class="flex-1 bg-[var(--el-bg-color-overlay)] rounded-2xl shadow-sm border border-[var(--el-border-color-light)] overflow-hidden flex flex-col"
      >
        <!-- 顶部操作栏（内嵌在卡片顶部） -->
        <div
          :class="[
            'content-toolbar px-6 py-4 border-b border-[var(--el-border-color-lighter)] bg-[var(--el-fill-color-light)]/30 flex-shrink-0',
            isCompactLayout
              ? 'content-toolbar--compact'
              : 'flex justify-between items-center'
          ]"
        >
          <div class="toolbar-status flex items-center space-x-4">
            <div
              v-if="displayVersionResolved"
              class="flex items-center gap-3 px-4 py-2 bg-[var(--el-color-success-light-9)] rounded-xl"
            >
              <div
                class="w-2 h-2 bg-[var(--el-color-success)] rounded-full animate-pulse"
              />
              <span class="text-sm text-[var(--el-color-success)] font-bold"
                >Active v{{ displayVersionResolved }}</span
              >
            </div>
            <div
              v-if="polling"
              class="flex items-center text-[var(--el-color-primary)] text-sm font-semibold px-4 py-2 bg-[var(--el-color-primary-light-9)] rounded-xl"
            >
              <el-icon class="mr-2 animate-spin"><Loading /></el-icon>
              监听中...
            </div>
          </div>

          <div
            :class="[
              'toolbar-actions flex gap-2',
              { 'toolbar-actions--compact': isCompactLayout }
            ]"
          >
            <el-button
              :disabled="!currentScope"
              class="!rounded-xl !h-10 !px-4"
              :icon="Refresh"
              @click="refreshScope"
            >
              刷新
            </el-button>
            <el-button
              :loading="syncLoading"
              class="!rounded-xl !h-10 !px-4"
              :icon="Upload"
              @click="onForceSync"
            >
              同步
            </el-button>
            <el-button
              v-if="selectedScopeType === 'hour'"
              :disabled="!canBatchGenerate"
              class="!rounded-xl !h-10 !px-4"
              :icon="Promotion"
              @click="openBatchDialog"
            >
              批量生成
            </el-button>
            <el-button
              type="primary"
              :disabled="!canGenerate"
              :loading="generateLoading"
              class="!rounded-xl !h-10 !px-6 !font-bold shadow-md"
              :icon="Cpu"
              @click="onGenerate"
            >
              {{ generateButtonLabel }}
            </el-button>
          </div>
        </div>

        <div v-if="selectedChapterId" class="scope-readiness-wrap">
          <el-alert
            :title="readinessTitle"
            :description="readinessDescription"
            :type="readinessType"
            :closable="false"
            show-icon
            aria-live="polite"
          />
          <el-alert
            v-if="submissionFeedback"
            class="mt-3"
            :title="submissionFeedback.title"
            :description="submissionFeedback.description"
            :type="submissionFeedback.type"
            closable
            show-icon
            @close="submissionFeedback = null"
          />
          <el-alert
            v-if="listWarning"
            class="mt-3"
            title="任务列表同步提示"
            :description="listWarning"
            type="warning"
            closable
            show-icon
            @close="listWarning = ''"
          />
        </div>

        <!-- 内容体 -->
        <div class="flex-1 p-6 overflow-hidden flex flex-col">
          <div
            v-if="!selectedChapterId"
            class="flex-1 flex flex-col items-center justify-center relative"
          >
            <!-- 装饰性背景光斑 -->
            <div
              class="absolute top-[15%] left-[20%] w-28 h-28 bg-blue-200/30 dark:bg-blue-800/20 rounded-full filter blur-2xl pointer-events-none"
            />
            <div
              class="absolute bottom-[20%] right-[15%] w-36 h-36 bg-amber-200/30 dark:bg-amber-800/20 rounded-full filter blur-2xl pointer-events-none"
            />
            <div class="text-center relative z-10">
              <div class="lottie-glass mx-auto mb-8">
                <lottie-animation
                  :animation-data="CinemaAnim"
                  :width="200"
                  :height="200"
                />
              </div>
              <h3
                class="text-2xl font-black text-[var(--el-text-color-primary)] mb-3"
              >
                选择课程与章节
              </h3>
              <p
                class="text-base text-[var(--el-text-color-secondary)] max-w-sm mx-auto leading-relaxed mb-8"
              >
                从左侧选择目标课程和章节，即可查看和管理 AI 动画生成任务
              </p>
            </div>
          </div>
          <div v-else class="flex-1 flex flex-col overflow-hidden">
            <div
              :class="[
                'filter-toolbar mb-5 pb-5 border-b border-[var(--el-border-color-lighter)]',
                isCompactLayout
                  ? 'filter-toolbar--compact'
                  : 'flex justify-between items-center'
              ]"
            >
              <el-radio-group
                v-model="statusFilter"
                size="large"
                :class="[
                  'animation-filter-group',
                  { 'animation-filter-group--compact': isCompactLayout }
                ]"
                @change="applyFilter"
              >
                <el-radio-button value="all">
                  <span class="flex items-center gap-2 text-sm px-1">
                    全部
                  </span>
                </el-radio-button>
                <el-radio-button value="completed">
                  <span class="flex items-center gap-2 text-sm px-1">
                    成功
                  </span>
                </el-radio-button>
                <el-radio-button value="processing">
                  <span class="flex items-center gap-2 text-sm px-1">
                    进行中
                  </span>
                </el-radio-button>
                <el-radio-button value="failed">
                  <span class="flex items-center gap-2 text-sm px-1">
                    失败
                  </span>
                </el-radio-button>
              </el-radio-group>
              <el-input
                v-model="keyword"
                placeholder="搜索文件名..."
                clearable
                size="large"
                :class="[
                  '!rounded-xl filter-keyword',
                  isMobile || isCompactLayout ? '!w-full' : '!w-80'
                ]"
                @input="applyFilter"
              >
                <template #prefix
                  ><el-icon class="text-[var(--el-text-color-placeholder)]"
                    ><Search /></el-icon
                ></template>
              </el-input>
            </div>

            <div class="flex-1 overflow-auto custom-scrollbar">
              <div v-if="isMobile" class="mobile-animation-list">
                <div
                  v-for="row in filteredTasks"
                  :key="row.taskId"
                  class="mobile-animation-card"
                >
                  <div class="mobile-animation-card__header">
                    <div class="mobile-animation-version">
                      <el-icon
                        v-if="isDisplayVersion(row)"
                        class="text-[var(--el-color-success)] mr-1.5"
                      >
                        <StarFilled />
                      </el-icon>
                      <el-tag
                        v-if="row.status === 'completed'"
                        type="success"
                        effect="plain"
                      >
                        v{{ row.version }}
                      </el-tag>
                      <span
                        v-else
                        class="text-[var(--el-text-color-placeholder)]"
                      >
                        --
                      </span>
                    </div>

                    <div
                      class="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold"
                      :class="{
                        'bg-[var(--el-color-success-light-9)] text-[var(--el-color-success)]':
                          row.status === 'completed',
                        'bg-[var(--el-color-warning-light-9)] text-[var(--el-color-warning)]':
                          row.status === 'processing',
                        'bg-[var(--el-color-danger-light-9)] text-[var(--el-color-danger)]':
                          row.status === 'failed',
                        'bg-[var(--el-fill-color-light)] text-[var(--el-text-color-secondary)]':
                          !['completed', 'processing', 'failed'].includes(
                            row.status
                          )
                      }"
                    >
                      {{
                        row.status === "completed"
                          ? "完成"
                          : row.status === "processing"
                            ? "处理中"
                            : row.status === "failed"
                              ? "失败"
                              : row.status
                      }}
                    </div>
                  </div>

                  <div class="mobile-animation-card__body">
                    <div
                      v-if="selectedScopeType === 'chapter'"
                      class="mobile-animation-field"
                    >
                      <span class="label">课时</span>
                      <el-button
                        v-if="canOpenTaskScope(row)"
                        type="primary"
                        link
                        :icon="View"
                        @click="viewTaskScope(row)"
                      >
                        {{ getHourTitle(row.hourId) }}
                      </el-button>
                      <span v-else>整章</span>
                    </div>
                    <div class="mobile-animation-field">
                      <span class="label">File</span>
                      <span>{{ row.fileName || `任务 ${row.taskId}` }}</span>
                    </div>
                    <div class="mobile-animation-grid">
                      <div class="mobile-animation-field">
                        <span class="label">Size</span>
                        <span>{{ formatSize(row.fileSize) }}</span>
                      </div>
                      <div class="mobile-animation-field">
                        <span class="label">Created</span>
                        <span>{{ row.createdAt }}</span>
                      </div>
                    </div>
                    <div
                      v-if="row.status === 'failed'"
                      class="mobile-animation-field"
                    >
                      <span class="label">异常</span>
                      <span>{{
                        row.errorMessage || row.errorCode || "生成失败"
                      }}</span>
                    </div>
                  </div>

                  <div class="mobile-animation-card__actions">
                    <el-button
                      type="primary"
                      plain
                      class="mobile-animation-action-btn"
                      :disabled="row.status !== 'completed'"
                      @click="openPreview(row)"
                    >
                      预览
                    </el-button>
                    <el-button
                      type="success"
                      plain
                      class="mobile-animation-action-btn"
                      :disabled="
                        row.status !== 'completed' || isDisplayVersion(row)
                      "
                      @click="setDisplay(row)"
                    >
                      展示
                    </el-button>
                    <el-button
                      type="info"
                      plain
                      class="mobile-animation-action-btn"
                      :disabled="row.status !== 'completed'"
                      @click="copyUrl(row)"
                    >
                      URL
                    </el-button>
                  </div>
                </div>

                <el-empty v-if="!listLoading && filteredTasks.length === 0" />
              </div>

              <el-table
                v-else
                v-loading="listLoading"
                :data="filteredTasks"
                class="animation-table"
                :row-class-name="rowClassName"
                header-cell-class-name="!bg-[var(--el-fill-color-light)] !text-[var(--el-text-color-primary)] !font-bold !text-base !py-4"
              >
                <el-table-column
                  prop="version"
                  label="版本"
                  width="120"
                  align="center"
                >
                  <template #default="{ row }">
                    <div class="flex items-center justify-center text-base">
                      <el-icon
                        v-if="isDisplayVersion(row)"
                        class="text-[var(--el-color-success)] mr-1.5"
                        ><StarFilled
                      /></el-icon>
                      <el-tag
                        v-if="row.status === 'completed'"
                        type="success"
                        size="large"
                        effect="plain"
                        class="!bg-[var(--el-color-success-light-9)] !font-bold !rounded-lg !text-base"
                        >v{{ row.version }}</el-tag
                      >
                      <span
                        v-else
                        class="text-[var(--el-text-color-placeholder)]"
                        >--</span
                      >
                    </div>
                  </template>
                </el-table-column>
                <el-table-column
                  prop="status"
                  label="状态"
                  width="140"
                  align="center"
                >
                  <template #default="{ row }">
                    <div
                      class="inline-flex items-center px-4 py-2 rounded-lg text-base font-bold"
                      :class="{
                        'bg-[var(--el-color-success-light-9)] text-[var(--el-color-success)]':
                          row.status === 'completed',
                        'bg-[var(--el-color-warning-light-9)] text-[var(--el-color-warning)]':
                          row.status === 'processing',
                        'bg-[var(--el-color-danger-light-9)] text-[var(--el-color-danger)]':
                          row.status === 'failed',
                        'bg-[var(--el-fill-color-light)] text-[var(--el-text-color-secondary)]':
                          !['completed', 'processing', 'failed'].includes(
                            row.status
                          )
                      }"
                    >
                      <span
                        class="w-2 h-2 rounded-full mr-2"
                        :class="{
                          'bg-[var(--el-color-success)]':
                            row.status === 'completed',
                          'bg-[var(--el-color-warning)] animate-pulse':
                            row.status === 'processing',
                          'bg-[var(--el-color-danger)]':
                            row.status === 'failed',
                          'bg-[var(--el-text-color-placeholder)]': ![
                            'completed',
                            'processing',
                            'failed'
                          ].includes(row.status)
                        }"
                      />
                      {{
                        row.status === "completed"
                          ? "完成"
                          : row.status === "processing"
                            ? "处理中"
                            : row.status === "failed"
                              ? "失败"
                              : row.status
                      }}
                    </div>
                  </template>
                </el-table-column>
                <el-table-column
                  v-if="selectedScopeType === 'chapter'"
                  label="所属课时"
                  min-width="170"
                  show-overflow-tooltip
                >
                  <template #default="{ row }">
                    <el-button
                      v-if="canOpenTaskScope(row)"
                      type="primary"
                      link
                      :icon="View"
                      @click="viewTaskScope(row)"
                    >
                      {{ getHourTitle(row.hourId) }}
                    </el-button>
                    <span v-else>整章</span>
                  </template>
                </el-table-column>
                <el-table-column
                  prop="fileName"
                  label="文件名"
                  min-width="200"
                  show-overflow-tooltip
                >
                  <template #default="{ row }">
                    <span
                      class="text-[var(--el-text-color-primary)] font-medium text-base"
                      >{{ row.fileName || `任务 ${row.taskId}` }}</span
                    >
                  </template>
                </el-table-column>
                <el-table-column
                  prop="fileSize"
                  label="大小"
                  width="120"
                  align="center"
                >
                  <template #default="{ row }">
                    <span
                      class="text-[var(--el-text-color-secondary)] text-base font-mono"
                      >{{ formatSize(row.fileSize) }}</span
                    >
                  </template>
                </el-table-column>
                <el-table-column
                  prop="createdAt"
                  label="创建时间"
                  width="180"
                  align="center"
                >
                  <template #default="{ row }">
                    <span
                      class="text-[var(--el-text-color-secondary)] text-base"
                      >{{ row.createdAt }}</span
                    >
                  </template>
                </el-table-column>
                <el-table-column
                  label="异常信息"
                  min-width="180"
                  show-overflow-tooltip
                >
                  <template #default="{ row }">
                    <div v-if="row.status === 'failed'" class="task-error-cell">
                      <span>{{
                        row.errorMessage || row.errorCode || "生成失败"
                      }}</span>
                      <small v-if="row.requestId"
                        >请求 {{ row.requestId }}</small
                      >
                    </div>
                    <span v-else class="text-[var(--el-text-color-placeholder)]"
                      >--</span
                    >
                  </template>
                </el-table-column>
                <el-table-column
                  label="操作"
                  width="320"
                  fixed="right"
                  align="center"
                >
                  <template #default="{ row }">
                    <div class="flex gap-2 justify-center">
                      <el-button
                        size="large"
                        type="primary"
                        plain
                        class="!rounded-lg !text-sm"
                        :disabled="row.status !== 'completed'"
                        @click="openPreview(row)"
                      >
                        <el-icon class="mr-1"><View /></el-icon>预览
                      </el-button>
                      <el-button
                        size="large"
                        type="success"
                        plain
                        class="!rounded-lg !text-sm"
                        :disabled="
                          row.status !== 'completed' || isDisplayVersion(row)
                        "
                        @click="setDisplay(row)"
                      >
                        <el-icon class="mr-1"><StarFilled /></el-icon>展示
                      </el-button>
                      <el-button
                        size="large"
                        type="info"
                        plain
                        class="!rounded-lg !text-sm"
                        :disabled="row.status !== 'completed'"
                        @click="copyUrl(row)"
                      >
                        <el-icon class="mr-1"><DocumentCopy /></el-icon>URL
                      </el-button>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 预览弹窗 -->
    <el-dialog
      v-model="previewVisible"
      title="动画渲染预览"
      :width="getDialogWidth('85%', '96%')"
      :fullscreen="isMobile"
      top="4vh"
      class="!rounded-2xl overflow-hidden shadow-2xl"
    >
      <div
        v-if="previewUrl"
        class="h-[75vh] bg-black rounded-xl overflow-hidden border border-[var(--el-border-color-light)]"
      >
        <iframe :src="previewUrl" frameborder="0" class="w-full h-full" />
      </div>
      <template #footer>
        <div class="flex justify-between items-center px-4 py-2">
          <span
            class="text-xs text-[var(--el-text-color-placeholder)] font-mono"
            >DEBUG MODE</span
          >
          <div class="space-x-4">
            <el-button
              :icon="FullScreen"
              class="!rounded-xl"
              @click="openInNewWindow"
              >全屏查看</el-button
            >
            <el-button
              type="primary"
              class="!rounded-xl px-8"
              @click="previewVisible = false"
              >完成</el-button
            >
          </div>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="batchDialogVisible"
      title="批量生成课时动画"
      :width="getDialogWidth('720px', '96%')"
      :fullscreen="isMobile"
      class="batch-generation-dialog"
      destroy-on-close
    >
      <el-form label-position="top">
        <el-form-item label="选择课时（每批最多 10 个，整章会自动分批提交）">
          <el-select
            v-model="batchHourIds"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            placeholder="请选择需要生成动画的课时"
            class="w-full"
          >
            <el-option
              v-for="hour in hourOptions"
              :key="hour.hourId"
              :label="hour.title"
              :value="hour.hourId"
            />
          </el-select>
        </el-form-item>
      </el-form>

      <template v-if="batchResult">
        <el-alert
          :title="batchSummaryText"
          description="批量任务按课时创建；关闭此窗口后，下方生成列表会按课时汇总显示。"
          :type="batchResult.failed > 0 ? 'warning' : 'success'"
          :closable="false"
          show-icon
          class="mb-4"
        />
        <div v-if="isMobile" class="batch-result-list">
          <div
            v-for="(item, index) in batchResult.items"
            :key="`${item.hourId}-${item.taskId || item.action}-${index}`"
            class="batch-result-card"
          >
            <div class="batch-result-card__header">
              <span class="batch-result-card__title">
                {{ getHourTitle(item.hourId) }}
              </span>
              <el-tag :type="getBatchActionType(item.action)">
                {{ getBatchActionLabel(item.action) }}
              </el-tag>
            </div>
            <div class="batch-result-card__details">
              <span class="batch-result-card__label">任务 ID</span>
              <span>{{ item.taskId || "-" }}</span>
              <span class="batch-result-card__label">说明</span>
              <span>
                {{ item.errorMessage || item.errorCode || item.status }}
              </span>
              <span class="batch-result-card__label">可重试</span>
              <span>{{ item.retryable ? "是" : "否" }}</span>
              <el-button
                v-if="['accepted', 'reused'].includes(item.action)"
                type="primary"
                link
                :icon="View"
                @click="viewBatchTask(item)"
              >
                查看任务
              </el-button>
            </div>
          </div>
        </div>
        <el-table v-else :data="batchResult.items" max-height="340" border>
          <el-table-column label="课时" min-width="160">
            <template #default="{ row }">
              {{ getHourTitle(row.hourId) }}
            </template>
          </el-table-column>
          <el-table-column label="结果" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="getBatchActionType(row.action)">
                {{ getBatchActionLabel(row.action) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            prop="taskId"
            label="任务 ID"
            min-width="210"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.taskId || "-" }}
            </template>
          </el-table-column>
          <el-table-column label="说明" min-width="220">
            <template #default="{ row }">
              {{ row.errorMessage || row.errorCode || row.status }}
            </template>
          </el-table-column>
          <el-table-column label="可重试" width="90" align="center">
            <template #default="{ row }">
              {{ row.retryable ? "是" : "否" }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="110" align="center">
            <template #default="{ row }">
              <el-button
                v-if="['accepted', 'reused'].includes(row.action)"
                type="primary"
                link
                :icon="View"
                @click="viewBatchTask(row)"
              >
                查看任务
              </el-button>
              <span v-else>-</span>
            </template>
          </el-table-column>
        </el-table>
      </template>

      <template #footer>
        <el-button @click="batchDialogVisible = false">关闭</el-button>
        <el-button
          type="primary"
          :loading="batchLoading"
          :disabled="batchHourIds.length === 0"
          @click="submitBatchGenerate"
        >
          提交批量任务
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { usePageResponsive } from "@/utils/pageResponsive";
import { getCourseList, getCourseHoursList } from "@/api/course";
import {
  batchGenerateHtmlAnimation,
  chunkHtmlAnimationBatchItems,
  createHtmlAnimationIdempotencyKey,
  expandHtmlAnimationListScopes,
  generateHtmlAnimation,
  getHtmlAnimationReadiness,
  getHtmlAnimationList,
  htmlAnimationScopeKey,
  matchesHtmlAnimationScope,
  setHtmlAnimationDisplay,
  forceSyncHtmlAnimation,
  normalizeHtmlAnimationTask,
  type HtmlAnimationBatchResult,
  type HtmlAnimationListResult,
  type HtmlAnimationReadinessResult,
  type HtmlAnimationScope,
  type HtmlAnimationScopeType,
  type HtmlAnimationTask
} from "@/api/htmlAnimation";
import {
  VideoPlay,
  Loading,
  Cpu,
  Refresh,
  Upload,
  Search,
  Document,
  Promotion,
  View,
  More,
  Download,
  Delete,
  Reading,
  Management,
  Calendar,
  DocumentCopy,
  FullScreen,
  StarFilled,
  Film,
  Setting,
  DataAnalysis
} from "@element-plus/icons-vue";
import htmlIconSvg from "@/assets/new-release/html-file-type-svgrepo-com.svg?url";
import LottieAnimation from "@/components/LottieAnimation.vue";
import CinemaAnim from "@/assets/Cinema news animation.json";

defineOptions({
  name: "CourseAnimation"
});

const { isMobile, getDialogWidth } = usePageResponsive();
const isCompactLayout = ref(false);

interface AnimationHourOption {
  hourId: number;
  title: string;
}

interface AnimationChapterOption {
  chapterId: number;
  name: string;
  hourList: AnimationHourOption[];
}

const selectedCourseId = ref<number | null>(null);
const selectedChapterId = ref<number | null>(null);
const selectedScopeType = ref<HtmlAnimationScopeType>("chapter");
const selectedHourId = ref<number | null>(null);
const courseOptions = ref<any[]>([]);
const chapterOptions = ref<AnimationChapterOption[]>([]);
const courseLoading = ref(false);
const listLoading = ref(false);
const generateLoading = ref(false);
const syncLoading = ref(false);
const polling = ref(false);
let pollTimer: any = null;
let listRequestSeq = 0;
let readinessRequestSeq = 0;

const tasks = ref<HtmlAnimationTask[]>([]);
const displayVersionRaw = ref("");
const displayVersionResolved = ref("");
const readiness = ref<HtmlAnimationReadinessResult | null>(null);
const readinessLoading = ref(false);
const readinessError = ref("");
const generationIntentKeys = new Map<string, string>();

const batchDialogVisible = ref(false);
const batchHourIds = ref<number[]>([]);
const batchLoading = ref(false);
const batchResult = ref<HtmlAnimationBatchResult | null>(null);
const batchRetryIntent = ref("");

type SubmissionFeedback = {
  type: "success" | "warning" | "error" | "info";
  title: string;
  description: string;
};

type PendingTaskHint = {
  scopeKey: string;
  task: HtmlAnimationTask;
};

const submissionFeedback = ref<SubmissionFeedback | null>(null);
const pendingTaskHints = new Map<string, PendingTaskHint>();
const displayVersionsByScope = new Map<
  string,
  { raw: string; resolved: string }
>();
const listWarning = ref("");
const MAX_CONCURRENT_HOUR_LIST_REQUESTS = 4;

const statusFilter = ref("all");
const keyword = ref("");

const previewVisible = ref(false);
const previewUrl = ref("");

const selectedChapter = computed(() =>
  chapterOptions.value.find(
    chapter => chapter.chapterId === selectedChapterId.value
  )
);

const hourOptions = computed(
  () => selectedChapter.value?.hourList.filter(hour => hour.hourId > 0) || []
);

const currentScope = computed<HtmlAnimationScope | null>(() => {
  if (!selectedCourseId.value || !selectedChapterId.value) return null;
  if (selectedScopeType.value === "hour") {
    if (!selectedHourId.value) return null;
    return {
      courseId: selectedCourseId.value,
      chapterId: selectedChapterId.value,
      scopeType: "hour",
      hourId: selectedHourId.value
    };
  }
  return {
    courseId: selectedCourseId.value,
    chapterId: selectedChapterId.value,
    scopeType: "chapter"
  };
});

const currentScopeKey = computed(() =>
  currentScope.value ? htmlAnimationScopeKey(currentScope.value) : ""
);

const isTaskProcessing = (task: HtmlAnimationTask) =>
  ["pending", "submitted", "processing"].includes(task.status);
const isTaskCompleted = (task: HtmlAnimationTask) =>
  task.status === "completed";
const isTaskFailed = (task: HtmlAnimationTask) => task.status === "failed";

function addPendingTaskHint(
  scope: HtmlAnimationScope,
  taskId?: string,
  status = "processing"
) {
  const normalizedTaskId = String(taskId || "").trim();
  if (!normalizedTaskId) return;
  const now = new Date().toISOString();
  const task = normalizeHtmlAnimationTask({
    taskId: normalizedTaskId,
    scopeType: scope.scopeType,
    ...(scope.hourId ? { hourId: scope.hourId } : {}),
    status,
    version: 0,
    fileName: "",
    objectName: "",
    fileSize: 0,
    errorMessage: "",
    createdAt: now,
    updatedAt: now,
    completedAt: ""
  });
  const scopeKey = htmlAnimationScopeKey(scope);
  pendingTaskHints.set(`${scopeKey}:${normalizedTaskId}`, {
    scopeKey,
    task
  });
}

function getTaskScope(task: HtmlAnimationTask): HtmlAnimationScope | null {
  if (!selectedCourseId.value || !selectedChapterId.value) return null;
  const hourId = Number(task.hourId);
  if (task.scopeType === "hour" && hourId > 0) {
    return {
      courseId: selectedCourseId.value,
      chapterId: selectedChapterId.value,
      scopeType: "hour",
      hourId
    };
  }
  return {
    courseId: selectedCourseId.value,
    chapterId: selectedChapterId.value,
    scopeType: "chapter"
  };
}

function getListScopes(scope: HtmlAnimationScope) {
  return expandHtmlAnimationListScopes(
    scope,
    hourOptions.value.map(hour => hour.hourId)
  );
}

function getListScopeKeys(scope: HtmlAnimationScope) {
  return new Set(getListScopes(scope).map(htmlAnimationScopeKey));
}

function mergePendingTaskHints(
  scope: HtmlAnimationScope,
  serverTasks: HtmlAnimationTask[]
) {
  const scopeKeys = getListScopeKeys(scope);
  const serverTaskKeys = new Set(
    serverTasks.map(task => {
      const taskScope = getTaskScope(task);
      return `${
        taskScope
          ? htmlAnimationScopeKey(taskScope)
          : htmlAnimationScopeKey(scope)
      }:${task.taskId}`;
    })
  );
  pendingTaskHints.forEach((hint, key) => {
    if (scopeKeys.has(hint.scopeKey) && serverTaskKeys.has(key)) {
      pendingTaskHints.delete(key);
    }
  });
  const pending = [...pendingTaskHints.values()]
    .filter(hint => scopeKeys.has(hint.scopeKey))
    .map(hint => hint.task)
    .filter(task => {
      const taskScope = getTaskScope(task);
      const key = `${
        taskScope
          ? htmlAnimationScopeKey(taskScope)
          : htmlAnimationScopeKey(scope)
      }:${task.taskId}`;
      return !serverTaskKeys.has(key);
    });
  return [...serverTasks, ...pending];
}

function pendingTasksForScope(scope: HtmlAnimationScope) {
  const scopeKeys = getListScopeKeys(scope);
  return [...pendingTaskHints.values()]
    .filter(hint => scopeKeys.has(hint.scopeKey))
    .map(hint => hint.task);
}

const updateCompactLayout = () => {
  if (typeof window === "undefined") return;
  isCompactLayout.value = window.innerWidth <= 1120 && !isMobile.value;
};

// 统计
const stats = computed(() => {
  return {
    completed: tasks.value.filter(isTaskCompleted).length,
    processing: tasks.value.filter(isTaskProcessing).length,
    failed: tasks.value.filter(isTaskFailed).length
  };
});

const latestCompletedVersion = computed(() => {
  const versions = tasks.value
    .filter(isTaskCompleted)
    .map(t => t.version)
    .filter(v => v > 0);
  return versions.length ? Math.max(...versions) : null;
});

const latestSuccessTime = computed(() => {
  const completed = tasks.value.filter(
    t => isTaskCompleted(t) && t.completedAt
  );
  if (!completed.length) return "";
  // 最新完成时间
  return completed.sort((a, b) =>
    (b.completedAt || "").localeCompare(a.completedAt || "")
  )[0].completedAt;
});

const canBatchGenerate = computed(
  () =>
    !!selectedCourseId.value &&
    !!selectedChapterId.value &&
    !!hourOptions.value.length
);

const canGenerate = computed(() => {
  if (
    !currentScope.value ||
    readiness.value?.ready !== true ||
    readinessLoading.value
  ) {
    return false;
  }
  if (selectedScopeType.value === "chapter") {
    return canBatchGenerate.value && !batchLoading.value;
  }
  return !generateLoading.value && !tasks.value.some(isTaskProcessing);
});

const generateButtonLabel = computed(() =>
  selectedScopeType.value === "chapter" ? "按课时批量生成" : "AI 生成"
);

const readinessTitle = computed(() => {
  if (!currentScope.value) return "请选择需要生成动画的课时";
  if (readinessLoading.value) return "正在检查内容就绪度";
  if (readinessError.value) return "暂时无法检查内容就绪度";
  if (readiness.value?.ready) return "当前范围可以生成动画";
  const titles: Record<string, string> = {
    CONTENT_NOT_CURATED: "课程内容尚未完成梳理",
    CONTENT_MISSING: "当前范围缺少可生成内容",
    SEARCH_UNAVAILABLE: "内容检索服务暂不可用"
  };
  return titles[readiness.value?.code || ""] || "当前范围暂不可生成";
});

const readinessDescription = computed(() => {
  if (!currentScope.value) return "选择课时后将检查对应内容。";
  if (readinessLoading.value) return "";
  if (readinessError.value) return readinessError.value;
  if (!readiness.value) return "刷新后重试。";

  const diagnostics: string[] = [];
  if (readiness.value.availableDocuments > 0) {
    diagnostics.push(`可用内容 ${readiness.value.availableDocuments} 项`);
  }
  if (readiness.value.rawDocuments > 0) {
    diagnostics.push(`待梳理原始内容 ${readiness.value.rawDocuments} 项`);
  }
  return [readiness.value.message, ...diagnostics].filter(Boolean).join("；");
});

const readinessType = computed<"success" | "warning" | "error" | "info">(() => {
  if (readiness.value?.ready) return "success";
  if (readiness.value?.code === "CONTENT_NOT_CURATED") return "warning";
  if (readinessError.value || readiness.value?.code === "SEARCH_UNAVAILABLE") {
    return "error";
  }
  return "info";
});

const batchSummaryText = computed(() => {
  if (!batchResult.value) return "";
  return `共 ${batchResult.value.total} 项，已受理或复用 ${batchResult.value.successful} 项，未受理 ${batchResult.value.failed} 项`;
});

const filteredTasks = computed(() => {
  let arr = tasks.value.slice().sort((a, b) => b.version - a.version);
  if (statusFilter.value !== "all")
    arr = arr.filter(t =>
      statusFilter.value === "processing"
        ? isTaskProcessing(t)
        : t.status === statusFilter.value
    );
  if (keyword.value)
    arr = arr.filter(t =>
      t.fileName?.toLowerCase().includes(keyword.value.toLowerCase())
    );
  return arr;
});

function applyFilter() {
  /* computed 已处理，此函数占位供事件触发刷新 */
}

function getRequestErrorMessage(error: any, fallback: string) {
  const status = error?.response?.status;
  const reqUrl = error?.config?.url;
  if (status === 404) {
    return reqUrl
      ? `接口不存在(404): ${reqUrl}，请确认当前环境已部署HTML动画接口`
      : "接口不存在(404)，请确认当前环境已部署HTML动画接口";
  }
  const message =
    error?.response?.data?.msg ||
    error?.response?.data?.message ||
    error?.message ||
    fallback;
  const responseData = error?.response?.data;
  const requestId = String(
    responseData?.request_id ||
      responseData?.requestId ||
      responseData?.data?.request_id ||
      responseData?.data?.requestId ||
      error?.response?.headers?.["x-request-id"] ||
      ""
  ).trim();
  return requestId ? `${message}（请求 ${requestId}）` : message;
}

async function searchCourses(query: string) {
  courseLoading.value = true;
  try {
    const { data } = await getCourseList({
      pageNum: 1,
      pageSize: 20,
      courseName: query || undefined
    });
    courseOptions.value = data.courseList || [];
  } catch (e) {
    ElMessage.error("课程搜索失败");
  } finally {
    courseLoading.value = false;
  }
}

async function preloadCourses() {
  await searchCourses("");
}

function resetScopeData() {
  listRequestSeq += 1;
  readinessRequestSeq += 1;
  tasks.value = [];
  displayVersionRaw.value = "";
  displayVersionResolved.value = "";
  displayVersionsByScope.clear();
  listWarning.value = "";
  readiness.value = null;
  readinessError.value = "";
  readinessLoading.value = false;
  listLoading.value = false;
  stopPolling();
}

async function handleCourseChange() {
  selectedChapterId.value = null;
  selectedHourId.value = null;
  chapterOptions.value = [];
  resetScopeData();
  if (!selectedCourseId.value) return;
  try {
    const { data } = await getCourseHoursList({
      courseId: selectedCourseId.value
    });
    chapterOptions.value = (data.courseChapters || []).map(ch => ({
      chapterId: ch.chapterId,
      name: ch.name,
      hourList: (ch.hourList || []).map(hour => ({
        hourId: Number(hour.hourId),
        title: hour.title || `课时 ${hour.hourId}`
      }))
    }));
  } catch (e) {
    ElMessage.error("章节加载失败");
  }
}

function handleChapterChange() {
  selectedHourId.value = null;
  resetScopeData();
  if (selectedChapterId.value && selectedScopeType.value === "chapter") {
    refreshScope();
  }
}

function handleScopeChange() {
  selectedHourId.value = null;
  resetScopeData();
  if (selectedScopeType.value === "chapter" && selectedChapterId.value) {
    refreshScope();
  }
}

function handleHourChange() {
  resetScopeData();
  if (currentScope.value) refreshScope();
}

async function refreshScope() {
  if (!currentScope.value) return;
  await Promise.all([refreshList(), refreshReadiness()]);
}

type ScopedAnimationList = {
  scope: HtmlAnimationScope;
  data: HtmlAnimationListResult;
};

type ScopedAnimationListFailure = {
  scope: HtmlAnimationScope;
  error: unknown;
};

function normalizeTasksForScope(
  scope: HtmlAnimationScope,
  data: HtmlAnimationListResult
) {
  return (data.tasks || []).map(task =>
    normalizeHtmlAnimationTask({
      ...task,
      scopeType: task.scopeType || scope.scopeType,
      ...(scope.scopeType === "hour" && !Number(task.hourId)
        ? { hourId: scope.hourId }
        : {})
    })
  );
}

function getPollingListScopes(scope: HtmlAnimationScope) {
  if (scope.scopeType === "hour") return [scope];
  const visibleScopeKeys = getListScopeKeys(scope);
  const activeScopeKeys = new Set<string>();
  for (const task of tasks.value) {
    if (!isTaskProcessing(task)) continue;
    const taskScope = getTaskScope(task);
    if (taskScope) activeScopeKeys.add(htmlAnimationScopeKey(taskScope));
  }
  pendingTaskHints.forEach(hint => {
    if (visibleScopeKeys.has(hint.scopeKey) && isTaskProcessing(hint.task)) {
      activeScopeKeys.add(hint.scopeKey);
    }
  });
  return getListScopes(scope).filter(candidate =>
    activeScopeKeys.has(htmlAnimationScopeKey(candidate))
  );
}

async function fetchScopedAnimationLists(scopes: HtmlAnimationScope[]) {
  const results: ScopedAnimationList[] = [];
  const failures: ScopedAnimationListFailure[] = [];
  let nextIndex = 0;
  const workerCount = Math.min(
    MAX_CONCURRENT_HOUR_LIST_REQUESTS,
    scopes.length
  );

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < scopes.length) {
        const scopeIndex = nextIndex;
        nextIndex += 1;
        const targetScope = scopes[scopeIndex];
        try {
          const { data } = await getHtmlAnimationList(targetScope);
          if (!matchesHtmlAnimationScope(targetScope, data)) {
            throw new Error("动画列表返回的课程、章节或课时与请求范围不一致");
          }
          results.push({ scope: targetScope, data });
        } catch (error) {
          failures.push({ scope: targetScope, error });
        }
      }
    })
  );

  return { results, failures };
}

function updateDisplayVersion(
  scope: HtmlAnimationScope,
  data: HtmlAnimationListResult
) {
  const scopeKey = htmlAnimationScopeKey(scope);
  displayVersionsByScope.set(scopeKey, {
    raw: data.displayVersionRaw,
    resolved: data.displayVersionResolved
  });
  if (scopeKey === currentScopeKey.value) {
    displayVersionRaw.value = data.displayVersionRaw;
    displayVersionResolved.value = data.displayVersionResolved;
  }
}

function formatListWarning(failures: ScopedAnimationListFailure[]) {
  if (!failures.length) return "";
  if (failures.length === 1) {
    const failure = failures[0];
    const label =
      failure.scope.scopeType === "hour"
        ? getHourTitle(failure.scope.hourId)
        : "章节任务";
    return `${label}列表暂时无法刷新：${getRequestErrorMessage(
      failure.error,
      "请稍后重试"
    )}`;
  }
  return `${failures.length} 个范围的任务列表暂时无法刷新，已保留其他课时的任务记录。`;
}

async function refreshList(pollingOnly = false) {
  const scope = currentScope.value;
  if (!scope) return;
  const requestScopeKey = htmlAnimationScopeKey(scope);
  const requestId = ++listRequestSeq;
  listLoading.value = true;
  try {
    const listScopes = pollingOnly
      ? getPollingListScopes(scope)
      : getListScopes(scope);
    if (!listScopes.length) {
      stopPolling();
      return;
    }
    const { results, failures } = await fetchScopedAnimationLists(listScopes);
    if (
      requestId !== listRequestSeq ||
      requestScopeKey !== currentScopeKey.value
    ) {
      return;
    }
    if (!results.length) {
      throw failures[0]?.error || new Error("动画列表未返回可用数据");
    }
    const refreshedScopeKeys = new Set(
      results.map(item => htmlAnimationScopeKey(item.scope))
    );
    const serverTasksById = new Map<string, HtmlAnimationTask>();
    if (pollingOnly) {
      for (const task of tasks.value) {
        const taskScope = getTaskScope(task);
        if (
          !taskScope ||
          !refreshedScopeKeys.has(htmlAnimationScopeKey(taskScope))
        ) {
          serverTasksById.set(task.taskId, task);
        }
      }
    }
    for (const item of results) {
      updateDisplayVersion(item.scope, item.data);
      for (const task of normalizeTasksForScope(item.scope, item.data)) {
        serverTasksById.set(task.taskId, task);
      }
    }
    const serverTasks = [...serverTasksById.values()];
    tasks.value = mergePendingTaskHints(scope, serverTasks);
    if (
      !results.some(
        item => htmlAnimationScopeKey(item.scope) === requestScopeKey
      )
    ) {
      displayVersionRaw.value = "";
      displayVersionResolved.value = "";
    }
    listWarning.value = formatListWarning(failures);
    if (tasks.value.some(isTaskProcessing) && !polling.value) {
      startPolling();
    } else if (!tasks.value.some(isTaskProcessing)) {
      stopPolling();
    }
  } catch (e) {
    if (requestId !== listRequestSeq) return;
    console.error("获取动画列表失败", e);
    const pendingTasks = pendingTasksForScope(scope);
    if (pendingTasks.length) {
      const taskMap = new Map(tasks.value.map(task => [task.taskId, task]));
      pendingTasks.forEach(task => taskMap.set(task.taskId, task));
      tasks.value = [...taskMap.values()];
      if (!polling.value) startPolling();
    }
    listWarning.value = getRequestErrorMessage(e, "动画列表获取失败");
    if (!polling.value) {
      ElMessage.error(getRequestErrorMessage(e, "动画列表获取失败"));
    }
  } finally {
    if (requestId === listRequestSeq) listLoading.value = false;
  }
}

async function refreshReadiness() {
  const scope = currentScope.value;
  if (!scope) return;
  const requestScopeKey = htmlAnimationScopeKey(scope);
  const requestId = ++readinessRequestSeq;
  readinessLoading.value = true;
  readiness.value = null;
  readinessError.value = "";
  try {
    const { data } = await getHtmlAnimationReadiness(scope);
    if (
      requestId !== readinessRequestSeq ||
      requestScopeKey !== currentScopeKey.value
    ) {
      return;
    }
    if (!matchesHtmlAnimationScope(scope, data)) {
      readiness.value = null;
      readinessError.value =
        "内容就绪度返回的课程、章节或课时与当前选择不一致，已停止生成";
      return;
    }
    readiness.value = data;
  } catch (e: any) {
    if (requestId !== readinessRequestSeq) return;
    const code = e?.response?.data?.data?.code || e?.response?.data?.code || "";
    const message = getRequestErrorMessage(e, "内容就绪度检查失败");
    readinessError.value = code ? `${message}（${code}）` : message;
  } finally {
    if (requestId === readinessRequestSeq) readinessLoading.value = false;
  }
}

async function onGenerate() {
  const scope = currentScope.value;
  if (!canGenerate.value || !scope) return;
  if (selectedScopeType.value === "chapter") {
    openBatchDialog();
    return;
  }
  const scopeKey = htmlAnimationScopeKey(scope);
  const idempotencyKey =
    generationIntentKeys.get(scopeKey) ||
    createHtmlAnimationIdempotencyKey(scope);
  generationIntentKeys.set(scopeKey, idempotencyKey);
  submissionFeedback.value = {
    type: "info",
    title: "正在提交动画生成任务",
    description: "请求已发送，请稍候确认任务受理结果。"
  };
  generateLoading.value = true;
  try {
    const { data } = await generateHtmlAnimation({
      ...scope,
      idempotencyKey
    });
    if (!matchesHtmlAnimationScope(scope, data)) {
      throw new Error(
        "生成接口返回的课程、章节或课时与当前选择不一致，已停止跟踪任务"
      );
    }
    generationIntentKeys.delete(scopeKey);
    addPendingTaskHint(scope, data.taskId, data.status);
    if (scopeKey === currentScopeKey.value) {
      tasks.value = mergePendingTaskHints(scope, tasks.value);
      if (!polling.value) startPolling();
    }
    submissionFeedback.value = {
      type: "success",
      title: data.reused ? "已复用现有动画任务" : "动画任务已提交",
      description: data.taskId
        ? `任务 ID：${data.taskId}。任务记录正在同步，页面会自动刷新状态。`
        : "任务已受理，页面会自动刷新状态。"
    };
    ElMessage.success(
      `${data.reused ? "已继续跟踪现有生成任务" : "生成任务已提交"}${
        data.taskId ? `（任务 ${data.taskId}）` : ""
      }`
    );
    if (scopeKey === currentScopeKey.value) await refreshList();
  } catch (e) {
    const message = getRequestErrorMessage(e, "生成任务提交失败");
    submissionFeedback.value = {
      type: "error",
      title: "动画任务提交失败",
      description: message
    };
    ElMessage.error(message);
  } finally {
    generateLoading.value = false;
  }
}

function startPolling() {
  polling.value = true;
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    await refreshList(true);
  }, 5000);
}

function stopPolling() {
  polling.value = false;
  clearInterval(pollTimer);
  pollTimer = null;
}

async function setDisplayLatest() {
  const scope = currentScope.value;
  if (!latestCompletedVersion.value || !scope) return;
  try {
    await setHtmlAnimationDisplay({
      ...scope,
      version: String(latestCompletedVersion.value)
    });
    ElMessage.success("展示版本已设置");
    await refreshList();
  } catch (e) {
    ElMessage.error("设置展示版本失败");
  }
}

async function setDisplay(row: HtmlAnimationTask) {
  const scope = getTaskScope(row);
  if (!isTaskCompleted(row) || !scope) return;
  try {
    await setHtmlAnimationDisplay({
      ...scope,
      version: String(row.version)
    });
    ElMessage.success("展示版本已设置");
    await refreshList();
  } catch (e) {
    ElMessage.error("设置展示版本失败");
  }
}

function canOpenTaskScope(task: HtmlAnimationTask) {
  return selectedScopeType.value === "chapter" && task.scopeType === "hour";
}

async function viewTaskScope(task: HtmlAnimationTask) {
  const scope = getTaskScope(task);
  if (!scope || scope.scopeType !== "hour" || !scope.hourId) return;
  selectedScopeType.value = "hour";
  selectedHourId.value = scope.hourId;
  resetScopeData();
  await refreshScope();
}

function openBatchDialog() {
  if (!canBatchGenerate.value) return;
  const preferredHourIds = selectedHourId.value ? [selectedHourId.value] : [];
  batchHourIds.value = [
    ...preferredHourIds,
    ...hourOptions.value.map(hour => hour.hourId)
  ].filter((hourId, index, values) => values.indexOf(hourId) === index);
  batchResult.value = null;
  batchRetryIntent.value = "";
  batchDialogVisible.value = true;
}

function getHourTitle(hourId?: number) {
  if (!hourId) return "未知课时";
  return (
    hourOptions.value.find(hour => hour.hourId === hourId)?.title ||
    `课时 ${hourId}`
  );
}

function getBatchActionLabel(action: string) {
  const labels: Record<string, string> = {
    accepted: "已受理",
    reused: "已复用",
    rejected: "已拒绝",
    not_submitted: "未提交",
    not_reported: "未返回"
  };
  return labels[action] || action;
}

function getBatchActionType(action: string): "success" | "info" | "danger" {
  if (action === "accepted") return "success";
  if (action === "reused") return "info";
  return "danger";
}

async function viewBatchTask(item: HtmlAnimationBatchResult["items"][number]) {
  const hourId = Number(item.hourId);
  if (
    !hourId ||
    !item.taskId ||
    !["accepted", "reused"].includes(item.action)
  ) {
    return;
  }
  batchDialogVisible.value = false;
  await viewTaskScope({
    taskId: item.taskId,
    scopeType: "hour",
    hourId,
    status: item.status,
    version: 0,
    fileName: "",
    objectName: "",
    fileSize: 0,
    createdAt: "",
    updatedAt: "",
    completedAt: ""
  });
}

async function submitBatchGenerate() {
  if (
    !selectedCourseId.value ||
    !selectedChapterId.value ||
    batchHourIds.value.length < 1
  ) {
    return;
  }

  submissionFeedback.value = {
    type: "info",
    title: "正在提交批量动画任务",
    description: `正在提交 ${batchHourIds.value.length} 个课时，请等待逐项结果。`
  };

  const courseId = selectedCourseId.value;
  const chapterId = selectedChapterId.value;
  const intentId = batchRetryIntent.value || `batch-${Date.now().toString(36)}`;
  batchRetryIntent.value = intentId;
  const scopes = batchHourIds.value.map(hourId => {
    const scope: HtmlAnimationScope = {
      courseId,
      chapterId,
      scopeType: "hour",
      hourId
    };
    return {
      ...scope,
      idempotencyKey: createHtmlAnimationIdempotencyKey(scope, intentId)
    };
  });

  batchLoading.value = true;
  const resultItems: HtmlAnimationBatchResult["items"] = [];
  let requestError: unknown = null;
  try {
    const chunks = chunkHtmlAnimationBatchItems(scopes);
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
      const chunk = chunks[chunkIndex];
      try {
        const { data } = await batchGenerateHtmlAnimation({ requests: chunk });
        const seenHourIds = new Set<number>();
        for (const item of data.items || []) {
          const hourId = Number(item.hourId);
          const expected = chunk.find(scope => scope.hourId === hourId);
          if (
            !expected ||
            seenHourIds.has(hourId) ||
            !matchesHtmlAnimationScope(expected, item)
          ) {
            resultItems.push({
              ...item,
              status: "failed",
              action: "rejected",
              retryable: false,
              errorCode: "SCOPE_MISMATCH",
              errorMessage: "批量响应范围与所选课时不一致"
            });
            continue;
          }
          seenHourIds.add(hourId);
          resultItems.push(item);
        }
        for (const scope of chunk) {
          if (seenHourIds.has(scope.hourId)) continue;
          resultItems.push({
            ...scope,
            status: "not_reported",
            action: "not_reported",
            retryable: true,
            errorCode: "MISSING_BATCH_RESULT",
            errorMessage: "服务端未返回该课时结果，请重试"
          });
        }
      } catch (error) {
        requestError = error;
        const message = getRequestErrorMessage(error, "批次请求未完成");
        for (const scope of chunks.slice(chunkIndex).flat()) {
          if (resultItems.some(item => Number(item.hourId) === scope.hourId)) {
            continue;
          }
          resultItems.push({
            ...scope,
            status: "not_submitted",
            action: "not_submitted",
            retryable: true,
            errorCode: "BATCH_REQUEST_FAILED",
            errorMessage: message
          });
        }
        break;
      }
    }
    const successful = resultItems.filter(item =>
      ["accepted", "reused"].includes(item.action)
    ).length;
    batchResult.value = {
      total: resultItems.length,
      successful,
      failed: resultItems.length - successful,
      items: resultItems
    };
    for (const item of resultItems) {
      if (
        !item.taskId ||
        !item.hourId ||
        !["accepted", "reused"].includes(item.action)
      ) {
        continue;
      }
      addPendingTaskHint(
        {
          courseId,
          chapterId,
          scopeType: "hour",
          hourId: Number(item.hourId)
        },
        item.taskId,
        item.status
      );
    }
    submissionFeedback.value = {
      type: requestError
        ? "error"
        : batchResult.value.failed > 0
          ? "warning"
          : "success",
      title: requestError
        ? "批量动画任务未全部提交"
        : batchResult.value.failed > 0
          ? "批量动画任务已部分受理"
          : "批量动画任务已全部受理",
      description: `${batchSummaryText.value}。任务已汇总显示在下方生成列表，并按课时持续刷新。`
    };
    if (requestError) {
      ElMessage.error(getRequestErrorMessage(requestError, "批量请求未完成"));
    } else {
      batchRetryIntent.value = "";
      if (!isMobile.value) {
        if (
          resultItems.some(
            item => !["accepted", "reused"].includes(item.action)
          )
        ) {
          ElMessage.warning("批量请求已处理，请查看每个课时的结果");
        } else {
          ElMessage.success("批量生成任务已受理");
        }
      }
    }
    const activeScope = currentScope.value;
    if (
      activeScope &&
      activeScope.courseId === courseId &&
      activeScope.chapterId === chapterId
    ) {
      tasks.value = mergePendingTaskHints(activeScope, tasks.value);
      if (tasks.value.some(isTaskProcessing) && !polling.value) {
        startPolling();
      }
      await refreshList();
    }
  } catch (error) {
    const message = getRequestErrorMessage(error, "批量生成请求失败");
    batchResult.value = {
      total: scopes.length,
      successful: 0,
      failed: scopes.length,
      items: scopes.map(scope => ({
        ...scope,
        status: "not_submitted",
        action: "not_submitted",
        retryable: true,
        errorCode: "BATCH_REQUEST_FAILED",
        errorMessage: message
      }))
    };
    submissionFeedback.value = {
      type: "error",
      title: "批量动画任务提交失败",
      description: message
    };
    ElMessage.error(message);
  } finally {
    batchLoading.value = false;
  }
}

async function onForceSync() {
  syncLoading.value = true;
  try {
    const { data } = await forceSyncHtmlAnimation();
    ElMessage.success(
      `同步完成: ${data.successChapters}/${data.totalChapters}`
    );
    await refreshScope();
  } catch (e) {
    ElMessage.error("强制同步失败");
  } finally {
    syncLoading.value = false;
  }
}

function isDisplayVersion(row: HtmlAnimationTask) {
  if (!isTaskCompleted(row) || !row.version) return false;
  const scope = getTaskScope(row);
  if (!scope) return false;
  const display = displayVersionsByScope.get(htmlAnimationScopeKey(scope));
  if (!display) return false;
  if (display.raw === "latest") {
    return String(row.version) === display.resolved;
  }
  return String(row.version) === display.raw;
}

function openPreview(row: HtmlAnimationTask) {
  if (!isTaskCompleted(row)) return;
  previewUrl.value = buildFileUrl(row);
  previewVisible.value = true;
}

function buildFileUrl(row: HtmlAnimationTask) {
  // 优先使用后端直接返回的 fileUrl（完整URL）
  if ((row as any).fileUrl) return (row as any).fileUrl as string;
  if (row.fileName && row.fileName.startsWith("http")) return row.fileName;
  if (row.objectName && row.objectName.startsWith("http"))
    return row.objectName;
  return row.fileName || row.objectName || "";
}

function openInNewWindow() {
  if (previewUrl.value) window.open(previewUrl.value, "_blank");
}

async function copyUrl(row: HtmlAnimationTask) {
  const url = buildFileUrl(row);
  if (!url) {
    ElMessage.warning("无可复制URL");
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    ElMessage.success("已复制");
  } catch (e) {
    ElMessage.error("复制失败");
  }
}

function formatSize(size: number) {
  if (!size) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let idx = 0;
  let val = size;
  while (val > 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return val.toFixed(idx === 0 ? 0 : 2) + units[idx];
}

function truncate(str: string, len: number) {
  if (!str) return "";
  return str.length > len ? str.slice(0, len) + "…" : str;
}

function rowClassName({ row }: { row: HtmlAnimationTask }) {
  if (isDisplayVersion(row)) return "row-display";
  if (isTaskFailed(row)) return "row-failed";
  return "";
}

onMounted(() => {
  updateCompactLayout();
  window.addEventListener("resize", updateCompactLayout);
  preloadCourses();
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", updateCompactLayout);
  stopPolling();
  pendingTaskHints.clear();
});
</script>

<style scoped lang="scss">
// 淡入动画
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.ai-animation-page {
  margin: 10px;
}

.scope-segmented {
  display: flex;
  width: 100%;

  :deep(.el-radio-button) {
    flex: 1;
  }

  :deep(.el-radio-button__inner) {
    width: 100%;
  }
}

.scope-readiness-wrap {
  padding: 16px 24px 0;
}

.task-error-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
  color: var(--el-color-danger);

  small {
    color: var(--el-text-color-secondary);
  }
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.selectors {
  display: flex;
  align-items: center;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.display-info {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.display-info .divider {
  display: inline-block;
  width: 1px;
  height: 14px;
  background: var(--el-border-color);
}

.polling-indicator {
  color: var(--el-color-primary-light-3);
}

.empty-block {
  padding: 60px 0;
}

.filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 10px 0 14px;
}

.preview-wrapper {
  height: 70vh;
}

.preview-iframe {
  width: 100%;
  height: 100%;
  border: 1px solid var(--el-border-color-light);
  border-radius: var(--el-border-radius-base);
}

.error-text {
  color: var(--el-color-danger);
  cursor: help;
}

// 表格行样式
:deep(.animation-table .el-table__body tr.row-display > td) {
  background: var(--el-color-success-light-9) !important;
}

:deep(.animation-table .el-table__body tr.row-display:hover > td) {
  background: var(--el-color-success-light-8) !important;
}

:deep(.animation-table .el-table__body tr.row-failed > td) {
  background: var(--el-color-danger-light-9) !important;
}

:deep(.animation-table .el-table__body tr.row-failed:hover > td) {
  background: var(--el-color-danger-light-8) !important;
}

:deep(
  .animation-table
    .el-table__body
    tr:not(.row-display):not(.row-failed):hover
    > td
) {
  background: var(--el-fill-color-lighter) !important;
}

// 表格美化
.animation-table {
  :deep(.el-table__inner-wrapper) {
    overflow: hidden;
    border-radius: 12px;
  }

  :deep(.el-table__header-wrapper) {
    th {
      border-bottom: none !important;
    }
  }

  :deep(.el-table__body-wrapper) {
    tr {
      transition: all 0.2s ease;

      td {
        padding: 12px 0;
        border-bottom: 1px solid var(--el-border-color-lighter) !important;
      }

      &:last-child td {
        border-bottom: none !important;
      }
    }
  }
}

// 筛选按钮组美化
.animation-filter-group {
  :deep(.el-radio-button__inner) {
    padding: 6px 14px;
    margin-right: 6px;
    font-weight: 500;
    font-size: 13px;
    border: 1px solid var(--el-border-color-lighter) !important;
    border-radius: 20px !important;
    background: var(--el-bg-color) !important;
    color: var(--el-text-color-regular);
    transition: all 0.2s ease;

    &:hover {
      color: var(--el-color-primary);
      border-color: var(--el-color-primary-light-5) !important;
    }
  }

  :deep(.el-radio-button:first-child .el-radio-button__inner) {
    border-left: 1px solid var(--el-border-color-lighter) !important;
    border-radius: 20px !important;
  }

  :deep(.el-radio-button:last-child .el-radio-button__inner) {
    border-radius: 20px !important;
  }

  :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
    color: #fff !important;
    background: var(--el-color-primary) !important;
    border-color: var(--el-color-primary) !important;
    box-shadow: 0 2px 8px rgba(var(--el-color-primary-rgb), 0.3) !important;
  }
}

.content-toolbar--compact,
.filter-toolbar--compact {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 14px;
}

.toolbar-actions--compact {
  width: 100%;
  justify-content: stretch;
}

.toolbar-actions--compact :deep(.el-button) {
  flex: 1;
  min-width: 0;
}

.animation-filter-group--compact {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 12px;
  width: 100%;

  :deep(.el-radio-button) {
    width: 100%;
  }

  :deep(.el-radio-button__inner) {
    width: 100%;
    margin-right: 0;
    padding: 10px 14px;
    text-align: center;
  }
}

// 状态面板动效
// 状态面板动效
.status-panel {
  .status-item {
    &:hover {
      span:first-child {
        transform: scale(1.3);
      }

      span:last-child {
        transform: scale(1.1);
      }
    }
  }
}

// 表格行动效增强
.animation-table {
  :deep(.el-table__body-wrapper) {
    tr {
      transition: background-color 0.2s ease;

      &:hover {
        position: relative;
        z-index: 1;
      }
    }
  }

  :deep(.el-button) {
    transition: all 0.2s ease;

    &:hover:not(:disabled) {
      box-shadow: 0 4px 12px rgb(0 0 0 / 15%);
      transform: translateY(-2px);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }
  }
}

// 侧边栏卡片动效
.sidebar-card {
  .header-section:hover .icon-box {
    transform: rotate(-5deg) scale(1.05);
  }

  // 标题与副标题间距
  .header-subtitle {
    margin-top: 8px !important;
  }
}

// 输入框聚焦动效
:deep(.el-select),
:deep(.el-input) {
  .el-input__wrapper {
    transition: all 0.25s ease;

    &:hover {
      box-shadow: 0 0 0 1px var(--el-color-primary-light-5) inset;
    }

    &.is-focus {
      box-shadow:
        0 0 0 1px var(--el-color-primary) inset,
        0 4px 12px var(--el-color-primary-light-8);
      transform: translateY(-1px);
    }
  }
}

// 自定义滚动条
.custom-scrollbar {
  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--el-border-color);
    border-radius: 3px;
    transition: background 0.2s ease;

    &:hover {
      background: var(--el-border-color-darker);
    }
  }
}

.status-panel {
  animation: fadeInUp 0.4s ease-out;
}

// Lottie 毛玻璃光效容器
.lottie-glass {
  position: relative;
  width: 240px;
  height: 240px;
  border-radius: 2rem;
  background: rgb(255 255 255 / 45%);
  backdrop-filter: blur(20px) saturate(1.6);
  box-shadow:
    0 8px 32px rgba(var(--el-color-primary-rgb), 0.12),
    inset 0 0 0 1px rgb(255 255 255 / 40%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;

  // 将 Lottie 动画色相旋转到平台主色蓝
  :deep(div) {
    filter: hue-rotate(160deg) saturate(0.85) brightness(0.88);
  }

  // 四角光效
  &::before {
    content: "";
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    padding: 1.5px;
    background: linear-gradient(
      135deg,
      rgba(var(--el-color-primary-rgb), 0.5),
      transparent 40%,
      transparent 60%,
      rgba(var(--el-color-primary-rgb), 0.35)
    );
    mask:
      linear-gradient(#fff 0 0) content-box,
      linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
  }

  // 顶部高光
  &::after {
    content: "";
    position: absolute;
    top: -30%;
    left: 10%;
    width: 80%;
    height: 60%;
    background: radial-gradient(
      ellipse,
      rgb(255 255 255 / 30%) 0%,
      transparent 70%
    );
    border-radius: 50%;
    pointer-events: none;
  }

  &:hover {
    transform: scale(1.04);
    box-shadow:
      0 12px 40px rgba(var(--el-color-primary-rgb), 0.18),
      inset 0 0 0 1px rgb(255 255 255 / 50%);
  }

  html.dark & {
    background: rgb(30 30 40 / 50%);
    box-shadow:
      0 8px 32px rgba(var(--el-color-primary-rgb), 0.15),
      inset 0 0 0 1px rgb(255 255 255 / 8%);

    &::before {
      background: linear-gradient(
        135deg,
        rgba(var(--el-color-primary-rgb), 0.35),
        transparent 40%,
        transparent 60%,
        rgba(var(--el-color-primary-rgb), 0.25)
      );
    }

    &::after {
      background: radial-gradient(
        ellipse,
        rgb(255 255 255 / 8%) 0%,
        transparent 70%
      );
    }

    &:hover {
      box-shadow:
        0 12px 40px rgba(var(--el-color-primary-rgb), 0.22),
        inset 0 0 0 1px rgb(255 255 255 / 12%);
    }
  }
}

.mobile-animation-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mobile-animation-card {
  padding: 16px;
  background: var(--el-fill-color-extra-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 16px;
}

.mobile-animation-card__header,
.mobile-animation-card__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.mobile-animation-card__header {
  margin-bottom: 12px;
}

.mobile-animation-card__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mobile-animation-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 12px;
}

.mobile-animation-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  word-break: break-word;
}

.mobile-animation-field .label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.mobile-animation-card__actions {
  margin-top: 14px;
  justify-content: stretch;
  flex-wrap: nowrap;
  align-items: stretch;
}

.mobile-animation-action-btn {
  flex: 1;
  min-width: 0;
  height: 44px;
  margin: 0 !important;
  padding: 0 12px !important;
  font-size: 14px;
  font-weight: 600;
}

.mobile-animation-action-btn :deep(span) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  line-height: 1;
}

.batch-result-list {
  display: grid;
  gap: 10px;
  max-height: calc(100vh - 300px);
  overflow-y: auto;
}

.batch-result-card {
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-bg-color);
}

.batch-result-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.batch-result-card__title {
  min-width: 0;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.batch-result-card__details {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 8px 12px;
  margin-top: 12px;
  font-size: 13px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.batch-result-card__label {
  color: var(--el-text-color-secondary);
}

@media (width <= 768px) {
  .ai-animation-container.is-mobile-layout {
    height: auto;
    min-height: calc(100vh - 96px);
    margin: 8px;
    overflow: visible;
    flex-direction: column;
  }

  .ai-animation-container.is-mobile-layout .sidebar-card {
    width: 100%;
  }

  .ai-animation-container.is-mobile-layout .header-subtitle {
    margin-left: 0 !important;
  }

  .ai-animation-container.is-mobile-layout .content-toolbar,
  .ai-animation-container.is-mobile-layout .filter-toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .ai-animation-container.is-mobile-layout .toolbar-status,
  .ai-animation-container.is-mobile-layout .toolbar-actions {
    width: 100%;
    flex-wrap: wrap;
    gap: 10px;
  }

  .ai-animation-container.is-mobile-layout .toolbar-actions :deep(.el-button) {
    flex: 1 1 calc(50% - 8px);
    min-width: 0;
    min-height: 44px;
  }

  :deep(.batch-generation-dialog .el-dialog__footer .el-button) {
    min-height: 44px;
  }

  .ai-animation-container.is-mobile-layout .filter-keyword {
    width: 100% !important;
  }

  .ai-animation-container.is-mobile-layout .animation-filter-group {
    width: 100%;
    overflow-x: auto;
  }

  .mobile-animation-grid {
    grid-template-columns: 1fr;
  }

  .lottie-glass {
    width: 180px;
    height: 180px;
  }
}
</style>
