export class InvariantViolationError extends Error {
  readonly path: string
  readonly reason: string
  constructor(path: string, reason: string) {
    super(`${path}: ${reason}`)
    this.name = 'InvariantViolationError'
    this.path = path
    this.reason = reason
  }
}

export class EntityNotFoundError extends Error {
  readonly entity: string
  readonly id: string
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found`)
    this.name = 'EntityNotFoundError'
    this.entity = entity
    this.id = id
  }
}

export class ConflictError extends Error {
  readonly entity: string
  readonly reason: string
  constructor(entity: string, reason: string) {
    super(`${entity}: ${reason}`)
    this.name = 'ConflictError'
    this.entity = entity
    this.reason = reason
  }
}
