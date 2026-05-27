import { ActionIcon, Group, Stack, Text } from '@mantine/core'
import { IconArrowDown, IconArrowUp, IconChevronDown, IconChevronUp } from '@tabler/icons-react'
import type { SortEntry } from './SaveProgressionModal'

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: sort priority control
// ─────────────────────────────────────────────────────────────────────────────

export function SortPriorityControl({
  sortOrder,
  onChange,
  readOnly,
}: {
  sortOrder: [SortEntry, SortEntry, SortEntry]
  onChange: (order: [SortEntry, SortEntry, SortEntry]) => void
  readOnly?: boolean
}) {
  function move(idx: number, delta: -1 | 1) {
    const next: [SortEntry, SortEntry, SortEntry] = [...sortOrder]
    const target = idx + delta
    if (target < 0 || target > 2) return
    ;[next[idx], next[target]] = [next[target]!, next[idx]!]
    onChange(next)
  }

  function toggleDir(idx: number) {
    const next: [SortEntry, SortEntry, SortEntry] = [...sortOrder]
    next[idx] = { ...next[idx]!, dir: next[idx]!.dir === 'asc' ? 'desc' : 'asc' }
    onChange(next)
  }

  return (
    <Stack gap={4}>
      {sortOrder.map((entry, idx) => (
        <Group key={entry.dim} gap="xs" align="center" wrap="nowrap"
          style={{ padding: '6px 8px', borderRadius: 6, background: 'var(--mantine-color-default-hover)' }}
        >
          <Text size="sm" c="dimmed" w={20} ta="right">{idx + 1}.</Text>
          <Text size="sm" style={{ flex: 1 }}>{entry.dim}</Text>
          <ActionIcon
            size="sm"
            variant={readOnly ? 'transparent' : 'subtle'}
            disabled={readOnly}
            onClick={() => toggleDir(idx)}
            title={entry.dir === 'asc' ? 'Ascending (click to flip)' : 'Descending (click to flip)'}
          >
            {entry.dir === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />}
          </ActionIcon>
          {!readOnly && (
            <>
              <ActionIcon size="sm" variant="subtle" onClick={() => move(idx, -1)} disabled={idx === 0}>
                <IconChevronUp size={14} />
              </ActionIcon>
              <ActionIcon size="sm" variant="subtle" onClick={() => move(idx, 1)} disabled={idx === 2}>
                <IconChevronDown size={14} />
              </ActionIcon>
            </>
          )}
        </Group>
      ))}
    </Stack>
  )
}
