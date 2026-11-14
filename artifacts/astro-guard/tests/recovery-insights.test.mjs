import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeRecoveryTrend } from '../src/data/recoveryInsights.ts';
import { healthCheckInSchema } from '../src/data/healthCheckIn.ts';

function entry(day, values = {}) {
  return {
    recordedAt: `2026-11-${String(day).padStart(2, '0')}T12:00:00.000Z`,
    heartRate: 60,
    measurementContext: 'quiet-rest',
    measurementQuality: 'confident',
    ...values,
  };
}

test('requires three earlier, reliable quiet-rest entries before comparing', () => {
  const result = analyzeRecoveryTrend([
    entry(1), entry(2), entry(3), entry(4, { heartRate: 68, sleepHours: 5, fatigue: 8 }),
  ]);
  assert.equal(result.kind, 'compared');
  assert.equal(result.comparisonCount, 3);
  assert.equal(result.baselineBpm, 60);
  assert.equal(result.deltaBpm, 8);
  assert.equal(result.sleepHours, 5);
  assert.equal(result.fatigue, 8);
  assert.equal(result.direction, 'first');
});

test('describes a later reading as closer to the small session reference', () => {
  const result = analyzeRecoveryTrend([
    entry(1, { heartRate: 60 }),
    entry(2, { heartRate: 61 }),
    entry(3, { heartRate: 62 }),
    entry(4, { heartRate: 63 }),
    entry(5, { heartRate: 63 }),
  ]);
  assert.equal(result.kind, 'compared');
  assert.equal(result.direction, 'closer');
});

test('does not compare readings after activity or marked uncertain', () => {
  const afterActivity = analyzeRecoveryTrend([
    entry(1), entry(2), entry(3), entry(4, { measurementContext: 'after-activity' }),
  ]);
  const uncertain = analyzeRecoveryTrend([
    entry(1), entry(2), entry(3), entry(4, { measurementQuality: 'uncertain' }),
  ]);
  assert.equal(afterActivity.kind, 'not-comparable');
  assert.equal(uncertain.kind, 'not-comparable');
});

test('does not use stale or future-dated records as a reference', () => {
  const stale = analyzeRecoveryTrend([
    { ...entry(1), recordedAt: '2026-10-01T12:00:00.000Z' },
    { ...entry(2), recordedAt: '2026-10-02T12:00:00.000Z' },
    { ...entry(3), recordedAt: '2026-10-03T12:00:00.000Z' },
    { ...entry(4, { heartRate: 70 }), recordedAt: '2026-11-04T12:00:00.000Z' },
  ]);
  const future = analyzeRecoveryTrend([
    entry(4), entry(5), entry(6), entry(3, { heartRate: 70 }),
  ]);
  assert.equal(stale.kind, 'not-comparable');
  assert.equal(future.kind, 'not-comparable');
});

test('returns an explicit missing-reading state', () => {
  assert.equal(analyzeRecoveryTrend([entry(1, { heartRate: undefined })]).kind, 'missing-current');
});

test('rejects invalid sleep, fatigue, and heart-rate values', () => {
  const base = { heartRate: 65, sleepHours: 7, fatigue: 4 };
  assert.equal(healthCheckInSchema.safeParse(base).success, true);
  assert.equal(healthCheckInSchema.safeParse({ ...base, sleepHours: 25 }).success, false);
  assert.equal(healthCheckInSchema.safeParse({ ...base, fatigue: 11 }).success, false);
  assert.equal(healthCheckInSchema.safeParse({ ...base, heartRate: 0 }).success, false);
});
