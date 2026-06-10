import {
  Component,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js';
import {
  LucideAngularModule,
  Link2,
  Languages,
  GitCompare,
  Upload,
  Play,
  FileText,
  Sparkles,
  ShieldCheck,
  GitBranch,
} from 'lucide-angular';

Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

export interface ServiceCard {
  title: string;
  description: string;
  icon: typeof Link2;
  route: string;
  comingSoon?: boolean;
}

export interface ActivityJob {
  id: string;
  name: string;
  service: string;
  status: 'Completed' | 'Running' | 'Queued' | 'Failed';
  updated: string;
}

export interface QuickAction {
  label: string;
  icon: typeof Upload;
  route: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements AfterViewInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);

  @ViewChild('analyticsChart') chartRef!: ElementRef<HTMLCanvasElement>;
  private chart: Chart | null = null;

  readonly Link2 = Link2;
  readonly Languages = Languages;
  readonly GitCompare = GitCompare;
  readonly Upload = Upload;
  readonly Play = Play;
  readonly FileText = FileText;
  readonly Sparkles = Sparkles;
  readonly GitBranch = GitBranch;
  readonly ShieldCheck = ShieldCheck;

  welcomeTags = ['Hyperlinking', 'Translation', 'Consistency'];

  welcomeStats = [{ label: 'Active jobs', value: '12' }];

  services: ServiceCard[] = [
    {
      title: 'Hyperlinking & Auto-Tagging',
      description:
        'Automatically create structured hyperlinks across documents to enable clear navigation and accurate cross-referencing.',
      icon: Link2,
      route: '/results',
    },
    {
      title: 'Consistency',
      description:
        'Detect inconsistencies in scientific data, values, and terminology across documents to improve accuracy and reliability.',
      icon: GitCompare,
      route: '/consistency',
    },
    {
      title: 'Translation',
      description:
        'Translate scientific documents into different languages while preserving technical meaning and context.',
      icon: Languages,
      route: '/results',
    },
    {
      title: 'Draft Module 2 Summaries',
      description:
        'Extracts key data from Module 5 clinical study reports and uses it to automatically draft the high-level summaries required for Module2.',
      icon: FileText,
      route: '/results',
      comingSoon: false,
    },
    {
      title: 'Lifecycle Impact Analysis',
      description:
        'Automatically identify downstream document impacts from CMC changes, track required updates across eCTD sequences, and ensure compliance with intelligent redaction of sensitive data.',
      icon: GitBranch,
      route: '/results',
      comingSoon: true,
    },
    {
      title: 'Predictive Validation',
      description:
        'Simulate a regulatory review of submissions against FDA, EMA, and PMDA guidelines.Identify missing documents, formatting issues, and potential review queries or rejections.',
      icon: ShieldCheck,
      route: '/results',
      comingSoon: true,
    },
  ];

  recentJobs: ActivityJob[] = [
    {
      id: 'JOB-2841',
      name: 'NDA-2024-Clinical-Module',
      service: 'Hyperlinking',
      status: 'Completed',
      updated: '1 hr ago',
    },
    {
      id: 'JOB-2839',
      name: 'EMA-Variation-Type-II',
      service: 'Translation',
      status: 'Running',
      updated: '3 hr ago',
    },
    {
      id: 'JOB-2836',
      name: 'ANDA-Quality-Update',
      service: 'Consistency',
      status: 'Completed',
      updated: '2 days ago',
    },
    {
      id: 'JOB-2831',
      name: 'PMDA-Annual-Report',
      service: 'Hyperlinking',
      status: 'Queued',
      updated: '4 days ago',
    },
    {
      id: 'JOB-2828',
      name: 'BLA-CMC-Supplement',
      service: 'Consistency',
      status: 'Failed',
      updated: '02 Jun 2026',
    },
  ];

  quickActions: QuickAction[] = [
    { label: 'Upload submission', icon: Upload, route: '/upload' },
    { label: 'View results', icon: Play, route: '/results' },
    { label: 'Job history', icon: FileText, route: '/history' },
  ];

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    setTimeout(() => this.initChart(), 120);
  }

  ngOnDestroy(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.chart?.destroy();
    this.chart = null;
  }

  statusClass(status: ActivityJob['status']): string {
    const map: Record<ActivityJob['status'], string> = {
      Completed: 'status-completed',
      Running: 'status-running',
      Queued: 'status-queued',
      Failed: 'status-failed',
    };
    return map[status];
  }

  private initChart(): void {
    if (!this.chartRef?.nativeElement) return;

    this.chart = new Chart(this.chartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Hyperlinking', 'Translation', 'Consistency'],
        datasets: [
          {
            data: [42, 28, 30],
            backgroundColor: ['#7c3aed', '#0d9488', '#6366f1'],
            borderWidth: 0,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        animation: {
          animateRotate: true,
          animateScale: true,
          duration: 900,
          easing: 'easeOutQuart',
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 16,
              usePointStyle: true,
              pointStyle: 'circle',
              font: { family: 'Inter, system-ui, sans-serif', size: 12 },
              color: '#64748b',
            },
          },
          tooltip: {
            backgroundColor: '#1e1b4b',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (context) => {
                const data = context.dataset.data as number[];
                const total = data.reduce((a, b) => a + b, 0);
                const value = context.raw as number;
                const percentage = ((value / total) * 100).toFixed(0);

                return `${percentage}%`;
              },
            },
          },
        },
      },
    });
  }
}
