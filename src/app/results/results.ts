import {
  ChangeDetectorRef,
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
import { applyCompletedResults, buildServiceProgress } from '../core/data/job-data';
import {
  firstSelectedPipelinePhase,
  PIPELINE_SERVICE_PHASE,
  SERVICE_PROGRESS_CAP,
} from '../core/utils/pipeline-progress.util';

// ── NEW: SSE service ──────────────────────────────────────────────────────────
import {
  PipelineSseService,
  PipelineState,
  TerminalEntry,
} from '../core/services/Pipeline-sse.service';

type ViewMode = 'empty' | 'processing' | 'completed';

@Component({
  selector: 'app-results',
  imports: [DecimalPipe, CommonModule, Hyperlinking, Consistency, Translation, RouterModule],
  templateUrl: './results.html',
  styleUrl: './results.css',
})
export class Results implements OnInit, OnDestroy {
  private readonly jobService = inject(JobService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly pipeline = inject(PipelineSseService);

  viewMode: ViewMode = 'empty';
  job: Job | null = null;

  activeTab: 'Hyperlinking' | 'Translation' | 'Consistency' = 'Hyperlinking';
  showServiceProgress = true;
  selectedHitlIndex = 0;
  private lastHitlSeqNo: number | null = null;
  /** Animated placeholder progress while pipeline runs (UI only). */
  private dummyProgress = 0;
  /** Per-service slow progress during live SSE runs (UI only). */
  private serviceDummyProgress: Record<string, number> = {};
  private dummyProgressInterval: ReturnType<typeof setInterval> | null = null;
  private static readonly DUMMY_TICK_MS = 200;
  // ── Live SSE state (replaces simulation) ───────────────────────────────────
  pipelineState: PipelineState | null = null;

  // ── Preview / demo data (used when no real job is running) ─────────────────
  private readonly previewStats = {
    totalLinks: 1413,
    linked: 989,
    broken: 396,
    missing: 170,
  };

  private readonly previewModules: ModuleDistribution = {
    M1: 380,
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
    llm_advisor_judgment:''
    
  };

  // ── Kept for non-SSE simulation fallback ───────────────────────────────────
  private progressInterval: ReturnType<typeof setInterval> | null = null;
  private simulatingJobId: string | null = null;

  // ────────────────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.refreshJobView();

    // Subscribe to live SSE state — updates happen whenever the stream pushes
    this.pipeline.state$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((state) => {
      const prevStatus = this.pipelineState?.status;
      const prevTaskId = this.pipelineState?.taskId;
      const prevHitlSeq = this.pipelineState?.activeHitl?.hitl_seq_no;
      const prevHistoryLen = this.pipelineState?.hitlHistory.length ?? 0;

      if (state.taskId && state.taskId !== prevTaskId) {
        this.serviceDummyProgress = {};
        this.dummyProgress = 0;
      }

      this.pipelineState = state;

      if (state.status === 'awaiting_hitl' && state.activeHitl) {
        const seq = state.activeHitl.hitl_seq_no;
        if (this.lastHitlSeqNo !== seq) {
          this.selectedHitlIndex = 0;
          this.lastHitlSeqNo = seq;
          this.toast.show(
            `Review required: ${state.activeHitl.unmapped_keyword_anchor}`,
          );
        }
        this.activeTab = 'Hyperlinking';
        this.viewMode = 'processing';
        this.startDummyProgress();
      } else if (state.status === 'running') {
        this.viewMode = 'processing';
        this.startDummyProgress();
        if (state.progressMilestone >= 100) {
          this.dummyProgress = 100;
          this.stopDummyProgress();
        }
      } else if (state.status === 'completed') {
        this.stopDummyProgress();
        this.dummyProgress = 100;
        this.viewMode = 'completed';
        this.lastHitlSeqNo = null;
        this.finalizeJobOnComplete();
        this.toast.show('Analysis completed successfully');
      } else if (state.status === 'error') {
        this.stopDummyProgress();
        this.toast.show(`Pipeline error: ${state.logs.at(-1) ?? 'Unknown error'}`);
      }

      const hitlArrived =
        state.status === 'awaiting_hitl' &&
        state.activeHitl &&
        (prevStatus !== 'awaiting_hitl' || prevHitlSeq !== state.activeHitl.hitl_seq_no);

      const historyGrew = state.hitlHistory.length > prevHistoryLen;

      if (hitlArrived || historyGrew) {
        this.cdr.detectChanges();
      } else {
        this.cdr.markForCheck();
      }
    });

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.refreshJobView();
        if (isPlatformBrowser(this.platformId)) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
  }

  ngOnDestroy(): void {
    this.stopSimulation();
    this.stopDummyProgress();
    // Do NOT call pipeline.reset() here — the stream should survive navigation
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  get jobId(): string {
    return this.pipelineState?.taskId ?? this.job?.id ?? '';
  }

  /** Overall % — slow UI animation during live SSE; simulation fallback otherwise. */
  get displayProgress(): number {
    if (this.viewMode === 'completed') return 100;
    if (this.viewMode !== 'processing') return 0;

    if (this.isLivePipeline) {
      return this.liveOverallProgress;
    }

    const job = this.job?.overallProgress ?? 0;
    return Math.round(Math.max(job, this.dummyProgress));
  }

  /** Scales hyperlink chart / stats reveal (0–100), lagged and stepped behind pipeline %. */
  get chartReveal(): number {
    if (this.viewMode === 'completed') return 100;
    const lagged = Math.min(this.displayProgress, 98) * 0.96;
    return Math.round(lagged);
  }

  get pipelineServices(): ServiceProgress[] {
    const services = this.job?.selectedServices ?? ['hyperlinking'];
    const completedRows = services.map(() => ({
      progress: 100,
      status: 'completed' as const,
    }));

    if (this.viewMode === 'completed') {
      return buildServiceProgress(services, completedRows);
    }

    if (this.viewMode === 'processing' && this.isLivePipeline) {
      return this.buildLiveServiceProgress(services);
    }

    const base =
      this.job?.serviceProgress?.length ?
        this.job.serviceProgress
      : buildServiceProgress(services);

    if (!this.job) {
      return this.advanceServices(buildServiceProgress(services), this.displayProgress);
    }

    if (this.viewMode === 'processing') {
      return this.advanceServices(base, this.displayProgress);
    }

    if (this.job.status === 'completed') {
      return buildServiceProgress(
        this.job.selectedServices,
        this.job.selectedServices.map(() => ({
          progress: 100,
          status: 'completed' as const,
        })),
      );
    }

    return base;
  }

  get pipelineStatusLabel(): string {
    if (this.pipelineState?.status === 'awaiting_hitl') return 'Awaiting Input';
    return this.viewMode === 'completed' ? 'Completed' : 'Processing';
  }

  get pipelineSubtitle(): string {
    const hitl = this.pipelineState?.activeHitl;
    if (this.pipelineState?.status === 'awaiting_hitl' && hitl) {
      return `Manual review required for: ${hitl.unmapped_keyword_anchor}`;
    }
    if (this.pipelineState?.currentFile) {
      return `Processing: ${this.pipelineState.currentFile}`;
    }
    return this.viewMode === 'completed'
      ? 'All selected services finished successfully'
      : 'Analyzing your submission across selected services';
  }

  get servicesLabel(): string {
    const count = this.job?.selectedServices.length ?? 0;
    return this.viewMode === 'processing'
      ? `${count} service${count !== 1 ? 's' : ''} running`
      : `${count} service${count !== 1 ? 's' : ''} completed`;
  }

  // ── HITL plumbing — maps SSE event onto the shape <app-hyperlinking> expects ─

  /**
   * hitlEvent fed into <app-hyperlinking [hitlEvent]>.
   * When a real SSE HITL prompt is active it takes priority;
   * otherwise falls back to the preview / job data.
   */
  get isLivePipeline(): boolean {
    return !!this.pipelineState?.taskId && this.pipelineState.status !== 'idle';
  }

  get hitlEvent(): {
    id: number;
    file: string;
    section: string;
    anchor: string;
    advice: string;
  } | null {
    const live = this.pipelineState?.activeHitl;
    if (live) {
      return {
        id: live.hitl_seq_no,
        file: live.source_document,
        section: live.unmapped_keyword_anchor,
        anchor: live.source_statement,
        advice: live.llm_advisor_judgment,
      };
    }

    // Never show demo HITL while a real SSE pipeline is active
    if (this.isLivePipeline) return null;

    const h = this.job?.hitl;
    if (!h) return null;

    return {
      id: h.id,
      file: h.file,
      section: h.section,
      anchor: h.statement,
      advice: h.llm_advisor_judgment ?? '',
    };
  }

  /**
   * hitlSuggestions fed into <app-hyperlinking [hitlSuggestions]>.
   * Maps SSE llm_recommendations → the shape the existing template already uses.
   */
  get hitlSuggestions() {
    const live = this.pipelineState?.activeHitl;
    if (live) {
      return live.llm_recommendations.map((r, i) => ({
        file: r.suggested_target_file,
        section: r.semantic_title_context,
        score: Math.round(100 - i * 12),
        recommended: i === 0,
        page: r.suggested_target_page,
      }));
    }
    if (this.isLivePipeline) return [];
    return this.job?.hitl?.suggestions ?? [];
  }

  get terminalEntries(): TerminalEntry[] {
    return this.pipelineState?.terminalEntries ?? [];
  }

  get pipelineStatus(): PipelineState['status'] {
    return this.pipelineState?.status ?? 'idle';
  }

  get pipelineCurrentFile(): string | null {
    return this.pipelineState?.currentFile ?? null;
  }

  get pipelineFileProgress(): { index: number; total: number } | null {
    const state = this.pipelineState;
    if (!state?.totalFiles) return null;
    const index = state.currentFileIndex || state.completedFiles || 1;
    return { index: Math.min(index, state.totalFiles), total: state.totalFiles };
  }

  get autoResolvedCount(): number {
    return this.pipelineState?.autoResolvedCount ?? 0;
  }

  get hitlHistory() {
    return this.pipelineState?.hitlHistory ?? [];
  }

  /** Finished reviews only — each appears in the table right after submit/skip. */
  get completedHitlHistory() {
    return this.hitlHistory.filter((r) => r.status !== 'pending');
  }

  get resolvedRefs() {
    if (this.viewMode === 'processing') return [];
    return this.job?.resolvedRefs ?? [];
  }

  get stats() {
    if (this.viewMode === 'processing' || this.viewMode === 'completed') {
      return this.job?.stats ?? this.previewStats;
    }
    return this.job?.stats;
  }

  get moduleDistribution(): ModuleDistribution | undefined {
    if (this.viewMode === 'processing' || this.viewMode === 'completed') {
      return this.job?.moduleDistribution ?? this.previewModules;
    }
    return this.job?.moduleDistribution;
  }

  // ── Active HITL indicator (used in template to show/hide the terminal) ──────
  get hasLiveHitl(): boolean {
    return this.pipelineState?.status === 'awaiting_hitl' && !!this.pipelineState.activeHitl;
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  setTab(t: 'Hyperlinking' | 'Translation' | 'Consistency'): void {
    this.activeTab = t;
    this.cdr.markForCheck();
  }

  onHitlIndexChange(index: number): void {
    this.selectedHitlIndex = index;
    this.cdr.markForCheck();
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

  /**
   * confirmHITL — called by (confirmSelection) output from <app-hyperlinking>.
   * If a live SSE HITL prompt is active, submit to the backend;
   * otherwise fall through to the original job-service path.
   */
  confirmHITL(): void {
    const live = this.pipelineState?.activeHitl;

    if (live) {
      const seq = live.hitl_seq_no;
      if (this.selectedHitlIndex < 0) {
        this.pipeline.skipHitl(seq);
        this.cdr.markForCheck();
        return;
      }
      const rec = live.llm_recommendations[this.selectedHitlIndex];
      if (rec) {
        this.pipeline.submitHitl(
          rec.suggested_target_file,
          rec.suggested_target_page,
          seq,
          this.selectedHitlIndex,
        );
      } else {
        this.pipeline.skipHitl(seq);
      }
      this.cdr.markForCheck();
      return;
    }

    const job = this.job;
    const hitl = job?.hitl;
    if (!hitl || !job) return;

    hitl.selectedIndex = this.selectedHitlIndex;
    hitl.confirmed = true;

    this.jobService.updateJob({ ...job, hitl: { ...hitl } });
  }
  skipHITL(): void {
    const seq = this.pipelineState?.activeHitl?.hitl_seq_no;
    if (seq != null) this.pipeline.skipHitl(seq);
    this.cdr.markForCheck();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private refreshJobView(): void {
    const job = this.jobService.activeJob() ?? this.jobService.getLastJob() ?? null;
    if (job) this.jobService.setCurrentJob(job);
    this.applyJob(job);
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

    // If a real SSE pipeline is running, let pipelineState drive viewMode
    if (this.pipelineState && this.pipelineState.status !== 'idle' && this.pipelineState.taskId) {
      return;
    }

    if (job.status === 'completed') {
      this.viewMode = 'completed';
      return;
    }

    this.viewMode = 'processing';
    this.startDummyProgress();
    this.startSimulation(job);
  }

  private startSimulation(job: Job): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.simulatingJobId === job.id && this.progressInterval) return;

    this.stopSimulation();
    this.simulatingJobId = job.id;
    this.progressInterval = setInterval(() => {
      if (!this.job || this.job.id !== job.id) return;

      // Don't simulate if a real SSE pipeline is active
      if (this.pipelineState && this.pipelineState.status !== 'idle') {
        this.stopSimulation();
        return;
      }

      const nextProgress = Math.min(
        this.job.overallProgress + 0.7 + Math.random() * 0.9,
        100,
      );
      const updatedServices = this.advanceServices(this.job.serviceProgress ?? [], nextProgress);
      const patch: Job = {
        ...this.job,
        overallProgress: nextProgress,
        serviceProgress: updatedServices,
      };

      this.job = patch;
      this.jobService.updateJob(patch);

      if (nextProgress >= 100) this.finishSimulation(job.id);
    }, 170);
  }

  private advanceServices(services: ServiceProgress[], overall: number): ServiceProgress[] {
    if (!services.length) return services;
    const slice = 100 / services.length;
    return services.map((svc, index) => {
      const start = index * slice;
      const end = (index + 1) * slice;
      if (overall >= end) return { ...svc, progress: 100, status: 'completed' };
      if (overall > start + slice * 0.15) {
        const local = ((overall - start) / slice) * 100;
        return { ...svc, progress: Math.round(Math.min(local, 99)), status: 'processing' };
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
      this.stopDummyProgress();
      this.dummyProgress = 100;
      this.toast.show('Analysis completed successfully');
    }
  }

  /** Persist demo/completed outputs when SSE finishes before simulation does. */
  private finalizeJobOnComplete(): void {
    const current = this.job ?? this.jobService.activeJob() ?? this.jobService.getLastJob();
    if (!current) return;

    const completed =
      current.status === 'completed' ? current : applyCompletedResults(current);
    this.job = completed;
    this.jobService.updateJob(completed);
  }

  private stopSimulation(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    this.simulatingJobId = null;
  }

  /** Average of per-service UI progress — drives the overall bar during live SSE. */
  private get liveOverallProgress(): number {
    const selected = this.job?.selectedServices ?? ['hyperlinking'];
    if (!selected.length) return 0;

    const total = selected.reduce(
      (sum, id) => sum + (this.serviceDummyProgress[id] ?? 0),
      0,
    );
    return Math.round(total / selected.length);
  }

  private effectivePipelinePhase(selected: string[]): number {
    const current = this.pipelineState?.currentPhase ?? 0;
    return current > 0 ? current : firstSelectedPipelinePhase(selected);
  }

  private buildLiveServiceProgress(serviceIds: string[]): ServiceProgress[] {
    const activePhase = this.effectivePipelinePhase(serviceIds);

    return buildServiceProgress(
      serviceIds,
      serviceIds.map((id) => {
        const phase = PIPELINE_SERVICE_PHASE[id];
        if (phase == null) {
          return { progress: 0, status: 'waiting' as const };
        }

        if (phase > activePhase) {
          return { progress: 0, status: 'waiting' as const };
        }

        return {
          progress: Math.round(this.serviceDummyProgress[id] ?? 0),
          status: 'processing' as const,
        };
      }),
    );
  }

  private tickLiveServiceProgress(): void {
    const selected = this.job?.selectedServices ?? ['hyperlinking'];
    const activePhase = this.effectivePipelinePhase(selected);
    let changed = false;

    for (const id of selected) {
      const phase = PIPELINE_SERVICE_PHASE[id];
      if (phase == null || phase > activePhase) continue;

      const current = this.serviceDummyProgress[id] ?? 0;
      if (current >= SERVICE_PROGRESS_CAP) continue;

      const bump =
        current < 25 ? 0.28
        : current < 50 ? 0.18
        : current < 75 ? 0.12
        : 0.06;
      this.serviceDummyProgress[id] = Math.min(
        current + bump + Math.random() * 0.08,
        SERVICE_PROGRESS_CAP,
      );
      changed = true;
    }

    if (changed) {
      this.cdr.markForCheck();
    }
  }

  private startDummyProgress(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.dummyProgressInterval) return;

    this.dummyProgressInterval = setInterval(() => {
      if (this.viewMode !== 'processing') {
        this.stopDummyProgress();
        return;
      }

      if (this.isLivePipeline) {
        this.tickLiveServiceProgress();
        return;
      }

      const cap = 96;
      if (this.dummyProgress >= cap) return;

      const bump =
        this.dummyProgress < 30 ? 0.85
        : this.dummyProgress < 60 ? 0.55
        : 0.3;
      this.dummyProgress = Math.min(this.dummyProgress + bump + Math.random() * 0.4, cap);
      this.cdr.markForCheck();
    }, Results.DUMMY_TICK_MS);
  }

  private stopDummyProgress(): void {
    if (this.dummyProgressInterval) {
      clearInterval(this.dummyProgressInterval);
      this.dummyProgressInterval = null;
    }
    if (this.viewMode !== 'processing') {
      this.dummyProgress = 0;
      this.serviceDummyProgress = {};
    }
  }

  formatServices(ids: string[]): string {
    return ids.map((id) => SERVICE_META[id]?.name ?? id).join(', ');
  }
}
