import type { Store, Profile } from "./types";
import { AppError, managesCourse } from "./domain";
export function contentScope(
  s: Store,
  kind: "course" | "module" | "lesson",
  id: string,
) {
  const m =
    kind === "module"
      ? s.modules.find((m) => m.id === id)
      : s.modules.find(
          (m) => m.id === s.lessons.find((l) => l.id === id)?.moduleId,
        );
  return kind === "course" ? id : m?.courseId;
}
export function manageContent(
  s: Store,
  u: Profile,
  c: {
    kind: "course" | "module" | "lesson";
    id: string;
    operation: "hide" | "show" | "delete";
  },
) {
  const cid = contentScope(s, c.kind, c.id);
  if (!cid || !managesCourse(s, u, cid)) throw new AppError("FORBIDDEN", 403);
  const row =
    c.kind === "course"
      ? s.courses.find((r) => r.id === c.id)
      : c.kind === "module"
        ? s.modules.find((r) => r.id === c.id)
        : s.lessons.find((r) => r.id === c.id);
  if (!row) throw new AppError("NOT_FOUND", 404);
  if (c.operation !== "delete") {
    row.hidden = c.operation === "hide";
    if (c.kind === "lesson") s.lessons.find((l) => l.id === c.id)!.version++;
    return;
  }
  const mids = new Set(
    s.modules
      .filter((m) =>
        c.kind === "course"
          ? m.courseId === c.id
          : c.kind === "module" && m.id === c.id,
      )
      .map((m) => m.id),
  );
  const lids = new Set(
    s.lessons
      .filter((l) =>
        c.kind === "lesson" ? l.id === c.id : mids.has(l.moduleId),
      )
      .map((l) => l.id),
  );
  const aids = new Set(
    s.attempts.filter((a) => lids.has(a.lessonId)).map((a) => a.id),
  );
  s.notificationReads = (s.notificationReads ?? []).filter(
    (r) => !aids.has(r.attemptId),
  );
  s.attempts = s.attempts.filter((r) => !lids.has(r.lessonId));
  s.drafts = s.drafts.filter((r) => !lids.has(r.lessonId));
  s.extras = s.extras.filter((r) => !lids.has(r.lessonId));
  s.releases = s.releases.filter((r) => !lids.has(r.lessonId));
  s.lessons = s.lessons.filter((l) => !lids.has(l.id));
  s.modules = s.modules.filter((m) => !mids.has(m.id));
  if (c.kind === "course") {
    s.enrollments = s.enrollments.filter((e) => e.courseId !== c.id);
    s.courses = s.courses.filter((r) => r.id !== c.id);
  }
}
