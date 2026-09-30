import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import assert from "node:assert/strict";
import { deleteCloudProfile } from "../src/lib/profiles";
process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const service = createClient(url, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
const users: { id: string; client: SupabaseClient }[] = [];
const course = randomUUID(),
  moduleId = randomUUID(),
  lesson = randomUUID(),
  group = randomUUID(),
  enrollment = randomUUID(),
  object = lesson + "/" + randomUUID() + ".wav";
function ok(r: { error: unknown }) {
  assert.ifError(r.error);
}
try {
  for (const role of ["admin", "teacher", "student"]) {
    const password = randomBytes(24).toString("base64url"),
      email = `zebra-delete-${role}-${randomBytes(6).toString("hex")}@example.com`;
    const created = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    ok(created);
    const id = created.data.user!.id;
    const client = createClient(url, key, { auth: { persistSession: false } });
    users.push({ id, client });
    ok(
      await service.from("profiles").insert({
        id,
        data: { id, name: "Deletion test", email, role, active: true },
      }),
    );
    ok(await client.auth.signInWithPassword({ email, password }));
  }
  const [admin, teacher, student] = users;
  for (const table of ["courses", "groups"]) {
    const id = table === "courses" ? course : group;
    const data =
      table === "courses"
        ? {
            id,
            title: "Deletion test",
            teacherId: teacher.id,
            description: { ru: "", kk: "" },
            level: "Beginner",
          }
        : {
            id,
            name: "Deletion test",
            teacherId: teacher.id,
            studentIds: [student.id],
          };
    ok(await service.from(table).insert({ id, data }));
  }
  ok(
    await service.from("modules").insert({
      id: moduleId,
      data: {
        id: moduleId,
        courseId: course,
        title: { ru: "Test", kk: "Test" },
        position: 1,
      },
    }),
  );
  const content = {
    id: lesson,
    moduleId: moduleId,
    title: { ru: "Test", kk: "Test" },
    description: { ru: "", kk: "" },
    minutes: 5,
    position: 1,
    attemptLimit: 2,
    published: true,
    version: 1,
    blocks: [
      { id: "q", type: "gap", title: "Hello ___", content: "", points: 1 },
    ],
  };
  ok(await service.from("lessons").insert({ id: lesson, data: content }));
  ok(
    await service
      .from("answer_keys")
      .insert({ lesson_id: lesson, keys: { q: { accepted: ["Sam"] } } }),
  );
  ok(
    await service.from("enrollments").insert({
      id: enrollment,
      data: {
        id: enrollment,
        courseId: course,
        studentId: student.id,
        mode: "self",
      },
    }),
  );
  ok(
    await student.client.rpc("submit_attempt", {
      command: {
        id: randomUUID(),
        lessonId: lesson,
        version: 1,
        answers: { q: "Sam" },
      },
    }),
  );
  ok(
    await teacher.client.storage
      .from("lesson-media")
      .upload(object, await fs.readFile("public/audio/dictation-a.wav"), {
        contentType: "audio/wav",
      }),
  );
  for (const caller of [teacher, student]) {
    const denied = await caller.client.rpc("delete_school_profile", {
      target_id: student.id,
      finalize: false,
    });
    assert.match(denied.error!.message, /FORBIDDEN/);
  }
  assert.match(
    (
      await admin.client.rpc("delete_school_profile", {
        target_id: admin.id,
        finalize: false,
      })
    ).error!.message,
    /FORBIDDEN/,
  );
  await deleteCloudProfile(admin.client, student.id);
  assert.equal(
    (await service.from("attempts").select("id").eq("student_id", student.id))
      .data!.length,
    0,
  );
  assert.equal(
    (
      await service
        .from("enrollments")
        .select("id")
        .eq("student_id", student.id)
    ).data!.length,
    0,
  );
  assert.equal(
    (await service.from("groups").select("data").eq("id", group).single()).data!
      .data.studentIds.length,
    0,
  );
  assert.equal(
    (await student.client.rpc("lesson_catalog")).data?.length ?? 0,
    0,
  );
  assert.ok((await service.auth.admin.getUserById(student.id)).error);
  await deleteCloudProfile(admin.client, teacher.id);
  assert.equal(
    (await service.from("courses").select("data").eq("id", course).single())
      .data!.data.teacherId,
    admin.id,
  );
  assert.equal(
    (await service.from("groups").select("data").eq("id", group).single()).data!
      .data.teacherId,
    admin.id,
  );
  ok(
    await admin.client.storage.from("lesson-media").createSignedUrl(object, 60),
  );
  assert.ok((await service.auth.admin.getUserById(teacher.id)).error);
  console.log(
    "Deletion checks passed: administrator only, self-protection, student data cleanup, existing student access denied, teacher content/media retained and transferred, Auth identities removed.",
  );
} finally {
  ok(await service.storage.from("lesson-media").remove([object]));
  for (const table of ["drafts", "attempts", "extras"])
    ok(await service.from(table).delete().eq("lesson_id", lesson));
  ok(await service.from("enrollments").delete().eq("course_id", course));
  ok(await service.from("answer_keys").delete().eq("lesson_id", lesson));
  ok(await service.from("lessons").delete().eq("id", lesson));
  ok(await service.from("modules").delete().eq("id", moduleId));
  ok(await service.from("courses").delete().eq("id", course));
  ok(await service.from("groups").delete().eq("id", group));
  for (const user of users) {
    ok(await service.from("profiles").delete().eq("id", user.id));
    const r = await service.auth.admin.deleteUser(user.id);
    if (r.error && r.error.code !== "user_not_found") throw r.error;
  }
}
