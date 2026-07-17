import { cpSync, existsSync, mkdirSync, realpathSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Plugin } from "vite";

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
