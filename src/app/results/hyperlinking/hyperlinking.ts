
import {
  Component,
  Input,
  Output,
  EventEmitter,
  AfterViewInit,
  ViewChild,
  ElementRef
} from '@angular/core';

import {
  Chart,
  DoughnutController,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import { CommonModule } from '@angular/common'; 

Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

@Component({
  selector: 'app-hyperlinking',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hyperlinking.html',
  styleUrl: './hyperlinking.css',
})
export class Hyperlinking implements AfterViewInit {

  @Input() hitlEvent: any;
  @Input() hitlSuggestions: any[] = [];
  @Input() resolvedRefs: any[] = [];

  @Output() openPopup = new EventEmitter<void>();

  @ViewChild('donutChart') donutRef!: ElementRef<HTMLCanvasElement>;
  chart: Chart | null = null;

  ngAfterViewInit() {
    setTimeout(() => this.initChart(), 100);
  }

  initChart() {
    if (!this.donutRef) return;

    this.chart = new Chart(this.donutRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Linked', 'Broken', 'Missing'],
        datasets: [{
          data: [1284, 47, 82],
          backgroundColor: ['#0d9488', '#ef4444', '#64748b'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  openHITL() {
    this.openPopup.emit();
  }

  expandedIndex: number | null = null;

toggleRow(i: number) {
  this.expandedIndex = this.expandedIndex === i ? null : i;
}

selectOption(i: number) {
  this.hitlEvent.selected = i;
}
}
