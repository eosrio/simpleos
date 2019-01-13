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
var dapp_component_1 = require("../dashboard/dapp/dapp.component");
var eosjs_service_1 = require("../eosjs.service");
var DynamicFormBuilderComponent = /** @class */ (function () {
    function DynamicFormBuilderComponent(dapp, eos) {
        this.dapp = dapp;
        this.eos = eos;
        this.onSubmit = new core_1.EventEmitter();
        this.fields = [];
        this.description = '';
    }
    DynamicFormBuilderComponent.prototype.ngOnInit = function () {
        var fieldsCtrls = {};
        for (var _i = 0, _a = this.fields; _i < _a.length; _i++) {
            var f = _a[_i];
            // console.log(f);
            if (f.type === 'text') {
                if (f.typeDef === 'name' || f.typeDef === 'account_name') {
                    var unamePattern = '^([a-z]|[1-5])+$';
                    fieldsCtrls[f.name] = new forms_1.FormControl(f.value || '', [forms_1.Validators.required, forms_1.Validators.pattern(unamePattern), forms_1.Validators.maxLength(12)]);
                }
                else {
                    fieldsCtrls[f.name] = new forms_1.FormControl(f.value || '', forms_1.Validators.required);
                }
            }
            else {
                var opts = {};
                for (var _b = 0, _c = f.options; _b < _c.length; _b++) {
                    var opt = _c[_b];
                    opts[opt.key] = new forms_1.FormControl(opt.value);
                }
                fieldsCtrls[f.name] = new forms_1.FormGroup(opts);
            }
        }
        this.form = new forms_1.FormGroup(fieldsCtrls);
    };
    DynamicFormBuilderComponent.prototype.ngAfterViewInit = function () {
        this.errormsg = this.dapp.errormsg2;
    };
    DynamicFormBuilderComponent.prototype.pushFormAction = function (form) {
        console.log(form['controls']);
        this.busySend = this.dapp.busy2;
        this.errormsg = this.dapp.errormsg2;
        var other2 = form['value'];
        this.dapp.formVal = [];
        this.dapp.formVal2 = [];
        var intArr = ['uint8', 'uint8_t', 'uint16', 'uint16_t', 'uint32', 'uint32_t', 'uint64', 'uint64_t', 'uint128', 'uint128_t', 'int8', 'int16', 'int32', 'int64', 'int128'];
        var strArr = ['name', 'asset', 'string'];
        var bolArr = ['bool'];
        var _loop_1 = function (val2) {
            if (intArr.indexOf(this_1.fields.find(function (f) { return f.name === val2; }).typeDef) > 0) {
                other2[val2] = parseInt(form['controls'][val2]['value']);
            }
            if (bolArr.indexOf(this_1.fields.find(function (f) { return f.name === val2; }).typeDef) > 0) {
                if (form['controls'][val2]['value'] === 'true' || form['controls'][val2]['value'] === '1') {
                    other2[val2] = true;
                }
                else if (form['controls'][val2]['value'] === 'false' || form['controls'][val2]['value'] === '0') {
                    other2[val2] = false;
                }
                else {
                    other2[val2] = false;
                }
            }
            if (this_1.fields.find(function (f) { return f.name === val2; }).multiline) {
                other2[val2] = (form['controls'][val2]['value']).split(',');
            }
            this_1.dapp.formVal2.push(val2 + ': ' + form['controls'][val2]['value']);
        };
        var this_1 = this;
        for (var val2 in form['controls']) {
            _loop_1(val2);
        }
        // for (let val in form['value']){
        //   if(this.fields.find(f=> f.name === val).multiline){
        //     other2[val]=JSON.parse(form['value'][val]);
        //   }
        //
        // }
        console.log(other2);
        this.dapp.formVal = other2;
        this.dapp.sendModal = true;
    };
    __decorate([
        core_1.Output(),
        __metadata("design:type", Object)
    ], DynamicFormBuilderComponent.prototype, "onSubmit", void 0);
    __decorate([
        core_1.Input(),
        __metadata("design:type", Array)
    ], DynamicFormBuilderComponent.prototype, "fields", void 0);
    __decorate([
        core_1.Input(),
        __metadata("design:type", String)
    ], DynamicFormBuilderComponent.prototype, "description", void 0);
    DynamicFormBuilderComponent = __decorate([
        core_1.Component({
            selector: 'dynamic-form-builder',
            template: '<form [formGroup]="form" >' +
                '      <span *ngIf="description!==\'\'" class="text-white" style="border:0.5px solid #0094d2; padding:8px; -webkit-border-radius: 10px;-moz-border-radius: 10px;border-radius: 10px; margin-bottom: 20px;" >{{description}}</span>' +
                '      <div *ngFor="let field of fields">' +
                '          <field-builder [field]="field" [form]="form"></field-builder>' +
                '      </div>' +
                '      <div></div>' +
                '      <div>' +
                '        <div class="col-md-9">' +
                '          <button type="submit" [disabled]="!form.valid" (click)="pushFormAction(this.form)" class="btn btn-primary">PUSH ACTION</button>' +
                '          <strong >{{errormsg}}</strong>' +
                '        </div>' +
                '      </div>' +
                '    </form>'
        }),
        __metadata("design:paramtypes", [dapp_component_1.DappComponent, eosjs_service_1.EOSJSService])
    ], DynamicFormBuilderComponent);
    return DynamicFormBuilderComponent;
}());
exports.DynamicFormBuilderComponent = DynamicFormBuilderComponent;
//# sourceMappingURL=dynamic-form-builder.component.js.map