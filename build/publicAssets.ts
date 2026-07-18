import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
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

// The standalone VRM page is intentionally kept outside the main Vite graph.
// Copy only the browser modules it imports so production does not need the full
// node_modules tree while the page remains independently loadable.
const VIRTUAL_PEOPLE_DEPENDENCY_MAPPINGS = [
  {
    source: resolve("node_modules/three/build"),
    target: "node_modules/three/build"
  },
  {
    source: resolve("node_modules/three/examples/jsm"),
    target: "node_modules/three/examples/jsm"
  },
  {
    source: resolve("node_modules/@pixiv/three-vrm/lib"),
    target: "node_modules/@pixiv/three-vrm/lib"
  },
  {
    source: resolve("node_modules/pinyin-pro/dist"),
    target: "node_modules/pinyin-pro/dist"
  }
];

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
    return isWithinDirectory(sourceDir, candidate) && isDeployableFile(candidate);
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

      for (const asset of VIRTUAL_PEOPLE_DEPENDENCY_MAPPINGS) {
        if (!existsSync(asset.source)) continue;
        const source = realpathSync(asset.source);
        const target = join(distDir, asset.target);
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
    }
  };
}
