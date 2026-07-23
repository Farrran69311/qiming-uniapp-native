import { ref } from "vue";
import html2canvas from "html2canvas";
import type { CaptureArea, CaptureStatus } from "../types";

/**
 * 截图功能 Hook
 */
export function useScreenCapture() {
  const OKLCH_COLOR_REGEX = /oklch\([^()]*\)/gi;
  const BLACK_PIXEL_THRESHOLD = 24;
  const BLACK_RATIO_THRESHOLD = 0.92;
  const MEDIA_SELECTOR = "video, iframe, canvas";

  /**
   * 粗略判断截图是否几乎全黑，用于识别视频黑帧场景。
   */
  const isMostlyBlackImage = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;

    const { width, height } = canvas;
    if (!width || !height) return false;

    const imageData = ctx.getImageData(0, 0, width, height).data;
    const totalPixels = width * height;
    let blackPixels = 0;

    for (let i = 0; i < imageData.length; i += 4) {
      const alpha = imageData[i + 3];
      if (alpha === 0) continue;

      const r = imageData[i];
      const g = imageData[i + 1];
      const b = imageData[i + 2];

      if (
        r <= BLACK_PIXEL_THRESHOLD &&
        g <= BLACK_PIXEL_THRESHOLD &&
        b <= BLACK_PIXEL_THRESHOLD
      ) {
        blackPixels++;
      }
    }

    return blackPixels / totalPixels >= BLACK_RATIO_THRESHOLD;
  };

  /**
   * 判断框选区域是否命中了高风险媒体元素。
   * 这些元素在 html2canvas 下通常拿不到真实内容，直接走原生标签页截图更稳。
   */
  const areaContainsMedia = (area: CaptureArea) => {
    const areaLeft = area.x;
    const areaTop = area.y;
    const areaRight = area.x + area.width;
    const areaBottom = area.y + area.height;

    return Array.from(document.querySelectorAll(MEDIA_SELECTOR)).some(node => {
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;

      return !(
        rect.right <= areaLeft ||
        rect.left >= areaRight ||
        rect.bottom <= areaTop ||
        rect.top >= areaBottom
      );
    });
  };

  const supportsDisplayMedia = () =>
    Boolean(navigator.mediaDevices?.getDisplayMedia);

  /**
   * 使用浏览器原生屏幕捕获当前标签页，绕过 html2canvas 在视频元素上的黑屏问题。
   */
  const captureByDisplayMedia = async (area: CaptureArea): Promise<string> => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error("当前浏览器不支持屏幕捕获");
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: 30
      },
      audio: false
    });

    const stopStream = () => {
      stream.getTracks().forEach(track => track.stop());
    };

    try {
      const track = stream.getVideoTracks()[0];
      if (!track) {
        throw new Error("未获取到屏幕视频流");
      }

      const fullCanvas = document.createElement("canvas");
      const fullCtx = fullCanvas.getContext("2d");

      if (!fullCtx) {
        throw new Error("无法创建Canvas上下文");
      }

      const ImageCaptureCtor = (window as any).ImageCapture as
        | (new (track: MediaStreamTrack) => {
            grabFrame: () => Promise<ImageBitmap>;
          })
        | undefined;

      if (ImageCaptureCtor) {
        const capture = new ImageCaptureCtor(track);
        const bitmap = await capture.grabFrame();
        fullCanvas.width = bitmap.width;
        fullCanvas.height = bitmap.height;
        fullCtx.drawImage(bitmap, 0, 0);
        bitmap.close();
      } else {
        const video = document.createElement("video");
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play();

        // 给解码器一帧时间，确保拿到稳定画面。
        await new Promise(resolve => setTimeout(resolve, 120));

        fullCanvas.width = video.videoWidth;
        fullCanvas.height = video.videoHeight;
        fullCtx.drawImage(video, 0, 0, fullCanvas.width, fullCanvas.height);

        video.pause();
        video.srcObject = null;
      }

      const scaleX = fullCanvas.width / window.innerWidth;
      const scaleY = fullCanvas.height / window.innerHeight;

      const cropX = Math.max(0, Math.round(area.x * scaleX));
      const cropY = Math.max(0, Math.round(area.y * scaleY));
      const cropWidth = Math.max(1, Math.round(area.width * scaleX));
      const cropHeight = Math.max(1, Math.round(area.height * scaleY));

      const safeWidth = Math.min(cropWidth, fullCanvas.width - cropX);
      const safeHeight = Math.min(cropHeight, fullCanvas.height - cropY);

      const croppedCanvas = document.createElement("canvas");
      const croppedCtx = croppedCanvas.getContext("2d");

      if (!croppedCtx) {
        throw new Error("无法创建Canvas上下文");
      }

      croppedCanvas.width = Math.max(1, safeWidth);
      croppedCanvas.height = Math.max(1, safeHeight);

      croppedCtx.drawImage(
        fullCanvas,
        cropX,
        cropY,
        croppedCanvas.width,
        croppedCanvas.height,
        0,
        0,
        croppedCanvas.width,
        croppedCanvas.height
      );

      return croppedCanvas.toDataURL("image/png");
    } finally {
      stopStream();
    }
  };

  /**
   * 将不被 html2canvas 支持的 oklch() 转换为 rgb()，避免解析时报错
   */
  const normalizeUnsupportedColors = (clonedDoc: Document) => {
    if (!clonedDoc.body) return;

    const view = clonedDoc.defaultView || window;
    const probe = clonedDoc.createElement("span");
    probe.style.position = "fixed";
    probe.style.left = "-99999px";
    probe.style.top = "-99999px";
    clonedDoc.body.appendChild(probe);

    const toRgbColor = (colorValue: string) => {
      probe.style.color = "";
      probe.style.color = colorValue;
      return probe.style.color
        ? view.getComputedStyle(probe).color
        : colorValue;
    };

    const replaceColorFunctions = (input: string) => {
      if (!input.includes("oklch(")) return input;
      OKLCH_COLOR_REGEX.lastIndex = 0;
      return input.replace(OKLCH_COLOR_REGEX, match => toRgbColor(match));
    };

    const normalizeStyleDeclaration = (style: CSSStyleDeclaration) => {
      for (let i = 0; i < style.length; i++) {
        const prop = style.item(i);
        const value = style.getPropertyValue(prop);
        if (!value || !value.includes("oklch(")) continue;
        const nextValue = replaceColorFunctions(value);
        const priority = style.getPropertyPriority(prop);
        style.setProperty(prop, nextValue, priority);
      }
    };

    const normalizeCssRules = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        const styleRule = rule as CSSRule & { style?: CSSStyleDeclaration };
        if (styleRule.style) {
          normalizeStyleDeclaration(styleRule.style);
        }

        const groupRule = rule as CSSRule & { cssRules?: CSSRuleList };
        if (groupRule.cssRules) {
          normalizeCssRules(groupRule.cssRules);
        }
      }
    };

    // 优先处理 CSSOM，覆盖外链样式、构建产物样式和运行时注入样式
    for (const styleSheet of Array.from(clonedDoc.styleSheets)) {
      try {
        normalizeCssRules(styleSheet.cssRules);
      } catch {
        // 跨域或只读样式表会抛错，忽略后继续处理其他样式
      }
    }

    // 处理 style 标签中的 CSS 文本
    const styleTags = Array.from(clonedDoc.querySelectorAll("style"));
    styleTags.forEach(styleTag => {
      const cssText = styleTag.textContent;
      if (!cssText || !cssText.includes("oklch(")) return;
      styleTag.textContent = replaceColorFunctions(cssText);
    });

    // 处理内联 style
    const styledElements = Array.from(clonedDoc.querySelectorAll("[style]"));
    styledElements.forEach(element => {
      const styleAttr = element.getAttribute("style");
      if (!styleAttr || !styleAttr.includes("oklch(")) return;
      element.setAttribute("style", replaceColorFunctions(styleAttr));
    });

    probe.remove();
  };

  const isUnsupportedColorFunctionError = (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    return (
      message.includes("unsupported color function") ||
      message.includes("Attempting to parse an unsupported color function")
    );
  };

  // 截图状态
  const status = ref<CaptureStatus>("idle");
  // 截图结果 (base64)
  const screenshot = ref<string>("");
  // 截图区域
  const captureArea = ref<CaptureArea | null>(null);
  // 是否正在处理
  const isProcessing = ref(false);
  // 错误信息
  const error = ref<string>("");

  /**
   * 开始截图模式
   */
  const startCapture = () => {
    status.value = "capturing";
    error.value = "";
  };

  /**
   * 取消截图
   */
  const cancelCapture = () => {
    status.value = "idle";
    captureArea.value = null;
  };

  /**
   * 执行截图
   * @param area 截图区域
   */
  const captureScreen = async (area: CaptureArea): Promise<string> => {
    isProcessing.value = true;
    error.value = "";
    captureArea.value = area;

    try {
      // 先隐藏截图遮罩层
      status.value = "idle";

      // 等待DOM更新
      await new Promise(resolve => setTimeout(resolve, 100));

      if (areaContainsMedia(area) && supportsDisplayMedia()) {
        const base64 = await captureByDisplayMedia(area);
        screenshot.value = base64;
        status.value = "preview";
        return base64;
      }

      const renderCanvas = (useForeignObjectRendering: boolean) =>
        html2canvas(document.body, {
          useCORS: true,
          allowTaint: true,
          backgroundColor: null,
          scale: window.devicePixelRatio || 1,
          logging: false,
          foreignObjectRendering: useForeignObjectRendering,
          onclone: clonedDoc => {
            normalizeUnsupportedColors(clonedDoc);
          },
          // 忽略某些元素
          ignoreElements: element => {
            return (
              element.classList.contains("capture-overlay") ||
              element.classList.contains("capture-loading-overlay") ||
              element.classList.contains("ai-float-button")
            );
          }
        });

      let canvas: HTMLCanvasElement;
      try {
        // 优先走常规渲染，性能更好
        canvas = await renderCanvas(false);
      } catch (firstErr) {
        if (!isUnsupportedColorFunctionError(firstErr)) {
          throw firstErr;
        }
        // 命中颜色函数兼容问题时，降级到 foreignObjectRendering 再试一次
        canvas = await renderCanvas(true);
      }

      // 裁剪指定区域
      const croppedCanvas = document.createElement("canvas");
      const ctx = croppedCanvas.getContext("2d");

      if (!ctx) {
        throw new Error("无法创建Canvas上下文");
      }

      // 计算实际裁剪区域（考虑设备像素比）
      const scale = window.devicePixelRatio || 1;
      const x = area.x * scale;
      const y = area.y * scale;
      const width = area.width * scale;
      const height = area.height * scale;

      croppedCanvas.width = width;
      croppedCanvas.height = height;

      // 裁剪图片
      ctx.drawImage(canvas, x, y, width, height, 0, 0, width, height);

      // 转换为base64
      let base64 = croppedCanvas.toDataURL("image/png");

      // html2canvas 在某些复杂场景仍可能返回黑帧，这里保留最后一道兜底。
      if (isMostlyBlackImage(croppedCanvas)) {
        try {
          base64 = await captureByDisplayMedia(area);
        } catch (fallbackErr) {
          console.warn(
            "displayMedia 截图兜底失败，继续使用原始截图",
            fallbackErr
          );
        }
      }

      screenshot.value = base64;
      status.value = "preview";

      return base64;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "截图失败";
      status.value = "idle";
      throw err;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * 重置截图
   */
  const resetCapture = () => {
    status.value = "idle";
    screenshot.value = "";
    captureArea.value = null;
    error.value = "";
  };

  /**
   * 进入对话模式
   */
  const enterChatMode = () => {
    status.value = "chatting";
  };

  return {
    status,
    screenshot,
    captureArea,
    isProcessing,
    error,
    startCapture,
    cancelCapture,
    captureScreen,
    resetCapture,
    enterChatMode
  };
}
