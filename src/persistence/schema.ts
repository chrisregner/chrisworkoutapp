import { sql } from 'drizzle-orm'
import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  doublePrecision,
  timestamp,
  jsonb,
  check,
  unique,
} from 'drizzle-orm/pg-core'

export const equipmentDefs = pgTable('equipment_defs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  isCombinable: boolean('is_combinable').notNull(),
  unit: text('unit', { enum: ['kg', 'lb'] }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const equipmentPieces = pgTable(
  'equipment_pieces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    equipmentDefId: uuid('equipment_def_id')
      .notNull()
      .references(() => equipmentDefs.id, { onDelete: 'cascade' }),
    resistance: doublePrecision('resistance').notNull(),
    quantity: integer('quantity').notNull(),
    position: integer('position').notNull().default(0),
  },
  t => [
    check('equipment_pieces_quantity_chk', sql`${t.quantity} >= 1`),
    check('equipment_pieces_resistance_chk', sql`${t.resistance} > 0`),
  ],
)

export const exerciseDefs = pgTable('exercise_defs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  quantifierType: text('quantifier_type', { enum: ['reps', 'seconds'] }).notNull(),
  resistanceEquipmentId: uuid('resistance_equipment_id').references(() => equipmentDefs.id, {
    onDelete: 'restrict',
  }),
  shouldCombineResistance: boolean('should_combine_resistance'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Snapshot of an equipment piece embedded inside a VolumeSet body.
 * pieceId is optional lineage metadata — absent for ad-hoc resistance entries
 * (e.g. weighted bodyweight) that have no parent piece. resistance/totalQuantity
 * are always present and authoritative.
 */
export type EquipmentPieceSnapshotPersisted = {
  pieceId?: string
  resistance: number
  totalQuantity: number
}

export type VolumeSetPersisted = {
  sets: number
  quantifierValue: number
  resistanceSource: { piece: EquipmentPieceSnapshotPersisted; quantityUsed: number }[]
}

export type ProgressionBodyPersisted =
  | {
      kind: 'linear'
      volumeSets: VolumeSetPersisted[]
      plannedSets: number[]
      plannedReps: number[]
    }
  | {
      kind: 'heavyLight'
      volumeSets: { heavy: VolumeSetPersisted; light: VolumeSetPersisted }[]
      plannedSets: number[]
      plannedReps: number[]
    }

/** Presentation-only: sort order applied to a progression's grid view. */
export type SortColumn = 'resistance' | 'sets' | 'reps'
export type SortDirection = 'asc' | 'desc'
export type SortOrderPersisted = readonly { column: SortColumn; direction: SortDirection }[]

export const progressionDefs = pgTable(
  'progression_defs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    exerciseId: uuid('exercise_id')
      .notNull()
      .references(() => exerciseDefs.id, { onDelete: 'cascade' }),
    bodyKind: text('body_kind', { enum: ['linear', 'heavyLight'] }).notNull(),
    body: jsonb('body').$type<ProgressionBodyPersisted>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [
    check('progression_defs_body_kind_chk', sql`${t.body}->>'kind' = ${t.bodyKind}`),
  ],
)

/**
 * Per-progression presentation state. Lives outside the domain — sort order
 * is UI/UX concern, not part of the progression's identity or invariants.
 * Cascade-deleted when the underlying progression is removed.
 */
export const progressionViewState = pgTable('progression_view_state', {
  progressionDefId: uuid('progression_def_id')
    .primaryKey()
    .references(() => progressionDefs.id, { onDelete: 'cascade' }),
  sortOrder: jsonb('sort_order').$type<SortOrderPersisted>().notNull(),
})

export type ProgramActivityBodyPersisted =
  | {
      kind: 'rest'
      durationSeconds: number
      label?: string
    }
  | {
      kind: 'exercise'
      exerciseId: string
      role?: 'warmup' | 'main' | 'cooldown'
      progressionId?: string
      hlPick?: 'heavy' | 'light'
      fallback?: {
        sets: number
        quantifierValue: number
        restBetweenSets?: number
      }
    }

export const programDefs = pgTable('program_def', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const programMicrocycles = pgTable(
  'program_microcycle',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    programId: uuid('program_id')
      .notNull()
      .references(() => programDefs.id, { onDelete: 'cascade' }),
    cycleIndex: integer('cycle_index').notNull(),
    label: text('label'),
  },
  t => [unique('program_microcycle_program_id_cycle_index_unique').on(t.programId, t.cycleIndex)],
)

export const programDays = pgTable(
  'program_day',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    microcycleId: uuid('microcycle_id')
      .notNull()
      .references(() => programMicrocycles.id, { onDelete: 'cascade' }),
    dayIndex: integer('day_index').notNull(),
    label: text('label'),
  },
  t => [unique('program_day_microcycle_id_day_index_unique').on(t.microcycleId, t.dayIndex)],
)

export const programActivities = pgTable(
  'program_activity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dayId: uuid('day_id')
      .notNull()
      .references(() => programDays.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    kind: text('kind', { enum: ['rest', 'exercise'] }).notNull(),
    body: jsonb('body').$type<ProgramActivityBodyPersisted>().notNull(),
  },
  t => [
    unique('program_activity_day_id_position_unique').on(t.dayId, t.position),
    check('program_activity_body_kind_chk', sql`${t.body}->>'kind' = ${t.kind}`),
  ],
)

export type EquipmentDefRow = typeof equipmentDefs.$inferSelect
export type NewEquipmentDefRow = typeof equipmentDefs.$inferInsert
export type EquipmentPieceRow = typeof equipmentPieces.$inferSelect
export type NewEquipmentPieceRow = typeof equipmentPieces.$inferInsert
export type ExerciseDefRow = typeof exerciseDefs.$inferSelect
export type NewExerciseDefRow = typeof exerciseDefs.$inferInsert
export type ProgressionDefRow = typeof progressionDefs.$inferSelect
export type NewProgressionDefRow = typeof progressionDefs.$inferInsert
export type ProgressionViewStateRow = typeof progressionViewState.$inferSelect
export type NewProgressionViewStateRow = typeof progressionViewState.$inferInsert
export type ProgramDefRow = typeof programDefs.$inferSelect
export type NewProgramDefRow = typeof programDefs.$inferInsert
export type ProgramMicrocycleRow = typeof programMicrocycles.$inferSelect
export type NewProgramMicrocycleRow = typeof programMicrocycles.$inferInsert
export type ProgramDayRow = typeof programDays.$inferSelect
export type NewProgramDayRow = typeof programDays.$inferInsert
export type ProgramActivityRow = typeof programActivities.$inferSelect
export type NewProgramActivityRow = typeof programActivities.$inferInsert
