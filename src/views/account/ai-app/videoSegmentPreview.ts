export interface VideoSegmentPreviewLike {
  video_id?: string;
  video_url?: string;
  preview_url?: string;
  file_url?: string;
  url?: string;
}

export interface VideoAnalysisLocator {
  courseId?: number;
  chapterId?: number;
  hourId?: number;
  fileName?: string;
}

export interface VideoCourseHour {
  hourId?: number;
  resourceId?: number;
  title?: string;
  rType?: string;
  fileUrl?: string;
}

export interface VideoCourseChapter {
  chapterId?: number;
  hourList?: VideoCourseHour[];
}

export interface VideoCourseDetail {
  courseChapterList?: VideoCourseChapter[];
}

export interface VideoCourseCandidate {
  chapterId: number;
  hourId: number;
  resourceId?: number;
  title: string;
  rType: string;
  fileUrl: string;
}

export interface VideoTaskLocatorLike {
  taskId?: string;
  hourId?: number;
  filePath?: string | null;
  fileName?: string;
}

const clean = (value?: string | null) => String(value || "").trim();

const normalizeId = (value?: string | number | null) =>
  clean(String(value || ""));

const normalizedFileName = (value?: string | null) => {
  const source = clean(value).split(/[?#]/)[0].replace(/\\/g, "/");
  const fileName = source.split("/").pop() || "";
  try {
    return decodeURIComponent(fileName).trim().toLowerCase();
  } catch {
    return fileName.trim().toLowerCase();
  }
};

const normalizeLessonText = (value?: string | null) =>
  clean(value)
    .toLowerCase()
    .replace(/^.*\//, "")
    .replace(/\.[a-z0-9]{2,6}$/i, "")
    .replace(/[\s_\-—–()（）\[\]【】《》:：'"`·]/g, "")
    .replace(/^第?\d+(\.\d+)?[章节课讲]?/, "");

const extractLessonIndex = (value?: string | null) => {
  const source = clean(value).toLowerCase();
  const triple = source.match(
    /(\d{1,3})\s*[._-]\s*(\d{1,3})\s*[._-]\s*(\d{1,3})/
  );
  if (triple) {
    return `${Number(triple[1])}.${Number(triple[2])}.${Number(triple[3])}`;
  }
  const pair = source.match(/(\d{1,2})\s*[._-]\s*(\d{1,2})/);
  if (pair) return `${Number(pair[1])}.${Number(pair[2])}`;
  const chinese = source.match(
    /第\s*(\d{1,2})\s*章[^\d]{0,6}第\s*(\d{1,2})\s*[节课讲]/
  );
  return chinese ? `${Number(chinese[1])}.${Number(chinese[2])}` : "";
};

const isLikelySameLesson = (left?: string | null, right?: string | null) => {
  const leftIndex = extractLessonIndex(left);
  const rightIndex = extractLessonIndex(right);
  if (leftIndex && rightIndex) {
    if (leftIndex === rightIndex) return true;
    const leftParts = leftIndex.split(".");
    const rightParts = rightIndex.split(".");
    return (
      leftParts.length !== rightParts.length &&
      leftParts.slice(0, 2).join(".") === rightParts.slice(0, 2).join(".")
    );
  }

  const normalizedLeft = normalizeLessonText(left);
  const normalizedRight = normalizeLessonText(right);
  return Boolean(
    normalizedLeft &&
      normalizedRight &&
      (normalizedLeft === normalizedRight ||
        normalizedLeft.includes(normalizedRight) ||
        normalizedRight.includes(normalizedLeft))
  );
};

const normalizeVideoPath = (value?: string | null) => {
  const source = clean(value);
  if (!source) return "";
  try {
    return decodeURIComponent(new URL(source).pathname).replace(/^\/+/, "");
  } catch {
    return source.split(/[?#]/)[0].replace(/^\/+/, "");
  }
};

const isLikelyVideoHour = (hour: VideoCourseHour) => {
  const descriptor = `${hour.rType || ""} ${hour.title || ""} ${
    hour.fileUrl || ""
  }`.toLowerCase();
  return (
    descriptor.includes("视频") ||
    /(^|[^a-z])(video|mp4|webm|mov|m4v|mkv|avi)([^a-z]|$)/.test(descriptor)
  );
};

const courseVideoCandidates = (
  detail: VideoCourseDetail | null | undefined
): VideoCourseCandidate[] =>
  (detail?.courseChapterList || []).flatMap(chapter =>
    (chapter.hourList || [])
      .filter(hour => clean(hour.fileUrl))
      .map(hour => ({
        chapterId: Number(chapter.chapterId || 0),
        hourId: Number(hour.hourId || 0),
        resourceId: Number(hour.resourceId || 0) || undefined,
        title: clean(hour.title),
        rType: clean(hour.rType),
        fileUrl: clean(hour.fileUrl)
      }))
  );

export function directVideoSegmentUrl(segment: VideoSegmentPreviewLike) {
  const explicitUrl =
    clean(segment.video_url) ||
    clean(segment.preview_url) ||
    clean(segment.file_url) ||
    clean(segment.url);
  if (explicitUrl) return explicitUrl;

  const videoId = clean(segment.video_id);
  return /^(?:https?:\/\/|\/|blob:)/i.test(videoId) ? videoId : "";
}

export function listCourseVideoCandidates(
  detail: VideoCourseDetail | null | undefined,
  locator: VideoAnalysisLocator = {}
) {
  const allCandidates = courseVideoCandidates(detail);
  const chapterId = Number(locator.chapterId || 0);
  const chapterCandidates = chapterId
    ? allCandidates.filter(candidate => candidate.chapterId === chapterId)
    : [];
  const scopedCandidates = chapterCandidates.length
    ? chapterCandidates
    : allCandidates;
  const videoCandidates = scopedCandidates.filter(candidate =>
    isLikelyVideoHour(candidate)
  );
  const videoCandidateSet = new Set(videoCandidates);
  const candidates = videoCandidates.length
    ? [
        ...videoCandidates,
        ...scopedCandidates.filter(
          candidate => !videoCandidateSet.has(candidate)
        )
      ]
    : scopedCandidates;
  const matchingTitle = locator.fileName
    ? candidates.filter(candidate =>
        isLikelySameLesson(locator.fileName, candidate.title)
      )
    : [];
  if (!matchingTitle.length) return candidates;
  const matches = new Set(matchingTitle);
  return [
    ...matchingTitle,
    ...candidates.filter(candidate => !matches.has(candidate))
  ];
}

export function videoTaskMatchesCourseCandidate(
  task: VideoTaskLocatorLike | null | undefined,
  candidate: VideoCourseCandidate,
  expectedTaskId: string
) {
  if (!task || normalizeId(task.taskId) !== normalizeId(expectedTaskId)) {
    return false;
  }

  const returnedHourId = Number(task.hourId || 0);
  if (returnedHourId > 0) return returnedHourId === candidate.hourId;

  const taskPath = normalizeVideoPath(task.filePath);
  const candidatePath = normalizeVideoPath(candidate.fileUrl);
  if (
    taskPath &&
    candidatePath &&
    (taskPath === candidatePath ||
      taskPath.endsWith(`/${candidatePath}`) ||
      candidatePath.endsWith(`/${taskPath}`))
  ) {
    return true;
  }

  return (
    normalizedFileName(task.fileName) ===
      normalizedFileName(candidate.fileUrl) ||
    isLikelySameLesson(task.fileName, candidate.title)
  );
}

export function findCourseVideoUrl(
  detail: VideoCourseDetail | null | undefined,
  locator: VideoAnalysisLocator = {},
  videoId?: string
) {
  const playable = courseVideoCandidates(detail);
  if (!playable.length) return "";

  const targetHourId = normalizeId(locator.hourId);
  if (targetHourId) {
    const exactHour = playable.find(
      candidate => normalizeId(candidate.hourId) === targetHourId
    );
    if (exactHour) return exactHour.fileUrl;
  }

  const normalizedVideoId = normalizeId(videoId);
  if (/^\d+$/.test(normalizedVideoId)) {
    const exactId = playable.find(
      candidate =>
        normalizeId(candidate.hourId) === normalizedVideoId ||
        normalizeId(candidate.resourceId) === normalizedVideoId
    );
    if (exactId) return exactId.fileUrl;
  }

  const targetChapterId = Number(locator.chapterId || 0);
  const chapterCandidates = targetChapterId
    ? playable.filter(candidate => candidate.chapterId === targetChapterId)
    : playable;
  const targetFileName = normalizedFileName(locator.fileName);
  if (targetFileName) {
    const fileMatches = chapterCandidates.filter(
      candidate => normalizedFileName(candidate.fileUrl) === targetFileName
    );
    if (fileMatches.length === 1) return fileMatches[0].fileUrl;

    const titleMatches = chapterCandidates.filter(candidate =>
      isLikelySameLesson(locator.fileName, candidate.title)
    );
    if (titleMatches.length === 1) return titleMatches[0].fileUrl;
  }

  const chapterVideos = chapterCandidates.filter(candidate =>
    isLikelyVideoHour(candidate)
  );
  if (chapterVideos.length === 1) {
    return chapterVideos[0].fileUrl;
  }

  const courseVideos = playable.filter(candidate =>
    isLikelyVideoHour(candidate)
  );
  return courseVideos.length === 1 ? courseVideos[0].fileUrl : "";
}
