import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = relativePath =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const sidebar = read("CourseSidebar.vue");
const courseDetail = read("../course-detail.vue");

test("mobile course sidebar follows only the page-level scroll container", () => {
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
    /primaryScrollContainer\?\.addEventListener\(\s*"scroll",\s*scheduleMobileScrollState/
  );
  assert.match(
    sidebar,
    /primaryScrollContainer\?\.scrollTop \?\? getWindowScrollTop\(\)/
  );
  assert.match(
    sidebar,
    /window\.addEventListener\("scroll", handleWindowScroll/
  );
  assert.doesNotMatch(sidebar, /document\.addEventListener\("scroll"/);
  assert.doesNotMatch(sidebar, /querySelectorAll<HTMLElement>\([^)]*scroll/);
});

test("mobile course sidebar collapse state drives the content top offset", () => {
  assert.match(sidebar, /const MOBILE_COLLAPSE_DISTANCE = 72/);
  assert.match(
    sidebar,
    /scrollTop - mobileExpandAnchor\.value >= MOBILE_COLLAPSE_DISTANCE/
  );
  assert.match(
    sidebar,
    /scrollTop <= MOBILE_TOP_RESET[\s\S]*mobileCollapsed\.value = false/
  );
  assert.match(
    sidebar,
    /const handleMobileToggle = \(\) => \{[\s\S]*mobileCollapsed\.value = false;[\s\S]*mobileExpandAnchor\.value = getEffectiveScrollTop\(\)/
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
});
