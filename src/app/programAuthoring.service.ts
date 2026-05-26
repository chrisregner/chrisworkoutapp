import type { Db } from '../persistence/client'
import {
  findEquipmentDef,
  findExerciseDef,
  saveEquipmentDef,
  saveExerciseDef,
  saveProgressionDef,
  listEquipmentDefs,
} from '../persistence/repositories'
import {
  EntityNotFoundError,
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

export class ProgramAuthoringService {
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

  async createProgression(input: {
    name: string
    exerciseId: string
    body: ProgressionBodyInput
  }): Promise<ProgressionDef> {
    const exercise = await findExerciseDef(this.db, input.exerciseId)
    if (!exercise) throw new EntityNotFoundError('exercise', input.exerciseId)
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
