import type { EquipmentDef, ExerciseDef, ProgressionDef, VolumeSetInput } from '../../../domain'

// ── Types ────────────────────────────────────────────────────────────────────

export type SortDimension = 'Resistance' | 'Sets' | 'Reps'
export type SortEntry = { dim: SortDimension; dir: 'asc' | 'desc' }

export type ResistanceConfig = {
  id: string
  label: string
  source: VolumeSetInput['resistanceSource']
}

// ── Constants ────────────────────────────────────────────────────────────────

export const UNLOADED_CONFIG_ID = 'unloaded'

export const DEFAULT_SORT: [SortEntry, SortEntry, SortEntry] = [
  { dim: 'Resistance', dir: 'asc' },
  { dim: 'Sets', dir: 'asc' },
  { dim: 'Reps', dir: 'asc' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

export function newConfigId(): string {
  return Math.random().toString(36).slice(2)
}

export function sourceKey(source: VolumeSetInput['resistanceSource']): string {
  // Ad-hoc entries have no pieceId; key on resistance value instead so identical
  // ad-hoc configurations collapse to one config.
  return JSON.stringify(
    source
      .slice()
      .sort((a, b) => {
        const ka = a.piece.pieceId ?? `adhoc:${a.piece.resistance}`
        const kb = b.piece.pieceId ?? `adhoc:${b.piece.resistance}`
        return ka.localeCompare(kb)
      })
      .map(r => ({
        id: r.piece.pieceId ?? `adhoc:${r.piece.resistance}`,
        qty: r.quantityUsed,
      })),
  )
}

export function resistanceTotal(source: VolumeSetInput['resistanceSource']): number {
  return source.reduce((sum, r) => sum + r.piece.resistance * r.quantityUsed, 0)
}

function labelForSource(
  source: VolumeSetInput['resistanceSource'],
  equipment: EquipmentDef | null,
): string {
  if (source.length === 0) return 'Unloaded'
  const total = resistanceTotal(source)
  if (equipment) return `${total}${equipment.unit}`
  return `+${total}`
}

function deriveConfigsFromProgression(
  progression: ProgressionDef,
  equipment: EquipmentDef | null,
): ResistanceConfig[] {
  if (progression.body.kind !== 'linear') return []
  const seen = new Map<string, ResistanceConfig>()
  // For bodyweight, ensure the implicit "Bodyweight" config is always present
  // even if no saved volume set uses an empty source.
  if (!equipment) {
    const emptyKey = sourceKey([])
    seen.set(emptyKey, { id: UNLOADED_CONFIG_ID, label: 'Unloaded', source: [] })
  }
  for (const vs of progression.body.volumeSets) {
    const src: VolumeSetInput['resistanceSource'] = vs.resistanceSource.map(r => ({
      piece: {
        ...(r.piece.pieceId !== undefined ? { pieceId: r.piece.pieceId as string } : {}),
        resistance: r.piece.resistance as number,
        totalQuantity: r.piece.totalQuantity as number,
      },
      quantityUsed: r.quantityUsed as number,
    }))
    const key = sourceKey(src)
    if (!seen.has(key)) {
      const id = src.length === 0 ? UNLOADED_CONFIG_ID : key
      seen.set(key, { id, label: labelForSource(src, equipment), source: src })
    }
  }
  return Array.from(seen.values())
}

function findConfigId(
  configs: ResistanceConfig[],
  source: VolumeSetInput['resistanceSource'],
): string | undefined {
  const key = sourceKey(source)
  return configs.find(c => sourceKey(c.source) === key)?.id
}

function deriveSelectedCells(
  progression: ProgressionDef,
  configs: ResistanceConfig[],
): string[] {
  if (progression.body.kind !== 'linear') return []
  return progression.body.volumeSets.map(vs => {
    const src: VolumeSetInput['resistanceSource'] = vs.resistanceSource.map(r => ({
      piece: {
        ...(r.piece.pieceId !== undefined ? { pieceId: r.piece.pieceId as string } : {}),
        resistance: r.piece.resistance as number,
        totalQuantity: r.piece.totalQuantity as number,
      },
      quantityUsed: r.quantityUsed as number,
    }))
    const configId = findConfigId(configs, src) ?? ''
    return `${configId}|${vs.sets as number}|${vs.quantifierValue as number}`
  })
}

export type InitialFormState = {
  name: string
  setsValues: number[]
  repValues: number[]
  configs: ResistanceConfig[]
  selectedCells: string[]
  sortOrder: [SortEntry, SortEntry, SortEntry]
}

export function buildInitialState(
  exercise: ExerciseDef,
  progression?: ProgressionDef,
): InitialFormState {
  if (progression && progression.body.kind === 'linear') {
    const configs = deriveConfigsFromProgression(progression, exercise.equipment)
    const selectedCells = deriveSelectedCells(progression, configs)
    const setsValues = [...new Set(progression.body.volumeSets.map(vs => vs.sets as number))].sort((a, b) => a - b)
    const repValues = [...new Set(progression.body.volumeSets.map(vs => vs.quantifierValue as number))].sort((a, b) => a - b)
    return { name: progression.name, setsValues, repValues, configs, selectedCells, sortOrder: DEFAULT_SORT }
  }

  let configs: ResistanceConfig[] = []
  if (exercise.equipment && !exercise.equipment.isCombinable) {
    configs = exercise.equipment.pieces.map(piece => {
      const id = newConfigId()
      const qty = piece.quantity as number
      const label = `${piece.resistance as number}${exercise.equipment!.unit}${qty > 1 ? ` ×${qty}` : ''}`
      return {
        id,
        label,
        source: [{
          piece: { pieceId: piece.id as string, resistance: piece.resistance as number, totalQuantity: qty },
          quantityUsed: qty,
        }],
      }
    })
  } else if (!exercise.equipment) {
    configs = [{ id: UNLOADED_CONFIG_ID, label: 'Unloaded', source: [] }]
  }

  return {
    name: '',
    setsValues: [],
    repValues: [],
    configs,
    selectedCells: [],
    sortOrder: DEFAULT_SORT,
  }
}
