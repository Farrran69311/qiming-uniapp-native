import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  explanationImageTerminalStatuses,
  shouldApplyExplanationImageUpdate
} from "./explanationImageState.ts";

const [assistantApiSource, workbenchSource, chatSource, imageCardSource] =
  await Promise.all([
    readFile(
      new URL("../../../api/frontend/assistant.ts", import.meta.url),
      "utf8"
    ),
    readFile(new URL("./index.vue", import.meta.url), "utf8"),
    readFile(new URL("./components/AiChatModule.vue", import.meta.url), "utf8"),
    readFile(
      new URL("./components/ExplanationImageCard.vue", import.meta.url),
      "utf8"
    )
  ]);

test("accepts the documented retrying to generating transition", () => {
  assert.equal(
    shouldApplyExplanationImageUpdate("retrying", "generating"),
    true
  );
  assert.equal(
    shouldApplyExplanationImageUpdate("generating", "queued"),
    false
  );
});

test("terminal image states cannot be overwritten by stale polls", () => {
  for (const status of explanationImageTerminalStatuses) {
    assert.equal(
      shouldApplyExplanationImageUpdate(status, "generating"),
      false
    );
  }
  assert.equal(
    shouldApplyExplanationImageUpdate("generating", "succeeded"),
    true
  );
});

test("unknown provider outcomes stay fail-closed in the image card", () => {
  assert.equal(explanationImageTerminalStatuses.has("unknown_outcome"), true);
  assert.match(imageCardSource, /provider_unknown_outcome/);
  assert.match(
    imageCardSource,
    /status === "succeeded" && Boolean\(props\.image\.public_url\)/
  );
  assert.match(imageCardSource, /emit\("refresh", props\.image\.image_id\)/);
  assert.match(chatSource, /refresh-explanation-image/);
  assert.match(workbenchSource, /handleRefreshExplanationImage/);
});

test("frontend follows the raw image-status contract and bypasses cache", () => {
  assert.match(
    assistantApiSource,
    /\/edu\/frontend\/v1\/assistant\/explanation-images\//
  );
  assert.match(assistantApiSource, /params: \{ _ts: Date\.now\(\) \}/);
  assert.match(
    assistantApiSource,
    /normalizeAssistantExplanationImageResponse/
  );
});

test("image mode drives the visual preference instead of a nonexistent skill", () => {
  assert.match(workbenchSource, /explanationImageRequestMode/);
  assert.match(
    workbenchSource,
    /explanationImageRequestMode[\s\S]*?preferred_explanation_mode/
  );
  assert.match(
    workbenchSource,
    /explanation_image_mode: explanationImageRequestMode/
  );
  assert.match(chatSource, /update:explanationImageMode/);
  assert.match(chatSource, /讲解图自动生成/);
});
