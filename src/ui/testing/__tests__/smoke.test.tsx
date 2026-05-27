import { describe, it, expect } from 'vitest'
import { Text } from '@mantine/core'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../renderWithProviders'

describe('renderWithProviders harness', () => {
  it('mounts a trivial component under the provider stack', async () => {
    await renderWithProviders(<Text>hello caveman</Text>)
    expect(screen.getByText('hello caveman')).toBeInTheDocument()
  })

  it('exposes a fresh test db on the result', async () => {
    const { db } = await renderWithProviders(<Text>x</Text>)
    expect(db).toBeDefined()
  })
})
