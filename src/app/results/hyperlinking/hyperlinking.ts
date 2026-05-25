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
  ChangeDetectionStrategy,
} from '@angular/core';
import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js';
import { CommonModule, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { JobStats, ModuleDistribution } from '../../core/models/job.types';
import {
  TerminalEntry,
  PipelineState,
} from '../../core/services/Pipeline-sse.service';

Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

export interface ModuleStat {
  name: string;
  value: number;
  percent: number;
}

export interface LinkBreakdownItem {
  label: string;
  count: number;
  tone: 'teal' | 'red' | 'gray';
}

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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Hyperlinking implements AfterViewInit, OnChanges, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);

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
        { label: 'Linked', count: 0, tone: 'teal' },
        { label: 'Changed', count: 0, tone: 'red' },
        { label: 'Missing', count: 0, tone: 'gray' },
      ];
    }
    return [
      { label: 'Linked', count: this.scaled(s.linked), tone: 'teal' },
      { label: 'Changed', count: this.scaled(s.broken), tone: 'red' },
      { label: 'Missing', count: this.scaled(s.missing), tone: 'gray' },
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
    return Math.min(Math.max(this.chartReveal / 100, 0), 1);
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
    setTimeout(() => this.initChart(), 80);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['stats'] || changes['chartReveal']) && isPlatformBrowser(this.platformId)) {
      this.updateChart();
    }
    if (changes['terminalEntries'] || changes['awaitingHitl']) {
      this.scrollTerminalToBottom();
    }
  }

  ngOnDestroy(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.chart?.destroy();
    this.chart = null;
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
            backgroundColor: ['#0d9488', '#ef4444', '#94a3b8'],
            borderWidth: 0,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        animation: {
          animateRotate: true,
          animateScale: true,
          duration: 600,
          easing: 'easeOutQuart',
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b',
            padding: 10,
            cornerRadius: 8,
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

  private scrollTerminalToBottom(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    setTimeout(() => {
      const el = this.terminalScrollRef?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 0);
  }
}
