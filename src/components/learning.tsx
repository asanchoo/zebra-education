"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  ClipboardList,
  ChartNoAxesCombined,
  ChevronRight,
  Check,
  CheckCheck,
  Clock,
  LockKeyhole,
  X,
  Layers,
  Play,
  Headphones,
  PenLine,
  Eye,
  Sparkles,
  CheckCircle2,
  LoaderCircle,
  Send,
} from "lucide-react";
import type {
  Attempt,
  Block,
  Course,
  Locale,
  PublicLesson,
  Workspace,
} from "@/lib/types";
import { errorLabels, local, Label } from "@/lib/i18n";
import { date, latest, isOpen, icons, T } from "@/lib/client";
import { CourseArt, Pill, Empty, PageHeading, Stat } from "./ui";

export function average(w: Workspace) {
  const ids = new Set(w.attempts.map((a) => a.lessonId));
  const completed = [...ids]
    .map((id) => latest(w, id))
    .filter((a) => a?.status === "reviewed");
  return completed.length
    ? Math.round(
        completed.reduce(
          (sum, a) =>
            sum +
            ((a.autoScore + (a.manualScore ?? 0)) /
              (a.autoMax + a.manualMax || 1)) *
              100,
          0,
        ) / completed.length,
      ) + "%"
    : "—";
}
export function CourseCard({
  c,
  w,
  t,
  locale,
  open,
}: {
  c: Course;
  w: Workspace;
  t: T;
  locale: Locale;
  open: () => void;
}) {
  const mods = w.modules.filter((m) => m.courseId === c.id);
  const lessons = w.lessons.filter((l) =>
    mods.some((m) => m.id === l.moduleId),
  );
  const done = lessons.filter((l) => !!latest(w, l.id)).length;
  const percent = lessons.length
    ? Math.round((done / lessons.length) * 100)
    : 0;
  return (
    <article className="course-card">
      <div className="course-cover">
        <div>
          <span className="course-level">{c.level}</span>
          <strong>
            {c.title}
            <span> ↗</span>
          </strong>
          <span className="course-cover-label">ZEBRA EDUCATION</span>
        </div>
        <CourseArt small />
      </div>
      <div className="course-card-body">
        <div className="course-meta">
          <span>
            <Layers size={13} />
            {mods.length} {t("modules")}
          </span>
          <span>
            <BookOpen size={13} />
            {lessons.length} {t("lessons")}
          </span>
        </div>
        <button className="course-title" onClick={open}>
          {c.title}
          <ArrowUpRight size={18} />
        </button>
        <p>{local(c.description, locale)}</p>
        <div className="course-progress-label">
          <span>{t("progress")}</span>
          <strong>{percent}%</strong>
        </div>
        <div className="progress-track">
          <i style={{ width: percent + "%" }} />
        </div>
        <div className="course-bottom">
          <div className="mini-teacher">
            <span className="avatar tiny">
              {w.profiles.find((p) => p.id === c.teacherId)?.name.slice(0, 1) ??
                "Z"}
            </span>
            <span>
              {w.profiles.find((p) => p.id === c.teacherId)?.name ??
                "ZEBRA Education"}
            </span>
          </div>
          <button
            className="circle-button"
            onClick={open}
            aria-label={t("openCourse")}
          >
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </article>
  );
}
export function CourseView({
  course,
  w,
  t,
  locale,
  open,
  back,
}: {
  course: Course;
  w: Workspace;
  t: T;
  locale: Locale;
  open: (id: string) => void;
  back: () => void;
}) {
  const mods = w.modules
    .filter((m) => m.courseId === course.id)
    .sort((a, b) => a.position - b.position);
  return (
    <>
      <button className="back-button" onClick={back}>
        <ArrowLeft size={16} />
        {t("allCourses")}
      </button>
      <div className="course-detail-hero">
        <div>
          <span className="pill published">{course.level}</span>
          <h1>{course.title}</h1>
          <p>{local(course.description, locale)}</p>
        </div>
        <CourseArt small />
      </div>
      <div className="module-list">
        {mods.map((m, i) => (
          <section key={m.id} className="module-section">
            <div className="module-heading">
              <span className="module-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <span className="eyebrow">
                  {t("module")} {i + 1}
                </span>
                <h2>{local(m.title, locale)}</h2>
              </div>
            </div>
            {w.lessons
              .filter((l) => l.moduleId === m.id)
              .sort((a, b) => a.position - b.position)
              .map((l, index) => {
                const a = latest(w, l.id),
                  opened = isOpen(w, l);
                return (
                  <button
                    key={l.id}
                    className={"lesson-row " + (!opened ? "is-locked" : "")}
                    disabled={!opened}
                    onClick={() => open(l.id)}
                  >
                    <span
                      className={"lesson-row-icon " + (a ? "complete" : "")}
                    >
                      {!opened ? (
                        <LockKeyhole size={18} />
                      ) : a ? (
                        <Check size={20} />
                      ) : (
                        <Play size={18} />
                      )}
                    </span>
                    <div className="lesson-row-copy">
                      <span>
                        {t("lesson")} {index + 1}
                      </span>
                      <strong>{local(l.title, locale)}</strong>
                      <p>{local(l.description, locale)}</p>
                    </div>
                    <span className="lesson-time">
                      <Clock size={13} />
                      {l.minutes} {t("minutes")}
                    </span>
                    {a ? (
                      <Pill status={a.status} t={t} />
                    ) : !opened ? (
                      <span className="locked-text">{t("locked")}</span>
                    ) : (
                      <span className="lesson-open">
                        {t("start")}
                        <ChevronRight size={16} />
                      </span>
                    )}
                  </button>
                );
              })}
          </section>
        ))}
      </div>
    </>
  );
}
export function HomeworkList({
  w,
  t,
  locale,
  open,
  compact = false,
}: {
  w: Workspace;
  t: T;
  locale: Locale;
  open: (id: string) => void;
  compact?: boolean;
}) {
  const tasks = w.releases.filter(
    (r) =>
      r.homework &&
      w.lessons.some((l) => l.id === r.lessonId) &&
      w.groups.some(
        (g) => g.id === r.groupId && g.studentIds.includes(w.user.id),
      ),
  );
  const unique = tasks.filter(
    (r, i) => tasks.findIndex((x) => x.lessonId === r.lessonId) === i,
  );
  return unique.length ? (
    <div className={compact ? "compact-tasks" : "homework-list"}>
      {unique.slice(0, compact ? 3 : undefined).map((r) => {
        const l = w.lessons.find((l) => l.id === r.lessonId)!,
          a = latest(w, l.id);
        return (
          <button
            className="task-card"
            key={r.id}
            onClick={() => open(l.id)}
            disabled={!isOpen(w, l)}
          >
            <span className="task-icon">
              {l.blocks.some((b) => b.type === "audio") ? (
                <Headphones size={20} />
              ) : (
                <PenLine size={20} />
              )}
            </span>
            <div>
              <strong>{local(l.title, locale)}</strong>
              <span>
                {r.dueAt ? t("due") + ": " + date(r.dueAt, locale) : t("noDue")}
              </span>
            </div>
            {a ? <Pill status={a.status} t={t} /> : <ChevronRight size={17} />}
          </button>
        );
      })}
    </div>
  ) : (
    <div className="compact-empty">
      <ClipboardList size={24} />
      <p>{t("noHomework")}</p>
    </div>
  );
}
function mediaUrl(url?: string) {
  if (!url) return undefined;
  return url.startsWith("/") || url.startsWith("https://") ? url : undefined;
}
function videoUrl(value?: string) {
  try {
    const u = new URL(value ?? "");
    if (u.hostname === "youtu.be")
      return (
        "https://www.youtube-nocookie.com/embed/" +
        encodeURIComponent(u.pathname.slice(1))
      );
    if (["www.youtube.com", "youtube.com"].includes(u.hostname))
      return (
        "https://www.youtube-nocookie.com/embed/" +
        encodeURIComponent(
          u.searchParams.get("v") ?? u.pathname.split("/").pop() ?? "",
        )
      );
    if (
      ["vimeo.com", "www.vimeo.com"].includes(u.hostname) &&
      /^\/\d+$/.test(u.pathname)
    )
      return "https://player.vimeo.com/video/" + u.pathname.slice(1);
  } catch {}
  return null;
}
export function BlockView({
  b,
  value,
  onChange,
  disabled,
  t,
  result,
}: {
  b: Block;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  t: T;
  result?: boolean;
}) {
  const [audioError, setAudioError] = useState(false);
  const Icon = icons[b.type];
  const vid = videoUrl(b.url);
  return (
    <section className={"lesson-block block-" + b.type}>
      <div className="block-heading">
        <span className="block-type-icon">
          <Icon size={17} />
        </span>
        <h3>{b.title}</h3>
        {b.points && (
          <span className="block-points">
            {b.points} {t("score").toLowerCase()}
          </span>
        )}
      </div>
      {b.type === "text" ? (
        <p className="lesson-prose">{b.content}</p>
      ) : b.type === "image" ? (
        <>
          <div className="lesson-image">
            <Image
              src={mediaUrl(b.url) ?? "/illustrations/school.svg"}
              alt={b.title}
              width={600}
              height={250}
              unoptimized
            />
          </div>
          {b.content && <p>{b.content}</p>}
        </>
      ) : b.type === "audio" ? (
        <div className="audio-card">
          <div className="audio-art">
            <Headphones size={27} />
          </div>
          <div>
            <strong>{t("audio")}</strong>
            <span>{t("replay")}</span>
            {b.url && !audioError ? (
              <audio
                controls
                preload="metadata"
                src={mediaUrl(b.url)}
                onError={() => setAudioError(true)}
              />
            ) : (
              <p className="inline-error">{t("recordingMissing")}</p>
            )}
          </div>
        </div>
      ) : b.type === "video" ? (
        vid ? (
          <iframe
            src={vid}
            title={b.title}
            allow="fullscreen; picture-in-picture"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <p className="inline-error">{t("mediaUnsupported")}</p>
        )
      ) : (
        <>
          <p className="block-instruction">{b.content}</p>
          {b.type === "choice" ? (
            <div className="choice-list">
              {b.options?.map((option, i) => (
                <label
                  className={
                    "choice-option " + (value === option ? "chosen" : "")
                  }
                  key={i}
                >
                  <input
                    type="radio"
                    name={b.id}
                    value={option}
                    checked={value === option}
                    onChange={() => onChange(option)}
                    disabled={disabled}
                  />
                  <span className="choice-letter">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span>{option}</span>
                  {value === option && <Check size={17} />}
                </label>
              ))}
            </div>
          ) : b.type === "gap" ? (
            <input
              className="gap-input"
              aria-label={b.title}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={t("fill")}
              disabled={disabled}
            />
          ) : (
            <textarea
              aria-label={b.title}
              rows={5}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={t("writingPlaceholder")}
              disabled={disabled}
            />
          )}
        </>
      )}
      {result !== undefined && (
        <span className={"answer-result " + (result ? "correct" : "incorrect")}>
          {result ? <Check size={14} /> : <X size={14} />}{" "}
          {t(result ? "right" : "wrong")}
        </span>
      )}
    </section>
  );
}
export function LessonRunner({
  lesson: l,
  w,
  locale,
  t,
  run,
  back,
}: {
  lesson: PublicLesson;
  w: Workspace;
  locale: Locale;
  t: T;
  run: (p: unknown, n?: string) => Promise<unknown>;
  back: () => void;
}) {
  const saved = w.drafts.find(
    (d) => d.lessonId === l.id && d.version === l.version,
  );
  const list = w.attempts
    .filter((a) => a.lessonId === l.id && a.studentId === w.user.id)
    .sort((a, b) => b.number - a.number);
  const backupKey = `zebra-draft:${w.user.id}:${l.id}:${l.version}`;
  const [backup] = useState(() => {
    try {
      const value = JSON.parse(localStorage.getItem(backupKey) ?? "null") as {
        answers: Record<string, string>;
        updatedAt: string;
      } | null;
      if (
        !value ||
        !value.answers ||
        Object.values(value.answers).some((v) => typeof v !== "string")
      )
        return null;
      const latestTime = Math.max(
        Date.parse(saved?.updatedAt ?? "") || 0,
        Date.parse(list[0]?.submittedAt ?? "") || 0,
      );
      return Date.parse(value.updatedAt) > latestTime ? value : null;
    } catch {
      return null;
    }
  });
  const [answers, setAnswers] = useState<Record<string, string>>(
      backup?.answers ?? saved?.answers ?? {},
    ),
    [activeAttempt, setActiveAttempt] = useState<Attempt | null>(
      saved || backup ? null : (list[0] ?? null),
    ),
    [saveStatus, setSaveStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submissionId = useRef(crypto.randomUUID());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSave = useRef<Promise<unknown> | null>(null);
  const seq = useRef(0);
  const changes = useRef(!!backup);
  const latestAnswers = useRef(answers);
  const flush = useRef(run);
  const identity = useRef({
    lessonId: l.id,
    version: l.version,
    student: w.user.role === "student",
  });
  const teacher = w.user.role !== "student",
    opened = isOpen(w, l),
    remaining = Math.max(
      0,
      l.attemptLimit +
        (w.extras.find((e) => e.studentId === w.user.id && e.lessonId === l.id)
          ?.count ?? 0) -
        list.length,
    );
  const questions = l.blocks.filter((b) =>
    ["choice", "gap", "writing"].includes(b.type),
  );
  const answered = questions.filter((b) => answers[b.id]?.trim()).length;
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (changes.current && identity.current.student) {
        void (pendingSave.current ?? Promise.resolve())
          .catch(() => {})
          .then(() =>
            flush.current({
              action: "draft",
              lessonId: identity.current.lessonId,
              version: identity.current.version,
              answers: latestAnswers.current,
            }),
          )
          .catch(() => {});
      }
    },
    [],
  );
  const update = (id: string, value: string) => {
    const next = { ...answers, [id]: value };
    setAnswers(next);
    latestAnswers.current = next;
    changes.current = true;
    if (!teacher) {
      try {
        localStorage.setItem(
          backupKey,
          JSON.stringify({
            answers: next,
            updatedAt: new Date().toISOString(),
          }),
        );
      } catch {}
    }
    if (teacher) return;
    const current = ++seq.current;
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const job = (pendingSave.current ?? Promise.resolve())
        .catch(() => {})
        .then(() =>
          run({
            action: "draft",
            lessonId: l.id,
            version: l.version,
            answers: next,
          }),
        );
      pendingSave.current = job;
      job
        .then(() => {
          if (seq.current === current) {
            setSaveStatus("saved");
            changes.current = false;
          }
        })
        .catch(() => {
          if (seq.current === current) setSaveStatus("saveError");
        });
    }, 700);
  };
  async function send() {
    if (questions.some((b) => !answers[b.id]?.trim())) {
      setError(t("allAnswers"));
      return;
    }
    setError("");
    setBusy(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      await pendingSave.current?.catch(() => {});
      await run({
        action: "submit",
        lessonId: l.id,
        version: l.version,
        id: submissionId.current,
        answers,
      });
      const data = (await fetch("/api/workspace").then((r) =>
        r.json(),
      )) as Workspace;
      setActiveAttempt(
        data.attempts.find((a) => a.id === submissionId.current) ?? null,
      );
      setSaveStatus("");
      changes.current = false;
      try {
        localStorage.removeItem(backupKey);
      } catch {}
    } catch (e) {
      setError(t(errorLabels[(e as Error).message] ?? "genericError"));
    } finally {
      setBusy(false);
    }
  }
  const goBack = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (changes.current && !activeAttempt && !teacher) {
      try {
        await pendingSave.current?.catch(() => {});
        await run({
          action: "draft",
          lessonId: l.id,
          version: l.version,
          answers,
        });
        changes.current = false;
      } catch {
        setError(t("saveError"));
        return;
      }
    }
    back();
  };
  if (!opened)
    return (
      <>
        <button className="back-button" onClick={back}>
          <ArrowLeft size={16} />
          {t("backCourse")}
        </button>
        <Empty text={t("locked")} icon={LockKeyhole} />
      </>
    );
  return (
    <div className="lesson-layout">
      <div className="lesson-main">
        <button className="back-button" onClick={() => void goBack()}>
          <ArrowLeft size={16} />
          {t("backCourse")}
        </button>
        <div className="lesson-page-heading">
          <div className="eyebrow">
            {t("lesson")} · {l.minutes} {t("minutes")}
          </div>
          <h1>{local(l.title, locale)}</h1>
          <p>{local(l.description, locale)}</p>
        </div>
        {teacher && (
          <div className="info-banner">
            <Eye size={16} />
            {t("previewNotice")}
          </div>
        )}
        {activeAttempt && (
          <div className="submission-banner">
            <CheckCircle2 size={24} />
            <div>
              <strong>{t("sent")}</strong>
              <span>
                {t("attempt")} {activeAttempt.number} ·{" "}
                {date(activeAttempt.submittedAt, locale)}
              </span>
            </div>
            <Pill status={activeAttempt.status} t={t} />
          </div>
        )}
        {(activeAttempt?.snapshot ?? l.blocks).map((b) => (
          <BlockView
            key={b.id}
            b={b}
            value={(activeAttempt?.answers ?? answers)[b.id] ?? ""}
            onChange={(value) => update(b.id, value)}
            disabled={!!activeAttempt || busy || (!teacher && !remaining)}
            t={t}
            result={activeAttempt?.autoResults[b.id]}
          />
        ))}
        {activeAttempt?.feedback && (
          <div className="teacher-feedback">
            <span className="avatar">
              {w.profiles.find((p) => p.role === "teacher")?.name[0] ?? "Z"}
            </span>
            <div>
              <h3>{t("feedback")}</h3>
              <p>{activeAttempt.feedback}</p>
            </div>
          </div>
        )}
        {!teacher && !activeAttempt && (
          <div className="lesson-submit-bar">
            <div>
              <span className="save-status">
                {saveStatus && t(saveStatus as Label)}
              </span>
              {error && (
                <p className="inline-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <button
              className="button dark"
              disabled={busy || !remaining}
              onClick={() => void send()}
            >
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Send size={17} />
              )}{" "}
              {t(busy ? "submitting" : "submit")}
            </button>
          </div>
        )}
      </div>
      <aside className="lesson-side">
        <div className="panel lesson-summary">
          <span className="eyebrow">STEP BY STEP</span>
          <h3>{t("progress")}</h3>
          <div className="summary-number">
            {activeAttempt ? questions.length : answered}
            <span>/ {questions.length}</span>
          </div>
          <div className="progress-track">
            <i
              style={{
                width: `${questions.length ? (activeAttempt ? 100 : (answered / questions.length) * 100) : 0}%`,
              }}
            />
          </div>
          <div className="summary-detail">
            <Clock size={16} />
            {l.minutes} {t("minutes")}
          </div>
          {!teacher && (
            <div className="summary-detail">
              <Layers size={16} />
              {t("attempts")}: <strong>{remaining}</strong>
            </div>
          )}
          {activeAttempt && (
            <>
              <div className="score-box">
                <span>{t("autoScore")}</span>
                <strong>
                  {activeAttempt.autoScore} / {activeAttempt.autoMax}
                </strong>
              </div>
              {activeAttempt.manualMax > 0 && (
                <div className="score-box">
                  <span>{t("manualScore")}</span>
                  <strong>
                    {activeAttempt.manualScore ?? "—"} /{" "}
                    {activeAttempt.manualMax}
                  </strong>
                </div>
              )}
              {activeAttempt.late && <p className="late-note">{t("late")}</p>}
            </>
          )}
          {!teacher && activeAttempt && remaining > 0 && (
            <button
              className="button secondary full"
              onClick={() => {
                setActiveAttempt(null);
                setAnswers({});
                latestAnswers.current = {};
                submissionId.current = crypto.randomUUID();
              }}
            >
              {t("retry")}
              <ArrowRight size={16} />
            </button>
          )}
          {!teacher && !remaining && (
            <p className="muted small-text">{t("noAttempts")}</p>
          )}
          <p className="muted small-text">{t("limitNote")}</p>
        </div>
        {list.length > 0 && (
          <div className="panel attempt-history">
            <h3>{t("history")}</h3>
            {list.map((a) => (
              <button
                className={activeAttempt?.id === a.id ? "selected" : ""}
                key={a.id}
                onClick={() => {
                  if (saveTimer.current) clearTimeout(saveTimer.current);
                  setActiveAttempt(a);
                }}
              >
                <span>
                  {t("attempt")} {a.number}
                  <small>{date(a.submittedAt, locale)}</small>
                </span>
                <Pill status={a.status} t={t} />
              </button>
            ))}
          </div>
        )}
        <div className="lesson-encouragement">
          <Sparkles size={22} />
          <p>Every step matters.</p>
        </div>
      </aside>
    </div>
  );
}
export function Results({
  w,
  t,
  locale,
  open,
}: {
  w: Workspace;
  t: T;
  locale: Locale;
  open: (id: string) => void;
}) {
  const teacher = w.user.role !== "student";
  const list = [...w.attempts].reverse();
  return (
    <>
      <PageHeading
        title={t(teacher ? "teacherResults" : "results")}
        subtitle={t("resultDesc")}
      />
      <div className="stats-grid">
        <Stat
          icon={CheckCheck}
          label={t("completed")}
          value={new Set(list.map((a) => a.lessonId)).size}
          color="mint"
        />
        <Stat
          icon={Clock}
          label={t("waiting")}
          value={list.filter((a) => a.status === "pending").length}
          color="lilac"
        />
        <Stat
          icon={ChartNoAxesCombined}
          label={t("average")}
          value={teacher ? "—" : average(w)}
          color="peach"
        />
      </div>
      <div className="panel">
        {list.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {teacher && <th>{t("studentName")}</th>}
                  <th>{t("lesson")}</th>
                  <th>{t("attempt")}</th>
                  <th>{t("date")}</th>
                  <th>{t("score")}</th>
                  <th>{t("status")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id}>
                    {teacher && (
                      <td>
                        {w.profiles.find((p) => p.id === a.studentId)?.name}
                      </td>
                    )}
                    <td>
                      <strong>
                        {local(
                          w.lessons.find((l) => l.id === a.lessonId)?.title ?? {
                            ru: "—",
                            kk: "—",
                          },
                          locale,
                        )}
                      </strong>
                      {a.feedback && (
                        <p className="table-feedback">{a.feedback}</p>
                      )}
                    </td>
                    <td>{a.number}</td>
                    <td>{date(a.submittedAt, locale)}</td>
                    <td>
                      {a.autoScore + (a.manualScore ?? 0)} /{" "}
                      {a.autoMax + a.manualMax}
                      {a.status === "pending" && (
                        <small className="muted">{t("pending")}</small>
                      )}
                    </td>
                    <td>
                      <Pill status={a.status} t={t} />
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={t("view")}
                        onClick={() => open(a.lessonId)}
                      >
                        <ArrowUpRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text={t("noResults")} icon={ChartNoAxesCombined} />
        )}
      </div>
    </>
  );
}
