import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "node:fs";
import assert from "node:assert/strict";
process.loadEnvFile(".env.local");
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false } },
);
const tests = JSON.parse(
  await fs.readFile(".data/cloud-test-users.json", "utf8"),
) as { id: string; email: string }[];
const owner = await db
  .from("profiles")
  .select("id,data")
  .eq("data->>email", process.env.ZEBRA_ADMIN_EMAIL!)
  .single();
assert.ifError(owner.error);
assert.equal(owner.data!.data.role, "admin");
const ids = new Set(tests.map((t) => t.id));
for (const table of ["courses", "groups"] as const) {
  const rows = await db.from(table).select("id,data");
  assert.ifError(rows.error);
  for (const row of rows.data!) {
    const data = { ...row.data };
    if (ids.has(data.teacherId)) data.teacherId = owner.data!.id;
    if (table === "groups")
      data.studentIds = data.studentIds.filter((id: string) => !ids.has(id));
    const result = await db.from(table).update({ data }).eq("id", row.id);
    assert.ifError(result.error);
  }
}
// Sanitize the initial dictation's audio caption; the recording remains original.
const lesson = await db
  .from("lessons")
  .select("data")
  .eq("id", "dictation")
  .single();
assert.ifError(lesson.error);
const data = lesson.data!.data;
let changed = false;
for (const block of data.blocks)
  if (
    block.type === "audio" &&
    block.content !== "Listen and write the sentences you hear."
  ) {
    block.content = "Listen and write the sentences you hear.";
    changed = true;
  }
if (changed) {
  data.version += 1;
  const result = await db.from("lessons").update({ data }).eq("id", data.id);
  assert.ifError(result.error);
}
for (const user of tests) {
  assert.match(user.email, /^zebra-(student|teacher)-[a-f0-9]+@example\.com$/);
  assert.notEqual(user.id, owner.data!.id);
  for (const table of ["attempts", "drafts", "extras", "enrollments"]) {
    const result = await db.from(table).delete().eq("student_id", user.id);
    assert.ifError(result.error);
  }
  assert.ifError((await db.from("profiles").delete().eq("id", user.id)).error);
  assert.ifError((await db.auth.admin.deleteUser(user.id)).error);
}
await fs.writeFile(".data/cloud-test-users.json", "[]", { mode: 0o600 });
console.log(
  "Disposable accounts and their work removed. Sample course and group assigned to the school administrator.",
);
