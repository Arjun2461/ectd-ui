import { Component, AfterViewInit, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Chart,
  BarController, BarElement, CategoryScale, LinearScale,
  DoughnutController, ArcElement,
  Tooltip, Legend
} from 'chart.js';
 
Chart.register(
  BarController, BarElement, CategoryScale, LinearScale,
  DoughnutController, ArcElement,
  Tooltip, Legend
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
  text: string;  // may contain HTML highlights
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
 
  @ViewChild('barChart')      barChartRef!:      ElementRef<HTMLCanvasElement>;
  @ViewChild('doughnutChart') doughnutChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('paramChart')    paramChartRef!:    ElementRef<HTMLCanvasElement>;
 
  private charts: Chart[] = [];
 
  searchQuery   = '';
  activeFilter: 'All' | 'Value mismatch' | 'Unit mismatch' = 'All';
  selectedIssue: Issue | null = null;
 
  allIssues: Issue[] = [
    {
      parameter: 't1/2',
      issueType: 'Value mismatch',
      documents: 3,
      values: ['38', '8.2', '12.4'],
      references: [
        { document: 'module-2-summary.pdf',  value: '38',   unit: 'h', page: 'p. 14' },
        { document: 'clinical-overview.pdf', value: '8.2',  unit: 'h', page: 'p. 42' },
        { document: 'module-5-csr-013.pdf',  value: '12.4', unit: 'h', page: 'p. 88' },
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
        { document: 'module-2-summary.pdf',  value: '120', unit: 'ng/mL', page: 'p. 18' },
        { document: 'clinical-overview.pdf', value: '98',  unit: 'ng/mL', page: 'p. 55' },
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
        { document: 'module-2-summary.pdf',  value: '540',  unit: 'ng·h/mL',  page: 'p. 20' },
        { document: 'module-5-csr-013.pdf',  value: '0.54', unit: 'µg·h/mL',  page: 'p. 91' },
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
        { document: 'module-2-summary.pdf',  value: '2.0', unit: 'h', page: 'p. 22' },
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
        { document: 'module-2-summary.pdf',  value: '80',  unit: 'L',    page: 'p. 25' },
        { document: 'module-5-csr-013.pdf',  value: '1.1', unit: 'L/kg', page: 'p. 95' },
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
    return this.allIssues.filter(issue => {
      const matchSearch = issue.parameter.toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchFilter = this.activeFilter === 'All' || issue.issueType === this.activeFilter;
      return matchSearch && matchFilter;
    });
  }
 
  setFilter(f: 'All' | 'Value mismatch' | 'Unit mismatch') { this.activeFilter = f; }
 
  openDetail(issue: Issue): void  { this.selectedIssue = issue; document.body.style.overflow = 'hidden'; }
  closeDetail(): void             { this.selectedIssue = null;  document.body.style.overflow = '';       }
 
  // ── Lifecycle ──────────────────────────────────────────────
  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initBarChart();
      this.initDoughnutChart();
      this.initParamChart();
    }, 80);
  }
 
  ngOnDestroy(): void {
    this.charts.forEach(c => c.destroy());
    this.charts = [];
    document.body.style.overflow = '';
  }
 
  // ── Charts ─────────────────────────────────────────────────
  private initBarChart(): void {
    const chart = new Chart(this.barChartRef.nativeElement, {
      type: 'bar',
      data: {
        labels: ['module-2', 'module-3', 'clinical', 'csr-013', 'labeling'],
        datasets: [{
          data: [6, 4, 9, 5, 2],
          backgroundColor: ['rgba(124,58,237,0.80)','rgba(139,92,246,0.70)','rgba(109,40,217,0.90)','rgba(139,92,246,0.75)','rgba(167,139,250,0.65)'],
          hoverBackgroundColor: ['rgba(124,58,237,1)','rgba(139,92,246,1)','rgba(109,40,217,1)','rgba(139,92,246,1)','rgba(167,139,250,1)'],
          borderRadius: 10, borderSkipped: false,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 900, easing: 'easeOutQuart', delay: (ctx) => ctx.dataIndex * 80 },
        plugins: { legend: { display: false }, tooltip: { backgroundColor:'#1f2937', titleColor:'#f9fafb', bodyColor:'#d1d5db', padding:10, cornerRadius:8, callbacks:{ label:(c)=>` ${c.raw} issues` } } },
        scales: {
          x: { grid:{display:false}, border:{display:false}, ticks:{color:'#6b7280',font:{size:12}} },
          y: { grid:{color:'#f3f4f6',lineWidth:1}, border:{display:false,dash:[4,4]}, ticks:{stepSize:3,color:'#9ca3af',font:{size:11}}, min:0, max:12 }
        }
      }
    });
    this.charts.push(chart);
  }
 
  private initDoughnutChart(): void {
    const chart = new Chart(this.doughnutChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Value mismatch','Unit mismatch'],
        datasets: [{ data:[3,2], backgroundColor:['#7c3aed','#92400e'], hoverBackgroundColor:['#6d28d9','#78350f'], borderWidth:0, hoverOffset:10 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout:'62%',
        animation: { animateRotate:true, animateScale:true, duration:900, easing:'easeOutQuart' },
        plugins: { legend:{display:false}, tooltip:{ backgroundColor:'#1f2937', titleColor:'#f9fafb', bodyColor:'#d1d5db', padding:10, cornerRadius:8, callbacks:{label:(c)=>` ${c.label}: ${c.raw}`} } }
      }
    });
    this.charts.push(chart);
  }
 
  private initParamChart(): void {
    const chart = new Chart(this.paramChartRef.nativeElement, {
      type: 'bar',
      data: {
        labels: ['t1/2','Cmax','AUC0-∞','Tmax','Vd'],
        datasets: [{
          data: [3,2,2,2,2],
          backgroundColor: ['#6d28d9','#a78bfa','#c4b5fd','#ca8a04','#a855f7'],
          hoverBackgroundColor: ['#5b21b6','#8b5cf6','#a78bfa','#b45309','#9333ea'],
          borderRadius: 8, borderSkipped: false,
        }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        animation: { duration:900, easing:'easeOutQuart', delay:(ctx)=>ctx.dataIndex*100 },
        plugins: { legend:{display:false}, tooltip:{ backgroundColor:'#1f2937', titleColor:'#f9fafb', bodyColor:'#d1d5db', padding:10, cornerRadius:8, callbacks:{label:(c)=>` ${c.raw} issues`} } },
        scales: {
          x: { grid:{color:'#f3f4f6'}, border:{display:false}, ticks:{color:'#9ca3af',font:{size:11}}, min:0, max:3 },
          y: { grid:{display:false}, border:{display:false}, ticks:{color:'#374151',font:{size:13}} }
        }
      }
    });
    this.charts.push(chart);
  }
}