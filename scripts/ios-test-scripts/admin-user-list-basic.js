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
      target.closest?.("button") === node ||
      target.closest?.(".el-button") === node)
  );
}

function findButtonByText(label, root = document) {
  return [...root.querySelectorAll("button")].find(button =>
    button.textContent?.replace(/\s+/g, "").includes(label)
  );
}

function visibleDialog() {
  return [...document.querySelectorAll(".el-dialog")].find(isVisible);
}

const initialText = appText();
const userList = document.querySelector(".mobile-user-list");
if (!userList) {
  return { ok: false, reason: "missing mobile user list", initialText };
}

const searchButton = findButtonByText("搜索");
if (!searchButton) {
  return { ok: false, reason: "missing search button", initialText };
}

searchButton.scrollIntoView({ block: "center", inline: "nearest" });
await wait(250);
const searchInteractable = isInteractable(searchButton);
if (!searchInteractable) {
  return { ok: false, reason: "search button is not interactable" };
}

searchButton.dispatchEvent(
  new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
);
await wait(1200);

const cards = [...document.querySelectorAll(".mobile-user-card")];
const firstCard = cards[0];
if (!firstCard) {
  return {
    ok: false,
    reason: "missing mobile user card after search",
    cardCount: cards.length,
    pageText: appText().slice(0, 800)
  };
}

firstCard.scrollIntoView({ block: "center", inline: "nearest" });
await wait(350);

const firstCardText = firstCard.innerText.replace(/\s+/g, " ");
const editButton = findButtonByText("修改角色", firstCard);
const cardHasRequiredFields =
  /ID:\s*\d+/.test(firstCardText) &&
  firstCardText.includes("Mobile") &&
  firstCardText.includes("Sex") &&
  firstCardText.includes("Info") &&
  /学生|教师|管理员/.test(firstCardText);

if (!editButton) {
  return {
    ok: false,
    reason: "missing edit role button",
    cardCount: cards.length,
    firstCardText
  };
}

const editInteractable = isInteractable(editButton);
if (!editInteractable) {
  return {
    ok: false,
    reason: "edit role button is not interactable",
    cardCount: cards.length,
    firstCardText
  };
}

editButton.dispatchEvent(
  new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
);
await wait(800);

const dialog = visibleDialog();
const dialogText = dialog?.innerText.replace(/\s+/g, " ") || "";
const roleSelect = dialog?.querySelector(".el-select");
const cancelButton = dialog ? findButtonByText("取消", dialog) : null;
const confirmButton = dialog ? findButtonByText("确认", dialog) : null;

if (!dialog || !cancelButton || !confirmButton || !roleSelect) {
  return {
    ok: false,
    reason: "role dialog did not open correctly",
    dialogText,
    hasDialog: !!dialog,
    hasCancelButton: !!cancelButton,
    hasConfirmButton: !!confirmButton,
    hasRoleSelect: !!roleSelect,
    pageText: appText().slice(0, 800)
  };
}

cancelButton.dispatchEvent(
  new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
);
await wait(500);

const dialogClosed = !visibleDialog();
const pagination = document.querySelector(".pagination-container");
if (pagination) {
  pagination.scrollIntoView({ block: "center", inline: "nearest" });
  await wait(350);
}

const paginationText = pagination?.innerText.replace(/\s+/g, " ") || "";
const currentText = appText();

firstCard.scrollIntoView({ block: "center", inline: "nearest" });
await wait(350);

return {
  ok:
    currentText.includes("用户列表") &&
    cards.length >= 3 &&
    cardHasRequiredFields &&
    searchInteractable &&
    editInteractable &&
    dialogText.includes("修改用户角色") &&
    dialogText.includes("当前用户") &&
    dialogText.includes("当前角色") &&
    dialogText.includes("新角色") &&
    dialogClosed &&
    !!pagination &&
    /条\/页|条每页|page/i.test(paginationText),
  cardCount: cards.length,
  firstCardText: firstCardText.slice(0, 500),
  searchInteractable,
  editInteractable,
  dialogText: dialogText.slice(0, 500),
  dialogClosed,
  hasRoleSelect: !!roleSelect,
  paginationText,
  pageText: currentText.slice(0, 900)
};
