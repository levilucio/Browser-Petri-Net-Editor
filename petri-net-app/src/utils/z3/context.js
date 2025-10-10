let z3InitPromise = null;

export async function getContext() {
  if (!z3InitPromise) {
    z3InitPromise = (async () => {
      const { init } = await import('z3-solver');
      const z3 = await init();
      const ctx = new z3.Context('arith');
      return { z3, ctx };
    })();
  }
  return z3InitPromise;
}


