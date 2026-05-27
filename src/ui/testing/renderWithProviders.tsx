import type { ReactElement } from 'react'
import { MantineProvider } from '@mantine/core'
import { MemoryRouter } from 'react-router-dom'
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import type { Db } from '../../persistence/client'
import { makeTestDb } from '../../persistence/testing'
import { DbProvider } from '../providers/DbProvider'
import { QueryProvider } from '../providers/QueryProvider'
import { AppServicesProvider } from '../providers/AppServicesProvider'

export type RenderWithProvidersOptions = {
  db?: Db
  route?: string
  renderOptions?: Omit<RenderOptions, 'wrapper'>
}

export type RenderWithProvidersResult = RenderResult & {
  db: Db
  user: UserEvent
}

/**
 * Render a UI tree under the full real provider stack with a fresh in-memory
 * PGLite database. No service mocks. Tests interact through the rendered DOM
 * the same way a user would.
 *
 * If `db` is omitted, a fresh `makeTestDb()` is created. Returned `db` lets
 * tests seed state directly via repos when faster than driving the UI.
 */
export async function renderWithProviders(
  ui: ReactElement,
  opts: RenderWithProvidersOptions = {},
): Promise<RenderWithProvidersResult> {
  const db = opts.db ?? (await makeTestDb())
  const route = opts.route ?? '/'

  const result = render(ui, {
    ...opts.renderOptions,
    wrapper: ({ children }) => (
      <MantineProvider env="test">
        <DbProvider db={db}>
          <QueryProvider>
            <AppServicesProvider>
              <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
            </AppServicesProvider>
          </QueryProvider>
        </DbProvider>
      </MantineProvider>
    ),
  })

  return { ...result, db, user: userEvent.setup() }
}
