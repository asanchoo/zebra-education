"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCheck,
  Plus,
  Users,
  Layers,
  Pencil,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  Eye,
  Upload,
  LoaderCircle,
} from "lucide-react";
import type {
  Attempt,
  Block,
  BlockKind,
  Lesson,
  Locale,
  PublicLesson,
  Workspace,
} from "@/lib/types";
import { errorLabels, local } from "@/lib/i18n";
import { date, icons, T } from "@/lib/client";
import { Pill, Empty, Modal, Field, PageHeading } from "./ui";
import { BlockView } from "./learning";

export function Review({
  w,
  t,
  locale,
  run,
}: {
  w: Workspace;
  t: T;
  locale: Locale;
  run: (p: unknown, n?: string) => Promise<unknown>;
}) {
  const [filter, setFilter] = useState("pending"),
    [selected, setSelected] = useState<Attempt | null>(null),
    [busy, setBusy] = useState(false);
  const list = [...w.attempts]
    .filter((a) => a.manualMax > 0 && (filter === "all" || a.status === filter))
    .reverse();
  return (
    <>
      <PageHeading title={t("review")} subtitle={t("reviewDesc")} />
      <div className="tabs">
        {(["pending", "reviewed", "all"] as const).map((f) => (
          <button
            className={filter === f ? "active" : ""}
            onClick={() => setFilter(f)}
            key={f}
          >
            {t(
              f === "pending"
                ? "pendingFilter"
                : f === "reviewed"
                  ? "reviewedFilter"
                  : "all",
            )}{" "}
            {f === "pending" && (
              <span>
                {w.attempts.filter((a) => a.status === "pending").length}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="panel">
        {list.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("studentName")}</th>
                  <th>{t("lesson")}</th>
                  <th>{t("autoScore")}</th>
                  <th>{t("date")}</th>
                  <th>{t("status")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="table-person">
                        <span className="avatar tiny">
                          {
                            w.profiles.find((p) => p.id === a.studentId)
                              ?.name[0]
                          }
                        </span>
                        {w.profiles.find((p) => p.id === a.studentId)?.name}
                      </div>
                    </td>
                    <td>
                      {local(
                        w.lessons.find((l) => l.id === a.lessonId)!.title,
                        locale,
                      )}
                      <small className="muted">
                        {t("attempt")} {a.number} · {t("lessonVersion")}{" "}
                        {a.version}
                      </small>
                    </td>
                    <td>
                      {a.autoScore} / {a.autoMax}
                    </td>
                    <td>
                      {date(a.submittedAt, locale)}
                      {a.late && (
                        <small className="late-note">{t("late")}</small>
                      )}
                    </td>
                    <td>
                      <Pill status={a.status} t={t} />
                    </td>
                    <td>
                      <button
                        className="button secondary small"
                        onClick={() => setSelected(a)}
                      >
                        {t("check")}
                        <ArrowRight size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text={t("noReview")} icon={CheckCheck} />
        )}
      </div>
      {selected && (
        <Modal
          title={
            t("check") +
            " · " +
            w.profiles.find((p) => p.id === selected.studentId)?.name
          }
          onClose={() => setSelected(null)}
          wide
        >
          <div className="review-answers">
            {selected.snapshot
              .filter((b) => ["choice", "gap", "writing"].includes(b.type))
              .map((b) => (
                <div key={b.id} className="review-answer">
                  <h3>
                    {b.title}
                    <span>
                      {b.points} {t("score").toLowerCase()}
                    </span>
                  </h3>
                  <p>{selected.answers[b.id]}</p>
                  {b.type !== "writing" && (
                    <span
                      className={
                        "answer-result " +
                        (selected.autoResults[b.id] ? "correct" : "incorrect")
                      }
                    >
                      {t(selected.autoResults[b.id] ? "right" : "wrong")}
                    </span>
                  )}
                </div>
              ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(
                e.currentTarget,
                (e.nativeEvent as SubmitEvent).submitter,
              );
              const returned = f.get("decision") === "return";
              const feedback = String(f.get("feedback") ?? "");
              if (returned && !feedback.trim()) {
                alert(t("feedbackRequired"));
                return;
              }
              setBusy(true);
              void run(
                {
                  action: "review",
                  attemptId: selected.id,
                  score: Number(f.get("score")),
                  feedback,
                  returned,
                },
                t("savedNotice"),
              )
                .then(() => setSelected(null))
                .catch(() => {})
                .finally(() => setBusy(false));
            }}
          >
            <Field label={t("reviewScore") + ` (0–${selected.manualMax})`}>
              <input
                type="number"
                name="score"
                min={0}
                max={selected.manualMax}
                step={1}
                defaultValue={selected.manualScore ?? selected.manualMax}
                required
              />
            </Field>
            <Field label={t("feedback")}>
              <textarea
                rows={4}
                name="feedback"
                defaultValue={selected.feedback}
                placeholder={t("reviewFeedback")}
              />
            </Field>
            <div className="form-actions">
              <button
                className="button secondary"
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    {
                      action: "extra",
                      studentId: selected.studentId,
                      lessonId: selected.lessonId,
                    },
                    t("savedNotice"),
                  ).catch(() => {})
                }
              >
                {t("extra")}
              </button>
              <button
                className="button secondary"
                name="decision"
                value="return"
                disabled={busy}
              >
                {t("returnWork")}
              </button>
              <button
                className="button dark"
                name="decision"
                value="review"
                disabled={busy}
              >
                {t("saveReview")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
export function Builder({
  w,
  t,
  locale,
  run,
}: {
  w: Workspace;
  t: T;
  locale: Locale;
  run: (p: unknown, n?: string) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState<Lesson | null>(null),
    [form, setForm] = useState<"course" | "module" | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const edit = async (l: PublicLesson) => {
    setLoading(true);
    try {
      const res = await fetch("/api/lesson?id=" + encodeURIComponent(l.id));
      const data = await res.json();
      if (!res.ok) throw new Error();
      setEditing(data.lesson);
    } catch {
      setError(t("genericError"));
    } finally {
      setLoading(false);
    }
  };
  const create = (moduleId: string) =>
    setEditing({
      id: crypto.randomUUID(),
      moduleId,
      title: { ru: "", kk: "" },
      description: { ru: "", kk: "" },
      minutes: 15,
      position: w.lessons.filter((l) => l.moduleId === moduleId).length + 1,
      attemptLimit: 2,
      published: false,
      version: 1,
      blocks: [],
      keys: {},
    });
  if (editing)
    return (
      <Editor
        key={editing.id}
        original={editing}
        t={t}
        locale={locale}
        run={run}
        back={() => setEditing(null)}
      />
    );
  return (
    <>
      <PageHeading
        title={t("builder")}
        subtitle={t("builderDesc")}
        action={
          <button className="button dark" onClick={() => setForm("course")}>
            <Plus size={17} />
            {t("newCourse")}
          </button>
        }
      />
      {error && <p className="inline-error">{error}</p>}
      {w.courses.map((c) => (
        <section className="builder-course" key={c.id}>
          <div className="section-head">
            <h2>{c.title}</h2>
            <button
              className="button secondary small"
              onClick={() => setForm("module")}
            >
              <Plus size={15} />
              {t("newModule")}
            </button>
          </div>
          {w.modules
            .filter((m) => m.courseId === c.id)
            .map((m) => (
              <div className="panel builder-module" key={m.id}>
                <div className="section-head">
                  <h3>
                    <Layers size={17} />
                    {local(m.title, locale)}
                  </h3>
                  <button className="text-button" onClick={() => create(m.id)}>
                    <Plus size={16} />
                    {t("newLesson")}
                  </button>
                </div>
                {w.lessons
                  .filter((l) => l.moduleId === m.id)
                  .sort((a, b) => a.position - b.position)
                  .map((l) => (
                    <div className="builder-lesson" key={l.id}>
                      <span className="lesson-row-icon">
                        <BookOpen size={18} />
                      </span>
                      <div>
                        <strong>{local(l.title, locale)}</strong>
                        <span>
                          {l.blocks.length}{" "}
                          {t("addBlock").split(" ").pop()?.toLowerCase()} ·{" "}
                          {l.minutes} {t("minutes")}
                        </span>
                      </div>
                      <Pill
                        status={l.published ? "published" : "draft"}
                        t={t}
                      />
                      <button
                        className="button secondary small"
                        disabled={loading}
                        onClick={() => void edit(l)}
                      >
                        <Pencil size={14} />
                        {t("edit")}
                      </button>
                    </div>
                  ))}
              </div>
            ))}
        </section>
      ))}
      {!w.courses.length && <Empty text={t("needCourse")} />}{" "}
      {form && (
        <Modal
          title={t(form === "course" ? "newCourse" : "newModule")}
          onClose={() => setForm(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const payload =
                form === "course"
                  ? {
                      action: "course",
                      title: f.get("title"),
                      level: f.get("level"),
                      description: { ru: f.get("ru"), kk: f.get("kk") },
                    }
                  : {
                      action: "module",
                      courseId: f.get("courseId"),
                      title: { ru: f.get("ru"), kk: f.get("kk") },
                    };
              void run(payload, t("savedNotice"))
                .then(() => setForm(null))
                .catch(() => {});
            }}
          >
            {form === "course" ? (
              <>
                <Field label={t("courseTitle")}>
                  <input name="title" required />
                </Field>
                <Field label={t("courseLevel")}>
                  <input name="level" defaultValue="Beginner" required />
                </Field>
              </>
            ) : (
              <Field label={t("courses")}>
                <select name="courseId">
                  {w.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label={t(form === "course" ? "descRu" : "titleRu")}>
              <input name="ru" required />
            </Field>
            <Field label={t(form === "course" ? "descKk" : "titleKk")}>
              <input name="kk" required />
            </Field>
            <button className="button dark">{t("save")}</button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function Editor({
  original,
  t,
  locale,
  run,
  back,
}: {
  original: Lesson;
  t: T;
  locale: Locale;
  run: (p: unknown, n?: string) => Promise<unknown>;
  back: () => void;
}) {
  const [lesson, setLesson] = useState<Lesson>(structuredClone(original)),
    [preview, setPreview] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [dirty, setDirty] = useState(false),
    [uploading, setUploading] = useState("");
  const change = (next: Lesson) => {
    setLesson(next);
    setDirty(true);
  };
  const changeBlock = (id: string, patch: Partial<Block>) =>
    change({
      ...lesson,
      blocks: lesson.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    });
  const add = (type: BlockKind) => {
    const id = crypto.randomUUID();
    change({
      ...lesson,
      blocks: [
        ...lesson.blocks,
        {
          id,
          type,
          title: "",
          content: "",
          ...(["choice", "gap", "writing"].includes(type) ? { points: 1 } : {}),
          ...(type === "choice" ? { options: ["", ""] } : {}),
          ...(["image", "audio", "video"].includes(type) ? { url: "" } : {}),
        },
      ],
    });
  };
  const move = (index: number, direction: number) => {
    const blocks = [...lesson.blocks];
    const next = index + direction;
    if (next < 0 || next >= blocks.length) return;
    [blocks[index], blocks[next]] = [blocks[next], blocks[index]];
    change({ ...lesson, blocks });
  };
  async function save(published: boolean) {
    setBusy(true);
    setError("");
    try {
      const result = (await run(
        { action: "lesson", lesson: { ...lesson, published } },
        t("savedNotice"),
      )) as { result: Lesson };
      setLesson(result.result);
      setDirty(false);
    } catch (e) {
      setError(t(errorLabels[(e as Error).message] ?? "genericError"));
    } finally {
      setBusy(false);
    }
  }
  async function upload(id: string, file: File) {
    if (file.size > 4 * 1024 * 1024) {
      setError(t("fileTooLarge"));
      return;
    }
    setUploading(id);
    setError("");
    const f = new FormData();
    f.set("file", file);
    f.set("lessonId", lesson.id);
    f.set("moduleId", lesson.moduleId);
    try {
      const r = await fetch("/api/media", { method: "POST", body: f });
      const data = await r.json();
      if (!r.ok) throw new Error();
      changeBlock(id, { url: data.url });
    } catch {
      setError(t("genericError"));
    } finally {
      setUploading("");
    }
  }
  const goBack = () => {
    if (
      !dirty ||
      confirm(
        locale === "ru"
          ? "Есть несохранённые изменения. Выйти без сохранения?"
          : "Сақталмаған өзгерістер бар. Сақтамай шығу керек пе?",
      )
    )
      back();
  };
  return (
    <>
      <button className="back-button" onClick={goBack}>
        <ArrowLeft size={16} />
        {t("builder")}
      </button>
      <PageHeading
        title={local(lesson.title, locale) || t("newLesson")}
        action={
          <div className="heading-actions">
            <button
              className="button secondary"
              onClick={() => setPreview(true)}
            >
              <Eye size={16} />
              {t("preview")}
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void save(lesson.published)}
            >
              {t("save")}
            </button>
            <button
              className="button dark"
              disabled={busy}
              onClick={() => void save(!lesson.published)}
            >
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Check size={16} />
              )}{" "}
              {t(lesson.published ? "unpublish" : "publish")}
            </button>
          </div>
        }
      />
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <div className="editor-layout">
        <div className="editor-blocks">
          <div className="panel editor-details">
            <h3>{t("lesson")}</h3>
            <div className="form-grid">
              <Field label={t("titleRu")}>
                <input
                  value={lesson.title.ru}
                  onChange={(e) =>
                    change({
                      ...lesson,
                      title: { ...lesson.title, ru: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label={t("titleKk")}>
                <input
                  value={lesson.title.kk}
                  onChange={(e) =>
                    change({
                      ...lesson,
                      title: { ...lesson.title, kk: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label={t("descRu")}>
                <textarea
                  rows={2}
                  value={lesson.description.ru}
                  onChange={(e) =>
                    change({
                      ...lesson,
                      description: {
                        ...lesson.description,
                        ru: e.target.value,
                      },
                    })
                  }
                />
              </Field>
              <Field label={t("descKk")}>
                <textarea
                  rows={2}
                  value={lesson.description.kk}
                  onChange={(e) =>
                    change({
                      ...lesson,
                      description: {
                        ...lesson.description,
                        kk: e.target.value,
                      },
                    })
                  }
                />
              </Field>
            </div>
          </div>
          {lesson.blocks.map((b, index) => {
            const Icon = icons[b.type];
            return (
              <div className="panel editor-block" key={b.id}>
                <div className="editor-block-head">
                  <span>
                    <GripVertical size={16} />
                    <Icon size={17} />
                    <strong>
                      {index + 1}. {t(b.type)}
                    </strong>
                  </span>
                  <div>
                    <button
                      className="icon-button"
                      onClick={() => move(index, -1)}
                      aria-label={t("moveUp")}
                      disabled={index === 0}
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      className="icon-button"
                      onClick={() => move(index, 1)}
                      aria-label={t("moveDown")}
                      disabled={index === lesson.blocks.length - 1}
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      className="icon-button"
                      onClick={() => {
                        const id = crypto.randomUUID(),
                          blocks = [...lesson.blocks];
                        blocks.splice(index + 1, 0, {
                          ...structuredClone(b),
                          id,
                        });
                        change({
                          ...lesson,
                          blocks,
                          keys: {
                            ...lesson.keys,
                            ...(lesson.keys[b.id]
                              ? { [id]: structuredClone(lesson.keys[b.id]) }
                              : {}),
                          },
                        });
                      }}
                      aria-label={t("duplicate")}
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      className="icon-button danger"
                      aria-label={t("remove")}
                      onClick={() => {
                        if (confirm(t("confirmDelete"))) {
                          const keys = { ...lesson.keys };
                          delete keys[b.id];
                          change({
                            ...lesson,
                            blocks: lesson.blocks.filter((x) => x.id !== b.id),
                            keys,
                          });
                        }
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <Field label={t("blockTitle")}>
                  <input
                    value={b.title}
                    onChange={(e) =>
                      changeBlock(b.id, { title: e.target.value })
                    }
                  />
                </Field>
                <Field label={t("blockContent")}>
                  <textarea
                    rows={b.type === "text" ? 5 : 2}
                    value={b.content}
                    onChange={(e) =>
                      changeBlock(b.id, { content: e.target.value })
                    }
                  />
                </Field>
                {["image", "audio", "video"].includes(b.type) && (
                  <>
                    <Field label={t("blockUrl")}>
                      <input
                        placeholder={
                          b.type === "video"
                            ? "https://www.youtube.com/watch?v=…"
                            : "https://…"
                        }
                        value={b.url ?? ""}
                        onChange={(e) =>
                          changeBlock(b.id, { url: e.target.value })
                        }
                      />
                    </Field>
                    {b.type !== "video" && (
                      <label className="upload-button">
                        <Upload size={16} />
                        {uploading === b.id ? t("saving") : t("upload")}
                        <input
                          type="file"
                          accept={
                            b.type === "image"
                              ? "image/png,image/jpeg,image/webp"
                              : "audio/mpeg,audio/wav,audio/ogg,audio/mp4"
                          }
                          disabled={!!uploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void upload(b.id, file);
                          }}
                        />
                      </label>
                    )}
                  </>
                )}
                {b.type === "choice" && (
                  <Field label={t("options")}>
                    <textarea
                      rows={3}
                      value={b.options?.join("\n") ?? ""}
                      onChange={(e) =>
                        changeBlock(b.id, {
                          options: e.target.value.split("\n"),
                        })
                      }
                    />
                  </Field>
                )}
                {["choice", "gap"].includes(b.type) && (
                  <Field label={t("accepted")}>
                    <textarea
                      rows={2}
                      value={lesson.keys[b.id]?.accepted.join("\n") ?? ""}
                      onChange={(e) =>
                        change({
                          ...lesson,
                          keys: {
                            ...lesson.keys,
                            [b.id]: { accepted: e.target.value.split("\n") },
                          },
                        })
                      }
                    />
                  </Field>
                )}
                {["choice", "gap", "writing"].includes(b.type) && (
                  <Field label={t("points")}>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={b.points ?? 1}
                      onChange={(e) =>
                        changeBlock(b.id, { points: Number(e.target.value) })
                      }
                    />
                  </Field>
                )}
              </div>
            );
          })}
          {!lesson.blocks.length && (
            <Empty text={t("addBlock")} icon={Layers} />
          )}
        </div>
        <aside className="editor-side">
          <div className="panel">
            <h3>{t("addBlock")}</h3>
            <div className="block-palette">
              {(Object.keys(icons) as BlockKind[]).map((type) => {
                const Icon = icons[type];
                return (
                  <button key={type} onClick={() => add(type)}>
                    <Icon size={18} />
                    {t(type)}
                    <Plus size={14} />
                  </button>
                );
              })}
            </div>
            <hr />
            <Field label={t("lessonLimit")}>
              <input
                type="number"
                min={1}
                max={20}
                value={lesson.attemptLimit}
                onChange={(e) =>
                  change({ ...lesson, attemptLimit: Number(e.target.value) })
                }
              />
            </Field>
            <Field label={t("duration")}>
              <input
                type="number"
                min={1}
                max={180}
                value={lesson.minutes}
                onChange={(e) =>
                  change({ ...lesson, minutes: Number(e.target.value) })
                }
              />
            </Field>
            <Pill status={lesson.published ? "published" : "draft"} t={t} />
          </div>
        </aside>
      </div>
      {preview && (
        <Modal title={t("preview")} onClose={() => setPreview(false)} wide>
          <p className="info-banner">{t("previewNotice")}</p>
          <h2>{local(lesson.title, locale)}</h2>
          {lesson.blocks.map((b) => (
            <BlockView
              key={b.id}
              b={b}
              value=""
              onChange={() => {}}
              disabled
              t={t}
            />
          ))}
        </Modal>
      )}
    </>
  );
}
export function People({
  w,
  t,
  locale,
  run,
}: {
  w: Workspace;
  t: T;
  locale: Locale;
  run: (p: unknown, n?: string) => Promise<unknown>;
}) {
  const [modal, setModal] = useState<"invite" | "group" | "enroll" | null>(
      null,
    ),
    [selected, setSelected] = useState<string | null>(null),
    [editing, setEditing] = useState<string | undefined>(),
    [target, setTarget] = useState("group"),
    [busy, setBusy] = useState(false),
    [inviteLink, setInviteLink] = useState(""),
    [deleting, setDeleting] = useState<string | null>(null);
  const admin = w.user.role === "admin";
  const group = w.groups.find((g) => g.id === selected);
  const deleteTarget = w.profiles.find((p) => p.id === deleting);
  const perform = (payload: unknown, notice: string) => {
    setBusy(true);
    void run(payload, notice)
      .then((result) => {
        const invitation = result as { inviteLink?: string };
        if (invitation.inviteLink) setInviteLink(invitation.inviteLink);
        setModal(null);
      })
      .catch(() => {})
      .finally(() => setBusy(false));
  };
  return (
    <>
      <PageHeading
        title={t("students")}
        subtitle="ZEBRA Education"
        action={
          admin && (
            <button className="button dark" onClick={() => setModal("invite")}>
              <Plus size={17} />
              {t("invite")}
            </button>
          )
        }
      />
      <div className="section-head">
        <h2>{t("groups")}</h2>
        {admin && (
          <div className="heading-actions">
            <button
              className="button secondary small"
              onClick={() => {
                setEditing(undefined);
                setModal("group");
              }}
            >
              <Plus size={15} />
              {t("newGroup")}
            </button>
            <button
              className="button secondary small"
              onClick={() => setModal("enroll")}
            >
              {t("assign")}
              <ArrowUpRight size={15} />
            </button>
          </div>
        )}
      </div>
      <div className="groups-grid">
        {w.groups.map((g) => (
          <div key={g.id} className="panel group-card">
            <span className="group-icon">
              <Users size={22} />
            </span>
            <h3>{g.name}</h3>
            <p>{w.profiles.find((p) => p.id === g.teacherId)?.name}</p>
            <span className="muted">
              {g.studentIds.length} {t("totalStudents").toLowerCase()}
            </span>
            <div className="group-course-list">
              {w.enrollments
                .filter((e) => e.groupId === g.id)
                .map((e) => (
                  <span key={e.id}>
                    <BookOpen size={13} />
                    {w.courses.find((c) => c.id === e.courseId)?.title}
                  </span>
                ))}
            </div>
            <div className="form-actions">
              <button
                className="button secondary small"
                onClick={() => setSelected(g.id)}
              >
                {t("access")}
              </button>
              {admin && (
                <button
                  className="icon-button"
                  aria-label={t("edit")}
                  onClick={() => {
                    setEditing(g.id);
                    setModal("group");
                  }}
                >
                  <Pencil size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="section-head">
        <h2>{t("people")}</h2>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("studentName")}</th>
                <th>{t("email")}</th>
                <th>{t("role")}</th>
                <th>{t("status")}</th>
                {admin && <th />}
              </tr>
            </thead>
            <tbody>
              {w.profiles.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="table-person">
                      <span className="avatar tiny">{p.name[0]}</span>
                      {p.name}
                    </div>
                  </td>
                  <td>{p.email}</td>
                  <td>{t(p.role)}</td>
                  <td>
                    <span
                      className={"pill " + (p.active ? "published" : "draft")}
                    >
                      {t(p.active ? "active" : "inactive")}
                    </span>
                  </td>
                  {admin && (
                    <td>
                      {p.id !== w.user.id && (
                        <div className="people-actions">
                          <button
                            className="text-button"
                            onClick={() =>
                              void run(
                                {
                                  action: "profile",
                                  id: p.id,
                                  role: p.role,
                                  active: !p.active,
                                },
                                t("savedNotice"),
                              ).catch(() => {})
                            }
                          >
                            {t(p.active ? "disable" : "enable")}
                          </button>
                          {p.role !== "admin" && (
                            <button
                              className="text-button danger-text"
                              aria-label={`${t("deleteAccount")} ${p.name}`}
                              onClick={() => setDeleting(p.id)}
                            >
                              <Trash2 size={15} />
                              {t("delete")}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {deleteTarget && (
        <Modal
          title={t("deleteAccount")}
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <p>
            <strong>{deleteTarget.name}</strong> · {deleteTarget.email}
          </p>
          <p className="delete-explanation">
            {t(
              deleteTarget.role === "teacher"
                ? "deleteTeacherNote"
                : "deleteStudentNote",
            )}
          </p>
          <div className="form-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              {t("cancel")}
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void run(
                  { action: "deleteProfile", id: deleteTarget.id },
                  t("accountDeleted"),
                )
                  .then(() => setDeleting(null))
                  .catch(() => {})
                  .finally(() => setBusy(false));
              }}
            >
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Trash2 size={16} />
              )}{" "}
              {t("deleteAccount")}
            </button>
          </div>
        </Modal>
      )}
      {inviteLink && (
        <Modal
          title={locale === "ru" ? "Ссылка-приглашение" : "Шақыру сілтемесі"}
          onClose={() => setInviteLink("")}
        >
          <p className="muted">
            {locale === "ru"
              ? "Письмо не отправлено. Передайте эту одноразовую ссылку ученику или преподавателю лично."
              : "Хат жіберілген жоқ. Бұл бір реттік сілтемені оқушыға немесе мұғалімге жеке жіберіңіз."}
          </p>
          <Field label={locale === "ru" ? "Приглашение" : "Шақыру"}>
            <input readOnly value={inviteLink} />
          </Field>
          <button
            className="button dark"
            onClick={() => void navigator.clipboard.writeText(inviteLink)}
          >
            <Copy size={16} />
            {locale === "ru" ? "Скопировать ссылку" : "Сілтемені көшіру"}
          </button>
        </Modal>
      )}
      {modal === "invite" && (
        <Modal title={t("invite")} onClose={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              perform(
                {
                  action: "invite",
                  name: f.get("name"),
                  email: f.get("email"),
                  role: f.get("role"),
                },
                w.demo ? t("demoInvited") : "",
              );
            }}
          >
            <Field label={t("inviteName")}>
              <input name="name" required />
            </Field>
            <Field label={t("email")}>
              <input type="email" name="email" required />
            </Field>
            <Field label={t("role")}>
              <select name="role">
                <option value="student">{t("student")}</option>
                <option value="teacher">{t("teacher")}</option>
              </select>
            </Field>
            <button className="button dark" disabled={busy}>
              {t("invite")}
            </button>
          </form>
        </Modal>
      )}
      {modal === "group" && (
        <Modal
          title={t(editing ? "edit" : "newGroup")}
          onClose={() => setModal(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              perform(
                {
                  action: "group",
                  id: editing,
                  name: f.get("name"),
                  teacherId: f.get("teacherId"),
                  studentIds: f.getAll("studentIds"),
                },
                t("groupSaved"),
              );
            }}
          >
            <Field label={t("groupName")}>
              <input
                name="name"
                defaultValue={w.groups.find((g) => g.id === editing)?.name}
                required
              />
            </Field>
            <Field label={t("teacher")}>
              <select
                name="teacherId"
                defaultValue={w.groups.find((g) => g.id === editing)?.teacherId}
              >
                {w.profiles
                  .filter((p) => p.role !== "student" && p.active)
                  .map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </Field>
            <p className="form-label">{t("addStudents")}</p>
            <div className="checkbox-list">
              {w.profiles
                .filter((p) => p.role === "student" && p.active)
                .map((p) => (
                  <label key={p.id}>
                    <input
                      type="checkbox"
                      name="studentIds"
                      value={p.id}
                      defaultChecked={w.groups
                        .find((g) => g.id === editing)
                        ?.studentIds.includes(p.id)}
                    />
                    {p.name}
                    <span>{p.email}</span>
                  </label>
                ))}
            </div>
            <button className="button dark" disabled={busy}>
              {t("save")}
            </button>
          </form>
        </Modal>
      )}
      {modal === "enroll" && (
        <Modal title={t("assign")} onClose={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              perform(
                {
                  action: "enroll",
                  courseId: f.get("courseId"),
                  ...(target === "group"
                    ? { groupId: f.get("targetId") }
                    : { studentId: f.get("targetId") }),
                  mode: f.get("mode"),
                },
                t("courseAssigned"),
              );
            }}
          >
            <Field label={t("courses")}>
              <select name="courseId" required>
                {w.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("enrollmentTarget")}>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="group">{t("groups")}</option>
                <option value="student">{t("student")}</option>
              </select>
            </Field>
            <Field
              label={t(target === "group" ? "selectGroup" : "selectStudent")}
            >
              <select name="targetId" required>
                {target === "group"
                  ? w.groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))
                  : w.profiles
                      .filter((p) => p.role === "student")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
              </select>
            </Field>
            <Field label={t("access")}>
              <select name="mode" key={target}>
                {target === "group" && (
                  <option value="group">{t("groupMode")}</option>
                )}
                <option value="self">{t("selfMode")}</option>
              </select>
            </Field>
            <button className="button dark" disabled={busy}>
              {t("assign")}
            </button>
          </form>
        </Modal>
      )}
      {group && (
        <Modal
          title={group.name + " · " + t("access")}
          onClose={() => setSelected(null)}
          wide
        >
          <div className="group-member-chips">
            {group.studentIds.map((id) => (
              <span key={id}>{w.profiles.find((p) => p.id === id)?.name}</span>
            ))}
          </div>
          {w.lessons
            .filter(
              (l) =>
                l.published &&
                w.enrollments.some(
                  (e) =>
                    e.groupId === group.id &&
                    e.courseId ===
                      w.modules.find((m) => m.id === l.moduleId)?.courseId,
                ),
            )
            .map((l) => (
              <ReleaseRow
                key={l.id}
                w={w}
                groupId={group.id}
                l={l}
                t={t}
                locale={locale}
                run={run}
              />
            ))}
        </Modal>
      )}
    </>
  );
}
function ReleaseRow({
  w,
  groupId,
  l,
  t,
  locale,
  run,
}: {
  w: Workspace;
  groupId: string;
  l: PublicLesson;
  t: T;
  locale: Locale;
  run: (p: unknown, n?: string) => Promise<unknown>;
}) {
  const r = w.releases.find(
    (r) => r.groupId === groupId && r.lessonId === l.id,
  );
  const [open, setOpen] = useState(!!r),
    [homework, setHomework] = useState(r?.homework ?? false),
    [due, setDue] = useState(
      r?.dueAt
        ? new Date(new Date(r.dueAt).getTime() + 5 * 3600 * 1000)
            .toISOString()
            .slice(0, 16)
        : "",
    ),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="release-row"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        void run(
          {
            action: "release",
            groupId,
            lessonId: l.id,
            open,
            homework,
            dueAt: due ? new Date(due + ":00+05:00").toISOString() : undefined,
          },
          t("savedNotice"),
        )
          .catch(() => {})
          .finally(() => setBusy(false));
      }}
    >
      <strong>{local(l.title, locale)}</strong>
      <div>
        <label>
          <input
            type="checkbox"
            checked={open}
            onChange={(e) => setOpen(e.target.checked)}
          />
          {t("release")}
        </label>
        <label>
          <input
            type="checkbox"
            checked={homework}
            onChange={(e) => setHomework(e.target.checked)}
            disabled={!open}
          />
          {t("homeworkLabel")}
        </label>
        <label>
          {t("due")}
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            disabled={!homework || !open}
          />
        </label>
        <button className="button secondary small" disabled={busy}>
          {t("save")}
        </button>
      </div>
    </form>
  );
}
