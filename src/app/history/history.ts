import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { JobService } from '../core/services/job.service';
import {
  Job,
  ModuleDistribution,
  SERVICE_META,
} from '../core/models/job.types';

@Component({
  selector: 'app-history',
  imports: [],
  templateUrl: './history.html',
  styleUrl: './history.css',
})
export class History {
  private readonly jobService = inject(JobService);
  private readonly router = inject(Router);

  readonly searchQuery = signal('');

  readonly jobs = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.jobService.getJobs();
    if (!q) return list;
    return list.filter((job) => {
      const services = this.formatServices(job.selectedServices).toLowerCase();
      const modules = this.getJobModules(job).join(' ').toLowerCase();
      return (
        job.id.toLowerCase().includes(q) ||
        services.includes(q) ||
        modules.includes(q)
      );
    });
  });

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
  }

  formatServices(ids: string[]): string {
    return ids.map((id) => SERVICE_META[id]?.name ?? id).join(', ');
  }

  getJobModules(job: Job): string[] {
    if (job.modules?.length) return job.modules;
    const dist = job.moduleDistribution;
    if (!dist) return [];
    return (Object.keys(dist) as (keyof ModuleDistribution)[]).filter(
      (key) => (dist[key] ?? 0) > 0
    );
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  getStatusLabel(status: string): string {
    if (status === 'completed') return 'Completed';
    if (status === 'processing') return 'Processing';
    return status;
  }

  viewJob(job: Job, event?: Event): void {
    event?.stopPropagation();
    this.jobService.setCurrentJob(job);
    this.router.navigate(['/results']);
  }
}
