import assert from 'node:assert/strict';
import test from 'node:test';
import { SCENARIOS } from '../src/data/demoHealth.ts';
import {
  CREW_PROFILE_STORAGE_KEY,
  CREW_PROFILES,
  createEmptyCrewProfileState,
  getDemoReadingsForCrew,
  loadCrewProfileState,
  saveCrewProfileState,
} from '../src/data/crewProfiles.ts';

class MemoryStorage {
  values = new Map();

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, value);
  }
}

function checkIn(heartRate, day) {
  return {
    heartRate,
    measurementContext: 'quiet-rest',
    measurementQuality: 'confident',
    recordedAt: `2026-11-${String(day).padStart(2, '0')}T12:00:00.000Z`,
  };
}

test('starts with three distinct mock profiles and separate empty histories', () => {
  const loaded = loadCrewProfileState(new MemoryStorage());

  assert.equal(CREW_PROFILES.length, 3);
  assert.deepEqual(
    Object.values(loaded.checkInsByProfile).map((records) => records.length),
    [0, 0, 0],
  );
  assert.equal(loaded.selectedProfileId, CREW_PROFILES[0].id);
  assert.equal(loaded.canPersist, true);
});

test('saves and restores selected profile with check-ins kept separately', () => {
  const storage = new MemoryStorage();
  const state = createEmptyCrewProfileState();
  state.selectedProfileId = 'leo-park';
  state.checkInsByProfile['sana-idris'] = [checkIn(62, 10)];
  state.checkInsByProfile['leo-park'] = [checkIn(71, 11), checkIn(68, 12)];

  saveCrewProfileState(storage, state);
  const loaded = loadCrewProfileState(storage);

  assert.equal(loaded.selectedProfileId, 'leo-park');
  assert.deepEqual(loaded.checkInsByProfile['sana-idris'], [checkIn(62, 10)]);
  assert.deepEqual(loaded.checkInsByProfile['leo-park'], [
    checkIn(71, 11),
    checkIn(68, 12),
  ]);
  assert.deepEqual(loaded.checkInsByProfile['amira-hassan'], []);
});

test('does not allow malformed browser data to be overwritten automatically', () => {
  const storage = new MemoryStorage();
  storage.setItem(CREW_PROFILE_STORAGE_KEY, '{not valid json');

  const loaded = loadCrewProfileState(storage);

  assert.equal(loaded.canPersist, false);
  assert.match(loaded.warning, /left untouched/);
  assert.equal(storage.getItem(CREW_PROFILE_STORAGE_KEY), '{not valid json');
});

test('ignores invalid records and marks the saved file as protected', () => {
  const storage = new MemoryStorage();
  storage.setItem(
    CREW_PROFILE_STORAGE_KEY,
    JSON.stringify({
      selectedProfileId: 'sana-idris',
      checkInsByProfile: {
        'sana-idris': [checkIn(62, 10), { heartRate: 0, recordedAt: 'invalid' }],
      },
    }),
  );

  const loaded = loadCrewProfileState(storage);

  assert.equal(loaded.checkInsByProfile['sana-idris'].length, 1);
  assert.equal(loaded.canPersist, false);
  assert.match(loaded.warning, /Some saved entries/);
});

test('each crew profile gets a distinguishable synthetic demo reading', () => {
  const results = CREW_PROFILES.map((profile) =>
    getDemoReadingsForCrew(SCENARIOS.nominal, 0, profile),
  );

  assert.deepEqual(results.map((reading) => reading.bpm), [64, 68, 61]);
  assert.deepEqual(results.map((reading) => reading.sleepHours), [7.2, 6.5, 7.8]);
  assert.notEqual(results[0].exerciseMin, results[1].exerciseMin);
});
