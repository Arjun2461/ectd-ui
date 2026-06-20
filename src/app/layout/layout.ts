import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { LucideAngularModule, LayoutDashboard, Upload, History, ShieldCheck, LogOut } from 'lucide-angular';
import { Toast } from '../shared/toast/toast';
import { HttpClient } from '@angular/common/http';
import { PipelineSseService } from '../core/services/Pipeline-sse.service'
import { FaqBot } from '../shared/faq-bot/faq-bot';

@Component({
  selector: 'app-layout',
  imports: [RouterModule, CommonModule, MatIconModule, LucideAngularModule, Toast,FaqBot],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout {
  private readonly http = inject(HttpClient);
  private readonly pipelineService = inject(PipelineSseService);
  private readonly baseUrl = 'http://127.0.0.1:8000';

  isCollapsed = false;
  LayoutDashboard = LayoutDashboard;
  Upload = Upload;
  History = History;
  ShieldCheck = ShieldCheck;
  LogOut = LogOut;

  toggleSidebar() {
    this.isCollapsed = !this.isCollapsed;
  }

  logout(): void {
    const taskId = this.pipelineService.state$.value.taskId;
    if (taskId) {
      this.http.delete(`${this.baseUrl}/pipeline/${taskId}`).subscribe({
        next: () => {
          console.log('[Layout] Pipeline deleted successfully');
          this.pipelineService.reset();
        },
        error: (e) => console.error('[Layout] Logout/delete error:', e),
      });
    }
  }
}