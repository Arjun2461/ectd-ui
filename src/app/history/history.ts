import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-history',
  imports: [CommonModule],
  templateUrl: './history.html',
  styleUrl: './history.css',
})
export class History {
  jobs = [
    {
      id: 'JOB-10293',
      date: 'May 11, 2026',
      modules: ['M2', 'M3'],
      services: 'Consistency, Hyperlinking',
      status: 'completed'
    },
    {
      id: 'JOB-10288',
      date: 'May 10, 2026',
      modules: ['M5'],
      services: 'Translation',
      status: 'processing'
    },
    {
      id: 'JOB-10271',
      date: 'May 09, 2026',
      modules: ['M2','M3', 'M4','M5'],
      services: 'Consistency',
      status: 'completed'
    },
    {
      id: 'JOB-10254',
      date: 'May 07, 2026',
      modules: ['M2'],
      services: 'Hyperlinking',
      status: 'error'
    },
    {
      id: 'JOB-10241',
      date: 'May 05, 2026',
      modules: ['M2', 'M3', 'M5'],
      services: 'Consistency, Translation, Hyperlinking',
      status: 'completed'
    },
    {
      id: 'JOB-10227',
      date: 'May 03, 2026',
      modules: ['M4'],
      services: 'Translation',
      status: 'completed'
    }
  ];

  getStatusLabel(status: string) {
    if (status === 'completed') return 'Completed';
    if (status === 'processing') return 'Processing';
    return 'Error';
  }
}
