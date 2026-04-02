import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { WalletStateService } from './core/services/wallet-state.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `<router-outlet />`,
  styleUrl: './app.css',
})
export class AppComponent implements OnInit {
  constructor(
    private wallet: WalletStateService,
    private theme: ThemeService,
  ) {}

  async ngOnInit() {
    await this.wallet.initialize();
  }
}
