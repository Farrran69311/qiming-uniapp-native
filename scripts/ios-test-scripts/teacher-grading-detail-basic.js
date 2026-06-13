function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function appText() {
  return (document.querySelector("#app")?.innerText || "").replace(/\s+/g, " ");
}

function isVisible(node) {
  if (!node) return false;

  const rect = node.getBoundingClientRect();
  const style = window.getComputedStyle(node);
  const viewportWidth = window.visualViewport?.width || window.innerWidth;
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  return (
    rect.width > 12 &&
    rect.height > 12 &&
    centerX >= 0 &&
    centerY >= 0 &&
    centerX <= viewportWidth &&
    centerY <= viewportHeight &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0" &&
    !style.transform.includes("matrix(0")
  );
}

function hitTarget(node) {
  if (!isVisible(node)) return null;

  const rect = node.getBoundingClientRect();
  return document.elementFromPoint(
    rect.left + rect.width / 2,
    rect.top + rect.height / 2
  );
}

function isInteractable(node) {
  const target = hitTarget(node);
  return !!(
    target &&
    (target === node ||
      node.contains(target) ||
      target.closest?.(".el-input, .el-input-number, .el-textarea, .el-button"))
  );
}

function setNativeValue(field, value) {
  const proto =
    field instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;

  field.focus();
  if (setter) {
    setter.call(field, value);
  } else {
    field.value = value;
  }
  field.dispatchEvent(new InputEvent("input", { bubbles: true, data: value }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

function findButtonByText(label, root = document) {
  return [...root.querySelectorAll("button")].find(button =>
    button.textContent?.replace(/\s+/g, "").includes(label)
  );
}

const beforeText = appText();
if (!beforeText.includes("学生列表") || !beforeText.includes("评分汇总")) {
  return {
    ok: false,
    reason: "grading detail page did not render",
    beforeText: beforeText.slice(0, 900),
    href: location.href
  };
}

const answers = [...document.querySelectorAll(".answer-item")];
const pendingAnswer =
  answers.find(item => item.classList.contains("needs-grading")) || answers[1];

if (!pendingAnswer) {
  return {
    ok: false,
    reason: "missing pending answer item",
    answerCount: answers.length,
    beforeText: beforeText.slice(0, 900)
  };
}

pendingAnswer.scrollIntoView({ block: "center", inline: "nearest" });
await wait(400);

const scoreInput = pendingAnswer.querySelector(".score-input input");
const commentTextarea = pendingAnswer.querySelector(".comment-input textarea");
if (!scoreInput || !commentTextarea) {
  return {
    ok: false,
    reason: "missing score input or comment textarea",
    hasScoreInput: !!scoreInput,
    hasCommentTextarea: !!commentTextarea,
    answerText: pendingAnswer.innerText.replace(/\s+/g, " ").slice(0, 700)
  };
}

const scoreInteractable = isInteractable(scoreInput);
const commentInteractable = isInteractable(commentTextarea);
if (!scoreInteractable || !commentInteractable) {
  return {
    ok: false,
    reason: "score or comment field is not interactable",
    scoreInteractable,
    commentInteractable
  };
}

const scoreValue = "12";
const commentValue = "iOS 原生壳阅卷交互验收评语";
setNativeValue(scoreInput, scoreValue);
setNativeValue(commentTextarea, commentValue);
await wait(800);

const fullScoreButton = findButtonByText("满分", pendingAnswer);
const zeroScoreButton = findButtonByText("零分", pendingAnswer);
const submitButton = findButtonByText("提交评分");
const afterText = appText();

return {
  ok:
    scoreInput.value === scoreValue &&
    commentTextarea.value === commentValue &&
    afterText.includes("17 当前总分") &&
    afterText.includes("第 2 题 12 / 15") &&
    !afterText.includes("还有 1 道题未评分") &&
    !!submitButton &&
    !submitButton.disabled &&
    !!fullScoreButton &&
    !!zeroScoreButton,
  href: location.href,
  scoreValue: scoreInput.value,
  commentValue: commentTextarea.value,
  scoreInteractable,
  commentInteractable,
  hasFullScoreButton: !!fullScoreButton,
  hasZeroScoreButton: !!zeroScoreButton,
  hasSubmitButton: !!submitButton,
  submitButtonDisabled: submitButton?.disabled || false,
  beforeText: beforeText.slice(0, 900),
  afterText: afterText.slice(0, 1200)
};
