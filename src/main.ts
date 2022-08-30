import {enableProdMode} from '@angular/core';
import {platformBrowserDynamic} from '@angular/platform-browser-dynamic';

import {AppModule} from './app/app.module';
import {environment} from './environments/environment';
import 'hammerjs';

import 'echarts/theme/macarons.js';
// import 'echarts/map/js/world.js';
import 'echarts/dist/extension/bmap.min.js';

function angularBoot(): void {
    if (environment.production) {
        enableProdMode();
    }
    platformBrowserDynamic().bootstrapModule(AppModule, {
        preserveWhitespaces: true
    }).catch(err => console.log(err));
}

async function fecthConfigJson(): Promise<void> {
    const url = 'https://raw.githubusercontent.com/eosrio/simpleos/master/config.json';

    let response;
    try {
        response = await fetch(url);
    } catch (e) {
        console.log('failed to load updated config.json from github');
        console.log(e);
        fecthConfigJson().catch(console.log);
    }

    let jsonBody;
    try {
        jsonBody = await response.json();
    } catch (e) {
        console.log('error parsing json data');
        console.log(e);
    }

    try {
        if (jsonBody) {
            const payload = {lastUpdate: new Date(), config: jsonBody};
            localStorage.setItem('configSimpleos', JSON.stringify(payload));
        }
    } catch (e) {
        console.log('error saving to localStorage');
    }
}

async function fecthErrorJson(): Promise<void> {
    const url = 'https://raw.githubusercontent.com/eosrio/simpleos/master/error.json';

    let response;
    try {
        response = await fetch(url);
    } catch (e) {
        console.log('failed to load updated error.json from github');
        console.log(e);
        fecthErrorJson().catch(console.log);
    }

    let jsonBody;
    try {
        jsonBody = await response.json();
    } catch (e) {
        console.log('error parsing json data');
        console.log(e);
    }

    try {
        if (jsonBody) {
            const payload = {lastUpdate: new Date(), error: jsonBody};
            localStorage.setItem('errorSimpleos', JSON.stringify(payload));
        }
    } catch (e) {
        console.log('error saving to localStorage');
    }
}

(async () => {
    if (!localStorage.getItem('simplEOS.activeChainID')) {
        localStorage.setItem('simplEOS.activeChainID', 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906');
    }
    await fecthConfigJson();
    await fecthErrorJson();
    // Launch Main Application
    angularBoot();
})();
