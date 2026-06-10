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
  Legend,
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

  // Animated display values (written by animateStat)
  displayTotalIssues = 0;
  displayDocuments = 0;
  displayParameters = 0;

  allIssues: Issue[] = [
    {
      parameter: 'Any TEAE',
      issueType: 'Value mismatch',
      documents: 4,
      values: ['58.3', '62.4', '60.1', '59.7'],
      references: [
        { document: '5.3.4.2-phase3-study1.pdf', value: '58.3', unit: '%', page: 'p. 4' },
        { document: '2.5-clinical-overview.pdf', value: '62.4', unit: '%', page: 'p. 2' },
        { document: '5.3.4.2-phase3-study2.pdf', value: '60.1', unit: '%', page: 'p. 6' },
        { document: '2.7.4-safety-summary.pdf', value: '59.7', unit: '%', page: 'p. 11' },
      ],
      excerpts: [
        {
          document: '5.3.4.2-phase3-study1.pdf',
          page: 'p. 4',
          text: 'Treatment-emergent adverse events (Any TEAE) were reported in <span class="hl-red">58.3</span> % of subjects in the Nexivarin 10 mg group (Safety Results).',
        },
        {
          document: '2.5-clinical-overview.pdf',
          page: 'p. 2',
          text: 'The incidence of Any TEAE in the Nexivarin 10 mg group was <span class="hl-red">62.4</span> % as reported in the Overview of Safety.',
        },
        {
          document: '5.3.4.2-phase3-study2.pdf',
          page: 'p. 6',
          text: 'Any TEAE was observed in <span class="hl-red">60.1</span> % of subjects receiving Nexivarin 10 mg in Study 2.',
        },
        {
          document: '2.7.4-safety-summary.pdf',
          page: 'p. 11',
          text: 'The pooled TEAE incidence for Nexivarin 10 mg was recorded as <span class="hl-red">59.7</span> % in the integrated safety summary.',
        },
      ],
    },
    {
      parameter: 'Tablet Strength',
      issueType: 'Value mismatch',
      documents: 3,
      values: ['10', '100', '10'],
      references: [
        { document: '5.3.4.2-phase3-study1.pdf', value: '10', unit: 'mg', page: 'p. 3' },
        { document: '2.3-qos.pdf', value: '100', unit: 'mg', page: 'p. 5' },
        { document: '3.2.P.1-dp-description.pdf', value: '10', unit: 'mg', page: 'p. 2' },
      ],
      excerpts: [
        {
          document: '5.3.4.2-phase3-study1.pdf',
          page: 'p. 3',
          text: 'The Nexivarin Hydrochloride tablet strength used in the study was <span class="hl-red">10</span> mg as stated in the Synopsis.',
        },
        {
          document: '2.3-qos.pdf',
          page: 'p. 5',
          text: 'Tablet Strength for Nexivarin Hydrochloride is specified as <span class="hl-red">100</span> mg in the Drug Product section.',
        },
        {
          document: '3.2.P.1-dp-description.pdf',
          page: 'p. 2',
          text: 'The proposed commercial tablet strength is listed as <span class="hl-red">50</span> mg in the Drug Product Description.',
        },
      ],
    },
    {
      parameter: 'Dose Levels',
      issueType: 'Value mismatch',
      documents: 4,
      values: ['3', '30', '3', '3'],
      references: [
        { document: '4.2.3.2-repeat-dose-tox.pdf', value: '3', unit: 'mg/kg/day', page: 'p. 3' },
        { document: '2.4-nonclinical-overview.pdf', value: '30', unit: 'mg/kg/day', page: 'p. 4' },
        { document: '4.2.3.1-single-dose-tox.pdf', value: '3', unit: 'mg/kg/day', page: 'p. 7' },
        { document: '2.6.6-tox-summary.pdf', value: '3', unit: 'mg/kg/day', page: 'p. 9' },
      ],
      excerpts: [
        {
          document: '4.2.3.2-repeat-dose-tox.pdf',
          page: 'p. 3',
          text: 'The NOAEL Dose Level was identified as <span class="hl-red">3</span> mg/kg/day in the Repeat-Dose Toxicity Studies.',
        },
        {
          document: '2.4-nonclinical-overview.pdf',
          page: 'p. 4',
          text: 'NOAEL Dose Levels were reported as <span class="hl-red">30</span> mg/kg/day in the Repeat-Dose Toxicity section.',
        },
        {
          document: '4.2.3.1-single-dose-tox.pdf',
          page: 'p. 7',
          text: 'The maximum tolerated dose was determined to be <span class="hl-red">10</span> mg/kg/day in the single-dose toxicology study.',
        },
        {
          document: '2.6.6-tox-summary.pdf',
          page: 'p. 9',
          text: 'The NOAEL was cited as <span class="hl-red">15</span> mg/kg/day in the written summary of toxicology.',
        },
      ],
    },
    {
      parameter: 'AUC0-∞',
      issueType: 'Unit mismatch',
      documents: 3,
      values: ['540 ng·h/mL', '540 µg·h/mL', '54 mg·h/L'],
      references: [
        { document: '2.7.2-pk-summary.pdf', value: '540', unit: 'ng·h/mL', page: 'p. 6' },
        { document: '5.3.3.1-pk-study.pdf', value: '540', unit: 'µg·h/mL', page: 'p. 12' },
        { document: '2.5-clinical-overview.pdf', value: '54', unit: 'mg·h/L', page: 'p. 9' },
      ],
      excerpts: [
        {
          document: '2.7.2-pk-summary.pdf',
          page: 'p. 6',
          text: 'AUC0-∞ was calculated as <span class="hl-red">540 ng·h/mL</span>, reflecting total systemic exposure in the PK summary.',
        },
        {
          document: '5.3.3.1-pk-study.pdf',
          page: 'p. 12',
          text: 'Total exposure expressed as AUC0-∞ equalled <span class="hl-red">0.54 µg·h/mL</span> in the primary PK analysis.',
        },
        {
          document: '2.5-clinical-overview.pdf',
          page: 'p. 9',
          text: 'The AUC0-∞ was reported as <span class="hl-red">0.00054 mg·h/L</span> in the clinical overview PK section.',
        },
      ],
    },
    {
      parameter: 'pKa',
      issueType: 'Value mismatch',
      documents: 2,
      values: ['7.4', '9.4'],
      references: [
        { document: '3.2.S.1-general-info.pdf', value: '7.4', unit: '', page: 'p. 4' },
        { document: '2.3-qos.pdf', value: '9.4', unit: '', page: 'p. 3' },
      ],
      excerpts: [
        {
          document: '3.2.S.1-general-info.pdf',
          page: 'p. 4',
          text: 'The pKa value was determined to be <span class="hl-red">7.4</span> as listed under General Properties.',
        },
        {
          document: '2.3-qos.pdf',
          page: 'p. 3',
          text: 'General Information records the pKa value as <span class="hl-red">9.4</span>.',
        },
      ],
    },
    {
      parameter: 'Vd',
      issueType: 'Unit mismatch',
      documents: 3,
      values: ['80 L', '1.1 L/kg', '  0.0011 m³/kg'],
      references: [
        { document: '2.7.2-pk-summary.pdf', value: '80', unit: 'L', page: 'p. 8' },
        { document: '5.3.3.1-pk-study.pdf', value: '1.1', unit: 'L/kg', page: 'p. 15' },
        { document: '2.4-nonclinical-overview.pdf', value: '0.0011', unit: 'm³/kg', page: 'p. 6' },
      ],
      excerpts: [
        {
          document: '2.7.2-pk-summary.pdf',
          page: 'p. 8',
          text: 'Apparent volume of distribution (Vd) was estimated at <span class="hl-red">80 L</span> in the population PK model.',
        },
        {
          document: '5.3.3.1-pk-study.pdf',
          page: 'p. 15',
          text: 'Weight-normalised Vd was reported as <span class="hl-red">1.1 L/kg</span> across the studied cohort.',
        },
        {
          document: '2.4-nonclinical-overview.pdf',
          page: 'p. 6',
          text: 'The volume of distribution was expressed as <span class="hl-red">0.0011 m³/kg</span> in the nonclinical overview PK section.',
        },
      ],
    },
    {
      parameter: 'Dizziness',
      issueType: 'Value mismatch',
      documents: 3,
      values: ['1.3', '1.5', '1.8'],
      references: [
        { document: '5.3.4.2-phase3-study1.pdf', value: '1.3', unit: '%', page: 'p. 2' },
        { document: '2.5-clinical-overview.pdf', value: '1.5', unit: '%', page: 'p. 4' },
        { document: '2.7.4-safety-summary.pdf', value: '1.8', unit: '%', page: 'p. 14' },
      ],
      excerpts: [
        {
          document: '5.3.4.2-phase3-study1.pdf',
          page: 'p. 2',
          text: 'Dizziness was reported in <span class="hl-red">1.3</span> % of Placebo subjects in the Safety Results.',
        },
        {
          document: '2.5-clinical-overview.pdf',
          page: 'p. 4',
          text: 'The incidence of Dizziness in the Placebo group was <span class="hl-red">1.5</span> % per the Overview of Safety.',
        },
        {
          document: '2.7.4-safety-summary.pdf',
          page: 'p. 14',
          text: 'Dizziness was noted in <span class="hl-red">1.8</span> % of Placebo subjects in the integrated safety summary.',
        },
      ],
    },
    {
      parameter: 'Clearance (CL/F)',
      issueType: 'Unit mismatch',
      documents: 4,
      values: ['12 L/h', '200 mL/min', '0.2 mL/min/kg', '0.012 m³/h'],
      references: [
        { document: '2.7.2-pk-summary.pdf', value: '12', unit: 'L/h', page: 'p. 10' },
        { document: '5.3.3.1-pk-study.pdf', value: '200', unit: 'mL/min', page: 'p. 18' },
        { document: '2.5-clinical-overview.pdf', value: '0.2', unit: 'mL/min/kg', page: 'p. 11' },
        { document: '2.4-nonclinical-overview.pdf', value: '0.012', unit: 'm³/h', page: 'p. 7' },
      ],
      excerpts: [
        {
          document: '2.7.2-pk-summary.pdf',
          page: 'p. 10',
          text: 'Apparent oral clearance (CL/F) was reported as <span class="hl-red">12 L/h</span> in the population PK summary.',
        },
        {
          document: '5.3.3.1-pk-study.pdf',
          page: 'p. 18',
          text: 'CL/F was estimated at <span class="hl-red">200 mL/min</span> in the primary pharmacokinetic study.',
        },
        {
          document: '2.5-clinical-overview.pdf',
          page: 'p. 11',
          text: 'Weight-adjusted clearance (CL/F) was cited as <span class="hl-red">0.2 mL/min/kg</span> in the clinical overview.',
        },
        {
          document: '2.4-nonclinical-overview.pdf',
          page: 'p. 7',
          text: 'Clearance was expressed as <span class="hl-red">0.012 m³/h</span> in the nonclinical pharmacokinetic section.',
        },
      ],
    },
    {
      parameter: 'Human coronary artery SMC',
      issueType: 'Value mismatch',
      documents: 3,
      values: ['2.3 ± 0.4', '2.7 ± 0.1', '2.5 ± 0.3'],
      references: [
        { document: '4.2.1.1-primary-pd.pdf', value: '2.3 ± 0.4', unit: 'nM', page: 'p. 4' },
        { document: '2.4-nonclinical-overview.pdf', value: '2.7 ± 0.1', unit: 'nM', page: 'p. 3' },
        { document: '2.6.2-pk-summary.pdf', value: '2.5 ± 0.3', unit: 'nM', page: 'p. 8' },
      ],
      excerpts: [
        {
          document: '4.2.1.1-primary-pd.pdf',
          page: 'p. 4',
          text: 'IC50 for Human coronary artery SMC was measured at <span class="hl-red">2.3 ± 0.4</span> nM in Primary Pharmacodynamics — Nexivarin Hydrochloride.',
        },
        {
          document: '2.4-nonclinical-overview.pdf',
          page: 'p. 3',
          text: 'The IC50 for Human coronary artery SMC was reported as <span class="hl-red">2.7 ± 0.1</span> nM in the Pharmacology section.',
        },
        {
          document: '2.6.2-pk-summary.pdf',
          page: 'p. 8',
          text: 'IC50 for Human coronary artery SMC was cited as <span class="hl-red">2.5 ± 0.3</span> nM in the written summary of pharmacokinetics.',
        },
      ],
    },
    {
      parameter: 'hERG IC50',
      issueType: 'Value mismatch',
      documents: 4,
      values: ['10,000', '10', '1,000', '100'],
      references: [
        { document: '4.2.1.3-safety-pharm.pdf', value: '10,000', unit: 'nM', page: 'p. 2' },
        { document: '2.4-nonclinical-overview.pdf', value: '10', unit: 'nM', page: 'p. 3' },
        { document: '2.6.3-pharm-summary.pdf', value: '1,000', unit: 'nM', page: 'p. 5' },
        { document: '4.2.1.4-safety-add.pdf', value: '100', unit: 'nM', page: 'p. 8' },
      ],
      excerpts: [
        {
          document: '4.2.1.3-safety-pharm.pdf',
          page: 'p. 2',
          text: 'The hERG IC50 safety margin was recorded as <span class="hl-red">10,000</span> nM in Safety Pharmacology — Nexivarin Hydrochloride.',
        },
        {
          document: '2.4-nonclinical-overview.pdf',
          page: 'p. 3',
          text: 'Safety Pharmacology reports the hERG IC50 safety margin as <span class="hl-red">10</span> nM.',
        },
        {
          document: '2.6.3-pharm-summary.pdf',
          page: 'p. 5',
          text: 'The hERG IC50 was noted as <span class="hl-red">1,000</span> nM in the written summary of pharmacology.',
        },
        {
          document: '4.2.1.4-safety-add.pdf',
          page: 'p. 8',
          text: 'Supplementary safety pharmacology data lists hERG IC50 as <span class="hl-red">100</span> nM.',
        },
      ],
    },
    {
      parameter: 'Flushing',
      issueType: 'Value mismatch',
      documents: 2,
      values: ['2.4', '2.6'],
      references: [
        { document: '5.3.4.2-phase3-study1.pdf', value: '2.4', unit: '%', page: 'p. 2' },
        { document: '2.5-clinical-overview.pdf', value: '2.6', unit: '%', page: 'p. 4' },
      ],
      excerpts: [
        {
          document: '5.3.4.2-phase3-study1.pdf',
          page: 'p. 2',
          text: 'Flushing was observed in <span class="hl-red">2.4</span> % of Nexivarin 10 mg subjects per the Safety Results.',
        },
        {
          document: '2.5-clinical-overview.pdf',
          page: 'p. 4',
          text: 'The Overview of Safety reports Flushing in <span class="hl-red">2.6</span> % of Nexivarin 10 mg subjects.',
        },
      ],
    },
  ];

  // --- Computed getters ---

  get valueMismatchCount(): number {
    return this.allIssues.filter((i) => i.issueType === 'Value mismatch').length;
  }

  get unitMismatchCount(): number {
    return this.allIssues.filter((i) => i.issueType === 'Unit mismatch').length;
  }

  get donutTotal(): number {
    return this.allIssues.length;
  }

  get totalIssuesCount(): number {
    return this.allIssues.length;
  }

  get documentsAffected(): number {
    return new Set(
      this.allIssues.flatMap((i) => i.references.map((r) => r.document))
    ).size;
  }

  get parametersAffected(): number {
    return new Set(this.allIssues.map((i) => i.parameter)).size;
  }

  // --- Table / pagination ---

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
      this.filteredIssues.length,
    );
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
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

  // --- Lifecycle ---

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

  private animateStat(target: number, setter: (v: number) => void, delayMs = 0): void {
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
        datasets: [
          {
            data: [6, 4, 9, 5, 2],
            backgroundColor: gradient,
            hoverBackgroundColor: '#5b21b6',
            borderRadius: 10,
            borderSkipped: false,
            barPercentage: 0.55,
            categoryPercentage: 0.72,
          },
        ],
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
            data: [this.valueMismatchCount, this.unitMismatchCount],
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

  downloadCSV(): void {
    const link = document.createElement('a');
    link.href = 'assets/mismatch_report.xlsx';
    link.download = 'mismatch_report.xlsx';
    link.click();
  }
}