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
var accounts_service_1 = require("../../services/accounts.service");
var eosjs_service_1 = require("../../services/eosjs.service");
var crypto_service_1 = require("../../services/crypto.service");
var angular2_toaster_1 = require("angular2-toaster");
var DappComponent = /** @class */ (function () {
    function DappComponent(aService, eos, fb, componentFactoryResolver, toaster, crypto) {
        this.aService = aService;
        this.eos = eos;
        this.fb = fb;
        this.componentFactoryResolver = componentFactoryResolver;
        this.toaster = toaster;
        this.crypto = crypto;
        this.componentClass = FormComponent;
        this.components = [];
        this.tokens = [];
        this.actions = [];
        this.abiSmartContractActions = [];
        this.abiSmartContractStructs = [];
        this.triggerAction = false;
        this.actionInfo = [];
        this.formVal2 = [];
        this.form = new forms_1.FormGroup({
            fields: new forms_1.FormControl(JSON.stringify(this.fields))
        });
        this.searchForm = this.fb.group({
            search: ['', [forms_1.Validators.maxLength(12)]]
        });
        this.confirmForm = this.fb.group({
            pass: ['', [forms_1.Validators.required, forms_1.Validators.minLength(10)]]
        });
        this.errormsg = '';
        this.actionDesc = '';
        this.description = '';
        this.title = '';
        this.logo = '';
        this.actionInfo = [];
        this.actionShort = '';
        this.errormsg2 = '';
        this.formVal = [];
        this.wrongpass = '';
        this.action = '';
        this.sendModal = false;
        this.busy = false;
        this.busy2 = false;
    }
    DappComponent.prototype.addComponent = function (componentClass) {
        var componentFactory = this.componentFactoryResolver.resolveComponentFactory(componentClass);
        var component = this.dForm.createComponent(componentFactory);
        this.components.push(component);
    };
    DappComponent.prototype.removeComponent = function (componentClass) {
        var component = this.components.find(function (component) { return component.instance instanceof componentClass; });
        var componentIndex = this.components.indexOf(component);
        if (componentIndex !== -1) {
            this.dForm.remove(this.dForm.indexOf(component));
            this.components.splice(componentIndex, 1);
        }
    };
    DappComponent.prototype.ngOnInit = function () {
        this.loading = true;
        this.sendModal = false;
        this.busy = false;
    };
    DappComponent.prototype.ngAfterViewInit = function () {
        var _this = this;
        this.aService.selected.asObservable().subscribe(function (sel) {
            _this.loading = true;
            if (sel) {
                _this.loadTokens();
            }
        });
    };
    DappComponent.prototype.loadTokens = function () {
        var _this = this;
        setTimeout(function () {
            _this.tokens = [];
            _this.aService.tokens.forEach(function (token) {
                _this.tokens.push(token);
            });
            _this.addSystemContracts();
            _this.loading = false;
        }, 1000);
    };
    DappComponent.prototype.addSystemContracts = function () {
        var _this = this;
        this.aService.activeChain['system'].forEach(function (sc) {
            _this.tokens.push({ contract: sc });
        });
    };
    DappComponent.prototype.showToast = function (type, title, body) {
        this.config = new angular2_toaster_1.ToasterConfig({
            positionClass: 'toast-top-right',
            timeout: 10000,
            newestOnTop: true,
            tapToDismiss: true,
            preventDuplicates: false,
            animation: 'slideDown',
            limit: 1,
        });
        var toast = {
            type: type,
            title: title,
            body: body,
            timeout: 10000,
            showCloseButton: true,
            bodyOutputType: angular2_toaster_1.BodyOutputType.TrustedHtml,
        };
        this.toaster.popAsync(toast);
    };
    DappComponent.prototype.setActions = function (abi) {
        var _this = this;
        abi.actions.forEach(function (action) {
            _this.abiSmartContractActions.push(action);
        });
    };
    DappComponent.prototype.setStructs = function (abi) {
        var _this = this;
        abi.structs.forEach(function (struct) {
            _this.abiSmartContractStructs.push(struct);
        });
    };
    DappComponent.prototype.searchDapp = function (sc) {
        var _this = this;
        this.tokens = [];
        this.errormsg = '';
        this.loading = true;
        if (sc !== '') {
            this.eos.getSCAbi(sc).then(function (data) {
                _this.setActions(data['abi']);
                _this.setStructs(data['abi']);
                _this.tokens.push({ contract: sc });
                _this.loading = false;
            }).catch(function (err) {
                _this.errormsg = 'Invalid Contract!';
                _this.loading = false;
            });
        }
        else {
            this.loadTokens();
        }
    };
    DappComponent.prototype.loadTokenInfo = function (token) {
        var _this = this;
        this.errormsg2 = '';
        this.abiSmartContractActions = [];
        this.abiSmartContractStructs = [];
        this.actionInfo = [];
        this.description = '';
        this.title = '';
        this.logo = '';
        this.form.reset();
        this.form.removeControl(JSON.stringify(this.fields));
        this.removeComponent(this.componentClass);
        this.triggerAction = false;
        this.contract = token.contract;
        this.balance = token.balance;
        this.price = token.price;
        this.name = token.name;
        /*
            this.description = "Lorem ipsum dolor sit amet lipsum"+
             "ipsum dolor sit amet lipsum ipsum dolor sit amet lipsum"+
             "ipsum dolor sit amet lipsum ipsum dolor sit amet lipsum"+
             "ipsum dolor sit amet lipsum ipsum dolor sit amet lipsum";
            */
        this.eos.getSCAbi(this.contract).then(function (data) {
            // console.log(data);
            _this.setActions(data['abi']);
            _this.setStructs(data['abi']);
        }).catch(function (err) {
            console.log(err);
        });
        this.eos.getDappMetaData(this.contract).then(function (info) {
            if (info.rows[0]) {
                _this.title = info.rows[0]['title'];
                _this.description = info.rows[0]['description'];
                _this.logo = info.rows[0]['logo'];
                info.rows[0]['actions'].forEach(function (val) {
                    _this.actionInfo.push(val);
                });
                console.log(info);
            }
            else {
                console.log('Empty');
            }
        }).catch(function (error) {
            console.log('Error MetaData: ', error);
        });
        // this.eos.getSCAbi(this.contract);
    };
    DappComponent.prototype.getForm = function (actionType) {
        var _this = this;
        this.actionDesc = '';
        this.busy = false;
        if (this.abiSmartContractStructs.find(function (action) { return action.name === actionType; }).fields.length > 0) {
            this.fields = [];
            this.action = actionType;
            if (this.actionInfo) {
                if (this.actionInfo['long_desc']) {
                    this.actionDesc = actionType.toUpperCase() + ' ' + this.actionInfo['long_desc'];
                }
            }
            this.removeComponent(this.componentClass);
            this.abiSmartContractStructs.find(function (action) { return action.name === actionType; }).fields.forEach(function (field) {
                console.log(field.type.indexOf('[]'));
                var line = (field.type.indexOf('[]') > 0);
                _this.fields.push({
                    type: 'text',
                    typeDef: field.type,
                    multiline: line,
                    name: field.name,
                    label: field.name,
                    value: '',
                    required: true
                });
            });
            this.triggerAction = true;
            this.addComponent(this.componentClass);
            this.form = new forms_1.FormGroup({
                fields: new forms_1.FormControl(JSON.stringify(this.fields))
            });
        }
        else {
            this.triggerAction = false;
            this.removeComponent(this.componentClass);
            this.form.removeControl(JSON.stringify(this.fields));
        }
    };
    DappComponent.prototype.pushAction = function () {
        var _this = this;
        this.busy = true;
        this.busy2 = true;
        this.wrongpass = '';
        this.errormsg2 = '';
        var account = this.aService.selected.getValue();
        var accountName = this.aService.selected.getValue().name;
        var password = this.confirmForm.get('pass').value;
        var pubkey = account.details['permissions'][0]['required_auth'].keys[0].key;
        this.crypto.authenticate(password, pubkey).then(function (data) {
            if (data === true) {
                _this.eos.pushActionContract(_this.contract, _this.action, _this.formVal, accountName).then(function (info) {
                    _this.tokenModal = false;
                    _this.busy = false;
                    _this.busy2 = false;
                    _this.sendModal = false;
                    console.log(info);
                    _this.showToast('success', 'Transation broadcasted', 'Check your history for confirmation.');
                }).catch(function (error) {
                    _this.wrongpass = JSON.stringify(JSON.parse(error).error.details[0].message);
                });
                _this.busy = false;
            }
        }).catch(function (error2) {
            _this.wrongpass = 'Wrong password!';
            _this.busy = false;
        });
    };
    __decorate([
        core_1.ViewChild('dForm', { read: core_1.ViewContainerRef }),
        __metadata("design:type", core_1.ViewContainerRef)
    ], DappComponent.prototype, "dForm", void 0);
    DappComponent = __decorate([
        core_1.Component({
            selector: 'app-dapp',
            templateUrl: './dapp.component.html',
            styleUrls: ['./dapp.component.css']
        }),
        __metadata("design:paramtypes", [accounts_service_1.AccountsService,
            eosjs_service_1.EOSJSService,
            forms_1.FormBuilder,
            core_1.ComponentFactoryResolver,
            angular2_toaster_1.ToasterService,
            crypto_service_1.CryptoService])
    ], DappComponent);
    return DappComponent;
}());
exports.DappComponent = DappComponent;
// Example component (can be any component e.g. app-header app-section)
var FormComponent = /** @class */ (function () {
    function FormComponent(dApps) {
        this.dApps = dApps;
        this.fields = dApps.fields;
        this.description = dApps.actionDesc;
    }
    FormComponent.prototype.getFields = function () {
        return this.fields;
    };
    FormComponent.prototype.getActionDescription = function () {
        return this.description;
    };
    FormComponent = __decorate([
        core_1.Component({
            selector: 'app-dyn-form',
            template: '<app-dynamic-form-builder [fields]="getFields()" [description]="getActionDescription()"></app-dynamic-form-builder>'
        }),
        __metadata("design:paramtypes", [DappComponent])
    ], FormComponent);
    return FormComponent;
}());
exports.FormComponent = FormComponent;
//# sourceMappingURL=dapp.component.js.map