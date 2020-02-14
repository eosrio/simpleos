import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {ReactiveFormsModule, FormsModule} from '@angular/forms';

import {FontAwesomeModule} from '@fortawesome/angular-fontawesome';



import {TextMaskModule} from 'angular2-text-mask';

// components
import {DynamicFormBuilderComponent} from './dynamic-form-builder.component';
import {FieldBuilderComponent} from './field-builder/field-builder.component';
import {TextBoxComponent} from './atoms/textbox';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatButtonToggleModule} from '@angular/material/button-toggle';
import {MatAutocompleteModule} from '@angular/material/autocomplete';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatSelectModule} from '@angular/material/select';
import {MatInputModule} from '@angular/material/input';
import {MatTabsModule} from '@angular/material/tabs';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatRadioModule} from '@angular/material/radio';
import {MatSliderModule} from '@angular/material/slider';

@NgModule({
	imports: [
		BrowserModule,
		FormsModule,
		ReactiveFormsModule,
		MatAutocompleteModule,
		MatCheckboxModule,
		MatFormFieldModule,
		MatInputModule,
		MatRadioModule,
		MatSelectModule,
		MatSliderModule,
		MatTabsModule,
		MatButtonToggleModule,
		MatExpansionModule,
		ReactiveFormsModule,
		TextMaskModule,
		FontAwesomeModule
	],
	declarations: [
		DynamicFormBuilderComponent,
		FieldBuilderComponent,
		TextBoxComponent
	],
	exports: [DynamicFormBuilderComponent],
	providers: []
})
export class DynamicFormBuilderModule {

}
