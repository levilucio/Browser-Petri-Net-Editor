/**
 * @typedef {import('../../domain/diagnostics.js').DomainError} DomainError
 *
 * RuntimeValue is a JS integer, Boolean, string, recursively nested Array,
 * or { __pair__: true, fst: RuntimeValue, snd: RuntimeValue }.
 * A SymbolicTerm uses {var}, {ctor,args}, {call,args}, or {op,left,right};
 * its variables MUST NOT be confused with runtime values or token occurrences.
 *
 * @typedef {Object.<string, Array<*>>} Marking
 * @typedef {{method: string, arguments: Object.<string, *>}} MethodStimulation
 * @typedef {{scope: 'listed'|'public', outputs: Marking, markings?: Object}} Observation
 * @typedef {{assertion: 'required'|'blocked', stimulation: MethodStimulation, observation: Observation}} Pair
 * @typedef {{id: string, schemaVersion: 7, pairs: Pair[], interface?: Object}} ConcreteTest
 * @typedef {{id: string, verdict: 'pass'|'fail'|'error', step?: number, reason?: string, diagnostic?: Object, pairResults: Object[], markings: Marking[]}} ReplayResult
 *
 * SelectionReport.decomposition is static algebraic evidence. It is never
 * overwritten by execution. SelectionReport.execution contains selected,
 * blocked and unresolved classes plus search counters. A selected entry keeps
 * staticWitness and its separately selected witness with path evidence.
 *
 * A frozen suite contains ConcreteTest[] in selectedTests. Legacy steps and
 * expected projections may remain for file/API compatibility, but conflicting
 * projections are invalid. Only admission can set oracleValidated to true.
 */
export {};
