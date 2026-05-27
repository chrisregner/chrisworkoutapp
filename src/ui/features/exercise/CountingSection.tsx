import { Fieldset, SegmentedControl, Stack, Text } from '@mantine/core'
import type { UseFormReturnType } from '@mantine/form'

type Props = {
  form: UseFormReturnType<any>
}

export function CountingSection({ form }: Props) {
  return (
    <Fieldset legend="Counting">
      <Stack gap="sm">
        <Stack gap={4}>
          <Text size="sm" fw={500}>Track by</Text>
          <SegmentedControl
            data={[
              { label: 'Reps', value: 'reps' },
              { label: 'Seconds', value: 'seconds' },
            ]}
            {...form.getInputProps('quantifierType')}
          />
        </Stack>
      </Stack>
    </Fieldset>
  )
}
