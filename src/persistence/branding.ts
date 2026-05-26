import type { PositiveInt, PositiveNumber, Uuid } from '../domain'

/**
 * Branded-primitive boundary helpers.
 *
 * Branded types (PositiveInt, PositiveNumber, Uuid) carry compile-time tags
 * that have no runtime representation — but TypeScript still requires an
 * explicit cast to assign them to a plain `number`/`string` (the row types).
 *
 * Centralizing the casts here means mappers don't sprout `as number` /
 * `as string` everywhere, and the brand-erasure is a single, documented op.
 */

export const unbrandNumber = (n: PositiveInt | PositiveNumber | number): number => n as number

export const unbrandUuid = (id: Uuid | string): string => id as string

export const unbrandNumberArray = (
  ns: readonly (PositiveInt | PositiveNumber | number)[],
): number[] => ns as readonly number[] as number[]
