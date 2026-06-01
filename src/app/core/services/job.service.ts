import { Injectable, PLATFORM_ID, inject, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Job } from '../models/job.types';
import {
  INITIAL_JOBS,
  applyCompletedResults,
  createProcessingJob,
} from '../data/job-data';
import { JobStorage } from './job.storage';

@Injectable({ providedIn: 'root' })
export class JobService {
  private readonly storage = inject(JobStorage);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly jobs = signal<Job[]>([...INITIAL_JOBS]);
  private readonly currentJob = signal<Job | null>(null);
  private jobCounter = INITIAL_JOBS.length + 1;

  readonly jobsList = computed(() => this.jobs());
  readonly activeJob = computed(() => this.currentJob());

  constructor() {
    this.hydrateFromStorage();
  }

  getJobs(): Job[] {
    return this.jobs();
  }

  getJobById(id: string): Job | undefined {
    return this.jobs().find((j) => j.id === id);
  }

  getJobByTaskId(taskId: string): Job | undefined {
    return this.jobs().find((j) => j.taskId === taskId);
  }

  getLastJob(): Job | undefined {
    const list = this.jobs();
    if (!list.length) return undefined;
    return [...list].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
  }

  setCurrentJob(job: Job | null): void {
    this.currentJob.set(job);
    this.persist();
  }

  createJob(
    selectedServices: string[],
    options?: { targetLanguage?: string }
  ): Job {
    const id = `JOB-${String(this.jobCounter++).padStart(4, '0')}`;
    const job = {
      ...createProcessingJob(id, selectedServices),
      ...(options?.targetLanguage
        ? { targetLanguage: options.targetLanguage }
        : {}),
    };
    this.jobs.update((list) => [job, ...list]);
    this.currentJob.set(job);
    this.persist();
    return job;
  }

  updateJob(updated: Job): void {
    this.jobs.update((list) =>
      list.map((j) => (j.id === updated.id ? { ...updated } : j))
    );
    if (this.currentJob()?.id === updated.id) {
      this.currentJob.set({ ...updated });
    }
    this.persist();
  }

  completeJob(jobId: string): Job | undefined {
    const job = this.getJobById(jobId);
    if (!job) return undefined;
    const completed = applyCompletedResults(job);
    this.updateJob(completed);
    return completed;
  }

  private hydrateFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const snapshot = this.storage.load();
    if (!snapshot?.jobs.length) return;

    const seededIds = new Set(INITIAL_JOBS.map((j) => j.id));
    const userJobs = snapshot.jobs.filter((j) => !seededIds.has(j.id));
    this.jobs.set([...userJobs, ...INITIAL_JOBS]);
    this.jobCounter = Math.max(
      snapshot.jobCounter,
      INITIAL_JOBS.length + 1,
      ...snapshot.jobs.map((j) => {
        const n = Number.parseInt(j.id.replace(/\D/g, ''), 10);
        return Number.isFinite(n) ? n + 1 : 0;
      }),
    );

    const current =
      snapshot.currentJobId ?
        this.getJobById(snapshot.currentJobId) ?? null
      : null;
    this.currentJob.set(current);
  }

  private persist(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.storage.save({
      jobs: this.jobs(),
      jobCounter: this.jobCounter,
      currentJobId: this.currentJob()?.id ?? null,
    });
  }
}
