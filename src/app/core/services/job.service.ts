import { Injectable, signal, computed } from '@angular/core';
import { Job } from '../models/job.types';
import {
  INITIAL_JOBS,
  applyCompletedResults,
  createProcessingJob,
} from '../data/job-data';

@Injectable({ providedIn: 'root' })
export class JobService {
  private readonly jobs = signal<Job[]>([...INITIAL_JOBS]);
  private readonly currentJob = signal<Job | null>(null);
  private jobCounter = INITIAL_JOBS.length + 1;

  readonly jobsList = computed(() => this.jobs());
  readonly activeJob = computed(() => this.currentJob());

  getJobs(): Job[] {
    return this.jobs();
  }

  getJobById(id: string): Job | undefined {
    return this.jobs().find((j) => j.id === id);
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
  }

  createJob(selectedServices: string[]): Job {
    const id = `JOB-${String(this.jobCounter++).padStart(4, '0')}`;
    const job = createProcessingJob(id, selectedServices);
    this.jobs.update((list) => [job, ...list]);
    this.currentJob.set(job);
    return job;
  }

  updateJob(updated: Job): void {
    this.jobs.update((list) =>
      list.map((j) => (j.id === updated.id ? { ...updated } : j))
    );
    if (this.currentJob()?.id === updated.id) {
      this.currentJob.set({ ...updated });
    }
  }

  completeJob(jobId: string): Job | undefined {
    const job = this.getJobById(jobId);
    if (!job) return undefined;
    const completed = applyCompletedResults(job);
    this.updateJob(completed);
    return completed;
  }
}
