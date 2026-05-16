import {
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Hyperlinking } from './hyperlinking/hyperlinking';
import { Consistency } from './consistency/consistency';
import { Translation } from './translation/translation';
import { JobService } from '../core/services/job.service';
import { ToastService } from '../core/services/toast.service';
import {
  HitlData,
  Job,
  ModuleDistribution,
  SERVICE_META,
  ServiceProgress,
} from '../core/models/job.types';
import { buildServiceProgress } from '../core/data/job-data';

type ViewMode = 'empty' | 'processing' | 'completed';

@Component({
  selector: 'app-results',
  imports: [
    DecimalPipe,
    CommonModule,
    Hyperlinking,
    Consistency,
    Translation,
    RouterModule,
  ],
  templateUrl: './results.html',
  styleUrl: './results.css',
})
export class Results implements OnInit, OnDestroy {
  private readonly jobService = inject(JobService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  viewMode: ViewMode = 'empty';
  job: Job | null = null;

  activeTab: 'Hyperlinking' | 'Translation' | 'Consistency' = 'Hyperlinking';
  showServiceProgress = true;
  chartReveal = 0;

  private readonly previewStats = {
    totalLinks: 1413,
    linked: 1284,
    broken: 47,
    missing: 82,
  };

  private readonly previewModules: ModuleDistribution = {
    M2: 420,
    M3: 310,
    M4: 268,
    M5: 415,
  };

  private readonly previewHitl: HitlData = {
    id: 1,
    file: 'M2.5-clinical-overview.pdf',
    section: '§2.4 – Efficacy Conclusions',
    statement: 'study rpt 205.pdf#sec3',
    selectedIndex: 0,
    suggestions: [
      { file: 'M2.7.4-clinical-summary.pdf', section: '§3.2.1', score: 96, recommended: true },
      { file: 'M2.7.3-clinical-overview.pdf', section: '§4.1', score: 81 },
      { file: 'M5.3.5.1-study-report.pdf', section: '§7.2.4', score: 64 },
    ],
  };

  private progressInterval: ReturnType<typeof setInterval> | null = null;
  private simulatingJobId: string | null = null;

  ngOnInit(): void {
    this.refreshJobView();

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.refreshJobView());
  }

  private refreshJobView(): void {
    const job =
      this.jobService.activeJob() ?? this.jobService.getLastJob() ?? null;
    if (job) {
      this.jobService.setCurrentJob(job);
    }
    this.applyJob(job);
  }

  ngOnDestroy(): void {
    this.stopSimulation();
  }

  get jobId(): string {
    return this.job?.id ?? '';
  }

  get progress(): number {
    return this.job?.overallProgress ?? 0;
  }

  get pipelineServices(): ServiceProgress[] {
    if (!this.job) return [];

    if (this.job.serviceProgress?.length) {
      return this.job.serviceProgress;
    }

    if (this.job.status === 'completed') {
      return buildServiceProgress(
        this.job.selectedServices,
        this.job.selectedServices.map(() => ({
          progress: 100,
          status: 'completed' as const,
        }))
      );
    }

    return buildServiceProgress(this.job.selectedServices);
  }

  get pipelineStatusLabel(): string {
    return this.viewMode === 'completed' ? 'Completed' : 'Processing';
  }

  get pipelineSubtitle(): string {
    return this.viewMode === 'completed'
      ? 'All selected services finished successfully'
      : 'Analyzing your submission across selected services';
  }

  get servicesLabel(): string {
    const count = this.job?.selectedServices.length ?? 0;
    if (this.viewMode === 'processing') {
      return `${count} service${count !== 1 ? 's' : ''} running`;
    }
    return `${count} service${count !== 1 ? 's' : ''} completed`;
  }

  get hitlEvent(): {
    id: number;
    file: string;
    section: string;
    anchor: string;
    selected: number;
    confirmed: boolean;
  } {
    const h =
      this.job?.hitl ??
      (this.viewMode === 'processing' && this.progress > 55
        ? this.previewHitl
        : null);
    if (!h) {
      return {
        id: 0,
        file: '',
        section: '',
        anchor: '',
        selected: 0,
        confirmed: false,
      };
    }
    return {
      id: h.id,
      file: h.file,
      section: h.section,
      anchor: h.statement,
      selected: h.selectedIndex,
      confirmed: h.confirmed ?? false,
    };
  }

  get hitlSuggestions() {
    return (
      this.job?.hitl?.suggestions ??
      (this.progress > 55 ? this.previewHitl.suggestions : [])
    );
  }

  get resolvedRefs() {
    if (this.viewMode === 'processing') return [];
    return this.job?.resolvedRefs ?? [];
  }

  get stats() {
    return (
      this.job?.stats ??
      (this.viewMode === 'processing' ? this.previewStats : undefined)
    );
  }

  get moduleDistribution(): ModuleDistribution | undefined {
    return (
      this.job?.moduleDistribution ??
      (this.viewMode === 'processing' ? this.previewModules : undefined)
    );
  }

  setTab(t: 'Hyperlinking' | 'Translation' | 'Consistency'): void {
    this.activeTab = t;
  }

  statusLabel(status: string): string {
    if (status === 'processing') return 'Processing';
    if (status === 'completed') return 'completed';
    if (status === 'waiting') return 'waiting';
    return status;
  }

  statusClass(status: string): string {
    if (status === 'processing') return 'run';
    if (status === 'completed') return 'done';
    return 'wait';
  }

  confirmHITL(): void {
    const job = this.job;
    const hitl = job?.hitl;
    if (!hitl || !job) return;
    hitl.selectedIndex = this.hitlEvent.selected;
    hitl.confirmed = true;
    this.jobService.updateJob({ ...job, hitl: { ...hitl } });
  }

  private setDefaultTab(job: Job): void {
    const first = job.selectedServices[0];
    if (first === 'consistency') this.activeTab = 'Consistency';
    else if (first === 'translation') this.activeTab = 'Translation';
    else this.activeTab = 'Hyperlinking';
  }

  private applyJob(job: Job | null): void {
    this.stopSimulation();
    this.job = job;
    if (!job) {
      this.viewMode = 'empty';
      return;
    }

    this.setDefaultTab(job);

    if (job.status === 'completed') {
      this.viewMode = 'completed';
      this.chartReveal = 100;
      return;
    }

    this.viewMode = 'processing';
    this.chartReveal = Math.min(job.overallProgress, 98);
    this.startSimulation(job);
  }

  private startSimulation(job: Job): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.simulatingJobId === job.id && this.progressInterval) return;

    this.stopSimulation();
    this.simulatingJobId = job.id;
    this.progressInterval = setInterval(() => {
      if (!this.job || this.job.id !== job.id) return;

      const nextProgress = Math.min(
        this.job.overallProgress + 0.55 + Math.random() * 0.9,
        100
      );
      const updatedServices = this.advanceServices(
        this.job.serviceProgress ?? [],
        nextProgress
      );
      const patch: Job = {
        ...this.job,
        overallProgress: nextProgress,
        serviceProgress: updatedServices,
      };

      this.job = patch;
      this.chartReveal = Math.min(nextProgress, 98);
      this.jobService.updateJob(patch);

      if (nextProgress >= 100) {
        this.finishSimulation(job.id);
      }
    }, 140);
  }

  private advanceServices(
    services: ServiceProgress[],
    overall: number
  ): ServiceProgress[] {
    if (!services.length) return services;

    const slice = 100 / services.length;
    return services.map((svc, index) => {
      const start = index * slice;
      const end = (index + 1) * slice;

      if (overall >= end) {
        return { ...svc, progress: 100, status: 'completed' };
      }
      if (overall > start + slice * 0.15) {
        const local = ((overall - start) / slice) * 100;
        return {
          ...svc,
          progress: Math.round(Math.min(local, 99)),
          status: 'processing',
        };
      }
      return { ...svc, progress: 0, status: 'waiting' };
    });
  }

  private finishSimulation(jobId: string): void {
    this.stopSimulation();
    const completed = this.jobService.completeJob(jobId);
    if (completed) {
      this.job = completed;
      this.viewMode = 'completed';
      this.chartReveal = 100;
      this.toast.show('Analysis completed successfully');
    }
  }

  private stopSimulation(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    this.simulatingJobId = null;
  }

  formatServices(ids: string[]): string {
    return ids
      .map((id) => SERVICE_META[id]?.name ?? id)
      .join(', ');
  }
}
