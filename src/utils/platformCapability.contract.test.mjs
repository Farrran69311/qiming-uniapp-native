import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("./platformCapability.ts", import.meta.url),
  "utf8"
);

assert.match(source, /plusApi\?\.runtime\?\.openURL/);
assert.match(source, /window\.location\.assign\(url\)/);
assert.match(source, /navigator\.clipboard\?\.writeText/);
assert.match(source, /document\.execCommand\("copy"\)/);
assert.doesNotMatch(source, /javascript:/i);

console.log("platform capability contract: ok");
