import { Route, Routes } from 'react-router-dom'
import { Text } from '@mantine/core'
import { AppShell } from '@mantine/core'
import { EquipmentListPage } from './features/equipment/EquipmentListPage'
import { ExerciseListPage } from './features/exercise/ExerciseListPage'
import { ProgramListPage } from './features/program/ProgramListPage'
import { ProgramNewPage, ProgramEditPage } from './features/program/ProgramEditPage'
import { BottomNav } from './components/BottomNav'

export function App() {
  return (
    <AppShell footer={{ height: 64 }}>
      <AppShell.Main>
        <Routes>
          <Route path="/" element={<Text p="md">Hello world</Text>} />
          <Route path="/equipments" element={<EquipmentListPage />} />
          <Route path="/exercises" element={<ExerciseListPage />} />
          <Route path="/programs" element={<ProgramListPage />} />
          <Route path="/programs/new" element={<ProgramNewPage />} />
          <Route path="/programs/:id/edit" element={<ProgramEditPage />} />
        </Routes>
      </AppShell.Main>
      <AppShell.Footer>
        <BottomNav />
      </AppShell.Footer>
    </AppShell>
  )
}
