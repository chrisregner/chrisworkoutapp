import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { InvariantViolationError } from '../../primitives'
import { makeEquipmentDef } from '../../equipment'
import { makeExerciseDef } from '../../exercise'
import { makeProgressionDef } from '../../progression'
import {
  makeProgramDef,
  hasHeavyLight,
  invertDay,
  invertMicrocycle,
} from '../program'
import type { ExerciseDef } from '../../exercise'
import type { ProgressionDef } from '../../progression'
import type { ActivityInput, MicrocycleInput, ProgramDayInput, ProgramDefInput } from '../program'

const u = (n: number) => `00000000-0000-0000-0000-${n.toString().padStart(12, '0')}`

function buildEquipment() {
  return makeEquipmentDef({
    id: u(1),
    name: 'Plates',
    isCombinable: true,
    unit: 'kg',
    pieces: [
      { id: u(10), resistance: 5, quantity: 4, position: 0 },
      { id: u(11), resistance: 10, quantity: 2, position: 1 },
      { id: u(12), resistance: 20, quantity: 1, position: 2 },
    ],
  })
}

function buildExercise(id = u(2)): ExerciseDef {
  return makeExerciseDef({ id, name: 'Squat', quantifierType: 'reps', equipment: null })
}

function buildLinearProgression(exercise: ExerciseDef, id = u(3)): ProgressionDef {
  return makeProgressionDef({
    id,
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

function buildHLProgression(exercise: ExerciseDef, id = u(4)): ProgressionDef {
  const eq = buildEquipment()
  const exWithEq = makeExerciseDef({
    id: exercise.id as string,
    name: exercise.name,
    quantifierType: exercise.quantifierType,
    equipment: eq,
    shouldCombineResistance: false,
  })
  const snap = (pieceId: string, resistance: number, qty: number) => ({
    pieceId,
    resistance,
    totalQuantity: qty,
  })
  return makeProgressionDef({
    id,
    name: 'HL',
    exercise: exWithEq,
    body: {
      kind: 'heavyLight',
      volumeSets: [
        {
          // heavy: 10kg × 1 set × 5 reps = vol 50
          // light:  5kg × 3 sets × 5 reps = vol 75 > 50 ✓
          heavy: {
            sets: 1,
            quantifierValue: 5,
            resistanceSource: [{ piece: snap(u(11), 10, 2), quantityUsed: 1 }],
          },
          light: {
            sets: 3,
            quantifierValue: 5,
            resistanceSource: [{ piece: snap(u(10), 5, 4), quantityUsed: 1 }],
          },
        },
      ],
      plannedSets: [1, 3],
      plannedReps: [5],
    },
  })
}

function fallbackSlot(exercise: ExerciseDef): ActivityInput {
  return {
    kind: 'exercise',
    exercise,
    fallback: { sets: 3, quantifierValue: 5 },
  }
}

function buildMinimalProgram(overrides?: Partial<ProgramDefInput>): ProgramDefInput {
  const ex = buildExercise()
  return {
    id: u(100),
    name: 'Test Program',
    microcycles: [
      {
        id: u(150),
        days: [
          {
            id: u(200),
            activities: [fallbackSlot(ex)],
          },
        ],
      },
    ],
    ...overrides,
  }
}

// Converts a built ProgramDef back to ProgramDefInput for round-trip tests.
// Activities pass resolved objects through; brands are runtime-transparent.
function programDefToInput(p: ReturnType<typeof makeProgramDef>): ProgramDefInput {
  return {
    id: p.id as string,
    name: p.name,
    microcycles: p.microcycles.map(mc => ({
      id: mc.id as string,
      ...(mc.label !== undefined ? { label: mc.label } : {}),
      days: mc.days.map(day => ({
        id: day.id as string,
        ...(day.label !== undefined ? { label: day.label } : {}),
        activities: day.activities.map((act): ActivityInput => {
          if (act.kind === 'rest') {
            return {
              kind: 'rest',
              durationSeconds: act.durationSeconds as number,
              ...(act.label !== undefined ? { label: act.label } : {}),
            }
          }
          const base = { kind: 'exercise' as const, exercise: act.exercise, role: act.role }
          if (act.progression !== undefined) {
            return {
              ...base,
              progression: act.progression,
              ...(act.hlPick !== undefined ? { hlPick: act.hlPick } : {}),
            }
          }
          return {
            ...base,
            fallback: {
              sets: act.fallback!.sets as number,
              quantifierValue: act.fallback!.quantifierValue as number,
              ...(act.fallback!.restBetweenSets !== undefined
                ? { restBetweenSets: act.fallback!.restBetweenSets as number }
                : {}),
            },
          }
        }),
      })),
    })),
  }
}

// --- Invariant 1: name non-empty ---

describe('makeProgramDef name', () => {
  it('rejects empty name', () => {
    expect(() => makeProgramDef(buildMinimalProgram({ name: '' }))).toThrow(InvariantViolationError)
  })

  it('rejects whitespace-only name', () => {
    expect(() => makeProgramDef(buildMinimalProgram({ name: '   ' }))).toThrow(InvariantViolationError)
  })
})

// --- Invariant 2: microcycles.length >= 1 ---

describe('makeProgramDef microcycles', () => {
  it('rejects empty microcycles array', () => {
    expect(() => makeProgramDef(buildMinimalProgram({ microcycles: [] }))).toThrow(
      InvariantViolationError,
    )
  })
})

// --- Invariant 3: microcycle indices 1-based, contiguous, unique ---

describe('makeProgramDef microcycle indices', () => {
  it('assigns 1-based contiguous indices to microcycles', () => {
    const ex = buildExercise()
    const prog = makeProgramDef({
      id: u(100),
      name: 'P',
      microcycles: [
        { id: u(150), days: [{ id: u(201), activities: [fallbackSlot(ex)] }] },
        { id: u(151), days: [{ id: u(202), activities: [fallbackSlot(ex)] }] },
        { id: u(152), days: [{ id: u(203), activities: [fallbackSlot(ex)] }] },
      ],
    })
    expect(prog.microcycles.map(m => m.index as number)).toEqual([1, 2, 3])
  })
})

// --- Id uniqueness: RotationPosition is ID-based, so duplicate ids are rejected ---

describe('makeProgramDef id uniqueness', () => {
  it('rejects duplicate microcycle ids', () => {
    const ex = buildExercise()
    expect(() =>
      makeProgramDef({
        id: u(100),
        name: 'P',
        microcycles: [
          { id: u(150), days: [{ id: u(201), activities: [fallbackSlot(ex)] }] },
          { id: u(150), days: [{ id: u(202), activities: [fallbackSlot(ex)] }] },
        ],
      }),
    ).toThrow(/microcycle ids must be unique/)
  })

  it('rejects duplicate day ids within a microcycle', () => {
    const ex = buildExercise()
    expect(() =>
      makeProgramDef({
        id: u(100),
        name: 'P',
        microcycles: [
          {
            id: u(150),
            days: [
              { id: u(200), activities: [fallbackSlot(ex)] },
              { id: u(200), activities: [fallbackSlot(ex)] },
            ],
          },
        ],
      }),
    ).toThrow(/day ids must be unique/)
  })

  it('rejects duplicate day ids across different microcycles', () => {
    const ex = buildExercise()
    expect(() =>
      makeProgramDef({
        id: u(100),
        name: 'P',
        microcycles: [
          { id: u(150), days: [{ id: u(200), activities: [fallbackSlot(ex)] }] },
          { id: u(151), days: [{ id: u(200), activities: [fallbackSlot(ex)] }] },
        ],
      }),
    ).toThrow(/day ids must be unique/)
  })
})

// --- Invariant 4: each microcycle has >=1 day; day indices 1-based contiguous ---

describe('makeProgramDef days per microcycle', () => {
  it('rejects microcycle with empty days array', () => {
    expect(() =>
      makeProgramDef(
        buildMinimalProgram({
          microcycles: [{ id: u(150), days: [] }],
        }),
      ),
    ).toThrow(InvariantViolationError)
  })

  it('assigns 1-based contiguous indices to days within their microcycle', () => {
    const ex = buildExercise()
    const prog = makeProgramDef({
      id: u(100),
      name: 'P',
      microcycles: [
        {
          id: u(150),
          days: [
            { id: u(201), activities: [fallbackSlot(ex)] },
            { id: u(202), activities: [fallbackSlot(ex)] },
            { id: u(203), activities: [fallbackSlot(ex)] },
          ],
        },
      ],
    })
    expect(prog.microcycles[0]!.days.map(d => d.index as number)).toEqual([1, 2, 3])
  })

  it('day indices restart at 1 in each microcycle', () => {
    const ex = buildExercise()
    const prog = makeProgramDef({
      id: u(100),
      name: 'P',
      microcycles: [
        {
          id: u(150),
          days: [
            { id: u(201), activities: [fallbackSlot(ex)] },
            { id: u(202), activities: [fallbackSlot(ex)] },
          ],
        },
        {
          id: u(151),
          days: [{ id: u(203), activities: [fallbackSlot(ex)] }],
        },
      ],
    })
    expect(prog.microcycles[0]!.days.map(d => d.index as number)).toEqual([1, 2])
    expect(prog.microcycles[1]!.days.map(d => d.index as number)).toEqual([1])
  })
})

// --- Invariant 5: each day has at least one exercise slot ---

describe('makeProgramDef day must have exercise slot', () => {
  it('rejects day with only rest activities', () => {
    expect(() =>
      makeProgramDef(
        buildMinimalProgram({
          microcycles: [
            {
              id: u(150),
              days: [{ id: u(200), activities: [{ kind: 'rest', durationSeconds: 60 }] }],
            },
          ],
        }),
      ),
    ).toThrow(InvariantViolationError)
  })

  it('accepts day with rest + exercise', () => {
    const ex = buildExercise()
    const prog = makeProgramDef(
      buildMinimalProgram({
        microcycles: [
          {
            id: u(150),
            days: [
              {
                id: u(200),
                activities: [{ kind: 'rest', durationSeconds: 60 }, fallbackSlot(ex)],
              },
            ],
          },
        ],
      }),
    )
    expect(prog.microcycles[0]!.days[0]!.activities).toHaveLength(2)
  })
})

// --- Invariant 6a: exactly one of progression or fallback ---

describe('makeProgramDef exercise slot — progression/fallback exclusivity', () => {
  function slotProgram(activities: ActivityInput[]): ProgramDefInput {
    return buildMinimalProgram({
      microcycles: [{ id: u(150), days: [{ id: u(200), activities }] }],
    })
  }

  it('rejects slot with neither progression nor fallback', () => {
    const ex = buildExercise()
    expect(() =>
      makeProgramDef(slotProgram([{ kind: 'exercise', exercise: ex }])),
    ).toThrow(InvariantViolationError)
  })

  it('rejects slot with both progression and fallback', () => {
    const ex = buildExercise()
    const prog = buildLinearProgression(ex)
    expect(() =>
      makeProgramDef(
        slotProgram([
          {
            kind: 'exercise',
            exercise: ex,
            progression: prog,
            fallback: { sets: 3, quantifierValue: 5 },
          },
        ]),
      ),
    ).toThrow(InvariantViolationError)
  })
})

// --- Invariant 6b: progression scope rule ---

describe('makeProgramDef exercise slot — progression scope', () => {
  it('rejects progression belonging to different exercise', () => {
    const ex1 = buildExercise(u(2))
    const ex2 = buildExercise(u(9))
    const progForEx1 = buildLinearProgression(ex1)
    expect(() =>
      makeProgramDef(
        buildMinimalProgram({
          microcycles: [
            {
              id: u(150),
              days: [
                {
                  id: u(200),
                  activities: [{ kind: 'exercise', exercise: ex2, progression: progForEx1 }],
                },
              ],
            },
          ],
        }),
      ),
    ).toThrow(/does not belong to this exercise/)
  })
})

// --- Invariant 6b: hlPick required for heavyLight ---

describe('makeProgramDef exercise slot — hlPick', () => {
  function slotProgram(activities: ActivityInput[]): ProgramDefInput {
    return buildMinimalProgram({
      microcycles: [{ id: u(150), days: [{ id: u(200), activities }] }],
    })
  }

  it('rejects HL progression without hlPick', () => {
    const ex = buildExercise()
    const hlProg = buildHLProgression(ex)
    const exWithEq = hlProg.exercise
    expect(() =>
      makeProgramDef(slotProgram([{ kind: 'exercise', exercise: exWithEq, progression: hlProg }])),
    ).toThrow(/hlPick.*required/)
  })

  it('rejects hlPick on linear progression', () => {
    const ex = buildExercise()
    const linProg = buildLinearProgression(ex)
    expect(() =>
      makeProgramDef(
        slotProgram([
          { kind: 'exercise', exercise: ex, progression: linProg, hlPick: 'heavy' },
        ]),
      ),
    ).toThrow(/must be absent/)
  })

  it('rejects hlPick on fallback slot', () => {
    const ex = buildExercise()
    expect(() =>
      makeProgramDef(
        slotProgram([
          {
            kind: 'exercise',
            exercise: ex,
            fallback: { sets: 3, quantifierValue: 5 },
            hlPick: 'heavy',
          },
        ]),
      ),
    ).toThrow(/must be absent/)
  })

  it('accepts HL progression with hlPick heavy', () => {
    const ex = buildExercise()
    const hlProg = buildHLProgression(ex)
    const exWithEq = hlProg.exercise
    const prog = makeProgramDef(
      slotProgram([{ kind: 'exercise', exercise: exWithEq, progression: hlProg, hlPick: 'heavy' }]),
    )
    const slot = prog.microcycles[0]!.days[0]!.activities[0]!
    expect(slot.kind).toBe('exercise')
    if (slot.kind === 'exercise') {
      expect(slot.hlPick).toBe('heavy')
    }
  })
})

// --- Invariant 7: RestPeriod.durationSeconds > 0 ---

describe('makeProgramDef rest period', () => {
  function dayProgram(activities: ActivityInput[]): ProgramDefInput {
    return buildMinimalProgram({
      microcycles: [{ id: u(150), days: [{ id: u(200), activities }] }],
    })
  }

  it('rejects durationSeconds = 0', () => {
    const ex = buildExercise()
    expect(() =>
      makeProgramDef(dayProgram([{ kind: 'rest', durationSeconds: 0 }, fallbackSlot(ex)])),
    ).toThrow(InvariantViolationError)
  })

  it('accepts positive durationSeconds', () => {
    const ex = buildExercise()
    const prog = makeProgramDef(
      dayProgram([{ kind: 'rest', durationSeconds: 90 }, fallbackSlot(ex)]),
    )
    const rest = prog.microcycles[0]!.days[0]!.activities[0]!
    expect(rest.kind).toBe('rest')
    if (rest.kind === 'rest') {
      expect(rest.durationSeconds as number).toBe(90)
    }
  })
})

// --- Invariant 8: role defaults to 'main' ---

describe('makeProgramDef slot role', () => {
  it('defaults role to main when omitted', () => {
    const prog = makeProgramDef(buildMinimalProgram())
    const slot = prog.microcycles[0]!.days[0]!.activities[0]!
    expect(slot.kind).toBe('exercise')
    if (slot.kind === 'exercise') {
      expect(slot.role).toBe('main')
    }
  })

  it('preserves explicit role', () => {
    const ex = buildExercise()
    const prog = makeProgramDef(
      buildMinimalProgram({
        microcycles: [
          {
            id: u(150),
            days: [
              {
                id: u(200),
                activities: [
                  {
                    kind: 'exercise',
                    exercise: ex,
                    role: 'warmup',
                    fallback: { sets: 2, quantifierValue: 10 },
                  },
                ],
              },
            ],
          },
        ],
      }),
    )
    const slot = prog.microcycles[0]!.days[0]!.activities[0]!
    if (slot.kind === 'exercise') {
      expect(slot.role).toBe('warmup')
    }
  })
})

// --- hasHeavyLight ---

describe('hasHeavyLight', () => {
  function slotProgram(activities: ActivityInput[]): ProgramDefInput {
    return buildMinimalProgram({
      microcycles: [{ id: u(150), days: [{ id: u(200), activities }] }],
    })
  }

  it('false when no HL progressions', () => {
    const prog = makeProgramDef(buildMinimalProgram())
    expect(hasHeavyLight(prog)).toBe(false)
  })

  it('true when at least one slot has HL progression', () => {
    const ex = buildExercise()
    const hlProg = buildHLProgression(ex)
    const exWithEq = hlProg.exercise
    const prog = makeProgramDef(
      slotProgram([{ kind: 'exercise', exercise: exWithEq, progression: hlProg, hlPick: 'heavy' }]),
    )
    expect(hasHeavyLight(prog)).toBe(true)
  })

  it('false with linear progression', () => {
    const ex = buildExercise()
    const linProg = buildLinearProgression(ex)
    const prog = makeProgramDef(
      slotProgram([{ kind: 'exercise', exercise: ex, progression: linProg }]),
    )
    expect(hasHeavyLight(prog)).toBe(false)
  })

  it('true when an HL slot lives in a later microcycle', () => {
    const ex = buildExercise()
    const hlProg = buildHLProgression(ex)
    const exWithEq = hlProg.exercise
    const prog = makeProgramDef({
      id: u(100),
      name: 'P',
      microcycles: [
        { id: u(150), days: [{ id: u(200), activities: [fallbackSlot(ex)] }] },
        {
          id: u(151),
          days: [
            {
              id: u(201),
              activities: [
                { kind: 'exercise', exercise: exWithEq, progression: hlProg, hlPick: 'light' },
              ],
            },
          ],
        },
      ],
    })
    expect(hasHeavyLight(prog)).toBe(true)
  })
})

// --- invertDay ---

describe('invertDay', () => {
  const ex = buildExercise()
  const hlProg = buildHLProgression(ex)
  const exWithEq = hlProg.exercise

  function hlDay(): ProgramDayInput {
    return {
      id: u(300),
      activities: [
        { kind: 'rest', durationSeconds: 60, label: 'rest' },
        { kind: 'exercise', exercise: exWithEq, progression: hlProg, hlPick: 'heavy' },
        { kind: 'exercise', exercise: exWithEq, progression: hlProg, hlPick: 'light' },
        fallbackSlot(ex),
      ],
    }
  }

  it('flips hlPick on HL slots', () => {
    const inverted = invertDay(hlDay())
    const a1 = inverted.activities[1] as ActivityInput & { kind: 'exercise' }
    const a2 = inverted.activities[2] as ActivityInput & { kind: 'exercise' }
    expect(a1.hlPick).toBe('light')
    expect(a2.hlPick).toBe('heavy')
  })

  it('leaves rest periods and non-HL slots untouched', () => {
    const inverted = invertDay(hlDay())
    expect(inverted.activities[0]).toEqual({ kind: 'rest', durationSeconds: 60, label: 'rest' })
    const fb = inverted.activities[3] as ActivityInput & { kind: 'exercise' }
    expect(fb.hlPick).toBeUndefined()
    expect(fb.fallback).toEqual({ sets: 3, quantifierValue: 5 })
  })

  it('preserves the day id', () => {
    expect(invertDay(hlDay()).id).toBe(u(300))
  })

  it('is involutive (invertDay(invertDay(d)) deep-equals d)', () => {
    const d = hlDay()
    expect(invertDay(invertDay(d))).toEqual(d)
  })

  it('inverted day still builds and flips which side hasHeavyLight reflects', () => {
    const built = makeProgramDef({
      id: u(100),
      name: 'P',
      microcycles: [{ id: u(150), days: [invertDay(hlDay())] }],
    })
    const slot = built.microcycles[0]!.days[0]!.activities[1]!
    if (slot.kind === 'exercise') {
      expect(slot.hlPick).toBe('light')
    }
  })
})

// --- invertMicrocycle ---

describe('invertMicrocycle', () => {
  const ex = buildExercise()
  const hlProg = buildHLProgression(ex)
  const exWithEq = hlProg.exercise

  function hlMicrocycle(): MicrocycleInput {
    return {
      id: u(150),
      label: 'Heavy',
      days: [
        {
          id: u(300),
          activities: [
            { kind: 'exercise', exercise: exWithEq, progression: hlProg, hlPick: 'heavy' },
          ],
        },
        {
          id: u(301),
          activities: [
            { kind: 'exercise', exercise: exWithEq, progression: hlProg, hlPick: 'light' },
          ],
        },
      ],
    }
  }

  it('flips every day and preserves id and label', () => {
    const inverted = invertMicrocycle(hlMicrocycle())
    expect(inverted.id).toBe(u(150))
    expect(inverted.label).toBe('Heavy')
    const d0 = inverted.days[0]!.activities[0] as ActivityInput & { kind: 'exercise' }
    const d1 = inverted.days[1]!.activities[0] as ActivityInput & { kind: 'exercise' }
    expect(d0.hlPick).toBe('light')
    expect(d1.hlPick).toBe('heavy')
  })

  it('is involutive', () => {
    const mc = hlMicrocycle()
    expect(invertMicrocycle(invertMicrocycle(mc))).toEqual(mc)
  })
})

// --- Property tests ---

describe('property: microcycle and day indices form 1..N within their scope', () => {
  it('holds for any valid program', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 1, maxLength: 5 }),
        dayCounts => {
          const ex = buildExercise()
          let dayId = 200
          const prog = makeProgramDef({
            id: u(100),
            name: 'P',
            microcycles: dayCounts.map((dayCount, mcIdx) => ({
              id: u(150 + mcIdx),
              days: Array.from({ length: dayCount }, () => ({
                id: u(dayId++),
                activities: [fallbackSlot(ex)],
              })),
            })),
          })

          expect(prog.microcycles.map(m => m.index as number)).toEqual(
            Array.from({ length: dayCounts.length }, (_, i) => i + 1),
          )
          prog.microcycles.forEach((m, mcIdx) => {
            expect(m.days.map(d => d.index as number)).toEqual(
              Array.from({ length: dayCounts[mcIdx]! }, (_, i) => i + 1),
            )
          })
        },
      ),
    )
  })
})

// --- Round-trip ---

describe('round-trip: makeProgramDef(programDefToInput(p)) deep-equals p', () => {
  it('holds for a multi-microcycle program with mixed activities', () => {
    const ex = buildExercise()
    const linProg = buildLinearProgression(ex)
    const hlProg = buildHLProgression(buildExercise(u(50)))
    const exWithEq = hlProg.exercise

    const input: ProgramDefInput = {
      id: u(100),
      name: 'Round-trip Program',
      microcycles: [
        {
          id: u(150),
          label: 'Heavy',
          days: [
            {
              id: u(201),
              label: 'Leg Day',
              activities: [
                { kind: 'rest', durationSeconds: 30, label: 'Warm up' },
                { kind: 'exercise', exercise: ex, progression: linProg },
                {
                  kind: 'exercise',
                  exercise: ex,
                  role: 'cooldown',
                  fallback: { sets: 2, quantifierValue: 10, restBetweenSets: 60 },
                },
              ],
            },
            {
              id: u(202),
              activities: [
                { kind: 'exercise', exercise: exWithEq, progression: hlProg, hlPick: 'light' },
              ],
            },
          ],
        },
        {
          id: u(151),
          days: [
            {
              id: u(203),
              activities: [
                { kind: 'exercise', exercise: exWithEq, progression: hlProg, hlPick: 'heavy' },
              ],
            },
          ],
        },
      ],
    }

    const prog = makeProgramDef(input)
    const roundTripped = makeProgramDef(programDefToInput(prog))
    expect(roundTripped).toEqual(prog)
  })
})
