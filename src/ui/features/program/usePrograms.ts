import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useProgramAuthoring } from '../../providers/AppServicesProvider'
import { programQueries } from './programKeys'
import { invalidateProgramAfterDelete, invalidateProgramAfterWrite } from './programInvalidations'
import type { ProgramServiceInput } from '../../../app'
import type { ProgramDef } from '../../../domain'

export function useProgramList() {
  const service = useProgramAuthoring()
  return useQuery(programQueries.list(service))
}

export function useProgramDetail(id: string) {
  const service = useProgramAuthoring()
  return useQuery(programQueries.detail(service, id))
}

export function useCreateProgram(options?: { onSuccess?: (id: string) => void }) {
  const service = useProgramAuthoring()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ProgramServiceInput) => service.createProgram(input),
    onSuccess: (program: ProgramDef) => {
      invalidateProgramAfterWrite(queryClient)
      options?.onSuccess?.(program.id as string)
    },
  })
}

export function useUpdateProgram(options?: { onSuccess?: () => void }) {
  const service = useProgramAuthoring()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ProgramServiceInput }) =>
      service.updateProgram(id, input),
    onSuccess: () => {
      invalidateProgramAfterWrite(queryClient)
      options?.onSuccess?.()
    },
  })
}

export function useDeleteProgram(options?: { onSuccess?: () => void }) {
  const service = useProgramAuthoring()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => service.deleteProgram(id),
    onSuccess: (_, id) => {
      invalidateProgramAfterDelete(queryClient, id)
      options?.onSuccess?.()
    },
  })
}
