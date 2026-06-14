import { readFileSync, writeFileSync } from "node:fs";

const inputPath = process.argv[2];
const outputPath = process.argv[3] || inputPath;
const targetPackageName = (process.argv[4] || "").trim();
const targetVersionCode = Number.parseInt(process.argv[5] || "", 10);
const targetVersionName = (process.argv[6] || "").trim();
const sourcePackageName = "io.dcloud.HBuilder";
const sourceVersionName = "15.07";

if (!inputPath) {
  console.error(
    "Usage: node scripts/strip-android-permissions.mjs <AndroidManifest.xml> [output] [packageName]"
  );
  process.exit(2);
}

if (
  targetPackageName &&
  !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(targetPackageName)
) {
  throw new Error(`Invalid Android package name: ${targetPackageName}`);
}

if (
  process.argv[5] &&
  (!Number.isInteger(targetVersionCode) || targetVersionCode <= 0)
) {
  throw new Error(`Invalid Android versionCode: ${process.argv[5]}`);
}

const keepPermissions = new Set([
  "android.permission.ACCESS_NETWORK_STATE",
  "android.permission.ACCESS_WIFI_STATE",
  "android.permission.CAMERA",
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.INTERNET",
  "android.permission.MODIFY_AUDIO_SETTINGS",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_MEDIA_VIDEO",
  "android.permission.RECORD_AUDIO",
  "android.permission.VIBRATE",
  "android.permission.WRITE_EXTERNAL_STORAGE"
]);

const keepPermissionPrefixes = [
  "io.dcloud.HBuilder.permission.",
  "getui.permission.GetuiService.",
  "com.vivo.notification.permission.",
  "com.google.android.gms.permission.",
  "com.google.android.finsky.permission.",
  "com.asus.msa."
];

if (targetPackageName) {
  keepPermissionPrefixes.unshift(`${targetPackageName}.permission.`);
}

const stripMetaDataNames = new Set([
  // HBuilder base APK defaults this to "always", which triggers the startup
  // device-id / phone-number explanation dialog even after READ_PHONE_STATE
  // itself is removed. The app does not need phone-state access.
  "DCLOUD_READ_PHONE_STATE"
]);

function shouldKeepPermission(permission) {
  return (
    keepPermissions.has(permission) ||
    keepPermissionPrefixes.some(prefix => permission.startsWith(prefix))
  );
}

const buffer = readFileSync(inputPath);

function u16(offset) {
  return buffer.readUInt16LE(offset);
}

function u32(offset) {
  return buffer.readUInt32LE(offset);
}

if (u16(0) !== 0x0003) {
  throw new Error("Expected binary XML root chunk.");
}

const strings = [];

function readLength(offset) {
  const first = buffer[offset];
  if ((first & 0x80) !== 0) {
    return {
      value: ((first & 0x7f) << 8) | buffer[offset + 1],
      bytes: 2
    };
  }
  return { value: first, bytes: 1 };
}

function writeU16(value) {
  const output = Buffer.alloc(2);
  output.writeUInt16LE(value, 0);
  return output;
}

function writeUtf8Length(value) {
  if (value > 0x7f) {
    return Buffer.from([((value >> 8) & 0x7f) | 0x80, value & 0xff]);
  }
  return Buffer.from([value]);
}

function writeUtf16Length(value) {
  if (value > 0x7fff) {
    const output = Buffer.alloc(4);
    output.writeUInt16LE(((value >> 16) & 0x7fff) | 0x8000, 0);
    output.writeUInt16LE(value & 0xffff, 2);
    return output;
  }
  return writeU16(value);
}

function padToFour(bytes) {
  const padding = (4 - (bytes.length % 4)) % 4;
  if (!padding) return bytes;
  return Buffer.concat([bytes, Buffer.alloc(padding)]);
}

function readStringPool(offset) {
  const headerSize = u16(offset + 2);
  const chunkSize = u32(offset + 4);
  const stringCount = u32(offset + 8);
  const styleCount = u32(offset + 12);
  const flags = u32(offset + 16);
  const stringsStart = u32(offset + 20);
  const stylesStart = u32(offset + 24);
  const isUtf8 = (flags & 0x100) !== 0;

  for (let index = 0; index < stringCount; index += 1) {
    const relativeOffset = u32(offset + headerSize + index * 4);
    let cursor = offset + stringsStart + relativeOffset;
    if (isUtf8) {
      const utf16Length = readLength(cursor);
      cursor += utf16Length.bytes;
      const byteLength = readLength(cursor);
      cursor += byteLength.bytes;
      strings[index] = buffer.toString(
        "utf8",
        cursor,
        cursor + byteLength.value
      );
    } else {
      const length = u16(cursor);
      cursor += 2;
      strings[index] = buffer.toString("utf16le", cursor, cursor + length * 2);
    }
  }

  return {
    offset,
    headerSize,
    chunkSize,
    stringCount,
    styleCount,
    flags,
    stringsStart,
    stylesStart,
    isUtf8
  };
}

function buildStringPoolChunk(info) {
  const sourceChunk = buffer.subarray(
    info.offset,
    info.offset + info.chunkSize
  );
  const header = Buffer.from(sourceChunk.subarray(0, info.headerSize));
  const stringOffsetTable = Buffer.alloc(info.stringCount * 4);
  const styleOffsetStart = info.headerSize + info.stringCount * 4;
  const styleOffsetEnd = styleOffsetStart + info.styleCount * 4;
  const styleOffsetTable = Buffer.from(
    sourceChunk.subarray(styleOffsetStart, styleOffsetEnd)
  );
  const sourceStyleData =
    info.styleCount > 0 && info.stylesStart > 0
      ? Buffer.from(sourceChunk.subarray(info.stylesStart))
      : Buffer.alloc(0);
  const stringParts = [];
  let cursor = 0;

  for (let index = 0; index < info.stringCount; index += 1) {
    stringOffsetTable.writeUInt32LE(cursor, index * 4);
    const value = strings[index] || "";
    let encoded;

    if (info.isUtf8) {
      const utf8 = Buffer.from(value, "utf8");
      encoded = Buffer.concat([
        writeUtf8Length(value.length),
        writeUtf8Length(utf8.length),
        utf8,
        Buffer.from([0])
      ]);
    } else {
      const utf16 = Buffer.from(value, "utf16le");
      encoded = Buffer.concat([
        writeUtf16Length(value.length),
        utf16,
        Buffer.alloc(2)
      ]);
    }

    stringParts.push(encoded);
    cursor += encoded.length;
  }

  const stringData = padToFour(Buffer.concat(stringParts));
  const stringsStart =
    info.headerSize + stringOffsetTable.length + styleOffsetTable.length;
  const stylesStart = sourceStyleData.length
    ? stringsStart + stringData.length
    : 0;
  const chunk = Buffer.concat([
    header,
    stringOffsetTable,
    styleOffsetTable,
    stringData,
    sourceStyleData
  ]);

  chunk.writeUInt32LE(chunk.length, 4);
  chunk.writeUInt32LE(stringsStart, 20);
  chunk.writeUInt32LE(stylesStart, 24);

  return chunk;
}

function rewritePackageString(value) {
  if (!targetPackageName || targetPackageName === sourcePackageName)
    return value;
  return value.split(sourcePackageName).join(targetPackageName);
}

function rewriteManifestString(value) {
  const packaged = rewritePackageString(value);
  if (targetVersionName && packaged === sourceVersionName)
    return targetVersionName;
  return packaged;
}

function stringAt(index) {
  return index === 0xffffffff ? "" : strings[index] || "";
}

function getElementName(offset) {
  return stringAt(u32(offset + 20));
}

function getAttributeValue(offset, targetName) {
  const attributeStart = u16(offset + 24);
  const attributeSize = u16(offset + 26);
  const attributeCount = u16(offset + 28);

  for (let index = 0; index < attributeCount; index += 1) {
    const attrOffset = offset + 16 + attributeStart + index * attributeSize;
    const name = stringAt(u32(attrOffset + 4));
    if (name !== targetName) continue;

    const rawValue = u32(attrOffset + 8);
    if (rawValue !== 0xffffffff) return stringAt(rawValue);

    const dataType = buffer[attrOffset + 15];
    const data = u32(attrOffset + 16);
    return dataType === 3 ? stringAt(data) : String(data);
  }

  return "";
}

function patchManifestStartElement(offset) {
  if (!Number.isInteger(targetVersionCode) || targetVersionCode <= 0) {
    return buffer.subarray(offset, offset + u32(offset + 4));
  }

  const chunk = Buffer.from(buffer.subarray(offset, offset + u32(offset + 4)));
  const attributeStart = u16(offset + 24);
  const attributeSize = u16(offset + 26);
  const attributeCount = u16(offset + 28);

  for (let index = 0; index < attributeCount; index += 1) {
    const attrOffset = 16 + attributeStart + index * attributeSize;
    const absoluteAttrOffset = offset + attrOffset;
    const name = stringAt(u32(absoluteAttrOffset + 4));
    if (name !== "versionCode") continue;

    chunk[attrOffset + 15] = 0x10;
    chunk.writeUInt32LE(targetVersionCode, attrOffset + 16);
  }

  return chunk;
}

let offset = 8;
let removedCount = 0;
let removedMetaDataCount = 0;
let skipElementDepth = 0;
const chunks = [];

while (offset < buffer.length) {
  const type = u16(offset);
  const size = u32(offset + 4);

  if (size <= 0) {
    throw new Error(`Invalid chunk size at ${offset}: ${size}`);
  }

  if (type === 0x0001) {
    const stringPoolInfo = readStringPool(offset);
    if (
      (targetPackageName && targetPackageName !== sourcePackageName) ||
      targetVersionName
    ) {
      let rewrittenCount = 0;
      for (let index = 0; index < strings.length; index += 1) {
        const next = rewriteManifestString(strings[index]);
        if (next !== strings[index]) {
          rewrittenCount += 1;
          strings[index] = next;
        }
      }
      if (rewrittenCount > 0) {
        chunks.push(buildStringPoolChunk(stringPoolInfo));
        offset += size;
        continue;
      }
    }
  }

  if (skipElementDepth > 0) {
    if (type === 0x0102) skipElementDepth += 1;
    if (type === 0x0103) skipElementDepth -= 1;
    offset += size;
    continue;
  }

  let remove = false;
  if (type === 0x0102 && getElementName(offset) === "uses-permission") {
    const permission = getAttributeValue(offset, "name");
    remove =
      permission.startsWith("android.permission.") &&
      !shouldKeepPermission(permission);
    if (remove) removedCount += 1;
  }
  if (type === 0x0102 && getElementName(offset) === "meta-data") {
    const name = getAttributeValue(offset, "name");
    remove = stripMetaDataNames.has(name);
    if (remove) removedMetaDataCount += 1;
  }

  if (!remove) {
    chunks.push(
      type === 0x0102 && getElementName(offset) === "manifest"
        ? patchManifestStartElement(offset)
        : buffer.subarray(offset, offset + size)
    );
  } else {
    skipElementDepth = 1;
  }

  offset += size;
}

const output = Buffer.concat([buffer.subarray(0, 8), ...chunks]);
output.writeUInt32LE(output.length, 4);
writeFileSync(outputPath, output);

console.log(
  `Stripped ${removedCount} Android permission declaration(s) and ${removedMetaDataCount} DCloud phone-state meta-data declaration(s).` +
    (targetPackageName ? ` Android package: ${targetPackageName}.` : "") +
    (Number.isInteger(targetVersionCode) && targetVersionName
      ? ` Android version: ${targetVersionName} (${targetVersionCode}).`
      : "")
);
