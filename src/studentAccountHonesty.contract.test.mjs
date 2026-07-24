import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("student course views use backend filters without demo fallbacks", () => {
  const accountView = read("./views/account/index.vue");
  const courseApi = read("./api/frontend/course.ts");

  assert.doesNotMatch(accountView, /demoCourses|Math\.random\(\)/);
  assert.match(accountView, /required:\s*1/);
  assert.match(accountView, /elective:\s*2/);
  assert.match(accountView, /completed:\s*3/);
  assert.match(accountView, /incomplete:\s*4/);
  assert.match(accountView, /学习总结服务尚未接入/);
  assert.match(courseApi, /queryType\?: number/);
  assert.doesNotMatch(courseApi, /status\?: string/);
});

test("local todos are empty by default and scoped to the signed-in user", () => {
  const localTodos = read("./utils/localTodos.ts");
  const studentTodo = read("./views/account/components/Todo.vue");
  const managementTodo = read("./views/todo/index.vue");

  assert.match(localTodos, /qiming-local-todos/);
  assert.match(localTodos, /userInfo\?\.userId/);
  assert.match(localTodos, /userInfo\?\.username/);
  assert.doesNotMatch(localTodos, /vue-pure-admin-todos/);

  for (const todoView of [studentTodo, managementTodo]) {
    assert.match(todoView, /readLocalTodos/);
    assert.match(todoView, /saveLocalTodos/);
    assert.match(todoView, /本机保存/);
    assert.doesNotMatch(todoView, /initialTodos|模拟加载|setTimeout\(/);
  }
});

test("student competition never exposes fabricated rankings or results", () => {
  const competition = read("./views/account/components/Competition.vue");

  assert.match(competition, /赛事服务暂不可用/);
  assert.match(competition, /停止展示模拟排名、题目和批改结果/);
  assert.doesNotMatch(
    competition,
    /userPoints|hotEvents|leaderboard|ojProblems|securityQuestions|essayResult/
  );
  assert.doesNotMatch(competition, /setTimeout|答题完成|AI 分析中/);
});

test("student paper filters load the signed-in student's real courses", () => {
  const paperCenter = read("./views/exam-paper/student-center/index.vue");

  assert.match(paperCenter, /getFrontendCourseList/);
  assert.match(paperCenter, /course\.courseId/);
  assert.match(paperCenter, /course\.courseName/);
  assert.doesNotMatch(paperCenter, /高等数学|大学英语|计算机基础/);
  assert.doesNotMatch(paperCenter, /获取试卷列表响应/);
});
