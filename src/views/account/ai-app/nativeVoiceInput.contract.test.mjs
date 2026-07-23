import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const view = await readFile(new URL("./index.vue", import.meta.url), "utf8");
const manifest = await readFile(
  new URL("../../../../native-app/src/manifest.json", import.meta.url),
  "utf8"
);

assert.match(view, /plus\?\.speech\?\.startRecognize/);
assert.match(view, /nativeSpeech\.startRecognize/);
assert.match(view, /nativeSpeech\.stopRecognize/);
assert.match(view, /:disabled="!quickVoiceSupported"/);
assert.match(manifest, /"Record"\s*:\s*\{\}/);
assert.match(manifest, /"Speech"\s*:\s*\{\}/);
assert.match(manifest, /android\.permission\.RECORD_AUDIO/);

console.log("native voice input contract: ok");
