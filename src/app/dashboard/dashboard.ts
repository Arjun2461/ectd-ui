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
import {
  Chart,
  DoughnutController,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import {
  LucideAngularModule,
  Link2,
  Languages,
  GitCompare,
  Upload,
  Play,
  FileText,
  Sparkles,
} from 'lucide-angular';

Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

export interface ServiceCard {
  title: string;
  description: string;
  icon: typeof Link2;
  route: string;
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

  welcomeTags = ['Hyperlinking', 'Translation', 'Consistency'];

  welcomeStats = [
    { label: 'Active jobs', value: '12' },
    { label: 'Pass rate', value: '98.2%' },
  ];

  services: ServiceCard[] = [
    {
      title: 'Hyperlinking',
      description:
        'AI resolves cross-references across modules and flags broken or ambiguous links.',
      icon: Link2,
      route: '/results',
    },
    {
      title: 'Translation',
      description:
        'Validate multilingual labels and harmonize terminology across regional dossiers.',
      icon: Languages,
      route: '/results',
    },
    {
      title: 'Consistency',
      description:
        'Detect parameter mismatches and narrative drift between sections and versions.',
      icon: GitCompare,
      route: '/consistency',
    },
  ];

  recentJobs: ActivityJob[] = [
    {
      id: 'JOB-2841',
      name: 'NDA-2024-Clinical-Module',
      service: 'Hyperlinking',
      status: 'Completed',
      updated: '12 min ago',
    },
    {
      id: 'JOB-2839',
      name: 'EMA-Variation-Type-II',
      service: 'Translation',
      status: 'Running',
      updated: '34 min ago',
    },
    {
      id: 'JOB-2836',
      name: 'ANDA-Quality-Update',
      service: 'Consistency',
      status: 'Completed',
      updated: '2 hr ago',
    },
    {
      id: 'JOB-2831',
      name: 'PMDA-Annual-Report',
      service: 'Hyperlinking',
      status: 'Queued',
      updated: '5 hr ago',
    },
    {
      id: 'JOB-2828',
      name: 'BLA-CMC-Supplement',
      service: 'Consistency',
      status: 'Failed',
      updated: 'Yesterday',
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
            titleFont: { family: 'Inter, system-ui, sans-serif', size: 12 },
            bodyFont: { family: 'Inter, system-ui, sans-serif', size: 12 },
          },
        },
      },
    });
  }
}
