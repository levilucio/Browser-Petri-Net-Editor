import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { parseADT, validateADT, generateADT } from '../utils/adt-parser';

const BASE_ADT_XML = `<?xml version="1.0"?>
<algebraicDataTypes xmlns="http://example.org/apn-adt">
  <type name="Integer">
    <operation name="+" arity="2" result="Integer">
      <param index="0" type="Integer"/>
      <param index="1" type="Integer"/>
    </operation>
    <operation name="-" arity="2" result="Integer">
      <param index="0" type="Integer"/>
      <param index="1" type="Integer"/>
    </operation>
    <operation name="*" arity="2" result="Integer">
      <param index="0" type="Integer"/>
      <param index="1" type="Integer"/>
    </operation>
    <operation name="==" arity="2" result="Boolean">
      <param index="0" type="Integer"/>
      <param index="1" type="Integer"/>
    </operation>
    <operation name="!=" arity="2" result="Boolean">
      <param index="0" type="Integer"/>
      <param index="1" type="Integer"/>
    </operation>
    <operation name="&lt;" arity="2" result="Boolean">
      <param index="0" type="Integer"/>
      <param index="1" type="Integer"/>
    </operation>
    <operation name="&lt;=" arity="2" result="Boolean">
      <param index="0" type="Integer"/>
      <param index="1" type="Integer"/>
    </operation>
    <operation name="&gt;" arity="2" result="Boolean">
      <param index="0" type="Integer"/>
      <param index="1" type="Integer"/>
    </operation>
    <operation name="&gt;=" arity="2" result="Boolean">
      <param index="0" type="Integer"/>
      <param index="1" type="Integer"/>
    </operation>
    <axioms>
      <axiom name="commutativity">x + y = y + x</axiom>
      <axiom name="associativity">(x + y) + z = x + (y + z)</axiom>
      <axiom name="multiplication_commutativity">x * y = y * x</axiom>
      <axiom name="multiplication_associativity">(x * y) * z = x * (y * z)</axiom>
      <axiom name="distributivity">x * (y + z) = (x * y) + (x * z)</axiom>
    </axioms>
  </type>
  <type name="Boolean">
    <operation name="and" arity="2" result="Boolean">
      <param index="0" type="Boolean"/>
      <param index="1" type="Boolean"/>
    </operation>
    <operation name="or" arity="2" result="Boolean">
      <param index="0" type="Boolean"/>
      <param index="1" type="Boolean"/>
    </operation>
    <operation name="not" arity="1" result="Boolean">
      <param index="0" type="Boolean"/>
    </operation>
    <operation name="==" arity="2" result="Boolean">
      <param index="0" type="Boolean"/>
      <param index="1" type="Boolean"/>
    </operation>
    <operation name="!=" arity="2" result="Boolean">
      <param index="0" type="Boolean"/>
      <param index="1" type="Boolean"/>
    </operation>
    <axioms>
      <axiom name="and_commutativity">x and y = y and x</axiom>
      <axiom name="and_associativity">(x and y) and z = x and (y and z)</axiom>
      <axiom name="or_commutativity">x or y = y or x</axiom>
      <axiom name="or_associativity">(x or y) or z = x or (y or z)</axiom>
      <axiom name="de_morgan_and">not (x and y) = (not x) or (not y)</axiom>
      <axiom name="de_morgan_or">not (x or y) = (not x) and (not y)</axiom>
      <axiom name="double_negation">not (not x) = x</axiom>
    </axioms>
  </type>
  <type name="Pair">
    <operation name="fst" arity="1" result="Any">
      <param index="0" type="Pair"/>
    </operation>
    <operation name="snd" arity="1" result="Any">
      <param index="0" type="Pair"/>
    </operation>
    <operation name="==" arity="2" result="Boolean">
      <param index="0" type="Pair"/>
      <param index="1" type="Pair"/>
    </operation>
    <operation name="!=" arity="2" result="Boolean">
      <param index="0" type="Pair"/>
      <param index="1" type="Pair"/>
    </operation>
    <axioms>
      <axiom name="pair_equality">(x, y) == (a, b) = (x == a) and (y == b)</axiom>
      <axiom name="fst_projection">fst((x, y)) = x</axiom>
      <axiom name="snd_projection">snd((x, y)) = y</axiom>
    </axioms>
  </type>
</algebraicDataTypes>`;

const AdtContext = createContext(null);

export function AdtProvider({ children }) {
  // Registry: base ADTs (read-only) + custom ADTs attached to current net
  const base = useMemo(() => parseADT(BASE_ADT_XML), []);
  const [customAdtXmls, setCustomAdtXmls] = useState([]); // array of xml strings for current net

  const registry = useMemo(() => {
    const types = new Map();
    // load base first
    for (const t of base.types || []) types.set(t.name, { ...t, __readonly: true });
    // merge custom, rejecting duplicates
    for (const xml of customAdtXmls) {
      const parsed = parseADT(xml);
      for (const t of parsed.types || []) {
        if (types.has(t.name)) {
          // reject duplicate name: keep base/first
          continue;
        }
        types.set(t.name, { ...t, __readonly: false });
      }
    }
    return types;
  }, [base, customAdtXmls]);

  const listTypes = useCallback(() => Array.from(registry.keys()), [registry]);
  const getType = useCallback((name) => registry.get(name) || null, [registry]);

  const registerCustomADTXml = useCallback((xml) => {
    // validate
    const parsed = parseADT(xml);
    const res = validateADT(parsed);
    if (!res.valid) {
      return { ok: false, errors: res.errors };
    }
    // reject duplicates w.r.t. registry
    for (const t of parsed.types || []) {
      if (registry.has(t.name)) {
        return { ok: false, errors: [`Duplicate type: ${t.name}`] };
      }
    }
    setCustomAdtXmls((prev) => [...prev, xml]);
    return { ok: true };
  }, [registry]);

  const exportCustomADTXml = useCallback(() => {
    // Combine only custom in memory if needed; for now return concatenated xmls
    return customAdtXmls.join('\n');
  }, [customAdtXmls]);

  const value = useMemo(() => ({
    listTypes,
    getType,
    registerCustomADTXml,
    exportCustomADTXml,
    baseReadOnly: true,
    // simple helpers for UI
    addOrReplaceCustomADT: (xml) => registerCustomADTXml(xml),
    clearCustomADTs: () => setCustomAdtXmls([]),
  }), [listTypes, getType, registerCustomADTXml, exportCustomADTXml]);

  return <AdtContext.Provider value={value}>{children}</AdtContext.Provider>;
}

export function useAdtRegistry() {
  const ctx = useContext(AdtContext);
  if (!ctx) throw new Error('useAdtRegistry must be used within AdtProvider');
  return ctx;
}


