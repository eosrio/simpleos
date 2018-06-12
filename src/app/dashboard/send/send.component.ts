import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {AccountsService} from '../../accounts.service';
import {EOSJSService} from '../../eosjs.service';
import {Observable} from 'rxjs';
import {map, startWith} from 'rxjs/operators';
import {createNumberMask} from 'text-mask-addons/dist/textMaskAddons';
import {BodyOutputType, Toast, ToasterConfig, ToasterService} from 'angular2-toaster';

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

  constructor(private fb: FormBuilder, public aService: AccountsService, public eos: EOSJSService,
              private toaster: ToasterService) {
    this.sendModal = false;
    this.newContactModal = false;
    this.contactExist = true;
    this.busy = false;
    this.sendForm = this.fb.group({
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
    this.aService.selected.asObservable().subscribe((sel) => {
      if (sel) {
        this.fullBalance = sel.full_balance;
        this.staked = sel.staked;
        this.unstaked = sel.full_balance - sel.staked;
      }
    });
    this.aService.initFirst();
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
      amount: this.unstaked
    });
  }

  checkAmount() {
    if (parseInt(this.sendForm.value.amount, 10) > this.unstaked) {
      this.sendForm.controls['amount'].setErrors({'incorrect': true});
      this.amounterror = 'invalid amount';
    } else {
      this.sendForm.controls['amount'].setErrors(null);
      this.amounterror = '';
    }
  }

  checkAccountName() {
    if (this.sendForm.value.to !== '') {
      try {
        this.eos.checkAccountName(this.sendForm.value.to.toLowerCase());
        this.sendForm.controls['to'].setErrors(null);
        this.errormsg = '';
        this.eos.getAccountInfo(this.sendForm.value.to.toLowerCase()).then(data => {
          this.sendForm.controls['to'].setErrors(null);
          this.errormsg = '';
        }).catch((error) => {
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
        this.eos.getAccountInfo(this.contactForm.value.account.toLowerCase()).then(data => {
          this.contactForm.controls['account'].setErrors(null);
          this.adderrormsg = '';
        }).catch((error) => {
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
      this.eos.getAccountInfo(this.contactForm.value.account.toLowerCase()).then(data => {
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
      this.eos.getAccountInfo(this.sendForm.value.to.toLowerCase()).then(data => {
        this.insertNewContact({
          type: 'contact',
          name: this.sendForm.value.alias,
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

  transfer() {
    this.busy = true;
    const from = this.aService.selected.getValue().name;
    const to = this.sendForm.get('to').value.toLowerCase();
    const amount = this.sendForm.get('amount').value;
    const memo = this.sendForm.get('memo').value;
    if (amount > 0 && this.sendForm.valid) {
      this.eos.authenticate(this.confirmForm.get('pass').value, from).then((res) => {
        this.eos.transfer(from, to, amount + ' EOS', memo).then((result) => {
          this.aService.refreshFromChain();
          if (result === true) {
            this.wrongpass = '';
            this.sendModal = false;
            this.busy = false;
            this.showToast('success', 'Transation broadcasted', 'Check your history for confirmation.');
            this.confirmForm.reset();
            this.sendForm.setValue({
                to: '',
                amount: '',
                memo: '',
                add: false,
                alias: '',
            });
            if (this.add === true && this.sendForm.get('alias').value !== '') {
              this.addContactOnSend();
            }
          } else {
            this.wrongpass = JSON.parse(result).error.details[0].message;
            this.busy = false;
          }
        }).catch((error) => {
          console.dir(error);
          this.busy = false;
        });
      }).catch(() => {
        this.busy = false;
        this.wrongpass = 'Wrong password!';
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
