function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function appText() {
  return (document.querySelector("#app")?.innerText || "").replace(/\s+/g, " ");
}

function rectOf(node) {
  if (!node) return null;
  const rect = node.getBoundingClientRect();
  return {
    left: Math.round(rect.left),
    top: Math.round(rect.top),
    right: Math.round(rect.right),
    bottom: Math.round(rect.bottom),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  };
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
    centerX >= -1 &&
    centerY >= -1 &&
    centerX <= viewportWidth + 1 &&
    centerY <= viewportHeight + 1 &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0"
  );
}

function hitTarget(node) {
  if (!isVisible(node)) return null;

  const rect = node.getBoundingClientRect();
  const viewportWidth = window.visualViewport?.width || window.innerWidth;
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  return document.elementFromPoint(
    Math.min(Math.max(rect.left + rect.width / 2, 1), viewportWidth - 1),
    Math.min(Math.max(rect.top + rect.height / 2, 1), viewportHeight - 1)
  );
}

function isInteractable(node) {
  const target = hitTarget(node);
  return !!(
    target &&
    (target === node ||
      node.contains(target) ||
      target.closest?.("button") === node ||
      target.closest?.(".el-button") === node ||
      target.closest?.(".el-checkbox") === node ||
      target.closest?.(".el-switch") === node ||
      target.closest?.(".el-select") === node ||
      target.closest?.(".el-input") === node)
  );
}

function findButtonByText(label, root = document) {
  const normalizedLabel = label.replace(/\s+/g, "");
  return [...root.querySelectorAll("button")].find(button =>
    button.textContent?.replace(/\s+/g, "").includes(normalizedLabel)
  );
}

async function waitFor(predicate, timeoutMs = 8000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = predicate();
    if (value) return value;
    await wait(200);
  }
  return null;
}

function clickNode(node, shouldScroll = true) {
  if (!node) return false;
  if (shouldScroll) {
    node.scrollIntoView({ block: "center", inline: "nearest" });
  }
  node.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  node.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  node.click();
  return true;
}

function visibleDropdown() {
  return [...document.querySelectorAll(".el-select-dropdown, .el-popper")].find(
    node => isVisible(node) && node.innerText?.trim()
  );
}

function visibleOptions(dropdown = visibleDropdown()) {
  return dropdown
    ? [...dropdown.querySelectorAll(".el-select-dropdown__item")].filter(
        node => isVisible(node) && !node.classList.contains("is-disabled")
      )
    : [];
}

async function closeDropdowns() {
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      keyCode: 27,
      bubbles: true
    })
  );
  document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  document.body.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  document.body.click();
  await waitFor(() => !visibleDropdown(), 1200);
}

function selectInFormItem(labelText) {
  const normalizedLabel = labelText.replace(/\s+/g, "");
  const formItem = [...document.querySelectorAll(".el-form-item")].find(item =>
    item
      .querySelector(".el-form-item__label")
      ?.textContent?.replace(/\s+/g, "")
      .includes(normalizedLabel)
  );
  const select = formItem?.querySelector(".el-select");
  const input = select?.querySelector("input") || null;
  return {
    input,
    select,
    trigger:
      select?.querySelector(".el-select__wrapper") ||
      select?.querySelector(".el-input__wrapper") ||
      select
  };
}

async function openSelectByLabel(labelText) {
  await closeDropdowns();

  const { input, select, trigger } = selectInFormItem(labelText);

  if (!select || !trigger) {
    return {
      hasInput: !!input,
      hasSelect: !!select,
      opened: false,
      optionCount: 0,
      dropdownText: "",
      interactable: false,
      disabled: true
    };
  }

  const interactable = isInteractable(trigger);
  clickNode(trigger);
  const dropdown = await waitFor(visibleDropdown, 5000);
  const options = visibleOptions(dropdown);

  return {
    input,
    trigger,
    dropdown,
    options,
    hasInput: true,
    opened: !!dropdown,
    optionCount: options.length,
    dropdownText: dropdown?.innerText.replace(/\s+/g, " ").slice(0, 500) || "",
    interactable,
    disabled:
      input?.disabled ||
      input?.getAttribute("aria-disabled") === "true" ||
      select?.classList.contains("is-disabled") ||
      trigger?.classList.contains("is-disabled"),
    rect: rectOf(trigger)
  };
}

async function chooseSelectOptionByLabel(labelText, optionText) {
  const opened = await openSelectByLabel(labelText);
  if (!opened.opened || opened.optionCount === 0) {
    await closeDropdowns();
    return {
      ...opened,
      selected: false,
      selectedText: ""
    };
  }

  const normalizedOption = optionText.replace(/\s+/g, "");
  const option =
    opened.options.find(node =>
      node.textContent?.replace(/\s+/g, "").includes(normalizedOption)
    ) || opened.options[0];
  const selectedText = option.textContent?.replace(/\s+/g, " ").trim() || "";
  clickNode(option, false);
  await wait(900);
  await closeDropdowns();

  return {
    ...opened,
    selected: true,
    selectedText
  };
}

function horizontalOverflow() {
  return Math.max(
    0,
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
      (window.visualViewport?.width || window.innerWidth)
  );
}

function topChromeBottom() {
  const navBar = document.querySelector(".navbar");
  const header = document.querySelector(".fixed-header");
  const navRect = navBar?.getBoundingClientRect();
  const headerRect = header?.getBoundingClientRect();
  return Math.max(
    0,
    navRect && isVisible(navBar) ? navRect.bottom : 0,
    headerRect && isVisible(header) ? headerRect.bottom : 0
  );
}

function bottomChromeTop() {
  const mobileNav = document.querySelector(".nav-mobile-container");
  const rect = mobileNav?.getBoundingClientRect();
  return rect && isVisible(mobileNav)
    ? rect.top
    : window.visualViewport?.height || window.innerHeight;
}

async function scrollClearOfChrome(node) {
  if (!node) return false;

  node.scrollIntoView({ block: "center", inline: "nearest" });
  await wait(250);

  for (let attempt = 0; attempt < 4; attempt++) {
    const rect = node.getBoundingClientRect();
    const desiredTop = topChromeBottom() + 28;
    const desiredBottom = bottomChromeTop() - 28;

    if (rect.top >= desiredTop && rect.bottom <= desiredBottom) {
      return true;
    }

    if (rect.top < desiredTop) {
      window.scrollBy(0, rect.top - desiredTop);
    } else if (rect.bottom > desiredBottom) {
      window.scrollBy(0, rect.bottom - desiredBottom);
    }

    await wait(250);
  }

  return isVisible(node);
}

function visibleDialog(title) {
  return [...document.querySelectorAll(".el-dialog")].find(
    dialog =>
      isVisible(dialog) &&
      (!title || dialog.textContent?.replace(/\s+/g, "").includes(title))
  );
}

async function closeVisibleDialog(title) {
  const dialog = visibleDialog(title);
  const closeButton =
    dialog?.querySelector(".el-dialog__headerbtn") ||
    findButtonByText("取消", dialog) ||
    findButtonByText("关闭", dialog);
  if (!dialog || !closeButton) return false;

  closeButton.click();
  return !!(await waitFor(() => !isVisible(dialog), 3000));
}

function visibleMessageBox(title) {
  return [...document.querySelectorAll(".el-message-box")].find(
    box =>
      isVisible(box) &&
      (!title || box.textContent?.replace(/\s+/g, "").includes(title))
  );
}

async function closeVisibleMessageBox(title) {
  const box = visibleMessageBox(title);
  const cancelButton = findButtonByText("取消", box);
  const closeButton = box?.querySelector(".el-message-box__headerbtn");
  if (!box || (!cancelButton && !closeButton)) return false;

  (cancelButton || closeButton).click();
  return !!(await waitFor(() => !isVisible(box), 3000));
}

async function waitForNoLoading(timeoutMs = 5000) {
  return waitFor(
    () =>
      ![
        ...document.querySelectorAll(".sensitive-words-page .el-loading-mask")
      ].some(isVisible),
    timeoutMs
  );
}

function mobileCards() {
  return [...document.querySelectorAll(".mobile-word-card")];
}

function allVisibleCardsInclude(label) {
  const cards = mobileCards();
  return (
    cards.length > 0 && cards.every(card => card.innerText.includes(label))
  );
}

await wait(1800);

const container = document.querySelector(".sensitive-words-page");
const initialText = appText();
const initialOverflow = horizontalOverflow();
const searchButton = findButtonByText("搜索");
const resetButton = findButtonByText("重置");
const addButton = findButtonByText("添加敏感词");
const importButton = findButtonByText("批量导入");
const exportButton = findButtonByText("导出");
const batchDeleteButton = findButtonByText("批量删除");
const syncButton = findButtonByText("同步数据");

if (!container) {
  return {
    ok: false,
    reason: "sensitive words container did not render",
    initialOverflow,
    text: initialText.slice(0, 1200)
  };
}

const isMobileLayout = container.classList.contains(
  "sensitive-words-page--mobile"
);
await waitForNoLoading();
await waitFor(
  () =>
    document.querySelector(".mobile-word-list") &&
    (document.querySelector(".mobile-word-card") ||
      appText().includes("暂无敏感词记录")),
  10000
);

const levelSelect = await chooseSelectOptionByLabel("级别", "高风险");
if (searchButton) {
  clickNode(searchButton);
}
await waitForNoLoading();
await wait(300);
await waitFor(
  () =>
    appText().includes("已启用") ||
    appText().includes("暂无敏感词记录") ||
    allVisibleCardsInclude("高风险"),
  8000
);
const highText = appText();
const highCardCount = mobileCards().length;
const highFilterValid =
  (highCardCount === 0 && highText.includes("暂无敏感词记录")) ||
  allVisibleCardsInclude("高风险");

if (resetButton) {
  clickNode(resetButton);
}
await waitForNoLoading();
await waitFor(
  () =>
    document.querySelector(".mobile-word-card") ||
    appText().includes("暂无敏感词记录"),
  8000
);

const afterResetText = appText();
const mobileList = document.querySelector(".mobile-word-list");
const cardCount = mobileCards().length;
const emptyState = !!(
  document.querySelector(".mobile-word-list .el-empty") ||
  afterResetText.includes("暂无敏感词记录")
);
const desktopTable = document.querySelector(".el-table");
const desktopTableDisplay = desktopTable
  ? window.getComputedStyle(desktopTable).display
  : "missing";
const mobileListDisplay = mobileList
  ? window.getComputedStyle(mobileList).display
  : "missing";

const firstCard = document.querySelector(".mobile-word-card");
const firstCardText = firstCard?.innerText.replace(/\s+/g, " ") || "";
const selectCheckbox = firstCard?.querySelector(
  ".mobile-word-card__checkbox, .el-checkbox"
);
const editButton = firstCard ? findButtonByText("编辑", firstCard) : null;
const deleteButton = firstCard ? findButtonByText("删除", firstCard) : null;
const cardSwitch = firstCard?.querySelector(".el-switch");
const firstCardActions = firstCard?.querySelector(".mobile-word-card__actions");

let selectionWorked = true;
let batchDeleteEnabled = true;
let batchDeletePromptOpened = true;
let batchDeletePromptClosed = true;
if (firstCard) {
  selectionWorked = false;
  batchDeleteEnabled = false;
  batchDeletePromptOpened = false;
  batchDeletePromptClosed = false;
  if (selectCheckbox) {
    await scrollClearOfChrome(selectCheckbox);
    clickNode(selectCheckbox, false);
    selectionWorked = !!(await waitFor(
      () => appText().includes("已选择 1 个"),
      3000
    ));
    batchDeleteEnabled = !batchDeleteButton?.disabled;
    if (batchDeleteButton) {
      await scrollClearOfChrome(batchDeleteButton);
      clickNode(batchDeleteButton, false);
      const box = await waitFor(() => visibleMessageBox("提示"), 5000);
      batchDeletePromptOpened = !!box;
      batchDeletePromptClosed = batchDeletePromptOpened
        ? await closeVisibleMessageBox("提示")
        : false;
    }
    await scrollClearOfChrome(selectCheckbox);
    clickNode(selectCheckbox, false);
    await wait(250);
  }
}

let addDialogOpened = false;
let addDialogClosed = false;
let addDialogText = "";
let addFooterClearance = 999;
if (addButton) {
  await scrollClearOfChrome(addButton);
  clickNode(addButton, false);
  const dialog = await waitFor(() => visibleDialog("添加敏感词"), 5000);
  addDialogOpened = !!dialog;
  addDialogText = dialog?.innerText.replace(/\s+/g, " ").slice(0, 700) || "";
  const footer = dialog?.querySelector(".el-dialog__footer");
  const footerRect = footer?.getBoundingClientRect();
  addFooterClearance = footerRect
    ? Math.round(bottomChromeTop() - footerRect.bottom)
    : 999;
  addDialogClosed = addDialogOpened
    ? await closeVisibleDialog("添加敏感词")
    : false;
  await wait(300);
}

let importDialogOpened = false;
let importDialogClosed = false;
let importDialogText = "";
let importFooterClearance = 999;
if (importButton) {
  await scrollClearOfChrome(importButton);
  clickNode(importButton, false);
  const dialog = await waitFor(() => visibleDialog("批量导入敏感词"), 5000);
  importDialogOpened = !!dialog;
  importDialogText = dialog?.innerText.replace(/\s+/g, " ").slice(0, 700) || "";
  const footer = dialog?.querySelector(".el-dialog__footer");
  const footerRect = footer?.getBoundingClientRect();
  importFooterClearance = footerRect
    ? Math.round(bottomChromeTop() - footerRect.bottom)
    : 999;
  importDialogClosed = importDialogOpened
    ? await closeVisibleDialog("批量导入敏感词")
    : false;
  await wait(300);
}

let editDialogOpened = true;
let editDialogClosed = true;
let editDialogText = "";
let editFooterClearance = 999;
if (editButton) {
  await scrollClearOfChrome(editButton);
  clickNode(editButton, false);
  const dialog = await waitFor(() => visibleDialog("编辑敏感词"), 5000);
  editDialogOpened = !!dialog;
  editDialogText = dialog?.innerText.replace(/\s+/g, " ").slice(0, 700) || "";
  const footer = dialog?.querySelector(".el-dialog__footer");
  const footerRect = footer?.getBoundingClientRect();
  editFooterClearance = footerRect
    ? Math.round(bottomChromeTop() - footerRect.bottom)
    : 999;
  editDialogClosed = editDialogOpened
    ? await closeVisibleDialog("编辑敏感词")
    : false;
  await wait(300);
}

let deletePromptOpened = true;
let deletePromptClosed = true;
if (deleteButton) {
  await scrollClearOfChrome(deleteButton);
  clickNode(deleteButton, false);
  const box = await waitFor(() => visibleMessageBox("提示"), 5000);
  deletePromptOpened = !!box;
  deletePromptClosed = deletePromptOpened
    ? await closeVisibleMessageBox("提示")
    : false;
  await wait(300);
}

if (firstCardActions) {
  await scrollClearOfChrome(firstCardActions);
}

const actionRect = firstCardActions?.getBoundingClientRect();
const actionTopClearance = actionRect
  ? Math.round(actionRect.top - topChromeBottom())
  : 999;
const actionBottomClearance = actionRect
  ? Math.round(bottomChromeTop() - actionRect.bottom)
  : 999;
const firstCardActionsVisible = firstCardActions
  ? isVisible(firstCardActions)
  : true;

const finalOverflow = horizontalOverflow();
const finalText = appText();

return {
  ok:
    isMobileLayout &&
    initialText.includes("总敏感词") &&
    initialText.includes("筛选条件") &&
    initialText.includes("敏感词管理") &&
    !!searchButton &&
    !!resetButton &&
    !!addButton &&
    !!importButton &&
    !!exportButton &&
    !!batchDeleteButton &&
    !!syncButton &&
    levelSelect.selected &&
    highFilterValid &&
    mobileListDisplay !== "missing" &&
    (desktopTableDisplay === "none" || desktopTableDisplay === "missing") &&
    (cardCount > 0 || emptyState) &&
    (!firstCard ||
      (!!selectCheckbox &&
        !!editButton &&
        !!deleteButton &&
        !!cardSwitch &&
        firstCardText.includes("启用状态"))) &&
    selectionWorked &&
    batchDeleteEnabled &&
    batchDeletePromptOpened &&
    batchDeletePromptClosed &&
    addDialogOpened &&
    addDialogClosed &&
    addDialogText.includes("风险级别") &&
    importDialogOpened &&
    importDialogClosed &&
    importDialogText.includes("每行一个敏感词") &&
    editDialogOpened &&
    editDialogClosed &&
    editDialogText.includes("启用状态") &&
    deletePromptOpened &&
    deletePromptClosed &&
    firstCardActionsVisible &&
    actionTopClearance >= 0 &&
    actionBottomClearance >= 0 &&
    addFooterClearance >= 0 &&
    importFooterClearance >= 0 &&
    editFooterClearance >= 0 &&
    finalOverflow <= 4,
  isMobileLayout,
  levelSelect: {
    opened: levelSelect.opened,
    optionCount: levelSelect.optionCount,
    selectedText: levelSelect.selectedText,
    interactable: levelSelect.interactable
  },
  hasSearchButton: !!searchButton,
  hasResetButton: !!resetButton,
  hasAddButton: !!addButton,
  hasImportButton: !!importButton,
  hasExportButton: !!exportButton,
  hasBatchDeleteButton: !!batchDeleteButton,
  hasSyncButton: !!syncButton,
  highCardCount,
  highFilterValid,
  cardCount,
  emptyState,
  firstCardText,
  hasSelectCheckbox: !!selectCheckbox,
  hasEditButton: !!editButton,
  hasDeleteButton: !!deleteButton,
  hasSwitch: !!cardSwitch,
  selectionWorked,
  batchDeleteEnabled,
  batchDeletePromptOpened,
  batchDeletePromptClosed,
  addDialogOpened,
  addDialogClosed,
  addDialogText,
  addFooterClearance,
  importDialogOpened,
  importDialogClosed,
  importDialogText,
  importFooterClearance,
  editDialogOpened,
  editDialogClosed,
  editDialogText,
  editFooterClearance,
  deletePromptOpened,
  deletePromptClosed,
  firstCardActionsVisible,
  actionTopClearance,
  actionBottomClearance,
  mobileListDisplay,
  desktopTableDisplay,
  initialOverflow,
  finalOverflow,
  text: finalText.slice(0, 1800)
};
