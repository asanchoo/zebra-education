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
  if (w.user.role !== "student") return true;
  const courseId = w.modules.find((m) => m.id === l.moduleId)?.courseId;
  return w.enrollments.some(
    (e) =>
      e.courseId === courseId &&
      (e.studentId === w.user.id ||
        w.groups.some(
          (g) => g.id === e.groupId && g.studentIds.includes(w.user.id),
        )) &&
      (e.mode === "self" ||
        w.releases.some((r) => r.groupId === e.groupId && r.lessonId === l.id)),
  );
}
