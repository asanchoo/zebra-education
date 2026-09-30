import { NextResponse, type NextRequest } from "next/server";
import { currentUser, loadStore } from "@/lib/repository";
import { canOpen } from "@/lib/domain";
export async function GET(req: NextRequest) {
  const u = await currentUser();
  if (!u || u.role === "student")
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const s = await loadStore(),
    l = s.lessons.find((l) => l.id === req.nextUrl.searchParams.get("id"));
  if (!l || !canOpen(s, u, l))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  return NextResponse.json(
    { lesson: l },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
