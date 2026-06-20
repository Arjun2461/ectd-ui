import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  createDemoPdfFile,
  demoFileNamesForModule,
} from '../../core/data/draft-demo-files';
import {
  DraftHistoryEntry,
  DraftSourceModule,
} from '../../core/models/draft-history.types';
import { DraftHistoryService } from '../../core/services/draft-history.service';
import { ToastService } from '../../core/services/toast.service';

interface ModuleFile {
  id: string;
  file: File;
}

interface DraftModule {
  tag:  'M3' | 'M4' | 'M5';
  title: string;
  description: string;
  files: ModuleFile[];
  dragOver: boolean;
}

type DraftStatus = 'idle' | 'running' | 'completed';

const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.xml'];
const SIMULATION_DURATION_MS = 10_000;
const PROGRESS_TICK_MS = 500;

const DRAFT_MODULES: Omit<DraftModule, 'files' | 'dragOver'>[] = [
  {
    tag: 'M3',
    title: 'Module 3',
    description: 'Quality (CMC)',
  },
  {
    tag: 'M4',
    title: 'Module 4',
    description: 'Nonclinical Study Reports',
  },
  {
    tag: 'M5',
    title: 'Module 5',
    description: 'Clinical Study Reports',
  },
];

const PROGRESS_MESSAGES: { max: number; text: string }[] = [
  { max: 15, text: 'Parsing uploaded module structure…' },
  { max: 35, text: 'Analyzing M3 administrative content…' },
  { max: 55, text: 'Processing M3 quality (CMC) sections…' },
  { max: 75, text: 'Extracting nonclinical data from M4…' },
  { max: 90, text: 'Synthesizing clinical insights from M5…' },
  { max: 99, text: 'Drafting Module 2 CTD summaries…' },
  { max: 100, text: 'M2 summaries generated successfully.' },
];

@Component({
  selector: 'app-generate-draft',
  templateUrl: './generate-draft.html',
  styleUrl: './generate-draft.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenerateDraft implements OnInit {
  private readonly toast = inject(ToastService);
  private readonly draftHistory = inject(DraftHistoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private fileIdCounter = 0;
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private simulationStartedAt = 0;
  private activeDraftId: string | null = null;

  readonly modules = signal<DraftModule[]>(
    DRAFT_MODULES.map((mod) => ({ ...mod, files: [], dragOver: false })),
  );

  readonly status = signal<DraftStatus>('idle');
  readonly progress = signal(0);
  readonly progressMessage = signal('');
  readonly viewingDraftId = signal<string | null>(null);

  readonly totalFiles = computed(() =>
    this.modules().reduce((sum, mod) => sum + mod.files.length, 0),
  );

  readonly modulesWithFiles = computed(
    () => this.modules().filter((mod) => mod.files.length > 0).length,
  );

  readonly isRunning = computed(() => this.status() === 'running');
  readonly isCompleted = computed(() => this.status() === 'completed');

  readonly canCreate = computed(
    () => this.totalFiles() > 0 && this.status() === 'idle',
  );

  readonly estimatedTimeLabel = computed(() => {
    if (!this.isRunning()) return '';
    const _tick = this.progress();
    const remaining = Math.max(
      0,
      SIMULATION_DURATION_MS * (1 - _tick / 100),
    );
    const mins = Math.ceil(remaining / 60_000);
    return mins <= 1 ? '~1 min remaining' : `~${mins} min remaining`;
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.clearProgressTimer());
  }

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const draftId = params.get('draftId');
        if (!draftId) return;
        const entry = this.draftHistory.getDraftById(draftId);
        if (entry) this.restoreFromHistory(entry);
      });
  }

  onDragOver(event: DragEvent, tag: DraftModule['tag']): void {
    event.preventDefault();
    this.setModuleDragOver(tag, true);
  }

  onDragLeave(tag: DraftModule['tag']): void {
    this.setModuleDragOver(tag, false);
  }

  onDrop(event: DragEvent, tag: DraftModule['tag']): void {
    event.preventDefault();
    this.setModuleDragOver(tag, false);
    const files = event.dataTransfer?.files;
    if (files?.length) this.addFilesToModule(tag, Array.from(files));
  }

  onFileSelect(event: Event, tag: DraftModule['tag']): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.addFilesToModule(tag, Array.from(input.files));
      input.value = '';
    }
  }

  triggerFileInput(index: number, event?: Event): void {
    event?.stopPropagation();
    const input = document.getElementById(
      'draft-file-input-' + index,
    ) as HTMLInputElement | null;
    input?.click();
  }

  removeFile(event: Event, tag: DraftModule['tag'], fileId: string): void {
    event.stopPropagation();
    this.modules.update((list) =>
      list.map((mod) =>
        mod.tag === tag
          ? { ...mod, files: mod.files.filter((f) => f.id !== fileId) }
          : mod,
      ),
    );
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  createM2Summaries(): void {
    if (!this.canCreate()) return;

    this.viewingDraftId.set(null);
    this.clearDraftQueryParam();

    const sourceModules = this.getUploadedSourceModules();
    const entry = this.draftHistory.createDraft(
      sourceModules,
      this.totalFiles(),
    );
    this.activeDraftId = entry.id;

    this.status.set('running');
    this.progress.set(0);
    this.progressMessage.set(PROGRESS_MESSAGES[0].text);
    this.simulationStartedAt = Date.now();

    this.progressTimer = setInterval(() => {
      const elapsed = Date.now() - this.simulationStartedAt;
      const pct = Math.min(100, Math.floor((elapsed / SIMULATION_DURATION_MS) * 100));
      this.progress.set(pct);
      this.progressMessage.set(this.messageForProgress(pct));

      if (this.activeDraftId) {
        this.draftHistory.updateProgress(this.activeDraftId, pct);
      }

      if (pct >= 100) {
        this.clearProgressTimer();
        this.status.set('completed');
        if (this.activeDraftId) {
          this.draftHistory.completeDraft(this.activeDraftId);
          this.activeDraftId = null;
        }
        this.toast.show('M2 summaries ready to download');
      }
    }, PROGRESS_TICK_MS);

    this.toast.show('M2 summary generation started (~2 min)');
  }

  loadDemoUploads(): void {
    if (this.isRunning() || this.isCompleted()) return;

    this.modules.update((list) =>
      list.map((mod) => ({
        ...mod,
        files: demoFileNamesForModule(mod.tag).map((baseName, i) => ({
          id: `demo-${mod.tag}-${i}`,
          file: createDemoPdfFile(baseName),
        })),
        dragOver: false,
      })),
    );
    this.toast.show('Sample documents loaded');
  }

  downloadM2Zip(): void {
    this.draftHistory.downloadOutputZip();
    this.toast.show('Output package downloaded');
  }

  resetDraft(): void {
    this.clearProgressTimer();
    this.draftHistory.clearActiveDraft();
    this.activeDraftId = null;
    this.viewingDraftId.set(null);
    this.status.set('idle');
    this.progress.set(0);
    this.progressMessage.set('');
    this.modules.set(
      DRAFT_MODULES.map((mod) => ({ ...mod, files: [], dragOver: false })),
    );
    this.clearDraftQueryParam();
  }

  private restoreFromHistory(entry: DraftHistoryEntry): void {
    this.clearProgressTimer();
    this.viewingDraftId.set(entry.id);
    this.modules.set(this.buildModulesFromHistory(entry));

    if (entry.status === 'completed') {
      this.activeDraftId = null;
      this.status.set('completed');
      this.progress.set(100);
      this.progressMessage.set(
        PROGRESS_MESSAGES[PROGRESS_MESSAGES.length - 1].text,
      );
      return;
    }

    this.activeDraftId = entry.id;
    this.status.set('running');
    this.progress.set(entry.overallProgress);
    this.progressMessage.set(this.messageForProgress(entry.overallProgress));
  }

  private buildModulesFromHistory(entry: DraftHistoryEntry): DraftModule[] {
    return DRAFT_MODULES.map((mod) => {
      if (!entry.sourceModules.includes(mod.tag)) {
        return { ...mod, files: [], dragOver: false };
      }

      const files: ModuleFile[] = demoFileNamesForModule(mod.tag).map(
        (baseName, i) => ({
          id: `hist-${entry.id}-${mod.tag}-${i}`,
          file: createDemoPdfFile(baseName),
        }),
      );

      return { ...mod, files, dragOver: false };
    });
  }

  private clearDraftQueryParam(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { draftId: null },
      queryParamsHandling: 'merge',
    });
  }

  private getUploadedSourceModules(): DraftSourceModule[] {
    return this.modules()
      .filter((mod) => mod.files.length > 0)
      .map((mod) => mod.tag);
  }

  private messageForProgress(pct: number): string {
    return (
      PROGRESS_MESSAGES.find((step) => pct <= step.max)?.text ??
      PROGRESS_MESSAGES[PROGRESS_MESSAGES.length - 1].text
    );
  }

  private clearProgressTimer(): void {
    if (this.progressTimer !== null) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  private setModuleDragOver(tag: DraftModule['tag'], dragOver: boolean): void {
    this.modules.update((list) =>
      list.map((mod) => (mod.tag === tag ? { ...mod, dragOver } : mod)),
    );
  }

  private addFilesToModule(tag: DraftModule['tag'], incoming: File[]): void {
    const accepted = incoming.filter((file) => this.isAcceptedFile(file));
    if (!accepted.length) return;

    const newEntries: ModuleFile[] = accepted.map((file) => ({
      id: `file-${++this.fileIdCounter}`,
      file,
    }));

    this.modules.update((list) =>
      list.map((mod) =>
        mod.tag === tag ? { ...mod, files: [...mod.files, ...newEntries] } : mod,
      ),
    );
  }

  private isAcceptedFile(file: File): boolean {
    const name = file.name.toLowerCase();
    return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
  }
}
