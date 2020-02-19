import {enableProdMode} from '@angular/core';
import {platformBrowserDynamic} from '@angular/platform-browser-dynamic';

import {AppModule} from './app/app.module';
import {environment} from './environments/environment';
import 'node-fetch';

import 'hammerjs';

import 'echarts/theme/macarons.js';
import 'echarts/map/js/world.js';
import 'echarts/dist/extension/bmap.min.js';

function angularBoot() {
    if (environment.production) {
        enableProdMode();
    }
    platformBrowserDynamic().bootstrapModule(AppModule, {
        preserveWhitespaces: false
    }).catch(err => console.log(err));
}

(async () => {

    if (!localStorage.getItem('simplEOS.activeChainID')) {
        localStorage.setItem('simplEOS.activeChainID', 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906');
    }

    const url = 'https://raw.githubusercontent.com/eosrio/simpleos/master/config.json';

    let response;
    try {
        response = await fetch(url);
    } catch (e) {
        console.log('failed to load updated config.json from github');
        console.log(e);
    }

    let jsonBody;
    try {
        jsonBody = await response.json();
    } catch (e) {
        console.log('error parsing json data');
        console.log(e);
    }

    try {
		if(jsonBody) {
			const payload = {lastUpdate: new Date(), config: jsonBody};
			localStorage.setItem('configSimpleos', JSON.stringify(payload));
		}
	} catch (e) {
		console.log('error saving to localStorage');
	}

	// Launch Main Application
    angularBoot();
})();
