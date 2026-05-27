import {
  ActionIcon,
  Button,
  Divider,
  Fieldset,
  Group,
  NumberInput,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core'
import type { UseFormReturnType } from '@mantine/form'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import type { QuantifierType } from '../../../domain'

type CountingFormValues = {
  quantifierType: QuantifierType
  quantifierRuleKind: 'min-max' | 'allowed-values'
  minMaxMin: string
  minMaxMax: string
  allowedValues: string[]
}

type Props = {
  form: UseFormReturnType<any>
  values: CountingFormValues
}

export function CountingSection({ form, values }: Props) {
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

        <Stack gap={4}>
          <Text size="sm" fw={500}>Target type</Text>
          <SegmentedControl
            data={[
              { label: 'Range', value: 'min-max' },
              { label: 'Specific values', value: 'allowed-values' },
            ]}
            {...form.getInputProps('quantifierRuleKind')}
          />
        </Stack>

        {values.quantifierRuleKind === 'min-max' && (
          <Group grow gap="xs">
            <NumberInput
              label="Minimum"
              placeholder="1"
              min={1}
              step={1}
              allowDecimal={false}
              {...form.getInputProps('minMaxMin')}
            />
            <NumberInput
              label="Maximum"
              placeholder="10"
              min={1}
              step={1}
              allowDecimal={false}
              {...form.getInputProps('minMaxMax')}
            />
          </Group>
        )}

        {values.quantifierRuleKind === 'allowed-values' && (
          <Stack gap="xs">
            <Divider label="Specific targets" labelPosition="left" />
            {values.allowedValues.map((_: string, i: number) => (
              <Group key={i} align="flex-end" gap="xs" wrap="nowrap">
                <NumberInput
                  label={i === 0 ? `${values.quantifierType === 'reps' ? 'Reps' : 'Seconds'}` : undefined}
                  placeholder="5"
                  min={1}
                  step={1}
                  allowDecimal={false}
                  style={{ flex: 1 }}
                  {...form.getInputProps(`allowedValues.${i}`)}
                />
                <ActionIcon
                  variant="subtle"
                  color="red"
                  disabled={values.allowedValues.length === 1}
                  onClick={() => form.removeListItem('allowedValues', i)}
                  mb={4}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            ))}
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconPlus size={14} />}
              onClick={() => form.insertListItem('allowedValues', '')}
              style={{ alignSelf: 'flex-start' }}
            >
              Add option
            </Button>
          </Stack>
        )}
      </Stack>
    </Fieldset>
  )
}
