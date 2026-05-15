import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.html',
  styleUrl: './toast.css',
})
export class Toast {
  readonly toastService = inject(ToastService);

  iconFor(type: string): string {
    switch (type) {
      case 'error':
        return 'ti-alert-circle';
      case 'info':
        return 'ti-info-circle';
      default:
        return 'ti-circle-check';
    }
  }
}
