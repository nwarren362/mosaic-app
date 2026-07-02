# Workflow Architecture

## Philosophy

Mosaic workflows are designed around a lightweight event-driven architecture.
Workflows should enrich existing work wherever possible, not create duplicate work.

The only time a workflow should create a new task is when it genuinely represents new work.

Examples:

* ✔ “Gig cancelled” → notify stakeholders. (New work.)
* ✔ “Contract signed” → invoice client. (New work.)
* ✔ “Tour confirmed” → book accommodation. (New work.)

The goal is to:

- avoid hardcoded operational side effects inside pages and components
- minimise future rework
- keep business logic composable and reusable
- allow workflows to evolve incrementally without introducing a heavyweight BPM/workflow engine too early

This architecture is intentionally pragmatic.

We are NOT building:

- a no-code automation platform
- a graphical BPM engine
- an enterprise orchestration product

Instead, we are building a clean internal operational workflow layer for a multi-tenant music agency CRM.

---

# Operational Measurement Requirement

Workflow architecture must support operational measurement from the beginning.

One of Mosaic's commercial goals is to help agencies work faster, more reliably, and more professionally. This must eventually be provable.

The system should be designed so an agency manager can answer questions such as:

- how long it takes to move a gig from planned to fully confirmed
- how long it takes to notify all relevant parties after a material gig change
- how long venue selection takes during gig or tour planning
- how long full tour confirmation takes
- how processing times compare between agents for similar work
- where tasks, confirmations, or communications are regularly delayed

This means workflow events, tasks, activity entries, and future communications should preserve timestamps and enough structured metadata to support later reporting.

The first versions do not need full analytics dashboards, but the underlying records should avoid destroying timing information or collapsing important process steps into vague free-text notes.

Workflow analytics is therefore not merely a future nice-to-have. It is a core capability that the architecture must enable incrementally.

---

# Core Principle

Pages and UI components should trigger domain events.

Workflow handlers react to domain events.

Workflow handlers create operational actions.

Operational actions may include:

- tasks
- activity log entries
- notifications
- emails
- future integrations

This separation is extremely important.

Good:

```text
Gig page updates status
→ dispatches domain event
→ workflow reacts
→ tasks created
→ notifications created
```

Bad:

```text
Gig page directly:
- inserts tasks
- inserts notes
- sends emails
- updates unrelated records
- creates notifications
- triggers integrations
```

The second approach creates duplication, technical debt, and extremely high future maintenance cost.

---

# Architectural Layers

## 1. Domain Events

A domain event represents something meaningful that happened within the business domain.

Examples:

- Gig cancelled
- Gig confirmed
- Task completed
- Venue marked inactive
- Artist onboarded

Domain events are factual statements.

They should:

- be immutable
- contain enough context for workflows to react
- include reliable timestamps
- preserve the actor/user responsible where relevant
- support later measurement of process duration
- avoid UI-specific concerns
- avoid presentation logic

Examples:

```text
gig.cancelled
artist.created
venue.contact_added
task.completed
```

---

## 2. Workflow Handlers

Workflow handlers react to domain events.

Handlers may:

- create tasks
- create activity entries
- trigger communications
- schedule follow-up actions
- later trigger external integrations

Examples:

```text
handleGigCancelled()
handleTaskCompleted()
```

Workflow handlers should:

- remain focused
- be deterministic
- avoid UI concerns
- reuse shared operational primitives

Workflow handlers should NOT contain duplicated insert/update logic.

---

## 3. Operational Actions

Operational actions are reusable primitives.

Examples:

```text
createTask()
completeTask()
createActivityNote()
```

These are intentionally generic.

The purpose is to avoid repeated Supabase insert/update code across workflow handlers.

Operational actions become the reusable building blocks for all future workflows.

Operational actions should also preserve measurement context where relevant. For example, task creation, task completion, communication sending, and confirmation events should keep enough structured data to calculate elapsed time later.

---

# Initial File Structure

```text
src/lib/workflows/
├── types.ts
├── domainEvents.ts
├── dispatcher.ts
├── gigWorkflows.ts
└── taskActions.ts
```

---

# Current Scope (V1)

The initial workflow architecture is intentionally small.

V1 goals:

- establish architectural boundaries
- standardise event dispatching
- avoid future rework
- support simple operational automations
- preserve timestamps and actor context for later analytics
- avoid data patterns that would make process-duration reporting difficult later

Initial examples:

- Gig cancelled
  - create activity entry
  - create venue follow-up task
  - create artist follow-up task

- Task completed
  - create completion activity entry

---

# Analytics Direction

Workflow analytics should eventually help agency managers understand operational performance.

Important future metrics include:

- average time from planned gig to fully confirmed gig
- average time from gig change to all parties informed
- average time to select venues for a gig or tour
- average time to complete tour setup
- overdue task rates by agent
- task completion times by agent
- workflow bottlenecks by process type
- communication delay patterns

These metrics should be derived from structured workflow, task, activity, and communication records rather than manually entered summaries.

This reinforces the need to record:

- created_at
- completed_at
- assigned_to
- created_by
- event_type
- entity_type
- entity_id
- workflow/process identifiers where needed later

The application UI can remain simple at first, but the data model should keep enough process evidence to support credible operational reporting.

---

# Why We Are Not Building a Full Workflow Engine Yet

A full workflow engine introduces major complexity:

- visual editors
- conditional branching
- retries
- timers
- queues
- execution history
- permissions
- debugging
- workflow versioning
- user-defined logic

Most early-stage products over-engineer this too soon.

Mosaic should first:

- establish strong workflow patterns
- validate operational use cases
- discover common abstractions naturally

Only later should we consider:

- configurable workflows
- admin workflow builders
- reusable templates
- scheduled automation
- external integrations

---

# Workflow Design Principles

## Prefer Composition Over Monoliths

Small reusable actions are preferred over giant workflows.

Good:

```text
createTask()
createActivityNote()
assignTask()
```

Bad:

```text
handleEverythingAboutGigCancellationForever()
```

---

## Keep Business Logic Out of Pages

Pages should:

- collect user intent
- validate form data
- dispatch events

Pages should NOT:

- orchestrate multiple side effects
- contain operational automation logic
- duplicate workflow behaviour

---

## Keep Workflows Deterministic

Workflow handlers should:

- produce predictable outcomes
- avoid hidden side effects
- be testable
- remain understandable months later

---

## Keep Workflows Tenant-Aware

All workflow actions must remain scoped to:

```text
agency_id
```

This is a foundational multi-tenant rule.

---

# Future Direction

Potential future enhancements:

- scheduled workflows
- reminders/escalations
- email workflows
- communication templates
- approval workflows
- workflow analytics dashboards and process-duration reporting
- workflow templates
- configurable workflow rules
- integration webhooks
- automation dashboard
- operational SLA tracking

These should emerge incrementally from real operational needs.

---

# Guiding Principle

The workflow system should remain:

- understandable
- composable
- maintainable
- observable
- tenant-safe
- operationally useful

The architecture should support long-term evolution without forcing a premature enterprise workflow platform into the product.
