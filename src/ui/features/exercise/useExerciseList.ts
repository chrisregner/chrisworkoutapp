import { useQuery } from '@tanstack/react-query'
import { useDefinitions } from '../../providers/AppServicesProvider'

export const exerciseListQueryKey = ['exercise', 'list'] as const

export function useExerciseList() {
  const service = useDefinitions()
  return useQuery({
    queryKey: exerciseListQueryKey,
    queryFn: () => service.listExercises(),
  })
}
