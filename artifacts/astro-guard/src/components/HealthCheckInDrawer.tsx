import { useEffect, type RefObject } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFormContext } from 'react-hook-form';
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  EMPTY_HEALTH_CHECK_IN,
  healthCheckInSchema,
  type HealthCheckInRecord,
  type HealthCheckInValues,
} from '@/data/healthCheckIn';

type NumericFieldName = Exclude<keyof HealthCheckInValues, 'mood'>;

function MeasurementField({
  name, label, unit, step = '1', min = '0', max, description = 'Optional. Leave blank if not measured.',
}: {
  name: NumericFieldName;
  label: string;
  unit: string;
  step?: string;
  min?: string;
  max?: string;
  description?: string;
}) {
  const form = useFormContext<HealthCheckInValues>();
  return (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem className="checkin-field">
        <FormLabel>{label}</FormLabel>
        <div className="checkin-input-row">
          <FormControl>
            <Input
              {...field}
              type="number"
              min={min}
              max={max}
              step={step}
              inputMode="decimal"
              placeholder="Not measured"
              value={field.value ?? ''}
              data-testid={`input-checkin-${name}`}
              onChange={(event) => field.onChange(
                event.target.value === '' ? undefined : Number(event.target.value),
              )}
            />
          </FormControl>
          <span className="checkin-unit">{unit}</span>
        </div>
        <FormDescription>{description}</FormDescription>
        <FormMessage />
      </FormItem>
    )} />
  );
}

function toFormValues(record: HealthCheckInRecord | null): HealthCheckInValues {
  if (!record) return EMPTY_HEALTH_CHECK_IN;
  const { recordedAt: _recordedAt, ...values } = record;
  return { ...values, measurementContext: values.measurementContext ?? 'unknown' };
}

export function HealthCheckInDrawer({
  open, current, isNewEntry, crewName, persistenceAvailable, dialogRef, onClose, onSave,
}: {
  open: boolean;
  current: HealthCheckInRecord | null;
  isNewEntry: boolean;
  crewName: string;
  persistenceAvailable: boolean;
  dialogRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onSave: (record: HealthCheckInRecord) => void;
}) {
  const form = useForm<HealthCheckInValues>({
    resolver: zodResolver(healthCheckInSchema),
    defaultValues: { ...EMPTY_HEALTH_CHECK_IN, measurementContext: 'unknown' },
    mode: 'onSubmit',
  });
  const { reset } = form;

  useEffect(() => {
    reset(isNewEntry
      ? { ...EMPTY_HEALTH_CHECK_IN, measurementContext: 'unknown' }
      : toFormValues(current));
  }, [current, isNewEntry, reset]);

  const submit = form.handleSubmit((values) => {
    onSave({
      ...values,
      recordedAt: !isNewEntry && current ? current.recordedAt : new Date().toISOString(),
    });
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="drawer-scrim checkin-scrim"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          data-testid="drawer-health-checkin"
        >
          <motion.aside
            className="drawer checkin-drawer"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkin-title"
            initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-head">
              <div>
                <div className="kicker">Manual · {crewName}</div>
                <h2 id="checkin-title">{isNewEntry ? 'New crew check-in' : 'Crew health check-in'}</h2>
              </div>
              <button className="icon-btn sq" type="button" onClick={onClose} autoFocus
                aria-label="Close check-in" data-testid="button-close-checkin">×</button>
            </div>

            <p className="checkin-intro">
              Enter any values already measured with a mission-approved method. You can leave any field blank.
            </p>
            <div className="checkin-privacy" role="note" data-testid="text-checkin-privacy">
              {persistenceAvailable
                ? "This entry is saved in this browser under the selected mock profile. It is not sent to a server. Browser storage is not appropriate for real medical records."
                : "Browser storage is unavailable or could not be read, so this entry may be temporary and could disappear after a refresh. It is not sent to a server."}{" "}
              AstroVita does not classify readings, diagnose conditions, or set medical limits.
            </div>

            <Form {...form}>
              <form onSubmit={submit} noValidate data-testid="form-health-checkin">
                <section className="checkin-section" aria-labelledby="checkin-circulation">
                  <h3 id="checkin-circulation">Circulation</h3>
                  <div className="checkin-grid">
                    <MeasurementField name="heartRate" label="Heart rate" unit="bpm" min="1" max="300" />
                    <MeasurementField name="bloodPressureSystolic" label="Systolic pressure" unit="mmHg" />
                    <MeasurementField name="bloodPressureDiastolic" label="Diastolic pressure" unit="mmHg" />
                  </div>
                </section>

                <section className="checkin-section" aria-labelledby="checkin-breathing">
                  <h3 id="checkin-breathing">Breathing and other measurements</h3>
                  <div className="checkin-grid">
                    <MeasurementField name="breathingRate" label="Breathing rate" unit="breaths/min" />
                    <MeasurementField name="bodyTemperatureC" label="Body temperature" unit="°C" step="0.1" />
                    <MeasurementField name="bloodGlucose" label="Blood glucose" unit="mg/dL" step="0.1" />
                  </div>
                </section>

                <section className="checkin-section" aria-labelledby="checkin-recovery">
                  <h3 id="checkin-recovery">Sleep, fatigue, and activity</h3>
                  <div className="checkin-grid">
                    <MeasurementField name="sleepHours" label="Sleep last cycle" unit="hours" step="0.1" max="24" />
                    <MeasurementField name="fatigue" label="Fatigue · self-reported" unit="/ 10" min="1" max="10" description="1 = lower fatigue; 10 = higher. This is not a medical score." />
                    <MeasurementField name="exerciseMinutes" label="Exercise today" unit="minutes" />
                    <FormField control={form.control} name="mood" render={({ field }) => (
                      <FormItem className="checkin-field">
                        <FormLabel>Mood · self-reported</FormLabel>
                        <FormControl>
                          <select {...field} value={field.value ?? ''} onChange={(event) => field.onChange(event.target.value || undefined)} data-testid="input-checkin-mood">
                            <option value="">Not entered</option>
                            <option value="good">Good</option>
                            <option value="okay">Okay</option>
                            <option value="low">Low</option>
                          </select>
                        </FormControl>
                        <FormDescription>Optional. This is your own description, not a score.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </section>

                <section className="checkin-section" aria-labelledby="checkin-context">
                  <h3 id="checkin-context">Heart-rate measurement context</h3>
                  <div className="checkin-grid">
                    <FormField control={form.control} name="measurementContext" render={({ field }) => (
                      <FormItem className="checkin-field">
                        <FormLabel>When was the heart rate measured?</FormLabel>
                        <FormControl>
                          <select {...field} value={field.value ?? 'unknown'} data-testid="input-checkin-context">
                            <option value="unknown">Not sure</option>
                            <option value="quiet-rest">During quiet rest</option>
                            <option value="after-activity">After activity</option>
                          </select>
                        </FormControl>
                        <FormDescription>For comparison only, select quiet rest if that describes the measurement.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="measurementQuality" render={({ field }) => (
                      <FormItem className="checkin-field">
                        <FormLabel>How reliable does it seem?</FormLabel>
                        <FormControl>
                          <select {...field} value={field.value ?? ''} onChange={(event) => field.onChange(event.target.value || undefined)} data-testid="input-checkin-quality">
                            <option value="">Not sure</option>
                            <option value="confident">Confident</option>
                            <option value="uncertain">Uncertain</option>
                          </select>
                        </FormControl>
                        <FormDescription>Self-reported context; it does not validate a sensor.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </section>

                <div className="checkin-guidance">
                  <strong>What to do with a reading</strong>
                  <ol>
                    <li>Check that the measurement and unit were entered correctly.</li>
                    <li>Record the context and compare only with readings taken in similar conditions.</li>
                    <li>If you have a concern, follow the mission's medical procedure and contact flight medical support.</li>
                  </ol>
                  <p>AstroVita shows descriptive comparisons only. This prototype has no mission-specific thresholds or treatment instructions.</p>
                </div>

                <div className="checkin-actions">
                  <button className="start-btn checkin-submit" type="submit" data-testid="button-submit-checkin">
                    {isNewEntry ? 'Add this check-in' : 'Update this check-in'}
                  </button>
                  <button className="icon-btn" type="button" onClick={onClose} data-testid="button-cancel-checkin">
                    Cancel
                  </button>
                </div>
              </form>
            </Form>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
