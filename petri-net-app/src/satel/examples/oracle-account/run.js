import { generateValidatedSubuniformitySuite, validateOracleCandidates, evaluateOracleSuite, evaluateSpecMutants } from '../../core/ValidatedSubuniformity.js';
import { accountNet, accountInterface, accountAuditCandidates, accountMutants } from './net.js';
import { withdrawalGoal, coarseWithdrawalGoal, encodeAccountWitness } from './algebra.js';

export async function runOracleAccountExample() {
  const suite = await generateValidatedSubuniformitySuite({
    referenceNet: accountNet, io: accountInterface, symbolicGoal: withdrawalGoal,
    encodeWitness: encodeAccountWitness,
  });
  const reference = await evaluateOracleSuite(suite.selectedTests, suite.referenceNet, suite.interface);
  const auditTests = await validateOracleCandidates({ referenceNet: accountNet, io: accountInterface, candidates: accountAuditCandidates() });
  const mutants = await evaluateSpecMutants(suite, accountMutants(), auditTests);
  const coarseSuite = await generateValidatedSubuniformitySuite({
    referenceNet: accountNet, io: accountInterface, symbolicGoal: coarseWithdrawalGoal(), encodeWitness: encodeAccountWitness,
  });
  const coarseMutants = await evaluateSpecMutants(coarseSuite, accountMutants());
  return { suite, reference, auditTests, mutants, coarse: { suite: coarseSuite, mutants: coarseMutants } };
}
