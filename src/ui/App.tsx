import { Route, Routes } from 'react-router-dom'
import { Text } from '@mantine/core'
import { AppShell } from '@mantine/core'
import { EquipmentListPage } from './features/equipment/EquipmentListPage'
import { ExerciseListPage } from './features/exercise/ExerciseListPage'
import { BottomNav } from './components/BottomNav'

export function App() {
  return (
    <AppShell footer={{ height: 'auto' }}>
      <AppShell.Main>
        <Routes>
          <Route path="/" element={<Text p="md">Hello world</Text>} />
          <Route path="/equipments" element={<EquipmentListPage />} />
          <Route path="/exercises" element={<ExerciseListPage />} />
        </Routes>
      </AppShell.Main>
      <AppShell.Footer>
        <BottomNav />
      </AppShell.Footer>
    </AppShell>
  )
}
