import { Component } from '@angular/core';
import {FieldArrayType } from "@ngx-formly/core";

@Component({
  selector: 'app-array-type',
  templateUrl: './array-type.component.html',
  styleUrls: ['./array-type.component.css']
})

export class ArrayTypeComponent extends FieldArrayType  {constructor() {
    super();
}}
