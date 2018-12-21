import {Component, Input} from '@angular/core';
import {FormGroup} from '@angular/forms';

// text,email,tel,textarea,password,
@Component({
	template: '<div class="col-md-9" [formGroup]="form" style="margin-top:10px !important;" >' +
		'         <label for="{{field.label}}"  style="color:#0094d2 !important;text-transform: uppercase !important;">{{field.label}}</label>' +
		'         <div class=" md-form input-group mb-9">' +
		'           <input [attr.type]="field.type" class="col-md-9" [id]="field.name" [name]="field.name" [formControlName]="field.name" placeholder="Type: {{field.typeDef}}" style="border-bottom:1px solid #0094d2 !important;">' +
		'         </div>' +
		'        </div>',
	selector: 'textbox'
})
export class TextBoxComponent {
	@Input() field: any = {};
	@Input() form: FormGroup;
	// [textMask]="{mask: maskArray}"
	// maskArray = ['\[','\"','[0-9]{1,12}','\.','[0-9]{4}','\s','[A-Z]{1,12}','\"','?','(','\,','\"','[0-9]{1,12}','\.','[0-9]{4}','\s','[A-Z]{1,12}','\"',')','{0,10}','\]'];
	get isValid() {
		return this.form.controls[this.field.name].valid;
	}

	get isDirty() {
		return this.form.controls[this.field.name].dirty;
	}

	constructor() {

	}

}
