const test = require('node:test');
const assert = require('node:assert/strict');
const { parseQuery } = require('../src/parser');

test('parses casual RAM and storage phrases', () => {
  assert.deepEqual(parseQuery('notebook i5 16 ram 512 ssd'), {
    brand: null,
    cpu: 'i5',
    tier: 5,
    ramGb: 16,
    storageGb: 512,
  });

  assert.equal(parseQuery('8 ram').ramGb, 8);
  assert.equal(parseQuery('8gb ram').ramGb, 8);
  assert.equal(parseQuery('16 de ram').ramGb, 16);
  assert.equal(parseQuery('256 ssd').storageGb, 256);
  assert.equal(parseQuery('512 ssd').storageGb, 512);
  assert.equal(parseQuery('1 tera').storageGb, 1000);
  assert.equal(parseQuery('1tb').storageGb, 1000);
  assert.equal(parseQuery('1000gb').storageGb, 1000);
});

test('parses Ryzen query without treating tier as RAM', () => {
  const query = parseQuery('laptop ryzen 5 16gb');
  assert.equal(query.cpu, 'ryzen5');
  assert.equal(query.tier, 5);
  assert.equal(query.ramGb, 16);
  assert.equal(query.storageGb, null);
});
