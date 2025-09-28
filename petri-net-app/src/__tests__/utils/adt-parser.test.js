import { parseADT, validateADT, generateADT } from '../../utils/adt-parser';

describe('ADT parser and validator', () => {
  const sample = `
  <algebraicDataTypes>
    <type name="Int">
      <operation name="+" arity="2" result="Int"/>
      <axioms>
        <axiom name="commutativity">x + y = y + x</axiom>
      </axioms>
    </type>
  </algebraicDataTypes>`;

  test('parses ADT XML', () => {
    const adt = parseADT(sample);
    expect(adt.types.length).toBe(1);
    expect(adt.types[0].name).toBe('Int');
    expect(adt.types[0].operations[0]).toEqual({ name: '+', arity: 2, result: 'Int', params: [] });
    expect(adt.types[0].axioms[0].equation).toContain('=');
  });

  test('validates ADT structure', () => {
    const adt = parseADT(sample);
    const res = validateADT(adt);
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
  });

  test('generates ADT XML', () => {
    const xml = generateADT({ types: [{ name: 'Bool', operations: [{ name: 'and', arity: 2, result: 'Bool', params: [] }], axioms: [] }] });
    expect(xml).toContain('<algebraicDataTypes>');
    expect(xml).toContain('<type name="Bool">');
    expect(xml).toContain('operation');
  });
});


