import {writeFileSync,mkdirSync} from 'node:fs';import {resolve} from 'node:path';
import {root} from './runtime.mjs';import {effectivenessFixture,lengths} from './effectiveness-fixture.mjs';
const {net}=effectivenessFixture(1);net.testIntentions=lengths.map(n=>effectivenessFixture(n).intention);
net.satelExample={id:'hr-effectiveness',name:'HR management — Observable histories',role:'reference',description:'Separate experiment: reads, decisions, repeated corrections, totals and employee isolation.'};
mkdirSync(resolve(root,'specification'),{recursive:true});const path=resolve(root,'specification/hr-effectiveness.apn.json');writeFileSync(path,JSON.stringify(net,null,2));console.log(path);
