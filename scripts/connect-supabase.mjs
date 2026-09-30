import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const ref = "utewtzsvbbckrjdqcmlo";
const result = JSON.parse(
  execFileSync(
    "npx",
    [
      "--yes",
      "supabase",
      "projects",
      "api-keys",
      "--project-ref",
      ref,
      "--reveal",
      "--output",
      "json",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ),
);
const list = Array.isArray(result)
  ? result
  : (result.api_keys ?? result.keys ?? result.data ?? []);
const publicKey =
  list.find(
    (k) =>
      k.type === "publishable" || k.name === "publishable" || k.name === "anon",
  )?.api_key ??
  list.find(
    (k) =>
      k.type === "publishable" || k.name === "publishable" || k.name === "anon",
  )?.key;
const privateItem = list.find(
  (k) =>
    k.type === "secret" || k.name === "secret" || k.name === "service_role",
);
const privateKey = privateItem?.api_key ?? privateItem?.key;
if (!publicKey || !privateKey)
  throw new Error("Required project keys not returned");
writeFileSync(
  ".env.local",
  `NEXT_PUBLIC_SUPABASE_URL=https://${ref}.supabase.co\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publicKey}\nSUPABASE_SECRET_KEY=${privateKey}\nDEMO_MODE=true\nDEMO_SESSION_SECRET=${randomBytes(32).toString("hex")}\n`,
  { mode: 0o600 },
);
console.log("Supabase connected. Keys stored only in ignored .env.local.");
