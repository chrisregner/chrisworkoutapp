import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useDb } from './DbProvider'
import { ProgramAuthoringService } from '../../app'

type AppServices = {
  programAuthoring: ProgramAuthoringService
}

const AppServicesContext = createContext<AppServices | null>(null)

export function AppServicesProvider({ children }: { children: ReactNode }) {
  const db = useDb()
  const services = useMemo<AppServices>(
    () => ({ programAuthoring: new ProgramAuthoringService(db) }),
    [db],
  )
  return <AppServicesContext.Provider value={services}>{children}</AppServicesContext.Provider>
}

export function useProgramAuthoring(): ProgramAuthoringService {
  const s = useContext(AppServicesContext)
  if (!s) throw new Error('useProgramAuthoring outside AppServicesProvider')
  return s.programAuthoring
}
