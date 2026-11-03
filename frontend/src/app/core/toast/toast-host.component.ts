import { Component, inject } from '@angular/core';
import { IconCheck, IconInfoCircle, IconX, TablerIconComponent } from '@tabler/icons-angular';
import { ToastMessage, ToastService } from './toast.service';

@Component({
  selector: 'app-toast-host',
  imports: [TablerIconComponent],
  templateUrl: './toast-host.component.html',
  styleUrl: './toast-host.component.scss',
})
export class ToastHostComponent {
  private readonly toastService = inject(ToastService);

  readonly iconCheck = IconCheck;
  readonly iconInfo = IconInfoCircle;
  readonly iconClose = IconX;

  readonly toasts = this.toastService.toasts;

  dismiss(toast: ToastMessage): void {
    this.toastService.dismiss(toast.id);
  }

  runAction(toast: ToastMessage): void {
    this.toastService.runAction(toast);
  }

  iconFor(toast: ToastMessage) {
    if (toast.tone === 'danger') return this.iconClose;
    if (toast.tone === 'info') return this.iconInfo;
    return this.iconCheck;
  }
}
