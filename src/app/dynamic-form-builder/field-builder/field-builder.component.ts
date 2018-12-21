import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'field-builder',
  template: '<div class="form-row" [formGroup]="form">' +
    //'    <div class="col-md-9" [ngSwitch]="field.type">' +
    '       <textbox [field]="field" [form]="form"></textbox>' +
    //'       <textbox *ngSwitchCase="\'text\'" class="float:left;width:70%;" [field]="field" [form]="form"></textbox>' +
    '       <div class="text-danger fadeInDown animated" style="margin-bottom: 10px!important;" *ngIf="!isValid"><b>* is required</b></div>' +
    //'    </div>'+
    '  </div>'
})
export class FieldBuilderComponent implements OnInit {
  @Input() field:any;
  @Input() form:any;

  get isValid() { return this.form.controls[this.field.name].valid; }
  get isDirty() { return this.form.controls[this.field.name].dirty; }

  constructor() { }

  ngOnInit() {
  }

}
