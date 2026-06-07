/** Backend run order — phase 1 = consistency, 2 = hyperlinking, 3 = translation. */
export const PIPELINE_PHASE_ORDER = ['consistency', 'hyperlinking', 'translation'] as const;

export const PIPELINE_SERVICE_PHASE: Record<string, number> = {
  consistency: 1,
  hyperlinking: 2,
  translation: 3,
};

/** Per-service UI cap while still running — 100% only when that service finishes or pipeline completes. */
export const SERVICE_PROGRESS_CAPS: Record<string, number> = {
  consistency: 87,
  hyperlinking: 93,
  translation: 90,
};

export function serviceProgressCap(serviceId: string): number {
  return SERVICE_PROGRESS_CAPS[serviceId] ?? 90;
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
