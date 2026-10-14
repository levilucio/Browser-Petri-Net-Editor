/**
 * ADT XML parser/generator and validator
 * Supports schema described in docs/prd.md §4.5
 */

/**
 * Build ADT Registry from Petri net ADT definitions
 * @param {Object} petriNet - Petri net with adtDefinitions field
 * @returns {Object} Registry with getType(sortName) method
 */
export function buildAdtRegistry(petriNet) {
  if (!petriNet || !petriNet.adtDefinitions) {
    return null;
  }
  
  const parsed = parseADTDefinitions(petriNet.adtDefinitions);
  const typeMap = new Map();
  
  for (const adt of parsed.adts || []) {
    typeMap.set(adt.name, adt);
  }
  
  return {
    getType(sortName) {
      return typeMap.get(sortName) || null;
    },
    getAllTypes() {
      return Array.from(typeMap.values());
    }
  };
}

/**
 * Parse ADT definitions (adt-definitions XML format)
 * Works in both Node and browser without DOMParser
 * @param {string} xmlString - ADT definitions XML
 * @returns {{ adts: Array<{ name: string, constructors: Array<{ name: string, params: Array }> }> }}
 */
export function parseADTDefinitions(xmlString) {
  const result = { adts: [] };
  
  try {
    // Simple regex-based XML parsing (no DOMParser needed)
    // Extract all <adt name="...">...</adt> blocks
    const adtRegex = /<adt\s+name="([^"]+)">([\s\S]*?)<\/adt>/g;
    let adtMatch;
    
    while ((adtMatch = adtRegex.exec(xmlString)) !== null) {
      const adtName = adtMatch[1];
      const adtContent = adtMatch[2];
      const constructors = [];
      
      // Extract all <constructor> blocks (both <constructor>...</constructor> and self-closing <constructor ... />)
      // First try self-closing constructors
      const selfClosingCtorRegex = /<constructor\s+name="([^"]+)"\s*\/>/g;
      let selfClosingMatch;
      
      while ((selfClosingMatch = selfClosingCtorRegex.exec(adtContent)) !== null) {
        constructors.push({
          name: selfClosingMatch[1],
          params: [],
          arity: 0
        });
      }
      
      // Then extract non-self-closing constructors
      const ctorRegex = /<constructor\s+name="([^"]+)">([\s\S]*?)<\/constructor>/g;
      let ctorMatch;
      
      while ((ctorMatch = ctorRegex.exec(adtContent)) !== null) {
        const ctorName = ctorMatch[1];
        const ctorContent = ctorMatch[2];
        const params = [];
        
        // Extract all <parameter name="..." type="..."/> tags
        const paramRegex = /<parameter\s+name="([^"]+)"\s+type="([^"]+)"\s*\/?>/g;
        let paramMatch;
        
        while ((paramMatch = paramRegex.exec(ctorContent)) !== null) {
          params.push({
            name: paramMatch[1],
            type: paramMatch[2]
          });
        }
        
        constructors.push({
          name: ctorName,
          params,
          arity: params.length
        });
      }
      
      result.adts.push({
        name: adtName,
        constructors
      });
    }
  } catch (err) {
    console.error('Failed to parse ADT definitions:', err);
  }
  
  return result;
}

/**
 * Parse ADT XML string into JSON structure
 * Works in both Node and browser without DOMParser
 * @param {string} xmlString
 * @returns {{ types: Array<{ name: string, operations: Array<{ name: string, arity: number, result: string }>, axioms: Array<{ name: string, equation: string }> }> }}
 */
export function parseADT(xmlString) {
  const result = { types: [] };
  try {
    // Simple regex-based XML parsing
    const typeRegex = /<type\s+name="([^"]+)">([\s\S]*?)<\/type>/g;
    let typeMatch;
    
    while ((typeMatch = typeRegex.exec(xmlString)) !== null) {
      const typeName = typeMatch[1];
      const typeContent = typeMatch[2];
      const operations = [];
      const axioms = [];
      
      // Extract operations
      const opRegex = /<operation\s+name="([^"]+)"\s+arity="(\d+)"\s+result="([^"]+)"\s*\/?>/g;
      let opMatch;
      while ((opMatch = opRegex.exec(typeContent)) !== null) {
        operations.push({
          name: opMatch[1],
          arity: parseInt(opMatch[2], 10),
          result: opMatch[3],
          params: []  // Legacy parser included params: []
        });
      }
      
      // Extract axioms - handle multiline content
      const axiomRegex = /<axiom[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/axiom>/g;
      let axiomMatch;
      while ((axiomMatch = axiomRegex.exec(typeContent)) !== null) {
        const axiomContent = axiomMatch[2].trim();
        // Extract equation from content or attributes
        const eqMatch = axiomContent.match(/equation\s*=\s*"([^"]+)"/);
        const equation = eqMatch ? eqMatch[1] : axiomContent;
        axioms.push({
          name: axiomMatch[1],
          equation
        });
      }
      
      result.types.push({
        name: typeName,
        operations,
        axioms
      });
    }
    
    return result;
  } catch (err) {
    console.error('Failed to parse ADT:', err);
    return result;
  }
}

// Legacy DOMParser-based implementation (kept for reference, not used)
function parseADTLegacy(xmlString) {
  const result = { types: [] };
  try {
    if (typeof DOMParser === 'undefined') {
      throw new Error('DOMParser not available');
    }
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
      
      // Parse constructors (NEW)
      const ctorEls = Array.from(typeEl.childNodes).filter((n) => n.nodeType === 1 && n.localName === 'constructor');
      const constructors = ctorEls.map((ctorEl) => {
        const paramEls = Array.from(ctorEl.childNodes).filter((n) => n.nodeType === 1 && n.localName === 'param');
        const params = paramEls.map((paramEl) => ({
          index: Number(paramEl.getAttribute('index') || '0'),
          type: paramEl.getAttribute('type') || ''
        }));
        return {
          name: ctorEl.getAttribute('name') || '',
          arity: Number(ctorEl.getAttribute('arity') || '0'),
          result: ctorEl.getAttribute('result') || name, // Default to type name
          params: params
        };
      });
      
      // Parse operations
      const opEls = Array.from(typeEl.childNodes).filter((n) => n.nodeType === 1 && n.localName === 'operation');
      const ops = opEls.map((opEl) => {
        const paramEls = Array.from(opEl.childNodes).filter((n) => n.nodeType === 1 && n.localName === 'param');
        const params = paramEls.map((paramEl) => ({
          index: Number(paramEl.getAttribute('index') || '0'),
          type: paramEl.getAttribute('type') || ''
        }));
        return {
          name: opEl.getAttribute('name') || '',
          arity: Number(opEl.getAttribute('arity') || '0'),
          result: opEl.getAttribute('result') || '',
          params: params
        };
      });
      
      // Parse axioms
      const axiomsRoot = Array.from(typeEl.childNodes).find((n) => n.nodeType === 1 && n.localName === 'axioms');
      const axEls = axiomsRoot
        ? Array.from(axiomsRoot.childNodes).filter((n) => n.nodeType === 1 && n.localName === 'axiom')
        : [];
      const axioms = axEls.map((axEl) => ({
        name: axEl.getAttribute('name') || '',
        equation: (axEl.textContent || '').trim()
      }));
      
      result.types.push({ 
        name, 
        constructors: constructors.length > 0 ? constructors : undefined,
        operations: ops, 
        axioms 
      });
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
    
    // Add constructors (NEW)
    for (const ctor of t.constructors || []) {
      const ctorEl = doc.createElement('constructor');
      ctorEl.setAttribute('name', ctor.name || '');
      ctorEl.setAttribute('arity', String(ctor.arity ?? 0));
      if (ctor.result) {
        ctorEl.setAttribute('result', ctor.result);
      }
      
      // Add parameter elements
      if (ctor.params && ctor.params.length > 0) {
        for (const param of ctor.params) {
          const paramEl = doc.createElement('param');
          paramEl.setAttribute('index', String(param.index ?? 0));
          paramEl.setAttribute('type', param.type || '');
          ctorEl.appendChild(paramEl);
        }
      }
      
      typeEl.appendChild(ctorEl);
    }
    
    // Add operations
    for (const op of t.operations || []) {
      const opEl = doc.createElement('operation');
      opEl.setAttribute('name', op.name || '');
      opEl.setAttribute('arity', String(op.arity ?? 0));
      opEl.setAttribute('result', op.result || '');
      
      // Add parameter elements
      if (op.params && op.params.length > 0) {
        for (const param of op.params) {
          const paramEl = doc.createElement('param');
          paramEl.setAttribute('index', String(param.index ?? 0));
          paramEl.setAttribute('type', param.type || '');
          opEl.appendChild(paramEl);
        }
      }
      
      typeEl.appendChild(opEl);
    }
    
    // Add axioms
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


