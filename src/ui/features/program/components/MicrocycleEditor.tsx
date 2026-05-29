import {
  ActionIcon,
  Button,
  Collapse,
  Group,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconChevronDown, IconChevronUp, IconPlus, IconTrash } from '@tabler/icons-react'
import { DayEditor } from './DayEditor'
import type { DayForm, MicrocycleForm } from '../programFormTypes'
import { defaultDay, invertDayForm } from '../programFormTypes'

type Props = {
  mc: MicrocycleForm
  mcLabel: string
  isFirst: boolean
  isLast: boolean
  onChange: (updated: MicrocycleForm) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onInvert: () => void
}

export function MicrocycleEditor({
  mc,
  mcLabel,
  isFirst,
  isLast,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  onInvert,
}: Props) {
  const [expanded, { toggle }] = useDisclosure(true)

  function updateDay(index: number, updated: DayForm) {
    const days = mc.days.map((d, i) => (i === index ? updated : d))
    onChange({ ...mc, days })
  }

  function removeDay(index: number) {
    onChange({ ...mc, days: mc.days.filter((_, i) => i !== index) })
  }

  function moveDay(index: number, dir: 'up' | 'down') {
    const days = [...mc.days]
    const swap = dir === 'up' ? index - 1 : index + 1
    ;[days[index], days[swap]] = [days[swap], days[index]]
    onChange({ ...mc, days })
  }

  function invertDay(index: number) {
    const source = mc.days[index]
    const inverted = invertDayForm(source)
    const days = [...mc.days.slice(0, index + 1), inverted, ...mc.days.slice(index + 1)]
    onChange({ ...mc, days })
  }

  return (
    <Stack gap="xs" p="sm" style={{ border: '2px solid var(--mantine-color-default-border)', borderRadius: 8 }}>
      <Group justify="space-between" align="center">
        <UnstyledButton onClick={toggle} style={{ flex: 1 }}>
          <Group gap="xs">
            <Text fw={700} size="sm">{mcLabel}</Text>
            {expanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
          </Group>
        </UnstyledButton>
        <Group gap={4} wrap="nowrap">
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label="Move microcycle up"
          >
            <IconChevronUp size={14} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label="Move microcycle down"
          >
            <IconChevronDown size={14} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            size="sm"
            color="red"
            onClick={onRemove}
            aria-label="Remove microcycle"
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      </Group>

      <Collapse in={expanded}>
        <Stack gap="sm">
          <TextInput
            label="Label (optional)"
            size="xs"
            placeholder='e.g. "Heavy" or "Deload"'
            value={mc.label}
            onChange={e => onChange({ ...mc, label: e.currentTarget.value })}
          />

          {mc.days.map((day, i) => (
            <DayEditor
              key={day.id}
              day={day}
              dayLabel={`Day ${i + 1}`}
              isFirst={i === 0}
              isLast={i === mc.days.length - 1}
              onChange={updated => updateDay(i, updated)}
              onRemove={() => removeDay(i)}
              onMoveUp={() => moveDay(i, 'up')}
              onMoveDown={() => moveDay(i, 'down')}
              onInvert={() => invertDay(i)}
            />
          ))}

          <Group gap="xs">
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconPlus size={12} />}
              onClick={() => onChange({ ...mc, days: [...mc.days, defaultDay()] })}
            >
              Add day
            </Button>
            <Button variant="subtle" size="xs" onClick={onInvert}>
              Invert microcycle
            </Button>
          </Group>
        </Stack>
      </Collapse>
    </Stack>
  )
}
