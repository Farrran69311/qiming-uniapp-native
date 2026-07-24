import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCapabilityProbeSucceeded,
  BackendCapabilityResponseError
} from "./backendCapabilityResponse.ts";

test("capability probes accept valid envelopes and legacy payloads", () => {
  for (const response of [
    { code: 0, data: [] },
    { code: "200", data: {} },
    { success: true, list: [] },
    { total: 0, list: [] },
    []
  ]) {
    assert.doesNotThrow(() => assertCapabilityProbeSucceeded(response));
  }
});

test("capability probes reject business failures and invalid bodies", () => {
  for (const response of [
    { code: 500, msg: "服务未部署" },
    { code: null, data: {} },
    { success: false, msg: "暂不可用" },
    null,
    "ok"
  ]) {
    assert.throws(
      () => assertCapabilityProbeSucceeded(response),
      BackendCapabilityResponseError
    );
  }
});
