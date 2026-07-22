import assert from "node:assert/strict";
import test from "node:test";

import { isClarityHostAllowed } from "./clarity.ts";

test("Clarity never collects localhost preview sessions", () => {
  for (const hostname of ["localhost", "127.0.0.1", "::1"]) {
    assert.equal(isClarityHostAllowed(hostname, ""), false);
    assert.equal(isClarityHostAllowed(hostname, hostname), false);
  }
});

test("Clarity only collects configured production hosts", () => {
  const allowedHosts = "study.intelledu.cn, classroom.intelledu.cn";

  assert.equal(isClarityHostAllowed("study.intelledu.cn", allowedHosts), true);
  assert.equal(isClarityHostAllowed("STUDY.INTELLEDU.CN.", allowedHosts), true);
  assert.equal(
    isClarityHostAllowed("preview.edgeone.app", allowedHosts),
    false
  );
});

test("Clarity remains compatible when no production allowlist is set", () => {
  assert.equal(isClarityHostAllowed("study.intelledu.cn"), true);
  assert.equal(isClarityHostAllowed(""), false);
});
