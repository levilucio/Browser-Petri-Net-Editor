// Token formatting utilities used across panels/components.

function isPair(value) {
  return value && typeof value === 'object' && (value.__pair__ || (Object.prototype.hasOwnProperty.call(value, 'fst') && Object.prototype.hasOwnProperty.call(value, 'snd')));
}

export function formatToken(value) {
  if (typeof value === 'boolean') return value ? 'T' : 'F';
  if (typeof value === 'string') return `'${value}'`;
  if (Array.isArray(value)) return `[${value.map(formatToken).join(', ')}]`;
  if (isPair(value)) return `(${formatToken(value.fst)}, ${formatToken(value.snd)})`;
  return String(value);
}

export function formatTokensList(values) {
  if (!Array.isArray(values) || values.length === 0) return '';
  return values.map(formatToken).join(', ');
}

export default {
  formatToken,
  formatTokensList,
};



