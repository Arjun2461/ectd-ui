import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { JobService } from '../core/services/job.service';
import { ToastService } from '../core/services/toast.service';

interface Module {
  tag: string;
  title: string;
  description: string;
  file: File | null;
  dragOver: boolean;
}

interface Service {
  id: string;
  icon: string;
  title: string;
  description: string;
  selected: boolean;
}

@Component({
  selector: 'app-submission',
  imports: [CommonModule],
  templateUrl: './submission.html',
  styleUrl: './submission.css',
})
export class Submission {
  private readonly jobService = inject(JobService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  modules: Module[] = [
    {
      tag: 'M1',
      title: 'Module 1',
      description: 'Regional Administrative Information',
      file: null,
      dragOver: false,
    },
    {
      tag: 'M2',
      title: 'Module 2',
      description: 'Common Technical Document Summaries',
      file: null,
      dragOver: false,
    },
    {
      tag: 'M3',
      title: 'Module 3',
      description: 'Quality (CMC)',
      file: null,
      dragOver: false,
    },
    {
      tag: 'M4',
      title: 'Module 4',
      description: 'Nonclinical Study Reports',
      file: null,
      dragOver: false,
    },
    {
      tag: 'M5',
      title: 'Module 5',
      description: 'Clinical Study Reports',
      file: null,
      dragOver: false,
    },
  ];

  services: Service[] = [
    {
      id: 'hyperlinking',
      icon: 'ti ti-link',
      title: 'Hyperlinking',
      description: 'Auto-generate cross-document hyperlinks.',
      selected: false,
    },
    {
      id: 'consistency',
      icon: 'ti ti-file-description',
      title: 'Consistency',
      description: 'Find terminology, numerical, and cross-reference issues.',
      selected: true,
    },
    {
      id: 'translation',
      icon: 'ti ti-language',
      title: 'Translation',
      description: 'Translate dossiers across regulatory languages.',
      selected: false,
    },
  ];

  get selectedCount(): number {
    return this.services.filter((s) => s.selected).length;
  }

  get selectedServiceIds(): string[] {
    return this.services.filter((s) => s.selected).map((s) => s.id);
  }

  toggleService(service: Service): void {
    service.selected = !service.selected;
  }

  onDragOver(event: DragEvent, mod: Module): void {
    event.preventDefault();
    mod.dragOver = true;
  }

  onDragLeave(mod: Module): void {
    mod.dragOver = false;
  }

  onDrop(event: DragEvent, mod: Module): void {
    event.preventDefault();
    mod.dragOver = false;
    const file = event.dataTransfer?.files[0];
    if (file) mod.file = file;
  }

  onFileSelect(event: Event, mod: Module): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) mod.file = input.files[0];
  }

  triggerFileInput(index: number): void {
    const input = document.getElementById(
      'file-input-' + index
    ) as HTMLInputElement;
    input?.click();
  }

  runPipeline(): void {
    if (this.selectedCount === 0) return;

    this.jobService.createJob(this.selectedServiceIds);
    this.toast.show('Pipeline started successfully');
    this.router.navigate(['/results']);
  }
}
