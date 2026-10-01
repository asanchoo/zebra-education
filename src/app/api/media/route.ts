import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  currentUser,
  loadStore,
  mutate,
  persistEntities,
} from "@/lib/repository";
import { execute } from "@/lib/commands";
import { canOpen, managesCourse } from "@/lib/domain";
import { demoEnabled, serverClient } from "@/lib/supabase";
const types: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
};
export async function POST(req: NextRequest) {
  if (
    !req.headers.get("origin") ||
    new URL(req.headers.get("origin")!).host !== req.headers.get("host")
  )
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const u = await currentUser();
  if (!u || u.role === "student")
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const f = await req.formData(),
    file = f.get("file"),
    lessonId = String(f.get("lessonId") ?? ""),
    moduleId = String(f.get("moduleId") ?? "");
  if (
    !(file instanceof File) ||
    !types[file.type] ||
    file.size > 4 * 1024 * 1024 ||
    !file.size ||
    !/^[a-zA-Z0-9-]+$/.test(lessonId)
  )
    return NextResponse.json({ error: "INVALID_FILE" }, { status: 400 });
  const s = await loadStore(),
    m = s.modules.find((m) => m.id === moduleId);
  if (!m || !managesCourse(s, u, m.courseId))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const existing = s.lessons.find((l) => l.id === lessonId);
  if (existing && !canOpen(s, u, existing))
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!existing) {
    const command = {
      action: "lesson" as const,
      lesson: {
        id: lessonId,
        moduleId,
        title: { ru: "Новый урок", kk: "Жаңа сабақ" },
        description: { ru: "", kk: "" },
        minutes: 15,
        position:
          Math.max(
            0,
            ...s.lessons
              .filter((l) => l.moduleId === moduleId)
              .map((l) => l.position),
          ) + 1,
        attemptLimit: 2,
        published: false,
        version: 1,
        blocks: [],
        keys: {},
      },
    };
    if (demoEnabled()) await mutate((store) => execute(store, u, command));
    else {
      const after = structuredClone(s);
      execute(after, u, command);
      await persistEntities(s, after);
    }
  }
  const id = lessonId + "/" + crypto.randomUUID() + "." + types[file.type];
  const bytes = Buffer.from(await file.arrayBuffer());
  if (demoEnabled()) {
    const p = path.join(process.cwd(), ".data", "media", lessonId);
    await fs.mkdir(p, { recursive: true });
    await fs.writeFile(path.join(process.cwd(), ".data", "media", id), bytes);
  } else {
    const { error } = await (
      await serverClient()
    ).storage
      .from("lesson-media")
      .upload(id, bytes, { contentType: file.type });
    if (error)
      return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 500 });
  }
  return NextResponse.json({ url: "/api/media?id=" + encodeURIComponent(id) });
}
export async function GET(req: NextRequest) {
  const u = await currentUser(),
    id = req.nextUrl.searchParams.get("id") ?? "";
  if (
    !u ||
    !/^[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+\.(png|jpg|webp|mp3|wav|ogg|m4a)$/.test(id)
  )
    return new NextResponse(null, { status: 403 });
  const s = await loadStore(),
    l = s.lessons.find((l) => l.id === id.split("/")[0]);
  if (!l || !canOpen(s, u, l)) return new NextResponse(null, { status: 403 });
  if (demoEnabled()) {
    try {
      const bytes = await fs.readFile(
        path.join(process.cwd(), ".data", "media", id),
      );
      const ext = id.split(".").pop();
      const mime = Object.keys(types).find((k) => types[k] === ext)!;
      return new NextResponse(bytes, {
        headers: {
          "Content-Type": mime,
          "Cache-Control": "private, max-age=60",
        },
      });
    } catch {
      return new NextResponse(null, { status: 404 });
    }
  }
  const { data, error } = await (
    await serverClient()
  ).storage
    .from("lesson-media")
    .createSignedUrl(id, 60);
  if (error) return new NextResponse(null, { status: 403 });
  return NextResponse.redirect(data.signedUrl);
}
