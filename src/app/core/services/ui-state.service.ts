import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UiStateService {
  /** When true, the dashboard hides the sidebar and account tabs for fullscreen content */
  readonly fullscreen = signal(false);
}
