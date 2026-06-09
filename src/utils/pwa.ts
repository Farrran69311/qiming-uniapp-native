export function registerPwa() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  if (window.location.protocol === "file:") {
    return;
  }

  const base = import.meta.env.BASE_URL || "/";
  const serviceWorkerUrl = `${base.replace(/\/?$/, "/")}sw.js`;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(serviceWorkerUrl).catch(error => {
      console.warn("PWA service worker registration failed", error);
    });
  });
}
