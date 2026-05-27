import { ActionIcon, Badge, Button, Group, NumberInput, Stack, Text } from '@mantine/core'
import { IconPlus, IconX } from '@tabler/icons-react'
import { useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: chip list with single + range add
// ─────────────────────────────────────────────────────────────────────────────

export function ChipList({
  values,
  onAdd,
  onRemove,
  inputMin,
  inputStep,
  placeholder,
  validate,
  validationError,
  readOnly,
}: {
  values: number[]
  onAdd: (v: number) => void
  onRemove: (v: number) => void
  inputMin: number
  inputStep: number
  placeholder: string
  validate?: (v: number) => string | null
  validationError?: string | null
  readOnly?: boolean
}) {
  const [rangeMode, setRangeMode] = useState(false)
  const [draft, setDraft] = useState<number | string>('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [rangeMin, setRangeMin] = useState<number | string>('')
  const [rangeMax, setRangeMax] = useState<number | string>('')
  const [rangeStep, setRangeStep] = useState<number | string>(1)

  const error = validationError ?? localError

  function validateSingle(n: number): string | null {
    if (!Number.isInteger(n) || n < inputMin) return `Must be a whole number ≥ ${inputMin}`
    if (values.includes(n)) return 'Already added'
    return validate ? validate(n) : null
  }

  function handleAdd() {
    const n = Number(draft)
    if (!draft || isNaN(n)) { setLocalError(`Must be a whole number ≥ ${inputMin}`); return }
    const err = validateSingle(n)
    if (err) { setLocalError(err); return }
    setLocalError(null)
    onAdd(n)
    setDraft('')
  }

  function handleAddRange() {
    const mn = Number(rangeMin)
    const mx = Number(rangeMax)
    const st = Number(rangeStep)
    if (!rangeMin || !rangeMax || !rangeStep || isNaN(mn) || isNaN(mx) || isNaN(st) || st < 1 || mn > mx) {
      setLocalError('Invalid range: check min ≤ max and step ≥ 1')
      return
    }
    setLocalError(null)
    for (let v = mn; v <= mx; v += st) {
      const rounded = Math.round(v)
      if (values.includes(rounded)) continue
      if (validate && validate(rounded)) continue
      onAdd(rounded)
    }
    setRangeMin('')
    setRangeMax('')
    setRangeStep(1)
    setRangeMode(false)
  }

  return (
    <Stack gap="xs">
      <Group gap="xs" wrap="wrap">
        {values.map(v => (
          <Badge
            key={v}
            variant="light"
            rightSection={
              readOnly ? undefined : (
                <ActionIcon size="xs" variant="transparent" onClick={() => onRemove(v)} aria-label={`Remove ${v}`}>
                  <IconX size={10} />
                </ActionIcon>
              )
            }
          >
            {v}
          </Badge>
        ))}
      </Group>

      {!readOnly && !rangeMode && (
        <Group gap="xs" align="flex-end" wrap="nowrap">
          <NumberInput
            placeholder={placeholder}
            value={draft}
            onChange={v => { setDraft(v); setLocalError(null) }}
            min={inputMin}
            step={inputStep}
            allowDecimal={false}
            style={{ width: 100 }}
            error={error ?? undefined}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
          />
          <Button variant="light" size="xs" leftSection={<IconPlus size={14} />} onClick={handleAdd} mb={error ? 22 : 0}>
            Add
          </Button>
          <Button variant="subtle" size="xs" onClick={() => setRangeMode(true)} mb={error ? 22 : 0}>
            Range
          </Button>
        </Group>
      )}

      {!readOnly && rangeMode && (
        <Stack gap="xs" p="sm" style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 8 }}>
          <Text size="sm" fw={500}>Add range</Text>
          <Group gap="xs" wrap="wrap">
            <NumberInput
              label="Min"
              value={rangeMin}
              onChange={v => { setRangeMin(v); setLocalError(null) }}
              min={inputMin}
              allowDecimal={false}
              style={{ width: 80 }}
            />
            <NumberInput
              label="Max"
              value={rangeMax}
              onChange={v => { setRangeMax(v); setLocalError(null) }}
              min={inputMin}
              allowDecimal={false}
              style={{ width: 80 }}
            />
            <NumberInput
              label="Step"
              value={rangeStep}
              onChange={v => { setRangeStep(v); setLocalError(null) }}
              min={1}
              allowDecimal={false}
              style={{ width: 80 }}
            />
          </Group>
          {localError && <Text size="xs" c="red">{localError}</Text>}
          <Group gap="xs">
            <Button size="xs" onClick={handleAddRange}>Add Range</Button>
            <Button size="xs" variant="subtle" onClick={() => { setRangeMode(false); setLocalError(null) }}>Cancel</Button>
          </Group>
        </Stack>
      )}
    </Stack>
  )
}
