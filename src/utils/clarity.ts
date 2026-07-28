import Clarity from "@microsoft/clarity";
import { isClarityHostAllowed } from "@/utils/clarityHost";
import { hasPrivacyConsent } from "@/utils/privacyConsent";

let initialized = false;

export const initClarity = () => {
  const projectId = import.meta.env.VITE_CLARITY_PROJECT_ID?.trim();
  const allowedHosts = import.meta.env.VITE_CLARITY_ALLOWED_HOSTS;

  if (
    initialized ||
    !projectId ||
    typeof window === "undefined" ||
    !hasPrivacyConsent() ||
    !isClarityHostAllowed(window.location.hostname, allowedHosts)
  ) {
    return false;
  }

  Clarity.init(projectId);
  initialized = true;
  return true;
};
