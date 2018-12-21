import {Component, OnInit, AfterViewInit, Type, ComponentFactoryResolver, ViewChild, ViewContainerRef} from '@angular/core';
import {FormBuilder, FormGroup, FormControl, Validators} from '@angular/forms';
import {AccountsService} from '../../accounts.service';
import {EOSJSService} from '../../eosjs.service';
import {EOSAccount} from '../../interfaces/account';
import {CryptoService} from '../../services/crypto.service';
import {BodyOutputType, Toast, ToasterConfig, ToasterService} from 'angular2-toaster';

@Component({
	selector: 'app-dapp',
	templateUrl: './dapp.component.html',
	styleUrls: ['./dapp.component.css']
})

export class DappComponent implements OnInit, AfterViewInit {

	@ViewChild('dForm', {read: ViewContainerRef}) dForm: ViewContainerRef;

	componentClass = FormComponent;

	components = [];
	fullBalance: number;
	tokens = [];
	actions = [];
	action: string;
	abiSmartContractActions = [];
	abiSmartContractStructs = [];
	loading: boolean;
	errormsg: string;
	errormsg2: string;
	triggerAction = false;
	tokenModal: boolean;
	sendModal: boolean;
	busy: boolean;
	busy2: boolean;
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
	form: FormGroup;
	searchForm: FormGroup;
	confirmForm: FormGroup;
	config: ToasterConfig;


	actionDesc: string;
	public fields: any[];

	constructor(public aService: AccountsService,
				public eos: EOSJSService,
				private fb: FormBuilder,
				private componentFactoryResolver: ComponentFactoryResolver,
				private toaster: ToasterService,
				private crypto: CryptoService,) {
		this.form = new FormGroup({
			fields: new FormControl(JSON.stringify(this.fields))
		});
		this.searchForm = this.fb.group({
			search: ['', [Validators.maxLength(12)]]//Validators.minLength(12),
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
	}

	addComponent(componentClass: Type<any>) {
		const componentFactory = this.componentFactoryResolver.resolveComponentFactory(componentClass);
		const component = this.dForm.createComponent(componentFactory);

		this.components.push(component);
	}

	removeComponent(componentClass: Type<any>) {
		const component = this.components.find((component) => component.instance instanceof componentClass);
		const componentIndex = this.components.indexOf(component);

		if (componentIndex !== -1) {
			this.dForm.remove(this.dForm.indexOf(component));
			this.components.splice(componentIndex, 1);
		}
	}

	ngOnInit() {
		this.loading = true;
		this.sendModal = false;
		this.busy = false;
	}

	ngAfterViewInit() {
		this.aService.selected.asObservable().subscribe((sel: EOSAccount) => {
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
			this.loading = false;
		}, 1500);
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
				console.log(data);
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

		this.eos.getSCAbi(this.contract).then(data => {
			// console.log(data);
			this.setActions(data['abi']);
			this.setStructs(data['abi']);
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

	getForm(actionType) {
		this.actionDesc = '';
		this.busy = false;
		if (this.abiSmartContractStructs.find(action => action.name == actionType).fields.length > 0) {
			this.fields = [];
			this.action = actionType;
			if (this.actionInfo) {
				if (this.actionInfo['long_desc']) {
					this.actionDesc = actionType.toUpperCase() + ' ' + this.actionInfo['long_desc'];
				}
			}
			this.removeComponent(this.componentClass);
			this.abiSmartContractStructs.find(action => action.name == actionType).fields.forEach(field => {
				console.log(field.type.indexOf('[]'));
				const line = (field.type.indexOf('[]') > 0);

				this.fields.push({
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
			this.form = new FormGroup({
				fields: new FormControl(JSON.stringify(this.fields))
			});
		} else {
			this.triggerAction = false;
			this.removeComponent(this.componentClass);
			this.form.removeControl(JSON.stringify(this.fields));
		}
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
					this.busy = false;
					this.busy2 = false;
					this.sendModal = false;
					console.log(info);
					this.showToast('success', 'Transation broadcasted', 'Check your history for confirmation.');
				}).catch(error => {
					this.wrongpass = 'Error: ' + JSON.stringify(JSON.parse(error).error.details[0].message);
				});
				this.busy = false;
			}
		}).catch(error2 => {
			this.wrongpass = 'Wrong password!';
			this.busy = false;
		});
	}

}

// Example component (can be any component e.g. app-header app-section)
@Component({
	selector: 'my-form',
	template: '<dynamic-form-builder [fields]="getFields()" [description]="getActionDescription()"></dynamic-form-builder>'
})

export class FormComponent {
	public fields: any[];
	public description: string;

	constructor(public dApps: DappComponent) {
		this.fields = dApps.fields;
		this.description = dApps.actionDesc;
	}

	getFields() {
		return this.fields;
	}

	getActionDescription() {
		return this.description;
	}

}
