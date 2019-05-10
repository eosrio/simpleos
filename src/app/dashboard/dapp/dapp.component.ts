import {Component, OnInit, AfterViewInit, Type, ComponentFactoryResolver, ViewChild, ViewContainerRef} from '@angular/core';
import {FormBuilder, FormGroup, FormControl, Validators} from '@angular/forms';
import {AccountsService} from '../../services/accounts.service';
import {EOSJSService} from '../../services/eosjs.service';
import {EOSAccount} from '../../interfaces/account';
import {CryptoService} from '../../services/crypto.service';
import {BodyOutputType, Toast, ToasterConfig, ToasterService} from 'angular2-toaster';
import {Subscription} from 'rxjs';

@Component({
	selector: 'app-dapp',
	templateUrl: './dapp.component.html',
	styleUrls: ['./dapp.component.css']
})

export class DappComponent implements OnInit, AfterViewInit {

	// @ViewChild('dForm', {read: ViewContainerRef}) dForm: ViewContainerRef;
	//
	// componentClass = FormComponent;

	components = [];
	fullBalance: number;
	tokens = [];
	actions = [];
	action: string;
	abiSmartContractActions = [];
	abiSmartContractStructs = [];
	exampleJsonObject: any;
	schemaJSON: any;
	formJSON: any;
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
	form: FormGroup;
	searchForm: FormGroup;
	confirmForm: FormGroup;
	config: ToasterConfig;


	actionDesc: string;
	buttonActive: string;
	public fields: any;
	public fields2: any[] = [];

	selectedAccountSubscription: Subscription;

	constructor(public aService: AccountsService,
				public eos: EOSJSService,
				private fb: FormBuilder,
				private componentFactoryResolver: ComponentFactoryResolver,
				private toaster: ToasterService,
				private crypto: CryptoService) {
		this.form = new FormGroup({
			fields: new FormControl(JSON.stringify(this.fields))
		});
		this.searchForm = this.fb.group({
			search: ['', [Validators.maxLength(12)]]
		});
		this.confirmForm = this.fb.group({
			pass: ['', [Validators.required, Validators.minLength(10)]]
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

	private showToast(type: string, title: string, body: string) {
		this.config = new ToasterConfig({
			positionClass: 'toast-top-right',
			timeout: 10000,
			newestOnTop: true,
			tapToDismiss: true,
			preventDuplicates: false,
			animation: 'slideDown',
			limit: 1,
		});
		const toast: Toast = {
			type: type,
			title: title,
			body: body,
			timeout: 10000,
			showCloseButton: true,
			bodyOutputType: BodyOutputType.TrustedHtml,
		};
		this.toaster.popAsync(toast);
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
			this.eos.getSCAbi(sc).then(data => {
				this.setActions(data['abi']);
				this.setStructs(data['abi']);
				this.tokens.push({contract: sc});
				this.loading = false;
			}).catch(err => {
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
		// this.form.reset();
		// this.form.removeControl(JSON.stringify(this.fields));
		// this.removeComponent(this.componentClass);
		this.triggerAction = false;
		this.contract = token.contract;
		this.balance = token.balance;
		this.price = token.price;
		this.name = token.name;
		this.symbol = '';
		this.formJSON = {};
		this.eos.getSymbolContract(this.contract).then(val => {
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


		/*this.description = "Lorem ipsum dolor sit amet lipsum"+
		 "ipsum dolor sit amet lipsum ipsum dolor sit amet lipsum"+
		 "ipsum dolor sit amet lipsum ipsum dolor sit amet lipsum"+
		 "ipsum dolor sit amet lipsum ipsum dolor sit amet lipsum";
		*/

		this.eos.getSCAbi(this.contract).then(data => {
			// console.log(data);
			this.setActions(data['abi']);
			this.setStructs(data['abi']);
			this.busy = false;
		}).catch(err => {
			console.log(err);
		});

		this.eos.getDappMetaData(this.contract).then(info => {
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
		// this.eos.getSCAbi(this.contract);
	}

	getForm(actionType, actionName) {

		this.buttonActive = actionName;
		this.actionDesc = '';
		this.fields2 = [];
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

			const ModelJson = this.modelJson(actionType);
			const SchemaJSON = this.schemaJson(actionType);
			const FormJSON = this.formJson(actionType, '');
			FormJSON.push({'type': 'submit', 'style': 'btn btn-outline btn-info-outline', 'title': 'PUSH ACTION'});
			// newFormJSON.push(
			// 	{
			// 		"type": "submit",
			// 		"style": "btn-info",
			// 		"title": "OK"
			// 	});
			// this.formJSON = ModelJson;
			this.formJSON = {
				'schema': {
					'type': 'object',
					'title': actionType,
					'properties': SchemaJSON
				}
			};
			// this.formJSON ={
			// 	"schema": {
			// 		"type": "object",
			// 		"title": actionType,
			// 		"properties": SchemaJSON
			// 	},
			// 	"form": FormJSON
			// };
			// console.log("------>",JSON.stringify(SchemaJSON));
			console.log('------>', this.formJSON);
			// console.log("------>",JSON.stringify(ModelJson));

			this.triggerAction = true;
		} else {
			this.triggerAction = false;
		}
	}

	schemaJson(type: string) {
		const out = {};
		this.abiSmartContractStructs.find(action => action.name === type).fields.forEach(field => {
			const arr = (field.type.indexOf('[]') > 0);
			const field_type = field.type.replace('[]', '');
			if (this.abiSmartContractStructs.find(act => act.name === field_type)) {
				const children = JSON.stringify(this.schemaJson(field_type));
				if (arr) {
					out[field.name] = JSON.parse('{"title": "' + field.name + '", "type": "array", "items": {"type": "object", "properties": ' + children + '}}');
				} else {
					out[field.name] = JSON.parse('{"title": "' + field.name + '", "type": "object", "properties": ' + children + '}');
				}
			} else {
				const intArr = ['uint8', 'uint8_t', 'uint16', 'uint16_t', 'uint32', 'uint32_t', 'uint64', 'uint64_t', 'uint128', 'uint128_t', 'int8', 'int16', 'int32', 'int64', 'int128', 'bool'];
				let typeABI = '';
				if (intArr.includes(field.type)) {
					// typeABI = "number";
					typeABI = '"widget": "text", "type": "number"';
				} else if (arr) {
					// typeABI = "array";
					typeABI = '"type": "array", "items": { "widget": "text", "type":"string", "title": "' + field.name + '" } ';
				} else {
					// typeABI = "string";
					typeABI = '"widget": "text", "type": "string"';
				}
				const jsonTxt = '{ "title": "' + field.name + '", ' + typeABI + ' }';

				out[field.name] = JSON.parse(jsonTxt);
			}
		});
		return out;
	}

	modelJson(type: string) {
		let out = {};
		this.abiSmartContractStructs.find(action => action.name === type).fields.forEach(field => {
			const field_type = field.type.replace('[]', '');
			if (this.abiSmartContractStructs.find(act => act.name === field_type)) {
				const children = this.modelJson(field_type);
				out[field.name] = [children];
			} else {
				out[field.name] = '';
			}
		});
		return out;
	}

	formJson(type: string, name: string) {
		let out = [];
		this.abiSmartContractStructs.find(action => action.name === type).fields.forEach(field => {
			const field_type = field.type.replace('[]', '');

			if (this.abiSmartContractStructs.find(act => act.name === field_type)) {
				const children = JSON.stringify(this.formJson(field_type, field.name));
				if (name !== '') {
					out.push(JSON.parse('{"key": "' + name + '[].' + field.name + '","add": "New","style": {"add": "btn-success"},"items":' + children + '}'));
				} else {
					out.push(JSON.parse('{"key": "' + field.name + '","add": "New","style": {"add": "btn-success"},"items":' + children + '}'));
				}

			} else {
				if (name !== '') {
					out.push(JSON.parse('{"key": "' + name + '[].' + field.name + '","placeholder": "' + field.name + '","widget": "text","type": "text","title": "' + field.name + '","htmlClass":"mat-my-class"}'));
				} else {
					out.push(JSON.parse('{"key": "' + field.name + '","placeholder": "' + field.name + '","widget": "text","type": "text","title": "' + field.name + '","htmlClass":"mat-my-class"}'));
				}
			}
		});
		return out;
	}

	formFilled(ev) {
		this.formVal = ev;
	}

	pushAction() {

		this.busy = true;
		this.busy2 = true;
		this.wrongpass = '';
		this.errormsg2 = '';

		const account = this.aService.selected.getValue();
		const accountName = this.aService.selected.getValue().name;
		const password = this.confirmForm.get('pass').value;
		const pubkey = account.details['permissions'][0]['required_auth'].keys[0].key;

		this.crypto.authenticate(password, pubkey).then((data) => {
			if (data === true) {
				this.eos.pushActionContract(this.contract, this.action, this.formVal, accountName).then((info) => {
					this.tokenModal = false;
					this.busy2 = false;
					this.sendModal = false;
					console.log(info);
					this.showToast('success', 'Transation broadcasted', 'Check your history for confirmation.');
				}).catch(error => {
					console.log(error);
					this.wrongpass = JSON.stringify(JSON.parse(error).error.details[0].message);
				});
				this.busy = false;
			}
		}).catch(error2 => {
			console.log(error2);
			this.wrongpass = 'Wrong password!';
			this.busy = false;
		});
	}

}
