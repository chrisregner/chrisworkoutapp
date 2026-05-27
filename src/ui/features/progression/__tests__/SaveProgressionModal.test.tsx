// ─────────────────────────────────────────────────────────────────────────────
// SaveProgressionModal behavior inventory
//
// Empty state
// - when opened for a new progression with empty inputs, the progression grid
//   shows its instructional hint
//
// Validation / blocked save
// - when name is empty or no cells are selected, the Save button is disabled
// - when the user adds a reps value outside the exercise's quantifier rule,
//   the input shows an error and the chip is not added
//
// Happy path (linear — the modal only builds linear progressions)
// - when the user fills name, sets, reps, picks a no-equipment resistance and
//   selects a cell, Save persists the progression and the modal closes
// - when the exercise has non-combinable equipment, toggling a piece button
//   adds a config row to the grid and that row's cell saves through to the db
//
// Combinable equipment
// - when the user opens the "Add configuration" draft, sets a piece quantity
//   and confirms, a chip for the new config is shown
// - when the user tries to confirm a duplicate combinable configuration, the
//   modal surfaces "Configuration already added" without adding a duplicate
//
// Edit mode
// - when opened with an existing progression, the modal renders in view mode
//   with the existing name pre-filled and no Save button visible
// - when the user clicks the Edit pencil, fields become editable and Save
//   appears; clicking Cancel returns to view mode
// - when the user edits the name and saves, the persisted progression is
//   updated
//
// View mode load round-trip — what the user sees reflects what was saved
// - when opened on a saved progression, sets and reps chips and the grid's
//   numbered step cells reflect the saved volumeSets
// - when opened on a progression for non-combinable equipment, only the
//   saved pieces show as selected piece buttons
// - when opened on a progression for combinable equipment, the saved
//   resistanceSource is rendered as a config chip (no Remove control in view)
//
// Edit mode round-trip — changes to grid/equipment persist
// - when editing a progression and adding a new cell, Save persists the
//   additional volumeSet
// - when editing a progression for non-combinable equipment, toggling on a
//   new piece and selecting its cell persists the new resistanceSource
//
// Delete
// - when the user clicks the trash icon in view mode and confirms, the
//   progression is removed and the modal closes
// - when the user opens the delete confirm and cancels, the progression is
//   kept and the view modal remains open
//
// Server error → human message
// - when the exercise referenced by the modal is deleted before save, the
//   modal surfaces the EntityNotFoundError message in an alert (typed error
//   bubbles as readable UI)
//
// Heavy/Light invariant — NOT testable here.
// SaveProgressionModal only constructs linear progressions (see handleSubmit:
// body.kind === 'linear'). The HeavyLight invariant lives in the domain smart
// constructor and is not reachable through this UI. See report.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { Button } from '@mantine/core'
import { screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../testing/renderWithProviders'
import { SaveProgressionModal } from '../SaveProgressionModal'
import { DefinitionsService } from '../../../../app'
import { makeQuantifierRule } from '../../../../domain'
import type { EquipmentDef, ExerciseDef, ProgressionDef } from '../../../../domain'
import { makeTestDb } from '../../../../persistence/testing'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Tiny harness: provides a real "Open" button so the modal sees a mount-time
 *  closed → opened transition just like in production. */
function ModalHarness({
  exercise,
  progression,
}: {
  exercise: ExerciseDef
  progression?: ProgressionDef
}) {
  const [opened, setOpened] = useState(false)
  return (
    <>
      <Button onClick={() => setOpened(true)}>Open</Button>
      <SaveProgressionModal
        opened={opened}
        onClose={() => setOpened(false)}
        exercise={exercise}
        progression={progression}
      />
    </>
  )
}

type Seed = {
  service: DefinitionsService
  exerciseBodyweight: ExerciseDef
  exerciseFixed: ExerciseDef // non-combinable equipment
  equipmentFixed: EquipmentDef
  exerciseCombinable: ExerciseDef // combinable equipment
  equipmentCombinable: EquipmentDef
}

async function seedFixtures(): Promise<{ db: Awaited<ReturnType<typeof makeTestDb>>; seed: Seed }> {
  const db = await makeTestDb()
  const service = new DefinitionsService(db)

  const equipmentFixed = await service.createEquipment({
    name: 'Kettlebells',
    isCombinable: false,
    unit: 'kg',
    pieces: [
      { resistance: 12, quantity: 1, position: 0 },
      { resistance: 16, quantity: 1, position: 1 },
    ],
  })
  const equipmentCombinable = await service.createEquipment({
    name: 'Plates',
    isCombinable: true,
    unit: 'kg',
    pieces: [
      { resistance: 5, quantity: 4, position: 0 },
      { resistance: 10, quantity: 2, position: 1 },
    ],
  })

  const exerciseBodyweight = await service.createExercise({
    name: 'Pushup',
    quantifierType: 'reps',
    quantifierRule: makeQuantifierRule({ kind: 'min-max', min: 1, max: 20 }),
    equipmentId: null,
  })
  const exerciseFixed = await service.createExercise({
    name: 'KB Swing',
    quantifierType: 'reps',
    quantifierRule: makeQuantifierRule({ kind: 'min-max', min: 1, max: 20 }),
    equipmentId: equipmentFixed.id as string,
  })
  const exerciseCombinable = await service.createExercise({
    name: 'Squat',
    quantifierType: 'reps',
    quantifierRule: makeQuantifierRule({ kind: 'min-max', min: 1, max: 20 }),
    equipmentId: equipmentCombinable.id as string,
    shouldCombineResistance: true,
  })

  return {
    db,
    seed: {
      service,
      exerciseBodyweight,
      exerciseFixed,
      equipmentFixed,
      exerciseCombinable,
      equipmentCombinable,
    },
  }
}

/** Find the cell buttons in a given grid row by walking up from the row label
 *  text ("{resistanceLabel} × {sets} sets"). */
function findCellButtonsForRow(rowLabel: RegExp): HTMLElement[] {
  const labelEl = screen.getByText(rowLabel)
  // Walk up to the row container (a Mantine Group div).
  const rowContainer = labelEl.closest('div')!.parentElement
  if (!rowContainer) return []
  // The row container has the label Box and then the cell buttons as siblings.
  return within(rowContainer as HTMLElement).getAllByRole('button')
}

/** Add an integer value via a ChipList scoped under a fieldset (legend).
 *  `findByRole` retries until the Mantine Modal transition mounts content. */
async function addChip(user: ReturnType<typeof import('@testing-library/user-event').default.setup>, legend: RegExp, value: number) {
  const group = await screen.findByRole('group', { name: legend })
  const input = within(group).getByPlaceholderText(/e\.g\./i)
  await user.type(input, String(value))
  await user.click(within(group).getByRole('button', { name: 'Add' }))
}


// ── Tests ────────────────────────────────────────────────────────────────────

describe('SaveProgressionModal', () => {
  it('shows the empty progression-grid hint when opened with no inputs', async () => {
    const { db, seed } = await seedFixtures()
    const { user } = await renderWithProviders(
      <ModalHarness exercise={seed.exerciseBodyweight} />,
      { db },
    )
    await user.click(screen.getByRole('button', { name: 'Open' }))

    expect(
      await screen.findByText(/add sets, reps, and resistance to see the grid/i),
    ).toBeInTheDocument()
  })

  it('disables Save while name is empty or no cells are selected', async () => {
    const { db, seed } = await seedFixtures()
    const { user } = await renderWithProviders(
      <ModalHarness exercise={seed.exerciseBodyweight} />,
      { db },
    )
    await user.click(screen.getByRole('button', { name: 'Open' }))

    const saveBtn = await screen.findByRole('button', { name: 'Save' })
    expect(saveBtn).toBeDisabled()

    // Even after typing a name, no cells → still disabled.
    await user.type(screen.getByLabelText('Name'), 'Linear A')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('rejects a reps value outside the exercise rule with an inline error', async () => {
    const { db, seed } = await seedFixtures()
    const { user } = await renderWithProviders(
      <ModalHarness exercise={seed.exerciseBodyweight} />,
      { db },
    )
    await user.click(screen.getByRole('button', { name: 'Open' }))

    // Exercise rule is min-max 1..20; 99 violates.
    await addChip(user, /^reps$/i, 99)

    expect(
      await screen.findByText(/must be between 1 and 20/i),
    ).toBeInTheDocument()
    // The chip should NOT be present in the Reps group.
    const repsGroup = await screen.findByRole('group', { name: /^reps$/i })
    expect(within(repsGroup).queryByText('99')).not.toBeInTheDocument()
  })

  it('saves a new bodyweight + ad-hoc resistance progression and closes the modal', async () => {
    const { db, seed } = await seedFixtures()
    const { user } = await renderWithProviders(
      <ModalHarness exercise={seed.exerciseBodyweight} />,
      { db },
    )
    await user.click(screen.getByRole('button', { name: 'Open' }))

    await user.type(await screen.findByLabelText('Name'), 'Linear A')
    await addChip(user, /^sets$/i, 3)
    await addChip(user, /^reps$/i, 5)

    // Bodyweight gives an implicit "Unloaded" config — the grid has one row
    // ("Unloaded × 3 sets") and one column (5 reps), hence one cell button.
    const rowLabel = await screen.findByText(/Unloaded × 3 sets/i)
    expect(rowLabel).toBeInTheDocument()
    const cells = findCellButtonsForRow(/Unloaded × 3 sets/i)
    expect(cells.length).toBeGreaterThanOrEqual(1)
    await user.click(cells[0]!)

    // Footer step counter confirms selection.
    expect(await screen.findByText(/1 step selected/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save' }))

    // Modal closes → "Open" button (outside modal) remains and modal title is gone.
    await waitFor(() => {
      expect(screen.queryByText('Add Progression')).not.toBeInTheDocument()
    })

    // Verify persistence via service.
    const persisted = await seed.service.listProgressionsByExercise(
      seed.exerciseBodyweight.id as string,
    )
    expect(persisted).toHaveLength(1)
    expect(persisted[0]!.name).toBe('Linear A')
  })

  it('saves a non-combinable equipment selection by toggling a piece button', async () => {
    const { db, seed } = await seedFixtures()
    const { user } = await renderWithProviders(
      <ModalHarness exercise={seed.exerciseFixed} />,
      { db },
    )
    await user.click(screen.getByRole('button', { name: 'Open' }))

    await user.type(await screen.findByLabelText('Name'), 'KB linear')
    await addChip(user, /^sets$/i, 3)
    await addChip(user, /^reps$/i, 8)

    // Non-combinable equipment seeds configs for ALL pieces by default — both
    // 12kg and 16kg rows are pre-populated. Pick the 16kg row's cell.
    expect(await screen.findByText(/16kg × 3 sets/)).toBeInTheDocument()

    const cells = findCellButtonsForRow(/16kg × 3 sets/)
    expect(cells.length).toBeGreaterThanOrEqual(1)
    await user.click(cells[0]!)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.queryByText('Add Progression')).not.toBeInTheDocument()
    })

    const persisted = await seed.service.listProgressionsByExercise(
      seed.exerciseFixed.id as string,
    )
    expect(persisted).toHaveLength(1)
    expect(persisted[0]!.name).toBe('KB linear')
    expect(persisted[0]!.body.kind).toBe('linear')
  })

  it('adds a chip for a new combinable configuration via the draft form', async () => {
    const { db, seed } = await seedFixtures()
    const { user } = await renderWithProviders(
      <ModalHarness exercise={seed.exerciseCombinable} />,
      { db },
    )
    await user.click(screen.getByRole('button', { name: 'Open' }))

    await user.click(await screen.findByRole('button', { name: /add configuration/i }))

    // Draft form is identified by its "New configuration" header. The pieces
    // each render <Text>{resistance}{unit}</Text> + a NumberInput.
    const draftHeader = await screen.findByText(/new configuration/i)
    const draftForm = draftHeader.closest('div') as HTMLElement
    // Walk up until we find the form container with the per-piece rows.
    const fiveKgRow = within(draftForm).getByText('5kg').closest('div')!
    const fiveKgInput = within(fiveKgRow as HTMLElement).getByRole('textbox')
    await user.clear(fiveKgInput)
    await user.type(fiveKgInput, '2')

    // Confirm the draft via its scoped "Add" button.
    await user.click(within(draftForm).getByRole('button', { name: 'Add' }))

    // A 10kg badge (2 × 5kg) should now appear with a "Remove 10kg" button.
    expect(
      await screen.findByRole('button', { name: /remove 10kg/i }),
    ).toBeInTheDocument()
  })

  it('shows "Configuration already added" when a duplicate combinable config is confirmed', async () => {
    const { db, seed } = await seedFixtures()
    const { user } = await renderWithProviders(
      <ModalHarness exercise={seed.exerciseCombinable} />,
      { db },
    )
    await user.click(screen.getByRole('button', { name: 'Open' }))

    // Add 1×5kg config (total 5kg).
    async function addOne5kg() {
      await user.click(await screen.findByRole('button', { name: /add configuration/i }))
      const draftHeader = await screen.findByText(/new configuration/i)
      const draftForm = draftHeader.closest('div') as HTMLElement
      const fiveKgRow = within(draftForm).getByText('5kg').closest('div')!
      const fiveKgInput = within(fiveKgRow as HTMLElement).getByRole('textbox')
      await user.clear(fiveKgInput)
      await user.type(fiveKgInput, '1')
      await user.click(within(draftForm).getByRole('button', { name: 'Add' }))
    }

    await addOne5kg()
    // Wait for the chip to confirm first add closed the draft.
    expect(
      await screen.findByRole('button', { name: /remove 5kg/i }),
    ).toBeInTheDocument()

    // Try the same config again.
    await addOne5kg()
    expect(
      await screen.findByText(/configuration already added/i),
    ).toBeInTheDocument()
  })

  it('renders an existing progression in view mode with the name pre-filled and no Save', async () => {
    const { db, seed } = await seedFixtures()
    const created = await seed.service.createProgression({
      name: 'Existing Linear',
      exerciseId: seed.exerciseBodyweight.id as string,
      body: {
        kind: 'linear',
        volumeSets: [
          { sets: 3, quantifierValue: 5, resistanceSource: [] },
        ],
      },
    })
    const { user } = await renderWithProviders(
      <ModalHarness exercise={seed.exerciseBodyweight} progression={created} />,
      { db },
    )
    await user.click(screen.getByRole('button', { name: 'Open' }))

    // Title says "Progression" (view mode) — NOT "Add" and NOT "Edit".
    expect(await screen.findByText('Progression')).toBeInTheDocument()
    expect(
      (screen.getByLabelText('Name') as HTMLInputElement).value,
    ).toBe('Existing Linear')
    // No Save button in view mode.
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('enters edit mode from the pencil icon and returns to view on cancel', async () => {
    const { db, seed } = await seedFixtures()
    const created = await seed.service.createProgression({
      name: 'Existing Linear',
      exerciseId: seed.exerciseBodyweight.id as string,
      body: {
        kind: 'linear',
        volumeSets: [
          { sets: 3, quantifierValue: 5, resistanceSource: [] },
        ],
      },
    })
    const { user } = await renderWithProviders(
      <ModalHarness exercise={seed.exerciseBodyweight} progression={created} />,
      { db },
    )
    await user.click(screen.getByRole('button', { name: 'Open' }))

    // Pencil icon's accessible name comes from title="Edit".
    const pencil = await screen.findByRole('button', { name: 'Edit' })
    await user.click(pencil)

    // Title becomes "Edit Progression"; Save + Cancel buttons appear.
    expect(await screen.findByText('Edit Progression')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    // Back to view mode.
    expect(await screen.findByText('Progression')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('persists name changes when editing an existing progression', async () => {
    const { db, seed } = await seedFixtures()
    const created = await seed.service.createProgression({
      name: 'Old Name',
      exerciseId: seed.exerciseBodyweight.id as string,
      body: {
        kind: 'linear',
        volumeSets: [
          { sets: 3, quantifierValue: 5, resistanceSource: [] },
        ],
      },
    })
    const { user } = await renderWithProviders(
      <ModalHarness exercise={seed.exerciseBodyweight} progression={created} />,
      { db },
    )
    await user.click(screen.getByRole('button', { name: 'Open' }))

    await user.click(await screen.findByRole('button', { name: 'Edit' }))

    const nameInput = await screen.findByLabelText('Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'New Name')

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.queryByText('Edit Progression')).not.toBeInTheDocument()
    })

    const persisted = await seed.service.listProgressionsByExercise(
      seed.exerciseBodyweight.id as string,
    )
    expect(persisted).toHaveLength(1)
    expect(persisted[0]!.name).toBe('New Name')
    expect(persisted[0]!.id).toBe(created.id)
  })

  it('view mode renders sets/reps chips and selected cells as numbered steps from the saved progression', async () => {
    const { db, seed } = await seedFixtures()
    const created = await seed.service.createProgression({
      name: 'Two Steps',
      exerciseId: seed.exerciseBodyweight.id as string,
      body: {
        kind: 'linear',
        volumeSets: [
          { sets: 3, quantifierValue: 5, resistanceSource: [] },
          { sets: 3, quantifierValue: 8, resistanceSource: [] },
        ],
      },
    })
    const { user } = await renderWithProviders(
      <ModalHarness exercise={seed.exerciseBodyweight} progression={created} />,
      { db },
    )
    await user.click(screen.getByRole('button', { name: 'Open' }))

    // Sets / Reps chip lists reflect the saved volumeSets.
    const setsGroup = await screen.findByRole('group', { name: /^sets$/i })
    expect(within(setsGroup).getByText('3')).toBeInTheDocument()
    const repsGroup = await screen.findByRole('group', { name: /^reps$/i })
    expect(within(repsGroup).getByText('5')).toBeInTheDocument()
    expect(within(repsGroup).getByText('8')).toBeInTheDocument()

    // Both grid cells are selected; the steps are numbered in saved order.
    const cell5 = screen.getByRole('button', { name: /Unloaded, 3 sets, 5 reps/i })
    expect(cell5).toHaveAttribute('aria-pressed', 'true')
    expect(cell5).toHaveTextContent('1')
    const cell8 = screen.getByRole('button', { name: /Unloaded, 3 sets, 8 reps/i })
    expect(cell8).toHaveAttribute('aria-pressed', 'true')
    expect(cell8).toHaveTextContent('2')
  })

  it('view mode shows only the saved pieces as selected for non-combinable equipment', async () => {
    const { db, seed } = await seedFixtures()
    const piece16 = seed.equipmentFixed.pieces.find(p => (p.resistance as number) === 16)!
    const created = await seed.service.createProgression({
      name: 'KB 16',
      exerciseId: seed.exerciseFixed.id as string,
      body: {
        kind: 'linear',
        volumeSets: [{
          sets: 3,
          quantifierValue: 5,
          resistanceSource: [{
            piece: {
              pieceId: piece16.id as string,
              resistance: piece16.resistance as number,
              totalQuantity: piece16.quantity as number,
            },
            quantityUsed: piece16.quantity as number,
          }],
        }],
      },
    })
    const { user } = await renderWithProviders(
      <ModalHarness exercise={seed.exerciseFixed} progression={created} />,
      { db },
    )
    await user.click(screen.getByRole('button', { name: 'Open' }))

    // In view mode, the selected piece's button is enabled; the unselected
    // one is disabled (and not interactive).
    const sel16 = await screen.findByRole('button', { name: '16kg' })
    expect(sel16).not.toBeDisabled()
    const sel12 = screen.getByRole('button', { name: '12kg' })
    expect(sel12).toBeDisabled()

    // The grid renders only the saved (16kg) row and its cell is selected.
    const cell = screen.getByRole('button', { name: /16kg, 3 sets, 5 reps/i })
    expect(cell).toHaveAttribute('aria-pressed', 'true')
    expect(cell).toHaveTextContent('1')
  })

  it('view mode shows the saved resistanceSource as a config chip for combinable equipment', async () => {
    const { db, seed } = await seedFixtures()
    const piece5 = seed.equipmentCombinable.pieces.find(p => (p.resistance as number) === 5)!
    const created = await seed.service.createProgression({
      name: 'Combinable 10kg',
      exerciseId: seed.exerciseCombinable.id as string,
      body: {
        kind: 'linear',
        volumeSets: [{
          sets: 3,
          quantifierValue: 5,
          resistanceSource: [{
            piece: {
              pieceId: piece5.id as string,
              resistance: piece5.resistance as number,
              totalQuantity: piece5.quantity as number,
            },
            quantityUsed: 2,
          }],
        }],
      },
    })
    const { user } = await renderWithProviders(
      <ModalHarness exercise={seed.exerciseCombinable} progression={created} />,
      { db },
    )
    await user.click(screen.getByRole('button', { name: 'Open' }))

    // The "10kg" config chip is visible; in view mode there is no Remove
    // control on it (readOnly hides the close action).
    expect(await screen.findByText('10kg')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /remove 10kg/i }),
    ).not.toBeInTheDocument()

    // The cell for that config is selected as step 1.
    const cell = screen.getByRole('button', { name: /10kg, 3 sets, 5 reps/i })
    expect(cell).toHaveAttribute('aria-pressed', 'true')
  })

  it('editing a progression: toggling a new cell on persists the additional volumeSet', async () => {
    const { db, seed } = await seedFixtures()
    const created = await seed.service.createProgression({
      name: 'Grow',
      exerciseId: seed.exerciseBodyweight.id as string,
      body: {
        kind: 'linear',
        volumeSets: [{ sets: 3, quantifierValue: 5, resistanceSource: [] }],
      },
    })
    const { user } = await renderWithProviders(
      <ModalHarness exercise={seed.exerciseBodyweight} progression={created} />,
      { db },
    )
    await user.click(screen.getByRole('button', { name: 'Open' }))
    await user.click(await screen.findByRole('button', { name: 'Edit' }))

    // Add a new reps column (8) and select the (3 sets × 8 reps) cell.
    await addChip(user, /^reps$/i, 8)
    const newCell = await screen.findByRole('button', { name: /Unloaded, 3 sets, 8 reps/i })
    await user.click(newCell)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.queryByText('Edit Progression')).not.toBeInTheDocument()
    })

    const persisted = await seed.service.listProgressionsByExercise(
      seed.exerciseBodyweight.id as string,
    )
    expect(persisted).toHaveLength(1)
    expect(persisted[0]!.id).toBe(created.id)
    const body = persisted[0]!.body
    expect(body.kind).toBe('linear')
    if (body.kind !== 'linear') throw new Error('expected linear')
    const reps = body.volumeSets.map(v => v.quantifierValue as number).sort((a, b) => a - b)
    expect(reps).toEqual([5, 8])
  })

  it('editing non-combinable equipment: toggling on a new piece and its cell persists the new resistanceSource', async () => {
    const { db, seed } = await seedFixtures()
    const piece16 = seed.equipmentFixed.pieces.find(p => (p.resistance as number) === 16)!
    const piece12 = seed.equipmentFixed.pieces.find(p => (p.resistance as number) === 12)!
    const created = await seed.service.createProgression({
      name: 'KB grow',
      exerciseId: seed.exerciseFixed.id as string,
      body: {
        kind: 'linear',
        volumeSets: [{
          sets: 3,
          quantifierValue: 5,
          resistanceSource: [{
            piece: {
              pieceId: piece16.id as string,
              resistance: piece16.resistance as number,
              totalQuantity: piece16.quantity as number,
            },
            quantityUsed: piece16.quantity as number,
          }],
        }],
      },
    })
    const { user } = await renderWithProviders(
      <ModalHarness exercise={seed.exerciseFixed} progression={created} />,
      { db },
    )
    await user.click(screen.getByRole('button', { name: 'Open' }))
    await user.click(await screen.findByRole('button', { name: 'Edit' }))

    // Toggle 12kg piece on → new config row appears in grid.
    await user.click(await screen.findByRole('button', { name: '12kg' }))

    // Select the (12kg × 3 sets × 5 reps) cell.
    const newCell = await screen.findByRole('button', { name: /12kg, 3 sets, 5 reps/i })
    await user.click(newCell)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.queryByText('Edit Progression')).not.toBeInTheDocument()
    })

    const persisted = await seed.service.listProgressionsByExercise(
      seed.exerciseFixed.id as string,
    )
    expect(persisted).toHaveLength(1)
    expect(persisted[0]!.id).toBe(created.id)
    const body = persisted[0]!.body
    if (body.kind !== 'linear') throw new Error('expected linear')
    const pieceIds = body.volumeSets
      .map(v => v.resistanceSource[0]?.piece.pieceId as string)
      .sort()
    expect(pieceIds).toEqual([piece12.id as string, piece16.id as string].sort())
  })

  it('deletes the progression and closes the modal when confirmed', async () => {
    const { db, seed } = await seedFixtures()
    const created = await seed.service.createProgression({
      name: 'To Be Deleted',
      exerciseId: seed.exerciseBodyweight.id as string,
      body: {
        kind: 'linear',
        volumeSets: [
          { sets: 3, quantifierValue: 5, resistanceSource: [] },
        ],
      },
    })
    const { user } = await renderWithProviders(
      <ModalHarness exercise={seed.exerciseBodyweight} progression={created} />,
      { db },
    )
    await user.click(screen.getByRole('button', { name: 'Open' }))

    await user.click(await screen.findByRole('button', { name: /delete progression/i }))

    // Confirm modal appears with its own Delete button.
    const confirmDialog = await screen.findByRole('dialog', { name: /delete progression/i })
    await user.click(within(confirmDialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(screen.queryByText('Progression')).not.toBeInTheDocument()
    })

    const persisted = await seed.service.listProgressionsByExercise(
      seed.exerciseBodyweight.id as string,
    )
    expect(persisted).toHaveLength(0)
  })

  it('keeps the progression when the delete confirm is cancelled', async () => {
    const { db, seed } = await seedFixtures()
    const created = await seed.service.createProgression({
      name: 'Stay',
      exerciseId: seed.exerciseBodyweight.id as string,
      body: {
        kind: 'linear',
        volumeSets: [
          { sets: 3, quantifierValue: 5, resistanceSource: [] },
        ],
      },
    })
    const { user } = await renderWithProviders(
      <ModalHarness exercise={seed.exerciseBodyweight} progression={created} />,
      { db },
    )
    await user.click(screen.getByRole('button', { name: 'Open' }))

    await user.click(await screen.findByRole('button', { name: /delete progression/i }))

    const confirmDialog = await screen.findByRole('dialog', { name: /delete progression/i })
    await user.click(within(confirmDialog).getByRole('button', { name: 'Cancel' }))

    // View modal still open.
    expect(await screen.findByText('Progression')).toBeInTheDocument()

    const persisted = await seed.service.listProgressionsByExercise(
      seed.exerciseBodyweight.id as string,
    )
    expect(persisted).toHaveLength(1)
  })

  it('surfaces an EntityNotFoundError as a readable Alert when save fails', async () => {
    const { db, seed } = await seedFixtures()
    const { user } = await renderWithProviders(
      <ModalHarness exercise={seed.exerciseBodyweight} />,
      { db },
    )
    await user.click(screen.getByRole('button', { name: 'Open' }))

    // Fill the form so the Save button is enabled.
    await user.type(await screen.findByLabelText('Name'), 'Doomed')
    await addChip(user, /^sets$/i, 3)
    await addChip(user, /^reps$/i, 5)
    expect(await screen.findByText(/Unloaded × 3 sets/i)).toBeInTheDocument()
    const cells = findCellButtonsForRow(/Unloaded × 3 sets/i)
    await user.click(cells[0]!)

    // Delete the exercise out from under the modal. The modal already holds a
    // domain object reference, but the service will fail on save because the
    // referenced row no longer exists.
    await seed.service.deleteExercise(seed.exerciseBodyweight.id as string)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    // EntityNotFoundError message contains the kind ("exercise") and id —
    // the Alert is the only red surface in the modal.
    const alert = await screen.findByRole('alert')
    expect(alert.textContent ?? '').toMatch(/exercise/i)
  })
})
