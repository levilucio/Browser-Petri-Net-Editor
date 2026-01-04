/**
 * PNML Property Parser
 * Parses <toolspecific tool="Browser-Petri-Net-Editor" version="1"><properties>...
 * into a format compatible with ValidationDialog.
 */

/**
 * Strip namespace prefix from tag name
 */
function stripNs(tagName) {
  if (!tagName) return '';
  const idx = tagName.indexOf(':');
  return idx >= 0 ? tagName.slice(idx + 1) : tagName;
}

function elementChildren(el) {
  if (!el) return [];
  // Prefer .children when available, but fall back to childNodes for XML DOMs (JSDOM quirks).
  // We only want element nodes (nodeType === 1).
  const kids = el.children ? Array.from(el.children) : Array.from(el.childNodes || []).filter((n) => n && n.nodeType === 1);
  return kids;
}

/**
 * Parse a single predicate element (ge, le, and, or, not)
 * Returns an array of { placeId, op, value } for simple predicates,
 * or recursively handles boolean connectives.
 */
function parsePredicate(elem) {
  const tag = stripNs(elem.tagName).toLowerCase();
  
  if (tag === 'ge' || tag === 'le') {
    // Simple predicate: <ge place="p0" k="1"/> or <le place="p1" k="5"/>
    const place = elem.getAttribute('place') || '';
    const k = parseInt(elem.getAttribute('k') || '0', 10);
    return [{
      placeId: place, // Will be resolved to actual ID later
      placeName: place,
      op: tag,
      value: k,
    }];
  }
  
  if (tag === 'and') {
    // Conjunction: collect all child predicates
    const results = [];
    for (const child of elementChildren(elem)) {
      results.push(...parsePredicate(child));
    }
    return results;
  }
  
  if (tag === 'or') {
    // Disjunction: for now, treat as AND (simplified; OR not fully supported in UI)
    console.warn('[PNML Properties] <or> predicates are not fully supported, treating as AND');
    const results = [];
    for (const child of elementChildren(elem)) {
      results.push(...parsePredicate(child));
    }
    return results;
  }
  
  if (tag === 'not') {
    // Negation: not supported in simple UI, skip
    console.warn('[PNML Properties] <not> predicates are not supported in the UI');
    return [];
  }
  
  // Unknown tag, skip
  console.warn(`[PNML Properties] Unknown predicate tag: <${tag}>`);
  return [];
}

/**
 * Parse a single <property> element
 */
function parseProperty(propElem) {
  const id = propElem.getAttribute('id') || `prop_${Date.now()}`;
  const name = propElem.getAttribute('name') || id;
  const type = propElem.getAttribute('type') || 'invariant';
  const severity = propElem.getAttribute('severity') || 'error';
  
  // Validate type
  const validTypes = ['invariant', 'exists_coverable', 'exists_deadlock'];
  if (!validTypes.includes(type)) {
    console.warn(`[PNML Properties] Unknown property type: ${type}`);
    return null;
  }
  
  // For exists_deadlock, no predicates
  if (type === 'exists_deadlock') {
    return {
      id,
      name,
      type,
      severity,
      predicates: [],
    };
  }
  
  // Find <predicate> child
  let predicates = [];
  for (const child of elementChildren(propElem)) {
    if (stripNs(child.tagName).toLowerCase() === 'predicate') {
      // Parse the predicate content (first child of <predicate>)
      for (const predChild of elementChildren(child)) {
        predicates.push(...parsePredicate(predChild));
      }
      break;
    }
  }
  
  return {
    id,
    name,
    type,
    severity,
    predicates,
  };
}

/**
 * Parse properties from toolspecific elements
 * @param {Element} netElement - The <net> element
 * @param {string} PNML_NS - PNML namespace (may be empty)
 * @returns {Array} Array of property objects for ValidationDialog
 */
export function parseProperties(netElement, PNML_NS) {
  const properties = [];
  
  // Find toolspecific elements.
  // Use a namespace-agnostic search because PNML files in the wild (and in our repo)
  // sometimes reset namespaces with `xmlns=""`, and JSDOM XML parsing can be quirky
  // with `.children` on namespaced XML nodes.
  let toolspecificElements = [];
  try {
    if (typeof netElement?.getElementsByTagNameNS === 'function') {
      toolspecificElements = Array.from(netElement.getElementsByTagNameNS('*', 'toolspecific') || []);
    } else if (typeof netElement?.getElementsByTagName === 'function') {
      toolspecificElements = Array.from(netElement.getElementsByTagName('toolspecific') || []);
    }
  } catch (_) {
    toolspecificElements = [];
  }
  
  for (const ts of toolspecificElements) {
    const tool = ts.getAttribute('tool');
    const version = ts.getAttribute('version');
    
    // Only process Browser-Petri-Net-Editor version 1
    if (tool !== 'Browser-Petri-Net-Editor' || version !== '1') {
      continue;
    }
    
    // Find <properties> element (namespace-agnostic)
    let propsElem = null;
    try {
      if (typeof ts.getElementsByTagNameNS === 'function') {
        propsElem = ts.getElementsByTagNameNS('*', 'properties')?.[0] || null;
      } else if (typeof ts.getElementsByTagName === 'function') {
        propsElem = ts.getElementsByTagName('properties')?.[0] || null;
      }
    } catch (_) {
      propsElem = null;
    }
    
    if (!propsElem) continue;
    
    // Parse each <property> element
    for (const propElem of elementChildren(propsElem)) {
      if (stripNs(propElem.tagName).toLowerCase() === 'property') {
        const prop = parseProperty(propElem);
        if (prop) {
          properties.push(prop);
        }
      }
    }
  }
  
  return properties;
}

/**
 * Resolve place names to place IDs
 * @param {Array} properties - Properties array
 * @param {Array} places - Places array with id and name
 * @returns {Array} Properties with placeId resolved
 */
export function resolvePropertyPlaceIds(properties, places) {
  if (!properties || !places) return properties;
  
  // Build lookup: name -> id and id -> id
  const nameToId = new Map();
  const idSet = new Set();
  for (const place of places) {
    if (place.id) {
      idSet.add(place.id);
      nameToId.set(place.id, place.id);
    }
    if (place.name) {
      nameToId.set(place.name, place.id);
    }
  }
  
  return properties.map(prop => ({
    ...prop,
    predicates: prop.predicates.map(pred => {
      // Try to resolve placeName to placeId
      const resolvedId = nameToId.get(pred.placeName) || nameToId.get(pred.placeId) || pred.placeId;
      return {
        ...pred,
        placeId: resolvedId,
      };
    }),
  }));
}
