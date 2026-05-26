import React from 'react'
import ReactDOM from 'react-dom/client'
import { MantineProvider, createTheme } from '@mantine/core'
import { BrowserRouter } from 'react-router-dom'
import '@mantine/core/styles.css'
import { App } from './App'
import { DbProvider } from './db/DbProvider'

const theme = createTheme({
  primaryColor: 'blue',
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <DbProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </DbProvider>
    </MantineProvider>
  </React.StrictMode>,
)
