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
var FieldBuilderComponent = /** @class */ (function () {
    function FieldBuilderComponent() {
    }
    Object.defineProperty(FieldBuilderComponent.prototype, "isValid", {
        get: function () { return this.form.controls[this.field.name].valid; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(FieldBuilderComponent.prototype, "isDirty", {
        get: function () { return this.form.controls[this.field.name].dirty; },
        enumerable: true,
        configurable: true
    });
    FieldBuilderComponent.prototype.ngOnInit = function () {
    };
    __decorate([
        core_1.Input(),
        __metadata("design:type", Object)
    ], FieldBuilderComponent.prototype, "field", void 0);
    __decorate([
        core_1.Input(),
        __metadata("design:type", Object)
    ], FieldBuilderComponent.prototype, "form", void 0);
    FieldBuilderComponent = __decorate([
        core_1.Component({
            selector: 'field-builder',
            template: '<div class="form-row" [formGroup]="form">' +
                //'    <div class="col-md-9" [ngSwitch]="field.type">' +
                '       <textbox [field]="field" [form]="form"></textbox>' +
                //'       <textbox *ngSwitchCase="\'text\'" class="float:left;width:70%;" [field]="field" [form]="form"></textbox>' +
                '       <div class="text-danger fadeInDown animated" style="margin-bottom: 10px!important;" *ngIf="!isValid"><b>* is required</b></div>' +
                //'    </div>'+
                '  </div>'
        }),
        __metadata("design:paramtypes", [])
    ], FieldBuilderComponent);
    return FieldBuilderComponent;
}());
exports.FieldBuilderComponent = FieldBuilderComponent;
//# sourceMappingURL=field-builder.component.js.map