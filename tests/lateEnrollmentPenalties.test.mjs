import assert from 'node:assert/strict';
import test from 'node:test';
import {
  estimatePartBPenalty,
  estimatePartDPenalty,
  PART_B_STANDARD_PREMIUMS,
  PART_D_BASE_PREMIUMS,
} from '../src/lib/lateEnrollmentPenalties.mjs';

test('penalty inputs use the published 2026 and 2027 standard amounts', () => {
  assert.deepEqual(PART_B_STANDARD_PREMIUMS, { 2026: 202.90, 2027: 209.40 });
  assert.deepEqual(PART_D_BASE_PREMIUMS, { 2026: 38.99, 2027: 41.33 });
});

test('Part B penalty applies only to complete 12-month periods', () => {
  assert.equal(estimatePartBPenalty(0, 2027).penalty, 0);
  assert.equal(estimatePartBPenalty(11, 2027).penalty, 0);
  assert.equal(estimatePartBPenalty(12, 2027).penalty, 20.94);
  assert.equal(estimatePartBPenalty(23, 2027).fullPeriods, 1);
  assert.equal(estimatePartBPenalty(24, 2027).fullPeriods, 2);
});

test('Part B resulting premium rounds to the nearest dime', () => {
  assert.equal(estimatePartBPenalty(12, 2026).total, 223.2);
  assert.equal(estimatePartBPenalty(24, 2027).total, 251.3);
});

test('Part D uses full uncovered months and rounds the monthly penalty to the nearest dime', () => {
  assert.equal(estimatePartDPenalty(14, 2026), 5.5);
  assert.equal(estimatePartDPenalty(14, 2027), 5.8);
  assert.equal(estimatePartDPenalty(0, 2027), 0);
  assert.equal(estimatePartDPenalty(1.5, 2027), null);
});

test('unknown premium years and invalid month counts do not produce estimates', () => {
  for (const months of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 'x']) {
    assert.equal(estimatePartBPenalty(months, 2027).total, null);
    assert.equal(estimatePartDPenalty(months, 2027), null);
  }
  assert.equal(estimatePartBPenalty(12, 2028).total, null);
  assert.equal(estimatePartDPenalty(12, 2028), null);
});
