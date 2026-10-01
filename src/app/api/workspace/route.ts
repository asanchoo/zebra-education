import { manageContent } from "@/lib/content";
import { markNotifications } from "@/lib/notifications";
import { adminClient } from "@/lib/supabase";
import { NextResponse, type NextRequest } from "next/server";
import {
  currentUser,
  demoLogin,
  loadStore,
  mutate,
  persistEntities,
  publicWorkspace,
} from "@/lib/repository";
import { AppError } from "@/lib/domain";
import { commandSchema, execute } from "@/lib/commands";
import { demoEnabled, serverClient } from "@/lib/supabase";
import { deleteCloudProfile, deleteDemoProfile } from "@/lib/profiles";
import { inviteProfile } from "@/lib/invitations";
import { cookies } from "next/headers";
import { z } from "zod";
export const dynamic = "force-dynamic";
function failure(e: unknown) {
  return NextResponse.json(
    {
      error:
        e instanceof AppError
          ? e.message
          : e instanceof z.ZodError
            ? "INVALID_INPUT"
            : "SERVER_ERROR",
    },
    {
      status:
        e instanceof AppError ? e.status : e instanceof z.ZodError ? 400 : 500,
    },
  );
}
export async function GET() {
  try {
    const u = await currentUser();
    if (!u) return NextResponse.json({ user: null, demo: demoEnabled() });
    return NextResponse.json(publicWorkspace(await loadStore(), u), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    if (
      !req.headers.get("origin") ||
      new URL(req.headers.get("origin")!).host !== req.headers.get("host")
    )
      throw new AppError("INVALID_ORIGIN", 403);
    if (Number(req.headers.get("content-length") ?? 0) > 1_000_000)
      throw new AppError("TOO_LARGE", 413);
    const b = await req.json();
    if (b.action === "demo") {
      await demoLogin(z.enum(["student", "teacher", "admin"]).parse(b.role));
      return NextResponse.json({ ok: true });
    }
    if (b.action === "login") {
      const { email, password } = z
        .object({ email: z.email(), password: z.string().min(6).max(200) })
        .parse(b);
      if (demoEnabled()) throw new AppError("USE_DEMO");
      const db = await serverClient();
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw new AppError("LOGIN_FAILED", 401);
      return NextResponse.json({ ok: true });
    }
    if (b.action === "session") {
      if (demoEnabled()) throw new AppError("DEMO_DISABLED");
      const tokens = z
        .object({
          access_token: z.string().min(20).max(12000),
          refresh_token: z.string().min(10).max(2000),
        })
        .parse(b);
      const db = await serverClient();
      const { error } = await db.auth.setSession(tokens);
      if (error) throw new AppError("LOGIN_FAILED", 401);
      return NextResponse.json({ ok: true });
    }
    if (b.action === "logout") {
      (await cookies()).delete("zebra_demo");
      if (!demoEnabled()) await (await serverClient()).auth.signOut();
      return NextResponse.json({ ok: true });
    }
    if (b.action === "reset") {
      const email = z.email().parse(b.email);
      if (!demoEnabled()) {
        const { error } = await (
          await serverClient()
        ).auth.resetPasswordForEmail(email, {
          redirectTo: new URL("/auth/callback", req.url).href,
        });
        if (error) throw new AppError("EMAIL_FAILED");
      }
      return NextResponse.json({ ok: true });
    }
    if (b.action === "password") {
      const password = z.string().min(8).max(200).parse(b.password);
      if (demoEnabled()) throw new AppError("DEMO_DISABLED");
      const { error } = await (
        await serverClient()
      ).auth.updateUser({ password });
      if (error) throw new AppError("PASSWORD_FAILED");
      return NextResponse.json({ ok: true });
    }
    const u = await currentUser();
    if (!u) throw new AppError("UNAUTHORIZED", 401);
    if (b.action === "invite") {
      if (u.role !== "admin") throw new AppError("FORBIDDEN", 403);
      const p = z
        .object({
          email: z.email(),
          name: z.string().min(1).max(100),
          role: z.enum(["student", "teacher"]),
        })
        .parse(b);
      if (demoEnabled()) {
        await mutate((s) =>
          s.profiles.push({ id: crypto.randomUUID(), ...p, active: true }),
        );
      } else {
        if (!process.env.SUPABASE_SECRET_KEY)
          throw new AppError("SERVER_KEY_REQUIRED", 503);
        const invitation = await inviteProfile(
          p,
          new URL("/auth/callback", req.headers.get("origin")!).href,
        );
        return NextResponse.json({ ok: true, ...invitation });
      }
      return NextResponse.json({ ok: true });
    }
    if (b.action === "deleteProfile") {
      if (u.role !== "admin") throw new AppError("FORBIDDEN", 403);
      const id = z.string().min(1).max(100).parse(b.id);
      if (demoEnabled()) await mutate((s) => deleteDemoProfile(s, u, id));
      else await deleteCloudProfile(await serverClient(), id);
      return NextResponse.json({ ok: true });
    }
    if (b.action === "content") {
      const c = z
        .object({
          kind: z.enum(["course", "module", "lesson"]),
          id: z.string().min(1).max(100),
          operation: z.enum(["hide", "show", "delete"]),
        })
        .parse(b);
      if (demoEnabled()) await mutate((s) => manageContent(s, u, c));
      else {
        const { data, error } = await (
          await serverClient()
        ).rpc("manage_content", {
          kind: c.kind,
          target_id: c.id,
          operation: c.operation,
        });
        if (error)
          throw new AppError(
            error.message.includes("FORBIDDEN") ? "FORBIDDEN" : "SAVE_FAILED",
            403,
          );
        // Files belong to the deleted lessons; retain files for hide/show.
        for (const lid of data?.deletedLessonIds ?? []) {
          const storage = adminClient().storage.from("lesson-media");
          for (;;) {
            const { data: files, error } = await storage.list(lid, {
              limit: 100,
            });
            if (error || !files?.length) break;
            const removed = await storage.remove(
              files.map((f) => lid + "/" + f.name),
            );
            if (removed.error) break;
          }
        }
      }
      return NextResponse.json({ ok: true });
    }
    if (b.action === "readNotifications") {
      const events = z
        .array(
          z.object({
            attemptId: z.string().min(1),
            eventAt: z.string().datetime({ offset: true }),
          }),
        )
        .max(100)
        .parse(b.events);
      if (demoEnabled()) await mutate((s) => markNotifications(s, u, events));
      else {
        const { error } = await (
          await serverClient()
        ).rpc("read_notifications", { events });
        if (error) throw new AppError("SAVE_FAILED");
      }
      return NextResponse.json({ ok: true });
    }
    const c = commandSchema.parse(b);
    if (demoEnabled()) {
      const result = await mutate((s) => execute(s, u, c));
      return NextResponse.json({ ok: true, result });
    }
    const db = await serverClient();
    if (
      c.action === "submit" ||
      c.action === "draft" ||
      c.action === "review"
    ) {
      const name =
        c.action === "submit"
          ? "submit_attempt"
          : c.action === "draft"
            ? "save_draft"
            : "review_attempt";
      const { data, error } = await db.rpc(name, { command: c });
      if (error) {
        const code = [
          "FORBIDDEN",
          "LESSON_CHANGED",
          "NO_ATTEMPTS",
          "ANSWER_ALL",
          "INVALID_SCORE",
          "ID_CONFLICT",
        ].find((code) => error.message.includes(code));
        throw new AppError(
          code ?? "SAVE_FAILED",
          code === "FORBIDDEN" ? 403 : 409,
        );
      }
      return NextResponse.json({ ok: true, result: data });
    }
    const before = await loadStore(),
      after = structuredClone(before);
    const result = execute(after, u, c);
    await persistEntities(before, after);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return failure(e);
  }
}
