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
} from '@angular/core';
import {
  Chart,
  DoughnutController,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { CommonModule, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { JobStats, ModuleDistribution } from '../../core/models/job.types';

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

@Component({
  selector: 'app-hyperlinking',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './hyperlinking.html',
  styleUrl: './hyperlinking.css',
})
export class Hyperlinking implements AfterViewInit, OnChanges, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  @Input() hitlEvent: any;
  @Input() hitlSuggestions: any[] = [];
  @Input() resolvedRefs: any[] = [];
  @Input() stats?: JobStats;
  @Input() moduleDistribution?: ModuleDistribution;
  @Input() chartReveal = 100;
  @Input() isProcessing = false;

  @Output() openPopup = new EventEmitter<void>();
  @Output() confirmSelection = new EventEmitter<void>();

  @ViewChild('donutChart') donutRef!: ElementRef<HTMLCanvasElement>;
  chart: Chart | null = null;

  expandedIndex: number | null = null;

  get totalLinks(): number {
    return this.stats?.totalLinks ?? 0;
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
        { name: 'M2', value: 0, percent: 0 },
        { name: 'M3', value: 0, percent: 0 },
        { name: 'M4', value: 0, percent: 0 },
        { name: 'M5', value: 0, percent: 0 },
      ];
    }

    const max = Math.max(dist.M2, dist.M3, dist.M4, dist.M5, 1);
    const factor = this.revealFactor;

    return [
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

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    setTimeout(() => this.initChart(), 80);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      (changes['stats'] || changes['chartReveal']) &&
      isPlatformBrowser(this.platformId)
    ) {
      this.updateChart();
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

    this.chart.data.datasets[0].data = [
      linked || (this.isProcessing ? 1 : 0),
      broken,
      missing,
    ];
    this.chart.update('active');
  }

  openHITL(): void {
    this.openPopup.emit();
  }

  toggleRow(i: number): void {
    this.expandedIndex = this.expandedIndex === i ? null : i;
  }

  selectOption(i: number): void {
    this.hitlEvent.selected = i;
    if (this.hitlEvent.selectedIndex !== undefined) {
      this.hitlEvent.selectedIndex = i;
    }
  }

  onConfirm(): void {
    this.confirmSelection.emit();
  }
}
