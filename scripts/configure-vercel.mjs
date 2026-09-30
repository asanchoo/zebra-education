import { execFileSync } from "node:child_process";
process.loadEnvFile(".env.local");
for (const name of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
]) {
  const args = [
    "env",
    "add",
    name,
    "production,preview",
    "--yes",
    "--force",
    "--type",
    name === "SUPABASE_SECRET_KEY" ? "secret" : "config",
  ];
  execFileSync("npx", ["--yes", "vercel", ...args], {
    input: process.env[name],
    stdio: ["pipe", "pipe", "pipe"],
  });
  console.log(name + " configured.");
}
execFileSync(
  "npx",
  [
    "--yes",
    "vercel",
    "env",
    "add",
    "DEMO_MODE",
    "production,preview",
    "--yes",
    "--force",
    "--type",
    "config",
  ],
  { input: "false", stdio: ["pipe", "pipe", "pipe"] },
);
console.log("Production demo mode disabled.");
