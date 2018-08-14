import {Component, OnInit, NgZone, ViewChild} from '@angular/core';
import {EOSJSService} from '../eosjs.service';
import {AccountsService} from '../accounts.service';
import {LandingComponent} from '../landing/landing.component';
import {ClrWizard} from '@clr/angular';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {BodyOutputType, Toast, ToasterConfig, ToasterService} from 'angular2-toaster';

import * as moment from 'moment';
import {CryptoService} from '../services/crypto.service';
import {RamService} from '../services/ram.service';
import {createNumberMask} from 'text-mask-addons/dist/textMaskAddons';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  @ViewChild('newAccountWizard') wizardaccount: ClrWizard;
  @ViewChild('importAccountWizard') importwizard: ClrWizard;
  lottieConfig: Object;
  anim: any;
  busy = false;

  accounts: any;
  importedAccount: any;
  appVersion: string;

  // New account
  passform: FormGroup;
  newAccountModal: boolean;
  importKeyModal: boolean;
  deleteAccModal: boolean;
  newAccountData = {
    t: 0,
    n: '',
    o: '',
    a: ''
  };
  payloadError = false;
  newAccountPayload = '';
  newAccOptions = 'thispk';
  accountname = '';
  accountname_valid = false;
  accountname_err = '';
  amounterror = '';
  passmatch = false;

  pvtform: FormGroup;
  passform2: FormGroup;
  passmatch2 = false;
  errormsg: string;
  importedAccounts: any[];

  ownerpk = '';
  ownerpub = '';
  activepk = '';
  activepub = '';
  agreeKeys = false;
  generating = false;
  generated = false;

  final_creator = '';
  final_active = '';
  final_owner = '';
  final_name = '';
  delegate_transfer = false;

  confirmationID = '';
  success = false;

  delegateForm: FormGroup;
  submitTXForm: FormGroup;
  wrongwalletpass = '';
  config: ToasterConfig;

  numberMask = createNumberMask({
    prefix: '',
    allowDecimal: true,
    includeThousandsSeparator: false,
    decimalLimit: 4,
  });

  intMask = createNumberMask({
    prefix: '',
    allowDecimal: false,
    includeThousandsSeparator: false
  });

  selectedAccRem = null;
  accRemovalIndex = null;
  selectedTab = '';
  importedPublicKey = '';

  constructor(
    public eos: EOSJSService,
    private fb: FormBuilder,
    public aService: AccountsService,
    private toaster: ToasterService,
    private crypto: CryptoService,
    public ram: RamService,
    private zone: NgZone
  ) {
    this.newAccountModal = false;
    this.importKeyModal = false;
    this.deleteAccModal = false;
    this.appVersion = window['appversion'];

    this.passform = this.fb.group({
      matchingPassword: this.fb.group({
        pass1: ['', [Validators.required, Validators.minLength(10)]],
        pass2: ['', [Validators.required, Validators.minLength(10)]]
      })
    });
    this.delegateForm = this.fb.group({
      delegate_amount: [1, [Validators.required, Validators.min(1)]],
      delegate_transfer: [false, Validators.required],
      ram_amount: [4096, [Validators.required, Validators.min(4096)]],
      gift_amount: [0],
    });
    this.submitTXForm = this.fb.group({
      pass: ['', [Validators.required, Validators.minLength(10)]]
    });
    this.pvtform = this.fb.group({
      private_key: ['', Validators.required]
    });
    this.passform2 = this.fb.group({
      matchingPassword: this.fb.group({
        pass1: ['', [Validators.required, Validators.minLength(10)]],
        pass2: ['', [Validators.required, Validators.minLength(10)]]
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

  openTXID() {
    window['shell']['openExternal']('https://www.bloks.io/transaction/' + this.confirmationID);
  }

  // verifyPrivateKey(input) {
  //   if (input !== '') {
  //     this.eos.checkPvtKey(input).then((results) => {
  //       this.importedAccount = results.foundAccounts[0];
  //     }).catch((e) => {
  //       this.importedAccount = null;
  //     });
  //   }
  // }

  verifyPrivateKey(input) {
    if (input !== '') {
      this.eos.checkPvtKey(input).then((results) => {
        this.importedPublicKey = results.publicKey;
        this.importedAccounts = [];
        this.importedAccounts = [...results.foundAccounts];
        this.importedAccounts.forEach((item) => {
          if (item['refund_request']) {
            const tempDate = item['refund_request']['request_time'] + '.000Z';
            const refundTime = new Date(tempDate).getTime() + (72 * 60 * 60 * 1000);
            const now = new Date().getTime();
            if (now > refundTime) {
              this.eos.claimRefunds(item.account_name, input).then((tx) => {
                console.log(tx);
              });
            } else {
              console.log('Refund not ready!');
            }
          }
        });
        this.pvtform.controls['private_key'].setErrors(null);
        this.zone.run(() => {
          this.importwizard.forceNext();
          this.errormsg = '';
        });
      }).catch((e) => {
        this.zone.run(() => {
          this.pvtform.controls['private_key'].setErrors({'incorrect': true});
          this.importedAccounts = [];
          if (e.message.includes('Invalid checksum')) {
            this.errormsg = 'invalid private key';
          }
          if (e.message === 'no_account') {
            this.errormsg = 'No account associated with this private key';
          }
          if (e.message === 'non_active') {
            this.errormsg = 'This is not the active key. Please import the active key.';
          }
        });
      });
    }
  }

  doCancel(): void {
    this.importwizard.close();
  }

  importAccounts() {
    if (this.passform2.value.matchingPassword.pass1 === this.passform2.value.matchingPassword.pass2) {
      this.crypto.initKeys(this.importedPublicKey, this.passform2.value.matchingPassword.pass1).then(() => {
        this.crypto.encryptAndStore(this.pvtform.value.private_key, this.importedPublicKey).then(() => {
          this.passform2.reset();
          this.importwizard.reset();
          this.pvtform.reset();
          this.aService.appendAccounts(this.importedAccounts);
        }).catch((err) => {
          console.log(err);
        });
      });
    }
  }

  openRemoveAccModal(index, account) {
    this.selectedAccRem = account;
    this.accRemovalIndex = index;
    this.deleteAccModal = true;
  }

  doRemoveAcc() {
    this.aService.accounts.splice(this.accRemovalIndex, 1);
    this.deleteAccModal = false;
    this.aService.select(0);
    this.selectedTab = '0';
  }

  resetAndClose() {
    this.wizardaccount.reset();
    this.wizardaccount.close();
  }

  loadLastPage() {
    if (this.newAccOptions === 'newpk') {
      this.final_active = this.activepub;
      this.final_owner = this.ownerpub;
    }
    if (this.newAccOptions === 'thispk') {
      const account = this.aService.selected.getValue();
      this.final_active = account.details['permissions'][0]['required_auth'].keys[0].key;
      this.final_owner = account.details['permissions'][1]['required_auth'].keys[0].key;
    }
  }

  executeTX() {
    this.busy = true;
    const delegate_amount = parseFloat(this.delegateForm.get('delegate_amount').value);
    const ram_amount = parseInt(this.delegateForm.get('ram_amount').value, 10);
    const gift_amount = parseFloat(this.delegateForm.get('gift_amount').value);
    const delegate_transfer = this.delegateForm.get('delegate_transfer').value;

    const account = this.aService.selected.getValue();
    this.final_creator = account.name;
    const publicKey = account.details['permissions'][0]['required_auth'].keys[0].key;
    this.crypto.authenticate(this.submitTXForm.get('pass').value, publicKey).then((data) => {
      if (data === true) {
        this.eos.createAccount(
          this.final_creator, this.final_name, this.final_owner,
          this.final_active, delegate_amount, ram_amount,
          delegate_transfer, gift_amount, 'created with simpleos').then((txdata) => {
          console.log(txdata);
          if (this.newAccOptions === 'newpk') {
            setTimeout(() => {
              this.eos.checkPvtKey(this.activepk).then((results) => {
                const pform = this.passform.value.matchingPassword;
                // Import private key
                if (pform.pass1 === pform.pass2) {
                  this.crypto.initKeys(this.final_active, pform.pass1).then(() => {
                    this.crypto.encryptAndStore(this.activepk, this.final_active).then(() => {
                      this.aService.appendNewAccount(results.foundAccounts[0]);
                      this.wrongwalletpass = '';
                      this.busy = false;
                      this.success = true;
                      this.confirmationID = txdata['transaction_id'];
                      this.showToast('success', 'Account created', 'Check your history for confirmation.');
                      this.submitTXForm.reset();
                      this.aService.refreshFromChain();
                    }).catch((err) => {
                      console.log(err);
                    });
                  });
                }
              });
            }, 5000);
          } else if (this.newAccOptions === 'friend') {
            this.wrongwalletpass = '';
            this.confirmationID = txdata['transaction_id'];
            this.success = true;
            this.busy = false;
            this.showToast('success', 'Account created', 'Check your history for confirmation. Please notify your friend.');
            this.submitTXForm.reset();
          } else if (this.newAccOptions === 'thispk') {
            setTimeout(() => {
              this.eos.getAccountInfo(this.final_name).then((acc_data) => {
                this.eos.getTokens(acc_data['account_name']).then((tokens) => {
                  acc_data['tokens'] = tokens;
                  this.aService.appendNewAccount(acc_data);
                  this.wrongwalletpass = '';
                  this.busy = false;
                  this.success = true;
                  this.confirmationID = txdata['transaction_id'];
                  this.showToast('success', 'Account created', 'Check your history for confirmation.');
                  this.submitTXForm.reset();
                }).catch((err) => {
                  console.log(err);
                });
              });
            }, 5000);
          }
        }).catch((err2) => {
          const errorJSON = JSON.parse(err2);
          if (errorJSON.error.code === 3081001) {
            this.wrongwalletpass = 'Not enough stake to perform this action.';
          } else if (errorJSON.error.code === 3050000) {
            this.wrongwalletpass = 'Account name not available.';
          } else {
            this.wrongwalletpass = errorJSON.error['what'];
          }
          this.busy = false;
          this.success = false;
        });
      } else {
        this.wrongwalletpass = 'Something went wrong!';
        this.busy = false;
        this.success = false;
      }
    }).catch(() => {
      this.busy = false;
      this.wrongwalletpass = 'Wrong password!';
      this.success = false;
    });
  }

  ngOnInit() {
    this.accounts = [];
    this.ram.reload();
    this.eos.status.asObservable().subscribe((status) => {
      if (status) {
        this.loadStoredAccounts();
      }
    });
  }

  decodeAccountPayload(payload: string) {
    if (payload !== '') {
      if (payload.endsWith('=')) {
        try {
          const accountObj = JSON.parse(atob(payload));
          accountObj.t = moment(accountObj.t);
          console.log(accountObj);
          this.newAccountData = accountObj;
          this.final_name = accountObj.n;
          this.final_active = accountObj.a;
          this.final_owner = accountObj.o;
          this.final_creator = this.aService.selected.getValue().name;
          this.payloadError = false;
        } catch (e) {
          this.payloadError = true;
        }
      } else {
        this.payloadError = true;
      }
    }
  }

  handleAnimation(anim: any) {
    this.anim = anim;
    this.anim['setSpeed'](0.8);
  }

  selectAccount(idx) {
    this.selectedTab = idx;
    this.aService.select(idx);
  }

  loadStoredAccounts() {
    const account_names = Object.keys(this.eos.accounts.getValue());
    if (account_names.length > 0) {
      account_names.forEach((name) => {
        const acc = this.eos.accounts.getValue()[name];
        let balance = 0;
        acc['tokens'].forEach((tk) => {
          balance += LandingComponent.parseEOS(tk);
        });
        const net = LandingComponent.parseEOS(acc['total_resources']['net_weight']);
        const cpu = LandingComponent.parseEOS(acc['total_resources']['cpu_weight']);
        balance += net;
        balance += cpu;
        const accData = {
          name: acc['account_name'],
          full_balance: Math.round((balance) * 10000) / 10000,
          staked: net + cpu,
          details: acc
        };
        this.accounts.push(accData);
        this.aService.accounts.push(accData);
      });
    }
    this.aService.initFirst();
  }

  cc(text) {
    this.showToast('success', 'Key copied to clipboard!', 'Please save it on a safe place.');
    window['clipboard']['writeText'](text);
  }

  verifyAccountName(next) {
    try {
      this.accountname_valid = false;
      const res = this.eos.checkAccountName(this.accountname);
      console.log(res);
      if (res !== 0) {
        if (this.accountname.length === 12) {
          this.eos.eos['getAccount'](this.accountname, (err, data) => {
            console.log(err, data);
            if (err) {
              this.accountname_valid = true;
              this.newAccountData.n = this.accountname;
              this.final_name = this.accountname;
              this.final_creator = this.aService.selected.getValue().name;
              this.accountname_err = '';
              if (next) {
                this.wizardaccount.next();
              }
            } else {
              if (data) {
                this.accountname_err = 'This account name is not available. Please try another.';
                this.accountname_valid = false;
              }
            }
          });
        } else {
          this.accountname_err = 'The account name must have exactly 12 characters. a-z, 1-5';
          this.accountname_valid = false;
        }
      }
    } catch (e) {
      this.accountname_err = e.message;
      this.accountname_valid = false;
    }
  }

  // checkAmount() {
  //     if (parseFloat(this.sendForm.value.amount) === 0 || this.sendForm.value.amount === '') {
  //         this.sendForm.controls['amount'].setErrors({'incorrect': true});
  //         this.amounterror = 'invalid amount';
  //     } else {
  //         const max = this.sendForm.get('token').value === 'EOS' ? this.unstaked : this.token_balance;
  //         if (parseFloat(this.sendForm.value.amount) > max) {
  //             this.sendForm.controls['amount'].setErrors({'incorrect': true});
  //             this.amounterror = 'invalid amount';
  //         } else {
  //             this.sendForm.controls['amount'].setErrors(null);
  //             this.amounterror = '';
  //         }
  //     }
  // }

  passCompare() {
    const pForm = this.passform.value.matchingPassword;
    if (pForm.pass1 && pForm.pass2) {
      if (pForm.pass1 === pForm.pass2) {
        this.passform['controls'].matchingPassword['controls']['pass2'].setErrors(null);
        this.passmatch = true;
      } else {
        this.passform['controls'].matchingPassword['controls']['pass2'].setErrors({'incorrect': true});
        this.passmatch = false;
      }
    }
  }

  importedPassCompare() {
    const pForm = this.passform2.value.matchingPassword;
    if (pForm.pass1 && pForm.pass2) {
      if (pForm.pass1 === pForm.pass2) {
        this.passform2['controls'].matchingPassword['controls']['pass2'].setErrors(null);
        this.passmatch2 = true;
      } else {
        this.passform2['controls'].matchingPassword['controls']['pass2'].setErrors({'incorrect': true});
        this.passmatch2 = false;
      }
    }
  }

  generateKeys() {
    this.generating = true;
    setTimeout(() => {
      this.eos.ecc.initialize().then(() => {
        this.eos.ecc['randomKey'](128).then((privateKey) => {
          this.ownerpk = privateKey;
          this.ownerpub = this.eos.ecc['privateToPublic'](this.ownerpk);
          console.log(this.ownerpk, this.ownerpub);
          this.eos.ecc['randomKey'](128).then((privateKey2) => {
            this.activepk = privateKey2;
            this.activepub = this.eos.ecc['privateToPublic'](this.activepk);
            this.generating = false;
            this.generated = true;
            console.log(this.activepk, this.activepub);
          });
        });
      });
    }, 100);
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
