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

function findButtonByText(label, root = document) {
  return [...root.querySelectorAll("button")].find(button =>
    button.textContent?.replace(/\s+/g, "").includes(label)
  );
}

async function waitFor(predicate, timeoutMs = 6000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = predicate();
    if (value) return value;
    await wait(200);
  }
  return null;
}

await wait(500);

const beforeText = appText();
const cards = [...document.querySelectorAll(".grading-mobile-card")];
const firstCard = cards[0];
const searchButton = findButtonByText("搜索");
const resetButton = findButtonByText("重置");
const gradeButton = firstCard ? findButtonByText("阅卷", firstCard) : null;
const autoGradeButton = firstCard
  ? findButtonByText("自动批改", firstCard)
  : null;
const detailButton = firstCard ? findButtonByText("详情", firstCard) : null;

if (!beforeText.includes("阅卷管理") || !firstCard) {
  return {
    ok: false,
    reason: "grading list did not render",
    href: location.href,
    beforeText: beforeText.slice(0, 1000),
    cardCount: cards.length
  };
}

const searchButtonInteractable = isInteractable(searchButton);
const resetButtonInteractable = isInteractable(resetButton);

firstCard.scrollIntoView({ block: "center", inline: "nearest" });
await wait(300);

if (!gradeButton || !isInteractable(gradeButton)) {
  return {
    ok: false,
    reason: "grade button is missing or not interactable",
    href: location.href,
    cardText: firstCard.innerText.replace(/\s+/g, " ").slice(0, 900),
    hasGradeButton: !!gradeButton,
    gradeButtonVisible: isVisible(gradeButton),
    hasAutoGradeButton: !!autoGradeButton,
    hasDetailButton: !!detailButton
  };
}

gradeButton.dispatchEvent(
  new MouseEvent("click", { bubbles: true, cancelable: true })
);

const routed = await waitFor(
  () =>
    location.hash.includes("/exam-paper/grading/") &&
    !location.hash.includes("/detail") &&
    appText().includes("学生列表") &&
    appText().includes("评分汇总"),
  8000
);

const afterText = appText();
const horizontalOverflow = Math.max(
  0,
  Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
    (window.visualViewport?.width || window.innerWidth)
);

return {
  ok:
    !!routed &&
    cards.length > 0 &&
    !!searchButton &&
    !!resetButton &&
    searchButtonInteractable &&
    resetButtonInteractable &&
    !!autoGradeButton &&
    !!detailButton &&
    horizontalOverflow <= 4,
  href: location.href,
  cardCount: cards.length,
  searchButtonInteractable,
  resetButtonInteractable,
  hasAutoGradeButton: !!autoGradeButton,
  hasDetailButton: !!detailButton,
  horizontalOverflow,
  beforeText: beforeText.slice(0, 1200),
  afterText: afterText.slice(0, 1400)
};
