export const PRIVACY_CONSENT_VERSION = "2026-07-28";
export const PRIVACY_CONSENT_EVENT = "qiming:privacy-consent-granted";

const PRIVACY_CONSENT_STORAGE_KEY = "qiming-privacy-consent";

type ReadableStorage = Pick<Storage, "getItem">;

type PrivacyConsentRecord = {
  accepted: true;
  acceptedAt: string;
  version: string;
};

const getBrowserStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const hasPrivacyConsent = (
  storage: ReadableStorage | null = getBrowserStorage()
) => {
  if (!storage) return false;

  try {
    const raw = storage.getItem(PRIVACY_CONSENT_STORAGE_KEY);
    if (!raw) return false;

    const record = JSON.parse(raw) as Partial<PrivacyConsentRecord>;
    return (
      record.accepted === true && record.version === PRIVACY_CONSENT_VERSION
    );
  } catch {
    return false;
  }
};

export const grantPrivacyConsent = () => {
  const storage = getBrowserStorage();
  const record: PrivacyConsentRecord = {
    accepted: true,
    acceptedAt: new Date().toISOString(),
    version: PRIVACY_CONSENT_VERSION
  };

  try {
    storage?.setItem(PRIVACY_CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Consent still applies to the current action when storage is unavailable.
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PRIVACY_CONSENT_EVENT));
  }
};
