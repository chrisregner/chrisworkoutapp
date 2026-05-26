import { Route, Routes } from 'react-router-dom'
import { Text } from '@mantine/core'
import { EquipmentListPage } from './features/equipment/EquipmentListPage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Text p="md">Hello world</Text>} />
      <Route path="/equipments" element={<EquipmentListPage />} />
    </Routes>
  )
}
