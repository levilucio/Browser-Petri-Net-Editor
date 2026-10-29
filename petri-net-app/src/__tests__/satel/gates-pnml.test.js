import { exportToPNML, importFromPNML } from '../../utils/python/index';
import { methodGateExamples, createMethodGateExample } from '../../satel/examples/methods-gates/editor';
import { publicInterface } from '../../satel/core/TestCase';
import { serializeMethodGateSource, parseMethodGateSource } from '../../domain/apn/MethodGateSyntax';
import { enumerateMethodSuccessors } from '../../domain/apn/PublicMethods';
test.each(methodGateExamples)('$filename: PNML retains gates, rule synchronization, intentions and source',async e=>{
 const net=createMethodGateExample(e.filename), loaded=await importFromPNML(await exportToPNML(net));
 expect(publicInterface(loaded)).toEqual(publicInterface(net));
 expect(loaded.testIntentions).toEqual(net.testIntentions);
 expect(loaded.transitions.map(t=>t.gates)).toEqual(net.transitions.map(t=>t.gates));
 expect(serializeMethodGateSource(loaded)).toEqual(serializeMethodGateSource(net));
});
test('corrupt gate metadata is rejected at import',async()=>{
 const net=createMethodGateExample('gates-oracle-account-reference'),xml=await exportToPNML(net);
 await expect(importFromPNML(xml.replace('"gate":"ack"','"gate":"missing"'))).rejects.toThrow('Invalid SATEL metadata');
});

test('a version 1 envelope cannot smuggle in gate semantics', async () => {
 const xml = await exportToPNML(createMethodGateExample('gates-oracle-account-reference'));
 const doc = new DOMParser().parseFromString(xml, 'application/xml');
 doc.getElementsByTagNameNS('*', 'satel')[0].setAttribute('version', '1');
 await expect(importFromPNML(new XMLSerializer().serializeToString(doc))).rejects.toThrow('Gate metadata requires version 2');
});

test('export cannot silently discard gate calls without declarations or on internal rules', async () => {
 const undeclared = createMethodGateExample('gates-oracle-account-reference'); delete undeclared.gates;
 await expect(exportToPNML(undeclared)).rejects.toThrow('Invalid gate call');
 const internal = createMethodGateExample('gates-oracle-account-reference');
 internal.transitions.push({ id: 'internal', gates: {}, x: 0, y: 0 });
 await expect(exportToPNML(internal)).rejects.toThrow('Invalid gate synchronizations');
});
