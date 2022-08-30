"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectTypeComponent = void 0;
const core_1 = require("@angular/core");
const core_2 = require("@ngx-formly/core");
let ObjectTypeComponent = class ObjectTypeComponent extends core_2.FieldType {
    constructor() {
        super();
    }
};
ObjectTypeComponent = __decorate([
    (0, core_1.Component)({
        selector: 'app-object-type',
        templateUrl: './object-type.component.html',
        styleUrls: ['./object-type.component.css']
    }),
    __metadata("design:paramtypes", [])
], ObjectTypeComponent);
exports.ObjectTypeComponent = ObjectTypeComponent;
//# sourceMappingURL=object-type.component.js.map