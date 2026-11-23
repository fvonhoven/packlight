// npm test compiles src/model.ts into tests/.compiled before running these tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  newItem, newList, starterList, cloneList, countPacked,
  parseSharedList, formatListForShare, readStoredLists,
} = require('./.compiled/model.js');

test('starter checklist has sensible content', () => {
  const list = starterList();
  assert.equal(list.title, 'Weekend away');
  assert.ok(list.items.length > 5);
  assert.equal(countPacked(list), 0);
});

test('shared text round trips and preserves checkmarks', () => {
  const original = newList('Paris weekend', [newItem('Passport', true), newItem('Charger'), newItem('Socks')]);
  const copy = parseSharedList(formatListForShare(original));
  assert.ok(copy);
  assert.equal(copy.title, 'Paris weekend');
  assert.deepEqual(copy.items.map((i) => [i.text, i.packed]), [
    ['Passport', true], ['Charger', false], ['Socks', false],
  ]);
});

test('plain text list imports', () => {
  const list = parseSharedList('Shampoo\nSunglasses\nShoes');
  assert.ok(list);
  assert.equal(list.items.length, 3);
});

test('markdown checklist imports', () => {
  const list = parseSharedList('- [x] Wallet\n- [ ] Phone\n- Hat');
  assert.ok(list);
  assert.deepEqual(list.items.map((i) => i.packed), [true, false, false]);
});

test('invalid and empty shared text rejected', () => {
  assert.equal(parseSharedList('   \n  '), null);
  assert.equal(parseSharedList('PACKING LIST: Nothing\n(No items yet)\nSent from Packlight.'), null);
});

test('duplicate produces fresh unchecked items', () => {
  const original = newList('Road trip', [newItem('Keys', true)]);
  const copy = cloneList(original);
  assert.notEqual(copy.id, original.id);
  assert.equal(copy.items[0].packed, false);
  assert.notEqual(copy.items[0].id, original.items[0].id);
});

test('empty saved collection stays empty after reload', () => {
  assert.deepEqual(readStoredLists([]), []);
  assert.equal(readStoredLists({ bad: true }), null);
});
