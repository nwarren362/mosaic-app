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
