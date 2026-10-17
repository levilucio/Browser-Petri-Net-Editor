/** Machine-readable causes. Unknown feasibility never means unsatisfiable. */
export class DomainError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}
export function diagnostic(error, stage) {
  return {
    code: error.code || 'internal-error',
    stage,
    message: error.message,
    ...(error.details || {})
  };
}
export function checkCancelled(signal) {
  if (signal?.aborted) throw new DomainError('cancelled', 'SATEL operation cancelled');
}
