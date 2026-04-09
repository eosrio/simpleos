import { Injectable, signal, computed } from '@angular/core';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { AlertService } from './alert.service';

@Injectable({
  providedIn: 'root'
})
export class UpdateService {
  private update = signal<Update | null>(null);

  isUpdateAvailable = computed(() => !!this.update());
  newVersion = computed(() => this.update()?.version ?? '');
  isChecking = signal(false);
  isDownloading = signal(false);
  downloadProgress = signal(0);

  constructor(private alert: AlertService) {}

  async checkForUpdates(silent = false) {
    if (this.isChecking()) return;
    this.isChecking.set(true);

    try {
      const update = await check();
      this.update.set(update);

      if (update && !silent) {
        this.alert.success(`Update available: v${update.version}`);
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
      if (!silent) {
        this.alert.error('Update check failed');
      }
    } finally {
      this.isChecking.set(false);
    }
  }

  async installUpdate() {
    const update = this.update();
    if (!update || this.isDownloading()) return;

    this.isDownloading.set(true);
    this.downloadProgress.set(0);

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
      this.alert.error('Failed to install update');
      this.isDownloading.set(false);
    }
  }
}
