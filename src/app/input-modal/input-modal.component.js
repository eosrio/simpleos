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
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputModalComponent = void 0;
const core_1 = require("@angular/core");
const forms_1 = require("@angular/forms");
const textMaskAddons_1 = require("text-mask-addons/dist/textMaskAddons");
const modal_state_service_1 = require("../services/modal-state.service");
let InputModalComponent = class InputModalComponent {
    constructor(fb, mds, cdr) {
        this.fb = fb;
        this.mds = mds;
        this.cdr = cdr;
        this.numberMask = (0, textMaskAddons_1.createNumberMask)({
            prefix: '',
            allowDecimal: true,
            includeThousandsSeparator: false,
            decimalLimit: 4,
        });
        this.errormsg = '';
        this.valid = false;
        this.inputForm = this.fb.group({
            amount: ['', forms_1.Validators.min(0)]
        });
        this.inputSubscription = this.inputForm.get('amount').valueChanges.subscribe(() => {
            this.checkAmount();
        });
    }
    ngOnDestroy() {
        this.inputSubscription.unsubscribe();
    }
    submit() {
        if (this.valid) {
            this.mds.inputModal.event.emit({
                event: 'done',
                value: this.inputForm.get('amount').value
            });
            this.mds.inputModal.visibility = false;
            this.cdr.detectChanges();
        }
    }
    checkAmount() {
        let value = parseFloat(this.inputForm.get('amount').value);
        if (isNaN(value)) {
            value = 0;
        }
        if (value > this.mds.inputModal.maxValue) {
            this.inputForm.get('amount').setErrors({ 'invalid': true });
            this.errormsg = this.mds.inputModal.errorMessage;
            this.valid = false;
        }
        else {
            this.inputForm.get('amount').setErrors(null);
            this.errormsg = '';
            this.valid = true;
        }
    }
    setMaxAmount() {
        this.inputForm.patchValue({
            amount: this.mds.inputModal.maxValue
        });
    }
    onClose() {
        this.inputForm.reset();
        this.mds.inputModal.event.emit({
            event: 'close',
            value: null
        });
    }
};
InputModalComponent = __decorate([
    (0, core_1.Component)({
        selector: 'app-input-modal',
        templateUrl: './input-modal.component.html',
        styleUrls: ['./input-modal.component.css']
    }),
    __metadata("design:paramtypes", [forms_1.FormBuilder, modal_state_service_1.ModalStateService, core_1.ChangeDetectorRef])
], InputModalComponent);
exports.InputModalComponent = InputModalComponent;
//# sourceMappingURL=input-modal.component.js.map