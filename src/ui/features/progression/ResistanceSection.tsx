import { ActionIcon, Badge, Button, Group, NumberInput, Stack, Text } from '@mantine/core'
import { IconPlus, IconX } from '@tabler/icons-react'
import { useState } from 'react'
import type { EquipmentDef, VolumeSetInput } from '../../../domain'
import { ChipList } from './ChipList'
import { newConfigId, resistanceTotal, sourceKey, type ResistanceConfig } from './SaveProgressionModal'

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: resistance section variants
// ─────────────────────────────────────────────────────────────────────────────

export function NoEquipmentResistance({
  configs,
  onChange,
  readOnly,
}: {
  configs: ResistanceConfig[]
  onChange: (configs: ResistanceConfig[]) => void
  readOnly?: boolean
}) {
  // Implicit "Unloaded" config (empty source) is always present and not removable.
  // Additional configs are ad-hoc resistance entries (pieceId omitted — no parent piece).
  const weighted = configs.filter(c => c.source.length > 0)
  const values = weighted.map(c => c.source[0]!.piece.resistance)

  function handleAdd(v: number) {
    if (weighted.some(c => c.source[0]!.piece.resistance === v)) return
    onChange([
      ...configs,
      {
        id: newConfigId(),
        label: `+${v}`,
        source: [{ piece: { resistance: v, totalQuantity: 1 }, quantityUsed: 1 }],
      },
    ])
  }

  function handleRemove(v: number) {
    onChange(configs.filter(c => c.source.length === 0 || c.source[0]!.piece.resistance !== v))
  }

  return (
    <Stack gap="xs">
      <Group gap="xs" align="center">
        <Badge variant="filled">Unloaded</Badge>
        <Text size="xs" c="dimmed">+ optional resistance</Text>
      </Group>
      <ChipList
        values={values}
        onAdd={handleAdd}
        onRemove={handleRemove}
        inputMin={1}
        inputStep={1}
        placeholder="e.g. 10"
        readOnly={readOnly}
      />
    </Stack>
  )
}

export function NonCombinableResistance({
  equipment,
  configs,
  onChange,
  readOnly,
}: {
  equipment: EquipmentDef
  configs: ResistanceConfig[]
  onChange: (configs: ResistanceConfig[]) => void
  readOnly?: boolean
}) {
  const checkedPieceIds = new Set(configs.map(c => c.source[0]?.piece.pieceId ?? ''))

  function toggle(piece: typeof equipment.pieces[number]) {
    if (readOnly) return
    const pieceId = piece.id as string
    if (checkedPieceIds.has(pieceId)) {
      onChange(configs.filter(c => c.source[0]?.piece.pieceId !== pieceId))
    } else {
      const id = newConfigId()
      const qty = piece.quantity as number
      const label = `${piece.resistance as number}${equipment.unit}${qty > 1 ? ` ×${qty}` : ''}`
      onChange([
        ...configs,
        {
          id,
          label,
          source: [{
            piece: { pieceId, resistance: piece.resistance as number, totalQuantity: qty },
            quantityUsed: qty,
          }],
        },
      ])
    }
  }

  return (
    <Group gap="xs" wrap="wrap">
      {equipment.pieces.map(piece => {
        const pieceId = piece.id as string
        const qty = piece.quantity as number
        const label = `${piece.resistance as number}${equipment.unit}${qty > 1 ? ` ×${qty}` : ''}`
        const selected = checkedPieceIds.has(pieceId)
        return (
          <Button
            key={pieceId}
            size="xs"
            variant={selected ? 'filled' : 'light'}
            onClick={() => toggle(piece)}
            disabled={readOnly && !selected}
            style={readOnly ? { cursor: 'default' } : undefined}
          >
            {label}
          </Button>
        )
      })}
    </Group>
  )
}

type CombinableResistanceProps = {
  equipment: EquipmentDef
  configs: ResistanceConfig[]
  onChange: (configs: ResistanceConfig[]) => void
  readOnly?: boolean
}

export function CombinableResistance({ equipment, configs, onChange, readOnly }: CombinableResistanceProps) {
  type DraftQty = { pieceId: string; qty: number }
  const [draftOpen, setDraftOpen] = useState(false)
  const [draftQtys, setDraftQtys] = useState<DraftQty[]>([])
  const [draftError, setDraftError] = useState<string | null>(null)

  function openDraft() {
    setDraftQtys(equipment.pieces.map(p => ({ pieceId: p.id as string, qty: 0 })))
    setDraftError(null)
    setDraftOpen(true)
  }

  function cancelDraft() { setDraftError(null); setDraftOpen(false) }

  function draftTotal(): number {
    return draftQtys.reduce((sum, d) => {
      const piece = equipment.pieces.find(p => (p.id as string) === d.pieceId)
      return sum + (piece ? (piece.resistance as number) * d.qty : 0)
    }, 0)
  }

  function confirmDraft() {
    const source: VolumeSetInput['resistanceSource'] = draftQtys
      .filter(d => d.qty > 0)
      .map(d => {
        const piece = equipment.pieces.find(p => (p.id as string) === d.pieceId)!
        return {
          piece: {
            pieceId: d.pieceId,
            resistance: piece.resistance as number,
            totalQuantity: piece.quantity as number,
          },
          quantityUsed: d.qty,
        }
      })
    if (source.length === 0) return
    const key = sourceKey(source)
    if (configs.some(c => sourceKey(c.source) === key)) {
      setDraftError('Configuration already added')
      return
    }
    const total = resistanceTotal(source)
    const id = newConfigId()
    onChange([...configs, { id, label: `${total}${equipment.unit}`, source }])
    setDraftError(null)
    setDraftOpen(false)
  }

  function removeConfig(id: string) { onChange(configs.filter(c => c.id !== id)) }

  return (
    <Stack gap="sm">
      <Group gap="xs" wrap="wrap">
        {configs.map(c => (
          <Badge
            key={c.id}
            variant="light"
            rightSection={
              readOnly ? undefined : (
                <ActionIcon size="xs" variant="transparent" onClick={() => removeConfig(c.id)} aria-label={`Remove ${c.label}`}>
                  <IconX size={10} />
                </ActionIcon>
              )
            }
          >
            {c.label}
          </Badge>
        ))}
      </Group>

      {!readOnly && (draftOpen ? (
        <Stack gap="xs" p="sm" style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 8 }}>
          <Text size="sm" fw={500}>New configuration</Text>
          {equipment.pieces.map(piece => {
            const pieceId = piece.id as string
            const max = piece.quantity as number
            const d = draftQtys.find(d => d.pieceId === pieceId)
            return (
              <Group key={pieceId} justify="space-between" align="center">
                <Text size="sm">{piece.resistance as number}{equipment.unit}</Text>
                <NumberInput
                  value={d?.qty ?? 0}
                  min={0}
                  max={max}
                  step={1}
                  allowDecimal={false}
                  style={{ width: 90 }}
                  onChange={v => {
                    const n = Math.min(Number(v) || 0, max)
                    setDraftQtys(prev => prev.map(x => x.pieceId === pieceId ? { ...x, qty: n } : x))
                  }}
                />
              </Group>
            )
          })}
          <Text size="xs" c="dimmed">Total: {draftTotal()}{equipment.unit}</Text>
          {draftError && <Text size="xs" c="red">{draftError}</Text>}
          <Group gap="xs">
            <Button size="xs" onClick={confirmDraft} disabled={draftTotal() === 0}>Add</Button>
            <Button size="xs" variant="subtle" onClick={cancelDraft}>Cancel</Button>
          </Group>
        </Stack>
      ) : (
        <Button
          variant="light"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={openDraft}
          style={{ alignSelf: 'flex-start' }}
        >
          Add configuration
        </Button>
      ))}
    </Stack>
  )
}
