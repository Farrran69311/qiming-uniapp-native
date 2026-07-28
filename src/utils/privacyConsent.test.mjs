import assert from "node:assert/strict";
import test from "node:test";

import {
  PRIVACY_CONSENT_VERSION,
  hasPrivacyConsent
} from "./privacyConsent.ts";

const storageWith = value => ({
  getItem: () => value
});

test("privacy consent is absent by default and rejects malformed records", () => {
  assert.equal(hasPrivacyConsent(null), false);
  assert.equal(hasPrivacyConsent(storageWith(null)), false);
  assert.equal(hasPrivacyConsent(storageWith("not-json")), false);
});

test("privacy consent only accepts the current explicit version", () => {
  assert.equal(
    hasPrivacyConsent(
      storageWith(
        JSON.stringify({
          accepted: true,
          acceptedAt: "2026-07-28T00:00:00.000Z",
          version: PRIVACY_CONSENT_VERSION
        })
      )
    ),
    true
  );
  assert.equal(
    hasPrivacyConsent(
      storageWith(
        JSON.stringify({
          accepted: true,
          acceptedAt: "2026-07-27T00:00:00.000Z",
          version: "2026-07-27"
        })
      )
    ),
    false
  );
  assert.equal(
    hasPrivacyConsent(
      storageWith(
        JSON.stringify({
          accepted: false,
          acceptedAt: "2026-07-28T00:00:00.000Z",
          version: PRIVACY_CONSENT_VERSION
        })
      )
    ),
    false
  );
});
