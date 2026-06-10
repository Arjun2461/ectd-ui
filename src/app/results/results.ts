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
import {
  applyCompletedResults,
  buildServiceProgress,
  DEFAULT_MODULE_DISTRIBUTION,
  normalizeModuleDistribution,
} from '../core/data/job-data';
import {
  CONSISTENCY_HYPERLINK_LAG_PCT,
  HYPERLINKING_COMPLETION_PROGRESS,
  OVERALL_PROGRESS_CAP,
  PROGRESS_RAMP_DURATION_MS,
  progressRampEase,
  serviceProgressCap,
  serviceProgressMultiplier,
  TRANSLATION_WAITS_FOR,
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
  private pipelineRampStartedAt: number | null = null;
  private translationRampStartedAt: number | null = null;
  private dummyProgressInterval: ReturnType<typeof setInterval> | null = null;
  private static readonly PROGRESS_TICK_MS = 250;
  // ── Live SSE state (replaces simulation) ───────────────────────────────────
  pipelineState: PipelineState | null = null;

  // ── Preview / demo data (used when no real job is running) ─────────────────
  private readonly previewStats = {
    totalLinks: 109,
    linked: 76,
    broken: 31,
    missing: 2,
  };

  private readonly previewModules: ModuleDistribution = { ...DEFAULT_MODULE_DISTRIBUTION };

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
        this.resetProgressRamp();
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
        this.snapAllServicesComplete();
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

  /** Scales hyperlink chart / stats reveal (0–100) with the overall pipeline %. */
  get chartReveal(): number {
    if (this.viewMode === 'completed') return 100;
    return Math.round(Math.min(this.displayProgress, OVERALL_PROGRESS_CAP));
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

    if (this.viewMode === 'processing') {
      return this.buildServiceProgressFromRamp(services);
    }

    const job = this.job;
    if (!job) {
      return buildServiceProgress(services);
    }

    if (job.status === 'completed') {
      return buildServiceProgress(
        job.selectedServices,
        job.selectedServices.map(() => ({
          progress: 100,
          status: 'completed' as const,
        })),
      );
    }

    return job.serviceProgress?.length ? job.serviceProgress : buildServiceProgress(services);
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

  get moduleDistribution(): ModuleDistribution {
    const fallback = this.previewModules;
    if (this.viewMode === 'processing' || this.viewMode === 'completed') {
      return normalizeModuleDistribution(this.job?.moduleDistribution, fallback);
    }
    return normalizeModuleDistribution(this.job?.moduleDistribution, fallback);
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
    this.resetProgressRamp();
    this.progressInterval = setInterval(() => {
      if (!this.job || this.job.id !== job.id) return;

      if (this.pipelineState && this.pipelineState.status !== 'idle') {
        this.stopSimulation();
        return;
      }

      const rampT = this.currentRampT();
      if (rampT >= 1 && this.dummyProgress >= OVERALL_PROGRESS_CAP - 1) {
        this.finishSimulation(job.id);
        return;
      }

      const patch: Job = {
        ...this.job,
        overallProgress: this.dummyProgress,
        serviceProgress: this.buildServiceProgressFromRamp(this.job.selectedServices),
      };
      this.job = patch;
      this.jobService.updateJob(patch);
    }, Results.PROGRESS_TICK_MS);
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

  /** Average of active service UI progress — drives the overall bar during live SSE. */
  private get liveOverallProgress(): number {
    const active = this.activeProgressServiceIds();
    if (!active.length) return 0;

    const total = active.reduce((sum, id) => sum + (this.serviceDummyProgress[id] ?? 0), 0);
    return Math.min(Math.round(total / active.length), OVERALL_PROGRESS_CAP);
  }

  private activeProgressServiceIds(): string[] {
    const selected = this.job?.selectedServices ?? ['hyperlinking'];
    return selected.filter((id) => {
      if (id === 'translation' && !this.isHyperlinkingUiComplete(selected)) {
        return false;
      }
      return true;
    });
  }

  private isHyperlinkingUiComplete(selected: string[]): boolean {
    if (!selected.includes(TRANSLATION_WAITS_FOR)) {
      return true;
    }

    if (this.pipelineState?.completedServiceIds.includes(TRANSLATION_WAITS_FOR)) {
      return true;
    }

    return (
      (this.serviceDummyProgress[TRANSLATION_WAITS_FOR] ?? 0) >=
      HYPERLINKING_COMPLETION_PROGRESS - 0.5
    );
  }

  private currentRampT(): number {
    if (!this.pipelineRampStartedAt) return 0;
    return (Date.now() - this.pipelineRampStartedAt) / PROGRESS_RAMP_DURATION_MS;
  }

  private currentTranslationRampT(): number {
    if (!this.translationRampStartedAt) return 0;
    return (Date.now() - this.translationRampStartedAt) / PROGRESS_RAMP_DURATION_MS;
  }

  private hyperlinkingTarget(rampT: number): number {
    const eased = progressRampEase(rampT) * HYPERLINKING_COMPLETION_PROGRESS;
    const scaled = eased * serviceProgressMultiplier('hyperlinking');
    return Math.min(Math.round(scaled), HYPERLINKING_COMPLETION_PROGRESS);
  }

  private targetServiceProgress(serviceId: string, rampT: number): number {
    if (serviceId === 'hyperlinking') {
      return this.hyperlinkingTarget(rampT);
    }

    if (serviceId === 'consistency') {
      const hyper = this.hyperlinkingTarget(rampT);
      const lagged = Math.max(0, hyper - CONSISTENCY_HYPERLINK_LAG_PCT);
      return Math.min(lagged, serviceProgressCap('consistency'));
    }

    if (serviceId === 'translation') {
      const translationRampT = this.currentTranslationRampT();
      const eased = progressRampEase(translationRampT) * OVERALL_PROGRESS_CAP;
      const scaled = eased * serviceProgressMultiplier('translation');
      return Math.min(Math.round(scaled), serviceProgressCap('translation'));
    }

    const eased = progressRampEase(rampT) * OVERALL_PROGRESS_CAP;
    return Math.min(Math.round(eased), serviceProgressCap(serviceId));
  }

  private buildServiceProgressFromRamp(serviceIds: string[]): ServiceProgress[] {
    if (this.pipelineState?.status === 'completed' || this.viewMode === 'completed') {
      return buildServiceProgress(
        serviceIds,
        serviceIds.map(() => ({ progress: 100, status: 'completed' as const })),
      );
    }

    const pipelineActive =
      this.pipelineState?.status === 'running' ||
      this.pipelineState?.status === 'awaiting_hitl' ||
      this.viewMode === 'processing';

    const hyperlinkDone = this.isHyperlinkingUiComplete(serviceIds);

    return buildServiceProgress(
      serviceIds,
      serviceIds.map((id) => {
        const progress = Math.round(this.serviceDummyProgress[id] ?? 0);
        if (progress >= 100) {
          return { progress: 100, status: 'completed' as const };
        }
        if (
          id === TRANSLATION_WAITS_FOR &&
          hyperlinkDone &&
          progress >= HYPERLINKING_COMPLETION_PROGRESS
        ) {
          return { progress: HYPERLINKING_COMPLETION_PROGRESS, status: 'completed' as const };
        }
        if (
          id === 'translation' &&
          serviceIds.includes(TRANSLATION_WAITS_FOR) &&
          !hyperlinkDone
        ) {
          return { progress: 0, status: 'waiting' as const };
        }
        if (
          id === 'consistency' ||
          id === 'hyperlinking' ||
          (id === 'translation' && hyperlinkDone)
        ) {
          if (pipelineActive || progress > 0) {
            return { progress, status: 'processing' as const };
          }
        }
        if (pipelineActive || progress > 0) {
          return { progress, status: 'processing' as const };
        }
        return { progress: 0, status: 'waiting' as const };
      }),
    );
  }

  private tickProgressRamp(): void {
    const selected = this.job?.selectedServices ?? ['hyperlinking'];
    if (!selected.length) return;

    if (!this.pipelineRampStartedAt) {
      this.pipelineRampStartedAt = Date.now();
    }

    if (
      selected.includes('translation') &&
      selected.includes(TRANSLATION_WAITS_FOR) &&
      this.isHyperlinkingUiComplete(selected) &&
      !this.translationRampStartedAt
    ) {
      this.translationRampStartedAt = Date.now();
    }

    const rampT = this.currentRampT();
    let changed = false;

    for (const id of selected) {
      if (
        id === 'translation' &&
        selected.includes(TRANSLATION_WAITS_FOR) &&
        !this.isHyperlinkingUiComplete(selected)
      ) {
        continue;
      }

      const target = this.targetServiceProgress(id, rampT);
      const current = this.serviceDummyProgress[id] ?? 0;
      if (Math.abs(target - current) < 0.25) continue;

      const step = Math.max(0.06, (target - current) * 0.18);
      this.serviceDummyProgress[id] = Math.min(current + step, serviceProgressCap(id));
      changed = true;
    }

    const active = this.activeProgressServiceIds();
    const avg =
      active.reduce((sum, id) => sum + (this.serviceDummyProgress[id] ?? 0), 0) /
      active.length;
    const nextOverall = Math.min(Math.round(avg), OVERALL_PROGRESS_CAP);
    if (nextOverall !== this.dummyProgress) {
      this.dummyProgress = nextOverall;
      changed = true;
    }

    if (changed) {
      this.cdr.markForCheck();
    }
  }

  private resetProgressRamp(): void {
    this.serviceDummyProgress = {};
    this.dummyProgress = 0;
    this.pipelineRampStartedAt = null;
    this.translationRampStartedAt = null;
  }

  private snapAllServicesComplete(): void {
    const services = this.job?.selectedServices ?? this.pipelineState?.selectedServices ?? [];
    for (const id of services) {
      this.serviceDummyProgress[id] = 100;
    }
  }

  private startDummyProgress(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.dummyProgressInterval) return;

    if (!this.pipelineRampStartedAt) {
      this.pipelineRampStartedAt = Date.now();
    }

    this.dummyProgressInterval = setInterval(() => {
      if (this.viewMode !== 'processing') {
        this.stopDummyProgress();
        return;
      }

      this.tickProgressRamp();
    }, Results.PROGRESS_TICK_MS);
  }

  private stopDummyProgress(): void {
    if (this.dummyProgressInterval) {
      clearInterval(this.dummyProgressInterval);
      this.dummyProgressInterval = null;
    }
    if (this.viewMode !== 'processing') {
      this.resetProgressRamp();
    }
  }

  formatServices(ids: string[]): string {
    return ids.map((id) => SERVICE_META[id]?.name ?? id).join(', ');
  }
}
