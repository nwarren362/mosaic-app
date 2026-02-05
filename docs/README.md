# Project Documentation

This folder contains human-readable documentation for the Mosaic SaaS platform.

These documents are written to help:
- future maintainers (including “future Nigel”)
- contributors who are not original authors
- anyone needing to understand *why* things were built a certain way

They intentionally focus on **decisions, constraints, and mental models**, not just code.

---

## Documents

### `ARCHITECTURE.md`
High-level system design:
- tenancy model
- roles and authorization
- security boundaries
- where logic lives (DB vs app)
- key user flows

Read this first if you want to understand *how the system fits together*.

---

### `DATABASE.md`
Authoritative reference for the data layer:
- tables and their purpose
- RLS strategy
- Postgres functions and triggers
- extensions (e.g. `pgcrypto`)
- common database-level failure modes

Read this when changing schema or debugging permissions.

---

### `RUNBOOK.md`
Practical, operational notes:
- how to run the app locally
- how deployment works
- environment variables
- common errors and fixes

Read this when “something isn’t working”.

---

## Philosophy

- **RLS is the security boundary**, not the UI
- **Agencies are the tenant boundary**
- **Invitations are one-time and non-recoverable by design**
- Prefer clarity over cleverness
- Prefer database-enforced rules over client-side assumptions

This documentation should evolve with the system.
When in doubt: add a short note explaining *why*, not just *what*.