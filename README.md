# ZEBRA Education

A bilingual (Russian/Kazakh) learning platform for one English school. Built with Next.js, TypeScript, Supabase and Vercel.

**Live:** https://zebra-education.vercel.app

## Included

- Student, teacher and school administrator accounts; invitation-only access.
- Courses → modules → versioned lessons. Group-based lesson release and independent course access.
- Block editor: text, images, audio, YouTube/Vimeo videos, single-choice questions, gaps and writing.
- Server/database auto grading, teacher scores and feedback, return for correction, attempt limits and extra attempts.
- Draft autosave with local recovery for interrupted navigation, submission history, progress separate from scores, homework deadlines and late-work markers.
- Groups, memberships, invitations and course assignment.
- Six original beginner lessons inspired by the learning objectives in Family and Friends 1 (2nd edition). No textbook pages or publisher audio are included. Dictation audio is an original synthetic recording; a teacher should review pronunciation before classroom use.

## Local development

Node.js 24 or newer.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

For local evaluation set `DEMO_MODE=true` and a random `DEMO_SESSION_SECRET` in `.env.local`. Demo data is kept in `.data/demo.json` on the local server, and roles can be switched in the banner. This is a local evaluation mode, **not suitable for a serverless production deployment**. Production uses Supabase, normal sign-in, and `DEMO_MODE=false`.

## Supabase

The deployed project has three applied migrations. Local filenames match the recorded remote migration versions. A fresh project can apply them in order using the Supabase CLI. `supabase/config.toml` declares only the school site URL, allowed redirects, password minimum, and closed registration.

Relationships are indexed foreign keys generated from typed entity JSON. Lesson blocks and submitted snapshots remain JSON so historical work retains the exact questions seen by a student. Correct-answer keys are stored separately. RLS protects all exposed tables. Direct writes by users are revoked; checked RPCs save drafts, grade submissions atomically, review work and save educator changes. Private definer functions always authorize the caller; public RPC wrappers run as invoker. Storage is private with short-lived signed URLs.

`SUPABASE_SECRET_KEY` is server-only, needed for school invitations and bootstrap. Never prefix it with `NEXT_PUBLIC_`, include it in commits, or share it in chat.

To bootstrap an additional environment, set `ZEBRA_ADMIN_EMAIL` and run:

```sh
npm run bootstrap
```

Bootstrap is idempotent for the sample lessons. It does not send email or assign a password. The administrator can use the password-recovery flow after the project's redirect URLs and email sender are configured.

**Email:** Supabase's built-in sender only sends to organization member addresses and has a low rate limit. Configure custom SMTP before inviting a real class. When email delivery fails, the administrator is given a single-use invitation link to pass privately to the intended recipient. Password recovery still requires a working email sender. Links are credentials and must not be published.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

The browser test expects the local demo server at `http://localhost:3000`. It exercises draft restoration, submission, teacher correction, Kazakh localization, a 390px screen, lesson publication and preview. macOS uses installed Google Chrome; elsewhere install Playwright Chromium or set `CHROME_PATH`.

Cloud checks use disposable accounts:

```sh
npm run bootstrap -- --test-users
npm run test:cloud
node --import tsx scripts/check-production.ts
node --import tsx scripts/check-editor-cloud.ts
node --import tsx scripts/check-invite-cloud.ts
```

Cloud credentials live only in ignored `.data/cloud-test-users.json`. Cloud tests clear only the designated test student's attempts; they never touch real student work. `check-production.ts` exercises actual sign-in and feedback on the deployed URL. Run it only against a test environment or the designated disposable accounts.

GitHub Actions runs type checking, lint, unit tests and production build. Vercel is linked to the GitHub repository for deployments.

## Current boundaries

No billing, chat, video calls, parent accounts, AI assistant, or textbook import. Audio/images are limited to 10 MB per file. Videos use external embeds. Completion is recorded after required answers are submitted; manual scores may still be pending. Teacher work is shared across teachers assigned to the same course through their groups. Interrupted drafts also have a local browser backup tied to the student and lesson version. Submission and teacher work require an internet connection; a failed server save remains visible.
