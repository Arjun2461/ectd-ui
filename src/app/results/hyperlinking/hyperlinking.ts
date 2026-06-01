import {
  Component,
  Input,
  Output,
  EventEmitter,
  AfterViewInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  ElementRef,
  PLATFORM_ID,
  inject,
  ChangeDetectorRef,
} from '@angular/core';
import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js';
import { CommonModule, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { JobStats, ModuleDistribution } from '../../core/models/job.types';
import {
  TerminalEntry,
  PipelineState,
} from '../../core/services/Pipeline-sse.service';
import { HitlHistoryRecord } from '../../core/models/hitl-history.types';
import { HitlHistoryStorage } from '../../core/services/hitl-history.storage';

Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

export interface ModuleStat {
  name: string;
  value: number;
  percent: number;
}

export interface LinkBreakdownItem {
  label: string;
  count: number;
  tone: 'linked' | 'changed' | 'missing';
}

/** Shared palette — donut segments, legend dots, and module bars stay in sync */
const HYPER_CHART_COLORS = {
  linked: '#378ADD',
  changed: '#EF9F27',
  missing: '#E24B4A',
  linkedHover: '#2B6CB8',
  changedHover: '#D97706',
  missingHover: '#C53030',
} as const;

export interface HitlTerminalEvent {
  id: number;
  file: string;
  section: string;
  anchor: string;
  advice: string;
}

export interface HitlTerminalSuggestion {
  file: string;
  section: string;
  page?: number;
  score?: number;
  recommended?: boolean;
}

@Component({
  selector: 'app-hyperlinking',
  imports: [CommonModule, DecimalPipe],
  templateUrl: './hyperlinking.html',
  styleUrl: './hyperlinking.css',
})
export class Hyperlinking implements AfterViewInit, OnChanges, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly hitlStorage = inject(HitlHistoryStorage);

  @Input() selectedHitlIndex = 0;
  @Output() selectedHitlIndexChange = new EventEmitter<number>();

  @Input() hitlEvent: HitlTerminalEvent | null = null;
  @Input() hitlSuggestions: HitlTerminalSuggestion[] = [];
  @Input() awaitingHitl = false;
  @Input() terminalEntries: TerminalEntry[] = [];
  @Input() pipelineStatus: PipelineState['status'] = 'idle';
  @Input() currentFile: string | null = null;
  @Input() fileProgress: { index: number; total: number } | null = null;
  @Input() autoResolvedCount = 0;
  @Input() hitlHistory: HitlHistoryRecord[] = [];
  @Input() taskId = '';

  @Input() resolvedRefs: unknown[] = [];
  @Input() stats?: JobStats;
  @Input() moduleDistribution?: ModuleDistribution;
  @Input() chartReveal = 100;
  @Input() isProcessing = false;

  @Output() confirmSelection = new EventEmitter<void>();
  @Output() skipSelection = new EventEmitter<void>();

  @ViewChild('donutChart') donutRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('terminalScroll') terminalScrollRef?: ElementRef<HTMLDivElement>;

  chart: Chart | null = null;
  expandedIndex: number | null = null;
  expandedHitlIndex: number | null = null;

  /** Eased display value for stats / bars (lags behind chartReveal). */
  private smoothReveal = 0;
  private revealTickId: ReturnType<typeof setInterval> | null = null;
  private lastChartRevealUpdate = 0;

  /** When true, new log lines auto-scroll; false if user scrolled up to read history. */
  private stickToBottom = true;
  private static readonly SCROLL_STICK_THRESHOLD_PX = 56;

  private static readonly REVEAL_TICK_MS = 45;
  private static readonly REVEAL_EASE = 0.16;
  private static readonly CHART_ANIM_MS = 650;

  // ─── Pagination ───────────────────────────────────────────────────────────

  readonly PAGE_SIZE = 5;

  // HITL pagination
  private _hitlPage = 1;

  get hitlPage(): number {
    return this._hitlPage;
  }
  set hitlPage(val: number) {
    this._hitlPage = val;
    this.expandedHitlIndex = null; // collapse expanded row on page change
  }

  get hitlTotalPages(): number {
    return Math.ceil(this.hitlHistory.length / this.PAGE_SIZE) || 1;
  }
  get hitlPageStart(): number {
    return (this._hitlPage - 1) * this.PAGE_SIZE;
  }
  get hitlPageEnd(): number {
    return Math.min(this._hitlPage * this.PAGE_SIZE, this.hitlHistory.length);
  }
  get pagedHitlHistory(): HitlHistoryRecord[] {
    return this.hitlHistory.slice(this.hitlPageStart, this.hitlPageEnd);
  }
  get hitlPageNumbers(): number[] {
    return Array.from({ length: this.hitlTotalPages }, (_, i) => i + 1);
  }

  // Resolved pagination
  private _resolvedPage = 1;

  get resolvedPage(): number {
    return this._resolvedPage;
  }
  set resolvedPage(val: number) {
    this._resolvedPage = val;
    this.expandedIndex = null; // collapse expanded row on page change
  }

  get resolvedTotalPages(): number {
    return Math.ceil(this.resolvedRefs.length / this.PAGE_SIZE) || 1;
  }
  get resolvedPageStart(): number {
    return (this._resolvedPage - 1) * this.PAGE_SIZE;
  }
  get resolvedPageEnd(): number {
    return Math.min(this._resolvedPage * this.PAGE_SIZE, this.resolvedRefs.length);
  }
  get pagedResolvedRefs(): unknown[] {
    return this.resolvedRefs.slice(this.resolvedPageStart, this.resolvedPageEnd);
  }
  get resolvedPageNumbers(): number[] {
    return Array.from({ length: this.resolvedTotalPages }, (_, i) => i + 1);
  }

  // Reset pages when new data arrives — call these wherever arrays are updated
  resetHitlPage(): void {
    this._hitlPage = 1;
  }
  resetResolvedPage(): void {
    this._resolvedPage = 1;
  }

  // ─── Existing getters ─────────────────────────────────────────────────────

  get totalLinks(): number {
    return this.stats?.totalLinks ?? 0;
  }

  get showHitlPanel(): boolean {
    return this.awaitingHitl && !!this.hitlEvent?.id;
  }

  get showProcessingTerminal(): boolean {
    return this.isProcessing && !this.showHitlPanel;
  }

  get terminalTitle(): string {
    if (this.showHitlPanel) return 'Human-in-the-loop review';
    if (this.pipelineStatus === 'error') return 'Pipeline error';
    if (this.isProcessing) return 'Hyperlink pipeline';
    return 'Hyperlink terminal';
  }

  get statusBadge(): string {
    if (this.showHitlPanel) return 'Action required';
    if (this.pipelineStatus === 'error') return 'Error';
    if (this.isProcessing) return 'Running';
    if (this.pipelineStatus === 'completed') return 'Complete';
    return 'Ready';
  }

  get linkBreakdown(): LinkBreakdownItem[] {
    const s = this.stats;
    if (!s) {
      return [
        { label: 'Linked', count: 0, tone: 'linked' },
        { label: 'Changed', count: 0, tone: 'changed' },
        { label: 'Missing', count: 0, tone: 'missing' },
      ];
    }
    return [
      { label: 'Linked', count: this.scaled(s.linked), tone: 'linked' },
      { label: 'Changed', count: this.scaled(s.broken), tone: 'changed' },
      { label: 'Missing', count: this.scaled(s.missing), tone: 'missing' },
    ];
  }

  get moduleStats(): ModuleStat[] {
    const dist = this.moduleDistribution;
    if (!dist) {
      return [
        { name: 'M1', value: 0, percent: 0 },
        { name: 'M2', value: 0, percent: 0 },
        { name: 'M3', value: 0, percent: 0 },
        { name: 'M4', value: 0, percent: 0 },
        { name: 'M5', value: 0, percent: 0 },
      ];
    }

    const max = Math.max(dist.M1, dist.M2, dist.M3, dist.M4, dist.M5, 1);
    const factor = this.revealFactor;

    return [
      {
        name: 'M1',
        value: Math.round(dist.M1 * factor),
        percent: Math.round((dist.M1 / max) * 100 * factor),
      },
      {
        name: 'M2',
        value: Math.round(dist.M2 * factor),
        percent: Math.round((dist.M2 / max) * 100 * factor),
      },
      {
        name: 'M3',
        value: Math.round(dist.M3 * factor),
        percent: Math.round((dist.M3 / max) * 100 * factor),
      },
      {
        name: 'M4',
        value: Math.round(dist.M4 * factor),
        percent: Math.round((dist.M4 / max) * 100 * factor),
      },
      {
        name: 'M5',
        value: Math.round(dist.M5 * factor),
        percent: Math.round((dist.M5 / max) * 100 * factor),
      },
    ];
  }

  get displayTotal(): number {
    return Math.round(this.totalLinks * this.revealFactor);
  }

  private get revealFactor(): number {
    return Math.min(Math.max(this.smoothReveal / 100, 0), 1);
  }

  private scaled(value: number): number {
    return Math.round(value * this.revealFactor);
  }

  statPercent(count: number): string {
    if (!this.displayTotal) return '0.0';
    return ((count / this.displayTotal) * 100).toFixed(1);
  }

  entryIcon(kind: TerminalEntry['kind']): string {
    switch (kind) {
      case 'file_started':
        return 'ti-file-text';
      case 'auto_resolved':
        return 'ti-check';
      case 'hitl':
        return 'ti-alert-triangle';
      case 'error':
        return 'ti-alert-circle';
      default:
        return 'ti-point-filled';
    }
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.smoothReveal = this.chartReveal;
    this.startRevealAnimation();
    setTimeout(() => this.initChart(), 80);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['chartReveal'] && isPlatformBrowser(this.platformId)) {
      this.startRevealAnimation();
    }
    if (changes['isProcessing']?.currentValue === true && isPlatformBrowser(this.platformId)) {
      this.startRevealAnimation();
    }
    if (changes['stats'] && isPlatformBrowser(this.platformId)) {
      this.updateChart();
    }
    if (changes['terminalEntries'] && isPlatformBrowser(this.platformId)) {
      const prev = changes['terminalEntries'].previousValue as TerminalEntry[] | undefined;
      const curr = changes['terminalEntries'].currentValue as TerminalEntry[] | undefined;
      if ((curr?.length ?? 0) > (prev?.length ?? 0)) {
        this.scrollTerminalToBottom();
      }
    }

    if (changes['awaitingHitl']?.currentValue === true && !changes['awaitingHitl']?.previousValue) {
      this.stickToBottom = true;
      this.scrollTerminalToBottom(true);
    }

    if (changes['hitlEvent'] && isPlatformBrowser(this.platformId)) {
      const prevId = changes['hitlEvent'].previousValue?.id;
      const currId = changes['hitlEvent'].currentValue?.id;
      if (currId != null && currId !== prevId) {
        this.stickToBottom = true;
        this.scrollTerminalToBottom(true);
      }
    }
    if (
      changes['hitlHistory']?.currentValue?.length >
      (changes['hitlHistory']?.previousValue?.length ?? 0)
    ) {
      // Jump to last page so newly added row is visible
      this._hitlPage = Math.ceil(this.hitlHistory.length / this.PAGE_SIZE) || 1;
      this.expandedHitlIndex = this.hitlHistory.length - 1;
      setTimeout(() => this.scrollHitlHistoryIntoView(), 0);
    }
    if (
      changes['resolvedRefs']?.currentValue?.length !==
      changes['resolvedRefs']?.previousValue?.length
    ) {
      this.resetResolvedPage();
    }
  }

  ngOnDestroy(): void {
    this.stopRevealAnimation();
    if (!isPlatformBrowser(this.platformId)) return;
    this.chart?.destroy();
    this.chart = null;
  }

  private startRevealAnimation(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.revealTickId) return;

    this.revealTickId = setInterval(() => {
      const target = this.chartReveal;
      const delta = target - this.smoothReveal;

      if (Math.abs(delta) < 0.35) {
        this.smoothReveal = target;
      } else {
        this.smoothReveal += delta * Hyperlinking.REVEAL_EASE;
      }

      const now = Date.now();
      if (now - this.lastChartRevealUpdate > 60) {
        this.lastChartRevealUpdate = now;
        this.updateChart();
      }

      this.cdr.markForCheck();
    }, Hyperlinking.REVEAL_TICK_MS);
  }

  private stopRevealAnimation(): void {
    if (this.revealTickId) {
      clearInterval(this.revealTickId);
      this.revealTickId = null;
    }
  }

  initChart(): void {
    if (!this.donutRef) return;

    const linked = this.scaled(this.stats?.linked ?? 0);
    const broken = this.scaled(this.stats?.broken ?? 0);
    const missing = this.scaled(this.stats?.missing ?? 0);

    this.chart = new Chart(this.donutRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Linked', 'Changed', 'Missing'],
        datasets: [
          {
            data: [linked || 1, broken, missing],
            backgroundColor: [
              HYPER_CHART_COLORS.linked,
              HYPER_CHART_COLORS.changed,
              HYPER_CHART_COLORS.missing,
            ],
            hoverBackgroundColor: [
              HYPER_CHART_COLORS.linkedHover,
              HYPER_CHART_COLORS.changedHover,
              HYPER_CHART_COLORS.missingHover,
            ],
            borderColor: '#ffffff',
            borderWidth: 2,
            hoverOffset: 6,
            spacing: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        animation: {
          animateRotate: true,
          animateScale: true,
          duration: Hyperlinking.CHART_ANIM_MS,
          easing: 'easeOutQuart',
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b',
            padding: 10,
            cornerRadius: 8,
            titleFont: { size: 12, weight: 'bold' },
            bodyFont: { size: 12 },
            callbacks: {
              label: (ctx) => {
                const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
                const value = ctx.parsed as number;
                const pct = total ? ((value / total) * 100).toFixed(1) : '0.0';
                return ` ${ctx.label}: ${value.toLocaleString()} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }

  updateChart(): void {
    if (!this.chart) {
      this.initChart();
      return;
    }

    const linked = this.scaled(this.stats?.linked ?? 0);
    const broken = this.scaled(this.stats?.broken ?? 0);
    const missing = this.scaled(this.stats?.missing ?? 0);

    this.chart.data.datasets[0].data = [linked || (this.isProcessing ? 1 : 0), broken, missing];
    this.chart.update('active');
  }

  toggleRow(i: number): void {
    this.expandedIndex = this.expandedIndex === i ? null : i;
  }

  toggleHitlRow(i: number): void {
    this.expandedHitlIndex = this.expandedHitlIndex === i ? null : i;
  }

  hitlStatusClass(status: HitlHistoryRecord['status']): string {
    if (status === 'confirmed') return 'done';
    if (status === 'skipped') return 'skipped';
    return 'warn';
  }

  hitlStatusLabel(status: HitlHistoryRecord['status']): string {
    if (status === 'confirmed') return 'Confirmed';
    if (status === 'skipped') return 'Skipped';
    return 'Pending';
  }

  exportHitlJson(): void {
    this.hitlStorage.downloadJson(this.taskId, this.hitlHistory);
  }

  selectOption(i: number): void {
    this.selectedHitlIndexChange.emit(i);
  }

  onConfirm(): void {
    if (this.selectedHitlIndex === -1) {
      this.skipSelection.emit();
      return;
    }
    this.confirmSelection.emit();
  }

  onTerminalScroll(event: Event): void {
    const el = event.target as HTMLElement;
    const wasPinned = this.stickToBottom;
    this.stickToBottom = this.isNearBottom(el);
    if (wasPinned !== this.stickToBottom) {
      this.cdr.markForCheck();
    }
  }

  jumpTerminalToLatest(): void {
    this.stickToBottom = true;
    this.scrollTerminalToBottom(true);
  }

  get showJumpToLatest(): boolean {
    return !this.stickToBottom && this.terminalEntries.length > 0 && this.showProcessingTerminal;
  }

  private isNearBottom(el: HTMLElement): boolean {
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distance <= Hyperlinking.SCROLL_STICK_THRESHOLD_PX;
  }

  private scrollTerminalToBottom(force = false): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!force && !this.stickToBottom) return;

    const scroll = (): void => {
      const el = this.terminalScrollRef?.nativeElement;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    };
    setTimeout(scroll, 0);
    requestAnimationFrame(() => {
      scroll();
      requestAnimationFrame(scroll);
    });
  }

  private scrollHitlHistoryIntoView(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const el = document.querySelector('.hitl-history-card');
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
resolvedStatusClass(r: any): string {
  if (r?.status === 'confirmed') return 'done';
  if (r?.status === 'skipped') return 'skipped';
  if (r?.status === 'auto') return 'auto';
  return 'warn';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
resolvedStatusLabel(r: any): string {
  if (r?.status === 'confirmed') return 'Confirmed';
  if (r?.status === 'skipped') return 'Skipped';
  if (r?.status === 'auto') return 'Auto-resolved';
  return 'Pending';
}

downloadHyperlinkedDocument(): void {
  this.downloadAsset('/assets/Outputs/Hyperlinking_output.zip', 'hyperlinked-document.zip');
}

downloadHitlCsv(): void {
  this.downloadAsset('assets/Outputs/hitl_manual_log.csv', 'hitl-history.csv');
}

downloadAutoLinkedCsv(): void {
  this.downloadAsset('assets/Outputs/auto_hyperlinks_log.csv', 'auto-linked.csv');
}

private downloadAsset(path: string, filename: string): void {
  const link = document.createElement('a');
  link.href = path;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
}