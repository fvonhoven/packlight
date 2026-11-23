// npm test compiles src/model.ts into tests/.compiled before running these tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  newItem, newList, starterList, cloneList, countPacked,
  parseSharedList, formatListForShare, readStoredLists,
  buildImportLink, parseImportLink,
} = require('./.compiled/model.js');

test('starter checklist has sensible content', () => {
  const list = starterList();
  assert.equal(list.title, 'Weekend away');
  assert.ok(list.items.length > 5);
  assert.equal(countPacked(list), 0);
});

test('shared message round trips as a fresh, unpacked copy', () => {
  const original = newList('Paris weekend', [newItem('Passport', true), newItem('Charger'), newItem('Socks')]);
  const copy = parseSharedList(formatListForShare(original));
  assert.ok(copy);
  assert.notEqual(copy.id, original.id);
  assert.equal(copy.title, 'Paris weekend');
  assert.deepEqual(copy.items.map((i) => [i.text, i.packed]), [
    ['Passport', false], ['Charger', false], ['Socks', false],
  ]);
});

test('checkbox text without a link still preserves checkmarks', () => {
  const copy = parseSharedList('Packing list: Paris\n\n☑ Passport\n☐ Charger');
  assert.equal(copy.title, 'Paris');
  assert.deepEqual(copy.items.map((i) => [i.text, i.packed]), [['Passport', true], ['Charger', false]]);
});

test('import link survives awkward characters', () => {
  const original = newList('Rock & Roll = fun?', [newItem('Café 50% off #2'), newItem('🧦 socks + more'), newItem('a/b?c=d&e')]);
  const link = buildImportLink(original);
  assert.ok(link.startsWith('packlight://import?'));
  assert.ok(!/\s/.test(link), 'link must not contain whitespace');
  const copy = parseImportLink(link);
  assert.equal(copy.title, 'Rock & Roll = fun?');
  assert.deepEqual(copy.items.map((i) => i.text), ['Café 50% off #2', '🧦 socks + more', 'a/b?c=d&e']);
});

test('import link found inside a pasted message', () => {
  const link = buildImportLink(newList('Ski', [newItem('Gloves')]));
  const copy = parseSharedList(`hey take a look\n${link}\nthanks!`);
  assert.equal(copy.title, 'Ski');
  assert.deepEqual(copy.items.map((i) => i.text), ['Gloves']);
});

test('broken or empty import links are rejected', () => {
  assert.equal(parseImportLink('packlight://import?t=Trip&i='), null);
  assert.equal(parseImportLink('packlight://import?t=%E0%A4%A&i=%E0%A4%A'), null);
  assert.equal(parseImportLink('https://example.com'), null);
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
