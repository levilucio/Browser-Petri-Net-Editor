import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { methodGateExamples, createMethodGateExample } from '../../src/satel/examples/methods-gates/editor.js';
import { serializeMethodGateSource, parseMethodGateSource } from '../../src/domain/apn/MethodGateSyntax.js';
import { generatePNML } from '../../src/utils/pnml/writer.js';
const dom=new JSDOM();globalThis.document=dom.window.document;globalThis.XMLSerializer=dom.window.XMLSerializer;
const dir=resolve('../docs/satel/examples/methods-gates');await mkdir(dir,{recursive:true});
const manifest=[];
for(const e of methodGateExamples){
 const net=createMethodGateExample(e.filename),source=serializeMethodGateSource(net);
 parseMethodGateSource(source);
 await writeFile(resolve(dir,`${e.filename}.copn`),source);
 await writeFile(resolve(dir,`${e.filename}.pnml`),generatePNML(net));
 manifest.push({id:e.filename,name:e.displayName,role:net.satelExample.role,places:net.places.length,rules:net.transitions.length,gates:net.gates.length,intentions:net.testIntentions.length,retainedState:net.gateMigration.retainedState});
}
await writeFile(resolve(dir,'manifest.json'),JSON.stringify({sourceBranch:'codex/satel-methods-gates',examples:manifest},null,2)+'\n');
console.log(`Exported ${manifest.length} class/PNML pairs to ${dir}`);
