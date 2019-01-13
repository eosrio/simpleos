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
var eosjs_service_1 = require("../eosjs.service");
var forms_1 = require("@angular/forms");
var accounts_service_1 = require("../accounts.service");
var router_1 = require("@angular/router");
var angular_1 = require("@clr/angular");
var network_service_1 = require("../network.service");
var crypto_service_1 = require("../services/crypto.service");
var angular2_toaster_1 = require("angular2-toaster");
var ram_service_1 = require("../services/ram.service");
var LandingComponent = /** @class */ (function () {
    function LandingComponent(eos, crypto, fb, aService, toaster, network, router, zone, ram) {
        var _this = this;
        this.eos = eos;
        this.crypto = crypto;
        this.fb = fb;
        this.aService = aService;
        this.toaster = toaster;
        this.network = network;
        this.router = router;
        this.zone = zone;
        this.ram = ram;
        // endPoint = 'http://api.eosrio.io';
        this.accountname = '';
        this.accountname_err = '';
        this.accountname_valid = false;
        this.ownerpk = '';
        this.ownerpk2 = '';
        this.ownerpub = '';
        this.ownerpub2 = '';
        this.activepk = '';
        this.activepub = '';
        this.newAccountPayload = '';
        this.agreeKeys = false;
        this.agreeKeys2 = false;
        this.generating = false;
        this.generating2 = false;
        this.exodusValid = false;
        this.payloadValid = false;
        this.generated = false;
        this.generated2 = false;
        this.verifyPanel = false;
        this.openTX = LandingComponent_1.openTXID;
        this.openGit = LandingComponent_1.openGithub;
        this.openFaq = LandingComponent_1.openFAQ;
        this.busy2 = false;
        this.busyActivekey = false;
        this.chainConnected = [];
        this.busy = true;
        this.existingWallet = false;
        this.exodusWallet = false;
        this.dropReady = false;
        this.newWallet = false;
        this.check = false;
        this.passmatch = true;
        this.passexodusmatch = true;
        this.agree = false;
        this.agree2 = false;
        this.lockscreen = false;
        this.lockscreen2 = false;
        this.importBKP = false;
        this.endpointModal = false;
        this.disableIm = false;
        this.accounts = [];
        this.importedAccounts = [];
        this.checkerr = '';
        this.errormsg = '';
        this.endpoint = '';
        this.total_amount = 1;
        this.memo = '';
        this.busyActivekey = false;
        this.lottieConfig = {
            path: 'assets/logoanim.json',
            autoplay: true,
            loop: false
        };
        this.network.networkingReady.asObservable().subscribe(function (status) {
            _this.busy = !status;
        });
        this.publicEOS = '';
        this.passform = this.fb.group({
            matchingPassword: this.fb.group({
                pass1: ['', [forms_1.Validators.required, forms_1.Validators.minLength(10)]],
                pass2: ['', [forms_1.Validators.required, forms_1.Validators.minLength(10)]]
            })
        });
        this.pvtform = this.fb.group({
            private_key: ['', forms_1.Validators.required]
        });
        this.passformexodus = this.fb.group({
            matchingPassword: this.fb.group({
                pass1: ['', [forms_1.Validators.required, forms_1.Validators.minLength(10)]],
                pass2: ['', [forms_1.Validators.required, forms_1.Validators.minLength(10)]]
            })
        });
        this.importForm = this.fb.group({
            pass: ['', forms_1.Validators.required],
            customImportBK: ['', forms_1.Validators.required],
        });
    }
    LandingComponent_1 = LandingComponent;
    LandingComponent.parseEOS = function (tk_string) {
        if (tk_string.split(' ')[1] === 'EOS') {
            return parseFloat(tk_string.split(' ')[0]);
        }
        else {
            return 0;
        }
    };
    LandingComponent.openTXID = function (value) {
        window['shell']['openExternal']('https://www.bloks.io/account/' + value);
    };
    LandingComponent.openGithub = function () {
        window['shell']['openExternal']('https://github.com/eosrio/eosriosignup');
    };
    LandingComponent.openFAQ = function () {
        window['shell']['openExternal']('https://github.com/eosrio/eosriosignup');
    };
    LandingComponent.resetApp = function () {
        if (window['remote']) {
            window['remote']['app']['relaunch']();
            window['remote']['app'].exit(0);
        }
    };
    LandingComponent.prototype.cc = function (text, title, body) {
        var _this = this;
        window['navigator']['clipboard']['writeText'](text).then(function () {
            _this.showToast('success', title + ' copied to clipboard!', body);
        }).catch(function () {
            _this.showToast('error', 'Clipboard didn\'t work!', 'Please try other way.');
        });
    };
    LandingComponent.prototype.resetAndClose = function () {
        this.wizardnew.reset();
        this.wizardnew.close();
    };
    LandingComponent.prototype.showToast = function (type, title, body) {
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
    LandingComponent.prototype.ngOnInit = function () {
        var _this = this;
        this.chainConnected = [];
        this.chainConnected = this.getChainConnected();
        this.endpoint = this.chainConnected['firstApi'];
        setTimeout(function () {
            _this.anim.pause();
        }, 10);
        setTimeout(function () {
            _this.anim.play();
        }, 900);
        console.log('Started landing -------->');
    };
    LandingComponent.prototype.parseSYMBOL = function (tk_string) {
        if (tk_string.split(' ')[1] === this.aService.mainnetActive['symbol']) {
            return parseFloat(tk_string.split(' ')[0]);
        }
        else {
            return 0;
        }
    };
    LandingComponent.prototype.getChainConnected = function () {
        var storeChain = localStorage.getItem('simplEOS.storeChain');
        var storeChainA = JSON.parse(storeChain);
        return (storeChainA.find(function (chain) { return chain.active; }));
    };
    LandingComponent.prototype.setChangeMainnet = function (chainID) {
        var _this = this;
        this.network.mainnetId = this.network.networks.find(function (chain) { return chain.id === chainID; }).id;
        this.aService.activeChain(this.network.networks.find(function (chain) { return chain.id === _this.network.mainnetId; }).name);
        LandingComponent_1.resetApp();
    };
    LandingComponent.prototype.setEndPoint = function (ep) {
        this.endpoint = ep;
        this.customConnect();
        this.endpointModal = false;
    };
    LandingComponent.prototype.setPin = function () {
        this.crypto.createPIN(this.pin);
    };
    LandingComponent.prototype.verifyAccountName = function (next) {
        var _this = this;
        try {
            this.accountname_valid = false;
            var res = this.eos.checkAccountName(this.accountname);
            var regexName = new RegExp('^([a-z]|[1-5])+$');
            if (res !== 0) {
                if (this.accountname.length === 12 && regexName.test(this.accountname)) {
                    this.eos.getAccountInfo(this.accountname).then(function () {
                        // this.eos['getAccount'](this.accountname, (err, data) => {
                        //   console.log(err, data);
                        _this.accountname_err = 'This account name is not available. Please try another.';
                        _this.accountname_valid = false;
                    }).catch(function () {
                        _this.accountname_valid = true;
                        _this.accountname_err = '';
                        if (next) {
                            _this.wizardnew.next();
                        }
                    });
                }
                else {
                    this.accountname_err = 'The account name must have exactly 12 characters. a-z, 1-5';
                }
            }
        }
        catch (e) {
            this.accountname_err = e.message;
        }
    };
    LandingComponent.prototype.generateKeys = function () {
        var _this = this;
        this.generating = true;
        setTimeout(function () {
            _this.eos.ecc.initialize().then(function () {
                _this.eos.ecc['randomKey'](128).then(function (privateKey) {
                    _this.ownerpk = privateKey;
                    _this.ownerpub = _this.eos.ecc['privateToPublic'](_this.ownerpk);
                    _this.eos.ecc['randomKey'](128).then(function (privateKey2) {
                        _this.activepk = privateKey2;
                        _this.activepub = _this.eos.ecc['privateToPublic'](_this.activepk);
                        _this.generating = false;
                        _this.generated = true;
                        console.log(_this.activepk, _this.activepub);
                    });
                });
            });
        }, 100);
    };
    LandingComponent.prototype.generateNKeys = function () {
        var _this = this;
        this.generating2 = true;
        setTimeout(function () {
            _this.eos.ecc.initialize().then(function () {
                _this.eos.ecc['randomKey'](128).then(function (privateKey) {
                    _this.ownerpk2 = privateKey;
                    _this.ownerpub2 = _this.eos.ecc['privateToPublic'](_this.ownerpk2);
                    _this.generating2 = false;
                    _this.generated2 = true;
                });
            });
        }, 100);
    };
    LandingComponent.prototype.makePayload = function () {
        if (this.eos.ecc['isValidPublic'](this.ownerpub) && this.eos.ecc['isValidPublic'](this.activepub)) {
            console.log('Generating account payload');
            this.newAccountPayload = btoa(JSON.stringify({
                n: this.accountname,
                o: this.ownerpub,
                a: this.activepub,
                t: new Date().getTime()
            }));
            this.payloadValid = true;
        }
        else {
            alert('Invalid public key!');
            this.newAccountPayload = 'Invalid public key! Please go back and fix it!';
            this.payloadValid = false;
            this.wizardnew.navService.previous();
        }
    };
    LandingComponent.prototype.makeMemo = function () {
        this.memo = this.accountname + '-' + this.ownerpub + '-' + this.activepub;
    };
    LandingComponent.prototype.retryConn = function () {
        this.network.connect();
    };
    LandingComponent.prototype.customConnect = function () {
        this.network.startup(this.endpoint);
    };
    LandingComponent.prototype.handleAnimation = function (anim) {
        this.anim = anim;
        this.anim['setSpeed'](0.8);
    };
    LandingComponent.prototype.passCompare = function () {
        if (this.passform.value.matchingPassword.pass1 && this.passform.value.matchingPassword.pass2) {
            if (this.passform.value.matchingPassword.pass1 === this.passform.value.matchingPassword.pass2) {
                this.passform['controls'].matchingPassword['controls']['pass2'].setErrors(null);
                this.passmatch = true;
            }
            else {
                this.passform['controls'].matchingPassword['controls']['pass2'].setErrors({ 'incorrect': true });
                this.passmatch = false;
            }
        }
    };
    LandingComponent.prototype.passExodusCompare = function () {
        if (this.passformexodus.value.matchingPassword.pass1 && this.passformexodus.value.matchingPassword.pass2) {
            if (this.passformexodus.value.matchingPassword.pass1 === this.passformexodus.value.matchingPassword.pass2) {
                this.passformexodus['controls'].matchingPassword['controls']['pass2'].setErrors(null);
                this.passexodusmatch = true;
            }
            else {
                this.passformexodus['controls'].matchingPassword['controls']['pass2'].setErrors({ 'incorrect': true });
                this.passexodusmatch = false;
            }
        }
    };
    LandingComponent.prototype.importCredentials = function () {
        var _this = this;
        if (this.passform.value.matchingPassword.pass1 === this.passform.value.matchingPassword.pass2) {
            this.crypto.initKeys(this.publicEOS, this.passform.value.matchingPassword.pass1).then(function () {
                _this.crypto.encryptAndStore(_this.pvtform.value.private_key, _this.publicEOS).then(function () {
                    _this.aService.importAccounts(_this.importedAccounts);
                    _this.crypto.decryptKeys(_this.publicEOS).then(function () {
                        _this.router.navigate(['dashboard', 'vote']).catch(function (err) {
                            console.log(err);
                        });
                        if (_this.lockscreen) {
                            _this.setPin();
                        }
                    }).catch(function (error) {
                        console.log('Error', error);
                    });
                }).catch(function (err) {
                    console.log(err);
                });
            });
        }
    };
    LandingComponent.prototype.verifyPrivateKey = function (input) {
        var _this = this;
        if (input !== '') {
            this.busyActivekey = true;
            this.eos.checkPvtKey(input).then(function (results) {
                _this.publicEOS = results.publicKey;
                _this.importedAccounts = [];
                _this.importedAccounts = results.foundAccounts.slice();
                _this.importedAccounts.forEach(function (item) {
                    if (item['refund_request']) {
                        var tempDate = item['refund_request']['request_time'] + '.000Z';
                        var refundTime = new Date(tempDate).getTime() + (72 * 60 * 60 * 1000);
                        var now = new Date().getTime();
                        if (now > refundTime) {
                            _this.eos.claimRefunds(item.account_name, input).then(function (tx) {
                                console.log(tx);
                            });
                        }
                        else {
                            console.log('Refund not ready!');
                        }
                    }
                });
                _this.pvtform.controls['private_key'].setErrors(null);
                _this.zone.run(function () {
                    _this.exisitswizard.forceNext();
                    _this.errormsg = '';
                });
            }).catch(function (e) {
                _this.zone.run(function () {
                    _this.dropReady = true;
                    _this.exodusValid = false;
                    _this.pvtform.controls['private_key'].setErrors({ 'incorrect': true });
                    _this.importedAccounts = [];
                    if (e.message.includes('Invalid checksum')) {
                        _this.errormsg = 'invalid private key';
                    }
                    if (e.message === 'no_account') {
                        _this.errormsg = 'No account associated with this private key';
                    }
                    if (e.message === 'non_active') {
                        _this.errormsg = 'This is not the active key. Please import the active key.';
                    }
                });
            });
        }
    };
    LandingComponent.prototype.doCancel = function () {
        this.exisitswizard.close();
    };
    LandingComponent.prototype.checkAccount = function () {
        var _this = this;
        var _self = this;
        if (this.eos.ready) {
            this.check = true;
            this.accounts = [];
            console.log('HERE', this.publicEOS);
            this.eos.loadPublicKey(this.publicEOS).then(function (account_data) {
                console.log('account', account_data);
                account_data.foundAccounts.forEach(function (acc) {
                    var balance = 0;
                    console.log('account2', acc);
                    // Parse tokens and calculate balance
                    acc['tokens'].forEach(function (tk) {
                        balance += _self.parseSYMBOL(tk);
                        // balance += LandingComponent.parseEOS(tk);
                    });
                    // Add stake balance
                    // balance += LandingComponent.parseEOS(acc['total_resources']['cpu_weight']);
                    // balance += LandingComponent.parseEOS(acc['total_resources']['net_weight']);
                    balance += _self.parseSYMBOL(acc['total_resources']['cpu_weight']);
                    balance += _self.parseSYMBOL(acc['total_resources']['net_weight']);
                    console.log('account2', balance);
                    var accData = {
                        name: acc['account_name'],
                        full_balance: Math.round((balance) * 10000) / 10000
                    };
                    _this.accounts.push(accData);
                });
                _this.checkerr = '';
            }).catch(function (err) {
                console.log('ERROR', err);
                _this.checkerr = err;
            });
        }
    };
    LandingComponent.prototype.inputIMClick = function () {
        this.customImportBK.nativeElement.click();
    };
    LandingComponent.prototype.importCheckBK = function (a) {
        this.infile = a.target.files[0];
        var name = this.infile.name;
        if (name !== 'simpleos.bkp') {
            this.showToast('error', 'Wrong file!', '');
            this.infile = '';
            return false;
        }
        this.choosedFil = name;
    };
    LandingComponent.prototype.importBK = function () {
        var _this = this;
        this.disableIm = true;
        this.busy2 = true;
        if (this.infile !== '' && this.importForm.value.pass !== '') {
            window['filesystem']['readFile'](this.infile.path, 'utf-8', function (err, data) {
                if (!err) {
                    var pass = _this.importForm.value.pass;
                    var decrypt = _this.crypto.decryptBKP(data, pass);
                    try {
                        var arrLS = JSON.parse(decrypt);
                        _this.showToast('success', 'Imported with success!', 'Application will restart... wait for it!');
                        arrLS.forEach(function (d) {
                            localStorage.setItem(d['key'], d['value']);
                        });
                        _this.choosedFil = '';
                        _this.disableIm = false;
                        _this.busy2 = false;
                        _this.importBKP = false;
                        LandingComponent_1.resetApp();
                    }
                    catch (e) {
                        _this.showToast('error', 'Wrong password, please try again!', '');
                    }
                }
                else {
                    _this.showToast('error', 'Something went wrong, please try again or contact our support!', '');
                }
            });
        }
        else {
            this.showToast('error', 'Choose your backup file and fill the password field!', '');
            this.choosedFil = '';
            this.disableIm = false;
            this.busy2 = false;
        }
    };
    var LandingComponent_1;
    __decorate([
        core_1.ViewChild('wizardexists'),
        __metadata("design:type", angular_1.ClrWizard)
    ], LandingComponent.prototype, "exisitswizard", void 0);
    __decorate([
        core_1.ViewChild('wizardnew'),
        __metadata("design:type", angular_1.ClrWizard)
    ], LandingComponent.prototype, "wizardnew", void 0);
    __decorate([
        core_1.ViewChild('wizardexodus'),
        __metadata("design:type", angular_1.ClrWizard)
    ], LandingComponent.prototype, "wizard", void 0);
    __decorate([
        core_1.ViewChild('wizardkeys'),
        __metadata("design:type", angular_1.ClrWizard)
    ], LandingComponent.prototype, "wizardkeys", void 0);
    __decorate([
        core_1.ViewChild('customImportBK'),
        __metadata("design:type", core_1.ElementRef)
    ], LandingComponent.prototype, "customImportBK", void 0);
    LandingComponent = LandingComponent_1 = __decorate([
        core_1.Component({
            selector: 'app-landing',
            templateUrl: './landing.component.html',
            styleUrls: ['./landing.component.css']
        }),
        __metadata("design:paramtypes", [eosjs_service_1.EOSJSService,
            crypto_service_1.CryptoService,
            forms_1.FormBuilder,
            accounts_service_1.AccountsService,
            angular2_toaster_1.ToasterService,
            network_service_1.NetworkService,
            router_1.Router,
            core_1.NgZone,
            ram_service_1.RamService])
    ], LandingComponent);
    return LandingComponent;
}());
exports.LandingComponent = LandingComponent;
//# sourceMappingURL=landing.component.js.map