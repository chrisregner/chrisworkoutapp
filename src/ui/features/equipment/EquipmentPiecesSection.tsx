import { ActionIcon, Button, Fieldset, Group, NumberInput, Stack } from '@mantine/core'
import type { UseFormReturnType } from '@mantine/form'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import type { Unit } from '../../../domain'

type PieceField = { id: string | undefined; resistance: string; quantity: string }

type FormValues = {
  name: string
  description: string
  isCombinable: boolean
  unit: Unit
  pieces: PieceField[]
}

type Props = {
  form: UseFormReturnType<FormValues>
  unit: Unit
}

export function EquipmentPiecesSection({ form, unit }: Props) {
  return (
    <Fieldset legend="Available weights">
      <Stack gap="xs">
        {form.getValues().pieces.map((_: PieceField, i: number) => (
          <Group key={i} align="flex-end" gap="xs" wrap="nowrap">
            <NumberInput
              label={i === 0 ? `Weight (${unit})` : undefined}
              placeholder="0"
              min={0.01}
              step={0.5}
              decimalScale={2}
              style={{ flex: 1 }}
              {...form.getInputProps(`pieces.${i}.resistance`)}
            />
            <NumberInput
              label={i === 0 ? 'Count' : undefined}
              placeholder="1"
              min={1}
              step={1}
              allowDecimal={false}
              style={{ width: 72 }}
              {...form.getInputProps(`pieces.${i}.quantity`)}
            />
            <ActionIcon
              variant="subtle"
              color="red"
              disabled={form.getValues().pieces.length === 1}
              onClick={() => form.removeListItem('pieces', i)}
              mb={form.errors[`pieces.${i}.resistance`] || form.errors[`pieces.${i}.quantity`] ? 22 : 4}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        ))}

        <Button
          variant="subtle"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={() => form.insertListItem('pieces', { id: undefined, resistance: '', quantity: '1' })}
          style={{ alignSelf: 'flex-start' }}
        >
          Add weight
        </Button>
      </Stack>
    </Fieldset>
  )
}
