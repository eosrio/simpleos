import {Component, OnInit, ViewChild} from '@angular/core';
import {ClrModal} from "@clr/angular";
import {NotificationService} from '../services/notification.service';
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
    generating = false;
    generated = false;

    constructor(
        private toaster: NotificationService,
        private crypto: CryptoService
    ) {
    }

    ngOnInit(): void {
    }

    cc(text, title, body) {
        window.navigator.clipboard.writeText(text).then(() => {
            this.toaster.onSuccess(title + ' copied to clipboard!', body);
        }).catch(() => {
            this.toaster.onError('Clipboard didn\'t work!', 'Please try other way.');
        });
    }

    copy(text: string) {
        this.cc(text, 'Key', 'Please save it on a safe place.');
    }

    async generateNKeys() {
        this.generating = true;
        const keypair = await this.crypto.generateKeyPair();
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
