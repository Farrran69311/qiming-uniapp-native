import { hasPrivacyConsent } from "@/utils/privacyConsent";

const GOOGLE_ANALYTICS_ID = "G-TQ7GPZDL9X";
const ALLOWED_HOSTS = new Set(["study.intelledu.cn"]);

let initialized = false;

export const isGoogleAnalyticsHostAllowed = (hostname: string) =>
  ALLOWED_HOSTS.has(hostname.trim().toLowerCase().replace(/\.$/, ""));

export const initGoogleAnalytics = () => {
  if (
    initialized ||
    typeof window === "undefined" ||
    !hasPrivacyConsent() ||
    !isGoogleAnalyticsHostAllowed(window.location.hostname)
  ) {
    return false;
  }

  const analyticsWindow = window as typeof window & {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  };

  analyticsWindow.dataLayer = analyticsWindow.dataLayer || [];
  analyticsWindow.gtag = (...args: unknown[]) => {
    analyticsWindow.dataLayer?.push(args);
  };
  analyticsWindow.gtag("js", new Date());
  analyticsWindow.gtag("config", GOOGLE_ANALYTICS_ID);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`;
  script.dataset.qimingAnalytics = "true";
  document.head.appendChild(script);

  initialized = true;
  return true;
};
