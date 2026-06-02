import { DraftHistoryEntry } from './draft-history.types';
import { Job } from './job.types';

export type HistoryItemKind = 'job' | 'draft';

export interface HistoryListItem {
  kind: HistoryItemKind;
  id: string;
  status: 'processing' | 'completed';
  createdAt: string;
  modules: string[];
  servicesLabel: string;
  typeLabel: string;
  job?: Job;
  draft?: DraftHistoryEntry;
}
