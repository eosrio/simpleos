import { Component, inject } from '@angular/core';
import { AlertService } from '../core/services/alert.service';

@Component({
  selector: 'app-alert-panel',
  standalone: true,
  template: `
    @if (alert.alerts().length > 0) {
      <div class="alert-stack">
        @for (a of alert.alerts(); track a.id) {
          <div class="alert-item" [class]="a.level" (click)="alert.dismiss(a.id)">
            <span class="alert-icon">
              @switch (a.level) {
                @case ('success') { <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> }
                @case ('error') { <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> }
                @case ('warning') { <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> }
                @default { <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> }
              }
            </span>
            <span class="alert-text">{{ a.text }}</span>
            <button class="alert-close" (click)="$event.stopPropagation(); alert.dismiss(a.id)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .alert-stack {
      position: fixed;
      top: var(--sp-4, 16px);
      right: var(--sp-4, 16px);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: var(--sp-2, 8px);
      max-width: 420px;
      pointer-events: none;
    }
    .alert-item {
      display: flex;
      align-items: flex-start;
      gap: var(--sp-2, 8px);
      padding: var(--sp-3, 12px) var(--sp-4, 16px);
      border-radius: var(--radius-md, 8px);
      border: 1px solid var(--border-subtle);
      background: var(--bg-raised);
      color: var(--text-body);
      font-size: 13px;
      line-height: 1.4;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      pointer-events: auto;
      cursor: pointer;
      animation: slideIn 200ms ease-out;
    }
    .alert-item.error { border-color: var(--negative); }
    .alert-item.error .alert-icon { color: var(--negative); }
    .alert-item.warning { border-color: #f5a623; }
    .alert-item.warning .alert-icon { color: #f5a623; }
    .alert-item.success { border-color: var(--positive); }
    .alert-item.success .alert-icon { color: var(--positive); }
    .alert-item.info { border-color: var(--accent); }
    .alert-item.info .alert-icon { color: var(--accent); }
    .alert-icon { flex-shrink: 0; margin-top: 1px; }
    .alert-text { flex: 1; word-break: break-word; }
    .alert-close {
      flex-shrink: 0;
      background: none;
      border: none;
      color: var(--text-disabled);
      cursor: pointer;
      padding: 2px;
      margin: -2px -4px -2px 0;
    }
    .alert-close:hover { color: var(--text-body); }
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }
  `],
})
export class AlertPanelComponent {
  alert = inject(AlertService);
}
