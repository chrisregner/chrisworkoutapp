---
name: chrisworkoutapp-testing
description: Testing rules for the chrisworkoutapp repo — what to test per layer (domain / persistence / app / ui), what NOT to test, fast-check vs example tests, PGLite integration setup via makeTestDb, naming, speed targets, regression policy, and when test friction signals a design leak. Use whenever writing or modifying tests under src/**/__tests__/, adding a new aggregate or service that needs coverage, deciding between unit and integration scope, reaching for a mocking library, debating "should I test this", reviewing test files, or asking "how do I test X in this project". Pushy default — if you're about to write a `*.test.ts` in this repo, consult this skill first. Companion to [[chrisworkoutapp-architecture]].
metadata:
  type: project-testing
---

# chrisworkoutapp testing

Tests in this repo earn their place the same way layers do: each test exists because it proves something the type system can't, locks in an invariant, or catches a regression. If a test is just typing exercise, it's debt.

The single most important rule: **no mocking library**. If a test wants mocks, the design is leaking — refactor it, or expand scope to integration. The only acceptable "fakes" are real in-memory PGLite (via `makeTestDb()`) and real repos.

## Scope by layer

### domain/

Pure unit tests + property tests with `fast-check`. No DB, no React, no IO, no mocks. Each test runs in milliseconds.

- **Path:** `src/domain/<aggregate>/__tests__/<name>.test.ts`
- **Tools:** `vitest` + `fast-check`
- **Why pure:** domain is the thing that has to be correct. Tests should fail when domain logic is wrong, not when infrastructure is wrong.

### persistence/

Integration tests against real in-memory PGLite. **Never** mock the database. Repos exist to talk to a real DB — mocking them tests nothing.

- **Path:** `src/persistence/repositories/__tests__/<repo>.test.ts`; `src/persistence/__tests__/` for client/migration tests
- **Setup:** `import { makeTestDb } from '../../testing'` — each test gets a fresh in-memory DB
- **Tools:** `vitest` + real PGLite
- **Why integration:** the repo *is* the integration with the DB. There's nothing else to test about it.

### app/

Service tests with real in-memory PGLite + real repos. Wire `new DefinitionsService(db)` and exercise public methods end-to-end. No mocks of repos.

- **Path:** `src/app/__tests__/<service>.service.test.ts`
- **Setup:** same `makeTestDb()` helper
- **Why end-to-end:** service correctness is orchestration correctness. Mocking the repos removes the only thing worth verifying.

### ui/

Integration tests with React Testing Library + real in-memory PGLite + real services. No service mocks. No component shallow-rendering. Same "no mocking library" rule as everywhere else.

- **Path:** `src/ui/features/<feature>/__tests__/<screen>.test.tsx`
- **Setup:** `renderWithProviders(<Component />, { db })` helper wires DbProvider + QueryProvider + AppServicesProvider + MemoryRouter + MantineProvider around a fresh test DB
- **Tools:** `vitest` (jsdom env) + `@testing-library/react` + `@testing-library/user-event` + `@testing-library/jest-dom`
- **Why integration:** UI bugs live in wiring (service call → query invalidation → re-render). Unit-testing a component in isolation tests nothing real.

Guiding frame — **the only one that matters**:

> **Enumerate every user-observable behavior. Test each once at the correct level.**
> **Every behavior a user depends on has one test that would catch its regression.**

Stop thinking "how many tests." Start thinking "what behaviors exist." Test count falls out of behavior inventory.

#### How to enumerate behaviors (the method)

For each screen / feature, write behavior sentences in the form `when [trigger], [observable outcome]`. Put them as a comment block at top of the test file. One `it(...)` per bullet.

Behavior categories to walk through per screen:

1. **Happy path** — primary action works end-to-end
2. **Empty state** — what renders w/ no data
3. **Loading state** — async pending UI
4. **Error state** — service throws → typed error → human msg
5. **Validation** — invalid input rejected w/ correct message
6. **Optimistic update** — UI reflects intent before mutation resolves (if applicable)
7. **Mutation rollback** — failed mutation reverts UI (if applicable)
8. **Navigation** — actions route correctly
9. **Persistence boundary** — remount/refresh preserves state user expects preserved
10. **Cross-screen invariant** — change on screen A reflects on screen B

Not every screen needs all 10. Most need 3-6. Skip categories that don't apply; don't manufacture tests to fill a checklist.

#### Test through user-visible surface

- Query by role / label / text, in that order. `getByRole('button', { name: /save/i })`.
- `data-testid` only as last resort when no semantic query exists.
- `userEvent` (not `fireEvent`) — closer to real interaction.
- Assert what user sees: text content, presence/absence of elements, navigation result.
- Don't assert: which hook fired, which query key was invalidated, internal component state.

#### What NOT to test in UI

- Mantine render output — library job
- TanStack Query internals — library job
- Component shallow render w/ mocked services — mocks lie, design leaks
- Same behavior already covered at domain/persistence/app level — pick one layer
- Branded type identity / TS-enforced things
- Pixel-perfect layout — that's visual regression's job (not used here yet)

#### Pure validators

If a form field validator has non-trivial logic, **extract it as pure fn** and test w/ `fast-check` in domain or shared. Don't test validation through Mantine `getInputProps` wiring.

#### E2E (Playwright) — when to add

Deferred until first behavior RTL genuinely can't cover:

- Wake lock acquired on workout start
- Service worker / install / PWA flows
- Refresh mid-workout restores state (jsdom can fake but real browser is the proof)
- Touch / haptic interactions

Add Playwright per-flow as that need arises. Keep < 15 specs total.

### shared/

Only test if there's real logic. `newId` wraps `crypto.randomUUID` — skip.

## What to test

### Domain smart constructors

For each smart constructor:
- **Every guard branch** — one example test per `throw new InvariantViolationError(...)`. These are *diagnostic*: they tell you which invariant broke.
- **At least one property test per non-trivial invariant**, using `fc.assert(fc.property(...))`. The property test is the *proof* — the example tests are the diagnosis.

Both matter. Properties prove the rule holds in general; examples make a regression's cause obvious.

### Domain pure functions

`volumeOf`, `totalResistance`, `nextPrescription` (when added), etc.:
- **Property tests** for algebraic properties: monotonicity, idempotence, identity, commutativity where it applies.
- **Example tests** for known fixed cases — anchor the math so a refactor that flips a sign gets caught with a clear failure.

### Persistence round-trip

One round-trip test per aggregate: `make → save → find` returns a domain-equivalent object. This is what proves the mappers and Zod re-validation neither lose nor corrupt data. If round-trip passes, the mappers are wired right.

### Persistence error paths

Test that `EntityNotFoundError` (and friends) is thrown when expected — dangling FK, unknown id, etc.

To create dangling-FK states the schema otherwise prevents:

```typescript
await db.execute(sql`SET session_replication_role = 'replica'`)
// ...do the thing the schema would normally block
await db.execute(sql`SET session_replication_role = 'origin'`)
```

### Persistence validators (Zod)

Lock in the contract: **shape-only, re-parse don't redefine**.

- Zod schemas REJECT structural malformation (missing fields, wrong types).
- Zod schemas ACCEPT values that violate domain invariants — those are the smart constructor's job.

This test exists specifically to prevent Zod from drifting back into invariant enforcement and creating two sources of truth for what's valid.

### App services

Orchestration correctness:
- "Create then find returns equivalent."
- "Update preserves identity."
- "References to missing entities throw typed errors."
- **Regression tests** for any data-integrity bug previously fixed (e.g. piece ID preservation).

### UI screens / features

One RTL integration test per enumerated behavior (see ui/ section above). Public surface only — what user sees and does. Wire real services through `renderWithProviders`.

## What NOT to test

- Trivial getters / passthrough functions.
- Mantine component rendering. That's the library's job.
- Drizzle query building. Library's job — test the round-trip outcome, not the SQL string.
- Mocked layer boundaries. At this scale, mocks defeat the test.
- Branded primitive identity. TypeScript enforces it — only test the *validation logic* inside `positiveNumber` / `positiveInt` / `uuidOf`.
- Re-implementations of what the type system already enforces.

## Tooling

- **`vitest`** — runner, parallel by default. `jsdom` env for UI tests; node env elsewhere.
- **`fast-check`** — property tests. Use `fc.assert(fc.property(arbitrary, predicate))`.
- **PGLite in-memory** — `new PGlite()` with no `idb://` URL, via `makeTestDb()` for persistence + app + UI tests.
- **`@testing-library/react`** + **`@testing-library/user-event`** + **`@testing-library/jest-dom`** — UI integration tests. Query by role/label/text. `userEvent` not `fireEvent`.
- **`renderWithProviders`** helper — wires DbProvider, QueryProvider, AppServicesProvider, MemoryRouter, MantineProvider around a fresh test DB. Lives in `src/ui/testing/`.
- **No mocking library.** If you reach for one, stop. Either the unit under test is too entangled (split it) or the test belongs at a higher integration level (expand its scope).

## Test file conventions

- **Path:** `<dir>/__tests__/<name>.test.ts` next to the file under test.
- **Naming:**
  - `describe('<unit-under-test>')` — the thing being tested.
  - `it('<observable-behavior>')` — reads as a sentence. No "should". Example: `accepts quantity independent of currently-owned piece quantity (historical snapshot)`.
- **Property test names** state the proven property: `any valid pieces array round-trips through smart constructor`.
- **Assertions per `it`:** one when reasonable; multiple OK if they cover the same observable behavior. Don't artificially split.
- **Fixtures:** fresh per test. No shared mutable state across tests in a file.

## Regression policy

Every bug fix gets a test that **fails before the fix and passes after**. Name it after what was broken:

```typescript
it('updateEquipment preserves piece IDs', () => { /* ... */ })
```

This is the one situation where it's fine to write a test focused on a specific past failure rather than a general property. The history-of-bugs-fixed list inside the test suite is itself valuable documentation.

## Speed targets

- Domain test file: **< 50ms**.
- Persistence/app test file (with PGLite init): **< 1s per test, < 3s per file**. PGLite init dominates (~500ms) — amortize by grouping related tests in one file when feasible.
- UI integration test file (PGLite + render): **< 2s per test, < 8s per file**. Render + query hydration adds cost on top of PGLite init.
- Full suite target: **< 30s** once UI tests land. If it grows beyond that, reach for parallelism / file consolidation before cutting tests.

If a domain test file is slow, something is wrong: the test is doing IO, or the production code is. Investigate before papering over.

## When tests drive refactors

Listen to the friction:

- **Hard to test without mocks** → design is leaking. Split the unit, or invert the dependency. Don't import a mocking library.
- **Hard to test deterministically** (clock, UUID, random) → if injecting a generator adds visible ceremony to production code, accept non-determinism in tests instead. Read the generated ID out of the result, assert on shape, etc. Don't restructure production code to serve test ergonomics when the cost is real.
- **Test needs to know layer internals** → the seam is wrong. Test through the public surface or move the test to where that surface lives.
- **UI test wants to mock a service** → the component is reaching too deep, or render scope is too narrow. Render higher up and use the real service over PGLite.

## Quick checklist before writing a test

1. Which layer owns the unit? Put the test in `<dir>/__tests__/`.
2. Domain? → pure + property test. No DB, no React.
3. Persistence/app? → `makeTestDb()`, real repos, no mocks.
4. UI? → `renderWithProviders` + real services + PGLite. One test per enumerated behavior. Query by role/label/text.
5. Reaching for a mock? Stop. Reconsider the seam.
6. Fixing a bug? Write the failing test first; name it for what broke.
7. Property or example? Property proves; examples diagnose. Both is fine.
8. New screen/feature? List behaviors as comment block first — one `it(...)` per bullet.

## Rule of thumb

A test should fail for exactly one reason, and that reason should be a bug a human cares about. If a test fails because a library changed its SQL output, or because a Mantine prop got renamed, or because a mock drifted from reality — that test is costing more than it pays.
