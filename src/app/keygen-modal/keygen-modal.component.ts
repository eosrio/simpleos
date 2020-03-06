import {Component, OnInit, ViewChild} from '@angular/core';
import {ClrWizard} from "@clr/angular";
import {BodyOutputType, Toast, ToasterConfig, ToasterService} from "angular2-toaster";
import {CryptoService} from "../services/crypto/crypto.service";

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

    constructor(
        private toaster: ToasterService,
        private crypto: CryptoService
    ) {
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
        this.generating = true;
        const keypair = this.crypto.generateKeyPair();
        this.ownerpk = keypair.private;
        this.ownerpub = keypair.public;
        this.generating = false;
        this.generated = true;
    }

    openModal() {
        this.wizardkeys.open();
    }
}
