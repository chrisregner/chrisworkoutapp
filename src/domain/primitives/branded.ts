import { InvariantViolationError } from './errors'

declare const brand: unique symbol

export type Brand<T, B> = T & { readonly [brand]: B }

export type PositiveInt = Brand<number, 'PositiveInt'>
export type PositiveNumber = Brand<number, 'PositiveNumber'>
export type Uuid = Brand<string, 'Uuid'>

export function positiveInt(n: number): PositiveInt {
  if (!Number.isInteger(n) || n < 1) {
    throw new InvariantViolationError('positiveInt', `expected integer >= 1, got ${n}`)
  }
  return n as PositiveInt
}

export function positiveNumber(n: number): PositiveNumber {
  if (!Number.isFinite(n) || n <= 0) {
    throw new InvariantViolationError('positiveNumber', `expected number > 0, got ${n}`)
  }
  return n as PositiveNumber
}

export function uuidOf(s: string): Uuid {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    throw new InvariantViolationError('uuid', `not a uuid: ${s}`)
  }
  return s as Uuid
}
