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
    rect.width > 16 &&
    rect.height > 16 &&
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

function ownsHit(node, target) {
  if (!target) return false;

  const button = node.closest?.("button");
  return (
    target === node ||
    node.contains(target) ||
    (button && (target === button || button.contains(target))) ||
    !!target.closest?.(".el-input, .el-textarea, .el-button")
  );
}

function isInteractable(node) {
  return !!ownsHit(node, hitTarget(node));
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

function findButtonByText(label) {
  return [...document.querySelectorAll("button")].find(button =>
    button.textContent?.replace(/\s+/g, "").includes(label)
  );
}

function findTypeItem(label) {
  return [...document.querySelectorAll(".type-item")].find(item =>
    item.textContent?.replace(/\s+/g, "").includes(label)
  );
}

const beforeText = appText();
const titleInput = document.querySelector(".title-input input");
if (!titleInput) {
  return { ok: false, reason: "missing paper title input", beforeText };
}

titleInput.scrollIntoView({ block: "center", inline: "nearest" });
await wait(300);

const paperTitle = `iOS自动化验收试卷-${Date.now()}`;
setNativeValue(titleInput, paperTitle);
await wait(500);

const previewButtonAtTop = findButtonByText("预览");
const saveButtonAtTop = findButtonByText("保存");
const publishButtonAtTop = findButtonByText("发布");
const headerButtonsAtTop = {
  previewVisible: isVisible(previewButtonAtTop),
  saveVisible: isVisible(saveButtonAtTop),
  publishVisible: isVisible(publishButtonAtTop)
};

const targetTypeItem = findTypeItem("单选题") || findTypeItem("判断题");
if (!targetTypeItem) {
  return {
    ok: false,
    reason: "missing basic question type item",
    titleValue: titleInput.value,
    beforeText
  };
}

const typeLabel = targetTypeItem.textContent?.trim() || "";
const beforeGroups = document.querySelectorAll(".question-group-header").length;
const beforeCards = document.querySelectorAll(".question-card").length;

targetTypeItem.scrollIntoView({ block: "center", inline: "nearest" });
await wait(300);
const typeInteractable = isInteractable(targetTypeItem);
if (!typeInteractable) {
  return {
    ok: false,
    reason: "question type item is not interactable",
    titleValue: titleInput.value,
    typeLabel,
    beforeGroups,
    beforeCards
  };
}

targetTypeItem.dispatchEvent(
  new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    view: window
  })
);
await wait(1000);

const questionCards = [...document.querySelectorAll(".question-card")];
const afterGroups = document.querySelectorAll(".question-group-header").length;
const afterCards = questionCards.length;
const activeCard =
  questionCards.find(card => card.classList.contains("active")) ||
  questionCards[questionCards.length - 1];

if (!activeCard) {
  return {
    ok: false,
    reason: "question card was not created",
    titleValue: titleInput.value,
    typeLabel,
    typeInteractable,
    beforeGroups,
    afterGroups,
    beforeCards,
    afterCards,
    afterText: appText().slice(0, 800)
  };
}

activeCard.scrollIntoView({ block: "center", inline: "nearest" });
await wait(500);

const stemTextarea = activeCard.querySelector(".question-stem textarea");
if (stemTextarea) {
  setNativeValue(stemTextarea, "这是一道 iOS 原生壳自动化创建的单选题题干");
}

const optionInputs = [
  ...activeCard.querySelectorAll(".option-input input")
].filter(input => !input.disabled);
const optionValues = ["选项A", "选项B"];
optionInputs.slice(0, 2).forEach((input, index) => {
  setNativeValue(input, optionValues[index]);
});

const correctRadio = activeCard.querySelector(".question-options .el-radio");
if (correctRadio) {
  correctRadio.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
  );
}
await wait(600);

const updatedText = appText();
const cardText = activeCard.innerText.replace(/\s+/g, " ");

return {
  ok:
    titleInput.value === paperTitle &&
    afterGroups >= beforeGroups + 1 &&
    afterCards >= beforeCards + 1 &&
    !!stemTextarea &&
    stemTextarea.value.includes("iOS 原生壳自动化") &&
    optionInputs.length >= 2 &&
    optionInputs[0].value === optionValues[0] &&
    optionInputs[1].value === optionValues[1] &&
    !!previewButtonAtTop &&
    !!saveButtonAtTop &&
    !!publishButtonAtTop &&
    headerButtonsAtTop.previewVisible &&
    headerButtonsAtTop.saveVisible &&
    headerButtonsAtTop.publishVisible,
  titleValue: titleInput.value,
  typeLabel,
  typeInteractable,
  beforeGroups,
  afterGroups,
  beforeCards,
  afterCards,
  hasStemTextarea: !!stemTextarea,
  stemValue: stemTextarea?.value || "",
  optionValues: optionInputs.slice(0, 4).map(input => input.value),
  headerButtonsAtTop,
  cardText: cardText.slice(0, 500),
  pageText: updatedText.slice(0, 800)
};
