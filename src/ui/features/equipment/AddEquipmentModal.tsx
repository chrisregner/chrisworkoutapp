import {
  ActionIcon,
  Alert,
  Button,
  Checkbox,
  Divider,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useEffect } from 'react'
import { useSaveEquipment } from './useSaveEquipment'
import type { EquipmentDef, Unit } from '../../../domain'

type PieceField = { id: string | undefined; resistance: string; quantity: string }

type FormValues = {
  name: string
  description: string
  isCombinable: boolean
  unit: Unit
  pieces: PieceField[]
}

type Props = {
  opened: boolean
  onClose: () => void
  equipment?: EquipmentDef
}

function buildInitialValues(equipment?: EquipmentDef): FormValues {
  if (equipment) {
    return {
      name: equipment.name,
      description: equipment.description ?? '',
      isCombinable: equipment.isCombinable,
      unit: equipment.unit,
      pieces: [...equipment.pieces]
        .sort((a, b) => a.position - b.position)
        .map(p => ({ id: p.id, resistance: String(p.resistance), quantity: String(p.quantity) })),
    }
  }
  return { name: '', description: '', isCombinable: false, unit: 'kg', pieces: [{ id: undefined, resistance: '', quantity: '1' }] }
}

export function AddEquipmentModal({ opened, onClose, equipment }: Props) {
  const isEdit = !!equipment

  const form = useForm<FormValues>({
    mode: 'controlled',
    initialValues: buildInitialValues(equipment),
    validate: {
      name: v => (v.trim() ? null : 'Name required'),
      pieces: {
        resistance: (v: string) => {
          const n = Number(v)
          return !v || isNaN(n) || n <= 0 ? 'Must be > 0' : null
        },
        quantity: (v: string) => {
          const n = Number(v)
          return !v || isNaN(n) || n <= 0 || !Number.isInteger(n) ? 'Must be whole number > 0' : null
        },
      },
    },
  })

  useEffect(() => {
    if (opened) {
      form.setValues(buildInitialValues(equipment))
      form.resetDirty()
      form.clearErrors()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened])

  const { mutate, isPending: loading, error } = useSaveEquipment({
    onSuccess: () => {
      form.reset()
      onClose()
    },
  })

  function handleSubmit(values: FormValues) {
    const input = {
      name: values.name.trim(),
      description: values.description.trim() || undefined,
      isCombinable: values.isCombinable,
      unit: values.unit,
      pieces: values.pieces.map((p, i) => ({
        id: p.id,
        resistance: Number(p.resistance),
        quantity: Number(p.quantity),
        position: i,
      })),
    }
    if (isEdit) {
      mutate({ mode: 'update', id: equipment.id, input })
    } else {
      mutate({ mode: 'create', input })
    }
  }

  const unit = form.getValues().unit

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Title order={4}>{isEdit ? 'Edit Equipment' : 'Add Equipment'}</Title>}
      fullScreen
      styles={{ body: { paddingBottom: 80 } }}
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {error && <Alert color="red">{error.message}</Alert>}

          <TextInput label="Name" placeholder="e.g. Barbell" {...form.getInputProps('name')} />

          <TextInput label="Description" placeholder="Optional" {...form.getInputProps('description')} />

          <Stack gap={4}>
            <Text size="sm" fw={500}>Unit</Text>
            <SegmentedControl
              data={[
                { label: 'kg', value: 'kg' },
                { label: 'lb', value: 'lb' },
              ]}
              {...form.getInputProps('unit')}
            />
          </Stack>

          <Checkbox
            label="Combinable (pieces stack)"
            {...form.getInputProps('isCombinable', { type: 'checkbox' })}
          />

          <Divider label="Pieces" labelPosition="left" />

          <Stack gap="xs">
            {form.getValues().pieces.map((_: PieceField, i: number) => (
              <Group key={i} align="flex-end" gap="xs" wrap="nowrap">
                <NumberInput
                  label={i === 0 ? `Resistance (${unit})` : undefined}
                  placeholder="0"
                  min={0.01}
                  step={0.5}
                  decimalScale={2}
                  style={{ flex: 1 }}
                  {...form.getInputProps(`pieces.${i}.resistance`)}
                />
                <NumberInput
                  label={i === 0 ? 'Qty' : undefined}
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
              Add piece
            </Button>
          </Stack>

          <Button type="submit" loading={loading} mt="sm">
            Save
          </Button>
        </Stack>
      </form>
    </Modal>
  )
}
