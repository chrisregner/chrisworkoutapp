---
name: chrisworkoutapp-architecture
description: Layered architecture rules for the chrisworkoutapp repo (domain / persistence / app / ui / shared). Use whenever adding a feature, deciding where new code lives, scaffolding a new file under src/, creating repositories or services, wiring React components to data, writing migrations or Drizzle schema, or composing the README architecture section. Also use when the user asks "where should this go", "which layer", "should I add an interface here", or about Clean Architecture choices in this project. Pushy default — if you're touching src/ in this repo, consult this skill before placing code.
metadata:
  type: project-architecture
---

# chrisworkoutapp architecture

This repo follows a pragmatic four-layer architecture. The point isn't "Clean Architecture™" — the point is that each layer earns its existence by doing something the layers around it can't. If a layer would just forward calls, it doesn't belong.

## Folder shape

```
src/
├── domain/         pure TS — no React, no Drizzle, no PGLite, no IO
│   ├── primitives/ branded types (PositiveInt, PositiveNumber), smart constructors
│   ├── equipment/  EquipmentDef, EquipmentPiece
│   ├── exercise/   ExerciseDef
│   ├── progression/ ProgressionDef, schemes, volume calc
│   ├── session/    Session, LoggedSet, Deviation
│   ├── rotation/   rolling rotation state machine
│   └── errors.ts   typed domain errors (InvariantViolation, ConstraintViolation)
│
├── persistence/    Drizzle + PGLite — knows DB, doesn't know UI
│   ├── schema.ts   pgTable defs
│   ├── client.ts   PGLite + migration runner
│   ├── migrations/ SQL files
│   ├── rows.ts     *Row types inferred from schema
│   └── repositories/ one file per aggregate (equipment.repo.ts, etc.)
│
├── app/            application services — orchestrate domain + repos
│   ├── workout-session.service.ts
│   ├── progression.service.ts
│   └── program-authoring.service.ts
│
├── ui/             React + Mantine — knows app services, not DB
│   ├── components/ reusable presentational
│   ├── features/   one folder per feature (workout/, equipment/, programs/)
│   │   └── <feature>/ Page + child components + use<Feature>.ts hook
│   ├── hooks/      cross-cutting
│   ├── providers/  Context providers (DB client, AppServices)
│   └── App.tsx
│
└── shared/         truly cross-cutting only — Result<T,E>, id gen. Not a utils dump.
```

## Layer rules — what goes where, and what doesn't

### domain/
**In:** branded types, rich domain types w/ invariants, smart constructors, pure functions over domain types (`volumeOf`, `totalResistance`), progression engine (`ProgressionScheme` iface + `linearScheme`, `heavyLightScheme` impls), rotation state machine, typed errors.

**Out:** Drizzle imports, React imports, IO (`fetch`, DB, `Date.now()` without injection), ID generation (domain receives IDs, persistence assigns them).

**Test:** vitest unit + fast-check property tests. No DB, no React, no mocks. Must run in ms.

**Rule:** domain depends on nothing. Everything else depends on domain.

### persistence/
**In:** Drizzle `pgTable` defs, PGLite client, migrations, repo classes per aggregate, `*Row` types, mapping fns (`equipmentRowToDomain`, `equipmentDomainToRows`), Zod re-validation on read.

**Out:** business logic, domain invariant *definitions* (re-parse to confirm — don't redefine), React.

Repo shape:
```typescript
export class EquipmentRepository {
  constructor(private db: PgliteDatabase) {}

  async findById(id: EquipmentDefId): Promise<EquipmentDef | null> {
    const defRow = await this.db.select().from(equipmentDefs).where(eq(equipmentDefs.id, id))
    if (!defRow[0]) return null
    const pieceRows = await this.db.select().from(equipmentPieces).where(eq(equipmentPieces.equipmentDefId, id))
    return equipmentRowToDomain(defRow[0], pieceRows)
  }

  async save(equipment: EquipmentDef): Promise<void> {
    const { defRow, pieceRows } = equipmentDomainToRows(equipment)
    await this.db.transaction(async tx => {
      await tx.insert(equipmentDefs).values(defRow).onConflictDoUpdate(/*...*/)
      await tx.delete(equipmentPieces).where(eq(equipmentPieces.equipmentDefId, defRow.id))
      await tx.insert(equipmentPieces).values(pieceRows)
    })
  }
}
```

### app/
**In:** services orchestrating domain + repos, use-case fns (`startWorkoutSession`, `completeSet`, `prescribeNextSession`), transaction boundaries, "what happens when user does X".

**Out:** domain rules (live in domain/), React state (lives in ui/), direct DB queries (go through repos).

Domain fns do the thinking; service wires:
```typescript
async startNext(programId: ProgramId): Promise<Session> {
  const program = await this.progressionRepo.findProgram(programId)
  const history = await this.sessionRepo.findRecentForProgram(programId, 10)
  const plan = nextSession(program, history)    // pure domain fn
  const session = Session.start(plan)            // domain smart ctor
  await this.sessionRepo.save(session)
  return session
}
```

**Concession:** a CRUD with no orchestration doesn't need a service. A hook can call the repo directly. Services exist to orchestrate — multiple repos, transactions, domain calls. If a service would forward one call, delete it.

### ui/
**In:** React + Mantine components, TanStack Query if used, hooks wrapping services, routing, mobile-first responsive styles.

**Out:** direct DB access (go through service or repo via hook), domain logic reimplementation (call domain fns), business-rule validation (use domain validators; UI does only field-level "is this a number").

Hook shape:
```typescript
export function useStartNextWorkout(programId: ProgramId) {
  const service = useWorkoutSessionService()
  return useMutation({ mutationFn: () => service.startNext(programId) })
}
```

### shared/
Only genuinely cross-cutting things. `Result<T,E>`, ID gen. Don't dump utils here because two layers happen to use them.

## Wiring

Use **React Context**. Provider at `ui/providers/AppServicesProvider.tsx` constructs repos + services once, exposes via hooks (`useWorkoutSessionService`, `useEquipmentRepository`). No DI container, no module singletons.

## Patterns deliberately skipped (and why)

Mention these in the README — saying *why* you skipped them is senior signal.

- **Repository interfaces** (`IEquipmentRepository`) — one impl, abstraction adds ceremony, not value. Add when polymorphism is real.
- **CQRS** — overkill for single-user app.
- **Event sourcing** — same.
- **MediatR-style command/query buses** — ceremony in TS.
- **Hexagonal / Ports & Adapters vocabulary** — same idea you're already doing; the vocabulary screams blog-post-LARPing.
- **DTOs as a third representation** — `*Row` and domain types are already two. Pass domain objects to React.

## Rule of thumb when placing code

Ask: **what does this layer do that the layers around it can't?** If "nothing", it doesn't belong as its own layer. Forwarding-only services and pass-through interfaces are debt, not architecture.

Concretely, before adding a file:
1. Does it import React or Mantine? → `ui/`
2. Does it import Drizzle or PGLite? → `persistence/`
3. Does it orchestrate multiple repos / open a transaction / express a use case? → `app/`
4. Is it pure logic over domain types? → `domain/`
5. Cross-cutting primitive used by 2+ layers? → `shared/` (be skeptical)

## Vertical slices, not horizontal layers

Build one feature end-to-end across all four layers before fanning out. Don't build all of `domain/`, then all of `persistence/`, then all of `ui/` — you only find wiring problems at the joins, and finding them on a small surface is cheaper.

Default first slice: equipment listing.
1. Folder skeleton (empty files OK)
2. Drizzle schema → `persistence/schema.ts`; inferred types → `*Row` in `rows.ts`
3. `domain/primitives/` (`PositiveInt`, `PositiveNumber`)
4. `domain/equipment/` (domain types + smart ctors)
5. `persistence/repositories/equipment.repo.ts` + mapping fns
6. `AppServicesProvider` exposing the repo
7. One UI page consuming the hook
8. Then expand

## README architecture section — required structure

When writing/updating README architecture:

1. **The shape** — folder diagram + one paragraph per layer.
2. **The decisions** — what you separated and why; what you didn't and why.
3. **The pragmatic concessions** — where you didn't follow "clean architecture" strictly and why.

Section 3 is the most important. It demonstrates patterns-as-tools, not patterns-as-commandments.

## When in doubt

Prefer concrete over abstract. Prefer fewer layers over more. Domain stays pure. Persistence stays dumb. UI stays presentational. App glues. Shared stays tiny.
