import { readQuotaResponse, quotaInterface, quotaPageUrl, createQuotaBrowserSystem } from '../../satel/blackbox/web/QuotaBrowserAdapter.js';
import { createMethodGateExample } from '../../satel/examples/methods-gates/editor.js';
import { checkInterface } from '../../satel/core/SequenceRunner.js';

function response(method, fields = {}, status = 'accepted') {
  const root = document.createElement('output');
  root.dataset.operation = method; root.dataset.state = status;
  for (const [name, value] of Object.entries(fields)) {
    const field = document.createElement('span');
    field.dataset.field = name; field.dataset.value = String(value); root.append(field);
  }
  return root;
}
test('independently declared browser contract matches the quota APN', () => {
  expect(() => checkInterface(createMethodGateExample('gates-exercise-quota-reference'), quotaInterface)).not.toThrow();
  expect(quotaPageUrl('reference', 'https://example.org/editor/staging/index.html')).toBe('https://example.org/editor/staging/quota-sut/index.html?variant=reference');
  expect(() => quotaPageUrl('unknown')).toThrow(/Unknown/);
});
test('completed audit maps both public fields, including zero, to transient gates', () => {
  expect(readQuotaResponse(response('audit', { available: 10, held: 0 }), 'audit')).toEqual({
    status: 'accepted', outputs: { eligible: [], ack: [], free: [10], reserved: [0] }
  });
});
test('non-priority reservation is accepted and false is an observed value', () => {
  expect(readQuotaResponse(response('reserve', { priority: false }), 'reserve')).toEqual({
    status: 'accepted', outputs: { eligible: [false], ack: [], free: [], reserved: [] }
  });
});
test('explicit refusal has no gate occurrences', () => {
  expect(readQuotaResponse(response('release', {}, 'refused'), 'release')).toEqual({
    status: 'refused', outputs: { eligible: [], ack: [], free: [], reserved: [] }
  });
});
test.each([
  ['audit', { available: 10 }], ['audit', { available: -1, held: 0 }],
  ['audit', { available: 'NaN', held: 0 }], ['audit', { available: '9007199254740992', held: 0 }],
  ['reserve', { priority: 'yes' }], ['release', { acknowledged: true, secret: 1 }]
])('malformed %s response is an adapter error', (method, fields) => {
  expect(() => readQuotaResponse(response(method, fields), method)).toThrow();
});
test('pending, duplicate and stale responses are not completed observations', () => {
  const root = response('audit', { available: 10, held: 0 });
  root.append(root.firstChild.cloneNode(true));
  expect(() => readQuotaResponse(root, 'audit')).toThrow(/duplicate/);
  expect(() => readQuotaResponse(response('audit', {}, 'pending'), 'audit')).toThrow();
  expect(() => readQuotaResponse(response('audit', { available: 10, held: 0 }), 'reserve')).toThrow();
});
test('reset is required and an already-aborted reset cannot start navigation', async () => {
  const frame = document.createElement('iframe'); document.body.append(frame);
  const adapter = createQuotaBrowserSystem({ frame });
  await expect(adapter.invoke({ method: 'audit', arguments: {} })).rejects.toThrow(/Reset/);
  const controller = new AbortController(); controller.abort();
  await expect(adapter.reset({ signal: controller.signal })).rejects.toMatchObject({ code: 'cancelled' });
  expect(frame.getAttribute('src')).toBeNull();
  frame.remove();
});
