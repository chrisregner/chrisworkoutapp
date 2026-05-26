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
functions re-parse jsonb fields with Zod and re-run smart constructors. A bug
that writes invalid data should not silently produce invalid domain objects on
read.

### Typed errors

Domain failures are typed (`InvariantViolationError`, `EntityNotFoundError`,
etc.), not string-matched. UI can distinguish recoverable user errors from
system errors without parsing messages.

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

## Technical stack

- **React + Mantine** for UI. Mobile-first. Buttery touch interactions are
  table stakes — wake lock, haptics, optimistic UI, recovery from interruption.
- **PGLite** for persistence. Real Postgres in the browser. No server.
- **Drizzle ORM** for schema and queries. SQL-first, lightweight, plays well
  with PGLite.
- **Zod** for runtime validation at trust boundaries (DB reads, user input,
  JSON imports). Not used for domain invariants — those live in smart
  constructors.
- **Vitest + fast-check** for testing. Property-based tests are how progression
  invariants are proven, not example tests.
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
- **Tests live next to code** (`*.test.ts`). Domain tests are fast and have no
  setup. If a test needs a database, it belongs in `persistence/`.

## What "done" looks like for a feature

A feature is not done when the UI works. A feature is done when:

1. The domain types express the new concept and its invariants.
2. Smart constructors enforce those invariants; property tests prove they hold.
3. Persistence reads and writes round-trip cleanly with re-validation on read.
4. A service orchestrates the use case end-to-end.
5. The UI surfaces it with mobile-first ergonomics.
6. The README or relevant doc reflects any new architectural decision.

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
