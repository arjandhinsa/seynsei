# Seynsei handover

A snapshot of where the project is, what's running, and what's next.

## What's shipped

The gamified rebuild is complete and deployed.

**Backend.** FastAPI on Render, async SQLAlchemy 2.0 against Supabase Postgres. Live at `https://api-seynsei.seyn.co.uk`. Eight tables: users, challenges, achievements, completions, conversations, messages, recommendation_logs, and alembic_version. Schema owned by Alembic; seed populates the catalogue but does not create tables. Auth uses JWT with refresh tokens, bcrypt for passwords. Sensei chat runs on OpenAI gpt-4o-mini with a tightened system prompt (~250 words, max 350 tokens, ~2s per reply).

**Catalogue.** 18 challenges across two domains (Social, Dating), five tiers each, with CBT metadata: safety behaviour targeted, cognitive distortion challenged, rationale, and a one-line tip. 18 achievements covering first-completion milestones, tier reaches, streaks, repeat counts, XP gates, and domain balance.

**Frontend.** Vite + React 18 + TypeScript + TanStack Query + React Router. Deployed to Vercel. Hub-and-spoke navigation (no bottom tab bar), single-tap "Ready" button, two-tap completion confirmation, SUDS rating before and after, calm painterly aesthetic with Fraunces serif and Nunito body. PWA installable via vite-plugin-pwa. Sensei chat with five always-visible quick replies. Profile screen shows identity, level, stats strip, domain breakdown, milestones (unlocked + locked), recent practice, settings link. Settings has name editor, sign out, and delete account confirmation.

**Database recommender.** Rule-based for now. Anti-avoidance gate keeps users from skipping past Tier 1 too fast. Dating domain unlocks at 5 Social completions OR Tier 2 reached, whichever comes first. Every recommendation is logged to `recommendation_log` so a training corpus accumulates passively for the future ML phase.

**Production deployment.** Backend on Render free tier (Oregon region) with Supabase Postgres in EU West (Ireland). Custom domains: `seynsei.seyn.co.uk` for the frontend, `api-seynsei.seyn.co.uk` for the backend. JWT secret rotated, RLS enabled on all Supabase tables (backend bypasses RLS via the `postgres` role, so this only hardens the auto-exposed PostgREST API).

**Operational.** GitHub Actions workflow at `.github/workflows/keep-warm.yml` pings `/docs` every 5 minutes to mitigate Render's free tier spin-down. Procfile present in case Render ever respects it (currently they only run release hooks on paid plans). Migrations are run locally against the production database for now.

## What's running right now

Solo alpha testing. The owner is the only user, signed in, completing challenges, talking to Sensei, watching how it feels day to day. The point of this period is not to validate the idea but to find friction: places where the recommended challenge feels wrong, where Sensei misfires, where a refresh logs you out, where the streak feels coercive instead of motivating.

Notes are being kept on:
- Whether the Dating gate unlocks too early or too late
- Whether tier progression keeps pace with felt readiness
- Sensei replies that drift into textbook phrasing or ask multiple questions
- Any place where the web feel breaks the calm aesthetic
- Performance, especially Sensei reply latency and any cold-start pauses

## What's blocking a public launch

Three things to do before inviting outside testers, in order of priority.

**Render Starter plan ($7/month).** Free tier sleeps after 15 minutes of inactivity. Cold start is 30-60 seconds, which is fatal for first impressions. The keep-warm cron mitigates but doesn't eliminate the risk, especially under viral traffic spikes. Starter removes the spin-down entirely and gives more headroom.

**Region migration.** Render service is currently in Oregon, Supabase is in EU West. Every database query crosses the Atlantic. For Reddit + TikTok mixed audience leaning US, the right compromise is Render Virginia. If primary audience is UK + EU, Frankfurt. Migration is not in-place; you create a new service, copy env vars, repoint DNS, delete the old one. Roughly 30 minutes of work.

**Supabase region.** Optional but worth considering. If Render moves to a US region, every DB query still round-trips to Dublin (~80ms). Migrating Supabase to match the Render region (us-east-1 if Virginia, eu-central-1 stays put if Frankfurt) drops query latency to ~5ms. This is a fresh-project migration: spin up a new Supabase, run alembic + seed against it, swap `DATABASE_URL` in Render. Small surgery, big payoff if going US-first.

## What comes next after launch

**App wrap with Capacitor.** The PWA already installs to home screen on iOS and Android, so trial users can experience the phone-shaped version before any native wrap. When ready, Capacitor turns the existing React/Vite codebase into iOS and Android binaries without a rewrite. The biggest UX unlock is push notifications: streak reminders, Sensei nudges, achievement celebrations. App Store and Play Store distribution come along with it.

**Push notifications.** Once Capacitor is in, design a notification policy that supports streaks without becoming Duolingo-shaped. Quiet pride, not nag.

**Analytics.** Currently no behavioural tracking beyond the recommendation log. Pre-launch, decide what to instrument: signup funnel, first-completion rate, return rate at day 7 and day 30, Sensei message volume per session, where users drop off. Posthog or Plausible are both fine; pick one.

**Onboarding pass.** Current sign-up is bare. Worth adding a short softening intro that explains the SUDS rating, the streak philosophy, and the anti-avoidance approach before the first challenge.

## What's deferred

**Phase 4: ML recommender.** XGBoost engagement scorer trained on real user behaviour, gated by clinical rules so the model never overrides anti-avoidance constraints. Waits until ~500 users are accumulating completions in the recommendation log. Until then, the rule-based recommender is fine and arguably more interpretable.

**Avatar art.** Anime-style illustrations for the level system are paused until proper image generation or commissioned art is in place. The system is built to slot them in by ID.

**Cloudflare and multi-region.** Only matters at real scale. The pattern is Cloudflare in front of the API for edge caching of static responses, single backend region for dynamic. Don't bother until traffic justifies it.

**Subscription / monetisation.** No payment plumbing yet. Decide later whether Seynsei is free with a paid tier (more domains, deeper Sensei sessions, history export) or free with optional support.

## What we could explore later

Things that aren't on the roadmap but might be worth considering when the time is right.

**Group challenges.** Pair two users in a similar tier for an accountability buddy system. Privacy is the tricky part; opt-in with anonymous handles is one route.

**Weekly Sensei letter.** A long-form reflective summary every Sunday based on the week's completions, sent in-app or by email. Higher-effort, lower-frequency Sensei voice as a counterweight to the short replies.

**Therapist mode.** A read-only view of a user's progress that they can share with their actual therapist if they're seeing one. Could be a one-off PDF export or a magic link.

**Progress export.** Let users download their full history as JSON or CSV. Useful for users who want to track their own data, and a goodwill gesture for the data-portability question.

**Real-world challenge generator.** User describes a situation they're avoiding, and the system suggests a tier-appropriate version of that exposure. Bridges the rigid catalogue and the messy reality of life.

**Multilingual Sensei.** The system prompt is English-only. Users who'd prefer Sensei to reply in their own language are a meaningful segment globally. Not hard to add once there's reason to.

**Accessibility audit.** Reduced-motion is supported, focus-visible is styled. Worth a proper screen reader pass and keyboard-only flow check before any wider release.

## Key files and where things live

```
backend/
  app/
    config.py           — Pydantic settings, reads from .env
    database.py         — async engine, URL normalisation, SQLite FK pragma
    models/             — SQLAlchemy 2.0 models
    routes/             — FastAPI routers
    services/
      coach.py          — Sensei prompt and OpenAI client
      completion.py     — completion orchestrator
      xp.py             — XP and level calculations
      streak.py         — streak tracking
      achievements.py   — achievement unlock logic
      recommender.py    — rule-based recommender + log
  alembic/
    env.py              — converts async URL to sync for Alembic
    versions/           — migrations, owned by Alembic
  seed.py               — populates challenges + achievements
  Procfile              — release hook (ignored by Render free tier)
  requirements.txt
  
frontend/
  src/
    screens/            — top-level routes
    lib/                — utilities incl. displayName helper
    styles/tokens.css   — design tokens, reduced-motion overrides
  .env.production       — VITE_API_URL pointing at api-seynsei.seyn.co.uk/api
  .npmrc                — legacy-peer-deps=true (vite plugin peer dep workaround)
  
.github/workflows/keep-warm.yml  — 5-minute pinger
README.md                        — single source of truth, alembic docs included
HANDOVER.md                      — this file
```

## Operational runbook

**Deploying backend changes.** Push to `main`. Render auto-deploys. If you change a SQLAlchemy model, generate a migration locally with `alembic revision --autogenerate -m "..."`, review the diff, commit alongside the model change, then run `DATABASE_URL="$PROD_DB" alembic upgrade head` from your local machine to apply to production. Render's release hook is ignored on free tier.

**Deploying frontend changes.** Push to `main`. Vercel auto-deploys.

**Rotating the database password.** Reset in Supabase, immediately update `DATABASE_URL` in Render env vars, re-export `$PROD_DB` locally with the new password. Backend is briefly down during Render's redeploy (~60s).

**Inspecting production state.** From local with `$PROD_DB` exported: `alembic current` for the current revision, `alembic history` for all revisions, `alembic check` to detect model drift.

**Adding a new challenge or achievement.** Edit `seed.py`. Run `python seed.py` locally against production. Idempotent: it only inserts when the table count is zero, so to add new entries you'll need to either temporarily relax the guard or insert manually via Supabase SQL editor.

## Status

Phase 5.4 complete. Production live. Awaiting solo trial period before scaling. Decisions deferred until real user data exists: ML recommender, avatar art, subscription model, monetisation strategy.
