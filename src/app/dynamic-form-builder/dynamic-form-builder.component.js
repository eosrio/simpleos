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
var eosjs_service_1 = require("../services/eosjs.service");
var DynamicFormBuilderComponent = /** @class */ (function () {
    function DynamicFormBuilderComponent(dapp, eos) {
        this.dapp = dapp;
        this.eos = eos;
        this.submit = new core_1.EventEmitter();
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
                    fieldsCtrls[f.name] = new forms_1.FormControl(f.value || '', [forms_1.Validators.pattern(unamePattern), forms_1.Validators.maxLength(12)]);
                }
                else {
                    fieldsCtrls[f.name] = new forms_1.FormControl(f.value || '');
                }
            }
            else {
                var opts = {};
                console.log(f.options);
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
        var _this = this;
        this.busySend = this.dapp.busy2;
        this.errormsg = this.dapp.errormsg2;
        var req = {};
        this.dapp.formVal = [];
        this.dapp.formVal2 = [];
        var intArr = ['uint8', 'uint8_t', 'uint16', 'uint16_t', 'uint32', 'uint32_t', 'uint64', 'uint64_t', 'uint128', 'uint128_t', 'int8', 'int16', 'int32', 'int64', 'int128'];
        var strArr = ['name', 'asset', 'string', 'account_name'];
        var bolArr = ['bool'];
        Object.keys(form['controls']).forEach(function (k) {
            var value = form['controls'][k]['value'];
            var field = _this.fields.find(function (f) { return f.name === k; });
            var type = field.typeDef;
            console.log(k, value, type, field);
            // Integer parsing
            if (intArr.includes(type)) {
                req[k] = parseInt(value, 10);
                _this.dapp.formVal2.push(k + ': ' + value + ' (' + type + ')');
            }
            // Boolear parsing
            if (bolArr.includes(type)) {
                if (value === 'true' || value === '1') {
                    req[k] = 1;
                }
                else if (value === 'false' || value === '0') {
                    req[k] = 0;
                }
                else {
                    req[k] = 0;
                }
                _this.dapp.formVal2.push(k + ': ' + value + ' (' + type + ')');
            }
            // Multiline string
            if (field.multiline) {
                if (value !== '') {
                    req[k] = value.split(',');
                    _this.dapp.formVal2.push(k + ': ' + value + ' (' + type + ')');
                }
                else {
                    req[k] = [];
                    _this.dapp.formVal2.push(k + ': ' + '[]');
                }
            }
            // String parsing
            if (strArr.includes(type)) {
                req[k] = value.trim();
                _this.dapp.formVal2.push(k + ': ' + value + ' (' + type + ')');
            }
        });
        console.log(req);
        this.dapp.formVal = req;
        this.dapp.sendModal = true;
    };
    __decorate([
        core_1.Output(),
        __metadata("design:type", Object)
    ], DynamicFormBuilderComponent.prototype, "submit", void 0);
    __decorate([
        core_1.Input(),
        __metadata("design:type", Array)
    ], DynamicFormBuilderComponent.prototype, "fields", void 0);
    __decorate([
        core_1.Input(),
        __metadata("design:type", Object)
    ], DynamicFormBuilderComponent.prototype, "description", void 0);
    DynamicFormBuilderComponent = __decorate([
        core_1.Component({
            selector: 'app-dynamic-form-builder',
            template: '<form [formGroup]="form" >' +
                '      <span *ngIf="description!==\'\'" class="text-white" style="border:0.5px solid #0094d2; padding:8px; -webkit-border-radius: 10px;-moz-border-radius: 10px;border-radius: 10px; margin-bottom: 20px;" >{{description}}</span>' +
                '      <div *ngFor="let field of fields">' +
                '          <app-field-builder [field]="field" [form]="form"></app-field-builder>' +
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