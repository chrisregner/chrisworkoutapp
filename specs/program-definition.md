# Spec: Program Definition (Goal 2)

Authoring-only feature. A `Program` is a reusable, rolling-rotation sequence of
days. Workout execution / logging / rotation pointer state lives elsewhere
(Goal 3). This spec covers domain → persistence → service → UI.

## Decisions captured

| Topic | Decision |
| --- | --- |
| Rest between sets | Lives on `ProgressionDef` (per `VolumeSet`). Slot may carry a fallback when no progression is chosen. |
| Sets count | Owned by `ProgressionDef` (already on `VolumeSet`). Slot may carry a fallback when no progression is chosen. |
| Heavy/Light swap pass | Auto-derived. If ANY slot in the program uses an HL progression, the rolling rotation visits days twice: pass 1 as authored, pass 2 with each HL slot's `hlPick` flipped. Stored once. |
| HL pick on slot | Required when slot's progression is HL. Smart constructor rejects missing. |
| Day shape | Ordered mixed activity list: each activity is either an `ExerciseSlot` or a `RestPeriod`. |
| Day naming | Auto index + optional label. Display: `Day 1` or `Day 1 — leg`. |
| Exercise reuse | Same `ExerciseDef` may appear N times in a day (no restriction). |
| Progression scope | `ProgressionDef` referenced by a slot must belong to that slot's `ExerciseDef` (enforced in smart constructor). |
| No-progression slot | Allowed. Must declare `sets` + `quantifierValue` + optional `restBetweenSets`. Resistance is freestyle at workout time. |
| Rest period | `durationSeconds` + optional `label`. |
| Min sizes | `≥1` day, `≥1` exercise slot per day, no upper bound. |
| Out of scope | Rotation pointer state, starting/ending sessions, logging, increment/decrement of progression, workout-time decisions. The execution domain *will consume* a `Program`, but is built in Goal 3. |

## Open follow-ups (NOT this increment)

- Editing a `Program` after creation: in-place vs snapshot-at-workout-start. Decide in Goal 3 when workout logging exists. For now, edits are in-place; no historical workouts to break yet.
- Reordering UX (drag handle vs up/down) — designer choice during inc 4.

---

## Domain shape (target)

```ts
// New
type RestPeriod = {
  readonly kind: 'rest'
  readonly durationSeconds: PositiveInt
  readonly label?: string
}

type ExerciseSlot = {
  readonly kind: 'exercise'
  readonly exercise: ExerciseDef
  readonly progression?: ProgressionDef       // optional
  readonly hlPick?: 'heavy' | 'light'         // required iff progression.body.kind === 'heavyLight'
  readonly fallback?: {                       // present iff progression is absent
    readonly sets: PositiveInt
    readonly quantifierValue: PositiveInt
    readonly restBetweenSets?: PositiveInt
  }
}

type Activity = RestPeriod | ExerciseSlot

type ProgramDay = {
  readonly id: Uuid
  readonly index: PositiveInt          // 1-based, contiguous, unique within Program
  readonly label?: string              // optional
  readonly activities: readonly Activity[]   // ≥1 ExerciseSlot required
}

type ProgramDef = {
  readonly id: Uuid
  readonly name: string
  readonly days: readonly ProgramDay[]       // ≥1
}
```

Derived (NOT stored):

```ts
function hasHeavyLight(p: ProgramDef): boolean   // true if any slot.progression?.body.kind === 'heavyLight'
function rotationLength(p: ProgramDef): number   // hasHeavyLight ? days.length * 2 : days.length
function dayAtRotationIndex(p: ProgramDef, i: number): { day: ProgramDay; swap: boolean }
```

`dayAtRotationIndex` returns the day to perform AND a `swap` flag. The
workout-flow layer (Goal 3) uses `swap` to flip every HL slot's `hlPick` at
execution time. ProgramDef itself is not duplicated in storage.

### Invariants enforced by `makeProgramDef`

1. `name` non-empty.
2. `days.length ≥ 1`.
3. Day indices: 1-based, contiguous (1, 2, 3, …), unique.
4. For each day: at least one `Activity.kind === 'exercise'`.
5. For each `ExerciseSlot`:
   a. Exactly one of `progression` or `fallback` is set.
   b. If `progression` set:
      - `progression.exercise.id === slot.exercise.id` (scope rule).
      - If `progression.body.kind === 'heavyLight'`, `hlPick` is required.
      - Otherwise `hlPick` must be absent.
   c. If `fallback` set: `hlPick` must be absent.
6. `RestPeriod.durationSeconds > 0`.

### Adjustment to `progression.ts`

Add `restBetweenSets?: PositiveInt` field on `VolumeSet`. Optional to avoid a
breaking migration for existing progressions. New constructor accepts it,
existing volume sets continue to validate without it.

```ts
type VolumeSet = {
  readonly sets: PositiveInt
  readonly quantifierValue: PositiveInt
  readonly resistanceSource: readonly ResistanceSourceEntry[]
  readonly restBetweenSets?: PositiveInt   // NEW
}
```

No invariant change beyond the existing HL volume/resistance rules.

---

## Increment plan

Four PRs, each independently mergeable and tested. Stop after any increment
without breaking what was built before.

### Increment 1 — Domain

**Files**

- `src/domain/program/program.ts` (new)
- `src/domain/program/index.ts` (new)
- `src/domain/program/__tests__/program.test.ts` (new)
- `src/domain/progression/progression.ts` (add `restBetweenSets` to `VolumeSet` + input)
- `src/domain/progression/__tests__/progression.test.ts` (cover new field)
- `src/domain/index.ts` (re-export program)

**Build**

1. Types per "Domain shape" above. Branded primitives reused (`PositiveInt`, `Uuid`).
2. `makeRestPeriod`, `makeExerciseSlot`, `makeProgramDay`, `makeProgramDef` smart constructors.
3. Typed errors via existing `InvariantViolationError`.
4. Derived helpers: `hasHeavyLight`, `rotationLength`, `dayAtRotationIndex`.
5. `restBetweenSets` added to `VolumeSet` + `VolumeSetInput`; threaded through `makeVolumeSet`.

**Tests**

- Example tests for each invariant (1–6 above) — assert each rejects with the expected error path.
- fast-check property tests:
  - For any valid `ProgramDef`, `dayAtRotationIndex(p, i)` for `i ∈ [0, rotationLength(p))` returns a day with `swap === (hasHeavyLight && i >= days.length)`.
  - For any valid `ProgramDef`, day indices form `1..N` exactly once.
- Round-trip: `makeProgramDef(programDefToInput(p))` deep-equals `p`.
- `hasHeavyLight` true iff at least one slot's progression is HL.

**Acceptance**

- `pnpm test src/domain/program` green.
- No imports from `persistence/`, `app/`, `ui/`, React, Drizzle.
- TypeScript: `make*` functions return branded `Readonly` shapes; inputs are plain.

---

### Increment 2 — Persistence

**Files**

- `src/persistence/schema.ts` (add tables)
- `src/persistence/migrations/000X_program.sql` (new, version-gated)
- `src/persistence/rows.ts` (new row types via Drizzle inference)
- `src/persistence/repositories/program.repo.ts` (new)
- `src/persistence/repositories/__tests__/program.repo.test.ts` (new)
- `src/persistence/migrations/000X_progression_rest.sql` (NEW migration adding `rest_between_sets` to volume_set jsonb is unneeded — field is inside jsonb. Just re-validate.)

**Schema**

```sql
CREATE TABLE program_def (
  id            UUID PRIMARY KEY,
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE program_day (
  id            UUID PRIMARY KEY,
  program_id    UUID NOT NULL REFERENCES program_def(id) ON DELETE CASCADE,
  day_index     INTEGER NOT NULL,
  label         TEXT,
  UNIQUE (program_id, day_index)
);

CREATE TABLE program_activity (
  id            UUID PRIMARY KEY,
  day_id        UUID NOT NULL REFERENCES program_day(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL,           -- 0-based order within day
  kind          TEXT NOT NULL CHECK (kind IN ('rest','exercise')),
  body          JSONB NOT NULL,             -- shape depends on kind; re-parsed on read
  UNIQUE (day_id, position)
);
```

`body` shape (jsonb):

- kind=`rest`: `{ durationSeconds, label? }`
- kind=`exercise`: `{ exerciseId, progressionId? | fallback?, hlPick? }`

`exerciseId` and `progressionId` reference catalog rows; **no FK constraint**
on jsonb keys, but the repo joins/loads them on read and the smart
constructor enforces the scope rule (matches existing project pattern of
historical snapshots for `VolumeSet`).

**Repo API**

```ts
listProgramDefs(): Promise<ProgramDef[]>
getProgramDef(id: Uuid): Promise<ProgramDef | null>
saveProgramDef(p: ProgramDef): Promise<void>     // upsert + replace children in one tx
deleteProgramDef(id: Uuid): Promise<void>
```

**Read path**

1. Load rows.
2. Resolve referenced `ExerciseDef` and `ProgressionDef` via existing repos.
3. Zod-validate jsonb shape per activity row.
4. Map → `ProgramDefInput` → `makeProgramDef` (re-runs invariants).

**Tests** (integration, real PGLite via `makeTestDb`)

- Round-trip: save → load → deep-equal original (after smart-constructor canonicalization).
- Re-validation on read: corrupt a `body` jsonb manually, expect `getProgramDef` to throw `InvariantViolationError`.
- Cascade delete: delete a program → days + activities gone.
- Reordering: saving with new `position`/`day_index` reflected on next read.
- Referencing a deleted `ExerciseDef` or `ProgressionDef`: read fails (resolve step returns null). Decide policy: throw `EntityNotFoundError`. Author cannot save a program with missing refs in the first place because slot construction requires the live objects.

---

### Increment 3 — App service

**Files**

- `src/app/program-authoring.service.ts` (new)
- `src/app/__tests__/program-authoring.service.test.ts` (new)
- `src/app/index.ts` (export)

**Service**

```ts
class ProgramAuthoringService {
  createProgram(input: ProgramDefInput): Promise<ProgramDef>
  updateProgram(id: Uuid, input: ProgramDefInput): Promise<ProgramDef>
  deleteProgram(id: Uuid): Promise<void>
  listPrograms(): Promise<ProgramDef[]>
  getProgram(id: Uuid): Promise<ProgramDef>
}
```

**Responsibilities**

- Resolve catalog refs (look up `ExerciseDef` / `ProgressionDef` by id from caller-supplied input).
- Run `makeProgramDef` (raises typed errors on invariant violations).
- Wrap save in one transaction (replaces days/activities).
- No rotation logic — that's `WorkoutService` (Goal 3).

**Tests**

- End-to-end against real DB: create → list → get → update → delete.
- Surface typed errors: passing an HL-progression slot without `hlPick` raises `InvariantViolationError` with the expected path.
- Referencing an unknown exercise/progression id raises `EntityNotFoundError`.
- Update of a program: old days/activities are replaced atomically.

---

### Increment 4 — UI

**Files**

- `src/ui/features/program/ProgramListPage.tsx`
- `src/ui/features/program/ProgramEditPage.tsx`
- `src/ui/features/program/components/DayEditor.tsx`
- `src/ui/features/program/components/ActivityEditor.tsx` (renders rest vs exercise slot variants)
- `src/ui/features/program/hooks/usePrograms.ts` (TanStack Query)
- nav entry + route

**Behavior**

- List page: name + day count + `hasHeavyLight` badge + edit/delete.
- Edit page (mobile-first, Mantine):
  - Program name field.
  - Day list with add/remove/reorder; each day shows auto `Day N` + optional label input.
  - Inside a day: activity list, add rest/add exercise buttons, drag or up/down to reorder.
  - Rest activity row: duration input + optional label.
  - Exercise slot row:
    - Picks `ExerciseDef` (combobox over catalog).
    - Picks `ProgressionDef` constrained to that exercise; "None (freestyle)" allowed.
    - If progression is HL: heavy/light radio.
    - If no progression: sets + quantifierValue + optional restBetweenSets fields.
- Save calls service; query keys invalidated on success; typed errors surfaced inline (HL pick missing → field-level error).
- Empty-day banner if day has zero exercise slots.
- HL preview: when `hasHeavyLight` becomes true, a small note appears: "Rolling rotation will replay days with heavy/light flipped."

**Tests**

- Component smoke tests for HL pick required state.
- Manual run via `/run` skill — golden path: create program with mixed activities + HL exercise, save, reopen, fields match.

---

## Cross-cutting

- **Naming.** New aggregate is `ProgramDef` to mirror `ExerciseDef` / `EquipmentDef` / `ProgressionDef`.
- **README update.** After inc 4, add a "Program authoring" section under the architecture overview noting the auto-derived HL second pass.
- **Migration ordering.** New migration uses the next available numeric prefix; `schema_version` runner is already idempotent.
- **Skips noted.** Edit-after-workouts-exist semantics deferred to Goal 3. TODO comment in `program-authoring.service.ts` records the debt.
