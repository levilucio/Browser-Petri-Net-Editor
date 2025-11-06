export function deepCopyState(state) {
  if (!state || !state.places || !state.transitions || !state.arcs) {
    return { places: [], transitions: [], arcs: [] };
  }

  const copyObject = (input) => {
    if (input === null || typeof input !== 'object') {
      return input;
    }
    if (Array.isArray(input)) {
      return input.map(item => copyObject(item));
    }
    const output = {};
    for (const key in input) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        const value = input[key];
        if (value === null || typeof value !== 'object') {
          output[key] = value;
        } else if (Array.isArray(value)) {
          output[key] = [...value];
        } else {
          output[key] = { ...value };
        }
      }
    }
    return output;
  };

  return {
    places: state.places.map(copyObject),
    transitions: state.transitions.map(copyObject),
    arcs: state.arcs.map(copyObject),
  };
}

export function validateState(state) {
  if (!state || !state.places || !state.transitions || !state.arcs) {
    return { places: [], transitions: [], arcs: [] };
  }
  return deepCopyState(state);
}

