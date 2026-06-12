import type { Plugin } from "vite";
import gradient from "gradient-string";
import { getPackageSize, __APP_INFO__ } from "./utils";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import dayjs, { type Dayjs } from "dayjs";
import duration from "dayjs/plugin/duration";
import boxen, { type Options as BoxenOptions } from "boxen";
dayjs.extend(duration);

const welcomeMessage = gradient(["cyan", "magenta"]).multiline(
  `您好！欢迎使用 长春工业大学 计算机学院 启明智教项目 

IntellEdu.com

Copyright (c) 2026 Est. 吉林省云创迅捷软件开发有限公司 All Rights Reserved. `
);

const boxenOptions: BoxenOptions = {
  padding: 1,
  borderColor: "cyan",
  borderStyle: "round"
};

export function viteBuildInfo(): Plugin {
  let config: { command: string };
  let startTime: Dayjs;
  let endTime: Dayjs;
  let outDir: string;

  const emitVersionFile = () => {
    const distDir = join(process.cwd(), outDir);
    const versionFile = join(distDir, "version.json");
    const external = process.env.EXTERNAL?.trim() || "";
    let normalizedExternal: string | Record<string, unknown> = external;

    if (external) {
      try {
        normalizedExternal = JSON.parse(external);
      } catch {
        normalizedExternal = external;
      }
    }

    mkdirSync(distDir, { recursive: true });
    writeFileSync(
      versionFile,
      JSON.stringify(
        {
          version: process.env.VERSION || __APP_INFO__.pkg.version,
          external: normalizedExternal
        },
        null,
        2
      )
    );
  };

  return {
    name: "vite:buildInfo",
    configResolved(resolvedConfig) {
      config = resolvedConfig;
      outDir = resolvedConfig.build?.outDir ?? "dist";
    },
    buildStart() {
      console.log(boxen(welcomeMessage, boxenOptions));
      if (config.command === "build") {
        startTime = dayjs(new Date());
      }
    },
    writeBundle() {
      if (config.command === "build") {
        emitVersionFile();
      }
    },
    closeBundle() {
      if (config.command === "build") {
        endTime = dayjs(new Date());
        getPackageSize({
          folder: outDir,
          callback: (size: string) => {
            console.log(
              boxen(
                gradient(["cyan", "magenta"]).multiline(
                  `🎉 恭喜打包完成（总用时${dayjs
                    .duration(endTime.diff(startTime))
                    .format("mm分ss秒")}，打包后的大小为${size}）`
                ),
                boxenOptions
              )
            );
          }
        });
      }
    }
  };
}
