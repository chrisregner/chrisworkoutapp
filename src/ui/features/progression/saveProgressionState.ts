import type { EquipmentDef, ExerciseDef, ProgressionDef, VolumeSet, VolumeSetInput } from '../../../domain'

// ── Types ────────────────────────────────────────────────────────────────────

export type ProgressionKind = 'linear' | 'heavyLight'

export type SortDimension = 'Resistance' | 'Sets' | 'Reps'
export type SortEntry = { dim: SortDimension; dir: 'asc' | 'desc' }

export type ResistanceConfig = {
  id: string
  label: string
  source: VolumeSetInput['resistanceSource']
}

export type HeavyLightPair = { heavy: string; light: string }

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

function volumeSetToInputSource(vs: VolumeSet): VolumeSetInput['resistanceSource'] {
  return vs.resistanceSource.map(r => ({
    piece: {
      ...(r.piece.pieceId !== undefined ? { pieceId: r.piece.pieceId as string } : {}),
      resistance: r.piece.resistance as number,
      totalQuantity: r.piece.totalQuantity as number,
    },
    quantityUsed: r.quantityUsed as number,
  }))
}

function* iterateBodySets(progression: ProgressionDef): Generator<VolumeSet> {
  if (progression.body.kind === 'linear') {
    for (const vs of progression.body.volumeSets) yield vs
  } else {
    for (const pair of progression.body.volumeSets) {
      yield pair.heavy
      yield pair.light
    }
  }
}

function deriveConfigsFromProgression(
  progression: ProgressionDef,
  equipment: EquipmentDef | null,
): ResistanceConfig[] {
  const seen = new Map<string, ResistanceConfig>()
  // For bodyweight, ensure the implicit "Unloaded" config is always present
  // even if no saved volume set uses an empty source.
  if (!equipment) {
    const emptyKey = sourceKey([])
    seen.set(emptyKey, { id: UNLOADED_CONFIG_ID, label: 'Unloaded', source: [] })
  }
  for (const vs of iterateBodySets(progression)) {
    const src = volumeSetToInputSource(vs)
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

export function cellIdFor(configId: string, sets: number, reps: number): string {
  return `${configId}|${sets}|${reps}`
}

function cellIdForSet(vs: VolumeSet, configs: ResistanceConfig[]): string {
  const src = volumeSetToInputSource(vs)
  const configId = findConfigId(configs, src) ?? ''
  return cellIdFor(configId, vs.sets as number, vs.quantifierValue as number)
}

function deriveSelectedCells(
  progression: ProgressionDef,
  configs: ResistanceConfig[],
): string[] {
  if (progression.body.kind !== 'linear') return []
  return progression.body.volumeSets.map(vs => cellIdForSet(vs, configs))
}

function derivePairs(
  progression: ProgressionDef,
  configs: ResistanceConfig[],
): HeavyLightPair[] {
  if (progression.body.kind !== 'heavyLight') return []
  return progression.body.volumeSets.map(pair => ({
    heavy: cellIdForSet(pair.heavy, configs),
    light: cellIdForSet(pair.light, configs),
  }))
}

export type InitialFormState = {
  kind: ProgressionKind
  name: string
  setsValues: number[]
  repValues: number[]
  configs: ResistanceConfig[]
  selectedCells: string[]
  pairs: HeavyLightPair[]
  pendingHeavy: string | null
  sortOrder: [SortEntry, SortEntry, SortEntry]
}

export function buildInitialState(
  exercise: ExerciseDef,
  progression?: ProgressionDef,
  kindHint?: ProgressionKind,
): InitialFormState {
  if (progression) {
    const kind: ProgressionKind = progression.body.kind
    const configs = deriveConfigsFromProgression(progression, exercise.equipment)
    const setsList: number[] = []
    const repsList: number[] = []
    for (const vs of iterateBodySets(progression)) {
      setsList.push(vs.sets as number)
      repsList.push(vs.quantifierValue as number)
    }
    const setsValues = [...new Set(setsList)].sort((a, b) => a - b)
    const repValues = [...new Set(repsList)].sort((a, b) => a - b)
    const selectedCells = deriveSelectedCells(progression, configs)
    const pairs = derivePairs(progression, configs)
    return {
      kind,
      name: progression.name,
      setsValues,
      repValues,
      configs,
      selectedCells,
      pairs,
      pendingHeavy: null,
      sortOrder: DEFAULT_SORT,
    }
  }

  const kind: ProgressionKind = kindHint ?? 'linear'

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
    kind,
    name: '',
    setsValues: [],
    repValues: [],
    configs,
    selectedCells: [],
    pairs: [],
    pendingHeavy: null,
    sortOrder: DEFAULT_SORT,
  }
}
