import { APN_NS, DEFAULT_PNML_NS } from './constants.js';

function toArray(nodeList) {
  return nodeList ? Array.from(nodeList) : [];
}

export function parsePnmlDocument(pnmlString) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(pnmlString, 'application/xml');

  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    console.error('XML parsing error:', parserError.textContent);
    throw new Error('Invalid XML: ' + parserError.textContent);
  }

  const pnmlElement = xmlDoc.documentElement;
  const PNML_NS = pnmlElement.namespaceURI || DEFAULT_PNML_NS;

  return { xmlDoc, pnmlElement, PNML_NS };
}

export function getNetElement(xmlDoc, PNML_NS) {
  const netElementsNS = xmlDoc.getElementsByTagNameNS(PNML_NS, 'net');
  if (netElementsNS && netElementsNS.length > 0) {
    return netElementsNS[0];
  }
  const netElements = xmlDoc.getElementsByTagName('net');
  return netElements && netElements.length > 0 ? netElements[0] : null;
}

export function getPageElement(netElement, PNML_NS) {
  const pageElementsNS = netElement.getElementsByTagNameNS(PNML_NS, 'page');
  if (pageElementsNS && pageElementsNS.length > 0) {
    return pageElementsNS[0];
  }
  const pageElements = netElement.getElementsByTagName('page');
  return pageElements && pageElements.length > 0 ? pageElements[0] : null;
}

export function createNamespaceHelpers(PNML_NS) {
  const getElements = (parentElement, localName) => {
    if (!parentElement) return [];
    const withNs = typeof parentElement.getElementsByTagNameNS === 'function'
      ? parentElement.getElementsByTagNameNS(PNML_NS, localName)
      : [];
    if (withNs && withNs.length > 0) return toArray(withNs);

    const withApn = typeof parentElement.getElementsByTagNameNS === 'function'
      ? parentElement.getElementsByTagNameNS(APN_NS, localName)
      : [];
    if (withApn && withApn.length > 0) return toArray(withApn);

    const fallback = typeof parentElement.getElementsByTagName === 'function'
      ? parentElement.getElementsByTagName(localName)
      : [];
    return fallback && fallback.length > 0 ? toArray(fallback) : [];
  };

  const findChildElements = (parentElement, localName) => getElements(parentElement, localName);

  const getTextContent = (parentElement, childElementName) => {
    const elements = findChildElements(parentElement, childElementName);
    if (elements.length === 0) {
      return '';
    }
    const candidate = elements[0];
    const textElements = candidate.getElementsByTagName('text').length
      ? candidate.getElementsByTagName('text')
      : candidate.getElementsByTagNameNS(APN_NS, 'text');
    if (textElements && textElements.length > 0) {
      const textNode = textElements[0];
      if (textNode && typeof textNode.textContent === 'string') {
        return textNode.textContent;
      }
    }
    if (typeof candidate.textContent === 'string') {
      return candidate.textContent;
    }
    return '';
  };

  return { getElements, findChildElements, getTextContent };
}

export function getElementsWithFallback(parentElement, PNML_NS, localName) {
  if (!parentElement) return [];
  const helpers = createNamespaceHelpers(PNML_NS);
  return helpers.getElements(parentElement, localName);
}

