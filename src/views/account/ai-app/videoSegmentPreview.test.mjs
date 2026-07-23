import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  directVideoSegmentUrl,
  findCourseVideoUrl,
  listCourseVideoCandidates,
  videoTaskMatchesCourseCandidate
} from "./videoSegmentPreview.ts";

const courseDetail = {
  courseChapterList: [
    {
      chapterId: 10,
      hourList: [
        {
          hourId: 101,
          resourceId: 1001,
          title: "第一讲",
          rType: "video",
          fileUrl: "https://cdn.example.test/course/first%20lesson.mp4?token=a"
        },
        {
          hourId: 102,
          resourceId: 1002,
          title: "讲义",
          rType: "pdf",
          fileUrl: "https://cdn.example.test/course/notes.pdf"
        }
      ]
    },
    {
      chapterId: 20,
      hourList: [
        {
          hourId: 201,
          resourceId: 2001,
          title: "第二讲",
          rType: "video",
          fileUrl: "https://cdn.example.test/course/second.mp4"
        },
        {
          hourId: 202,
          resourceId: 2002,
          title: "补充讲解",
          rType: "video",
          fileUrl: "https://cdn.example.test/course/extra.webm"
        }
      ]
    }
  ]
};

test("prefers the exact analyzed course hour", () => {
  assert.equal(
    findCourseVideoUrl(courseDetail, { chapterId: 20, hourId: 202 }),
    "https://cdn.example.test/course/extra.webm"
  );
});

test("falls back to an encoded file-name match inside the analyzed chapter", () => {
  assert.equal(
    findCourseVideoUrl(courseDetail, {
      chapterId: 10,
      fileName: "first lesson.mp4"
    }),
    "https://cdn.example.test/course/first%20lesson.mp4?token=a"
  );
});

test("supports numeric video IDs while keeping ambiguous chapters unresolved", () => {
  assert.equal(
    findCourseVideoUrl(courseDetail, {}, "2001"),
    courseDetail.courseChapterList[1].hourList[0].fileUrl
  );
  assert.equal(findCourseVideoUrl(courseDetail, { chapterId: 20 }), "");
});

test("uses the only video in a chapter and accepts direct segment URLs", () => {
  assert.equal(
    findCourseVideoUrl(courseDetail, { chapterId: 10 }),
    courseDetail.courseChapterList[0].hourList[0].fileUrl
  );
  assert.equal(
    directVideoSegmentUrl({
      video_id: "analysis-task-1",
      preview_url: "https://cdn.example.test/direct.mp4"
    }),
    "https://cdn.example.test/direct.mp4"
  );
  assert.equal(
    directVideoSegmentUrl({ video_id: "/media/course-video.mp4" }),
    "/media/course-video.mp4"
  );
});

test("orders likely lesson titles first when a chapter contains several videos", () => {
  const candidates = listCourseVideoCandidates(courseDetail, {
    chapterId: 20,
    fileName: "补充讲解.mp4"
  });
  assert.deepEqual(
    candidates.map(candidate => candidate.hourId),
    [202, 201]
  );
});

test("matches a video task to its exact hour or legacy object path", () => {
  const [candidate] = listCourseVideoCandidates(courseDetail, {
    chapterId: 20,
    fileName: "补充讲解.mp4"
  });
  assert.equal(
    videoTaskMatchesCourseCandidate(
      { taskId: "task-202", hourId: 202 },
      candidate,
      "task-202"
    ),
    true
  );
  assert.equal(
    videoTaskMatchesCourseCandidate(
      {
        taskId: "task-202",
        filePath: "course/extra.webm",
        fileName: "补充讲解.webm"
      },
      candidate,
      "task-202"
    ),
    true
  );
  assert.equal(
    videoTaskMatchesCourseCandidate(
      { taskId: "another-task", hourId: 202 },
      candidate,
      "task-202"
    ),
    false
  );
  assert.equal(
    videoTaskMatchesCourseCandidate(
      { taskId: "task-202", hourId: 201 },
      candidate,
      "task-202"
    ),
    false
  );
});

test("the chat card opens the shared preview at the segment start without clipping the video", async () => {
  const [chatModule, workbench, previewPane] = await Promise.all([
    readFile(new URL("./components/AiChatModule.vue", import.meta.url), "utf8"),
    readFile(new URL("./index.vue", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../../../components/PlatformResourcePreview/PlatformResourcePreviewPane.vue",
        import.meta.url
      ),
      "utf8"
    )
  ]);

  assert.match(chatModule, /emit\('preview-video-segment', segment\)/);
  assert.match(workbench, /@preview-video-segment="handleVideoSegmentPreview"/);
  assert.match(workbench, /initialTimeMs:\s*Math\.max/);
  assert.match(workbench, /getVideoAnalyzeTask/);
  assert.match(workbench, /videoTaskMatchesCourseCandidate/);
  assert.match(previewPane, /video\.currentTime\s*=\s*targetSeconds/);
  assert.doesNotMatch(previewPane, /@timeupdate|video\.pause\(\)/);
});
