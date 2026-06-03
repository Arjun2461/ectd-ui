export type DraftHistoryStatus = 'processing' | 'completed';

export type DraftSourceModule =  'M3' | 'M4' | 'M5';

export interface DraftHistoryEntry {
  id: string;
  status: DraftHistoryStatus;
  createdAt: string;
  completedAt?: string;
  sourceModules: DraftSourceModule[];
  fileCount: number;
  overallProgress: number;
}

export interface DraftHistorySnapshot {
  updatedAt: number;
  entries: DraftHistoryEntry[];
}
