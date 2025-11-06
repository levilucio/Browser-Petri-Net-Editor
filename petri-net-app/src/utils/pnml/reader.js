import { parsePnmlDocument, getNetElement, getPageElement, createNamespaceHelpers, getElementsWithFallback } from './dom-utils.js';
import { createLayoutOptions, shouldAutoLayout } from './position-utils.js';
import { parsePlaces } from './parsers/places.js';
import { parseTransitions } from './parsers/transitions.js';
import { parseArcs } from './parsers/arcs.js';

export function parsePNML(pnmlString) {
  const result = { places: [], transitions: [], arcs: [] };

  try {
    const { xmlDoc, PNML_NS } = parsePnmlDocument(pnmlString);
    const netElement = getNetElement(xmlDoc, PNML_NS);
    if (!netElement) {
      console.error('No net element found in the PNML file');
      return result;
    }

    const netMode = netElement.getAttribute('netMode');
    if (netMode) {
      result.netMode = netMode;
    }

    const pageElement = getPageElement(netElement, PNML_NS);
    if (!pageElement) {
      console.error('No page element found in the PNML file');
      return result;
    }

    const helpers = createNamespaceHelpers(PNML_NS);
    const placeElements = getElementsWithFallback(pageElement, PNML_NS, 'place');
    const transitionElements = getElementsWithFallback(pageElement, PNML_NS, 'transition');
    const arcElements = getElementsWithFallback(pageElement, PNML_NS, 'arc');

    const totalNodes = placeElements.length + transitionElements.length;
    const layoutOptions = createLayoutOptions(shouldAutoLayout(totalNodes));

    result.places = parsePlaces(placeElements, helpers, layoutOptions);
    result.transitions = parseTransitions(transitionElements, helpers, layoutOptions);
    result.arcs = parseArcs(arcElements, helpers, {
      placeIds: result.places.map(p => p.id),
      transitionIds: result.transitions.map(t => t.id),
    });

    return result;
  } catch (error) {
    console.error('Error parsing PNML:', error);
    return result;
  }
}
