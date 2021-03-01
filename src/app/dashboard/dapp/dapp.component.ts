import {AfterViewInit, ChangeDetectorRef, Component, OnInit} from '@angular/core';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {AccountsService} from '../../services/accounts.service';
import {EOSAccount} from '../../interfaces/account';
import {CryptoService} from '../../services/crypto/crypto.service';
import {Subscription} from 'rxjs';
import {Eosjs2Service} from '../../services/eosio/eosjs2.service';
import {TransactionFactoryService} from "../../services/eosio/transaction-factory.service";
import { FormlyFormOptions, FormlyFieldConfig } from '@ngx-formly/core';
import {FormlyJsonschema} from "@ngx-formly/core/json-schema";
import {ResourceService} from "../../services/resource.service";

@Component({
    selector: 'app-dapp',
    templateUrl: './dapp.component.html',
    styleUrls: ['./dapp.component.css'],
})

export class DappComponent implements OnInit, AfterViewInit {

    tokens = [];
    actions = [];
    action: string;
    abiSmartContractActions = [];
    abiSmartContractStructs = [];
    schemaJSON: any;
    modelJSON: any;
    loading: boolean;
    errormsg: string;
    errormsg2: string;
    triggerAction = false;
    tokenModal: boolean;
    sendModal: boolean;
    busy: boolean;
    busy2: boolean;
    aux: number;
    contract: string;

    title: string;
    logo: string;
    description: string;
    actionInfo = [];
    actionShort: string;

    formVal: any;
    formVal2 = [];
    wrongpass: string;
    balance: number;
    price: number;
    name: number;
    symbol: string;
    searchForm: FormGroup;
    confirmForm: FormGroup;

    actionDesc: string;
    buttonActive: string;

    selectedAccountSubscription: Subscription;

    static isArray(what) {
        return Object.prototype.toString.call(what) === '[object Array]';
    }

    form: FormGroup;
    model: any;
    options: FormlyFormOptions;
    fields: FormlyFieldConfig[];

    constructor(
        public aService: AccountsService,
        private trxFactory: TransactionFactoryService,
        public eosjs: Eosjs2Service,
        private fb: FormBuilder,
        private cdr: ChangeDetectorRef,
        private crypto: CryptoService,
        private formlyJsonschema: FormlyJsonschema,
        private resource: ResourceService) {
        this.form = new FormGroup({
            fields: new FormControl(JSON.stringify(this.fields)),
        });

        this.searchForm = this.fb.group({
            search: ['', [Validators.maxLength(12)]],
        });

        this.confirmForm = this.fb.group({
            pass: ['', [Validators.required]],
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
        this.selectedAccountSubscription = this.aService.selected.asObservable().subscribe((sel: EOSAccount) => {
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
            this.tokens.push({contract: sc});
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
                this.tokens.push({contract: sc});
                this.loading = false;
            }).catch(() => {
                this.errormsg = 'Invalid Contract!';
                this.loading = false;
            });
        } else {
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
        try{
            this.form = new FormGroup({});
            this.options = {};
            this.fields = [];
            this.model = {};
        }catch (e) {
            console.log(e);
        }

        this.eosjs.getSymbolContract(this.contract).then(val => {
            this.symbol = val.rows[0].balance.split(' ')[1];
        }).catch(err => {
            console.log(token.name);
            if (token.name === '' || token.name === undefined) {
                this.symbol = this.aService.activeChain['symbol'];
            } else {
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
            } else {
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
            try{
                this.form = new FormGroup({});
                this.options = {};
                this.fields = [this.formlyJsonschema.toFieldConfig(this.schemaJSON.schema)];
                this.model = {};
            }catch (e) {
                console.log(e);
            }

            this.triggerAction = true;
        } else {
            this.triggerAction = false;
        }
        this.cdr.detectChanges();
    }

    schemaJson(type: string) {
        const out = {};
        this.abiSmartContractStructs.find(action => action.name === type).fields.forEach(field => {
            const arr = (field.type.indexOf('[]') > 0);
            const field_type = field.type.replace('[]', '');
            if (this.abiSmartContractStructs.find(act => act.name === field_type)) {
                const children = JSON.stringify(this.schemaJson(field_type));
                if (arr) {
                    out[field.name] = JSON.parse(
                        '{"title": "' + field.name.charAt(0).toUpperCase() + field.name.slice(1) + '", "type": "array", "items": {"type": "object", "properties": ' +
                        children + '}}');
                } else {
                    out[field.name] = JSON.parse(
                        '{"title": "' + field.name.charAt(0).toUpperCase() + field.name.slice(1) + '", "type": "object", "properties": ' + children + '}');
                }
            } else {
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
                    typeABI = '"type": "integer", "default":0';
                } else if (arr) {
                    if (intArr.includes(field.type)) {
                        typeABI = '"type": "number", "title": "' + field.name.charAt(0).toUpperCase() + field.name.slice(1) + '"';
                    } else {
                        typeABI = '"type": "string",  "title": "' + field.name.charAt(0).toUpperCase() + field.name.slice(1) + '", "key": "array_' + field.name.charAt(0).toUpperCase() + field.name.slice(1) + '"';
                    }
                } else {
                    typeABI = '"type": "string", "title": "' + field.name.charAt(0).toUpperCase() + field.name.slice(1) + '"';
                }
                const jsonTxt = '{ "title": "' + field.name.charAt(0).toUpperCase() + field.name.slice(1) + '", ' + typeABI + ' }';

                out[field.name] = JSON.parse(jsonTxt);
            }
        });
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
                    if (DappComponent.isArray(fullForm[idx])) {
                        fullForm[idx].sort();
                    }
                }
                if(fullForm[idx] === null){
                    fullForm[idx] = '';
                }
            }
            this.formVal = fullForm;

            this.pushAction().catch(console.log);
        }
    }


    async pushAction() {
        const [auth, publicKey] = this.trxFactory.getAuth();
        const trx = {actions: [{
            account: this.contract,
            name: this.action,
            authorization: [auth],
            data: this.formVal
        }]};
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
        const result = await this.trxFactory.launch(publicKey);
        console.log(result);
    }
}
