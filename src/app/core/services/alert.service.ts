import { Injectable, signal } from '@angular/core';

export type AlertLevel = 'info' | 'success' | 'warning' | 'error';

export interface AlertMessage {
  id: number;
  level: AlertLevel;
  text: string;
  /** Auto-dismiss after this many ms. 0 = sticky (user must dismiss). */
  duration: number;
}

let nextId = 0;

@Injectable({ providedIn: 'root' })
export class AlertService {
  readonly alerts = signal<AlertMessage[]>([]);

  show(text: string, level: AlertLevel = 'info', duration = 5000) {
    const id = ++nextId;
    this.alerts.update(list => [...list, { id, level, text, duration }]);
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
  }

  info(text: string, duration = 5000) { this.show(text, 'info', duration); }
  success(text: string, duration = 4000) { this.show(text, 'success', duration); }
  warning(text: string, duration = 6000) { this.show(text, 'warning', duration); }
  error(text: string, duration = 8000) { this.show(text, 'error', duration); }

  dismiss(id: number) {
    this.alerts.update(list => list.filter(a => a.id !== id));
  }
}
