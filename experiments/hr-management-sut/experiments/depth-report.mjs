import {readFileSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';import {createHash} from 'node:crypto';
import {root} from './runtime.mjs';import {auditDomains} from './depth-audit.mjs';
const names=process.argv.slice(2),outIndex=names.indexOf('--out'),output=outIndex>=0?names.splice(outIndex,2)[1]:'depth-audit';const results=[];
for(const name of names){const run=JSON.parse(readFileSync(resolve(root,`results/${name}.json`)));
 for(const row of run.results){const path=resolve(root,`results/depth-domains-${row.config.label}.json`),raw=readFileSync(path),{decomposition:d}=JSON.parse(raw);
  const audit=auditDomains(d.domains,row.config.length,{boundary:row.config.length<=3});
  results.push({run:name,label:row.config.label,config:row.config,classes:d.domains.length,frontierUnresolved:d.unresolved.length,unexpectedCoverageGap:!d.unresolved.length&&audit.missingInputs>0,domainFileSha256:createHash('sha256').update(raw).digest('hex'),audit});
  console.log(JSON.stringify({label:row.config.label,inputs:audit.inputs,missing:audit.missingInputs,checksPass:audit.partitionAndWitnessChecksPass}));
 }
}
const checks=results.every(r=>r.audit.partitionAndWitnessChecksPass&&!r.unexpectedCoverageGap);
writeFileSync(resolve(root,`results/${output}.json`),JSON.stringify({checker:'Independent pattern matcher, guard interpreter and procedural WorkLog oracle; no engine/solver imports.',results,allPartitionAndWitnessChecksPass:checks},null,2));
process.exit(checks?0:1);
