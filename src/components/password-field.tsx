"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { T } from "@/lib/client";

export function PasswordField({
  label,
  t,
  minLength,
  autoComplete,
}: {
  label: string;
  t: T;
  minLength: number;
  autoComplete: "current-password" | "new-password";
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const toggleLabel = t(visible ? "hidePassword" : "showPassword");

  return (
    <div className="field password-field">
      <label htmlFor={id}>{label}</label>
      <div className="password-input">
        <input
          id={id}
          name="password"
          type={visible ? "text" : "password"}
          minLength={minLength}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          className="password-toggle"
          aria-label={toggleLabel}
          aria-controls={id}
          aria-pressed={visible}
          title={toggleLabel}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? (
            <EyeOff size={20} aria-hidden />
          ) : (
            <Eye size={20} aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}
