// PNML Reader: parse PNML XML into Petri net JSON

// Shared APN namespace for algebraic annotations
const APN_NS = 'http://example.org/apn';

/**
 * Parse PNML string into Petri net JSON representation
 * @param {string} pnmlString - The PNML XML string
 * @returns {Object} - Petri net in JSON format
 */
export function parsePNML(pnmlString) {
  const result = {
    places: [],
    transitions: [],
    arcs: []
  };

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(pnmlString, 'application/xml');

    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      console.error('XML parsing error:', parserError.textContent);
      throw new Error('Invalid XML: ' + parserError.textContent);
    }

    const pnmlElement = xmlDoc.documentElement;
    const PNML_NS = pnmlElement.namespaceURI || 'http://www.pnml.org/version-2009/grammar/pnml';

    // Locate net element
    let netElement = null;
    const netElementsNS = xmlDoc.getElementsByTagNameNS(PNML_NS, 'net');
    if (netElementsNS && netElementsNS.length > 0) {
      netElement = netElementsNS[0];
    } else {
      const netElements = xmlDoc.getElementsByTagName('net');
      if (netElements && netElements.length > 0) {
        netElement = netElements[0];
      }
    }

    if (!netElement) {
      console.error('No net element found in the PNML file');
      return result;
    }

    const netMode = netElement.getAttribute('netMode');
    if (netMode) {
      result.netMode = netMode;
    }

    // Find page element
    let pageElement = null;
    const pageElementsNS = netElement.getElementsByTagNameNS(PNML_NS, 'page');
    if (pageElementsNS && pageElementsNS.length > 0) {
      pageElement = pageElementsNS[0];
    } else {
      const pageElements = netElement.getElementsByTagName('page');
      if (pageElements && pageElements.length > 0) {
        pageElement = pageElements[0];
      }
    }

    if (!pageElement) {
      console.error('No page element found in the PNML file');
      return result;
    }

    // Places list
    let places = [];
    const placesNS = pageElement.getElementsByTagNameNS(PNML_NS, 'place');
    if (placesNS && placesNS.length > 0) {
      places = Array.from(placesNS);
    } else {
      const placesNoNS = pageElement.getElementsByTagName('place');
      if (placesNoNS && placesNoNS.length > 0) {
        places = Array.from(placesNoNS);
      }
    }

    // Helpers
    const findChildElements = (parentElement, localName) => {
      const elementsNS = parentElement.getElementsByTagNameNS(PNML_NS, localName);
      if (elementsNS && elementsNS.length > 0) return Array.from(elementsNS);
      const apnElements = parentElement.getElementsByTagNameNS(APN_NS, localName);
      if (apnElements && apnElements.length > 0) return Array.from(apnElements);
      const elements = parentElement.getElementsByTagName(localName);
      if (elements && elements.length > 0) return Array.from(elements);
      return [];
    };

    const getTextContent = (parentElement, childElementName) => {
      const elements = findChildElements(parentElement, childElementName);
      if (elements.length > 0) {
        const textElements = elements[0].getElementsByTagName('text').length
          ? Array.from(elements[0].getElementsByTagName('text'))
          : Array.from(elements[0].getElementsByTagNameNS(APN_NS, 'text'));
        if (textElements.length > 0 && textElements[0].textContent) {
          return textElements[0].textContent;
        }
      }
      return '';
    };

    const splitTopLevelCommas = (input) => {
      const parts = [];
      let current = '';
      let parenDepth = 0;
      let bracketDepth = 0;
      let inString = false;
      for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (inString) {
          current += ch;
          if (ch === "'" && input[i - 1] !== '\\') inString = false;
          continue;
        }
        if (ch === "'") { inString = true; current += ch; continue; }
        if (ch === '(') { parenDepth++; current += ch; continue; }
        if (ch === ')') { parenDepth = Math.max(0, parenDepth - 1); current += ch; continue; }
        if (ch === '[') { bracketDepth++; current += ch; continue; }
        if (ch === ']') { bracketDepth = Math.max(0, bracketDepth - 1); current += ch; continue; }
        if (ch === ',' && parenDepth === 0 && bracketDepth === 0) { parts.push(current.trim()); current = ''; continue; }
        current += ch;
      }
      const last = current.trim();
      if (last.length > 0) parts.push(last);
      return parts.filter(p => p.length > 0);
    };

    const parseAlgebraicToken = (text) => {
      const p = String(text || '').trim();
      const low = p.toLowerCase();
      if (p === 'T' || low === 'true') return true;
      if (p === 'F' || low === 'false') return false;
      if (/^[+-]?\d+$/.test(p)) return parseInt(p, 10);
      if (p.startsWith("'") && p.endsWith("'") && p.length >= 2) {
        const inner = p.slice(1, -1);
        return inner.replace(/\\(.)/g, (match, char) => {
          if (char === 'n') return '\n';
          if (char === 't') return '\t';
          if (char === 'r') return '\r';
          if (char === '\\') return '\\';
          if (char === "'") return "'";
          return char;
        });
      }
      if (p.startsWith('[') && p.endsWith(']')) {
        const inner = p.slice(1, -1).trim();
        if (inner.length === 0) return [];
        const elements = splitTopLevelCommas(inner);
        return elements.map(el => parseAlgebraicToken(el));
      }
      if (p.startsWith('(') && p.endsWith(')')) {
        const inner = p.slice(1, -1).trim();
        let depth = 0, idx = -1;
        for (let i = 0; i < inner.length; i++) {
          const ch = inner[i];
          if (ch === '(') depth++;
          else if (ch === ')') depth = Math.max(0, depth - 1);
          else if (ch === ',' && depth === 0) { idx = i; break; }
        }
        if (idx >= 0) {
          const left = inner.slice(0, idx).trim();
          const right = inner.slice(idx + 1).trim();
          return { __pair__: true, fst: parseAlgebraicToken(left), snd: parseAlgebraicToken(right) };
        }
      }
      return null;
    };

    const getPosition = (element) => {
      const graphicsElements = findChildElements(element, 'graphics');
      if (graphicsElements.length > 0) {
        const positionElements = findChildElements(graphicsElements[0], 'position');
        if (positionElements.length > 0) {
          const x = parseInt(positionElements[0].getAttribute('x') || '0');
          const y = parseInt(positionElements[0].getAttribute('y') || '0');
          return { x, y };
        }
      }
      return { x: 0, y: 0 };
    };

    // Places
    places.forEach((place, index) => {
      try {
        const placeId = place.getAttribute('id');
        const name = getTextContent(place, 'name') || `P${index + 1}`;
        const { x, y } = getPosition(place);
        let tokens = 0;
        let valueTokens = undefined;
        const markingText = getTextContent(place, 'initialMarking');
        if (markingText) {
          const trimmed = markingText.trim();
          if ((trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            try {
              const inner = trimmed.slice(1, -1).trim();
              const parts = inner.length ? splitTopLevelCommas(inner) : [];
              valueTokens = parts.map(parseAlgebraicToken).filter(v => v !== null);
            } catch (e) {
              console.warn(`Could not parse token list for ${placeId}:`, e);
            }
          } else {
            const n = parseInt(trimmed, 10);
            if (Number.isFinite(n)) tokens = n;
          }
        }
        const typeText = getTextContent(place, 'type');
        const placeObj = {
          id: placeId,
          name: name,
          label: name,
          x: x,
          y: y,
          tokens: tokens,
          valueTokens: valueTokens,
          type: typeText || undefined
        };
        result.places.push(placeObj);
      } catch (e) {
        console.error('Error processing place:', e);
      }
    });

    // Transitions
    let transitions = [];
    const transitionsNS = pageElement.getElementsByTagNameNS(PNML_NS, 'transition');
    if (transitionsNS && transitionsNS.length > 0) {
      transitions = Array.from(transitionsNS);
    } else {
      const transitionsNoNS = pageElement.getElementsByTagName('transition');
      if (transitionsNoNS && transitionsNoNS.length > 0) {
        transitions = Array.from(transitionsNoNS);
      }
    }

    transitions.forEach((transition, index) => {
      try {
        const transitionId = transition.getAttribute('id');
        const name = getTextContent(transition, 'name') || `T${index + 1}`;
        const { x, y } = getPosition(transition);
        const guardText = getTextContent(transition, 'guard');
        const actionText = getTextContent(transition, 'action');
        const transitionObj = {
          id: transitionId,
          name: name,
          label: name,
          x: x,
          y: y,
          guard: guardText || undefined,
          action: actionText || undefined
        };
        result.transitions.push(transitionObj);
      } catch (e) {
        console.error('Error processing transition:', e);
      }
    });

    // Arcs
    let arcs = [];
    const arcsNS = pageElement.getElementsByTagNameNS(PNML_NS, 'arc');
    if (arcsNS && arcsNS.length > 0) {
      arcs = Array.from(arcsNS);
    } else {
      const arcsNoNS = pageElement.getElementsByTagName('arc');
      if (arcsNoNS && arcsNoNS.length > 0) {
        arcs = Array.from(arcsNoNS);
      }
    }

    arcs.forEach((arc) => {
      try {
        const arcId = arc.getAttribute('id');
        const sourceId = arc.getAttribute('source');
        const targetId = arc.getAttribute('target');
        if (!sourceId || !targetId) {
          console.warn(`Skipping arc ${arcId} due to missing source or target`);
          return;
        }
        let sourceDirection = 'north';
        let targetDirection = 'south';
        const graphicsElements = findChildElements(arc, 'graphics');
        if (graphicsElements.length > 0) {
          const metadataElements = findChildElements(graphicsElements[0], 'metadata');
          if (metadataElements.length > 0) {
            const sourceDirElements = findChildElements(metadataElements[0], 'sourceDirection');
            if (sourceDirElements.length > 0 && sourceDirElements[0].textContent) {
              sourceDirection = sourceDirElements[0].textContent;
            }
            const targetDirElements = findChildElements(metadataElements[0], 'targetDirection');
            if (targetDirElements.length > 0 && targetDirElements[0].textContent) {
              targetDirection = targetDirElements[0].textContent;
            }
          }
        }
        const placeIds = result.places.map(p => p.id);
        const transitionIds = result.transitions.map(t => t.id);
        let arcType;
        if (placeIds.includes(sourceId) && transitionIds.includes(targetId)) {
          arcType = 'place-to-transition';
        } else if (transitionIds.includes(sourceId) && placeIds.includes(targetId)) {
          arcType = 'transition-to-place';
        } else {
          if (sourceId.toLowerCase().includes('place') && targetId.toLowerCase().includes('transition')) {
            arcType = 'place-to-transition';
          } else if (sourceId.toLowerCase().includes('transition') && targetId.toLowerCase().includes('place')) {
            arcType = 'transition-to-place';
          } else {
            arcType = 'place-to-transition';
            console.warn(`Could not determine arc type for ${arcId}, defaulting to place-to-transition`);
          }
        }
        let weight = 1;
        const inscriptionText = getTextContent(arc, 'inscription');
        if (inscriptionText) {
          try { weight = parseInt(inscriptionText); } catch (e) { console.warn(`Could not parse weight for ${arcId}:`, e); }
        }
        const bindingText = getTextContent(arc, 'binding');
        let bindingsArray = undefined;
        if (bindingText && bindingText.includes(',')) {
          try { bindingsArray = splitTopLevelCommas(bindingText); } catch (_) { bindingsArray = bindingText.split(',').map(s => s.trim()).filter(Boolean); }
        } else if (bindingText) {
          bindingsArray = [bindingText.trim()];
        }
        const arcObj = {
          id: arcId,
          source: sourceId,
          target: targetId,
          type: arcType,
          weight: weight,
          binding: (bindingsArray ? undefined : (bindingText || undefined)),
          bindings: bindingsArray || undefined,
          sourceDirection: sourceDirection,
          targetDirection: targetDirection
        };
        result.arcs.push(arcObj);
      } catch (e) {
        console.error('Error processing arc:', e);
      }
    });

    return result;
  } catch (error) {
    console.error('Error parsing PNML:', error);
    return result;
  }
}


