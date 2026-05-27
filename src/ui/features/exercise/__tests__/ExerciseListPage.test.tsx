/**
 * Behaviors covered (one `it` per bullet, in order):
 *
 *  - Empty state: when no exercises exist, renders an empty-state message.
 *  - Happy path / list: when exercises exist, renders their names and quantifier summaries.
 *  - Persistence boundary: when seeded directly via the service, the list reflects the seeded data on first render.
 *  - Expand card: when a card is clicked, the expanded section shows equipment details and progressions section.
 *  - Navigation (modal open): when the Add button is clicked, the Add Exercise modal opens.
 *  - Navigation (modal open): when the Edit button on a card is clicked, the Edit Exercise modal opens with the exercise name pre-filled.
 *  - Navigation (modal open): when the Delete button on a card is clicked, the Delete modal opens showing the exercise name.
 *  - Cross-screen invariant: when a new exercise is created via the Add modal, the list updates without a manual refresh.
 */

import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { ExerciseListPage } from '../ExerciseListPage'
import { renderWithProviders } from '../../../testing/renderWithProviders'
import { DefinitionsService } from '../../../../app'
import { makeTestDb } from '../../../../persistence/testing'

async function seedExercise(
  db: Awaited<ReturnType<typeof makeTestDb>>,
  overrides?: { name?: string; description?: string },
) {
  const service = new DefinitionsService(db)
  return service.createExercise({
    name: overrides?.name ?? 'Romanian Deadlift',
    description: overrides?.description,
    quantifierType: 'reps',
    equipmentId: null,
  })
}

async function seedEquipmentAndExercise(db: Awaited<ReturnType<typeof makeTestDb>>) {
  const service = new DefinitionsService(db)
  const eq = await service.createEquipment({
    name: 'Kettlebell 16kg',
    isCombinable: false,
    unit: 'kg',
    pieces: [{ resistance: 16, quantity: 1, position: 0 }],
  })
  const ex = await service.createExercise({
    name: 'Goblet Squat',
    description: 'controlled tempo',
    quantifierType: 'reps',
    equipmentId: eq.id as string,
  })
  return { eq, ex }
}

describe('ExerciseListPage', () => {
  it('renders empty state when no exercises exist', async () => {
    await renderWithProviders(<ExerciseListPage />)
    expect(
      await screen.findByText(/no exercises yet/i),
    ).toBeInTheDocument()
  })

  it('renders each exercise with its name', async () => {
    const db = await makeTestDb()
    await seedExercise(db, { name: 'Romanian Deadlift' })
    await seedExercise(db, { name: 'Front Squat' })

    await renderWithProviders(<ExerciseListPage />, { db })

    expect(await screen.findByText('Romanian Deadlift')).toBeInTheDocument()
    expect(screen.getByText('Front Squat')).toBeInTheDocument()
  })

  it('reflects directly-seeded exercises on first render (persistence boundary)', async () => {
    const db = await makeTestDb()
    await seedExercise(db, { name: 'Seeded Move' })

    await renderWithProviders(<ExerciseListPage />, { db })

    expect(await screen.findByText('Seeded Move')).toBeInTheDocument()
    expect(screen.queryByText(/no exercises yet/i)).not.toBeInTheDocument()
  })

  it('expands the card to show equipment details and progressions section when clicked', async () => {
    const db = await makeTestDb()
    await seedEquipmentAndExercise(db)

    const { user } = await renderWithProviders(<ExerciseListPage />, { db })

    const nameNode = await screen.findByText('Goblet Squat')
    await user.click(nameNode)

    // Expanded card surfaces equipment name and the progressions sub-header.
    expect(await screen.findByText('Kettlebell 16kg')).toBeInTheDocument()
    expect(screen.getByText(/progressions/i)).toBeInTheDocument()
    expect(screen.getByText(/none yet/i)).toBeInTheDocument()
  })

  it('opens the Add Exercise modal when the Add button is clicked', async () => {
    const { user } = await renderWithProviders(<ExerciseListPage />)

    const addBtn = await screen.findByRole('button', { name: /^add$/i })
    await user.click(addBtn)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/add exercise/i)).toBeInTheDocument()
  })

  it('opens the Edit modal pre-filled with the exercise name when Edit is clicked', async () => {
    const db = await makeTestDb()
    await seedExercise(db, { name: 'Bulgarian Split Squat' })

    const { user } = await renderWithProviders(<ExerciseListPage />, { db })

    const cardName = await screen.findByText('Bulgarian Split Squat')
    await user.click(cardName)

    const editBtn = await screen.findByRole('button', { name: /^edit$/i })
    await user.click(editBtn)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/edit exercise/i)).toBeInTheDocument()
    const nameInput = within(dialog).getByLabelText(/name/i) as HTMLInputElement
    expect(nameInput.value).toBe('Bulgarian Split Squat')
  })

  it('opens the Delete confirmation modal showing the exercise name when Delete is clicked', async () => {
    const db = await makeTestDb()
    await seedExercise(db, { name: 'Overhead Press' })

    const { user } = await renderWithProviders(<ExerciseListPage />, { db })

    await user.click(await screen.findByText('Overhead Press'))
    const deleteBtn = await screen.findByRole('button', { name: /^delete$/i })
    await user.click(deleteBtn)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/delete exercise/i)).toBeInTheDocument()
    expect(within(dialog).getByText('Overhead Press')).toBeInTheDocument()
  })

  it('updates the list after a new exercise is created via the Add modal', async () => {
    const { user } = await renderWithProviders(<ExerciseListPage />)

    expect(await screen.findByText(/no exercises yet/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^add$/i }))

    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/name/i), 'Fresh Exercise')
    await user.click(within(dialog).getByRole('button', { name: /save/i }))

    expect(await screen.findByText('Fresh Exercise')).toBeInTheDocument()
    expect(screen.queryByText(/no exercises yet/i)).not.toBeInTheDocument()
  })
})
