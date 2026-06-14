function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(predicate, timeoutMs = 7000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = predicate();
    if (value) return value;
    await wait(160);
  }
  return null;
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

function compactText(node = document.body) {
  return (node.innerText || "").replace(/\s+/g, " ").trim();
}

async function expandSidebarIfCollapsed() {
  const sidebar = document.querySelector("#layout-sidebar");
  const toggle = document.querySelector(".mobile-sidebar-toggle");
  if (!sidebar?.classList.contains("mobile-collapsed") || !toggle) return;

  toggle.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
  );
  await waitFor(
    () =>
      !document
        .querySelector("#layout-sidebar")
        ?.classList.contains("mobile-collapsed"),
    3000
  );
  await wait(200);
}

async function clickCourseMenu(label) {
  await expandSidebarIfCollapsed();
  const item = [...document.querySelectorAll(".layout-sidebar .item")].find(
    node => compactText(node).includes(label)
  );
  item?.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
  );
  return item || null;
}

await wait(2200);

const sidebar = await waitFor(() => document.querySelector("#layout-sidebar"));
const toggle = document.querySelector(".mobile-sidebar-toggle");
if (sidebar?.classList.contains("mobile-collapsed") && toggle) {
  toggle.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
  );
  await waitFor(
    () =>
      !document
        .querySelector("#layout-sidebar")
        ?.classList.contains("mobile-collapsed"),
    3000
  );
}

const courseLearnItem = await clickCourseMenu("课程学习");
await waitFor(() => compactText().includes("章节目录"), 8000);
await wait(900);

const scroll = document.querySelector(".layout-sidebar-scroll");
const firstItem = document.querySelector(".layout-sidebar .item");
const activeItem = document.querySelector(".layout-sidebar .item.active");
const sidebarRect = rectOf(document.querySelector("#layout-sidebar"));
const scrollRect = rectOf(scroll);
const firstItemRect = rectOf(firstItem);
const activeItemRect = rectOf(activeItem);
const computed = scroll ? getComputedStyle(scroll) : null;
const paddingLeft = computed ? parseFloat(computed.paddingLeft) || 0 : 0;
const scrollPaddingLeft = computed
  ? parseFloat(computed.scrollPaddingLeft) || 0
  : 0;
const firstInset =
  firstItemRect && scrollRect
    ? Math.round(firstItemRect.left - scrollRect.left)
    : null;
const activeVisible =
  !!activeItemRect &&
  !!scrollRect &&
  activeItemRect.left >= scrollRect.left - 2 &&
  activeItemRect.right <= scrollRect.right + 2;
const leftBlankOk =
  firstInset !== null &&
  firstInset >= 6 &&
  firstInset <= 34 &&
  paddingLeft <= 18;

const qaItem = await clickCourseMenu("课程问答");
await waitFor(() => compactText().includes("发起讨论"), 8000);
await wait(500);
const qaScrollLeft = scroll ? Math.round(scroll.scrollLeft) : null;
const courseLearnItemAgain = await clickCourseMenu("课程学习");
await waitFor(() => compactText().includes("章节目录"), 8000);
await wait(500);
const finalScrollLeft = scroll ? Math.round(scroll.scrollLeft) : null;
const finalFirstItemRect = rectOf(firstItem);
const finalFirstInset =
  finalFirstItemRect && scrollRect
    ? Math.round(finalFirstItemRect.left - scrollRect.left)
    : null;
const returnsToStart =
  finalScrollLeft !== null &&
  finalScrollLeft <= 2 &&
  finalFirstInset !== null &&
  finalFirstInset >= 6 &&
  finalFirstInset <= 34;

return {
  ok:
    !!courseLearnItem &&
    !!qaItem &&
    !!courseLearnItemAgain &&
    leftBlankOk &&
    activeVisible &&
    returnsToStart,
  href: location.href,
  text: compactText().slice(0, 1000),
  sidebarRect,
  scrollRect,
  firstItemRect,
  activeItemRect,
  firstInset,
  paddingLeft,
  scrollPaddingLeft,
  scrollLeft: scroll ? Math.round(scroll.scrollLeft) : null,
  qaScrollLeft,
  finalScrollLeft,
  finalFirstItemRect,
  finalFirstInset,
  leftBlankOk,
  activeVisible,
  returnsToStart
};
