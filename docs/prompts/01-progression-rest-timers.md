# Brainstorming Prompt: Progression Rest Timers

## Context

This repository is a personal strength-training app focused on structured
progressive overload. Reusable `ProgressionDef` objects describe linear or
heavy/light progression steps as `VolumeSet` values. A `VolumeSet` may include
an optional rest-between-sets duration. Heavy/light progression pairs require
timer presence to be symmetric: both sides define a timer or neither does.

The app uses a layered architecture:

```text
ui -> app -> domain <- persistence
```

The UI is React + Mantine, persistence is PGLite + Drizzle, and domain
invariants belong in pure TypeScript smart constructors. UI integration tests
use real services and an in-memory PGLite database.

## Goal

Brainstorm the complete user experience and project changes needed to make
progression rest-between-sets timers a usable, persisted authoring feature.

