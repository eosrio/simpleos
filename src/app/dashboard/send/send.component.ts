import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {AccountsService} from '../../accounts.service';
import {EOSJSService} from '../../eosjs.service';
import {Observable} from 'rxjs';
import {map, startWith} from 'rxjs/operators';
import {createNumberMask} from 'text-mask-addons/dist/textMaskAddons';
import {BodyOutputType, Toast, ToasterConfig, ToasterService} from 'angular2-toaster';
import {CryptoService} from '../../services/crypto.service';
import {EOSAccount} from '../../interfaces/account';

import * as moment from 'moment';

@Component({
  selector: 'app-send',
  templateUrl: './send.component.html',
  styleUrls: ['./send.component.css'],
})
export class SendComponent implements OnInit {
  contacts: any[];
  sendForm: FormGroup;
  contactForm: FormGroup;
  searchForm: FormGroup;
  confirmForm: FormGroup;
  sendModal: boolean;
  newContactModal: boolean;
  accountvalid: boolean;
  busy: boolean;
  add: boolean;
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
  filteredContacts: Observable<string[]>;
  searchedContacts: Observable<string[]>;
  numberMask = createNumberMask({
    prefix: '',
    allowDecimal: true,
    includeThousandsSeparator: false,
    decimalLimit: 4,
  });
  config: ToasterConfig;
  fromAccount: string;
  token_balance = 0.0000;
  selectedToken = {
    name: 'EOS',
    price: 1.0000
  };

  constructor(private fb: FormBuilder,
              public aService: AccountsService,
              public eos: EOSJSService,
              private crypto: CryptoService,
              private toaster: ToasterService) {
    this.sendModal = false;
    this.newContactModal = false;
    this.contactExist = true;
    this.fromAccount = '';
    this.busy = false;
    this.sendForm = this.fb.group({
      token: ['EOS', Validators.required],
      to: ['', Validators.required],
      amount: ['', Validators.required],
      memo: [''],
      add: [false],
      alias: [''],
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
  }

  filter(val: string, indexed): string[] {
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

  ngOnInit() {
    this.aService.selected.asObservable().subscribe((sel: EOSAccount) => {
      if (sel) {
        this.fullBalance = sel.full_balance;
        this.staked = sel.staked;
        this.unstaked = sel.full_balance - sel.staked - sel.unstaking;
        this.unstaking = sel.unstaking;
        this.unstakeTime = moment.utc(sel.unstakeTime).add(72, 'hours').fromNow();
      }
    });
    this.sendForm.get('token').valueChanges.subscribe((symbol) => {
      this.sendForm.patchValue({
        amount: ''
      });
      if (symbol !== 'EOS') {
        const tk_idx = this.aService.tokens.findIndex((val) => {
          return val.name === symbol;
        });
        this.selectedToken = this.aService.tokens[tk_idx];
        this.token_balance = parseFloat(this.selectedToken['balance'].split(' ')[0]);
      } else {
        this.selectedToken = {name: 'EOS', price: 1.0000};
      }
    });
    this.filteredContacts = this.sendForm.get('to').valueChanges.pipe(startWith(''), map(value => this.filter(value, false)));
    this.searchedContacts = this.searchForm.get('search').valueChanges.pipe(startWith(''), map(value => this.filter(value, true)));
    this.addAccountsAsContacts();
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
    this.contactExist = found || value === '';
  }

  setMax() {
    this.sendForm.patchValue({
      amount: this.sendForm.get('token').value === 'EOS' ? this.unstaked : this.token_balance
    });
  }

  checkAmount() {
    if (parseFloat(this.sendForm.value.amount) === 0 || this.sendForm.value.amount === '') {
      this.sendForm.controls['amount'].setErrors({'incorrect': true});
      this.amounterror = 'invalid amount';
    } else {
      const max = this.sendForm.get('token').value === 'EOS' ? this.unstaked : this.token_balance;
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
        this.sendForm.controls['to'].setErrors(null);
        this.errormsg = '';
        this.eos.getAccountInfo(this.sendForm.value.to.toLowerCase()).then(() => {
          this.sendForm.controls['to'].setErrors(null);
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

  addDividers() {
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
      }).catch((error) => {
        alert(JSON.parse(error.message).error.details[0].message);
      });
    } catch (e) {
      alert('invalid account name!');
      console.log(e);
    }
  }

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
      }).catch((error) => {
        alert(JSON.parse(error.message).error.details[0].message);
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
    localStorage.setItem('simpleos.contacts', JSON.stringify(this.contacts));
  }

  loadContacts() {
    const contacts = localStorage.getItem('simpleos.contacts');
    if (contacts) {
      this.contacts = JSON.parse(contacts);
    }
  }

  openSendModal() {
    this.confirmForm.reset();
    this.fromAccount = this.aService.selected.getValue().name;
    this.sendModal = true;
  }

  transfer() {
    this.busy = true;
    const selAcc = this.aService.selected.getValue();
    const from = selAcc.name;
    const to = this.sendForm.get('to').value.toLowerCase();
    const amount = this.sendForm.get('amount').value;
    const memo = this.sendForm.get('memo').value;
    console.log(selAcc.details['permissions']);
    const publicKey = selAcc.details['permissions'][0]['required_auth'].keys[0].key;
    if (amount > 0 && this.sendForm.valid) {
      this.crypto.authenticate(this.confirmForm.get('pass').value, publicKey).then((res) => {
        if (res === true) {
          let contract = 'eosio.token';
          const tk_name = this.sendForm.get('token').value;
          if (tk_name !== 'EOS') {
            const idx = this.aService.tokens.findIndex((val) => {
              return val.name === tk_name;
            });
            contract = this.aService.tokens[idx].contract;
          }
          console.log(contract, from, to, parseFloat(amount).toFixed(4) + ' ' + tk_name, memo);
          this.eos.transfer(contract, from, to, parseFloat(amount).toFixed(4) + ' ' + tk_name, memo).then((result) => {
            if (result === true) {
              this.wrongpass = '';
              this.sendModal = false;
              this.busy = false;
              this.showToast('success', 'Transation broadcasted', 'Check your history for confirmation.');
              this.aService.refreshFromChain();
              setTimeout(() => {
                const sel = this.aService.selected.getValue();
                this.unstaked = sel.full_balance - sel.staked - sel.unstaking;
              }, 2000);

              this.confirmForm.reset();
              if (this.add === true && this.sendForm.get('alias').value !== '') {
                this.addContactOnSend();
              }
            } else {
              this.wrongpass = JSON.parse(result).error.details[0].message;
              this.busy = false;
            }
          }).catch((error) => {
            console.log('Catch2', error);
            if (error.error.code === 3081001) {
              this.wrongpass = 'Not enough stake to perform this action.';
            } else {
              this.wrongpass = error.error['what'];
            }
            this.busy = false;
          });
        } else {
          this.busy = false;
          this.wrongpass = 'Wrong password!';
        }
      }).catch(() => {
        this.busy = false;
        this.wrongpass = 'Error: Wrong password!';
      });
    }
  }

  private showToast(type: string, title: string, body: string) {
    this.config = new ToasterConfig({
      positionClass: 'toast-top-right',
      timeout: 10000,
      newestOnTop: true,
      tapToDismiss: true,
      preventDuplicates: false,
      animation: 'slideDown',
      limit: 1,
    });
    const toast: Toast = {
      type: type,
      title: title,
      body: body,
      timeout: 10000,
      showCloseButton: true,
      bodyOutputType: BodyOutputType.TrustedHtml,
    };
    this.toaster.popAsync(toast);
  }

}
