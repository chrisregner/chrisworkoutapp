import { describe, it, expect } from 'vitest'
import { sql } from 'drizzle-orm'
import { makeTestDb } from '../../testing'
import { saveEquipmentDef } from '../equipment.repo'
import { saveExerciseDef } from '../exercise.repo'
import { saveProgressionDef } from '../progression.repo'
import { saveProgramDef, getProgramDef, deleteProgramDef, listProgramDefs } from '../program.repo'
import {
  EntityNotFoundError,
  makeEquipmentDef,
  makeExerciseDef,
  makeProgressionDef,
  makeProgramDef,
  type ExerciseDef,
  type ProgressionDef,
  type ProgramDef,
} from '../../../domain'
import { newId } from '../../../shared'

// Deterministic UUID helper
const u = (n: number) => `00000000-0000-0000-0000-${n.toString().padStart(12, '0')}`

function buildEquipment() {
  return makeEquipmentDef({
    id: newId(),
    name: 'Plates',
    isCombinable: true,
    unit: 'kg',
    pieces: [
      { id: newId(), resistance: 5, quantity: 4, position: 0 },
      { id: newId(), resistance: 10, quantity: 2, position: 1 },
    ],
  })
}

function buildExercise(): ExerciseDef {
  return makeExerciseDef({
    id: newId(),
    name: 'Squat',
    quantifierType: 'reps',
    equipment: null,
  })
}

function buildLinearProgression(exercise: ExerciseDef): ProgressionDef {
  return makeProgressionDef({
    id: newId(),
    name: 'LP',
    exercise,
    body: {
      kind: 'linear',
      volumeSets: [{ sets: 3, quantifierValue: 5, resistanceSource: [] }],
      plannedSets: [3],
      plannedReps: [5],
    },
  })
}

function buildHLProgression(exercise: ExerciseDef): ProgressionDef {
  const eq = buildEquipment()
  const exWithEq = makeExerciseDef({
    id: exercise.id as string,
    name: exercise.name,
    quantifierType: exercise.quantifierType,
    equipment: eq,
    shouldCombineResistance: false,
  })
  const p0 = eq.pieces[0]!
  const p1 = eq.pieces[1]!
  const snap = (p: (typeof eq.pieces)[0]) => ({
    pieceId: p.id as string,
    resistance: p.resistance as number,
    totalQuantity: p.quantity as number,
  })
  return makeProgressionDef({
    id: newId(),
    name: 'HL',
    exercise: exWithEq,
    body: {
      kind: 'heavyLight',
      volumeSets: [
        {
          // heavy: 10kg × 1 set × 5 reps = vol 50; light: 5kg × 3 sets × 5 reps = vol 75 ✓
          heavy: {
            sets: 1,
            quantifierValue: 5,
            resistanceSource: [{ piece: snap(p1), quantityUsed: 1 }],
          },
          light: {
            sets: 3,
            quantifierValue: 5,
            resistanceSource: [{ piece: snap(p0), quantityUsed: 1 }],
          },
        },
      ],
      plannedSets: [1, 3],
      plannedReps: [5],
    },
  })
}

function buildMinimalProgram(exercise: ExerciseDef): ProgramDef {
  return makeProgramDef({
    id: newId(),
    name: 'Test Program',
    microcycles: [
      {
        id: newId(),
        days: [
          {
            id: newId(),
            activities: [
              { kind: 'exercise', exercise, fallback: { sets: 3, quantifierValue: 5 } },
            ],
          },
        ],
      },
    ],
  })
}

async function persistExerciseGraph(db: Awaited<ReturnType<typeof makeTestDb>>) {
  const exercise = buildExercise()
  await saveExerciseDef(db, exercise)
  return exercise
}

describe('program.repo', () => {
  it('round-trips a minimal program (fallback slot)', async () => {
    const db = await makeTestDb()
    const exercise = await persistExerciseGraph(db)
    const program = buildMinimalProgram(exercise)

    await saveProgramDef(db, program)

    const found = await getProgramDef(db, program.id as string)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(program.id)
    expect(found!.name).toBe('Test Program')
    expect(found!.microcycles).toHaveLength(1)
    expect(found!.microcycles[0]!.days).toHaveLength(1)
    expect(found!.microcycles[0]!.days[0]!.activities).toHaveLength(1)
    const act = found!.microcycles[0]!.days[0]!.activities[0]!
    expect(act.kind).toBe('exercise')
    if (act.kind === 'exercise') {
      expect(act.exercise.id).toBe(exercise.id)
      expect(act.fallback).toBeDefined()
      expect(act.fallback!.sets).toBe(3)
    }
  })

  it('round-trips a program with progression slot', async () => {
    const db = await makeTestDb()
    const exercise = await persistExerciseGraph(db)
    const prog = buildLinearProgression(exercise)
    await saveProgressionDef(db, prog)

    const program = makeProgramDef({
      id: newId(),
      name: 'With Progression',
      microcycles: [
        {
          id: newId(),
          days: [
            {
              id: newId(),
              activities: [{ kind: 'exercise', exercise, progression: prog }],
            },
          ],
        },
      ],
    })
    await saveProgramDef(db, program)

    const found = await getProgramDef(db, program.id as string)
    expect(found).not.toBeNull()
    const act = found!.microcycles[0]!.days[0]!.activities[0]!
    expect(act.kind).toBe('exercise')
    if (act.kind === 'exercise') {
      expect(act.progression?.id).toBe(prog.id)
    }
  })

  it('round-trips multi-microcycle program with rest activities and HL slot', async () => {
    const db = await makeTestDb()
    const exercise = await persistExerciseGraph(db)
    const hlProg = buildHLProgression(exercise)
    // HL progression's exercise has equipment — persist the equipment-linked version
    await saveEquipmentDef(db, hlProg.exercise.equipment!)
    await saveExerciseDef(db, hlProg.exercise)
    await saveProgressionDef(db, hlProg)

    const program = makeProgramDef({
      id: newId(),
      name: 'Full Program',
      microcycles: [
        {
          id: newId(),
          label: 'Week A',
          days: [
            {
              id: newId(),
              label: 'Heavy Day',
              activities: [
                { kind: 'rest', durationSeconds: 60, label: 'Warmup rest' },
                {
                  kind: 'exercise',
                  exercise: hlProg.exercise,
                  progression: hlProg,
                  hlPick: 'heavy',
                },
              ],
            },
          ],
        },
        {
          id: newId(),
          label: 'Week B',
          days: [
            {
              id: newId(),
              label: 'Light Day',
              activities: [
                {
                  kind: 'exercise',
                  exercise: hlProg.exercise,
                  progression: hlProg,
                  hlPick: 'light',
                },
              ],
            },
          ],
        },
      ],
    })
    await saveProgramDef(db, program)

    const found = await getProgramDef(db, program.id as string)
    expect(found).not.toBeNull()
    expect(found!.microcycles).toHaveLength(2)
    expect(found!.microcycles[0]!.label).toBe('Week A')
    expect(found!.microcycles[1]!.label).toBe('Week B')

    const heavyDay = found!.microcycles[0]!.days[0]!
    expect(heavyDay.label).toBe('Heavy Day')
    expect(heavyDay.activities).toHaveLength(2)
    expect(heavyDay.activities[0]!.kind).toBe('rest')
    if (heavyDay.activities[0]!.kind === 'rest') {
      expect(heavyDay.activities[0]!.durationSeconds).toBe(60)
      expect(heavyDay.activities[0]!.label).toBe('Warmup rest')
    }
    const heavySlot = heavyDay.activities[1]!
    if (heavySlot.kind === 'exercise') {
      expect(heavySlot.hlPick).toBe('heavy')
      expect(heavySlot.progression?.id).toBe(hlProg.id)
    }

    const lightDay = found!.microcycles[1]!.days[0]!
    const lightSlot = lightDay.activities[0]!
    if (lightSlot.kind === 'exercise') {
      expect(lightSlot.hlPick).toBe('light')
    }
  })

  it('round-trips fallback with restBetweenSets', async () => {
    const db = await makeTestDb()
    const exercise = await persistExerciseGraph(db)
    const program = makeProgramDef({
      id: newId(),
      name: 'Rest Between Sets',
      microcycles: [
        {
          id: newId(),
          days: [
            {
              id: newId(),
              activities: [
                {
                  kind: 'exercise',
                  exercise,
                  fallback: { sets: 4, quantifierValue: 8, restBetweenSets: 90 },
                },
              ],
            },
          ],
        },
      ],
    })
    await saveProgramDef(db, program)

    const found = await getProgramDef(db, program.id as string)
    const act = found!.microcycles[0]!.days[0]!.activities[0]!
    if (act.kind === 'exercise') {
      expect(act.fallback!.restBetweenSets).toBe(90)
    }
  })

  it('cascade delete removes all children', async () => {
    const db = await makeTestDb()
    const exercise = await persistExerciseGraph(db)
    const program = buildMinimalProgram(exercise)
    await saveProgramDef(db, program)

    await deleteProgramDef(db, program.id as string)

    const found = await getProgramDef(db, program.id as string)
    expect(found).toBeNull()

    // Verify child rows are gone via cascade
    const mcRows = await db.execute(
      sql`SELECT COUNT(*) AS count FROM program_microcycle WHERE program_id = ${program.id as string}`,
    )
    expect(Number((mcRows.rows[0] as { count: string }).count)).toBe(0)
  })

  it('listProgramDefs returns all saved programs', async () => {
    const db = await makeTestDb()
    const exercise = await persistExerciseGraph(db)

    const p1 = buildMinimalProgram(exercise)
    const p2 = makeProgramDef({
      id: newId(),
      name: 'Second',
      microcycles: [
        {
          id: newId(),
          days: [
            {
              id: newId(),
              activities: [{ kind: 'exercise', exercise, fallback: { sets: 2, quantifierValue: 10 } }],
            },
          ],
        },
      ],
    })
    await saveProgramDef(db, p1)
    await saveProgramDef(db, p2)

    const all = await listProgramDefs(db)
    const ids = all.map(p => p.id as string)
    expect(ids).toContain(p1.id as string)
    expect(ids).toContain(p2.id as string)
    expect(all).toHaveLength(2)
  })

  it('saveProgramDef replaces children on second save (reordering reflected)', async () => {
    const db = await makeTestDb()
    const exercise = await persistExerciseGraph(db)

    const mcId1 = newId()
    const mcId2 = newId()
    const dayId1 = newId()
    const dayId2 = newId()

    const v1 = makeProgramDef({
      id: newId(),
      name: 'Reorder Test',
      microcycles: [
        {
          id: mcId1,
          label: 'First',
          days: [{ id: dayId1, activities: [{ kind: 'exercise', exercise, fallback: { sets: 3, quantifierValue: 5 } }] }],
        },
        {
          id: mcId2,
          label: 'Second',
          days: [{ id: dayId2, activities: [{ kind: 'exercise', exercise, fallback: { sets: 4, quantifierValue: 8 } }] }],
        },
      ],
    })
    await saveProgramDef(db, v1)

    // Rebuild with microcycles swapped
    const v2 = makeProgramDef({
      id: v1.id as string,
      name: 'Reorder Test',
      microcycles: [
        {
          id: mcId2,
          label: 'Second',
          days: [{ id: dayId2, activities: [{ kind: 'exercise', exercise, fallback: { sets: 4, quantifierValue: 8 } }] }],
        },
        {
          id: mcId1,
          label: 'First',
          days: [{ id: dayId1, activities: [{ kind: 'exercise', exercise, fallback: { sets: 3, quantifierValue: 5 } }] }],
        },
      ],
    })
    await saveProgramDef(db, v2)

    const found = await getProgramDef(db, v1.id as string)
    expect(found).not.toBeNull()
    expect(found!.microcycles[0]!.label).toBe('Second')
    expect(found!.microcycles[1]!.label).toBe('First')
  })

  it('throws EntityNotFoundError when referenced exercise is missing', async () => {
    const db = await makeTestDb()
    const exercise = await persistExerciseGraph(db)
    const program = buildMinimalProgram(exercise)
    await saveProgramDef(db, program)

    // Force-delete exercise bypassing FK
    await db.execute(sql`SET session_replication_role = 'replica'`)
    await db.execute(sql`DELETE FROM exercise_defs WHERE id = ${exercise.id as string}`)
    await db.execute(sql`SET session_replication_role = 'origin'`)

    await expect(getProgramDef(db, program.id as string)).rejects.toBeInstanceOf(EntityNotFoundError)
  })

  it('throws EntityNotFoundError when referenced progression is missing', async () => {
    const db = await makeTestDb()
    const exercise = await persistExerciseGraph(db)
    const prog = buildLinearProgression(exercise)
    await saveProgressionDef(db, prog)

    const program = makeProgramDef({
      id: newId(),
      name: 'Dangling Progression',
      microcycles: [
        {
          id: newId(),
          days: [
            {
              id: newId(),
              activities: [{ kind: 'exercise', exercise, progression: prog }],
            },
          ],
        },
      ],
    })
    await saveProgramDef(db, program)

    await db.execute(sql`SET session_replication_role = 'replica'`)
    await db.execute(sql`DELETE FROM progression_defs WHERE id = ${prog.id as string}`)
    await db.execute(sql`SET session_replication_role = 'origin'`)

    await expect(getProgramDef(db, program.id as string)).rejects.toBeInstanceOf(EntityNotFoundError)
  })

  it('throws on corrupt activity body jsonb (re-validation)', async () => {
    const db = await makeTestDb()
    const exercise = await persistExerciseGraph(db)
    const program = buildMinimalProgram(exercise)
    await saveProgramDef(db, program)

    // Corrupt body: kind matches column ('exercise') but exerciseId is not a UUID — passes DB CHECK, fails Zod
    await db.execute(
      sql`UPDATE program_activity SET body = '{"kind":"exercise","exerciseId":"not-a-uuid"}'::jsonb WHERE day_id IN (SELECT id FROM program_day WHERE microcycle_id IN (SELECT id FROM program_microcycle WHERE program_id = ${program.id as string}))`,
    )

    await expect(getProgramDef(db, program.id as string)).rejects.toThrow()
  })

  it('getProgramDef returns null for unknown id', async () => {
    const db = await makeTestDb()
    const result = await getProgramDef(db, u(9999))
    expect(result).toBeNull()
  })
})
