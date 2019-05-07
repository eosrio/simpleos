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
var eosjs_service_1 = require("../services/eosjs.service");
var forms_1 = require("@angular/forms");
var accounts_service_1 = require("../services/accounts.service");
var router_1 = require("@angular/router");
var angular_1 = require("@clr/angular");
var network_service_1 = require("../services/network.service");
var crypto_service_1 = require("../services/crypto.service");
var angular2_toaster_1 = require("angular2-toaster");
var ram_service_1 = require("../services/ram.service");
var http_1 = require("@angular/common/http");
var voting_service_1 = require("../services/voting.service");
var LandingComponent = /** @class */ (function () {
    function LandingComponent(eos, voting, crypto, fb, aService, toaster, network, router, zone, ram, http) {
        var _this = this;
        this.eos = eos;
        this.voting = voting;
        this.crypto = crypto;
        this.fb = fb;
        this.aService = aService;
        this.toaster = toaster;
        this.network = network;
        this.router = router;
        this.zone = zone;
        this.ram = ram;
        this.http = http;
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
        this.relayMethod = false;
        this.requestValid = false;
        this.requestId = '';
        this.requestError = '';
        this.noPIN = true;
        this.apierror = '';
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
            autoplay: false,
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
            pass: [''],
            customImportBK: ['', forms_1.Validators.required],
        });
        this.refundForm = this.fb.group({
            account: ['', forms_1.Validators.required],
            memo: ['', forms_1.Validators.required]
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
    LandingComponent.prototype.checkPIN = function () {
        this.noPIN = localStorage.getItem('simpleos-hash') === null;
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
        this.getCurrentEndpoint();
        setTimeout(function () {
            _this.anim.pause();
        }, 10);
        setTimeout(function () {
            _this.anim.play();
        }, 900);
        this.checkPIN();
    };
    LandingComponent.prototype.getCurrentEndpoint = function () {
        if (this.network.activeChain.lastNode !== '') {
            this.endpoint = this.network.activeChain.lastNode;
        }
        else {
            this.endpoint = this.network.activeChain['firstApi'];
        }
    };
    LandingComponent.prototype.parseSYMBOL = function (tk_string) {
        if (tk_string.split(' ')[1] === this.network.activeChain['symbol']) {
            return parseFloat(tk_string.split(' ')[0]);
        }
        else {
            return 0;
        }
    };
    LandingComponent.prototype.changeChain = function (event) {
        this.exisitswizard.reset();
        this.network.changeChain(event);
        this.getCurrentEndpoint();
    };
    LandingComponent.prototype.setEndPoint = function (ep) {
        if (ep !== this.endpoint) {
            this.endpoint = ep;
            this.customConnect();
            this.endpointModal = false;
        }
    };
    LandingComponent.prototype.setPin = function () {
        this.crypto.createPIN(this.pin);
    };
    LandingComponent.prototype.validateExchangeMemo = function (account, memo) {
        if (this.network.activeChain['exchanges']) {
            if (this.network.activeChain['exchanges'][account]) {
                var ex = this.network.activeChain['exchanges'][account];
                // check memo size
                if (ex['memo_size']) {
                    if (memo.length !== ex['memo_size']) {
                        return false;
                    }
                }
                // check memo pattern
                if (ex['pattern']) {
                    var regex = new RegExp(ex['pattern']);
                    return regex.test(memo);
                }
                return true;
            }
            else {
                return true;
            }
        }
        else {
            return true;
        }
    };
    LandingComponent.prototype.verifyAccountName = function (next) {
        var _this = this;
        try {
            this.accountname_valid = false;
            var res = this.eos.checkAccountName(this.accountname.toLowerCase());
            var regexName = new RegExp('^([a-z]|[1-5])+$');
            if (res !== 0) {
                if (this.accountname.length === 12 && regexName.test(this.accountname.toLowerCase())) {
                    this.eos.getAccountInfo(this.accountname.toLowerCase()).then(function () {
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
                _this.eos.ecc['randomKey'](64).then(function (privateKey) {
                    _this.ownerpk = privateKey;
                    _this.ownerpub = _this.eos.ecc['privateToPublic'](_this.ownerpk);
                    _this.eos.ecc['randomKey'](64).then(function (privateKey2) {
                        _this.activepk = privateKey2;
                        _this.activepub = _this.eos.ecc['privateToPublic'](_this.activepk);
                        _this.generating = false;
                        _this.generated = true;
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
                _this.eos.ecc['randomKey'](64).then(function (privateKey) {
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
                n: this.accountname.toLowerCase(),
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
    LandingComponent.prototype.makeRelayRequest = function () {
        var _this = this;
        var reqData = {
            name: this.accountname.toLowerCase(),
            active: this.activepub,
            owner: this.ownerpub,
            refund_account: this.refundForm.get('account').value,
            refund_memo: this.refundForm.get('memo').value
        };
        if (this.validateExchangeMemo(reqData.refund_account, reqData.refund_memo)) {
            this.http.post('https://hapi.eosrio.io/account_creation_api/request_account', reqData).subscribe(function (data) {
                console.log(data);
                if (data['status'] === 'OK') {
                    _this.requestId = data['requestId'];
                    _this.requestError = '';
                    _this.requestValid = true;
                }
                else {
                    _this.requestValid = false;
                    _this.requestError = data['msg'];
                }
            });
        }
        else {
            this.requestError = 'Invalid memo format';
            this.requestValid = false;
        }
    };
    LandingComponent.prototype.makeMemo = function () {
        this.memo = this.accountname.toLowerCase() + '-' + this.ownerpub + '-' + this.activepub;
    };
    LandingComponent.prototype.retryConn = function () {
        this.network.connect(true);
    };
    LandingComponent.prototype.customConnect = function () {
        this.network.startup(this.endpoint);
    };
    LandingComponent.prototype.getConstitution = function () {
        if (this.network.activeChain['name'] === 'EOS MAINNET') {
            this.eos.getConstitution();
        }
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
    LandingComponent.prototype.preImportCredentials = function (EOS) {
        if (EOS) {
            if (!this.noPIN) {
                this.importCredentials();
            }
        }
        else {
            if (!this.noPIN && this.aService.activeChain.name !== 'EOS MAINNET') {
                this.importCredentials();
            }
        }
    };
    LandingComponent.prototype.importCredentials = function () {
        var _this = this;
        var pubk = this.publicEOS;
        var pass1 = this.passform.value.matchingPassword.pass1;
        var pass2 = this.passform.value.matchingPassword.pass2;
        if (pass1 === pass2) {
            this.crypto.initKeys(pubk, pass1).then(function () {
                var pvk = _this.pvtform.value.private_key;
                _this.crypto.encryptAndStore(pvk, pubk).then(function () {
                    pvk = '';
                    _this.aService.importAccounts(_this.importedAccounts).then(function (data) {
                        if (data.length > 0) {
                            _this.crypto.decryptKeys(pubk).then(function () {
                                _this.router.navigate(['dashboard', 'vote']).then(function () {
                                }).catch(function (err) {
                                    console.log(err);
                                });
                                if (_this.lockscreen) {
                                    _this.setPin();
                                }
                            }).catch(function (error) {
                                console.log('Error', error);
                            });
                        }
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
                    _this.apierror = '';
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
                    if (e.message === 'api_arror') {
                        _this.apierror = 'API Unavailable, please try again with another endpoint.';
                    }
                });
            });
        }
    };
    LandingComponent.prototype.doCancel = function () {
        this.exisitswizard.close();
    };
    // Verify public key - step 1
    LandingComponent.prototype.checkAccount = function () {
        var _this = this;
        if (this.eos.ready) {
            this.check = true;
            this.accounts = [];
            this.eos.loadPublicKey(this.publicEOS.trim()).then(function (account_data) {
                console.log(account_data);
                _this.processCheckAccount(account_data.foundAccounts);
            }).catch(function (err) {
                console.log('ERROR', err.message);
                console.log('ACCOUNTS', err.accounts);
                _this.checkerr = err;
                _this.processCheckAccount(err.accounts);
            });
        }
    };
    // Verify public key - step 2
    LandingComponent.prototype.processCheckAccount = function (foundAccounts) {
        var _this = this;
        foundAccounts.forEach(function (acc) {
            // Parse tokens and calculate balance with system token
            if (acc['tokens']) {
                _this.processTokens(acc);
            }
            else {
                _this.eos.getTokens(acc['account_name']).then(function (tokens) {
                    acc['tokens'] = tokens;
                    _this.processTokens(acc);
                }).catch(function (err) {
                    console.log(err);
                });
            }
        });
        this.checkerr = '';
    };
    // Verify public key - step 3
    LandingComponent.prototype.processTokens = function (acc) {
        var _this = this;
        var balance = 0;
        acc['tokens'].forEach(function (tk) {
            balance += _this.parseSYMBOL(tk);
        });
        // Add stake balance
        balance += this.parseSYMBOL(acc['total_resources']['cpu_weight']);
        balance += this.parseSYMBOL(acc['total_resources']['net_weight']);
        var accData = {
            name: acc['account_name'],
            full_balance: Math.round((balance) * 10000) / 10000
        };
        this.accounts.push(accData);
    };
    LandingComponent.prototype.inputIMClick = function () {
        this.customImportBK.nativeElement.click();
    };
    LandingComponent.prototype.importCheckBK = function (a) {
        this.infile = a.target.files[0];
        console.log(this.infile);
        var name = this.infile.name;
        if (name.split('.')[1] !== 'bkp') {
            this.showToast('error', 'Wrong file!', '');
            this.infile = '';
            return false;
        }
        this.choosedFil = name;
        console.log(this.choosedFil);
    };
    LandingComponent.prototype.importBK = function () {
        var _this = this;
        this.disableIm = true;
        this.busy2 = true;
        if (this.infile && this.infile !== '') {
            window['filesystem']['readFile'](this.infile.path, 'utf-8', function (err, data) {
                if (!err) {
                    var pass = _this.importForm.value.pass;
                    var arrLS = null;
                    var decrypt = null;
                    try {
                        console.log('trying to parse json...');
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
                        _this.showToast('success', 'Imported with success!', 'Application will restart... wait for it!');
                        LandingComponent_1.resetApp();
                        _this.choosedFil = '';
                        _this.disableIm = false;
                        _this.busy2 = false;
                        _this.importBKP = false;
                    }
                    else {
                        _this.choosedFil = '';
                        _this.disableIm = false;
                        _this.busy2 = false;
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
            voting_service_1.VotingService,
            crypto_service_1.CryptoService,
            forms_1.FormBuilder,
            accounts_service_1.AccountsService,
            angular2_toaster_1.ToasterService,
            network_service_1.NetworkService,
            router_1.Router,
            core_1.NgZone,
            ram_service_1.RamService,
            http_1.HttpClient])
    ], LandingComponent);
    return LandingComponent;
}());
exports.LandingComponent = LandingComponent;
//# sourceMappingURL=landing.component.js.map