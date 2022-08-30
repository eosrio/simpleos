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
var DappComponent_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DappComponent = void 0;
const core_1 = require("@angular/core");
const forms_1 = require("@angular/forms");
const accounts_service_1 = require("../../services/accounts.service");
const crypto_service_1 = require("../../services/crypto/crypto.service");
const eosjs2_service_1 = require("../../services/eosio/eosjs2.service");
const transaction_factory_service_1 = require("../../services/eosio/transaction-factory.service");
const json_schema_1 = require("@ngx-formly/core/json-schema");
const resource_service_1 = require("../../services/resource.service");
let DappComponent = DappComponent_1 = class DappComponent {
    constructor(aService, trxFactory, eosjs, fb, cdr, crypto, formlyJsonschema, resource) {
        this.aService = aService;
        this.trxFactory = trxFactory;
        this.eosjs = eosjs;
        this.fb = fb;
        this.cdr = cdr;
        this.crypto = crypto;
        this.formlyJsonschema = formlyJsonschema;
        this.resource = resource;
        this.tokens = [];
        this.actions = [];
        this.abiSmartContractActions = [];
        this.abiSmartContractStructs = [];
        this.triggerAction = false;
        this.actionInfo = [];
        this.formVal2 = [];
        this.form = new forms_1.FormGroup({
            fields: new forms_1.FormControl(JSON.stringify(this.fields)),
        });
        this.searchForm = this.fb.group({
            search: ['', [forms_1.Validators.maxLength(12)]],
        });
        this.confirmForm = this.fb.group({
            pass: ['', [forms_1.Validators.required]],
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
        this.aux = 0;
    }
    static isArray(what) {
        return Object.prototype.toString.call(what) === '[object Array]';
    }
    // addComponent(componentClass: Type<any>) {
    // 	const componentFactory = this.componentFactoryResolver.resolveComponentFactory(componentClass);
    // 	const component = this.dForm.createComponent(componentFactory);
    //
    // 	this.components.push(component);
    // }
    //
    // removeComponent(componentClass: Type<any>) {
    // 	const component = this.components.find((component) => component.instance instanceof componentClass);
    // 	const componentIndex = this.components.indexOf(component);
    //
    // 	if (componentIndex !== -1) {
    // 		this.dForm.remove(this.dForm.indexOf(component));
    // 		this.components.splice(componentIndex, 1);
    // 	}
    // }
    ngOnInit() {
        this.loading = true;
        this.sendModal = false;
        this.busy = false;
        this.buttonActive = '';
        // this.exampleJsonObject = {};
    }
    ngAfterViewInit() {
        this.selectedAccountSubscription = this.aService.selected.asObservable().subscribe((sel) => {
            this.loading = true;
            if (sel) {
                this.loadTokens();
            }
        });
    }
    loadTokens() {
        setTimeout(() => {
            this.tokens = [];
            this.aService.tokens.forEach(token => {
                this.tokens.push(token);
            });
            this.addSystemContracts();
            this.loading = false;
        }, 1000);
    }
    addSystemContracts() {
        this.aService.activeChain['system'].forEach((sc) => {
            this.tokens.push({ contract: sc });
        });
    }
    setActions(abi) {
        abi.actions.forEach(action => {
            this.abiSmartContractActions.push(action);
        });
    }
    setStructs(abi) {
        abi.structs.forEach(struct => {
            this.abiSmartContractStructs.push(struct);
        });
    }
    searchDapp(sc) {
        this.tokens = [];
        this.errormsg = '';
        this.loading = true;
        if (sc !== '') {
            this.eosjs.getSCAbi(sc).then(data => {
                this.setActions(data['abi']);
                this.setStructs(data['abi']);
                this.tokens.push({ contract: sc });
                this.loading = false;
            }).catch(() => {
                this.errormsg = 'Invalid Contract!';
                this.loading = false;
            });
        }
        else {
            this.loadTokens();
        }
    }
    loadTokenInfo(token) {
        this.errormsg2 = '';
        this.abiSmartContractActions = [];
        this.abiSmartContractStructs = [];
        this.actionInfo = [];
        this.buttonActive = '';
        this.description = '';
        this.title = '';
        this.logo = '';
        this.busy = true;
        this.triggerAction = false;
        this.contract = token.contract;
        this.balance = token.balance;
        this.price = token.price;
        this.name = token.name;
        this.symbol = '';
        this.schemaJSON = {};
        this.modelJSON = {};
        try {
            this.form = new forms_1.FormGroup({});
            this.options = {};
            this.fields = [];
            this.model = {};
        }
        catch (e) {
            console.log(e);
        }
        this.eosjs.getSymbolContract(this.contract).then(val => {
            this.symbol = val.rows[0].balance.split(' ')[1];
        }).catch(err => {
            console.log(token.name);
            if (token.name === '' || token.name === undefined) {
                this.symbol = this.aService.activeChain['symbol'];
            }
            else {
                this.symbol = token.name;
            }
            console.log(err);
        });
        this.eosjs.getSCAbi(this.contract).then(data => {
            this.setActions(data['abi']);
            this.setStructs(data['abi']);
            this.busy = false;
        }).catch(err => {
            console.log(err);
        });
        this.eosjs.getDappMetaData(this.contract).then(info => {
            if (info.rows[0]) {
                this.title = info.rows[0]['title'];
                this.description = info.rows[0]['description'];
                this.logo = info.rows[0]['logo'];
                info.rows[0]['actions'].forEach(val => {
                    this.actionInfo.push(val);
                });
                console.log(info);
            }
            else {
                console.log('Empty');
            }
        }).catch(error => {
            console.log('Error MetaData: ', error);
        });
    }
    getForm(actionType, actionName) {
        this.buttonActive = actionName;
        this.actionDesc = '';
        this.fields = [];
        this.busy = false;
        if (this.abiSmartContractStructs.find(action => action.name === actionType).fields.length > 0) {
            this.action = actionType;
            if (this.actionInfo) {
                if (this.actionInfo['long_desc']) {
                    this.actionDesc = actionType.toUpperCase() + ' ' + this.actionInfo['long_desc'];
                }
            }
            this.aux = 0;
            const SchemaJSON = this.schemaJson(actionType);
            this.schemaJSON = {
                "schema": {
                    "title": "ACTION: " + actionType.toUpperCase(),
                    "type": "object",
                    "properties": SchemaJSON,
                }
            };
            try {
                this.form = new forms_1.FormGroup({});
                this.options = {};
                this.fields = [this.formlyJsonschema.toFieldConfig(this.schemaJSON.schema)];
                this.model = {};
            }
            catch (e) {
                console.log(e);
            }
            this.triggerAction = true;
        }
        else {
            this.triggerAction = false;
        }
        this.cdr.detectChanges();
    }
    schemaJson(type) {
        const out = {};
        const tempOut = {};
        this.abiSmartContractStructs.find(action => action.name === type).fields.forEach(field => {
            const arr = (field.type.indexOf('[]') > 0);
            const field_type = field.type.replace('[]', '');
            if (this.abiSmartContractStructs.find(act => act.name === field_type)) {
                const children = JSON.stringify(this.schemaJson(field_type));
                if (arr) {
                    out[field.name] = JSON.parse('{"title": "' + field.name.charAt(0).toUpperCase() + field.name.slice(1) + '", "type": "array", "items": {"type": "object", "properties": ' +
                        children + '}}');
                }
                else {
                    out[field.name] = JSON.parse('{"title": "' + field.name.charAt(0).toUpperCase() + field.name.slice(1) + '", "type": "object", "properties": ' + children + '}');
                }
            }
            else {
                const intArr = [
                    'uint8',
                    'uint8_t',
                    'uint16',
                    'uint16_t',
                    'uint32',
                    'uint32_t',
                    'uint64',
                    'uint64_t',
                    'uint128',
                    'uint128_t',
                    'int8',
                    'int16',
                    'int32',
                    'int64',
                    'int128',
                    // 'bool'
                ];
                let typeABI;
                if (intArr.includes(field.type)) {
                    typeABI = '"type": "number", "default":0';
                }
                else if (arr) {
                    if (intArr.includes(field_type)) {
                        typeABI = '"type": "array","items":[{"type":"number","default":0}]';
                    }
                    else {
                        typeABI = '"type": "array","items":[{"type":"string"}]';
                    }
                }
                else {
                    typeABI = '"type": "string"';
                }
                const jsonTxt = '{ "title": "' + field.name.charAt(0).toUpperCase() + field.name.slice(1) + '", ' + typeABI + ' }';
                out[field.name] = JSON.parse(jsonTxt);
            }
        });
        console.log(out);
        return out;
    }
    formFilled(ev) {
        if (ev) {
            this.busy = false;
            this.wrongpass = '';
            const fullFormSchema = Object.assign(this.schemaJson(this.action), ev['schema']);
            const fullForm = this.form.value;
            console.log(fullFormSchema);
            console.log(this.form.value);
            for (const idx in fullForm) {
                if (fullForm.hasOwnProperty(idx)) {
                    if (DappComponent_1.isArray(fullForm[idx])) {
                        fullForm[idx].sort();
                    }
                }
                if (fullForm[idx] === null) {
                    if (DappComponent_1.isArray(fullForm[idx]))
                        fullForm[idx] = [];
                    else {
                        fullForm[idx] = '';
                    }
                }
            }
            this.formVal = fullForm;
            this.pushAction().catch(console.log);
        }
    }
    pushAction() {
        return __awaiter(this, void 0, void 0, function* () {
            const [auth, publicKey] = this.trxFactory.getAuth();
            const trx = { actions: [{
                        account: this.contract,
                        name: this.action,
                        authorization: [auth],
                        data: this.formVal
                    }] };
            const tk_name = this.aService.activeChain['symbol'];
            this.trxFactory.modalData.next({
                transactionPayload: trx,
                termsHeader: '',
                signerAccount: auth.actor,
                signerPublicKey: publicKey,
                labelHTML: '',
                actionTitle: `${this.action} on ${this.contract}`,
                termsHTML: '',
                tk_name: tk_name
            });
            const result = yield this.trxFactory.launch(publicKey);
            console.log(result);
        });
    }
};
DappComponent = DappComponent_1 = __decorate([
    (0, core_1.Component)({
        selector: 'app-dapp',
        templateUrl: './dapp.component.html',
        styleUrls: ['./dapp.component.css'],
    }),
    __metadata("design:paramtypes", [accounts_service_1.AccountsService,
        transaction_factory_service_1.TransactionFactoryService,
        eosjs2_service_1.Eosjs2Service,
        forms_1.FormBuilder,
        core_1.ChangeDetectorRef,
        crypto_service_1.CryptoService,
        json_schema_1.FormlyJsonschema,
        resource_service_1.ResourceService])
], DappComponent);
exports.DappComponent = DappComponent;
//# sourceMappingURL=dapp.component.js.map