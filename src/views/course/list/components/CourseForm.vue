<template>
  <el-form
    ref="formRef"
    v-loading="loading"
    :model="formData"
    :rules="formRules"
    :scroll-to-error="true"
    label-width="100px"
  >
    <el-form-item label="课程标题" prop="title">
      <el-input v-model="formData.title" placeholder="请输入课程标题" />
    </el-form-item>

    <el-form-item label="课程简介" prop="shortDesc">
      <el-input
        v-model="formData.shortDesc"
        type="textarea"
        :rows="4"
        placeholder="请输入课程简介"
      />
    </el-form-item>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-form-item label="是否必修" prop="isRequired">
          <el-radio-group v-model="formData.isRequired">
            <el-radio :value="1">必修</el-radio>
            <el-radio :value="0">选修</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-col>
      <el-col v-if="!isEdit" :span="12">
        <el-form-item label="是否章节" prop="isChapter">
          <el-radio-group v-model="formData.isChapter">
            <el-radio :value="1">是</el-radio>
            <el-radio :value="0">否</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-col>
    </el-row>

    <el-form-item label="课程封面" prop="thumb_url">
      <div class="upload-box">
        <div v-if="formData.thumb_url" class="upload-preview">
          <el-image
            style="width: 200px; height: 120px"
            :src="formData.thumb_url"
            fit="cover"
          />
          <div class="upload-actions">
            <el-button type="danger" size="small" @click="removeCover"
              >移除</el-button
            >
          </div>
        </div>
        <div
          v-else-if="coverUploadState.isUploading"
          class="uploading-overlay static"
          style="width: 320px"
        >
          <div class="upload-progress-card">
            <div class="upload-progress-header">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span class="upload-progress-title">封面上传中...</span>
              <span class="upload-progress-percent"
                >{{ coverUploadState.uploadProgress || 0 }}%</span
              >
            </div>
            <el-progress
              :percentage="coverUploadState.uploadProgress || 0"
              :stroke-width="8"
              :show-text="false"
              status="success"
            />
            <div class="upload-progress-meta">
              <span>
                已上传
                <strong>{{
                  formatBytes(coverUploadState.uploadLoaded || 0)
                }}</strong>
                / {{ formatBytes(coverUploadState.uploadTotal || 0) }}
              </span>
              <span>
                速度
                <strong
                  >{{
                    formatBytes(coverUploadState.uploadSpeed || 0)
                  }}/s</strong
                >
              </span>
              <span>
                预计剩余
                <strong>{{ formatEta(coverUploadState.uploadEta) }}</strong>
              </span>
            </div>
          </div>
        </div>
        <el-upload
          v-else
          class="upload-trigger"
          action="#"
          :auto-upload="false"
          :show-file-list="false"
          :on-change="handleCoverUpload"
        >
          <div class="upload-icon-container">
            <el-icon><Plus /></el-icon>
          </div>
        </el-upload>
      </div>
    </el-form-item>

    <el-form-item label="课程分类" prop="categoryIds">
      <el-checkbox-group v-model="formData.categoryIds">
        <el-checkbox
          v-for="category in categoryOptions"
          :key="category.categoryId"
          :label="category.categoryId"
        >
          {{ category.name }}
        </el-checkbox>
      </el-checkbox-group>
    </el-form-item>

    <el-form-item label="结束时间" prop="endingTime">
      <el-date-picker
        v-model="formData.endingTime"
        type="datetime"
        placeholder="选择结束时间"
        value-format="YYYY-MM-DD HH:mm:ss"
      />
    </el-form-item>

    <!-- 章节和课时，仅在创建模式且选择"有章节"时显示 -->
    <div v-if="!isEdit && formData.isChapter === 1" class="form-section">
      <div class="section-header">
        <h3>章节与课时</h3>
        <div>
          <el-button type="primary" @click="addChapter">添加章节</el-button>
        </div>
      </div>

      <!-- 章节列表内容 -->
      <div v-if="formData.chapterList.length === 0" class="empty-placeholder">
        尚未添加章节，请点击"添加章节"按钮添加
      </div>
      <el-collapse v-else v-model="activeChapters">
        <el-collapse-item
          v-for="(chapter, chapterIndex) in formData.chapterList"
          :key="'chapter-' + chapterIndex"
          :name="chapterIndex"
        >
          <template #title>
            <div class="chapter-header">
              <span
                >{{ chapter.name || "未命名章节" }}
                <span class="required-mark">*</span></span
              >
              <div class="chapter-actions">
                <el-button
                  type="danger"
                  size="small"
                  @click.stop="removeChapter(chapterIndex)"
                  >删除章节</el-button
                >
              </div>
            </div>
          </template>
          <div class="chapter-content">
            <el-form-item
              :label="'章节名称'"
              :prop="'chapterList.' + chapterIndex + '.name'"
              :rules="[
                { required: true, message: '请输入章节名称', trigger: 'blur' }
              ]"
            >
              <div class="input-with-actions">
                <el-input v-model="chapter.name" placeholder="请输入章节名称" />
              </div>
            </el-form-item>

            <div class="hour-list-header">
              <h4>课时列表</h4>
              <el-button
                type="primary"
                size="small"
                @click="addHourToChapter(chapterIndex)"
                >添加课时</el-button
              >
            </div>

            <div v-if="chapter.hourList.length === 0" class="empty-placeholder">
              尚未添加课时，点击"添加课时"按钮添加
            </div>
            <div v-else class="hour-list">
              <el-collapse v-model="activeHours[chapterIndex]">
                <el-collapse-item
                  v-for="(hour, hourIndex) in chapter.hourList"
                  :key="'hour-' + chapterIndex + '-' + hourIndex"
                  :name="hourIndex"
                >
                  <template #title>
                    <div class="hour-header">
                      <span
                        >{{ hour.title || "未命名课时" }}
                        <span class="required-mark">*</span></span
                      >
                      <div class="hour-title-actions">
                        <el-button
                          type="danger"
                          size="small"
                          @click.stop="
                            removeHourFromChapter(chapterIndex, hourIndex)
                          "
                          >删除课时</el-button
                        >
                      </div>
                    </div>
                  </template>
                  <div class="hour-content">
                    <div class="hour-card">
                      <el-row :gutter="20">
                        <el-col :span="24">
                          <!-- 课时标题不需要手动输入，由系统根据文件名自动填写 -->
                          <el-form-item :label="'课时标题'">
                            <el-input
                              v-model="hour.title"
                              placeholder="将使用上传的文件名"
                              disabled
                            />
                          </el-form-item>
                        </el-col>
                      </el-row>

                      <el-row :gutter="20">
                        <el-col :span="24">
                          <el-form-item
                            :label="'时长(秒)'"
                            :prop="
                              'chapterList.' +
                              chapterIndex +
                              '.hourList.' +
                              hourIndex +
                              '.duration'
                            "
                          >
                            <el-input-number
                              v-model="hour.duration"
                              :min="0"
                              :step="1"
                              disabled
                              placeholder="上传视频后自动获取"
                            />
                          </el-form-item>
                        </el-col>
                      </el-row>

                      <el-form-item
                        :label="'课时资源'"
                        :prop="
                          'chapterList.' +
                          chapterIndex +
                          '.hourList.' +
                          hourIndex +
                          '.resourceId'
                        "
                        :rules="[
                          {
                            required: true,
                            type: 'number',
                            min: 1,
                            message: '请上传视频资源',
                            trigger: 'change'
                          }
                        ]"
                      >
                        <div class="upload-with-preview">
                          <div v-if="hour.fileUrl" class="resource-preview">
                            <div class="resource-info">
                              <i class="el-icon-video-camera" />
                              <span class="resource-name">{{
                                hour.originalFileName ||
                                getFileName(hour.fileUrl)
                              }}</span>
                            </div>
                            <div class="resource-actions">
                              <el-button
                                size="small"
                                @click="previewResource(hour.fileUrl)"
                                >预览</el-button
                              >
                              <el-button
                                size="small"
                                type="danger"
                                @click="
                                  removeResource(chapter.hourList, hourIndex)
                                "
                                >移除</el-button
                              >
                            </div>
                          </div>
                          <div
                            v-if="hour.isUploading"
                            class="uploading-overlay"
                          >
                            <div class="upload-progress-card">
                              <div class="upload-progress-header">
                                <el-icon class="is-loading">
                                  <Loading />
                                </el-icon>
                                <span class="upload-progress-title"
                                  >上传中...</span
                                >
                                <span class="upload-progress-percent"
                                  >{{ hour.uploadProgress || 0 }}%</span
                                >
                              </div>
                              <el-progress
                                :percentage="hour.uploadProgress || 0"
                                :stroke-width="8"
                                :show-text="false"
                                status="success"
                              />
                              <div class="upload-progress-meta">
                                <span>
                                  已上传
                                  <strong>{{
                                    formatBytes(hour.uploadLoaded || 0)
                                  }}</strong>
                                  /
                                  {{ formatBytes(hour.uploadTotal || 0) }}
                                </span>
                                <span>
                                  速度
                                  <strong
                                    >{{
                                      formatBytes(hour.uploadSpeed || 0)
                                    }}/s</strong
                                  >
                                </span>
                                <span>
                                  预计剩余
                                  <strong>{{
                                    formatEta(hour.uploadEta)
                                  }}</strong>
                                </span>
                              </div>
                            </div>
                          </div>
                          <el-upload
                            v-if="!hour.isUploading && !hour.fileUrl"
                            class="resource-upload"
                            action="#"
                            :auto-upload="false"
                            :show-file-list="false"
                            :accept="'.mp4,.webm,.ogg'"
                            :on-change="
                              file => {
                                chapter.hourList[hourIndex].isUploading = true;
                                handleResourceUpload(
                                  file,
                                  chapter.hourList,
                                  hourIndex
                                );
                              }
                            "
                          >
                            <div class="upload-icon-container">
                              <el-icon><Plus /></el-icon>
                              <p class="upload-tip">点击上传课时视频</p>
                            </div>
                          </el-upload>
                        </div>
                      </el-form-item>
                    </div>
                  </div>
                </el-collapse-item>
              </el-collapse>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>
    </div>

    <!-- 课时列表，仅在创建模式且选择"无章节"时显示 -->
    <div v-if="!isEdit && formData.isChapter === 0" class="form-section">
      <div class="section-header">
        <h3>课时列表</h3>
        <div>
          <el-button type="primary" @click="addHour">添加课时</el-button>
        </div>
      </div>

      <!-- 课时列表内容 -->
      <div v-if="formData.hourList.length === 0" class="empty-placeholder">
        尚未添加课时，点击"添加课时"按钮添加
      </div>
      <div v-else class="hour-list">
        <el-collapse v-model="activeHours.standalone">
          <el-collapse-item
            v-for="(hour, hourIndex) in formData.hourList"
            :key="'hour-' + hourIndex"
            :name="hourIndex"
          >
            <template #title>
              <div class="hour-header">
                <span
                  >{{ hour.title || "未命名课时" }}
                  <span class="required-mark">*</span></span
                >
                <div class="hour-title-actions">
                  <el-button
                    type="danger"
                    size="small"
                    @click.stop="removeHour(hourIndex)"
                    >删除课时</el-button
                  >
                </div>
              </div>
            </template>
            <div class="hour-content">
              <div class="hour-card">
                <el-row :gutter="20">
                  <el-col :span="24">
                    <!-- 课时标题不需要手动输入，由系统根据文件名自动填写 -->
                    <el-form-item :label="'课时标题'">
                      <el-input
                        v-model="hour.title"
                        placeholder="将使用上传的文件名"
                        disabled
                      />
                    </el-form-item>
                  </el-col>
                </el-row>

                <el-row :gutter="20">
                  <el-col :span="24">
                    <el-form-item
                      :label="'时长(秒)'"
                      :prop="'hourList.' + hourIndex + '.duration'"
                    >
                      <el-input-number
                        v-model="hour.duration"
                        :min="0"
                        :step="1"
                        disabled
                        placeholder="上传视频后自动获取"
                      />
                    </el-form-item>
                  </el-col>
                </el-row>

                <el-form-item
                  :label="'课时资源'"
                  :prop="'hourList.' + hourIndex + '.resourceId'"
                  :rules="[
                    {
                      required: true,
                      type: 'number',
                      min: 1,
                      message: '请上传视频资源',
                      trigger: 'change'
                    }
                  ]"
                >
                  <div class="upload-with-preview">
                    <div v-if="hour.fileUrl" class="resource-preview">
                      <div class="resource-info">
                        <i class="el-icon-video-camera" />
                        <span class="resource-name">{{
                          hour.originalFileName || getFileName(hour.fileUrl)
                        }}</span>
                      </div>
                      <div class="resource-actions">
                        <el-button
                          size="small"
                          @click="previewResource(hour.fileUrl)"
                          >预览</el-button
                        >
                        <el-button
                          size="small"
                          type="danger"
                          @click="removeResource(formData.hourList, hourIndex)"
                          >移除</el-button
                        >
                      </div>
                    </div>
                    <div v-if="hour.isUploading" class="uploading-overlay">
                      <div class="upload-progress-card">
                        <div class="upload-progress-header">
                          <el-icon class="is-loading"><Loading /></el-icon>
                          <span class="upload-progress-title">上传中...</span>
                          <span class="upload-progress-percent"
                            >{{ hour.uploadProgress || 0 }}%</span
                          >
                        </div>
                        <el-progress
                          :percentage="hour.uploadProgress || 0"
                          :stroke-width="8"
                          :show-text="false"
                          status="success"
                        />
                        <div class="upload-progress-meta">
                          <span>
                            已上传
                            <strong>{{
                              formatBytes(hour.uploadLoaded || 0)
                            }}</strong>
                            / {{ formatBytes(hour.uploadTotal || 0) }}
                          </span>
                          <span>
                            速度
                            <strong
                              >{{
                                formatBytes(hour.uploadSpeed || 0)
                              }}/s</strong
                            >
                          </span>
                          <span>
                            预计剩余
                            <strong>{{ formatEta(hour.uploadEta) }}</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                    <el-upload
                      v-if="!hour.isUploading && !hour.fileUrl"
                      class="resource-upload"
                      action="#"
                      :auto-upload="false"
                      :show-file-list="false"
                      :accept="'.mp4,.webm,.ogg'"
                      :on-change="
                        file => {
                          formData.hourList[hourIndex].isUploading = true;
                          handleResourceUpload(
                            file,
                            formData.hourList,
                            hourIndex
                          );
                        }
                      "
                    >
                      <div class="upload-icon-container">
                        <el-icon><Plus /></el-icon>
                        <p class="upload-tip">点击上传课时视频</p>
                      </div>
                    </el-upload>
                  </div>
                </el-form-item>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>

    <!-- 附件资源，仅在创建模式下显示 -->
    <div v-if="!isEdit" class="form-section">
      <div class="section-header">
        <h3>附件资源</h3>
        <div>
          <el-button type="primary" @click="addAttr">添加附件</el-button>
        </div>
      </div>

      <div v-if="formData.attrList.length === 0" class="empty-placeholder">
        尚未添加附件，点击"添加附件"按钮添加
      </div>
      <div v-else class="attr-list">
        <div
          v-for="(attr, attrIndex) in formData.attrList"
          :key="'attr-' + attrIndex"
          class="attr-item"
        >
          <div class="attr-card">
            <el-row :gutter="20">
              <el-col :span="24">
                <el-form-item
                  :label="'附件标题'"
                  :prop="'attrList.' + attrIndex + '.title'"
                >
                  <el-input v-model="attr.title" placeholder="请输入附件标题" />
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="20">
              <el-col :span="24">
                <el-form-item
                  :label="'资源类型'"
                  :prop="'attrList.' + attrIndex + '.rType'"
                >
                  <el-select v-model="attr.rType" placeholder="请选择资源类型">
                    <el-option label="文档" value="document" />
                    <el-option label="图片" value="image" />
                    <el-option label="其他" value="other" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item
              :label="'附件资源'"
              :prop="'attrList.' + attrIndex + '.resourceId'"
            >
              <div class="upload-with-preview">
                <div v-if="attr.fileUrl" class="resource-preview">
                  <div class="resource-info">
                    <i class="el-icon-document" />
                    <span class="resource-name">{{
                      attr.originalFileName || getFileName(attr.fileUrl)
                    }}</span>
                  </div>
                  <div class="resource-actions">
                    <el-button
                      size="small"
                      @click="previewResource(attr.fileUrl)"
                      >预览</el-button
                    >
                    <el-button
                      size="small"
                      type="danger"
                      @click="removeAttrResource(attrIndex)"
                      >移除</el-button
                    >
                  </div>
                </div>
                <el-upload
                  v-if="!attr.fileUrl && !attr.isUploading"
                  class="resource-upload"
                  action="#"
                  :auto-upload="false"
                  :show-file-list="false"
                  :on-change="file => handleAttrUpload(file, attrIndex)"
                >
                  <div class="upload-icon-container">
                    <el-icon><Plus /></el-icon>
                  </div>
                </el-upload>
                <div v-if="attr.isUploading" class="uploading-overlay static">
                  <div class="upload-progress-card">
                    <div class="upload-progress-header">
                      <el-icon class="is-loading"><Loading /></el-icon>
                      <span class="upload-progress-title">上传中...</span>
                      <span class="upload-progress-percent"
                        >{{ attr.uploadProgress || 0 }}%</span
                      >
                    </div>
                    <el-progress
                      :percentage="attr.uploadProgress || 0"
                      :stroke-width="8"
                      :show-text="false"
                      status="success"
                    />
                    <div class="upload-progress-meta">
                      <span>
                        已上传
                        <strong>{{
                          formatBytes(attr.uploadLoaded || 0)
                        }}</strong>
                        / {{ formatBytes(attr.uploadTotal || 0) }}
                      </span>
                      <span>
                        速度
                        <strong
                          >{{ formatBytes(attr.uploadSpeed || 0) }}/s</strong
                        >
                      </span>
                      <span>
                        预计剩余
                        <strong>{{ formatEta(attr.uploadEta) }}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </el-form-item>

            <div class="attr-actions">
              <el-button
                type="danger"
                size="small"
                @click="removeAttr(attrIndex)"
                >删除附件</el-button
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  </el-form>
</template>

<script lang="ts" setup>
import { ref, reactive, watch, onMounted, nextTick } from "vue";
import { ElMessage } from "element-plus";
import COS from "cos-js-sdk-v5";
import { completeStsUpload, initStsUpload } from "@/api/user";
import { getCategoryList } from "@/api/category";
import { Plus, Loading } from "@element-plus/icons-vue";
import { openPlatformUrl } from "@/utils/platformCapability";

const props = defineProps({
  modelValue: {
    type: Object,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  isEdit: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(["update:modelValue", "submit"]);

const formRef = ref();
const lastInvalidFields = ref<Record<string, unknown> | null>(null);

// 定义课时折叠状态管理的类型
interface HoursActiveState {
  [key: string]: number[];
  standalone: number[];
}

const activeChapters = ref([0]); // 默认展开第一个章节
const activeHours = ref<HoursActiveState>({ standalone: [] }); // 课时折叠状态管理，初始化带有standalone属性
const formData = reactive({ ...props.modelValue });

// 表单验证规则
const formRules = {
  title: [{ required: true, message: "请输入课程标题", trigger: "blur" }],
  shortDesc: [{ required: true, message: "请输入课程简介", trigger: "blur" }],
  thumb_url: [
    {
      required: true,
      message: "请上传课程封面",
      trigger: "change"
    }
  ],
  categoryIds: [
    {
      required: true,
      type: "array" as const,
      min: 1,
      message: "请选择课程分类",
      trigger: "change"
    }
  ],
  endingTime: [
    { required: true, message: "请选择结束时间", trigger: "change" }
  ],
  // 章节名称验证规则
  "chapterList.0.name": [
    { required: true, message: "请输入章节名称", trigger: "blur" }
  ],
  // 课时标题验证规则
  "hourList.0.title": [
    { required: true, message: "请输入课时标题", trigger: "blur" }
  ]
};

// 分类选项
const categoryOptions = ref([]);
const loadCategories = async () => {
  try {
    const res = await getCategoryList({ pageNum: 1, pageSize: 100 });
    console.log("分类数据:", res);

    // 修正：从res.data中获取categoryList
    if (res && res.data && res.data.categoryList) {
      categoryOptions.value = res.data.categoryList;
      console.log("成功加载分类数据:", categoryOptions.value);
    } else {
      console.warn("无法从API响应中获取分类数据");
      categoryOptions.value = []; // 设置为空数组，没有就显示空
    }
  } catch (error) {
    console.error("获取分类列表失败:", error);
    ElMessage.error("获取分类列表失败");
    categoryOptions.value = []; // 异常情况下也设置为空数组
  }
};

// 监听属性变化
watch(
  () => props.modelValue,
  newVal => {
    Object.assign(formData, newVal);
  },
  { deep: true }
);

// 将表单数据同步回父组件
watch(
  formData,
  newVal => {
    emit("update:modelValue", newVal);
  },
  { deep: true }
);

const getCurrentCourseId = () => {
  const courseId = Number(formData.courseId || 0);
  return Number.isFinite(courseId) && courseId > 0 ? courseId : undefined;
};

// 上传进度相关：格式化字节、剩余时间，以及创建带速度/ETA 的进度回调
const formatBytes = (bytes: number) => {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    units.length - 1
  );
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
};

const formatEta = (seconds: number) => {
  if (!isFinite(seconds) || seconds < 0) return "--";
  const total = Math.ceil(seconds);
  if (total < 60) return `${total} 秒`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m < 60) return `${m} 分 ${s} 秒`;
  const h = Math.floor(m / 60);
  return `${h} 小时 ${m % 60} 分`;
};

const createProgressTracker = (target: any) => {
  target.uploadProgress = 0;
  target.uploadLoaded = 0;
  target.uploadTotal = 0;
  target.uploadSpeed = 0;
  target.uploadEta = Infinity;
  const startTime = Date.now();
  let lastTime = startTime;
  let lastLoaded = 0;
  return (loaded: number, total: number) => {
    target.uploadLoaded = loaded;
    target.uploadTotal = total;
    target.uploadProgress = total > 0 ? Math.floor((loaded / total) * 100) : 0;
    const now = Date.now();
    const dt = (now - lastTime) / 1000;
    if (dt >= 0.3 || loaded === total) {
      const instantSpeed = dt > 0 ? (loaded - lastLoaded) / dt : 0;
      const elapsed = (now - startTime) / 1000;
      const avgSpeed = elapsed > 0 ? loaded / elapsed : 0;
      // 平滑：取瞬时和平均的加权
      target.uploadSpeed = instantSpeed * 0.6 + avgSpeed * 0.4;
      target.uploadEta =
        target.uploadSpeed > 0
          ? (total - loaded) / target.uploadSpeed
          : Infinity;
      lastTime = now;
      lastLoaded = loaded;
    }
  };
};

const resetProgressTracker = (target: any) => {
  target.uploadProgress = 0;
  target.uploadLoaded = 0;
  target.uploadTotal = 0;
  target.uploadSpeed = 0;
  target.uploadEta = Infinity;
};

const uploadWithSts = async (
  rawFile: File,
  bizType = "resource_upload",
  onProgress?: (loaded: number, total: number) => void
) => {
  const pickField = (obj: any, keys: string[]) => {
    if (!obj) return undefined;
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
        return obj[key];
      }
    }
    return undefined;
  };

  const initRes = await initStsUpload({
    biz_type: bizType,
    file_name: rawFile.name,
    content_type: rawFile.type || "application/octet-stream",
    file_size: rawFile.size,
    course_id: getCurrentCourseId()
  });

  const initData: any = initRes?.data || {};
  const uploadToken = pickField(initData, ["upload_token", "uploadToken"]);
  const uploadUrl = pickField(initData, [
    "upload_url",
    "uploadUrl",
    "uploadURL"
  ]);
  const credentials =
    initData.credentials ||
    initData.credential ||
    initData.tmpCredentials ||
    {};
  const tmpSecretId = pickField(credentials, [
    "tmp_secret_id",
    "tmpSecretId",
    "TmpSecretId",
    "secretId",
    "SecretId"
  ]);
  const tmpSecretKey = pickField(credentials, [
    "tmp_secret_key",
    "tmpSecretKey",
    "TmpSecretKey",
    "secretKey",
    "SecretKey"
  ]);
  const securityToken = pickField(credentials, [
    "security_token",
    "securityToken",
    "SecurityToken",
    "session_token",
    "sessionToken",
    "SessionToken",
    "Token"
  ]);
  const bucket =
    pickField(credentials, ["bucket", "Bucket"]) ||
    pickField(initData, ["bucket", "Bucket"]);
  const region =
    pickField(credentials, ["region", "Region"]) ||
    pickField(initData, ["region", "Region"]);
  let uploadDomain: string | undefined;
  if (uploadUrl) {
    try {
      const parsedUrl = new URL(uploadUrl);
      uploadDomain = parsedUrl.host;
    } catch {
      uploadDomain = undefined;
    }
  }

  let objectKey = pickField(initData, [
    "object_key",
    "objectKey",
    "key",
    "Key"
  ]);
  if (!objectKey && uploadUrl) {
    try {
      const parsedUrl = new URL(uploadUrl);
      const pathName = parsedUrl.pathname || "";
      objectKey = pathName.replace(/^\//, "");
    } catch {
      objectKey = undefined;
    }
  }

  const initCode = Number(initRes?.code);
  const initSuccess = initCode === 200 || initCode === 0;

  if (
    !initSuccess ||
    !uploadToken ||
    !objectKey ||
    !tmpSecretId ||
    !tmpSecretKey ||
    !securityToken ||
    !bucket ||
    !region
  ) {
    console.error("STS 初始化响应详情:", {
      code: initRes?.code,
      initData,
      parsed: {
        uploadToken,
        objectKey,
        bucket,
        region,
        hasTmpSecretId: Boolean(tmpSecretId),
        hasTmpSecretKey: Boolean(tmpSecretKey),
        hasSecurityToken: Boolean(securityToken)
      }
    });
    throw new Error("STS 初始化返回信息不完整");
  }

  const cos = new COS({
    SecretId: tmpSecretId,
    SecretKey: tmpSecretKey,
    SecurityToken: securityToken,
    Protocol: "https:",
    Domain: uploadDomain
  });

  const totalBytes = rawFile.size;
  let uploadedBytes = 0;
  const reportProgress = (loaded: number) => {
    if (onProgress) onProgress(Math.min(loaded, totalBytes), totalBytes);
  };
  reportProgress(0);

  const MULTIPART_THRESHOLD = 50 * 1024 * 1024;
  if (rawFile.size > MULTIPART_THRESHOLD) {
    const PART_SIZE = 5 * 1024 * 1024;
    const initMultipartData: any = await new Promise((resolve, reject) => {
      cos.multipartInit(
        {
          Bucket: bucket,
          Region: region,
          Key: objectKey,
          ContentType: rawFile.type || "application/octet-stream"
        },
        (err, data) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(data);
        }
      );
    });

    const uploadId = pickField(initMultipartData, ["UploadId", "uploadId"]);
    if (!uploadId) {
      throw new Error("分片初始化失败：缺少 UploadId");
    }

    const parts: Array<{ PartNumber: number; ETag: string }> = [];

    try {
      for (
        let partNumber = 1, start = 0;
        start < rawFile.size;
        partNumber += 1, start += PART_SIZE
      ) {
        const end = Math.min(start + PART_SIZE, rawFile.size);
        const chunk = rawFile.slice(start, end);

        const uploadPartData: any = await new Promise((resolve, reject) => {
          cos.multipartUpload(
            {
              Bucket: bucket,
              Region: region,
              Key: objectKey,
              UploadId: uploadId,
              PartNumber: partNumber,
              Body: chunk,
              ContentLength: chunk.size,
              onProgress: (progressData: any) => {
                if (progressData) {
                  reportProgress(uploadedBytes + (progressData.loaded || 0));
                }
              }
            } as any,
            (err, data) => {
              if (err) {
                reject(err);
                return;
              }
              resolve(data);
            }
          );
        });

        const etag = pickField(uploadPartData, ["ETag", "etag"]);
        if (!etag) {
          throw new Error(`分片上传失败：缺少 ETag(part ${partNumber})`);
        }

        uploadedBytes += chunk.size;
        reportProgress(uploadedBytes);

        parts.push({
          PartNumber: partNumber,
          ETag: etag
        });
      }

      await new Promise((resolve, reject) => {
        cos.multipartComplete(
          {
            Bucket: bucket,
            Region: region,
            Key: objectKey,
            UploadId: uploadId,
            Parts: parts
          },
          (err, data) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(data);
          }
        );
      });
    } catch (error) {
      // 失败时尽量清理未完成的分片任务，避免残留 UploadId。
      try {
        await new Promise((resolve, reject) => {
          cos.multipartAbort(
            {
              Bucket: bucket,
              Region: region,
              Key: objectKey,
              UploadId: uploadId
            },
            (err, data) => {
              if (err) {
                reject(err);
                return;
              }
              resolve(data);
            }
          );
        });
      } catch (abortError) {
        console.warn("分片上传失败后清理 UploadId 失败:", abortError);
      }

      throw error;
    }
  } else {
    await new Promise((resolve, reject) => {
      cos.putObject(
        {
          Bucket: bucket,
          Region: region,
          Key: objectKey,
          Body: rawFile,
          ContentType: rawFile.type || "application/octet-stream",
          onProgress: (progressData: any) => {
            if (progressData) {
              reportProgress(progressData.loaded || 0);
            }
          }
        } as any,
        (err, data) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(data);
        }
      );
    });
  }

  reportProgress(totalBytes);
  const completeRes = await completeStsUpload({ upload_token: uploadToken });
  const completeData: any = completeRes?.data || {};
  const fileId = pickField(completeData, ["fileId", "file_id"]);
  const url = pickField(completeData, ["url", "Url"]);
  const completeCode = Number(completeRes?.code);
  const completeSuccess = completeCode === 200 || completeCode === 0;

  if (!completeSuccess || !fileId || !url) {
    console.error("STS 完成上传响应详情:", {
      code: completeRes?.code,
      completeData
    });
    throw new Error("STS 完成上传失败");
  }

  return {
    code: completeRes.code,
    msg: completeRes.msg,
    data: {
      fileId,
      url,
      objectKey: completeData.objectKey || completeData.object_key || objectKey
    }
  };
};

// 处理封面上传
const coverUploadState = reactive<any>({
  isUploading: false,
  uploadProgress: 0,
  uploadLoaded: 0,
  uploadTotal: 0,
  uploadSpeed: 0,
  uploadEta: Infinity
});

const handleCoverUpload = async file => {
  try {
    coverUploadState.isUploading = true;
    const tracker = createProgressTracker(coverUploadState);
    const res = await uploadWithSts(file.raw, "resource_upload", tracker);
    coverUploadState.isUploading = false;
    if (res && res.code === 200 && res.data && res.data.url) {
      // 更新表单数据，使用thumb_url字段
      formData.thumb_url = res.data.url;
      // 同时更新 thumb 字段
      formData.thumb = res.data.fileId || 0;
      ElMessage.success("封面上传成功");
    } else {
      ElMessage.error("封面上传失败：无法获取文件URL");
    }
  } catch (error) {
    coverUploadState.isUploading = false;
    console.error("封面上传失败:", error);
    ElMessage.error("封面上传失败");
  }
};

// 移除封面
const removeCover = () => {
  formData.thumb_url = "";
};

// 从URL中获取文件名（保留后缀）
const getFileName = url => {
  if (!url) return "未知文件";
  const parts = url.split("/");
  return parts[parts.length - 1];
};

// 预览资源
const previewResource = url => {
  if (url) {
    if (!openPlatformUrl(url).opened) {
      ElMessage.warning("当前环境无法打开该资源");
    }
  } else {
    ElMessage.warning("无效的资源链接");
  }
};

// 章节相关方法
const addChapter = () => {
  formData.chapterList.push({
    name: "", // 去除默认值
    hourList: []
  });
  // 自动展开新添加的章节
  activeChapters.value.push(formData.chapterList.length - 1);
};

const removeChapter = index => {
  formData.chapterList.splice(index, 1);
};

// 课时相关方法
const addHour = () => {
  formData.hourList.push({
    title: "", // 自动填充，由视频文件名决定
    duration: 0, // 自动填充，由视频时长决定
    rType: "video", // 默认视频类型
    resourceId: 0,
    fileUrl: "",
    isUploading: false, // 用于控制上传状态
    originalFileName: "", // 保存原始文件名
    uploadProgress: 0,
    uploadLoaded: 0,
    uploadTotal: 0,
    uploadSpeed: 0,
    uploadEta: Infinity
  });

  // 初始化独立课时的折叠状态数组
  if (!activeHours.value.standalone) {
    activeHours.value.standalone = [];
  }

  // 自动展开新添加的课时
  activeHours.value.standalone.push(formData.hourList.length - 1);
};

const removeHour = index => {
  formData.hourList.splice(index, 1);
};

const addHourToChapter = chapterIndex => {
  formData.chapterList[chapterIndex].hourList.push({
    title: "", // 自动填充，由视频文件名决定
    duration: 0, // 自动填充，由视频时长决定
    rType: "video", // 默认视频类型
    resourceId: 0,
    fileUrl: "",
    isUploading: false, // 用于控制上传状态
    originalFileName: "", // 保存原始文件名
    uploadProgress: 0,
    uploadLoaded: 0,
    uploadTotal: 0,
    uploadSpeed: 0,
    uploadEta: Infinity
  });

  // 初始化当前章节的课时折叠状态数组
  if (!activeHours.value[chapterIndex]) {
    activeHours.value[chapterIndex] = [];
  }

  // 自动展开新添加的课时
  activeHours.value[chapterIndex].push(
    formData.chapterList[chapterIndex].hourList.length - 1
  );
};

const removeHourFromChapter = (chapterIndex, hourIndex) => {
  formData.chapterList[chapterIndex].hourList.splice(hourIndex, 1);
};

// 处理资源上传
const handleResourceUpload = async (file, list, index) => {
  try {
    // 检查文件类型是否为视频
    const acceptedTypes = ["video/mp4", "video/webm", "video/ogg"];

    if (!acceptedTypes.includes(file.raw.type)) {
      list[index].isUploading = false;
      ElMessage.error("请上传视频文件（MP4、WebM、Ogg格式）");
      return;
    }

    // 获取原始文件名
    const originalFileName = file.name;
    // 不含扩展名的文件名用于标题
    const titleWithoutExt =
      originalFileName.substring(0, originalFileName.lastIndexOf(".")) ||
      originalFileName;

    // 创建进度跟踪器
    const tracker = createProgressTracker(list[index]);

    const res = await uploadWithSts(file.raw, "resource_upload", tracker);
    // 上传完成后结束上传状态
    list[index].isUploading = false;

    if (
      res &&
      res.code === 200 &&
      res.data &&
      res.data.url &&
      res.data.fileId
    ) {
      // 更新表单数据
      list[index].resourceId = res.data.fileId;
      list[index].fileUrl = res.data.url;
      list[index].originalFileName = originalFileName; // 保存原始文件名
      list[index].title = titleWithoutExt; // 设置标题为不含扩展名的文件名

      // 模拟从视频中提取时长（实际项目中可能需要服务端支持）
      // 这里简单设置一个随机时长，实际应用中应该从视频文件中提取
      list[index].duration = Math.floor(Math.random() * 600) + 60; // 60-660秒
      list[index].rType = "video"; // 设置为视频类型

      ElMessage.success("视频上传成功，已自动设置标题和时长");
    } else {
      ElMessage.error("资源上传失败：无法获取文件信息");
    }
  } catch (error) {
    // 发生错误时也要结束上传状态
    list[index].isUploading = false;
    console.error("资源上传失败:", error);
    ElMessage.error("资源上传失败");
  }
};

const removeResource = (list, index) => {
  list[index].resourceId = 0;
  list[index].fileUrl = "";
  list[index].title = ""; // 清空标题
  list[index].duration = 0; // 重置时长
  list[index].originalFileName = ""; // 清空原始文件名
  resetProgressTracker(list[index]);
};

// 附件相关方法
const addAttr = () => {
  formData.attrList.push({
    title: "新附件",
    rType: "document",
    resourceId: 0,
    fileUrl: "",
    originalFileName: "", // 添加原始文件名字段
    isUploading: false,
    uploadProgress: 0,
    uploadLoaded: 0,
    uploadTotal: 0,
    uploadSpeed: 0,
    uploadEta: Infinity
  });
};

const removeAttr = index => {
  formData.attrList.splice(index, 1);
};

// 处理附件上传
const handleAttrUpload = async (file, index) => {
  try {
    formData.attrList[index].isUploading = true;
    const tracker = createProgressTracker(formData.attrList[index]);
    // 获取原始文件名
    const originalFileName = file.name;
    // 不含扩展名的文件名用于标题
    const titleWithoutExt =
      originalFileName.substring(0, originalFileName.lastIndexOf(".")) ||
      originalFileName;

    const res = await uploadWithSts(file.raw, "resource_upload", tracker);
    formData.attrList[index].isUploading = false;
    if (
      res &&
      res.code === 200 &&
      res.data &&
      res.data.url &&
      res.data.fileId
    ) {
      // 更新表单数据
      formData.attrList[index].resourceId = res.data.fileId;
      formData.attrList[index].fileUrl = res.data.url;
      formData.attrList[index].originalFileName = originalFileName; // 保存原始文件名
      formData.attrList[index].title = titleWithoutExt; // 设置标题为不含扩展名的文件名
      ElMessage.success("附件上传成功");
    } else {
      ElMessage.error("附件上传失败：无法获取文件信息");
    }
  } catch (error) {
    formData.attrList[index].isUploading = false;
    console.error("附件上传失败:", error);
    ElMessage.error("附件上传失败");
  }
};

const removeAttrResource = index => {
  formData.attrList[index].resourceId = 0;
  formData.attrList[index].fileUrl = "";
  formData.attrList[index].originalFileName = ""; // 清空原始文件名
};

// 表单验证方法
const validate = async () => {
  try {
    lastInvalidFields.value = null;
    return await formRef.value.validate();
  } catch (error: any) {
    lastInvalidFields.value = error?.fields || error || null;
    throw error;
  }
};

const scrollToFirstError = async () => {
  await nextTick();
  const firstInvalidProp = Object.keys(lastInvalidFields.value || {})[0];
  if (firstInvalidProp && formRef.value?.scrollToField) {
    formRef.value.scrollToField(firstInvalidProp);
    return;
  }

  document
    .querySelector(".el-form-item.is-error")
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
};

// 初始化
onMounted(() => {
  console.log("组件挂载，开始加载分类数据");
  loadCategories();
});

// 对外暴露方法
defineExpose({
  validate,
  scrollToFirstError,
  formRef
});
</script>

<style lang="scss" scoped>
:deep(.el-collapse-item__content) {
  max-height: 450px;
  overflow-y: auto;
}

:deep(.el-form-item__label) {
  font-size: 14px;
  font-weight: 500;
}

:deep(.el-input__wrapper),
:deep(.el-textarea__inner),
:deep(.el-select__wrapper),
:deep(.el-date-editor) {
  border-radius: 10px !important;
}

:deep(.el-checkbox__label) {
  font-size: 14px;
}

:deep(.el-radio__label) {
  font-size: 14px;
}

.form-section {
  padding: 20px;
  margin-top: 24px;
  margin-bottom: 24px;
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 16px;

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;

    h3 {
      margin: 0;
      font-size: 17px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
  }
}

.empty-placeholder {
  padding: 24px;
  margin-bottom: 16px;
  font-size: 14px;
  color: var(--el-text-color-secondary);
  text-align: center;
  border: 1px dashed var(--el-border-color);
  border-radius: 12px;
}

.chapter-header,
.hour-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;

  span {
    font-weight: 500;
  }

  .chapter-actions,
  .hour-title-actions {
    margin-right: 30px; /* 给折叠箭头留出空间 */
  }
}

.chapter-content {
  padding: 0 16px;
}

.hour-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 16px 0;

  h4 {
    margin: 0;
    font-size: 14px;
  }
}

.hour-item,
.attr-item {
  margin-bottom: 16px;
}

.hour-card,
.attr-card {
  position: relative;
  padding: 20px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
}

.hour-actions,
.attr-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.input-with-actions {
  display: flex;

  .el-input {
    flex: 1;
    margin-right: 10px;
  }
}

.upload-box {
  display: flex;
}

.upload-preview {
  position: relative;

  .upload-actions {
    position: absolute;
    right: 5px;
    bottom: 5px;
  }
}

.upload-trigger {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 200px;
  height: 120px;
  cursor: pointer;
  background-color: var(--el-fill-color-blank);
  border: 1px dashed var(--el-border-color);
  border-radius: 12px;
  transition: all 0.3s ease;

  &:hover {
    background-color: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary);
  }
}

.upload-icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;

  .el-icon {
    font-size: 28px;
    color: var(--el-text-color-placeholder);
  }
}

.upload-with-preview {
  position: relative;
  width: 100%;
}

.resource-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;

  .resource-info {
    display: flex;
    align-items: center;

    .resource-name {
      margin-left: 8px;
      word-break: break-all;
    }
  }

  .resource-actions {
    display: flex;
    gap: 8px;
  }
}

.resource-upload {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 70px;
  background-color: var(--el-fill-color-blank);
  border: 1px dashed var(--el-border-color);
  border-radius: 10px;
  transition: all 0.3s ease;

  &:hover {
    background-color: var(--el-color-primary-light-9);
    border-color: var(--el-color-primary);
  }

  .upload-icon-container {
    display: flex;
    flex-direction: column;
    align-items: center;

    .el-icon {
      margin-bottom: 8px;
      font-size: 22px;
      color: var(--el-text-color-placeholder);
    }

    span {
      font-size: 14px;
      color: #606266;
    }

    .upload-tip {
      margin-top: 5px;
      font-size: 14px;
      color: #606266;
    }
  }

  .uploading-overlay {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgb(255 255 255 / 90%);
    border: 1px dashed var(--el-border-color);
    border-radius: 10px;
  }

  .uploading-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    .el-icon {
      margin-bottom: 8px;
      font-size: 24px;
      color: #97b4f7;
    }

    span {
      font-size: 14px;
      color: #97b4f7;
    }
  }
}

.uploading-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 16px 18px;
  background: #fff;
  border: 1px dashed #97b4f7;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgb(151 180 247 / 12%);

  &.static {
    width: 100%;
  }
}

.upload-progress-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 10px;

  .upload-progress-header {
    display: flex;
    align-items: center;
    gap: 8px;

    .el-icon {
      font-size: 18px;
      color: #97b4f7;
    }

    .upload-progress-title {
      font-size: 14px;
      font-weight: 500;
      color: #5b74ea;
    }

    .upload-progress-percent {
      margin-left: auto;
      font-size: 14px;
      font-weight: 600;
      color: #5b74ea;
      font-variant-numeric: tabular-nums;
    }
  }

  .upload-progress-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 18px;
    font-size: 12px;
    color: var(--el-text-color-secondary);

    strong {
      font-weight: 600;
      color: var(--el-text-color-primary);
      font-variant-numeric: tabular-nums;
    }
  }
}

:deep(::-webkit-scrollbar) {
  width: 6px;
  height: 6px;
}

:deep(::-webkit-scrollbar-track) {
  background: #f1f1f1;
  border-radius: 3px;
}

:deep(::-webkit-scrollbar-thumb) {
  background: #c1c1c1;
  border-radius: 3px;
}

:deep(::-webkit-scrollbar-thumb:hover) {
  background: #a8a8a8;
}

.required-mark {
  margin-left: 4px;
  color: #f56c6c;
}

.required-hint {
  margin-left: 5px;
  font-size: 12px;
  color: #f56c6c;
}

.hour-content {
  padding: 0 16px;
}

:deep(.el-collapse-item__content) {
  padding-top: 16px;
}

:deep(.el-collapse-item__header) {
  height: 48px;
  padding: 0 16px;
  font-size: 15px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
}

:deep(.el-collapse-item__wrap) {
  border-radius: 0 0 10px 10px;
}

:deep(.el-collapse) {
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
}

:deep(.el-collapse-item) {
  &:last-child {
    margin-bottom: 0;
  }
}

:deep(.el-button) {
  border-radius: 8px;
}
</style>
