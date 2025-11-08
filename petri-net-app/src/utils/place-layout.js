const DEFAULT_BASE_RADIUS = 30;
const MAX_RADIUS_MULTIPLIER = 4;
const RADIUS_STEP = 4;
const PADDING = 4;
const GRID_GAP = 2;
const MAX_FONT_SIZE = 12;
const MIN_FONT_SIZE = 10;
const SCATTER_THRESHOLD = 10;

const CHAR_WIDTH_FACTOR = 0.48;
const TEXT_PADDING_FACTOR = 0.25;

const EMPTY_VALUE_TOKENS_KEY = {};
const algebraicVisualCache = new WeakMap();

function cacheVisuals(cacheKey, baseRadius, visuals) {
  algebraicVisualCache.set(cacheKey, { baseRadius, visuals });
  return visuals;
}
function layoutsOverlap(boxA, boxB, margin = 2) {
  const aRight = boxA.x + boxA.width;
  const aBottom = boxA.y + boxA.height;
  const bRight = boxB.x + boxB.width;
  const bBottom = boxB.y + boxB.height;

  return !(
    aRight + margin <= boxB.x ||
    bRight + margin <= boxA.x ||
    aBottom + margin <= boxB.y ||
    bBottom + margin <= boxA.y
  );
}

function generateRingCandidates(count) {
  if (count <= 0) return [];

  const candidates = [[count]];

  if (count >= 4) {
    const maxOuter = Math.min(6, count - 1);
    for (let outer = maxOuter; outer >= Math.ceil(count / 2); outer -= 1) {
      const inner = count - outer;
      if (inner >= 1) {
        candidates.push([outer, inner]);
      }
    }
  }

  if (count >= 7) {
    const outer = Math.min(6, count - 3);
    const middle = Math.max(2, Math.ceil((count - outer) / 2));
    const inner = count - outer - middle;
    if (inner > 0) {
      candidates.push([outer, middle, inner]);
    }
  }

  return candidates;
}

function allocateTokensForRings(ringCounts, ringTokenIndices, measurements) {
  const sorted = [...ringTokenIndices].sort(
    (a, b) => measurements[b].width - measurements[a].width
  );
  const allocations = [];
  let offset = 0;
  for (let i = 0; i < ringCounts.length; i += 1) {
    const count = ringCounts[i];
    const slice = sorted.slice(offset, offset + count);
    if (slice.length < count) {
      return null;
    }
    allocations.push(slice);
    offset += count;
  }
  return allocations;
}

function computeRingRadii(allocations, measurements, availableRadius, fontSize, centerTokenRadius) {
  const ringLevels = allocations.length;
  if (ringLevels === 0) {
    return [];
  }

  const radii = new Array(ringLevels);
  const outerTokens = allocations[0];
  const outerMaxDiagonal = Math.max(
    ...outerTokens.map((idx) => measurements[idx].diagonal),
    fontSize
  );
  let outerRadius = availableRadius - outerMaxDiagonal - GRID_GAP;
  if (outerRadius <= 0) return null;

  const minInnerRadiusBase = centerTokenRadius
    ? centerTokenRadius + fontSize + GRID_GAP
    : fontSize + GRID_GAP;

  if (ringLevels === 1) {
    radii[0] = Math.max(outerRadius, minInnerRadiusBase);
    return radii;
  }

  const innerMostTokens = allocations[ringLevels - 1];
  const innerMaxDiagonal = Math.max(
    ...innerMostTokens.map((idx) => measurements[idx].diagonal),
    fontSize
  );
  const minAllowedInnerRadius = Math.max(minInnerRadiusBase, innerMaxDiagonal + GRID_GAP);

  const totalSpacingNeeded = outerRadius - minAllowedInnerRadius;
  const ringSpacing = Math.max(fontSize + GRID_GAP, totalSpacingNeeded / ringLevels);

  radii[0] = outerRadius;
  for (let ringIdx = 1; ringIdx < ringLevels; ringIdx += 1) {
    const prevRadius = radii[ringIdx - 1];
    const tentative = prevRadius - ringSpacing;
    const tokens = allocations[ringIdx];
    const ringMaxDiagonal = Math.max(
      ...tokens.map((idx) => measurements[idx].diagonal),
      fontSize
    );
    const requiredRadius = Math.max(
      ringMaxDiagonal + GRID_GAP,
      minInnerRadiusBase,
    );
    radii[ringIdx] = Math.max(tentative, requiredRadius);
    if (radii[ringIdx] <= 0) {
      return null;
    }
  }

  if (radii[ringLevels - 1] < minAllowedInnerRadius) {
    radii[ringLevels - 1] = minAllowedInnerRadius;
  }

  return radii;
}

function calculateLayoutRadius(layout, baseRadius, fallbackRadius) {
  if (!layout || layout.length === 0) {
    return baseRadius;
  }

  let maxDistance = 0;
  layout.forEach((entry) => {
    const centerX = entry.x + entry.width / 2;
    const centerY = entry.y + entry.height / 2;
    const halfDiagonal = Math.hypot(entry.width / 2, entry.height / 2);
    const distance = Math.hypot(centerX, centerY) + halfDiagonal + PADDING;
    if (distance > maxDistance) {
      maxDistance = distance;
    }
  });

  const neededRadius = Math.ceil(maxDistance);
  if (neededRadius > fallbackRadius && fallbackRadius >= baseRadius) {
    return fallbackRadius;
  }
  return Math.max(baseRadius, neededRadius);
}

export function formatAlgebraicToken(value) {
  if (typeof value === 'boolean') return value ? 'T' : 'F';
  if (typeof value === 'string') return `'${value}'`;
  if (Array.isArray(value)) return `[${value.map(formatAlgebraicToken).join(', ')}]`;
  if (value && typeof value === 'object' && value.__pair__) {
    return `(${formatAlgebraicToken(value.fst)}, ${formatAlgebraicToken(value.snd)})`;
  }
  return String(value);
}

function estimateTextWidth(text, fontSize) {
  if (!text.length) return fontSize;
  return Math.max(fontSize, text.length * fontSize * CHAR_WIDTH_FACTOR);
}

function computeFontSizeForCell(text, cellWidth, cellHeight) {
  const widthLimit = cellWidth / ((text.length || 1) * CHAR_WIDTH_FACTOR);
  const heightLimit = cellHeight * 0.85;
  const fontSize = Math.min(MAX_FONT_SIZE, widthLimit, heightLimit);
  return Math.max(MIN_FONT_SIZE, fontSize);
}

function tryLayout(formattedTokens, radius, baseRadius) {
  const count = formattedTokens.length;
  if (count === 0) return null;

  const availableRadius = radius - PADDING;
  if (availableRadius <= 0) return null;

  const innerDiameter = availableRadius * 2;

  const layoutCombos = [];
  for (let cols = 1; cols <= count; cols += 1) {
    const rows = Math.ceil(count / cols);
    if (cols === 1 && count > 4) {
      continue;
    }
    if (rows === 1 && count > 4) {
      continue;
    }
    layoutCombos.push({ cols, rows });
  }

  layoutCombos.sort((a, b) => {
    const diff = Math.abs(a.cols - a.rows) - Math.abs(b.cols - b.rows);
    if (diff !== 0) return diff;
    return a.cols - b.cols;
  });

  const longestTokenLength = Math.max(...formattedTokens.map((token) => token.length || 1), 1);

  for (const combo of layoutCombos) {
    const cols = combo.cols;
    const rows = combo.rows;

    const usableWidth = innerDiameter - GRID_GAP * (cols - 1);
    const usableHeight = innerDiameter - GRID_GAP * (rows - 1);
    if (usableWidth <= 0 || usableHeight <= 0) {
      continue;
    }

    const cellWidth = usableWidth / cols;
    const cellHeight = usableHeight / rows;

    const maxFontByHeight = cellHeight * 0.8;
    const maxFontByWidth = cellWidth / (longestTokenLength * CHAR_WIDTH_FACTOR || 1);
    const candidateFontSize = Math.min(MAX_FONT_SIZE, maxFontByHeight, maxFontByWidth);

    if (candidateFontSize < MIN_FONT_SIZE) {
      continue;
    }

    const layout = [];
    let fits = true;

    const colSpacing = cellWidth + GRID_GAP;
    const rowSpacing = cellHeight + GRID_GAP;
    const totalWidth = colSpacing * (cols - 1);
    const totalHeight = rowSpacing * (rows - 1);
    const originX = -totalWidth / 2;
    const originY = -totalHeight / 2;

    formattedTokens.forEach((text, index) => {
      if (!fits) return;
      const row = Math.floor(index / cols);
      const col = index % cols;

      const remaining = count - row * cols;
      const itemsInRow = row === rows - 1 ? Math.min(remaining, cols) : cols;
      const rowStartX = originX + ((cols - itemsInRow) * colSpacing) / 2;

      const centerX = rowStartX + col * colSpacing;
      const centerY = originY + row * rowSpacing;

      const textWidth = estimateTextWidth(text, candidateFontSize);
      const halfWidth = textWidth / 2;
      const halfHeight = candidateFontSize / 2;
      const textDiagonal = Math.hypot(halfWidth, halfHeight);
      const distanceToCenter = Math.hypot(centerX, centerY);

      if (distanceToCenter + textDiagonal > availableRadius) {
        fits = false;
        return;
      }

      layout.push({
        key: `token-${index}`,
        text,
        fontSize: candidateFontSize,
        x: centerX - cellWidth / 2,
        y: centerY - candidateFontSize / 2,
        width: cellWidth,
        height: candidateFontSize,
      });
    });

    if (fits) {
      const finalRadius = calculateLayoutRadius(layout, baseRadius, radius);
      return { radius: finalRadius, layout };
    }
  }

  return null;
}

function buildScatterLayout(formattedTokens, radius, baseRadius) {
  const count = formattedTokens.length;
  if (count === 0) {
    return {
      layout: [],
      radius: baseRadius,
    };
  }

  const availableRadius = radius - PADDING;
  if (availableRadius <= 0) return null;

  // Start with a reasonable font size and iterate downwards if needed
  const longestLength = Math.max(...formattedTokens.map(t => t.length || 1), 1);
  const startingFont = Math.max(
    MIN_FONT_SIZE,
    Math.min(12, availableRadius * 2 / (longestLength * CHAR_WIDTH_FACTOR))
  );

  const tokenIndices = formattedTokens.map((_, idx) => idx);

  const attemptLayout = (fontSize) => {
    const measurements = tokenIndices.map((idx) => {
      const width = estimateTextWidth(formattedTokens[idx], fontSize);
      return {
        width,
        halfWidth: width / 2,
        halfHeight: fontSize / 2,
        diagonal: Math.hypot(width / 2, fontSize / 2),
      };
    });

    if (count === 1) {
      const m = measurements[0];
      if (m.diagonal > availableRadius) {
        return null;
      }
      const paddedWidth = m.width * (1 + TEXT_PADDING_FACTOR);
      const layout = [{
        key: 'token-0',
        text: formattedTokens[0],
        fontSize,
        x: -paddedWidth / 2,
        y: -m.halfHeight,
        width: paddedWidth,
        height: fontSize,
      }];
      return {
        layout,
        radius: calculateLayoutRadius(layout, baseRadius, radius),
      };
    }

    let centerTokenIndex = null;
    let centerTokenRadius = 0;

    if (count % 2 === 1 && count > 1) {
      const sorted = [...tokenIndices].sort(
        (a, b) => measurements[b].width - measurements[a].width
      );
      const candidate = sorted[0];
      const candidateRadius = measurements[candidate].diagonal;

      const ringCandidateIndices = tokenIndices.filter((idx) => idx !== candidate);
      const maxRingDiagonalCandidate = ringCandidateIndices.length
        ? Math.max(...ringCandidateIndices.map((idx) => measurements[idx].diagonal))
        : 0;
      const minRingRadiusForCandidate = candidateRadius + fontSize * 0.5;
      const maxRingRadiusForCandidate = availableRadius - maxRingDiagonalCandidate - 2;

      if (maxRingRadiusForCandidate >= minRingRadiusForCandidate) {
        centerTokenIndex = candidate;
        centerTokenRadius = candidateRadius;
      }
    }

    const layout = new Array(count);

    if (centerTokenIndex !== null) {
      const centerMeasure = measurements[centerTokenIndex];
      if (centerMeasure.diagonal > availableRadius) {
        return null;
      }
      const paddedWidth = centerMeasure.width * (1 + TEXT_PADDING_FACTOR);
      layout[centerTokenIndex] = {
        key: `token-${centerTokenIndex}`,
        text: formattedTokens[centerTokenIndex],
        fontSize,
        x: -paddedWidth / 2,
        y: -centerMeasure.halfHeight,
        width: paddedWidth,
        height: fontSize,
      };
    }

    const ringTokenIndices = tokenIndices.filter((idx) => idx !== centerTokenIndex);
    if (ringTokenIndices.length === 0) {
      const filtered = layout.filter(Boolean);
      return {
        layout: filtered,
        radius: calculateLayoutRadius(filtered, baseRadius, radius),
      };
    }

    const baseLayout = layout.slice();
    const ringCandidates = generateRingCandidates(ringTokenIndices.length);

    for (const ringCounts of ringCandidates) {
      const allocations = allocateTokensForRings(ringCounts, ringTokenIndices, measurements);
      if (!allocations) continue;

      const radii = computeRingRadii(allocations, measurements, availableRadius, fontSize, centerTokenRadius);
      if (!radii) continue;

      const candidateLayout = baseLayout.slice();
      let placementValid = true;

      allocations.forEach((tokensInRing, ringIdx) => {
        const ringRadius = radii[ringIdx];
        const ringCount = tokensInRing.length;
        if (!ringCount) return;
        const angleOffset = ringIdx % 2 === 1 ? Math.PI / ringCount : 0;

        tokensInRing.forEach((tokenIndex, orderIdx) => {
          if (!placementValid) return;
          const measure = measurements[tokenIndex];
          const paddedWidth = measure.width * (1 + TEXT_PADDING_FACTOR);
          const paddedHalfWidth = paddedWidth / 2;
          const angle = -Math.PI / 2 + (2 * Math.PI * orderIdx) / ringCount + angleOffset;
          const centerX = Math.cos(angle) * ringRadius;
          const centerY = Math.sin(angle) * ringRadius;

          if (Math.hypot(centerX, centerY) + measure.diagonal > availableRadius + GRID_GAP) {
            placementValid = false;
            return;
          }

          candidateLayout[tokenIndex] = {
            key: `token-${tokenIndex}`,
            text: formattedTokens[tokenIndex],
            fontSize,
            x: centerX - paddedHalfWidth,
            y: centerY - measure.halfHeight,
            width: paddedWidth,
            height: fontSize,
          };
        });
      });

      if (!placementValid) {
        continue;
      }

      const filtered = candidateLayout.filter(Boolean);
      if (filtered.length !== count) {
        continue;
      }

      let overlap = false;
      for (let i = 0; i < filtered.length; i += 1) {
        for (let j = i + 1; j < filtered.length; j += 1) {
          if (layoutsOverlap(filtered[i], filtered[j])) {
            overlap = true;
            break;
          }
        }
        if (overlap) break;
      }

      if (!overlap) {
        const finalRadius = calculateLayoutRadius(filtered, baseRadius, radius);
        return { layout: filtered, radius: finalRadius };
      }
    }

    return null;
  };

  for (let font = startingFont; font >= MIN_FONT_SIZE; font -= 0.5) {
    const result = attemptLayout(font);
    if (result && result.layout && result.layout.length === count) {
      return result;
    }
  }

  return null;
}

export function computeAlgebraicPlaceVisuals(valueTokens, baseRadius = DEFAULT_BASE_RADIUS) {
  const cacheKey = Array.isArray(valueTokens) ? valueTokens : EMPTY_VALUE_TOKENS_KEY;
  const cached = algebraicVisualCache.get(cacheKey);
  if (cached && cached.baseRadius === baseRadius) {
    return cached.visuals;
  }

  const tokensArray = Array.isArray(valueTokens) ? valueTokens : [];
  if (tokensArray.length === 0) {
    return cacheVisuals(cacheKey, baseRadius, {
      radius: baseRadius,
      tokens: [],
      indicator: null,
    });
  }

  const formattedTokens = tokensArray.map(formatAlgebraicToken);
  const maxRadius = baseRadius * MAX_RADIUS_MULTIPLIER;

  for (let radius = baseRadius; radius <= maxRadius; radius += RADIUS_STEP) {
    if (formattedTokens.length <= SCATTER_THRESHOLD) {
      const scatterResult = buildScatterLayout(formattedTokens, radius, baseRadius);
      if (scatterResult && scatterResult.layout?.length === formattedTokens.length) {
        const adjustedRadius = Math.max(baseRadius, Math.min(scatterResult.radius, radius));
        return cacheVisuals(cacheKey, baseRadius, {
          radius: adjustedRadius,
          tokens: scatterResult.layout,
          indicator: null,
        });
      }
    }

    const layout = tryLayout(formattedTokens, radius, baseRadius);
    if (layout) {
      const adjustedRadius = Math.max(baseRadius, Math.min(layout.radius, radius));
      return cacheVisuals(cacheKey, baseRadius, {
        radius: adjustedRadius,
        tokens: layout.layout,
        indicator: null,
      });
    }
  }

  // If nothing fits, show count indicator at max radius
  return cacheVisuals(cacheKey, baseRadius, {
    radius: baseRadius,
    tokens: [],
    indicator: formattedTokens.length,
  });
}

export function resolvePlaceRadius(place, netMode, baseRadius = DEFAULT_BASE_RADIUS) {
  if (!place) return baseRadius;
  
  // Guard against non-object place values
  if (typeof place !== 'object') return baseRadius;
  
  // Only compute dynamic radius for algebraic nets
  if (netMode === 'algebraic-int' || Array.isArray(place.valueTokens)) {
    const visuals = computeAlgebraicPlaceVisuals(place.valueTokens, baseRadius);
    if (visuals && typeof visuals.radius === 'number' && Number.isFinite(visuals.radius)) {
      return visuals.radius;
    }
  }
  return baseRadius;
}



