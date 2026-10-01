import type { Store, Profile, Attempt } from "./types";
import {
  AppError,
  managesCourse,
  managesStudent,
  courseForLesson,
} from "./domain";
export const notificationEvent = (a: Attempt) => a.reviewedAt ?? a.submittedAt;
export function markNotifications(
  s: Store,
  u: Profile,
  events: { attemptId: string; eventAt: string }[],
) {
  s.notificationReads ??= [];
  for (const event of events) {
    const a = s.attempts.find((a) => a.id === event.attemptId),
      l = s.lessons.find((l) => l.id === a?.lessonId);
    if (
      !a ||
      !l ||
      !(u.role === "student"
        ? a.studentId === u.id && ["reviewed", "returned"].includes(a.status)
        : a.status === "pending" &&
          managesCourse(s, u, courseForLesson(s, l)!.id) &&
          managesStudent(s, u, a.studentId))
    )
      throw new AppError("FORBIDDEN", 403);
    if (notificationEvent(a) !== event.eventAt) continue;
    const id = u.id + ":" + a.id;
    s.notificationReads = s.notificationReads.filter((r) => r.id !== id);
    s.notificationReads.push({
      id,
      userId: u.id,
      attemptId: a.id,
      eventAt: event.eventAt,
    });
  }
}
