"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
class Logger {
    static info(text) {
        const timestamp = (new Date()).toISOString();
        console.log(`[INFO] - ${timestamp} - ${text}`);
    }
    static warn(text) {
        const timestamp = (new Date()).toISOString();
        console.log(`[WARN] - ${timestamp} - ${text}`);
    }
}
exports.Logger = Logger;
//# sourceMappingURL=util.js.map