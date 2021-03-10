import {Injectable} from '@angular/core';
import {environment} from '../../environments/environment';
import {ipcRenderer} from "electron";

declare const window: any;

@Injectable({
    providedIn: 'root'
})
export class BackupService {

    running = false;
    past_backups = [];
    numberOfBackups = 5;
    bkp_folder = '';
    automatic: string;
    prefix = 'simpleos';
    lastBackupTime = '';

    constructor() {
        if (environment.COMPILERVERSION !== 'DEFAULT') {
            this.prefix = environment.COMPILERVERSION.toLowerCase();
        }
        this.automatic = localStorage.getItem('simplEOS.autosave');
        if (this.automatic === '' || this.automatic === null) {
            localStorage.setItem('simplEOS.autosave', 'true');
            this.automatic = 'true';
        }
        if (this.automatic === 'true') {
            ipcRenderer.invoke('get-app-path',`${this.prefix}-autosave`).then(value => {
                this.bkp_folder = value;
                this.initDir();
                this.listBackups();
            });
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
                if (items[i].split('.')[1] === 'bkp' && items[i] !== this.prefix + '.bkp') {
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

    createBackup(): string {
        const bkpArr = [];
        for (let i = 0; i < localStorage.length; i++) {
            if (localStorage.key(i).length > 12) {
                const keyLS = localStorage.key(i);
                const valueLS = localStorage.getItem(localStorage.key(i));
                bkpArr.push({key: keyLS, value: valueLS});
            }
        }
        return JSON.stringify(bkpArr);
    }

    startBackup() {
        if (localStorage.getItem('simplEOS.init') === 'true') {
            const path = this.bkp_folder + '/' + this.prefix + '_' + (new Date().getTime()) + '.bkp';
            window.filesystem.writeFile(path, this.createBackup(), 'utf-8', (err) => {
                if (!err) {
                    localStorage.setItem('simplEOS.lastBackupTime', new Date().getTime().toString());
                } else {
                    console.log(err);
                }
                this.running = false;
                this.getLastBackupTime();
            });
        }
    }

    getLastBackupTime() {
        const lastbkp = localStorage.getItem('simplEOS.lastBackupTime');
        if (lastbkp === '' || lastbkp === null) {
            this.lastBackupTime = '';
        } else {
            this.lastBackupTime = (new Date(parseInt(lastbkp, 10))).toLocaleString();
        }
        console.log(this.lastBackupTime);
    }

    updateBackupTime() {
        localStorage.setItem('simplEOS.lastBackupTime', new Date().getTime().toString());
    }
}
