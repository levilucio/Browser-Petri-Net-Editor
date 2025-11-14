// Implementation moved from utils/arith-parser.js
import { getTokensForPlace } from '../token-utils.js';
import { parsePattern, extractVariablesFromPattern } from './pattern-impl.js';

export function capitalizeTypeNames(bindingString) {
  return bindingString
    .replace(/:int\b/g, ':Int')
    .replace(/:bool\b/g, ':Bool')
    .replace(/:pair\b/g, ':Pair')
    .replace(/:string\b/g, ':String')
    .replace(/:list\b/g, ':List');
}

export function inferTokenType(token) {
  if (typeof token === 'number') return 'Int';
  if (typeof token === 'boolean') return 'Bool';
  if (typeof token === 'string') return 'String';
  if (Array.isArray(token)) return 'List';
  if (token && typeof token === 'object' && token.__pair__) return 'Pair';
  return 'Int';
}

export function inferVariableTypes(elementType, selectedElement, elements) {
  const typeMap = new Map();

  if (!selectedElement || !elements) {
    return typeMap;
  }

  if (elementType === 'arc') {
    const transition = elements.transitions.find(t =>
      elements.arcs.some(arc => arc.id === selectedElement.id &&
        (arc.source === t.id || arc.target === t.id))
    );

    if (transition) {
      const chainTypeMap = analyzeTransitionChain(transition, elements);
      chainTypeMap.forEach((type, varName) => {
        typeMap.set(varName, type);
      });
    }

    if (typeMap.size === 0) {
      const sourcePlace = elements.places.find(p => p.id === selectedElement.source);
      let tokenType = 'Int';
      if (sourcePlace) {
        const tokens = getTokensForPlace(sourcePlace);
        if (tokens.length > 0) tokenType = inferTokenType(tokens[0]);
      }
      if (selectedElement.bindings && selectedElement.bindings.length > 0) {
        selectedElement.bindings.forEach(binding => {
          extractVariablesFromBinding(binding, tokenType, typeMap);
        });
      }
    }
  } else if (elementType === 'transition') {
    const chainTypeMap = analyzeTransitionChain(selectedElement, elements);
    chainTypeMap.forEach((type, varName) => {
      typeMap.set(varName, type);
    });
  }

  return typeMap;
}

export function autoAnnotateTypes(input, typeMap, defaultType = null, options = {}) {
  if (!input) return input;
  if ((!typeMap || typeMap.size === 0) && !defaultType) return input;

  let result = input;
  const { overwrite = false } = options || {};
  const varMatches = input.match(/\b[a-z][a-zA-Z0-9_]*\b/g);
  if (varMatches) {
    varMatches.forEach(varName => {
      if (varName !== 'true' && varName !== 'false' &&
          varName !== 'and' && varName !== 'or' && varName !== 'not') {
        const varType = typeMap.get(varName) || defaultType;
        if (!varType) {
          return;
        }

        if (overwrite) {
          const pattern = new RegExp(`\\b${varName}(?::[A-Za-z]+)?\\b`, 'g');
          result = result.replace(pattern, `${varName}:${varType}`);
        } else if (!input.includes(`${varName}:`)) {
          const pattern = new RegExp(`\\b${varName}(?!:)\\b`, 'g');
          result = result.replace(pattern, `${varName}:${varType}`);
        }
      }
    });
  }

  return result;
}

// Internal helpers

function analyzeTransitionChain(transition, elements) {
  const typeMap = new Map();

  const inputArcs = elements.arcs.filter(arc => arc.target === transition.id);
  inputArcs.forEach(arc => {
    const sourcePlace = elements.places.find(p => p.id === arc.source);
    if (sourcePlace) {
      const tokens = getTokensForPlace(sourcePlace);
      if (tokens.length > 0) {
        const tokenType = inferTokenType(tokens[0]);
        if (arc.bindings && arc.bindings.length > 0) {
          arc.bindings.forEach(binding => {
            extractVariablesFromBinding(binding, tokenType, typeMap);
          });
        }
      }
    }
  });

  if (transition.guard) {
    extractTypesFromExpression(transition.guard, typeMap);
  }

  const outputArcs = elements.arcs.filter(arc => arc.source === transition.id);
  outputArcs.forEach(arc => {
    if (arc.bindings && arc.bindings.length > 0) {
      arc.bindings.forEach(binding => {
        extractTypesFromExpression(binding, typeMap);
      });
    }
  });

  propagateTypesThroughChain(inputArcs, outputArcs, transition, typeMap, elements);

  return typeMap;
}

function extractVariablesFromBinding(binding, defaultType, typeMap) {
  try {
    const pattern = parsePattern(binding);
    extractVariablesFromPattern(pattern).forEach(varName => {
      if (!typeMap.has(varName)) {
        typeMap.set(varName, defaultType);
      }
    });
  } catch (e) {
    const varMatches = binding.match(/\b[a-z][a-zA-Z0-9_]*\b/g);
    if (varMatches) {
      varMatches.forEach(varName => {
        if (varName !== 'true' && varName !== 'false' && !typeMap.has(varName)) {
          typeMap.set(varName, defaultType);
        }
      });
    }
  }
}

function extractTypesFromExpression(expression, typeMap) {
  const typedVarMatches = expression.match(/\b([a-z][a-zA-Z0-9_]*):(Int|Bool|Pair|String|List)\b/g);
  if (typedVarMatches) {
    typedVarMatches.forEach(match => {
      const [, varName, varType] = match.match(/\b([a-z][a-zA-Z0-9_]*):(Int|Bool|Pair|String|List)\b/);
      if (!typeMap.has(varName)) {
        typeMap.set(varName, varType);
      }
    });
  }
}

function propagateTypesThroughChain(inputArcs, outputArcs, transition, typeMap, elements) {
  const outputVariables = new Set();
  outputArcs.forEach(arc => {
    if (arc.bindings && arc.bindings.length > 0) {
      arc.bindings.forEach(binding => {
        try {
          const pattern = parsePattern(binding);
          extractVariablesFromPattern(pattern).forEach(varName => {
            outputVariables.add(varName);
          });
        } catch (e) {
          const varMatches = binding.match(/\b[a-z][a-zA-Z0-9_]*\b/g);
          if (varMatches) {
            varMatches.forEach(varName => {
              if (varName !== 'true' && varName !== 'false') {
                outputVariables.add(varName);
              }
            });
          }
        }
      });
    }
  });

  outputVariables.forEach(varName => {
    if (!typeMap.has(varName)) {
      inputArcs.forEach(arc => {
        const sourcePlace = elements.places.find(p => p.id === arc.source);
        if (sourcePlace) {
          const tokens = getTokensForPlace(sourcePlace);
          if (tokens.length > 0) {
            const tokenType = inferTokenType(tokens[0]);

            if (arc.bindings && arc.bindings.length > 0) {
              arc.bindings.forEach(binding => {
                try {
                  const pattern = parsePattern(binding);
                  extractVariablesFromPattern(pattern).forEach(inputVarName => {
                    if (inputVarName === varName && !typeMap.has(varName)) {
                      typeMap.set(varName, tokenType);
                    }
                  });
                } catch (e) {
                  const varMatches = binding.match(/\b[a-z][a-zA-Z0-9_]*\b/g);
                  if (varMatches) {
                    varMatches.forEach(inputVarName => {
                      if (inputVarName === varName && inputVarName !== 'true' && inputVarName !== 'false' && !typeMap.has(varName)) {
                        typeMap.set(varName, tokenType);
                      }
                    });
                  }
                }
              });
            }
          }
        }
      });
    }
  });
}



