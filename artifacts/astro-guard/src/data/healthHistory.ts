import type { CrewProfileId } from "./crewProfiles";
import type { HealthCheckInRecord } from "./healthCheckIn";
import type { SystemId } from "./demoHealth";

export const HEALTH_HISTORY_DAYS = 14;

export type HistoryMetricSystem = Exclude<SystemId, "immune">;
export type HistorySource = "mock" | "check-ins";

export type HistoryPoint = {
  timestamp: number;
  value: number | null;
  context?: string;
};

export type ImmuneSamplePoint = {
  timestamp: number;
  status: "no-sample" | "sample-logged" | "result-pending";
};

export const HISTORY_METRICS: Record<
  HistoryMetricSystem,
  { label: string; unit: string; description: string }
> = {
  heart: {
    label: "Heart rate",
    unit: "bpm",
    description: "Entered heart-rate values; measurement context is shown where available.",
  },
  lungs: {
    label: "Breathing rate",
    unit: "breaths/min",
    description: "Self-entered breathing rate only; this is not an oxygen measurement.",
  },
  brain: {
    label: "Sleep duration",
    unit: "hours",
    description: "Self-reported sleep duration; this does not measure brain activity or sleep quality.",
  },
  skeletal: {
    label: "Exercise duration",
    unit: "minutes",
    description: "Self-entered exercise duration; this does not measure bone density.",
  },
};

const MOCK_BASELINES: Record<
  CrewProfileId,
  Record<HistoryMetricSystem, number>
> = {
  "sana-idris": { heart: 64, lungs: 13, brain: 7.2, skeletal: 112 },
  "leo-park": { heart: 71, lungs: 15, brain: 6.5, skeletal: 126 },
  "amira-hassan": { heart: 61, lungs: 12, brain: 7.8, skeletal: 74 },
};

const CHECK_IN_FIELDS: Record<
  HistoryMetricSystem,
  keyof HealthCheckInRecord
> = {
  heart: "heartRate",
  lungs: "breathingRate",
  brain: "sleepHours",
  skeletal: "exerciseMinutes",
};

function localDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function buildHistoryWindow(now = new Date()): number[] {
  const today = localDay(now);
  return Array.from({ length: HEALTH_HISTORY_DAYS }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (HEALTH_HISTORY_DAYS - 1 - index));
    return day.getTime();
  });
}

function formatMeasurementContext(record: HealthCheckInRecord): string | undefined {
  if (record.measurementContext === "quiet-rest") return "Quiet rest";
  if (record.measurementContext === "after-activity") return "After activity";
  if (record.measurementContext === "unknown") return "Context not specified";
  return undefined;
}

export function buildCheckInHistory(
  records: HealthCheckInRecord[],
  system: HistoryMetricSystem,
  now = new Date(),
): HistoryPoint[] {
  const days = buildHistoryWindow(now);
  const start = days[0];
  const end = days[days.length - 1] + 24 * 60 * 60 * 1000;
  const field = CHECK_IN_FIELDS[system];
  const newestMeasurementByDay = new Map<number, HealthCheckInRecord>();

  [...records]
    .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))
    .forEach((record) => {
      const recordedAt = new Date(record.recordedAt);
      const day = localDay(recordedAt).getTime();
      if (day < start || day >= end || typeof record[field] !== "number") return;
      if (!newestMeasurementByDay.has(day)) newestMeasurementByDay.set(day, record);
    });

  return days.map((timestamp) => {
    const record = newestMeasurementByDay.get(timestamp);
    const value = record?.[field];
    return {
      timestamp,
      value: typeof value === "number" ? value : null,
      ...(record && system === "heart"
        ? { context: formatMeasurementContext(record) }
        : {}),
    };
  });
}

export function buildMockHistory(
  profileId: CrewProfileId,
  system: HistoryMetricSystem,
  now = new Date(),
): HistoryPoint[] {
  const baseline = MOCK_BASELINES[profileId][system];
  const profileIndex = Object.keys(MOCK_BASELINES).indexOf(profileId);
  const metricIndex = Object.keys(HISTORY_METRICS).indexOf(system);
  const amplitude =
    system === "brain" ? 0.65 : system === "skeletal" ? 22 : system === "heart" ? 4 : 1.5;

  return buildHistoryWindow(now).map((timestamp, index) => {
    // Leave two dates blank so the example shows missing observations honestly.
    if (index === 4 || index === 9) return { timestamp, value: null };

    const wave = Math.sin((index + 1) * 0.74 + profileIndex * 0.9 + metricIndex) * amplitude;
    const rawValue = baseline + wave;
    const value = system === "brain"
      ? Number(rawValue.toFixed(1))
      : Math.round(rawValue);

    return {
      timestamp,
      value,
      ...(system === "heart"
        ? { context: index % 4 === 0 ? "After activity · mock" : "Quiet rest · mock" }
        : {}),
    };
  });
}

export function buildMockImmuneHistory(
  profileId: CrewProfileId,
  now = new Date(),
): ImmuneSamplePoint[] {
  const profileIndex = Object.keys(MOCK_BASELINES).indexOf(profileId);
  return buildHistoryWindow(now).map((timestamp, index) => {
    if ((index + profileIndex) % 5 === 1) {
      return { timestamp, status: "result-pending" };
    }
    if ((index + profileIndex) % 5 === 0) {
      return { timestamp, status: "sample-logged" };
    }
    return { timestamp, status: "no-sample" };
  });
}
