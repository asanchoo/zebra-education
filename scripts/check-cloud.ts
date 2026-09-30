import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
const users = JSON.parse(
  await fs.readFile(".data/cloud-test-users.json", "utf8"),
) as { id: string; role: string; email: string; password: string }[];
const student = users.find((u) => u.role === "student")!,
  teacher = users.find((u) => u.role === "teacher")!;
async function client(u: typeof student) {
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await db.auth.signInWithPassword({
    email: u.email,
    password: u.password,
  });
  if (error) throw error;
  return db;
}
const [s, t] = await Promise.all([client(student), client(teacher)]);
const ok = (r: { error: unknown }) => {
  if (r.error) throw r.error;
};
const lid = "hello-name";
for (const table of ["attempts", "drafts", "extras"])
  ok(await admin.from(table).delete().eq("student_id", student.id));
try {
  const keys = await s.from("answer_keys").select("*");
  ok(keys);
  assert.equal(keys.data!.length, 0, "Student sees no keys");
  const forbidden = await s
    .from("attempts")
    .insert({ id: randomUUID(), data: {} });
  assert.ok(forbidden.error, "Direct attempt write denied");
  const profiles = await s.from("profiles").select("data");
  ok(profiles);
  assert.ok(
    profiles.data!.every(
      (p) => p.data.id === student.id || p.data.id === teacher.id,
    ),
    "No unrelated profiles",
  );
  const answers = {
    "hello-c1": "Hello!",
    "hello-g1": "  ＮＡＭＥ  ",
    "hello-c2": "What is your name?",
    "hello-g2": "Nice",
    "hello-w1": "Hello! My name is Amina.",
  };
  const command = { lessonId: lid, version: 1, id: randomUUID(), answers };
  const first = await s.rpc("submit_attempt", { command });
  ok(first);
  assert.equal(first.data.autoScore, 4);
  assert.equal(first.data.status, "pending");
  const repeat = await s.rpc("submit_attempt", { command });
  ok(repeat);
  assert.equal(repeat.data.id, first.data.id);
  const stale = await s.rpc("submit_attempt", {
    command: { ...command, id: randomUUID(), version: 99 },
  });
  assert.ok(stale.error?.message.includes("LESSON_CHANGED"));
  const second = await s.rpc("submit_attempt", {
    command: { ...command, id: randomUUID() },
  });
  ok(second);
  const third = await s.rpc("submit_attempt", {
    command: { ...command, id: randomUUID() },
  });
  assert.ok(third.error?.message.includes("NO_ATTEMPTS"));
  const studentReview = await s.rpc("review_attempt", {
    command: {
      attemptId: first.data.id,
      score: 5,
      feedback: "spoof",
      returned: false,
    },
  });
  assert.ok(studentReview.error);
  const review = await t.rpc("review_attempt", {
    command: {
      attemptId: second.data.id,
      score: 3,
      feedback: "Please check spelling.",
      returned: true,
    },
  });
  ok(review);
  assert.equal(review.data.status, "returned");
  const extra = await s.rpc("submit_attempt", {
    command: { ...command, id: randomUUID() },
  });
  ok(extra);
  assert.equal(extra.data.number, 3);
  const forged = await s.rpc("save_entities", {
    changes: {
      extras: [
        {
          id: "forged",
          data: {
            id: "forged",
            studentId: student.id,
            lessonId: lid,
            count: 999,
          },
        },
      ],
    },
  });
  assert.ok(forged.error);
  const { data: release } = await admin
    .from("releases")
    .select("*")
    .eq("lesson_id", lid)
    .single();
  ok(await admin.from("releases").delete().eq("id", release.id));
  try {
    const closed = await s.from("lessons").select("data").eq("id", lid);
    ok(closed);
    assert.equal(closed.data!.length, 0);
    const catalog = await s.rpc("lesson_catalog");
    ok(catalog);
    assert.equal(
      catalog.data.find((l: { id: string }) => l.id === lid).blocks.length,
      0,
    );
    const noSubmit = await s.rpc("submit_attempt", {
      command: { ...command, id: randomUUID() },
    });
    assert.ok(noSubmit.error?.message.includes("FORBIDDEN"));
  } finally {
    ok(
      await admin
        .from("releases")
        .insert({ id: release.id, data: release.data }),
    );
  }
  console.log(
    "Cloud checks passed: RLS, hidden keys, grading, idempotency, versions, attempt limits, teacher review, closed lessons.",
  );
} finally {
  for (const table of ["attempts", "drafts", "extras"])
    ok(await admin.from(table).delete().eq("student_id", student.id));
}
