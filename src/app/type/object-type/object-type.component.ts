import { Component } from '@angular/core';
import {FieldType} from "@ngx-formly/core";

@Component({
  selector: 'app-object-type',
  templateUrl: './object-type.component.html',
  styleUrls: ['./object-type.component.css']
})

export class ObjectTypeComponent extends FieldType  {constructor() {
  super();
}}
