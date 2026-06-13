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
    style.opacity !== "0"
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
    (target === node || node.contains(target) || target.closest?.("button"))
  );
}

function clickNode(node) {
  if (!node) return false;
  node.scrollIntoView({ block: "center", inline: "nearest" });
  node.click();
  return true;
}

function setNativeValue(field, value) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;

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

function findDialogByTitle(title) {
  return [...document.querySelectorAll(".el-dialog")].find(dialog =>
    dialog.textContent?.replace(/\s+/g, "").includes(title)
  );
}

async function waitFor(predicate, timeoutMs = 7000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = predicate();
    if (value) return value;
    await wait(200);
  }
  return null;
}

async function clickAndWait(button, predicate, timeoutMs = 7000) {
  if (!button || !isInteractable(button)) {
    return null;
  }
  clickNode(button);
  return waitFor(predicate, timeoutMs);
}

async function closeDialog(dialog) {
  const closeButton =
    dialog?.querySelector(".el-dialog__headerbtn") ||
    findButtonByText("取消", dialog) ||
    findButtonByText("关闭", dialog);
  if (!closeButton) return false;
  closeButton.click();
  const closed = await waitFor(() => !isVisible(dialog), 2500);
  return !!closed;
}

await wait(700);

const beforeText = appText();
const cards = [...document.querySelectorAll(".course-card")];
const searchInput = document.querySelector(".search-form input");
const searchButton = findButtonByText("搜索", document.querySelector(".search-form"));
const resetButton = findButtonByText("重置", document.querySelector(".search-form"));
const createButton = findButtonByText("创建课程");
const firstCard = cards[0];

if (!beforeText.includes("课程总数") || cards.length === 0 || !firstCard) {
  return {
    ok: false,
    reason: "course list did not render",
    href: location.href,
    beforeText: beforeText.slice(0, 1000),
    cardCount: cards.length
  };
}

const searchInteractable = isInteractable(searchButton);
const resetInteractable = isInteractable(resetButton);
const createInteractable = isInteractable(createButton);
const firstCardTextBeforeSearch = firstCard.innerText.replace(/\s+/g, " ");

if (searchInput) {
  setNativeValue(searchInput, "物理");
  searchButton?.click();
  await wait(800);
  resetButton?.click();
  await wait(800);
}

const createDialog = await clickAndWait(createButton, () =>
  findDialogByTitle("创建课程")
);
const createDialogOpened = !!createDialog && isVisible(createDialog);
const createDialogClosed = createDialogOpened ? await closeDialog(createDialog) : false;

const refreshedCards = [...document.querySelectorAll(".course-card")];
const activeCard = refreshedCards[0] || firstCard;
const firstCardText = activeCard.innerText.replace(/\s+/g, " ");

activeCard.scrollIntoView({ block: "center", inline: "nearest" });
await wait(300);

const hoursButton = findButtonByText("章节课时", activeCard);
const attrsButton = findButtonByText("附件资源", activeCard);
const allocationButton = findButtonByText("学员分配", activeCard);
const studyButton = findButtonByText("学习情况", activeCard);

const hoursDialog = await clickAndWait(hoursButton, () =>
  findDialogByTitle("课时列表")
);
const hoursDialogOpened = !!hoursDialog && isVisible(hoursDialog);
const hoursDialogText = hoursDialog?.innerText.replace(/\s+/g, " ").slice(0, 700) || "";
const hoursDialogClosed = hoursDialogOpened ? await closeDialog(hoursDialog) : false;
activeCard.scrollIntoView({ block: "center", inline: "nearest" });
await wait(300);

const attrsDialog = await clickAndWait(attrsButton, () =>
  findDialogByTitle("附件列表")
);
const attrsDialogOpened = !!attrsDialog && isVisible(attrsDialog);
const attrsDialogText = attrsDialog?.innerText.replace(/\s+/g, " ").slice(0, 700) || "";
const attrsDialogClosed = attrsDialogOpened ? await closeDialog(attrsDialog) : false;
activeCard.scrollIntoView({ block: "center", inline: "nearest" });
await wait(300);

const studyDialog = await clickAndWait(studyButton, () =>
  findDialogByTitle("学员学习情况")
);
const studyDialogOpened = !!studyDialog && isVisible(studyDialog);
const studyDialogText =
  studyDialog?.innerText.replace(/\s+/g, " ").slice(0, 700) || "";
const studyDialogClosed = studyDialogOpened ? await closeDialog(studyDialog) : false;

const horizontalOverflow = Math.max(
  0,
  Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
    (window.visualViewport?.width || window.innerWidth)
);

return {
  ok:
    refreshedCards.length >= 3 &&
    searchInteractable &&
    resetInteractable &&
    createInteractable &&
    createDialogOpened &&
    createDialogClosed &&
    !!hoursButton &&
    !!attrsButton &&
    !!allocationButton &&
    !!studyButton &&
    hoursDialogOpened &&
    hoursDialogClosed &&
    attrsDialogOpened &&
    attrsDialogClosed &&
    studyDialogOpened &&
    studyDialogClosed &&
    horizontalOverflow <= 4,
  href: location.href,
  cardCount: refreshedCards.length,
  initialCardCount: cards.length,
  firstCardTextBeforeSearch,
  firstCardText,
  searchInteractable,
  resetInteractable,
  createInteractable,
  createDialogOpened,
  createDialogClosed,
  hasHoursButton: !!hoursButton,
  hasAttrsButton: !!attrsButton,
  hasAllocationButton: !!allocationButton,
  hasStudyButton: !!studyButton,
  hoursDialogOpened,
  hoursDialogClosed,
  hoursDialogText,
  attrsDialogOpened,
  attrsDialogClosed,
  attrsDialogText,
  studyDialogOpened,
  studyDialogClosed,
  studyDialogText,
  horizontalOverflow,
  text: appText().slice(0, 1400)
};
