import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  HitlHistoryRecord,
  HitlHistorySnapshot,
} from '../models/hitl-history.types';

const STORAGE_PREFIX = 'ectd-hitl-history';

@Injectable({ providedIn: 'root' })
export class HitlHistoryStorage {
  private readonly platformId = inject(PLATFORM_ID);

  load(taskId: string): HitlHistoryRecord[] {
    if (!isPlatformBrowser(this.platformId) || !taskId) return [];
    try {
      const raw = localStorage.getItem(this.key(taskId));
      if (!raw) return [];
      const snapshot = JSON.parse(raw) as HitlHistorySnapshot;
      return Array.isArray(snapshot.records) ? snapshot.records : [];
    } catch {
      return [];
    }
  }

  save(taskId: string, records: HitlHistoryRecord[]): void {
    if (!isPlatformBrowser(this.platformId) || !taskId) return;
    const snapshot: HitlHistorySnapshot = {
      taskId,
      updatedAt: Date.now(),
      records,
    };
    localStorage.setItem(this.key(taskId), JSON.stringify(snapshot, null, 2));
  }

  downloadJson(taskId: string, records: HitlHistoryRecord[]): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const snapshot: HitlHistorySnapshot = {
      taskId: taskId || 'unknown',
      updatedAt: Date.now(),
      records,
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `hitl-history-${taskId || 'export'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  clear(taskId: string): void {
    if (!isPlatformBrowser(this.platformId) || !taskId) return;
    localStorage.removeItem(this.key(taskId));
  }

  private key(taskId: string): string {
    return `${STORAGE_PREFIX}:${taskId}`;
  }
}
