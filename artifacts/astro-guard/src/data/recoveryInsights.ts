import type { HealthCheckInRecord } from './healthCheckIn';

// A product heuristic for this prototype, not a medical or NASA threshold.
export const MIN_PRIOR_COMPARISONS = 3;
const MAX_COMPARISON_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type RecoveryComparison =
  | { kind: 'missing-current'; message: string }
  | { kind: 'not-comparable'; message: string }
  | {
      kind: 'compared';
      baselineBpm: number;
      deltaBpm: number;
      comparisonCount: number;
      direction: 'closer' | 'farther' | 'similar' | 'first';
      sleepHours?: number;
      fatigue?: number;
      contextLabel: string;
    };
type TrendDirection = 'closer' | 'farther' | 'similar' | 'first';

function isEligible(record: HealthCheckInRecord): boolean {
  return (
    record.heartRate !== undefined &&
    record.measurementContext === 'quiet-rest' &&
    record.measurementQuality === 'confident'
  );
}

function isRecentAndEarlier(
  candidate: HealthCheckInRecord,
  current: HealthCheckInRecord,
): boolean {
  const currentTime = Date.parse(current.recordedAt);
  const candidateTime = Date.parse(candidate.recordedAt);
  const age = currentTime - candidateTime;
  return Number.isFinite(currentTime) && Number.isFinite(candidateTime) &&
    age > 0 && age <= MAX_COMPARISON_AGE_MS;
}

function eligibleEarlier(
  records: HealthCheckInRecord[],
  current: HealthCheckInRecord,
): HealthCheckInRecord[] {
  return records.filter(record => isEligible(record) && isRecentAndEarlier(record, current));
}

function averageHeartRate(records: HealthCheckInRecord[]): number {
  return records.reduce((total, record) => total + (record.heartRate ?? 0), 0) / records.length;
}

export function analyzeRecoveryTrend(
  history: HealthCheckInRecord[],
): RecoveryComparison {
  const current = history.at(-1);
  if (!current || current.heartRate === undefined) {
    return { kind: 'missing-current', message: 'Enter a resting heart-rate reading to compare.' };
  }
  if (
    current.measurementContext !== 'quiet-rest' ||
    current.measurementQuality !== 'confident'
  ) {
    return {
      kind: 'not-comparable',
      message: 'For a personal comparison, record a confident reading during quiet rest. This entry is still available as a raw value.',
    };
  }

  const earlier = eligibleEarlier(history.slice(0, -1), current);
  if (earlier.length < MIN_PRIOR_COMPARISONS) {
    return {
      kind: 'not-comparable',
      message: `Not enough comparable entries yet. This prototype needs ${MIN_PRIOR_COMPARISONS} earlier, confident quiet-rest readings from the last 30 days before showing a personal reference.`,
    };
  }

  const comparisonRecords = earlier.slice(-MIN_PRIOR_COMPARISONS);
  const baseline = averageHeartRate(comparisonRecords);
  const delta = current.heartRate - baseline;

  // Direction is descriptive only: compare the distance from the rolling
  // reference, never a health status. It becomes available after another sample.
  const previous = comparisonRecords.at(-1);
  const previousPredecessors = previous
    ? eligibleEarlier(earlier.slice(0, -1), previous).slice(-MIN_PRIOR_COMPARISONS)
    : [];
  let direction: TrendDirection = 'first';
  if (previous && previousPredecessors.length === MIN_PRIOR_COMPARISONS) {
    const previousDelta =
      (previous.heartRate ?? 0) - averageHeartRate(previousPredecessors);
    const currentDistance = Math.abs(delta);
    const previousDistance = Math.abs(previousDelta);
    direction = currentDistance < previousDistance
      ? 'closer'
      : currentDistance > previousDistance
        ? 'farther'
        : 'similar';
  }

  return {
    kind: 'compared',
    baselineBpm: baseline,
    deltaBpm: delta,
    comparisonCount: comparisonRecords.length,
    direction,
    sleepHours: current.sleepHours,
    fatigue: current.fatigue,
    contextLabel: 'Confident reading during quiet rest',
  };
}
