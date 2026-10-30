import { createQuotaService, variants } from './service.js';
const variant = new URLSearchParams(location.search).get('variant') || 'reference';
const response = document.getElementById('response');
const buttons = [...document.querySelectorAll('button')];
if (!variants.includes(variant)) throw new Error('Unknown quota variant');
const service = createQuotaService(variant);
document.getElementById('variant').textContent = variant === 'reference' ? 'Reference implementation' : `Experiment variant: ${variant}`;
let busy = false, request = 0;
const field = (name, label, value) => {
  const p = document.createElement('p');
  p.dataset.field = name; p.dataset.value = String(value);
  p.textContent = `${label}: ${value}`;
  return p;
};
for (const button of buttons) button.addEventListener('click', async () => {
  if (busy) return;
  busy = true; buttons.forEach(b => { b.disabled = true; });
  const operation = button.id, amount = Number(document.getElementById('quantity').value);
  response.dataset.request = String(++request);
  response.dataset.operation = operation;
  response.dataset.state = 'pending';
  response.textContent = `${operation}: processing…`;
  // Observable elapsed time, with one outstanding operation and no interleaving.
  if (variant === 'timeout') return;
  await new Promise(resolve => setTimeout(resolve, 25));
  try {
    const result = service.invoke(operation, amount);
    response.replaceChildren();
    const heading = document.createElement('p');
    heading.textContent = `${operation}: ${result.status}`;
    response.append(heading);
    if (result.status === 'accepted') {
      if (operation === 'reserve') response.append(field('priority', 'Priority eligible', result.priority));
      if (operation === 'release') response.append(field('acknowledged', 'Release acknowledged', result.acknowledged));
      if (operation === 'audit') response.append(field('available', 'Available resources', result.available), field('held', 'Held resources', result.held));
    }
    // Completion is published last, after the entire response is present.
    response.dataset.state = result.status;
  } catch (error) {
    response.textContent = error.message; response.dataset.state = 'error';
  } finally {
    busy = false; buttons.forEach(b => { b.disabled = false; });
  }
});
response.textContent = 'Ready. Choose an operation.';
buttons.forEach(b => { b.disabled = false; });
document.documentElement.dataset.quotaReady = 'true';
