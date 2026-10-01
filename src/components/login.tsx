"use client";
import { useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  BookOpen,
  Users,
  GraduationCap,
  LoaderCircle,
} from "lucide-react";
import type { Locale, Profile, Role } from "@/lib/types";
import { api, T } from "@/lib/client";
import { CourseArt, Field } from "./ui";
import { PasswordField } from "./password-field";

export function Login({
  t,
  locale,
  lang,
  demo,
  error,
  onLogin,
}: {
  t: T;
  locale: Locale;
  lang: (l: Locale) => void;
  demo: boolean;
  error: string;
  onLogin: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(error),
    [email, setEmail] = useState("");
  const login = async (role?: Role, password?: string) => {
    setBusy(true);
    setMessage("");
    try {
      await api(
        role ? { action: "demo", role } : { action: "login", email, password },
      );
      const data = (await onLogin()) as { user?: Profile };
      if (!data.user) setMessage(t("blocked"));
    } catch {
      setMessage(t("genericError"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login-page">
      <section className="login-story">
        <Image
          src="/brand-clean.png"
          alt="ZEBRA Education"
          width={180}
          height={57}
          priority
        />
        <div>
          <span className="eyebrow">ENGLISH. CONFIDENCE. YOU.</span>
          <h1>
            Little steps.
            <br />
            Big discoveries<span>✦</span>
          </h1>
          <p>{t("loginDesc")}</p>
          <CourseArt />
        </div>
        <span className="login-footer">Every step matters.</span>
      </section>
      <section className="login-form-section">
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
        <div className="login-form-content">
          <span className="login-badge">
            <GraduationCap size={22} />
          </span>
          <h2>{t("loginTitle")}</h2>
          {demo ? (
            <>
              <p>{t("demoDesc")}</p>
              <div className="demo-login-buttons">
                {(["student", "teacher", "admin"] as Role[]).map((r, i) => (
                  <button
                    className={"button " + (i === 0 ? "dark" : "secondary")}
                    key={r}
                    disabled={busy}
                    onClick={() => void login(r)}
                  >
                    {r === "student" ? (
                      <GraduationCap size={19} />
                    ) : r === "teacher" ? (
                      <BookOpen size={19} />
                    ) : (
                      <Users size={19} />
                    )}{" "}
                    {t(
                      r === "student"
                        ? "tryStudent"
                        : r === "teacher"
                          ? "tryTeacher"
                          : "tryAdmin",
                    )}
                    <ArrowRight size={17} />
                  </button>
                ))}
              </div>
              <span className="login-demo-label">
                <span className="demo-dot" />
                {t("demo")}
              </span>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void login(
                  undefined,
                  String(new FormData(e.currentTarget).get("password")),
                );
              }}
            >
              <Field label={t("email")}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </Field>
              <PasswordField
                label={t("password")}
                t={t}
                minLength={6}
                autoComplete="current-password"
              />
              <button className="button dark full" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  t("login")
                )}
                <ArrowRight size={17} />
              </button>
              <button
                className="text-button reset-button"
                type="button"
                onClick={() => {
                  if (!email) {
                    setMessage(t("typeEmail"));
                    return;
                  }
                  void api({ action: "reset", email })
                    .then(() => setMessage(t("resetSent")))
                    .catch(() => setMessage(t("genericError")));
                }}
              >
                {t("forgot")}
              </button>
            </form>
          )}
          {message && (
            <p className="inline-error" role="alert">
              {message}
            </p>
          )}
        </div>
        <div className="login-footnote">ZEBRA Education · {t("phoneHint")}</div>
      </section>
    </div>
  );
}
