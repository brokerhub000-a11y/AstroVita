import { z } from 'zod';

const optionalCount = z.number().finite().nonnegative().int().optional();
const optionalMeasurement = z.number().finite().nonnegative().optional();

export const healthCheckInSchema = z.object({
  heartRate: z.number().finite().min(1).max(300).optional(),
  bloodPressureSystolic: optionalCount,
  bloodPressureDiastolic: optionalCount,
  breathingRate: optionalCount,
  bloodGlucose: optionalMeasurement,
  bodyTemperatureC: optionalMeasurement,
  sleepHours: z.number().finite().min(0).max(24).optional(),
  exerciseMinutes: optionalCount,
  fatigue: z.number().finite().int().min(1).max(10).optional(),
  measurementContext: z.enum(['quiet-rest', 'after-activity', 'unknown']).optional(),
  measurementQuality: z.enum(['confident', 'uncertain']).optional(),
  mood: z.enum(['good', 'okay', 'low']).optional(),
}).superRefine((values, context) => {
  const hasSystolic = values.bloodPressureSystolic !== undefined;
  const hasDiastolic = values.bloodPressureDiastolic !== undefined;

  if (hasSystolic !== hasDiastolic) {
    context.addIssue({
      code: 'custom',
      path: [hasSystolic ? 'bloodPressureDiastolic' : 'bloodPressureSystolic'],
      message: 'Enter both blood-pressure values, or leave both blank.',
    });
  }

  if (Object.values(values).every((value) => value === undefined)) {
    context.addIssue({
      code: 'custom',
      path: ['heartRate'],
      message: 'Enter at least one measurement or a mood check-in.',
    });
  }
});

export type HealthCheckInValues = z.infer<typeof healthCheckInSchema>;
export type HealthCheckInRecord = HealthCheckInValues & { recordedAt: string };

export const EMPTY_HEALTH_CHECK_IN: HealthCheckInValues = {};

export const MEASUREMENT_CONTEXT_LABELS = {
  'quiet-rest': 'Quiet rest',
  'after-activity': 'After activity',
  unknown: 'Not sure',
} as const;

export const MEASUREMENT_QUALITY_LABELS = {
  confident: 'Confident in measurement',
  uncertain: 'Uncertain measurement',
} as const;

export function formatCheckInValue(value: number | undefined, decimals = 0): string {
  return value === undefined ? 'Not entered' : decimals ? value.toFixed(decimals) : String(value);
}

const CHECK_IN_CSV_COLUMNS: Array<{
  header: string;
  value: (record: HealthCheckInRecord) => string | number | undefined;
}> = [
  { header: 'Recorded at (ISO 8601)', value: (record) => record.recordedAt },
  { header: 'Heart rate (bpm)', value: (record) => record.heartRate },
  { header: 'Blood pressure systolic (mmHg)', value: (record) => record.bloodPressureSystolic },
  { header: 'Blood pressure diastolic (mmHg)', value: (record) => record.bloodPressureDiastolic },
  { header: 'Breathing rate (breaths/min)', value: (record) => record.breathingRate },
  { header: 'Blood glucose (mg/dL)', value: (record) => record.bloodGlucose },
  { header: 'Body temperature (°C)', value: (record) => record.bodyTemperatureC },
  { header: 'Sleep duration (hours)', value: (record) => record.sleepHours },
  { header: 'Exercise duration (minutes)', value: (record) => record.exerciseMinutes },
  { header: 'Fatigue (self-reported, 1–10)', value: (record) => record.fatigue },
  {
    header: 'Measurement context',
    value: (record) => record.measurementContext
      ? MEASUREMENT_CONTEXT_LABELS[record.measurementContext]
      : undefined,
  },
  {
    header: 'Measurement quality',
    value: (record) => record.measurementQuality
      ? MEASUREMENT_QUALITY_LABELS[record.measurementQuality]
      : undefined,
  },
  {
    header: 'Mood (self-reported)',
    value: (record) => record.mood
      ? record.mood[0].toUpperCase() + record.mood.slice(1)
      : undefined,
  },
];

function escapeCsvCell(value: string | number | undefined): string {
  const text = value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function createHealthCheckInCsv(records: HealthCheckInRecord[]): string {
  const header = CHECK_IN_CSV_COLUMNS.map(({ header: column }) => escapeCsvCell(column)).join(',');
  const rows = records.map((record) =>
    CHECK_IN_CSV_COLUMNS
      .map(({ value }) => escapeCsvCell(value(record)))
      .join(','),
  );

  return `\uFEFF${[header, ...rows].join('\r\n')}\r\n`;
}
