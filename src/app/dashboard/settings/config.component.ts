import {Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {Router} from '@angular/router';
import {EOSJSService} from '../../eosjs.service';
import {AccountsService} from '../../accounts.service';
import {VotingService} from '../vote/voting.service';
import {NetworkService} from '../../network.service';
import {CryptoService} from '../../services/crypto.service';
import {BodyOutputType, Toast, ToasterConfig, ToasterService} from 'angular2-toaster';

@Component({
  selector: 'app-config',
  templateUrl: './config.component.html',
  styleUrls: ['./config.component.css']
})
export class ConfigComponent implements OnInit {
  endpointModal: boolean;
  logoutModal: boolean;
  confirmModal: boolean;
  pinModal: boolean;
  clearPinModal: boolean;
  changePassModal: boolean;
  importBKModal: boolean;
  exportBKModal: boolean;
  passForm: FormGroup;
  pinForm: FormGroup;
  exportForm: FormGroup;
  importForm: FormGroup;
  passmatch: boolean;
  clearContacts: boolean;
  config: ToasterConfig;
  infile:any;
  exfile:any;
  choosedDir:string;
  choosedFil:string;
  disableEx:boolean;
  disableIm:boolean;
  busy = false;
  @ViewChild('customExportBK') customExportBK:ElementRef;
  @ViewChild('customImportBK') customImportBK:ElementRef;


  selectedEndpoint = null;

  static resetApp() {
    window['remote']['app']['relaunch']();
    window['remote']['app'].exit(0);
  }

  constructor(private fb: FormBuilder,
              public voteService: VotingService,
              public network: NetworkService,
              private router: Router,
              private eos: EOSJSService,
              private crypto: CryptoService,
              public aService: AccountsService,
              private toaster: ToasterService) {
    this.endpointModal = false;
    this.logoutModal = false;
    this.confirmModal = false;
    this.pinModal = false;
    this.clearPinModal = false;
    this.clearContacts = false;
    this.changePassModal = false;
    this.importBKModal = false;
    this.exportBKModal = false;
    this.passForm = this.fb.group({
      oldpass: ['', [Validators.required, Validators.minLength(10)]],
      matchingPassword: this.fb.group({
        pass1: ['', [Validators.required, Validators.minLength(10)]],
        pass2: ['', [Validators.required, Validators.minLength(10)]]
      })
    });
    this.pinForm = this.fb.group({
      pin: ['', Validators.required],
    });
    this.exportForm = this.fb.group({
      pass: ['', Validators.required],
      customExportBK: ['', Validators.required],
    });
    this.importForm = this.fb.group({
      pass: ['', Validators.required],
      customImportBK: ['', Validators.required],
    });
    this.disableEx = false;
    this.disableIm = false;
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
  }

  logout() {
    if (this.clearContacts) {
      localStorage.clear();
    } else {
      const arr = [];
      for (let i = 0; i < localStorage.length; i++) {
        if (localStorage.key(i) !== 'simpleos.contacts') {
          arr.push(localStorage.key(i));
        }
      }
      arr.forEach((k) => {
        localStorage.removeItem(k);
      });
    }
    ConfigComponent.resetApp();
  }

  selectEndpoint(data) {
    this.selectedEndpoint = data;
    this.confirmModal = true;
  }

  connectEndpoint() {
    this.network.selectedEndpoint.next(this.selectedEndpoint);
    this.network.networkingReady.next(false);
    this.network.startup(null);
    this.confirmModal = false;
  }

  connectCustom(url) {
    this.network.selectedEndpoint.next({url: url, owner: 'Other', latency: 0, filters: []});
    this.network.networkingReady.next(false);
    this.network.startup(url);
    this.endpointModal = false;
  }

  changePass() {
    if (this.passmatch) {
      const account = this.aService.selected.getValue();
      const publicKey = account.details['permissions'][0]['required_auth'].keys[0].key;
      this.crypto.authenticate(this.passForm.value.oldpass, publicKey).then(() => {
        this.crypto.changePass(publicKey, this.passForm.value.matchingPassword.pass2).then(() => {
          ConfigComponent.resetApp();
        });
      });
    }
  }

  passCompare() {
    if (this.passForm.value.matchingPassword.pass1 && this.passForm.value.matchingPassword.pass2) {
      if (this.passForm.value.matchingPassword.pass1 === this.passForm.value.matchingPassword.pass2) {
        this.passForm['controls'].matchingPassword['controls']['pass2'].setErrors(null);
        this.passmatch = true;
      } else {
        this.passForm['controls'].matchingPassword['controls']['pass2'].setErrors({'incorrect': true});
        this.passmatch = false;
      }
    }
  }

  clearPin() {
    this.crypto.removePIN();
    this.clearPinModal = false;
    this.showToast('success', 'Lockscreen PIN removed!', '');
  }

  setPIN() {
    if (this.pinForm.value.pin !== '') {
      if (localStorage.getItem('simpleos-hash')) {
        this.crypto.updatePIN(this.pinForm.value.pin);
      } else {
        this.crypto.createPIN(this.pinForm.value.pin);
      }
      this.showToast('success', 'New Lockscreen PIN defined!', '');
    }
    this.pinModal = false;
  }


  inputEXClick() {
    this.customExportBK.nativeElement.click();
    // let el: HTMLElement = this.customExportBK.nativeElement as HTMLElement;
    // el.click();
  }

  exportCheckBK(a){

    this.exfile = a.target.files[0];
    //console.log( this.exfile );
    const path = this.exfile.path;
    if(path==""){
      this.showToast('error', 'Went some wrong, try again!', '');
      this.exfile = "";
      return false;
    }
    this.choosedDir = path;
  }

  exportBK(){
    this.disableEx = true;
    this.busy = true;
    if(this.exfile!=""&&this.exportForm.value.pass!=""){
      let bkpArr = [];
      for (let i = 0; i < localStorage.length; i++) {
        if (localStorage.key(i).length > 12) {
          const keyLS = localStorage.key(i);
          const valueLS = localStorage.getItem(localStorage.key(i));
          bkpArr.push({key:keyLS,value:valueLS});
        }
      }
      //console.log(JSON.stringify(bkpArr));
      let pass = this.exportForm.value.pass;
      //console.log(pass);
      let rp = this.crypto.encryptBKP(JSON.stringify(bkpArr),pass);

      const path = this.exfile.path+"/simpleos.bkp";

      window['filesystem']['writeFile'](path, rp, 'utf-8', (err, data) => {
        if (!err) {
          this.showToast('success', 'Backup exported!', '');
          this.choosedDir = '';
          this.disableEx = false;
          this.busy = false;
          this.exportBKModal = false;
        }
      });

    }else{
      this.showToast('error', 'Choose your backup directory and fill the password field!', '');
      this.choosedDir = '';
      this.disableEx = false;
      this.busy = false;
    }
  }

  inputIMClick() {
    this.customImportBK.nativeElement.click();
    // let el: HTMLElement = this.customExportBK.nativeElement as HTMLElement;
    // el.click();
  }

  importCheckBK(a){

    this.infile = a.target.files[0];

    const name = this.infile.name;

    if(name!="simpleos.bkp"){
      this.showToast('error', 'Wrong file!', '');
      this.infile = "";
      return false;
    }
    this.choosedFil = name;
    //console.log( this.infile );
  }

  importBK(){
    this.disableIm = true;
    this.busy = true;
    if (this.infile != ''&&this.importForm.value.pass!='') {
      window['filesystem']['readFile'](this.infile.path, 'utf-8', (err, data) => {

        if (!err) {
          let pass = this.importForm.value.pass;
          let decrypt = this.crypto.decryptBKP(data,pass);
          try{
            let arrLS = JSON.parse(decrypt);
            this.showToast('success', 'Imported with success!', '');
            arrLS.forEach(function(d){
              localStorage.setItem(d["key"],d["value"]);
            });
            this.choosedFil = '';
            this.disableIm = false;
            this.busy = false;
            this.importBKModal = false;

          }catch (e) {
            this.showToast('error', 'Wrong password, please try again!', '');
            console.log("wrong file");
          }

        }else{
          this.showToast('error', 'Something went wrong, please try again or contact our support!', '');
          console.log("wrong entry");
        }
      });
    }else{
      this.showToast('error', 'Choose your backup file and fill the password field!', '');
      this.choosedFil = '';
      this.disableIm = false;
      this.busy = false;
    }

    //console.log( this.infile );
  }

}
