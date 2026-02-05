# Mosaic

Mosaic is a multi-tenant, invitation-only SaaS platform built for music agencies and their artists.

It is designed around:
- agency-based tenancy
- role-based access (agent / admin)
- secure invitation-only onboarding
- database-enforced security via Row Level Security (RLS)

The initial target audience is digitally savvy musicians and music-industry professionals
(e.g. rock/metal agencies such as Mosaic Music).

---

## Tech stack

- **Next.js (App Router)** — frontend
- **Supabase** — Postgres, Auth, Row Level Security
- **Vercel** — hosting and CI/CD

---

## Getting started (local development)

```bash
npm install
npm run dev
Create a .env.local file with:
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
Then open:
	•	http://localhost:3000/login

⸻

Documentation

The main project documentation lives in the /docs￼ folder:
	•	Architecture overview → docs/ARCHITECTURE.md￼
	•	Database & RLS → docs/DATABASE.md￼
	•	Runbook (how to run, deploy, debug) → docs/RUNBOOK.md￼

If you are new to the codebase, start with ARCHITECTURE.md.

⸻

Project status

This is an actively developed hobby project with production-grade foundations.

Core flows implemented so far:
	•	authentication
	•	agency membership
	•	admin invitations
	•	secure invite acceptance

Planned work is tracked in TODO.md￼.

⸻

Notes

This project was originally bootstrapped using create-next-app.

The default Next.js boilerplate README has been intentionally replaced with
project-specific guidance.