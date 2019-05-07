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
var core_1 = require("@angular/core");
var BackupService = /** @class */ (function () {
    function BackupService() {
        this.running = false;
        this.past_backups = [];
        this.numberOfBackups = 5;
        this.bkp_folder = '';
        this.automatic = localStorage.getItem('simplEOS.autosave');
        if (this.automatic === '' || this.automatic === null) {
            localStorage.setItem('simplEOS.autosave', 'true');
            this.automatic = 'true';
        }
        if (this.automatic === 'true') {
            if (window['remote']) {
                this.bkp_folder = window['remote']['app'].getPath('appData') + '/simpleosAutosave';
                this.initDir();
                this.listBackups();
            }
        }
    }
    BackupService.prototype.startTimeout = function () {
        var _this = this;
        if (this.automatic === 'true') {
            if (window['filesystem'] && this.running === false) {
                setTimeout(function () {
                    _this.running = true;
                    _this.startBackup();
                }, 5000);
            }
        }
    };
    BackupService.prototype.initDir = function () {
        if (!window['filesystem'].existsSync(this.bkp_folder)) {
            window['filesystem'].mkdirSync(this.bkp_folder);
        }
    };
    BackupService.prototype.listBackups = function () {
        var _this = this;
        this.past_backups = [];
        window['filesystem']['readdir'](this.bkp_folder, function (err, items) {
            for (var i = 0; i < items.length; i++) {
                if (items[i].split('.')[1] === 'bkp' && items[i] !== 'simpleos.bkp') {
                    _this.past_backups.push(items[i]);
                }
            }
            _this.past_backups.sort();
            if (_this.past_backups.length > _this.numberOfBackups) {
                try {
                    window['filesystem']['unlinkSync'](_this.bkp_folder + '/' + _this.past_backups[0]);
                    // console.log('Deleted:' + this.past_backups[0]);
                }
                catch (e) {
                    console.log('Fail to delete:' + _this.past_backups[0]);
                    console.log(e);
                }
                _this.listBackups();
            }
        });
    };
    BackupService.prototype.startBackup = function () {
        var _this = this;
        if (localStorage.getItem('simplEOS.init') === 'true') {
            var bkpArr = [];
            for (var i = 0; i < localStorage.length; i++) {
                if (localStorage.key(i).length > 12) {
                    var keyLS = localStorage.key(i);
                    var valueLS = localStorage.getItem(localStorage.key(i));
                    bkpArr.push({ key: keyLS, value: valueLS });
                }
            }
            var path = this.bkp_folder + '/simpleos_' + (new Date().getTime()) + '.bkp';
            window['filesystem']['writeFile'](path, JSON.stringify(bkpArr), 'utf-8', function (err, data) {
                if (!err) {
                    localStorage.setItem('simplEOS.lastBackupTime', new Date().getTime().toString());
                }
                else {
                    console.log(err);
                }
                _this.running = false;
            });
        }
    };
    BackupService = __decorate([
        core_1.Injectable({
            providedIn: 'root'
        }),
        __metadata("design:paramtypes", [])
    ], BackupService);
    return BackupService;
}());
exports.BackupService = BackupService;
//# sourceMappingURL=backup.service.js.map