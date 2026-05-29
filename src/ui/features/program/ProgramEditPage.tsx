import { Alert, Button, Container, Group, Loader, Stack, TextInput, Title } from '@mantine/core'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ProgramDef, SlotRole } from '../../../domain'
import type { ActivityServiceInput, ProgramServiceInput } from '../../../app'
import { useProgramDetail, useCreateProgram, useUpdateProgram } from './usePrograms'
import { MicrocycleEditor } from './components/MicrocycleEditor'
import type { ProgramForm, MicrocycleForm, ActivityForm } from './programFormTypes'
import {
  defaultProgramForm,
  defaultMicrocycle,
  invertMicrocycleForm,
} from './programFormTypes'

// Convert a saved ProgramDef back into editable form state
function programDefToForm(p: ProgramDef): ProgramForm {
  return {
    name: p.name,
    microcycles: p.microcycles.map(mc => ({
      id: mc.id as string,
      label: mc.label ?? '',
      days: mc.days.map(day => ({
        id: day.id as string,
        label: day.label ?? '',
        activities: day.activities.map((act, i): ActivityForm => {
          if (act.kind === 'rest') {
            return {
              _key: `rest-${i}`,
              kind: 'rest',
              durationSeconds: String(act.durationSeconds),
              label: act.label ?? '',
            }
          }
          return {
            _key: `ex-${i}`,
            kind: 'exercise',
            exerciseId: act.exercise.id as string,
            role: act.role,
            progressionId: act.progression ? (act.progression.id as string) : '',
            hlPick: act.hlPick ?? '',
            fallbackSets: act.fallback ? String(act.fallback.sets) : '',
            fallbackQuantifierValue: act.fallback ? String(act.fallback.quantifierValue) : '',
            fallbackRestBetweenSets: act.fallback?.restBetweenSets
              ? String(act.fallback.restBetweenSets)
              : '',
          }
        }),
      })),
    })),
  }
}

function activityFormToServiceInput(act: ActivityForm): ActivityServiceInput {
  if (act.kind === 'rest') {
    return {
      kind: 'rest',
      durationSeconds: Number(act.durationSeconds),
      label: act.label || undefined,
    }
  }
  return {
    kind: 'exercise',
    exerciseId: act.exerciseId,
    role: act.role as SlotRole,
    progressionId: act.progressionId || undefined,
    hlPick: (act.hlPick || undefined) as 'heavy' | 'light' | undefined,
    fallback: !act.progressionId
      ? {
          sets: Number(act.fallbackSets),
          quantifierValue: Number(act.fallbackQuantifierValue),
          restBetweenSets: act.fallbackRestBetweenSets
            ? Number(act.fallbackRestBetweenSets)
            : undefined,
        }
      : undefined,
  }
}

function isFormValid(form: ProgramForm): boolean {
  if (!form.name.trim() || form.microcycles.length === 0) return false
  return form.microcycles.every(mc =>
    mc.days.every(day => {
      const hasExercise = day.activities.some(a => a.kind === 'exercise')
      if (!hasExercise) return false
      return day.activities.every(act => {
        if (act.kind === 'rest') return !!act.durationSeconds
        if (!act.exerciseId) return false
        if (!act.progressionId) {
          return !!act.fallbackSets && !!act.fallbackQuantifierValue
        }
        return true
      })
    }),
  )
}

function formToServiceInput(form: ProgramForm): ProgramServiceInput {
  return {
    name: form.name,
    microcycles: form.microcycles.map(mc => ({
      id: mc.id,
      label: mc.label || undefined,
      days: mc.days.map(day => ({
        id: day.id,
        label: day.label || undefined,
        activities: day.activities.map(activityFormToServiceInput),
      })),
    })),
  }
}

// Edit page as a controlled form backed by useState. Loads program when id
// is present; uses a blank form for /programs/new.
function ProgramEditForm({ existing }: { existing?: ProgramDef }) {
  const navigate = useNavigate()
  const [form, setForm] = useState<ProgramForm>(() =>
    existing ? programDefToForm(existing) : defaultProgramForm(),
  )
  const [saveError, setSaveError] = useState<string | null>(null)

  const createMutation = useCreateProgram({
    onSuccess: () => navigate('/programs'),
  })
  const updateMutation = useUpdateProgram({
    onSuccess: () => navigate('/programs'),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  function updateMicrocycle(index: number, updated: MicrocycleForm) {
    const microcycles = form.microcycles.map((mc, i) => (i === index ? updated : mc))
    setForm({ ...form, microcycles })
  }

  function removeMicrocycle(index: number) {
    setForm({ ...form, microcycles: form.microcycles.filter((_, i) => i !== index) })
  }

  function moveMicrocycle(index: number, dir: 'up' | 'down') {
    const mcs = [...form.microcycles]
    const swap = dir === 'up' ? index - 1 : index + 1
    ;[mcs[index], mcs[swap]] = [mcs[swap], mcs[index]]
    setForm({ ...form, microcycles: mcs })
  }

  function invertMicrocycle(index: number) {
    const source = form.microcycles[index]
    const inverted = invertMicrocycleForm(source)
    const mcs = [...form.microcycles.slice(0, index + 1), inverted, ...form.microcycles.slice(index + 1)]
    setForm({ ...form, microcycles: mcs })
  }

  async function handleSave() {
    setSaveError(null)
    const input = formToServiceInput(form)
    try {
      if (existing) {
        await updateMutation.mutateAsync({ id: existing.id as string, input })
      } else {
        await createMutation.mutateAsync(input)
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Container size="sm" py="md">
      <Stack>
        <Group justify="space-between" align="center">
          <Title order={2}>{existing ? 'Edit program' : 'New program'}</Title>
          <Button variant="subtle" onClick={() => navigate('/programs')}>
            Cancel
          </Button>
        </Group>

        <TextInput
          label="Program name"
          placeholder="e.g. 5-day upper/lower"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.currentTarget.value })}
          required
        />

        {form.microcycles.map((mc, i) => (
          <MicrocycleEditor
            key={mc.id}
            mc={mc}
            mcLabel={mc.label || `Microcycle ${i + 1}`}
            isFirst={i === 0}
            isLast={i === form.microcycles.length - 1}
            onChange={updated => updateMicrocycle(i, updated)}
            onRemove={() => removeMicrocycle(i)}
            onMoveUp={() => moveMicrocycle(i, 'up')}
            onMoveDown={() => moveMicrocycle(i, 'down')}
            onInvert={() => invertMicrocycle(i)}
          />
        ))}

        <Button
          variant="outline"
          onClick={() => setForm({ ...form, microcycles: [...form.microcycles, defaultMicrocycle()] })}
        >
          Add microcycle
        </Button>

        {saveError && <Alert color="red">{saveError}</Alert>}

        <Group justify="flex-end">
          <Button
            loading={isPending}
            onClick={handleSave}
            disabled={!isFormValid(form)}
          >
            {existing ? 'Save changes' : 'Create program'}
          </Button>
        </Group>
      </Stack>
    </Container>
  )
}

// New program route: /programs/new
export function ProgramNewPage() {
  return <ProgramEditForm />
}

// Edit program route: /programs/:id/edit
export function ProgramEditPage() {
  const { id } = useParams<{ id: string }>()
  const { data: program, isLoading, error } = useProgramDetail(id!)

  if (isLoading) {
    return (
      <Container size="sm" py="md">
        <Loader mx="auto" />
      </Container>
    )
  }
  if (error || !program) {
    return (
      <Container size="sm" py="md">
        <Alert color="red">{error?.message ?? 'Program not found'}</Alert>
      </Container>
    )
  }

  return <ProgramEditForm existing={program} />
}
