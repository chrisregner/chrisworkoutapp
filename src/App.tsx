import { Container, Title } from '@mantine/core'
import { Route, Routes } from 'react-router-dom'

export function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Container py="xl">
            <Title>Hello world</Title>
          </Container>
        }
      />
    </Routes>
  )
}
