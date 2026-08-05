import { Injectable, signal, computed } from '@angular/core';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { AlertService } from './alert.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class UpdateService {
  private update = signal<Update | null>(null);
  private checkedAt = signal<number | null>(null);

  isUpdateAvailable = computed(() => !!this.update());
  newVersion = computed(() => this.update()?.version ?? '');
  /** Release notes published with the update, when the manifest carries any. */
  releaseNotes = computed(() => this.update()?.body?.trim() ?? '');
  isChecking = signal(false);
  isDownloading = signal(false);
  downloadProgress = signal(0);
  /** Message from the last failed check or install, cleared when the next one starts. */
  lastError = signal('');

  /** True once a check has completed and found nothing newer. */
  isUpToDate = computed(() => this.checkedAt() !== null && !this.update() && !this.lastError());

  /** Local time of the last completed check, or an empty string before the first one. */
  lastCheckedLabel = computed(() => {
    const timestamp = this.checkedAt();
    return timestamp === null ? '' : new Date(timestamp).toLocaleTimeString();
  });

  /**
   * Whether this build manages its own updates. Mac App Store builds ship without the
   * updater plugin — Apple delivers those, so the UI hides the section entirely.
   */
  readonly enabled = !environment.appStore;

  constructor(private alert: AlertService) {}

  async checkForUpdates(silent = false) {
    if (environment.appStore) return;
    if (this.isChecking()) return;
    this.isChecking.set(true);
    this.lastError.set('');

    try {
      const update = await check();
      this.update.set(update);
      this.checkedAt.set(Date.now());

      if (!silent) {
        if (update) {
          this.alert.success(`Update available: v${update.version}`);
        } else {
          this.alert.success('SimplEOS is up to date');
        }
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
      // Surfaced in the Settings panel even for background checks, so a persistently
      // unreachable manifest is visible instead of failing silently forever.
      this.lastError.set(this.describe(error));
      if (!silent) {
        this.alert.error('Update check failed');
      }
    } finally {
      this.isChecking.set(false);
    }
  }

  private describe(error: unknown): string {
    const text = error instanceof Error ? error.message : String(error);
    return text.length > 160 ? `${text.slice(0, 157)}…` : text;
  }

  async installUpdate() {
    if (environment.appStore) return;
    const update = this.update();
    if (!update || this.isDownloading()) return;

    this.isDownloading.set(true);
    this.downloadProgress.set(0);
    this.lastError.set('');

    try {
      let downloaded = 0;
      let contentLength: number | undefined = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength) {
              this.downloadProgress.set(Math.round((downloaded / contentLength) * 100));
            }
            break;
          case 'Finished':
            this.downloadProgress.set(100);
            break;
        }
      });

      this.alert.success('Update installed, relaunching...');
      await relaunch();
    } catch (error) {
      console.error('Update installation failed:', error);
      this.lastError.set(this.describe(error));
      this.alert.error('Failed to install update');
      this.isDownloading.set(false);
    }
  }
}
