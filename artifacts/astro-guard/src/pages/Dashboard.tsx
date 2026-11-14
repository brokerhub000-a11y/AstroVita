import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Download,
  Maximize2,
  Play,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
  TriangleAlert,
} from "lucide-react";
import {
  createAnatomyEngine,
  hasWebGL,
  type AnatomyEngine,
  type EngineStatus,
} from "@/components/anatomy/engine";
import { HealthCheckInDrawer } from "@/components/HealthCheckInDrawer";
import { DemoAlertNotice } from "@/components/DemoAlerts";
import { getDemoAlerts } from "@/data/demoAlerts";
import { HEALTH_GUIDANCE } from "@/data/healthGuidance";
import {
  DEMO_DISCLAIMER,
  MODEL_CREDITS,
  NASA_INDEX,
  SCENARIOS,
  SCENARIO_ORDER,
  SYSTEMS,
  SYSTEM_ORDER,
  demoReadings,
  type Readings,
  type ScenarioId,
  type SystemId,
} from "@/data/demoHealth";
import {
  formatCheckInValue,
  createHealthCheckInCsv,
  MEASUREMENT_CONTEXT_LABELS,
  type HealthCheckInRecord,
} from "@/data/healthCheckIn";
import { analyzeRecoveryTrend } from "@/data/recoveryInsights";

type SecondaryReading = { label: string; value: string; unit?: string };
type PanelReading = {
  value: string;
  unit: string;
  name: string;
  isText?: boolean;
  secondary?: SecondaryReading[];
};

function moodLabel(mood: NonNullable<HealthCheckInRecord["mood"]>): string {
  return mood === "good" ? "Good" : mood === "okay" ? "Okay" : "Low";
}

function readingFor(
  id: SystemId,
  r: Readings,
  checkIn: HealthCheckInRecord | null,
): PanelReading {
  if (checkIn) {
    switch (id) {
      case "heart":
        return {
          value: formatCheckInValue(checkIn.heartRate),
          unit: checkIn.heartRate === undefined ? "" : "bpm",
          name: "Self-entered heart rate",
          isText: checkIn.heartRate === undefined,
          secondary: [
            ...(checkIn.bloodPressureSystolic !== undefined &&
            checkIn.bloodPressureDiastolic !== undefined
              ? [{
                  label: "Blood pressure",
                  value: `${formatCheckInValue(checkIn.bloodPressureSystolic)}/${formatCheckInValue(checkIn.bloodPressureDiastolic)}`,
                  unit: "mmHg",
                }]
              : []),
            ...(checkIn.sleepHours !== undefined
              ? [{ label: "Sleep, self-reported", value: formatCheckInValue(checkIn.sleepHours, 1), unit: "h" }]
              : []),
            ...(checkIn.fatigue !== undefined
              ? [{ label: "Fatigue, self-reported", value: formatCheckInValue(checkIn.fatigue), unit: "/ 10" }]
              : []),
          ],
        };
      case "lungs":
        return {
          value: formatCheckInValue(checkIn.breathingRate),
          unit: checkIn.breathingRate === undefined ? "" : "breaths/min",
          name: "Self-entered breathing rate",
          isText: checkIn.breathingRate === undefined,
        };
      case "brain":
        return {
          value: formatCheckInValue(checkIn.sleepHours, 1),
          unit: checkIn.sleepHours === undefined ? "" : "h sleep",
          name: "Self-entered sleep last cycle",
          isText: checkIn.sleepHours === undefined,
          secondary: checkIn.mood
            ? [{ label: "Self-reported mood", value: moodLabel(checkIn.mood) }]
            : [],
        };
      case "skeletal":
        return {
          value: formatCheckInValue(checkIn.exerciseMinutes),
          unit: checkIn.exerciseMinutes === undefined ? "" : "min exercise",
          name: "Self-entered exercise today",
          isText: checkIn.exerciseMinutes === undefined,
        };
      case "immune":
        return {
          value: "No immune test entered",
          unit: "",
          name: "Immune measurements require a sample",
          isText: true,
        };
    }
  }

  switch (id) {
    case "heart":
      return { value: String(r.bpm), unit: "bpm", name: "Demo heart rate" };
    case "lungs":
      return {
        value: String(r.breaths),
        unit: "breaths/min",
        name: "Demo breathing rate",
      };
    case "brain":
      return {
        value: r.sleepHours.toFixed(1),
        unit: "h sleep",
        name: "Demo sleep last cycle",
      };
    case "skeletal":
      return {
        value: String(r.exerciseMin),
        unit: "min",
        name: "Demo exercise today",
      };
    case "immune":
      return {
        value: r.immuneSample,
        unit: "",
        name: "Demo lab sample status",
        isText: true,
      };
  }
}

function motionDescription(
  id: SystemId,
  checkIn: HealthCheckInRecord | null,
): string {
  if (!checkIn) return SYSTEMS[id].visualAnimation;
  if (id === "heart" && checkIn.heartRate !== undefined) {
    return "The heart animation follows the value entered here; it does not indicate health status.";
  }
  if (id === "lungs" && checkIn.breathingRate !== undefined) {
    return "The lung animation follows the breathing rate entered here; it does not measure oxygen.";
  }
  return "This motion is illustrative only; no direct measurement of this system was entered.";
}

export default function Dashboard() {
  const stageRef = useRef<HTMLDivElement>(null);
  const sourcesRef = useRef<HTMLElement>(null);
  const checkInRef = useRef<HTMLElement>(null);
  const sourcesButtonRef = useRef<HTMLButtonElement>(null);
  const checkInButtonRef = useRef<HTMLButtonElement>(null);
  const engineRef = useRef<AnatomyEngine | null>(null);
  const markerEls = useRef<Partial<Record<SystemId, HTMLButtonElement | null>>>(
    {},
  );
  const [status, setStatus] = useState<EngineStatus>({
    kind: "loading",
    progress: 0,
  });
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<SystemId | null>(null);
  const [scenario, setScenario] = useState<ScenarioId>("nominal");
  const [tick, setTick] = useState(0);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkIns, setCheckIns] = useState<HealthCheckInRecord[]>([]);
  const [checkInMode, setCheckInMode] = useState(false);
  const [newCheckIn, setNewCheckIn] = useState(false);
  const [recoveryExampleOpen, setRecoveryExampleOpen] = useState(false);
  const [webgl] = useState(() => typeof document !== "undefined" && hasWebGL());

  const sc = SCENARIOS[scenario];
  const readings = demoReadings(sc, tick);
  const demoAlerts = getDemoAlerts(sc, checkInMode);
  const checkIn = checkIns.at(-1) ?? null;
  const recoveryComparison = checkInMode ? analyzeRecoveryTrend(checkIns) : null;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !webgl) return;
    setStatus({ kind: "loading", progress: 0 });
    let engine: AnatomyEngine | null = null;
    try {
      engine = createAnatomyEngine(stage, {
        onStatus: setStatus,
        onPick: (id) => setSelected(id),
      });
    } catch {
      setStatus({
        kind: "error",
        message: "3D rendering could not start in this browser.",
      });
      return;
    }
    engineRef.current = engine;
    SYSTEM_ORDER.forEach((id) =>
      engine?.bindMarker(id, markerEls.current[id] ?? null),
    );
    return () => {
      engine?.dispose();
      engineRef.current = null;
    };
  }, [attempt, webgl]);

  useEffect(() => {
    engineRef.current?.focus(selected);
  }, [selected, status.kind]);
  useEffect(() => {
    engineRef.current?.setRates(
      checkInMode ? checkIn?.heartRate ?? 60 : readings.bpm,
      checkInMode ? checkIn?.breathingRate ?? 12 : readings.breaths,
    );
  }, [
    readings.bpm,
    readings.breaths,
    checkInMode,
    checkIn?.heartRate,
    checkIn?.breathingRate,
    status.kind,
  ]);
  useEffect(() => {
    if (checkInMode) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 2000);
    return () => window.clearInterval(id);
  }, [checkInMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (sourcesOpen) setSourcesOpen(false);
        else if (checkInOpen) setCheckInOpen(false);
        else setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sourcesOpen, checkInOpen]);

  useEffect(() => {
    if (!sourcesOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const controls = sourcesRef.current?.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, [tabindex="0"]',
      );
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !sourcesRef.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trapFocus);
    return () => {
      document.removeEventListener("keydown", trapFocus);
      document.body.style.overflow = previousOverflow;
      sourcesButtonRef.current?.focus();
    };
  }, [sourcesOpen]);

  useEffect(() => {
    if (!checkInOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const controls = checkInRef.current?.querySelectorAll<HTMLElement>(
        'button, input, select, a[href], [tabindex="0"]',
      );
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !checkInRef.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trapFocus);
    return () => {
      document.removeEventListener("keydown", trapFocus);
      document.body.style.overflow = previousOverflow;
      checkInButtonRef.current?.focus();
    };
  }, [checkInOpen]);

  const info = selected ? SYSTEMS[selected] : null;
  const selectedDemoAlert = demoAlerts.find(a => a.systemId === selected);
  const activeCheckIn = checkInMode ? checkIn : null;
  const checkInTime = activeCheckIn
    ? new Date(activeCheckIn.recordedAt).toLocaleString()
    : "";
  const openCheckIn = (newEntry = false) => {
    setSourcesOpen(false);
    setNewCheckIn(newEntry);
    setCheckInOpen(true);
  };
  const saveCheckIn = (record: HealthCheckInRecord) => {
    setCheckIns((history) => newCheckIn
      ? [...history, record]
      : history.length
        ? [...history.slice(0, -1), record]
        : [record]);
    setCheckInMode(true);
    setCheckInOpen(false);
  };
  const downloadCheckIns = () => {
    if (!checkIns.length) return;
    const file = new Blob([createHealthCheckInCsv(checkIns)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `astrovita-check-ins-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="dash" data-testid="page-dashboard">
      <header className="dash-top">
        <Link href="/" className="dash-brand" data-testid="link-home">
          <span className="brand-orb" aria-hidden="true" />
          <span>AstroVita</span>
        </Link>
        {/* <div className={`demo-pill${checkInMode ? ' checkin-pill' : ''}`} role="note" data-testid="text-demo-disclaimer">
          <span className="demo-dot" aria-hidden="true" />
          <strong>{checkInMode ? 'Local check-in' : 'Local demo'}</strong>
          <span className="demo-pill-long">{checkInMode
            ? ' · user-entered values; not sent, saved or medically assessed'
            : ' · synthetic values, not NASA readings or sensors, not a diagnosis'}</span>
        </div> */}
        <div className="top-actions">
          {!checkInMode ? (
            <>
              <div
                className="seg"
                role="group"
                aria-label="Demo scenario"
                data-testid="control-scenario"
              >
                {SCENARIO_ORDER.map((id) => (
                  <button
                    key={id}
                    aria-pressed={scenario === id}
                    className={scenario === id ? "on" : ""}
                    onClick={() => setScenario(id)}
                    data-testid={`button-scenario-${id}`}
                  >
                    {SCENARIOS[id].label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <button
              className="icon-btn"
              onClick={() => setCheckInMode(false)}
              data-testid="button-return-to-demo"
            >
              <Play size={15} />
              <span>Demo mode</span>
            </button>
          )}
          <button
            ref={checkInButtonRef}
            className="icon-btn"
            onClick={() => openCheckIn()}
            data-testid="button-open-checkin"
          >
            <Activity size={15} />
            <span>{checkIns.length ? "Edit latest" : "Check in"}</span>
          </button>
          <button
            ref={sourcesButtonRef}
            className="icon-btn"
            onClick={() => setSourcesOpen(true)}
            data-testid="button-open-sources"
          >
            <BookOpen size={15} />
            <span>Sources</span>
          </button>
        </div>
      </header>

      <div className="dash-grid">
        <section className="stage-wrap" aria-label="3D anatomy view">
          <div className="stage" ref={stageRef} data-testid="stage-anatomy">
            {webgl &&
              SYSTEM_ORDER.map((id) => (
                <button
                  key={id}
                  ref={(el) => {
                    markerEls.current[id] = el;
                    engineRef.current?.bindMarker(id, el);
                  }}
                  className={`marker${selected === id ? " on" : ""}${demoAlerts.find(a => a.systemId === id) ? ` ${sc.flags[id]}` : ""}${id === "immune" ? " systemic" : ""}${checkInMode && id === "heart" && checkIns.length ? " session-marker" : ""}`}
                  style={{ opacity: 0 }}
                  onClick={() => setSelected(id)}
                  aria-label={`Inspect ${SYSTEMS[id].label}${demoAlerts.find(a => a.systemId === id) ? ` — demo ${sc.flags[id]}, simulation only` : checkInMode ? " — not medically assessed" : ""}`}
                  tabIndex={status.kind === "ready" ? 0 : -1}
                  data-testid={`marker-${id}`}
                >
                  <span className="marker-ring" />
                  <span className="marker-label">
                    {id === "immune" ? "Immune · body-wide" : SYSTEMS[id].label}
                    {checkInMode && id === "heart" && checkIns.length > 0 && (
                      <span className="marker-session-label">CHECK-IN</span>
                    )}
                    {demoAlerts.find(a => a.systemId === id) && (
                      <span className="marker-demo-label" data-testid={`badge-demo-alert-${id}`}>
                        <TriangleAlert size={12} aria-hidden="true" />
                        DEMO {sc.flags[id] === "alert" ? "ALERT" : "WATCH"}
                      </span>
                    )}
                  </span>
                </button>
              ))}
          </div>
          <div className="stage-tools">
            <button
              className="icon-btn"
              onClick={() => setSelected(null)}
              data-testid="button-reset-view"
            >
              <Maximize2 size={14} />
              <span>Full body</span>
            </button>
            <button
              className="icon-btn sq"
              onClick={() => engineRef.current?.zoom(1)}
              aria-label="Zoom in"
              data-testid="button-zoom-in"
            >
              <ZoomIn size={15} />
            </button>
            <button
              className="icon-btn sq"
              onClick={() => engineRef.current?.zoom(-1)}
              aria-label="Zoom out"
              data-testid="button-zoom-out"
            >
              <ZoomOut size={15} />
            </button>
          </div>
          <div className="stage-hint">
            Drag to orbit · scroll to zoom · click a marker
          </div>
          {!webgl && (
            <div
              className="stage-overlay"
              role="alert"
              data-testid="status-webgl-unavailable"
            >
              <h3>3D view unavailable</h3>
              <p>
                This browser has WebGL turned off. Enable WebGL or use a
                supported browser to inspect body systems.
              </p>
            </div>
          )}
          {webgl && status.kind === "loading" && (
            <div
              className="stage-overlay soft"
              data-testid="status-model-loading"
            >
              <div className="load-figure" aria-hidden="true" />
              <p>
                Bringing the body model aboard ·{" "}
                {Math.round(status.progress * 100)}%
              </p>
              <div className="load-bar">
                <span
                  style={{
                    transform: `scaleX(${Math.max(0.04, status.progress)})`,
                  }}
                />
              </div>
            </div>
          )}
          {webgl && status.kind === "error" && (
            <div
              className="stage-overlay"
              role="alert"
              data-testid="status-model-error"
            >
              <h3>Model not loaded</h3>
              <p>{status.message}</p>
              <button
                className="icon-btn"
                onClick={() => setAttempt((a) => a + 1)}
                data-testid="button-retry-model"
              >
                <RotateCcw size={14} />
                <span>Retry</span>
              </button>
            </div>
          )}
          {status.kind === "ready" && !status.skeleton && (
            <div className="stage-warn" data-testid="status-skeleton-missing">
              Skeleton model unavailable; other systems still shown.
            </div>
          )}
        </section>

        <aside className="panel" aria-live="polite" data-testid="panel-system">
          <AnimatePresence mode="wait">
            {info ? (
              <motion.div
                key={info.id}
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
              >
                <div className="panel-head">
                  <div>
                    <div className="kicker">{info.short}</div>
                    <h2 data-testid="text-panel-title">{info.label}</h2>
                  </div>
                  <button
                    className="icon-btn sq"
                    onClick={() => setSelected(null)}
                    aria-label="Close and show full body"
                    data-testid="button-close-panel"
                  >
                    <X size={15} />
                  </button>
                </div>
                {selectedDemoAlert && (
                  <DemoAlertNotice alert={selectedDemoAlert} />
                )}
                {(() => {
                  const r = readingFor(info.id, readings, activeCheckIn);
                  const flag = checkInMode ? undefined : sc.flags[info.id];
                  return (
                    <div className="reading">
                      <div className="reading-name">{r.name}</div>
                      <div className={`reading-val${r.isText ? " text" : ""}`}>
                        <motion.span
                          key={r.value}
                          initial={{ opacity: 0.3, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          data-testid={`text-reading-${info.id}`}
                        >
                          {r.value}
                        </motion.span>
                        {r.unit && <small>{r.unit}</small>}
                      </div>
                      {r.secondary?.map((item) => (
                        <div
                          className="reading-secondary"
                          key={item.label}
                          data-testid={`text-checkin-secondary-${info.id}`}
                        >
                          <span>{item.label}</span>
                          <strong>
                            {item.value} {item.unit ?? ""}
                          </strong>
                        </div>
                      ))}
                      <div
                        className={`flag-row ${checkInMode ? "checkin-unassessed" : flag ?? "none"}`}
                        data-testid={`status-flag-${info.id}`}
                      >
                        {checkInMode
                          ? r.isText
                            ? "No matching measurement entered"
                            : "User-entered · descriptive comparison only"
                          : flag === "alert"
                            ? "Demo alert · scenario script only"
                            : flag === "watch"
                            ? "Scripted demo flag: shown for this scenario only"
                            : "No scripted demo flag in this scenario"}
                      </div>
                      <p className="fine">
                        {checkInMode
                          ? "No clinical status or medical threshold is calculated."
                          : "Flags are part of the demo script, not medical thresholds."}
                      </p>
                    </div>
                  );
                })()}
                {checkInMode && info.id === "heart" && checkIns.length > 0 && (
                  <section className="recovery-insight" data-testid="section-recovery-comparison">
                    <div className="kicker">Personal comparison · descriptive only</div>
                    {recoveryComparison?.kind !== "compared" ? (
                      <p data-testid="text-recovery-insufficient">
                        {recoveryComparison?.message ?? "Enter a heart-rate reading to begin."}
                      </p>
                    ) : (
                      <>
                        <p className="recovery-context">
                          {MEASUREMENT_CONTEXT_LABELS[checkIn?.measurementContext ?? "unknown"]} · compared with {recoveryComparison.comparisonCount} earlier entries
                        </p>
                        <div className="reading-secondary">
                          <span>Your session reference</span>
                          <strong>{recoveryComparison.baselineBpm.toFixed(1)} bpm</strong>
                        </div>
                        <div className="reading-secondary">
                          <span>Difference from reference</span>
                          <strong>{recoveryComparison.deltaBpm > 0 ? "+" : ""}{recoveryComparison.deltaBpm.toFixed(1)} bpm</strong>
                        </div>
                        <p data-testid="text-recovery-direction">
                          {recoveryComparison.direction === "first"
                            ? "First comparison in this session."
                            : recoveryComparison.direction === "closer"
                              ? "The difference is smaller than in the previous comparable entry."
                              : recoveryComparison.direction === "farther"
                                ? "The difference is larger than in the previous comparable entry."
                                : "The difference is unchanged from the previous comparable entry."}
                        </p>
                        <p className="recovery-context">
                          Recorded alongside {recoveryComparison.sleepHours === undefined ? "no sleep duration" : `${recoveryComparison.sleepHours.toFixed(1)} h sleep`} and {recoveryComparison.fatigue === undefined ? "no fatigue score" : `self-reported fatigue ${recoveryComparison.fatigue}/10`}. These values are shown together; they do not establish a cause.
                        </p>
                      </>
                    )}
                    <p className="recovery-boundary">
                      The three-entry reference rule is a prototype comparison choice, not a validated medical threshold. Values are not a diagnosis or a measure of safety.
                    </p>
                    <p className="recovery-boundary">
                      NASA discusses cardiovascular changes and sleep/schedule risks separately; these sources do not establish that one caused a change in the other.
                    </p>
                    <a
                      href="https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/"
                      target="_blank"
                      rel="noreferrer"
                      className="src-link"
                      data-testid="link-recovery-sleep-source"
                    >
                      NASA sleep and schedule context <ArrowUpRight size={13} />
                    </a>
                    <button
                      className="recovery-example-toggle"
                      onClick={() => setRecoveryExampleOpen(value => !value)}
                      aria-expanded={recoveryExampleOpen}
                      data-testid="button-toggle-recovery-example"
                    >
                      {recoveryExampleOpen ? "Hide illustrative example" : "See an illustrative example"}
                    </button>
                    {recoveryExampleOpen && (
                      <div className="recovery-example" role="note" data-testid="card-recovery-example">
                        <strong>Illustrative values only · not your readings</strong>
                        <p>Example: three earlier quiet-rest readings average 64 bpm; a later 68 bpm reading is shown as 4 bpm above that small session reference.</p>
                        <p>Sleep and self-reported fatigue can be viewed alongside it, but this does not show that one caused the other or indicate a health condition.</p>
                      </div>
                    )}
                    <div className="recovery-actions">
                      <button className="icon-btn" onClick={() => openCheckIn(true)} data-testid="button-add-followup-checkin">
                        <Activity size={14} /> Record next check-in
                      </button>
                    </div>
                  </section>
                )}
                <div
                  className="block"
                  data-testid={`section-guidance-${info.id}`}
                >
                  <div className="kicker">What NASA says</div>
                  <p>{info.context}</p>
                  <div
                    className="guidance-note"
                    role="note"
                    data-testid={`card-guidance-${info.id}`}
                  >
                    <div className="kicker">
                      General guidance · not based on this reading
                    </div>
                    <p>{HEALTH_GUIDANCE[info.id]}</p>
                    <p className="guidance-boundary">
                      Educational context only; it does not interpret your
                      check-in or replace mission procedures.
                    </p>
                  </div>
                  <a
                    href={info.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="src-link"
                    data-testid={`link-source-${info.id}`}
                  >
                    {info.sourceTitle}
                    <ArrowUpRight size={13} />
                  </a>
                </div>
                <div className="block">
                  <div className="kicker">What this reading can't tell you</div>
                  <p data-testid={`text-limit-${info.id}`}>
                    {info.measurementLimit}
                  </p>
                </div>
                <div className="block">
                  <div className="kicker">About the motion</div>
                  <p>{motionDescription(info.id, activeCheckIn)}</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="overview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="kicker">
                  {checkInMode ? "Crew check-in · local" : "Crew member · demo"}
                </div>
                <h2>Full body</h2>
                <p className="lede">
                  {checkInMode
                    ? "Select a highlighted point on the body to review values entered for that system."
                    : "Select a highlighted point on the body to view its demo reading and NASA context."}
                </p>
                {!checkInMode && <p className="fine">{DEMO_DISCLAIMER}</p>}
              </motion.div>
            )}
          </AnimatePresence>
          {checkInMode && activeCheckIn && (
            <div
              className="checkin-summary"
              data-testid="section-checkin-additional"
            >
              <div className="kicker">Other self-entered indicators</div>
              <p className="fine" data-testid="text-checkin-session-count">
                {checkIns.length} check-in{checkIns.length === 1 ? "" : "s"} in this page session · cleared on refresh
              </p>
              <div>
                <span>Blood pressure</span>
                <strong>
                  {activeCheckIn.bloodPressureSystolic === undefined
                    ? "Not entered"
                    : `${formatCheckInValue(activeCheckIn.bloodPressureSystolic)}/${formatCheckInValue(activeCheckIn.bloodPressureDiastolic)} mmHg`}
                </strong>
              </div>
              <div>
                <span>Blood glucose</span>
                <strong>
                  {formatCheckInValue(activeCheckIn.bloodGlucose, 1)}
                  {activeCheckIn.bloodGlucose === undefined ? "" : " mg/dL"}
                </strong>
              </div>
              <div>
                <span>Body temperature</span>
                <strong>
                  {formatCheckInValue(activeCheckIn.bodyTemperatureC, 1)}
                  {activeCheckIn.bodyTemperatureC === undefined ? "" : " °C"}
                </strong>
              </div>
              {info && (
                <p className="fine">
                  These are raw entries only; the app does not decide whether a
                  value is safe.
                </p>
              )}
              {!info && (
                <p className="fine">
                  These are raw entries only; the app does not decide whether a
                  value is safe.
                </p>
              )}
              <p className="fine" data-testid="text-checkin-export-privacy">
                The CSV contains personal health data. Download it only if you
                want to keep a copy; it is not uploaded or saved automatically.
              </p>
              <div className="checkin-session-actions">
                <button
                  className="icon-btn"
                  onClick={downloadCheckIns}
                  disabled={!checkIns.length}
                  data-testid="button-download-checkins"
                >
                  <Download size={14} /> Download session CSV
                </button>
              </div>
              {!info && (
                <p className="fine" data-testid="text-checkin-timestamp">
                  Recorded {checkInTime} · stored in this page only.
                </p>
              )}
              {!info && (
                <div className="checkin-session-actions">
                  <button className="icon-btn" onClick={() => openCheckIn(true)} data-testid="button-add-session-checkin">
                    <Activity size={14} /> Add next check-in
                  </button>
                  <button className="icon-btn" onClick={() => {
                    if (window.confirm("Clear all check-ins from this page session?")) {
                      setCheckIns([]);
                      setCheckInMode(false);
                    }
                  }} data-testid="button-clear-session-checkins">
                    <RotateCcw size={14} /> Clear session
                  </button>
                </div>
              )}
            </div>
          )}
          {checkInMode && info && (
            <p
              className="fine checkin-time"
              data-testid="text-checkin-timestamp"
            >
              Recorded {checkInTime} · stored in this page only.
            </p>
          )}
        </aside>
      </div>

      <AnimatePresence>
        {sourcesOpen && (
          <motion.div
            className="drawer-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSourcesOpen(false)}
          >
            <motion.aside
              ref={sourcesRef}
              className="drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Sources and demo notes"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
              onClick={(e) => e.stopPropagation()}
              data-testid="drawer-sources"
            >
              <div className="panel-head">
                <h2>Sources & demo</h2>
                <button
                  className="icon-btn sq"
                  onClick={() => setSourcesOpen(false)}
                  aria-label="Close sources"
                  autoFocus
                  data-testid="button-close-sources"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="block">
                <div className="kicker">About the numbers</div>
                <p>
                  {DEMO_DISCLAIMER} Scenarios and flags are scripted for
                  demonstration.
                </p>
              </div>
              <div className="block">
                <div className="kicker">NASA Human Research Program</div>
                {NASA_INDEX.map((s, i) => (
                  <a
                    key={s.url}
                    className="src-link"
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    data-testid={`link-index-source-${i}`}
                  >
                    {s.title}
                    <ArrowUpRight size={13} />
                  </a>
                ))}
                {SYSTEM_ORDER.map((id) => (
                  <a
                    key={id}
                    className="src-link"
                    href={SYSTEMS[id].sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    data-testid={`link-drawer-source-${id}`}
                  >
                    {SYSTEMS[id].sourceTitle}
                    <ArrowUpRight size={13} />
                  </a>
                ))}
              </div>
              <div className="block">
                <div className="kicker">Models & imagery</div>
                {MODEL_CREDITS.map((c, i) => (
                  <div key={c.title} className="credit">
                    <strong>{c.title}</strong>
                    <p>{c.detail}</p>
                    <a
                      className="src-link"
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      data-testid={`link-model-credit-${i}`}
                    >
                      {c.url.replace("https://", "")}
                      <ArrowUpRight size={13} />
                    </a>
                  </div>
                ))}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
      <HealthCheckInDrawer
        open={checkInOpen}
        current={newCheckIn ? null : checkIn}
        isNewEntry={newCheckIn}
        dialogRef={checkInRef}
        onClose={() => setCheckInOpen(false)}
        onSave={saveCheckIn}
      />
    </div>
  );
}
