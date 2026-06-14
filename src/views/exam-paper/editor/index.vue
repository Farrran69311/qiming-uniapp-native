<script setup lang="ts">
import {
  ref,
  reactive,
  computed,
  onMounted,
  onBeforeUnmount,
  watch,
  nextTick
} from "vue";
import { useRouter, useRoute } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { onBeforeRouteLeave } from "vue-router";
import { useDark } from "@pureadmin/utils";
import draggable from "vuedraggable";
import QuestionAssistant from "./components/QuestionAssistant.vue";
import RichMediaUploader from "./components/RichMediaUploader.vue";
import LatexEditor from "./components/LatexEditor.vue";
import RichContent from "./components/RichContent.vue";
import {
  createPaper,
  updatePaper,
  getPaperDetail,
  publishPaperAdvanced,
  saveAsTemplate as saveAsTemplateApi,
  getTemplateDetail,
  archiveQuestionToBank as archiveQuestionToBankApi,
  batchArchiveToBank,
  getCourseList,
  aiAnalyzePaper,
  getPublishClasses,
  getPublishStudents,
  PublishTargetType,
  type AIPaperAnalyzeResult,
  type ClassInfo,
  type PublishTargetStudent
} from "@/api/examPaper";
import {
  logNativeFallback,
  isNativeWebViewRuntime
} from "@/utils/nativeRuntime";
import { nativeDemoStudentPaper } from "@/views/exam-paper/nativeDemoPaper";

defineOptions({
  name: "ExamPaperEditor"
});

// 自定义SVG图标组件
const LogoIcon = {
  template: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#739CF9"/>
    <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#739CF9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`
};

const RadioIcon = {
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="9"/>
    <circle cx="12" cy="12" r="4" fill="currentColor"/>
  </svg>`
};

const CheckboxIcon = {
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`
};

const InputIcon = {
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="6" width="18" height="12" rx="2"/>
    <line x1="7" y1="12" x2="17" y2="12"/>
  </svg>`
};

const TextareaIcon = {
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <line x1="7" y1="8" x2="17" y2="8"/>
    <line x1="7" y1="12" x2="17" y2="12"/>
    <line x1="7" y1="16" x2="13" y2="16"/>
  </svg>`
};

const JudgeIcon = {
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"/>
    <path d="M8 12l3 3 5-6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`
};

const EssayIcon = {
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <line x1="7" y1="8" x2="17" y2="8"/>
    <line x1="7" y1="12" x2="17" y2="12"/>
    <line x1="7" y1="16" x2="17" y2="16"/>
  </svg>`
};

const MatrixSingleIcon = {
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="9" cy="9" r="1.5"/>
    <circle cx="15" cy="9" r="1.5"/>
    <circle cx="9" cy="15" r="1.5" fill="currentColor"/>
    <circle cx="15" cy="15" r="1.5"/>
  </svg>`
};

const MatrixMultipleIcon = {
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <rect x="7" y="7" width="4" height="4" rx="0.5"/>
    <rect x="13" y="7" width="4" height="4" rx="0.5" fill="currentColor"/>
    <rect x="7" y="13" width="4" height="4" rx="0.5" fill="currentColor"/>
    <rect x="13" y="13" width="4" height="4" rx="0.5" fill="currentColor"/>
  </svg>`
};

const MatchingIcon = {
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="6" cy="6" r="2"/>
    <circle cx="6" cy="12" r="2"/>
    <circle cx="6" cy="18" r="2"/>
    <circle cx="18" cy="6" r="2"/>
    <circle cx="18" cy="12" r="2"/>
    <circle cx="18" cy="18" r="2"/>
    <line x1="8" y1="6" x2="16" y2="12"/>
    <line x1="8" y1="12" x2="16" y2="18"/>
    <line x1="8" y1="18" x2="16" y2="6"/>
  </svg>`
};

const OrderingIcon = {
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="4" y1="6" x2="14" y2="6"/>
    <line x1="4" y1="12" x2="14" y2="12"/>
    <line x1="4" y1="18" x2="14" y2="18"/>
    <polyline points="17 4 20 7 17 10"/>
    <polyline points="20 14 17 17 20 20"/>
    <line x1="20" y1="7" x2="17" y2="7"/>
    <line x1="17" y1="17" x2="20" y2="17"/>
  </svg>`
};

const SliderIcon = {
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="3" y1="12" x2="21" y2="12"/>
    <circle cx="14" cy="12" r="3" fill="currentColor"/>
    <line x1="3" y1="8" x2="3" y2="16"/>
    <line x1="21" y1="8" x2="21" y2="16"/>
  </svg>`
};

const NpsRatingIcon = {
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="2" y="8" width="20" height="8" rx="2"/>
    <line x1="4" y1="10" x2="4" y2="14"/>
    <line x1="6" y1="10" x2="6" y2="14"/>
    <line x1="8" y1="10" x2="8" y2="14"/>
    <line x1="10" y1="10" x2="10" y2="14"/>
    <line x1="12" y1="10" x2="12" y2="14"/>
    <line x1="14" y1="10" x2="14" y2="14"/>
    <line x1="16" y1="10" x2="16" y2="14"/>
    <line x1="18" y1="10" x2="18" y2="14"/>
    <line x1="20" y1="10" x2="20" y2="14"/>
    <text x="12" y="6" text-anchor="middle" font-size="5" fill="currentColor">NPS</text>
  </svg>`
};

const StarRatingIcon = {
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polygon points="12,2 15,9 22,9 16.5,14 18.5,21 12,17 5.5,21 7.5,14 2,9 9,9" fill="currentColor"/>
  </svg>`
};

const CompositeIcon = {
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="2" width="18" height="8" rx="2"/>
    <line x1="6" y1="5" x2="18" y2="5"/>
    <line x1="6" y1="7" x2="14" y2="7"/>
    <rect x="5" y="13" width="14" height="3" rx="1"/>
    <rect x="5" y="18" width="14" height="3" rx="1"/>
    <line x1="3" y1="14.5" x2="5" y2="14.5"/>
    <line x1="3" y1="19.5" x2="5" y2="19.5"/>
  </svg>`
};

const DragIcon = {
  template: `<svg viewBox="0 0 24 24" fill="currentColor">
    <circle cx="9" cy="6" r="1.5"/>
    <circle cx="15" cy="6" r="1.5"/>
    <circle cx="9" cy="12" r="1.5"/>
    <circle cx="15" cy="12" r="1.5"/>
    <circle cx="9" cy="18" r="1.5"/>
    <circle cx="15" cy="18" r="1.5"/>
  </svg>`
};

// 图标映射
const iconComponents: Record<string, any> = {
  LogoIcon,
  RadioIcon,
  CheckboxIcon,
  InputIcon,
  TextareaIcon,
  JudgeIcon,
  EssayIcon,
  MatrixSingleIcon,
  MatrixMultipleIcon,
  MatchingIcon,
  OrderingIcon,
  SliderIcon,
  NpsRatingIcon,
  StarRatingIcon,
  CompositeIcon,
  DragIcon
};

const router = useRouter();
const route = useRoute();
const { isDark } = useDark();

// 试卷ID（编辑模式）
const paperId = computed(() => route.params.id as string);
const isEditMode = computed(() => !!paperId.value);

// 是否有未保存的更改
const hasUnsavedChanges = ref(false);

// 课程列表
const courseOptions = ref<Array<{ id: number; name: string }>>([]);

// 试卷数据 - 新建时为空白
const paper = reactive({
  title: "",
  description: "",
  courseId: null as number | null,
  timeLimit: 90,
  totalPoints: 0,
  totalQuestions: 0,
  startTime: "" as string,
  endTime: "" as string,
  questionGroups: [] as any[],
  settings: {
    shuffleQuestions: false,
    shuffleOptions: false,
    showScore: true,
    allowReview: true
  },
  antiCheat: {
    ipRestriction: false,
    browserFingerprint: false,
    preventWindowSwitch: false,
    maxWindowSwitchWarnings: 3
  },
  retake: {
    allowRetake: false,
    maxRetakeCount: 1,
    retakeStartTime: "" as string,
    retakeEndTime: "" as string,
    useOriginalQuestions: true
  },
  scoring: {
    passScore: 60,
    useHighestScore: false
  }
});

const applyNativeDemoPaperDetail = () => {
  paper.title = nativeDemoStudentPaper.title;
  paper.description = nativeDemoStudentPaper.description || "";
  paper.courseId = nativeDemoStudentPaper.courseId;
  paper.timeLimit = nativeDemoStudentPaper.timeLimit;
  paper.startTime = nativeDemoStudentPaper.startTime || "";
  paper.endTime = nativeDemoStudentPaper.endTime || "";
  paper.questionGroups = JSON.parse(
    JSON.stringify(nativeDemoStudentPaper.questionGroups || [])
  );
  updateTotals();
  hasUnsavedChanges.value = false;
};

// 设置面板是否展开
const settingsPanelVisible = ref(false);

// AI 分析面板
const aiAnalysisPanelVisible = ref(false);
const aiAnalyzing = ref(false);
const aiAnalysisResult = ref<AIPaperAnalyzeResult | null>(null);

// 自动保存状态
const autoSaveStatus = ref<"idle" | "saving" | "saved" | "error">("idle");
const autoSaveSeconds = ref(30);
const autoSaveEnabled = ref(true);
let autoSaveCountdown: ReturnType<typeof setInterval> | null = null;

// 当前选中的题目
const activeQuestionId = ref<number | null>(null);

// 左侧大纲是否折叠
const outlineCollapsed = ref(false);

// 预览相关
const previewDialogVisible = ref(false);
const previewWithAnswerDialogVisible = ref(false);
const previewPaperSize = ref<"A4" | "A3">("A4");
const previewScale = ref(100);

// 题型分组定义
const questionTypeGroups = [
  {
    groupLabel: "基础题型",
    types: [
      { id: "radio", label: "单选题", icon: "RadioIcon", color: "#739CF9" },
      {
        id: "checkbox",
        label: "多选题",
        icon: "CheckboxIcon",
        color: "#739CF9"
      },
      { id: "judge", label: "判断题", icon: "JudgeIcon", color: "#739CF9" },
      { id: "input", label: "填空题", icon: "InputIcon", color: "#739CF9" },
      {
        id: "textarea",
        label: "简答题",
        icon: "TextareaIcon",
        color: "#739CF9"
      }
    ]
  },
  {
    groupLabel: "高级题型",
    types: [
      {
        id: "textarea-essay",
        label: "论述题",
        icon: "EssayIcon",
        color: "#a1b5f7"
      },
      {
        id: "matrix-single",
        label: "矩阵单选",
        icon: "MatrixSingleIcon",
        color: "#a1b5f7"
      },
      {
        id: "matrix-multiple",
        label: "矩阵多选",
        icon: "MatrixMultipleIcon",
        color: "#a1b5f7"
      },
      {
        id: "matching",
        label: "连线题",
        icon: "MatchingIcon",
        color: "#a1b5f7"
      },
      {
        id: "ordering",
        label: "排序题",
        icon: "OrderingIcon",
        color: "#a1b5f7"
      },
      {
        id: "composite",
        label: "组合材料题",
        icon: "CompositeIcon",
        color: "#a1b5f7"
      }
    ]
  },
  {
    groupLabel: "数据收集",
    types: [
      { id: "slider", label: "滑动评分", icon: "SliderIcon", color: "#e6a23c" },
      {
        id: "nps-rating",
        label: "NPS评分",
        icon: "NpsRatingIcon",
        color: "#e6a23c"
      },
      {
        id: "star-rating",
        label: "星级评分",
        icon: "StarRatingIcon",
        color: "#e6a23c"
      }
    ]
  }
];

// 扁平题型列表（兼容原有逻辑）
const questionTypes = questionTypeGroups.flatMap(g => g.types);

// 监听数据变化
watch(
  () => paper,
  () => {
    hasUnsavedChanges.value = true;
  },
  { deep: true }
);

// 计算总题数和总分
const updateTotals = () => {
  let totalQuestions = 0;
  let totalPoints = 0;
  paper.questionGroups.forEach(group => {
    totalQuestions += group.questions.length;
    group.questions.forEach((q: any) => {
      totalPoints += Number(q.points) || 0;
    });
  });
  paper.totalQuestions = totalQuestions;
  paper.totalPoints = totalPoints;
};

// 获取全局题号
const getGlobalQuestionIndex = (groupIndex: number, questionIndex: number) => {
  let index = 0;
  for (let i = 0; i < groupIndex; i++) {
    index += paper.questionGroups[i].questions.length;
  }
  return index + questionIndex + 1;
};

// 将数字转换为中文数字
const getChineseNumber = (num: number | string): string => {
  const chineseDigits = [
    "零",
    "一",
    "二",
    "三",
    "四",
    "五",
    "六",
    "七",
    "八",
    "九"
  ];
  const numValue = typeof num === "string" ? parseInt(num, 10) : num;

  if (numValue < 0) return String(numValue);
  if (numValue === 0) return "零";
  if (numValue <= 10) {
    return ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][
      numValue
    ];
  }

  // 处理 11-99
  if (numValue < 100) {
    const tens = Math.floor(numValue / 10);
    const ones = numValue % 10;
    let result = "";
    if (tens === 1) {
      result = "十";
    } else {
      result = chineseDigits[tens] + "十";
    }
    if (ones > 0) {
      result += chineseDigits[ones];
    }
    return result;
  }

  // 处理 100-999
  if (numValue < 1000) {
    const hundreds = Math.floor(numValue / 100);
    const remainder = numValue % 100;
    let result = chineseDigits[hundreds] + "百";
    if (remainder === 0) {
      return result;
    }
    if (remainder < 10) {
      result += "零" + chineseDigits[remainder];
    } else {
      const tens = Math.floor(remainder / 10);
      const ones = remainder % 10;
      if (tens === 1) {
        result += "一十";
      } else {
        result += chineseDigits[tens] + "十";
      }
      if (ones > 0) {
        result += chineseDigits[ones];
      }
    }
    return result;
  }

  // 处理 1000+
  const thousands = Math.floor(numValue / 1000);
  const remainder = numValue % 1000;
  let result = chineseDigits[thousands] + "千";
  if (remainder === 0) {
    return result;
  }
  if (remainder < 100) {
    result += "零";
  }
  if (remainder >= 100) {
    const hundreds = Math.floor(remainder / 100);
    result += chineseDigits[hundreds] + "百";
    const tens = Math.floor((remainder % 100) / 10);
    const ones = remainder % 10;
    if (tens > 0) {
      result += chineseDigits[tens] + "十";
      if (ones > 0) {
        result += chineseDigits[ones];
      }
    } else if (ones > 0) {
      result += "零" + chineseDigits[ones];
    }
  } else if (remainder >= 10) {
    const tens = Math.floor(remainder / 10);
    const ones = remainder % 10;
    result += chineseDigits[tens] + "十";
    if (ones > 0) {
      result += chineseDigits[ones];
    }
  } else {
    result += chineseDigits[remainder];
  }
  return result;
};

// 添加题型分组
const addQuestionGroup = (typeId: string) => {
  const typeInfo = questionTypes.find(t => t.id === typeId);
  const groupId = Date.now();
  paper.questionGroups.push({
    groupId,
    groupName: typeInfo?.label || "题目组",
    questionType: typeId,
    questions: [],
    sortOrder: paper.questionGroups.length
  });
  addQuestion(groupId);
};

// 添加题目到分组
const addQuestion = (groupId: number) => {
  const group = paper.questionGroups.find(g => g.groupId === groupId);
  if (group) {
    const questionId = Date.now();
    const newQuestion: any = {
      questionId,
      questionType: group.questionType,
      stem: "",
      points: 5,
      analysis: "",
      media: [],
      latex: "",
      sortOrder: group.questions.length
    };

    // 根据题型初始化选项和答案
    if (group.questionType === "radio") {
      newQuestion.options = [
        { key: "A", content: "" },
        { key: "B", content: "" },
        { key: "C", content: "" },
        { key: "D", content: "" }
      ];
      newQuestion.correctAnswer = "";
    } else if (group.questionType === "checkbox") {
      newQuestion.options = [
        { key: "A", content: "" },
        { key: "B", content: "" },
        { key: "C", content: "" },
        { key: "D", content: "" }
      ];
      newQuestion.correctAnswers = [];
    } else if (group.questionType === "judge") {
      newQuestion.options = [
        { key: "T", content: "正确" },
        { key: "F", content: "错误" }
      ];
      newQuestion.correctAnswer = "";
    } else if (group.questionType === "input") {
      newQuestion.blanks = [{ answer: "" }];
    } else if (group.questionType === "textarea") {
      newQuestion.referenceAnswer = "";
    } else if (group.questionType === "textarea-essay") {
      newQuestion.referenceAnswer = "";
    } else if (group.questionType === "matrix-single") {
      newQuestion.rows = [
        { key: "R1", content: "行1" },
        { key: "R2", content: "行2" },
        { key: "R3", content: "行3" }
      ];
      newQuestion.columns = [
        { key: "C1", content: "列1" },
        { key: "C2", content: "列2" },
        { key: "C3", content: "列3" }
      ];
      newQuestion.correctAnswers = {};
    } else if (group.questionType === "matrix-multiple") {
      newQuestion.rows = [
        { key: "R1", content: "行1" },
        { key: "R2", content: "行2" },
        { key: "R3", content: "行3" }
      ];
      newQuestion.columns = [
        { key: "C1", content: "列1" },
        { key: "C2", content: "列2" },
        { key: "C3", content: "列3" }
      ];
      newQuestion.correctAnswers = {};
    } else if (group.questionType === "matching") {
      newQuestion.leftItems = [
        { key: "L1", content: "" },
        { key: "L2", content: "" },
        { key: "L3", content: "" }
      ];
      newQuestion.rightItems = [
        { key: "R1", content: "" },
        { key: "R2", content: "" },
        { key: "R3", content: "" }
      ];
      newQuestion.correctMatches = {};
    } else if (group.questionType === "ordering") {
      newQuestion.items = [
        { key: "1", content: "" },
        { key: "2", content: "" },
        { key: "3", content: "" },
        { key: "4", content: "" }
      ];
      newQuestion.correctOrder = [];
    } else if (group.questionType === "slider") {
      newQuestion.sliderMin = 0;
      newQuestion.sliderMax = 100;
      newQuestion.sliderStep = 1;
      newQuestion.sliderDefaultValue = 50;
      newQuestion.sliderLabels = { left: "最低", right: "最高" };
      newQuestion.points = 0;
    } else if (group.questionType === "nps-rating") {
      newQuestion.npsMin = 0;
      newQuestion.npsMax = 10;
      newQuestion.npsLabels = {
        low: "完全不推荐",
        mid: "一般",
        high: "强烈推荐"
      };
      newQuestion.points = 0;
    } else if (group.questionType === "star-rating") {
      newQuestion.starCount = 5;
      newQuestion.starLabels = ["很差", "较差", "一般", "较好", "很好"];
      newQuestion.points = 0;
    } else if (group.questionType === "composite") {
      newQuestion.material = "";
      newQuestion.subQuestions = [
        {
          subId: Date.now() + 1,
          questionType: "radio",
          stem: "",
          points: 5,
          options: [
            { key: "A", content: "" },
            { key: "B", content: "" },
            { key: "C", content: "" },
            { key: "D", content: "" }
          ],
          correctAnswer: ""
        }
      ];
    }

    group.questions.push(newQuestion);
    activeQuestionId.value = questionId;
    updateTotals();
  }
};

// 删除题目
const deleteQuestion = (groupId: number, questionId: number) => {
  ElMessageBox.confirm("确定要删除这道题目吗？", "提示", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning"
  })
    .then(() => {
      const group = paper.questionGroups.find(g => g.groupId === groupId);
      if (group) {
        const index = group.questions.findIndex(
          (q: any) => q.questionId === questionId
        );
        if (index !== -1) {
          group.questions.splice(index, 1);
          if (activeQuestionId.value === questionId) {
            activeQuestionId.value = null;
          }
          updateTotals();
          ElMessage.success("删除成功");
        }
      }
    })
    .catch(() => {});
};

// 复制题目
const copyQuestion = (groupId: number, questionId: number) => {
  const group = paper.questionGroups.find(g => g.groupId === groupId);
  if (group) {
    const question = group.questions.find(
      (q: any) => q.questionId === questionId
    );
    if (question) {
      const newQuestion = JSON.parse(JSON.stringify(question));
      newQuestion.questionId = Date.now();
      newQuestion.sortOrder = group.questions.length;
      group.questions.push(newQuestion);
      activeQuestionId.value = newQuestion.questionId;
      updateTotals();
      ElMessage.success("复制成功");
    }
  }
};

// 添加选项
const addOption = (question: any) => {
  const keys = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const nextKey =
    keys[question.options.length] || `选项${question.options.length + 1}`;
  question.options.push({ key: nextKey, content: "" });
};

// 删除选项
const removeOption = (question: any, index: number) => {
  if (question.options.length > 2) {
    question.options.splice(index, 1);
    const keys = ["A", "B", "C", "D", "E", "F", "G", "H"];
    question.options.forEach((opt: any, i: number) => {
      opt.key = keys[i] || `选项${i + 1}`;
    });
  } else {
    ElMessage.warning("至少保留两个选项");
  }
};

// 添加填空
const addBlank = (question: any) => {
  question.blanks.push({ answer: "" });
};

// 删除填空
const removeBlank = (question: any, index: number) => {
  if (question.blanks.length > 1) {
    question.blanks.splice(index, 1);
  } else {
    ElMessage.warning("至少保留一个填空");
  }
};

// 插入填空占位符到题干
const insertBlankPlaceholder = (question: any) => {
  const stemRef = stemRefs.value.get(question.questionId);
  if (stemRef) {
    const textarea = stemRef.$el?.querySelector("textarea") || stemRef;
    if (textarea && textarea.selectionStart !== undefined) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = question.stem || "";
      const placeholder = "{blank}";
      question.stem = text.slice(0, start) + placeholder + text.slice(end);
      nextTick(() => {
        const newPos = start + placeholder.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      });
    } else {
      question.stem = (question.stem || "") + "{blank}";
    }
  } else {
    question.stem = (question.stem || "") + "{blank}";
  }
  // 同步更新 blanks 数组
  syncBlanksWithStem(question);
};

// 解析题干中的占位符数量
const parseBlankCount = (stem: string): number => {
  if (!stem) return 0;
  const matches = stem.match(/\{blank\}/g);
  return matches ? matches.length : 0;
};

// 同步 blanks 数组与题干中的占位符
const syncBlanksWithStem = (question: any) => {
  if (question.questionType !== "input") return;

  const blankCount = parseBlankCount(question.stem);
  const currentCount = question.blanks?.length || 0;

  if (blankCount > currentCount) {
    // 需要添加更多空
    for (let i = currentCount; i < blankCount; i++) {
      question.blanks.push({ answer: "" });
    }
  } else if (blankCount < currentCount && blankCount > 0) {
    // 需要减少空（保留已有答案）
    question.blanks = question.blanks.slice(0, blankCount);
  } else if (blankCount === 0 && currentCount === 0) {
    // 确保至少有一个空
    question.blanks = [{ answer: "" }];
  }
};

// 监听填空题题干变化
const watchBlankStemChange = (question: any) => {
  if (question.questionType === "input") {
    syncBlanksWithStem(question);
  }
};

// 渲染带填空的题干（用于预览）
const renderBlankStem = (
  stem: string,
  blanks: any[],
  showAnswer = false
): string => {
  if (!stem) return "未填写题目";
  let index = 0;
  return stem.replace(/\{blank\}/g, () => {
    const answer = blanks?.[index]?.answer || "";
    index++;
    if (showAnswer && answer) {
      return `<span class="blank-answer-inline">${answer}</span>`;
    }
    return '<span class="blank-placeholder">________</span>';
  });
};

// 获取填空题占位符数量提示
const getBlankCountHint = (question: any): string => {
  if (question.questionType !== "input") return "";
  const count = parseBlankCount(question.stem);
  const blankCount = question.blanks?.length || 0;
  if (count === 0) return "未检测到填空占位符";
  if (count === blankCount) return `已检测到 ${count} 个填空`;
  return `检测到 ${count} 个填空，当前 ${blankCount} 个答案`;
};

// 滚动到题目
const scrollToQuestion = (questionId: number) => {
  activeQuestionId.value = questionId;
  const element = document.getElementById(`question-${questionId}`);
  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "center" });
  }
};

// 大纲拖拽排序
const outlineQuestions = computed({
  get: () => {
    const questions: any[] = [];
    paper.questionGroups.forEach((group, groupIndex) => {
      group.questions.forEach((q: any, qIndex: number) => {
        questions.push({
          ...q,
          groupId: group.groupId,
          groupIndex,
          globalIndex: getGlobalQuestionIndex(groupIndex, qIndex)
        });
      });
    });
    return questions;
  },
  set: (newOrder: any[]) => {
    const groupMap = new Map<string, any[]>();
    newOrder.forEach(q => {
      const type = q.questionType;
      if (!groupMap.has(type)) {
        groupMap.set(type, []);
      }
      groupMap.get(type)!.push(q);
    });

    const newGroups: any[] = [];
    groupMap.forEach((questions, type) => {
      const typeInfo = questionTypes.find(t => t.id === type);
      newGroups.push({
        groupId: Date.now() + newGroups.length,
        groupName: typeInfo?.label || "题目组",
        questionType: type,
        questions: questions.map((q, i) => ({ ...q, sortOrder: i })),
        sortOrder: newGroups.length
      });
    });

    paper.questionGroups = newGroups;
    updateTotals();
  }
});

// 拖拽状态
const isDragging = ref(false);
const isDragOver = ref(false);
let draggedGroupIndex: number | null = null;
const dragOverGroupIndex = ref<number | null>(null);

// 重置自动保存倒计时
const resetAutoSaveCountdown = () => {
  autoSaveSeconds.value = 30;
};

// 启动自动保存
const startAutoSave = () => {
  autoSaveCountdown = setInterval(() => {
    if (autoSaveEnabled.value && hasUnsavedChanges.value) {
      if (autoSaveSeconds.value > 0) {
        autoSaveSeconds.value--;
      }
      if (autoSaveSeconds.value <= 0) {
        savePaper(true);
        resetAutoSaveCountdown();
      }
    }
  }, 1000);
};

// 保存试卷
const savePaper = async (isAutoSave = false) => {
  if (!paper.title.trim()) {
    if (!isAutoSave) {
      ElMessage.warning("请输入试卷标题");
    }
    return;
  }

  autoSaveStatus.value = "saving";
  try {
    const paperData = {
      title: paper.title,
      description: paper.description,
      courseId: paper.courseId || 0,
      timeLimit: paper.timeLimit,
      startTime: paper.startTime,
      endTime: paper.endTime,
      questionGroups: paper.questionGroups,
      settings: paper.settings,
      antiCheat: paper.antiCheat,
      retake: paper.retake,
      scoring: paper.scoring
    };

    if (isEditMode.value) {
      await updatePaper({
        paperId: Number(paperId.value),
        ...paperData
      } as any);
    } else {
      const res = await createPaper(paperData as any);
      if (res.code === 0 && res.data?.paperId) {
        // 创建成功后可以更新URL
      }
    }
    autoSaveStatus.value = "saved";
    hasUnsavedChanges.value = false;
    resetAutoSaveCountdown();
    if (!isAutoSave) {
      ElMessage.success("保存成功");
    }
  } catch {
    autoSaveStatus.value = "error";
    if (!isAutoSave) {
      ElMessage.error("保存失败");
    }
  }
};

// 预览试卷
const previewPaper = () => {
  if (paper.questionGroups.length === 0) {
    ElMessage.warning("请先添加题目");
    return;
  }
  previewDialogVisible.value = true;
};

// 预览试卷（带答案）
const previewPaperWithAnswer = () => {
  if (paper.questionGroups.length === 0) {
    ElMessage.warning("请先添加题目");
    return;
  }
  previewWithAnswerDialogVisible.value = true;
};

// 获取题目答案显示文本
const getAnswerText = (question: any) => {
  if (question.questionType === "radio" || question.questionType === "judge") {
    return question.correctAnswer || "未设置";
  } else if (question.questionType === "checkbox") {
    return question.correctAnswers?.length > 0
      ? question.correctAnswers.join(", ")
      : "未设置";
  } else if (question.questionType === "input") {
    return (
      question.blanks
        ?.map((b: any, i: number) => `第${i + 1}空: ${b.answer || "未设置"}`)
        .join("; ") || "未设置"
    );
  } else if (
    question.questionType === "textarea" ||
    question.questionType === "textarea-essay"
  ) {
    return question.referenceAnswer || "未设置参考答案";
  } else if (question.questionType === "ordering") {
    return question.correctOrder || "未设置";
  }
  return "未设置";
};

// 打印试卷
const printPaper = () => {
  window.print();
};

// ========== 发布对话框相关 ==========
const publishDialogVisible = ref(false);
const publishTargetType = ref<number>(PublishTargetType.ALL);
const publishSelectedCourseIds = ref<number[]>([]);
const publishStudentList = ref<PublishTargetStudent[]>([]);
const publishSelectedStudentIds = ref<number[]>([]);
const publishStudentLoading = ref(false);
const publishStudentKeyword = ref("");
const publishFilterCourseId = ref<number | null>(null);
const publishSubmitting = ref(false);

// 过滤后的学生列表
const filteredStudentList = computed(() => {
  if (!publishStudentKeyword.value) return publishStudentList.value;
  const kw = publishStudentKeyword.value.toLowerCase();
  return publishStudentList.value.filter(
    s =>
      s.studentName.toLowerCase().includes(kw) ||
      s.studentNo?.toLowerCase().includes(kw)
  );
});

// 发布试卷 - 打开对话框
const publishPaperHandler = () => {
  if (!paper.title.trim()) {
    ElMessage.warning("请输入试卷标题");
    return;
  }
  if (paper.questionGroups.length === 0) {
    ElMessage.warning("请至少添加一道题目");
    return;
  }
  if (!paper.startTime || !paper.endTime) {
    ElMessage.warning("请设置考试起止时间");
    settingsPanelVisible.value = true;
    return;
  }
  // 重置发布对话框状态
  publishTargetType.value = PublishTargetType.ALL;
  publishSelectedCourseIds.value = [];
  publishSelectedStudentIds.value = [];
  publishStudentList.value = [];
  publishStudentKeyword.value = "";
  publishFilterCourseId.value = null;
  publishDialogVisible.value = true;
};

// 切换发布目标类型时的处理
const onPublishTargetTypeChange = (val: number) => {
  publishSelectedCourseIds.value = [];
  publishSelectedStudentIds.value = [];
  publishStudentList.value = [];
  publishStudentKeyword.value = "";
  publishFilterCourseId.value = null;
  if (val === PublishTargetType.STUDENT) {
    fetchPublishStudents();
  }
};

// 加载学生列表
const fetchPublishStudents = async () => {
  publishStudentLoading.value = true;
  try {
    const params: any = { courseId: publishFilterCourseId.value || 0 };
    const res = await getPublishStudents(params);
    if (res.code === 0) {
      publishStudentList.value = res.data || [];
    }
  } catch (e) {
    console.error("加载学生列表失败", e);
  } finally {
    publishStudentLoading.value = false;
  }
};

// 按课程筛选学生
const onFilterCourseChange = () => {
  publishSelectedStudentIds.value = [];
  fetchPublishStudents();
};

// 全选/取消全选学生
const toggleSelectAllStudents = () => {
  const visible = filteredStudentList.value;
  if (publishSelectedStudentIds.value.length === visible.length) {
    publishSelectedStudentIds.value = [];
  } else {
    publishSelectedStudentIds.value = visible.map(s => s.studentId);
  }
};

// 确认发布
const confirmPublish = async () => {
  if (
    publishTargetType.value === PublishTargetType.CLASS &&
    publishSelectedCourseIds.value.length === 0
  ) {
    ElMessage.warning("请选择至少一个课程");
    return;
  }
  if (
    publishTargetType.value === PublishTargetType.STUDENT &&
    publishSelectedStudentIds.value.length === 0
  ) {
    ElMessage.warning("请选择至少一个学生");
    return;
  }

  publishSubmitting.value = true;
  try {
    const targetIds =
      publishTargetType.value === PublishTargetType.CLASS
        ? publishSelectedCourseIds.value
        : publishTargetType.value === PublishTargetType.STUDENT
          ? publishSelectedStudentIds.value
          : [];

    if (isNativeWebViewRuntime()) {
      logNativeFallback("原生演示模式下模拟发布试卷", {
        paperId: Number(paperId.value) || Date.now(),
        targetType: publishTargetType.value,
        targetIds
      });
      ElMessage.success("试卷发布成功！");
      publishDialogVisible.value = false;
      return;
    }

    const res = await publishPaperAdvanced({
      paperId: Number(paperId.value) || Date.now(),
      config: {
        targetType: publishTargetType.value,
        targetIds,
        startTime: paper.startTime,
        endTime: paper.endTime,
        shuffleQuestions: paper.settings.shuffleQuestions,
        shuffleOptions: paper.settings.shuffleOptions,
        showAnalysis: paper.settings.showScore,
        showCorrectAnswer: paper.settings.allowReview,
        antiCheat: paper.antiCheat,
        retake: paper.retake,
        scoring: paper.scoring
      }
    });

    if (res.code === 0) {
      ElMessage.success("试卷发布成功！");
      publishDialogVisible.value = false;
    } else {
      ElMessage.error(res.msg || "发布失败");
    }
  } catch {
    ElMessage.error("发布失败");
  } finally {
    publishSubmitting.value = false;
  }
};

// 保存为模板对话框
const saveAsTemplateDialogVisible = ref(false);
const templateForm = ref({
  name: "",
  description: ""
});

// 打开保存为模板对话框
const openSaveAsTemplateDialog = () => {
  if (paper.questionGroups.length === 0) {
    ElMessage.warning("请先添加题目再保存为模板");
    return;
  }
  templateForm.value = {
    name: paper.title || "",
    description: paper.description || ""
  };
  saveAsTemplateDialogVisible.value = true;
};

// 保存为模板
const saveAsTemplate = async () => {
  if (!templateForm.value.name.trim()) {
    ElMessage.warning("请输入模板名称");
    return;
  }

  try {
    const res = await saveAsTemplateApi({
      name: templateForm.value.name,
      description: templateForm.value.description,
      questionGroups: paper.questionGroups
    });
    if (res.code === 0) {
      ElMessage.success("已保存为私有模板");
      saveAsTemplateDialogVisible.value = false;
    } else {
      ElMessage.error(res.msg || "保存失败");
    }
  } catch (error) {
    console.error("保存模板失败:", error);
    ElMessage.error("保存模板失败");
  }
};

// 返回
const goBack = () => {
  if (hasUnsavedChanges.value) {
    ElMessageBox.confirm("有未保存的更改，是否保存后再离开？", "提示", {
      confirmButtonText: "保存并离开",
      cancelButtonText: "不保存",
      distinguishCancelAndClose: true,
      type: "warning"
    })
      .then(() => {
        savePaper().then(() => {
          hasUnsavedChanges.value = false;
          router.back();
        });
      })
      .catch(action => {
        if (action === "cancel") {
          hasUnsavedChanges.value = false;
          router.back();
        }
      });
  } else {
    router.back();
  }
};

// 拖拽事件
const onDragStart = (event: DragEvent, typeId: string) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData("text/plain", typeId);
    event.dataTransfer.effectAllowed = "copy";
  }
  isDragging.value = true;
};

const onDragEnd = () => {
  isDragging.value = false;
  isDragOver.value = false;
};

const onDrop = (event: DragEvent) => {
  event.preventDefault();
  event.stopPropagation();
  isDragOver.value = false;
  isDragging.value = false;

  const typeId = event.dataTransfer?.getData("text/plain");
  if (typeId) {
    addQuestionGroup(typeId);
    const typeName = questionTypes.find(t => t.id === typeId)?.label || "题目";
    ElMessage.success(`已添加${typeName}`);
  }
};

const onDragOver = (event: DragEvent) => {
  event.preventDefault();
  event.stopPropagation();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "copy";
  }
};

const onDragEnter = (event: DragEvent) => {
  event.preventDefault();
  isDragOver.value = true;
};

const onDragLeave = (event: DragEvent) => {
  event.preventDefault();
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const x = event.clientX;
  const y = event.clientY;
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
    isDragOver.value = false;
  }
};

// 题型组拖拽排序
const onGroupDragStart = (event: DragEvent, groupIndex: number) => {
  draggedGroupIndex = groupIndex;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(groupIndex));
  }
};

const onGroupDragEnd = () => {
  draggedGroupIndex = null;
  dragOverGroupIndex.value = null;
};

const onGroupDragOver = (event: DragEvent, groupIndex: number) => {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
  dragOverGroupIndex.value = groupIndex;
};

const onGroupDrop = (event: DragEvent, targetGroupIndex: number) => {
  event.preventDefault();
  event.stopPropagation();

  if (draggedGroupIndex !== null && draggedGroupIndex !== targetGroupIndex) {
    const draggedGroup = paper.questionGroups[draggedGroupIndex];
    paper.questionGroups.splice(draggedGroupIndex, 1);

    const insertIndex =
      draggedGroupIndex < targetGroupIndex
        ? targetGroupIndex - 1
        : targetGroupIndex;
    paper.questionGroups.splice(insertIndex, 0, draggedGroup);

    updateTotals();
  }

  draggedGroupIndex = null;
  dragOverGroupIndex.value = null;
};

// 题目助手相关
const questionAssistantVisible = ref(false);
const currentEditingQuestion = ref<any>(null);
const currentEditingGroupId = ref<number | null>(null);

// 双击 Ctrl/Command 键检测
let lastCtrlKeyTime = 0;
const DOUBLE_CLICK_THRESHOLD = 300; // 双击间隔阈值（毫秒）

// 打开题目助手
const openQuestionAssistant = (question?: any, groupId?: number) => {
  currentEditingQuestion.value = question || null;
  currentEditingGroupId.value = groupId || null;
  questionAssistantVisible.value = true;
};

// 应用题目助手的结果
const applyQuestionAssistantResult = (data: any) => {
  const { type, questions } = data;

  if (questions && questions.length > 0) {
    const sourceQuestion = questions[0];

    // 如果有当前编辑的题目，则填充到当前题目
    if (currentEditingQuestion.value && currentEditingGroupId.value) {
      const group = paper.questionGroups.find(
        g => g.groupId === currentEditingGroupId.value
      );
      if (group) {
        const targetQuestion = group.questions.find(
          (q: any) => q.questionId === currentEditingQuestion.value.questionId
        );
        if (targetQuestion) {
          // 填充题干
          targetQuestion.stem = sourceQuestion.stem || targetQuestion.stem;

          // 填充选项（如果有）
          if (sourceQuestion.options && targetQuestion.options) {
            targetQuestion.options = sourceQuestion.options.map(
              (opt: any, index: number) => ({
                key:
                  ["A", "B", "C", "D", "E", "F", "G", "H"][index] ||
                  `选项${index + 1}`,
                content: opt.content || ""
              })
            );
          }

          // 填充答案
          if (sourceQuestion.correctAnswer !== undefined) {
            targetQuestion.correctAnswer = sourceQuestion.correctAnswer;
          }
          if (sourceQuestion.correctAnswers !== undefined) {
            targetQuestion.correctAnswers = sourceQuestion.correctAnswers;
          }
          if (sourceQuestion.blanks !== undefined) {
            targetQuestion.blanks = sourceQuestion.blanks;
          }
          if (sourceQuestion.referenceAnswer !== undefined) {
            targetQuestion.referenceAnswer = sourceQuestion.referenceAnswer;
          }

          // 填充解析
          if (sourceQuestion.analysis) {
            targetQuestion.analysis = sourceQuestion.analysis;
          }

          ElMessage.success(
            type === "ai" ? "AI 生成的题目已应用" : "题库题目已应用"
          );
        }
      }
    } else {
      // 如果没有当前编辑的题目，则添加新题目
      questions.forEach((q: any) => {
        // 查找或创建对应题型的分组
        let group = paper.questionGroups.find(g => g.questionType === q.type);
        if (!group) {
          const typeInfo = questionTypes.find(t => t.id === q.type);
          const groupId = Date.now();
          group = {
            groupId,
            groupName: typeInfo?.label || "题目组",
            questionType: q.type,
            questions: [],
            sortOrder: paper.questionGroups.length
          };
          paper.questionGroups.push(group);
        }

        // 添加题目
        const questionId = Date.now() + Math.random();
        const newQuestion: any = {
          questionId,
          questionType: q.type,
          stem: q.stem || "",
          points: q.points || 5,
          analysis: q.analysis || "",
          sortOrder: group.questions.length
        };

        // 根据题型设置选项和答案
        if (q.type === "radio" || q.type === "checkbox") {
          newQuestion.options = q.options || [
            { key: "A", content: "" },
            { key: "B", content: "" },
            { key: "C", content: "" },
            { key: "D", content: "" }
          ];
          if (q.type === "radio") {
            newQuestion.correctAnswer = q.correctAnswer || "";
          } else {
            newQuestion.correctAnswers = q.correctAnswers || [];
          }
        } else if (q.type === "judge") {
          newQuestion.options = [
            { key: "T", content: "正确" },
            { key: "F", content: "错误" }
          ];
          newQuestion.correctAnswer = q.correctAnswer || "";
        } else if (q.type === "input") {
          newQuestion.blanks = q.blanks || [{ answer: "" }];
        } else if (q.type === "textarea") {
          newQuestion.referenceAnswer = q.referenceAnswer || "";
        }

        group.questions.push(newQuestion);
        activeQuestionId.value = questionId;
      });

      updateTotals();
      ElMessage.success(`已添加 ${questions.length} 道题目`);
    }
  }
};

// 归档题目到题库
const archiveQuestionHandler = async (question: any, groupId: number) => {
  const group = paper.questionGroups.find(g => g.groupId === groupId);
  if (!group) return;

  const questionData = {
    type: question.questionType,
    typeName: group.groupName,
    stem: question.stem,
    options: question.options,
    correctAnswer: question.correctAnswer,
    correctAnswers: question.correctAnswers,
    blanks: question.blanks,
    referenceAnswer: question.referenceAnswer,
    analysis: question.analysis,
    points: question.points,
    difficulty: "medium",
    difficultyName: "中等"
  };

  try {
    const res = await archiveQuestionToBankApi({
      questions: [questionData as any]
    });
    if (res.code === 0) {
      ElMessage.success("题目已归档到题库");
    } else {
      ElMessage.error(res.msg || "归档失败");
    }
  } catch (error) {
    console.error("归档失败:", error);
    ElMessage.error("归档失败");
  }
};

// AI 分析试卷
const analyzeWithAI = async () => {
  if (paper.questionGroups.length === 0) {
    ElMessage.warning("请先添加题目再进行分析");
    return;
  }

  aiAnalyzing.value = true;
  aiAnalysisResult.value = null;

  try {
    const questionGroups = paper.questionGroups.map(group => ({
      groupName: group.groupName,
      questionType: group.questionType,
      questions: group.questions.map((q: any) => ({
        stem: q.stem || "",
        points: q.points || 0,
        difficulty: q.difficulty,
        knowledgePoints: q.knowledgePoints || []
      }))
    }));

    const res = await aiAnalyzePaper({ questionGroups });
    if (res.code === 0) {
      aiAnalysisResult.value = res.data;
      ElMessage.success("AI 分析完成");
    } else {
      ElMessage.error(res.msg || "分析失败");
    }
  } catch {
    ElMessage.error("AI 分析失败，请重试");
  } finally {
    aiAnalyzing.value = false;
  }
};

// 获取难度颜色
const getDifficultyColor = (score: number) => {
  if (score <= 2) return "#739CF9";
  if (score <= 3) return "#e6a23c";
  return "#f56c6c";
};

// 获取评分颜色
const getScoreColor = (score: number) => {
  if (score >= 80) return "#739CF9";
  if (score >= 60) return "#e6a23c";
  return "#f56c6c";
};

// 饼状图颜色
const pieColors = [
  "#739CF9",
  "#a1b5f7",
  "#f59e0b",
  "#ef4444",
  "#64748b",
  "#80C8FA",
  "#ec4899",
  "#f97316"
];

// 饼状图样式（使用 conic-gradient）
const pieChartStyle = computed(() => {
  if (!aiAnalysisResult.value?.questionTypeDistribution?.length) {
    return { background: "#e4e7ed" };
  }
  const distribution = aiAnalysisResult.value.questionTypeDistribution;
  const gradientParts: string[] = [];
  let currentAngle = 0;
  distribution.forEach((item, idx) => {
    const startAngle = currentAngle;
    const endAngle = currentAngle + (item.percentage / 100) * 360;
    const color = pieColors[idx % pieColors.length];
    gradientParts.push(`${color} ${startAngle}deg ${endAngle}deg`);
    currentAngle = endAngle;
  });
  return {
    background: `conic-gradient(${gradientParts.join(", ")})`
  };
});

// 批量归档试卷中的题目到题库
const archiveAllQuestionsToBank = async () => {
  const allQuestions: any[] = [];
  paper.questionGroups.forEach(group => {
    group.questions.forEach((q: any) => {
      if (q.stem && q.stem.trim()) {
        allQuestions.push({
          type: q.questionType,
          typeName: group.groupName,
          stem: q.stem,
          options: q.options,
          correctAnswer: q.correctAnswer,
          correctAnswers: q.correctAnswers,
          blanks: q.blanks,
          referenceAnswer: q.referenceAnswer,
          analysis: q.analysis,
          points: q.points,
          difficulty: "medium",
          difficultyName: "中等"
        });
      }
    });
  });

  if (allQuestions.length === 0) {
    ElMessage.warning("没有可归档的题目");
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确定要将试卷中的 ${allQuestions.length} 道题目归档到题库吗？`,
      "批量归档确认",
      {
        confirmButtonText: "确定归档",
        cancelButtonText: "取消",
        type: "info"
      }
    );

    const res = await batchArchiveToBank({ questions: allQuestions });
    if (res.code === 0) {
      ElMessage.success(`已成功归档 ${allQuestions.length} 道题目到题库`);
    } else {
      ElMessage.error(res.msg || "批量归档失败");
    }
  } catch {
    // 用户取消
  }
};

// 键盘快捷键
const handleKeydown = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "s") {
    event.preventDefault();
    savePaper();
  }
};

// 处理 Ctrl/Command 键的按下事件（用于双击检测）
const handleKeydownForAssistant = (event: KeyboardEvent) => {
  // 检测 Ctrl 或 Command 键
  if (event.key === "Control" || event.key === "Meta") {
    const currentTime = Date.now();
    if (currentTime - lastCtrlKeyTime < DOUBLE_CLICK_THRESHOLD) {
      // 双击检测成功，打开题目助手
      event.preventDefault();

      // 如果有当前选中的题目，则传递给助手
      if (activeQuestionId.value) {
        for (const group of paper.questionGroups) {
          const question = group.questions.find(
            (q: any) => q.questionId === activeQuestionId.value
          );
          if (question) {
            openQuestionAssistant(question, group.groupId);
            break;
          }
        }
      } else {
        openQuestionAssistant();
      }

      lastCtrlKeyTime = 0; // 重置
    } else {
      lastCtrlKeyTime = currentTime;
    }
  }
};

// 题干输入框引用映射
const stemRefs = ref<Map<number, any>>(new Map());

// 设置题干输入框引用
const setStemRef = (questionId: number, el: any) => {
  if (el) {
    stemRefs.value.set(questionId, el);
  }
};

// 插入 LaTeX 公式到题干
const insertLatexToStem = (question: any, latex: string) => {
  const stemRef = stemRefs.value.get(question.questionId);
  if (stemRef) {
    // 获取 textarea 元素
    const textarea = stemRef.$el?.querySelector("textarea") || stemRef;
    if (textarea && textarea.selectionStart !== undefined) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = question.stem || "";
      // 在光标位置插入公式
      question.stem = text.slice(0, start) + latex + text.slice(end);
      // 设置光标位置到插入内容之后
      nextTick(() => {
        const newPos = start + latex.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      });
    } else {
      // 如果无法获取光标位置，追加到末尾
      question.stem = (question.stem || "") + latex;
    }
  } else {
    // 如果没有引用，追加到末尾
    question.stem = (question.stem || "") + latex;
  }
  ElMessage.success("公式已插入");
};

// 离开页面前确认
onBeforeRouteLeave((to, from, next) => {
  if (hasUnsavedChanges.value) {
    ElMessageBox.confirm("有未保存的更改，是否保存后再离开？", "提示", {
      confirmButtonText: "保存并离开",
      cancelButtonText: "不保存",
      distinguishCancelAndClose: true,
      type: "warning"
    })
      .then(() => {
        savePaper().then(() => next());
      })
      .catch(action => {
        if (action === "cancel") {
          // 用户选择不保存，允许导航
          hasUnsavedChanges.value = false;
          next();
        } else {
          // 用户关闭对话框，阻止导航
          next(false);
        }
      });
  } else {
    next();
  }
});

// 系统模板数据（前端硬编码）
const systemTemplatesData: Record<string, any> = {
  "1": {
    title: "标准考试模板",
    description: "包含单选、多选、判断、填空、简答题型，适合期中期末考试",
    timeLimit: 120,
    questionGroups: [
      {
        groupId: 1,
        groupName: "单选题",
        questionType: "radio",
        questions: [
          {
            questionId: 101,
            questionType: "radio",
            stem: "",
            points: 5,
            options: [
              { key: "A", content: "" },
              { key: "B", content: "" },
              { key: "C", content: "" },
              { key: "D", content: "" }
            ],
            correctAnswer: ""
          }
        ],
        sortOrder: 0
      },
      {
        groupId: 2,
        groupName: "多选题",
        questionType: "checkbox",
        questions: [
          {
            questionId: 201,
            questionType: "checkbox",
            stem: "",
            points: 5,
            options: [
              { key: "A", content: "" },
              { key: "B", content: "" },
              { key: "C", content: "" },
              { key: "D", content: "" }
            ],
            correctAnswers: []
          }
        ],
        sortOrder: 1
      },
      {
        groupId: 3,
        groupName: "判断题",
        questionType: "judge",
        questions: [
          {
            questionId: 301,
            questionType: "judge",
            stem: "",
            points: 3,
            options: [
              { key: "T", content: "正确" },
              { key: "F", content: "错误" }
            ],
            correctAnswer: ""
          }
        ],
        sortOrder: 2
      },
      {
        groupId: 4,
        groupName: "填空题",
        questionType: "input",
        questions: [
          {
            questionId: 401,
            questionType: "input",
            stem: "",
            points: 5,
            blanks: [{ answer: "" }]
          }
        ],
        sortOrder: 3
      },
      {
        groupId: 5,
        groupName: "简答题",
        questionType: "textarea",
        questions: [
          {
            questionId: 501,
            questionType: "textarea",
            stem: "",
            points: 8,
            referenceAnswer: ""
          }
        ],
        sortOrder: 4
      }
    ]
  },
  "2": {
    title: "快速测验模板",
    description: "仅包含客观题，适合课堂小测和随堂练习",
    timeLimit: 30,
    questionGroups: [
      {
        groupId: 1,
        groupName: "单选题",
        questionType: "radio",
        questions: [
          {
            questionId: 101,
            questionType: "radio",
            stem: "",
            points: 5,
            options: [
              { key: "A", content: "" },
              { key: "B", content: "" },
              { key: "C", content: "" },
              { key: "D", content: "" }
            ],
            correctAnswer: ""
          },
          {
            questionId: 102,
            questionType: "radio",
            stem: "",
            points: 5,
            options: [
              { key: "A", content: "" },
              { key: "B", content: "" },
              { key: "C", content: "" },
              { key: "D", content: "" }
            ],
            correctAnswer: ""
          }
        ],
        sortOrder: 0
      },
      {
        groupId: 2,
        groupName: "多选题",
        questionType: "checkbox",
        questions: [
          {
            questionId: 201,
            questionType: "checkbox",
            stem: "",
            points: 10,
            options: [
              { key: "A", content: "" },
              { key: "B", content: "" },
              { key: "C", content: "" },
              { key: "D", content: "" }
            ],
            correctAnswers: []
          },
          {
            questionId: 202,
            questionType: "checkbox",
            stem: "",
            points: 10,
            options: [
              { key: "A", content: "" },
              { key: "B", content: "" },
              { key: "C", content: "" },
              { key: "D", content: "" }
            ],
            correctAnswers: []
          }
        ],
        sortOrder: 1
      },
      {
        groupId: 3,
        groupName: "判断题",
        questionType: "judge",
        questions: [
          {
            questionId: 301,
            questionType: "judge",
            stem: "",
            points: 5,
            options: [
              { key: "T", content: "正确" },
              { key: "F", content: "错误" }
            ],
            correctAnswer: ""
          }
        ],
        sortOrder: 2
      }
    ]
  },
  "3": {
    title: "综合能力测试",
    description: "包含材料分析、论述等主观题，适合综合能力评估",
    timeLimit: 90,
    questionGroups: [
      {
        groupId: 1,
        groupName: "单选题",
        questionType: "radio",
        questions: [
          {
            questionId: 101,
            questionType: "radio",
            stem: "",
            points: 5,
            options: [
              { key: "A", content: "" },
              { key: "B", content: "" },
              { key: "C", content: "" },
              { key: "D", content: "" }
            ],
            correctAnswer: ""
          }
        ],
        sortOrder: 0
      },
      {
        groupId: 2,
        groupName: "简答题",
        questionType: "textarea",
        questions: [
          {
            questionId: 201,
            questionType: "textarea",
            stem: "",
            points: 15,
            referenceAnswer: ""
          },
          {
            questionId: 202,
            questionType: "textarea",
            stem: "",
            points: 20,
            referenceAnswer: ""
          },
          {
            questionId: 203,
            questionType: "textarea",
            stem: "",
            points: 35,
            referenceAnswer: ""
          }
        ],
        sortOrder: 1
      }
    ]
  },
  "4": {
    title: "学情调查问卷",
    description: "用于学情调查，了解学生学习情况",
    timeLimit: 30,
    questionGroups: [
      {
        groupId: 1,
        groupName: "单选题",
        questionType: "radio",
        questions: [
          {
            questionId: 101,
            questionType: "radio",
            stem: "",
            points: 0,
            options: [
              { key: "A", content: "" },
              { key: "B", content: "" },
              { key: "C", content: "" },
              { key: "D", content: "" }
            ],
            correctAnswer: ""
          },
          {
            questionId: 102,
            questionType: "radio",
            stem: "",
            points: 0,
            options: [
              { key: "A", content: "" },
              { key: "B", content: "" },
              { key: "C", content: "" },
              { key: "D", content: "" }
            ],
            correctAnswer: ""
          }
        ],
        sortOrder: 0
      },
      {
        groupId: 2,
        groupName: "多选题",
        questionType: "checkbox",
        questions: [
          {
            questionId: 201,
            questionType: "checkbox",
            stem: "",
            points: 0,
            options: [
              { key: "A", content: "" },
              { key: "B", content: "" },
              { key: "C", content: "" },
              { key: "D", content: "" }
            ],
            correctAnswers: []
          }
        ],
        sortOrder: 1
      },
      {
        groupId: 3,
        groupName: "简答题",
        questionType: "textarea",
        questions: [
          {
            questionId: 301,
            questionType: "textarea",
            stem: "",
            points: 0,
            referenceAnswer: ""
          },
          {
            questionId: 302,
            questionType: "textarea",
            stem: "",
            points: 0,
            referenceAnswer: ""
          }
        ],
        sortOrder: 2
      }
    ]
  }
};

// 加载模板数据
const loadTemplate = async (templateId: string) => {
  // 检查是否是系统模板（ID 1-4，没有 my- 前缀）
  if (!templateId.startsWith("my-") && systemTemplatesData[templateId]) {
    const template = systemTemplatesData[templateId];
    paper.title = template.title || "";
    paper.description = template.description || "";
    paper.timeLimit = template.timeLimit || 90;
    paper.questionGroups = JSON.parse(
      JSON.stringify(template.questionGroups || [])
    );
    updateTotals();
    hasUnsavedChanges.value = false;
    ElMessage.success(`已加载系统模板：${template.title}`);
    return;
  }

  // 私有模板从 API 获取
  try {
    const actualId = templateId.startsWith("my-")
      ? templateId.slice(3)
      : templateId;
    const res = await getTemplateDetail(actualId);
    if (res.code === 0 && res.data) {
      const template = res.data;
      paper.title = template.title || "";
      paper.description = template.description || "";
      paper.timeLimit = template.timeLimit || 90;
      paper.questionGroups = template.questionGroups || [];
      updateTotals();
      hasUnsavedChanges.value = false;
      ElMessage.success(`已加载模板：${template.title}`);
    } else {
      ElMessage.error("模板加载失败");
    }
  } catch (error) {
    console.error("加载模板失败:", error);
    ElMessage.error("模板加载失败");
  }
};

// 加载课程列表
const fetchCourseList = async () => {
  try {
    const res = await getCourseList();
    if (res.code === 0) {
      courseOptions.value = res.data;
    }
  } catch (e) {
    if (isNativeWebViewRuntime()) {
      logNativeFallback("加载课程列表失败，已使用原生演示课程", e);
      courseOptions.value = [
        { id: 1, name: "高等数学" },
        { id: 2, name: "大学英语" },
        { id: 3, name: "计算机基础" }
      ];
    } else {
      console.error("加载课程列表失败", e);
    }
  }
};

// 加载试卷详情（编辑模式）
const loadPaperDetail = async () => {
  try {
    const res = await getPaperDetail(Number(paperId.value));
    if (res.code === 0 && res.data) {
      const data = res.data;
      paper.title = data.title || "";
      paper.description = data.description || "";
      paper.courseId = data.courseId || null;
      paper.timeLimit = data.timeLimit || 90;
      paper.startTime = data.startTime || "";
      paper.endTime = data.endTime || "";
      paper.questionGroups = data.questionGroups || [];
      updateTotals();
      hasUnsavedChanges.value = false;
    } else if (isNativeWebViewRuntime()) {
      logNativeFallback("加载试卷失败，已使用原生演示试卷", res?.msg);
      applyNativeDemoPaperDetail();
    }
  } catch (error) {
    if (isNativeWebViewRuntime()) {
      logNativeFallback("加载试卷失败，已使用原生演示试卷", error);
      applyNativeDemoPaperDetail();
    } else {
      console.error("加载试卷失败:", error);
      ElMessage.error("加载试卷失败");
    }
  }
};

onMounted(async () => {
  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("keydown", handleKeydownForAssistant);
  startAutoSave();
  fetchCourseList();

  // 检查是否有模板参数
  const templateId = route.query.template as string;
  if (templateId) {
    await loadTemplate(templateId);
  } else if (isEditMode.value) {
    await loadPaperDetail();
  }

  if (route.query.publish === "1") {
    await nextTick();
    publishPaperHandler();
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", handleKeydown);
  document.removeEventListener("keydown", handleKeydownForAssistant);
  if (autoSaveCountdown) {
    clearInterval(autoSaveCountdown);
  }
});
</script>

<template>
  <div class="exam-paper-editor" :class="{ 'is-dark': isDark }">
    <!--顶部固定区域 -->
    <div class="editor-fixed-top">
      <!--顶部导航 -->
      <div class="editor-header">
        <div class="header-left">
          <div class="logo" @click="goBack">
            <component :is="iconComponents.LogoIcon" class="logo-icon" />
            <span class="logo-text">启明在线组卷</span>
          </div>
        </div>
        <div class="header-center">
          <el-input
            v-model="paper.title"
            placeholder="请输入试卷标题"
            class="title-input"
            maxlength="100"
          />
        </div>
        <div class="header-right">
          <span class="auto-save-status"
            ><template v-if="autoSaveEnabled && hasUnsavedChanges">
              <el-icon v-if="autoSaveStatus === 'saving'" class="is-loading">
                <Loading />
              </el-icon>
              <span v-else>{{ autoSaveSeconds }}秒后自动保存</span>
            </template>
            <template v-else-if="autoSaveStatus === 'saved'">
              <el-icon><Check /></el-icon>
              已保存
            </template></span
          >
          <el-button @click="previewPaper">
            <el-icon><View /></el-icon>
            预览
          </el-button>
          <el-button @click="savePaper()">
            <el-icon><DocumentChecked /></el-icon>
            保存
          </el-button>
          <el-button type="primary" @click="publishPaperHandler">
            <el-icon><Promotion /></el-icon>
            发布
          </el-button>
          <el-dropdown trigger="click">
            <el-button>
              更多操作
              <el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="previewPaperWithAnswer">
                  <el-icon><Document /></el-icon>
                  预览(带答案)
                </el-dropdown-item>
                <el-dropdown-item @click="openSaveAsTemplateDialog">
                  <el-icon><FolderAdd /></el-icon>
                  存为模板
                </el-dropdown-item>
                <el-dropdown-item @click="archiveAllQuestionsToBank">
                  <el-icon><Collection /></el-icon>
                  归档到题库
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <!-- 工具栏 -->
      <div class="question-toolbar">
        <div class="toolbar-hint">拖拽或点击下方题型添加到试卷：</div>
        <div class="toolbar-groups">
          <div
            v-for="group in questionTypeGroups"
            :key="group.groupLabel"
            class="toolbar-group"
          >
            <div class="toolbar-group-label">{{ group.groupLabel }}</div>
            <div class="toolbar-items">
              <div
                v-for="type in group.types"
                :key="type.id"
                class="type-item"
                draggable="true"
                @dragstart="onDragStart($event, type.id)"
                @dragend="onDragEnd"
                @click="addQuestionGroup(type.id)"
              >
                <div
                  class="type-icon-wrapper"
                  :style="{ background: `${type.color}18` }"
                >
                  <component
                    :is="iconComponents[type.icon]"
                    class="type-icon"
                    :style="{ color: type.color }"
                  />
                </div>
                <span class="type-label">{{ type.label }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 预览对话框（带答案） -->
    <el-dialog
      v-model="previewWithAnswerDialogVisible"
      title="试卷预览（带答案）"
      width="90%"
      fullscreen
      class="preview-dialog preview-with-answer-dialog"
    >
      <template #header>
        <div class="preview-header">
          <span class="preview-title">试卷预览（带答案）</span>
          <div class="preview-controls">
            <el-radio-group v-model="previewPaperSize" size="small">
              <el-radio-button value="A4">A4</el-radio-button>
              <el-radio-button value="A3">A3</el-radio-button>
            </el-radio-group>
            <div class="scale-control">
              <span>缩放：</span>
              <el-slider
                v-model="previewScale"
                :min="50"
                :max="150"
                :step="10"
                :format-tooltip="(val: number) => `${val}%`"
                style="width: 120px"
              />
              <span>{{ previewScale }}%</span>
            </div>
            <el-button type="primary" size="small" @click="printPaper">
              <el-icon><Printer /></el-icon>
              打印
            </el-button>
          </div>
        </div>
      </template>
      <div class="preview-content">
        <div
          class="preview-paper"
          :class="[`paper-${previewPaperSize.toLowerCase()}`]"
          :style="{ transform: `scale(${previewScale / 100})` }"
        >
          <h1 class="preview-paper-title">{{ paper.title || "未命名试卷" }}</h1>
          <p v-if="paper.description" class="preview-paper-desc">
            {{ paper.description }}
          </p>
          <div class="preview-paper-info">
            <span>总分：{{ paper.totalPoints }} 分</span>
            <span>题目数：{{ paper.totalQuestions }} 题</span>
            <span class="answer-badge">含答案版本</span>
          </div>
          <div class="preview-questions">
            <template
              v-for="(group, groupIndex) in paper.questionGroups"
              :key="group.groupId"
            >
              <!-- 题型组标题 -->
              <div class="preview-group-title">
                <span class="preview-group-number"
                  >{{ getChineseNumber(groupIndex + 1) }}.</span
                >
                <span class="preview-group-name">{{ group.groupName }}</span>
              </div>
              <div
                v-for="(question, qIndex) in group.questions"
                :key="question.questionId"
                class="preview-question"
              >
                <div class="preview-question-header">
                  <span class="preview-question-index">
                    {{ getGlobalQuestionIndex(groupIndex, qIndex) }}.
                  </span>
                  <span class="preview-question-type"
                    >[{{ group.groupName }}]</span
                  >
                  <span class="preview-question-points">
                    ({{ question.points }}分)
                  </span>
                </div>
                <div
                  v-if="question.questionType === 'input'"
                  class="preview-question-stem"
                  v-html="
                    renderBlankStem(question.stem, question.blanks, false)
                  "
                />
                <div v-else class="preview-question-stem">
                  {{ question.stem || "未填写题目" }}
                </div>
                <div
                  v-if="question.questionType === 'input'"
                  class="preview-question-stem"
                  v-html="renderBlankStem(question.stem, question.blanks, true)"
                />
                <div v-else class="preview-question-stem">
                  {{ question.stem || "未填写题目" }}
                </div>
                <div
                  v-if="question.options && question.options.length > 0"
                  class="preview-question-options"
                >
                  <div
                    v-for="option in question.options"
                    :key="option.key"
                    class="preview-option"
                    :class="{
                      'correct-option':
                        ((question.questionType === 'radio' ||
                          question.questionType === 'judge') &&
                          question.correctAnswer === option.key) ||
                        (question.questionType === 'checkbox' &&
                          question.correctAnswers?.includes(option.key))
                    }"
                  >
                    {{ option.key }}. {{ option.content }}
                    <el-icon
                      v-if="
                        (question.questionType === 'radio' ||
                          question.questionType === 'judge') &&
                        question.correctAnswer === option.key
                      "
                      class="correct-icon"
                      ><Check
                    /></el-icon>
                    <el-icon
                      v-if="
                        question.questionType === 'checkbox' &&
                        question.correctAnswers?.includes(option.key)
                      "
                      class="correct-icon"
                      ><Check
                    /></el-icon>
                  </div>
                </div>
                <div
                  v-if="question.questionType === 'input'"
                  class="preview-blanks"
                >
                  <span
                    v-for="(blank, i) in question.blanks"
                    :key="i"
                    class="preview-blank"
                  >
                    第{{ i + 1 }}空：<span class="blank-answer">{{
                      blank.answer || "未设置"
                    }}</span>
                  </span>
                </div>
                <div
                  v-if="
                    question.questionType === 'textarea' ||
                    question.questionType === 'textarea-essay'
                  "
                  class="preview-textarea"
                >
                  <div class="preview-answer-area" />
                </div>
                <!-- 答案显示区域 -->
                <div class="preview-answer-section">
                  <div class="answer-label">
                    <el-icon><CircleCheck /></el-icon>
                    <span>正确答案：</span>
                  </div>
                  <div class="answer-content">
                    {{ getAnswerText(question) }}
                  </div>
                </div>
                <!-- 解析显示区域 -->
                <div v-if="question.analysis" class="preview-analysis-section">
                  <div class="analysis-label">
                    <el-icon><InfoFilled /></el-icon>
                    <span>题目解析：</span>
                  </div>
                  <div class="analysis-content">{{ question.analysis }}</div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 预览对话框 -->
    <el-dialog
      v-model="previewDialogVisible"
      title="试卷预览"
      width="90%"
      fullscreen
      class="preview-dialog"
    >
      <template #header>
        <div class="preview-header">
          <span class="preview-title">试卷预览</span>
          <div class="preview-controls">
            <el-radio-group v-model="previewPaperSize" size="small">
              <el-radio-button value="A4">A4</el-radio-button>
              <el-radio-button value="A3">A3</el-radio-button>
            </el-radio-group>
            <div class="scale-control">
              <span>缩放：</span>
              <el-slider
                v-model="previewScale"
                :min="50"
                :max="150"
                :step="10"
                :format-tooltip="(val: number) => `${val}%`"
                style="width: 120px"
              />
              <span>{{ previewScale }}%</span>
            </div>
            <el-button type="primary" size="small" @click="printPaper">
              <el-icon><Printer /></el-icon>
              打印
            </el-button>
          </div>
        </div>
      </template>
      <div class="preview-content">
        <div
          class="preview-paper"
          :class="[`paper-${previewPaperSize.toLowerCase()}`]"
          :style="{ transform: `scale(${previewScale / 100})` }"
        >
          <h1 class="preview-paper-title">{{ paper.title || "未命名试卷" }}</h1>
          <p v-if="paper.description" class="preview-paper-desc">
            {{ paper.description }}
          </p>
          <div class="preview-paper-info">
            <span>总分：{{ paper.totalPoints }} 分</span>
            <span>题目数：{{ paper.totalQuestions }} 题</span>
          </div>
          <div class="preview-questions">
            <template
              v-for="(group, groupIndex) in paper.questionGroups"
              :key="group.groupId"
            >
              <!-- 题型组标题 -->
              <div class="preview-group-title">
                <span class="preview-group-number"
                  >{{ getChineseNumber(groupIndex + 1) }}.</span
                >
                <span class="preview-group-name">{{ group.groupName }}</span>
              </div>
              <div
                v-for="(question, qIndex) in group.questions"
                :key="question.questionId"
                class="preview-question"
              >
                <div class="preview-question-header">
                  <span class="preview-question-index">
                    {{ getGlobalQuestionIndex(groupIndex, qIndex) }}.
                  </span>
                  <span class="preview-question-type"
                    >[{{ group.groupName }}]</span
                  >
                  <span class="preview-question-points">
                    ({{ question.points }}分)
                  </span>
                </div>
                <div class="preview-question-stem">
                  {{ question.stem || "未填写题目" }}
                </div>
                <div
                  v-if="question.options && question.options.length > 0"
                  class="preview-question-options"
                >
                  <div
                    v-for="option in question.options"
                    :key="option.key"
                    class="preview-option"
                  >
                    {{ option.key }}. {{ option.content }}
                  </div>
                </div>
                <div
                  v-if="question.questionType === 'input'"
                  class="preview-blanks"
                >
                  <span
                    v-for="(blank, i) in question.blanks"
                    :key="i"
                    class="preview-blank"
                  >
                    ________
                  </span>
                </div>
                <div
                  v-if="question.questionType === 'textarea'"
                  class="preview-textarea"
                >
                  <div class="preview-answer-area" />
                </div>
              </div>
            </template>
          </div>
        </div></div
    ></el-dialog>

    <!-- 保存为模板对话框 -->
    <el-dialog
      v-model="saveAsTemplateDialogVisible"
      title="保存为私有模板"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="templateForm" label-width="80px">
        <el-form-item label="模板名称" required>
          <el-input
            v-model="templateForm.name"
            placeholder="请输入模板名称"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="模板描述">
          <el-input
            v-model="templateForm.description"
            type="textarea"
            placeholder="请输入模板描述（选填）"
            :rows="3"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="包含内容">
          <div class="template-preview-info">
            <span>{{ paper.totalQuestions }} 道题目</span>
            <span>{{ paper.totalPoints }} 分</span>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="saveAsTemplateDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveAsTemplate">保存模板</el-button>
      </template>
    </el-dialog>

    <div class="editor-main">
      <!-- 左侧大纲 -->
      <div class="editor-outline" :class="{ collapsed: outlineCollapsed }">
        <div class="outline-header">
          <span class="outline-title">题目大纲</span>
          <el-button
            link
            size="small"
            @click="outlineCollapsed = !outlineCollapsed"
          >
            <el-icon>
              <Fold v-if="!outlineCollapsed" />
              <Expand v-else />
            </el-icon>
          </el-button>
        </div>

        <div v-if="!outlineCollapsed" class="outline-content">
          <div class="outline-summary">
            共{{ paper.totalQuestions }} 题，{{ paper.totalPoints }} 分
          </div>

          <div v-if="paper.questionGroups.length > 0" class="outline-groups">
            <div
              v-for="(group, groupIndex) in paper.questionGroups"
              :key="group.groupId"
              class="outline-group"
              draggable="true"
              @dragstart="onGroupDragStart($event, groupIndex)"
              @dragend="onGroupDragEnd"
              @dragover="onGroupDragOver($event, groupIndex)"
              @drop="onGroupDrop($event, groupIndex)"
            >
              <div class="outline-group-header">
                <span class="group-drag-handle">
                  <component :is="iconComponents.DragIcon" class="drag-icon" />
                </span>
                <span class="group-number"
                  >{{ getChineseNumber(groupIndex + 1) }}.</span
                >
                <span class="group-name">{{ group.groupName }}</span>
                <span class="group-item-count"
                  >{{ group.questions.length }}题</span
                >
              </div>
              <div class="outline-group-items">
                <div
                  v-for="(question, qIndex) in group.questions"
                  :key="question.questionId"
                  class="outline-item"
                  :class="{ active: activeQuestionId === question.questionId }"
                  @click="scrollToQuestion(question.questionId)"
                >
                  <span class="item-index"
                    >{{ getGlobalQuestionIndex(groupIndex, qIndex) }}.</span
                  >
                  <span class="item-title">
                    {{ question.stem || "未填写题目" }}
                  </span>
                  <span class="item-points">{{ question.points }}分</span>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="outline-empty">
            <el-empty description="暂无题目" :image-size="60" />
          </div>
        </div>
      </div>

      <!-- 主内容区-->
      <div
        class="editor-content"
        :class="{ 'drag-over': isDragOver, 'is-dragging': isDragging }"
        @drop="onDrop"
        @dragover="onDragOver"
        @dragenter="onDragEnter"
        @dragleave="onDragLeave"
      >
        <div class="paper-canvas">
          <!-- 试卷描述 -->
          <div class="paper-description">
            <el-input
              v-model="paper.description"
              type="textarea"
              placeholder="请输入试卷说明（选填）"
              :rows="2"
              maxlength="500"
              show-word-limit
            />
          </div>

          <!-- AI 试卷分析面板 -->
          <div class="ai-analysis-panel">
            <div
              class="settings-toggle"
              @click="aiAnalysisPanelVisible = !aiAnalysisPanelVisible"
            >
              <el-icon><MagicStick /></el-icon>
              <span>AI 试卷分析</span>
              <el-icon
                class="toggle-arrow"
                :class="{ expanded: aiAnalysisPanelVisible }"
                ><ArrowDown
              /></el-icon>
            </div>
            <el-collapse-transition>
              <div v-show="aiAnalysisPanelVisible" class="settings-content">
                <div class="ai-analysis-actions">
                  <el-button
                    type="primary"
                    :loading="aiAnalyzing"
                    @click="analyzeWithAI"
                  >
                    <el-icon><MagicStick /></el-icon>
                    {{ aiAnalyzing ? "分析中..." : "开始 AI 分析" }}
                  </el-button>
                  <span class="analysis-hint"
                    >AI 将分析试卷难度、知识点覆盖、题型分布等</span
                  >
                </div>

                <div v-if="aiAnalysisResult" class="ai-analysis-result">
                  <div class="result-header">
                    <span class="result-title">分析结果</span>
                  </div>
                  <div class="result-metrics">
                    <div class="metric-item">
                      <span class="metric-label">难度评估</span>
                      <span
                        class="metric-value"
                        :style="{
                          color: getDifficultyColor(aiAnalysisResult.difficulty)
                        }"
                      >
                        {{ aiAnalysisResult.difficultyDescription }} ({{
                          aiAnalysisResult.difficulty
                        }}/5)
                      </span>
                    </div>
                    <div class="metric-item">
                      <span class="metric-label">知识点覆盖</span>
                      <span class="metric-value"
                        >{{ aiAnalysisResult.knowledgeCoverage }}%</span
                      >
                    </div>
                    <div class="metric-item">
                      <span class="metric-label">题型均衡度</span>
                      <span class="metric-value"
                        >{{ aiAnalysisResult.typeBalance }}%</span
                      >
                    </div>
                    <div class="metric-item">
                      <span class="metric-label">预估答题时间</span>
                      <span class="metric-value"
                        >{{ aiAnalysisResult.estimatedTime }} 分钟</span
                      >
                    </div>
                    <div class="metric-item">
                      <span class="metric-label">综合评分</span>
                      <span
                        class="metric-value"
                        :style="{
                          color: getScoreColor(aiAnalysisResult.overallScore)
                        }"
                      >
                        {{ aiAnalysisResult.overallScore }} 分
                      </span>
                    </div>
                  </div>
                  <!-- 题型分布饼状图 -->
                  <div
                    v-if="aiAnalysisResult.questionTypeDistribution?.length"
                    class="result-distribution"
                  >
                    <div class="distribution-title">题型分布</div>
                    <div class="distribution-chart">
                      <div class="pie-chart" :style="pieChartStyle" />
                      <div class="distribution-legend">
                        <div
                          v-for="(
                            item, idx
                          ) in aiAnalysisResult.questionTypeDistribution"
                          :key="idx"
                          class="legend-item"
                        >
                          <span
                            class="legend-color"
                            :style="{
                              background: pieColors[idx % pieColors.length]
                            }"
                          />
                          <span class="legend-name">{{ item.name }}</span>
                          <span class="legend-count">{{ item.count }}题</span>
                          <span class="legend-percent"
                            >{{ item.percentage }}%</span
                          >
                        </div>
                      </div>
                    </div>
                  </div>
                  <div
                    v-if="aiAnalysisResult.suggestions?.length"
                    class="result-suggestions"
                  >
                    <div class="suggestions-title">优化建议</div>
                    <ul class="suggestions-list">
                      <li
                        v-for="(
                          suggestion, idx
                        ) in aiAnalysisResult.suggestions"
                        :key="idx"
                      >
                        {{ suggestion }}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </el-collapse-transition>
          </div>

          <!-- 考试设置面板 -->
          <div class="settings-panel">
            <div
              class="settings-toggle"
              @click="settingsPanelVisible = !settingsPanelVisible"
            >
              <el-icon><Setting /></el-icon>
              <span>考试设置</span>
              <el-icon
                class="toggle-arrow"
                :class="{ expanded: settingsPanelVisible }"
                ><ArrowDown
              /></el-icon>
            </div>
            <el-collapse-transition>
              <div v-show="settingsPanelVisible" class="settings-content">
                <el-form label-width="120px" size="default">
                  <!-- 基本设置 -->
                  <div class="settings-section">
                    <h4 class="section-title">基本设置</h4>
                    <el-row :gutter="20">
                      <el-col :span="12">
                        <el-form-item label="考试开始时间">
                          <el-date-picker
                            v-model="paper.startTime"
                            type="datetime"
                            placeholder="选择开始时间"
                            style="width: 100%"
                            value-format="YYYY-MM-DD HH:mm:ss"
                          />
                        </el-form-item>
                      </el-col>
                      <el-col :span="12">
                        <el-form-item label="考试结束时间">
                          <el-date-picker
                            v-model="paper.endTime"
                            type="datetime"
                            placeholder="选择结束时间"
                            style="width: 100%"
                            value-format="YYYY-MM-DD HH:mm:ss"
                          />
                        </el-form-item>
                      </el-col>
                    </el-row>
                    <el-row :gutter="20">
                      <el-col :span="8">
                        <el-form-item label="考试时长(分钟)">
                          <el-input-number
                            v-model="paper.timeLimit"
                            :min="1"
                            :max="600"
                            style="width: 100%"
                          />
                        </el-form-item>
                      </el-col>
                      <el-col :span="8">
                        <el-form-item label="及格分数">
                          <el-input-number
                            v-model="paper.scoring.passScore"
                            :min="0"
                            :max="paper.totalPoints"
                            style="width: 100%"
                          />
                        </el-form-item>
                      </el-col>
                      <el-col :span="8">
                        <el-form-item label="所属课程">
                          <el-select
                            v-model="paper.courseId"
                            placeholder="选择课程"
                            style="width: 100%"
                            clearable
                          >
                            <el-option
                              v-for="c in courseOptions"
                              :key="c.id"
                              :label="c.name"
                              :value="c.id"
                            />
                          </el-select>
                        </el-form-item>
                      </el-col>
                    </el-row>
                    <el-row :gutter="20">
                      <el-col :span="6"
                        ><el-form-item label="打乱题序"
                          ><el-switch
                            v-model="
                              paper.settings.shuffleQuestions
                            " /></el-form-item
                      ></el-col>
                      <el-col :span="6"
                        ><el-form-item label="打乱选项"
                          ><el-switch
                            v-model="
                              paper.settings.shuffleOptions
                            " /></el-form-item
                      ></el-col>
                      <el-col :span="6"
                        ><el-form-item label="显示成绩"
                          ><el-switch
                            v-model="paper.settings.showScore" /></el-form-item
                      ></el-col>
                      <el-col :span="6"
                        ><el-form-item label="允许查看"
                          ><el-switch
                            v-model="
                              paper.settings.allowReview
                            " /></el-form-item
                      ></el-col>
                    </el-row>
                  </div>

                  <!-- 防作弊设置 -->
                  <div class="settings-section">
                    <h4 class="section-title">防作弊设置</h4>
                    <el-row :gutter="20">
                      <el-col :span="6"
                        ><el-form-item label="IP限制"
                          ><el-switch v-model="paper.antiCheat.ipRestriction" />
                          <div class="setting-hint">
                            同一IP只能答一次
                          </div></el-form-item
                        ></el-col
                      >
                      <el-col :span="6"
                        ><el-form-item label="浏览器指纹"
                          ><el-switch
                            v-model="
                              paper.antiCheat.browserFingerprint
                            " /></el-form-item
                      ></el-col>
                      <el-col :span="6"
                        ><el-form-item label="禁止切屏"
                          ><el-switch
                            v-model="
                              paper.antiCheat.preventWindowSwitch
                            " /></el-form-item
                      ></el-col>
                      <el-col :span="6">
                        <el-form-item label="切屏警告上限">
                          <el-input-number
                            v-model="paper.antiCheat.maxWindowSwitchWarnings"
                            :min="1"
                            :max="10"
                            :disabled="!paper.antiCheat.preventWindowSwitch"
                            style="width: 100%"
                          />
                        </el-form-item>
                      </el-col>
                    </el-row>
                  </div>

                  <!-- 发布对象设置 -->
                  <div class="settings-section">
                    <h4 class="section-title">发布对象</h4>
                    <el-row :gutter="20">
                      <el-col :span="24">
                        <el-form-item label="发布目标">
                          <el-radio-group
                            v-model="publishTargetType"
                            @change="onPublishTargetTypeChange"
                          >
                            <el-radio :value="1">全部学生</el-radio>
                            <el-radio :value="2">指定课程</el-radio>
                            <el-radio :value="3">指定学生</el-radio>
                          </el-radio-group>
                        </el-form-item>
                      </el-col>
                    </el-row>
                    <el-row v-if="publishTargetType === 2" :gutter="20">
                      <el-col :span="24">
                        <el-form-item label="选择课程">
                          <el-checkbox-group v-model="publishSelectedCourseIds">
                            <el-checkbox
                              v-for="c in courseOptions"
                              :key="c.id"
                              :value="c.id"
                              :label="c.name"
                            />
                          </el-checkbox-group>
                          <div class="setting-hint">
                            已选 {{ publishSelectedCourseIds.length }} 个课程
                          </div>
                        </el-form-item>
                      </el-col>
                    </el-row>
                    <el-row v-if="publishTargetType === 3" :gutter="20">
                      <el-col :span="24">
                        <el-form-item label="选择学生">
                          <div class="publish-student-toolbar">
                            <el-select
                              v-model="publishFilterCourseId"
                              placeholder="按课程筛选"
                              clearable
                              style="width: 180px"
                              @change="onFilterCourseChange"
                            >
                              <el-option
                                v-for="c in courseOptions"
                                :key="c.id"
                                :label="c.name"
                                :value="c.id"
                              />
                            </el-select>
                            <el-input
                              v-model="publishStudentKeyword"
                              placeholder="搜索姓名/学号"
                              clearable
                              style="width: 180px"
                            />
                            <el-button
                              size="small"
                              @click="toggleSelectAllStudents"
                              >{{
                                publishSelectedStudentIds.length ===
                                  filteredStudentList.length &&
                                filteredStudentList.length > 0
                                  ? "取消全选"
                                  : "全选"
                              }}</el-button
                            >
                            <span class="setting-hint"
                              >已选
                              {{ publishSelectedStudentIds.length }} 人</span
                            >
                          </div>
                          <div
                            v-loading="publishStudentLoading"
                            class="publish-student-list-inline"
                          >
                            <div
                              v-for="s in filteredStudentList"
                              :key="s.studentId"
                              class="publish-student-item-inline"
                              :class="{
                                selected: publishSelectedStudentIds.includes(
                                  s.studentId
                                )
                              }"
                              @click="
                                publishSelectedStudentIds.includes(s.studentId)
                                  ? (publishSelectedStudentIds =
                                      publishSelectedStudentIds.filter(
                                        id => id !== s.studentId
                                      ))
                                  : publishSelectedStudentIds.push(s.studentId)
                              "
                            >
                              <el-checkbox
                                :model-value="
                                  publishSelectedStudentIds.includes(
                                    s.studentId
                                  )
                                "
                                @click.stop
                              />
                              <span class="student-name">{{
                                s.studentName
                              }}</span>
                              <span class="student-no">{{ s.studentNo }}</span>
                            </div>
                            <el-empty
                              v-if="
                                !publishStudentLoading &&
                                filteredStudentList.length === 0
                              "
                              description="暂无学生"
                              :image-size="40"
                            />
                          </div>
                        </el-form-item>
                      </el-col>
                    </el-row>
                  </div>

                  <!-- 补考设置 -->
                  <div class="settings-section">
                    <h4 class="section-title">补考设置</h4>
                    <el-row :gutter="20">
                      <el-col :span="6"
                        ><el-form-item label="允许补考"
                          ><el-switch
                            v-model="paper.retake.allowRetake" /></el-form-item
                      ></el-col>
                      <el-col :span="6">
                        <el-form-item label="最大补考次数">
                          <el-input-number
                            v-model="paper.retake.maxRetakeCount"
                            :min="1"
                            :max="5"
                            :disabled="!paper.retake.allowRetake"
                            style="width: 100%"
                          />
                        </el-form-item>
                      </el-col>
                      <el-col :span="6"
                        ><el-form-item label="使用原题"
                          ><el-switch
                            v-model="paper.retake.useOriginalQuestions"
                            :disabled="
                              !paper.retake.allowRetake
                            " /></el-form-item
                      ></el-col>
                      <el-col :span="6"
                        ><el-form-item label="取最高分"
                          ><el-switch
                            v-model="paper.scoring.useHighestScore"
                            :disabled="
                              !paper.retake.allowRetake
                            " /></el-form-item
                      ></el-col>
                    </el-row>
                    <el-row v-if="paper.retake.allowRetake" :gutter="20">
                      <el-col :span="12">
                        <el-form-item label="补考开始时间">
                          <el-date-picker
                            v-model="paper.retake.retakeStartTime"
                            type="datetime"
                            placeholder="选择补考开始时间"
                            style="width: 100%"
                            value-format="YYYY-MM-DD HH:mm:ss"
                          />
                        </el-form-item>
                      </el-col>
                      <el-col :span="12">
                        <el-form-item label="补考结束时间">
                          <el-date-picker
                            v-model="paper.retake.retakeEndTime"
                            type="datetime"
                            placeholder="选择补考结束时间"
                            style="width: 100%"
                            value-format="YYYY-MM-DD HH:mm:ss"
                          />
                        </el-form-item>
                      </el-col>
                    </el-row>
                  </div>
                </el-form>
              </div>
            </el-collapse-transition>
          </div>

          <!-- 空状态提示 -->
          <div v-if="paper.questionGroups.length === 0" class="empty-hint">
            <el-empty
              description="拖拽或点击上方题型添加题目"
              :image-size="120"
            />
          </div>

          <!-- 题目列表 -->
          <div class="questions-container">
            <template
              v-for="(group, groupIndex) in paper.questionGroups"
              :key="group.groupId"
            >
              <!-- 题型组标题 -->
              <div class="question-group-header">
                <div class="group-title-wrapper">
                  <span class="group-number"
                    >{{ getChineseNumber(groupIndex + 1) }}.</span
                  >
                  <el-input
                    v-model="group.groupName"
                    class="group-title-input"
                    placeholder="输入题型组名称"
                    maxlength="50"
                  />
                </div>
                <span class="group-count">{{ group.questions.length }}题</span>
              </div>

              <div
                v-for="(question, qIndex) in group.questions"
                :id="`question-${question.questionId}`"
                :key="question.questionId"
                class="question-card"
                :class="{ active: activeQuestionId === question.questionId }"
                @click="activeQuestionId = question.questionId"
              >
                <!-- 题目头部 -->
                <div class="question-header">
                  <div class="question-info">
                    <span class="question-index"
                      >第{{
                        getGlobalQuestionIndex(groupIndex, qIndex)
                      }}题</span
                    >
                    <span class="question-type-tag">{{ group.groupName }}</span>
                  </div>
                  <div class="question-actions">
                    <el-input-number
                      v-if="
                        question.questionType !== 'slider' &&
                        question.questionType !== 'nps-rating' &&
                        question.questionType !== 'star-rating'
                      "
                      v-model="question.points"
                      :min="0"
                      :max="100"
                      size="small"
                      controls-position="right"
                      style="width: 100px"
                    />
                    <span
                      v-if="
                        question.questionType !== 'slider' &&
                        question.questionType !== 'nps-rating' &&
                        question.questionType !== 'star-rating'
                      "
                      class="points-label"
                      >分</span
                    >
                    <span v-else class="data-collection-label">数据收集</span>
                    <el-button
                      link
                      size="small"
                      @click.stop="
                        copyQuestion(group.groupId, question.questionId)
                      "
                      ><el-icon><CopyDocument /></el-icon
                    ></el-button>
                    <el-button
                      link
                      size="small"
                      type="primary"
                      title="AI 助手 (双击 Ctrl/Command)"
                      @click.stop="
                        openQuestionAssistant(question, group.groupId)
                      "
                      ><el-icon><MagicStick /></el-icon
                    ></el-button>
                    <el-button
                      link
                      size="small"
                      title="归档到题库"
                      @click.stop="
                        archiveQuestionHandler(question, group.groupId)
                      "
                      ><el-icon><Collection /></el-icon
                    ></el-button>
                    <el-button
                      link
                      size="small"
                      type="danger"
                      @click.stop="
                        deleteQuestion(group.groupId, question.questionId)
                      "
                      ><el-icon><Delete /></el-icon>删除</el-button
                    >
                  </div>
                </div>
                <!-- 题干 -->
                <div class="question-stem">
                  <div class="stem-toolbar-bar">
                    <span class="stem-label">题目</span>
                    <div class="stem-tools">
                      <el-tooltip
                        v-if="question.questionType === 'input'"
                        content="插入填空占位符 {blank}"
                        placement="top"
                      >
                        <el-button
                          size="small"
                          type="primary"
                          plain
                          @click="insertBlankPlaceholder(question)"
                        >
                          <el-icon><EditPen /></el-icon>
                          <span>插入填空</span>
                        </el-button>
                      </el-tooltip>
                      <LatexEditor
                        @insert="latex => insertLatexToStem(question, latex)"
                      />
                    </div>
                  </div>
                  <el-input
                    :ref="el => setStemRef(question.questionId, el)"
                    v-model="question.stem"
                    type="textarea"
                    :placeholder="
                      question.questionType === 'input'
                        ? '请输入题目内容，点击[插入填空]按钮添加填空'
                        : '请输入题目内容'
                    "
                    :rows="2"
                    maxlength="2000"
                    @input="watchBlankStemChange(question)"
                  />
                  <!-- 填空占位符数量提示 -->
                  <div
                    v-if="question.questionType === 'input' && question.stem"
                    class="blank-count-hint"
                  >
                    <el-icon><InfoFilled /></el-icon>
                    <span>{{ getBlankCountHint(question) }}</span>
                  </div>
                  <!-- 题干预览（含填空渲染或公式渲染） -->
                  <div
                    v-if="
                      question.stem &&
                      (question.questionType === 'input' ||
                        question.stem.includes('$'))
                    "
                    class="stem-preview-box"
                  >
                    <div class="preview-tag">预览</div>
                    <div
                      v-if="question.questionType === 'input'"
                      class="preview-body"
                      v-html="
                        renderBlankStem(question.stem, question.blanks, false)
                      "
                    />
                    <div v-else class="preview-body">
                      <RichContent :content="question.stem" />
                    </div>
                  </div>
                  <RichMediaUploader v-model="question.media" />
                </div>
                <!-- 选项 -->
                <div
                  v-if="question.options && question.options.length > 0"
                  class="question-options"
                >
                  <div class="options-header">
                    <span class="options-title">选项</span>
                    <el-button
                      v-if="question.questionType !== 'judge'"
                      link
                      size="small"
                      type="primary"
                      @click="addOption(question)"
                      ><el-icon><Plus /></el-icon>添加选项</el-button
                    >
                  </div>
                  <div
                    v-for="(option, optIndex) in question.options"
                    :key="option.key"
                    class="option-item"
                  >
                    <div class="option-correct">
                      <el-radio
                        v-if="
                          question.questionType === 'radio' ||
                          question.questionType === 'judge'
                        "
                        v-model="question.correctAnswer"
                        :value="option.key"
                        class="correct-mark"
                      />
                      <el-checkbox
                        v-else-if="question.questionType === 'checkbox'"
                        v-model="question.correctAnswers"
                        :value="option.key"
                        class="correct-mark"
                      />
                    </div>
                    <span class="option-key">{{ option.key }}.</span>
                    <el-input
                      v-model="option.content"
                      :placeholder="`请输入选项${option.key}的内容`"
                      class="option-input"
                      :disabled="question.questionType === 'judge'"
                    />
                    <el-button
                      v-if="question.questionType !== 'judge'"
                      link
                      size="small"
                      type="danger"
                      @click="removeOption(question, optIndex)"
                      ><el-icon><Delete /></el-icon>删除</el-button
                    >
                  </div>
                  <div class="correct-answer-hint">
                    <el-icon><InfoFilled /></el-icon>
                    <span
                      v-if="
                        question.questionType === 'radio' ||
                        question.questionType === 'judge'
                      "
                      >点击选项前的圆圈设置正确答案</span
                    >
                    <span v-else>点击选项前的复选框设置正确答案（可多选）</span>
                  </div>
                </div>
                <!-- 填空题 -->
                <div
                  v-if="question.questionType === 'input'"
                  class="question-blanks"
                >
                  <div class="blanks-header">
                    <span class="blanks-title">填空答案</span>
                    <el-button
                      link
                      size="small"
                      type="primary"
                      @click="addBlank(question)"
                      ><el-icon><Plus /></el-icon>添加填空</el-button
                    >
                  </div>
                  <div
                    v-for="(blank, blankIndex) in question.blanks"
                    :key="blankIndex"
                    class="blank-item"
                  >
                    <span class="blank-index">第{{ blankIndex + 1 }}空：</span>
                    <el-input
                      v-model="blank.answer"
                      placeholder="请输入正确答案"
                      class="blank-input"
                    />
                    <el-button
                      link
                      size="small"
                      type="danger"
                      @click="removeBlank(question, blankIndex)"
                      ><el-icon><Delete /></el-icon>删除</el-button
                    >
                  </div>
                </div>
                <!-- 简答题 -->
                <div
                  v-if="question.questionType === 'textarea'"
                  class="question-reference"
                >
                  <div class="reference-header">
                    <span class="reference-title">参考答案</span>
                  </div>
                  <el-input
                    v-model="question.referenceAnswer"
                    type="textarea"
                    placeholder="请输入参考答案"
                    :rows="4"
                    maxlength="5000"
                  />
                </div>
                <!-- 论述题 -->
                <div
                  v-if="question.questionType === 'textarea-essay'"
                  class="question-reference"
                >
                  <div class="reference-header">
                    <span class="reference-title">参考答案</span>
                  </div>
                  <el-input
                    v-model="question.referenceAnswer"
                    type="textarea"
                    placeholder="请输入论述题参考答案"
                    :rows="6"
                    maxlength="10000"
                  />
                </div>
                <!-- 矩阵单选/矩阵多选 -->
                <div
                  v-if="
                    question.questionType === 'matrix-single' ||
                    question.questionType === 'matrix-multiple'
                  "
                  class="question-matrix"
                >
                  <div class="matrix-table-wrapper">
                    <div class="matrix-controls">
                      <el-button
                        size="small"
                        type="primary"
                        @click="
                          question.rows.push({
                            key: `R${question.rows.length + 1}`,
                            content: ''
                          })
                        "
                      >
                        <el-icon><Plus /></el-icon>添加行
                      </el-button>
                      <el-button
                        size="small"
                        type="primary"
                        @click="
                          question.columns.push({
                            key: `C${question.columns.length + 1}`,
                            content: ''
                          })
                        "
                      >
                        <el-icon><Plus /></el-icon>添加列
                      </el-button>
                    </div>
                    <div class="matrix-table">
                      <table>
                        <thead>
                          <tr>
                            <th class="matrix-corner">
                              <span class="corner-label">行/列</span>
                            </th>
                            <th
                              v-for="(col, cIdx) in question.columns"
                              :key="col.key"
                              class="matrix-col-header"
                            >
                              <div class="col-header-content">
                                <el-input
                                  v-model="col.content"
                                  :placeholder="`列${cIdx + 1}`"
                                  size="small"
                                />
                                <el-button
                                  v-if="question.columns.length > 2"
                                  link
                                  size="small"
                                  type="danger"
                                  @click="question.columns.splice(cIdx, 1)"
                                >
                                  <el-icon><Delete /></el-icon>
                                </el-button>
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr
                            v-for="(row, rIdx) in question.rows"
                            :key="row.key"
                          >
                            <td class="matrix-row-header">
                              <div class="row-header-content">
                                <el-input
                                  v-model="row.content"
                                  :placeholder="`行${rIdx + 1}`"
                                  size="small"
                                />
                                <el-button
                                  v-if="question.rows.length > 2"
                                  link
                                  size="small"
                                  type="danger"
                                  @click="question.rows.splice(rIdx, 1)"
                                >
                                  <el-icon><Delete /></el-icon>
                                </el-button>
                              </div>
                            </td>
                            <td
                              v-for="col in question.columns"
                              :key="`${row.key}-${col.key}`"
                              class="matrix-cell"
                            >
                              <div class="cell-content">
                                <el-radio
                                  v-if="
                                    question.questionType === 'matrix-single'
                                  "
                                  v-model="question.correctAnswers[row.key]"
                                  :value="col.key"
                                  class="matrix-radio"
                                />
                                <el-checkbox
                                  v-else
                                  v-model="question.correctAnswers[row.key]"
                                  :value="col.key"
                                  class="matrix-checkbox"
                                />
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                <!-- 连线题 -->
                <div
                  v-if="question.questionType === 'matching'"
                  class="question-matching"
                >
                  <div class="matching-side">
                    <div class="matching-header">
                      <span class="matching-title">左侧项</span>
                      <el-button
                        link
                        size="small"
                        type="primary"
                        @click="
                          question.leftItems.push({
                            key: `L${question.leftItems.length + 1}`,
                            content: ''
                          })
                        "
                      >
                        <el-icon><Plus /></el-icon>添加
                      </el-button>
                    </div>
                    <div
                      v-for="(item, idx) in question.leftItems"
                      :key="item.key"
                      class="matching-item"
                    >
                      <span class="matching-item-key">{{ item.key }}.</span>
                      <el-input
                        v-model="item.content"
                        :placeholder="`左侧项${idx + 1}`"
                        class="matching-item-input"
                      />
                      <el-button
                        v-if="question.leftItems.length > 2"
                        link
                        size="small"
                        type="danger"
                        @click="question.leftItems.splice(idx, 1)"
                      >
                        <el-icon><Delete /></el-icon>
                      </el-button>
                    </div>
                  </div>
                  <div class="matching-side">
                    <div class="matching-header">
                      <span class="matching-title">右侧项</span>
                      <el-button
                        link
                        size="small"
                        type="primary"
                        @click="
                          question.rightItems.push({
                            key: `R${question.rightItems.length + 1}`,
                            content: ''
                          })
                        "
                      >
                        <el-icon><Plus /></el-icon>添加
                      </el-button>
                    </div>
                    <div
                      v-for="(item, idx) in question.rightItems"
                      :key="item.key"
                      class="matching-item"
                    >
                      <span class="matching-item-key">{{ item.key }}.</span>
                      <el-input
                        v-model="item.content"
                        :placeholder="`右侧项${idx + 1}`"
                        class="matching-item-input"
                      />
                      <el-button
                        v-if="question.rightItems.length > 2"
                        link
                        size="small"
                        type="danger"
                        @click="question.rightItems.splice(idx, 1)"
                      >
                        <el-icon><Delete /></el-icon>
                      </el-button>
                    </div>
                  </div>
                  <div class="matching-answer-hint">
                    <el-icon><InfoFilled /></el-icon>
                    <span>设置正确连线：左侧项 → 右侧项</span>
                  </div>
                  <div
                    v-for="item in question.leftItems"
                    :key="`match-${item.key}`"
                    class="matching-pair"
                  >
                    <span class="matching-pair-label"
                      >{{ item.content || item.key }} →</span
                    >
                    <el-select
                      v-model="question.correctMatches[item.key]"
                      placeholder="选择对应右侧项"
                      clearable
                      style="width: 200px"
                    >
                      <el-option
                        v-for="right in question.rightItems"
                        :key="right.key"
                        :label="right.content || right.key"
                        :value="right.key"
                      />
                    </el-select>
                  </div>
                </div>
                <!-- 滑动评分题 -->
                <div
                  v-if="question.questionType === 'slider'"
                  class="question-slider"
                >
                  <div class="slider-config">
                    <div class="slider-config-header">
                      <span class="slider-config-title">滑动条设置</span>
                      <span class="data-collection-badge">数据收集题</span>
                    </div>
                    <el-row :gutter="16">
                      <el-col :span="6">
                        <el-form-item label="最小值">
                          <el-input-number
                            v-model="question.sliderMin"
                            :min="0"
                            :max="question.sliderMax - 1"
                            size="small"
                            style="width: 100%"
                          />
                        </el-form-item>
                      </el-col>
                      <el-col :span="6">
                        <el-form-item label="最大值">
                          <el-input-number
                            v-model="question.sliderMax"
                            :min="question.sliderMin + 1"
                            :max="1000"
                            size="small"
                            style="width: 100%"
                          />
                        </el-form-item>
                      </el-col>
                      <el-col :span="6">
                        <el-form-item label="步长">
                          <el-input-number
                            v-model="question.sliderStep"
                            :min="1"
                            :max="question.sliderMax"
                            size="small"
                            style="width: 100%"
                          />
                        </el-form-item>
                      </el-col>
                      <el-col :span="6">
                        <el-form-item label="默认值">
                          <el-input-number
                            v-model="question.sliderDefaultValue"
                            :min="question.sliderMin"
                            :max="question.sliderMax"
                            size="small"
                            style="width: 100%"
                          />
                        </el-form-item>
                      </el-col>
                    </el-row>
                    <el-row :gutter="16">
                      <el-col :span="12">
                        <el-form-item label="左侧标签">
                          <el-input
                            v-model="question.sliderLabels.left"
                            placeholder="如：最低"
                            size="small"
                          />
                        </el-form-item>
                      </el-col>
                      <el-col :span="12">
                        <el-form-item label="右侧标签">
                          <el-input
                            v-model="question.sliderLabels.right"
                            placeholder="如：最高"
                            size="small"
                          />
                        </el-form-item>
                      </el-col>
                    </el-row>
                    <div class="slider-preview">
                      <span class="slider-label-left">{{
                        question.sliderLabels?.left
                      }}</span>
                      <el-slider
                        :model-value="question.sliderDefaultValue"
                        :min="question.sliderMin"
                        :max="question.sliderMax"
                        :step="question.sliderStep"
                        disabled
                        style="flex: 1"
                      />
                      <span class="slider-label-right">{{
                        question.sliderLabels?.right
                      }}</span>
                    </div>
                  </div>
                </div>
                <!-- NPS评分题 -->
                <div
                  v-if="question.questionType === 'nps-rating'"
                  class="question-nps"
                >
                  <div class="nps-config">
                    <div class="nps-config-header">
                      <span class="nps-config-title">NPS 评分设置 (0-10)</span>
                      <span class="data-collection-badge">数据收集题</span>
                    </div>
                    <el-row :gutter="16">
                      <el-col :span="8">
                        <el-form-item label="低分标签">
                          <el-input
                            v-model="question.npsLabels.low"
                            placeholder="如：完全不推荐"
                            size="small"
                          />
                        </el-form-item>
                      </el-col>
                      <el-col :span="8">
                        <el-form-item label="中间标签">
                          <el-input
                            v-model="question.npsLabels.mid"
                            placeholder="如：一般"
                            size="small"
                          />
                        </el-form-item>
                      </el-col>
                      <el-col :span="8">
                        <el-form-item label="高分标签">
                          <el-input
                            v-model="question.npsLabels.high"
                            placeholder="如：强烈推荐"
                            size="small"
                          />
                        </el-form-item>
                      </el-col>
                    </el-row>
                    <div class="nps-preview">
                      <div class="nps-scale">
                        <div
                          v-for="n in 11"
                          :key="n - 1"
                          class="nps-item"
                          :class="{
                            detractor: n - 1 <= 6,
                            passive: n - 1 >= 7 && n - 1 <= 8,
                            promoter: n - 1 >= 9
                          }"
                        >
                          {{ n - 1 }}
                        </div>
                      </div>
                      <div class="nps-labels">
                        <span class="nps-label-low">{{
                          question.npsLabels?.low
                        }}</span>
                        <span class="nps-label-mid">{{
                          question.npsLabels?.mid
                        }}</span>
                        <span class="nps-label-high">{{
                          question.npsLabels?.high
                        }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <!-- 星级评分题 -->
                <div
                  v-if="question.questionType === 'star-rating'"
                  class="question-star"
                >
                  <div class="star-config">
                    <div class="star-config-header">
                      <span class="star-config-title">星级评分设置</span>
                      <span class="data-collection-badge">数据收集题</span>
                    </div>
                    <el-form-item label="星星数量">
                      <el-input-number
                        v-model="question.starCount"
                        :min="3"
                        :max="10"
                        size="small"
                      />
                    </el-form-item>
                    <div class="star-labels-config">
                      <div
                        v-for="(label, idx) in question.starLabels"
                        :key="idx"
                        class="star-label-item"
                      >
                        <span class="star-label-key">{{ idx + 1 }}星：</span>
                        <el-input
                          v-model="question.starLabels[idx]"
                          :placeholder="`${idx + 1}星描述`"
                          size="small"
                          class="star-label-input"
                        />
                      </div>
                    </div>
                    <div class="star-preview">
                      <span
                        v-for="n in question.starCount"
                        :key="n"
                        class="star-icon"
                        :class="{ active: n <= 3 }"
                        >★</span
                      >
                    </div>
                  </div>
                </div>
                <!-- 组合/材料题 -->
                <div
                  v-if="question.questionType === 'composite'"
                  class="question-composite"
                >
                  <div class="composite-material">
                    <div class="composite-material-header">
                      <span class="composite-material-title">材料内容</span>
                    </div>
                    <el-input
                      v-model="question.material"
                      type="textarea"
                      placeholder="请输入材料内容（文章、案例、题目背景等）"
                      :rows="6"
                      maxlength="20000"
                    />
                  </div>
                  <div class="composite-sub-questions">
                    <div class="composite-sub-header">
                      <span class="composite-sub-title">子题目</span>
                      <el-dropdown trigger="click">
                        <el-button link size="small" type="primary">
                          <el-icon><Plus /></el-icon>添加子题
                        </el-button>
                        <template #dropdown>
                          <el-dropdown-menu>
                            <el-dropdown-item
                              @click="
                                question.subQuestions.push({
                                  subId: Date.now(),
                                  questionType: 'radio',
                                  stem: '',
                                  points: 5,
                                  options: [
                                    { key: 'A', content: '' },
                                    { key: 'B', content: '' },
                                    { key: 'C', content: '' },
                                    { key: 'D', content: '' }
                                  ],
                                  correctAnswer: ''
                                })
                              "
                              >单选题</el-dropdown-item
                            >
                            <el-dropdown-item
                              @click="
                                question.subQuestions.push({
                                  subId: Date.now(),
                                  questionType: 'checkbox',
                                  stem: '',
                                  points: 5,
                                  options: [
                                    { key: 'A', content: '' },
                                    { key: 'B', content: '' },
                                    { key: 'C', content: '' },
                                    { key: 'D', content: '' }
                                  ],
                                  correctAnswers: []
                                })
                              "
                              >多选题</el-dropdown-item
                            >
                            <el-dropdown-item
                              @click="
                                question.subQuestions.push({
                                  subId: Date.now(),
                                  questionType: 'input',
                                  stem: '',
                                  points: 5,
                                  blanks: [{ answer: '' }]
                                })
                              "
                              >填空题</el-dropdown-item
                            >
                            <el-dropdown-item
                              @click="
                                question.subQuestions.push({
                                  subId: Date.now(),
                                  questionType: 'textarea',
                                  stem: '',
                                  points: 10,
                                  referenceAnswer: ''
                                })
                              "
                              >简答题</el-dropdown-item
                            >
                          </el-dropdown-menu>
                        </template>
                      </el-dropdown>
                    </div>
                    <div
                      v-for="(sub, sIdx) in question.subQuestions"
                      :key="sub.subId"
                      class="composite-sub-item"
                    >
                      <div class="sub-item-header">
                        <span class="sub-item-index">子题 {{ sIdx + 1 }}</span>
                        <span class="sub-item-type">{{
                          sub.questionType === "radio"
                            ? "单选"
                            : sub.questionType === "checkbox"
                              ? "多选"
                              : sub.questionType === "input"
                                ? "填空"
                                : "简答"
                        }}</span>
                        <el-input-number
                          v-model="sub.points"
                          :min="0"
                          :max="100"
                          size="small"
                          style="width: 80px"
                        />
                        <span class="points-label">分</span>
                        <el-button
                          v-if="question.subQuestions.length > 1"
                          link
                          size="small"
                          type="danger"
                          @click="question.subQuestions.splice(sIdx, 1)"
                        >
                          <el-icon><Delete /></el-icon>
                        </el-button>
                      </div>
                      <el-input
                        v-model="sub.stem"
                        type="textarea"
                        placeholder="请输入子题题干"
                        :rows="2"
                        class="sub-item-stem"
                      />
                      <!-- 子题选项 -->
                      <div v-if="sub.options" class="sub-item-options">
                        <div
                          v-for="opt in sub.options"
                          :key="opt.key"
                          class="sub-option-item"
                        >
                          <el-radio
                            v-if="sub.questionType === 'radio'"
                            v-model="sub.correctAnswer"
                            :value="opt.key"
                          />
                          <el-checkbox
                            v-if="sub.questionType === 'checkbox'"
                            v-model="sub.correctAnswers"
                            :value="opt.key"
                          />
                          <span>{{ opt.key }}.</span>
                          <el-input
                            v-model="opt.content"
                            :placeholder="`选项${opt.key}`"
                            size="small"
                          />
                        </div>
                      </div>
                      <!-- 子题填空 -->
                      <div v-if="sub.blanks" class="sub-item-blanks">
                        <div
                          v-for="(blank, bIdx) in sub.blanks"
                          :key="bIdx"
                          class="sub-blank-item"
                        >
                          <span>第{{ bIdx + 1 }}空：</span>
                          <el-input
                            v-model="blank.answer"
                            placeholder="正确答案"
                            size="small"
                          />
                        </div>
                      </div>
                      <!-- 子题简答 -->
                      <div
                        v-if="sub.questionType === 'textarea'"
                        class="sub-item-ref"
                      >
                        <el-input
                          v-model="sub.referenceAnswer"
                          type="textarea"
                          placeholder="参考答案"
                          :rows="2"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <!-- 排序题 -->
                <div
                  v-if="question.questionType === 'ordering'"
                  class="question-ordering"
                >
                  <div class="ordering-header">
                    <span class="ordering-title">排序项</span>
                    <el-button
                      link
                      size="small"
                      type="primary"
                      @click="
                        question.items.push({
                          key: String(question.items.length + 1),
                          content: ''
                        })
                      "
                    >
                      <el-icon><Plus /></el-icon>添加项
                    </el-button>
                  </div>
                  <div
                    v-for="(item, idx) in question.items"
                    :key="item.key"
                    class="ordering-item"
                  >
                    <span class="ordering-item-key">{{ idx + 1 }}.</span>
                    <el-input
                      v-model="item.content"
                      :placeholder="`排序项${idx + 1}`"
                      class="ordering-item-input"
                    />
                    <el-button
                      v-if="question.items.length > 2"
                      link
                      size="small"
                      type="danger"
                      @click="question.items.splice(idx, 1)"
                    >
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </div>
                  <div class="ordering-answer">
                    <div class="ordering-answer-header">
                      <span class="ordering-answer-title">正确顺序</span>
                    </div>
                    <el-input
                      v-model="question.correctOrder"
                      placeholder="输入正确顺序，如：2,4,1,3"
                    />
                    <div class="ordering-answer-hint">
                      <el-icon><InfoFilled /></el-icon>
                      <span>用逗号分隔序号，表示正确的排列顺序</span>
                    </div>
                  </div>
                </div>
                <!-- 解析（仅显示给有答案的题型） -->
                <div
                  v-if="
                    question.questionType !== 'slider' &&
                    question.questionType !== 'nps-rating' &&
                    question.questionType !== 'star-rating'
                  "
                  class="question-analysis"
                >
                  <el-collapse>
                    <el-collapse-item title="题目解析" name="analysis">
                      <el-input
                        v-model="question.analysis"
                        type="textarea"
                        placeholder="请输入题目解析（选填）"
                        :rows="3"
                        maxlength="2000"
                      />
                    </el-collapse-item>
                  </el-collapse>
                </div>
              </div>

              <!-- 添加更多题目按钮 -->
              <div class="add-question-btn">
                <el-button
                  type="primary"
                  link
                  @click="addQuestion(group.groupId)"
                  ><el-icon><Plus /></el-icon>继续添加{{
                    group.groupName
                  }}</el-button
                >
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- 题目助手对话框 -->
    <QuestionAssistant
      v-model:visible="questionAssistantVisible"
      :current-question="currentEditingQuestion"
      :question-type="currentEditingQuestion?.questionType"
      @apply="applyQuestionAssistantResult"
    />

    <!-- 发布对话框 -->
    <el-dialog
      v-model="publishDialogVisible"
      title="发布试卷 - 选择发布对象"
      width="680px"
      :close-on-click-modal="false"
      class="publish-dialog"
    >
      <div class="publish-form">
        <div class="publish-section">
          <div class="publish-label">发布目标类型</div>
          <el-radio-group
            v-model="publishTargetType"
            @change="onPublishTargetTypeChange"
          >
            <el-radio :value="1">全部学生</el-radio>
            <el-radio :value="2">指定课程</el-radio>
            <el-radio :value="3">指定学生</el-radio>
          </el-radio-group>
        </div>

        <!-- 指定课程 -->
        <div v-if="publishTargetType === 2" class="publish-section">
          <div class="publish-label">
            选择课程
            <span class="publish-hint">
              （已选 {{ publishSelectedCourseIds.length }} 个课程）
            </span>
          </div>
          <el-checkbox-group v-model="publishSelectedCourseIds">
            <div
              v-for="c in courseOptions"
              :key="c.id"
              class="publish-course-item"
            >
              <el-checkbox :value="c.id" :label="c.name" />
            </div>
          </el-checkbox-group>
          <el-empty
            v-if="courseOptions.length === 0"
            description="暂无课程数据"
            :image-size="60"
          />
        </div>

        <!-- 指定学生 -->
        <div v-if="publishTargetType === 3" class="publish-section">
          <div class="publish-label">选择学生</div>
          <div class="publish-student-toolbar">
            <el-select
              v-model="publishFilterCourseId"
              placeholder="按课程筛选"
              clearable
              style="width: 200px"
              @change="onFilterCourseChange"
            >
              <el-option
                v-for="c in courseOptions"
                :key="c.id"
                :label="c.name"
                :value="c.id"
              />
            </el-select>
            <el-input
              v-model="publishStudentKeyword"
              placeholder="搜索姓名/学号"
              clearable
              style="width: 200px"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
            <el-button size="small" @click="toggleSelectAllStudents">
              {{
                publishSelectedStudentIds.length ===
                  filteredStudentList.length && filteredStudentList.length > 0
                  ? "取消全选"
                  : "全选"
              }}
            </el-button>
            <span class="publish-hint">
              已选 {{ publishSelectedStudentIds.length }} 人
            </span>
          </div>
          <div v-loading="publishStudentLoading" class="publish-student-list">
            <div
              v-for="s in filteredStudentList"
              :key="s.studentId"
              class="publish-student-item"
              :class="{
                selected: publishSelectedStudentIds.includes(s.studentId)
              }"
              @click="
                publishSelectedStudentIds.includes(s.studentId)
                  ? (publishSelectedStudentIds =
                      publishSelectedStudentIds.filter(
                        id => id !== s.studentId
                      ))
                  : publishSelectedStudentIds.push(s.studentId)
              "
            >
              <el-checkbox
                :model-value="publishSelectedStudentIds.includes(s.studentId)"
                @click.stop
                @change="
                  (val: boolean) =>
                    val
                      ? publishSelectedStudentIds.push(s.studentId)
                      : (publishSelectedStudentIds =
                          publishSelectedStudentIds.filter(
                            id => id !== s.studentId
                          ))
                "
              />
              <span class="student-name">{{ s.studentName }}</span>
              <span class="student-no">{{ s.studentNo }}</span>
              <span v-if="s.className" class="student-class">{{
                s.className
              }}</span>
            </div>
            <el-empty
              v-if="!publishStudentLoading && filteredStudentList.length === 0"
              description="暂无学生数据"
              :image-size="60"
            />
          </div>
        </div>

        <!-- 全部学生提示 -->
        <div v-if="publishTargetType === 1" class="publish-section">
          <el-alert
            title="将发布给平台所有学生"
            type="info"
            :closable="false"
            show-icon
          />
        </div>
      </div>
      <template #footer>
        <el-button @click="publishDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="publishSubmitting"
          @click="confirmPublish"
        >
          确定发布
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
/* 与教师管理端整体设计对齐：尽量使用 Element Plus CSS 变量；统一卡片圆角 16px 与阴影 */
$light-bg: var(--el-bg-color-page);
$light-card-bg: var(--el-bg-color);
$light-text-primary: var(--el-text-color-primary);
$light-text-secondary: var(--el-text-color-regular);
$light-border: var(--el-border-color-lighter);

$dark-bg: var(--el-bg-color-page);
$dark-card-bg: var(--el-bg-color);
$dark-text-primary: var(--el-text-color-primary);
$dark-text-secondary: var(--el-text-color-regular);
$dark-border: var(--el-border-color-lighter);

/* 管理端统一卡片阴影 */
$admin-shadow: 0 4px 16px rgb(0 0 0 / 8%);
$admin-shadow-lg: 0 8px 20px rgb(0 0 0 / 12%);
$admin-radius: 16px;

.exam-paper-editor {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: $light-bg;

  &.is-dark {
    background: $dark-bg;

    .editor-fixed-top {
      background: var(--el-bg-color);
      border-color: $dark-border;
    }

    .editor-header {
      border-bottom-color: $dark-border;

      .logo-text {
        background: linear-gradient(135deg, #739cf9 0%, #80c8fa 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .title-input :deep(.el-input__wrapper) {
        background: rgba(15, 23, 42, 0.6);
        border-color: $dark-border;
        color: $dark-text-primary;

        &:hover {
          border-color: #739cf9;
        }
      }

      .auto-save-status {
        background: rgba(15, 23, 42, 0.6);
        color: $dark-text-secondary;
      }
    }

    .question-toolbar {
      background: linear-gradient(
        135deg,
        rgba(15, 23, 42, 0.8) 0%,
        rgba(30, 41, 59, 0.6) 100%
      );

      .toolbar-hint {
        color: $dark-text-secondary;
      }

      .toolbar-group-label {
        color: $dark-text-secondary;
      }

      .type-item {
        background: rgba(30, 41, 59, 0.8);
        border-color: $dark-border;

        &:hover {
          border-color: #739cf9;
        }

        .type-label {
          color: $dark-text-secondary;
        }

        &:hover .type-label {
          color: #739cf9;
        }
      }
    }

    .editor-outline {
      background: linear-gradient(
        180deg,
        rgba(30, 41, 59, 0.95) 0%,
        rgba(30, 41, 59, 0.85) 100%
      );
      border-right-color: $dark-border;

      .outline-header {
        background: linear-gradient(
          135deg,
          rgba(15, 23, 42, 0.8) 0%,
          rgba(30, 41, 59, 0.6) 100%
        );
        border-bottom-color: $dark-border;

        .outline-title {
          color: $dark-text-primary;
        }
      }

      .outline-summary {
        color: $dark-text-secondary;
        background: rgba(115, 156, 249, 0.15);
      }

      .outline-group {
        border-color: $dark-border;
        background: rgba(30, 41, 59, 0.6);

        &:hover {
          border-color: #739cf9;
        }

        .outline-group-header {
          background: linear-gradient(
            135deg,
            rgba(115, 156, 249, 0.15) 0%,
            rgba(115, 156, 249, 0.08) 100%
          );
          border-bottom-color: $dark-border;

          .group-name {
            color: $dark-text-primary;
          }

          .group-item-count {
            background: rgba(15, 23, 42, 0.6);
            color: $dark-text-secondary;
          }
        }

        .outline-item {
          background: rgba(30, 41, 59, 0.5);
          border-bottom-color: $dark-border;

          &:hover {
            background: rgba(115, 156, 249, 0.15);
          }

          &.active {
            background: linear-gradient(
              135deg,
              rgba(115, 156, 249, 0.25) 0%,
              rgba(115, 156, 249, 0.15) 100%
            );
          }

          .item-points {
            background: rgba(15, 23, 42, 0.6);
          }
        }
      }
    }

    .editor-content {
      background-color: rgba(15, 23, 42, 0.85);

      .paper-canvas {
        background: $dark-card-bg;
      }

      .ai-analysis-panel,
      .settings-panel {
        border-color: $dark-border;

        .settings-toggle {
          background: linear-gradient(
            135deg,
            rgba(115, 156, 249, 0.15) 0%,
            rgba(115, 156, 249, 0.08) 100%
          );
          color: $dark-text-primary;

          &:hover {
            background: linear-gradient(
              135deg,
              rgba(115, 156, 249, 0.25) 0%,
              rgba(115, 156, 249, 0.15) 100%
            );
          }
        }

        .settings-content {
          background: rgba(15, 23, 42, 0.6);
        }
      }

      .ai-analysis-result {
        background: rgba(30, 41, 59, 0.8);
        border-color: $dark-border;

        .result-header {
          border-bottom-color: $dark-border;

          .result-title {
            color: $dark-text-primary;
          }
        }

        .metric-item {
          background: rgba(15, 23, 42, 0.6);

          .metric-label {
            color: $dark-text-secondary;
          }

          .metric-value {
            color: $dark-text-primary;
          }
        }
      }
    }

    .question-group-header {
      background: linear-gradient(
        135deg,
        rgba(115, 156, 249, 0.15) 0%,
        rgba(115, 156, 249, 0.08) 100%
      );
      border-color: rgba(115, 156, 249, 0.3);

      .group-title-input :deep(.el-input__wrapper) {
        background: rgba(30, 41, 59, 0.8);
        border-color: rgba(115, 156, 249, 0.3);
        color: $dark-text-primary;
      }

      .group-count {
        background: rgba(15, 23, 42, 0.6);
        color: $dark-text-secondary;
      }
    }

    .question-card {
      background: linear-gradient(
        135deg,
        rgba(30, 41, 59, 0.95) 0%,
        rgba(30, 41, 59, 0.85) 100%
      );
      border-color: $dark-border;

      &:hover,
      &.active {
        border-color: #739cf9;
        background: linear-gradient(
          135deg,
          rgba(115, 156, 249, 0.08) 0%,
          rgba(30, 41, 59, 0.95) 100%
        );
      }

      .question-header {
        border-bottom-color: $dark-border;

        .question-index,
        .points-label {
          color: $dark-text-primary;
        }
      }

      .stem-label,
      .options-title,
      .blanks-title,
      .reference-title {
        color: $dark-text-secondary;
      }

      .blank-count-hint {
        background: rgba(115, 156, 249, 0.15);
        border-left-color: #739cf9;
      }

      .stem-preview-box {
        background: rgba(15, 23, 42, 0.6);
        border-color: $dark-border;
      }

      .correct-answer-hint {
        background: rgba(15, 23, 42, 0.6);
        color: $dark-text-secondary;
      }

      :deep(.el-collapse) {
        .el-collapse-item__header {
          background: rgba(15, 23, 42, 0.6);
          color: $dark-text-secondary;
        }
      }
    }

    .preview-dialog {
      :deep(.el-dialog) {
        background: $dark-card-bg;
      }

      .preview-content {
        background: rgba(15, 23, 42, 0.8);
      }

      .preview-paper {
        background: $dark-card-bg;

        .preview-paper-info {
          border-bottom-color: $dark-border;
          color: $dark-text-secondary;
        }

        .preview-group-title {
          background: linear-gradient(
            135deg,
            rgba(115, 156, 249, 0.15) 0%,
            rgba(115, 156, 249, 0.08) 100%
          );

          .preview-group-name {
            color: $dark-text-primary;
          }
        }

        .preview-question-stem {
          color: $dark-text-primary;
        }

        .preview-answer-area {
          border-color: $dark-border;
        }
      }
    }
  }
}

.editor-fixed-top {
  position: sticky;
  top: 12px;
  z-index: 100;
  overflow: hidden;
  margin: 12px 16px 16px;
  background-color: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 16px;
  box-shadow: 0 4px 16px rgb(0 0 0 / 8%);
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);

  .header-left .logo {
    display: flex;
    align-items: center;
    cursor: pointer;
    transition: transform 0.3s ease;

    &:hover {
      transform: scale(1.05);
    }

    .logo-icon {
      width: 36px;
      height: 36px;
      margin-right: 12px;
      filter: drop-shadow(0 2px 4px rgba(115, 156, 249, 0.2));
    }

    .logo-text {
      font-size: 20px;
      font-weight: 700;
      background: linear-gradient(135deg, #739cf9 0%, #4a7fc8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
  }

  .header-center {
    flex: 1;
    max-width: 450px;
    margin: 0 24px;

    .title-input :deep(.el-input__wrapper) {
      font-size: 16px;
      font-weight: 600;
      background: linear-gradient(135deg, #f5f7fa 0%, #f0f2f5 100%);
      border: 2px solid #e4e7ed;
      border-radius: 10px;
      transition: all 0.3s ease;

      &:hover {
        border-color: #739cf9;
        box-shadow: 0 0 0 3px rgba(115, 156, 249, 0.1);
      }

      &:focus-within {
        border-color: #739cf9;
        box-shadow: 0 0 0 3px rgba(115, 156, 249, 0.15);
      }
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;

    :deep(.el-button) {
      border-radius: 10px;
      height: 38px;
      padding: 0 16px;
      font-weight: 500;
      transition: all 0.3s ease;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
    }

    .auto-save-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #909399;
      padding: 6px 12px;
      background: #f5f7fa;
      border-radius: 6px;
      transition: all 0.3s ease;

      &:hover {
        background: #ebf2fd;
        color: #4a7fc8;
      }
    }
  }
}

.question-toolbar {
  padding: 14px 24px;
  background: #f8fafc;

  .toolbar-hint {
    font-size: 13px;
    color: #909399;
    margin-bottom: 10px;
    font-weight: 500;
  }

  .toolbar-groups {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;

    .toolbar-group {
      .toolbar-group-label {
        font-size: 12px;
        color: #909399;
        font-weight: 600;
        margin-bottom: 8px;
        padding-left: 2px;
        letter-spacing: 1px;
        text-transform: uppercase;
      }
    }
  }

  .toolbar-items {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;

    .type-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 10px 14px;
      background: rgba(255, 255, 255, 0.8);
      border: 2px solid #e4e7ed;
      border-radius: 10px;
      cursor: grab;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
      min-width: 68px;

      &::before {
        content: "";
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(
          90deg,
          transparent,
          rgba(255, 255, 255, 0.3),
          transparent
        );
        transition: left 0.5s;
      }

      &:hover {
        border-color: var(--group-hover-color, #739cf9);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        transform: translateY(-2px);

        &::before {
          left: 100%;
        }
      }

      &:active {
        cursor: grabbing;
        transform: translateY(0);
      }

      .type-icon-wrapper {
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        margin-bottom: 6px;
        transition: all 0.3s ease;

        .type-icon {
          width: 20px;
          height: 20px;
          transition: transform 0.3s ease;
        }
      }

      &:hover .type-icon-wrapper {
        transform: scale(1.1);

        .type-icon {
          transform: scale(1.15);
        }
      }

      .type-label {
        font-size: 12px;
        color: #606266;
        font-weight: 500;
        transition: color 0.3s ease;
      }

      &:hover .type-label {
        color: #303133;
      }
    }
  }
}
.editor-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}
.editor-outline {
  display: flex;
  flex-direction: column;
  width: 280px;
  background-color: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-lighter);
  box-shadow: 2px 0 8px rgb(0 0 0 / 4%);
  transition: all 0.3s ease;

  &.collapsed {
    width: 60px;
  }

  .outline-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 50px;
    padding: 16px;
    background-color: var(--el-fill-color-light);
    border-bottom: 1px solid var(--el-border-color-lighter);

    .outline-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-right: 8px;
    }
  }

  &.collapsed .outline-header {
    justify-content: center;
    padding: 12px 8px;

    .outline-title {
      display: none;
    }
  }

  .outline-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;

    .outline-summary {
      font-size: 13px;
      color: #475569;
      margin-bottom: 12px;
      padding: 10px 12px;
      background: #f1f5f9;
      border-radius: 6px;
      font-weight: 500;
    }

    .outline-groups {
      .outline-group {
        margin-bottom: 12px;
        border: 1px solid #e4e7ed;
        border-radius: 8px;
        overflow: hidden;
        transition: all 0.3s ease;
        background: rgba(255, 255, 255, 0.6);

        &:hover {
          border-color: #739cf9;
          box-shadow: 0 2px 8px rgba(115, 156, 249, 0.1);
        }

        .outline-group-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: #f8fafc;
          border-bottom: 1px solid #e4e7ed;
          cursor: grab;
          user-select: none;
          transition: all 0.2s ease;

          &:active {
            cursor: grabbing;
          }

          .group-drag-handle {
            cursor: grab;
            color: #c0c4cc;
            transition: color 0.3s ease;
            display: flex;
            align-items: center;

            .drag-icon {
              width: 14px;
              height: 14px;
            }

            &:hover {
              color: #739cf9;
            }
          }

          .group-number {
            font-size: 14px;
            font-weight: 700;
            color: #4a7fc8;
            min-width: 24px;
          }

          .group-name {
            font-size: 13px;
            font-weight: 600;
            color: #303133;
            flex: 1;
          }

          .group-item-count {
            font-size: 12px;
            color: #909399;
            background: rgba(255, 255, 255, 0.6);
            padding: 2px 8px;
            border-radius: 4px;
          }
        }

        .outline-group-items {
          .outline-item {
            display: flex;
            align-items: center;
            padding: 8px 12px 8px 32px;
            border-bottom: 1px solid #f0f0f0;
            cursor: pointer;
            transition: all 0.2s ease;
            background: rgba(255, 255, 255, 0.5);

            &:last-child {
              border-bottom: none;
            }

            &:hover {
              background: #f1f5f9;
              transform: translateX(2px);
            }

            &.active {
              background: #ebf2fd;
              border-left: 3px solid #739cf9;
              color: #4a7fc8;
            }

            .item-index {
              font-size: 12px;
              margin-right: 6px;
              color: #909399;
              font-weight: 600;
              min-width: 20px;
            }

            .item-title {
              flex: 1;
              font-size: 12px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            .item-points {
              font-size: 11px;
              color: #909399;
              margin-left: 8px;
              background: #f5f7fa;
              padding: 1px 6px;
              border-radius: 3px;
            }
          }
        }
      }
    }

    .outline-list .outline-item {
      display: flex;
      align-items: center;
      padding: 10px 12px;
      margin-bottom: 6px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border: 1px solid transparent;
      background: rgba(255, 255, 255, 0.5);

      &:hover {
        background: #f1f5f9;
        border-color: #e2e8f0;
        transform: translateX(2px);
      }

      &.active {
        background: #ebf2fd;
        border-color: #6365f1;
        border-left: 3px solid #739cf9;
        color: #4a7fc8;
      }

      .drag-handle {
        cursor: grab;
        margin-right: 8px;
        color: #c0c4cc;
        transition: color 0.3s ease;

        .drag-icon {
          width: 14px;
          height: 14px;
        }

        &:hover {
          color: #739cf9;
        }
      }

      .item-index {
        font-size: 13px;
        margin-right: 6px;
        color: #909399;
        font-weight: 600;
      }

      .item-title {
        flex: 1;
        font-size: 13px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .item-points {
        font-size: 12px;
        color: #909399;
        margin-left: 8px;
        background: #f5f7fa;
        padding: 2px 8px;
        border-radius: 4px;
      }
    }

    .ghost-item {
      opacity: 0.6;
      background: #ebf2fd;
      border: 1px dashed #739cf9;
    }
  }
}
.editor-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  transition: background 0.3s;
  background-image: url("@/assets/306618229cda20061635920333.png");
  background-repeat: repeat;
  background-size: 800px;
  background-position: center;
  background-blend-mode: overlay;
  background-color: rgba(245, 247, 250, 0.92);
  &.drag-over {
    background-color: rgba(115, 156, 249, 0.05);
  }
  &.is-dragging::after {
    content: "释放鼠标添加题目";
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    padding: 20px 40px;
    background: rgba(115, 156, 249, 0.9);
    color: #fff;
    font-size: 16px;
    border-radius: 8px;
    pointer-events: none;
    z-index: 1000;
  }
  .paper-canvas {
    max-width: 960px;
    margin: 0 auto;
    background: rgba(255, 255, 255, 0.6);
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    padding: 24px;
  }
  .paper-description {
    margin-bottom: 20px;
  }
  .ai-analysis-panel {
    margin-bottom: 20px;
    border: 1px solid #e4e7ed;
    border-radius: 8px;
    overflow: hidden;
    .settings-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: #f1f5f9;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      color: #303133;
      &:hover {
        background: #e2e8f0;
      }
      .toggle-arrow {
        transition: transform 0.3s;
        margin-left: auto;
        &.expanded {
          transform: rotate(180deg);
        }
      }
    }
    .settings-content {
      padding: 20px;
      background: #fafafa;
    }
    .ai-analysis-actions {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
      .analysis-hint {
        font-size: 13px;
        color: #909399;
      }
    }
    .ai-analysis-result {
      background: #fff;
      border-radius: 8px;
      padding: 16px;
      border: 1px solid #e4e7ed;
      .result-header {
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid #e4e7ed;
        .result-title {
          font-size: 15px;
          font-weight: 600;
          color: #303133;
        }
      }
      .result-metrics {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 16px;
        margin-bottom: 16px;
        .metric-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 12px;
          background: #f5f7fa;
          border-radius: 6px;
          .metric-label {
            font-size: 12px;
            color: #909399;
          }
          .metric-value {
            font-size: 16px;
            font-weight: 600;
            color: #303133;
          }
        }
      }
      .result-distribution {
        margin-bottom: 16px;
        .distribution-title {
          font-size: 14px;
          font-weight: 500;
          color: #606266;
          margin-bottom: 12px;
        }
        .distribution-chart {
          display: flex;
          align-items: center;
          gap: 24px;
          .pie-chart {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            flex-shrink: 0;
          }
          .distribution-legend {
            flex: 1;
            .legend-item {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 8px;
              font-size: 13px;
              .legend-color {
                width: 12px;
                height: 12px;
                border-radius: 2px;
                flex-shrink: 0;
              }
              .legend-name {
                color: #303133;
                min-width: 60px;
              }
              .legend-count {
                color: #606266;
                min-width: 40px;
              }
              .legend-percent {
                color: #909399;
              }
            }
          }
        }
      }
      .result-suggestions {
        .suggestions-title {
          font-size: 14px;
          font-weight: 500;
          color: #606266;
          margin-bottom: 8px;
        }
        .suggestions-list {
          margin: 0;
          padding-left: 20px;
          li {
            font-size: 13px;
            color: #606266;
            line-height: 1.8;
            &::marker {
              color: #739cf9;
            }
          }
        }
      }
    }
  }
  .settings-panel {
    margin-bottom: 20px;
    border: 1px solid #e4e7ed;
    border-radius: 8px;
    overflow: hidden;
    .settings-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: #fafafa;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      color: #303133;
      &:hover {
        background: #f0f0f0;
      }
      .toggle-arrow {
        transition: transform 0.3s;
        margin-left: auto;
        &.expanded {
          transform: rotate(180deg);
        }
      }
    }
    .settings-content {
      padding: 20px;
      .settings-section {
        margin-bottom: 20px;
        &:last-child {
          margin-bottom: 0;
        }
        .section-title {
          font-size: 14px;
          font-weight: 600;
          color: #4a7fc8;
          margin: 0 0 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e4e7ed;
        }
      }
      .setting-hint {
        font-size: 12px;
        color: #909399;
        margin-top: 4px;
      }
      .publish-student-toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
        flex-wrap: wrap;
      }
      .publish-student-list-inline {
        max-height: 200px;
        overflow-y: auto;
        border: 1px solid #e4e7ed;
        border-radius: 6px;
        padding: 8px;
        margin-top: 8px;
      }
      .publish-student-item-inline {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 10px;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
        &:hover {
          background: #f5f7fa;
        }
        &.selected {
          background: rgba(115, 156, 249, 0.08);
        }
        .student-name {
          font-size: 13px;
          color: #303133;
        }
        .student-no {
          font-size: 12px;
          color: #909399;
        }
      }
    }
  }
  .empty-hint {
    padding: 60px 0;
  }
}
.questions-container {
  .question-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    margin: 20px 0 16px 0;
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    border-left: 4px solid #739cf9;

    .group-title-wrapper {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;

      .group-number {
        font-size: 18px;
        font-weight: 700;
        color: #4a7fc8;
        min-width: 30px;
      }

      .group-title-input {
        flex: 1;
        max-width: 400px;

        :deep(.el-input__wrapper) {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          color: #303133;

          &:hover {
            border-color: #739cf9;
            background: rgba(255, 255, 255, 0.95);
          }

          &:focus-within {
            border-color: #739cf9;
            box-shadow: 0 0 0 2px rgba(115, 156, 249, 0.1);
          }
        }
      }
    }

    .group-count {
      font-size: 13px;
      color: #909399;
      background: rgba(255, 255, 255, 0.6);
      padding: 4px 12px;
      border-radius: 20px;
      font-weight: 500;
    }
  }

  .question-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 18px;
    margin-bottom: 16px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    position: relative;
    overflow: hidden;

    &:hover {
      border-color: #cbd5e1;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      transform: translateY(-1px);
    }

    &.active {
      border-color: #739cf9;
      border-left: 3px solid #739cf9;
      box-shadow: 0 4px 16px rgba(115, 156, 249, 0.12);
      background: #f5f9ff;
    }
    .question-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e4e7ed;
      .question-info {
        display: flex;
        align-items: center;
        gap: 10px;
        .question-index {
          font-size: 15px;
          font-weight: 600;
          color: #303133;
        }
        .question-type-tag {
          font-size: 12px;
          padding: 2px 8px;
          background: #ebf2fd;
          color: #4a7fc8;
          border-radius: 4px;
        }
      }
      .question-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        .points-label {
          font-size: 13px;
          color: #606266;
          margin-right: 8px;
        }
      }
    }
    .question-stem {
      margin-bottom: 16px;
      .stem-toolbar-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
        .stem-label {
          font-size: 14px;
          font-weight: 500;
          color: #606266;
        }
        .stem-tools {
          display: flex;
          align-items: center;
          gap: 8px;
        }
      }
      .blank-count-hint {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #4a7fc8;
        margin-top: 8px;
        padding: 6px 12px;
        background: #ebf2fd;
        border-radius: 4px;
        border-left: 3px solid #739cf9;
      }
      .stem-preview-box {
        margin-top: 8px;
        padding: 12px;
        background: #f5f7fa;
        border-radius: 6px;
        border: 1px solid #e4e7ed;
        .preview-tag {
          font-size: 12px;
          color: #909399;
          margin-bottom: 8px;
        }
        .preview-body {
          line-height: 1.6;
        }
      }
    }
    .question-options {
      margin-bottom: 16px;
      .options-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        .options-title {
          font-size: 14px;
          font-weight: 500;
          color: #606266;
        }
      }
      .option-item {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
        .option-correct .correct-mark {
          :deep(.el-checkbox__label),
          :deep(.el-radio__label) {
            display: none;
          }
        }
        .option-key {
          font-size: 14px;
          font-weight: 500;
          color: #303133;
          min-width: 20px;
        }
        .option-input {
          flex: 1;
        }
      }
      .correct-answer-hint {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #909399;
        margin-top: 8px;
        padding: 8px 12px;
        background: #f5f7fa;
        border-radius: 4px;
      }
    }
    .question-blanks {
      margin-bottom: 16px;
      .blanks-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        .blanks-title {
          font-size: 14px;
          font-weight: 500;
          color: #606266;
        }
      }
      .blank-item {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
        .blank-index {
          font-size: 13px;
          color: #606266;
          min-width: 60px;
        }
        .blank-input {
          flex: 1;
        }
      }
    }
    .question-reference {
      margin-bottom: 16px;
      .reference-header {
        margin-bottom: 12px;
        .reference-title {
          font-size: 14px;
          font-weight: 500;
          color: #606266;
        }
      }
    }
    .question-matrix {
      margin-bottom: 16px;
      .matrix-section {
        margin-bottom: 16px;
        .matrix-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          .matrix-title {
            font-size: 14px;
            font-weight: 500;
            color: #606266;
          }
        }
        .matrix-item {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
          .matrix-item-key {
            font-size: 13px;
            color: #606266;
            min-width: 30px;
          }
          .matrix-item-input {
            flex: 1;
          }
        }
      }
    }
    .question-matching {
      margin-bottom: 16px;
      .matching-side {
        margin-bottom: 16px;
        .matching-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          .matching-title {
            font-size: 14px;
            font-weight: 500;
            color: #606266;
          }
        }
        .matching-item {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
          .matching-item-key {
            font-size: 13px;
            color: #606266;
            min-width: 30px;
          }
          .matching-item-input {
            flex: 1;
          }
        }
      }
      .matching-answer-hint {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #909399;
        margin: 8px 0;
        padding: 8px 12px;
        background: #f5f7fa;
        border-radius: 4px;
      }
      .matching-pair {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 10px;
        .matching-pair-label {
          font-size: 13px;
          color: #303133;
          min-width: 120px;
        }
      }
    }
    .question-slider {
      margin-bottom: 16px;
      .slider-config {
        .slider-config-header {
          margin-bottom: 12px;
          .slider-config-title {
            font-size: 14px;
            font-weight: 500;
            color: #606266;
          }
        }
        .slider-preview {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #f5f7fa;
          border-radius: 6px;
          margin-top: 12px;
          .slider-label-left,
          .slider-label-right {
            font-size: 12px;
            color: #909399;
            white-space: nowrap;
          }
        }
      }
    }
    .question-nps {
      margin-bottom: 16px;
      .nps-config {
        .nps-config-header {
          margin-bottom: 12px;
          .nps-config-title {
            font-size: 14px;
            font-weight: 500;
            color: #606266;
          }
        }
        .nps-preview {
          padding: 12px;
          background: #f5f7fa;
          border-radius: 6px;
          margin-top: 12px;
          .nps-scale {
            display: flex;
            gap: 4px;
            margin-bottom: 8px;
            .nps-item {
              flex: 1;
              text-align: center;
              padding: 8px 0;
              border-radius: 4px;
              font-size: 13px;
              font-weight: 500;
              cursor: default;
              &.detractor {
                background: #fde2e2;
                color: #f56c6c;
              }
              &.passive {
                background: #faecd8;
                color: #e6a23c;
              }
              &.promoter {
                background: #ebf2fd;
                color: #739cf9;
              }
            }
          }
          .nps-labels {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: #909399;
          }
        }
      }
    }
    .question-star {
      margin-bottom: 16px;
      .star-config {
        .star-config-header {
          margin-bottom: 12px;
          .star-config-title {
            font-size: 14px;
            font-weight: 500;
            color: #606266;
          }
        }
        .star-labels-config {
          margin-top: 12px;
          .star-label-item {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
            .star-label-key {
              font-size: 13px;
              color: #606266;
              min-width: 40px;
            }
            .star-label-input {
              flex: 1;
            }
          }
        }
        .star-preview {
          display: flex;
          gap: 4px;
          margin-top: 12px;
          padding: 12px;
          background: #f5f7fa;
          border-radius: 6px;
          .star-icon {
            font-size: 24px;
            color: #dcdfe6;
            &.active {
              color: #f7ba2a;
            }
          }
        }
      }
    }
    .question-composite {
      margin-bottom: 16px;
      .composite-material {
        margin-bottom: 16px;
        .composite-material-header {
          margin-bottom: 12px;
          .composite-material-title {
            font-size: 14px;
            font-weight: 500;
            color: #606266;
          }
        }
      }
      .composite-sub-questions {
        .composite-sub-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          .composite-sub-title {
            font-size: 14px;
            font-weight: 500;
            color: #606266;
          }
        }
        .composite-sub-item {
          border: 1px solid #e4e7ed;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 12px;
          background: #fafafa;
          .sub-item-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
            .sub-item-index {
              font-size: 13px;
              font-weight: 600;
              color: #303133;
            }
            .sub-item-type {
              font-size: 12px;
              padding: 1px 6px;
              background: #ebf2fd;
              color: #4a7fc8;
              border-radius: 3px;
            }
          }
          .sub-item-stem {
            margin-bottom: 10px;
          }
          .sub-item-options {
            .sub-option-item {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 8px;
            }
          }
          .sub-item-blanks {
            .sub-blank-item {
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: 8px;
              font-size: 13px;
            }
          }
          .sub-item-ref {
            margin-top: 8px;
          }
        }
      }
    }
    .question-ordering {
      margin-bottom: 16px;
      .ordering-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        .ordering-title {
          font-size: 14px;
          font-weight: 500;
          color: #606266;
        }
      }
      .ordering-item {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
        .ordering-item-key {
          font-size: 13px;
          color: #606266;
          min-width: 30px;
        }
        .ordering-item-input {
          flex: 1;
        }
      }
      .ordering-answer {
        margin-top: 16px;
        padding-top: 12px;
        border-top: 1px solid #e4e7ed;
        .ordering-answer-header {
          margin-bottom: 8px;
          .ordering-answer-title {
            font-size: 14px;
            font-weight: 500;
            color: #606266;
          }
        }
        .ordering-answer-hint {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #909399;
          margin-top: 8px;
        }
      }
    }
    .question-analysis {
      :deep(.el-collapse) {
        border: none;
        .el-collapse-item__header {
          font-size: 14px;
          color: #909399;
          background: #f5f7fa;
          padding: 0 12px;
          border-radius: 4px;
        }
        .el-collapse-item__wrap {
          border: none;
        }
        .el-collapse-item__content {
          padding: 12px 0 0;
        }
      }
    }
  }
  .add-question-btn {
    text-align: center;
    padding: 12px;
    margin-bottom: 16px;
  }
}
.template-preview-info {
  display: flex;
  gap: 16px;
  color: #606266;
  font-size: 14px;
}

.preview-dialog {
  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    .preview-title {
      font-size: 18px;
      font-weight: 600;
    }
    .preview-controls {
      display: flex;
      align-items: center;
      gap: 16px;
      .scale-control {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }
  }
  .preview-content {
    display: flex;
    justify-content: center;
    padding: 20px;
    background: #f5f7fa;
    min-height: 70vh;
    overflow: auto;
    .preview-paper {
      background: rgba(255, 255, 255, 0.6);
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
      padding: 40px;
      transform-origin: top center;
      &.paper-a4 {
        width: 210mm;
        min-height: 297mm;
      }
      &.paper-a3 {
        width: 297mm;
        min-height: 420mm;
      }
      .preview-paper-title {
        text-align: center;
        font-size: 24px;
        margin-bottom: 16px;
      }
      .preview-paper-desc {
        text-align: center;
        color: #606266;
        margin-bottom: 16px;
      }
      .preview-paper-info {
        display: flex;
        justify-content: center;
        gap: 40px;
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid #e4e7ed;
        color: #909399;
      }
      .preview-group-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 24px 0 16px 0;
        padding: 12px 16px;
        background: #f1f5f9;
        border-radius: 6px;
        border-left: 4px solid #739cf9;
        .preview-group-number {
          font-size: 18px;
          font-weight: 700;
          color: #4a7fc8;
        }
        .preview-group-name {
          font-size: 16px;
          font-weight: 600;
          color: #303133;
        }
      }
      .preview-question {
        margin-bottom: 20px;
        .preview-question-header {
          margin-bottom: 8px;
          .preview-question-index {
            font-weight: 600;
          }
          .preview-question-type {
            color: #909399;
            margin: 0 8px;
          }
          .preview-question-points {
            color: #909399;
          }
        }
        .preview-question-stem {
          margin-bottom: 12px;
          line-height: 1.6;
          :deep(.blank-placeholder) {
            display: inline-block;
            min-width: 80px;
            border-bottom: 2px solid #303133;
            text-align: center;
            padding: 0 4px;
            margin: 0 4px;
          }
          :deep(.blank-answer-inline) {
            display: inline-block;
            min-width: 60px;
            color: #303133;
            font-weight: 500;
            padding: 2px 8px;
            margin: 0 4px;
          }
        }
        .preview-option {
          padding: 4px 0;
          padding-left: 20px;
        }
        .preview-blanks .preview-blank {
          margin-right: 20px;
        }
        .preview-answer-area {
          height: 100px;
          border: 1px solid #e4e7ed;
          border-radius: 4px;
        }
      }
    }
  }
}
// 带答案预览对话框样式
.preview-with-answer-dialog {
  .answer-badge {
    background: #739cf9;
    color: #fff;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
  }
  .preview-option {
    &.correct-option {
      background: rgba(115, 156, 249, 0.1);
      color: #739cf9;
      font-weight: 500;
      border-radius: 4px;
      padding: 4px 8px 4px 20px;
      .correct-icon {
        color: #739cf9;
        margin-left: 8px;
      }
    }
  }
  .preview-blanks .preview-blank {
    display: block;
    margin-bottom: 8px;
    .blank-answer {
      color: #739cf9;
      font-weight: 500;
      background: rgba(115, 156, 249, 0.1);
      padding: 2px 8px;
      border-radius: 4px;
    }
  }
  .preview-question-stem {
    :deep(.blank-placeholder) {
      display: inline-block;
      min-width: 80px;
      border-bottom: 2px solid #303133;
      text-align: center;
      padding: 0 4px;
      margin: 0 4px;
    }
    :deep(.blank-answer-inline) {
      display: inline-block;
      min-width: 60px;
      color: #739cf9;
      font-weight: 500;
      background: rgba(115, 156, 249, 0.1);
      padding: 2px 8px;
      border-radius: 4px;
      margin: 0 4px;
    }
  }
  .preview-answer-section {
    margin-top: 12px;
    padding: 12px;
    background: rgba(115, 156, 249, 0.08);
    border-radius: 6px;
    border-left: 3px solid #739cf9;
    .answer-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 500;
      color: #739cf9;
      margin-bottom: 6px;
    }
    .answer-content {
      font-size: 14px;
      color: #303133;
      line-height: 1.6;
      white-space: pre-wrap;
    }
  }
  .preview-analysis-section {
    margin-top: 8px;
    padding: 12px;
    background: rgba(64, 158, 255, 0.08);
    border-radius: 6px;
    border-left: 3px solid #409eff;
    .analysis-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 500;
      color: #409eff;
      margin-bottom: 6px;
    }
    .analysis-content {
      font-size: 14px;
      color: #606266;
      line-height: 1.6;
      white-space: pre-wrap;
    }
  }
}

// 发布对话框样式
.publish-dialog {
  .publish-form {
    .publish-section {
      margin-bottom: 20px;
      &:last-child {
        margin-bottom: 0;
      }
    }
    .publish-label {
      font-size: 14px;
      font-weight: 500;
      color: #303133;
      margin-bottom: 12px;
    }
    .publish-hint {
      font-size: 12px;
      color: #909399;
      font-weight: normal;
    }
    .publish-course-item {
      padding: 8px 12px;
      border: 1px solid #e4e7ed;
      border-radius: 6px;
      margin-bottom: 8px;
      transition: all 0.2s;
      &:hover {
        border-color: #739cf9;
        background: #ebf2fd;
      }
    }
    .publish-student-toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    .publish-student-list {
      max-height: 360px;
      overflow-y: auto;
      border: 1px solid #e4e7ed;
      border-radius: 8px;
      padding: 8px;
    }
    .publish-student-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      &:hover {
        background: #f5f7fa;
      }
      &.selected {
        background: #ebf2fd;
      }
      .student-name {
        font-size: 14px;
        color: #303133;
        min-width: 80px;
      }
      .student-no {
        font-size: 13px;
        color: #909399;
      }
      .student-class {
        font-size: 12px;
        color: #909399;
        margin-left: auto;
        padding: 2px 8px;
        background: #f5f7fa;
        border-radius: 4px;
      }
    }
  }
}

@media (max-width: 768px) {
  .exam-paper-editor {
    min-width: 0;
    padding-bottom: var(--pure-mobile-content-bottom-gap, 140px);
  }

  .editor-fixed-top {
    top: calc(var(--pure-safe-area-top, 0px) + 8px);
    margin: 8px 12px 12px;
    border-radius: 12px;
  }

  .editor-header {
    align-items: stretch;
    gap: 10px;
    padding: 12px;
    flex-wrap: wrap;

    .header-left {
      flex: 1 1 100%;
      min-width: 0;

      .logo {
        width: 100%;
      }

      .logo-icon {
        width: 30px;
        height: 30px;
        margin-right: 8px;
      }

      .logo-text {
        display: block;
        min-width: 0;
        font-size: 18px;
        line-height: 1.25;
        white-space: normal;
        word-break: keep-all;
      }
    }

    .header-center {
      order: 3;
      flex: 1 1 100%;
      max-width: none;
      margin: 0;
    }

    .header-right {
      order: 2;
      flex: 1 1 100%;
      min-width: 0;
      gap: 8px;
      flex-wrap: wrap;

      .auto-save-status {
        min-height: 34px;
        padding: 6px 10px;
        font-size: 12px;
        white-space: normal;
      }

      :deep(.el-button) {
        height: 36px;
        min-width: 72px;
        padding: 0 10px;
        margin-left: 0;
        font-size: 13px;
      }
    }
  }

  .question-toolbar {
    padding: 12px;

    .toolbar-hint {
      margin-bottom: 12px;
      line-height: 1.4;
    }

    .toolbar-groups {
      display: grid;
      grid-template-columns: 1fr;
      gap: 14px;

      .toolbar-group-label {
        letter-spacing: 0;
      }
    }

    .toolbar-items {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;

      .type-item {
        min-width: 0;
        min-height: 86px;
        padding: 8px 6px;

        .type-icon-wrapper {
          width: 32px;
          height: 32px;
          margin-bottom: 6px;
        }

        .type-label {
          max-width: 100%;
          font-size: 12px;
          line-height: 1.25;
          text-align: center;
          white-space: normal;
          word-break: keep-all;
        }
      }
    }
  }

  .editor-main {
    min-height: 0;
    flex-direction: column;
    overflow: visible;
  }

  .editor-outline {
    width: auto;
    max-height: 220px;
    flex-shrink: 0;
    margin: 0 12px 12px;
    overflow: hidden;
    border-right: 0;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 12px;

    &.collapsed {
      width: auto;
      max-height: 54px;
    }
  }

  .editor-content {
    overflow: visible;
    padding: 12px;
    background-size: 520px;
  }
}
</style>
