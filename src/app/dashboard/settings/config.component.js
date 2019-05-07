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
var forms_1 = require("@angular/forms");
var router_1 = require("@angular/router");
var eosjs_service_1 = require("../../services/eosjs.service");
var accounts_service_1 = require("../../services/accounts.service");
var voting_service_1 = require("../../services/voting.service");
var network_service_1 = require("../../services/network.service");
var crypto_service_1 = require("../../services/crypto.service");
var angular2_toaster_1 = require("angular2-toaster");
var angular_1 = require("@clr/angular");
var backup_service_1 = require("../../services/backup.service");
var ConfigComponent = /** @class */ (function () {
    function ConfigComponent(fb, voteService, network, router, eos, crypto, aService, toaster, backup) {
        this.fb = fb;
        this.voteService = voteService;
        this.network = network;
        this.router = router;
        this.eos = eos;
        this.crypto = crypto;
        this.aService = aService;
        this.toaster = toaster;
        this.backup = backup;
        this.busy = false;
        this.pkExposureTime = 30;
        this.timetoclose = 0;
        this.timeoutpk = null;
        this.timeoutviewpk = null;
        this.pkError = '';
        this.selectedEndpoint = null;
        this.autoBackup = false;
        this.timetoclose = this.pkExposureTime;
        this.endpointModal = false;
        this.logoutModal = false;
        this.chainModal = false;
        this.confirmModal = false;
        this.pinModal = false;
        this.clearPinModal = false;
        this.clearContacts = false;
        this.changePassModal = false;
        this.importBKModal = false;
        this.exportBKModal = false;
        this.viewPKModal = false;
        this.showpk = false;
        this.passForm = this.fb.group({
            oldpass: ['', [forms_1.Validators.required, forms_1.Validators.minLength(10)]],
            matchingPassword: this.fb.group({
                pass1: ['', [forms_1.Validators.required, forms_1.Validators.minLength(10)]],
                pass2: ['', [forms_1.Validators.required, forms_1.Validators.minLength(10)]]
            })
        });
        this.pinForm = this.fb.group({
            pin: ['', forms_1.Validators.required],
        });
        this.exportForm = this.fb.group({
            pass: ['', forms_1.Validators.required],
            customExportBK: ['', forms_1.Validators.required],
        });
        this.importForm = this.fb.group({
            pass: ['', forms_1.Validators.required],
            customImportBK: ['', forms_1.Validators.required],
        });
        this.chainForm = this.fb.group({
            pass: ['', forms_1.Validators.required]
        });
        this.showpkForm = this.fb.group({
            pass: ['', forms_1.Validators.required]
        });
        this.disableEx = false;
        this.disableIm = false;
        this.chainConnected = [];
        var lastbkp = localStorage.getItem('simplEOS.lastBackupTime');
        if (lastbkp === '' || lastbkp === null) {
            this.lastBackupTime = '';
        }
        else {
            this.lastBackupTime = (new Date(parseInt(lastbkp, 10))).toLocaleString();
        }
    }
    ConfigComponent_1 = ConfigComponent;
    ConfigComponent.resetApp = function () {
        window['remote']['app']['relaunch']();
        window['remote']['app'].exit(0);
    };
    ConfigComponent.prototype.showToast = function (type, title, body) {
        this.config = new angular2_toaster_1.ToasterConfig({
            positionClass: 'toast-top-right',
            timeout: 10000,
            newestOnTop: true,
            tapToDismiss: true,
            preventDuplicates: false,
            animation: 'slideDown',
            limit: 1,
        });
        var toast = {
            type: type,
            title: title,
            body: body,
            timeout: 10000,
            showCloseButton: true,
            bodyOutputType: angular2_toaster_1.BodyOutputType.TrustedHtml,
        };
        this.toaster.popAsync(toast);
    };
    ConfigComponent.prototype.ngOnInit = function () {
        this.chainConnected = this.getChainConnected();
        this.autoBackup = this.backup.automatic === 'true';
    };
    ConfigComponent.prototype.cc = function (text) {
        var _this = this;
        window['navigator']['clipboard']['writeText'](text).then(function () {
            _this.showToast('success', 'Key copied to clipboard!', 'Please save it on a safe place.');
        }).catch(function () {
            _this.showToast('error', 'Clipboard didn\'t work!', 'Please try other way.');
        });
    };
    ConfigComponent.prototype.logout = function () {
        if (this.clearContacts) {
            localStorage.clear();
        }
        else {
            var arr = [];
            var bkpArr = [];
            for (var i = 0; i < localStorage.length; i++) {
                if (localStorage.key(i).startsWith('simpleos.contacts.') || localStorage.key(i) === 'simplEOS.lastBackupTime') {
                    bkpArr.push(localStorage.key(i));
                }
                else {
                    arr.push(localStorage.key(i));
                }
            }
            arr.forEach(function (k) {
                localStorage.removeItem(k);
            });
        }
        localStorage.setItem('simplEOS.init', 'false');
        ConfigComponent_1.resetApp();
    };
    ConfigComponent.prototype.getChainConnected = function () {
        var _this = this;
        this.chainConnected = [];
        return (this.network.defaultChains.find(function (chain) { return chain.id === _this.network.mainnetId; }));
    };
    ConfigComponent.prototype.changeChain = function (event) {
        this.network.changeChain(event);
    };
    ConfigComponent.prototype.selectEndpoint = function (data) {
        this.selectedEndpoint = data;
        this.confirmModal = true;
    };
    ConfigComponent.prototype.connectEndpoint = function () {
        this.network.selectedEndpoint.next(this.selectedEndpoint);
        this.network.networkingReady.next(false);
        this.aService.lastAccount = this.aService.selected.getValue().name;
        this.network.startup(null);
        this.confirmModal = false;
    };
    ConfigComponent.prototype.connectCustom = function (url) {
        this.network.selectedEndpoint.next({ url: url, owner: 'Other', latency: 0, filters: [], chain: '' });
        this.network.networkingReady.next(false);
        this.aService.lastAccount = this.aService.selected.getValue().name;
        this.network.startup(url);
        this.endpointModal = false;
    };
    ConfigComponent.prototype.changePass = function () {
        var _this = this;
        if (this.passmatch) {
            var account = this.aService.selected.getValue();
            var publicKey_1 = account.details['permissions'][0]['required_auth'].keys[0].key;
            this.crypto.authenticate(this.passForm.value.oldpass, publicKey_1).then(function () {
                _this.crypto.changePass(publicKey_1, _this.passForm.value.matchingPassword.pass2).then(function () {
                    ConfigComponent_1.resetApp();
                });
            });
        }
    };
    ConfigComponent.prototype.passCompare = function () {
        if (this.passForm.value.matchingPassword.pass1 && this.passForm.value.matchingPassword.pass2) {
            if (this.passForm.value.matchingPassword.pass1 === this.passForm.value.matchingPassword.pass2) {
                this.passForm['controls'].matchingPassword['controls']['pass2'].setErrors(null);
                this.passmatch = true;
            }
            else {
                this.passForm['controls'].matchingPassword['controls']['pass2'].setErrors({ 'incorrect': true });
                this.passmatch = false;
            }
        }
    };
    ConfigComponent.prototype.clearPin = function () {
        this.crypto.removePIN();
        this.clearPinModal = false;
        this.showToast('success', 'Lockscreen PIN removed!', '');
    };
    ConfigComponent.prototype.setPIN = function () {
        if (this.pinForm.value.pin !== '') {
            if (localStorage.getItem('simpleos-hash')) {
                this.crypto.updatePIN(this.pinForm.value.pin);
            }
            else {
                this.crypto.createPIN(this.pinForm.value.pin);
            }
            this.showToast('success', 'New Lockscreen PIN defined!', '');
        }
        this.pinModal = false;
    };
    ConfigComponent.prototype.inputEXClick = function () {
        this.customExportBK.nativeElement.click();
    };
    ConfigComponent.prototype.exportCheckBK = function (a) {
        this.exfile = a.target.files[0];
        var path = this.exfile.path;
        if (path === '') {
            this.showToast('error', 'Went some wrong, try again!', '');
            this.exfile = '';
            return false;
        }
        this.choosedDir = path;
    };
    ConfigComponent.prototype.exportBK = function () {
        var _this = this;
        if (this.exfile) {
            if (this.exfile !== '') {
                this.disableEx = true;
                this.busy = true;
                var bkpArr = [];
                for (var i = 0; i < localStorage.length; i++) {
                    if (localStorage.key(i).length > 12) {
                        var keyLS = localStorage.key(i);
                        var valueLS = localStorage.getItem(localStorage.key(i));
                        bkpArr.push({ key: keyLS, value: valueLS });
                    }
                }
                var pass = this.exportForm.value.pass;
                var rp = null;
                if (this.exportForm.value.pass !== '') {
                    rp = this.crypto.encryptBKP(JSON.stringify(bkpArr), pass);
                }
                else {
                    rp = JSON.stringify(bkpArr);
                }
                var path = this.exfile.path + '/simpleos.bkp';
                window['filesystem']['writeFile'](path, rp, 'utf-8', function (err, data) {
                    if (!err) {
                        _this.showToast('success', 'Backup exported!', '');
                        _this.choosedDir = '';
                        _this.disableEx = false;
                        _this.busy = false;
                        _this.exportBKModal = false;
                    }
                });
            }
            else {
                this.showToast('error', 'Choose your backup directory and fill the password field!', '');
                this.choosedDir = '';
                this.disableEx = false;
                this.busy = false;
            }
        }
        else {
            this.showToast('error', 'Choose your backup directory and fill the password field!', '');
        }
    };
    ConfigComponent.prototype.inputIMClick = function () {
        this.customImportBK.nativeElement.click();
    };
    ConfigComponent.prototype.importCheckBK = function (a) {
        this.infile = a.target.files[0];
        var name = this.infile.name;
        if (name.split('.')[1] !== 'bkp') {
            this.showToast('error', 'Wrong file!', '');
            this.infile = '';
            return false;
        }
        this.choosedFil = name;
    };
    ConfigComponent.prototype.toggleAutosave = function (event) {
        if (event.checked) {
            localStorage.setItem('simplEOS.autosave', 'true');
            this.backup.automatic = 'true';
            this.backup.startTimeout();
            this.showToast('success', 'Automatic backup enabled!', 'First backup will be saved in 10 seconds...');
        }
        else {
            localStorage.setItem('simplEOS.autosave', 'false');
            this.backup.automatic = 'false';
            this.showToast('info', 'Automatic backup disabled!', '');
        }
    };
    ConfigComponent.prototype.importBK = function () {
        var _this = this;
        this.disableIm = true;
        this.busy = true;
        if (this.infile && this.infile !== '') {
            window['filesystem']['readFile'](this.infile.path, 'utf-8', function (err, data) {
                if (!err) {
                    var pass = _this.importForm.value.pass;
                    var arrLS = null;
                    var decrypt = null;
                    try {
                        arrLS = JSON.parse(data);
                    }
                    catch (e) {
                        // backup encrypted, password required
                        if (pass !== '') {
                            decrypt = _this.crypto.decryptBKP(data, pass);
                            try {
                                arrLS = JSON.parse(decrypt);
                            }
                            catch (e) {
                                _this.showToast('error', 'Wrong password, please try again!', '');
                                console.log('wrong file');
                            }
                        }
                        else {
                            _this.showToast('error', 'This backup file is encrypted, please provide a password!', '');
                        }
                    }
                    if (arrLS) {
                        arrLS.forEach(function (d) {
                            localStorage.setItem(d['key'], d['value']);
                        });
                        _this.showToast('success', 'Imported with success!', '');
                        _this.choosedFil = '';
                        _this.disableIm = false;
                        _this.busy = false;
                        _this.importBKModal = false;
                        setTimeout(function () {
                            ConfigComponent_1.resetApp();
                        }, 1000);
                    }
                    else {
                        _this.choosedFil = '';
                        _this.disableIm = false;
                        _this.busy = false;
                    }
                }
                else {
                    _this.showToast('error', 'Something went wrong, please try again or contact our support!', '');
                    console.log('wrong entry');
                }
            });
        }
        else {
            this.showToast('error', 'Choose your backup file', '');
            this.choosedFil = '';
            this.disableIm = false;
            this.busy = false;
        }
    };
    ConfigComponent.prototype.closePkModal = function () {
        this.showpk = false;
        this.tempPK = '';
        this.pkError = '';
        this.showpkForm.reset();
        if (this.timeoutpk) {
            this.timetoclose = this.pkExposureTime;
            clearInterval(this.timeoutpk);
        }
        if (this.timeoutviewpk) {
            clearTimeout(this.timeoutviewpk);
        }
    };
    ConfigComponent.prototype.viewPK = function () {
        var _this = this;
        if (this.showpkForm.get('pass').value !== '') {
            var selAcc = this.aService.selected.getValue();
            var publicKey = selAcc.details['permissions'][0]['required_auth'].keys[0].key;
            this.crypto.authenticate(this.showpkForm.get('pass').value, publicKey).then(function (result) {
                if (result) {
                    _this.showpk = true;
                    _this.showpkForm.reset();
                    _this.tempPK = _this.eos.baseConfig.keyProvider;
                    _this.timeoutpk = setInterval(function () {
                        _this.timetoclose -= 1;
                        if (_this.timetoclose <= 0) {
                            _this.timetoclose = _this.pkExposureTime;
                            clearInterval(_this.timeoutpk);
                        }
                    }, 1000);
                    _this.timeoutviewpk = setTimeout(function () {
                        _this.tempPK = '';
                        _this.pkModal.close();
                        if (_this.timeoutpk) {
                            _this.timetoclose = _this.pkExposureTime;
                            clearInterval(_this.timeoutpk);
                        }
                    }, _this.pkExposureTime * 1000);
                }
            }).catch(function (err) {
                _this.showToast('error', 'Invalid password!', '');
                _this.pkError = 'Invalid password!';
                if (_this.timeoutviewpk) {
                    clearTimeout(_this.timeoutviewpk);
                }
                console.log('WRONG PASS', err);
            });
        }
    };
    var ConfigComponent_1;
    __decorate([
        core_1.ViewChild('customExportBK'),
        __metadata("design:type", core_1.ElementRef)
    ], ConfigComponent.prototype, "customExportBK", void 0);
    __decorate([
        core_1.ViewChild('customImportBK'),
        __metadata("design:type", core_1.ElementRef)
    ], ConfigComponent.prototype, "customImportBK", void 0);
    __decorate([
        core_1.ViewChild('pkModal'),
        __metadata("design:type", angular_1.ClrModal)
    ], ConfigComponent.prototype, "pkModal", void 0);
    ConfigComponent = ConfigComponent_1 = __decorate([
        core_1.Component({
            selector: 'app-config',
            templateUrl: './config.component.html',
            styleUrls: ['./config.component.css']
        }),
        __metadata("design:paramtypes", [forms_1.FormBuilder,
            voting_service_1.VotingService,
            network_service_1.NetworkService,
            router_1.Router,
            eosjs_service_1.EOSJSService,
            crypto_service_1.CryptoService,
            accounts_service_1.AccountsService,
            angular2_toaster_1.ToasterService,
            backup_service_1.BackupService])
    ], ConfigComponent);
    return ConfigComponent;
}());
exports.ConfigComponent = ConfigComponent;
//# sourceMappingURL=config.component.js.map