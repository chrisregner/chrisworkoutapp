import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { PGlite } from '@electric-sql/pglite'
import { Center, Loader } from '@mantine/core'
import { getDb } from './pglite'

const DbContext = createContext<PGlite | null>(null)

export function DbProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<PGlite | null>(null)

  useEffect(() => {
    let cancelled = false
    getDb().then(d => { if (!cancelled) setDb(d) })
    return () => { cancelled = true }
  }, [])

  if (!db) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    )
  }

  return <DbContext.Provider value={db}>{children}</DbContext.Provider>
}

export function useDb(): PGlite {
  const db = useContext(DbContext)
  if (!db) throw new Error('useDb outside DbProvider')
  return db
}
