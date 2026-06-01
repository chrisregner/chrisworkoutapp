# CLAUDE.md

## What this project is

A personal strength training app, built for one user (the author), focused on the
domain of structured progressive overload programming. It exists for two reasons,
in roughly equal weight:

1. **Daily use.** A real tool the author uses in the gym, with rolling rotation
   programming, equipment-aware load selection, and frictionless logging.
2. **A serious portfolio piece.** A demonstration of domain-driven design and
   pragmatic layered architecture applied to a domain with real complexity, in
   pure TypeScript on the frontend, with PGLite for local-first persistence.

If you find yourself optimizing for "general-purpose fitness app users," you've
lost the plot. There are no other users. The author's specific equipment, training
style, and ergonomic preferences are the spec.

## What this project is NOT

- A SaaS product. No accounts, no auth, no multi-tenant anything.
- A calendar-based scheduler. See "Rolling rotation" below — this is non-negotiable.
- A generic exercise logger. The progression *engine* is the point; logging is a
  consequence of it.
- An AI-powered app. AI may be used as a developer tool for authoring config, but
  the runtime does not depend on it. The domain logic is fully deterministic.
- A demonstration of every architectural pattern. Patterns earn their place by
  solving real problems in this codebase or they don't appear.

## The core domain insight

Strength training programming has structure that most fitness apps ignore:

- **Progression is a strategy, not a setting.** Linear progression, Heavy/Light
  cycles, reverse pyramid, autoregulation — each has its own state machine and
  its own invariants. The app models progression schemes as pluggable strategies,
  not as flags on a workout.
- **Equipment is discrete.** You don't have "any weight." You have a 12kg
  kettlebell and a 16kg kettlebell. Every load decision is a constrained choice
  from a small set. This shapes the data model and the UX.
- **Invariants matter.** A Heavy/Light pair where the light session has less
  volume than the heavy session is meaningless. The type system and smart
  constructors enforce this; no invalid state is representable in memory.
- **Workouts roll, they don't repeat weekly.** A program is a sequence of days
  you cycle through at your own pace, not a Monday/Wednesday/Friday calendar.

These insights are the project. Architecture serves them.

## Rolling rotation (the most important UX decision)

The home screen is "Next workout: Day 4. Tap to start." Not a weekly grid. Not a
calendar.

When the user taps "today's workout," the app serves up the next day in the
rotation — regardless of what the calendar says. Skipped a week? Pick up where
you left off. Trained twice in one day? Two days advance. The system tracks
position in the program, not position in the week.

Get this right and the app is invisible. Get it wrong and the user fights it
every session. Any UI or data model decision that drifts toward calendar
thinking should be questioned.

## Architectural principles

The codebase is organized into four layers with a strict dependency direction:

```
ui  →  app  →  domain  ←  persistence
```

- **`domain/`** — Pure TypeScript. The strength training model.
  Branded primitives, smart constructors, pure functions, typed errors. No
  React, no Drizzle, no IO. Fully testable without a DB or browser.
- **`persistence/`** — Drizzle schema, PGLite client, repositories, mappers.
  Knows about the database, knows nothing about the UI. Translates between
  flat row types and rich domain objects. Re-validates on read.
- **`app/`** — Application services. Orchestrates repositories and domain
  smart constructors. Where use cases live ("start next workout," "create
  exercise"). Transaction boundaries belong here.
- **`ui/`** — React + Mantine. Calls services via hooks. Contains no business
  logic and no direct DB access.

### Type universes are separate by design

- **Domain types** are rich, nested, branded. `EquipmentDef` contains its
  `pieces`. `ExerciseDef` contains a resolved `EquipmentDef`. `PositiveInt`
  is not just `number`.
- **Persistence types** (`*Row`) are flat rows produced by Drizzle inference.
  They mirror the database, not the domain.
- **Input types** (`*Input`) are plain shapes from the outside world (forms,
  JSON imports). They flow into smart constructors and become domain objects.

Conversion happens explicitly at boundaries. The domain layer never imports
from persistence.

### Smart constructors over setters

Every aggregate has a `make*` function that takes an `Input`, validates all
invariants (its own and cross-entity ones from context), and returns a trusted
domain object. If construction succeeds, the object is valid. There is no
"validate later" path.

The HeavyLight invariant — heavy resistance > light resistance, light volume >
heavy volume — is enforced in `makeProgressionDef`, not in a validator that
might or might not be called.

### Re-validation across the persistence boundary

Reading from PGLite is treated like reading untrusted input. Repository read
functions re-parse rows AND jsonb fields with Zod (shape only) and then re-run
smart constructors (invariants). Zod and the smart constructor have separate
jobs — "re-parse to confirm, don't redefine." Invariants live in exactly one
place: the smart constructor.

### Historical snapshots, not live references

`EquipmentPieceSnapshot` inside `VolumeSet` is an immutable historical record.
`pieceId` is lineage metadata; it is NOT validated against the live
`equipment.pieces` set at read time. The snapshot's own `resistance` and
`quantity` are the source of truth for that record. Editing equipment never
invalidates historical progressions. "What did I actually lift" is the
question the domain answers.

### Typed errors

Domain failures are typed (`InvariantViolationError`, `EntityNotFoundError`,
etc.), not string-matched. UI can distinguish recoverable user errors from
system errors without parsing messages.

### Presentation state lives outside domain types

Domain types model what a training program *is*. They do not model how the
author chooses to look at it. Sort order, column ordering, collapsed sections —
none of that belongs on `ProgressionDef`. Two devices opening the same
progression can legitimately disagree on sort order; they cannot disagree on
what was lifted.

View preferences are still persisted — localStorage would not survive a cache
clear and would block any future sync. They live in a separate table (e.g.
`progression_view_state`) with a FK to the owning domain row and CASCADE on
delete. The repository exposes view state through its own read/write methods.
A UI hook combines the domain object and the view state into a view-model;
the domain object itself never knows about the preference.

Concrete: `sortOrder` for the progression grid — an ordered list of
`{column: 'resistance' | 'sets' | 'reps', direction: 'asc' | 'desc'}` —
lives in `progression_view_state`, not on `ProgressionDef`.

## Patterns deliberately NOT used

These are skipped on purpose, not by accident:

- **Interfaces for repositories.** There is one implementation. The interface
  would be ceremony.
- **CQRS, event sourcing, command buses.** Overkill for a single-user
  local-first app.
- **DTOs as a third type universe.** Domain types are passed to React directly.
  Row types and domain types are already two representations; a third layer
  earns nothing here.
- **Hexagonal / Ports & Adapters terminology.** The structure resembles it;
  the vocabulary is avoided because the vocabulary tends to take over.
- **Result<T, E> everywhere.** Exceptions with typed error classes are used
  instead. Pick one and be consistent; mixing is worse than either alone.
- **Mocking libraries.** Tests use real in-memory PGLite (via `makeTestDb`)
  and real repos. If a test wants mocks, the design is leaking — refactor or
  expand scope to integration. See the `chrisworkoutapp-testing` skill.

## Technical stack

- **React + Mantine** for UI. Mobile-first. Buttery touch interactions are
  table stakes — wake lock, haptics, optimistic UI, recovery from interruption.
- **TanStack Query** for server/DB state in the UI. Queries dedupe and cache;
  mutations invalidate query keys. Local `useState` is for UI-only state.
- **PGLite** for persistence. Real Postgres in the browser. No server.
- **Drizzle ORM** for schema and queries. SQL-first, lightweight, plays well
  with PGLite.
- **drizzle-kit + version-gated migration runner.** SQL migrations live in
  `src/persistence/migrations/`. The runner reads them via Vite's
  `import.meta.glob`, sorts by filename prefix, and applies pending versions
  in a transaction per migration against a `schema_version` table. Existing
  IDB databases get bootstrapped to version 0 without re-running SQL.
- **Zod** for *shape* validation at trust boundaries (DB reads, user input,
  JSON imports). Shape only — invariants live in smart constructors.
- **Vitest + fast-check** for testing across all layers. **React Testing
  Library + user-event** for UI integration tests, rendered against real
  in-memory PGLite + real services via a `renderWithProviders` helper. Same
  no-mocking-library rule applies to UI: no service mocks, no shallow render.
  UI tests enumerate user-observable behaviors and assert one per behavior
  through the public surface (role/label/text queries). See the
  `chrisworkoutapp-testing` skill.
- **Docker** for the development environment.

## Working in this codebase

- **Domain changes are the most expensive.** Touching a smart constructor, a
  domain type, or an invariant ripples through tests, mappers, and services.
  Worth the cost — the alternative is invariants enforced in scattered
  validation that drifts.
- **Persistence changes are routine.** Schema migrations, new queries, new
  repository functions. Should not affect domain or UI if mappers absorb the
  difference.
- **UI changes should not require domain changes.** If they do, the domain
  is wrong or the UI is reaching past the service layer.
- **New features start in the domain.** Model the types first. Write the smart
  constructor. Write property tests. Then add persistence and UI.
- **Tests live next to code** (`*.test.ts` / `*.test.tsx`). Domain tests are
  fast and have no setup. Persistence/app tests use real in-memory PGLite via
  `makeTestDb`. UI tests render real screens through real services against a
  fresh PGLite per test — no mocked services, no shallow rendering.

## What "done" looks like for a feature

A feature is not done when the UI works. A feature is done when:

1. The domain types express the new concept and its invariants.
2. Smart constructors enforce those invariants; property tests prove they hold.
3. Persistence reads and writes round-trip cleanly with re-validation on read.
4. A service orchestrates the use case end-to-end.
5. The UI surfaces it with mobile-first ergonomics.
6. Every user-observable behavior of the new UI surface has one RTL
   integration test that would catch its regression.
7. The README or relevant doc reflects any new architectural decision.

Skipping steps to ship faster is a deliberate decision, not a default. Note
the skip in a comment or TODO so the debt is visible.

## Scope discipline

Features that would dilute the project are not built unless they pay rent:

- **No charts** until the core loop is solid and the user (author) actually
  asks for one. Charts are easy to add and easy to use as procrastination.
- **No tags system** until there's a concrete use case the data model can't
  serve.
- **No multi-device sync** until single-device works perfectly.
- **No AI features at runtime.** AI may be used for authoring config files
  offline; it does not run in the app.
- **No accounts, no cloud.** If this ever needs to be portable across devices,
  export/import JSON.

When in doubt: build less, build it deeper.
