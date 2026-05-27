/**
 * Behaviors covered (one `it` per bullet, in order):
 *
 *  - Happy path (create): when a valid name is submitted, the modal calls onClose and the exercise persists.
 *  - Happy path (edit): when opened in edit mode, fields are pre-filled and submitting updates the exercise.
 *  - Validation: when the name is empty, submitting shows a "Name required" error and does NOT close.
 *  - Validation: when min > max in min-max mode, submitting shows a "Must be ≥ min" error and does NOT close.
 *  - Validation: when an allowed-values entry is empty, submitting shows a per-entry validation error.
 *  - Equipment selection: when equipment is selected, the "Add weights together" option appears.
 *  - Error state: when the smart constructor rejects the input (unsorted allowed-values), a readable Alert appears and the modal stays open.
 *  - Persistence boundary: reopening the modal after closing resets the form back to defaults (no leaked dirty state).
 *  - CountingSection: switching Track by from reps to seconds persists quantifierType='seconds'.
 *  - CountingSection: switching Target type from range to specific values and entering one valid value persists an allowed-values rule.
 *  - EquipmentSection: after selecting a combinable equipment and enabling combine, deselecting the equipment hides the combine toggle and resets shouldCombineResistance to false on save.
 */

import { describe, it, expect } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import { SaveExerciseModal } from '../SaveExerciseModal'
import { ExerciseListPage } from '../ExerciseListPage'
import { renderWithProviders } from '../../../testing/renderWithProviders'
import { DefinitionsService } from '../../../../app'
import { makeQuantifierRule } from '../../../../domain'
import { makeTestDb } from '../../../../persistence/testing'

function noop() {}

async function getDialog() {
  return screen.findByRole('dialog')
}

describe('SaveExerciseModal', () => {
  it('creates an exercise and calls onClose when a valid form is submitted', async () => {
    const db = await makeTestDb()
    let closed = false
    const { user } = await renderWithProviders(
      <SaveExerciseModal opened onClose={() => { closed = true }} />,
      { db },
    )

    const dialog = await getDialog()
    await user.type(within(dialog).getByLabelText(/name/i), 'New Exercise')
    await user.click(within(dialog).getByRole('button', { name: /save/i }))

    await waitFor(() => expect(closed).toBe(true))

    const service = new DefinitionsService(db)
    const list = await service.listExercises()
    expect(list.map(e => e.name)).toContain('New Exercise')
  })

  it('pre-fills fields in edit mode and updates the exercise on submit', async () => {
    const db = await makeTestDb()
    const service = new DefinitionsService(db)
    const created = await service.createExercise({
      name: 'Old Name',
      quantifierType: 'reps',
      quantifierRule: makeQuantifierRule({ kind: 'min-max', min: 5, max: 8 }),
      equipmentId: null,
    })

    let closed = false
    const { user } = await renderWithProviders(
      <SaveExerciseModal
        opened
        onClose={() => { closed = true }}
        exercise={created}
      />,
      { db },
    )

    const dialog = await getDialog()
    const nameInput = within(dialog).getByLabelText(/name/i) as HTMLInputElement
    expect(nameInput.value).toBe('Old Name')

    await user.clear(nameInput)
    await user.type(nameInput, 'Renamed')
    await user.click(within(dialog).getByRole('button', { name: /save/i }))

    await waitFor(() => expect(closed).toBe(true))

    const list = await service.listExercises()
    expect(list.find(e => e.id === created.id)?.name).toBe('Renamed')
  })

  it('shows "Name required" and stays open when the name is empty', async () => {
    let closed = false
    const { user } = await renderWithProviders(
      <SaveExerciseModal opened onClose={() => { closed = true }} />,
    )

    const dialog = await getDialog()
    await user.click(within(dialog).getByRole('button', { name: /save/i }))

    expect(await within(dialog).findByText(/name required/i)).toBeInTheDocument()
    expect(closed).toBe(false)
  })

  it('shows a min/max validation error and stays open when min > max', async () => {
    let closed = false
    const { user } = await renderWithProviders(
      <SaveExerciseModal opened onClose={() => { closed = true }} />,
    )

    const dialog = await getDialog()
    await user.type(within(dialog).getByLabelText(/name/i), 'Bad Range')

    const minInput = within(dialog).getByLabelText(/minimum/i) as HTMLInputElement
    const maxInput = within(dialog).getByLabelText(/maximum/i) as HTMLInputElement
    await user.clear(minInput)
    await user.type(minInput, '10')
    await user.clear(maxInput)
    await user.type(maxInput, '5')

    await user.click(within(dialog).getByRole('button', { name: /save/i }))

    expect(await within(dialog).findByText(/must be ≥ min/i)).toBeInTheDocument()
    expect(closed).toBe(false)
  })

  it('shows a per-entry error when an allowed-values entry is empty', async () => {
    let closed = false
    const { user } = await renderWithProviders(
      <SaveExerciseModal opened onClose={() => { closed = true }} />,
    )

    const dialog = await getDialog()
    await user.type(within(dialog).getByLabelText(/name/i), 'Allowed Values Test')

    // Switch to allowed-values mode.
    await user.click(within(dialog).getByRole('radio', { name: /specific values/i }))

    await user.click(within(dialog).getByRole('button', { name: /save/i }))

    expect(
      await within(dialog).findByText(/must be whole number > 0/i),
    ).toBeInTheDocument()
    expect(closed).toBe(false)
  })

  it('shows the "Add weights together" option once a combinable equipment is selected', async () => {
    const db = await makeTestDb()
    const service = new DefinitionsService(db)
    await service.createEquipment({
      name: 'Plates',
      isCombinable: true,
      unit: 'kg',
      pieces: [{ resistance: 2.5, quantity: 4, position: 0 }],
    })

    const { user } = await renderWithProviders(
      <SaveExerciseModal opened onClose={noop} />,
      { db },
    )

    const dialog = await getDialog()
    // Wait until equipment list query resolves and the select has options.
    // The Select input is identified by its placeholder "None" within the
    // Equipment fieldset (legend text overlaps the label).
    const equipmentSelect = within(dialog).getByPlaceholderText(/none/i)
    await user.click(equipmentSelect)

    const option = await screen.findByRole('option', { name: /plates/i })
    await user.click(option)

    expect(
      await within(dialog).findByLabelText(/add weights together/i),
    ).toBeInTheDocument()
  })

  it('surfaces a domain error when allowed-values are not sorted ascending', async () => {
    let closed = false
    const { user } = await renderWithProviders(
      <SaveExerciseModal opened onClose={() => { closed = true }} />,
    )
    const dialog = await getDialog()

    await user.type(within(dialog).getByLabelText(/name/i), 'Bad Targets')

    // Switch to allowed-values mode.
    await user.click(within(dialog).getByRole('radio', { name: /specific values/i }))

    // Add a second entry so we have two slots to fill.
    await user.click(within(dialog).getByRole('button', { name: /add option/i }))

    const valueInputs = within(dialog).getAllByPlaceholderText('5')
    expect(valueInputs.length).toBe(2)
    // Enter 5 then 3 — unsorted, violates smart constructor invariant.
    await user.type(valueInputs[0], '5')
    await user.type(valueInputs[1], '3')

    await user.click(within(dialog).getByRole('button', { name: /save/i }))

    const alert = await within(dialog).findByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(closed).toBe(false)
  })

  it('switching Track by from reps to seconds persists quantifierType="seconds"', async () => {
    const db = await makeTestDb()
    let closed = false
    const { user } = await renderWithProviders(
      <SaveExerciseModal opened onClose={() => { closed = true }} />,
      { db },
    )

    const dialog = await getDialog()
    await user.type(within(dialog).getByLabelText(/name/i), 'Plank')
    await user.click(within(dialog).getByRole('radio', { name: /seconds/i }))
    await user.click(within(dialog).getByRole('button', { name: /save/i }))

    await waitFor(() => expect(closed).toBe(true))
    const service = new DefinitionsService(db)
    const created = (await service.listExercises()).find(e => e.name === 'Plank')!
    expect(created.quantifierType).toBe('seconds')
  })

  it('switching Target type to specific values and entering a valid value persists an allowed-values rule', async () => {
    const db = await makeTestDb()
    let closed = false
    const { user } = await renderWithProviders(
      <SaveExerciseModal opened onClose={() => { closed = true }} />,
      { db },
    )

    const dialog = await getDialog()
    await user.type(within(dialog).getByLabelText(/name/i), 'Triple')
    await user.click(within(dialog).getByRole('radio', { name: /specific values/i }))
    const firstInput = within(dialog).getByPlaceholderText('5')
    await user.type(firstInput, '3')
    await user.click(within(dialog).getByRole('button', { name: /save/i }))

    await waitFor(() => expect(closed).toBe(true))
    const service = new DefinitionsService(db)
    const created = (await service.listExercises()).find(e => e.name === 'Triple')!
    expect(created.quantifierRule.kind).toBe('allowed-values')
    if (created.quantifierRule.kind !== 'allowed-values') throw new Error('expected allowed-values')
    expect(created.quantifierRule.values.map(Number)).toEqual([3])
  })

  it('deselecting equipment after enabling combine hides the toggle and resets shouldCombineResistance', async () => {
    const db = await makeTestDb()
    const service = new DefinitionsService(db)
    await service.createEquipment({
      name: 'Plates',
      isCombinable: true,
      unit: 'kg',
      pieces: [{ resistance: 2.5, quantity: 4, position: 0 }],
    })

    let closed = false
    const { user } = await renderWithProviders(
      <SaveExerciseModal opened onClose={() => { closed = true }} />,
      { db },
    )
    const dialog = await getDialog()
    await user.type(within(dialog).getByLabelText(/name/i), 'No Equip')

    // Pick the combinable equipment and enable "Add weights together".
    await user.click(within(dialog).getByPlaceholderText(/none/i))
    await user.click(await screen.findByRole('option', { name: /plates/i }))
    const combine = await within(dialog).findByLabelText(/add weights together/i)
    await user.click(combine)
    expect(combine).toBeChecked()

    // Deselect the equipment via the Select's clear button. Mantine renders it
    // with aria-hidden so it sits outside the a11y tree — find it as a generic
    // hidden button inside the Select input wrapper.
    const equipSelectInput = within(dialog).getByPlaceholderText(/none/i)
    const inputWrapper = equipSelectInput.closest('.mantine-Input-wrapper') as HTMLElement
    const clearBtn = inputWrapper.querySelector('button') as HTMLElement
    await user.click(clearBtn)

    // Combine toggle disappears.
    expect(within(dialog).queryByLabelText(/add weights together/i)).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /save/i }))

    await waitFor(() => expect(closed).toBe(true))
    const created = (await service.listExercises()).find(e => e.name === 'No Equip')!
    expect(created.equipment).toBeNull()
    expect(created.shouldCombineResistance).toBe(false)
  })

  it('resets form state to defaults when the modal is reopened after closing dirty', async () => {
    // Drive via the list page so the modal lifecycle matches real usage.
    const { user } = await renderWithProviders(<ExerciseListPage />)

    await user.click(await screen.findByRole('button', { name: /^add$/i }))
    let dialog = await getDialog()
    await user.type(within(dialog).getByLabelText(/name/i), 'Dirty Draft')

    // Close via Escape — Mantine's modal handles it natively.
    await user.keyboard('{Escape}')

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )

    // Reopen.
    await user.click(screen.getByRole('button', { name: /^add$/i }))
    dialog = await getDialog()
    const nameInput = within(dialog).getByLabelText(/name/i) as HTMLInputElement
    expect(nameInput.value).toBe('')
  })
})
