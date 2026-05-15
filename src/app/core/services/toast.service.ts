import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface ToastMessage {
  id: number;
  text: string;
  type: 'success' | 'info' | 'error';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly platformId = inject(PLATFORM_ID);
  private nextId = 1;
  readonly toasts = signal<ToastMessage[]>([]);

  show(text: string, type: ToastMessage['type'] = 'success', durationMs = 4000): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const id = this.nextId++;
    this.toasts.update((list) => [...list, { id, text, type }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
