/**
 * Pure JavaScript PNML parser for handling Petri Net Markup Language
 * This is a completely new implementation that addresses namespace issues
 * and arc handling problems in the previous version
 */

// Shared APN namespace for algebraic annotations
const APN_NS = 'http://example.org/apn';

/**
 * Parse PNML string into Petri net JSON representation
 * @param {string} pnmlString - The PNML XML string
 * @returns {Object} - Petri net in JSON format
 */
export function parsePNML(pnmlString) {
  // Starting robust PNML parsing
  
  // Initialize empty result structure
  const result = {
    places: [],
    transitions: [],
    arcs: []
  };
  
  try {
    // Parse XML using browser's DOMParser
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(pnmlString, 'application/xml');
    
    // Check for parsing errors
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      console.error('XML parsing error:', parserError.textContent);
      throw new Error('Invalid XML: ' + parserError.textContent);
    }
    
    // XML parsed successfully
    
    // Extract namespace information
    const pnmlElement = xmlDoc.documentElement;
    // Root element identified
    
    // Handle namespaces properly
    const PNML_NS = pnmlElement.namespaceURI || "http://www.pnml.org/version-2009/grammar/pnml";
    // Using namespace URI
    
    // First find the page element that contains places, transitions, and arcs
    // Start by looking for the net element
    let netElement = null;
    
    // Try with namespace
    const netElementsNS = xmlDoc.getElementsByTagNameNS(PNML_NS, 'net');
    if (netElementsNS && netElementsNS.length > 0) {
      netElement = netElementsNS[0];
      // Found net element with namespace
    } else {
      // Try without namespace
      const netElements = xmlDoc.getElementsByTagName('net');
      if (netElements && netElements.length > 0) {
        netElement = netElements[0];
        // Found net element without namespace
      }
    }
    
    if (!netElement) {
      console.error('No net element found in the PNML file');
      return result;
    }
    // Net type is controlled by user settings; no detection here
    
    // Find the page element inside the net
    let pageElement = null;
    
    // Try with namespace
    const pageElementsNS = netElement.getElementsByTagNameNS(PNML_NS, 'page');
    if (pageElementsNS && pageElementsNS.length > 0) {
      pageElement = pageElementsNS[0];
      // Found page element with namespace
    } else {
      // Try without namespace
      const pageElements = netElement.getElementsByTagName('page');
      if (pageElements && pageElements.length > 0) {
        pageElement = pageElements[0];
        // Found page element without namespace
      }
    }
    
    if (!pageElement) {
      console.error('No page element found in the PNML file');
      return result;
    }
    
    // Process places
    let places = [];
    
    // Try with namespace
    const placesNS = pageElement.getElementsByTagNameNS(PNML_NS, 'place');
    if (placesNS && placesNS.length > 0) {
      places = Array.from(placesNS);
      // Found places with namespace
    } else {
      // Try without namespace
      const placesNoNS = pageElement.getElementsByTagName('place');
      if (placesNoNS && placesNoNS.length > 0) {
        places = Array.from(placesNoNS);
        // Found places without namespace
      }
    }
    
    // Helper function to find child elements regardless of namespace
    const findChildElements = (parentElement, localName) => {
      // Try with namespace first
      const elementsNS = parentElement.getElementsByTagNameNS(PNML_NS, localName);
      if (elementsNS && elementsNS.length > 0) {
        return Array.from(elementsNS);
      }
      // Try APN namespace
      const apnElements = parentElement.getElementsByTagNameNS(APN_NS, localName);
      if (apnElements && apnElements.length > 0) {
        return Array.from(apnElements);
      }
      
      // Try without namespace
      const elements = parentElement.getElementsByTagName(localName);
      if (elements && elements.length > 0) {
        return Array.from(elements);
      }
      
      // Return empty array if nothing found
      return [];
    };
    
    // Helper function to get text content from an element's child text node
    const getTextContent = (parentElement, childElementName) => {
      const elements = findChildElements(parentElement, childElementName);
      if (elements.length > 0) {
        // text element might be in PNML or APN ns
        const textElements = elements[0].getElementsByTagName('text').length
          ? Array.from(elements[0].getElementsByTagName('text'))
          : Array.from(elements[0].getElementsByTagNameNS(APN_NS, 'text'));
        if (textElements.length > 0 && textElements[0].textContent) {
          return textElements[0].textContent;
        }
      }
      return '';
    };

    // Split a string on top-level commas (ignore commas inside parentheses)
    const splitTopLevelCommas = (input) => {
      const parts = [];
      let current = '';
      let depth = 0;
      for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (ch === '(') {
          depth++;
          current += ch;
        } else if (ch === ')') {
          depth = Math.max(0, depth - 1);
          current += ch;
        } else if (ch === ',' && depth === 0) {
          parts.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      const last = current.trim();
      if (last.length > 0) parts.push(last);
      return parts.filter(p => p.length > 0);
    };
    
    // Helper function to get position coordinates
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
    
    // Process places
    places.forEach((place, index) => {
      try {
        const placeId = place.getAttribute('id');
        
        // Get name
        const name = getTextContent(place, 'name') || `P${index + 1}`;
        
        // Get position
        const { x, y } = getPosition(place);
        
        // Get tokens (support integer or list for algebraic nets)
        let tokens = 0;
        let valueTokens = undefined;
        const markingText = getTextContent(place, 'initialMarking');
        if (markingText) {
          const trimmed = markingText.trim();
          // List format like [1, 2, 3]
          if ((trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            try {
              const inner = trimmed.slice(1, -1).trim();
              valueTokens = inner ? inner.split(',').map(v => parseInt(v.trim(), 10)).filter(v => Number.isFinite(v)) : [];
              // List form indicates algebraic tokens; leave net mode to settings
            } catch (e) {
              console.warn(`Could not parse token list for ${placeId}:`, e);
            }
          } else {
            // Scalar integer for PT nets
            const n = parseInt(trimmed, 10);
            if (Number.isFinite(n)) {
              tokens = n;
            }
          }
        }
        
        // Read optional type for algebraic nets
        const typeText = getTextContent(place, 'type');
        // Place type is parsed, but net mode remains a user setting
        // Create place object (standardize on label but keep name for compatibility)
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
        
        // Adding place
        result.places.push(placeObj);
      } catch (e) {
        console.error('Error processing place:', e);
      }
    });
    
    // Process transitions
    let transitions = [];
    
    // Try with namespace
    const transitionsNS = pageElement.getElementsByTagNameNS(PNML_NS, 'transition');
    if (transitionsNS && transitionsNS.length > 0) {
      transitions = Array.from(transitionsNS);
      // Found transitions with namespace
    } else {
      // Try without namespace
      const transitionsNoNS = pageElement.getElementsByTagName('transition');
      if (transitionsNoNS && transitionsNoNS.length > 0) {
        transitions = Array.from(transitionsNoNS);
        // Found transitions without namespace
      }
    }
    
    transitions.forEach((transition, index) => {
      try {
        const transitionId = transition.getAttribute('id');
        
        // Get name
        const name = getTextContent(transition, 'name') || `T${index + 1}`;
        
        // Get position
        const { x, y } = getPosition(transition);
        
        // Read optional guard/action for algebraic nets
        const guardText = getTextContent(transition, 'guard');
        const actionText = getTextContent(transition, 'action');
        // Algebraic annotations parsed; net mode remains a user setting
        // Create transition object (standardize on label but keep name for compatibility)
        const transitionObj = {
          id: transitionId,
          name: name,
          label: name,
          x: x,
          y: y,
          guard: guardText || undefined,
          action: actionText || undefined
        };
        
        // Adding transition
        result.transitions.push(transitionObj);
      } catch (e) {
        console.error('Error processing transition:', e);
      }
    });
    
    // Process arcs
    let arcs = [];
    
    // Try with namespace
    const arcsNS = pageElement.getElementsByTagNameNS(PNML_NS, 'arc');
    if (arcsNS && arcsNS.length > 0) {
      arcs = Array.from(arcsNS);
      // Found arcs with namespace
    } else {
      // Try without namespace
      const arcsNoNS = pageElement.getElementsByTagName('arc');
      if (arcsNoNS && arcsNoNS.length > 0) {
        arcs = Array.from(arcsNoNS);
        // Found arcs without namespace
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
        
        // Processing arc
        
        // Get directional metadata
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
        
        // Determine arc type by checking existing place and transition IDs
        const placeIds = result.places.map(p => p.id);
        const transitionIds = result.transitions.map(t => t.id);
        
        let arcType;
        if (placeIds.includes(sourceId) && transitionIds.includes(targetId)) {
          arcType = 'place-to-transition';
        } else if (transitionIds.includes(sourceId) && placeIds.includes(targetId)) {
          arcType = 'transition-to-place';
        } else {
          // Try to determine type by ID conventions
          if (sourceId.toLowerCase().includes('place') && targetId.toLowerCase().includes('transition')) {
            arcType = 'place-to-transition';
          } else if (sourceId.toLowerCase().includes('transition') && targetId.toLowerCase().includes('place')) {
            arcType = 'transition-to-place';
          } else {
            // For IDs that don't follow convention, make an educated guess
            arcType = 'place-to-transition'; // Default
            console.warn(`Could not determine arc type for ${arcId}, defaulting to place-to-transition`);
          }
        }
        
        // Handle inscription/weight or algebraic binding
        let weight = 1;
        const inscriptionText = getTextContent(arc, 'inscription');
        if (inscriptionText) {
          try {
            weight = parseInt(inscriptionText);
          } catch (e) {
            console.warn(`Could not parse weight for ${arcId}:`, e);
          }
        }
        const bindingText = getTextContent(arc, 'binding');
        let bindingsArray = undefined;
        if (bindingText && bindingText.includes(',')) {
          try {
            bindingsArray = splitTopLevelCommas(bindingText);
          } catch (_) {
            bindingsArray = bindingText.split(',').map(s => s.trim()).filter(Boolean);
          }
        } else if (bindingText) {
          bindingsArray = [bindingText.trim()];
        }
        // Algebraic binding parsed; net mode remains a user setting
        
        // Create arc object
        const arcObj = {
          id: arcId,
          source: sourceId,
          target: targetId,
          type: arcType,
          weight: weight,
          // Keep legacy single binding for backward-compat only if no bag
          binding: (bindingsArray ? undefined : (bindingText || undefined)),
          bindings: bindingsArray || undefined,
          sourceDirection: sourceDirection,
          targetDirection: targetDirection
        };
        
        // Adding arc
        result.arcs.push(arcObj);
      } catch (e) {
        console.error('Error processing arc:', e);
      }
    });
    
    // PNML parsing complete. Result contains:
    // - places: result.places.length
    // - transitions: result.transitions.length
    // - arcs: result.arcs.length
    
    return result;
  } catch (error) {
    console.error('Error parsing PNML:', error);
    return result;
  }
}

/**
 * Generate PNML string from Petri net JSON representation
 * @param {Object} petriNetJson - Petri net in JSON format
 * @returns {string} - PNML XML string
 */
export function generatePNML(petriNetJson) {
  // Starting PNML generation
  
  try {
    // Create XML document
    const xmlDoc = document.implementation.createDocument(
      'http://www.pnml.org/version-2009/grammar/pnml',
      'pnml',
      null
    );
    
    const pnmlElement = xmlDoc.documentElement;
    // Ensure APN prefix is declared if algebraic annotations are used
    pnmlElement.setAttribute('xmlns:apn', APN_NS);
    
    // Create net element
    const netElement = xmlDoc.createElement('net');
    netElement.setAttribute('id', 'net1');
    // Net type in XML is not authoritative; keep default PT type for compatibility
    netElement.setAttribute('type', 'http://www.pnml.org/version-2009/grammar/ptnet');
    pnmlElement.appendChild(netElement);
    
    // Add net name
    const netNameElement = xmlDoc.createElement('name');
    const netNameTextElement = xmlDoc.createElement('text');
    netNameTextElement.textContent = 'Petri Net';
    netNameElement.appendChild(netNameTextElement);
    netElement.appendChild(netNameElement);
    
    // Create page element
    const pageElement = xmlDoc.createElement('page');
    pageElement.setAttribute('id', 'page1');
    netElement.appendChild(pageElement);
    
    // Process places
    const places = petriNetJson.places || [];
    places.forEach(place => {
      const placeElement = xmlDoc.createElement('place');
      placeElement.setAttribute('id', place.id);
      
      // Add name (prefer label if present)
      const nameElement = xmlDoc.createElement('name');
      const textElement = xmlDoc.createElement('text');
      textElement.textContent = (place.label || place.name || `P${place.id}`);
      nameElement.appendChild(textElement);
      placeElement.appendChild(nameElement);
      
      // Add graphics (position)
      const graphicsElement = xmlDoc.createElement('graphics');
      const positionElement = xmlDoc.createElement('position');
      positionElement.setAttribute('x', place.x || 0);
      positionElement.setAttribute('y', place.y || 0);
      graphicsElement.appendChild(positionElement);
      placeElement.appendChild(graphicsElement);

      // Optional type annotation for algebraic places (apn:type)
      if (place.type) {
        const typeEl = xmlDoc.createElementNS(APN_NS, 'apn:type');
        const textEl = xmlDoc.createElementNS(APN_NS, 'apn:text');
        textEl.textContent = String(place.type);
        typeEl.appendChild(textEl);
        placeElement.appendChild(typeEl);
      }
      
      // Add initial marking (tokens or valueTokens)
      if (Array.isArray(place.valueTokens)) {
        const markingElement = xmlDoc.createElement('initialMarking');
        const markingTextElement = xmlDoc.createElement('text');
        markingTextElement.textContent = `[${place.valueTokens.join(', ')}]`;
        markingElement.appendChild(markingTextElement);
        placeElement.appendChild(markingElement);
      } else if (place.tokens > 0) {
        const markingElement = xmlDoc.createElement('initialMarking');
        const markingTextElement = xmlDoc.createElement('text');
        markingTextElement.textContent = place.tokens;
        markingElement.appendChild(markingTextElement);
        placeElement.appendChild(markingElement);
      }
      
      pageElement.appendChild(placeElement);
    });
    
    // Process transitions
    const transitions = petriNetJson.transitions || [];
    transitions.forEach(transition => {
      const transitionElement = xmlDoc.createElement('transition');
      transitionElement.setAttribute('id', transition.id);
      
      // Add name (prefer label if present)
      const nameElement = xmlDoc.createElement('name');
      const textElement = xmlDoc.createElement('text');
      textElement.textContent = (transition.label || transition.name || `T${transition.id}`);
      nameElement.appendChild(textElement);
      transitionElement.appendChild(nameElement);
      
      // Add graphics (position)
      const graphicsElement = xmlDoc.createElement('graphics');
      const positionElement = xmlDoc.createElement('position');
      positionElement.setAttribute('x', transition.x || 0);
      positionElement.setAttribute('y', transition.y || 0);
      graphicsElement.appendChild(positionElement);
      transitionElement.appendChild(graphicsElement);

      // Optional algebraic annotations
      if (transition.guard) {
        const guardEl = xmlDoc.createElementNS(APN_NS, 'apn:guard');
        const textEl = xmlDoc.createElementNS(APN_NS, 'apn:text');
        textEl.textContent = String(transition.guard);
        guardEl.appendChild(textEl);
        transitionElement.appendChild(guardEl);
      }
      if (transition.action) {
        const actionEl = xmlDoc.createElementNS(APN_NS, 'apn:action');
        const textEl = xmlDoc.createElementNS(APN_NS, 'apn:text');
        textEl.textContent = String(transition.action);
        actionEl.appendChild(textEl);
        transitionElement.appendChild(actionEl);
      }
      
      pageElement.appendChild(transitionElement);
    });
    
    // Process arcs - with validation to ensure only valid arcs are saved
    const arcs = petriNetJson.arcs || [];
    const placeIds = new Set(places.map(p => p.id));
    const transitionIds = new Set(transitions.map(t => t.id));
    
    // Filter out invalid arcs before saving
    const validArcs = arcs.filter(arc => {
      // Get the source and target IDs - handle different arc structures
      const sourceId = arc.source || arc.sourceId;
      const targetId = arc.target || arc.targetId;
      
      // Skip arcs with undefined, missing, or invalid source/target
      if (!sourceId || !targetId || 
          sourceId === 'undefined' || targetId === 'undefined') {
        console.warn(`Skipping invalid arc ${arc.id} during save - missing or undefined source/target`);
        return false;
      }
      
      // Check if source and target reference valid elements
      const sourceExists = placeIds.has(sourceId) || transitionIds.has(sourceId);
      const targetExists = placeIds.has(targetId) || transitionIds.has(targetId);
      
      if (!sourceExists || !targetExists) {
        console.warn(`Skipping invalid arc ${arc.id} during save - references non-existent elements`);
        return false;
      }
      
      return true;
    });
    
    // Saving valid arcs after filtering
    
    validArcs.forEach(arc => {
      const arcElement = xmlDoc.createElement('arc');
      arcElement.setAttribute('id', arc.id);
      
      // Handle different arc structures
      const sourceId = arc.source || arc.sourceId;
      const targetId = arc.target || arc.targetId;
      
      arcElement.setAttribute('source', sourceId);
      arcElement.setAttribute('target', targetId);
      
      // Add graphics with metadata for source and target directions
      const graphicsElement = xmlDoc.createElement('graphics');
      const metadataElement = xmlDoc.createElement('metadata');
      
      const sourceDirElement = xmlDoc.createElement('sourceDirection');
      sourceDirElement.textContent = arc.sourceDirection || 'north';
      metadataElement.appendChild(sourceDirElement);
      
      const targetDirElement = xmlDoc.createElement('targetDirection');
      targetDirElement.textContent = arc.targetDirection || 'south';
      metadataElement.appendChild(targetDirElement);
      
      graphicsElement.appendChild(metadataElement);
      arcElement.appendChild(graphicsElement);
      
      // Add inscription (weight) if > 1 and no algebraic bindings
      if ((arc.weight > 1) && !(arc.binding || (Array.isArray(arc.bindings) && arc.bindings.length))) {
        const inscriptionElement = xmlDoc.createElement('inscription');
        const textElement = xmlDoc.createElement('text');
        textElement.textContent = arc.weight;
        inscriptionElement.appendChild(textElement);
        arcElement.appendChild(inscriptionElement);
      }

      // Add algebraic binding if present (apn:binding)
      if (Array.isArray(arc.bindings) && arc.bindings.length > 0) {
        const bindingEl = xmlDoc.createElementNS(APN_NS, 'apn:binding');
        const textEl = xmlDoc.createElementNS(APN_NS, 'apn:text');
        textEl.textContent = arc.bindings.join(', ');
        bindingEl.appendChild(textEl);
        arcElement.appendChild(bindingEl);
      } else if (arc.binding) {
        const bindingEl = xmlDoc.createElementNS(APN_NS, 'apn:binding');
        const textEl = xmlDoc.createElementNS(APN_NS, 'apn:text');
        textEl.textContent = String(arc.binding);
        bindingEl.appendChild(textEl);
        arcElement.appendChild(bindingEl);
      }
      
      pageElement.appendChild(arcElement);
    });
    
    // Serialize to string
    const serializer = new XMLSerializer();
    const xmlString = serializer.serializeToString(xmlDoc);
    
    // PNML generation complete
    return xmlString;
  } catch (error) {
    console.error('Error generating PNML:', error);
    throw error;
  }
}
