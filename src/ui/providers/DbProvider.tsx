import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Center, Loader } from '@mantine/core'
import { getDb, type Db } from '../../persistence/client'

const DbContext = createContext<Db | null>(null)

export function DbProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Db | null>(null)

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

export function useDb(): Db {
  const db = useContext(DbContext)
  if (!db) throw new Error('useDb outside DbProvider')
  return db
}
