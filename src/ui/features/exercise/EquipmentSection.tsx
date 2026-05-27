import { Checkbox, Fieldset, Select, Stack } from '@mantine/core'
import type { UseFormReturnType } from '@mantine/form'

type EquipmentLike = {
  id: string
  isCombinable: boolean
  unit: string
  pieces: readonly { id: string; resistance: number; quantity: number }[]
}

type Props = {
  form: UseFormReturnType<any>
  equipmentId: string | null
  equipmentSelectData: { value: string; label: string }[]
  selectedEquipment: EquipmentLike | null
  onEquipmentChange: (id: string | null) => void
}

export function EquipmentSection({
  form,
  equipmentId,
  equipmentSelectData,
  selectedEquipment,
  onEquipmentChange,
}: Props) {
  return (
    <Fieldset legend="Equipment">
      <Stack gap="sm">
        <Select
          label="Equipment"
          placeholder="None"
          data={equipmentSelectData}
          value={equipmentId}
          onChange={onEquipmentChange}
          clearable
        />

        {selectedEquipment && (
          <Checkbox
            label="Add weights together"
            disabled={!selectedEquipment.isCombinable}
            description={
              !selectedEquipment.isCombinable
                ? 'Not available — this equipment isn\'t stackable'
                : 'Total load = sum of all selected pieces'
            }
            {...form.getInputProps('shouldCombineResistance', { type: 'checkbox' })}
          />
        )}
      </Stack>
    </Fieldset>
  )
}
