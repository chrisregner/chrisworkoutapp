# Brainstorming Prompt: Program Authoring Refinement

## Context

This repository is a personal strength-training app with reusable rolling
rotation programs. A `ProgramDef` contains ordered microcycles, each microcycle
contains ordered days, and each day contains ordered exercise slots and rest
periods. Program authoring is available through a mobile-first React + Mantine
editor.

The app uses a layered architecture:

```text
ui -> app -> domain <- persistence
```

Domain smart constructors enforce valid program definitions. The UI should
make authoring frictionless while surfacing useful feedback before save.
UI integration tests use real services and an in-memory PGLite database.

## Goal

Brainstorm the refinement work needed for the program authoring editor to be
reliable, ergonomic, and well verified across its supported authoring flows.

