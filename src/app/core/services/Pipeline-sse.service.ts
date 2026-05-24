import { Injectable, NgZone, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Subject } from 'rxjs';

// ── Event shapes coming from FastAPI SSE stream ───────────────────────────────

export interface ProgressEvent {
  type: 'progress';
  message: string;
  phase?: number;
  file?: string;
}

export interface FileStartedEvent {
  type: 'file_started';
  file: string;
  file_index: number;
  total_files: number;
}

export interface AutoResolvedEvent {
  type: 'auto_resolved';
  auto_seq_no: number;
  keyword: string;
  target_file: string;
  target_page: number;
}

export interface HitlRequiredEvent {
  type: 'hitl_required';
  hitl_seq_no: number;
  source_document: string;
  unmapped_keyword_anchor: string;
  source_statement: string;
  llm_advisor_judgment: string;
  llm_recommendations: HitlRecommendation[];
}

export interface HitlRecommendation {
  option_number: number;
  option_label: string;
  suggested_target_file: string;
  suggested_target_page: number;
  semantic_title_context: string;
}

export interface HitlResolvedEvent {
  type: 'hitl_resolved';
  hitl_seq_no: number;
  target_file: string;
  target_page: number;
}

export interface HitlSkippedEvent {
  type: 'hitl_skipped';
  hitl_seq_no: number;
}

export interface FileCompletedEvent {
  type: 'file_completed';
  file: string;
  output_file: string;
  file_index: number;
  total_files: number;
}

export interface CompletedEvent {
  type: 'completed';
  outputs: string[];
}

export interface ErrorEvent {
  type: 'error';
  message: string;
}

export type PipelineEvent =
  | ProgressEvent
  | FileStartedEvent
  | AutoResolvedEvent
  | HitlRequiredEvent
  | HitlResolvedEvent
  | HitlSkippedEvent
  | FileCompletedEvent
  | CompletedEvent
  | ErrorEvent;

// ── Service state ─────────────────────────────────────────────────────────────

export interface PipelineState {
  taskId: string | null;
  status: 'idle' | 'running' | 'awaiting_hitl' | 'completed' | 'error';
  overallProgress: number;       // 0–100, derived from file index
  currentFile: string | null;
  totalFiles: number;
  completedFiles: number;
  autoResolvedCount: number;
  hitlResolvedCount: number;
  logs: string[];
  outputs: string[];
  // Active HITL prompt — non-null when status === 'awaiting_hitl'
  activeHitl: HitlRequiredEvent | null;
}

const INITIAL_STATE: PipelineState = {
  taskId:            null,
  status:            'idle',
  overallProgress:   0,
  currentFile:       null,
  totalFiles:        0,
  completedFiles:    0,
  autoResolvedCount: 0,
  hitlResolvedCount: 0,
  logs:              [],
  outputs:           [],
  activeHitl:        null,
};

@Injectable({ providedIn: 'root' })
export class PipelineSseService {
  private readonly http        = inject(HttpClient);
  private readonly ngZone      = inject(NgZone);
  private readonly platformId  = inject(PLATFORM_ID);
  private readonly baseUrl     = "http://localhost:8000";

  // Public reactive state
  readonly state$ = new BehaviorSubject<PipelineState>({ ...INITIAL_STATE });

  // Fine-grained event stream — components can subscribe to specific event types
  readonly events$ = new Subject<PipelineEvent>();

  private eventSource: EventSource | null = null;

  // ── Start pipeline + open SSE stream ───────────────────────────────────────

  async startPipeline(payload: {
    uploaded_files: string[];
    services: string[];
    target_language: string;
  }): Promise<string> {
    const res = await this.http
      .post<{ task_id: string; stream_url: string }>(
        `${this.baseUrl}/pipeline/start`,
        payload,
      )
      .toPromise();

    if (!res?.task_id) throw new Error('No task_id returned from server');

    this.patch({
      taskId:     res.task_id,
      status:     'running',
      totalFiles: payload.uploaded_files.length,
      logs:       [],
    });

    this.openStream(res.task_id);
    return res.task_id;
  }

  // ── HITL responses ─────────────────────────────────────────────────────────

  submitHitl(targetFile: string, targetPage: number): void {
    const { taskId } = this.state$.value;
    if (!taskId) return;

    this.http
      .post(`${this.baseUrl}/pipeline/respond-hitl/${taskId}`, {
        target_file: targetFile,
        target_page: targetPage,
      })
      .subscribe({
        error: (e) => console.error('[PipelineSseService] HITL submit error:', e),
      });

    // Optimistically clear the HITL prompt — the stream will confirm with hitl_resolved
    this.patch({ activeHitl: null, status: 'running' });
  }

  skipHitl(): void {
    const { taskId } = this.state$.value;
    if (!taskId) return;

    this.http
      .post(`${this.baseUrl}/pipeline/skip-hitl/${taskId}`, {})
      .subscribe({
        error: (e) => console.error('[PipelineSseService] HITL skip error:', e),
      });

    this.patch({ activeHitl: null, status: 'running' });
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  reset(): void {
    this.closeStream();
    this.state$.next({ ...INITIAL_STATE });
  }

  // ── Internal: SSE plumbing ─────────────────────────────────────────────────

  private openStream(taskId: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.closeStream();

    const url = `${this.baseUrl}/pipeline/stream/${taskId}`;
    console.log('[PipelineSseService] Opening SSE stream:', url);

    // EventSource runs outside Angular zone — we re-enter on each message
    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = (raw) => {
      this.ngZone.run(() => {
        try {
          const event: PipelineEvent = JSON.parse(raw.data);
          this.handleEvent(event);
        } catch {
          console.warn('[PipelineSseService] Could not parse event:', raw.data);
        }
      });
    };

    this.eventSource.onerror = () => {
      // Browser auto-reconnects on transient errors — only log here
      console.warn('[PipelineSseService] SSE connection error (will auto-reconnect)');
    };
  }

  private closeStream(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private handleEvent(event: PipelineEvent): void {
    // Emit on the fine-grained stream first
    this.events$.next(event);

    switch (event.type) {

      case 'progress':
        this.patch({
          logs: [...this.state$.value.logs, event.message],
        });
        break;

      case 'file_started':
        this.patch({
          currentFile:     event.file,
          totalFiles:      event.total_files,
          overallProgress: Math.round(((event.file_index - 1) / event.total_files) * 100),
        });
        break;

      case 'auto_resolved':
        this.patch({ autoResolvedCount: event.auto_seq_no });
        break;

      // ── HITL: pause UI and surface the prompt ───────────────────────────
      case 'hitl_required':
        this.patch({
          status:     'awaiting_hitl',
          activeHitl: event,
        });
        break;

      case 'hitl_resolved':
        this.patch({
          status:           'running',
          activeHitl:       null,
          hitlResolvedCount: this.state$.value.hitlResolvedCount + 1,
        });
        break;

      case 'hitl_skipped':
        this.patch({
          status:     'running',
          activeHitl: null,
        });
        break;

      case 'file_completed': {
        const completed = event.file_index;
        this.patch({
          completedFiles:  completed,
          overallProgress: Math.round((completed / event.total_files) * 100),
          outputs:         [...this.state$.value.outputs, event.output_file],
        });
        break;
      }

      case 'completed':
        this.patch({
          status:          'completed',
          overallProgress: 100,
          outputs:         event.outputs,
          activeHitl:      null,
        });
        this.closeStream();
        break;

      case 'error':
        this.patch({
          status:     'error',
          activeHitl: null,
          logs:       [...this.state$.value.logs, `ERROR: ${event.message}`],
        });
        this.closeStream();
        break;
    }
  }

  private patch(partial: Partial<PipelineState>): void {
    this.state$.next({ ...this.state$.value, ...partial });
  }
}