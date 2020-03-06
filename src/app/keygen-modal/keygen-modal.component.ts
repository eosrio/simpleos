import {Component, OnInit, ViewChild} from '@angular/core';
import {ClrWizard} from "@clr/angular";
import {BodyOutputType, Toast, ToasterConfig, ToasterService} from "angular2-toaster";
import {Numeric} from "eosjs/dist";
import {constructElliptic, PrivateKey} from "eosjs/dist/eosjs-key-conversions";
import {ElectronService} from "ngx-electron";

@Component({
    selector: 'app-keygen-modal',
    templateUrl: './keygen-modal.component.html',
    styleUrls: ['./keygen-modal.component.css']
})
export class KeygenModalComponent implements OnInit {

    @ViewChild('wizardkeys', {static: true}) wizardkeys: ClrWizard;

    ownerpub = '';
    ownerpk = '';
    agreeKeys = false;
    private config: ToasterConfig;
    generating = false;
    generated = false;
    private nodeCrypto: any;

    keyType = Numeric.KeyType.k1;

    constructor(
        private toaster: ToasterService,
        private _electronService: ElectronService,
    ) {
        this.nodeCrypto = this._electronService.remote.require('crypto');
    }

    ngOnInit(): void {
    }

    cc(text, title, body) {
        window.navigator.clipboard.writeText(text).then(() => {
            this.showToast('success', title + ' copied to clipboard!', body);
        }).catch(() => {
            this.showToast('error', 'Clipboard didn\'t work!', 'Please try other way.');
        });
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

    async generateNKeys() {
        console.log('generating keys...');
        this.generating = true;
        const rawkey = this.nodeCrypto.randomBytes(32);
        const key = {data: rawkey, type: this.keyType};
        const privateKey = new PrivateKey(key, constructElliptic(this.keyType));
        this.ownerpk = privateKey.toString();
        this.ownerpub = privateKey.getPublicKey().toString();
        this.generating = false;
        this.generated = true;
    }

    openModal() {
        this.wizardkeys.open();
    }
}
