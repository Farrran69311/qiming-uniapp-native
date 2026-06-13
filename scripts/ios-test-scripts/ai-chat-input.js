function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
    rect.width > 20 &&
    rect.height > 20 &&
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

function isTextAreaInteractable(textarea) {
  const target = hitTarget(textarea);
  const textAreaWrap = textarea.closest(".el-textarea, .quick-chat-box");

  return !!(
    target &&
    (target === textarea || textAreaWrap?.contains(target))
  );
}

function isButtonInteractable(button) {
  const target = hitTarget(button);

  return !!(
    target &&
    (target === button || button.contains(target) || target.closest("button") === button)
  );
}

function findComposer() {
  const textarea = [
    ...document.querySelectorAll(
      ".ai-input-base textarea, .quick-chat-input textarea, .quick-chat-box textarea"
    )
  ].find(isTextAreaInteractable);

  if (!textarea) return {};

  const module = textarea.closest(".ai-chat-module, .quick-chat-box");
  const inputRow = textarea.closest(
    ".ai-chat-module-input-row, .ai-chat-module__input-row"
  );
  const sendButton =
    inputRow?.querySelector("button.el-button--primary") ||
    module?.querySelector("button.quick-chat-send-btn");

  return { textarea, module, sendButton };
}

const { textarea, sendButton } = findComposer();
if (!textarea) {
  return { ok: false, reason: "missing visible AI chat textarea" };
}

const value = "请帮我总结一下今天的学习重点";
textarea.focus();
textarea.value = value;
textarea.dispatchEvent(new Event("input", { bubbles: true }));
textarea.dispatchEvent(new Event("change", { bubbles: true }));
await wait(500);

const inputValue = textarea.value;
const buttonDisabled = sendButton
  ? sendButton.disabled || sendButton.getAttribute("aria-disabled") === "true"
  : true;
const buttonBox = sendButton ? sendButton.getBoundingClientRect() : null;
const textareaBox = textarea.getBoundingClientRect();

return {
  ok:
    inputValue === value &&
    !!sendButton &&
    isButtonInteractable(sendButton) &&
    !buttonDisabled,
  inputValue,
  hasButton: !!sendButton,
  buttonDisabled,
  buttonInteractable: isButtonInteractable(sendButton),
  buttonClass: sendButton?.className || "",
  buttonText: sendButton?.textContent?.trim() || "",
  buttonBox: buttonBox
    ? {
        width: Math.round(buttonBox.width),
        height: Math.round(buttonBox.height),
        top: Math.round(buttonBox.top),
        left: Math.round(buttonBox.left)
      }
    : null,
  textareaClass: textarea.className || "",
  textareaBox: {
    width: Math.round(textareaBox.width),
    height: Math.round(textareaBox.height),
    top: Math.round(textareaBox.top),
    left: Math.round(textareaBox.left)
  }
};
