/**
 * Real Jest tests for the PNML parser (no mocks)
 */

import { parsePNML, generatePNML } from '../../utils/pnml-parser';

describe('PNML Parser (real)', () => {
  const simplePNML = `
  <pnml xmlns="http://www.pnml.org/version-2009/grammar/pnml">
    <net id="net1" type="http://www.pnml.org/version-2009/grammar/ptnet">
      <name><text>Petri Net</text></name>
      <page id="page1">
        <place id="place-1">
          <name><text>P1</text></name>
          <graphics><position x="100" y="100"/></graphics>
          <initialMarking><text>2</text></initialMarking>
        </place>
        <transition id="transition-1">
          <name><text>T1</text></name>
          <graphics><position x="200" y="200"/></graphics>
        </transition>
        <arc id="arc-1" source="place-1" target="transition-1">
          <graphics>
            <metadata>
              <sourceDirection>south</sourceDirection>
              <targetDirection>north</targetDirection>
            </metadata>
          </graphics>
        </arc>
      </page>
    </net>
  </pnml>`;

  test('parsePNML parses a simple PNML (with namespaces) into JSON', () => {
    const result = parsePNML(simplePNML);
    expect(result).toBeTruthy();
    expect(Array.isArray(result.places)).toBe(true);
    expect(Array.isArray(result.transitions)).toBe(true);
    expect(Array.isArray(result.arcs)).toBe(true);

    expect(result.places).toHaveLength(1);
    expect(result.transitions).toHaveLength(1);
    expect(result.arcs).toHaveLength(1);

    const p1 = result.places[0];
    expect(p1.id).toBe('place-1');
    expect(p1.name).toBe('P1');
    expect(p1.x).toBe(100);
    expect(p1.y).toBe(100);
    expect(p1.tokens).toBe(2); // initialMarking

    const t1 = result.transitions[0];
    expect(t1.id).toBe('transition-1');
    expect(t1.name).toBe('T1');
    expect(t1.x).toBe(200);
    expect(t1.y).toBe(200);

    const a1 = result.arcs[0];
    expect(a1.id).toBe('arc-1');
    expect(a1.source).toBe('place-1');
    expect(a1.target).toBe('transition-1');
    expect(a1.type).toBe('place-to-transition');
  });

  test('parsePNML returns empty arrays for invalid/empty input without throwing', () => {
    const result = parsePNML('');
    expect(result.places).toHaveLength(0);
    expect(result.transitions).toHaveLength(0);
    expect(result.arcs).toHaveLength(0);
  });

  test('generatePNML produces a PNML string from a JSON Petri net and validates arcs', () => {
    const net = {
      places: [
        { id: 'place-1', name: 'P1', x: 100, y: 100, tokens: 1 },
        { id: 'place-2', name: 'P2', x: 300, y: 100, tokens: 0 },
      ],
      transitions: [
        { id: 'transition-1', name: 'T1', x: 200, y: 100 },
      ],
      arcs: [
        { id: 'valid-arc-1', source: 'place-1', target: 'transition-1', weight: 1 },
        { id: 'valid-arc-2', sourceId: 'transition-1', targetId: 'place-2', weight: 1 }, // alternative props
        { id: 'invalid-arc-1', source: 'undefined', target: 'transition-1' },
        { id: 'invalid-arc-2', source: 'place-1', target: 'undefined' },
      ],
    };

    const xml = generatePNML(net);
    expect(typeof xml).toBe('string');
    expect(xml).toContain('<pnml');
    expect(xml).toContain('<net');

    // Valid arcs should render; invalid ones should be filtered
    expect(xml).toContain('valid-arc-1');
    expect(xml).toContain('valid-arc-2');
    expect(xml).not.toContain('invalid-arc-1');
    expect(xml).not.toContain('invalid-arc-2');
  });

  // Removed legacy single-binding assertion test; bindings are now represented as bags

  test('generatePNML emits APN namespace elements when algebraic annotations present', () => {
    const net = {
      places: [ { id: 'p1', name: 'P1', x: 0, y: 0, valueTokens: [2,4], type: 'Integer' } ],
      transitions: [ { id: 't1', name: 'T1', x: 10, y: 10, guard: 'x>1', action: 'y=x+1' } ],
      arcs: [ { id: 'a1', source: 'p1', target: 't1', binding: 'x' } ]
    };
    const xml = generatePNML(net);
    expect(xml).toContain('xmlns:apn=');
    expect(xml).toContain('<apn:type');
    expect(xml).toContain('<apn:guard');
    expect(xml).toContain('<apn:action');
    expect(xml).toContain('<apn:binding');
    expect(xml).toMatch(/<apn:valueTokens[^>]*>/);
    expect(xml).toContain('<apn:token><apn:text>2</apn:text></apn:token>');
    expect(xml).toContain('<apn:token><apn:text>4</apn:text></apn:token>');
  });

  test('generatePNML handles mixed arc formats (source/target and sourceId/targetId)', () => {
    const net = {
      places: [ { id: 'place-1', name: 'P1', x: 10, y: 10, tokens: 0 } ],
      transitions: [ { id: 'transition-1', name: 'T1', x: 20, y: 20 } ],
      arcs: [
        { id: 'arc-1', source: 'place-1', target: 'transition-1', weight: 1 },
        { id: 'arc-2', sourceId: 'transition-1', targetId: 'place-1', weight: 1 },
      ],
    };

    const xml = generatePNML(net);
    expect(typeof xml).toBe('string');
    expect(xml).toContain('arc-1');
    expect(xml).toContain('arc-2');
  });

  test('parsePNML extracts Browser-Petri-Net-Editor properties from <toolspecific>', () => {
    const pnmlWithProps = `
    <pnml xmlns="http://www.pnml.org/version-2009/grammar/pnml">
      <net xmlns="" id="net1" type="http://www.pnml.org/version-2009/grammar/ptnet" netMode="pt">
        <name><text>Petri Net</text></name>
        <toolspecific tool="Browser-Petri-Net-Editor" version="1">
          <properties>
            <property id="p_dead" name="Deadlock exists" type="exists_deadlock" severity="error"/>
            <property id="p_cov" name="Cover p1&gt;=1" type="exists_coverable" severity="error">
              <predicate><ge place="place-1" k="1"/></predicate>
            </property>
            <property id="p_inv" name="Invariant p1&lt;=2 AND p1&gt;=0" type="invariant" severity="error">
              <predicate>
                <and>
                  <le place="place-1" k="2"/>
                  <ge place="place-1" k="0"/>
                </and>
              </predicate>
            </property>
          </properties>
        </toolspecific>
        <page id="page1">
          <place id="place-1"><name><text>P1</text></name><graphics><position x="10" y="10"/></graphics><initialMarking><text>1</text></initialMarking></place>
          <transition id="t1"><name><text>T1</text></name><graphics><position x="20" y="20"/></graphics></transition>
          <arc id="a1" source="place-1" target="t1"><inscription><text>1</text></inscription></arc>
          <arc id="a2" source="t1" target="place-1"><inscription><text>1</text></inscription></arc>
        </page>
      </net>
    </pnml>`;

    const result = parsePNML(pnmlWithProps);
    expect(Array.isArray(result.properties)).toBe(true);
    expect(result.properties).toHaveLength(3);

    const dead = result.properties.find(p => p.id === 'p_dead');
    expect(dead).toBeTruthy();
    expect(dead.type).toBe('exists_deadlock');
    expect(dead.predicates).toEqual([]);

    const cov = result.properties.find(p => p.id === 'p_cov');
    expect(cov.type).toBe('exists_coverable');
    expect(cov.predicates).toEqual([{ placeId: 'place-1', placeName: 'place-1', op: 'ge', value: 1 }]);

    const inv = result.properties.find(p => p.id === 'p_inv');
    expect(inv.type).toBe('invariant');
    expect(inv.predicates).toEqual([
      { placeId: 'place-1', placeName: 'place-1', op: 'le', value: 2 },
      { placeId: 'place-1', placeName: 'place-1', op: 'ge', value: 0 },
    ]);
  });

  test('generatePNML emits <toolspecific> properties and roundtrips through parsePNML', () => {
    const net = {
      netMode: 'pt',
      places: [
        { id: 'place-1', name: 'P1', x: 100, y: 100, tokens: 1 },
      ],
      transitions: [
        { id: 't1', name: 'T1', x: 200, y: 100 },
      ],
      arcs: [
        { id: 'a1', source: 'place-1', target: 't1', weight: 1 },
        { id: 'a2', source: 't1', target: 'place-1', weight: 1 },
      ],
      properties: [
        { id: 'dead', name: 'Deadlock exists', type: 'exists_deadlock', severity: 'error', predicates: [] },
        { id: 'cov', name: 'Cover P1>=2', type: 'exists_coverable', severity: 'error', predicates: [{ placeId: 'place-1', op: 'ge', value: 2 }] },
        { id: 'inv', name: 'P1<=3', type: 'invariant', severity: 'error', predicates: [{ placeId: 'place-1', op: 'le', value: 3 }] },
      ],
    };

    const xml = generatePNML(net);
    expect(xml).toContain('<toolspecific');
    expect(xml).toContain('tool="Browser-Petri-Net-Editor"');
    expect(xml).toContain('<properties>');
    expect(xml).toContain('type="exists_deadlock"');
    expect(xml).toContain('<ge place="place-1" k="2"');
    expect(xml).toContain('<le place="place-1" k="3"');

    const parsed = parsePNML(xml);
    expect(parsed.properties).toHaveLength(3);
    const parsedCov = parsed.properties.find(p => p.id === 'cov');
    expect(parsedCov.predicates[0].placeId).toBe('place-1');
    expect(parsedCov.predicates[0].op).toBe('ge');
    expect(parsedCov.predicates[0].value).toBe(2);
  });
});


