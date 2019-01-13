import {Injectable} from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class BackupService {

	running = false;
	past_backups = [];
	numberOfBackups = 5;
	bkp_folder = './autosave';
	automatic: string;

	constructor() {
		this.automatic = localStorage.getItem('simplEOS.autosave');
		if (this.automatic === '' || this.automatic === null) {
			localStorage.setItem('simplEOS.autosave', 'true');
			this.automatic = 'true';
		}
		if (this.automatic === 'true') {
			if (window['remote']) {
				this.initDir();
				this.listBackups();
			}
		}
	}

	startTimeout() {
		if (this.automatic === 'true') {
			if (window['filesystem'] && this.running === false) {
				setTimeout(() => {
					this.running = true;
					this.startBackup();
				}, 5000);
			}
		}
	}

	initDir() {
		if (!window['filesystem'].existsSync(this.bkp_folder)) {
			window['filesystem'].mkdirSync(this.bkp_folder);
		}
	}

	listBackups() {
		this.past_backups = [];
		window['filesystem']['readdir'](this.bkp_folder, (err, items) => {
			for (let i = 0; i < items.length; i++) {
				if (items[i].split('.')[1] === 'bkp' && items[i] !== 'simpleos.bkp') {
					this.past_backups.push(items[i]);
				}
			}
			this.past_backups.sort();
			if (this.past_backups.length > this.numberOfBackups) {
				try {
					window['filesystem']['unlinkSync'](this.bkp_folder + '/' + this.past_backups[0]);
					// console.log('Deleted:' + this.past_backups[0]);
				} catch (e) {
					console.log('Fail to delete:' + this.past_backups[0]);
					console.log(e);
				}
				this.listBackups();
			}
		});
	}

	startBackup() {
		if (localStorage.getItem('simplEOS.init') === 'true') {
			const bkpArr = [];
			for (let i = 0; i < localStorage.length; i++) {
				if (localStorage.key(i).length > 12) {
					const keyLS = localStorage.key(i);
					const valueLS = localStorage.getItem(localStorage.key(i));
					bkpArr.push({key: keyLS, value: valueLS});
				}
			}
			const path = this.bkp_folder + '/simpleos_' + (new Date().getTime()) + '.bkp';
			window['filesystem']['writeFile'](path, JSON.stringify(bkpArr), 'utf-8', (err, data) => {
				if (!err) {
					localStorage.setItem('simplEOS.lastBackupTime', new Date().getTime().toString());
				} else {
					console.log(err);
				}
				this.running = false;
			});
		}
	}
}
