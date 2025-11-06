const isDev = () => process.env.NODE_ENV !== 'production';

export function compareStates(state1, state2) {
  if (!state1 || !state2) return false;

  if (!compareCollections(state1.places, state2.places, comparePlace)) {
    return false;
  }

  if (!compareCollections(state1.transitions, state2.transitions, compareTransition)) {
    return false;
  }

  if (!compareCollections(state1.arcs, state2.arcs, compareArc)) {
    return false;
  }

  if (isDev()) {
    console.log('HistoryManager: States are identical');
  }
  return true;
}

function compareCollections(listA = [], listB = [], comparator) {
  if (listA.length !== listB.length) {
    if (isDev()) {
      const label = comparator === comparePlace
        ? 'places'
        : comparator === compareTransition
          ? 'transitions'
          : 'arcs';
      console.log(`HistoryManager: States differ in number of ${label}`);
    }
    return false;
  }

  const mapB = new Map();
  listB.forEach(item => mapB.set(item.id, item));

  for (const itemA of listA) {
    const itemB = mapB.get(itemA.id);
    if (!itemB) {
      if (isDev()) {
        console.log(`HistoryManager: ${comparator === compareArc ? 'Arc' : comparator === compareTransition ? 'Transition' : 'Place'} ${itemA.id} not found in second state`);
      }
      return false;
    }
    if (!comparator(itemA, itemB)) {
      return false;
    }
  }

  return true;
}

function comparePlace(p1, p2) {
  const valueTokensEqual = JSON.stringify(p1.valueTokens || []) === JSON.stringify(p2.valueTokens || []);
  const equal =
    p1.x === p2.x &&
    p1.y === p2.y &&
    p1.tokens === p2.tokens &&
    p1.label === p2.label &&
    p1.name === p2.name &&
    valueTokensEqual;

  if (!equal && isDev()) {
    console.log(`HistoryManager: Place ${p1.id} differs - x: ${p1.x} vs ${p2.x}, y: ${p1.y} vs ${p2.y}, tokens: ${p1.tokens} vs ${p2.tokens}, label: ${p1.label} vs ${p2.label}, name: ${p1.name} vs ${p2.name}`);
  }

  return equal;
}

function compareTransition(t1, t2) {
  const equal =
    t1.x === t2.x &&
    t1.y === t2.y &&
    t1.label === t2.label &&
    t1.name === t2.name &&
    (t1.guard || '') === (t2.guard || '');

  if (!equal && isDev()) {
    console.log(`HistoryManager: Transition ${t1.id} differs - x: ${t1.x} vs ${t2.x}, y: ${t1.y} vs ${t2.y}, label: ${t1.label} vs ${t2.label}, name: ${t1.name} vs ${t2.name}`);
  }

  return equal;
}

function compareArc(a1, a2) {
  const coreEqual =
    a1.source === a2.source &&
    a1.target === a2.target &&
    a1.weight === a2.weight;

  if (!coreEqual) {
    if (isDev()) {
      console.log(`HistoryManager: Arc ${a1.id} differs - source: ${a1.source} vs ${a2.source}, target: ${a1.target} vs ${a2.target}, weight: ${a1.weight} vs ${a2.weight}`);
    }
    return false;
  }

  const secondaryEqual =
    (a1.label || '') === (a2.label || '') &&
    (a1.sourceType || '') === (a2.sourceType || '') &&
    (a1.targetType || '') === (a2.targetType || '') &&
    JSON.stringify(a1.bindings || []) === JSON.stringify(a2.bindings || []) &&
    JSON.stringify(a1.anglePoints || []) === JSON.stringify(a2.anglePoints || []);

  if (!secondaryEqual && isDev()) {
    console.log(`HistoryManager: Arc ${a1.id} differs in secondary properties`);
  }

  return secondaryEqual;
}

