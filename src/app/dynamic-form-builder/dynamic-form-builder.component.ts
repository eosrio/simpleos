import {AfterViewInit, Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {FormControl, FormGroup, Validators} from '@angular/forms';
import {DappComponent} from '../dashboard/dapp/dapp.component';


@Component({
    templateUrl: 'dynamic-form-builder.component.html',
    selector: 'app-dynamic-form-builder',
    styles: [' .box-struct{} ' +
    '/deep/.mat-expansion-indicator::after { border-width: 0 3px 3px 0 !important; padding: 4px !important; color: rgba(0,121,184,.54) !important;} ' +
    '.mat-expansion-panel:not([class*=mat-elevation-z]) { border-bottom:1px solid rgba(0,121,184,1); box-shadow: none !important; background-color: transparent;width:100%; margin-top: 20px; } ' +
    '.mat-expansion-panel-header-title { color:#0079b8;} ' +
    '.mat-expansion-panel-header-description {color:#4d4d4d;}' +
    '.mat-expansion-panel-header { padding: 0px 5px;']
})
export class DynamicFormBuilderComponent implements OnInit, AfterViewInit {
    @Output() submit = new EventEmitter();
    @Input() fields: any[] = [];
    @Input() description = '';


    form: FormGroup;
    errormsg: string;
    busySend: boolean;
    openSub: boolean;


    constructor(public dapp: DappComponent) {
        this.openSub = false;
    }

    ngOnInit() {

        // console.log(this.fields);
        const fieldsCtrls = {};
        for (const f of this.fields) {
            for (const fs of f.fields) {
                //if (f.fields[0].type === 'text') {
                if (fs.typeDef === 'name' || fs.typeDef === 'account_name') {
                    const unamePattern = '^([a-z]|[1-5])+$';
                    fieldsCtrls[fs.nameField] = new FormControl('', [Validators.pattern(unamePattern), Validators.maxLength(12)]);
                } else {
                    fieldsCtrls[fs.nameField] = new FormControl('');
                }

                //} //else {

                // const opts = {};
                // //console.log(f.options);
                // for (const opt of f.options) {
                // 	opts[opt.key] = new FormControl(opt.value);
                // }
                // fieldsCtrls[f.name] = new FormGroup(opts);
                //}
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
        let req = {};
        this.dapp.formVal = [];
        this.dapp.formVal2 = [];

        const intArr = ['uint8', 'uint8_t', 'uint16', 'uint16_t', 'uint32', 'uint32_t', 'uint64', 'uint64_t', 'uint128', 'uint128_t', 'int8', 'int16', 'int32', 'int64', 'int128'];
        const strArr = ['name', 'asset', 'string', 'account_name'];
        const bolArr = ['bool'];
        console.log(this.fields);
        this.fields.forEach(f => {
            f.fields.forEach(fn => {
                let isStruct = false;
                let structName = '';
                const struct = fn.nameField.split('.');
                //console.log(struct[1]);

                if (struct.length > 1) {
                    structName = struct[1];
                    isStruct = true;
                    console.log(structName, req[structName]);
                    if (req[structName] === undefined) {
                        req[structName] = {};
                    }

                }

                // Other parsing
                if (!strArr.includes(fn.typeDef) && !intArr.includes(fn.typeDef) && !bolArr.includes(fn.typeDef)) {
                    if (isStruct)
                        req[structName][fn.name] = form['controls'][fn.nameField].value.trim();
                    else
                        req[fn.name] = form['controls'][fn.nameField].value.trim();
                    this.dapp.formVal2.push(fn.nameField + ': ' + form['controls'][fn.nameField].value + ' (' + fn.typeDef + ')');
                }

                // String parsing
                if (strArr.includes(fn.typeDef)) {
                    if (isStruct)
                        req[structName][fn.name] = form['controls'][fn.nameField].value.trim();
                    else
                        req[fn.name] = form['controls'][fn.nameField].value.trim();
                    this.dapp.formVal2.push(fn.nameField + ': ' + form['controls'][fn.nameField].value + ' (' + fn.typeDef + ')');
                }

                // Integer parsing
                if (intArr.includes(fn.typeDef)) {
                    if (isStruct)
                        req[structName][fn.name] = parseInt(form['controls'][fn.nameField].value, 10);
                    else
                        req[fn.name] = parseInt(form['controls'][fn.nameField].value, 10);

                    this.dapp.formVal2.push(fn.nameField + ': ' + form['controls'][fn.nameField].value + ' (' + fn.typeDef + ')');
                }

                // Boolear parsing
                if (bolArr.includes(fn.typeDef)) {
                    if (form['controls'][fn.nameField].value === 'true' || form['controls'][fn.nameField].value === '1') {
                        if (isStruct)
                            req[structName][fn.name] = 1;
                        else
                            req[fn.name] = 1;
                    } else if (form['controls'][fn.nameField].value === 'false' || form['controls'][fn.nameField].value === '0') {
                        if (isStruct)
                            req[structName][fn.name] = 0;
                        else
                            req[fn.name] = 0;
                    } else {
                        if (isStruct)
                            req[structName][fn.name] = 0;
                        else
                            req[fn.name] = 0;
                    }
                    this.dapp.formVal2.push(fn.nameField + ': ' + form['controls'][fn.nameField].value + ' (' + fn.typeDef + ')');
                }

                // Multiline string
                if (fn.multiline) {
                    if (form['controls'][fn.nameField].value !== '') {
                        if (isStruct)
                            req[structName][fn.name] = form['controls'][fn.nameField].value.split(',').sort();
                        else
                            req[fn.name] = form['controls'][fn.nameField].value.split(',').sort();

                        this.dapp.formVal2.push(fn.nameField + ': ' + form['controls'][fn.nameField].value + ' (' + fn.typeDef + ')');
                    } else {
                        if (isStruct)
                            req[structName][fn.name] = [];
                        else
                            req[fn.name] = [];

                        this.dapp.formVal2.push(fn.nameField + ': ' + '[]');
                    }
                }


                console.log(fn.nameField);
                console.log(form['controls'][fn.nameField].value);
            })
        });
        //console.log(Object.keys(form['controls']['']));
        Object.keys(form['controls']).forEach((k) => {
            const value: string = form['controls'][k]['value'];
            // const nameField: any = k.split('.');
            // let field = [];
            // let field2:any[] = [];
            // // console.log(nameField[1]);
            //
            // if(nameField[1]){
            // 	field2 = this.fields.find(f => f.name === nameField[1])['fields'];
            // 	field = field2.find(f => f.name === nameField[0]);
            // }else{
            // 	field = this.fields.find(f => f.name === k).fields[0];
            //
            // }
            // const type = field['typeDef'];
            // const name = field['name'];
            // console.log(k, value, type, field);
            //
            // // Integer parsing
            // if (intArr.includes(type)) {
            // 	req[name] = parseInt(value, 10);
            // 	this.dapp.formVal2.push(k + ': ' + value + ' (' + type + ')');
            // }
            //
            // // Boolear parsing
            // if (bolArr.includes(type)) {
            // 	if (value === 'true' || value === '1') {
            // 		req[name] = 1;
            // 	} else if (value === 'false' || value === '0') {
            // 		req[name] = 0;
            // 	} else {
            // 		req[name] = 0;
            // 	}
            // 	this.dapp.formVal2.push(k + ': ' + value + ' (' + type + ')');
            // }
            //
            // // Multiline string
            // if (field['multiline']) {
            // 	if (value !== '') {
            // 		req[name] = value.split(',').sort();
            // 		this.dapp.formVal2.push(k + ': ' + value + ' (' + type + ')');
            // 	} else {
            // 		req[name] = [];
            // 		this.dapp.formVal2.push(k + ': ' + '[]');
            // 	}
            // }
            //
            // // String parsing
            // if (strArr.includes(type)) {
            // 	req[name] = value.trim();
            // 	this.dapp.formVal2.push(k + ': ' + value + ' (' + type + ')');
            // }

        });
        console.log(this.dapp.formVal2);
        console.log(req);
        this.dapp.formVal = req;
        this.dapp.sendModal = true;
    }
}
