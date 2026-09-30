import { NextResponse, type NextRequest } from "next/server";
import { serverClient } from "@/lib/supabase";
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (code) {
    const { error } = await (
      await serverClient()
    ).auth.exchangeCodeForSession(code);
    return NextResponse.redirect(
      new URL(error ? "/?authError=1" : "/?setPassword=1", req.url),
    );
  }
  return NextResponse.redirect(new URL("/?setPassword=1", req.url));
}
