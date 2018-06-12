import {Component, OnInit, ViewChild} from '@angular/core';
import {EOSJSService} from '../eosjs.service';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {AccountsService} from '../accounts.service';
import {Router} from '@angular/router';
import {ClrWizard} from '@clr/angular';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css']
})
export class LandingComponent implements OnInit {

  @ViewChild('wizardexodus') wizard: ClrWizard;
  lottieConfig: Object;
  anim: any;
  existingWallet: boolean;
  exodusWallet: boolean;
  newWallet: boolean;
  check: boolean;
  publicEOS: string;
  checkerr: string;
  errormsg: string;
  accounts: any[];
  pkValid: boolean;
  dropReady: boolean;
  passmatch: boolean;
  passexodusmatch: boolean;
  agree: boolean;
  agree2: boolean;
  passform: FormGroup;
  passformexodus: FormGroup;
  pvtform: FormGroup;
  pk: String;
  publickey: String;
  importedAccounts: any[];

  static parseEOS(tk_string) {
    if (tk_string.split(' ')[1] === 'EOS') {
      return parseFloat(tk_string.split(' ')[0]);
    } else {
      return 0;
    }
  }

  constructor(public eos: EOSJSService, private fb: FormBuilder, private aService: AccountsService, private router: Router) {
    this.existingWallet = false;
    this.exodusWallet = false;
    this.dropReady = false;
    this.newWallet = false;
    this.check = false;
    this.passmatch = true;
    this.passexodusmatch = true;
    this.agree = false;
    this.agree2 = false;
    this.accounts = [];
    this.importedAccounts = [];
    this.checkerr = '';
    this.pkValid = true;
    this.lottieConfig = {
      path: 'assets/logoanim.json',
      autoplay: true,
      loop: false
    };

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

  ngOnInit() {
    setTimeout(() => {
      this.anim.pause();
    }, 10);

    setTimeout(() => {
      this.anim.play();
    }, 900);
  }

  importFromExodus() {
    this.exodusWallet = true;
    this.dropReady = true;
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
          window['fs']['readFile'](path, 'utf-8', (err, data) => {
            if (!err) {
              const csvdata = data.split(',');
              this.pk = csvdata[csvdata.length - 1];
              document.removeEventListener('drop', handleDrop, true);
              document.removeEventListener('dragover', handleDragOver, true);
              this.verifyPrivateKey(this.pk);
              this.wizard.navService.next();
              window['fs']['unlink'](path, (err2) => {
                if (err2) {
                  console.log(err2);
                }
              });
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
      this.eos.initKeys(this.publicEOS, this.passform.value.matchingPassword.pass1).then(() => {
        this.eos.encryptAndStore(this.pvtform.value.private_key, this.publicEOS).then(() => {
          this.aService.importAccounts(this.importedAccounts);
          this.eos.decryptKeys(this.publicEOS).then((data) => {
            this.router.navigate(['dashboard', 'vote']).catch((err) => {
              console.log(err);
            });
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
      this.eos.initKeys(this.publicEOS, this.passformexodus.value.matchingPassword.pass1).then(() => {
        this.eos.encryptAndStore(this.pk, this.publicEOS).then(() => {
          this.aService.importAccounts(this.importedAccounts);
          this.eos.decryptKeys(this.publicEOS).then((data) => {
            this.router.navigate(['dashboard', 'vote']).catch((err) => {
              console.log(err);
            });
          }).catch((error) => {
            console.log('Error', error);
          });
        }).catch((err) => {
          console.log(err);
        });
      });
    }
  }

  verifyPrivateKey(input) {
    if (input !== '') {
      this.eos.checkPvtKey(input).then((results) => {
        this.publicEOS = results.publicKey;
        this.importedAccounts = [];
        this.importedAccounts = [...results.foundAccounts];
        this.pvtform.controls['private_key'].setErrors(null);
        this.errormsg = '';
      }).catch((e) => {
        this.pvtform.controls['private_key'].setErrors({'incorrect': true});
        this.importedAccounts = [];
        if (e.message.includes('Invalid checksum')) {
          this.errormsg = 'invalid private key';
        }
        if (e.message === 'no_account') {
          this.errormsg = 'No account associated with this private key';
        }
      });
    }
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
          // this.aService.accounts.push(accData);
          // this.aService.initFirst();
        });
        this.checkerr = '';
      }).catch((err) => {
        console.log(err);
        this.checkerr = err;
      });
    }
  }

}
