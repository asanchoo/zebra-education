import { adminClient } from "./supabase";
import { AppError } from "./domain";
export async function inviteProfile(
  profile: { name: string; email: string; role: "student" | "teacher" },
  redirectTo: string,
) {
  const db = adminClient();
  const email = profile.email.toLowerCase();
  const { data: existing, error: lookupError } = await db
    .from("profiles")
    .select("id")
    .eq("data->>email", email)
    .maybeSingle();
  if (lookupError) throw new AppError("INVITE_FAILED");
  if (existing) throw new AppError("ACCOUNT_EXISTS");
  const sent = await db.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { name: profile.name },
  });
  let user = sent.data.user;
  let inviteLink: string | undefined;
  if (sent.error) {
    const generated = await db.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo, data: { name: profile.name } },
    });
    if (generated.error || !generated.data.user)
      throw new AppError("INVITE_FAILED");
    user = generated.data.user;
    inviteLink = generated.data.properties.action_link;
  }
  if (!user) throw new AppError("INVITE_FAILED");
  const { error } = await db
    .from("profiles")
    .upsert({
      id: user.id,
      data: { id: user.id, ...profile, email, active: true },
    });
  if (error) throw new AppError("INVITE_FAILED");
  return { inviteLink, delivery: inviteLink ? "manual" : "email" };
}
