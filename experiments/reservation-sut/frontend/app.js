let request = 0;
const buttons = [...document.querySelectorAll('button[data-method]')];
for (const button of buttons) button.addEventListener('click', async () => {
  buttons.forEach(b => b.disabled = true);
  const method = button.dataset.method;
  const args = method === 'reserve' ? {warehouse: Number(button.dataset.warehouse)} : {};
  try {
    const response = await fetch('/api/reservation/' + method, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(args)});
    const data = await response.json();
    if (!['accepted', 'refused'].includes(data.status)) throw Error(data.error || 'Invalid response');
    const name = n => n === 1 ? 'North (A)' : n === 2 ? 'South (B)' : 'Warehouse ' + n;
    const message = data.status === 'refused' ? data.reason : method === 'open' ? 'Both warehouses are available for your choice.' : method === 'finish' ? 'Receipt issued for ' + name(data.result.receipt) + '.' : 'Reserved at ' + name(data.result.allocated) + '.';
    document.querySelector('#status').textContent = data.status === 'refused' ? 'Request declined' : method === 'open' ? 'Reservation opened' : method === 'finish' ? 'Reservation complete' : 'Warehouse allocated';
    document.querySelector('#message').textContent = message;
    const item = document.createElement('li'); item.textContent = message; document.querySelector('#activity').append(item);
    const out = document.querySelector('#response'); out.textContent = JSON.stringify(data, null, 2); out.dataset.command = method; out.dataset.request = String(++request);
  } catch (error) {
    document.querySelector('#status').textContent = 'Connection problem'; document.querySelector('#message').textContent = error.message;
    const out = document.querySelector('#response'); out.textContent = JSON.stringify({error: error.message}); out.dataset.command = method; out.dataset.request = String(++request);
  } finally { buttons.forEach(b => b.disabled = false); }
});
