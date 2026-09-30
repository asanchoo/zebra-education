import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
  AppError,
  canOpen,
  courseForLesson,
  managesCourse,
  managesStudent,
  submit,
  validateLesson,
} from "./domain";
import type { Lesson, Profile, Store } from "./types";
const localized = z.object({
  ru: z.string().max(200),
  kk: z.string().max(200),
});
const block = z.object({
  id: z.string().max(100),
  type: z.enum(["text", "image", "audio", "video", "choice", "gap", "writing"]),
  title: z.string().max(500),
  content: z.string().max(20000),
  url: z.string().max(2000).optional(),
  options: z.array(z.string().max(500)).max(10).optional(),
  points: z.number().int().min(1).max(100).optional(),
});
const lessonSchema = z.object({
  id: z.string().max(100),
  moduleId: z.string().max(100),
  title: localized,
  description: localized,
  minutes: z.number().int().min(1).max(180),
  position: z.number().int().min(0),
  attemptLimit: z.number().int().min(1).max(20),
  published: z.boolean(),
  version: z.number().int().min(1),
  blocks: z.array(block).max(60),
  keys: z.record(
    z.string(),
    z.object({ accepted: z.array(z.string().max(1000)).max(20) }),
  ),
});
export const commandSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("draft"),
    lessonId: z.string(),
    version: z.number().int(),
    answers: z.record(z.string(), z.string().max(20000)),
  }),
  z.object({
    action: z.literal("submit"),
    lessonId: z.string(),
    version: z.number().int(),
    id: z.uuid(),
    answers: z.record(z.string(), z.string().max(20000)),
  }),
  z.object({
    action: z.literal("review"),
    attemptId: z.string(),
    score: z.number().min(0),
    feedback: z.string().max(10000),
    returned: z.boolean(),
  }),
  z.object({
    action: z.literal("extra"),
    studentId: z.string(),
    lessonId: z.string(),
  }),
  z.object({ action: z.literal("lesson"), lesson: lessonSchema }),
  z.object({
    action: z.literal("release"),
    groupId: z.string(),
    lessonId: z.string(),
    open: z.boolean(),
    homework: z.boolean(),
    dueAt: z.string().datetime().optional(),
  }),
  z.object({
    action: z.literal("group"),
    id: z.string().optional(),
    name: z.string().min(1).max(100),
    teacherId: z.string(),
    studentIds: z.array(z.string()).max(500),
  }),
  z.object({
    action: z.literal("enroll"),
    courseId: z.string(),
    groupId: z.string().optional(),
    studentId: z.string().optional(),
    mode: z.enum(["group", "self"]),
  }),
  z.object({
    action: z.literal("course"),
    title: z.string().min(1).max(200),
    description: localized,
    level: z.string().max(50),
  }),
  z.object({
    action: z.literal("module"),
    courseId: z.string(),
    title: localized,
  }),
  z.object({
    action: z.literal("profile"),
    id: z.string(),
    active: z.boolean(),
    role: z.enum(["student", "teacher", "admin"]),
  }),
]);
export type Command = z.infer<typeof commandSchema>;
export function execute(s: Store, u: Profile, c: Command) {
  const requireTeacher = () => {
    if (u.role === "student") throw new AppError("FORBIDDEN", 403);
  };
  if (c.action === "submit")
    return submit(s, u, c.lessonId, c.id, c.version, c.answers);
  if (c.action === "draft") {
    const l = s.lessons.find((l) => l.id === c.lessonId);
    if (!l || u.role !== "student" || !canOpen(s, u, l))
      throw new AppError("FORBIDDEN", 403);
    if (l.version !== c.version) throw new AppError("LESSON_CHANGED", 409);
    const d = {
      id: u.id + ":" + l.id,
      studentId: u.id,
      lessonId: l.id,
      version: l.version,
      answers: c.answers,
      updatedAt: new Date().toISOString(),
    };
    s.drafts = s.drafts.filter((v) => v.id !== d.id);
    s.drafts.push(d);
    return d;
  }
  requireTeacher();
  if (c.action === "review") {
    const a = s.attempts.find((a) => a.id === c.attemptId);
    const l = s.lessons.find((l) => l.id === a?.lessonId);
    if (!a || !l || !canOpen(s, u, l) || !managesStudent(s, u, a.studentId))
      throw new AppError("FORBIDDEN", 403);
    if (c.score > a.manualMax) throw new AppError("INVALID_SCORE");
    a.manualScore = c.score;
    a.feedback = c.feedback;
    a.status = c.returned ? "returned" : "reviewed";
    a.reviewedAt = new Date().toISOString();
    if (c.returned) {
      const e = s.extras.find(
        (e) => e.studentId === a.studentId && e.lessonId === a.lessonId,
      );
      if (a.status === "returned") {
        const attempts = s.attempts.filter(
          (v) => v.studentId === a.studentId && v.lessonId === a.lessonId,
        ).length;
        const needed = Math.max(0, attempts + 1 - l.attemptLimit);
        if (e) e.count = Math.max(e.count, needed);
        else
          s.extras.push({
            id: a.studentId + ":" + a.lessonId,
            studentId: a.studentId,
            lessonId: a.lessonId,
            count: needed,
          });
      }
    }
    return a;
  }
  if (c.action === "extra") {
    const l = s.lessons.find((l) => l.id === c.lessonId);
    if (!l || !canOpen(s, u, l) || !managesStudent(s, u, c.studentId))
      throw new AppError("FORBIDDEN", 403);
    const e = s.extras.find(
      (e) => e.studentId === c.studentId && e.lessonId === c.lessonId,
    );
    if (e) e.count++;
    else
      s.extras.push({
        id: c.studentId + ":" + c.lessonId,
        studentId: c.studentId,
        lessonId: c.lessonId,
        count: 1,
      });
    return;
  }
  if (c.action === "lesson") {
    const l = c.lesson as Lesson;
    const course = courseForLesson(s, l);
    if (!course || !managesCourse(s, u, course.id))
      throw new AppError("FORBIDDEN", 403);
    const old = s.lessons.find((x) => x.id === l.id);
    if (old && old.moduleId !== l.moduleId)
      throw new AppError("FORBIDDEN", 403);
    if (old && old.version !== l.version)
      throw new AppError("LESSON_CHANGED", 409);
    if (l.published) validateLesson(l);
    for (const b of l.blocks) {
      if (b.url && !/^\/|^https:\/\//.test(b.url))
        throw new AppError("INVALID_MEDIA");
    }
    l.version = (old?.version ?? 0) + 1;
    s.lessons = s.lessons.filter((x) => x.id !== l.id);
    s.lessons.push(l);
    return l;
  }
  if (c.action === "release") {
    const g = s.groups.find((g) => g.id === c.groupId),
      l = s.lessons.find((l) => l.id === c.lessonId);
    if (
      !g ||
      !l ||
      !(u.role === "admin" || g.teacherId === u.id) ||
      !canOpen(s, u, l) ||
      !s.enrollments.some(
        (e) => e.groupId === g.id && e.courseId === courseForLesson(s, l)?.id,
      )
    )
      throw new AppError("FORBIDDEN", 403);
    const id = g.id + ":" + l.id;
    s.releases = s.releases.filter(
      (r) => !(r.groupId === g.id && r.lessonId === l.id),
    );
    if (c.open)
      s.releases.push({
        id,
        groupId: g.id,
        lessonId: l.id,
        homework: c.homework,
        dueAt: c.dueAt,
      });
    return;
  }
  if (c.action === "course") {
    const course = {
      id: randomUUID(),
      title: c.title,
      description: c.description,
      level: c.level,
      teacherId: u.id,
      color: "mint",
    };
    s.courses.push(course);
    return course;
  }
  if (c.action === "module") {
    if (!managesCourse(s, u, c.courseId)) throw new AppError("FORBIDDEN", 403);
    const m = {
      id: randomUUID(),
      courseId: c.courseId,
      title: c.title,
      position: s.modules.filter((m) => m.courseId === c.courseId).length + 1,
    };
    s.modules.push(m);
    return m;
  }
  if (u.role !== "admin") throw new AppError("FORBIDDEN", 403);
  if (c.action === "group") {
    if (
      !s.profiles.some(
        (p) => p.id === c.teacherId && p.role !== "student" && p.active,
      ) ||
      c.studentIds.some(
        (id) =>
          !s.profiles.some(
            (p) => p.id === id && p.role === "student" && p.active,
          ),
      )
    )
      throw new AppError("INVALID_MEMBERS");
    const g = {
      id: c.id ?? randomUUID(),
      name: c.name,
      teacherId: c.teacherId,
      studentIds: [...new Set(c.studentIds)],
    };
    s.groups = s.groups.filter((x) => x.id !== g.id);
    s.groups.push(g);
    return g;
  }
  if (c.action === "enroll") {
    if (
      !s.courses.some((x) => x.id === c.courseId) ||
      !!c.groupId === !!c.studentId ||
      (c.groupId && !s.groups.some((g) => g.id === c.groupId)) ||
      (c.studentId &&
        !s.profiles.some((p) => p.id === c.studentId && p.role === "student"))
    )
      throw new AppError("INVALID_ENROLLMENT");
    if (c.mode === "group" && !c.groupId)
      throw new AppError("INVALID_ENROLLMENT");
    if (
      !s.enrollments.some(
        (e) =>
          e.courseId === c.courseId &&
          e.groupId === c.groupId &&
          e.studentId === c.studentId,
      )
    )
      s.enrollments.push({
        id: randomUUID(),
        courseId: c.courseId,
        groupId: c.groupId,
        studentId: c.studentId,
        mode: c.mode,
      });
    return;
  }
  if (c.action === "profile") {
    const p = s.profiles.find((p) => p.id === c.id);
    if (!p || p.id === u.id) throw new AppError("INVALID_PROFILE");
    p.active = c.active;
    p.role = c.role;
    return p;
  }
}
