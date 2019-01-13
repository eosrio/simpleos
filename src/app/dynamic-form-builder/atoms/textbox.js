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
var core_1 = require("@angular/core");
var forms_1 = require("@angular/forms");
// text,email,tel,textarea,password,
var TextBoxComponent = /** @class */ (function () {
    function TextBoxComponent() {
        this.field = {};
    }
    Object.defineProperty(TextBoxComponent.prototype, "isValid", {
        // [textMask]="{mask: maskArray}"
        // maskArray = ['\[','\"','[0-9]{1,12}','\.','[0-9]{4}','\s','[A-Z]{1,12}','\"','?','(','\,','\"','[0-9]{1,12}','\.','[0-9]{4}','\s','[A-Z]{1,12}','\"',')','{0,10}','\]'];
        get: function () {
            return this.form.controls[this.field.name].valid;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(TextBoxComponent.prototype, "isDirty", {
        get: function () {
            return this.form.controls[this.field.name].dirty;
        },
        enumerable: true,
        configurable: true
    });
    __decorate([
        core_1.Input(),
        __metadata("design:type", Object)
    ], TextBoxComponent.prototype, "field", void 0);
    __decorate([
        core_1.Input(),
        __metadata("design:type", forms_1.FormGroup)
    ], TextBoxComponent.prototype, "form", void 0);
    TextBoxComponent = __decorate([
        core_1.Component({
            template: '<div class="col-md-9" [formGroup]="form" style="margin-top:10px !important;" >' +
                '         <label for="{{field.label}}"  style="color:#0094d2 !important;text-transform: uppercase !important;">{{field.label}}</label>' +
                '         <div class=" md-form input-group mb-9">' +
                '           <input [attr.type]="field.type" class="col-md-9" [id]="field.name" [name]="field.name" [formControlName]="field.name" placeholder="Type: {{field.typeDef}}" style="border-bottom:1px solid #0094d2 !important;">' +
                '         </div>' +
                '        </div>',
            selector: 'textbox'
        }),
        __metadata("design:paramtypes", [])
    ], TextBoxComponent);
    return TextBoxComponent;
}());
exports.TextBoxComponent = TextBoxComponent;
//# sourceMappingURL=textbox.js.map