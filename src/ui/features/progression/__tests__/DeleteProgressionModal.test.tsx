/**
 * DeleteProgressionModal — user-observable behaviors
 *
 * - when progression prop is null, no dialog is shown
 * - when progression is provided, shows the progression name
 * - when user clicks "Cancel", onClose fires and progression is NOT deleted
 * - when user clicks "Delete", progression is removed from persistence,
 *   onClose fires, and onDeleted fires
 * - when delete fails (progression already gone), error alert is shown and
 *   progression remains as-is (still in count: 0)
 */
import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../../testing/renderWithProviders'
import { makeTestDb } from '../../../../persistence/testing'
import { DefinitionsService } from '../../../../app'
import { DeleteProgressionModal } from '../DeleteProgressionModal'
import type { ExerciseDef, ProgressionDef } from '../../../../domain'

async function seedProgression(
  db: Awaited<ReturnType<typeof makeTestDb>>,
  name = 'Linear A',
): Promise<{ service: DefinitionsService; exercise: ExerciseDef; progression: ProgressionDef }> {
  const service = new DefinitionsService(db)
  const exercise = await service.createExercise({
    name: 'Pushup',
    quantifierType: 'reps',
    equipmentId: null,
  })
  const progression = await service.createProgression({
    name,
    exerciseId: exercise.id as string,
    body: {
      kind: 'linear',
      volumeSets: [{ sets: 3, quantifierValue: 5, resistanceSource: [] }],
      plannedSets: [3],
      plannedReps: [5],
    },
  })
  return { service, exercise, progression }
}

describe('DeleteProgressionModal', () => {
  it('renders no dialog when progression prop is null', async () => {
    await renderWithProviders(
      <DeleteProgressionModal progression={null} exerciseId="x" onClose={() => {}} />,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows the progression name in the confirmation prompt', async () => {
    const db = await makeTestDb()
    const { exercise, progression } = await seedProgression(db, 'My Linear')

    await renderWithProviders(
      <DeleteProgressionModal
        progression={progression}
        exerciseId={exercise.id as string}
        onClose={() => {}}
      />,
      { db },
    )

    const dialog = await screen.findByRole('dialog', { name: /delete progression/i })
    expect(within(dialog).getByText('My Linear')).toBeInTheDocument()
  })

  it('clicking "Cancel" fires onClose and does NOT delete the progression', async () => {
    const db = await makeTestDb()
    const { service, exercise, progression } = await seedProgression(db)
    let closed = false
    let deleted = false

    const { user } = await renderWithProviders(
      <DeleteProgressionModal
        progression={progression}
        exerciseId={exercise.id as string}
        onClose={() => { closed = true }}
        onDeleted={() => { deleted = true }}
      />,
      { db },
    )

    const dialog = await screen.findByRole('dialog', { name: /delete progression/i })
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }))

    expect(closed).toBe(true)
    expect(deleted).toBe(false)
    expect(
      await service.listProgressionsByExercise(exercise.id as string),
    ).toHaveLength(1)
  })

  it('clicking "Delete" removes the progression, fires onClose, and fires onDeleted', async () => {
    const db = await makeTestDb()
    const { service, exercise, progression } = await seedProgression(db)
    let closed = false
    let deleted = false

    const { user } = await renderWithProviders(
      <DeleteProgressionModal
        progression={progression}
        exerciseId={exercise.id as string}
        onClose={() => { closed = true }}
        onDeleted={() => { deleted = true }}
      />,
      { db },
    )

    const dialog = await screen.findByRole('dialog', { name: /delete progression/i })
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }))

    await expect
      .poll(async () => (await service.listProgressionsByExercise(exercise.id as string)).length)
      .toBe(0)
    await expect.poll(() => closed).toBe(true)
    await expect.poll(() => deleted).toBe(true)
  })

  it('shows an error alert when the delete fails (progression already removed)', async () => {
    const db = await makeTestDb()
    const { service, exercise, progression } = await seedProgression(db)
    // Remove the progression out from under the modal so the service throws
    // EntityNotFoundError on the click.
    await service.deleteProgression(progression.id as string)

    const { user } = await renderWithProviders(
      <DeleteProgressionModal
        progression={progression}
        exerciseId={exercise.id as string}
        onClose={() => {}}
      />,
      { db },
    )

    const dialog = await screen.findByRole('dialog', { name: /delete progression/i })
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }))

    const alert = await within(dialog).findByRole('alert')
    expect(alert.textContent ?? '').toMatch(/progression/i)
  })
})
