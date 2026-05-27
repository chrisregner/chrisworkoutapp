import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Alert, Button, Center, Loader, Stack } from '@mantine/core'
import { getDb, type Db } from '../../persistence/client'

const DbContext = createContext<Db | null>(null)

export function DbProvider({ children, db: injectedDb }: { children: ReactNode; db?: Db }) {
  const [db, setDb] = useState<Db | null>(injectedDb ?? null)
  const [error, setError] = useState<Error | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (injectedDb) return
    let cancelled = false
    setError(null)
    getDb().then(
      d => { if (!cancelled) setDb(d) },
      e => { if (!cancelled) setError(e instanceof Error ? e : new Error(String(e))) },
    )
    return () => { cancelled = true }
  }, [attempt, injectedDb])

  if (error) {
    return (
      <Center h="100vh" p="md">
        <Stack align="center" gap="md">
          <Alert color="red" title="Failed to initialize database">
            {error.message}
          </Alert>
          <Button onClick={() => setAttempt(a => a + 1)}>Retry</Button>
        </Stack>
      </Center>
    )
  }

  if (!db) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    )
  }

  return <DbContext.Provider value={db}>{children}</DbContext.Provider>
}

export function useDb(): Db {
  const db = useContext(DbContext)
  if (!db) throw new Error('useDb outside DbProvider')
  return db
}
