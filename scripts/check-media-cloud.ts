import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
process.loadEnvFile(".env.local");
const url = "https://zebra-education.vercel.app";
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false } },
);
const users = JSON.parse(
  await fs.readFile(".data/cloud-test-users.json", "utf8"),
) as { role: string; email: string; password: string }[];
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ??
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const lessonId = randomUUID();
let objectId: string | undefined;
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const teacher = users.find((u) => u.role === "teacher")!;
  await page.goto(url);
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill(teacher.email);
  await page.getByLabel("Пароль", { exact: true }).fill(teacher.password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await page.getByRole("heading", { name: /Хорошего дня/ }).waitFor();
  const wav = await fs.readFile("public/audio/dictation-a.wav");
  assert.ok(wav.length > 10000, "Dictation must contain actual audio samples");
  const upload = await context.request.post(url + "/api/media", {
    headers: { Origin: url },
    multipart: {
      lessonId,
      moduleId: "hello",
      file: { name: "dictation.wav", mimeType: "audio/wav", buffer: wav },
    },
  });
  assert.equal(upload.status(), 200, await upload.text());
  const media = await upload.json();
  objectId = new URL(url + media.url).searchParams.get("id")!;
  const preview = await context.request.get(url + media.url);
  assert.equal(preview.status(), 200);
  assert.deepEqual(await preview.body(), wav);
  const anon = await browser.newContext();
  assert.equal((await anon.request.get(url + media.url)).status(), 403);
  const student = users.find((u) => u.role === "student")!;
  const studentPage = await anon.newPage();
  await studentPage.goto(url);
  await studentPage
    .getByRole("textbox", { name: "Email", exact: true })
    .fill(student.email);
  await studentPage
    .getByLabel("Пароль", { exact: true })
    .fill(student.password);
  await studentPage.getByRole("button", { name: "Войти", exact: true }).click();
  await studentPage
    .getByRole("heading", { name: /Рады видеть тебя/ })
    .waitFor();
  assert.equal((await anon.request.get(url + media.url)).status(), 403);
  await page.evaluate(() => {
    const audio = document.createElement("audio");
    audio.id = "dictation-check";
    audio.src = "/audio/dictation-a.wav";
    document.body.appendChild(audio);
  });
  await page.waitForFunction(() => {
    const a = document.getElementById("dictation-check") as HTMLAudioElement;
    return a.duration > 3;
  });
  console.log(
    "Media checks passed: real WAV playback, upload to an unsaved lesson, private teacher preview, anonymous and student access denied.",
  );
} finally {
  await browser.close();
  if (objectId)
    assert.ifError(
      (await db.storage.from("lesson-media").remove([objectId])).error,
    );
  assert.ifError(
    (await db.from("answer_keys").delete().eq("lesson_id", lessonId)).error,
  );
  assert.ifError((await db.from("lessons").delete().eq("id", lessonId)).error);
}
