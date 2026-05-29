import {
  Component,
  AfterViewInit,
  ElementRef,
  ViewChild,
  OnDestroy,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  DoughnutController,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  DoughnutController,
  ArcElement,
  Tooltip,
  Legend
);

interface Reference {
  document: string;
  value: string;
  unit: string;
  page: string;
}

interface Excerpt {
  document: string;
  page: string;
  text: string;
}

interface Issue {
  parameter: string;
  issueType: 'Value mismatch' | 'Unit mismatch';
  documents: number;
  values: string[];
  references: Reference[];
  excerpts: Excerpt[];
}

interface ParamDistribution {
  name: string;
  count: number;
}

@Component({
  selector: 'app-consistency',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './consistency.html',
  styleUrl: './consistency.css',
})
export class Consistency implements AfterViewInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);

  @ViewChild('barChart') barChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('doughnutChart') doughnutChartRef!: ElementRef<HTMLCanvasElement>;

  private charts: Chart[] = [];

  readonly pageSize = 6;
  currentPage = 0;

  searchQuery = '';
  activeFilter: 'All' | 'Value mismatch' | 'Unit mismatch' = 'All';
  selectedIssue: Issue | null = null;

  readonly totalIssuesCount = 11;
  readonly documentsAffected = 4;
  readonly parametersAffected = 5;
  readonly donutTotal = 5;

  displayTotalIssues = 0;
  displayDocuments = 0;
  displayParameters = 0;


  readonly paramMax = 3;

  allIssues: Issue[] = [
    {
      parameter: 't1/2',
      issueType: 'Value mismatch',
      documents: 3,
      values: ['38', '8.2', '12.4'],
      references: [
        { document: 'module-2-summary.pdf', value: '38', unit: 'h', page: 'p. 14' },
        { document: 'clinical-overview.pdf', value: '8.2', unit: 'h', page: 'p. 42' },
        { document: 'module-5-csr-013.pdf', value: '12.4', unit: 'h', page: 'p. 88' },
      ],
      excerpts: [
        {
          document: 'module-2-summary.pdf',
          page: 'p. 14',
          text: 'The mean terminal half-life (t1/2) was reported as <span class="hl-red">38</span> h in healthy volunteers.',
        },
        {
          document: 'clinical-overview.pdf',
          page: 'p. 42',
          text: 'Following oral administration, t1/2 was estimated at <span class="hl-red">8.2</span> h across the studied population.',
        },
        {
          document: 'module-5-csr-013.pdf',
          page: 'p. 88',
          text: 'The terminal half-life (t1/2) was determined to be <span class="hl-red">12.4</span> h under fasted conditions.',
        },
      ],
    },
    {
      parameter: 'Cmax',
      issueType: 'Value mismatch',
      documents: 2,
      values: ['120', '98'],
      references: [
        { document: 'module-2-summary.pdf', value: '120', unit: 'ng/mL', page: 'p. 18' },
        { document: 'clinical-overview.pdf', value: '98', unit: 'ng/mL', page: 'p. 55' },
      ],
      excerpts: [
        {
          document: 'module-2-summary.pdf',
          page: 'p. 18',
          text: 'Peak plasma concentration (Cmax) reached <span class="hl-red">120</span> ng/mL after a single dose.',
        },
        {
          document: 'clinical-overview.pdf',
          page: 'p. 55',
          text: 'Cmax was observed at <span class="hl-red">98</span> ng/mL in the fed-state pharmacokinetic study.',
        },
      ],
    },
    {
      parameter: 'AUC0-∞',
      issueType: 'Unit mismatch',
      documents: 2,
      values: ['540 ng·h/mL', '0.54 µg·h/mL'],
      references: [
        { document: 'module-2-summary.pdf', value: '540', unit: 'ng·h/mL', page: 'p. 20' },
        { document: 'module-5-csr-013.pdf', value: '0.54', unit: 'µg·h/mL', page: 'p. 91' },
      ],
      excerpts: [
        {
          document: 'module-2-summary.pdf',
          page: 'p. 20',
          text: 'AUC0-∞ was calculated as <span class="hl-red">540 ng·h/mL</span>, reflecting total systemic exposure.',
        },
        {
          document: 'module-5-csr-013.pdf',
          page: 'p. 91',
          text: 'Total exposure expressed as AUC0-∞ equalled <span class="hl-red">0.54 µg·h/mL</span> in the primary analysis.',
        },
      ],
    },
    {
      parameter: 'Tmax',
      issueType: 'Value mismatch',
      documents: 2,
      values: ['2.0', '1.5'],
      references: [
        { document: 'module-2-summary.pdf', value: '2.0', unit: 'h', page: 'p. 22' },
        { document: 'clinical-overview.pdf', value: '1.5', unit: 'h', page: 'p. 60' },
      ],
      excerpts: [
        {
          document: 'module-2-summary.pdf',
          page: 'p. 22',
          text: 'Time to maximum concentration (Tmax) was <span class="hl-red">2.0</span> h post-dose in fasted subjects.',
        },
        {
          document: 'clinical-overview.pdf',
          page: 'p. 60',
          text: 'Median Tmax was <span class="hl-red">1.5</span> h when administered under fed conditions.',
        },
      ],
    },
    {
      parameter: 'Vd',
      issueType: 'Unit mismatch',
      documents: 2,
      values: ['80 L', '1.1 L/kg'],
      references: [
        { document: 'module-2-summary.pdf', value: '80', unit: 'L', page: 'p. 25' },
        { document: 'module-5-csr-013.pdf', value: '1.1', unit: 'L/kg', page: 'p. 95' },
      ],
      excerpts: [
        {
          document: 'module-2-summary.pdf',
          page: 'p. 25',
          text: 'Apparent volume of distribution (Vd) was estimated at <span class="hl-red">80 L</span> in the population PK model.',
        },
        {
          document: 'module-5-csr-013.pdf',
          page: 'p. 95',
          text: 'Weight-normalised Vd was reported as <span class="hl-red">1.1 L/kg</span> across the studied cohort.',
        },
      ],
    },
  ];

  get filteredIssues(): Issue[] {
    return this.allIssues.filter((issue) => {
      const matchSearch = issue.parameter
        .toLowerCase()
        .includes(this.searchQuery.toLowerCase());
      const matchFilter =
        this.activeFilter === 'All' || issue.issueType === this.activeFilter;
      return matchSearch && matchFilter;
    });
  }

  get paginatedIssues(): Issue[] {
    const start = this.currentPage * this.pageSize;
    return this.filteredIssues.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredIssues.length / this.pageSize));
  }

  get pageStart(): number {
    if (!this.filteredIssues.length) return 0;
    return this.currentPage * this.pageSize + 1;
  }

  get pageEnd(): number {
    return Math.min(
      (this.currentPage + 1) * this.pageSize,
      this.filteredIssues.length
    );
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  paramPercent(count: number): number {
    return Math.round((count / this.paramMax) * 100);
  }

  onSearchChange(): void {
    this.currentPage = 0;
  }

  onFilterChange(value: string): void {
    if (value === 'All' || value === 'Value mismatch' || value === 'Unit mismatch') {
      this.activeFilter = value;
      this.currentPage = 0;
    }
  }

  prevPage(): void {
    if (this.currentPage > 0) this.currentPage--;
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages - 1) this.currentPage++;
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages) this.currentPage = page;
  }

  openDetail(issue: Issue): void {
    this.selectedIssue = issue;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'hidden';
    }
  }

  closeDetail(): void {
    this.selectedIssue = null;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = '';
    }
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.animateStat(this.totalIssuesCount, (v) => (this.displayTotalIssues = v));
    this.animateStat(this.documentsAffected, (v) => (this.displayDocuments = v), 120);
    this.animateStat(this.parametersAffected, (v) => (this.displayParameters = v), 200);

    setTimeout(() => {
      this.initBarChart();
      this.initDoughnutChart();
    }, 80);
  }

  ngOnDestroy(): void {
    this.charts.forEach((c) => c.destroy());
    this.charts = [];
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = '';
    }
  }

  private animateStat(
    target: number,
    setter: (v: number) => void,
    delayMs = 0
  ): void {
    setTimeout(() => {
      const duration = 700;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        setter(Math.round(target * eased));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, delayMs);
  }

  private initBarChart(): void {
    const canvas = this.barChartRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, 280);
    gradient.addColorStop(0, '#c4b5fd');
    gradient.addColorStop(1, '#6d28d9');

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['module-1', 'module-2', 'module-3', 'module-4', 'module-5'],
        datasets: [{
          data: [6, 4, 9, 5, 2],
          backgroundColor: gradient,
          hoverBackgroundColor: '#5b21b6',
          borderRadius: 10,
          borderSkipped: false,
          barPercentage: 0.55,
          categoryPercentage: 0.72,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 900,
          easing: 'easeOutQuart',
          delay: (ctx) => (ctx.dataIndex ?? 0) * 70,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            padding: 12,
            cornerRadius: 10,
            displayColors: false,
            callbacks: { label: (c) => ` ${c.raw} issues` },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: '#64748b', font: { size: 12 } },
          },
          y: {
            grid: { color: '#f1f5f9', lineWidth: 1 },
            border: { display: false, dash: [4, 6] },
            ticks: { stepSize: 3, color: '#94a3b8', font: { size: 11 } },
            min: 0,
            max: 12,
          },
        },
      },
    });
    this.charts.push(chart);
  }

  private initDoughnutChart(): void {
    const chart = new Chart(this.doughnutChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Value mismatch', 'Unit mismatch'],
        datasets: [
          {
            data: [3, 2],
            backgroundColor: ['#7c3aed', '#d97706'],
            hoverBackgroundColor: ['#6d28d9', '#b45309'],
            borderWidth: 0,
            hoverOffset: 6,
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
          duration: 900,
          easing: 'easeOutQuart',
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            padding: 12,
            cornerRadius: 10,
            callbacks: { label: (c) => ` ${c.label}: ${c.raw}` },
          },
        },
      },
    });
    this.charts.push(chart);
  }

   downloadCSV() {
    const fileUrl = 'assets/mismatch_report.xlsx';

    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = 'mismatch_report.xlsx';
    link.click();
  }
}
