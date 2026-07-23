<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { useDark } from "@pureadmin/utils";
import {
  startExam,
  saveAnswer,
  saveAnswersBatch,
  saveDuration,
  getExamSession,
  examHeartbeat,
  reportAntiCheatEvent,
  submitExam,
  normalizeQuestionType,
  type ExamSessionSnapshot,
  type StudentAnswerValue
} from "@/api/examPaper";
import RichContent from "@/views/exam-paper/editor/components/RichContent.vue";
import {
  ExamAnswerRetryQueue,
  createExamDeadlineClock,
  getExamRemainingSeconds,
  getAnswerRetryDelay,
  updateExamServerOffset,
  type ExamDeadlineClock,
  type PendingExamAnswer
} from "./examRuntime";

defineOptions({
  name: "ExamPaperDo"
});

const route = useRoute();
const router = useRouter();
const { isDark } = useDark();

// 试卷ID
const paperId = computed(() => Number(route.params.id));

// 加载状态
const loading = ref(true);
const loadError = ref("");
const submitting = ref(false);
const activeSaveCount = ref(0);
const pendingSaveCount = ref(0);
const saveRetrying = ref(false);

// 考试数据
const examData = reactive({
  submissionId: 0,
  paper: null as any,
  remainingTime: 0 // 剩余时间（秒）
});

// 当前题目索引
const currentQuestionIndex = ref(0);

// 学生答案（使用时间戳记录）
interface AnswerRecord {
  questionId: number;
  answer: StudentAnswerValue;
  duration: number; // 该题累计答题时长（秒，从后端获取）
  enterTime: number; // 进入该题的时间戳（毫秒）
}
const answers = ref<Map<number, AnswerRecord>>(new Map());
const answerRetryQueue = new ExamAnswerRetryQueue<StudentAnswerValue>();
const directSaveChains = new Map<number, Promise<void>>();

interface StoredExamRuntimeState {
  version: 1;
  paperId: number;
  submissionId: number;
  currentQuestionId?: number;
  pendingAnswers: PendingExamAnswer<StudentAnswerValue>[];
}

const toQuestionTypeCode = (type: unknown) =>
  normalizeQuestionType(type as any) || 0;

const getQuestionTypeCode = (question: any) =>
  toQuestionTypeCode(question?.questionType);

const isObjectAnswer = (
  value: StudentAnswerValue
): value is Record<string, any> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isAnsweredValue = (value: StudentAnswerValue) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return !Number.isNaN(value);
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return false;
    return entries.some(([, entryValue]) => {
      if (entryValue === null || entryValue === undefined) return false;
      if (typeof entryValue === "string") return entryValue.trim() !== "";
      if (typeof entryValue === "number") return !Number.isNaN(entryValue);
      if (Array.isArray(entryValue)) return entryValue.length > 0;
      if (typeof entryValue === "object") {
        return Object.keys(entryValue).length > 0;
      }
      return Boolean(entryValue);
    });
  }
  return false;
};

const getDefaultAnswerByType = (question: any): StudentAnswerValue => {
  const type = getQuestionTypeCode(question);
  if (type === 2 || type === 10) return [];
  if ([7, 8, 9, 14].includes(type)) return {};
  if ([11, 12, 13].includes(type)) return null;
  return "";
};

const getScalarAnswer = (
  value: StudentAnswerValue | undefined | null
): string | number | boolean | undefined => {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  return undefined;
};

const handleScalarAnswerUpdate = (value: string | number | boolean) => {
  updateAnswer(value as StudentAnswerValue);
};

const handleStringAnswerUpdate = (value: string) => {
  updateAnswer(value);
};

const handleNumberAnswerUpdate = (value: number) => {
  updateAnswer(value);
};

// 考试计时器
let examTimer: ReturnType<typeof setInterval> | null = null;

// 当前题目计时器（每秒更新当前题目的用时）
let questionTimer: ReturnType<typeof setInterval> | null = null;

// 考试在线心跳
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

// 弱网答案批量重试
let answerRetryTimer: ReturnType<typeof setTimeout> | null = null;
let automaticSubmitRetryTimer: ReturnType<typeof setTimeout> | null = null;
let batchFlushPromise: Promise<boolean> | null = null;
let batchSaving = false;
let answerRetryFailureCount = 0;
let automaticSubmitFailureCount = 0;
let retryWarningShown = false;
let heartbeatSending = false;
let automaticSubmitPending = false;
let submitCompleted = false;
let componentDisposed = false;
let examClock: ExamDeadlineClock | null = null;

// 用于强制刷新题目用时显示的响应式变量
const questionTimerTick = ref(0);

// 所有题目列表（扁平化）
const allQuestions = computed(() => {
  if (!examData.paper?.questionGroups) return [];
  const questions: any[] = [];
  examData.paper.questionGroups.forEach((group: any) => {
    group.questions.forEach((q: any) => {
      questions.push({
        ...q,
        groupName: group.groupName,
        groupId: group.groupId
      });
    });
  });
  return questions;
});

// 当前题目
const currentQuestion = computed(
  () => allQuestions.value[currentQuestionIndex.value]
);

// 当前题目的答案记录
const currentAnswerRecord = computed(() => {
  if (!currentQuestion.value) return null;
  return answers.value.get(currentQuestion.value.questionId);
});

// 格式化剩余时间
const formattedRemainingTime = computed(() => {
  const hours = Math.floor(examData.remainingTime / 3600);
  const minutes = Math.floor((examData.remainingTime % 3600) / 60);
  const seconds = examData.remainingTime % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
});

// 答题进度
const answeredCount = computed(() => {
  let count = 0;
  answers.value.forEach(record => {
    if (isAnsweredValue(record.answer)) {
      count++;
    }
  });
  return count;
});

const answerSaveStatus = computed(() => {
  if (saveRetrying.value) {
    return { state: "warning", text: "网络波动，答案待补存" };
  }
  if (activeSaveCount.value > 0 || pendingSaveCount.value > 0) {
    return { state: "saving", text: "答案保存中" };
  }
  return { state: "saved", text: "答案已保存" };
});

const getRuntimeStorageKey = () => `qiming:exam-runtime:${paperId.value}`;

const readStoredRuntimeState = (): StoredExamRuntimeState | null => {
  try {
    const raw = window.sessionStorage.getItem(getRuntimeStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredExamRuntimeState>;
    if (
      parsed.version !== 1 ||
      parsed.paperId !== paperId.value ||
      !Number.isInteger(parsed.submissionId) ||
      Number(parsed.submissionId) <= 0 ||
      !Array.isArray(parsed.pendingAnswers)
    ) {
      return null;
    }

    const pendingAnswers = parsed.pendingAnswers.filter(
      item =>
        item &&
        Number.isInteger(item.questionId) &&
        item.questionId > 0 &&
        Number.isInteger(item.revision) &&
        item.revision > 0 &&
        Object.prototype.hasOwnProperty.call(item, "answer")
    );

    return {
      version: 1,
      paperId: parsed.paperId,
      submissionId: parsed.submissionId,
      currentQuestionId: Number.isInteger(parsed.currentQuestionId)
        ? parsed.currentQuestionId
        : undefined,
      pendingAnswers
    };
  } catch (error) {
    console.warn("读取本地考试恢复状态失败:", error);
    return null;
  }
};

const syncPendingSaveState = () => {
  pendingSaveCount.value = answerRetryQueue.size;
};

const persistRuntimeState = () => {
  if (!examData.submissionId) return;
  const currentQuestionId = currentQuestion.value?.questionId;
  const state: StoredExamRuntimeState = {
    version: 1,
    paperId: paperId.value,
    submissionId: examData.submissionId,
    currentQuestionId,
    pendingAnswers: answerRetryQueue.snapshot()
  };

  try {
    window.sessionStorage.setItem(
      getRuntimeStorageKey(),
      JSON.stringify(state)
    );
  } catch (error) {
    console.warn("保存本地考试恢复状态失败:", error);
  }
};

const clearRuntimeState = () => {
  answerRetryQueue.clear();
  syncPendingSaveState();
  try {
    window.sessionStorage.removeItem(getRuntimeStorageKey());
  } catch (error) {
    console.warn("清理本地考试恢复状态失败:", error);
  }
};

// 初始化答案记录
const initAnswerRecords = () => {
  allQuestions.value.forEach(q => {
    if (!answers.value.has(q.questionId)) {
      answers.value.set(q.questionId, {
        questionId: q.questionId,
        answer: getDefaultAnswerByType(q),
        duration: 0, // 从后端获取
        enterTime: 0
      });
    }
  });
};

// 进入题目（记录进入时间戳）
const enterQuestion = (questionId: number) => {
  const record = answers.value.get(questionId);
  if (record) {
    record.enterTime = Date.now();
  }
};

// 离开题目（发送时间戳给后端）
const leaveQuestion = async (questionId: number) => {
  const record = answers.value.get(questionId);
  if (!record || record.enterTime <= 0 || !examData.submissionId) return;

  const enterTime = record.enterTime;
  const leaveTime = Date.now();
  const elapsed = Math.max(0, Math.floor((leaveTime - enterTime) / 1000));
  record.enterTime = 0;

  try {
    const res = await saveDuration({
      submissionId: examData.submissionId,
      questionId,
      enterTime,
      leaveTime
    });
    if (res.code !== 0) throw new Error(res.msg || "保存答题时长失败");
    if (Number.isFinite(res.data?.duration)) {
      record.duration = Math.max(0, Number(res.data.duration));
    }
  } catch (error) {
    record.duration += elapsed;
    console.error("保存答题时长失败:", error);
  }
};

// 切换题目
const switchQuestion = (index: number) => {
  if (index < 0 || index >= allQuestions.value.length) return;

  // 离开当前题目
  if (currentQuestion.value) {
    void leaveQuestion(currentQuestion.value.questionId);
  }

  // 切换到新题目
  currentQuestionIndex.value = index;

  // 进入新题目
  if (allQuestions.value[index]) {
    enterQuestion(allQuestions.value[index].questionId);
  }
  persistRuntimeState();
};

// 上一题
const prevQuestion = () => {
  if (currentQuestionIndex.value > 0) {
    switchQuestion(currentQuestionIndex.value - 1);
  }
};

// 下一题
const nextQuestion = () => {
  if (currentQuestionIndex.value < allQuestions.value.length - 1) {
    switchQuestion(currentQuestionIndex.value + 1);
  }
};

// 更新答案
const updateAnswer = (value: StudentAnswerValue) => {
  if (!currentQuestion.value || submitting.value) return;
  const record = answers.value.get(currentQuestion.value.questionId);
  if (record) {
    record.answer = value;
    autoSaveAnswer(currentQuestion.value.questionId, value);
  }
};

const isRetryableSaveError = (error: any) => {
  const status = Number(error?.response?.status || 0);
  return (
    !navigator.onLine ||
    status === 0 ||
    status === 408 ||
    status === 429 ||
    status >= 500
  );
};

const clearAnswerRetryTimer = () => {
  if (!answerRetryTimer) return;
  clearTimeout(answerRetryTimer);
  answerRetryTimer = null;
};

const handleAnswerQueueChanged = (notifyRecovery = false) => {
  syncPendingSaveState();
  persistRuntimeState();
  if (answerRetryQueue.size > 0) return;

  clearAnswerRetryTimer();
  answerRetryFailureCount = 0;
  saveRetrying.value = false;
  if (notifyRecovery && retryWarningShown) {
    ElMessage.success("网络已恢复，待保存答案已补存");
  }
  retryWarningShown = false;
  if (automaticSubmitPending && !componentDisposed) {
    window.setTimeout(() => void submitPaper(true), 0);
  }
};

const scheduleAnswerBatchRetry = (delay?: number) => {
  if (
    answerRetryTimer ||
    answerRetryQueue.size === 0 ||
    submitCompleted ||
    componentDisposed
  )
    return;
  const retryDelay = delay ?? getAnswerRetryDelay(answerRetryFailureCount++);
  answerRetryTimer = setTimeout(() => {
    answerRetryTimer = null;
    void flushPendingAnswers();
  }, retryDelay);
};

const markAnswerSaveForRetry = (error: unknown) => {
  saveRetrying.value = true;
  if (!retryWarningShown) {
    retryWarningShown = true;
    ElMessage.warning("网络不稳定，答案已暂存，将自动重试");
  }
  console.error("自动保存失败，已进入批量重试:", error);
  scheduleAnswerBatchRetry();
};

const saveAnswerRevision = async (
  item: PendingExamAnswer<StudentAnswerValue>
) => {
  if (!navigator.onLine) {
    markAnswerSaveForRetry(new Error("浏览器处于离线状态"));
    return;
  }

  try {
    const res = await saveAnswer({
      submissionId: examData.submissionId,
      questionId: item.questionId,
      answer: item.answer
    });
    if (res.code !== 0) throw new Error(res.msg || "自动保存失败");
    answerRetryQueue.acknowledge(item.questionId, item.revision);
    handleAnswerQueueChanged(true);
  } catch (error) {
    if (isRetryableSaveError(error)) {
      markAnswerSaveForRetry(error);
      return;
    }
    saveRetrying.value = true;
    console.error("答案保存被服务端拒绝:", error);
    ElMessage.error("答案保存失败，请检查后重试");
  }
};

// 自动保存仍走单题接口；失败的最新版本再由批量接口补偿。
const autoSaveAnswer = (questionId: number, answer: StudentAnswerValue) => {
  if (!examData.submissionId) return;

  const item = {
    questionId,
    answer,
    revision: answerRetryQueue.nextRevision(questionId)
  };
  answerRetryQueue.enqueue(item);
  handleAnswerQueueChanged();

  if (batchSaving || !navigator.onLine) {
    markAnswerSaveForRetry(new Error("等待批量保存"));
    return;
  }

  activeSaveCount.value++;
  const previous = directSaveChains.get(questionId) || Promise.resolve();
  const task = previous
    .then(() => saveAnswerRevision(item))
    .finally(() => {
      activeSaveCount.value = Math.max(0, activeSaveCount.value - 1);
    });
  directSaveChains.set(questionId, task);
  void task.then(() => {
    if (directSaveChains.get(questionId) === task) {
      directSaveChains.delete(questionId);
    }
  });
};

const waitForDirectAnswerSaves = async () => {
  const tasks = Array.from(directSaveChains.values());
  if (tasks.length > 0) await Promise.all(tasks);
};

const flushPendingAnswers = (): Promise<boolean> => {
  if (batchFlushPromise) return batchFlushPromise;
  if (answerRetryQueue.size === 0) return Promise.resolve(true);

  clearAnswerRetryTimer();
  batchSaving = true;
  const operation = (async () => {
    await waitForDirectAnswerSaves();
    const batch = answerRetryQueue.snapshot();
    if (batch.length === 0) return true;
    if (!navigator.onLine) {
      markAnswerSaveForRetry(new Error("浏览器处于离线状态"));
      return false;
    }

    try {
      activeSaveCount.value++;
      const res = await saveAnswersBatch({
        submissionId: examData.submissionId,
        answers: batch.map(({ questionId, answer }) => ({
          questionId,
          answer
        }))
      });
      if (res.code !== 0) throw new Error(res.msg || "批量保存失败");
      if (
        Number.isFinite(res.data?.savedCount) &&
        Number(res.data.savedCount) < batch.length
      ) {
        throw new Error("批量保存返回数量不完整");
      }
      answerRetryQueue.acknowledgeBatch(batch);
      handleAnswerQueueChanged(true);
      return true;
    } catch (error) {
      markAnswerSaveForRetry(error);
      return false;
    } finally {
      activeSaveCount.value = Math.max(0, activeSaveCount.value - 1);
    }
  })();

  batchFlushPromise = operation;
  void operation.finally(() => {
    batchSaving = false;
    batchFlushPromise = null;
    handleAnswerQueueChanged();
    if (answerRetryQueue.size > 0) scheduleAnswerBatchRetry(0);
    if (
      answerRetryQueue.size === 0 &&
      automaticSubmitPending &&
      !componentDisposed
    ) {
      window.setTimeout(() => void submitPaper(true), 0);
    }
  });
  return operation;
};

const prepareAnswersForSubmit = async () => {
  await waitForDirectAnswerSaves();
  if (answerRetryQueue.size === 0) return true;
  const flushed = await flushPendingAnswers();
  return flushed && answerRetryQueue.size === 0;
};

const clearAutomaticSubmitRetryTimer = () => {
  if (!automaticSubmitRetryTimer) return;
  clearTimeout(automaticSubmitRetryTimer);
  automaticSubmitRetryTimer = null;
};

const scheduleAutomaticSubmitRetry = () => {
  if (
    automaticSubmitRetryTimer ||
    submitCompleted ||
    componentDisposed ||
    !automaticSubmitPending
  )
    return;
  const delay = Math.min(5000 * 2 ** automaticSubmitFailureCount++, 30000);
  automaticSubmitRetryTimer = setTimeout(() => {
    automaticSubmitRetryTimer = null;
    void submitPaper(true);
  }, delay);
};

const submitPaper = async (automatic: boolean) => {
  if (submitting.value || submitCompleted || !examData.submissionId) return;

  if (!automatic) {
    const unansweredCount = allQuestions.value.length - answeredCount.value;
    const confirmMessage =
      unansweredCount > 0
        ? `还有 ${unansweredCount} 道题未作答，确定要提交吗？`
        : "确定要提交试卷吗？";

    try {
      await ElMessageBox.confirm(confirmMessage, "提交确认", {
        confirmButtonText: "确定提交",
        cancelButtonText: "继续答题",
        type: "warning"
      });
    } catch {
      return;
    }
  }

  submitting.value = true;
  clearAutomaticSubmitRetryTimer();
  automaticSubmitPending = false;
  const activeQuestionId = currentQuestion.value?.questionId;
  if (activeQuestionId) {
    await leaveQuestion(activeQuestionId);
  }

  let submitted = false;
  try {
    const answersSaved = await prepareAnswersForSubmit();
    if (!answersSaved) {
      automaticSubmitPending = automatic;
      ElMessage.error(
        automatic
          ? "网络异常，答案补存后将继续自动交卷"
          : "仍有答案未保存，请等待网络恢复后再交卷"
      );
      return;
    }

    const res = await submitExam(examData.submissionId);
    if (res.code !== 0) throw new Error(res.msg || "提交失败");

    submitted = true;
    submitCompleted = true;
    automaticSubmitFailureCount = 0;
    clearRuntimeState();
    stopTimers();
    ElMessage.success("试卷提交成功！");
    if (res.data?.showScore) {
      await router.push(`/exam-paper/result/${examData.submissionId}`);
    } else {
      await router.push("/student-exam-center/list");
    }
  } catch (error) {
    automaticSubmitPending = automatic;
    console.error("提交试卷失败:", error);
    ElMessage.error(
      automatic ? "自动交卷失败，网络恢复后将重试" : "提交失败，请稍后重试"
    );
    if (automatic) scheduleAutomaticSubmitRetry();
  } finally {
    submitting.value = false;
    if (!submitted && activeQuestionId) enterQuestion(activeQuestionId);
  }
};

const handleSubmit = () => submitPaper(false);

const resetExamClock = (remainingSeconds: number, serverTime?: number) => {
  const localTime = Date.now();
  const estimatedServerTime = Number.isFinite(serverTime)
    ? Number(serverTime)
    : localTime + (examClock?.serverOffset || 0);
  examClock = createExamDeadlineClock(
    remainingSeconds,
    estimatedServerTime,
    localTime
  );
  examData.remainingTime = getExamRemainingSeconds(examClock, localTime);
};

const syncExamRemainingTime = () => {
  if (!examClock || submitCompleted) return;
  examData.remainingTime = getExamRemainingSeconds(examClock, Date.now());
  if (examData.remainingTime > 0 || submitting.value) return;

  if (examTimer) clearInterval(examTimer);
  examTimer = null;
  ElMessage.warning("考试时间到，正在自动提交...");
  void submitPaper(true);
};

const syncExamServerTime = (serverTime?: number) => {
  if (!examClock || !Number.isFinite(serverTime)) return;
  examClock = updateExamServerOffset(examClock, Number(serverTime), Date.now());
  syncExamRemainingTime();
};

// 启动考试计时器
const startExamTimer = () => {
  if (examTimer) clearInterval(examTimer);
  syncExamRemainingTime();
  if (examData.remainingTime > 0) {
    examTimer = setInterval(syncExamRemainingTime, 1000);
  }
};

// 启动题目计时器（实时更新当前题目用时显示）
const startQuestionTimer = () => {
  if (questionTimer) clearInterval(questionTimer);
  questionTimer = setInterval(() => {
    // 每秒更新计数器，触发 computed 重新计算
    questionTimerTick.value++;
  }, 1000);
};

// 停止所有计时器
const stopTimers = () => {
  if (examTimer) {
    clearInterval(examTimer);
    examTimer = null;
  }
  if (questionTimer) {
    clearInterval(questionTimer);
    questionTimer = null;
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  clearAnswerRetryTimer();
  clearAutomaticSubmitRetryTimer();
};

// 获取当前题目实时用时（包含正在计时的部分）
const getCurrentQuestionDuration = computed(() => {
  // 依赖 questionTimerTick 来触发每秒更新
  questionTimerTick.value;

  if (!currentAnswerRecord.value) return 0;
  let duration = currentAnswerRecord.value.duration; // 后端返回的累计时长
  if (currentAnswerRecord.value.enterTime > 0) {
    // 加上当前正在计时的部分
    duration += Math.floor(
      (Date.now() - currentAnswerRecord.value.enterTime) / 1000
    );
  }
  return duration;
});

// 格式化题目用时
const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}分${secs}秒`;
};

// 判断题目是否已作答
const isQuestionAnswered = (questionId: number) => {
  const record = answers.value.get(questionId);
  if (!record) return false;
  return isAnsweredValue(record.answer);
};

const getMatrixRows = (question: any) =>
  question?.matrixRows || question?.rows || [];
const getMatrixCols = (question: any) =>
  question?.matrixCols || question?.columns || [];

const getMatchingLeftItems = (question: any) => {
  if (question?.leftItems?.length) return question.leftItems;
  if (question?.matchingPairs?.length) {
    return question.matchingPairs.map((pair: any, index: number) => ({
      key: `L${index + 1}`,
      content: pair.left
    }));
  }
  return [];
};

const getMatchingRightItems = (question: any) => {
  if (question?.rightItems?.length) return question.rightItems;
  if (question?.matchingPairs?.length) {
    return question.matchingPairs.map((pair: any, index: number) => ({
      key: `R${index + 1}`,
      content: pair.right
    }));
  }
  return [];
};

const getOrderingItems = (question: any): string[] => {
  if (Array.isArray(question?.orderingItems)) return question.orderingItems;
  if (Array.isArray(question?.items)) {
    return question.items
      .map((item: any) => item?.content || item?.key)
      .filter(Boolean);
  }
  return [];
};

const updateMatrixSingleAnswer = (rowKey: string, value: string) => {
  if (!currentQuestion.value) return;
  const record = answers.value.get(currentQuestion.value.questionId);
  const base = isObjectAnswer(record?.answer as StudentAnswerValue)
    ? { ...(record?.answer as Record<string, any>) }
    : {};
  base[rowKey] = value;
  updateAnswer(base);
};

const updateMatrixMultipleAnswer = (rowKey: string, value: string[]) => {
  if (!currentQuestion.value) return;
  const record = answers.value.get(currentQuestion.value.questionId);
  const base = isObjectAnswer(record?.answer as StudentAnswerValue)
    ? { ...(record?.answer as Record<string, any>) }
    : {};
  base[rowKey] = value;
  updateAnswer(base);
};

const updateMatchingAnswer = (leftKey: string, value: string) => {
  if (!currentQuestion.value) return;
  const record = answers.value.get(currentQuestion.value.questionId);
  const base = isObjectAnswer(record?.answer as StudentAnswerValue)
    ? { ...(record?.answer as Record<string, any>) }
    : {};
  base[leftKey] = value;
  updateAnswer(base);
};

const getCompositeSubQuestions = (question: any) =>
  Array.isArray(question?.subQuestions) ? question.subQuestions : [];

const updateCompositeSubAnswer = (
  subId: number | string,
  value: StudentAnswerValue
) => {
  if (!currentQuestion.value) return;
  const record = answers.value.get(currentQuestion.value.questionId);
  const base = isObjectAnswer(record?.answer as StudentAnswerValue)
    ? { ...(record?.answer as Record<string, any>) }
    : {};
  base[String(subId)] = value;
  updateAnswer(base);
};

const getCompositeSubAnswer = (subId: number | string): StudentAnswerValue => {
  const answer = currentAnswerRecord.value?.answer;
  if (!isObjectAnswer(answer as StudentAnswerValue)) return "";
  return (answer as Record<string, any>)[String(subId)] ?? "";
};

const fetchExamSession = async (): Promise<ExamSessionSnapshot | null> => {
  try {
    const res = await getExamSession(examData.submissionId);
    if (res.code !== 0 || !res.data) {
      throw new Error(res.msg || "获取考试会话失败");
    }
    if (Number(res.data.submissionId) !== examData.submissionId) {
      throw new Error("考试会话与当前答卷不一致");
    }
    return res.data;
  } catch (error) {
    // 会话快照是恢复能力；失败时保留 start 接口的现有作答链路。
    console.warn("恢复考试会话失败:", error);
    return null;
  }
};

const applySessionSnapshot = (snapshot: ExamSessionSnapshot) => {
  if (Number.isFinite(snapshot.remainingTime)) {
    resetExamClock(snapshot.remainingTime);
  }

  snapshot.answers?.forEach(item => {
    const record = answers.value.get(Number(item.questionId));
    if (!record || !Object.prototype.hasOwnProperty.call(item, "answer"))
      return;
    record.answer = item.answer;
    if (Number.isFinite(item.duration)) {
      record.duration = Math.max(0, Math.floor(Number(item.duration)));
    }
  });
};

const sendExamHeartbeat = async () => {
  if (
    heartbeatSending ||
    !examData.submissionId ||
    submitCompleted ||
    document.visibilityState === "hidden" ||
    !navigator.onLine
  )
    return;

  heartbeatSending = true;
  try {
    const res = await examHeartbeat({
      submissionId: examData.submissionId,
      clientTime: Date.now()
    });
    if (res.code !== 0) throw new Error(res.msg || "考试心跳失败");
    syncExamServerTime(res.data?.serverTime);
  } catch (error) {
    console.warn("考试心跳失败:", error);
  } finally {
    heartbeatSending = false;
  }
};

const startHeartbeat = () => {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  void sendExamHeartbeat();
  heartbeatTimer = setInterval(() => void sendExamHeartbeat(), 30000);
};

const lastAntiCheatEventAt = new Map<string, number>();
const reportExamEvent = async (eventType: string, detail: string) => {
  if (!examData.submissionId || submitCompleted) return;
  const eventTime = Date.now();
  const previousTime = lastAntiCheatEventAt.get(eventType) || 0;
  if (eventTime - previousTime < 1000) return;
  lastAntiCheatEventAt.set(eventType, eventTime);

  try {
    const res = await reportAntiCheatEvent({
      submissionId: examData.submissionId,
      eventType,
      eventTime,
      detail
    });
    if (res.code !== 0) throw new Error(res.msg || "防作弊事件上报失败");
  } catch (error) {
    console.warn(`防作弊事件 ${eventType} 上报失败:`, error);
  }
};

const handleVisibilityChange = () => {
  if (document.visibilityState === "hidden") {
    persistRuntimeState();
    void flushPendingAnswers();
    void reportExamEvent("page_hidden", "visibilityState=hidden");
    return;
  }

  syncExamRemainingTime();
  void reportExamEvent("page_visible", "visibilityState=visible");
  void sendExamHeartbeat();
  if (answerRetryQueue.size > 0) void flushPendingAnswers();
};

const handleWindowBlur = () => {
  if (document.visibilityState === "visible") {
    void reportExamEvent("window_blur", "window lost focus while visible");
  }
};

const handleOnline = () => {
  void sendExamHeartbeat();
  if (answerRetryQueue.size > 0) {
    saveRetrying.value = true;
    void flushPendingAnswers();
    return;
  }
  if (automaticSubmitPending) {
    clearAutomaticSubmitRetryTimer();
    void submitPaper(true);
  }
};

const handlePageHide = () => {
  if (submitCompleted) return;
  persistRuntimeState();
  if (answerRetryQueue.size > 0) void flushPendingAnswers();
};

const restoreLocalPendingAnswers = (
  storedState: StoredExamRuntimeState | null
) => {
  if (!storedState || storedState.submissionId !== examData.submissionId)
    return;

  answerRetryQueue.restore(storedState.pendingAnswers);
  answerRetryQueue.snapshot().forEach(item => {
    const record = answers.value.get(item.questionId);
    if (record) record.answer = item.answer;
  });
  syncPendingSaveState();
};

const resolveInitialQuestionIndex = (
  storedState: StoredExamRuntimeState | null
) => {
  if (
    storedState?.submissionId === examData.submissionId &&
    storedState.currentQuestionId
  ) {
    const restoredIndex = allQuestions.value.findIndex(
      item => item.questionId === storedState.currentQuestionId
    );
    if (restoredIndex >= 0) return restoredIndex;
  }

  const firstUnanswered = allQuestions.value.findIndex(
    item => !isQuestionAnswered(item.questionId)
  );
  return firstUnanswered >= 0 ? firstUnanswered : 0;
};

const getExamLoadErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message === "试卷 ID 无效") {
    return error.message;
  }
  return "当前试卷暂不可进入，请返回试卷中心后重试";
};

// start 保留为权威入口，随后用 session 恢复服务端答案，再叠加尚未补存的本地答案。
const loadExamData = async () => {
  loading.value = true;
  loadError.value = "";
  const storedState = readStoredRuntimeState();
  try {
    if (!Number.isInteger(paperId.value) || paperId.value <= 0) {
      throw new Error("试卷 ID 无效");
    }

    const res = await startExam(paperId.value);
    if (res.code !== 0 || !res.data) {
      throw new Error(res.msg || "加载考试失败");
    }

    examData.submissionId = Number(res.data.submissionId);
    examData.paper = res.data.paper;
    resetExamClock(
      Math.max(0, Math.floor(Number(res.data.remainingTime) || 0)),
      res.data.serverTime
    );
    answers.value.clear();
    answerRetryQueue.clear();
    initAnswerRecords();

    const snapshot = await fetchExamSession();
    if (snapshot?.status && snapshot.status !== "in_progress") {
      clearRuntimeState();
      ElMessage.info(
        snapshot.status === "submitted" ? "该试卷已提交" : "该考试已结束"
      );
      await router.replace("/student-exam-center/list");
      return;
    }
    if (snapshot) applySessionSnapshot(snapshot);

    restoreLocalPendingAnswers(storedState);
    currentQuestionIndex.value = resolveInitialQuestionIndex(storedState);
    const initialQuestion = allQuestions.value[currentQuestionIndex.value];
    if (initialQuestion) enterQuestion(initialQuestion.questionId);
    persistRuntimeState();

    startExamTimer();
    startQuestionTimer();
    startHeartbeat();

    if (answerRetryQueue.size > 0) {
      saveRetrying.value = true;
      retryWarningShown = true;
      ElMessage.warning("已恢复尚未上传的答案，正在自动补存");
      scheduleAnswerBatchRetry(0);
    }
  } catch (error) {
    console.error("加载考试失败:", error);
    loadError.value = getExamLoadErrorMessage(error);
  } finally {
    loading.value = false;
  }
};

const retryLoadExam = () => {
  void loadExamData();
};

const returnToExamCenter = () => {
  void router.replace("/student-exam-center/list");
};

const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (submitCompleted) return;
  persistRuntimeState();
  event.preventDefault();
  event.returnValue = "";
};

onMounted(() => {
  componentDisposed = false;
  window.addEventListener("beforeunload", handleBeforeUnload);
  window.addEventListener("pagehide", handlePageHide);
  window.addEventListener("blur", handleWindowBlur);
  window.addEventListener("online", handleOnline);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  void loadExamData();
});

onBeforeUnmount(() => {
  componentDisposed = true;
  if (!submitCompleted) {
    const activeQuestionId = currentQuestion.value?.questionId;
    if (activeQuestionId) void leaveQuestion(activeQuestionId);
    persistRuntimeState();
    if (answerRetryQueue.size > 0) void flushPendingAnswers();
  }
  stopTimers();
  window.removeEventListener("beforeunload", handleBeforeUnload);
  window.removeEventListener("pagehide", handlePageHide);
  window.removeEventListener("blur", handleWindowBlur);
  window.removeEventListener("online", handleOnline);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
});
</script>

<template>
  <div
    v-loading="loading"
    class="exam-do-container"
    :class="{ 'is-dark': isDark }"
  >
    <section
      v-if="loadError && !loading"
      class="exam-load-error"
      role="alert"
      aria-live="assertive"
    >
      <el-empty :image-size="96">
        <template #description>
          <p class="exam-load-error-title">无法进入本次考试</p>
          <p class="exam-load-error-message">{{ loadError }}</p>
        </template>
        <div class="exam-load-error-actions">
          <el-button @click="returnToExamCenter">返回试卷中心</el-button>
          <el-button type="primary" @click="retryLoadExam">重新加载</el-button>
        </div>
      </el-empty>
    </section>

    <!-- 顶部信息栏 -->
    <div v-show="!loadError || loading" class="exam-header">
      <div class="header-left">
        <h2 class="paper-title">{{ examData.paper?.title || "加载中..." }}</h2>
        <span class="paper-info">
          共 {{ allQuestions.length }} 题 | 已答 {{ answeredCount }} 题
        </span>
        <span
          v-if="examData.submissionId && !loading"
          class="save-status"
          :class="`is-${answerSaveStatus.state}`"
          role="status"
          aria-live="polite"
        >
          <span class="save-status-dot" />
          {{ answerSaveStatus.text }}
        </span>
      </div>
      <div class="header-center">
        <div class="timer" :class="{ warning: examData.remainingTime < 300 }">
          <el-icon><Clock /></el-icon>
          <span>剩余时间：{{ formattedRemainingTime }}</span>
        </div>
      </div>
      <div class="header-right">
        <el-button
          type="primary"
          class="submit-btn"
          :loading="submitting"
          @click="handleSubmit"
        >
          <el-icon><Check /></el-icon>
          交卷
        </el-button>
      </div>
    </div>

    <!-- 主内容区 -->
    <div v-show="!loadError || loading" class="exam-main">
      <!-- 左侧题目导航 -->
      <div class="question-nav">
        <div class="nav-header">
          <span>答题卡</span>
        </div>
        <div class="nav-grid">
          <button
            v-for="(q, index) in allQuestions"
            :key="q.questionId"
            type="button"
            class="nav-item"
            :class="{
              active: index === currentQuestionIndex,
              answered: isQuestionAnswered(q.questionId)
            }"
            @click="switchQuestion(index)"
          >
            {{ index + 1 }}
          </button>
        </div>
        <div class="nav-legend">
          <div class="legend-item">
            <span class="dot answered" />
            <span>已答</span>
          </div>
          <div class="legend-item">
            <span class="dot" />
            <span>未答</span>
          </div>
          <div class="legend-item">
            <span class="dot active" />
            <span>当前</span>
          </div>
        </div>
      </div>

      <!-- 中间答题区 -->
      <div class="question-content">
        <template v-if="currentQuestion">
          <!-- 题目头部 -->
          <div class="question-header">
            <div class="question-info">
              <span class="question-index"
                >第 {{ currentQuestionIndex + 1 }} 题</span
              >
              <el-tag size="small" type="info">{{
                currentQuestion.groupName
              }}</el-tag>
              <span class="question-points"
                >（{{ currentQuestion.points }} 分）</span
              >
            </div>
            <div class="question-timer">
              <el-icon><Timer /></el-icon>
              <span
                >本题用时：{{
                  formatDuration(getCurrentQuestionDuration)
                }}</span
              >
            </div>
          </div>

          <!-- 题干 -->
          <div class="question-stem">
            <RichContent :content="currentQuestion.stem" />
          </div>

          <!-- 选项区域 -->
          <div class="question-options">
            <!-- 单选题 -->
            <template
              v-if="[1, 3].includes(getQuestionTypeCode(currentQuestion))"
            >
              <el-radio-group
                :model-value="getScalarAnswer(currentAnswerRecord?.answer)"
                class="options-group"
                @update:model-value="handleScalarAnswerUpdate"
              >
                <el-radio
                  v-for="option in currentQuestion.options"
                  :key="option.key"
                  :value="option.key"
                  class="option-item"
                  :class="{
                    'is-checked': currentAnswerRecord?.answer === option.key
                  }"
                >
                  <span class="option-key">{{ option.key }}.</span>
                  <span class="option-content">
                    <RichContent :content="option.content" />
                  </span>
                </el-radio>
              </el-radio-group>
            </template>

            <!-- 多选题 -->
            <template v-else-if="getQuestionTypeCode(currentQuestion) === 2">
              <el-checkbox-group
                :model-value="currentAnswerRecord?.answer as string[]"
                class="options-group"
                @update:model-value="updateAnswer"
              >
                <el-checkbox
                  v-for="option in currentQuestion.options"
                  :key="option.key"
                  :value="option.key"
                  class="option-item"
                  :class="{
                    'is-checked': (
                      currentAnswerRecord?.answer as string[]
                    )?.includes(option.key)
                  }"
                >
                  <span class="option-key">{{ option.key }}.</span>
                  <span class="option-content">
                    <RichContent :content="option.content" />
                  </span>
                </el-checkbox>
              </el-checkbox-group>
            </template>

            <!-- 填空题 -->
            <template v-else-if="getQuestionTypeCode(currentQuestion) === 4">
              <el-input
                :model-value="currentAnswerRecord?.answer as string"
                placeholder="请输入答案"
                class="fill-input"
                @update:model-value="updateAnswer"
              />
            </template>

            <!-- 简答题/论述题 -->
            <template
              v-else-if="[5, 6].includes(getQuestionTypeCode(currentQuestion))"
            >
              <el-input
                :model-value="currentAnswerRecord?.answer as string"
                type="textarea"
                :rows="8"
                placeholder="请输入答案"
                class="essay-input"
                @update:model-value="updateAnswer"
              />
            </template>

            <!-- 矩阵题 -->
            <template
              v-else-if="[7, 8].includes(getQuestionTypeCode(currentQuestion))"
            >
              <div class="matrix-wrapper">
                <div class="matrix-header">
                  <span class="matrix-cell matrix-first" />
                  <span
                    v-for="col in getMatrixCols(currentQuestion)"
                    :key="col.key"
                    class="matrix-cell"
                  >
                    {{ col.content }}
                  </span>
                </div>
                <div
                  v-for="row in getMatrixRows(currentQuestion)"
                  :key="row.key"
                  class="matrix-row"
                >
                  <span class="matrix-cell matrix-first">{{
                    row.content
                  }}</span>

                  <template v-if="getQuestionTypeCode(currentQuestion) === 7">
                    <el-radio-group
                      :model-value="
                        getScalarAnswer(
                          (
                            currentAnswerRecord?.answer as Record<
                              string,
                              string
                            >
                          )?.[row.key]
                        )
                      "
                      class="matrix-radio-group"
                      @update:model-value="
                        val => updateMatrixSingleAnswer(row.key, String(val))
                      "
                    >
                      <el-radio
                        v-for="col in getMatrixCols(currentQuestion)"
                        :key="`${row.key}-${col.key}`"
                        :value="col.key"
                        class="matrix-cell"
                      />
                    </el-radio-group>
                  </template>

                  <template v-else>
                    <el-checkbox-group
                      :model-value="
                        ((
                          currentAnswerRecord?.answer as Record<
                            string,
                            string[]
                          >
                        )?.[row.key] || []) as string[]
                      "
                      class="matrix-checkbox-group"
                      @update:model-value="
                        val =>
                          updateMatrixMultipleAnswer(row.key, val as string[])
                      "
                    >
                      <el-checkbox
                        v-for="col in getMatrixCols(currentQuestion)"
                        :key="`${row.key}-${col.key}`"
                        :value="col.key"
                        class="matrix-cell"
                      />
                    </el-checkbox-group>
                  </template>
                </div>
              </div>
            </template>

            <!-- 连线题 -->
            <template v-else-if="getQuestionTypeCode(currentQuestion) === 9">
              <div class="matching-wrapper">
                <div
                  v-for="left in getMatchingLeftItems(currentQuestion)"
                  :key="left.key"
                  class="matching-row"
                >
                  <span class="matching-left">{{ left.content }}</span>
                  <el-select
                    :model-value="
                      (currentAnswerRecord?.answer as Record<string, string>)?.[
                        left.key
                      ]
                    "
                    placeholder="请选择对应项"
                    class="matching-select"
                    @update:model-value="
                      val => updateMatchingAnswer(left.key, String(val))
                    "
                  >
                    <el-option
                      v-for="right in getMatchingRightItems(currentQuestion)"
                      :key="right.key"
                      :label="right.content"
                      :value="right.key"
                    />
                  </el-select>
                </div>
              </div>
            </template>

            <!-- 排序题 -->
            <template v-else-if="getQuestionTypeCode(currentQuestion) === 10">
              <div class="ordering-wrapper">
                <div class="ordering-tip">
                  请选择并按顺序点击选项以形成你的排序答案
                </div>
                <el-select
                  :model-value="(currentAnswerRecord?.answer as string[]) || []"
                  multiple
                  class="ordering-select"
                  placeholder="按顺序选择"
                  @update:model-value="updateAnswer"
                >
                  <el-option
                    v-for="(item, idx) in getOrderingItems(currentQuestion)"
                    :key="`${item}-${idx}`"
                    :label="item"
                    :value="item"
                  />
                </el-select>
              </div>
            </template>

            <!-- 滑动评分 -->
            <template v-else-if="getQuestionTypeCode(currentQuestion) === 11">
              <div class="slider-wrapper">
                <el-slider
                  :model-value="
                    (currentAnswerRecord?.answer as number | null) ?? 0
                  "
                  :min="currentQuestion.sliderMin ?? 0"
                  :max="currentQuestion.sliderMax ?? 100"
                  :step="currentQuestion.sliderStep ?? 1"
                  show-input
                  @update:model-value="updateAnswer"
                />
                <div class="slider-labels">
                  <span>{{
                    currentQuestion.sliderLabels?.left || "最低"
                  }}</span>
                  <span>{{
                    currentQuestion.sliderLabels?.right || "最高"
                  }}</span>
                </div>
              </div>
            </template>

            <!-- NPS评分 -->
            <template v-else-if="getQuestionTypeCode(currentQuestion) === 12">
              <div class="nps-wrapper">
                <el-radio-group
                  :model-value="getScalarAnswer(currentAnswerRecord?.answer)"
                  class="nps-group"
                  @update:model-value="handleScalarAnswerUpdate"
                >
                  <el-radio
                    v-for="score in currentQuestion.npsMax
                      ? currentQuestion.npsMax + 1
                      : 11"
                    :key="`nps-${score - 1}`"
                    :value="score - 1"
                    class="nps-item"
                  >
                    {{ score - 1 }}
                  </el-radio>
                </el-radio-group>
              </div>
            </template>

            <!-- 星级评分 -->
            <template v-else-if="getQuestionTypeCode(currentQuestion) === 13">
              <div class="star-wrapper">
                <el-rate
                  :model-value="
                    (currentAnswerRecord?.answer as number | null) ?? 0
                  "
                  :max="currentQuestion.starCount || 5"
                  show-score
                  @update:model-value="updateAnswer"
                />
              </div>
            </template>

            <!-- 组合材料题 -->
            <template v-else-if="getQuestionTypeCode(currentQuestion) === 14">
              <div class="composite-wrapper">
                <div v-if="currentQuestion.material" class="composite-material">
                  <div class="material-title">材料</div>
                  <RichContent :content="currentQuestion.material" />
                </div>

                <div
                  v-for="(sub, subIndex) in getCompositeSubQuestions(
                    currentQuestion
                  )"
                  :key="sub.subId || subIndex"
                  class="composite-sub-question"
                >
                  <div class="sub-title">
                    子题 {{ subIndex + 1 }}（{{ sub.points || 0 }}分）
                  </div>
                  <RichContent :content="sub.stem || ''" />

                  <el-radio-group
                    v-if="toQuestionTypeCode(sub.questionType) === 1"
                    :model-value="
                      getScalarAnswer(getCompositeSubAnswer(sub.subId))
                    "
                    class="options-group"
                    @update:model-value="
                      val => updateCompositeSubAnswer(sub.subId, String(val))
                    "
                  >
                    <el-radio
                      v-for="option in sub.options || []"
                      :key="option.key"
                      :value="option.key"
                      class="option-item"
                    >
                      <span class="option-key">{{ option.key }}.</span>
                      <span class="option-content">
                        <RichContent :content="option.content" />
                      </span>
                    </el-radio>
                  </el-radio-group>

                  <el-checkbox-group
                    v-else-if="toQuestionTypeCode(sub.questionType) === 2"
                    :model-value="
                      (getCompositeSubAnswer(sub.subId) as string[]) || []
                    "
                    class="options-group"
                    @update:model-value="
                      val =>
                        updateCompositeSubAnswer(sub.subId, val as string[])
                    "
                  >
                    <el-checkbox
                      v-for="option in sub.options || []"
                      :key="option.key"
                      :value="option.key"
                      class="option-item"
                    >
                      <span class="option-key">{{ option.key }}.</span>
                      <span class="option-content">
                        <RichContent :content="option.content" />
                      </span>
                    </el-checkbox>
                  </el-checkbox-group>

                  <el-input
                    v-else-if="toQuestionTypeCode(sub.questionType) === 4"
                    :model-value="getCompositeSubAnswer(sub.subId) as string"
                    placeholder="请输入答案"
                    class="fill-input"
                    @update:model-value="
                      val => updateCompositeSubAnswer(sub.subId, val)
                    "
                  />

                  <el-input
                    v-else
                    :model-value="getCompositeSubAnswer(sub.subId) as string"
                    type="textarea"
                    :rows="4"
                    placeholder="请输入答案"
                    class="essay-input"
                    @update:model-value="
                      val => updateCompositeSubAnswer(sub.subId, val)
                    "
                  />
                </div>
              </div>
            </template>

            <template v-else>
              <el-empty description="当前题型暂未适配" :image-size="100" />
            </template>
          </div>

          <!-- 底部导航 -->
          <div class="question-footer">
            <el-button
              class="nav-btn"
              :disabled="currentQuestionIndex === 0"
              @click="prevQuestion"
            >
              <el-icon><ArrowLeft /></el-icon>
              上一题
            </el-button>
            <el-button
              v-if="currentQuestionIndex < allQuestions.length - 1"
              class="nav-btn"
              type="primary"
              @click="nextQuestion"
            >
              下一题
              <el-icon><ArrowRight /></el-icon>
            </el-button>
            <el-button
              v-else
              class="nav-btn"
              type="primary"
              :loading="submitting"
              @click="handleSubmit"
            >
              <el-icon><Check /></el-icon>
              交卷
            </el-button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.exam-do-container {
  min-height: 100vh;
  min-height: 100dvh;
  box-sizing: border-box;
  background: #f5f7fa;
  display: flex;
  flex-direction: column;

  &.is-dark {
    background: #0f172a;

    .exam-header {
      background: rgba(30, 41, 59, 0.9);
      border-color: rgba(255, 255, 255, 0.1);
    }

    .paper-title {
      color: #f1f5f9;
    }

    .question-nav {
      background: rgba(30, 41, 59, 0.8);
      border-color: rgba(255, 255, 255, 0.1);
    }

    .question-content {
      background: rgba(30, 41, 59, 0.8);
    }

    .exam-load-error-title {
      color: #f1f5f9;
    }

    .exam-load-error-message {
      color: #94a3b8;
    }

    .question-stem {
      color: #f1f5f9;
    }

    .header-left .save-status {
      background: rgba(15, 23, 42, 0.72);

      &.is-saved {
        color: #86efac;
      }

      &.is-saving {
        color: #93c5fd;
      }

      &.is-warning {
        color: #fdba74;
      }
    }
  }
}

.exam-load-error {
  flex: 1;
  display: grid;
  place-items: center;
  min-height: calc(100dvh - 64px);
  padding: 24px;
  text-align: center;

  :deep(.el-empty) {
    width: min(100%, 420px);
  }

  :deep(.el-empty__description) {
    margin-top: 8px;
  }

  .exam-load-error-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #1f2937;
  }

  .exam-load-error-message {
    max-width: 320px;
    margin: 8px auto 0;
    color: #64748b;
    font-size: 14px;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }

  .exam-load-error-actions {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 8px;

    :deep(.el-button) {
      min-height: 44px;
      margin: 0;
    }
  }
}

.exam-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

  .header-left {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;

    .paper-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    .paper-info {
      font-size: 14px;
      color: #6b7280;
    }

    .save-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 26px;
      padding: 0 9px;
      border-radius: 6px;
      font-size: 12px;
      white-space: nowrap;

      &.is-saved {
        color: #166534;
        background: #f0fdf4;
      }

      &.is-saving {
        color: #1d4ed8;
        background: #eff6ff;
      }

      &.is-warning {
        color: #9a3412;
        background: #fff7ed;
      }

      .save-status-dot {
        width: 7px;
        height: 7px;
        flex: 0 0 7px;
        border-radius: 50%;
        background: currentColor;
      }
    }
  }

  .header-center {
    .timer {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 42px;
      padding: 0 16px;
      background: #f0f9ff;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      color: #0369a1;

      &.warning {
        background: #fef2f2;
        color: #dc2626;
        animation: pulse 1s infinite;
      }
    }
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.exam-main {
  display: flex;
  flex: 1;
  padding: 20px;
  gap: 20px;
}

.question-nav {
  width: 200px;
  flex-shrink: 0;
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

  .nav-header {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e5e7eb;
  }

  .nav-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
    margin-bottom: 16px;
  }

  .nav-item {
    padding: 0;
    appearance: none;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    background: #f5f7fa;
    border: 1px solid #e5e7eb;
    transition: all 0.2s;

    &:hover {
      border-color: #667eea;
    }

    &.active {
      background: #667eea;
      color: #fff;
      border-color: #667eea;
    }

    &.answered {
      background: #739cf9;
      color: #fff;
      border-color: #739cf9;
    }

    &.answered.active {
      background: #667eea;
      border-color: #667eea;
    }
  }

  .nav-legend {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid #e5e7eb;

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #6b7280;

      .dot {
        width: 12px;
        height: 12px;
        border-radius: 3px;
        background: #f5f7fa;
        border: 1px solid #e5e7eb;

        &.answered {
          background: #739cf9;
          border-color: #739cf9;
        }

        &.active {
          background: #667eea;
          border-color: #667eea;
        }
      }
    }
  }
}

.question-content {
  flex: 1;
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

  .question-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #e5e7eb;

    .question-info {
      display: flex;
      align-items: center;
      gap: 12px;

      .question-index {
        font-size: 16px;
        font-weight: 600;
      }

      .question-points {
        font-size: 14px;
        color: #6b7280;
      }
    }

    .question-timer {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 34px;
      font-size: 14px;
      color: #6b7280;
      padding: 0 12px;
      background: #f5f7fa;
      border-radius: 6px;
    }
  }

  .question-stem {
    font-size: 16px;
    line-height: 1.8;
    margin-bottom: 24px;
    color: #1f2937;
  }

  .question-options {
    margin-bottom: 24px;

    .options-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .option-item {
      background: #fff;
      border-radius: 8px;
      border: 2px solid #e5e7eb;
      transition: all 0.2s;
      cursor: pointer;
      width: 100%;
      margin: 0;
      padding: 0;

      // 隐藏默认的 radio/checkbox 图标
      :deep(.el-radio__input),
      :deep(.el-checkbox__input) {
        display: none;
      }

      // 让 label 占满整个空间
      :deep(.el-radio__label),
      :deep(.el-checkbox__label) {
        padding: 12px 16px;
        margin: 0;
        display: flex;
        align-items: flex-start;
        width: 100%;
        line-height: 1.6;
      }

      &:hover {
        border-color: #667eea;
        background: #f8f9ff;
      }

      // 选中状态
      &.is-checked {
        background: #e0e7ff;
        border-color: #667eea;

        .option-key {
          color: #667eea;
        }
      }

      .option-key {
        font-weight: 600;
        margin-right: 8px;
        flex-shrink: 0;
        min-width: 24px;
      }

      .option-content {
        flex: 1;
        word-break: break-word;
      }
    }

    .fill-input {
      max-width: 400px;
    }

    .essay-input {
      width: 100%;
    }

    .matrix-wrapper {
      display: flex;
      flex-direction: column;
      gap: 8px;

      .matrix-header,
      .matrix-row {
        display: grid;
        grid-template-columns: 180px repeat(auto-fit, minmax(80px, 1fr));
        align-items: center;
        gap: 8px;
      }

      .matrix-cell {
        text-align: center;
      }

      .matrix-first {
        text-align: left;
        font-weight: 600;
      }

      .matrix-radio-group,
      .matrix-checkbox-group {
        display: contents;
      }
    }

    .matching-wrapper {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .matching-row {
        display: grid;
        grid-template-columns: 1fr 260px;
        gap: 12px;
        align-items: center;
      }

      .matching-left {
        padding: 10px 12px;
        background: #f8fafc;
        border-radius: 8px;
      }
    }

    .ordering-wrapper,
    .slider-wrapper,
    .nps-wrapper,
    .star-wrapper,
    .composite-wrapper {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .ordering-tip {
      font-size: 13px;
      color: #6b7280;
    }

    .slider-labels {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #6b7280;
    }

    .nps-group {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .nps-item {
      margin-right: 0;
    }

    .composite-material,
    .composite-sub-question {
      padding: 12px;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      background: #fcfcfd;
    }

    .material-title,
    .sub-title {
      margin-bottom: 8px;
      font-weight: 600;
      color: #374151;
    }
  }

  .question-footer {
    display: flex;
    justify-content: center;
    gap: 16px;
    padding-top: 20px;
    border-top: 1px solid #e5e7eb;

    .nav-btn {
      min-width: 96px;
      height: 40px;
      padding: 0 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      line-height: 1;
      border-radius: 10px;
      font-weight: 600;
      vertical-align: middle;
    }
  }
}

.header-right {
  .submit-btn {
    min-width: 84px;
    height: 40px;
    padding: 0 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    line-height: 1;
    border: none;
    border-radius: 10px;
    font-weight: 600;
    background: #4a7fc8;

    &:hover {
      background: #4a7fc8;
    }
  }
}

@media screen and (max-width: 900px) {
  .exam-do-container {
    min-width: 0;
    overflow-x: hidden;
  }

  .exam-header {
    position: sticky;
    top: 0;
    z-index: 20;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    padding: calc(
        10px + var(--pure-safe-area-top, env(safe-area-inset-top, 0px))
      )
      max(8px, env(safe-area-inset-right, 0px)) 10px
      max(8px, env(safe-area-inset-left, 0px));
    box-sizing: border-box;

    .header-left {
      grid-column: 1 / -1;
      min-width: 0;
      gap: 6px 10px;

      .paper-title {
        width: 100%;
        font-size: 16px;
        line-height: 1.4;
        overflow-wrap: anywhere;
      }

      .paper-info {
        font-size: 13px;
      }

      .save-status {
        min-height: 28px;
      }
    }

    .header-center {
      min-width: 0;

      .timer {
        min-height: 44px;
        padding: 0 10px;
        font-size: 14px;
        white-space: nowrap;
      }
    }

    .header-right .submit-btn {
      min-height: 44px;
    }
  }

  .exam-main {
    flex-direction: column;
    min-width: 0;
    gap: 8px;
    padding: 8px max(8px, env(safe-area-inset-right, 0px))
      calc(
        16px + var(--pure-safe-area-bottom, env(safe-area-inset-bottom, 0px))
      )
      max(8px, env(safe-area-inset-left, 0px));
    box-sizing: border-box;
  }

  .question-nav {
    width: 100%;
    min-width: 0;
    padding: 10px;
    border-radius: 10px;

    .nav-header {
      padding-bottom: 8px;
      margin-bottom: 8px;
    }

    .nav-grid {
      display: flex;
      gap: 8px;
      padding-bottom: 4px;
      margin-bottom: 8px;
      overflow-x: auto;
      overscroll-behavior-x: contain;
      scroll-snap-type: x proximity;
      scrollbar-width: thin;
    }

    .nav-item {
      flex: 0 0 44px;
      width: 44px;
      height: 44px;
      scroll-snap-align: start;
      font-size: 14px;
    }

    .nav-legend {
      flex-flow: row wrap;
      gap: 8px 16px;
      padding-top: 8px;
    }
  }

  .question-content {
    width: 100%;
    min-width: 0;
    padding: 12px;
    border-radius: 10px;

    .question-header {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
      padding-bottom: 12px;
      margin-bottom: 16px;

      .question-info {
        flex-wrap: wrap;
        gap: 6px 8px;
      }

      .question-timer {
        align-self: flex-start;
        min-height: 44px;
      }
    }

    .question-stem {
      margin-bottom: 16px;
      font-size: 15px;
      overflow-wrap: anywhere;
    }

    .question-options {
      min-width: 0;
      margin-bottom: 16px;

      .option-item {
        :deep(.el-radio__label),
        :deep(.el-checkbox__label) {
          min-height: 44px;
          padding: 11px 12px;
        }
      }

      .fill-input,
      .ordering-select,
      .matching-select {
        width: 100%;
        max-width: none;
      }

      .matrix-wrapper {
        max-width: 100%;
        overflow-x: auto;
        overscroll-behavior-x: contain;

        .matrix-header,
        .matrix-row {
          min-width: 520px;
          grid-template-columns: 140px repeat(auto-fit, minmax(64px, 1fr));
        }
      }

      .matching-wrapper .matching-row {
        grid-template-columns: minmax(0, 1fr);
      }

      .nps-item {
        min-width: 44px;
        min-height: 44px;

        :deep(.el-radio__label) {
          display: inline-flex;
          align-items: center;
          min-height: 44px;
          padding-right: 10px;
        }
      }

      .composite-material,
      .composite-sub-question {
        padding: 10px;
      }
    }

    .question-footer {
      gap: 8px;
      padding-top: 12px;

      .nav-btn {
        flex: 1 1 0;
        min-width: 0;
        min-height: 44px;
        height: 44px;
        padding: 0 10px;
      }
    }
  }
}

@media screen and (max-width: 360px) {
  .exam-header,
  .exam-main {
    padding-right: max(6px, env(safe-area-inset-right, 0px));
    padding-left: max(6px, env(safe-area-inset-left, 0px));
  }

  .exam-header .header-center .timer {
    padding: 0 8px;
    font-size: 13px;
  }

  .question-content {
    padding: 10px;
  }
}

@media (hover: none), (pointer: coarse) {
  .question-nav .nav-item:hover,
  .question-content .question-options .option-item:hover {
    transform: none;
  }
}
</style>
