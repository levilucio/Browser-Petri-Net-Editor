import { inventory, inventoryMutants } from './models.js';

export const inventoryConfigurations = [
  { id: 'small', label: '5 pairs', config: { cycles: 1 } },
  { id: 'medium', label: '10 pairs / audit', config: { cycles: 2, rounds: 2, audit: true } },
  { id: 'large', label: '20 pairs / 4 warehouses', config: { sites: 4, cycles: 4, rounds: 2, audit: true } },
];
export const inventoryExamples = inventoryConfigurations.flatMap(({ id, label, config }) => [null, ...inventoryMutants].map(mutant => ({
  filename: `inventory-${id}-${mutant || 'reference'}`,
  displayName: `SATEL Inventory — ${label} — ${mutant || 'reference'}`,
  description: 'Generate on the reference, then replay the saved suite on its matching mutants.',
  config: { ...config, mutant }
})));
export function createInventoryExample(filename) {
  const entry = inventoryExamples.find(e => e.filename === filename);
  if (!entry) throw new Error(`Unknown inventory example: ${filename}`);
  const net = inventory(entry.config);
  net.satelExample.id = filename; net.satelExample.name = entry.displayName;
  return net;
}
