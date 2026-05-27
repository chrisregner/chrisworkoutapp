# TODO


## Goal 1: Strength Training Progression Definition
- Goal
  - Users define equipments and exercises. Then we present UI that helps them define their progression.
- Prerequisite models
  - Exercise
  - Equipment
  - Progression
- Progression Types
  - Linear
  - Heavy/Low

## Goal 2: Program Definition
- Spec: [specs/program-definition.md](specs/program-definition.md) — 4 increments (domain → persistence → service → UI)

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
- Rotation pointer advance — method on `Program` aggregate or pure fn.
- Chart aggregation — derive in UI from `WorkoutLogService` reads.
