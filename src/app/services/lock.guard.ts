import {Injectable} from '@angular/core';
import {CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router} from '@angular/router';
import {Observable} from 'rxjs';
import {CryptoService} from './crypto.service';

@Injectable({
	providedIn: 'root'
})
export class LockGuard implements CanActivate {

	constructor(private crypto: CryptoService, private router: Router) {
	}

	canActivate(
		next: ActivatedRouteSnapshot,
		state: RouterStateSnapshot): Observable<boolean> | Promise<boolean> | boolean {
		if (localStorage.getItem('simpleos-hash')) {
			if (this.crypto.locked) {
				console.log('wallet locked, redirecting...');
				this.router.navigate(['']).then(() => {
					console.log('Navigation failed');
				});
				return false;
			} else {
				return true;
			}
		} else {
			return true;
		}
	}
}
