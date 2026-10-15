import { runOracleAccountExample } from '../../src/satel/examples/oracle-account/run.js';

try {
  const result = await runOracleAccountExample();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const { suite, reference, mutants } = result;
    console.log(`Reference validation: ${suite.validation.referencePassed}/${suite.validation.generated} generated tests passed`);
    console.log(`Subuniformity: ${suite.decomposition.domains.length} symbolic subdomains; ${suite.selectedTests.length} representatives`);
    for (const domain of suite.decomposition.domains) {
      console.log(`  ${domain.id}: ${JSON.stringify(domain.witnessArgs[1])}`);
    }
    console.log(`Selected tests on reference: ${reference.counts.pass} pass, ${reference.counts.fail} fail, ${reference.counts.error} error`);
    console.log('\nMutant                          Refined      Coarse       Audit Amount(0..12)');
    for (const mutant of mutants) {
      const coarse = result.coarse.mutants.find(m => m.id === mutant.id).selected.status;
      console.log(`${mutant.id.padEnd(32)}${mutant.selected.status.padEnd(13)}${coarse.padEnd(13)}${mutant.audit.status}`);
      for (const r of mutant.selected.results.filter(r => r.verdict !== 'pass')) {
        console.log(`  ${r.id}: ${r.verdict} at step ${r.step ?? '?'} (${r.reason})`);
      }
    }
    console.log('\nThe boundary mutant survives the coarse equations, but is killed after symbolic refinement separates equality.');
    console.log('Neither selection proves uniform fault behavior within a subdomain.');
    console.log('Audit samples do not participate in symbolic decomposition.');
    console.log('Use --json for equations, symbolic subdomains, witnesses, frozen oracles and execution results.');
  }
  if (result.reference.counts.fail || result.reference.counts.error ||
      result.mutants.some(m => m.selected.status === 'error' || m.audit.status === 'error') ||
      result.coarse.mutants.some(m => m.selected.status === 'error')) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
