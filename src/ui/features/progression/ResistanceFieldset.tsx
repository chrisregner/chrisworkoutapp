import { Fieldset } from '@mantine/core'
import type { ExerciseDef } from '../../../domain'
import {
  CombinableResistance,
  NoEquipmentResistance,
  NonCombinableResistance,
} from './ResistanceSection'
import type { ResistanceConfig } from './saveProgressionState'

type Props = {
  exercise: ExerciseDef
  configs: ResistanceConfig[]
  onChange: (configs: ResistanceConfig[]) => void
  readOnly: boolean
}

export function ResistanceFieldset({ exercise, configs, onChange, readOnly }: Props) {
  return (
    <Fieldset legend="Resistance">
      {!exercise.equipment && (
        <NoEquipmentResistance configs={configs} onChange={onChange} readOnly={readOnly} />
      )}
      {exercise.equipment && !exercise.equipment.isCombinable && (
        <NonCombinableResistance
          equipment={exercise.equipment}
          configs={configs}
          onChange={onChange}
          readOnly={readOnly}
        />
      )}
      {exercise.equipment && exercise.equipment.isCombinable && (
        <CombinableResistance
          equipment={exercise.equipment}
          configs={configs}
          onChange={onChange}
          readOnly={readOnly}
        />
      )}
    </Fieldset>
  )
}
