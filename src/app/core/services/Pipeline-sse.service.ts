import { Injectable, NgZone, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Subject } from 'rxjs';
import {
  HitlHistoryRecord,
  HitlHistoryStatus,
} from '../models/hitl-history.types';
import { HitlHistoryStorage } from './hitl-history.storage';
import {
  isHyperlinkingPhaseCompleteMessage,
  isProgressMilestoneMessage,
  servicesCompletedBeforePhase,
  servicesCompletedByMilestone,
} from '../utils/pipeline-progress.util';

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

// ── Terminal feed (hyperlink panel) ───────────────────────────────────────────

export type TerminalEntryKind = 'progress' | 'file_started' | 'auto_resolved' | 'hitl' | 'error';

export interface TerminalEntry {
  id: string;
  kind: TerminalEntryKind;
  message: string;
  timestamp: number;
  file?: string;
  keyword?: string;
  targetFile?: string;
  targetPage?: number;
  fileIndex?: number;
  totalFiles?: number;
}

// ── Service state ─────────────────────────────────────────────────────────────

export interface PipelineState {
  taskId: string | null;
  status: 'idle' | 'running' | 'awaiting_hitl' | 'completed' | 'error';
  overallProgress: number;       // 0–100, derived from file index
  currentFile: string | null;
  currentFileIndex: number;
  totalFiles: number;
  completedFiles: number;
  autoResolvedCount: number;
  hitlResolvedCount: number;
  logs: string[];
  terminalEntries: TerminalEntry[];
  autoResolved: AutoResolvedEvent[];
  outputs: string[];
  // Active HITL prompt — non-null when status === 'awaiting_hitl'
  activeHitl: HitlRequiredEvent | null;
  hitlHistory: HitlHistoryRecord[];
  /** Set to 100 only when the pipeline fully completes. */
  progressMilestone: number;
  completedServiceIds: string[];
  /** Latest phase number from SSE progress events (1 = consistency, 2 = hyperlinking, …). */
  currentPhase: number;
  /** Services requested when the pipeline was started. */
  selectedServices: string[];
  /** Set when backend logs phase 1 hyperlinking complete — unlocks translation UI. */
  hyperlinkingPhaseComplete: boolean;
}

const INITIAL_STATE: PipelineState = {
  taskId:            null,
  status:            'idle',
  overallProgress:   0,
  currentFile:       null,
  currentFileIndex:  0,
  totalFiles:        0,
  completedFiles:    0,
  autoResolvedCount: 0,
  hitlResolvedCount: 0,
  logs:              [],
  terminalEntries:   [],
  autoResolved:      [],
  outputs:           [],
  activeHitl:          null,
  hitlHistory:         [],
  progressMilestone:   0,
  completedServiceIds: [],
  currentPhase:        0,
  selectedServices:    [],
  hyperlinkingPhaseComplete: false,
};

@Injectable({ providedIn: 'root' })
export class PipelineSseService {
  private readonly http        = inject(HttpClient);
  private readonly ngZone      = inject(NgZone);
  private readonly platformId  = inject(PLATFORM_ID);
  private readonly hitlStorage = inject(HitlHistoryStorage);
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

    const hitlHistory = this.hitlStorage.load(res.task_id);
    this.patch({
      taskId:              res.task_id,
      status:              'running',
      totalFiles:          payload.uploaded_files.length,
      logs:                [],
      terminalEntries:     [],
      autoResolved:        [],
      hitlHistory,
      progressMilestone:   0,
      completedServiceIds: [],
      currentPhase:        0,
      selectedServices:          payload.services,
      hyperlinkingPhaseComplete: false,
    });

    this.openStream(res.task_id);
    return res.task_id;
  }

  // ── HITL responses ─────────────────────────────────────────────────────────

  submitHitl(
    targetFile: string,
    targetPage: number,
    hitlSeqNo: number,
    selectedIndex: number,
  ): void {
    const { taskId, activeHitl } = this.state$.value;
    if (!taskId || !activeHitl) return;

    this.appendCompletedHitl(activeHitl, 'confirmed', selectedIndex, targetFile, targetPage);

    this.http
      .post(`${this.baseUrl}/pipeline/respond-hitl/${taskId}`, {
        target_file: targetFile,
        target_page: targetPage,
      })
      .subscribe({
        error: (e) => console.error('[PipelineSseService] HITL submit error:', e),
      });

    this.patch({ activeHitl: null, status: 'running' });
  }

  skipHitl(hitlSeqNo: number): void {
    const { taskId, activeHitl } = this.state$.value;
    if (!taskId || !activeHitl) return;

    this.appendCompletedHitl(activeHitl, 'skipped', -1);

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

      case 'progress': {
        this.appendLog(event.message);
        this.appendTerminal({
          kind: 'progress',
          message: event.message,
          file: event.file,
        });

        const phasePatch: Partial<PipelineState> = {};
        if (event.phase != null && event.phase > this.state$.value.currentPhase) {
          const completed = new Set([
            ...this.state$.value.completedServiceIds,
            ...servicesCompletedBeforePhase(event.phase),
          ]);
          phasePatch.currentPhase = event.phase;
          phasePatch.completedServiceIds = [...completed];
        }

        if (isProgressMilestoneMessage(event.message)) {
          const completed = new Set([
            ...(phasePatch.completedServiceIds ?? this.state$.value.completedServiceIds),
            ...servicesCompletedByMilestone(event.message),
          ]);
          phasePatch.completedServiceIds = [...completed];
        }

        if (isHyperlinkingPhaseCompleteMessage(event.message)) {
          const completed = new Set([
            ...(phasePatch.completedServiceIds ?? this.state$.value.completedServiceIds),
            'hyperlinking',
          ]);
          phasePatch.completedServiceIds = [...completed];
          phasePatch.hyperlinkingPhaseComplete = true;
        }

        if (Object.keys(phasePatch).length) {
          this.patch(phasePatch);
        }
        break;
      }

      case 'file_started':
        this.patch({
          currentFile:      event.file,
          currentFileIndex: event.file_index,
          totalFiles:       event.total_files,
          overallProgress: Math.round(((event.file_index - 1) / event.total_files) * 100),
        });
        this.appendTerminal({
          kind: 'file_started',
          message: `File ${event.file_index} of ${event.total_files}: ${event.file}`,
          file: event.file,
          fileIndex: event.file_index,
          totalFiles: event.total_files,
        });
        break;

      case 'auto_resolved': {
        const autoResolved = [...this.state$.value.autoResolved, event];
        this.patch({
          autoResolvedCount: event.auto_seq_no,
          autoResolved,
        });
        this.appendTerminal({
          kind: 'auto_resolved',
          message: `Auto-linked "${event.keyword}" → ${event.target_file} (page ${event.target_page})`,
          keyword: event.keyword,
          targetFile: event.target_file,
          targetPage: event.target_page,
        });
        break;
      }

      // ── HITL: pause UI and surface the prompt ───────────────────────────
      case 'hitl_required':
        this.patch({
          status:     'awaiting_hitl',
          activeHitl: event,
        });
        this.appendTerminal({
          kind: 'hitl',
          message: `Review required: "${event.unmapped_keyword_anchor}" in ${event.source_document}`,
          file: event.source_document,
          keyword: event.unmapped_keyword_anchor,
        });
        break;

      case 'hitl_resolved':
        this.applyServerHitlResolution(
          event.hitl_seq_no,
          'confirmed',
          event.target_file,
          event.target_page,
        );
        this.patch({
          status:            'running',
          activeHitl:        null,
          hitlResolvedCount: this.state$.value.hitlResolvedCount + 1,
        });
        break;

      case 'hitl_skipped':
        this.applyServerHitlResolution(event.hitl_seq_no, 'skipped');
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
          status:              'completed',
          overallProgress:     100,
          progressMilestone:   100,
          outputs:             event.outputs,
          activeHitl:          null,
          completedServiceIds: [...this.state$.value.selectedServices],
        });
        this.closeStream();
        break;

      case 'error':
        this.appendLog(`ERROR: ${event.message}`);
        this.appendTerminal({ kind: 'error', message: event.message });
        this.patch({
          status:     'error',
          activeHitl: null,
        });
        this.closeStream();
        break;
    }
  }

  private appendLog(message: string): void {
    this.patch({ logs: [...this.state$.value.logs, message] });
  }

  private appendTerminal(
    entry: Omit<TerminalEntry, 'id' | 'timestamp'>,
  ): void {
    const terminalEntries = [
      ...this.state$.value.terminalEntries,
      {
        ...entry,
        id: `${Date.now()}-${this.state$.value.terminalEntries.length}`,
        timestamp: Date.now(),
      },
    ];
    // Keep the feed bounded for long runs
    const trimmed =
      terminalEntries.length > 200 ? terminalEntries.slice(-200) : terminalEntries;
    this.patch({ terminalEntries: trimmed });
  }

  /** Append a finished HITL row — shown in the table immediately. */
  private appendCompletedHitl(
    event: HitlRequiredEvent,
    status: HitlHistoryStatus,
    selectedIndex: number,
    targetFile?: string,
    targetPage?: number,
  ): void {
    if (status === 'pending') return;

    const history = [...this.state$.value.hitlHistory];
    if (history.some((r) => r.hitlSeqNo === event.hitl_seq_no)) return;

    const record = this.buildHitlRecord(event);
    const selected =
      status === 'confirmed' && selectedIndex >= 0 ?
        record.suggestions[selectedIndex]
      : undefined;

    history.push({
      ...record,
      status,
      selectedIndex: status === 'skipped' ? -1 : selectedIndex,
      selectedTargetFile: targetFile ?? selected?.file,
      selectedTargetPage: targetPage ?? selected?.page,
      userAction:
        status === 'skipped' ? 'Skipped by user'
        : `Confirmed → ${targetFile ?? selected?.file} (p.${targetPage ?? selected?.page ?? '?'})`,
      resolvedAt: Date.now(),
    });
    history.sort((a, b) => a.hitlSeqNo - b.hitlSeqNo);
    this.persistHitlHistory(history);
    this.patch({ hitlHistory: history });
  }

  private applyServerHitlResolution(
    hitlSeqNo: number,
    status: HitlHistoryStatus,
    targetFile?: string,
    targetPage?: number,
  ): void {
    if (this.state$.value.hitlHistory.some((r) => r.hitlSeqNo === hitlSeqNo)) return;

    const active = this.state$.value.activeHitl;
    if (active?.hitl_seq_no === hitlSeqNo) {
      const idx = active.llm_recommendations.findIndex(
        (r) => r.suggested_target_file === targetFile,
      );
      this.appendCompletedHitl(
        active,
        status,
        idx >= 0 ? idx : 0,
        targetFile,
        targetPage,
      );
    }
  }

  private buildHitlRecord(
    event: HitlRequiredEvent,
    status: HitlHistoryStatus = 'confirmed',
  ): HitlHistoryRecord {
    const suggestions = event.llm_recommendations.map((rec, i) => ({
      file: rec.suggested_target_file,
      section: rec.semantic_title_context,
      page: rec.suggested_target_page,
      score: Math.round(100 - i * 12),
      recommended: i === 0,
    }));
    return {
      hitlSeqNo: event.hitl_seq_no,
      status,
      sourceDocument: event.source_document,
      unmappedKeywordAnchor: event.unmapped_keyword_anchor,
      sourceStatement: event.source_statement,
      llmAdvisorJudgment: event.llm_advisor_judgment,
      recommendations: event.llm_recommendations,
      suggestions,
      selectedIndex: 0,
      userAction: '',
      promptedAt: Date.now(),
    };
  }

  private persistHitlHistory(history: HitlHistoryRecord[]): void {
    const taskId = this.state$.value.taskId;
    if (taskId) this.hitlStorage.save(taskId, history);
  }

  private patch(partial: Partial<PipelineState>): void {
    this.state$.next({ ...this.state$.value, ...partial });
  }
}