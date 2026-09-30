import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
export const configured = () =>
  !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
export const demoEnabled = () =>
  process.env.DEMO_MODE === "true" ||
  (!configured() && process.env.NODE_ENV !== "production");
export async function serverClient() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (cs) => {
          for (const { name, value, options } of cs)
            jar.set(name, value, options);
        },
      },
    },
  );
}
export function adminClient() {
  if (!process.env.SUPABASE_SECRET_KEY) throw new Error("SERVER_KEY_REQUIRED");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
