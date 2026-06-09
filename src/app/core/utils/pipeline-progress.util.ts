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
export const PROGRESS_RAMP_DURATION_MS = 60_000;

/** Per-service UI cap while still running — 100% only when the pipeline completes. */
export const SERVICE_PROGRESS_CAPS: Record<string, number> = {
  consistency: 97,
  hyperlinking: 94,
  translation: 91,
};

/** Relative speed vs the overall average — keeps bars visibly different while parallel. */
export const SERVICE_PROGRESS_MULTIPLIER: Record<string, number> = {
  consistency: 1.03,
  hyperlinking: 1,
  translation: 0.97,
};

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
