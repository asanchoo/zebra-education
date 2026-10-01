import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { request } from "@playwright/test";
import type { Workspace } from "../src/lib/types";
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
      email = `zebra-audit-${role}-${randomBytes(6).toString("hex")}@example.com`;
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
  const [, teacher, student] = users;
  const content = {
    id: lesson,
    moduleId,
    title: { ru: "Audit fixture", kk: "Audit fixture" },
    description: { ru: "", kk: "" },
    minutes: 5,
    position: 1,
    attemptLimit: 5,
    published: true,
    version: 1,
    blocks: [
      { id: "q", type: "gap", title: "Hello ___", content: "", points: 1 },
      {
        id: "w",
        type: "writing",
        title: "Write hello",
        content: "",
        points: 2,
      },
    ],
  };
  ok(
    await service.from("courses").insert({
      id: course,
      data: {
        id: course,
        title: "Audit fixture",
        teacherId: teacher.id,
        description: { ru: "", kk: "" },
        level: "A1",
      },
    }),
  );
  ok(
    await service.from("groups").insert({
      id: group,
      data: {
        id: group,
        name: "Audit fixture",
        teacherId: teacher.id,
        studentIds: [student.id],
      },
    }),
  );
  ok(
    await service.from("modules").insert({
      id: moduleId,
      data: {
        id: moduleId,
        courseId: course,
        title: { ru: "Audit", kk: "Audit" },
        position: 1,
      },
    }),
  );
  ok(
    await service.from("lessons").insert({
      id: lesson,
      data: { ...content, availableAt: "2099-01-01T00:00:00Z" },
    }),
  );
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
        groupId: group,
        mode: "group",
      },
    }),
  );
  const rid = randomUUID();
  ok(
    await service.from("releases").insert({
      id: rid,
      data: {
        id: rid,
        groupId: group,
        lessonId: lesson,
        homework: true,
        dueAt: "2026-09-30T18:59:00Z",
      },
    }),
  );
  assert.equal(
    (await student.client.from("lessons").select("id").eq("id", lesson)).data!
      .length,
    0,
  );
  const attemptId = randomUUID(),
    command = {
      id: attemptId,
      lessonId: lesson,
      version: 1,
      answers: { q: "Sam", w: "Hello Sam" },
    };
  assert.match(
    (await student.client.rpc("submit_attempt", { command })).error!.message,
    /FORBIDDEN/,
  );
  ok(await service.from("lessons").update({ data: content }).eq("id", lesson));
  ok(
    await service
      .from("releases")
      .update({
        data: {
          id: rid,
          groupId: group,
          lessonId: lesson,
          homework: true,
          opensAt: "2099-01-01T00:00:00Z",
          dueAt: "2099-01-02T00:00:00Z",
        },
      })
      .eq("id", rid),
  );
  assert.equal(
    (await student.client.from("lessons").select("id").eq("id", lesson)).data!
      .length,
    0,
  );
  ok(
    await service
      .from("releases")
      .update({
        data: {
          id: rid,
          groupId: group,
          lessonId: lesson,
          homework: true,
          dueAt: "2026-09-30T18:59:00Z",
        },
      })
      .eq("id", rid),
  );
  const sent = await student.client.rpc("submit_attempt", { command });
  ok(sent);
  assert.equal(sent.data.late, true);
  const event = { attemptId, eventAt: sent.data.submittedAt };
  ok(await teacher.client.rpc("read_notifications", { events: [event] }));
  assert.equal(
    (await student.client.from("notification_reads").select("id")).data!.length,
    0,
  );
  assert.ok(
    (await student.client.rpc("read_notifications", { events: [event] })).error,
  );
  const review = await teacher.client.rpc("review_attempt", {
    command: { attemptId, score: 2, feedback: "Great", returned: false },
  });
  ok(review);
  ok(
    await student.client.rpc("read_notifications", {
      events: [{ attemptId, eventAt: review.data.reviewedAt }],
    }),
  );
  const reads = await student.client.from("notification_reads").select("data");
  ok(reads);
  assert.equal(reads.data![0].data.eventAt, review.data.reviewedAt);
  const review2 = await teacher.client.rpc("review_attempt", {
    command: { attemptId, score: 1, feedback: "Please revise", returned: true },
  });
  ok(review2);
  assert.notEqual(review2.data.reviewedAt, reads.data![0].data.eventAt);
  if (process.env.ZEBRA_CHECK_SITE) {
    const site = process.env.ZEBRA_CHECK_SITE;
    const studentApi = await request.newContext({
      baseURL: site,
      extraHTTPHeaders: { Origin: site },
    });
    const teacherApi = await request.newContext({
      baseURL: site,
      extraHTTPHeaders: { Origin: site },
    });
    try {
      for (const [api, user] of [
        [studentApi, student],
        [teacherApi, teacher],
      ] as const) {
        const session = (await user.client.auth.getSession()).data.session!;
        assert.equal(
          (
            await api.post("/api/workspace", {
              data: {
                action: "session",
                access_token: session.access_token,
                refresh_token: session.refresh_token,
              },
            })
          ).status(),
          200,
        );
      }
      const workspace = async () => {
        const response = await studentApi.get("/api/workspace");
        assert.equal(response.status(), 200);
        return (await response.json()) as Workspace;
      };
      const w = await workspace();
      assert.equal(w.user.id, student.id);
      assert.equal(w.demo, false);
      assert.ok(Number.isFinite(Date.parse(w.serverTime)));
      assert.ok(w.lessons.some((l) => l.id === lesson));
      assert.ok(w.notificationReads.every((r) => r.userId === student.id));
      assert.equal(
        (
          await studentApi.post("/api/workspace", {
            data: {
              action: "readNotifications",
              events: [{ attemptId, eventAt: review2.data.reviewedAt }],
            },
          })
        ).status(),
        200,
      );
      assert.equal(
        (await workspace()).notificationReads.find(
          (r) => r.attemptId === attemptId,
        )?.eventAt,
        review2.data.reviewedAt,
      );
      assert.equal(
        (
          await teacherApi.post("/api/workspace", {
            data: {
              action: "release",
              lessonId: lesson,
              groupId: group,
              open: true,
              homework: true,
              opensAt: "2099-01-01T00:00:00.000Z",
              dueAt: "2099-01-02T00:00:00.000Z",
            },
          })
        ).status(),
        200,
      );
      assert.equal(
        (await workspace()).lessons.find((l) => l.id === lesson)?.blocks.length,
        0,
      );
      assert.equal(
        (await studentApi.get("/api/lesson?id=" + lesson)).status(),
        403,
      );
      assert.equal(
        (
          await teacherApi.post("/api/workspace", {
            data: {
              action: "release",
              lessonId: lesson,
              groupId: group,
              open: true,
              homework: true,
              dueAt: "2026-09-30T18:59:00.000Z",
            },
          })
        ).status(),
        200,
      );
      assert.equal(
        (await workspace()).releases.find((r) => r.lessonId === lesson)?.dueAt,
        "2026-09-30T18:59:00.000Z",
      );
      assert.equal(
        (
          await teacherApi.post("/api/workspace", {
            data: {
              action: "content",
              kind: "lesson",
              id: lesson,
              operation: "hide",
            },
          })
        ).status(),
        200,
      );
      assert.ok(!(await workspace()).lessons.some((l) => l.id === lesson));
      assert.equal(
        (
          await teacherApi.post("/api/workspace", {
            data: {
              action: "content",
              kind: "lesson",
              id: lesson,
              operation: "show",
            },
          })
        ).status(),
        200,
      );
      assert.ok((await workspace()).lessons.some((l) => l.id === lesson));
      console.log(
        "Production API checks passed: signed-in workspace, private persistent reads, fixed school deadline, scheduled content protection, hide and show.",
      );
    } finally {
      await studentApi.dispose();
      await teacherApi.dispose();
    }
  }
  for (const [kind, id] of [
    ["lesson", lesson],
    ["module", moduleId],
    ["course", course],
  ]) {
    assert.ok(
      (
        await student.client.rpc("manage_content", {
          kind,
          target_id: id,
          operation: "hide",
        })
      ).error,
    );
    ok(
      await teacher.client.rpc("manage_content", {
        kind,
        target_id: id,
        operation: "hide",
      }),
    );
    assert.equal(
      (await student.client.from("lessons").select("id").eq("id", lesson)).data!
        .length,
      0,
    );
    assert.ok(
      !(await student.client.rpc("lesson_catalog")).data.some(
        (l: { id: string }) => l.id === lesson,
      ),
    );
    ok(
      await teacher.client.rpc("manage_content", {
        kind,
        target_id: id,
        operation: "show",
      }),
    );
  }
  // Direct RPC calls cannot bypass the schedule validator.
  const invalid = await teacher.client.rpc("save_entities", {
    changes: {
      releases: [
        {
          id: rid,
          data: {
            id: rid,
            groupId: group,
            lessonId: lesson,
            homework: true,
            opensAt: "2099-01-02T00:00:00Z",
            dueAt: "2099-01-01T00:00:00Z",
          },
        },
      ],
    },
  });
  assert.match(invalid.error!.message, /INVALID_SCHEDULE/);
  if (process.env.ZEBRA_CHECK_SITE) {
    ok(
      await teacher.client.storage
        .from("lesson-media")
        .upload(object, new Uint8Array([0]), { contentType: "audio/wav" }),
    );
    const site = process.env.ZEBRA_CHECK_SITE;
    const api = await request.newContext({
      baseURL: site,
      extraHTTPHeaders: { Origin: site },
    });
    try {
      const session = (await teacher.client.auth.getSession()).data.session!;
      assert.equal(
        (
          await api.post("/api/workspace", {
            data: {
              action: "session",
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            },
          })
        ).status(),
        200,
      );
      assert.equal(
        (
          await api.post("/api/workspace", {
            data: {
              action: "content",
              kind: "course",
              id: course,
              operation: "delete",
            },
          })
        ).status(),
        200,
      );
      const files = await service.storage.from("lesson-media").list(lesson);
      ok(files);
      assert.equal(files.data!.length, 0);
      assert.equal(
        (await service.from("lessons").select("id").eq("id", lesson)).data!
          .length,
        0,
      );
      console.log(
        "Production course deletion removed its private media and dependent work.",
      );
    } finally {
      await api.dispose();
    }
  } else {
    const removed = await teacher.client.rpc("manage_content", {
      kind: "course",
      target_id: course,
      operation: "delete",
    });
    ok(removed);
    assert.ok(removed.data.deletedLessonIds.includes(lesson));
  }
  assert.equal(
    (await service.from("attempts").select("id").eq("lesson_id", lesson)).data!
      .length,
    0,
  );
  assert.equal(
    (
      await service
        .from("notification_reads")
        .select("id")
        .eq("attempt_id", attemptId)
    ).data!.length,
    0,
  );
  assert.equal(
    (await service.from("enrollments").select("id").eq("course_id", course))
      .data!.length,
    0,
  );
  console.log(
    "Functional cloud checks passed: scheduled and hidden content protected by RLS, overdue submission, persistent private notification reads, new-review events, schedule validation, recursive deletion and read cleanup.",
  );
} finally {
  ok(await service.storage.from("lesson-media").remove([object]));
  for (const table of ["drafts", "attempts", "extras"])
    ok(await service.from(table).delete().eq("lesson_id", lesson));
  ok(await service.from("enrollments").delete().eq("course_id", course));
  ok(await service.from("releases").delete().eq("lesson_id", lesson));
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
