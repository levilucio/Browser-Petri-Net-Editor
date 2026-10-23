#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { inventoryExamples, createInventoryExample } from '../../../src/satel/examples/inventory/editor.js';
import { generatePNML } from '../../../src/utils/pnml/writer.js';
const dom = new JSDOM();
globalThis.document = dom.window.document; globalThis.XMLSerializer = dom.window.XMLSerializer;
// Deliberately fixed repository location: examples belong beside their source,
// not in performance reports or an OS-specific absolute directory.
for (const entry of inventoryExamples) {
  writeFileSync(new URL(`../../../src/satel/examples/inventory/${entry.filename}.pnml`, import.meta.url), generatePNML(createInventoryExample(entry.filename)));
}
dom.window.close();
console.log(`Exported ${inventoryExamples.length} inventory references and mutants under src/satel/examples/inventory`);
