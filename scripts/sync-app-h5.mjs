import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const distDir = join(root, "dist");
const targetDir = join(root, "native-app", "src", "hybrid", "html");
const staticPublicDirs = ["virtual-people"];

if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
  throw new Error("dist does not exist. Run pnpm build:app-h5 first.");
}

const resolvedTarget = resolve(targetDir);
const allowedPrefix = resolve(root, "native-app", "src", "hybrid") + "\\";
if (!resolvedTarget.startsWith(allowedPrefix)) {
  throw new Error(
    `Refusing to sync outside native-app/src/hybrid: ${resolvedTarget}`
  );
}

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });
cpSync(distDir, targetDir, { recursive: true });

for (const dirName of staticPublicDirs) {
  const sourceDir = join(root, "public", dirName);
  if (existsSync(sourceDir) && statSync(sourceDir).isDirectory()) {
    cpSync(sourceDir, join(targetDir, dirName), { recursive: true });
  }
}

const pinyinSource = join(
  root,
  "node_modules",
  "pinyin-pro",
  "dist",
  "index.mjs"
);
const pinyinTargetDir = join(
  targetDir,
  "virtual-people",
  "vendor",
  "pinyin-pro"
);
if (existsSync(pinyinSource)) {
  mkdirSync(pinyinTargetDir, { recursive: true });
  cpSync(pinyinSource, join(pinyinTargetDir, "index.mjs"));
}

const virtualPeopleTargetDir = join(targetDir, "virtual-people");

function walkFiles(dir, matcher, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(entryPath, matcher, files);
    } else if (matcher(entryPath)) {
      files.push(entryPath);
    }
  }
  return files;
}

function normalizeCssForLegacyWebview(input) {
  return input
    .replace(/\(\s*width\s*<=\s*([^)]+?)\s*\)/g, "(max-width: $1)")
    .replace(/\(\s*width\s*>=\s*([^)]+?)\s*\)/g, "(min-width: $1)");
}

function toPosixPath(pathValue) {
  return pathValue.replace(/\\/g, "/");
}

function toRelativeModulePath(fromFile, targetFile) {
  let relativePath = toPosixPath(relative(dirname(fromFile), targetFile));
  if (!relativePath.startsWith(".")) {
    relativePath = `./${relativePath}`;
  }
  return relativePath;
}

function rewriteVirtualPeopleAbsoluteImports(filePath, input) {
  return input.replace(
    /(["'])\/virtual-people\/([^"']+)\1/g,
    (match, quote, assetPath) => {
      const targetFile = join(virtualPeopleTargetDir, ...assetPath.split("/"));
      return `${quote}${toRelativeModulePath(filePath, targetFile)}${quote}`;
    }
  );
}

function rewriteVirtualPeopleNativeEntry(input) {
  const motionManifestPath = join(virtualPeopleTargetDir, "motions.json");
  const inlineMotionManifest = existsSync(motionManifestPath)
    ? readFileSync(motionManifestPath, "utf8")
    : "";
  const inlineMotionTag = inlineMotionManifest
    ? `\n  <script type="application/json" id="qiming-motion-manifest-json">${inlineMotionManifest.replace(/<\/script/gi, "<\\/script")}</script>`
    : "";

  let output = input
    .replace(/\s*<script\s+src=["']\.\/es-module-shims\.js["']><\/script>/i, "")
    .replace(
      /\s*<script\s+type=["']importmap-shim["'][^>]*>[\s\S]*?<\/script>/i,
      ""
    )
    .replace(
      /\s*<script\s+type=["']application\/json["']\s+id=["']qiming-motion-manifest-json["'][^>]*>[\s\S]*?<\/script>/i,
      ""
    )
    .replace(/type=["']module-shim["']/g, 'type="module"')
    .replace(
      /from\s+(['"])three\1/g,
      'from "./vendor/three/build/three.module.js"'
    )
    .replace(
      /from\s+(['"])three\/addons\/([^"']+)\1/g,
      'from "./vendor/three/examples/jsm/$2"'
    )
    .replace(
      /from\s+(['"])@pixiv\/three-vrm\1/g,
      'from "./vendor/pixiv/three-vrm/lib/three-vrm.module.js"'
    )
    .replace(
      /from\s+(['"])pinyin-pro\1/g,
      'from "./vendor/pinyin-pro/index.mjs"'
    );

  if (inlineMotionTag) {
    output = output.replace(
      /(\s*<script\s+type=["']module["'][^>]*>)/i,
      `${inlineMotionTag}$1`
    );
  }

  return output;
}

if (existsSync(virtualPeopleTargetDir)) {
  const moduleLikeFiles = walkFiles(virtualPeopleTargetDir, filePath =>
    /\.(html|m?js)$/i.test(filePath)
  );
  for (const filePath of moduleLikeFiles) {
    const source = readFileSync(filePath, "utf8");
    let nextSource = rewriteVirtualPeopleAbsoluteImports(filePath, source);
    if (filePath === join(virtualPeopleTargetDir, "index.html")) {
      nextSource = rewriteVirtualPeopleNativeEntry(nextSource);
    }
    if (nextSource !== source) {
      writeFileSync(filePath, nextSource, "utf8");
    }
  }
}

for (const cssPath of walkFiles(targetDir, filePath =>
  filePath.endsWith(".css")
)) {
  const css = readFileSync(cssPath, "utf8");
  const normalizedCss = normalizeCssForLegacyWebview(css);
  if (normalizedCss !== css) {
    writeFileSync(cssPath, normalizedCss, "utf8");
  }
}

const uniWebviewScript = `!function(e,n){"object"==typeof exports&&"undefined"!=typeof module?module.exports=n():"function"==typeof define&&define.amd?define(n):(e=e||self).uni=n()}(this,(function(){"use strict";try{var e={};Object.defineProperty(e,"passive",{get:function(){!0}}),window.addEventListener("test-passive",null,e)}catch(e){}var n=Object.prototype.hasOwnProperty;function i(e,i){return n.call(e,i)}var t=[];function r(){return window.__dcloud_weex_postMessage||window.__dcloud_weex_}var o=function(e,n){var i={options:{timestamp:+new Date},name:e,arg:n};if(r()){if("postMessage"===e){var o={data:[n]};return window.__dcloud_weex_postMessage?window.__dcloud_weex_postMessage(o):window.__dcloud_weex_.postMessage(JSON.stringify(o))}var a={type:"WEB_INVOKE_APPSERVICE",args:{data:i,webviewIds:t}};window.__dcloud_weex_postMessage?window.__dcloud_weex_postMessageToService(a):window.__dcloud_weex_.postMessageToService(JSON.stringify(a))}if(!window.plus)return window.parent.postMessage({type:"WEB_INVOKE_APPSERVICE",data:i,pageId:""},"*");if(0===t.length){var d=plus.webview.currentWebview();if(!d)throw new Error("plus.webview.currentWebview() is undefined");var s=d.parent(),w="";w=s?s.id:d.id,t.push(w)}if(plus.webview.getWebviewById("__uniapp__service"))plus.webview.postMessageToUniNView({type:"WEB_INVOKE_APPSERVICE",args:{data:i,webviewIds:t}},"__uniapp__service");else{var u=JSON.stringify(i);plus.webview.getLaunchWebview().evalJS('UniPlusBridge.subscribeHandler("'.concat("WEB_INVOKE_APPSERVICE",'",').concat(u,",").concat(JSON.stringify(t),");"))}},a={navigateTo:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},n=e.url;o("navigateTo",{url:encodeURI(n)})},navigateBack:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},n=e.delta;o("navigateBack",{delta:parseInt(n)||1})},switchTab:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},n=e.url;o("switchTab",{url:encodeURI(n)})},reLaunch:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},n=e.url;o("reLaunch",{url:encodeURI(n)})},redirectTo:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},n=e.url;o("redirectTo",{url:encodeURI(n)})},getEnv:function(e){r()?e({nvue:!0}):window.plus?e({plus:!0}):e({h5:!0})},postMessage:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};o("postMessage",e.data||{})}},d=/uni-app/i.test(navigator.userAgent),s=/Html5Plus/i.test(navigator.userAgent),w=/complete|loaded|interactive/;var u=window.my&&navigator.userAgent.indexOf(["t","n","e","i","l","C","y","a","p","i","l","A"].reverse().join(""))>-1;var g=window.swan&&window.swan.webView&&/swan/i.test(navigator.userAgent);var v=window.qq&&window.qq.miniProgram&&/QQ/i.test(navigator.userAgent)&&/miniProgram/i.test(navigator.userAgent);var c=window.tt&&window.tt.miniProgram&&/toutiaomicroapp/i.test(navigator.userAgent);var m=window.wx&&window.wx.miniProgram&&/micromessenger/i.test(navigator.userAgent)&&/miniProgram/i.test(navigator.userAgent);var p=window.qa&&/quickapp/i.test(navigator.userAgent);var f=window.ks&&window.ks.miniProgram&&/micromessenger/i.test(navigator.userAgent)&&/miniProgram/i.test(navigator.userAgent);var l=window.tt&&window.tt.miniProgram&&/Lark|Feishu/i.test(navigator.userAgent);var _=window.jd&&window.jd.miniProgram&&/micromessenger/i.test(navigator.userAgent)&&/miniProgram/i.test(navigator.userAgent);var E=window.xhs&&window.xhs.miniProgram&&/xhsminiapp/i.test(navigator.userAgent);for(var h,P=function(){window.UniAppJSBridge=!0,document.dispatchEvent(new CustomEvent("UniAppJSBridgeReady",{bubbles:!0,cancelable:!0}))},b=[function(e){if(d||s)return window.__dcloud_weex_postMessage||window.__dcloud_weex_?document.addEventListener("DOMContentLoaded",e):window.plus&&w.test(document.readyState)?setTimeout(e,0):document.addEventListener("plusready",e),a},function(e){if(m)return window.WeixinJSBridge&&window.WeixinJSBridge.invoke?setTimeout(e,0):document.addEventListener("WeixinJSBridgeReady",e),window.wx.miniProgram},function(e){if(v)return window.QQJSBridge&&window.QQJSBridge.invoke?setTimeout(e,0):document.addEventListener("QQJSBridgeReady",e),window.qq.miniProgram},function(e){if(u){document.addEventListener("DOMContentLoaded",e);var n=window.my;return{navigateTo:n.navigateTo,navigateBack:n.navigateBack,switchTab:n.switchTab,reLaunch:n.reLaunch,redirectTo:n.redirectTo,postMessage:n.postMessage,getEnv:n.getEnv}}},function(e){if(g)return document.addEventListener("DOMContentLoaded",e),window.swan.webView},function(e){if(c)return document.addEventListener("DOMContentLoaded",e),window.tt.miniProgram},function(e){if(p){window.QaJSBridge&&window.QaJSBridge.invoke?setTimeout(e,0):document.addEventListener("QaJSBridgeReady",e);var n=window.qa;return{navigateTo:n.navigateTo,navigateBack:n.navigateBack,switchTab:n.switchTab,reLaunch:n.reLaunch,redirectTo:n.redirectTo,postMessage:n.postMessage,getEnv:n.getEnv}}},function(e){if(f)return window.WeixinJSBridge&&window.WeixinJSBridge.invoke?setTimeout(e,0):document.addEventListener("WeixinJSBridgeReady",e),window.ks.miniProgram},function(e){if(l)return document.addEventListener("DOMContentLoaded",e),window.tt.miniProgram},function(e){if(_)return window.JDJSBridgeReady&&window.JDJSBridgeReady.invoke?setTimeout(e,0):document.addEventListener("JDJSBridgeReady",e),window.jd.miniProgram},function(e){if(E)return window.xhs.miniProgram},function(e){return document.addEventListener("DOMContentLoaded",e),a}],y=0;y<b.length&&!(h=b[y](P));y++);h||(h={});var B="undefined"!=typeof uni?uni:{};if(!B.navigateTo)for(var S in h)i(h,S)&&(B[S]=h[S]);return B.webView=h,B}));
`;
writeFileSync(
  join(targetDir, "uni.webview.1.5.8.js"),
  uniWebviewScript,
  "utf8"
);

const compatibilityScript = `
;(function () {
  var objectToString = Object.prototype.toString;

  if (typeof Object.hasOwn !== 'function') {
    Object.defineProperty(Object, 'hasOwn', {
      configurable: true,
      writable: true,
      value: function hasOwn(object, property) {
        if (object == null) {
          throw new TypeError('Cannot convert undefined or null to object');
        }
        return Object.prototype.hasOwnProperty.call(Object(object), property);
      }
    });
  }

  if (typeof window.structuredClone !== 'function') {
    var cloneValue = function (value, seen) {
      if (value === null || typeof value !== 'object') return value;

      if (seen.has(value)) return seen.get(value);

      if (value instanceof Date) return new Date(value.getTime());
      if (value instanceof RegExp) {
        var regexp = new RegExp(value.source, value.flags);
        regexp.lastIndex = value.lastIndex;
        return regexp;
      }
      if (typeof Blob !== 'undefined' && value instanceof Blob) {
        return value.slice(0, value.size, value.type);
      }
      if (typeof File !== 'undefined' && value instanceof File) {
        return new File([value], value.name, {
          type: value.type,
          lastModified: value.lastModified
        });
      }
      if (typeof ImageData !== 'undefined' && value instanceof ImageData) {
        return new ImageData(
          cloneValue(value.data, seen),
          value.width,
          value.height,
          value.colorSpace ? { colorSpace: value.colorSpace } : undefined
        );
      }
      if (value instanceof ArrayBuffer) return value.slice(0);
      if (ArrayBuffer.isView(value)) {
        var buffer = cloneValue(value.buffer, seen);
        if (value instanceof DataView) {
          return new DataView(buffer, value.byteOffset, value.byteLength);
        }
        return new value.constructor(buffer, value.byteOffset, value.length);
      }
      if (value instanceof Map) {
        var map = new Map();
        seen.set(value, map);
        value.forEach(function (mapValue, mapKey) {
          map.set(cloneValue(mapKey, seen), cloneValue(mapValue, seen));
        });
        return map;
      }
      if (value instanceof Set) {
        var set = new Set();
        seen.set(value, set);
        value.forEach(function (setValue) {
          set.add(cloneValue(setValue, seen));
        });
        return set;
      }

      var tag = objectToString.call(value);
      var output = Array.isArray(value)
        ? []
        : tag === '[object Object]'
          ? Object.create(Object.getPrototypeOf(value))
          : {};
      seen.set(value, output);

      Reflect.ownKeys(value).forEach(function (key) {
        var descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor) return;
        if ('value' in descriptor) {
          descriptor.value = cloneValue(descriptor.value, seen);
        }
        try {
          Object.defineProperty(output, key, descriptor);
        } catch (_) {
          output[key] = cloneValue(value[key], seen);
        }
      });
      return output;
    };

    Object.defineProperty(window, 'structuredClone', {
      configurable: true,
      writable: true,
      value: function structuredClonePolyfill(value) {
        return cloneValue(value, new Map());
      }
    });
  }

  window.__QIMING_NATIVE_COMPAT__ = {
    objectHasOwn: typeof Object.hasOwn === 'function',
    structuredClone: typeof window.structuredClone === 'function',
    appliedAt: Date.now()
  };
})();
`;

const bridgeScript = `
;(function () {
  var bridgeUrl = './uni.webview.1.5.8.js';
  var sendQueue = [];
  function post(payload) {
    if (window.uni && typeof window.uni.postMessage === 'function') {
      window.uni.postMessage({ data: payload });
      return;
    }
    sendQueue.push(payload);
  }
  function flush() {
    if (!window.uni || typeof window.uni.postMessage !== 'function') return;
    while (sendQueue.length) window.uni.postMessage({ data: sendQueue.shift() });
  }
  function report(type, extra) {
    post(Object.assign({
      source: 'qiming-h5',
      type: type,
      href: location.href,
      title: document.title,
      online: navigator.onLine,
      timestamp: Date.now()
    }, extra || {}));
  }
  document.documentElement.classList.add('qiming-native-webview');
  document.documentElement.setAttribute('data-qiming-native', 'true');
  var nativeTop = 'env(safe-area-inset-top, 0px)';
  var nativeBottom = 'env(safe-area-inset-bottom, 0px)';
  if (window.plus && plus.navigator) {
    var statusbarHeight = Number(plus.navigator.getStatusbarHeight && plus.navigator.getStatusbarHeight());
    if (statusbarHeight > 0) nativeTop = statusbarHeight + 'px';
    try {
      plus.navigator.setStatusBarStyle('light');
    } catch (_) {}
  } else {
    document.addEventListener('plusready', function () {
      try {
        var statusbarHeight = Number(plus.navigator.getStatusbarHeight && plus.navigator.getStatusbarHeight());
        if (statusbarHeight > 0) {
          document.documentElement.style.setProperty('--qiming-native-safe-top', statusbarHeight + 'px');
          document.documentElement.style.setProperty('--qiming-native-status-top', statusbarHeight + 'px');
        }
        plus.navigator.setStatusBarStyle('light');
      } catch (_) {}
    });
  }
  document.documentElement.style.setProperty('--qiming-native-safe-bottom', nativeBottom);
  document.documentElement.style.setProperty('--qiming-native-safe-top', nativeTop);
  document.documentElement.style.setProperty('--qiming-native-status-top', nativeTop);
  document.documentElement.style.setProperty('--qiming-native-bottom-clearance', 'calc(88px + env(safe-area-inset-bottom, 0px))');
  var script = document.createElement('script');
  script.src = bridgeUrl;
  script.onload = function () {
    document.addEventListener('UniAppJSBridgeReady', function () {
      flush();
      report('bridge-ready');
    });
  };
  document.head.appendChild(script);
  window.addEventListener('load', function () { report('loaded'); });
  window.addEventListener('online', function () { report('online'); });
  window.addEventListener('offline', function () { report('offline'); });
  document.addEventListener('visibilitychange', function () {
    report('visibility', { visibilityState: document.visibilityState });
  });
  window.QimingNativeBridge = {
    post: post,
    report: report
  };
})();
`;

writeFileSync(
  join(targetDir, "qiming-native-bridge.js"),
  bridgeScript.trimStart(),
  "utf8"
);
writeFileSync(
  join(targetDir, "qiming-native-compat.js"),
  compatibilityScript.trimStart(),
  "utf8"
);

const htmlPath = join(targetDir, "index.html");
let html = existsSync(htmlPath) ? readFileSync(htmlPath, "utf8") : "";

function injectHeadScript(input, scriptName) {
  const scriptTag = `  <script src="./${scriptName}"></script>`;
  let output = input.replace(
    new RegExp(`\\s*<script\\s+src=["']\\./${scriptName}["']><\\/script>`, "g"),
    ""
  );
  const firstModuleScript = output.match(
    /\s*<script[^>]+type=["']module["'][^>]*><\/script>/
  );
  if (firstModuleScript?.index !== undefined) {
    return `${output.slice(0, firstModuleScript.index)}\n${scriptTag}${output.slice(firstModuleScript.index)}`;
  }
  if (output.includes("</head>")) {
    return output.replace("</head>", `${scriptTag}\n</head>`);
  }
  return `${output}\n<script src="./${scriptName}"></script>\n`;
}

html = html
  .replace(/\b(href|src)="\/(logo\.svg[^"]*)"/g, '$1="./$2"')
  .replace(/\b(href|src)="\/(manifest\.webmanifest[^"]*)"/g, '$1="./$2"');
html = injectHeadScript(html, "qiming-native-bridge.js");
html = injectHeadScript(html, "qiming-native-compat.js");
writeFileSync(htmlPath, html, "utf8");

writeFileSync(
  join(targetDir, "app-build.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: "vue-pure-admin-max app h5",
      route: "./index.html#/home"
    },
    null,
    2
  ),
  "utf8"
);

console.log(`Synced ${distDir} -> ${targetDir}`);
