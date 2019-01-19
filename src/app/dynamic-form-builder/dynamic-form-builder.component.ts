import {AfterViewInit, Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {FormControl, FormGroup, Validators} from '@angular/forms';
import {DappComponent} from '../dashboard/dapp/dapp.component';
import {EOSJSService} from '../services/eosjs.service';


@Component({
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
})
export class DynamicFormBuilderComponent implements OnInit, AfterViewInit {
	@Output() submit = new EventEmitter();
	@Input() fields: any[] = [];
	@Input() description = '';
	form: FormGroup;
	errormsg: string;
	busySend: boolean;

	constructor(public dapp: DappComponent, public eos: EOSJSService) {
	}

	ngOnInit() {
		const fieldsCtrls = {};
		for (const f of this.fields) {
			// console.log(f);
			if (f.type === 'text') {
				if (f.typeDef === 'name' || f.typeDef === 'account_name') {
					const unamePattern = '^([a-z]|[1-5])+$';
					fieldsCtrls[f.name] = new FormControl(f.value || '', [Validators.pattern(unamePattern), Validators.maxLength(12)]);
				} else {
					fieldsCtrls[f.name] = new FormControl(f.value || '');
				}
			} else {
				const opts = {};
				console.log(f.options);
				for (const opt of f.options) {
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
		this.busySend = this.dapp.busy2;
		this.errormsg = this.dapp.errormsg2;
		const req = {};
		this.dapp.formVal = [];
		this.dapp.formVal2 = [];
		const intArr = ['uint8', 'uint8_t', 'uint16', 'uint16_t', 'uint32', 'uint32_t', 'uint64', 'uint64_t', 'uint128', 'uint128_t', 'int8', 'int16', 'int32', 'int64', 'int128'];
		const strArr = ['name', 'asset', 'string', 'account_name'];
		const bolArr = ['bool'];
		Object.keys(form['controls']).forEach((k) => {
			const value: string = form['controls'][k]['value'];
			const field = this.fields.find(f => f.name === k);
			const type = field.typeDef;

			console.log(k, value, type, field);

			// Integer parsing
			if (intArr.includes(type)) {
				req[k] = parseInt(value, 10);
				this.dapp.formVal2.push(k + ': ' + value + ' (' + type + ')');
			}

			// Boolear parsing
			if (bolArr.includes(type)) {
				if (value === 'true' || value === '1') {
					req[k] = 1;
				} else if (value === 'false' || value === '0') {
					req[k] = 0;
				} else {
					req[k] = 0;
				}
				this.dapp.formVal2.push(k + ': ' + value + ' (' + type + ')');
			}

			// Multiline string
			if (field.multiline) {
				if (value !== '') {
					req[k] = value.split(',');
					this.dapp.formVal2.push(k + ': ' + value + ' (' + type + ')');
				} else {
					req[k] = [];
					this.dapp.formVal2.push(k + ': ' + '[]');
				}
			}

			// String parsing
			if (strArr.includes(type)) {
				req[k] = value.trim();
				this.dapp.formVal2.push(k + ': ' + value + ' (' + type + ')');
			}
		});
		console.log(req);
		this.dapp.formVal = req;
		this.dapp.sendModal = true;
	}
}
