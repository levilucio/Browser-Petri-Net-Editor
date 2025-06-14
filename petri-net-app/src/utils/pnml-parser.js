/**
 * Pure JavaScript PNML parser for handling Petri Net Markup Language
 * This implementation directly uses the browser's DOM capabilities
 * instead of relying on Python/Pyodide
 */

/**
 * Parse PNML string into Petri net JSON representation
 * @param {string} pnmlString - The PNML XML string
 * @returns {Object} - Petri net in JSON format
 */
export function parsePNML(pnmlString) {
  // Starting pure JavaScript PNML parsing
  
  // Initialize result structure with deep clone to prevent reference issues
  const result = {
    places: [],
    transitions: [],
    arcs: []
  };
  
  // Create a backup copy of the original PNML string to prevent modifications
  const originalPnmlString = pnmlString;
  
  try {
    // Parse XML string using browser's DOMParser
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(pnmlString, 'application/xml');
    
    // Check for parsing errors
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      console.error('XML parsing error:', parserError.textContent);
      throw new Error('Invalid XML: ' + parserError.textContent);
    }
    
    // XML parsed successfully
    
    // Extract namespace from root element
    const pnmlElement = xmlDoc.documentElement;
    // Get root element
    
    // Handle namespaces properly - key part that was missing
    const PNML_NS = pnmlElement.namespaceURI || "http://www.pnml.org/version-2009/grammar/pnml";
    // Using namespace URI
    
    // Create namespace resolver function for XPath
    const nsResolver = function(prefix) {
      const ns = {
        'pnml': PNML_NS
      };
      return ns[prefix] || null;
    };
    
    // Function to find all elements with namespace consideration
    const findElements = function(parentElem, localName) {
      // Try with namespace first
      let elements = parentElem.getElementsByTagNameNS(PNML_NS, localName);
      
      // If no elements found with namespace, try without namespace
      if (elements.length === 0) {
        elements = parentElem.getElementsByTagName(localName);
      }
      
      // If still no elements found, try with tag that ends with the local name
      if (elements.length === 0) {
        const allElements = parentElem.getElementsByTagName('*');
        const filtered = Array.from(allElements).filter(el => {
          return el.localName === localName || 
                 el.tagName.endsWith(':' + localName) || 
                 el.tagName.toLowerCase() === localName.toLowerCase();
        });
        return filtered;
      }
      
      return Array.from(elements);
    };
    
    // Namespace configuration complete
    
    // Find the page element that contains places, transitions, and arcs
    let pageElement = null;
    
    // First look for net element
    const netElements = findElements(xmlDoc, 'net');
    if (netElements.length > 0) {
      const netElement = netElements[0];
      // Found net element
      
      // Look for page element within net
      const pageElements = findElements(netElement, 'page');
      if (pageElements.length > 0) {
        pageElement = pageElements[0];
        // Found page element in net
      }
    }
    
    // If page not found in net, look globally
    if (!pageElement) {
      const pageElements = findElements(xmlDoc, 'page');
      if (pageElements.length > 0) {
        pageElement = pageElements[0];
        // Found page element globally
      }
    }
    
    if (!pageElement) {
      console.error('No page element found in the PNML file');
      return result;
    }
    
    // Process places
    const places = findElements(pageElement, 'place');
    // Found places
    
    for (let i = 0; i < places.length; i++) {
      const place = places[i];
      const placeId = place.getAttribute('id');
      // Processing place
      
      // Get name
      let name = `P${result.places.length + 1}`; // Default name
      const nameElements = findElements(place, 'name');
      if (nameElements.length > 0) {
        const textElements = findElements(nameElements[0], 'text');
        if (textElements.length > 0 && textElements[0].textContent) {
          name = textElements[0].textContent;
        }
      }
      
      // Get position
      let x = 0, y = 0; // Default position
      const graphicsElements = findElements(place, 'graphics');
      if (graphicsElements.length > 0) {
        const positionElements = findElements(graphicsElements[0], 'position');
        if (positionElements.length > 0) {
          x = parseInt(positionElements[0].getAttribute('x') || '0');
          y = parseInt(positionElements[0].getAttribute('y') || '0');
        }
      }
      
      // Get tokens (initial marking)
      let tokens = 0; // Default tokens
      const markingElements = findElements(place, 'initialMarking');
      if (markingElements.length > 0) {
        const textElements = findElements(markingElements[0], 'text');
        if (textElements.length > 0 && textElements[0].textContent) {
          try {
            tokens = parseInt(textElements[0].textContent);
          } catch (e) {
            console.warn(`Could not parse tokens for ${placeId}:`, e);
          }
        }
      }
      
      // Add place to result
      const placeObj = {
        id: placeId,
        name: name,
        x: x,
        y: y,
        tokens: tokens
      };
      
      // Adding place
      result.places.push(placeObj);
    }
    
    // Process transitions
    const transitions = findElements(pageElement, 'transition');
    // Found transitions
    
    for (let i = 0; i < transitions.length; i++) {
      const transition = transitions[i];
      const transitionId = transition.getAttribute('id');
      // Processing transition
      
      // Get name
      let name = `T${result.transitions.length + 1}`; // Default name
      const nameElements = findElements(transition, 'name');
      if (nameElements.length > 0) {
        const textElements = findElements(nameElements[0], 'text');
        if (textElements.length > 0 && textElements[0].textContent) {
          name = textElements[0].textContent;
        }
      }
      
      // Get position
      let x = 0, y = 0; // Default position
      const graphicsElements = findElements(transition, 'graphics');
      if (graphicsElements.length > 0) {
        const positionElements = findElements(graphicsElements[0], 'position');
        if (positionElements.length > 0) {
          x = parseInt(positionElements[0].getAttribute('x') || '0');
          y = parseInt(positionElements[0].getAttribute('y') || '0');
        }
      }
      
      // Add transition to result
      const transitionObj = {
        id: transitionId,
        name: name,
        x: x,
        y: y
      };
      
      // Adding transition
      result.transitions.push(transitionObj);
    }
    
    // Process arcs
    const arcs = findElements(pageElement, 'arc');
    // Found arcs
    
    for (let i = 0; i < arcs.length; i++) {
      const arc = arcs[i];
      const arcId = arc.getAttribute('id');
      const sourceId = arc.getAttribute('source');
      const targetId = arc.getAttribute('target');
      
      // Processing arc
      
      // Skip if missing source or target
      if (!sourceId || !targetId) {
        console.warn(`Skipping arc ${arcId} due to missing source or target`);
        continue;
      }
      
      // Determine arc type based on existing places/transitions or ID patterns
      // Check if the source and target elements exist in our places and transitions arrays
      const placeIds = result.places.map(p => p.id);
      const transitionIds = result.transitions.map(t => t.id);
      
      const sourceIsPlace = placeIds.includes(sourceId);
      const sourceIsTransition = transitionIds.includes(sourceId);
      const targetIsPlace = placeIds.includes(targetId);
      const targetIsTransition = transitionIds.includes(targetId);
      
      // Arc source and target types
      
      let arcType;
      if (sourceIsPlace && targetIsTransition) {
        arcType = 'place-to-transition';
      } else if (sourceIsTransition && targetIsPlace) {
        arcType = 'transition-to-place';
      } else {
        // Try to infer from IDs if not found in our arrays (this is a fallback)
        if (sourceId.toLowerCase().includes('place') && targetId.toLowerCase().includes('transition')) {
          arcType = 'place-to-transition';
        } else if (sourceId.toLowerCase().includes('transition') && targetId.toLowerCase().includes('place')) {
          arcType = 'transition-to-place';
        } else if (/p[0-9]+/i.test(sourceId) && /t[0-9]+/i.test(targetId)) {
          arcType = 'place-to-transition';
        } else if (/t[0-9]+/i.test(sourceId) && /p[0-9]+/i.test(targetId)) {
          arcType = 'transition-to-place';
        } else {
          // Force a default if we still can't determine
          console.warn(`Cannot determine arc type for ${arcId}, using default place-to-transition`); 
          arcType = 'place-to-transition';
        }
      }
      
      // Get weight (inscription)
      let weight = 1; // Default weight
      const inscriptionElements = findElements(arc, 'inscription');
      if (inscriptionElements.length > 0) {
        const textElements = findElements(inscriptionElements[0], 'text');
        if (textElements.length > 0 && textElements[0].textContent) {
          try {
            weight = parseInt(textElements[0].textContent);
          } catch (e) {
            console.warn(`Could not parse weight for ${arcId}:`, e);
          }
        }
      }
      
      // Get directions from metadata
      let sourceDirection = 'north'; // Default source direction
      let targetDirection = 'south'; // Default target direction
      
      const graphicsElements = findElements(arc, 'graphics');
      if (graphicsElements.length > 0) {
        const metadataElements = findElements(graphicsElements[0], 'metadata');
        if (metadataElements.length > 0) {
          const metadata = metadataElements[0];
          
          const sourceDirElements = findElements(metadata, 'sourceDirection');
          if (sourceDirElements.length > 0 && sourceDirElements[0].textContent) {
            sourceDirection = sourceDirElements[0].textContent;
          }
          
          const targetDirElements = findElements(metadata, 'targetDirection');
          if (targetDirElements.length > 0 && targetDirElements[0].textContent) {
            targetDirection = targetDirElements[0].textContent;
          }
        }
      }
      
      // Add arc to result
      const arcObj = {
        id: arcId,
        source: sourceId,
        target: targetId,
        type: arcType,
        weight: weight,
        sourceDirection: sourceDirection,
        targetDirection: targetDirection
      };
      
      // Adding arc
      result.arcs.push(arcObj);
    }
    
    // PNML parsing complete
    return result;
  } catch (error) {
    console.error('Error parsing PNML:', error);
    return result; // Return empty result on error
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
    
    // Create net element
    const netElement = xmlDoc.createElement('net');
    netElement.setAttribute('id', 'net1');
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
      
      // Add name
      const nameElement = xmlDoc.createElement('name');
      const textElement = xmlDoc.createElement('text');
      textElement.textContent = place.name || `P${place.id}`;
      nameElement.appendChild(textElement);
      placeElement.appendChild(nameElement);
      
      // Add graphics (position)
      const graphicsElement = xmlDoc.createElement('graphics');
      const positionElement = xmlDoc.createElement('position');
      positionElement.setAttribute('x', place.x || 0);
      positionElement.setAttribute('y', place.y || 0);
      graphicsElement.appendChild(positionElement);
      placeElement.appendChild(graphicsElement);
      
      // Add initial marking (tokens)
      if (place.tokens > 0) {
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
      
      // Add name
      const nameElement = xmlDoc.createElement('name');
      const textElement = xmlDoc.createElement('text');
      textElement.textContent = transition.name || `T${transition.id}`;
      nameElement.appendChild(textElement);
      transitionElement.appendChild(nameElement);
      
      // Add graphics (position)
      const graphicsElement = xmlDoc.createElement('graphics');
      const positionElement = xmlDoc.createElement('position');
      positionElement.setAttribute('x', transition.x || 0);
      positionElement.setAttribute('y', transition.y || 0);
      graphicsElement.appendChild(positionElement);
      transitionElement.appendChild(graphicsElement);
      
      pageElement.appendChild(transitionElement);
    });
    
    // Process arcs
    const arcs = petriNetJson.arcs || [];
    arcs.forEach(arc => {
      const arcElement = xmlDoc.createElement('arc');
      arcElement.setAttribute('id', arc.id);
      arcElement.setAttribute('source', arc.source);
      arcElement.setAttribute('target', arc.target);
      
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
      
      // Add inscription (weight) if > 1
      if (arc.weight > 1) {
        const inscriptionElement = xmlDoc.createElement('inscription');
        const textElement = xmlDoc.createElement('text');
        textElement.textContent = arc.weight;
        inscriptionElement.appendChild(textElement);
        arcElement.appendChild(inscriptionElement);
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
