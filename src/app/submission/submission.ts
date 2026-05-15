import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { JobService } from '../core/services/job.service';
import { ToastService } from '../core/services/toast.service';

interface ModuleFile {
  id: string;
  file: File;
}

interface Module {
  tag: string;
  title: string;
  description: string;
  files: ModuleFile[];
  dragOver: boolean;
}

interface Service {
  id: string;
  icon: string;
  title: string;
  description: string;
  selected: boolean;
}

const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.xml'];

@Component({
  selector: 'app-submission',
  imports: [FormsModule],
  templateUrl: './submission.html',
  styleUrl: './submission.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Submission {
  private readonly jobService = inject(JobService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  private fileIdCounter = 0;

  readonly modules = signal<Module[]>([
    {
      tag: 'M1',
      title: 'Module 1',
      description: 'Regional Administrative Information',
      files: [],
      dragOver: false,
    },
    {
      tag: 'M2',
      title: 'Module 2',
      description: 'Common Technical Document Summaries',
      files: [],
      dragOver: false,
    },
    {
      tag: 'M3',
      title: 'Module 3',
      description: 'Quality (CMC)',
      files: [],
      dragOver: false,
    },
    {
      tag: 'M4',
      title: 'Module 4',
      description: 'Nonclinical Study Reports',
      files: [],
      dragOver: false,
    },
    {
      tag: 'M5',
      title: 'Module 5',
      description: 'Clinical Study Reports',
      files: [],
      dragOver: false,
    },
  ]);

  readonly services = signal<Service[]>([
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
  ]);

  readonly targetLanguage = signal('');
  readonly isRunning = signal(false);

  readonly selectedCount = computed(
    () => this.services().filter((s) => s.selected).length
  );

  readonly selectedServiceIds = computed(() =>
    this.services()
      .filter((s) => s.selected)
      .map((s) => s.id)
  );

  readonly translationSelected = computed(() =>
    this.services().some((s) => s.id === 'translation' && s.selected)
  );

  readonly totalFiles = computed(() =>
    this.modules().reduce((sum, mod) => sum + mod.files.length, 0)
  );

  readonly modulesWithFiles = computed(
    () => this.modules().filter((mod) => mod.files.length > 0).length
  );

  readonly canRun = computed(() => {
    if (this.selectedCount() === 0 || this.isRunning()) return false;
    if (this.translationSelected() && !this.targetLanguage().trim()) {
      return false;
    }
    return true;
  });

  readonly languageOptions = [
    'English',
    'French',
    'German',
    'Spanish',
    'Italian',
    'Portuguese',
    'Japanese',
    'Chinese (Simplified)',
    'Korean',
    'Arabic',
  ];

  toggleService(service: Service): void {
    this.services.update((list) =>
      list.map((s) =>
        s.id === service.id ? { ...s, selected: !s.selected } : s
      )
    );
  }

  onDragOver(event: DragEvent, tag: string): void {
    event.preventDefault();
    this.setModuleDragOver(tag, true);
  }

  onDragLeave(tag: string): void {
    this.setModuleDragOver(tag, false);
  }

  onDrop(event: DragEvent, tag: string): void {
    event.preventDefault();
    this.setModuleDragOver(tag, false);
    const files = event.dataTransfer?.files;
    if (files?.length) {
      this.addFilesToModule(tag, Array.from(files));
    }
  }

  onFileSelect(event: Event, tag: string): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.addFilesToModule(tag, Array.from(input.files));
      input.value = '';
    }
  }

  triggerFileInput(index: number, event?: Event): void {
    event?.stopPropagation();
    const input = document.getElementById(
      'file-input-' + index
    ) as HTMLInputElement | null;
    input?.click();
  }

  removeFile(event: Event, tag: string, fileId: string): void {
    event.stopPropagation();
    this.modules.update((list) =>
      list.map((mod) =>
        mod.tag === tag
          ? { ...mod, files: mod.files.filter((f) => f.id !== fileId) }
          : mod
      )
    );
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  runPipeline(): void {
    if (!this.canRun()) return;

    this.isRunning.set(true);
    const language = this.translationSelected()
      ? this.targetLanguage().trim()
      : undefined;

    this.jobService.createJob(this.selectedServiceIds(), { targetLanguage: language });
    this.toast.show('Pipeline started successfully');

    setTimeout(() => {
      this.isRunning.set(false);
      this.router.navigate(['/results']);
    }, 600);
  }

  private setModuleDragOver(tag: string, dragOver: boolean): void {
    this.modules.update((list) =>
      list.map((mod) => (mod.tag === tag ? { ...mod, dragOver } : mod))
    );
  }

  private addFilesToModule(tag: string, incoming: File[]): void {
    const accepted = incoming.filter((file) => this.isAcceptedFile(file));
    if (!accepted.length) return;

    const newEntries: ModuleFile[] = accepted.map((file) => ({
      id: `file-${++this.fileIdCounter}`,
      file,
    }));

    this.modules.update((list) =>
      list.map((mod) =>
        mod.tag === tag ? { ...mod, files: [...mod.files, ...newEntries] } : mod
      )
    );
  }

  private isAcceptedFile(file: File): boolean {
    const name = file.name.toLowerCase();
    return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
  }
}
