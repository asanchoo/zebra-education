export type Locale = "ru" | "kk";
export type Role = "student" | "teacher" | "admin";
export type Localized = { ru: string; kk: string };
export type Profile = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
};
export type Course = {
  hidden?: boolean;
  id: string;
  title: string;
  description: Localized;
  level: string;
  teacherId: string;
  color: string;
};
export type Module = {
  hidden?: boolean;
  id: string;
  courseId: string;
  title: Localized;
  position: number;
};
export type BlockKind =
  "text" | "image" | "audio" | "video" | "choice" | "gap" | "writing";
export type Block = {
  id: string;
  type: BlockKind;
  title: string;
  content: string;
  url?: string;
  options?: string[];
  points?: number;
};
export type AnswerKey = { accepted: string[] };
export type Lesson = {
  hidden?: boolean;
  availableAt?: string;
  id: string;
  moduleId: string;
  title: Localized;
  description: Localized;
  minutes: number;
  position: number;
  attemptLimit: number;
  published: boolean;
  version: number;
  blocks: Block[];
  keys: Record<string, AnswerKey>;
};
export type Group = {
  id: string;
  name: string;
  teacherId: string;
  studentIds: string[];
};
export type Enrollment = {
  id: string;
  courseId: string;
  groupId?: string;
  studentId?: string;
  mode: "group" | "self";
};
export type Release = {
  opensAt?: string;
  id: string;
  groupId: string;
  lessonId: string;
  homework: boolean;
  dueAt?: string;
};
export type Draft = {
  id: string;
  studentId: string;
  lessonId: string;
  version: number;
  answers: Record<string, string>;
  updatedAt: string;
};
export type Attempt = {
  id: string;
  studentId: string;
  lessonId: string;
  version: number;
  number: number;
  submittedAt: string;
  late: boolean;
  answers: Record<string, string>;
  snapshot: Block[];
  autoScore: number;
  autoMax: number;
  manualMax: number;
  manualScore?: number;
  feedback?: string;
  reviewedAt?: string;
  status: "pending" | "reviewed" | "returned";
  autoResults: Record<string, boolean>;
};
export type ExtraAttempt = {
  id: string;
  studentId: string;
  lessonId: string;
  count: number;
};
export type NotificationRead = {
  id: string;
  userId: string;
  attemptId: string;
  eventAt: string;
};
export type Store = {
  notificationReads: NotificationRead[];
  revision: number;
  profiles: Profile[];
  courses: Course[];
  modules: Module[];
  lessons: Lesson[];
  groups: Group[];
  enrollments: Enrollment[];
  releases: Release[];
  drafts: Draft[];
  attempts: Attempt[];
  extras: ExtraAttempt[];
};
export type PublicLesson = Omit<Lesson, "keys">;
export type Workspace = Omit<Store, "lessons"> & {
  lessons: PublicLesson[];
  user: Profile;
  demo: boolean;
  serverTime: string;
};
