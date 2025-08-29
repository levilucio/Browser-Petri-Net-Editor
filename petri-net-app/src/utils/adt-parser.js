/**
 * ADT XML parser/generator and validator
 * Supports schema described in docs/prd.md §4.5
 */

/**
 * Parse ADT XML string into JSON structure
 * @param {string} xmlString
 * @returns {{ types: Array<{ name: string, operations: Array<{ name: string, arity: number, result: string }>, axioms: Array<{ name: string, equation: string }> }> }}
 */
export function parseADT(xmlString) {
  const result = { types: [] };
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'application/xml');
    const parserError = xmlDoc.getElementsByTagName('parsererror')[0];
    if (parserError) {
      throw new Error(parserError.textContent || 'Invalid XML');
    }

    const rootCandidates = Array.from(xmlDoc.getElementsByTagName('*')).filter(
      (el) => el.localName === 'algebraicDataTypes'
    );
    const root = rootCandidates[0];
    if (!root) return result;

    const directChildren = Array.from(root.childNodes).filter((n) => n.nodeType === 1);
    const typeEls = directChildren.filter((el) => el.localName === 'type');
    for (const typeEl of typeEls) {
      const name = typeEl.getAttribute('name') || '';
      const opEls = Array.from(typeEl.childNodes).filter((n) => n.nodeType === 1 && n.localName === 'operation');
      const ops = opEls.map((opEl) => ({
        name: opEl.getAttribute('name') || '',
        arity: Number(opEl.getAttribute('arity') || '0'),
        result: opEl.getAttribute('result') || ''
      }));
      const axiomsRoot = Array.from(typeEl.childNodes).find((n) => n.nodeType === 1 && n.localName === 'axioms');
      const axEls = axiomsRoot
        ? Array.from(axiomsRoot.childNodes).filter((n) => n.nodeType === 1 && n.localName === 'axiom')
        : [];
      const axioms = axEls.map((axEl) => ({
        name: axEl.getAttribute('name') || '',
        equation: (axEl.textContent || '').trim()
      }));
      result.types.push({ name, operations: ops, axioms });
    }
    return result;
  } catch (e) {
    console.error('Error parsing ADT XML:', e);
    return result;
  }
}

/**
 * Validate ADT JSON structure (basic checks per PRD)
 * @param {{ types: Array<{ name: string, operations: Array<{ name: string, arity: number, result: string }>, axioms: Array<{ name: string, equation: string }> }> }} adt
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateADT(adt) {
  const errors = [];
  const typeNames = new Set();
  for (const t of adt.types || []) {
    if (!t.name) errors.push('Type missing name');
    if (typeNames.has(t.name)) errors.push(`Duplicate type: ${t.name}`);
    typeNames.add(t.name);
    for (const op of t.operations || []) {
      if (!op.name) errors.push(`Operation missing name in type ${t.name}`);
      if (!Number.isInteger(op.arity) || op.arity < 0) errors.push(`Invalid arity for ${t.name}.${op.name}`);
      if (!op.result) errors.push(`Operation ${t.name}.${op.name} missing result type`);
    }
    for (const ax of t.axioms || []) {
      if (!ax.equation || !ax.equation.includes('=')) errors.push(`Axiom in ${t.name} must be an equation with '='`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Generate ADT XML string from JSON structure
 * @param {{ types: Array<{ name: string, operations: Array<{ name: string, arity: number, result: string }>, axioms: Array<{ name: string, equation: string }> }> }} adt
 * @returns {string}
 */
export function generateADT(adt) {
  const doc = document.implementation.createDocument('', '', null);
  const root = doc.createElement('algebraicDataTypes');
  doc.appendChild(root);
  for (const t of adt.types || []) {
    const typeEl = doc.createElement('type');
    typeEl.setAttribute('name', t.name || '');
    for (const op of t.operations || []) {
      const opEl = doc.createElement('operation');
      opEl.setAttribute('name', op.name || '');
      opEl.setAttribute('arity', String(op.arity ?? 0));
      opEl.setAttribute('result', op.result || '');
      typeEl.appendChild(opEl);
    }
    if (t.axioms && t.axioms.length) {
      const axsEl = doc.createElement('axioms');
      for (const ax of t.axioms) {
        const axEl = doc.createElement('axiom');
        axEl.setAttribute('name', ax.name || '');
        axEl.textContent = ax.equation || '';
        axsEl.appendChild(axEl);
      }
      typeEl.appendChild(axsEl);
    }
    root.appendChild(typeEl);
  }
  return new XMLSerializer().serializeToString(doc);
}


