// Bound native contexts even when callers submit many requests concurrently.
// Queue before allocating; a cancelled waiter is checked by the adapter on entry.
const requests = new WeakMap();
export function runOwnedQuery(Z3, run) {
  const result = (requests.get(Z3) || Promise.resolve()).then(run);
  requests.set(Z3, result.then(() => {}, () => {}));
  return result;
}

/** One native solver and context, released deterministically after a request.
 * No high-level Context/AST wrappers are created: their finalizers must never
 * outlive this context. All model/vector handles belong to the calling adapter
 * and must be released before release(). Async calls use the runtime-wide queue.
 */
export function createOwnedSolver(Z3) {
  const config = Z3.mk_config();
  let context;
  try { context = Z3.mk_context_rc(config); }
  finally { Z3.del_config(config); }
  let ptr, released = false, checking = false;
  const check = () => {
    const code = Z3.get_error_code(context);
    if (code !== 0) throw new Error(Z3.get_error_msg(context, code));
  };
  try {
    Z3.set_ast_print_mode(context, 2); // Z3_PRINT_SMTLIB2_COMPLIANT
    ptr = Z3.mk_solver(context); check();
    Z3.solver_inc_ref(context, ptr);
  } catch (error) { Z3.del_context(context); throw error; }
  const live = () => {
    if (released) throw new Error('Z3 query context has been released');
    if (checking) throw new Error('Z3 query is already being checked');
  };
  return {
    context, ptr,
    set(key, value) {
      live();
      if (key !== 'timeout' || !Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new Error('Z3 timeout must be an unsigned 32-bit integer');
      const params = Z3.mk_params(context);
      Z3.params_inc_ref(context, params);
      try {
        Z3.params_set_uint(context, params, Z3.mk_string_symbol(context, key), value); check();
        Z3.solver_set_params(context, ptr, params); check();
      } finally { Z3.params_dec_ref(context, params); }
    },
    fromString(text) { live(); Z3.solver_from_string(context, ptr, text); check(); },
    async check() {
      live();
      checking = true;
      try {
        const result = await Z3.solver_check_assumptions(context, ptr, []);
        check();
        if (result === 1) return 'sat';
        if (result === -1) return 'unsat';
        if (result === 0) return 'unknown';
        throw new Error('Unexpected Z3 check result');
      } finally { checking = false; }
    },
    push() { live(); Z3.solver_push(context, ptr); check(); },
    pop() { live(); Z3.solver_pop(context, ptr, 1); check(); },
    release() {
      if (released) return;
      if (checking) throw new Error('Cannot release a Z3 query during a check');
      released = true;
      try { Z3.solver_dec_ref(context, ptr); }
      finally { Z3.del_context(context); }
    }
  };
}
