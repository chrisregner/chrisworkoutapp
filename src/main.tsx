import React from 'react'
import ReactDOM from 'react-dom/client'
import { MantineProvider, createTheme } from '@mantine/core'
import { BrowserRouter } from 'react-router-dom'
import '@mantine/core/styles.css'
import { App } from './ui/App'
import { DbProvider } from './ui/providers/DbProvider'
import { AppServicesProvider } from './ui/providers/AppServicesProvider'

const theme = createTheme({
  primaryColor: 'blue',
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <DbProvider>
        <AppServicesProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AppServicesProvider>
      </DbProvider>
    </MantineProvider>
  </React.StrictMode>,
)
