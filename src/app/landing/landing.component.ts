import {Component, NgZone, OnInit, ViewChild} from '@angular/core';
import {EOSJSService} from '../eosjs.service';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {AccountsService} from '../accounts.service';
import {Router} from '@angular/router';
import {ClrWizard} from '@clr/angular';
import {NetworkService} from '../network.service';
import {CryptoService} from '../services/crypto.service';
import {BodyOutputType, Toast, ToasterConfig, ToasterService} from 'angular2-toaster';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css']
})
export class LandingComponent implements OnInit {

  @ViewChild('wizardexists') exisitswizard: ClrWizard;
  @ViewChild('wizardnew') wizardnew: ClrWizard;
  @ViewChild('wizardexodus') wizard: ClrWizard;
  lottieConfig: Object;
  anim: any;
  busy: boolean;
  existingWallet: boolean;
  exodusWallet: boolean;
  newWallet: boolean;
  accountname = '';
  accountname_err = '';
  accountname_valid = false;
  ownerpk = '';
  ownerpub = '';
  activepk = '';
  activepub = '';
  newAccountPayload = '';
  agreeKeys = false;
  check: boolean;
  publicEOS: string;
  checkerr: string;
  errormsg: string;
  accounts: any[];
  dropReady: boolean;
  passmatch: boolean;
  passexodusmatch: boolean;
  agree: boolean;
  agree2: boolean;
  generating = false;
  passform: FormGroup;
  passformexodus: FormGroup;
  pvtform: FormGroup;
  pk: string;
  publickey: string;
  pin: string;
  pinexodus: string;
  lockscreen: boolean;
  lockscreen2: boolean;
  importedAccounts: any[];
  exodusValid = false;
  endpoint = 'http://br.eosrio.io:8080';
  payloadValid = false;
  generated = false;
  config: ToasterConfig;

  static parseEOS(tk_string) {
    if (tk_string.split(' ')[1] === 'EOS') {
      return parseFloat(tk_string.split(' ')[0]);
    } else {
      return 0;
    }
  }

  constructor(public eos: EOSJSService,
              private crypto: CryptoService,
              private fb: FormBuilder,
              private aService: AccountsService,
              private toaster: ToasterService,
              public network: NetworkService,
              private router: Router,
              private zone: NgZone) {
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
    this.accounts = [];
    this.importedAccounts = [];
    this.checkerr = '';
    this.errormsg = '';
    this.lottieConfig = {
      path: 'assets/logoanim.json',
      autoplay: true,
      loop: false
    };

    this.network.networkingReady.asObservable().subscribe((status) => {
      this.busy = !status;
    });

    this.publicEOS = '';

    this.passform = this.fb.group({
      matchingPassword: this.fb.group({
        pass1: ['', [Validators.required, Validators.minLength(10)]],
        pass2: ['', [Validators.required, Validators.minLength(10)]]
      })
    });
    this.pvtform = this.fb.group({
      private_key: ['', Validators.required]
    });
    this.passformexodus = this.fb.group({
      matchingPassword: this.fb.group({
        pass1: ['', [Validators.required, Validators.minLength(10)]],
        pass2: ['', [Validators.required, Validators.minLength(10)]]
      })
    });
  }

  cc(text) {
    this.showToast('success', 'Key copied to clipboard!', 'Please save it on a safe place.');
    window['clipboard']['writeText'](text);
  }

  resetAndClose() {
    this.wizardnew.reset();
    this.wizardnew.close();
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

  ngOnInit() {
    setTimeout(() => {
      this.anim.pause();
    }, 10);

    setTimeout(() => {
      this.anim.play();
    }, 900);
  }

  setPin(exodus) {
    setTimeout(() => {
      if (exodus) {
        this.crypto.createPIN(this.pinexodus);
      } else {
        this.crypto.createPIN(this.pin);
      }
    }, 4000);
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
              this.accountname_err = '';
              if (next) {
                this.wizardnew.next();
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
        }
      }
    } catch (e) {
      this.accountname_err = e.message;
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

  makePayload() {
    if (this.eos.ecc['isValidPublic'](this.ownerpub) && this.eos.ecc['isValidPublic'](this.activepub)) {
      console.log('Generating account payload');
      this.newAccountPayload = btoa(JSON.stringify({
        n: this.accountname,
        o: this.ownerpub,
        a: this.activepub,
        t: new Date().getTime()
      }));
      this.payloadValid = true;
    } else {
      alert('Invalid public key!');
      this.newAccountPayload = 'Invalid public key! Please go back and fix it!';
      this.payloadValid = false;
      this.wizardnew.navService.previous();
    }
  }

  retryConn() {
    this.network.connect();
  }

  customConnect() {
    this.network.startup(this.endpoint);
  }

  importFromExodus() {
    this.wizard.reset();
    this.exodusValid = false;
    this.exodusWallet = true;
    this.dropReady = true;
    this.errormsg = '';
    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.dropReady === true) {
        for (const f of e.dataTransfer.files) {
          const path = f['path'];
          this.dropReady = false;
          this.exodusValid = false;
          window['filesystem']['readFile'](path, 'utf-8', (err, data) => {
            if (!err) {
              const csvdata = data.split(',');
              this.pk = csvdata[csvdata.length - 1];
              this.pk = this.pk.trim();
              document.removeEventListener('drop', handleDrop, true);
              document.removeEventListener('dragover', handleDragOver, true);
              this.verifyPrivateKey(this.pk, true, path);
            }
          });
        }
      }
    };
    document.addEventListener('drop', handleDrop);
    document.addEventListener('dragover', handleDragOver);
  }

  handleAnimation(anim: any) {
    this.anim = anim;
    this.anim['setSpeed'](0.8);
  }

  passCompare() {
    if (this.passform.value.matchingPassword.pass1 && this.passform.value.matchingPassword.pass2) {
      if (this.passform.value.matchingPassword.pass1 === this.passform.value.matchingPassword.pass2) {
        this.passform['controls'].matchingPassword['controls']['pass2'].setErrors(null);
        this.passmatch = true;
      } else {
        this.passform['controls'].matchingPassword['controls']['pass2'].setErrors({'incorrect': true});
        this.passmatch = false;
      }
    }
  }

  passExodusCompare() {
    if (this.passformexodus.value.matchingPassword.pass1 && this.passformexodus.value.matchingPassword.pass2) {
      if (this.passformexodus.value.matchingPassword.pass1 === this.passformexodus.value.matchingPassword.pass2) {
        this.passformexodus['controls'].matchingPassword['controls']['pass2'].setErrors(null);
        this.passexodusmatch = true;
      } else {
        this.passformexodus['controls'].matchingPassword['controls']['pass2'].setErrors({'incorrect': true});
        this.passexodusmatch = false;
      }
    }
  }

  importCredentials() {
    if (this.passform.value.matchingPassword.pass1 === this.passform.value.matchingPassword.pass2) {
      this.crypto.initKeys(this.publicEOS, this.passform.value.matchingPassword.pass1).then(() => {
        this.crypto.encryptAndStore(this.pvtform.value.private_key, this.publicEOS).then(() => {
          this.aService.importAccounts(this.importedAccounts);
          this.crypto.decryptKeys(this.publicEOS).then(() => {
            this.router.navigate(['dashboard', 'wallet']).catch((err) => {
              console.log(err);
            });
            if (this.lockscreen) {
              this.setPin(false);
            }
          }).catch((error) => {
            console.log('Error', error);
          });
        }).catch((err) => {
          console.log(err);
        });
      });
    }
  }

  importCredentialsExodus() {
    if (this.passformexodus.value.matchingPassword.pass1 === this.passformexodus.value.matchingPassword.pass2) {
      this.crypto.initKeys(this.publicEOS, this.passformexodus.value.matchingPassword.pass1).then(() => {
        this.crypto.encryptAndStore(this.pk, this.publicEOS).then(() => {
          this.aService.importAccounts(this.importedAccounts);
          this.crypto.decryptKeys(this.publicEOS).then(() => {
            this.router.navigate(['dashboard', 'wallet']).catch((err) => {
              console.log(err);
            });
            if (this.lockscreen2) {
              this.setPin(true);
            }
          }).catch((error) => {
            console.log('Error', error);
          });
        }).catch((err) => {
          console.log(err);
        });
      });
    }
  }

  verifyPrivateKey(input, exodus, path) {
    if (input !== '') {
      this.eos.checkPvtKey(input).then((results) => {
        this.publicEOS = results.publicKey;
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
          if (exodus) {
            this.exodusValid = true;
            this.dropReady = false;
            window['filesystem']['unlink'](path, (err2) => {
              if (err2) {
                console.log(err2);
              }
            });
          } else {
            this.exisitswizard.forceNext();
          }
          this.errormsg = '';
        });
      }).catch((e) => {
        this.zone.run(() => {
          this.dropReady = true;
          this.exodusValid = false;
          this.pvtform.controls['private_key'].setErrors({'incorrect': true});
          this.importedAccounts = [];
          if (e.message.includes('Invalid checksum')) {
            this.errormsg = 'invalid private key';
          }
          if (e.message === 'no_account') {
            this.errormsg = 'No account associated with this private key';
          }
        });
      });
    }
  }

  doCancel(): void {
    this.exisitswizard.close();
  }

  checkAccount() {
    if (this.eos.ready) {
      this.check = true;
      this.accounts = [];
      this.eos.loadPublicKey(this.publicEOS).then((account_data: any) => {
        account_data.foundAccounts.forEach((acc) => {
          let balance = 0;
          // Parse tokens and calsulate balance
          acc['tokens'].forEach((tk) => {
            balance += LandingComponent.parseEOS(tk);
          });
          // Add stake balance
          balance += LandingComponent.parseEOS(acc['total_resources']['cpu_weight']);
          balance += LandingComponent.parseEOS(acc['total_resources']['net_weight']);
          const accData = {
            name: acc['account_name'],
            full_balance: Math.round((balance) * 10000) / 10000
          };
          this.accounts.push(accData);
        });
        this.checkerr = '';
      }).catch((err) => {
        console.log(err);
        this.checkerr = err;
      });
    }
  }

}
