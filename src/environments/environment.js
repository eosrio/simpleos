"use strict";
// This file can be replaced during build by using the `fileReplacements` array.
// `ng build ---prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.
Object.defineProperty(exports, "__esModule", { value: true });
exports.environment = void 0;
const _secret_1 = require("./_secret");
exports.environment = {
    production: false,
    VERSION: require('../../package.json').version,
    COMPILERVERSION: require('../../package.json').compilerVersion,
    JWT_TOKEN: _secret_1.s1
};
/*
 * In development mode, to ignore zone related error stack frames such as
 * `zone.run`, `zoneDelegate.invokeTask` for easier debugging, you can
 * import the following file, but please comment it out in production mode
 * because it will have performance impact when throw error
 */
require("zone.js/dist/zone-error"); // Included with Angular CLI.
//# sourceMappingURL=environment.js.map