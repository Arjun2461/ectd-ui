export type JobStatus = 'processing' | 'completed';

export type ServiceStatus = 'waiting' | 'processing' | 'completed';

export interface ServiceProgress {
  id: string;
  name: string;
  progress: number;
  status: ServiceStatus;
  icon: string;
  iconClass: string;
}

export interface JobStats {
  totalLinks: number;
  linked: number;
  broken: number;
  missing: number;
}

export interface ModuleDistribution {
  M1: number;
  M2: number;
  M3: number;
  M4: number;
  M5: number;
}

export interface HitlSuggestion {
  file: string;
  section: string;
  score: number;
  recommended?: boolean;
}

export interface HitlData {
  id: number;
  file: string;
  section: string;
  statement: string;
  suggestions: HitlSuggestion[];
  selectedIndex: number;
  confirmed?: boolean;
  llm_advisor_judgment?: string;
}

export interface ResolvedRefSuggestion {
  file: string;
  page: string;
  section: string;
  score: number;
}

export interface ResolvedReference {
  sourceDoc: string;
  statement: string;
  suggestions: ResolvedRefSuggestion[];
  selectedIndex: number;
  userAction: string;
  badge: 'User confirmed' | 'Auto-resolved';
  llmReason: string;
}

export interface Job {
  id: string;
  /** Backend pipeline task id (SSE); used to resume after refresh. */
  taskId?: string;
  status: JobStatus;
  createdAt: string;
  selectedServices: string[];
  modules?: string[];
  targetLanguage?: string;
  overallProgress: number;
  serviceProgress?: ServiceProgress[];
  liveLogs?: string[];
  stats?: JobStats;
  moduleDistribution?: ModuleDistribution;
  hitl?: HitlData;
  resolvedRefs?: ResolvedReference[];
}

export const SERVICE_META: Record<
  string,
  { name: string; icon: string; iconClass: string }
> = {
  hyperlinking: { name: 'Hyperlinking', icon: 'ti-link', iconClass: 'link' },
  consistency: {
    name: 'Consistency',
    icon: 'ti-shield-check',
    iconClass: 'shield',
  },
  translation: {
    name: 'Translation',
    icon: 'ti-language',
    iconClass: 'translate',
  },
};
