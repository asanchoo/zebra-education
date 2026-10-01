import { test, expect } from "@playwright/test";

test("mobile logout remains reachable for every role, including landscape", async ({
  page,
}) => {
  for (const viewport of [
    { width: 360, height: 640 },
    { width: 667, height: 375 },
  ]) {
    await page.setViewportSize(viewport);
    for (const role of [
      "Кабинет ученика",
      "Кабинет преподавателя",
      "Управление школой",
    ]) {
      await page.goto("/");
      await page.getByRole("button", { name: role, exact: true }).click();
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      const logout = page.getByRole("button", { name: "Выйти", exact: true });
      await expect(logout).toBeInViewport({ ratio: 1 });
      // The sections can scroll without moving account controls off screen.
      const sections = page.locator(".sidebar-scroll");
      await sections.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await expect(logout).toBeInViewport({ ratio: 1 });
      await expect(page.locator(".sidebar nav button").last()).toBeInViewport({
        ratio: 1,
      });
      if (role === "Управление школой" && viewport.width === 360) {
        await page.screenshot({
          path: "test-results/zebra-mobile-logout.png",
          animations: "disabled",
        });
      }
      await logout.click();
      await expect(
        page.getByRole("button", { name: "Кабинет ученика", exact: true }),
      ).toBeVisible();
      const workspace = await page.request.get("/api/workspace");
      expect((await workspace.json()).user).toBeNull();
    }
  }
});

test("login password visibility preserves the value without submitting, in both languages", async ({
  page,
}) => {
  let submissions = 0;
  await page.route("**/api/workspace", async (route) => {
    if (route.request().method() === "POST") submissions++;
    await route.fulfill({ json: { user: null, demo: false } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("test@example.com");
  const password = page.locator('input[name="password"]');
  await expect(page.getByLabel("Пароль", { exact: true })).toBeVisible();
  const value = "Example-password-2026";
  await password.fill(value);
  await expect(password).toHaveAttribute("type", "password");
  const show = page.getByRole("button", {
    name: "Показать пароль",
    exact: true,
  });
  await expect(show).toBeInViewport({ ratio: 1 });
  await show.click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue(value);
  await page.screenshot({
    path: "test-results/zebra-mobile-password.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "ҚАЗ", exact: true }).click();
  await expect(page.getByLabel("Құпиясөз", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Құпиясөзді жасыру", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "password");
  await expect(password).toHaveValue(value);
  await page
    .getByRole("button", { name: "Құпиясөзді көрсету", exact: true })
    .focus();
  await page.keyboard.press("Space");
  await expect(password).toHaveAttribute("type", "text");
  expect(submissions).toBe(0);
});

test("new password dialog has the same visibility control", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Кабинет преподавателя", exact: true })
    .click();
  await expect(page.locator(".sidebar-user")).toBeVisible();
  await page.goto("/?setPassword=1");
  const dialog = page.getByRole("dialog");
  const password = dialog.getByLabel("Новый пароль (от 8 символов)", {
    exact: true,
  });
  await password.fill("Example-new-password");
  await dialog
    .getByRole("button", { name: "Показать пароль", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("Example-new-password");
  await expect(password).toHaveAttribute("autoComplete", "new-password");
  await dialog
    .getByRole("button", { name: "Скрыть пароль", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "password");
  await expect(password).toHaveValue("Example-new-password");
});
