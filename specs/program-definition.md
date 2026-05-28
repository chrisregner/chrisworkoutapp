# Spec: Program Definition (Goal 2)

Authoring-only feature. A `Program` is a reusable, rolling-rotation sequence of
**microcycles**, each a sequence of **days**, each a sequence of **activities**.
Workout execution / logging / rotation cursor state lives elsewhere (Goal 3).
This spec covers domain → persistence → service → UI.

## The pivot (why this differs from the first draft)

The original design **derived** the heavy/light second pass: store days once, set
a `swap` flag at rotation time, flip every HL slot's `hlPick` on the second pass.
We dropped that. Two reasons surfaced in design discussion:

1. **Rest is relational, per heavy/light.** Rest between exercises depends on what
   came before AND after — it belongs to a *position in a concrete day*, not to a
   slot, and not to a day-global "pass." And a "pass" isn't uniformly heavy/light
   anyway: `hlPick` is per-slot, so one day can mix a heavy slot and a light slot.
   There is no day-global heavy/light state to key rest off of.
2. **Materialize, don't derive.** Make every day a concrete authored template.
   The light counterpart is a *real* day, seeded by an invert helper, then freely
   editable (rest included). The whole rest-variance problem **dissolves** — you
   just author a different number in the concrete day. No `HLValue` union, no
   tuple, no resolver, no `swap`.

What we give up: the mechanical guarantee that every heavy day has a structurally
identical light twin. For a single-user tool where per-side customization is the
*point*, that guarantee was a constraint, not a feature. The **HL correctness
invariant** (heavy resistance > light, light volume > heavy) is unaffected — it
lives in `makeProgressionDef`, across the `{heavy, light}` pair, untouched.

## Structure (G3 — nested, not flat)

```
ProgramDef
  └─ Microcycle[]        (≥1; a linear program is ONE unlabeled microcycle)
       └─ ProgramDay[]   (≥1)
            └─ Activity[] (≥1 ExerciseSlot)
```

Why nested and not a flat `days[]` + a `microcycleIndex` tag: blocks/microcycles
**do not interleave in reality**. Encoding them as a flat list whose ordering
carries meaning would require a runtime "contiguity" invariant to forbid
interleaving — a validate-later smell. Nesting makes interleaving
*unrepresentable*. The hierarchy is real in the domain, so it is real in the type.
Bonus: rotation position becomes intrinsically `(microcycleIndex, dayIndex)` —
the "Microcycle 2 · Day 3" navigation falls out of the structure for free (Goal 3
consumes it).

## Naming (periodization nomenclature — selective)

Ubiquitous language = the author's words + terms that earn their place by killing a
real ambiguity. Periodization vocabulary applies to the **time/structure axis
only** (program → microcycle → day); the **load/movement axis** (exercise, set,
rep, resistance, progression, equipment) keeps its own correct vocabulary.

| Concept | Name | Rationale |
| --- | --- | --- |
| Day grouping | **`Microcycle`** | Adopted. Killed the banned "week" — the sports-science term for "smallest repeating training unit, *not* calendar-bound." |
| Top container | **`Program` / `ProgramDef`** | Kept. Lifters say "what program are you running?" — stronger ubiquitous language than "mesocycle". |
| Rotation unit | **`ProgramDay` / `Day`** | Kept. Matches home screen ("Next workout: Day 4"). Means rotation slot, not a date. |
| Sub-session | `Activity` / `ExerciseSlot` / `RestPeriod` | Kept. No periodization term exists below "session". |
| Load axis | `ProgressionDef`, `VolumeSet`, `ExerciseDef`, `EquipmentDef` | Kept. Wrong axis for periodization terms. |

## Decisions captured

| Topic | Decision |
| --- | --- |
| HL second pass | **Materialized, not derived.** No `swap`. The light counterpart is a concrete authored day/microcycle, seeded by an invert helper, freely editable. |
| Microcycle | `{ id, label?, days }`. Mandatory `≥1`. Linear program = one unlabeled microcycle. `label` user-facing ("Heavy"/"Light"/"Deload"); absent → UI shows "Microcycle N". |
| Rest between exercises | Plain positional `RestPeriod` activity. HL variance achieved by authoring concrete days — no union/tuple. |
| Rest between sets | On `ProgressionDef` per `VolumeSet` (already exists). HL variants: **symmetric-or-neither** — `restBetweenSets` set on both `heavy` and `light` or neither (enforced in `makeProgressionDef`). Slot fallback may carry its own. |
| Sets count | Owned by `ProgressionDef` (on `VolumeSet`). Slot fallback when no progression. |
| HL pick on slot | Required when slot's progression is HL. Smart constructor rejects missing. Per-slot — **mixed-side days allowed** (slot 1 heavy + slot 2 light in one day is the point). |
| Day shape | Ordered mixed activity list: each is an `ExerciseSlot` or a `RestPeriod`. |
| Day naming | Auto index (1-based within its microcycle) + optional label. |
| Exercise reuse | Same `ExerciseDef` may appear N times in a day. |
| Progression scope | `ProgressionDef` on a slot must belong to that slot's `ExerciseDef` (smart constructor). |
| No-progression slot | Allowed. Declares `sets` + `quantifierValue` + optional `restBetweenSets`. Resistance freestyle at workout time. |
| Rest period | `durationSeconds` + optional `label`. |
| Invert helpers | `invertDay` (pure primitive — flips each HL slot's `hlPick`, copies rest for editing) and `invertMicrocycle` (composes `invertDay` over a microcycle's days). Pure domain functions; UI buttons wire them, result flows through `makeProgramDef`. |
| Min sizes | `≥1` microcycle, `≥1` day per microcycle, `≥1` exercise slot per day. No upper bound. |
| Slot role | `slot.role: 'warmup' \| 'main' \| 'cooldown'`, optional, default `'main'`. Per-use, not on `ExerciseDef`. Goal 3 groups by role for timer-group mode. |
| Out of scope | **Rotation cursor** (`RotationPosition` — ID-based `{ microcycleId, dayId }`, re-validated on read, typed dangle error; separate aggregate + `WorkoutService`), starting/ending sessions, logging, progression increment/decrement, **progression cursor** (current step within `ProgressionDef.body.volumeSets[]`). The execution domain *consumes* a `Program` and owns these — Goal 3. |

## Open follow-ups (NOT this increment)

- Editing a `Program` after workouts exist: in-place vs snapshot-at-start. Goal 3.
  For now edits are in-place; no historical workouts to break.
- Reordering UX (drag vs up/down) — designer choice during inc 4.
- **RotationPosition / cursor** — `{ microcycleId, dayId }`, ID-based (survives
  edits; index-based would silently point at the wrong workout after an edit).
  Stored as its own runtime aggregate, advanced by `WorkoutService`, re-validated
  on read (`EntityNotFoundError` on dangle). Goal 3.
- **ProgressionCursor** — current step index per `ProgressionDef`. Goal 3. One
  cursor per `ProgressionDef` (lifter's state with the movement is global, not
  program-bound). HL steps use a single int (step = heavy+light pair).
- **Timer-group mode** (warmup/cooldown grouped vs per-exercise timer) — Goal 3.
  Consumes `slot.role`.

---

## Domain shape (target)

```ts
type RestPeriod = {
  readonly kind: 'rest'
  readonly durationSeconds: PositiveInt
  readonly label?: string
}

type ExerciseSlot = {
  readonly kind: 'exercise'
  readonly exercise: ExerciseDef
  readonly role: 'warmup' | 'main' | 'cooldown'   // defaults to 'main' if input omits it
  readonly progression?: ProgressionDef            // optional
  readonly hlPick?: 'heavy' | 'light'              // required iff progression.body.kind === 'heavyLight'
  readonly fallback?: {                            // present iff progression is absent
    readonly sets: PositiveInt
    readonly quantifierValue: PositiveInt
    readonly restBetweenSets?: PositiveInt
  }
}

type Activity = RestPeriod | ExerciseSlot

type ProgramDay = {
  readonly id: Uuid
  readonly index: PositiveInt                  // 1-based, contiguous & unique WITHIN its microcycle
  readonly label?: string
  readonly activities: readonly Activity[]     // ≥1 ExerciseSlot required
}

type Microcycle = {
  readonly id: Uuid
  readonly index: PositiveInt                  // 1-based, contiguous & unique within Program
  readonly label?: string                      // optional ("Heavy" / "Light" / "Deload")
  readonly days: readonly ProgramDay[]         // ≥1
}

type ProgramDef = {
  readonly id: Uuid
  readonly name: string
  readonly microcycles: readonly Microcycle[]  // ≥1
}
```

Derived (NOT stored):

```ts
function hasHeavyLight(p: ProgramDef): boolean   // any slot.progression?.body.kind === 'heavyLight' — UI badge only
```

> `rotationLength` / `dayAtRotationIndex` / `swap` are **gone**. Rotation walking
> and the `(microcycle, day)` cursor belong to Goal 3 (`WorkoutService` +
> `RotationPosition`). The definition aggregate does not know about position.

Invert helpers (pure domain):

```ts
function invertDay(day: ProgramDayInput): ProgramDayInput          // flip each HL slot's hlPick; copy rest
function invertMicrocycle(mc: MicrocycleInput): MicrocycleInput    // { ...mc, days: mc.days.map(invertDay) }
```

### Invariants enforced by `makeProgramDef`

1. `name` non-empty.
2. `microcycles.length ≥ 1`.
3. Microcycle indices: 1-based, contiguous, unique within the program.
4. Each microcycle: `days.length ≥ 1`; day indices 1-based, contiguous, unique within that microcycle.
5. Each day: at least one `Activity.kind === 'exercise'`.
6. Each `ExerciseSlot`:
   a. Exactly one of `progression` or `fallback` is set.
   b. If `progression` set:
      - `progression.exercise.id === slot.exercise.id` (scope rule).
      - If `progression.body.kind === 'heavyLight'`, `hlPick` is required; otherwise absent.
   c. If `fallback` set: `hlPick` must be absent.
7. `RestPeriod.durationSeconds > 0`.
8. `ExerciseSlot.role` defaults to `'main'` when omitted; otherwise one of `'warmup' | 'main' | 'cooldown'`.

> Interleaving of microcycles is **unrepresentable** by construction (nesting), so
> no contiguity invariant is needed for it.

### Adjustment to `progression.ts`

`VolumeSet.restBetweenSets?: PositiveInt` already exists. Add one invariant in the
HL pair loop of `makeProgressionDef`:

- **HL rest symmetry:** `heavy.restBetweenSets` and `light.restBetweenSets` are
  both present or both absent. Reject the asymmetric case (prevents "heavy has a
  timer, light silently doesn't").

No other invariant change.

---

## Increment plan

Four PRs, each independently mergeable and tested.

### Increment 1 — Domain

**Files**

- `src/domain/program/program.ts`
- `src/domain/program/index.ts`
- `src/domain/program/__tests__/program.test.ts`
- `src/domain/progression/progression.ts` (add HL rest-symmetry invariant)
- `src/domain/progression/__tests__/progression.test.ts` (cover symmetry)
- `src/domain/index.ts` (re-export program)

**Build**

1. Types per "Domain shape". Branded primitives reused (`PositiveInt`, `Uuid`).
2. `makeRestPeriod`, `makeExerciseSlot`, `makeProgramDay`, `makeMicrocycle`, `makeProgramDef`.
3. Typed errors via `InvariantViolationError`.
4. `invertDay`, `invertMicrocycle` pure helpers.
5. `hasHeavyLight` derived helper (UI badge).
6. HL rest-symmetry invariant added to `makeProgressionDef`.

**Tests**

- Example tests for each invariant (1–8) — assert each rejects with the expected error path.
- HL rest symmetry: asymmetric `restBetweenSets` rejected; both-set and both-absent accepted.
- `invertDay` flips `hlPick` on HL slots, leaves non-HL slots and rest untouched, is involutive (`invertDay(invertDay(d))` deep-equals `d`).
- fast-check: for any valid `ProgramDef`, microcycle indices form `1..M` exactly once; within each, day indices form `1..N` exactly once.
- Round-trip: `makeProgramDef(programDefToInput(p))` deep-equals `p`.
- `hasHeavyLight` true iff at least one slot's progression is HL.

**Acceptance**

- `pnpm test src/domain/program` green.
- No imports from `persistence/`, `app/`, `ui/`, React, Drizzle.

---

### Increment 2 — Persistence

**Files**

- `src/persistence/schema.ts`
- `src/persistence/migrations/000X_program.sql` (version-gated)
- `src/persistence/rows.ts`
- `src/persistence/repositories/program.repo.ts`
- `src/persistence/repositories/__tests__/program.repo.test.ts`

**Schema**

```sql
CREATE TABLE program_def (
  id            UUID PRIMARY KEY,
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE program_microcycle (
  id              UUID PRIMARY KEY,
  program_id      UUID NOT NULL REFERENCES program_def(id) ON DELETE CASCADE,
  cycle_index     INTEGER NOT NULL,
  label           TEXT,
  UNIQUE (program_id, cycle_index)
);

CREATE TABLE program_day (
  id              UUID PRIMARY KEY,
  microcycle_id   UUID NOT NULL REFERENCES program_microcycle(id) ON DELETE CASCADE,
  day_index       INTEGER NOT NULL,
  label           TEXT,
  UNIQUE (microcycle_id, day_index)
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
- kind=`exercise`: `{ exerciseId, role?, progressionId? | fallback?, hlPick? }`

`exerciseId` / `progressionId` reference catalog rows; **no FK on jsonb keys** —
the repo loads them on read and the smart constructor enforces scope (matches the
`VolumeSet` historical-snapshot pattern).

**Repo API**

```ts
listProgramDefs(): Promise<ProgramDef[]>
getProgramDef(id: Uuid): Promise<ProgramDef | null>
saveProgramDef(p: ProgramDef): Promise<void>     // upsert + replace children in one tx
deleteProgramDef(id: Uuid): Promise<void>
```

**Read path**

1. Load rows (program → microcycles → days → activities).
2. Resolve referenced `ExerciseDef` / `ProgressionDef` via existing repos.
3. Zod-validate jsonb shape per activity row.
4. Map → `ProgramDefInput` → `makeProgramDef` (re-runs invariants).

**Tests** (real PGLite via `makeTestDb`)

- Round-trip save → load → deep-equal.
- Re-validation: corrupt a `body` jsonb manually → `getProgramDef` throws `InvariantViolationError`.
- Cascade delete: delete program → microcycles + days + activities gone.
- Reordering: new `cycle_index` / `day_index` / `position` reflected on next read.
- Missing ref (deleted `ExerciseDef`/`ProgressionDef`): read throws `EntityNotFoundError`.

---

### Increment 3 — App service

**Files**

- `src/app/program-authoring.service.ts`
- `src/app/__tests__/program-authoring.service.test.ts`
- `src/app/index.ts`

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

- Resolve catalog refs by id from caller input.
- Run `makeProgramDef` (typed errors on violation).
- One transaction per save (replace microcycles/days/activities atomically).
- **No rotation logic** — that's `WorkoutService` (Goal 3).

**Tests**

- End-to-end against real DB: create → list → get → update → delete.
- HL slot without `hlPick` → `InvariantViolationError` (expected path).
- Unknown exercise/progression id → `EntityNotFoundError`.
- Update replaces children atomically.

---

### Increment 4 — UI

**Files**

- `src/ui/features/program/ProgramListPage.tsx`
- `src/ui/features/program/ProgramEditPage.tsx`
- `src/ui/features/program/components/MicrocycleEditor.tsx`
- `src/ui/features/program/components/DayEditor.tsx`
- `src/ui/features/program/components/ActivityEditor.tsx`
- `src/ui/features/program/hooks/usePrograms.ts` (TanStack Query)
- nav entry + route

**Behavior**

- List page: name + microcycle/day counts + `hasHeavyLight` badge + edit/delete.
- Edit page (mobile-first, Mantine):
  - Program name field.
  - Microcycle list: add/remove/reorder; each shows auto `Microcycle N` + optional label.
    - **"Invert microcycle"** button → appends `invertMicrocycle` of the selected one (then freely editable).
  - Day list within a microcycle: add/remove/reorder; auto `Day N` + optional label.
    - **"Invert day"** button → seeds a day from `invertDay` of a chosen source day.
  - Inside a day: activity list, add rest/add exercise, drag or up/down to reorder.
  - Rest row: duration + optional label.
  - Exercise slot row: pick `ExerciseDef`; pick `ProgressionDef` constrained to it ("None (freestyle)" allowed); if HL → heavy/light radio; if no progression → sets + quantifierValue + optional restBetweenSets; role select (default main).
- Save calls service; query keys invalidated; typed errors surfaced inline (HL pick missing → field error).
- Empty-day banner if a day has zero exercise slots.

**Tests**

- Component tests: HL-pick-required state; invert-day/invert-microcycle seed produces flipped picks.
- Manual run via `/run` — golden path: build program with two microcycles (one inverted), HL exercise, save, reopen, fields match.

---

## Cross-cutting

- **Naming.** See "Naming" table. New aggregate `ProgramDef`; new level `Microcycle`.
- **README update.** After inc 4, add a "Program authoring" section noting the
  materialized (not derived) microcycle model and the invert helpers.
- **Migration ordering.** Next available numeric prefix; `schema_version` runner is idempotent.
- **Skips noted.** Edit-after-workouts-exist semantics deferred to Goal 3 — TODO
  comment in `program-authoring.service.ts`.
