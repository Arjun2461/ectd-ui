import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Job } from '../models/job.types';

const STORAGE_KEY = 'ectd-jobs';

export interface JobStoreSnapshot {
  jobs: Job[];
  jobCounter: number;
  currentJobId: string | null;
}

@Injectable({ providedIn: 'root' })
export class JobStorage {
  private readonly platformId = inject(PLATFORM_ID);

  load(): JobStoreSnapshot | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const snapshot = JSON.parse(raw) as JobStoreSnapshot;
      if (!Array.isArray(snapshot.jobs)) return null;
      return snapshot;
    } catch {
      return null;
    }
  }

  save(snapshot: JobStoreSnapshot): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }

  clear(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.removeItem(STORAGE_KEY);
  }
}
