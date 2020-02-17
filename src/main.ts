import {enableProdMode} from '@angular/core';
import {platformBrowserDynamic} from '@angular/platform-browser-dynamic';

import {AppModule} from './app/app.module';
import {environment} from './environments/environment';
import 'node-fetch';

import 'hammerjs';

import 'echarts/theme/macarons.js';
import 'echarts/map/js/world.js';
import 'echarts/dist/extension/bmap.min.js';

if (environment.production) {
	enableProdMode();
}

if(!localStorage.getItem('simplEOS.activeChainID')){
	localStorage.setItem('simplEOS.activeChainID','aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906');
}

const url = 'https://raw.githubusercontent.com/eosrio/simpleos/master/config.json';
fetch( url ).then(function(response) {
	if (response.status >= 400) {
		throw new Error("Bad response from server");
	}
	return response.json();
}).then(function(result) {
	const payload = {lastUpdate: new Date(), config: result };
	localStorage.setItem('configSimpleos',JSON.stringify(payload));

	platformBrowserDynamic().bootstrapModule(AppModule, {
		preserveWhitespaces: false
	}).catch(err => console.log(err));
});

