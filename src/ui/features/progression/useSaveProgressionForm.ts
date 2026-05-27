import { useEffect, useState } from 'react'
import { ruleAccepts } from '../../../domain'
import type { ExerciseDef, ProgressionBodyInput, ProgressionDef, VolumeSetInput } from '../../../domain'
import {
  buildInitialState,
  cellIdFor,
  type HeavyLightPair,
  type ProgressionKind,
  type ResistanceConfig,
  type SortEntry,
} from './saveProgressionState'

type Params = {
  opened: boolean
  exercise: ExerciseDef
  progression?: ProgressionDef
  kind?: ProgressionKind
}

export function useSaveProgressionForm({ opened, exercise, progression, kind: kindHint }: Params) {
  const [mode, setMode] = useState<'view' | 'edit'>(progression ? 'view' : 'edit')

  const [initial] = useState(() => buildInitialState(exercise, progression, kindHint))
  const [kind, setKind] = useState<ProgressionKind>(initial.kind)
  const [name, setName] = useState(initial.name)
  const [setsValues, setSetsValues] = useState<number[]>(initial.setsValues)
  const [repValues, setRepValues] = useState<number[]>(initial.repValues)
  const [configs, setConfigs] = useState<ResistanceConfig[]>(initial.configs)
  const [selectedCells, setSelectedCells] = useState<string[]>(initial.selectedCells)
  const [pairs, setPairs] = useState<HeavyLightPair[]>(initial.pairs)
  const [pendingHeavy, setPendingHeavy] = useState<string | null>(initial.pendingHeavy)
  const [sortOrder, setSortOrder] = useState<[SortEntry, SortEntry, SortEntry]>(initial.sortOrder)

  function resetToFresh() {
    const fresh = buildInitialState(exercise, progression, kindHint)
    setKind(fresh.kind)
    setName(fresh.name)
    setSetsValues(fresh.setsValues)
    setRepValues(fresh.repValues)
    setConfigs(fresh.configs)
    setSelectedCells(fresh.selectedCells)
    setPairs(fresh.pairs)
    setPendingHeavy(fresh.pendingHeavy)
    setSortOrder(fresh.sortOrder)
  }

  useEffect(() => {
    if (opened) {
      resetToFresh()
      setMode(progression ? 'view' : 'edit')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened])

  useEffect(() => {
    const validConfigIds = new Set(configs.map(c => c.id))
    const validSets = new Set(setsValues)
    const validReps = new Set(repValues)
    function cellValid(cellId: string): boolean {
      const [configId, sStr, rStr] = cellId.split('|')
      return (
        validConfigIds.has(configId ?? '') &&
        validSets.has(Number(sStr)) &&
        validReps.has(Number(rStr))
      )
    }
    setSelectedCells(prev => prev.filter(cellValid))
    setPairs(prev => prev.filter(p => cellValid(p.heavy) && cellValid(p.light)))
    setPendingHeavy(prev => (prev && cellValid(prev) ? prev : null))
  }, [configs, setsValues, repValues])

  function enterEdit() {
    setMode('edit')
  }

  function cancelEdit() {
    resetToFresh()
    setMode('view')
  }

  function toggleCellLinear(cellId: string) {
    setSelectedCells(prev =>
      prev.includes(cellId) ? prev.filter(id => id !== cellId) : [...prev, cellId],
    )
  }

  function toggleCellHeavyLight(cellId: string) {
    const pairIdx = pairs.findIndex(p => p.heavy === cellId || p.light === cellId)
    if (pairIdx >= 0) {
      setPairs(prev => prev.filter((_, i) => i !== pairIdx))
      return
    }
    if (pendingHeavy === cellId) {
      setPendingHeavy(null)
      return
    }
    if (pendingHeavy === null) {
      setPendingHeavy(cellId)
      return
    }
    setPairs(prev => [...prev, { heavy: pendingHeavy, light: cellId }])
    setPendingHeavy(null)
  }

  function toggleCell(cellId: string) {
    if (kind === 'linear') toggleCellLinear(cellId)
    else toggleCellHeavyLight(cellId)
  }

  function repValidate(v: number): string | null {
    if (!ruleAccepts(exercise.quantifierRule, v)) {
      const rule = exercise.quantifierRule
      if (rule.kind === 'min-max') return `Must be between ${rule.min} and ${rule.max}`
      return `Must be one of: ${rule.values.join(', ')}`
    }
    return null
  }

  function volumeSetFromCell(
    cellId: string,
    configMap: Map<string, ResistanceConfig>,
  ): VolumeSetInput {
    const [configId, sStr, rStr] = cellId.split('|')
    const config = configMap.get(configId ?? '')!
    return { sets: Number(sStr), quantifierValue: Number(rStr), resistanceSource: config.source }
  }

  function buildBody(): ProgressionBodyInput {
    const configMap = new Map(configs.map(c => [c.id, c]))
    if (kind === 'linear') {
      return {
        kind: 'linear',
        volumeSets: selectedCells.map(cellId => volumeSetFromCell(cellId, configMap)),
      }
    }
    return {
      kind: 'heavyLight',
      volumeSets: pairs.map(p => ({
        heavy: volumeSetFromCell(p.heavy, configMap),
        light: volumeSetFromCell(p.light, configMap),
      })),
    }
  }

  const hasSelection = kind === 'linear' ? selectedCells.length > 0 : pairs.length > 0
  const canSave = name.trim().length > 0 && hasSelection && pendingHeavy === null

  return {
    kind,
    mode,
    enterEdit,
    cancelEdit,
    name,
    setName,
    setsValues,
    setSetsValues,
    repValues,
    setRepValues,
    configs,
    setConfigs,
    selectedCells,
    pairs,
    pendingHeavy,
    sortOrder,
    setSortOrder,
    toggleCell,
    repValidate,
    buildBody,
    canSave,
  }
}

export { cellIdFor }
