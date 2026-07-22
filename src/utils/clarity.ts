import Clarity from "@microsoft/clarity";

let initialized = false;

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

const normalizeHostname = (hostname: string) =>
  hostname.trim().toLowerCase().replace(/\.$/, "");

export const isClarityHostAllowed = (hostname: string, allowedHosts = "") => {
  const normalizedHostname = normalizeHostname(hostname);

  if (!normalizedHostname || LOCAL_HOSTNAMES.has(normalizedHostname)) {
    return false;
  }

  const hosts = allowedHosts.split(",").map(normalizeHostname).filter(Boolean);

  return hosts.length === 0 || hosts.includes(normalizedHostname);
};

export const initClarity = () => {
  const projectId = import.meta.env.VITE_CLARITY_PROJECT_ID?.trim();
  const allowedHosts = import.meta.env.VITE_CLARITY_ALLOWED_HOSTS;

  if (
    initialized ||
    !projectId ||
    typeof window === "undefined" ||
    !isClarityHostAllowed(window.location.hostname, allowedHosts)
  ) {
    return false;
  }

  Clarity.init(projectId);
  initialized = true;
  return true;
};
