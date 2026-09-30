import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
const users = JSON.parse(
  await fs.readFile(".data/cloud-test-users.json", "utf8"),
) as { role: string; email: string; password: string }[];
const teacher = users.find((u) => u.role === "teacher")!,
  student = users.find((u) => u.role === "student")!;
const db = createClient(url, key, { auth: { persistSession: false } }),
  s = createClient(url, key, { auth: { persistSession: false } });
await db.auth.signInWithPassword(teacher);
await s.auth.signInWithPassword(student);
const id = randomUUID(),
  b = randomUUID();
const lesson = {
    id,
    moduleId: "hello",
    title: { ru: "Cloud editor test", kk: "Cloud editor test" },
    description: { ru: "", kk: "" },
    minutes: 10,
    position: 50,
    attemptLimit: 2,
    published: true,
    version: 1,
    blocks: [
      {
        id: b,
        type: "choice",
        title: "Choose hello",
        content: "",
        options: ["Hello", "Bye"],
        points: 1,
      },
    ],
  },
  keys = { [b]: { accepted: ["Hello"] } };
try {
  let result = await db.rpc("save_entities", {
    changes: { lessons: [{ id, data: lesson, keys }] },
  });
  if (result.error) throw result.error;
  const visible = await db.from("lessons").select("data").eq("id", id).single();
  assert.ok(visible.data);
  const hidden = await s.from("lessons").select("id").eq("id", id);
  assert.equal(hidden.data!.length, 0);
  result = await db.rpc("save_entities", {
    changes: {
      lessons: [
        {
          id,
          data: {
            ...lesson,
            version: 2,
            title: { ru: "Changed", kk: "Changed" },
          },
          keys,
        },
      ],
    },
  });
  if (result.error) throw result.error;
  result = await db.rpc("save_entities", {
    changes: { lessons: [{ id, data: { ...lesson, version: 2 }, keys }] },
  });
  assert.ok(result.error?.message.includes("LESSON_CHANGED"));
  const { data: group } = await admin
    .from("groups")
    .select("data")
    .eq("id", "beginners")
    .single();
  assert.ok(group);
  const release = {
    id: group.data.id + ":" + id,
    groupId: group.data.id,
    lessonId: id,
    homework: true,
  };
  result = await db.rpc("save_entities", {
    changes: { releases: [{ id: release.id, data: release }] },
  });
  if (result.error) throw result.error;
  const released = await s.from("lessons").select("id").eq("id", id);
  assert.equal(released.data!.length, 1);
  result = await db.rpc("save_entities", {
    changes: { releases: [{ id: release.id, delete: true, data: release }] },
  });
  if (result.error) throw result.error;
  const closed = await s.from("lessons").select("id").eq("id", id);
  assert.equal(closed.data!.length, 0);
  console.log(
    "Cloud editor checks passed: create, publish, edit, optimistic concurrency, group release and close.",
  );
} finally {
  await admin.from("releases").delete().eq("lesson_id", id);
  await admin.from("answer_keys").delete().eq("lesson_id", id);
  await admin.from("lessons").delete().eq("id", id);
}
