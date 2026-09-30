"use client";
import { useEffect, useRef } from "react";
import { BookOpen, Check, Clock, X, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Attempt } from "@/lib/types";
import { T } from "@/lib/client";
export function CourseArt({ small = false }: { small?: boolean }) {
  return (
    <div className={"course-art " + (small ? "small" : "")} aria-hidden="true">
      <span className="art-dot dot-one" />
      <span className="art-dot dot-two" />
      <div className="art-book">
        <span>Aa</span>
        <i />
        <i />
      </div>
      <div className="art-pencil" />
      <div className="art-bubble">hello!</div>
      <Sparkles className="art-spark" size={27} />
    </div>
  );
}
export function Pill({
  status,
  t,
}: {
  status: Attempt["status"] | "draft" | "published";
  t: T;
}) {
  return (
    <span className={"pill " + status}>
      {status === "reviewed" ? (
        <Check size={12} />
      ) : status === "pending" ? (
        <Clock size={12} />
      ) : null}
      {t(status)}
    </span>
  );
}
export function Empty({
  text,
  icon: Icon = BookOpen,
}: {
  text: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={26} />
      </div>
      <p>{text}</p>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={"modal " + (wide ? "wide" : "")}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function Stat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="stat-card">
      <span className={"stat-icon " + color}>
        <Icon size={20} />
      </span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
