import {Component, OnInit, ViewChild} from '@angular/core';
import {ClrModal} from "@clr/angular";
import {BodyOutputType, Toast, ToasterConfig, ToasterService, ToastType} from "angular2-toaster";
import {CryptoService} from "../services/crypto/crypto.service";

@Component({
    selector: 'app-keygen-modal',
    templateUrl: './keygen-modal.component.html',
    styleUrls: ['./keygen-modal.component.css']
})
export class KeygenModalComponent implements OnInit {

    @ViewChild('keygenModal', {static: true}) keygenModal: ClrModal;

    prvKey = '';
    pubKey = '';
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

    copy(text: string) {
        this.cc(text, 'Key', 'Please save it on a safe place.');
    }

    private showToast(type: ToastType, title: string, body: string) {
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
        this.prvKey = keypair.private;
        this.pubKey = keypair.public;
        this.generating = false;
        this.generated = true;
    }

    openModal() {
        this.keygenModal.open();
    }

    onFinish() {
        this.keygenModal.close();
        this.prvKey = '';
        this.pubKey = '';
        this.agreeKeys = false;
    }
}
