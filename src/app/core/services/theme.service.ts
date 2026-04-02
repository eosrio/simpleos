import { Injectable, signal, effect } from '@angular/core';

export type BaseTheme = 'dark' | 'light';
export type ChainTheme = 'vaulta' | 'wax' | 'telos' | 'ultra' | 'fio' | 'libre' | 'xpr';

/** Maps chain config IDs to chain theme keys */
const CHAIN_ID_MAP: Record<string, ChainTheme> = {
  'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906': 'vaulta',
  '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4': 'wax',
  '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11': 'telos',
};

/** Maps chain names (lowercase) to theme keys as fallback */
const CHAIN_NAME_MAP: Record<string, ChainTheme> = {
  'vaulta': 'vaulta',
  'eos': 'vaulta',
  'wax': 'wax',
  'telos': 'telos',
  'ultra': 'ultra',
  'fio': 'fio',
  'libre': 'libre',
  'xpr': 'xpr',
  'proton': 'xpr',
};

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly baseTheme = signal<BaseTheme>('dark');
  readonly chainTheme = signal<ChainTheme>('vaulta');

  constructor() {
    // Apply theme attributes whenever signals change
    effect(() => {
      const base = this.baseTheme();
      const chain = this.chainTheme();
      document.documentElement.setAttribute('data-theme', base);
      document.documentElement.setAttribute('data-chain', chain);
    });

    // Initialize from stored preference or system preference
    this.loadStoredPreference();
  }

  /** Toggle between light and dark */
  toggleBaseTheme() {
    this.baseTheme.update(t => t === 'dark' ? 'light' : 'dark');
    this.savePreference();
  }

  /** Set base theme explicitly */
  setBaseTheme(theme: BaseTheme) {
    this.baseTheme.set(theme);
    this.savePreference();
  }

  /** Set chain theme from a chain ID (hex string) */
  setChainById(chainId: string) {
    const theme = CHAIN_ID_MAP[chainId];
    if (theme) {
      this.chainTheme.set(theme);
    }
  }

  /** Set chain theme from a chain name */
  setChainByName(name: string) {
    const normalized = name.toLowerCase().trim();
    const theme = CHAIN_NAME_MAP[normalized];
    if (theme) {
      this.chainTheme.set(theme);
    }
  }

  /** Set chain theme directly */
  setChain(chain: ChainTheme) {
    this.chainTheme.set(chain);
  }

  private loadStoredPreference() {
    try {
      const stored = localStorage.getItem('simpleos-theme');
      if (stored === 'light' || stored === 'dark') {
        this.baseTheme.set(stored);
      } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        this.baseTheme.set('light');
      }
    } catch {
      // localStorage not available (e.g., CSP), keep default
    }
  }

  private savePreference() {
    try {
      localStorage.setItem('simpleos-theme', this.baseTheme());
    } catch {
      // Silently fail
    }
  }
}
