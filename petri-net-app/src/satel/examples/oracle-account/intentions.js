import { withdrawalGoal, coarseWithdrawalGoal } from './algebra.js';
import { formatSymbolicSource } from '../../core/SymbolicSource.js';
const protocolSource = `# Unmentioned public output places produce no tokens in each pair.
case all(b: Nat, remaining: Nat, paid: Nat):
inputs b, All()
result Result(remaining, Paid(paid))
pair deposit(n=b) => ack(1)
pair withdrawAll() => ack(1), paidAmount(paid)
pair query() => balanceResult(remaining)

case paid(b: Nat, n: Nat, remaining: Nat, paid: Nat):
inputs b, Amount(n)
result Result(remaining, Paid(paid))
pair deposit(n=b) => ack(1)
pair withdraw(n=n) => ack(1), paidAmount(paid)
pair query() => balanceResult(remaining)

case refused(b: Nat, n: Nat, remaining: Nat, refused: Nat):
inputs b, Amount(n)
result Result(remaining, Refused(refused))
pair deposit(n=b) => ack(1)
pair withdraw(n=n) => ack(0)
pair query() => balanceResult(remaining)`;
export function createAccountSymbolicIntentions() {
  return [withdrawalGoal, coarseWithdrawalGoal()].map((goal, i) => ({
    id: i ? 'account-coarse' : 'account-refined', kind: 'symbolic',
    name: i ? 'Account — affordable / unaffordable' : 'Account — less / equal / greater',
    description: 'Editable equation-derived withdrawal classes and stimulation/observation pair protocol.',
    symbolic: { source: formatSymbolicSource(goal.algebra), operation: goal.operation, argsText: '10, request',
      variablesText: 'request: Request', conditionsText: '', maxDepth: goal.maxDepth, protocolSource },
  }));
}
