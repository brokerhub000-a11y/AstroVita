import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CrewProfile } from "@/data/crewProfiles";
import {
  buildCheckInHistory,
  buildMockHistory,
  buildMockImmuneHistory,
  HISTORY_METRICS,
  type HistoryPoint,
  type HistoryMetricSystem,
  type HistorySource,
  type ImmuneSamplePoint,
} from "@/data/healthHistory";
import type { HealthCheckInRecord } from "@/data/healthCheckIn";
import type { SystemId } from "@/data/demoHealth";

function formatShortDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "numeric",
    day: "numeric",
  });
}

function formatFullDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function sampleStatusLabel(status: ImmuneSamplePoint["status"]): string {
  if (status === "sample-logged") return "Sample logged";
  if (status === "result-pending") return "Result pending";
  return "No sample";
}

function ImmuneHistory({
  profile,
  source,
}: {
  profile: CrewProfile;
  source: HistorySource;
}) {
  if (source === "check-ins") {
    return (
      <div className="history-empty" data-testid="history-immune-empty">
        Manual check-ins do not include lab results, so no immune status is
        charted here.
      </div>
    );
  }

  const points = buildMockImmuneHistory(profile.id);
  return (
    <>
      <div
        className="immune-history-grid"
        role="list"
        aria-label="Simulated immune sample timeline for the last 14 days"
        data-testid="history-immune-timeline"
      >
        {points.map((point) => (
          <div
            key={point.timestamp}
            className={`immune-history-cell ${point.status}`}
            role="listitem"
            aria-label={`${formatFullDate(point.timestamp)} · ${sampleStatusLabel(point.status)} · simulated`}
            title={`${formatFullDate(point.timestamp)} · ${sampleStatusLabel(point.status)}`}
          >
            <span>{formatShortDate(point.timestamp)}</span>
            <i aria-hidden="true" />
          </div>
        ))}
      </div>
      <div className="immune-history-legend" aria-hidden="true">
        <span><i className="sample-logged" /> Sample logged</span>
        <span><i className="result-pending" /> Result pending</span>
        <span><i className="no-sample" /> No sample</span>
      </div>
      <p className="history-footnote">
        Simulated sample log only · no immune measurement or result is shown.
      </p>
    </>
  );
}

export function HealthHistoryPanel({
  systemId,
  profile,
  checkIns,
  source,
  onSourceChange,
}: {
  systemId: SystemId;
  profile: CrewProfile;
  checkIns: HealthCheckInRecord[];
  source: HistorySource;
  onSourceChange: (source: HistorySource) => void;
}) {
  const metricSystem = systemId === "immune" ? null : systemId as HistoryMetricSystem;
  const metric = metricSystem ? HISTORY_METRICS[metricSystem] : null;
  const points = metricSystem
    ? source === "mock"
      ? buildMockHistory(profile.id, metricSystem)
      : buildCheckInHistory(checkIns, metricSystem)
    : [];
  const recordedPoints = points.filter((point) => point.value !== null);

  return (
    <section className="health-history" data-testid={`history-panel-${systemId}`}>
      <div className="health-history-head">
        <div>
          <div className="kicker">History · 14 days</div>
          <h3>{metric?.label ?? "Immune sample log"}</h3>
        </div>
        <span className="history-unit">{metric?.unit ?? "timeline"}</span>
      </div>
      <div className="history-source-toggle" role="group" aria-label="History data source">
        <button
          type="button"
          className={source === "mock" ? "on" : ""}
          aria-pressed={source === "mock"}
          onClick={() => onSourceChange("mock")}
          data-testid="button-history-mock"
        >
          Mock history
        </button>
        <button
          type="button"
          className={source === "check-ins" ? "on" : ""}
          aria-pressed={source === "check-ins"}
          onClick={() => onSourceChange("check-ins")}
          data-testid="button-history-checkins"
        >
          My check-ins
        </button>
      </div>
      <p className="history-source-note" role="note">
        {source === "mock"
          ? "Synthetic illustration · not NASA readings or sensor data."
          : "Manual entries for this crew profile only · missing days stay blank."}
      </p>

      {systemId === "immune" ? (
        <ImmuneHistory profile={profile} source={source} />
      ) : source === "check-ins" && recordedPoints.length === 0 ? (
        <div className="history-empty" data-testid={`history-empty-${systemId}`}>
          No {metric?.label.toLowerCase()} entries for this crew member in the last
          14 days.
        </div>
      ) : (
        <>
          <div
            className="health-history-chart"
            role="img"
            aria-label={`${metric?.label} history over the last 14 days for ${profile.name}`}
            data-testid={`history-chart-${systemId}`}
          >
            <ResponsiveContainer width="100%" height={142}>
              <LineChart data={points} margin={{ top: 10, right: 8, bottom: 2, left: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(183,203,225,.12)" />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(value: number) => formatShortDate(value)}
                  tick={{ fill: "#91a2b8", fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={22}
                />
                <YAxis
                  type="number"
                  domain={["auto", "auto"]}
                  tick={{ fill: "#91a2b8", fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  width={34}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0]?.payload as HistoryPoint | undefined;
                    const timestamp = Number(label);
                    if (
                      !point ||
                      typeof point.value !== "number" ||
                      !Number.isFinite(timestamp)
                    ) {
                      return null;
                    }
                    return (
                      <div className="history-tooltip" role="tooltip">
                        <strong>{formatFullDate(timestamp)}</strong>
                        <span>
                          {metric?.label}: {point.value} {metric?.unit}
                        </span>
                        {point.context && <small>{point.context}</small>}
                        {source === "mock" && <small>Simulated value</small>}
                      </div>
                    );
                  }}
                  contentStyle={{
                    background: "#101b2d",
                    border: "1px solid rgba(183,203,225,.24)",
                    borderRadius: 9,
                    color: "#eff4fa",
                    fontSize: 11,
                  }}
                  labelStyle={{ color: "#b9c8da", marginBottom: 4 }}
                  itemStyle={{ color: "#9fe6d2" }}
                />
                <Line
                  type="linear"
                  dataKey="value"
                  name={metric?.label}
                  stroke="#9fe6d2"
                  strokeWidth={2}
                  dot={recordedPoints.length < 10 ? { r: 2.5, fill: "#9fe6d2" } : false}
                  activeDot={{ r: 4, fill: "#f2b46a" }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ul className="sr-only">
            {recordedPoints.map((point) => (
              <li key={point.timestamp}>
                {formatFullDate(point.timestamp)}: {point.value} {metric?.unit}
                {point.context ? `, ${point.context}` : ""}
              </li>
            ))}
          </ul>
          <p className="history-footnote">
            {metric?.description} {source === "mock" ? "Illustrative values only." : ""}
          </p>
        </>
      )}
    </section>
  );
}
