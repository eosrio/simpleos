"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
var core_1 = require("@angular/core");
var fusejs_service_1 = require("./fusejs.service");
var fusejs_pipe_1 = require("./fusejs.pipe");
var FuseJsModule = /** @class */ (function () {
    function FuseJsModule() {
    }
    FuseJsModule = __decorate([
        core_1.NgModule({
            providers: [
                fusejs_service_1.FusejsService
            ],
            declarations: [
                fusejs_pipe_1.FusejsPipe,
            ],
            exports: [
                fusejs_pipe_1.FusejsPipe,
            ]
        })
    ], FuseJsModule);
    return FuseJsModule;
}());
exports.FuseJsModule = FuseJsModule;
//# sourceMappingURL=fusejs.module.js.map