---
name: react-component-extractor
description: >
  Proactively extract React sub-components into separate files to enforce Single
  Responsibility Principle (SRP). Trigger whenever: (1) a React component file
  exceeds ~150 lines and contains multiple distinct sub-components defined in
  the same file, (2) any sub-component has its own useState/useEffect hooks,
  (3) a sub-component has its own type definitions or helper functions,
  (4) the file has comment-divider sections (e.g. ─── Sub-component: foo ───),
  or (5) the user says "extract", "SRP", "single responsibility", "too big", or
  "split this file". Also trigger PROACTIVELY when touching any file under
  src/ui/ that contains multiple sub-components — don't wait to be asked.
  A large file is ONLY acceptable if the entire file is doing one conceptually
  simple thing. "Everything is about the modal" is not sufficient justification.
---

## Goal

One file = one responsibility. Extract self-contained sub-components into sibling
files. The parent file should be left doing exactly one thing: composing the
extracted pieces.

## Extraction Criteria

Extract a sub-component if it satisfies **any** of:

- Has its own `useState` or `useEffect` — it manages its own state lifecycle
- Has its own type definitions used only by itself (`type Foo`, `interface Bar`)
- Has its own helper functions that operate on its local data
- Has more than ~30 lines of JSX
- Could be understood, tested, or reused without reading the parent

**Keep in the parent file** only if:
- Pure layout glue with no state and under ~10 lines
- Types are also used by the parent and would be orphaned without it

## What Travels with the Extracted Component

When you extract `FooBar`, also move:
- Types/interfaces **only** used by `FooBar`
- Helper functions **only** called by `FooBar`
- Constants **only** used by `FooBar`

Shared types/helpers stay in the parent. If shared by 3+ components, consider
a dedicated `types.ts` alongside them.

## File Placement

Extracted files are **siblings** of the parent, not subdirectories:

```
src/ui/features/progression/
├── SaveProgressionModal.tsx      ← parent (now lean)
├── ChipList.tsx                  ← extracted
├── SortPriorityControl.tsx       ← extracted
├── ResistanceSection.tsx         ← extracted (groups related variants)
└── ProgressionGrid.tsx           ← extracted
```

Name the file after the component it exports. If grouping closely related
variants (e.g. three resistance sub-variants that share a type), use one file.

## Process

### 1. Scan

Read the file. List every sub-component with:
- Line range
- Whether it has own state, own types, own helpers
- One-line description of its responsibility

### 2. Propose

Group extractable components logically. State which will be extracted and which
stay. Brief reason for each decision. Present to user if time permits; otherwise
proceed when the instruction is unambiguous.

### 3. Extract

For each extraction:
1. Create new sibling file
2. Move component + its types + its helpers
3. Add necessary imports in the new file
4. Export the component (named export)
5. Update the parent: replace inline definition with import

### 4. Verify

- Parent file has no dead imports
- Parent file has no orphaned types
- TypeScript compiles (run `tsc --noEmit` or equivalent)
- All moved helpers/types are imported where needed

## Grouping Heuristic

Related sibling components that share a type or helper should travel together
into one file rather than three. Use judgment: if extracting them separately
would force awkward cross-file imports between siblings, group them.

Example: `NoEquipmentResistance`, `NonCombinableResistance`, and
`CombinableResistance` all work with `ResistanceConfig` type and share a
`sourceKey`/`resistanceTotal` helper → group into `ResistanceSection.tsx`.

## What "Done" Looks Like

- Parent file reads as a composition of named imports
- Each extracted file has one clear responsibility named in its filename
- No cross-sibling imports (siblings don't import each other)
- TypeScript happy, no runtime regressions
