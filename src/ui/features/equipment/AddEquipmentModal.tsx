import {
  Alert,
  Button,
  Modal,
  Stack,
  TextInput,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useEffect } from 'react'
import { EquipmentPiecesSection } from './EquipmentPiecesSection'
import { EquipmentSettingsSection } from './EquipmentSettingsSection'
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
      title={isEdit ? 'Edit Equipment' : 'Add Equipment'}
      fullScreen
      styles={{ body: { paddingBottom: 80 } }}
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {error && <Alert color="red">{error.message}</Alert>}

          <TextInput label="Name" placeholder="e.g. Barbell" {...form.getInputProps('name')} />

          <TextInput label="Notes" placeholder="Optional" {...form.getInputProps('description')} />

          <EquipmentSettingsSection form={form} />

          <EquipmentPiecesSection form={form} unit={unit} />

          <Button type="submit" loading={loading} mt="sm">
            Save
          </Button>
        </Stack>
      </form>
    </Modal>
  )
}
