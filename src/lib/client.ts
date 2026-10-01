import { canOpen } from "./domain";
import type { Locale, PublicLesson, Workspace, BlockKind } from "@/lib/types";
import type { LucideIcon } from "lucide-react";
import {
  FileText,
  ImageIcon,
  Headphones,
  Video,
  ListChecks,
  TextCursorInput,
  PenLine,
} from "lucide-react";
import { translator } from "@/lib/i18n";
export type T = ReturnType<typeof translator>;
export const icons: Record<BlockKind, LucideIcon> = {
  text: FileText,
  image: ImageIcon,
  audio: Headphones,
  video: Video,
  choice: ListChecks,
  gap: TextCursorInput,
  writing: PenLine,
};
export async function api(payload: unknown) {
  const res = await fetch("/api/workspace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "SERVER_ERROR");
  return json;
}
export const date = (value: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "kk-KZ", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Almaty",
  }).format(new Date(value));
export const latest = (w: Workspace, id: string) =>
  w.attempts
    .filter((a) => a.lessonId === id && a.studentId === w.user.id)
    .sort((a, b) => b.number - a.number)[0];
export function isOpen(w: Workspace, l: PublicLesson) {
  return canOpen(w, w.user, l, Date.parse(w.serverTime));
}
export function completedIds(w: Workspace) {
  return new Set(
    w.lessons
      .filter((l) => {
        const a = latest(w, l.id);
        return a && a.status !== "returned";
      })
      .map((l) => l.id),
  );
}
export function openingTime(w: Workspace, l: PublicLesson) {
  const cid = w.modules.find((m) => m.id === l.moduleId)?.courseId;
  const enrollments = w.enrollments.filter(
    (e) =>
      e.courseId === cid &&
      (e.studentId === w.user.id ||
        w.groups.some(
          (g) => g.id === e.groupId && g.studentIds.includes(w.user.id),
        )),
  );
  const releases = w.releases.filter(
    (r) =>
      r.lessonId === l.id && enrollments.some((e) => e.groupId === r.groupId),
  );
  const groupTime = enrollments.some((e) => e.mode === "self")
    ? 0
    : Math.min(...releases.map((r) => (r.opensAt ? Date.parse(r.opensAt) : 0)));
  const time = Math.max(
    l.availableAt ? Date.parse(l.availableAt) : 0,
    groupTime,
  );
  return Number.isFinite(time) && time > Date.parse(w.serverTime)
    ? new Date(time).toISOString()
    : undefined;
}
export const dateTime = (value: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "kk-KZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Almaty",
  }).format(new Date(value));
