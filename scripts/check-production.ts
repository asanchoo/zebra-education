import { chromium } from "@playwright/test";
import { promises as fs } from "node:fs";
import assert from "node:assert/strict";
const url = process.env.TEST_BASE_URL ?? "https://zebra-education.vercel.app";
const users = JSON.parse(
  await fs.readFile(".data/cloud-test-users.json", "utf8"),
) as { role: string; email: string; password: string }[];
const browser = await chromium.launch({
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage();
  const student = users.find((u) => u.role === "student")!;
  await page.goto(url);
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill(student.email);
  await page.getByLabel("Пароль", { exact: true }).fill(student.password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await page.getByRole("heading", { name: /Рады видеть тебя/ }).waitFor();
  const w = await context.request
    .get(url + "/api/workspace")
    .then((r) => r.json());
  assert.equal(w.demo, false);
  assert.ok(w.lessons.every((l: { keys?: unknown }) => !l.keys));
  assert.equal(w.courses.length, 1);
  await page
    .getByRole("button", { name: "Продолжить обучение", exact: true })
    .click();
  await page.getByRole("radio", { name: "A Hello!", exact: true }).check();
  await page
    .getByRole("textbox", { name: "My ___ is Alex.", exact: true })
    .fill("name");
  await page
    .getByRole("radio", { name: "A What is your name?", exact: true })
    .check();
  await page
    .getByRole("textbox", { name: "___ to meet you!", exact: true })
    .fill("nice");
  await page
    .getByRole("textbox", { name: "Introduce yourself", exact: true })
    .fill("Hello! My name is Amina.");
  await page
    .getByRole("button", { name: "Отправить на проверку", exact: true })
    .click();
  await page.getByText("Работа отправлена", { exact: true }).waitFor();
  assert.ok(await page.getByText("4 / 4", { exact: true }).isVisible());
  const teacher = users.find((u) => u.role === "teacher")!,
    tc = await browser.newContext(),
    tp = await tc.newPage();
  await tp.goto(url);
  await tp
    .getByRole("textbox", { name: "Email", exact: true })
    .fill(teacher.email);
  await tp.getByLabel("Пароль", { exact: true }).fill(teacher.password);
  await tp.getByRole("button", { name: "Войти", exact: true }).click();
  await tp.getByRole("heading", { name: /Хорошего дня/ }).waitFor();
  await tp.getByRole("button", { name: /Проверка работ/ }).click();
  await tp
    .getByRole("button", { name: "Проверить", exact: true })
    .first()
    .click();
  const dialog = tp.getByRole("dialog");
  await dialog.getByRole("spinbutton").fill("4");
  await dialog
    .getByRole("textbox", { name: "Комментарий преподавателя", exact: true })
    .fill("Well done.");
  await dialog
    .getByRole("button", { name: "Сохранить проверку", exact: true })
    .click();
  await dialog.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Мой прогресс", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Мой прогресс", exact: true }).click();
  await page.getByText("Well done.", { exact: true }).waitFor();
  await tp.getByRole("button", { name: "Главная", exact: true }).click();
  await tp.screenshot({
    path: "/tmp/zebra-production-teacher.png",
    fullPage: true,
  });
  console.log(
    "Production browser checks passed: real Supabase sign-in, submission, auto grading, teacher review, persisted feedback; demo disabled.",
  );
} finally {
  await browser.close();
}
