import { Component } from '@angular/core';

@Component({
  selector: 'app-about',
  standalone: true,
  template: `
    <div class="about-view">
      <div class="about-header">
        <img src="assets/simpleos-logo.svg" alt="SimplEOS" class="about-logo" />
        <h2>Simpl<span class="accent">EOS</span></h2>
        <span class="about-version">v2.0.0-alpha.0</span>
      </div>

      <div class="about-content">
        <p>A secure desktop wallet for Antelope-based blockchains.</p>
        <p>Built with Angular 22 + Tauri v2 + Rust</p>

        <div class="chains-supported">
          <h3>Supported Chains</h3>
          <div class="chain-badges">
            <span class="badge">Vaulta (EOS)</span>
            <span class="badge">WAX</span>
            <span class="badge">Telos</span>
            <span class="badge">Ultra</span>
            <span class="badge">FIO</span>
            <span class="badge">Libre</span>
            <span class="badge">XPR</span>
          </div>
        </div>

        <div class="credits">
          <p>Developed by <strong>EOS Rio</strong></p>
          <p class="license">Open source under MIT License</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .about-view {
      max-width: 500px;
      margin: 0 auto;
    }

    .about-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-3);
      margin-bottom: var(--sp-8);
    }

    .about-logo {
      width: 80px;
      height: 80px;
      filter: drop-shadow(0 0 16px rgba(0, 148, 210, 0.25));
    }

    h2 {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .accent { color: var(--accent); }

    .about-version {
      font-family: var(--font-data);
      font-size: 12px;
      color: var(--text-muted);
      background: var(--bg-raised);
      padding: var(--sp-1) var(--sp-3);
      border-radius: var(--radius-full);
    }

    .about-content {
      text-align: center;
    }
    .about-content p {
      font-size: 14px;
      color: var(--text-body);
      margin-bottom: var(--sp-2);
    }

    .chains-supported {
      margin-top: var(--sp-8);
      padding: var(--sp-6);
      background: var(--bg-raised);
      border-radius: var(--radius-md);
    }
    .chains-supported h3 {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: var(--sp-4);
    }
    .chain-badges {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-2);
      justify-content: center;
    }
    .badge {
      font-family: var(--font-data);
      font-size: 12px;
      color: var(--text-body);
      background: var(--bg-hover);
      padding: var(--sp-1) var(--sp-3);
      border-radius: var(--radius-full);
      border: 1px solid var(--border-subtle);
    }

    .credits {
      margin-top: var(--sp-8);
    }
    .credits strong { color: var(--text-bright); }
    .license {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: var(--sp-2);
    }
  `],
})
export class AboutComponent {}
