/** Independent procedural quota implementation. No APN or SATEL dependencies.
 * A new instance is the declared initial configuration: ten free, zero held.
 * Fault variants are explicit research fixtures, not independent validation.
 */
export const variants = ['reference', 'wrong-reservation', 'lost-release', 'wrong-audit', 'timeout'];
export function createQuotaService(variant = 'reference') {
  if (!variants.includes(variant)) throw new Error('Unknown quota variant');
  let available = 10, held = 0;
  return {
    invoke(operation, amount) {
      if (!['reserve', 'release', 'audit'].includes(operation)) throw new Error('Unknown operation');
      if (operation !== 'audit' && (!Number.isSafeInteger(amount) || amount < 0)) throw new Error('Enter a nonnegative integer');
      if (operation === 'audit') return {
        status: 'accepted', available: available + (variant === 'wrong-audit' ? 1 : 0), held
      };
      if (amount === 0 || amount > (operation === 'reserve' ? available : held)) return { status: 'refused' };
      if (operation === 'reserve') {
        const quantity = variant === 'wrong-reservation' ? Math.max(0, amount - 1) : amount;
        available -= quantity; held += quantity;
        return { status: 'accepted', priority: amount < 4 || amount === 7 };
      }
      held -= amount;
      if (variant !== 'lost-release') available += amount;
      return { status: 'accepted', acknowledged: true };
    }
  };
}
