import { Injectable, computed, signal } from '@angular/core';
import { getVersion } from '@tauri-apps/api/app';

/**
 * The running app's version — the single place the UI reads it from.
 *
 * The number itself is declared once, in `package.json`. `tauri.conf.json`
 * points at that file (`"version": "../package.json"`), so the bundle
 * metadata, the updater and this service all resolve to the same value and
 * cannot drift. Never hard-code a version string in a template.
 *
 * Outside Tauri (the browser-only `bun run start` dev server) there is no
 * bundle to ask, so the version reads as `dev`.
 */
@Injectable({ providedIn: 'root' })
export class AppVersionService {
  private readonly _version = signal<string | null>(null);

  /** Raw semver of the running bundle, or `null` until resolved / outside Tauri. */
  readonly version = this._version.asReadonly();

  /** Display form: `v2.0.0-alpha.2`, or `dev` in the browser dev server. */
  readonly display = computed(() => {
    const version = this._version();
    return version ? `v${version}` : 'dev';
  });

  constructor() {
    getVersion()
      .then((version) => this._version.set(version))
      .catch(() => {
        // No Tauri backend (browser dev server) — stay on the `dev` label.
      });
  }
}
