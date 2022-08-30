"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.environment = void 0;
const _secret_1 = require("./_secret");
exports.environment = {
    production: true,
    VERSION: require('../../package.json').version,
    COMPILERVERSION: require('../../package.json').compilerVersion,
    JWT_TOKEN: _secret_1.s1
};
//# sourceMappingURL=environment.prod.js.map