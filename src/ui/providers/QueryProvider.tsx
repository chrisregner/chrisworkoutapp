import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, type ReactNode } from 'react'

// Local PGLite is the source of truth; data only changes via our own mutations,
// so cached queries stay fresh until we invalidate. No window/focus refetching.
const defaultOptions = {
  queries: {
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  },
  mutations: {
    retry: 0,
  },
} as const

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions }))
  return (
    <QueryClientProvider client={client}>
      {children}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
