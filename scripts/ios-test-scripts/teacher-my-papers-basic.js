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
      target.closest?.(".el-select") === node ||
      target.closest?.(".el-input") === node ||
      target.closest?.(".el-dropdown") === node ||
      target.closest?.(".folder-item") === node ||
      target.closest?.(".paper-mobile-card") === node)
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
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
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

async function waitForNoLoading(timeoutMs = 9000) {
  return waitFor(
    () =>
      ![...document.querySelectorAll(".my-papers-page .el-loading-mask")].some(
        isVisible
      ),
    timeoutMs
  );
}

function visiblePopup() {
  return [...document.querySelectorAll(".el-select-dropdown, .el-popper")].find(
    node => isVisible(node) && node.innerText?.trim()
  );
}

function visibleOptions(popup = visiblePopup()) {
  return popup
    ? [...popup.querySelectorAll(".el-select-dropdown__item")].filter(
        node => isVisible(node) && !node.classList.contains("is-disabled")
      )
    : [];
}

async function closePopups() {
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
  await waitFor(() => !visiblePopup(), 1200);
}

function selectTriggerByPlaceholder(placeholder) {
  const input = [...document.querySelectorAll("input")].find(
    node => node.placeholder === placeholder
  );
  if (input) {
    return (
      input.closest(".el-select")?.querySelector(".el-select__wrapper") ||
      input.closest(".el-select")
    );
  }

  return [...document.querySelectorAll(".toolbar-left .el-select")].find(node =>
    node.textContent?.replace(/\s+/g, "").includes(placeholder)
  );
}

async function openSelectPopup(trigger) {
  const targets = [
    trigger.querySelector?.(".el-select__wrapper"),
    trigger.querySelector?.(".el-input__wrapper"),
    trigger.querySelector?.(".el-select__caret"),
    trigger
  ].filter(Boolean);

  for (const target of targets) {
    clickNode(target, false);
    const popup = await waitFor(visiblePopup, 1000);
    if (popup) return popup;
  }

  return null;
}

async function chooseSelectOption(placeholder, optionText) {
  await closePopups();
  const trigger = selectTriggerByPlaceholder(placeholder);

  if (!trigger) {
    return {
      exists: false,
      opened: false,
      selected: false,
      optionCount: 0,
      interactable: false,
      optionInteractable: false,
      rect: null
    };
  }

  await scrollClearOfChrome(trigger);
  const interactable = isInteractable(trigger);
  const popup = await openSelectPopup(trigger);
  const options = visibleOptions(popup);
  const normalizedOption = optionText.replace(/\s+/g, "");
  const option =
    options.find(node =>
      node.textContent?.replace(/\s+/g, "").includes(normalizedOption)
    ) || options[0];
  const optionInteractable = option ? isInteractable(option) : false;
  const selectedText = option?.textContent?.replace(/\s+/g, " ").trim() || "";

  if (option) {
    clickNode(option, false);
    await wait(650);
  }

  await closePopups();

  return {
    exists: true,
    opened: !!popup,
    selected: !!option,
    selectedText,
    optionCount: options.length,
    interactable,
    optionInteractable,
    rect: rectOf(trigger),
    popupText: popup?.innerText.replace(/\s+/g, " ").slice(0, 500) || ""
  };
}

async function openDialogByButton(label) {
  const button = findButtonByText(label);
  let buttonInteractable = false;
  if (button) {
    await scrollClearOfChrome(button);
    buttonInteractable = isInteractable(button);
    clickNode(button, false);
  }
  const dialog = await waitFor(
    () =>
      [...document.querySelectorAll(".el-dialog")].find(
        node => isVisible(node) && compactText(node).includes(label)
      ),
    5000
  );
  const close =
    dialog?.querySelector(".el-dialog__headerbtn") ||
    findVisibleButtonByText("取消", dialog);
  if (close) {
    clickNode(close, false);
    await wait(400);
  }

  return {
    buttonExists: !!button,
    buttonInteractable,
    opened: !!dialog,
    dialogText: dialog?.innerText.replace(/\s+/g, " ").slice(0, 400) || "",
    rect: rectOf(dialog)
  };
}

async function openMoreMoveDialog() {
  const firstCard = document.querySelector(".paper-mobile-card");
  const moreButton = firstCard ? findButtonByText("更多", firstCard) : null;

  if (!moreButton) {
    return {
      moreButtonExists: false,
      moreButtonInteractable: false,
      menuOpened: false,
      moveClicked: false,
      dialogOpened: false,
      dialogText: ""
    };
  }

  await scrollClearOfChrome(moreButton);
  const moreButtonInteractable = isInteractable(moreButton);
  clickNode(moreButton, false);

  const popup = await waitFor(visiblePopup, 5000);
  const moveItem = popup
    ? [...popup.querySelectorAll(".el-dropdown-menu__item")].find(item =>
        item.textContent?.replace(/\s+/g, "").includes("移动")
      )
    : null;
  const moveClicked = !!moveItem;
  if (moveItem) {
    clickNode(moveItem, false);
    await wait(500);
  }

  const dialog = await waitFor(
    () =>
      [...document.querySelectorAll(".el-dialog")].find(
        node => isVisible(node) && compactText(node).includes("移动到文件夹")
      ),
    5000
  );

  if (dialog) {
    const targetSelect = dialog.querySelector(".el-select__wrapper");
    if (targetSelect) {
      clickNode(targetSelect, false);
      await wait(350);
      const options = visibleOptions();
      if (options[0]) {
        clickNode(options[0], false);
        await wait(300);
      }
    }

    const cancel = findVisibleButtonByText("取消", dialog);
    if (cancel) {
      clickNode(cancel, false);
      await wait(350);
    }
  }

  return {
    moreButtonExists: true,
    moreButtonInteractable,
    menuOpened: !!popup,
    moveClicked,
    dialogOpened: !!dialog,
    dialogText: dialog?.innerText.replace(/\s+/g, " ").slice(0, 500) || ""
  };
}

await wait(1800);

const page = await waitFor(() => document.querySelector(".my-papers-page"));
const initialText = compactText();
const initialOverflow = horizontalOverflow();

if (!page) {
  return {
    ok: false,
    reason: "my papers page did not render",
    href: location.href,
    text: initialText.slice(0, 1200),
    initialOverflow
  };
}

await waitForNoLoading();
await waitFor(
  () =>
    document.querySelectorAll(".stat-card").length >= 4 &&
    compactText().includes("我的试卷"),
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
  "我的试卷",
  "管理您创建的所有试卷",
  "试卷总数",
  "已发布",
  "草稿箱",
  "最近编辑",
  "文件夹",
  "全部试卷",
  "新建文件夹",
  "新建试卷",
  "试卷状态",
  "所属课程",
  "刷新",
  "编辑",
  "发布",
  "更多"
];

const statCards = [...document.querySelectorAll(".stat-card")];
const folderItems = [...document.querySelectorAll(".folder-item")];
const mobileCards = [...document.querySelectorAll(".paper-mobile-card")];
const desktopTableVisible = [...document.querySelectorAll(".paper-table")].some(
  isVisible
);
const createPaperButton = findButtonByText("新建试卷");
if (createPaperButton) {
  await scrollClearOfChrome(createPaperButton);
}
const createPaperButtonInteractable = createPaperButton
  ? isInteractable(createPaperButton)
  : false;

const firstFolder = folderItems[1] || folderItems[0] || null;
if (firstFolder) {
  await scrollClearOfChrome(firstFolder);
}
const firstFolderInteractable = firstFolder
  ? isInteractable(firstFolder)
  : false;
if (firstFolder) {
  clickNode(firstFolder, false);
  await waitForNoLoading();
  await wait(350);
}
const selectedFolderText =
  document
    .querySelector(".folder-item.active")
    ?.innerText.replace(/\s+/g, " ")
    .trim() || "";

const searchInput = [...document.querySelectorAll("input")].find(input =>
  input.placeholder?.includes("搜索试卷标题")
);
let searchVisible = false;
let searchFilteredText = "";
if (searchInput) {
  await scrollClearOfChrome(searchInput);
  searchVisible = isVisible(searchInput);
  setInputValue(searchInput, "Linux");
  searchInput.dispatchEvent(
    new KeyboardEvent("keyup", {
      key: "Enter",
      code: "Enter",
      bubbles: true
    })
  );
  await waitForNoLoading();
  await wait(700);
  searchFilteredText = compactText();
  setInputValue(searchInput, "");
}

const statusSelection = await chooseSelectOption("试卷状态", "已发布");
const courseSelection = await chooseSelectOption("所属课程", "嵌入式 Linux");
const folderDialog = await openDialogByButton("新建文件夹");
const moveDialog = await openMoreMoveDialog();

const bottomTarget =
  document.querySelector(".pagination-wrapper") ||
  mobileCards[mobileCards.length - 1] ||
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
const textCorpus = `${initialText} ${searchFilteredText} ${finalText}`;
const finalOverflow = horizontalOverflow();

return {
  ok:
    isMobileViewport &&
    requiredText.every(label => textCorpus.includes(label)) &&
    statCards.length >= 4 &&
    folderItems.length >= 2 &&
    mobileCards.length >= 1 &&
    !desktopTableVisible &&
    !!createPaperButton &&
    createPaperButtonInteractable &&
    firstFolderInteractable &&
    searchVisible &&
    searchFilteredText.includes("Linux") &&
    statusSelection.selected &&
    statusSelection.optionInteractable &&
    courseSelection.selected &&
    courseSelection.optionInteractable &&
    folderDialog.opened &&
    moveDialog.menuOpened &&
    moveDialog.dialogOpened &&
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
  statCardCount: statCards.length,
  folderItemCount: folderItems.length,
  selectedFolderText,
  mobileCardCount: mobileCards.length,
  desktopTableVisible,
  createPaperButton: {
    exists: !!createPaperButton,
    interactable: createPaperButtonInteractable,
    rect: rectOf(createPaperButton)
  },
  firstFolder: {
    exists: !!firstFolder,
    interactable: firstFolderInteractable,
    rect: rectOf(firstFolder),
    text: firstFolder?.innerText.replace(/\s+/g, " ").slice(0, 200) || ""
  },
  search: {
    exists: !!searchInput,
    visible: searchVisible,
    filteredText: searchFilteredText.slice(0, 500)
  },
  statusSelection,
  courseSelection,
  folderDialog,
  moveDialog,
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
