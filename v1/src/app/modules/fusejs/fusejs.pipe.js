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
var core_1 = require("@angular/core");
var fusejs_service_1 = require("./fusejs.service");
var FusejsPipe = /** @class */ (function () {
    function FusejsPipe(fjs) {
        this.fjs = fjs;
    }
    FusejsPipe.prototype.transform = function (elements, searchTerms, options) {
        if (options === void 0) { options = {}; }
        return this.fjs.searchList(elements, searchTerms, options);
    };
    FusejsPipe = __decorate([
        core_1.Pipe({ name: 'fusejs' }),
        __metadata("design:paramtypes", [fusejs_service_1.FusejsService])
    ], FusejsPipe);
    return FusejsPipe;
}());
exports.FusejsPipe = FusejsPipe;
//# sourceMappingURL=fusejs.pipe.js.map