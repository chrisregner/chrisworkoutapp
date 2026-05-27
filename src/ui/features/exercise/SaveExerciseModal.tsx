import {
  Alert,
  Button,
  Modal,
  Stack,
  TextInput,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useEffect } from 'react'
import { useSaveExercise } from './useSaveExercise'
import { useEquipmentList } from '../equipment/useEquipmentList'
import { CountingSection } from './CountingSection'
import { EquipmentSection } from './EquipmentSection'
import { makeQuantifierRule } from '../../../domain'
import type { ExerciseDef, QuantifierType } from '../../../domain'

type FormValues = {
  name: string
  description: string
  quantifierType: QuantifierType
  quantifierRuleKind: 'min-max' | 'allowed-values'
  minMaxMin: string
  minMaxMax: string
  allowedValues: string[]
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
    const rule = exercise.quantifierRule
    return {
      name: exercise.name,
      description: exercise.description ?? '',
      quantifierType: exercise.quantifierType,
      quantifierRuleKind: rule.kind,
      minMaxMin: rule.kind === 'min-max' ? String(rule.min) : '1',
      minMaxMax: rule.kind === 'min-max' ? String(rule.max) : '10',
      allowedValues: rule.kind === 'allowed-values' ? rule.values.map(String) : [''],
      equipmentId: exercise.equipment ? exercise.equipment.id : null,
      shouldCombineResistance: exercise.shouldCombineResistance,
    }
  }
  return {
    name: '',
    description: '',
    quantifierType: 'reps',
    quantifierRuleKind: 'min-max',
    minMaxMin: '1',
    minMaxMax: '10',
    allowedValues: [''],
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
      minMaxMin: (v: string, values: FormValues) => {
        if (values.quantifierRuleKind !== 'min-max') return null
        const n = Number(v)
        return !v || isNaN(n) || n <= 0 || !Number.isInteger(n) ? 'Must be whole number > 0' : null
      },
      minMaxMax: (v: string, values: FormValues) => {
        if (values.quantifierRuleKind !== 'min-max') return null
        const n = Number(v)
        if (!v || isNaN(n) || n <= 0 || !Number.isInteger(n)) return 'Must be whole number > 0'
        if (Number(values.minMaxMin) > n) return 'Must be ≥ min'
        return null
      },
    },
  })

  useEffect(() => {
    if (opened) {
      form.setValues(buildInitialValues(exercise))
      form.resetDirty()
      form.clearErrors()
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
    if (values.quantifierRuleKind === 'allowed-values') {
      let hasInvalid = false
      values.allowedValues.forEach((v, i) => {
        const n = Number(v)
        if (!v || isNaN(n) || n <= 0 || !Number.isInteger(n)) {
          form.setFieldError(`allowedValues.${i}`, 'Must be whole number > 0')
          hasInvalid = true
        }
      })
      if (hasInvalid) return
    }

    const quantifierRule = makeQuantifierRule(
      values.quantifierRuleKind === 'min-max'
        ? { kind: 'min-max', min: Number(values.minMaxMin), max: Number(values.minMaxMax) }
        : { kind: 'allowed-values', values: values.allowedValues.map(Number) },
    )

    const input = {
      name: values.name.trim(),
      description: values.description.trim() || undefined,
      quantifierType: values.quantifierType,
      quantifierRule,
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
      title={<Title order={4}>{isEdit ? 'Edit Exercise' : 'Add Exercise'}</Title>}
      fullScreen
      styles={{ body: { paddingBottom: 80 } }}
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {error && <Alert color="red">{error.message}</Alert>}

          <TextInput label="Name" placeholder="e.g. Romanian Deadlift" {...form.getInputProps('name')} />

          <TextInput label="Notes" placeholder="Optional" {...form.getInputProps('description')} />

          <CountingSection form={form} values={values} />

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
