import {
  Alert,
  Button,
  Modal,
  Stack,
  TextInput,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useEffect, useState } from 'react'
import { useSaveExercise } from './useSaveExercise'
import { useEquipmentList } from '../equipment/useEquipmentList'
import { CountingSection } from './CountingSection'
import { EquipmentSection } from './EquipmentSection'
import type { ExerciseDef, QuantifierType } from '../../../domain'

type FormValues = {
  name: string
  description: string
  quantifierType: QuantifierType
  equipmentId: string | null
  shouldCombineResistance: boolean
}

type Props = {
  opened: boolean
  onClose: () => void
  exercise?: ExerciseDef
}

function buildInitialValues(exercise?: ExerciseDef): FormValues {
  if (exercise) {
    return {
      name: exercise.name,
      description: exercise.description ?? '',
      quantifierType: exercise.quantifierType,
      equipmentId: exercise.equipment ? exercise.equipment.id : null,
      shouldCombineResistance: exercise.shouldCombineResistance,
    }
  }
  return {
    name: '',
    description: '',
    quantifierType: 'reps',
    equipmentId: null,
    shouldCombineResistance: false,
  }
}

export function SaveExerciseModal({ opened, onClose, exercise }: Props) {
  const isEdit = !!exercise
  const { data: equipmentList = [] } = useEquipmentList()

  const form = useForm<FormValues>({
    mode: 'controlled',
    initialValues: buildInitialValues(exercise),
    validate: {
      name: (v: string) => (v.trim() ? null : 'Name required'),
    },
  })

  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (opened) {
      form.setValues(buildInitialValues(exercise))
      form.resetDirty()
      form.clearErrors()
      setSubmitError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened])

  const { mutate, isPending: loading, error } = useSaveExercise({
    onSuccess: () => {
      form.reset()
      onClose()
    },
  })

  function handleSubmit(values: FormValues) {
    setSubmitError(null)

    const input = {
      name: values.name.trim(),
      description: values.description.trim() || undefined,
      quantifierType: values.quantifierType,
      equipmentId: values.equipmentId,
      shouldCombineResistance: values.shouldCombineResistance,
    }

    if (isEdit) {
      mutate({ mode: 'update', id: exercise.id, input })
    } else {
      mutate({ mode: 'create', input })
    }
  }

  const values = form.getValues()
  const selectedEquipment = equipmentList.find(e => e.id === values.equipmentId) ?? null

  function handleEquipmentChange(id: string | null) {
    form.setFieldValue('equipmentId', id)
    if (!id || !(equipmentList.find(e => e.id === id)?.isCombinable)) {
      form.setFieldValue('shouldCombineResistance', false)
    }
  }

  const equipmentSelectData = equipmentList.map(e => ({ value: e.id, label: e.name }))

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? 'Edit Exercise' : 'Add Exercise'}
      fullScreen
      styles={{ body: { paddingBottom: 80 } }}
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {(error || submitError) && (
            <Alert color="red">{submitError ?? (error ? error.message : null)}</Alert>
          )}

          <TextInput label="Name" placeholder="e.g. Romanian Deadlift" {...form.getInputProps('name')} />

          <TextInput label="Notes" placeholder="Optional" {...form.getInputProps('description')} />

          <CountingSection form={form} />

          <EquipmentSection
            form={form}
            equipmentId={values.equipmentId}
            equipmentSelectData={equipmentSelectData}
            selectedEquipment={selectedEquipment}
            onEquipmentChange={handleEquipmentChange}
          />

          <Button type="submit" loading={loading} mt="sm">
            Save
          </Button>
        </Stack>
      </form>
    </Modal>
  )
}
