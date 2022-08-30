"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThousandSuffixesPipe = void 0;
const core_1 = require("@angular/core");
let ThousandSuffixesPipe = class ThousandSuffixesPipe {
    transform(input, args) {
        let exp;
        const suffixes = ['k', 'M', 'G', 'T', 'P', 'E'];
        if (Number.isNaN(input)) {
            return null;
        }
        if (input < 1000) {
            return input;
        }
        exp = Math.floor(Math.log(input) / Math.log(1000));
        return (input / Math.pow(1000, exp)).toFixed(args) + suffixes[exp - 1];
    }
};
ThousandSuffixesPipe = __decorate([
    (0, core_1.Pipe)({
        name: 'thousandSuff'
    })
], ThousandSuffixesPipe);
exports.ThousandSuffixesPipe = ThousandSuffixesPipe;
//# sourceMappingURL=thousand-suffixes.pipe.js.map