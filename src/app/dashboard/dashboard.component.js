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
var accounts_service_1 = require("../accounts.service");
var landing_component_1 = require("../landing/landing.component");
var angular_1 = require("@clr/angular");
var forms_1 = require("@angular/forms");
var angular2_toaster_1 = require("angular2-toaster");
var moment = require("moment");
var crypto_service_1 = require("../services/crypto.service");
var ram_service_1 = require("../services/ram.service");
var textMaskAddons_1 = require("text-mask-addons/dist/textMaskAddons");
var DashboardComponent = /** @class */ (function () {
    function DashboardComponent(eos, fb, aService, toaster, crypto, ram, zone) {
        this.eos = eos;
        this.fb = fb;
        this.aService = aService;
        this.toaster = toaster;
        this.crypto = crypto;
        this.ram = ram;
        this.zone = zone;
        this.busy = false;
        this.newAccountData = {
            t: 0,
            n: '',
            o: '',
            a: ''
        };
        this.payloadError = false;
        this.newAccountPayload = '';
        this.newAccOptions = 'thispk';
        this.accountname = '';
        this.accountname_valid = false;
        this.accountname_err = '';
        this.amounterror = '';
        this.amounterror2 = '';
        this.amounterror3 = '';
        this.passmatch = false;
        this.passmatch2 = false;
        this.ownerpk = '';
        this.ownerpub = '';
        this.activepk = '';
        this.activepub = '';
        this.agreeKeys = false;
        this.generating = false;
        this.generated = false;
        this.final_creator = '';
        this.final_active = '';
        this.final_owner = '';
        this.final_name = '';
        this.delegate_transfer = false;
        this.confirmationID = '';
        this.success = false;
        this.wrongwalletpass = '';
        this.numberMask = textMaskAddons_1.createNumberMask({
            prefix: '',
            allowDecimal: true,
            includeThousandsSeparator: false,
            decimalLimit: 4,
        });
        this.intMask = textMaskAddons_1.createNumberMask({
            prefix: '',
            allowDecimal: false,
            includeThousandsSeparator: false
        });
        this.selectedAccRem = null;
        this.accRemovalIndex = null;
        this.selectedTab = '';
        this.importedPublicKey = '';
        this.newAccountModal = false;
        this.importKeyModal = false;
        this.deleteAccModal = false;
        this.appVersion = window['appversion'];
        this.passform = this.fb.group({
            matchingPassword: this.fb.group({
                pass1: ['', [forms_1.Validators.required, forms_1.Validators.minLength(10)]],
                pass2: ['', [forms_1.Validators.required, forms_1.Validators.minLength(10)]]
            })
        });
        this.delegateForm = this.fb.group({
            delegate_amount: [1, [forms_1.Validators.required, forms_1.Validators.min(1)]],
            delegate_transfer: [false, forms_1.Validators.required],
            ram_amount: [4096, [forms_1.Validators.required, forms_1.Validators.min(4096)]],
            gift_amount: [0],
        });
        this.submitTXForm = this.fb.group({
            pass: ['', [forms_1.Validators.required, forms_1.Validators.minLength(10)]]
        });
        this.pvtform = this.fb.group({
            private_key: ['', forms_1.Validators.required]
        });
        this.passform2 = this.fb.group({
            matchingPassword: this.fb.group({
                pass1: ['', [forms_1.Validators.required, forms_1.Validators.minLength(10)]],
                pass2: ['', [forms_1.Validators.required, forms_1.Validators.minLength(10)]]
            })
        });
        this.errormsg = '';
        this.importedAccounts = [];
        this.lottieConfig = {
            path: 'assets/logoanim2.json',
            autoplay: true,
            loop: false
        };
    }
    DashboardComponent.prototype.openTXID = function () {
        window['shell']['openExternal']('https://www.bloks.io/transaction/' + this.confirmationID);
    };
    // verifyPrivateKey(input) {
    //   if (input !== '') {
    //     this.eos.checkPvtKey(input).then((results) => {
    //       this.importedAccount = results.foundAccounts[0];
    //     }).catch((e) => {
    //       this.importedAccount = null;
    //     });
    //   }
    // }
    DashboardComponent.prototype.verifyPrivateKey = function (input) {
        var _this = this;
        if (input !== '') {
            this.eos.checkPvtKey(input).then(function (results) {
                _this.importedPublicKey = results.publicKey;
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
                    _this.importwizard.forceNext();
                    _this.errormsg = '';
                });
            }).catch(function (e) {
                _this.zone.run(function () {
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
    DashboardComponent.prototype.doCancel = function () {
        this.importwizard.close();
    };
    DashboardComponent.prototype.importAccounts = function () {
        var _this = this;
        if (this.passform2.value.matchingPassword.pass1 === this.passform2.value.matchingPassword.pass2) {
            this.crypto.initKeys(this.importedPublicKey, this.passform2.value.matchingPassword.pass1).then(function () {
                _this.crypto.encryptAndStore(_this.pvtform.value.private_key, _this.importedPublicKey).then(function () {
                    _this.passform2.reset();
                    _this.importwizard.reset();
                    _this.pvtform.reset();
                    _this.aService.appendAccounts(_this.importedAccounts);
                }).catch(function (err) {
                    console.log(err);
                });
            });
        }
    };
    DashboardComponent.prototype.openRemoveAccModal = function (index, account) {
        this.selectedAccRem = account;
        this.accRemovalIndex = index;
        this.deleteAccModal = true;
    };
    DashboardComponent.prototype.doRemoveAcc = function () {
        this.aService.accounts.splice(this.accRemovalIndex, 1);
        this.deleteAccModal = false;
        this.aService.select(0);
        this.selectedTab = '0';
    };
    DashboardComponent.prototype.resetAndClose = function () {
        this.wizardaccount.reset();
        this.wizardaccount.close();
    };
    DashboardComponent.prototype.loadLastPage = function () {
        if (this.newAccOptions === 'newpk') {
            this.final_active = this.activepub;
            this.final_owner = this.ownerpub;
        }
        if (this.newAccOptions === 'thispk') {
            var account = this.aService.selected.getValue();
            this.final_active = account.details['permissions'][0]['required_auth'].keys[0].key;
            this.final_owner = account.details['permissions'][1]['required_auth'].keys[0].key;
        }
    };
    DashboardComponent.prototype.executeTX = function () {
        var _this = this;
        this.busy = true;
        var delegate_amount = parseFloat(this.delegateForm.get('delegate_amount').value);
        var ram_amount = parseInt(this.delegateForm.get('ram_amount').value, 10);
        var gift_amount = parseFloat(this.delegateForm.get('gift_amount').value);
        var delegate_transfer = this.delegateForm.get('delegate_transfer').value;
        var account = this.aService.selected.getValue();
        this.final_creator = account.name;
        var publicKey = account.details['permissions'][0]['required_auth'].keys[0].key;
        this.crypto.authenticate(this.submitTXForm.get('pass').value, publicKey).then(function (data) {
            if (data === true) {
                _this.eos.createAccount(_this.final_creator, _this.final_name, _this.final_owner, _this.final_active, delegate_amount, ram_amount, delegate_transfer, gift_amount, 'created with simpleos', _this.aService.mainnetActive['symbol']).then(function (txdata) {
                    console.log(txdata);
                    if (_this.newAccOptions === 'newpk') {
                        setTimeout(function () {
                            _this.eos.checkPvtKey(_this.activepk).then(function (results) {
                                var pform = _this.passform.value.matchingPassword;
                                // Import private key
                                if (pform.pass1 === pform.pass2) {
                                    _this.crypto.initKeys(_this.final_active, pform.pass1).then(function () {
                                        _this.crypto.encryptAndStore(_this.activepk, _this.final_active).then(function () {
                                            _this.aService.appendNewAccount(results.foundAccounts[0]);
                                            _this.wrongwalletpass = '';
                                            _this.busy = false;
                                            _this.success = true;
                                            _this.confirmationID = txdata['transaction_id'];
                                            _this.showToast('success', 'Account created', 'Check your history for confirmation.');
                                            _this.submitTXForm.reset();
                                            _this.aService.refreshFromChain();
                                        }).catch(function (err) {
                                            console.log(err);
                                        });
                                    });
                                }
                            });
                        }, 5000);
                    }
                    else if (_this.newAccOptions === 'friend') {
                        _this.wrongwalletpass = '';
                        _this.confirmationID = txdata['transaction_id'];
                        _this.success = true;
                        _this.busy = false;
                        _this.showToast('success', 'Account created', 'Check your history for confirmation. Please notify your friend.');
                        _this.submitTXForm.reset();
                    }
                    else if (_this.newAccOptions === 'thispk') {
                        setTimeout(function () {
                            _this.eos.getAccountInfo(_this.final_name).then(function (acc_data) {
                                _this.eos.getTokens(acc_data['account_name']).then(function (tokens) {
                                    acc_data['tokens'] = tokens;
                                    _this.aService.appendNewAccount(acc_data);
                                    _this.wrongwalletpass = '';
                                    _this.busy = false;
                                    _this.success = true;
                                    _this.confirmationID = txdata['transaction_id'];
                                    _this.showToast('success', 'Account created', 'Check your history for confirmation.');
                                    _this.submitTXForm.reset();
                                }).catch(function (err) {
                                    console.log(err);
                                });
                            });
                        }, 5000);
                    }
                }).catch(function (err2) {
                    var errorJSON = JSON.parse(err2);
                    if (errorJSON.error.code === 3081001) {
                        _this.wrongwalletpass = 'Not enough stake to perform this action.';
                    }
                    else if (errorJSON.error.code === 3050000) {
                        _this.wrongwalletpass = 'Account name not available.';
                    }
                    else {
                        _this.wrongwalletpass = errorJSON.error['what'];
                    }
                    _this.busy = false;
                    _this.success = false;
                });
            }
            else {
                _this.wrongwalletpass = 'Something went wrong!';
                _this.busy = false;
                _this.success = false;
            }
        }).catch(function () {
            _this.busy = false;
            _this.wrongwalletpass = 'Wrong password!';
            _this.success = false;
        });
    };
    DashboardComponent.prototype.ngOnInit = function () {
        var _this = this;
        this.accounts = [];
        this.eos.status.asObservable().subscribe(function (status) {
            if (status) {
                _this.loadStoredAccounts();
            }
        });
    };
    DashboardComponent.prototype.decodeAccountPayload = function (payload) {
        if (payload !== '') {
            if (payload.endsWith('=')) {
                try {
                    var accountObj = JSON.parse(atob(payload));
                    accountObj.t = moment(accountObj.t);
                    console.log(accountObj);
                    this.newAccountData = accountObj;
                    this.final_name = accountObj.n;
                    this.final_active = accountObj.a;
                    this.final_owner = accountObj.o;
                    this.final_creator = this.aService.selected.getValue().name;
                    this.payloadError = false;
                }
                catch (e) {
                    this.payloadError = true;
                }
            }
            else {
                this.payloadError = true;
            }
        }
    };
    DashboardComponent.prototype.handleAnimation = function (anim) {
        this.anim = anim;
        this.anim['setSpeed'](0.8);
    };
    DashboardComponent.prototype.selectAccount = function (idx) {
        this.selectedTab = idx;
        this.aService.select(idx);
    };
    DashboardComponent.prototype.loadStoredAccounts = function () {
        var _this = this;
        var account_names = Object.keys(this.eos.accounts.getValue());
        if (account_names.length > 0) {
            account_names.forEach(function (name) {
                var acc = _this.eos.accounts.getValue()[name];
                var balance = 0;
                acc['tokens'].forEach(function (tk) {
                    balance += landing_component_1.LandingComponent.parseEOS(tk);
                });
                var net = landing_component_1.LandingComponent.parseEOS(acc['total_resources']['net_weight']);
                var cpu = landing_component_1.LandingComponent.parseEOS(acc['total_resources']['cpu_weight']);
                balance += net;
                balance += cpu;
                var accData = {
                    name: acc['account_name'],
                    full_balance: Math.round((balance) * 10000) / 10000,
                    staked: net + cpu,
                    details: acc
                };
                _this.accounts.push(accData);
                _this.aService.accounts.push(accData);
            });
        }
        this.aService.initFirst();
    };
    DashboardComponent.prototype.cc = function (text) {
        var _this = this;
        window['navigator']['clipboard']['writeText'](text).then(function () {
            _this.showToast('success', 'Key copied to clipboard!', 'Please save it on a safe place.');
            //console.log(dt);
        }).catch(function () {
            _this.showToast('error', 'Clipboard didn\'t work!', 'Please try other way.');
        });
    };
    DashboardComponent.prototype.verifyAccountName = function (next) {
        var _this = this;
        console.log(next);
        try {
            this.accountname_valid = false;
            var res = this.eos.checkAccountName(this.accountname);
            var regexName = new RegExp('^([a-z]|[1-5])+$');
            if (res !== 0) {
                if (this.accountname.length === 12 && regexName.test(this.accountname)) {
                    this.eos.getAccountInfo(this.accountname).then(function (data) {
                        // this.eos['getAccount'](this.accountname, (err, data) => { // CSTAM
                        //   if (data) {
                        _this.accountname_err = 'This account name is not available. Please try another.';
                        _this.accountname_valid = false;
                        // }
                    }).catch(function (err) {
                        // console.log(err);
                        // if (err) {
                        _this.accountname_valid = true;
                        _this.newAccountData.n = _this.accountname;
                        _this.final_name = _this.accountname;
                        _this.final_creator = _this.aService.selected.getValue().name;
                        _this.accountname_err = '';
                        if (next) {
                            _this.wizardaccount.next();
                        }
                        // } else {
                        //
                        // }
                    });
                }
                else {
                    this.accountname_err = 'The account name must have exactly 12 characters. a-z, 1-5';
                    this.accountname_valid = false;
                }
            }
        }
        catch (e) {
            this.accountname_err = e.message;
            this.accountname_valid = false;
        }
    };
    DashboardComponent.prototype.initNewAcc = function () {
        var _this = this;
        this.aService.selected.asObservable().subscribe(function (sel) {
            if (sel) {
                _this.unstaked = sel.full_balance - sel.staked - sel.unstaking;
                //this.unstakeTime = moment.utc(sel.unstakeTime).add(72, 'hours').fromNow();
            }
        });
    };
    DashboardComponent.prototype.checkAmount = function (field) {
        if (field === "gift_amount" && (this.delegateForm.get(field).value !== "" || this.delegateForm.get(field).value > 0)) {
            if (parseFloat(this.delegateForm.get(field).value) > this.unstaked) {
                this.delegateForm.controls[field].setErrors({ 'incorrect': true });
                this.amounterror3 = 'invalid amount';
            }
            else {
                this.delegateForm.controls['delegate_amount'].setErrors(null);
                this.amounterror3 = '';
            }
        }
        else {
            if (parseFloat(this.delegateForm.get(field).value) === 0 || this.delegateForm.get(field).value === '') {
                this.delegateForm.controls[field].setErrors({ 'incorrect': true });
                this.amounterror = 'invalid amount';
            }
            else {
                if (parseFloat(this.delegateForm.get(field).value) > this.unstaked) {
                    this.delegateForm.controls[field].setErrors({ 'incorrect': true });
                    this.amounterror = 'invalid amount';
                }
                else {
                    this.delegateForm.controls['delegate_amount'].setErrors(null);
                    this.amounterror = '';
                }
            }
        }
    };
    DashboardComponent.prototype.checkAmountBytes = function () {
        var price = (this.ram.ramPriceEOS * (this.delegateForm.get('ram_amount').value / 1024));
        if (parseFloat(this.delegateForm.get('ram_amount').value) === 0 || this.delegateForm.get('ram_amount').value === '') {
            this.delegateForm.controls['ram_amount'].setErrors({ 'incorrect': true });
            this.amounterror2 = 'invalid amount';
        }
        else {
            if (price > this.unstaked) {
                this.delegateForm.controls['ram_amount'].setErrors({ 'incorrect': true });
                this.amounterror2 = 'invalid amount';
            }
            else {
                this.delegateForm.controls['ram_amount'].setErrors(null);
                this.amounterror2 = '';
            }
        }
    };
    DashboardComponent.prototype.passCompare = function () {
        var pForm = this.passform.value.matchingPassword;
        if (pForm.pass1 && pForm.pass2) {
            if (pForm.pass1 === pForm.pass2) {
                this.passform['controls'].matchingPassword['controls']['pass2'].setErrors(null);
                this.passmatch = true;
            }
            else {
                this.passform['controls'].matchingPassword['controls']['pass2'].setErrors({ 'incorrect': true });
                this.passmatch = false;
            }
        }
    };
    DashboardComponent.prototype.importedPassCompare = function () {
        var pForm = this.passform2.value.matchingPassword;
        if (pForm.pass1 && pForm.pass2) {
            if (pForm.pass1 === pForm.pass2) {
                this.passform2['controls'].matchingPassword['controls']['pass2'].setErrors(null);
                this.passmatch2 = true;
            }
            else {
                this.passform2['controls'].matchingPassword['controls']['pass2'].setErrors({ 'incorrect': true });
                this.passmatch2 = false;
            }
        }
    };
    DashboardComponent.prototype.generateKeys = function () {
        var _this = this;
        this.generating = true;
        setTimeout(function () {
            _this.eos.ecc.initialize().then(function () {
                _this.eos.ecc['randomKey'](128).then(function (privateKey) {
                    _this.ownerpk = privateKey;
                    _this.ownerpub = _this.eos.ecc['privateToPublic'](_this.ownerpk);
                    console.log(_this.ownerpk, _this.ownerpub);
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
    DashboardComponent.prototype.showToast = function (type, title, body) {
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
    __decorate([
        core_1.ViewChild('newAccountWizard'),
        __metadata("design:type", angular_1.ClrWizard)
    ], DashboardComponent.prototype, "wizardaccount", void 0);
    __decorate([
        core_1.ViewChild('importAccountWizard'),
        __metadata("design:type", angular_1.ClrWizard)
    ], DashboardComponent.prototype, "importwizard", void 0);
    DashboardComponent = __decorate([
        core_1.Component({
            selector: 'app-dashboard',
            templateUrl: './dashboard.component.html',
            styleUrls: ['./dashboard.component.css']
        }),
        __metadata("design:paramtypes", [eosjs_service_1.EOSJSService,
            forms_1.FormBuilder,
            accounts_service_1.AccountsService,
            angular2_toaster_1.ToasterService,
            crypto_service_1.CryptoService,
            ram_service_1.RamService,
            core_1.NgZone])
    ], DashboardComponent);
    return DashboardComponent;
}());
exports.DashboardComponent = DashboardComponent;
//# sourceMappingURL=dashboard.component.js.map