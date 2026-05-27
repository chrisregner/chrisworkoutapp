/**
 * DeleteEquipmentModal — user-observable behaviors
 *
 * - when equipment prop is null, no dialog is shown
 * - when equipment is provided, shows the equipment name and a "cannot be undone" warning
 * - when user clicks "Cancel", onClose fires and equipment is NOT deleted
 * - when user clicks "Delete", equipment is removed from persistence and onClose fires
 * - when equipment is in use by an exercise, delete fails and error alert is shown (modal stays open, equipment NOT deleted)
 */
import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../../testing/renderWithProviders'
import { makeTestDb } from '../../../../persistence/testing'
import { DefinitionsService } from '../../../../app'
import { listEquipmentDefs } from '../../../../persistence/repositories'
import { DeleteEquipmentModal } from '../DeleteEquipmentModal'
import type { EquipmentDef } from '../../../../domain'

async function seedEquipment(
  db: Awaited<ReturnType<typeof makeTestDb>>,
  name = 'Kettlebell',
): Promise<EquipmentDef> {
  const service = new DefinitionsService(db)
  return service.createEquipment({
    name,
    isCombinable: false,
    unit: 'kg',
    pieces: [{ resistance: 12, quantity: 1, position: 0 }],
  })
}

describe('DeleteEquipmentModal', () => {
  it('renders no dialog when equipment prop is null', async () => {
    await renderWithProviders(
      <DeleteEquipmentModal equipment={null} onClose={() => {}} />,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows the equipment name and a "cannot be undone" warning when equipment is provided', async () => {
    const db = await makeTestDb()
    const eq = await seedEquipment(db, 'Sandbag')

    await renderWithProviders(
      <DeleteEquipmentModal equipment={eq} onClose={() => {}} />,
      { db },
    )

    const dialog = await screen.findByRole('dialog', { name: /delete equipment/i })
    expect(within(dialog).getByText('Sandbag')).toBeInTheDocument()
    expect(within(dialog).getByText(/cannot be undone/i)).toBeInTheDocument()
  })

  it('clicking "Cancel" fires onClose and does NOT delete the equipment', async () => {
    const db = await makeTestDb()
    const eq = await seedEquipment(db)
    let closed = false

    const { user } = await renderWithProviders(
      <DeleteEquipmentModal
        equipment={eq}
        onClose={() => { closed = true }}
      />,
      { db },
    )

    const dialog = await screen.findByRole('dialog', { name: /delete equipment/i })
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }))

    expect(closed).toBe(true)
    expect(await listEquipmentDefs(db)).toHaveLength(1)
  })

  it('clicking "Delete" removes the equipment from persistence and fires onClose', async () => {
    const db = await makeTestDb()
    const eq = await seedEquipment(db)
    let closed = false

    const { user } = await renderWithProviders(
      <DeleteEquipmentModal
        equipment={eq}
        onClose={() => { closed = true }}
      />,
      { db },
    )

    const dialog = await screen.findByRole('dialog', { name: /delete equipment/i })
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }))

    await expect.poll(async () => (await listEquipmentDefs(db)).length).toBe(0)
    await expect.poll(() => closed).toBe(true)
  })

  it('shows an error alert and keeps equipment when delete fails (equipment in use by exercise)', async () => {
    const db = await makeTestDb()
    const service = new DefinitionsService(db)
    const eq = await seedEquipment(db, 'In-use bell')
    await service.createExercise({
      name: 'Press',
      quantifierType: 'reps',
      equipmentId: eq.id as string,
      shouldCombineResistance: false,
    })
    let closed = false

    const { user } = await renderWithProviders(
      <DeleteEquipmentModal
        equipment={eq}
        onClose={() => { closed = true }}
      />,
      { db },
    )

    const dialog = await screen.findByRole('dialog', { name: /delete equipment/i })
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }))

    expect(
      await within(dialog).findByText(/used by 1 exercise/i),
    ).toBeInTheDocument()
    expect(closed).toBe(false)
    expect(await listEquipmentDefs(db)).toHaveLength(1)
  })
})
