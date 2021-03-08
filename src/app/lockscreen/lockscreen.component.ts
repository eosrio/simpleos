import {Component, OnInit} from '@angular/core';
import {CryptoService} from '../services/crypto/crypto.service';
import {Router} from '@angular/router';
import {NetworkService} from '../services/network.service';
import {AccountsService} from '../services/accounts.service';
import {AppComponent} from '../app.component';
import {AnimationOptions} from "ngx-lottie";

@Component({
	selector: 'app-lockscreen',
	templateUrl: './lockscreen.component.html',
	styleUrls: ['./lockscreen.component.css']
})
export class LockscreenComponent implements OnInit {

	pin = '';
	nAttempts = 5;
	wrongpass = false;
	logoutModal: boolean;
	clearContacts: boolean;
	anim: any;

	lottieConfig: AnimationOptions = {
		path: 'assets/logoanim.json',
		autoplay: true,
		loop: false
	};

	static resetApp() {
		window['remote']['app']['relaunch']();
		window['remote']['app'].exit(0);
	}

	constructor(
		private crypto: CryptoService,
		private router: Router,
		private network: NetworkService,
		public aService: AccountsService,
		public app: AppComponent
	) {
		this.logoutModal = false;
		this.clearContacts = false;
	}

	toggleAnimation() {
		if (this.anim) {
			const duration = this.anim.getDuration(true);
			this.anim.goToAndPlay(Math.round(duration / 3), true);
		}
	}

	ngOnInit() {
		if (!localStorage.getItem('simpleos-hash')) {
			console.log('no hash saved.. navigating to landing page');
			this.router.navigate(['landing']).catch(() => {
				console.log('cannot navigate out');
			});
		}
	}

	handleAnimation(anim: any) {
		this.anim = anim;
		this.anim['setSpeed'](0.8);
	}

	unlock() {
		let target = ['landing'];
		if (this.network.networkingReady.getValue() && this.aService.accounts.length > 0) {
			target = ['dashboard', 'home'];
		}
		if (!this.crypto.unlock(this.pin, target)) {
			this.wrongpass = true;
			this.nAttempts--;
			if (this.nAttempts === 0) {
				localStorage.clear();
				LockscreenComponent.resetApp();
			}
		}
	}

	logout() {
		if (this.clearContacts) {
			localStorage.clear();
		} else {
			const arr = [];
			for (let i = 0; i < localStorage.length; i++) {
				if (localStorage.key(i) !== 'simpleos.contacts.' + this.network.activeChain['id']) {
					arr.push(localStorage.key(i));
				}
			}
			arr.forEach((k) => {
				localStorage.removeItem(k);
			});
		}
		LockscreenComponent.resetApp();
	}

}
