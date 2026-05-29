/**
 * Behaviors covered:
 *
 * - Empty state: when no programs exist, renders an empty-state message.
 * - List: when programs exist, renders their names with microcycle/day counts.
 * - HL badge: program with a heavy/light exercise slot shows the badge.
 * - Delete flow: clicking Delete opens a confirm modal; confirming removes the program.
 * - Add navigation: clicking Add navigates to /programs/new (edit page renders).
 * - Edit navigation: clicking Edit navigates to /programs/:id/edit (edit page renders).
 */

import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { ProgramListPage } from '../ProgramListPage'
import { ProgramNewPage, ProgramEditPage } from '../ProgramEditPage'
import { renderWithProviders } from '../../../testing/renderWithProviders'
import { DefinitionsService, ProgramAuthoringService } from '../../../../app'
import { makeTestDb } from '../../../../persistence/testing'
import { DbProvider } from '../../../providers/DbProvider'
import { QueryProvider } from '../../../providers/QueryProvider'
import { AppServicesProvider } from '../../../providers/AppServicesProvider'

async function seedProgram(db: Awaited<ReturnType<typeof makeTestDb>>, name = 'Test Program') {
  const defsSvc = new DefinitionsService(db)
  const ex = await defsSvc.createExercise({
    name: 'Squat',
    quantifierType: 'reps',
    equipmentId: null,
  })
  const svc = new ProgramAuthoringService(db)
  return svc.createProgram({
    name,
    microcycles: [
      {
        id: crypto.randomUUID(),
        days: [
          {
            id: crypto.randomUUID(),
            activities: [
              {
                kind: 'exercise',
                exerciseId: ex.id as string,
                fallback: { sets: 3, quantifierValue: 5 },
              },
            ],
          },
        ],
      },
    ],
  })
}

async function seedHLProgram(db: Awaited<ReturnType<typeof makeTestDb>>) {
  const defsSvc = new DefinitionsService(db)
  const eq = await defsSvc.createEquipment({
    name: 'Plates',
    isCombinable: true,
    unit: 'kg',
    pieces: [
      { resistance: 5, quantity: 4, position: 0 },
      { resistance: 10, quantity: 2, position: 1 },
    ],
  })
  const lightPiece = eq.pieces[0]!
  const heavyPiece = eq.pieces[1]!
  const ex = await defsSvc.createExercise({
    name: 'Deadlift',
    quantifierType: 'reps',
    equipmentId: eq.id as string,
    shouldCombineResistance: false,
  })
  const prog = await defsSvc.createProgression({
    name: 'HL Deadlift',
    exerciseId: ex.id as string,
    body: {
      kind: 'heavyLight',
      plannedSets: [1, 3],
      plannedReps: [5],
      volumeSets: [
        {
          // heavy: 10kg × 1 set × 5 reps = 50; light: 5kg × 3 sets × 5 reps = 75 ✓
          heavy: {
            sets: 1, quantifierValue: 5,
            resistanceSource: [{ piece: { pieceId: heavyPiece.id as string, resistance: heavyPiece.resistance as number, totalQuantity: heavyPiece.quantity as number }, quantityUsed: 1 }],
          },
          light: {
            sets: 3, quantifierValue: 5,
            resistanceSource: [{ piece: { pieceId: lightPiece.id as string, resistance: lightPiece.resistance as number, totalQuantity: lightPiece.quantity as number }, quantityUsed: 1 }],
          },
        },
      ],
    },
  })
  const svc = new ProgramAuthoringService(db)
  return svc.createProgram({
    name: 'HL Program',
    microcycles: [
      {
        id: crypto.randomUUID(),
        days: [
          {
            id: crypto.randomUUID(),
            activities: [
              {
                kind: 'exercise',
                exerciseId: ex.id as string,
                progressionId: prog.id as string,
                hlPick: 'heavy',
              },
            ],
          },
        ],
      },
    ],
  })
}

describe('ProgramListPage', () => {
  it('renders empty state when no programs exist', async () => {
    await renderWithProviders(<ProgramListPage />)
    expect(await screen.findByText(/no programs yet/i)).toBeInTheDocument()
  })

  it('renders each program with its name and stats', async () => {
    const db = await makeTestDb()
    await seedProgram(db, 'Push Pull Legs')
    await renderWithProviders(<ProgramListPage />, { db })

    expect(await screen.findByText('Push Pull Legs')).toBeInTheDocument()
    expect(screen.getByText(/1 microcycle/i)).toBeInTheDocument()
    expect(screen.getByText(/1 day/i)).toBeInTheDocument()
  })

  it('shows the Heavy/Light badge for programs with an HL progression slot', async () => {
    const db = await makeTestDb()
    await seedHLProgram(db)
    await renderWithProviders(<ProgramListPage />, { db })

    expect(await screen.findByText('HL Program')).toBeInTheDocument()
    expect(screen.getByText(/heavy\/light/i)).toBeInTheDocument()
  })

  it('opens the delete modal and removes the program on confirm', async () => {
    const db = await makeTestDb()
    await seedProgram(db, 'Delete Me')
    const { user } = await renderWithProviders(<ProgramListPage />, { db })

    await screen.findByText('Delete Me')
    await user.click(screen.getByRole('button', { name: /^delete$/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Delete Me')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }))

    expect(await screen.findByText(/no programs yet/i)).toBeInTheDocument()
    expect(screen.queryByText('Delete Me')).not.toBeInTheDocument()
  })

  it('navigates to the new-program edit page when Add is clicked', async () => {
    const db = await makeTestDb()
    const user = userEvent.setup()

    render(
      <MantineProvider env="test">
        <DbProvider db={db}>
          <QueryProvider>
            <AppServicesProvider>
              <MemoryRouter initialEntries={['/programs']}>
                <Routes>
                  <Route path="/programs" element={<ProgramListPage />} />
                  <Route path="/programs/new" element={<ProgramNewPage />} />
                </Routes>
              </MemoryRouter>
            </AppServicesProvider>
          </QueryProvider>
        </DbProvider>
      </MantineProvider>,
    )

    await user.click(await screen.findByRole('button', { name: /^add$/i }))
    expect(await screen.findByText(/new program/i)).toBeInTheDocument()
  })

  it('navigates to the edit page when Edit is clicked', async () => {
    const db = await makeTestDb()
    await seedProgram(db, 'My Program')
    const user = userEvent.setup()

    render(
      <MantineProvider env="test">
        <DbProvider db={db}>
          <QueryProvider>
            <AppServicesProvider>
              <MemoryRouter initialEntries={['/programs']}>
                <Routes>
                  <Route path="/programs" element={<ProgramListPage />} />
                  <Route path="/programs/:id/edit" element={<ProgramEditPage />} />
                </Routes>
              </MemoryRouter>
            </AppServicesProvider>
          </QueryProvider>
        </DbProvider>
      </MantineProvider>,
    )

    await screen.findByText('My Program')
    await user.click(screen.getByRole('button', { name: /^edit$/i }))
    expect(await screen.findByText(/edit program/i)).toBeInTheDocument()
  })
})
