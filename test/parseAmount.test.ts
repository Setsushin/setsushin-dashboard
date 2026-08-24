// Unit tests for the Portfolio amount parser ($/¥ syntax + unit select).
// Run with: npm test

import { test } from 'vitest';
import assert from 'node:assert/strict';
import { fromMan, liveMan, parseAmount, parseAsset, withLiveJpy } from '../src/widgets/assets-utils';

const RATE = 0.0064; // 1 JPY = 0.0064 USD → 1 USD = 156.25 JPY

test('plain number = 万円', () => {
  assert.equal(parseAmount('123.5', RATE), 123.5);
});

test('commas and spaces stripped', () => {
  assert.equal(parseAmount('1,234', RATE), 1234);
  assert.equal(parseAmount(' 12 ', RATE), 12);
});

test('$ prefix/suffix converts USD → 万円 (1 decimal)', () => {
  assert.equal(parseAmount('$10000', RATE), 156.3); // 10000/0.0064 = 1,562,500円
  assert.equal(parseAmount('10000$', RATE), 156.3);
});

test('¥ / ￥ = raw yen → 万円', () => {
  assert.equal(parseAmount('¥5432100', RATE), 543.2);
  assert.equal(parseAmount('￥10000', RATE), 1);
});

test('defaultUnit applies to plain input (form unit select)', () => {
  assert.equal(parseAmount('10000', RATE, 'usd'), 156.3);
  assert.equal(parseAmount('10000', RATE, 'yen'), 1);
});

test('explicit symbol beats defaultUnit', () => {
  assert.equal(parseAmount('¥10000', RATE, 'usd'), 1);
});

test('USD without a rate → null', () => {
  assert.equal(parseAmount('$100', undefined), null);
  assert.equal(parseAmount('100', undefined, 'usd'), null);
});

test('k/m shorthand: k=千, m=万 (owner-confirmed, m is NOT million)', () => {
  assert.equal(parseAmount('100m', RATE), 100); // the user's spec example: 100m = ¥1,000,000 = 100万
  assert.equal(parseAmount('20k', RATE), 2); // bare + multiplier reads as 円: ¥20,000
  assert.equal(parseAmount('$20k', RATE), 312.5); // $20,000 = ¥3,125,000
  assert.equal(parseAmount('$1m', RATE), 156.3); // 1万 USD = $10,000
  assert.equal(parseAmount('1234m', RATE, 'yen'), 1234); // form ¥ mode pre-fill shape
  assert.equal(parseAmount('5.4M', RATE, 'yen'), 5.4); // case-insensitive
  assert.equal(parseAmount('¥1,234m', RATE), 1234);
});

test('fromMan displays 万円 in target unit (unit-select switch)', () => {
  assert.equal(fromMan(10.2, 'usd', RATE), 652.8); // 102,000円 × 0.0064
  assert.equal(fromMan(10.2, 'yen', RATE), 102000);
  assert.equal(fromMan(10.2, 'man', RATE), 10.2);
  assert.equal(fromMan(10, 'usd', undefined), null);
});

test('unit switch round-trips through parseAmount', () => {
  const usd = fromMan(10.2, 'usd', RATE);
  assert.equal(parseAmount(String(usd), RATE, 'usd'), 10.2);
});

test('garbage → null', () => {
  assert.equal(parseAmount('abc', RATE), null);
  assert.equal(parseAmount('', RATE), null);
  assert.equal(parseAmount('$1¥', RATE), null);
  assert.equal(parseAmount('1.2.3', RATE), null);
});

test('parseAsset splits the entry by exposure', () => {
  // jpy exposure: everything in jpy_man, $ entries converted
  assert.deepEqual(parseAsset('12', RATE, 'jpy'), { jpy_man: 12, usd: null });
  assert.deepEqual(parseAsset('$10000', RATE, 'jpy'), { jpy_man: 156.3, usd: null });
  assert.deepEqual(parseAsset('12', undefined, 'jpy'), { jpy_man: 12, usd: null });
  // usd exposure: everything in usd, ¥ entries converted at today's rate
  assert.deepEqual(parseAsset('$10000', RATE, 'usd'), { jpy_man: 0, usd: 10000 });
  assert.deepEqual(parseAsset('10000', RATE, 'usd', 'usd'), { jpy_man: 0, usd: 10000 });
  assert.deepEqual(parseAsset('¥1,562,500', RATE, 'usd'), { jpy_man: 0, usd: 10000 });
  assert.deepEqual(parseAsset('156.25', RATE, 'usd'), { jpy_man: 0, usd: 10000 });
  // mixed: half and half
  assert.deepEqual(parseAsset('$10000', RATE, 'mixed-50-50'), { jpy_man: 78.1, usd: 5000 });
  assert.deepEqual(parseAsset('100', RATE, 'mixed-50-50'), { jpy_man: 50, usd: 3200 });
  // rate needed but missing
  assert.equal(parseAsset('$1', undefined, 'jpy'), null);
  assert.equal(parseAsset('100', undefined, 'usd'), null);
  assert.equal(parseAsset('100', undefined, 'mixed-50-50'), null);
});

test('liveMan / withLiveJpy fold the usd part in at the given rate', () => {
  assert.equal(liveMan({ jpy_man: 0, usd: 10000 }, 0.008), 125);
  assert.equal(liveMan({ jpy_man: 50, usd: 3200 }, 0.0064), 100);
  assert.equal(liveMan({ jpy_man: 12, usd: null }, 0.008), 12);
  assert.deepEqual(withLiveJpy([{ jpy_man: 0, usd: 10000 }], 0.008), [{ jpy_man: 125, usd: 10000 }]);
});
