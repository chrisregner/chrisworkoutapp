---
name: pattern-check
description: >
  Pause and ask the user before an architectural or structural decision in chrisworkoutapp
  when there is no clear precedent or two defensible approaches exist. Use this skill whenever:
  (1) a new concept doesn't clearly fit an existing layer/pattern,
  (2) layer placement is ambiguous (domain vs app vs persistence vs ui),
  (3) a new naming convention or structural pattern would be introduced,
  (4) a cross-entity invariant could live in either the domain or app layer,
  (5) an architectural choice would be hard to reverse or would set a precedent,
  (6) you notice the code you're about to write deviates from existing conventions.
  Do NOT use for choices already settled by CLAUDE.md or the chrisworkoutapp-architecture skill.
  Do NOT trigger for code that clearly fits an existing pattern (e.g., adding a new equipment
  piece using the established make* + repo + service + hook chain).
  When in doubt, trigger the skill — a false positive question costs less than a silent wrong choice.
---

# Pattern Check

When you reach a decision point where the right architectural or structural choice is unclear,
don't pick silently. Surface the ambiguity to the user first.

## When to trigger

Trigger this skill when:

- **No precedent exists** — the new concept doesn't map to an established pattern in the codebase
- **Ambiguous layer placement** — a piece of logic could reasonably live in domain, app, persistence, or ui
- **Two defensible options** — both choices are architecturally valid but lead to different structural consequences
- **Pattern inconsistency** — what you're about to write would deviate from existing naming, structure, or conventions
- **Hard-to-reverse choice** — the decision would be expensive to change later or sets a precedent for future code

Do not trigger for:
- Choices fully covered by CLAUDE.md or the `chrisworkoutapp-architecture` skill
- Code that clearly slots into an existing pattern (adding another field, another piece, another hook on an established entity)
- Minor naming variations with no structural consequence

## How to handle it

### Step 1 — Name the decision point precisely

State what you're about to decide, in one sentence. Be specific:

> "This computed value (`nextWorkoutIndex`) needs to live somewhere — it could be a pure function in domain, or derived logic in a service, or a selector in a query hook."

Not vague:
> "I need to figure out where to put this logic."

### Step 2 — Cite what existing patterns say

Quote the specific file and pattern that's closest, and explain where it falls short:

> "`makeProgressionDef` (`src/domain/progression/progression.ts`) enforces cross-entity invariants in the domain layer — but that only works when all required data is available at construction time. Here, `nextWorkoutIndex` depends on runtime query results, which domain doesn't have access to."

This shows the user you've checked the existing patterns, not just guessing.

### Step 3 — Present 2–3 concrete options

Each option should be specific enough to implement, not abstract:

> **Option A — Domain pure function**: `nextWorkoutDay(program: ProgramDef): WorkoutDay` in `src/domain/program/program.ts`. Pure, testable, no DB dependency. Requires full `ProgramDef` to be loaded first.
>
> **Option B — Service method**: `getNextWorkoutDay(programId: string)` on `WorkoutService` in `src/app/`. Lets the service resolve and compute in one call. Less pure, but matches how `createEquipment` works when it needs to check for conflicts.

Keep options to 2–3 max. More than that signals you haven't narrowed it down enough.

### Step 4 — Ask one focused question

Ask the user to pick, with your recommendation if you have one:

> "Which fits better here — pure domain function (Option A) or service method (Option B)? I'd lean toward A since this is a pure derivation with no side effects, but B avoids the caller needing to pre-load the full program."

Use `AskUserQuestion` if available. Otherwise ask inline and wait for the response before writing any code.

## Established patterns in this codebase (for reference)

These are settled — do not ask about them:

| Pattern | Location | Convention |
|---------|----------|------------|
| Branded primitives | `src/domain/primitives/branded.ts` | `PositiveInt`, `Uuid`, etc. |
| Typed errors | `src/domain/primitives/errors.ts` | `InvariantViolationError`, `EntityNotFoundError`, `ConflictError` |
| Domain aggregates | `src/domain/<entity>/<entity>.ts` | `make*` constructor + `*Input` type |
| Cross-entity invariants | inside `make*` or service | depends on whether all data is available at construction |
| Repositories | `src/persistence/repositories/<entity>.repo.ts` | `list*`, `find*`, `save*`, `delete*` |
| Mappers | `src/persistence/repositories/mappers.ts` | `rowsTo*`, `*ToRow` |
| Shape validators | `src/persistence/repositories/validators.ts` | Zod schemas, shape only |
| Services | `src/app/<context>.service.ts` | orchestrate repos + smart constructors |
| Query keys | `src/ui/features/<entity>/<entity>Keys.ts` | `*Keys` factory + `*Queries` object |
| Invalidations | `src/ui/features/<entity>/<entity>Invalidations.ts` | `invalidate*After*` functions |
| Query/mutation hooks | `src/ui/features/<entity>/use*.ts` | wraps service calls |
| Providers/context | `src/ui/providers/` | service instances via context |

## Examples of when to ask

**Ask**: "This new `WorkoutLog` aggregate tracks completed sets — it needs to store a snapshot of the progression at time of logging. Should the snapshot type live in `domain/progression/` (near `ProgressionDef`) or in `domain/workoutLog/` (near its consumer)?"

**Ask**: "The `calculateLoad` function needs the equipment list to pick from discrete pieces. Should this be a pure function in domain (taking `EquipmentDef[]` as a param) or a service method that fetches equipment itself?"

**Ask**: "I'm about to name this `WorkoutSessionInput` — but all existing input types are `*DefInput`. Should this break the `*Def` convention since a session isn't a definition, or should I align with `*Input` only?"

**Don't ask**: "Should I use `listEquipmentDefs` from the repo?" — clearly follows the existing pattern.

**Don't ask**: "Should this component use a `useState`?" — covered by CLAUDE.md (UI-only state = `useState`).
