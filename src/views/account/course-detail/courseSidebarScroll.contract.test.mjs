import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = relativePath =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const sidebar = read("CourseSidebar.vue");
const courseDetail = read("../course-detail.vue");

test("mobile course sidebar follows the page-level scroll container and window", () => {
  assert.match(
    sidebar,
    /\.closest<HTMLElement>\(\s*"\.course-detail-root"\s*\)/
  );
  assert.match(
    sidebar,
    /courseRoot\?\.closest<HTMLElement>\("\.el-scrollbar__wrap"\)/
  );
  assert.match(
    sidebar,
    /primaryScrollContainer\?\.addEventListener\(\s*"scroll",\s*scheduleMobileScrollState,\s*\{[\s\S]*?passive: true/
  );
  assert.match(
    sidebar,
    /window\.addEventListener\("scroll", handleWindowScroll/
  );
  assert.match(sidebar, /unbindPrimaryScrollContainer\(\)/);
  assert.match(
    sidebar,
    /primaryScrollContainer\?\.scrollTop \?\? getWindowScrollTop\(\)/
  );
  assert.doesNotMatch(
    sidebar,
    /Math\.max\(getWindowScrollTop\(\), primaryScrollContainer/
  );
  assert.doesNotMatch(sidebar, /document\.addEventListener\("scroll"/);
});

test("mobile course sidebar collapse state drives the content top offset", () => {
  assert.match(sidebar, /const MOBILE_COLLAPSE_DISTANCE = 72/);
  assert.match(
    sidebar,
    /scrollTop - mobileExpandAnchor\.value >= MOBILE_COLLAPSE_DISTANCE/
  );
  assert.match(
    sidebar,
    /qiming:course-sidebar-collapse-change[\s\S]*collapsed: mobileCollapsed\.value/
  );
  assert.match(
    courseDetail,
    /sidebarEl\?\.classList\.contains\("mobile-collapsed"\)/
  );
  assert.match(
    courseDetail,
    /Math\.max\(headerBottom, sidebarCollapsed \? 0 : sidebarBottom\)/
  );
  assert.match(
    courseDetail,
    /const minimumOffset = sidebarCollapsed \? 92 : 156/
  );
  assert.match(
    courseDetail,
    /window\.addEventListener\([\s\S]*"qiming:course-sidebar-collapse-change",[\s\S]*handleCourseSidebarCollapseChange/
  );
  assert.match(
    courseDetail,
    /window\.removeEventListener\([\s\S]*"qiming:course-sidebar-collapse-change",[\s\S]*handleCourseSidebarCollapseChange/
  );
});
