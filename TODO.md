# TODO


## Goal 1: Strength Training Progression Definition
- [x] Goal
  - [x] Users define equipments and exercises. Then we present UI that helps them define their progression.
- [x] Prerequisite models
  - [x] Exercise
  - [x] Equipment
  - [x] Progression
- [x] Progression Types
  - [x] Linear
  - [x] Heavy/Low

## Goal 2: Program Definition
- [x] Spec: [specs/program-definition.md](specs/program-definition.md) — 4 increments (domain → persistence → service → UI)
- [x] Model: **materialized** Program → Microcycle[] → Day[] → Activity[] (nested, no `swap` derivation).
  Light counterpart authored concretely via invertDay/invertMicrocycle helpers.
- [ ] timers:
  - [ ] warmup/cooldown/main timer group
  - [ ] exercises might want to be tracked individually, but warmup/cooldown might not be
- [ ] TEST/REFINE

## Goal 3: Exercise Flow

## Others
- tags
- import/export

## Service naming plan (tentative)

Five app-layer services mapped to user jobs (not one-per-aggregate):

- `DefinitionsService` — catalog CRUD: equipment, exercise, progression defs. Library of reusable building blocks.
- `ProgramAuthoringService` — program defs: days, activities (rest periods + exercise slots with sets/heavy-light pick). Composes catalog refs. Authoring only — no runtime state.
- `WorkoutService` — runtime: "start next workout," advance rotation pointer, log sets via `VolumeSet`, finish session. Owns rolling rotation. Recovery from interruption.
- `WorkoutLogService` — read-side: query past sessions, per-exercise history, volume queries. Feeds future charts.
- `DataPortService` — json import/export (later, earn rent first).

NOT services (pure domain fns instead):
- Equipment load resolution (discrete piece selection given target resistance + `shouldCombineResistance`) — called inside `WorkoutService`.
- Rotation cursor (`RotationPosition` = ID-based `{microcycleId, dayId}`, separate runtime aggregate, re-validated on read) — advance is a pure fn consumed by `WorkoutService`. NOT on `ProgramDef`.
- Chart aggregation — derive in UI from `WorkoutLogService` reads.
