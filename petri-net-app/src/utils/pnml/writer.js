// PNML Writer: generate PNML XML from Petri net JSON

const APN_NS = 'http://example.org/apn';

/**
 * Generate PNML string from Petri net JSON representation
 * @param {Object} petriNetJson - Petri net in JSON format
 * @returns {string} - PNML XML string
 */
export function generatePNML(petriNetJson) {
  try {
    const xmlDoc = document.implementation.createDocument(
      'http://www.pnml.org/version-2009/grammar/pnml',
      'pnml',
      null
    );

    const pnmlElement = xmlDoc.documentElement;
    let apnUsed = false;

    const netElement = xmlDoc.createElement('net');
    netElement.setAttribute('id', 'net1');
    netElement.setAttribute('type', 'http://www.pnml.org/version-2009/grammar/ptnet');
    pnmlElement.appendChild(netElement);

    if (petriNetJson.netMode) {
      netElement.setAttribute('netMode', petriNetJson.netMode);
    }

    const netNameElement = xmlDoc.createElement('name');
    const netNameTextElement = xmlDoc.createElement('text');
    netNameTextElement.textContent = 'Petri Net';
    netNameElement.appendChild(netNameTextElement);
    netElement.appendChild(netNameElement);

    const pageElement = xmlDoc.createElement('page');
    pageElement.setAttribute('id', 'page1');
    netElement.appendChild(pageElement);

    const places = petriNetJson.places || [];
    places.forEach(place => {
      const placeElement = xmlDoc.createElement('place');
      placeElement.setAttribute('id', place.id);

      const nameElement = xmlDoc.createElement('name');
      const textElement = xmlDoc.createElement('text');
      textElement.textContent = (place.label || place.name || `P${place.id}`);
      nameElement.appendChild(textElement);
      placeElement.appendChild(nameElement);

      const graphicsElement = xmlDoc.createElement('graphics');
      const positionElement = xmlDoc.createElement('position');
      positionElement.setAttribute('x', place.x || 0);
      positionElement.setAttribute('y', place.y || 0);
      graphicsElement.appendChild(positionElement);
      placeElement.appendChild(graphicsElement);

      if (place.type) {
        const typeEl = xmlDoc.createElementNS(APN_NS, 'apn:type');
        const textEl = xmlDoc.createElementNS(APN_NS, 'apn:text');
        textEl.textContent = String(place.type);
        typeEl.appendChild(textEl);
        placeElement.appendChild(typeEl);
        apnUsed = true;
      }

      const formatToken = (v) => {
        if (typeof v === 'boolean') return v ? 'T' : 'F';
        if (typeof v === 'string') {
          const escaped = v
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\n/g, '\\n')
            .replace(/\t/g, '\\t')
            .replace(/\r/g, '\\r');
          return `'${escaped}'`;
        }
        if (Array.isArray(v)) {
          const elements = v.map(formatToken);
          return `[${elements.join(', ')}]`;
        }
        if (v && typeof v === 'object' && v.__pair__) {
          return `(${formatToken(v.fst)}, ${formatToken(v.snd)})`;
        }
        return String(v);
      };

      if (Array.isArray(place.valueTokens)) {
        const valueTokensElement = xmlDoc.createElementNS(APN_NS, 'apn:valueTokens');
        place.valueTokens.forEach((token) => {
          const tokenElement = xmlDoc.createElementNS(APN_NS, 'apn:token');
          const textElement = xmlDoc.createElementNS(APN_NS, 'apn:text');
          textElement.textContent = formatToken(token);
          tokenElement.appendChild(textElement);
          valueTokensElement.appendChild(tokenElement);
        });
        placeElement.appendChild(valueTokensElement);
        apnUsed = true;
      } else if (place.tokens > 0) {
        const markingElement = xmlDoc.createElement('initialMarking');
        const markingTextElement = xmlDoc.createElement('text');
        markingTextElement.textContent = place.tokens;
        markingElement.appendChild(markingTextElement);
        placeElement.appendChild(markingElement);
      }

      pageElement.appendChild(placeElement);
    });

    const transitions = petriNetJson.transitions || [];
    transitions.forEach(transition => {
      const transitionElement = xmlDoc.createElement('transition');
      transitionElement.setAttribute('id', transition.id);

      const nameElement = xmlDoc.createElement('name');
      const textElement = xmlDoc.createElement('text');
      textElement.textContent = (transition.label || transition.name || `T${transition.id}`);
      nameElement.appendChild(textElement);
      transitionElement.appendChild(nameElement);

      const graphicsElement = xmlDoc.createElement('graphics');
      const positionElement = xmlDoc.createElement('position');
      positionElement.setAttribute('x', transition.x || 0);
      positionElement.setAttribute('y', transition.y || 0);
      graphicsElement.appendChild(positionElement);
      transitionElement.appendChild(graphicsElement);

      if (transition.guard) {
        const guardEl = xmlDoc.createElementNS(APN_NS, 'apn:guard');
        const textEl = xmlDoc.createElementNS(APN_NS, 'apn:text');
        textEl.textContent = String(transition.guard);
        guardEl.appendChild(textEl);
        transitionElement.appendChild(guardEl);
        apnUsed = true;
      }
      if (transition.action) {
        const actionEl = xmlDoc.createElementNS(APN_NS, 'apn:action');
        const textEl = xmlDoc.createElementNS(APN_NS, 'apn:text');
        textEl.textContent = String(transition.action);
        actionEl.appendChild(textEl);
        transitionElement.appendChild(actionEl);
        apnUsed = true;
      }

      pageElement.appendChild(transitionElement);
    });

    const arcs = petriNetJson.arcs || [];
    const placeIds = new Set(places.map(p => p.id));
    const transitionIds = new Set(transitions.map(t => t.id));
    const validArcs = arcs.filter(arc => {
      const sourceId = arc.source || arc.sourceId;
      const targetId = arc.target || arc.targetId;
      if (!sourceId || !targetId || sourceId === 'undefined' || targetId === 'undefined') {
        console.warn(`Skipping invalid arc ${arc.id} during save - missing or undefined source/target`);
        return false;
      }
      const sourceExists = placeIds.has(sourceId) || transitionIds.has(sourceId);
      const targetExists = placeIds.has(targetId) || transitionIds.has(targetId);
      if (!sourceExists || !targetExists) {
        console.warn(`Skipping invalid arc ${arc.id} during save - references non-existent elements`);
        return false;
      }
      return true;
    });

    validArcs.forEach(arc => {
      const arcElement = xmlDoc.createElement('arc');
      arcElement.setAttribute('id', arc.id);
      const sourceId = arc.source || arc.sourceId;
      const targetId = arc.target || arc.targetId;
      arcElement.setAttribute('source', sourceId);
      arcElement.setAttribute('target', targetId);

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

      if ((arc.weight > 1) && !(arc.binding || (Array.isArray(arc.bindings) && arc.bindings.length))) {
        const inscriptionElement = xmlDoc.createElement('inscription');
        const textElement = xmlDoc.createElement('text');
        textElement.textContent = arc.weight;
        inscriptionElement.appendChild(textElement);
        arcElement.appendChild(inscriptionElement);
      }

      if (Array.isArray(arc.bindings) && arc.bindings.length > 0) {
        const bindingEl = xmlDoc.createElementNS(APN_NS, 'apn:binding');
        const textEl = xmlDoc.createElementNS(APN_NS, 'apn:text');
        textEl.textContent = arc.bindings.join(', ');
        bindingEl.appendChild(textEl);
        arcElement.appendChild(bindingEl);
        apnUsed = true;
      } else if (arc.binding) {
        const bindingEl = xmlDoc.createElementNS(APN_NS, 'apn:binding');
        const textEl = xmlDoc.createElementNS(APN_NS, 'apn:text');
        textEl.textContent = String(arc.binding);
        bindingEl.appendChild(textEl);
        arcElement.appendChild(bindingEl);
        apnUsed = true;
      }

      pageElement.appendChild(arcElement);
    });

    if (apnUsed) {
      pnmlElement.setAttribute('xmlns:apn', APN_NS);
    }

    const serializer = new XMLSerializer();
    return serializer.serializeToString(xmlDoc);
  } catch (error) {
    console.error('Error generating PNML:', error);
    throw error;
  }
}


