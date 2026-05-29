import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { IconChevronDown, IconChevronUp, IconPlus, IconTrash } from '@tabler/icons-react'
import { ActivityEditor } from './ActivityEditor'
import type { ActivityForm, DayForm } from '../programFormTypes'
import { defaultExerciseActivity, defaultRestActivity } from '../programFormTypes'

type Props = {
  day: DayForm
  dayLabel: string
  isFirst: boolean
  isLast: boolean
  onChange: (updated: DayForm) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onInvert: () => void
}

export function DayEditor({
  day,
  dayLabel,
  isFirst,
  isLast,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  onInvert,
}: Props) {
  const hasNoExercise = !day.activities.some(a => a.kind === 'exercise')

  function updateActivity(index: number, updated: ActivityForm) {
    const activities = day.activities.map((a, i) => (i === index ? updated : a))
    onChange({ ...day, activities })
  }

  function removeActivity(index: number) {
    onChange({ ...day, activities: day.activities.filter((_, i) => i !== index) })
  }

  function moveActivity(index: number, dir: 'up' | 'down') {
    const acts = [...day.activities]
    const swap = dir === 'up' ? index - 1 : index + 1
    ;[acts[index], acts[swap]] = [acts[swap], acts[index]]
    onChange({ ...day, activities: acts })
  }

  return (
    <Stack gap="xs" p="sm" style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 8 }}>
      <Group justify="space-between" align="center">
        <Text size="sm" fw={600}>{dayLabel}</Text>
        <Group gap={4} wrap="nowrap">
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label="Move day up"
          >
            <IconChevronUp size={14} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label="Move day down"
          >
            <IconChevronDown size={14} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            size="sm"
            color="red"
            onClick={onRemove}
            aria-label="Remove day"
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      </Group>

      <TextInput
        label="Label (optional)"
        size="xs"
        placeholder={`e.g. Heavy ${dayLabel}`}
        value={day.label}
        onChange={e => onChange({ ...day, label: e.currentTarget.value })}
      />

      {hasNoExercise && (
        <Alert color="yellow" variant="light" py={4} px="xs">
          <Text size="xs">Day must contain at least one exercise slot.</Text>
        </Alert>
      )}

      {day.activities.map((act, i) => (
        <ActivityEditor
          key={act._key}
          activity={act}
          isFirst={i === 0}
          isLast={i === day.activities.length - 1}
          onChange={updated => updateActivity(i, updated)}
          onRemove={() => removeActivity(i)}
          onMoveUp={() => moveActivity(i, 'up')}
          onMoveDown={() => moveActivity(i, 'down')}
        />
      ))}

      <Group gap="xs">
        <Button
          variant="subtle"
          size="xs"
          leftSection={<IconPlus size={12} />}
          onClick={() =>
            onChange({ ...day, activities: [...day.activities, defaultExerciseActivity()] })
          }
        >
          Add exercise
        </Button>
        <Button
          variant="subtle"
          size="xs"
          leftSection={<IconPlus size={12} />}
          onClick={() =>
            onChange({ ...day, activities: [...day.activities, defaultRestActivity()] })
          }
        >
          Add rest
        </Button>
        <Button variant="subtle" size="xs" onClick={onInvert}>
          Invert day
        </Button>
      </Group>
    </Stack>
  )
}
