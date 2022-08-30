"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupService = void 0;
const core_1 = require("@angular/core");
const environment_1 = require("../../environments/environment");
const electron_1 = require("electron");
let BackupService = class BackupService {
    constructor() {
        this.running = false;
        this.past_backups = [];
        this.numberOfBackups = 5;
        this.bkp_folder = '';
        this.prefix = 'simpleos';
        this.lastBackupTime = '';
        if (environment_1.environment.COMPILERVERSION !== 'DEFAULT') {
            this.prefix = environment_1.environment.COMPILERVERSION.toLowerCase();
        }
        this.automatic = localStorage.getItem('simplEOS.autosave');
        if (this.automatic === '' || this.automatic === null) {
            localStorage.setItem('simplEOS.autosave', 'true');
            this.automatic = 'true';
        }
        if (this.automatic === 'true') {
            electron_1.ipcRenderer.invoke('get-app-path', `${this.prefix}-autosave`).then(value => {
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
                }
                catch (e) {
                    console.log('Fail to delete:' + this.past_backups[0]);
                    console.log(e);
                }
                this.listBackups();
            }
        });
    }
    createBackup() {
        const bkpArr = [];
        for (let i = 0; i < localStorage.length; i++) {
            if (localStorage.key(i).length > 12) {
                const keyLS = localStorage.key(i);
                const valueLS = localStorage.getItem(localStorage.key(i));
                bkpArr.push({ key: keyLS, value: valueLS });
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
                }
                else {
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
        }
        else {
            this.lastBackupTime = (new Date(parseInt(lastbkp, 10))).toLocaleString();
        }
        console.log(this.lastBackupTime);
    }
    updateBackupTime() {
        localStorage.setItem('simplEOS.lastBackupTime', new Date().getTime().toString());
    }
};
BackupService = __decorate([
    (0, core_1.Injectable)({
        providedIn: 'root'
    }),
    __metadata("design:paramtypes", [])
], BackupService);
exports.BackupService = BackupService;
//# sourceMappingURL=backup.service.js.map