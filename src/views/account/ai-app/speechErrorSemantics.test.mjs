import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  SPEECH_SEGMENT_QUOTA_DENIED,
  speechSegmentErrorMessage
} from "./speechErrorSemantics.ts";

const controllerSource = await readFile(
  new URL("./speech-playback-controller.ts", import.meta.url),
  "utf8"
);

test("shows the Issue 263 segment quota message", () => {
  assert.equal(
    speechSegmentErrorMessage(
      SPEECH_SEGMENT_QUOTA_DENIED,
      "实时语音中断，文字回答不受影响"
    ),
    "今日实时语音额度不足，文字回答不受影响"
  );
});

test("keeps bootstrap quota and unknown segment failures on their own paths", () => {
  const fallback = "实时播报中断，正在恢复完整录音";

  assert.equal(
    speechSegmentErrorMessage("speech_daily_quota_exceeded", fallback),
    fallback
  );
  assert.equal(
    speechSegmentErrorMessage(
      "speech_segment_reservation_database_failed",
      fallback
    ),
    fallback
  );
});

test("uses the quota semantic for both stream and canonical terminal states", () => {
  assert.match(
    controllerSource,
    /case "stream\.error":[\s\S]*?speechSegmentErrorMessage\([\s\S]*?control\.error_code/
  );
  assert.match(
    controllerSource,
    /setTerminalSessionStatus[\s\S]*?speechSegmentErrorMessage\([\s\S]*?session\.error_code/
  );
});
