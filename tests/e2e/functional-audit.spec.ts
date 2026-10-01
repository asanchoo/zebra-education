import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Lesson } from "../../src/lib/types";

test("deadline stays fixed, future lessons stay locked, notifications persist, hidden content and deletion work", async ({
  page,
}) => {
  test.setTimeout(90_000);
  page.setDefaultTimeout(5_000);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Управление школой", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Хорошего дня/ }),
  ).toBeVisible();
  const send = async (data: unknown) => {
    const response = await page.request.post("/api/workspace", {
      data,
      headers: { Origin: "http://localhost:3000" },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  };
  const role = async (value: "admin" | "student") => {
    await page
      .getByRole("combobox", { name: "Роль", exact: true })
      .selectOption(value);
    await expect
      .poll(
        async () =>
          (await (await page.request.get("/api/workspace")).json()).user.role,
      )
      .toBe(value);
    await expect(
      page.getByRole("combobox", { name: "Роль", exact: true }),
    ).toHaveValue(value);
  };
  const course = (
    await send({
      action: "course",
      title: "Audit course",
      level: "A1",
      description: { ru: "Audit", kk: "Audit" },
    })
  ).result;
  try {
    await page.reload();
    await page
      .getByRole("button", { name: "Уроки и материалы", exact: true })
      .click();
    const courseSection = page.locator(".builder-course").filter({
      has: page.getByRole("heading", { name: "Audit course", exact: true }),
    });
    await courseSection
      .getByRole("button", { name: "Добавить модуль", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator('select[name="courseId"]')).toHaveValue(
      course.id,
    );
    await dialog
      .getByLabel("Название на русском", { exact: true })
      .fill("Audit module");
    await dialog
      .getByLabel("Название на казахском", { exact: true })
      .fill("Audit module");
    await dialog
      .getByRole("button", { name: "Сохранить", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    const store = await (await page.request.get("/api/workspace")).json();
    const moduleId = store.modules.find(
      (m: { courseId: string }) => m.courseId === course.id,
    ).id;
    let lesson: Lesson = {
      id: randomUUID(),
      moduleId,
      title: { ru: "Audit homework", kk: "Audit homework" },
      description: { ru: "Audit", kk: "Audit" },
      minutes: 5,
      position: 1,
      attemptLimit: 2,
      published: true,
      version: 1,
      blocks: [
        {
          id: "write",
          type: "writing",
          title: "Audit answer",
          content: "Write hello",
          points: 2,
        },
      ],
      keys: {},
    };
    lesson = (await send({ action: "lesson", lesson })).result;
    await send({
      action: "enroll",
      courseId: course.id,
      groupId: "beginners",
      mode: "group",
    });
    await send({
      action: "release",
      lessonId: lesson.id,
      groupId: "beginners",
      open: true,
      homework: true,
      dueAt: "2026-09-30T18:59:00.000Z",
    });
    await page.reload();
    await page
      .getByRole("button", { name: "Ученики и группы", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Доступ к урокам", exact: true })
      .first()
      .click();
    const assignment = page
      .locator(".release-row")
      .filter({ hasText: "Audit homework" });
    await expect(assignment.getByLabel("Срок", { exact: true })).toHaveValue(
      "2026-09-30T23:59",
    );
    await assignment
      .getByRole("button", { name: "Сохранить", exact: true })
      .click();
    await expect(
      page.getByText("Изменения сохранены", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await role("student");
    await page
      .getByRole("button", { name: "Задания", exact: true })
      .first()
      .click();
    const task = page
      .locator(".task-card")
      .filter({ hasText: "Audit homework" });
    await expect(task.getByText("Просрочено", { exact: true })).toBeVisible();
    await expect(task.getByText(/30.09.2026, 23:59/)).toBeVisible();
    await page.screenshot({
      path: "test-results/zebra-overdue.png",
      fullPage: true,
      animations: "disabled",
    });
    await task.click();
    await page.getByLabel("Audit answer", { exact: true }).fill("Hello");
    await page
      .getByRole("button", { name: "Отправить на проверку", exact: true })
      .click();
    await expect(
      page.getByText("Работа отправлена", { exact: true }),
    ).toBeVisible();
    const submitted = await (await page.request.get("/api/workspace")).json();
    const attempt = submitted.attempts.find(
      (a: { lessonId: string }) => a.lessonId === lesson.id,
    );
    expect(attempt.late).toBe(true);
    await role("admin");
    await send({
      action: "review",
      attemptId: attempt.id,
      score: 1,
      feedback: "Audit feedback",
      returned: true,
    });
    await role("student");
    await expect(
      page.getByLabel("Есть непрочитанные уведомления", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Уведомления", exact: true })
      .click();
    await expect(
      page.getByLabel("Есть непрочитанные уведомления", { exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: /Рады видеть тебя/ }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Есть непрочитанные уведомления", { exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Мои курсы", exact: true })
      .first()
      .click();
    await expect(
      page
        .locator(".course-card")
        .filter({ hasText: "Audit course" })
        .getByText("0%", { exact: true }),
    ).toBeVisible();
    await role("admin");
    await send({
      action: "release",
      lessonId: lesson.id,
      groupId: "beginners",
      open: true,
      homework: true,
      opensAt: "2099-01-01T05:00:00.000Z",
      dueAt: "2099-01-02T18:59:00.000Z",
    });
    await role("student");
    await page
      .getByRole("button", { name: "Задания", exact: true })
      .first()
      .click();
    await expect(
      page.locator(".task-card").filter({ hasText: "Audit homework" }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Мои курсы", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Audit course", exact: true })
      .click();
    await expect(
      page.locator(".lesson-row").filter({ hasText: "Audit homework" }),
    ).toBeDisabled();
    // Verify the clock actually opens a group release without reloading the page.
    await role("admin");
    await send({
      action: "release",
      lessonId: lesson.id,
      groupId: "beginners",
      open: true,
      homework: true,
      opensAt: new Date(Date.now() + 5_000).toISOString(),
      dueAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    await role("student");
    await page
      .getByRole("button", { name: "Мои курсы", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Audit course", exact: true })
      .click();
    const scheduled = page
      .locator(".lesson-row")
      .filter({ hasText: "Audit homework" });
    await expect(scheduled).toBeDisabled();
    await expect(scheduled).toBeEnabled({ timeout: 35_000 });
    await role("admin");
    await send({
      action: "content",
      kind: "module",
      id: moduleId,
      operation: "hide",
    });
    await role("student");
    await page
      .getByRole("button", { name: "Мои курсы", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Audit course", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Audit module", exact: true }),
    ).toHaveCount(0);
    await role("admin");
    await page
      .getByRole("button", { name: "Уроки и материалы", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Показать Audit module", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Скрыть Audit module", exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    const row = page
      .locator(".builder-lesson")
      .filter({ hasText: "Audit homework" });
    await row
      .getByRole("button", { name: "Редактировать", exact: true })
      .click();
    await expect(
      page.getByLabel("Открыть урок не раньше", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
    await page.screenshot({
      path: "test-results/zebra-mobile-editor.png",
      fullPage: true,
      animations: "disabled",
    });
    await page
      .locator(".back-button")
      .filter({ hasText: "Уроки и материалы" })
      .click();
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const title of ["Audit homework", "Audit module", "Audit course"]) {
      await page
        .getByRole("button", { name: `Удалить материал ${title}`, exact: true })
        .click();
      await expect(
        page.getByRole("dialog").getByText(/Это нельзя отменить/),
      ).toBeVisible();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Удалить материал", exact: true })
        .click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
    }
    await expect(
      page.locator(".builder-course").filter({ hasText: "Audit course" }),
    ).toHaveCount(0);
  } finally {
    await send({ action: "demo", role: "admin" });
    const store = await (await page.request.get("/api/workspace")).json();
    if (store.courses.some((c: { id: string }) => c.id === course.id))
      await send({
        action: "content",
        kind: "course",
        id: course.id,
        operation: "delete",
      });
  }
});
