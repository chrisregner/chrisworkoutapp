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

export type QuantifierRulePersisted =
  | { kind: 'min-max'; min: number; max: number }
  | { kind: 'allowed-values'; values: number[] }

export const exerciseDefs = pgTable('exercise_defs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  quantifierType: text('quantifier_type', { enum: ['reps', 'seconds'] }).notNull(),
  quantifierRule: jsonb('quantifier_rule').$type<QuantifierRulePersisted>().notNull(),
  resistanceEquipmentId: uuid('resistance_equipment_id').references(() => equipmentDefs.id, {
    onDelete: 'restrict',
  }),
  shouldCombineResistance: boolean('should_combine_resistance'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Snapshot of an equipment piece embedded inside a VolumeSet body.
 * Carries pieceId for identity; resistance/totalQuantity captured for historical value.
 */
export type EquipmentPieceSnapshotPersisted = {
  pieceId: string
  resistance: number
  totalQuantity: number
}

export type VolumeSetPersisted = {
  sets: number
  quantifierValue: number
  resistanceSource: { piece: EquipmentPieceSnapshotPersisted; quantityUsed: number }[]
}

export type ProgressionBodyPersisted =
  | { kind: 'linear'; volumeSets: VolumeSetPersisted[] }
  | { kind: 'heavyLight'; volumeSets: { heavy: VolumeSetPersisted; light: VolumeSetPersisted }[] }

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

export type EquipmentDefRow = typeof equipmentDefs.$inferSelect
export type NewEquipmentDefRow = typeof equipmentDefs.$inferInsert
export type EquipmentPieceRow = typeof equipmentPieces.$inferSelect
export type NewEquipmentPieceRow = typeof equipmentPieces.$inferInsert
export type ExerciseDefRow = typeof exerciseDefs.$inferSelect
export type NewExerciseDefRow = typeof exerciseDefs.$inferInsert
export type ProgressionDefRow = typeof progressionDefs.$inferSelect
export type NewProgressionDefRow = typeof progressionDefs.$inferInsert
