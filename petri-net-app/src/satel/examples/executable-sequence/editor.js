import { createOracleAccountExample } from '../oracle-account/editor.js';

export function createExecutableSequenceExample(mutant = false) {
  const net = createOracleAccountExample(mutant ? 'oracle-account-no-debit' : 'oracle-account-reference');
  net.places.find(p => p.id === 'balance').valueTokens = [10];
  net.testIntentions = [{ id: 'executable-sequence', kind: 'symbolic', name: 'Withdraw twice — choose the first amount from the whole sequence',
    description: 'The zero class withdraws 0 then 10. The positive class must choose 3 before withdrawing 7, so the final balance is zero. A static representative of 1 cannot satisfy that sequence.',
    symbolic: { source: `operation isZero(Nat): Bool
rule zero(n: Nat): isZero(n) = true if n == 0
rule positive(n: Nat): isZero(n) = false if n > 0`, operation: 'isZero', argsText: 'n', variablesText: 'n: Nat', conditionsText: 'n <= 10', maxDepth: 2,
      protocolSource: `case zero(n: Nat):
inputs n
result true
pair withdraw(n=n) => ack(1), paidAmount(n)
pair withdraw(n=10) => ack(1), paidAmount(10)
pair query() => balanceResult(0)

case positive(n: Nat):
inputs n
result false
pair withdraw(n=n) => ack(1), paidAmount(n)
pair withdraw(n=7) => ack(1), paidAmount(7)
pair query() => balanceResult(0)` } }];
  net.satelExample = { id: mutant ? 'executable-sequence-mutant' : 'executable-sequence',
    name: mutant ? 'Whole-sequence selection — no-debit mutant' : 'Whole-sequence selection — Reference', role: mutant ? 'mutant' : 'reference',
    description: 'Initial balance 10. The final zero balance constrains the first withdrawal. Generate on the reference, then replay the frozen suite on the mutant.' };
  return net;
}
