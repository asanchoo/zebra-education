import { test, expect } from "@playwright/test";
test("student sends work, teacher returns it, student sees feedback; mobile and Kazakh work", async ({
  page,
}) => {
  const feedback = "Good start! Check the capital letter. " + Date.now();
  const introduction = "Hello! My name is Amina. " + Date.now();
  await page.goto("/");
  await page
    .getByRole("button", { name: "Кабинет ученика", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Рады видеть тебя/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Мои курсы", exact: true }).click();
  await page
    .getByRole("button", { name: "English. First steps", exact: true })
    .click();
  await page.getByRole("button", { name: /Hello! Давай знакомиться/ }).click();
  const next = page.getByRole("button", { name: "Новая попытка", exact: true });
  if (await next.isVisible()) await next.click();
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
    .fill(introduction);
  await expect(
    page.getByText("Черновик сохранён", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "К курсу", exact: true }).click();
  await page.getByRole("button", { name: /Hello! Давай знакомиться/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Introduce yourself", exact: true }),
  ).toHaveValue(introduction);
  // Leave before the debounce expires: the latest text must survive navigation.
  await page
    .getByRole("textbox", { name: "Introduce yourself", exact: true })
    .fill(introduction + " Quick edit");
  await page.getByRole("button", { name: "Мои курсы", exact: true }).click();
  await page
    .getByRole("button", { name: "English. First steps", exact: true })
    .click();
  await page.getByRole("button", { name: /Hello! Давай знакомиться/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Introduce yourself", exact: true }),
  ).toHaveValue(introduction + " Quick edit");
  await page
    .getByRole("button", { name: "Отправить на проверку", exact: true })
    .click();
  await expect(
    page.getByText("Работа отправлена", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("4 / 4", { exact: true })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Роль", exact: true })
    .selectOption("teacher");
  await page.getByRole("button", { name: /Проверка работ/ }).click();
  await page
    .getByRole("button", { name: "Проверить", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("spinbutton").fill("4");
  await dialog
    .getByRole("textbox", { name: "Комментарий преподавателя", exact: true })
    .fill(feedback);
  await dialog
    .getByRole("button", { name: "Вернуть на исправление", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("combobox", { name: "Роль", exact: true })
    .selectOption("student");
  await page.getByRole("button", { name: "Мой прогресс", exact: true }).click();
  await expect(page.getByText(feedback, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "ҚАЗ", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Менің жетістігім", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page
    .getByRole("button", { name: "Менің курстарым", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Менің курстарым", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/zebra-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "RU", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Роль", exact: true })
    .selectOption("teacher");
  await page
    .getByRole("button", { name: "Уроки и материалы", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Создать урок", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Название на русском", exact: true })
    .fill("Тестовый урок");
  await page
    .getByRole("textbox", { name: "Название на казахском", exact: true })
    .fill("Сынақ сабағы");
  await page.getByRole("button", { name: "Выбор ответа", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Заголовок / вопрос", exact: true })
    .fill("Choose a greeting");
  await page
    .getByRole("textbox", {
      name: "Варианты ответа (каждый с новой строки)",
      exact: true,
    })
    .fill("Hello\nGoodbye");
  await page
    .getByRole("textbox", {
      name: "Правильные ответы (каждый с новой строки)",
      exact: true,
    })
    .fill("Hello");
  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(
    page.getByText("Изменения сохранены", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "Choose a greeting", exact: true }),
  ).toBeVisible();
});
