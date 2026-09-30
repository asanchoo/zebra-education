import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, Store } from "./types";
import { AppError } from "./domain";
import { adminClient } from "./supabase";
export function deleteDemoProfile(s: Store, actor: Profile, id: string) {
  const target = s.profiles.find((p) => p.id === id);
  if (actor.role !== "admin" || actor.id === id || target?.role === "admin")
    throw new AppError("FORBIDDEN", 403);
  if (!target) throw new AppError("INVALID_PROFILE");
  for (const course of s.courses)
    if (course.teacherId === id) course.teacherId = actor.id;
  for (const group of s.groups) {
    if (group.teacherId === id) group.teacherId = actor.id;
    group.studentIds = group.studentIds.filter((sid) => sid !== id);
  }
  s.enrollments = s.enrollments.filter((e) => e.studentId !== id);
  s.drafts = s.drafts.filter((d) => d.studentId !== id);
  s.attempts = s.attempts.filter((a) => a.studentId !== id);
  s.extras = s.extras.filter((e) => e.studentId !== id);
  s.profiles = s.profiles.filter((p) => p.id !== id);
}
export async function deleteCloudProfile(db: SupabaseClient, id: string) {
  const prepare = await db.rpc("delete_school_profile", {
    target_id: id,
    finalize: false,
  });
  if (prepare.error)
    throw new AppError(
      prepare.error.message.includes("FORBIDDEN")
        ? "FORBIDDEN"
        : "INVALID_PROFILE",
      403,
    );
  const removed = await adminClient().auth.admin.deleteUser(id);
  if (removed.error && removed.error.code !== "user_not_found")
    throw new AppError("SAVE_FAILED");
  const finish = await db.rpc("delete_school_profile", {
    target_id: id,
    finalize: true,
  });
  if (finish.error) throw new AppError("SAVE_FAILED");
}
