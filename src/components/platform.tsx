"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  LayoutDashboard,
  ClipboardList,
  ChartNoAxesCombined,
  Settings,
  LogOut,
  Search,
  Bell,
  ChevronRight,
  ChevronDown,
  CheckCheck,
  Clock,
  LockKeyhole,
  X,
  Users,
  Layers,
  PenLine,
  Sparkles,
  Menu,
  CheckCircle2,
  GraduationCap,
  CalendarDays,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Locale, Workspace } from "@/lib/types";
import { errorLabels, local, translator, Label } from "@/lib/i18n";
import { api, isOpen } from "@/lib/client";
import { CourseArt, Pill, Empty, Modal, Field, PageHeading, Stat } from "./ui";
import {
  average,
  CourseCard,
  CourseView,
  HomeworkList,
  LessonRunner,
  Results,
} from "./learning";
import { Review, Builder, People } from "./teaching";
import { Login } from "./login";
type View =
  | "home"
  | "courses"
  | "course"
  | "lesson"
  | "homework"
  | "results"
  | "review"
  | "builder"
  | "students"
  | "settings";
export function Platform() {
  const [w, setW] = useState<Workspace | null>(null),
    [ready, setReady] = useState(false),
    [demo, setDemo] = useState(false),
    [locale, setLocale] = useState<Locale>("ru"),
    [view, setView] = useState<View>("home"),
    [selectedCourse, setSelectedCourse] = useState(""),
    [selectedLesson, setSelectedLesson] = useState(""),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [mobile, setMobile] = useState(false),
    [notifications, setNotifications] = useState(false),
    [setPassword, setSetPassword] = useState(false);
  const t = translator(locale);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = (text: string) => {
    setToast(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 4500);
  };
  const load = useCallback(async () => {
    const response = await fetch("/api/workspace", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setW(data.user ? data : null);
    setDemo(data.demo);
    setReady(true);
    return data as Workspace;
  }, []);
  useEffect(() => {
    const init = async () => {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      if (hash.has("access_token") && hash.has("refresh_token")) {
        await api({
          action: "session",
          access_token: hash.get("access_token"),
          refresh_token: hash.get("refresh_token"),
        });
        window.history.replaceState({}, "", "/?setPassword=1");
      }
      await load();
      const saved = localStorage.getItem("zebra-locale");
      if (saved === "ru" || saved === "kk") setLocale(saved);
      setSetPassword(
        new URLSearchParams(window.location.search).has("setPassword"),
      );
    };
    void init().catch(() => {
      setError("CONNECTION");
      setReady(true);
    });
  }, [load]);
  const lang = (value: Locale) => {
    setLocale(value);
    localStorage.setItem("zebra-locale", value);
    document.documentElement.lang = value;
  };
  const navigate = (next: View, id?: string) => {
    setView(next);
    setSearch("");
    setMobile(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (next === "course" && id) setSelectedCourse(id);
    if (next === "lesson" && id) setSelectedLesson(id);
  };
  const run = async (payload: unknown, notice?: string) => {
    try {
      const result = await api(payload);
      await load();
      if (notice) notify(notice);
      return result;
    } catch (e) {
      notify(t(errorLabels[(e as Error).message] ?? "genericError"));
      throw e;
    }
  };
  if (!ready)
    return (
      <div className="loading-screen" role="status" aria-live="polite">
        <div className="loading-card">
          <Image
            src="/brand-clean.png"
            alt="ZEBRA Education"
            width={260}
            height={87}
            priority
          />
          <div className="loading-progress">
            <span />
          </div>
          <h1>{t("loadingTitle")}</h1>
          <p>{t("loadingMessage")}</p>
          <span className="loading-caption">ZEBRA EDUCATION</span>
        </div>
      </div>
    );
  if (!w)
    return (
      <Login
        t={t}
        locale={locale}
        lang={lang}
        demo={demo}
        error={error ? t("connectionError") : ""}
        onLogin={load}
      />
    );
  const teacher = w.user.role !== "student";
  const parentCourseId =
    w.modules.find(
      (m) => m.id === w.lessons.find((l) => l.id === selectedLesson)?.moduleId,
    )?.courseId ?? selectedCourse;
  const parentCourse = w.courses.find((c) => c.id === parentCourseId);
  const lessons = w.lessons.filter((l) =>
    w.modules.some((m) => m.id === l.moduleId),
  );
  const done = new Set(
    w.attempts
      .filter((a) => teacher || a.studentId === w.user.id)
      .map((a) => a.lessonId),
  );
  const pending = w.attempts.filter((a) => a.status === "pending");
  const nav: [View, Label, LucideIcon][] = [
    ["home", "home", LayoutDashboard],
    ["courses", teacher ? "teacherCourses" : "courses", BookOpen],
    ...(teacher
      ? ([
          ["builder", "builder", Layers],
          ["review", "review", ClipboardList],
          ["results", "teacherResults", ChartNoAxesCombined],
          ["students", "students", Users],
        ] as [View, Label, LucideIcon][])
      : ([
          ["homework", "homework", ClipboardList],
          ["results", "results", ChartNoAxesCombined],
        ] as [View, Label, LucideIcon][])),
  ];
  const searchResults = search.trim()
    ? lessons.filter(
        (l) =>
          local(l.title, locale).toLowerCase().includes(search.toLowerCase()) ||
          w.courses
            .find((c) =>
              w.modules.some((m) => m.id === l.moduleId && m.courseId === c.id),
            )
            ?.title.toLowerCase()
            .includes(search.toLowerCase()),
      )
    : [];
  const course = w.courses.find((c) => c.id === selectedCourse) ?? w.courses[0];
  const lesson = w.lessons.find((l) => l.id === selectedLesson);
  const notices = teacher
    ? pending
    : w.attempts
        .filter((a) => a.status === "reviewed" || a.status === "returned")
        .slice(-5)
        .reverse();
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (mobile ? "mobile-open" : "")}>
        <div className="brand">
          <Image
            src="/brand-clean.png"
            alt="ZEBRA Education"
            width={155}
            height={50}
            priority
          />
          <button
            className="icon-button mobile-only"
            onClick={() => setMobile(false)}
            aria-label={t("close")}
          >
            <X size={20} />
          </button>
        </div>
        <div className="school-tag">
          <span className="school-mark">ZE</span>
          <div>
            <strong>ZEBRA Education</strong>
            <span>{t("school")}</span>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">{t(teacher ? "workspace" : "learning")}</div>
        <nav>
          {nav.map(([key, label, Icon]) => (
            <button
              key={key}
              className={
                "nav-item " +
                (view === key ||
                (key === "courses" && ["course", "lesson"].includes(view))
                  ? "active"
                  : "")
              }
              onClick={() => navigate(key)}
            >
              <Icon size={20} />
              <span>{t(label)}</span>
              {key === "review" && pending.length > 0 && (
                <span className="nav-count">{pending.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-symbol">✦</span>
            <strong>{t("week")}</strong>
            <p>{t("phoneHint")}</p>
          </div>
          <button
            className={"nav-item " + (view === "settings" ? "active" : "")}
            onClick={() => navigate("settings")}
          >
            <Settings size={20} />
            {t("settings")}
          </button>
          <button
            className="nav-item"
            onClick={() =>
              void run({ action: "logout" })
                .then(() => navigate("home"))
                .catch(() => {})
            }
          >
            <LogOut size={20} />
            {t("logout")}
          </button>
          <div className="sidebar-user">
            <span className="avatar">{w.user.name.slice(0, 1)}</span>
            <div>
              <strong>{w.user.name}</strong>
              <span>{t(w.user.role)}</span>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      {mobile && (
        <div className="sidebar-overlay" onClick={() => setMobile(false)} />
      )}
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-only"
            onClick={() => setMobile(true)}
            aria-label="Menu"
          >
            <Menu size={22} />
          </button>
          <nav className="breadcrumbs" aria-label={t("navigationPath")}>
            <button onClick={() => navigate("home")}>{t("learning")}</button>
            {(view === "lesson" || view === "course") && (
              <>
                <ChevronRight size={13} />
                <button onClick={() => navigate("courses")}>
                  {t(teacher ? "teacherCourses" : "courses")}
                </button>
              </>
            )}
            {view === "lesson" && (
              <>
                <ChevronRight size={13} />
                <button onClick={() => navigate("course", parentCourseId)}>
                  {parentCourse?.title ?? t("course")}
                </button>
              </>
            )}
            <ChevronRight size={13} />
            <strong>
              {t(
                view === "course"
                  ? "course"
                  : view === "lesson"
                    ? "lesson"
                    : view === "courses" && teacher
                      ? "teacherCourses"
                      : view === "results" && teacher
                        ? "teacherResults"
                        : (view as Label),
              )}
            </strong>
          </nav>
          <div className="topbar-actions">
            <div className="search-box">
              <Search size={17} />
              <input
                aria-label={t("search")}
                placeholder={t("search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <div className="search-results">
                  {searchResults.length ? (
                    searchResults.map((l) => (
                      <button
                        key={l.id}
                        disabled={!isOpen(w, l)}
                        onClick={() => navigate("lesson", l.id)}
                      >
                        <BookOpen size={16} />
                        {local(l.title, locale)}
                        {!isOpen(w, l) && <LockKeyhole size={13} />}
                      </button>
                    ))
                  ) : (
                    <p>{t("searchEmpty")}</p>
                  )}
                </div>
              )}
            </div>
            <div className="language-switch">
              <button
                className={locale === "ru" ? "selected" : ""}
                onClick={() => lang("ru")}
              >
                RU
              </button>
              <button
                className={locale === "kk" ? "selected" : ""}
                onClick={() => lang("kk")}
              >
                ҚАЗ
              </button>
            </div>
            <div className="notification-wrap">
              <button
                className="icon-button bell"
                aria-label={t("notifications")}
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={20} />
                {notices.length > 0 && <i />}
              </button>
              {notifications && (
                <div className="notification-panel">
                  <h3>{t("notifications")}</h3>
                  {notices.length ? (
                    notices.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => {
                          navigate(teacher ? "review" : "lesson", a.lessonId);
                          setNotifications(false);
                        }}
                      >
                        <span>
                          {local(
                            w.lessons.find((l) => l.id === a.lessonId)
                              ?.title ?? { ru: t("lesson"), kk: t("lesson") },
                            locale,
                          )}
                        </span>
                        <Pill status={a.status} t={t} />
                      </button>
                    ))
                  ) : (
                    <p>{t("noNotifications")}</p>
                  )}
                </div>
              )}
            </div>
            <button
              className="avatar top-avatar"
              onClick={() => navigate("settings")}
              aria-label={t("profile")}
            >
              {w.user.name.slice(0, 1)}
            </button>
          </div>
        </header>
        <main className="page-content">
          {w.demo && (
            <div className="demo-banner">
              <span>
                <span className="demo-dot" />
                {t("demo")}
              </span>
              <select
                aria-label={t("role")}
                value={w.user.role}
                onChange={(e) =>
                  void run({ action: "demo", role: e.target.value })
                    .then(() => navigate("home"))
                    .catch(() => {})
                }
              >
                <option value="student">{t("student")}</option>
                <option value="teacher">{t("teacher")}</option>
                <option value="admin">{t("admin")}</option>
              </select>
            </div>
          )}
          {view === "home" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">LET’S MAKE PROGRESS</div>
                  <h1>
                    {t(teacher ? "teacherGreeting" : "greeting")},{" "}
                    {w.user.name.split(" ")[0]}
                    <span className="wave">✦</span>
                  </h1>
                  <p>{t("today")}</p>
                </div>
                <div className="date-chip">
                  <CalendarDays size={16} />
                  {new Intl.DateTimeFormat(
                    locale === "ru" ? "ru-RU" : "kk-KZ",
                    { day: "numeric", month: "long", timeZone: "Asia/Almaty" },
                  ).format(new Date())}
                </div>
              </div>
              <div className="dashboard-grid">
                <section className="hero-card">
                  <div className="hero-copy">
                    <span className="hero-label">
                      <span className="tiny-dot" />
                      {t("welcomeSchool")}
                    </span>
                    <h2>
                      {teacher ? (
                        <>
                          Teach with care.
                          <br />
                          Inspire progress.
                        </>
                      ) : (
                        <>
                          Little steps.
                          <br />
                          Big discoveries.
                        </>
                      )}
                    </h2>
                    <p>{t(teacher ? "tipTeacher" : "yourCourses")}</p>
                    <button
                      className="button dark"
                      onClick={() => {
                        const next = lessons.find(
                          (l) => isOpen(w, l) && !done.has(l.id),
                        );
                        if (teacher) navigate("builder");
                        else if (next) navigate("lesson", next.id);
                        else navigate("courses");
                      }}
                    >
                      {t(teacher ? "newLesson" : "continue")}
                      <ArrowUpRight size={18} />
                    </button>
                  </div>
                  <CourseArt />
                </section>
                <section className="journey-card">
                  <div className="journey-icon">
                    <GraduationCap size={26} />
                  </div>
                  <span className="eyebrow">YOUR LEARNING JOURNEY</span>
                  <h3>{t(teacher ? "teacherResults" : "results")}</h3>
                  <div className="journey-number">
                    {teacher
                      ? w.profiles.filter((p) => p.role === "student").length
                      : done.size}
                    <span>
                      /{" "}
                      {teacher
                        ? t("totalStudents")
                        : lessons.length + " " + t("lessons")}
                    </span>
                  </div>
                  <div className="progress-track">
                    <i
                      style={{
                        width: `${lessons.length ? Math.min(100, (done.size / lessons.length) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <p>{t("progressNote")}</p>
                  <button
                    className="text-button"
                    onClick={() => navigate("results")}
                  >
                    {t("viewAll")}
                    <ArrowRight size={16} />
                  </button>
                </section>
              </div>
              <div className="stats-grid">
                <Stat
                  icon={BookOpen}
                  label={t("activeCourses")}
                  value={w.courses.length}
                  color="mint"
                />
                <Stat
                  icon={teacher ? Users : CheckCheck}
                  label={t(teacher ? "totalStudents" : "completed")}
                  value={
                    teacher
                      ? w.profiles.filter((p) => p.role === "student").length
                      : done.size
                  }
                  color="peach"
                />
                <Stat
                  icon={Clock}
                  label={t(teacher ? "newWork" : "waiting")}
                  value={pending.length}
                  color="lilac"
                />
                <Stat
                  icon={ChartNoAxesCombined}
                  label={t(teacher ? "publishedLessons" : "average")}
                  value={
                    teacher
                      ? lessons.filter((l) => l.published).length
                      : average(w)
                  }
                  color="yellow"
                />
              </div>
              <div className="content-columns">
                <section>
                  <div className="section-head">
                    <div>
                      <h2>{t(teacher ? "teacherCourses" : "myLearning")}</h2>
                      <p>{t("yourCourses")}</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => navigate("courses")}
                    >
                      {t("allCourses")}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                  {w.courses.length ? (
                    w.courses
                      .slice(0, 2)
                      .map((c) => (
                        <CourseCard
                          key={c.id}
                          c={c}
                          w={w}
                          t={t}
                          locale={locale}
                          open={() => navigate("course", c.id)}
                        />
                      ))
                  ) : (
                    <Empty text={t("emptyCourses")} />
                  )}
                </section>
                <section className="right-column">
                  <div className="section-head">
                    <h2>{t(teacher ? "review" : "nextUp")}</h2>
                    <span className="count-label">
                      {teacher
                        ? pending.length
                        : w.releases.filter((r) => r.homework).length}
                    </span>
                  </div>
                  {teacher ? (
                    pending.length ? (
                      pending.slice(0, 3).map((a) => (
                        <button
                          className="task-card"
                          key={a.id}
                          onClick={() => navigate("review")}
                        >
                          <span className="task-icon">
                            <PenLine size={19} />
                          </span>
                          <div>
                            <strong>
                              {
                                w.profiles.find((p) => p.id === a.studentId)
                                  ?.name
                              }
                            </strong>
                            <span>
                              {local(
                                w.lessons.find((l) => l.id === a.lessonId)!
                                  .title,
                                locale,
                              )}
                            </span>
                          </div>
                          <ChevronRight size={18} />
                        </button>
                      ))
                    ) : (
                      <div className="compact-empty">
                        <CheckCheck size={22} />
                        <p>{t("noReview")}</p>
                      </div>
                    )
                  ) : (
                    <HomeworkList
                      w={w}
                      t={t}
                      locale={locale}
                      open={(id) => navigate("lesson", id)}
                      compact
                    />
                  )}
                  <div className="tip-card">
                    <span className="tip-icon">
                      <Sparkles size={20} />
                    </span>
                    <h3>{t("tipTitle")}</h3>
                    <p>{t("tip")}</p>
                    <div className="tip-bottom">
                      ZEBRA LITTLE REMINDERS<span>✦</span>
                    </div>
                  </div>
                </section>
              </div>
            </>
          )}
          {view === "courses" && (
            <>
              <PageHeading
                title={t(teacher ? "teacherCourses" : "courses")}
                subtitle={t("yourCourses")}
              />
              <div className="course-grid">
                {w.courses.map((c) => (
                  <CourseCard
                    key={c.id}
                    c={c}
                    w={w}
                    t={t}
                    locale={locale}
                    open={() => navigate("course", c.id)}
                  />
                ))}
                {!w.courses.length && <Empty text={t("emptyCourses")} />}
              </div>
            </>
          )}
          {view === "course" && course && (
            <CourseView
              course={course}
              w={w}
              t={t}
              locale={locale}
              open={(id) => navigate("lesson", id)}
              back={() => navigate("courses")}
            />
          )}
          {view === "lesson" && lesson && (
            <LessonRunner
              key={lesson.id}
              lesson={lesson}
              w={w}
              locale={locale}
              t={t}
              run={run}
              back={() => {
                const cid = w.modules.find(
                  (m) => m.id === lesson.moduleId,
                )?.courseId;
                navigate("course", cid);
              }}
            />
          )}
          {view === "homework" && (
            <>
              <PageHeading title={t("homework")} subtitle={t("homeworkDesc")} />
              <div className="panel">
                <HomeworkList
                  w={w}
                  t={t}
                  locale={locale}
                  open={(id) => navigate("lesson", id)}
                />
              </div>
            </>
          )}
          {view === "results" && (
            <Results
              w={w}
              t={t}
              locale={locale}
              open={(id) => navigate("lesson", id)}
            />
          )}
          {view === "review" && teacher && (
            <Review w={w} t={t} locale={locale} run={run} />
          )}
          {view === "builder" && teacher && (
            <Builder w={w} t={t} locale={locale} run={run} />
          )}
          {view === "students" && teacher && (
            <People w={w} t={t} locale={locale} run={run} />
          )}
          {view === "settings" && (
            <>
              <PageHeading title={t("settings")} subtitle="ZEBRA Education" />
              <div className="panel settings-panel">
                <h3>{t("profile")}</h3>
                <div className="profile-row">
                  <span className="avatar large">
                    {w.user.name.slice(0, 1)}
                  </span>
                  <div>
                    <strong>{w.user.name}</strong>
                    <p>{w.user.email}</p>
                    <Pill status="published" t={t} />
                  </div>
                </div>
                <div className="settings-row">
                  <div>
                    <strong>{t("language")}</strong>
                    <p>Русский / Қазақша</p>
                  </div>
                  <select
                    value={locale}
                    onChange={(e) => lang(e.target.value as Locale)}
                  >
                    <option value="ru">Русский</option>
                    <option value="kk">Қазақша</option>
                  </select>
                </div>
                <div className="settings-row">
                  <div>
                    <strong>{t("role")}</strong>
                    <p>{t(w.user.role)}</p>
                  </div>
                  <GraduationCap size={24} />
                </div>
                {!demo && (
                  <button
                    className="button secondary"
                    onClick={() => setSetPassword(true)}
                  >
                    {t("setPassword")}
                  </button>
                )}
              </div>
            </>
          )}
        </main>
        <footer className="footer">
          <span>© {new Date().getFullYear()} ZEBRA Education</span>
          <span>
            Every step matters. <span className="footer-star">✦</span>
          </span>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
          <button onClick={() => setToast("")} aria-label={t("close")}>
            <X size={15} />
          </button>
        </div>
      )}
      {setPassword && (
        <Modal title={t("setPassword")} onClose={() => setSetPassword(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const password = new FormData(e.currentTarget).get("password");
              void run({ action: "password", password }, t("passwordSaved"))
                .then(() => {
                  setSetPassword(false);
                  window.history.replaceState({}, "", "/");
                })
                .catch(() => {});
            }}
          >
            <Field label={t("newPassword")}>
              <input
                name="password"
                type="password"
                minLength={8}
                autoComplete="new-password"
                required
              />
            </Field>
            <button className="button dark">{t("save")}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
