"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@angular/core");
const platform_browser_dynamic_1 = require("@angular/platform-browser-dynamic");
const app_module_1 = require("./app/app.module");
const environment_1 = require("./environments/environment");
require("node-fetch");
require("hammerjs");
require("echarts/theme/macarons.js");
// import 'echarts/map/js/world.js';
require("echarts/dist/extension/bmap.min.js");
function angularBoot() {
    if (environment_1.environment.production) {
        (0, core_1.enableProdMode)();
    }
    (0, platform_browser_dynamic_1.platformBrowserDynamic)().bootstrapModule(app_module_1.AppModule, {
        preserveWhitespaces: true
    }).catch(err => console.log(err));
}
function fecthConfigJson() {
    return __awaiter(this, void 0, void 0, function* () {
        const url = 'https://raw.githubusercontent.com/eosrio/simpleos/master/config.json';
        let response;
        try {
            response = yield fetch(url);
        }
        catch (e) {
            console.log('failed to load updated config.json from github');
            console.log(e);
            fecthConfigJson().catch(console.log);
        }
        let jsonBody;
        try {
            jsonBody = yield response.json();
        }
        catch (e) {
            console.log('error parsing json data');
            console.log(e);
        }
        try {
            if (jsonBody) {
                const payload = { lastUpdate: new Date(), config: jsonBody };
                localStorage.setItem('configSimpleos', JSON.stringify(payload));
            }
        }
        catch (e) {
            console.log('error saving to localStorage');
        }
    });
}
function fecthErrorJson() {
    return __awaiter(this, void 0, void 0, function* () {
        const url = 'https://raw.githubusercontent.com/eosrio/simpleos/master/error.json';
        let response;
        try {
            response = yield fetch(url);
        }
        catch (e) {
            console.log('failed to load updated error.json from github');
            console.log(e);
            fecthErrorJson().catch(console.log);
        }
        let jsonBody;
        try {
            jsonBody = yield response.json();
        }
        catch (e) {
            console.log('error parsing json data');
            console.log(e);
        }
        try {
            if (jsonBody) {
                const payload = { lastUpdate: new Date(), error: jsonBody };
                localStorage.setItem('errorSimpleos', JSON.stringify(payload));
            }
        }
        catch (e) {
            console.log('error saving to localStorage');
        }
    });
}
(() => __awaiter(void 0, void 0, void 0, function* () {
    if (!localStorage.getItem('simplEOS.activeChainID')) {
        localStorage.setItem('simplEOS.activeChainID', 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906');
    }
    yield fecthConfigJson();
    yield fecthErrorJson();
    // Launch Main Application
    angularBoot();
}))();
//# sourceMappingURL=main.js.map