import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "node:fs";
import { randomBytes } from "node:crypto";
import { createSeed } from "../src/lib/seed";
process.loadEnvFile(".env.local");
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false } },
);
await fs.mkdir(".data", { recursive: true });
const adminEmail = process.env.ZEBRA_ADMIN_EMAIL;
if (!adminEmail) throw new Error("Set ZEBRA_ADMIN_EMAIL in .env.local");
const { data: users, error: usersError } = await db.auth.admin.listUsers();
if (usersError) throw usersError;
let admin = users.users.find((u) => u.email === adminEmail);
if (!admin) {
  const { data, error } = await db.auth.admin.createUser({
    email: adminEmail,
    email_confirm: true,
  });
  if (error) throw error;
  admin = data.user;
}
const seed = createSeed();
const teacherId = admin!.id;
const profiles = [
  {
    id: teacherId,
    name: "Администратор ZEBRA",
    email: adminEmail,
    role: "admin",
    active: true,
  },
];
let testing: { id: string; role: string; email: string; password: string }[] =
  [];
try {
  testing = JSON.parse(
    await fs.readFile(".data/cloud-test-users.json", "utf8"),
  );
} catch {}
if (process.argv.includes("--test-users")) {
  for (const role of ["student", "teacher"]) {
    let user = testing.find((u) => u.role === role);
    if (!user) {
      const email = `zebra-${role}-${randomBytes(4).toString("hex")}@example.com`,
        password = randomBytes(24).toString("base64url");
      const { data, error } = await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) throw error;
      user = { id: data.user.id, role, email, password };
      testing.push(user);
    }
    profiles.push({
      id: user.id,
      name: role === "student" ? "Тестовый ученик" : "Тестовый преподаватель",
      email: user.email,
      role,
      active: true,
    });
  }
  await fs.writeFile(".data/cloud-test-users.json", JSON.stringify(testing), {
    mode: 0o600,
  });
}
for (const p of profiles) {
  const { error } = await db.from("profiles").upsert({ id: p.id, data: p });
  if (error) throw error;
}
const courseTeacher =
  testing.find((u) => u.role === "teacher")?.id ?? teacherId;
seed.courses[0].teacherId = courseTeacher;
seed.groups[0].teacherId = courseTeacher;
seed.groups[0].studentIds = testing
  .filter((u) => u.role === "student")
  .map((u) => u.id);
for (const table of [
  "courses",
  "modules",
  "lessons",
  "groups",
  "enrollments",
  "releases",
] as const) {
  for (const row of seed[table]) {
    const { data: existing } = await db
      .from(table)
      .select("id")
      .eq("id", row.id)
      .maybeSingle();
    if (existing) continue;
    let payload: unknown = row;
    let keys: unknown;
    if (table === "lessons") {
      const l = row as (typeof seed.lessons)[number];
      const { keys: k, ...d } = l;
      payload = d;
      keys = k;
    }
    const { error } = await db
      .from(table)
      .insert({ id: row.id, data: payload });
    if (error) throw error;
    if (keys) {
      const { error } = await db
        .from("answer_keys")
        .insert({ lesson_id: row.id, keys });
      if (error) throw error;
    }
  }
}
console.log(
  "School administrator, original example lessons and test accounts are ready. No credentials printed.",
);
