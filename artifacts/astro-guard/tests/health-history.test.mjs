import assert from 'node:assert/strict';
import test from 'node:test';
import { CREW_PROFILES } from '../src/data/crewProfiles.ts';
import {
  buildCheckInHistory,
  buildHistoryWindow,
  buildMockHistory,
  buildMockImmuneHistory,
  HEALTH_HISTORY_DAYS,
} from '../src/data/healthHistory.ts';

const NOW = new Date(2026, 10, 14, 12);

function record(date, values, hour = 12) {
  return {
    ...values,
    recordedAt: new Date(2026, 10, date, hour).toISOString(),
  };
}

test('builds a 14-day local calendar window including today', () => {
  const window = buildHistoryWindow(NOW);

  assert.equal(window.length, HEALTH_HISTORY_DAYS);
  assert.equal(new Date(window[0]).getDate(), 1);
  assert.equal(new Date(window.at(-1)).getDate(), 14);
});

test('maps each system only to its relevant self-entered measurement', () => {
  const records = [
    record(12, { heartRate: 66, breathingRate: 14, sleepHours: 7.5, exerciseMinutes: 30 }),
  ];

  for (const [system, expected] of [
    ['heart', 66],
    ['lungs', 14],
    ['brain', 7.5],
    ['skeletal', 30],
  ]) {
    const points = buildCheckInHistory(records, system, NOW);
    assert.equal(points.length, HEALTH_HISTORY_DAYS);
    assert.equal(points.find((point) => point.timestamp === new Date(2026, 10, 12).getTime()).value, expected);
  }
});

test('keeps missing check-in days blank and uses the latest daily metric entry', () => {
  const records = [
    record(12, { heartRate: 64, measurementContext: 'quiet-rest' }, 8),
    record(12, { heartRate: 70, measurementContext: 'after-activity' }, 16),
    record(13, { sleepHours: 6.5 }),
    record(30, { heartRate: 80 }),
  ];

  const heart = buildCheckInHistory(records, 'heart', NOW);
  const sleep = buildCheckInHistory(records, 'brain', NOW);
  const day12 = new Date(2026, 10, 12).getTime();

  assert.equal(heart.length, HEALTH_HISTORY_DAYS);
  assert.equal(heart.find((point) => point.timestamp === day12).value, 70);
  assert.equal(heart.find((point) => point.timestamp === day12).context, 'After activity');
  assert.equal(heart.filter((point) => point.value !== null).length, 1);
  assert.equal(sleep.filter((point) => point.value !== null).length, 1);
});

test('mock histories are profile-specific and preserve simulated missing days', () => {
  const histories = CREW_PROFILES.map((profile) =>
    buildMockHistory(profile.id, 'heart', NOW),
  );

  assert.equal(histories[0].length, HEALTH_HISTORY_DAYS);
  assert.deepEqual(histories[0].map((point) => point.value === null), histories[1].map((point) => point.value === null));
  assert.notDeepEqual(histories[0], histories[1]);
  assert.equal(histories[0][4].value, null);
  assert.equal(histories[0][9].value, null);
});

test('immune history is a sample timeline, not a numerical health score', () => {
  const points = buildMockImmuneHistory('sana-idris', NOW);

  assert.equal(points.length, HEALTH_HISTORY_DAYS);
  assert.ok(points.some((point) => point.status === 'sample-logged'));
  assert.ok(points.some((point) => point.status === 'result-pending'));
  assert.ok(points.every((point) => !('value' in point)));
});
