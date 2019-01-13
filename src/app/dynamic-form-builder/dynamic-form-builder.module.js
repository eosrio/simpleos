"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var core_1 = require("@angular/core");
var platform_browser_1 = require("@angular/platform-browser");
var forms_1 = require("@angular/forms");
var material_1 = require("@angular/material");
var angular2_text_mask_1 = require("angular2-text-mask");
// components
var dynamic_form_builder_component_1 = require("./dynamic-form-builder.component");
var field_builder_component_1 = require("./field-builder/field-builder.component");
var textbox_1 = require("./atoms/textbox");
var DynamicFormBuilderModule = /** @class */ (function () {
    function DynamicFormBuilderModule() {
    }
    DynamicFormBuilderModule = __decorate([
        core_1.NgModule({
            imports: [
                platform_browser_1.BrowserModule,
                forms_1.FormsModule,
                forms_1.ReactiveFormsModule,
                material_1.MatAutocompleteModule,
                material_1.MatCheckboxModule,
                material_1.MatFormFieldModule,
                material_1.MatInputModule,
                material_1.MatRadioModule,
                material_1.MatSelectModule,
                material_1.MatSliderModule,
                material_1.MatTabsModule,
                material_1.MatButtonToggleModule,
                forms_1.ReactiveFormsModule,
                angular2_text_mask_1.TextMaskModule
            ],
            declarations: [
                dynamic_form_builder_component_1.DynamicFormBuilderComponent,
                field_builder_component_1.FieldBuilderComponent,
                textbox_1.TextBoxComponent
            ],
            exports: [dynamic_form_builder_component_1.DynamicFormBuilderComponent],
            providers: []
        })
    ], DynamicFormBuilderModule);
    return DynamicFormBuilderModule;
}());
exports.DynamicFormBuilderModule = DynamicFormBuilderModule;
//# sourceMappingURL=dynamic-form-builder.module.js.map