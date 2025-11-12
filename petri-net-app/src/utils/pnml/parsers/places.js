import { parseAlgebraicToken, splitTopLevelCommas } from '../token-parsers.js';
import { resolveNodePosition } from '../position-utils.js';
import { APN_NS } from '../constants.js';

const DEFAULT_PLACE_NAME = (index) => `P${index + 1}`;

export function parsePlaces(placeElements, helpers, options) {
  const { getTextContent, getElements } = helpers;
  const result = [];

  placeElements.forEach((place, index) => {
    try {
      const placeId = place.getAttribute('id');
      const name = getTextContent(place, 'name') || DEFAULT_PLACE_NAME(index);
      const position = resolveNodePosition(place, helpers, options, index, 'place');

      let tokens = 0;
      let valueTokens;

      const explicitValueTokensElements = getElements(place, 'valueTokens')
        .filter((el) => el.namespaceURI === APN_NS && el.parentElement === place);

      if (explicitValueTokensElements.length > 0) {
        const explicitElement = explicitValueTokensElements[0];
        const tokenElements = explicitElement.getElementsByTagNameNS
          ? explicitElement.getElementsByTagNameNS(APN_NS, 'token')
          : explicitElement.getElementsByTagName('token');
        const parsedTokens = Array.from(tokenElements || []).map((tokenEl) => {
          let tokenText = getTextContent(tokenEl, 'text');
          if (!tokenText && typeof tokenEl.textContent === 'string') {
            tokenText = tokenEl.textContent;
          }
          const trimmedToken = typeof tokenText === 'string' ? tokenText.trim() : '';
          if (!trimmedToken) return null;
          return parseAlgebraicToken(trimmedToken);
        }).filter((v) => v !== null);
        valueTokens = parsedTokens;
        tokens = parsedTokens.length;
      } else {
        const markingText = getTextContent(place, 'initialMarking');
        if (markingText) {
          const trimmed = markingText.trim();
          if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
              const inner = trimmed.slice(1, -1).trim();
              const parts = inner.length ? splitTopLevelCommas(inner) : [];
              valueTokens = parts.map(parseAlgebraicToken).filter(v => v !== null);
              tokens = Array.isArray(valueTokens) ? valueTokens.length : 0;
            } catch (error) {
              console.warn(`Could not parse token list for ${placeId}:`, error);
            }
          } else {
            const n = parseInt(trimmed, 10);
            if (Number.isFinite(n)) {
              tokens = n;
            }
          }
        }
      }

      const typeText = getTextContent(place, 'type');
      result.push({
        id: placeId,
        name,
        label: name,
        x: position.x,
        y: position.y,
        tokens,
        valueTokens,
        type: typeText || undefined,
      });
    } catch (error) {
      console.error('Error processing place:', error);
    }
  });

  return result;
}

