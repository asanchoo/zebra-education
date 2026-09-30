import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createSeed } from "./seed";
import {
  AppError,
  canOpen,
  enrolled,
  managesCourse,
  managesStudent,
  courseForLesson,
} from "./domain";
import { configured, demoEnabled, serverClient } from "./supabase";
import type { Profile, Store, Workspace, Role } from "./types";
const secret =
  process.env.DEMO_SESSION_SECRET || randomBytes(32).toString("hex");
const file = path.join(process.cwd(), ".data", "demo.json");
let queue = Promise.resolve();
export async function demoLogin(role: Role) {
  if (!demoEnabled()) throw new AppError("DEMO_DISABLED", 403);
  const id = role + "-demo";
  const sig = createHmac("sha256", secret).update(id).digest("hex");
  (await cookies()).set("zebra_demo", id + "." + sig, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 86400,
  });
}
export async function currentUser(): Promise<Profile | null> {
  if (demoEnabled()) {
    const token = (await cookies()).get("zebra_demo")?.value;
    const [id, sig] = token?.split(".") ?? [];
    if (id && sig) {
      const expected = createHmac("sha256", secret).update(id).digest("hex");
      if (
        sig.length === expected.length &&
        timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
      ) {
        const s = await loadDemo();
        return s.profiles.find((p) => p.id === id && p.active) ?? null;
      }
    }
    return null;
  }
  if (!configured()) return null;
  const db = await serverClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return null;
  const { data: row } = await db
    .from("profiles")
    .select("data")
    .eq("id", data.user.id)
    .single();
  return row?.data?.active ? (row.data as Profile) : null;
}
async function loadDemo(): Promise<Store> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    return createSeed();
  }
}
export const tables = [
  "profiles",
  "courses",
  "modules",
  "lessons",
  "groups",
  "enrollments",
  "releases",
  "drafts",
  "attempts",
  "extras",
] as const;
export async function loadStore(): Promise<Store> {
  if (demoEnabled()) return loadDemo();
  const db = await serverClient();
  const entries = await Promise.all(
    tables.map(async (table) => {
      const { data, error } = await db.from(table).select("data");
      if (error) throw new AppError("DATABASE_UNAVAILABLE", 503);
      return [table, data.map((row) => row.data)] as const;
    }),
  );
  const { data, error } = await db.from("answer_keys").select("lesson_id,keys");
  if (error) throw new AppError("DATABASE_UNAVAILABLE", 503);
  const { data: catalog, error: catalogError } = await db.rpc("lesson_catalog");
  if (catalogError) throw new AppError("DATABASE_UNAVAILABLE", 503);
  const s = {
    revision: 0,
    ...Object.fromEntries(entries),
    lessons: catalog,
  } as Store;
  for (const l of s.lessons)
    l.keys = data.find((k) => k.lesson_id === l.id)?.keys ?? {};
  return s;
}
export async function mutate<T>(run: (s: Store) => T | Promise<T>): Promise<T> {
  if (!demoEnabled()) throw new AppError("DEMO_DISABLED", 403);
  const job = queue.then(async () => {
    const s = await loadDemo();
    const result = await run(s);
    s.revision++;
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temp = file + ".tmp";
    await fs.writeFile(temp, JSON.stringify(s));
    await fs.rename(temp, file);
    return result;
  });
  queue = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
}
export function publicWorkspace(s: Store, u: Profile): Workspace {
  const courses = s.courses.filter((c) =>
    u.role === "student"
      ? enrolled(s, u.id, c.id).length > 0
      : managesCourse(s, u, c.id),
  );
  const courseIds = new Set(courses.map((c) => c.id));
  const modules = s.modules.filter((m) => courseIds.has(m.courseId));
  const moduleIds = new Set(modules.map((m) => m.id));
  const lessons = s.lessons
    .filter(
      (l) => moduleIds.has(l.moduleId) && (u.role !== "student" || l.published),
    )
    .map((l) => {
      const { keys: _keys, ...publicLesson } = l;
      void _keys;
      return u.role === "student" && !canOpen(s, u, l)
        ? { ...publicLesson, blocks: [] }
        : publicLesson;
    });
  const lessonIds = new Set(lessons.map((l) => l.id));
  const groups = s.groups.filter(
    (g) =>
      u.role === "admin" || g.teacherId === u.id || g.studentIds.includes(u.id),
  );
  const groupIds = new Set(groups.map((g) => g.id));
  const ids = new Set([
    u.id,
    ...groups.flatMap((g) => g.studentIds),
    ...courses.map((c) => c.teacherId),
  ]);
  const attempts = s.attempts.filter((a) =>
    u.role === "student"
      ? a.studentId === u.id
      : lessonIds.has(a.lessonId) && managesStudent(s, u, a.studentId),
  );
  return {
    revision: s.revision,
    user: u,
    demo: demoEnabled(),
    profiles: s.profiles.filter(
      (p) =>
        u.role === "admin" ||
        (u.role === "student"
          ? p.id === u.id || courses.some((c) => c.teacherId === p.id)
          : ids.has(p.id)),
    ),
    courses,
    modules,
    lessons,
    groups: groups.map((g) =>
      u.role === "student" ? { ...g, studentIds: [u.id] } : g,
    ),
    enrollments: s.enrollments.filter(
      (e) =>
        courseIds.has(e.courseId) &&
        (u.role !== "student" ||
          e.studentId === u.id ||
          groupIds.has(e.groupId ?? "")),
    ),
    releases: s.releases.filter((r) => groupIds.has(r.groupId)),
    drafts: s.drafts.filter((d) => d.studentId === u.id),
    attempts,
    extras: s.extras.filter((e) =>
      u.role === "student"
        ? e.studentId === u.id
        : managesStudent(s, u, e.studentId),
    ),
  };
}
export async function persistEntities(before: Store, after: Store) {
  const db = await serverClient();
  const changes: Record<string, unknown[]> = {};
  for (const table of tables) {
    if (["attempts", "drafts"].includes(table)) continue;
    const rows = after[table].filter(
      (row) =>
        JSON.stringify(row) !==
        JSON.stringify(before[table].find((old) => old.id === row.id)),
    );
    const removed =
      table === "releases"
        ? before.releases
            .filter((old) => !after.releases.some((row) => row.id === old.id))
            .map((row) => ({ id: row.id, delete: true, data: row }))
        : [];
    if (rows.length || removed.length)
      changes[table] = [
        ...removed,
        ...rows.map((row) => {
          if (table === "lessons") {
            const { keys, ...data } = row as Store["lessons"][number];
            return { id: row.id, data, keys };
          }
          return { id: row.id, data: row };
        }),
      ];
  }
  const { error } = await db.rpc("save_entities", { changes });
  if (error) throw new AppError("SAVE_FAILED", 409);
}
export async function protectedLesson(id: string, u: Profile) {
  const s = await loadStore();
  const l = s.lessons.find((l) => l.id === id);
  if (!l || !canOpen(s, u, l)) throw new AppError("FORBIDDEN", 403);
  return { s, l, course: courseForLesson(s, l)! };
}
