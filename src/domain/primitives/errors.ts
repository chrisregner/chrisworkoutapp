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
