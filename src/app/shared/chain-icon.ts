import { Component, Input, computed, signal } from '@angular/core';

/**
 * Chain icon component. Renders an SVG icon/badge for each supported chain.
 * Uses the chain's brand color as accent.
 */
@Component({
  selector: 'chain-icon',
  standalone: true,
  template: `
    <svg [attr.width]="size" [attr.height]="size" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="15" [attr.fill]="bgColor()" stroke="none"/>
      <text x="16" y="16" text-anchor="middle" dominant-baseline="central"
            [attr.font-size]="fontSize()" font-weight="700" font-family="system-ui, sans-serif"
            [attr.fill]="textColor()">
        {{ letter() }}
      </text>
    </svg>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
  `],
})
export class ChainIconComponent {
  @Input() chainName = '';
  @Input() size = 24;

  private readonly CHAIN_COLORS: Record<string, { bg: string; text: string; letter: string }> = {
    'Vaulta':         { bg: '#4aa82e', text: '#fff', letter: 'A' },
    'EOS':            { bg: '#000000', text: '#fff', letter: 'E' },
    'WAX':            { bg: '#f78b1d', text: '#fff', letter: 'W' },
    'Telos':          { bg: '#4facfe', text: '#fff', letter: 'T' },
    'Ultra':          { bg: '#6f3de0', text: '#fff', letter: 'U' },
    'FIO':            { bg: '#765cd6', text: '#fff', letter: 'F' },
    'Libre':          { bg: '#0053e6', text: '#fff', letter: 'L' },
    'XPR':            { bg: '#7543e3', text: '#fff', letter: 'X' },
    // Testnets
    'Jungle Testnet': { bg: '#2d8b35', text: '#fff', letter: 'J' },
    'WAX Testnet':    { bg: '#f78e1e', text: '#fff', letter: 'W' },
    'Telos Testnet':  { bg: '#571aff', text: '#fff', letter: 'T' },
    'Ultra Testnet':  { bg: '#7b2dfa', text: '#fff', letter: 'U' },
    'FIO Testnet':    { bg: '#4c5eeb', text: '#fff', letter: 'F' },
    'XPR Testnet':    { bg: '#7543e3', text: '#fff', letter: 'X' },
  };

  bgColor = computed(() => this.CHAIN_COLORS[this.chainName]?.bg ?? '#444');
  textColor = computed(() => this.CHAIN_COLORS[this.chainName]?.text ?? '#fff');
  letter = computed(() => this.CHAIN_COLORS[this.chainName]?.letter ?? this.chainName?.charAt(0)?.toUpperCase() ?? '?');
  fontSize = computed(() => this.size > 28 ? '14' : '11');
}
