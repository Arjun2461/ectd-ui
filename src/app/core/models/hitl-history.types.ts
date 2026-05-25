export type HitlHistoryStatus = 'pending' | 'confirmed' | 'skipped';

export interface HitlRecommendationDto {
  option_number: number;
  option_label: string;
  suggested_target_file: string;
  suggested_target_page: number;
  semantic_title_context: string;
}

export interface HitlHistorySuggestion {
  file: string;
  section: string;
  page: number;
  score: number;
  recommended?: boolean;
}

/** One HITL prompt + optional user resolution (stored as JSON per task). */
export interface HitlHistoryRecord {
  hitlSeqNo: number;
  status: HitlHistoryStatus;
  sourceDocument: string;
  unmappedKeywordAnchor: string;
  sourceStatement: string;
  llmAdvisorJudgment: string;
  recommendations: HitlRecommendationDto[];
  suggestions: HitlHistorySuggestion[];
  selectedIndex: number;
  selectedTargetFile?: string;
  selectedTargetPage?: number;
  userAction: string;
  promptedAt: number;
  resolvedAt?: number;
}

export interface HitlHistorySnapshot {
  taskId: string;
  updatedAt: number;
  records: HitlHistoryRecord[];
}
