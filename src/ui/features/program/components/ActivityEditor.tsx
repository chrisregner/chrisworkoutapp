import {
  ActionIcon,
  Alert,
  Group,
  NumberInput,
  Radio,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { IconChevronDown, IconChevronUp, IconTrash } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useDefinitions } from '../../../providers/AppServicesProvider'
import { exerciseQueries } from '../../exercise/exerciseKeys'
import { progressionQueries } from '../../progression/progressionKeys'
import type { ActivityForm } from '../programFormTypes'

type Props = {
  activity: ActivityForm
  isFirst: boolean
  isLast: boolean
  onChange: (updated: ActivityForm) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

export function ActivityEditor({
  activity,
  isFirst,
  isLast,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: Props) {
  const definitions = useDefinitions()
  const { data: exercises = [] } = useQuery(exerciseQueries.list(definitions))

  const exerciseId = activity.kind === 'exercise' ? activity.exerciseId : ''
  const { data: progressions = [] } = useQuery({
    ...progressionQueries.byExercise(definitions, exerciseId),
    enabled: !!exerciseId,
  })

  const progressionOptions = [
    { value: '', label: 'None (freestyle)' },
    ...progressions.map(p => ({ value: p.id as string, label: p.name })),
  ]

  const exerciseOptions = exercises.map(e => ({ value: e.id as string, label: e.name }))

  const selectedProgression =
    activity.kind === 'exercise' && activity.progressionId
      ? progressions.find(p => (p.id as string) === activity.progressionId)
      : undefined

  const isHL = selectedProgression?.body.kind === 'heavyLight'

  const controls = (
    <Group gap={4} wrap="nowrap">
      <ActionIcon
        variant="subtle"
        size="sm"
        onClick={onMoveUp}
        disabled={isFirst}
        aria-label="Move activity up"
      >
        <IconChevronUp size={14} />
      </ActionIcon>
      <ActionIcon
        variant="subtle"
        size="sm"
        onClick={onMoveDown}
        disabled={isLast}
        aria-label="Move activity down"
      >
        <IconChevronDown size={14} />
      </ActionIcon>
      <ActionIcon
        variant="subtle"
        size="sm"
        color="red"
        onClick={onRemove}
        aria-label="Remove activity"
      >
        <IconTrash size={14} />
      </ActionIcon>
    </Group>
  )

  if (activity.kind === 'rest') {
    return (
      <Stack gap="xs" p="xs" style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 8 }}>
        <Group justify="space-between" align="center">
          <Text size="xs" fw={500} c="dimmed">REST</Text>
          {controls}
        </Group>
        <Group grow>
          <NumberInput
            label="Duration (seconds)"
            size="xs"
            min={1}
            value={Number(activity.durationSeconds) || ''}
            onChange={v =>
              onChange({ ...activity, durationSeconds: String(v ?? '') })
            }
            error={!activity.durationSeconds ? 'Required' : undefined}
          />
          <TextInput
            label="Label (optional)"
            size="xs"
            placeholder="e.g. Between sets"
            value={activity.label}
            onChange={e => onChange({ ...activity, label: e.currentTarget.value })}
          />
        </Group>
      </Stack>
    )
  }

  // exercise slot
  const ex = activity

  function handleExerciseChange(newExerciseId: string | null) {
    onChange({
      ...ex,
      exerciseId: newExerciseId ?? '',
      progressionId: '',
      hlPick: '',
    })
  }

  function handleProgressionChange(newProgressionId: string | null) {
    const val = newProgressionId ?? ''
    const newProg = progressions.find(p => (p.id as string) === val)
    const newIsHL = newProg?.body.kind === 'heavyLight'
    onChange({
      ...ex,
      progressionId: val,
      hlPick: newIsHL ? ex.hlPick : '',
    })
  }

  return (
    <Stack gap="xs" p="xs" style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 8 }}>
      <Group justify="space-between" align="center">
        <Text size="xs" fw={500} c="dimmed">EXERCISE</Text>
        {controls}
      </Group>

      <Group grow>
        <Select
          label="Exercise"
          size="xs"
          placeholder="Pick exercise"
          data={exerciseOptions}
          value={ex.exerciseId || null}
          onChange={handleExerciseChange}
          searchable
        />
        <Select
          label="Role"
          size="xs"
          data={[
            { value: 'warmup', label: 'Warmup' },
            { value: 'main', label: 'Main' },
            { value: 'cooldown', label: 'Cooldown' },
          ]}
          value={ex.role}
          onChange={v => onChange({ ...ex, role: (v ?? 'main') as typeof ex.role })}
        />
      </Group>

      {ex.exerciseId && (
        <Select
          label="Progression"
          size="xs"
          data={progressionOptions}
          value={ex.progressionId || null}
          onChange={handleProgressionChange}
          placeholder="None (freestyle)"
          clearable
        />
      )}

      {isHL && (
        <Radio.Group
          label="Heavy/Light pick"
          value={ex.hlPick}
          onChange={v => onChange({ ...ex, hlPick: v as '' | 'heavy' | 'light' })}
        >
          <Group mt={4}>
            <Radio value="heavy" label="Heavy" size="xs" />
            <Radio value="light" label="Light" size="xs" />
          </Group>
        </Radio.Group>
      )}

      {!ex.exerciseId && (
        <Alert color="red" variant="light" py={4} px="xs">
          <Text size="xs">Exercise required.</Text>
        </Alert>
      )}

      {isHL && !ex.hlPick && (
        <Alert color="red" variant="light" py={4} px="xs">
          <Text size="xs">Heavy/Light pick required for this progression.</Text>
        </Alert>
      )}

      {ex.exerciseId && !ex.progressionId && (
        <Stack gap="xs">
          <Text size="xs" c="dimmed" fw={500}>Freestyle sets</Text>
          <Group grow>
            <NumberInput
              label="Sets"
              size="xs"
              min={1}
              value={Number(ex.fallbackSets) || ''}
              onChange={v => onChange({ ...ex, fallbackSets: String(v ?? '') })}
              error={!ex.fallbackSets ? 'Required' : undefined}
            />
            <NumberInput
              label="Reps / seconds"
              size="xs"
              min={1}
              value={Number(ex.fallbackQuantifierValue) || ''}
              onChange={v => onChange({ ...ex, fallbackQuantifierValue: String(v ?? '') })}
              error={!ex.fallbackQuantifierValue ? 'Required' : undefined}
            />
            <NumberInput
              label="Rest between sets (s)"
              size="xs"
              min={1}
              value={Number(ex.fallbackRestBetweenSets) || ''}
              onChange={v => onChange({ ...ex, fallbackRestBetweenSets: String(v ?? '') })}
              placeholder="None"
            />
          </Group>
        </Stack>
      )}
    </Stack>
  )
}
