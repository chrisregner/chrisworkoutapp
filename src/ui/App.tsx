import { Route, Routes } from 'react-router-dom'
import { EquipmentListPage } from './features/equipment/EquipmentListPage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<EquipmentListPage />} />
    </Routes>
  )
}
