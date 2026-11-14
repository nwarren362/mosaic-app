# Mosaic development guidance

- Work directly in this Git repository. Do not use file exchange or Work with Apps as development mechanisms.
- Use one task for one coherent unit of work. Separate behavioural changes from refactoring.
- Inspect repository status and existing diffs before editing; preserve unrelated local changes.
- Run proportionate automated checks and focused browser acceptance testing where needed.
- Review changes before committing. Commit only tested and accepted work, staging only intended changes.
- Push only when explicitly authorised.
- Use the current checkout by default; use worktrees only for parallel, experimental or risky work.
- Keep this file concise; put practical procedures in [docs/RUNBOOK.md](docs/RUNBOOK.md).

Follow the relevant project guidance:

- [Runbook](docs/RUNBOOK.md): development, checks, acceptance, commits and deployment.
- [Architecture](docs/ARCHITECTURE.md) and [workflow architecture](docs/WORKFLOWS.md).
- [UI system](docs/UI-SYSTEM.md) for UI changes.
- [Schema](docs/schema/schema.md) and [database security](docs/db/auth-rls-rpcs.md) for data changes.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
