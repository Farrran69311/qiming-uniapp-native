# iOS Native Acceptance Matrix

This matrix tracks the iOS native App validation scope for the uni-app/HBuilder
shell. Work should stay on `/Volumes/KINGSTON` whenever possible.

## Validation Workflow

- Build the H5 payload for the native shell with `pnpm native:build:ios`.
- Run route smoke checks with screenshots:
  - `pnpm native:smoke -- --timeout 25`
  - `pnpm native:smoke:interactions -- --timeout 25`
  - `pnpm native:smoke:deep -- --timeout 25`
- Review generated screenshots under `.native-smoke/screenshots/`.
- Run `pnpm native:doctor` before simulator/device work.
- When full Xcode and a simulator or real iOS device are available, repeat the
  same screen matrix through HBuilderX/iOS Simulator and record the result in
  the Desktop worklog.

## Student App

| Area | Route | Current automated check | iOS acceptance notes |
| --- | --- | --- | --- |
| Home | `/account?menu=home` | `native:smoke`, `native:smoke:interactions` | Native mobile account layout and bottom nav. |
| Courses | `/account?menu=course` | `native:smoke`, `native:smoke:interactions` | Course cards must fit iPhone viewport. |
| Course detail | `/course/:id` | Planned | Needs native/demo data fallback before stable screenshot validation. |
| Homework detail | `/account/homework-detail` | Planned | Needs native/demo data fallback before stable screenshot validation. |
| Exam detail | `/account/exam-detail` | Planned | Needs native/demo data fallback before stable screenshot validation. |
| AI App | `/account/ai-app?mode=student` | `native:smoke`, `native:smoke:interactions` | Student AI workspace keeps account bottom nav. |
| Cloud disk | `/account?menu=cloud-disk` | `native:smoke`, `native:smoke:interactions` | Horizontal account menu state is checked. |
| Notifications | `/account?menu=notification` | `native:smoke`, `native:smoke:interactions` | Horizontal account menu state is checked. |
| To-do | `/account?menu=todo` | `native:smoke` | Needs later click-level task validation. |
| Virtual lab | `/account?menu=virtual-lab` | `native:smoke` | Needs visual asset and interaction validation. |
| Competition | `/account?menu=competition` | `native:smoke` | Needs event-card interaction validation. |
| Exam center | `/account?menu=exam-center` | `native:smoke`, `native:smoke:interactions` | Account embedded view. |
| Student paper list | `/student-exam-center/list` | `native:smoke:deep` | Deep full-layout route. |
| Student paper detail | `/student-exam-center/detail/:id` | `native:smoke:deep` | Detail view and start action visibility. |
| Exam taking | `/student-exam-center/do/:id` | `native:smoke:deep` | Full-screen answer flow, answer card, submit button. |
| Exam result | `/exam-paper/result/:submissionId` | `native:smoke:deep` | Score summary and answer detail. |
| Profile | `/account?menu=profile` | `native:smoke`, `native:smoke:interactions` | Account profile page with bottom nav. |

## Teacher App

| Area | Route | Current automated check | iOS acceptance notes |
| --- | --- | --- | --- |
| Workbench | `/welcome/index` | `native:smoke`, `native:smoke:interactions` | Teacher role bootstrap and mobile shell. |
| Course list | `/course/list` | `native:smoke`, `native:smoke:interactions` | Bottom nav target. |
| Course category | `/course/category` | `native:smoke` | Mobile category list selector checked. |
| Lesson plans | `/course/teacherplan` | `native:smoke`, `native:smoke:interactions` | Bottom nav target. |
| Homework and exams | `/course/assessment` | `native:smoke`, `native:smoke:interactions` | Bottom nav target. |
| AI animation | `/course/animation` | `native:smoke` | Mobile layout selector checked. |
| Video analysis | `/course/video-analysis` | `native:smoke` | Mobile layout selector checked. |
| Discussion review | `/course/discussion/review` | `native:smoke` | Mobile discussion list selector checked. |
| Exam overview | `/exam-paper/index` | `native:smoke` | Dashboard overview. |
| My papers | `/exam-paper/my-papers` | `native:smoke` | Mobile paper list selector checked. |
| Paper templates | `/exam-paper/templates` | `native:smoke` | Template list. |
| Grading list | `/exam-paper/grading` | `native:smoke` | Mobile grading list selector checked. |
| Grading detail | `/exam-paper/grading/:id` | `native:smoke:deep` | Manual score flow visibility. |
| Paper editor new | `/exam-paper/editor` | `native:smoke:deep` | Full-screen editor. |
| Paper editor edit | `/exam-paper/editor/:id` | `native:smoke:deep` | Mock-backed edit load. |
| Statistics | `/exam-paper/statistics` | `native:smoke` | Chart/card layout. |
| Question bank | `/exam-paper/question-bank` | `native:smoke` | Mobile question list selector checked. |
| AI App | `/ai-app/workspace` | `native:smoke`, `native:smoke:interactions` | Teacher AI workspace with bottom nav. |
| Account settings | `/account-settings` | `native:smoke` | Standalone account page. |

## Admin App

| Area | Route | Current automated check | iOS acceptance notes |
| --- | --- | --- | --- |
| Workbench | `/welcome/index` | `native:smoke`, `native:smoke:interactions` | Admin role bootstrap and mobile shell. |
| User management | `/user/list` | `native:smoke`, `native:smoke:interactions` | Bottom nav target. |
| Course management | `/course/list` | `native:smoke`, `native:smoke:interactions` | Bottom nav target. |
| Course category | `/course/category` | `native:smoke` | Mobile category list selector checked. |
| Discussion review | `/course/discussion/review` | `native:smoke` | Mobile discussion list selector checked. |
| Exam overview | `/exam-paper/index` | `native:smoke` | Shared exam dashboard. |
| Question bank | `/exam-paper/question-bank` | `native:smoke` | Shared question-bank mobile list. |
| AI App | `/ai-app/workspace` | `native:smoke`, `native:smoke:interactions` | Admin AI workspace with bottom nav. |
| Assessment | `/course/assessment` | `native:smoke`, `native:smoke:interactions` | Bottom nav target. |

## Current Native Tooling Blockers

- Xcode 27 beta is being installed by Xcodes.app. Xcodes.app itself is in
  `/Applications/Xcodes.app`, its install path is `/Volumes/KINGSTON/Xcodes`,
  and the user reported it is currently on the third install step. Do not run
  simulator validation until Xcodes finishes producing a complete `Xcode.app`.
- Full Xcode is not currently selected; `xcrun simctl` is unavailable under the
  active Command Line Tools developer directory.
- iOS certificates and provisioning profiles are not present.
- HBuilderX is installed on the external SSD and can build the uni-app native
  resource package, but simulator/device launch requires the Xcode chain above.
