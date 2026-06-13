function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function text() {
  return (document.querySelector("#app")?.innerText || "").replace(/\s+/g, " ");
}

const before = text();
const option = document.querySelector(".question-options .option-item");
if (!option) {
  return { ok: false, reason: "missing option item", before };
}

option.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
await wait(800);

const after = text();
const selected = !!document.querySelector(".question-options .option-item.is-checked");
const answered = /已答\s*1\s*题/.test(after) || /已答\s*1/.test(after);

return {
  ok: selected && answered,
  selected,
  answered,
  before: before.slice(0, 500),
  after: after.slice(0, 500)
};
