export type PlatformOpenMode = "native" | "window" | "same-window";

export interface PlatformOpenResult {
  opened: boolean;
  mode?: PlatformOpenMode;
}

function resolvePlatformUrl(value: string) {
  if (typeof window === "undefined") return "";
  try {
    const url = new URL(String(value || "").trim(), window.location.href);
    if (!["http:", "https:", "blob:", "file:"].includes(url.protocol)) {
      return "";
    }
    return url.toString();
  } catch {
    return "";
  }
}

export function openPlatformUrl(value: string): PlatformOpenResult {
  const url = resolvePlatformUrl(value);
  if (!url) return { opened: false };

  const plusApi = (window as any).plus;
  if (plusApi?.runtime?.openURL && /^https?:/i.test(url)) {
    try {
      plusApi.runtime.openURL(url);
      return { opened: true, mode: "native" };
    } catch {
      // Continue with browser fallbacks below.
    }
  }

  try {
    const openedWindow = window.open(url, "_blank");
    if (openedWindow) {
      openedWindow.opener = null;
      return { opened: true, mode: "window" };
    }
  } catch {
    // Some embedded WebViews reject new windows.
  }

  try {
    window.location.assign(url);
    return { opened: true, mode: "same-window" };
  } catch {
    return { opened: false };
  }
}

export async function copyPlatformText(value: string) {
  const text = String(value || "");
  if (!text || typeof document === "undefined") return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Clipboard permission is commonly unavailable in embedded WebViews.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.inset = "0 auto auto -9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}
