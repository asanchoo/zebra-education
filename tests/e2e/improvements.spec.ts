import { test, expect } from "@playwright/test";
test("loading state, clickable path, published saves, administrator deletion", async ({
  page,
}) => {
  let release!: () => void;
  const pause = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/workspace", async (route) => {
    await pause;
    await route.continue().catch(() => {});
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Минутку, мы загружаемся", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "ZEBRA Education", exact: true }),
  ).toHaveJSProperty("complete", true);
  await page.screenshot({
    path: "test-results/zebra-loading.png",
    animations: "disabled",
  });
  release();
  await expect(
    page.getByRole("button", { name: "Управление школой", exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/workspace");
  await page
    .getByRole("button", { name: "Управление школой", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ученики и группы", exact: true })
    .click();
  const path = page.getByRole("navigation", {
    name: "Путь навигации",
    exact: true,
  });
  await path.getByRole("button", { name: "Обучение", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Хорошего дня/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Уроки и материалы", exact: true })
    .click();
  const first = page.locator(".builder-lesson").first();
  await first
    .getByRole("button", { name: "Редактировать", exact: true })
    .click();
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    page.getByText("Изменения сохранены", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Снять с публикации", exact: true }),
  ).toBeVisible();
  await page
    .locator(".back-button")
    .filter({ hasText: "Уроки и материалы" })
    .click();
  await expect(
    page
      .locator(".builder-lesson")
      .first()
      .getByText("Опубликован", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ученики и группы", exact: true })
    .click();
  const name = "Disposable user " + Date.now();
  await page
    .getByRole("button", { name: "Пригласить", exact: true })
    .first()
    .click();
  const invite = page.getByRole("dialog");
  await invite.getByLabel("Имя", { exact: true }).fill(name);
  await invite
    .getByLabel("Email", { exact: true })
    .fill(`ui-delete-${Date.now()}@example.com`);
  await invite.getByRole("button", { name: "Пригласить", exact: true }).click();
  await invite.waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: `Удалить аккаунт ${name}`, exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText(/без возможности восстановления/),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
  await page
    .getByRole("button", { name: `Удалить аккаунт ${name}`, exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Удалить аккаунт", exact: true })
    .click();
  await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    path.getByRole("button", { name: "Обучение", exact: true }),
  ).toBeVisible();
  await path.getByRole("button", { name: "Обучение", exact: true }).click();
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.screenshot({
    path: "test-results/zebra-improved-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});
