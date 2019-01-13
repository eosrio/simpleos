"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var core_1 = require("@angular/core");
var platform_browser_dynamic_1 = require("@angular/platform-browser-dynamic");
var app_module_1 = require("./app/app.module");
var environment_1 = require("./environments/environment");
require("hammerjs");
require("echarts/theme/macarons.js");
require("echarts/map/js/world.js");
require("echarts/dist/extension/bmap.min.js");
if (environment_1.environment.production) {
    core_1.enableProdMode();
}
platform_browser_dynamic_1.platformBrowserDynamic().bootstrapModule(app_module_1.AppModule, {
    preserveWhitespaces: false
}).catch(function (err) { return console.log(err); });
//# sourceMappingURL=main.js.map