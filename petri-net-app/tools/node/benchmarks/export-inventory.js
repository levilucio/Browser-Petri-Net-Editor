#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { inventoryExamples, createInventoryExample } from '../../../src/satel/examples/inventory/editor.js';
import { generatePNML } from '../../../src/utils/pnml/writer.js';
const dom = new JSDOM();
globalThis.document = dom.window.document; globalThis.XMLSerializer = dom.window.XMLSerializer;
// Loadable benchmark models live alongside the earlier scalability examples;
// their JavaScript generators remain under src/satel/examples.
const directory = new URL('../../../../docs/satel/performance/models/inventory/', import.meta.url);
mkdirSync(directory, { recursive: true });
for (const entry of inventoryExamples) {
  writeFileSync(new URL(`${entry.filename}.pnml`, directory), generatePNML(createInventoryExample(entry.filename)));
}
dom.window.close();
console.log(`Exported ${inventoryExamples.length} inventory references and mutants under docs/satel/performance/models/inventory`);
