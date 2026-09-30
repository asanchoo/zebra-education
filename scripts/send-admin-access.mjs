import { createClient } from "@supabase/supabase-js";
process.loadEnvFile(".env.local");
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
);
const { error } = await db.auth.resetPasswordForEmail(
  process.env.ZEBRA_ADMIN_EMAIL,
  { redirectTo: "https://zebra-education.vercel.app/auth/callback" },
);
if (error) {
  console.log("Email delivery unavailable: " + error.code);
  process.exitCode = 1;
} else console.log("Administrator access email requested successfully.");
