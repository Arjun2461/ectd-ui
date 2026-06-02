import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  DraftHistoryEntry,
  DraftHistorySnapshot,
} from '../models/draft-history.types';

const STORAGE_KEY = 'ectd-draft-history';

@Injectable({ providedIn: 'root' })
export class DraftHistoryStorage {
  private readonly platformId = inject(PLATFORM_ID);

  load(): DraftHistoryEntry[] {
    if (!isPlatformBrowser(this.platformId)) return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const snapshot = JSON.parse(raw) as DraftHistorySnapshot;
      return Array.isArray(snapshot.entries) ? snapshot.entries : [];
    } catch {
      return [];
    }
  }

  save(entries: DraftHistoryEntry[]): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const snapshot: DraftHistorySnapshot = {
      updatedAt: Date.now(),
      entries,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }

  clear(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.removeItem(STORAGE_KEY);
  }
}
