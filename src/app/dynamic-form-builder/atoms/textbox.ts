import {Component, OnInit,AfterViewInit, Input} from '@angular/core';
import {FormGroup} from '@angular/forms';

// text,email,tel,textarea,password,
@Component({
	template:
		'<div [formGroup]="form" style="margin-top:10px !important;" >' +
		'	<label for="{{field.label}}"  style="color:#0094d2 !important;text-transform: uppercase !important;padding: 0px 5px;">{{field.label}}</label>' +
		'	<div class=" md-form input-group " #allFields>' +
		'		<input [attr.type]="field.type"  [id]="field.nameField" [name]="field.nameField" [value]="!field.optionValue?field.value:\'\'" [formControlName]="field.nameField" placeholder="Type: {{field.typeDef}}" style="border-bottom:1px solid #0094d2 !important; width:100%;" ngDefaultControl>' +
		'		<button *ngIf="field.optionValue" style="position: relative;float:right;right: 0px;top: -35px;border-color: #0079b8;background-color: transparent;color: #0079b8;border-radius: .125rem;" (click)="showUser(field.nameField,field.value)" type="button">This User</button>' +
		'	</div>' +
		'</div>',
	selector: 'textbox',
	styles: [' .hide{display:none;} .show{display:block;} .expand{margin-left: 100px; transition: color 0.4s ease 0s, background-color 0.4s ease 0s, display 0.4s ease 0s;} ']
})
export class TextBoxComponent {
	@Input() field: any = {};
	@Input() form: FormGroup;

	// [textMask]="{mask: maskArray}"
	// maskArray = ['\[','\"','[0-9]{1,12}','\.','[0-9]{4}','\s','[A-Z]{1,12}','\"','?','(','\,','\"','[0-9]{1,12}','\.','[0-9]{4}','\s','[A-Z]{1,12}','\"',')','{0,10}','\]'];
	get isValid() {
		return this.form.controls[this.field.nameField].valid;
	}

	get isDirty() {
		return this.form.controls[this.field.nameField].dirty;
	}

	constructor() {

	}

	ngOnInit() {

	}

	showUser(name: string,value: string){
		this.form.controls[name].setValue(value);
	}

}
