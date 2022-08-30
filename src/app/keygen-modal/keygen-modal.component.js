"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeygenModalComponent = void 0;
const core_1 = require("@angular/core");
const angular_1 = require("@clr/angular");
const notification_service_1 = require("../services/notification.service");
const crypto_service_1 = require("../services/crypto/crypto.service");
let KeygenModalComponent = class KeygenModalComponent {
    constructor(toaster, crypto) {
        this.toaster = toaster;
        this.crypto = crypto;
        this.prvKey = '';
        this.pubKey = '';
        this.agreeKeys = false;
        this.generating = false;
        this.generated = false;
    }
    ngOnInit() {
    }
    cc(text, title, body) {
        window.navigator.clipboard.writeText(text).then(() => {
            this.toaster.onSuccess(title + ' copied to clipboard!', body);
        }).catch(() => {
            this.toaster.onError('Clipboard didn\'t work!', 'Please try other way.');
        });
    }
    copy(text) {
        this.cc(text, 'Key', 'Please save it on a safe place.');
    }
    generateNKeys() {
        return __awaiter(this, void 0, void 0, function* () {
            this.generating = true;
            const keypair = yield this.crypto.generateKeyPair();
            this.prvKey = keypair.private;
            this.pubKey = keypair.public;
            this.generating = false;
            this.generated = true;
        });
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
};
__decorate([
    (0, core_1.ViewChild)('keygenModal', { static: true }),
    __metadata("design:type", angular_1.ClrModal)
], KeygenModalComponent.prototype, "keygenModal", void 0);
KeygenModalComponent = __decorate([
    (0, core_1.Component)({
        selector: 'app-keygen-modal',
        templateUrl: './keygen-modal.component.html',
        styleUrls: ['./keygen-modal.component.css']
    }),
    __metadata("design:paramtypes", [notification_service_1.NotificationService,
        crypto_service_1.CryptoService])
], KeygenModalComponent);
exports.KeygenModalComponent = KeygenModalComponent;
//# sourceMappingURL=keygen-modal.component.js.map