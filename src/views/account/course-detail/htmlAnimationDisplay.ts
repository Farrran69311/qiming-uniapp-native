import {
  getHtmlAnimationDisplay,
  htmlAnimationScopeKey,
  type HtmlAnimationScope,
  type HtmlAnimationScopeType
} from "@/api/htmlAnimation";

interface CourseHourLike {
  hourId?: number;
  title?: string;
  name?: string;
}

interface CourseChapterLike {
  chapterId: number;
  name?: string;
  chapterName?: string;
  hourList?: CourseHourLike[];
}

export interface HtmlAnimationDisplayItem {
  scopeKey: string;
  courseId: number;
  chapterId: number;
  chapterName: string;
  scopeType: HtmlAnimationScopeType;
  hourId?: number;
  hourName?: string;
  version: string;
  url: string;
  coverUrl?: string;
  previewUrl?: string;
  previewVideoUrl?: string;
  available?: boolean;
  message?: string;
  status?: string;
}

interface DisplayTarget {
  scope: HtmlAnimationScope;
  chapterName: string;
  hourName?: string;
}

const getErrorMessage = (error: any) =>
  error?.response?.data?.message ||
  error?.response?.data?.msg ||
  error?.message ||
  "";

const buildUnavailableItem = (
  target: DisplayTarget,
  message: string
): HtmlAnimationDisplayItem => ({
  ...target.scope,
  scopeKey: htmlAnimationScopeKey(target.scope),
  chapterName: target.chapterName,
  hourName: target.hourName,
  version: "",
  url: "",
  available: false,
  message: message || "暂无可展示动画",
  status:
    message.includes("对象不存在") || message.includes("版本对象")
      ? "missing"
      : "unavailable"
});

const loadTarget = async (
  target: DisplayTarget
): Promise<HtmlAnimationDisplayItem | null> => {
  try {
    const response = await getHtmlAnimationDisplay(target.scope);
    const data = response?.data;
    if (data?.url) {
      return {
        ...target.scope,
        scopeKey: htmlAnimationScopeKey(target.scope),
        chapterName: target.chapterName,
        hourName: target.hourName,
        version: data.version,
        url: data.url,
        coverUrl: data.coverUrl || data.previewUrl,
        previewUrl: data.previewUrl || data.coverUrl,
        previewVideoUrl: data.previewVideoUrl,
        available: data.available !== false,
        message: data.message,
        status: "ready"
      };
    }

    // Keep one chapter placeholder for the existing empty-state behavior, but
    // do not fill the student grid with an unavailable card for every lesson.
    if (target.scope.scopeType === "chapter" && data?.available === false) {
      return buildUnavailableItem(
        target,
        data.message || "暂无可用 HTML 动画版本"
      );
    }
  } catch (error: any) {
    if (
      target.scope.scopeType === "chapter" &&
      error?.response?.status === 404
    ) {
      return buildUnavailableItem(target, getErrorMessage(error));
    }
  }

  return null;
};

export async function loadHtmlAnimationDisplayItems(
  courseId: number,
  chapters: CourseChapterLike[]
) {
  const targets: DisplayTarget[] = chapters.flatMap(chapter => {
    const chapterName = chapter.name || chapter.chapterName || "未命名章节";
    const chapterTarget: DisplayTarget = {
      scope: {
        courseId,
        chapterId: chapter.chapterId,
        scopeType: "chapter"
      },
      chapterName
    };
    const hourTargets = (chapter.hourList || [])
      .filter(hour => Number(hour.hourId || 0) > 0)
      .map<DisplayTarget>(hour => ({
        scope: {
          courseId,
          chapterId: chapter.chapterId,
          scopeType: "hour",
          hourId: Number(hour.hourId)
        },
        chapterName,
        hourName: hour.title || hour.name || `课时 ${hour.hourId}`
      }));
    return [chapterTarget, ...hourTargets];
  });

  const results = await Promise.all(targets.map(loadTarget));
  const uniqueItems = new Map<string, HtmlAnimationDisplayItem>();
  results.forEach(item => {
    if (item && !uniqueItems.has(item.scopeKey)) {
      uniqueItems.set(item.scopeKey, item);
    }
  });
  return Array.from(uniqueItems.values());
}
