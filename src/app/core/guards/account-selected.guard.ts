import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { WalletStateService } from '../services/wallet-state.service';

export const accountSelectedGuard: CanActivateFn = () => {
  const wallet = inject(WalletStateService);
  const router = inject(Router);

  if (wallet.hasSelectedAccount()) {
    return true;
  }

  return router.createUrlTree(['/dashboard/home']);
};