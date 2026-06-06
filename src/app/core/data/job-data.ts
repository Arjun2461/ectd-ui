import {
  HitlData,
  Job,
  ModuleDistribution,
  ResolvedReference,
  SERVICE_META,
  ServiceProgress,
} from '../models/job.types';

const COMPLETED_RESULTS_TEMPLATE = {
  stats: {
    totalLinks: 1413,
    linked: 989,
    broken: 396,
    missing: 170,
  },
  moduleDistribution: {
    M1:389,
    M2: 420,
    M3: 310,
    M4: 268,
    M5: 415,
  } satisfies ModuleDistribution,
  hitl: {
    id: 1,
    file: 'M2.5-clinical-overview.pdf',
    section: '§2.4 – Efficacy Conclusions',
    statement: 'study rpt 205.pdf#sec3',
    selectedIndex: 0,
    suggestions: [
      {
        file: 'M2.7.4-clinical-summary.pdf',
        section: '§3.2.1',
        score: 96,
        recommended: true,
      },
      {
        file: 'M2.7.3-clinical-overview.pdf',
        section: '§4.1',
        score: 81,
      },
      {
        file: 'M5.3.5.1-study-report.pdf',
        section: '§7.2.4',
        score: 64,
      },
    ],
  } satisfies HitlData,
  resolvedRefs: [
    {
      sourceDoc: '2.3-qos.pdf',
      statement: 'study rpt 205.pdf#sec3',
      suggestions: [
        {
          file: '3.2.P.8-stability.pdf',
          page: '1',
          section: '3.2.P.8.1 Stability Summary',
          score: 96,
        },
        {
          file: '3.2.S.2-manufacture.pdf',
          page: '3',
          section: '3.2.S.2.5 Process Validation',
          score: 81,
        },
        {
          file: '3.2.S.2-manufacture.pdf',
          page: '1',
          section: '3.2.S.2.5 Process Validation',
          score: 64,
        },
      ],
      selectedIndex: 0,
      userAction: 'User confirmed',
      badge: 'User confirmed' as const,
      llmReason: 'Semantic similarity matches stability section.',
    },
    {
      sourceDoc: '2.5-clinical-overview.pdf',
      statement: 'refer table 14.2.1.3',
      suggestions: [
        {
          file: '5.3.5.1-study-report.pdf',
          page: '47',
          section: 'Table 14.2.1.3 Clinical Results',
          score: 94,
        },
        {
          file: '5.3.1.1-protocol.pdf',
          page: '22',
          section: 'Study Design Overview',
          score: 78,
        },
        {
          file: '5.3.5.3-analysis.pdf',
          page: '51',
          section: 'Statistical Analysis Tables',
          score: 69,
        },
      ],
      selectedIndex: 0,
      userAction: 'Auto-resolved',
      badge: 'Auto-resolved' as const,
      llmReason: 'Exact table reference matched with clinical study report.',
    },
    {
      sourceDoc: '1.3-labeling.pdf',
      statement: 'see dosage guidelines section',
      suggestions: [
        {
          file: '1.3.1-product-label.pdf',
          page: '5',
          section: 'Dosage and Administration',
          score: 92,
        },
        {
          file: '2.7.1-summary.pdf',
          page: '12',
          section: 'Clinical Usage Summary',
          score: 75,
        },
        {
          file: '2.5-clinical-overview.pdf',
          page: '8',
          section: 'Treatment Recommendations',
          score: 63,
        },
      ],
      selectedIndex: 0,
      userAction: 'User confirmed',
      badge: 'User confirmed' as const,
      llmReason: 'Dosage keyword strongly aligned with product labeling section.',
    },
  ] satisfies ResolvedReference[],
};

const LIVE_LOG_POOL = [
  'Initializing pipeline orchestrator...',
  'Parsing eCTD module structure...',
  'Analyzing Module 2...',
  'Analyzing Module 3...',
  'Analyzing Module 4...',
  'Analyzing Module 5...',
  'Extracting cross-document references...',
  'Validating references...',
  'Running AI semantic matching...',
  'Running AI checks...',
  'Scoring hyperlink candidates...',
  'Building resolved reference index...',
  'Generating HITL review queue...',
  'Finalizing service outputs...',
];

export function buildServiceProgress(
  serviceIds: string[],
  overrides?: Partial<ServiceProgress>[]
): ServiceProgress[] {
  return serviceIds.map((id, i) => {
    const meta = SERVICE_META[id];
    const override = overrides?.[i];
    return {
      id,
      name: meta?.name ?? id,
      icon: meta?.icon ?? 'ti-activity',
      iconClass: meta?.iconClass ?? 'link',
      progress: 0,
      status: 'waiting' as const,
      ...override,
    };
  });
}

export function createProcessingJob(
  id: string,
  selectedServices: string[]
): Job {
  return {
    id,
    status: 'processing',
    createdAt: new Date().toISOString(),
    selectedServices,
    overallProgress: 0,
    serviceProgress: buildServiceProgress(selectedServices),
    liveLogs: [LIVE_LOG_POOL[0], LIVE_LOG_POOL[1]],
  };
}

export function applyCompletedResults(job: Job): Job {
  const base =
    job.serviceProgress ?? buildServiceProgress(job.selectedServices);

  return {
    ...job,
    status: 'completed',
    overallProgress: 100,
    serviceProgress: base.map((s) => ({
      ...s,
      progress: 100,
      status: 'completed' as const,
    })),
    liveLogs: undefined,
    stats: { ...COMPLETED_RESULTS_TEMPLATE.stats },
    moduleDistribution: { ...COMPLETED_RESULTS_TEMPLATE.moduleDistribution },
    hitl: structuredClone(COMPLETED_RESULTS_TEMPLATE.hitl),
    resolvedRefs: structuredClone(COMPLETED_RESULTS_TEMPLATE.resolvedRefs),
  };
}

export const LIVE_LOG_MESSAGES = LIVE_LOG_POOL;

export const INITIAL_JOBS: Job[] = [
  {
    id: 'JOB-10293',
    status: 'completed',
    createdAt: '2026-05-11T09:24:00.000Z',
    selectedServices: ['hyperlinking', 'consistency'],
    modules: ['M2', 'M3', 'M4', 'M5'],
    overallProgress: 100,
    serviceProgress: buildServiceProgress(
      ['hyperlinking', 'consistency'],
      [{ progress: 100, status: 'completed' }, { progress: 100, status: 'completed' }]
    ),
    ...COMPLETED_RESULTS_TEMPLATE,
    stats: { totalLinks: 987, linked: 749, broken: 104, missing: 78 },
    moduleDistribution: { M1:280,M2: 312, M3: 245, M4: 198, M5: 232 },
  },
  {
    id: 'JOB-10288',
    status: 'processing',
    createdAt: '2026-05-10T14:10:00.000Z',
    selectedServices: ['translation'],
    modules: ['M5'],
    targetLanguage: 'Japanese',
    overallProgress: 58,
    serviceProgress: buildServiceProgress(['translation'], [
      { progress: 58, status: 'processing' },
    ]),
    liveLogs: [
      'Initializing pipeline orchestrator...',
      'Parsing eCTD module structure...',
      'Translating Module 5 content...',
      'Validating terminology glossary...',
    ],
  },
  {
    id: 'JOB-10271',
    status: 'completed',
    createdAt: '2026-05-09T11:05:00.000Z',
    selectedServices: ['consistency'],
    modules: ['M2', 'M3'],
    overallProgress: 100,
    serviceProgress: buildServiceProgress(['consistency'], [
      { progress: 100, status: 'completed' },
    ]),
    stats: { totalLinks: 654, linked: 610, broken: 21, missing: 23 },
    moduleDistribution: { M1:280,M2: 180, M3: 210, M4: 142, M5: 122 },
    hitl: {
      id: 2,
      file: 'M3.2-quality-report.pdf',
      section: '§4.1 – Specifications',
      statement: 'see stability data table 12',
      selectedIndex: 1,
      suggestions: [
        {
          file: 'M3.2.P.8-stability.pdf',
          section: '§2.1',
          score: 91,
          recommended: true,
        },
        {
          file: 'M3.2.S.4-control.pdf',
          section: '§1.3',
          score: 76,
        },
        {
          file: 'M3.2.P.5-control.pdf',
          section: '§3.0',
          score: 62,
        },
      ],
    },
    resolvedRefs: COMPLETED_RESULTS_TEMPLATE.resolvedRefs.slice(0, 2),
  },
  {
    id: 'JOB-10241',
    status: 'completed',
    createdAt: '2026-05-05T16:42:00.000Z',
    selectedServices: ['consistency', 'translation', 'hyperlinking'],
    modules: ['M1', 'M2', 'M3', 'M4', 'M5'],
    targetLanguage: 'German',
    overallProgress: 100,
    serviceProgress: buildServiceProgress(
      ['consistency', 'translation', 'hyperlinking'],
      [
        { progress: 100, status: 'completed' },
        { progress: 100, status: 'completed' },
        { progress: 100, status: 'completed' },
      ]
    ),
    ...COMPLETED_RESULTS_TEMPLATE,
    stats: { totalLinks: 2104, linked: 1988, broken: 61, missing: 55 },
    moduleDistribution: { M1:600,M2: 512, M3: 498, M4: 445, M5: 649 },
  },
];
