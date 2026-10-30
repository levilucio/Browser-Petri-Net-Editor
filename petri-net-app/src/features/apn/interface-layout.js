import { getPublicMethods } from '../../domain/apn/PublicMethods.js';
import { getGates } from '../../domain/apn/Gates.js';

// Clip a line segment against a rectangle (closed intervals).
function crosses(a, b, box) {
  let lo = 0, hi = 1;
  for (const [axis, min, max] of [['x', box.left, box.right], ['y', box.top, box.bottom]]) {
    const d = b[axis] - a[axis];
    if (!d) { if (a[axis] < min || a[axis] > max) return false; continue; }
    const t1 = (min - a[axis]) / d, t2 = (max - a[axis]) / d;
    lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2));
    if (lo > hi) return false;
  }
  return true;
}
function routeSynchronization(t, end, frame, nodes) {
  const dx = end.x - t.x, dy = end.y - t.y;
  const distance = Math.min(20 / Math.abs(dx || 0.0001), 25 / Math.abs(dy || 0.0001));
  const start = { x: t.x + dx * distance, y: t.y + dy * distance };
  const obstacles = nodes.filter(n => n.id !== t.id).map(n => ({ left: n.x - 38, right: n.x + 38, top: n.y - 34, bottom: n.y + 64 }));
  const clear = path => path.slice(1).every((p, i) => obstacles.every(b => !crosses(path[i], p, b)));
  const direct = [start, end];
  if (clear(direct)) return direct;
  const ys = [frame.y + 28, frame.y + frame.height - 30, ...nodes.flatMap(n => [n.y - 48, n.y + 78])];
  const candidates = ys.filter(y => y > frame.y + 20 && y < frame.y + frame.height - 20).map(y => [
    { x: t.x, y: t.y + (y < t.y ? -25 : 25) }, { x: t.x, y }, { x: end.x - 24, y }, { x: end.x - 24, y: end.y }, end,
  ]).filter(clear);
  const length = path => path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x-path[i].x, p.y-path[i].y), 0);
  return candidates.sort((a,b) => length(a)-length(b))[0] || direct;
}

// Presentation only: ports and synchronization edges are derived, never net arcs.
export function apnInterfaceLayout(net) {
  if (!Array.isArray(net?.gates)) return null;
  let methods, gates;
  try { methods = getPublicMethods(net); gates = getGates(net); }
  catch { return null; } // The source editor reports invalid declarations.
  const nodes = [...(net.places || []), ...(net.transitions || [])];
  const positions = nodes.filter(n => Number.isFinite(n.x) && Number.isFinite(n.y));
  const minX = positions.length ? Math.min(...positions.map(n => n.x)) : 140;
  const minY = positions.length ? Math.min(...positions.map(n => n.y)) : 120;
  const maxX = positions.length ? Math.max(...positions.map(n => n.x)) : 420;
  const maxY = positions.length ? Math.max(...positions.map(n => n.y)) : 260;
  const frame = {
    x: minX - 70, y: minY - 70,
    width: Math.max(420, maxX - minX + 270, methods.length * 170 + 40),
    height: Math.max(280, maxY - minY + 190, gates.length * 76 + 90),
  };
  const methodPorts = methods.map((m, i) => ({
    ...m, x: frame.x + (i + 0.5) * frame.width / Math.max(1, methods.length), y: frame.y + frame.height,
    label: `${m.name}(${m.parameters.map(p => p.name).join(', ')})`,
  }));
  const gatePorts = gates.map((g, i) => ({
    ...g, x: frame.x + frame.width, y: frame.y + 65 + i * 76,
    label: `${g.name}(${g.parameters.map(p => p.sort).join(', ')})`,
  }));
  const connections = [];
  for (const t of net.transitions || []) {
    if (!Number.isFinite(t.x) || !Number.isFinite(t.y)) continue;
    for (const [index, call] of (Array.isArray(t.gates) ? t.gates : []).entries()) {
      const port = gatePorts.find(g => g.name === call.gate);
      if (!port || !Array.isArray(call.arguments)) continue;
      const incoming = (net.transitions || []).flatMap(rule => (Array.isArray(rule.gates) ? rule.gates : []).map((g, i) => ({ rule: rule.id, index: i, gate: g.gate }))).filter(g => g.gate === call.gate);
      const slot = incoming.findIndex(g => g.rule === t.id && g.index === index);
      const end = { x: port.x - 7, y: port.y + ((slot + 1) / (incoming.length + 1) - 0.5) * 28 };
      const path = routeSynchronization(t, end, frame, positions);
      const segments = path.slice(1).map((p, i) => ({ a: path[i], b: p, length: Math.hypot(p.x-path[i].x, p.y-path[i].y) }));
      const segment = segments.sort((a,b) => b.length-a.length)[0];
      // Arguments belong to this synchronization occurrence; its endpoint names the gate.
      const label = call.arguments.map(a => String(a).replace(/\s*[\r\n]+\s*/g, ' ')).join(', ') || '()';
      const labelWidth = Math.max(28, Math.min(230, label.length * 6.2 + 10));
      connections.push({
        id: `${t.id}:gate:${index}`, transitionId: t.id, gate: call.gate,
        points: path.flatMap(p => [p.x, p.y]), label,
        labelX: segment.a.x + (segment.b.x - segment.a.x) * 0.58 - labelWidth / 2,
        labelY: segment.a.y + (segment.b.y - segment.a.y) * 0.58 - 20,
        labelWidth,
      });
    }
  }
  return {
    frame, methods: methodPorts, gates: gatePorts, connections,
    title: net.apnClass || 'APN',
    bounds: { left: frame.x, top: frame.y, right: frame.x + frame.width + (gates.length ? 210 : 0), bottom: frame.y + frame.height + 74 },
  };
}
