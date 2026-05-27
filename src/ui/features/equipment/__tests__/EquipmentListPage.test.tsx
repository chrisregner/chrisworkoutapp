/**
 * EquipmentListPage — user-observable behaviors
 *
 * - when no equipment exists, renders an empty-state message
 * - when equipment exists, renders a card per piece of equipment with name + unit
 * - when user expands a card, piece details (resistance/quantity rows) become visible
 * - when user clicks "Add", the Add Equipment modal opens
 * - when user expands a card and clicks "Edit", the Edit Equipment modal opens prefilled with the equipment name
 * - when user expands a card and clicks "Delete", the Delete confirmation modal opens
 * - when equipment is created via the service, the list re-renders to include it (cross-screen / query invalidation)
 */
import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../../testing/renderWithProviders'
import { makeTestDb } from '../../../../persistence/testing'
import { DefinitionsService } from '../../../../app'
import { EquipmentListPage } from '../EquipmentListPage'

async function seedEquipment(
  db: Awaited<ReturnType<typeof makeTestDb>>,
  name: string,
  pieces: { resistance: number; quantity: number; position: number }[] = [
    { resistance: 12, quantity: 1, position: 0 },
  ],
) {
  const service = new DefinitionsService(db)
  return service.createEquipment({ name, isCombinable: false, unit: 'kg', pieces })
}

describe('EquipmentListPage', () => {
  it('renders empty state when no equipment exists', async () => {
    await renderWithProviders(<EquipmentListPage />)
    expect(
      await screen.findByText(/no equipment yet/i),
    ).toBeInTheDocument()
  })

  it('renders a card for each piece of equipment', async () => {
    const db = await makeTestDb()
    await seedEquipment(db, 'Kettlebell')
    await seedEquipment(db, 'Barbell')

    await renderWithProviders(<EquipmentListPage />, { db })

    expect(await screen.findByText('Kettlebell')).toBeInTheDocument()
    expect(screen.getByText('Barbell')).toBeInTheDocument()
  })

  it('expanding a card reveals piece resistance and quantity rows', async () => {
    const db = await makeTestDb()
    await seedEquipment(db, 'Plates', [
      { resistance: 2.5, quantity: 4, position: 0 },
      { resistance: 5, quantity: 4, position: 1 },
    ])

    const { user } = await renderWithProviders(<EquipmentListPage />, { db })

    const header = await screen.findByText('Plates')
    await user.click(header)

    // Two resistance values now visible
    expect(await screen.findByText('2.5')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('clicking "Add" opens the Add Equipment modal', async () => {
    const { user } = await renderWithProviders(<EquipmentListPage />)

    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(
      await screen.findByRole('dialog', { name: /add equipment/i }),
    ).toBeInTheDocument()
  })

  it('clicking "Edit" on an expanded card opens the Edit modal prefilled with the equipment name', async () => {
    const db = await makeTestDb()
    await seedEquipment(db, 'Dumbbell')

    const { user } = await renderWithProviders(<EquipmentListPage />, { db })

    await user.click(await screen.findByText('Dumbbell'))
    await user.click(await screen.findByRole('button', { name: /edit/i }))

    const dialog = await screen.findByRole('dialog', { name: /edit equipment/i })
    const nameInput = within(dialog).getByLabelText(/name/i) as HTMLInputElement
    expect(nameInput.value).toBe('Dumbbell')
  })

  it('clicking "Delete" on an expanded card opens the Delete confirmation modal', async () => {
    const db = await makeTestDb()
    await seedEquipment(db, 'Sandbag')

    const { user } = await renderWithProviders(<EquipmentListPage />, { db })

    await user.click(await screen.findByText('Sandbag'))
    await user.click(await screen.findByRole('button', { name: /delete/i }))

    const dialog = await screen.findByRole('dialog', { name: /delete equipment/i })
    expect(within(dialog).getByText(/cannot be undone/i)).toBeInTheDocument()
    expect(within(dialog).getByText('Sandbag')).toBeInTheDocument()
  })

  it('newly created equipment appears in the list (query invalidation)', async () => {
    const db = await makeTestDb()
    const { user } = await renderWithProviders(<EquipmentListPage />, { db })

    expect(await screen.findByText(/no equipment yet/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add' }))

    const dialog = await screen.findByRole('dialog', { name: /add equipment/i })
    // Fill the modal form and save
    await user.type(within(dialog).getByLabelText(/name/i), 'Resistance Band')
    const weight = within(dialog).getByLabelText(/weight \(kg\)/i)
    await user.clear(weight)
    await user.type(weight, '10')

    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText('Resistance Band')).toBeInTheDocument()
  })
})
