import {Component, Input, OnInit, Output, EventEmitter, AfterViewInit} from '@angular/core';
import {FormGroup, FormControl, Validators} from '@angular/forms';
import {DappComponent} from '../dashboard/dapp/dapp.component';
import {EOSJSService} from '../eosjs.service';


@Component({
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
})
export class DynamicFormBuilderComponent implements OnInit, AfterViewInit {
	@Output() onSubmit = new EventEmitter();
	@Input() fields: any[] = [];
	@Input() description: string = '';
	form: FormGroup;
	errormsg: string;
	busySend: boolean;

	constructor(public dapp: DappComponent, public eos: EOSJSService) {
	}

	ngOnInit() {
		let fieldsCtrls = {};
		for (let f of this.fields) {
			// console.log(f);
			if (f.type === 'text') {
				if (f.typeDef === 'name' || f.typeDef === 'account_name') {
					let unamePattern = '^([a-z]|[1-5])+$';
					fieldsCtrls[f.name] = new FormControl(f.value || '', [Validators.required, Validators.pattern(unamePattern), Validators.maxLength(12)]);
				} else {
					fieldsCtrls[f.name] = new FormControl(f.value || '', Validators.required);
				}
			} else {
				let opts = {};
				for (let opt of f.options) {
					opts[opt.key] = new FormControl(opt.value);
				}
				fieldsCtrls[f.name] = new FormGroup(opts);
			}
		}
		this.form = new FormGroup(fieldsCtrls);
	}

	ngAfterViewInit(): void {
		this.errormsg = this.dapp.errormsg2;
	}

	pushFormAction(form) {
		console.log(form['controls']);
		this.busySend = this.dapp.busy2;
		this.errormsg = this.dapp.errormsg2;
		let other2 = form['value'];
		this.dapp.formVal = [];
		this.dapp.formVal2 = [];
		let intArr = ['uint8', 'uint8_t', 'uint16', 'uint16_t', 'uint32', 'uint32_t', 'uint64', 'uint64_t', 'uint128', 'uint128_t', 'int8', 'int16', 'int32', 'int64', 'int128'];
		let strArr = ['name', 'asset', 'string'];
		let bolArr = ['bool'];
		for (let val2 in form['controls']) {

			if (intArr.indexOf(this.fields.find(f => f.name === val2).typeDef) > 0) {
				other2[val2] = parseInt(form['controls'][val2]['value']);
			}

			if (bolArr.indexOf(this.fields.find(f => f.name === val2).typeDef) > 0) {
				if (form['controls'][val2]['value'] === 'true' || form['controls'][val2]['value'] === '1') {
					other2[val2] = true;
				} else if (form['controls'][val2]['value'] === 'false' || form['controls'][val2]['value'] === '0') {
					other2[val2] = false;
				} else {
					other2[val2] = false;
				}
			}

			if (this.fields.find(f => f.name === val2).multiline) {
				other2[val2] = (form['controls'][val2]['value']).split(',');
			}

			this.dapp.formVal2.push(val2 + ': ' + form['controls'][val2]['value']);
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
	}
}
