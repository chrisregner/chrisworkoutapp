/**
 * Behaviors covered (one `it` per bullet, in order):
 *
 *  - Empty: when `exercise` is null, no modal is rendered.
 *  - Happy path: when Delete is confirmed, the exercise is removed and onClose is called.
 *  - Navigation: when Cancel is clicked, onClose is called and the exercise still exists.
 *  - Display: the prompt names the exercise being deleted.
 *  - Cross-screen invariant: when an exercise is deleted from the list page, the row disappears from the list.
 */

import { describe, it, expect } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import { DeleteExerciseModal } from '../DeleteExerciseModal'
import { ExerciseListPage } from '../ExerciseListPage'
import { renderWithProviders } from '../../../testing/renderWithProviders'
import { DefinitionsService } from '../../../../app'
import { type ExerciseDef } from '../../../../domain'
import { makeTestDb } from '../../../../persistence/testing'

async function seedExercise(
  db: Awaited<ReturnType<typeof makeTestDb>>,
  name = 'Hip Thrust',
): Promise<ExerciseDef> {
  const service = new DefinitionsService(db)
  return service.createExercise({
    name,
    quantifierType: 'reps',
    equipmentId: null,
  })
}

describe('DeleteExerciseModal', () => {
  it('renders nothing when exercise is null', async () => {
    await renderWithProviders(
      <DeleteExerciseModal exercise={null} onClose={() => {}} />,
    )
    expect(screen.queryByRole('heading', { name: /delete exercise/i })).not.toBeInTheDocument()
  })

  it('deletes the exercise and calls onClose when Delete is confirmed', async () => {
    const db = await makeTestDb()
    const exercise = await seedExercise(db, 'To Be Deleted')

    let closed = false
    const { user } = await renderWithProviders(
      <DeleteExerciseModal exercise={exercise} onClose={() => { closed = true }} />,
      { db },
    )

    const dialog = (await screen.findByRole('heading', { name: /delete exercise/i }))
      .closest('[role="dialog"]') as HTMLElement
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }))

    await waitFor(() => expect(closed).toBe(true))

    const list = await new DefinitionsService(db).listExercises()
    expect(list.find(e => e.id === exercise.id)).toBeUndefined()
  })

  it('calls onClose without deleting when Cancel is clicked', async () => {
    const db = await makeTestDb()
    const exercise = await seedExercise(db, 'Keep Me')

    let closed = false
    const { user } = await renderWithProviders(
      <DeleteExerciseModal exercise={exercise} onClose={() => { closed = true }} />,
      { db },
    )

    const dialog = (await screen.findByRole('heading', { name: /delete exercise/i }))
      .closest('[role="dialog"]') as HTMLElement
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }))

    expect(closed).toBe(true)
    const list = await new DefinitionsService(db).listExercises()
    expect(list.find(e => e.id === exercise.id)).toBeDefined()
  })

  it('shows the exercise name in the confirmation prompt', async () => {
    const db = await makeTestDb()
    const exercise = await seedExercise(db, 'Named Move')

    await renderWithProviders(
      <DeleteExerciseModal exercise={exercise} onClose={() => {}} />,
      { db },
    )

    const dialog = (await screen.findByRole('heading', { name: /delete exercise/i }))
      .closest('[role="dialog"]') as HTMLElement
    expect(within(dialog).getByText('Named Move')).toBeInTheDocument()
  })

  it('removes the deleted exercise from the list page after confirmation', async () => {
    const db = await makeTestDb()
    await seedExercise(db, 'Disappearing Move')

    const { user } = await renderWithProviders(<ExerciseListPage />, { db })

    await user.click(await screen.findByText('Disappearing Move'))
    await user.click(await screen.findByRole('button', { name: /^delete$/i }))

    // Now in delete modal — confirm.
    const heading = await screen.findByRole('heading', { name: /delete exercise/i })
    const dialog = heading.closest('[role="dialog"]') as HTMLElement
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(screen.queryByText('Disappearing Move')).not.toBeInTheDocument()
    })
    expect(await screen.findByText(/no exercises yet/i)).toBeInTheDocument()
  })
})
