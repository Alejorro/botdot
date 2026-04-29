const test = require('node:test');
const assert = require('node:assert/strict');
const { formatResults } = require('../src/formatter');

test('formats customer-safe stock labels without exact quantities', () => {
  const message = formatResults([
    { clean_name: 'Low stock product', stock: 1 },
    { clean_name: 'Available product', stock: 7 },
    { clean_name: 'Many stock product', stock: 30 },
  ]);

  assert.match(message, /Stock bajo/);
  assert.match(message, /Disponible/);
  assert.match(message, /\+10 disponibles/);
  assert.doesNotMatch(message, /30 unidades/);
});
