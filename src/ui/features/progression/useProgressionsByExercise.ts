import { useQuery } from '@tanstack/react-query'
import { useDefinitions } from '../../providers/AppServicesProvider'
import { progressionQueries } from './progressionKeys'

export function useProgressionsByExercise(exerciseId: string) {
  const service = useDefinitions()
  return useQuery(progressionQueries.byExercise(service, exerciseId))
}
