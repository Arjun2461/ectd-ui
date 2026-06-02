import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DraftHistoryService } from '../core/services/draft-history.service';
import { JobService } from '../core/services/job.service';
import { HistoryListItem } from '../core/models/history.types';
import {
  Job,
  ModuleDistribution,
  SERVICE_META,
} from '../core/models/job.types';

export type HistoryStatusFilter = 'all' | 'completed' | 'processing';

const PAGE_SIZE = 5;

@Component({
  selector: 'app-history',
  imports: [RouterLink],
  templateUrl: './history.html',
  styleUrl: './history.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class History {
  private readonly jobService = inject(JobService);
  private readonly draftHistory = inject(DraftHistoryService);
  private readonly router = inject(Router);

  readonly pageSize = PAGE_SIZE;

  readonly searchQuery = signal('');
  readonly statusFilter = signal<HistoryStatusFilter>('all');
  readonly currentPage = signal(1);

  readonly statusOptions: { id: HistoryStatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'completed', label: 'Completed' },
    { id: 'processing', label: 'In progress' },
  ];

  readonly allItems = computed(() => this.buildHistoryItems());

  readonly filteredItems = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const status = this.statusFilter();
    let list = this.allItems();

    if (status !== 'all') {
      list = list.filter((item) => item.status === status);
    }

    if (!q) return list;

    return list.filter((item) => {
      const modules = item.modules.join(' ').toLowerCase();
      const name = this.getItemName(item).toLowerCase();
      return (
        item.id.toLowerCase().includes(q) ||
        name.includes(q) ||
        item.servicesLabel.toLowerCase().includes(q) ||
        item.typeLabel.toLowerCase().includes(q) ||
        modules.includes(q)
      );
    });
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredItems().length / PAGE_SIZE)),
  );

  readonly pagedItems = computed(() => {
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * PAGE_SIZE;
    return this.filteredItems().slice(start, start + PAGE_SIZE);
  });

  readonly paginationSummary = computed(() => {
    const total = this.filteredItems().length;
    if (total === 0) return '0 submissions';
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, total);
    return `Showing ${start}–${end} of ${total}`;
  });

  readonly pageNumbers = computed(() =>
    Array.from({ length: this.totalPages() }, (_, i) => i + 1),
  );

  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.currentPage.set(1);
  }

  setStatusFilter(filter: HistoryStatusFilter): void {
    this.statusFilter.set(filter);
    this.currentPage.set(1);
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.statusFilter.set('all');
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    const safe = Math.max(1, Math.min(page, this.totalPages()));
    this.currentPage.set(safe);
  }

  prevPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  formatServices(ids: string[]): string {
    return ids.map((id) => this.getServiceName(id)).join(', ');
  }

  getServiceName(id: string): string {
    return SERVICE_META[id]?.name ?? id;
  }

  getItemName(item: HistoryListItem): string {
    if (item.kind === 'draft') {
      const mods = item.modules;
      if (mods.length >= 2) {
        return `${mods[0]}–${mods[mods.length - 1]} summaries`;
      }
      if (mods.length === 1) {
        return `${mods[0]} summaries`;
      }
      return 'Summary generation';
    }
    return this.getJobName(item.job!);
  }

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

  getItemModules(item: HistoryListItem): string[] {
    return item.modules;
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

  isDraft(item: HistoryListItem): boolean {
    return item.kind === 'draft';
  }

  canDownload(item: HistoryListItem): boolean {
    return item.kind === 'draft' && item.status === 'completed';
  }

  downloadItem(item: HistoryListItem, event: Event): void {
    event.stopPropagation();
    if (!this.canDownload(item)) return;
    this.draftHistory.downloadOutputZip();
  }

  viewItem(item: HistoryListItem, event?: Event): void {
    event?.stopPropagation();
    if (item.kind === 'draft') {
      void this.router.navigate(['/upload'], {
        queryParams: { tab: 'generate-draft', draftId: item.id },
      });
      return;
    }
    this.jobService.setCurrentJob(item.job!);
    void this.router.navigate(['/results']);
  }

  private buildHistoryItems(): HistoryListItem[] {
    const jobs: HistoryListItem[] = this.jobService.getJobs().map((job) => ({
      kind: 'job' as const,
      id: job.id,
      status: job.status,
      createdAt: job.createdAt,
      modules: this.getJobModules(job),
      servicesLabel: this.formatServices(job.selectedServices),
      typeLabel: 'AI pipeline',
      job,
    }));

    const drafts: HistoryListItem[] = this.draftHistory.getDrafts().map(
      (draft) => ({
        kind: 'draft' as const,
        id: draft.id,
        status: draft.status,
        createdAt: draft.createdAt,
        modules: draft.sourceModules,
        servicesLabel: 'Generate draft',
        typeLabel: 'Summary generation',
        draft,
      }),
    );

    return [...jobs, ...drafts].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }
}
