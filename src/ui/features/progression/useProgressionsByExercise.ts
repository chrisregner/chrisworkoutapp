import { useQuery } from '@tanstack/react-query'
import { useDefinitions } from '../../providers/AppServicesProvider'

export function useProgressionsByExercise(exerciseId: string) {
  const service = useDefinitions()
  return useQuery({
    queryKey: ['progression', 'by-exercise', exerciseId],
    queryFn: () => service.listProgressionsByExercise(exerciseId),
  })
}
