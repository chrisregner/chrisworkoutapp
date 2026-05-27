import { useEffect, useState } from 'react'
import { ruleAccepts } from '../../../domain'
import type { ExerciseDef, ProgressionDef, VolumeSetInput } from '../../../domain'
import {
  buildInitialState,
  type ResistanceConfig,
  type SortEntry,
} from './saveProgressionState'

type Params = {
  opened: boolean
  exercise: ExerciseDef
  progression?: ProgressionDef
}

export function useSaveProgressionForm({ opened, exercise, progression }: Params) {
  const [mode, setMode] = useState<'view' | 'edit'>(progression ? 'view' : 'edit')

  const [initial] = useState(() => buildInitialState(exercise, progression))
  const [name, setName] = useState(initial.name)
  const [setsValues, setSetsValues] = useState<number[]>(initial.setsValues)
  const [repValues, setRepValues] = useState<number[]>(initial.repValues)
  const [configs, setConfigs] = useState<ResistanceConfig[]>(initial.configs)
  const [selectedCells, setSelectedCells] = useState<string[]>(initial.selectedCells)
  const [sortOrder, setSortOrder] = useState<[SortEntry, SortEntry, SortEntry]>(initial.sortOrder)

  useEffect(() => {
    if (opened) {
      const fresh = buildInitialState(exercise, progression)
      setName(fresh.name)
      setSetsValues(fresh.setsValues)
      setRepValues(fresh.repValues)
      setConfigs(fresh.configs)
      setSelectedCells(fresh.selectedCells)
      setSortOrder(fresh.sortOrder)
      setMode(progression ? 'view' : 'edit')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened])

  useEffect(() => {
    const validConfigIds = new Set(configs.map(c => c.id))
    const validSets = new Set(setsValues)
    const validReps = new Set(repValues)
    setSelectedCells(prev =>
      prev.filter(cellId => {
        const [configId, sStr, rStr] = cellId.split('|')
        return (
          validConfigIds.has(configId ?? '') &&
          validSets.has(Number(sStr)) &&
          validReps.has(Number(rStr))
        )
      }),
    )
  }, [configs, setsValues, repValues])

  function enterEdit() {
    setMode('edit')
  }

  function cancelEdit() {
    const fresh = buildInitialState(exercise, progression)
    setName(fresh.name)
    setSetsValues(fresh.setsValues)
    setRepValues(fresh.repValues)
    setConfigs(fresh.configs)
    setSelectedCells(fresh.selectedCells)
    setSortOrder(fresh.sortOrder)
    setMode('view')
  }

  function toggleCell(cellId: string) {
    setSelectedCells(prev =>
      prev.includes(cellId) ? prev.filter(id => id !== cellId) : [...prev, cellId],
    )
  }

  function repValidate(v: number): string | null {
    if (!ruleAccepts(exercise.quantifierRule, v)) {
      const rule = exercise.quantifierRule
      if (rule.kind === 'min-max') return `Must be between ${rule.min} and ${rule.max}`
      return `Must be one of: ${rule.values.join(', ')}`
    }
    return null
  }

  function buildVolumeSets(): VolumeSetInput[] {
    const configMap = new Map(configs.map(c => [c.id, c]))
    return selectedCells.map(cellId => {
      const [configId, sStr, rStr] = cellId.split('|')
      const config = configMap.get(configId ?? '')!
      return { sets: Number(sStr), quantifierValue: Number(rStr), resistanceSource: config.source }
    })
  }

  const canSave = name.trim().length > 0 && selectedCells.length > 0

  return {
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
    sortOrder,
    setSortOrder,
    toggleCell,
    repValidate,
    buildVolumeSets,
    canSave,
  }
}
