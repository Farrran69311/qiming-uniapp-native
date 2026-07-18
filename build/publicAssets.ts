import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { Plugin } from "vite";

// EdgeOne Pages rejects a deployment when any individual file is larger than
// 25 MB. Keep the decimal limit here so local builds and CI produce the same artifact.
const EDGEONE_MAX_FILE_BYTES = 25_000_000;

const PUBLIC_ASSET_WHITELIST = [
  "favicon.ico",
  "logo.svg",
  "manifest.webmanifest",
  "sw.js",
  "platform-config.json",
  "campus-2d-bg.svg",
  "icons",
  "wasm",
  "demo-resources",
  "demos",
  "virtualpeopleanimation",
  "virtual-people",
  "homepage",
  "publicbackgroundpreset"
];

const STATIC_ASSET_MAPPINGS = [
  {
    source: resolve("src/assets/course-detail-images"),
    target: "static/images"
  },
  {
    source: resolve("src/assets/img"),
    target: "static/img"
  }
];

// EdgeOne Pages may treat a top-level `node_modules` path as an application
// route and return the SPA fallback instead of the requested JavaScript module.
// Keep the standalone viewer's small runtime under its own public directory.
// Only copy the files that the viewer imports (and the Draco decoder files it
// loads at runtime), rather than publishing the complete Three.js examples tree.
const VIRTUAL_PEOPLE_DEPENDENCY_FILES = [
  [
    "node_modules/three/build/three.module.js",
    "vendor/three/build/three.module.js"
  ],
  [
    "node_modules/three/build/three.core.js",
    "vendor/three/build/three.core.js"
  ],
  [
    "node_modules/three/examples/jsm/controls/OrbitControls.js",
    "vendor/three/examples/jsm/controls/OrbitControls.js"
  ],
  [
    "node_modules/three/examples/jsm/loaders/DRACOLoader.js",
    "vendor/three/examples/jsm/loaders/DRACOLoader.js"
  ],
  [
    "node_modules/three/examples/jsm/loaders/GLTFLoader.js",
    "vendor/three/examples/jsm/loaders/GLTFLoader.js"
  ],
  [
    "node_modules/three/examples/jsm/loaders/FBXLoader.js",
    "vendor/three/examples/jsm/loaders/FBXLoader.js"
  ],
  [
    "node_modules/three/examples/jsm/utils/BufferGeometryUtils.js",
    "vendor/three/examples/jsm/utils/BufferGeometryUtils.js"
  ],
  [
    "node_modules/three/examples/jsm/curves/NURBSCurve.js",
    "vendor/three/examples/jsm/curves/NURBSCurve.js"
  ],
  [
    "node_modules/three/examples/jsm/curves/NURBSUtils.js",
    "vendor/three/examples/jsm/curves/NURBSUtils.js"
  ],
  [
    "node_modules/three/examples/jsm/libs/fflate.module.js",
    "vendor/three/examples/jsm/libs/fflate.module.js"
  ],
  [
    "node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.js",
    "vendor/three/examples/jsm/libs/draco/gltf/draco_decoder.js"
  ],
  [
    "node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.wasm",
    "vendor/three/examples/jsm/libs/draco/gltf/draco_decoder.wasm"
  ],
  [
    "node_modules/three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js",
    "vendor/three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js"
  ],
  [
    "node_modules/@pixiv/three-vrm/lib/three-vrm.module.js",
    "vendor/three-vrm/three-vrm.module.js"
  ],
  ["node_modules/pinyin-pro/dist/index.mjs", "vendor/pinyin-pro/index.mjs"]
].map(([source, target]) => ({
  source: resolve(source),
  target
}));

function isDeployableFile(filePath: string) {
  if (!existsSync(filePath)) return false;
  const file = statSync(filePath);
  return file.isFile() && file.size <= EDGEONE_MAX_FILE_BYTES;
}

function isWithinDirectory(rootDir: string, candidate: string) {
  const relativePath = relative(rootDir, candidate);
  return Boolean(
    relativePath &&
      relativePath !== ".." &&
      !relativePath.startsWith(`..${sep}`) &&
      !relativePath.startsWith(sep)
  );
}

function copyDirectoryWithinLimit(sourceDir: string, targetDir: string) {
  if (!existsSync(sourceDir)) return;

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = join(sourceDir, entry.name);
    const targetPath = join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryWithinLimit(sourcePath, targetPath);
      continue;
    }

    if (!entry.isFile()) continue;
    const size = statSync(sourcePath).size;
    if (size > EDGEONE_MAX_FILE_BYTES) {
      console.warn(
        `[vite:copyPublicAssets] skipped oversized asset (${size} bytes): ${sourcePath}`
      );
      continue;
    }

    mkdirSync(dirname(targetPath), { recursive: true });
    cpSync(sourcePath, targetPath, { force: true });
  }
}

function copyFileWithinLimit(sourcePath: string, targetPath: string) {
  if (!isDeployableFile(sourcePath)) {
    if (existsSync(sourcePath)) {
      console.warn(
        `[vite:copyPublicAssets] skipped oversized or invalid asset: ${sourcePath}`
      );
    }
    return;
  }

  mkdirSync(dirname(targetPath), { recursive: true });
  cpSync(sourcePath, targetPath, { force: true });
}

function copyVirtualPeopleAssets(sourceDir: string, targetDir: string) {
  copyDirectoryWithinLimit(sourceDir, targetDir);

  const sourceManifestPath = join(sourceDir, "motions.json");
  if (!existsSync(sourceManifestPath)) return;

  let manifest: Record<string, any>;
  try {
    manifest = JSON.parse(readFileSync(sourceManifestPath, "utf8"));
  } catch {
    // Keep the original parse error visible to the page instead of hiding it.
    return;
  }

  const isDeployableManifestPath = (value: unknown) => {
    if (typeof value !== "string" || !value.trim()) return false;
    const candidate = resolve(sourceDir, value);
    return (
      isWithinDirectory(sourceDir, candidate) && isDeployableFile(candidate)
    );
  };

  if (!isDeployableManifestPath(manifest.vrm)) manifest.vrm = "";
  if (Array.isArray(manifest.backgrounds)) {
    manifest.backgrounds = manifest.backgrounds.filter(item =>
      isDeployableManifestPath(item?.path)
    );
  }
  if (Array.isArray(manifest.motions)) {
    manifest.motions = manifest.motions.filter(item =>
      isDeployableManifestPath(item?.path)
    );
  }

  mkdirSync(targetDir, { recursive: true });
  writeFileSync(
    join(targetDir, "motions.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
}

function rewriteVirtualPeopleRuntime(targetDir: string) {
  const indexPath = join(targetDir, "index.html");
  if (!existsSync(indexPath)) return;

  const replacements = new Map([
    [
      "../node_modules/three/examples/jsm/libs/draco/gltf/",
      "./vendor/three/examples/jsm/libs/draco/gltf/"
    ],
    [
      "/node_modules/three/examples/jsm/libs/draco/gltf/",
      "./vendor/three/examples/jsm/libs/draco/gltf/"
    ],
    [
      "../node_modules/three/build/three.module.js",
      "./vendor/three/build/three.module.js"
    ],
    [
      "/node_modules/three/build/three.module.js",
      "./vendor/three/build/three.module.js"
    ],
    ["../node_modules/three/examples/jsm/", "./vendor/three/examples/jsm/"],
    ["/node_modules/three/examples/jsm/", "./vendor/three/examples/jsm/"],
    [
      "../node_modules/@pixiv/three-vrm/lib/three-vrm.module.js",
      "./vendor/three-vrm/three-vrm.module.js"
    ],
    [
      "/node_modules/@pixiv/three-vrm/lib/three-vrm.module.js",
      "./vendor/three-vrm/three-vrm.module.js"
    ],
    [
      "../node_modules/pinyin-pro/dist/index.mjs",
      "./vendor/pinyin-pro/index.mjs"
    ],
    ["/node_modules/pinyin-pro/dist/index.mjs", "./vendor/pinyin-pro/index.mjs"]
  ]);

  let html = readFileSync(indexPath, "utf8");
  for (const [from, to] of replacements) html = html.replaceAll(from, to);
  writeFileSync(indexPath, html, "utf8");
}

export function copyPublicAssets(): Plugin {
  let outDir = "dist";

  return {
    name: "vite:copyPublicAssets",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    writeBundle() {
      const rootDir = process.cwd();
      const publicDir = resolve(rootDir, "public");
      const distDir = resolve(rootDir, outDir);

      for (const asset of PUBLIC_ASSET_WHITELIST) {
        const source = join(publicDir, asset);
        const target = join(distDir, asset);

        if (!existsSync(source)) continue;
        if (asset === "virtual-people") {
          copyVirtualPeopleAssets(source, target);
          continue;
        }
        const sourceStat = statSync(source);

        if (sourceStat.isDirectory()) {
          cpSync(source, target, {
            recursive: true,
            force: true
          });
        } else {
          mkdirSync(dirname(target), { recursive: true });
          cpSync(source, target, { force: true });
        }
      }

      for (const asset of STATIC_ASSET_MAPPINGS) {
        if (!existsSync(asset.source)) continue;
        cpSync(asset.source, join(distDir, asset.target), {
          recursive: true,
          force: true
        });
      }

      const virtualPeopleDist = join(distDir, "virtual-people");
      for (const asset of VIRTUAL_PEOPLE_DEPENDENCY_FILES) {
        copyFileWithinLimit(
          asset.source,
          join(virtualPeopleDist, asset.target)
        );
      }
      rewriteVirtualPeopleRuntime(virtualPeopleDist);
    }
  };
}
