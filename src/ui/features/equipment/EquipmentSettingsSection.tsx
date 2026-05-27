import { Checkbox, Fieldset, SegmentedControl, Stack, Text } from '@mantine/core'
import type { UseFormReturnType } from '@mantine/form'
import type { Unit } from '../../../domain'

type FormValues = {
  name: string
  description: string
  isCombinable: boolean
  unit: Unit
  pieces: { id: string | undefined; resistance: string; quantity: string }[]
}

type Props = {
  form: UseFormReturnType<FormValues>
}

export function EquipmentSettingsSection({ form }: Props) {
  return (
    <Fieldset legend="Settings">
      <Stack gap="sm">
        <Stack gap={4}>
          <Text size="sm" fw={500}>Weight unit</Text>
          <SegmentedControl
            data={[
              { label: 'kg', value: 'kg' },
              { label: 'lb', value: 'lb' },
            ]}
            {...form.getInputProps('unit')}
          />
        </Stack>

        <Checkbox
          label="Stackable"
          description="Weights add together when multiple pieces are used"
          {...form.getInputProps('isCombinable', { type: 'checkbox' })}
        />
      </Stack>
    </Fieldset>
  )
}
