import {
  healthCheckInSchema,
  type HealthCheckInRecord,
} from "./healthCheckIn.ts";
import type { Readings, Scenario } from "./demoHealth";

export const CREW_PROFILES = [
  {
    id: "sana-idris",
    name: "Sana Idris",
    callsign: "ORBIT-01",
    role: "Mission commander",
    missionDay: 42,
    initials: "SI",
    demoOffsets: { bpm: 0, breaths: 0, sleepHours: 0, exerciseMin: 0 },
  },
  {
    id: "leo-park",
    name: "Leo Park",
    callsign: "ORBIT-02",
    role: "Flight engineer",
    missionDay: 42,
    initials: "LP",
    demoOffsets: { bpm: 4, breaths: 1, sleepHours: -0.7, exerciseMin: 18 },
  },
  {
    id: "amira-hassan",
    name: "Amira Hassan",
    callsign: "ORBIT-03",
    role: "Mission specialist",
    missionDay: 42,
    initials: "AH",
    demoOffsets: { bpm: -3, breaths: -1, sleepHours: 0.6, exerciseMin: -12 },
  },
] as const;

export type CrewProfileId = (typeof CREW_PROFILES)[number]["id"];
export type CrewProfile = (typeof CREW_PROFILES)[number];

export type CrewProfileState = {
  selectedProfileId: CrewProfileId;
  checkInsByProfile: Record<CrewProfileId, HealthCheckInRecord[]>;
};

type StorageAdapter = Pick<Storage, "getItem" | "setItem">;

export type LoadedCrewProfileState = CrewProfileState & {
  canPersist: boolean;
  warning: string | null;
};

export const CREW_PROFILE_STORAGE_KEY = "astrovita:crew-profiles:v1";

const PROFILE_IDS = CREW_PROFILES.map((profile) => profile.id);

export function createEmptyCrewProfileState(): CrewProfileState {
  return {
    selectedProfileId: CREW_PROFILES[0].id,
    checkInsByProfile: {
      "sana-idris": [],
      "leo-park": [],
      "amira-hassan": [],
    },
  };
}

export function isCrewProfileId(value: unknown): value is CrewProfileId {
  return typeof value === "string" && PROFILE_IDS.includes(value as CrewProfileId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCheckIn(value: unknown): HealthCheckInRecord | null {
  if (!isRecord(value) || typeof value.recordedAt !== "string") return null;
  if (!Number.isFinite(Date.parse(value.recordedAt))) return null;

  const parsed = healthCheckInSchema.safeParse(value);
  return parsed.success
    ? { ...parsed.data, recordedAt: value.recordedAt }
    : null;
}

export function loadCrewProfileState(
  storage: StorageAdapter | null,
): LoadedCrewProfileState {
  const emptyState = createEmptyCrewProfileState();
  if (!storage) {
    return {
      ...emptyState,
      canPersist: false,
      warning: "Browser storage is unavailable; changes will not survive a refresh.",
    };
  }

  try {
    const serialized = storage.getItem(CREW_PROFILE_STORAGE_KEY);
    if (!serialized) return { ...emptyState, canPersist: true, warning: null };

    const saved: unknown = JSON.parse(serialized);
    if (!isRecord(saved) || !isRecord(saved.checkInsByProfile)) {
      return {
        ...emptyState,
        canPersist: false,
        warning: "Saved crew data could not be read; it was left untouched.",
      };
    }

    let foundInvalidRecord = false;
    const checkInsByProfile = { ...emptyState.checkInsByProfile };
    for (const profileId of PROFILE_IDS) {
      const value = saved.checkInsByProfile[profileId];
      if (value === undefined) continue;
      if (!Array.isArray(value)) {
        foundInvalidRecord = true;
        continue;
      }

      const validRecords = value.flatMap((record) => {
        const parsed = parseCheckIn(record);
        if (!parsed) foundInvalidRecord = true;
        return parsed ? [parsed] : [];
      });
      checkInsByProfile[profileId] = validRecords;
    }

    const selectedProfileId = isCrewProfileId(saved.selectedProfileId)
      ? saved.selectedProfileId
      : emptyState.selectedProfileId;

    return {
      selectedProfileId,
      checkInsByProfile,
      canPersist: !foundInvalidRecord,
      warning: foundInvalidRecord
        ? "Some saved entries could not be read; existing browser data was left untouched."
        : null,
    };
  } catch {
    return {
      ...emptyState,
      canPersist: false,
      warning: "Saved crew data could not be read; it was left untouched.",
    };
  }
}

export function saveCrewProfileState(
  storage: StorageAdapter,
  state: CrewProfileState,
): void {
  storage.setItem(
    CREW_PROFILE_STORAGE_KEY,
    JSON.stringify({
      selectedProfileId: state.selectedProfileId,
      checkInsByProfile: state.checkInsByProfile,
    }),
  );
}

export function getDemoReadingsForCrew(
  scenario: Scenario,
  tick: number,
  profile: CrewProfile,
): Readings {
  const profileScenario = {
    ...scenario,
    bpm: scenario.bpm + profile.demoOffsets.bpm,
    breaths: scenario.breaths + profile.demoOffsets.breaths,
    sleepHours: scenario.sleepHours + profile.demoOffsets.sleepHours,
    exerciseMin: scenario.exerciseMin + profile.demoOffsets.exerciseMin,
  };

  return {
    bpm: Math.max(1, Math.round(profileScenario.bpm + Math.sin(tick * 0.9) * 2 + Math.sin(tick * 0.37) * 1.4)),
    breaths: Math.max(1, Math.round(profileScenario.breaths + Math.sin(tick * 0.53) * 0.9)),
    sleepHours: profileScenario.sleepHours,
    exerciseMin: Math.max(0, profileScenario.exerciseMin),
    immuneSample: profileScenario.immuneSample,
  };
}
