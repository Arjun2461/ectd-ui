/** Returns true when log indicates a phase handoff — UI should show 100% progress. */
export function isProgressMilestoneMessage(message: string): boolean {
  const m = message.toLowerCase();
  const phase3Start = m.includes('phase 3') && m.includes('start');
  const translationStart =
    m.includes('translation') && (m.includes('start') || m.includes('starting'));
  const consistencyStart =
    m.includes('consistency') && (m.includes('start') || m.includes('starting'));
  return phase3Start || translationStart || consistencyStart;
}

/** Service ids to mark completed when a milestone log line appears. */
export function servicesCompletedByMilestone(message: string): string[] {
  const m = message.toLowerCase();
  if (m.includes('phase 3') && m.includes('start')) {
    return ['hyperlinking', 'consistency', 'translation'];
  }
  if (m.includes('translation') && (m.includes('start') || m.includes('starting'))) {
    return ['hyperlinking', 'translation'];
  }
  if (m.includes('consistency') && (m.includes('start') || m.includes('starting'))) {
    return ['hyperlinking', 'consistency'];
  }
  return [];
}
