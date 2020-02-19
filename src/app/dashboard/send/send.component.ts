import {ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {AccountsService} from '../../services/accounts.service';
import {EOSJSService} from '../../services/eosio/eosjs.service';
import {Observable} from 'rxjs';
import {map, startWith} from 'rxjs/operators';
import {createNumberMask} from 'text-mask-addons/dist/textMaskAddons';
import {ToasterConfig, ToasterService} from 'angular2-toaster';
import {CryptoService} from '../../services/crypto/crypto.service';
import {EOSAccount} from '../../interfaces/account';
import {LedgerService} from "../../services/ledger/ledger.service";
import {NetworkService} from "../../services/network.service";

import * as moment from 'moment';
import {TransactionFactoryService} from "../../services/eosio/transaction-factory.service";


export interface Contact {
    name: string;
    type: string;
    account?: string;
    default_memo?: string;
}

@Component({
    selector: 'app-send',
    templateUrl: './send.component.html',
    styleUrls: ['./send.component.css'],
})
export class SendComponent implements OnInit {
    contacts: Contact[];
    sendForm: FormGroup;
    contactForm: FormGroup;
    searchForm: FormGroup;
    confirmForm: FormGroup;
    sendModal: boolean;
    newContactModal: boolean;
    editContactModal: boolean;
    deleteContactModal: boolean;
    accountvalid: boolean;
    busy: boolean;
    add: boolean;
    precision: string;
    errormsg: string;
    adderrormsg: string;
    amounterror: string;
    wrongpass: string;
    fullBalance: number;
    staked: number;
    unstaked: number;
    unstaking: number;
    unstakeTime: string;
    contactExist: boolean;
    search: string;
    filteredContacts: Observable<Contact[]>;
    searchedContacts: Observable<Contact[]>;
    numberMask = createNumberMask({
        prefix: '',
        allowDecimal: true,
        includeThousandsSeparator: false,
        decimalLimit: 4,
    });
    config: ToasterConfig;
    fromAccount: string;
    token_balance = 0.0000;
    selectedToken = {};
    selectedEditContact = null;
    selectedDeleteContact = null;

    mode: string;

    knownExchanges = [
        'bitfinexdep1', 'krakenkraken', 'chainceoneos',
        'huobideposit', 'zbeoscharge1', 'okbtothemoon',
        'gateiowallet', 'eosusrwallet', 'binancecleos',
        'novadaxstore', 'floweosaccnt', 'coinwwallet1'];
    memoMsg = 'optional';

    constructor(private fb: FormBuilder,
                public aService: AccountsService,
                public eos: EOSJSService,
                private crypto: CryptoService,
                private toaster: ToasterService,
                private cdr: ChangeDetectorRef,
                private ledger: LedgerService,
                private network: NetworkService,
                private trxFactory: TransactionFactoryService,
    ) {
        this.sendModal = false;
        this.newContactModal = false;
        this.contactExist = true;
        this.fromAccount = '';
        this.busy = false;

        //-----------------------------
        // CHANGE BACK AMOUNT REQUIRED
        //-----------------------------

        this.sendForm = this.fb.group({
            token: [aService.activeChain['symbol'], Validators.required],
            to: ['', Validators.required],
            amount: [''],
            memo: [''],
            add: [false],
            alias: [''],
        });

        this.numberMask = createNumberMask({
            prefix: '',
            allowDecimal: true,
            includeThousandsSeparator: false,
            decimalLimit: this.aService.activeChain.precision,
        });

        this.contactForm = this.fb.group({
            account: ['', Validators.required],
            name: ['', Validators.required],
        });
        this.searchForm = this.fb.group({
            search: ['']
        });
        this.confirmForm = this.fb.group({
            pass: ['', [Validators.required, Validators.minLength(10)]]
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

    filter(val: string, indexed): Contact[] {
        return this.contacts.filter(contact => {
            if (contact.type === 'contact') {
                return contact.name.toLowerCase().includes(val.toLowerCase()) || contact.account.toLowerCase().includes(val.toLowerCase());
            } else {
                if (indexed) {
                    return contact.type === 'letter';
                } else {
                    return false;
                }
            }
        });
    }

    checkExchangeAccount() {
        const memo = this.sendForm.get('memo');
        const acc = this.sendForm.value.to.toLowerCase();
        const exchanges = this.aService.activeChain['exchanges'];
        if (this.knownExchanges.includes(acc)) {
            console.log(exchanges[acc].pattern.toString());
            if (exchanges[acc]) {
                if (exchanges[acc].memo_size) {
                    const memo_size = parseInt(exchanges[acc].memo_size, 10);
                    memo.setValidators([
                        Validators.required,
                        Validators.pattern(exchanges[acc].pattern),
                        Validators.minLength(memo_size),
                        Validators.maxLength(memo_size)
                    ]);
                } else {
                    memo.setValidators([
                        Validators.required,
                        Validators.pattern(exchanges[acc].pattern)
                    ]);
                    console.log('only pattern');
                }
            } else {
                memo.setValidators([Validators.required]);
            }
            this.memoMsg = 'required';
            memo.updateValueAndValidity();
            console.log(memo);
        } else {
            this.memoMsg = 'optional';
            memo.setValidators(null);
            memo.updateValueAndValidity();
        }
    }

    ngOnInit() {
        this.aService.selected.asObservable().subscribe((sel: EOSAccount) => {
            if (sel) {
                this.fullBalance = sel.full_balance;
                this.staked = sel.staked;
                this.unstaked = sel.full_balance - sel.staked - sel.unstaking;
                this.unstaking = sel.unstaking;
                this.unstakeTime = moment.utc(sel.unstakeTime).add(72, 'hours').fromNow();
                this.cdr.detectChanges();
            }
        });
        this.sendForm.get('token').valueChanges.subscribe((symbol) => {
            this.sendForm.patchValue({
                amount: ''
            });
            console.log('this.selectedToken', symbol);
            if (symbol !== this.aService.activeChain['symbol']) {
                const tk_idx = this.aService.tokens.findIndex((val) => {
                    return val.name === symbol;
                });
                if (tk_idx !== undefined) {
                    this.selectedToken = this.aService.tokens[tk_idx];
                    this.token_balance = this.selectedToken['balance'];
                }
            } else {
                this.selectedToken = {name: this.aService.activeChain['symbol'], price: 1.0000};
            }
        });
        this.precision = '1.' + this.aService.activeChain['precision'];
        this.filteredContacts = this.sendForm.get('to').valueChanges.pipe(startWith(''), map(value => this.filter(value, false)));
        this.searchedContacts = this.searchForm.get('search').valueChanges.pipe(startWith(''), map(value => this.filter(value, true)));
        this.onChanges();
    }

    onChanges(): void {
        this.sendForm.get('add').valueChanges.subscribe(val => {
            this.add = val;
        });
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
            this.sendForm.controls['amount'].setErrors({'incorrect': true});
            this.amounterror = 'invalid amount';
        } else {
            const max = this.sendForm.get('token').value === this.aService.activeChain['symbol'] ? this.unstaked : this.token_balance;
            if (parseFloat(this.sendForm.value.amount) > max) {
                this.sendForm.controls['amount'].setErrors({'incorrect': true});
                this.amounterror = 'invalid amount';
            } else {
                this.sendForm.controls['amount'].setErrors(null);
                this.amounterror = '';
            }
        }
    }

    checkAccountName() {
        if (this.sendForm.value.to !== '') {
            try {
                this.eos.checkAccountName(this.sendForm.value.to.toLowerCase());
                // this.sendForm.controls[ 'to' ].setErrors ( null );
                // this.errormsg = '';
                console.log(this.sendForm.value.to.toLowerCase());
                this.eos.getAccountInfo(this.sendForm.value.to.toLowerCase()).then(() => {
                    this.sendForm.controls['to'].setErrors(null);
                    this.checkExchangeAccount();
                    this.errormsg = '';
                }).catch(() => {
                    this.sendForm.controls['to'].setErrors({'incorrect': true});
                    this.errormsg = 'account does not exist';
                });
            } catch (e) {
                this.sendForm.controls['to'].setErrors({'incorrect': true});
                this.errormsg = e.message;
            }
        } else {
            this.errormsg = '';
        }
    }

    checkAccountModal() {
        if (this.contactForm.value.account !== '') {
            try {
                this.eos.checkAccountName(this.contactForm.value.account.toLowerCase());
                this.contactForm.controls['account'].setErrors(null);
                this.adderrormsg = '';
                this.eos.getAccountInfo(this.contactForm.value.account.toLowerCase()).then(() => {
                    this.contactForm.controls['account'].setErrors(null);
                    this.adderrormsg = '';
                }).catch(() => {
                    this.contactForm.controls['account'].setErrors({'incorrect': true});
                    this.adderrormsg = 'account does not exist';
                });
            } catch (e) {
                this.contactForm.controls['account'].setErrors({'incorrect': true});
                this.adderrormsg = e.message;
            }
        } else {
            this.adderrormsg = '';
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
        } else {
            if (!silent) {
                alert('duplicate entry');
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
                        this.contacts.push({
                            type: 'letter',
                            name: letter
                        });
                        this.contactForm.reset();
                        this.searchForm.patchValue({
                            search: ''
                        });
                    }
                }
            }
        });
        this.sortContacts();
    }

    addContact() {
        try {
            this.eos.checkAccountName(this.contactForm.value.account.toLowerCase());
            this.eos.getAccountInfo(this.contactForm.value.account.toLowerCase()).then(() => {
                this.insertNewContact({
                    type: 'contact',
                    name: this.contactForm.value.name,
                    account: this.contactForm.value.account.toLowerCase()
                }, false);
                this.newContactModal = false;
                this.addDividers();
                this.storeContacts();
            }).catch((err) => {
                if (typeof err === 'object') {
                    if (err.json) {
                        alert("Error: " + err.json.error.details[0].message);
                    } else {
                        alert("Error: " + err.error.details[0].message);
                    }
                } else {
                    if (err.json) {
                        alert("Error: " + JSON.parse(err).json.error.details[0].message);
                    } else {
                        alert("Error: " + JSON.parse(err).error.details[0].message);
                    }
                }
            });
        } catch (e) {
            alert('invalid account name!');
            console.log(e);
        }
    }

    // TODO: implementar
    addContactOnSend() {
        try {
            this.eos.checkAccountName(this.sendForm.value.to.toLowerCase());
            this.eos.getAccountInfo(this.sendForm.value.to.toLowerCase()).then(() => {
                this.insertNewContact({
                    type: 'contact',
                    name: this.sendForm.value['alias'],
                    account: this.sendForm.value.to.toLowerCase()
                }, false);
                this.addDividers();
                this.storeContacts();
            }).catch((err) => {
                if (typeof err === 'object') {
                    if (err.json) {
                        alert("Error: " + err.json.error.details[0].message);
                    } else {
                        alert("Error: " + err.error.details[0].message);
                    }
                } else {
                    if (err.json) {
                        alert("Error: " + JSON.parse(err).json.error.details[0].message);
                    } else {
                        alert("Error: " + JSON.parse(err).error.details[0].message);
                    }
                }
            });
        } catch (e) {
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
            alias: contact.name
        });
    }

    storeContacts() {
        localStorage.setItem('simpleos.contacts.' + this.aService.activeChain['id'], JSON.stringify(this.contacts));
    }

    loadContacts() {
        const contacts = localStorage.getItem('simpleos.contacts.' + this.aService.activeChain['id']);
        if (contacts) {
            this.contacts = JSON.parse(contacts);
        } else {
            this.addAccountsAsContacts();
        }
    }

    async newTransfer() {
        this.busy = true;
        this.wrongpass = '';
        const selAcc = this.aService.selected.getValue();
        const from = selAcc.name;
        const to = this.sendForm.get('to').value.toLowerCase();
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

        // Transaction Signature
        const [auth, publicKey] = this.trxFactory.getAuth();

        this.mode = this.crypto.getPrivateKeyMode(publicKey);

        const actionTitle = `<span class="blue">Transfer</span>`;
        const messageHTML = `
         <h5 class="modal-title text-white"><span class="blue">${from}</span> sends <span
            class="blue">${amount.toFixed(precision) + ' ' + tk_name}</span> to <span class="blue">${to}</span></h5> 	
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

        this.trxFactory.modalData.next({
            transactionPayload: {
                actions: [{
                    account: contract,
                    name: 'transfer',
                    authorization: [auth],
                    data: {
                        'from': from,
                        'to': to,
                        'quantity': amount.toFixed(precision) + ' ' + tk_name,
                        'memo': memo
                    }
                }]
            },
            signerAccount: auth.actor,
            signerPublicKey: publicKey,
            actionTitle: actionTitle,
            labelHTML: messageHTML,
            termsHeader: termsHeader,
            termsHTML: termsHtml
        });
        this.trxFactory.launcher.emit({visibility: true, mode: this.mode});
        const subs = this.trxFactory.status.subscribe(async (event) => {
            console.log(event);
            if (event === 'done') {
                try {
                    await this.aService.refreshFromChain(false, [to]);
                    const sel = this.aService.selected.getValue();
                    this.unstaked = sel.full_balance - sel.staked - sel.unstaking;
                } catch (e) {
                    console.error(e);
                }
                subs.unsubscribe();
            }
            if (event === 'modal_closed') {
                subs.unsubscribe();
            }
        });
    }

    openEditContactModal(contact) {
        console.log(contact);
        this.contactForm.patchValue({
            account: contact.account,
            name: contact.name
        });
        this.editContactModal = true;
        this.selectedEditContact = contact;
    }

    doEditContact() {
        const index = this.contacts.findIndex((el) => {
            return el.account === this.selectedEditContact.account;
        });
        this.contacts[index].name = this.contactForm.get('name').value;
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
}
