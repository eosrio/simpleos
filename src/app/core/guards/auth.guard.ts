import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { WalletStateService } from '../services/wallet-state.service';

export const authGuard: CanActivateFn = () => {
  const wallet = inject(WalletStateService);
  const router = inject(Router);

  if (wallet.locked()) {
    router.navigate(['/lockscreen']);
    return false;
  }
  return true;
};
