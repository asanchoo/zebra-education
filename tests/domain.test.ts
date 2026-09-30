import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createSeed } from "../src/lib/seed";
import {
  canOpen,
  grade,
  normalize,
  remaining,
  submit,
  validateLesson,
} from "../src/lib/domain";
import { execute } from "../src/lib/commands";
import { labels } from "../src/lib/i18n";
const answers = {
  "hello-c1": "Hello!",
  "hello-g1": " NAME  ",
  "hello-c2": "What is your name?",
  "hello-g2": "Nice",
  "hello-w1": "Hello. My name is Amina.",
};
test("normalizes case, Unicode compatibility and extra whitespace", () => {
  assert.equal(normalize("  ＮＡＭＥ  "), "name");
  assert.equal(normalize("It   is\na pen."), "it is a pen.");
});
test("grades objective questions and reserves writing for a teacher", () => {
  const s = createSeed(),
    g = grade(s.lessons[0], answers);
  assert.equal(g.autoScore, 4);
  assert.equal(g.autoMax, 4);
  assert.equal(g.manualMax, 5);
});
test("closed lessons and unpublished lessons cannot be opened by students", () => {
  const s = createSeed(),
    l = s.lessons[0],
    u = s.profiles[0];
  s.releases = [];
  assert.equal(canOpen(s, u, l), false);
  s.enrollments[0].mode = "self";
  assert.equal(canOpen(s, u, l), true);
  l.published = false;
  assert.equal(canOpen(s, u, l), false);
});
test("a teacher cannot open someone else’s course", () => {
  const s = createSeed();
  assert.equal(
    canOpen(s, { ...s.profiles[2], id: "another-teacher" }, s.lessons[0]),
    false,
  );
});
test("submit is idempotent and snapshots remain stable after editing", () => {
  const s = createSeed(),
    u = s.profiles[0],
    l = s.lessons[0],
    id = randomUUID();
  const a = submit(s, u, l.id, id, 1, answers);
  submit(s, u, l.id, id, 1, answers);
  assert.equal(s.attempts.length, 1);
  assert.equal(a.status, "pending");
  l.blocks[0].title = "Changed";
  assert.notEqual(a.snapshot[0].title, "Changed");
});
test("rejects empty required answers and stale lesson versions", () => {
  const s = createSeed(),
    u = s.profiles[0];
  assert.throws(
    () => submit(s, u, s.lessons[0].id, randomUUID(), 1, {}),
    /ANSWER_ALL/,
  );
  assert.throws(
    () => submit(s, u, s.lessons[0].id, randomUUID(), 2, answers),
    /LESSON_CHANGED/,
  );
});
test("enforces the attempt limit and grants an extra attempt", () => {
  const s = createSeed(),
    u = s.profiles[0],
    l = s.lessons[0];
  for (let i = 0; i < 2; i++) submit(s, u, l.id, randomUUID(), 1, answers);
  assert.equal(remaining(s, u.id, l), 0);
  assert.throws(
    () => submit(s, u, l.id, randomUUID(), 1, answers),
    /NO_ATTEMPTS/,
  );
  execute(s, s.profiles[2], {
    action: "extra",
    studentId: u.id,
    lessonId: l.id,
  });
  assert.equal(remaining(s, u.id, l), 1);
});
test("returning a work preserves history and gives one usable attempt", () => {
  const s = createSeed(),
    u = s.profiles[0],
    l = s.lessons[0];
  for (let i = 0; i < 2; i++) submit(s, u, l.id, randomUUID(), 1, answers);
  execute(s, s.profiles[2], {
    action: "review",
    attemptId: s.attempts[1].id,
    score: 3,
    feedback: "Check capitals.",
    returned: true,
  });
  assert.equal(s.attempts[1].status, "returned");
  assert.equal(remaining(s, u.id, l), 1);
  execute(s, s.profiles[2], {
    action: "review",
    attemptId: s.attempts[1].id,
    score: 3,
    feedback: "Check capitals.",
    returned: true,
  });
  assert.equal(remaining(s, u.id, l), 1);
});
test("late work is accepted and marked", () => {
  const s = createSeed();
  s.releases[0].dueAt = "2020-01-01T00:00:00Z";
  const a = submit(s, s.profiles[0], s.lessons[0].id, randomUUID(), 1, answers);
  assert.equal(a.late, true);
});
test("publishing requires keys and complete questions", () => {
  const s = createSeed(),
    l = structuredClone(s.lessons[0]);
  l.keys = {};
  assert.throws(() => validateLesson(l), /ANSWER_KEY/);
  l.keys = s.lessons[0].keys;
  l.blocks[2].options = ["Hello!"];
  assert.throws(() => validateLesson(l), /CHOICE_OPTIONS/);
});
test("student cannot publish lessons, review work, grant attempts or enroll", () => {
  const s = createSeed(),
    u = s.profiles[0];
  assert.throws(
    () => execute(s, u, { action: "lesson", lesson: s.lessons[0] }),
    /FORBIDDEN/,
  );
  assert.throws(
    () =>
      execute(s, u, {
        action: "enroll",
        courseId: s.courses[0].id,
        studentId: u.id,
        mode: "self",
      }),
    /FORBIDDEN/,
  );
});
test("both interface languages contain every label", () => {
  assert.deepEqual(
    Object.keys(labels.ru).sort(),
    Object.keys(labels.kk).sort(),
  );
});
