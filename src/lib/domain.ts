import { hasOpened } from "./scheduling";
import type { Attempt, Lesson, PublicLesson, Profile, Store } from "./types";
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function normalize(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en");
}
export function courseForLesson(
  s: Pick<Store, "courses" | "modules">,
  lesson: Pick<Lesson, "moduleId">,
) {
  return s.courses.find(
    (c) => c.id === s.modules.find((m) => m.id === lesson.moduleId)?.courseId,
  );
}
export function managesCourse(
  s: Pick<Store, "courses" | "enrollments" | "groups">,
  u: Profile,
  courseId: string,
) {
  return (
    u.role === "admin" ||
    (u.role === "teacher" &&
      (s.courses.some((c) => c.id === courseId && c.teacherId === u.id) ||
        s.enrollments.some(
          (e) =>
            e.courseId === courseId &&
            s.groups.some((g) => g.id === e.groupId && g.teacherId === u.id),
        )))
  );
}
export function managesStudent(s: Store, u: Profile, studentId: string) {
  return (
    u.role === "admin" ||
    s.groups.some(
      (g) => g.teacherId === u.id && g.studentIds.includes(studentId),
    ) ||
    s.enrollments.some(
      (e) => e.studentId === studentId && managesCourse(s, u, e.courseId),
    )
  );
}
export function enrolled(
  s: Pick<Store, "enrollments" | "groups">,
  userId: string,
  courseId: string,
) {
  return s.enrollments.filter(
    (e) =>
      e.courseId === courseId &&
      (e.studentId === userId ||
        s.groups.some(
          (g) => g.id === e.groupId && g.studentIds.includes(userId),
        )),
  );
}
export function canOpen(
  s: Pick<Store, "courses" | "modules" | "enrollments" | "groups" | "releases">,
  u: Profile,
  l: PublicLesson,
  now = Date.now(),
) {
  const course = courseForLesson(s, l);
  if (!course) return false;
  if (u.role !== "student") return managesCourse(s, u, course.id);
  if (
    !l.published ||
    l.hidden ||
    course.hidden ||
    s.modules.find((m) => m.id === l.moduleId)?.hidden ||
    !hasOpened(l.availableAt, now)
  )
    return false;
  return enrolled(s, u.id, course.id).some(
    (e) =>
      e.mode === "self" ||
      s.releases.some(
        (r) =>
          r.groupId === e.groupId &&
          r.lessonId === l.id &&
          hasOpened(r.opensAt, now),
      ),
  );
}
export function remaining(s: Store, userId: string, l: Lesson) {
  return Math.max(
    0,
    l.attemptLimit +
      (s.extras.find((e) => e.studentId === userId && e.lessonId === l.id)
        ?.count ?? 0) -
      s.attempts.filter((a) => a.studentId === userId && a.lessonId === l.id)
        .length,
  );
}
export function grade(l: Lesson, answers: Record<string, string>) {
  let autoScore = 0,
    autoMax = 0,
    manualMax = 0;
  const autoResults: Record<string, boolean> = {};
  for (const b of l.blocks) {
    if (b.type === "writing") {
      manualMax += b.points ?? 1;
    } else if (b.type === "choice" || b.type === "gap") {
      const points = b.points ?? 1;
      autoMax += points;
      const correct =
        l.keys[b.id]?.accepted.some(
          (a) => normalize(a) === normalize(answers[b.id] ?? ""),
        ) ?? false;
      autoResults[b.id] = correct;
      if (correct) autoScore += points;
    }
  }
  return { autoScore, autoMax, manualMax, autoResults };
}
export function submit(
  s: Store,
  u: Profile,
  lessonId: string,
  id: string,
  version: number,
  answers: Record<string, string>,
): Attempt {
  const prior = s.attempts.find((a) => a.id === id);
  if (prior) {
    if (prior.studentId !== u.id || prior.lessonId !== lessonId)
      throw new AppError("ID_CONFLICT", 409);
    return prior;
  }
  const l = s.lessons.find((l) => l.id === lessonId);
  if (!l || u.role !== "student" || !canOpen(s, u, l))
    throw new AppError("FORBIDDEN", 403);
  if (l.version !== version) throw new AppError("LESSON_CHANGED", 409);
  if (!remaining(s, u.id, l)) throw new AppError("NO_ATTEMPTS", 409);
  const questions = l.blocks.filter((b) =>
    ["choice", "gap", "writing"].includes(b.type),
  );
  if (questions.some((b) => !answers[b.id]?.trim()))
    throw new AppError("ANSWER_ALL");
  const clean = Object.fromEntries(
    questions.map((b) => [b.id, answers[b.id].trim()]),
  );
  const marks = grade(l, clean);
  const course = courseForLesson(s, l)!;
  const es = enrolled(s, u.id, course.id);
  const assigned = s.releases.filter(
    (r) =>
      r.lessonId === l.id &&
      r.homework &&
      hasOpened(r.opensAt) &&
      es.some((e) => e.groupId === r.groupId),
  );
  const dates = assigned
    .filter((r) => r.dueAt)
    .map((r) => Date.parse(r.dueAt!));
  const now = new Date().toISOString();
  const a: Attempt = {
    id,
    studentId: u.id,
    lessonId,
    version,
    number:
      s.attempts.filter((a) => a.studentId === u.id && a.lessonId === l.id)
        .length + 1,
    submittedAt: now,
    late:
      assigned.length > 0 &&
      assigned.every((r) => r.dueAt) &&
      Date.now() > Math.max(...dates),
    answers: clean,
    snapshot: structuredClone(l.blocks),
    ...marks,
    status: marks.manualMax ? "pending" : "reviewed",
  };
  s.attempts.push(a);
  s.drafts = s.drafts.filter(
    (d) => !(d.studentId === u.id && d.lessonId === l.id),
  );
  return a;
}
export function validateLesson(l: Lesson) {
  if (!l.title.ru.trim() || !l.title.kk.trim() || !l.blocks.length)
    throw new AppError("LESSON_INCOMPLETE");
  if (new Set(l.blocks.map((b) => b.id)).size !== l.blocks.length)
    throw new AppError("DUPLICATE_BLOCK");
  for (const b of l.blocks) {
    if (!b.title.trim()) throw new AppError("BLOCK_TITLE");
    if (
      b.type === "choice" &&
      (!b.options ||
        b.options.length < 2 ||
        new Set(b.options).size !== b.options.length ||
        b.options.some((o) => !o.trim()))
    )
      throw new AppError("CHOICE_OPTIONS");
    if (
      ["choice", "gap"].includes(b.type) &&
      !l.keys[b.id]?.accepted.some((a) => a.trim())
    )
      throw new AppError("ANSWER_KEY");
    if (
      b.type === "choice" &&
      l.keys[b.id].accepted.some((a) => !b.options?.includes(a))
    )
      throw new AppError("CHOICE_KEY");
    if (["image", "audio", "video"].includes(b.type) && !b.url)
      throw new AppError("MEDIA_REQUIRED");
  }
}
