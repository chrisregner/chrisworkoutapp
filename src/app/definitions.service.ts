import type { Db } from '../persistence/client'
import {
  findEquipmentDef,
  findExerciseDef,
  saveEquipmentDef,
  saveExerciseDef,
  saveProgressionDef,
  deleteEquipmentDef,
  deleteExerciseDef,
  countExercisesUsingEquipment,
  listEquipmentDefs,
  listExerciseDefs,
} from '../persistence/repositories'
import {
  EntityNotFoundError,
  ConflictError,
  makeEquipmentDef,
  makeExerciseDef,
  makeProgressionDef,
  type EquipmentDef,
  type ExerciseDef,
  type ProgressionDef,
  type ProgressionBodyInput,
  type QuantifierRule,
  type Unit,
} from '../domain'
import { newId } from '../shared'

export class DefinitionsService {
  constructor(private readonly db: Db) {}

  listEquipment(): Promise<EquipmentDef[]> {
    return listEquipmentDefs(this.db)
  }

  async createEquipment(input: {
    name: string
    description?: string
    isCombinable: boolean
    unit: Unit
    pieces: { id?: string; resistance: number; quantity: number; position?: number }[]
  }): Promise<EquipmentDef> {
    const def = makeEquipmentDef({
      id: newId(),
      name: input.name,
      description: input.description,
      isCombinable: input.isCombinable,
      unit: input.unit,
      pieces: input.pieces.map(p => ({ ...p, id: p.id ?? newId() })),
    })
    await saveEquipmentDef(this.db, def)
    return def
  }

  async createExercise(input: {
    name: string
    description?: string
    quantifierType: 'reps' | 'seconds'
    quantifierRule: QuantifierRule
    equipmentId: string | null
    shouldCombineResistance?: boolean
  }): Promise<ExerciseDef> {
    const equipment = input.equipmentId
      ? await findEquipmentDef(this.db, input.equipmentId)
      : null
    if (input.equipmentId && !equipment) {
      throw new EntityNotFoundError('equipment', input.equipmentId)
    }
    const def = makeExerciseDef({
      id: newId(),
      name: input.name,
      description: input.description,
      quantifierType: input.quantifierType,
      quantifierRule: input.quantifierRule,
      equipment,
      shouldCombineResistance: input.shouldCombineResistance,
    })
    await saveExerciseDef(this.db, def)
    return def
  }

  async updateEquipment(
    id: string,
    input: {
      name: string
      description?: string
      isCombinable: boolean
      unit: Unit
      pieces: { id?: string; resistance: number; quantity: number; position?: number }[]
    },
  ): Promise<EquipmentDef> {
    const existing = await findEquipmentDef(this.db, id)
    if (!existing) throw new EntityNotFoundError('equipment', id)
    const def = makeEquipmentDef({
      id,
      name: input.name,
      description: input.description,
      isCombinable: input.isCombinable,
      unit: input.unit,
      pieces: input.pieces.map(p => ({ ...p, id: p.id ?? newId() })),
    })
    await saveEquipmentDef(this.db, def)
    return def
  }

  listExercises(): Promise<ExerciseDef[]> {
    return listExerciseDefs(this.db)
  }

  async updateExercise(
    id: string,
    input: {
      name: string
      description?: string
      quantifierType: 'reps' | 'seconds'
      quantifierRule: QuantifierRule
      equipmentId: string | null
      shouldCombineResistance?: boolean
    },
  ): Promise<ExerciseDef> {
    const existing = await findExerciseDef(this.db, id)
    if (!existing) throw new EntityNotFoundError('exercise', id)
    const equipment = input.equipmentId ? await findEquipmentDef(this.db, input.equipmentId) : null
    if (input.equipmentId && !equipment) throw new EntityNotFoundError('equipment', input.equipmentId)
    const def = makeExerciseDef({
      id,
      name: input.name,
      description: input.description,
      quantifierType: input.quantifierType,
      quantifierRule: input.quantifierRule,
      equipment,
      shouldCombineResistance: input.shouldCombineResistance,
    })
    await saveExerciseDef(this.db, def)
    return def
  }

  async deleteEquipment(id: string): Promise<void> {
    const existing = await findEquipmentDef(this.db, id)
    if (!existing) throw new EntityNotFoundError('equipment', id)
    const usedBy = await countExercisesUsingEquipment(this.db, id)
    if (usedBy > 0) {
      throw new ConflictError('equipment', `used by ${usedBy} exercise${usedBy !== 1 ? 's' : ''}`)
    }
    await deleteEquipmentDef(this.db, id)
  }

  async deleteExercise(id: string): Promise<void> {
    const existing = await findExerciseDef(this.db, id)
    if (!existing) throw new EntityNotFoundError('exercise', id)
    await deleteExerciseDef(this.db, id)
  }

  async createProgression(input: {
    name: string
    exerciseId: string
    body: ProgressionBodyInput
  }): Promise<ProgressionDef> {
    const exercise = await findExerciseDef(this.db, input.exerciseId)
    if (!exercise) throw new EntityNotFoundError('exercise', input.exerciseId)
    if (exercise.equipment) {
      const validPieceIds = new Set(exercise.equipment.pieces.map(p => p.id as string))
      for (const entry of collectResistanceSources(input.body)) {
        if (!validPieceIds.has(entry.piece.pieceId)) {
          throw new EntityNotFoundError('equipmentPiece', entry.piece.pieceId)
        }
      }
    }
    const def = makeProgressionDef({
      id: newId(),
      name: input.name,
      exercise,
      body: input.body,
    })
    await saveProgressionDef(this.db, def)
    return def
  }
}

function collectResistanceSources(body: ProgressionBodyInput) {
  const sets =
    body.kind === 'linear'
      ? body.volumeSets
      : body.volumeSets.flatMap(pair => [pair.heavy, pair.light])
  return sets.flatMap(vs => vs.resistanceSource)
}
