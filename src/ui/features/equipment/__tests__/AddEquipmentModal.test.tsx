/**
 * AddEquipmentModal — user-observable behaviors
 *
 * Add mode:
 * - when opened with no equipment prop, renders blank form with default unit kg and one empty piece row
 * - when user submits with empty name, shows "Name required" validation error and does not persist
 * - when user submits invalid piece resistance, shows "Must be > 0" validation error
 * - when user submits a valid form, persists the equipment and closes the modal
 * - when user clicks "Add weight", a new piece row appears
 *
 * Edit mode:
 * - when opened with an existing equipment, prefills name, unit, and piece rows
 * - when user edits and saves, persists changes via update (name reflects new value)
 * - when user edits an existing equipment, original piece ids are preserved on update
 */
import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../../testing/renderWithProviders'
import { makeTestDb } from '../../../../persistence/testing'
import { DefinitionsService } from '../../../../app'
import { listEquipmentDefs } from '../../../../persistence/repositories'
import { AddEquipmentModal } from '../AddEquipmentModal'
import type { EquipmentDef } from '../../../../domain'

async function seedEquipment(
  db: Awaited<ReturnType<typeof makeTestDb>>,
): Promise<EquipmentDef> {
  const service = new DefinitionsService(db)
  return service.createEquipment({
    name: 'Kettlebell',
    isCombinable: false,
    unit: 'kg',
    pieces: [
      { resistance: 12, quantity: 1, position: 0 },
      { resistance: 16, quantity: 1, position: 1 },
    ],
  })
}

describe('AddEquipmentModal — add mode', () => {
  it('renders blank form with default unit kg and one empty piece row', async () => {
    await renderWithProviders(<AddEquipmentModal opened onClose={() => {}} />)

    const dialog = await screen.findByRole('dialog', { name: /add equipment/i })
    const nameInput = within(dialog).getByLabelText(/name/i) as HTMLInputElement
    expect(nameInput.value).toBe('')

    // Only one weight row (label "Weight (kg)" only renders for first row)
    expect(within(dialog).getByLabelText(/weight \(kg\)/i)).toBeInTheDocument()
  })

  it('shows "Name required" validation error when submitting with empty name and does not persist', async () => {
    const db = await makeTestDb()
    const { user } = await renderWithProviders(
      <AddEquipmentModal opened onClose={() => {}} />,
      { db },
    )

    const dialog = await screen.findByRole('dialog', { name: /add equipment/i })

    // Provide a valid weight so only the name is invalid
    const weight = within(dialog).getByLabelText(/weight \(kg\)/i)
    await user.clear(weight)
    await user.type(weight, '10')

    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    expect(await within(dialog).findByText(/name required/i)).toBeInTheDocument()
    expect(await listEquipmentDefs(db)).toHaveLength(0)
  })

  it('shows "Must be > 0" validation error when piece resistance is zero or empty', async () => {
    const { user } = await renderWithProviders(
      <AddEquipmentModal opened onClose={() => {}} />,
    )

    const dialog = await screen.findByRole('dialog', { name: /add equipment/i })
    await user.type(within(dialog).getByLabelText(/name/i), 'Kettlebell')
    // Leave the resistance field blank then save
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    expect(await within(dialog).findByText(/must be > 0/i)).toBeInTheDocument()
  })

  it('persists the equipment and closes the modal on valid submit', async () => {
    const db = await makeTestDb()
    let closed = false
    const { user } = await renderWithProviders(
      <AddEquipmentModal opened onClose={() => { closed = true }} />,
      { db },
    )

    const dialog = await screen.findByRole('dialog', { name: /add equipment/i })
    await user.type(within(dialog).getByLabelText(/name/i), 'Barbell')
    const weight = within(dialog).getByLabelText(/weight \(kg\)/i)
    await user.clear(weight)
    await user.type(weight, '20')

    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    // Wait until the row lands in the DB
    await expect.poll(async () => (await listEquipmentDefs(db)).length).toBe(1)
    const [saved] = await listEquipmentDefs(db)
    expect(saved.name).toBe('Barbell')
    expect(saved.pieces).toHaveLength(1)
    expect(saved.pieces[0].resistance).toBe(20)

    await expect.poll(() => closed).toBe(true)
  })

  it('clicking "Add weight" appends a new piece row', async () => {
    const { user } = await renderWithProviders(
      <AddEquipmentModal opened onClose={() => {}} />,
    )

    const dialog = await screen.findByRole('dialog', { name: /add equipment/i })

    // Initially one NumberInput for weight (only first row is labelled)
    expect(within(dialog).getAllByRole('textbox').length).toBeGreaterThan(0)
    const initialSpinButtons = within(dialog).getAllByRole('textbox').filter(
      el => (el as HTMLInputElement).inputMode === 'decimal' || (el as HTMLInputElement).inputMode === 'numeric',
    )

    await user.click(within(dialog).getByRole('button', { name: /add weight/i }))

    const afterSpinButtons = within(dialog).getAllByRole('textbox').filter(
      el => (el as HTMLInputElement).inputMode === 'decimal' || (el as HTMLInputElement).inputMode === 'numeric',
    )
    // Two more numeric fields (resistance + quantity) than before
    expect(afterSpinButtons.length).toBe(initialSpinButtons.length + 2)
  })
})

describe('AddEquipmentModal — edit mode', () => {
  it('prefills name, unit, and piece rows from the equipment prop', async () => {
    const db = await makeTestDb()
    const existing = await seedEquipment(db)

    await renderWithProviders(
      <AddEquipmentModal opened onClose={() => {}} equipment={existing} />,
      { db },
    )

    const dialog = await screen.findByRole('dialog', { name: /edit equipment/i })
    const nameInput = within(dialog).getByLabelText(/name/i) as HTMLInputElement
    expect(nameInput.value).toBe('Kettlebell')

    // Two piece rows: resistance values 12 and 16 should appear in the form
    const weight = within(dialog).getByLabelText(/weight \(kg\)/i) as HTMLInputElement
    expect(weight.value).toBe('12')
  })

  it('persists changes via update on save (name reflects new value)', async () => {
    const db = await makeTestDb()
    const existing = await seedEquipment(db)
    let closed = false

    const { user } = await renderWithProviders(
      <AddEquipmentModal
        opened
        onClose={() => { closed = true }}
        equipment={existing}
      />,
      { db },
    )

    const dialog = await screen.findByRole('dialog', { name: /edit equipment/i })
    const nameInput = within(dialog).getByLabelText(/name/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Kettlebell v2')

    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    await expect.poll(async () => {
      const all = await listEquipmentDefs(db)
      return all[0]?.name
    }).toBe('Kettlebell v2')
    // Same row count — update, not create
    expect(await listEquipmentDefs(db)).toHaveLength(1)
    await expect.poll(() => closed).toBe(true)
  })

  it('preserves original piece ids when updating', async () => {
    const db = await makeTestDb()
    const existing = await seedEquipment(db)
    const originalPieceIds = [...existing.pieces]
      .sort((a, b) => a.position - b.position)
      .map(p => p.id)

    const { user } = await renderWithProviders(
      <AddEquipmentModal opened onClose={() => {}} equipment={existing} />,
      { db },
    )

    const dialog = await screen.findByRole('dialog', { name: /edit equipment/i })
    const nameInput = within(dialog).getByLabelText(/name/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'KB renamed')

    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    await expect.poll(async () => {
      const [updated] = await listEquipmentDefs(db)
      return updated?.name
    }).toBe('KB renamed')

    const [updated] = await listEquipmentDefs(db)
    const updatedPieceIds = [...updated.pieces]
      .sort((a, b) => a.position - b.position)
      .map(p => p.id)
    expect(updatedPieceIds).toEqual(originalPieceIds)
  })
})
