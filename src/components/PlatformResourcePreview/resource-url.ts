export interface PlatformResourceUrlOptions {
  fileBaseUrl?: string;
  pageProtocol?: string;
  legacyFileHosts?: string[];
}

const clean = (value?: string | null) => String(value || "").trim();

function unwrapUrl(value: string) {
  let source = value.trim();
  const wrappers: Array<[string, string]> = [
    ["<", ">"],
    ['"', '"'],
    ["'", "'"]
  ];
  for (let pass = 0; pass < wrappers.length; pass += 1) {
    let changed = false;
    for (const [start, end] of wrappers) {
      if (source.startsWith(start) && source.endsWith(end)) {
        source = source.slice(start.length, -end.length).trim();
        changed = true;
      }
    }
    if (!changed) break;
  }
  return source;
}

function decodeUrlEntities(value: string) {
  return value
    .replace(/&amp;|&#0*38;|&#x0*26;/gi, "&")
    .replace(/&quot;|&#0*34;|&#x0*22;/gi, '"')
    .replace(/&apos;|&#0*39;|&#x0*27;/gi, "'")
    .replace(/\\\//g, "/");
}

function configuredFileBase(options: PlatformResourceUrlOptions) {
  const source = clean(options.fileBaseUrl).replace(/\/$/, "");
  if (!source) return null;
  try {
    return new URL(source);
  } catch {
    return null;
  }
}

function isKnownPlatformFileHost(
  hostname: string,
  fileBase: URL | null,
  legacyFileHosts: string[]
) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === fileBase?.hostname.toLowerCase() ||
    legacyFileHosts.some(host => normalized === host.toLowerCase())
  );
}

export function normalizePlatformResourceUrl(
  value?: string | null,
  options: PlatformResourceUrlOptions = {}
) {
  let source = unwrapUrl(decodeUrlEntities(clean(value)));
  if (!source) return "";

  const pageProtocol = clean(options.pageProtocol) || "https:";
  if (source.startsWith("//")) source = `${pageProtocol}${source}`;

  const fileBase = configuredFileBase(options);
  const legacyFileHosts = options.legacyFileHosts || ["aiedu-file.lehinet.com"];

  if (/^cos:\/\//i.test(source) && fileBase) {
    try {
      const cosUrl = new URL(source);
      const objectKey = `${cosUrl.hostname}${cosUrl.pathname}`.replace(
        /^\/+/,
        ""
      );
      return buildPlatformObjectUrl(objectKey, options);
    } catch {
      return source;
    }
  }

  if (!/^https?:\/\//i.test(source)) return source;

  try {
    const target = new URL(source);
    if (
      fileBase &&
      isKnownPlatformFileHost(target.hostname, fileBase, legacyFileHosts)
    ) {
      target.protocol = fileBase.protocol;
      target.host = fileBase.host;
    } else if (target.protocol === "http:" && pageProtocol === "https:") {
      const currentFileHost = fileBase?.hostname.toLowerCase();
      if (
        currentFileHost &&
        target.hostname.toLowerCase() === currentFileHost
      ) {
        target.protocol = "https:";
      }
    }
    return target.href;
  } catch {
    return source;
  }
}

export function buildPlatformObjectUrl(
  objectKey?: string | null,
  options: PlatformResourceUrlOptions = {}
) {
  const source = unwrapUrl(decodeUrlEntities(clean(objectKey)));
  if (!source) return "";
  if (/^(?:https?:|cos:)?\/\//i.test(source)) {
    return normalizePlatformResourceUrl(source, options);
  }

  const fileBase = configuredFileBase(options);
  if (!fileBase) return source;

  const base = fileBase.href.replace(/\/?$/, "/");
  const normalizedKey = source.replace(/^\/+/, "");
  try {
    return new URL(encodeURI(normalizedKey), base).href;
  } catch {
    return `${base}${normalizedKey}`;
  }
}

export function uniquePlatformResourceUrls(
  values: Array<string | null | undefined>,
  options: PlatformResourceUrlOptions = {}
) {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const value of values) {
    const normalized = normalizePlatformResourceUrl(value, options);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    urls.push(normalized);
  }
  return urls;
}
