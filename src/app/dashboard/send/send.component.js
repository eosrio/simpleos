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
var accounts_service_1 = require("../../accounts.service");
var eosjs_service_1 = require("../../eosjs.service");
var operators_1 = require("rxjs/operators");
var textMaskAddons_1 = require("text-mask-addons/dist/textMaskAddons");
var angular2_toaster_1 = require("angular2-toaster");
var crypto_service_1 = require("../../services/crypto.service");
var moment = require("moment");
var SendComponent = /** @class */ (function () {
    function SendComponent(fb, aService, eos, crypto, toaster) {
        this.fb = fb;
        this.aService = aService;
        this.eos = eos;
        this.crypto = crypto;
        this.toaster = toaster;
        this.numberMask = textMaskAddons_1.createNumberMask({
            prefix: '',
            allowDecimal: true,
            includeThousandsSeparator: false,
            decimalLimit: 4,
        });
        this.token_balance = 0.0000;
        this.selectedToken = {
            name: 'EOS',
            price: 1.0000
        };
        this.selectedEditContact = null;
        this.knownExchanges = [
            'bitfinexdep1', 'krakenkraken', 'chainceoneos',
            'huobideposit', 'zbeoscharge1', 'okbtothemoon',
            'gateiowallet', 'eosusrwallet', 'binancecleos'
        ];
        this.memoMsg = 'optional';
        this.sendModal = false;
        this.newContactModal = false;
        this.contactExist = true;
        this.fromAccount = '';
        this.busy = false;
        this.sendForm = this.fb.group({
            token: ['EOS', forms_1.Validators.required],
            to: ['', forms_1.Validators.required],
            amount: ['', forms_1.Validators.required],
            memo: [''],
            add: [false],
            alias: [''],
        });
        this.contactForm = this.fb.group({
            account: ['', forms_1.Validators.required],
            name: ['', forms_1.Validators.required],
        });
        this.searchForm = this.fb.group({
            search: ['']
        });
        this.confirmForm = this.fb.group({
            pass: ['', [forms_1.Validators.required, forms_1.Validators.minLength(10)]]
        });
        this.contacts = [];
        this.loadContacts();
        this.sortContacts();
        this.errormsg = '';
        this.adderrormsg = '';
        this.amounterror = '';
        this.wrongpass = '';
        this.accountvalid = false;
        this.unstaking = 0;
        this.unstakeTime = '';
    }
    SendComponent.prototype.filter = function (val, indexed) {
        return this.contacts.filter(function (contact) {
            if (contact.type === 'contact') {
                return contact.name.toLowerCase().includes(val.toLowerCase()) || contact.account.toLowerCase().includes(val.toLowerCase());
            }
            else {
                if (indexed) {
                    return contact.type === 'letter';
                }
                else {
                    return false;
                }
            }
        });
    };
    SendComponent.prototype.checkExchangeAccount = function () {
        var memo = this.sendForm.get('memo');
        var acc = this.sendForm.get('to').value;
        if (this.knownExchanges.includes(acc)) {
            this.memoMsg = 'required';
            memo.setValidators([forms_1.Validators.required]);
            memo.updateValueAndValidity();
        }
        else {
            this.memoMsg = 'optional';
            memo.setValidators(null);
            memo.updateValueAndValidity();
        }
    };
    SendComponent.prototype.ngOnInit = function () {
        var _this = this;
        this.aService.selected.asObservable().subscribe(function (sel) {
            if (sel) {
                _this.fullBalance = sel.full_balance;
                _this.staked = sel.staked;
                _this.unstaked = sel.full_balance - sel.staked - sel.unstaking;
                _this.unstaking = sel.unstaking;
                _this.unstakeTime = moment.utc(sel.unstakeTime).add(72, 'hours').fromNow();
            }
        });
        this.sendForm.get('token').valueChanges.subscribe(function (symbol) {
            _this.sendForm.patchValue({
                amount: ''
            });
            if (symbol !== 'EOS') {
                var tk_idx = _this.aService.tokens.findIndex(function (val) {
                    return val.name === symbol;
                });
                _this.selectedToken = _this.aService.tokens[tk_idx];
                _this.token_balance = _this.selectedToken['balance'];
            }
            else {
                _this.selectedToken = { name: 'EOS', price: 1.0000 };
            }
        });
        this.filteredContacts = this.sendForm.get('to').valueChanges.pipe(operators_1.startWith(''), operators_1.map(function (value) { return _this.filter(value, false); }));
        this.searchedContacts = this.searchForm.get('search').valueChanges.pipe(operators_1.startWith(''), operators_1.map(function (value) { return _this.filter(value, true); }));
        this.onChanges();
    };
    SendComponent.prototype.onChanges = function () {
        var _this = this;
        this.sendForm.get('add').valueChanges.subscribe(function (val) {
            _this.add = val;
        });
    };
    SendComponent.prototype.checkContact = function (value) {
        this.checkExchangeAccount();
        var found = this.contacts.findIndex(function (el) {
            return el.account === value;
        });
        this.contactExist = found === -1;
    };
    SendComponent.prototype.setMax = function () {
        this.sendForm.patchValue({
            amount: this.sendForm.get('token').value === 'EOS' ? this.unstaked : this.token_balance
        });
    };
    SendComponent.prototype.checkAmount = function () {
        if (parseFloat(this.sendForm.value.amount) === 0 || this.sendForm.value.amount === '') {
            this.sendForm.controls['amount'].setErrors({ 'incorrect': true });
            this.amounterror = 'invalid amount';
        }
        else {
            var max = this.sendForm.get('token').value === 'EOS' ? this.unstaked : this.token_balance;
            if (parseFloat(this.sendForm.value.amount) > max) {
                this.sendForm.controls['amount'].setErrors({ 'incorrect': true });
                this.amounterror = 'invalid amount';
            }
            else {
                this.sendForm.controls['amount'].setErrors(null);
                this.amounterror = '';
            }
        }
    };
    SendComponent.prototype.checkAccountName = function () {
        var _this = this;
        if (this.sendForm.value.to !== '') {
            try {
                this.eos.checkAccountName(this.sendForm.value.to.toLowerCase());
                this.sendForm.controls['to'].setErrors(null);
                this.errormsg = '';
                this.eos.getAccountInfo(this.sendForm.value.to.toLowerCase()).then(function () {
                    _this.sendForm.controls['to'].setErrors(null);
                    _this.errormsg = '';
                }).catch(function () {
                    _this.sendForm.controls['to'].setErrors({ 'incorrect': true });
                    _this.errormsg = 'account does not exist';
                });
            }
            catch (e) {
                this.sendForm.controls['to'].setErrors({ 'incorrect': true });
                this.errormsg = e.message;
            }
        }
        else {
            this.errormsg = '';
        }
    };
    SendComponent.prototype.checkAccountModal = function () {
        var _this = this;
        if (this.contactForm.value.account !== '') {
            try {
                this.eos.checkAccountName(this.contactForm.value.account.toLowerCase());
                this.contactForm.controls['account'].setErrors(null);
                this.adderrormsg = '';
                this.eos.getAccountInfo(this.contactForm.value.account.toLowerCase()).then(function () {
                    _this.contactForm.controls['account'].setErrors(null);
                    _this.adderrormsg = '';
                }).catch(function () {
                    _this.contactForm.controls['account'].setErrors({ 'incorrect': true });
                    _this.adderrormsg = 'account does not exist';
                });
            }
            catch (e) {
                this.contactForm.controls['account'].setErrors({ 'incorrect': true });
                this.adderrormsg = e.message;
            }
        }
        else {
            this.adderrormsg = '';
        }
    };
    SendComponent.prototype.insertNewContact = function (data, silent) {
        var idx = this.contacts.findIndex(function (item) {
            return item.account === data.account;
        });
        if (idx === -1) {
            this.contacts.push(data);
            this.contactForm.reset();
            this.searchForm.patchValue({
                search: ''
            });
        }
        else {
            if (!silent) {
                alert('duplicate entry');
            }
        }
    };
    SendComponent.prototype.addAccountsAsContacts = function () {
        var _this = this;
        this.aService.accounts.map(function (acc) { return _this.insertNewContact({
            type: 'contact',
            name: acc.name,
            account: acc.name
        }, true); });
        this.addDividers();
        this.storeContacts();
    };
    SendComponent.prototype.removeDividers = function () {
        var _this = this;
        this.contacts.forEach(function (contact, idx) {
            if (contact.type === 'letter') {
                _this.contacts.splice(idx, 1);
            }
        });
    };
    SendComponent.prototype.addDividers = function () {
        var _this = this;
        this.removeDividers();
        var divs = [];
        this.contacts.forEach(function (contact) {
            if (contact.type === 'contact') {
                var letter_1 = contact.name.charAt(0).toUpperCase();
                if (!divs.includes(letter_1)) {
                    divs.push(letter_1);
                    var index = _this.contacts.findIndex(function (item) {
                        return item.name === letter_1;
                    });
                    if (index === -1) {
                        _this.contacts.push({
                            type: 'letter',
                            name: letter_1
                        });
                        _this.contactForm.reset();
                        _this.searchForm.patchValue({
                            search: ''
                        });
                    }
                }
            }
        });
        this.sortContacts();
    };
    SendComponent.prototype.addContact = function () {
        var _this = this;
        try {
            this.eos.checkAccountName(this.contactForm.value.account.toLowerCase());
            this.eos.getAccountInfo(this.contactForm.value.account.toLowerCase()).then(function () {
                _this.insertNewContact({
                    type: 'contact',
                    name: _this.contactForm.value.name,
                    account: _this.contactForm.value.account.toLowerCase()
                }, false);
                _this.newContactModal = false;
                _this.addDividers();
                _this.storeContacts();
            }).catch(function (error) {
                alert(JSON.parse(error.message).error.details[0].message);
            });
        }
        catch (e) {
            alert('invalid account name!');
            console.log(e);
        }
    };
    SendComponent.prototype.addContactOnSend = function () {
        var _this = this;
        try {
            this.eos.checkAccountName(this.sendForm.value.to.toLowerCase());
            this.eos.getAccountInfo(this.sendForm.value.to.toLowerCase()).then(function () {
                _this.insertNewContact({
                    type: 'contact',
                    name: _this.sendForm.value['alias'],
                    account: _this.sendForm.value.to.toLowerCase()
                }, false);
                _this.addDividers();
                _this.storeContacts();
            }).catch(function (error) {
                alert(JSON.parse(error.message).error.details[0].message);
            });
        }
        catch (e) {
            alert('invalid account name!');
            console.log(e);
        }
    };
    SendComponent.prototype.sortContacts = function () {
        this.contacts.sort(function (a, b) {
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });
        this.searchForm.patchValue({
            search: ''
        });
    };
    SendComponent.prototype.selectContact = function (contact) {
        this.contactExist = true;
        this.sendForm.patchValue({
            to: contact.account,
            alias: contact.name
        });
    };
    SendComponent.prototype.storeContacts = function () {
        localStorage.setItem('simpleos.contacts', JSON.stringify(this.contacts));
    };
    SendComponent.prototype.loadContacts = function () {
        var contacts = localStorage.getItem('simpleos.contacts');
        if (contacts) {
            this.contacts = JSON.parse(contacts);
        }
        else {
            this.addAccountsAsContacts();
        }
    };
    SendComponent.prototype.openSendModal = function () {
        this.confirmForm.reset();
        this.fromAccount = this.aService.selected.getValue().name;
        this.sendModal = true;
    };
    SendComponent.prototype.transfer = function () {
        var _this = this;
        this.checkExchangeAccount();
        this.busy = true;
        var selAcc = this.aService.selected.getValue();
        var from = selAcc.name;
        var to = this.sendForm.get('to').value.toLowerCase();
        var amount = parseFloat(this.sendForm.get('amount').value);
        var memo = this.sendForm.get('memo').value;
        var publicKey = selAcc.details['permissions'][0]['required_auth'].keys[0].key;
        if (amount > 0 && this.sendForm.valid) {
            this.crypto.authenticate(this.confirmForm.get('pass').value, publicKey).then(function (res) {
                // console.log(res);
                if (res) {
                    var contract = 'eosio.token';
                    var tk_name_1 = _this.sendForm.get('token').value;
                    // console.log(tk_name);
                    // console.log(this.aService.tokens);
                    var precision = 4;
                    if (tk_name_1 !== 'EOS') {
                        var idx = _this.aService.tokens.findIndex(function (val) {
                            return val.name === tk_name_1;
                        });
                        // console.log(idx);
                        contract = _this.aService.tokens[idx].contract;
                        var balance = _this.aService.tokens[idx].balance.toString();
                        if (balance.indexOf('.') !== -1) {
                            precision = balance.split('.')[1].toString().length;
                        }
                    }
                    // console.log(precision);
                    // console.log(contract, from, to, amount.toFixed(precision) + ' ' + tk_name, memo);
                    _this.eos.transfer(contract, from, to, amount.toFixed(precision) + ' ' + tk_name_1, memo).then(function (result) {
                        if (result === true) {
                            _this.wrongpass = '';
                            _this.sendModal = false;
                            _this.busy = false;
                            _this.showToast('success', 'Transation broadcasted', 'Check your history for confirmation.');
                            _this.aService.refreshFromChain();
                            setTimeout(function () {
                                var sel = _this.aService.selected.getValue();
                                _this.unstaked = sel.full_balance - sel.staked - sel.unstaking;
                            }, 2000);
                            _this.confirmForm.reset();
                            if (_this.add === true && _this.sendForm.get('alias').value !== '') {
                                _this.addContactOnSend();
                            }
                        }
                        else {
                            _this.wrongpass = JSON.parse(result).error.details[0].message;
                            _this.busy = false;
                        }
                    }).catch(function (error) {
                        console.log('Catch2', error);
                        if (error.error.code === 3081001) {
                            _this.wrongpass = 'Not enough stake to perform this action.';
                        }
                        else {
                            _this.wrongpass = error.error['what'];
                        }
                        _this.busy = false;
                    });
                }
                else {
                    _this.busy = false;
                    _this.wrongpass = 'Wrong password!';
                }
            }).catch(function (err) {
                console.log(err);
                _this.busy = false;
                _this.wrongpass = 'Error: Wrong password!';
            });
        }
    };
    SendComponent.prototype.showToast = function (type, title, body) {
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
    SendComponent.prototype.openEditContactModal = function (contact) {
        console.log(contact);
        this.contactForm.patchValue({
            account: contact.account
        });
        this.editContactModal = true;
        this.selectedEditContact = contact;
    };
    SendComponent.prototype.doEditContact = function () {
        var _this = this;
        var index = this.contacts.findIndex(function (el) {
            return el.account === _this.selectedEditContact.account;
        });
        this.contacts[index].name = this.contactForm.get('name').value;
        this.editContactModal = false;
        this.selectedEditContact = null;
        this.contactForm.reset();
        this.addDividers();
        this.storeContacts();
    };
    SendComponent.prototype.openDeleteContactModal = function (contact) {
        this.deleteContactModal = true;
        this.selectedEditContact = contact;
    };
    SendComponent.prototype.doDeleteContact = function () {
        var _this = this;
        var index = this.contacts.findIndex(function (el) {
            return el.account === _this.selectedEditContact.account;
        });
        this.contacts.splice(index, 1);
        this.deleteContactModal = false;
        this.addDividers();
        this.storeContacts();
    };
    SendComponent = __decorate([
        core_1.Component({
            selector: 'app-send',
            templateUrl: './send.component.html',
            styleUrls: ['./send.component.css'],
        }),
        __metadata("design:paramtypes", [forms_1.FormBuilder,
            accounts_service_1.AccountsService,
            eosjs_service_1.EOSJSService,
            crypto_service_1.CryptoService,
            angular2_toaster_1.ToasterService])
    ], SendComponent);
    return SendComponent;
}());
exports.SendComponent = SendComponent;
//# sourceMappingURL=send.component.js.map