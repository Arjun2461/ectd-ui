/** Backend run order — phase 1 = consistency, 2 = hyperlinking, 3 = translation. */
export const PIPELINE_PHASE_ORDER = ['consistency', 'hyperlinking', 'translation'] as const;

export const PIPELINE_SERVICE_PHASE: Record<string, number> = {
  consistency: 1,
  hyperlinking: 2,
  translation: 3,
};

/** Overall pipeline UI cap before the backend `completed` event. */
export const OVERALL_PROGRESS_CAP = 94;

/** Target time to reach {@link OVERALL_PROGRESS_CAP} in the UI. */
export const PROGRESS_RAMP_DURATION_MS = 120_000;

/** Hyperlinking UI target while phase 1 is still running (before backend handoff). */
export const HYPERLINKING_RAMP_CAP = OVERALL_PROGRESS_CAP;

/** Hyperlinking jumps to this when phase 1 completes; translation starts then. */
export const HYPERLINKING_COMPLETION_PROGRESS = 100;

/** Per-service UI cap while still running — pipeline `completed` sets all to 100%. */
export const SERVICE_PROGRESS_CAPS: Record<string, number> = {
  consistency: 90,
  hyperlinking: HYPERLINKING_RAMP_CAP,
  translation: 87,
};

/** Hyperlinking baseline speed during the parallel phase. */
export const SERVICE_PROGRESS_MULTIPLIER: Record<string, number> = {
  consistency: 1,
  hyperlinking: 1,
  translation: 0.97,
};

/** Consistency runs parallel with hyperlinking but trails by this many points. */
export const CONSISTENCY_HYPERLINK_LAG_PCT = 10;

/** Translation does not start until this service finishes (UI + SSE). */
export const TRANSLATION_WAITS_FOR = 'hyperlinking';

/** Services that start together when the pipeline begins. */
export const PARALLEL_START_SERVICES = ['consistency', 'hyperlinking'] as const;

export function serviceProgressCap(serviceId: string): number {
  return SERVICE_PROGRESS_CAPS[serviceId] ?? OVERALL_PROGRESS_CAP;
}

export function serviceProgressMultiplier(serviceId: string): number {
  return SERVICE_PROGRESS_MULTIPLIER[serviceId] ?? 1;
}

/** Ease-out curve for the 0 → 1 ramp window. */
export function progressRampEase(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return 1 - Math.pow(1 - clamped, 2.4);
}

export function firstSelectedPipelinePhase(selectedServices: string[]): number {
  for (const id of PIPELINE_PHASE_ORDER) {
    if (selectedServices.includes(id)) {
      return PIPELINE_SERVICE_PHASE[id] ?? 1;
    }
  }
  return 1;
}

/** True for "phase N started" kickoff lines — not a completion handoff. */
export function isPhaseKickoffMessage(message: string): boolean {
  return /phase\s+\d+\s+started/i.test(message);
}

/** Backend: "Phase 1 completed: all files successfully hyperlinked." */
export function isHyperlinkingPhaseCompleteMessage(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('phase 1 completed') && m.includes('hyperlinked');
}

/**
 * Services finished when the pipeline enters `phase` (1-based).
 * Backend order: phase 1 = consistency, 2 = hyperlinking, 3 = translation.
 */
export function servicesCompletedBeforePhase(phase: number): string[] {
  if (phase >= 3) return ['consistency', 'hyperlinking'];
  if (phase === 2) return ['consistency'];
  return [];
}

/** Returns true when log indicates a later service is starting (prior services done). */
export function isProgressMilestoneMessage(message: string): boolean {
  if (isPhaseKickoffMessage(message)) return false;

  const m = message.toLowerCase();
  const translationStarting =
    m.includes('translation') && (m.includes('starting') || /\bstart(?:ed|ing)?\b/.test(m));
  const hyperlinkingStarting =
    m.includes('hyperlinking') && (m.includes('starting') || /\bstart(?:ed|ing)?\b/.test(m));
  const consistencyStarting =
    m.includes('consistency') &&
    (m.includes('starting') || /\bstart(?:ed|ing)?\b/.test(m)) &&
    !m.includes('phase 1');

  return translationStarting || hyperlinkingStarting || consistencyStarting;
}

/** Service ids to mark completed when a milestone log line appears. */
export function servicesCompletedByMilestone(message: string): string[] {
  if (isPhaseKickoffMessage(message)) return [];

  const m = message.toLowerCase();
  if (m.includes('translation') && (m.includes('starting') || /\bstart(?:ed|ing)?\b/.test(m))) {
    return ['consistency', 'hyperlinking'];
  }
  if (m.includes('hyperlinking') && (m.includes('starting') || /\bstart(?:ed|ing)?\b/.test(m))) {
    return ['consistency'];
  }
  if (m.includes('consistency') && (m.includes('starting') || /\bstart(?:ed|ing)?\b/.test(m))) {
    return ['hyperlinking'];
  }
  return [];
}
