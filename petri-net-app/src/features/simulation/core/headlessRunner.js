const tinyYield = async () => {
  try { await new Promise((res) => setTimeout(res, 0)); } catch (_) {}
  try {
    if (typeof requestAnimationFrame !== 'undefined') {
      await new Promise((res) => requestAnimationFrame(() => res()));
    }
  } catch (_) {}
};

const computeIsolatedTransitions = (net) => {
  const isolated = new Set();
  if (!net || !Array.isArray(net.transitions)) return isolated;
  const arcs = Array.isArray(net.arcs) ? net.arcs : [];
  const places = Array.isArray(net.places) ? net.places : [];
  const placeIds = new Set(places.map((place) => String(place.id)));

  for (const transition of net.transitions) {
    const transitionId = String(transition.id);
    let hasInput = false;
    let hasOutput = false;

    for (const arc of arcs) {
      const source = String(arc.sourceId || arc.source);
      const target = String(arc.targetId || arc.target);

      if (target === transitionId && source !== transitionId && placeIds.has(source)) {
        hasInput = true;
      }
      if (source === transitionId && target !== transitionId && placeIds.has(target)) {
        hasOutput = true;
      }
      if (hasInput && hasOutput) break;
    }

    if (!hasInput && !hasOutput) {
      isolated.add(transitionId);
    }
  }

  return isolated;
};

const chooseGreedyNonConflicting = (enabledIds, arcs, batchMax) => {
  const byTransition = new Map();
  for (const id of enabledIds) {
    byTransition.set(id, new Set());
  }

  for (const arc of (arcs || [])) {
    const target = arc.targetId || arc.target;
    const source = arc.sourceId || arc.source;
    const placeToTransition = (arc.type === 'place-to-transition') || (arc.sourceType === 'place');
    if (placeToTransition && byTransition.has(target)) {
      byTransition.get(target).add(source);
    }
  }

  const order = enabledIds.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }

  const usedPlaces = new Set();
  const selection = [];
  for (const id of order) {
    const inputs = byTransition.get(id) || new Set();
    let canUse = true;
    for (const place of inputs) {
      if (usedPlaces.has(place)) {
        canUse = false;
        break;
      }
    }
    if (!canUse) continue;
    selection.push(id);
    for (const place of inputs) {
      usedPlaces.add(place);
    }
    if (batchMax > 0 && selection.length >= batchMax) break;
  }

  return selection;
};

const normalizeEnabledIds = (enabled = []) => enabled.map((entry) => {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object') {
    if (entry.id) return entry.id;
    if (entry.get) return entry.get('id');
  }
  return String(entry);
}).filter(Boolean);

export const runHeadlessSimulation = async ({
  simulator,
  mode = 'single',
  maxSteps = 100000,
  timeBudgetMs = 30000,
  yieldEvery = 100,
  onProgress,
  shouldCancel,
  batchMax = 0,
  progressEveryMs = 0,
  yieldEveryMs = 0,
}) => {
  const now = (typeof performance !== 'undefined' && performance.now)
    ? () => performance.now()
    : () => Date.now();

  const startTs = now();
  let steps = 0;
  let lastProgressTs = startTs;
  let lastYieldTs = startTs;
  let lastReportedBucket = -1;

  const emitProgress = (timestamp) => {
    if (!onProgress) return;
    const elapsed = timestamp - startTs;
    const bucket = progressEveryMs > 0 ? Math.floor(elapsed / progressEveryMs) : 0;
    if (bucket === lastReportedBucket) return;
    lastReportedBucket = bucket;
    try {
      onProgress({ steps, elapsedMs: elapsed });
    } catch (_) {}
  };

  const isolatedIds = computeIsolatedTransitions(simulator.petriNet || {});

  const getEnabledIds = async () => {
    const enabled = await simulator.getEnabledTransitions();
    const ids = normalizeEnabledIds(enabled);
    return ids.filter((id) => !isolatedIds.has(String(id)));
  };

  const shouldContinueAfterStep = async () => {
    if (shouldCancel && shouldCancel()) return false;

    const timestamp = now();
    const elapsed = timestamp - startTs;

    if (yieldEvery > 0 && steps % yieldEvery === 0) {
      const preYieldTs = now();
      emitProgress(preYieldTs);
      await tinyYield();
      const postYieldTs = now();
      lastYieldTs = postYieldTs;
      lastProgressTs = postYieldTs;
      if (progressEveryMs > 0) emitProgress(postYieldTs);
      if (timeBudgetMs > 0 && (postYieldTs - startTs) > timeBudgetMs) return false;
      if (shouldCancel && shouldCancel()) return false;
      return true;
    }

    if (progressEveryMs > 0 && (timestamp - lastProgressTs) >= progressEveryMs) {
      emitProgress(timestamp);
      lastProgressTs = timestamp;
    }

    if (yieldEveryMs > 0 && (timestamp - lastYieldTs) >= yieldEveryMs) {
      await tinyYield();
      const postYieldTs = now();
      lastYieldTs = postYieldTs;
      if (progressEveryMs > 0 && (postYieldTs - lastProgressTs) >= progressEveryMs) {
        emitProgress(postYieldTs);
        lastProgressTs = postYieldTs;
      }
      if (timeBudgetMs > 0 && (postYieldTs - startTs) > timeBudgetMs) return false;
      if (shouldCancel && shouldCancel()) return false;
    }

    if (timeBudgetMs > 0 && elapsed > timeBudgetMs) return false;
    if (shouldCancel && shouldCancel()) return false;
    return true;
  };

  let continueRunning = true;
  while (continueRunning && steps < maxSteps) {
    if (shouldCancel && shouldCancel()) break;
    const enabledIds = await getEnabledIds();
    if (!enabledIds || enabledIds.length === 0) break;

    if (mode === 'maximal') {
      const net = simulator.petriNet || {};
      const cap = batchMax > 0 ? batchMax : Number.POSITIVE_INFINITY;
      let batch = chooseGreedyNonConflicting(enabledIds, net.arcs || [], cap);
      if (!batch || batch.length === 0) {
        const fallback = enabledIds[Math.floor(Math.random() * enabledIds.length)];
        batch = fallback ? [fallback] : [];
      }

      if (shouldCancel && shouldCancel()) {
        continueRunning = false;
        break;
      }

      await Promise.all(batch.map((id) => simulator.fireTransition(id, { skipEnabledCheck: true })));
      steps += batch.length;
      continueRunning = await shouldContinueAfterStep();
    } else {
      const pick = enabledIds[Math.floor(Math.random() * enabledIds.length)];
      await simulator.fireTransition(pick);
      steps += 1;
      continueRunning = await shouldContinueAfterStep();
    }
  }

  if (onProgress) {
    try {
      onProgress({ steps, elapsedMs: now() - startTs });
    } catch (_) {}
  }

  return {
    petriNet: simulator.petriNet || null,
    steps,
  };
};

export const headlessHelpers = {
  computeIsolatedTransitions,
  chooseGreedyNonConflicting,
  normalizeEnabledIds,
};

