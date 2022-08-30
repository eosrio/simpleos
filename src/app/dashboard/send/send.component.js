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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendComponent = void 0;
const core_1 = require("@angular/core");
const forms_1 = require("@angular/forms");
const accounts_service_1 = require("../../services/accounts.service");
const operators_1 = require("rxjs/operators");
const textMaskAddons_1 = require("text-mask-addons/dist/textMaskAddons");
const crypto_service_1 = require("../../services/crypto/crypto.service");
const ledger_service_1 = require("../../services/ledger/ledger.service");
const network_service_1 = require("../../services/network.service");
const moment = require("moment");
const transaction_factory_service_1 = require("../../services/eosio/transaction-factory.service");
const eosjs2_service_1 = require("../../services/eosio/eosjs2.service");
const resource_service_1 = require("../../services/resource.service");
let SendComponent = class SendComponent {
    constructor(fb, aService, eosjs, crypto, cdr, ledger, network, trxFactory, resource) {
        this.fb = fb;
        this.aService = aService;
        this.eosjs = eosjs;
        this.crypto = crypto;
        this.cdr = cdr;
        this.ledger = ledger;
        this.network = network;
        this.trxFactory = trxFactory;
        this.resource = resource;
        this.numberMask = (0, textMaskAddons_1.createNumberMask)({
            prefix: '',
            allowDecimal: true,
            includeThousandsSeparator: false,
            decimalLimit: 4,
        });
        this.token_balance = 0.0000;
        this.selectedToken = {};
        this.selectedEditContact = null;
        this.selectedDeleteContact = null;
        this.knownExchanges = [
            'bitfinexdep1', 'krakenkraken', 'chainceoneos',
            'huobideposit', 'zbeoscharge1', 'okbtothemoon',
            'gateiowallet', 'eosusrwallet', 'binancecleos',
            'novadaxstore', 'floweosaccnt', 'coinwwallet1'
        ];
        this.memoMsg = 'optional';
        this.memoMsgModal = 'optional';
        this.selectedAccountName = '';
        this.subscriptions = [];
        this.sendModal = false;
        this.newContactModal = false;
        this.contactExist = true;
        this.fromAccount = '';
        this.busy = false;
        this.sendForm = this.fb.group({
            token: [aService.activeChain['symbol'], forms_1.Validators.required],
            to: ['', forms_1.Validators.required],
            amount: ['', forms_1.Validators.required],
            memo: [''],
            add: [false],
            alias: [''],
        });
        this.numberMask = (0, textMaskAddons_1.createNumberMask)({
            prefix: '',
            allowDecimal: true,
            includeThousandsSeparator: false,
            decimalLimit: this.aService.activeChain.precision,
        });
        this.contactForm = this.fb.group({
            account: ['', forms_1.Validators.required],
            name: ['', forms_1.Validators.required],
            memo: [''],
        });
        this.searchForm = this.fb.group({
            search: ['']
        });
        this.confirmForm = this.fb.group({
            pass: ['', [forms_1.Validators.required, forms_1.Validators.minLength(4)]]
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
        this.selectedToken = {
            name: this.aService.activeChain['symbol'],
            price: 1.0000
        };
        this.selectedDeleteContact = [];
    }
    ngOnDestroy() {
        this.subscriptions.forEach(s => s.unsubscribe());
    }
    compareContact(contact, text) {
        return contact.name.toLowerCase().includes(text.toLowerCase()) || contact.account.toLowerCase().includes(text.toLowerCase());
    }
    filter(val, indexed) {
        return this.contacts.filter((contact, idx, arr) => {
            if (contact.type === 'contact') {
                return this.compareContact(contact, val);
            }
            else {
                if (indexed) {
                    if (arr[idx + 1]) {
                        if (arr[idx + 1].type === 'contact') {
                            return this.compareContact(arr[idx + 1], val);
                        }
                        else {
                            return false;
                        }
                    }
                }
                else {
                    return false;
                }
            }
        });
    }
    checkExchangeAccount() {
        const memo = this.sendForm.get('memo');
        const acc = this.sendForm.value.to.toLowerCase();
        if (this.knownExchanges.includes(acc)) {
            this.checkConfigExchange(memo, acc);
            this.memoMsg = 'required';
            memo.updateValueAndValidity();
            console.log(memo);
        }
        else {
            this.memoMsg = 'optional';
            memo.setValidators(null);
            memo.updateValueAndValidity();
        }
    }
    ngOnInit() {
        this.subscriptions.push(this.aService.selected.asObservable().subscribe((sel) => __awaiter(this, void 0, void 0, function* () {
            if (sel['name']) {
                if (this.selectedAccountName !== sel['name']) {
                    this.selectedAccountName = sel['name'];
                    this.fullBalance = sel.full_balance;
                    this.staked = sel.staked;
                    this.unstaked = sel.full_balance - sel.staked - sel.unstaking;
                    this.unstaking = sel.unstaking;
                    this.unstakeTime = moment.utc(sel.unstakeTime).add(72, 'hours').fromNow();
                    yield this.aService.refreshFromChain(false);
                    this.cdr.detectChanges();
                }
            }
        })));
        this.subscriptions.push(this.aService.events.asObservable().subscribe((ev) => {
            if (ev.event === 'imported_accounts') {
                for (const acc of ev.data) {
                    this.insertNewContact({
                        type: 'contact',
                        name: acc.account_name,
                        account: acc.account_name,
                        default_memo: acc.memo === undefined ? '' : acc.memo
                    }, true);
                }
                this.addDividers();
                this.storeContacts();
            }
        }));
        this.subscriptions.push(this.sendForm.get('token').valueChanges.subscribe((symbol) => {
            this.sendForm.patchValue({ amount: '' });
            if (this.aService.activeChain.symbol === symbol.toUpperCase()) {
                this.selectedToken = { name: this.aService.activeChain['symbol'], price: 1.0000 };
            }
            else {
                if (symbol !== '') {
                    const token = this.aService.tokens.find(tk => tk.name === symbol.toUpperCase());
                    if (token) {
                        this.selectedToken = token;
                    }
                    else {
                        this.selectedToken = { name: this.aService.activeChain['symbol'], price: 1.0000 };
                    }
                }
                else {
                    this.selectedToken = { name: this.aService.activeChain['symbol'], price: 1.0000 };
                }
            }
            if (this.selectedToken) {
                this.token_balance = this.selectedToken.balance;
            }
        }));
        this.precision = '1.' + this.aService.activeChain['precision'];
        this.filteredContacts = this.sendForm.get('to').valueChanges.pipe((0, operators_1.startWith)(''), (0, operators_1.map)(value => this.filter(value, false)));
        this.searchedContacts = this.searchForm.get('search').valueChanges.pipe((0, operators_1.startWith)(''), (0, operators_1.map)(value => this.filter(value, true)));
        this.filteredTokens = this.sendForm.get('token').valueChanges.pipe((0, operators_1.startWith)(''), (0, operators_1.map)(tokenText => {
            return this.aService.tokens.filter((value, index, array) => {
                return value.name.includes(tokenText.toUpperCase());
            });
        }));
        this.subscriptions.push(this.sendForm.get('add').valueChanges.subscribe(val => {
            this.add = val;
        }));
    }
    checkContact(value) {
        const found = this.contacts.find((el) => {
            return el.account === value;
        });
        this.contactExist = !!found;
    }
    setMax() {
        this.sendForm.patchValue({
            amount: this.sendForm.get('token').value === this.aService.activeChain['symbol'] ? this.unstaked : this.token_balance
        });
    }
    checkAmount() {
        if (parseFloat(this.sendForm.value.amount) === 0 || this.sendForm.value.amount === '') {
            this.sendForm.controls['amount'].setErrors({ 'incorrect': true });
            this.amounterror = 'invalid amount';
        }
        else {
            const max = this.sendForm.get('token').value === this.aService.activeChain['symbol'] ? this.unstaked : this.token_balance;
            if (parseFloat(this.sendForm.value.amount) > max) {
                this.sendForm.controls['amount'].setErrors({ 'incorrect': true });
                this.amounterror = 'invalid amount';
            }
            else {
                this.sendForm.controls['amount'].setErrors(null);
                this.amounterror = '';
            }
        }
    }
    checkAccountName() {
        if (this.sendForm.value.to !== '') {
            try {
                this.eosjs.checkAccountName(this.sendForm.value.to.toLowerCase());
                this.eosjs.getAccountInfo(this.sendForm.value.to.toLowerCase()).then(() => {
                    this.sendForm.controls['to'].setErrors(null);
                    const token = this.aService.tokens.find((val) => val.name === this.sendForm.value.token);
                    if (token) {
                        this.eosjs.rpc.get_currency_balance(token.contract, this.sendForm.value.to.toLowerCase(), this.sendForm.value.token).then((tokenData) => {
                            console.log(tokenData);
                        });
                    }
                    this.checkExchangeAccount();
                    this.errormsg = '';
                }).catch(() => {
                    this.sendForm.controls['to'].setErrors({ 'incorrect': true });
                    this.errormsg = 'account does not exist';
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
    }
    checkAccountModal() {
        if (this.contactForm.value.account !== '') {
            try {
                this.eosjs.checkAccountName(this.contactForm.value.account.toLowerCase());
                this.contactForm.controls['account'].setErrors(null);
                this.adderrormsg = '';
                this.checkExchangeAccountModal();
                this.eosjs.getAccountInfo(this.contactForm.value.account.toLowerCase()).then(() => {
                    this.contactForm.controls['account'].setErrors(null);
                    this.adderrormsg = '';
                }).catch(() => {
                    this.contactForm.controls['account'].setErrors({ 'incorrect': true });
                    this.adderrormsg = 'account does not exist';
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
    }
    checkConfigExchange(memo, acc) {
        const exchanges = this.aService.activeChain['exchanges'];
        console.log(exchanges[acc].pattern.toString());
        if (exchanges[acc]) {
            if (exchanges[acc].memo_size) {
                const memo_size = parseInt(exchanges[acc].memo_size, 10);
                memo.setValidators([
                    forms_1.Validators.required,
                    forms_1.Validators.pattern(exchanges[acc].pattern),
                    forms_1.Validators.minLength(memo_size),
                    forms_1.Validators.maxLength(memo_size)
                ]);
            }
            else {
                memo.setValidators([
                    forms_1.Validators.required,
                    forms_1.Validators.pattern(exchanges[acc].pattern)
                ]);
                console.log('only pattern');
            }
        }
        else {
            memo.setValidators([forms_1.Validators.required]);
        }
    }
    checkExchangeAccountModal() {
        const memo = this.contactForm.get('memo');
        const acc = this.contactForm.value.account.toLowerCase();
        if (this.knownExchanges.includes(acc)) {
            this.checkConfigExchange(memo, acc);
            this.memoMsgModal = 'required';
            memo.updateValueAndValidity();
            console.log(memo);
        }
        else {
            this.memoMsgModal = 'optional';
            memo.setValidators(null);
            memo.updateValueAndValidity();
        }
    }
    insertNewContact(data, silent) {
        const idx = this.contacts.findIndex((item) => {
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
                // this.electron.remote.dialog.showErrorBox('Error', 'duplicated entry');
            }
        }
    }
    addAccountsAsContacts() {
        this.aService.accounts.map(acc => this.insertNewContact({
            type: 'contact',
            name: acc.name,
            account: acc.name
        }, true));
        this.addDividers();
        this.storeContacts();
    }
    removeDividers() {
        this.contacts.forEach((contact, idx) => {
            if (contact.type === 'letter') {
                this.contacts.splice(idx, 1);
            }
        });
    }
    addDividers() {
        this.removeDividers();
        const divs = [];
        this.contacts.forEach((contact) => {
            if (contact.type === 'contact') {
                const letter = contact.name.charAt(0).toUpperCase();
                if (!divs.includes(letter)) {
                    divs.push(letter);
                    const index = this.contacts.findIndex((item) => {
                        return item.name === letter;
                    });
                    if (index === -1) {
                        this.contacts.push({ type: 'letter', name: letter });
                        this.contactForm.reset();
                        this.searchForm.patchValue({ search: '' });
                    }
                }
            }
        });
        this.sortContacts();
    }
    addContact() {
        try {
            this.eosjs.checkAccountName(this.contactForm.value.account.toLowerCase());
            this.eosjs.getAccountInfo(this.contactForm.value.account.toLowerCase()).then(() => {
                this.insertNewContact({
                    type: 'contact',
                    name: this.contactForm.value.name,
                    account: this.contactForm.value.account.toLowerCase(),
                    default_memo: this.contactForm.value.memo
                }, false);
                this.newContactModal = false;
                this.addDividers();
                this.storeContacts();
            }).catch((err) => {
                if (typeof err === 'object') {
                    if (err.json) {
                        alert("Error: " + err.json.error.details[0].message);
                    }
                    else {
                        alert("Error: " + err.error.details[0].message);
                    }
                }
                else {
                    if (err.json) {
                        alert("Error: " + JSON.parse(err).json.error.details[0].message);
                    }
                    else {
                        alert("Error: " + JSON.parse(err).error.details[0].message);
                    }
                }
            });
        }
        catch (e) {
            alert('invalid account name!');
            console.log(e);
        }
    }
    // TODO: implementar
    addContactOnSend() {
        try {
            this.eosjs.checkAccountName(this.sendForm.value.to.toLowerCase());
            this.eosjs.getAccountInfo(this.sendForm.value.to.toLowerCase()).then(() => {
                this.insertNewContact({
                    type: 'contact',
                    name: this.sendForm.value['alias'],
                    account: this.sendForm.value.to.toLowerCase(),
                    memo: this.sendForm.value.memo
                }, false);
                this.addDividers();
                this.storeContacts();
            }).catch((err) => {
                if (typeof err === 'object') {
                    if (err.json) {
                        alert("Error: " + err.json.error.details[0].message);
                    }
                    else {
                        alert("Error: " + err.error.details[0].message);
                    }
                }
                else {
                    if (err.json) {
                        alert("Error: " + JSON.parse(err).json.error.details[0].message);
                    }
                    else {
                        alert("Error: " + JSON.parse(err).error.details[0].message);
                    }
                }
            });
        }
        catch (e) {
            alert('invalid account name!');
            console.log(e);
        }
    }
    sortContacts() {
        this.contacts.sort((a, b) => {
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });
        this.searchForm.patchValue({
            search: ''
        });
    }
    selectContact(contact) {
        this.contactExist = true;
        this.sendForm.patchValue({
            to: contact.account,
            alias: contact.name,
            memo: contact.default_memo === undefined ? '' : contact.default_memo
        });
        this.checkExchangeAccount();
    }
    storeContacts() {
        localStorage.setItem('simpleos.contacts.' + this.aService.activeChain['id'], JSON.stringify(this.contacts));
    }
    loadContacts() {
        const contacts = localStorage.getItem('simpleos.contacts.' + this.aService.activeChain['id']);
        if (contacts) {
            this.contacts = JSON.parse(contacts);
        }
        this.addAccountsAsContacts();
    }
    newTransfer() {
        return __awaiter(this, void 0, void 0, function* () {
            const to = this.sendForm.get('to').value.toLowerCase();
            let actionsModal;
            const result = yield this.trxFactory.transact((auth) => __awaiter(this, void 0, void 0, function* () {
                const selAcc = this.aService.selected.getValue();
                const from = selAcc.name;
                const amount = parseFloat(this.sendForm.get('amount').value);
                const memo = this.sendForm.get('memo').value;
                let contract = 'eosio.token';
                let termsHeader = '';
                let termsHtml = '';
                const tk_name = this.sendForm.get('token').value;
                let precision = this.aService.activeChain['precision'];
                if (tk_name !== this.aService.activeChain['symbol']) {
                    const idx = this.aService.tokens.findIndex((val) => {
                        return val.name === tk_name;
                    });
                    contract = this.aService.tokens[idx].contract;
                    precision = this.aService.tokens[idx].precision;
                }
                const actionTitle = `<span class="blue">Transfer</span>`;
                const messageHTML = `
                <h5 class="modal-title"><span class="highlight-primary">${from}</span> sends <span
                class="blue">${amount.toFixed(precision) + ' ' + tk_name}</span> to <span class="highlight-primary">${to}</span></h5> 	
		    `;
                if (this.sendForm.value.token === 'EOS' && this.aService.activeChain.name === 'EOS MAINNET') {
                    termsHeader = 'By submiting this transaction, you agree to the EOS Transfer Terms & Conditions';
                    termsHtml = `I, ${from}, certify the following to be true to the best of my knowledge:<br><br>
            &#9; 1. I certify that ${amount.toFixed(precision) + ' ' + tk_name} is not the proceeds of fraudulent or
            violent activities.<br>
            2. I certify that, to the best of my knowledge, ${to} is not supporting initiation of violence against others.<br>
            3. I have disclosed any contractual terms & conditions with respect to ${amount.toFixed(precision) + ' ' + tk_name} to ${to}.<br>
            4. I understand that funds transfers are not reversible after the seconds or other delay as configured by ${from}'s permissions.<br>
            <br><br>
            If this action fails to be irreversibly confirmed after receiving goods or services from '${to}', 
            I agree to either return the goods or services or resend ${amount.toFixed(precision) + ' ' + tk_name} in a timely manner.`;
                }
                this.insertNewContact({
                    type: 'contact',
                    name: this.sendForm.value['alias'],
                    account: this.sendForm.value.to.toLowerCase()
                }, true);
                this.addDividers();
                this.storeContacts();
                actionsModal = [{
                        account: contract,
                        name: 'transfer',
                        authorization: [auth],
                        data: {
                            'from': from,
                            'to': to,
                            'quantity': amount.toFixed(precision) + ' ' + tk_name,
                            'memo': memo
                        }
                    }];
                return {
                    transactionPayload: {
                        actions: actionsModal
                    },
                    actionTitle: actionTitle,
                    labelHTML: messageHTML,
                    termsHeader: termsHeader,
                    termsHTML: termsHtml,
                    tk_name: tk_name
                };
            }));
            try {
                const jsonStatus = JSON.parse(result.status);
                if (jsonStatus.error.code === 3080004) {
                    const valueSTR = jsonStatus.error.details[0].message.split('us)');
                    const cpu = parseInt(valueSTR[0].replace(/[^0-9\.]+/g, ""));
                    yield this.resource.checkResource(result.auth, actionsModal, cpu);
                }
                if (jsonStatus.error.code === 3080002) {
                    const valueSTR = jsonStatus.error.details[0].message.split('>');
                    const net = parseInt(valueSTR[0].replace(/[^0-9\.]+/g, ""));
                    yield this.resource.checkResource(result.auth, actionsModal, undefined, net);
                }
            }
            catch (e) {
                if (result.status === 'done') {
                    try {
                        yield this.aService.refreshFromChain(false, [to]);
                        const sel = this.aService.selected.getValue();
                        const newBalance = sel.full_balance - sel.staked - sel.unstaking;
                        if (newBalance !== this.unstaked) {
                            this.unstaked = newBalance;
                            this.updateToken();
                        }
                        else {
                            let attempts = 0;
                            let loop = setInterval(() => {
                                attempts++;
                                this.aService.refreshFromChain(false, [to]).then(() => {
                                    const sel = this.aService.selected.getValue();
                                    const newBalance = sel.full_balance - sel.staked - sel.unstaking;
                                    if (newBalance !== this.unstaked) {
                                        this.unstaked = newBalance;
                                        this.updateToken();
                                        if (loop) {
                                            clearInterval(loop);
                                            loop = null;
                                        }
                                    }
                                });
                                if (attempts > 20) {
                                    if (loop) {
                                        clearInterval(loop);
                                    }
                                }
                            }, 1800);
                        }
                    }
                    catch (e) {
                        console.error(e);
                    }
                }
                else {
                    console.log(result);
                }
            }
        });
    }
    updateToken() {
        const symbol = this.sendForm.get('token').value;
        const token = this.aService.tokens.find(tk => tk.name === symbol.toUpperCase());
        if (token) {
            this.selectedToken = token;
            this.token_balance = this.selectedToken.balance;
        }
        else {
            this.selectedToken = { name: this.aService.activeChain['symbol'], price: 1.0000 };
            this.token_balance = this.unstaked;
        }
        this.cdr.detectChanges();
    }
    openEditContactModal(contact) {
        console.log(contact);
        this.contactForm.patchValue({
            account: contact.account,
            name: contact.name,
            memo: contact.default_memo === undefined ? '' : contact.default_memo
        });
        this.editContactModal = true;
        this.selectedEditContact = contact;
        this.checkExchangeAccountModal();
    }
    doEditContact() {
        const index = this.contacts.findIndex((el) => {
            return el.account === this.selectedEditContact.account;
        });
        this.contacts[index].name = this.contactForm.get('name').value;
        this.contacts[index].default_memo = this.contactForm.get('memo').value;
        this.editContactModal = false;
        this.selectedEditContact = null;
        this.contactForm.reset();
        this.addDividers();
        this.storeContacts();
    }
    openDeleteContactModal(contact) {
        this.deleteContactModal = true;
        this.selectedDeleteContact = contact;
    }
    doDeleteContact() {
        const index = this.contacts.findIndex((el) => {
            return el.account === this.selectedDeleteContact.account;
        });
        this.contacts.splice(index, 1);
        this.deleteContactModal = false;
        this.addDividers();
        this.storeContacts();
    }
    formatTokenSymbol() {
        this.sendForm.get('token').setValue(this.sendForm.get('token').value.toUpperCase());
    }
};
SendComponent = __decorate([
    (0, core_1.Component)({
        selector: 'app-send',
        templateUrl: './send.component.html',
        styleUrls: ['./send.component.css'],
    }),
    __metadata("design:paramtypes", [forms_1.FormBuilder,
        accounts_service_1.AccountsService,
        eosjs2_service_1.Eosjs2Service,
        crypto_service_1.CryptoService,
        core_1.ChangeDetectorRef,
        ledger_service_1.LedgerService,
        network_service_1.NetworkService,
        transaction_factory_service_1.TransactionFactoryService,
        resource_service_1.ResourceService])
], SendComponent);
exports.SendComponent = SendComponent;
//# sourceMappingURL=send.component.js.map