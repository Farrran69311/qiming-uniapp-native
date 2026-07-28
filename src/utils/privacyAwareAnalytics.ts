import { initClarity } from "@/utils/clarity";
import { initGoogleAnalytics } from "@/utils/googleAnalytics";
import { PRIVACY_CONSENT_EVENT } from "@/utils/privacyConsent";

let listening = false;

const initializeAllowedAnalytics = () => {
  initClarity();
  initGoogleAnalytics();
};

export const initPrivacyAwareAnalytics = () => {
  initializeAllowedAnalytics();

  if (listening || typeof window === "undefined") return;

  window.addEventListener(PRIVACY_CONSENT_EVENT, initializeAllowedAnalytics);
  listening = true;
};
