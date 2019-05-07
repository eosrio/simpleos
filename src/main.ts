import {enableProdMode} from '@angular/core';
import {platformBrowserDynamic} from '@angular/platform-browser-dynamic';

import {AppModule} from './app/app.module';
import {environment} from './environments/environment';

import 'hammerjs';

import 'echarts/theme/macarons.js';
import 'echarts/map/js/world.js';
import 'echarts/dist/extension/bmap.min.js';

if (environment.production) {
	enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule, {
	preserveWhitespaces: false
}).catch(err => console.log(err));
