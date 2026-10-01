import type { Attempt, Release, Workspace } from "./types";
export const hasOpened = (value?: string, now = Date.now()) =>
  !value || Date.parse(value) <= now;
export const schoolInput = (value?: string) =>
  value
    ? new Date(Date.parse(value) + 5 * 3600_000).toISOString().slice(0, 16)
    : "";
export const schoolInstant = (value: string) =>
  value ? new Date(value.slice(0, 16) + ":00+05:00").toISOString() : undefined;
export function homeworkFor(w: Workspace, now = Date.now()) {
  const eligible = w.releases.filter(
    (r) =>
      r.homework &&
      hasOpened(r.opensAt, now) &&
      w.lessons.some((l) => l.id === r.lessonId) &&
      w.groups.some(
        (g) => g.id === r.groupId && g.studentIds.includes(w.user.id),
      ),
  );
  const result: Release[] = [];
  for (const r of eligible) {
    const i = result.findIndex((x) => x.lessonId === r.lessonId);
    if (i < 0) result.push(r);
    else if (
      !r.dueAt ||
      (result[i].dueAt && Date.parse(r.dueAt) > Date.parse(result[i].dueAt!))
    )
      result[i] = r;
  }
  const latest = new Map<string, Attempt>();
  for (const attempt of w.attempts) {
    if (
      attempt.studentId === w.user.id &&
      attempt.number > (latest.get(attempt.lessonId)?.number ?? 0)
    )
      latest.set(attempt.lessonId, attempt);
  }
  const submitted = (id: string) => {
    const attempt = latest.get(id);
    return Number(!!attempt && attempt.status !== "returned");
  };
  return result.sort(
    (a, b) =>
      submitted(a.lessonId) - submitted(b.lessonId) ||
      (Date.parse(a.dueAt ?? "") || Infinity) -
        (Date.parse(b.dueAt ?? "") || Infinity),
  );
}
