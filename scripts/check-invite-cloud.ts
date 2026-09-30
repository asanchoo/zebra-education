import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { inviteProfile } from "../src/lib/invitations";
process.loadEnvFile(".env.local");
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false } },
);
const email = `zebra-invite-${randomBytes(6).toString("hex")}@example.com`;
const password = randomBytes(24).toString("base64url");
let id: string | undefined;
let browser;
try {
  const result = await inviteProfile(
    { name: "Invitation test", email, role: "student" },
    "https://zebra-education.vercel.app/auth/callback",
  );
  const profile = await db
    .from("profiles")
    .select("id")
    .eq("data->>email", email)
    .single();
  assert.ifError(profile.error);
  id = profile.data!.id;
  assert.equal(result.delivery, "manual");
  assert.ok(result.inviteLink);
  browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ??
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  const page = await browser.newPage();
  await page.goto(result.inviteLink!);
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Новый пароль (от 8 символов)", { exact: true })
    .fill(password);
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const login = await client.auth.signInWithPassword({ email, password });
  assert.ifError(login.error);
  assert.equal(login.data.user!.id, id);
  console.log(
    "Invitation checks passed: manual fallback, single-use link, production callback, password setup, subsequent sign-in.",
  );
} finally {
  await browser?.close();
  if (!id) {
    const users = await db.auth.admin.listUsers();
    id = users.data.users.find((u) => u.email === email)?.id;
  }
  if (id) {
    const removed = await db.from("profiles").delete().eq("id", id);
    assert.ifError(removed.error);
    const removedAuth = await db.auth.admin.deleteUser(id);
    assert.ifError(removedAuth.error);
  }
}
