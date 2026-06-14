function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(predicate, timeoutMs = 8000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = predicate();
    if (value) return value;
    await wait(180);
  }
  return null;
}

function compactText(node = document.body) {
  return (node?.innerText || "").replace(/\s+/g, " ").trim();
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
    rect.width > 8 &&
    rect.height > 8 &&
    centerX >= -1 &&
    centerY >= -1 &&
    centerX <= viewportWidth + 1 &&
    centerY <= viewportHeight + 1 &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0"
  );
}

function isRendered(node) {
  if (!node) return false;

  const rect = node.getBoundingClientRect();
  const style = window.getComputedStyle(node);

  return (
    rect.width > 8 &&
    rect.height > 8 &&
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
      target.closest?.(".template-card") === node ||
      target.closest?.(".el-tabs__item") === node ||
      target.closest?.(".el-dialog") === node)
  );
}

function findButtonByText(label, root = document) {
  const normalizedLabel = label.replace(/\s+/g, "");
  return [...root.querySelectorAll("button")].find(button =>
    button.textContent?.replace(/\s+/g, "").includes(normalizedLabel)
  );
}

function findVisibleButtonByText(label, root = document) {
  const normalizedLabel = label.replace(/\s+/g, "");
  return [...root.querySelectorAll("button")].find(
    button =>
      isVisible(button) &&
      button.textContent?.replace(/\s+/g, "").includes(normalizedLabel)
  );
}

function findTabByText(label) {
  const normalizedLabel = label.replace(/\s+/g, "");
  return [...document.querySelectorAll(".el-tabs__item")].find(tab =>
    tab.textContent?.replace(/\s+/g, "").includes(normalizedLabel)
  );
}

function clickNode(node, shouldScroll = true) {
  if (!node) return false;

  if (shouldScroll) {
    node.scrollIntoView({ block: "center", inline: "nearest" });
  }

  const rect = node.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;

  if (typeof PointerEvent !== "undefined") {
    node.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerType: "touch",
        clientX,
        clientY
      })
    );
    node.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerType: "touch",
        clientX,
        clientY
      })
    );
  }
  node.dispatchEvent(
    new MouseEvent("mousedown", { bubbles: true, clientX, clientY })
  );
  node.dispatchEvent(
    new MouseEvent("mouseup", { bubbles: true, clientX, clientY })
  );
  node.click();
  return true;
}

function setInputValue(input, value) {
  if (!input) return false;

  input.focus();
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function visibleTemplateCards() {
  return [...document.querySelectorAll(".template-card")].filter(isVisible);
}

function renderedTemplateCards() {
  return [...document.querySelectorAll(".template-card")].filter(isRendered);
}

function scrollHost() {
  const candidates = [
    document.getElementById("app"),
    document.querySelector(".app-wrapper"),
    document.querySelector(".mobile-main-container"),
    document.querySelector(".main-container"),
    document.querySelector(".app-main"),
    document.querySelector(".app-main-nofixed-header"),
    document.querySelector(".app-main > .el-scrollbar > .el-scrollbar__wrap"),
    document.querySelector(
      ".main-container > .el-scrollbar > .el-scrollbar__wrap"
    ),
    document.scrollingElement,
    document.documentElement
  ].filter(Boolean);

  return (
    candidates
      .filter(node => node.scrollHeight > node.clientHeight + 12)
      .sort(
        (left, right) =>
          right.scrollHeight -
          right.clientHeight -
          (left.scrollHeight - left.clientHeight)
      )[0] ||
    document.scrollingElement ||
    document.documentElement
  );
}

function setScrollTop(node, top) {
  if (!node) return;

  node.scrollTop = Math.max(0, top);
  node.dispatchEvent(new Event("scroll", { bubbles: true }));
  if (node === document.scrollingElement || node === document.documentElement) {
    window.scrollTo({ left: 0, top: Math.max(0, top) });
  }
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
  await wait(220);

  for (let attempt = 0; attempt < 5; attempt++) {
    const host = scrollHost();
    const rect = node.getBoundingClientRect();
    const desiredTop = topChromeBottom() + 24;
    const desiredBottom = bottomChromeTop() - 24;

    if (rect.top >= desiredTop && rect.bottom <= desiredBottom) {
      return true;
    }

    if (rect.top < desiredTop) {
      setScrollTop(host, host.scrollTop + rect.top - desiredTop);
    } else if (rect.bottom > desiredBottom) {
      setScrollTop(host, host.scrollTop + rect.bottom - desiredBottom);
    }

    await wait(220);
  }

  return isVisible(node);
}

function visibleDialog() {
  return [...document.querySelectorAll(".el-dialog")].find(isVisible);
}

async function closeDialog(dialog = visibleDialog()) {
  const close =
    dialog?.querySelector(".el-dialog__headerbtn") ||
    findVisibleButtonByText("关闭", dialog) ||
    findVisibleButtonByText("取消", dialog);
  if (close) {
    clickNode(close, false);
    await wait(400);
  }
}

async function openPreviewFromFirstSystemCard() {
  const firstCard = document.querySelector(".template-card");
  const previewButton = firstCard ? findButtonByText("预览", firstCard) : null;

  if (!previewButton) {
    return {
      buttonExists: false,
      buttonInteractable: false,
      opened: false,
      dialogText: ""
    };
  }

  await scrollClearOfChrome(previewButton);
  const buttonInteractable = isInteractable(previewButton);
  clickNode(previewButton, false);
  const dialog = await waitFor(
    () =>
      [...document.querySelectorAll(".el-dialog")].find(
        node => isVisible(node) && compactText(node).includes("标准考试模板")
      ),
    5000
  );
  const dialogText = dialog?.innerText.replace(/\s+/g, " ").slice(0, 600) || "";
  const useButton = dialog
    ? findVisibleButtonByText("使用此模板", dialog)
    : null;
  if (useButton) {
    useButton.scrollIntoView({ block: "center", inline: "nearest" });
    await wait(180);
  }
  const useButtonInteractable = useButton ? isInteractable(useButton) : false;
  const useButtonVisible = useButton ? isVisible(useButton) : false;
  await closeDialog(dialog);

  return {
    buttonExists: true,
    buttonInteractable,
    opened: !!dialog,
    dialogText,
    useButtonVisible,
    useButtonInteractable
  };
}

async function openCreateTemplateDialog() {
  const button = findButtonByText("新建模板");
  let buttonInteractable = false;
  if (button) {
    await scrollClearOfChrome(button);
    buttonInteractable = isInteractable(button);
    clickNode(button, false);
  }

  const dialog = await waitFor(
    () =>
      [...document.querySelectorAll(".el-dialog")].find(
        node => isVisible(node) && compactText(node).includes("新建私有模板")
      ),
    5000
  );
  const nameInput = dialog
    ? [...dialog.querySelectorAll("input")].find(
        input =>
          input.placeholder?.includes("模板名称") ||
          input.getAttribute("aria-label")?.includes("模板名称") ||
          input.closest?.(".el-form-item")?.textContent?.includes("模板名称")
      )
    : null;
  const nameInputVisible = nameInput ? isVisible(nameInput) : false;
  setInputValue(nameInput, "iOS 模板验收");
  await wait(300);
  const createButton = dialog
    ? findVisibleButtonByText("创建并编辑", dialog)
    : null;
  const createButtonInteractable = createButton
    ? isInteractable(createButton)
    : false;
  await closeDialog(dialog);

  return {
    buttonExists: !!button,
    buttonInteractable,
    opened: !!dialog,
    nameInputVisible,
    createButtonInteractable,
    dialogText: dialog?.innerText.replace(/\s+/g, " ").slice(0, 500) || ""
  };
}

async function switchToMyTemplates() {
  const tab = findTabByText("我的模板");
  if (tab) {
    await scrollClearOfChrome(tab);
    clickNode(tab, false);
    await wait(600);
  }
  return {
    exists: !!tab,
    interactable: tab ? isInteractable(tab) : false,
    text: compactText().slice(0, 900),
    privateCardCount: renderedTemplateCards().length,
    emptyVisible: compactText().includes("暂无私有模板")
  };
}

await wait(1800);

const page = await waitFor(() => document.querySelector(".templates-page"));
const initialText = compactText();
const initialOverflow = horizontalOverflow();

if (!page) {
  return {
    ok: false,
    reason: "templates page did not render",
    href: location.href,
    text: initialText.slice(0, 1200),
    initialOverflow
  };
}

await waitFor(
  () =>
    document.querySelectorAll(".template-card").length >= 4 &&
    compactText().includes("试卷模板"),
  10000
);

const viewportWidth = Math.round(
  window.visualViewport?.width || window.innerWidth
);
const viewportHeight = Math.round(
  window.visualViewport?.height || window.innerHeight
);
const isMobileViewport = viewportWidth <= 768;
const requiredText = [
  "试卷模板",
  "选择一个模板快速开始创建试卷",
  "新建模板",
  "系统模板",
  "我的模板",
  "标准考试模板",
  "快速测验模板",
  "综合能力测试",
  "学情调查问卷",
  "使用模板",
  "预览"
];

const systemCards = renderedTemplateCards();
const firstUseButton = findButtonByText("使用模板", systemCards[0]);
if (firstUseButton) {
  await scrollClearOfChrome(firstUseButton);
}
const firstUseButtonInteractable = firstUseButton
  ? isInteractable(firstUseButton)
  : false;
const previewResult = await openPreviewFromFirstSystemCard();
const createDialog = await openCreateTemplateDialog();
const myTab = await switchToMyTemplates();

const bottomTarget =
  visibleTemplateCards().at(-1) ||
  findVisibleButtonByText("创建第一个模板") ||
  document.querySelector(".empty-state") ||
  page;
if (bottomTarget) {
  await scrollClearOfChrome(bottomTarget);
}
const bottomRect = bottomTarget?.getBoundingClientRect();
const bottomClearance = bottomRect
  ? Math.round(bottomChromeTop() - bottomRect.bottom)
  : 999;
const bottomVisible = bottomTarget ? isVisible(bottomTarget) : false;
const finalText = compactText();
const textCorpus = `${initialText} ${previewResult.dialogText} ${createDialog.dialogText} ${myTab.text} ${finalText}`;
const finalOverflow = horizontalOverflow();

return {
  ok:
    isMobileViewport &&
    requiredText.every(label => textCorpus.includes(label)) &&
    systemCards.length >= 4 &&
    !!firstUseButton &&
    firstUseButtonInteractable &&
    previewResult.opened &&
    previewResult.useButtonVisible &&
    createDialog.opened &&
    createDialog.nameInputVisible &&
    createDialog.createButtonInteractable &&
    myTab.exists &&
    myTab.interactable &&
    (myTab.privateCardCount >= 1 || myTab.emptyVisible) &&
    bottomVisible &&
    bottomClearance >= 0 &&
    finalOverflow <= 4,
  href: location.href,
  viewport: {
    width: viewportWidth,
    height: viewportHeight
  },
  isMobileViewport,
  requiredTextPresent: requiredText.filter(label => textCorpus.includes(label)),
  systemCardCount: systemCards.length,
  firstUseButton: {
    exists: !!firstUseButton,
    interactable: firstUseButtonInteractable,
    rect: rectOf(firstUseButton)
  },
  previewResult,
  createDialog,
  myTab,
  bottomTarget: {
    exists: !!bottomTarget,
    rect: rectOf(bottomTarget),
    visible: bottomVisible,
    clearance: bottomClearance
  },
  scrollHost: {
    scrollTop: Math.round(scrollHost().scrollTop || 0),
    scrollHeight: Math.round(scrollHost().scrollHeight || 0),
    clientHeight: Math.round(scrollHost().clientHeight || 0)
  },
  initialOverflow,
  finalOverflow,
  text: finalText.slice(0, 1800)
};
