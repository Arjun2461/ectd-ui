import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PipelineState } from './Pipeline-sse.service';

const STORAGE_KEY = 'ectd-active-pipeline';

/** Serializable slice of pipeline state for refresh recovery. */
export interface PipelineSessionSnapshot {
  taskId: string;
  jobId: string;
  status: PipelineState['status'];
  overallProgress: number;
  currentFile: string | null;
  currentFileIndex: number;
  totalFiles: number;
  completedFiles: number;
  autoResolvedCount: number;
  hitlResolvedCount: number;
  progressMilestone: number;
  completedServiceIds: string[];
  updatedAt: number;
}

@Injectable({ providedIn: 'root' })
export class PipelineSessionStorage {
  private readonly platformId = inject(PLATFORM_ID);

  load(): PipelineSessionSnapshot | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const snapshot = JSON.parse(raw) as PipelineSessionSnapshot;
      if (!snapshot.taskId || !snapshot.jobId) return null;
      return snapshot;
    } catch {
      return null;
    }
  }

  save(snapshot: PipelineSessionSnapshot): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }

  clear(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.removeItem(STORAGE_KEY);
  }
}
