import { useQuery } from '@tanstack/react-query'
import { useDefinitions } from '../../providers/AppServicesProvider'
import { exerciseQueries } from './exerciseKeys'

export function useExerciseList() {
  const service = useDefinitions()
  return useQuery(exerciseQueries.list(service))
}
