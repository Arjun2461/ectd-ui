import { Injectable, computed, inject, signal } from '@angular/core';
import {
  DraftHistoryEntry,
  DraftSourceModule,
} from '../models/draft-history.types';
import { DraftHistoryStorage } from './draft-history.storage';

const M2_ZIP_ASSET = '/assets/Outputs/Hyperlinking_output.zip';
const OUTPUT_ZIP_FILENAME = 'ectd-summaries-output.zip';

const INITIAL_DUMMY_DRAFTS: DraftHistoryEntry[] = [
  {
    id: 'DRAFT-0003',
    status: 'completed',
    createdAt: '2026-05-28T10:15:00.000Z',
    completedAt: '2026-05-28T10:17:00.000Z',
    sourceModules: ['M1', 'M3', 'M4', 'M5'],
    fileCount: 20,
    overallProgress: 100,
  },
  {
    id: 'DRAFT-0002',
    status: 'processing',
    createdAt: '2026-06-01T14:22:00.000Z',
    sourceModules: ['M1', 'M3', 'M5'],
    fileCount: 16,
    overallProgress: 64,
  },
  {
    id: 'DRAFT-0001',
    status: 'completed',
    createdAt: '2026-05-20T09:40:00.000Z',
    completedAt: '2026-05-20T09:42:00.000Z',
    sourceModules: ['M3', 'M4'],
    fileCount: 11,
    overallProgress: 100,
  },
];

@Injectable({ providedIn: 'root' })
export class DraftHistoryService {
  private readonly storage = inject(DraftHistoryStorage);

  private readonly entries = signal<DraftHistoryEntry[]>([]);
  private draftCounter = 4;
  private activeDraftId: string | null = null;

  readonly draftsList = computed(() => this.entries());

  constructor() {
    this.bootstrap();
  }

  getDrafts(): DraftHistoryEntry[] {
    return this.entries();
  }

  getDraftById(id: string): DraftHistoryEntry | undefined {
    return this.entries().find((e) => e.id === id);
  }

  getActiveDraftId(): string | null {
    return this.activeDraftId;
  }

  createDraft(
    sourceModules: DraftSourceModule[],
    fileCount: number,
  ): DraftHistoryEntry {
    const id = `DRAFT-${String(this.draftCounter++).padStart(4, '0')}`;
    const entry: DraftHistoryEntry = {
      id,
      status: 'processing',
      createdAt: new Date().toISOString(),
      sourceModules,
      fileCount,
      overallProgress: 0,
    };
    this.activeDraftId = id;
    this.prepend(entry);
    return entry;
  }

  updateProgress(id: string, overallProgress: number): void {
    this.patch(id, { overallProgress });
  }

  completeDraft(id: string): void {
    this.patch(id, {
      status: 'completed',
      overallProgress: 100,
      completedAt: new Date().toISOString(),
    });
    if (this.activeDraftId === id) {
      this.activeDraftId = null;
    }
  }

  clearActiveDraft(): void {
    this.activeDraftId = null;
  }

  downloadOutputZip(): void {
    const link = document.createElement('a');
    link.href = M2_ZIP_ASSET;
    link.download = OUTPUT_ZIP_FILENAME;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private bootstrap(): void {
    const stored = this.storage.load();
    if (stored.length > 0) {
      this.entries.set(this.sortNewest(stored));
      this.draftCounter = this.nextCounterFrom(stored);
      return;
    }
    this.entries.set(this.sortNewest([...INITIAL_DUMMY_DRAFTS]));
    this.persist();
  }

  private prepend(entry: DraftHistoryEntry): void {
    this.entries.update((list) => this.sortNewest([entry, ...list]));
    this.persist();
  }

  private patch(id: string, partial: Partial<DraftHistoryEntry>): void {
    this.entries.update((list) =>
      list.map((e) => (e.id === id ? { ...e, ...partial } : e)),
    );
    this.persist();
  }

  private persist(): void {
    this.storage.save(this.entries());
  }

  private sortNewest(list: DraftHistoryEntry[]): DraftHistoryEntry[] {
    return [...list].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  private nextCounterFrom(list: DraftHistoryEntry[]): number {
    let max = 0;
    for (const entry of list) {
      const match = /^DRAFT-(\d+)$/.exec(entry.id);
      if (match) max = Math.max(max, Number.parseInt(match[1], 10));
    }
    return max + 1;
  }
}
