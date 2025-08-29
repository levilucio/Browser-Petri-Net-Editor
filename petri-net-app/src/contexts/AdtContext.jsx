import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { parseADT, validateADT, generateADT } from '../utils/adt-parser';

const BASE_ADT_XML = `<?xml version="1.0"?>
<algebraicDataTypes xmlns="http://example.org/apn-adt">
  <type name="Integer">
    <operation name="+" arity="2" result="Integer"/>
    <operation name="-" arity="2" result="Integer"/>
    <operation name="*" arity="2" result="Integer"/>
    <operation name=":" arity="2" result="Boolean"/>
    <axioms>
      <axiom name="commutativity">x + y = y + x</axiom>
    </axioms>
  </type>
  <type name="Boolean">
    <operation name="and" arity="2" result="Boolean"/>
    <operation name="or" arity="2" result="Boolean"/>
    <operation name="not" arity="1" result="Boolean"/>
  </type>
  <type name="List">
    <operation name="append" arity="2" result="List"/>
    <operation name="len" arity="1" result="Integer"/>
  </type>
  <type name="Character">
    <operation name="==" arity="2" result="Boolean"/>
  </type>
  <type name="String">
    <operation name="+" arity="2" result="String"/>
    <operation name="len" arity="1" result="Integer"/>
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


