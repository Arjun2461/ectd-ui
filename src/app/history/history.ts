import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { JobService } from '../core/services/job.service';
import {
  Job,
  ModuleDistribution,
  SERVICE_META,
} from '../core/models/job.types';

export type HistoryStatusFilter = 'all' | 'completed' | 'processing';

@Component({
  selector: 'app-history',
  imports: [RouterLink],
  templateUrl: './history.html',
  styleUrl: './history.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class History {
  private readonly jobService = inject(JobService);
  private readonly router = inject(Router);

  readonly searchQuery = signal('');
  readonly statusFilter = signal<HistoryStatusFilter>('all');

  readonly statusOptions: { id: HistoryStatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'completed', label: 'Completed' },
    { id: 'processing', label: 'In progress' },
  ];

  readonly allJobs = computed(() => this.jobService.getJobs());

  readonly jobs = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const status = this.statusFilter();
    let list = this.allJobs();

    if (status !== 'all') {
      list = list.filter((job) => job.status === status);
    }

    if (!q) return list;

    return list.filter((job) => {
      const services = this.formatServices(job.selectedServices).toLowerCase();
      const modules = this.getJobModules(job).join(' ').toLowerCase();
      const name = this.getJobName(job).toLowerCase();
      return (
        job.id.toLowerCase().includes(q) ||
        name.includes(q) ||
        (job.taskId?.toLowerCase().includes(q) ?? false) ||
        services.includes(q) ||
        modules.includes(q)
      );
    });
  });

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  setStatusFilter(filter: HistoryStatusFilter): void {
    this.statusFilter.set(filter);
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.statusFilter.set('all');
  }

  formatServices(ids: string[]): string {
    return ids.map((id) => this.getServiceName(id)).join(', ');
  }

  getServiceName(id: string): string {
    return SERVICE_META[id]?.name ?? id;
  }

  /** Display name for the Name column (second column). */
  getJobName(job: Job): string {
    const mods = this.getJobModules(job);
    if (mods.length >= 2) {
      return `${mods[0]}–${mods[mods.length - 1]} Submission`;
    }
    if (mods.length === 1) {
      return `${mods[0]} Submission`;
    }

    const names = job.selectedServices.map((id) => this.getServiceName(id));
    if (names.length === 1) {
      return job.targetLanguage ?
          `${names[0]} (${job.targetLanguage})`
        : names[0];
    }
    if (names.length > 1) {
      return names.join(' + ');
    }
    return 'Submission';
  }

  getJobModules(job: Job): string[] {
    if (job.modules?.length) return job.modules;
    const dist = job.moduleDistribution;
    if (!dist) return [];
    return (Object.keys(dist) as (keyof ModuleDistribution)[]).filter(
      (key) => (dist[key] ?? 0) > 0,
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
    if (status === 'processing') return 'In progress';
    return status;
  }

  viewJob(job: Job, event?: Event): void {
    event?.stopPropagation();
    this.jobService.setCurrentJob(job);
    void this.router.navigate(['/results']);
  }
}
